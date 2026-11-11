import { describe, expect, it } from 'vitest'
import { addExerciseToDay, createBlock, findWorkout, mergeCatalog, resolveWorkout } from './program'
import { addSetEntry, applyEntryPatch, buildInitialSets, lastSessionSets, maxSetsPerExercise, previousSessionSets, skippedSinceLast, suggestionText, parseEntry, removeLastSetEntry, type TuneContext } from './session'
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
    expect(sets[0]).toEqual({ weight: '', reps: '6', rir: '3', complete: false, targetReps: 6 })
  })

  it('prefills each set from the matching set last time, adding a rep when every set hit its target', () => {
    const history = [logged('a', 1, 100, 8, 3, '2026-10-01T10:00:00Z'), logged('a', 2, 100, 8, 1, '2026-10-01T10:05:00Z')]
    const sets = buildInitialSets(week(2), history, 'new')['barbell-bench-press']
    expect(sets[0]).toMatchObject({ weight: '100', reps: '9', rir: '2', targetReps: 9 })
    expect(sets[1]).toMatchObject({ weight: '100', reps: '9' })
    expect(sets[2]).toMatchObject({ weight: '100', reps: '9' })
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

describe('previousSessionSets', () => {
  it('is the session before the latest one, skipping deloads and the excluded session', () => {
    const history = [logged('a', 1, 100, 8, 3, '2026-10-01T10:00:00.000Z'), logged('b', 1, 100, 8, 3, '2026-10-03T10:00:00.000Z'), { ...logged('d', 1, 50, 8, 3, '2026-10-04T10:00:00.000Z'), deload: true }, logged('c', 1, 100, 8, 3, '2026-10-05T10:00:00.000Z')]
    expect(lastSessionSets(history, 'barbell-bench-press', 'c').map((set) => set.sessionId)).toEqual(['b'])
    expect(previousSessionSets(history, 'barbell-bench-press', 'c').map((set) => set.sessionId)).toEqual(['a'])
    expect(previousSessionSets(history, 'barbell-bench-press', '').map((set) => set.sessionId)).toEqual(['b'])
    expect(previousSessionSets(history.slice(0, 1), 'barbell-bench-press', '')).toEqual([])
  })
})

describe('skippedSinceLast', () => {
  const last = [logged('a', 1, 100, 8, 3, '2026-10-06T10:00:00.000Z')]
  const finished = (ids: string[], startedAt: string | null = null) => ({ ...block, completedIds: ids, startedAt })

  it('is true when a finished workout that schedules the exercise came after its last logged session', () => {
    expect(skippedSinceLast(finished(['w1-d1', 'w2-d1']), 'barbell-bench-press', last, 'w3-d1')).toBe(true)
  })

  it('is false when the in-between workout was never finished, is not between, or does not schedule the exercise', () => {
    expect(skippedSinceLast(finished(['w1-d1']), 'barbell-bench-press', last, 'w3-d1')).toBe(false)
    expect(skippedSinceLast(finished(['w1-d1', 'w2-d1']), 'barbell-bench-press', last, 'w2-d1')).toBe(false)
    expect(skippedSinceLast(finished(['w1-d1', 'w2-d1']), 'barbell-squat', last, 'w3-d1')).toBe(false)
    expect(skippedSinceLast(finished(['w1-d1', 'w2-d1']), 'barbell-bench-press', [], 'w3-d1')).toBe(false)
  })

  it('ignores sessions from an earlier block', () => {
    expect(skippedSinceLast(finished(['w1-d1', 'w2-d1'], '2026-10-20T00:00:00.000Z'), 'barbell-bench-press', last, 'w3-d1')).toBe(false)
  })

  it('adds a note to the suggestion only when it was skipped', () => {
    const exercise = week(3).exercises[0]
    expect(suggestionText(exercise, week(3), last, undefined, [], true)).toMatch(/You skipped this last time, so the target repeats\./)
    expect(suggestionText(exercise, week(3), last, undefined, [], false)).not.toMatch(/skipped/)
    expect(suggestionText(exercise, week(3), [], undefined, [], true)).not.toMatch(/skipped/)
  })
})

// Golden fixtures: the session prefills and suggestion texts of the default (no equipment inventory) path, frozen as literals.
const goldenIds = ['barbell-bench-press', 'dumbbell-incline-bench-press', 'lateral-raise', 'leg-press-machine'] as const
const goldenStart: Record<string, number> = { 'barbell-bench-press': 135, 'dumbbell-incline-bench-press': 25, 'lateral-raise': 15, 'leg-press-machine': 200 }
const goldenBase = goldenIds.reduce((acc, id) => addExerciseToDay(acc, 0, id), createBlock(2, 4))
const goldenBlock = { ...goldenBase, templates: goldenBase.templates.map((day) => ({ ...day, exercises: day.exercises.map((entry) => ({ ...entry, sets: 3 })) })) }
const linearBlock = { ...goldenBlock, progression: 'linear' as const, templates: goldenBlock.templates.map((day) => ({ ...day, exercises: day.exercises.map((entry) => ({ ...entry, sets: 5, reps: 5 })) })) }
const goldenWeek = (b: typeof goldenBlock, number: number) => resolveWorkout(b, findWorkout(b, `w${number}-d1`)!, catalog)
const groupOf = (id: string) => catalog.find((item) => item.id === id)!.category
const blockStart = '2026-11-01T00:00:00.000Z'

interface GoldenScenario { name: string; workout: ReturnType<typeof goldenWeek>; history: (id: string) => CompletedSetRecord[]; tune?: (id: string) => TuneContext }
const goldenSet = (id: string, sessionId: string, setIndex: number, weight: number, reps: number, targetReps: number, completedAt: string, targetRir: number): CompletedSetRecord =>
  ({ ...logged(sessionId, setIndex, weight, reps, 1, completedAt), id: `${id}-${sessionId}-${setIndex}`, exerciseId: id, exerciseName: catalog.find((item) => item.id === id)!.name, targetReps, targetRir })
const sessionOf = (id: string, sessionId: string, reps: number, targetReps: number, completedAt: string, sets = 3, targetRir = 3) =>
  Array.from({ length: sets }, (_, index) => goldenSet(id, sessionId, index + 1, goldenStart[id], reps, targetReps, completedAt, targetRir))
const feedbackTune = (effort: 'easy' | 'right', id: string): TuneContext => ({ blockId: '2026-09-01T00:00:00.000Z', feedback: [{ sessionId: 'a', blockId: '2026-09-01T00:00:00.000Z', group: groupOf(id), effort, at: '2026-10-01T11:00:00.000Z' }] })

const goldenScenarios: GoldenScenario[] = [
  { name: 'rir-easy', workout: goldenWeek(goldenBlock, 2), history: (id) => sessionOf(id, 'a', 10, 10, '2026-10-01T10:00:00.000Z'), tune: (id) => feedbackTune('easy', id) },
  { name: 'rir-right', workout: goldenWeek(goldenBlock, 2), history: (id) => sessionOf(id, 'a', 10, 10, '2026-10-01T10:00:00.000Z'), tune: (id) => feedbackTune('right', id) },
  { name: 'missed-all', workout: goldenWeek(goldenBlock, 2), history: (id) => sessionOf(id, 'a', 7, 10, '2026-10-01T10:00:00.000Z') },
  { name: 'stalled', workout: goldenWeek(goldenBlock, 3), history: (id) => [...sessionOf(id, 'a', 7, 10, '2026-10-01T10:00:00.000Z'), ...sessionOf(id, 'b', 8, 10, '2026-10-08T10:00:00.000Z')] },
  { name: 'linear-5x5', workout: goldenWeek(linearBlock, 2), history: (id) => sessionOf(id, 'a', 5, 5, '2026-10-01T10:00:00.000Z', 5) },
  { name: 'deload', workout: goldenWeek(goldenBlock, 5), history: (id) => sessionOf(id, 'a', 8, 8, '2026-10-01T10:00:00.000Z') },
  { name: 'carry-over', workout: goldenWeek(goldenBlock, 1), history: (id) => sessionOf(id, 'a', 6, 6, '2026-10-01T10:00:00.000Z', 3, 0), tune: (id) => ({ ...feedbackTune('easy', id), blockId: blockStart }) },
]

describe('golden: default-path session targets are frozen (equipment inventory plan, T28/T29)', () => {
  it('T28 buildInitialSets output', () => {
    const out: Record<string, unknown> = {}
    for (const scenario of goldenScenarios) {
      for (const id of goldenIds) {
        const workout = { ...scenario.workout, exercises: scenario.workout.exercises.filter((exercise) => exercise.id === id) }
        out[`${id}|${scenario.name}`] = buildInitialSets(workout, scenario.history(id), 'new', scenario.tune?.(id))[id]
      }
    }
    expect(out).toMatchInlineSnapshot(`
      {
        "barbell-bench-press|carry-over": [
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "130",
          },
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "130",
          },
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "130",
          },
        ],
        "barbell-bench-press|deload": [
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "67.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "67.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "67.5",
          },
        ],
        "barbell-bench-press|linear-5x5": [
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "140",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "140",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "140",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "140",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "140",
          },
        ],
        "barbell-bench-press|missed-all": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "130",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "130",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "130",
          },
        ],
        "barbell-bench-press|rir-easy": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "140",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "140",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "140",
          },
        ],
        "barbell-bench-press|rir-right": [
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "135",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "135",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "135",
          },
        ],
        "barbell-bench-press|stalled": [
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "122.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "122.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "122.5",
          },
        ],
        "dumbbell-incline-bench-press|carry-over": [
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "25",
          },
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "25",
          },
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "25",
          },
        ],
        "dumbbell-incline-bench-press|deload": [
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "12.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "12.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "12.5",
          },
        ],
        "dumbbell-incline-bench-press|linear-5x5": [
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "30",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "30",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "30",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "30",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "30",
          },
        ],
        "dumbbell-incline-bench-press|missed-all": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "22.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "22.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "22.5",
          },
        ],
        "dumbbell-incline-bench-press|rir-easy": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "27.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "27.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "27.5",
          },
        ],
        "dumbbell-incline-bench-press|rir-right": [
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "25",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "25",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "25",
          },
        ],
        "dumbbell-incline-bench-press|stalled": [
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "22.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "22.5",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "22.5",
          },
        ],
        "lateral-raise|carry-over": [
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "17.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "17.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "17.5",
          },
        ],
        "lateral-raise|deload": [
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "7.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "7.5",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "7.5",
          },
        ],
        "lateral-raise|linear-5x5": [
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "20",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "20",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "20",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "20",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "20",
          },
        ],
        "lateral-raise|missed-all": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "10",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "10",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "10",
          },
        ],
        "lateral-raise|rir-easy": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "20",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "20",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "20",
          },
        ],
        "lateral-raise|rir-right": [
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "15",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "15",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "15",
          },
        ],
        "lateral-raise|stalled": [
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "10",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "10",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "10",
          },
        ],
        "leg-press-machine|carry-over": [
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "190",
          },
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "190",
          },
          {
            "complete": false,
            "reps": "6",
            "rir": "3",
            "targetReps": 6,
            "weight": "190",
          },
        ],
        "leg-press-machine|deload": [
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "100",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "100",
          },
          {
            "complete": false,
            "reps": "8",
            "rir": "3",
            "targetReps": 8,
            "weight": "100",
          },
        ],
        "leg-press-machine|linear-5x5": [
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "205",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "205",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "205",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "205",
          },
          {
            "complete": false,
            "reps": "5",
            "rir": "2",
            "targetReps": 5,
            "weight": "205",
          },
        ],
        "leg-press-machine|missed-all": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "195",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "195",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "195",
          },
        ],
        "leg-press-machine|rir-easy": [
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "205",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "205",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "2",
            "targetReps": 10,
            "weight": "205",
          },
        ],
        "leg-press-machine|rir-right": [
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "200",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "200",
          },
          {
            "complete": false,
            "reps": "11",
            "rir": "2",
            "targetReps": 11,
            "weight": "200",
          },
        ],
        "leg-press-machine|stalled": [
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "180",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "180",
          },
          {
            "complete": false,
            "reps": "10",
            "rir": "1",
            "targetReps": 10,
            "weight": "180",
          },
        ],
      }
    `)
  })

  it('T29 suggestionText output', () => {
    const out: Record<string, string> = {}
    for (const scenario of goldenScenarios) {
      for (const id of goldenIds) {
        const history = scenario.history(id)
        const exercise = scenario.workout.exercises.find((item) => item.id === id)!
        out[`${id}|${scenario.name}`] = suggestionText(exercise, scenario.workout, lastSessionSets(history, id, 'new'), scenario.tune?.(id), previousSessionSets(history, id, 'new'), false)
      }
    }
    expect(out).toMatchInlineSnapshot(`
      {
        "barbell-bench-press|carry-over": "Aim for 130 lb × 6. New block: based on 135 lb × 6 at 0 RIR last block (estimated max 162 lb), plus a step because it felt easy.",
        "barbell-bench-press|deload": "Deload: 67.5 lb for 8 reps (half your last load).",
        "barbell-bench-press|linear-5x5": "Hit every rep last time. Add weight: 140 lb × 5.",
        "barbell-bench-press|missed-all": "Aim for 130 lb × 10. You missed reps on every set last time: weight drops 5 lb.",
        "barbell-bench-press|rir-easy": "Aim for 140 lb × 10. Last time was easy: +5 lb.",
        "barbell-bench-press|rir-right": "Aim for 135 lb × 11. Effort was just right: same weight, +1 rep.",
        "barbell-bench-press|stalled": "Aim for 122.5 lb × 10. Missed reps two sessions in a row: weight drops about 10% to clear fatigue, same reps.",
        "dumbbell-incline-bench-press|carry-over": "Aim for 25 lb × 6. New block: based on 25 lb × 6 at 0 RIR last block (estimated max 30 lb), plus a step because it felt easy.",
        "dumbbell-incline-bench-press|deload": "Deload: 12.5 lb for 8 reps (half your last load).",
        "dumbbell-incline-bench-press|linear-5x5": "Hit every rep last time. Add weight: 30 lb × 5.",
        "dumbbell-incline-bench-press|missed-all": "Aim for 22.5 lb × 10. You missed reps on every set last time: weight drops 2.5 lb.",
        "dumbbell-incline-bench-press|rir-easy": "Aim for 27.5 lb × 10. Last time was easy: +2.5 lb.",
        "dumbbell-incline-bench-press|rir-right": "Aim for 25 lb × 11. Effort was just right: same weight, +1 rep.",
        "dumbbell-incline-bench-press|stalled": "Aim for 22.5 lb × 10. Missed reps two sessions in a row: weight drops about 10% to clear fatigue, same reps.",
        "lateral-raise|carry-over": "Aim for 17.5 lb × 8. New block: based on 15 lb × 6 at 0 RIR last block (estimated max 18 lb), plus a step because it felt easy.",
        "lateral-raise|deload": "Deload: 7.5 lb for 8 reps (half your last load).",
        "lateral-raise|linear-5x5": "Hit every rep last time. Add weight: 20 lb × 5.",
        "lateral-raise|missed-all": "Aim for 10 lb × 10. You missed reps on every set last time: weight drops 5 lb.",
        "lateral-raise|rir-easy": "Aim for 20 lb × 10. Last time was easy: +5 lb.",
        "lateral-raise|rir-right": "Aim for 15 lb × 11. Effort was just right: same weight, +1 rep.",
        "lateral-raise|stalled": "Aim for 10 lb × 10. Missed reps two sessions in a row: weight drops about 10% to clear fatigue, same reps.",
        "leg-press-machine|carry-over": "Aim for 190 lb × 6. New block: based on 200 lb × 6 at 0 RIR last block (estimated max 240 lb), plus a step because it felt easy.",
        "leg-press-machine|deload": "Deload: 100 lb for 8 reps (half your last load).",
        "leg-press-machine|linear-5x5": "Hit every rep last time. Add weight: 205 lb × 5.",
        "leg-press-machine|missed-all": "Aim for 195 lb × 10. You missed reps on every set last time: weight drops 5 lb.",
        "leg-press-machine|rir-easy": "Aim for 205 lb × 10. Last time was easy: +5 lb.",
        "leg-press-machine|rir-right": "Aim for 200 lb × 11. Effort was just right: same weight, +1 rep.",
        "leg-press-machine|stalled": "Aim for 180 lb × 10. Missed reps two sessions in a row: weight drops about 10% to clear fatigue, same reps.",
      }
    `)
  })
})
