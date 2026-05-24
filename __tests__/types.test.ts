import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { IncidentIndex, RootIndex } from '../src/types'

const fixtureDir = path.join(__dirname, 'fixtures')

describe('port/dragnet schema parity', () => {
    it('IncidentIndex round-trips a real dragnet-emitted module index', () => {
        const raw = fs.readFileSync(path.join(fixtureDir, 'supply-index.json'), 'utf8')
        const parsed = JSON.parse(raw) as IncidentIndex
        expect(typeof parsed.generated).toBe('string')
        expect(typeof parsed.module).toBe('string')
        expect(parsed.stats).toBeDefined()
        expect(typeof parsed.stats.total_incidents).toBe('number')
        expect(typeof parsed.stats.total_iocs).toBe('number')
        expect(Array.isArray(parsed.incidents)).toBe(true)
    })

    it('RootIndex round-trips a real dragnet-emitted root index', () => {
        const raw = fs.readFileSync(path.join(fixtureDir, 'root-index.json'), 'utf8')
        const parsed = JSON.parse(raw) as RootIndex
        expect(typeof parsed.generated).toBe('string')
        expect(parsed.stats).toBeDefined()
        // dragnet always writes a "total" key alongside per-module keys.
        expect(parsed.stats.total).toBeDefined()
        expect(typeof parsed.stats.total.incidents).toBe('number')
        expect(typeof parsed.stats.total.iocs).toBe('number')
    })
})
