import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { muscleGroups, type Block, type ExerciseCatalogItem } from './program'
import { mergeFeedback, type SessionFeedback } from './autoregulation'
import type { SavedWorkoutState } from './storage'

type DataClient = Pick<SupabaseClient, 'from'>
const table = 'user_programs'

/** Everything about a person's program that should follow them between devices. */
export interface ProgramSnapshot {
  block: Block | null
  customExercises: ExerciseCatalogItem[]
  hiddenExerciseIds: string[]
  feedback: SessionFeedback[]
  updatedAt: string
}

const group = z.enum(muscleGroups as [string, ...string[]])
const planExercise = z.object({ exerciseId: z.string().min(1).nullable(), category: group.optional(), sets: z.number().int().min(1).max(10), reps: z.number().int().min(1).max(100).optional() })
const blockSchema = z.object({
  trainingDays: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  durationWeeks: z.union([z.literal(4), z.literal(6)]),
  templates: z.array(z.object({ title: z.string().max(60), exercises: z.array(planExercise).max(12) })).min(1).max(4),
  progression: z.enum(['rir', 'linear']),
  rotation: z.boolean(),
  workoutSetId: z.string().nullable(),
  startOffsets: z.record(z.string(), z.number().int().min(-10).max(10)).optional(),
  locked: z.boolean(),
  startedAt: z.string().nullable(),
  completedIds: z.array(z.string()).max(100),
  skippedIds: z.array(z.string()).max(100),
})
const feedbackSchema = z.object({
  sessionId: z.string().min(1), blockId: z.string().min(1), group, at: z.string().datetime(),
  soreness: z.enum(['sore', 'ontime', 'early']).optional(), effort: z.enum(['easy', 'right', 'hard']).optional(), pump: z.enum(['low', 'high']).optional(), summaryDone: z.boolean().optional(),
})
const snapshotSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  block: blockSchema.nullable(),
  customExercises: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(60), category: group, compound: z.boolean().optional() })).max(500),
  hiddenExerciseIds: z.array(z.string()).max(1000),
  feedback: z.array(feedbackSchema).max(2000).default([]),
})

export const hasProgramContent = (state: Pick<SavedWorkoutState, 'block' | 'customExercises' | 'hiddenExerciseIds'>): boolean =>
  state.block !== null || state.customExercises.length > 0 || state.hiddenExerciseIds.length > 0

export function parseProgramSnapshot(payload: unknown): ProgramSnapshot | null {
  const parsed = snapshotSchema.safeParse(payload)
  if (!parsed.success) return null
  const { version: _version, ...rest } = parsed.data
  return rest as ProgramSnapshot
}

export type SyncDecision = 'push' | 'adopt' | 'none'

/** Last write wins. A device that has never synced (no timestamp) defers to what the cloud has. */
export function decideSync(localUpdatedAt: string | null, localHasContent: boolean, remote: ProgramSnapshot | null): SyncDecision {
  if (!remote) return localHasContent ? 'push' : 'none'
  if (!localUpdatedAt) return 'adopt'
  const local = Date.parse(localUpdatedAt)
  const cloud = Date.parse(remote.updatedAt)
  if (cloud > local) return 'adopt'
  return local > cloud ? 'push' : 'none'
}

export async function pullProgram(client: DataClient, userId: string): Promise<{ snapshot: ProgramSnapshot | null } | { error: string }> {
  const { data, error } = await client.from(table).select('payload').eq('user_id', userId).maybeSingle()
  if (error) return { error: error.message }
  return { snapshot: data ? parseProgramSnapshot((data as { payload: unknown }).payload) : null }
}

export async function pushProgram(client: DataClient, userId: string, snapshot: ProgramSnapshot): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await client.from(table).upsert({ user_id: userId, updated_at: snapshot.updatedAt, schema_version: 1, payload: { version: 1, ...snapshot } }, { onConflict: 'user_id' })
  return error ? { ok: false, message: error.message } : { ok: true }
}

export type SyncOutcome =
  | { kind: 'none' }
  | { kind: 'pushed'; updatedAt: string }
  | { kind: 'adopted'; snapshot: ProgramSnapshot }
  /** The cloud has a newer program, but a workout is in progress, so it waits until that is finished. */
  | { kind: 'deferred' }
  | { kind: 'error'; message: string }

/** Compares this device's program with the cloud copy and either uploads, downloads, or does nothing. */
export async function runProgramSync(client: DataClient, userId: string, local: SavedWorkoutState, nowIso: string): Promise<SyncOutcome> {
  const pulled = await pullProgram(client, userId)
  if ('error' in pulled) return { kind: 'error', message: pulled.error }
  const decision = decideSync(local.programUpdatedAt, hasProgramContent(local), pulled.snapshot)
  if (decision === 'none') return { kind: 'none' }
  if (decision === 'adopt' && pulled.snapshot) return local.activeSession ? { kind: 'deferred' } : { kind: 'adopted', snapshot: pulled.snapshot }
  const updatedAt = local.programUpdatedAt ?? nowIso
  const pushed = await pushProgram(client, userId, { block: local.block, customExercises: local.customExercises, hiddenExerciseIds: local.hiddenExerciseIds, feedback: local.feedback, updatedAt })
  return pushed.ok ? { kind: 'pushed', updatedAt } : { kind: 'error', message: pushed.message }
}

export function applyProgramSnapshot(state: SavedWorkoutState, snapshot: ProgramSnapshot): SavedWorkoutState {
  return { ...state, block: snapshot.block, customExercises: snapshot.customExercises, hiddenExerciseIds: snapshot.hiddenExerciseIds, feedback: mergeFeedback(state.feedback, snapshot.feedback), programUpdatedAt: snapshot.updatedAt }
}
