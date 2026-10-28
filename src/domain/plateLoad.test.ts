import { describe, expect, it } from 'vitest'
import { plateGuide, plateLoad } from './plateGuide'

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
