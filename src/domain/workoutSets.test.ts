import { describe, expect, it } from 'vitest'
import { createBlock, findWorkout, listWorkouts, mergeCatalog, nextWorkout, planProblem, resolveWorkout, setSlotExercise } from './program'
import { buildInitialSets, linearNext, suggestionText } from './session'
import type { CompletedSetRecord } from './storage'
import { applyWorkoutSet, findWorkoutSet, isPlanCustomized, workoutSets } from './workoutSets'

const catalog = mergeCatalog([])
const set = (id: string) => findWorkoutSet(id)!
const applied = (id: string, weeks: 4 | 6 = 4) => applyWorkoutSet(createBlock(3, weeks), set(id))

describe('Workout Sets', () => {
  it('offers the four sets ordered from 2 to 4 days', () => {
    expect(workoutSets.map((entry) => [entry.name, entry.recommendedDays])).toEqual([
      ['Whole Body', 2], ['Push | Pull | Legs', 3], ['StrongLifts 5x5', 3], ['Push | Pull A/B Split', 4],
    ])
  })

  it('predefines muscle groups only, leaving each slot for the user to fill', () => {
    const block = applied('push-pull-legs')
    expect(block.templates.map((day) => day.title)).toEqual(['Push', 'Pull', 'Legs'])
    expect(block.templates[0].exercises.map((entry) => entry.category)).toEqual(['Chest', 'Chest', 'Chest', 'Chest', 'Triceps', 'Triceps'])
    expect(block.templates.flatMap((day) => day.exercises).every((entry) => entry.exerciseId === null)).toBe(true)
    expect(planProblem(block, catalog)).toMatch(/Choose an exercise for every slot on Push/)
  })

  it('takes the set\'s day count and keeps weeks', () => {
    const block = applyWorkoutSet(createBlock(2, 6), set('push-pull-ab'))
    expect(block.trainingDays).toBe(4)
    expect(block.durationWeeks).toBe(6)
    expect(block.templates.map((day) => day.title)).toEqual(['Push A', 'Pull A', 'Push B', 'Pull B'])
    expect(applyWorkoutSet(createBlock(3, 4), set('whole-body')).templates).toHaveLength(2)
  })

  it('validates once every slot has a distinct exercise, and rejects repeats within a day', () => {
    let block = applied('whole-body')
    const choices = [['barbell-bench-press', 'cable-pushdown', 'pull-ups', 'cable-curls', 'barbell-squat', 'dumbbell-rdl'], ['pull-down', 'barbell-curls', 'machine-chest-press', 'cable-pulldown', 'seated-leg-curl', 'hack-squat']]
    choices.forEach((ids, day) => ids.forEach((id, position) => { block = setSlotExercise(block, day, position, id) }))
    expect(planProblem(block, catalog)).toBeNull()
    const twice = setSlotExercise(createBlock(2, 4), 0, 0, null)
    expect(twice.templates[0].exercises).toEqual([])
    const blockWithDup = setSlotExercise(applied('push-pull-legs'), 0, 0, 'barbell-bench-press')
    expect(setSlotExercise(blockWithDup, 0, 1, 'barbell-bench-press').templates[0].exercises[1].exerciseId).toBeNull()
  })
})

describe('muscle group order in the default plans', () => {
  const order = (id: string) => applied(id).templates.map((day) => [day.title, day.exercises.map((entry) => entry.category)] as const)

  it('Whole Body A goes chest, triceps, back, biceps, quads, hamstrings; B goes back, biceps, chest, triceps, hamstrings, quads', () => {
    expect(order('whole-body')).toEqual([
      ['Whole Body A', ['Chest', 'Triceps', 'Back', 'Biceps', 'Quads', 'Hamstrings']],
      ['Whole Body B', ['Back', 'Biceps', 'Chest', 'Triceps', 'Hamstrings', 'Quads']],
    ])
  })

  it('Push | Pull A/B: A days are chest/triceps/quads and back/biceps/hamstrings; B days are 3 chest, 2 triceps, 1 quad and 3 back, 2 biceps, 1 hamstring', () => {
    expect(order('push-pull-ab')).toEqual([
      ['Push A', ['Chest', 'Chest', 'Triceps', 'Triceps', 'Quads', 'Quads']],
      ['Pull A', ['Back', 'Back', 'Biceps', 'Biceps', 'Hamstrings', 'Hamstrings']],
      ['Push B', ['Chest', 'Chest', 'Chest', 'Triceps', 'Triceps', 'Quads']],
      ['Pull B', ['Back', 'Back', 'Back', 'Biceps', 'Biceps', 'Hamstrings']],
    ])
  })

  it('still has six slots on every day of these two sets', () => {
    for (const id of ['whole-body', 'push-pull-ab']) for (const [, categories] of order(id)) expect(categories).toHaveLength(6)
  })

  it('leaves Push | Pull | Legs as it was', () => {
    expect(order('push-pull-legs')).toEqual([
      ['Push', ['Chest', 'Chest', 'Chest', 'Chest', 'Triceps', 'Triceps']],
      ['Pull', ['Back', 'Back', 'Back', 'Back', 'Biceps', 'Biceps']],
      ['Legs', ['Quads', 'Quads', 'Quads', 'Hamstrings', 'Hamstrings', 'Hamstrings']],
    ])
  })
})

