import { useEffect, useRef, useState } from 'react'
import type { Effort, FeedbackPrompt, Pump, Soreness } from '../domain/autoregulation'

interface Props {
  prompt: FeedbackPrompt
  onSoreness: (value: Soreness) => void
  onSummary: (effort: Effort, pump: Pump) => void
  /** Skipping soreness counts as "just on time"; skipping effort and pump changes nothing. */
  onSkip: () => void
}

const sorenessChoices: { value: Soreness; label: string; effect: (group: string) => string }[] = [
  { value: 'sore', label: 'Still sore', effect: (group) => `Takes a set off your ${group} exercises` },
  { value: 'ontime', label: 'Recovered just on time', effect: () => 'Keeps your sets as planned' },
  { value: 'early', label: 'Recovered early', effect: (group) => `Adds a set to your ${group} exercises` },
]
const effortChoices: { value: Effort; label: string; effect: string }[] = [
  { value: 'easy', label: 'Easy', effect: 'More weight next time' },
  { value: 'right', label: 'Just right', effect: 'Small weight increase' },
  { value: 'hard', label: 'Too hard', effect: 'Weight stays the same' },
]
const pumpChoices: { value: Pump; label: string; effect: string }[] = [
  { value: 'low', label: 'Low', effect: 'Adds a rep next time' },
  { value: 'high', label: 'High', effect: 'Reps stay the same' },
]

export function FeedbackSheet({ prompt, onSoreness, onSummary, onSkip }: Props) {
  const [effort, setEffort] = useState<Effort | null>(null)
  const [pump, setPump] = useState<Pump | null>(null)
  const first = useRef<HTMLButtonElement>(null)
  const group = prompt.group.toLowerCase()
  useEffect(() => { first.current?.focus() }, [])

  return <div className="sheet-backdrop">
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      {prompt.kind === 'soreness'
        ? <>
          <span className="eyebrow">Recovery check</span>
          <h2 id="sheet-title">How is your {group} recovery?</h2>
          <p>Compared with your last {group} workout, how did you feel coming in?</p>
          <div className="sheet-choices">{sorenessChoices.map((choice, index) => <button key={choice.value} ref={index === 0 ? first : undefined} className="sheet-choice" onClick={() => onSoreness(choice.value)}><strong>{choice.label}</strong><span>{choice.effect(group)}</span></button>)}</div>
          <button className="sheet-skip" onClick={onSkip}>Skip</button>
        </>
        : <>
          <span className="eyebrow">{prompt.group} done</span>
          <h2 id="sheet-title">How did your {group} work go?</h2>
          <div className="sheet-question">Effort</div>
          <div className="sheet-choices three" role="group" aria-label="Perceived effort">{effortChoices.map((choice, index) => <button key={choice.value} ref={index === 0 ? first : undefined} className="sheet-choice" aria-pressed={effort === choice.value} onClick={() => setEffort(choice.value)}><strong>{choice.label}</strong><span>{choice.effect}</span></button>)}</div>
          <div className="sheet-question">Muscle pump</div>
          <div className="sheet-choices two" role="group" aria-label="Muscle pump">{pumpChoices.map((choice) => <button key={choice.value} className="sheet-choice" aria-pressed={pump === choice.value} onClick={() => setPump(choice.value)}><strong>{choice.label}</strong><span>{choice.effect}</span></button>)}</div>
          <div className="sheet-actions"><button className="sheet-skip" onClick={onSkip}>Skip</button><button className="primary-button" disabled={!effort || !pump} onClick={() => effort && pump && onSummary(effort, pump)}>Save</button></div>
        </>}
    </div>
  </div>
}
