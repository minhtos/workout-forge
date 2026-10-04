import type { ExercisePrescription, ScheduledWorkout } from './program'
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

export function buildInitialSets(workout: ScheduledWorkout, history: CompletedSetRecord[], sessionId: string): Record<string, SetEntry[]> {
  const targetRir = String(workout.target.targetRir)
  return Object.fromEntries(workout.exercises.map((exercise) => {
    const last = lastSessionSets(history, exercise.id, sessionId)
    const entries = Array.from({ length: exercise.sets }, (_, index): SetEntry => {
      const base = last[index] ?? last[last.length - 1]
      if (!base) return { weight: '', reps: String(exercise.repRange.min), rir: targetRir, complete: false }
      if (workout.target.kind === 'deload') return { weight: String(deloadLoad(Math.max(...last.map((set) => set.weight)), workout.target.loadMultiplier)), reps: String(base.reps), rir: targetRir, complete: false }
      if (workout.progression === 'linear') {
        const next = linearNext(exercise, last)
        return { weight: String(next.weight), reps: String(next.reps), rir: targetRir, complete: false }
      }
      const next = getNextSetSuggestion({ weight: base.weight, reps: base.reps, rir: base.rir, targetRir: workout.target.targetRir, repRange: exercise.repRange })
      return { weight: String(next.weight), reps: String(next.reps), rir: targetRir, complete: false }
    })
    return [exercise.id, entries]
  }))
}

export function describeLastSession(sets: CompletedSetRecord[]): string {
  return sets.map((set) => `${set.weight}×${set.reps} @${set.rir}`).join(' · ')
}

export function suggestionText(exercise: ExercisePrescription, workout: ScheduledWorkout, last: CompletedSetRecord[]): string {
  const base = last[last.length - 1]
  if (!base) return workout.progression === 'linear' ? 'First time: start light and add weight each session.' : `First time: pick a controlled load and stop at ${workout.target.targetRir} RIR.`
  if (workout.target.kind === 'deload') return `Deload: ${deloadLoad(Math.max(...last.map((set) => set.weight)), workout.target.loadMultiplier)} lb for ${base.reps} reps (half your last load).`
  if (workout.progression === 'linear') {
    const next = linearNext(exercise, last)
    return next.added ? `Hit every rep last time. Add weight: ${next.weight} lb × ${next.reps}.` : `Missed reps last time. Repeat ${next.weight} lb × ${next.reps}.`
  }
  const next = getNextSetSuggestion({ weight: base.weight, reps: base.reps, rir: base.rir, targetRir: workout.target.targetRir, repRange: exercise.repRange })
  return `Aim for ${next.weight} lb × ${next.reps}. ${next.reason}`
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
