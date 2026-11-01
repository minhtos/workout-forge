import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { bannerStateKey } from './domain/installBanner'
import { addExerciseToDay, createBlock } from './domain/program'
import { emptyState } from './domain/storage'

const stubStandalone = (standalone: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: standalone && query === '(display-mode: standalone)', media: query, addEventListener: () => {}, removeEventListener: () => {} }))
const bannerHeading = () => screen.queryByRole('heading', { name: 'Install Workout Forge' })
const chip = () => screen.queryByText(/get the app — tap for install steps/i)

beforeEach(() => {
  window.localStorage.clear()
  stubStandalone(false)
  let block = createBlock(2, 4, 1, 'push')
  for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
  window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: { ...block, locked: true, startedAt: '2026-10-20T09:00:00.000Z' } }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (window as { onbeforeinstallprompt?: unknown }).onbeforeinstallprompt
})

describe('install banner', () => {
  it('shows on the Today surface, then minimizes to a chip, expands and closes', () => {
    render(<App />)
    expect(bannerHeading()).toBeTruthy()
    expect(screen.getByText('Full-screen, works offline, one tap from your home screen.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Minimize install banner' }))
    expect(window.localStorage.getItem(bannerStateKey)).toBe('min')
    expect(bannerHeading()).toBeNull()
    fireEvent.click(screen.getByText(/get the app — tap for install steps/i))
    expect(bannerHeading()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close install banner' }))
    expect(window.localStorage.getItem(bannerStateKey)).toBe('off')
    expect(bannerHeading()).toBeNull()
    expect(chip()).toBeNull()
  })

  it('stays gone after it was closed', () => {
    window.localStorage.setItem(bannerStateKey, 'off')
    render(<App />)
    expect(bannerHeading()).toBeNull()
    expect(chip()).toBeNull()
  })

  it('never renders in an installed app, even with full stored', () => {
    stubStandalone(true)
    window.localStorage.setItem(bannerStateKey, 'full')
    render(<App />)
    expect(bannerHeading()).toBeNull()
    expect(chip()).toBeNull()
  })

  it('does not render during an active session, in any state', () => {
    for (const stored of ['full', 'min']) {
      window.localStorage.setItem(bannerStateKey, stored)
      const { unmount } = render(<App />)
      expect(bannerHeading() ?? chip()).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /start workout|resume workout/i }))
      expect(screen.getByRole('button', { name: /finish/i })).toBeTruthy()
      expect(bannerHeading()).toBeNull()
      expect(chip()).toBeNull()
      unmount()
      // A reload with the session still in progress opens straight into it, banner still away.
      const reload = render(<App />)
      expect(bannerHeading()).toBeNull()
      expect(chip()).toBeNull()
      reload.unmount()
      window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}'), activeSession: null, history: [] }))
    }
  })

  it('swaps the manual steps for an Install app button once the browser offers the prompt, and closes after accepting', async () => {
    Object.assign(window, { onbeforeinstallprompt: null })
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
    expect(screen.getByText('Tap the menu in your browser')).toBeTruthy()
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) })
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })) })
    expect(prompt).toHaveBeenCalledOnce()
    expect(window.localStorage.getItem(bannerStateKey)).toBe('off')
    expect(bannerHeading()).toBeNull()
  })

  it.each(['full', 'min'])('stays away on Today after backing out of an unfinished session (stored %s)', (stored) => {
    window.localStorage.setItem(bannerStateKey, stored)
    render(<App />)
    expect(bannerHeading() ?? chip()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('button', { name: /resume workout/i })).toBeTruthy()
    expect(bannerHeading()).toBeNull()
    expect(chip()).toBeNull()
  })

  const promptEvent = () => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' as const }) })

  it('leaves the native prompt alone once the banner was closed', () => {
    Object.assign(window, { onbeforeinstallprompt: null })
    window.localStorage.setItem(bannerStateKey, 'off')
    render(<App />)
    const event = promptEvent()
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })

  it('leaves the native prompt alone on platforms the banner cannot serve', () => {
    render(<App />) // no onbeforeinstallprompt at startup, so the platform is classified other
    const event = promptEvent()
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByRole('button', { name: 'Install app' })).toBeNull()
  })

  it('closes when the browser reports the app was installed', () => {
    render(<App />)
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(window.localStorage.getItem(bannerStateKey)).toBe('off')
    expect(bannerHeading()).toBeNull()
  })
})
