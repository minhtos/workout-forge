import type { ExercisePrescription, MuscleGroup, ScheduledWorkout } from './program'
import type { CompletedSetRecord, SetEntry } from './storage'

/**
 * Feedback-driven progression for RIR blocks. Three questions, three levers:
 *  - Soreness (asked after the first exercise of a muscle group)  -> number of sets
 *  - Effort   (asked after the last exercise of a muscle group)   -> weight
 *  - Pump     (asked after the last exercise of a muscle group)   -> reps
 * Deload weeks and linear (5x5) blocks are never touched.
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
export const weightStep = 2.5

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

/** Weight change after a muscle group: easy +5% (+10% if you left 2+ reps in reserve beyond target), just right +2.5%, too hard 0%. */
export function weightPercent(effort: Effort, averageRirOverTarget: number): number {
  if (effort === 'hard') return 0
  if (effort === 'right') return 0.025
  return averageRirOverTarget >= 2 ? 0.1 : 0.05
}

/** Applies a percentage to a weight in 2.5 lb steps. A positive change is always at least one step. */
export function stepWeight(weight: number, percent: number): number {
  if (percent <= 0) return weight
  const stepped = Math.round((weight * (1 + percent)) / weightStep) * weightStep
  return Math.max(stepped, weight + weightStep)
}

export interface TunedSet { weight: number; reps: number }

/** How hard the last session was compared with its RIR target, on average. Positive means easier than planned. */
const rirOver = (last: CompletedSetRecord[]): number => last.reduce((sum, set) => sum + (set.rir - set.targetRir), 0) / Math.max(1, last.length)

function previousFeedback(feedback: SessionFeedback[], current: SessionFeedback): SessionFeedback | undefined {
  return feedback.filter((entry) => entry.group === current.group && entry.at < current.at).sort((x, y) => y.at.localeCompare(x.at))[0]
}

/**
 * Next session's target for one set, from last session's matching set and the feedback given after it.
 * Without an effort answer the weight falls back to the standard RIR suggestion. Low pump adds a rep
 * (two if the previous check was also low); past the top of the rep range it adds weight and starts over at the bottom.
 */
export function tunedPrefill(args: { exercise: ExercisePrescription; base: CompletedSetRecord; last: CompletedSetRecord[]; fb: SessionFeedback; all: SessionFeedback[]; fallbackWeight: number }): TunedSet & { note: string } {
  const { exercise, base, last, fb, all, fallbackWeight } = args
  const percent = fb.effort ? weightPercent(fb.effort, rirOver(last)) : null
  let weight = percent === null ? fallbackWeight : stepWeight(base.weight, percent)
  const repGain = fb.pump === 'low' ? (previousFeedback(all, fb)?.pump === 'low' ? 2 : 1) : 0
  let reps = base.reps + repGain
  const notes: string[] = []
  if (fb.effort === 'easy') notes.push(percent === 0.1 ? 'Last time was easy: +10% weight.' : 'Last time was easy: +5% weight.')
  else if (fb.effort === 'right') notes.push('Effort was just right: +2.5% weight.')
  else if (fb.effort === 'hard') notes.push('Last time was too hard: weight stays the same.')
  if (repGain > 0) notes.push(`Low pump: +${repGain} rep${repGain > 1 ? 's' : ''}.`)
  if (reps > exercise.repRange.max) {
    reps = exercise.repRange.min
    weight = Math.max(weight, stepWeight(base.weight, Math.max(percent ?? 0, 0.025)))
    notes.push(`Top of the rep range: more weight, back to ${reps} reps.`)
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
  return [...entries, ...Array.from({ length: target - entries.length }, (): SetEntry => ({ weight: last?.weight ?? '', reps: last?.reps ?? '8', rir: last?.rir ?? '2', complete: false }))]
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
