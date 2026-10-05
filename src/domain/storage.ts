import type { SessionFeedback } from './autoregulation'
import { completedSetSchema } from './backup'
import type { Block, DayTemplate, ExerciseCatalogItem, PlanExercise } from './program'
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
  /** The rep target the set was prefilled with; reps below it count as missed. Older records do not have it. */
  targetReps?: number
}

/** Values are strings while typing; a set is only recorded in history when it is marked complete. */
export interface SetEntry { reps: string; weight: string; rir: string; complete: boolean; /** The prefilled rep target, kept even if the reps box is edited. */ targetReps?: number }
export interface ActiveSession { workoutId: string; sessionId: string; sets: Record<string, SetEntry[]> }

export interface SavedWorkoutState {
  version: 3
  /** Supabase user this device data belongs to, once signed in. */
  ownerId: string | null
  block: Block | null
  customExercises: ExerciseCatalogItem[]
  /** Exercises turned off in the library; hidden from program-building menus. */
  hiddenExerciseIds: string[]
  /** When this device last changed the program (block, own exercises, library switches). Used to sync with the cloud. */
  programUpdatedAt: string | null
  /** Soreness, effort and pump answers per session and muscle group; they drive the next sessions in RIR blocks. */
  feedback: SessionFeedback[]
  history: CompletedSetRecord[]
  activeSession: ActiveSession | null
  /** Sessions whose latest sets have not yet been confirmed in the cloud. */
  pendingSessionIds: string[]
}

export function emptyState(): SavedWorkoutState {
  return { version: 3, ownerId: null, block: null, customExercises: [], hiddenExerciseIds: [], programUpdatedAt: null, feedback: [], history: [], activeSession: null, pendingSessionIds: [] }
}

function isStateShape(candidate: unknown): candidate is SavedWorkoutState {
  if (typeof candidate !== 'object' || candidate === null) return false
  const value = candidate as Partial<SavedWorkoutState>
  return value.version === 3 && Array.isArray(value.history) && Array.isArray(value.customExercises) && Array.isArray(value.pendingSessionIds)
    && (value.block === null || (typeof value.block === 'object' && Array.isArray(value.block.templates)))
}

interface StoredDay { title?: string; exercises?: PlanExercise[]; slots?: { exerciseId: string | null; sets: number }[] }

/**
 * Brings blocks saved by earlier versions up to the current shape without losing progress:
 * muscle-group slots become plain exercise lists, and old 5-week blocks (3-2-1-0 + deload) map onto the 4-week block.
 * Workout ids and completed/skipped lists are unchanged, so an in-progress block continues where it was.
 */
function normalizeBlock(raw: SavedWorkoutState['block']): Block | null {
  if (!raw) return null
  const stored = raw as unknown as Omit<Block, 'templates' | 'durationWeeks' | 'trainingDays' | 'progression' | 'rotation' | 'workoutSetId'> & Partial<Pick<Block, 'progression' | 'rotation' | 'workoutSetId'>> & { templates: StoredDay[]; durationWeeks: number; trainingDays: number }
  const templates = stored.templates.map((day, index): DayTemplate => ({
    title: day.title ?? `Day ${index + 1}`,
    exercises: day.exercises ?? (day.slots ?? []).flatMap((slot) => (slot.exerciseId ? [{ exerciseId: slot.exerciseId, sets: slot.sets }] : [])),
  }))
  const trainingDays = [2, 3, 4].includes(stored.trainingDays) ? (stored.trainingDays as Block['trainingDays']) : (Math.min(4, Math.max(2, templates.length)) as Block['trainingDays'])
  return { ...stored, templates, trainingDays, durationWeeks: stored.durationWeeks === 6 ? 6 : 4, progression: stored.progression ?? 'rir', rotation: stored.rotation ?? false, workoutSetId: stored.workoutSetId ?? null }
}

function normalizeState(state: SavedWorkoutState): SavedWorkoutState {
  return { ...state, block: normalizeBlock(state.block), hiddenExerciseIds: Array.isArray(state.hiddenExerciseIds) ? state.hiddenExerciseIds : [], programUpdatedAt: typeof state.programUpdatedAt === 'string' ? state.programUpdatedAt : null, feedback: Array.isArray(state.feedback) ? state.feedback : [] }
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
        if (isStateShape(candidate)) return normalizeState(candidate)
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
    return normalizeState({ ...candidate, history })
  } catch {
    return null
  }
}
