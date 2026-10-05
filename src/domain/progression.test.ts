import { describe, expect, it } from 'vitest'
import { deloadLoad, durationOptions, getWeekTarget, totalWeeks } from './progression'

const schedule = (weeks: 4 | 6) => Array.from({ length: totalWeeks(weeks) }, (_, index) => { const target = getWeekTarget(weeks, index + 1); return target.kind === 'deload' ? 'deload' : target.targetRir })

describe('RIR block schedules', () => {
  it('offers 4 and 6 week blocks only', () => expect(durationOptions).toEqual([4, 6]))
  it('4 weeks: 3, 2, 1, 0 then a deload', () => {
    expect(schedule(4)).toEqual([3, 2, 1, 0, 'deload'])
    expect(totalWeeks(4)).toBe(5)
  })
  it('6 weeks: 3, 2, 2, 1, 1, 0 then a deload', () => {
    expect(schedule(6)).toEqual([3, 2, 2, 1, 1, 0, 'deload'])
    expect(totalWeeks(6)).toBe(7)
  })
  it('deload runs at half load with 3 RIR', () => expect(getWeekTarget(4, 5)).toEqual({ kind: 'deload', loadMultiplier: 0.5, targetRir: 3 }))
  it('rejects weeks outside the block', () => expect(() => getWeekTarget(4, 6)).toThrow(RangeError))
  it('rounds deload loads to 2.5 lb', () => expect(deloadLoad(135, 0.5)).toBe(67.5))
})
