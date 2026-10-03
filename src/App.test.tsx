import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Workout Forge training flow', () => {
  it('builds a Push / Pull / Legs plan and saves per-set RIR history', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /3 days/i }))
    fireEvent.click(screen.getByRole('button', { name: /5 weeks/i }))
    fireEvent.click(screen.getByRole('button', { name: /build my plan/i }))

    expect(screen.getByRole('heading', { name: /your training block/i })).toBeTruthy()
    expect(screen.getByText(/15 planned sessions/i)).toBeTruthy()
    expect(screen.getAllByText('Push')).not.toHaveLength(0)

    fireEvent.click(screen.getAllByRole('button', { name: /start/i })[0])
    fireEvent.change(screen.getByLabelText('Set 1 RIR'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }))
    fireEvent.click(screen.getByRole('button', { name: /finish workout/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Progress' }))

    expect(screen.getByText(/latest completed set/i)).toBeTruthy()
    expect(screen.getAllByText(/RIR 7/i)).not.toHaveLength(0)
  })
})
