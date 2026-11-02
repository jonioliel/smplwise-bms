# HOME-EDIT-DRAWER-2351: the home screen's edit mode in a drawer

Branch `pilot/HOME-EDIT-DRAWER-2351` from `origin/release/2350-train`. No version bump and no merge.
Source: the proposal E11 / "Proposals for shared owners" item 1 of `docs/changes/HOMEEDIT-POLISH-2331.md`.

## Problem

In edit mode (`#/devices/building?edit=1`, the user menu's "עריכת המסך הראשי") the home edit panel (title, direction, phone layout,
widgets, floor order) and the display options were drawn in the page flow, above the floors. The panel is long, so the home screen
scrolled while editing, the live preview was pushed below the fold, and "הגדרות" on a widget card scrolled the page up to the panel.
Edit mode also already had a second floating box, the layout editor's card panel (`devices-layout.ts` `renderPanel`), in the same
inline-end slot.

## What changed

| Before | After | Why |
|---|---|---|
| `home-edit-panel` + `home-screen-options` in the page body | One drawer (`screens/home-edit-drawer.ts`) holding them on the "המסך" tab | The page no longer grows by the panel's height; the preview stays in view |
| The card panel floating on its own in the same slot | The card panel on the drawer's "הכרטיס הנבחר" tab; picking a card (or its device tiles) switches to it, clearing the pick goes back | One surface instead of two boxes competing for the same corner |
| Save / cancel only in the sticky edit bar | Also in the drawer footer (`data-home-drawer-save`, `data-home-drawer-cancel`), which never scrolls; the body is the drawer's one scroll container | Save / cancel always in view next to what is edited |
| A widget card's "הגדרות" scrolled the page to the panel | It opens the drawer on "המסך" and scrolls the widget's row into view inside the drawer only (no smooth scroll under reduced motion) | The page never moves |
| Panel card chrome (dashed frame, shadow) | `flat` attribute inside the drawer (the drawer is the card); the panel lays itself out by its own width (`container-type: inline-size`, one column under 640 px, labels over pickers under 460 px) | It fits a 340-420 px drawer without the phone's 44 px targets |
| - | "הגדרות המסך" key in the edit bar (`data-home-drawer-toggle`, `aria-expanded`, `aria-controls`) | The way back after the drawer is closed |

Size and place: from 1200 px a side drawer at the inline end (`--lay-panel: clamp(340px, 27vw, 420px)`, the page keeps the padding the
layout editor always reserved for its panel); below 1200 px a bottom sheet (50vh, the page keeps its 52vh of room under it).

Keyboard and focus: the drawer is a non-modal dialog (`role="dialog" aria-modal="false"`): the preview beside it stays visible and the
cards on the page stay draggable with the pointer. Entering edit mode, or opening the drawer from the bar, moves focus to its selected
tab. While focus is inside, Tab / Shift+Tab wrap inside it (`components/a11y-keys.ts` `modalKeydown`, the shared helper the phone tree
sheet uses); the tabs walk with the arrow keys (`tablistKeydown`). Escape closes the drawer (unless a control inside already took the
key) and returns focus to "הגדרות המסך", so a keyboard user can then reach the cards on the page (Tab to a card, arrows move it).
Picking a card does not steal focus.

Motion: opacity + a 12 px slide from the inline end (16 px up for the sheet) on `--sw-t-sheet` / `--sw-ease-out` via `@starting-style`;
under reduced motion opacity only (and the global token switch zeroes the duration). Closing is instant. Press feedback on the new keys
is `scale(var(--sw-press-scale))`; hover only under `(hover: hover) and (pointer: fine)`.

Unchanged: every editing function, the draft / save / cancel / discard paths (`lay.save()`, `lay.cancel()`, the `extras` hooks), every
event (`home-draft`, `home-reset`, `home-edit-open`, `hs-change`), every data attribute specs read (`data-home-edit`, `data-home-w*`,
`data-layout-panel`, `data-layout-save` ...), the permission (system.configure, checked again by the server on every write) and the
area screen's layout editor (its panel still floats as before; `HOME_DRAWER_CSS` is only in the building screen).

