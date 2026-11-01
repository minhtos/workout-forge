export const bannerStateKey = 'wf.installBanner'

export type BannerState = 'full' | 'min' | 'off'
export type InstallPlatform = 'standalone' | 'chromium' | 'ios' | 'other'
export type BannerAction = 'close' | 'minimize' | 'expand'

export interface InstallEnv {
  userAgent: string
  maxTouchPoints: number
  /** The browser exposes beforeinstallprompt (checked once at startup). */
  canPrompt: boolean
  /** Already running as an installed app. */
  standalone: boolean
}

/** Which install instructions fit this browser. Standalone wins, then iOS Safari, then Chromium with a prompt; everything else gets the generic steps. */
export function detectInstallPlatform({ userAgent, maxTouchPoints, canPrompt, standalone }: InstallEnv): InstallPlatform {
  if (standalone) return 'standalone'
  const iPadOs = /Macintosh/.test(userAgent) && maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(userAgent) || iPadOs) {
    // Other iOS browsers (Chrome, Firefox, Edge) cannot add to the home screen the same way.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent) ? 'other' : 'ios'
  }
  if (/Firefox|SamsungBrowser/.test(userAgent)) return 'other'
  return canPrompt ? 'chromium' : 'other'
}

export function readInstallEnv(win: Window & { navigator: Navigator & { standalone?: boolean } }): InstallEnv {
  const { navigator } = win
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    canPrompt: 'onbeforeinstallprompt' in win,
    standalone: navigator.standalone === true || (typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches),
  }
}

export function loadBannerState(): BannerState {
  try {
    const stored = window.localStorage.getItem(bannerStateKey)
    return stored === 'min' || stored === 'off' ? stored : 'full'
  } catch { return 'full' }
}

export function saveBannerState(state: BannerState): void {
  try { window.localStorage.setItem(bannerStateKey, state) } catch { /* the banner just comes back next visit */ }
}

export const nextBannerState = (action: BannerAction): BannerState => (action === 'close' ? 'off' : action === 'minimize' ? 'min' : 'full')

/** What actually shows: an installed app never sees the banner, whatever was stored. */
export const visibleBannerState = (stored: BannerState, platform: InstallPlatform): BannerState => (platform === 'standalone' ? 'off' : stored)
