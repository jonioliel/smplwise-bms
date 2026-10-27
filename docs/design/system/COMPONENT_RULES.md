# Component rules: minimum widths, truncation and wrapping per widget class (DESIGNSYS-297, 2026-10-27)

Companion of `DESIGN.md`. These rules apply in all three directions; they are the part of the system that broke last week
(the elevators widget in a narrow home column: truncated title, a four-line summary, a clipped button, heavy stripes) and the
part a build must test with worst-case data (`frontend/tests/unit-*.spec.ts` with the datasets of §6). The mockups'
`components.html` renders every widget at 170 / 230 / 320 / 440 px so the owner can see each rule hold.

Vocabulary: **ellipsis** = `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` with the full text in `title` (and
`aria-label` where the element is a control); **clamp(n)** = `-webkit-line-clamp: n` on a block; **count-in** = a number that
is part of the label stays tabular, LTR-isolated and never breaks from its unit; **container** = the rule keys off the widget's
own width (`container-type: inline-size`), never the viewport.

## 1. Global rules

| Rule | Value |
|---|---|
| Page title | one line, ellipsis; the subtitle one line, ellipsis; 96 px kept free at the inline end for the corner pill |
| Any name of a building, floor, area, device, camera, elevator, stop, notice | ellipsis in a row or header; clamp(2) only in a detail panel's heading |
| Counts and readings | tabular, LTR-isolated; `1,284/2,000` never wraps (`white-space: nowrap`) |
| Ages ("מלפני 11 שע׳") | one line, Ink 3, dropped before the name is truncated further (the name wins over the age) |
| Lists inside a card or widget | capped at N rows + "עוד N" (a link to the full screen); N is a setting, default 3 in a widget, 6 in a card |
| Badges | never wrap; a badge inside a row keeps its width and the name truncates; in a widget narrower than 230 px the badge keeps its word and the row loses the age |
| Buttons | the label never truncates; when a header's action no longer fits it moves below the title (desktop) or becomes the floating primary action (phone) |
| Chips | label ellipsis at 18 ch, count stays |
| Touch target | 44 px on `(pointer: coarse)` for every control; the row is the target when the control is small |
| Hover | only under `(hover: hover) and (pointer: fine)` |
| Empty / zero | "0" is a value, not an empty state; an empty state is a state panel (icon, title, one line, optional one action) |

## 2. Widget classes (home strip; size s / m / l of the home editor = the same rules keyed by the actual width)

| Widget | ≥ 320 px (l) | 230-319 px (m) | 170-229 px (s) | < 170 px |
|---|---|---|---|---|
| **Elevators** (combined) | header (icon · title ellipsis · count), loudest elevator (door icon 34 + name ellipsis + summary one line ellipsis), up to N rows (name ellipsis · solid badge), "עוד N", dots row | same, rows limited to 2, summary clamp(2) | header, loudest without the door icon, summary clamp(2), dots only (no rows) | title + count + dots only |
| Elevators (cards mode) | a flex row of 150-220 px cards, each: door icon 26-44 · name ellipsis · badge · age (l only) | cards shrink to 120 px, no age | one card per line | not offered |
| **Buses** | header (icon · stop name ellipsis), 3 lines: line number box 38 px · destination ellipsis · ETA bold | same with 2 lines | line number · ETA only (destination hidden) | line numbers only |
| **Weather** | header (icon · title · place), big temperature + icon, condition line, 5-day forecast columns | 3-day forecast | big temperature + condition only | temperature only |
| **Electricity** | header, big reading + unit, 12-bar sparkline, one caption | 8 bars | big reading + caption | reading only |
| **Clock** | big time (32 px), date line + Hebrew date in one line | same | date line clamp(1) | time only |
| **Temperature / generators / doors / notices** | same skeleton: header · one big figure or loudest item · ≤ N rows · caption | rows ≤ 2 | figure + caption | figure |

Rules for every widget: the summary line is **never longer than two lines** at any width; nothing is clipped vertically (the card
grows to its content; the strip's height is the tallest widget's); a widget without data shows one Ink-2 line ("אין נתונים",
"אין נסיעות ב-30 הדקות הקרובות") plus its last-update caption, never a blank; a widget whose source failed shows the `offline`
badge in its header instead of a paragraph; an unavailable widget takes no space (dashed frame only in edit mode).

## 3. Tiles and rows

