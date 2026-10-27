import type { TrendUnit } from './charts'
import { historicalOneRepMax } from './repAdjust'
import type { CompletedSetRecord } from './storage'

export interface PersonalRecord {
  /** The first set of this session that beat everything logged before it. */
  set: CompletedSetRecord
  /** 'lb' compares estimated one-rep maxes; 'reps' compares reps for bodyweight work (all sets at 0 lb). */
  unit: TrendUnit
  /** How far ahead of the previous best, rounded (lb of estimated max, or reps). Always at least 1. */
  margin: number
  previous: { weight: number; reps: number; completedAt: string }
}

/**
 * Whether a set logged in `sessionId` is a personal record for the exercise, measured the way the Progress chart
 * measures a session: estimated one-rep max (reps unit for bodyweight work), deload sessions left out. Only
 * earlier sessions count as history; a record needs a rounded margin of at least 1.
 */
export function findPersonalRecord(history: CompletedSetRecord[], sessionId: string, exerciseId: string): PersonalRecord | null {
  const ofExercise = history.filter((set) => set.exerciseId === exerciseId && !set.deload)
  const prior = ofExercise.filter((set) => set.sessionId !== sessionId)
  const current = ofExercise.filter((set) => set.sessionId === sessionId).sort((a, b) => a.setIndex - b.setIndex || Date.parse(a.completedAt) - Date.parse(b.completedAt))
  if (!prior.length || !current.length) return null

  const unit: TrendUnit = [...prior, ...current].every((set) => set.weight === 0) ? 'reps' : 'lb'
  const score = (set: CompletedSetRecord) => (unit === 'reps' ? set.reps : historicalOneRepMax([set]))

  let best: { score: number; set: CompletedSetRecord } | null = null
  for (const set of prior) {
    const value = score(set)
    if (value !== null && (!best || value > best.score)) best = { score: value, set }
  }
  if (!best) return null

  for (const set of current) {
    const value = score(set)
    if (value === null) continue
    const margin = Math.round(value - best.score)
    if (margin >= 1) return { set, unit, margin, previous: { weight: best.set.weight, reps: best.set.reps, completedAt: best.set.completedAt } }
  }
  return null
}
