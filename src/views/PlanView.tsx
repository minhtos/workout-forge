import { useState } from 'react'
import { enabledCatalog } from '../domain/exercises'
import { maxExercisesPerDay, muscleGroups, planProblem, setCountOptions, type Block, type ExerciseCatalogItem, type MuscleGroup } from '../domain/program'
import { lengthLabel, lengthOf } from '../domain/progression'
import { findWorkoutSet, workoutSets, type WorkoutSet } from '../domain/workoutSets'

interface Props {
  block: Block
  catalog: ExerciseCatalogItem[]
  /** Exercises turned off in the library; they are left out of the menus. */
  hiddenIds: string[]
  onApplySet: (set: WorkoutSet) => void
  onCustomPlan: () => void
  onRename: (dayIndex: number, title: string) => void
  onAdd: (dayIndex: number, exerciseId: string) => void
  onChoose: (dayIndex: number, position: number, exerciseId: string | null) => void
  onCreate: (dayIndex: number, name: string, category: MuscleGroup, compound: boolean) => string | null
  onRemove: (dayIndex: number, position: number) => void
  onMove: (dayIndex: number, position: number, delta: -1 | 1) => void
  onSets: (dayIndex: number, position: number, sets: number) => void
  onBack: () => void
  onStart: () => void
}

type Filter = MuscleGroup | 'All'

