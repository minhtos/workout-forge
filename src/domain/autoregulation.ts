import { roundWeight } from './weights'
import { anchorWorkout, firstExerciseOf, listWorkouts, offsetKey, type Block, type ExerciseCatalogItem, type ExercisePrescription, type MuscleGroup, type ScheduledWorkout } from './program'
import type { CompletedSetRecord, SetEntry } from './storage'

/**
 * Progression for RIR blocks. You pick a weight and reps that reach the week's target RIR; the app decides the next
 * session from what you did and three optional questions:
 *  - Soreness (asked once a week, after the first set of a muscle group's first exercise) -> sets on that exercise
 *  - Effort   (asked after the last exercise of a muscle group)   -> weight
 *  - Pump     (asked after the last exercise of a muscle group)   -> reps
 * Missed reps override the questions: weight only goes down when every set missed its reps, and a completed workout
 * with a few short sets repeats the weight and builds one rep on what you did. Deload weeks and linear (5x5) blocks
 * are never touched.
 */
export type Soreness = 'sore' | 'ontime' | 'early'
export type Effort = 'easy' | 'right' | 'hard'
export type Pump = 'low' | 'high'

export interface SessionFeedback {
  sessionId: string
  /** The block's start time, so set changes only carry through the block they were made in. */
  blockId: string
  group: MuscleGroup
  /** The workout the answer came from. Entries saved before this existed are matched through history instead. */
  workoutId?: string
  /** Soreness answers: the group's first planned exercise in that workout, the one whose sets the answer moves. */
  exerciseId?: string
  soreness?: Soreness
  effort?: Effort
  pump?: Pump
  /** The effort and pump questions were answered or skipped. */
  summaryDone?: boolean
  at: string
}

export const minSets = 2
export const ceilingSets = 6
export const maxSetOffset = 3

const sorenessDelta: Record<Soreness, number> = { sore: -1, ontime: 0, early: 1 }
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Net set change of some soreness answers on top of a starting value, never more than 3 either way. */
export function leverOf(answers: SessionFeedback[], startOffset = 0): number {
  // "Recovered early" adds a set, unless the same session was then rated too hard: no extra set for next time.
  const delta = (entry: SessionFeedback) => (entry.soreness === 'early' && entry.effort === 'hard' ? 0 : sorenessDelta[entry.soreness as Soreness])
  return clamp(startOffset + answers.filter((entry) => entry.soreness).reduce((sum, entry) => sum + delta(entry), 0), -maxSetOffset, maxSetOffset)
}

/** What the set lever needs to know: the answers, the block they belong to, and history to place answers saved without a workoutId. */
export interface OffsetContext { feedback: SessionFeedback[]; block: Block | null; catalog: ExerciseCatalogItem[]; history: CompletedSetRecord[] }

/** Whether this workout is the one that checks `group` in its week. */
export function isAnchor(block: Block | null, catalog: ExerciseCatalogItem[], workout: Pick<ScheduledWorkout, 'id' | 'weekNumber'>, group: MuscleGroup): boolean {
  return !!block && anchorWorkout(block, catalog, workout.weekNumber, group)?.id === workout.id
}

/**
 * Net set change for a muscle group in one workout, accumulated over the current block. Only the workout that checks the
 * group in its week has one, and it comes from that workout template's own earlier answers plus the carried-over start.
 * An answer saved before workoutId existed is placed through history (the workout its session was performed under) and
 * counts only if that workout was the week's check for the group; an unplaceable one moves nothing.
 */
export function workoutOffset(ctx: OffsetContext, workout: Pick<ScheduledWorkout, 'id' | 'weekNumber' | 'templateIndex'>, group: MuscleGroup): number {
  const { block, catalog, feedback, history } = ctx
  if (!block?.startedAt || !isAnchor(block, catalog, workout, group)) return 0
  const refs = listWorkouts(block)
  const counts = (entry: SessionFeedback): boolean => {
    const workoutId = entry.workoutId ?? history.find((set) => set.sessionId === entry.sessionId)?.workoutId
    const ref = refs.find((candidate) => candidate.id === workoutId)
    return !!ref && ref.templateIndex === workout.templateIndex && isAnchor(block, catalog, ref, group)
  }
  const answers = feedback.filter((entry) => entry.blockId === block.startedAt && entry.group === group && entry.soreness && counts(entry))
  return leverOf(answers, block.startOffsets?.[offsetKey(workout.templateIndex, group)] ?? 0)
}

/** Sets after applying the offset, never below 2 (or the planned count if lower) and never above 6 (or the planned count if higher). */
export function tunedSets(plannedSets: number, offset: number): number {
  return clamp(plannedSets + offset, Math.min(minSets, plannedSets), Math.max(ceilingSets, plannedSets))
}

