# Contributing

Thanks for considering a contribution to **port**.

## What lives where

- `dragnet-dev/port` (this repo) — the public frontend at <https://dragnet.dev>.
  Hono + TypeScript on Cloudflare Pages, no client-side state.
- `dragnet-dev/haul` — the data repo: incident YAMLs, IOC feeds, detection rules.
  Issues with the *content* of detection rules or IOC feeds belong there.
- `dragnet-dev/dragnet` — the Go pipeline that produces `haul`. Schema and
  generation issues belong there.

If you're not sure which repo a contribution belongs in, open an issue here
and we'll redirect.

## Local development

```bash
npm install
npm run typecheck    # strict tsc --noEmit
npm test             # vitest
npm run build        # tsc + esbuild + emit-styles + emit-sitemap
npm run dev          # wrangler pages dev public --kv CACHE
```

Copy `.dev.vars.example` to `.dev.vars` and fill in the values noted in
the file (HAUL_REPO, HAUL_BRANCH, SITE_URL, TURNSTILE_SITE_KEY, TURNSTILE_SECRET).

## PR checklist

- `npm run typecheck && npm test && npm run build` all pass locally.
- New routes go through `isValidSlug` for any user-supplied path segments
  (`src/lib/validate.ts`).
- HTML built from fetched data uses `escHtml` on every interpolated string.
  Hrefs that interpolate IDs use `encodeURIComponent`.
- If you add a new feed or external resource, update `__tests__/` with a
  regression test.
- Keep the public bundle small — port intentionally has no client-side
  framework. Plain DOM APIs and HTMX-free pages are the bar.

## Reporting security issues

See [SECURITY.md](./SECURITY.md). Do not open a public issue for a security
finding.
