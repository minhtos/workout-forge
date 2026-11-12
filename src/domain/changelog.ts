export interface ChangelogEntry {
  /** Only releases from 0.1.0 on carry a version; earlier entries are dated only. */
  version?: string
  /** YYYY-MM-DD */
  date: string
  notes: string[]
}

/** The one place the build-time version is read. */
export const appVersion: string = __APP_VERSION__

/** Newest first. A feature PR adds its entry here and bumps package.json; changelog.test.ts keeps the two together. */
export const changelog: ChangelogEntry[] = [
  {
    version: '0.2.1',
    date: '2026-11-11',
    notes: [
      'Fixed: dumbbell suggestions now name your actual heaviest dumbbell when a target goes past the top of your rack, and step up to it when the jump is small enough.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-11',
    notes: [
      "New: Settings → Equipment — uncheck the plates and dumbbells your gym doesn't have, and suggested weights, plate loads and warm-ups fit what's left.",
      'A weight you type is always kept, and nothing changes until you edit the list.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-11',
    notes: [
      "New: What's New — after each update, a short note like this tells you what changed.",
      'New: Settings → Changelog lists every update, newest first.',
    ],
  },
  {
    date: '2026-11-08',
    notes: ['Renamed: Cable Pulldown is now Cable Rope Pushdown, and Cable Single Arm Pulldown is now Cable Single Arm Pushdown. Your history and plans carry over.'],
  },
  {
    date: '2026-11-07',
    notes: ['New: form cues and an equipment chip for each exercise, in your workout and in the exercise library.'],
  },
  {
    date: '2026-11-05',
    notes: [
      'New: Export CSV in Settings → Device copy — your completed sets as a spreadsheet.',
      'New: warm-up hint above the set table for barbell compound lifts.',
      'New: usual weekly set ranges on the Progress muscle map.',
    ],
  },
]

/** Parsed as local time: new Date('YYYY-MM-DD') is UTC and shows the previous day in US time zones. */
export const formatChangelogDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
