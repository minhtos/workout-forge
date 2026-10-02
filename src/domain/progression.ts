export interface RepRange {
  min: number
  max: number
}

export interface WorkWeekTarget {
  kind: 'work'
  targetRir: number
  targetRpe: number
}

export interface DeloadWeekTarget {
  kind: 'deload'
  loadMultiplier: number
  targetRir: number
  targetRpe: number
}

export type WeekTarget = WorkWeekTarget | DeloadWeekTarget

export interface ProgressionInput {
  weight: number
  reps: number
  rpe: number
  targetRpe: number
  repRange: RepRange
}

export interface SetSuggestion {
  weight: number
  reps: number
  reason: string
}

export function getWeekTarget(weekNumber: number): WeekTarget {
  const position = (weekNumber - 1) % 5
  if (position === 4) return { kind: 'deload', loadMultiplier: 0.5, targetRir: 3, targetRpe: 7 }

  const targetRir = 3 - position
  return { kind: 'work', targetRir, targetRpe: 10 - targetRir }
}

export function getNextSetSuggestion(input: ProgressionInput): SetSuggestion {
  if (input.rpe > input.targetRpe) {
    return { weight: input.weight, reps: input.reps, reason: 'Hold weight — RPE exceeded target.' }
  }

  if (input.reps >= input.repRange.max) {
    return { weight: input.weight + 5, reps: input.reps, reason: 'Add 5 lb — top of rep range reached.' }
  }

  if (input.rpe < input.targetRpe) {
    return { weight: input.weight + 5, reps: input.reps, reason: 'Add 5 lb — effort was below target.' }
  }

  return { weight: input.weight, reps: Math.min(input.reps + 1, input.repRange.max), reason: 'Add 1 rep — target effort matched.' }
}
