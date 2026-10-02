import { describe, expect, it } from 'vitest'
import { loadWorkoutState, saveWorkoutState } from './storage'

describe('workout storage', () => {
  it('round-trips a generated program and completion history on this device', () => {
    const state = {
      trainingDays: 3 as const,
      duration: 4 as const,
      completedIds: ['workout-1-1'],
      program: { workouts: [{ id: 'workout-1-1', date: '2026-10-05', title: 'Full Body A', weekNumber: 1 }] },
    }

    saveWorkoutState(state)

    expect(loadWorkoutState()).toEqual(state)
  })
})
