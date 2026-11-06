import { describe, expect, it } from 'vitest'
import { barWeight } from './plateGuide'
import { baseExercises } from './program'
import { hasWarmup, warmupLine, warmupSteps } from './warmup'

const bar = barWeight()
const weights = (w: number, deadlift = false) => warmupSteps(w, deadlift).map((step) => step.weight)

describe('warmupSteps', () => {
  it('matches the approved examples', () => {
    expect(warmupSteps(135)).toEqual([{ weight: 45, reps: 10 }, { weight: 55, reps: 5 }, { weight: 80, reps: 3 }, { weight: 110, reps: 1 }])
    expect(warmupSteps(225)).toEqual([{ weight: 45, reps: 10 }, { weight: 90, reps: 5 }, { weight: 135, reps: 3 }, { weight: 180, reps: 1 }])
  })

  it('gives only the bar below 95 (and nothing without a weight)', () => {
    expect(warmupSteps(0)).toEqual([])
    expect(warmupSteps(Number.NaN)).toEqual([])
    expect(warmupSteps(60)).toEqual([{ weight: 45, reps: 10 }])
    expect(warmupSteps(94)).toEqual([{ weight: 45, reps: 10 }])
  })

  it('starts the percentage steps at 95', () => {
    expect(weights(95)).toEqual([45, 55, 75])
  })

  it('handles a heavy weight and a non-multiple of 5', () => {
    expect(weights(400)).toEqual([45, 160, 240, 320])
    // 40% of 137 = 54.8 -> 55, 60% = 82.2 -> 80, 80% = 109.6 -> 110
    expect(weights(137)).toEqual([45, 55, 80, 110])
  })

  it('drops duplicate percentage steps', () => {
    // 40% and 60% of 110 are 44 and 66 -> 45 (dropped, not above the bar) and 65; 80% = 88 -> 90
    expect(weights(110)).toEqual([45, 65, 90])
  })

  it('stays strictly increasing, in multiples of 5, between the bar and W (property check)', () => {
    for (let w = 0; w <= 600; w += 0.5) {
      const steps = warmupSteps(w)
      const ws = steps.map((step) => step.weight)
      ws.forEach((weight, i) => {
        if (i > 0) { expect(weight).toBeGreaterThan(ws[i - 1]); expect(weight).toBeGreaterThan(bar); expect(weight).toBeLessThan(w) }
        expect(weight % 5).toBe(0)
      })
      if (w > 0) expect(ws[0]).toBe(bar)
    }
  })

  it('leaves the bar step off the deadlift', () => {
    expect(weights(225, true)).toEqual([90, 135, 180])
    expect(weights(135, true)).toEqual([55, 80, 110])
    expect(warmupSteps(60, true)).toEqual([])
  })
})

describe('warmupLine', () => {
  it('formats with middle dots', () => {
    expect(warmupLine(135)).toBe('Warm-up (not logged): bar × 10 · 55 × 5 · 80 × 3 · 110 × 1')
    expect(warmupLine(225)).toBe('Warm-up (not logged): bar × 10 · 90 × 5 · 135 × 3 · 180 × 1')
    expect(warmupLine(225, true)).toBe('Warm-up (not logged): 90 × 5 · 135 × 3 · 180 × 1')
  })

  it('is null with nothing to show', () => {
    expect(warmupLine(0)).toBeNull()
    expect(warmupLine(60, true)).toBeNull()
  })
})

describe('hasWarmup (trigger matrix)', () => {
  const triggered = baseExercises.filter((item) => hasWarmup(item.id)).map((item) => item.name).sort()

  it('is exactly the seven compound barbell lifts', () => {
    expect(triggered).toEqual(['Barbell Bench Press', 'Barbell Deadlift', 'Barbell Hip Thrust', 'Barbell Incline Bench Press', 'Barbell Overhead Press', 'Barbell Row', 'Barbell Squat'])
  })

  it('excludes non-compound barbell lifts, dumbbell and machine compounds, and custom exercises', () => {
    expect(hasWarmup('barbell-squat')).toBe(true)
    for (const id of ['barbell-curls', 'barbell-wrist-curl', 'dumbbell-incline-bench-press', 'leg-press-machine', 'machine-hip-thrust', 'custom-my-lift']) expect(hasWarmup(id)).toBe(false)
  })
})
