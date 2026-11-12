import { describe, expect, it } from 'vitest'
import { barWeight, plateLoad, plateSizes } from './plateGuide'
import { baseExercises } from './program'
import { cleanLadder, hasWarmup, warmupHint, warmupLine, warmupSteps } from './warmup'

const bar = barWeight()
const weights = (w: number, deadlift = false) => warmupSteps(w, deadlift).map((step) => step.weight)

describe('warmupSteps', () => {
  it('matches the approved clean-ladder examples', () => {
    expect(warmupSteps(135)).toEqual([{ weight: 45, reps: 10 }, { weight: 55, reps: 5 }, { weight: 85, reps: 3 }, { weight: 105, reps: 1 }])
    expect(warmupSteps(225)).toEqual([{ weight: 45, reps: 10 }, { weight: 95, reps: 5 }, { weight: 135, reps: 3 }, { weight: 185, reps: 1 }])
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
    expect(weights(400)).toEqual([45, 155, 245, 325])
    // targets 54.8, 82.2, 109.6 -> rungs 55, 85, 105 (80 would need 10+5+2.5; 110 would need 25+5+2.5)
    expect(weights(137)).toEqual([45, 55, 85, 105])
  })

  it('drops duplicate percentage steps', () => {
    // 40% of 110 is 44 -> the bar rung, which drops; 60% = 66 -> 65; 80% = 88 -> 85
    expect(weights(110)).toEqual([45, 65, 85])
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
    expect(weights(225, true)).toEqual([95, 135, 185])
    expect(weights(135, true)).toEqual([55, 85, 105])
    expect(warmupSteps(60, true)).toEqual([])
  })
})

