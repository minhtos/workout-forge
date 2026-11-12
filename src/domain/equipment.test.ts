import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dumbbellsLb, equipmentKey, fitTarget, fullInventory, jumpLimit, loadEquipment, loadKind, ownedDumbbells, ownedPlates, platesLb, saveEquipment, type EquipmentInventory } from './equipment'
import { plateSizes } from './plateGuide'
import { baseExercises, type ExercisePrescription } from './program'

const item = (id: string) => baseExercises.find((candidate) => candidate.id === id)!
const prescription = (id: string, repRange = { min: 8, max: 15 }, extra: Partial<ExercisePrescription> = {}): ExercisePrescription => ({ ...item(id), sets: 3, repRange, ...extra })
const bench = prescription('barbell-bench-press', { min: 6, max: 12 })
const press = prescription('dumbbell-shoulder-press', { min: 8, max: 12 }) // compound dumbbell lift
const curl = prescription('incline-dumbbell-curls') // isolation, rep max 15
const noTwoPointFives: EquipmentInventory = { missingPlates: [2.5], missingDumbbells: [] }
const onlyDumbbells = (sizes: number[]): EquipmentInventory => ({ missingPlates: [], missingDumbbells: dumbbellsLb.filter((size) => !sizes.includes(size)) })
const fit = (exercise: ExercisePrescription, target: [number, number], from: [number, number], inventory: EquipmentInventory) =>
  fitTarget({ exercise, target: { weight: target[0], reps: target[1] }, from: { weight: from[0], reps: from[1] }, inventory })

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('equipment lists and storage', () => {
  it('T1 pins the plate and dumbbell lists', () => {
    expect(platesLb).toEqual([45, 35, 25, 10, 5, 2.5])
    expect(platesLb).toEqual(plateSizes.lb)
    const expected = [...Array.from({ length: 19 }, (_, index) => 5 + index * 2.5), ...Array.from({ length: 14 }, (_, index) => 55 + index * 5)]
    expect(dumbbellsLb).toEqual(expected)
    expect(dumbbellsLb).toHaveLength(33)
  })

  it('T2 loads the full inventory when nothing is stored, and a full kind is unrestricted', () => {
    expect(loadEquipment()).toEqual(fullInventory)
    expect(ownedPlates(fullInventory)).toBeNull()
    expect(ownedDumbbells(fullInventory)).toBeNull()
  })

  it('T3 round-trips under the storage key with the exact JSON shape', () => {
    saveEquipment({ missingPlates: [35], missingDumbbells: [7.5, 12.5] })
    expect(window.localStorage.getItem(equipmentKey)).toBe('{"version":1,"missingPlates":[35],"missingDumbbells":[7.5,12.5]}')
    expect(equipmentKey).toBe('workout-forge:equipment')
    expect(loadEquipment()).toEqual({ missingPlates: [35], missingDumbbells: [7.5, 12.5] })
    expect(ownedPlates(loadEquipment())).toEqual([45, 25, 10, 5, 2.5])
  })

  it('T4 falls back to full on corrupt input, and a list covering every size means unrestricted', () => {
    const store = (value: string) => window.localStorage.setItem(equipmentKey, value)
    store('{not json')
    expect(loadEquipment()).toEqual(fullInventory)
    store('{"version":2,"missingPlates":[35],"missingDumbbells":[]}')
    expect(loadEquipment()).toEqual(fullInventory)
    store('{"version":1,"missingPlates":[40],"missingDumbbells":[]}')
    expect(loadEquipment()).toEqual(fullInventory)
    store('{"version":1,"missingPlates":["35",35],"missingDumbbells":[]}')
    expect(loadEquipment()).toEqual({ missingPlates: [35], missingDumbbells: [] })
    store(JSON.stringify({ version: 1, missingPlates: platesLb, missingDumbbells: [10] }))
    expect(loadEquipment()).toEqual({ missingPlates: [], missingDumbbells: [10] })
  })

  it('T5 returns full when storage throws, and saving does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadEquipment()).toEqual(fullInventory)
    expect(() => saveEquipment({ missingPlates: [35], missingDumbbells: [] })).not.toThrow()
  })
})

