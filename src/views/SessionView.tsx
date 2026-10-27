import { useState } from 'react'
import { RestTimer } from './RestTimer'
import { findPersonalRecord, type PersonalRecord } from '../domain/personalRecord'
import type { RepNotice } from '../domain/repAdjust'
import { describeLastSession, lastSessionSets, maxSetsPerExercise, previousSessionSets, suggestionText, type TuneContext } from '../domain/session'
import type { ExercisePrescription, ScheduledWorkout } from '../domain/program'
import type { ActiveSession, CompletedSetRecord, SetEntry } from '../domain/storage'

const repOptions = Array.from({ length: 30 }, (_, index) => index + 1)

const recordText = ({ set, unit, margin, previous }: PersonalRecord) => unit === 'reps'
  ? `${set.reps} reps, ${margin} more than your previous best of ${previous.reps}.`
  : `${set.weight} lb × ${set.reps}: estimated max up ${margin} lb on ${previous.weight} lb × ${previous.reps}.`

interface Props {
  workout: ScheduledWorkout
  session: ActiveSession
  history: CompletedSetRecord[]
  syncLabel: string
  restTimer: boolean
  tune: TuneContext
  /** A note per exercise after a weight edit rescaled its reps (or hit a limit). */
  repNotices: Record<string, RepNotice | null>
  error: string
  /** Exercises whose personal-record banner was dismissed this session. */
  dismissedPrs: Record<string, boolean>
  onDismissPr: (exerciseId: string) => void
  onBack: () => void
  onUpdate: (exerciseId: string, index: number, patch: Partial<SetEntry>) => void
  /** Returns true when checking the set recorded it (false when it was undone or rejected). */
  onToggle: (exercise: ExercisePrescription, index: number) => boolean
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string) => void
  onSkip: (exerciseId: string) => void
  /** True when the exercise was scheduled and finished since its last logged session without being logged. */
  skippedLast: (exerciseId: string) => boolean
  onRestore: (exerciseId: string) => void
  onFinish: () => void
  onDiscard: () => void
}

