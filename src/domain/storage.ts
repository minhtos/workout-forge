import type { GeneratedProgram, ProgramDurationWeeks, TrainingDaysPerWeek } from './program'
import type { RepRange } from './progression'

const storageKey = 'workout-forge:v2'

export interface CompletedSetRecord {
  id: string
  sessionId: string
  workoutId: string
  exerciseId: string
  exerciseName: string
  setIndex: number
  weight: number
  reps: number
  rir: number
  weightUnit: 'lb'
  completedAt: string
  weekNumber: number
  repRange: RepRange
  targetRir: number
}

export interface SavedWorkoutState {
  trainingDays: TrainingDaysPerWeek
  duration: ProgramDurationWeeks
  program: GeneratedProgram
  completedIds: string[]
  history: CompletedSetRecord[]
}

export function loadWorkoutState(): SavedWorkoutState | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const candidate = JSON.parse(raw) as Partial<SavedWorkoutState>
    if (candidate.duration !== 5 || !candidate.program?.workouts.every((workout) => Array.isArray(workout.exercises))) return null
    return { ...candidate, history: candidate.history ?? [] } as SavedWorkoutState
  } catch {
    return null
  }
}

export function saveWorkoutState(state: SavedWorkoutState): void {
  window.localStorage.setItem(storageKey, JSON.stringify(state))
}
