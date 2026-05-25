// Scheduled handler: runs on a cron (see wrangler.toml [triggers]) and keeps
// port's KV cache in sync with haul.
//
// dragnet writes feeds/manifest.json  -  a deterministic per-file inventory
// with sha256 hashes  -  every time it generates new haul output. On each
// trigger we:
//
//   1. Fetch manifest.json (bypassing our own KV).
//   2. Compare every file's sha256 to the snapshot stored at the well-known
//      KV key `_manifest:last_seen`.
//   3. For each file whose sha256 changed (or that's new / removed since
//      the last snapshot), delete the corresponding `raw:` cache key so the
//      next user request re-fetches from haul instead of serving the stale
//      cached body.
//   4. For shard files under `{module}/incidents/all/`, also purge the
//      per-incident `inc:` cache entries for that module  -  those are derived
//      from the shard contents and would otherwise stay stale for up to 24h.
//   5. Extract the IOC count (feeds/unified.jsonl records field) from the
//      manifest and store it at `_stats:ioc_count`  -  avoids home page having
//      to download the full 50 MB manifest at request time.
//   6. For any module whose incidents/index.json changed, rebuild the
//      `_home:${module}` KV slice (top-500 most-recent IncidentSummaries +
//      full stats) so the home page reads tiny KV entries instead of the
//      raw index (which can exceed KV's 25 MiB limit for supply).
//   7. Persist the new snapshot under `_manifest:last_seen` (7d TTL  -  long
//      enough to survive long gaps in cron firing, short enough that an
//      orphaned key eventually self-cleans).

import { fetchHaulIndex } from './github'
import { MODULES, resolveBase } from './config'
import type { Env, IncidentIndex, IncidentSummary, Manifest } from './types'

const KV_MAX_BYTES = 24 * 1024 * 1024

