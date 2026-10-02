import { useEffect, useMemo, useState } from 'react'
import { generateProgram, type ExercisePrescription, type ProgramDurationWeeks, type ScheduledWorkout, type TrainingDaysPerWeek } from './domain/program'
import { getNextSetSuggestion } from './domain/progression'
import { loadWorkoutState, saveWorkoutState, type CompletedSetRecord } from './domain/storage'
import './App.css'

type View = 'onboarding' | 'schedule' | 'session' | 'progress'
type SetEntry = { reps: string; weight: string; rpe: string; complete: boolean }
type ExerciseSets = Record<string, SetEntry[]>
const dayOptions: TrainingDaysPerWeek[] = [3, 4]
const durationOptions: ProgramDurationWeeks[] = [5]
const defaultWeekdays: Record<TrainingDaysPerWeek, number[]> = { 3: [1, 3, 5], 4: [1, 2, 4, 5] }

function nextMonday(): string { const today = new Date(); const date = new Date(today.getFullYear(), today.getMonth(), today.getDate()); date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7)); return date.toISOString().slice(0, 10) }
function initialSets(workout: ScheduledWorkout, history: CompletedSetRecord[]): ExerciseSets {
  return Object.fromEntries(workout.exercises.map((exercise) => {
    const latest = [...history].filter((entry) => entry.exerciseId === exercise.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
    const next = latest && workout.target.kind !== 'deload' ? getNextSetSuggestion({ weight: latest.weight, reps: latest.reps, rpe: latest.rpe, targetRpe: workout.target.targetRpe, repRange: exercise.repRange }) : null
    const weight = latest && workout.target.kind === 'deload' ? latest.weight * 0.5 : (next?.weight ?? 135)
    const reps = latest && workout.target.kind === 'deload' ? latest.reps : (next?.reps ?? exercise.repRange.min)
    return [exercise.id, Array.from({ length: exercise.sets }, () => ({ reps: String(reps), weight: String(weight), rpe: String(workout.target.targetRpe), complete: false }))]
  }))
}

function App() {
  const [savedState] = useState(() => loadWorkoutState())
  const [view, setView] = useState<View>(savedState ? 'schedule' : 'onboarding')
  const [trainingDays, setTrainingDays] = useState<TrainingDaysPerWeek>(savedState?.trainingDays ?? 3)
  const [duration, setDuration] = useState<ProgramDurationWeeks>(savedState?.duration ?? 5)
  const [program, setProgram] = useState<ReturnType<typeof generateProgram> | null>(savedState?.program ?? null)
  const [completedIds, setCompletedIds] = useState<string[]>(savedState?.completedIds ?? [])
  const [history, setHistory] = useState<CompletedSetRecord[]>(savedState?.history ?? [])
  const [activeWorkout, setActiveWorkout] = useState<ScheduledWorkout | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [setsByExercise, setSetsByExercise] = useState<ExerciseSets>({})

  useEffect(() => { if (program) saveWorkoutState({ trainingDays, duration, program, completedIds, history }) }, [completedIds, duration, history, program, trainingDays])
  const selectedWeek = program?.workouts ?? []
  const totalSessions = program?.workouts.length ?? 0
  const volume = useMemo(() => history.reduce((total, set) => total + set.weight * set.reps, 0), [history])

  function buildProgram() { setProgram(generateProgram({ startDate: nextMonday(), trainingDaysPerWeek: trainingDays, durationWeeks: duration, weekdays: defaultWeekdays[trainingDays] })); setCompletedIds([]); setView('schedule') }
  function startWorkout(workout: ScheduledWorkout) { const nextSession = history.filter((entry) => entry.workoutId === workout.id).length + 1; setActiveWorkout(workout); setSessionId(`${workout.id}-${nextSession}`); setSetsByExercise(initialSets(workout, history)); setView('session') }
  function updateSet(exerciseId: string, index: number, patch: Partial<SetEntry>) { setSetsByExercise((current) => ({ ...current, [exerciseId]: current[exerciseId].map((set, setIndex) => setIndex === index ? { ...set, ...patch } : set) })) }
  function toggleSet(exercise: ExercisePrescription, index: number) {
    if (!activeWorkout) return
    const set = setsByExercise[exercise.id][index]; const weight = Number(set.weight); const reps = Number(set.reps); const rpe = Number(set.rpe)
    if (set.complete || ![weight, reps, rpe].every(Number.isFinite) || weight < 0 || reps <= 0 || rpe < 1 || rpe > 10) return
    const id = `${sessionId}-${exercise.id}-${index + 1}`
    updateSet(exercise.id, index, { complete: true })
    setHistory((current) => current.some((entry) => entry.id === id) ? current : [...current, { id, sessionId, workoutId: activeWorkout.id, exerciseId: exercise.id, exerciseName: exercise.name, setIndex: index + 1, weight, reps, rpe, weightUnit: 'lb', completedAt: new Date().toISOString(), weekNumber: activeWorkout.weekNumber, repRange: exercise.repRange, targetRir: activeWorkout.target.targetRir, targetRpe: activeWorkout.target.targetRpe }])
  }
  function finishWorkout() { if (!activeWorkout || !Object.values(setsByExercise).flat().some((set) => set.complete)) return; setCompletedIds((ids) => [...new Set([...ids, activeWorkout.id])]); setView('schedule') }
  function suggestion(exercise: ExercisePrescription) {
    if (!activeWorkout) return null
    const latest = [...history].filter((entry) => entry.exerciseId === exercise.id).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
    if (!latest) return <p className="suggestion">First exposure: use a controlled load and target RPE {activeWorkout.target.targetRpe}.</p>
    if (activeWorkout.target.kind === 'deload') return <p className="suggestion">Deload: use {latest.weight * 0.5} lb for {latest.reps} reps — 50% of last load.</p>
    const next = getNextSetSuggestion({ weight: latest.weight, reps: latest.reps, rpe: latest.rpe, targetRpe: activeWorkout.target.targetRpe, repRange: exercise.repRange })
    return <p className="suggestion">Next time: {next.weight} lb × {next.reps}. {next.reason}</p>
  }

  const completedSetCount = Object.values(setsByExercise).flat().filter((set) => set.complete).length
  const totalSetCount = Object.values(setsByExercise).flat().length
  const latestSet = [...history].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setView(program ? 'schedule' : 'onboarding')} aria-label="Workout Forge home"><span className="brand-mark">WF</span><span>WORKOUT FORGE</span></button>{program && <nav aria-label="Primary navigation"><button className={view === 'schedule' ? 'nav-active' : ''} onClick={() => setView('schedule')}>Plan</button><button className={view === 'progress' ? 'nav-active' : ''} onClick={() => setView('progress')}>Progress</button></nav>}<span className="local-badge"><i /> Local-first</span></header>
    {view === 'onboarding' && <section className="onboarding" aria-labelledby="onboarding-title"><div className="eyebrow">YOUR TRAINING SYSTEM</div><h1 id="onboarding-title">Build a plan you’ll actually finish.</h1><p className="lede">Push, pull, legs — structured around your week and measured set by set.</p><div className="setup-grid"><section className="setup-card"><div className="step-label">01 — Training rhythm</div><h2>How many days can you train?</h2><div className="choice-grid two" aria-label="Training days per week">{dayOptions.map((days) => <button key={days} className={trainingDays === days ? 'choice selected' : 'choice'} aria-label={`${days} days per week`} aria-pressed={trainingDays === days} onClick={() => setTrainingDays(days)}><strong>{days}</strong><span>days / week</span></button>)}</div></section><section className="setup-card"><div className="step-label">02 — Training block</div><h2>How long is your focus window?</h2><div className="choice-grid two" aria-label="Program duration">{durationOptions.map((weeks) => <button key={weeks} className={duration === weeks ? 'choice selected' : 'choice'} aria-label={`${weeks} weeks`} aria-pressed={duration === weeks} onClick={() => setDuration(weeks)}><strong>{weeks}</strong><span>weeks</span></button>)}</div></section></div><section className="preview-card" aria-label="Program preview"><div><span className="preview-label">YOUR PROGRAM</span><h2>{trainingDays === 3 ? 'Push / Pull / Legs' : 'Push / Pull A/B'}</h2><p>{duration} weeks · {trainingDays * duration} planned sessions · RIR-driven progression</p></div><button className="primary-button" onClick={buildProgram}>Build my plan <span>→</span></button></section></section>}
    {view === 'schedule' && program && <section className="workspace" aria-labelledby="schedule-title"><div className="workspace-heading"><div><div className="eyebrow">WEEK 01 OF {duration.toString().padStart(2, '0')}</div><h1 id="schedule-title">Your training block</h1><p>{totalSessions} planned sessions · {completedIds.length} complete</p></div><button className="secondary-button" onClick={() => setView('onboarding')}>New plan</button></div><div className="progress-line" aria-label={`${completedIds.length} of ${totalSessions} workouts completed`}><span style={{ width: `${totalSessions ? completedIds.length / totalSessions * 100 : 0}%` }} /></div><div className="week-label"><span>WEEK 01 · {selectedWeek[0]?.target.targetRir} RIR TARGET</span><span>{trainingDays} SESSIONS</span></div><div className="workout-list">{selectedWeek.map((workout, index) => { const complete = completedIds.includes(workout.id); return <article className={complete ? 'workout-card completed' : 'workout-card'} key={workout.id}><div className="session-number">{String(index + 1).padStart(2, '0')}</div><div className="workout-info"><span>{new Date(`${workout.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><h2>{workout.title}</h2><p>{workout.exercises.length} movements · target RPE {workout.target.targetRpe}</p></div>{complete ? <span className="complete-status">✓ Complete</span> : <button className="start-button" onClick={() => startWorkout(workout)}>Start <span>→</span></button>}</article> })}</div></section>}
    {view === 'session' && activeWorkout && <section className="session-view" aria-labelledby="session-title"><button className="back-link" onClick={() => setView('schedule')}>← Back to plan</button><div className="session-header"><div><div className="eyebrow">ACTIVE SESSION · {activeWorkout.target.kind === 'deload' ? 'DELOAD' : `${activeWorkout.target.targetRir} RIR TARGET`}</div><h1 id="session-title">{activeWorkout.title}</h1><p>Log weight, reps, and RPE. Completed sets save to local history immediately.</p></div><div className="timer">RPE {activeWorkout.target.targetRpe}</div></div>{activeWorkout.exercises.map((exercise, exerciseIndex) => <article className="exercise-card" key={exercise.id}><div className="exercise-title"><div><span className="exercise-index">{String(exerciseIndex + 1).padStart(2, '0')}</span><h2>{exercise.name}</h2><p>Target: {exercise.sets} sets × {exercise.repRange.min}–{exercise.repRange.max} reps · RPE {activeWorkout.target.targetRpe}</p></div></div>{suggestion(exercise)}<div className="set-table set-table-rpe" role="table" aria-label={`${exercise.name} set log`}><div className="set-head" role="row"><span>SET</span><span>REPS</span><span>WEIGHT</span><span>RPE</span><span>DONE</span></div>{setsByExercise[exercise.id]?.map((set, index) => <div className="set-row" role="row" key={index}><span>{index + 1}</span><input aria-label={`${exerciseIndex === 0 ? '' : `${exercise.name} `}Set ${index + 1} reps`} value={set.reps} inputMode="numeric" onChange={(event) => updateSet(exercise.id, index, { reps: event.target.value })} /><label><input aria-label={`${exerciseIndex === 0 ? '' : `${exercise.name} `}Set ${index + 1} weight`} value={set.weight} inputMode="decimal" onChange={(event) => updateSet(exercise.id, index, { weight: event.target.value })} /><em>lb</em></label><input aria-label={`${exerciseIndex === 0 ? '' : `${exercise.name} `}Set ${index + 1} RPE`} value={set.rpe} inputMode="decimal" onChange={(event) => updateSet(exercise.id, index, { rpe: event.target.value })} /><button className={set.complete ? 'check done' : 'check'} aria-label={`Complete ${exerciseIndex === 0 ? '' : `${exercise.name} `}set ${index + 1}`} onClick={() => toggleSet(exercise, index)}>{set.complete ? '✓' : ''}</button></div>)}</div></article>)}<div className="session-footer"><span>{completedSetCount} / {totalSetCount} sets saved</span><button className="primary-button" disabled={!completedSetCount} onClick={finishWorkout}>Finish workout <span>→</span></button></div></section>}
    {view === 'progress' && program && <section className="workspace" aria-labelledby="progress-title"><div className="workspace-heading"><div><div className="eyebrow">TRAINING DATA</div><h1 id="progress-title">Progress, without the noise.</h1><p>Every completed set is stored locally and drives the next suggestion.</p></div></div><div className="metrics-grid"><article><span>COMPLETED</span><strong>{completedIds.length}<small> / {totalSessions}</small></strong><p>sessions finished</p></article><article><span>LOGGED SETS</span><strong>{history.length}</strong><p>saved in session history</p></article><article><span>TOTAL VOLUME</span><strong>{volume.toLocaleString()}<small> lb</small></strong><p>completed working sets</p></article></div><section className="progress-empty"><span>LATEST COMPLETED SET</span>{latestSet ? <><h2>{latestSet.exerciseName}: {latestSet.weight} lb × {latestSet.reps} · RPE {latestSet.rpe}</h2><p>Week {latestSet.weekNumber} target: {latestSet.targetRir} RIR / RPE {latestSet.targetRpe}. Historical records retain their rep range and effort target.</p></> : <><h2>Your first completed set starts the record.</h2><p>Start the next planned workout and log weight, reps, and RPE.</p></>}</section></section>}
  </main>
}

export default App
