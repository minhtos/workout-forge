import { describe, expect, it } from 'vitest'
import type { ExerciseCatalogItem } from './program'
import { set } from './testSets'
import { toCsv } from './csvExport'

const header = 'date,completed_at,workout_id,week,deload,exercise,exercise_id,muscle_group,set,weight,unit,reps,target_reps,rep_min,rep_max,target_rir,session_id'
const catalog: ExerciseCatalogItem[] = [{ id: 'barbell-bench-press', name: 'Barbell Bench Press', category: 'Chest', compound: true }]
const utcDate = (iso: string) => iso.slice(0, 10)
const rows = (csv: string) => csv.replace(/^﻿/, '').split('\r\n')

describe('toCsv', () => {
  it('writes the header, one row per set, sorted by completed_at then set index', () => {
    const early = new Date('2026-10-01T10:00:00Z')
    const late = new Date('2026-10-03T10:00:00Z')
    const csv = toCsv([set('b', 1, late), set('a', 2, early), set('a', 1, early)], catalog, utcDate)
    expect(rows(csv)).toEqual([
      header,
      '2026-10-01,2026-10-01T10:00:00.000Z,w1-d1,1,false,Barbell Bench Press,barbell-bench-press,Chest,1,100,lb,10,10,6,12,2,a',
      '2026-10-01,2026-10-01T10:00:00.000Z,w1-d1,1,false,Barbell Bench Press,barbell-bench-press,Chest,2,100,lb,10,10,6,12,2,a',
      '2026-10-03,2026-10-03T10:00:00.000Z,w1-d1,1,false,Barbell Bench Press,barbell-bench-press,Chest,1,100,lb,10,10,6,12,2,b',
      '',
    ])
  })

  it('has no rir column', () => {
    expect(rows(toCsv([], catalog, utcDate))[0].split(',')).not.toContain('rir')
  })

  it('escapes commas, quotes and newlines in a custom exercise name', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'), { exerciseName: 'Curl, "heavy"\nstrict' })], catalog, utcDate)
    expect(csv).toContain('"Curl, ""heavy""\nstrict"')
  })

  it('guards cells that start with = + - @ with a leading single quote', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'), { exerciseName: '=SUM(A1)' }), set('a', 2, new Date('2026-10-01T10:00:00Z'), { exerciseName: '@x' })], catalog, utcDate)
    expect(csv).toContain(",'=SUM(A1),")
    expect(csv).toContain(",'@x,")
    expect(csv).not.toContain(',=SUM')
  })

  it('guards cells that start with - or +', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'), { exerciseName: '-1' }), set('a', 2, new Date('2026-10-01T10:00:00Z'), { exerciseName: '+a' })], catalog, utcDate)
    expect(csv).toContain(",'-1,")
    expect(csv).toContain(",'+a,")
    expect(csv).not.toContain(',-1,')
    expect(csv).not.toContain(',+a,')
  })

  it('applies the formula guard before quoting', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'), { exerciseName: '-1, "x"' })], catalog, utcDate)
    expect(csv).toContain(`,"'-1, ""x""",`)
    expect(csv).not.toContain(`'"-1`)
  })

  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'))], catalog, utcDate)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('leaves muscle_group blank for an exercise no longer in the catalog', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'), { exerciseId: 'custom-gone', exerciseName: 'Gone' })], catalog, utcDate)
    expect(rows(csv)[1]).toContain(',custom-gone,,1,')
  })

  it('derives date from completed_at with the injected formatter and keeps completed_at unchanged', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T23:30:00Z'))], catalog, () => 'FIXED')
    expect(rows(csv)[1].startsWith('FIXED,2026-10-01T23:30:00.000Z,')).toBe(true)
  })

  it('leaves target_reps blank for older records and marks deload sets', () => {
    const csv = toCsv([set('a', 1, new Date('2026-10-01T10:00:00Z'), { targetReps: undefined, deload: true })], catalog, utcDate)
    expect(rows(csv)[1]).toContain(',true,Barbell Bench Press,')
    expect(rows(csv)[1]).toContain(',lb,10,,6,12,2,a')
  })

  it('gives the header row only for an empty history', () => {
    expect(toCsv([], catalog, utcDate)).toBe(`﻿${header}\r\n`)
  })
})
