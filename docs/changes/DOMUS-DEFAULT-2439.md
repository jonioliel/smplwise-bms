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
- **Migration: none needed.** The default is applied at read time. An installation with no `ui.skin` row (new, or one that never
  saved the look card) now reads `domus`; an installation with a stored row keeps it, classic included. No row is written or changed.
  A browser that cached `classic` follows the server on its next settings read.
- **One thing to know:** the look card saves its five choices together. An installation whose administrator once saved that card for
  any reason (for example only to switch to dark) has `ui.skin = classic` stored, and is treated as having chosen classic. It can be
  switched to Domus in Settings > General > System look.
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
Revert the branch's commits. No data to undo: no row is written by the change; a stored `ui.chip_selected` row is ignored by older code.
