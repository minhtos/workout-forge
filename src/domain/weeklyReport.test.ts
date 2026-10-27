import { describe, expect, it } from 'vitest'
import { findPersonalRecord } from './personalRecord'
import { set } from './testSets'
import { completedSessions } from './weekly'
import { showReportOnToday, weeklyReport } from './weeklyReport'

// Weeks run Sunday to Saturday. "Last week" below is Sun 4 Oct to Sat 10 Oct 2026.
const bench = (id: string, index: number, day: Date, weight: number, reps = 10) => set(id, index, day, { weight, reps })
const squat = { exerciseId: 'barbell-squat', exerciseName: 'Barbell Squat' }
const pullUps = { exerciseId: 'pull-ups', exerciseName: 'Pull-ups', weight: 0 }
const NOW = new Date(2026, 9, 12, 12) // Monday 12 Oct

const older = [bench('o', 1, new Date(2026, 8, 29, 12), 100), set('o', 2, new Date(2026, 8, 29, 12, 5), { ...pullUps, reps: 6 })]
const lastWeek = [
  bench('p', 1, new Date(2026, 9, 6, 12), 110), bench('p', 2, new Date(2026, 9, 6, 12, 5), 110),
  bench('r', 1, new Date(2026, 9, 8, 12), 125),
  set('r', 2, new Date(2026, 9, 8, 12, 5), { ...pullUps, reps: 8 }),
  set('d', 1, new Date(2026, 9, 9, 12), { ...squat, weight: 200, reps: 5, deload: true }),
]
const history = [...older, ...lastWeek]

describe('weeklyReport', () => {
  it('covers the last finished Sun–Sat week', () => {
    const report = weeklyReport(history, null, NOW)!
    expect(report.weekKey).toBe('2026-10-04')
    expect([report.weekStart.getMonth(), report.weekStart.getDate(), report.weekStart.getDay()]).toEqual([9, 4, 0])
  })

  it('totals workouts, sets and volume, deload sets included', () => {
    const report = weeklyReport(history, null, NOW)!
    expect(report.workouts).toBe(3)
    expect(report.sets).toBe(5)
    expect(report.volume).toBe(110 * 10 * 2 + 125 * 10 + 0 + 200 * 5)
  })

  it('does not count anything from the current week, or the workout in progress', () => {
    const thisWeek = [bench('n', 1, new Date(2026, 9, 11, 9), 300), bench('live', 1, new Date(2026, 9, 9, 23, 30), 300)]
    expect(weeklyReport([...history, ...thisWeek], null, NOW)!.workouts).toBe(4)
    expect(weeklyReport([...history, ...thisWeek], 'live', NOW)!.workouts).toBe(3)
    expect(weeklyReport([...history, ...thisWeek], 'live', NOW)!.sets).toBe(5)
  })

  it('reports Saturday night in the finished week and Sunday morning in the next', () => {
    const edge = [bench('sat', 1, new Date(2026, 9, 10, 23, 59), 100), bench('sun', 1, new Date(2026, 9, 11, 0, 0), 100), ...older]
    expect(weeklyReport(edge, null, NOW)!.workouts).toBe(1)
    expect(weeklyReport(edge, null, new Date(2026, 9, 18, 8))!.workouts).toBe(1)
    expect(weeklyReport(edge, null, new Date(2026, 9, 18, 8))!.weekKey).toBe('2026-10-11')
  })

  it('has nothing to report until something was logged before this week', () => {
    expect(weeklyReport([], null, NOW)).toBeNull()
    expect(weeklyReport([bench('n', 1, new Date(2026, 9, 12, 8), 100)], null, NOW)).toBeNull()
    expect(weeklyReport(lastWeek, 'p', new Date(2026, 9, 12))?.workouts).toBe(2)
  })

  it('gives a week with no workouts a report of zeros', () => {
    const report = weeklyReport(older, null, NOW)!
    expect([report.workouts, report.sets, report.volume, report.streak, report.records]).toEqual([0, 0, 0, 0, []])
  })

  it('counts the streak as of the end of the reported week', () => {
    expect(weeklyReport(history, null, NOW)!.streak).toBe(2)
    const later = [...history, bench('n', 1, new Date(2026, 9, 12, 8), 100), bench('m', 1, new Date(2026, 9, 20, 8), 100)]
    expect(weeklyReport(later, null, NOW)!.streak).toBe(2)
  })
})

