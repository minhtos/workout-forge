import { supabase } from './supabase'
import type { AuthResult } from '../views/AuthForm'

/**
 * Sends one feedback message to the `feedback` table (see supabase/migrations).
 * The table is insert-only for the public roles: anyone can leave a note,
 * nobody can read, edit or delete notes through the app. Signed-in users are
 * linked to their account so a reply can find them; anonymous notes stay anonymous.
 */
export async function submitFeedback(message: string, email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: 'Feedback is not available in this build.' }
  try {
    const { data } = await supabase.auth.getUser()
    const { error } = await supabase.from('feedback').insert({
      message: message.trim(),
      email: email.trim() || null,
      user_id: data.user?.id ?? null,
    })
    if (error) return { ok: false, message: 'That did not send. Check your connection and try again.' }
    return { ok: true, message: 'Sent — thank you. Feedback is read by a human and shapes what gets built next.' }
  } catch {
    return { ok: false, message: 'That did not send. Check your connection and try again.' }
  }
}
