---
name: SmplWise Arx
description: The design rulebook of the operator and admin interface - two rulebooks, Domus (primary) and the glass style, as the code draws them.
colors:
  canvas: "#d3dcec"
  surface: "rgba(255,255,255,.70)"
  surface-solid: "#fbfcfe"
  surface-2: "rgba(255,255,255,.84)"
  surface-2-solid: "#ffffff"
  surface-3: "rgba(20,30,50,.10)"
  surface-3-solid: "#e3e8f1"
  menu-surface: "#fbfcfe"
  hairline: "rgba(255,255,255,.95)"
  hairline-strong: "rgba(20,30,50,.24)"
  ink: "#172033"
  ink-heading: "#0c1322"
  ink-2: "#3f4c63"
  ink-3: "#48546a"
  accent: "#2458e6"
  accent-hover: "#1b48cc"
  accent-soft: "rgba(36,88,230,.14)"
  accent-text: "#1847c2"
  live: "#1f9d55"
  recorded: "#2458e6"
  offline: "#7c879a"
  stale: "#bf7506"
  unknown: "#aab3c2"
  danger: "#d93838"
  forbidden: "#c81e1e"
  toggle-on: "#22a55b"
  lit: "#ffc857"
  canvas-dark: "#0a0e16"
  surface-dark: "rgba(24,30,44,.80)"
  surface-solid-dark: "#171d29"
  ink-dark: "#eef2f8"
  ink-2-dark: "#aab5c9"
  ink-3-dark: "#9aa8bd"
  accent-dark: "#6ea2ff"
  accent-text-dark: "#8fb8ff"
  toggle-on-dark: "#34c76a"
typography:
  display:
    fontFamily: "Heebo, Inter, Segoe UI, -apple-system, BlinkMacSystemFont, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "48px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-1.4px"
  headline:
    fontFamily: "Heebo, Inter, Segoe UI, -apple-system, BlinkMacSystemFont, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Heebo, Inter, Segoe UI, -apple-system, BlinkMacSystemFont, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Heebo, Inter, Segoe UI, -apple-system, BlinkMacSystemFont, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Heebo, Inter, Segoe UI, -apple-system, BlinkMacSystemFont, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  2xs: "6px"
  xs: "9px"
  sm: "12px"
  md: "20px"
  lg: "26px"
  xl: "30px"
  2xl: "34px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-solid}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "34px"
  chip:
    backgroundColor: "{colors.surface-solid}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px"
  kpi-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "60px"
  input:
    backgroundColor: "{colors.surface-2-solid}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "5px 10px"
    height: "34px"
  dialog:
    backgroundColor: "{colors.surface-solid}"
    rounded: "{rounded.xl}"
    width: "440px"
---

# Design System: SmplWise Arx

**Status: authoritative from 2026-11-14** (branch `pilot/DESIGN-RULEBOOK-2438`, owner decision Q-DES-1 option ג of round 32:
"keep both rulebooks, the document describes both"). This file replaces the proposal of 2026-10-27, which described a look
("Arx Infra") that is not what the product draws; that text now lives in `DESIGN_ARX_INFRA_PROPOSAL_2026-10-27.md` (§15).

How to read it:

- It is **descriptive first**. Every token value below was read from the code at commit `0a8fb55e1` (origin/main, v2.43.5 train)
  and is quoted with its file. Where the owner has decided a rule that the code does not follow yet, the rule is stated and the
  gap is listed in Appendix A with file and line. **When this file and the code disagree on a value, the code is right and this
  file has a bug**; when they disagree on a rule, Appendix A says which side moves.
- Three questions are **OPEN** (§13). Nothing here decides them; both current behaviours are documented as they are.
- Precedence: approved change request → `MASTER_SPEC_HE.md` and `docs/security/` → `AGENTS.md` → this document → the older
  design documents (§15).
- The frontmatter carries the **Domus light** values (Domus is the primary rulebook); the dark column and the glass family are
  in the body. The home interface (`frontend/src/home/**`, `#/home`), the notice TV and the public ticket page have their own
  styles and are out of this book's scope.

Two words used throughout:

- **Domus** = the skin `domus` of the skin layer (`frontend/src/design/skins/domus.ts`) on the product token table
  (`frontend/src/design/tokens.ts`, the `--sw-*` names), drawn through the shared `sw-*` components.
- **Glass** = the `--dv-*` knob family (`frontend/src/styles/devices-themes.ts`, `devices-palettes.ts`) and the management
  screens built on it with `styles/media-glass.ts`, `media-page.ts`, `automations-glass.ts` and `components/notify-css.ts`.

A fact that matters when reading the rest: the code's default skin is still `classic`
(`frontend/src/design/skins/index.ts:25`, `smplwise_vms/backend/smplwise/routers/settings.py:93`). Classic and Domus are the
"polished pair": same component rules in structure, same motion (`skins/polish-motion.ts`), different token values. The
owner works in Domus, so Domus is the column this book treats as primary; the classic values are given beside it where they
differ (§7b), because every pixel baseline of the default installation is classic.

## Overview

**Creative North Star: "The Building's Control Desk"**

Arx is the desk a building manager, a resident and a security operator all sit at: the same surface in the lobby at noon and
on a phone at 2 a.m. It should read like a modern video-management dashboard (UniFi Protect is the yardstick), never like a
form-based management system and never like a consumer smart-home toy.

Domus says this with glass over a coloured canvas: a cool grey-blue ground with one warm and one cool bloom, panels of
70 % white glass with a lit top edge, big confident titles (48 px), round shapes, raised keys, one blue, and green kept for
"on" and for status. The glass style says the same thing in a softer, roomier voice that came from the approved device-control
mockup: translucent panels with a 28 px blur, pill controls, an OS-style ink, palette knobs a designer can swap.

Expression lives in precision, not decoration. One accent, one state vocabulary, tabular numbers, a state always told by a
dot plus a word.

**Key Characteristics:**
- One semantic token table with a light and a dark value for every name; dark is navy, never black, and no surface is lighter
  than the shell around it.
- Operator screens fit the viewport: a control screen does not scroll, it pages (§4.2).
- State is never colour alone: dot + word, or a shape (dashed "unknown", hollow "offline").
- Everything that floats as a menu is opaque (owner 2026-10-13), in both rulebooks.
- Every option the owner called "אפשר לשנות בהגדרות" is a setting with the decided value as its default (§11).
- Hebrew RTL first; video, plan geometry, the 3D scene and the timeline never mirror.

## 1. Principles

1. **One language per screen.** A screen is Domus or glass, never a mix of both vocabularies (§12).
2. **Tokens, not literals.** A screen writes no colour, radius, font size or duration of its own. Domus screens read `--sw-*`;
   glass element rules read `--dv-*` / `--mm-*` only. A literal is a defect (Appendix A.9).
3. **Shared components first.** `sw-page`, `sw-card`, `sw-kpi`, `sw-button`, `sw-chip`, `sw-badge`, `sw-field`, `sw-toggle`,
   `sw-tabs`, `sw-table`, `sw-dialog`, `sw-drawer`, `sw-dropdown`, `sw-pager`, `sw-state-panel`. A hand-built twin of one of these
   is a defect (owner Q-DES-15: move to the shared components group by group, after the cleanup).
4. **No scrolling in control screens** (owner 2026-10-24, Q-SYS-4, Q-SYS-5): pages instead; only an inner panel may scroll.
5. **Clean operator screens** (owner 2026-09-30): no hints, no explanatory paragraphs, no entitlement badges. A confirmation
   is one question with a count and two buttons, in the system dialog, never the browser's `confirm()` (Q-SYS-6).
6. **The floors / areas tree survives every design** (owner 2026-10-01).
7. **No platform naming on operator screens** (owner 2026-09-29, `docs/design/UI_COPY_RULES.md`). The settings screens may say
   "Home Assistant" (Q-DES-10, option ג). Operator terms are in Hebrew, except "NVR" (Q-DES-9, option ב).
8. **Light and dark from day one** (owner 2026-09-30). A change that is checked in one scheme only is not done.
9. **Accessibility is a floor, not a pass** (§10): 4.5:1 for words, 3:1 for control boundaries, 44 px touch targets, a visible
   focus ring, reduced motion honoured by every component.
10. **Status colours are fixed** (Q-DES-18): red, amber and green keep their meaning in every skin and palette, defined once.

## Colors

Tinted neutrals taken from the canvas blue, one accent, a state family in which every state has a bare colour (dots, bars,
icons), a `-soft` fill and a `-text` ink for words on that fill.

### 2.1 Domus surfaces and ink (`design/skins/domus.ts:20-44`)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--sw-bg` | `#d3dcec` | `#0a0e16` | page base under the blooms |
| `--sw-canvas` | warm bloom `rgba(255,193,117,.5)` + cool bloom `rgba(178,200,255,.46)` + centre light `rgba(255,255,255,.34)` over `linear-gradient(170deg, #dde4f1, #ccd6e9 55%, #d3dbec)` | `rgba(255,150,40,.2)` + `rgba(80,140,255,.28)` over `linear-gradient(180deg, #0f1521, #090c13)` | what the page is painted with (`domus.ts:24`) |
| `--sw-surface` / `-solid` | `rgba(255,255,255,.70)` / `#fbfcfe` | `rgba(24,30,44,.80)` / `#171d29` | panels: cards, KPI tiles, tables, the tree |
| `--sw-surface-2` / `-solid` | `rgba(255,255,255,.84)` / `#ffffff` | `rgba(255,255,255,.07)` / `#1f2634` | inner rows, hovered rows, field wells |
| `--sw-surface-3` / `-solid` | `rgba(20,30,50,.10)` / `#e3e8f1` | `rgba(255,255,255,.11)` / `#293246` | tracks, grooves, pressed keys |
| `--sw-menu-surface` / `--sw-menu-border` | `#fbfcfe` / `#dfe1e6` | `#171d29` / `#2f3542` | every menu, popover, picker: opaque |
| `--sw-border` / `--sw-border-strong` | `rgba(255,255,255,.95)` / `rgba(20,30,50,.24)` | `rgba(255,255,255,.14)` / `rgba(255,255,255,.22)` | glass edge / buttons, inputs |
| `--sw-highlight` | `rgba(255,255,255,1)` | `rgba(255,255,255,.14)` | the 1 px light line on a panel's top edge |
| `--sw-overlay` | `rgba(10,16,30,.44)` | `rgba(0,0,0,.64)` | scrim behind a dialog or drawer |
| `--sw-text` / `--sw-heading` | `#172033` / `#0c1322` | `#eef2f8` / `#ffffff` | primary ink / headings |
| `--sw-text-2` | `#3f4c63` | `#aab5c9` | secondary ink |
| `--sw-text-3` | `#48546a` | `#9aa8bd` | captions; the floor for words |
| `--sw-text-inverse` | `#ffffff` | `#0c1018` | ink on an accent fill (dark Domus uses a dark ink on its light blue) |

