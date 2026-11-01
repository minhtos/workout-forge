import { roundWeight } from './weights'
import { feedbackFor, leverOf, weightIncrement, type SessionFeedback } from './autoregulation'
import { anchorSlots, offsetKey, type Block, type ExerciseCatalogItem, type ExercisePrescription } from './program'
import type { CompletedSetRecord } from './storage'

/**
 * Block-to-block transition. When a new block starts (after the deload) Week 1 does not continue from the deload:
 *  - Weight: from the heaviest set of last block's 0 RIR week, as an estimated one-rep max (Epley), scaled to the weight
 *    that leaves 3 in reserve at the bottom of the rep range. If that week felt easy, add one weight step.
 *  - Reps: back to the bottom of the exercise's rep range.
 *  - Sets: the larger of the plan or last block's lever for the same first exercise minus one (see startingOffsets).
 */
export const estimateOneRepMax = (weight: number, reps: number): number => weight * (1 + reps / 30)

/** Weight at which `targetReps + 3` reps is the limit, i.e. `targetReps` with 3 in reserve. */
export function startingWeight(weight: number, reps: number, targetReps: number): number {
  return roundWeight(estimateOneRepMax(weight, reps) / (1 + (targetReps + 3) / 30))
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

/** A gap this long since the last workout is when a Comeback block is worth suggesting. */
export const comebackAfterDays = 28

/**
 * Whether to suggest the Comeback goal when planning a block: only for someone who has trained before and whose newest
 * set is at least 28 days old. Returns how many whole weeks it has been, or null. It is a suggestion only; nothing selects it.
 */
export function suggestComeback(history: CompletedSetRecord[], now: Date): { weeks: number } | null {
  if (!history.length) return null
  const newest = Math.max(...history.map((set) => Date.parse(set.completedAt)))
  const days = (now.getTime() - newest) / 86_400_000
  return days >= comebackAfterDays ? { weeks: Math.floor(days / 7) } : null
}

/** Whether a chained block (12 weeks = 2 × 6) has finished its first part and is waiting for the second. */
export const awaitingNextPart = (block: Block, finishedAll: boolean): boolean => block.locked && block.parts === 2 && (block.part ?? 1) === 1 && finishedAll

/**
 * Part 2 of a chained block: the same exercises, progress cleared, and a fresh start time, so it is treated like a new
 * block (Week 1 carries over from part 1's 0 RIR week, and sets carry over minus one).
 */
export function startNextPart(block: Block, feedback: SessionFeedback[], startedAt: string, catalog: ExerciseCatalogItem[]): Block {
  return { ...block, part: 2, locked: true, startedAt, startOffsets: startingOffsets(feedback, previousBlockId(feedback, startedAt), block, catalog), completedIds: [], skippedIds: [] }
}

/**
 * Starting set lever for a new block, keyed "templateIndex|group". Each template that checks a group in some week
 * inherits last block's lever for the same group and first exercise, minus one, never below the plan. A swapped first
 * exercise carries nothing, and neither does a template that never checks the group. Answers saved without an
 * exerciseId or templateIndex (older versions) cannot be matched and are not carried. Each lever starts from the
 * block's own startOffsets, so a block that began at +2 and heard nothing carries 1 (chained part 2 only: a fresh draft has none).
 */
export function startingOffsets(feedback: SessionFeedback[], previousBlock: string | null, block: Block, catalog: ExerciseCatalogItem[]): Record<string, number> {
  if (!previousBlock) return {}
  const answers = feedback.filter((entry) => entry.blockId === previousBlock && entry.soreness && entry.exerciseId && entry.templateIndex !== undefined)
  const result: Record<string, number> = {}
  for (const { templateIndex, group, exerciseId } of anchorSlots(block, catalog)) {
    const own = answers.filter((entry) => entry.templateIndex === templateIndex && entry.group === group && entry.exerciseId === exerciseId)
    const carried = Math.max(0, leverOf(own, block.startOffsets?.[offsetKey(templateIndex, group)] ?? 0) - 1)
    if (carried > 0) result[offsetKey(templateIndex, group)] = carried
  }
  return result
}
