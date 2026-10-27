import { findPersonalRecord, type PersonalRecord } from './personalRecord'
import type { CompletedSetRecord } from './storage'
import { addDays, completedSessions, dayKey, sessionsInWeek, streakAsOf, weekStart, type CompletedSession } from './weekly'

export interface ReportRecord extends PersonalRecord {
  exerciseId: string
  exerciseName: string
}

/** What happened in the last finished Sun–Sat week. */
export interface WeeklyReport {
  /** The week's Sunday, local midnight. */
  weekStart: Date
  /** The week's Sunday as YYYY-MM-DD: what a dismissal remembers. */
  weekKey: string
  workouts: number
  sets: number
  /** Weight × reps. */
  volume: number
  /** Consecutive weeks with a workout, ending with this one. */
  streak: number
  /** One per exercise: the biggest personal record of the week. */
  records: ReportRecord[]
}

/**
 * Personal records set during the week's workouts, using the same definition as the in-workout banner
 * (`findPersonalRecord`). Each workout is judged against what was logged before it, so a heavier workout
 * later on never erases an earlier record.
 */
function weekRecords(history: CompletedSetRecord[], sessions: CompletedSession[]): ReportRecord[] {
  const best = new Map<string, ReportRecord>()
  for (const session of sessions) {
    const known = history.filter((set) => set.sessionId === session.sessionId || Date.parse(set.completedAt) < session.start)
    for (const exerciseId of new Set(session.sets.filter((set) => !set.deload).map((set) => set.exerciseId))) {
      const record = findPersonalRecord(known, session.sessionId, exerciseId)
      if (record && record.margin > (best.get(exerciseId)?.margin ?? 0)) best.set(exerciseId, { ...record, exerciseId, exerciseName: record.set.exerciseName })
    }
  }
  return [...best.values()].sort((a, b) => b.margin - a.margin || a.exerciseName.localeCompare(b.exerciseName))
}

/**
 * The report for the most recent finished Sun–Sat week (the one before `now`'s week), or null when nothing was logged
 * before this week so there is nothing to look back on. A week with no workouts still gets a report, of zeros.
 */
export function weeklyReport(history: CompletedSetRecord[], activeSessionId: string | null, now: Date): WeeklyReport | null {
  const sessions = completedSessions(history, activeSessionId)
  const thisWeek = weekStart(now)
  if (!sessions.some((session) => session.start < thisWeek.getTime())) return null
  const start = addDays(thisWeek, -7)
  const inWeek = sessionsInWeek(sessions, start)
  const sets = inWeek.flatMap((session) => session.sets)
  return {
    weekStart: start,
    weekKey: dayKey(start),
    workouts: inWeek.length,
    sets: sets.length,
    volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
    streak: streakAsOf(sessions, start),
    records: weekRecords(history, inWeek),
  }
}

/**
 * Whether Today shows the report card: from Sunday 00:00 until the new week's first completed workout, unless it was
 * dismissed (a dismissal remembers the reported week's Sunday) or the week had no workouts to report.
 */
export function showReportOnToday(report: WeeklyReport | null, sessions: CompletedSession[], now: Date, dismissedWeek: string | null): report is WeeklyReport {
  return report !== null && report.workouts > 0 && sessionsInWeek(sessions, weekStart(now)).length === 0 && dismissedWeek !== report.weekKey
}
