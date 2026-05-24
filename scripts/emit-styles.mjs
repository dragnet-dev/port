#!/usr/bin/env node
// Emit src/ui/styles.ts → public/assets/styles.css.
//
// The site styles live as a tagged-template CSS string in src/ui/styles.ts
// (so editor tooling can lint it as TS). The Worker doesn't need it at runtime;
// it's served as a static asset by Cloudflare Pages.
//
// Replaces the prior `tailwindcss -o public/assets/styles.css` step, which
// produced an empty file because the source uses bespoke class names rather
// than Tailwind utility classes.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname }  from 'node:path'

const src = readFileSync('src/ui/styles.ts', 'utf8')

// Match `export const CSS = \`...\`` and capture the body between backticks.
const match = src.match(/export const CSS\s*=\s*`([\s\S]*?)`/)
if (!match) {
    console.error('emit-styles: could not find `export const CSS = ` in src/ui/styles.ts')
    process.exit(1)
}

const css = match[1]
const out = 'public/assets/styles.css'
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, css)
console.log(`emit-styles: wrote ${css.length.toLocaleString()} bytes → ${out}`)
