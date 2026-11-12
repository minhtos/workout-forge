import { guideFor } from './exerciseGuide'
import { barWeight, loadableTotal, plateLoad, plateSizes } from './plateGuide'
import type { ExercisePrescription } from './program'

export const equipmentKey = 'workout-forge:equipment'

/** Plate sizes (lb), heaviest first. Pairs: a checked size means you have as many pairs of it as you need. */
export const platesLb: readonly number[] = plateSizes.lb
/** Dumbbell sizes (lb), lightest first: halves up to 50, then 5s. A checked size means you have a pair. */
export const dumbbellsLb: readonly number[] = [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50,
  55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120]

/** Stored as the UNCHECKED sizes, so sizes added later default to owned. */
export interface EquipmentInventory { missingPlates: number[]; missingDumbbells: number[] }
export const fullInventory: EquipmentInventory = { missingPlates: [], missingDumbbells: [] }

/** The sizes of `all` that appear in `value`, in the order of `all`; anything else (non-numbers, unknown sizes) is dropped. */
const knownSizes = (value: unknown, all: readonly number[]): number[] => (Array.isArray(value) ? all.filter((size) => value.includes(size)) : [])
/** A list that covers every size is treated as none missing: an empty rack is never a real inventory. */
const unlessAll = (missing: number[], all: readonly number[]): number[] => (missing.length >= all.length ? [] : missing)

export function loadEquipment(): EquipmentInventory {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(equipmentKey) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null || (parsed as { version?: unknown }).version !== 1) return fullInventory
    const { missingPlates, missingDumbbells } = parsed as Record<string, unknown>
    return { missingPlates: unlessAll(knownSizes(missingPlates, platesLb), platesLb), missingDumbbells: unlessAll(knownSizes(missingDumbbells, dumbbellsLb), dumbbellsLb) }
  } catch { return fullInventory }
}

export function saveEquipment(inventory: EquipmentInventory): void {
  try { window.localStorage.setItem(equipmentKey, JSON.stringify({ version: 1, missingPlates: inventory.missingPlates, missingDumbbells: inventory.missingDumbbells })) } catch { /* the inventory just is not remembered on this device */ }
}

/** The owned sizes, or null when the kind is unrestricted (nothing unchecked): callers then run the default code path unchanged. */
const ownedOf = (missing: number[], all: readonly number[]): readonly number[] | null => {
  const owned = all.filter((size) => !missing.includes(size))
  return missing.length === 0 || owned.length === 0 ? null : owned
}
export const ownedPlates = (inventory: EquipmentInventory): readonly number[] | null => ownedOf(inventory.missingPlates, platesLb)
export const ownedDumbbells = (inventory: EquipmentInventory): readonly number[] | null => ownedOf(inventory.missingDumbbells, dumbbellsLb)

export type LoadKind = 'barbell' | 'dumbbell' | null

/** How an exercise is loaded: the barbell flag (the plate guide's trigger), else a dumbbell by the guide or its name. Everything else is untouched. */
export function loadKind(exercise: Pick<ExercisePrescription, 'id' | 'name' | 'barbell'>): LoadKind {
  if (exercise.barbell === true) return 'barbell'
  if (guideFor(exercise.id)?.equipment === 'dumbbell' || /dumbbell/i.test(exercise.name)) return 'dumbbell'
  return null
}

/** The largest weight jump (as a share of the last weight) a dumbbell target may make before it holds and adds reps instead. */
export const jumpLimit = { isolation: 0.10, compound: 0.15 } as const

export interface FitResult { weight: number; reps: number; note: string | null }

/**
 * Fits an engine target to the gear owned. Barbell targets snap to a total the owned plates make (up when the engine is adding
 * weight, down otherwise). Dumbbell targets step to the next owned dumbbell, or hold the weight and add a rep when that jump is
 * too big. Unrestricted kinds, other exercises and unusable weights come back unchanged.
 */
export function fitTarget(args: { exercise: ExercisePrescription; target: { weight: number; reps: number }; from: { weight: number; reps: number }; inventory: EquipmentInventory }): FitResult {
  const { exercise, target, from, inventory } = args
  const unchanged: FitResult = { weight: target.weight, reps: target.reps, note: null }
  const kind = loadKind(exercise)
  if (!kind || !Number.isFinite(target.weight) || target.weight <= 0) return unchanged

  if (kind === 'barbell') {
    const owned = ownedPlates(inventory)
    if (!owned || target.weight < barWeight() || plateLoad(target.weight, 'lb', owned)?.exact) return unchanged
    const weight = loadableTotal(target.weight, target.weight > from.weight ? 'up' : 'down', owned)
    return { weight, reps: target.reps, note: `Rounded to ${weight} lb to match your plates.` }
  }

  const owned = ownedDumbbells(inventory)
  if (!owned || owned.includes(target.weight)) return unchanged
  const { min, max } = exercise.repRange
  const smallest = owned[0]
  if (target.weight <= from.weight) {
    const weight = [...owned].reverse().find((size) => size <= target.weight) ?? smallest
    return { weight, reps: target.reps, note: `Adjusted to ${weight} lb to match your dumbbells.` }
  }
  const limit = exercise.compound ? jumpLimit.compound : jumpLimit.isolation
  const next = owned.find((size) => size >= target.weight)
  const heaviest = owned[owned.length - 1]
  // Past the top of the rack the heaviest owned size is the step, when it is above the last weight.
  const beyondRack = next === undefined && heaviest > from.weight
  const step = beyondRack ? heaviest : next
  if (step !== undefined && (from.weight <= 0 || (step - from.weight) / from.weight <= limit + 1e-9)) return { weight: step, reps: target.reps, note: beyondRack ? `Heaviest dumbbell you have: ${step} lb.` : `Next dumbbell you have: ${step} lb.` }
  // Below every owned size there is nothing to hold at: take the lightest dumbbell at the target reps, no rep bonus.
  if (from.weight < smallest) return { weight: smallest, reps: target.reps, note: `Lightest dumbbell you have: ${smallest} lb.` }
  const hold = [...owned].reverse().find((size) => size <= from.weight) ?? smallest
  // "Staying" is only true when the weight really is unchanged; a typed off-inventory weight drops to the size below it.
  const staying = hold === from.weight
  if (from.reps < max) {
    const note = step !== undefined
      ? `${beyondRack ? `Your heaviest dumbbell (${step} lb)` : `The next dumbbell you have (${step} lb)`} is a big jump: ${staying ? 'staying at' : 'adjusted to'} ${hold} lb, +1 rep.`
      : staying ? `${hold} lb is your heaviest dumbbell: staying there, +1 rep.` : `Adjusted to ${hold} lb, your heaviest dumbbell, +1 rep.`
    return { weight: hold, reps: Math.min(from.reps + 1, max), note }
  }
  if (step !== undefined) return { weight: step, reps: min, note: `Top of the rep range: up to ${step} lb, ${beyondRack ? 'your heaviest dumbbell' : 'the next dumbbell you have'}, back to ${min} reps.` }
  return { weight: hold, reps: max, note: staying ? `${hold} lb is your heaviest dumbbell: staying there at ${max} reps.` : `Adjusted to ${hold} lb, your heaviest dumbbell, at ${max} reps.` }
}
