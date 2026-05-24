import { Context } from 'hono'
import { fetchActorAliasIndex } from '../github'
import { baseLayout, escHtml } from '../ui/layout'
import type { Env } from '../types'

// actorsIndexRoute lists every canonical actor profile in haul, derived from
// actors/index.yaml (alias -> canonical id). Each canonical id is a link;
// known aliases are listed underneath as small chips.
export async function actorsIndexRoute(c: Context<{ Bindings: Env }>) {
    const aliases = await fetchActorAliasIndex(c.env)

    // Invert: canonical id -> list of aliases (excluding the self-reference).
    const byCanonical = new Map<string, string[]>()
    for (const [alias, canonical] of Object.entries(aliases)) {
        const list = byCanonical.get(canonical) ?? []
        if (alias !== canonical) list.push(alias)
        byCanonical.set(canonical, list)
    }

    const sorted = [...byCanonical.entries()].sort(([a], [b]) => a.localeCompare(b))

    const cards = sorted.map(([canonical, aliasList]) => {
        const chips = aliasList.slice(0, 6).map(a =>
            `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400;margin:2px 4px 2px 0">${escHtml(a)}</span>`
        ).join('')
        const more = aliasList.length > 6
            ? `<span style="font-size:11px;color:var(--text-subtle)">+${aliasList.length - 6} more</span>`
            : ''
        return `<a href="/actors/${encodeURIComponent(canonical)}" class="incident-card" style="display:block">
    <div class="card-top">
        <span class="incident-id">${escHtml(canonical)}</span>
    </div>
    ${chips || more ? `<div class="card-meta" style="flex-wrap:wrap">${chips}${more}</div>` : ''}
</a>`
    }).join('')

    const html = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">Threat actors</h1>
        <p class="page-subtitle">${sorted.length} actor profile${sorted.length !== 1 ? 's' : ''} sourced from MITRE ATT&amp;CK.</p>
    </div>
    ${sorted.length
        ? cards
        : '<p style="color:var(--text-muted);font-size:13px">No actor profiles available yet.</p>'}
</div>`

    return c.html(baseLayout('Actors', html, c.env, '/actors'))
}
