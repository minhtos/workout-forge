import { describe, expect, it } from 'vitest'
import { set } from './testSets'
import { completedSessions, heatmap, heatmapWeeks, streakAsOf, weekStreak } from './weekly'

const NOW = new Date(2026, 9, 14, 12) // Wednesday 14 Oct 2026; this week began Sunday 11 Oct
const on = (id: string, month: number, day: number, hour = 12, sets = 1) => Array.from({ length: sets }, (_, index) => set(id, index + 1, new Date(2026, month - 1, day, hour, index)))
const sessionsOf = (...groups: ReturnType<typeof on>[]) => completedSessions(groups.flat(), null)

describe('weekStreak', () => {
  it('is 0 with no workouts', () => expect(weekStreak([], NOW)).toBe(0))

  it('counts consecutive Sun–Sat weeks with a workout, starting from this week when it has one', () => {
    expect(weekStreak(sessionsOf(on('a', 10, 13), on('b', 10, 6), on('c', 9, 29)), NOW)).toBe(3)
  })

  it('starts from last week while this week is still quiet', () => {
    expect(weekStreak(sessionsOf(on('b', 10, 6), on('c', 9, 29)), NOW)).toBe(2)
  })

  it('does not count two workouts in a week twice', () => {
    expect(weekStreak(sessionsOf(on('a', 10, 12), on('b', 10, 14), on('c', 10, 7)), NOW)).toBe(2)
  })

  it('stops at the first empty week', () => {
    expect(weekStreak(sessionsOf(on('a', 10, 13), on('b', 10, 6), on('d', 9, 22)), NOW)).toBe(2)
  })

  it('is 0 once a whole week has passed with nothing and this week is quiet too', () => {
    expect(weekStreak(sessionsOf(on('d', 9, 29)), NOW)).toBe(0)
  })

  it('puts Saturday night and Sunday morning in different weeks', () => {
    const satAndSun = sessionsOf(on('sat', 10, 10, 23), on('sun', 10, 11, 0))
    expect(weekStreak(satAndSun, NOW)).toBe(2)
    const satOnly = sessionsOf(on('sat', 10, 10, 23))
    expect(weekStreak(satOnly, new Date(2026, 9, 10, 23, 59))).toBe(1)
    expect(weekStreak(satOnly, new Date(2026, 9, 11, 0, 0))).toBe(1)
    expect(weekStreak(satOnly, new Date(2026, 9, 18, 0, 0))).toBe(0)
  })

  it('does not count the workout in progress', () => {
    const live = completedSessions([...on('live', 10, 13), ...on('b', 10, 6)], 'live')
    expect(weekStreak(live, NOW)).toBe(1)
  })

  it('counts a deload-week workout like any other', () => {
    const deload = completedSessions([set('d', 1, new Date(2026, 9, 13), { deload: true })], null)
    expect(weekStreak(deload, NOW)).toBe(1)
  })
})

describe('streakAsOf', () => {
  it('counts back from a given week, ignoring everything after it', () => {
    const sessions = sessionsOf(on('a', 10, 13), on('b', 10, 6), on('c', 9, 29), on('e', 9, 15))
    expect(streakAsOf(sessions, new Date(2026, 9, 4))).toBe(2)
    expect(streakAsOf(sessions, new Date(2026, 8, 13))).toBe(1)
    expect(streakAsOf(sessions, new Date(2026, 8, 20))).toBe(0)
  })
})

describe('heatmap', () => {
  const sessions = sessionsOf(on('a', 10, 12, 9, 18), on('b', 10, 5, 9, 6), on('c', 10, 5, 18, 3), on('d', 8, 3, 9, 2))
  const weeks = heatmap(sessions, NOW)
  const days = weeks.flatMap((week) => week.days).filter((day) => day !== null)

  it('is 12 weeks of 7 days, oldest first, each week starting on a Sunday', () => {
    expect(weeks).toHaveLength(heatmapWeeks)
    expect(weeks.every((week) => week.days.length === 7 && week.start.getDay() === 0)).toBe(true)
    expect([weeks[0].start.getMonth(), weeks[0].start.getDate()]).toEqual([6, 26])
    expect(weeks[11].start.getDate()).toBe(11)
    expect(weeks[0].days.map((day) => day?.date.getDay())).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('does not draw days after today', () => {
    expect(weeks[11].days.map((day) => day !== null)).toEqual([true, true, true, true, false, false, false])
    expect(days).toHaveLength(11 * 7 + 4)
  })

  it('draws a full last week on a Saturday and one day on a Sunday', () => {
    expect(heatmap([], new Date(2026, 9, 17, 23, 59))[11].days.every((day) => day !== null)).toBe(true)
    expect(heatmap([], new Date(2026, 9, 18, 0, 0))[11].days.map((day) => day !== null)).toEqual([true, false, false, false, false, false, false])
  })

  it('scales levels against the busiest day in range, ceil(sets / busiest × 4), with 0 for a rest day', () => {
    const level = (month: number, day: number) => days.find((entry) => entry.key === `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)?.level
    expect(level(10, 12)).toBe(4) // 18 of 18
    expect(level(10, 5)).toBe(2) // 9 of 18 across two workouts: 2.0
    expect(level(10, 13)).toBe(0)
    expect(level(10, 11)).toBe(0)
    const small = heatmap(sessionsOf(on('x', 10, 12, 9, 18), on('y', 10, 13, 9, 1), on('z', 10, 14, 9, 5)), NOW).flatMap((week) => week.days)
    expect(small.filter((day) => day && day.sets > 0).map((day) => day!.level)).toEqual([4, 1, 2])
  })

  it('ignores workouts older than the 12 weeks when finding the busiest day', () => {
    const old = sessionsOf(on('old', 1, 5, 9, 40), on('a', 10, 12, 9, 4))
    expect(heatmap(old, NOW).flatMap((week) => week.days).find((day) => day?.key === '2026-10-12')?.level).toBe(4)
  })

  it('writes a label with the weekday, date, workouts and sets', () => {
    expect(days.find((day) => day.key === '2026-10-12')?.label).toBe('Mon Oct 12 · 1 workout · 18 sets')
    expect(days.find((day) => day.key === '2026-10-05')?.label).toBe('Mon Oct 5 · 2 workouts · 9 sets')
    expect(days.find((day) => day.key === '2026-10-13')?.label).toBe('Tue Oct 13 · rest day')
  })

  it('totals each week for the table view', () => {
    expect([weeks[10].workouts, weeks[10].sets, weeks[11].workouts, weeks[11].sets]).toEqual([2, 9, 1, 18])
  })

  it('counts a workout on the day of its first set, even when it runs past midnight', () => {
    const late = completedSessions([set('n', 1, new Date(2026, 9, 12, 23, 55)), set('n', 2, new Date(2026, 9, 13, 0, 10))], null)
    const grid = heatmap(late, NOW).flatMap((week) => week.days)
    expect(grid.find((day) => day?.key === '2026-10-12')?.sets).toBe(2)
    expect(grid.find((day) => day?.key === '2026-10-13')?.sets).toBe(0)
  })
})
