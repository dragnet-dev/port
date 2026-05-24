import { Context } from 'hono'
import { fetchActor, fetchActorAliasIndex, fetchHomeSlice } from '../github'
import { MODULES } from '../config'
import { baseLayout, errorPage, escHtml } from '../ui/layout'
import { incidentCard } from '../ui/components'
import { isValidSlug } from '../lib/validate'
import type { Env, IncidentSummary, ThreatActor } from '../types'

// resolveActorSlug runs an incoming URL slug through the alias index so
// /actors/midnight-blizzard or /actors/cozy-bear resolve to the canonical
// profile id (apt29). The alias index keys are lowercase, space-separated
// (e.g. "midnight blizzard"), so try the slug as-is and with hyphens
// converted to spaces.
async function resolveActorSlug(env: Env, slug: string): Promise<string> {
    const lower = slug.toLowerCase()
    const aliases = await fetchActorAliasIndex(env)
    return aliases[lower] ?? aliases[lower.replace(/-/g, ' ')] ?? slug
}

export async function actorRoute(c: Context<{ Bindings: Env }>) {
    const slug = c.req.param('name') ?? ''
    if (!isValidSlug(slug)) return c.notFound()
    const canonical = await resolveActorSlug(c.env, slug)
    const actor = await fetchActor(c.env, canonical)
    if (!actor) {
        const html = errorPage({
            code:  404,
            title: 'Actor not found',
            body:  `<p>No threat actor profile for <code>${escHtml(slug)}</code>.</p>`,
        })
        return c.html(baseLayout('Actor not found', html, c.env), 404)
    }

    const linkedIncidents = await findLinkedIncidents(c.env, actor)

    const typePill = actor.type
        ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400;text-transform:capitalize">${escHtml(actor.type.replace(/-/g, ' '))}</span>`
        : ''
    const mitreLink = actor.mitre_id
        ? `<a href="https://attack.mitre.org/groups/${escHtml(actor.mitre_id)}/" target="_blank" rel="noopener" class="mitre-link">${escHtml(actor.mitre_id)} ↗</a>`
        : ''
    const confidenceChip = actor.confidence
        ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400">confidence: ${escHtml(actor.confidence)}</span>`
        : ''

    const ttpRows = (actor.ttps ?? []).map(t => `
    <div class="mitre-row">
        <span class="mitre-id">${escHtml(t.id)}</span>
        <span class="mitre-name">${escHtml(t.name)}</span>
        <a href="https://attack.mitre.org/techniques/${escHtml(t.id.replace('.', '/'))}/" target="_blank" rel="noopener" class="mitre-link">↗ MITRE</a>
    </div>`).join('')

    const softwareChips = (actor.software ?? [])
        .map(s => `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400;margin:2px 4px 2px 0">${escHtml(s)}</span>`)
        .join('')

    const incidentCards = linkedIncidents
        .sort((a, b) => new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime())
        .map(i => incidentCard(i, i.module ?? ''))
        .join('')

    const html = `<div class="container page">
    <div class="actor-header">
        <div>
            <h1 class="actor-name">${escHtml(actor.name)}</h1>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
                ${typePill}${mitreLink}${confidenceChip}
            </div>
            ${actor.aliases?.length ? `<div class="actor-aliases" style="margin-top:8px">Also known as: ${actor.aliases.map(escHtml).join(', ')}</div>` : ''}
            ${actor.description ? `<p style="font-size:14px;color:var(--text-muted);margin-top:8px;line-height:1.6">${escHtml(actor.description)}</p>` : ''}
        </div>
    </div>

    ${ttpRows ? `<div style="margin-bottom:24px">
        <div class="section-header">MITRE ATT&amp;CK techniques</div>
        <div class="mitre-list">${ttpRows}</div>
    </div>` : ''}

    ${softwareChips ? `<div style="margin-bottom:24px">
        <div class="section-header">Software &amp; tooling</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${softwareChips}</div>
    </div>` : ''}

    <div style="margin-bottom:24px">
        <div class="section-header">Linked incidents${linkedIncidents.length ? ` (${linkedIncidents.length})` : ''}</div>
        ${linkedIncidents.length
            ? incidentCards
            : `<p style="color:var(--text-muted);font-size:13px;line-height:1.6">No incidents in the live module indexes currently reference this actor. Full coverage is available via the <a href="/feeds" style="color:var(--accent)">module search feeds</a>.</p>`}
    </div>
</div>`

    return c.html(baseLayout(actor.name, html, c.env, '/actors'))
}

async function findLinkedIncidents(env: Env, actor: ThreatActor) {
    const needles = new Set<string>()
    needles.add(actor.name.toLowerCase())
    for (const a of actor.aliases ?? []) needles.add(a.toLowerCase())

    // Fast path: check actor-inc:{name} KV entries written by the scheduled
    // handler. These are pre-built from the home slices so the lookup is a few
    // KV reads instead of downloading all module indexes.
    const seenIds = new Set<string>()
    const kvHits: Array<IncidentSummary & { module: string }> = []
    for (const needle of needles) {
        const raw = await env.CACHE.get(`actor-inc:${needle}`)
        if (!raw) continue
        try {
            const entries = JSON.parse(raw) as Array<IncidentSummary & { module: string }>
            for (const e of entries) {
                if (!seenIds.has(e.id)) {
                    seenIds.add(e.id)
                    kvHits.push(e)
                }
            }
        } catch { /* ignore corrupt entry */ }
    }
    if (kvHits.length > 0) return kvHits

    // Fallback: scan home slices (fetched from KV or, on miss, from haul).
    // Uses fetchHomeSlice rather than the full index to avoid 57 MB downloads.
    const liveModules = MODULES.filter(m => m.live)
    const fetched = await Promise.all(
        liveModules.map(async mod => ({ mod, idx: await fetchHomeSlice(env, mod.id) }))
    )

    return fetched.flatMap(({ mod, idx }) => {
        if (!idx) return []
        const hits = idx.incidents.filter(i => i.actor && needles.has(i.actor.toLowerCase()))
        return hits.map(i => ({ ...i, module: mod.id }))
    })
}
