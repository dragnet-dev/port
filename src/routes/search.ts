import { Context } from 'hono'
import { fetchHomeSlice } from '../github'
import { MODULES } from '../config'
import { baseLayout, escHtml } from '../ui/layout'
import type { Env, IncidentSummary } from '../types'

const MAX_RESULTS = 50

export async function searchRoute(c: Context<{ Bindings: Env }>) {
    const q = (c.req.query('q') ?? '').trim()
    if (!q) {
        const help = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">Search</h1>
        <p class="page-subtitle">Find an incident across every live module.</p>
    </div>
    <form method="get" action="/search" style="display:flex;gap:8px;margin-bottom:24px">
        <input class="filter-input" name="q" type="search" autofocus placeholder="Try a package name, CVE id, actor alias, or incident id" style="flex:1" />
        <button type="submit" class="copy-btn">Search</button>
    </form>
    <div style="font-size:13px;color:var(--text-muted);line-height:1.8">
        Examples:
        <ul style="margin-top:8px">
            <li><a href="/search?q=event-stream" style="color:var(--accent)">event-stream</a> <span style="color:var(--text-subtle)">(package name)</span></li>
            <li><a href="/search?q=CVE-2024" style="color:var(--accent)">CVE-2024</a> <span style="color:var(--text-subtle)">(CVE prefix)</span></li>
            <li><a href="/search?q=apt29" style="color:var(--accent)">apt29</a> <span style="color:var(--text-subtle)">(actor alias)</span></li>
            <li><a href="/search?q=lazarus" style="color:var(--accent)">lazarus</a> <span style="color:var(--text-subtle)">(campaign name)</span></li>
        </ul>
    </div>
</div>`
        return c.html(baseLayout('Search', help, c.env, '/search'))
    }

    const ql = q.toLowerCase()
    const liveModules = MODULES.filter(m => m.live)

    // Use the pre-built home slices (KV, 200 most-recent per module) for fast
    // search across recent incidents. This covers the vast majority of useful
    // searches without downloading hundreds of MB of JSONL shards.
    const slices = await Promise.all(
        liveModules.map(mod => fetchHomeSlice(c.env, mod.id))
    )
    const all: IncidentSummary[] = slices.flatMap((idx, i) =>
        idx ? idx.incidents.map(inc => ({ ...inc, module: liveModules[i].id })) : []
    )
    const totalTracked = slices.reduce((n, idx) => n + (idx?.stats?.total_incidents ?? 0), 0)

    const matches = all.filter(r =>
        r.id.toLowerCase().includes(ql) ||
        r.packages?.some(p => p.toLowerCase().includes(ql)) ||
        r.campaign?.toLowerCase().includes(ql) ||
        r.actor?.toLowerCase().includes(ql) ||
        r.iocs?.some(ioc => ioc.value.toLowerCase().includes(ql))
    ).sort((a, b) => {
        const ap = a.published ? new Date(a.published).getTime() : 0
        const bp = b.published ? new Date(b.published).getTime() : 0
        return bp - ap
    })

    const shown = matches.slice(0, MAX_RESULTS)
    const cards = shown.map(r => {
        const mod = r.module ?? ''
        const href = `/${mod}/incidents/${r.id}`
        return `<a href="${href}" class="incident-card">
    <div class="card-top">
        <span class="incident-id">${escHtml(r.id)}</span>
        ${r.severity ? `<span class="badge badge-${r.severity}">${r.severity}</span>` : ''}
        ${mod ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400">${escHtml(mod)}</span>` : ''}
    </div>
    ${r.packages?.length ? `<div class="card-packages">${r.packages.slice(0, 3).map(p => `<span class="pkg-tag">${escHtml(p)}</span>`).join('')}</div>` : ''}
    <div class="card-meta">
        ${r.campaign ? `<span>${escHtml(r.campaign)}</span>` : ''}
        ${r.published ? `<span>${escHtml(r.published.slice(0, 10))}</span>` : ''}
    </div>
</a>`
    }).join('') || '<p style="color:var(--text-muted);font-size:13px">No incidents match your search.</p>'

    const truncatedNote = matches.length > MAX_RESULTS
        ? `<p style="font-size:13px;color:var(--text-muted);margin-top:16px">Showing ${MAX_RESULTS} of ${matches.length.toLocaleString()} matches. Refine your query for narrower results.</p>`
        : ''

    const coverageNote = `<p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Searching the ${all.length.toLocaleString()} most recent incidents of ${totalTracked.toLocaleString()} total. Browse a module's <a href="/${liveModules[0].id}/incidents" style="color:var(--accent)">incident list</a> for older results.</p>`

    const html = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">Search results</h1>
        <p class="page-subtitle">${matches.length.toLocaleString()} result${matches.length !== 1 ? 's' : ''} for "${escHtml(q)}"</p>
    </div>
    <form method="get" action="/search" style="display:flex;gap:8px;margin-bottom:24px">
        <input class="filter-input" name="q" type="search" value="${escHtml(q)}" style="flex:1" />
        <button type="submit" class="copy-btn">Search</button>
    </form>
    ${coverageNote}
    ${cards}
    ${truncatedNote}
</div>`

    return c.html(baseLayout(`Search: ${escHtml(q)}`, html, c.env))
}
