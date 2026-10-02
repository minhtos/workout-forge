import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Workout Forge onboarding', () => {
  it('creates the selected 3-day, 4-week program and opens the schedule', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /3 days/i }))
    fireEvent.click(screen.getByRole('button', { name: /4 weeks/i }))
    fireEvent.click(screen.getByRole('button', { name: /build my plan/i }))

    expect(screen.getByRole('heading', { name: /your training block/i })).toBeTruthy()
    expect(screen.getByText(/12 planned sessions/i)).toBeTruthy()
    expect(screen.getAllByText('Full Body A')).not.toHaveLength(0)
  })
})
