import { Context } from 'hono'
import { fetchIncident, fetchHaulIndex } from '../github'
import { MODULES, resolveBase } from '../config'
import { baseLayout, errorPage, escHtml } from '../ui/layout'
import { severityBadge, confidenceBar, ruleAccordion, relativeTime } from '../ui/components'
import { isValidSlug } from '../lib/validate'
import type { Env, AffectedPackage, OSPackageEntry } from '../types'

export async function osPackageIncidentRoute(c: Context<{ Bindings: Env }>) {
    const moduleId   = 'os-packages'
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
            body:  `<p>No OS package incident with ID <code>${escHtml(incidentId)}</code>.</p>`,
            cta:   { href: '/os-packages/incidents', label: 'Browse all incidents' },
        })
        return c.html(baseLayout('Not found', html, c.env), 404)
    }

    const cveExt = incident.cve_ext
    const osExt  = incident.os_package_ext

    const title    = cveExt?.cve_id ?? incidentId
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

    // Affected packages section — prefer os_package_ext entries (richer distro
    // data) but fall back to the generic packages[] field if the extension is absent.
    const affectedSection = buildAffectedSection(osExt?.os_packages, incident.packages)

    const remediationSection = buildRemediationSection(osExt?.os_packages, incident.packages)

    const refsHtml = buildOsRefs(incident.references ?? [], cveExt?.cve_id)

    const html = `<div class="container page">
    <div class="incident-header">
        <div class="incident-header-top">
            <span class="incident-title">${escHtml(title)}</span>
            ${severityBadge(incident.severity)}
            ${cvssChip}
        </div>
        <div class="incident-meta-row">
            ${[
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
            <li><a href="${escHtml(intelBase)}/${escHtml(moduleId)}/incidents/all/${escHtml(shardKey(incidentId))}.jsonl" target="_blank" rel="noopener">Incident JSONL shard ↗</a></li>
        </ul>
    </div>
</div>`

    return c.html(baseLayout(title, html, c.env, `/${moduleId}`))
}

