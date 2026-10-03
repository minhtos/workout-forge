import type { SupabaseClient } from '@supabase/supabase-js'
import { createCompletedWorkoutBackup } from './backup'
import type { CompletedSetRecord } from './storage'

type InsertClient = Pick<SupabaseClient, 'from'>

export async function backupSession(client: InsertClient, userId: string, sessionId: string, sets: CompletedSetRecord[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const backup = createCompletedWorkoutBackup(sessionId, sets)
  const { error } = await client.from('completed_workout_sessions').insert({
    id: backup.id,
    user_id: userId,
    completed_at: backup.completedAt,
    schema_version: backup.schemaVersion,
    payload: backup,
  })
  if (error && error.code !== '23505') return { ok: false, message: error.message }
  return { ok: true }
}
