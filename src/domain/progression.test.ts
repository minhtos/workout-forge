import { describe, expect, it } from 'vitest'
import { deloadLoad, durationOptions, getNextSetSuggestion, getWeekTarget } from './progression'

const rirs = (weeks: 4 | 5 | 6) => Array.from({ length: weeks }, (_, index) => { const target = getWeekTarget(weeks, index + 1); return target.kind === 'deload' ? 'deload' : target.targetRir })

describe('RIR block schedules', () => {
  it('offers 4, 5 and 6 week blocks', () => expect(durationOptions).toEqual([4, 5, 6]))
  it('4 weeks: 3, 2, 1, 0 with no deload', () => expect(rirs(4)).toEqual([3, 2, 1, 0]))
  it('5 weeks: 3, 2, 1, 0 then a deload', () => {
    expect(rirs(5)).toEqual([3, 2, 1, 0, 'deload'])
    expect(getWeekTarget(5, 5)).toEqual({ kind: 'deload', loadMultiplier: 0.5, targetRir: 3 })
  })
  it('6 weeks: 3, 3, 2, 2, 1, 0 with no deload', () => expect(rirs(6)).toEqual([3, 3, 2, 2, 1, 0]))
  it('rejects weeks outside the block', () => expect(() => getWeekTarget(4, 5)).toThrow(RangeError))
  it('rounds deload loads to 2.5 lb', () => expect(deloadLoad(135, 0.5)).toBe(67.5))
})

describe('set progression', () => {
  it('holds weight when fewer reps remain than targeted', () => expect(getNextSetSuggestion({ weight: 185, reps: 8, rir: 1, targetRir: 2, repRange: { min: 6, max: 10 } }).weight).toBe(185))
  it('adds weight when more reps remain than targeted', () => expect(getNextSetSuggestion({ weight: 185, reps: 8, rir: 3, targetRir: 2, repRange: { min: 6, max: 10 } }).weight).toBe(190))
  it('adds one rep when target RIR is matched', () => expect(getNextSetSuggestion({ weight: 185, reps: 8, rir: 2, targetRir: 2, repRange: { min: 6, max: 10 } }).reps).toBe(9))
  it('adds weight and drops back to the bottom of the range at the top of the range', () => expect(getNextSetSuggestion({ weight: 185, reps: 10, rir: 2, targetRir: 2, repRange: { min: 6, max: 10 } })).toMatchObject({ weight: 190, reps: 6 }))
})
