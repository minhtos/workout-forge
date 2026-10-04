import { getWeekTarget, type ProgramDurationWeeks, type RepRange, type WeekTarget } from './progression'

export type { ProgramDurationWeeks }
export type TrainingDaysPerWeek = 3 | 4
export type MuscleGroup = 'Chest' | 'Back' | 'Triceps' | 'Biceps' | 'Quads' | 'Hamstrings'
export interface ExerciseCatalogItem { id: string; name: string; category: MuscleGroup }
export interface ExercisePrescription { id: string; name: string; category: MuscleGroup; sets: number; repRange: RepRange }

/** One slot in a day template. The muscle group is fixed by the template; the exercise is chosen before the block starts. */
export interface PlanSlot { category: MuscleGroup; exerciseId: string | null; sets: number }
export interface DayTemplate { title: string; slots: PlanSlot[] }
export interface Block {
  trainingDays: TrainingDaysPerWeek
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

export const muscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Triceps', 'Biceps', 'Quads', 'Hamstrings']
export const defaultSetCount = 3
export const setCountOptions = [2, 3, 4, 5]

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
const templates: Record<TrainingDaysPerWeek, { title: string; categories: MuscleGroup[] }[]> = {
  3: [
    { title: 'Push', categories: ['Chest', 'Chest', 'Chest', 'Chest', 'Triceps', 'Triceps'] },
    { title: 'Pull', categories: ['Back', 'Back', 'Back', 'Back', 'Biceps', 'Biceps'] },
    { title: 'Legs', categories: ['Quads', 'Quads', 'Quads', 'Hamstrings', 'Hamstrings', 'Hamstrings'] },
  ],
  4: [
    { title: 'Push A', categories: ['Quads', 'Quads', 'Chest', 'Chest', 'Triceps', 'Triceps'] },
    { title: 'Pull A', categories: ['Hamstrings', 'Hamstrings', 'Back', 'Back', 'Biceps', 'Biceps'] },
    { title: 'Push B', categories: ['Chest', 'Chest', 'Chest', 'Triceps', 'Triceps', 'Triceps'] },
    { title: 'Pull B', categories: ['Back', 'Back', 'Back', 'Biceps', 'Biceps', 'Biceps'] },
  ],
}

export const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const baseExercises: ExerciseCatalogItem[] = muscleGroups.flatMap((category) => names[category].map((name) => ({ id: slugify(name), name, category })))

export function mergeCatalog(custom: ExerciseCatalogItem[]): ExerciseCatalogItem[] {
  const seen = new Set(baseExercises.map((item) => item.id))
  return [...baseExercises, ...custom.filter((item) => !seen.has(item.id))]
}

export function createBlock(trainingDays: TrainingDaysPerWeek, durationWeeks: ProgramDurationWeeks): Block {
  return {
    trainingDays, durationWeeks, locked: false, startedAt: null, completedIds: [], skippedIds: [],
    templates: templates[trainingDays].map(({ title, categories }) => ({ title, slots: categories.map((category) => ({ category, exerciseId: null, sets: defaultSetCount })) })),
  }
}

export const workoutIdFor = (weekNumber: number, dayIndex: number) => `w${weekNumber}-d${dayIndex + 1}`

export function listWorkouts(block: Block): WorkoutRef[] {
  const workouts: WorkoutRef[] = []
  for (let week = 1; week <= block.durationWeeks; week += 1) {
    block.templates.forEach((template, dayIndex) => workouts.push({ id: workoutIdFor(week, dayIndex), weekNumber: week, dayIndex, title: template.title, target: getWeekTarget(block.durationWeeks, week) }))
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

/** Returns a human-readable problem with the plan, or null when every slot has a distinct exercise. */
export function planProblem(block: Block, catalog: ExerciseCatalogItem[]): string | null {
  for (const template of block.templates) {
    const chosen = template.slots.map((slot) => slot.exerciseId)
    if (chosen.some((id) => !id || !catalog.some((item) => item.id === id))) return `Choose an exercise for every slot on ${template.title}.`
    if (new Set(chosen).size !== chosen.length) return `${template.title} uses the same exercise twice.`
  }
  return null
}

/** Fills empty slots with the first catalog exercise per muscle group that is not already used that day. */
export function autoFillPlan(block: Block, catalog: ExerciseCatalogItem[]): Block {
  return {
    ...block,
    templates: block.templates.map((template) => {
      const used = new Set(template.slots.map((slot) => slot.exerciseId).filter(Boolean))
      return {
        ...template,
        slots: template.slots.map((slot) => {
          if (slot.exerciseId) return slot
          const choice = catalog.find((item) => item.category === slot.category && !used.has(item.id))
          if (!choice) return slot
          used.add(choice.id)
          return { ...slot, exerciseId: choice.id }
        }),
      }
    }),
  }
}

export function resolveWorkout(block: Block, ref: WorkoutRef, catalog: ExerciseCatalogItem[]): ScheduledWorkout {
  const template = block.templates[ref.dayIndex]
  const exercises = template.slots.flatMap((slot) => {
    const item = catalog.find((entry) => entry.id === slot.exerciseId)
    return item ? [{ ...item, sets: slot.sets, repRange: { ...ranges[item.category] } }] : []
  })
  return { ...ref, exercises }
}
