import { Context } from 'hono'
import { fetchHomeSlice, fetchSearchIndex } from '../github'
import { MODULES } from '../config'
import { baseLayout, escHtml } from '../ui/layout'
import { incidentCard } from '../ui/components'
import type { Env, IncidentSummary, SearchRecord } from '../types'

const PAGE_SIZE = 20

// searchRecordToSummary maps a SearchRecord (slim, lives in feeds/search-*)
// into the IncidentSummary shape incidentCard expects. Used by the listing
// fallback when {module}/incidents/index.json hasn't been populated by
// dragnet yet — the search index is a superset, so we can degrade to it
// without changing the renderer.
function searchRecordToSummary(rec: SearchRecord): IncidentSummary {
    return {
        id:           rec.id,
        module:       rec.module,
        severity:     rec.severity ?? 'medium',
        attack_type:  rec.tags?.[0] ?? 'vulnerability',
        ecosystem:    rec.ecosystems?.[0],
        published:    rec.published,
        packages:     rec.packages?.map(p => p.name),
        actor:        rec.actors?.[0],
        ioc_count:    0,
        source_count: 0,
    }
}

export async function incidentsRoute(c: Context<{ Bindings: Env }>) {
    const moduleId = c.req.param('module') ?? ''
    const mod = MODULES.find(m => m.id === moduleId)
    if (!mod) return c.notFound()
    if (!mod.live) return c.redirect(`/${moduleId}`)

    const q         = c.req.query('q')?.toLowerCase() ?? ''
    const severity  = c.req.query('severity') ?? ''
    const attackType= c.req.query('attack_type') ?? ''
    const ecosystem = c.req.query('ecosystem') ?? ''
    const page      = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))

    const idx = await fetchHomeSlice(c.env, moduleId)
    if (!idx) return c.html(baseLayout('Error', '<div class="container page"><p style="color:var(--text-muted)">Module data unavailable.</p></div>', c.env), 503)

    // When the curated index is empty (dragnet still building it), fall back
    // to the full search index for this module. Smaller per-record shape, but
    // every incident in haul is in there.
    let items: IncidentSummary[]
    let usedSearchFallback = false
    const totalInModule = idx.stats?.total_incidents ?? idx.incidents.length
    const sliceTruncated = idx.incidents.length < totalInModule
    if (idx.incidents.length === 0) {
        const records = await fetchSearchIndex(c.env, moduleId)
        items = records.map(searchRecordToSummary)
        usedSearchFallback = items.length > 0
    } else {
        items = idx.incidents as IncidentSummary[]
    }

    if (q) {
        items = items.filter(i =>
            i.packages?.some(p => p.toLowerCase().includes(q)) ||
            i.campaign?.toLowerCase().includes(q) ||
            i.actor?.toLowerCase().includes(q) ||
            i.id.toLowerCase().includes(q) ||
            i.iocs?.some(ioc => ioc.value.toLowerCase().includes(q))
        )
    }
    if (severity) items = items.filter(i => i.severity === severity)
    if (attackType) items = items.filter(i => i.attack_type === attackType)
    if (ecosystem) items = items.filter(i => i.ecosystem === ecosystem)

    items = [...items].sort((a, b) => new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime())

    const total = items.length
    const pages = Math.ceil(total / PAGE_SIZE)
    const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const qs = (extra: Record<string, string>) => {
        const p = new URLSearchParams()
        if (q)          p.set('q', q)
        if (severity)   p.set('severity', severity)
        if (attackType) p.set('attack_type', attackType)
        if (ecosystem)  p.set('ecosystem', ecosystem)
        Object.entries(extra).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
        return p.toString() ? `?${p.toString()}` : ''
    }

    const ecosystems = [...new Set(items.map(i => i.ecosystem).filter(Boolean))].sort() as string[]
    const filterBar = `<form class="filter-bar" method="get" action="">
    <input class="filter-input" name="q" type="search" placeholder="Search…" value="${escHtml(q)}" />
    <select class="filter-select" name="severity" onchange="this.form.submit()">
        <option value="">All severities</option>
        ${['critical','high','medium','low'].map(s =>
            `<option value="${s}" ${severity===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
        ).join('')}
    </select>
    <select class="filter-select" name="attack_type" onchange="this.form.submit()">
        <option value="">All types</option>
        ${[...new Set(items.map(i => i.attack_type).filter(Boolean))].map(t =>
            `<option value="${t}" ${attackType===t?'selected':''}>${escHtml(t.replace(/_/g,' '))}</option>`
        ).join('')}
    </select>
    ${ecosystems.length > 1 ? `<select class="filter-select" name="ecosystem" onchange="this.form.submit()">
        <option value="">All ecosystems</option>
        ${ecosystems.map(e => `<option value="${escHtml(e)}" ${ecosystem===e?'selected':''}>${escHtml(e)}</option>`).join('')}
    </select>` : ''}
    <button type="submit" class="copy-btn">Filter</button>
</form>`

    const cards = pageItems.map(i => incidentCard(i, moduleId)).join('') ||
        '<p style="color:var(--text-muted);font-size:13px">No incidents match your filters.</p>'

    const pagination = pages > 1 ? `<div class="pagination">
    ${page > 1 ? `<a href="${qs({page: String(page-1)})}" class="page-btn">← Prev</a>` : ''}
    <span style="font-size:13px;color:var(--text-muted)">Page ${page} of ${pages}</span>
    ${page < pages ? `<a href="${qs({page: String(page+1)})}" class="page-btn">Next →</a>` : ''}
</div>` : ''

    const fallbackBanner = usedSearchFallback
        ? `<div style="background:rgba(124,58,237,0.08);border:1px solid var(--accent-border);border-radius:6px;padding:10px 14px;font-size:13px;color:var(--text-muted);margin-bottom:16px">Showing approximate matches from the full search index — curated metadata is still generating.</div>`
        : sliceTruncated && !q && !severity && !attackType && !ecosystem
            ? `<div style="background:rgba(124,58,237,0.08);border:1px solid var(--accent-border);border-radius:6px;padding:10px 14px;font-size:13px;color:var(--text-muted);margin-bottom:16px">Showing the ${idx.incidents.length.toLocaleString()} most recent of ${totalInModule.toLocaleString()} total incidents. Use <a href="/${moduleId}/search" style="color:var(--accent)">search</a> to find specific incidents.</div>`
            : ''

    const html = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">${mod.icon} ${escHtml(mod.name)} Incidents</h1>
        <p class="page-subtitle">${total.toLocaleString()} incident${total !== 1 ? 's' : ''}${q ? ` matching "${escHtml(q)}"` : ''}</p>
    </div>
    ${fallbackBanner}
    ${filterBar}
    ${cards}
    ${pagination}
</div>`

    return c.html(baseLayout(`${mod.name} Incidents`, html, c.env, `/${moduleId}`))
}
