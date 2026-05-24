import yaml from 'js-yaml'
import { HAUL_INDEX_URL, platformToSatelliteKey, resolveBase, SOURCE_DISPLAY_NAME } from './config'
import type { Env, HaulIndex, Incident, IncidentIndex, RootIndex, ThreatActor, SearchRecord } from './types'

export async function fetchHaulIndex(env: Env): Promise<HaulIndex> {
    const cacheKey = '_haul:index'
    const cached = await env.CACHE.get(cacheKey)
    if (cached) return JSON.parse(cached) as HaulIndex

    const res = await fetch(HAUL_INDEX_URL, {
        cf:      { cacheTtl: 0, cacheEverything: false },
        headers: { 'User-Agent': `${env.SITE_URL}/port` },
    })
    if (!res.ok) throw new Error(`haul index fetch failed: ${res.status}`)
    const index = await res.json() as HaulIndex
    await env.CACHE.put(cacheKey, JSON.stringify(index), { expirationTtl: 300 })
    return index
}

// Cloudflare KV's value limit is 25 MiB. Files larger than this are served
// via Cloudflare's edge cache (cf: hint) instead — still fast after the first
// PoP hit, just not worker-local. Smaller files get both: KV for worker-local
// speed and the cf: hint for PoP-level deduplication.
const KV_MAX_BYTES = 24 * 1024 * 1024

// Sentinel stored in KV when a file is confirmed missing (404).
// A short TTL (5 min) so we retry after dragnet ships new content.
const KV_NOT_FOUND = '\x00'

export async function fetchRaw(env: Env, path: string, ttl = 1800): Promise<string | null> {
    const cacheKey = `raw:${path}`

    const cached = await env.CACHE.get(cacheKey)
    if (cached === KV_NOT_FOUND) return null   // negative cache hit
    if (cached) return cached

    const index = await fetchHaulIndex(env)
    const url = `${resolveBase(index, 'intel', env)}/${path}`
    const res = await fetch(url, {
        cf:      { cacheTtl: ttl, cacheEverything: true },
        headers: { "User-Agent": `${env.SITE_URL}/port` },
    })

    if (!res.ok) {
        // Cache the miss so we don't hammer GitHub for a known-absent file.
        await env.CACHE.put(cacheKey, KV_NOT_FOUND, { expirationTtl: 300 })
        return null
    }

    const text = await res.text()
    if (text.length < KV_MAX_BYTES) {
        await env.CACHE.put(cacheKey, text, { expirationTtl: ttl })
    }
    return text
}

export async function fetchIndex(env: Env, module: string): Promise<IncidentIndex | null> {
    const raw = await fetchRaw(env, `${module}/incidents/index.json`, 1800)
    return raw ? JSON.parse(raw) as IncidentIndex : null
}

// fetchHomeSlice returns the pre-computed home-page slice for a module —
// a trimmed IncidentIndex (top-500 most-recent incidents + full stats)
// written to KV by the scheduled handler. Falls back to fetchIndex when
// the slice hasn't been built yet (first deploy, before cron has run).
export async function fetchHomeSlice(env: Env, module: string): Promise<IncidentIndex | null> {
    const sliceStr = await env.CACHE.get(`_home:${module}`)
    if (sliceStr) {
        try { return JSON.parse(sliceStr) as IncidentIndex } catch { /* fall through */ }
    }
    return fetchIndex(env, module)
}

export async function fetchRootIndex(env: Env): Promise<RootIndex | null> {
    const raw = await fetchRaw(env, `incidents/index.json`, 1800)
    return raw ? JSON.parse(raw) as RootIndex : null
}

