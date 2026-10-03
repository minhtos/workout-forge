import { describe, expect, it } from 'vitest'
import { createCompletedWorkoutBackup, mergeBackupSets, parseRemoteBackups } from './backup'
import type { CompletedSetRecord } from './storage'

const set: CompletedSetRecord = {
  id: 'set-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'workout-1', exerciseId: 'bench', exerciseName: 'Bench Press', setIndex: 1, weight: 135, reps: 8, rir: 7, weightUnit: 'lb', completedAt: '2026-10-03T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3,
}

describe('cloud backup payloads', () => {
  it('creates a versioned immutable backup for a completed session', () => {
    expect(createCompletedWorkoutBackup(set.sessionId, [set])).toMatchObject({ id: set.sessionId, schemaVersion: 1, sets: [set] })
  })

  it('skips malformed remote payloads before merging local history', () => {
    const result = parseRemoteBackups([{ id: set.sessionId, completed_at: set.completedAt, schema_version: 1, payload: { id: set.sessionId, completedAt: set.completedAt, schemaVersion: 1, sets: [set] } }, { id: 'bad', payload: { unsafe: true } }])
    expect(result.backups).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(mergeBackupSets([set], result.backups)).toEqual([set])
  })
})
