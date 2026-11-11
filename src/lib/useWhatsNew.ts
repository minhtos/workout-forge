import { useCallback, useEffect, useState } from 'react'
import { appVersion } from '../domain/changelog'
import { loadLastSeenVersion, saveLastSeenVersion, whatsNewDecision, type WhatsNewDecision } from '../domain/whatsNew'

/** What's-new state for this device. The decision is read once on mount; the key is only written on dismissal (upgrade) or in an effect (first install), so a mid-session upgrade keeps its banner until the session ends. */
export function useWhatsNew(hadData: boolean) {
  const [decision, setDecision] = useState<WhatsNewDecision>(() => whatsNewDecision(loadLastSeenVersion(), appVersion, hadData))

  useEffect(() => {
    if (decision === 'init') saveLastSeenVersion(appVersion)
  }, [decision])

  const dismiss = useCallback(() => {
    saveLastSeenVersion(appVersion)
    setDecision('none')
  }, [])

  return { visible: decision === 'show', dismiss }
}
