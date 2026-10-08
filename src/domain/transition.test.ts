import { describe, expect, it } from 'vitest'
import type { SessionFeedback } from './autoregulation'
import { addExerciseToDay, createBlock, findWorkout, mergeCatalog, resolveWorkout } from './program'
import { buildInitialSets, lastSessionSets, suggestionText } from './session'
import type { CompletedSetRecord } from './storage'
import { awaitingNextPart, carryOverFor, estimateOneRepMax, previousBlockId, startNextPart, startingOffsets, startingWeight } from './transition'

const catalog = mergeCatalog([])
const OLD_BLOCK = '2026-09-01T09:00:00.000Z'
const NEW_BLOCK = '2026-10-05T09:00:00.000Z'

const record = (patch: Partial<CompletedSetRecord> & Pick<CompletedSetRecord, 'sessionId' | 'setIndex' | 'weight' | 'reps' | 'completedAt'>): CompletedSetRecord => ({
  id: `${patch.sessionId}-${patch.setIndex}`, workoutId: 'w4-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', rir: 0, weightUnit: 'lb', weekNumber: 4, repRange: { min: 6, max: 10 }, targetRir: 0, ...patch,
})
const failureWeek = [record({ sessionId: 'fail', setIndex: 1, weight: 200, reps: 6, completedAt: '2026-09-22T10:00:00.000Z' }), record({ sessionId: 'fail', setIndex: 2, weight: 195, reps: 6, completedAt: '2026-09-22T10:05:00.000Z' }), record({ sessionId: 'fail', setIndex: 3, weight: 190, reps: 5, completedAt: '2026-09-22T10:10:00.000Z' })]
const deloadWeek = [1, 2, 3].map((n) => record({ sessionId: 'deload', setIndex: n, weight: 100, reps: 6, completedAt: `2026-09-29T10:0${n}:00.000Z`, weekNumber: 5, targetRir: 3, deload: true }))
const effort = (effortValue: SessionFeedback['effort'], patch: Partial<SessionFeedback> = {}): SessionFeedback => ({ sessionId: 'fail', blockId: OLD_BLOCK, group: 'Chest', effort: effortValue, summaryDone: true, at: '2026-09-22T10:30:00.000Z', ...patch })

const newBlock = (offsets?: Record<string, number>) => {
  let block = createBlock(2, 4)
  for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
  return { ...block, locked: true, startedAt: NEW_BLOCK, startOffsets: offsets }
}
const week1 = (block = newBlock()) => resolveWorkout(block, findWorkout(block, 'w1-d1')!, catalog)
const bench = week1().exercises[0]

describe('the starting-weight maths', () => {
  it('estimates a one-rep max with Epley', () => {
    expect(estimateOneRepMax(200, 6)).toBe(240)
    expect(estimateOneRepMax(100, 0)).toBe(100)
  })

  it('scales it to the weight that leaves 3 in reserve at the target reps, rounded to 2.5 lb', () => {
    expect(startingWeight(200, 6, 6)).toBe(185)
    expect(startingWeight(200, 6, 8)).toBe(175)
    expect(startingWeight(0, 12, 10)).toBe(0)
  })
})

