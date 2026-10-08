import { baseExercises, createBlock, type Block, type MuscleGroup, type PlanExercise, type TrainingDaysPerWeek } from './program'
import type { Progression } from './progression'

/** A slot fixes a muscle group and starts with a default exercise the user can swap. Programs like 5x5 also fix the rep target. */
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

const idOf = (name: string): string => {
  const item = baseExercises.find((exercise) => exercise.name === name)
  if (!item) throw new Error(`Workout Sets: no library exercise named "${name}"`)
  return item.id
}
/** One muscle group's slots, each prefilled with a beginner-friendly exercise (by library name). The user can still swap any of them. */
const fill = (category: MuscleGroup, ...names: string[]): WorkoutSetSlot[] => names.map((name) => ({ category, exerciseId: idOf(name) }))
const lift = (category: MuscleGroup, exerciseId: string, sets = 5, reps = 5): WorkoutSetSlot => ({ category, exerciseId, sets, reps })

const definitions: WorkoutSet[] = [
  {
    id: 'push-pull-legs', name: 'Push | Pull | Legs', recommendedDays: 3, progression: 'rir', rotation: false,
    summary: 'Chest and triceps, back and biceps, then legs. Each day opens with a barbell lift; every slot can be swapped.',
    days: [
      { title: 'Push', slots: [...fill('Chest', 'Barbell Bench Press', 'Machine Chest Press', 'Dumbbell Incline Bench Press', 'Machine Fly'), ...fill('Triceps', 'Cable Pushdown', 'Cable Overhead Extension')] },
      { title: 'Pull', slots: [...fill('Back', 'Barbell Row', 'Pull-down', 'Row Machine', 'Assisted Pull-ups'), ...fill('Biceps', 'Cable Curls', 'Incline Dumbbell Curls')] },
      { title: 'Legs', slots: [...fill('Quads', 'Barbell Squat', 'Leg Press Machine', 'Leg Extension'), ...fill('Hamstrings', 'Seated Leg Curl', 'Dumbbell RDL', 'Lying Leg Curl')] },
    ],
  },
  {
    id: 'push-pull-ab', name: 'Push | Pull A/B Split', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'Two push and two pull days. Quads ride along with the push days and hamstrings with the pull days. Machines and dumbbells to start; every slot can be swapped.',
    days: [
      { title: 'Push A', slots: [...fill('Chest', 'Machine Chest Press', 'Dumbbell Incline Bench Press'), ...fill('Triceps', 'Cable Pushdown', 'Cable Overhead Extension'), ...fill('Quads', 'Leg Press Machine', 'Leg Extension')] },
      { title: 'Pull A', slots: [...fill('Back', 'Pull-down', 'Row Machine'), ...fill('Biceps', 'Cable Curls', 'Incline Dumbbell Curls'), ...fill('Hamstrings', 'Seated Leg Curl', 'Dumbbell RDL')] },
      { title: 'Push B', slots: [...fill('Chest', 'Dumbbell Incline Bench Press', 'Machine Chest Press', 'Machine Fly'), ...fill('Triceps', 'Dumbbell Tricep Extension', 'Cable Pushdown'), ...fill('Quads', 'Hack Squat')] },
      { title: 'Pull B', slots: [...fill('Back', 'Assisted Pull-ups', 'Row Machine', 'TBar Row'), ...fill('Biceps', 'Incline Dumbbell Curls', 'Cable Curls'), ...fill('Hamstrings', 'Lying Leg Curl')] },
    ],
  },
  {
    id: 'upper-lower-x2', name: 'Upper | Lower x2', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'Upper A is chest, back and arms; Lower A is squat-focused (quads, calves, core); Upper B is shoulders, back and arms; Lower B is hinge-focused (hamstrings, glutes, core). Every slot can be swapped.',
    days: [
      { title: 'Upper A', slots: [...fill('Chest', 'Machine Chest Press', 'Dumbbell Incline Bench Press'), ...fill('Back', 'Pull-down', 'Row Machine'), ...fill('Triceps', 'Cable Pushdown'), ...fill('Biceps', 'Cable Curls')] },
      { title: 'Lower A', slots: [...fill('Quads', 'Leg Press Machine', 'Hack Squat', 'Leg Extension'), ...fill('Calves', 'Standing Calf Raise'), ...fill('Core', 'Cable Crunch')] },
      { title: 'Upper B', slots: [...fill('Shoulders', 'Dumbbell Shoulder Press', 'Lateral Raise'), ...fill('Back', 'Assisted Pull-ups', 'TBar Row'), ...fill('Triceps', 'Cable Overhead Extension'), ...fill('Biceps', 'Incline Dumbbell Curls')] },
      { title: 'Lower B', slots: [...fill('Hamstrings', 'Dumbbell RDL', 'Seated Leg Curl'), ...fill('Glutes', 'Machine Hip Thrust', 'Cable Pull-Through'), ...fill('Core', 'Machine Crunch')] },
    ],
  },
  {
    id: 'ppl-accessory', name: 'PPL + Accessory Day', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'Push, pull and legs, plus a fourth day for arms, lateral and rear delts, core and forearms. Rear delts are a Shoulders slot. Every slot can be swapped.',
    days: [
      { title: 'Push', slots: [...fill('Chest', 'Barbell Bench Press', 'Machine Chest Press'), ...fill('Shoulders', 'Dumbbell Shoulder Press', 'Lateral Raise'), ...fill('Triceps', 'Cable Pushdown')] },
      { title: 'Pull', slots: [...fill('Back', 'Barbell Row', 'Pull-down', 'Row Machine'), ...fill('Biceps', 'Cable Curls'), ...fill('Shoulders', 'Rear Delt Fly')] },
      { title: 'Legs', slots: [...fill('Quads', 'Barbell Squat', 'Leg Press Machine'), ...fill('Hamstrings', 'Seated Leg Curl'), ...fill('Calves', 'Standing Calf Raise')] },
      { title: 'Accessory', slots: [...fill('Triceps', 'Cable Overhead Extension'), ...fill('Shoulders', 'Lateral Raise', 'Rear Delt Fly'), ...fill('Core', 'Cable Crunch'), ...fill('Forearms', 'Cable Wrist Curl')] },
    ],
  },
  {
    id: 'bro-split', name: 'The Bro Split', recommendedDays: 4, progression: 'rir', rotation: false,
    summary: 'One muscle group a day: chest and triceps, back and biceps, shoulders and abs, then legs. Each day starts with its main compound lift, then machines and cables. Every slot can be swapped.',
    days: [
      { title: 'Chest & Triceps', slots: [...fill('Chest', 'Barbell Bench Press', 'Machine Chest Press', 'Dumbbell Incline Bench Press', 'Machine Fly'), ...fill('Triceps', 'Cable Pushdown', 'Cable Overhead Extension')] },
      { title: 'Back & Biceps', slots: [...fill('Back', 'Barbell Deadlift', 'Pull-down', 'Row Machine', 'Assisted Pull-ups'), ...fill('Biceps', 'Cable Curls', 'Incline Dumbbell Curls')] },
      { title: 'Shoulders & Abs', slots: [...fill('Shoulders', 'Dumbbell Shoulder Press', 'Lateral Raise', 'Rear Delt Fly', 'Face Pull'), ...fill('Core', 'Cable Crunch')] },
      { title: 'Legs & Calves', slots: [...fill('Quads', 'Barbell Squat', 'Leg Press Machine'), ...fill('Hamstrings', 'Seated Leg Curl', 'Dumbbell RDL'), ...fill('Calves', 'Standing Calf Raise')] },
    ],
  },
  {
    id: 'whole-body', name: 'Whole Body', recommendedDays: 2, progression: 'rir', rotation: false,
    summary: 'Every major muscle group twice a week, one slot per muscle each day. Machines, cables and dumbbells to start; every slot can be swapped.',
    days: [
      { title: 'Whole Body A', slots: [...fill('Chest', 'Machine Chest Press'), ...fill('Triceps', 'Cable Pushdown'), ...fill('Back', 'Pull-down'), ...fill('Biceps', 'Cable Curls'), ...fill('Quads', 'Leg Press Machine'), ...fill('Hamstrings', 'Seated Leg Curl')] },
      { title: 'Whole Body B', slots: [...fill('Back', 'Row Machine'), ...fill('Biceps', 'Incline Dumbbell Curls'), ...fill('Chest', 'Dumbbell Incline Bench Press'), ...fill('Triceps', 'Cable Overhead Extension'), ...fill('Hamstrings', 'Dumbbell RDL'), ...fill('Quads', 'Leg Extension')] },
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
  return { ...block, templates: createBlock(block.trainingDays, block.durationWeeks, block.parts).templates, progression: 'rir', rotation: false, workoutSetId: null }
}

/** True when the plan holds choices worth confirming before they are replaced: edits to a Workout Set, or exercises picked without one. */
export function isPlanCustomized(block: Block): boolean {
  const set = findWorkoutSet(block.workoutSetId)
  if (!set) return block.templates.some((day) => day.exercises.some((entry) => entry.exerciseId))
  return JSON.stringify(block.templates) !== JSON.stringify(applyWorkoutSet(block, set).templates)
}
