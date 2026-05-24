import { Context } from 'hono'
import { fetchIncident, fetchIndex, fetchHaulIndex } from '../github'
import { baseLayout, errorPage, escHtml } from '../ui/layout'
import { severityBadge, ruleAccordion, relativeTime } from '../ui/components'
import { resolveBase } from '../config'
import { isValidSlug } from '../lib/validate'
import type { Env, ContainerExtension, CVEExtension } from '../types'

// Container incidents are CVE-centric: one Incident = one CVE that affects
// many image repositories (see dragnet/internal/sources/trivy_db). The page
// renders cve_ext + container_ext as the primary content, with the standard
// rules / references blocks underneath.
export async function containerIncidentRoute(c: Context<{ Bindings: Env }>) {
    const id = c.req.param('id') ?? ''
    if (!isValidSlug(id)) return c.notFound()

    // Confirm the incident is listed in the module index before paying for the
    // shard fetch. Mirrors how the supply route narrows its lookups.
    const [haulIndex, index] = await Promise.all([
        fetchHaulIndex(c.env),
        fetchIndex(c.env, 'container'),
    ])
    const summary = index?.incidents.find(i => i.id === id)
    if (!summary) {
        const html = errorPage({
            code:  404,
            title: 'Incident not found',
            body:  `<p>No container incident with ID <code>${escHtml(id)}</code>.</p>`,
            cta:   { href: '/container', label: 'Browse all incidents' },
        })
        return c.html(baseLayout('Not found', html, c.env), 404)
    }

    const incident = await fetchIncident(c.env, 'container', id)
    if (!incident) {
        const html = errorPage({
            code:  404,
            title: 'Incident not found',
            body:  `<p>No container incident with ID <code>${escHtml(id)}</code>.</p>`,
            cta:   { href: '/container', label: 'Browse all incidents' },
        })
        return c.html(baseLayout('Not found', html, c.env), 404)
    }

    const containerExt: ContainerExtension = incident.container_ext ?? {}
    const cveExt:       CVEExtension | undefined = incident.cve_ext

    const title    = cveExt?.cve_id ?? incident.id
    const cvssVal  = containerExt.cvss_score ?? cveExt?.cvss_score
    const cvssChip = cvssVal != null
        ? `<span class="badge" style="background:var(--bg-elevated);color:${cvssColour(cvssVal)};font-weight:600">CVSS ${cvssVal.toFixed(1)}</span>`
        : ''
    const kevChip  = (containerExt.tier === 1 || containerExt.exploited_in_wild)
        ? `<span class="badge" style="background:rgba(248,81,73,0.15);color:var(--critical)">CISA KEV</span>`
        : ''
    const pocChip  = containerExt.public_poc
        ? `<span class="badge" style="background:rgba(227,179,65,0.15);color:var(--high)">Public PoC</span>`
        : ''
    const tierChip = containerExt.tier
        ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400">Tier ${containerExt.tier}</span>`
        : ''

    const sourceChips = (incident.sources ?? []).map(s =>
        `<a href="${escHtml(s.url)}" target="_blank" rel="noopener" class="source-chip">${escHtml(s.name)}</a>`
    ).join('')

    const accordion = ruleAccordion(incident, 'container', haulIndex, c.env)

    const intelBase = resolveBase(haulIndex, 'intel', c.env)

    // CVSS impact pills
    const cvssVector = cveExt?.cvss_vector ?? ''
    const impactPills = cvssVector
        ? parseCvssImpact(cvssVector).map(p =>
            `<span style="display:inline-block;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:2px 10px;font-size:12px;color:var(--text-muted);margin-right:6px;margin-bottom:4px">${escHtml(p)}</span>`
        ).join('')
        : ''

    // Affected images compact table
    const affectedImages = containerExt.affected_images ?? []
    const affectedCount  = affectedImages.length

    // Build per-repository map: repository -> tags[]
    // AffectedImage already groups by repository with vulnerable_tags[]
    const familyMap: Map<string, string[]> = new Map()
    for (const img of affectedImages) {
        const family = img.repository
        const tags   = img.vulnerable_tags ?? []
        if (!familyMap.has(family)) familyMap.set(family, [])
        for (const t of tags) familyMap.get(family)!.push(t)
    }

    // Unique family count for header
    const familyCount = familyMap.size

    // Build "copy all" payload: repository:tag per line
    const allTags = Array.from(familyMap.entries())
        .flatMap(([fam, tags]) => tags.length > 0 ? tags.map(t => `${fam}:${t}`) : [fam])
        .join('\\n')

    const chipStyle = `background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-family:monospace;font-size:12px;color:var(--text-muted)`

    const tableRows = Array.from(familyMap.entries()).map(([fam, tags]) => {
        const chips = tags.map(t => `<span style="${chipStyle}">${escHtml(t)}</span>`).join('')
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <span style="flex:0 0 160px;font-family:monospace;font-size:13px;font-weight:600;padding-top:3px">${escHtml(fam)}</span>
            <div style="flex:1;display:flex;flex-wrap:wrap;gap:4px">${chips}</div>
        </div>`
    }).join('')

    const affectedSection = familyCount > 0 ? `
    <div style="margin-top:32px">
        <div class="section-header" style="display:flex;align-items:center;justify-content:space-between">
            <span>Affected images (${familyCount} ${familyCount === 1 ? 'family' : 'families'}, ${affectedCount} ${affectedCount === 1 ? 'image' : 'images'})</span>
            <button class="copy-btn" data-copy="${escHtml(allTags)}" style="font-size:12px;padding:4px 10px">Copy all tags</button>
        </div>
        <div style="border:1px solid var(--border);border-radius:6px;padding:0 12px;margin-top:8px">
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
                <span style="flex:0 0 160px;font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Repository</span>
                <span style="flex:1;font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Vulnerable tags</span>
            </div>
            ${tableRows}
        </div>
    </div>` : ''

    // Remediation guidance
    const remediationSection = `
    <div style="margin-top:32px;padding:16px;background:rgba(56,139,253,0.08);border:1px solid rgba(56,139,253,0.25);border-radius:6px">
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">What should I do?</div>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:var(--text-muted);line-height:1.7">
            <li>Rebuild affected images using a patched base image tag (check your vendor's security advisories).</li>
            <li>Pin to a digest that post-dates the patch, or move to a minimal base (distroless, scratch) where possible.</li>
            <li>Run <code style="font-size:12px">trivy image &lt;image&gt;</code> locally to confirm the fix before deploying.</li>
            <li>If a patch is not yet available, consider runtime mitigations (seccomp, AppArmor) and network segmentation.</li>
        </ul>
    </div>`

    // References grouped by domain
    const refsHtml = groupedReferences(incident.references ?? [])

    const nvdLink = cveExt?.cve_id
        ? `<li><a href="https://nvd.nist.gov/vuln/detail/${escHtml(cveExt.cve_id)}" target="_blank" rel="noopener">NVD entry ↗</a></li>`
        : ''

    const html = `<div class="container page">
    <div class="incident-header">
        <div class="incident-header-top">
            <span class="incident-title">${escHtml(title)}</span>
            ${severityBadge(incident.severity)}
            ${cvssChip}
            ${kevChip}
            ${pocChip}
            ${tierChip}
        </div>
        <div class="incident-meta-row">
            <span>${affectedCount} affected image${affectedCount !== 1 ? 's' : ''} across ${familyCount} ${familyCount === 1 ? 'family' : 'families'}</span>
            <span class="meta-sep">·</span>
            <span>Published ${relativeTime(incident.published)}</span>
        </div>
        ${sourceChips ? `<div class="incident-sources">
            <span style="font-size:12px;color:var(--text-muted)">Sources:</span>
            ${sourceChips}
        </div>` : ''}
    </div>

    ${incident.description ? `<p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;line-height:1.6">${escHtml(incident.description)}</p>` : ''}

    ${impactPills ? `<div style="margin-bottom:24px">${impactPills}</div>` : ''}

    ${affectedSection}

    ${remediationSection}

    <div style="margin-top:32px">
        <div class="section-header">Detection Rules</div>
        ${accordion}
    </div>

    <div class="references">
        <h3>References</h3>
        ${refsHtml || '<ul><li style="color:var(--text-muted);font-size:13px">No references.</li></ul>'}
        <h3>Raw data</h3>
        <ul>
            ${nvdLink}
            <li><a href="${escHtml(intelBase)}/container/incidents/all/${escHtml(shardKey(id))}.jsonl" target="_blank" rel="noopener">Incident JSONL shard ↗</a></li>
        </ul>
    </div>
</div>`

    return c.html(baseLayout(title, html, c.env, '/container'))
}

// parseCvssImpact decodes a CVSS 3.x vector string into human-readable pills.
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

// groupedReferences renders a deduplicated, domain-grouped reference list.
function groupedReferences(urls: string[]): string {
    if (urls.length === 0) return ''

    // Skip-list patterns — too noisy, near-duplicate, or mirror/errata only.
    const skipPatterns = [
        'bugzilla.redhat.com',
        'errata.almalinux.org',
        'errata.rockylinux.org',
        'linux.oracle.com',
        'cve.mitre.org',
        'www.cve.org',
        'access.redhat.com/security/cve',
    ]

    const nvdLinks:    string[] = []
    const ghsaLinks:   string[] = []
    const usnLinks:    string[] = []
    const rhsaLinks:   string[] = []
    const gitlabLinks: string[] = []
    const otherLinks:  string[] = []

    const seen = new Set<string>()

    for (const url of urls) {
        if (seen.has(url)) continue
        seen.add(url)

        let parsed: URL
        try { parsed = new URL(url) } catch { continue }

        const host = parsed.hostname
        const path = parsed.pathname

        if (skipPatterns.some(p => url.includes(p))) continue

        if (host === 'nvd.nist.gov') {
            nvdLinks.push(url)
        } else if (host === 'github.com' && path.startsWith('/advisories/GHSA-')) {
            ghsaLinks.push(url)
        } else if (host === 'ubuntu.com' && path.startsWith('/security/notices/USN-')) {
            usnLinks.push(url)
        } else if (host === 'access.redhat.com' && path.startsWith('/errata/RHSA-')) {
            rhsaLinks.push(url)
        } else if (host === 'gitlab.gnome.org') {
            gitlabLinks.push(url)
        } else {
            otherLinks.push(url)
        }
    }

    const items: string[] = []

    for (const url of nvdLinks) {
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">NVD ↗</a></li>`)
    }

    for (const url of ghsaLinks) {
        const seg = url.split('/').pop() ?? url
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} ↗</a></li>`)
    }

    for (const url of usnLinks) {
        const seg = url.split('/').pop() ?? url
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} ↗</a></li>`)
    }

    if (rhsaLinks.length > 0) {
        const first  = rhsaLinks.slice(0, 2)
        const rest   = rhsaLinks.slice(2)
        const shown  = first.map(url => {
            const seg = url.split('/').pop() ?? url
            return `<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} ↗</a>`
        }).join(', ')
        if (rest.length === 0) {
            items.push(`<li>${shown}</li>`)
        } else {
            const restLinks = rest.map(url => {
                const seg = url.split('/').pop() ?? url
                return `<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} ↗</a>`
            }).join(', ')
            items.push(`<li>${shown} <span style="color:var(--text-muted);font-size:12px">and <span class="rhsa-toggle" style="cursor:pointer;text-decoration:underline">${rest.length} more</span></span><span class="rhsa-rest" style="display:none"> — ${restLinks}</span></li>`)
        }
    }

    if (gitlabLinks.length > 0) {
        // Deduplicate by keeping only one link per distinct path type (issue vs MR).
        // If all are same type, just show the first + count.
        const firstTwo = gitlabLinks.slice(0, 2)
        const rest = gitlabLinks.slice(2)
        const linkHtml = firstTwo.map(url => {
            const label = url.includes('/merge_requests/') ? 'Upstream fix (GitLab)' : 'Upstream report (GitLab)'
            return `<a href="${escHtml(url)}" target="_blank" rel="noopener">${label} ↗</a>`
        }).join(', ')
        const moreNote = rest.length > 0
            ? ` <span style="color:var(--text-muted);font-size:12px">+${rest.length} more</span>`
            : ''
        items.push(`<li>${linkHtml}${moreNote}</li>`)
    }

    for (const url of otherLinks) {
        let host = url
        try { host = new URL(url).hostname } catch { /* keep raw */ }
        if (host.endsWith('.onion') || host.endsWith('.i2p')) {
            const defanged = url.replace(/\./g, '[.]').replace(/^https?:\/\//i, s => s.replace('http', 'hxxp'))
            items.push(`<li><code style="font-size:12px;color:var(--text-muted)">${escHtml(defanged)}</code></li>`)
        } else {
            items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(host)} ↗</a></li>`)
        }
    }

    if (items.length === 0) return ''

    return `<ul>${items.join('')}</ul>
<script>
(function(){
    document.querySelectorAll('.rhsa-toggle').forEach(function(el){
        el.addEventListener('click', function(){
            var rest = el.closest('li').querySelector('.rhsa-rest');
            if(rest){ rest.style.display = rest.style.display === 'none' ? '' : 'none'; }
        });
    });
})();
</script>`
}

function cvssColour(score: number): string {
    return score >= 9 ? 'var(--critical)'
        : score >= 7 ? 'var(--high)'
        : score >= 4 ? 'var(--medium)'
        : 'var(--low)'
}

// shardKey mirrors src/github.ts:shardKey — duplicated here so the "Raw data"
// link points at the right JSONL shard URL on haul.
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