describe('loadKind', () => {
  it('T6 classifies barbell, dumbbell and untouched exercises', () => {
    const barbells = baseExercises.filter((candidate) => candidate.barbell).map((candidate) => candidate.id)
    expect([...barbells].sort()).toEqual(['barbell-bench-press', 'barbell-incline-bench-press', 'barbell-row', 'barbell-deadlift', 'barbell-overhead-press', 'barbell-curls', 'barbell-wrist-curl', 'barbell-squat', 'barbell-hip-thrust'].sort())
    expect(barbells).toHaveLength(9)
    for (const id of barbells) expect(loadKind(item(id))).toBe('barbell')

    const dumbbells = ['dumbbell-incline-bench-press', 'dumbbell-fly', 'dumbbell-shoulder-press', 'lateral-raise', 'rear-delt-fly', 'dumbbell-tricep-extension', 'incline-dumbbell-curls', 'reverse-wrist-curl', 'farmers-carry', 'dumbbell-rdl', 'dumbbell-walking-lunge']
    for (const id of dumbbells) expect(loadKind(item(id))).toBe('dumbbell')
    expect(loadKind({ id: 'custom-1', name: 'Dumbbell Hammer Curl' })).toBe('dumbbell')

    for (const id of ['tbar-row', 'good-mornings', 'reverse-barbell-curl', 'pull-down', 'leg-press-machine', 'pull-ups']) expect(loadKind(item(id))).toBeNull()
    expect(loadKind({ id: 'custom-2', name: 'Barbell Pin Press' })).toBeNull()
  })
})

