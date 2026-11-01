import type { BannerAction, BannerState, InstallPlatform } from '../domain/installBanner'
import { Icon } from './Icon'

const iosSteps = ['Tap the Share button in Safari', 'Scroll down and tap ‘Add to Home Screen’', 'Tap Add — done, it opens like a normal app.']
const genericSteps = ['Tap the menu in your browser', 'Tap ‘Install’ or ‘Add to Home screen’', 'Confirm — it opens like a normal app.']

interface Props {
  state: BannerState
  platform: InstallPlatform
  canInstall: boolean
  onAction: (action: BannerAction) => void
  onInstall: () => void
}

export function InstallBanner({ state, platform, canInstall, onAction, onInstall }: Props) {
  if (state === 'off') return null
  if (state === 'min') {
    return <div className="install-chip">
      <button className="install-chip-main" onClick={() => onAction('expand')}><Icon name="download" />Get the app — tap for install steps</button>
      <button className="install-icon-button" onClick={() => onAction('close')} aria-label="Close install banner"><Icon name="close" /></button>
    </div>
  }
  const steps = platform === 'ios' ? iosSteps : platform === 'chromium' && canInstall ? null : genericSteps
  return <section className="install-banner" aria-label="Install Workout Forge">
    <div className="install-banner-head">
      <span className="install-tile"><Icon name="download" /></span>
      <div className="install-copy">
        <h2>Install Workout Forge</h2>
        <p>Full-screen, works offline, one tap from your home screen.</p>
      </div>
      <div className="install-controls">
        <button className="install-icon-button" onClick={() => onAction('minimize')} aria-label="Minimize install banner"><Icon name="chevron" /></button>
        <button className="install-icon-button" onClick={() => onAction('close')} aria-label="Close install banner"><Icon name="close" /></button>
      </div>
    </div>
    {steps ? <ol className="install-steps">{steps.map((step) => <li key={step}>{step}</li>)}</ol>
      : <button className="primary-button install-button" onClick={onInstall}>Install app</button>}
  </section>
}
