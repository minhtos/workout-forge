/** Smallest jump the app prescribes: a pair of 1.25 lb change plates, and the dumbbell step. */
export const weightGrid = 2.5

/** Snaps a calculated weight to a loadable one (nearest 2.5 lb, never below 0), so no target reads like 138.42 lb. */
export const roundWeight = (weight: number): number => Math.max(0, Math.round(weight / weightGrid) * weightGrid)
