import { baseExercises, createBlock, listWorkouts, resolveWorkout, type MuscleGroup, type ScheduledWorkout } from './program'
import type { CompletedSetRecord } from './storage'
import { applyWorkoutSet, findWorkoutSet, workoutSets } from './workoutSets'

/**
 * What the landing page shows. The week is built by the app's own program builder, and the sample history below is
 * made from that week at fixed demo weights, so the visuals on the page are drawn by the same code the app runs on
 * real workouts. Nothing here depends on today's date.
 */
const sampleBlock = applyWorkoutSet(createBlock(3, 6), findWorkoutSet('push-pull-legs') ?? workoutSets.find((set) => set.recommendedDays === 3)!)

/** Week 1 of the ready-made Push | Pull | Legs split. */
export const sampleWeek: ScheduledWorkout[] = listWorkouts(sampleBlock)
  .filter((workout) => workout.weekNumber === 1)
  .map((workout) => resolveWorkout(sampleBlock, workout, baseExercises))

/** Demo working weights (lb) for a muscle group; the barbell bench press is set by hand below. */
const demoWeight: Record<MuscleGroup, number> = { Chest: 95, Back: 90, Shoulders: 55, Triceps: 40, Biceps: 35, Forearms: 30, Quads: 135, Hamstrings: 90, Glutes: 115, Calves: 100, Core: 50 }
const benchId = 'barbell-bench-press'
const benchWeight = { earlier: 135, later: 140 }

/** Sunday 11 Oct 2026, local midnight: the start of the sample week. */
export const sampleWeekStart = new Date(2026, 9, 11)
/** Friday evening of the sample week: "now" for everything the landing page draws. */
export const sampleNow = new Date(2026, 9, 16, 18)
/** The Push session that beats the earlier one. */
export const sampleRecordSessionId = 'sample-push-2'

function sessionSets(sessionId: string, workout: ScheduledWorkout, day: Date, bench: number): CompletedSetRecord[] {
  return workout.exercises.flatMap((exercise, exerciseIndex) => Array.from({ length: exercise.sets }, (_, index): CompletedSetRecord => {
    const reps = exercise.repRange.min + 2
    const weight = exercise.id === benchId ? bench : demoWeight[exercise.category]
    return {
      id: `${sessionId}-${exercise.id}-${index + 1}`, sessionId, workoutId: workout.id, exerciseId: exercise.id, exerciseName: exercise.name, setIndex: index + 1,
      weight, reps, rir: 2, weightUnit: 'lb', completedAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, exerciseIndex * 10 + index * 3).toISOString(),
      weekNumber: 1, repRange: exercise.repRange, targetRir: 2, targetReps: reps,
    }
  }))
}

const [push, pull, legs] = sampleWeek

/** Two Push sessions a week apart (so the bench press has an earlier best to beat), then Pull and Legs in the sample week. */
export const sampleHistory: CompletedSetRecord[] = [
  ...sessionSets('sample-push-1', push, new Date(2026, 9, 5), benchWeight.earlier),
  ...sessionSets(sampleRecordSessionId, push, new Date(2026, 9, 12), benchWeight.later),
  ...sessionSets('sample-pull', pull, new Date(2026, 9, 14), 0),
  ...sessionSets('sample-legs', legs, new Date(2026, 9, 16), 0),
]