describe('warmupLine', () => {
  it('formats with middle dots', () => {
    expect(warmupLine(135)).toBe('Warm-up (not logged): bar × 10 · 55 × 5 · 85 × 3 · 105 × 1')
    expect(warmupLine(225)).toBe('Warm-up (not logged): bar × 10 · 95 × 5 · 135 × 3 · 185 × 1')
    expect(warmupLine(225, true)).toBe('Warm-up (not logged): 95 × 5 · 135 × 3 · 185 × 1')
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

  it('T25 builds each ramp step from the clean ladder of the owned plates', () => {
    expect(line(225, noTwoPointFives)).toBe('45×10 · 95×5 · 135×3 · 185×1')
    expect(line(225, [45, 25])).toBe('45×10 · 95×5 · 135×3 · 185×1')
    expect(line(135, noTwoPointFives)).toBe('45×10 · 55×5 · 85×3 · 105×1')
    expect(line(135, [45, 25])).toBe('45×10 · 95×3')
    expect(line(315, noTwoPointFives)).toBe('45×10 · 125×5 · 185×3 · 245×1')
    expect(line(315, [45, 25])).toBe('45×10 · 135×5 · 185×3 · 245×1')
  })

  it('T26 no owned plates (null) is the full standard plate set at every weight', () => {
    for (let w = 0; w <= 600; w += 2.5) {
      for (const noBarStep of [false, true]) expect(warmupSteps(w, noBarStep)).toEqual(warmupSteps(w, noBarStep, plateSizes.lb))
    }
    expect(warmupSteps(135)).toEqual([{ weight: 45, reps: 10 }, { weight: 55, reps: 5 }, { weight: 85, reps: 3 }, { weight: 105, reps: 1 }])
  })

  it('T27 passes the owned plates through the hint', () => {
    expect(warmupHint('barbell-squat', '225', [45, 35, 25, 10, 5])).toBe('Warm-up (not logged): bar × 10 · 95 × 5 · 135 × 3 · 185 × 1')
  })
})

describe('clean ladder (warm-up simplification)', () => {
  const noThirtyFives = [45, 25, 10, 5, 2.5]
  const fortyFiveTwentyFive = [45, 25]
  const line = (w: number, owned: number[] | null, nb = false) => warmupSteps(w, nb, owned).map((step) => `${step.weight}×${step.reps}`).join(' · ')
  const ws = [95, 135, 185, 225, 275, 315, 365, 405]

  it('W1 the full plate set up to 405 is these 28 rungs', () => {
    expect(cleanLadder(405)).toEqual([45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 175, 185, 205, 225, 235, 245, 265, 275, 295, 315, 325, 335, 355, 365, 385, 405])
  })

  it('W2 restricted sets: no 35s, and 45s and 25s only', () => {
    expect(cleanLadder(405, noThirtyFives)).toEqual([45, 55, 65, 75, 85, 95, 105, 115, 135, 145, 155, 175, 185, 225, 235, 245, 265, 275, 315, 325, 335, 355, 365, 405])
    expect(cleanLadder(405, fortyFiveTwentyFive)).toEqual([45, 95, 135, 145, 185, 195, 225, 235, 245, 275, 285, 295, 315, 325, 335, 345, 365, 375, 385, 395, 405])
  })

  it('W3 no plates is just the bar, and the bar is always the first rung', () => {
    expect(cleanLadder(300, [])).toEqual([45])
    expect(cleanLadder(40)).toEqual([45])
    expect(warmupSteps(135, false, [])).toEqual([{ weight: 45, reps: 10 }])
    expect(warmupLine(135, true, [])).toBeNull()
  })

  it('W4 GOLDEN: the full plate set at 95 to 405', () => {
    expect(ws.map((w) => line(w, null))).toEqual(['45×10 · 55×3 · 75×1', '45×10 · 55×5 · 85×3 · 105×1', '45×10 · 75×5 · 115×3 · 145×1', '45×10 · 95×5 · 135×3 · 185×1', '45×10 · 115×5 · 175×3 · 225×1', '45×10 · 125×5 · 185×3 · 245×1', '45×10 · 145×5 · 225×3 · 295×1', '45×10 · 155×5 · 245×3 · 325×1'])
  })

  it('W5 restricted sets at 95 to 405', () => {
    expect(ws.map((w) => line(w, noThirtyFives))).toEqual(['45×10 · 55×3 · 75×1', '45×10 · 55×5 · 85×3 · 105×1', '45×10 · 75×5 · 115×3 · 145×1', '45×10 · 95×5 · 135×3 · 185×1', '45×10 · 115×5 · 175×3 · 225×1', '45×10 · 135×5 · 185×3 · 245×1', '45×10 · 145×5 · 225×3 · 275×1', '45×10 · 155×5 · 245×3 · 325×1'])
    expect(ws.map((w) => line(w, fortyFiveTwentyFive))).toEqual(['45×10', '45×10 · 95×3', '45×10 · 95×5 · 145×1', '45×10 · 95×5 · 135×3 · 185×1', '45×10 · 95×5 · 185×3 · 225×1', '45×10 · 135×5 · 185×3 · 245×1', '45×10 · 145×5 · 225×3 · 295×1', '45×10 · 145×5 · 245×3 · 325×1'])
  })

  it('W6 every step loads exactly with at most two plate sizes on a side, never the smallest plate, at or under 90% of W (property)', () => {
    for (const owned of [null, noThirtyFives, fortyFiveTwentyFive, [45, 35, 25, 10, 5]]) {
      for (let w = 95; w <= 600; w += 5) {
        for (const { weight } of warmupSteps(w, false, owned)) {
          if (weight === bar) continue
          const load = plateLoad(weight, 'lb', owned ?? plateSizes.lb)!
          expect(load.exact).toBe(true)
          expect(new Set(load.plates).size).toBeLessThanOrEqual(2)
          expect(load.plates).not.toContain(2.5)
          expect(weight).toBeLessThanOrEqual(0.9 * w + 1e-9)
        }
      }
    }
  })

  it('W7 drops a step that does not clear the load before it by 10 lb', () => {
    expect(weights(120)).toEqual([45, 75, 95])
    expect(weights(130)).toEqual([45, 55, 75, 105])
    expect(weights(120, true)).toEqual([75, 95])
  })

  it('W8 never goes over 90% of W, so a sparse rack can lose steps', () => {
    expect(line(100, [45, 25])).toBe('45×10')
    expect(line(145, [45, 25])).toBe('45×10 · 95×3')
    expect(line(150, [45, 25])).toBe('45×10 · 95×3 · 135×1')
  })

  it('W9 breaks an exact tie toward the larger jump from the load before it', () => {
    // Owner: it is about progressing to working weight, not going heavier — 45 to 65 is a more noticeable warm-up step than 45 to 55.
    expect(weights(275)).toEqual([45, 115, 175, 225])
    expect(weights(225)).toEqual([45, 95, 135, 185])
    expect(weights(400)).toEqual([45, 155, 245, 325])
  })
})
