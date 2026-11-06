import { beforeAll, describe, expect, it } from 'vitest'
import type { ExerciseCatalogItem } from './program'
import { set } from './testSets'
import { localDate, toCsv } from './csvExport'

// 2026-10-02T03:30Z is 23:30 on Oct 1 in New York (EDT), so a UTC-based date would be one day late.
const iso = '2026-10-02T03:30:00.000Z'
const catalog: ExerciseCatalogItem[] = [{ id: 'barbell-bench-press', name: 'Barbell Bench Press', category: 'Chest', compound: true }]
const originalTz = process.env.TZ

beforeAll(() => {
  process.env.TZ = 'America/New_York'
  return () => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  }
})

describe('default local date (TZ=America/New_York)', () => {
  it('runs under the pinned timezone', () => {
    expect(new Date(iso).getTimezoneOffset()).toBe(240)
  })

  it('localDate uses local getters, not UTC', () => {
    expect(localDate(iso)).toBe('2026-10-01')
  })

  it('toCsv without a formatter writes the local date and leaves completed_at in UTC', () => {
    const csv = toCsv([set('a', 1, new Date(iso))], catalog)
    expect(csv.replace(/^﻿/, '').split('\r\n')[1].startsWith(`2026-10-01,${iso},`)).toBe(true)
  })
})
