import { describe, expect, it } from 'vitest'
import { barWeight } from './plateGuide'
import { baseExercises } from './program'
import { hasWarmup, warmupHint, warmupLine, warmupSteps } from './warmup'

const bar = barWeight()
const weights = (w: number, deadlift = false) => warmupSteps(w, deadlift).map((step) => step.weight)

describe('warmupSteps', () => {
  it('matches the approved examples', () => {
    expect(warmupSteps(135)).toEqual([{ weight: 45, reps: 10 }, { weight: 55, reps: 5 }, { weight: 80, reps: 3 }, { weight: 110, reps: 1 }])
    expect(warmupSteps(225)).toEqual([{ weight: 45, reps: 10 }, { weight: 90, reps: 5 }, { weight: 135, reps: 3 }, { weight: 180, reps: 1 }])
  })

  it('gives only the bar from just above the bar up to 94 (and nothing without a weight)', () => {
    expect(warmupSteps(0)).toEqual([])
    expect(warmupSteps(Number.NaN)).toEqual([])
    expect(warmupSteps(46)).toEqual([{ weight: 45, reps: 10 }])
    expect(warmupSteps(60)).toEqual([{ weight: 45, reps: 10 }])
    expect(warmupSteps(94)).toEqual([{ weight: 45, reps: 10 }])
  })

  it('gives no ramp at or below the bar, deadlift included', () => {
    for (const w of [45, 40, 20]) {
      expect(warmupSteps(w)).toEqual([])
      expect(warmupSteps(w, true)).toEqual([])
      expect(warmupLine(w)).toBeNull()
    }
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
      if (w > bar) expect(ws[0]).toBe(bar)
      else expect(ws).toEqual([])
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

describe('warmupSteps with owned plates', () => {
  const noTwoPointFives = [45, 35, 25, 10, 5]
  const line = (w: number, owned: number[]) => warmupSteps(w, false, owned).map((step) => `${step.weight}×${step.reps}`).join(' · ')

  it('T25 loads each ramp step with the owned plates', () => {
    expect(line(225, noTwoPointFives)).toBe('45×10 · 85×5 · 135×3 · 175×1')
    expect(line(225, [45, 25])).toBe('45×10 · 135×3 · 145×1')
    expect(line(135, noTwoPointFives)).toBe('45×10 · 55×5 · 75×3 · 105×1')
    expect(line(135, [45, 25])).toBe('45×10 · 95×1')
    expect(line(315, noTwoPointFives)).toBe('45×10 · 125×5 · 185×3 · 245×1')
    expect(line(315, [45, 25])).toBe('45×10 · 95×5 · 185×3 · 245×1')
  })

  it('T26 GOLDEN: no owned plates (the default) is the unchanged ramp at every weight', () => {
    for (let w = 0; w <= 600; w += 2.5) {
      for (const noBarStep of [false, true]) expect(warmupSteps(w, noBarStep)).toEqual(warmupSteps(w, noBarStep, null))
    }
    expect(warmupSteps(135)).toEqual([{ weight: 45, reps: 10 }, { weight: 55, reps: 5 }, { weight: 80, reps: 3 }, { weight: 110, reps: 1 }])
  })

  it('T27 passes the owned plates through the hint', () => {
    expect(warmupHint('barbell-squat', '225', [45, 35, 25, 10, 5])).toBe('Warm-up (not logged): bar × 10 · 85 × 5 · 135 × 3 · 175 × 1')
  })
})
