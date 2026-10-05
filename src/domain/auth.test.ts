import { describe, expect, it } from 'vitest'
import { authMessage, credentialsProblem } from './auth'

describe('credentialsProblem', () => {
  it('requires a plausible email and a password', () => {
    expect(credentialsProblem('', 'secret123', false)).toMatch(/valid email/)
    expect(credentialsProblem('someone@', 'secret123', false)).toMatch(/valid email/)
    expect(credentialsProblem('a@b.co', '', false)).toMatch(/enter your password/i)
    expect(credentialsProblem(' a@b.co ', 'x', false)).toBeNull()
  })

  it('asks for 8 characters only when creating a password', () => {
    expect(credentialsProblem('a@b.co', 'short', true)).toMatch(/at least 8/)
    expect(credentialsProblem('a@b.co', '12345678', true)).toBeNull()
  })
})

describe('authMessage', () => {
  it('words common Supabase errors for people', () => {
    expect(authMessage({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe('Email or password is incorrect.')
    expect(authMessage({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toMatch(/confirm your email/i)
    expect(authMessage({ message: 'x', code: 'over_email_send_rate_limit' })).toMatch(/too many/i)
    expect(authMessage({ message: 'Something odd' })).toBe('Something odd')
  })
})
