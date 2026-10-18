import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useForeground } from './useForeground'

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => { vi.useRealTimers(); setVisibility('visible') })

describe('useForeground', () => {
  it('runs when the page becomes visible, not when it is hidden', () => {
    const onForeground = vi.fn()
    renderHook(() => useForeground(onForeground))
    setVisibility('hidden')
    expect(onForeground).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(onForeground).toHaveBeenCalledTimes(1)
  })

  it('ignores quick repeats and runs again after the gap', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T12:00:00Z'))
    const onForeground = vi.fn()
    renderHook(() => useForeground(onForeground, 10_000))
    setVisibility('visible')
    vi.setSystemTime(new Date('2026-10-18T12:00:05Z'))
    setVisibility('visible')
    expect(onForeground).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-10-18T12:00:11Z'))
    setVisibility('visible')
    expect(onForeground).toHaveBeenCalledTimes(2)
  })

  it('stops listening after unmount', () => {
    const onForeground = vi.fn()
    const { unmount } = renderHook(() => useForeground(onForeground))
    unmount()
    setVisibility('visible')
    expect(onForeground).not.toHaveBeenCalled()
  })
})
