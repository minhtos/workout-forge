import { useId, useState } from 'react'
import { guideFor } from '../domain/exerciseGuide'

/** A collapsed "Form cues" toggle and its list, for a built-in exercise. Renders nothing for a custom one. Display-only: the open state is UI state, never stored. */
export function FormCues({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const guide = guideFor(id)
  if (!guide) return null
  return <>
    <button type="button" className="cues-toggle" aria-expanded={open} aria-controls={panelId} aria-label={`${name} form cues`} onClick={() => setOpen((value) => !value)}><span>Form cues</span><svg className="chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg></button>
    <ul id={panelId} className="cues-list" hidden={!open}>{guide.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
  </>
}
