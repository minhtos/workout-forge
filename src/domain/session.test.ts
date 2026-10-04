import { describe, expect, it } from 'vitest'
import { autoFillPlan, createBlock, findWorkout, mergeCatalog, resolveWorkout } from './program'
import { buildInitialSets, lastSessionSets, parseEntry } from './session'
import type { CompletedSetRecord } from './storage'

const catalog = mergeCatalog([])
const block = autoFillPlan(createBlock(3, 5), catalog)
const week = (number: number) => resolveWorkout(block, findWorkout(block, `w${number}-d1`)!, catalog)
const logged = (sessionId: string, setIndex: number, weight: number, reps: number, rir: number, completedAt: string): CompletedSetRecord => ({ id: `${sessionId}-${setIndex}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex, weight, reps, rir, weightUnit: 'lb', completedAt, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3 })

describe('session helpers', () => {
  it('finds the most recent earlier session for an exercise and ignores the current one', () => {
    const history = [logged('a', 1, 100, 8, 3, '2026-10-01T10:00:00Z'), logged('b', 1, 105, 8, 3, '2026-10-08T10:00:00Z'), logged('b', 2, 105, 7, 2, '2026-10-08T10:05:00Z'), logged('c', 1, 110, 8, 3, '2026-10-15T10:00:00Z')]
    expect(lastSessionSets(history, 'barbell-bench-press', 'c').map((entry) => entry.weight)).toEqual([105, 105])
  })

  it('starts empty on first exposure, asking for a weight', () => {
    const sets = buildInitialSets(week(1), [], 'new')['barbell-bench-press']
    expect(sets).toHaveLength(3)
    expect(sets[0]).toEqual({ weight: '', reps: '6', rir: '3', complete: false })
  })

  it('prefills each set from the matching set last time using the progression rule', () => {
    const history = [logged('a', 1, 100, 8, 3, '2026-10-01T10:00:00Z'), logged('a', 2, 100, 8, 1, '2026-10-01T10:05:00Z')]
    const sets = buildInitialSets(week(2), history, 'new')['barbell-bench-press']
    expect(sets[0]).toMatchObject({ weight: '105', reps: '8', rir: '2' })
    expect(sets[1]).toMatchObject({ weight: '100', reps: '8' })
    expect(sets[2]).toMatchObject({ weight: '100', reps: '8' })
  })

  it('halves the load in a deload week', () => {
    const history = [logged('a', 1, 135, 8, 0, '2026-10-01T10:00:00Z')]
    expect(buildInitialSets(week(5), history, 'new')['barbell-bench-press'][0]).toMatchObject({ weight: '67.5', reps: '8', rir: '3' })
  })

  it('validates entries', () => {
    expect(parseEntry({ weight: '', reps: '8', rir: '2', complete: false })).toHaveProperty('error')
    expect(parseEntry({ weight: '0', reps: '8', rir: '0', complete: false })).toEqual({ weight: 0, reps: 8, rir: 0 })
    expect(parseEntry({ weight: '135', reps: '8', rir: '11', complete: false })).toHaveProperty('error')
  })
})