### 2.2 Domus accent and states (`domus.ts:45-79`)

| Token | Light | Dark |
|---|---|---|
| `--sw-accent` / `-hover` | `#2458e6` / `#1b48cc` | `#6ea2ff` / `#8ab5ff` |
| `--sw-accent-soft` / `--sw-accent-text` | `rgba(36,88,230,.14)` / `#1847c2` | `rgba(110,162,255,.2)` / `#8fb8ff` |
| `--sw-focus` / `--sw-nav` | `#2458e6` / `#2458e6` | `#7fb0ff` / `#6ea2ff` |
| `--sw-toggle-on` / `-off` / `-thumb` | `#22a55b` / `#6f7a90` / `#ffffff` | `#34c76a` / `#7b869e` / `#ffffff` |
| live = success: bare / soft / text | `#1f9d55` / `rgba(31,157,85,.14)` / `#14703c` (success text `#105e32`) | `#3ddc84` / `rgba(61,220,132,.20)` / `#3ddc84` |
| recorded | `#2458e6` / `rgba(36,88,230,.12)` / `#1d51d2` | `#6ea2ff` / `rgba(110,162,255,.20)` / `#8fb8ff` |
| offline | `#7c879a` / `rgba(124,135,154,.14)` / `#475164` | `#8b96a8` / `rgba(139,150,168,.20)` / `#b4bdcc` |
| stale = warning | `#bf7506` / `rgba(217,138,11,.15)` / `#7a4c00` | `#f5b043` / `rgba(245,176,67,.20)` / `#f5b043` |
| unknown | `#aab3c2` / `rgba(170,179,194,.16)` / `#475268` | `#6b7686` / `rgba(107,118,134,.22)` / `#aab5c9` |
| danger | `#d93838` / `rgba(217,56,56,.12)` / `#a82525` | `#ff6b62` / `rgba(255,107,98,.20)` / `#ff857d` |
| forbidden | `#c81e1e` / `rgba(200,30,30,.12)` / `#a51818` | `#ff7a70` / `rgba(255,122,112,.20)` / `#ff7a70` |
| `--sw-purple` (shared building) | `#7c5cf0` | `#a78bfa` |

Not overridden by Domus, so the base table applies (`design/tokens.ts`): the count badge `--sw-badge-bg` / `-fg`
`#b91c1c` / `#ffffff` (dark `#ff6b62` / `#2a0b09`); ink on a filled warning `--sw-on-warning` `#1f1300`; ink on a filled success
`--sw-on-success` `#04140b`; the lit family `--sw-lit` `#ffc857` / `#ffb547`, `--sw-lit-soft` `rgba(255,200,87,.32)` /
`rgba(255,181,71,.24)`, `--sw-on-lit` `#2b1a05`; the toast `--sw-toast-bg` `#1e2e47` / `#2c3a57`; the on-video HUD family
(`--sw-on-video` `#ffffff`, `--sw-video-scrim` `rgba(0,0,0,.55)`, `-strong` `.72`), the same in both schemes; the elevator solid
fills `--sw-el-wait` `#15803d`, `-act` `#1d4ed8`, `-trav` `#0e7490`, `-fault` `#c81e1e`, `-off` `#c2410c`, `-fire` `#881337`,
`-unk` `#667085` (`tokens.ts:453-459`); the timeline kinds `--sw-tl-*` (`tokens.ts:174-180`); the plan and 3D neutrals
(`--sw-map-*`, `--sw-obj-*`, `--sw-circuit-*`), which Domus re-tunes at `domus.ts:80-102`.

The installation may replace the accent and the switch colour (`ui.accent`, `ui.toggle_on`; `design/brand.ts`).

### Named Rules
**The Dot-and-Word Rule.** A state is a dot or a shape **and** a word. Colour is never the only carrier.
**The Opaque Floating Rule.** A menu, popover, picker, dropdown list, search-result list or HUD panel over the plan paints
`--sw-menu-surface`, fully opaque, with no blur, in every skin, palette and scheme. The registry is
`frontend/src/styles/menu-surface.ts`; modal layers (dialog, drawer, sheet) are a separate case (§13.1).
**The Green-Is-Status Rule.** Green means on, live, confirmed. It is never an action colour and never decoration.
**The Fixed Status Rule** (Q-DES-18). Red, amber and green do not follow a palette swap, and they are written once (today
three components each keep a private copy: Appendix A.8).

## Typography

**Display / Body Font:** Heebo (bundled, `frontend/public/fonts/heebo-{hebrew,latin}-{400,500,600,700}.woff2`, SIL OFL), stack
`"Heebo", "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, "Noto Sans Hebrew", Roboto, Arial, sans-serif`
(`--sw-font`, `tokens.ts:228`).
**Mono Font:** `ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace` (`--sw-font-mono`) for identifiers and
addresses only.

**Character:** one Hebrew workhorse sans; hierarchy by size and weight, never by a second face. Numbers that can change are
tabular and LTR-isolated.

### 3.1 The Domus scale (`domus.ts:104-118`)

| Token | Domus | Use |
|---|---|---|
| `--sw-fs-2xs` | 11px | the label floor (on-video tags, sensor pills) |
| `--sw-fs-xs` | 12px | captions, table headers, KPI labels, hints |
| `--sw-fs-sm` | 13px | buttons, chips, tabs, fields, table cells |
| `--sw-fs-base` | 13.5px | dense rows, secondary lines |
| `--sw-fs-md` | 14.5px | body |
| `--sw-fs-lg` | 16px | card titles, dialog and drawer titles |
| `--sw-fs-xl` | 19px | section headings |
| `--sw-fs-2xl` | 24px | counters (KPI value), state-panel heading |
| `--sw-fs-3xl` | 32px | display readings |
| `--sw-h1` / `-weight` / `-tracking` | 48px / 800 / -1.4px | the page title (one per screen, `sw-page`) |
| `--sw-h1-phone` | 26px | the page title at ≤ 767 px |
| `--sw-lh` | 1.45 | body line height |
| weights | 400 / 500 / 600 / 700 (`--sw-fw-*`); 800 is used by the h1 and by the KPI value (`domus.ts:172`) | |

Heebo ships at 400 to 700 only; the 800 weights are synthesised by the browser (Appendix A.10).

### Named Rules
**The One Face Rule** (Q-DES-2, option א, "setting"). Heebo everywhere, the glass screens included. The code does not do this
yet: the glass family sets an OS font stack (§8.2, Appendix A.1).
**The Tabular Rule.** Counts, times and readings use `font-variant-numeric: tabular-nums` and stay LTR inside RTL text.
**The No-Private-Size Rule.** A screen never writes a px font size; it picks a tier.

## Layout

### 4.1 Spacing and shell (`tokens.ts:260-276`, Domus overrides in brackets)

| Token | Value | Role |
|---|---|---|
| `--sw-s-1 … 10` | 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 px | the spacing scale (4 px base); half steps `--sw-s-1h` 6, `-3h` 14, `-4h` 18 |
| `--sw-page-pad` | 30px [Domus 28px] | page padding (`sw-page`: `14px var(--sw-page-pad) 24px`; phone `12px 12px 16px`) |
| `--sw-gap` / `--sw-gap-lg` / `--sw-gap-grid` | 8 / 16 / 14 px | tile gap / card gap / grid gap |
| `--sw-rail-w` | 70px | the side rail at the inline start (right in RTL); Domus floats it 12 px off the edges (`domus.ts:158`) |
| `--sw-bottomnav-h` | 50px | the phone bottom bar |
| `--sw-topbar-h` | 0px | there is no top bar |
| `--sw-drawer-w` | 360px | the non-modal drawer; the modal drawer is `min(480px, 100vw)` |
| `--sw-sheet-w` / `-wide` | 560 / 760 px | `sw-sheet` |
| `--sw-tree-w` | 286px | the building tree |
| `--sw-touch` / `--sw-touch-desktop` | 36 / 44 px | legacy touch knob / the look dial's desktop target |
| z-index | map 1, map UI 5, drawer 20, top bar 30, modal 50, toast 60 | fixed by engineering |

Breakpoints the shared layer uses: **phone ≤ 767 px**, **tablet 768 to 1023 px**, **desktop ≥ 1024 px**; the compact tile
shape switches below 600 px (`api/tile-layout.ts`, `COMPACT_BELOW_PX = 600`). Screens use many more values (Appendix A.11).

### 4.2 Layout rules

| # | Rule | Source | State in code |
|---|---|---|---|
| L1 | **A control screen never scrolls the page.** Long lists page with `sw-pager` ("‹ 2 / 5 ›"); only an inner panel scrolls, and only for unbounded data. A system setting switches a list back to scrolling. Settings, logs and reports may scroll. | owner 2026-10-24; Q-SYS-4, Q-SYS-5 | `sw-pager` exists; `ui.long_lists` (`paged` default, `scroll`) exists but only the home screen reads it; several control screens still scroll (Appendix A.12) |
| L2 | **At most two rows of tabs / filters above the content.** On the phone the filters collapse into one button. | Q-DES-12 | tickets board: 3 rows on the desktop, 4 on the phone (Appendix A.13) |
| L3 | **"New" lives at the end of the page header row** (`sw-page` `slot="actions"`). On the phone it is one floating action button at the bottom inline-end corner. Setting. | Q-DES-5 | only the cases screen follows it; `sw-page` has no phone floating action (Appendix A.5) |
| L4 | **One KPI tile row**: low tiles, each "dot or icon · number · word", at the top of a list screen. Setting. | Q-DES-4 | `sw-kpi` compact layout (§7.5); 86 hand-built `kpi` tiles outside it (Appendix A.6) |
| L5 | **A table becomes compact cards on the phone**: name, state badge, one line of details; the rest opens with a tap. Setting. | Q-DES-7 | `sw-table` stacks every column as label + value under 768 px (Appendix A.7) |
| L6 | **One page header**: `sw-page` gives the title (one h1), the subtitle, the breadcrumb and the actions slot. | Q-DES-15 | 40 raw `<h1>` lines in 30 screen files (Appendix A.4) |
| L7 | **Settings structure**: OPEN (§13.3). | Q-DES-11 held | two structures exist |
| L8 | **Touch**: every control is a 44 px target on a coarse pointer; the row is the target when the control is smaller (`.sw-hit`, `styles/focus-policy.ts:39-52`). Hover effects only under `(hover: hover) and (pointer: fine)`. | `COMPONENT_RULES.md` §1 | shared components comply; see Appendix A.14 |
| L9 | **Portrait tablet = the phone layout** with the bottom bar (home interface: 4 tiles per row). | Q-HOME-1 | home scope |

