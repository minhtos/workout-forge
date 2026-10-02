# Workout Forge

A local-first, web-based PWA for building focused workout blocks and logging training sessions.

## Current MVP

- Choose **3, 4, or 5 training days per week**.
- Choose a **4-week or 6-week** training block.
- Generate a deterministic weekly split:
  - 3 days: Full Body A/B/C
  - 4 days: Upper/Lower A/B
  - 5 days: Upper/Lower/Push/Pull/Legs
- Start a planned workout and log sets, reps, and weight.
- Track completed sessions, adherence, and latest-session volume.
- Persist program selection and completed-session history in the browser.
- Install as a PWA with an offline-cached application shell.

## Local development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
npm run lint
```

## Current limits

This is an MVP vertical slice. It does not yet include account sync, cloud backups, an editable exercise library, persisted per-set history across completed sessions, wearables, or coaching logic.

## Stack

React, TypeScript, Vite, Vitest, and vite-plugin-pwa.
