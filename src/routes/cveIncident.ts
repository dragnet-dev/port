import { Context } from 'hono'
import { fetchIncident, fetchHaulIndex } from '../github'
import { MODULES, resolveBase } from '../config'
import { baseLayout, errorPage, escHtml } from '../ui/layout'
import { severityBadge, confidenceBar, iocTable, ruleAccordion, relativeTime } from '../ui/components'
import { isValidSlug } from '../lib/validate'
import type { Env } from '../types'

export function cveIncidentRoute(moduleId: string) {
    return (c: Context<{ Bindings: Env }>) => cveIncidentHandler(c, moduleId)
}

async function cveIncidentHandler(c: Context<{ Bindings: Env }>, moduleId: string) {
    const incidentId = c.req.param('id') ?? ''
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

    const cveExt = incident.cve_ext
    const title  = cveExt?.cve_id ?? incident.malware_ext?.malware_family ?? incident.actor ?? incidentId

    const cvssVal  = cveExt?.cvss_score
    const cvssChip = cvssVal != null
        ? `<span class="badge" style="background:var(--bg-elevated);color:${cvssColour(cvssVal)};font-weight:600">CVSS ${cvssVal.toFixed(1)}</span>`
        : ''

    const impactPills = cveExt?.cvss_vector
        ? parseCvssImpact(cveExt.cvss_vector).map(p =>
            `<span style="display:inline-block;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:2px 10px;font-size:12px;color:var(--text-muted);margin-right:6px;margin-bottom:4px">${escHtml(p)}</span>`
        ).join('')
        : ''

    const sourceChips = (incident.sources ?? []).map(s =>
        s.url
            ? `<a href="${escHtml(s.url)}" target="_blank" rel="noopener" class="source-chip">${escHtml(s.name)}</a>`
            : `<span class="source-chip">${escHtml(s.name)}</span>`
    ).join('')

    const accordion  = ruleAccordion(incident, moduleId, haulIndex, c.env)
    const intelBase  = resolveBase(haulIndex, 'intel', c.env)

    const refs = groupedCveRefs(incident.references ?? [], cveExt?.cve_id)

    const html = `<div class="container page">
    <div class="incident-header">
        <div class="incident-header-top">
            <span class="incident-title">${escHtml(title)}</span>
            ${severityBadge(incident.severity)}
            ${cvssChip}
        </div>
        <div class="incident-meta-row">
            ${[
                incident.campaign ? `<span>${escHtml(incident.campaign)}</span>` : '',
                incident.actor && incident.actor !== incident.campaign ? `<a href="/actors/${encodeURIComponent(incident.actor)}">${escHtml(incident.actor)}</a>` : '',
                incident.attack_type ? `<span>${escHtml(incident.attack_type.replace(/_/g, ' '))}</span>` : '',
                `<span>Published ${relativeTime(incident.published)}</span>`,
            ].filter(Boolean).join('<span class="meta-sep">·</span>')}
        </div>
        ${sourceChips ? `<div class="incident-sources">
            <span style="font-size:12px;color:var(--text-muted)">Sources:</span>
            ${sourceChips}
            <span style="margin-left:8px">${confidenceBar(incident.confidence)}</span>
        </div>` : ''}
    </div>

    ${incident.description
        ? `<p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;line-height:1.6">${escHtml(incident.description)}</p>`
        : ''}

    ${impactPills ? `<div style="margin-bottom:24px">${impactPills}</div>` : ''}

    ${(incident.iocs?.length ?? 0) > 0 ? `
    <div style="margin-top:32px">
        <div class="section-header">IOCs (${incident.iocs!.length})</div>
        ${iocTable(incident.iocs!)}
    </div>` : ''}

    <div style="margin-top:32px">
        <div class="section-header">Detection Rules</div>
        ${accordion}
    </div>

    <div class="references">
        <h3>References</h3>
        ${refs || '<ul><li style="color:var(--text-muted);font-size:13px">No references.</li></ul>'}
        <h3>Raw data</h3>
        <ul>
            <li><a href="${escHtml(intelBase)}/${escHtml(moduleId)}/incidents/all/${escHtml(shardKey(incidentId))}.jsonl" target="_blank" rel="noopener">Incident JSONL shard ↗</a></li>
        </ul>
    </div>
