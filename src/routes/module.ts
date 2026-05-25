import { Context } from 'hono'
import { fetchHomeSlice } from '../github'
import { MODULES } from '../config'
import { baseLayout, escHtml } from '../ui/layout'
import { incidentCard } from '../ui/components'
import type { Env } from '../types'

export async function moduleRoute(c: Context<{ Bindings: Env }>) {
    const moduleId = c.req.param('module') ?? ''
    const mod = MODULES.find(m => m.id === moduleId)
    if (!mod) return c.notFound()

    if (!mod.live) {
        const html = `<div class="container page">
    <div class="coming-soon-page">
        <div class="coming-soon-icon">${mod.icon}</div>
        <h1>${escHtml(mod.name)}</h1>
        <p>${escHtml(mod.description)}</p>
        <p style="font-size:13px;color:var(--text-subtle)">Coming soon. Follow
        <a href="https://github.com/dragnet-dev" target="_blank" rel="noopener">dragnet-dev</a>
        for updates.</p>
    </div>
</div>`
        return c.html(baseLayout(mod.name, html, c.env, `/${moduleId}`))
    }

    const idx = await fetchHomeSlice(c.env, moduleId)
    if (!idx) {
        // Module is live but data hasn't synced yet  -  show a holding page rather
        // than a 503. The scheduled handler will build the KV slice on next cron fire.
        const html = `<div class="container page">
    <div class="coming-soon-page">
        <div class="coming-soon-icon">${mod.icon}</div>
        <h1>${escHtml(mod.name)}</h1>
        <p>${escHtml(mod.description)}</p>
        <p style="font-size:13px;color:var(--text-subtle)">Data is syncing. Check back shortly.</p>
    </div>
</div>`
        return c.html(baseLayout(mod.name, html, c.env, `/${moduleId}`))
    }

    const recent = [...idx.incidents]
        .sort((a, b) => new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime())
        .slice(0, 5)

    const campaigns = [...new Set(idx.incidents.map(i => i.campaign).filter(Boolean))] as string[]
    const totalIncidents = idx.stats?.total_incidents ?? idx.incidents.length

    const recentCards = recent.map(i => incidentCard(i, moduleId)).join('')

    const campaignLinks = campaigns.slice(0, 8).map(c =>
        `<a href="/${moduleId}/incidents?campaign=${encodeURIComponent(c)}" style="font-size:13px;color:var(--accent)">${escHtml(c)}</a>`
    ).join(' · ')

    const html = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">${mod.icon} ${escHtml(mod.name)}</h1>
        <p class="page-subtitle">${escHtml(mod.description)}</p>
    </div>

    <div style="display:flex;gap:32px;flex-wrap:wrap;margin-bottom:32px">
        <div style="flex:1;min-width:280px">
            <div class="section-header">Recent incidents</div>
            ${recentCards}
            <a href="/${moduleId}/incidents" style="font-size:13px;color:var(--accent)">View all ${totalIncidents.toLocaleString()} incidents →</a>
        </div>
        <div style="min-width:220px">
            ${campaigns.length ? `<div class="section-header">Active campaigns</div>
            <div style="display:flex;flex-direction:column;gap:6px">${campaignLinks}</div>` : ''}

            <div class="section-header" style="margin-top:24px">Feeds</div>
            <a href="/feeds" style="font-size:13px;color:var(--accent)">View all IOC &amp; intelligence feeds →</a>
        </div>
    </div>
</div>`

    return c.html(baseLayout(mod.name, html, c.env, `/${moduleId}`))
}

