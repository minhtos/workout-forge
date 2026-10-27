import { shortDate } from '../domain/charts'
import type { MuscleMapView, MuscleVolume } from '../domain/muscleVolume'

interface Props {
  view: MuscleMapView
  /** Unique per page: ties the section to its heading. */
  idPrefix: string
  /** Make each row a tab stop so keyboard users get the same row highlight as a mouse (used where the map is a showpiece). */
  focusable?: boolean
  /** Shown under the map, e.g. "Sample data". */
  caption?: string
  /** Replaces the "This week · since …" line, for a map that is not about a real week. */
  period?: string
}

const lb = (value: number) => `${Math.round(value).toLocaleString('en-US')} lb`
const sets = (count: number) => `${count} ${count === 1 ? 'set' : 'sets'}`

const summaryOf = (data: MuscleVolume) => `Sets per muscle group for the week of ${shortDate(data.weekStart)}: ${data.rows.filter((row) => row.sets > 0).map((row) => `${row.group} ${row.sets}`).join(', ')}. The table below lists each group.`

/**
 * "Where the work went": one row per muscle group trained this week (or planned), with a bar sized against the busiest
 * group. With a plan, a group that reached its target reads green and the rest say how many sets are left.
 */
export function MuscleMap({ view, idPrefix, focusable = false, caption, period }: Props) {
  const titleId = `${idPrefix}-title`
  const heading = <h2 id={titleId}>Where the work went</h2>
  if (view.kind === 'empty') return <section className="chart-card muscle-map" aria-labelledby={titleId}>{heading}<p className="chart-empty">{view.first ? 'Your first workout fills this in.' : 'Log a workout to fill this in.'}</p></section>

  const { data } = view
  const planned = data.rows.some((row) => (row.target ?? 0) > 0)
  return <section className="chart-card muscle-map" aria-labelledby={titleId}>
    {heading}
    <p className="chart-sub">Sets and volume per muscle group{planned ? ', against this week’s plan' : ''}.</p>
    <p className="muscle-period">{period ?? (view.kind === 'last' ? 'Last week · log a workout to start this week' : `This week · since ${shortDate(data.weekStart)}`)}</p>
    <div role="group" aria-label={summaryOf(data)}>
      <ul className="muscle-rows">
        {data.rows.map((row) => {
          const target = row.target ?? 0
          const hit = target > 0 && row.sets >= target
          return <li key={row.group} className={hit ? 'muscle-row is-hit' : 'muscle-row'} tabIndex={focusable ? 0 : undefined}>
            <span className="muscle-name">{row.group}</span>
            <span className="muscle-bar" aria-hidden="true"><i style={{ width: `${data.maxSets ? (row.sets / data.maxSets) * 100 : 0}%` }} /></span>
            <span className="muscle-count"><strong>{row.sets}</strong> {row.sets === 1 ? 'set' : 'sets'} · {lb(row.volume)}</span>
            {target > 0 && <span className="muscle-plan">{hit ? 'Target hit' : `${sets(target - row.sets)} to go`}</span>}
          </li>
        })}
      </ul>
    </div>
    {caption && <p className="chart-sub muscle-caption">{caption}</p>}
    <details className="chart-table"><summary>Table view</summary>
      <table><thead><tr><th>Group</th><th>Sets</th><th>Volume</th><th>Plan</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.group}><td>{row.group}</td><td>{row.sets}</td><td>{lb(row.volume)}</td><td>{row.target ? `${row.target} sets` : '—'}</td></tr>)}</tbody></table>
    </details>
  </section>
}
