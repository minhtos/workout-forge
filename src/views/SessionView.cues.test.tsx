import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionView } from './SessionView'
import type { ScheduledWorkout } from '../domain/program'
import type { ActiveSession } from '../domain/storage'

afterEach(cleanup)

const workout: ScheduledWorkout = {
  id: 'w1', weekNumber: 1, dayIndex: 0, templateIndex: 0, title: 'Day A', progression: 'rir', target: { kind: 'work', targetRir: 2 },
  exercises: [
    { id: 'barbell-squat', name: 'Barbell Squat', category: 'Quads', sets: 2, repRange: { min: 5, max: 8 } },
    { id: 'my-custom-lift', name: 'My Custom Lift', category: 'Chest', sets: 2, repRange: { min: 8, max: 12 } },
  ],
}
const row = { reps: '8', weight: '', rir: '2', complete: false }
const session: ActiveSession = { workoutId: 'w1', sessionId: 's1', sets: { 'barbell-squat': [row, row], 'my-custom-lift': [row, row] } }

function renderSession() {
  const handlers = { onDismissPr: vi.fn(), onBack: vi.fn(), onUpdate: vi.fn(), onToggle: vi.fn(() => true), onAddSet: vi.fn(), onRemoveSet: vi.fn(), onSkip: vi.fn(), onRestore: vi.fn(), onFinish: vi.fn(), onDiscard: vi.fn() }
  render(<SessionView workout={workout} session={session} history={[]} syncLabel="" restTimer={false} tune={{ feedback: [], blockId: null }} repNotices={{}} error="" dismissedPrs={{}} skippedLast={() => false} {...handlers} />)
  return handlers
}

describe('SessionView form cues', () => {
  it('shows a collapsed Form cues toggle on a built-in card and none on a custom one', () => {
    renderSession()
    const toggles = screen.getAllByRole('button', { name: /form cues$/ })
    expect(toggles).toHaveLength(1)
    expect(toggles[0].getAttribute('aria-label')).toBe('Barbell Squat form cues')
    expect(toggles[0].textContent).toBe('Form cues')
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'My Custom Lift form cues' })).toBeNull()
    const customCard = screen.getByText('My Custom Lift').closest('.exercise-card')!
    expect(customCard.querySelector('.cues-toggle')).toBeNull()
  })

  it('expanding and collapsing writes nothing to the session', () => {
    const handlers = renderSession()
    const before = JSON.stringify(session)
    const toggle = screen.getByRole('button', { name: 'Barbell Squat form cues' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled()
    expect(JSON.stringify(session)).toBe(before)
  })
})