export function SessionView({ workout, session, history, syncLabel, restTimer, tune, repNotices, error, dismissedPrs, onDismissPr, onBack, onUpdate, onToggle, onAddSet, onRemoveSet, onSkip, onRestore, skippedLast, onFinish, onDiscard }: Props) {
  const linear = workout.progression === 'linear'
  const skipped = session.skipped ?? []
  const entries = Object.entries(session.sets).filter(([id]) => !skipped.includes(id)).flatMap(([, rows]) => rows)
  const done = entries.filter((entry) => entry.complete).length
  // Motion shows what just happened: the check pulses only on the set completed in this mount, and a record banner that was already
  // showing when the view opened (resume, tab return) appears without its entrance.
  const [justDone, setJustDone] = useState<string | null>(null)
  const [bannersAtOpen] = useState(() => new Set(workout.exercises.filter((exercise) => !dismissedPrs[exercise.id] && findPersonalRecord(history, session.sessionId, exercise.id)).map((exercise) => exercise.id)))
  return <section className="session-view" aria-labelledby="session-title">
    <button className="back-link" onClick={onBack}>← Back</button>
    <div className="session-header"><div><div className="eyebrow">WEEK {workout.weekNumber} · {workout.target.kind === 'deload' ? 'DELOAD' : linear ? 'ADD WEIGHT EACH SESSION' : `${workout.target.targetRir} RIR TARGET`}</div><h1 id="session-title">{workout.title}</h1><p>Each set saves the moment you check it off.</p></div>{!linear && <div className="rir-pill">RIR {workout.target.targetRir}</div>}</div>
    {workout.exercises.map((exercise, exerciseIndex) => {
      const last = lastSessionSets(history, exercise.id, session.sessionId)
      const rows = session.sets[exercise.id] ?? []
      const current = rows.findIndex((row) => !row.complete)
      const prefix = exerciseIndex === 0 ? '' : `${exercise.name} `
      const record = dismissedPrs[exercise.id] ? null : findPersonalRecord(history, session.sessionId, exercise.id)
      if (skipped.includes(exercise.id)) return <article className="exercise-card is-skipped" key={exercise.id}>
        <div className="exercise-title"><div><span className="exercise-index">{String(exerciseIndex + 1).padStart(2, '0')}</span><h2>{exercise.name}</h2><p>Skipped for this session. Nothing is logged for it.</p></div></div>
        <div className="set-actions"><button className="add-set" aria-label={`Restore ${exercise.name}`} onClick={() => onRestore(exercise.id)}>Restore exercise</button></div>
      </article>
      return <article className="exercise-card" key={exercise.id}>
        <div className="exercise-title"><div><span className="exercise-index">{String(exerciseIndex + 1).padStart(2, '0')}</span><h2>{exercise.name}</h2><p>{rows.length || exercise.sets} {(rows.length || exercise.sets) === 1 ? 'set' : 'sets'} × {exercise.repRange.min === exercise.repRange.max ? exercise.repRange.min : `${exercise.repRange.min}–${exercise.repRange.max}`} reps{linear ? '' : ` · RIR ${workout.target.targetRir}`}</p></div></div>
        {last.length > 0 && <p className="last-time">Last time: {describeLastSession(last)}</p>}
        <p className="suggestion">{suggestionText(exercise, workout, last, tune, previousSessionSets(history, exercise.id, session.sessionId), skippedLast(exercise.id))}</p>
        <div className="set-table set-table-rir" role="table" aria-label={`${exercise.name} set log`}>
          <div className="set-head" role="row"><span>SET</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div>
          {rows.map((set, index) => <div className={set.complete ? 'set-row is-done' : index === current ? 'set-row is-current' : 'set-row'} role="row" key={index}>
            <span className="set-no">{index + 1}{set.complete && last[index] && Number(set.weight) > last[index].weight && <small className="delta" aria-label={`${Number(set.weight) - last[index].weight} lb more than last time`}>+{Number(set.weight) - last[index].weight}</small>}</span>
            <label><input aria-label={`${prefix}Set ${index + 1} weight`} value={set.weight} inputMode="decimal" placeholder="0" disabled={set.complete} onChange={(event) => onUpdate(exercise.id, index, { weight: event.target.value })} /><em>lb</em></label>
            <select aria-label={`${prefix}Set ${index + 1} reps`} value={set.reps} disabled={set.complete} onChange={(event) => onUpdate(exercise.id, index, { reps: event.target.value })}>{repOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <button className={set.complete ? (justDone === `${exercise.id}-${index}` ? 'check done just-done' : 'check done') : 'check'} aria-pressed={set.complete} aria-label={set.complete ? `Undo ${prefix}set ${index + 1}` : `Complete ${prefix}set ${index + 1}`} onClick={() => { const recorded = onToggle(exercise, index); setJustDone(recorded ? `${exercise.id}-${index}` : null); if (recorded) navigator.vibrate?.(10) }}>{set.complete ? '✓' : ''}</button>
          </div>)}
        </div>
        {record && <div className={bannersAtOpen.has(exercise.id) ? 'pr-banner' : 'pr-banner pr-enter'} role="status"><p><strong>PERSONAL RECORD</strong>{recordText(record)}</p><button aria-label={`Dismiss personal record for ${exercise.name}`} onClick={() => onDismissPr(exercise.id)}>✕</button></div>}
        {repNotices[exercise.id] && <p className={repNotices[exercise.id]?.kind === 'warn' ? 'rep-notice warn' : 'rep-notice'} role="status">{repNotices[exercise.id]?.text}</p>}
        <div className="set-actions">
          <button className="add-set" aria-label={`Add set to ${exercise.name}`} disabled={(session.sets[exercise.id]?.length ?? 0) >= maxSetsPerExercise} onClick={() => onAddSet(exercise.id)}>+ Add set</button>
          <button className="add-set remove" aria-label={`Remove last set from ${exercise.name}`} title="Undo the last set first if it is already checked off" disabled={(session.sets[exercise.id]?.length ?? 0) <= 1 || session.sets[exercise.id]?.at(-1)?.complete === true} onClick={() => onRemoveSet(exercise.id)}>− Remove last set</button>
          <button className="add-set remove" aria-label={`Skip ${exercise.name}`} title="Leave this exercise out of today's workout. Undo any checked sets first." disabled={rows.some((row) => row.complete)} onClick={() => onSkip(exercise.id)}>Skip exercise</button>
        </div>
      </article>
    })}
    {restTimer && <RestTimer completed={done} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="session-footer"><span>{done} / {entries.length} sets saved · {syncLabel}</span><div className="button-row"><button className="secondary-button" onClick={onDiscard}>Discard session</button><button className="primary-button" disabled={!done} onClick={onFinish}>Finish workout <span>→</span></button></div></div>
  </section>
}
