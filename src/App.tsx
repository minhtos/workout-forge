import { useEffect, useMemo, useState } from 'react'
import { generateProgram, type ProgramDurationWeeks, type ScheduledWorkout, type TrainingDaysPerWeek } from './domain/program'
import { loadWorkoutState, saveWorkoutState } from './domain/storage'
import './App.css'

type View = 'onboarding' | 'schedule' | 'session' | 'progress'

type SetEntry = { reps: string; weight: string; complete: boolean }

const dayOptions: TrainingDaysPerWeek[] = [3, 4, 5]
const durationOptions: ProgramDurationWeeks[] = [4, 6]

const defaultWeekdays: Record<TrainingDaysPerWeek, number[]> = {
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
}

function nextMonday(): string {
  const today = new Date()
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysUntilMonday = (8 - date.getDay()) % 7 || 7
  date.setDate(date.getDate() + daysUntilMonday)
  return date.toISOString().slice(0, 10)
}

function App() {
  const [savedState] = useState(() => loadWorkoutState())
  const [view, setView] = useState<View>(savedState ? 'schedule' : 'onboarding')
  const [trainingDays, setTrainingDays] = useState<TrainingDaysPerWeek>(savedState?.trainingDays ?? 3)
  const [duration, setDuration] = useState<ProgramDurationWeeks>(savedState?.duration ?? 4)
  const [program, setProgram] = useState<ReturnType<typeof generateProgram> | null>(savedState?.program ?? null)
  const [activeWorkout, setActiveWorkout] = useState<ScheduledWorkout | null>(null)
  const [sets, setSets] = useState<SetEntry[]>([
    { reps: '8', weight: '135', complete: false },
    { reps: '8', weight: '135', complete: false },
    { reps: '8', weight: '135', complete: false },
  ])
  const [completedIds, setCompletedIds] = useState<string[]>(savedState?.completedIds ?? [])

  useEffect(() => {
    if (program) {
      saveWorkoutState({ trainingDays, duration, program, completedIds })
    }
  }, [completedIds, duration, program, trainingDays])

  const completedWorkouts = program?.workouts.filter((workout) => completedIds.includes(workout.id)) ?? []
  const selectedWeek = program?.workouts.filter((workout) => workout.weekNumber === 1) ?? []
  const volume = useMemo(
    () => sets.filter((set) => set.complete).reduce((sum, set) => sum + Number(set.reps || 0) * Number(set.weight || 0), 0),
    [sets],
  )

  function buildProgram() {
    setProgram(generateProgram({
      startDate: nextMonday(),
      trainingDaysPerWeek: trainingDays,
      durationWeeks: duration,
      weekdays: defaultWeekdays[trainingDays],
    }))
    setView('schedule')
  }

  function startWorkout(workout: ScheduledWorkout) {
    setActiveWorkout(workout)
    setSets([
      { reps: '8', weight: '135', complete: false },
      { reps: '8', weight: '135', complete: false },
      { reps: '8', weight: '135', complete: false },
    ])
    setView('session')
  }

  function finishWorkout() {
    if (activeWorkout && sets.some((set) => set.complete)) {
      setCompletedIds((ids) => [...new Set([...ids, activeWorkout.id])])
      setView('schedule')
    }
  }

  const totalSessions = program?.workouts.length ?? 0

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView(program ? 'schedule' : 'onboarding')} aria-label="Workout Forge home">
          <span className="brand-mark">WF</span>
          <span>WORKOUT FORGE</span>
        </button>
        {program && (
          <nav aria-label="Primary navigation">
            <button className={view === 'schedule' ? 'nav-active' : ''} onClick={() => setView('schedule')}>Plan</button>
            <button className={view === 'progress' ? 'nav-active' : ''} onClick={() => setView('progress')}>Progress</button>
          </nav>
        )}
        <span className="local-badge"><i /> Local-first</span>
      </header>

      {view === 'onboarding' && (
        <section className="onboarding" aria-labelledby="onboarding-title">
          <div className="eyebrow">YOUR TRAINING SYSTEM</div>
          <h1 id="onboarding-title">Build a plan you’ll actually finish.</h1>
          <p className="lede">A focused training block, built around your week. Edit every session as you go.</p>

          <div className="setup-grid">
            <section className="setup-card">
              <div className="step-label">01 — Training rhythm</div>
              <h2>How many days can you train?</h2>
              <div className="choice-grid" aria-label="Training days per week">
                {dayOptions.map((days) => (
                  <button
                    key={days}
                    className={trainingDays === days ? 'choice selected' : 'choice'}
                    aria-label={`${days} days per week`}
                    aria-pressed={trainingDays === days}
                    onClick={() => setTrainingDays(days)}
                  >
                    <strong>{days}</strong><span>days / week</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="setup-card">
              <div className="step-label">02 — Training block</div>
              <h2>How long is your focus window?</h2>
              <div className="choice-grid two" aria-label="Program duration">
                {durationOptions.map((weeks) => (
                  <button
                    key={weeks}
                    className={duration === weeks ? 'choice selected' : 'choice'}
                    aria-label={`${weeks} weeks`}
                    aria-pressed={duration === weeks}
                    onClick={() => setDuration(weeks)}
                  >
                    <strong>{weeks}</strong><span>weeks</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="preview-card" aria-label="Program preview">
            <div>
              <span className="preview-label">YOUR PROGRAM</span>
              <h2>{trainingDays}-day {trainingDays === 3 ? 'full body' : trainingDays === 4 ? 'upper / lower' : 'hybrid split'}</h2>
              <p>{duration} weeks · {trainingDays * duration} planned sessions · Mon–Fri rhythm</p>
            </div>
            <button className="primary-button" onClick={buildProgram}>Build my plan <span>→</span></button>
          </section>
        </section>
      )}

      {view === 'schedule' && program && (
        <section className="workspace" aria-labelledby="schedule-title">
          <div className="workspace-heading">
            <div>
              <div className="eyebrow">WEEK 01 OF {duration.toString().padStart(2, '0')}</div>
              <h1 id="schedule-title">Your training block</h1>
              <p>{totalSessions} planned sessions · {completedIds.length} complete</p>
            </div>
            <button className="secondary-button" onClick={() => setView('onboarding')}>New plan</button>
          </div>

          <div className="progress-line" aria-label={`${completedIds.length} of ${totalSessions} workouts completed`}>
            <span style={{ width: `${totalSessions ? (completedIds.length / totalSessions) * 100 : 0}%` }} />
          </div>

          <div className="week-label"><span>WEEK 01</span><span>{trainingDays} SESSIONS</span></div>
          <div className="workout-list">
            {selectedWeek.map((workout, index) => {
              const complete = completedIds.includes(workout.id)
              return (
                <article className={complete ? 'workout-card completed' : 'workout-card'} key={workout.id}>
                  <div className="session-number">{String(index + 1).padStart(2, '0')}</div>
                  <div className="workout-info">
                    <span>{new Date(`${workout.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <h2>{workout.title}</h2>
                    <p>{trainingDays === 3 ? '6 movements · 45–55 min' : '5 movements · 40–50 min'}</p>
                  </div>
                  {complete ? <span className="complete-status">✓ Complete</span> : <button className="start-button" onClick={() => startWorkout(workout)}>Start <span>→</span></button>}
                </article>
              )
            })}
          </div>

          <aside className="insight-strip">
            <span>UP NEXT</span>
            <strong>{selectedWeek.find((workout) => !completedIds.includes(workout.id))?.title ?? 'Week complete'}</strong>
            <p>Show up, log the work, repeat.</p>
          </aside>
        </section>
      )}

      {view === 'session' && activeWorkout && (
        <section className="session-view" aria-labelledby="session-title">
          <button className="back-link" onClick={() => setView('schedule')}>← Back to plan</button>
          <div className="session-header">
            <div><div className="eyebrow">ACTIVE SESSION</div><h1 id="session-title">{activeWorkout.title}</h1><p>Log each working set. Progress saves to this session.</p></div>
            <div className="timer">00:00</div>
          </div>
          <article className="exercise-card">
            <div className="exercise-title"><div><span className="exercise-index">01</span><h2>Barbell Back Squat</h2><p>Target: 3 sets × 6–8 reps</p></div><button aria-label="Exercise options">•••</button></div>
            <div className="set-table" role="table" aria-label="Barbell Back Squat set log">
              <div className="set-head" role="row"><span>SET</span><span>REPS</span><span>WEIGHT</span><span>DONE</span></div>
              {sets.map((set, index) => (
                <div className="set-row" role="row" key={index}>
                  <span>{index + 1}</span>
                  <input aria-label={`Set ${index + 1} reps`} value={set.reps} inputMode="numeric" onChange={(event) => setSets((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, reps: event.target.value } : row))} />
                  <label><input aria-label={`Set ${index + 1} weight`} value={set.weight} inputMode="decimal" onChange={(event) => setSets((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, weight: event.target.value } : row))} /><em>lb</em></label>
                  <button className={set.complete ? 'check done' : 'check'} aria-label={`Complete set ${index + 1}`} onClick={() => setSets((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, complete: !row.complete } : row))}>{set.complete ? '✓' : ''}</button>
                </div>
              ))}
            </div>
            <button className="add-set" onClick={() => setSets((rows) => [...rows, { reps: '', weight: '', complete: false }])}>+ Add set</button>
          </article>
          <div className="session-footer"><span>{sets.filter((set) => set.complete).length} / {sets.length} sets done</span><button className="primary-button" disabled={!sets.some((set) => set.complete)} onClick={finishWorkout}>Finish workout <span>→</span></button></div>
        </section>
      )}

      {view === 'progress' && program && (
        <section className="workspace" aria-labelledby="progress-title">
          <div className="workspace-heading"><div><div className="eyebrow">TRAINING DATA</div><h1 id="progress-title">Progress, without the noise.</h1><p>Your completed work in this training block.</p></div></div>
          <div className="metrics-grid">
            <article><span>COMPLETED</span><strong>{completedIds.length}<small> / {totalSessions}</small></strong><p>sessions finished</p></article>
            <article><span>ADHERENCE</span><strong>{totalSessions ? Math.round((completedIds.length / totalSessions) * 100) : 0}<small>%</small></strong><p>of planned work</p></article>
            <article><span>SESSION VOLUME</span><strong>{volume.toLocaleString()}<small> lb</small></strong><p>last logged session</p></article>
          </div>
          <section className="progress-empty"><span>THE SIGNAL</span><h2>{completedWorkouts.length ? 'Consistency is compounding.' : 'Your first completed session starts the record.'}</h2><p>{completedWorkouts.length ? `You have logged ${completedWorkouts.length} session${completedWorkouts.length === 1 ? '' : 's'} in this block.` : 'Start your next planned workout and log one complete set.'}</p></section>
        </section>
      )}
    </main>
  )
}

export default App
