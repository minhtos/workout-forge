import type { CompletedSetRecord } from './storage'

/**
 * The shared weekly layer. Every surface that talks about "a week" (charts, the muscle map, streak, heatmap, the weekly
 * report) goes through here, so they all agree: weeks run Sunday 00:00 to Saturday 23:59 in local time.
 */

/** Midnight at the start of the Sunday of the week containing `date` (local time). */
export function weekStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay())
}

/** Local midnight `days` calendar days after `date`'s own day (calendar arithmetic, so daylight-saving changes do not shift it). */
export const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/** Local calendar date as YYYY-MM-DD. */
export const dayKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** The week's Sunday as YYYY-MM-DD: the key for "which week". */
export const weekKey = (date: Date): string => dayKey(weekStart(date))

/** A finished workout: every set saved under one session id. Dated by its first set. */
export interface CompletedSession {
  sessionId: string
  /** Time of the session's first set, in ms. */
  start: number
  sets: CompletedSetRecord[]
  /** Done in a deload week. */
  deload: boolean
}

/**
 * Sessions with at least one saved set, oldest first. The session still in progress is left out: its sets are saved as
 * they are checked off, but the workout is not finished until the user ends it.
 */
export function completedSessions(history: CompletedSetRecord[], activeSessionId: string | null): CompletedSession[] {
  const bySession = new Map<string, CompletedSetRecord[]>()
  for (const set of history) {
    if (set.sessionId === activeSessionId) continue
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set])
  }
  return [...bySession.entries()]
    .map(([sessionId, sets]) => ({ sessionId, start: Math.min(...sets.map((set) => Date.parse(set.completedAt))), sets, deload: sets.every((set) => set.deload) }))
    .sort((a, b) => a.start - b.start || a.sessionId.localeCompare(b.sessionId))
}

/** Sessions that started in the Sun–Sat week beginning `start` (a week start). */
export const sessionsInWeek = (sessions: CompletedSession[], start: Date): CompletedSession[] => {
  const key = dayKey(start)
  return sessions.filter((session) => weekKey(new Date(session.start)) === key)
}

/**
 * Consecutive Sun–Sat weeks with at least one completed workout, ending at `from`. A week with no workouts ends the run.
 */
function streakFrom(sessions: CompletedSession[], from: Date): number {
  const trained = new Set(sessions.map((session) => weekKey(new Date(session.start))))
  let count = 0
  for (let cursor = from; trained.has(dayKey(cursor)); cursor = addDays(cursor, -7)) count += 1
  return count
}

/** The streak as of the end of the week beginning `start`. */
export const streakAsOf = (sessions: CompletedSession[], start: Date): number => streakFrom(sessions, start)

/**
 * The current streak. Counts back from this week if it already has a workout, otherwise from last week, so a week that is
 * merely quiet so far does not zero it.
 */
export function weekStreak(sessions: CompletedSession[], now: Date): number {
  const thisWeek = weekStart(now)
  return streakFrom(sessions, sessionsInWeek(sessions, thisWeek).length ? thisWeek : addDays(thisWeek, -7))
}

export const heatmapWeeks = 12

export interface HeatDay {
  date: Date
  key: string
  workouts: number
  sets: number
  /** 0 for a rest day, otherwise 1 to 4 relative to the busiest day in range. */
  level: 0 | 1 | 2 | 3 | 4
  label: string
}

export interface HeatWeek { start: Date; days: (HeatDay | null)[]; workouts: number; sets: number }

const weekdayShort = (date: Date): string => date.toLocaleDateString('en-US', { weekday: 'short' })
const monthDay = (date: Date): string => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * The last 12 weeks, oldest first, each with seven days (Sunday to Saturday). Days after today are `null` and not drawn.
 * A workout counts on the day of its first set.
 */
export function heatmap(sessions: CompletedSession[], now: Date): HeatWeek[] {
  const first = addDays(weekStart(now), -7 * (heatmapWeeks - 1))
  const today = dayKey(now)
  const perDay = new Map<string, { workouts: number; sets: number }>()
  for (const session of sessions) {
    const key = dayKey(new Date(session.start))
    const entry = perDay.get(key) ?? { workouts: 0, sets: 0 }
    perDay.set(key, { workouts: entry.workouts + 1, sets: entry.sets + session.sets.length })
  }
  const rangeEnd = dayKey(addDays(weekStart(now), 6))
  let busiest = 0
  for (const [key, entry] of perDay) if (key >= dayKey(first) && key <= rangeEnd) busiest = Math.max(busiest, entry.sets)

  return Array.from({ length: heatmapWeeks }, (_, weekIndex) => {
    const start = addDays(first, 7 * weekIndex)
    const days = Array.from({ length: 7 }, (_, dayIndex): HeatDay | null => {
      const date = addDays(start, dayIndex)
      const key = dayKey(date)
      if (key > today) return null
      const { workouts, sets } = perDay.get(key) ?? { workouts: 0, sets: 0 }
      const level = (sets === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((sets / busiest) * 4)))) as HeatDay['level']
      const label = `${weekdayShort(date)} ${monthDay(date)} · ${workouts === 0 ? 'rest day' : `${workouts} ${workouts === 1 ? 'workout' : 'workouts'} · ${sets} ${sets === 1 ? 'set' : 'sets'}`}`
      return { date, key, workouts, sets, level, label }
    })
    const drawn = days.filter((day): day is HeatDay => day !== null)
    return { start, days, workouts: drawn.reduce((sum, day) => sum + day.workouts, 0), sets: drawn.reduce((sum, day) => sum + day.sets, 0) }
  })
}