describe('weeklyReport personal records', () => {
  it('uses the in-workout definition: one row per exercise, with the biggest margin of the week', () => {
    const report = weeklyReport(history, null, NOW)!
    const viaBanner = findPersonalRecord(history.filter((entry) => ['o', 'p', 'r'].includes(entry.sessionId)), 'r', 'barbell-bench-press')!
    const benchRow = report.records.find((record) => record.exerciseId === 'barbell-bench-press')!
    expect(benchRow.margin).toBe(viaBanner.margin)
    expect(benchRow.set).toEqual(viaBanner.set)
    expect(report.records.filter((record) => record.exerciseId === 'barbell-bench-press')).toHaveLength(1)
    expect(benchRow.exerciseName).toBe('Barbell Bench Press')
  })

  it('counts bodyweight exercises in reps', () => {
    const row = weeklyReport(history, null, NOW)!.records.find((record) => record.exerciseId === 'pull-ups')!
    expect([row.unit, row.margin]).toEqual(['reps', 2])
  })

  it('never counts a deload session', () => {
    expect(weeklyReport(history, null, NOW)!.records.some((record) => record.exerciseId === 'barbell-squat')).toBe(false)
  })

  it('sorts the biggest margin first', () => {
    const margins = weeklyReport(history, null, NOW)!.records.map((record) => record.margin)
    expect(margins).toEqual([...margins].sort((a, b) => b - a))
  })

  it('keeps an earlier record when a later, heavier workout comes along', () => {
    const before = weeklyReport(history, null, NOW)!.records
    const heavier = [...history, bench('later', 1, new Date(2026, 9, 11, 12), 300), bench('later2', 1, new Date(2026, 9, 14, 12), 400)]
    expect(weeklyReport(heavier, null, NOW)!.records).toEqual(before)
  })

  it('does not award a record to a workout that only matched the best so far', () => {
    const tied = [...older, bench('t', 1, new Date(2026, 9, 6, 12), 100)]
    expect(weeklyReport(tied, null, NOW)!.records).toEqual([])
  })

  it('does not award a record for the first time an exercise is logged', () => {
    expect(weeklyReport([...older.slice(0, 1), set('x', 1, new Date(2026, 9, 6), { ...squat, weight: 500 })], null, NOW)!.records).toEqual([])
  })
})

describe('showReportOnToday', () => {
  const sessionsAt = (extra = [] as typeof history, active: string | null = null) => completedSessions([...history, ...extra], active)
  const verdict = (now: Date, options: { extra?: typeof history; active?: string | null; dismissed?: string | null } = {}) => {
    const all = [...history, ...(options.extra ?? [])]
    return showReportOnToday(weeklyReport(all, options.active ?? null, now), sessionsAt(options.extra, options.active ?? null), now, options.dismissed ?? null)
  }
  // `history` has workouts in the weeks of Sep 27 and Oct 4 (Sun–Sat), so for any "now" from Sun Oct 11 on, the report is for the week of Oct 4.

  it('is hidden on the Saturday that ends a week with workouts (the report is for the week before, and this week already has workouts)', () => {
    expect(verdict(new Date(2026, 9, 10, 23, 59, 59))).toBe(false)
  })

  it('shows from Sunday 00:00', () => {
    expect(verdict(new Date(2026, 9, 11, 0, 0, 0))).toBe(true)
  })

  it('shows through the week while there is no completed workout in it', () => {
    expect(verdict(new Date(2026, 9, 14, 12))).toBe(true)
    expect(verdict(new Date(2026, 9, 17, 23, 59, 59))).toBe(true)
  })

  it('hides after the first completed workout of the new week, even one at Sunday 00:00', () => {
    expect(verdict(new Date(2026, 9, 15, 12), { extra: [bench('n', 1, new Date(2026, 9, 13, 8), 100)] })).toBe(false)
    expect(verdict(new Date(2026, 9, 15, 12), { extra: [bench('sun', 1, new Date(2026, 9, 11, 0, 0, 0), 100)] })).toBe(false)
  })

  it('shows again the Sunday after, with the new week in it', () => {
    const extra = [bench('n', 1, new Date(2026, 9, 13, 8), 100)]
    const sunday = new Date(2026, 9, 18, 0, 0, 0)
    expect(verdict(sunday, { extra })).toBe(true)
    expect(weeklyReport([...history, ...extra], null, sunday)!.weekKey).toBe('2026-10-11')
  })

  it('is not hidden by a workout that is still in progress', () => {
    const live = [bench('live', 1, new Date(2026, 9, 13, 8), 100)]
    expect(verdict(new Date(2026, 9, 15, 12), { extra: live, active: 'live' })).toBe(true)
  })

  it('stays hidden once dismissed, but only for that week', () => {
    const now = new Date(2026, 9, 12, 12)
    expect(verdict(now, { dismissed: '2026-10-04' })).toBe(false)
    expect(verdict(now, { dismissed: '2026-09-27' })).toBe(true)
    expect(verdict(now, { dismissed: null })).toBe(true)
  })

  it('is hidden on Today, but still reportable, when last week had no workouts', () => {
    const now = new Date(2026, 9, 19, 9)
    expect(weeklyReport(history, null, now)?.workouts).toBe(0)
    expect(verdict(now)).toBe(false)
  })

  it('is hidden with no report at all', () => {
    expect(showReportOnToday(null, [], NOW, null)).toBe(false)
  })
})
