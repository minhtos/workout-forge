import { describe, expect, it } from 'vitest'
import { loadableTotal, plateGuide, plateLoad, plateSizes } from './plateGuide'

describe('plateLoad().exact', () => {
  it('is true when the plates make the requested weight', () => {
    expect(plateLoad(225)?.exact).toBe(true)
  })

  it('is false when the weight is unmakeable', () => {
    expect(plateLoad(99)?.exact).toBe(false)
  })

  it('is false below the bar even when rounding makes the numbers match, agreeing with the string', () => {
    expect(plateLoad(44.999)?.exact).toBe(false)
    expect(plateGuide(44.999)).toMatch(/, makes 45 lb$/)
  })
})

describe('plateLoad with an owned set', () => {
  it('finds loads that greedy would miss', () => {
    expect(plateLoad(145, 'lb', [45, 35, 25, 10])).toMatchObject({ plates: [25, 25], exact: true, total: 145 })
  })

  it('uses repeated plates when the heavy one alone does not fit', () => {
    expect(plateLoad(185, 'lb', [45, 35])?.plates).toEqual([35, 35])
    expect(plateLoad(255, 'lb', [45, 35])?.plates).toEqual([35, 35, 35])
  })

  it('loads without the 35s', () => {
    expect(plateLoad(115, 'lb', [45, 25, 10, 5, 2.5])?.plates).toEqual([25, 10])
    expect(plateLoad(205, 'lb', [45, 25, 10, 5, 2.5])?.plates).toEqual([45, 25, 10])
    expect(plateLoad(205)?.plates).toEqual([45, 35])
  })

  it('GOLDEN: the full plate list gives exactly the default result at every weight', () => {
    for (let w = 0.25; w <= 1000; w += 0.25) expect(plateLoad(w, 'lb', plateSizes.lb)).toEqual(plateLoad(w, 'lb'))
    for (let w = 0.25; w <= 500; w += 0.25) expect(plateLoad(w, 'kg', plateSizes.kg)).toEqual(plateLoad(w, 'kg'))
  })

  it('does not hang on an enormous weight and reports it inexact', () => {
    expect(plateLoad(1e9, 'lb', [45, 25])?.exact).toBe(false)
  })
})

describe('loadableTotal', () => {
  const noHalves = [45, 35, 25, 10, 5]

  it('snaps down or up to what the owned plates make, and to the bar at or below it', () => {
    expect(loadableTotal(140, 'down', noHalves)).toBe(135)
    expect(loadableTotal(140, 'up', noHalves)).toBe(145)
    expect(loadableTotal(130, 'down', [45])).toBe(45)
    expect(loadableTotal(130, 'up', [45])).toBe(135)
    for (const direction of ['up', 'down'] as const) {
      expect(loadableTotal(45, direction, noHalves)).toBe(45)
      expect(loadableTotal(20, direction, noHalves)).toBe(45)
    }
  })
})
