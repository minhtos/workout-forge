import { describe, expect, it } from 'vitest'
import { exerciseOptions, niceTicks, rangeStart, sessionPoints, shortDate, weekStart, weeklyBuckets } from './charts'
import { mergeCatalog } from './program'
import type { CompletedSetRecord } from './storage'

const catalog = mergeCatalog([])
const set = (sessionId: string, setIndex: number, weight: number, reps: number, at: string, patch: Partial<CompletedSetRecord> = {}): CompletedSetRecord => ({
  id: `${sessionId}-${setIndex}-${patch.exerciseId ?? 'b'}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex, weight, reps, rir: 0, weightUnit: 'lb', completedAt: at, weekNumber: 1, repRange: { min: 6, max: 12 }, targetRir: 0, targetReps: reps, ...patch,
})

// Local-time noon dates so the week a set falls in does not depend on the machine's time zone.
const at = (month: number, day: number) => new Date(2026, month - 1, day, 12, 0, 0).toISOString()
const NOW = new Date(2026, 9, 14, 12, 0, 0) // Wednesday 14 Oct 2026

describe('weeks', () => {
  it('starts on Monday at midnight', () => {
    const start = weekStart(NOW)
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getDay(), start.getHours()]).toEqual([2026, 9, 12, 1, 0])
    expect(weekStart(new Date(2026, 9, 18, 23, 0)).getDate()).toBe(12)
    expect(weekStart(new Date(2026, 9, 19, 1, 0)).getDate()).toBe(19)
  })

  it('starts the range N-1 weeks before this week', () => {
    expect(rangeStart(4, NOW).getDate()).toBe(21)
    expect(rangeStart(4, NOW).getMonth()).toBe(8)
    expect(rangeStart(1, NOW).getDate()).toBe(12)
  })

  it('formats short dates', () => expect(shortDate(new Date(2026, 9, 5))).toBe('Oct 5'))
})

describe('estimated max per session', () => {
  const history = [
    set('a', 1, 200, 6, at(9, 28)), set('a', 2, 195, 6, at(9, 28)),
    set('b', 1, 205, 6, at(10, 5)), set('b', 2, 200, 7, at(10, 5)),
    set('d', 1, 100, 6, at(10, 12), { deload: true }),
    set('x', 1, 135, 8, at(10, 6), { exerciseId: 'pull-ups', exerciseName: 'Pull-ups' }),
  ]

  it('gives one point per session, oldest first, using the best set', () => {
    const points = sessionPoints(history, 'barbell-bench-press', 0)
    expect(points.map((point) => point.sessionId)).toEqual(['a', 'b'])
    expect(points[0]).toMatchObject({ topWeight: 200, topReps: 6, label: 'Sep 28' })
    expect(points[0].value).toBeCloseTo((200 * 36) / 31, 1)
    expect(points[1].value).toBeGreaterThan(points[0].value)
  })

  it('leaves deload sessions out and respects the start of the range', () => {
    expect(sessionPoints(history, 'barbell-bench-press', 0).some((point) => point.sessionId === 'd')).toBe(false)
    expect(sessionPoints(history, 'barbell-bench-press', new Date(2026, 9, 1).getTime()).map((point) => point.sessionId)).toEqual(['b'])
    expect(sessionPoints(history, 'nothing', 0)).toEqual([])
  })

  it('lists exercises with sessions in range, most trained first, optionally for one muscle group', () => {
    expect(exerciseOptions(history, catalog, null, 0)).toEqual([{ id: 'barbell-bench-press', name: 'Barbell Bench Press', sessions: 2 }, { id: 'pull-ups', name: 'Pull-ups', sessions: 1 }])
    expect(exerciseOptions(history, catalog, 'Back', 0).map((option) => option.id)).toEqual(['pull-ups'])
    expect(exerciseOptions(history, catalog, 'Calves', 0)).toEqual([])
    expect(exerciseOptions(history, catalog, null, new Date(2026, 9, 10).getTime())).toEqual([])
  })

  it('charts best reps for a bodyweight exercise, which has no weight to estimate a max from', () => {
    const pullUps = [1, 2].flatMap((n) => [set(`p${n}`, 1, 0, 6 + n, at(10, 5 + n), { exerciseId: 'pull-ups', exerciseName: 'Pull-ups' }), set(`p${n}`, 2, 0, 4 + n, at(10, 5 + n), { exerciseId: 'pull-ups', exerciseName: 'Pull-ups' })])
    const points = sessionPoints(pullUps, 'pull-ups', 0)
    expect(points.map((point) => [point.unit, point.value])).toEqual([['reps', 7], ['reps', 8]])
    expect(sessionPoints(history, 'barbell-bench-press', 0).every((point) => point.unit === 'lb')).toBe(true)
    expect(exerciseOptions(pullUps, catalog, 'Back', 0)).toEqual([{ id: 'pull-ups', name: 'Pull-ups', sessions: 2 }])
  })

  it('uses the saved name for an exercise that is no longer in the library', () => {
    const gone = [set('g', 1, 50, 10, at(10, 5), { exerciseId: 'custom-gone', exerciseName: 'Old Custom Move' })]
    expect(exerciseOptions(gone, catalog, null, 0)).toEqual([{ id: 'custom-gone', name: 'Old Custom Move', sessions: 1 }])
  })
})

describe('sets per week', () => {
  const history = [
    set('a', 1, 100, 10, at(10, 12)), set('a', 2, 100, 10, at(10, 13)), set('a', 3, 100, 8, at(10, 18)),
    set('b', 1, 50, 10, at(10, 6), { exerciseId: 'pull-ups', exerciseName: 'Pull-ups' }),
    set('c', 1, 100, 10, at(9, 1)),
    set('d', 1, 60, 10, at(10, 14), { deload: true }),
  ]

  it('has one bucket per week, empty weeks included, ending with this week', () => {
    const buckets = weeklyBuckets(history, catalog, null, 4, NOW)
    expect(buckets.map((bucket) => bucket.label)).toEqual(['Sep 21', 'Sep 28', 'Oct 5', 'Oct 12'])
    expect(buckets.map((bucket) => bucket.sets)).toEqual([0, 0, 1, 4])
  })

  it('adds up sets and volume (weight × reps), counting deload sets too', () => {
    const buckets = weeklyBuckets(history, catalog, null, 4, NOW)
    expect(buckets[3].sets).toBe(4)
    expect(buckets[3].volume).toBe(100 * 10 + 100 * 10 + 100 * 8 + 60 * 10)
  })

  it('can be limited to one muscle group', () => {
    expect(weeklyBuckets(history, catalog, 'Back', 4, NOW).map((bucket) => bucket.sets)).toEqual([0, 0, 1, 0])
    expect(weeklyBuckets(history, catalog, 'Chest', 4, NOW).map((bucket) => bucket.sets)).toEqual([0, 0, 0, 4])
  })

  it('ignores sets outside the range', () => {
    expect(weeklyBuckets(history, catalog, null, 2, NOW).map((bucket) => bucket.sets)).toEqual([1, 4])
    expect(weeklyBuckets(history, catalog, null, 12, NOW).reduce((sum, bucket) => sum + bucket.sets, 0)).toBe(6)
  })
})

describe('axis ticks', () => {
  it('rounds to clean numbers that cover the data', () => {
    expect(niceTicks(0, 87, 4)).toMatchObject({ min: 0, max: 100 })
    const weights = niceTicks(232, 251, 4)
    expect(weights.ticks[0]).toBeLessThanOrEqual(232)
    expect(weights.ticks.at(-1)).toBeGreaterThanOrEqual(251)
    expect(weights.ticks.every((tick, index, all) => index === 0 || tick > all[index - 1])).toBe(true)
  })

  it('keeps whole steps for counts and copes with a flat range', () => {
    const counts = niceTicks(0, 3, 4, true)
    expect(counts.ticks.every((tick) => Number.isInteger(tick))).toBe(true)
    expect(counts.max).toBeGreaterThanOrEqual(3)
    const flat = niceTicks(200, 200, 4)
    expect(flat.max).toBeGreaterThan(flat.min)
  })
})