// trackable returns true for paths we include in the manifest snapshot.
// The manifest lists 180k+ rule YAMLs (*/rules/**) that are served from
// satellite repos  -  we never fetchRaw them. We also skip individual incident
// YAMLs (200k+ in supply). Keeping only the small set we actually cache via
// fetchRaw keeps the snapshot well under KV's 25 MiB limit.
function trackable(path: string): boolean {
    // actors/ and feeds/ → small, we fetch these
    if (/^(actors|feeds)\//.test(path)) return true
    // root incidents/index.json
    if (path === 'incidents/index.json') return true
    // {module}/incidents/index.json and {module}/incidents/all/*.jsonl
    if (/^[^/]+\/incidents\/(index\.json|all\/[^/]+\.jsonl)$/.test(path)) return true
    return false
}

// Exported for unit testing  -  pure diff function with no side effects.
export function diffManifest(
    previous: Record<string, string>,
    current:  Manifest,
): { changed: string[], removed: string[] } {
    const changed: string[] = []
    const seen = new Set<string>()
    for (const f of current.files) {
        if (!trackable(f.path)) continue
        seen.add(f.path)
        if (previous[f.path] !== f.sha256) changed.push(f.path)
    }
    const removed = Object.keys(previous).filter(p => !seen.has(p))
    return { changed, removed }
}

export async function scheduled(
    _controller: ScheduledController,
    env:         Env,
    ctx:         ExecutionContext,
): Promise<void> {
    ctx.waitUntil(syncManifest(env))
}

async function syncManifest(env: Env): Promise<void> {
    const haulIndex = await fetchHaulIndex(env)
    const url = haulIndex.manifest_url
    const res = await fetch(url, {
        cf:      { cacheTtl: 0, cacheEverything: false },
        headers: { 'User-Agent': `${env.SITE_URL}/port` },
    })
    if (!res.ok) {
        console.warn(`[manifest-sync] fetch ${url} failed: ${res.status}`)
        return
    }

    let manifest: Manifest
    try {
        manifest = await res.json() as Manifest
    } catch (err) {
        console.warn('[manifest-sync] manifest.json parse failed:', err)
        return
    }

    const snapshotKey = `_manifest:last_seen`
    const previousRaw = await env.CACHE.get(snapshotKey)
    const previous: Record<string, string> = previousRaw ? JSON.parse(previousRaw) : {}

    const { changed, removed } = diffManifest(previous, manifest)
    const toInvalidate = [...changed, ...removed]

    // Always update the IOC count and home slices  -  even on first run when
    // toInvalidate is empty  -  so a fresh deploy is immediately usable.
    await updateIocCount(env, manifest)
    await buildShardNums(env, manifest)
    await buildHomeSlices(env, haulIndex, toInvalidate)
    await buildActorIndex(env)

    if (toInvalidate.length === 0) {
        console.log(`[manifest-sync] no changes (${manifest.files.length} files tracked)`)
        // Still persist snapshot if it was missing (e.g. first run).
        if (!previousRaw) {
            const snapshot: Record<string, string> = {}
            for (const f of manifest.files) if (trackable(f.path)) snapshot[f.path] = f.sha256
            await env.CACHE.put(snapshotKey, JSON.stringify(snapshot), { expirationTtl: 7 * 24 * 3600 })
        }
        return
    }

    // Purge raw: keys for every changed file. The cache key format is set in
    // src/github.ts:fetchRaw.
    await Promise.all(toInvalidate.map(path => env.CACHE.delete(`raw:${path}`)))

    // For shard changes, also purge the per-incident inc: entries for the
    // affected module  -  they're derived from the shard contents.
    const touchedModules = new Set<string>()
    for (const path of toInvalidate) {
        const m = path.match(/^([^/]+)\/incidents\/all\/.+\.jsonl$/)
        if (m) touchedModules.add(m[1])
    }
    await Promise.all([...touchedModules].map(mod => purgeIncByPrefix(env, `inc:${mod}:`)))

    // Persist the new snapshot. 7d TTL  -  long enough to survive cron gaps,
    // short enough that the key isn't orphaned forever if we change schemes.
    const snapshot: Record<string, string> = {}
    for (const f of manifest.files) if (trackable(f.path)) snapshot[f.path] = f.sha256
    await env.CACHE.put(snapshotKey, JSON.stringify(snapshot), {
        expirationTtl: 7 * 24 * 3600,
    })

    console.log(`[manifest-sync] invalidated ${toInvalidate.length} raw:/${touchedModules.size} module(s) of inc: keys`)
}

// updateIocCount reads the records count from feeds/unified.jsonl in the
// manifest and stores it at _stats:ioc_count so the home page can read it
// from KV without downloading the full 50 MB manifest.json at request time.
async function updateIocCount(env: Env, manifest: Manifest): Promise<void> {
    const unified = manifest.files.find(f => f.path === 'feeds/unified.jsonl')
    if (!unified?.records) return
    await env.CACHE.put('_stats:ioc_count', String(unified.records), {
        expirationTtl: 7 * 24 * 3600,
    })
}

// buildHomeSlices fetches the module incident index for any module whose
// index.json changed (or has no slice yet) and writes a trimmed
// `_home:${module}` KV entry containing the 500 most-recently-published
// IncidentSummaries plus the full module stats. This keeps the home page
// reading tiny KV values instead of raw indexes that can reach 55 MB.
async function buildHomeSlices(
    env:            Env,
    haulIndex:      Awaited<ReturnType<typeof fetchHaulIndex>>,
    changedPaths:   string[],
): Promise<void> {
    const intelBase = resolveBase(haulIndex, 'intel', env)
    const changedSet = new Set(changedPaths)

    for (const mod of MODULES) {
        if (!mod.live) continue
        const indexPath = `${mod.id}/incidents/index.json`
        const sliceKey  = `_home:${mod.id}`

        // Only rebuild if the index changed or no slice exists yet.
        const needsRebuild = changedSet.has(indexPath) || !(await env.CACHE.get(sliceKey))
        if (!needsRebuild) continue

        const res = await fetch(`${intelBase}/${indexPath}`, {
            cf:      { cacheTtl: 300, cacheEverything: true },
            headers: { 'User-Agent': `${env.SITE_URL}/port` },
        })
        if (!res.ok) {
            console.warn(`[home-slice] fetch ${indexPath} failed: ${res.status}`)
            continue
        }

        let full: IncidentIndex
        try {
            full = await res.json() as IncidentIndex
        } catch {
            console.warn(`[home-slice] parse ${indexPath} failed`)
            continue
        }

        // Sort descending by published date and cap at HOME_SLICE_LIMIT  - 
        // more than enough for 6-recent + 6-trending cards. Trending score
        // decays to zero after 30 days so older incidents never win anyway.
        // Keep well under the 25 MiB KV limit: 200 IncidentSummary rows ≈
        // ~200 KB even for the richest modules.
        const HOME_SLICE_LIMIT = 200
        const topN: IncidentSummary[] = [...full.incidents]
            .sort((a, b) => new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime())
            .slice(0, HOME_SLICE_LIMIT)

        const slice: IncidentIndex = {
            generated: full.generated,
            module:    full.module,
            stats:     full.stats,
            campaigns: full.campaigns,
            incidents: topN,
        }

        const sliceJson = JSON.stringify(slice)
        if (sliceJson.length >= 24 * 1024 * 1024) {
            console.warn(`[home-slice] ${mod.id} slice still too large (${sliceJson.length} bytes), skipping`)
            continue
        }
        await env.CACHE.put(sliceKey, sliceJson, { expirationTtl: 7 * 24 * 3600 })
        console.log(`[home-slice] rebuilt ${mod.id}: ${topN.length} of ${full.incidents.length} incidents, stats=${JSON.stringify(full.stats)}`)
    }
}

// buildShardNums extracts the set of existing sub-shard numbers for each
// (module, shardKey) pair from the manifest file list and stores them at
// `shard-nums:{module}`. fetchIncidentFromShard reads these to avoid probing
// sub-shards 0..15 when only 0..2 actually exist.
async function buildShardNums(env: Env, manifest: Manifest): Promise<void> {
    type ShardInfo = { bare: boolean; nums: number[] }
    const shardMap: Record<string, Record<string, ShardInfo>> = {}

    for (const f of manifest.files) {
        const m = f.path.match(/^([^/]+)\/incidents\/all\/([a-z0-9]+)(-(\d+))?\.jsonl$/)
        if (!m) continue
        const [, mod, shardKey, , numStr] = m
        if (!shardMap[mod]) shardMap[mod] = {}
        if (!shardMap[mod][shardKey]) shardMap[mod][shardKey] = { bare: false, nums: [] }
        if (numStr === undefined) {
            shardMap[mod][shardKey].bare = true
        } else {
            shardMap[mod][shardKey].nums.push(Number(numStr))
        }
    }

    for (const [mod, map] of Object.entries(shardMap)) {
        for (const v of Object.values(map)) v.nums.sort((a, b) => a - b)
        await env.CACHE.put(`shard-nums:${mod}`, JSON.stringify(map), { expirationTtl: 7 * 24 * 3600 })
    }
    console.log(`[shard-nums] updated ${Object.keys(shardMap).length} module(s)`)
}

// buildActorIndex reads the already-built _home:{module} slices and writes
// `actor-inc:{actorNameLower}` KV entries mapping each actor name to the list
// of IncidentSummaries (with module) that reference them. The actors route
// checks these KV entries first before falling back to fetching full indexes.
async function buildActorIndex(env: Env): Promise<void> {
    const actorMap = new Map<string, Array<IncidentSummary & { module: string }>>()

    const liveMods = MODULES.filter(m => m.live)
    const slices = await Promise.all(
        liveMods.map(mod => env.CACHE.get(`_home:${mod.id}`).then(s => ({ mod, s })))
    )
    for (const { mod, s } of slices) {
        if (!s) continue
        let slice: IncidentIndex
        try { slice = JSON.parse(s) as IncidentIndex } catch { continue }
        for (const inc of slice.incidents) {
            if (!inc.actor) continue
            const key = inc.actor.toLowerCase()
            if (!actorMap.has(key)) actorMap.set(key, [])
            actorMap.get(key)!.push({ ...inc, module: mod.id })
        }
    }

    for (const [name, incidents] of actorMap) {
        const val = JSON.stringify(incidents)
        if (val.length < KV_MAX_BYTES) {
            await env.CACHE.put(`actor-inc:${name}`, val, { expirationTtl: 7 * 24 * 3600 })
        }
    }
    console.log(`[actor-index] indexed ${actorMap.size} actor name(s)`)
}

// purgeIncByPrefix lists and deletes every KV key under a given prefix. Used
// to invalidate the per-incident cache for a module whose shards changed.
// KV list returns up to 1000 keys per call; we paginate via the cursor.
async function purgeIncByPrefix(env: Env, prefix: string): Promise<void> {
    let cursor: string | undefined
    do {
        const page = await env.CACHE.list({ prefix, cursor })
        await Promise.all(page.keys.map(k => env.CACHE.delete(k.name)))
        cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)
}
