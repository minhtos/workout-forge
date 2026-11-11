/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appVersion, changelog, formatChangelogDate } from './changelog'

const packageVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version

describe('changelog', () => {
  it('is newest first', () => {
    const dates = changelog.map((entry) => entry.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('leads with the version in package.json, so a release cannot ship without its entry', () => {
    expect(changelog[0].version).toBe(appVersion)
    expect(appVersion).toBe(packageVersion)
  })

  it('has unique versions and at least one note per entry', () => {
    const versions = changelog.flatMap((entry) => (entry.version ? [entry.version] : []))
    expect(new Set(versions).size).toBe(versions.length)
    for (const entry of changelog) expect(entry.notes.length).toBeGreaterThan(0)
  })

  it('announces itself in the latest notes', () => {
    expect(changelog[0].notes.join(' ')).toContain('Settings → Equipment')
  })

  it('keeps the 0.1.0 entry announcing What’s New and the changelog', () => {
    const first = changelog.find((entry) => entry.version === '0.1.0')!.notes.join(' ')
    expect(first).toContain("What's New")
    expect(first).toContain('Settings → Changelog')
  })

  it('formats dates in local time', () => {
    expect(formatChangelogDate('2026-11-05')).toBe('5 Nov 2026')
  })
})
