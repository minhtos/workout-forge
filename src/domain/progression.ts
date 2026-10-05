export interface RepRange { min: number; max: number }
/** 'rir' follows the weekly reps-in-reserve targets; 'linear' adds weight every session once all prescribed reps are hit (5x5). */
export type Progression = 'rir' | 'linear'
/** Weight added per session under linear progression: deadlifts jump 10 lb, everything else 5 lb. */
export const linearIncrement = (exerciseId: string): number => (exerciseId.includes('deadlift') ? 10 : 5)
/** Training weeks in a block. A deload week always follows them. */
export type ProgramDurationWeeks = 4 | 6
export const durationOptions: ProgramDurationWeeks[] = [4, 6]
export interface WorkWeekTarget { kind: 'work'; targetRir: number }
export interface DeloadWeekTarget { kind: 'deload'; loadMultiplier: number; targetRir: number }
export type WeekTarget = WorkWeekTarget | DeloadWeekTarget

const weekSchedules: Record<ProgramDurationWeeks, (number | 'deload')[]> = {
  4: [3, 2, 1, 0, 'deload'],
  6: [3, 2, 2, 1, 1, 0, 'deload'],
}

export const totalWeeks = (durationWeeks: ProgramDurationWeeks): number => weekSchedules[durationWeeks].length

export function getWeekTarget(durationWeeks: ProgramDurationWeeks, weekNumber: number): WeekTarget {
  const entry = weekSchedules[durationWeeks][weekNumber - 1]
  if (entry === undefined) throw new RangeError(`Week ${weekNumber} is outside a ${durationWeeks}-week block.`)
  return entry === 'deload' ? { kind: 'deload', loadMultiplier: 0.5, targetRir: 3 } : { kind: 'work', targetRir: entry }
}

export function deloadLoad(weight: number, multiplier: number): number {
  return Math.round((weight * multiplier) / 2.5) * 2.5
}
