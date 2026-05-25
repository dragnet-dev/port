import { Context } from 'hono'
import { fetchFeed } from '../github'
import { MODULES } from '../config'
import { baseLayout, escHtml } from '../ui/layout'
import { isValidSlug } from '../lib/validate'
import type { Env } from '../types'

type FeedKind = 'text' | 'json' | 'jsonl' | 'stix'

interface FeedEntry {
    module:    string
    name:      string
    filename:  string
    desc:      string
    ctype:     string
    kind:      FeedKind
}

const FEEDS: FeedEntry[] = [
    { module: 'supply',    name: 'Unified IOC Feed (JSON)',   filename: 'unified.json',          desc: 'All IOCs from supply chain incidents in flat JSON format.',                                ctype: 'application/json',    kind: 'json'  },
    { module: 'supply',    name: 'Unified IOC Feed (JSONL)',  filename: 'unified.jsonl',         desc: 'All IOCs as newline-delimited JSON for streaming/grep workflows.',                         ctype: 'application/x-ndjson', kind: 'jsonl' },
    { module: 'supply',    name: 'STIX 2.1 Bundle',           filename: 'stix/bundle.json',      desc: 'STIX 2.1 bundle suitable for import into TIP platforms.',                                  ctype: 'application/json',    kind: 'stix'  },
    { module: 'supply',    name: 'Domain IOCs',               filename: 'domains.txt',           desc: 'Plain-text list of malicious domains, one per line.',                                      ctype: 'text/plain',          kind: 'text'  },
    { module: 'supply',    name: 'IP IOCs',                   filename: 'ips.txt',               desc: 'Plain-text list of malicious IP addresses, one per line.',                                 ctype: 'text/plain',          kind: 'text'  },
    { module: 'supply',    name: 'SHA256 Hashes',             filename: 'sha256.txt',            desc: 'Plain-text list of malicious file SHA256 hashes.',                                         ctype: 'text/plain',          kind: 'text'  },
    { module: 'supply',    name: 'SHA1 Hashes',               filename: 'sha1.txt',              desc: 'Plain-text list of malicious file SHA1 hashes.',                                           ctype: 'text/plain',          kind: 'text'  },
    { module: 'container', name: 'Container Image Index (JSON)', filename: 'container-images.json', desc: 'Vulnerable container image tags + CVEs and end-of-life base images. Rows discriminated by the `type` field.', ctype: 'application/json', kind: 'json' },
]

const USAGE_NOTES: Record<FeedKind, string> = {
    text:  'One IOC per line  -  drop into any SIEM watchlist, EDR custom indicator list, or DNS sinkhole.',
    json:  'Flat JSON array  -  parse with <code>jq</code>, <code>requests.json()</code>, or import into a TIP.',
    jsonl: 'Newline-delimited JSON  -  stream with <code>jq -c</code> or pipe into row-oriented ETL.',
    stix:  'STIX 2.1 bundle  -  import via Microsoft Sentinel TI connector, OpenCTI, Anomali ThreatStream, or any STIX-aware TIP.',
}

const MODULE_LABELS: Record<string, string> = {
    supply:    '📦 Supply Chain',
    container: '🐳 Containers',
}

export async function feedsHubRoute(c: Context<{ Bindings: Env }>) {
    const siteUrl = c.env.SITE_URL

    const byModule = new Map<string, FeedEntry[]>()
    for (const f of FEEDS) {
        const group = byModule.get(f.module) ?? []
        group.push(f)
        byModule.set(f.module, group)
    }

    const sections = [...byModule.entries()].map(([moduleId, feeds]) => {
        const label = MODULE_LABELS[moduleId] ?? moduleId
        const blocks = feeds.map(f => {
            const url = `${siteUrl}/${f.module}/feeds/${f.filename}`
            const curl = `curl -sL ${url}`
            return `<div class="feed-block">
    <h3>${escHtml(f.name)}</h3>
    <p>${escHtml(f.desc)}</p>
    <div class="feed-url-row">
        <span class="feed-url">${escHtml(url)}</span>
        <button class="copy-btn" data-copy="${escHtml(url)}">Copy</button>
        <a href="${escHtml(url)}" target="_blank" rel="noopener" class="raw-link">View ↗</a>
    </div>
    <div class="feed-curl">
        <span class="feed-curl-text">${escHtml(curl)}</span>
        <button class="copy-btn" data-copy="${escHtml(curl)}">Copy</button>
    </div>
    <details class="feed-howto">
        <summary>How to use this</summary>
        <p>${USAGE_NOTES[f.kind]}</p>
    </details>
</div>`
        }).join('')
        return `<div style="margin-bottom:32px">
    <div class="section-header">${escHtml(label)}</div>
    ${blocks}
</div>`
    }).join('')

    const html = `<div class="container page">
    <div class="page-header">
        <h1 class="page-title">Feeds</h1>
        <p class="page-subtitle">Machine-readable IOC and intelligence feeds. No authentication required. CORS open.</p>
    </div>

    ${sections}

    <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px;font-size:13px;color:var(--text-muted)">
        <strong style="color:var(--text);display:block;margin-bottom:8px">Usage</strong>
        All feeds are cached for 30 minutes. Cache-Control headers are set for downstream caching.
        Feeds update whenever <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener">dragnet-dev/haul</a> is updated.
    </div>
</div>`

    return c.html(baseLayout('Feeds', html, c.env, '/feeds'))
}

export async function feedProxyRoute(c: Context<{ Bindings: Env }>) {
    const moduleId = c.req.param('module') ?? ''
    const filename = c.req.param('filename') ?? ''

    if (!isValidSlug(filename)) return c.notFound()
    const mod = MODULES.find(m => m.id === moduleId)
    if (!mod || !mod.live) return c.notFound()

    const allowed = FEEDS.some(f => f.module === moduleId && f.filename === filename)
    if (!allowed) return c.notFound()

    const content = await fetchFeed(c.env, moduleId, filename)
    if (!content) return c.notFound()

    const contentType = filename.endsWith('.jsonl') ? 'application/x-ndjson'
        : filename.endsWith('.json') ? 'application/json'
        : filename.endsWith('.yaml') ? 'application/x-yaml'
        : 'text/plain'

    return new Response(content, {
        headers: {
            'Content-Type':                 contentType,
            'Cache-Control':                'public, max-age=1800',
            'Access-Control-Allow-Origin':  '*',
        }
    })
}
