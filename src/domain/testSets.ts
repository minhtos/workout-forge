import type { CompletedSetRecord } from './storage'

/** Test helper: a completed-set record with sensible defaults (100 lb × 10 of bench press, 2 RIR). */
export const set = (sessionId: string, setIndex: number, at: Date, patch: Partial<CompletedSetRecord> = {}): CompletedSetRecord => ({
  id: `${sessionId}-${setIndex}-${patch.exerciseId ?? 'barbell-bench-press'}`, sessionId, workoutId: 'w1-d1', exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', setIndex, weight: 100, reps: 10, rir: 2, weightUnit: 'lb', completedAt: at.toISOString(), weekNumber: 1, repRange: { min: 6, max: 12 }, targetRir: 2, targetReps: 10, ...patch,
})
