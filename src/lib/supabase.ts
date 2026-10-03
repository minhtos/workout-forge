import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, { auth: { detectSessionInUrl: true, persistSession: true } })
  : null

export function requireSupabase() {
  if (!supabase) throw new Error('Cloud backup is not configured for this build.')
  return supabase
}
