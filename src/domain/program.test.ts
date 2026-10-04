import { describe, expect, it } from 'vitest'
import { addExerciseToDay, createBlock, dayOptions, findWorkout, listWorkouts, maxExercisesPerDay, mergeCatalog, moveExercise, nextWorkout, planProblem, removeExerciseFromDay, renameDay, resolveWorkout, setExerciseSets, type Block } from './program'

const catalog = mergeCatalog([])
const withExercises = (block: Block, perDay: string[][]) => perDay.reduce((current, ids, day) => ids.reduce((next, id) => addExerciseToDay(next, day, id), current), block)

describe('blocks', () => {
  it('offers 2, 3 and 4 days and starts with empty, unscheduled days', () => {
    expect(dayOptions).toEqual([2, 3, 4])
    for (const days of dayOptions) {
      const block = createBlock(days, 4)
      expect(block.templates).toHaveLength(days)
      expect(block.templates.every((day) => day.exercises.length === 0)).toBe(true)
    }
    expect(createBlock(3, 4).templates.map((day) => day.title)).toEqual(['Day 1', 'Day 2', 'Day 3'])
  })

  it('lists days × (weeks + deload) workouts with the right RIR', () => {
    expect(listWorkouts(createBlock(2, 4))).toHaveLength(10)
    expect(listWorkouts(createBlock(4, 6))).toHaveLength(28)
    expect(listWorkouts(createBlock(3, 6)).filter((workout) => workout.dayIndex === 0).map((workout) => workout.target.kind === 'deload' ? 'deload' : workout.target.targetRir)).toEqual([3, 3, 2, 2, 1, 0, 'deload'])
    expect(listWorkouts(createBlock(3, 4)).at(-1)?.target.kind).toBe('deload')
  })

  it('serves workouts in order, skipping completed and skipped ones, then returns null', () => {
    let block = createBlock(3, 4)
    expect(nextWorkout(block)?.id).toBe('w1-d1')
    block = { ...block, completedIds: ['w1-d1'], skippedIds: ['w1-d2'] }
    expect(nextWorkout(block)?.id).toBe('w1-d3')
    block = { ...block, completedIds: listWorkouts(block).map((workout) => workout.id) }
    expect(nextWorkout(block)).toBeNull()
  })
})

describe('planning a day', () => {
  it('adds, orders, sizes and removes exercises, ignoring duplicates', () => {
    let block = withExercises(createBlock(2, 4), [['barbell-bench-press', 'pull-ups', 'barbell-bench-press']])
    expect(block.templates[0].exercises.map((entry) => entry.exerciseId)).toEqual(['barbell-bench-press', 'pull-ups'])
    block = moveExercise(block, 0, 1, -1)
    expect(block.templates[0].exercises.map((entry) => entry.exerciseId)).toEqual(['pull-ups', 'barbell-bench-press'])
    expect(moveExercise(block, 0, 0, -1)).toEqual(block)
    block = setExerciseSets(block, 0, 0, 5)
    expect(block.templates[0].exercises[0].sets).toBe(5)
    block = removeExerciseFromDay(block, 0, 0)
    expect(block.templates[0].exercises.map((entry) => entry.exerciseId)).toEqual(['barbell-bench-press'])
  })

  it('caps the number of exercises per day', () => {
    const block = withExercises(createBlock(2, 4), [catalog.slice(0, maxExercisesPerDay + 3).map((item) => item.id)])
    expect(block.templates[0].exercises).toHaveLength(maxExercisesPerDay)
  })

  it('lets any muscle group be trained on any day', () => {
    const block = withExercises(createBlock(2, 4), [['barbell-squat', 'barbell-bench-press'], ['pull-ups', 'barbell-curls']])
    expect(resolveWorkout(block, findWorkout(block, 'w1-d1')!, catalog).exercises.map((exercise) => exercise.category)).toEqual(['Quads', 'Chest'])
  })

  it('requires at least one exercise per day and a name fallback', () => {
    let block = createBlock(2, 4)
    expect(planProblem(block, catalog)).toMatch(/Day 1/)
    block = withExercises(block, [['pull-ups'], []])
    expect(planProblem(block, catalog)).toMatch(/Day 2/)
    block = withExercises(block, [[], ['barbell-squat']])
    expect(planProblem(block, catalog)).toBeNull()
    expect(planProblem(renameDay(withExercises(createBlock(2, 4), [['pull-ups']]), 1, 'Legs'), catalog)).toMatch(/Legs/)
    expect(listWorkouts(renameDay(block, 0, '   '))[0].title).toBe('Day 1')
  })

  it('resolves exercises with their category rep ranges', () => {
    const block = withExercises(createBlock(2, 4), [['barbell-bench-press', 'cable-pushdown']])
    const workout = resolveWorkout(block, findWorkout(block, 'w1-d1')!, catalog)
    expect(workout.exercises[0]).toMatchObject({ category: 'Chest', sets: 3, repRange: { min: 6, max: 10 } })
    expect(workout.exercises[1]).toMatchObject({ category: 'Triceps', repRange: { min: 10, max: 15 } })
  })
})