// normalizeIncident maps the raw JSONL/YAML shape — which varies between
// curated YAML incidents and bulk-imported JSONL incidents — to the clean
// Incident interface the renderer expects. Key differences in the JSONL format:
//   - campaign/actor can be empty objects {}  instead of strings
//   - published may be absent; compromise_window.start carries the timestamp
//   - sources may be absent; references[] holds URL strings instead
//   - severity/attack_type may be empty strings instead of valid values
//   - exposure/indicators/hunting may be empty objects {} instead of undefined
//   - packages may lack versions/safe_version fields
function normalizeIncident(raw: unknown): Incident {
    const r = raw as Record<string, unknown>

    // Scalar string helper: returns undefined if the value is not a non-empty string.
    const str = (v: unknown): string | undefined =>
        typeof v === 'string' && v.length > 0 ? v : undefined

    const published =
        str(r.published) ??
        str((r.compromise_window as Record<string, unknown> | undefined)?.start) ??
        ''

    const compromiseWindow = r.compromise_window as Record<string, string> | undefined

    // sources: typed array > single source string > empty (never use references[] here —
    // references belong in the References section, not as source attribution chips).
    //
    // For single-source incidents (JSONL bulk imports), the source ID is a short slug
    // like "nvd", "trivy_db", "ghsa". We derive:
    //   - display name: SOURCE_NAME lookup, fallback to ID with underscores replaced
    //   - url: scan references[] for the first URL matching SOURCE_DOMAIN[id], no link if absent
    const SOURCE_NAME = SOURCE_DISPLAY_NAME
    const SOURCE_DOMAIN: Record<string, RegExp> = {
        'aikido':         /aikido\.dev/,
        'cisa':           /cisa\.gov/,
        'dfir_report':    /thedfirreport\.com/,
        'elastic_labs':   /elastic\.co|elasticobservability/,
        'eset':           /welivesecurity\.com|eset\.com/,
        'ghsa':           /github\.com\/advisories/,
        'malware_bazaar': /bazaar\.abuse\.ch/,
        'nvd':            /nvd\.nist\.gov/,
        'osv':            /osv\.dev/,
        'ransomware_live':/ransomware\.live/,
        'sekoia':         /sekoia\.io/,
        'snyk':           /snyk\.io/,
        'sonatype':       /sonatype\.com/,
        'stepsecurity':   /stepsecurity\.io/,
        'talos':          /talosintelligence\.com/,
        'trivy_db':       /aquasecurity\/trivy/,
        'urlhaus':        /urlhaus\.abuse\.ch/,
        'wiz':            /wiz\.io/,
    }
    const rawRefs = Array.isArray(r.references)
        ? (r.references as unknown[]).filter(v => typeof v === 'string') as string[]
        : []
    // Convert a source ID string to a display {name, url} pair.
    const resolveSource = (id: string): Incident['sources'][number] => {
        const name = SOURCE_NAME[id] ?? id.replace(/_/g, ' ')
        const domainRe = SOURCE_DOMAIN[id]
        const url = domainRe ? (rawRefs.find(ref => domainRe.test(ref)) ?? '') : ''
        return { name, url }
    }
    let sources: Incident['sources'] = []
    if (Array.isArray(r.sources) && r.sources.length > 0) {
        // Schema emits sources as string IDs (e.g. ["nvd", "ghsa"]) — convert each
        // to an IncidentSource with a display name and a matched reference URL.
        sources = (r.sources as unknown[])
            .filter(s => typeof s === 'string' && s.length > 0)
            .map(s => resolveSource(s as string))
    } else if (typeof r.source === 'string' && r.source) {
        sources = [resolveSource(r.source)]
    }

    const validSeverities = new Set(['critical', 'high', 'medium', 'low'])
    const severity = validSeverities.has(r.severity as string)
        ? r.severity as Incident['severity']
        : 'low'

    const packages = (Array.isArray(r.packages) ? r.packages : []).map((p: unknown) => {
        const pkg = p as Record<string, unknown>
        // Schema field is affected_versions; curated YAML may use versions — accept either.
        const versions = Array.isArray(pkg.versions) ? pkg.versions as string[]
            : Array.isArray(pkg.affected_versions) ? pkg.affected_versions as string[]
            : []
        return {
            name:         String(pkg.name ?? ''),
            ecosystem:    String(pkg.ecosystem ?? ''),
            versions,
            safe_version: str(pkg.safe_version),
            safe_digest:  str(pkg.safe_digest),
        }
    })

    // Extract IOCs from the `indicators` field (JSONL format) when `iocs` is absent.
    // indicators.file_hashes → type "hash", indicators.domains → type "domain", etc.
    let iocs: Incident['iocs'] = Array.isArray(r.iocs) ? r.iocs as Incident['iocs'] : []
    if (iocs.length === 0 && r.indicators && typeof r.indicators === 'object') {
        const ind = r.indicators as Record<string, unknown>
        // Private/loopback IP prefixes — not useful as external IOCs.
        const isPrivateIP = (v: string) =>
            /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.0\.0\.0|::1$|fc00:|fe80:)/i.test(v)
        const add = (type: string, items: unknown[], valueKey = 'value', contextFn?: (i: Record<string, unknown>) => string) => {
            if (!Array.isArray(items)) return
            for (const item of items) {
                const i = item as Record<string, unknown>
                const val = str(i[valueKey])
                if (!val) continue
                const conf = typeof i.confidence === 'number' ? i.confidence : 0.5
                // Skip private/loopback IPs and anything the engine flagged as very low confidence.
                if (type === 'ip' && (isPrivateIP(val) || conf < 0.3)) continue
                iocs.push({
                    type,
                    value:      val,
                    confidence: conf,
                    sources:    Array.isArray(i.sources) ? i.sources as string[] : [],
                    context:    contextFn ? contextFn(i) : str(i.context),
                })
            }
        }
        add('domain',   (ind.domains  as unknown[]) ?? [])
        add('ip',       (ind.ips      as unknown[]) ?? [])
        add('url',      (ind.urls     as unknown[]) ?? [])
        add('hash',     (ind.file_hashes as unknown[]) ?? [], 'value', i =>
            [str(i.algorithm), str(i.filename)].filter(Boolean).join(' · '))
        add('filename', (ind.file_names as unknown[]) ?? [])
        add('email',    (ind.emails   as unknown[]) ?? [])
        add('wallet',   (ind.wallets  as unknown[]) ?? [])
    }

    // Treat empty objects as absent for optional block fields.
    const isNonEmptyObj = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0

    return {
        id:               String(r.id ?? ''),
        module:           String(r.module ?? ''),
        ecosystem:        String(r.ecosystem ?? ''),
        severity,
        attack_type:      str(r.attack_type) ?? '',
        description:      str(r.description),
        // Schema: campaign is {name, actor, confidence} object (empty {} when none).
        campaign:         str(r.campaign) ??
                          str((r.campaign as Record<string, unknown> | undefined)?.name),
        actor:            str(r.actor) ??
                          str((r.campaign as Record<string, unknown> | undefined)?.actor),
        published,
        compromise_start: str(compromiseWindow?.start),
        compromise_end:   str(compromiseWindow?.end),
        confidence:       typeof r.confidence === 'number' ? r.confidence : 0,
        source_count:     typeof r.source_count === 'number' ? r.source_count : sources.length,
        sources,
        packages,
        iocs,
        behaviours:       Array.isArray(r.behaviours) ? r.behaviours as Incident['behaviours'] : [],
        mitre_techniques: Array.isArray(r.mitre_techniques) ? r.mitre_techniques as Incident['mitre_techniques'] : [],
        exposure:         isNonEmptyObj(r.exposure) ? r.exposure as Incident['exposure'] : undefined,
        // Schema nests model_indicators under indicators{}; also accept top-level for YAML.
        model_indicators: Array.isArray(r.model_indicators) ? r.model_indicators as Incident['model_indicators']
            : Array.isArray((r.indicators as Record<string, unknown> | undefined)?.model_indicators)
                ? (r.indicators as Record<string, unknown>).model_indicators as Incident['model_indicators']
                : undefined,
        references:       Array.isArray(r.references) ? (r.references as unknown[]).filter(v => typeof v === 'string') as string[] : [],
        summary:          str(r.summary),
        container_ext:    r.container_ext as Incident['container_ext'],
        cve_ext:          r.cve_ext as Incident['cve_ext'],
        malware_ext:      isNonEmptyObj(r.malware_ext) ? r.malware_ext as Incident['malware_ext'] : undefined,
    }
}

