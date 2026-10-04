import { getWeekTarget, totalWeeks, type ProgramDurationWeeks, type RepRange, type WeekTarget } from './progression'

export type { ProgramDurationWeeks }
export type TrainingDaysPerWeek = 2 | 3 | 4
export type MuscleGroup = 'Chest' | 'Back' | 'Triceps' | 'Biceps' | 'Quads' | 'Hamstrings'
export interface ExerciseCatalogItem { id: string; name: string; category: MuscleGroup }
export interface ExercisePrescription { id: string; name: string; category: MuscleGroup; sets: number; repRange: RepRange }

export interface PlanExercise { exerciseId: string; sets: number }
/** A training day. The user names it and picks its exercises; nothing is predefined. */
export interface DayTemplate { title: string; exercises: PlanExercise[] }
export interface Block {
  trainingDays: TrainingDaysPerWeek
  /** Training weeks; a deload week is added after them. */
  durationWeeks: ProgramDurationWeeks
  templates: DayTemplate[]
  /** Once locked, exercises cannot change until the block is complete. */
  locked: boolean
  startedAt: string | null
  completedIds: string[]
  skippedIds: string[]
}
export interface WorkoutRef { id: string; weekNumber: number; dayIndex: number; title: string; target: WeekTarget }
export interface ScheduledWorkout extends WorkoutRef { exercises: ExercisePrescription[] }

export const dayOptions: TrainingDaysPerWeek[] = [2, 3, 4]
export const muscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Triceps', 'Biceps', 'Quads', 'Hamstrings']
export const defaultSetCount = 3
export const setCountOptions = [2, 3, 4, 5]
export const maxExercisesPerDay = 12

const names: Record<MuscleGroup, string[]> = {
  Chest: ['Barbell Bench Press', 'Barbell Incline Bench Press', 'Dumbbell Incline Bench Press', 'Machine Incline Press', 'Machine Chest Press', 'Machine Fly', 'Dumbbell Fly'],
  Back: ['Pull-ups', 'Assisted Pull-ups', 'Pull-down', 'Row Machine', 'TBar Row', 'Barbell Row'],
  Triceps: ['Dumbbell Tricep Extension', 'Cable Pushdown', 'Cable Single Arm Pulldown', 'Cable Pulldown', 'Cable Overhead Extension'],
  Biceps: ['Incline Dumbbell Curls', 'Cable Curls', 'Barbell Curls'],
  Quads: ['Quad Extension', 'Barbell Squat', 'Leg Press Machine', 'Hack Squat'],
  Hamstrings: ['Good Mornings', 'Dumbbell RDL', 'Seated Leg Curl', 'Lying Leg Curl'],
}
const ranges: Record<MuscleGroup, RepRange> = {
  Chest: { min: 6, max: 10 }, Back: { min: 6, max: 10 }, Triceps: { min: 10, max: 15 },
  Biceps: { min: 10, max: 15 }, Quads: { min: 6, max: 10 }, Hamstrings: { min: 8, max: 12 },
}

export const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const baseExercises: ExerciseCatalogItem[] = muscleGroups.flatMap((category) => names[category].map((name) => ({ id: slugify(name), name, category })))

export function mergeCatalog(custom: ExerciseCatalogItem[]): ExerciseCatalogItem[] {
  const seen = new Set(baseExercises.map((item) => item.id))
  return [...baseExercises, ...custom.filter((item) => !seen.has(item.id))]
}

/** An empty block: the user decides what to train on each day. */
export function createBlock(trainingDays: TrainingDaysPerWeek, durationWeeks: ProgramDurationWeeks): Block {
  return {
    trainingDays, durationWeeks, locked: false, startedAt: null, completedIds: [], skippedIds: [],
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
    block.templates.forEach((template, dayIndex) => workouts.push({ id: workoutIdFor(week, dayIndex), weekNumber: week, dayIndex, title: template.title.trim() || `Day ${dayIndex + 1}`, target: getWeekTarget(block.durationWeeks, week) }))
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

/** Returns a human-readable problem with the plan, or null when every day has at least one valid exercise. */
export function planProblem(block: Block, catalog: ExerciseCatalogItem[]): string | null {
  for (const [index, day] of block.templates.entries()) {
    const name = day.title.trim() || `Day ${index + 1}`
    if (!day.exercises.length) return `Add at least one exercise to ${name}.`
    if (day.exercises.some((entry) => !catalog.some((item) => item.id === entry.exerciseId))) return `${name} has an exercise that no longer exists.`
    if (new Set(day.exercises.map((entry) => entry.exerciseId)).size !== day.exercises.length) return `${name} uses the same exercise twice.`
  }
  return null
}

export function resolveWorkout(block: Block, ref: WorkoutRef, catalog: ExerciseCatalogItem[]): ScheduledWorkout {
  const exercises = block.templates[ref.dayIndex].exercises.flatMap((entry) => {
    const item = catalog.find((candidate) => candidate.id === entry.exerciseId)
    return item ? [{ ...item, sets: entry.sets, repRange: { ...ranges[item.category] } }] : []
  })
  return { ...ref, exercises }
}
