import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { appVersion } from './domain/changelog'
import { addExerciseToDay, createBlock } from './domain/program'
import { emptyState } from './domain/storage'
import { lastSeenVersionKey } from './domain/whatsNew'

const bannerHeading = () => screen.queryByRole('heading', { name: `What's new in Workout Forge ${appVersion}` })
const installHeading = () => screen.queryByRole('heading', { name: 'Install Workout Forge' })
const lastSeen = () => window.localStorage.getItem(lastSeenVersionKey)

const seedBlock = () => {
  let block = createBlock(2, 4, 1, 'push')
  for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
  window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: { ...block, locked: true, startedAt: '2026-10-20T09:00:00.000Z' } }))
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('what’s new banner', () => {
  it('shows after an upgrade in place of the install banner, and dismissing stores the version and brings the install banner back', () => {
    seedBlock()
    window.localStorage.setItem(lastSeenVersionKey, '0.0.0')
    const { unmount } = render(<App />)
    expect(bannerHeading()).toBeTruthy()
    expect(screen.getByText('Fixed: dumbbell suggestions now name your actual heaviest dumbbell when a target goes past the top of your rack, and step up to it when the jump is small enough.')).toBeTruthy()
    expect(installHeading()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: "Dismiss what's new" }))
    expect(lastSeen()).toBe(appVersion)
    expect(bannerHeading()).toBeNull()
    expect(installHeading()).toBeTruthy()
    unmount()
    render(<App />)
    expect(bannerHeading()).toBeNull()
  })

  it('stays silent on a first install and records the version', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /get measurably stronger/i })).toBeTruthy()
    expect(bannerHeading()).toBeNull()
    expect(lastSeen()).toBe(appVersion)
  })

  it('shows once for an existing user with data but no stored version, and writes nothing until dismissed', () => {
    seedBlock()
    render(<App />)
    expect(bannerHeading()).toBeTruthy()
    expect(lastSeen()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: "Dismiss what's new" }))
    expect(lastSeen()).toBe(appVersion)
  })

  it('does not show on the same version', () => {
    seedBlock()
    window.localStorage.setItem(lastSeenVersionKey, appVersion)
    render(<App />)
    expect(bannerHeading()).toBeNull()
    expect(installHeading()).toBeTruthy()
  })

  it('stays away during a session, after a reload and after backing out, without touching the stored version', () => {
    seedBlock()
    window.localStorage.setItem(lastSeenVersionKey, '0.0.0')
    const { unmount } = render(<App />)
    expect(bannerHeading()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect(screen.getByRole('button', { name: /finish/i })).toBeTruthy()
    expect(bannerHeading()).toBeNull()
    unmount()
    render(<App />)
    expect(bannerHeading()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('button', { name: /resume workout/i })).toBeTruthy()
    expect(bannerHeading()).toBeNull()
    expect(lastSeen()).toBe('0.0.0')
  })

  it('does not show on the Settings view', () => {
    seedBlock()
    window.localStorage.setItem(lastSeenVersionKey, '0.0.0')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Changelog' })).toBeTruthy()
    expect(bannerHeading()).toBeNull()
  })
})
