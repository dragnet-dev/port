import type { Context } from 'hono'
import { fetchRaw } from '../github'
import { verifyTurnstile } from '../turnstile'
import type { Env } from '../types'

// ContainerImageEntry mirrors dragnet/internal/ioc/exporter.go:ContainerImageEntry
//  -  the rows written to container/feeds/container-images.json.
interface ContainerImageEntry {
    type:        'container_image' | 'container_image_eol'
    repository:  string
    tag:         string
    os_family?:  string
    cve_ids?:    string[]
    tier?:       number
    incident_id: string
    confidence?: number
}

export async function checkImageRoute(c: Context<{ Bindings: Env }>) {
    let body: { value?: string; 'cf-turnstile-response'?: string }
    try {
        body = await c.req.json() as { value?: string; 'cf-turnstile-response'?: string }
    } catch {
        return c.json({ error: 'Invalid JSON' }, 400)
    }

    const { value } = body
    if (!value || typeof value !== 'string') {
        return c.json({ error: 'Missing value' }, 400)
    }

    // Fail closed: a missing TURNSTILE_SECRET means the operator forgot to set
    // the binding in production. Refuse rather than silently going open.
    if (!c.env.TURNSTILE_SECRET) {
        return c.json({ error: 'Service not configured' }, 503)
    }
    const token = body['cf-turnstile-response']
    if (!token || typeof token !== 'string') {
        return c.json({ error: 'Missing Turnstile token' }, 400)
    }
    const ok = await verifyTurnstile(token, c.env.TURNSTILE_SECRET)
    if (!ok) return c.json({ error: 'Turnstile verification failed' }, 403)

    const raw = await fetchRaw(c.env, 'container/feeds/container-images.json', 1800)
    if (!raw) {
        return c.json({ value, compromised: false, hits: [] })
    }

    let entries: ContainerImageEntry[]
    try {
        entries = JSON.parse(raw) as ContainerImageEntry[]
    } catch {
        return c.json({ value, compromised: false, hits: [] })
    }
    const valueLower = value.toLowerCase()
    // Accept either "repository:tag" or just "repository". The latter matches
    // any tag of that repo flagged in the feed.
    const [qRepo, qTag] = valueLower.includes(':')
        ? valueLower.split(':', 2) as [string, string]
        : [valueLower, ''] as [string, string]

    const hits = entries
        .filter(e => {
            const repoMatch = e.repository.toLowerCase() === qRepo
            if (!repoMatch) return false
            if (!qTag) return true
            return e.tag.toLowerCase() === qTag
        })
        .map(e => ({
            module:      'container',
            incident:    e.incident_id,
            image:       `${e.repository}:${e.tag}`,
            tier:        e.tier ?? null,
            eol:         e.type === 'container_image_eol',
            cve_ids:     e.cve_ids ?? [],
            url:         `${c.env.SITE_URL}/container/incidents/${e.incident_id}`,
        }))

    return c.json({ value, compromised: hits.length > 0, hits })
}
