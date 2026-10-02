import { getWeekTarget, type RepRange, type WeekTarget } from './progression'

export type TrainingDaysPerWeek = 3 | 4
export type ProgramDurationWeeks = 5

export interface ExercisePrescription {
  id: string
  name: string
  sets: number
  repRange: RepRange
}

export interface ProgramInput {
  startDate: string
  trainingDaysPerWeek: TrainingDaysPerWeek
  durationWeeks: ProgramDurationWeeks
  weekdays: number[]
}

export interface ScheduledWorkout {
  id: string
  date: string
  title: string
  weekNumber: number
  target: WeekTarget
  exercises: ExercisePrescription[]
}

export interface GeneratedProgram {
  workouts: ScheduledWorkout[]
}

interface WorkoutTemplate {
  title: string
  exercises: ExercisePrescription[]
}

const prescription = (id: string, name: string, sets: number, min: number, max: number): ExercisePrescription => ({ id, name, sets, repRange: { min, max } })

const templates: Record<TrainingDaysPerWeek, WorkoutTemplate[]> = {
  3: [
    { title: 'Push', exercises: [prescription('barbell-bench-press', 'Barbell Bench Press', 3, 6, 10), prescription('overhead-press', 'Overhead Press', 3, 6, 10), prescription('incline-dumbbell-press', 'Incline Dumbbell Press', 3, 8, 12), prescription('lateral-raise', 'Lateral Raise', 3, 12, 15)] },
    { title: 'Pull', exercises: [prescription('barbell-row', 'Barbell Row', 3, 6, 10), prescription('lat-pulldown', 'Lat Pulldown', 3, 8, 12), prescription('cable-row', 'Cable Row', 3, 8, 12), prescription('dumbbell-curl', 'Dumbbell Curl', 3, 10, 15)] },
    { title: 'Legs', exercises: [prescription('back-squat', 'Back Squat', 3, 6, 10), prescription('romanian-deadlift', 'Romanian Deadlift', 3, 6, 10), prescription('leg-press', 'Leg Press', 3, 10, 15), prescription('leg-curl', 'Leg Curl', 3, 10, 15)] },
  ],
  4: [
    { title: 'Push A', exercises: [prescription('back-squat', 'Back Squat', 3, 6, 10), prescription('barbell-bench-press', 'Barbell Bench Press', 3, 6, 10), prescription('leg-extension', 'Leg Extension', 3, 10, 15), prescription('triceps-pushdown', 'Triceps Pushdown', 3, 10, 15)] },
    { title: 'Pull A', exercises: [prescription('romanian-deadlift', 'Romanian Deadlift', 3, 6, 10), prescription('barbell-row', 'Barbell Row', 3, 6, 10), prescription('leg-curl', 'Leg Curl', 3, 10, 15), prescription('dumbbell-curl', 'Dumbbell Curl', 3, 10, 15)] },
    { title: 'Push B', exercises: [prescription('overhead-press', 'Overhead Press', 3, 6, 10), prescription('incline-dumbbell-press', 'Incline Dumbbell Press', 3, 8, 12), prescription('lateral-raise', 'Lateral Raise', 3, 12, 15), prescription('triceps-pushdown', 'Triceps Pushdown', 3, 10, 15)] },
    { title: 'Pull B', exercises: [prescription('lat-pulldown', 'Lat Pulldown', 3, 8, 12), prescription('cable-row', 'Cable Row', 3, 8, 12), prescription('rear-delt-fly', 'Rear Delt Fly', 3, 12, 15), prescription('dumbbell-curl', 'Dumbbell Curl', 3, 10, 15)] },
  ],
}

function toDate(value: string): Date { return new Date(`${value}T12:00:00`) }
function toDateKey(date: Date): string { return date.toISOString().slice(0, 10) }

export function generateProgram(input: ProgramInput): GeneratedProgram {
  const start = toDate(input.startDate)
  const workouts: ScheduledWorkout[] = []
  const selectedWeekdays = [...input.weekdays].sort((a, b) => a - b)

  for (let weekIndex = 0; weekIndex < input.durationWeeks; weekIndex += 1) {
    for (let dayIndex = 0; dayIndex < input.trainingDaysPerWeek; dayIndex += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + weekIndex * 7 + (selectedWeekdays[dayIndex] - start.getDay() + 7) % 7)
      const template = templates[input.trainingDaysPerWeek][dayIndex]
      workouts.push({ id: `workout-${weekIndex + 1}-${dayIndex + 1}`, date: toDateKey(date), title: template.title, weekNumber: weekIndex + 1, target: getWeekTarget(weekIndex + 1), exercises: template.exercises.map((exercise) => ({ ...exercise, repRange: { ...exercise.repRange } })) })
    }
  }

  return { workouts }
}
