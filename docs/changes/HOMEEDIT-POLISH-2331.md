# HOMEEDIT-POLISH-2331: the home editing screens, wave 3 polish

Branch `pilot/HOMEEDIT-POLISH-2331` from `origin/main` 52a8d9129. No version bump and no merge.

Scope (only these files plus one new private stylesheet):
- `frontend/src/screens/home-edit-panel.ts`: the home screen's edit panel (title, direction, phone layout, widgets, floor order)
- `frontend/src/screens/home-ambient-bar.ts`: the thin info strip (clock, weather, Shabbat, alarm)
- `frontend/src/screens/home-widgets-bv1.ts`: the Bubble tiles, the agenda and the launcher
- `frontend/src/screens/devices-notices.ts` + new `frontend/src/screens/devices-notices-css.ts`: ראשי › לוח הודעות

Design language: R5-SYSTEM-297 (settings ladder: card, heading, well, the settings segmented keys), HOMEFABLE-297 (surface tiers,
headings in the heading ink at 700), POLISH-CONTROL-297 and the owner's single press model (answer 5A, 2026-10-30:
`scale(var(--sw-press-scale))`). Tokens only. I did not edit any shared file. `styles/settings.ts` `settingsSegStyles` is imported
read-only.

## Method and its limit

The brief's memory rule takes precedence over its evidence-run paragraph, so I did not run vite build, vite preview or the
Playwright evidence specs on this workstation. Because nothing was rendered, I reviewed the code at each viewport
(1920 / 1440 desktop, 1180 / 1024 tablet, 390 phone) by tracing the media queries, the flex and grid wrapping, the control heights
and the state branches. The runner gate must confirm the findings and the fixes with screenshots. No before or after screenshots
were taken, so `docs/evidence/HOMEEDIT-POLISH-2331/` does not exist yet. The runner gate should create it.

## Critique (before)

### home-edit-panel (edit mode of the home screen)
| # | Viewport | Finding | Severity |
|---|---|---|---|
| E1 | all | Flat hierarchy. The only heading was an 11 px grey "ווידג׳טים". The screen options (title, direction, phone layout) had no heading, and "סדר הקומות" was a field label. Nothing read first. | P1 |
| E2 | all | Every widget row had the same surface-2 card with a border inside a dashed card, so the cards were nested. The panel had no elevation, while the R5 / HOMEFABLE cards step up with a shadow and the light line. | P2 |
| E3 | all | "אפס ווידג׳טים לברירת מחדל" sat under the floor list in the other column, away from the widgets it resets. | P1 |
| E4 | all | No loading state. The entity selects stayed empty until the catalogue arrived, and the catalogue error was printed after the last widget row, possibly out of view. | P1 |
| E5 | all | A widget that was off showed its whole row at 70 % opacity, its on/off checkbox included. That reads as disabled. | P2 |
| E6 | all | The open widget was marked only by its chevron. The expanded body did not belong visibly to its row. | P2 |
| E7 | all | The segmented controls were a private copy (12.5 px, 5 px padding) that differed from the settings keys (14 / 600). The icon buttons had no hover and no press feedback. | P2 |
| E8 | 390 | 28 px icon buttons, 28-32 px selects and segments: under the 44 px phone target. The extra calendar field squeezed sensor, title and remove into three columns at 390. | P1 |
| E9 | all | Spacing in raw px (12/14/24/10/6/4). Field labels at 11 px regular, while settings use 12.5-14 px at 500-600. | P3 |
| E10 | all | Empty floor list: an empty `<ol>` with no words. Floor positions were not shown. | P3 |
| E11 | all | Proposal, out of scope: the panel is long and the home screen scrolls in edit mode (`devices-building.ts` owns the placement and calls `scrollIntoView`). A drawer or a two-pane editor would meet "no page scroll in control screens". I did not touch it (that file belongs to the TREE-HIDE-UNASSIGNED branch and to the shell owners). | proposal |

