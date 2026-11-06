import type { MuscleGroup } from './program'

/**
 * Usual weekly range of direct sets per muscle group, [low, high]. Forge counts direct sets only, so these are the
 * direct-set reading of Renaissance Periodization's volume landmarks (MEV to the top of MAV), not a target.
 * Forearms' top end is a judgment call: no published RP figure was found.
 */
export const usualRanges: Record<MuscleGroup, [number, number]> = {
  Chest: [8, 20], Back: [10, 22], Shoulders: [8, 22], Triceps: [6, 14], Biceps: [8, 20], Forearms: [0, 12],
  Quads: [8, 18], Hamstrings: [6, 16], Glutes: [0, 12], Calves: [8, 16], Core: [0, 16],
}

export type Verdict = 'below' | 'in range' | 'above'

/**
 * Where a week's sets sit against the usual range. A week still in progress never reads "below" (null instead), and a
 * group with a low end of 0 never does either. Deload weeks are the caller's business: it shows no verdicts at all.
 */
export function verdictFor(group: MuscleGroup, sets: number, weekComplete: boolean): Verdict | null {
  const [low, high] = usualRanges[group]
  if (sets > high) return 'above'
  if (sets >= low) return 'in range'
  return weekComplete ? 'below' : null
}
