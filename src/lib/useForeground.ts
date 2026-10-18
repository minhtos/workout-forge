import { useEffect, useRef } from 'react'

/** Calls `onForeground` when the page becomes visible again (switching back to the app or the tab), at most once per `minGapMs`. */
export function useForeground(onForeground: () => void, minGapMs = 10_000): void {
  const callback = useRef(onForeground)
  const lastRun = useRef(0)
  useEffect(() => { callback.current = onForeground })
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRun.current < minGapMs) return
      lastRun.current = now
      callback.current()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [minGapMs])
}
