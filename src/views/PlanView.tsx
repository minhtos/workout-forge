import { useState } from 'react'
import { maxExercisesPerDay, muscleGroups, planProblem, setCountOptions, type Block, type ExerciseCatalogItem, type MuscleGroup } from '../domain/program'

interface Props {
  block: Block
  catalog: ExerciseCatalogItem[]
  onRename: (dayIndex: number, title: string) => void
  onAdd: (dayIndex: number, exerciseId: string) => void
  onCreate: (dayIndex: number, name: string, category: MuscleGroup) => void
  onRemove: (dayIndex: number, position: number) => void
  onMove: (dayIndex: number, position: number, delta: -1 | 1) => void
  onSets: (dayIndex: number, position: number, sets: number) => void
  onBack: () => void
  onStart: () => void
}

type Filter = MuscleGroup | 'All'

export function PlanView({ block, catalog, onRename, onAdd, onCreate, onRemove, onMove, onSets, onBack, onStart }: Props) {
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('All')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<MuscleGroup>('Chest')
  const problem = planProblem(block, catalog)
  const byId = new Map(catalog.map((item) => [item.id, item]))

  return <section className="workspace" aria-labelledby="plan-title">
    <div className="workspace-heading"><div><div className="eyebrow">{block.durationWeeks} WEEKS + DELOAD · {block.trainingDays} DAYS / WEEK</div><h1 id="plan-title">Choose your exercises</h1><p>Build each training day however you like. Your choices lock in once you start the block.</p></div><button className="secondary-button" onClick={onBack}>Back</button></div>
    <div className="plan-grid">{block.templates.map((day, dayIndex) => {
      const open = pickerDay === dayIndex
      const chosen = new Set(day.exercises.map((entry) => entry.exerciseId))
      const options = catalog.filter((item) => filter === 'All' || item.category === filter)
      const full = day.exercises.length >= maxExercisesPerDay
      return <article className="setup-card" key={dayIndex}>
        <div className="step-label">Day {dayIndex + 1}</div>
        <input className="day-name" aria-label={`Day ${dayIndex + 1} name`} value={day.title} maxLength={24} onChange={(event) => onRename(dayIndex, event.target.value)} />
        {day.exercises.length === 0 && <p className="hint">No exercises yet.</p>}
        {day.exercises.map((entry, position) => {
          const item = byId.get(entry.exerciseId)
          const label = `Day ${dayIndex + 1} exercise ${position + 1}`
          return <div className="plan-slot" key={entry.exerciseId}>
            <div className="slot-name"><strong>{item?.name ?? entry.exerciseId}</strong><span className="slot-label">{item?.category}</span></div>
            <select aria-label={`${label} sets`} value={entry.sets} onChange={(event) => onSets(dayIndex, position, Number(event.target.value))}>{setCountOptions.map((count) => <option key={count} value={count}>{count} sets</option>)}</select>
            <div className="slot-actions">
              <button className="icon-button" aria-label={`Move ${item?.name} up`} disabled={position === 0} onClick={() => onMove(dayIndex, position, -1)}>↑</button>
              <button className="icon-button" aria-label={`Move ${item?.name} down`} disabled={position === day.exercises.length - 1} onClick={() => onMove(dayIndex, position, 1)}>↓</button>
              <button className="icon-button" aria-label={`Remove ${item?.name}`} onClick={() => onRemove(dayIndex, position)}>✕</button>
            </div>
          </div>
        })}
        <button className="secondary-button add-button" aria-expanded={open} disabled={full && !open} onClick={() => { setPickerDay(open ? null : dayIndex); setFilter('All') }}>{open ? 'Close menu' : full ? 'Day is full' : '+ Add exercise'}</button>
        {open && <div className="picker" role="group" aria-label={`Add an exercise to Day ${dayIndex + 1}`}>
          <div className="filter-row">{(['All', ...muscleGroups] as Filter[]).map((group) => <button key={group} className={filter === group ? 'chip selected' : 'chip'} aria-pressed={filter === group} onClick={() => setFilter(group)}>{group}</button>)}</div>
          <div className="picker-list">{options.map((item) => <button key={item.id} className="picker-item" disabled={chosen.has(item.id) || full} onClick={() => onAdd(dayIndex, item.id)}><span>{item.name}</span><em>{chosen.has(item.id) ? 'Added' : item.category}</em></button>)}</div>
          <form className="add-exercise-form" onSubmit={(event) => { event.preventDefault(); if (!newName.trim()) return; onCreate(dayIndex, newName.trim(), newCategory); setNewName('') }}>
            <input aria-label="New exercise name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Not listed? Name a new exercise" />
            <select aria-label="New exercise muscle group" value={newCategory} onChange={(event) => setNewCategory(event.target.value as MuscleGroup)}>{muscleGroups.map((group) => <option key={group}>{group}</option>)}</select>
            <button className="secondary-button" type="submit">Create & add</button>
          </form>
        </div>}
      </article>
    })}</div>
    <section className="preview-card"><div><span className="preview-label">READY?</span><h2>{problem ?? 'Every day is planned.'}</h2><p>Starting locks these exercises until the block is complete.</p></div><button className="primary-button" disabled={problem !== null} onClick={onStart}>Start block <span>→</span></button></section>
  </section>
}
