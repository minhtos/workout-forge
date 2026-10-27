import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { set } from '../domain/testSets'
import { completedSessions } from '../domain/weekly'
import { TrainingRhythm } from './TrainingRhythm'

afterEach(cleanup)

const NOW = new Date(2026, 9, 14, 12) // Wednesday 14 Oct 2026
const sessions = completedSessions([
  ...[1, 2, 3].map((index) => set('a', index, new Date(2026, 9, 13, 9, index))),
  set('b', 1, new Date(2026, 9, 6, 9)),
], null)

describe('TrainingRhythm', () => {
  it('shows the streak as a large numeral', () => {
    const { container } = render(<TrainingRhythm sessions={sessions} now={NOW} />)
    expect(container.querySelector('.numeral-lg')?.textContent).toBe('2 weeks')
    expect(screen.getByText('Week streak')).toBeTruthy()
  })

  it('explains a streak that is counted through last week', () => {
    render(<TrainingRhythm sessions={completedSessions([set('b', 1, new Date(2026, 9, 6, 9))], null)} now={NOW} />)
    expect(screen.getByText(/counted through last week/i)).toBeTruthy()
  })

  it('draws 12 weeks of days and none after today', () => {
    const { container } = render(<TrainingRhythm sessions={sessions} now={NOW} />)
    expect(container.querySelectorAll('.heat-week')).toHaveLength(12)
    expect(container.querySelectorAll('.heat-cell')).toHaveLength(11 * 7 + 4)
    expect(container.querySelectorAll('.heat-cell.heat-4')).toHaveLength(1)
    expect(container.querySelectorAll('.heat-cell.heat-2')).toHaveLength(1)
  })

  it('reads out a day for the keyboard, like the charts', () => {
    render(<TrainingRhythm sessions={sessions} now={NOW} />)
    const grid = screen.getByRole('group', { name: /training days over the last 12 weeks/i })
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    expect(screen.getByRole('status').textContent).toBe('Wed Oct 14 · rest day')
    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(screen.getByRole('status').textContent).toBe('Tue Oct 13 · 1 workout · 3 sets')
    fireEvent.keyDown(grid, { key: 'ArrowLeft' })
    expect(screen.getByRole('status').textContent).toBe('Tue Oct 6 · 1 workout · 1 set')
    fireEvent.keyDown(grid, { key: 'Escape' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays on a real day when moving past the edges', () => {
    render(<TrainingRhythm sessions={sessions} now={NOW} />)
    const grid = screen.getByRole('group', { name: /training days/i })
    for (let step = 0; step < 3; step += 1) fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(screen.getByRole('status').textContent).toBe('Wed Oct 14 · rest day')
    fireEvent.keyDown(grid, { key: 'Home' })
    expect(screen.getByRole('status').textContent).toMatch(/^Wed Jul 29/)
  })

  it('has a table view with a row per week', () => {
    render(<TrainingRhythm sessions={sessions} now={NOW} />)
    const table = screen.getByRole('table', { hidden: true })
    expect(within(table).getAllByRole('columnheader', { hidden: true }).map((cell) => cell.textContent)).toEqual(['Week of', 'Workouts', 'Sets'])
    const rows = within(table).getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(13)
    expect(within(rows[12]).getAllByRole('cell', { hidden: true }).map((cell) => cell.textContent)).toEqual(['Oct 11', '1', '3'])
  })
})