### home-ambient-bar
| # | Viewport | Finding | Severity |
|---|---|---|---|
| A1 | 390 | **A triggered alarm was hidden on the phone**: the phone rule hid `.alarm` with the Shabbat part and the icons. A safety state must not disappear. | P0 |
| A2 | all | A triggered alarm was just a red word inside a grey strip. | P1 |
| A3 | all | `role="group"` with no accessible name. | P2 |
| A4 | 1024-1180 | Below 1280 px the condition and the date are hidden by design. This is fine, so I kept it. | ok |

### home-widgets-bv1 (Bubble tiles, agenda, launcher)
| # | Finding | Severity |
|---|---|---|
| B1 | The clock tile's big time used proportional figures, so it shuffles sideways every minute. The weather facts did the same. | P2 |
| B2 | The launcher's ring hovered on every pointer, so a tap left it grey on a phone. Its press was a private `scale(0.94)`, which breaks the owner's single press model. | P2 |
| B3 | Launcher buttons had no tap-highlight, touch-action or user-select guard (mobile-native). | P3 |
| B4 | Raw px gaps and paddings. The empty agenda line collapsed the tile to one text line. | P3 |

### devices-notices (לוח הודעות)
| # | Viewport | Finding | Severity |
|---|---|---|---|
| N1 | 390 | The phone cards opened on click only: no tabindex, no key, no focus ring. A keyboard user could not open a notice on a phone-width window. | P1 |
| N2 | all | A table row had `tabindex=0` but no visible focus. Enter pressed on a row's own Edit / Archive button bubbled to the row and opened the notice a second time. Space did nothing. | P1 |
| N3 | all | The unread dot was labelled with the English word "new". On the phone card, readers did not see the dot at all. | P2 |
| N4 | all | The KPI filters had no hover and no press feedback. The row hover wash showed on touch. The page title was 600 while HOMEFABLE headings are 700. | P2 |
| N5 | 390 | The search box was fixed at 110 px on the phone, and the KPI and segment targets were under 44 px. | P2 |
| N6 | all | The toast appeared without a transition. | P3 |
| N7 | all | The loading, empty, error, forbidden and module-off states already exist, on `sw-state-panel`. I kept them. | ok |

## Changes (after)

| Before | After | Why |
|---|---|---|
| Flat dashed box, an 11 px "ווידג׳טים" label | Three groups, each with a 14 / 700 heading in the heading ink: "המסך", "ווידג׳טים" (with a "n/m מוצגים" count pill), "סדר הקומות" (with a one-line hint) | E1: the eye lands on the groups |
| Panel: radius md, no shadow | Radius lg, shadow 2 + the 1 px light line, dashed frame kept as the "editing" signal | E2: the R5 card step |
| Widget rows: bordered surface-2 cards | Wells (`color-mix(surface-2 76 %, border)`, the R5 well recipe), no nested border; the open row takes an accent frame and its chevron key is filled accent-soft | E2, E6 |
| Reset under the floor list | A ghost `sm` key with the refresh icon at the end of the widgets heading row (same `data-home-reset-widgets`, same event) | E3 |
| Nothing while candidates load; the error at the bottom | "טוען את רשימת הישויות…" (role=status) under the heading; the error moves there with a warning icon (role=alert) | E4 |
| Off row at 70 % | Only the name (text-3) and the phone line (60 %) step back; the switch keeps full contrast | E5 |
| A private segmented control | `settingsSegStyles` (shared, read-only) with `--sw-seg-h: var(--sw-ctl-h-md)`, still wrapping; press = `scale(var(--sw-press-scale))` | E7 |
| 28 px keys, 28-32 px fields | 30 px (ctl-h-md) on desktop; **44 px** keys, selects, inputs and segments on a phone; the extra-field title drops under its sensor | E8 |
| px spacing, 11 px labels | `--sw-s-*` spacing, labels 12.5 / 500 | E9 |
| Empty `<ol>` | "אין עדיין קומות במבנה." and a position number on every floor | E10 |
| Triggered alarm hidden on the phone | Shown on the phone as a filled danger chip with its icon (the word "אזעקה" drops for width); other alarm states stay hidden there, as before | A1, A2 |
| `role=group` unnamed | `aria-label="מידע כללי"` | A3 |
| Proportional clock figures | `tabular-nums` on the tile's big time and the facts | B1 |
| Hover on touch; `scale(0.94)` | Hover under `(hover: hover) and (pointer: fine)`; press = `scale(var(--sw-press-scale))`; tap-highlight / touch-action / user-select guards | B2, B3 |
| px gaps; one-line empty agenda | Token gaps; the empty line keeps a 36 px row | B4 |
| Phone cards: click only | `tabindex=0` + Enter/Space, a focus ring, hover wash under a fine pointer | N1 |
| Rows: invisible focus, double open | Focus ring + row tint; the key opens only when pressed on the row itself (Enter or Space) | N2 |
| `aria-label="new"` | `role=img` + `nt('widgetNew')` ("חדש"); the dot shows on the phone card too | N3 |
| Static KPI tiles, title 600 | Hover lift (fine pointer), press, focus ring, numerals 700 tabular; title 700 | N4 |
| 110 px phone search | The search fills the toolbar row at 44 px; KPI 44 px, segments 36 px | N5 |
| Toast pops | Opacity + 8 px rise via `@starting-style` (none under reduced motion) | N6 |

