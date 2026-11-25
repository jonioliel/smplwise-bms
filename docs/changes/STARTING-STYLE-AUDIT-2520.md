# STARTING-STYLE-AUDIT-2520 - every `@starting-style` entrance audited for the two sw-dialog faults

Base `origin/pilot/FLAKY-FIX-2520` (`606246076`), branch `pilot/STARTING-STYLE-AUDIT-2520`. Source: FLAKY-FIX-2520 open question D.
FLAKY-FIX-2520 found two faults in `sw-dialog`'s entrance: (1) the box's `@starting-style` stood BEFORE the rule it should start from,
so the later rule won and the entrance never ran; (2) the scrim faded the opacity of a layer that holds text, so every text of the
dialog was below contrast for the length of the fade (axe colour-contrast, about half the runs). This row audits every other
`@starting-style` of the frontend for the same two faults and fixes them the same way: only layers with no text fade; a layer that
holds text arrives by transform only and is at full contrast from the first frame; tokens only; the resting look unchanged.

## 1. The audit (all 21 `@starting-style` blocks, 12 files)

| file | layer | fault 1 (dead) | fault 2 (text fades) | change |
|---|---|---|---|---|
| `components/sw-dialog.ts` | scrim, box | fixed in FLAKY-FIX-2520 | fixed in FLAKY-FIX-2520 | none |
| `components/sw-drawer.ts` | modal `::backdrop` | no | no - a `::backdrop` holds no text and is not the panel's parent; the panel enters by a mask reveal (keyframes) | none |
| `components/sw-dropdown.ts` | desktop list `.pop` | no | **yes** (`opacity: 0`, `--sw-t-fast`) | transform only (`scale(0.97) translateY(-4px)`) |
| `components/sw-dropdown.ts` | phone sheet + `::backdrop` | - (keyframes) | no - the sheet slides (transform), only the `::backdrop` fades | none |
| `components/sw-recorded-month.ts` | month popover `.pop` | no | **yes** | transform only; the phone sheet's `opacity: 1` override dropped (nothing to override) |
| `tickets/list-toolbar.ts` | filter panel `.fpop` (desktop, phone sheet) | no | **yes** (both) | transform only |
| `shell/sw-app.ts` | permissions notice `.perm-toast` | no | **yes** | translate only |
| `screens/devices-notices-css.ts` | toast | no | **yes** | translate only (reduced motion as before: no travel, zero duration) |
| `screens/door-windows.ts` | toast | no | **yes** | transform only |
| `screens/infra-temperature.ts` | toast | no | **yes** | transform only |
| `screens/home-edit-drawer.ts` | edit drawer (side; sheet below 1200 px) | no | **yes** (both) | transform only; reduced motion: `transition: none` (was an opacity-only fade) |
| `screens/mapping-assistant-css.ts` | assistant `.sheet` | no (the later `.sheet` rule set only `transition`), but the block stood before it | **yes** | transform only; the starting style moved AFTER the `.sheet` rule |
| `home/home-styles.ts` | scrim `.hscrim` | no | no - an empty sibling of the sheet | none (it still fades) |
| `home/home-styles.ts` | `.sheet.dialog`, `.sheet.umenu`, `.call`, `.camfull`, `.toast2` | no (the later rules that set `transform` are in the reduced-motion query, on purpose) | **yes** | transform only |
| `home/home-styles.ts` | `.sheet.bottom`, phone `.sheet.umenu` | no | no (transform only already) | the phone umenu's `opacity: 1` override dropped |

