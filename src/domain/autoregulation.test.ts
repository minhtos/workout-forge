import { describe, expect, it } from 'vitest'
import { feedbackFor, mergeFeedback, nextPrompt, resizeEntries, setOffset, stepWeight, tuneWorkoutSets, tunedPrefill, tunedSets, upsertFeedback, weightPercent, type SessionFeedback } from './autoregulation'
import { addExerciseToDay, createBlock, findWorkout, mergeCatalog, resolveWorkout, type Block } from './program'
import { applyWorkoutSet, findWorkoutSet } from './workoutSets'
import { buildInitialSets, suggestionText } from './session'
import type { CompletedSetRecord, SetEntry } from './storage'

const catalog = mergeCatalog([])
const BLOCK = '2026-10-05T10:00:00.000Z'
const fb = (patch: Partial<SessionFeedback> & Pick<SessionFeedback, 'sessionId' | 'at'>): SessionFeedback => ({ blockId: BLOCK, group: 'Chest', ...patch })

const chestBlock = (): Block => {
  let block = createBlock(2, 4)
  for (const day of [0, 1]) for (const id of ['barbell-bench-press', 'barbell-incline-bench-press', 'cable-pushdown']) block = addExerciseToDay(block, day, id)
  return { ...block, locked: true, startedAt: BLOCK }
}
const workoutFor = (block: Block, id: string) => resolveWorkout(block, findWorkout(block, id)!, catalog)

const done = (weight = '100'): SetEntry => ({ weight, reps: '8', rir: '3', complete: true })
const open = (weight = '100'): SetEntry => ({ weight, reps: '8', rir: '3', complete: false })

describe('soreness changes sets', () => {
  it('adds up within the current block only, and never past 3 either way', () => {
    const entries = [fb({ sessionId: 'a', at: '1', soreness: 'sore' }), fb({ sessionId: 'b', at: '2', soreness: 'sore' }), fb({ sessionId: 'c', at: '3', soreness: 'ontime' }), fb({ sessionId: 'd', at: '4', soreness: 'early', blockId: 'older block' })]
    expect(setOffset(entries, BLOCK, 'Chest')).toBe(-2)
    expect(setOffset(entries, BLOCK, 'Back')).toBe(0)
    expect(setOffset(entries, null, 'Chest')).toBe(0)
    const many = Array.from({ length: 6 }, (_, n) => fb({ sessionId: `s${n}`, at: String(n), soreness: 'early' }))
    expect(setOffset(many, BLOCK, 'Chest')).toBe(3)
  })

  it('keeps sets between 2 and 6 (or the planned count if it is outside that)', () => {
    expect(tunedSets(3, -1)).toBe(2)
    expect(tunedSets(3, -3)).toBe(2)
    expect(tunedSets(3, 1)).toBe(4)
    expect(tunedSets(3, 3)).toBe(6)
    expect(tunedSets(5, 3)).toBe(6)
    expect(tunedSets(1, -1)).toBe(1)
    expect(tunedSets(8, 0)).toBe(8)
  })

  it('tunes RIR work weeks only, never deloads or 5x5 blocks', () => {
    const block = chestBlock()
    const entries = [fb({ sessionId: 'a', at: '1', soreness: 'early' })]
    expect(tuneWorkoutSets(workoutFor(block, 'w1-d1'), entries, BLOCK).exercises.map((exercise) => exercise.sets)).toEqual([4, 4, 3 + 0])
    const deload = workoutFor(block, 'w5-d1')
    expect(deload.target.kind).toBe('deload')
    expect(tuneWorkoutSets(deload, entries, BLOCK).exercises.map((exercise) => exercise.sets)).toEqual([3, 3, 3])
    const strength = applyWorkoutSet(createBlock(3, 4), findWorkoutSet('strength-5x5')!)
    const linear = resolveWorkout(strength, findWorkout(strength, 'w1-d1')!, catalog)
    expect(tuneWorkoutSets(linear, [fb({ sessionId: 'a', at: '1', soreness: 'early', group: 'Quads' })], BLOCK)).toBe(linear)
  })

  it('resizes only the unfinished tail of an exercise', () => {
    expect(resizeEntries([open(), open(), open()], 2)).toHaveLength(2)
    expect(resizeEntries([done(), open(), open()], 1)).toHaveLength(1)
    expect(resizeEntries([done(), done(), open()], 1)).toHaveLength(2)
    const grown = resizeEntries([open('135'), open('135')], 4)
    expect(grown).toHaveLength(4)
    expect(grown[3]).toEqual({ weight: '135', reps: '8', rir: '3', complete: false })
  })
})

describe('effort changes weight', () => {
  it('maps easy, just right and too hard to 5-10%, 2.5% and 0%', () => {
    expect(weightPercent('easy', 0)).toBe(0.05)
    expect(weightPercent('easy', 2)).toBe(0.1)
    expect(weightPercent('right', 0)).toBe(0.025)
    expect(weightPercent('hard', 3)).toBe(0)
  })

  it('moves in 2.5 lb steps and always adds at least one step when increasing', () => {
    expect(stepWeight(135, 0.05)).toBe(142.5)
    expect(stepWeight(100, 0.025)).toBe(102.5)
    expect(stepWeight(40, 0.025)).toBe(42.5)
    expect(stepWeight(200, 0)).toBe(200)
  })
})

