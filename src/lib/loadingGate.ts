/** How long the loading screen may stand in for the setup screen before the app shows what it has. */
export const gateTimeoutMs = 8000

/**
 * supabase-js keeps the session under `sb-<project ref>-auth-token`, where the ref is the first label of the project
 * hostname (SupabaseClient's default storageKey). Null when the URL is missing or not a URL.
 */
export function sessionHintKey(url: string | undefined): string | null {
  if (!url) return null
  try { return `sb-${new URL(url).hostname.split('.')[0]}-auth-token` } catch { return null }
}

/** True when this browser has (or recently had) a signed-in session. Only checks the key exists; the stored value is never read. */
export function hasSessionHint(url: string | undefined, storage: Pick<Storage, 'getItem'>): boolean {
  const key = sessionHintKey(url)
  if (!key) return false
  try { return storage.getItem(key) !== null } catch { return false }
}

export interface GateInput {
  /** This device already has a plan or logged sets, so there is something real to show. */
  hasLocalData: boolean
  /** The Supabase session key exists in localStorage (best guess that the visitor is signed in). */
  sessionHint: boolean
  /** supabase-js has answered getSession(). */
  authResolved: boolean
  signedIn: boolean
  /** The first program sync after sign-in finished, whatever its outcome (adopted, pushed, nothing, or an error). */
  firstSyncSettled: boolean
  /** The fail-safe expired. */
  timedOut: boolean
}

/**
 * Whether to show the loading skeleton instead of the landing/setup screen. Only for a returning, signed-in user on a
 * device with no data, while their program is on its way from the account.
 */
export function isLoadingGate({ hasLocalData, sessionHint, authResolved, signedIn, firstSyncSettled, timedOut }: GateInput): boolean {
  if (hasLocalData || timedOut) return false
  if (!authResolved) return sessionHint
  return signedIn && !firstSyncSettled
}
