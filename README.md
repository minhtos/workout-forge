# Workout Forge

**Live at https://workoutforge.app** — a local-first PWA for RIR-based hypertrophy training blocks. Built for the gym: you see only today's workout, and every set saves the moment you log it.

## How it works

1. **Pick a block** — 2, 3 or 4 training days per week, for 4, 6, 8 or 12 weeks. Every block ends with a deload week (50% load):
   - 4 weeks: RIR 3, 2, 1, 0, then deload
   - 6 weeks: RIR 3, 2, 2, 1, 1, 0, then deload
   - 8 weeks: RIR 3, 3, 2, 2, 1, 1, 0, 0, then deload
   - 12 weeks: two 6-week parts back to back (6 weeks, deload, 6 weeks, deload). When part 1 is done the app offers part 2, which runs like a new block: the same exercises, Week 1 starting from your last 0 RIR numbers, reps back at the bottom of the range, and sets carried over minus one.
2. **Plan each day** — start from a **Workout Set** or build it yourself. Sets predefine the muscle groups and start every slot with a beginner-friendly default exercise (mostly machines, cables and dumbbells, with a barbell lift opening some days); swap any slot from its menu: Whole Body (2 days), Push | Pull | Legs (3 days), Push | Pull A/B, Upper | Lower x2, PPL + Accessory Day and The Bro Split (4 days each; the Bro Split opens each day with its main compound lift prefilled). **StrongLifts 5x5** (3 days): workouts A/B alternate, lifts are prefilled, and weight goes up 5 lb per session (10 lb deadlift) once every rep is hit. Or add exercises from a menu (filter by muscle group, create your own), set 1–5 sets each, and reorder.
3. **Start the block** — exercises lock until the block is complete.
4. **Train** — the Workout tab shows only the next workout. Each set auto-saves on this device and, when signed in, to Supabase. Progress is suggested from last session's matching set.

Unfinished sessions resume after a reload. Skip, undo-a-set and discard-session are supported.

## Data and backup

- Primary store: browser localStorage (`workout-forge:v3`). Older v2 history is carried forward and the v2 data is left untouched; unreadable data is stashed, never discarded.
- Optional Supabase email + password accounts (sign up, sign in, forgot password) back up every set (upsert per session, retried when offline) and restore on sign-in. Sessions stay signed in on a device.
- A different account signing in on the same device gets a clean slate; the previous data is archived locally.
- Settings has JSON export/import. Each muscle group holds at most 12 exercises (built-in plus your own).
- Your program also backs up to Supabase (`user_programs`, one row per user): the current block with its progress, your own exercises, and the exercise-library on/off switches. The newest copy wins by timestamp, so a new device that signs in picks it up; a newer cloud copy waits until a workout in progress is finished. The rest-timer setting stays per device.

## Setup

```bash
npm install
npm run dev
```

Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. In Supabase Auth, set the Site URL and Redirect URLs to your deployed origin, `https://workoutforge.app` (confirmation and password-reset links return to the site root). For sign-up, enable the Email provider and decide whether "Confirm email" is on; the built-in Supabase mailer is rate-limited, so set up a custom SMTP sender before marketing. Apply `supabase/migrations/*.sql` in order.

## Verification

```bash
npm test
npm run build
npm run lint
```

## How progression works (RIR blocks)

Each week has a target RIR (reps in reserve): 4 weeks go 3, 2, 1, 0, 6 weeks go 3, 2, 2, 1, 1, 0 and 8 weeks go 3, 3, 2, 2, 1, 1, 0, 0 (a 12-week program is two 6-week parts), then a deload week (50% of the last working weight, same reps, planned sets). You pick a weight and reps that get you to that week's target; there is no per-set RIR box to fill in. The app then decides the next session from what you did, plus three quick questions that can all be skipped.

**Missed reps come first**
- **Stall:** missed reps in two sessions in a row at the same weight takes about 10% off that exercise (at least one step, rounded to 2.5 lb), same rep target, without waiting for the deload week. A change of weight resets the count, so it never drops twice in a row.
- Every set missed its reps: the weight drops one step. Apart from a stall, this is the only time weight goes down.
- The workout was completed but some sets were short: the weight stays, and each short set starts from what you actually did plus one rep.

**When every set hit its reps**
- **Effort** (after the last exercise of a muscle group): *easy* adds one weight step (no extra rep), *just right* keeps the weight and adds a rep, *too hard* keeps the weight and still adds one rep. Steps are 2.5 lb for dumbbell exercises and 5 lb for everything else, which is also the most the weight can rise in a week. Every prescribed weight (progression, deload, block-to-block) is snapped to the nearest 2.5 lb, so a logged 138.4 lb never produces a target like 138.42 lb.
- **Muscle pump** (same prompt): *low* adds a rep (two if the previous check was also low, and it never stacks on top of the rep from "just right" or "too hard"), *high* adds nothing extra. Reps only come back down when the weight goes up at the top of the rep range: the weight rises one step and reps return to the bottom of the range.
- If you skip both, the default is one more rep.

