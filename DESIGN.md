---
version: alpha
name: Workout-Forge
description: A Linear-inspired dark system for a gym app. Near-black canvas, one lavender-indigo accent that always means "act here", green that means "done", and tabular numerals so weights and reps line up. Designed to be glanced at mid-set, one-handed, in a dim room.

colors:
  primary: "#5e6ad2"
  primary-hover: "#7480e8"
  primary-tint: "rgba(94,106,210,0.14)"
  on-primary: "#ffffff"
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#9ba0aa"
  success: "#27a644"
  success-text: "#5fd183"
  danger-text: "#ff9b9b"
  danger-surface: "#2a1214"

typography:
  display: { fontFamily: "Inter", fontSize: "clamp(34px,5vw,50px)", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.05 }
  title: { fontFamily: "Inter", fontSize: 20px, fontWeight: 500, letterSpacing: "-0.02em" }
  body: { fontFamily: "Inter", fontSize: 15px, fontWeight: 400, lineHeight: 1.5 }
  label: { fontFamily: "ui-monospace", fontSize: 12px, fontWeight: 500, letterSpacing: "0.08em", textTransform: uppercase }
  numeral-lg: { fontFamily: "Inter", fontSize: 24px, fontWeight: 600, fontFeature: tnum }

rounded: { sm: 6px, md: 8px, lg: 12px, pill: 9999px }
spacing: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 24px, 6: 32px, 7: 48px }
touch-target: 48px
---

## Overview

Workout Forge is used between sets: sweaty hands, dim light, a glance of two seconds. The system is
Linear's precision (near-black canvas, hairline borders, one accent) tuned for that context.

- **Indigo (`primary`) means "do this next".** The current set, the primary button, the active tab. Nothing decorative.
- **Green (`success`) means "saved/done".** Completed sets and the block-complete state.
- **Everything numeric uses tabular figures** so a column of weights reads as a column.
- Depth comes from surface steps and 1px hairlines, not shadows.

## Colors

All colors are CSS variables in `src/index.css`. Never hardcode a hex value in a component or in `App.css`.
Body-size text is never dimmer than `ink-subtle` (contrast 6:1+ on canvas). Indigo is for fills, borders and
links at 14px+; it is not a body-text color.

## Typography

Inter for everything (bundled in `src/assets/fonts`, no external font requests), with `ui-monospace` for the small uppercase labels only. Display sizes use negative
tracking; body uses none. Minimum text size is 12px. Weights and reps are `numeral-lg` (24px, 600, `tnum`).

## Layout

8px base. Content max width 1120px. Session screen is a single column so it works at 375px unchanged.

## Components

- **Set row** — three states: *done* (dimmed, green check), *current* (indigo border + tint, the first
  incomplete set of each exercise), *upcoming* (default). Inputs are 52px tall.
- **Rest timer** — appears after a set is checked off, counts down from 60/90/120/180s (remembered), floats
  above the tab bar on phones.
- **Tab bar** — on screens under 680px the primary nav becomes a fixed bottom bar, 56px tall, with icons.
- **Rest timer** — optional, off by default (Settings → Rest timer). When on it appears after a set is checked off
  and counts down from 60/90/120/180s (remembered). Floats above the tab bar on phones.
- **Exercise library** — Settings → Exercise library lists every exercise by muscle group with an on/off switch (same switch as the rest timer). Off exercises are hidden from the planner menus; users can add, rename and delete their own.
- **Delta chip** — green `+5` next to a completed set that beat the same set last session.
- **Buttons** — primary (filled indigo, one per screen region), secondary (hairline outline). Min height 44px,
  48px on touch.

## Do's and Don'ts

Do
- Use indigo once per region for the next action.
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