describe('fitTarget', () => {
  it('T7 GOLDEN: the full inventory returns every target unchanged', () => {
    for (const exercise of [bench, press, prescription('leg-press-machine')]) {
      for (let weight = 0; weight <= 400; weight += 2.5) {
        for (const from of [0, 100, 200]) expect(fit(exercise, [weight, 9], [from, 8], fullInventory)).toEqual({ weight, reps: 9, note: null })
      }
    }
  })

  it('T8 leaves machine and cable exercises alone even with both kinds restricted', () => {
    const restricted: EquipmentInventory = { missingPlates: [2.5, 35], missingDumbbells: [7.5, 12.5, 17.5, 22.5] }
    for (const id of ['leg-press-machine', 'pull-down']) expect(fit(prescription(id), [137.5, 10], [135, 10], restricted)).toEqual({ weight: 137.5, reps: 10, note: null })
  })

  it('T9 keeps a barbell target the owned plates already make (no 35s)', () => {
    expect(fit(bench, [115, 8], [110, 8], { missingPlates: [35], missingDumbbells: [] })).toEqual({ weight: 115, reps: 8, note: null })
  })

  it('T10 snaps a barbell target without 2.5s: up when adding, down otherwise', () => {
    expect(fit(bench, [140, 8], [135, 8], noTwoPointFives)).toEqual({ weight: 145, reps: 8, note: 'Rounded to 145 lb to match your plates.' })
    expect(fit(bench, [137.5, 8], [150, 8], noTwoPointFives).weight).toBe(135)
    expect(fit(bench, [67.5, 8], [135, 8], noTwoPointFives).weight).toBe(65)
  })

  it('T11 leaves a barbell target below the bar alone', () => {
    expect(fit(bench, [40, 8], [40, 8], noTwoPointFives)).toEqual({ weight: 40, reps: 8, note: null })
  })

  it('T12 holds or drops a dumbbell to an owned size', () => {
    const fiveLbRack = onlyDumbbells(dumbbellsLb.filter((size) => size % 5 === 0))
    expect(fit(curl, [30, 10], [35, 10], fiveLbRack)).toEqual({ weight: 30, reps: 10, note: null })
    expect(fit(curl, [27.5, 10], [30, 10], fiveLbRack)).toEqual({ weight: 25, reps: 10, note: 'Adjusted to 25 lb to match your dumbbells.' })
    expect(fit(curl, [12.5, 10], [15, 10], onlyDumbbells([20, 25])).weight).toBe(20)
  })

  it('T13 steps to the next dumbbell when the jump is within the limit', () => {
    expect(jumpLimit).toEqual({ isolation: 0.1, compound: 0.15 })
    expect(fit(curl, [52.5, 10], [50, 10], onlyDumbbells([50, 55]))).toEqual({ weight: 55, reps: 10, note: 'Next dumbbell you have: 55 lb.' })
  })

  it('T14 holds and adds a rep when the jump is too big and the rep range has room', () => {
    expect(fit(curl, [27.5, 12], [25, 12], onlyDumbbells([25, 30, 35]))).toEqual({ weight: 25, reps: 13, note: 'The next dumbbell you have (30 lb) is a big jump: staying at 25 lb, +1 rep.' })
  })

  it('T15 takes the jump back at the bottom of the range once the reps are maxed', () => {
    expect(fit(curl, [27.5, 8], [25, 15], onlyDumbbells([25, 30, 35]))).toEqual({ weight: 30, reps: 8, note: 'Top of the rep range: up to 30 lb, the next dumbbell you have, back to 8 reps.' })
  })

  it('T16 gives compound lifts the looser jump limit', () => {
    const rack = onlyDumbbells([35, 40])
    expect(fit(press, [37.5, 9], [35, 9], rack).weight).toBe(40)
    expect(fit(curl, [37.5, 9], [35, 9], rack)).toMatchObject({ weight: 35, reps: 10 })
  })

  it('T17 holds at the heaviest dumbbell, adding a rep until the rep max', () => {
    const rack = onlyDumbbells([45, 50])
    expect(fit(curl, [55, 10], [50, 10], rack)).toEqual({ weight: 50, reps: 11, note: '50 lb is your heaviest dumbbell: staying there, +1 rep.' })
    expect(fit(curl, [55, 8], [50, 15], rack)).toEqual({ weight: 50, reps: 15, note: '50 lb is your heaviest dumbbell: staying there at 15 reps.' })
  })

  it('T18 never stalls a barbell progressing +5 without 2.5s', () => {
    let from = 135
    const weights: number[] = []
    for (let session = 0; session < 4; session += 1) {
      from = fit(bench, [from + 5, 8], [from, 8], noTwoPointFives).weight
      weights.push(from)
    }
    expect(weights).toEqual([145, 155, 165, 175])
  })

  it('T42 fits a below-range dumbbell increase to the lightest owned size at the target reps', () => {
    const rack = onlyDumbbells([10, 12.5, 15])
    const lateralRaise = curl
    expect(fit(lateralRaise, [7.5, 12], [5, 12], rack)).toEqual({ weight: 10, reps: 12, note: 'Lightest dumbbell you have: 10 lb.' })
    // maxed reps still take the target reps, not the top-of-range reset
    expect(fit(lateralRaise, [7.5, 8], [5, 15], rack)).toEqual({ weight: 10, reps: 8, note: 'Lightest dumbbell you have: 10 lb.' })
    // in range is untouched: 10 -> 12.5 is a 25% jump, so it holds and adds a rep
    expect(fit(lateralRaise, [11, 12], [10, 12], rack)).toEqual({ weight: 10, reps: 13, note: 'The next dumbbell you have (12.5 lb) is a big jump: staying at 10 lb, +1 rep.' })
  })

  it('T43 a hold or drop that lands above the from weight keeps its reps and says "Adjusted", never "staying"', () => {
    expect(fit(curl, [5, 12], [5, 12], onlyDumbbells([10, 12.5]))).toEqual({ weight: 10, reps: 12, note: 'Adjusted to 10 lb to match your dumbbells.' })
  })

  it('T45 never says "staying" when a typed off-inventory weight drops to the size below it', () => {
    const fiveLbRack = onlyDumbbells(dumbbellsLb.filter((size) => size % 5 === 0 && size <= 25))
    expect(fit(curl, [30, 10], [27.5, 10], fiveLbRack)).toEqual({ weight: 25, reps: 11, note: 'Adjusted to 25 lb, your heaviest dumbbell, +1 rep.' })
    expect(fit(curl, [30, 8], [27.5, 15], fiveLbRack)).toEqual({ weight: 25, reps: 15, note: 'Adjusted to 25 lb, your heaviest dumbbell, at 15 reps.' })
    expect(fit(curl, [30, 10], [27.5, 10], onlyDumbbells([20, 25, 40]))).toEqual({ weight: 25, reps: 11, note: 'The next dumbbell you have (40 lb) is a big jump: adjusted to 25 lb, +1 rep.' })
  })
})