describe('pump changes reps, and the tuned prefill ties it together', () => {
  const exercise = resolveWorkout(chestBlock(), findWorkout(chestBlock(), 'w1-d1')!, catalog).exercises[0]
  const set = (reps: number, rir = 3): CompletedSetRecord => ({ id: `s-${reps}`, sessionId: 'prev', workoutId: 'w1-d1', exerciseId: exercise.id, exerciseName: exercise.name, setIndex: 1, weight: 100, reps, rir, weightUnit: 'lb', completedAt: '2026-10-05T10:05:00.000Z', weekNumber: 1, repRange: exercise.repRange, targetRir: 3 })
  const args = (feedback: SessionFeedback, reps = 8, rir = 3, all: SessionFeedback[] = [feedback]) => ({ exercise, base: set(reps, rir), last: [set(reps, rir)], fb: feedback, all, fallbackWeight: 100 })

  it('low pump adds a rep, two if the previous check was also low, high pump adds none', () => {
    const low = fb({ sessionId: 'prev', at: '2', effort: 'hard', pump: 'low', summaryDone: true })
    expect(tunedPrefill(args(low))).toMatchObject({ weight: 100, reps: 9 })
    const earlier = fb({ sessionId: 'old', at: '1', pump: 'low', summaryDone: true })
    expect(tunedPrefill(args(low, 8, 3, [earlier, low]))).toMatchObject({ reps: 10 })
    expect(tunedPrefill(args(fb({ sessionId: 'prev', at: '2', effort: 'hard', pump: 'high', summaryDone: true })))).toMatchObject({ weight: 100, reps: 8 })
  })

  it('applies the effort percentage to weight, with the bigger jump when you clearly undershot effort', () => {
    expect(tunedPrefill(args(fb({ sessionId: 'prev', at: '2', effort: 'easy', pump: 'high' })))).toMatchObject({ weight: 105, reps: 8 })
    expect(tunedPrefill(args(fb({ sessionId: 'prev', at: '2', effort: 'easy', pump: 'high' }), 8, 5))).toMatchObject({ weight: 110 })
    expect(tunedPrefill(args(fb({ sessionId: 'prev', at: '2', effort: 'right', pump: 'high' })))).toMatchObject({ weight: 102.5 })
  })

  it('falls back to the normal RIR weight when effort was skipped', () => {
    expect(tunedPrefill({ ...args(fb({ sessionId: 'prev', at: '2', pump: 'low' })), fallbackWeight: 107.5 })).toMatchObject({ weight: 107.5, reps: 9 })
  })

  it('past the top of the rep range it adds weight and starts again at the bottom', () => {
    const result = tunedPrefill(args(fb({ sessionId: 'prev', at: '2', effort: 'hard', pump: 'low' }), exercise.repRange.max))
    expect(result).toMatchObject({ reps: exercise.repRange.min, weight: 102.5 })
    expect(result.note).toMatch(/Top of the rep range/)
  })
})

describe('feedback bookkeeping', () => {
  it('upserts one entry per session and muscle group', () => {
    const key = { sessionId: 's1', blockId: BLOCK, group: 'Chest' as const }
    let list = upsertFeedback([], key, { soreness: 'sore' }, '1')
    list = upsertFeedback(list, key, { effort: 'easy', summaryDone: true }, '2')
    expect(list).toHaveLength(1)
    expect(feedbackFor(list, 's1', 'Chest')).toMatchObject({ soreness: 'sore', effort: 'easy', summaryDone: true, at: '1' })
    expect(upsertFeedback(list, { ...key, group: 'Back' }, { soreness: 'early' }, '3')).toHaveLength(2)
  })

  it('merges two lists without duplicates, keeping the newer entry', () => {
    const a = [fb({ sessionId: 's1', at: '1', soreness: 'sore' })]
    const b = [fb({ sessionId: 's1', at: '2', soreness: 'early' }), fb({ sessionId: 's2', at: '3', group: 'Back' })]
    const merged = mergeFeedback(a, b)
    expect(merged).toHaveLength(2)
    expect(merged[0].soreness).toBe('early')
  })
})

