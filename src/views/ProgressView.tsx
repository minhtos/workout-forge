import { useMemo } from 'react'
import type { CompletedSetRecord } from '../domain/storage'

interface Props { history: CompletedSetRecord[]; finished: number; total: number }

export function ProgressView({ history, finished, total }: Props) {
  const volume = useMemo(() => history.reduce((sum, set) => sum + set.weight * set.reps, 0), [history])
  const latest = useMemo(() => [...history].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0], [history])
  const exercises = useMemo(() => {
    const byExercise = new Map<string, CompletedSetRecord[]>()
    for (const set of history) byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set])
    return [...byExercise.values()].map((sets) => {
      const newest = sets.reduce((a, b) => (b.completedAt > a.completedAt ? b : a))
      const best = sets.reduce((a, b) => (b.weight * b.reps > a.weight * a.reps ? b : a))
      return { id: newest.exerciseId, name: newest.exerciseName, sets: sets.length, newest, best }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [history])

  return <section className="workspace" aria-labelledby="progress-title">
    <div className="workspace-heading"><div><div className="eyebrow">TRAINING DATA</div><h1 id="progress-title">Progress, without the noise.</h1><p>Every completed set is saved the moment you log it.</p></div></div>
    <div className="metrics-grid">
      <article><span>THIS BLOCK</span><strong>{finished}<small> / {total}</small></strong><p>workouts done</p></article>
      <article><span>LOGGED SETS</span><strong>{history.length}</strong><p>all time</p></article>
      <article><span>TOTAL VOLUME</span><strong>{volume.toLocaleString()}<small> lb</small></strong><p>weight × reps, all time</p></article>
    </div>
    <section className="progress-empty"><span>LATEST COMPLETED SET</span>{latest ? <><h2>{latest.exerciseName}: {latest.weight} lb × {latest.reps}</h2><p>Week {latest.weekNumber}, target RIR {latest.targetRir}.</p></> : <><h2>Your first completed set starts the record.</h2><p>Start a workout and log weight and reps.</p></>}</section>
    {exercises.length > 0 && <section className="progress-empty"><span>BY EXERCISE</span><table className="exercise-table"><thead><tr><th>Exercise</th><th>Last set</th><th>Best set</th><th>Sets</th></tr></thead><tbody>{exercises.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.newest.weight}×{row.newest.reps}</td><td>{row.best.weight}×{row.best.reps}</td><td>{row.sets}</td></tr>)}</tbody></table></section>}
  </section>
}