Widget widths, truncation and wrapping per widget class, the "what scrolls" table per screen and the worst-case datasets stay
in `COMPONENT_RULES.md` (still valid; not repeated here).

## Elevation & Depth

Domus is a hybrid: the three glass levels carry the structure, and a real ladder of shadows lifts the glass off the canvas.

### Shadow Vocabulary (`domus.ts:132-138`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sw-shadow-1` | `0 1px 2px rgba(15,23,42,.06), 0 4px 10px -2px rgba(15,23,42,.06), 0 16px 36px -10px rgba(15,23,42,.16)` | `0 1px 2px rgba(0,0,0,.45), 0 4px 10px -2px rgba(0,0,0,.35), 0 18px 40px -10px rgba(0,0,0,.65)` | resting panel, button, chip |
| `--sw-shadow-2` | `0 2px 6px rgba(15,23,42,.07), 0 12px 24px -6px rgba(15,23,42,.12), 0 32px 64px -16px rgba(15,23,42,.24)` | `0 2px 6px rgba(0,0,0,.45), 0 14px 28px -6px rgba(0,0,0,.5), 0 36px 72px -16px rgba(0,0,0,.75)` | hover, the rail, the corner pill |
| `--sw-shadow-3` | `0 8px 20px rgba(15,23,42,.1), 0 28px 60px -10px rgba(15,23,42,.24), 0 64px 120px -24px rgba(15,23,42,.36)` | `0 8px 20px rgba(0,0,0,.5), 0 30px 70px -10px rgba(0,0,0,.7), 0 70px 130px -24px rgba(0,0,0,.85)` | dialog, drawer, menu |
| `--sw-shadow-thumb` | `0 1px 3px rgba(0,0,0,.2), 0 4px 10px -2px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.06)` | `0 1px 3px rgba(0,0,0,.5), 0 4px 10px -2px rgba(0,0,0,.5), 0 0 0 .5px rgba(0,0,0,.4)` | switch knob, selected segment |
| `--sw-shadow-primary` | `0 1px 2px rgba(27,72,204,.4), 0 8px 20px -4px rgba(36,88,230,.5)` | `0 1px 2px rgba(0,0,0,.5), 0 8px 20px -4px rgba(110,162,255,.35)` | primary button, selected chip |

Glass material (`domus.ts:139-143`): panel `--sw-glass-blur` `blur(28px) saturate(1.7)`; rail, bottom bar and corner pill
`--sw-glass-blur-nav` `blur(22px) saturate(1.6)`; dialog and drawer `--sw-glass-blur-sheet` `blur(36px) saturate(1.7)`; the sheen
`--sw-glass-sheen` `linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,255,255,.2) 38%, rgba(255,255,255,0) 72%)` (dark
`.12` / `.03` at 40 % / `0`). A panel paints `var(--sw-glass-sheen), var(--sw-surface)` with
`box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight)` (`domus.ts:167`).

### Named Rules
**The Never-Lighter Rule.** In dark, no surface is lighter than the shell around it.
**The Cheap Wall Rule.** Camera tiles carry no shadow, no blur and no animation: 32 of them must stay cheap.
**The Solid Fallback Rule.** Under `prefers-reduced-transparency: reduce` every blur is `none` and the sheet alpha is 1
(`design/css.ts:79`); the layout does not change.

## Shapes

| Token | Domus (`domus.ts:119-128`) | Use |
|---|---|---|
| `--sw-r-2xs` | 6px | small marks |
| `--sw-r-xs` | 9px | small buttons, KPI icon tile |
| `--sw-r-sm` | 12px | buttons, fields, pager keys |
| `--sw-r-md` | 20px | cards, KPI tiles, tables, popovers, rail items |
| `--sw-r-lg` | 26px | the building tree, dropdown lists, sheet tops on the phone |
| `--sw-r-xl` | 30px | dialogs, the rail, the sign-in card |
| `--sw-r-2xl` | 34px | hero media, sheets |
| `--sw-r-pill` | 999px | chips, badges, tree rows, segmented tracks, settings links |
| `--sw-ctl-h-sm` / `-md` / `-lg` | 28 / 34 / 40 px | control heights (44 px on a coarse-pointer phone) |

Borders are 1 px. A state recolours or dashes the hairline; it never thickens it. Icons are the product's own stroke set
(`sw-icon`); chevrons mirror in LTR, geometry never does.

**Button shape (Q-DES-6, option א, "setting"): pill everywhere.** The code is not there: `sw-button` is a 12 px rounded
rectangle in Domus (10 px in classic); only chips and the glass buttons are pills (Appendix A.3).

## Components

Geometry below is the shared component's own CSS (`frontend/src/components/sw-*.ts`) with the Domus token values resolved;
the Domus skin rules (`domus.ts:155-212`) are named where they change the picture.

### 7.1 Button (`sw-button.ts`)
- **Variants** `primary | secondary (default) | ghost | danger`; **sizes** `sm | md | lg` = 28 / 34 / 40 px
  (`min-block-size: var(--sw-ctl-h-*)`), `padding-inline` 9 / 12 / 16 px, font `--sw-fs-xs` / `-sm` / `-md`, weight 500 (Domus
  600, `domus.ts:179`), `gap: 6px`, radius `--sw-r-sm` (sm: `--sw-r-xs`), `border: 1px solid var(--sw-border-strong)`.
- **Domus keys** (`domus.ts:179-185`): a raised key, `linear-gradient(180deg, var(--sw-surface-2-solid), var(--sw-surface-solid))`
  with `--sw-shadow-1`, a light top edge and a dark lower edge; primary = a gradient from
  `color-mix(in srgb, var(--sw-accent) 84%, #ffffff)` to `--sw-accent-hover` with `--sw-shadow-primary`; ghost = no fill, no
  shadow; danger = surface fill, `--sw-danger` border, `--sw-danger-text` ink (never filled red on an operator screen).
- **States:** hover (fine pointer only) lifts 1 px to `--sw-shadow-2`; pressed sinks (`--sw-surface-3-solid`,
  `inset 0 2px 4px rgba(15,23,42,.16)`) and scales to `--sw-press-scale` 0.97; focus-visible
  `outline: 2px solid var(--sw-focus); outline-offset: 2px`; disabled `opacity: .5`, no shadow, `cursor: not-allowed`. There is
  no loading state in the component.
- **Phone** (`(max-width: 767px) and (pointer: coarse)`): every size is at least 44 px tall.

### 7.2 Chip (`sw-chip.ts`)
- 28 px (a literal), `padding-inline: 11px`, `--sw-fs-sm`, optional 7 px state dot and a count in `--sw-text-3`; Domus makes
  it a pill with the raised key face (`domus.ts:180`). The drawn height stays 28 px on the phone; the 44 px target comes
  from `.sw-hit`.
- **Selected: OPEN (§13.2).** Today in Domus: the primary button's accent gradient with `--sw-text-inverse`
  (`domus.ts:181`; base `sw-chip.ts:79-83`).
- Hover (fine pointer) `--sw-surface-2`; pressed scale 0.97; disabled `--sw-text-3` at 50 %.

### 7.3 Badge (`sw-badge.ts`)
- Kinds: `live, recorded, historic, offline, stale, unknown, forbidden, error, partial, neutral`. Pill, `padding: 1px 8px`
  (Domus `padding-inline: 9px`, weight 600, a 22 % `currentColor` inset ring, `domus.ts:202`), `--sw-fs-xs`, line height
  16 px, a 6 px dot in `currentColor`.
- Soft (default) = the state's `-soft` fill with its `-text` ink. Shape carries state too: live's dot pulses (1.6 s; off under
  reduced motion), offline's dot is hollow, stale / partial have a dashed border in `--sw-stale`, unknown has a dashed border.
- `filled` = the bare state colour under `--sw-text-inverse` (live: `--sw-on-success`; stale: `--sw-on-lit`), `--sw-fs-sm`,
  `padding: 2px 10px`. Some filled pairs are under 4.5:1 (§10.1, Appendix A.15).
- `onimage` = `--sw-on-image-bg` with `--sw-text` and `--sw-shadow-1`.

### 7.4 Card (`sw-card.ts`)
- `padding: 14px`, radius `--sw-r-md` (20 px), `border: 1px solid var(--sw-border)`, Domus glass face + `--sw-shadow-1`. Header
  `gap: 10px; margin-block-end: 10px`; title h3 `--sw-fs-lg` / 700 / `-0.01em` in Domus (`domus.ts:169`); subtitle `--sw-fs-xs`
  in `--sw-text-3`. Attributes `flush`, `interactive`, `row`, `collapsible`, `fill` (the body scrolls inside the card).
- Interactive: hover `--sw-shadow-2` and a lift of `--sw-hover-lift` (-3 px), pressed scale 0.99
  (`calc(1 - (1 - var(--sw-press-scale)) / 3)`).

### 7.5 KPI tile (`sw-kpi.ts`)
- **Compact (the "low tile" of Q-DES-4):** a grid `auto minmax(0,1fr)`, `min-block-size: 60px`, `padding: 8px 12px`,
  `column-gap: 10px`, icon tile 32 px (Domus 34 px in a glass tile ringed by the accent, `domus.ts:171-173`), value 17 px in
  the base (Domus 24 px / 800 / `-0.03em`, tabular), label `--sw-fs-xs` clamped to 2 lines. The value shrinks to fit
  (`fit-text.ts`) before it wraps.
- **Cards:** a column, `padding: 12px 14px`, `gap: 8px`, 30 px icon tile, value `--sw-fs-2xl` / 700, label and detail
  `--sw-fs-xs`.
- The screen passes `layout`; `ui.tile_layout` (`auto | cards | compact`, default `auto` = compact under 600 px) resolves it.
- Interactive: it is a filter button; hover `--sw-shadow-2`, pressed 0.99, expanded = accent border.

### 7.6 Field (`sw-field.ts`)
- Label above (`--sw-fs-xs`, weight 500, `--sw-text-2`), hint below (`--sw-fs-xs`, `--sw-text-3`). Control 34 px,
  `padding: 5px 10px`, radius `--sw-r-sm`, `--sw-fs-sm`; Domus: a well (`--sw-surface-2-solid`,
  `inset 0 1px 2px rgba(15,23,42,.06)`).
