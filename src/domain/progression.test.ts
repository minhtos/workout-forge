import { describe, expect, it } from 'vitest'
import { getNextSetSuggestion, getWeekTarget } from './progression'

describe('RIR progression cycle', () => {
  it('moves target RIR from 3 to 0 then deloads', () => {
    expect(getWeekTarget(1)).toEqual({ kind: 'work', targetRir: 3 })
    expect(getWeekTarget(2)).toEqual({ kind: 'work', targetRir: 2 })
    expect(getWeekTarget(3)).toEqual({ kind: 'work', targetRir: 1 })
    expect(getWeekTarget(4)).toEqual({ kind: 'work', targetRir: 0 })
    expect(getWeekTarget(5)).toEqual({ kind: 'deload', loadMultiplier: 0.5, targetRir: 3 })
  })
  it('holds weight when fewer reps remain than targeted', () => expect(getNextSetSuggestion({ weight: 185, reps: 8, rir: 1, targetRir: 2, repRange: { min: 6, max: 10 } }).weight).toBe(185))
  it('adds weight when more reps remain than targeted', () => expect(getNextSetSuggestion({ weight: 185, reps: 8, rir: 3, targetRir: 2, repRange: { min: 6, max: 10 } }).weight).toBe(190))
  it('adds one rep when target RIR is matched', () => expect(getNextSetSuggestion({ weight: 185, reps: 8, rir: 2, targetRir: 2, repRange: { min: 6, max: 10 } }).reps).toBe(9))
})