</div>`

    return c.html(baseLayout(title, html, c.env, `/${moduleId}`))
}

// groupedCveRefs produces a clean reference list for CVE-style incidents.
// Priority order: NVD > GHSA > CISA KEV > MITRE/CVE.org > others.
function groupedCveRefs(urls: string[], cveId?: string): string {
    const seen = new Set<string>()
    const nvd: string[]   = []
    const ghsa: string[]  = []
    const cisa: string[]  = []
    const other: string[] = []

    // Always add NVD if we have a CVE ID
    if (cveId) {
        const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`
        nvd.push(nvdUrl)
        seen.add(nvdUrl)
    }

    const skipPatterns = [
        'bugzilla.redhat.com',
        'cve.mitre.org',
        'www.cve.org',
        'linux.oracle.com',
        'access.redhat.com',
        'errata.almalinux.org',
        'errata.rockylinux.org',
    ]

    for (const url of urls) {
        if (seen.has(url)) continue
        seen.add(url)
        if (skipPatterns.some(p => url.includes(p))) continue

        let parsed: URL
        try { parsed = new URL(url) } catch { continue }

        const host = parsed.hostname
        const path = parsed.pathname

        if (host === 'nvd.nist.gov') {
            nvd.push(url)
        } else if (host === 'github.com' && path.startsWith('/advisories/GHSA-')) {
            ghsa.push(url)
        } else if (host === 'www.cisa.gov') {
            cisa.push(url)
        } else {
            other.push(url)
        }
    }

    const items: string[] = []

    for (const url of nvd) {
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">NVD ↗</a></li>`)
    }
    for (const url of ghsa) {
        const seg = url.split('/').pop() ?? url
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} ↗</a></li>`)
    }
    for (const url of cisa) {
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">CISA KEV ↗</a></li>`)
    }
    for (const url of other) {
        let host = url
        try { host = new URL(url).hostname } catch { /* keep raw */ }
        // Don't link out to .onion or other darknet / suspicious TLDs — render as plain text.
        if (host.endsWith('.onion') || host.endsWith('.i2p')) {
            const defanged = url.replace(/\./g, '[.]').replace(/^https?:\/\//i, s => s.replace('http', 'hxxp'))
            items.push(`<li><code style="font-size:12px;color:var(--text-muted)">${escHtml(defanged)}</code></li>`)
        } else {
            items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(host)} ↗</a></li>`)
        }
    }

    return items.length > 0 ? `<ul>${items.join('')}</ul>` : ''
}

function parseCvssImpact(vector: string): string[] {
    const parts: Record<string, string> = {}
    for (const seg of vector.split('/')) {
        const [k, v] = seg.split(':')
        if (k && v) parts[k] = v
    }
    const pills: string[] = []
    if (parts['AV'] === 'N') pills.push('Network accessible')
    else if (parts['AV'] === 'A') pills.push('Adjacent network')
    else if (parts['AV'] === 'L') pills.push('Local access')
    if (parts['PR'] === 'N') pills.push('No auth required')
    else if (parts['PR'] === 'L') pills.push('Low privileges needed')
    if (parts['UI'] === 'N') pills.push('No user interaction')
    const cv = parts['C'], iv = parts['I'], av = parts['A']
    if (cv === 'H' && iv === 'H' && av === 'H') pills.push('Full system compromise')
    else {
        if (cv === 'H') pills.push('Confidentiality: High')
        if (iv === 'H') pills.push('Integrity: High')
        if (av === 'H') pills.push('Availability: High')
    }
    return pills
}

function cvssColour(score: number): string {
    return score >= 9 ? 'var(--critical)'
        : score >= 7 ? 'var(--high)'
        : score >= 4 ? 'var(--medium)'
        : 'var(--low)'
}

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