describe('carrying a 0 RIR week into the next block', () => {
  const carry = (last: CompletedSetRecord[], feedback: SessionFeedback[] = [], blockId: string | null = NEW_BLOCK, exercise = bench) => carryOverFor({ exercise, last, blockId, feedback })

  it('uses the heaviest set of the 0 RIR week and resets reps to the bottom of the range', () => {
    expect(carry(failureWeek)).toMatchObject({ weight: 185, reps: 6, fromWeight: 200, fromReps: 6, easy: false })
  })

  it('breaks a weight tie with the set that had more reps', () => {
    const tied = [record({ sessionId: 'fail', setIndex: 1, weight: 200, reps: 5, completedAt: '2026-09-22T10:00:00.000Z' }), record({ sessionId: 'fail', setIndex: 2, weight: 200, reps: 7, completedAt: '2026-09-22T10:05:00.000Z' })]
    expect(carry(tied)).toMatchObject({ fromWeight: 200, fromReps: 7 })
  })

  it('adds one weight step when that week was rated easy (5 lb, or 2.5 lb for dumbbells)', () => {
    expect(carry(failureWeek, [effort('easy')])).toMatchObject({ weight: 190, easy: true })
    expect(carry(failureWeek, [effort('right')])).toMatchObject({ weight: 185 })
    expect(carry(failureWeek, [effort('hard')])).toMatchObject({ weight: 185 })
    const dumbbell = { ...bench, name: 'Dumbbell Bench Press', id: 'dumbbell-bench' }
    expect(carry(failureWeek, [effort('easy')], NEW_BLOCK, dumbbell)).toMatchObject({ weight: 187.5 })
  })

  it('only applies to a session from before this block that was a 0 RIR session', () => {
    expect(carry(failureWeek, [], null)).toBeNull()
    expect(carry([], [])).toBeNull()
    expect(carry(failureWeek, [], '2026-09-01T00:00:00.000Z')).toBeNull()
    expect(carry(failureWeek.map((set) => ({ ...set, targetRir: 1 })))).toBeNull()
  })
})

describe('sets carried into the next block', () => {
  const entry = (sessionId: string, group: SessionFeedback['group'], soreness: SessionFeedback['soreness'], at: string, blockId = OLD_BLOCK, extra: Partial<SessionFeedback> = {}): SessionFeedback => ({ sessionId, blockId, group, soreness, at, ...extra })

  it('finds the previous block from the feedback', () => {
    const feedback = [entry('a', 'Chest', 'early', '2026-09-02T10:00:00.000Z'), entry('b', 'Chest', 'early', '2026-09-09T10:00:00.000Z'), entry('c', 'Chest', 'sore', '2026-10-06T10:00:00.000Z', NEW_BLOCK)]
    expect(previousBlockId(feedback, NEW_BLOCK)).toBe(OLD_BLOCK)
    expect(previousBlockId(feedback, OLD_BLOCK)).toBe(NEW_BLOCK)
    expect(previousBlockId([], NEW_BLOCK)).toBeNull()
  })

  it('carries last block\'s final extra sets minus one, never below the plan', () => {
    const feedback = [entry('a', 'Chest', 'early', '1'), entry('b', 'Chest', 'early', '2'), entry('c', 'Chest', 'early', '3'), entry('d', 'Back', 'early', '4'), entry('e', 'Quads', 'sore', '5'), entry('f', 'Biceps', 'ontime', '6')]
    expect(startingOffsets(feedback, OLD_BLOCK)).toEqual({ Chest: 2 })
    expect(startingOffsets(feedback, null)).toEqual({})
  })

  it('does not carry a set that was cancelled by "too hard"', () => {
    const feedback = [entry('a', 'Chest', 'early', '1', OLD_BLOCK, { effort: 'hard' }), entry('b', 'Chest', 'early', '2')]
    expect(startingOffsets(feedback, OLD_BLOCK)).toEqual({})
  })
})

