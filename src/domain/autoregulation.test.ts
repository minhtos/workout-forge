import { describe, expect, it } from 'vitest'
import { feedbackFor, isStalled, mergeFeedback, missedReps, nextPrompt, nextSetTarget, resizeEntries, setOffset, tuneWorkoutSets, tunedSets, upsertFeedback, weightIncrement, type SessionFeedback } from './autoregulation'
import { addExerciseToDay, createBlock, findWorkout, mergeCatalog, resolveWorkout, type Block } from './program'
import { applyWorkoutSet, findWorkoutSet } from './workoutSets'
import { buildInitialSets, describeLastSession, suggestionText } from './session'
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

  it('adds a set to every exercise in the muscle group, and leaves other groups alone', () => {
    const block = chestBlock()
    const entries = [fb({ sessionId: 'a', at: '1', soreness: 'early' })]
    expect(tuneWorkoutSets(workoutFor(block, 'w1-d1'), entries, BLOCK).exercises.map((exercise) => exercise.sets)).toEqual([4, 4, 3])
  })

  it('tunes RIR work weeks only, never deloads or 5x5 blocks', () => {
    const block = chestBlock()
    const entries = [fb({ sessionId: 'a', at: '1', soreness: 'early' })]
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
    const grown = resizeEntries([{ ...open('135'), targetReps: 8 }, { ...open('135'), targetReps: 8 }], 4)
    expect(grown).toHaveLength(4)
    expect(grown[3]).toEqual({ weight: '135', reps: '8', rir: '3', complete: false, targetReps: 8 })
  })
})

describe('weight steps', () => {
  it('is 2.5 lb for dumbbell exercises and 5 lb for everything else', () => {
    expect(weightIncrement('Dumbbell Incline Bench Press')).toBe(2.5)
    expect(weightIncrement('Dumbbell RDL')).toBe(2.5)
    expect(weightIncrement('Barbell Bench Press')).toBe(5)
    expect(weightIncrement('Cable Pushdown')).toBe(5)
    expect(weightIncrement('Hack Squat')).toBe(5)
  })
})

