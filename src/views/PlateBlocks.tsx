import type { CSSProperties } from 'react'
import { plateLoad } from '../domain/plateGuide'

/** Blocks grow with the plate's weight but never below a width that fits their label. */
const blockWidth = (plate: number) => Math.max(38, Math.round(plate * 1.5))

/** The barbell plate guide: [Bar 45] then one labeled block per plate on one side, heaviest first (the other side mirrors it). */
export function PlateBlocks({ weight }: { weight: number }) {
  const load = plateLoad(weight, 'lb')
  if (!load) return null
  const { bar, plates, total, requested } = load
  const heaviest = plates[0]
  const spoken = `Bar ${bar} lb${plates.length ? `, plates per side: ${plates.join(' and ')}` : ', no plates'} — total ${total} lb`
  const notes = [plates.length === 0 ? 'Bar only' : 'per side', total !== requested && `makes ${total} lb`].filter(Boolean)
  return <div className="plate-blocks">
    <div className="plate-row" role="img" aria-label={spoken}>
      <span className="plate-block is-bar" aria-hidden="true">Bar {bar}</span>
      {plates.map((plate, index) => <span key={index} className={plate === heaviest ? 'plate-block is-lightest' : 'plate-block'} style={{ minWidth: blockWidth(plate), '--tone': `${45 + Math.round((plate / heaviest) * 55)}%` } as CSSProperties} aria-hidden="true">{plate}</span>)}
    </div>
    <span className="plate-note">{notes.join(' · ')}</span>
  </div>
}
