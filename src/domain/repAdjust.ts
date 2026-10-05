import { missedReps } from './autoregulation'
import type { CompletedSetRecord, SetEntry } from './storage'

/**
 * Weight-to-rep adjustment. When you change the weight on a set, the reps are rescaled so the set still lands on the
 * week's target RIR. Your strength comes from your last session (Brzycki one-rep max); the new rep target is the number
 * of reps you could do to failure at the new weight, minus the target RIR.
 */
export const repCeiling = 15

/** One-rep max from a weight and the reps you could do to failure with it (Brzycki). Not defined from 37 reps up. */
export function brzyckiOneRepMax(weight: number, repsToFailure: number): number | null {
  if (weight <= 0 || repsToFailure < 1 || repsToFailure >= 37) return null
  return (weight * 36) / (37 - repsToFailure)
}

/** Reps to failure at a weight for a given one-rep max (inverse Brzycki). */
export const repsToFailure = (weight: number, oneRepMax: number): number => 37 - (36 * weight) / oneRepMax

/**
 * The best one-rep max across a session's sets. A set that hit its reps left `targetRir` in reserve, so that
 * many reps are added; a set that fell short was taken to failure, so none are.
 */
export function historicalOneRepMax(last: CompletedSetRecord[]): number | null {
  const estimates = last.map((set) => brzyckiOneRepMax(set.weight, set.reps + (missedReps(set) > 0 ? 0 : set.targetRir))).filter((value): value is number => value !== null)
  return estimates.length ? Math.max(...estimates) : null
}

export type RepLimit = 'max' | 'min' | null

export function repsForWeight(args: { weight: number; oneRepMax: number; targetRir: number }): { reps: number; limit: RepLimit } {
  const raw = Math.round(repsToFailure(args.weight, args.oneRepMax) - args.targetRir)
  if (raw > repCeiling) return { reps: repCeiling, limit: 'max' }
  if (raw < 1) return { reps: 1, limit: 'min' }
  return { reps: raw, limit: null }
}

export interface RepNotice { kind: 'info' | 'warn'; text: string }

export function repNotice(weight: string, reps: number, limit: RepLimit, targetRir: number): RepNotice {
  if (limit === 'max') return { kind: 'warn', text: `${weight} lb is light for this week's target. Reps are capped at ${repCeiling}; consider more weight.` }
  if (limit === 'min') return { kind: 'warn', text: `${weight} lb is very heavy for this week's target. Reps set to 1.` }
  return { kind: 'info', text: targetRir === 0 ? `At ${weight} lb, about ${reps} reps takes you to failure.` : `At ${weight} lb, about ${reps} reps leaves ${targetRir} in reserve.` }
}

/**
 * After a weight edit, rescales the reps of every unfinished set whose weight changed. The rep target the set will be
 * judged against (for missed-rep detection) moves with it. Returns a notice for the exercise, or null when nothing changed.
 */
export function adjustRepsForWeightEdit(before: SetEntry[], after: SetEntry[], oneRepMax: number | null, targetRir: number): { entries: SetEntry[]; notice: RepNotice | null } {
  if (oneRepMax === null) return { entries: after, notice: null }
  let notice: RepNotice | null = null
  const entries = after.map((entry, index) => {
    const weight = Number(entry.weight)
    if (entry.complete || before[index]?.weight === entry.weight || entry.weight.trim() === '' || !Number.isFinite(weight) || weight <= 0) return entry
    const { reps, limit } = repsForWeight({ weight, oneRepMax, targetRir })
    notice = repNotice(entry.weight, reps, limit, targetRir)
    return { ...entry, reps: String(reps), targetReps: reps }
  })
  return { entries, notice }
}
