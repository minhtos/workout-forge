import { useState } from 'react'
import { credentialsProblem } from '../domain/auth'
import type { AuthResult } from './AuthForm'

/** Shown after someone follows a password-reset email link. */
export function ResetPasswordView({ onSubmit }: { onSubmit: (password: string) => Promise<AuthResult> }) {
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<AuthResult | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = credentialsProblem('a@b.co', password, true)
    if (problem) { setResult({ ok: false, message: problem }); return }
    setBusy(true)
    setResult(await onSubmit(password))
    setBusy(false)
  }
  return <section className="onboarding" aria-labelledby="reset-title">
    <div className="auth-card standalone">
      <h1 id="reset-title" className="auth-title">Choose a new password</h1>
      <p className="auth-lede">You are signed in through your reset link. Pick a password you will use from now on.</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        {result && <p className={result.ok ? 'form-ok' : 'form-error'} role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
        <button className="primary-button wide" type="submit" disabled={busy}>{busy ? 'One moment…' : 'Save password'}</button>
      </form>
    </div>
  </section>
}
