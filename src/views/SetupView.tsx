import { dayOptions, type TrainingDaysPerWeek } from '../domain/program'
import { lengthLabel, lengthOptions, shapeOf, totalWeeks, type ProgramLength } from '../domain/progression'

interface Props {
  days: TrainingDaysPerWeek
  weeks: ProgramLength
  hasHistory: boolean
  onDays: (days: TrainingDaysPerWeek) => void
  onWeeks: (weeks: ProgramLength) => void
  onContinue: () => void
}

export function SetupView({ days, weeks, hasHistory, onDays, onWeeks, onContinue }: Props) {
  return <section className="onboarding" aria-labelledby="onboarding-title">
    <div className="eyebrow">{hasHistory ? 'NEW TRAINING BLOCK' : 'YOUR TRAINING SYSTEM'}</div>
    <h1 id="onboarding-title">Set up your next block.</h1>
    <p className="lede">Pick your days and block length. Next you choose the exercises for each day, then they lock in until the block is done.</p>
    <div className="setup-grid">
      <section className="setup-card"><div className="step-label">01 — Training days</div><h2>How many days per week?</h2>
        <div className="choice-grid" aria-label="Training days per week">{dayOptions.map((value) => <button key={value} className={days === value ? 'choice selected' : 'choice'} aria-label={`${value} days per week`} aria-pressed={days === value} onClick={() => onDays(value)}><strong>{value}</strong><span>days / week</span></button>)}</div>
      </section>
      <section className="setup-card"><div className="step-label">02 — Block length</div><h2>How many weeks?</h2>
        <div className="choice-grid two" aria-label="Program duration">{lengthOptions.map((value) => <button key={value} className={weeks === value ? 'choice selected' : 'choice'} aria-label={`${value} weeks`} aria-pressed={weeks === value} onClick={() => onWeeks(value)}><strong>{value}</strong><span>{value === 12 ? 'weeks · 2 deloads' : 'weeks + deload'}</span></button>)}</div>
      </section>
    </div>
    <section className="preview-card" aria-label="Program preview"><div><span className="preview-label">YOUR BLOCK</span><h2>{days} days × {lengthLabel(weeks)}</h2><p>{days * totalWeeks(shapeOf(weeks).durationWeeks) * shapeOf(weeks).parts} sessions · RIR-driven progression</p></div><button className="primary-button" onClick={onContinue}>Choose exercises <span>→</span></button></section>
  </section>
}
