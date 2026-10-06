import { createBlock, type Block, type MuscleGroup, type PlanExercise, type TrainingDaysPerWeek } from './program'
import type { Progression } from './progression'

/** A slot fixes a muscle group; the user picks the exercise. Programs like 5x5 also prefill the lift and rep target. */
export interface WorkoutSetSlot { category: MuscleGroup; sets?: number; reps?: number; exerciseId?: string }
export interface WorkoutSetDay { title: string; slots: WorkoutSetSlot[] }
export interface WorkoutSet {
  id: string
  name: string
  summary: string
  recommendedDays: TrainingDaysPerWeek
  progression: Progression
  /** Alternate the listed workouts across the training days (A/B/A, then B/A/B). */
  rotation: boolean
  days: WorkoutSetDay[]
}

const slots = (...groups: [MuscleGroup, number][]): WorkoutSetSlot[] => groups.flatMap(([category, count]) => Array.from({ length: count }, () => ({ category })))
/** A slot prefilled with its main lift. The sets and reps stay up to the plan, and the exercise can still be swapped. */
const main = (category: MuscleGroup, exerciseId: string): WorkoutSetSlot => ({ category, exerciseId })
const lift = (category: MuscleGroup, exerciseId: string, sets = 5, reps = 5): WorkoutSetSlot => ({ category, exerciseId, sets, reps })

const definitions: WorkoutSet[] = [
  {
    id: 'push-pull-legs', name: 'Push | Pull | Legs', recommendedDays: 3, progression: 'rir', rotation: false,
    summary: 'Chest and triceps, back and biceps, then legs. Pick an exercise for each muscle slot.',
    days: [
      { title: 'Push', slots: slots(['Chest', 4], ['Triceps', 2]) },
      { title: 'Pull', slots: slots(['Back', 4], ['Biceps', 2]) },
      { title: 'Legs', slots: slots(['Quads', 3], ['Hamstrings', 3]) },
    ],
  },
  {
    id: 'push-pull-ab', name: 'Push | Pull A/B Split', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'Two push and two pull days. Quads ride along with the push days and hamstrings with the pull days.',
    days: [
      { title: 'Push A', slots: slots(['Chest', 2], ['Triceps', 2], ['Quads', 2]) },
      { title: 'Pull A', slots: slots(['Back', 2], ['Biceps', 2], ['Hamstrings', 2]) },
      { title: 'Push B', slots: slots(['Chest', 3], ['Triceps', 2], ['Quads', 1]) },
      { title: 'Pull B', slots: slots(['Back', 3], ['Biceps', 2], ['Hamstrings', 1]) },
    ],
  },
  {
    id: 'upper-lower-x2', name: 'Upper | Lower x2', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'Upper A is chest, back and arms; Lower A is squat-focused (quads, calves, core); Upper B is shoulders, back and arms; Lower B is hinge-focused (hamstrings, glutes, core).',
    days: [
      { title: 'Upper A', slots: slots(['Chest', 2], ['Back', 2], ['Triceps', 1], ['Biceps', 1]) },
      { title: 'Lower A', slots: slots(['Quads', 3], ['Calves', 1], ['Core', 1]) },
      { title: 'Upper B', slots: slots(['Shoulders', 2], ['Back', 2], ['Triceps', 1], ['Biceps', 1]) },
      { title: 'Lower B', slots: slots(['Hamstrings', 2], ['Glutes', 2], ['Core', 1]) },
    ],
  },
  {
    id: 'ppl-accessory', name: 'PPL + Accessory Day', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'Push, pull and legs, plus a fourth day for arms, lateral and rear delts, core and forearms. Rear delts are a Shoulders slot.',
    days: [
      { title: 'Push', slots: slots(['Chest', 2], ['Shoulders', 2], ['Triceps', 1]) },
      { title: 'Pull', slots: slots(['Back', 3], ['Biceps', 1], ['Shoulders', 1]) },
      { title: 'Legs', slots: slots(['Quads', 2], ['Hamstrings', 1], ['Calves', 1]) },
      { title: 'Accessory', slots: slots(['Triceps', 1], ['Shoulders', 2], ['Core', 1], ['Forearms', 1]) },
    ],
  },
  {
    id: 'bro-split', name: 'The Bro Split', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'One muscle group a day: chest and triceps, back and biceps, shoulders and abs, then legs. Each day starts with its main compound lift, prefilled (you can swap it).',
    days: [
      { title: 'Chest & Triceps', slots: [main('Chest', 'barbell-bench-press'), ...slots(['Chest', 3], ['Triceps', 2])] },
      { title: 'Back & Biceps', slots: [main('Back', 'barbell-deadlift'), ...slots(['Back', 3], ['Biceps', 2])] },
      { title: 'Shoulders & Abs', slots: [main('Shoulders', 'dumbbell-shoulder-press'), ...slots(['Shoulders', 3], ['Core', 1])] },
      { title: 'Legs & Calves', slots: [main('Quads', 'barbell-squat'), ...slots(['Quads', 1], ['Hamstrings', 2], ['Calves', 1])] },
    ],
  },
  {
    id: 'whole-body', name: 'Whole Body', recommendedDays: 2, progression: 'rir', rotation: false,
    summary: 'Every major muscle group twice a week, one slot per muscle each day.',
    days: [
      { title: 'Whole Body A', slots: slots(['Chest', 1], ['Triceps', 1], ['Back', 1], ['Biceps', 1], ['Quads', 1], ['Hamstrings', 1]) },
      { title: 'Whole Body B', slots: slots(['Back', 1], ['Biceps', 1], ['Chest', 1], ['Triceps', 1], ['Hamstrings', 1], ['Quads', 1]) },
    ],
  },
  {
    id: 'strength-5x5', name: 'StrongLifts 5x5', recommendedDays: 3, progression: 'linear', rotation: true,
    summary: 'Workouts A and B alternate (A/B/A, then B/A/B). 5 sets of 5, adding weight every session.',
    days: [
      { title: 'Workout A', slots: [lift('Quads', 'barbell-squat'), lift('Chest', 'barbell-bench-press'), lift('Back', 'barbell-row')] },
      { title: 'Workout B', slots: [lift('Quads', 'barbell-squat'), lift('Shoulders', 'barbell-overhead-press'), lift('Back', 'barbell-deadlift', 1, 5)] },
    ],
  },
]

