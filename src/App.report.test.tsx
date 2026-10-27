import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { loadReportDismissed, saveReportDismissed } from './domain/settings'
import { addExerciseToDay, createBlock } from './domain/program'
import { emptyState } from './domain/storage'
import { set } from './domain/testSets'

// Today's report is for the last finished Sun–Sat week. "Now" is Wednesday 14 Oct 2026, so that is Sun 4 – Sat 10 Oct.
beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const lockedBlock = () => {
  let block = createBlock(2, 4)
  for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
  return { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z', completedIds: ['w1-d1'] }
}
const lastWeek = [set('o', 1, new Date(2026, 8, 29, 12)), set('p', 1, new Date(2026, 9, 6, 12), { weight: 110 }), set('q', 1, new Date(2026, 9, 8, 12), { weight: 100, exerciseId: 'barbell-row', exerciseName: 'Barbell Row' })]
const seed = (history: unknown[]) => window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: lockedBlock(), history }))
const reportCard = () => screen.queryByRole('region', { name: /last week/i })

describe('weekly report on Today', () => {
  it('shows last week under the progress line, and can be dismissed for good', () => {
    seed(lastWeek)
    render(<App />)
    expect(screen.getByRole('region', { name: '2 workouts last week' })).toBeTruthy()
    expect(document.querySelector('.report-today')?.previousElementSibling?.className).toBe('progress-line')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss weekly report' }))
    expect(reportCard()).toBeNull()
    expect(loadReportDismissed()).toBe('2026-10-04')

    cleanup()
    render(<App />)
    expect(reportCard()).toBeNull()
  })

  it('comes back for the next week even after a dismissal', () => {
    saveReportDismissed('2026-09-27')
    seed(lastWeek)
    render(<App />)
    expect(reportCard()).not.toBeNull()
  })

  it('is gone once a workout is completed this week', () => {
    seed([...lastWeek, set('n', 1, new Date(2026, 9, 12, 8))])
    render(<App />)
    expect(reportCard()).toBeNull()
  })

  it('is not shown on Today when last week had no workouts, but Progress still shows the zeros', () => {
    seed([set('o', 1, new Date(2026, 8, 29, 12))])
    render(<App />)
    expect(reportCard()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.getByRole('region', { name: 'No workouts last week' })).toBeTruthy()
  })

  it('always shows on Progress without a dismiss button, even after dismissing it on Today', () => {
    seed(lastWeek)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss weekly report' }))
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(screen.getByRole('region', { name: '2 workouts last week' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dismiss weekly report' })).toBeNull()
  })

  it('lists Progress sections in order: map, last week, consistency', () => {
    seed(lastWeek)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(titles.slice(0, 3)).toEqual(['Where the work went', '2 workouts last week', 'Consistency'])
  })
})