describe('using feedback when building the next session', () => {
  const block = chestBlock()
  const prior = (weight: number, reps: number): CompletedSetRecord[] => ['barbell-bench-press', 'barbell-incline-bench-press'].flatMap((id) => [1, 2, 3].map((n) => ({ id: `prev-${id}-${n}`, sessionId: 'prev', workoutId: 'w1-d1', exerciseId: id, exerciseName: id, setIndex: n, weight, reps, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-10-05T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3 })))
  const week2 = workoutFor(block, 'w2-d1')
  const entries = [fb({ sessionId: 'prev', at: '2026-10-05T11:00:00.000Z', soreness: 'sore', effort: 'easy', pump: 'low', summaryDone: true })]

  it('applies the answers: fewer sets, more weight, more reps', () => {
    const sets = buildInitialSets(week2, prior(100, 8), 'now', { feedback: entries, blockId: BLOCK })
    expect(sets['barbell-bench-press']).toHaveLength(2)
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '105', reps: '9' })
    expect(sets['cable-pushdown']).toHaveLength(3)
  })

  it('without any answers it behaves exactly as before (the existing RIR rule: more in reserve than target adds 5 lb)', () => {
    const sets = buildInitialSets(week2, prior(100, 8), 'now', { feedback: [], blockId: BLOCK })
    expect(sets['barbell-bench-press']).toHaveLength(3)
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '105', reps: '8' })
    expect(buildInitialSets(week2, prior(100, 8), 'now')['barbell-bench-press'][0]).toMatchObject({ weight: '105', reps: '8' })
  })

  it('leaves the deload week alone: half weight, same reps, planned sets, even with feedback', () => {
    const sets = buildInitialSets(workoutFor(block, 'w5-d1'), prior(100, 8), 'now', { feedback: entries, blockId: BLOCK })
    expect(sets['barbell-bench-press']).toHaveLength(3)
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '50', reps: '8' })
  })

  it('explains the adjustment in the suggestion', () => {
    const bench = week2.exercises[0]
    const text = suggestionText(bench, week2, prior(100, 8).filter((set) => set.exerciseId === bench.id), { feedback: entries, blockId: BLOCK })
    expect(text).toMatch(/Aim for 105 lb × 9/)
    expect(text).toMatch(/easy: \+5% weight/)
    expect(text).toMatch(/Low pump: \+1 rep/)
  })
})

describe('when the questions appear', () => {
  const workout = workoutFor(chestBlock(), 'w2-d1')
  const sets = (progress: Record<string, SetEntry[]>) => ({ 'barbell-bench-press': [open(), open(), open()], 'barbell-incline-bench-press': [open(), open(), open()], 'cable-pushdown': [open(), open(), open()], ...progress })
  const ask = (progress: Record<string, SetEntry[]>, entries: SessionFeedback[] = [], extra: { trained?: boolean; finishing?: boolean } = {}) =>
    nextPrompt({ workout, sets: sets(progress), entries, trainedBefore: () => extra.trained ?? true, finishing: extra.finishing ?? false })

  it('asks nothing until the first exercise of a muscle group is finished', () => {
    expect(ask({})).toBeNull()
    expect(ask({ 'barbell-bench-press': [done(), done(), open()] })).toBeNull()
  })

  it('asks about soreness once the first exercise is done, but only if the muscle group was trained before', () => {
    const progress = { 'barbell-bench-press': [done(), done(), done()] }
    expect(ask(progress)).toEqual({ kind: 'soreness', group: 'Chest' })
    expect(ask(progress, [], { trained: false })).toBeNull()
    expect(ask(progress, [fb({ sessionId: 's', at: '1', soreness: 'ontime' })])).toBeNull()
  })

  it('asks effort and pump after the last exercise of the group, not before', () => {
    const answered = [fb({ sessionId: 's', at: '1', soreness: 'ontime' })]
    expect(ask({ 'barbell-bench-press': [done(), done(), done()], 'barbell-incline-bench-press': [done(), done(), open()] }, answered)).toBeNull()
    const all = { 'barbell-bench-press': [done(), done(), done()], 'barbell-incline-bench-press': [done(), done(), done()] }
    expect(ask(all, answered)).toEqual({ kind: 'summary', group: 'Chest' })
    expect(ask(all, [{ ...answered[0], summaryDone: true }])).toBeNull()
  })

  it('on a single-exercise group asks soreness first, then effort and pump', () => {
    const triceps = { 'cable-pushdown': [done(), done(), done()] }
    expect(ask(triceps)).toEqual({ kind: 'soreness', group: 'Triceps' })
    expect(ask(triceps, [fb({ sessionId: 's', at: '1', group: 'Triceps', soreness: 'early' })])).toEqual({ kind: 'summary', group: 'Triceps' })
  })

  it('when finishing, asks about groups that were started but not completed', () => {
    const partial = { 'barbell-bench-press': [done(), open(), open()] }
    expect(ask(partial)).toBeNull()
    expect(ask(partial, [], { finishing: true })).toEqual({ kind: 'summary', group: 'Chest' })
    expect(ask({}, [], { finishing: true })).toBeNull()
  })

  it('never asks in a deload week or in 5x5', () => {
    const deload = workoutFor(chestBlock(), 'w5-d1')
    expect(nextPrompt({ workout: deload, sets: { 'barbell-bench-press': [done(), done(), done()] }, entries: [], trainedBefore: () => true, finishing: true })).toBeNull()
    const strength = applyWorkoutSet(createBlock(3, 4), findWorkoutSet('strength-5x5')!)
    const linear = resolveWorkout(strength, findWorkout(strength, 'w1-d1')!, catalog)
    expect(nextPrompt({ workout: linear, sets: { 'barbell-squat': [done(), done(), done(), done(), done()] }, entries: [], trainedBefore: () => true, finishing: true })).toBeNull()
  })
})
