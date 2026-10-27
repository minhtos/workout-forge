import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadReportDismissed, saveReportDismissed } from './settings'

beforeEach(() => { window.localStorage.clear(); vi.restoreAllMocks() })

describe('report dismissal', () => {
  it('starts as null and remembers the reported week under its own key', () => {
    expect(loadReportDismissed()).toBeNull()
    saveReportDismissed('2026-10-04')
    expect(loadReportDismissed()).toBe('2026-10-04')
    expect(window.localStorage.getItem('workout-forge:report-dismissed')).toBe('2026-10-04')
  })

  it('keeps only the latest dismissal', () => {
    saveReportDismissed('2026-10-04')
    saveReportDismissed('2026-10-11')
    expect(loadReportDismissed()).toBe('2026-10-11')
  })

  it('copes with unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadReportDismissed()).toBeNull()
    expect(() => saveReportDismissed('2026-10-04')).not.toThrow()
  })
})
