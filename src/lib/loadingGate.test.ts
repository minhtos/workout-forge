import { describe, expect, it } from 'vitest'
import { hasSessionHint, isLoadingGate, sessionHintKey, type GateInput } from './loadingGate'

const base: GateInput = { hasLocalData: false, sessionHint: true, authResolved: false, signedIn: false, firstSyncSettled: false, timedOut: false }
const gate = (patch: Partial<GateInput>) => isLoadingGate({ ...base, ...patch })

describe('isLoadingGate', () => {
  it('is never on when the device has local data, at any stage', () => {
    for (const patch of [{}, { authResolved: true, signedIn: true }, { authResolved: true, signedIn: true, firstSyncSettled: true }, { authResolved: true }]) expect(gate({ ...patch, hasLocalData: true })).toBe(false)
  })

  it('waits for auth only when the session key hints at a signed-in visitor', () => {
    expect(gate({ sessionHint: true })).toBe(true)
    expect(gate({ sessionHint: false })).toBe(false)
  })

  it('opens at once when auth says nobody is signed in', () => {
    expect(gate({ authResolved: true, signedIn: false })).toBe(false)
  })

  it('holds while a signed-in user\'s first sync is running, and releases when it settles', () => {
    expect(gate({ authResolved: true, signedIn: true })).toBe(true)
    expect(gate({ authResolved: true, signedIn: true, firstSyncSettled: true })).toBe(false)
  })

  it('gives up after the timeout in every stage', () => {
    expect(gate({ timedOut: true })).toBe(false)
    expect(gate({ authResolved: true, signedIn: true, timedOut: true })).toBe(false)
  })
})

describe('session hint', () => {
  it('derives the key the way supabase-js does: the first hostname label', () => {
    expect(sessionHintKey('https://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token')
    expect(sessionHintKey('http://localhost:54321')).toBe('sb-localhost-auth-token')
    expect(sessionHintKey('not a url')).toBeNull()
    expect(sessionHintKey(undefined)).toBeNull()
  })

  it('checks that the key exists and nothing else', () => {
    const storage = (items: Record<string, string>) => ({ getItem: (key: string) => items[key] ?? null })
    expect(hasSessionHint('https://abcdefgh.supabase.co', storage({ 'sb-abcdefgh-auth-token': '' }))).toBe(true)
    expect(hasSessionHint('https://abcdefgh.supabase.co', storage({ 'sb-other-auth-token': 'x' }))).toBe(false)
    expect(hasSessionHint(undefined, storage({}))).toBe(false)
    expect(hasSessionHint('https://abcdefgh.supabase.co', { getItem: () => { throw new Error('blocked') } })).toBe(false)
  })
})
