import type { ExerciseCatalogItem } from './program'
import type { CompletedSetRecord } from './storage'

const columns = ['date', 'completed_at', 'workout_id', 'week', 'deload', 'exercise', 'exercise_id', 'muscle_group', 'set', 'weight', 'unit', 'reps', 'target_reps', 'rep_min', 'rep_max', 'target_rir', 'session_id']

/** Local YYYY-MM-DD for a stored ISO timestamp. */
export function localDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** RFC 4180 quoting. Text starting with = + - @ gets a leading quote so spreadsheets do not run it as a formula. */
function cell(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value)
  const safe = typeof value === 'string' && /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * One row per completed set, oldest first. The stored rir is left out on purpose: it is prefilled with the week's
 * target, not measured. Starts with a UTF-8 BOM so Excel reads custom exercise names correctly.
 */
export function toCsv(history: CompletedSetRecord[], catalog: ExerciseCatalogItem[], formatDate: (iso: string) => string = localDate): string {
  const groups = new Map(catalog.map((item) => [item.id, item.category]))
  const sorted = [...history].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.setIndex - b.setIndex)
  const lines = sorted.map((s) => [
    formatDate(s.completedAt), s.completedAt, s.workoutId, s.weekNumber, !!s.deload, s.exerciseName, s.exerciseId, groups.get(s.exerciseId) ?? '',
    s.setIndex, s.weight, s.weightUnit, s.reps, s.targetReps, s.repRange.min, s.repRange.max, s.targetRir, s.sessionId,
  ].map(cell).join(','))
  return `﻿${[columns.join(','), ...lines].map((line) => `${line}\r\n`).join('')}`
}
