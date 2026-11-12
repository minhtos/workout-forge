import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addExerciseToDay, createBlock } from './domain/program'
import { applyWorkoutSet, findWorkoutSet } from './domain/workoutSets'
import { emptyState } from './domain/storage'

beforeEach(() => { window.localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const key = 'workout-forge:v3'
const stored = () => window.localStorage.getItem(key)
const saved = () => JSON.parse(stored() ?? '{}') as { history: unknown[] }
const hint = () => document.querySelector('.warmup-hint')?.textContent ?? null
const lockedBlock = (...ids: string[]) => {
  let block = createBlock(2, 4)
  for (const day of [0, 1]) for (const id of ids) block = addExerciseToDay(block, day, id)
  return { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z' }
}
/** Seeds a locked block, opens the first workout and types a weight for set 1 of the first exercise. */
function startWith(block: ReturnType<typeof lockedBlock>, weight: string) {
  window.localStorage.setItem(key, JSON.stringify({ ...emptyState(), block }))
  render(<App />)
  const start = screen.queryByRole('button', { name: /get started/i })
  if (start) fireEvent.click(start)
  fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
  fireEvent.change(screen.getAllByLabelText(/Set 1 weight$/)[0], { target: { value: weight } })
}

describe('warm-up hint in the session', () => {
  it('shows the ramp above the set table for a compound barbell lift, and follows the typed weight', () => {
    startWith(lockedBlock('barbell-squat'), '135')
    expect(hint()).toBe('Warm-up (not logged): bar × 10 · 55 × 5 · 85 × 3 · 105 × 1')
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '225' } })
    expect(hint()).toBe('Warm-up (not logged): bar × 10 · 95 × 5 · 135 × 3 · 185 × 1')
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '' } })
    expect(hint()).toBeNull()
  })

  it('skips the bar step for the deadlift', () => {
    startWith(lockedBlock('barbell-deadlift'), '225')
    expect(hint()).toBe('Warm-up (not logged): 95 × 5 · 135 × 3 · 185 × 1')
  })

  it('stays off barbell curls, dumbbell and machine compounds', () => {
    for (const id of ['barbell-curls', 'dumbbell-incline-bench-press', 'leg-press-machine']) {
      startWith(lockedBlock(id), '135')
      expect(hint()).toBeNull()
      cleanup()
      window.localStorage.clear()
    }
  })

  it('hides once any set of the exercise is checked off, and returns if it is undone', () => {
    startWith(lockedBlock('barbell-squat'), '135')
    expect(hint()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(hint()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Undo set 1' }))
    expect(hint()).not.toBeNull()
  })

  it('hides while the exercise is skipped', () => {
    startWith(lockedBlock('barbell-squat'), '135')
    fireEvent.click(screen.getByRole('button', { name: 'Skip Barbell Squat' }))
    expect(hint()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Restore Barbell Squat' }))
    expect(hint()).not.toBeNull()
  })

  it('shows in a StrongLifts 5x5 session, following that weight', () => {
    const strength = { ...applyWorkoutSet(createBlock(3, 4), findWorkoutSet('strength-5x5')!), locked: true, startedAt: '2026-09-28T09:00:00.000Z' }
    startWith(strength, '100')
    expect(hint()).toBe('Warm-up (not logged): bar × 10 · 65 × 3 · 85 × 1')
  })

  it('shows in a deload week, following the lighter prefilled weight', () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = [1, 2, 3].map((n) => ({ id: `${sessionId}-${n}`, sessionId, workoutId: 'w4-d2', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: n, weight: 200, reps: 6, rir: 0, weightUnit: 'lb' as const, completedAt: `2026-09-22T10:0${n}:00.000Z`, weekNumber: 4, repRange: { min: 6, max: 10 }, targetRir: 0, targetReps: 6 }))
    const block = { ...lockedBlock('barbell-bench-press'), completedIds: ['w1-d1', 'w1-d2', 'w2-d1', 'w2-d2', 'w3-d1', 'w3-d2', 'w4-d1', 'w4-d2'] }
    window.localStorage.setItem(key, JSON.stringify({ ...emptyState(), block, history }))
    render(<App />)
    const start = screen.queryByRole('button', { name: /get started/i })
    if (start) fireEvent.click(start)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect(screen.getByText(/week 5 · deload/i)).toBeTruthy()
    expect((screen.getByLabelText('Set 1 weight') as HTMLInputElement).value).toBe('100')
    expect(hint()).toBe('Warm-up (not logged): bar × 10 · 65 × 3 · 85 × 1')
  })

  it('GUARD: showing the hint writes nothing, and completing set 1 adds exactly one history record', () => {
    const open = () => {
      render(<App />)
      const start = screen.queryByRole('button', { name: /get started/i })
      if (start) fireEvent.click(start)
    }
    const seed = { ...emptyState(), block: lockedBlock('barbell-squat') }
    const row = { weight: '', reps: '6', rir: '3', complete: false, targetReps: 6 }
    const draft = (weight: string) => ({ workoutId: 'w1-d1', sessionId: '550e8400-e29b-41d4-a716-446655440001', sets: { 'barbell-squat': [1, 2, 3].map(() => ({ ...row, weight })) } })

    // Baseline BEFORE the hint exists: a session that has no weight yet, so no hint has rendered.
    window.localStorage.setItem(key, JSON.stringify({ ...seed, activeSession: draft('') }))
    open()
    expect(hint()).toBeNull()
    const typing = vi.spyOn(Storage.prototype, 'setItem')
    // Control: typing a weight at the bar shows no hint, so its writes are only the legitimate draft save.
    fireEvent.change(screen.getAllByLabelText(/Set 1 weight$/)[0], { target: { value: '45' } })
    expect(hint()).toBeNull()
    const controlWrites = typing.mock.calls.length
    // Typing 135 makes the hint appear: it must cost the same writes as the control.
    fireEvent.change(screen.getAllByLabelText(/Set 1 weight$/)[0], { target: { value: '135' } })
    expect(hint()).not.toBeNull()
    expect(typing.mock.calls.length).toBe(controlWrites * 2)
    expect(saved().history).toHaveLength(0)
    typing.mockRestore()
    cleanup()

    // A session that opens with the hint already due. The app saves on mount regardless, so the control is the
    // same session on a lift with no hint (barbell curls): the hint's render must add no writes of its own.
    const mountWrites = (exerciseId: string) => {
      const draftFor = { ...draft('135'), sets: { [exerciseId]: draft('135').sets['barbell-squat'] } }
      window.localStorage.setItem(key, JSON.stringify({ ...emptyState(), block: lockedBlock(exerciseId), activeSession: draftFor }))
      const spy = vi.spyOn(Storage.prototype, 'setItem')
      open()
      const count = spy.mock.calls.length
      spy.mockRestore()
      return count
    }
    const controlMount = mountWrites('barbell-curls')
    expect(hint()).toBeNull()
    cleanup()
    expect(mountWrites('barbell-squat')).toBe(controlMount)
    expect(hint()).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(saved().history).toHaveLength(1)
  })

  it('shows no hint for a working weight at or below the bar', () => {
    for (const weight of ['45', '40']) {
      startWith(lockedBlock('barbell-squat'), weight)
      expect(hint()).toBeNull()
      cleanup()
      window.localStorage.clear()
    }
  })
})
