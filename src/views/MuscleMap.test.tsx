import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { muscleMapView, type MuscleMapView } from '../domain/muscleVolume'
import { mergeCatalog } from '../domain/program'
import { set } from '../domain/testSets'
import { completedSessions } from '../domain/weekly'
import { MuscleMap } from './MuscleMap'

afterEach(cleanup)

const catalog = mergeCatalog([])
const NOW = new Date(2026, 9, 14, 12)
const bench = { exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press' }
const row = { exerciseId: 'barbell-row', exerciseName: 'Barbell Row' }
const thisWeek = completedSessions([
  set('a', 1, new Date(2026, 9, 12), { ...bench }), set('a', 2, new Date(2026, 9, 12), { ...bench }), set('a', 3, new Date(2026, 9, 12), { ...bench }), set('a', 4, new Date(2026, 9, 12), { ...bench }),
  set('a', 5, new Date(2026, 9, 12), { ...row, weight: 80, reps: 10 }),
], null)
const show = (view: MuscleMapView, props: Partial<Parameters<typeof MuscleMap>[0]> = {}) => render(<MuscleMap view={view} idPrefix="t" {...props} />)

describe('MuscleMap', () => {
  it('lists only trained groups with tabular counts and volume, bars sized to the busiest group', () => {
    const { container } = show(muscleMapView(thisWeek, catalog, NOW, null))
    const rows = container.querySelectorAll('.muscle-row')
    expect([...rows].map((item) => item.querySelector('.muscle-name')?.textContent)).toEqual(['Chest', 'Back'])
    expect(rows[0].textContent).toContain('4 sets · 4,000 lb')
    expect(rows[1].textContent).toContain('1 set · 800 lb')
    expect((rows[0].querySelector('.muscle-bar i') as HTMLElement).style.width).toBe('100%')
    expect((rows[1].querySelector('.muscle-bar i') as HTMLElement).style.width).toBe('25%')
    expect(screen.queryByText(/to go/)).toBeNull()
  })

  it('is a labelled group with a text summary, and has a table view', () => {
    show(muscleMapView(thisWeek, catalog, NOW, null))
    expect(screen.getByRole('group', { name: /sets per muscle group for the week of oct 11: chest 4, back 1/i })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Where the work went' })).toBeTruthy()
    const table = screen.getByRole('table', { hidden: true })
    expect(within(table).getAllByRole('columnheader', { hidden: true }).map((cell) => cell.textContent)).toEqual(['Group', 'Sets', 'Volume', 'Plan', 'Usual range'])
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(3)
  })

  it('shows a hit group as done and the rest as sets to go, never both on one row', () => {
    show(muscleMapView(thisWeek, catalog, NOW, { Chest: 4, Back: 3, Quads: 5 }))
    expect(screen.getByText('Target hit')).toBeTruthy()
    expect(screen.getByText('2 sets to go')).toBeTruthy()
    expect(screen.getByText('2 sets to go').closest('.muscle-row')?.textContent).toContain('Back')
    expect(screen.getByText('2 sets to go').closest('li')?.className).not.toContain('is-hit')
    expect(screen.getAllByText(/sets to go/)).toHaveLength(2)
    expect(document.querySelector('.is-hit .muscle-name')?.textContent).toBe('Chest')
  })

  it('labels a fallback to last week', () => {
    show(muscleMapView(completedSessions([set('l', 1, new Date(2026, 9, 6), { ...bench })], null), catalog, NOW, null))
    expect(screen.getByText('Last week · log a workout to start this week')).toBeTruthy()
  })

  it('says the first workout fills it in when there is no history', () => {
    show(muscleMapView([], catalog, NOW, null))
    expect(screen.getByText('Your first workout fills this in.')).toBeTruthy()
    expect(document.querySelector('.muscle-row')).toBeNull()
  })

  describe('usual-range guidance', () => {
    const chestSets = (count: number, at: Date, patch: Partial<Parameters<typeof set>[3]> = {}) => Array.from({ length: count }, (_, index) => set('g', index + 1, at, { ...bench, ...patch }))
    const verdicts = () => [...document.querySelectorAll('.muscle-verdict')].map((node) => node.textContent)

    it('adds a usual-range line under the volume text, with the plan target still the main label', () => {
      show(muscleMapView(thisWeek, catalog, NOW, { Chest: 4 }))
      const chest = document.querySelector('.muscle-row')!
      expect(chest.querySelector('.muscle-guidance')?.textContent).toBe('Usual range 6–20 sets/wk')
      expect(chest.textContent).toContain('Target hit')
    })

    it('never says below mid-week, but says in range or above', () => {
      show(muscleMapView(thisWeek, catalog, NOW, null))
      expect(verdicts()).toEqual([])
      cleanup()
      show(muscleMapView(completedSessions([...chestSets(8, new Date(2026, 9, 12))], null), catalog, NOW, null))
      expect(verdicts()).toEqual(['in range'])
      cleanup()
      show(muscleMapView(completedSessions([...chestSets(21, new Date(2026, 9, 12))], null), catalog, NOW, null))
      expect(verdicts()).toEqual(['above'])
    })

    it('says below for a group under its floor once the week is complete (last week)', () => {
      show(muscleMapView(completedSessions([...chestSets(4, new Date(2026, 9, 6))], null), catalog, NOW, null))
      expect(verdicts()).toEqual(['below'])
    })

    it('suppresses every verdict in a deload week and shows the note once', () => {
      show(muscleMapView(completedSessions([...chestSets(21, new Date(2026, 9, 12), { deload: true })], null), catalog, NOW, null))
      expect(verdicts()).toEqual([])
      expect(screen.getAllByText('Deload week — low volume is the point')).toHaveLength(1)
      cleanup()
      show(muscleMapView(completedSessions([...chestSets(4, new Date(2026, 9, 6), { deload: true })], null), catalog, NOW, null))
      expect(verdicts()).toEqual([])
    })

    it('adds a Usual range column to the table view', () => {
      show(muscleMapView(thisWeek, catalog, NOW, null))
      const table = screen.getByRole('table', { hidden: true })
      expect(within(table).getAllByRole('row', { hidden: true })[1].textContent).toContain('6–20')
    })

    it('renders no guidance, no note and dashes in the table when switched off', () => {
      show(muscleMapView(completedSessions([...chestSets(21, new Date(2026, 9, 12), { deload: true })], null), catalog, NOW, null), { guidance: false })
      expect(document.querySelector('.muscle-rows')!.textContent).not.toMatch(/usual range|below|in range|above/i)
      expect(screen.queryByText(/deload week/i)).toBeNull()
      const table = screen.getByRole('table', { hidden: true })
      expect(within(table).getAllByRole('row', { hidden: true })[1].textContent).toContain('—')
    })

    it('never uses the word optimal', () => {
      show(muscleMapView(completedSessions([...chestSets(4, new Date(2026, 9, 6))], null), catalog, NOW, null))
      expect(document.body.textContent).not.toMatch(/optimal/i)
    })
  })

  it('can make rows focusable and carry a caption', () => {
    show(muscleMapView(thisWeek, catalog, NOW, null), { focusable: true, caption: 'Sample data' })
    expect(document.querySelectorAll('.muscle-row[tabindex="0"]')).toHaveLength(2)
    expect(screen.getByText('Sample data')).toBeTruthy()
  })
})
