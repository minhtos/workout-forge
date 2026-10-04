import { describe, expect, it, vi } from 'vitest'
import { addExerciseToDay, createBlock } from './program'
import { applyProgramSnapshot, decideSync, parseProgramSnapshot, runProgramSync, type ProgramSnapshot } from './programSync'
import { emptyState, type SavedWorkoutState } from './storage'

const T1 = '2026-10-05T10:00:00.000Z'
const T2 = '2026-10-05T11:00:00.000Z'

const block = { ...addExerciseToDay(createBlock(2, 4), 0, 'barbell-bench-press'), completedIds: ['w1-d1'] }
const snapshot = (updatedAt: string, overrides: Partial<ProgramSnapshot> = {}): ProgramSnapshot => ({ block, customExercises: [{ id: 'custom-dips', name: 'Dips', category: 'Chest' }], hiddenExerciseIds: ['pull-ups'], feedback: [], updatedAt, ...overrides })
const local = (overrides: Partial<SavedWorkoutState> = {}): SavedWorkoutState => ({ ...emptyState(), block, programUpdatedAt: T1, ...overrides })

/** A tiny stand-in for the Supabase client: one stored row, plus spies for what was written. */
function fakeClient(row: unknown | null, options: { pullError?: string; pushError?: string } = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: options.pushError ? { message: options.pushError } : null })
  const maybeSingle = vi.fn().mockResolvedValue(options.pullError ? { data: null, error: { message: options.pullError } } : { data: row === null ? null : { payload: row }, error: null })
  const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })), upsert })) }
  return { client: client as never, upsert }
}
const stored = (s: ProgramSnapshot) => ({ version: 1, ...s })

describe('deciding which copy wins', () => {
  it('uploads when the cloud has nothing and this device has a program', () => {
    expect(decideSync(T1, true, null)).toBe('push')
    expect(decideSync(null, true, null)).toBe('push')
    expect(decideSync(null, false, null)).toBe('none')
  })
  it('a device that never synced defers to the cloud copy', () => expect(decideSync(null, true, snapshot(T1))).toBe('adopt'))
  it('newest timestamp wins, equal means nothing to do', () => {
    expect(decideSync(T1, true, snapshot(T2))).toBe('adopt')
    expect(decideSync(T2, true, snapshot(T1))).toBe('push')
    expect(decideSync(T1, true, snapshot(T1))).toBe('none')
  })
})

describe('reading what the cloud sends back', () => {
  it('accepts a valid snapshot, including a null block', () => {
    expect(parseProgramSnapshot(stored(snapshot(T1)))).toEqual(snapshot(T1))
    expect(parseProgramSnapshot(stored(snapshot(T1, { block: null })))?.block).toBeNull()
  })
  it('rejects malformed or tampered data instead of loading it', () => {
    expect(parseProgramSnapshot({ version: 1 })).toBeNull()
    expect(parseProgramSnapshot('nope')).toBeNull()
    expect(parseProgramSnapshot({ ...stored(snapshot(T1)), version: 2 })).toBeNull()
    expect(parseProgramSnapshot({ ...stored(snapshot(T1)), updatedAt: 'yesterday' })).toBeNull()
    expect(parseProgramSnapshot(stored(snapshot(T1, { customExercises: [{ id: 'x', name: 'X', category: 'Wings' as never }] })))).toBeNull()
    expect(parseProgramSnapshot(stored(snapshot(T1, { block: { ...block, trainingDays: 9 as never } })))).toBeNull()
    expect(parseProgramSnapshot(stored(snapshot(T1, { block: { ...block, templates: [] } })))).toBeNull()
  })
})

describe('running a sync', () => {
  it('uploads this device\'s program when it is newer', async () => {
    const { client, upsert } = fakeClient(stored(snapshot(T1)))
    const outcome = await runProgramSync(client, 'user-1', local({ programUpdatedAt: T2 }), T2)
    expect(outcome).toEqual({ kind: 'pushed', updatedAt: T2 })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', updated_at: T2, schema_version: 1 }), { onConflict: 'user_id' })
  })

  it('stamps a never-synced device with the current time when it first uploads', async () => {
    const { client, upsert } = fakeClient(null)
    const outcome = await runProgramSync(client, 'user-1', local({ programUpdatedAt: null }), T2)
    expect(outcome).toEqual({ kind: 'pushed', updatedAt: T2 })
    expect(upsert.mock.calls[0][0].payload).toMatchObject({ version: 1, updatedAt: T2 })
  })

  it('does nothing for an empty device with an empty cloud', async () => {
    const { client, upsert } = fakeClient(null)
    expect(await runProgramSync(client, 'user-1', emptyState(), T2)).toEqual({ kind: 'none' })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('downloads a newer cloud program onto a new device', async () => {
    const { client, upsert } = fakeClient(stored(snapshot(T2)))
    const outcome = await runProgramSync(client, 'user-1', emptyState(), T2)
    expect(outcome).toEqual({ kind: 'adopted', snapshot: snapshot(T2) })
    expect(upsert).not.toHaveBeenCalled()
    const applied = applyProgramSnapshot(emptyState(), snapshot(T2))
    expect(applied).toMatchObject({ block, hiddenExerciseIds: ['pull-ups'], programUpdatedAt: T2, customExercises: [{ id: 'custom-dips' }] })
    expect(applied.history).toEqual([])
  })

  it('waits to download while a workout is in progress', async () => {
    const { client } = fakeClient(stored(snapshot(T2)))
    const active = local({ programUpdatedAt: T1, activeSession: { workoutId: 'w1-d1', sessionId: 's', sets: {} } })
    expect(await runProgramSync(client, 'user-1', active, T2)).toEqual({ kind: 'deferred' })
  })

  it('treats an unreadable cloud row like an empty one rather than loading it', async () => {
    const { client, upsert } = fakeClient({ garbage: true })
    expect(await runProgramSync(client, 'user-1', local(), T2)).toEqual({ kind: 'pushed', updatedAt: T1 })
    expect(upsert).toHaveBeenCalled()
  })

  it('reports network or permission errors so the change stays queued', async () => {
    expect(await runProgramSync(fakeClient(null, { pullError: 'offline' }).client, 'user-1', local(), T2)).toEqual({ kind: 'error', message: 'offline' })
    expect(await runProgramSync(fakeClient(null, { pushError: 'denied' }).client, 'user-1', local(), T2)).toEqual({ kind: 'error', message: 'denied' })
  })
})
