# Workout Forge

**Live at https://workoutforge.app** — a local-first PWA for RIR-based hypertrophy training blocks. Built for the gym: you see only today's workout, and every set saves the moment you log it.

## How it works

1. **Pick a block** — 2, 3 or 4 training days per week, for 4 or 6 weeks. Every block ends with a deload week (50% load):
   - 4 weeks: RIR 3, 2, 1, 0, then deload
   - 6 weeks: RIR 3, 3, 2, 2, 1, 0, then deload
2. **Plan each day** — start from a **Workout Set** or build it yourself. Sets predefine muscle groups and you pick one exercise per slot: Push | Pull | Legs (3 days), Push | Pull A/B (4 days), Whole Body (2 days). **StrongLifts 5x5** (3 days): workouts A/B alternate, lifts are prefilled, and weight goes up 5 lb per session (10 lb deadlift) once every rep is hit. Or add exercises from a menu (filter by muscle group, create your own), set 1–5 sets each, and reorder.
3. **Start the block** — exercises lock until the block is complete.
4. **Train** — the Workout tab shows only the next workout. Each set auto-saves on this device and, when signed in, to Supabase. Progress is suggested from last session's matching set.

Unfinished sessions resume after a reload. Skip, undo-a-set and discard-session are supported.

## Data and backup

- Primary store: browser localStorage (`workout-forge:v3`). Older v2 history is carried forward and the v2 data is left untouched; unreadable data is stashed, never discarded.
- Optional Supabase magic-link sign-in backs up every set (upsert per session, retried when offline) and restores on sign-in. Sessions stay signed in on a device.
- A different account signing in on the same device gets a clean slate; the previous data is archived locally.
- Settings has JSON export/import. Each muscle group holds at most 12 exercises (built-in plus your own).
- Your program also backs up to Supabase (`user_programs`, one row per user): the current block with its progress, your own exercises, and the exercise-library on/off switches. The newest copy wins by timestamp, so a new device that signs in picks it up; a newer cloud copy waits until a workout in progress is finished. The rest-timer setting stays per device.

## Setup

```bash
npm install
npm run dev
```

Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. In Supabase Auth, set the Site URL and Redirect URLs to your deployed origin, `https://workoutforge.app` (magic links return to the site root). Apply `supabase/migrations/*.sql` in order.

## Verification

```bash
npm test
npm run build
npm run lint
```

## How progression works (RIR blocks)

The weekly target RIR steps down through the block (4 weeks: 3, 2, 1, 0; 6 weeks: 3, 3, 2, 2, 1, 0) and the last week is a deload (50% of the last working weight, same reps, planned sets). Three quick questions then steer each muscle group, and every answer can be skipped:

- **Recovery** (after the first exercise of a muscle group, only if you trained it before): *still sore* takes a set off every exercise for that muscle group, *just on time* changes nothing, *recovered early* adds a set. It applies to the unstarted exercises today and carries through the rest of the block (2 to 6 sets per exercise, at most 3 up or down in total). Sets are the only thing this changes.
- **Effort** (after the last exercise of a muscle group): *easy* adds 5% to the weight next time (10% if you logged 2+ reps in reserve beyond the target), *just right* adds 2.5%, *too hard* keeps the weight. Weights move in 2.5 lb steps. Weight is the only thing this changes.
- **Muscle pump** (same prompt): *low* adds a rep next time (two if the previous check was also low), *high* keeps reps. Past the top of the rep range it adds weight and goes back to the bottom of the range. Reps are the only thing this changes.

If you skip a question the standard RIR rule is used instead. The deload week and StrongLifts 5x5 never ask. Answers are stored with the session and back up with the program.
## Hosting notes

- Production is https://workoutforge.app (Vercel, auto-deploys from `main`). `vercel.json` forwards the old `workout-forge-iota.vercel.app` address to it; add `?keep=1` to the old address to reach the old site (for example to export data saved there).
- Inter is bundled in `src/assets/fonts` (SIL OFL) and precached by the service worker, so the app needs no third-party font requests.

## Stack

React, TypeScript, Vite, Vitest, vite-plugin-pwa, Supabase.
