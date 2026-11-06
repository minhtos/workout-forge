import { barWeight } from './plateGuide'
import { baseExercises } from './program'

export interface WarmupStep { weight: number; reps: number }

/** Below this working weight (lb) the ramp is just the empty bar. */
const rampFloor = 95
const ramp = [{ fraction: 0.4, reps: 5 }, { fraction: 0.6, reps: 3 }, { fraction: 0.8, reps: 1 }]
const nearest5 = (value: number) => Math.round(value / 5) * 5

const warmupIds = new Set(baseExercises.filter((item) => item.compound && item.barbell).map((item) => item.id))

const deadliftId = 'barbell-deadlift'

/** Compound barbell lifts get a warm-up hint; custom exercises are never barbell, so they never match. */
export const hasWarmup = (exerciseId: string): boolean => warmupIds.has(exerciseId)

/**
 * The warm-up ramp (lb) to reach working weight `w`: the bar x10, then 40% x5, 60% x3 and 80% x1 rounded to the nearest 5.
 * Percentage steps at or under the bar, at or over `w`, or repeating the one before are dropped, so the weights strictly increase.
 * Under 95 lb it is only the bar. `noBarStep` (the deadlift: an empty bar sits too low to pull) leaves the bar step off.
 */
export function warmupSteps(w: number, noBarStep = false): WarmupStep[] {
  if (!Number.isFinite(w) || w <= 0) return []
  const bar = barWeight()
  const steps: WarmupStep[] = [{ weight: bar, reps: 10 }]
  if (w >= rampFloor) {
    for (const { fraction, reps } of ramp) {
      const weight = nearest5(w * fraction)
      if (weight > steps[steps.length - 1].weight && weight < w) steps.push({ weight, reps })
    }
  }
  return noBarStep ? steps.slice(1) : steps
}

/** The hint for an exercise from set 1's typed weight: null unless it is a warm-up lift with a usable ramp. */
export const warmupHint = (exerciseId: string, weight: string | undefined): string | null =>
  hasWarmup(exerciseId) ? warmupLine(Number(weight), exerciseId === deadliftId) : null

/** The hint line for set 1's working weight, or null when the ramp is empty. */
export function warmupLine(w: number, noBarStep = false): string | null {
  const steps = warmupSteps(w, noBarStep)
  if (!steps.length) return null
  return `Warm-up (not logged): ${steps.map(({ weight, reps }) => `${weight === barWeight() ? 'bar' : weight} × ${reps}`).join(' · ')}`
}
