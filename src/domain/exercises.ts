import { mergeCatalog, slugify, type Block, type ExerciseCatalogItem, type MuscleGroup } from './program'

/** Exercises the user turned off in the library. Off exercises are hidden from the menus used to build a program. */
export type HiddenIds = string[]

export function isEnabled(hidden: HiddenIds, id: string): boolean {
  return !hidden.includes(id)
}

export function setExerciseEnabled(hidden: HiddenIds, id: string, enabled: boolean): HiddenIds {
  const without = hidden.filter((entry) => entry !== id)
  return enabled ? without : [...without, id]
}

export function setGroupEnabled(hidden: HiddenIds, catalog: ExerciseCatalogItem[], group: MuscleGroup, enabled: boolean): HiddenIds {
  const ids = new Set(catalog.filter((item) => item.category === group).map((item) => item.id))
  const without = hidden.filter((id) => !ids.has(id))
  return enabled ? without : [...without, ...ids]
}

/** Exercises available when building a program. Pass `keep` to also include ones already chosen. */
export function enabledCatalog(catalog: ExerciseCatalogItem[], hidden: HiddenIds, keep: (string | null)[] = []): ExerciseCatalogItem[] {
  return catalog.filter((item) => isEnabled(hidden, item.id) || keep.includes(item.id))
}

export const exerciseInUse = (block: Block | null, id: string): boolean =>
  !!block?.templates.some((day) => day.exercises.some((entry) => entry.exerciseId === id))

export type LibraryResult = { custom: ExerciseCatalogItem[]; id: string } | { error: string }

function nameProblem(name: string, custom: ExerciseCatalogItem[], ignoreId?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Give the exercise a name.'
  if (trimmed.length > 40) return 'Keep the name under 40 characters.'
  const clash = mergeCatalog(custom).find((item) => item.id !== ignoreId && item.name.toLowerCase() === trimmed.toLowerCase())
  return clash ? `"${clash.name}" is already in the library.` : null
}

export function addCustomExercise(custom: ExerciseCatalogItem[], name: string, category: MuscleGroup): LibraryResult {
  const problem = nameProblem(name, custom)
  if (problem) return { error: problem }
  const base = `custom-${slugify(name)}`
  const taken = new Set(mergeCatalog(custom).map((item) => item.id))
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return { custom: [...custom, { id, name: name.trim(), category }], id }
}

export function updateCustomExercise(custom: ExerciseCatalogItem[], id: string, name: string, category: MuscleGroup): LibraryResult {
  if (!custom.some((item) => item.id === id)) return { error: 'Only exercises you added can be edited.' }
  const problem = nameProblem(name, custom, id)
  if (problem) return { error: problem }
  return { custom: custom.map((item) => (item.id === id ? { ...item, name: name.trim(), category } : item)), id }
}

/** Removes a custom exercise unless the current program uses it. Past workouts keep their saved names. */
export function deleteCustomExercise(custom: ExerciseCatalogItem[], block: Block | null, id: string): LibraryResult {
  if (!custom.some((item) => item.id === id)) return { error: 'Only exercises you added can be removed.' }
  if (exerciseInUse(block, id)) return { error: 'This exercise is in your current program. Finish or replace the block first.' }
  return { custom: custom.filter((item) => item.id !== id), id }
}
