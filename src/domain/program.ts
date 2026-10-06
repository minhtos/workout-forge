import { getWeekTarget, totalWeeks, type Progression, type ProgramDurationWeeks, type RepRange, type WeekTarget } from './progression'

export type { Progression, ProgramDurationWeeks }
export type TrainingDaysPerWeek = 2 | 3 | 4
export type MuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Triceps' | 'Biceps' | 'Forearms' | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core'
/** `compound` marks a large compound lift (rep max 12); everything else has a rep max of 15. */
export interface ExerciseCatalogItem { id: string; name: string; category: MuscleGroup; compound?: boolean }
export interface ExercisePrescription { id: string; name: string; category: MuscleGroup; sets: number; repRange: RepRange }

/**
 * One exercise on a training day. `exerciseId` is null for a slot that came from a Workout Set and
 * still needs an exercise for its muscle group (`category`). `reps` fixes the rep target (e.g. 5x5).
 */
export interface PlanExercise { exerciseId: string | null; category?: MuscleGroup; sets: number; reps?: number }
/** A training day. The user names it and picks its exercises. */
export interface DayTemplate { title: string; exercises: PlanExercise[] }
export interface Block {
  trainingDays: TrainingDaysPerWeek
  /** Training weeks; a deload week is added after them. */
  durationWeeks: ProgramDurationWeeks
  templates: DayTemplate[]
  progression: Progression
  /** When true the templates (e.g. workouts A and B) alternate across the week's training days and carry over between weeks. */
  rotation: boolean
  /** Sets carried over from the previous block (per muscle group): the larger of the plan or last block's final sets minus one. */
  startOffsets?: Partial<Record<MuscleGroup, number>>
  /** The Workout Set this plan started from, if any. */
  workoutSetId: string | null
  /** Once locked, exercises cannot change until the block is complete. */
  locked: boolean
  startedAt: string | null
  completedIds: string[]
  skippedIds: string[]
}
export interface WorkoutRef { id: string; weekNumber: number; dayIndex: number; templateIndex: number; title: string; target: WeekTarget; progression: Progression }
export interface ScheduledWorkout extends WorkoutRef { exercises: ExercisePrescription[] }

export const dayOptions: TrainingDaysPerWeek[] = [2, 3, 4]
export const muscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Triceps', 'Biceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core']
export const defaultSetCount = 3
export const setCountOptions = [1, 2, 3, 4, 5]
export const maxExercisesPerDay = 12

const names: Record<MuscleGroup, string[]> = {
  Chest: ['Barbell Bench Press', 'Barbell Incline Bench Press', 'Dumbbell Incline Bench Press', 'Machine Incline Press', 'Machine Chest Press', 'Machine Fly', 'Dumbbell Fly'],
  Back: ['Pull-ups', 'Assisted Pull-ups', 'Pull-down', 'Row Machine', 'TBar Row', 'Barbell Row', 'Barbell Deadlift'],
  Shoulders: ['Barbell Overhead Press', 'Dumbbell Shoulder Press', 'Lateral Raise', 'Rear Delt Fly', 'Face Pull'],
  Triceps: ['Dumbbell Tricep Extension', 'Cable Pushdown', 'Cable Single Arm Pulldown', 'Cable Pulldown', 'Cable Overhead Extension'],
  Biceps: ['Incline Dumbbell Curls', 'Cable Curls', 'Barbell Curls'],
  Forearms: ['Barbell Wrist Curl', 'Reverse Wrist Curl', 'Reverse Barbell Curl', 'Cable Wrist Curl', 'Farmers Carry'],
  Quads: ['Leg Extension', 'Barbell Squat', 'Leg Press Machine', 'Hack Squat'],
  Hamstrings: ['Good Mornings', 'Dumbbell RDL', 'Seated Leg Curl', 'Lying Leg Curl'],
  Glutes: ['Barbell Hip Thrust', 'Machine Hip Thrust', 'Machine Glute Kickback', 'Cable Pull-Through', 'Dumbbell Walking Lunge'],
  Calves: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise', 'Smith Machine Calf Raise', 'Donkey Calf Raise'],
  Core: ['Cable Crunch', 'Hanging Leg Raise', 'Ab Wheel Rollout', 'Decline Sit-up', 'Machine Crunch'],
}
/** The bottom of the rep range for each muscle group. The top depends on the exercise (see repMaxFor). */
const repFloors: Record<MuscleGroup, number> = {
  Chest: 6, Back: 6, Shoulders: 6, Triceps: 10, Biceps: 10, Forearms: 10, Quads: 6, Hamstrings: 8, Glutes: 8, Calves: 10, Core: 10,
}

