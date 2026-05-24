#!/usr/bin/env node
// Emit public/sitemap.xml from the live modules in src/config.ts.
//
// Module list is parsed out of the TS source rather than imported (this script
// runs from plain Node without a TS pipeline). The build step in package.json
// runs this after typecheck, so any malformed config.ts will already have
// failed by the time this runs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SITE = process.env.SITE_URL ?? 'https://dragnet.dev'
const src = readFileSync('src/config.ts', 'utf8')

// Match every `{ id: "...", ..., live: true|false, ... }` module block.
const moduleRe = /\{\s*id:\s*"([^"]+)"[\s\S]*?live:\s*(true|false)/g
const liveModules = []
for (const match of src.matchAll(moduleRe)) {
    if (match[2] === 'true') liveModules.push(match[1])
}

const today = new Date().toISOString().slice(0, 10)

const staticPaths = ['', '/about', '/feeds', '/actors', '/search']
const modulePaths = liveModules.flatMap(id => [`/${id}`, `/${id}/incidents`])

const entries = [...staticPaths, ...modulePaths].map(p => `    <url>
        <loc>${SITE}${p}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>${p === '' || p.endsWith('/incidents') ? 'daily' : 'weekly'}</changefreq>
    </url>`).join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`

const out = 'public/sitemap.xml'
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, xml)
console.log(`emit-sitemap: wrote ${xml.length.toLocaleString()} bytes -> ${out} (${liveModules.length} live modules)`)
