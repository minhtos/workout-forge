import { describe, expect, it } from 'vitest'
import { equipmentKinds, equipmentLabels, exerciseGuide, guideFor, maxCueLength } from './exerciseGuide'
import { baseExercises } from './program'

describe('exerciseGuide', () => {
  it('has exactly one entry per built-in exercise and no extras', () => {
    const builtIn = baseExercises.map((item) => item.id).sort()
    expect(Object.keys(exerciseGuide).sort()).toEqual(builtIn)
  })

  it.each(baseExercises.map((item) => [item.name, item.id]))('%s has 2-3 short cues and valid equipment', (_name, id) => {
    const entry = exerciseGuide[id]
    expect(equipmentKinds).toContain(entry.equipment)
    expect(entry.cues.length).toBeGreaterThanOrEqual(2)
    expect(entry.cues.length).toBeLessThanOrEqual(3)
    for (const cue of entry.cues) {
      expect(cue.trim()).toBe(cue)
      expect(cue.length).toBeGreaterThan(0)
      expect(cue.length).toBeLessThanOrEqual(maxCueLength)
    }
    expect(new Set(entry.cues).size).toBe(entry.cues.length)
  })

  it('uses exactly the five approved equipment kinds, each labelled', () => {
    expect([...equipmentKinds]).toEqual(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'])
    expect(equipmentLabels).toEqual({ barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight' })
  })

  it('looks a guide up by id, and gives nothing for a custom exercise', () => {
    expect(guideFor('barbell-bench-press')).toBe(exerciseGuide['barbell-bench-press'])
    expect(guideFor('my-custom-lift')).toBeUndefined()
    expect(guideFor('toString')).toBeUndefined()
  })
})
