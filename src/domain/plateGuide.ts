export type PlateUnit = 'lb' | 'kg'

const bars: Record<PlateUnit, number> = { lb: 45, kg: 20 }
const plates: Record<PlateUnit, number[]> = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] }

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
}

/** The plate load for a working weight, greedy from the heaviest plate; `plateGuide` and the block visual both format from it. Null when there is nothing to show. */
export function plateLoad(weight: number, unit: PlateUnit = 'lb'): PlateLoad | null {
  if (!Number.isFinite(weight) || weight <= 0) return null
  const bar = bars[unit]
  let perSide = Math.max(0, (weight - bar) / 2)
  const used: number[] = []
  for (const plate of plates[unit]) {
    while (perSide + 1e-9 >= plate) { used.push(plate); perSide -= plate }
  }
  return { bar, plates: used, total: clean(bar + 2 * used.reduce((sum, plate) => sum + plate, 0)), requested: clean(weight) }
}

/**
 * One line for the barbell plate guide: the plates to load on each side for a working weight, greedy from the
 * heaviest plate. Returns null when there is nothing to show (no weight typed yet). A weight the plates cannot make
 * exactly shows the closest loadable weight below it and says what that makes.
 */
export function plateGuide(weight: number, unit: PlateUnit = 'lb'): string | null {
  const load = plateLoad(weight, unit)
  if (!load) return null
  const { bar, plates: used, total, requested } = load
  const line = `Working weight ${requested} ${unit} — ${used.length ? `plates per side: ${used.join(' + ')}` : 'Bar only'} (bar ${bar})`
  return total === requested && weight >= bar ? line : `${line}, makes ${total} ${unit}`
}
