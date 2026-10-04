import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => { window.localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function startBlock(days: '3' | '4' = '3', weeks: '4' | '5' | '6' = '5') {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${days} days`, 'i') }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${weeks} weeks`, 'i') }))
  fireEvent.click(screen.getByRole('button', { name: /choose exercises/i }))
}
const savedHistory = () => (JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { history?: unknown[] }).history ?? []

describe('Workout Forge gym flow', () => {
  it('blocks starting until every slot has an exercise, then locks the plan', () => {
    startBlock()
    const start = screen.getByRole('button', { name: /start block/i }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Day 1 slot 1 exercise'), { target: { value: 'barbell-bench-press' } })
    fireEvent.click(screen.getByRole('button', { name: /fill suggested exercises/i }))
    expect((screen.getByLabelText('Day 1 slot 1 exercise') as HTMLSelectElement).value).toBe('barbell-bench-press')
    expect(start.disabled).toBe(false)
    fireEvent.click(start)

    expect(screen.getByRole('heading', { name: 'Push' })).toBeTruthy()
    expect(screen.getByText(/week 1 of 5 · day 1 of 3/i)).toBeTruthy()
    expect(screen.queryByText('Pull')).toBeNull()
    expect(screen.queryByLabelText('Day 1 slot 1 exercise')).toBeNull()
  })

  it('saves every set as it is logged and resumes the session after a reload', () => {
    startBlock('3', '4')
    fireEvent.click(screen.getByRole('button', { name: /fill suggested exercises/i }))
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(screen.getByRole('alert').textContent).toMatch(/enter a weight/i)
    expect(savedHistory()).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    fireEvent.change(screen.getByLabelText('Set 1 RIR'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(savedHistory()).toHaveLength(1)

    cleanup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Push' })).toBeTruthy()
    expect((screen.getByLabelText('Set 1 weight') as HTMLInputElement).value).toBe('135')
    expect(screen.getByRole('button', { name: 'Undo set 1' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Undo set 1' }))
    expect(savedHistory()).toHaveLength(0)
  })

  it('advances to the next day after finishing and shows only that day', () => {
    startBlock()
    fireEvent.click(screen.getByRole('button', { name: /fill suggested exercises/i }))
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    fireEvent.click(screen.getByRole('button', { name: /finish workout/i }))

    expect(screen.getByRole('heading', { name: 'Pull' })).toBeTruthy()
    expect(screen.getByText(/week 1 of 5 · day 2 of 3/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    const progress = screen.getByRole('region', { name: /progress/i })
    expect(within(progress).getByText(/barbell bench press: 135 lb × 6/i)).toBeTruthy()
  })
})
