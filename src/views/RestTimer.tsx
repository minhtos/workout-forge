import { useEffect, useRef, useState } from 'react'

const presets = [60, 90, 120, 180]
const storageKey = 'workout-forge:rest-seconds'

function savedLength() {
  try {
    const value = Number(window.localStorage.getItem(storageKey))
    return presets.includes(value) ? value : 90
  } catch { return 90 }
}

const format = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`

/** Starts counting down whenever `completed` goes up (a set was checked off). Undoing a set does not start it. */
export function RestTimer({ completed }: { completed: number }) {
  const [length, setLength] = useState(savedLength)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const previous = useRef(completed)

  const start = (seconds: number) => {
    setEndsAt(Date.now() + seconds * 1000)
    setRemaining(seconds)
  }

  useEffect(() => {
    if (completed > previous.current) start(length)
    previous.current = completed
  }, [completed, length])

  useEffect(() => {
    if (endsAt === null) return
    const tick = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 250)
    return () => window.clearInterval(tick)
  }, [endsAt])

  const over = endsAt !== null && remaining === 0
  useEffect(() => { if (over) navigator.vibrate?.([200, 100, 200]) }, [over])

  if (endsAt === null) return null
  const choose = (seconds: number) => {
    setLength(seconds)
    start(seconds)
    try { window.localStorage.setItem(storageKey, String(seconds)) } catch { /* preference is optional */ }
  }

  return <div className={over ? 'rest-timer is-over' : 'rest-timer'} role="timer" aria-label="Rest timer">
    <span className="rest-time">{format(remaining)}</span>
    <span className="rest-label"><strong>{over ? 'Rest over' : 'Rest'}</strong>{over ? 'Next set when you are ready' : 'Set saved'}</span>
    <span className="rest-presets" role="group" aria-label="Rest length">{presets.map((seconds) => <button key={seconds} aria-pressed={length === seconds} aria-label={`Rest ${seconds} seconds`} onClick={() => choose(seconds)}>{seconds}s</button>)}</span>
    <button className="rest-dismiss" aria-label="Dismiss rest timer" onClick={() => setEndsAt(null)}>✕</button>
  </div>
}
