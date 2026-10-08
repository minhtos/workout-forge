import { describe, expect, it } from 'vitest'
import { deloadLoad, getWeekTarget, lengthLabel, lengthOf, lengthOptions, shapeOf, totalWeeks, type ProgramDurationWeeks } from './progression'

const schedule = (weeks: ProgramDurationWeeks) => Array.from({ length: totalWeeks(weeks) }, (_, index) => { const target = getWeekTarget(weeks, index + 1); return target.kind === 'deload' ? 'deload' : target.targetRir })

describe('RIR block schedules', () => {
  it('offers 4, 6, 8 and 12 week programs', () => expect(lengthOptions).toEqual([4, 6, 8, 12]))
  it('8 weeks: 3, 3, 2, 2, 1, 1, 0, 0 then a deload', () => {
    expect(schedule(8)).toEqual([3, 3, 2, 2, 1, 1, 0, 0, 'deload'])
    expect(totalWeeks(8)).toBe(9)
  })
  it('12 weeks is two 6-week parts, each with its own deload', () => {
    expect(shapeOf(12)).toEqual({ durationWeeks: 6, parts: 2 })
    expect(shapeOf(8)).toEqual({ durationWeeks: 8, parts: 1 })
    expect(lengthOf({ durationWeeks: 6, parts: 2 })).toBe(12)
    expect(lengthOf({ durationWeeks: 6 })).toBe(6)
    expect(lengthLabel(12)).toBe('12 weeks (2 × 6, each with a deload)')
    expect(lengthLabel(8)).toBe('8 weeks + deload')
  })
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
