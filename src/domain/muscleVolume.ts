import { categoryOf } from './charts'
import { listWorkouts, muscleGroups, nextWorkout, resolveWorkout, type Block, type ExerciseCatalogItem, type MuscleGroup } from './program'
import { addDays, sessionsInWeek, weekStart, type CompletedSession } from './weekly'

/** Planned sets per muscle group for one training week. */
export type PlanTargets = Partial<Record<MuscleGroup, number>>

export interface GroupVolume {
  group: MuscleGroup
  sets: number
  /** Weight × reps. */
  volume: number
  /** Planned sets this week, or null when there is no plan to compare with. */
  target: number | null
}

export interface MuscleVolume {
  weekStart: Date
  /** Only groups with sets or a target, most sets first (ties in library order). */
  rows: GroupVolume[]
  /** Sets of the busiest group: the full width of a bar. */
  maxSets: number
  /** Every set of the week, including sets for exercises no longer in the library (those have no group, so no row). */
  totalSets: number
  totalVolume: number
  workouts: number
}

/**
 * What the active block asks for this week: the template sets per muscle group over the training days of the week the
 * user is on (rotation-aware). Null with no started block or in a deload week, where "sets to go" would mislead.
 */
export function planTargets(block: Block | null, catalog: ExerciseCatalogItem[]): PlanTargets | null {
  if (!block?.locked) return null
  const upcoming = nextWorkout(block)
  if (!upcoming || upcoming.target.kind === 'deload') return null
  const targets: PlanTargets = {}
  for (const ref of listWorkouts(block).filter((workout) => workout.weekNumber === upcoming.weekNumber)) {
    for (const exercise of resolveWorkout(block, ref, catalog).exercises) targets[exercise.category] = (targets[exercise.category] ?? 0) + exercise.sets
  }
  return Object.keys(targets).length ? targets : null
}

/** Sets and volume per muscle group for the Sun–Sat week beginning `week`. Deload sets count; a group is its exercise's library category. */
export function muscleVolume(sessions: CompletedSession[], catalog: ExerciseCatalogItem[], week: Date, targets: PlanTargets | null = null): MuscleVolume {
  const inWeek = sessionsInWeek(sessions, week)
  const byGroup = new Map<MuscleGroup, { sets: number; volume: number }>()
  let totalSets = 0
  let totalVolume = 0
  for (const session of inWeek) {
    for (const set of session.sets) {
      totalSets += 1
      totalVolume += set.weight * set.reps
      const group = categoryOf(catalog, set.exerciseId)
      if (!group) continue
      const entry = byGroup.get(group) ?? { sets: 0, volume: 0 }
      byGroup.set(group, { sets: entry.sets + 1, volume: entry.volume + set.weight * set.reps })
    }
  }
  const rows = muscleGroups
    .map((group): GroupVolume => ({ group, sets: byGroup.get(group)?.sets ?? 0, volume: byGroup.get(group)?.volume ?? 0, target: targets ? (targets[group] ?? 0) : null }))
    .filter((row) => row.sets > 0 || (row.target ?? 0) > 0)
    .sort((a, b) => b.sets - a.sets)
  return { weekStart: week, rows, maxSets: Math.max(0, ...rows.map((row) => row.sets)), totalSets, totalVolume, workouts: inWeek.length }
}

export type MuscleMapView =
  | { kind: 'this'; data: MuscleVolume }
  | { kind: 'last'; data: MuscleVolume }
  /** Nothing to draw. `first` is true when there is no completed workout at all. */
  | { kind: 'empty'; first: boolean }

const hasGroupSets = (data: MuscleVolume): boolean => data.rows.some((row) => row.sets > 0)

/** This week's map, or last week's while this week is still empty (without plan targets, which belong to this week), or nothing. */
export function muscleMapView(sessions: CompletedSession[], catalog: ExerciseCatalogItem[], now: Date, targets: PlanTargets | null): MuscleMapView {
  const thisWeek = weekStart(now)
  const current = muscleVolume(sessions, catalog, thisWeek, targets)
  if (hasGroupSets(current)) return { kind: 'this', data: current }
  const last = muscleVolume(sessions, catalog, addDays(thisWeek, -7))
  if (hasGroupSets(last)) return { kind: 'last', data: last }
  return { kind: 'empty', first: sessions.length === 0 }
}
