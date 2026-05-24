import { Context } from 'hono'
import { fetchRootIndex, fetchHomeSlice } from '../github'
import { MODULES, getTurnstileSiteKey } from '../config'
import { baseLayout, escHtml } from '../ui/layout'
import { incidentCard, relativeTime } from '../ui/components'
import type { Env, IncidentSummary } from '../types'

function daysSince(dateStr: string | undefined): number {
    if (!dateStr) return Infinity
    return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

function trendingScore(inc: IncidentSummary): number {
    const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    const ageDecay = Math.max(0, 30 - daysSince(inc.published)) / 30
    return (severityWeight[inc.severity] ?? 1) * (inc.source_count + 1) *
        Math.log10(inc.ioc_count + 1) * ageDecay
}

export async function homeRoute(c: Context<{ Bindings: Env }>) {
    const env = c.env
    const liveModules = MODULES.filter(m => m.live)

    // _stats:ioc_count and _home:${module} are written by the scheduled handler
    // every 10 minutes. On a fresh deploy (before the first cron run) both fall
    // back gracefully: ioc count shows 0 and module slices fall back to
    // fetchIndex. After the first cron tick everything reads from tiny KV entries.
    const [rootIndex, iocCountRaw, ...moduleSlices] = await Promise.all([
        fetchRootIndex(env),
        env.CACHE.get('_stats:ioc_count'),
        ...liveModules.map(mod => fetchHomeSlice(env, mod.id)),
    ])
    const fetched = liveModules.map((mod, i) => ({ mod, idx: moduleSlices[i] }))
    const iocsFromManifest = iocCountRaw ? parseInt(iocCountRaw, 10) : 0
    const allSummaries: IncidentSummary[] = fetched.flatMap(({ mod, idx }) =>
        idx ? idx.incidents.map(i => ({ ...i, module: mod.id })) : []
    )

    const sorted = [...allSummaries].sort((a, b) =>
        new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime()
    )
    const recent = sorted.slice(0, 6)
    const trending = [...allSummaries]
        .sort((a, b) => trendingScore(b) - trendingScore(a))
        .slice(0, 6)

    // Stats fallback: when dragnet hasn't shipped a root incidents/index.json
    // (or it's present but empty), derive totals by summing each module's
    // curated index. Per-module total_iocs is currently always 0, so the IOC
    // count is taken from feeds/manifest.json (counts the records inside
    // feeds/unified.jsonl, the canonical cross-module IOC feed).
    const computedTotals = fetched.reduce(
        (acc, { idx }) => idx
            ? { incidents: acc.incidents + idx.stats.total_incidents, iocs: acc.iocs + idx.stats.total_iocs }
            : acc,
        { incidents: 0, iocs: 0 },
    )
    if (computedTotals.iocs === 0) computedTotals.iocs = iocsFromManifest
    const rootTotal = rootIndex?.stats?.total
    const total = (rootTotal && rootTotal.incidents > 0)
        ? { incidents: rootTotal.incidents, iocs: rootTotal.iocs || iocsFromManifest }
        : computedTotals

    const youngestSync = fetched
        .map(({ idx }) => idx?.stats.last_sync)
        .filter((x): x is string => !!x)
        .sort()
        .pop()
    const updatedAgo = relativeTime(rootIndex?.generated ?? youngestSync) || 'recently'

    const liveCount = liveModules.length
    const showStats = !!rootIndex?.stats || computedTotals.incidents > 0
    const statsBar = showStats ? `
<div class="stats-bar">
    <div class="stat"><span class="stat-value">${total.incidents.toLocaleString()}</span> <span class="stat-label">Incidents</span></div>
    <div class="stat"><span class="stat-value">${total.iocs.toLocaleString()}</span> <span class="stat-label">IOCs</span></div>
    <div class="stat"><span class="stat-value">${liveCount}</span> <span class="stat-label">Modules</span></div>
    <div class="stat"><span class="stat-live">● Synced ${escHtml(updatedAgo)}</span></div>
</div>` : ''

    const modulePills = MODULES.map(m => {
        const attrs = m.live
            ? `href="/${m.id}" class="module-pill live"`
            : `href="#" class="module-pill" aria-disabled="true" style="opacity:0.5;pointer-events:none"`
        const dot = m.live ? '' : ' <span class="pill-dot">·</span>'
        return `<a ${attrs}>${m.icon} ${escHtml(m.name)}${dot}</a>`
    }).join('')

    const recentCards = recent.map(i => incidentCard(i, i.module ?? '')).join('')
    const trendingCards = trending.map(i => incidentCard(i, i.module ?? '')).join('')

    const html = `
<div class="hero">
    <div class="eyebrow"><span class="live-dot"></span> Live · updated ${escHtml(updatedAgo)}</div>
    <h1>Open source threat intelligence</h1>
    <p class="subtext">Detection rules, IOC feeds, and hunting queries for every major SIEM. Free. No account.</p>

    <div class="check-widget">
        <div class="check-label">Check a package, domain, hash, image, action, or model</div>
        <form class="check-row" id="check-form">
            <input class="check-input" id="check-input" name="value" type="text"
                placeholder="e.g. @tanstack/react-router"
                data-placeholders='["@tanstack/react-router","git-tanstack.com","node:18.10.0","tj-actions/changed-files@v35","openai/fake-privacy-filter"]'
                autocomplete="off" />
            <button class="check-btn" type="submit">Check</button>
            <div class="cf-turnstile" data-sitekey="${escHtml(getTurnstileSiteKey(c.env))}" data-callback="onTurnstileSuccess" data-size="invisible" style="display:none"></div>
        </form>
        <div id="check-result" class="check-result"></div>
    </div>

    <div class="module-pills">${modulePills}</div>
</div>

${statsBar}

<div class="container">
    <div class="two-col" style="padding-bottom:64px">
        <div>
            <div class="section-header">New</div>
            ${recentCards || '<p style="color:var(--text-muted);font-size:13px">No incidents yet.</p>'}
        </div>
        <div>
            <div class="section-header">Trending</div>
            ${trendingCards || '<p style="color:var(--text-muted);font-size:13px">No incidents yet.</p>'}
        </div>
    </div>
</div>`

    return c.html(baseLayout('Open source threat intelligence', html, env, '/'))
}
