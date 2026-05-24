import { Context } from 'hono'
import { fetchIncident, fetchHaulIndex } from '../github'
import { MODULES, resolveBase } from '../config'
import { baseLayout, errorPage, escHtml } from '../ui/layout'
import { severityBadge, confidenceBar, iocTable, exposureBlock, ruleAccordion, behaviourHunting, relativeTime } from '../ui/components'
import { isValidSlug } from '../lib/validate'
import type { Env, Incident } from '../types'

// shardKey mirrors src/github.ts:shardKey and dragnet's persist.shardKey.
// Used to construct the "Raw data" link for bulk-imported incidents that
// don't have a per-ecosystem curated YAML on disk.
function shardKey(id: string): string {
    const s = id.toLowerCase()
    let end = 0
    while (end < s.length) {
        const c = s.charCodeAt(end)
        const isAlpha = c >= 97 && c <= 122
        const isDigit = c >= 48 && c <= 57
        if (!isAlpha && !isDigit) break
        end++
    }
    return end === 0 ? 'misc' : s.slice(0, end)
}

function actionExposureTab(incident: Incident): string {
    const pkgs = incident.packages ?? []
    const lines = pkgs.flatMap(p =>
        (p.versions ?? []).map(v => `uses: ${p.name}@${v}`)
    )
    const copyAllValue = escHtml(lines.join('\n'))
    const copyAll = lines.length > 1
        ? `<button class="copy-btn" style="margin-top:6px" data-copy="${copyAllValue}">Copy all ↓</button>`
        : ''

    const safeBlocks = pkgs
        .filter(p => p.safe_version || p.safe_digest)
        .map(p => {
            const tagLine = p.safe_version ? `uses: ${p.name}@${p.safe_version}` : ''
            const digestLine = p.safe_digest ? `uses: ${p.name}@${p.safe_digest}` : ''
            return `<div class="safe-replacement">
    <div class="safe-replacement-label">Safe replacement for ${escHtml(p.name)}</div>
    ${tagLine ? `<div class="exposure-row"><span class="ioc-value" style="color:var(--stable)">${escHtml(tagLine)}</span><button class="copy-btn" data-copy="${escHtml(tagLine)}">Copy</button></div>` : ''}
    ${digestLine ? `<div class="exposure-row"><span class="ioc-value" style="color:var(--stable)">${escHtml(digestLine)}</span><button class="copy-btn" data-copy="${escHtml(digestLine)}">Copy</button></div>` : ''}
</div>`
        }).join('')

    const rows = lines.map(l =>
        `<div class="exposure-row"><span class="ioc-value">${escHtml(l)}</span><button class="copy-btn" data-copy="${escHtml(l)}">Copy</button></div>`
    ).join('')

    return `<div class="exposure-block">
<div class="action-exposure-intro">Search your <code>.github/workflows/</code> directory for any of these references:</div>
<div class="exposure-section">
    <div class="exposure-label">Compromised action references</div>
    ${rows}
    ${copyAll}
</div>
${safeBlocks}
</div>`
}

function modelExposureTab(incident: Incident): string {
    const pkgs = incident.packages ?? []
    const modelNames = pkgs.map(p => p.name)

    const searchLines = modelNames.map(n =>
        `<div class="exposure-row"><span class="ioc-value">from_pretrained("${escHtml(n)}")</span><button class="copy-btn" data-copy='from_pretrained("${escHtml(n)}")'>Copy</button></div>`
    ).join('')

    const hasMaliciousPayload = (incident.model_indicators ?? []).some(m => m.type === 'malicious_payload')
    const alertBlock = hasMaliciousPayload ? `
<div class="model-alert">
    <strong>Arbitrary code execution risk</strong><br/>
    Loading this model executes arbitrary code via Python's deserialization mechanism. Any environment that has called <code>from_pretrained()</code> with this model should be considered compromised.
</div>` : ''

    return `<div class="exposure-block">
<div class="model-warning">Do not load this model. Remove all references immediately.</div>
${alertBlock}
<div class="model-exposure-intro">Search for <code>from_pretrained()</code> calls in your Python files:</div>
<div class="exposure-section">
    <div class="exposure-label">Affected model references</div>
    ${searchLines}
</div>
</div>`
}

function exposureTabContent(incident: Incident): string {
    const ecosystem = incident.packages?.[0]?.ecosystem
    if (ecosystem === 'github-actions') return actionExposureTab(incident)
    if (ecosystem === 'huggingface')    return modelExposureTab(incident)
    return incident.exposure
        ? exposureBlock(incident.exposure)
        : '<p style="color:var(--text-muted);font-size:13px">No exposure data recorded for this incident.</p>'
}

