import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { niceTicks, shortDate, type SessionPoint, type WeekBucket } from '../domain/charts'

/**
 * Two hand-drawn SVG charts (no chart library): a line for a trend over time and columns for a weekly total.
 * Colors come from CSS classes so the charts follow the app's light and dark themes. Hover, touch and the
 * arrow keys all drive the same tooltip, and every value is also in the table view under each chart.
 */
const margin = { top: 18, right: 20, bottom: 28, left: 48 }
const groupHint = 'Use the left and right arrow keys to move between points. Escape clears.'

/** Width of the chart's container, measured before first paint and kept up to date. Falls back to 600 where layout is unavailable (tests). */
function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    // oxlint-disable-next-line react/set-state-in-effect
    const measure = () => { const next = Math.round(element.getBoundingClientRect().width); if (next > 0) setWidth(next) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** The index under the pointer or chosen with the keyboard. */
function useActive(count: number) {
  const [raw, setRaw] = useState<number | null>(null)
  const active = raw !== null && raw < count ? raw : null
  const onKeyDown = (event: KeyboardEvent) => {
    if (!count) return
    const move = (next: number) => { event.preventDefault(); setRaw(Math.min(count - 1, Math.max(0, next))) }
    if (event.key === 'ArrowRight') move(active === null ? count - 1 : active + 1)
    else if (event.key === 'ArrowLeft') move(active === null ? count - 1 : active - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(count - 1)
    else if (event.key === 'Escape') setRaw(null)
  }
  return { active, setActive: setRaw, onKeyDown }
}

const pointerX = (event: ReactPointerEvent<SVGRectElement>) => {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX - rect.left
}

/** Sits beside the active mark, on whichever side has room, so it never covers what you are pointing at. */
function Tooltip({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  return <div className={x > width / 2 ? 'chart-tooltip left' : 'chart-tooltip right'} style={{ left: x }} role="status">{children}</div>
}

interface TrendProps { points: SessionPoint[]; summary: string; height?: number }

export function TrendChart({ points, summary, height = 240 }: TrendProps) {
  const { ref, width } = useChartWidth()
  const { active, setActive, onKeyDown } = useActive(points.length)
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const values = points.map((point) => point.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const axis = niceTicks(lo - (hi - lo || lo * 0.05) * 0.25, hi + (hi - lo || hi * 0.05) * 0.25, 4)
  const t0 = points[0].t
  const t1 = points[points.length - 1].t
  const x = (t: number) => margin.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW)
  const y = (value: number) => margin.top + plotH - ((value - axis.min) / (axis.max - axis.min)) * plotH
  const baseline = margin.top + plotH
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.t).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(t1).toFixed(1)},${baseline} L${x(t0).toFixed(1)},${baseline} Z`
  const peak = values.indexOf(hi)
  const last = points.length - 1
  const xTicks = t1 === t0 ? [t0] : [0, 1, 2, 3].map((step) => t0 + ((t1 - t0) * step) / 3)
  const shown = active === null ? null : points[active]

  const onMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const px = pointerX(event)
    let nearest = 0
    points.forEach((point, index) => { if (Math.abs(x(point.t) - px) < Math.abs(x(points[nearest].t) - px)) nearest = index })
    setActive(nearest)
  }

  return <div className="chart" ref={ref} tabIndex={0} role="group" aria-label={summary} aria-describedby="chart-keys-hint" onKeyDown={onKeyDown} onBlur={() => setActive(null)}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {axis.ticks.map((tick) => <g key={tick}>
        <line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
        <text className="chart-tick" x={margin.left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
      </g>)}
      {xTicks.map((tick, index) => <text key={index} className="chart-tick" x={x(tick)} y={height - 8} textAnchor={xTicks.length === 1 ? 'middle' : index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}>{shortDate(tick)}</text>)}
      {points.length > 1 && <path className="chart-area" d={area} />}
      {points.length > 1 && <path className="chart-line" d={line} />}
      {shown && <line className="chart-cursor" x1={x(shown.t)} x2={x(shown.t)} y1={margin.top} y2={baseline} />}
      {points.map((point, index) => <circle key={point.sessionId} className={index === active ? 'chart-dot is-active' : 'chart-dot'} cx={x(point.t)} cy={y(point.value)} r={index === active ? 5.5 : 4} />)}
      {active === null && points.length > 1 && peak !== last && <text className="chart-value" x={x(points[peak].t)} y={y(hi) - 10} textAnchor="middle">{Math.round(hi)}</text>}
      {active === null && <text className="chart-value" x={x(points[last].t)} y={y(points[last].value) - 10} textAnchor={points.length > 1 ? 'end' : 'middle'}>{Math.round(points[last].value)}</text>}
      <rect className="chart-hit" x={margin.left} y={margin.top} width={plotW} height={plotH} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
    </svg>
    {shown && <Tooltip x={x(shown.t)} width={width}>
      <span className="tip-label">{shown.label}</span>
      <span className="tip-row"><i className="tip-key line" /><strong>{Math.round(shown.value)} {shown.unit === 'lb' ? 'lb' : 'reps'}</strong> {shown.unit === 'lb' ? 'estimated max' : 'best set'}</span>
      {shown.unit === 'lb' && <span className="tip-row">Top set {shown.topWeight} × {shown.topReps}</span>}
      <span className="tip-row">Week {shown.weekNumber}</span>
    </Tooltip>}
    <span id="chart-keys-hint" className="visually-hidden">{groupHint}</span>
  </div>
}

interface ColumnProps { buckets: WeekBucket[]; summary: string; height?: number }

export function ColumnChart({ buckets, summary, height = 220 }: ColumnProps) {
  const { ref, width } = useChartWidth()
  const { active, setActive, onKeyDown } = useActive(buckets.length)
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const maxSets = Math.max(...buckets.map((bucket) => bucket.sets), 1)
  const axis = niceTicks(0, maxSets, 4, true)
  const band = plotW / buckets.length
  const barW = Math.min(24, Math.max(4, band - 4))
  const baseline = margin.top + plotH
  const y = (value: number) => baseline - (value / axis.max) * plotH
  const cx = (index: number) => margin.left + band * (index + 0.5)
  const stride = Math.max(1, Math.ceil(52 / band))
  const tallest = buckets.reduce((best, bucket, index) => (bucket.sets > buckets[best].sets ? index : best), 0)
  const lastIndex = buckets.length - 1
  const shown = active === null ? null : buckets[active]

  const barPath = (index: number, sets: number) => {
    const left = cx(index) - barW / 2
    const top = y(sets)
    const radius = Math.min(4, (baseline - top) / 2, barW / 2)
    return `M${left},${baseline} V${top + radius} a${radius},${radius} 0 0 1 ${radius},${-radius} H${left + barW - radius} a${radius},${radius} 0 0 1 ${radius},${radius} V${baseline} Z`
  }
  const onMove = (event: ReactPointerEvent<SVGRectElement>) => setActive(Math.min(buckets.length - 1, Math.max(0, Math.floor((pointerX(event) - margin.left) / band))))

  return <div className="chart" ref={ref} tabIndex={0} role="group" aria-label={summary} aria-describedby="chart-keys-hint-weekly" onKeyDown={onKeyDown} onBlur={() => setActive(null)}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {axis.ticks.map((tick) => <g key={tick}>
        <line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
        <text className="chart-tick" x={margin.left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
      </g>)}
      {buckets.map((bucket, index) => (lastIndex - index) % stride === 0 && <text key={bucket.label} className="chart-tick" x={cx(index)} y={height - 8} textAnchor="middle">{bucket.label}</text>)}
      {buckets.map((bucket, index) => bucket.sets > 0 && <path key={bucket.label} className={index === active ? 'chart-bar is-active' : 'chart-bar'} d={barPath(index, bucket.sets)} />)}
      {active === null && buckets[tallest].sets > 0 && tallest !== lastIndex && <text className="chart-value" x={cx(tallest)} y={y(buckets[tallest].sets) - 6} textAnchor="middle">{buckets[tallest].sets}</text>}
      {active === null && buckets[lastIndex].sets > 0 && <text className="chart-value" x={cx(lastIndex)} y={y(buckets[lastIndex].sets) - 6} textAnchor="middle">{buckets[lastIndex].sets}</text>}
      <rect className="chart-hit" x={margin.left} y={margin.top} width={plotW} height={plotH} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
    </svg>
    {shown && active !== null && <Tooltip x={cx(active)} width={width}>
      <span className="tip-label">Week of {shown.label}</span>
      <span className="tip-row"><i className="tip-key bar" /><strong>{shown.sets} {shown.sets === 1 ? 'set' : 'sets'}</strong></span>
      <span className="tip-row">Volume {Math.round(shown.volume).toLocaleString('en-US')} lb</span>
    </Tooltip>}
    <span id="chart-keys-hint-weekly" className="visually-hidden">{groupHint}</span>
  </div>
}
