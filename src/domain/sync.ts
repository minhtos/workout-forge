import type { SupabaseClient } from '@supabase/supabase-js'
import { createCompletedWorkoutBackup, mergeBackupSets, parseRemoteBackups } from './backup'
import type { CompletedSetRecord } from './storage'

type DataClient = Pick<SupabaseClient, 'from'>

export async function backupSession(client: DataClient, userId: string, sessionId: string, sets: CompletedSetRecord[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const backup = createCompletedWorkoutBackup(sessionId, sets)
  const { error } = await client.from('completed_workout_sessions').insert({ id: backup.id, user_id: userId, completed_at: backup.completedAt, schema_version: backup.schemaVersion, payload: backup })
  if (error && error.code !== '23505') return { ok: false, message: error.message }
  return { ok: true }
}

export async function restoreSessions(client: DataClient, userId: string, local: CompletedSetRecord[]): Promise<{ history: CompletedSetRecord[]; added: number; skipped: number; message?: string }> {
  const { data, error } = await client.from('completed_workout_sessions').select('payload').eq('user_id', userId).order('completed_at', { ascending: true })
  if (error) return { history: local, added: 0, skipped: 0, message: error.message }
  const { backups, skipped } = parseRemoteBackups(data ?? [])
  const history = mergeBackupSets(local, backups)
  return { history, added: history.length - local.length, skipped }
}
