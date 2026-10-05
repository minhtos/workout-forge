import { useState } from 'react'
import { credentialsProblem } from '../domain/auth'

type Mode = 'signin' | 'signup' | 'reset'

/** What an auth call reports back: a message to show, and whether it worked. */
export interface AuthResult { ok: boolean; message: string }

interface Props {
  idPrefix: string
  onSignIn: (email: string, password: string) => Promise<AuthResult>
  onSignUp: (email: string, password: string) => Promise<AuthResult>
  onReset: (email: string) => Promise<AuthResult>
}

const copy: Record<Mode, { title: string; lede: string; submit: string }> = {
  signin: { title: 'Welcome back', lede: 'Pick up where your last session left off.', submit: 'Sign in' },
  signup: { title: 'Create your account', lede: 'Back up your training and use it on every device. Free.', submit: 'Create account' },
  reset: { title: 'Reset your password', lede: 'Enter your email and we will send you a link to choose a new password.', submit: 'Email me a reset link' },
}

export function AuthForm({ idPrefix, onSignIn, onSignUp, onReset }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<AuthResult | null>(null)
  const [busy, setBusy] = useState(false)
  const text = copy[mode]

  function switchMode(next: Mode) { setMode(next); setResult(null) }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = mode === 'reset' ? credentialsProblem(email, 'x', false) : credentialsProblem(email, password, mode === 'signup')
    if (problem) { setResult({ ok: false, message: problem }); return }
    setBusy(true)
    const outcome = mode === 'signin' ? await onSignIn(email.trim(), password) : mode === 'signup' ? await onSignUp(email.trim(), password) : await onReset(email.trim())
    setBusy(false)
    setResult(outcome)
    if (outcome.ok && mode !== 'reset') setPassword('')
  }

  return <div className="auth-card">
    {mode !== 'reset' && <div className="auth-tabs" role="tablist" aria-label="Account">
      <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'auth-tab on' : 'auth-tab'} onClick={() => switchMode('signin')}>Sign in</button>
      <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'auth-tab on' : 'auth-tab'} onClick={() => switchMode('signup')}>Create account</button>
    </div>}
    <h2 className="auth-title">{text.title}</h2>
    <p className="auth-lede">{text.lede}</p>
    <form onSubmit={(event) => void submit(event)} noValidate>
      <div className="field"><label htmlFor={`${idPrefix}-email`}>Email</label><input id={`${idPrefix}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      {mode !== 'reset' && <div className="field"><label htmlFor={`${idPrefix}-password`}>Password</label><input id={`${idPrefix}-password`} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></div>}
      {result && <p className={result.ok ? 'form-ok' : 'form-error'} role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
      <button className="primary-button wide" type="submit" disabled={busy}>{busy ? 'One moment…' : text.submit}</button>
    </form>
    {mode === 'signin' && <p className="auth-aside"><button type="button" className="link-button" onClick={() => switchMode('reset')}>Forgot your password?</button></p>}
    {mode === 'reset' && <p className="auth-aside"><button type="button" className="link-button" onClick={() => switchMode('signin')}>Back to sign in</button></p>}
  </div>
}
