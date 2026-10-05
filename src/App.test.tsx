import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { addExerciseToDay, createBlock } from './domain/program'
import { applyWorkoutSet, findWorkoutSet } from './domain/workoutSets'
import { emptyState } from './domain/storage'

beforeEach(() => { window.localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function openPlanner(days: '2' | '3' | '4' = '2', weeks: '4' | '6' = '4') {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${days} days`, 'i') }))
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${weeks} weeks`, 'i') }))
  fireEvent.click(screen.getByRole('button', { name: /choose exercises/i }))
}
function addToDay(day: number, ...names: string[]) {
  fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[day - 1])
  for (const name of names) fireEvent.click(within(screen.getByRole('group', { name: new RegExp(`Day ${day}`) })).getByRole('button', { name: new RegExp(`^${name}`, 'i') }))
  fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
}
const planTwoDays = () => { openPlanner(); addToDay(1, 'Barbell Bench Press', 'Cable Pushdown'); addToDay(2, 'Pull-ups') }
const savedState = () => JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { history?: unknown[] }

describe('Workout Forge gym flow', () => {
  it('offers 2, 3 and 4 days and 4 or 6 weeks with a deload, and nothing else', () => {
    render(<App />)
    expect(screen.getAllByRole('button', { name: /days per week/i }).map((button) => button.getAttribute('aria-label'))).toEqual(['2 days per week', '3 days per week', '4 days per week'])
    expect(screen.getAllByRole('button', { name: /^\d+ weeks$/i }).map((button) => button.getAttribute('aria-label'))).toEqual(['4 weeks', '6 weeks'])
    fireEvent.click(screen.getByRole('button', { name: /^2 days/i }))
    expect(screen.getByText(/2 days × 4 weeks \+ deload/i)).toBeTruthy()
    expect(screen.getByText(/10 sessions/)).toBeTruthy()
  })

  it('lets the user build each day from a menu, and only starts when every day has an exercise', () => {
    openPlanner()
    const start = screen.getByRole('button', { name: /start block/i }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(screen.getByText(/add at least one exercise to day 1/i)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Day 1 name'), { target: { value: 'Upper' } })
    fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /^Chest$/ }))
    fireEvent.click(screen.getByRole('button', { name: /barbell bench press/i }))
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(start.disabled).toBe(true)
    expect(screen.getByText(/add at least one exercise to day 2/i)).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0])
    fireEvent.change(screen.getByLabelText('New exercise name'), { target: { value: 'Weighted Dips' } })
    fireEvent.change(screen.getByLabelText('New exercise muscle group'), { target: { value: 'Triceps' } })
    fireEvent.click(screen.getByRole('button', { name: /create & add/i }))
    expect(screen.getAllByText('Weighted Dips').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(start.disabled).toBe(true)
    addToDay(2, 'Pull-ups')
    expect(start.disabled).toBe(false)
  })

  it('locks the plan on start and shows only the current day', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))

    expect(screen.getByRole('heading', { name: 'Day 1' })).toBeTruthy()
    expect(screen.getByText(/week 1 of 5 · day 1 of 2/i)).toBeTruthy()
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy()
    expect(screen.queryByText('Pull-ups')).toBeNull()
    expect(screen.queryByRole('button', { name: /add exercise/i })).toBeNull()
  })

  it('saves every set as it is logged and resumes the session after a reload', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(screen.getByRole('alert').textContent).toMatch(/enter a weight/i)
    expect(savedState().history).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(savedState().history).toHaveLength(1)

    cleanup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Day 1' })).toBeTruthy()
    expect((screen.getByLabelText('Set 1 weight') as HTMLInputElement).value).toBe('135')

    fireEvent.click(screen.getByRole('button', { name: 'Undo set 1' }))
    expect(savedState().history).toHaveLength(0)
  })

  it('advances to the next day after finishing', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    fireEvent.click(screen.getByRole('button', { name: /finish workout/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(screen.getByRole('heading', { name: 'Day 2' })).toBeTruthy()
    expect(screen.getByText(/week 1 of 5 · day 2 of 2/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    expect(within(screen.getByRole('region', { name: /progress/i })).getByText(/barbell bench press: 135 lb × 6/i)).toBeTruthy()
  })

  it('builds a plan from a Workout Set by choosing one exercise per muscle slot', () => {
    openPlanner('3', '4')
    expect(screen.getAllByText(/Recommended for \d-day program/i)).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Use Push | Pull | Legs' }))
    const start = screen.getByRole('button', { name: /start block/i }) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(screen.getByText(/choose an exercise for every slot on push/i)).toBeTruthy()

    const days = [['Barbell Bench Press', 'Barbell Incline Bench Press', 'Dumbbell Incline Bench Press', 'Machine Incline Press', 'Cable Pushdown', 'Cable Pulldown'], ['Pull-ups', 'Pull-down', 'Row Machine', 'Barbell Row', 'Cable Curls', 'Barbell Curls'], ['Barbell Squat', 'Hack Squat', 'Leg Press Machine', 'Dumbbell RDL', 'Seated Leg Curl', 'Lying Leg Curl']]
    const idFor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    days.forEach((names, day) => names.forEach((name, slot) => fireEvent.change(screen.getByLabelText(`Day ${day + 1} exercise ${slot + 1} choice`), { target: { value: idFor(name) } })))
    expect(start.disabled).toBe(false)
    fireEvent.click(start)
    expect(screen.getByText(/week 1 of 5 · day 1 of 3/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Push' })).toBeTruthy()
  })

  it('starts the 5x5 set ready to go and alternates workouts', () => {
    openPlanner('3', '4')
    fireEvent.click(screen.getByRole('button', { name: 'Use StrongLifts 5x5' }))
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    expect(screen.getByRole('heading', { name: 'Workout A' })).toBeTruthy()
    expect(screen.getAllByText(/5 sets × 5 reps/).length).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect(screen.queryByText(/RIR TARGET/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    fireEvent.click(screen.getByRole('button', { name: /finish workout/i }))
    expect(screen.getByRole('heading', { name: 'Workout B' })).toBeTruthy()
  })

  it('fills the weight for the remaining sets when you enter set 1', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '185' } })
    expect((screen.getByLabelText('Set 2 weight') as HTMLInputElement).value).toBe('185')
    expect((screen.getByLabelText('Set 3 weight') as HTMLInputElement).value).toBe('185')
    fireEvent.change(screen.getByLabelText('Set 2 weight'), { target: { value: '175' } })
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '190' } })
    expect((screen.getByLabelText('Set 2 weight') as HTMLInputElement).value).toBe('175')
    expect((screen.getByLabelText('Set 3 weight') as HTMLInputElement).value).toBe('190')
  })

  it('lets you add and remove sets during a workout, keeping saved sets safe', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    const addBench = () => fireEvent.click(screen.getByRole('button', { name: 'Add set to Barbell Bench Press' }))
    const removeBench = screen.getByRole('button', { name: 'Remove last set from Barbell Bench Press' }) as HTMLButtonElement

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    addBench()
    expect((screen.getByLabelText('Set 4 weight') as HTMLInputElement).value).toBe('135')
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 4' }))
    expect(removeBench.disabled).toBe(true)
    expect(savedState().history).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Undo set 4' }))
    expect(removeBench.disabled).toBe(false)
    fireEvent.click(removeBench)
    expect(screen.queryByLabelText('Set 4 weight')).toBeNull()
    expect(savedState().history).toHaveLength(0)
  })

  it('shows the rest timer only when it is switched on in Settings, and remembers the choice', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    const logSet = (setNumber: number) => {
      fireEvent.change(screen.getByLabelText(`Set ${setNumber} weight`), { target: { value: '135' } })
      fireEvent.click(screen.getByRole('button', { name: `Complete set ${setNumber}` }))
    }

    logSet(1)
    expect(screen.queryByRole('timer')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const toggle = screen.getByRole('switch', { name: /rest timer/i })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Workout' }))
    logSet(2)
    expect(screen.getByRole('timer', { name: /rest timer/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /dismiss rest timer/i }))
    expect(screen.queryByRole('timer')).toBeNull()

    cleanup()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('switch', { name: /rest timer/i }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: /rest timer/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Workout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 3' }))
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('keeps exercises you turn off in the library out of the planner menus', () => {
    openPlanner()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /open library/i }))
    expect(screen.getByRole('heading', { name: 'Exercise library' })).toBeTruthy()
    for (const group of ['Forearms', 'Core', 'Glutes', 'Calves']) expect(screen.getByRole('region', { name: `${group} exercises` })).toBeTruthy()
    expect(screen.getByText('Leg Extension')).toBeTruthy()
    expect(screen.queryByText('Quad Extension')).toBeNull()

    const bench = screen.getByRole('switch', { name: 'Use Barbell Bench Press' })
    expect(bench.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(bench)
    expect(bench.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Turn all Calves exercises off' }))

    fireEvent.click(screen.getByRole('button', { name: 'Workout Forge home' }))
    fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0])
    const picker = within(screen.getByRole('group', { name: /Day 1/ }))
    expect(picker.queryByRole('button', { name: /^Barbell Bench Press/ })).toBeNull()
    expect(picker.getByRole('button', { name: /^Barbell Incline Bench Press/ })).toBeTruthy()
    fireEvent.click(picker.getByRole('button', { name: 'Calves' }))
    expect(screen.getByText(/nothing is turned on here/i)).toBeTruthy()
  })

  it('adds, edits and deletes your own exercise in the library', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /open library/i }))
    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Weighted Dips' } })
    fireEvent.change(screen.getByLabelText('Muscle group'), { target: { value: 'Triceps' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(within(screen.getByRole('region', { name: 'Triceps exercises' })).getByText('Weighted Dips')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'pull-ups' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('alert').textContent).toMatch(/already in the library/i)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Weighted Dips' }))
    fireEvent.change(screen.getByLabelText('Rename Weighted Dips'), { target: { value: 'Ring Dips' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Ring Dips')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Ring Dips' }))
    expect(screen.queryByText('Ring Dips')).toBeNull()
  })

  it('stops at 12 exercises in a muscle group, in the library and in the planner', () => {
    openPlanner()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /open library/i }))
    for (let n = 1; n <= 7; n += 1) {
      fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: `Triceps move ${n}` } })
      fireEvent.change(screen.getByLabelText('Muscle group'), { target: { value: 'Triceps' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    }
    const triceps = within(screen.getByRole('region', { name: 'Triceps exercises' }))
    expect(triceps.getByText('Triceps move 7')).toBeTruthy()
    expect(triceps.getByText(/12\/12 · full/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'One more' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('alert').textContent).toMatch(/already has 12 exercises/i)
    expect(screen.queryByText('One more')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Workout Forge home' }))
    fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0])
    fireEvent.change(screen.getByLabelText('New exercise name'), { target: { value: 'Overflow' } })
    fireEvent.change(screen.getByLabelText('New exercise muscle group'), { target: { value: 'Triceps' } })
    fireEvent.click(screen.getByRole('button', { name: /create & add/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/already has 12 exercises/i)
  })

  it('asks recovery, then effort and pump, and the next session follows the answers', () => {
    let block = createBlock(2, 4)
    for (const day of [0, 1]) for (const id of ['barbell-bench-press', 'barbell-incline-bench-press']) block = addExerciseToDay(block, day, id)
    block = { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z', completedIds: ['w1-d1'] }
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = ['barbell-bench-press', 'barbell-incline-bench-press'].flatMap((id) => [1, 2, 3].map((n) => ({ id: `${sessionId}-${id}-${n}`, sessionId, workoutId: 'w1-d1', exerciseId: id, exerciseName: id, setIndex: n, weight: 100, reps: 8, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-09-28T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3 })))
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block, history }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    for (const n of [1, 2, 3]) fireEvent.click(screen.getByRole('button', { name: `Complete set ${n}` }))

    expect(screen.getByRole('dialog', { name: /chest recovery/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /still sore/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Barbell Incline Bench Press Set 2 weight')).toBeTruthy()
    expect(screen.queryByLabelText('Barbell Incline Bench Press Set 3 weight')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Complete Barbell Incline Bench Press set 1' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Complete Barbell Incline Bench Press set 2' }))
    expect(screen.getByRole('dialog', { name: /chest work/i })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /easy/i }))
    fireEvent.click(screen.getByRole('button', { name: /^low/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    const saved = JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { feedback: Record<string, unknown>[] }
    expect(saved.feedback).toHaveLength(1)
    expect(saved.feedback[0]).toMatchObject({ group: 'Chest', soreness: 'sore', effort: 'easy', pump: 'low', summaryDone: true, blockId: '2026-09-28T09:00:00.000Z' })

    fireEvent.click(screen.getByRole('button', { name: /finish workout/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(/week 2 of 5 · day 1 of 2/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect((screen.getByLabelText('Set 1 weight') as HTMLInputElement).value).toBe('105')
    expect(screen.getAllByText(/last time was easy: \+5 lb\. low pump: \+1 rep/i)).toHaveLength(2)
    expect((screen.getByLabelText('Set 1 reps') as HTMLSelectElement).value).toBe('10')
    expect(screen.getByLabelText('Set 2 weight')).toBeTruthy()
    expect(screen.queryByLabelText('Set 3 weight')).toBeNull()
  })

  it('asks the effort and pump question on finish for a muscle group you only started, and lets you skip', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /finish workout/i }))
    expect(screen.getByRole('dialog', { name: /chest work/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByRole('heading', { name: 'Day 2' })).toBeTruthy()
    const saved = JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { feedback: Record<string, unknown>[] }
    expect(saved.feedback[0]).toMatchObject({ group: 'Chest', summaryDone: true })
    expect(saved.feedback[0].effort).toBeUndefined()
  })

  it('has no per-set RIR box, and remembers the rep target so a short set can be recognised later', () => {
    let block = createBlock(2, 4)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
    block = { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z', completedIds: ['w1-d1'] }
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = [1, 2, 3].map((n) => ({ id: `${sessionId}-barbell-bench-press-${n}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: n, weight: 100, reps: 8, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-09-28T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3 }))
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block, history }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect(screen.queryByLabelText('Set 1 RIR')).toBeNull()
    expect((screen.getByLabelText('Set 1 reps') as HTMLSelectElement).value).toBe('9')

    fireEvent.change(screen.getByLabelText('Set 1 reps'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    const saved = JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { history: { setIndex: number; reps: number; targetReps?: number; rir: number }[] }
    const set = saved.history.find((entry) => entry.setIndex === 1 && entry.reps === 7)
    expect(set).toMatchObject({ reps: 7, targetReps: 9, rir: 3 })
  })

  it('starts a new block from the last block\'s 0 RIR week, ignoring the deload, and carries sets over', () => {
    const OLD = '2026-09-01T09:00:00.000Z'
    let block = createBlock(2, 4)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
    const row = (sessionId: string, setIndex: number, weight: number, reps: number, completedAt: string, extra: Record<string, unknown>) => ({ id: `${sessionId}-${setIndex}`, sessionId, workoutId: 'w4-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex, weight, reps, rir: 0, weightUnit: 'lb' as const, completedAt, weekNumber: 4, repRange: { min: 6, max: 10 }, targetRir: 0, ...extra })
    const history = [
      row('fail', 1, 200, 6, '2026-09-22T10:00:00.000Z', {}), row('fail', 2, 195, 6, '2026-09-22T10:05:00.000Z', {}), row('fail', 3, 190, 5, '2026-09-22T10:10:00.000Z', {}),
      ...[1, 2, 3].map((n) => row('deload', n, 100, 6, `2026-09-29T10:0${n}:00.000Z`, { weekNumber: 5, targetRir: 3, deload: true })),
    ]
    const feedback = [
      { sessionId: 'a', blockId: OLD, group: 'Chest', soreness: 'early', at: '2026-09-02T10:00:00.000Z' },
      { sessionId: 'b', blockId: OLD, group: 'Chest', soreness: 'early', at: '2026-09-09T10:00:00.000Z' },
      { sessionId: 'fail', blockId: OLD, group: 'Chest', effort: 'right', pump: 'high', summaryDone: true, at: '2026-09-22T10:30:00.000Z' },
    ]
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block, history, feedback }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    expect(screen.getByRole('note').textContent).toMatch(/1 exercise starts from your last 0 RIR numbers/i)
    const stored = JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { block: { startOffsets: Record<string, number> } }
    expect(stored.block.startOffsets).toEqual({ Chest: 1 })

    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect((screen.getByLabelText('Set 1 weight') as HTMLInputElement).value).toBe('185')
    expect((screen.getByLabelText('Set 1 reps') as HTMLSelectElement).value).toBe('6')
    expect(screen.getByLabelText('Set 4 weight')).toBeTruthy()
    expect(screen.queryByLabelText('Set 5 weight')).toBeNull()
    expect(screen.getByText(/based on 200 lb × 6 at 0 RIR last block/i)).toBeTruthy()
  })

  it('marks sets done in a deload week so they are never used as a starting point', () => {
    let block = createBlock(2, 4)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = [1, 2, 3].map((n) => ({ id: `${sessionId}-${n}`, sessionId, workoutId: 'w4-d2', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: n, weight: 200, reps: 6, rir: 0, weightUnit: 'lb' as const, completedAt: `2026-09-22T10:0${n}:00.000Z`, weekNumber: 4, repRange: { min: 6, max: 10 }, targetRir: 0, targetReps: 6 }))
    const completedIds = ['w1-d1', 'w1-d2', 'w2-d1', 'w2-d2', 'w3-d1', 'w3-d2', 'w4-d1', 'w4-d2']
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: { ...block, locked: true, startedAt: '2026-09-01T09:00:00.000Z', completedIds }, history }))

    render(<App />)
    expect(screen.getByText(/week 5 of 5 · deload/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByLabelText('Set 1 weight') as HTMLInputElement).value).toBe('100')
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    const saved = JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { history: { weekNumber: number; deload?: boolean }[] }
    expect(saved.history.find((entry) => entry.weekNumber === 5)).toMatchObject({ deload: true })
  })

  it('rescales reps when you change the weight, to keep the week\'s target RIR', () => {
    let block = createBlock(2, 4)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
    block = { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z', completedIds: ['w1-d1'] }
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = [1, 2, 3].map((n) => ({ id: `${sessionId}-${n}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: n, weight: 200, reps: 6, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-09-28T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3, targetReps: 6 }))
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block, history }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    const reps = (n: number) => (screen.getByLabelText(`Set ${n} reps`) as HTMLSelectElement).value
    expect(screen.queryByRole('status')).toBeNull()
    expect([reps(1), reps(2), reps(3)]).toEqual(['7', '7', '7'])

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '190' } })
    expect([reps(1), reps(2), reps(3)]).toEqual(['7', '7', '7'])
    expect(screen.getByRole('status').textContent).toMatch(/At 190 lb, about 7 reps leaves 3 in reserve/)

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '170' } })
    expect([reps(1), reps(2), reps(3)]).toEqual(['10', '10', '10'])

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '100' } })
    expect(reps(1)).toBe('12')
    expect(screen.getByRole('status').textContent).toMatch(/light for this week's target.*capped at 12/i)

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '320' } })
    expect(reps(1)).toBe('1')
    expect(screen.getByRole('status').textContent).toMatch(/very heavy/i)
  })

  it('changes only the set you edit once earlier sets are finished, and never touches a finished set', () => {
    let block = createBlock(2, 4)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'barbell-bench-press')
    block = { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z', completedIds: ['w1-d1'] }
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = [1, 2, 3].map((n) => ({ id: `${sessionId}-${n}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex: n, weight: 200, reps: 6, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-09-28T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 6, max: 10 }, targetRir: 3, targetReps: 6 }))
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block, history }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    fireEvent.change(screen.getByLabelText('Set 2 weight'), { target: { value: '170' } })
    const reps = (n: number) => (screen.getByLabelText(`Set ${n} reps`) as HTMLSelectElement).value
    expect([reps(1), reps(2), reps(3)]).toEqual(['7', '10', '7'])
    const saved = JSON.parse(window.localStorage.getItem('workout-forge:v3') ?? '{}') as { history: { setIndex: number; weight: number; reps: number; targetReps?: number }[] }
    expect(saved.history.find((entry) => entry.setIndex === 1 && entry.weight === 200 && entry.reps === 7)).toMatchObject({ targetReps: 7 })
  })

  it('leaves reps alone when there is no history, and in 5x5 and deload weeks', () => {
    planTwoDays()
    fireEvent.click(screen.getByRole('button', { name: /start block/i }))
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '135' } })
    expect((screen.getByLabelText('Set 1 reps') as HTMLSelectElement).value).toBe('6')
    expect(screen.queryByRole('status')).toBeNull()
    cleanup()
    window.localStorage.clear()

    const strength = { ...applyWorkoutSet(createBlock(3, 4), findWorkoutSet('strength-5x5')!), locked: true, startedAt: '2026-09-28T09:00:00.000Z' }
    const squats = [1, 2, 3, 4, 5].map((n) => ({ id: `sq-${n}`, sessionId: 'sq', workoutId: 'w1-d1', exerciseId: 'barbell-squat', exerciseName: 'Barbell Squat', setIndex: n, weight: 135, reps: 5, rir: 2, weightUnit: 'lb' as const, completedAt: `2026-09-28T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 5, max: 5 }, targetRir: 2, targetReps: 5 }))
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: { ...strength, completedIds: [] }, history: squats }))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '100' } })
    expect((screen.getByLabelText('Set 1 reps') as HTMLSelectElement).value).toBe('5')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('caps reps at 15 on a machine exercise, where a barbell lift stops at 12', () => {
    let block = createBlock(2, 4)
    for (const day of [0, 1]) block = addExerciseToDay(block, day, 'machine-chest-press')
    block = { ...block, locked: true, startedAt: '2026-09-28T09:00:00.000Z', completedIds: ['w1-d1'] }
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const history = [1, 2, 3].map((n) => ({ id: `${sessionId}-${n}`, sessionId, workoutId: 'w1-d1', exerciseId: 'machine-chest-press', exerciseName: 'Machine Chest Press', setIndex: n, weight: 150, reps: 8, rir: 3, weightUnit: 'lb' as const, completedAt: `2026-09-28T10:0${n}:00.000Z`, weekNumber: 1, repRange: { min: 8, max: 15 }, targetRir: 3, targetReps: 8 }))
    window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block, history }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start workout/i }))
    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '90' } })
    expect((screen.getByLabelText('Set 1 reps') as HTMLSelectElement).value).toBe('15')
    expect(screen.getByRole('status').textContent).toMatch(/capped at 15/i)
  })

  it('shows each exercise\'s rep max in the library, and lets you mark your own as a large compound lift', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /open library/i }))
    const maxOf = (name: string) => screen.getByText(name).closest('.library-name')?.textContent ?? ''
    expect(maxOf('Barbell Row')).toMatch(/max 12/)
    expect(maxOf('Row Machine')).toMatch(/max 15/)
    expect(maxOf('Barbell Squat')).toMatch(/max 12/)
    expect(maxOf('Hack Squat')).toMatch(/max 12/)
    expect(maxOf('Leg Press Machine')).toMatch(/max 12/)
    expect(maxOf('Assisted Pull-ups')).toMatch(/max 12/)
    expect(maxOf('Machine Hip Thrust')).toMatch(/max 12/)
    expect(maxOf('Pull-down')).toMatch(/max 15/)
    expect(maxOf('Leg Extension')).toMatch(/max 15/)

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Pendlay Row' } })
    fireEvent.change(screen.getByLabelText('Muscle group'), { target: { value: 'Back' } })
    fireEvent.click(screen.getByLabelText(/Large compound lift/))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(maxOf('Pendlay Row')).toMatch(/max 12/)

    fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Cable Row 2' } })
    fireEvent.change(screen.getByLabelText('Muscle group'), { target: { value: 'Back' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(maxOf('Cable Row 2')).toMatch(/max 15/)

    fireEvent.click(screen.getByRole('button', { name: 'Edit Cable Row 2' }))
    fireEvent.click(screen.getByLabelText('Cable Row 2 is a large compound lift'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(maxOf('Cable Row 2')).toMatch(/max 12/)
  })

  describe('progress charts', () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
    const row = (sessionId: string, setIndex: number, weight: number, reps: number, days: number, extra: Record<string, unknown> = {}) => ({ id: `${sessionId}-${setIndex}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex, weight, reps, rir: 0, weightUnit: 'lb' as const, completedAt: daysAgo(days), weekNumber: 1, repRange: { min: 6, max: 12 }, targetRir: 0, targetReps: reps, ...extra })
    const seed = () => {
      const history = [
        row('b0', 1, 190, 6, 100), row('b1', 1, 200, 6, 16), row('b2', 1, 205, 6, 9), row('b3', 1, 210, 6, 2), row('b3', 2, 205, 6, 2),
        row('d1', 1, 100, 6, 1, { deload: true, weekNumber: 5, targetRir: 3 }),
        row('p1', 1, 0, 8, 5, { exerciseId: 'pull-ups', exerciseName: 'Pull-ups' }),
      ]
      window.localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), history }))
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
    }

    it('shows an estimated-max line for the most-trained exercise, leaving deload sessions out', () => {
      seed()
      expect(screen.getByRole('heading', { name: 'Estimated max: Barbell Bench Press' })).toBeTruthy()
      const chart = screen.getByRole('group', { name: /Estimated max for Barbell Bench Press: 3 sessions/ })
      expect(chart.getAttribute('aria-label')).toMatch(/lb on .* to \d+ lb on /)
      const table = within(screen.getByRole('region', { name: /Estimated max/ }))
      expect(table.getAllByRole('row')).toHaveLength(4)
      expect(table.queryByText('100 × 6')).toBeNull()
    })

    it('shows the same details on keyboard focus as on hover', () => {
      seed()
      const chart = screen.getByRole('group', { name: /Estimated max for Barbell Bench Press/ })
      fireEvent.keyDown(chart, { key: 'ArrowRight' })
      expect(screen.getByRole('status').textContent).toMatch(/estimated max/)
      expect(screen.getByRole('status').textContent).toMatch(/Top set 210 × 6/)
      fireEvent.keyDown(chart, { key: 'ArrowLeft' })
      expect(screen.getByRole('status').textContent).toMatch(/Top set 205 × 6/)
      fireEvent.keyDown(chart, { key: 'Escape' })
      expect(screen.queryByRole('status')).toBeNull()
    })

    it('shows sets per week as columns with a table twin, and a tooltip per week from the keyboard', () => {
      seed()
      const chart = screen.getByRole('group', { name: /Sets per week for all muscle groups: 6 sets over the last 12 weeks/ })
      const rows = within(screen.getByRole('region', { name: /Sets per week/ })).getAllByRole('row')
      expect(rows).toHaveLength(13)
      fireEvent.keyDown(chart, { key: 'End' })
      expect(screen.getByRole('status').textContent).toMatch(/Week of/)
      expect(screen.getByRole('status').textContent).toMatch(/sets?/)
      expect(screen.getByRole('status').textContent).toMatch(/Volume/)
    })

    it('scopes the charts with the time range, muscle group and exercise filters', () => {
      seed()
      const sessions = () => screen.getByRole('group', { name: /Estimated max for Barbell Bench Press/ }).getAttribute('aria-label')
      expect(sessions()).toMatch(/3 sessions/)
      fireEvent.click(screen.getByRole('button', { name: '26 weeks' }))
      expect(sessions()).toMatch(/4 sessions/)
      fireEvent.click(screen.getByRole('button', { name: '4 weeks' }))
      expect(sessions()).toMatch(/3 sessions/)

      fireEvent.change(screen.getByLabelText('Muscle group'), { target: { value: 'Back' } })
      expect(screen.getByRole('heading', { name: 'Sets per week: Back' })).toBeTruthy()
      expect((screen.getByLabelText('Exercise') as HTMLSelectElement).value).toBe('pull-ups')
      expect(screen.getByText(/Log Pull-ups again to see a trend. One session so far: 8 reps/)).toBeTruthy()

      fireEvent.change(screen.getByLabelText('Muscle group'), { target: { value: 'all' } })
      fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: 'pull-ups' } })
      expect(screen.getByRole('heading', { name: 'Best set: Pull-ups' })).toBeTruthy()
    })

    it('says so when nothing is in range, and draws nothing before the first workout', () => {
      cleanup()
      window.localStorage.clear()
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Progress' }))
      expect(screen.queryByLabelText('Time range')).toBeNull()
      expect(screen.getByText(/Your first completed set starts the record/)).toBeTruthy()
    })
  })
})