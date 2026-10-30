---
name: SmplWise Arx
description: One operator-grade design language for every Arx screen - light and dark, Hebrew-first, side rail, no scrolling in control screens.
colors:
  canvas: "#f5f7fb"
  surface: "#ffffff"
  surface-2: "#f7f9fc"
  surface-3: "#eef2f8"
  hairline: "#e7ebf2"
  hairline-strong: "#d9dfe9"
  ink: "#22314c"
  ink-heading: "#1e2e47"
  ink-2: "#4b5976"
  ink-3: "#5e6d88"
  accent: "#2767ed"
  accent-hover: "#1f57d1"
  accent-soft: "#edf3ff"
  accent-text: "#2062ec"
  live: "#22c55e"
  recorded: "#2f6bff"
  offline: "#9aa3b5"
  stale: "#f59e0b"
  unknown: "#b3bac7"
  danger: "#ef4444"
  warning: "#f59e0b"
  success: "#22c55e"
  forbidden: "#dc2626"
  lit: "#ffc857"
  canvas-dark: "#0d1220"
  surface-dark: "#151c2c"
  surface-2-dark: "#1a2336"
  hairline-dark: "#232e45"
  ink-dark: "#e6ebf5"
  ink-2-dark: "#a9b4ca"
  accent-dark: "#3a6ce0"
  accent-text-dark: "#8fb2ff"
typography:
  display:
    fontFamily: "Heebo, Segoe UI, -apple-system, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-1px"
  headline:
    fontFamily: "Heebo, Segoe UI, -apple-system, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Heebo, Segoe UI, -apple-system, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Heebo, Segoe UI, -apple-system, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Heebo, Segoe UI, -apple-system, Noto Sans Hebrew, Roboto, Arial, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  2xs: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  2xl: "22px"
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
    padding: "0 14px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "34px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "28px"
  chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  kpi-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "60px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "34px"
---

# Design System: SmplWise Arx

Status 2026-10-27 (DESIGNSYS-297, branch `pilot/DESIGNSYS-297`): **proposal for the owner's choice**, not yet the product's
rulebook. The frontmatter and the body describe direction **A - "Arx Infra"**, the recommended one; §9 records how directions B
("Arx Ops") and C ("Arx Soft") differ, so the owner can pick, and so the token layer (the next task) can be built for whichever
wins. The mockups that show the three directions live in `private/design-system-2026-10-27/` (gitignored; the owner opens
`index.html` locally). `TOKENS.md` maps every value here onto the existing `--sw-*` names of `frontend/src/design/tokens.ts`;
`COMPONENT_RULES.md` gives the widget-class rules (minimum widths, truncation, wrapping).

Precedence: approved change request → `MASTER_SPEC_HE.md` and `docs/security/` → `AGENTS.md` → this document. Owner rules that
bind this system, with their dates: one language for the whole system (2026-09-30); light and dark from day one (2026-09-30);
UniFi-style direction (2026-09-14) with the infra-screens look (2026-10-23, "from now on, always"); no scrolling in control
screens (2026-10-24); clean operator screens - no hints, badges, paragraphs (2026-09-30); the floors/areas tree survives every
design (2026-10-01); never name Home Assistant outside settings (2026-09-29, `docs/design/UI_COPY_RULES.md`); menus and HUD
panels are opaque (2026-10-13); every option changeable in settings, never hard-coded.

## Overview

**Creative North Star: "The Building's Control Desk"**

Arx is the desk a building manager, a resident and a security operator all sit at: the same calm surface in the lobby at noon
and on a phone at 2 a.m. The language is the one the owner has already approved three times on the infrastructure screens
(temperature, elevators, schedules): a cool grey-blue canvas, white panels edged by a hairline, one blue, state told by a dot plus
a word, numbers set in tabular figures. It reads like a modern NVR dashboard (UniFi Protect is the yardstick) and never like a
form-based management system or a consumer smart-home toy. Density is "efficient": operator screens fit the viewport at
1366×768 and 390×844 without scrolling; settings may scroll.

Expression lives in precision, not decoration. The whole system has one accent, one type family, one radius scale, one state
vocabulary. What makes it Arx rather than generic: the KPI filter row (dot · number · word) at the top of every list screen;
solid state badges on infrastructure objects (an elevator door icon in its state colour); the building tree with its lit-count
column; warm "lit" tint for anything that is on; and a phone layout that is a real control surface, not a shrunk desktop.

