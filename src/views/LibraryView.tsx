import { useState } from 'react'
import { isEnabled } from '../domain/exercises'
import { muscleGroups, type ExerciseCatalogItem, type MuscleGroup } from '../domain/program'

interface Props {
  catalog: ExerciseCatalogItem[]
  custom: ExerciseCatalogItem[]
  hidden: string[]
  inUse: (id: string) => boolean
  onToggle: (id: string, enabled: boolean) => void
  onToggleGroup: (group: MuscleGroup, enabled: boolean) => void
  /** The handlers below return an error message, or null when the change was made. */
  onAdd: (name: string, category: MuscleGroup) => string | null
  onUpdate: (id: string, name: string, category: MuscleGroup) => string | null
  onDelete: (id: string) => string | null
  onBack: () => void
}

export function LibraryView({ catalog, custom, hidden, inUse, onToggle, onToggleGroup, onAdd, onUpdate, onDelete, onBack }: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<MuscleGroup>('Chest')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState<MuscleGroup>('Chest')
  const [error, setError] = useState('')
  const customIds = new Set(custom.map((item) => item.id))
  const onCount = catalog.filter((item) => isEnabled(hidden, item.id)).length

  const run = (problem: string | null, done?: () => void) => { setError(problem ?? ''); if (!problem) done?.() }

  return <section className="workspace" aria-labelledby="library-title">
    <button className="back-link" onClick={onBack}>← Settings</button>
    <div className="workspace-heading"><div><div className="eyebrow">LIBRARY</div><h1 id="library-title">Exercise library</h1><p>{onCount} of {catalog.length} exercises on. Only the ones that are on show up when you build a program.</p></div></div>

    <section className="setup-card library-add" aria-label="Add an exercise">
      <div className="step-label">Add your own</div>
      <form className="add-exercise-form" onSubmit={(event) => { event.preventDefault(); run(onAdd(name, category), () => setName('')) }}>
        <input aria-label="Exercise name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Exercise name" />
        <select aria-label="Muscle group" value={category} onChange={(event) => setCategory(event.target.value as MuscleGroup)}>{muscleGroups.map((group) => <option key={group}>{group}</option>)}</select>
        <button className="secondary-button" type="submit">Add</button>
      </form>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}

    {muscleGroups.map((group) => {
      const items = catalog.filter((item) => item.category === group)
      const on = items.filter((item) => isEnabled(hidden, item.id)).length
      return <section className="library-group" key={group} aria-label={`${group} exercises`}>
        <div className="library-group-head"><h2>{group}</h2><span className="library-count">{on} of {items.length} on</span>
          <span className="library-bulk"><button className="chip" disabled={on === items.length} onClick={() => onToggleGroup(group, true)} aria-label={`Turn all ${group} exercises on`}>All on</button><button className="chip" disabled={on === 0} onClick={() => onToggleGroup(group, false)} aria-label={`Turn all ${group} exercises off`}>All off</button></span></div>
        {items.length === 0 && <p className="hint">No exercises yet. Add one above.</p>}
        {items.map((item) => {
          const enabled = isEnabled(hidden, item.id)
          const isCustom = customIds.has(item.id)
          if (editing === item.id) return <form className="library-row editing" key={item.id} onSubmit={(event) => { event.preventDefault(); run(onUpdate(item.id, editName, editCategory), () => setEditing(null)) }}>
            <input aria-label={`Rename ${item.name}`} value={editName} maxLength={40} onChange={(event) => setEditName(event.target.value)} />
            <select aria-label="Muscle group" value={editCategory} onChange={(event) => setEditCategory(event.target.value as MuscleGroup)}>{muscleGroups.map((option) => <option key={option}>{option}</option>)}</select>
            <button className="secondary-button" type="submit">Save</button>
            <button className="secondary-button" type="button" onClick={() => { setEditing(null); setError('') }}>Cancel</button>
          </form>
          return <div className={enabled ? 'library-row' : 'library-row is-off'} key={item.id}>
            <button type="button" role="switch" className="switch" aria-checked={enabled} aria-label={`Use ${item.name}`} onClick={() => onToggle(item.id, !enabled)}><span className="switch-thumb" /></button>
            <span className="library-name">{item.name}{isCustom && <small className="badge">Yours</small>}{inUse(item.id) && <small className="badge">In program</small>}</span>
            {isCustom && <span className="library-actions">
              <button className="chip" aria-label={`Edit ${item.name}`} onClick={() => { setEditing(item.id); setEditName(item.name); setEditCategory(item.category); setError('') }}>Edit</button>
              <button className="chip" aria-label={`Delete ${item.name}`} onClick={() => { if (window.confirm(`Delete ${item.name} from your library?`)) run(onDelete(item.id)) }}>Delete</button>
            </span>}
          </div>
        })}
      </section>
    })}
  </section>
}
