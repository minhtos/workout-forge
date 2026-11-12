import { barWeight, plateLoad, plateSizes } from './plateGuide'
import { baseExercises } from './program'

export interface WarmupStep { weight: number; reps: number }

/** Below this working weight (lb) the ramp is just the empty bar. */
const rampFloor = 95
const ramp = [{ fraction: 0.4, reps: 5 }, { fraction: 0.6, reps: 3 }, { fraction: 0.8, reps: 1 }]
/** Most plate sizes one side of a warm-up load may use. */
const maxPlateSizes = 2
/** The smallest plate of the unit. A warm-up load never uses it: no 2.5s in warm-ups (owner's rule). */
const smallestPlate = Math.min(...plateSizes.lb)
/** A warm-up step must be at least this much (lb) over the load before it. */
const minStep = 10
/** No warm-up step goes over this share of the working weight. */
const ceiling = 0.9
/** Every pair of lb plates adds a multiple of this to the bar. */
const pairStep = 2 * Math.min(...plateSizes.lb)

const warmupIds = new Set(baseExercises.filter((item) => item.compound && item.barbell).map((item) => item.id))

const deadliftId = 'barbell-deadlift'

/** Compound barbell lifts get a warm-up hint; custom exercises never match because the trigger set is built only from the built-in exercises. */
export const hasWarmup = (exerciseId: string): boolean => warmupIds.has(exerciseId)

/** One side's plates for a total as the plate guide loads it (heaviest first) with the owned plates; every plate when null. */
const platesFor = (total: number, owned: readonly number[] | null): number[] =>
  total > barWeight() ? plateLoad(total, 'lb', owned ?? plateSizes.lb)?.plates ?? [] : []

/**
 * The clean ladder (lb): the bar, then every total up to `max` the owned plates (every plate when null) make exactly with at
 * most two plate sizes on a side, loaded heaviest first as the plate guide does — and never using the smallest plate, so a
 * warm-up never asks for the 2.5s. The bar is always the first rung.
 */
export function cleanLadder(max: number, owned: readonly number[] | null = null): number[] {
  const bar = barWeight()
  const rungs = [bar]
  for (let total = bar + pairStep; total <= max + 1e-9; total += pairStep) {
    const load = plateLoad(total, 'lb', owned ?? plateSizes.lb)
    if (load?.exact && new Set(load.plates).size <= maxPlateSizes && !load.plates.includes(smallestPlate)) rungs.push(total)
  }
  return rungs
}

/** Going from one load to the next only adds plates: `to` holds every plate of `from`. */
function addsOnly(from: number, to: number, owned: readonly number[] | null): boolean {
  const left = platesFor(to, owned)
  return platesFor(from, owned).every((plate) => {
    const at = left.indexOf(plate)
    if (at < 0) return false
    left.splice(at, 1)
    return true
  })
}

/**
 * The warm-up ramp (lb) to reach working weight `w`: the bar x10, then 40% x5, 60% x3 and 80% x1, each moved to the nearest
 * rung of the clean ladder at or under 90% of `w`. An exact tie goes to the rung that makes the larger jump from the load
 * before it — a warm-up step should be a noticeable step toward the working weight (45 to 55 is barely any change; 45 to 65
 * actually warms you up) — then to a rung that only adds plates, then the lighter one. A step less than 10 lb over the load
 * before it is dropped. Above the bar and under 95 lb it is only the bar; at or below the bar there is no ramp. `noBarStep`
 * (the deadlift: an empty bar sits too low to pull) leaves the bar step off.
 */
export function warmupSteps(w: number, noBarStep = false, owned: readonly number[] | null = null): WarmupStep[] {
  const bar = barWeight()
  if (!Number.isFinite(w) || w <= bar) return []
  const steps: WarmupStep[] = [{ weight: bar, reps: 10 }]
  if (w >= rampFloor) {
    const rungs = cleanLadder(w * ceiling, owned)
    for (const { fraction, reps } of ramp) {
      const target = w * fraction
      const prev = steps[steps.length - 1].weight
      const weight = rungs.reduce((pick, rung) => {
        const closer = Math.abs(pick - target) - Math.abs(rung - target)
        if (closer > 1e-9) return rung
        if (closer < -1e-9) return pick
        const jump = rung - prev
        const pickJump = pick - prev
        if (Math.abs(jump - pickJump) > 1e-9) return jump > pickJump ? rung : pick
        return addsOnly(prev, rung, owned) && !addsOnly(prev, pick, owned) ? rung : pick
      })
      if (weight >= prev + minStep) steps.push({ weight, reps })
    }
  }
  return noBarStep ? steps.slice(1) : steps
}

/** The hint for an exercise from set 1's typed weight: null unless it is a warm-up lift with a usable ramp. */
export const warmupHint = (exerciseId: string, weight: string | undefined, owned: readonly number[] | null = null): string | null =>
  hasWarmup(exerciseId) ? warmupLine(Number(weight), exerciseId === deadliftId, owned) : null

/** The hint line for set 1's working weight, or null when the ramp is empty. */
export function warmupLine(w: number, noBarStep = false, owned: readonly number[] | null = null): string | null {
  const steps = warmupSteps(w, noBarStep, owned)
  if (!steps.length) return null
  return `Warm-up (not logged): ${steps.map(({ weight, reps }) => `${weight === barWeight() ? 'bar' : weight} × ${reps}`).join(' · ')}`
}