**Key Characteristics:**
- One semantic palette with a light and a dark column for every name; dark is navy, not black, and never lighter than its shell.
- Heebo for everything (Hebrew first), 1.125-step scale, tabular numerals, no display face.
- Surfaces: canvas → panel → inner row (three levels), hairline borders, shadows only as a whisper (`shadow-1`) or on hover / float.
- State is never colour alone: dot + word, or shape (striped "out of service", dashed "off" card).
- Every operator control has a 44 px target on touch; the visual size may be smaller.
- No scrolling in control screens; internal panel scroll only where the data is unbounded (floor list, camera wall above 16).

## Colors

A restrained palette: tinted neutrals from the canvas blue, one accent, nine semantic states with a soft fill and a text twin each.

### Primary
- **Arx Blue** (`#2767ed` light / `#3a6ce0` dark): primary actions, the selected tab or chip, the rail's active item, the focus
  ring, the slider fill, the "recorded" timeline. Used on ≤ 10 % of any screen.
- **Blue Wash** (`#edf3ff` / `rgba(91,140,255,.18)`): the fill behind a selected chip, tree row or table row; never a text colour.
- **Blue Ink** (`#2062ec` / `#8fb2ff`): the accent as text on a surface (links, selected labels), ≥ 4.5:1 on every surface level.

### Neutral
- **Canvas** (`#f5f7fb` / `#0d1220`): the page. Direction C paints a gradient bloom on it; A and B keep it flat.
- **Panel** (`#ffffff` / `#151c2c`): cards, KPI tiles, the tree, menus (always opaque), the rail.
- **Inner row** (`#f7f9fc` / `#1a2336`): a device tile inside a card, a table header, a hovered row.
- **Track** (`#eef2f8` / `#222d44`): segmented-control grooves, slider tracks, skeletons.
- **Hairline** (`#e7ebf2` / `#232e45`) and **Hairline strong** (`#d9dfe9` / `#2f3c58`): card edges, dividers; the strong one for
  buttons and inputs and for a panel floating over the plan.
- **Ink** (`#22314c` / `#e6ebf5`), **Heading ink** (`#1e2e47` / `#f3f6fc`), **Ink 2** (`#4b5976` / `#a9b4ca`, 7.4:1 on white),
  **Ink 3** (`#5e6d88` / `#8896af`, 5.1:1): primary, heading, secondary and caption text. Ink 3 is the floor; nothing lighter
  carries words.

