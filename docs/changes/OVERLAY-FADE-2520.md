# OVERLAY-FADE-2520 - the overlays show their texts at full contrast from the first frame

Base `origin/pilot/STARTING-STYLE-AUDIT-2520` (`900de0c46`), branch `pilot/OVERLAY-FADE-2520`. Source: STARTING-STYLE-AUDIT-2520 open
question B, option a (owner rule: unanswered = the recommendation). STARTING-STYLE-AUDIT-2520 fixed the `@starting-style` entrances;
this row does the overlays that faded their texts WITHOUT `@starting-style`: class-toggled transitions (an open state that ends at
opacity 1 while an opacity transition is in force) and keyframe entrances (a first frame below opacity 1). Same technique: the layer
that holds text moves by transform only and is at full contrast from its first visible frame; only layers with no text fade (scrims,
backdrops, a picture); tokens only; the resting look unchanged. In-page motion (the screen panels, the home screen change, ...) is NOT
changed - that is an owner decision (question B b), listed in section 3.

## 1. The overlays, entrance and exit designed per overlay

Exit rule: an exit may fade only where the element is already inert / non-interactive and leaving; a readable text is never below
contrast while it can still be reached.

| overlay | file | entrance (was -> now) | exit | reduced motion |
|---|---|---|---|---|
| `sw-sheet` (every pop-up of the Bubble foundation: centred dialog, phone bottom sheet) | `components/sw-sheet.ts` | sheet `opacity 0 -> 1` (250 ms) with `scale(.86)`, content `focus-in` = opacity 0 + `blur(6px)` + 8 px -> sheet by transform only from `scale(.96)` (the sw-dialog box's start; at full opacity .86 read as a jump); content settles in by `translateY(8px)` only (no fade, no blur) | the closed sheet is now **`inert`** (new) and keeps its 180 ms fade + shrink; the phone sheet slides out at full opacity | unchanged (`transition: none`, content animation none) |
| `sw-user-menu` desktop panel | `shell/sw-user-menu.ts` | `opacity` + 8 px / 98 % -> transform only (the open state's transition lists only `transform`) | fades as before - the closed panel was already `inert`, the host takes no pointer | the token durations are zero (as before) |
| notification centre | `components/notify-center.ts` | `opacity` + 32 px (phone 56 px) -> transform only | fades as before - the closed panel was already `inert` | `transition: none` now also on the open rule (it would otherwise run the new transform transition) |
| calendar popover (quick create, peek) | `calendars/grid-overlays.ts` | `opacity 0 -> 1` + `scale(.96)` -> `scale(.96)` only | none (unmounted at once) | the phone sheet's 200 ms cross-fade is gone: it is simply there |
| calendar grid toast | `calendars/view-calendar.ts` | rose 100 % + 30 px while fading in -> rises from just below the screen's edge at full opacity (the start offset follows the toast's own bottom offset, so on the phone it starts below the bottom bar, not over it) | slides out at full opacity (its undo key stays readable while it can be pressed) | no fade, no travel |
| area quick sheet (pop-up / drawer / phone sheet) | `screens/area-quick-sheet-css.ts`, `area-quick-sheet.ts` | pop-up: opacity 0 until the spring started, then a 200 ms fade -> opaque from the first painted frame (the pressed element's box, the FLIP start), then the spring; content stagger `qc-in` = opacity 0 + 6 px with delays up to 110 ms (`both`: texts invisible through the delay) -> 6 px only | the closed panel is now **`inert`** (new); the pop-up keeps its 180 ms fade back into the pressed element | was a 160 ms cross-fade in -> there at once; the exit keeps its short fade (inert) |
| `sw-popover` | `components/sw-popover.ts` | keyframes `pop` opacity 0 + 4 px -> 4 px only | none (removed) | token duration zero (as before) |
| `sw-incoming-call` banner | `components/sw-incoming-call.ts` | keyframes `enter` opacity 0 + -8 px / 98 % -> transform only | none | no animation (as before) |
| PWA prompt card, connection pill | `pwa/arx-pwa-prompts.ts` | `card-rise` / `net-drop` opacity 0 -> transform only | none | none (as before) |
| automation / script / scene editor sheet + its type and picker pop-overs | `screens/automation-editor-base.ts` | `rin` / `rup` / `pop` opacity 0 -> transform only (the `::backdrop` holds no text) | none | as before |
| room card on the plan (side / float) | `components/sw-room-card.ts` | `side-in` / `pop-in` opacity 0 -> translate / scale only | none | was a 160 ms `fade-in` -> `animation: none` |
| room pop-over on the plan | `map/room-pill-view.ts` | `rp-in` opacity 0 + 97 % -> scale only | none | was `rp-fade` -> `animation: none` |
| media menus, media / notification toasts, the notification centre's dialogs | `styles/media-glass.ts` (`mm-pop`, used by `media-page`, `multimedia-screens`, `notify-center`) | opacity 0 + 96 % -> scale only | none | as before (`animation: none` where it was) |

Kept on purpose: `components/camera-source-dialog.ts` keyframes `in` fades the snapshot PICTURE of a test (`.result img`) - an image,
no text, inside a dialog that is already open; it is not an overlay entrance. The scrims / backdrops of all the overlays keep their fades.

The resting look of every overlay is unchanged (same colours, size, position).

## 2. The static checker - `frontend/tests/unit-overlay-fade-2520.spec.ts` (new)

Walks ALL of `frontend/src` (not a list of overlays): a new fade anywhere fails.
- `entranceFades`: an open-state rule (`[open]`, `[data-shown]`, `:popover-open`, `.in` / `.open` / `.show` / `.shown` / `.visible`)
  that ends at opacity 1 while the transition in force lists `opacity` (its own; else another open-state rule of the same layer; else
  the closed rule's), and the `:not(.in)` closed-state form; reduced-motion rules resolved inside the query first.
- `keyframeFades`: a `@keyframes` whose `from` / `0%` is below opacity 1, run (not as a loop: `infinite` / a count above 1 is an
  indicator) by a rule on a layer that may hold text.
- Allowed: no-text layers (scrim, backdrop, `::backdrop`, the home scrim, `img`) and the in-page list `IN_PAGE` (file + keyframes,
  each with its reason; the test also fails when an entry is stale).
- A self-test on the base patterns (shortened copies of the base CSS of sw-sheet, the user menu, the calendar, the quick sheet,
  sw-popover), and source checks of the changed rules (inert, transitions, reduced motion).

## 3. Not changed (owner decision, question B b): in-page choreography

`design/skins/polish-motion.ts` `sw-enter` (screen panels), `home/home-styles.ts` `hs-rise` / `hs-fade` (home screen change, owner
Q-HOME-6 a), `screens/home-screen-css.ts` `hs-up`, `arx/arx-login.ts`, `components/sw-state-panel.ts`, `components/sw-fold-cards.ts`,
`components/sw-block-card.ts` (an automation block's body unfolding in place), `screens/devices-building-css.ts`,
`screens/infra-elevators.ts`, `screens/infra-temperature.ts`, `screens/kiosk-wall.ts`, `screens/security-alarm.ts` (state change in
place), `wall/sw-wall.ts` (the wall display: announcements, take-over - no interaction), `xsection/sw-xsection.ts`, the calendar's
fresh event and press ring (a circle, no text). The media page header's compact fade (`styles/media-page.ts .dh`) is an in-page
fold, not an entrance.

## 4. Files

- CSS: `frontend/src/components/sw-sheet.ts`, `sw-popover.ts`, `sw-incoming-call.ts`, `sw-room-card.ts`, `notify-center.ts`,
  `frontend/src/shell/sw-user-menu.ts`, `frontend/src/calendars/grid-overlays.ts`, `view-calendar.ts`, `frontend/src/screens/area-quick-sheet-css.ts`,
  `automation-editor-base.ts`, `frontend/src/pwa/arx-pwa-prompts.ts`, `frontend/src/map/room-pill-view.ts`, `frontend/src/styles/media-glass.ts`.
- Behaviour (one attribute each): `components/sw-sheet.ts` and `screens/area-quick-sheet.ts` set `inert` on the closed panel.
- Test: `frontend/tests/unit-overlay-fade-2520.spec.ts` (new).
- Train overlap: `calendars/view-calendar.ts`, `components/sw-room-card.ts`, `screens/area-quick-sheet.ts` are also changed by
  `release/2520-train` / `pilot/WISKEY-STATUS-I18N-2520` (i18n of texts, a resident filter - far from these hunks). `git merge-tree`
  of this branch with both: clean (no conflict). No DESIGN-LITERALS-2510 or other WisKey row file.

## 5. Tests

Runner, slot B (`~/work/slotb.sh ~/work/p2520_ofade_run.sh <ref> <label> <steps>`): `vite build`, `vite preview` on localhost,
`npx playwright test ... --project=desktop --project=mobile --workers=2 --retries=0`, axe-core 4.14.0 (devDependency).
"Diag" = an uncommitted diagnostic spec (`p2520_ofade_diag.spec.ts`, kept on the runner under `~/work/`) that opens each overlay for
real: sw-sheet (centred; the phone's bottom sheet), sw-popover and sw-room-card (side, float) mounted on the plan screen's page, the
user menu, the notification centre (mock mode), the area quick sheet (bubble mock; desktop pop-up, phone sheet), the calendar's peek
(desktop pop-over, phone sheet), quick create and grid toast (demo data), the incoming-call banner (calls mock). A trap armed before the
trigger finds the layer on its first visible frame, waits for the entrance to start, and pauses every animation of the layer's flat
tree (shadow descendants, slotted content) and its ancestors. The spec reads the layer at 0 % and 40 % of its entrance and at rest:
for every text, its effective opacity (its own times every flat ancestor's) divided by the same at rest ("factor": 1 = the entrance
takes nothing away; a text the design keeps at 0.5 - a disabled key, a separator dot - counts as 1), and axe colour-contrast over the
texts inside the layer.

| run | commit | exit | result |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.json` / `npm run typecheck` / `npm run lint` | `ad7ef975d` | 0 / 0 / 0 | 0 errors / 0 errors / clean |
| `scripts/design_ratchet.py` | `ad7ef975d` | 0 | no count above the baseline (color-literal 1986, px-literal 25638) |
| unit (`playwright.unit.config.ts`, node-only): `unit-overlay-fade-2520`, `-starting-style-audit-2520`, `-dialog-toplayer-2381`, `-home-edit-drawer`, `-shell-extract-b-2450`, `-designtokens-297`, `-polish-phone-297`, `-menu-lint`, `-modal-stack-guard-2442`, `-shell-timers`, `-automation-builder`, `-plan3d-r28-ui`, `-fe-nits-2442` | `ad7ef975d` | 0 | 152 passed |
| the new checker on the BASE sources (`SW_AUDIT_SRC` = `900de0c46` `frontend/src`) | base | 1 | **25 findings** (as expected): the changed sites of section 1 (class-toggled entrances, keyframe entrances, the reduced-motion fades), nothing else |
| diag, motion on | `ad7ef975d` | 0 | **21 passed**, 3 skipped (phone-only / desktop-only sites): factor 1 and axe contrast 0 at 0 % and 40 % at every site; a transform / translate / scale animation runs at every site (the entrance is alive) |
| diag, reduced motion | `ad7ef975d` | 0 | **21 passed**: factor 1, no travel |
| diag, motion on, screenshots light + dark | `ad7ef975d` | 0 / 0 | 21 passed / 21 passed |
| diag, motion on (same spec) | **base `900de0c46`** | 1 | **19 failed**, 2 passed: factor **0** at the first frame at every site (the texts invisible); at 40 %: 0.88 - 0.94 (sheets, menus, calendar, toast), 0.90 (call), 0.92 (popover, notification centre), 0.22 (room card float, axe 6 - 7 contrast nodes); the calendar pop-over / quick create had 1 contrast node at 40 %. The 2 passes are the two phone sheets that already slid without a fade (the calendar's phone sheet, the phone user menu) |
| diag, reduced motion (same spec) | **base `900de0c46`** | 1 | **11 failed**, 10 passed: the area quick sheet's cross-fade, the calendar pop-over / phone sheet, the room cards' `fade-in` (at 40 %: 0.68, axe 4 - 6 nodes) - factor 0 at the first frame; sw-popover's 0.01 ms entrance also counts as 0 at its paused first frame (a measuring artefact of pausing a 0.01 ms animation, not visible) |
| pixel specs: all `tests/pixel-*.spec.ts`, desktop + mobile, existing baselines | `ad7ef975d` | 0 | **470 passed**, 83 skipped (the specs' own skips) - **no baseline changed** (the resting look is identical), none refreshed |
| PC (single file): `unit-overlay-fade-2520` | working tree = `ad7ef975d` | 0 | 3 passed; the same file on the base sources: 2 failed (the 25 findings and the source checks - expected) |

Compare page (local): `private/planning/overlay-fade-2520_compare_2026-11-25.html` (images in
`private/planning/overlay_fade_2520_compare_2026-11-25/`) - every site at 40 % of its entrance (base vs branch, paused there) and at
rest, desktop + phone, light + dark, with the measured factor and contrast.

NOT_RUN: the full gate; the diag did not open the PWA prompt card / connection pill (they need a service-worker update or an install
prompt), the automation / script / scene editor sheet and its pop-overs, the room pop-over on the 3D plan, the media menus / toasts and
the notification centre's dialogs (`mm-pop`) - each is the same one-line keyframe change as the opened sites and is covered by the
static checker; exits were not frame-sampled (only the inert attribute is checked, statically); the other skins beyond classic;
Safari / WebKit.

## 6. The pinned "דורש אישור" heading of the notification centre (question C = a)

The diag found the pinned group heading "דורש אישור" (`components/notify-center.ts` `.gh.pin`) at 3.76:1 at rest (axe colour-contrast,
light, classic, base and branch alike): its text took the severity FILL colour `--nt-sev-critical` (`--sw-product-danger`). Commit
`5856ae23a`: the heading's text takes the danger TEXT token `--sw-danger-text` (light `#b91c1c`, dark `#ff8a82`, the skins' own
values); the siren icon keeps the severity colour (a graphic, 3:1 suffices). `unit-overlay-fade-2520` checks the rule.

| run | commit | exit | result |
|---|---|---|---|
| tsc / typecheck / lint / `design_ratchet.py` | `5856ae23a` | 0 / 0 / 0 / 0 | 0 / 0 errors, clean, no count above the baseline |
| unit (the 13 files above) | `5856ae23a` | 0 | 152 passed |
| diag, motion on, light / dark (the notification centre at rest, axe colour-contrast inside the centre) | `5856ae23a` | 0 / 0 | 21 passed / 21 passed; the centre at rest: **0** contrast nodes, desktop + phone, light and dark (was 1, "דורש אישור" 3.76:1) |
| notification-centre specs: `evidence-notifications`, `evidence-notify-live`, `evidence-shell`, `layout-menu-kpi-fit-2439`, `evidence-media-polish`, `evidence-security-polish`, desktop + mobile | `5856ae23a` | 1 | 114 passed, 32 skipped, **10 failed - all mobile and all infrastructure**: 'Target crashed' / 'Page crashed' (8), `ENOSPC: no space left on device` at browser launch (1), one assertion after a crashed worker (1) - the runner's disk was 100 % full during the run (2.2 GB free; another job's files). Every desktop test passed. A rerun of the same step (`br5`) is queued on the runner but had not got a slot when this note was written: NOT_RUN |

No pixel spec covers the notification centre (none of these specs compares screenshots), so no baseline is involved.

## 7. Decisions (coordinator, owner rule: the recommendation)

A = a: sw-sheet lands from 96 %. B = a: the in-page choreography stays as approved. C = a: done (section 6).
