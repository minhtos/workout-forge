export const minPasswordLength = 8

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The first problem with a sign-in or sign-up form, or null when it can be submitted. */
export function credentialsProblem(email: string, password: string, needsStrongPassword: boolean): string | null {
  if (!emailShape.test(email.trim())) return 'Enter a valid email address.'
  if (!password) return 'Enter your password.'
  if (needsStrongPassword && password.length < minPasswordLength) return `Use at least ${minPasswordLength} characters for your password.`
  return null
}

/** Supabase auth messages rewritten for people, without revealing whether an email has an account. */
export function authMessage(error: { message: string; code?: string }): string {
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase()
  if (text.includes('invalid_credentials') || text.includes('invalid login')) return 'Email or password is incorrect.'
  if (text.includes('email_not_confirmed') || text.includes('not confirmed')) return 'Confirm your email first. Check your inbox for the link we sent.'
  if (text.includes('weak_password') || text.includes('password should')) return `Choose a stronger password (at least ${minPasswordLength} characters).`
  if (text.includes('over_email_send_rate_limit') || text.includes('rate limit') || text.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
  if (text.includes('same_password') || text.includes('different from the old')) return 'Choose a password you have not used before.'
  return error.message
}
