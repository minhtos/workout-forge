import { describe, expect, it, vi } from 'vitest'
import { backupSession } from './sync'
import type { CompletedSetRecord } from './storage'

const set = { id: 'set-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w-1', exerciseId: 'bench', exerciseName: 'Bench', setIndex: 1, weight: 135, reps: 8, rpe: 7, weightUnit: 'lb', completedAt: '2026-10-03T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3, targetRpe: 7 } as const satisfies CompletedSetRecord

describe('workout session backup', () => {
  it('inserts a versioned session payload owned by the signed-in user', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) }
    await expect(backupSession(client as never, 'user-1', set.sessionId, [set])).resolves.toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: set.sessionId, user_id: 'user-1', schema_version: 1 }))
  })
})