### States (each: bare colour for dots, bars, icons · `-soft` fill · `-text` on that fill)
| State | Light | Dark | Meaning |
|---|---|---|---|
| live / success | `#22c55e` · `#e8f8ee` · `#15803d` | `#3ddc84` · 18 % · `#3ddc84` | streaming, on, confirmed, locked |
| recorded / info | `#2f6bff` · `#eaf0ff` · `#1f5ae6` | `#6ea2ff` · 20 % · `#8fb8ff` | recorded, scheduled, informational |
| offline / neutral | `#9aa3b5` · `#f1f3f7` · `#5c6573` | `#8b96a8` · 20 % · `#b4bdcc` | disconnected, draft, snapshot-only |
| stale / warning | `#f59e0b` · `#fff4e0` · `#a04a06` | `#f5b043` · 20 % · `#f5b043` | not updated, something is on, expired |
| unknown | `#b3bac7` · `#f4f6f9` · `#5c6573` | `#6b7686` · 22 % · `#aab5c9` | no evidence |
| danger / error | `#ef4444` · `#fdecec` · `#b91c1c` | `#ff6b62` · 20 % · `#ff8a82` | fault, alarm, destructive action |
| forbidden | `#dc2626` · `#fdecec` · `#b91c1c` | `#ff7a70` · 20 % · `#ff8a82` | no permission |
| lit (warm) | `#ffc857` · 30 % | `#ffb547` · 30 % | the tint of anything that is on (a lit tile, a lit area, the tree's bulb count) |

Infrastructure objects keep their own solid fills under white text (elevators: waiting `#15803d`, active `#1d4ed8`, travelling
`#0e7490`, fault `#c81e1e`, out of service `#c2410c` striped, fire service `#881337`, unknown `#667085`), identical in both schemes.

### Named Rules
**The Dot-and-Word Rule.** A state is always a dot (or a shape) **and** a word. A bare colour is never the only carrier: out of
service is striped, an "off" card is dashed, a lit tile is warm-tinted *and* says "דולק".
**The Opaque Floating Rule.** Anything that floats over other content - a menu, a picker, a popover, a HUD panel over the plan or
the 3D canvas - paints `--sw-menu-surface`, fully opaque, no blur, in every direction and scheme (owner 2026-10-13).
**The Never-Lighter Rule.** In dark mode no surface (glass or solid) is lighter than the shell around it.

## Typography

**Display Font:** Heebo (bundled, `frontend/public/fonts/`, SIL OFL) with Segoe UI / system fallbacks
**Body Font:** Heebo
**Label/Mono Font:** `ui-monospace, Cascadia Mono, Consolas` for identifiers and addresses only (never as a "technical" costume)

**Character:** one workhorse Hebrew sans at four weights (400 / 500 / 600 / 700). Hierarchy comes from size and weight steps,
never from a second face. Numbers are tabular everywhere (`font-variant-numeric: tabular-nums`) and stay LTR inside RTL text.

### Hierarchy
- **Display** (700, 32 px, lh 1, −1 px): the clock, a big reading (temperature, kWh), a KPI value in a hero widget.
- **Headline / H1** (700, 26 px, lh 1.2, −0.4 px; phone 20 px): the page title. One per screen, at the inline start.
- **Section / card title** (600, 15 px, lh 1.4): a card heading, a floor name, an elevator name.
- **KPI value** (700, 20 px, lh 1.1, tabular): the number in a KPI tile.
- **Body** (400, 14 px, lh 1.5): device names, table cells, settings labels. Dense rows use 13 px ("base").
- **Label** (500, 12.5 px): chips, tab labels, field labels, secondary lines.
- **Caption** (400, 11 px, Ink 3): ages ("מלפני 11 שע׳"), axis labels, helper text in settings. **10 px** exists only for
  on-video "דמו" tags and sensor pills; never for words a person must read to act.

### Named Rules
**The One Face Rule.** Heebo everywhere; a display or decorative face never enters, not even in the kiosk wall.
**The Tabular Rule.** Every number that can change (counts, times, readings) is tabular and LTR-isolated, so columns and widgets
never jitter.

## Layout

The shell is a vertical rail at the inline start (right in RTL) - 72 px wide (the nav-size presets s/m/l/xl of
`TOKEN_CONTRACT.md` §2 keep their numbers) - with the brand tile, four areas and the avatar; a phone has a 56 px bottom bar
instead. The corner pill (search + health dot) floats at the top inline-end; page headers reserve 96 px of inline-end padding so
the title's actions never collide with it. There is never a top bar.

Page padding 24 px (phone 14 px); gaps 12 px between tiles, 16 px between cards; a 4 px spacing base. Breakpoints are fixed by
engineering: phone ≤ 767, tablet 768-1023, desktop ≥ 1024; the compact tile shape switches at 600.

**No-scroll contract for control screens** (owner 2026-10-24): home, cameras, area (devices), elevators, alarm, live event,
notice board fit 1366×768 and 390×844 without a page scroll. The budget on the desktop is: header 44 + widget strip 118 + KPI
row 60 + gaps = 258 px above the fold; the remaining 480 px hold the tree and the floor cards. Where data is unbounded (more
than six floors, more than 16 cameras, more than nine elevators) the **inner panel** scrolls, never the page. Settings, logs and
reports are allowed to scroll.

The **building tree** (260 px, right of the content in RTL) is on the home screen in every direction; on the phone it becomes
a row of floor chips above the floor cards; on the area screen it is the sibling-area chip row plus the breadcrumb.

Grid rules: widget strip = 5 equal columns on the desktop, 2 on the phone (the first widget spans both); KPI row = auto-fit at
150 px minimum (2 columns on the phone); floor cards = auto-fill at 300 px; camera wall = the chosen count's columns, rows
share the remaining height equally; domain cards = 3 columns (1 on the phone).

## Elevation & Depth

A hybrid: tonal layering carries the structure (canvas → panel → inner row), shadows are a whisper at rest and speak only on
hover or when something floats.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgba(16,24,40,.04)` / dark `rgba(0,0,0,.35)`): every card and KPI tile; with the hairline it is the edge.
- **Hover / raised** (`0 6px 18px rgba(34,49,76,.08)` / `rgba(0,0,0,.4)`): a tappable card under a fine pointer, a toast.
- **Floating** (`0 14px 36px rgba(34,49,76,.14)` / `rgba(0,0,0,.55)`): dialog, drawer, menu, the phone's floating action.
- **Thumb** (`0 1px 3px rgba(0,0,0,.18)` / `.45`): the toggle knob, the segmented control's selected pill.

### Named Rules
**The Hairline-First Rule.** A panel is separated from the canvas by its 1 px hairline; the shadow only softens it. Remove the
shadow and the layout still reads.
**The Cheap Wall Rule.** Camera tiles carry no shadow, no blur, no animation: 32 of them must stay cheap (owner constraint §5.10
of the handoff).

## Shapes

Rounded, not pill-shaped: 8 px on controls (buttons, inputs, inner device rows), 12 px on KPI tiles and menus, 14 px on cards
and camera tiles, 16 px on dialogs, 22 px on sheets; pill radius only on chips, badges, the corner pill, toasts and the segmented
control's track. Borders are 1 px hairlines; a state card thickens nothing - it recolours the hairline (alarm, warning) or dashes
it (off). No coloured side stripes above 1 px. Icons are the product's own 24 px stroke set (1.8 px, round caps); chevrons mirror
in LTR, geometry (video, plan, timeline) never does.

## Components

### Buttons
- **Shape:** 8 px radius, 34 px tall on the desktop (sm 28, lg 40), 44 px on touch; icon before the label in reading order.
- **Primary:** Arx Blue fill, white text, `shadow-primary` (`0 1px 2px rgba(39,103,237,.25)`); hover `#1f57d1`; press scales
  to 0.97 in 120 ms.
- **Secondary:** panel fill, strong hairline, ink text; hover takes the inner-row fill.
- **Ghost:** no fill, Blue Ink text; for "ארכב", "בטל" inside a card.
- **Danger:** outlined red for "כבה הכל" (never filled on an operator screen); filled red only inside a confirmation dialog.
- **States:** disabled fades to 50 % and keeps its shape; loading shows a 16 px spinner and blurs the label by 1 px; focus is a
  2 px ring in `--sw-focus` with a 2 px offset, on every surface including over video.

### Chips
- **Style:** pill, 28 px (36 on touch), hairline, Ink 2 label, optional count in Ink 3 and a state dot at the start.
- **State:** selected = Blue Wash fill + Blue Ink + semibold, no border; disabled fades. A long chip label truncates at 18 ch.

### Badges (state pills)
- Soft fill + `-text` twin + 7 px dot, 11 px semibold, 22 px tall; eleven kinds (live, recorded, offline, stale, unknown,
  forbidden, error, warning, success, neutral/snapshot, partial). **Solid** variant (infrastructure objects): the bare colour
  under white, 12.5 px, striped for "out of service". **On-video** variant: the video scrim under white.

### Cards / Containers
- **Corner Style:** 14 px. **Background:** panel. **Shadow:** rest. **Border:** hairline. **Padding:** 14 × 16 px.
- Card header anatomy: title (600/15) with an optional one-line subtitle in Ink 2 at the start, a 32 px icon box in Blue Wash at
  the end. Looks: `alarm` (red hairline + 9 % red wash from the top-start corner), `warn` (amber hairline), `off` (dashed).
- A tappable card lifts to the hover shadow under a fine pointer only (`hover: hover and pointer: fine`) and scales 0.99 on press.

### KPI tile
- 60 px tall, panel fill, 12 px radius; dot (12 px, with an 18 % halo) or a 32 px icon box at the start, then value (700/20,
  tabular) over label (12.5, Ink 2, ellipsis). It is a `<button>` filter: pressed = hairline in the state colour + 2 px halo.
  Compact grid: 2 columns on the phone, auto-fit 150 px above.

### Inputs / Fields
- **Style:** 34 px (44 on touch, 16 px text so iOS never zooms), 8 px radius, strong hairline, panel fill; label above (12.5/500,
  Ink 2); hint below (11, Ink 3).
- **Focus:** hairline turns Arx Blue plus a 3 px Blue Wash halo.
- **Error / Disabled / Read-only:** red hairline and red hint · 50 % fade · inner-row fill with a dashed hairline.

### Toggle
- 44 × 26 track (thumb 20), track fill `--sw-toggle-on` (Arx Blue in A) when on, 200 ms thumb travel toward the inline end
  (mirrors in LTR); disabled fades; the whole device row is the 44 px target on the phone.

### Tabs
- **Pill tabs** (view switches, sibling tabs): 3 px-inset track in the track colour, selected = panel pill with the thumb shadow
  and Blue Ink. **Segmented** (sections): the same track, selected = Arx Blue fill with white. **Underline** (settings): 40 px
  rows, 2 px Blue underline. Overflow scrolls horizontally with the first tab at the inline start.

### Table
- Panel card, flush; header row in the inner-row fill, 11 px Ink 3 labels, sticky; 44 px rows (36 dense), hairline dividers,
  hover wash, selected row in Blue Wash; cells truncate at 320 px; numbers tabular and LTR. On the phone a table becomes cards
  (title · badge · meta line), never a horizontally scrolling table for operator data.

### Navigation (rail / bottom bar)
- Rail items: icon (24) over label (11/500), 60 × 58, 12 px radius; active = Blue Wash fill, Blue Ink, semibold, a 3 px accent
  bar at the start edge. Bottom bar: 56 px, icon in a pill when active. Direction B paints the rail navy in both schemes.

### Widgets (home strip)
- A widget is a card with a 16 px icon + title header line, one big figure or 1-3 rows, and one secondary line. It is a
  container-query unit: at ≤ 230 px rows collapse to dots and the summary clamps to two lines; at ≤ 170 px the icon leaves.
  Elevators, buses, weather and electricity are specified in `COMPONENT_RULES.md`.

### Signature Component: the building tree
Panel at the inline start of the home body: building › floors › areas, 36 px rows, a 40 px lit-count column (bulb + number,
tabular), a 24 px "⋯" column kept free even when a row has no menu; selected row in Blue Wash; scrolls inside itself only when
taller than the viewport. It survives every direction; on the phone it is a chip row.

### Motion
- Tokens: fast 120 ms (press, hover, chip), medium 200 ms (toggle, tab thumb, dropdown), slow 280 ms (drawer, sheet, dialog);
  easing `cubic-bezier(.23,1,.32,1)` for enter / state, `cubic-bezier(.77,0,.175,1)` for on-screen movement,
  `cubic-bezier(.32,.72,0,1)` for drawers. Exits are faster than entries (dialog in 280 / out 160).
- What moves: press feedback (scale .97), toggle thumb, tab thumb, a toast rising 8 px, a dialog landing from scale .96 + fade,
  a drawer sliding from its edge, the skeleton shimmer. Nothing else: no page-load choreography, no hover lifts on touch, no
  animation on keyboard-triggered actions, nothing on camera tiles.
- Reduced motion: every duration becomes 0, keyframe animations stop (the spinner may keep turning), opacity changes stay.

## Do's and Don'ts

### Do:
- **Do** start every list screen with the KPI filter row and keep the page title at the inline start with 96 px kept free for
  the corner pill.
- **Do** keep Ink 2 at ≥ 4.5:1 and Ink 3 at ≥ 4.5:1 on the panel in both schemes; lighter greys are for hairlines only.
- **Do** make every operator control a 44 px target on touch (the row is the target, the visual control may be 26 px).
- **Do** truncate names with an ellipsis and keep the full text in `title`; clamp summaries at two lines; show "עוד N" instead of
  an unbounded list.
- **Do** give every widget, card and tile its real worst case before shipping: a 60-character Hebrew name, a Latin name, "0",
  "1,284/2,000", twelve items, no data, no permission.
- **Do** read every option from settings (`ui.skin`, `ui.scheme`, density, rail size, material, motion, widget mode); nothing in
  this document is a hard-coded constant in a screen.

### Don't:
- **Don't** let a control screen scroll; let a panel scroll instead, and only when the data is unbounded.
- **Don't** paint a translucent menu, picker, popover or HUD panel, in any direction.
- **Don't** put hints, badges of entitlement, or explanatory paragraphs on an operator screen; a confirmation is one question
  with a count and two buttons.
- **Don't** name Home Assistant, HA, Supervisor, Ingress, add-on, Companion or HACS outside the settings screens.
- **Don't** mirror video, plan geometry, the 3D scene, the timeline or the 24 h axis in RTL.
- **Don't** use colour alone for state, a coloured side stripe above 1 px, gradient text, a second type face, emoji as icons, or
  a shadow on a camera tile.

## 9. The three directions compared (for the owner's choice)

All three share: the shell (rail / bottom bar / corner pill), the screen structures, the tree, the state vocabulary, Heebo, the
44 px targets, the no-scroll contract, the opaque menus and the reduced-motion / reduced-transparency behaviour. They differ
in exactly four things, as an Operate surface should: palette temperature, surface material, density and radius, and one
signature move.

| | **A · Arx Infra** (recommended) | **B · Arx Ops** | **C · Arx Soft** |
|---|---|---|---|
| In one line | the infra screens, finished for the whole system | UniFi Protect density: navy rail, flat tonal panels | Domus warmth: canvas bloom, glass panels, roomier |
| Canvas light / dark | `#f5f7fb` / `#0d1220` (navy) | `#eef1f6` / `#0f1216` (graphite) | cool→warm gradient on `#eef2f9` / blooms on `#0b1020` |
| Panel | white, hairline, rest shadow | white, hairline, **no shadow** | 76 % white glass, blur 20, sheen, wide soft shadow; opaque fallback `#fdfdfe` |
| Accent | `#2767ed` / `#3a6ce0` | `#1a5fe0` / `#4d8dff` | `#2f6df6` / `#5b8dff`; toggles green `#34c759` |
| Rail | white / navy-dark | **navy `#141b2b` in both schemes**, white active item | glass, 60 % white / 60 % navy |
| Radius (control / card / dialog) | 8 / 14 / 16 | 6 / 10 / 12 | 12 / 22 / 24 |
| Type | H1 26/700, body 14 | H1 22/600, body 13.5, tighter gaps (10/12) | H1 30/700, gaps 14/18 |
| Badges | soft fill + dot | **outlined** (hairline in the state colour), 4 px radius | soft fill + dot |
| Signature move | the dot · number · word KPI row and the solid elevator badge | the dark rail and dense outlined tables | the bloom under glass, the lit glow around an "on" tile |
| Risk | least; it is the look already approved | the navy rail is a shell change; density needs checking on every table | blur on 32 camera tiles and weak wall tablets (needs the lite tier); glass reopens the fallback / contrast work |
| Cost to build on the skin layer | low: token deltas + component rules | medium: rail tone token + density rules | high: material layer for the whole shell, two fallbacks to test |

**Recommendation: A.** The owner has approved this look on three screens and asked for every new mockup in it (2026-10-23); it
reads at 4.5:1 everywhere in both schemes without tricks; it fits the existing `classic` skin values so the build is token deltas
and component rules, not a new material system. Take from B the two things worth keeping as **settings** - `ui.rail_tone`
(light / dark rail) and `ui.density` (comfortable / compact, already present) - and from C only the phone roominess (44 px rows,
larger H1 on the phone), which A already includes. If the owner prefers B or C, the token map in `TOKENS.md` carries their
columns too, so nothing in this document has to be rewritten; only the frontmatter values change.

#### Motion addendum (2.29.0)
- Press feedback is scale .97 in every skin (classic and domus used .96 before). Dialog and menu landings still start from .96.
- Reduced motion is honoured by every component: the token layer zeroes the duration tokens, and one shared sheet (design/apply.ts,
  `REDUCED_ALL_CSS`) is adopted by the page and every component root and zeroes literal animation and transition durations too.
  It applies when `ui.motion` is `reduced`, or `auto` under the OS prefers-reduced-motion; `full` ignores the OS setting.
- Panel entrance (classic and domus, also Arx): cards, KPIs, tables, home widgets, building tiles and state panels fade in with a
  6 px rise (220 ms, 30 ms stagger across the first four siblings; see `ENTER_RULES`, design/skins/polish-motion.ts). The setting
  `ui.entry_animations` (on | off, default on; Settings > General > System look > Entrance animation) turns it off through
  `data-enter="off"` on the root. Independent of `ui.motion`.
