import type { GeneratedProgram, ProgramDurationWeeks, TrainingDaysPerWeek } from './program'

const storageKey = 'workout-forge:v1'

export interface SavedWorkoutState {
  trainingDays: TrainingDaysPerWeek
  duration: ProgramDurationWeeks
  program: GeneratedProgram
  completedIds: string[]
}

export function loadWorkoutState(): SavedWorkoutState | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw) as SavedWorkoutState
  } catch {
    return null
  }
}

export function saveWorkoutState(state: SavedWorkoutState): void {
  window.localStorage.setItem(storageKey, JSON.stringify(state))
}
