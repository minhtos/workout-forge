import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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
    fireEvent.change(screen.getByLabelText('Set 1 RIR'), { target: { value: '0' } })
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
})