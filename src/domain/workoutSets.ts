import { type Block, type MuscleGroup, type PlanExercise, type TrainingDaysPerWeek } from './program'
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
      { title: 'Workout B', slots: [lift('Quads', 'barbell-squat'), lift('Shoulders', 'barbell-overhead-press'), lift('Hamstrings', 'barbell-deadlift', 1, 5)] },
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
