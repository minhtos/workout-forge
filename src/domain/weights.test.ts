import { describe, expect, it } from 'vitest'
import { nextSetTarget } from './autoregulation'
import type { ExercisePrescription } from './program'
import type { CompletedSetRecord } from './storage'
import { deloadLoad } from './progression'
import { roundWeight } from './weights'

describe('roundWeight', () => {
  it('snaps to the nearest 2.5 lb', () => {
    expect(roundWeight(138.42)).toBe(137.5)
    expect(roundWeight(139)).toBe(140)
    expect(roundWeight(141.2)).toBe(140)
    expect(roundWeight(142)).toBe(142.5)
  })

  it('leaves loadable weights alone and never goes below zero', () => {
    expect(roundWeight(135)).toBe(135)
    expect(roundWeight(0)).toBe(0)
    expect(roundWeight(-3)).toBe(0)
  })
})

describe('prescribed weights stay on the grid', () => {
  const exercise = { id: 'x', name: 'Barbell Bench Press', repRange: { min: 6, max: 12 } } as unknown as ExercisePrescription
  const last = (weight: number): CompletedSetRecord[] => [{ weight, reps: 8, targetReps: 8 } as CompletedSetRecord]

  it('rounds an odd logged weight in the next target', () => {
    expect(nextSetTarget({ exercise, last: last(138.4), index: 0, all: [] }).weight % 2.5).toBe(0)
    expect(nextSetTarget({ exercise, last: last(138.4), index: 0, fb: { effort: 'easy' } as never, all: [] }).weight % 2.5).toBe(0)
  })

  it('rounds the deload load', () => {
    expect(deloadLoad(138.4, 0.5) % 2.5).toBe(0)
  })
})
