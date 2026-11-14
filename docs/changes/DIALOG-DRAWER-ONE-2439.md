# DIALOG-DRAWER-ONE-2439 - one opaque dialog and one opaque drawer for the whole system

Branch `pilot/DIALOG-DRAWER-ONE-2439`. **Base: `origin/pilot/AUDIT30-COMBINED-2435` (ef7f57c07), not `origin/main`** - the shared
dialog / drawer and several of the migrated screens are in MASTER_PLAN Appendix A, held by that branch. Merged in:
`origin/pilot/CR-CONFIRM-DIALOG-2438` (6f0182a2b, the promise-based `confirmDialog`) and `origin/pilot/DESIGN-RULEBOOK-2438`
(7d773d9aa, docs only: the rulebook whose OPEN section this branch closes).

Owner decisions, round 33 (2026-11-14): **Q-DES-8A a** (the single opaque dialog, as shown) and **Q-DES-8B a** (the single opaque
drawer, as shown). The approved proposals are the live demos on `private/design-system-2026-10-27/round33/pending/index.html`.

## What

### 1. The shared components

`components/sw-dialog.ts`
- Opaque, no blur: the box paints `--sw-menu-surface` with a `--sw-menu-border` hairline (the floating-layer pair: opaque in every
  skin, and the solid twin inside a glass host). The `backdrop-filter` is gone from the component and from the Domus and Crystal
  skin rules. Inside multimedia / automation hosts the old `--sw-surface` / `--sw-glass-blur` overrides no longer reach the box,
  so the 84 % translucent sheet is gone there too.
- Always centred; the three fixed widths are unchanged (440, `wide` 720, `xl` 1120; `fit` stays). Radius `--sw-r-lg` (Domus 26 px,
  was `--sw-r-xl` 30 px - the proposal draws 26).
- Top: title (`--sw-fs-xl`, bold), explanation line (`--sw-fs-sm`, `--sw-text-2`), a round bordered close button
  (`sw-button round iconOnly`, was a ghost icon). Paddings as drawn: header `16 18 10`, body `2 18 14`, footer `12 18 16` behind a
  hairline.
- Phone (under 768 px): a full-width sheet on the bottom edge that rises from it (a `clip-path` reveal from the bottom edge - the box never leaves its place; `--sw-ease-drawer`,
  `--sw-t-sheet`); safe-area paddings. It was a centred box.
- New `beforeclose` event (cancelable, not bubbling) raised before the ✕ / Escape / the scrim close the dialog - the hook the
  automation builder was waiting for (AUDIT30-I, lead decision 2026-11-12). Used here by the person editor and the door dialog.
- Unchanged: the top layer (manual popover), the dialog stack, the focus trap, Escape, focus return, `locked`.

`components/sw-drawer.ts`
- One side: the inline start (the right edge in Hebrew), as the shared drawer always did. Fixed width (modal 480 px, context panel
  360 px; `--sw-drawer-modal-w` stays for the screens that already widen it).
