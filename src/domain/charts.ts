import { historicalOneRepMax } from './repAdjust'
import { muscleGroups, type ExerciseCatalogItem, type MuscleGroup } from './program'
import type { CompletedSetRecord } from './storage'

/** Data for the Progress charts. Everything here is pure so it can be tested without drawing anything. */
export const rangeOptions = [4, 12, 26] as const
export type RangeWeeks = (typeof rangeOptions)[number]

const DAY = 86_400_000
const WEEK = 7 * DAY

/** Midnight at the start of the Monday of the week containing `date` (local time). */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

/** The first Monday shown when the chart covers the last `weeks` weeks including this one. */
export function rangeStart(weeks: number, now: Date): Date {
  const start = weekStart(now)
  start.setDate(start.getDate() - 7 * (weeks - 1))
  return start
}

export const shortDate = (value: Date | number): string => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const categoryOf = (catalog: ExerciseCatalogItem[], exerciseId: string): MuscleGroup | undefined => catalog.find((item) => item.id === exerciseId)?.category

/** Muscle groups that have any logged sets, in the library's order. */
export function trainedGroups(history: CompletedSetRecord[], catalog: ExerciseCatalogItem[]): MuscleGroup[] {
  const seen = new Set(history.map((set) => categoryOf(catalog, set.exerciseId)))
  return muscleGroups.filter((group) => seen.has(group))
}

/** 'lb' charts an estimated one-rep max; 'reps' is for bodyweight exercises (always logged at 0 lb), which have no max to estimate. */
export type TrendUnit = 'lb' | 'reps'

export interface SessionPoint {
  sessionId: string
  /** Time of the last set of the session, in ms. */
  t: number
  label: string
  /** Estimated one-rep max from the session's best set, or the most reps in a set for bodyweight exercises. */
  value: number
  unit: TrendUnit
  topWeight: number
  topReps: number
  weekNumber: number
}

/** One point per session of an exercise: its estimated max (best reps for bodyweight work). Deload sessions are left out (half weight by design). */
export function sessionPoints(history: CompletedSetRecord[], exerciseId: string, fromMs: number): SessionPoint[] {
  const bySession = new Map<string, CompletedSetRecord[]>()
  for (const set of history) {
    if (set.exerciseId !== exerciseId || set.deload) continue
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set])
  }
  const unit: TrendUnit = [...bySession.values()].every((sets) => sets.every((set) => set.weight === 0)) ? 'reps' : 'lb'
  const points: SessionPoint[] = []
  for (const [sessionId, sets] of bySession) {
    const value = unit === 'reps' ? Math.max(...sets.map((set) => set.reps)) : historicalOneRepMax(sets)
    if (value === null) continue
    const t = Math.max(...sets.map((set) => Date.parse(set.completedAt)))
    if (t < fromMs) continue
    const top = sets.reduce((best, set) => (set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best))
    points.push({ sessionId, t, label: shortDate(t), value, unit, topWeight: top.weight, topReps: top.reps, weekNumber: top.weekNumber })
  }
  return points.sort((a, b) => a.t - b.t)
}

export interface ExerciseOption { id: string; name: string; sessions: number }

/** Exercises with at least one non-deload session in range, most-trained first. */
export function exerciseOptions(history: CompletedSetRecord[], catalog: ExerciseCatalogItem[], group: MuscleGroup | null, fromMs: number): ExerciseOption[] {
  const ids = new Map<string, string>()
  for (const set of history) if (!set.deload && (!group || categoryOf(catalog, set.exerciseId) === group)) ids.set(set.exerciseId, catalog.find((item) => item.id === set.exerciseId)?.name ?? set.exerciseName)
  return [...ids.entries()]
    .map(([id, name]) => ({ id, name, sessions: sessionPoints(history, id, fromMs).length }))
    .filter((option) => option.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
}

export interface WeekBucket {
  start: Date
  label: string
  sets: number
  /** Total weight × reps. */
  volume: number
}

/** One bucket per week for the last `weeks` weeks (empty weeks included), counting every completed set, optionally for one muscle group. */
export function weeklyBuckets(history: CompletedSetRecord[], catalog: ExerciseCatalogItem[], group: MuscleGroup | null, weeks: number, now: Date): WeekBucket[] {
  const first = rangeStart(weeks, now)
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * index)
    return { start, label: shortDate(start), sets: 0, volume: 0 }
  })
  for (const set of history) {
    if (group && categoryOf(catalog, set.exerciseId) !== group) continue
    const index = Math.round((weekStart(new Date(set.completedAt)).getTime() - first.getTime()) / WEEK)
    if (index < 0 || index >= weeks) continue
    buckets[index].sets += 1
    buckets[index].volume += set.weight * set.reps
  }
  return buckets
}

/** Clean axis ticks covering [lo, hi]. `integer` keeps steps whole (for counts). */
export function niceTicks(lo: number, hi: number, target = 4, integer = false): { ticks: number[]; min: number; max: number } {
  const top = hi > lo ? hi : lo + 1
  const raw = (top - lo) / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude
  if (integer) step = Math.max(1, Math.ceil(step))
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(top / step) * step
  const ticks: number[] = []
  for (let value = min; value <= max + step / 2; value += step) ticks.push(Math.round(value * 100) / 100)
  return { ticks, min, max }
}
