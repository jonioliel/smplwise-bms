# DOMUS-DEFAULT-2439 - Domus is the default skin; the selected chip is the strengthened light blue

Branch `pilot/DOMUS-DEFAULT-2439`. Owner decisions of round 33 (`private/planning/OWNER_ANSWERS_ROUND33_2026-11-14_HE.md`):
Q-DES-1 option a and Q-DES-3 option b.

**Base:** `origin/pilot/AUDIT30-COMBINED-2435` (not `origin/main`): the chip and skin files are among the files that branch holds
(MASTER_PLAN Appendix A) and it is not merged yet. `origin/pilot/DESIGN-RULEBOOK-2438` (documentation only) is merged in so the
rulebook can be updated. This branch therefore boards a train only after, or together with, those two.

## What

### 1. Domus is the default skin (Q-DES-1 a)
- `DEFAULT_SKIN` in `frontend/src/design/skins/index.ts` and `DEFAULTS["ui.skin"]` in `smplwise_vms/backend/smplwise/routers/settings.py`
  are `domus` (both were `classic`).
- **How the choice is stored:** one row per installation in the settings table (`ui.skin`, written by `PATCH /settings` with
  `system.configure`). There is no per-user skin; a browser only caches the installation's last known value (`sw.ui.design`) to avoid a
  flash, and may keep its own light / dark scheme. `read_settings` overlays the stored rows on `DEFAULTS`.
- **No stored skin:** the default is applied at read time. An installation with no `ui.skin` row (new, or one that never saved the
  look card) reads `domus`; no row is written. A browser that cached `classic` follows the server on its next settings read.
- **A stored "classic" moves to Domus once (owner Q-DES-20 option a).** The look card saves its choices together, so an installation
  whose administrator once saved it for any reason (for example only to switch to dark) has `ui.skin = classic` stored. The read-time
  default would have left all of those on classic. `smplwise/services/skin_switch.py` `run_once`, called at start-up right after the
  migrations (`main.py`): when the marker row `ui.skin.domus_switch` is absent, a stored skin of exactly `classic` becomes `domus`
  and the marker is written (`moved:classic`, or `kept` when there was nothing to move) in the same transaction; when the marker
  is there, nothing happens. So it runs once per installation, a new installation is marked at its first start, and a classic that
  an administrator chooses afterwards stays. Every other stored skin and every other look choice (light / dark, motion, the chip
  look, the rail, `devices.style`, the accent) is left as it is. A failure never blocks the start: no marker is written and the step
  runs again at the next start.
- **Why a start-up step and not a numbered migration:** the coordinator's note was to take 0217 (main ends at 0215, AUDIT-INDEX has
  0216 in the wave-2 combined branch). A file numbered 0217 without 0216 leaves a gap in this branch, and two suite tests assert the
  sequence is contiguous (`test_calendar_attendees_2343.py:158`, `test_calendar_feed_review_2351.py:362`), so the entry check of this
  branch would go red until the other branch merges; a later renumbering would also collide with whoever takes the number next. The
  done-marker gives the same "once" without a number. No migration number is used by this branch.
- The marker is a row of the settings table but not a setting: not in `DEFAULTS`, not served by `GET /settings`, not patchable.
  Not checked: how a restore of a project archive written before the move treats the marker row and the archived `ui.skin` (the
  restore path was not read or run for this change). Whatever it does, the skin stays one click away in the look card.
- Classic, tesla, crystal, infra and soft stay selectable. The glass style of the device screens (`devices.style`) is not touched.