## Owner rules checked

- **No home editing from the phone.** The code's rule is the installation option "הסתרת עורך פריסת האזור בנייד"
  (`ui.mobile.hide_layout_editor`, `shell/phone.ts`): with it on, the user menu offers no "עריכת המסך הראשי" and `?edit=1` is refused
  on a phone (`sw-app.ts canEditHome`, `devices-building.ts syncEditFromRoute`). Kept exactly as it is; a new unit test pins both
  guards. Note: the option defaults to off, so today a phone CAN enter home edit mode unless the installation switches it on. Memory
  records the owner's preference "no editing from the phone" for the area pop-up editor (29.10). Whether the default should change, or
  the home editor should be refused on a phone outright, is an owner question (not changed here). On a phone that does reach edit mode the
  drawer is the bottom sheet with 44 px keys.
- **Tablet = bottom sheet, not a side drawer (contradiction recorded).** The brief asked for a side drawer on desktop AND tablet.
  OWNER-R12-2341 (owner 01.11, answer 8B, `devices-layout-css.ts`) decided the layout editor's panel is a side panel only from 1200 px,
  with a bottom sheet on a tablet (768-1199) so the 12-column preview keeps the full width. The approved owner decision wins: the drawer
  follows the same 1200 px breakpoint.
- No scrolling in control screens: the edit panel no longer adds to the page height. The page itself can still scroll in edit mode when
  the building is taller than the viewport (the fit packing is off in the layout editor by design, `measureFit`); that is not changed.

## Files

- `frontend/src/screens/home-edit-drawer.ts` (new): the drawer template, its keys and its CSS.
- `frontend/src/screens/devices-building.ts`: the drawer in place of the in-flow panel and the floating card panel; tab / open state,
  the card-pick switch, focus on open, focus back on close, "הגדרות" on a widget card.
- `frontend/src/screens/home-edit-panel.ts`: `flat` attribute, container queries.
- `frontend/tests/unit-home-edit-drawer.spec.ts` (new): the source contract.
- `frontend/tests/unit-a11y-polished-lint.spec.ts`: the new file joins the polished list (tablist arrows, text inks).

