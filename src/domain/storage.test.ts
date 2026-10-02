import { describe, expect, it } from 'vitest'
import { generateProgram } from './program'
import { loadWorkoutState, saveWorkoutState } from './storage'

describe('workout storage', () => {
  it('round-trips a generated program and immutable completed-set history on this device', () => {
    const program = generateProgram({ startDate: '2026-10-05', trainingDaysPerWeek: 3, durationWeeks: 5, weekdays: [1, 3, 5] })
    const state = {
      trainingDays: 3 as const,
      duration: 5 as const,
      completedIds: ['workout-1-1'],
      program,
      history: [{ id: 'session-1-barbell-bench-press-1', sessionId: 'session-1', workoutId: 'workout-1-1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: 1, weight: 135, reps: 8, rpe: 7, weightUnit: 'lb' as const, completedAt: '2026-10-05T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3, targetRpe: 7 }],
    }

    saveWorkoutState(state)

    expect(loadWorkoutState()).toEqual(state)
  })
})
