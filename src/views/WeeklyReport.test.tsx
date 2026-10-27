import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { set } from '../domain/testSets'
import { weeklyReport } from '../domain/weeklyReport'
import { WeeklyReport } from './WeeklyReport'

afterEach(cleanup)

const NOW = new Date(2026, 9, 12, 12) // Monday 12 Oct; the report week is Sun 4 – Sat 10 Oct
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour)
const history = [
  set('o', 1, new Date(2026, 8, 29, 12)), set('o', 2, new Date(2026, 8, 29, 12, 5), { exerciseId: 'pull-ups', exerciseName: 'Pull-ups', weight: 0, reps: 6 }),
  set('p', 1, at(6), { weight: 110 }), set('p', 2, at(6, 13), { exerciseId: 'pull-ups', exerciseName: 'Pull-ups', weight: 0, reps: 8 }),
  set('q', 1, at(8), { weight: 105, reps: 8 }),
]
const report = weeklyReport(history, null, NOW)!

describe('WeeklyReport', () => {
  it('states last week in plain numbers', () => {
    render(<WeeklyReport report={report} placement="today" onDismiss={() => {}} />)
    const card = screen.getByRole('region', { name: '2 workouts last week' })
    expect(within(card).getByText('Last week · Oct 4 – Oct 10')).toBeTruthy()
    const stats = Object.fromEntries([...card.querySelectorAll('.report-stats div')].map((item) => [item.querySelector('dt')?.textContent, item.querySelector('dd')?.textContent]))
    expect(stats).toEqual({ Workouts: '2', Sets: '3', Volume: '1,940 lb', 'Week streak': '2' })
  })

  it('lists personal records with the same figures as the in-workout banner', () => {
    render(<WeeklyReport report={report} placement="today" onDismiss={() => {}} />)
    const items = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(items).toHaveLength(2)
    expect(items.some((text) => /Barbell Bench Press 110 lb × 10, estimated max up \d+ lb/.test(text ?? ''))).toBe(true)
    expect(items.some((text) => /Pull-ups 8 reps, 2 more than before/.test(text ?? ''))).toBe(true)
  })

  it('says so, without celebrating, when there are no records', () => {
    const quiet = weeklyReport([set('o', 1, new Date(2026, 8, 29)), set('q', 1, at(8), { weight: 90 })], null, NOW)!
    render(<WeeklyReport report={quiet} placement="today" onDismiss={() => {}} />)
    expect(screen.getByText('No new personal records.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Personal records' })).toBeNull()
  })

  it('reports a week with no workouts as zeros', () => {
    const empty = weeklyReport([set('o', 1, new Date(2026, 8, 29))], null, NOW)!
    render(<WeeklyReport report={empty} placement="progress" />)
    expect(screen.getByRole('region', { name: 'No workouts last week' })).toBeTruthy()
    expect([...document.querySelectorAll('.report-stats dd')].map((item) => item.textContent)).toEqual(['0', '0', '0 lb', '0'])
    expect(screen.queryByText(/personal records/i)).toBeNull()
  })

  it('has a dismiss button on Today that calls back, and none on Progress', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(<WeeklyReport report={report} placement="today" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss weekly report' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    unmount()
    render(<WeeklyReport report={report} placement="progress" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
