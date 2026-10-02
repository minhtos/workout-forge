import { describe, expect, it } from 'vitest'
import { getNextSetSuggestion, getWeekTarget } from './progression'

describe('progression cycle', () => {
  it('moves target RIR from 3 to 0 then uses a 50 percent load deload', () => {
    expect(getWeekTarget(1)).toEqual({ kind: 'work', targetRir: 3, targetRpe: 7 })
    expect(getWeekTarget(2)).toEqual({ kind: 'work', targetRir: 2, targetRpe: 8 })
    expect(getWeekTarget(3)).toEqual({ kind: 'work', targetRir: 1, targetRpe: 9 })
    expect(getWeekTarget(4)).toEqual({ kind: 'work', targetRir: 0, targetRpe: 10 })
    expect(getWeekTarget(5)).toEqual({ kind: 'deload', loadMultiplier: 0.5, targetRir: 3, targetRpe: 7 })
    expect(getWeekTarget(6)).toEqual({ kind: 'work', targetRir: 3, targetRpe: 7 })
  })

  it('prioritizes holding load when RPE exceeds target', () => {
    expect(getNextSetSuggestion({ weight: 185, reps: 8, rpe: 9, targetRpe: 8, repRange: { min: 6, max: 10 } })).toEqual({ weight: 185, reps: 8, reason: 'Hold weight — RPE exceeded target.' })
  })

  it('adds five pounds at the top of the rep range or when effort is below target', () => {
    expect(getNextSetSuggestion({ weight: 185, reps: 10, rpe: 8, targetRpe: 8, repRange: { min: 6, max: 10 } })).toEqual({ weight: 190, reps: 10, reason: 'Add 5 lb — top of rep range reached.' })
    expect(getNextSetSuggestion({ weight: 185, reps: 8, rpe: 7, targetRpe: 8, repRange: { min: 6, max: 10 } })).toEqual({ weight: 190, reps: 8, reason: 'Add 5 lb — effort was below target.' })
  })

  it('adds one rep when effort matches target below the rep ceiling', () => {
    expect(getNextSetSuggestion({ weight: 185, reps: 8, rpe: 8, targetRpe: 8, repRange: { min: 6, max: 10 } })).toEqual({ weight: 185, reps: 9, reason: 'Add 1 rep — target effort matched.' })
  })
})
