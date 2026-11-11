import { afterEach, describe, expect, it, vi } from 'vitest'
import { compareVersions, lastSeenVersionKey, loadLastSeenVersion, saveLastSeenVersion, whatsNewDecision } from './whatsNew'

afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear() })

describe('whatsNewDecision', () => {
  it('records silently on a first install and shows on an existing device with no key', () => {
    expect(whatsNewDecision(null, '0.1.0', false)).toBe('init')
    expect(whatsNewDecision(null, '0.1.0', true)).toBe('show')
  })

  it('shows on an upgrade and stays silent on the same version or a downgrade', () => {
    expect(whatsNewDecision('0.0.0', '0.1.0', true)).toBe('show')
    expect(whatsNewDecision('0.1.0', '0.1.0', true)).toBe('none')
    expect(whatsNewDecision('0.2.0', '0.1.0', true)).toBe('none')
  })
})

describe('compareVersions', () => {
  it('compares numerically per part', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('0.9.0', '0.10.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
  })

  it('counts unparseable parts as 0', () => {
    expect(compareVersions('junk', '0.0.0')).toBe(0)
    expect(compareVersions('0.1.0', 'junk')).toBeGreaterThan(0)
    expect(compareVersions('', '0.0.1')).toBeLessThan(0)
  })
})

describe('last-seen storage', () => {
  it('round-trips and starts empty', () => {
    expect(loadLastSeenVersion()).toBeNull()
    saveLastSeenVersion('0.1.0')
    expect(window.localStorage.getItem(lastSeenVersionKey)).toBe('0.1.0')
    expect(loadLastSeenVersion()).toBe('0.1.0')
  })

  it('falls back when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadLastSeenVersion()).toBeNull()
    expect(() => saveLastSeenVersion('0.1.0')).not.toThrow()
  })
})