Unchanged: every data attribute that specs read, every label text that specs assert, the behaviour, the settings and the events.

## Tests

| Check | Result |
|---|---|
| `npx tsc --noEmit` (once, at the end) | **0 errors** |
| `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, `unit-entity-id-sweep` (`--project=desktop --workers=1`; the Playwright web server was satisfied by a static stub on port 4215 because these specs read sources only; the stub was stopped afterwards) | **32 passed / 32** |
| impeccable `detect --json` on the five changed files | `[]` (no findings) |
| `unit-home-screen` (needs the built app) | NOT_RUN (memory rule) |
| Evidence specs: `evidence-home-screen`, `evidence-home-295`, `evidence-homeinfo-295`, `evidence-polish-295`, `layout-bv1-tiles`, `evidence-devices`, `evidence-notices`, `evidence-noticepage-295`, `evidence-noticedel-295` on desktop / tablet / mobile | NOT_RUN: runner gate |
| Before / after screenshots | NOT_RUN: runner gate |

## Pixel baselines likely affected

- `tests/visual-matrix.spec.ts-snapshots/devices-home-ready-{light,dark}-{desktop,tablet,mobile}-linux.png`: BV1 tile and agenda spacing
  (agenda column gap 10 -> 8 px, event padding 6/10 -> 6/8 px, Hebrew-date chip 24 -> 26 px high), the tabular clock figures.
- `devices-building-ready-*` and `devices-home-dialog-*`: only if those fixtures render the Bubble tiles, the agenda or the
  launcher. Check the diff before re-taking.
- No matrix entry covers the edit panel or the notices page. The ambient bar changes only for a triggered alarm, which the
  fixtures do not use (they use "דרוכה (חוץ)").

## Proposals for shared owners (not done here)

1. Edit mode layout (`devices-building.ts`): move `home-edit-panel` into a side drawer (desktop) or sheet (phone) with the save bar
   always visible, so edit mode no longer scrolls the page (E11).
2. `notices/styles.ts`: gate the `tr.go:hover` wash behind `(hover: hover) and (pointer: fine)` at the source. The settings
   notices pages and the TV mock share the sheet. Today the page-level layer cancels the wash.
3. `styles/settings.ts`: export the well recipe (`--sw-well`) as a token, so a non-settings editor does not need its own copy
   (`--he-well` here).
