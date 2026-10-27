export type PlateUnit = 'lb' | 'kg'

const bars: Record<PlateUnit, number> = { lb: 45, kg: 20 }
const plates: Record<PlateUnit, number[]> = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] }

/** Trim float noise from sums of halves and quarters (2.5, 1.25) so 97.5 never prints as 97.50000000000001. */
const clean = (value: number) => Number(value.toFixed(2))

/**
 * One line for the barbell plate guide: the plates to load on each side for a working weight, greedy from the
 * heaviest plate. Returns null when there is nothing to show (no weight typed yet). A weight the plates cannot make
 * exactly shows the closest loadable weight below it and says what that makes.
 */
export function plateGuide(weight: number, unit: PlateUnit = 'lb'): string | null {
  if (!Number.isFinite(weight) || weight <= 0) return null
  const bar = bars[unit]
  if (weight <= bar) return `Working weight ${clean(weight)} ${unit} — Bar only (bar ${bar})${weight < bar ? `, makes ${bar} ${unit}` : ''}`
  let perSide = (weight - bar) / 2
  const used: number[] = []
  for (const plate of plates[unit]) {
    while (perSide + 1e-9 >= plate) { used.push(plate); perSide -= plate }
  }
  const total = clean(bar + 2 * used.reduce((sum, plate) => sum + plate, 0))
  const line = `Working weight ${clean(weight)} ${unit} — ${used.length ? `plates per side: ${used.join(' + ')}` : 'Bar only'} (bar ${bar})`
  return total === clean(weight) ? line : `${line}, makes ${total} ${unit}`
}
