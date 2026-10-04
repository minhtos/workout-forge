const restTimerKey = 'workout-forge:rest-timer-enabled'

/** Per-device preferences. Optional features default to off. */
export function loadRestTimerEnabled(): boolean {
  try { return window.localStorage.getItem(restTimerKey) === 'on' } catch { return false }
}

export function saveRestTimerEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(restTimerKey, enabled ? 'on' : 'off') } catch { /* preference is optional */ }
}
