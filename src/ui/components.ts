import { PLATFORMS, SOURCE_DISPLAY_NAME } from '../config'
import { ruleURL, ruleGithubURL } from '../github'
import { escHtml } from './layout'
import type { Env, HaulIndex, Incident, IncidentSummary, IOC, BehaviourDetection, ExposureData, AffectedImage, EOLImageInfo, SearchRecord } from '../types'

export function ecosystemBadge(ecosystem: string): string {
    const labels: Record<string, string> = {
        'npm':            'npm',
        'pypi':           'PyPI',
        'cargo':          'cargo',
        'maven':          'Maven',
        'nuget':          'NuGet',
        'rubygems':       'RubyGems',
        'go':             'Go',
        'hex':            'Hex',
        'packagist':      'Packagist',
        'pub':            'pub.dev',
        'github-actions': 'GitHub Actions',
        'huggingface':    'Hugging Face',
    }
    const label = labels[ecosystem] ?? ecosystem
    const cls = `ecosystem-${ecosystem.replace(/[^a-z0-9]/g, '-')}`
    return `<span class="ecosystem-badge ${cls}">${escHtml(label)}</span>`
}

export function severityBadge(severity: string): string {
    return `<span class="badge badge-${severity}">${severity}</span>`
}

export function relativeTime(dateStr: string | undefined): string {
    if (!dateStr) return ''
    const parsed = new Date(dateStr).getTime()
    if (isNaN(parsed)) return ''
    const diff = Date.now() - parsed
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function incidentCard(inc: IncidentSummary, module: string): string {
    const pkgs = inc.packages ?? []
    const visible = pkgs.slice(0, 3)
    const extra = pkgs.length - visible.length
    const pkgTags = visible.map(p => `<span class="pkg-tag">${escHtml(p)}</span>`).join('')
    const morePkgs = extra > 0 ? `<span class="pkg-more">+${extra} more</span>` : ''

    const campaign = inc.campaign ? `<span>${escHtml(inc.campaign)}</span>` : ''
    const actor = inc.actor ? `<span>${escHtml(inc.actor)}</span>` : ''
    const sep = campaign && actor ? `<span class="meta-sep">·</span>` : ''

    const ecoBadge = inc.ecosystem ? ecosystemBadge(inc.ecosystem) : ''

    const sourceChip = inc.source_count > 0
        ? `<span class="source-count">${inc.source_count} source${inc.source_count !== 1 ? 's' : ''}</span>`
        : ''
    const rel = relativeTime(inc.published)
    const timeChip = rel ? `<span>${rel}</span>` : ''
    const metaInner = [campaign, actor].filter(Boolean).join(sep) +
        (sourceChip ? (campaign || actor ? ' ' : '') + sourceChip : '') +
        (timeChip ? ' ' + timeChip : '')

    return `<a href="/${escHtml(module)}/incidents/${encodeURIComponent(inc.id)}" class="incident-card">
    <div class="card-top">
        <span class="incident-id">${escHtml(inc.id)}</span>
        ${severityBadge(inc.severity)}
        <span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400">${escHtml((inc.attack_type ?? '').replace(/_/g,' '))}</span>
        ${ecoBadge}
    </div>
    ${pkgTags || morePkgs ? `<div class="card-packages">${pkgTags}${morePkgs}</div>` : ''}
    ${metaInner.trim() ? `<div class="card-meta">${metaInner}</div>` : ''}
</a>`
}

// searchResultCard renders one SearchRecord. The shape is leaner than the
// curated IncidentSummary used in incidentCard  -  no attack_type, source_count,
// IOCs, or campaign  -  but it covers every incident in haul, not just the
// curated 5K.
export function searchResultCard(rec: SearchRecord): string {
    const sev = rec.severity ? severityBadge(rec.severity) : ''
    const ecoBadges = (rec.ecosystems ?? []).slice(0, 3).map(e => ecosystemBadge(e)).join('')
    const tagChips = (rec.tags ?? []).slice(0, 4).map(t =>
        `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400">${escHtml(t)}</span>`
    ).join('')
    const actor = rec.actors?.[0]
        ? `<a href="/actors/${encodeURIComponent(rec.actors[0])}" style="color:var(--text-muted)">${escHtml(rec.actors[0])}</a>`
        : ''
    const cves = (rec.cve_ids ?? []).slice(0, 2).map(c =>
        `<span style="font-family:monospace;font-size:12px;color:var(--text-muted)">${escHtml(c)}</span>`
    ).join(' · ')
    const pkgs = (rec.packages ?? []).slice(0, 3).map(p =>
        `<span class="pkg-tag">${escHtml(p.name)}</span>`
    ).join('')
    const summary = rec.summary
        ? `<div style="font-size:13px;color:var(--text-subtle);margin-top:4px;line-height:1.5">${escHtml(rec.summary)}</div>`
        : ''
    const meta = [
        actor,
        rec.published ? `<span>${relativeTime(rec.published)}</span>` : '',
        cves,
    ].filter(Boolean).join(' <span class="meta-sep">·</span> ')

    return `<a href="/${escHtml(rec.module)}/incidents/${encodeURIComponent(rec.id)}" class="incident-card">
    <div class="card-top">
        <span class="incident-id">${escHtml(rec.id)}</span>
        ${sev}
        ${ecoBadges}
        ${tagChips}
    </div>
    ${pkgs ? `<div class="card-packages">${pkgs}</div>` : ''}
    ${summary}
    ${meta ? `<div class="card-meta">${meta}</div>` : ''}
</a>`
}

export function confidenceBar(confidence: number | undefined, sources: string[] = []): string {
    // Bulk-imported records (urlhaus, malware_bazaar, CISA, etc.) don't carry
    // a confidence score. Zero is also treated as absent  -  showing "0.00" is
    // misleading when the engine simply never assigned a score.
    if (!confidence || isNaN(confidence)) {
        if (!sources.length) return ''
        const chips = sources.map(s => `<span class="source-chip">${escHtml(SOURCE_DISPLAY_NAME[s] ?? s.replace(/_/g, ' '))}</span>`).join('')
        return `<div class="confidence"><div class="sources-chips">${chips}</div></div>`
    }
    const pct = Math.round(confidence * 100)
    const cls = confidence >= 0.85 ? 'conf-stable' : confidence >= 0.60 ? 'conf-test' : 'conf-experimental'
    const chips = sources.map(s => `<span class="source-chip">${escHtml(SOURCE_DISPLAY_NAME[s] ?? s.replace(/_/g, ' '))}</span>`).join('')
    return `<div class="confidence">
    <div class="confidence-bar"><div class="confidence-bar-fill ${cls}" style="width:${pct}%"></div></div>
    <span>${confidence.toFixed(2)}</span>
    <div class="sources-chips">${chips}</div>
</div>`
}

// defang renders IOC values in a form safe to display without risk of
// accidental clipboard-paste activation. The copy button always carries
// the original (fanged) value so analysts get the real indicator.
function defang(value: string, type: string): string {
    if (type === 'url') {
        return value
            .replace(/^https:\/\//i, 'hxxps://')
            .replace(/^http:\/\//i,  'hxxp://')
            .replace(/\./g, '[.]')
    }
    if (type === 'domain' || type === 'ip') {
        return value.replace(/\./g, '[.]')
    }
    return value
}

export function iocTable(iocs: IOC[]): string {
    const groups = new Map<string, IOC[]>()
    for (const ioc of iocs) {
        const group = groups.get(ioc.type) ?? []
        group.push(ioc)
        groups.set(ioc.type, group)
    }

    const typeLabels: Record<string, string> = {
        domain:   'Domains',
        ip:       'IPs',
        url:      'URLs',
        hash:     'File Hashes',
        sha256:   'File Hashes (SHA256)',
        sha1:     'File Hashes (SHA1)',
        md5:      'File Hashes (MD5)',
        filename: 'Filenames',
        file:     'Files',
        email:    'Email Addresses',
        wallet:   'Wallet Addresses',
        bitcoin:  'Bitcoin Addresses',
        service:  'Persistence Services',
        path:     'Persistence Artefacts',
        env_var:  'Credential Targets',
    }

    // These types are defanged in the display value to prevent accidental
    // activation; the copy button always carries the original value.
    const defangTypes = new Set(['url', 'domain', 'ip'])

    let html = ''
    for (const [type, items] of groups) {
        const label = typeLabels[type] ?? type
        const rows = items.map(ioc => {
            const display = defangTypes.has(type) ? defang(ioc.value, type) : ioc.value
            const context = ioc.context
                ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px">${escHtml(ioc.context)}</span>`
                : ''
            return `
        <div class="ioc-row">
            <span class="ioc-value">${escHtml(display)}${context}</span>
            <button class="copy-btn" data-copy="${escHtml(ioc.value)}">Copy</button>
            ${confidenceBar(ioc.confidence, ioc.sources)}
        </div>`
        }).join('')
        html += `<div class="ioc-section">
    <div class="ioc-group-label">${escHtml(label)}</div>
    ${rows}
</div>`
    }
    return html
}

export function exposureBlock(exposure: ExposureData): string {
    let html = '<div class="exposure-block">'

    if (exposure.lockfile_signatures?.length) {
        html += `<div class="exposure-section">
    <div class="exposure-label">Lockfile signatures to check</div>
    ${exposure.lockfile_signatures.map(s => `
    <div class="exposure-row">
        <span class="ioc-value">${escHtml(s)}</span>
        <button class="copy-btn" data-copy="${escHtml(s)}">Copy</button>
    </div>`).join('')}
</div>`
    }

    if (exposure.compromise_files?.length) {
        html += `<div class="exposure-section">
    <div class="exposure-label">Files indicating compromise (check package root)</div>
    ${exposure.compromise_files.map(f => `<div class="exposure-row"><code>${escHtml(f)}</code></div>`).join('')}
</div>`
    }

    if (exposure.ide_artefacts?.length) {
        html += `<div class="exposure-section">
    <div class="exposure-label">IDE artefacts (survive npm uninstall  -  check separately)</div>
    ${exposure.ide_artefacts.map(f => `
    <div class="exposure-row">
        <code>${escHtml(f)}</code>
        <button class="copy-btn" data-copy="${escHtml(f)}">Copy</button>
    </div>`).join('')}
</div>`
    }

    if (exposure.install_hooks?.length) {
        html += `<div class="exposure-section">
    <div class="exposure-label">Suspicious install hooks added</div>
    ${exposure.install_hooks.map(h => `<div class="exposure-row"><code>${escHtml(h)}</code></div>`).join('')}
</div>`
    }

    html += '</div>'
    return html
}

export function ruleAccordion(incident: Incident, module: string, index: HaulIndex, env: Env): string {
    const sentinelRepo = (index.repos['rules-sentinel'] ?? '').replace('https://github.com/', '')

    const platforms = PLATFORMS.map(platform => {
        const files = (incident.behaviours ?? [])
            .flatMap(b => (b.files ?? []).filter(f => f.platform === platform.id))
            .map(f => {
                const filename = f.file.split('/').pop() ?? f.file
                return {
                    label:     `${f.layer.toUpperCase()} · ${filename}`,
                    file:      filename,
                    url:       ruleURL(index, env, module, platform.id, f.layer, filename),
                    githubUrl: ruleGithubURL(index, env, module, platform.id, f.layer, filename),
                }
            })

        if (files.length === 0) return ''

        const filesJson = escHtml(JSON.stringify(files))
        const sentinelNote = platform.id === 'sentinel' ? `
    <div class="sentinel-note" data-sentinel-note>
        <strong>Connect directly  -  no copy-paste needed.</strong>
        Sentinel &gt; Content Hub &gt; Repositories &gt; Connect GitHub<br/>
        <code>${escHtml(sentinelRepo)} / ${escHtml(module)}/rules/sentinel/</code>
    </div>` : ''

        return `<details class="rule-platform"
    data-platform="${escHtml(platform.id)}"
    data-incident="${escHtml(incident.id)}"
    data-files='${filesJson}'>
    <summary>
        <span class="platform-name">${escHtml(platform.name)}</span>
        <span class="rule-count">${files.length} rule${files.length !== 1 ? 's' : ''}</span>
        <svg class="chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 6l4 4 4-4"/>
        </svg>
    </summary>
    <div class="rule-content" data-loaded="false">
        ${sentinelNote}
        <div class="rule-skeleton" aria-hidden="true"></div>
    </div>
</details>`
    })

    return `<div class="rules-section">${platforms.filter(Boolean).join('')}</div>`
}

export function behaviourHunting(behaviours: BehaviourDetection[], incident: Incident): string {
    if (!behaviours.length) return '<p style="color:var(--text-muted);font-size:13px">No behavioural detections recorded for this incident.</p>'

    const mitreSection = incident.mitre_techniques?.length ? `
<div class="mitre-list">
    ${incident.mitre_techniques.map(t => `
    <div class="mitre-row">
        <span class="mitre-id">${escHtml(t.id)}</span>
        <span class="mitre-name">${escHtml(t.name)}</span>
        <span class="mitre-tactic">[${escHtml(t.tactic)}]</span>
        <a href="https://attack.mitre.org/techniques/${escHtml(t.id.replace('.','/'))}/" target="_blank" rel="noopener" class="mitre-link">↗ MITRE</a>
    </div>`).join('')}
</div>` : ''

    const cards = behaviours.map(b => {
        const tags = [...(b.tags ?? []), ...(b.platforms ?? [])].map(t => `<span class="behaviour-tag">${escHtml(t)}</span>`).join('')
        const seenPlatforms = new Set<string>()
        const platformLinks = (b.files ?? []).flatMap(f => {
            if (seenPlatforms.has(f.platform)) return []
            seenPlatforms.add(f.platform)
            const plat = PLATFORMS.find(p => p.id === f.platform)
            const label = plat?.name ?? f.platform
            return [`<a href="#" class="platform-link" data-open-platform="${escHtml(f.platform)}">${escHtml(label)}</a>`]
        })
        return `<div class="behaviour-card">
    <div class="behaviour-header">
        <span class="behaviour-id">${escHtml(b.id)}</span>
        <span class="behaviour-title">${escHtml(b.title)}</span>
        ${tags}
    </div>
    <div class="behaviour-body">
        <p class="behaviour-desc">${escHtml(b.description)}</p>
        <div class="behaviour-links">${platformLinks.join('')}</div>
    </div>
</div>`
    }).join('')

    return `${mitreSection}
<h3 style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:12px">Behavioural Detections</h3>
${cards}`
}

// affectedImagesBlock renders the per-image rows attached to a CVE-centric
// container incident. Each row is one repository (e.g. "redis", "alpine") with
// its list of vulnerable tags and the tag that ships the fix.
export function affectedImagesBlock(images: AffectedImage[]): string {
    if (!images.length) return '<p style="color:var(--text-muted);font-size:13px">No affected images recorded for this incident.</p>'

    return images.map(img => {
        const osBadge = img.os_family
            ? `<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);font-weight:400">${escHtml(img.os_family)}</span>`
            : ''
        const tags = img.vulnerable_tags ?? []
        const tagRows = tags.map(t => {
            const ref = `${img.repository}:${t}`
            return `<div class="exposure-row">
        <span class="ioc-value">${escHtml(ref)}</span>
        <button class="copy-btn" data-copy="${escHtml(ref)}">Copy</button>
    </div>`
        }).join('')
        const copyAllValue = escHtml(tags.map(t => `${img.repository}:${t}`).join('\n'))
        const copyAll = tags.length > 1
            ? `<button class="copy-btn" data-copy="${copyAllValue}" style="margin-top:6px">Copy all ↓</button>`
            : ''
        const fixedBlock = img.fixed_tag
            ? `<div class="exposure-section">
        <div class="exposure-label">Fixed in</div>
        <div class="exposure-row">
            <span class="ioc-value" style="color:var(--stable)">${escHtml(img.repository)}:${escHtml(img.fixed_tag)}</span>
            <button class="copy-btn" data-copy="${escHtml(img.repository)}:${escHtml(img.fixed_tag)}">Copy</button>
        </div>
    </div>`
            : ''
        return `<div style="border:1px solid var(--border);border-radius:6px;padding:12px 14px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <span style="font-family:monospace;font-size:13px;font-weight:600">${escHtml(img.repository)}</span>
        ${osBadge}
        ${img.confidence != null ? `<span style="font-size:11px;color:var(--text-muted)">confidence ${img.confidence.toFixed(2)}</span>` : ''}
    </div>
    <div class="exposure-section">
        <div class="exposure-label">Vulnerable tags (${tags.length})</div>
        ${tagRows}
        ${copyAll}
    </div>
    ${fixedBlock}
</div>`
    }).join('')
}

// eolImagesBlock renders end-of-life image rows for incidents sourced from
// endoflife.date  -  repository + cycle + EOL date + suggested replacement.
export function eolImagesBlock(images: EOLImageInfo[]): string {
    if (!images.length) return ''
    const rows = images.map(img => `
    <div style="border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-family:monospace;font-size:13px;font-weight:600">${escHtml(img.repository)}:${escHtml(img.cycle)}</span>
            <span class="badge" style="background:rgba(248,81,73,0.1);color:var(--critical)">EOL ${escHtml(img.eol_date)}</span>
        </div>
        ${img.replacement ? `<div style="font-size:13px;color:var(--text-muted)">Replace with <span style="color:var(--stable);font-family:monospace">${escHtml(img.replacement)}</span></div>` : ''}
    </div>`).join('')
    return `<div class="exposure-section">
    <div class="exposure-label">End-of-life image cycles</div>
    ${rows}
</div>`
}
