import { getWeekTarget, type RepRange, type WeekTarget } from './progression'

export type TrainingDaysPerWeek = 3 | 4
export type ProgramDurationWeeks = 5
export type MuscleGroup = 'Chest' | 'Back' | 'Triceps' | 'Biceps' | 'Quads' | 'Hamstrings'
export interface ExerciseCatalogItem { id: string; name: string; category: MuscleGroup }
export interface ExercisePrescription { id: string; name: string; category: MuscleGroup; sets: number; repRange: RepRange }
export interface ProgramInput { startDate: string; trainingDaysPerWeek: TrainingDaysPerWeek; durationWeeks: ProgramDurationWeeks; weekdays: number[] }
export interface ScheduledWorkout { id: string; date: string; title: string; weekNumber: number; target: WeekTarget; exercises: ExercisePrescription[] }
export interface GeneratedProgram { workouts: ScheduledWorkout[] }

const names: Record<MuscleGroup, string[]> = {
  Chest: ['Barbell Bench Press','Barbell Incline Bench Press','Dumbbell Incline Bench Press','Machine Incline Press','Machine Chest Press','Machine Fly','Dumbbell Fly'],
  Back: ['Pull-ups','Assisted Pull-ups','Pull-down','Row Machine','TBar Row','Barbell Row'],
  Triceps: ['Dumbbell Tricep Extension','Cable Pushdown','Cable Single Arm Pulldown','Cable Pulldown','Cable Overhead Extension'],
  Biceps: ['Incline Dumbbell Curls','Cable Curls','Barbell Curls'],
  Quads: ['Quad Extension','Barbell Squat','Leg Press Machine','Hack Squat'],
  Hamstrings: ['Good Mornings','Dumbbell RDL','Seated Leg Curl','Lying Leg Curl'],
}
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const exerciseCatalog: ExerciseCatalogItem[] = (Object.entries(names) as [MuscleGroup, string[]][]).flatMap(([category, entries]) => entries.map((name) => ({ id: slug(name), name, category })))
const ranges: Record<MuscleGroup, RepRange> = { Chest: { min: 6, max: 10 }, Back: { min: 6, max: 10 }, Triceps: { min: 10, max: 15 }, Biceps: { min: 10, max: 15 }, Quads: { min: 6, max: 10 }, Hamstrings: { min: 8, max: 12 } }
const defaultFor = (category: MuscleGroup, index: number): ExercisePrescription => { const choices = exerciseCatalog.filter((item) => item.category === category); const choice = choices[index % choices.length]; return { ...choice, sets: 3, repRange: { ...ranges[category] } } }
const makeSlots = (categories: MuscleGroup[]) => categories.map((category, index) => defaultFor(category, index))
const templates: Record<TrainingDaysPerWeek, { title: string; categories: MuscleGroup[] }[]> = {
  3: [
    { title: 'Push', categories: ['Chest','Chest','Chest','Chest','Triceps','Triceps'] },
    { title: 'Pull', categories: ['Back','Back','Back','Back','Biceps','Biceps'] },
    { title: 'Legs', categories: ['Quads','Quads','Quads','Hamstrings','Hamstrings','Hamstrings'] },
  ],
  4: [
    { title: 'Push A', categories: ['Quads','Quads','Chest','Chest','Triceps','Triceps'] },
    { title: 'Pull A', categories: ['Hamstrings','Hamstrings','Back','Back','Biceps','Biceps'] },
    { title: 'Push B', categories: ['Chest','Chest','Chest','Triceps','Triceps','Triceps'] },
    { title: 'Pull B', categories: ['Back','Back','Back','Biceps','Biceps','Biceps'] },
  ],
}
function toDate(value: string): Date { return new Date(`${value}T12:00:00`) }
function toDateKey(date: Date): string { return date.toISOString().slice(0, 10) }
export function generateProgram(input: ProgramInput): GeneratedProgram {
  const start = toDate(input.startDate); const workouts: ScheduledWorkout[] = []; const weekdays = [...input.weekdays].sort((a, b) => a - b)
  for (let week = 0; week < input.durationWeeks; week += 1) for (let day = 0; day < input.trainingDaysPerWeek; day += 1) {
    const date = new Date(start); date.setDate(start.getDate() + week * 7 + (weekdays[day] - start.getDay() + 7) % 7); const template = templates[input.trainingDaysPerWeek][day]
    workouts.push({ id: `workout-${week + 1}-${day + 1}`, date: toDateKey(date), title: template.title, weekNumber: week + 1, target: getWeekTarget(week + 1), exercises: makeSlots(template.categories) })
  }
  return { workouts }
}
