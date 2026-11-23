# NATIVE-SELECT-A-2480

2.48.0 row (owner N10: selects move to the shared components screen by screen). Two agents by module group: this row owns
`frontend/src/screens/system-*.ts`; NATIVE-SELECT-B-2480 owns every other file.

Branch `pilot/NATIVE-SELECT-A-2480`, base `origin/release/2470-train` (2c211966d). Not touched: `management/tasks.json`,
`components/sw-field.ts`, `components/sw-segmented.ts`, any file outside `screens/system-*.ts` (other than the ratchet below).

## 1. The ratchet metric made honest (ff7ce9f07, lead decision 22.11)

`scripts/design_ratchet.py` counted every literal `<select`, including the 254 that already sit in `sw-field` - the shared form field
adopted as THE select component by CR-CMP2-SELECTS-2450. Slotting a select into the field could not lower the count, and moving the
literal into one helper file would have lowered it without moving any screen (rejected by the lead as gaming the ratchet).

- `native-select` now counts a `<select` only when no `<sw-field>` is still open before it in the same file (the last `<sw-field`
  before it opened after the last `</sw-field>`); the select sits in the field's markup, also through a nested ``html`` `` part. A
  select returned by a helper and placed into a field elsewhere still counts (conservative). Documented in the `--help` text.
- Baseline `native-select` 551 -> 297 (the honest count on the base). The other metrics are untouched in that commit (px-literal,
  native-table and scroll-container could be lowered too; left for their own rows). NATIVE-SELECT-B cherry-picks this commit.

## 2. Screens moved (one commit per group)

Every bare select of `screens/system-*.ts` except the calendars ones (below) is slotted into `sw-field`. The select itself is unchanged:
the same element, classes, ids, `data-*` hooks, `aria-label`, `?selected` / `.value` bindings and handlers (native keyboard, the phone's
own picker, `selectOption()` in the specs, `<label>` association through the field all unchanged).

The screen's own select skin stays: its rules are in the outer tree and outrank the field's `::slotted()` rules for every property they
set. Where the select sat inline or in a table cell, the field keeps that place (`display: inline-flex`); layout rules that addressed
the select as a flex item also address the field.

| Group | Commit | Screens | Selects |
|---|---|---|---|
| security and access | 1484a0fcc | `system-alarm` (policy rows, bypass pairing / zone panel cells, the per-user policy), `system-doors` (relay pick, station placement), `system-ha-users` (create dialog: role, scope), `system-security-wiskey-managed` (keep count) | 10 |
| media and notifications | b9ab85c61 | `system-multimedia` (kind, profile, linked amplifier), `system-multimedia-players` (kind, room, linked amplifier), `system-notifications` (recipient rule, mail security), `system-announce-templates` (kind) | 9 |
| general settings | 94034d3ec | `system-diagnostics` (backup restore mode), `system-palette-editor` (start from), `system-tabs` (level style, tickets row, section style), `system-xs-options`, `system-readiness` (demo dataset / scenario / hours) | 9 |
| module settings | ff33ecb86 | `system-automations` (presence entity), `system-messaging-accounts` (use pick, department pick), `system-tickets` (award notice, grant user / scope), `system-transit` (city) | 7 |

Layout kept by CSS (each commented in the screen):
- `system-alarm`: `sw-field { display: inline-flex; max-inline-size: 100% }` in the shared sheet (the pairing table cells).
- `system-doors`: on a phone `.ctl sw-field { flex: 1 1 auto }` (the select grew in the control row before).
- `system-notifications`: `.mx td > sw-field { display: inline-flex }` (the recipient select keeps its width in the matrix cell).
- `system-xs-options`: the 60 % cap moved from the select to the field (`max-inline-size: 60%` was a percentage of the row).

Kept native, not in `sw-field` (recorded, not guessed): `system-calendars` (5 selects: the attendee calendar, the phone group pick and
the approval / reminder / room-scope cells). They are the calendars module's own picker (`.selw`: an `appearance: none` select with its
own chevron `sw-icon` as the next sibling, and `.selw select[disabled] + sw-icon`); the owner keeps the module looks in calendars, and
the sibling rule would break inside the field. Moving them needs a decision (open question 1).

Ratchet after this branch: `native-select` 262 (baseline lowered from 297 with `--update`).

## 3. Visible differences

