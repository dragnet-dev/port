import { Context } from 'hono'
import { fetchActorAliasIndex } from '../github'
import { baseLayout, escHtml } from '../ui/layout'
import type { Env } from '../types'

export async function actorsIndexRoute(c: Context<{ Bindings: Env }>) {
    const q = (c.req.query('q') ?? '').toLowerCase().trim()
    const aliases = await fetchActorAliasIndex(c.env)

    // Invert: canonical id -> list of aliases (excluding the self-reference).
    const byCanonical = new Map<string, string[]>()
    for (const [alias, canonical] of Object.entries(aliases)) {
        const list = byCanonical.get(canonical) ?? []
        if (alias !== canonical) list.push(alias)
        byCanonical.set(canonical, list)
    }

    let sorted = [...byCanonical.entries()].sort(([a], [b]) => a.localeCompare(b))

    // Filter by query against canonical name or aliases.
    if (q) {
        sorted = sorted.filter(([canonical, aliasList]) =>
            canonical.toLowerCase().includes(q) ||
            aliasList.some(a => a.toLowerCase().includes(q))
        )
    }

    const filterBar = `<form class="filter-bar" method="get" action="/actors" style="margin-bottom:24px">
    <input class="filter-input" name="q" type="search" placeholder="Filter actors…" value="${escHtml(q)}" style="max-width:320px" />
    <button type="submit" class="copy-btn">Filter</button>
    ${q ? `<a href="/actors" style="font-size:13px;color:var(--text-muted);margin-left:8px">Clear</a>` : ''}
</form>`

    let body: string

    if (q) {
        // Filtered: flat list in a compact grid
        const rows = sorted.map(([canonical, aliasList]) =>
            actorCard(canonical, aliasList)
        ).join('')
        body = sorted.length
            ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">${sorted.length} result${sorted.length !== 1 ? 's' : ''} for "${escHtml(q)}"</p>
               <div class="actor-grid">${rows}</div>`
            : `<p style="font-size:13px;color:var(--text-muted)">No actors match "${escHtml(q)}".</p>`
    } else {
        // Group by first letter of canonical name.
        const byLetter = new Map<string, Array<[string, string[]]>>()
        for (const entry of sorted) {
            const letter = entry[0][0]?.toUpperCase() ?? '#'
            const group = byLetter.get(letter) ?? []
            group.push(entry)
            byLetter.set(letter, group)
        }

        // A-Z jump bar — only show letters that exist.
        const letters = [...byLetter.keys()].sort()
        const jumpBar = `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:24px">
            ${letters.map(l => `<a href="#actor-${encodeURIComponent(l)}" style="display:inline-block;min-width:28px;padding:3px 6px;text-align:center;font-size:12px;font-weight:600;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:4px;color:var(--text-muted)">${escHtml(l)}</a>`).join('')}
        </div>`

        const sections = letters.map(letter => {
            const entries = byLetter.get(letter)!
            const rows = entries.map(([canonical, aliasList]) =>
                actorCard(canonical, aliasList)
            ).join('')
            return `<div id="actor-${encodeURIComponent(letter)}" style="margin-bottom:32px">
                <div class="section-header" style="font-size:18px;font-weight:700;color:var(--text-muted);margin-bottom:12px;letter-spacing:-0.3px">${escHtml(letter)}</div>
                <div class="actor-grid">${rows}</div>
            </div>`
        }).join('')

        body = jumpBar + sections
    }

    const html = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">Threat Actors</h1>
        <p class="page-subtitle">${byCanonical.size} profiles sourced from MITRE ATT&amp;CK.</p>
    </div>
    ${filterBar}
    ${body}
</div>`

    return c.html(baseLayout('Actors', html, c.env, '/actors'))
}

function actorCard(canonical: string, aliasList: string[]): string {
    const aliasText = aliasList.length > 0
        ? aliasList.slice(0, 4).join(', ') + (aliasList.length > 4 ? ` +${aliasList.length - 4}` : '')
        : ''
    return `<a href="/actors/${encodeURIComponent(canonical)}" class="actor-entry">
    <span class="actor-entry-name">${escHtml(canonical)}</span>
    ${aliasText ? `<span class="actor-entry-aliases" title="${escHtml(aliasList.join(', '))}">${escHtml(aliasText)}</span>` : ''}
</a>`
}