- Focus: the border turns `--sw-accent` plus a halo, in Domus `0 0 0 4px color-mix(in srgb, var(--sw-accent) 20%, transparent)`
  (`domus.ts:188`). Error: `:user-invalid` → `--sw-danger` border. Disabled: `--sw-surface-3`, `--sw-text-3`.
- Phone: 44 px and at least 16 px text (iOS does not zoom).
- There is no search variant and no error-message style yet (Appendix A.16).

### 7.7 Switch (`sw-toggle.ts`)
- Track 42 × 24 px, thumb 18 px, 3 px inset; off `--sw-toggle-off`, on `--sw-toggle-on` (Domus: a green gradient with an inset
  well, `domus.ts:190-191`). The thumb travels 18 px on `--sw-spring-toggle` (320 ms); the track colour on `--sw-t-med`
  (220 ms). Phone: the hit area is 44 px tall. Disabled 50 %.

### 7.8 Tabs (`sw-tabs.ts`)
- `pill` (default): a 34 px track in `--sw-surface-3`, labels 28 px with `padding: 0 12px`; selected = a raised key
  (`--sw-seg-key` in dark, the solid surface in light) with `--sw-shadow-thumb`, weight 600; Domus rounds track and key to a
  pill (`domus.ts:192-194`).
- `underline`: `padding: 8px 12px`, a 2 px `--sw-accent` line under the current tab. `underline-compact`: a 32 px row.
  `dropdown`: the same choice as an `sw-dropdown`; `adaptive` switches to it above three items.
- Overflow scrolls sideways with edge fades and arrows; the keyboard uses a roving tabindex. Phone: 44 px hit height.

### 7.9 Table (`sw-table.ts`)
- A panel (`--sw-r-md`, `--sw-shadow-1`); cells `padding: 9px 14px` (dense `7px 12px`), `--sw-fs-sm`, one line; header sticky,
  `--sw-fs-xs`, Domus: bold, `letter-spacing: .02em`, `--sw-text-2`; figures tabular (`domus.ts:199-201`).
- Row: hover `--sw-surface-3` (Domus), pressed `--sw-surface-3`, selected `--sw-accent-soft`, focus ring inset.
- Under 768 px each row is a card (see L5 and Appendix A.7); `hideBelow: 'phone' | 'tablet'` drops a column.

### 7.10 Dialog and drawer: OPEN (§13.1)
What the shared components draw today:
- **`sw-dialog`**: centred, `min(440px, 100%)`; `wide` 720 px; `xl` 1120 px; `fit`; `max-block-size: calc(100dvh - 32px)`;
  Domus: `var(--sw-glass-sheen), var(--sw-surface-solid)` (opaque fill), radius `--sw-r-xl` (30 px), `--sw-shadow-3`
  (`domus.ts:196-197`). Scrim `--sw-overlay`. Header `14px 16px 10px`, body `0 16px 14px`, footer `10px 16px 14px` with the
  actions at the end. Opens from `scale(.96) translateY(6px)` on `--sw-spring-dialog` (300 ms); no close animation. Escape
  closes the top dialog, Tab is trapped, focus returns to the opener, a click on the scrim closes it. On the phone it stays a
  centred box.
- **`sw-drawer`**: opens from the inline start. Non-modal: `min(360px, 100%)`, no scrim, no focus trap; on the phone a bottom
  sheet (`max-block-size: 62dvh`). `modal`: a top-layer `<dialog>`, `min(480px, 100vw)`, full height, opaque, scrim
  `--sw-overlay`, Escape, focus trap, scroll lock; on the phone a bottom sheet (`max-block-size: 88dvh`). Header `12px 14px`,
  body `14px`, footer `10px 14px`.
- **`sw-sheet`**: 560 px (wide 760, narrow 440), radius `--sw-r-xl`; a bottom sheet with a grab handle and swipe-to-close on the
  phone.

### 7.11 Other shared pieces
- **`sw-page`**: slots `crumbs`, `actions`, default; header wraps, actions at the end; h1 as §3.1.
- **`sw-pager`**: previous / next keys `--sw-ctl-h-md` square (coarse pointer: `--sw-ctl-h-lg`), position text LTR; draws
  nothing for one page; fires `page-change`.
- **`sw-dropdown`**: trigger 32 px, list = an opaque menu (`--sw-menu-surface`, `--sw-r-lg`, `--sw-shadow-3`), options 44 px; on
  the phone a bottom sheet (`max-block-size: 72dvh`, options 48 px).
- **`sw-popover`**: 268 px, opaque, `--sw-r-md`, `--sw-shadow-3`.
- **`sw-state-panel`**: `loading | empty | error | forbidden | stale | partial`; icon tile 64 px (compact 34), heading
  `--sw-fs-lg` bold in Domus, one line of text, one optional action.
- **`sw-skeleton`**: `--sw-skeleton` blocks with a 1.4 s shimmer; static under reduced motion.
- **`sw-avatar`**: a circle in `--sw-accent-soft` / `--sw-accent-text`, initials from `components/avatar-initials.ts`, the one
  method for the whole system (Q-DES-14; Appendix A.17).
- **Focus ring** (`styles/focus-policy.ts:20-23`, adopted into every shadow root):
  `outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: var(--sw-focus-offset, 2px)`.

### 7.12 Motion (`skins/polish-motion.ts`, `domus.ts:144-151`)

| Token | Domus | Use |
|---|---|---|
| `--sw-t-press` | 120ms | pointer-down transform |
| `--sw-t-fast` / `--sw-t-hover` | 120 / 150 ms | chevrons / hover colour |
| `--sw-t-med` | 220ms | toggle track, drawer, popover |
| `--sw-t-slow` / `--sw-t-sheet` / `--sw-t-state` | 200 / 200 / 200 ms | scrim / sheet opening / state fill |
| `--sw-t-exit` / `--sw-t-toast` | 140 / 260 ms | closing (faster than opening) / toast |
| `--sw-ease` | `cubic-bezier(0.23, 1, 0.32, 1)` | enter and state (strong ease-out) |
| `--sw-ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen movement |
| `--sw-ease-drawer` / `--sw-ease-thumb` | `cubic-bezier(0.32, 0.72, 0, 1)` | drawer / phone sheet rise |
| `--sw-ease-color` | `ease` | hover and colour |
| `--sw-ease-dialog` / `--sw-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` / `cubic-bezier(0.4, 0, 1, 1)` | base table values (see Appendix A.18 for the second) |
| `--sw-spring-toggle` / `-dialog` / `-tab` | 320 ms `linear()` / 300 ms `linear()` / 260 ms strong ease-out | switch thumb / dialog landing / tab |
| `--sw-press-scale` | 0.97 | every pressed control, every skin |
| `--sw-hover-lift` | -3px | a hovered interactive panel |
| `--sw-enter-ms` / `--sw-enter-y` / `--sw-stagger` | 220ms / 6px / 30ms | panel entrance: fade + rise, staggered across the first four siblings (`ENTER_RULES`) |

What moves: press feedback, the switch thumb, the dialog landing, a toast, the panel entrance, the skeleton shimmer.
What does not: keyboard-triggered actions, camera tiles, anything on a touch hover. Only `transform` and `opacity` animate.
Reduced motion: §10.3. Longer notes: `docs/design/MOTION_RULES.md`.

## Do's and Don'ts

### Do:
- **Do** build a new screen from `sw-page` and the shared components, and read every value from a token.
- **Do** page a long list with `sw-pager`; let only an inner panel scroll.
- **Do** put the create action in `sw-page`'s `actions` slot, at the end of the header row.
- **Do** keep every word at 4.5:1 or better on the surface it sits on, in both schemes, and prove it in the contrast specs.
- **Do** test with the worst-case datasets of `COMPONENT_RULES.md` §6 and in `?ltr=1`.
- **Do** give every decided look its setting when the owner wrote "setting" (§11).

### Don't:
- **Don't** let a control screen scroll the page, or stack more than two rows of tabs and filters above the content.
- **Don't** paint a translucent menu, popover, picker or HUD panel.
- **Don't** hand-build a dialog, drawer, table, KPI tile, switch, select or page header that a shared component already gives.
- **Don't** call the browser's `confirm()`.
- **Don't** write a hex colour, a px radius, a px font size or a raw duration in a screen.
- **Don't** use colour alone for a state, green for an action, or a second type face.
- **Don't** mirror video, plan geometry, the 3D scene, the timeline or the 24 h axis.
- **Don't** name the platform on an operator screen.

## 7b. Classic beside Domus (the installed default)

For anyone refreshing baselines: the same names, the classic values (`design/skins/classic.ts`).

| Token | Classic light / dark | Domus light / dark |
|---|---|---|
| `--sw-bg` | `#e4e9f2` / `#070b14` | `#d3dcec` / `#0a0e16` |
| `--sw-surface` | `#ffffff` / `#131a2a` (opaque) | `rgba(255,255,255,.70)` / `rgba(24,30,44,.80)` |
| `--sw-border` / `-strong` | `#d9e0ea` / `#253148` · `#c7d1df` / `#36445f` | `rgba(255,255,255,.95)` / `rgba(255,255,255,.14)` · `rgba(20,30,50,.24)` / `rgba(255,255,255,.22)` |
| `--sw-text` / `-2` / `-3` | `#1f2b42` / `#46556f` / `#4f5e78` · dark `#e4e9f3` / `#a7b2c7` / `#98a4ba` | `#172033` / `#3f4c63` / `#48546a` · dark `#eef2f8` / `#aab5c9` / `#9aa8bd` |
| `--sw-accent` / `-text` | `#2360e8` / `#1a4fd6` · dark `#3b6fe6` / `#8fb2ff` | `#2458e6` / `#1847c2` · dark `#6ea2ff` / `#8fb8ff` |
| `--sw-toggle-on` | `#2767ed` / `#3a6ce0` (the accent blue) | `#22a55b` / `#34c76a` (green) |
| type scale 2xs … 3xl | 11 / 12 / 13 / 13.5 / 14.5 / 16 / 18 / 24 / 30 px | 11 / 12 / 13 / 13.5 / 14.5 / 16 / 19 / 24 / 32 px |
| h1 / weight / tracking / phone | 30px / 800 / -0.9px / 22px | 48px / 800 / -1.4px / 26px |
| radii xs … 2xl | 7 / 10 / 16 / 18 / 22 / 26 px | 9 / 12 / 20 / 26 / 30 / 34 px |
| controls sm / md / lg | 28 / 34 / 40 px | 28 / 34 / 40 px |
| hover lift | -2px | -3px |
| glass blur | none | 28 / 22 / 36 px |
| motion | `polish-motion.ts` (identical) | identical, plus `--sw-t-med` 220ms |

