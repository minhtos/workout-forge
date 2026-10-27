import { useState, type KeyboardEvent } from 'react'
import { shortDate } from '../domain/charts'
import { heatmap, weekStart, weekStreak, sessionsInWeek, type CompletedSession, type HeatDay } from '../domain/weekly'

interface Props { sessions: CompletedSession[]; now: Date }

interface Cell { week: number; day: number }

const groupHint = 'Use the arrow keys to move between days. Escape clears.'

/** The week streak and the last 12 weeks as a grid (a column per week, a row per day, Sunday first). */
export function TrainingRhythm({ sessions, now }: Props) {
  const weeks = heatmap(sessions, now)
  const streak = weekStreak(sessions, now)
  const quietSoFar = streak > 0 && sessionsInWeek(sessions, weekStart(now)).length === 0
  const [cell, setCell] = useState<Cell | null>(null)
  const shown = cell ? weeks[cell.week]?.days[cell.day] ?? null : null
  const trainedDays = weeks.reduce((sum, week) => sum + week.days.filter((day) => day && day.workouts > 0).length, 0)

  const onKeyDown = (event: KeyboardEvent) => {
    const latest: Cell = { week: weeks.length - 1, day: weeks[weeks.length - 1].days.filter(Boolean).length - 1 }
    const move = (week: number, day: number) => {
      event.preventDefault()
      const w = Math.min(weeks.length - 1, Math.max(0, week))
      const d = Math.min(weeks[w].days.filter(Boolean).length - 1, Math.max(0, day))
      setCell({ week: w, day: d })
    }
    const at = cell ?? latest
    if (event.key === 'ArrowRight') move(cell ? at.week + 1 : at.week, at.day)
    else if (event.key === 'ArrowLeft') move(cell ? at.week - 1 : at.week, at.day)
    else if (event.key === 'ArrowDown') move(at.week, cell ? at.day + 1 : at.day)
    else if (event.key === 'ArrowUp') move(at.week, cell ? at.day - 1 : at.day)
    else if (event.key === 'Home') move(0, at.day)
    else if (event.key === 'End') move(latest.week, at.day)
    else if (event.key === 'Escape') setCell(null)
  }

  return <section className="chart-card rhythm" aria-labelledby="rhythm-title">
    <h2 id="rhythm-title">Consistency</h2>
    <p className="chart-sub">Weeks run Sunday to Saturday. A week counts when it has at least one completed workout.</p>
    <div className="stat-row rhythm-stats"><div className="stat"><span>Week streak</span><strong className="numeral-lg">{streak} {streak === 1 ? 'week' : 'weeks'}</strong></div></div>
    {quietSoFar && <p className="chart-sub">Counted through last week. A workout this week extends it.</p>}
    <div className="heatmap" tabIndex={0} role="group" aria-label={`Training days over the last ${weeks.length} weeks: ${trainedDays} days with a workout. The table below lists every week.`} aria-describedby="heatmap-keys-hint" onKeyDown={onKeyDown} onBlur={() => setCell(null)}>
      <div className="heat-grid" aria-hidden="true">
        {weeks.map((week, weekIndex) => <div className="heat-week" key={week.start.getTime()}>
          {week.days.map((day, dayIndex) => day
            ? <i key={day.key} className={`heat-cell heat-${day.level}${cell?.week === weekIndex && cell.day === dayIndex ? ' is-active' : ''}`} onPointerEnter={() => setCell({ week: weekIndex, day: dayIndex })} onPointerLeave={() => setCell(null)} />
            : null)}
        </div>)}
      </div>
      {shown && cell && <HeatTip day={shown} week={cell.week} of={weeks.length} />}
      <span id="heatmap-keys-hint" className="visually-hidden">{groupHint}</span>
    </div>
    <details className="chart-table"><summary>Table view</summary>
      <table><thead><tr><th>Week of</th><th>Workouts</th><th>Sets</th></tr></thead><tbody>{weeks.map((week) => <tr key={week.start.getTime()}><td>{shortDate(week.start)}</td><td>{week.workouts}</td><td>{week.sets}</td></tr>)}</tbody></table>
    </details>
  </section>
}

function HeatTip({ day, week, of }: { day: HeatDay; week: number; of: number }) {
  return <div className={week > of / 2 ? 'chart-tooltip left heat-tip' : 'chart-tooltip right heat-tip'} style={{ left: `${((week + 0.5) / of) * 100}%` }} role="status">{day.label}</div>
}
