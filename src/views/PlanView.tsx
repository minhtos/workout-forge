import { useState } from 'react'
import { muscleGroups, planProblem, setCountOptions, type Block, type ExerciseCatalogItem, type MuscleGroup, type PlanSlot } from '../domain/program'

interface Props {
  block: Block
  catalog: ExerciseCatalogItem[]
  onSlot: (dayIndex: number, slotIndex: number, patch: Partial<PlanSlot>) => void
  onAddExercise: (name: string, category: MuscleGroup) => void
  onAutoFill: () => void
  onBack: () => void
  onStart: () => void
}

export function PlanView({ block, catalog, onSlot, onAddExercise, onAutoFill, onBack, onStart }: Props) {
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<MuscleGroup>('Chest')
  const problem = planProblem(block, catalog)

  return <section className="workspace" aria-labelledby="plan-title">
    <div className="workspace-heading"><div><div className="eyebrow">{block.durationWeeks}-WEEK BLOCK · {block.trainingDays} DAYS / WEEK</div><h1 id="plan-title">Choose your exercises</h1><p>Each day sets the muscle groups. Pick the exercise for every slot — they lock in once you start.</p></div><div className="button-row"><button className="secondary-button" onClick={onBack}>Back</button><button className="secondary-button" onClick={onAutoFill}>Fill suggested exercises</button></div></div>
    <div className="plan-grid">{block.templates.map((template, dayIndex) => <article className="setup-card" key={template.title}>
      <div className="step-label">Day {dayIndex + 1}</div><h2>{template.title}</h2>
      {template.slots.map((slot, slotIndex) => {
        const label = `Day ${dayIndex + 1} slot ${slotIndex + 1}`
        const takenElsewhere = new Set(template.slots.filter((_, index) => index !== slotIndex).map((other) => other.exerciseId))
        return <div className="plan-slot" key={slotIndex}>
          <span className="slot-label">{slot.category}</span>
          <select aria-label={`${label} exercise`} value={slot.exerciseId ?? ''} onChange={(event) => onSlot(dayIndex, slotIndex, { exerciseId: event.target.value || null })}>
            <option value="">Choose exercise…</option>
            {catalog.filter((item) => item.category === slot.category).map((item) => <option key={item.id} value={item.id} disabled={takenElsewhere.has(item.id)}>{item.name}</option>)}
          </select>
          <select aria-label={`${label} sets`} value={slot.sets} onChange={(event) => onSlot(dayIndex, slotIndex, { sets: Number(event.target.value) })}>{setCountOptions.map((count) => <option key={count} value={count}>{count} sets</option>)}</select>
        </div>
      })}
    </article>)}</div>
    <section className="setup-card add-exercise"><div className="step-label">Not in the list?</div><h2>Add an exercise</h2>
      <form onSubmit={(event) => { event.preventDefault(); if (!newName.trim()) return; onAddExercise(newName.trim(), newCategory); setNewName('') }}>
        <input aria-label="New exercise name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Exercise name" />
        <select aria-label="New exercise muscle group" value={newCategory} onChange={(event) => setNewCategory(event.target.value as MuscleGroup)}>{muscleGroups.map((group) => <option key={group}>{group}</option>)}</select>
        <button className="secondary-button" type="submit">Add</button>
      </form>
    </section>
    <section className="preview-card"><div><span className="preview-label">READY?</span><h2>{problem ?? 'Everything is chosen.'}</h2><p>Starting locks these exercises until the block is complete.</p></div><button className="primary-button" disabled={problem !== null} onClick={onStart}>Start block <span>→</span></button></section>
  </section>
}