describe('what happens next, from what you actually did', () => {
  const bench = resolveWorkout(chestBlock(), findWorkout(chestBlock(), 'w1-d1')!, catalog).exercises[0]
  const dumbbell = { ...bench, id: 'dumbbell-fly', name: 'Dumbbell Fly' }
  const set = (index: number, reps: number, target = 8, weight = 100): CompletedSetRecord => ({ id: `s-${index}`, sessionId: 'prev', workoutId: 'w1-d1', exerciseId: bench.id, exerciseName: bench.name, setIndex: index, weight, reps, rir: 3, weightUnit: 'lb', completedAt: `2026-10-05T10:0${index}:00.000Z`, weekNumber: 1, repRange: bench.repRange, targetRir: 3, targetReps: target })
  const hit = [set(1, 8), set(2, 8), set(3, 8)]
  const next = (last: CompletedSetRecord[], index: number, feedback?: SessionFeedback, all: SessionFeedback[] = feedback ? [feedback] : [], exercise = bench) => nextSetTarget({ exercise, last, index, fb: feedback, all })
  const answers = (patch: Partial<SessionFeedback>) => fb({ sessionId: 'prev', at: '2', summaryDone: true, ...patch })

  it('counts a set as missed only when reps fall below the rep target it started with', () => {
    expect(missedReps(set(1, 6, 8))).toBe(2)
    expect(missedReps(set(1, 9, 8))).toBe(0)
    expect(missedReps({ ...set(1, 6), targetReps: undefined })).toBe(0)
  })

  it('drops 10% after two sessions in a row with missed reps at the same weight', () => {
    const partial = (session: string) => [set(1, 8), set(2, 7), set(3, 6)].map((entry) => ({ ...entry, sessionId: session }))
    const stalled = nextSetTarget({ exercise: bench, last: partial('b'), previous: partial('a'), index: 0, all: [] })
    expect(stalled).toMatchObject({ weight: 90, reps: 8 })
    expect(stalled.note).toMatch(/two sessions in a row/)
    expect(nextSetTarget({ exercise: dumbbell, last: partial('b').map((entry) => ({ ...entry, weight: 20 })), previous: partial('a').map((entry) => ({ ...entry, weight: 20 })), index: 0, all: [] }).weight).toBe(17.5)
  })

  it('does not call it a stall after one miss, after a weight change, or when the earlier session was clean', () => {
    const partial = (session: string, weight = 100) => [set(1, 8), set(2, 7), set(3, 6)].map((entry) => ({ ...entry, sessionId: session, weight }))
    expect(isStalled(partial('b'), [])).toBe(false)
    expect(isStalled(partial('b'), partial('a', 95))).toBe(false)
    expect(isStalled(partial('b'), hit)).toBe(false)
    expect(isStalled(hit, partial('a'))).toBe(false)
    expect(next(partial('b'), 0).weight).toBe(100)
  })

  it('drops the weight one step only when every set missed its reps', () => {
    const missedAll = [set(1, 7), set(2, 6), set(3, 5)]
    expect(next(missedAll, 0)).toMatchObject({ weight: 95, reps: 8 })
    expect(next(missedAll, 2)).toMatchObject({ weight: 95, reps: 8 })
    expect(next(missedAll.map((entry) => ({ ...entry, weight: 50 })), 0, undefined, [], dumbbell)).toMatchObject({ weight: 47.5 })
    expect(next(missedAll, 0, answers({ effort: 'easy', pump: 'low' })).weight).toBe(95)
  })

  it('never lowers the weight if even one set was completed', () => {
    for (const reps of [[8, 7, 7], [8, 8, 5], [7, 8, 8]]) {
      const last = reps.map((value, index) => set(index + 1, value))
      for (let index = 0; index < 3; index += 1) expect(next(last, index).weight).toBe(100)
    }
  })

  it('after a short finish, keeps the weight and starts the short sets from what you did plus one rep', () => {
    const last = [set(1, 8), set(2, 7), set(3, 6)]
    expect(next(last, 0)).toMatchObject({ weight: 100, reps: 8 })
    expect(next(last, 1)).toMatchObject({ weight: 100, reps: 8 })
    expect(next(last, 2)).toMatchObject({ weight: 100, reps: 7 })
    expect(next(last, 2, answers({ effort: 'easy', pump: 'low' })).weight).toBe(100)
  })

  it('with no answers, adds a rep when every set was hit', () => {
    expect(next(hit, 0)).toMatchObject({ weight: 100, reps: 9 })
    expect(next(hit, 0, answers({})).note).toMatch(/Add 1 rep/)
  })

  it('easy adds one weight step (2.5 lb dumbbell, 5 lb otherwise) and no rep; just right and too hard keep the weight and add a rep', () => {
    expect(next(hit, 0, answers({ effort: 'easy', pump: 'high' }))).toMatchObject({ weight: 105, reps: 8 })
    expect(next(hit, 0, answers({ effort: 'easy', pump: 'high' }), undefined, dumbbell)).toMatchObject({ weight: 102.5 })
    expect(next(hit, 0, answers({ effort: 'right', pump: 'high' }))).toMatchObject({ weight: 100, reps: 9 })
    expect(next(hit, 0, answers({ effort: 'hard', pump: 'high' }))).toMatchObject({ weight: 100, reps: 9 })
  })

  it('never adds more than 5 lb in a week', () => {
    for (const name of ['Barbell Bench Press', 'Dumbbell Fly', 'Hack Squat']) {
      const result = next(hit, 0, answers({ effort: 'easy', pump: 'low' }), undefined, { ...bench, name })
      expect(result.weight - 100).toBeLessThanOrEqual(5)
    }
  })

  it('low pump adds a rep, two if the previous check was also low; too hard always adds exactly one', () => {
    const low = answers({ effort: 'right', pump: 'low' })
    expect(next(hit, 0, low)).toMatchObject({ weight: 100, reps: 9 })
    const earlier = fb({ sessionId: 'old', at: '1', pump: 'low', summaryDone: true })
    expect(next(hit, 0, low, [earlier, low])).toMatchObject({ reps: 10 })
    expect(next(hit, 0, answers({ effort: 'hard', pump: 'low' }))).toMatchObject({ weight: 100, reps: 9 })
    expect(next(hit, 0, answers({ effort: 'hard', pump: 'low' }), [fb({ sessionId: 'old', at: '1', pump: 'low', summaryDone: true }), answers({ effort: 'hard', pump: 'low' })])).toMatchObject({ reps: 9 })
    expect(next(hit, 0, answers({ effort: 'right', pump: 'high' }))).toMatchObject({ reps: 9 })
    expect(next(hit, 0, answers({ effort: 'easy', pump: 'low' }))).toMatchObject({ weight: 105, reps: 9 })
  })

  it('goes up in weight and back to the bottom of the rep range only at the top of the range', () => {
    const top = Array.from({ length: 3 }, (_, index) => set(index + 1, bench.repRange.max, bench.repRange.max))
    const result = next(top, 0, answers({ effort: 'right', pump: 'low' }))
    expect(result).toMatchObject({ weight: 105, reps: bench.repRange.min })
    expect(result.note).toMatch(/Top of the rep range/)
    expect(next(top, 0)).toMatchObject({ weight: 105, reps: bench.repRange.min })
    expect(next(hit, 0, answers({ effort: 'right', pump: 'low' })).reps).toBe(9)
  })

  it('shows sets that fell short in last session\'s summary', () => {
    expect(describeLastSession([set(1, 8), set(2, 6)])).toBe('100×8 · 100×6 (target 8)')
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

describe('building the next session', () => {
  const block = chestBlock()
  const prior = (weight: number, reps: number, target = reps): CompletedSetRecord[] => ['barbell-bench-press', 'barbell-incline-bench-press'].flatMap((id) => [1, 2, 3].map((n) => ({ id: `prev-${id}-${n}`, sessionId: 'prev', workoutId: 'w1-d1', exerciseId: id, exerciseName: id === 'barbell-bench-press' ? 'Barbell Bench Press' : 'Barbell Incline Bench Press', setIndex: n, weight, reps, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-10-05T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3, targetReps: target })))
  const week2 = workoutFor(block, 'w2-d1')
  const entries = [fb({ sessionId: 'prev', at: '2026-10-05T11:00:00.000Z', soreness: 'sore', effort: 'easy', pump: 'low', summaryDone: true })]

  it('applies the answers: fewer sets, one more weight step, one more rep', () => {
    const sets = buildInitialSets(week2, prior(100, 8), 'now', { feedback: entries, blockId: BLOCK })
    expect(sets['barbell-bench-press']).toHaveLength(2)
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '105', reps: '9', targetReps: 9 })
    expect(sets['cable-pushdown']).toHaveLength(3)
  })

  it('without any answers it adds a rep and keeps the weight', () => {
    const sets = buildInitialSets(week2, prior(100, 8), 'now', { feedback: [], blockId: BLOCK })
    expect(sets['barbell-bench-press']).toHaveLength(3)
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '100', reps: '9' })
    expect(buildInitialSets(week2, prior(100, 8), 'now')['barbell-bench-press'][0]).toMatchObject({ weight: '100', reps: '9' })
  })

  it('lowers the weight only after a session where every set was missed, whatever the answers were', () => {
    const missed = prior(100, 6, 8)
    expect(buildInitialSets(week2, missed, 'now', { feedback: entries, blockId: BLOCK })['barbell-bench-press'][0]).toMatchObject({ weight: '95', reps: '8' })
    expect(buildInitialSets(week2, missed, 'now')['barbell-bench-press'][1]).toMatchObject({ weight: '95' })
  })

  it('leaves the deload week alone: half weight, same reps, planned sets, even with answers', () => {
    const sets = buildInitialSets(workoutFor(block, 'w5-d1'), prior(100, 8), 'now', { feedback: entries, blockId: BLOCK })
    expect(sets['barbell-bench-press']).toHaveLength(3)
    expect(sets['barbell-bench-press'][0]).toMatchObject({ weight: '50', reps: '8' })
  })

  it('explains the adjustment in the suggestion', () => {
    const bench = week2.exercises[0]
    const text = suggestionText(bench, week2, prior(100, 8).filter((set) => set.exerciseId === bench.id), { feedback: entries, blockId: BLOCK })
    expect(text).toMatch(/Aim for 105 lb × 9/)
    expect(text).toMatch(/easy: \+5 lb/)
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

describe('too hard: no extra set next time', () => {
  const early = (effort?: SessionFeedback['effort'], sessionId = 'a') => fb({ sessionId, at: sessionId, soreness: 'early', effort })

  it('cancels the set added by "recovered early" when the same session was rated too hard', () => {
    expect(setOffset([early('easy')], BLOCK, 'Chest')).toBe(1)
    expect(setOffset([early('right')], BLOCK, 'Chest')).toBe(1)
    expect(setOffset([early(undefined)], BLOCK, 'Chest')).toBe(1)
    expect(setOffset([early('hard')], BLOCK, 'Chest')).toBe(0)
  })

  it('only cancels that session\'s addition, keeping earlier ones and never removing sets by itself', () => {
    expect(setOffset([early('easy', 'a'), early('hard', 'b')], BLOCK, 'Chest')).toBe(1)
    expect(setOffset([fb({ sessionId: 'a', at: '1', soreness: 'sore', effort: 'hard' })], BLOCK, 'Chest')).toBe(-1)
    expect(setOffset([fb({ sessionId: 'a', at: '1', soreness: 'ontime', effort: 'hard' })], BLOCK, 'Chest')).toBe(0)
  })

  it('keeps next week\'s set count at the plan after recovered early + too hard', () => {
    const workout = workoutFor(chestBlock(), 'w2-d1')
    expect(tuneWorkoutSets(workout, [early('hard')], BLOCK).exercises.map((exercise) => exercise.sets)).toEqual([3, 3, 3])
    expect(tuneWorkoutSets(workout, [early('right')], BLOCK).exercises.map((exercise) => exercise.sets)).toEqual([4, 4, 3])
  })
})