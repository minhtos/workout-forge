import { useMemo, useState } from 'react'
import { exerciseOptions, rangeOptions, rangeStart, sessionPoints, trainedGroups, weeklyBuckets, type RangeWeeks, type SessionPoint, type WeekBucket } from '../domain/charts'
import type { ExerciseCatalogItem, MuscleGroup } from '../domain/program'
import type { CompletedSetRecord } from '../domain/storage'
import { ColumnChart, TrendChart } from './Charts'

interface Props { history: CompletedSetRecord[]; catalog: ExerciseCatalogItem[]; finished: number; total: number }

const lb = (value: number) => `${Math.round(value).toLocaleString('en-US')} lb`

const amount = (value: number, unit: SessionPoint['unit']) => (unit === 'lb' ? lb(value) : `${Math.round(value)} reps`)

const trendSummary = (name: string, points: SessionPoint[]) => {
  const first = points[0]
  const last = points[points.length - 1]
  return `${first.unit === 'lb' ? 'Estimated max' : 'Best set'} for ${name}: ${points.length} sessions, from ${amount(first.value, first.unit)} on ${first.label} to ${amount(last.value, last.unit)} on ${last.label}.`
}
const weeklySummary = (buckets: WeekBucket[], scope: string) => {
  const total = buckets.reduce((sum, bucket) => sum + bucket.sets, 0)
  return `Sets per week for ${scope}: ${total} sets over the last ${buckets.length} weeks. The table below lists every week.`
}