Other skins in the registry (`skins/index.ts`): `tesla` and `crystal` (stable), `infra` and `soft` (foundation stage, the
2026-10-27 proposal), `bubble` (frozen; a stored `bubble` reads as `domus`). They follow the token contract and are not
rulebooks.

## 8. The glass rulebook

### 8.1 What it is and where it runs
The glass style is a **knob layer on top of the product tokens**. A host element carries `data-devices-style="glass"`,
`data-devices-theme` (the palette) and `data-devices-scheme`; the bridge in `styles/devices-themes.ts:151-204` then re-points
`--sw-surface`, `--sw-text`, `--sw-accent`, `--sw-r-*`, `--sw-shadow-*`, `--sw-font` and friends at the `--dv-*` knobs, so the
shared components inside the host follow by inheritance.

| Module | Glass? | Entry |
|---|---|---|
| Devices: building and area screens | only when `devices.style = glass` (default `smplwise`) | `screens/devices-style.ts` `applyDevicesPrefs` |
| Schedules, automations (scenes, scripts) | always | `applyAutomationsGlass` (`api/automations-demo.ts:113`) |
| Multimedia (screens, players, groups, the remote) | always | `applyMediaGlass` (`styles/media-glass.ts:1046`) |
| Service tickets (board, list, overview, RFQs, handlers, detail) and their settings | always | `applyAutomationsGlass` |
| Notification centre and notification settings | always | `applyNotifyGlass` (`components/notify-store.ts:69`) |

The page background is always the skin canvas: a glass screen paints no backdrop of its own unless its resolved scheme
differs from the product's (`data-devices-own-backdrop`, `devices-themes.ts:205-224`).

### 8.2 Tokens of the default palette (`devices-themes.ts:228-337`)

| Knob | Light | Dark (`data-devices-scheme="dark"`) |
|---|---|---|
| `--dv-surface` / `-solid` | `rgba(255,255,255,.64)` / `#fbfcfe` | `rgba(28,28,30,.72)` / `#1c1c1e` |
| `--dv-surface-2` / `-solid` | `rgba(255,255,255,.5)` / `#f2f5fa` | `rgba(44,44,46,.62)` / `#2c2c2e` |
| `--dv-surface-3` | `rgba(120,120,128,.14)` | `rgba(235,235,245,.14)` |
| `--dv-surface-blur` | `blur(28px) saturate(1.7)` | same |
| `--dv-border` / `-strong` | `rgba(60,60,67,.12)` / `rgba(60,60,67,.22)` | `rgba(255,255,255,.13)` / `rgba(255,255,255,.24)` |
| `--dv-overlay` | `rgba(15,23,42,.38)` | `rgba(0,0,0,.55)` |
| `--dv-text` / `-2` / `-3` | `#1c1c1e` / `#4c4c50` / `#67676c` | `#f5f5f7` / `rgba(235,235,245,.72)` / `rgba(235,235,245,.64)` |
| accent, focus, success, warning, danger, toggle | the product's, through `--sw-product-*` (so Domus blue and Domus green inside Domus) | the same aliases |
| `--dv-neutral-soft` / `--dv-offline` | `rgba(120,120,128,.14)` / `#8e8e93` | `rgba(142,142,147,.2)` / `#8e8e93` |
| `--dv-backdrop` (own-backdrop case only) | blooms `rgba(255,184,86,.2)` and `rgba(10,132,255,.16)` over `linear-gradient(180deg, #eef2f9, #e5eaf4)` | `rgba(255,184,86,.22)` and `rgba(10,132,255,.25)` over `#0a0a0c` |
| `--dv-shadow-1` | `0 10px 30px rgba(31,45,80,.1), inset 0 1px 0 rgba(255,255,255,.65)` | `0 18px 48px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08)` |
| `--dv-shadow-2` | `0 18px 44px rgba(31,45,80,.16), inset 0 1px 0 rgba(255,255,255,.65)` | `0 22px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.1)` |
| `--dv-shadow-3` / `--dv-shadow-control` | `0 24px 64px rgba(15,23,42,.26)` / `0 1px 4px rgba(0,0,0,.18)` | `0 26px 70px rgba(0,0,0,.6)` / `0 1px 4px rgba(0,0,0,.35)` |
| `--dv-font` | `-apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', 'Noto Sans Hebrew', 'Heebo', Roboto, Arial, sans-serif` | same |

Shape, type and spacing knobs (one value for every palette and scheme):

| Knob | Value | Phone (≤ 767 px) |
|---|---|---|
| `--dv-radius-sm` / `-md` / `-lg` / `-control` | 14 / 22 / 28 / 999 px | |
| `--dv-fs-title` / `-tile-name` / `-item-name` / `-value-big`; `--dv-fw-title` | 16 / 14 / 12.5 / 24 px; 700 | |
| `--dv-gap-lg` / `--dv-gap` / `--dv-gap-sm` | 18 / 14 / 10 px | 12 / 10 / 10 px |
| `--dv-card-pad-block` / `-inline` | 18 / 20 px | 14 / 14 px |
| `--dv-item-pad-block` / `-inline` | 12 / 14 px | |
| `--dv-tile-pad-block` / `-inline`; `--dv-tile-min-block` | 16 / 18 px; 116 px | 12 / 14 px; 100 px |
| `--dv-icon-ring-size` / `-lg`; `--dv-card-badge-size` | 36 / 40 px; 34 px | |
| `--dv-area-tile-min` / `-floor-card-min` / `-area-card-min` / `-entity-tile-min` | 210 / 360 / 320 / 220 px | area tile 150 px |
| `--dv-tree-inline` (max `--dv-tree-inline-max`) | 270 px (340 px) | |
| `--dv-hover-lift` | -2px (only under `prefers-reduced-motion: no-preference`) | |
| compact summary tile: min height / padding / icon / value | 60 px / 8 × 12 px / 32 px / 17 px | 2 columns |

The management layer adds (`styles/media-glass.ts:45-107`): the sheen `--mm-sheen`
`linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,0) 46%)` (dark `.07` → `.015` at 50 %); the sheet
`--mm-sheet-surface` `rgba(248,250,253,.84)` (dark `rgba(22,22,25,.84)`) with `--mm-sheet-blur` `blur(40px) saturate(1.8)` and
`--mm-sheet-w` 440 px; the segment thumb `--mm-seg-thumb` `#ffffff` (dark `#f5f5f7`, label `#1c1c1e`); `--mm-text-inverse`
`#ffffff` (dark `#1c1c1e`); `--mm-hit` 44 px; motion `--mm-motion` 240ms with `--mm-ease` `cubic-bezier(0.22, 1, 0.36, 1)`. Font
sizes are the product's `--sw-fs-*` tiers; the page title reads `--sw-h1` (so 48 px inside Domus).

Palettes `sand`, `forest`, `graphite` (`styles/devices-palettes.ts`) replace the 37 colour knobs, light and dark, and bring their
own accent and toggle colour (sand `#b3572a`, forest `#2e7d4f`, graphite `#4f5bd5`); shape knobs stay. Knob-by-knob roles:
`docs/design/DEVICE_THEMES.md`.

### 8.3 Glass components and states

| Piece | Geometry | States |
|---|---|---|
| Panel `.glass` (`media-glass.ts:190-197`) | `var(--mm-sheen), var(--dv-surface)`, blur, `1px solid var(--dv-border)`, radius `--dv-radius-md` (22 px), `--dv-shadow-1`; padding from the card knobs (18 / 20 px) | |
| Button `.btn` (`media-glass.ts:199-268`) | pill, 38 px (`.sm` 34 px), `padding-inline: 16px`, `--sw-fs-base` / 600, glass face, `--dv-shadow-control` | hover → the solid surface; pressed `scale(.97)` in 120 ms; disabled `opacity: .45`; focus `2px solid var(--dv-focus)`, offset 2 px. `.primary` = `--dv-accent` with a glow `0 6px 16px var(--mm-accent-glow)`; `.quiet` = `--dv-surface-2`, no shadow; `.danger` = filled `--dv-danger`. 44 px on touch or ≤ 767 px |
| Segmented `.seg` (`media-glass.ts:270-317`) | track `--dv-surface-3`, pill, `padding: 3px`; keys 32 px (`.sm` 30 px), `--sw-fs-base` / 600 | selected = `--mm-seg-thumb` fill, `--mm-seg-fg-on` ink, `--dv-shadow-control` |
| Chip `.rc` (`media-page.ts:112-145`) | pill, 38 px, `padding-inline: 17px`, `--dv-surface-2` with blur, `--sw-fs-md` / 500, `--dv-text-2` | **selected: OPEN (§13.2).** Today: `background: var(--dv-text); color: var(--mm-text-inverse); font-weight: 600` (dark pill in light, light pill in dark) |
| Field `.inp` (`automations-glass.ts:181-194`) | pill, 44 px, `padding-inline: 14px`, `--dv-surface-2`, `--sw-fs-md` | focus-visible `2px solid var(--dv-focus)`, offset 1 px |
| Switch `.tog` (`media-glass.ts:319-347`) | 46 × 28 px, thumb 24 px; on = `--dv-toggle-on` | 50 × 30 px on touch |
| Search `.search` (`media-page.ts:171-203`) | pill, 38 px (44 on touch), min width 240 px, glass face | focus-within outline 2 px |
| Menu `.pop` (`media-glass.ts:557-603`) | **opaque** `--sw-menu-surface`, radius 18 px, `--dv-shadow-3`, rows 44 px | checked row = accent-soft with accent-text |
| Page header (`media-page.ts:25-91`) | sticky; page `padding: 0 36px 44px` (phone `0 14px 26px`); a compact glass bar fades in on scroll | |
| Toast (`media-page.ts:357-389`) | pill, `--sw-toast-bg`, `blur(20px)`, `--sw-shadow-3` | |
| Modal layers | OPEN (§13.1): today `sw-dialog` inside multimedia hosts takes the 84 % sheet with the 40 px blur (`media-page.ts:320-326`); the automation builder is its own native `<dialog>`; the schedule-create dialog is its own element | |

Reduced motion in the glass layer: the skeleton and pending ring slow to 3 s and the shake is removed
(`media-glass.ts:763-771`); the automations layer sets `transition-duration: 0.01ms` (`automations-glass.ts:204-206`); the remote
zeroes `--mr-motion`. The solid fallback (no `backdrop-filter`, or reduced transparency) swaps the surfaces for their solid
twins (`devices-themes.ts:352-366`, `media-glass.ts:122-133`).

Internal inconsistencies of the glass layer that a cleanup should settle are in Appendix A.19.

