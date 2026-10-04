import { completedSetSchema } from './backup'
import type { Block, ExerciseCatalogItem } from './program'
import type { RepRange } from './progression'

const storageKey = 'workout-forge:v3'
const legacyKey = 'workout-forge:v2'

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

/** Values are strings while typing; a set is only recorded in history when it is marked complete. */
export interface SetEntry { reps: string; weight: string; rir: string; complete: boolean }
export interface ActiveSession { workoutId: string; sessionId: string; sets: Record<string, SetEntry[]> }

export interface SavedWorkoutState {
  version: 3
  /** Supabase user this device data belongs to, once signed in. */
  ownerId: string | null
  block: Block | null
  customExercises: ExerciseCatalogItem[]
  history: CompletedSetRecord[]
  activeSession: ActiveSession | null
  /** Sessions whose latest sets have not yet been confirmed in the cloud. */
  pendingSessionIds: string[]
}

export function emptyState(): SavedWorkoutState {
  return { version: 3, ownerId: null, block: null, customExercises: [], history: [], activeSession: null, pendingSessionIds: [] }
}

function isStateShape(candidate: unknown): candidate is SavedWorkoutState {
  if (typeof candidate !== 'object' || candidate === null) return false
  const value = candidate as Partial<SavedWorkoutState>
  return value.version === 3 && Array.isArray(value.history) && Array.isArray(value.customExercises) && Array.isArray(value.pendingSessionIds)
    && (value.block === null || (typeof value.block === 'object' && Array.isArray(value.block.templates)))
}

/** Keeps a copy of data we are about to stop using, so nothing is ever silently discarded. */
function stash(label: string, raw: string): void {
  try { window.localStorage.setItem(`workout-forge:${label}:${Date.now()}`, raw) } catch { /* storage full or unavailable */ }
}

export function archiveWorkoutState(state: SavedWorkoutState): void {
  stash('archive', JSON.stringify(state))
}

export function loadWorkoutState(): SavedWorkoutState {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) {
      try {
        const candidate: unknown = JSON.parse(raw)
        if (isStateShape(candidate)) return candidate
      } catch { /* fall through to stash */ }
      stash('unreadable', raw)
      return emptyState()
    }
    // v2 stored a fixed 5-week program. Carry the logged sets over; the old program itself is not reusable.
    const legacy = window.localStorage.getItem(legacyKey)
    if (legacy) {
      const candidate = JSON.parse(legacy) as { history?: unknown[] }
      if (Array.isArray(candidate.history)) return { ...emptyState(), history: candidate.history as CompletedSetRecord[] }
    }
  } catch { /* unavailable storage or unreadable legacy data: start empty, legacy key is left untouched */ }
  return emptyState()
}

export function saveWorkoutState(state: SavedWorkoutState): boolean {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function exportWorkoutState(state: SavedWorkoutState): string {
  return JSON.stringify(state, null, 2)
}

/** Parses an exported file. Only validated sets are kept; returns null if the file is not a Workout Forge export. */
export function parseImportedState(text: string): SavedWorkoutState | null {
  try {
    const candidate: unknown = JSON.parse(text)
    if (!isStateShape(candidate)) return null
    const history = candidate.history.filter((set) => completedSetSchema.safeParse(set).success)
    return { ...candidate, history }
  } catch {
    return null
  }
}
