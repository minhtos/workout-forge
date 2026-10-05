import { describe, expect, it } from 'vitest'
import { adjustRepsForWeightEdit, brzyckiOneRepMax, historicalOneRepMax, repCeiling, repNotice, repsForWeight, repsToFailure } from './repAdjust'
import type { CompletedSetRecord, SetEntry } from './storage'

const set = (index: number, weight: number, reps: number, patch: Partial<CompletedSetRecord> = {}): CompletedSetRecord => ({ id: `s-${index}`, sessionId: 'prev', workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: index, weight, reps, rir: 0, weightUnit: 'lb', completedAt: `2026-09-28T10:0${index}:00.000Z`, weekNumber: 4, repRange: { min: 6, max: 10 }, targetRir: 0, targetReps: reps, ...patch })

describe('the maths', () => {
  it('estimates a one-rep max with Brzycki and inverts it', () => {
    const oneRepMax = brzyckiOneRepMax(200, 6)!
    expect(oneRepMax).toBeCloseTo(232.26, 2)
    expect(repsToFailure(200, oneRepMax)).toBeCloseTo(6, 6)
    expect(repsToFailure(oneRepMax, oneRepMax)).toBeCloseTo(1, 6)
    expect(repsToFailure(190, oneRepMax)).toBeCloseTo(7.55, 2)
  })

  it('has no estimate for impossible inputs', () => {
    expect(brzyckiOneRepMax(0, 5)).toBeNull()
    expect(brzyckiOneRepMax(100, 0)).toBeNull()
    expect(brzyckiOneRepMax(100, 37)).toBeNull()
  })
})

describe('your historical one-rep max', () => {
  it('takes the best estimate from the session, counting the reps you left in reserve', () => {
    expect(historicalOneRepMax([set(1, 200, 6), set(2, 195, 6), set(3, 190, 5)])).toBeCloseTo(232.26, 2)
    expect(historicalOneRepMax([set(1, 200, 6, { targetRir: 3 })])).toBeCloseTo(257.14, 2)
  })

  it('treats a set that missed its reps as taken to failure', () => {
    expect(historicalOneRepMax([set(1, 200, 5, { targetRir: 3, targetReps: 8 })])).toBeCloseTo(brzyckiOneRepMax(200, 5)!, 6)
  })

  it('is null with no usable sets', () => {
    expect(historicalOneRepMax([])).toBeNull()
    expect(historicalOneRepMax([set(1, 0, 10)])).toBeNull()
  })
})

describe('reps for a new weight', () => {
  const oneRepMax = brzyckiOneRepMax(200, 6)!

  it('keeps the planned RIR: reps to failure at that weight minus the target RIR, rounded', () => {
    expect(repsForWeight({ weight: 190, oneRepMax, targetRir: 0 })).toEqual({ reps: 8, limit: null })
    expect(repsForWeight({ weight: 190, oneRepMax, targetRir: 2 })).toEqual({ reps: 6, limit: null })
    expect(repsForWeight({ weight: 200, oneRepMax, targetRir: 0 })).toEqual({ reps: 6, limit: null })
  })

  it('asks for fewer reps at a heavier weight and more at a lighter one', () => {
    const at = (weight: number) => repsForWeight({ weight, oneRepMax, targetRir: 1 }).reps
    expect(at(210)).toBeLessThan(at(200))
    expect(at(200)).toBeLessThan(at(180))
  })

  it('never goes below 1 rep or above the ceiling, and says which limit it hit', () => {
    expect(repsForWeight({ weight: 100, oneRepMax, targetRir: 0 })).toEqual({ reps: repCeiling, limit: 'max' })
    expect(repsForWeight({ weight: 250, oneRepMax, targetRir: 0 })).toEqual({ reps: 1, limit: 'min' })
    expect(repsForWeight({ weight: oneRepMax, oneRepMax, targetRir: 3 })).toEqual({ reps: 1, limit: 'min' })
    expect(repCeiling).toBe(15)
  })

  it('words the note: info normally, a gentle warning at a limit', () => {
    expect(repNotice('190', 8, null, 0)).toEqual({ kind: 'info', text: 'At 190 lb, about 8 reps takes you to failure.' })
    expect(repNotice('190', 6, null, 2)).toEqual({ kind: 'info', text: 'At 190 lb, about 6 reps leaves 2 in reserve.' })
    expect(repNotice('100', 15, 'max', 0)).toMatchObject({ kind: 'warn' })
    expect(repNotice('300', 1, 'min', 0)).toMatchObject({ kind: 'warn' })
  })
})

describe('adjusting a row after a weight edit', () => {
  const oneRepMax = brzyckiOneRepMax(200, 6)!
  const row = (weight: string, reps: string, complete = false): SetEntry => ({ weight, reps, rir: '3', complete, targetReps: Number(reps) })

  it('rescales the reps of rows whose weight changed, and moves their rep target with them', () => {
    const before = [row('200', '6'), row('200', '6'), row('200', '6')]
    const after = [row('190', '6'), row('190', '6'), row('200', '6')]
    const { entries, notice } = adjustRepsForWeightEdit(before, after, oneRepMax, 0)
    expect(entries.map((entry) => entry.reps)).toEqual(['8', '8', '6'])
    expect(entries[0].targetReps).toBe(8)
    expect(entries[2]).toBe(after[2])
    expect(notice).toEqual({ kind: 'info', text: 'At 190 lb, about 8 reps takes you to failure.' })
  })

  it('leaves finished sets, blank or zero weights, and unchanged rows alone', () => {
    const before = [row('200', '6', true), row('200', '6'), row('200', '6')]
    const after = [row('190', '6', true), row('', '6'), row('0', '6')]
    const { entries, notice } = adjustRepsForWeightEdit(before, after, oneRepMax, 0)
    expect(entries).toEqual(after)
    expect(notice).toBeNull()
  })

  it('does nothing without a one-rep max, such as the first time you do an exercise', () => {
    const before = [row('', '6')]
    const after = [row('135', '6')]
    expect(adjustRepsForWeightEdit(before, after, null, 3)).toEqual({ entries: after, notice: null })
  })

  it('flags a weight that hits a limit', () => {
    const result = adjustRepsForWeightEdit([row('200', '6')], [row('90', '6')], oneRepMax, 0)
    expect(result.entries[0].reps).toBe('15')
    expect(result.notice?.kind).toBe('warn')
  })
})
