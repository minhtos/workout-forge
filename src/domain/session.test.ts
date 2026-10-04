import { describe, expect, it } from 'vitest'
import { addExerciseToDay, createBlock, findWorkout, mergeCatalog, resolveWorkout } from './program'
import { addSetEntry, applyEntryPatch, buildInitialSets, lastSessionSets, maxSetsPerExercise, parseEntry, removeLastSetEntry } from './session'
import type { CompletedSetRecord } from './storage'

const catalog = mergeCatalog([])
const block = addExerciseToDay(createBlock(2, 4), 0, 'barbell-bench-press')
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

  it('halves the load in the final deload week', () => {
    const history = [logged('a', 1, 135, 8, 0, '2026-10-01T10:00:00Z')]
    const deload = week(5)
    expect(deload.target.kind).toBe('deload')
    expect(buildInitialSets(deload, history, 'new')['barbell-bench-press'][0]).toMatchObject({ weight: '67.5', reps: '8', rir: '3' })
  })

  it('validates entries', () => {
    expect(parseEntry({ weight: '', reps: '8', rir: '2', complete: false })).toHaveProperty('error')
    expect(parseEntry({ weight: '0', reps: '8', rir: '0', complete: false })).toEqual({ weight: 0, reps: 8, rir: 0 })
    expect(parseEntry({ weight: '135', reps: '8', rir: '11', complete: false })).toHaveProperty('error')
  })

  it('copies set 1 weight to the later sets as you type, until a set is customized or completed', () => {
    const blank = { weight: '', reps: '6', rir: '3', complete: false }
    let entries = [blank, blank, blank]
    for (const typed of ['1', '13', '135']) entries = applyEntryPatch(entries, 0, { weight: typed })
    expect(entries.map((entry) => entry.weight)).toEqual(['135', '135', '135'])

    entries = applyEntryPatch(entries, 1, { weight: '145' })
    expect(entries.map((entry) => entry.weight)).toEqual(['135', '145', '135'])
    entries = applyEntryPatch(entries, 0, { weight: '140' })
    expect(entries.map((entry) => entry.weight)).toEqual(['140', '145', '140'])

    entries = [{ ...blank, weight: '140' }, { ...blank, weight: '140', complete: true }, { ...blank, weight: '140' }]
    expect(applyEntryPatch(entries, 0, { weight: '150' }).map((entry) => entry.weight)).toEqual(['150', '140', '150'])
  })

  it('only set 1 weight edits spread; reps and RIR stay per set', () => {
    const blank = { weight: '100', reps: '6', rir: '3', complete: false }
    expect(applyEntryPatch([blank, blank], 0, { reps: '8' }).map((entry) => entry.reps)).toEqual(['8', '6'])
    expect(applyEntryPatch([blank, blank], 1, { weight: '110' }).map((entry) => entry.weight)).toEqual(['100', '110'])
  })

  it('adds a set copying the previous set, up to a cap', () => {
    const start = [{ weight: '135', reps: '8', rir: '2', complete: true }]
    const grown = addSetEntry(start)
    expect(grown).toHaveLength(2)
    expect(grown[1]).toEqual({ weight: '135', reps: '8', rir: '2', complete: false })
    let many = start
    for (let index = 0; index < 20; index += 1) many = addSetEntry(many)
    expect(many).toHaveLength(maxSetsPerExercise)
  })

  it('removes only an unfinished last set and always keeps one set', () => {
    const done = { weight: '135', reps: '8', rir: '2', complete: true }
    const open = { ...done, complete: false }
    expect(removeLastSetEntry([done, open])).toEqual([done])
    expect(removeLastSetEntry([done, done])).toHaveLength(2)
    expect(removeLastSetEntry([open])).toHaveLength(1)
  })
})