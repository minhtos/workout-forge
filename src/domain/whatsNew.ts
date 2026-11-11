export const lastSeenVersionKey = 'workout-forge:last-seen-version'

export type WhatsNewDecision = 'show' | 'init' | 'none'

const parts = (version: string) => version.split('.').map((part) => { const n = Number.parseInt(part, 10); return Number.isFinite(n) ? n : 0 })

/** Numeric, per dotted part (so 0.10.0 > 0.9.0); anything unparseable counts as 0. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a)
  const right = parts(b)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** No stored version: a device with data predates the feature (upgrade, show), an empty one is a first install (just record). Same version or a rollback stays silent. */
export function whatsNewDecision(lastSeen: string | null, current: string, hadData: boolean): WhatsNewDecision {
  if (lastSeen === null) return hadData ? 'show' : 'init'
  return compareVersions(current, lastSeen) > 0 ? 'show' : 'none'
}

export function loadLastSeenVersion(): string | null {
  try { return window.localStorage.getItem(lastSeenVersionKey) } catch { return null }
}

export function saveLastSeenVersion(version: string): void {
  try { window.localStorage.setItem(lastSeenVersionKey, version) } catch { /* the banner just comes back next visit */ }
}
