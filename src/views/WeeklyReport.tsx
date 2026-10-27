import { shortDate } from '../domain/charts'
import { addDays } from '../domain/weekly'
import type { ReportRecord, WeeklyReport as Report } from '../domain/weeklyReport'

interface Props {
  report: Report
  /** Where the card lives: "today" can be dismissed, "progress" cannot. */
  placement: 'today' | 'progress'
  onDismiss?: () => void
}

const count = (value: number, noun: string) => `${value.toLocaleString('en-US')} ${noun}${value === 1 ? '' : 's'}`

const recordText = ({ unit, margin, set }: ReportRecord) => unit === 'reps'
  ? `${count(set.reps, 'rep')}, ${margin} more than before`
  : `${set.weight} lb × ${set.reps}, estimated max up ${margin} lb`

/** Last finished week in plain numbers: workouts, sets, volume, streak, and any personal records. */
export function WeeklyReport({ report, placement, onDismiss }: Props) {
  const id = `report-${placement}`
  const range = `${shortDate(report.weekStart)} – ${shortDate(addDays(report.weekStart, 6))}`
  return <section className={`report-card report-${placement}`} aria-labelledby={`${id}-title`}>
    <div className="report-head">
      <div><span className="eyebrow">Last week · {range}</span><h2 id={`${id}-title`}>{report.workouts === 0 ? 'No workouts last week' : `${count(report.workouts, 'workout')} last week`}</h2></div>
      {onDismiss && <button type="button" className="report-dismiss" aria-label="Dismiss weekly report" onClick={onDismiss}>✕</button>}
    </div>
    <dl className="report-stats">
      <div><dt>Workouts</dt><dd>{report.workouts}</dd></div>
      <div><dt>Sets</dt><dd>{report.sets}</dd></div>
      <div><dt>Volume</dt><dd>{report.volume.toLocaleString('en-US')} <small>lb</small></dd></div>
      <div><dt>Week streak</dt><dd>{report.streak}</dd></div>
    </dl>
    {report.records.length > 0
      ? <div className="report-records"><h3>Personal records</h3><ul>{report.records.map((record) => <li key={record.exerciseId}><strong>{record.exerciseName}</strong> <span>{recordText(record)}</span></li>)}</ul></div>
      : report.workouts > 0 && <p className="report-note">No new personal records.</p>}
  </section>
}