/** Feedback only applies on RIR work weeks. */
export const usesFeedback = (workout: Pick<ScheduledWorkout, 'progression' | 'target'>): boolean => workout.progression === 'rir' && workout.target.kind === 'work'

/** The one place sets are tuned: each group's lever moves only its first planned exercise in the week's check workout. */
export function tuneWorkoutSets(workout: ScheduledWorkout, ctx: OffsetContext): ScheduledWorkout {
  if (!usesFeedback(workout)) return workout
  return { ...workout, exercises: workout.exercises.map((exercise) => (firstExerciseOf(workout, exercise.category) === exercise ? { ...exercise, sets: tunedSets(exercise.sets, workoutOffset(ctx, workout, exercise.category)) } : exercise)) }
}

export const feedbackFor = (feedback: SessionFeedback[], sessionId: string, group: MuscleGroup): SessionFeedback | undefined =>
  feedback.find((entry) => entry.sessionId === sessionId && entry.group === group)

export function upsertFeedback(feedback: SessionFeedback[], key: Pick<SessionFeedback, 'sessionId' | 'blockId' | 'group' | 'workoutId'>, patch: Partial<SessionFeedback>, at: string): SessionFeedback[] {
  const existing = feedbackFor(feedback, key.sessionId, key.group)
  if (!existing) return [...feedback, { ...key, ...patch, at }]
  return feedback.map((entry) => (entry === existing ? { ...entry, ...patch } : entry))
}

/** Union of two feedback lists (one entry per session and muscle group, the later one wins). */
export function mergeFeedback(a: SessionFeedback[], b: SessionFeedback[]): SessionFeedback[] {
  const merged = new Map<string, SessionFeedback>()
  for (const entry of [...a, ...b]) {
    const key = `${entry.sessionId}|${entry.group}`
    const known = merged.get(key)
    if (!known || entry.at > known.at) merged.set(key, entry)
  }
  return [...merged.values()].sort((x, y) => x.at.localeCompare(y.at))
}

/** Weight steps: 2.5 lb for dumbbell exercises, 5 lb for everything else. This is also the most weight added in a week. */
export const weightIncrement = (exerciseName: string): number => (/dumbbell/i.test(exerciseName) ? 2.5 : 5)

/** Reps short of the target the set was prefilled with. Records from before targets were stored count as hit. */
export const missedReps = (set: CompletedSetRecord): number => Math.max(0, (set.targetReps ?? set.reps) - set.reps)

/** Weight taken off an exercise that has stalled: two sessions in a row with missed reps at the same weight. */
export const stallDrop = 0.1

/** Two consecutive non-deload sessions with a missed set, both at the same top weight (a weight change resets the count). */
export function isStalled(last: CompletedSetRecord[], previous: CompletedSetRecord[]): boolean {
  if (!last.length || !previous.length) return false
  const top = (sets: CompletedSetRecord[]) => Math.max(...sets.map((set) => set.weight))
  return last.some((set) => missedReps(set) > 0) && previous.some((set) => missedReps(set) > 0) && top(last) === top(previous)
}

export interface NextTarget { weight: number; reps: number; note: string }

function previousFeedback(feedback: SessionFeedback[], current: SessionFeedback): SessionFeedback | undefined {
  return feedback.filter((entry) => entry.group === current.group && entry.at < current.at).sort((x, y) => y.at.localeCompare(x.at))[0]
}

/**
 * The target for one set next time, from last session's sets and the effort/pump answers given after it.
 *  0. Stalled (missed reps two sessions in a row at the same weight): weight drops 10%, same rep target.
 *  1. Every set missed its reps: weight drops one step, same rep target.
 *  2. Some sets missed (workout completed): weight stays; short sets start from what you did plus one rep.
 *  3. Every set hit its target: easy adds one weight step (reps stay unless the pump was low); just right keeps the
 *     weight and adds a rep (two if the pump was low twice in a row); too hard keeps the weight and still adds one
 *     rep. Past the top of the rep range the weight goes up one step and reps go back to the bottom. With no answers
 *     at all the default is one more rep.
 */
