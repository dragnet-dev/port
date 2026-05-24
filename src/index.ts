import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { homeRoute } from './routes/home'
import { moduleRoute } from './routes/module'
import { incidentsRoute } from './routes/incidents'
import { incidentRoute } from './routes/incident'
import { containerIncidentRoute } from './routes/containerIncident'
import { cveIncidentRoute } from './routes/cveIncident'
import { malwareIncidentRoute } from './routes/malwareIncident'
import { actorRoute } from './routes/actors'
import { actorsIndexRoute } from './routes/actorsIndex'
import { feedsHubRoute, feedProxyRoute } from './routes/feeds'
import { aboutRoute } from './routes/about'
import { checkRoute } from './routes/check'
import { checkImageRoute } from './routes/checkImage'
import { searchRoute } from './routes/search'
import { rulesRoute } from './routes/rules'
import { fetchHomeSlice } from './github'
import { MODULES } from './config'
import { baseLayout, errorPage } from './ui/layout'
import { scheduled } from './scheduled'
import type { Env } from './types'

// Exported for the test harness — vitest uses app.request(url, init, env) to
// exercise routes without spinning up wrangler. The Worker entry-point below
// is the default export.
export const app = new Hono<{ Bindings: Env }>()

// Security headers on every response via Hono's built-in secureHeaders middleware.
// 'unsafe-inline' in script-src covers the small Turnstile callback defined
// inline in the layout <head>. All other JS is served from /assets/*.
app.use('*', secureHeaders({
    xFrameOptions:        'DENY',
    xContentTypeOptions:  'nosniff',
    referrerPolicy:       'strict-origin-when-cross-origin',
    contentSecurityPolicy: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
        styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:      ["'self'", 'data:'],
        connectSrc:  ["'self'", 'https://challenges.cloudflare.com'],
        frameAncestors: ["'none'"],
    },
}))

// Edge-cache rendered HTML for 30 min. Pages are deterministic given the
// upstream haul data (which is itself KV-cached for ~30 min in fetchRaw), so
// repeated hits to the same path should hit Cloudflare's edge cache before
// they ever reach the Worker. Routes that need different semantics
// (/check*, /api/index, feed proxies) set their own Cache-Control and the
// middleware leaves the existing header alone.
app.use('*', async (c, next) => {
    await next()
    if (c.req.method !== 'GET') return
    if (c.res.status !== 200) return
    if (c.res.headers.get('Cache-Control')) return
    c.res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=600')
})

// /_health — minimal liveness endpoint for external uptime monitors.
// Registered first so the /:module catch-all doesn't shadow it.
app.get('/_health', (c) => {
    c.header('Cache-Control', 'no-store')
    return c.json({ ok: true })
})

app.post('/check',                                            checkRoute)
app.post('/check-image',                                      checkImageRoute)
app.get('/rules/:module/:platform/:layer/:filename',          rulesRoute)
app.get('/',                             homeRoute)
app.get('/search',                       searchRoute)
app.get('/about',                        aboutRoute)
app.get('/feeds',                        feedsHubRoute)
app.get('/:module/feeds/:filename{.+}',  feedProxyRoute)
app.get('/actors',                       actorsIndexRoute)
app.get('/actors/:name',                 actorRoute)
app.get('/:module',                      moduleRoute)
app.get('/:module/incidents',            incidentsRoute)
app.get('/container/incidents/:id',      containerIncidentRoute)
app.get('/malware/incidents/:id',         malwareIncidentRoute)
app.get('/cve/incidents/:id',            cveIncidentRoute('cve'))
app.get('/ransomware/incidents/:id',     cveIncidentRoute('ransomware'))
app.get('/:module/incidents/:id',        incidentRoute)

// /api/index — union of every live module's curated incident index, used by
// the in-page search/typeahead in public/assets/app.js. Subject to change;
// not a stable public API. See README for the response shape.
app.get('/api/index', async (c) => {
    const liveModules = MODULES.filter(m => m.live)
    const fetched     = await Promise.all(
        liveModules.map(async mod => ({ mod, idx: await fetchHomeSlice(c.env, mod.id) }))
    )
    const incidents = fetched.flatMap(({ mod, idx }) =>
        idx ? idx.incidents.map(i => ({ ...i, module: mod.id })) : []
    )
    c.header('Cache-Control', 'public, max-age=300, s-maxage=1800')
    return c.json({ incidents })
})

// 404 path: first ask Pages' static-asset binding (serves robots.txt,
// sitemap.xml, /assets/*, /icon-*.svg). If that 404s too, render our
// branded not-found page.
app.notFound(async (c) => {
    if (c.env.ASSETS) {
        const assetRes = await c.env.ASSETS.fetch(c.req.raw)
        // Clone so downstream middleware (security headers) can mutate the Response.
        // ASSETS responses are immutable in workerd; a plain `new Response(r.body, r)`
        // creates a mutable copy that middleware can freely modify.
        if (assetRes.status !== 404) return new Response(assetRes.body, assetRes)
    }
    const html = errorPage({
        code:  404,
        title: 'Page not found',
        body:  `<p>The page you're looking for doesn't exist.</p>`,
        cta:   { href: '/', label: 'Go home' },
    })
    return c.html(baseLayout('Not found', html, c.env), 404)
})

app.onError((err, c) => {
    // Log the full error for operators; never expose stack/message to the
    // response body. err.message can carry internal URLs, env-var names, or
    // KV keys that don't belong on a public-facing 500 page.
    console.error('[port] unhandled error:', err.stack ?? err)
    const html = errorPage({
        code:  500,
        title: 'Something went wrong',
        body:  `<p>An unexpected error occurred. Please try again in a moment.</p>`,
        cta:   { href: '/', label: 'Go home' },
    })
    return c.html(baseLayout('Error', html, c.env), 500)
})

// Pages Functions worker handler. `fetch` serves the Hono app; `scheduled`
// fires from the cron trigger declared in wrangler.toml [triggers].
export default {
    fetch:     app.fetch.bind(app),
    scheduled,
} satisfies ExportedHandler<Env>
