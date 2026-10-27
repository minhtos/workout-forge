import { describe, expect, it } from 'vitest'
import { sessionPoints } from './charts'
import { findPersonalRecord } from './personalRecord'
import type { CompletedSetRecord } from './storage'

const set = (sessionId: string, setIndex: number, weight: number, reps: number, completedAt: string, patch: Partial<CompletedSetRecord> = {}): CompletedSetRecord => ({
  id: `${sessionId}-${patch.exerciseId ?? 'bench'}-${setIndex}`, sessionId, workoutId: 'w1-d1', exerciseId: 'bench', exerciseName: 'Bench', setIndex, weight, reps, rir: 0, weightUnit: 'lb', completedAt, weekNumber: 1, repRange: { min: 6, max: 12 }, targetRir: 0, targetReps: reps, ...patch,
})
const day = (n: number) => new Date(2026, 9, n, 12).toISOString()

describe('findPersonalRecord', () => {
  it('has no record in the first session for an exercise', () => {
    expect(findPersonalRecord([set('now', 1, 200, 8, day(10))], 'now', 'bench')).toBeNull()
  })

  it('has nothing to beat when the earlier sessions were all deload', () => {
    const history = [set('old', 1, 100, 8, day(1), { deload: true }), set('now', 1, 200, 8, day(10))]
    expect(findPersonalRecord(history, 'now', 'bench')).toBeNull()
  })

  it('never counts a deload set as a record', () => {
    const history = [set('old', 1, 100, 8, day(1)), set('now', 1, 300, 8, day(10), { deload: true })]
    expect(findPersonalRecord(history, 'now', 'bench')).toBeNull()
  })

  it('returns the set, the margin and the previous best when the estimated max goes up', () => {
    const history = [set('old', 1, 200, 6, day(1)), set('old', 2, 190, 6, day(1)), set('now', 1, 205, 6, day(10))]
    const record = findPersonalRecord(history, 'now', 'bench')
    expect(record?.set.id).toBe('now-bench-1')
    expect(record?.unit).toBe('lb')
    expect(record?.margin).toBe(Math.round((205 * 36) / 31 - (200 * 36) / 31))
    expect(record?.previous).toEqual({ weight: 200, reps: 6, completedAt: day(1) })
  })

  it('needs the rounded margin to be at least 1: ties and sub-1 gains are not records', () => {
    const tie = [set('old', 1, 200, 6, day(1)), set('now', 1, 200, 6, day(10))]
    expect(findPersonalRecord(tie, 'now', 'bench')).toBeNull()
    // 200 x 6 -> 232.26; 200 x 6 at RIR 0 vs. 200.1 x 6 -> 232.37 (+0.1)
    const tiny = [set('old', 1, 200, 6, day(1)), set('now', 1, 200.1, 6, day(10))]
    expect(findPersonalRecord(tiny, 'now', 'bench')).toBeNull()
  })

  it('adds the RIR bonus only when the target reps were hit', () => {
    // Before: 200 x 6 at RIR 0 -> 232.3. Now: 190 x 6 with 2 RIR left -> 190 x 8 -> 235.9, a record only if the bonus counts.
    const hit = [set('old', 1, 200, 6, day(1)), set('now', 1, 190, 6, day(10), { targetRir: 2, targetReps: 6 })]
    expect(findPersonalRecord(hit, 'now', 'bench')?.margin).toBe(4)
    const missed = [set('old', 1, 200, 6, day(1)), set('now', 1, 190, 6, day(10), { targetRir: 2, targetReps: 8 })]
    expect(findPersonalRecord(missed, 'now', 'bench')).toBeNull()
  })

  it('compares bodyweight work (all 0 lb) on most reps', () => {
    const history = [set('old', 1, 0, 8, day(1)), set('old', 2, 0, 7, day(1)), set('now', 1, 0, 8, day(10)), set('now', 2, 0, 10, day(10))]
    const record = findPersonalRecord(history, 'now', 'bench')
    expect(record).toMatchObject({ unit: 'reps', margin: 2, previous: { weight: 0, reps: 8 } })
    expect(record?.set.setIndex).toBe(2)
    expect(findPersonalRecord([set('old', 1, 0, 8, day(1)), set('now', 1, 0, 8, day(10))], 'now', 'bench')).toBeNull()
  })

  it('returns the first set that crosses the previous best, in set order', () => {
    const history = [
      set('old', 1, 200, 6, day(1)),
      set('now', 3, 215, 6, day(10)), set('now', 1, 195, 6, day(10)), set('now', 2, 205, 6, day(10)),
    ]
    expect(findPersonalRecord(history, 'now', 'bench')?.set.setIndex).toBe(2)
  })

  it('compares each exercise only with its own history', () => {
    const history = [set('old', 1, 400, 10, day(1), { exerciseId: 'squat' }), set('old', 1, 200, 6, day(1)), set('now', 1, 205, 6, day(10)), set('now', 1, 300, 10, day(10), { exerciseId: 'squat' })]
    expect(findPersonalRecord(history, 'now', 'bench')?.previous.weight).toBe(200)
    expect(findPersonalRecord(history, 'now', 'squat')).toBeNull()
  })

  it('agrees with the Progress chart: a record exactly when the session point beats every earlier one', () => {
    const history = [
      set('a', 1, 200, 6, day(1)), set('a', 2, 195, 8, day(1)),
      set('b', 1, 205, 6, day(5), { targetRir: 1 }),
      set('c', 1, 210, 5, day(9), { targetRir: 1 }),
    ]
    const points = sessionPoints(history, 'bench', 0)
    for (const current of ['b', 'c']) {
      const earlier = points.filter((point) => point.sessionId !== current && point.t < points.find((p) => p.sessionId === current)!.t)
      const mine = points.find((point) => point.sessionId === current)!
      const best = Math.max(...earlier.map((point) => point.value))
      expect(findPersonalRecord(history.filter((s) => s.sessionId <= current), current, 'bench') !== null).toBe(Math.round(mine.value - best) >= 1)
    }
  })
})
