import { describe, expect, it } from 'vitest'
import { usualRanges, verdictFor } from './volumeGuidance'

describe('usualRanges', () => {
  it('holds the final weekly direct-set table', () => {
    expect(usualRanges).toEqual({
      Chest: [6, 20], Back: [10, 22], Shoulders: [8, 22], Triceps: [6, 14], Biceps: [8, 20], Forearms: [0, 16],
      Quads: [8, 18], Hamstrings: [6, 16], Glutes: [0, 12], Calves: [8, 16], Core: [0, 20],
    })
  })
})

describe('verdictFor', () => {
  it('says below under the floor once the week is complete', () => {
    expect(verdictFor('Back', 9, true)).toBe('below')
  })
  it('says in range from the floor through the top, inclusive', () => {
    expect(verdictFor('Back', 10, true)).toBe('in range')
    expect(verdictFor('Back', 22, true)).toBe('in range')
  })
  it('says above past the top', () => {
    expect(verdictFor('Back', 23, true)).toBe('above')
  })
  it('never says below for a group whose low end is 0', () => {
    expect(verdictFor('Glutes', 0, true)).toBe('in range')
    expect(verdictFor('Core', 0, true)).toBe('in range')
    expect(verdictFor('Forearms', 0, true)).toBe('in range')
  })
  it('never says below in a week still in progress, but can say in range or above', () => {
    expect(verdictFor('Back', 3, false)).toBeNull()
    expect(verdictFor('Back', 12, false)).toBe('in range')
    expect(verdictFor('Back', 25, false)).toBe('above')
  })
})
