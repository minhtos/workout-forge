import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LandingView } from './LandingView'

afterEach(cleanup)

const setup = (cloudEnabled = true) => {
  const handlers = {
    onStart: vi.fn(),
    onSignIn: vi.fn().mockResolvedValue({ ok: true, message: 'Signed in.' }),
    onSignUp: vi.fn().mockResolvedValue({ ok: true, message: 'Created.' }),
    onReset: vi.fn().mockResolvedValue({ ok: true, message: 'Sent.' }),
    onFeedback: vi.fn().mockResolvedValue({ ok: true, message: 'Sent — thank you.' }),
  }
  render(<LandingView cloudEnabled={cloudEnabled} {...handlers} />)
  return handlers
}

describe('LandingView', () => {
  it('shows a sample week generated from a real Workout Set', () => {
    setup()
    expect(screen.getByRole('heading', { name: /a week, built for you/i })).toBeTruthy()
    // Day titles and exercises come from the Push | Pull | Legs builder output.
    expect(screen.getAllByText(/barbell bench press/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/barbell squat|leg press/i).length).toBeGreaterThan(0)
  })

  it('shows the app preview and the three how-it-works steps', () => {
    setup()
    expect(screen.getByRole('img', { name: /preview of a workout forge session/i })).toBeTruthy()
    expect(screen.getByText('Build your block')).toBeTruthy()
    expect(screen.getByText('Log every set')).toBeTruthy()
    expect(screen.getByText('Lift more next time')).toBeTruthy()
  })

  it('links the feedback badge to a working feedback form', async () => {
    const { onFeedback } = setup()
    expect(screen.getByRole('link', { name: /feedback welcome/i }).getAttribute('href')).toBe('#feedback')
    fireEvent.change(screen.getByLabelText(/your feedback/i), { target: { value: 'Love the deload week.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    await waitFor(() => expect(onFeedback).toHaveBeenCalledWith('Love the deload week.', ''))
  })

  it('hides account and feedback forms when the cloud is off', () => {
    setup(false)
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(screen.queryByLabelText(/your feedback/i)).toBeNull()
    expect(screen.getByText(/feedback is unavailable in this build/i)).toBeTruthy()
  })
})
