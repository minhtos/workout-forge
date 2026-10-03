import { describe, expect, it, vi } from 'vitest'
import { backupSession, restoreSessions } from './sync'
import type { CompletedSetRecord } from './storage'

const set = { id: 'set-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w-1', exerciseId: 'bench', exerciseName: 'Bench', setIndex: 1, weight: 135, reps: 8, rir: 7, weightUnit: 'lb', completedAt: '2026-10-03T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3} as const satisfies CompletedSetRecord

describe('workout session backup', () => {
  it('inserts a versioned session payload owned by the signed-in user', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) }
    await expect(backupSession(client as never, 'user-1', set.sessionId, [set])).resolves.toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: set.sessionId, user_id: 'user-1', schema_version: 1 }))
  })

  it('restores validated sessions and reports malformed remote records', async () => {
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [{ payload: { id: set.sessionId, completedAt: set.completedAt, schemaVersion: 1, sets: [set] } }, { payload: { bad: true } }], error: null }) })) }))
    const client = { from: vi.fn(() => ({ select })) }
    await expect(restoreSessions(client as never, 'user-1', [])).resolves.toMatchObject({ added: 1, skipped: 1, history: [set] })
  })
})