/** Rep max: large compound lifts stop at 12 reps, everything else (isolation, machines, cables) at 15. */
export const compoundRepMax = 12
export const standardRepMax = 15
export const repMaxFor = (item: Pick<ExerciseCatalogItem, 'compound'>): number => (item.compound ? compoundRepMax : standardRepMax)
/** Exercises with a rep max of 15 never start below 8 reps; a muscle group whose floor is already higher keeps it. */
export const standardRepMin = 8
export const repRangeFor = (item: Pick<ExerciseCatalogItem, 'category' | 'compound'>): RepRange => ({ min: item.compound ? repFloors[item.category] : Math.max(repFloors[item.category], standardRepMin), max: repMaxFor(item) })

/** Large compound lifts (rep max 12): free-weight and bodyweight lifts, plus the big machine versions. Isolation work, cables and other machines are not on this list. */
const compoundNames = new Set([
  'Barbell Bench Press', 'Barbell Incline Bench Press', 'Dumbbell Incline Bench Press',
  'Pull-ups', 'Assisted Pull-ups', 'TBar Row', 'Barbell Row',
  'Barbell Overhead Press', 'Dumbbell Shoulder Press',
  'Barbell Squat', 'Hack Squat', 'Leg Press Machine', 'Barbell Deadlift', 'Good Mornings', 'Dumbbell RDL',
  'Barbell Hip Thrust', 'Machine Hip Thrust', 'Dumbbell Walking Lunge',
])

export const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** Ids of exercises that were renamed, so saved plans and history keep matching (Quad Extension is now Leg Extension). */
const legacyIds: Record<string, string> = { 'Leg Extension': 'quad-extension' }
export const baseExercises: ExerciseCatalogItem[] = muscleGroups.flatMap((category) => names[category].map((name): ExerciseCatalogItem => ({ id: legacyIds[name] ?? slugify(name), name, category, ...(compoundNames.has(name) ? { compound: true } : {}) })))

export function mergeCatalog(custom: ExerciseCatalogItem[]): ExerciseCatalogItem[] {
  const seen = new Set(baseExercises.map((item) => item.id))
  return [...baseExercises, ...custom.filter((item) => !seen.has(item.id))]
}

/** An empty block: the user decides what to train on each day (or applies a Workout Set). */
export function createBlock(trainingDays: TrainingDaysPerWeek, durationWeeks: ProgramDurationWeeks): Block {
  return {
    trainingDays, durationWeeks, progression: 'rir', rotation: false, workoutSetId: null, locked: false, startedAt: null, completedIds: [], skippedIds: [],
    templates: Array.from({ length: trainingDays }, (_, index) => ({ title: `Day ${index + 1}`, exercises: [] })),
  }
}

function editDay(block: Block, dayIndex: number, edit: (day: DayTemplate) => DayTemplate): Block {
  return { ...block, templates: block.templates.map((day, index) => (index === dayIndex ? edit(day) : day)) }
}

export const renameDay = (block: Block, dayIndex: number, title: string): Block => editDay(block, dayIndex, (day) => ({ ...day, title }))

export function addExerciseToDay(block: Block, dayIndex: number, exerciseId: string): Block {
  return editDay(block, dayIndex, (day) => day.exercises.length >= maxExercisesPerDay || day.exercises.some((entry) => entry.exerciseId === exerciseId) ? day : { ...day, exercises: [...day.exercises, { exerciseId, sets: defaultSetCount }] })
}

