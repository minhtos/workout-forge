import { describe, expect, it } from 'vitest'
import { plateGuide } from './plateGuide'
import { baseExercises } from './program'

describe('plateGuide', () => {
  it('loads plates per side, heaviest first, in lb', () => {
    expect(plateGuide(100)).toBe('Working weight 100 lb — plates per side: 25 + 2.5 (bar 45)')
    expect(plateGuide(135)).toBe('Working weight 135 lb — plates per side: 45 (bar 45)')
    expect(plateGuide(225)).toBe('Working weight 225 lb — plates per side: 45 + 45 (bar 45)')
    expect(plateGuide(185, 'lb')).toBe('Working weight 185 lb — plates per side: 45 + 25 (bar 45)')
  })

  it('uses the kg bar and plates', () => {
    expect(plateGuide(100, 'kg')).toBe('Working weight 100 kg — plates per side: 25 + 15 (bar 20)')
    expect(plateGuide(62.5, 'kg')).toBe('Working weight 62.5 kg — plates per side: 20 + 1.25 (bar 20)')
  })

  it('says bar only at or under the bar', () => {
    expect(plateGuide(45)).toBe('Working weight 45 lb — Bar only (bar 45)')
    expect(plateGuide(30)).toBe('Working weight 30 lb — Bar only (bar 45), makes 45 lb')
    expect(plateGuide(20, 'kg')).toContain('Bar only')
  })

  it('shows the loadable combo and what it makes when the target is not exact', () => {
    expect(plateGuide(99)).toBe('Working weight 99 lb — plates per side: 25 (bar 45), makes 95 lb')
    expect(plateGuide(98, 'kg')).toBe('Working weight 98 kg — plates per side: 25 + 10 + 2.5 + 1.25 (bar 20), makes 97.5 kg')
    expect(plateGuide(97.5, 'kg')).not.toContain('makes')
  })

  it('falls back to bar only when less than the smallest plate pair fits', () => {
    expect(plateGuide(47.5)).toBe('Working weight 47.5 lb — Bar only (bar 45), makes 45 lb')
    expect(plateGuide(21, 'kg')).toBe('Working weight 21 kg — Bar only (bar 20), makes 20 kg')
  })

  it('gives nothing for an empty or invalid weight', () => {
    expect(plateGuide(0)).toBeNull()
    expect(plateGuide(Number(''))).toBeNull()
    expect(plateGuide(NaN)).toBeNull()
    expect(plateGuide(-5)).toBeNull()
  })

  it('marks only barbell lifts in the catalog', () => {
    expect(baseExercises.find((item) => item.id === 'barbell-bench-press')?.barbell).toBe(true)
    expect(baseExercises.find((item) => item.id === 'pull-ups')?.barbell).toBeUndefined()
    expect(baseExercises.find((item) => item.id === 'dumbbell-fly')?.barbell).toBeUndefined()
  })
})
