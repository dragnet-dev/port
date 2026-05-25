import { Context } from 'hono'
import { baseLayout } from '../ui/layout'
import type { Env } from '../types'

export function aboutRoute(c: Context<{ Bindings: Env }>) {
    const html = `<div class="container page" style="max-width:720px">
    <div class="page-header">
        <h1 class="page-title">About Dragnet</h1>
    </div>

    <div style="font-size:15px;color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:20px">
        <p>Dragnet is an open source threat intelligence platform covering supply chain attacks,
        malware campaigns, ransomware groups, CVEs, container vulnerabilities, and OS-level packages.
        Detection rules, IOC feeds, and hunting queries for every major SIEM. Free. No account required.</p>

        <p>Everything is open. All intelligence data lives in
        <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener">dragnet-dev/haul</a>
        on GitHub. Rules and feeds are published under CC0 - use them anywhere, no attribution needed.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
            <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:var(--text-subtle);margin-bottom:8px">Data</div>
                <div style="font-size:13px;color:var(--text-muted);line-height:1.6">Continuously updated from public threat reports, CVE databases, ransomware trackers, and package vulnerability feeds.</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:var(--text-subtle);margin-bottom:8px">Rules</div>
                <div style="font-size:13px;color:var(--text-muted);line-height:1.6">Detection rules for Sentinel, Splunk, Elastic, Sigma, KQL, Chronicle, Suricata, Snort, and more.</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:var(--text-subtle);margin-bottom:8px">IOC Feeds</div>
                <div style="font-size:13px;color:var(--text-muted);line-height:1.6">Machine-readable feeds: domains, IPs, hashes, STIX bundles. Ingest directly into your tooling via URL.</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:16px">
                <div style="font-size:12px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;color:var(--text-subtle);margin-bottom:8px">Privacy</div>
                <div style="font-size:13px;color:var(--text-muted);line-height:1.6">No cookies. No accounts. No tracking. Nothing is collected or stored about visitors.</div>
            </div>
        </div>

        <p style="font-size:13px;color:var(--text-subtle)">Found a security issue?
        <a href="https://github.com/dragnet-dev/port/blob/main/SECURITY.md" target="_blank" rel="noopener" style="color:var(--text-muted)">See our security policy.</a></p>
    </div>

    <div style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
        <a href="https://github.com/dragnet-dev/haul" target="_blank" rel="noopener" class="copy-btn" style="padding:8px 16px">GitHub ↗</a>
        <a href="/feeds" class="copy-btn" style="padding:8px 16px">IOC Feeds</a>
        <a href="/actors" class="copy-btn" style="padding:8px 16px">Threat Actors</a>
    </div>
</div>`

    return c.html(baseLayout('About', html, c.env, '/about'))
}
