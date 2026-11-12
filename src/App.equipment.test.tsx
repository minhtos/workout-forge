import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { equipmentKey } from './domain/equipment'
import { addExerciseToDay, createBlock } from './domain/program'
import { emptyState } from './domain/storage'

beforeEach(() => { window.localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const key = 'workout-forge:v3'
const saved = () => JSON.parse(window.localStorage.getItem(key) ?? '{}') as { history: { weight: number }[] }
const plates = () => [...document.querySelectorAll('.plate-block:not(.is-bar)')].map((node) => node.textContent)
const lockedBlock = (...ids: string[]) => {
  let block = createBlock(2, 4)
  for (const day of [0, 1]) for (const id of ids) block = addExerciseToDay(block, day, id)
  return { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z' }
}
const store = (block: ReturnType<typeof lockedBlock>, history: unknown[] = []) => window.localStorage.setItem(key, JSON.stringify({ ...emptyState(), block, history }))
function open() {
  render(<App />)
  const start = screen.queryByRole('button', { name: /get started/i })
  if (start) fireEvent.click(start)
}
function startSession() {
  open()
  fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
}
const setWeight = (weight: string) => fireEvent.change(screen.getAllByLabelText(/Set 1 weight$/)[0], { target: { value: weight } })
const legPressHistory = [1, 2, 3].map((n) => ({ id: `s-${n}`, sessionId: '550e8400-e29b-41d4-a716-446655440000', workoutId: 'w1-d1', exerciseId: 'leg-press-machine', exerciseName: 'Leg Press Machine', setIndex: n, weight: 200, reps: 10, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-10-01T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 12 }, targetRir: 3, targetReps: 10 }))
const restricted = JSON.stringify({ version: 1, missingPlates: [35, 2.5], missingDumbbells: [7.5, 12.5] })

describe('equipment inventory in the app', () => {
  it('T36 shows the default plate blocks when nothing is stored', () => {
    store(lockedBlock('barbell-bench-press'))
    startSession()
    setWeight('115')
    expect(plates()).toEqual(['35'])
  })

  it('T37 loads 115 without 35s from a stored inventory', () => {
    store(lockedBlock('barbell-bench-press'))
    window.localStorage.setItem(equipmentKey, JSON.stringify({ version: 1, missingPlates: [35], missingDumbbells: [] }))
    startSession()
    setWeight('115')
    expect(plates()).toEqual(['25', '10'])
  })

  it('T38 keeps a typed weight that the plates cannot make, and logs it as typed', () => {
    store(lockedBlock('barbell-bench-press'))
    window.localStorage.setItem(equipmentKey, JSON.stringify({ version: 1, missingPlates: [2.5], missingDumbbells: [] }))
    startSession()
    setWeight('137.5')
    expect((screen.getAllByLabelText(/Set 1 weight$/)[0] as HTMLInputElement).value).toBe('137.5')
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect((screen.getAllByLabelText(/Set 1 weight$/)[0] as HTMLInputElement).value).toBe('137.5')
    expect(saved().history[0].weight).toBe(137.5)
  })

  it('T39 saves a Settings toggle and keeps it after a remount', () => {
    store(lockedBlock('barbell-bench-press'))
    open()
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    const chip = () => screen.getByRole('button', { name: '35 lb plates' })
    expect(chip().getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip())
    expect(JSON.parse(window.localStorage.getItem(equipmentKey) ?? '{}')).toEqual({ version: 1, missingPlates: [35], missingDumbbells: [] })
    cleanup()
    open()
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    expect(chip().getAttribute('aria-pressed')).toBe('false')
  })

  it('T40 prefills a machine lift the same with a restricted inventory', () => {
    const prefill = () => {
      store(lockedBlock('leg-press-machine'), legPressHistory)
      startSession()
      const values = screen.getAllByLabelText(/Set \d weight$/).map((input) => (input as HTMLInputElement).value)
      cleanup()
      return values
    }
    const unrestricted = prefill()
    expect(unrestricted[0]).not.toBe('')
    window.localStorage.setItem(equipmentKey, restricted)
    expect(prefill()).toEqual(unrestricted)
  })
})
