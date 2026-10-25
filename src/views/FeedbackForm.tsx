import { useState } from 'react'
import { feedbackProblem, maxFeedbackLength } from '../domain/feedback'
import type { AuthResult } from './AuthForm'

interface Props {
  idPrefix: string
  onSubmit: (message: string, email: string) => Promise<AuthResult>
}

/**
 * The public feedback form: one message box and an optional reply email.
 * A hidden honeypot field rides along — humans never see it, and a filled
 * honeypot silently "succeeds" without sending anything.
 */
export function FeedbackForm({ idPrefix, onSubmit }: Props) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [result, setResult] = useState<AuthResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = feedbackProblem(message, email)
    if (problem) { setResult({ ok: false, message: problem }); return }
    if (honeypot) { setResult({ ok: true, message: 'Sent — thank you.' }); return }
    setBusy(true)
    const outcome = await onSubmit(message.trim(), email.trim())
    setBusy(false)
    setResult(outcome)
    if (outcome.ok) { setMessage(''); setEmail('') }
  }

  return <form className="feedback-form" onSubmit={(event) => void submit(event)} noValidate>
    <div className="field">
      <label htmlFor={`${idPrefix}-message`}>Your feedback</label>
      <textarea id={`${idPrefix}-message`} rows={4} maxLength={maxFeedbackLength} placeholder="What works, what is missing, what broke — anything helps." value={message} onChange={(event) => setMessage(event.target.value)} />
    </div>
    <div className="field">
      <label htmlFor={`${idPrefix}-email`}>Email <span className="field-optional">(optional — only if you want a reply)</span></label>
      <input id={`${idPrefix}-email`} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
    </div>
    <div className="feedback-honeypot" aria-hidden="true">
      <label htmlFor={`${idPrefix}-company`}>Company</label>
      <input id={`${idPrefix}-company`} type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
    </div>
    {result && <p className={result.ok ? 'form-ok' : 'form-error'} role={result.ok ? 'status' : 'alert'}>{result.message}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
  </form>
}
