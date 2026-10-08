import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mergeSets } from './domain/backup'
import { standardRepMax, addExerciseToDay, createBlock, findWorkout, listWorkouts, mergeCatalog, moveExercise, nextWorkout, planProblem, removeExerciseFromDay, renameDay, resolveWorkout, setExerciseSets, setSlotExercise, type Block, type ExercisePrescription, type MuscleGroup, type TrainingDaysPerWeek } from './domain/program'
import { applyProgramSnapshot, runProgramSync } from './domain/programSync'
import { addCustomExercise, deleteCustomExercise, enabledCatalog, exerciseInUse, mergeCustomExercises, setExerciseEnabled, setGroupEnabled, updateCustomExercise } from './domain/exercises'
import { lengthOf, shapeOf, totalWeeks, type ProgramLength } from './domain/progression'
import { mergeFeedback, nextPrompt, resizeEntries, setOffset, tuneWorkoutSets, tunedSets, upsertFeedback, usesFeedback, type Effort, type Pump, type SessionFeedback, type Soreness } from './domain/autoregulation'
import { addSetEntry, applyEntryPatch, buildInitialSets, lastSessionSets, maxSetsPerExercise, parseEntry, removeLastSetEntry, skippedSinceLast, type TuneContext } from './domain/session'
import { adjustRepsForWeightEdit, historicalOneRepMax, type RepNotice } from './domain/repAdjust'
import { awaitingNextPart, carryOverFor, previousBlockId, startingOffsets, startNextPart } from './domain/transition'
import { applyWorkoutSet, clearWorkoutSet, isPlanCustomized, type WorkoutSet } from './domain/workoutSets'
import { archiveWorkoutState, emptyState, exportWorkoutState, loadWorkoutState, parseImportedState, saveWorkoutState, type SavedWorkoutState, type SetEntry } from './domain/storage'
import { loadRestTimerEnabled, saveRestTimerEnabled } from './domain/settings'
import { backupSession, restoreSessions } from './domain/sync'
import { supabase } from './lib/supabase'
import { FeedbackSheet } from './views/FeedbackSheet'
import { LibraryView } from './views/LibraryView'
import { PlanView } from './views/PlanView'
import { LandingView } from './views/LandingView'
import { ResetPasswordView } from './views/ResetPasswordView'
import type { AuthResult } from './views/AuthForm'
import { authMessage } from './domain/auth'
import { ProgressView } from './views/ProgressView'
import { SessionView } from './views/SessionView'
import { SettingsView } from './views/SettingsView'
import { SetupView } from './views/SetupView'
import { TodayView } from './views/TodayView'
import './App.css'

type View = 'landing' | 'setup' | 'plan' | 'today' | 'session' | 'progress' | 'settings' | 'library'

function initialView(state: SavedWorkoutState): View {
  if (state.activeSession && state.block?.locked) return 'session'
  if (!state.block) return state.history.length ? 'setup' : 'landing'
  return state.block.locked ? 'today' : 'plan'
}

const addUnique = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id])

/** What counts as "the program" for syncing; changes to it stamp programUpdatedAt. */
const signatureOf = (state: Pick<SavedWorkoutState, 'block' | 'customExercises' | 'hiddenExerciseIds' | 'feedback'>) => JSON.stringify([state.block, state.customExercises, state.hiddenExerciseIds, state.feedback])

/** Signing in from the landing page moves on to the app; the program sync then picks the right screen. */
const leaveLanding = (view: View): View => (view === 'landing' ? 'setup' : view)

/** After a program arrives from the cloud, move off a screen that no longer fits it. */
function settleView(view: View, block: Block | null): View {
  if (view !== 'setup' && view !== 'plan' && view !== 'today') return view
  if (!block) return 'setup'
  return block.locked ? 'today' : 'plan'
}