export async function incidentRoute(c: Context<{ Bindings: Env }>) {
    const moduleId    = c.req.param('module') ?? ''
    const incidentId  = c.req.param('id') ?? ''
    if (!isValidSlug(incidentId)) return c.notFound()
    const mod = MODULES.find(m => m.id === moduleId)
    if (!mod) return c.notFound()

    const [haulIndex, incident] = await Promise.all([
        fetchHaulIndex(c.env),
        fetchIncident(c.env, moduleId, incidentId),
    ])
    if (!incident) {
        const html = errorPage({
            code:  404,
            title: 'Incident not found',
            body:  `<p>No incident with ID <code>${escHtml(incidentId)}</code> in the ${escHtml(mod.name)} module.</p>`,
            cta:   { href: `/${moduleId}/incidents`, label: 'Browse all incidents' },
        })
        return c.html(baseLayout('Not found', html, c.env), 404)
    }

    const windowStr = incident.compromise_start && incident.compromise_end
        ? ` · Compromise window: ${escHtml(incident.compromise_start)} – ${escHtml(incident.compromise_end)}`
        : ''

    const sourceChips = (incident.sources ?? []).map(s =>
        s.url
            ? `<a href="${escHtml(s.url)}" target="_blank" rel="noopener" class="source-chip">${escHtml(s.name)}</a>`
            : `<span class="source-chip">${escHtml(s.name)}</span>`
    ).join('')

    const pkgs = incident.packages ?? []
    const visiblePkgs = pkgs.slice(0, 5)
    const hiddenPkgs  = pkgs.slice(5)
    const pkgRows = visiblePkgs.map(p => `
    <div class="package-row">
        <span class="package-name">${escHtml(p.name)}</span>
        <span class="package-versions">${(p.versions ?? []).join(', ')}</span>
    </div>`).join('')
    const hiddenRows = hiddenPkgs.map((p, i) => `
    <div class="package-row pkg-row-hidden" style="${i === 0 ? '' : ''}display:none">
        <span class="package-name">${escHtml(p.name)}</span>
        <span class="package-versions">${(p.versions ?? []).join(', ')}</span>
    </div>`).join('')
    const showMoreBtn = hiddenPkgs.length
        ? `<button class="show-more-btn">+${hiddenPkgs.length} more</button>`
        : ''

    const exposureTab = exposureTabContent(incident)

    const iocTab = incident.iocs?.length
        ? iocTable(incident.iocs)
        : '<p style="color:var(--text-muted);font-size:13px">No IOCs recorded for this incident.</p>'

    const huntingTab = behaviourHunting(incident.behaviours ?? [], incident)
    const accordion  = ruleAccordion(incident, moduleId, haulIndex, c.env)

    const intelBase = resolveBase(haulIndex, 'intel', c.env)
    const refs = (incident.references ?? []).map(url =>
        `<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(new URL(url).hostname)} ↗</a></li>`
    ).join('')

    const html = `<div class="container page">
    <div class="incident-header">
        <div class="incident-header-top">
            <span class="incident-title">${escHtml(incidentId)}</span>
            ${severityBadge(incident.severity)}
        </div>
        <div class="incident-meta-row">
            ${[
                incident.campaign ? `<a href="/${moduleId}/incidents?campaign=${encodeURIComponent(incident.campaign)}">${escHtml(incident.campaign)}</a>` : '',
                incident.actor    ? `<a href="/actors/${encodeURIComponent(incident.actor)}">${escHtml(incident.actor)}</a>` : '',
                incident.attack_type ? `<span>${escHtml(incident.attack_type.replace(/_/g,' '))}</span>` : '',
                `<span>Published ${relativeTime(incident.published)}${windowStr}</span>`,
            ].filter(Boolean).join('<span class="meta-sep">·</span>')}
        </div>
        <div class="incident-sources">
            <span style="font-size:12px;color:var(--text-muted)">Sources:</span>
            ${sourceChips}
            <span style="margin-left:8px">${confidenceBar(incident.confidence)}</span>
        </div>
    </div>

    <div style="margin-bottom:24px">
        <div class="section-header">Affected packages (${pkgs.length})</div>
        <div class="packages-list">
            ${pkgRows}
            ${hiddenRows}
        </div>
        ${showMoreBtn}
    </div>

    <div class="tabs">
        <button class="tab-btn active" data-tab="exposure">Exposure</button>
        <button class="tab-btn" data-tab="iocs">IOCs (${incident.iocs?.length ?? 0})</button>
        <button class="tab-btn" data-tab="hunting">Hunting Rules</button>
    </div>

    <div id="tab-exposure" class="tab-panel active">${exposureTab}</div>
    <div id="tab-iocs"     class="tab-panel">${iocTab}</div>
    <div id="tab-hunting"  class="tab-panel">${huntingTab}</div>

    <div style="margin-top:32px">
        <div class="section-header">Detection Rules</div>
        ${accordion}
    </div>

    <div class="references">
        <h3>Sources</h3>
        <ul>${refs || '<li style="color:var(--text-muted);font-size:13px">No source references.</li>'}</ul>
        <h3>Raw data</h3>
        <ul>
            ${incident.ecosystem
                ? `<li><a href="${escHtml(intelBase)}/${escHtml(moduleId)}/incidents/${escHtml(incident.ecosystem)}/${escHtml(incidentId)}.yaml" target="_blank" rel="noopener">Incident YAML ↗</a></li>`
                : `<li><a href="${escHtml(intelBase)}/${escHtml(moduleId)}/incidents/all/${escHtml(shardKey(incidentId))}.jsonl" target="_blank" rel="noopener">Incident JSONL shard ↗</a></li>`}
        </ul>
    </div>
</div>`

    return c.html(baseLayout(incidentId, html, c.env, `/${moduleId}`))
}
