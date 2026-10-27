import { beforeEach, describe, expect, it } from 'vitest'
import { blockIntents, blockName, blockTitle, createBlock, intentLabels } from './program'
import { parseProgramSnapshot } from './programSync'
import { emptyState, loadWorkoutState, parseImportedState, saveWorkoutState } from './storage'
import { set } from './testSets'
import { startNextPart, suggestComeback } from './transition'

beforeEach(() => window.localStorage.clear())

describe('block names', () => {
  it('has three outcomes with plain labels', () => {
    expect(blockIntents).toEqual(['consistent', 'push', 'comeback'])
    expect(intentLabels).toEqual({ consistent: 'Stay Consistent', push: 'Push Further', comeback: 'Comeback' })
  })

  it('splits a name into the outcome and the shape of the plan', () => {
    expect(blockName(createBlock(3, 6, 1, 'push'))).toEqual({ outcome: 'Push Further', spec: '3-day · 6-week block' })
    expect(blockName(createBlock(2, 4, 1, 'consistent'))).toEqual({ outcome: 'Stay Consistent', spec: '2-day · 4-week block' })
    expect(blockName(createBlock(4, 8, 1, 'comeback'))).toEqual({ outcome: 'Comeback', spec: '4-day · 8-week block' })
  })

  it('calls a 12-week chain a program', () => {
    expect(blockName(createBlock(3, 6, 2, 'push')).spec).toBe('3-day · 12-week program')
  })

  it('has no outcome when none was chosen', () => {
    expect(blockName(createBlock(3, 6)).outcome).toBeNull()
    expect(blockTitle(createBlock(3, 6))).toBe('3-day · 6-week block')
    expect(blockTitle(createBlock(3, 6, 1, 'push'))).toBe('Push Further — 3-day · 6-week block')
  })

  it('records the intent on the block, null when none is given', () => {
    expect(createBlock(3, 6, 1, 'push').intent).toBe('push')
    expect(createBlock(3, 6).intent).toBeNull()
    expect(createBlock(3, 6, 2, 'comeback')).toMatchObject({ parts: 2, part: 1, intent: 'comeback' })
  })

  it('keeps the intent when part 2 of a 12-week program starts', () => {
    const chained = { ...createBlock(3, 6, 2, 'push'), locked: true, startedAt: '2026-09-01T09:00:00.000Z' }
    expect(startNextPart(chained, [], '2026-10-20T09:00:00.000Z').intent).toBe('push')
  })
})

describe('suggesting a comeback', () => {
  const NOW = new Date(2026, 9, 27, 12)
  const lastWorkout = (daysAgo: number, extraMs = 0) => [set('s', 1, new Date(NOW.getTime() - daysAgo * 86_400_000 - extraMs))]

  it('suggests it at exactly 28 days and not at 27 days 23 hours', () => {
    expect(suggestComeback(lastWorkout(28), NOW)).toEqual({ weeks: 4 })
    expect(suggestComeback(lastWorkout(27, 23 * 3_600_000), NOW)).toBeNull()
    expect(suggestComeback(lastWorkout(27), NOW)).toBeNull()
  })

  it('says how many whole weeks it has been', () => {
    expect(suggestComeback(lastWorkout(34), NOW)).toEqual({ weeks: 4 })
    expect(suggestComeback(lastWorkout(35), NOW)).toEqual({ weeks: 5 })
    expect(suggestComeback(lastWorkout(120), NOW)).toEqual({ weeks: 17 })
  })

  it('judges by the newest set, not the oldest', () => {
    expect(suggestComeback([...lastWorkout(90), ...lastWorkout(3)], NOW)).toBeNull()
  })

  it('never suggests it to someone who has not trained yet', () => {
    expect(suggestComeback([], NOW)).toBeNull()
  })
})

describe('saved blocks and goals', () => {
  const save = (block: unknown) => {
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block }))
    return loadWorkoutState().block
  }

  it('keeps a valid intent through saving and loading', () => {
    saveWorkoutState({ ...emptyState(), block: createBlock(3, 6, 1, 'comeback') })
    expect(loadWorkoutState().block?.intent).toBe('comeback')
  })

  it('reads a block saved before goals existed as having none', () => {
    expect(save(createBlock(3, 6))?.intent).toBeNull()
  })

  it('turns anything that is not a known goal into none', () => {
    for (const junk of ['banana', 7, true, {}, [], 'PUSH', '']) expect(save({ ...createBlock(3, 6), intent: junk })?.intent).toBeNull()
    expect(save({ ...createBlock(3, 6), intent: null })?.intent).toBeNull()
  })

  it('does the same for imported files', () => {
    const text = JSON.stringify({ ...emptyState(), block: { ...createBlock(3, 6), intent: 'banana' } })
    expect(parseImportedState(text)?.block?.intent).toBeNull()
    expect(parseImportedState(JSON.stringify({ ...emptyState(), block: createBlock(3, 6, 1, 'push') }))?.block?.intent).toBe('push')
  })
})

describe('cloud snapshots and goals', () => {
  // Frozen: exactly what a Phase 1 device wrote to the cloud, before blocks had an intent. It must keep parsing, unchanged.
  const phaseOneSnapshot = {
    version: 1,
    updatedAt: '2026-10-05T10:00:00.000Z',
    block: {
      trainingDays: 3, durationWeeks: 6, templates: [{ title: 'Push', exercises: [{ exerciseId: 'barbell-bench-press', sets: 3 }] }, { title: 'Pull', exercises: [{ exerciseId: 'barbell-row', sets: 3 }] }, { title: 'Legs', exercises: [{ exerciseId: 'barbell-squat', sets: 3 }] }],
      progression: 'rir', rotation: false, workoutSetId: 'push-pull-legs', locked: true, startedAt: '2026-10-01T09:00:00.000Z', completedIds: ['w1-d1'], skippedIds: [],
    },
    customExercises: [], hiddenExerciseIds: [], feedback: [],
  }

  it('still parses a snapshot written before goals existed', () => {
    const parsed = parseProgramSnapshot(phaseOneSnapshot)
    expect(parsed).not.toBeNull()
    expect(parsed?.block?.trainingDays).toBe(3)
    expect(parsed?.block?.completedIds).toEqual(['w1-d1'])
    expect(parsed?.block?.intent ?? null).toBeNull()
  })

  it('keeps the snapshot version at 1', () => {
    expect(parseProgramSnapshot({ ...phaseOneSnapshot, version: 2 })).toBeNull()
    expect(parseProgramSnapshot({ ...phaseOneSnapshot, block: { ...phaseOneSnapshot.block, intent: 'push' } })).not.toBeNull()
  })

  it('round-trips a goal', () => {
    for (const intent of blockIntents) {
      const sent = JSON.parse(JSON.stringify({ ...phaseOneSnapshot, block: { ...phaseOneSnapshot.block, intent } }))
      expect(parseProgramSnapshot(sent)?.block?.intent).toBe(intent)
    }
    expect(parseProgramSnapshot({ ...phaseOneSnapshot, block: { ...phaseOneSnapshot.block, intent: null } })?.block?.intent).toBeNull()
  })

  it('reads an unknown goal as none instead of rejecting the plan', () => {
    for (const junk of ['banana', 7, {}]) {
      const parsed = parseProgramSnapshot({ ...phaseOneSnapshot, block: { ...phaseOneSnapshot.block, intent: junk } })
      expect(parsed).not.toBeNull()
      expect(parsed?.block?.intent).toBeNull()
      expect(parsed?.block?.templates).toHaveLength(3)
    }
  })
})
