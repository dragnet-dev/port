import { Context } from 'hono'
import { baseLayout } from '../ui/layout'
import type { Env } from '../types'

export function aboutRoute(c: Context<{ Bindings: Env }>) {
    const html = `<div class="container page" style="max-width:720px">
    <div class="page-header">
        <h1 class="page-title">About Dragnet</h1>
    </div>

    <div style="font-size:15px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:16px">
        <p>Dragnet is an open source threat intelligence platform. Detection rules, IOC feeds,
        and hunting queries for every major SIEM — free, with no account required.</p>

        <p>All intelligence data lives in the public
        <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener">dragnet-dev/haul</a>
        repository on GitHub. Rules and IOC feeds are published under the CC0 licence — use them anywhere,
        no attribution needed.</p>

        <p>This site (<a href="https://github.com/dragnet-dev/port" target="_blank" rel="noopener">dragnet-dev/port</a>)
        is a read-only frontend that fetches data directly from the haul repo at request time.
        It stores nothing. It generates nothing. No user data is collected.</p>

        <p>Built with Hono and TypeScript on Cloudflare Pages. Source under MIT, intelligence data under CC0.</p>

        <p style="font-size:13px;color:var(--text-subtle)">Found a security issue in port itself? See our
        <a href="https://github.com/dragnet-dev/port/blob/main/SECURITY.md" target="_blank" rel="noopener">security policy</a>.</p>
    </div>

    <div style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
        <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener" class="copy-btn" style="padding:8px 16px">
            dragnet-dev/haul ↗
        </a>
        <a href="https://github.com/dragnet-dev/port" target="_blank" rel="noopener" class="copy-btn" style="padding:8px 16px">
            dragnet-dev/port ↗
        </a>
        <a href="/feeds" class="copy-btn" style="padding:8px 16px">Feeds</a>
    </div>
</div>`

    return c.html(baseLayout('About', html, c.env, '/about'))
}
