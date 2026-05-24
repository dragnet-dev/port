# port; dragnet.dev

[![CI](https://github.com/dragnet-dev/port/actions/workflows/ci.yml/badge.svg)](https://github.com/dragnet-dev/port/actions/workflows/ci.yml)

**The public web UI for [Dragnet](https://dragnet.dev) threat intelligence.**
Server-rendered with [Hono](https://hono.dev/) on Cloudflare Pages Functions.
Reads from [`dragnet-dev/haul`](https://github.com/dragnet-dev/haul) on
demand and KV-caches each fetch.

Read-only by design. No accounts, no telemetry, no client-side state.

---

## Routes

| Path                                  | Renders                                |
|---------------------------------------|----------------------------------------|
| `/`                                   | Home: live stats + recent + trending   |
| `/:module`                            | Module summary                         |
| `/:module/incidents`                  | Module incident list                   |
| `/:module/incidents/:id`              | Single incident with rules + IOCs      |
| `/container/incidents/:id`            | Container incident                     |
| `/actors/:name`                       | Threat actor profile                   |
| `/feeds`                              | Feeds hub                              |
| `/:module/feeds/:filename{.+}`        | Raw feed proxy (CORS open)             |
| `/about`                              | About page                             |
| `/search`                             | Search                                 |
| `POST /check`                         | Check a package / IOC / action / model |
| `POST /check-image`                   | Check a container image tag            |
| `GET /api/index`                      | Aggregated index across live modules   |

---

## Local dev

```bash
npm install
npm run typecheck
npm test
npm run dev          # wrangler pages dev public --kv CACHE
```

---

## Deploy

Cloudflare Pages, advanced mode (`pages_build_output_dir = "public"`):

```bash
npm run build                          # tsc → esbuild → public/_worker.js + assets
wrangler pages deploy public           # or hook up the GitHub integration
```

Required Cloudflare configuration:

- **KV namespace** bound as `CACHE`; set the namespace ID in `wrangler.toml`.
- **Environment variables** (Production):
  - `HAUL_REPO`; defaults to `dragnet-dev/haul`
  - `HAUL_BRANCH`; defaults to `main`
  - `SITE_URL`; `https://dragnet.dev`
  - `TURNSTILE_SITE_KEY`; public site key
- **Environment secrets** (Production):
  - `TURNSTILE_SECRET`; Cloudflare Turnstile secret. **Required.** `/check`
    and `/check-image` return `503 Service not configured` if it's unset, so
    a forgotten secret surfaces immediately rather than leaving the POST
    endpoints open. A valid Turnstile token in the request body
    (`cf-turnstile-response` field) is required on every call.

`public/_headers` is auto-applied by Pages: HSTS, CSP, X-Frame-Options,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

---

## JSON API

`GET /api/index` returns a union of every live module's curated incident
index (the same data that powers home, listings, and check). It backs the
in-page search/typeahead and is intentionally undocumented as a stable
public API — the response shape mirrors `IncidentSummary` from `src/types.ts`
and may change to track dragnet's generator. Cached at the edge for 5 minutes.

```json
{
  "incidents": [
    {
      "id":            "npm-event-stream-2018-001",
      "module":        "supply",
      "severity":      "critical",
      "attack_type":   "typosquat",
      "ecosystem":     "npm",
      "published":     "2026-05-15T...",
      "ioc_count":     5,
      "source_count":  3,
      "packages":      ["event-stream"],
      "iocs":          [{ "type": "domain", "value": "..." }]
    }
  ]
}
```

Consumers that need a stable contract should pull the haul JSONL shards or
`feeds/manifest.json` directly. Detection rules and IOC feeds are served via
`/:module/feeds/:filename` with `Access-Control-Allow-Origin: *`.

## Schema parity with the engine

`src/types.ts` mirrors the JSON shape emitted by
[dragnet's index generator](https://github.com/dragnet-dev/dragnet/blob/main/internal/index/generator.go).
A real fixture from a fresh dragnet `generate` run is checked into
`__tests__/fixtures/` and round-tripped in `__tests__/types.test.ts` to
catch drift early.

## License

MIT. See [LICENSE](./LICENSE).
