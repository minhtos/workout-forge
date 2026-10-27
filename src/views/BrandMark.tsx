const orange = '#f26b21'

/** The Plate: Workout Forge's mark, drawn on a 100 grid. Never sits on a tile. At 24px and below it drops the spokes and thickens the rings. */
export function BrandMark({ size, decorative = false }: { size: number; decorative?: boolean }) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'Workout Forge' }
  return <svg className="brand-mark" data-testid="brand-mark" width={size} height={size} viewBox="0 0 100 100" {...a11y}>
    {size <= 24
      ? <g fill="none" stroke={orange}><circle cx="50" cy="50" r="39" strokeWidth="14" /><circle cx="50" cy="50" r="12" strokeWidth="11" /></g>
      : <>
        <g fill="none" stroke={orange}><circle cx="50" cy="50" r="40.5" strokeWidth="10" /><circle cx="50" cy="50" r="11.5" strokeWidth="7" /></g>
        <g fill={orange}>{[0, 120, 240].map((angle) => <rect key={angle} x="46" y="16" width="8" height="16" rx="4" transform={`rotate(${angle} 50 50)`} />)}</g>
      </>}
  </svg>
}