export function PlanView({ block, catalog, hiddenIds, onApplySet, onCustomPlan, onRename, onAdd, onChoose, onCreate, onRemove, onMove, onSets, onBack, onStart }: Props) {
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('All')
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const [newCategory, setNewCategory] = useState<MuscleGroup>('Chest')
  const [newCompound, setNewCompound] = useState(false)
  const problem = planProblem(block, catalog)
  const byId = new Map(catalog.map((item) => [item.id, item]))
  const activeSet = findWorkoutSet(block.workoutSetId)
  const available = enabledCatalog(catalog, hiddenIds)

  return <section className="workspace" aria-labelledby="plan-title">
    <div className="workspace-heading"><div><div className="eyebrow">{lengthLabel(lengthOf(block)).toUpperCase()} · {block.trainingDays} DAYS / WEEK{activeSet ? ` · ${activeSet.name.toUpperCase()}` : ''}</div><h1 id="plan-title">Choose your exercises</h1><p>Start from a Workout Set, or build each day yourself. Your choices lock in once you start the block.</p></div><button className="secondary-button" onClick={onBack}>Back</button></div>

    <section className="set-picker" aria-label="Workout Sets">
      <div className="step-label">Start from a Workout Set</div>
      <div className="set-grid">{workoutSets.map((set) => <article className={set.id === block.workoutSetId ? 'set-card selected' : 'set-card'} key={set.id}>
        <span className={set.recommendedDays === block.trainingDays ? 'badge recommended' : 'badge'}>Recommended for {set.recommendedDays}-day program</span>
        <h2>{set.name}</h2>
        <p>{set.summary}</p>
        <button className="secondary-button" aria-label={`Use ${set.name}`} onClick={() => onApplySet(set)}>{set.id === block.workoutSetId ? 'Applied' : 'Use this set'}</button>
      </article>)}
        <article className={block.workoutSetId === null ? 'set-card selected' : 'set-card'}>
          <span className="badge">Your choice</span>
          <h2>Create my custom plan</h2>
          <p>Name each day, pick every exercise yourself, or create your own exercises.</p>
          <button className="secondary-button" aria-label="Create my custom plan" disabled={block.workoutSetId === null} onClick={onCustomPlan}>{block.workoutSetId === null ? 'Applied' : 'Build my own'}</button>
        </article>
      </div>
    </section>

    <div className="plan-grid">{block.templates.map((day, dayIndex) => {
      const open = pickerDay === dayIndex
      const chosen = new Set(day.exercises.map((entry) => entry.exerciseId))
      const options = available.filter((item) => filter === 'All' || item.category === filter)
      const full = day.exercises.length >= maxExercisesPerDay
      return <article className="setup-card" key={dayIndex}>
        <div className="step-label">{block.rotation ? 'Workout' : 'Day'} {dayIndex + 1}</div>
        <input className="day-name" aria-label={`Day ${dayIndex + 1} name`} value={day.title} maxLength={24} onChange={(event) => onRename(dayIndex, event.target.value)} />
        {day.exercises.length === 0 && <p className="hint">No exercises yet.</p>}
        {day.exercises.map((entry, position) => {
          const item = entry.exerciseId ? byId.get(entry.exerciseId) : undefined
          const name = item?.name ?? entry.category ?? 'exercise'
          const label = `Day ${dayIndex + 1} exercise ${position + 1}`
          const isSlot = entry.category !== undefined
          const choices = enabledCatalog(catalog, hiddenIds, [entry.exerciseId]).filter((candidate) => candidate.category === entry.category || candidate.id === entry.exerciseId)
          return <div className="plan-slot" key={position}>
            {isSlot
              ? <div className="slot-name"><span className="slot-label">{entry.category}</span>
                <select aria-label={`${label} choice`} value={entry.exerciseId ?? ''} onChange={(event) => onChoose(dayIndex, position, event.target.value || null)}>
                  <option value="">Choose {entry.category?.toLowerCase()} exercise…</option>
                  {choices.map((choice) => <option key={choice.id} value={choice.id} disabled={choice.id !== entry.exerciseId && chosen.has(choice.id)}>{choice.name}</option>)}
                </select></div>
              : <div className="slot-name"><strong>{name}</strong><span className="slot-label">{item?.category}</span></div>}
            <select aria-label={`${label} sets`} value={entry.sets} onChange={(event) => onSets(dayIndex, position, Number(event.target.value))}>{setCountOptions.map((count) => <option key={count} value={count}>{count} {count === 1 ? 'set' : 'sets'}{entry.reps ? ` × ${entry.reps}` : ''}</option>)}</select>
            <div className="slot-actions">
              <button className="icon-button" aria-label={`Move ${name} up`} disabled={position === 0} onClick={() => onMove(dayIndex, position, -1)}>↑</button>
              <button className="icon-button" aria-label={`Move ${name} down`} disabled={position === day.exercises.length - 1} onClick={() => onMove(dayIndex, position, 1)}>↓</button>
              <button className="icon-button" aria-label={`Remove ${name}`} onClick={() => onRemove(dayIndex, position)}>✕</button>
            </div>
          </div>
        })}
        <button className="secondary-button add-button" aria-expanded={open} disabled={full && !open} onClick={() => { setPickerDay(open ? null : dayIndex); setFilter('All') }}>{open ? 'Close menu' : full ? 'Day is full' : '+ Add exercise'}</button>
        {open && <div className="picker" role="group" aria-label={`Add an exercise to Day ${dayIndex + 1}`}>
          <div className="filter-row">{(['All', ...muscleGroups] as Filter[]).map((group) => <button key={group} className={filter === group ? 'chip selected' : 'chip'} aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}</div>
          <div className="picker-list">{options.map((item) => <button key={item.id} className="picker-item" disabled={chosen.has(item.id) || full} onClick={() => onAdd(dayIndex, item.id)}><span>{item.name}</span><em>{chosen.has(item.id) ? 'Added' : item.category}</em></button>)}</div>
          {options.length === 0 && <p className="hint">Nothing is turned on here. Turn exercises on in Settings → Exercise library.</p>}
          <form className="add-exercise-form" onSubmit={(event) => { event.preventDefault(); if (!newName.trim()) return; const problem = onCreate(dayIndex, newName.trim(), newCategory, newCompound); setCreateError(problem ?? ''); if (!problem) { setNewName(''); setNewCompound(false) } }}>
            <input aria-label="New exercise name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Not listed? Name a new exercise" />
            <select aria-label="New exercise muscle group" value={newCategory} onChange={(event) => setNewCategory(event.target.value as MuscleGroup)}>{muscleGroups.map((group) => <option key={group}>{group}</option>)}</select>
            <div className="add-row">
              <button className="secondary-button" type="submit">Create & add</button>
              <label className="check-row"><input type="checkbox" aria-label="New exercise is a large compound lift" checked={newCompound} onChange={(event) => setNewCompound(event.target.checked)} />Large compound lift (12 rep max, otherwise 15)</label>
            </div>
          </form>{createError && <p className="form-error" role="alert">{createError}</p>}
        </div>}
      </article>
    })}</div>
    <section className="preview-card"><div><span className="preview-label">READY?</span><h2>{problem ?? 'Every day is planned.'}</h2><p>Starting locks these exercises until the block is complete.</p></div><button className="primary-button" disabled={problem !== null} onClick={onStart}>Start block <span>→</span></button></section>
  </section>
}