function App() {
  const [state, setState] = useState(loadWorkoutState)
  const [view, setView] = useState<View>(() => initialView(state))
  const [setupDays, setSetupDays] = useState<TrainingDaysPerWeek>(state.block?.trainingDays ?? 3)
  const [setupWeeks, setSetupWeeks] = useState<ProgramLength>(state.block ? lengthOf(state.block) : 4)
  const [userId, setUserId] = useState<string | null>(null)
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [entryError, setEntryError] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [restTimer, setRestTimer] = useState(loadRestTimerEnabled)
  const [online, setOnline] = useState(0)
  const [planStatus, setPlanStatus] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [repNotices, setRepNotices] = useState<Record<string, RepNotice | null>>({})
  const adoptingRemote = useRef(false)
  const stateRef = useRef(state)
  const flushing = useRef(false)

  const { block, history, activeSession } = state
  const catalog = useMemo(() => mergeCatalog(state.customExercises), [state.customExercises])
  const upcoming = block?.locked ? nextWorkout(block) : null
  const blockId = block?.startedAt ?? null
  const startOffsets = block?.startOffsets
  const tune = useMemo<TuneContext>(() => ({ feedback: state.feedback, blockId, startOffsets }), [state.feedback, blockId, startOffsets])
  const plannedWorkout = block && upcoming ? resolveWorkout(block, upcoming, catalog) : null
  const todayWorkout = plannedWorkout ? tuneWorkoutSets(plannedWorkout, state.feedback, blockId, startOffsets) : null
  // Exercises whose Week 1 numbers come from the previous block's 0 RIR week (shown as a note on the Today screen).
  const carriedCount = plannedWorkout && !activeSession && usesFeedback(plannedWorkout)
    ? plannedWorkout.exercises.filter((exercise) => carryOverFor({ exercise, last: lastSessionSets(history, exercise.id, ''), blockId, feedback: state.feedback })).length
    : 0
  const activeRef = block && activeSession ? findWorkout(block, activeSession.workoutId) : undefined
  const activeWorkout = block && activeRef ? resolveWorkout(block, activeRef, catalog) : null
  const sessionEntries = activeSession ? state.feedback.filter((entry) => entry.sessionId === activeSession.sessionId) : []
  const trainedBefore = (group: MuscleGroup) => !!activeSession && history.some((set) => set.sessionId !== activeSession.sessionId && catalog.find((item) => item.id === set.exerciseId)?.category === group)
  const prompt = view === 'session' && activeWorkout && activeSession ? nextPrompt({ workout: activeWorkout, sets: activeSession.sets, skipped: activeSession.skipped, entries: sessionEntries, trainedBefore, finishing }) : null
  const total = block ? listWorkouts(block).length : 0
  const finished = block ? block.completedIds.length + block.skippedIds.length : 0

  // Keep the ref current before any effect that reads it, then persist on every change.
  useEffect(() => { stateRef.current = state }, [state])
  // Writing to localStorage is an external sync whose outcome (quota/blocked) has to be surfaced as state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { setSaveFailed(!saveWorkoutState(state)) }, [state])

  // Auth: supabase persists the session locally and refreshes it, so users stay signed in.
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setUserId(data.session?.user.id ?? null); setAccountEmail(data.session?.user.email ?? null); if (data.session) setView(leaveLanding) })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user.id ?? null)
      setAccountEmail(session?.user.email ?? null)
      if (session) setView(leaveLanding)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Device data belongs to one account. A different account gets a clean slate; the previous data is archived, never deleted.
  useEffect(() => {
    if (!userId) return
    const current = stateRef.current
    if (current.ownerId === userId) return
    if (current.ownerId === null) { setState({ ...current, ownerId: userId }); return }
    archiveWorkoutState(current)
    if (signatureOf(emptyState()) !== signatureOf(current)) adoptingRemote.current = true
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

  // Program sync: any change to the block, own exercises or library switches stamps a timestamp;
  // the newest copy (this device or the cloud) wins. A snapshot adopted from the cloud is not re-stamped.
  const programSignature = signatureOf(state)
  const lastSignature = useRef(programSignature)
  useEffect(() => {
    if (programSignature === lastSignature.current) return
    lastSignature.current = programSignature
    if (adoptingRemote.current) { adoptingRemote.current = false; return }
    setState((current) => ({ ...current, programUpdatedAt: new Date().toISOString() }))
  }, [programSignature])

  const syncProgram = useCallback(async () => {
    if (!supabase || !userId) return
    const outcome = await runProgramSync(supabase, userId, stateRef.current, new Date().toISOString())
    if (outcome.kind === 'pushed') {
      setState((current) => current.programUpdatedAt ? current : { ...current, programUpdatedAt: outcome.updatedAt })
      setPlanStatus('')
    } else if (outcome.kind === 'adopted') {
      const next = applyProgramSnapshot(stateRef.current, outcome.snapshot)
      if (signatureOf(next) !== signatureOf(stateRef.current)) adoptingRemote.current = true
      setState((current) => applyProgramSnapshot(current, outcome.snapshot))
      setView((current) => settleView(current, outcome.snapshot.block))
      setPlanStatus('')
    } else if (outcome.kind === 'deferred') setPlanStatus('A newer plan from another device will load after this workout.')
    else if (outcome.kind === 'error') setPlanStatus(`Plan backup pending: ${outcome.message}`)
    else setPlanStatus('')
  }, [userId])
  useEffect(() => {
    if (!owned) return
    const timer = window.setTimeout(() => void syncProgram(), 1200)
    return () => window.clearTimeout(timer)
  }, [owned, state.programUpdatedAt, online, syncProgram])

  function editPlan(edit: (block: Block) => Block) {
    setState((current) => current.block && !current.block.locked ? { ...current, block: edit(current.block) } : current)
  }
  function applySet(set: WorkoutSet) {
    if (block && isPlanCustomized(block) && !window.confirm(`Replace your current plan with ${set.name}?`)) return
    editPlan((current) => applyWorkoutSet(current, set))
  }
  function customPlan() {
    if (block && isPlanCustomized(block) && !window.confirm('Replace your current plan with a blank custom plan?')) return
    editPlan(clearWorkoutSet)
  }
  /** Adds a custom exercise to the catalog (or reuses an existing one with the same name) and puts it on the day. */
  function createExercise(dayIndex: number, name: string, category: MuscleGroup, compound = false): string | null {
    if (!state.block || state.block.locked) return null
    const existing = catalog.find((item) => item.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setState({ ...state, block: addExerciseToDay(state.block, dayIndex, existing.id) })
      return null
    }
    const result = addCustomExercise(state.customExercises, name, category, compound)
    if ('error' in result) return result.error
    setState({ ...state, customExercises: result.custom, block: addExerciseToDay(state.block, dayIndex, result.id) })
    return null
  }
  function toggleExercise(id: string, enabled: boolean) {
    setState((current) => ({ ...current, hiddenExerciseIds: setExerciseEnabled(current.hiddenExerciseIds, id, enabled) }))
  }
  function toggleGroup(group: MuscleGroup, enabled: boolean) {
    setState((current) => ({ ...current, hiddenExerciseIds: setGroupEnabled(current.hiddenExerciseIds, mergeCatalog(current.customExercises), group, enabled) }))
  }
  /** Library edits return an error message for the form to show, or null when they worked. */
  function addToLibrary(name: string, category: MuscleGroup, compound = false): string | null {
    const result = addCustomExercise(state.customExercises, name, category, compound)
    if ("error" in result) return result.error
    setState({ ...state, customExercises: result.custom })
    return null
  }
  function updateInLibrary(id: string, name: string, category: MuscleGroup, compound = false): string | null {
    const result = updateCustomExercise(state.customExercises, id, name, category, compound)
    if ("error" in result) return result.error
    setState({ ...state, customExercises: result.custom })
    return null
  }
  function deleteFromLibrary(id: string): string | null {
    const result = deleteCustomExercise(state.customExercises, block, id)
    if ("error" in result) return result.error
    setState({ ...state, customExercises: result.custom, hiddenExerciseIds: setExerciseEnabled(state.hiddenExerciseIds, id, true) })
    return null
  }
  function startBlock() {
    if (!block || planProblem(block, catalog)) return
    // A new block starts from the last one: sets carry over (larger of plan or last block's final sets minus one).
    const startedAt = new Date().toISOString()
    const startOffsets = startingOffsets(state.feedback, previousBlockId(state.feedback, startedAt))
    setState({ ...state, block: { ...block, locked: true, startedAt, startOffsets } })
    setView('today')
  }
  /** Part 2 of a 12-week program: same exercises, a fresh start, carried over from part 1's 0 RIR week. */
  function beginNextPart() {
    if (!block) return
    setState({ ...state, block: startNextPart(block, state.feedback, new Date().toISOString()) })
    setView('today')
  }
  function startWorkout() {
    if (!block || !plannedWorkout) return
    if (!activeSession || activeSession.workoutId !== plannedWorkout.id) {
      const sessionId = crypto.randomUUID()
      setState({ ...state, activeSession: { workoutId: plannedWorkout.id, sessionId, sets: buildInitialSets(plannedWorkout, history, sessionId, tune) } })
    }
    setEntryError('')
    setRepNotices({})
    setView('session')
  }
  /** Applies one edit to a set row. A weight change on an RIR work week also rescales the reps to keep the week's target RIR. */
  function editRows(current: SavedWorkoutState, exerciseId: string, index: number, patch: Partial<SetEntry>): { next: SavedWorkoutState; notice: RepNotice | null } {
    const session = current.activeSession
    const rows = session?.sets[exerciseId]
    if (!session || !rows) return { next: current, notice: null }
    const edited = applyEntryPatch(rows, index, patch)
    const result = patch.weight !== undefined && activeWorkout && usesFeedback(activeWorkout)
      ? adjustRepsForWeightEdit(rows, edited, historicalOneRepMax(lastSessionSets(current.history, exerciseId, session.sessionId)), activeWorkout.target.targetRir, activeWorkout.exercises.find((exercise) => exercise.id === exerciseId)?.repRange.max ?? standardRepMax)
      : { entries: edited, notice: null }
    return { next: { ...current, activeSession: { ...session, sets: { ...session.sets, [exerciseId]: result.entries } } }, notice: result.notice }
  }
  function updateEntry(exerciseId: string, index: number, patch: Partial<SetEntry>) {
    setState((current) => editRows(current, exerciseId, index, patch).next)
    if (patch.weight !== undefined) setRepNotices((notices) => ({ ...notices, [exerciseId]: editRows(state, exerciseId, index, patch).notice }))
  }
  function resizeSets(exerciseId: string, resize: (entries: SetEntry[]) => SetEntry[]) {
    setState((current) => current.activeSession ? { ...current, activeSession: { ...current.activeSession, sets: { ...current.activeSession.sets, [exerciseId]: resize(current.activeSession.sets[exerciseId]) } } } : current)
  }
  /** Leave an exercise out of this session (or put it back). Only possible before any of its sets are checked off. */
  function setExerciseSkipped(exerciseId: string, skip: boolean) {
    setState((current) => {
      const session = current.activeSession
      if (!session || (skip && session.sets[exerciseId]?.some((entry) => entry.complete))) return current
      const rest = (session.skipped ?? []).filter((id) => id !== exerciseId)
      return { ...current, activeSession: { ...session, skipped: skip ? [...rest, exerciseId] : rest } }
    })
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
    const record = { id, sessionId, workoutId: activeWorkout.id, exerciseId: exercise.id, exerciseName: exercise.name, setIndex: index + 1, ...parsed, weightUnit: 'lb' as const, completedAt: new Date().toISOString(), weekNumber: activeWorkout.weekNumber, repRange: exercise.repRange, targetRir: activeWorkout.target.targetRir, targetReps: entry.targetReps, ...(activeWorkout.target.kind === 'deload' ? { deload: true } : {}) }
    setState((current) => current.activeSession ? {
      ...current,
      history: current.history.some((set) => set.id === id) ? current.history : [...current.history, record],
      pendingSessionIds: addUnique(current.pendingSessionIds, sessionId),
      activeSession: { ...current.activeSession, sets: { ...current.activeSession.sets, [exercise.id]: current.activeSession.sets[exercise.id].map((item, position) => position === index ? { ...item, complete: true } : item) } },
    } : current)
  }
  function completeWorkout(feedback: SessionFeedback[]) {
    if (!block || !activeSession) return
    setState({ ...state, feedback, activeSession: null, block: { ...block, completedIds: addUnique(block.completedIds, activeSession.workoutId) } })
    setFinishing(false)
    setRepNotices({})
    setView('today')
  }
  /** Finishing asks any unanswered effort and pump questions first (each can be skipped). */
  function finishWorkout() {
    if (!block || !activeSession || !activeWorkout) return
    const pending = nextPrompt({ workout: activeWorkout, sets: activeSession.sets, skipped: activeSession.skipped, entries: sessionEntries, trainedBefore, finishing: true })
    if (pending) setFinishing(true)
    else completeWorkout(state.feedback)
  }
  function discardSession() {
    if (!activeSession || !window.confirm('Discard this session and every set logged in it?')) return
    const { sessionId } = activeSession
    setState((current) => ({ ...current, activeSession: null, history: current.history.filter((set) => set.sessionId !== sessionId), feedback: current.feedback.filter((entry) => entry.sessionId !== sessionId), pendingSessionIds: addUnique(current.pendingSessionIds, sessionId) }))
    setFinishing(false)
    setView('today')
  }

  /** Soreness changes today's unstarted exercises for that muscle group right away, and carries forward through the block. */
  function answerSoreness(group: MuscleGroup, value: Soreness) {
    if (!activeSession || !activeWorkout || !block?.startedAt) return
    const feedback = upsertFeedback(state.feedback, { sessionId: activeSession.sessionId, blockId: block.startedAt, group }, { soreness: value }, new Date().toISOString())
    const offset = setOffset(feedback, block.startedAt, group, block.startOffsets?.[group] ?? 0)
    const sets = { ...activeSession.sets }
    for (const exercise of activeWorkout.exercises) {
      if (exercise.category !== group || sets[exercise.id].some((entry) => entry.complete)) continue
      sets[exercise.id] = resizeEntries(sets[exercise.id], tunedSets(exercise.sets, offset), maxSetsPerExercise)
    }
    setState({ ...state, feedback, activeSession: { ...activeSession, sets } })
  }
  function answerSummary(group: MuscleGroup, patch: { effort?: Effort; pump?: Pump }) {
    if (!activeSession || !activeWorkout || !block?.startedAt) return
    const feedback = upsertFeedback(state.feedback, { sessionId: activeSession.sessionId, blockId: block.startedAt, group }, { ...patch, summaryDone: true }, new Date().toISOString())
    const more = finishing && nextPrompt({ workout: activeWorkout, sets: activeSession.sets, skipped: activeSession.skipped, entries: feedback.filter((entry) => entry.sessionId === activeSession.sessionId), trainedBefore, finishing: true })
    if (finishing && !more) completeWorkout(feedback)
    else setState({ ...state, feedback })
  }
  function skipPrompt() {
    if (!prompt) return
    if (prompt.kind === 'soreness') answerSoreness(prompt.group, 'ontime')
    else answerSummary(prompt.group, {})
  }
  function newBlock() {
    if (block?.locked && upcoming && !window.confirm('Replace the current block? Your logged history is kept, but this block\'s progress is lost.')) return
    setState({ ...state, block: null, activeSession: null })
    setView('setup')
  }

  const unavailable: AuthResult = { ok: false, message: 'Accounts are not available in this build.' }
  async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return unavailable
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? { ok: false, message: authMessage(error) } : { ok: true, message: 'Signed in.' }
  }
  async function signUp(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return unavailable
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } })
    if (error) return { ok: false, message: authMessage(error) }
    return { ok: true, message: data.session ? 'Account created. You are signed in.' : 'Check your email to confirm your account, then sign in.' }
  }
  async function resetPassword(email: string): Promise<AuthResult> {
    if (!supabase) return unavailable
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` })
    return error ? { ok: false, message: authMessage(error) } : { ok: true, message: 'If an account exists for that email, a reset link is on its way.' }
  }
  async function saveNewPassword(password: string): Promise<AuthResult> {
    if (!supabase) return unavailable
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { ok: false, message: authMessage(error) }
    setRecovering(false)
    return { ok: true, message: 'Password saved.' }
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
    setState({ ...state, history: merged, block: state.block ?? imported.block, customExercises: mergeCustomExercises(state.customExercises, imported.customExercises), feedback: mergeFeedback(state.feedback, imported.feedback), pendingSessionIds: [...new Set([...state.pendingSessionIds, ...merged.map((set) => set.sessionId)])] })
    setCloudStatus(`Imported ${merged.length - state.history.length} sets.`)
  }

  const syncLabel = !owned ? 'saved on this device' : activeSession && state.pendingSessionIds.includes(activeSession.sessionId) ? 'syncing…' : 'backed up'
  const navigate = (next: View) => () => setView(next === 'today' && activeSession ? 'session' : next)
  const home = (): View => (!block ? 'setup' : block.locked ? 'today' : 'plan')

  if (view === 'landing' && !recovering) return <LandingView cloudEnabled={!!supabase} onStart={() => setView('setup')} onSignIn={signIn} onSignUp={signUp} onReset={resetPassword} />
  if (recovering) return <main className="app-shell"><ResetPasswordView onSubmit={saveNewPassword} /></main>

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={navigate(home())} aria-label="Workout Forge home"><span className="brand-mark">WF</span><span>WORKOUT FORGE</span></button>
      <nav aria-label="Primary navigation">
        {block?.locked && <button aria-current={view === 'today' || view === 'session' ? 'page' : undefined} className={view === 'today' || view === 'session' ? 'nav-active' : ''} onClick={navigate('today')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>Workout</button>}
        <button aria-current={view === 'progress' ? 'page' : undefined} className={view === 'progress' ? 'nav-active' : ''} onClick={navigate('progress')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>Progress</button>
        <button aria-current={view === 'settings' || view === 'library' ? 'page' : undefined} className={view === 'settings' || view === 'library' ? 'nav-active' : ''} onClick={navigate('settings')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>Settings</button>
      </nav>
      <span className="local-badge"><i /> {owned ? (state.pendingSessionIds.length ? 'Syncing' : 'Backed up') : 'Local-first'}</span></header>
    {saveFailed && <p className="form-error banner" role="alert">This device could not save your data (storage full or blocked). Export your data from Settings now.</p>}
    {view === 'setup' && <SetupView days={setupDays} weeks={setupWeeks} hasHistory={history.length > 0} onDays={setSetupDays} onWeeks={setSetupWeeks} onContinue={() => { const shape = shapeOf(setupWeeks); setState({ ...state, block: createBlock(setupDays, shape.durationWeeks, shape.parts) }); setView('plan') }} />}
    {view === 'plan' && block && <PlanView block={block} catalog={catalog} hiddenIds={state.hiddenExerciseIds} onApplySet={applySet} onCustomPlan={customPlan} onChoose={(day, position, id) => editPlan((current) => setSlotExercise(current, day, position, id))} onRename={(day, title) => editPlan((current) => renameDay(current, day, title))} onAdd={(day, id) => editPlan((current) => addExerciseToDay(current, day, id))} onCreate={createExercise} onRemove={(day, position) => editPlan((current) => removeExerciseFromDay(current, day, position))} onMove={(day, position, delta) => editPlan((current) => moveExercise(current, day, position, delta))} onSets={(day, position, sets) => editPlan((current) => setExerciseSets(current, day, position, sets))} onBack={() => { setState({ ...state, block: null }); setView('setup') }} onStart={startBlock} />}
    {view === 'today' && block?.locked && <TodayView workout={todayWorkout} trainingDays={block.trainingDays} totalWeeks={totalWeeks(block.durationWeeks)} finished={finished} total={total} carriedCount={carriedCount} nextPart={awaitingNextPart(block, !upcoming)} partLabel={block.parts === 2 ? `PART ${block.part ?? 1} OF 2` : null} onNextPart={beginNextPart} resuming={!!activeSession && activeSession.workoutId === todayWorkout?.id} onStart={startWorkout} onNewBlock={newBlock} />}
    {view === 'session' && activeWorkout && activeSession && <SessionView workout={activeWorkout} session={activeSession} history={history} syncLabel={syncLabel} restTimer={restTimer} tune={tune} repNotices={repNotices} error={entryError} onBack={() => setView('today')} onUpdate={updateEntry} onAddSet={(id) => resizeSets(id, addSetEntry)} onRemoveSet={(id) => resizeSets(id, removeLastSetEntry)} skippedLast={(id) => !!block && skippedSinceLast(block, id, lastSessionSets(history, id, activeSession.sessionId), activeSession.workoutId)} onSkip={(id) => setExerciseSkipped(id, true)} onRestore={(id) => setExerciseSkipped(id, false)} onToggle={toggleSet} onFinish={finishWorkout} onDiscard={discardSession} />}
    {prompt && <FeedbackSheet key={`${prompt.kind}-${prompt.group}`} prompt={prompt} onSoreness={(value) => answerSoreness(prompt.group, value)} onSummary={(effort, pump) => answerSummary(prompt.group, { effort, pump })} onSkip={skipPrompt} />}
    {view === 'progress' && <ProgressView history={history} catalog={catalog} finished={finished} total={total} />}
    {view === 'library' && <LibraryView catalog={catalog} custom={state.customExercises} hidden={state.hiddenExerciseIds} inUse={(id) => exerciseInUse(block, id)} onToggle={toggleExercise} onToggleGroup={toggleGroup} onAdd={addToLibrary} onUpdate={updateInLibrary} onDelete={deleteFromLibrary} onBack={() => setView('settings')} />}
    {view === 'settings' && <SettingsView librarySummary={`${enabledCatalog(catalog, state.hiddenExerciseIds).length} of ${catalog.length} exercises on`} onOpenLibrary={() => setView('library')} restTimer={restTimer} onRestTimer={(enabled) => { setRestTimer(enabled); saveRestTimerEnabled(enabled) }} cloudEnabled={!!supabase} accountEmail={accountEmail} status={cloudStatus} pendingCount={state.pendingSessionIds.length} onSignIn={signIn} onSignUp={signUp} onReset={resetPassword} onSignOut={() => void supabase?.auth.signOut()} onBackupAll={backupAll} planStatus={planStatus} onRestore={() => { void restoreFromCloud(false); setOnline((value) => value + 1) }} onExport={exportData} onImport={importData} onNewBlock={newBlock} />}
  </main>
}

export default App
