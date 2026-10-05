import { describe, expect, it } from 'vitest'
import { addExerciseToDay, baseExercises, createBlock, muscleGroups, mergeCatalog, type ExerciseCatalogItem } from './program'
import { addCustomExercise, deleteCustomExercise, enabledCatalog, exerciseInUse, groupCount, isEnabled, maxExercisesPerGroup, mergeCustomExercises, setExerciseEnabled, setGroupEnabled, updateCustomExercise } from './exercises'

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

describe('the 12 exercise limit per muscle group', () => {
  const fill = (group: 'Calves' | 'Chest') => {
    let custom: ExerciseCatalogItem[] = []
    for (let n = 1; groupCount(custom, group) < maxExercisesPerGroup; n += 1) {
      const result = addCustomExercise(custom, `${group} move ${n}`, group)
      if ('error' in result) throw new Error(result.error)
      custom = result.custom
    }
    return custom
  }

  it('is 12 and counts built-in and your own exercises together', () => {
    expect(maxExercisesPerGroup).toBe(12)
    expect(groupCount([], 'Chest')).toBe(7)
    expect(groupCount(fill('Chest'), 'Chest')).toBe(12)
  })

  it('refuses a 13th exercise in a group', () => {
    const full = fill('Calves')
    expect(groupCount(full, 'Calves')).toBe(12)
    const result = addCustomExercise(full, 'One too many', 'Calves')
    expect('error' in result && result.error).toMatch(/already has 12 exercises/)
    expect(addCustomExercise(full, 'Fits elsewhere', 'Core')).toHaveProperty('id')
  })

  it('refuses to move an exercise into a full group, but allows editing one already in it', () => {
    const full = fill('Calves')
    const mine = [...full, { id: 'custom-dips', name: 'Dips', category: 'Chest' as const }]
    expect(updateCustomExercise(mine, 'custom-dips', 'Dips', 'Calves')).toHaveProperty('error')
    const inGroup = full[0]
    expect(updateCustomExercise(full, inGroup.id, 'Renamed Calf Move', 'Calves')).toHaveProperty('id')
  })

  it('stops an import from overfilling a group or duplicating exercises', () => {
    const full = fill('Calves')
    const incoming: ExerciseCatalogItem[] = [{ id: 'custom-extra-calf', name: 'Extra Calf', category: 'Calves' }, { id: 'custom-dips', name: 'Dips', category: 'Chest' }, { id: 'custom-other-dips', name: 'dips', category: 'Chest' }]
    const merged = mergeCustomExercises(full, incoming)
    expect(groupCount(merged, 'Calves')).toBe(12)
    expect(merged.filter((item) => item.category === 'Chest')).toHaveLength(1)
  })
})

describe('marking your own exercise as a large compound lift', () => {
  it('stores the flag only when it is on, and lets you change it', () => {
    const added = addCustomExercise([], 'Pendlay Row', 'Back', true)
    expect(added).toMatchObject({ custom: [{ name: 'Pendlay Row', category: 'Back', compound: true }] })
    expect(addCustomExercise([], 'Cable Fly 2', 'Chest')).toMatchObject({ custom: [{ name: 'Cable Fly 2', category: 'Chest' }] })
    expect('custom' in (added as object) && ((added as { custom: { compound?: boolean }[] }).custom[0].compound)).toBe(true)
    const custom = (added as { custom: ExerciseCatalogItem[] }).custom
    const off = updateCustomExercise(custom, custom[0].id, 'Pendlay Row', 'Back', false) as { custom: { compound?: boolean }[] }
    expect(off.custom[0].compound).toBeUndefined()
    const on = updateCustomExercise(off.custom as ExerciseCatalogItem[], custom[0].id, 'Pendlay Row', 'Back', true) as { custom: { compound?: boolean }[] }
    expect(on.custom[0].compound).toBe(true)
  })
})