| Class | Minimum width | Truncation | Wrapping |
|---|---|---|---|
| KPI tile (cards) | 150 px (2 columns on the phone) | label ellipsis; value never truncates (it shrinks one tier at < 150 px) | none |
| KPI tile (compact) | 168 px (`--sw-kpi-compact-col-min`, unchanged) | label wraps once then ellipsis (unchanged rule) | 1 line |
| Device row | 220 px (`--dv-entity-tile-min`) | name ellipsis, state line ellipsis; the control keeps its width | the slider drops to its own line below the row (always, not only when narrow) |
| Area row (floor card) | 280 px | name ellipsis; the counters stay on one line, dropping the icon labels first | none |
| Tree row | 220 px | name ellipsis; count column 40 px and menu column 24 px are fixed and never truncate | none |
| Table cell | column minimum per column; text columns 320 px max | ellipsis, full text in `title` | none; a table under 600 px becomes cards |
| Camera tile | 160 px (the wall's columns, never below) | name ellipsis beside the dot; the state badge stays | none |
| Elevator card | 300 px (one column under 640) | name ellipsis, place ellipsis; the badge moves below the name under 340 px | sensor pills wrap to as many lines as needed |
| Chip row (siblings, floors) | wraps to as many lines as needed on the desktop; one scrolling line on the phone | chip label 18 ch | wrap |

## 4. The elevators widget, specifically (the one that broke)

Before (2.23.2, `frontend/src/elevators/home-widget.ts`): title truncated because the header put the summary beside it on one
flex line; the summary (`summaryLine`) was a plain span that wrapped to four lines; the "cards" mode's per-elevator cards used
`--sw-r-md, 20px` and a 150 px minimum inside a flex row that clipped the last button; the striped "out of service" fill at 8 px
stripes read as heavy at widget size.

Rules now:
1. The header is `icon · title (ellipsis, flex 1) · count` - the summary is **not** in the header.
2. The summary belongs to the loudest-elevator block (`small` under the name): one line with ellipsis at ≥ 230 px, clamp(2) below.
3. Rows are capped by the setting `home.widgets.elevators.rows` (default 3) and followed by "עוד N"; under 230 px the rows are
   gone and the dots row carries the whole fleet (one dot per elevator, a square for out of service, `title` with name + state).
4. The door icon is 34 px in the widget (64 on the screen), hidden under 170 px.
5. Stripes are 6 px / 3 px at badge size (8 / 4 at screen size) and only on the solid badge, never on a card.
6. The cards mode uses the card radius of the direction (`--sw-r-md`), 150 px minimum, and each card is `name ellipsis · badge`
   with the age only in the l size; the row wraps, never clips.
7. The widget's `tone` (alarm tint) follows the loudest elevator: fire / fault → the alarm card look; off → nothing (a dashed
   card would read as "the widget is off").

## 5. Screens: what scrolls and what does not

| Screen | Desktop 1366×768 | Phone 390×844 |
|---|---|---|
| Home | no page scroll; the floor-cards panel scrolls inside itself beyond 6 floors; the tree scrolls inside itself beyond its height | the page scrolls (the strip and the KPI grid are the fold; the floor chips are sticky under the title) |
| Cameras | no page scroll; the grid shares the height among its rows (`minmax(0,1fr)`); above 16 tiles the grid scrolls inside | 2 columns of 108 px rows; the page scrolls |
| Area / devices | no page scroll; the 3-column card grid scrolls inside itself when a domain card is taller than the fold | the page scrolls; "עוד N" caps every card at 6 rows |
| Elevators | no page scroll up to 9 cards; the grid scrolls inside beyond | the page scrolls |
| Notice board | no page scroll; the table scrolls inside its card | cards; the page scrolls |
| Settings | the page scrolls (the one exception) | the page scrolls |

## 6. Worst-case datasets every screen is built against

- Names: 60-character Hebrew area name with punctuation; a one-letter name "א"; a Latin name with hyphens
  ("Spot-LED-Lobby-North-Wall-02"); a mixed name ("Lobby - Building B / מבואה").
- Counts: `0/0`, `0/412`, `1,284/2,000`, `12,480 kWh`.
- Fleets: 12 elevators with every state present (fire, fault, off, unknown, waiting, active, travelling); 16 cameras with every
  tile state (live, snapshot, connecting, offline, forbidden, stale, unknown); 40 lights in one area ("עוד 34").
- Emptiness: no buses in the window; weather source down; zero notices (empty state); an area with one device.
- Settings: an invalid required field; unsaved changes; a read-only field.
- Permissions: a viewer (no edit actions, no "כבה הכל"), a floor-scoped reader (the tree narrowed).
- Direction: the same screens with `?ltr=1` (the mockups accept it) - geometry does not mirror, chevrons and the rail do.
