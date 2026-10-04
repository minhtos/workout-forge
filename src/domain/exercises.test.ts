import { describe, expect, it } from 'vitest'
import { addExerciseToDay, baseExercises, createBlock, muscleGroups, mergeCatalog } from './program'
import { addCustomExercise, deleteCustomExercise, enabledCatalog, exerciseInUse, isEnabled, setExerciseEnabled, setGroupEnabled, updateCustomExercise } from './exercises'

describe('muscle groups and base exercises', () => {
  it('includes forearms, core, glutes and calves with five exercises each', () => {
    for (const group of ['Forearms', 'Core', 'Glutes', 'Calves'] as const) {
      expect(muscleGroups).toContain(group)
      expect(baseExercises.filter((item) => item.category === group)).toHaveLength(5)
    }
  })

  it('renames Quad Extension to Leg Extension without breaking saved ids', () => {
    expect(baseExercises.find((item) => item.id === 'quad-extension')?.name).toBe('Leg Extension')
    expect(baseExercises.some((item) => item.name === 'Quad Extension')).toBe(false)
  })

  it('has unique ids and names across the whole catalog', () => {
    expect(new Set(baseExercises.map((item) => item.id)).size).toBe(baseExercises.length)
    expect(new Set(baseExercises.map((item) => item.name.toLowerCase())).size).toBe(baseExercises.length)
  })
})

describe('turning exercises on and off', () => {
  const catalog = mergeCatalog([])

  it('everything starts on, and toggling is reversible', () => {
    expect(isEnabled([], 'pull-ups')).toBe(true)
    const off = setExerciseEnabled([], 'pull-ups', false)
    expect(isEnabled(off, 'pull-ups')).toBe(false)
    expect(setExerciseEnabled(off, 'pull-ups', true)).toEqual([])
    expect(setExerciseEnabled(off, 'pull-ups', false)).toEqual(['pull-ups'])
  })

  it('turns a whole muscle group on or off without touching others', () => {
    const calves = catalog.filter((item) => item.category === 'Calves').map((item) => item.id)
    let hidden = setExerciseEnabled([], 'pull-ups', false)
    hidden = setGroupEnabled(hidden, catalog, 'Calves', false)
    expect(calves.every((id) => hidden.includes(id))).toBe(true)
    expect(hidden).toContain('pull-ups')
    hidden = setGroupEnabled(hidden, catalog, 'Calves', true)
    expect(hidden).toEqual(['pull-ups'])
  })

  it('leaves off exercises out of menus, but keeps one that is already chosen', () => {
    const hidden = ['pull-ups', 'cable-curls']
    const menu = enabledCatalog(catalog, hidden)
    expect(menu.some((item) => item.id === 'pull-ups')).toBe(false)
    expect(menu.some((item) => item.id === 'pull-down')).toBe(true)
    expect(enabledCatalog(catalog, hidden, ['pull-ups']).some((item) => item.id === 'pull-ups')).toBe(true)
  })
})

describe('your own exercises', () => {
  it('adds one, rejecting blanks and duplicates (case-insensitive, including built-ins)', () => {
    const added = addCustomExercise([], '  Weighted Dips ', 'Triceps')
    expect(added).toMatchObject({ id: 'custom-weighted-dips', custom: [{ name: 'Weighted Dips', category: 'Triceps' }] })
    expect(addCustomExercise([], '   ', 'Core')).toEqual({ error: 'Give the exercise a name.' })
    expect(addCustomExercise([], 'pull-ups', 'Back')).toHaveProperty('error')
    expect(addCustomExercise([{ id: 'custom-dips', name: 'Dips', category: 'Chest' }], 'DIPS', 'Chest')).toHaveProperty('error')
  })

  it('gives a unique id when names slug to the same thing', () => {
    const first = addCustomExercise([], 'Hip Hinge!', 'Glutes')
    if ('error' in first) throw new Error(first.error)
    const second = addCustomExercise(first.custom, 'Hip Hinge?', 'Glutes')
    expect('error' in second ? second.error : second.id).toBe('custom-hip-hinge-2')
  })

  it('renames or regroups only your own exercises', () => {
    const custom = [{ id: 'custom-dips', name: 'Dips', category: 'Chest' as const }]
    expect(updateCustomExercise(custom, 'custom-dips', 'Weighted Dips', 'Triceps')).toMatchObject({ custom: [{ name: 'Weighted Dips', category: 'Triceps' }] })
    expect(updateCustomExercise(custom, 'pull-ups', 'Pull Ups', 'Back')).toHaveProperty('error')
    expect(updateCustomExercise(custom, 'custom-dips', 'Pull-ups', 'Back')).toHaveProperty('error')
  })

  it('will not delete an exercise that the current program uses', () => {
    const custom = [{ id: 'custom-dips', name: 'Dips', category: 'Chest' as const }]
    const block = addExerciseToDay(createBlock(2, 4), 0, 'custom-dips')
    expect(exerciseInUse(block, 'custom-dips')).toBe(true)
    expect(deleteCustomExercise(custom, block, 'custom-dips')).toHaveProperty('error')
    expect(deleteCustomExercise(custom, createBlock(2, 4), 'custom-dips')).toEqual({ custom: [], id: 'custom-dips' })
    expect(deleteCustomExercise(custom, null, 'pull-ups')).toHaveProperty('error')
  })
})
