import { MODULES } from '../config'
import type { Env } from '../types'

const SITE_DESCRIPTION = 'Open source threat intelligence. Detection rules, IOC feeds, and hunting queries for every major SIEM. Free. No account.'

export function baseLayout(title: string, content: string, env: Env, currentPath = ''): string {
    // Live modules render as anchors; coming-soon as muted spans. Separators
    // are owned by CSS gap on .module-links rather than inline glyphs so a
    // live link at the end (e.g. Containers) doesn't sit visually orphaned.
    const navLinks = MODULES.map(m => {
        if (!m.live) {
            return `<span class="mod ${m.id} coming-soon" title="Coming soon">${m.name}</span>`
        }
        const isActive = currentPath.startsWith(`/${m.id}`)
        return `<a href="/${m.id}" class="mod ${m.id}${isActive ? ' active' : ''}">${m.name}</a>`
    }).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escHtml(title)} — dragnet.dev</title>
    <meta name="description" content="${escHtml(SITE_DESCRIPTION)}" />
    <meta property="og:title" content="${escHtml(title)} — dragnet.dev" />
    <meta property="og:description" content="${escHtml(SITE_DESCRIPTION)}" />
    <meta property="og:image" content="${env.SITE_URL}/icon-128.svg" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="dragnet.dev" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escHtml(title)} — dragnet.dev" />
    <meta name="twitter:description" content="${escHtml(SITE_DESCRIPTION)}" />
    <meta name="twitter:image" content="${env.SITE_URL}/icon-128.svg" />
    <meta name="theme-color" content="#7c3aed" />
    <link rel="icon" type="image/svg+xml" href="/icon-24.svg" />
    <link rel="stylesheet" href="/assets/styles.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <script src="/assets/highlight.min.js" defer></script>
    <script src="/assets/app.js" defer></script>
    <script>function onTurnstileSuccess(t){window._tsToken=t;}</script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body>
    <a href="#main" class="skip-link">Skip to content</a>
    <nav>
        <a href="/" class="logo">
            <img src="/icon-24.svg" width="24" height="20" alt="" aria-hidden="true" />
            <span class="wordmark">dragnet<span class="accent">.dev</span></span>
        </a>
        <div class="module-links">${navLinks}</div>
        <form class="nav-search" role="search" action="/search" method="get">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input id="search-input" name="q" type="search" placeholder="Search incidents, IOCs, actors…" autocomplete="off" aria-label="Search incidents" />
            <div id="search-dropdown" class="search-dropdown" role="listbox"></div>
        </form>
        <div class="nav-right">
            <a href="/actors">Actors</a>
            <a href="/feeds">Feeds</a>
            <a href="/about">About</a>
            <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener">GitHub ↗</a>
        </div>
    </nav>
    <main id="main">
        ${content}
    </main>
    <footer>
        <div>
            <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener">dragnet-dev/haul</a>
            · All rules CC0 · No account required ·
            <a href="/about">About</a>
        </div>
    </footer>
</body>
</html>`
}

export function escHtml(str: string | number | null | undefined): string {
    if (str == null) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export interface ErrorPageOptions {
    code:    number
    title:   string
    /** Body HTML — will NOT be escaped, callers are responsible. */
    body:    string
    /** Optional link CTA at the bottom. */
    cta?: { href: string; label: string }
}

// Single source of truth for the 4xx/5xx error page. Body is raw HTML so
// callers can interpolate already-escaped strings (e.g. an incident ID).
export function errorPage(opts: ErrorPageOptions): string {
    const cta = opts.cta
        ? `<a href="${escHtml(opts.cta.href)}" class="copy-btn" style="display:inline-block;padding:8px 16px">${escHtml(opts.cta.label)}</a>`
        : ''
    return `<div class="container page">
    <div class="error-page">
        <h1>${opts.code}</h1>
        <h2>${escHtml(opts.title)}</h2>
        ${opts.body}
        ${cta}
    </div>
</div>`
}
