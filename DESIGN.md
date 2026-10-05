---
version: alpha
name: Workout-Forge
description: A dark, condensed-type system for a gym app. Charcoal canvas, one forge-orange accent that always means "act here", green that means "done", and tabular numerals so weights and reps line up. Designed to be glanced at mid-set, one-handed, in a dim room.

colors:
  primary: "#f26b21"
  primary-hover: "#ff8a4c"
  primary-tint: "rgba(242,107,33,0.14)"
  primary-text: "#ff8a4c"
  on-primary: "#16181b"
  canvas: "#16181b"
  surface-1: "#1c2025"
  surface-2: "#20242a"
  surface-3: "#272c33"
  hairline: "#2f353e"
  hairline-strong: "#3a404a"
  ink: "#f2f0eb"
  ink-muted: "#c9cfd8"
  ink-subtle: "#aab1bc"
  success: "#27a644"
  success-text: "#5fd183"
  danger-text: "#ff9b9b"
  danger-surface: "#2a1214"

typography:
  display: { fontFamily: "Barlow Condensed", fontSize: "clamp(34px,5vw,50px)", fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1, textTransform: uppercase }
  title: { fontFamily: "Barlow", fontSize: 20px, fontWeight: 500, letterSpacing: "-0.02em" }
  body: { fontFamily: "Barlow", fontSize: 15px, fontWeight: 400, lineHeight: 1.5 }
  label: { fontFamily: "ui-monospace", fontSize: 12px, fontWeight: 500, letterSpacing: "0.08em", textTransform: uppercase }
  numeral-lg: { fontFamily: "Barlow", fontSize: 24px, fontWeight: 600, fontFeature: tnum }

rounded: { sm: 6px, md: 8px, lg: 12px, pill: 9999px }
spacing: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 24px, 6: 32px, 7: 48px }
touch-target: 48px
---

## Overview

Workout Forge is used between sets: sweaty hands, dim light, a glance of two seconds. The system is
hairline borders on a charcoal canvas, one bold accent and condensed uppercase headlines, tuned for that context.

- **Orange (`primary`) means "do this next".** The current set, the primary button, the active tab. Nothing decorative.
- **Green (`success`) means "saved/done".** Completed sets and the block-complete state.
- **Everything numeric uses tabular figures** so a column of weights reads as a column.
- Depth comes from surface steps and 1px hairlines, not shadows.

## Colors

All colors are CSS variables in `src/index.css`. Never hardcode a hex value in a component or in `App.css`.
Body-size text is never dimmer than `ink-subtle` (contrast 6:1+ on canvas). Orange is for fills, borders and
links at 14px+. Orange text uses `primary-text`, and text on an orange fill uses `on-primary` (dark), never white.

## Typography

Barlow for body and Barlow Condensed (uppercase) for display headings, both bundled through `@fontsource` and imported in `src/main.tsx`, so there are no external font requests. `ui-monospace` is for the small uppercase labels only. Display headings use slight positive tracking; body uses none. Minimum text size is 12px. Weights and reps are `numeral-lg` (24px, 600, `tnum`).

## Layout

8px base. Content max width 1120px. Session screen is a single column so it works at 375px unchanged.

## Components

- **Set row** — three states: *done* (dimmed, green check), *current* (orange border + tint, the first
  incomplete set of each exercise), *upcoming* (default). Inputs are 52px tall.
- **Rest timer** — appears after a set is checked off, counts down from 60/90/120/180s (remembered), floats
  above the tab bar on phones.
- **Tab bar** — on screens under 680px the primary nav becomes a fixed bottom bar, 56px tall, with icons.
- **Rest timer** — optional, off by default (Settings → Rest timer). When on it appears after a set is checked off
  and counts down from 60/90/120/180s (remembered). Floats above the tab bar on phones.
- **Exercise library** — Settings → Exercise library lists every exercise by muscle group with an on/off switch (same switch as the rest timer). Off exercises are hidden from the planner menus; users can add, rename and delete their own.
- **Feedback sheet** — bottom sheet (centered dialog on desktop) for the recovery, effort and pump questions. Large choice buttons with a one-line consequence under each, one orange action, Skip always available.
- **Charts** — hand-drawn SVG in `src/views/Charts.tsx`, one accent (`--primary`) because every chart has a single series. Marks: 2px line with 8px dots and a 2px surface ring, 10% area wash, columns at most 24px wide with a 4px rounded top and square base, hairline solid gridlines, a direct label only on the latest value and the peak. Text uses ink tokens, never the series color. Hover, touch and arrow keys drive one tooltip that sits beside the active mark; every chart has a table view. No dual axes: two measures get two charts.
- **Delta chip** — green `+5` next to a completed set that beat the same set last session.
- **Landing page** — `LandingView`, shown only to a first-time visitor with no plan or history. Condensed hero headline, one "Get started free" action (no account needed), the sign-in card beside it, three feature cards, honest copy only (no invented numbers). Signed-in or returning users never see it.
- **Auth card** — `AuthForm`: Sign in / Create account tabs, email + password (8+ characters on sign-up), "Forgot your password?" switches to an email-only reset form. Errors use `form-error`, success uses `form-ok`. Used on the landing page and in Settings → Cloud backup.
- **Buttons** — primary (filled orange, one per screen region), secondary (hairline outline). Min height 44px,
  48px on touch.

## Do's and Don'ts

Do
- Use orange once per region for the next action.
- Keep tap targets at least 44px (48px preferred in the session view).
- Use `tnum` for any number the user compares.
- Respect `prefers-reduced-motion`.

Don't
- Don't add a second accent hue. Status colors (green, red) are the only exceptions.
- Don't use text smaller than 12px or dimmer than `ink-subtle`.
- Don't use shadows for elevation; use a surface step or a hairline.
- Don't hardcode colors outside `:root`.

## Responsive Behavior

| Width | Change |
|---|---|
| ≥ 1024 | Default layout, top nav |
| 681–1023 | Same, grids reflow to 2-up/1-up via `auto-fit` |
| ≤ 680 | Bottom tab bar, stacked cards, 48px controls, footer buttons full width |

## Iteration Guide

1. Change tokens in `:root` first; components should follow.
2. Add new states as new classes, not by editing hex values.
3. Re-check contrast whenever `ink-subtle` or a surface changes.

## Light mode

The palette follows the system setting (`prefers-color-scheme`). Dark is the default; light overrides the
same tokens in a media query at the bottom of `src/index.css`, so components never need to know the theme.
`color-scheme: dark light` makes native controls (the Reps and RIR dropdown menus, scrollbars) match, and
`select option` uses `--surface-2` / `--ink`. Keep every new color a token with both a dark and a light value.