/** Chooses (or changes) the exercise in a slot, unless the day already uses it. */
export function setSlotExercise(block: Block, dayIndex: number, position: number, exerciseId: string | null): Block {
  return editDay(block, dayIndex, (day) => exerciseId && day.exercises.some((entry, index) => index !== position && entry.exerciseId === exerciseId) ? day : { ...day, exercises: day.exercises.map((entry, index) => (index === position ? { ...entry, exerciseId } : entry)) })
}

export const removeExerciseFromDay = (block: Block, dayIndex: number, position: number): Block =>
  editDay(block, dayIndex, (day) => ({ ...day, exercises: day.exercises.filter((_, index) => index !== position) }))

export function moveExercise(block: Block, dayIndex: number, position: number, delta: -1 | 1): Block {
  return editDay(block, dayIndex, (day) => {
    const target = position + delta
    if (target < 0 || target >= day.exercises.length) return day
    const exercises = [...day.exercises]
    ;[exercises[position], exercises[target]] = [exercises[target], exercises[position]]
    return { ...day, exercises }
  })
}

export const setExerciseSets = (block: Block, dayIndex: number, position: number, sets: number): Block =>
  editDay(block, dayIndex, (day) => ({ ...day, exercises: day.exercises.map((entry, index) => (index === position ? { ...entry, sets } : entry)) }))

export const workoutIdFor = (weekNumber: number, dayIndex: number) => `w${weekNumber}-d${dayIndex + 1}`

export function listWorkouts(block: Block): WorkoutRef[] {
  const workouts: WorkoutRef[] = []
  for (let week = 1; week <= totalWeeks(block.durationWeeks); week += 1) {
    const target = getWeekTarget(block.durationWeeks, week)
    // Linear blocks have no RIR schedule; work weeks just carry a neutral logging default.
    const weekTarget: WeekTarget = block.progression === 'linear' && target.kind === 'work' ? { kind: 'work', targetRir: 2 } : target
    for (let dayIndex = 0; dayIndex < block.trainingDays; dayIndex += 1) {
      const templateIndex = (block.rotation ? (week - 1) * block.trainingDays + dayIndex : dayIndex) % block.templates.length
      workouts.push({ id: workoutIdFor(week, dayIndex), weekNumber: week, dayIndex, templateIndex, title: block.templates[templateIndex].title.trim() || `Day ${templateIndex + 1}`, target: weekTarget, progression: block.progression })
    }
  }
  return workouts
}

export function findWorkout(block: Block, id: string): WorkoutRef | undefined {
  return listWorkouts(block).find((workout) => workout.id === id)
}

/** The next workout in order that has been neither completed nor skipped. */
export function nextWorkout(block: Block): WorkoutRef | null {
  return listWorkouts(block).find((workout) => !block.completedIds.includes(workout.id) && !block.skippedIds.includes(workout.id)) ?? null
}

/** Returns a human-readable problem with the plan, or null when every day has valid, distinct exercises. */
export function planProblem(block: Block, catalog: ExerciseCatalogItem[]): string | null {
  for (const [index, day] of block.templates.entries()) {
    const name = day.title.trim() || `Day ${index + 1}`
    if (!day.exercises.length) return `Add at least one exercise to ${name}.`
    if (day.exercises.some((entry) => !entry.exerciseId)) return `Choose an exercise for every slot on ${name}.`
    if (day.exercises.some((entry) => !catalog.some((item) => item.id === entry.exerciseId))) return `${name} has an exercise that no longer exists.`
    if (new Set(day.exercises.map((entry) => entry.exerciseId)).size !== day.exercises.length) return `${name} uses the same exercise twice.`
  }
  return null
}

export function resolveWorkout(block: Block, ref: WorkoutRef, catalog: ExerciseCatalogItem[]): ScheduledWorkout {
  const exercises = block.templates[ref.templateIndex].exercises.flatMap((entry) => {
    const item = catalog.find((candidate) => candidate.id === entry.exerciseId)
    if (!item) return []
    return [{ ...item, sets: entry.sets, repRange: entry.reps ? { min: entry.reps, max: entry.reps } : repRangeFor(item) }]
  })
  return { ...ref, exercises }
}
