export const CSS = `
:root {
    --bg:            #0d1117;
    --bg-surface:    #161b22;
    --bg-elevated:   #1c2128;
    --bg-code:       #0d1117;
    --border:        #30363d;
    --border-subtle: #21262d;
    --text:          #e6edf3;
    --text-muted:    #7d8590;
    --text-subtle:   #484f58;
    --accent:        #7c3aed;
    --accent-hover:  #6d28d9;
    --accent-light:  rgba(124,58,237,0.12);
    --accent-border: rgba(124,58,237,0.25);
    --critical:      #f85149;
    --high:          #e3b341;
    --medium:        #58a6ff;
    --low:           #3fb950;
    --stable:        #3fb950;
    --test:          #e3b341;
    --experimental:  #7d8590;
    --supply:        #f85149;
    --malware:       #e3b341;
    --ransomware:    #d29922;
    --cve:           #f85149;
    --container:     #58a6ff;
}

@media (prefers-color-scheme: light) {
    :root {
        --bg:            #ffffff;
        --bg-surface:    #f6f8fa;
        --bg-elevated:   #eaeef2;
        --bg-code:       #f6f8fa;
        --border:        #d0d7de;
        --border-subtle: #e8ecf0;
        --text:          #1f2328;
        --text-muted:    #656d76;
        --text-subtle:   #9198a1;
    }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: system-ui, -apple-system, 'Segoe UI', Inter, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.skip-link {
    position: absolute;
    left: -10000px;
    top: 0;
    background: var(--bg-surface);
    color: var(--text);
    padding: 8px 14px;
    border: 1px solid var(--accent);
    border-radius: 4px;
    z-index: 1000;
}
.skip-link:focus { left: 8px; top: 8px; }

code, pre, .ioc-value, .incident-id {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
}

/* Nav */
nav {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
    position: sticky;
    top: 0;
    z-index: 100;
}

.logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    flex-shrink: 0;
}

.wordmark {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.3px;
}

.wordmark .accent { color: var(--accent); }

.module-links {
    display: flex;
    align-items: center;
    gap: 4px;
}

/* Live module links are tab-style pills with a soft tinted background using
 * the module accent colour. Coming-soon spans are flat muted text — clearly
 * different shape, no border, smaller. */
.mod {
    font-size: 13px;
    padding: 5px 10px;
    border-radius: 6px;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.1s, color 0.1s;
    color: var(--text-muted);
}

a.mod {
    color: var(--text);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    font-weight: 500;
}
a.mod:hover { border-color: var(--border); text-decoration: none; color: var(--text); }
a.mod.active { border-color: var(--accent-border); background: var(--accent-light); }

a.mod.supply  { box-shadow: inset 2px 0 0 var(--supply); padding-left: 12px; }
a.mod.malware { box-shadow: inset 2px 0 0 var(--malware); padding-left: 12px; }
a.mod.ransomware { box-shadow: inset 2px 0 0 var(--ransomware); padding-left: 12px; }
a.mod.cve { box-shadow: inset 2px 0 0 var(--cve); padding-left: 12px; }
a.mod.container { box-shadow: inset 2px 0 0 var(--container); padding-left: 12px; }

.mod.coming-soon {
    color: var(--text-subtle);
    cursor: not-allowed;
    opacity: 0.6;
    padding: 5px 8px;
    font-size: 12px;
}

/* Search lives at the right edge, next to nav-right links. Compact so it
 * doesn't crowd the module pills on the left. */
.nav-search {
    margin-left: auto;
    width: 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    position: relative;
    color: var(--text-muted);
}
.nav-search:focus-within { border-color: var(--accent); color: var(--text); width: 320px; transition: width 0.15s ease; }
.nav-search input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    min-width: 0;
}
.nav-search input::placeholder { color: var(--text-subtle); }
.nav-search .search-dropdown { top: calc(100% + 6px); left: 0; right: 0; }

.nav-right {
    display: flex;
    align-items: center;
    gap: 16px;
}

.nav-right a {
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
}

.nav-right a:hover { color: var(--text); }

/* Main layout */
.container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
}

/* Hero */
.hero {
    padding: 72px 24px 48px;
    text-align: center;
    max-width: 720px;
    margin: 0 auto;
}

.eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: var(--accent-light);
    border: 1px solid var(--accent-border);
    border-radius: 20px;
    padding: 3px 10px;
    color: var(--accent);
    margin-bottom: 20px;
}

.live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--stable);
    animation: pulse 2s infinite;
    flex-shrink: 0;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.hero h1 {
    font-size: 42px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.5px;
    margin-bottom: 16px;
    color: var(--text);
}

.hero .subtext {
    font-size: 16px;
    color: var(--text-muted);
    margin-bottom: 32px;
    line-height: 1.5;
}

/* Search */
.search-wrap {
    position: relative;
    margin-bottom: 24px;
}

.search-input {
    width: 100%;
    padding: 12px 16px 12px 44px;
    font-size: 15px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
}

.search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
}

.search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 200;
    overflow: hidden;
    display: none;
}

.search-dropdown.open { display: block; }

.search-group-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--text-subtle);
    padding: 8px 14px 4px;
}

.search-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    cursor: pointer;
    text-decoration: none;
    color: var(--text);
    font-size: 13px;
    transition: background 0.1s;
}

.search-item:hover, .search-item.active { background: var(--bg-elevated); text-decoration: none; }

.search-item-label { flex: 1; font-family: monospace; }

.search-item-meta { font-size: 11px; color: var(--text-muted); }

.search-footer {
    border-top: 1px solid var(--border);
    padding: 8px 14px;
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
}

.search-divider { height: 1px; background: var(--border-subtle); margin: 4px 0; }

.search-hint {
    border-top: 1px solid var(--border-subtle);
    padding: 6px 14px;
    font-size: 11px;
    color: var(--text-subtle);
    letter-spacing: 0.2px;
    text-align: center;
}

/* Module pills */
.module-pills {
    display: flex;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
}

.module-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.module-pill:hover { border-color: var(--accent); color: var(--text); text-decoration: none; }
.module-pill.live { border-color: var(--accent-border); color: var(--text); }
.module-pill .pill-dot { font-size: 8px; color: var(--text-subtle); }

/* Stats bar */
.stats-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0;
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-surface);
    margin-bottom: 48px;
    flex-wrap: wrap;
}

.stat {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 24px;
    font-size: 13px;
}

.stat:not(:last-child) { border-right: 1px solid var(--border); }

.stat-value { font-weight: 600; color: var(--text); }
.stat-label { color: var(--text-muted); }
.stat-live { color: var(--stable); font-size: 11px; }

/* Grid */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
@media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }

/* Mobile nav: stack the search bar onto its own row, allow module-links to
 * scroll horizontally, hide About (still in footer). */
@media (max-width: 720px) {
    nav {
        flex-wrap: wrap;
        gap: 8px 16px;
        padding: 10px 14px;
    }
    .module-links {
        order: 2;
        overflow-x: auto;
        scrollbar-width: thin;
        max-width: 100%;
    }
    .nav-search {
        order: 3;
        flex-basis: 100%;
        margin: 4px 0 0;
        max-width: none;
    }
    .nav-right {
        order: 1;
        gap: 12px;
        margin-left: auto;
        font-size: 12px;
    }
    .nav-right a[href="/about"] { display: none; }
}

.section-header {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
}

/* Check widget */
.check-widget {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    margin: 16px 0 24px;
    text-align: left;
}

.check-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 8px;
}

.check-row {
    display: flex;
    gap: 8px;
}

.check-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 13px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    outline: none;
    font-family: monospace;
    transition: border-color 0.15s;
}

.check-input:focus { border-color: var(--accent); }
.check-input.loading { animation: border-pulse 1s infinite; }

@keyframes border-pulse {
    0%, 100% { border-color: var(--border); }
    50% { border-color: var(--accent); }
}

.check-btn {
    padding: 8px 16px;
    font-size: 13px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
}

.check-btn:hover { background: var(--accent-hover); }

.check-result { margin-top: 10px; font-size: 13px; }
.check-clean { color: var(--stable); }
.check-hit { color: var(--critical); }
.check-hit a { color: var(--critical); text-decoration: underline; }

/* Incident card */
.incident-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 8px;
    transition: border-color 0.15s;
    text-decoration: none;
    display: block;
    color: var(--text);
}

.incident-card:hover { border-color: var(--accent); text-decoration: none; }

.card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.incident-id {
    font-size: 12px;
    color: var(--text-muted);
    font-family: monospace;
}

.card-body { font-size: 13px; margin-bottom: 6px; }

.card-packages {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
}

.pkg-tag {
    font-size: 11px;
    font-family: monospace;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: 1px 6px;
    color: var(--text-muted);
}

.pkg-more { font-size: 11px; color: var(--text-subtle); align-self: center; }

.card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 11px;
    color: var(--text-muted);
}

.source-count {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 10px;
}

/* Badges */
.badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    flex-shrink: 0;
}

/* Severity hierarchy: critical loudest (saturated + bordered), low quietest. */
.badge-critical { background: rgba(248,81,73,0.22);   color: #ff8480;       border: 1px solid rgba(248,81,73,0.42); padding: 1px 6px; }
.badge-high     { background: rgba(227,179,65,0.18);  color: var(--high);   }
.badge-medium   { background: rgba(88,166,255,0.12);  color: var(--medium); }
.badge-low      { background: rgba(63,185,80,0.08);   color: var(--low);    opacity: 0.85; }

/* Confidence */
.confidence {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
}

.confidence-bar {
    width: 40px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
}

.confidence-bar-fill {
    height: 100%;
    border-radius: 2px;
}

.conf-stable      { background: var(--stable);      }
.conf-test        { background: var(--test);        }
.conf-experimental{ background: var(--experimental); }

.sources-chips { display: flex; gap: 4px; flex-wrap: wrap; }

.source-chip {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--accent-light);
    color: var(--accent);
    border: 1px solid var(--accent-border);
}

/* Accordion */
details.rule-platform {
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    overflow: hidden;
}

details.rule-platform > summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
    background: var(--bg-surface);
    list-style: none;
}

details.rule-platform > summary::-webkit-details-marker { display: none; }
details.rule-platform > summary:hover { background: var(--bg-elevated); }

details.rule-platform > summary .chevron {
    margin-left: auto;
    transition: transform 0.2s ease;
    color: var(--text-muted);
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

details.rule-platform[open] > summary .chevron { transform: rotate(180deg); }

.platform-name { font-size: 13px; font-weight: 500; }

.rule-count {
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 2px 8px;
    border-radius: 10px;
}

.rule-content { padding: 12px; }

.rule-loading {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 13px;
}

.rule-skeleton {
    height: 80px;
    background: var(--bg-elevated);
    border-radius: 6px;
    animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
    0%   { opacity: 0.5; }
    50%  { opacity: 1; }
    100% { opacity: 0.5; }
}

/* Code blocks */
.code-block {
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    margin: 8px 0;
}

.code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
}

.rule-label { font-size: 11px; color: var(--text-muted); font-family: monospace; }
.code-actions { display: flex; align-items: center; gap: 8px; }

.raw-link { font-size: 12px; color: var(--accent); text-decoration: none; }
.raw-link:hover { text-decoration: underline; }

.copy-btn {
    font-size: 12px;
    padding: 3px 10px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-surface);
    color: var(--text);
    cursor: pointer;
    transition: background 0.1s;
    font-family: inherit;
}

.copy-btn:hover  { background: var(--bg-elevated); }
.copy-btn.copied { color: var(--stable); border-color: var(--stable); }

pre { margin: 0; padding: 16px; overflow-x: auto; background: var(--bg-code); }
pre code { font-size: 13px; }

/* Sentinel note */
.sentinel-note, .cs-upload-note {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 12px 14px;
    margin: 8px 0;
    font-size: 13px;
    color: var(--text-muted);
}

.sentinel-note strong { color: var(--text); display: block; margin-bottom: 4px; }
.sentinel-note code { font-size: 12px; color: var(--accent); }
.cs-upload-note p { margin-bottom: 8px; }

/* IOC table */
.ioc-section { margin-bottom: 20px; }
.ioc-group-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
}

.ioc-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
}

.ioc-row:last-child { border-bottom: none; }

.ioc-value {
    flex: 1;
    min-width: 0;
    font-family: monospace;
    font-size: 12px;
    color: var(--text);
    word-break: break-all;
}

/* Exposure block */
.exposure-block { font-size: 13px; }
.exposure-section { margin-bottom: 16px; }
.exposure-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
}

.exposure-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-family: monospace;
    font-size: 12px;
    color: var(--text);
}

/* Incident detail */
.incident-header {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 24px;
}

.incident-header-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.incident-title {
    font-size: 20px;
    font-weight: 600;
    font-family: monospace;
    flex: 1;
}

.incident-meta-row {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 12px;
}

.meta-sep { color: var(--border); }

.incident-sources {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
    flex-wrap: wrap;
}

/* Tabs */
.tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 20px;
}

.tab-btn {
    padding: 8px 16px;
    font-size: 13px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    cursor: pointer;
    margin-bottom: -1px;
    font-family: inherit;
    transition: color 0.1s, border-color 0.1s;
}

.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--text); border-bottom-color: var(--accent); }

.tab-panel { display: none; }
.tab-panel.active { display: block; }

/* Package list */
.packages-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
}

.package-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
}

.package-name {
    font-family: monospace;
    font-size: 13px;
    font-weight: 500;
    flex: 1;
}

.package-versions {
    font-size: 11px;
    color: var(--text-muted);
    font-family: monospace;
}

.show-more-btn {
    font-size: 12px;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
}

/* MITRE */
.mitre-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }

.mitre-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    font-size: 13px;
}

.mitre-id {
    font-family: monospace;
    font-size: 11px;
    color: var(--accent);
    flex-shrink: 0;
    min-width: 80px;
}

.mitre-name { flex: 1; }
.mitre-tactic { font-size: 11px; color: var(--text-muted); }
.mitre-link { font-size: 11px; color: var(--accent); text-decoration: none; }
.mitre-link:hover { text-decoration: underline; }

/* Behaviour card */
.behaviour-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 10px;
}

.behaviour-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
}

.behaviour-id { font-family: monospace; font-size: 12px; color: var(--accent); }
.behaviour-title { font-size: 13px; font-weight: 500; flex: 1; }
.behaviour-tag {
    font-size: 10px;
    padding: 1px 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    color: var(--text-muted);
}

.behaviour-body { padding: 12px 14px; }

.behaviour-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 10px;
    line-height: 1.5;
}

.behaviour-links { display: flex; gap: 8px; flex-wrap: wrap; }

.platform-link {
    font-size: 11px;
    padding: 3px 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    text-decoration: none;
    transition: border-color 0.1s, color 0.1s;
    font-family: inherit;
}

.platform-link:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }

/* References */
.references {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    margin-top: 32px;
}

.references h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 8px;
    margin-top: 16px;
}

.references h3:first-child { margin-top: 0; }

.references ul { list-style: none; display: flex; flex-direction: column; gap: 4px; }

.references a {
    font-size: 13px;
    color: var(--accent);
}

/* Page layouts */
.page { padding: 32px 0 64px; }
.page-header { margin-bottom: 32px; }
.page-title { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
.page-subtitle { font-size: 15px; color: var(--text-muted); }

/* Coming soon */
.coming-soon-page {
    text-align: center;
    padding: 80px 24px;
}

.coming-soon-icon { font-size: 48px; margin-bottom: 16px; }
.coming-soon-page h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
.coming-soon-page p { font-size: 15px; color: var(--text-muted); max-width: 480px; margin: 0 auto 24px; }

/* Footer */
footer {
    border-top: 1px solid var(--border);
    padding: 24px;
    text-align: center;
    font-size: 12px;
    color: var(--text-subtle);
    margin-top: auto;
}

footer a { color: var(--text-muted); }

/* Feeds hub */
.feed-block {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
}

.feed-block h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.feed-block p { font-size: 13px; color: var(--text-muted); margin-bottom: 10px; }
.feed-url-row { display: flex; align-items: center; gap: 8px; }
.feed-url {
    flex: 1;
    font-family: monospace;
    font-size: 12px;
    padding: 6px 10px;
    background: var(--bg-code);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.feed-curl {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 6px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
}
.feed-curl-text {
    flex: 1;
    color: var(--text);
    word-break: break-all;
}

.feed-howto {
    margin-top: 10px;
    font-size: 13px;
}
.feed-howto summary {
    cursor: pointer;
    color: var(--text-muted);
    user-select: none;
}
.feed-howto summary:hover { color: var(--text); }
.feed-howto p {
    margin-top: 8px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.6;
}

/* Actor page */
.actor-header {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}

.actor-name { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.actor-aliases { font-size: 13px; color: var(--text-muted); }

.actor-meta {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
}

.actor-meta-item {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
}

.actor-meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 2px; }
.actor-meta-value { font-size: 14px; font-weight: 500; }

/* Filter bar */
.filter-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
}

.filter-select {
    padding: 6px 10px;
    font-size: 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    outline: none;
    cursor: pointer;
    font-family: inherit;
}

.filter-select:focus { border-color: var(--accent); }

.filter-input {
    flex: 1;
    min-width: 200px;
    padding: 6px 10px;
    font-size: 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    outline: none;
    font-family: inherit;
}

.filter-input:focus { border-color: var(--accent); }

/* Pagination */
.pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 24px;
    font-size: 13px;
}

.page-btn {
    padding: 6px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-muted);
    text-decoration: none;
    transition: border-color 0.1s;
}

.page-btn:hover { border-color: var(--accent); color: var(--text); text-decoration: none; }
.page-btn.current { border-color: var(--accent); color: var(--accent); }

/* 404 */
.error-page {
    text-align: center;
    padding: 80px 24px;
}

.error-page h1 { font-size: 64px; font-weight: 700; color: var(--text-subtle); margin-bottom: 8px; }
.error-page h2 { font-size: 20px; margin-bottom: 12px; }
.error-page p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }

/* Ecosystem badges */
.ecosystem-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 0.3px;
    white-space: nowrap;
    background: var(--bg-elevated);
    color: var(--text-muted);
    border: 0.5px solid var(--border);
}

.ecosystem-github-actions {
    background: rgba(88,166,255,0.12);
    color: #58a6ff;
    border: 0.5px solid rgba(88,166,255,0.25);
}

.ecosystem-huggingface {
    background: rgba(255,193,7,0.12);
    color: #ffc107;
    border: 0.5px solid rgba(255,193,7,0.25);
}

/* Exposure tab extras */
.action-exposure-intro, .model-exposure-intro {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 10px;
    line-height: 1.5;
}

.model-warning {
    background: rgba(248,81,73,0.08);
    border: 1px solid rgba(248,81,73,0.25);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--critical);
    margin-bottom: 12px;
}

.model-alert {
    background: rgba(248,81,73,0.05);
    border: 1px solid rgba(248,81,73,0.2);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--critical);
    margin-top: 10px;
}

.safe-replacement {
    background: rgba(63,185,80,0.08);
    border: 1px solid rgba(63,185,80,0.2);
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 10px;
}

.safe-replacement-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--stable);
    margin-bottom: 6px;
}
`