- Opaque, no blur: the same pair of tokens; the modal no longer reads `--dv-surface-solid` / `--sw-surface`.
- The title and the round close button on top (the header's divider line is gone, as drawn), the actions on the bottom behind a
  hairline, only the middle scrolls. Paddings as the dialog. Under a `strip` slot the body keeps 14 px of top room.
- Phone: the **modal** drawer is the full screen (was an 88dvh sheet); `--sw-drawer-sheet-h` / `-max-h` still let a screen ask for
  less. The non-modal context panel stays a 62dvh sheet (it must not cover the map).
- Motion: the panel is revealed from its own edge (a `clip-path` reveal, one-shot keyframes, `--sw-t-med`, `--sw-ease-drawer`; the
  scrim fades). No transform: the panel never leaves its place, so nothing is outside the viewport mid-way (a first version
  slid it in with `translate(100%)`; `layout-wiskey-people-writes` measured the dialog sheet mid-flight below the screen). It had
  `transition: none`. The direction rule is `:dir(ltr)` (was the Chromium-only `:host-context([dir='ltr'])`). Reduced motion: the
  durations are tokens, which the reduced-motion block zeroes.

`components/confirm-dialog.ts`: `hostFor()` walks the flat tree (a slotted element's slot before its parent), so a confirmation
asked from a dialog that is slotted into a modal drawer is attached inside that drawer and is not inert.

`styles/menu-surface.ts` + `tests/unit-menu-lint.spec.ts`: the dialog's `.box` and the drawer's `.panel` are registered surfaces,
so the lint fails if either gets a translucent fill or a blur again (the drawer's old exemption is removed).

### 2. Moved onto the shared components (content and behaviour kept)

| Family | File | Was | Now |
|---|---|---|---|
| Temperature | `temperature/detail.ts` | local `<aside>` on the inline END, coloured ground, own scrim / Escape | `<sw-drawer modal>`; the status badge and the expand key sit in the header's action slot; expand still widens it (560 / 1240 px) |
| Temperature | `temperature/ticket-dialog.ts`, `report.ts`, `whatsapp.ts`, `wizard.ts` | own scrim + box + Escape listener each | `<sw-dialog>` (`wide`, `xl`, `wide`, `wide`); the wizard's steps stay in view (sticky) |
| Temperature | `screens/infra-temperature.ts` | wizard / report / WhatsApp rendered beside the detail | slotted into the detail while it is open (a modal drawer makes everything outside it inert) |
| Calendars | `calendars/view-approvals.ts` (reject), `view-manage.ts` (archive) | a panel pinned to a corner over a scrim | `<sw-dialog>` |
| Calendars | `calendars/event-drawer.ts`, `maint-drawer.ts` | `sw-drawer` with an 88dvh phone sheet; labels in a 96 px column beside the fields | the full screen on a phone, like every drawer; the labels sit above the fields |
| Access control | `screens/wiskey-person-editor.ts` | own backdrop + pane (a copy of the dialog) | `<sw-dialog xl>`; a close request goes through `requestClose()` (asks before discarding changes) |
| Video | `screens/devices-camera-card.ts` (enlarged picture) | a bare picture on the scrim | `<sw-dialog xl>` with the camera's name |
| Notifications | `components/notify-center.ts` (door confirmation) | own blurred box | `<sw-dialog>`; ✕ / Escape / scrim cancel a question, dismiss a result, do nothing while the command is on its way |

"תזמון חדש" and the calendars' two drawers were already moved by AUDIT30 (branches I and F).

### 3. Aligned, not re-hosted (each with its reason; listed in DESIGN.md Appendix A.2)

- `screens/automation-editor-base.ts` ("אוטומציה חדשה"): no longer hangs on the side - centred, 720 px (the dialog's wide width),
  the dialog's surface, hairline, radius and landing. It still is its own native `<dialog>`: it has its own header, type pop-over
  and pickers. `beforeclose` now exists, so hosting it in `sw-dialog` is the next step.
- `screens/mapping-assistant.ts`: a 1360 x 860 work surface, larger than the widest dialog; now on the dialog's surface, hairline,
  radius and round close button.
- `components/notify-center.ts` (the panel): opaque, no blur, hairline; it already opens from the inline start. It keeps its own
  structure (list / detail, filters, the "page" layout option, the phone sheet).
- `screens/area-quick-sheet.ts`: untouched - already opaque and on the inline start; its three forms (drawer, pop-up that grows
  from the pressed tile, phone sheet with detents) are its behaviour.
- `screens/home-edit-drawer.ts`: untouched - see question 2 below.

## Contradictions recorded (not silently resolved) - answered by the owner in round 34

Round 34 (2026-11-14): **Q-DES-21 a** keep today's button order (point 1: no change); **Q-DES-22 a** the home screen's edit panel
stays a non-modal editor panel at the end of the row (point 2: no change); **Q-DES-23 b** dialogs and drawers are opaque in the
Bubble style too (point 3: done - `skins/bubble.ts` paints `--sw-menu-surface` with no blur; the transparency setting still
drives the other Bubble surfaces; the new spec measures bubble with the other skins). The points as they were recorded:

1. **Footer order of the dialog.** The approved picture draws the main action first, at the start of the row (the drawer's order).
   The same question's text says "the visible change is only in the two translucent dialogs and the hand-built ones", and the 161
   files that use the dialog place "ביטול" first and the main action at the end; ~98 of them through a wrapper element the
   component cannot reorder. The existing order was kept (every migrated dialog follows it). Flipping all dialogs is a separate,
   mechanical change of ~190 footers.
2. **The home screen's edit panel** (`home-edit-drawer.ts`, with the layout editor's `.lay-panel`) sits at the inline END and is
   not modal: the page beside it stays draggable, and the page reserves its room on that side. It is the layout editor's docked
   inspector rather than a drawer; moving it means moving the editor's reserved side on every area screen. Left as it is.
3. **The Bubble skin** still paints the dialog and the drawer with its translucent sheet (`skins/bubble.ts:159`): its transparency
   dial is an installation setting. Left as it is.
4. **The non-modal context drawer on a phone** stays a 62dvh sheet (the map must stay visible); "full screen on a phone" applies
   to the modal drawer.

## Not changed

- No skin default, no chip (pilot/DOMUS-DEFAULT-2439 owns those).
- No API, no backend, no settings.
- `calendars/resident.ts`, `home/*` (the residents' interface) and the small pop-overs: out of the inventory.

## Design skills

| Skill | Used for | What it changed |
|---|---|---|
| impeccable | `impeccable context --target frontend/src/components/sw-dialog.ts` (refinement of an incumbent system, Operate mode), craft floor | tokens only (no literal colours), the registered opaque surfaces, one close button, hairlines from the floating-layer token |
| emil-design-eng | entry motion | clip-path as the motion tool for the edge reveal (the box keeps its place); one-shot entrances only; under 300 ms; a centred modal keeps its centre origin; no new animation on keyboard paths |
| apple-design | sheet / drawer motion | in along the edge the surface is attached to (the drawer's own side, the phone sheet's bottom edge); "dim to focus" scrim fade; reduced motion and reduced transparency honoured through the tokens |

## Tests

Workstation (2026-11-14), focused only, one worker; the heavy runs are the runner's.

| Run | Commit | Result |
|---|---|---|
| `npx tsc --noEmit` | working tree before 67db42781 (shared + all migrations) | exit 0 |
| `impeccable detect --json` on sw-dialog, sw-drawer, temperature/detail, temperature/wizard | 96ea76aa9 | no findings |
| unit: `playwright.unit.config.ts tests/unit-` (all node-only unit specs, 2 workers) | 96ea76aa9 + the footer-gap fix | 4265 passed, 9 skipped, 2 failed (`unit-presence-compact-2310`, `unit-presence-count-2400`: a second, mistaken run was sharing the machine); the two re-run alone: 24 passed |
| `unit-polish4-shared` after restoring the footer-end gap token | 718d40743 | 10 passed |
| new `evidence-dialog-drawer-one-2439` + `evidence-dialog-toplayer-2381`, desktop + mobile | 96ea76aa9 | 36 passed, 2 skipped (the left-to-right case: the build does not switch direction from the address, so the English side is NOT verified in a browser) |
| `evidence-confirm-dialog-2438`, `evidence-audit30i-devices`, `evidence-dialog-toplayer-2381`, desktop + mobile | 989876a98 | 33 passed, 1 skipped |
| `evidence-temperature`, desktop | 989876a98 | 24 passed |
| `evidence-calendars-manage-2310`, `evidence-wiskey-editor`, `layout-wiskey-people-writes`, desktop | 989876a98 | 15 passed, 9 skipped (fixture-only), 1 failed: `layout-wiskey-people-writes` (the editor's box selector, and the dialog sheet measured mid-slide below the screen) |
| `layout-wiskey-people-writes` after the clip-path entrance and the selector fix, desktop | 96ea76aa9 | 1 passed |
| `evidence-notifications` door tests, desktop | 989876a98 | 5 passed |
| `evidence-calendars-manage-2310` + `evidence-notifications` (reject / archive / door), desktop | 718d40743 | 8 passed |

Looked at (screenshots of the built UI, Domus, light and dark, 1440 and 390): the dialog and the drawer of the new spec, "אתר חדש",
"בקשת שירות חדשה" (desktop and phone), the temperature drawer with the report and the service-call dialog over it, the door
confirmation over the notification centre, "אוטומציה חדשה" centred. They match the approved demos except the footer order
(question 1).

Runner:

`private/runner/run_smart.py preview pilot/DIALOG-DRAWER-ONE-2439 ... --workers=1 --machine runner` (the load checked first;
one job at a time; nothing on the runner was stopped):

| Run | Commit | Result |
|---|---|---|
| proof: every `pixel-*` spec + `visual-matrix`, no `-u` | 989876a98 | 397 passed, 115 failed, 367 skipped - all 115 are screenshot comparisons of screens that show a dialog or a drawer (22 spec files) |
| re-take of those 22 spec files, `--update-snapshots=changed` | 718d40743 | 307 passed, 137 skipped; 172 baselines rewritten (commit 7241df324) |
| the 10 other specs that hold screenshots (`audit30-f-calendars`, `evidence-audit30b-shared`, `evidence-audit30b2-page-action`, `evidence-audit30c-tickets`, `evidence-intercom-ops`, `evidence-wiskey-installer`, `evidence-wiskey-live-validation-2390`, `layout-audit30-e-infra`, `layout-audit30h-wiskey`, `layout-audit30h2-wiskey`), `--update-snapshots=changed` | 7241df324 | 259 passed, 152 skipped; 12 baselines rewritten (commit a007f5166) |
| after the calendars' labels moved: `audit30-f-calendars`, `evidence-calendars-{grid-edit-2343,manage-2310,views-2310,nav-2310}`, `evidence-temperature`, `evidence-notifications`, `evidence-dialog-drawer-one-2439`, `evidence-dialog-toplayer-2381`, `layout-wiskey-people-writes`, two calendars unit specs - desktop, tablet, mobile, `--update-snapshots=changed` | a007f5166 | 465 passed, 54 skipped, 0 failed; 4 baselines rewritten (the calendars drawer) |

Baselines looked at: the person editor (1440, 390), the devices-home dialog (dark), the calendars drawer (1440, and 390 after the
labels moved), the top-layer dialog.

NOT_RUN on the runner: a proof run of the pixel suite without `-u` after the re-takes, and the full functional suite - both are
the entry check, queued at the branch head (`~/pre/entry_dlgdrw.log`; verdict `~/smplwise-results/entry_pilot-DIALOG-DRAWER-ONE-2439_<sha9>.md`).

NOT_RUN / not verified: the full suites (the entry check below); `evidence-wiskey-editor` against the fixture WisKey (skipped
without it); `evidence-camera-card` (fixture-only) - the enlarged camera picture was not opened in a browser here; the mapping
assistant was not opened in a browser; left-to-right (English) in a browser; a physical phone; other skins than Domus / classic /
crystal / bubble for the new spec (tesla, soft, infra are not measured).

## Rollback

Revert the branch's commits. No data, migration or setting.