/** Listed from fewest to most training days (ties keep the order above). */
export const workoutSets: WorkoutSet[] = [...definitions].sort((a, b) => a.recommendedDays - b.recommendedDays)

export const findWorkoutSet = (id: string | null): WorkoutSet | undefined => workoutSets.find((set) => set.id === id)

/** Replaces the block's plan with a Workout Set's days. The block takes the set's day count; weeks and progress reset. */
export function applyWorkoutSet(block: Block, set: WorkoutSet): Block {
  return {
    ...block,
    trainingDays: set.recommendedDays,
    progression: set.progression,
    rotation: set.rotation,
    workoutSetId: set.id,
    templates: set.days.map((day) => ({
      title: day.title,
      exercises: day.slots.map((slot): PlanExercise => ({ exerciseId: slot.exerciseId ?? null, category: slot.category, sets: slot.sets ?? 3, ...(slot.reps ? { reps: slot.reps } : {}) })),
    })),
  }
}

/** Back to a blank custom plan: the same days and weeks, no Workout Set, and every day empty for the user to fill. */
export function clearWorkoutSet(block: Block): Block {
  return { ...block, templates: createBlock(block.trainingDays, block.durationWeeks).templates, progression: 'rir', rotation: false, workoutSetId: null }
}

/** True when the plan holds choices worth confirming before they are replaced: edits to a Workout Set, or exercises picked without one. */
export function isPlanCustomized(block: Block): boolean {
  const set = findWorkoutSet(block.workoutSetId)
  if (!set) return block.templates.some((day) => day.exercises.some((entry) => entry.exerciseId))
  return JSON.stringify(block.templates) !== JSON.stringify(applyWorkoutSet(block, set).templates)
}
