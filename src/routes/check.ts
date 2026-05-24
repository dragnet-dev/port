import type { Context } from 'hono'
import { fetchHomeSlice } from '../github'
import { MODULES } from '../config'
import { verifyTurnstile } from '../turnstile'
import type { Env } from '../types'

function detectCheckType(v: string): 'action' | 'model' | 'ioc' {
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+@/.test(v)) return 'action'
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(v) && !v.includes(':')) return 'model'
    return 'ioc'
}

export async function checkRoute(c: Context<{ Bindings: Env }>) {
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

    const valueLower = value.toLowerCase()
    const checkType  = detectCheckType(value)
    const liveModules = MODULES.filter(m => m.live)
    const fetched     = await Promise.all(
        liveModules.map(async mod => ({ mod, index: await fetchHomeSlice(c.env, mod.id) }))
    )

    const hits: object[] = []
    for (const { mod, index } of fetched) {
        if (!index) continue

        for (const inc of index.incidents) {
            if (checkType === 'action' && inc.ecosystem === 'github-actions') {
                const atIdx = value.lastIndexOf('@')
                const actionName = value.slice(0, atIdx).toLowerCase()
                const pkgMatch = (inc.packages ?? []).some(p => p.toLowerCase() === actionName)
                if (pkgMatch) {
                    hits.push({
                        module:     mod.id,
                        incident:   inc.id,
                        severity:   inc.severity,
                        campaign:   inc.campaign,
                        confidence: 1,
                        url:        `${c.env.SITE_URL}/${mod.id}/incidents/${inc.id}`,
                    })
                }
            } else if (checkType === 'model' && inc.ecosystem === 'huggingface') {
                const pkgMatch = (inc.packages ?? []).some(p => p.toLowerCase() === valueLower)
                if (pkgMatch) {
                    hits.push({
                        module:     mod.id,
                        incident:   inc.id,
                        severity:   inc.severity,
                        campaign:   inc.campaign,
                        confidence: 1,
                        url:        `${c.env.SITE_URL}/${mod.id}/incidents/${inc.id}`,
                    })
                }
            } else if (checkType === 'ioc') {
                const match = inc.iocs?.find(ioc =>
                    ioc.value.toLowerCase() === valueLower
                )
                if (match) {
                    hits.push({
                        module:     mod.id,
                        incident:   inc.id,
                        severity:   inc.severity,
                        campaign:   inc.campaign,
                        confidence: match.confidence,
                        url:        `${c.env.SITE_URL}/${mod.id}/incidents/${inc.id}`,
                    })
                }
            }
        }
    }

    return c.json({ value, compromised: hits.length > 0, hits })
}
