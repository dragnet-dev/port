// Slug-shaped values flow into raw.githubusercontent.com paths via src/github.ts.
// raw.githubusercontent.com refuses out-of-repo paths upstream, but rejecting at
// the route boundary closes the class — no encoded ../ sneaking past Hono's
// param decoding, no surprise control chars in upstream URLs.
const SLUG_RE = /^[a-zA-Z0-9._/-]+$/

export function isValidSlug(s: string): boolean {
    if (!s) return false
    if (s.includes('..')) return false
    return SLUG_RE.test(s)
}
