import { z } from 'zod'
import type { CompletedSetRecord } from './storage'

export interface CompletedWorkoutBackup { id: string; completedAt: string; schemaVersion: 1; sets: CompletedSetRecord[] }

const completedSetSchema = z.object({
  id: z.string().min(1), sessionId: z.string().uuid(), workoutId: z.string().min(1), exerciseId: z.string().min(1), exerciseName: z.string().min(1), setIndex: z.number().int().positive(), weight: z.number().nonnegative(), reps: z.number().int().positive(), rir: z.number().min(1).max(10), weightUnit: z.literal('lb'), completedAt: z.string().datetime(), weekNumber: z.number().int().positive(), repRange: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }), targetRir: z.number(),
})
const backupSchema = z.object({ id: z.string().uuid(), completedAt: z.string().datetime(), schemaVersion: z.literal(1), sets: z.array(completedSetSchema).min(1) })

export function createCompletedWorkoutBackup(sessionId: string, sets: CompletedSetRecord[]): CompletedWorkoutBackup {
  if (!sets.length) throw new Error('A backup requires completed sets.')
  return { id: sessionId, completedAt: sets.reduce((latest, set) => latest > set.completedAt ? latest : set.completedAt, sets[0].completedAt), schemaVersion: 1, sets }
}

export function parseRemoteBackups(rows: unknown[]): { backups: CompletedWorkoutBackup[]; skipped: number } {
  const backups: CompletedWorkoutBackup[] = []
  let skipped = 0
  for (const row of rows) {
    const payload = typeof row === 'object' && row !== null && 'payload' in row ? (row as { payload: unknown }).payload : undefined
    const parsed = backupSchema.safeParse(payload)
    if (parsed.success) backups.push(parsed.data)
    else skipped += 1
  }
  return { backups, skipped }
}

export function mergeBackupSets(local: CompletedSetRecord[], backups: CompletedWorkoutBackup[]): CompletedSetRecord[] {
  const result = new Map(local.map((set) => [set.id, set]))
  for (const backup of backups) for (const set of backup.sets) if (!result.has(set.id)) result.set(set.id, set)
  return [...result.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt))
}
