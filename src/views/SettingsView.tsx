import { changelog, formatChangelogDate } from '../domain/changelog'
import { dumbbellsLb, fullInventory, platesLb, type EquipmentInventory } from '../domain/equipment'
import { AuthForm, type AuthResult } from './AuthForm'
import { FeedbackForm } from './FeedbackForm'

interface Props {
  librarySummary: string
  planStatus: string
  onOpenLibrary: () => void
  restTimer: boolean
  onRestTimer: (enabled: boolean) => void
  equipment: EquipmentInventory
  onEquipment: (next: EquipmentInventory) => void
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
  onExportCsv: () => void
  canExportCsv: boolean
  onImport: (text: string) => void
  onNewBlock: () => void
  onFeedback: (message: string, email: string) => Promise<AuthResult>
}

/** One checklist of sizes as toggle chips. The last checked size cannot be unchecked: an empty rack is not an inventory. */
function SizeChips({ legend, sizes, missing, noun, onChange }: { legend: string; sizes: readonly number[]; missing: number[]; noun: string; onChange: (next: number[]) => void }) {
  const ownedCount = sizes.length - missing.length
  return <fieldset className="equipment-sizes"><legend>{legend}</legend>
    <div className="equipment-chips">{sizes.map((size) => {
      const owned = !missing.includes(size)
      const last = owned && ownedCount === 1
      return <button key={size} type="button" className="equipment-chip" aria-pressed={owned} aria-label={`${size} lb ${noun}`} disabled={last} title={last ? 'Keep at least one size checked' : undefined} onClick={() => onChange(owned ? sizes.filter((candidate) => candidate === size || missing.includes(candidate)) : missing.filter((candidate) => candidate !== size))}>{size}</button>
    })}</div>
  </fieldset>
}

export function SettingsView({ planStatus, librarySummary, onOpenLibrary, restTimer, onRestTimer, equipment, onEquipment, cloudEnabled, accountEmail, status, pendingCount, onSignIn, onSignUp, onReset, onSignOut, onBackupAll, onRestore, onExport, onExportCsv, canExportCsv, onImport, onNewBlock, onFeedback }: Props) {
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
    <section className="preview-card equipment-card"><div><span className="preview-label">EQUIPMENT</span><h2>Plates and dumbbells</h2><p>Uncheck what your gym doesn't have. Suggested weights, plate loads and warm-ups then fit what's left. A weight you type is always kept.</p></div>
      <SizeChips legend="Plates (pairs, lb)" sizes={platesLb} missing={equipment.missingPlates} noun="plates" onChange={(missingPlates) => onEquipment({ ...equipment, missingPlates })} />
      <SizeChips legend="Dumbbells (pairs, lb, per dumbbell)" sizes={dumbbellsLb} missing={equipment.missingDumbbells} noun="dumbbells" onChange={(missingDumbbells) => onEquipment({ ...equipment, missingDumbbells })} />
      <p className="hint">At least one size stays checked in each list.</p>
      <button type="button" className="secondary-button" disabled={equipment.missingPlates.length === 0 && equipment.missingDumbbells.length === 0} onClick={() => onEquipment(fullInventory)}>Check all</button>
    </section>
    {cloudEnabled && <section className="preview-card feedback-card"><div><span className="preview-label">FEEDBACK</span><h2>Help shape Workout Forge</h2><p>Missing an exercise, or something feels off? Send it straight to the developer — every note is read.</p></div>
      <FeedbackForm idPrefix="settings-feedback" onSubmit={onFeedback} />
    </section>}
    <section className="preview-card"><div><span className="preview-label">DEVICE COPY</span><h2>Export or import</h2><p>Download a full backup (JSON) or your sets as a spreadsheet (CSV), or merge a backup from another device.</p></div>
      <div className="button-row"><button className="secondary-button" onClick={onExport}>Export JSON</button><button className="secondary-button" onClick={onExportCsv} disabled={!canExportCsv}>Export CSV</button><label className="secondary-button file-button">Import<input type="file" accept="application/json,.json" aria-label="Import backup file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(onImport); event.target.value = '' }} /></label></div>
    </section>
    <section className="preview-card changelog-card"><div><span className="preview-label">CHANGELOG</span><h2>Changelog</h2></div>
      <ol className="changelog-list">{changelog.map((entry, i) => <li key={`${entry.date}-${i}`}>
        <h3>{entry.version ? `Version ${entry.version} · ` : ''}{formatChangelogDate(entry.date)}</h3>
        <ul>{entry.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      </li>)}</ol>
    </section>
  </section>
}
