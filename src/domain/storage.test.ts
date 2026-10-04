import { beforeEach, describe, expect, it } from 'vitest'
import { addExerciseToDay, createBlock, listWorkouts, nextWorkout } from './program'
import { emptyState, exportWorkoutState, loadWorkoutState, parseImportedState, saveWorkoutState, type CompletedSetRecord } from './storage'

const set: CompletedSetRecord = { id: 'session-1-barbell-bench-press-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: 1, weight: 135, reps: 8, rir: 0, weightUnit: 'lb', completedAt: '2026-10-05T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3 }

beforeEach(() => window.localStorage.clear())

describe('workout storage', () => {
  it('round-trips a block and set history on this device', () => {
    const state = { ...emptyState(), block: addExerciseToDay(createBlock(3, 4), 0, 'pull-ups'), history: [set] }
    expect(saveWorkoutState(state)).toBe(true)
    expect(loadWorkoutState()).toEqual(state)
  })

  it('carries v2 history forward and leaves the v2 data untouched', () => {
    const legacy = JSON.stringify({ duration: 5, program: { workouts: [] }, completedIds: [], history: [set] })
    window.localStorage.setItem('workout-forge:v2', legacy)
    expect(loadWorkoutState().history).toEqual([set])
    expect(window.localStorage.getItem('workout-forge:v2')).toBe(legacy)
  })

  it('keeps a copy of unreadable data instead of discarding it', () => {
    window.localStorage.setItem('workout-forge:v3', '{not json')
    expect(loadWorkoutState()).toEqual(emptyState())
    const stashed = Object.keys(window.localStorage).filter((key) => key.startsWith('workout-forge:unreadable:'))
    expect(stashed).toHaveLength(1)
    expect(window.localStorage.getItem(stashed[0])).toBe('{not json')
  })

  it('loads states saved before the exercise library existed, with everything on', () => {
    const { hiddenExerciseIds: _removed, ...old } = emptyState()
    window.localStorage.setItem('workout-forge:v3', JSON.stringify(old))
    expect(loadWorkoutState().hiddenExerciseIds).toEqual([])
    expect(loadWorkoutState().programUpdatedAt).toBeNull()
  })

  it('migrates an in-progress block saved with muscle-group slots, keeping your place', () => {
    const old = {
      ...emptyState(),
      history: [set],
      block: {
        trainingDays: 3, durationWeeks: 5, locked: true, startedAt: '2026-10-05T12:00:00.000Z', completedIds: ['w1-d1', 'w1-d2'], skippedIds: [],
        templates: [
          { title: 'Push', slots: [{ category: 'Chest', exerciseId: 'barbell-bench-press', sets: 3 }, { category: 'Triceps', exerciseId: 'cable-pushdown', sets: 4 }] },
          { title: 'Pull', slots: [{ category: 'Back', exerciseId: 'pull-ups', sets: 3 }] },
          { title: 'Legs', slots: [{ category: 'Quads', exerciseId: 'barbell-squat', sets: 3 }, { category: 'Hamstrings', exerciseId: null, sets: 3 }] },
        ],
      },
    }
    window.localStorage.setItem('workout-forge:v3', JSON.stringify(old))
    const block = loadWorkoutState().block!
    expect(block.durationWeeks).toBe(4)
    expect(block.locked).toBe(true)
    expect(block.templates.map((day) => day.title)).toEqual(['Push', 'Pull', 'Legs'])
    expect(block.templates[0].exercises).toEqual([{ exerciseId: 'barbell-bench-press', sets: 3 }, { exerciseId: 'cable-pushdown', sets: 4 }])
    expect(block.templates[2].exercises).toEqual([{ exerciseId: 'barbell-squat', sets: 3 }])
    expect(listWorkouts(block)).toHaveLength(15)
    expect(nextWorkout(block)?.id).toBe('w1-d3')
  })
})

describe('export and import', () => {
  it('imports an export, dropping invalid sets', () => {
    const state = { ...emptyState(), history: [set, { ...set, id: 'bad', sessionId: 'not-a-uuid' }] }
    const imported = parseImportedState(exportWorkoutState(state))
    expect(imported?.history).toEqual([set])
  })
  it('rejects files that are not exports', () => {
    expect(parseImportedState('{"hello":1}')).toBeNull()
    expect(parseImportedState('nope')).toBeNull()
  })
})