export async function fetchIncident(env: Env, module: string, id: string): Promise<Incident | null> {
    // Per-incident cache hit short-circuits both the YAML and the JSONL shard paths.
    const perIncidentKey = `inc:${module}:${id}`
    const cached = await env.CACHE.get(perIncidentKey)
    if (cached) {
        try { return JSON.parse(cached) as Incident } catch { /* fall through */ }
    }

    // 1. Curated incidents have a per-ecosystem YAML on disk + a row in index.json.
    const index = await fetchIndex(env, module)
    const meta = index?.incidents.find(i => i.id === id)
    if (meta?.ecosystem) {
        const raw = await fetchRaw(env, `${module}/incidents/${meta.ecosystem}/${id}.yaml`, 3600)
        if (raw) {
            const inc = normalizeIncident(yaml.load(raw))
            await env.CACHE.put(perIncidentKey, JSON.stringify(inc), { expirationTtl: 86400 })
            return inc
        }
    }

    // 2. Bulk-loaded incidents (OSV/OSSF/GHSA etc.) live only in the JSONL shards
    //    written by sync. Try the shard family for this ID prefix — both the bare
    //    {shard}.jsonl and {shard}-N.jsonl sub-shards (engine sub-shards any
    //    bucket >50k records).
    const inc = await fetchIncidentFromShard(env, module, id)
    if (inc) {
        await env.CACHE.put(perIncidentKey, JSON.stringify(inc), { expirationTtl: 86400 })
    }
    return inc
}

