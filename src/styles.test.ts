/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read as text: vitest does not process CSS imports, so ?raw would be empty.
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const appCss = read('./App.css')
const indexCss = read('./index.css')

const toMs = (value: string, unit: string) => Number(value) * (unit === 's' ? 1000 : 1)

describe('heatmap tokens', () => {
  const light = indexCss.indexOf('@media (prefers-color-scheme: light)')

  it('defines --heat-1 to --heat-4 in the dark theme and again in the light theme', () => {
    expect(light).toBeGreaterThan(0)
    for (const level of [1, 2, 3, 4]) {
      expect(indexCss.slice(0, light)).toMatch(new RegExp(`--heat-${level}:`))
      expect(indexCss.slice(light)).toMatch(new RegExp(`--heat-${level}:`))
    }
  })

  it('builds the steps from the accent over a surface and uses them for the heat cells', () => {
    expect(indexCss.match(/--heat-[123]: color-mix\(in srgb, var\(--primary\) \d+%, var\(--surface-2\)\)/g)).toHaveLength(6)
    for (const level of [1, 2, 3, 4]) expect(appCss).toContain(`var(--heat-${level})`)
  })
})

describe('plate blocks', () => {
  const rule = (selector: string) => appCss.match(new RegExp(`^${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? ''

  it('wraps the plate row so heavy loads never overflow a narrow card', () => {
    expect(rule('.plate-row')).toContain('flex-wrap: wrap')
  })

  it('gives every plate block one uniform width, with only the Bar block wider', () => {
    expect(rule('.plate-block')).toMatch(/(^|[\s;])width: 46px/)
    expect(rule('.plate-block')).not.toContain('min-width')
    expect(rule('.plate-block.is-bar')).toContain('width: auto')
    expect(rule('.plate-block.is-bar')).toContain('min-width: 64px')
    expect(appCss.match(/\.plate-block[^{]*\{[^}]*(?<![-\w])width:\s*\d/g)).toHaveLength(1)
  })

  it('keeps orange (--primary) out of every .plate-* rule', () => {
    const plateRules = [...appCss.matchAll(/^[^\n{]*\.plate-[^\n{]*\{[^}]*\}/gm)].map(([text]) => text)
    expect(plateRules.length).toBeGreaterThanOrEqual(4)
    for (const text of plateRules) expect(text).not.toContain('var(--primary)')
  })
})

describe('motion tokens', () => {
  it('keeps every --duration-* token at 500ms or less', () => {
    const tokens = [...indexCss.matchAll(/--duration-[\w-]+:\s*([\d.]+)(ms|s)\b/g)]
    expect(tokens.length).toBeGreaterThanOrEqual(4)
    for (const [, value, unit] of tokens) expect(toMs(value, unit)).toBeLessThanOrEqual(500)
  })

  it('has no infinite animations', () => {
    expect(`${indexCss}${appCss}`).not.toMatch(/\binfinite\b/)
  })

  it('uses tokens, not literal durations, in App.css transitions and animations', () => {
    const declarations = [...appCss.matchAll(/(?:^|[;{\s])(transition|animation)(?:-duration)?\s*:([^;}]*)/g)]
    expect(declarations.length).toBeGreaterThan(0)
    for (const [, , value] of declarations) expect(value).not.toMatch(/(?<![\w-])\d*\.?\d+m?s\b/)
  })
})
