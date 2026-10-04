# Workout Forge

A local-first PWA for RIR-based hypertrophy training blocks. Built for the gym: you see only today's workout, and every set saves the moment you log it.

## How it works

1. **Pick a block** — 2, 3 or 4 training days per week, for 4 or 6 weeks. Every block ends with a deload week (50% load):
   - 4 weeks: RIR 3, 2, 1, 0, then deload
   - 6 weeks: RIR 3, 3, 2, 2, 1, 0, then deload
2. **Plan each day** — nothing is predefined. Name each day and add exercises from a menu (filter by muscle group, or create your own), set 2–5 sets each, and reorder.
3. **Start the block** — exercises lock until the block is complete.
4. **Train** — the Workout tab shows only the next workout. Each set auto-saves on this device and, when signed in, to Supabase. Progress is suggested from last session's matching set.

Unfinished sessions resume after a reload. Skip, undo-a-set and discard-session are supported.

## Data and backup

- Primary store: browser localStorage (`workout-forge:v3`). Older v2 history is carried forward and the v2 data is left untouched; unreadable data is stashed, never discarded.
- Optional Supabase magic-link sign-in backs up every set (upsert per session, retried when offline) and restores on sign-in. Sessions stay signed in on a device.
- A different account signing in on the same device gets a clean slate; the previous data is archived locally.
- Settings has JSON export/import.
- Not yet backed up to the cloud: the plan/block itself (only logged sets).

## Setup

```bash
npm install
npm run dev
```

Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. In Supabase Auth, set the Site URL and Redirect URLs to your deployed origin (magic links return to the site root). Apply `supabase/migrations/*.sql` in order.

## Verification

```bash
npm test
npm run build
npm run lint
```

## Stack

React, TypeScript, Vite, Vitest, vite-plugin-pwa, Supabase.
