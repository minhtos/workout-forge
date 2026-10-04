import type { TrainingDaysPerWeek } from '../domain/program'
import { durationOptions, type ProgramDurationWeeks } from '../domain/progression'

const dayOptions: TrainingDaysPerWeek[] = [3, 4]
const durationNotes: Record<ProgramDurationWeeks, string> = {
  4: 'RIR 3 · 2 · 1 · 0. No deload.',
  5: 'RIR 3 · 2 · 1 · 0, then a deload week.',
  6: 'RIR 3 · 3 · 2 · 2 · 1 · 0. No deload.',
}

interface Props {
  days: TrainingDaysPerWeek
  weeks: ProgramDurationWeeks
  hasHistory: boolean
  onDays: (days: TrainingDaysPerWeek) => void
  onWeeks: (weeks: ProgramDurationWeeks) => void
  onContinue: () => void
}

export function SetupView({ days, weeks, hasHistory, onDays, onWeeks, onContinue }: Props) {
  return <section className="onboarding" aria-labelledby="onboarding-title">
    <div className="eyebrow">{hasHistory ? 'NEW TRAINING BLOCK' : 'YOUR TRAINING SYSTEM'}</div>
    <h1 id="onboarding-title">Set up your next block.</h1>
    <p className="lede">Pick your days and block length. Next you choose the exercises, then they lock in until the block is done.</p>
    <div className="setup-grid">
      <section className="setup-card"><div className="step-label">01 — Training days</div><h2>How many days per week?</h2>
        <div className="choice-grid two" aria-label="Training days per week">{dayOptions.map((value) => <button key={value} className={days === value ? 'choice selected' : 'choice'} aria-label={`${value} days per week`} aria-pressed={days === value} onClick={() => onDays(value)}><strong>{value}</strong><span>{value === 3 ? 'Push / Pull / Legs' : 'Push / Pull A·B'}</span></button>)}</div>
      </section>
      <section className="setup-card"><div className="step-label">02 — Block length</div><h2>How many weeks?</h2>
        <div className="choice-grid" aria-label="Program duration">{durationOptions.map((value) => <button key={value} className={weeks === value ? 'choice selected' : 'choice'} aria-label={`${value} weeks`} aria-pressed={weeks === value} onClick={() => onWeeks(value)}><strong>{value}</strong><span>weeks</span></button>)}</div>
        <p className="hint">{durationNotes[weeks]}</p>
      </section>
    </div>
    <section className="preview-card" aria-label="Program preview"><div><span className="preview-label">YOUR BLOCK</span><h2>{days} days × {weeks} weeks</h2><p>{days * weeks} sessions · RIR-driven progression</p></div><button className="primary-button" onClick={onContinue}>Choose exercises <span>→</span></button></section>
  </section>
}