Fault 1 (the order mistake) did not occur anywhere else; fault 2 occurred in 10 files (14 starting-style rules - the checker's count on the base, section 4).

Exits: none of these entrances has an exit transition that fades readable text. The elements are removed or hidden at once, except the
home overlays, whose exit (`.out`) runs on a COPY that `sw-home.ts ghostOverlay()` puts in a closed shadow root, `inert` and
`aria-hidden` - nobody reads it and no tool (axe included) finds it. Kept as is.

Reduced motion (as today): the token durations go to zero (css.ts), so nothing travels; the home sheets keep `transform: none !important`
under the query; the edit drawer's opacity-only fade under reduced motion is gone (the drawer is simply there). Nothing that moved
before moves under reduced motion now.

## 2. Outside this row: entrances / exits that are not `@starting-style`

The grep also shows class-toggled transitions and keyframe entrances that fade text-holding layers. They are a different mechanism
(no order fault is possible; most are two-way, open AND close, so removing the fade changes the exit as well) and several are
owner-approved choreography. Not changed here; listed for a follow-up (open question B):

- Overlays, class-toggled (open and close): `components/sw-sheet.ts` (the sheet's opacity, and the content's `focus-in` blur + fade),
  `shell/sw-user-menu.ts` (desktop panel), `calendars/grid-overlays.ts` (`.pop`), `calendars/view-calendar.ts` (toast),
  `screens/area-quick-sheet-css.ts`; the media / notification pages (`notify-center`, `notify-row`, `system-notifications`,
  `multimedia-screens`, `styles/media-page.ts`) use the same pattern on `--mm-motion` (not inspected one by one).
- Overlays, keyframe entrances with `opacity: 0`: `camera-source-dialog` (`in`), `sw-popover` (`pop`), `sw-incoming-call` (`enter`),
  `pwa/arx-pwa-prompts` (`card-rise`, `net-drop`), `area-quick-sheet-css` (`qc-in`), `automation-editor-base` (`pop`, `rin`, `rup`),
  `sw-block-card` (`pop`), `sw-room-card` (`side-in`, `pop-in`), `map/room-pill-view` (`rp-in`).
- In-page choreography (approved): the screen panels' `sw-enter` (POLISH-BOLD-297, classic / domus), the home screen change
  (`hs-rise` / `hs-fade`, owner Q-HOME-6 a: "fades in place"), `sw-state-panel`, `sw-fold-cards`, the elevators / temperature cards,
  `devices-building` tree, `kiosk-wall`, `arx-login`, the calendar's fresh event, the wall / kiosk 3 s cross-fades.

## 3. Files

- `frontend/src/components/sw-dropdown.ts`, `sw-recorded-month.ts`, `frontend/src/tickets/list-toolbar.ts`,
  `frontend/src/shell/sw-app.ts`, `frontend/src/screens/devices-notices-css.ts`, `door-windows.ts`, `infra-temperature.ts`,
  `home-edit-drawer.ts`, `mapping-assistant-css.ts`, `frontend/src/home/home-styles.ts` - CSS only.
- `frontend/tests/unit-starting-style-audit-2520.spec.ts` (new) - a static checker of every `@starting-style` in `frontend/src`:
  fault 1 = a later ordinary rule with the same selector sets the same property (or its shorthand; rules inside a reduced-motion query
  are the intended override); fault 2 = a starting `opacity` below 1 outside the no-text layers (`::backdrop`, the home scrim). A new
  site is checked automatically. Proved on the v2.51.0 `sw-dialog` text (both faults caught) and on the base sources (section 4).
- `frontend/tests/unit-home-edit-drawer.spec.ts` - follows the drawer's transform-only entrance and the reduced-motion `transition: none`.
- Train overlap: of these files only `shell/sw-app.ts` is changed by `release/2520-train` (two `i18n-keep` comments ~1,900 lines away
  from this hunk - no conflict); none by the WisKey rows or DESIGN-LITERALS-2510.

## 4. Tests

Runner, slot B (`~/work/slotb.sh ~/work/p2520_ssaudit_run.sh <ref> <label> <steps>`): `vite build`, `vite preview` on `localhost`,
`npx playwright test ... --project=desktop --project=mobile --workers=2 --retries=0`, axe-core 4.14.0 (devDependency).
"Diag" = an uncommitted diagnostic spec (`p2520_ssaudit_diag.spec.ts`, kept on the runner under `~/work/`) that opens each changed
entrance for real (the dropdown list, the playback screen's month, the tickets filter panel, the home edit drawer, the mapping
assistant, the home door confirmation and personal menu). A trap armed before the click pauses the layer's own transitions on the
FIRST frame the layer exists; the spec then reads the layer at 0 % and at 40 % of its entrance and at rest: the opacity of the layer
times every composed ancestor, its transform, and axe colour-contrast over the nodes inside the layer (`elementRef`).

| run | commit | exit | result |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.json` / `npm run typecheck` / `npm run lint` | `327e29c0f` | 0 / 0 / 0 | 0 errors / 0 errors / clean |
| `scripts/design_ratchet.py` | `327e29c0f` | 0 | no count above the baseline (color-literal 1986, px-literal 25639) |
| unit (`playwright.unit.config.ts`): `unit-starting-style-audit-2520`, `-home-edit-drawer`, `-dialog-toplayer-2381`, `-shell-extract-b-2450`, `-designtokens-297`, `-polish-phone-297`, `-menu-lint`, `-recorded-month`, `-modal-stack-guard-2442` | `327e29c0f` | 0 | 76 passed |
| the checker on the BASE sources (`SW_AUDIT_SRC` = `606246076` `frontend/src`) | base | 1 | **14 findings** (as expected): every fault-2 site of section 1, none of fault 1 |
| diag, motion on | `327e29c0f` | 0 | **13 passed**, 1 skipped (the dropdown's phone sheet, unchanged): opacity 1 and axe contrast 0 at 0 %, 40 % and rest at every site; a `transform` transition runs at every site (the entrance is alive) |
| diag, reduced motion | `327e29c0f` | 0 | **13 passed**: no transition at all, opacity 1, contrast 0 |
| diag, motion on, screenshots light + dark | `327e29c0f` | 0 / 0 | 13 passed / 13 passed |
| diag, motion on (same spec) | **base `606246076`** | 1 | **11 failed**, 2 passed: opacity 0 at the first frame at every changed site; at 40 %: 0.925 (lists, 120 ms), 0.683 (home dialog / menu, axe 2 - 4 contrast nodes, e.g. 4.35), 0.223 (edit drawer: 8 nodes on the phone, 35 on the desktop, e.g. 1.61; mapping assistant 1.29). The 2 passes are the two phone sheets that already rose without a fade (the month sheet, the home menu sheet) |
| pixel specs (`pixel-home-auditfix-2437`, `-home-fb-2431`, `-home-gaps-2436`, `-home-next-2500`, `-audit30a-glass-bridge`, `-access-events`, `-access-s12`, `-mfa-screens-2510`, `-nvr-encoding-batch`, `-sw-table`, `-sw-tabs`, `-round4-leftovers-2390`, `-incoming-call`, `-dialog-toplayer-2381`), desktop + mobile, existing baselines | `327e29c0f` | 0 | 122 passed, 8 skipped - **no baseline changed** (the resting look is identical), none refreshed |
| PC (single files): `unit-starting-style-audit-2520`, `unit-home-edit-drawer` | working tree = `327e29c0f` | 0 / 0 | 3 passed / 8 passed |

Compare page (local): `private/planning/starting_style_audit_2520_compare_2026-11-25.html` - every site at 40 % of its entrance
(base vs branch, the animation paused there) and at rest, desktop + phone, light + dark.

NOT_RUN: the full gate; the toasts (`perm-toast`, notices, door-windows, temperature, home `toast2`) and the home call / full-screen
camera were not opened in the diag (same one-line change as the opened sites; covered by the static checker); the other skins beyond
classic; Safari / WebKit (`@starting-style` of `transform` / `translate` is standard; a browser without it shows the layer at once, as
before).

## 5. Open questions

A. The entrances above now move without a fade (a list grows from 97 %, a toast rises 8 px, a drawer slides 12 px - all at full
   opacity). a) keep (recommended: the texts are readable from the first frame, the same rule as the dialog) b) bring a fade back
   on some of them (accepts text below contrast during it).
B. The non-`@starting-style` fades of section 2. a) one follow-up row for the overlays only (sw-sheet, sw-user-menu, the calendar
   overlays and toast, area-quick-sheet, the keyframe overlay entrances), exits designed per overlay (recommended) b) also the in-page
   choreography (changes approved looks: owner decision) c) leave.
C. Reduced motion of the home edit drawer: it used to fade (no travel); now it appears at once. a) keep (recommended: nothing moves,
   nothing below contrast) b) restore the fade under reduced motion only.