describe('Week 1 of a new block', () => {
  const history = [...failureWeek, ...deloadWeek]

  it('never uses a deload session as the starting point', () => {
    expect(lastSessionSets(history, 'barbell-bench-press', 'now').map((set) => set.sessionId)).toEqual(['fail', 'fail', 'fail'])
  })

  it('starts from the 0 RIR week: formula weight, reps at the bottom of the range', () => {
    const sets = buildInitialSets(week1(), history, 'now', { feedback: [], blockId: NEW_BLOCK })['barbell-bench-press']
    expect(sets[0]).toMatchObject({ weight: '185', reps: '6', targetReps: 6 })
    expect(sets).toHaveLength(3)
    expect(sets.every((set) => set.weight === '185' && set.reps === '6')).toBe(true)
  })

  it('adds the carried sets and the easy step', () => {
    const sets = buildInitialSets(week1(newBlock({ Chest: 1 })), history, 'now', { feedback: [effort('easy')], blockId: NEW_BLOCK, startOffsets: { Chest: 1 } })['barbell-bench-press']
    expect(sets).toHaveLength(4)
    expect(sets[0].weight).toBe('190')
  })

  it('explains where the numbers came from', () => {
    const last = lastSessionSets(history, 'barbell-bench-press', 'now')
    const text = suggestionText(week1().exercises[0], week1(), last, { feedback: [effort('easy')], blockId: NEW_BLOCK })
    expect(text).toMatch(/Aim for 190 lb × 6/)
    expect(text).toMatch(/based on 200 lb × 6 at 0 RIR last block \(estimated max 240 lb\)/)
    expect(text).toMatch(/felt easy/)
  })

  it('later weeks of the new block progress from that block, not from the old one', () => {
    const block = newBlock()
    const week1Session = [1, 2, 3].map((n) => record({ sessionId: 'w1', setIndex: n, weight: 185, reps: 6, targetReps: 6, completedAt: '2026-10-06T10:00:00.000Z', weekNumber: 1, targetRir: 3, workoutId: 'w1-d1' }))
    const week2 = resolveWorkout(block, findWorkout(block, 'w2-d1')!, catalog)
    const sets = buildInitialSets(week2, [...history, ...week1Session], 'now', { feedback: [], blockId: NEW_BLOCK })['barbell-bench-press']
    expect(sets[0]).toMatchObject({ weight: '185', reps: '7' })
  })

  it('falls back to the normal rule when the old block never reached a 0 RIR session', () => {
    const early = [1, 2, 3].map((n) => record({ sessionId: 'early', setIndex: n, weight: 150, reps: 8, targetReps: 8, completedAt: '2026-09-10T10:00:00.000Z', weekNumber: 2, targetRir: 2 }))
    const sets = buildInitialSets(week1(), early, 'now', { feedback: [], blockId: NEW_BLOCK })['barbell-bench-press']
    expect(sets[0]).toMatchObject({ weight: '150', reps: '9' })
  })

  it('does not touch 5x5 blocks', () => {
    const strengthLast = [record({ sessionId: 'old', setIndex: 1, weight: 135, reps: 5, completedAt: '2026-09-22T10:00:00.000Z', targetRir: 2 })]
    expect(carryOverFor({ exercise: bench, last: strengthLast, blockId: NEW_BLOCK, feedback: [] })).toBeNull()
  })
})

describe('chained blocks (12 weeks = 2 × 6)', () => {
  const chained = () => {
    let block = createBlock(2, 6, 2)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
    return { ...block, locked: true, startedAt: OLD_BLOCK, completedIds: ['w1-d1', 'w1-d2'] }
  }

  it('starts at part 1 and waits for part 2 only once every workout of part 1 is done', () => {
    expect(chained().parts).toBe(2)
    expect(chained().part).toBe(1)
    expect(awaitingNextPart(chained(), false)).toBe(false)
    expect(awaitingNextPart(chained(), true)).toBe(true)
    expect(awaitingNextPart({ ...chained(), part: 2 }, true)).toBe(false)
    expect(awaitingNextPart(createBlock(2, 6), true)).toBe(false)
  })

  it('part 2 keeps the exercises, clears progress, restarts the clock and carries sets over minus one', () => {
    const feedback = [effort('right'), { ...effort(undefined, { sessionId: 's2' }), soreness: 'early' as const }, { ...effort(undefined, { sessionId: 's3' }), soreness: 'early' as const }]
    const next = startNextPart(chained(), feedback, NEW_BLOCK)
    expect(next).toMatchObject({ part: 2, parts: 2, durationWeeks: 6, locked: true, startedAt: NEW_BLOCK, completedIds: [], skippedIds: [] })
    expect(next.templates).toEqual(chained().templates)
    expect(next.startOffsets).toEqual({ Chest: 1 })
  })

  it('part 2 week 1 starts from the 0 RIR week of part 1, like any new block', () => {
    const next = startNextPart(chained(), [], NEW_BLOCK)
    const workout = resolveWorkout(next, findWorkout(next, 'w1-d1')!, catalog)
    const sets = buildInitialSets(workout, [...failureWeek, ...deloadWeek], 'new', { feedback: [], blockId: NEW_BLOCK })
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '185', reps: '6' })
  })
})
