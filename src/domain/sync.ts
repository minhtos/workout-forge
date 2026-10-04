import type { SupabaseClient } from '@supabase/supabase-js'
import { createCompletedWorkoutBackup, mergeBackupSets, parseRemoteBackups } from './backup'
import type { CompletedSetRecord } from './storage'

type DataClient = Pick<SupabaseClient, 'from'>
const table = 'completed_workout_sessions'

/** Writes the full current set list for a session. Safe to call after every set: it upserts, and removes the row when the session has no sets left. */
export async function backupSession(client: DataClient, userId: string, sessionId: string, sets: CompletedSetRecord[]): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!sets.length) {
    const { error } = await client.from(table).delete().eq('id', sessionId).eq('user_id', userId)
    return error ? { ok: false, message: error.message } : { ok: true }
  }
  const backup = createCompletedWorkoutBackup(sessionId, sets)
  const { error } = await client.from(table).upsert({ id: backup.id, user_id: userId, completed_at: backup.completedAt, schema_version: backup.schemaVersion, payload: backup }, { onConflict: 'id' })
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function restoreSessions(client: DataClient, userId: string, local: CompletedSetRecord[]): Promise<{ history: CompletedSetRecord[]; added: number; skipped: number; message?: string }> {
  const { data, error } = await client.from(table).select('payload').eq('user_id', userId).order('completed_at', { ascending: true })
  if (error) return { history: local, added: 0, skipped: 0, message: error.message }
  const { backups, skipped } = parseRemoteBackups(data ?? [])
  const history = mergeBackupSets(local, backups)
  return { history, added: history.length - local.length, skipped }
}
