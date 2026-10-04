import type { ExercisePrescription, ScheduledWorkout } from './program'
import { feedbackFor, setOffset, tunedPrefill, tunedSets, usesFeedback, type SessionFeedback } from './autoregulation'
import { deloadLoad, getNextSetSuggestion, linearIncrement } from './progression'
import type { CompletedSetRecord, SetEntry } from './storage'

/** Sets from the most recent earlier session that included this exercise. */
export function lastSessionSets(history: CompletedSetRecord[], exerciseId: string, excludeSessionId: string): CompletedSetRecord[] {
  const earlier = history.filter((set) => set.exerciseId === exerciseId && set.sessionId !== excludeSessionId)
  if (!earlier.length) return []
  const latest = earlier.reduce((a, b) => (b.completedAt > a.completedAt ? b : a))
  return earlier.filter((set) => set.sessionId === latest.sessionId).sort((a, b) => a.setIndex - b.setIndex)
}

/** Linear progression: repeat the working weight until every prescribed set hits the target reps, then add the increment. */
export function linearNext(exercise: ExercisePrescription, last: CompletedSetRecord[]): { weight: number; reps: number; added: boolean } {
  const weight = Math.max(...last.map((set) => set.weight))
  const target = exercise.repRange.max
  const added = last.length >= exercise.sets && last.every((set) => set.reps >= target)
  return { weight: added ? weight + linearIncrement(exercise.id) : weight, reps: target, added }
}

/** Feedback the engine uses to tune a session: what was answered after earlier sessions, and which block it belongs to. */
export interface TuneContext { feedback: SessionFeedback[]; blockId: string | null }

export function buildInitialSets(workout: ScheduledWorkout, history: CompletedSetRecord[], sessionId: string, tune?: TuneContext): Record<string, SetEntry[]> {
  const targetRir = String(workout.target.targetRir)
  const tuning = tune && usesFeedback(workout) ? tune : undefined
  return Object.fromEntries(workout.exercises.map((exercise) => {
    const last = lastSessionSets(history, exercise.id, sessionId)
    const count = tuning ? tunedSets(exercise.sets, setOffset(tuning.feedback, tuning.blockId, exercise.category)) : exercise.sets
    const fb = tuning && last.length ? feedbackFor(tuning.feedback, last[0].sessionId, exercise.category) : undefined
    const entries = Array.from({ length: count }, (_, index): SetEntry => {
      const base = last[index] ?? last[last.length - 1]
      if (!base) return { weight: '', reps: String(exercise.repRange.min), rir: targetRir, complete: false }
      if (workout.target.kind === 'deload') return { weight: String(deloadLoad(Math.max(...last.map((set) => set.weight)), workout.target.loadMultiplier)), reps: String(base.reps), rir: targetRir, complete: false }
      if (workout.progression === 'linear') {
        const next = linearNext(exercise, last)
        return { weight: String(next.weight), reps: String(next.reps), rir: targetRir, complete: false }
      }
      const next = getNextSetSuggestion({ weight: base.weight, reps: base.reps, rir: base.rir, targetRir: workout.target.targetRir, repRange: exercise.repRange })
      if (fb && tuning) {
        const tuned = tunedPrefill({ exercise, base, last, fb, all: tuning.feedback, fallbackWeight: next.weight })
        return { weight: String(tuned.weight), reps: String(tuned.reps), rir: targetRir, complete: false }
      }
      return { weight: String(next.weight), reps: String(next.reps), rir: targetRir, complete: false }
    })
    return [exercise.id, entries]
  }))
}

export function describeLastSession(sets: CompletedSetRecord[]): string {
  return sets.map((set) => `${set.weight}×${set.reps} @${set.rir}`).join(' · ')
}

export function suggestionText(exercise: ExercisePrescription, workout: ScheduledWorkout, last: CompletedSetRecord[], tune?: TuneContext): string {
  const base = last[last.length - 1]
  if (!base) return workout.progression === 'linear' ? 'First time: start light and add weight each session.' : `First time: pick a controlled load and stop at ${workout.target.targetRir} RIR.`
  if (workout.target.kind === 'deload') return `Deload: ${deloadLoad(Math.max(...last.map((set) => set.weight)), workout.target.loadMultiplier)} lb for ${base.reps} reps (half your last load).`
  if (workout.progression === 'linear') {
    const next = linearNext(exercise, last)
    return next.added ? `Hit every rep last time. Add weight: ${next.weight} lb × ${next.reps}.` : `Missed reps last time. Repeat ${next.weight} lb × ${next.reps}.`
  }
  const next = getNextSetSuggestion({ weight: base.weight, reps: base.reps, rir: base.rir, targetRir: workout.target.targetRir, repRange: exercise.repRange })
  const fb = tune && usesFeedback(workout) ? feedbackFor(tune.feedback, base.sessionId, exercise.category) : undefined
  if (fb && tune) {
    const tuned = tunedPrefill({ exercise, base, last, fb, all: tune.feedback, fallbackWeight: next.weight })
    return `Aim for ${tuned.weight} lb × ${tuned.reps}. ${tuned.note || 'Same as last time.'}`.trim()
  }
  return `Aim for ${next.weight} lb × ${next.reps}. ${next.reason}`
}

/**
 * Applies an edit to one set. Changing set 1's weight carries it down to the later sets that are
 * not yet complete and still had the same weight (blank on a first session), so a weight you set
 * on purpose for a later set is never overwritten.
 */
export function applyEntryPatch(entries: SetEntry[], index: number, patch: Partial<SetEntry>): SetEntry[] {
  const previousWeight = entries[index]?.weight
  return entries.map((entry, position) => {
    if (position === index) return { ...entry, ...patch }
    const follows = index === 0 && patch.weight !== undefined && position > 0 && !entry.complete && entry.weight === previousWeight
    return follows ? { ...entry, weight: patch.weight as string } : entry
  })
}

export const maxSetsPerExercise = 10

/** Adds one more set, starting from the previous set's weight, reps and RIR. */
export function addSetEntry(entries: SetEntry[]): SetEntry[] {
  if (entries.length >= maxSetsPerExercise) return entries
  const last = entries[entries.length - 1]
  return [...entries, { weight: last?.weight ?? '', reps: last?.reps ?? '8', rir: last?.rir ?? '2', complete: false }]
}

/**
 * Removes the last set. Only the last set can go, and only before it is checked off: earlier set
 * numbers (and the sets already saved under them) never shift. Undo a finished set first to remove it.
 */
export function removeLastSetEntry(entries: SetEntry[]): SetEntry[] {
  if (entries.length <= 1 || entries[entries.length - 1].complete) return entries
  return entries.slice(0, -1)
}

export type ParsedEntry = { weight: number; reps: number; rir: number } | { error: string }

export function parseEntry(entry: SetEntry): ParsedEntry {
  if (entry.weight.trim() === '') return { error: 'Enter a weight first (0 for bodyweight).' }
  const weight = Number(entry.weight)
  const reps = Number(entry.reps)
  const rir = Number(entry.rir)
  if (!Number.isFinite(weight) || weight < 0) return { error: 'Weight must be 0 or more.' }
  if (!Number.isInteger(reps) || reps <= 0) return { error: 'Reps must be a whole number above 0.' }
  if (!Number.isFinite(rir) || rir < 0 || rir > 10) return { error: 'RIR must be between 0 and 10.' }
  return { weight, reps, rir }
}
