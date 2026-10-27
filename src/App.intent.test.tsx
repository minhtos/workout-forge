import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addExerciseToDay, createBlock } from './domain/program'
import { emptyState } from './domain/storage'
import { set } from './domain/testSets'

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 27, 12))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const seedState = (patch: Record<string, unknown>) => window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), ...patch }))
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)
const goalButtons = () => within(screen.getByRole('group', { name: 'Block goal' })).getAllByRole('button')
const lockedPush = () => {
  let block = createBlock(2, 4, 1, 'push')
  for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
  return { ...block, locked: true, startedAt: '2026-10-20T09:00:00.000Z' }
}

describe('setup: the goal card', () => {
  const openSetup = () => { render(<App />); fireEvent.click(screen.getByRole('button', { name: /get started/i })) }

  it('offers three goals as optional toggle buttons, none selected', () => {
    openSetup()
    expect(screen.getByText('03 — Goal')).toBeTruthy()
    expect(screen.getByText('Optional')).toBeTruthy()
    expect(goalButtons().map((button) => button.querySelector('strong')?.textContent)).toEqual(['Stay Consistent', 'Push Further', 'Comeback'])
    expect(goalButtons().every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('continues without a goal, and the block has none', () => {
    openSetup()
    fireEvent.click(screen.getByRole('button', { name: /choose exercises/i }))
    expect(screen.getByRole('heading', { name: 'Choose your exercises' })).toBeTruthy()
    expect(document.querySelector('.block-name')?.textContent).toBe('3-day · 4-week block')
    expect((JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { block: { intent?: unknown } }).block.intent ?? null).toBeNull()
  })

  it('shows the composed name in the preview, and in the Plan heading after continuing', () => {
    openSetup()
    fireEvent.click(screen.getByRole('button', { name: /^2 days/i }))
    fireEvent.click(screen.getByRole('button', { name: /^6 weeks/i }))
    fireEvent.click(screen.getByRole('button', { name: /Push Further/ }))
    const preview = screen.getByRole('region', { name: 'Program preview' })
    expect(within(preview).getByRole('heading', { level: 2 }).textContent).toBe('Push Further — 2-day · 6-week block')
    fireEvent.click(screen.getByRole('button', { name: /choose exercises/i }))
    expect(document.querySelector('.block-name')?.textContent).toBe('Push Further — 2-day · 6-week block')
  })

  it('names a 12-week choice a program', () => {
    openSetup()
    fireEvent.click(screen.getByRole('button', { name: /^12 weeks/i }))
    fireEvent.click(screen.getByRole('button', { name: /Stay Consistent/ }))
    expect(within(screen.getByRole('region', { name: 'Program preview' })).getByRole('heading', { level: 2 }).textContent).toBe('Stay Consistent — 3-day · 12-week program')
  })

  it('lets a chosen goal be unchosen', () => {
    openSetup()
    const [consistent] = goalButtons()
    fireEvent.click(consistent)
    expect(consistent.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(consistent)
    expect(consistent.getAttribute('aria-pressed')).toBe('false')
    expect(within(screen.getByRole('region', { name: 'Program preview' })).getByRole('heading', { level: 2 }).textContent).toBe('3-day · 4-week block')
  })

  it('does not suggest Comeback to someone who has never trained, or who trained recently', () => {
    openSetup()
    expect(screen.queryByText('Suggested')).toBeNull()
    cleanup()
    seedState({ history: [set('s', 1, daysAgo(27))] })
    render(<App />)
    expect(screen.queryByText('Suggested')).toBeNull()
    expect(screen.queryByText(/since your last workout/)).toBeNull()
  })

  it('badges Comeback after 4 weeks away, says how long, and still leaves every goal unselected', () => {
    seedState({ history: [set('s', 1, daysAgo(35))] })
    render(<App />)
    const comeback = goalButtons()[2]
    expect(within(comeback).getByText('Suggested')).toBeTruthy()
    expect(screen.getByText(/It's been 5 weeks since your last workout/)).toBeTruthy()
    expect(goalButtons().every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true)
    fireEvent.click(comeback)
    expect(within(screen.getByRole('region', { name: 'Program preview' })).getByRole('heading', { level: 2 }).textContent).toBe('Comeback — 3-day · 4-week block')
  })
})

describe('naming a started block', () => {
  it('puts the goal in the Today eyebrow, in capitals, ahead of the week', () => {
    seedState({ block: lockedPush() })
    render(<App />)
    expect(document.querySelector('.eyebrow')?.textContent).toBe('PUSH FURTHER · WEEK 1 OF 5 · DAY 1 OF 2')
  })

  it('leaves the Today eyebrow as it was when there is no goal', () => {
    seedState({ block: { ...lockedPush(), intent: null } })
    render(<App />)
    expect(document.querySelector('.eyebrow')?.textContent).toBe('WEEK 1 OF 5 · DAY 1 OF 2')
  })

  it('shows a block saved before goals existed without a name or an error', () => {
    const { intent: _intent, ...legacy } = lockedPush()
    seedState({ block: legacy })
    render(<App />)
    expect(document.querySelector('.eyebrow')?.textContent).toBe('WEEK 1 OF 5 · DAY 1 OF 2')
  })

  it('shows the full name on the Plan heading before the block starts', () => {
    seedState({ block: { ...lockedPush(), locked: false, startedAt: null } })
    render(<App />)
    expect(screen.getByText('Push Further — 2-day · 4-week block')).toBeTruthy()
  })
})
