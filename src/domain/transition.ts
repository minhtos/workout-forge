import { feedbackFor, setOffset, weightIncrement, type SessionFeedback } from './autoregulation'
import type { ExercisePrescription, MuscleGroup } from './program'
import type { CompletedSetRecord } from './storage'

/**
 * Block-to-block transition. When a new block starts (after the deload) Week 1 does not continue from the deload:
 *  - Weight: from the heaviest set of last block's 0 RIR week, as an estimated one-rep max (Epley), scaled to the weight
 *    that leaves 3 in reserve at the bottom of the rep range. If that week felt easy, add one weight step.
 *  - Reps: back to the bottom of the exercise's rep range.
 *  - Sets: the larger of the plan or last block's final sets minus one (see startingOffsets).
 */
export const estimateOneRepMax = (weight: number, reps: number): number => weight * (1 + reps / 30)

const roundToStep = (weight: number) => Math.round(weight / 2.5) * 2.5

/** Weight at which `targetReps + 3` reps is the limit, i.e. `targetReps` with 3 in reserve. */
export function startingWeight(weight: number, reps: number, targetReps: number): number {
  return roundToStep(estimateOneRepMax(weight, reps) / (1 + (targetReps + 3) / 30))
}

export interface CarryOver {
  weight: number
  reps: number
  /** What it was based on: the heaviest set of the 0 RIR week. */
  fromWeight: number
  fromReps: number
  oneRepMax: number
  easy: boolean
}

/**
 * Week 1 numbers for an exercise in a new block, or null when there is nothing to carry over: the last
 * (non-deload) session must come from before this block started and have been a 0 RIR session.
 */
export function carryOverFor(args: { exercise: ExercisePrescription; last: CompletedSetRecord[]; blockId: string | null; feedback: SessionFeedback[] }): CarryOver | null {
  const { exercise, last, blockId, feedback } = args
  if (!blockId || !last.length || last[0].completedAt >= blockId || last[0].targetRir !== 0) return null
  const heaviest = last.reduce((best, set) => (set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best))
  const easy = feedbackFor(feedback, heaviest.sessionId, exercise.category)?.effort === 'easy'
  const reps = exercise.repRange.min
  const base = startingWeight(heaviest.weight, heaviest.reps, reps)
  return { weight: easy ? base + weightIncrement(exercise.name) : base, reps, fromWeight: heaviest.weight, fromReps: heaviest.reps, oneRepMax: estimateOneRepMax(heaviest.weight, heaviest.reps), easy }
}

/** The block that came before `currentBlockId`, judged by the most recent feedback from any other block. */
export function previousBlockId(feedback: SessionFeedback[], currentBlockId: string): string | null {
  const earlier = feedback.filter((entry) => entry.blockId !== currentBlockId).sort((a, b) => b.at.localeCompare(a.at))
  return earlier[0]?.blockId ?? null
}

/** Starting set offset per muscle group for a new block: last block's final change minus one, never below the plan. */
export function startingOffsets(feedback: SessionFeedback[], previousBlock: string | null): Partial<Record<MuscleGroup, number>> {
  if (!previousBlock) return {}
  const groups = new Set(feedback.filter((entry) => entry.blockId === previousBlock).map((entry) => entry.group))
  const result: Partial<Record<MuscleGroup, number>> = {}
  for (const group of groups) {
    const carried = Math.max(0, setOffset(feedback, previousBlock, group) - 1)
    if (carried > 0) result[group] = carried
  }
  return result
}
