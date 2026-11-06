import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LibraryView } from './LibraryView'
import { FormCues } from './FormCues'
import { exerciseGuide } from '../domain/exerciseGuide'
import { baseExercises, type ExerciseCatalogItem } from '../domain/program'

afterEach(cleanup)

describe('FormCues', () => {
  it('starts collapsed and opens to the cue list', () => {
    render(<FormCues id="barbell-squat" name="Barbell Squat" />)
    const toggle = screen.getByRole('button', { name: 'Barbell Squat form cues' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const [first] = exerciseGuide['barbell-squat'].cues
    const item = screen.getByText(first)
    expect(item.parentElement!.hidden).toBe(true)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(item.parentElement!.hidden).toBe(false)
  })

  it('renders nothing for a custom exercise', () => {
    const { container } = render(<FormCues id="my-custom-lift" name="My Lift" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('LibraryView cues', () => {
  const customItem: ExerciseCatalogItem = { id: 'my-custom-lift', name: 'My Custom Lift', category: 'Chest' }
  const renderLibrary = () => render(<LibraryView catalog={[...baseExercises, customItem]} custom={[customItem]} hidden={[]} inUse={() => false} onToggle={() => {}} onToggleGroup={() => {}} onAdd={() => null} onUpdate={() => null} onDelete={() => null} onBack={() => {}} />)

  it('gives each built-in an equipment chip and a toggle, and a custom exercise neither', () => {
    renderLibrary()
    expect(screen.getAllByRole('button', { name: /form cues$/ })).toHaveLength(baseExercises.length)
    expect(screen.queryByRole('button', { name: 'My Custom Lift form cues' })).toBeNull()
    const customRow = screen.getByText('My Custom Lift').closest('.library-row')!
    expect(customRow.querySelectorAll('.badge')).toHaveLength(1)
    expect(customRow.textContent).toContain('Yours')
    const benchRow = screen.getByText('Barbell Bench Press').closest('.library-row')!
    expect(benchRow.textContent).toContain('Barbell')
  })
})
