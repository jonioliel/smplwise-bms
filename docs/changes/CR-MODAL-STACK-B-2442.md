# CR-MODAL-STACK-B-2442 - the hand-built dialogs join the shared modal stack

Branch `pilot/CR-MODAL-STACK-B-2442`. Follow-up of `pilot/CR-MODAL-STACK-2441` (436fdb701), the part that change note left open
("the 42 files that draw their own `role="dialog"` ... do not join the stack"). **Base: `origin/pilot/CR-MODAL-STACK-2441`** with
`origin/main` 2.43.7 (cc69447f1) merged in (22f836bbc, no conflicts). It must board after CR-MODAL-STACK-2441 (and so after
DIALOG-DRAWER-ONE-2439).

## Why

CR-MODAL-STACK-2441 gave sw-dialog, the modal sw-drawer and sw-sheet one stack, so one Escape press closes one layer. Every screen
that draws its own `role="dialog"` box stayed outside it: a confirmation above such a box closed together with the box, a box above
a primitive closed together with the primitive, and most of the boxes had no Tab trap, no inert background and no focus return.

The real inventory is 35 files / 63 boxes (the "42" of the finding counted an older tree).

## What

### The stack API (additions only)

- `modal-stack.ts`: `syncLayer(layer, open, options?)` - "open or not", said after every render; the layer enters once and keeps its
  place while it stays open (a re-render never lifts it over a layer opened later). `NO_TRAP` - the options of a layer that does not
  keep Tab (an anchored popover).
