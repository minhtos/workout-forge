import type { ExercisePrescription, MuscleGroup, ScheduledWorkout } from './program'
import type { CompletedSetRecord, SetEntry } from './storage'

/**
 * Progression for RIR blocks. You pick a weight and reps that reach the week's target RIR; the app decides the next
 * session from what you did and three optional questions:
 *  - Soreness (asked after the first exercise of a muscle group)  -> number of sets
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

/** Net set change for a muscle group, accumulated over the current block. */
export function setOffset(feedback: SessionFeedback[], blockId: string | null, group: MuscleGroup): number {
  if (!blockId) return 0
  const total = feedback.filter((entry) => entry.blockId === blockId && entry.group === group && entry.soreness).reduce((sum, entry) => sum + sorenessDelta[entry.soreness as Soreness], 0)
  return clamp(total, -maxSetOffset, maxSetOffset)
}

/** Sets after applying the offset, never below 2 (or the planned count if lower) and never above 6 (or the planned count if higher). */
export function tunedSets(plannedSets: number, offset: number): number {
  return clamp(plannedSets + offset, Math.min(minSets, plannedSets), Math.max(ceilingSets, plannedSets))
}

/** Feedback only applies on RIR work weeks. */
export const usesFeedback = (workout: Pick<ScheduledWorkout, 'progression' | 'target'>): boolean => workout.progression === 'rir' && workout.target.kind === 'work'

export function tuneWorkoutSets(workout: ScheduledWorkout, feedback: SessionFeedback[], blockId: string | null): ScheduledWorkout {
  if (!usesFeedback(workout)) return workout
  return { ...workout, exercises: workout.exercises.map((exercise) => ({ ...exercise, sets: tunedSets(exercise.sets, setOffset(feedback, blockId, exercise.category)) })) }
}

export const feedbackFor = (feedback: SessionFeedback[], sessionId: string, group: MuscleGroup): SessionFeedback | undefined =>
  feedback.find((entry) => entry.sessionId === sessionId && entry.group === group)

export function upsertFeedback(feedback: SessionFeedback[], key: Pick<SessionFeedback, 'sessionId' | 'blockId' | 'group'>, patch: Partial<SessionFeedback>, at: string): SessionFeedback[] {
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

export interface NextTarget { weight: number; reps: number; note: string }

function previousFeedback(feedback: SessionFeedback[], current: SessionFeedback): SessionFeedback | undefined {
  return feedback.filter((entry) => entry.group === current.group && entry.at < current.at).sort((x, y) => y.at.localeCompare(x.at))[0]
}

/**
 * The target for one set next time, from last session's sets and the effort/pump answers given after it.
 *  1. Every set missed its reps: weight drops one step, same rep target.
 *  2. Some sets missed (workout completed): weight stays; short sets start from what you did plus one rep.
 *  3. Every set hit its target: easy adds one weight step; low pump adds a rep (two if the check before was also low,
 *     none if it was too hard). Past the top of the rep range the weight goes up one step and reps go back to the
 *     bottom. With no answers at all the default is one more rep.
 */
export function nextSetTarget(args: { exercise: ExercisePrescription; last: CompletedSetRecord[]; index: number; fb?: SessionFeedback; all: SessionFeedback[] }): NextTarget {
  const { exercise, last, index, fb, all } = args
  const base = last[index] ?? last[last.length - 1]
  const step = weightIncrement(exercise.name)

  if (last.every((set) => missedReps(set) > 0)) {
    return { weight: Math.max(0, base.weight - step), reps: base.targetReps ?? base.reps, note: `You missed reps on every set last time: weight drops ${step} lb.` }
  }
  if (last.some((set) => missedReps(set) > 0)) {
    const short = missedReps(base) > 0
    return { weight: base.weight, reps: short ? base.reps + 1 : base.reps, note: 'You fell short on some sets last time: weight stays, and those sets start from what you did plus a rep.' }
  }

  const answered = !!(fb?.effort || fb?.pump)
  const notes: string[] = []
  let weight = base.weight
  let repGain = 1
  if (fb && answered) {
    if (fb.effort === 'easy') { weight += step; notes.push(`Last time was easy: +${step} lb.`) }
    else if (fb.effort === 'right') notes.push('Effort was just right: same weight.')
    else if (fb.effort === 'hard') notes.push('Last time was too hard: same weight, no added reps.')
    repGain = fb.pump === 'low' && fb.effort !== 'hard' ? (previousFeedback(all, fb)?.pump === 'low' ? 2 : 1) : 0
    if (repGain > 0) notes.push(`Low pump: +${repGain} rep${repGain > 1 ? 's' : ''}.`)
  } else notes.push('Add 1 rep.')
  let reps = base.reps + repGain
  if (reps > exercise.repRange.max) {
    reps = exercise.repRange.min
    weight = Math.max(weight, base.weight + step)
    notes.push(`Top of the rep range: +${step} lb, back to ${reps} reps.`)
  }
  return { weight, reps, note: notes.join(' ') }
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
 * The next question to ask, if any. Soreness comes after the first exercise of a group is finished (only if that
 * muscle group was trained before). Effort and pump come after the whole group is finished, or, when
 * `finishing`, for any group with at least one finished set.
 */
export function nextPrompt(args: {
  workout: ScheduledWorkout
  sets: Record<string, SetEntry[]>
  entries: SessionFeedback[]
  trainedBefore: (group: MuscleGroup) => boolean
  finishing: boolean
}): FeedbackPrompt | null {
  const { workout, sets, entries, trainedBefore, finishing } = args
  if (!usesFeedback(workout)) return null
  const groups = [...new Set(workout.exercises.map((exercise) => exercise.category))]
  const done = (id: string) => (sets[id]?.length ?? 0) > 0 && sets[id].every((entry) => entry.complete)
  const some = (id: string) => (sets[id] ?? []).some((entry) => entry.complete)
  for (const group of groups) {
    const exercises = workout.exercises.filter((exercise) => exercise.category === group)
    const entry = entries.find((item) => item.group === group)
    if (done(exercises[0].id) && trainedBefore(group) && !entry?.soreness) return { kind: 'soreness', group }
    const groupDone = exercises.every((exercise) => done(exercise.id))
    const groupStarted = exercises.some((exercise) => some(exercise.id))
    if ((groupDone || (finishing && groupStarted)) && !entry?.summaryDone) return { kind: 'summary', group }
  }
  return null
}
