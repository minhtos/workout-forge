export interface RepRange { min: number; max: number }
export interface WorkWeekTarget { kind: 'work'; targetRir: number }
export interface DeloadWeekTarget { kind: 'deload'; loadMultiplier: number; targetRir: number }
export type WeekTarget = WorkWeekTarget | DeloadWeekTarget
export interface ProgressionInput { weight: number; reps: number; rir: number; targetRir: number; repRange: RepRange }
export interface SetSuggestion { weight: number; reps: number; reason: string }

export function getWeekTarget(weekNumber: number): WeekTarget {
  const position = (weekNumber - 1) % 5
  if (position === 4) return { kind: 'deload', loadMultiplier: 0.5, targetRir: 3 }
  return { kind: 'work', targetRir: 3 - position }
}

export function getNextSetSuggestion(input: ProgressionInput): SetSuggestion {
  if (input.rir < input.targetRir) return { weight: input.weight, reps: input.reps, reason: 'Hold weight — fewer reps in reserve than target.' }
  if (input.reps >= input.repRange.max) return { weight: input.weight + 5, reps: input.reps, reason: 'Add 5 lb — top of rep range reached.' }
  if (input.rir > input.targetRir) return { weight: input.weight + 5, reps: input.reps, reason: 'Add 5 lb — more reps in reserve than target.' }
  return { weight: input.weight, reps: Math.min(input.reps + 1, input.repRange.max), reason: 'Add 1 rep — target RIR matched.' }
}
