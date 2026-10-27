import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findPersonalRecord, recordText } from '../domain/personalRecord'
import { baseExercises } from '../domain/program'
import { muscleVolume } from '../domain/muscleVolume'
import { sampleHistory, sampleRecordSessionId, sampleWeekStart } from '../domain/sampleData'
import { completedSessions } from '../domain/weekly'
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

  it('leads with the outcome headline, the existing sub-line and the build-in-public note', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Get measurably stronger, week after week.' })).toBeTruthy()
    expect(screen.getByText(/builds your training block, logs your sets/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Get started free' })).toBeTruthy()
    expect(screen.getByText('Early access, built in public. What ships next comes from your feedback.')).toBeTruthy()
  })

  it('draws the hero visuals from the real record and muscle-volume code, captioned as sample data', () => {
    setup()
    const record = findPersonalRecord(sampleHistory, sampleRecordSessionId, 'barbell-bench-press')!
    const card = screen.getByLabelText('Sample personal record')
    expect(card.textContent).toContain(record.set.exerciseName)
    expect(card.textContent).toContain(recordText(record))
    expect(within(card).getByText('Sample data')).toBeTruthy()

    const data = muscleVolume(completedSessions(sampleHistory, null), baseExercises, sampleWeekStart)
    const rows = [...document.querySelectorAll('.landing-visuals .muscle-row')]
    expect(rows.map((row) => row.querySelector('.muscle-name')?.textContent)).toEqual(data.rows.map((row) => row.group))
    expect(rows[0].textContent).toContain(`${data.rows[0].sets} sets`)
    expect(screen.getAllByText('Sample data')).toHaveLength(2)
  })

  it('gives each sample map row a keyboard stop', () => {
    setup()
    const rows = document.querySelectorAll('.landing-visuals .muscle-row')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.getAttribute('tabindex')).toBe('0')
  })

  it('has a four-question FAQ with the agreed answers', () => {
    setup()
    const section = screen.getByRole('region', { name: 'Questions' })
    const items = [...section.querySelectorAll('details')].map((item) => [item.querySelector('summary')?.textContent, item.querySelector('p')?.textContent])
    expect(items).toEqual([
      ['Is it free?', 'Yes. Everything in Workout Forge is free to use.'],
      ['Does it work offline?', 'Yes. It installs like an app and every set saves on your device, with or without a connection.'],
      ['Where is my data stored?', 'In your browser on this device. If you create an account, your workouts and plan also back up to it.'],
      ['Do I need an account?', 'No. An account is only for backup and using more than one device.'],
    ])
  })

  it('moves the sign-in form to its own #signin section, reached from the bar', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('#signin')
    const section = document.getElementById('signin')!
    expect(section.tagName).toBe('SECTION')
    expect(within(section).getByLabelText('Email')).toBeTruthy()
    expect(document.querySelector('.landing-hero .auth-card')).toBeNull()
    expect(document.querySelector('.landing-hero')?.contains(screen.getByRole('button', { name: 'Get started free' }))).toBe(true)
  })

  it('shows no sign-in link or section when accounts are off', () => {
    setup(false)
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(document.getElementById('signin')).toBeNull()
  })

  it('makes no claims about price, ratings or numbers of users', () => {
    setup()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/[$€£]/)
    expect(text).not.toMatch(/pricing|per month|\/mo\b|subscription|premium|upgrade|discount|trial/i)
    expect(text).not.toMatch(/★|⭐|\d(\.\d)?\s*\/\s*5|\bstars?\b|\brated\b|\brating|review(s|ed)?\b|testimonial/i)
    expect(text).not.toMatch(/\d[\d,.]*\s*(\+\s*)?(users|lifters|members|athletes|downloads|people|customers)/i)
  })

  it('hides account and feedback forms when the cloud is off', () => {
    setup(false)
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(screen.queryByLabelText(/your feedback/i)).toBeNull()
    expect(screen.getByText(/feedback is unavailable in this build/i)).toBeTruthy()
  })
})
