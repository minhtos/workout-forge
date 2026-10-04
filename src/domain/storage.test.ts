import { beforeEach, describe, expect, it } from 'vitest'
import { autoFillPlan, createBlock, mergeCatalog } from './program'
import { emptyState, exportWorkoutState, loadWorkoutState, parseImportedState, saveWorkoutState, type CompletedSetRecord } from './storage'

const set: CompletedSetRecord = { id: 'session-1-barbell-bench-press-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: 1, weight: 135, reps: 8, rir: 0, weightUnit: 'lb', completedAt: '2026-10-05T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3 }

beforeEach(() => window.localStorage.clear())

describe('workout storage', () => {
  it('round-trips a block and set history on this device', () => {
    const state = { ...emptyState(), block: autoFillPlan(createBlock(3, 5), mergeCatalog([])), history: [set] }
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
