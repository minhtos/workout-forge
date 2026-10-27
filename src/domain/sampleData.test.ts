import { describe, expect, it } from 'vitest'
import { findPersonalRecord } from './personalRecord'
import { baseExercises } from './program'
import { muscleVolume } from './muscleVolume'
import { sampleHistory, sampleNow, sampleRecordSessionId, sampleWeek, sampleWeekStart } from './sampleData'
import { completedSessions, weekKey } from './weekly'

describe('landing sample data', () => {
  it('is built from the Push | Pull | Legs week the page shows', () => {
    expect(sampleWeek.map((workout) => workout.title)).toEqual(['Push', 'Pull', 'Legs'])
    const logged = new Set(sampleHistory.map((set) => set.exerciseId))
    for (const workout of sampleWeek) for (const exercise of workout.exercises) expect(logged.has(exercise.id)).toBe(true)
  })

  it('has two Push sessions, and the later bench press beats the earlier one', () => {
    const benchSessions = new Set(sampleHistory.filter((set) => set.exerciseId === 'barbell-bench-press').map((set) => set.sessionId))
    expect([...benchSessions].sort()).toEqual(['sample-push-1', 'sample-push-2'])
    const record = findPersonalRecord(sampleHistory, sampleRecordSessionId, 'barbell-bench-press')
    expect(record).toMatchObject({ unit: 'lb', previous: { weight: 135 } })
    expect(record?.set.weight).toBe(140)
    expect(record?.margin).toBeGreaterThanOrEqual(1)
  })

  it('gives the earlier session nothing to beat, and no other exercise a record', () => {
    expect(findPersonalRecord(sampleHistory, 'sample-push-1', 'barbell-bench-press')).toBeNull()
    for (const set of sampleHistory) if (set.exerciseId !== 'barbell-bench-press') expect(findPersonalRecord(sampleHistory, set.sessionId, set.exerciseId)).toBeNull()
  })

  it('fills one sample week of the map and does not depend on today', () => {
    expect(weekKey(sampleNow)).toBe('2026-10-11')
    expect(sampleWeekStart.getDay()).toBe(0)
    const data = muscleVolume(completedSessions(sampleHistory, null), baseExercises, sampleWeekStart)
    expect(data.workouts).toBe(3)
    expect(data.rows.length).toBeGreaterThan(3)
    expect(data.rows.every((row) => row.sets > 0)).toBe(true)
    expect(data.totalSets).toBe(sampleHistory.filter((set) => new Date(set.completedAt) >= sampleWeekStart).length)
  })

  it('is deterministic', async () => {
    const again = (await import('./sampleData')).sampleHistory
    expect(JSON.stringify(again)).toBe(JSON.stringify(sampleHistory))
    expect(new Set(sampleHistory.map((set) => set.id)).size).toBe(sampleHistory.length)
  })
})
