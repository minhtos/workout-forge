export interface RepRange { min: number; max: number }
export type ProgramDurationWeeks = 4 | 5 | 6
export const durationOptions: ProgramDurationWeeks[] = [4, 5, 6]
export interface WorkWeekTarget { kind: 'work'; targetRir: number }
export interface DeloadWeekTarget { kind: 'deload'; loadMultiplier: number; targetRir: number }
export type WeekTarget = WorkWeekTarget | DeloadWeekTarget
export interface ProgressionInput { weight: number; reps: number; rir: number; targetRir: number; repRange: RepRange }
export interface SetSuggestion { weight: number; reps: number; reason: string }

const weekSchedules: Record<ProgramDurationWeeks, (number | 'deload')[]> = {
  4: [3, 2, 1, 0],
  5: [3, 2, 1, 0, 'deload'],
  6: [3, 3, 2, 2, 1, 0],
}

export function getWeekTarget(durationWeeks: ProgramDurationWeeks, weekNumber: number): WeekTarget {
  const entry = weekSchedules[durationWeeks][weekNumber - 1]
  if (entry === undefined) throw new RangeError(`Week ${weekNumber} is outside a ${durationWeeks}-week block.`)
  return entry === 'deload' ? { kind: 'deload', loadMultiplier: 0.5, targetRir: 3 } : { kind: 'work', targetRir: entry }
}

export function deloadLoad(weight: number, multiplier: number): number {
  return Math.round((weight * multiplier) / 2.5) * 2.5
}

export function getNextSetSuggestion(input: ProgressionInput): SetSuggestion {
  if (input.rir < input.targetRir) return { weight: input.weight, reps: input.reps, reason: 'Hold weight — fewer reps in reserve than target.' }
  if (input.reps >= input.repRange.max) return { weight: input.weight + 5, reps: input.repRange.min, reason: 'Add 5 lb — top of rep range reached.' }
  if (input.rir > input.targetRir) return { weight: input.weight + 5, reps: input.reps, reason: 'Add 5 lb — more reps in reserve than target.' }
  return { weight: input.weight, reps: Math.min(input.reps + 1, input.repRange.max), reason: 'Add 1 rep — target RIR matched.' }
}