## 9. Glass selection settings (installation-wide, `routers/settings.py:328-340`)

| Key | Values | Default |
|---|---|---|
| `devices.style` | `smplwise` · `glass` | `smplwise` |
| `devices.theme` | `default` · `sand` · `forest` · `graphite` | `default` |
| `devices.density` | `comfortable` · `compact` | `comfortable` |
| `devices.scheme` | `light` · `dark` · `auto` | `light` |
| `devices.glass_scheme` | `follow` · `light` · `dark` | `follow` |

Resolution of the glass scheme (`screens/devices-style.ts:120-125`): a fixed `glass_scheme` wins; else dark when `devices.scheme`
is dark (or auto on a dark OS); else dark when the product is dark; else light.

## 10. Accessibility

### 10.1 Contrast
Requirement: 4.5:1 for words (WCAG 1.4.3), 3:1 for control boundaries and state indicators (1.4.11).

The numbers below were **computed** for this document with the WCAG 2 formula from the token values at `0a8fb55e1`
(translucent layers composited over the flat `--sw-bg`; the blooms are not in the calculation). They are not browser
measurements. The proofs that run in the gate are `frontend/tests/unit-muted-contrast.spec.ts`,
`unit-dark-muted-contrast.spec.ts`, `unit-switch-contrast-2380.spec.ts`, `unit-hud-opaque.spec.ts` and
`unit-menu-surfaces.spec.ts` (not run for this branch: documentation only).

| Pair | Domus light | Domus dark | Classic light | Classic dark |
|---|---|---|---|---|
| `--sw-text` on the solid panel | 15.9 | 15.0 | 14.2 | 14.3 |
| `--sw-text-2` on the solid panel | 8.4 | 8.2 | 7.5 | 8.1 |
| `--sw-text-3` on the solid panel | 7.4 | 7.0 | 6.6 | 6.9 |
| `--sw-text-3` on the glass panel over `--sw-bg` | 7.0 | 7.2 | 6.6 | 6.9 |
| `--sw-text-3` straight on `--sw-bg` | 5.5 | 8.0 | 5.4 | 7.8 |
| `--sw-accent-text` on the solid panel | 7.5 | 8.4 | 6.7 | 8.3 |
| `--sw-accent-text` on `--sw-accent-soft` | 6.1 | 5.9 | 5.7 | 6.1 |
| `--sw-text-inverse` on `--sw-accent` (primary button, selected chip today) | 5.8 | 7.5 | 5.4 | 4.6 |
| state `-text` on its `-soft` fill, lowest of the eight | 5.1 (live) | 4.8 (forbidden) | 4.6 (live) | 5.5 (forbidden) |
| `--sw-on-warning` on `--sw-warning` | 5.0 | 9.7 | 8.5 | 9.7 |
| `--sw-on-success` on `--sw-success` | 5.4 | 10.6 | 8.3 | 10.6 |
| `--sw-badge-fg` on `--sw-badge-bg` | 6.5 | 6.6 | 6.5 | 6.6 |
| `--sw-focus` against the solid panel | 5.7 | 7.7 | 5.4 | 7.0 |
| switch off-track against the solid panel | 4.2 | 4.6 | 4.3 | 4.8 |
| `--sw-accent-soft` fill against the solid panel (the "light blue chip" boundary) | 1.2 | 1.4 | 1.2 | 1.4 |
| **under the floor** | | | | |
| filled badge: `--sw-text-inverse` on `--sw-offline` | **3.6** | 6.4 | **2.5** | **3.0** |
| filled badge: `--sw-text-inverse` on `--sw-danger` | 4.6 | 6.8 | **3.8** | **2.8** |
| switch: white thumb on the on-track | 3.2 | **2.2** | 4.9 | 4.8 |

Glass default palette: `--dv-text` on its solid surface 16.6 (dark 15.6); `--dv-text-2` 8.3 (8.0); `--dv-text-3` 5.5 (6.6);
`--dv-text-3` on the 64 % glass over the Domus canvas base 5.0; the selected chip of today (`--mm-text-inverse` on
`--dv-text`) 17.0 (15.6).

The last row of "light blue chip" is why Q-DES-3 is open: the ink passes, the fill alone does not separate the selected chip
from its neighbours (1.2:1 to 1.4:1; a boundary needs 3:1 or a non-colour cue).

### 10.2 Keyboard, focus and targets
- One focus ring everywhere (§7.11), visible on every surface including over video; never removed without a replacement
  (`sw-field` draws its own border + halo).
- Dialog, modal drawer and sheet trap Tab, close on Escape and return focus to the opener.
- 44 px targets on a coarse pointer (L8). `TOUCH_TARGET_PX = 44` (`styles/focus-policy.ts`).
- Field text is at least 16 px on the phone so iOS does not zoom.

### 10.3 Reduced motion
- `ui.motion` = `auto` (follow the OS) · `full` (ignore the OS reduction) · `reduced` (always). Written as `data-motion` on
  `<html>` (`design/apply.ts`).
- Reduced = every duration token 0, no hover lift, no entrance rise, press scale 1 (`design/css.ts:74-75`), plus one shared
  sheet (`REDUCED_ALL_CSS`, `design/apply.ts:141`) adopted by the page and every component root that zeroes literal durations.
  Opacity and colour changes stay; the loading spinner keeps turning, slower.
- `ui.entry_animations` = `on` · `off` turns the panel entrance off on its own (`data-enter="off"`).
- The glass layer has its own reduced-motion blocks (§8.3) and must keep them in step.

### 10.4 RTL
- Hebrew RTL is the default; every rule uses logical properties (`inline-start`, `padding-inline`, `inset-inline-end`).
- Never mirrored: video, plan geometry, the 3D scene, the timeline, the 24 h axis. Numbers, identifiers and addresses are
  LTR-isolated (`unicode-bidi`, `td.ltr`, `[data-ltr]`).
- Chevrons and the rail mirror in LTR. Physical leftovers are in Appendix A.20.
- Language (Q-SYS-7): Hebrew and English first; an LTR pass of every shared component is part of that work.

### 10.5 Transparency and performance
`prefers-reduced-transparency`, missing `backdrop-filter` support, or the lite performance tier turn every glass surface into
its solid twin with no blur. Text contrast is proven on the solid twins, which are the worst case.

## 11. Owner decisions of round 32 (design) and their settings

Source: `private/planning/OWNER_ANSWERS_ROUND32_2026-11-14_HE.md`. "Setting" = the owner wrote "אפשר לשנות בהגדרות": the chosen
option is the default and the alternative must be reachable from the settings screens through the existing settings store
(`routers/settings.py` `DEFAULTS` + `PATCH /settings`, read by `productSettings()`).

| Id | Decision | Setting? | Key today | State |
|---|---|---|---|---|
| Q-DES-1 | Keep both rulebooks; this document describes both; show both side by side. He uses Domus most. | n/a | `ui.skin`, `devices.style` | done here; which one new screens follow is asked again in round 33 (§12) |
| Q-DES-2 | Heebo everywhere | **yes** | none yet | glass still uses the OS stack (A.1) |
| Q-DES-3 | Light-blue chip with blue text, but he fears blue on blue; consult the design skills; settable | **yes** | none yet | **OPEN** (§13.2) |
| Q-DES-4 | One low KPI tile on every screen | **yes** | `ui.tile_layout` (`auto` · `cards` · `compact`) | shared tile exists; local tiles remain (A.6) |
| Q-DES-5 | "New" at the end of the header row; one floating button on the phone | **yes** | none yet | A.5 |
| Q-DES-6 | Pill buttons everywhere | **yes** | none yet | A.3 |
| Q-DES-7 | Compact phone card for tables | **yes** | none yet | A.7 |
| Q-DES-8 | One opaque dialog and one drawer; show him each before changing | n/a | n/a | **OPEN** (§13.1) |
| Q-DES-9 | Translate every operator term except "NVR" | no | n/a | A.21 |
| Q-DES-10 | "Home Assistant" stays in the settings screens (it becomes one data source among several) | no | n/a | in force |
| Q-DES-11 | One settings structure, but unsure: the glass structure of service management and notifications is excellent. Hold; discuss | n/a | n/a | **OPEN** (§13.3) |
| Q-DES-12 | At most two tab rows; phone filters behind one button | no | n/a | A.13 |
| Q-DES-13 | Order of work: cross-cutting fixes first, then modules in parallel | no | n/a | plan |
| Q-DES-14 | One initials method | no | n/a | A.17 |
| Q-DES-15 | Move to the shared components group by group, after the cleanup | no | n/a | A.4, A.6, A.22 |
| Q-DES-16 | Fix the events window-view columns | no | n/a | A.23 |
| Q-DES-17 | Fix the grey help text and the search border | no | n/a | A.24 |
| Q-DES-18 | Status colours stay fixed; define them once | no | n/a | A.8 |
| Q-DES-19 | Delete the dead contrast rules of the plan editor | no | n/a | A.25 |
| Q-CODE-4 | Add the design-regression guard now | no | n/a | not in the tree yet |
| Q-SYS-4 | No whole-page scrolling in control screens; the inner panel scrolls | no | n/a | A.12 |
| Q-SYS-5 | Long lists page; a system setting switches back to scrolling | **yes** | `ui.long_lists` (`paged` · `scroll`) | the key exists; only the home screen reads it |
| Q-SYS-6 | Every browser `confirm()` becomes the system dialog, same text | no | n/a | A.26 |
| Q-HOME-6 | Home: a short fade; the rise only from "עוד" | **yes** | none yet | home scope |

Settings that already exist and belong to this book: `ui.skin`, `ui.scheme` (`light` · `dark` · `auto`), `ui.motion`,
`ui.entry_animations`, `ui.tile_layout`, `ui.long_lists`, `ui.accent`, `ui.toggle_on`, `ui.nav_size`, `ui.rail_tone`,
`ui.tabs_mode`, `ui.dd_style` and its siblings, `ui.page_size.*`, and the five `devices.*` keys of §9. All are per
installation; a browser may keep its own scheme, and `/me/prefs` may override `ui.nav_size`, `ui.look` and `ui.background`.

Five new settings are owed by these decisions (font, selected-chip look, "new" placement, button shape, phone table card).
Their keys are for the implementing branches to name; this book only requires that each exists, defaults to the decided
option and sits with the other look settings (Settings › General › System look).

## 12. When to use Domus and when glass

Status: the owner decided to keep both (round 32) and said Domus is the one he uses most. Round 33 asks him again which of
the two a **new** screen is built to (recommended: Domus primary, glass selectable). Until that answer is in, the working
rule is the conservative reading below; it changes nothing that is drawn today.