See the comparison page (section 4). By construction the screens' own skins set border, radius, background, colour, padding and
height, so at rest the selects look as before; what the field adds where a screen did not set it: the focus ring
(`box-shadow: 0 0 0 3px var(--sw-accent-soft)`) next to the screen's own focus outline, `cursor: not-allowed` on a disabled select,
the hover / colour transition, and under a coarse pointer on a phone at least 44 px and 16 px text. A select with no skin of its own
(the backup restore dialog) takes the shared field look of the other selects of the same settings page.

The shots found one real change and it is fixed (844a1c2b8): skins that set only the inline padding (messaging accounts,
notifications, multimedia, players, the users dialog, announcement templates) took the field's 5 px block padding - on a phone the
messaging select grew from 36 to 42 px. Those screens keep the browser's 0 block padding now (`select.in` / `select.inp` / `select`
`{ padding-block: 0 }`, commented).

## 4. Comparison (LOOK RULE)

Local page `private/planning/native_select_a_compare_2026-11-22.html` (+ the folder of the same name): before = the train, after = this
branch, each touched select's row / cell / label, desktop 1440 and phone 390, demo data. Interim shots from the workstation (Windows,
the worktree's Vite dev server, the base files swapped in for "before"), because the runner did not answer SSH during the 2.47.0
release gate (lead: nothing new on the runner meanwhile). Result after the fix: 44 shots of 8 screens, 16 identical to the pixel,
27 with a faint difference only (no pixel more than 16 levels apart - edge anti-aliasing, not visible), 1 (tickets, phone) where the
card's background differs with the scroll position and the select itself is identical. Computed style of every shot (size, font,
padding, border, radius, background) is identical before / after.

Not shot (the selects show only against a real backend or inside a dialog): alarm (policies, pairing), the users create dialog, backup
restore, readiness demo, WisKey managed keep, doors relay / station placement, announcement templates, multimedia rows, transit. Their
skins set border, radius, background, padding and height (checked in the source), so no change at rest is expected.

The runner pass (`~/work/nsela-run.sh 092bbc9a1 a20dfcef5`, queued before the gate, waits for it: build base and head, the same shots
on Linux, the pixel specs of the touched settings pages without `-u`, the evidence / layout specs desktop + mobile, failures re-run on
the base) replaces the interim shots when it has run.

Baselines: none changed (no `-u` anywhere).

## 5. Tests actually run (workstation)

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (before and after the train merge).
- ESLint on the 17 touched screens: 0 errors, 0 warnings (and again on the 6 files of the padding fix).
- `node scripts/unused-exports.mjs --enforce`: FAIL, 2 exports in `src/arx/webauthn.ts` (`CreationOptionsJSON`, `RequestOptionsJSON`) -
  a file this branch does not touch; it comes with the 2.47.0 train (reported to the lead, not fixed here).
- `py -3.12 scripts/design_ratchet.py`: ok, native-select 262 (baseline lowered to 262 with `--update`; no other count changed).
- Unit (`playwright.unit.config.ts`, the 39 specs that read a touched screen): 337 passed, 0 failed. After the padding fix, 7 of them
  (dark-polish beds, token lint, ha-users, messaging accounts, a11y polished lint, notify whatsapp, wiskey notif): 52 passed.
- Browser, desktop, the worktree's Vite dev server, `--workers=1` (14 files: messaging accounts + layout, tabs styles, system
  multimedia, readiness 96, tickets, tickets s2, syn columns, backup, layout a11y 295, palettes, automations list, security r1,
  alarm): 145 passed, 17 skipped, 3 failed - all 3 timeouts at 60 s while the workstation was loaded (two multimedia "expand every
  row" loops, one tabs-styles first paint); re-run alone: 3 passed.
- NOT_RUN: mobile / tablet projects of the evidence specs, the pixel specs (Linux baselines, runner only), the entry check.

## 6. Open questions (recommendation taken)

1. Calendars: the 5 module pickers (`.selw`, own chevron) stay native outside the field, or move into `sw-field` with the chevron
   drawn by the field (needs a `sw-field` icon / chevron option or the capsule look - a look change in a module the owner keeps)?
   Recommendation: keep them as they are until the owner decides; then a small `sw-field` option first.
2. Mixed forms (users create dialog, multimedia rows, notifications mail form, readiness demo): the selects are in the field, their
   text inputs are not; at rest both look the same (the screen's skin), on focus the select also shows the field's soft ring.
   Move the inputs into `sw-field` too, per form? Recommendation: yes, a small follow-up row per form.
3. The ratchet counts a select returned by a helper and slotted elsewhere as bare (e.g. a `sel()` helper whose caller wraps it). Keep
   the conservative rule? Recommendation: yes (no such case left in `system-*`).
