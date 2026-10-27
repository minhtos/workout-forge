import { describe, expect, it } from 'vitest'
import { addExerciseToDay, createBlock, mergeCatalog, setExerciseSets, type Block } from './program'
import { muscleMapView, muscleVolume, planTargets } from './muscleVolume'
import { set } from './testSets'
import { completedSessions } from './weekly'

const catalog = mergeCatalog([])
const NOW = new Date(2026, 9, 14, 12) // Wednesday 14 Oct 2026; the week began Sunday 11 Oct
const THIS_WEEK = new Date(2026, 9, 11)
const bench = { exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press' }
const row = { exerciseId: 'barbell-row', exerciseName: 'Barbell Row' }

describe('muscleVolume', () => {
  const history = [
    set('a', 1, new Date(2026, 9, 12, 9), { ...bench, weight: 100, reps: 10 }), set('a', 2, new Date(2026, 9, 12, 9, 5), { ...bench, weight: 100, reps: 8 }),
    set('a', 3, new Date(2026, 9, 12, 9, 10), { ...row, weight: 80, reps: 10 }),
    set('old', 1, new Date(2026, 9, 6), { ...bench }),
  ]

  it('groups sets by the exercise category and adds up volume (weight × reps)', () => {
    const data = muscleVolume(completedSessions(history, null), catalog, THIS_WEEK)
    expect(data.rows.map((entry) => [entry.group, entry.sets, entry.volume])).toEqual([['Chest', 2, 1800], ['Back', 1, 800]])
    expect(data.maxSets).toBe(2)
    expect(data.workouts).toBe(1)
    expect(data.rows.every((entry) => entry.target === null)).toBe(true)
  })

  it('counts deload sets', () => {
    const deload = [set('d', 1, new Date(2026, 9, 12), { ...bench, deload: true, weight: 50, reps: 10 })]
    expect(muscleVolume(completedSessions(deload, null), catalog, THIS_WEEK).rows[0]).toMatchObject({ group: 'Chest', sets: 1, volume: 500 })
  })

  it('counts a set for a missing exercise toward the totals but gives it no row', () => {
    const gone = [...history, set('a', 4, new Date(2026, 9, 12, 9, 15), { exerciseId: 'custom-gone', exerciseName: 'Gone', weight: 10, reps: 10 })]
    const data = muscleVolume(completedSessions(gone, null), catalog, THIS_WEEK)
    expect(data.rows.map((entry) => entry.group)).toEqual(['Chest', 'Back'])
    expect(data.totalSets).toBe(4)
    expect(data.totalVolume).toBe(1800 + 800 + 100)
  })

  it('leaves the session in progress out', () => {
    const data = muscleVolume(completedSessions(history, 'a'), catalog, THIS_WEEK)
    expect(data.rows).toEqual([])
  })

  it('shows groups that have a target even with no sets, and carries the target on every row', () => {
    const data = muscleVolume(completedSessions(history, null), catalog, THIS_WEEK, { Chest: 6, Quads: 4 })
    expect(data.rows.map((entry) => [entry.group, entry.sets, entry.target])).toEqual([['Chest', 2, 6], ['Back', 1, 0], ['Quads', 0, 4]])
  })

  it('orders by sets, ties in library order', () => {
    const tie = [set('t', 1, new Date(2026, 9, 12), { ...row }), set('t', 2, new Date(2026, 9, 12), { ...bench })]
    expect(muscleVolume(completedSessions(tie, null), catalog, THIS_WEEK).rows.map((entry) => entry.group)).toEqual(['Chest', 'Back'])
  })
})

describe('muscleMapView', () => {
  const lastWeek = [set('l', 1, new Date(2026, 9, 6), { ...bench })]

  it('shows this week when it has sets, with the targets', () => {
    const view = muscleMapView(completedSessions([...lastWeek, set('t', 1, new Date(2026, 9, 12), { ...row })], null), catalog, NOW, { Back: 3 })
    expect(view.kind).toBe('this')
    expect(view.kind === 'this' && view.data.rows.map((entry) => [entry.group, entry.target])).toEqual([['Back', 3]])
  })

  it('falls back to last week, without targets, while this week is empty', () => {
    const view = muscleMapView(completedSessions(lastWeek, null), catalog, NOW, { Chest: 9 })
    expect(view.kind).toBe('last')
    expect(view.kind === 'last' && view.data.rows.map((entry) => [entry.group, entry.sets, entry.target])).toEqual([['Chest', 1, null]])
  })

  it('is empty with no history at all', () => {
    expect(muscleMapView([], catalog, NOW, null)).toEqual({ kind: 'empty', first: true })
  })

  it('is empty, but not a first-timer, when the only history is older than last week', () => {
    expect(muscleMapView(completedSessions([set('o', 1, new Date(2026, 8, 1), { ...bench })], null), catalog, NOW, null)).toEqual({ kind: 'empty', first: false })
  })

  it('does not count an in-progress session as this week having data', () => {
    const view = muscleMapView(completedSessions([...lastWeek, set('live', 1, new Date(2026, 9, 13), { ...row })], 'live'), catalog, NOW, null)
    expect(view.kind).toBe('last')
  })
})

describe('planTargets', () => {
  const day = (block: Block, dayIndex: number, ids: [string, number][]) => ids.reduce((current, [id, sets]) => setExerciseSets(addExerciseToDay(current, dayIndex, id), dayIndex, current.templates[dayIndex].exercises.length, sets), block)
  const locked = (block: Block): Block => ({ ...block, locked: true, startedAt: '2026-10-01T00:00:00.000Z' })
  const plan = locked(day(day(createBlock(2, 4), 0, [['barbell-bench-press', 4], ['barbell-row', 3]]), 1, [['barbell-bench-press', 2], ['barbell-squat', 5]]))

  it('adds up template sets per muscle group over the training days', () => {
    expect(planTargets(plan, catalog)).toEqual({ Chest: 6, Back: 3, Quads: 5 })
  })

  it('is null with no block, an unlocked block, a finished block or a deload week', () => {
    expect(planTargets(null, catalog)).toBeNull()
    expect(planTargets({ ...plan, locked: false }, catalog)).toBeNull()
    expect(planTargets({ ...plan, completedIds: ['w1-d1', 'w1-d2', 'w2-d1', 'w2-d2', 'w3-d1', 'w3-d2', 'w4-d1', 'w4-d2', 'w5-d1', 'w5-d2'] }, catalog)).toBeNull()
    expect(planTargets({ ...plan, completedIds: ['w1-d1', 'w1-d2', 'w2-d1', 'w2-d2', 'w3-d1', 'w3-d2', 'w4-d1', 'w4-d2'] }, catalog)).toBeNull()
  })

  it('follows the rotation: alternating templates give different weeks different targets', () => {
    const rotating: Block = { ...plan, trainingDays: 3, rotation: true, templates: plan.templates }
    // Week 1 runs A, B, A; week 2 runs B, A, B.
    expect(planTargets(rotating, catalog)).toEqual({ Chest: 4 + 2 + 4, Back: 3 + 3, Quads: 5 })
    const weekTwo = { ...rotating, completedIds: ['w1-d1', 'w1-d2', 'w1-d3'] }
    expect(planTargets(weekTwo, catalog)).toEqual({ Chest: 2 + 4 + 2, Back: 3, Quads: 5 + 5 })
  })
})