// buildAffectedSection renders the table of distros + packages + fix versions.
// Prefers os_package_ext entries; falls back to the generic AffectedPackage[].
function buildAffectedSection(
    osEntries: OSPackageEntry[] | undefined,
    packages:  AffectedPackage[],
): string {
    // os_package_ext path — richer, has distro info
    if (osEntries && osEntries.length > 0) {
        // Group by distro family (strip version suffix for the heading)
        const byDistro = new Map<string, OSPackageEntry[]>()
        for (const e of osEntries) {
            const family = e.distro.split(':')[0]
            if (!byDistro.has(family)) byDistro.set(family, [])
            byDistro.get(family)!.push(e)
        }

        const DISTRO_LABEL: Record<string, string> = {
            debian:  'Debian',
            ubuntu:  'Ubuntu',
            alpine:  'Alpine',
            rhel:    'RHEL',
            centos:  'CentOS',
            fedora:  'Fedora',
        }

        const rows = Array.from(byDistro.entries()).map(([family, entries]) => {
            const label = DISTRO_LABEL[family] ?? family
            const pkgRows = entries.map(e => {
                const distroLabel = `${label} ${e.distro.split(':')[1] ?? ''}`.trim()
                const fixCell = e.fixed_version
                    ? `<code style="font-size:12px;color:var(--low)">${escHtml(e.fixed_version)}</code>`
                    : e.status === 'not-affected'
                        ? `<span style="font-size:12px;color:var(--text-muted)">Not affected</span>`
                        : `<span style="font-size:12px;color:var(--critical)">No fix yet</span>`
                const statusDot = e.status === 'fixed'
                    ? `<span style="color:var(--low)">●</span>`
                    : e.status === 'not-affected'
                        ? `<span style="color:var(--text-muted)">●</span>`
                        : `<span style="color:var(--critical)">●</span>`
                return `<tr>
                    <td style="padding:8px 12px;font-size:13px;color:var(--text-muted)">${escHtml(distroLabel)}</td>
                    <td style="padding:8px 12px;font-family:monospace;font-size:13px">${escHtml(e.package_name)}</td>
                    <td style="padding:8px 12px">${statusDot} ${fixCell}</td>
                </tr>`
            }).join('')
            return pkgRows
        }).join('')

        return `<div style="margin-top:32px">
    <div class="section-header">Affected packages (${osEntries.length})</div>
    <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-top:8px">
        <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr style="background:var(--bg-elevated)">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Distro</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Package</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Fix version</th>
                </tr>
            </thead>
            <tbody style="border-top:1px solid var(--border)">
                ${rows}
            </tbody>
        </table>
    </div>
</div>`
    }

    // Generic packages[] fallback
    if (!packages || packages.length === 0) return ''

    const chipStyle = `background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-family:monospace;font-size:12px;color:var(--text-muted)`

    const rows = packages.map(pkg => {
        const safeCell = pkg.safe_version
            ? `<code style="font-size:12px;color:var(--low)">${escHtml(pkg.safe_version)}</code>`
            : `<span style="font-size:12px;color:var(--text-muted)">—</span>`
        const versChips = (pkg.versions ?? []).map(v => `<span style="${chipStyle}">${escHtml(v)}</span>`).join(' ')
        return `<tr>
            <td style="padding:8px 12px;font-size:13px;color:var(--text-muted)">${escHtml(pkg.ecosystem)}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:13px">${escHtml(pkg.name)}</td>
            <td style="padding:8px 12px;font-size:13px">${versChips || '—'}</td>
            <td style="padding:8px 12px">${safeCell}</td>
        </tr>`
    }).join('')

    return `<div style="margin-top:32px">
    <div class="section-header">Affected packages (${packages.length})</div>
    <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-top:8px">
        <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr style="background:var(--bg-elevated)">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Ecosystem</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Package</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Affected versions</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Fix</th>
                </tr>
            </thead>
            <tbody style="border-top:1px solid var(--border)">
                ${rows}
            </tbody>
        </table>
    </div>
</div>`
}

// buildRemediationSection emits distro-specific upgrade commands.
function buildRemediationSection(
    osEntries: OSPackageEntry[] | undefined,
    packages:  AffectedPackage[],
): string {
    // Collect distros with unfixed packages
    const distros = new Set<string>()

    if (osEntries && osEntries.length > 0) {
        for (const e of osEntries) {
            if (e.status !== 'not-affected') distros.add(e.distro.split(':')[0])
        }
    } else {
        for (const p of packages ?? []) {
            const eco = p.ecosystem.toLowerCase()
            if (eco.includes('debian')) distros.add('debian')
            else if (eco.includes('ubuntu')) distros.add('ubuntu')
            else if (eco.includes('alpine')) distros.add('alpine')
            else if (eco.includes('rhel') || eco.includes('centos') || eco.includes('fedora')) distros.add('rhel')
        }
    }

    if (distros.size === 0) return ''

    const REMEDIATION: Record<string, { cmd: string; note: string }> = {
        debian: {
            cmd:  'apt-get update && apt-get upgrade -y <package>',
            note: 'Apply DSA patches via <code>apt-get</code> — ensure your sources list includes the security repository.',
        },
        ubuntu: {
            cmd:  'apt-get update && apt-get upgrade -y <package>',
            note: 'Apply Ubuntu Security Notices (USN) via <code>apt-get</code> or <code>unattended-upgrades</code>.',
        },
        alpine: {
            cmd:  'apk update && apk upgrade <package>',
            note: 'Alpine packages update on their regular edge/stable cycle — pin to the fixed version in your Dockerfile <code>FROM</code>.',
        },
        rhel: {
            cmd:  'dnf update --security -y <package>',
            note: 'Apply RHSA advisories via <code>dnf update --security</code> or the Red Hat Satellite subscription manager.',
        },
        centos: {
            cmd:  'dnf update --security -y <package>',
            note: 'CentOS Stream receives RHSA-equivalent patches — apply via <code>dnf update --security</code>.',
        },
        fedora: {
            cmd:  'dnf update -y <package>',
            note: 'Fedora follows a rapid release cycle — ensure your system is on a supported release and update regularly.',
        },
    }

    const items = Array.from(distros).flatMap(d => {
        const r = REMEDIATION[d]
        if (!r) return []
        return [`<li style="margin-bottom:10px">
            <strong>${escHtml(d.charAt(0).toUpperCase() + d.slice(1))}:</strong>
            <code style="display:block;margin:4px 0;padding:6px 10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;font-size:12px;color:var(--text-primary)">${escHtml(r.cmd)}</code>
            <span style="font-size:12px;color:var(--text-muted)">${r.note}</span>
        </li>`]
    }).join('')

    if (!items) return ''

    return `<div style="margin-top:32px;padding:16px;background:rgba(56,139,253,0.08);border:1px solid rgba(56,139,253,0.25);border-radius:6px">
    <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px">Remediation</div>
    <ul style="margin:0;padding-left:0;list-style:none;font-size:13px;color:var(--text-muted);line-height:1.7">
        ${items}
    </ul>
    <p style="font-size:12px;color:var(--text-muted);margin:10px 0 0">After upgrading, verify with <code>dpkg -l &lt;package&gt;</code> (Debian/Ubuntu), <code>apk info &lt;package&gt;</code> (Alpine), or <code>rpm -q &lt;package&gt;</code> (RHEL/CentOS).</p>
</div>`
}

