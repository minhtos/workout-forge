export type TrainingDaysPerWeek = 3 | 4 | 5
export type ProgramDurationWeeks = 4 | 6

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
}

export interface GeneratedProgram {
  workouts: ScheduledWorkout[]
}

const templates: Record<TrainingDaysPerWeek, string[]> = {
  3: ['Full Body A', 'Full Body B', 'Full Body C'],
  4: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  5: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
}

function toDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function generateProgram(input: ProgramInput): GeneratedProgram {
  const start = toDate(input.startDate)
  const workouts: ScheduledWorkout[] = []
  const selectedWeekdays = [...input.weekdays].sort((a, b) => a - b)

  for (let weekIndex = 0; weekIndex < input.durationWeeks; weekIndex += 1) {
    for (let dayIndex = 0; dayIndex < input.trainingDaysPerWeek; dayIndex += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + weekIndex * 7 + (selectedWeekdays[dayIndex] - start.getDay() + 7) % 7)
      const sequence = workouts.length
      workouts.push({
        id: `workout-${weekIndex + 1}-${dayIndex + 1}`,
        date: toDateKey(date),
        title: templates[input.trainingDaysPerWeek][sequence % input.trainingDaysPerWeek],
        weekNumber: weekIndex + 1,
      })
    }
  }

  return { workouts }
}
