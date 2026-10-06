import { AuthForm, type AuthResult } from './AuthForm'

interface Props {
  librarySummary: string
  planStatus: string
  onOpenLibrary: () => void
  restTimer: boolean
  onRestTimer: (enabled: boolean) => void
  cloudEnabled: boolean
  accountEmail: string | null
  status: string
  pendingCount: number
  onSignIn: (email: string, password: string) => Promise<AuthResult>
  onSignUp: (email: string, password: string) => Promise<AuthResult>
  onReset: (email: string) => Promise<AuthResult>
  onSignOut: () => void
  onBackupAll: () => void
  onRestore: () => void
  onExport: () => void
  onImport: (text: string) => void
  onNewBlock: () => void
}

export function SettingsView({ planStatus, librarySummary, onOpenLibrary, restTimer, onRestTimer, cloudEnabled, accountEmail, status, pendingCount, onSignIn, onSignUp, onReset, onSignOut, onBackupAll, onRestore, onExport, onImport, onNewBlock }: Props) {
  return <section className="workspace" aria-labelledby="settings-title">
    <div className="workspace-heading"><div><div className="eyebrow">SETTINGS</div><h1 id="settings-title">Settings</h1><p>Workouts always save on this device first.</p></div></div>
    {cloudEnabled && <section className="preview-card"><div><span className="preview-label">CLOUD BACKUP</span><h2>{accountEmail ? `Signed in: ${accountEmail}` : 'Protect your training history'}</h2><p>{status || (accountEmail ? (pendingCount ? `${pendingCount} session(s) waiting to back up.` : 'Your sets, plan and exercises back up automatically. You stay signed in on this device.') : 'Create an account or sign in to back up and use multiple devices.')}</p>{planStatus && <p className="hint">{planStatus}</p>}</div>
      {accountEmail
        ? <div className="button-row"><button className="secondary-button" onClick={onBackupAll}>Back up now</button><button className="secondary-button" onClick={onRestore}>Restore</button><button className="secondary-button" onClick={onSignOut}>Sign out</button></div>
        : <AuthForm idPrefix="settings" onSignIn={onSignIn} onSignUp={onSignUp} onReset={onReset} />}
    </section>}
    <section className="preview-card"><div><span className="preview-label">TRAINING BLOCK</span><h2>Start a new block</h2><p>Your logged history is kept. The current block and its locked exercises are replaced.</p></div><button className="secondary-button" onClick={onNewBlock}>New block</button></section>
    <section className="preview-card"><div><span className="preview-label">LIBRARY</span><h2>Exercise library</h2><p>{librarySummary}. Turn exercises on or off, and add your own.</p></div><button className="secondary-button" onClick={onOpenLibrary}>Open library</button></section>
    <section className="preview-card"><div><span className="preview-label">WORKOUT</span><h2 id="rest-timer-label">Rest timer</h2><p>Counts down after each set you check off. Pick 60, 90, 120 or 180 seconds right on the timer. Off by default.</p></div>
      <button type="button" role="switch" className="switch" aria-checked={restTimer} aria-labelledby="rest-timer-label" onClick={() => onRestTimer(!restTimer)}><span className="switch-thumb" /></button>
    </section>
    <section className="preview-card"><div><span className="preview-label">DEVICE COPY</span><h2>Export or import</h2><p>Download everything on this device as a file, or merge a file from another device.</p></div>
      <div className="button-row"><button className="secondary-button" onClick={onExport}>Export</button><label className="secondary-button file-button">Import<input type="file" accept="application/json,.json" aria-label="Import backup file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(onImport); event.target.value = '' }} /></label></div>
    </section>
  </section>
}
