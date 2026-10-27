import { blockIntents, blockTitle, dayOptions, intentLabels, type BlockIntent, type TrainingDaysPerWeek } from '../domain/program'
import { lengthLabel, lengthOptions, shapeOf, totalWeeks, type ProgramLength } from '../domain/progression'

interface Props {
  days: TrainingDaysPerWeek
  weeks: ProgramLength
  /** The goal picked so far. Optional: null means none. */
  intent: BlockIntent | null
  /** Whole weeks since the last workout when a Comeback block is worth suggesting, otherwise null. */
  comebackWeeks: number | null
  hasHistory: boolean
  onDays: (days: TrainingDaysPerWeek) => void
  onWeeks: (weeks: ProgramLength) => void
  onIntent: (intent: BlockIntent | null) => void
  onContinue: () => void
}

const intentHints: Record<BlockIntent, string> = { consistent: 'Show up every week', push: 'Add weight and reps', comeback: 'Ease back in' }

export function SetupView({ days, weeks, intent, comebackWeeks, hasHistory, onDays, onWeeks, onIntent, onContinue }: Props) {
  const shape = shapeOf(weeks)
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
      <section className="setup-card wide"><div className="step-label">03 — Goal</div><h2>What is this block for? <small>Optional</small></h2>
        <div className="choice-grid" role="group" aria-label="Block goal">{blockIntents.map((value) => <button key={value} className={intent === value ? 'choice selected' : 'choice'} aria-pressed={intent === value} onClick={() => onIntent(intent === value ? null : value)}><strong>{intentLabels[value]}</strong><span>{intentHints[value]}</span>{value === 'comeback' && comebackWeeks !== null && <em className="choice-badge">Suggested</em>}</button>)}</div>
        {comebackWeeks !== null && <p className="hint">It's been {comebackWeeks} weeks since your last workout. Comeback is a good fit if you're easing back in.</p>}
      </section>
    </div>
    <section className="preview-card" aria-label="Program preview"><div><span className="preview-label">YOUR BLOCK</span><h2>{blockTitle({ trainingDays: days, ...shape, intent })}</h2><p>{days} days × {lengthLabel(weeks)} · {days * totalWeeks(shape.durationWeeks) * shape.parts} sessions · RIR-driven progression</p></div><button className="primary-button" onClick={onContinue}>Choose exercises <span>→</span></button></section>
  </section>
}