// buildOsRefs groups references relevant to OS packages: NVD, USN, DSA, RHSA.
function buildOsRefs(urls: string[], cveId?: string): string {
    const seen = new Set<string>()

    const nvdLinks:     string[] = []
    const usnLinks:     string[] = []
    const dsaLinks:     string[] = []
    const rhsaLinks:    string[] = []
    const alvLinks:     string[] = []
    const osvLinks:     string[] = []
    const otherLinks:   string[] = []

    if (cveId) {
        const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`
        nvdLinks.push(nvdUrl)
        seen.add(nvdUrl)
    }

    const skipPatterns = [
        'bugzilla.redhat.com',
        'cve.mitre.org',
        'www.cve.org',
        'linux.oracle.com',
        'errata.almalinux.org',
        'errata.rockylinux.org',
    ]

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
        } else if (host === 'ubuntu.com' && path.includes('/USN-')) {
            usnLinks.push(url)
        } else if ((host === 'www.debian.org' || host === 'debian.org') && path.includes('/security/')) {
            dsaLinks.push(url)
        } else if (host === 'access.redhat.com' && path.startsWith('/errata/RHSA-')) {
            rhsaLinks.push(url)
        } else if (host === 'errata.almalinux.org') {
            alvLinks.push(url)
        } else if (host === 'osv.dev' || host === 'api.osv.dev') {
            osvLinks.push(url)
        } else {
            otherLinks.push(url)
        }
    }

    const items: string[] = []

    for (const url of nvdLinks) {
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">NVD ↗</a></li>`)
    }
    for (const url of usnLinks) {
        const seg = url.split('/').filter(Boolean).pop() ?? url
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} (Ubuntu Security Notice) ↗</a></li>`)
    }
    for (const url of dsaLinks) {
        const seg = url.split('/').filter(Boolean).pop() ?? url
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} (Debian Security Advisory) ↗</a></li>`)
    }
    if (rhsaLinks.length > 0) {
        const first = rhsaLinks.slice(0, 3)
        const rest  = rhsaLinks.slice(3)
        const shown = first.map(url => {
            const seg = url.split('/').pop() ?? url
            return `<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(seg)} ↗</a>`
        }).join(', ')
        const moreNote = rest.length > 0
            ? ` <span style="color:var(--text-muted);font-size:12px">+${rest.length} more RHSA</span>`
            : ''
        items.push(`<li>${shown}${moreNote}</li>`)
    }
    for (const url of osvLinks) {
        items.push(`<li><a href="${escHtml(url)}" target="_blank" rel="noopener">OSV ↗</a></li>`)
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
