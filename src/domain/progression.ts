import { roundWeight } from './weights'
export interface RepRange { min: number; max: number }
/** 'rir' follows the weekly reps-in-reserve targets; 'linear' adds weight every session once all prescribed reps are hit (5x5). */
export type Progression = 'rir' | 'linear'
/** Weight added per session under linear progression: deadlifts jump 10 lb, everything else 5 lb. */
export const linearIncrement = (exerciseId: string): number => (exerciseId.includes('deadlift') ? 10 : 5)
/** Training weeks in a block (or in each part of a chained block). A deload week always follows them. */
export type ProgramDurationWeeks = 4 | 6 | 8
/** What the user picks. 12 weeks is two 6-week parts back to back, each with its own deload. */
export type ProgramLength = 4 | 6 | 8 | 12
export const lengthOptions: ProgramLength[] = [4, 6, 8, 12]
export type ProgramParts = 1 | 2
export const shapeOf = (length: ProgramLength): { durationWeeks: ProgramDurationWeeks; parts: ProgramParts } => (length === 12 ? { durationWeeks: 6, parts: 2 } : { durationWeeks: length, parts: 1 })
export const lengthOf = (block: { durationWeeks: ProgramDurationWeeks; parts?: ProgramParts }): ProgramLength => (block.durationWeeks * (block.parts ?? 1)) as ProgramLength
/** "4 weeks + deload", or "12 weeks (2 × 6, each with a deload)". */
export const lengthLabel = (length: ProgramLength): string => (length === 12 ? '12 weeks (2 × 6, each with a deload)' : `${length} weeks + deload`)
export interface WorkWeekTarget { kind: 'work'; targetRir: number }
export interface DeloadWeekTarget { kind: 'deload'; loadMultiplier: number; targetRir: number }
export type WeekTarget = WorkWeekTarget | DeloadWeekTarget

const weekSchedules: Record<ProgramDurationWeeks, (number | 'deload')[]> = {
  4: [3, 2, 1, 0, 'deload'],
  6: [3, 2, 2, 1, 1, 0, 'deload'],
  8: [3, 3, 2, 2, 1, 1, 0, 0, 'deload'],
}

export const totalWeeks = (durationWeeks: ProgramDurationWeeks): number => weekSchedules[durationWeeks].length

export function getWeekTarget(durationWeeks: ProgramDurationWeeks, weekNumber: number): WeekTarget {
  const entry = weekSchedules[durationWeeks][weekNumber - 1]
  if (entry === undefined) throw new RangeError(`Week ${weekNumber} is outside a ${durationWeeks}-week block.`)
  return entry === 'deload' ? { kind: 'deload', loadMultiplier: 0.5, targetRir: 3 } : { kind: 'work', targetRir: entry }
}

export function deloadLoad(weight: number, multiplier: number): number {
  return roundWeight(weight * multiplier)
}