## Tests

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `playwright -c playwright.unit.config.ts --workers=1`: `unit-home-edit-drawer` (7, new), `unit-a11y-polished-lint`, `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, `unit-entity-id-sweep`, `unit-dark-polish-beds` | **50 passed / 50** |
| impeccable `detect --json` on `home-edit-drawer.ts`, `home-edit-panel.ts` | `[]` |
| `unit-home-screen` (page spec, needs the built app) | NOT_RUN (workstation memory rule) |
| Browser evidence: `evidence-home-screen`, `evidence-devices` (building edit: floor / area card panels now on the drawer's card tab), `layout-bv1-tiles` (edit mode, widget bodies inside the drawer), `evidence-home-polish`, `layout-a11y-295` | NOT_RUN: runner (no local build or Playwright evidence runs on this workstation) |
| Screenshots of the drawer at 1920 / 1440 / 1280 / 1180 / 1024 / 390 | NOT_RUN: runner |

What the runner must confirm: the drawer's body scrolls and its footer stays; the page height in edit mode drops by the panel's height;
picking a floor card on the building screen shows its panel (`evidence-devices` fills `[data-layout-panel="floor:..."] [data-layout-title]`);
`layout-bv1-tiles` "home-edit" checks (overflow / clipped) at the drawer's width; Escape and the Tab wrap.

## Pixel baselines likely affected

- No `visual-matrix` entry renders edit mode, so no matrix baseline should change.
- `layout-bv1-tiles` "home-edit bubble {light,dark} 1440 {agenda,launcher,clock}": a findings sweep, not a pixel baseline; the bodies now
  render at the drawer's width (one column).
- Any guide / owner-round screenshot taken in edit mode (`guide-screenshots`, `evidence-home-screen` captures) changes on re-take.

## Owner decision 02.11 (round 14)

- **Question 2 answered (b), with a setting.** A CLOSED drawer now gives its width back to the preview (the new default), and the
  installation can keep the old behaviour: "שמירת מקום לחלון העריכה כשהוא סגור" (`home.screen.edit_drawer_space`, `free` default /
  `keep` = the column stays reserved, as before). No migration: it is one more key of the existing `home.screen` JSON setting
  (services/home_screen_options.py, PATCH /settings, system.configure, audited; a stored value without the key reads as `free`).
  The choice sits in the screen options form, so it shows both on the drawer's "המסך" tab (previewed live from the editor's draft,
  saved with "שמור") and in Settings › home screen (saved at once).
  - How: while editing, the building screen sets `data-he-free` on its host when the drawer is closed and the setting is `free`
    (`editDrawerReserved()` in api/home-screen.ts); `devices-layout-css.ts` keys the page's reserved inline-end padding on
    `:host([data-lay-editing]:not([data-he-free]))`. The area screen never sets the attribute (its card panel is unchanged).
  - Only the side drawer (from 1200 px) reserves a column. Below 1200 px (tablet bottom sheet, phone) nothing changes: the 52vh room
    under the page stays, open or closed.
  - Measurements: the attribute is set in `willUpdate`, before the render, so the measurements in `updated()` (the tree height) already
    see the new width. The width changes without a window resize, so the fit key is cleared and the fit pass is re-scheduled (no stale
    fit; the fit packing itself stays off while the editor is open, as before). The CSS grids reflow by themselves, the editor's drag step
    is measured on every pointer-down, and container-query children (the edit panel) and ResizeObserver users re-measure on their own.
- **Question 1 answered (c): no change.** Home editing on the phone stays exactly as it is (the installation option
  "הסתרת עורך פריסת האזור בנייד" decides; default off).
- Also fixed on the branch: `unit-menu-lint` flagged `.he-drawer` as a menu-like floating rule; it is exempted with its reason (an
  opaque docked panel that replaces `.lay-panel`, which has the same exemption).

### Tests (round 14)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `playwright -c playwright.unit.config.ts --workers=1`: `unit-home-edit-drawer` (8, one new), `unit-home-screen-295`, `unit-tree-unassigned-2331`, `unit-owner-r12-2341`, `unit-a11y-polished-lint`, `unit-token-lint`, `unit-area-popup-edit-2290`, `unit-menu-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, `unit-entity-id-sweep`, `unit-dark-polish-beds` | **92 passed / 92** |
| pytest `test_home_screen_options_295` (new `test_edit_drawer_space_round_trip`: default, round trip, 422 on bad values, 403 for a viewer), `test_tree_unassigned_2331`, `test_multibuilding_home_2330`, `test_mobile_options`, `test_home_screen`, `test_polish_display_settings` | **68 passed / 68** |
| pytest `test_popup_layout_2290` (writes `home.screen.popup`) | **4 passed / 4** |
| Runner `preview` @ 0234a4158 (`unit-home-screen`, `unit-home-screen-295`; the name filters also matched `evidence-home-screen`, `evidence-devices*`, which skip without a fixture backend) | **49 passed, 0 failed** (257 skipped) |
| Runner `fixture` `evidence-devices --project=desktop` @ 0234a4158 | 35 passed, **7 failed** - the SAME 7 fail on the base `release/2350-train` @ 908c2e142 (pre-existing drift of a non-gate spec: refresh label, area rows, glass alpha, indicators, bulk popover, tile arrange subheading); none touches the drawer |
| Browser check of the new behaviour itself (drawer closed at 1440: the preview widens; with `keep` it does not) | NOT_RUN: no spec drives it yet |

## Owner questions (answered 02.11, round 14 - kept for the record)

1. Should home edit mode be refused on a phone always, or should the "hide the layout editor on the phone" option default to on?
   (a) refuse always (b) default the option to on (c) leave as is.
2. The drawer keeps its column reserved when closed (the page does not re-flow, so the preview and the grid measurements stay stable).
   Should a closed drawer give the width back to the preview instead? (a) keep reserved (b) give it back.
