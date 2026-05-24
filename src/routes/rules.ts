import type { Context } from 'hono'
import { fetchRawFromSat } from '../github'
import { MODULES, PLATFORMS, platformToSatelliteKey } from '../config'
import type { Env } from '../types'

const VALID_MODULES  = new Set(MODULES.map(m => m.id))
const VALID_PLATFORMS = new Set(PLATFORMS.map(p => p.id))

// Safe segment: alphanumeric, dots, hyphens, underscores — but NOT '..' or
// a leading dot. The '..' check is load-bearing: /^[a-zA-Z0-9._-]+$/ would
// match '..' (two dots), which could traverse directories in the upstream URL.
const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

function isSafeSegment(s: string): boolean {
    return SAFE_SEGMENT.test(s) && !s.includes('..')
}

export async function rulesRoute(c: Context<{ Bindings: Env }>) {
    const { module, platform, layer, filename } = c.req.param() as {
        module: string; platform: string; layer: string; filename: string
    }

    if (!VALID_MODULES.has(module) || !VALID_PLATFORMS.has(platform)) {
        return c.text('Not found', 404)
    }
    if (!isSafeSegment(layer) || !isSafeSegment(filename)) {
        return c.text('Not found', 404)
    }

    const satKey = platformToSatelliteKey(platform)
    const path   = `${module}/rules/${platform}/${layer}/${filename}`
    const text   = await fetchRawFromSat(c.env, satKey, path)
    if (!text) return c.text('Not found', 404)

    const contentType = filename.endsWith('.json') ? 'application/json'
        : filename.endsWith('.xml') ? 'application/xml'
        : 'text/plain; charset=utf-8'

    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
    return c.text(text)
}
