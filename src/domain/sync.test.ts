import { describe, expect, it, vi } from 'vitest'
import { backupSession, restoreSessions } from './sync'
import type { CompletedSetRecord } from './storage'

const set = { id: 'set-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w-1', exerciseId: 'bench', exerciseName: 'Bench', setIndex: 1, weight: 135, reps: 8, rir: 0, weightUnit: 'lb', completedAt: '2026-10-03T12:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 0 } as const satisfies CompletedSetRecord

describe('workout session backup', () => {
  it('upserts a versioned session payload owned by the signed-in user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ upsert })) }
    await expect(backupSession(client as never, 'user-1', set.sessionId, [set])).resolves.toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: set.sessionId, user_id: 'user-1', schema_version: 1 }), { onConflict: 'id' })
  })

  it('reports failures so the session stays queued', async () => {
    const client = { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: { message: 'offline' } }) })) }
    await expect(backupSession(client as never, 'user-1', set.sessionId, [set])).resolves.toEqual({ ok: false, message: 'offline' })
  })

  it('deletes the cloud row when a session has no sets left', async () => {
    const secondEq = vi.fn().mockResolvedValue({ error: null })
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const client = { from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: firstEq })) })) }
    await expect(backupSession(client as never, 'user-1', set.sessionId, [])).resolves.toEqual({ ok: true })
    expect(firstEq).toHaveBeenCalledWith('id', set.sessionId)
    expect(secondEq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('restores validated sessions, including RIR 0 sets, and reports malformed remote records', async () => {
    const select = vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [{ payload: { id: set.sessionId, completedAt: set.completedAt, schemaVersion: 1, sets: [set] } }, { payload: { bad: true } }], error: null }) })) }))
    const client = { from: vi.fn(() => ({ select })) }
    await expect(restoreSessions(client as never, 'user-1', [])).resolves.toMatchObject({ added: 1, skipped: 1, history: [set] })
  })
})
