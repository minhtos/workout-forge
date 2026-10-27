import { describe, expect, it } from 'vitest'
import { set } from './testSets'
import { addDays, completedSessions, dayKey, sessionsInWeek, weekKey, weekStart } from './weekly'

describe('week boundaries (Sunday to Saturday, local time)', () => {
  it('puts Saturday 23:59 in the old week and Sunday 00:00 in the new one', () => {
    expect(dayKey(weekStart(new Date(2026, 9, 17, 23, 59, 59)))).toBe('2026-10-11')
    expect(dayKey(weekStart(new Date(2026, 9, 18, 0, 0, 0)))).toBe('2026-10-18')
    expect(weekKey(new Date(2026, 9, 17, 23, 59))).toBe('2026-10-11')
    expect(weekKey(new Date(2026, 9, 18, 0, 0))).toBe('2026-10-18')
  })

  it('always returns a Sunday at local midnight, across both daylight-saving changes and the new year', () => {
    for (let day = new Date(2026, 0, 1, 12); day.getFullYear() === 2026; day = addDays(day, 1)) {
      const start = weekStart(day)
      expect([start.getDay(), start.getHours(), start.getMinutes()]).toEqual([0, 0, 0])
      expect(Math.round((addDays(day, 0).getTime() - start.getTime()) / 86_400_000)).toBeLessThan(7)
    }
    expect(dayKey(weekStart(new Date(2026, 0, 1)))).toBe('2025-12-28')
  })

  it('adds calendar days, so a daylight-saving week is still 7 dates long', () => {
    expect(dayKey(addDays(new Date(2026, 10, 1), 7))).toBe('2026-11-08')
    expect(dayKey(addDays(new Date(2026, 2, 8), 7))).toBe('2026-03-15')
    expect(dayKey(addDays(new Date(2026, 9, 11), -7))).toBe('2026-10-04')
  })

  it('formats day keys with zero padding', () => expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05'))
})

describe('completed sessions', () => {
  const history = [
    set('b', 1, new Date(2026, 9, 14, 18, 0)), set('b', 2, new Date(2026, 9, 14, 18, 5)),
    set('a', 1, new Date(2026, 9, 12, 9, 0)),
    set('live', 1, new Date(2026, 9, 15, 7, 0)),
  ]

  it('groups sets by session, oldest first, dated by the first set', () => {
    const sessions = completedSessions(history, null)
    expect(sessions.map((session) => session.sessionId)).toEqual(['a', 'b', 'live'])
    expect(sessions[1].start).toBe(new Date(2026, 9, 14, 18, 0).getTime())
    expect(sessions[1].sets).toHaveLength(2)
  })

  it('leaves out the session still in progress', () => {
    expect(completedSessions(history, 'live').map((session) => session.sessionId)).toEqual(['a', 'b'])
  })

  it('dates a session that runs past midnight by its first set', () => {
    const late = [set('n', 1, new Date(2026, 9, 17, 23, 50)), set('n', 2, new Date(2026, 9, 18, 0, 10))]
    const [session] = completedSessions(late, null)
    expect(weekKey(new Date(session.start))).toBe('2026-10-11')
  })

  it('marks a session as deload only when all its sets are', () => {
    const mixed = [set('d', 1, new Date(2026, 9, 12), { deload: true }), set('m', 1, new Date(2026, 9, 13), { deload: true }), set('m', 2, new Date(2026, 9, 13))]
    expect(completedSessions(mixed, null).map((session) => session.deload)).toEqual([true, false])
  })

  it('picks the sessions of one week by the week start', () => {
    const sessions = completedSessions([set('sat', 1, new Date(2026, 9, 17, 23, 59)), set('sun', 1, new Date(2026, 9, 18, 0, 0))], null)
    expect(sessionsInWeek(sessions, new Date(2026, 9, 11)).map((session) => session.sessionId)).toEqual(['sat'])
    expect(sessionsInWeek(sessions, new Date(2026, 9, 18)).map((session) => session.sessionId)).toEqual(['sun'])
  })
})