| Situation | Use |
|---|---|
| A new operator or admin screen, a new settings screen for a simple setting | **Domus**: `sw-page` + shared components on `--sw-*` tokens |
| A new screen inside a module that is glass today (schedules, automations, multimedia, tickets, notifications) | **Glass**, with that module's existing classes and knobs, so the module stays one language |
| The device screens (building, area) | whatever `devices.style` says; both must keep working |
| A menu, popover, picker, dropdown list, HUD panel over a plan | opaque `--sw-menu-surface`, in both |
| A dialog or a drawer | the shared `sw-dialog` / `sw-drawer`; do not add another hand-built one while §13.1 is open |
| A rich management screen with many rows, rules and recipients | not decided: see §13.3 |

Never: both vocabularies on one screen; a new glass module without the owner's approval; a glass value copied into a Domus
screen as a literal (or the reverse).

What must be identical in both rulebooks whatever is decided: the font (Q-DES-2), the state colours and words, the focus
ring, the touch targets, the motion setting, the opaque menus, the page background (the skin canvas), the copy rules.

## 13. OPEN questions (held by the owner; not decided here)

### 13.1 One dialog and one drawer (Q-DES-8; round 33 Q-DES-8A, Q-DES-8B)
The owner chose "one opaque dialog and one drawer for the whole system" and asked to **see each before anything changes**.
Today: the shared `sw-dialog` and `sw-drawer` (§7.10), plus hand-built ones: the automation builder (native `<dialog>`,
92 % sheet with `blur(40px) saturate(1.8)`), the schedule-create dialog (own element), the calendar and temperature drawers
(local `<aside>`), and the 84 % translucent sheet that `sw-dialog` takes inside multimedia hosts (Appendix A.2).

| Option | Dialog (8A) | Drawer (8B) |
|---|---|---|
| א | approve the shared opaque dialog as shown; "new schedule" and "new automation" lose the glass look | approve the shared drawer as shown; the temperature drawer changes side and loses its coloured ground; calendar labels move above the fields |
| ב | approve with changes (the owner writes them) | approve with changes |
| ג | do not change now; the current forms stay | do not change now; drawers keep opening from two sides |

### 13.2 The selected chip (Q-DES-3)
The owner chose "light-blue chip, blue text", feared blue on blue would not read, and asked for the design skills' opinion
and a setting. Today three looks exist: the accent-filled key (Domus and classic, `sw-chip`), the dark pill (glass `.rc`),
and accent-soft in a few places. Measured candidates (round 33 page; text contrast / separation from the panel):

| Option | Look | Notes |
|---|---|---|
| א | light blue + blue text, as chosen | the text reads; the chip barely separates from the panel (1.2:1 to 1.4:1, §10.1) and relies on colour alone |
| ב | light blue reinforced: darker text, a blue ring, a check mark | the page reports 7.8 / 7.6 text and 5.7 / 6.7 separation (light / dark); the check is a non-colour cue; the chip grows a little |
| ג | filled blue | what Domus draws today; reads like a primary action; in dark the ink must be dark |
| ד | filled dark (black in light, white in dark) | what glass draws today; highest contrast; foreign to the palette, heavy with several filter rows |

Whatever is chosen becomes the default and the other three stay selectable in the settings.

### 13.3 The structure of the settings screens (Q-DES-11, "discuss together")
Two structures exist. **Page and cards** (most settings screens): `sw-page`, `sw-card`s, a save that appears when something
changed. **The glass structure** (service-management settings, notification settings): `system-tickets.ts` has a sticky
centred tab pill, a title block, a two-column card grid, immediate save for switches and segments plus a per-card save
button for fields; `system-notifications.ts` has a sticky section navigation column (230 px) beside a column of glass
sections, autosave, and is one very long page on the desktop.

| Option | Meaning |
|---|---|
| א | page and cards everywhere; the two glass screens are rebuilt; notifications split into tabs |
| ב | the glass structure everywhere; every settings screen is rebuilt; more scrolling on simple screens |
| ג | glass for rich management screens, page and cards for simple settings; the **behaviour** (save, fields, font) made identical in both; notifications split by topic |

Until decided: do not restructure either kind. Bug fixes inside a screen keep its current structure.

## 14. How this book is kept true

- A token value changes in `design/tokens.ts` or a skin file → the same commit updates §2 to §7 here.
- A new owner decision → §11 gets a row with its id and date; an answered OPEN question moves from §13 to the relevant section.
- A cleanup branch that closes an Appendix A item removes the item in the same commit.
- The design-regression guard (Q-CODE-4) should count what Appendix A counts, so the numbers can only go down.

## 15. Document map: what is current and what is superseded

| Document | Status |
|---|---|
| `docs/design/system/DESIGN.md` (this file) | **authoritative** |
| `docs/design/system/COMPONENT_RULES.md` | current: widget widths, truncation, wrapping, worst-case datasets. Its "all three directions" wording refers to the 2026-10-27 proposal; the rules themselves apply to both rulebooks |
| `docs/design/MOTION_RULES.md` | current as a description of motion; where its numbers differ from §7.12, §7.12 is right |
| `docs/design/UI_COPY_RULES.md` | current (amended by Q-DES-9 and Q-DES-10, §1) |
| `docs/design/DEVICE_THEMES.md` | current: the knob-by-knob reference of the glass device screens |
| `docs/design/SKIN_AUTHORING_HE.md`, `docs/design/handoff/TOKEN_CONTRACT.md` | current: how to add a skin; the token contract and its history |
| `docs/design/SCREEN_CATALOG.md`, the per-screen `*_POLISH.md`, `ST7_UI.md`, `CRY_CRYSTAL_SKIN.md`, `BV1_BUBBLE_TILES.md` | historical records of their rounds; not rules |
| `docs/design/system/DESIGN_ARX_INFRA_PROPOSAL_2026-10-27.md` (was `DESIGN.md`) | **superseded**: the three-direction proposal; kept as the description of the `infra` and `soft` foundation skins |
| `docs/design/system/TOKENS.md` | **superseded as the product's token reference** by §2 to §8 here; still the value list of the `infra` / `soft` skins and of the unbuilt "Arx Ops" |
| `docs/design/system/AUDIT_2026-10-27.md`, `WIDGET_BREAK_2026-10-27.md` | historical |
| `docs/design/DESIGN_CONTRACT.md` | **superseded** (the pre-build visual contract of 2026-09); its acceptance rules live on in `AGENTS.md` and §1 here |
| `docs/design/DU1_DESIGN_UNIFICATION.md` | historical ADR of the token layer; the direction it records (Domus-style, one language) is the origin of this book |
| `private/design-system-2026-10-27/docs/*.md` (gitignored) | working copies of the proposal; superseded with it |

## Appendix A. Where the code disagrees with this book

Verified by reading the files at `0a8fb55e1`; nothing was measured in a browser for this appendix. Counts are source
counts. Paths are under `frontend/src/` unless they start with another root. Items inferred from the CSS rather than seen on
screen say so. This list feeds the cleanup branches; `pilot/AUDIT30-COMBINED-2435` (not merged) may already change some lines.

**A.1 Font (Q-DES-2).** `styles/devices-themes.ts:241` sets `--dv-font` to an OS stack and line 200 re-points `--sw-font` at it
for every glass host; `components/media-remote-css.ts:57` does the same with `--mr-font` (only the bubble block at line 138
resets it). Literal stacks: `electricity/elec-chart.ts:53`, `electricity/elec-bill-paper.ts:53`.

**A.2 Hand-built dialogs and drawers (Q-DES-8, OPEN: list only).** `screens/automation-editor-base.ts:1629` (native
`<dialog class="sheet">`; `:178` `backdrop-filter: blur(40px) saturate(1.8)`; `:202` scrim literal `rgba(15, 23, 42, 0.38)`);
`screens/schedule-create-dialog.ts:630-631` (own backdrop + `role="dialog"` box; `:68` `background: var(--sw-surface)`, which the
glass bridge makes translucent with no blur behind it: inferred, not seen); `calendars/event-drawer.ts:394-395`,
`calendars/maint-drawer.ts:202-203`, `temperature/detail.ts:507` (local `<aside role="dialog">`); four more `<aside>` drawers in
`screens/home-edit-drawer.ts`, `calendars/resident.ts`, `calendars/view-manage.ts`, `calendars/view-approvals.ts`. In all, 39
files carry a hand-made `role="dialog"`, against 160 files using `<sw-dialog>` and 38 using `<sw-drawer>`.
`styles/media-page.ts:320-326` gives `sw-dialog` the 84 % translucent sheet inside multimedia hosts.

**A.3 Button shape (Q-DES-6: pill).** `components/sw-button.ts:41` `border-radius: var(--sw-r-sm)` (sm: `:93` `--sw-r-xs`);
`design/skins/domus.ts:179` keeps `--sw-r-sm` (12 px); classic has no override (10 px). Local buttons:
`electricity/styles.ts:213-220` (`.btn`, `min-block-size: max(36px, var(--elec-touch))`, `border-radius: var(--sw-r-sm)`), reused by
water and generator.

**A.4 Page headers outside `sw-page` (L6).** 40 raw `<h1>` lines in 30 files under `screens/`, for example
`screens/tickets-board.ts:674`, `tickets-list.ts:619`, `tickets-overview.ts:788`, `multimedia-screens.ts:988`,
`multimedia-players.ts:642`, `devices-schedules.ts:1615`, `devices-automations.ts:792`, `infra-temperature.ts:546`,
`infra-elevators.ts:281`, `system-notifications.ts:1435`, `system-tickets.ts:1134`, `system-calendars.ts:468`; feature folders:
`calendars/cal-page.ts:198`, `maintenance/list-page.ts:247`, `tickets/ticket-detail.ts:1255`.

**A.5 "New" button placement (L3).** Only `screens/investigate-cases.ts:396` uses `slot="actions"`. Elsewhere: the title row of a
hand-made header (`screens/tickets-board.ts:685`, `tickets-list.ts:623`), a toolbar after the search (`calendars/cal-page.ts:234`
and `:250`, `screens/devices-schedules.ts:1646`, `devices-automations.ts:805-806`), a local `.top` header
(`screens/devices-notices.ts:127`, `system-notices.ts:284`). `components/sw-page.ts:135` has the `actions` slot only; its phone
rule (`:110-117`) has no floating action.

**A.6 Local KPI tiles (L4).** 86 `class="kpi"` lines in 26 files outside `sw-kpi.ts` (screens 55, tickets 9, generator 7,
notices 6, insights 6, maintenance 3), for example `generator/gen-live-page.ts:191`, `screens/investigate-events.ts:1327`,
`tickets/my-numbers.ts:68`, `insights/chrome.ts:35`. `<sw-kpi>` is used in 7 files.