**Recovery** (after the first exercise of a muscle group, only if you trained it before): *still sore* takes a set off every exercise for that muscle group, *just on time* changes nothing, *recovered early* adds a set. It applies to the unstarted exercises today and carries through the rest of the block (2 to 6 sets per exercise, at most 3 up or down in total). Sets are the only thing this changes. If you answer *recovered early* and then rate the same muscle group *too hard*, the extra set is not carried to the next session.

The deload week and StrongLifts 5x5 never ask. Answers are stored with the session and back up with the program.
## Progress charts

The Progress tab has two charts under one row of filters (time range of 4, 12 or 26 weeks, muscle group, exercise):

- **Estimated max** (line): one point per session for the chosen exercise, from your best set, counting the reps you left in reserve (Brzycki, the same estimate the weight-to-rep adjustment uses). Deload sessions are left out. Bodyweight exercises logged at 0 lb chart your best reps per session instead. Above it: your current value, the change over the range, and your best set.
- **Sets per week** (columns): every completed set per week (Monday to Sunday), optionally for one muscle group. The tooltip adds the week's volume (weight × reps).

Hover, tap, or use the arrow keys (Home and End jump to the ends, Escape clears) to read a point. Each chart has a **Table view** with every value, so nothing depends on hovering. Charts are drawn as SVG with the app's own colors, so they follow light and dark mode.
## Rep max

Every exercise has a rep range. The top (rep max) is used by progression as the "top of the range" (add weight and start again at the bottom), and the weight-to-rep adjustment never asks for more reps than it.

- **Rep max 12** for large compound lifts: Barbell Bench Press, Barbell Incline Bench Press, Dumbbell Incline Bench Press, Pull-ups, Assisted Pull-ups, TBar Row, Barbell Row, Barbell Overhead Press, Dumbbell Shoulder Press, Barbell Squat, Hack Squat, Leg Press Machine, Barbell Deadlift, Good Mornings, Dumbbell RDL, Barbell Hip Thrust, Machine Hip Thrust and Dumbbell Walking Lunge.
- **Rep max 15** for everything else: isolation work, other machines and cables.
- **Bottom of the range:** 12-max lifts start at their muscle group's floor (6 for chest, back, shoulders and quads; 8 for hamstrings and glutes; 10 for arms, forearms, calves and core). 15-max exercises start at 8, or at the group's floor if that is higher (10 for arms, calves, core).
- Your own exercises are 15-max (8 to 15) unless you tick **Large compound lift** when adding or editing them (then 12-max at the group's floor). The library shows each exercise's rep max.
## Changing the weight changes the reps

If you override the weight on a set in an RIR work week, the reps rescale so the set still lands on that week's target RIR:

1. Your strength comes from your last non-deload session: each set gives a one-rep max with the Brzycki formula (`weight × 36 ÷ (37 − reps to failure)`), counting the reps you left in reserve; a set that missed its reps counts as failure. The best set is used.
2. Reps to failure at the new weight are `37 − 36 × weight ÷ 1RM`; subtract the week's target RIR and round. Example: with a 232 lb max and a 0 RIR week, 190 lb gives about 8 reps.
3. Reps stay between 1 and the exercise's rep max (12 for large compound lifts, 15 otherwise). At a limit, a short note says so instead of silently clamping.

It applies to every unfinished set whose weight changed (including the later sets that follow set 1's weight), and the set's rep target moves with it, so missed-rep checks use the new number. Finished sets are never touched. It does nothing the first time you do an exercise, in deload weeks, or in 5x5 blocks.
## Starting the next block

When you start a new block, Week 1 builds from your last block's **0 RIR week**, never from the deload (deload sessions are flagged and ignored as a starting point):

- **Weight:** take the heaviest set of the 0 RIR week, estimate a one-rep max (weight × (1 + reps ÷ 30)), then use the weight at which the bottom of the rep range leaves 3 in reserve: `e1RM ÷ (1 + (reps + 3) ÷ 30)`, rounded to 2.5 lb. If that week was rated *easy*, add one weight step (2.5 lb dumbbell, 5 lb other). Example: 200 lb × 6 at 0 RIR gives 185 lb for 6 reps.
- **Reps:** back to the bottom of the exercise's rep range.
- **Sets:** for each muscle group, the larger of the plan or last block's final sets minus one (a set added by "recovered early" followed by "too hard" does not count).
- It is automatic. A note on the Today screen says how many exercises were carried over, and each exercise explains its numbers. Exercises with no 0 RIR session behind them just continue as normal; 5x5 blocks are not affected.
## Hosting notes

- Production is https://workoutforge.app (Vercel, auto-deploys from `main`). `vercel.json` forwards the old `workout-forge-iota.vercel.app` address to it; add `?keep=1` to the old address to reach the old site (for example to export data saved there).
- Barlow and Barlow Condensed are bundled through `@fontsource` (SIL OFL) and precached by the service worker, so the app needs no third-party font requests.

## Stack

React, TypeScript, Vite, Vitest, vite-plugin-pwa, Supabase.
