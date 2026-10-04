import { useState } from 'react'

interface Props {
  librarySummary: string
  onOpenLibrary: () => void
  restTimer: boolean
  onRestTimer: (enabled: boolean) => void
  cloudEnabled: boolean
  accountEmail: string | null
  status: string
  pendingCount: number
  onSendLink: (email: string) => void
  onSignOut: () => void
  onBackupAll: () => void
  onRestore: () => void
  onExport: () => void
  onImport: (text: string) => void
  onNewBlock: () => void
}

export function SettingsView({ librarySummary, onOpenLibrary, restTimer, onRestTimer, cloudEnabled, accountEmail, status, pendingCount, onSendLink, onSignOut, onBackupAll, onRestore, onExport, onImport, onNewBlock }: Props) {
  const [email, setEmail] = useState('')
  return <section className="workspace" aria-labelledby="settings-title">
    <div className="workspace-heading"><div><div className="eyebrow">SETTINGS</div><h1 id="settings-title">Settings</h1><p>Workouts always save on this device first.</p></div></div>
    <section className="preview-card"><div><span className="preview-label">WORKOUT</span><h2 id="rest-timer-label">Rest timer</h2><p>Counts down after each set you check off. Pick 60, 90, 120 or 180 seconds right on the timer. Off by default.</p></div>
      <button type="button" role="switch" className="switch" aria-checked={restTimer} aria-labelledby="rest-timer-label" onClick={() => onRestTimer(!restTimer)}><span className="switch-thumb" /></button>
    </section>
    <section className="preview-card"><div><span className="preview-label">LIBRARY</span><h2>Exercise library</h2><p>{librarySummary}. Turn exercises on or off, and add your own.</p></div><button className="secondary-button" onClick={onOpenLibrary}>Open library</button></section>
    {cloudEnabled && <section className="preview-card"><div><span className="preview-label">CLOUD BACKUP</span><h2>{accountEmail ? `Signed in: ${accountEmail}` : 'Protect your training history'}</h2><p>{status || (accountEmail ? (pendingCount ? `${pendingCount} session(s) waiting to back up.` : 'Every set backs up automatically. You stay signed in on this device.') : 'Sign in with a magic link to back up and use multiple devices.')}</p></div>
      {accountEmail
        ? <div className="button-row"><button className="secondary-button" onClick={onBackupAll}>Back up now</button><button className="secondary-button" onClick={onRestore}>Restore</button><button className="secondary-button" onClick={onSignOut}>Sign out</button></div>
        : <form className="button-row" onSubmit={(event) => { event.preventDefault(); if (email.trim()) onSendLink(email.trim()) }}><input aria-label="Backup email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /><button className="secondary-button" type="submit">Send magic link</button></form>}
    </section>}
    <section className="preview-card"><div><span className="preview-label">DEVICE COPY</span><h2>Export or import</h2><p>Download everything on this device as a file, or merge a file from another device.</p></div>
      <div className="button-row"><button className="secondary-button" onClick={onExport}>Export</button><label className="secondary-button file-button">Import<input type="file" accept="application/json,.json" aria-label="Import backup file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(onImport); event.target.value = '' }} /></label></div>
    </section>
    <section className="preview-card"><div><span className="preview-label">TRAINING BLOCK</span><h2>Start a new block</h2><p>Your logged history is kept. The current block and its locked exercises are replaced.</p></div><button className="secondary-button" onClick={onNewBlock}>New block</button></section>
  </section>
}