export function ProgressView({ history, catalog, finished, total }: Props) {
  const [now] = useState(() => new Date())
  const [weeks, setWeeks] = useState<RangeWeeks>(12)
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all')
  const [exerciseId, setExerciseId] = useState<string | null>(null)

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

  const from = rangeStart(weeks, now).getTime()
  const scope = group === 'all' ? null : group
  const groups = useMemo(() => trainedGroups(history, catalog), [history, catalog])
  const options = useMemo(() => exerciseOptions(history, catalog, scope, from), [history, catalog, scope, from])
  const selected = options.find((option) => option.id === exerciseId) ?? options[0]
  const points = useMemo(() => (selected ? sessionPoints(history, selected.id, from) : []), [history, selected, from])
  const buckets = useMemo(() => weeklyBuckets(history, catalog, scope, weeks, now), [history, catalog, scope, weeks, now])
  const weeklyTotal = buckets.reduce((sum, bucket) => sum + bucket.sets, 0)

  const first = points[0]
  const last = points[points.length - 1]
  const unit = first?.unit ?? 'lb'
  const change = points.length > 1 ? Math.round(last.value) - Math.round(first.value) : null
  const bestSet = points.reduce<SessionPoint | null>((best, point) => (!best || point.topWeight > best.topWeight || (point.topWeight === best.topWeight && point.topReps > best.topReps) ? point : best), null)

  return <section className="workspace" aria-labelledby="progress-title">
    <div className="workspace-heading"><div><div className="eyebrow">TRAINING DATA</div><h1 id="progress-title">Progress, without the noise.</h1><p>Every completed set is saved the moment you log it.</p></div></div>
    <div className="metrics-grid">
      <article><span>THIS BLOCK</span><strong>{finished}<small> / {total}</small></strong><p>workouts done</p></article>
      <article><span>LOGGED SETS</span><strong>{history.length}</strong><p>all time</p></article>
      <article><span>TOTAL VOLUME</span><strong>{volume.toLocaleString()}<small> lb</small></strong><p>weight × reps, all time</p></article>
    </div>

    {history.length > 0 && <>
      <div className="chart-filters" role="group" aria-label="Chart filters">
        <div className="segmented" role="group" aria-label="Time range">{rangeOptions.map((value) => <button key={value} aria-pressed={weeks === value} onClick={() => setWeeks(value)}>{value} weeks</button>)}</div>
        <label className="filter"><span>Muscle group</span><select aria-label="Muscle group" value={group} onChange={(event) => setGroup(event.target.value as MuscleGroup | 'all')}><option value="all">All muscle groups</option>{groups.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="filter"><span>Exercise</span><select aria-label="Exercise" value={selected?.id ?? ''} disabled={!options.length} onChange={(event) => setExerciseId(event.target.value)}>{options.length === 0 && <option value="">No exercises in range</option>}{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      </div>

      <section className="chart-card" aria-labelledby="trend-title">
        <h2 id="trend-title">{unit === 'lb' ? 'Estimated max' : 'Best set'}{selected ? `: ${selected.name}` : ''}</h2>
        <p className="chart-sub">{unit === 'lb' ? 'Best set of each session, from your reps and the reps you left in reserve. Deload weeks are left out.' : 'Most reps in a single set each session. Bodyweight exercises have no weight to estimate a max from. Deload weeks are left out.'}</p>
        {selected && points.length > 0 ? <>
          <div className="stat-row">
            <div className="stat"><span>Current</span><strong>{amount(last.value, unit)}</strong></div>
            <div className="stat"><span>Over {weeks} weeks</span><strong className={change === null || change === 0 ? '' : change > 0 ? 'up' : 'down'}>{change === null ? 'First session' : `${change > 0 ? '+' : ''}${change} ${unit}`}</strong></div>
            <div className="stat"><span>Best set</span><strong>{!bestSet ? '—' : unit === 'lb' ? `${bestSet.topWeight} × ${bestSet.topReps}` : `${bestSet.topReps} reps`}</strong></div>
          </div>
          {points.length > 1
            ? <TrendChart points={points} summary={trendSummary(selected.name, points)} />
            : <p className="chart-empty">Log {selected.name} again to see a trend. One session so far: {amount(last.value, unit)} on {last.label}.</p>}
          <details className="chart-table"><summary>Table view</summary>
            <table><thead><tr><th>Date</th><th>Week</th><th>Top set</th><th>{unit === 'lb' ? 'Estimated max' : 'Best set'}</th></tr></thead><tbody>{points.map((point) => <tr key={point.sessionId}><td>{point.label}</td><td>{point.weekNumber}</td><td>{point.topWeight ? `${point.topWeight} × ${point.topReps}` : `Bodyweight × ${point.topReps}`}</td><td>{amount(point.value, point.unit)}</td></tr>)}</tbody></table>
          </details>
        </> : <p className="chart-empty">{history.length ? 'No sessions in this range. Try a longer range or another muscle group.' : ''}</p>}
      </section>

      <section className="chart-card" aria-labelledby="weekly-title">
        <h2 id="weekly-title">Sets per week{scope ? `: ${scope}` : ''}</h2>
        <p className="chart-sub">Every completed set, including deload weeks. Hover or tap a column for the week's volume.</p>
        {weeklyTotal > 0
          ? <ColumnChart buckets={buckets} summary={weeklySummary(buckets, scope ?? 'all muscle groups')} />
          : <p className="chart-empty">No sets in this range. Try a longer range or another muscle group.</p>}
        <details className="chart-table"><summary>Table view</summary>
          <table><thead><tr><th>Week of</th><th>Sets</th><th>Volume</th></tr></thead><tbody>{buckets.map((bucket) => <tr key={bucket.label}><td>{bucket.label}</td><td>{bucket.sets}</td><td>{lb(bucket.volume)}</td></tr>)}</tbody></table>
        </details>
      </section>
    </>}

    <section className="progress-empty"><span>LATEST COMPLETED SET</span>{latest ? <><h2>{latest.exerciseName}: {latest.weight} lb × {latest.reps}</h2><p>Week {latest.weekNumber}, target RIR {latest.targetRir}.</p></> : <><h2>Your first completed set starts the record.</h2><p>Start a workout and log weight and reps.</p></>}</section>
    {exercises.length > 0 && <section className="progress-empty"><span>BY EXERCISE</span><table className="exercise-table"><thead><tr><th>Exercise</th><th>Last set</th><th>Best set</th><th>Sets</th></tr></thead><tbody>{exercises.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.newest.weight}×{row.newest.reps}</td><td>{row.best.weight}×{row.best.reps}</td><td>{row.sets}</td></tr>)}</tbody></table></section>}
  </section>
}