**A.7 Table on the phone (L5).** `components/sw-table.ts:66-116` renders every column as a caption + value stack under 768 px;
there is no "title, badge, one meta line" card and no column roles. 109 raw `<table>` in 73 files outside `sw-table.ts`
(screens 54, electricity 15, insights 13).

**A.8 Status colours written three times (Q-DES-18).** `generator/home-widget.ts:28-32` (`--sw-gw-ok: #15803d`,
`--sw-gw-warn: #c2410c`, `--sw-gw-fault: #c81e1e`), `door-windows/home-widget.ts:27-29`, `temperature/styles.ts:21-22`; they copy
`design/tokens.ts:453-457` instead of reading it. Further literal sets: `map/skin-control.ts:38`, `api/timeline-colors.ts:28-31`.

**A.9 Literals.** Outside `design/` and `styles/`: 1,600 hex literals and 467 `rgba(` (TypeScript files: 1,246 and 332). In
scope of this book the largest are `components/sw-scene.ts` (176) and `components/media-remote-css.ts` (129, of which nine px
font sizes, e.g. `:290`, `:673`, `:987`; `:177` redefines `--sw-fs-lg` as 20 px). Shared-component literals: `sw-chip.ts` height
28 px; `sw-pager.ts:48-54` `scale(0.97)` and `opacity: 0.45` instead of the tokens; `sw-tabs.ts:264,276` `border-radius: 999px`;
`sw-dropdown.ts` radius fallback 10 px.

**A.10 Weight 800.** `--sw-h1-weight: 800` (`domus.ts:115`, classic too) and `font-weight: 800` on the KPI value
(`domus.ts:172`), while the bundled Heebo files stop at 700 (`frontend/public/fonts/`): the browser synthesises the bold.

**A.11 Breakpoints.** 606 width conditions with 43 distinct pixel values; the top `max-width` values are 767 (223), 1100 (69),
700 (23), 600 (22), 899 (20), 1023 (20), 640 (17). The book's set is 767 / 1023 / 599.

**A.12 Page scroll in control screens (L1).** From the 2026-11-12 audit on v2.43.1 at 1366 × 768 (not re-measured here):
`live-camera` 464 px, `generator/gen-live-page` 307 px, `devices-area` 232 px, `system-devices` 224 px, `security-alarm` 161 px,
`wiskey-stations` 98 px, `live-overview` 79 px, `infra-temperature` 76 px, and the multimedia and tickets screens through an
inner scroller. `ui.long_lists` is read only by `api/screen-display.ts` and `screens/system-home-screen.ts`.

**A.13 More than two rows above the content (L2).** `screens/tickets-board.ts`: `.dh-row` (`:673`), the toolbar (`:689`), the
"today" strip (`:865`), and on the phone the floor chips drop to a fourth row (`styles/media-page.ts:428`).
`screens/tickets-list.ts` in table mode: `:618`, `:627` and the table toolbar (`screens/tickets-table.ts:769`).

**A.14 Hover not gated to a fine pointer.** `design/skins/domus.ts:168` (and the classic twin) lifts an interactive card, KPI
or area tile on `:hover` outside any `(hover: hover) and (pointer: fine)` query, unlike the component rules beside it.
`components/sw-chip.ts:101-109` `button:disabled:hover` is ungated too.

**A.15 Filled badge contrast.** `components/sw-badge.ts:119-159`: `filled` puts `--sw-text-inverse` on the bare state colour;
computed 3.6:1 (offline, Domus light), 2.5:1 and 3.8:1 (offline, danger; classic light), 3.0:1 and 2.8:1 (classic dark), §10.1.
Also computed, not covered by a spec I could name: the white switch thumb on the Domus dark on-track, 2.2:1
(`--sw-toggle-thumb` `#ffffff` on `#34c76a`).

**A.16 Field gaps.** `components/sw-field.ts` has no search variant, no error-message style and no read-only style; `select` has
no `:user-invalid` rule (`:74-77`).

**A.17 Initials (Q-DES-14).** Eight more implementations beside the shared `components/avatar-initials.ts:28`:
`tickets/status-block.ts:29`, `tickets/list-card-model.ts:74`, `tickets/rfq-model.ts:222`, `tickets/contacts-directory.ts:35`,
`tickets/handlers-members.ts:31`, `access-external/request-dialog.ts:253`, `access-control/people-logic.ts:429`,
`components/device-activity-logic.ts:149`.

**A.18 Motion.** `design/tokens.ts:386` `--sw-ease-out` is `cubic-bezier(0.4, 0, 1, 1)`, an ease-in shape under an ease-out
name; `sw-sheet` closes on it and `sw-state-panel` enters on it. `components/sw-drawer.ts`: the modal panel has
`transition: none`, and the non-modal panel is `display: none` while closed, so its slide probably never plays (inferred from
the CSS); `--sw-ease-drawer` is read by nothing there. `sw-dialog` has no close animation. `components/sw-sheet.ts` writes raw
`200ms` / `180ms` / `250ms`. `docs/design/MOTION_RULES.md` still gives the classic / domus press scale as 0.96 (it is 0.97).

**A.19 Glass layer, internal.** Press scale: `.btn:active` is `scale(0.97)` (`styles/media-glass.ts:225-227`) but
`styles/automations-glass.ts:201-203` makes it `scale(var(--sw-press-scale, 1))` on automations and tickets hosts. `.inp` is a
pill with `:focus-visible` in `automations-glass.ts:181-193` and `--sw-r-lg` with `:focus` in `components/notify-css.ts:139-154`.
`.rc` is 38 px in `media-page.ts:114` and 44 px in `notify-css.ts:109`. Disabled switch opacity .5
(`automations-glass.ts:27`) against .4 (`notify-css.ts:275-278`). The dark segment thumb was fixed for `--mm-seg-thumb` but
`--mr-seg-thumb` (`media-remote-css.ts:81`) and `--ab-seg-thumb` (`screens/automation-editor-css.ts:27`) are still
`rgba(118,118,128,.5)`. The glass dark ink and surfaces are neutral greys (`#1c1c1e`, `#2c2c2e`), not the navy of the product
dark (`devices-themes.ts:311-325`).

**A.20 RTL leftovers.** `components/sw-table.ts:114` (`inset 3px 0 0`, a physical selected bar on the phone);
`components/sw-toggle.ts:50-59` and `sw-drawer.ts:93-95` (physical `translateX` switched by `:host-context([dir='ltr'])`, which
only Chromium supports); `components/sw-popover.ts:112-122` (positions with physical `left` / `top`); `sw-skeleton.ts:40-47` (the
shimmer always runs right to left).

**A.21 Operator copy (Q-DES-9).** `screens/system-devices.ts:497` ("Capability matrix"); `screens/live-camera.ts:1804`
("Presets") and `:1418` ("presets"); `screens/investigate-rules.ts:263` and `:213` ("Trigger →"); `screens/investigate-playback.ts:1584`
(the raw zone name "Asia/Jerusalem"); `screens/wiskey-format.ts:47` and `:57` (the "UTC+03:00" label). The events source column
no longer shows "HA" (`screens/investigate-events.ts:41` reads "חיישן התקן").

**A.22 Native controls beside the shared ones (Q-DES-15).** 585 `<select>` lines in 201 files (most inside `sw-field`; e.g.
`screens/wiskey-people.ts:814,837,843,852`); 289 `type="checkbox"` outside `components/` (screens 168, tickets 39,
temperature 31); 26 hand-made `role="switch"`.

**A.23 Events window view (Q-DES-16).** `screens/investigate-events.ts:1203-1209`: the column renderers emit `class="ty"`,
`"sub"`, `"spot"`, but the cells render inside `sw-table`'s shadow root (`:1379`), which the screen's rules (`:463`, `:471`, `:479`,
`:662`) cannot reach. The demo columns (`:1302-1303`) repeat it.

**A.24 Undeclared tokens (Q-DES-17).** `--sw-text-muted` is declared nowhere and used without a fallback in
`screens/wiskey-bulk-people.ts:83,133`, `components/wk-listen-button.ts:89`, `components/sw-search-access.ts:25`,
`screens/system-presence.ts:79`, `screens/system-building-presence.ts:222`: the help text renders in the primary ink.
`--sw-line` likewise in `screens/investigate-search.ts:152` (no border). The "search box without a border" of the owner's
question was not traced to a line here.

**A.25 Dead contrast rules in the plan editor (Q-DES-19).** `screens/explore-plan-editor.ts:721-722` (`.kv .k`) and `:729-731`
(`.row .muted`) set `--sw-text-2`; the later rules at `:766-767` and `:828-830`, same specificity, set `--sw-text-3` and win.

**A.26 Browser `confirm()` (Q-SYS-6).** 17 calls in 10 files: `screens/explore-plan-editor.ts:1332,1364,1860,3614,5108,5164`,
`screens/system-local-users.ts:408,434,457`, `screens/system-alarm.ts:331`, `maintenance/emergency-config.ts:120`,
`tickets/settings-rules.ts:267`, `tickets/settings-locations.ts:227`, `temperature/wizard.ts:212`, `temperature/detail.ts:486`,
`generator/gen-routing.ts:183`, `components/sw-passkeys.ts:179`.

**A.27 Selected chip, the three looks (Q-DES-3, OPEN: list only).** Accent key: `components/sw-chip.ts:79-83`,
`design/skins/classic.ts:110`, `design/skins/domus.ts:181`. Dark pill: `styles/media-page.ts:139-140`,
`screens/multimedia-screens.ts:230-231`, `screens/automation-drawer.ts:200-201`, `components/notify-css.ts:128-130`,
`tickets/table-styles.ts:191-194`, `tickets/list-toolbar.ts:307-308`, `tickets/styles.ts:583-584`,
`screens/system-notifications.ts:966-967`, `calendars/styles.ts:54`, `calendars/attendee-picker.ts:49`. Plain accent:
`screens/system-automations.ts:145-146`, `tickets/settings-styles.ts:165-166`.

**A.28 Default skin.** `design/skins/index.ts:25` `DEFAULT_SKIN = 'classic'` and `routers/settings.py:93` `"ui.skin": "classic"`,
while the owner's primary rulebook is Domus. Not a defect by itself: changing the default is a release-level decision (every
baseline changes) and is not taken here.

**A.29 Stale comments.** `components/sw-page.ts:8` still says "18px title"; `components/sw-kpi.ts:89` says "20 px / 700" where
Domus and classic resolve to 24 px.
