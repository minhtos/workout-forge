import { appVersion, changelog } from '../domain/changelog'
import { Icon } from './Icon'

export function WhatsNewBanner({ onDismiss }: { onDismiss: () => void }) {
  return <section className="install-banner" aria-label="What's new">
    <div className="install-banner-head">
      <div className="install-copy">
        <h2>What's new in Workout Forge {appVersion}</h2>
        <ul className="whats-new-notes">{changelog[0].notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </div>
      <div className="install-controls">
        <button className="install-icon-button" onClick={onDismiss} aria-label="Dismiss what's new"><Icon name="close" /></button>
      </div>
    </div>
  </section>
}