// fetchIncidentFromShard reads the right JSONL shard from haul and scans it
// for the requested incident ID. Shards can be up to 50 MB so we deliberately
// DON'T cache the raw shard (Cloudflare KV has a 25 MiB value limit); only
// the matched incident is cached, keyed by id, in fetchIncident above.
//
// Uses shard-nums:{module} KV (written by the scheduled handler) to probe only
// the sub-shards that actually exist rather than trying all 0..15.
async function fetchIncidentFromShard(env: Env, module: string, id: string): Promise<Incident | null> {
    const shard = shardKey(id)

    let candidates: string[]
    const shardNumsRaw = await env.CACHE.get(`shard-nums:${module}`)
    if (shardNumsRaw) {
        try {
            const map = JSON.parse(shardNumsRaw) as Record<string, { bare: boolean; nums: number[] }>
            const info = map[shard]
            if (!info) return null  // no shard for this ID prefix → definitely not in module
            candidates = [
                ...(info.bare ? [`${module}/incidents/all/${shard}.jsonl`] : []),
                ...info.nums.map(n => `${module}/incidents/all/${shard}-${n}.jsonl`),
            ]
        } catch {
            // Corrupt KV entry — fall back to sequential probe
            candidates = [
                `${module}/incidents/all/${shard}.jsonl`,
                ...Array.from({ length: 16 }, (_, i) => `${module}/incidents/all/${shard}-${i}.jsonl`),
            ]
        }
    } else {
        // shard-nums not populated yet (before first scheduled run) — probe sequentially
        candidates = [
            `${module}/incidents/all/${shard}.jsonl`,
            ...Array.from({ length: 16 }, (_, i) => `${module}/incidents/all/${shard}-${i}.jsonl`),
        ]
    }

    const haulIndex = await fetchHaulIndex(env)
    const intelBase = resolveBase(haulIndex, 'intel', env)

    for (const path of candidates) {
        const url = `${intelBase}/${path}`
        const res = await fetch(url, { headers: { 'User-Agent': `${env.SITE_URL}/port` } })
        if (!res.ok) continue   // shard doesn't exist — try the next one

        const text = await res.text()
        for (const line of text.split('\n')) {
            if (!line) continue
            try {
                const raw = JSON.parse(line) as Record<string, unknown>
                if (raw.id === id) return normalizeIncident(raw)
            } catch { /* skip malformed line */ }
        }
    }
    return null
}

// shardKey mirrors the Go engine's persist.shardKey. Keep them in lockstep
// or detail-page lookups will miss.
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