describe('5x5 set', () => {
  const block = applied('strength-5x5')

  it('prefills the lifts with 5x5 (deadlift 1x5) and a linear progression', () => {
    expect(block.progression).toBe('linear')
    expect(block.templates.map((day) => day.title)).toEqual(['Workout A', 'Workout B'])
    expect(block.templates[0].exercises.map((entry) => [entry.exerciseId, entry.sets, entry.reps])).toEqual([['barbell-squat', 5, 5], ['barbell-bench-press', 5, 5], ['barbell-row', 5, 5]])
    expect(block.templates[1].exercises.map((entry) => [entry.exerciseId, entry.sets, entry.reps])).toEqual([['barbell-squat', 5, 5], ['barbell-overhead-press', 5, 5], ['barbell-deadlift', 1, 5]])
    expect(planProblem(block, catalog)).toBeNull()
  })

  it('alternates A/B/A then B/A/B across weeks, with a final deload week', () => {
    const workouts = listWorkouts(block)
    expect(workouts).toHaveLength(15)
    expect(workouts.slice(0, 6).map((workout) => workout.title)).toEqual(['Workout A', 'Workout B', 'Workout A', 'Workout B', 'Workout A', 'Workout B'])
    expect(workouts.at(-1)?.target.kind).toBe('deload')
    expect(nextWorkout(block)?.title).toBe('Workout A')
  })

  it('resolves fixed 5-rep prescriptions', () => {
    const workout = resolveWorkout(block, findWorkout(block, 'w1-d2')!, catalog)
    expect(workout.title).toBe('Workout B')
    expect(workout.exercises.map((exercise) => [exercise.name, exercise.sets, exercise.repRange.max])).toEqual([['Barbell Squat', 5, 5], ['Barbell Overhead Press', 5, 5], ['Barbell Deadlift', 1, 5]])
  })

  const logged = (sessionId: string, exerciseId: string, weights: number[], reps: number[]): CompletedSetRecord[] => weights.map((weight, index) => ({ id: `${sessionId}-${exerciseId}-${index + 1}`, sessionId, workoutId: 'w1-d1', exerciseId, exerciseName: exerciseId, setIndex: index + 1, weight, reps: reps[index], rir: 2, weightUnit: 'lb', completedAt: `2026-10-05T12:0${index}:00.000Z`, weekNumber: 1, repRange: { min: 5, max: 5 }, targetRir: 2 }))

  it('adds 5 lb after hitting every rep, 10 lb for deadlift, and repeats after a miss', () => {
    const squat = resolveWorkout(block, findWorkout(block, 'w1-d1')!, catalog).exercises[0]
    expect(linearNext(squat, logged('a', 'barbell-squat', [135, 135, 135, 135, 135], [5, 5, 5, 5, 5]))).toMatchObject({ weight: 140, added: true })
    expect(linearNext(squat, logged('a', 'barbell-squat', [135, 135, 135, 135, 135], [5, 5, 5, 4, 3]))).toMatchObject({ weight: 135, added: false })
    const deadlift = resolveWorkout(block, findWorkout(block, 'w1-d2')!, catalog).exercises[2]
    expect(linearNext(deadlift, logged('b', 'barbell-deadlift', [225], [5]))).toMatchObject({ weight: 235, added: true })
  })

  it('prefills the next session from last time and explains it', () => {
    const history = logged('a', 'barbell-squat', [135, 135, 135, 135, 135], [5, 5, 5, 5, 5])
    const next = resolveWorkout(block, findWorkout(block, 'w1-d2')!, catalog)
    const sets = buildInitialSets(next, history, 'new')['barbell-squat']
    expect(sets.map((entry) => [entry.weight, entry.reps])).toEqual([['140', '5'], ['140', '5'], ['140', '5'], ['140', '5'], ['140', '5']])
    expect(suggestionText(next.exercises[0], next, history)).toMatch(/Add weight: 140 lb × 5/)
  })
})

describe('isPlanCustomized', () => {
  it('is false for an untouched set, including one that prefills lifts', () => {
    expect(isPlanCustomized(applied('whole-body'))).toBe(false)
    expect(isPlanCustomized(applied('strength-5x5'))).toBe(false)
  })

  it('is true once a slot is filled or a prefilled lift is changed', () => {
    expect(isPlanCustomized(setSlotExercise(applied('whole-body'), 0, 0, 'barbell-bench-press'))).toBe(true)
    expect(isPlanCustomized(setSlotExercise(applied('strength-5x5'), 0, 1, 'dumbbell-bench-press'))).toBe(true)
  })

  it('without a set, is true only when an exercise is chosen', () => {
    expect(isPlanCustomized(createBlock(3, 4))).toBe(false)
    expect(isPlanCustomized(setSlotExercise({ ...applied('whole-body'), workoutSetId: null }, 0, 0, 'barbell-bench-press'))).toBe(true)
  })
})