- New `components/hand-modal.ts`, class `HandModal` - for a screen whose box had no keyboard handling of its own. The screen keeps
  drawing its box and calls `modal.sync(open)` in `updated()` and `modal.release()` in `disconnectedCallback()`. While open: a layer
  of the stack; Escape (heard on the window, so it works wherever focus is) closes it only while it is the top layer; Tab / Shift+Tab
  stay inside it while it holds the trap; the elements the screen names are `inert`; after a keyboard close focus returns to the
  opener. A pointer / touch close leaves focus alone (the rule `area-quick-sheet.ts` already follows: a programmatic focus after a tap
  draws the opener's focus ring).
- `a11y-keys.ts modalKeydown(e, box, close, layer?)` - with a layer, Escape asks `takesEscape` and Tab asks `holdsTab`.

No scroll lock was added anywhere: every moved box already sits on a fixed, full-screen scrim or locks the scroll itself
(`area-quick-sheet` - `lockScrollChain`), and a lock that hides a scroll bar is a pixel change.

### Moved (23 files, 48 boxes)

| Family | File | Boxes | How |
|---|---|---|---|
| Home interface | `home/sw-home.ts` | 11 | `HandModal` over the `ovl` slot: the full-screen camera, the door / scene / load confirmations, the personal menu, the room picker, the favourite sheet, the talk sheet, the code pads, switch user. Its own `@keydown` Escape is gone (the layer's listener replaced it). Inert: `.hs` (the screen, its navigation and the "now" bar). |
| Home interface | `home/home-alarm.ts`, `home-calendar.ts`, `home-intercom.ts` (2), `home-notices.ts`, `home-p3-announce.ts`, `home-p3-media.ts` (2), `home-scene-new.ts`, `home-schedules.ts`, `home-tickets.ts` (2) | 12 | Template modules drawn in the same `ovl` slot - the same one layer; the files did not change. |
| Home interface | `home/sw-home-call.ts` | 1 | `HandModal`; Escape never dismissed a call and still does not, but the call now answers the key, so a sheet under it no longer closes behind it. Tab stays in the call. |
| Calendars | `calendars/resident.ts` | 4 | `HandModal` over the bottom sheets (equipment, confirm, cancel, another time). **New**: Escape closes the sheet (there was no key at all), Tab trap, inert background, focus return. |
| Calendars | `calendars/grid-overlays.ts` | 4 | `cal-quick-create` and `cal-peek` (mounted only while open) push / remove themselves; Escape asks `takesEscape`; the phone's sheet layout wraps Tab (new), the anchored popover does not trap. |
| Shell | `components/notify-center.ts` | 1 | `syncLayer(open, NO_TRAP)`; Escape asks `takesEscape` (its door dialog is an sw-dialog above it and now takes the key alone - the dialog's `beforeclose` runs the same cancel / dismiss). |
| Shell | `shell/sw-user-menu.ts` | 1 | `syncLayer(open)`; Escape asks `takesEscape`, its own Tab wrap runs only while it holds the trap. |
| Shell | `shell/sw-app.ts` | 2 | The search panel and the system-status popover share one non-trapping entry; the global Escape asks `takesEscape` first. |
| Screens | `screens/mapping-assistant.ts` | 1 | Mounted only while open: push / remove; Escape asks `takesEscape` (a busy assistant answers the key and stays, as before). |
| Screens | `screens/area-quick-sheet.ts` | 2 | `syncLayer(open)`; Escape asks `takesEscape` after its own nested-dialog check, Tab wraps only while it holds the trap. The reset confirmation is drawn inside the panel and is closed first by the panel's own Escape (unchanged). |
| Screens | `screens/devices-building.ts` | 1 | The phone's tree sheet: `syncLayer` + `modalKeydown(..., layer)`. |
| Cast | `components/sw-cast-picker.ts` | 2 | The docked panel (and the "busy screen" question inside it): `syncLayer(open && not the phone sheet, NO_TRAP)`; Escape asks `takesEscape`. The phone's layout is an sw-sheet - a layer already. |
| Cast | `components/sw-cast-pill.ts` | 1 | The tray: `syncLayer`, Escape asks `takesEscape`. |
| Tickets | `tickets/table-toolbar.ts` | 4 | Columns / saved views / monthly report / filters popovers: `syncLayer(!!pop, NO_TRAP)`, Escape asks `takesEscape`. |
| Tickets | `tickets/list-toolbar.ts` | 1 | `FilterPanelController`: `syncLayer` in `hostUpdated`, Escape asks `takesEscape`. |

Behaviour that changes for a person:

| Case | Before | Now |
|---|---|---|
| a confirmation (sw-dialog) over any moved box, Escape | both close (or only the box, by listener order) | the dialog; the box on the next press |
| a moved box over an sw-sheet / sw-dialog / modal sw-drawer, Escape | both close | the box; the primitive on the next press |
| home sheet, Escape with focus outside the home interface's root | nothing | closes |
| home sheet / resident sheet, Tab | walks into the screen behind the scrim | stays in the sheet |
| home sheet / resident sheet, the screen behind | reachable by keyboard and assistive tools | inert |
| home sheet / resident sheet closed from the keyboard | focus is lost (the screen was re-drawn) or stays where it was | returns to the opener |
| resident bottom sheet, Escape | nothing | closes |
| a ringing home call above a home sheet, Escape | the sheet under the call closes | nothing (the call answers the key) |
| calendar quick-create / peek as a phone sheet, Tab | walks out of the sheet | wraps |

A single open box with the mouse: unchanged.

### Skipped (12 files, 15 boxes) - allow-listed in the guard, each with its reason

None of them needed a visual change; they are not modal surfaces.

| File | Boxes | Reason |
|---|---|---|
| `calendars/connect-dialogs.ts` | 1 | an inline confirmation row inside an sw-dialog (the dialog is the layer); no key listener |
| `components/wk-door-tech.ts` | 1 | an inline confirmation block inside an sw-dialog; no key listener |
| `maintenance/task-sheet.ts` | 2 | inline confirmation alerts inside an sw-dialog; no key listener |
| `components/media-queue-list.ts` | 2 | inline confirmation rows of the queue list (no scrim, no key listener) |
| `screens/door-automation-block.ts` | 1 | an inline confirmation block of a form section (no scrim, no key listener) |
| `components/sw-popover.ts` | 1 | a non-modal card (`aria-modal="false"`); its Escape acts only with focus inside and skips a key already taken |
| `components/sw-recorded-month.ts` | 1 | a native `popover="auto"`: the browser owns its top layer, Escape and light dismiss |
| `map/room-pill-view.ts` | 1 | a hover / focus popover of a map pill (non-modal, leaves with the pointer) |
| `pwa/arx-pwa-prompts.ts` | 2 | non-modal install cards (no scrim, no Escape) |
| `screens/home-edit-drawer.ts` | 1 | edit mode's docked panel (`aria-modal="false"`, open the whole time beside the page it edits): as a layer it would hold Escape over the page. It still uses `modalKeydown` without a layer, so a dialog opened from inside it shares the key with it as before - an open item |
| `screens/scenario-recipients.ts` | 1 | an inline picker of a form field; Escape acts only with focus inside it |
| `temperature/detail.ts` | 1 | a footer popover inside the modal sw-drawer, already ordered by the drawer's `data-nested-open` walk |

Dropped because they need a visual change: none.

### Not done

- Focus is not moved INTO a `HandModal` box when it opens (the home and resident sheets never did): a focus moved from code into a
  field draws its caret / ring, which is a pixel change. The first Tab press lands on the box's first control.
- `HandModal` makes inert only what the screen names (the home screen under the home sheet; the resident screen under its sheet) -
  not the whole page outside the screen's own root (the shell around an embedded home interface). The Tab trap covers the keyboard.
- The anchored popovers (notify centre, cast, tickets, shell) got the Escape order only - no Tab trap, no inert, by design.
- `screens/home-edit-drawer.ts` (above).

## The guard

`tests/unit-modal-stack-guard-2442.spec.ts` (Node only) scans `src/**/*.ts` for `role="dialog"` / `role="alertdialog"` (markup or
`setAttribute`) outside the three primitives. Every file that has one must be in `ON_STACK` (and import `modal-stack` or `hand-modal`,
itself or the file that draws its template) or in `ALLOWED` with a reason, **with the exact number of boxes**: a new file fails, and
a new box in a listed file fails too. A stale entry fails as well. It also pins `HandModal`'s contract and tests `syncLayer`.

## Files outside the plan

- `tests/unit-modal-stack-2441.spec.ts`: one assertion narrowed. It forbade any `shadowRoot?.activeElement` in the three primitives
  (to catch a private copy of `deepActive`); after the merge of main, `sw-dialog.ts` carries main's b19e99165 loop that checks every
  level of the focus chain - intended behaviour, not a copy of the helper. The assertion now forbids the `while (x?.shadowRoot?.activeElement)`
  walk only. This test was RED on the merge before any change of this branch.
- `shell/sw-app.ts`: the two Escape lines keep their text (`tests/unit-a11y-r4-leftovers-2380.spec.ts` pins them); the stack check is
  a line before them.

## Tests

Workstation, 2026-11-17, one worker, a build of this worktree (`npx vite build` into the ignored `dist`, `vite preview` on a
private port, `SW_BASE_URL=http://127.0.0.1:4367/`). No runner, no entry check (by instruction).

| Run | Result |
|---|---|
| `npx tsc --noEmit` (final sources) | exit 0 |
| `playwright.unit.config.ts`, the unit specs of the touched areas (`unit-modal*`, `unit-a11y*`, `unit-dialog*`, `unit-menu-lint`, `unit-polish4*`, `unit-home*`, `unit-notify-center`, `unit-user-menu*`, `unit-area-quick`, `unit-cast*`, `unit-tickets-table`, `unit-calendars*`, `unit-mapping-assist*`, `unit-token-lint`) - includes the new guard (5) and the stack's spec (9) | 291 passed |
| new `modal-stack-b-2442` (home sheet: inert + Tab + Escape + focus return; Escape with the mouse; a confirmation over a home sheet; a home sheet over an sw-sheet), desktop | 4 passed |
| Batch 1 - home family, desktop: `home-simple-2420`, `home-simple-2421`, `home-leave-2435`, `home-r32-answers-2438`, `home-v3-auditfix-2437`, `home-v3-fb-2431`, `home-v3-followup-a`, `home-v3-gaps-2436`, `home-v3-p1`, `home-v3-p2`, `home-v3-p3` | 145 passed, 1 skipped. Run on the build BEFORE focus return was narrowed to keyboard closes; `home-v3-auditfix-2437` and `home-v3-p3` were run again on the final build (next row) |
| Batch 2 - shell, screens, calendars, cast, tickets, desktop, final build (22 files): `modal-stack-b-2442`, `a11y-polished-2342`, `a11y-dialog-focus-2310`, `evidence-shell`, `evidence-notifications`, `evidence-notify-live`, `evidence-menu-opaque`, `evidence-calendars-grid-edit-2343`, `evidence-calendars-settings-2310`, `evidence-cast-ui`, `evidence-tickets-table`, `evidence-tickets`, `evidence-tickets-polish-2331`, `evidence-tickets-calendar`, `evidence-mapping-assist-2330`, `evidence-area-row`, `evidence-home-295`, `layout-area-popup-edit-2290`, `evidence-home-phonefloors-295`, `evidence-tree-unassigned-2331`, `home-v3-auditfix-2437`, `home-v3-p3` | 304 passed, 42 skipped (the specs' own viewport / project gates; not examined one by one) |
| Batch 3 - the phone-only boxes (resident sheets, tree sheet, quick sheet), mobile project, final build: `evidence-calendars-settings-2310`, `evidence-calendars-grid-edit-2343`, `evidence-home-phonefloors-295`, `evidence-home-295`, `evidence-tree-unassigned-2331`, `evidence-area-row` | 40 passed, 52 skipped |

No test failed in any of these runs. One run is NOT counted: `playwright.unit.config.ts` with no file argument ran every spec of
`tests/` in the node project for 1.9 h on pre-final sources - a mis-scoped command, stopped on its second start.

NOT_RUN: the entry check and the runner (by instruction); the tablet project; every pixel suite (baselines are the runner's); the
full functional suite beyond the files above; `npm run build:addon` (`smplwise_vms/www` is NOT rebuilt on this branch); a dedicated
browser test for the NEW keys of the resident sheets (its existing spec passed on mobile, the new Escape / Tab / focus return there
rest on `HandModal`, browser-tested on the home sheet only); nested-Escape browser tests for the notify centre, the user menu, the
cast panel / tray, the tickets popovers, the shell popovers, the mapping assistant, the quick sheet and the tree sheet (the rule is
the same `takesEscape` call, covered by the unit specs and by the home browser tests); a real ringing call over a home sheet;
a physical phone / wall panel; a screen reader.

## Pixels to refresh

None expected. No markup, class, attribute that a style reads, or style changed. `inert` has no default rendering and no rule of the
style sheet selects it (`grep -rn "[inert]|:inert" src index.html` - no match). One honest caveat: a pixel shot taken right after a KEYBOARD close (Escape) of a home sheet or a resident sheet now finds
the focus back on the opener, as after closing an sw-dialog; no such shot was found (`grep -l "press('Escape')" tests/pixel-*.spec.ts`
gives only `pixel-wiskey-people.spec.ts`, which opens neither). The pixel suites themselves were NOT run.

## Rollback

Revert the branch's commit. No data, migration or setting.
