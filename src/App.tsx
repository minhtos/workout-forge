import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mergeSets } from './domain/backup'
import { addExerciseToDay, createBlock, findWorkout, listWorkouts, mergeCatalog, moveExercise, nextWorkout, planProblem, removeExerciseFromDay, renameDay, resolveWorkout, setExerciseSets, setSlotExercise, slugify, type Block, type ExercisePrescription, type MuscleGroup, type TrainingDaysPerWeek } from './domain/program'
import { totalWeeks, type ProgramDurationWeeks } from './domain/progression'
import { addSetEntry, applyEntryPatch, buildInitialSets, parseEntry, removeLastSetEntry } from './domain/session'
import { applyWorkoutSet, type WorkoutSet } from './domain/workoutSets'
import { archiveWorkoutState, emptyState, exportWorkoutState, loadWorkoutState, parseImportedState, saveWorkoutState, type SavedWorkoutState, type SetEntry } from './domain/storage'
import { backupSession, restoreSessions } from './domain/sync'
import { supabase } from './lib/supabase'
import { PlanView } from './views/PlanView'
import { ProgressView } from './views/ProgressView'
import { SessionView } from './views/SessionView'
import { SettingsView } from './views/SettingsView'
import { SetupView } from './views/SetupView'
import { TodayView } from './views/TodayView'
import './App.css'

type View = 'setup' | 'plan' | 'today' | 'session' | 'progress' | 'settings'

function initialView(state: SavedWorkoutState): View {
  if (state.activeSession && state.block?.locked) return 'session'
  if (!state.block) return 'setup'
  return state.block.locked ? 'today' : 'plan'
}

const addUnique = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id])

