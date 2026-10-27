const restTimerKey = 'workout-forge:rest-timer-enabled'

/** Per-device preferences. Optional features default to off. */
export function loadRestTimerEnabled(): boolean {
  try { return window.localStorage.getItem(restTimerKey) === 'on' } catch { return false }
}

const reportDismissedKey = 'workout-forge:report-dismissed'

/** The Sunday (YYYY-MM-DD) of the weekly report the user dismissed on this device, if any. */
export function loadReportDismissed(): string | null {
  try { return window.localStorage.getItem(reportDismissedKey) } catch { return null }
}

export function saveReportDismissed(weekKey: string): void {
  try { window.localStorage.setItem(reportDismissedKey, weekKey) } catch { /* a dismissal that is not remembered just shows the card again */ }
}

export function saveRestTimerEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(restTimerKey, enabled ? 'on' : 'off') } catch { /* preference is optional */ }
}
