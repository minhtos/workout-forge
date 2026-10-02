import { describe, expect, it } from 'vitest'
import { generateProgram } from './program'

describe('generateProgram', () => {
  it('creates exactly 12 scheduled workouts for a 3-day, 4-week program', () => {
    const program = generateProgram({
      startDate: '2026-10-05',
      trainingDaysPerWeek: 3,
      durationWeeks: 4,
      weekdays: [1, 3, 5],
    })

    expect(program.workouts).toHaveLength(12)
    expect(program.workouts.map((workout) => workout.date)).toEqual([
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ])
    expect(program.workouts.map((workout) => workout.title)).toEqual([
      'Full Body A',
      'Full Body B',
      'Full Body C',
      'Full Body A',
      'Full Body B',
      'Full Body C',
      'Full Body A',
      'Full Body B',
      'Full Body C',
      'Full Body A',
      'Full Body B',
      'Full Body C',
    ])
  })
})
