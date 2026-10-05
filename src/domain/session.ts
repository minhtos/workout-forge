import { roundWeight } from './weights'
import type { ExercisePrescription, MuscleGroup, ScheduledWorkout } from './program'
import { feedbackFor, missedReps, nextSetTarget, setOffset, tunedSets, usesFeedback, type SessionFeedback } from './autoregulation'
import { deloadLoad, linearIncrement } from './progression'
import { carryOverFor } from './transition'
import type { CompletedSetRecord, SetEntry } from './storage'

/** The most recent earlier sessions that included this exercise, newest first, each with its sets in order. */
function recentSessions(history: CompletedSetRecord[], exerciseId: string, excludeSessionId: string, count: number): CompletedSetRecord[][] {
  // Deload sessions are skipped: they are half-weight by design and must never become the starting point for later weeks or blocks.
  const bySession = new Map<string, CompletedSetRecord[]>()
  for (const set of history) {
    if (set.exerciseId !== exerciseId || set.sessionId === excludeSessionId || set.deload) continue
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set])
  }
  const finishedAt = (sets: CompletedSetRecord[]) => sets.reduce((latest, set) => (set.completedAt > latest ? set.completedAt : latest), '')
  return [...bySession.values()].sort((a, b) => finishedAt(b).localeCompare(finishedAt(a))).slice(0, count).map((sets) => sets.sort((a, b) => a.setIndex - b.setIndex))
}

/** Sets from the most recent earlier session that included this exercise. */
export const lastSessionSets = (history: CompletedSetRecord[], exerciseId: string, excludeSessionId: string): CompletedSetRecord[] => recentSessions(history, exerciseId, excludeSessionId, 1)[0] ?? []

/** Sets from the session before the most recent one; used to spot a stall. */
export const previousSessionSets = (history: CompletedSetRecord[], exerciseId: string, excludeSessionId: string): CompletedSetRecord[] => recentSessions(history, exerciseId, excludeSessionId, 2)[1] ?? []

/** Linear progression: repeat the working weight until every prescribed set hits the target reps, then add the increment. */
export function linearNext(exercise: ExercisePrescription, last: CompletedSetRecord[]): { weight: number; reps: number; added: boolean } {
  const weight = Math.max(...last.map((set) => set.weight))
  const target = exercise.repRange.max
  const added = last.length >= exercise.sets && last.every((set) => set.reps >= target)
  return { weight: roundWeight(added ? weight + linearIncrement(exercise.id) : weight), reps: target, added }
}

/** Feedback the engine uses to tune a session: what was answered after earlier sessions, and which block it belongs to. */
export interface TuneContext { feedback: SessionFeedback[]; blockId: string | null; startOffsets?: Partial<Record<MuscleGroup, number>> }

/** A fresh set. The rep target is remembered so a set that falls short can be recognised later. */
const entryFor = (weight: number | string, reps: number, targetRir: string): SetEntry => ({ weight: String(weight), reps: String(reps), rir: targetRir, complete: false, targetReps: reps })

export function buildInitialSets(workout: ScheduledWorkout, history: CompletedSetRecord[], sessionId: string, tune?: TuneContext): Record<string, SetEntry[]> {
  const targetRir = String(workout.target.targetRir)
  const tuning = tune && usesFeedback(workout) ? tune : undefined
  return Object.fromEntries(workout.exercises.map((exercise) => {
    const last = lastSessionSets(history, exercise.id, sessionId)
    const previous = previousSessionSets(history, exercise.id, sessionId)
    const count = tuning ? tunedSets(exercise.sets, setOffset(tuning.feedback, tuning.blockId, exercise.category, tuning.startOffsets?.[exercise.category] ?? 0)) : exercise.sets
    const fb = tuning && last.length ? feedbackFor(tuning.feedback, last[0].sessionId, exercise.category) : undefined
    const carry = tuning ? carryOverFor({ exercise, last, blockId: tuning.blockId, feedback: tuning.feedback }) : null
    const entries = Array.from({ length: count }, (_, index): SetEntry => {
      const base = last[index] ?? last[last.length - 1]
      if (!base) return entryFor('', exercise.repRange.min, targetRir)
      if (workout.target.kind === 'deload') return entryFor(deloadLoad(Math.max(...last.map((set) => set.weight)), workout.target.loadMultiplier), base.reps, targetRir)
      if (workout.progression === 'linear') {
        const next = linearNext(exercise, last)
        return entryFor(next.weight, next.reps, targetRir)
      }
      if (carry) return entryFor(carry.weight, carry.reps, targetRir)
      const next = nextSetTarget({ exercise, last, previous, index, fb, all: tuning?.feedback ?? [] })
      return entryFor(next.weight, next.reps, targetRir)
    })
    return [exercise.id, entries]
  }))
}

/** Last session's sets, flagging any that fell short of the rep target. */
export function describeLastSession(sets: CompletedSetRecord[]): string {
  return sets.map((set) => (missedReps(set) > 0 ? `${set.weight}×${set.reps} (target ${set.targetReps})` : `${set.weight}×${set.reps}`)).join(' · ')
}

export function suggestionText(exercise: ExercisePrescription, workout: ScheduledWorkout, last: CompletedSetRecord[], tune?: TuneContext, previous: CompletedSetRecord[] = []): string {
  const base = last[last.length - 1]
  if (!base) return workout.progression === 'linear' ? 'First time: start light and add weight each session.' : `First time: pick a weight and reps that leave about ${workout.target.targetRir} in reserve.`
  if (workout.target.kind === 'deload') return `Deload: ${deloadLoad(Math.max(...last.map((set) => set.weight)), workout.target.loadMultiplier)} lb for ${base.reps} reps (half your last load).`
  if (workout.progression === 'linear') {
    const next = linearNext(exercise, last)
    return next.added ? `Hit every rep last time. Add weight: ${next.weight} lb × ${next.reps}.` : `Missed reps last time. Repeat ${next.weight} lb × ${next.reps}.`
  }
  const carry = tune && usesFeedback(workout) ? carryOverFor({ exercise, last, blockId: tune.blockId, feedback: tune.feedback }) : null
  if (carry) return `Aim for ${carry.weight} lb × ${carry.reps}. New block: based on ${carry.fromWeight} lb × ${carry.fromReps} at 0 RIR last block (estimated max ${Math.round(carry.oneRepMax)} lb)${carry.easy ? ', plus a step because it felt easy' : ''}.`
  const fb = tune && usesFeedback(workout) ? feedbackFor(tune.feedback, base.sessionId, exercise.category) : undefined
  const next = nextSetTarget({ exercise, last, previous, index: last.length - 1, fb, all: tune?.feedback ?? [] })
  return `Aim for ${next.weight} lb × ${next.reps}. ${next.note}`
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
  return [...entries, { weight: last?.weight ?? '', reps: last?.reps ?? '8', rir: last?.rir ?? '2', complete: false, targetReps: last?.targetReps }]
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