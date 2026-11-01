import { useCallback, useEffect, useState } from 'react'
import { detectInstallPlatform, loadBannerState, nextBannerState, readInstallEnv, saveBannerState, visibleBannerState, type BannerAction } from '../domain/installBanner'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Install-banner state for this device. Lives in App so the one-shot beforeinstallprompt event is caught even while the banner is hidden. */
export function useInstallBanner() {
  const [platform] = useState(() => detectInstallPlatform(readInstallEnv(window)))
  const [stored, setStored] = useState(loadBannerState)
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)

  const apply = useCallback((action: BannerAction) => {
    const next = nextBannerState(action)
    setStored(next)
    saveBannerState(next)
  }, [])

  useEffect(() => {
    // Only take over the browser's own prompt when the banner can offer it: Chromium, and not closed for good.
    const onPrompt = (event: Event) => {
      if (platform !== 'chromium' || stored === 'off') return
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => apply('close')
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [apply, platform, stored])

  const install = useCallback(async () => {
    if (!promptEvent) return
    setPromptEvent(null) // the event can only be used once
    try {
      await promptEvent.prompt()
      if ((await promptEvent.userChoice).outcome === 'accepted') apply('close')
    } catch { /* prompt refused: the banner stays so they can try the manual steps */ }
  }, [promptEvent, apply])

  return { state: visibleBannerState(stored, platform), platform, canInstall: promptEvent !== null, apply, install }
}
