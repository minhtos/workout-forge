import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addExerciseToDay, createBlock } from './domain/program'
import { emptyState } from './domain/storage'

const mocks = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('./lib/supabase', () => ({
  get supabase() { return mocks.client },
  requireSupabase: () => mocks.client,
}))

type Reply = { data: unknown; error: { message: string } | null }
const sessionKey = 'sb-testref-auth-token'
const setupQuestion = /how many days per week/i

let block = createBlock(2, 4)
for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
const lockedBlock = { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z' }
const loggedSet = { id: '550e8400-e29b-41d4-a716-446655440000-1', sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: 1, weight: 135, reps: 8, rir: 2, weightUnit: 'lb', completedAt: '2026-09-29T10:00:00.000Z', weekNumber: 1, repRange: { min: 6, max: 12 }, targetRir: 2, targetReps: 8 }
const snapshot = { version: 1, updatedAt: '2026-10-01T00:00:00.000Z', block: lockedBlock, customExercises: [], hiddenExerciseIds: [], feedback: [] }

/** A stand-in Supabase client: one signed-in (or not) session, and a program row the test decides when to deliver. */
function mockClient({ signedIn, program, sessions = [] }: { signedIn: boolean; program: () => Promise<Reply>; sessions?: unknown[] }) {
  const empty = { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: sessions, error: null }) }) }), upsert: () => Promise.resolve({ error: null }) }
  mocks.client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: signedIn ? { user: { id: 'user-1', email: 'lifter@example.com' } } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: (table: string) => table === 'user_programs' ? { select: () => ({ eq: () => ({ maybeSingle: program }) }), upsert: () => Promise.resolve({ error: null }) } : empty,
  }
}
const deferred = () => {
  let resolve!: (reply: Reply) => void
  const promise = new Promise<Reply>((done) => { resolve = done })
  return { promise, resolve }
}
const settle = () => act(() => new Promise<void>((done) => setTimeout(done, 40)))

let sawSetup = false
let observer: MutationObserver
beforeEach(() => {
  window.localStorage.clear()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://testref.supabase.co')
  sawSetup = false
  observer = new MutationObserver(() => { if (setupQuestion.test(document.body.textContent ?? '')) sawSetup = true })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
})
afterEach(() => { observer.disconnect(); cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); mocks.client = null })

describe('loading state while the account program loads', () => {
  it('shows a skeleton, never the setup question, until the program arrives, then lands on Today', async () => {
    window.localStorage.setItem(sessionKey, '{"present":true}')
    const pending = deferred()
    mockClient({ signedIn: true, program: () => pending.promise })
    render(<App />)

    expect(screen.getByRole('status').textContent).toBe('Loading your program…')
    expect(screen.queryByRole('button', { name: /get started/i })).toBeNull()
    await settle()
    expect(screen.getByRole('status').textContent).toBe('Loading your program…')
    expect(screen.queryByText(setupQuestion)).toBeNull()

    await act(async () => { pending.resolve({ data: { payload: snapshot }, error: null }) })
    expect(await screen.findByRole('heading', { name: 'Day 1' })).toBeTruthy()
    expect(screen.queryByText('Loading your program…')).toBeNull()
    expect(sawSetup).toBe(false)
  })

  it('keeps the skeleton when restored sets land before the plan, so the setup question never flashes', async () => {
    window.localStorage.setItem(sessionKey, '{"present":true}')
    const pending = deferred()
    mockClient({ signedIn: true, program: () => pending.promise, sessions: [{ payload: { id: loggedSet.sessionId, completedAt: loggedSet.completedAt, schemaVersion: 1, sets: [loggedSet] } }] })
    render(<App />)

    await settle()
    // The cloud history has been restored into the app by now, while the plan is still in flight.
    expect(JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}').history).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('Loading your program…')
    expect(screen.queryByText(setupQuestion)).toBeNull()

    await act(async () => { pending.resolve({ data: { payload: snapshot }, error: null }) })
    expect(await screen.findByRole('heading', { name: 'Day 1' })).toBeTruthy()
    expect(sawSetup).toBe(false)
  })

  it('falls back to the setup screen when the first sync fails, and keeps the error message', async () => {
    window.localStorage.setItem(sessionKey, '{"present":true}')
    mockClient({ signedIn: true, program: () => Promise.resolve({ data: null, error: { message: 'boom' } }) })
    render(<App />)

    expect(await screen.findByText(setupQuestion)).toBeTruthy()
    expect(screen.queryByText('Loading your program…')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByText(/plan backup pending: boom/i)).toBeTruthy()
  })

  it('goes straight to Today with no skeleton when the device already has a program', async () => {
    window.localStorage.setItem(sessionKey, '{"present":true}')
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: lockedBlock }))
    mockClient({ signedIn: true, program: () => new Promise<Reply>(() => undefined) })
    render(<App />)

    expect(screen.queryByText('Loading your program…')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Day 1' })).toBeTruthy()
    await settle()
    expect(screen.queryByText('Loading your program…')).toBeNull()
  })

  it('shows the landing page at once when there is no saved session', async () => {
    mockClient({ signedIn: false, program: () => new Promise<Reply>(() => undefined) })
    render(<App />)

    expect(screen.getByRole('button', { name: /get started/i })).toBeTruthy()
    expect(screen.queryByText('Loading your program…')).toBeNull()
    await settle()
    expect(screen.getByRole('button', { name: /get started/i })).toBeTruthy()
  })

  it('gives up after 8 seconds and shows the normal screen', async () => {
    vi.useFakeTimers()
    try {
      window.localStorage.setItem(sessionKey, '{"present":true}')
      mockClient({ signedIn: true, program: () => new Promise<Reply>(() => undefined) })
      render(<App />)
      await act(async () => { await vi.advanceTimersByTimeAsync(7000) })
      expect(screen.getByRole('status').textContent).toBe('Loading your program…')
      await act(async () => { await vi.advanceTimersByTimeAsync(1100) })
      expect(screen.queryByText('Loading your program…')).toBeNull()
      expect(screen.getByText(setupQuestion)).toBeTruthy()
    } finally { vi.useRealTimers() }
  })
})
