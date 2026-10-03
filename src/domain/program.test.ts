import { describe, expect, it } from 'vitest'
import { generateProgram } from './program'

describe('generateProgram', () => {
  it('creates a 3-day Push / Pull / Legs schedule with a fifth-week deload', () => {
    const program = generateProgram({ startDate: '2026-10-05', trainingDaysPerWeek: 3, durationWeeks: 5, weekdays: [1, 3, 5] })
    expect(program.workouts).toHaveLength(15)
    expect(program.workouts.slice(0, 3).map((workout) => workout.title)).toEqual(['Push', 'Pull', 'Legs'])
    expect(program.workouts[0].target).toEqual({ kind: 'work', targetRir: 3 })
    expect(program.workouts.find((workout) => workout.weekNumber === 5)?.target).toEqual({ kind: 'deload', loadMultiplier: 0.5, targetRir: 3 })
  })

  it('creates a 4-day Push / Pull A/B schedule with lower body distributed across A days', () => {
    const program = generateProgram({ startDate: '2026-10-05', trainingDaysPerWeek: 4, durationWeeks: 5, weekdays: [1, 2, 4, 5] })
    expect(program.workouts).toHaveLength(20)
    expect(program.workouts.slice(0, 4).map((workout) => workout.title)).toEqual(['Push A', 'Pull A', 'Push B', 'Pull B'])
    expect(program.workouts[0].exercises.map((exercise) => exercise.name)).toContain('Back Squat')
    expect(program.workouts[1].exercises.map((exercise) => exercise.name)).toContain('Romanian Deadlift')
  })
})
