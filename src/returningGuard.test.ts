import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState, saveWorkoutState } from './domain/storage'

// The inline script in index.html marks returning visitors so the prerendered landing is hidden before first paint.
const html = readFileSync('index.html', 'utf8')
const guard = html.match(/<script>([\s\S]*?returning[\s\S]*?)<\/script>/)![1]
const runGuard = () => {
  document.documentElement.className = ''
  new Function(guard)()
  return document.documentElement.classList.contains('returning')
}

beforeEach(() => localStorage.clear())

describe('returning-visitor guard', () => {
  it('leaves new visitors alone', () => {
    expect(runGuard()).toBe(false)
  })
  it('ignores the empty state the app writes for a casual visitor', () => {
    saveWorkoutState(emptyState())
    expect(localStorage.getItem('workout-forge:v3')).not.toBeNull()
    expect(runGuard()).toBe(false)
  })
  it('flags a saved block or logged sets', () => {
    localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), block: { templates: [] } }))
    expect(runGuard()).toBe(true)
    localStorage.setItem('workout-forge:v3', JSON.stringify({ ...emptyState(), history: [{ id: 'x' }] }))
    expect(runGuard()).toBe(true)
  })
  it('survives unreadable storage', () => {
    localStorage.setItem('workout-forge:v3', '{nope')
    expect(runGuard()).toBe(false)
  })
})