export function nextSetTarget(args: { exercise: ExercisePrescription; last: CompletedSetRecord[]; previous?: CompletedSetRecord[]; index: number; fb?: SessionFeedback; all: SessionFeedback[] }): NextTarget {
  const { exercise, last, index, fb, all } = args
  const base = last[index] ?? last[last.length - 1]
  const step = weightIncrement(exercise.name)

  if (isStalled(last, args.previous ?? [])) {
    const weight = roundWeight(Math.min(base.weight * (1 - stallDrop), base.weight - step))
    return { weight, reps: base.targetReps ?? base.reps, note: `Missed reps two sessions in a row: weight drops about ${stallDrop * 100}% to clear fatigue, same reps.` }
  }
  if (last.every((set) => missedReps(set) > 0)) {
    return { weight: roundWeight(base.weight - step), reps: base.targetReps ?? base.reps, note: `You missed reps on every set last time: weight drops ${step} lb.` }
  }
  if (last.some((set) => missedReps(set) > 0)) {
    const short = missedReps(base) > 0
    return { weight: roundWeight(base.weight), reps: short ? base.reps + 1 : base.reps, note: 'You fell short on some sets last time: weight stays, and those sets start from what you did plus a rep.' }
  }

  const answered = !!(fb?.effort || fb?.pump)
  const notes: string[] = []
  let weight = base.weight
  let repGain = 1
  if (fb && answered) {
    const pumpGain = fb.pump === 'low' ? (previousFeedback(all, fb)?.pump === 'low' ? 2 : 1) : 0
    if (fb.effort === 'easy') {
      weight += step
      repGain = pumpGain
      notes.push(`Last time was easy: +${step} lb.`)
    } else if (fb.effort === 'right') {
      repGain = Math.max(1, pumpGain)
      notes.push(`Effort was just right: same weight, +${repGain} rep${repGain > 1 ? 's' : ''}.`)
    } else if (fb.effort === 'hard') {
      repGain = 1
      notes.push('Last time was too hard: same weight, +1 rep, and no extra set next time.')
    } else repGain = pumpGain
    if (pumpGain > 0 && fb.effort !== 'right' && fb.effort !== 'hard') notes.push(`Low pump: +${pumpGain} rep${pumpGain > 1 ? 's' : ''}.`)
  } else notes.push('Add 1 rep.')
  let reps = base.reps + repGain
  if (reps > exercise.repRange.max) {
    reps = exercise.repRange.min
    weight = Math.max(weight, base.weight + step)
    notes.push(`Top of the rep range: +${step} lb, back to ${reps} reps.`)
  }
  return { weight: roundWeight(weight), reps, note: notes.join(' ') }
}

/** Sets after soreness changes during a session: grow or shrink the unfinished tail without touching finished sets. */
export function resizeEntries(entries: SetEntry[], count: number, maxSets = 10): SetEntry[] {
  const finished = entries.filter((entry) => entry.complete).length
  const target = clamp(count, Math.max(1, finished), maxSets)
  if (target === entries.length) return entries
  if (target < entries.length) return entries.slice(0, Math.max(target, finished))
  const last = entries[entries.length - 1]
  return [...entries, ...Array.from({ length: target - entries.length }, (): SetEntry => ({ weight: last?.weight ?? '', reps: last?.reps ?? '8', rir: last?.rir ?? '2', complete: false, targetReps: last?.targetReps }))]
}

export type FeedbackPrompt = { kind: 'soreness'; group: MuscleGroup } | { kind: 'summary'; group: MuscleGroup }

/**
 * The next question to ask, if any. Soreness comes after the first finished set of a group's first planned exercise,
 * only in the workout that checks the group that week (`anchors`) and only if that muscle group was trained before; if
 * that exercise is skipped there is no check. Effort and pump come after the whole group is finished, or, when
 * `finishing`, for any group with at least one finished set. Skipped exercises are ignored, so they never hold up a group.
 */
export function nextPrompt(args: {
  workout: ScheduledWorkout
  sets: Record<string, SetEntry[]>
  entries: SessionFeedback[]
  trainedBefore: (group: MuscleGroup) => boolean
  anchors: (group: MuscleGroup) => boolean
  finishing: boolean
  skipped?: string[]
}): FeedbackPrompt | null {
  const { workout, sets, entries, trainedBefore, anchors, finishing, skipped = [] } = args
  if (!usesFeedback(workout)) return null
  const groups = [...new Set(workout.exercises.map((exercise) => exercise.category))]
  const done = (id: string) => (sets[id]?.length ?? 0) > 0 && sets[id].every((entry) => entry.complete)
  const some = (id: string) => (sets[id] ?? []).some((entry) => entry.complete)
  for (const group of groups) {
    const exercises = workout.exercises.filter((exercise) => exercise.category === group && !skipped.includes(exercise.id))
    if (!exercises.length) continue
    const entry = entries.find((item) => item.group === group)
    const first = firstExerciseOf(workout, group)
    if (first && !skipped.includes(first.id) && some(first.id) && anchors(group) && trainedBefore(group) && !entry?.soreness) return { kind: 'soreness', group }
    const groupDone = exercises.every((exercise) => done(exercise.id))
    const groupStarted = exercises.some((exercise) => some(exercise.id))
    if ((groupDone || (finishing && groupStarted)) && !entry?.summaryDone) return { kind: 'summary', group }
  }
  return null
}