### 2. The selected chip (Q-DES-3 b)
- The look: the light-blue field (`--sw-accent-soft`) with a deeper ink, an accent ring and a check mark.
  - New token `--sw-accent-text-strong`: the accent ink mixed 82 % toward black in light and 52 % toward white in dark, a plain colour
    in the base table and in every skin that has its own accent ink. Domus: `#143a9e` / `#c5d9ff`, the values the round-33 page measured.
  - The ring is the chip's 1 px border in `--sw-accent` plus half a pixel inside it (no layout change).
  - The check: an `sw-icon` in `sw-chip`; a `::before` fragment (two borders of a turned box, in the chip's ink) for local chips.
  - Not animated: a filter chip is pressed many times a day (the press scale stays).
- One fragment set in a CSS-only module, `frontend/src/styles/chip-selected.ts` (`chipSelected`, `chipSelectedHover`,
  `chipSelectedCheck`; re-exported by `components/sw-chip.ts`). `sw-chip` draws it in every skin: the rules of classic, domus and
  tesla that repainted the selected chip are removed. The 18 local chips that drew the soft pair by hand now import the fragments:
  `components/notify-css.ts`, `screens/automation-drawer.ts`, `devices-automations.ts`, `devices-schedules.ts`,
  `mapping-assistant.ts`, `multimedia-screens.ts`, `schedule-create-dialog.ts`, `system-automations.ts`, `explore-presence.ts`,
  `infra-temperature.ts`, `styles/media-page.ts`, `calendars/styles.ts`, `insights/styles.ts`, `tickets/chip-selected.ts`,
  `list-toolbar.ts`, `settings-styles.ts`, `styles.ts`, `table-styles.ts`. The audit-round-30 browser specs that pinned the soft
  pair's ink (`evidence-audit30c-tickets`, `evidence-audit30i-devices`, `audit30-d-multimedia`, `audit30-f-calendars`) now expect
  the deeper ink.
- **The setting** (the owner's "settable" rule): `ui.chip_selected` = `strong` (default) | `soft` (the plain light-blue field,
  the alternative the owner first chose) | `filled` (the accent key, what Domus drew) | `dark` (the ink pill, what glass drew) -
  the four options of the round-33 page. Stored like the other look settings (`DEFAULTS`, `PATCH /settings`, audited), offered in
  Settings > General > System look ("שבב נבחר"), applied as `data-chip-on` on `<html>`; the alternatives override the
  `--sw-chip-on-*` knobs (`design/css.ts` `CHIP_ON_CSS`).
- Glass screens: the bridge of `styles/devices-themes.ts` gives the deeper ink - the product's for the default palette under the
  product's scheme, the palette's text ink otherwise.
- An installer accent (`ui.accent`) and a bubble palette derive their own deeper ink (`design/brand.ts`, `design/palette.ts`).

### 3. The contrast rule
`docs/changes/AUDIT30-COMBINED-2435.md` recorded a contradiction: the soft chip sat 1.28:1 from its track, so
`evidence-polish2-295.spec.ts` kept the 3:1 key-vs-track rule (WCAG 1.4.11) for segment keys only. With the ring the rule holds for
chips again: the spec now asks 3:1 of a chosen chip too, measured on the ring or on the fill, whichever separates more. The token
proof for every live skin, light and dark, is the new `tests/unit-chip-selected-2439.spec.ts`:

| | Domus light | Domus dark | Classic light | Classic dark |
|---|---|---|---|---|
| label on the field (>= 4.5) | 7.83 | 8.30 | 7.37 | 8.91 |
| ring on the panel (>= 3) | 5.66 | 6.65 | 5.37 | 3.81 |

(The page reported 7.6 for the dark label because it drew the dark field at 24 % of the accent; the skin's soft token is 20 %.)

### 4. The rulebook
`docs/design/system/DESIGN.md`: the default skin (the opening fact, §7b, §11, §12, A.28) and the selected chip (§7.2, §8 chip row,
§10.1 with two new rows, §11, §13.2 marked decided, A.27).

## Design skills
impeccable (`context`; a scoped refinement on the incumbent system; `detect` on the chip files: no findings), emil-design-eng (no
animation on a high-frequency control; press feedback kept; hover gated to a fine pointer; no lift on the selected chip),
ui-ux-pro-max (`search.py --domain ux`: "Color Only" and "Color Contrast" - the check mark and the two ratios).

## Known limits
- Local chips that still draw the dark pill or a plain accent (DESIGN.md A.27) are not converted here.
- `ui.chip_selected` = `filled` / `dark` inside a glass screen use the shell's colours (they resolve at `:root`); with an installer
  accent the `soft` option keeps the deeper ink.
- The frozen bubble skin's dark accent is 2.56:1 as a ring; bubble is never drawn (it reads as domus).
- A selected chip is a little wider (the check mark), as the round-33 page said.
- The built bundle under `smplwise_vms/www` is not rebuilt here (the release does that).

## Tests

Local (workstation, one worker):

| Run | Commit | Result |
|---|---|---|
| `npx tsc --noEmit` | 46c4976e4, again at 817982583 | exit 0 |
| node unit specs that read the touched sources (`playwright.unit.config.ts`, `--workers=1`), incl. the new `unit-chip-selected-2439` | 46c4976e4 | 1022 passed |
| the same selection for the four extra chips | 817982583 | 84 passed |
| backend `tests/test_ui_settings.py` + `tests/test_ui_background.py` (`-p no:xdist`) | 46c4976e4 | 25 passed (two new tests: the default and a stored choice; the chip setting) |
| impeccable `detect` on `styles/chip-selected.ts`, `components/sw-chip.ts` | 46c4976e4 | no findings |
| backend `tests/test_skin_switch_2439.py` (new, 13 tests: saved classic -> domus at the upgrade with every other look choice kept; eight other stored values untouched; no stored skin; second and third start do nothing and a classic chosen after the move stays; the step alone; a new installation) with `test_ui_settings.py`, `test_db_template.py`, `test_backup.py`, `test_backup_drill.py`, one process | the one-time switch commit | 61 passed |
| `unit-chip-selected-2439` after the switch (reads the step and its call in `main.py`) | the one-time switch commit | 7 passed |

Runner (`private/runner/run_smart.py preview pilot/DOMUS-DEFAULT-2439 ... --workers=1 --machine runner`; the runner was loaded, a
release gate and the entry queue were running; nothing was stopped):

| Run | Commit | Result |
|---|---|---|
| pass 1: the 47 spec files that own `*-linux.png` baselines, `-u`, all projects | cc78f41a6 | 771 passed, 499 skipped (per-project), 2 failed: `evidence-audit30c-tickets:144` desktop + mobile (it pinned the chosen chip's ink to `--sw-accent-text`; fixed in 817982583). 64 baselines rewritten in 11 specs, 575 unchanged; committed c59da61d0 |
| pass 2: the 12 pixel specs of pass 1 that changed or cover the four extra chips, plus `evidence-design-foundation`, `smoke-skinfound-297`, `evidence-polish2-295`, `evidence-audit30i-devices`, `audit30-d-multimedia`, `-u`, all projects | c59da61d0 | 333 passed, 165 skipped (per-project), 6 failed: two source guards x three projects (`audit30-d-multimedia:29`, `evidence-audit30i-devices:45`: their capture ends at the fragment's own closing brace; the assertion is fixed in the next commit and was re-checked with the same regular expressions in node, not re-run on the runner). 20 baselines rewritten, all calendars (the floor chips: `audit30-f-calendars` 6, `pixel-round4-leftovers-2390` cal-manage / cal-rooms 14); none of the 64 of pass 1 was rewritten again |

Baselines looked at, before and after (copies under `private/design-system-2026-10-27/round33/domus-default-2439/before|after/`):
the shared gallery (1440 light, 390 dark), the tickets board (390 light and dark), the WisKey overview (domus 1440 light, domus 390
dark, classic 1440 light), the plan wizard step 1 (1440) and its camera step (1024), the video health screen (domus 390 dark), two
home sheets (390 light and dark), the calendars month (domus 1440 light) and rooms (domus 390 dark).

NOT_RUN:
- The full suites: the runner entry check is queued (verdict in `~/smplwise-results/entry_pilot-DOMUS-DEFAULT-2439_<sha9>.md`). Layout
  and evidence specs outside the lists above were not run with the new default skin; a spec that measured the classic default by
  accident would show there.
- No browser run of the settings card with the four options, and none of `soft` / `filled` / `dark` on a real screen (their token
  pairs are proven in the unit spec only).
- No real device, no lab installation, no stored-classic installation upgraded for real (the backend test covers the read path).

## Rollback
Revert the branch's commits. Data: an installation that was moved has `ui.skin.domus_switch = moved:classic`; set `ui.skin` back to
`classic` in the look card to undo the move there (older code ignores the marker row and a stored `ui.chip_selected` row).

## Entry-check fix (round 2)
- Entry check of 7c61a52c8 stopped the gate in the early layout stage: `dropdown-picker-choice.spec.ts:62` (desktop) read
  `data-dd-search` on `<html>` right after the mock server had counted the PATCH, before the page applied the response
  (`Expected "never", Received "4"`, failed alone on the retry too, runner load 18). The branch does not touch `tabs-mode.ts` or the spec's
  mocks: a timing race in the spec, not a Domus behaviour change. Fix: the 8 reads of `data-dd-search` use `expect.poll`
  (spec only, no product change, no pixel change, no baseline refresh).
- Run locally (desktop, workers=1, one command at a time, `vite build` preview): dropdown-picker-choice 4/4 passed;
  dropdown-phone-choice, dropdown-styles, dropdown-capsule component specs, smoke-skinfound-297, evidence-design-foundation (20 passed, 1 brand-colours
  failure that passed twice alone on rerun: a load flake, unrelated).
- NOT_RUN locally: specs that import `/src/*` modules (they need the Vite dev server; the gate runs those on dev), the rest of the suite.

## Entry-check fix (round 3): the train merged in, the 27 failures of 3f876e61d

**Merge.** `origin/release/2437-train` (d849af79c: 2.43.7 and the gate fixes) is merged with `--no-ff` (ca60027fe). Conflicts:
- `routers/settings.py`: the train moved the settings registry to `services/settings_store.py` (CR-SETTINGS-STORE-2436). The train's file
  is taken and this branch's changes are carried over: `DEFAULTS["ui.skin"] = "domus"`, the `ui.chip_selected` default, its read-time
  normaliser and its `NORMALISED_KEYS` entry now live in `settings_store.py`; the PATCH field stays in the router.
- Six phone baselines (`pixel-home-fb-2431` x4, `pixel-home-gaps-2436` x2): this branch's Domus re-takes are kept. Neither side is right
  after the merge (the train changed the same screens under the classic default): see "Pixels to refresh".

**The failures, one by one.** Every one was reproduced on the workstation on the merged branch before anything was changed
(`vite build` preview, one worker), except the phone timeouts, which pass there.

| Failure | Cause | What was done |
|---|---|---|
| `evidence-nav-size:81` desktop + tablet ("rail = item + padding + border") | Intended: the Domus rail is a floating panel with a border all round (2 px, classic 1) and a 12 px margin | Spec: the frame is measured (border 2, margin 12) instead of the constant 15 |
| `evidence-nav-size:121` desktop + tablet (the user menu beside the rail) | **Bug**: `--sw-rail-w` was the rail's box only, so in Domus everything placed beside the rail ignored its 12 px margin - the user menu overlapped the rail by 2 px, the notification sheet stood 2 px from it (12 in classic), the alert banner and the start-side logos began 12 px inside | `shell/sw-app.ts`: `--sw-rail-w` = the rail's box plus its inline margins; the border box is observed, so a skin switch updates it. The spec asserts the offset = rail + margin |
| `evidence-notifications:107` desktop + tablet | The 12 px above, and a race in the spec: the sheet slides in from 32 px and under the software renderer the Domus page (glass over the whole page) starts that slide later than the fixed 350 ms wait (measured: still at +32 px after 570 ms at 1440, landed by 1 s; classic lands at once) | Product: the rail offset above. Spec: the landing is polled (5 s) |
| `evidence-multibuilding-home-2330:89` tablet (2 px vertical overflow) | **Bug** (a race the Domus heights exposed): the home's fit was measured only after the screen's own updates; a card that grew a pixel or two afterwards left the building level scrolling by 2 px at the loosest packing, for good (4 of 19 loads on the workstation; a manual re-measure cleared it) | `screens/devices-building.ts`: a ResizeObserver on the page body schedules the same fit measurement. After it: 0 of 10 loads stuck; half of them still read 2 px for one frame, so the spec polls the fit (3 s) |
| `unit-devices-tiles:330` x3 (dark panel reads light) | **Bug**: the Domus rule for the dialog / drawer sheet painted the product's solid surface inside a device screen whose scheme differs from the product's, while the text there is the palette's: light text on a light sheet | `skins/domus.ts`: the sheet reads `--dv-surface-solid` when the device palette has one (unchanged everywhere else); `styles/devices-themes.ts`: the product-scheme sheen is left out on such a screen (`--dv-sheet-sheen`). Spec unchanged. The same pattern exists in the crystal and tesla skins and is NOT changed here |
| `evidence-timeline-colors:104`, `:166` x3 | Intended: the recording colour is the skin's accent; the spec pinned the classic blue | Spec: the Domus accent `#2458e6` |
| `evidence-brand-logos:51` desktop + tablet | Intended: the Domus rail tile is the accent gradient and carries the white mark (`sw-app.ts`, since the skin exists) | Spec: white in the default skin, and the brand tone is still asserted with `?skin=classic` |
| `unit-plan-3d-determinism:193` x3 | Intended as far as the code goes: the 3D scene takes its colours from the skin's tokens (`sw-plan-3d.ts` `color: --sw-<token>`), and the style guide now opens in Domus. No file under `src/map/` is changed by this branch | Nothing; see "Pixels to refresh". Owner call if the 3D floor should keep the classic palette under Domus |
| `evidence-media-players:121`, `:144`, `:351` phone (60 s) | Time, not behaviour: pass on the workstation before and after. A phone screenshot of the players page costs about a quarter more in Domus than in classic under the software renderer (2.6-3.3 s against 2.0-2.5 s, measured), and on the runner the passing tests of this file already took 30-52 s of the 60 in that run (median 27.5 s; 12-15 s in six other branches' runs) | Spec: `test.slow()` for the phone project of this file. This is a longer budget, not a speed-up |
| `evidence-tickets:113`, `evidence-tickets-create-assign:43` phone (60 s) | Not caused by the default skin as far as could be found: both specs pin the skin in the address (`?skin=classic`; `:113` also loops domus, as on main). Both pass on the workstation before and after. In the same runner run every phone spec measured ran about twice its usual time (above), and `I18N-EN-SWITCH-2438` shows the same timeout on `:113` in its run | **Nothing changed.** If they time out again on a quiet runner, that is a separate finding |
| backend `test_db_gate::test_no_manual_transaction_control_outside_db_py` | **Bug** of this branch, not fixed by the merge: `main.py` called `conn.commit()` inside `db.connection()` for the one-time skin move | The line is removed (the context manager commits at its exit); e51bf4df4 |

**Side effects of the rail offset (Domus and any skin that floats the rail):** the user menu, the notification sheet (sheet and page
presentations), the alert banner and the start-side logos move 12 px away from the screen edge. No baseline-owning spec opens any of
them (searched), so no pixel change is expected from it.

### Pixels to refresh (on the runner, by the lead; nothing was regenerated here)
- `docs/evidence/T087/visual/` - the 3D determinism baselines of `unit-plan-3d-determinism.spec.ts` (desktop, tablet, mobile;
  `SW_UPDATE_VISUAL=1`), if the Domus palette in 3D is accepted.
- `pixel-home-fb-2431` (8), `pixel-home-gaps-2436` (11), `pixel-home-auditfix-2437` (10): the train re-took or added these under the
  classic default; they open the default skin. Six of them are the merge conflicts above.
- Not expected to change, not verified: any Domus baseline that shows a dialog or a drawer inside a device screen whose scheme differs
  from the product's.

### Tests run for round 3 (workstation, one worker, `vite build` preview on its own port)

| Run | Result |
|---|---|
| `npx tsc --noEmit` after the merge, after each product change and on the final tree | exit 0 (four times) |
| Before (merged branch, nothing changed): the 23 browser failures by `file:line`, each for its project | 17 failed as on the runner (desktop 7 of 7, tablet 7 of 8, phone 3 of 8); 6 passed: `evidence-notifications:107` tablet (the race) and the five phone timeouts |
| After: the same 23 | 23 passed (desktop 7, tablet 8, phone 8) |
| Neighbours, whole files, desktop: `evidence-nav-size`, `evidence-notifications`, `evidence-multibuilding-home-2330`, `evidence-brand-logos`, `layout-logo-side-295`, `layout-header-logo-295`, `smoke-skinfound-297`, `unit-devices-tiles`, `evidence-audit30a-glass-bridge`, `layout-page-background`, `layout-overlay-no-shift`, `evidence-timeline-colors` | 102 passed, 9 skipped |
| Neighbours, tablet: `evidence-nav-size`, `evidence-multibuilding-home-2330`, `evidence-notifications`, `layout-overlay-no-shift` | 43 passed, 4 skipped |
| Neighbours, phone: `evidence-nav-size`, `evidence-notifications`, `evidence-multibuilding-home-2330` | 42 passed, 3 skipped |
| Node unit specs (`playwright.unit.config.ts`): `unit-glass-bridge-audit30a`, `unit-page-background`, `unit-chip-selected-2439`, `unit-skinfound-297`, `unit-uxfix-nav-295` | 28 passed |
| Node unit specs that read the settings sources and the skin tokens: `unit-designtokens-297`, `unit-design-tokens`, `unit-tabset-registry`, `unit-tts-default-2400`, `unit-brand-colors`, `unit-bubble-freeze-295`, `unit-menu-surfaces` | 54 passed |
| The home fit, a script outside the suite (tablet 1024x768, a building of a site, 10 loads each) | before the observer: 2 of 10 loads stuck at 2 px; after: 0 of 10 |
| Backend after the merge (`-p no:xdist`): `test_db_gate.py`, `test_skin_switch_2439.py`, `test_ui_settings.py`, `test_setting_value_parity.py`, `test_ui_background.py` | 76 passed, 1 failed (`test_no_manual_transaction_control_outside_db_py`: `main.py:452: conn.commit()`) |
| Backend after the fix: that test and `test_skin_switch_2439.py` | 14 passed |
| Backend on the final code: `test_ui_settings.py`, `test_ui_background.py`, `test_setting_value_parity.py`, `test_map3d_r28_settings_2433.py`, `test_db_template.py`, `test_skin_switch_2439.py`, and the db-gate test above | 57 passed |

`unit-chip-selected-2439.spec.ts` reads the default skin, the chip default and the normaliser from `services/settings_store.py` now
(the registry moved there with the train); the PATCH field is still read from the router.

NOT_RUN (round 3):
- No runner job and no entry check (the lead queues it). The runner was only read: the verdict and the logs of the 3f876e61d check.
- `unit-plan-3d-determinism:193`: not run; its baselines are Linux runner pixels and are listed above.
- The full frontend and backend suites; pixel specs (Linux baselines); the dev-server lane (specs that import `/src/*`).
- The phone timeouts on the runner itself: the longer budget of the players evidence is not proven there, and the two tickets tests are unchanged.
- The Domus sheet inside a dark device screen was checked by the spec's computed colours only, not looked at on a real screen.
- crystal and tesla: the same sheet rule as Domus was, not changed and not tested here.

## Home phone baselines refreshed on the runner (17.11)

`origin/main` (2.43.7, cc69447f1) merged first (c32ebd2c3, no conflicts). All runs: `private/runner/run_smart.py preview
pilot/DOMUS-DEFAULT-2439 tests/pixel-home-fb-2431.spec.ts tests/pixel-home-gaps-2436.spec.ts tests/pixel-home-auditfix-2437.spec.ts
--project=desktop --project=mobile ... --machine runner`.

| Run | Commit | Result |
|---|---|---|
| `-u --workers=1` | c32ebd2c3 | 24 passed, 4 skipped (per-project); 8 phone baselines rewritten, the other 22 unchanged; committed fe2f981fa |
| `--workers=1 --repeat-each=2`, no `-u` | fe2f981fa | 48 passed, 8 skipped (per-project) |

Rewritten (all `-390-mobile-linux.png`): `home-fb-ticket-photos` light + dark 358x474 -> 358x530, `home-fb-wall-event` light + dark
358x506 -> 358x510, `home-gaps-fault-sheet` light + dark 358x402 -> 358x458, `auditfix-cameras` light + dark 390x652 (same size).
The first six are the merge-conflict files of round 3. No desktop baseline changed.

Not refreshed, on purpose: `docs/evidence/T087/visual/` (`unit-plan-3d-determinism`) - the 3D palette under Domus awaits the owner's
decision, so `unit-plan-3d-determinism:193` x3 stays red on the runner. Not run: the entry check (not queued until that decision).
