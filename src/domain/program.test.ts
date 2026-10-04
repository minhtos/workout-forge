import { describe, expect, it } from 'vitest'
import { autoFillPlan, createBlock, findWorkout, listWorkouts, mergeCatalog, nextWorkout, planProblem, resolveWorkout } from './program'

const catalog = mergeCatalog([])

describe('blocks', () => {
  it('creates muscle-group-only templates with no exercises chosen', () => {
    const block = createBlock(3, 5)
    expect(block.templates.map((template) => template.title)).toEqual(['Push', 'Pull', 'Legs'])
    expect(block.templates.flatMap((template) => template.slots).every((slot) => slot.exerciseId === null)).toBe(true)
    expect(block.templates[0].slots.map((slot) => slot.category)).toEqual(['Chest', 'Chest', 'Chest', 'Chest', 'Triceps', 'Triceps'])
  })

  it('lists days × weeks workouts with the right RIR per duration', () => {
    expect(listWorkouts(createBlock(3, 4))).toHaveLength(12)
    expect(listWorkouts(createBlock(4, 6))).toHaveLength(24)
    expect(listWorkouts(createBlock(3, 6)).filter((workout) => workout.dayIndex === 0).map((workout) => workout.target.targetRir)).toEqual([3, 3, 2, 2, 1, 0])
    expect(listWorkouts(createBlock(3, 5)).at(-1)?.target.kind).toBe('deload')
  })

  it('distributes lower body across the A days of a 4-day block', () => {
    const block = createBlock(4, 4)
    expect(block.templates.map((template) => template.title)).toEqual(['Push A', 'Pull A', 'Push B', 'Pull B'])
    expect(block.templates[0].slots.filter((slot) => slot.category === 'Quads')).toHaveLength(2)
    expect(block.templates[1].slots.filter((slot) => slot.category === 'Hamstrings')).toHaveLength(2)
  })

  it('serves workouts in order, skipping completed and skipped ones, then returns null', () => {
    let block = createBlock(3, 4)
    expect(nextWorkout(block)?.id).toBe('w1-d1')
    block = { ...block, completedIds: ['w1-d1'], skippedIds: ['w1-d2'] }
    expect(nextWorkout(block)?.id).toBe('w1-d3')
    block = { ...block, completedIds: listWorkouts(block).map((workout) => workout.id) }
    expect(nextWorkout(block)).toBeNull()
  })
})

describe('plan validation', () => {
  it('requires every slot and rejects duplicate exercises within a day', () => {
    const block = createBlock(3, 5)
    expect(planProblem(block, catalog)).toMatch(/Push/)
    const filled = autoFillPlan(block, catalog)
    expect(planProblem(filled, catalog)).toBeNull()
    const duplicated = { ...filled, templates: filled.templates.map((template, index) => index === 0 ? { ...template, slots: template.slots.map((slot, position) => position === 1 ? { ...slot, exerciseId: template.slots[0].exerciseId } : slot) } : template) }
    expect(planProblem(duplicated, catalog)).toMatch(/twice/)
  })

  it('auto-fill keeps manual choices and never repeats an exercise in a day', () => {
    const block = createBlock(3, 5)
    block.templates[0].slots[2].exerciseId = 'barbell-bench-press'
    const filled = autoFillPlan(block, catalog)
    expect(filled.templates[0].slots[2].exerciseId).toBe('barbell-bench-press')
    for (const template of filled.templates) expect(new Set(template.slots.map((slot) => slot.exerciseId)).size).toBe(template.slots.length)
  })

  it('resolves a workout to the chosen exercises with category rep ranges', () => {
    const block = autoFillPlan(createBlock(3, 5), catalog)
    const workout = resolveWorkout(block, findWorkout(block, 'w1-d1')!, catalog)
    expect(workout.exercises).toHaveLength(6)
    expect(workout.exercises[0]).toMatchObject({ category: 'Chest', sets: 3, repRange: { min: 6, max: 10 } })
    expect(workout.exercises[5]).toMatchObject({ category: 'Triceps', repRange: { min: 10, max: 15 } })
  })
})
