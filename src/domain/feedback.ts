/** Validation for the public feedback form. Kept tiny and pure so the form and tests share it. */

export const maxFeedbackLength = 2000
export const minFeedbackLength = 3

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns a human-readable problem with a feedback submission, or null when it can be sent.
 * The email is optional — it only exists so we can reply — but when given it must look real.
 */
export function feedbackProblem(message: string, email: string): string | null {
  const text = message.trim()
  if (text.length < minFeedbackLength) return 'Tell us a little more — a sentence is plenty.'
  if (text.length > maxFeedbackLength) return `Keep it under ${maxFeedbackLength} characters — the short version is the useful one.`
  const address = email.trim()
  if (address && !emailShape.test(address)) return 'That email does not look right — check it, or leave the field empty.'
  return null
}