function App() {
  const [state, setState] = useState(loadWorkoutState)
  const [view, setView] = useState<View>(() => initialView(state))
  const [setupDays, setSetupDays] = useState<TrainingDaysPerWeek>(state.block?.trainingDays ?? 3)
  const [setupWeeks, setSetupWeeks] = useState<ProgramDurationWeeks>(state.block?.durationWeeks ?? 4)
  const [userId, setUserId] = useState<string | null>(null)
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState('')
  const [entryError, setEntryError] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [online, setOnline] = useState(0)
  const stateRef = useRef(state)
  const flushing = useRef(false)

  const { block, history, activeSession } = state
  const catalog = useMemo(() => mergeCatalog(state.customExercises), [state.customExercises])
  const upcoming = block?.locked ? nextWorkout(block) : null
  const todayWorkout = block && upcoming ? resolveWorkout(block, upcoming, catalog) : null
  const activeRef = block && activeSession ? findWorkout(block, activeSession.workoutId) : undefined
  const activeWorkout = block && activeRef ? resolveWorkout(block, activeRef, catalog) : null
  const total = block ? listWorkouts(block).length : 0
  const finished = block ? block.completedIds.length + block.skippedIds.length : 0

  // Keep the ref current before any effect that reads it, then persist on every change.
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { setSaveFailed(!saveWorkoutState(state)) }, [state])

  // Auth: supabase persists the session locally and refreshes it, so users stay signed in.
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setUserId(data.session?.user.id ?? null); setAccountEmail(data.session?.user.email ?? null) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUserId(session?.user.id ?? null); setAccountEmail(session?.user.email ?? null) })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Device data belongs to one account. A different account gets a clean slate; the previous data is archived, never deleted.
  useEffect(() => {
    if (!userId) return
    const current = stateRef.current
    if (current.ownerId === userId) return
    if (current.ownerId === null) { setState({ ...current, ownerId: userId }); return }
    archiveWorkoutState(current)
    setState({ ...emptyState(), ownerId: userId })
    setView('setup')
  }, [userId])

  const owned = userId !== null && state.ownerId === userId

  const restoreFromCloud = useCallback(async (quiet: boolean) => {
    if (!supabase || !userId) return
    const result = await restoreSessions(supabase, userId, stateRef.current.history)
    if (result.message) { setCloudStatus(`Restore failed: ${result.message}`); return }
    setState((current) => ({ ...current, history: mergeSets(current.history, result.history) }))
    if (!quiet || result.added) setCloudStatus(`Restore complete: ${result.added} sets added${result.skipped ? `, ${result.skipped} invalid records skipped` : ''}.`)
  }, [userId])
  useEffect(() => { if (owned) void restoreFromCloud(true) }, [owned, restoreFromCloud])

  // Cloud sync queue: sessions stay "pending" until the cloud has their latest sets.
  const flushPending = useCallback(async () => {
    if (!supabase || !userId || flushing.current) return
    flushing.current = true
    const attempted = new Set<string>()
    try {
      for (;;) {
        const id = stateRef.current.pendingSessionIds.find((candidate) => !attempted.has(candidate))
        if (!id) break
        const sets = stateRef.current.history.filter((set) => set.sessionId === id)
        const result = await backupSession(supabase, userId, id, sets)
        if (!result.ok) { setCloudStatus(`Backup pending: ${result.message}`); break }
        const latest = stateRef.current.history.filter((set) => set.sessionId === id)
        if (latest.length !== sets.length || latest.some((set, index) => set.id !== sets[index].id)) continue
        attempted.add(id)
        setState((current) => ({ ...current, pendingSessionIds: current.pendingSessionIds.filter((pending) => pending !== id) }))
        setCloudStatus('')
      }
    } finally { flushing.current = false }
  }, [userId])
  useEffect(() => { if (owned && state.pendingSessionIds.length) void flushPending() }, [owned, state.pendingSessionIds, online, flushPending])
  useEffect(() => {
    const retry = () => setOnline((value) => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  function editPlan(edit: (block: Block) => Block) {
    setState((current) => current.block && !current.block.locked ? { ...current, block: edit(current.block) } : current)
  }
  function applySet(set: WorkoutSet) {
    const planned = block?.templates.some((day) => day.exercises.some((entry) => entry.exerciseId))
    if (planned && !window.confirm(`Replace your current plan with ${set.name}?`)) return
    editPlan((current) => applyWorkoutSet(current, set))
  }
  /** Adds a custom exercise to the catalog (or reuses an existing one with the same name) and puts it on the day. */
  function createExercise(dayIndex: number, name: string, category: MuscleGroup) {
    setState((current) => {
      if (!current.block || current.block.locked) return current
      const existing = mergeCatalog(current.customExercises).find((item) => item.name.toLowerCase() === name.toLowerCase())
      const item = existing ?? { id: `custom-${slugify(name)}`, name, category }
      return { ...current, customExercises: existing ? current.customExercises : [...current.customExercises, item], block: addExerciseToDay(current.block, dayIndex, item.id) }
    })
  }
  function startBlock() {
    if (!block || planProblem(block, catalog)) return
    setState({ ...state, block: { ...block, locked: true, startedAt: new Date().toISOString() } })
    setView('today')
  }
  function startWorkout() {
    if (!block || !todayWorkout) return
    if (!activeSession || activeSession.workoutId !== todayWorkout.id) {
      const sessionId = crypto.randomUUID()
      setState({ ...state, activeSession: { workoutId: todayWorkout.id, sessionId, sets: buildInitialSets(todayWorkout, history, sessionId) } })
    }
    setEntryError('')
    setView('session')
  }
  function updateEntry(exerciseId: string, index: number, patch: Partial<SetEntry>) {
    setState((current) => current.activeSession ? { ...current, activeSession: { ...current.activeSession, sets: { ...current.activeSession.sets, [exerciseId]: applyEntryPatch(current.activeSession.sets[exerciseId], index, patch) } } } : current)
  }
  function resizeSets(exerciseId: string, resize: (entries: SetEntry[]) => SetEntry[]) {
    setState((current) => current.activeSession ? { ...current, activeSession: { ...current.activeSession, sets: { ...current.activeSession.sets, [exerciseId]: resize(current.activeSession.sets[exerciseId]) } } } : current)
  }
  function toggleSet(exercise: ExercisePrescription, index: number) {
    if (!activeSession || !activeWorkout) return
    const { sessionId } = activeSession
    const entry = activeSession.sets[exercise.id][index]
    const id = `${sessionId}-${exercise.id}-${index + 1}`
    setEntryError('')
    if (entry.complete) {
      setState((current) => ({ ...current, history: current.history.filter((set) => set.id !== id), pendingSessionIds: addUnique(current.pendingSessionIds, sessionId) }))
      updateEntry(exercise.id, index, { complete: false })
      return
    }
    const parsed = parseEntry(entry)
    if ('error' in parsed) { setEntryError(parsed.error); return }
    const record = { id, sessionId, workoutId: activeWorkout.id, exerciseId: exercise.id, exerciseName: exercise.name, setIndex: index + 1, ...parsed, weightUnit: 'lb' as const, completedAt: new Date().toISOString(), weekNumber: activeWorkout.weekNumber, repRange: exercise.repRange, targetRir: activeWorkout.target.targetRir }
    setState((current) => current.activeSession ? {
      ...current,
      history: current.history.some((set) => set.id === id) ? current.history : [...current.history, record],
      pendingSessionIds: addUnique(current.pendingSessionIds, sessionId),
      activeSession: { ...current.activeSession, sets: { ...current.activeSession.sets, [exercise.id]: current.activeSession.sets[exercise.id].map((item, position) => position === index ? { ...item, complete: true } : item) } },
    } : current)
  }
  function finishWorkout() {
    if (!block || !activeSession) return
    setState({ ...state, activeSession: null, block: { ...block, completedIds: addUnique(block.completedIds, activeSession.workoutId) } })
    setView('today')
  }
  function discardSession() {
    if (!activeSession || !window.confirm('Discard this session and every set logged in it?')) return
    const { sessionId } = activeSession
    setState((current) => ({ ...current, activeSession: null, history: current.history.filter((set) => set.sessionId !== sessionId), pendingSessionIds: addUnique(current.pendingSessionIds, sessionId) }))
    setView('today')
  }
  function skipWorkout() {
    if (!block || !upcoming || !window.confirm('Skip this workout? It will count as done for the block.')) return
    setState({ ...state, block: { ...block, skippedIds: addUnique(block.skippedIds, upcoming.id) } })
  }
  function newBlock() {
    if (block?.locked && upcoming && !window.confirm('Replace the current block? Your logged history is kept, but this block\'s progress is lost.')) return
    setState({ ...state, block: null, activeSession: null })
    setView('setup')
  }

  async function sendMagicLink(email: string) {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setCloudStatus(error ? error.message : 'Magic link sent. Open it on this device to stay signed in here.')
  }
  function backupAll() {
    setState((current) => ({ ...current, pendingSessionIds: [...new Set([...current.pendingSessionIds, ...current.history.map((set) => set.sessionId)])] }))
    setOnline((value) => value + 1)
    setCloudStatus('Backing up all sessions…')
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([exportWorkoutState(state)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `workout-forge-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  function importData(text: string) {
    const imported = parseImportedState(text)
    if (!imported) { setCloudStatus('That file is not a Workout Forge export.'); return }
    const merged = mergeSets(state.history, imported.history)
    setState({ ...state, history: merged, block: state.block ?? imported.block, customExercises: [...state.customExercises, ...imported.customExercises.filter((item) => !state.customExercises.some((own) => own.id === item.id))], pendingSessionIds: [...new Set([...state.pendingSessionIds, ...merged.map((set) => set.sessionId)])] })
    setCloudStatus(`Imported ${merged.length - state.history.length} sets.`)
  }

  const syncLabel = !owned ? 'saved on this device' : activeSession && state.pendingSessionIds.includes(activeSession.sessionId) ? 'syncing…' : 'backed up'
  const navigate = (next: View) => () => setView(next === 'today' && activeSession ? 'session' : next)
  const home = (): View => (!block ? 'setup' : block.locked ? 'today' : 'plan')

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={navigate(home())} aria-label="Workout Forge home"><span className="brand-mark">WF</span><span>WORKOUT FORGE</span></button>
      <nav aria-label="Primary navigation">
        {block?.locked && <button aria-current={view === 'today' || view === 'session' ? 'page' : undefined} className={view === 'today' || view === 'session' ? 'nav-active' : ''} onClick={navigate('today')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>Workout</button>}
        <button aria-current={view === 'progress' ? 'page' : undefined} className={view === 'progress' ? 'nav-active' : ''} onClick={navigate('progress')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>Progress</button>
        <button aria-current={view === 'settings' ? 'page' : undefined} className={view === 'settings' ? 'nav-active' : ''} onClick={navigate('settings')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>Settings</button>
      </nav>
      <span className="local-badge"><i /> {owned ? (state.pendingSessionIds.length ? 'Syncing' : 'Backed up') : 'Local-first'}</span></header>
    {saveFailed && <p className="form-error banner" role="alert">This device could not save your data (storage full or blocked). Export your data from Settings now.</p>}
    {view === 'setup' && <SetupView days={setupDays} weeks={setupWeeks} hasHistory={history.length > 0} onDays={setSetupDays} onWeeks={setSetupWeeks} onContinue={() => { setState({ ...state, block: createBlock(setupDays, setupWeeks) }); setView('plan') }} />}
    {view === 'plan' && block && <PlanView block={block} catalog={catalog} onApplySet={applySet} onChoose={(day, position, id) => editPlan((current) => setSlotExercise(current, day, position, id))} onRename={(day, title) => editPlan((current) => renameDay(current, day, title))} onAdd={(day, id) => editPlan((current) => addExerciseToDay(current, day, id))} onCreate={createExercise} onRemove={(day, position) => editPlan((current) => removeExerciseFromDay(current, day, position))} onMove={(day, position, delta) => editPlan((current) => moveExercise(current, day, position, delta))} onSets={(day, position, sets) => editPlan((current) => setExerciseSets(current, day, position, sets))} onBack={() => { setState({ ...state, block: null }); setView('setup') }} onStart={startBlock} />}
    {view === 'today' && block?.locked && <TodayView workout={todayWorkout} trainingDays={block.trainingDays} totalWeeks={totalWeeks(block.durationWeeks)} finished={finished} total={total} resuming={!!activeSession && activeSession.workoutId === todayWorkout?.id} onStart={startWorkout} onSkip={skipWorkout} onNewBlock={newBlock} />}
    {view === 'session' && activeWorkout && activeSession && <SessionView workout={activeWorkout} session={activeSession} history={history} syncLabel={syncLabel} error={entryError} onBack={() => setView('today')} onUpdate={updateEntry} onAddSet={(id) => resizeSets(id, addSetEntry)} onRemoveSet={(id) => resizeSets(id, removeLastSetEntry)} onToggle={toggleSet} onFinish={finishWorkout} onDiscard={discardSession} />}
    {view === 'progress' && <ProgressView history={history} finished={finished} total={total} />}
    {view === 'settings' && <SettingsView cloudEnabled={!!supabase} accountEmail={accountEmail} status={cloudStatus} pendingCount={state.pendingSessionIds.length} onSendLink={(email) => void sendMagicLink(email)} onSignOut={() => void supabase?.auth.signOut()} onBackupAll={backupAll} onRestore={() => void restoreFromCloud(false)} onExport={exportData} onImport={importData} onNewBlock={newBlock} />}
  </main>
}

export default App