// fetchSearchIndex loads every SearchRecord from feeds/search-{module}.jsonl
// (plus any -N.jsonl sub-shards). Bypasses KV because the shards regularly
// exceed KV's 25 MiB value limit; relies on Cloudflare's edge cache via the
// `cf:` fetch hint instead. The bare {module}.jsonl is the single-file form;
// sub-shards 0..15 mirror the engine's byte-based sharding (see persist.go).
export async function fetchSearchIndex(env: Env, module: string): Promise<SearchRecord[]> {
    const records: SearchRecord[] = []
    const candidates = [
        `feeds/search-${module}.jsonl`,
        ...Array.from({ length: 16 }, (_, i) => `feeds/search-${module}-${i}.jsonl`),
    ]

    const haulIndex = await fetchHaulIndex(env)
    const intelBase = resolveBase(haulIndex, 'intel', env)

    for (const path of candidates) {
        const url = `${intelBase}/${path}`
        const res = await fetch(url, {
            // 30 min edge cache. Stale entries get invalidated by the
            // scheduled manifest-sync handler before they age out.
            cf: { cacheTtl: 1800, cacheEverything: true },
            headers: { 'User-Agent': `${env.SITE_URL}/port` },
        })
        if (!res.ok) continue
        const text = await res.text()
        for (const line of text.split('\n')) {
            if (!line) continue
            try {
                records.push(JSON.parse(line) as SearchRecord)
            } catch { /* skip malformed line */ }
        }
    }
    return records
}

// ruleURL returns the local proxy path for a rule file (served via /rules/).
// Use this for fetch() calls from client-side JS — it avoids CORS issues and
// lets the Worker cache satellite rule content in KV.
export function ruleURL(
    _index: HaulIndex, _env: Env,
    module: string, platformId: string, layer: string, filename: string,
): string {
    return `/rules/${encodeURIComponent(module)}/${encodeURIComponent(platformId)}/${encodeURIComponent(layer)}/${encodeURIComponent(filename)}`
}

// ruleGithubURL returns the full GitHub raw URL for a rule file — used for
// the "Raw ↗" link shown to users so they can open the original source.
export function ruleGithubURL(
    index: HaulIndex, env: Env,
    module: string, platformId: string, layer: string, filename: string,
): string {
    const satKey = platformToSatelliteKey(platformId)
    const base   = resolveBase(index, satKey, env)
    return `${base}/${module}/rules/${platformId}/${layer}/${filename}`
}

// fetchRawFromSat fetches a file from a satellite haul repo (e.g. haul-rules-sigma)
// with the same KV caching strategy as fetchRaw for the intel repo.
export async function fetchRawFromSat(env: Env, satKey: string, path: string, ttl = 1800): Promise<string | null> {
    const cacheKey = `raw-sat:${satKey}:${path}`

    const cached = await env.CACHE.get(cacheKey)
    if (cached === KV_NOT_FOUND) return null
    if (cached) return cached

    const index = await fetchHaulIndex(env)
    const base = resolveBase(index, satKey, env)
    const url = `${base}/${path}`
    const res = await fetch(url, {
        cf:      { cacheTtl: ttl, cacheEverything: true },
        headers: { 'User-Agent': `${env.SITE_URL}/port` },
    })

    if (!res.ok) {
        await env.CACHE.put(cacheKey, KV_NOT_FOUND, { expirationTtl: 300 })
        return null
    }

    const text = await res.text()
    if (text.length < KV_MAX_BYTES) {
        await env.CACHE.put(cacheKey, text, { expirationTtl: ttl })
    }
    return text
}

export async function fetchFeed(env: Env, module: string, filename: string): Promise<string | null> {
    return fetchRaw(env, `${module}/feeds/${filename}`, 900)
}

export async function fetchActor(env: Env, name: string): Promise<ThreatActor | null> {
    const raw = await fetchRaw(env, `actors/profiles/${name}.yaml`, 3600)
    return raw ? yaml.load(raw) as ThreatActor : null
}

// fetchActorAliasIndex loads actors/index.yaml (alias → canonical id) so URLs
// like /actors/midnight-blizzard resolve to the apt29 profile. Keys are
// lowercased once on load; callers should lowercase their lookups too.
export async function fetchActorAliasIndex(env: Env): Promise<Record<string, string>> {
    const raw = await fetchRaw(env, 'actors/index.yaml', 3600)
    if (!raw) return {}
    const parsed = yaml.load(raw) as Record<string, string> | null
    if (!parsed) return {}
    const out: Record<string, string> = {}
    for (const [alias, id] of Object.entries(parsed)) {
        out[alias.toLowerCase()] = id
    }
    return out
}
