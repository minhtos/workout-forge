import type { ScheduledWorkout } from '../domain/program'

interface Props {
  workout: ScheduledWorkout | null
  trainingDays: number
  totalWeeks: number
  finished: number
  total: number
  resuming: boolean
  onStart: () => void
  onSkip: () => void
  onNewBlock: () => void
}

export function TodayView({ workout, trainingDays, totalWeeks, finished, total, resuming, onStart, onSkip, onNewBlock }: Props) {
  const progress = <div className="progress-line" aria-label={`${finished} of ${total} workouts done`}><span style={{ width: `${total ? finished / total * 100 : 0}%` }} /></div>
  if (!workout) return <section className="workspace" aria-labelledby="today-title">
    <div className="eyebrow">BLOCK COMPLETE</div><h1 id="today-title">Block finished. Nice work.</h1><p className="lede">{finished} of {total} workouts done. Set up your next block when you're ready.</p>{progress}
    <button className="primary-button" onClick={onNewBlock}>Plan next block <span>→</span></button>
  </section>
  return <section className="workspace" aria-labelledby="today-title">
    <div className="eyebrow">WEEK {workout.weekNumber} OF {totalWeeks}{workout.target.kind === 'deload' ? ' · DELOAD' : ''} · DAY {workout.dayIndex + 1} OF {trainingDays}</div>
    <h1 id="today-title">{workout.title}</h1>
    <p className="lede">{workout.target.kind === 'deload' ? 'Deload week: go light, about half your last load, and stop well short of failure.' : `Target: ${workout.target.targetRir} reps in reserve on every set.`}</p>
    {progress}
    <div className="workout-list">{workout.exercises.map((exercise, index) => <article className="workout-card" key={exercise.id}><div className="session-number">{String(index + 1).padStart(2, '0')}</div><div className="workout-info"><span>{exercise.category}</span><h2>{exercise.name}</h2><p>{exercise.sets} sets × {exercise.repRange.min}–{exercise.repRange.max} reps</p></div></article>)}</div>
    <div className="session-footer"><button className="secondary-button" onClick={onSkip}>Skip this workout</button><button className="primary-button" onClick={onStart}>{resuming ? 'Resume workout' : 'Start workout'} <span>→</span></button></div>
  </section>
}
