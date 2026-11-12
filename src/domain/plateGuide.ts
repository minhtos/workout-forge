export type PlateUnit = 'lb' | 'kg'

const bars: Record<PlateUnit, number> = { lb: 45, kg: 20 }
/** The empty bar's weight in the unit. */
export const barWeight = (unit: PlateUnit = 'lb'): number => bars[unit]

/** Every plate size per unit, heaviest first. */
export const plateSizes: Record<PlateUnit, readonly number[]> = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] }

/** Trim float noise from sums of halves and quarters (2.5, 1.25) so 97.5 never prints as 97.50000000000001. */
const clean = (value: number) => Number(value.toFixed(2))

export interface PlateLoad {
  bar: number
  /** Plates for ONE side, heaviest first (the other side mirrors it). */
  plates: number[]
  /** What the bar and plates actually make. */
  total: number
  /** The working weight asked for. */
  requested: number
  /** The bar and plates make exactly the requested weight (never true below the bar). */
  exact: boolean
}

/** Largest per-side total (in smallest-plate units) the exact search will table; beyond it a restricted set falls back to greedy. */
const maxSearchUnits = 4000

/**
 * The most per-side weight (at most `perSide`) the owned plates can make, found exactly: greedy on a subset can under-load
 * (45 + 35 only, 185 lb: greedy stops at 45, but 35 + 35 makes it). Heaviest plates are preferred. Null when the search is too large.
 */
function exactPlates(perSide: number, owned: readonly number[], unit: PlateUnit): number[] | null {
  const step = Math.min(...plateSizes[unit])
  const target = Math.floor((perSide + 1e-9) / step)
  if (target > maxSearchUnits) return null
  const sizes = [...owned].sort((a, b) => b - a)
  const units = sizes.map((plate) => Math.round(plate / step))
  // reach[i][s]: per-side sum s (in units) can be made from sizes[i..], any number of each.
  const reach: boolean[][] = Array.from({ length: sizes.length + 1 }, () => new Array<boolean>(target + 1).fill(false))
  reach[sizes.length][0] = true
  for (let i = sizes.length - 1; i >= 0; i -= 1) {
    for (let sum = 0; sum <= target; sum += 1) reach[i][sum] = reach[i + 1][sum] || (sum >= units[i] && reach[i][sum - units[i]])
  }
  let remaining = target
  while (remaining > 0 && !reach[0][remaining]) remaining -= 1
  const used: number[] = []
  for (let i = 0; i < sizes.length; i += 1) {
    while (remaining >= units[i] && reach[i][remaining - units[i]]) { used.push(sizes[i]); remaining -= units[i] }
  }
  return used
}

/**
 * The plate load for a working weight; `plateGuide` and the block visual both format from it. With every plate (no `owned`)
 * it is greedy from the heaviest plate. With an `owned` set it is the heaviest load those plates can make without going over.
 * Null when there is nothing to show.
 */
export function plateLoad(weight: number, unit: PlateUnit = 'lb', owned?: readonly number[] | null): PlateLoad | null {
  if (!Number.isFinite(weight) || weight <= 0) return null
  const bar = bars[unit]
  let perSide = Math.max(0, (weight - bar) / 2)
  const used: number[] = []
  const found = owned ? exactPlates(perSide, owned, unit) : null
  if (found) used.push(...found)
  else {
    for (const plate of owned ? [...owned].sort((a, b) => b - a) : plateSizes[unit]) {
      while (perSide + 1e-9 >= plate) { used.push(plate); perSide -= plate }
    }
  }
  const total = clean(bar + 2 * used.reduce((sum, plate) => sum + plate, 0))
  const requested = clean(weight)
  return { bar, plates: used, total, requested, exact: total === requested && weight >= bar }
}

/**
 * A barbell total the owned plates can make exactly, next to `target`: the closest one below ('down') or the closest one
 * above ('up'). At or below the bar it is the bar. Pairs are unlimited, so an 'up' answer always exists.
 */
export function loadableTotal(target: number, direction: 'up' | 'down', owned: readonly number[], unit: PlateUnit = 'lb'): number {
  const bar = bars[unit]
  if (!(target > bar)) return bar
  const down = plateLoad(target, unit, owned)?.total ?? bar
  if (direction === 'down') return down
  const pair = 2 * Math.min(...plateSizes[unit])
  const limit = down + 2 * Math.min(...owned)
  for (let weight = Math.max(bar, Math.ceil(target / pair) * pair); weight <= limit; weight += pair) {
    if (plateLoad(weight, unit, owned)?.exact) return weight
  }
  return limit
}

/**
 * One line for the barbell plate guide: the plates to load on each side for a working weight, greedy from the
 * heaviest plate. Returns null when there is nothing to show (no weight typed yet). A weight the plates cannot make
 * exactly shows the closest loadable weight below it and says what that makes.
 */
export function plateGuide(weight: number, unit: PlateUnit = 'lb'): string | null {
  const load = plateLoad(weight, unit)
  if (!load) return null
  const { bar, plates: used, total, requested, exact } = load
  const line = `Working weight ${requested} ${unit} — ${used.length ? `plates per side: ${used.join(' + ')}` : 'Bar only'} (bar ${bar})`
  return exact ? line : `${line}, makes ${total} ${unit}`
}
