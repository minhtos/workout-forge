import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'

afterEach(cleanup)

const setup = () => {
  const onSignIn = vi.fn().mockResolvedValue({ ok: true, message: 'Signed in.' })
  const onSignUp = vi.fn().mockResolvedValue({ ok: true, message: 'Check your email to confirm your account, then sign in.' })
  const onReset = vi.fn().mockResolvedValue({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' })
  render(<AuthForm idPrefix="t" onSignIn={onSignIn} onSignUp={onSignUp} onReset={onReset} />)
  return { onSignIn, onSignUp, onReset }
}
const fill = (email: string, password?: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  if (password !== undefined) fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

describe('AuthForm', () => {
  it('signs in with email and password', async () => {
    const { onSignIn } = setup()
    fill('me@example.com', 'secret123')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith('me@example.com', 'secret123'))
  })

  it('blocks a bad email or a short new password before calling the server', () => {
    const { onSignIn, onSignUp } = setup()
    fill('nope', 'secret123')
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    expect(screen.getByRole('alert').textContent).toMatch(/valid email/i)
    fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))
    fill('me@example.com', 'short')
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    expect(screen.getByRole('alert').textContent).toMatch(/at least 8/i)
    expect(onSignIn).not.toHaveBeenCalled()
    expect(onSignUp).not.toHaveBeenCalled()
  })

  it('creates an account and shows the server message', async () => {
    const { onSignUp } = setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))
    fill('me@example.com', 'secret123')
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() => expect(onSignUp).toHaveBeenCalledWith('me@example.com', 'secret123'))
    expect((await screen.findByRole('status')).textContent).toMatch(/check your email/i)
  })

  it('sends a reset link from the forgot-password view, with no password field', async () => {
    const { onReset } = setup()
    fireEvent.click(screen.getByRole('button', { name: /forgot your password/i }))
    expect(screen.queryByLabelText('Password')).toBeNull()
    fill('me@example.com')
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() => expect(onReset).toHaveBeenCalledWith('me@example.com'))
  })

  it('shows a failed sign-in as an alert', async () => {
    const { onSignIn } = setup()
    onSignIn.mockResolvedValue({ ok: false, message: 'Email or password is incorrect.' })
    fill('me@example.com', 'wrongpass1')
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect.')
  })
})
