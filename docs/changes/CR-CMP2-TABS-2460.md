# CR-CMP2-TABS-2460

2.46.0 row, continuation of `CR-CMP2-SEGMENTED-C-2450` (base of this branch: `origin/pilot/CR-CMP2-SEGMENTED-C-2450` at c612c5ce1,
not the train). Owner answers of 19.11: N10, N11, N12 (row switches and the home `.hsw` stay), N13; the previous row's open questions 2
(the devices kind strips to `sw-tabs` after a count pill and a fill option) and its "What remains" list, recommended options taken.
Not touched: home v3 (`home/sw-home.ts`, `home/home-p3.ts`, `screens/home-widgets.ts`), electricity / water, tables, the home `.hsw`
and the row switches, `shell/sw-app.ts`, `management/tasks.json`.

## 1. The components

`components/sw-tabs.ts`:

- `TabItem.pill` (number | string): a count pill after the label - a `<small class="cpill" part="pill">` (the devices specs read the
  count as a `<small>` inside the tab). 0 is a count; `undefined` / `''` draw nothing (`segmented-logic.ts` `tabPillShown`, unit-tested).
  The pill is the label's ink on a soft wash of it; knobs `--sw-tabs-pill-bg` / `-on-bg` / `-fg` / `-pad` / `-min-w` turn it into the
  plain figure a glass toolbar shows.
- `TabItem.glyph` (a template): the screen's own icon before the label (an `sw-icon`, or the app's inline `svg.ic`, sized to the label
  inside the shadow root), decorative (`aria-hidden`), part `glyph`.
- `fill="always" | "phone"`: the bar spans its box and the tabs share it equally (`flex: 1 1 0`); a tab is never narrower than its label,
  so a row too long for its box still scrolls sideways inside the strip. `phone` applies below 768 px only (the devices kind strips).
- `controlled`: a press only fires `change`; `active` stays until the host sets it (the strips that moved here showed their model's
  value - e.g. the editor refuses "builder" while the code does not parse, and the tab must not move).
- Knobs `--sw-tabs-key-h` (the pill key, 28 px; the track is 6 px taller - the literal 34 px is gone), `--sw-tabs-key-pad` (12 px),
  `--sw-tabs-fs` (the label size). A host with its own palette maps the tokens the pill AND the skins' pill rules read
  (`--sw-surface-3`, `--sw-text(-2)`, `--sw-accent-text`, `--sw-seg-key`, `--sw-seg-key-ink`, `--sw-seg-thumb-shadow`) on
  `sw-tabs[variant='pill']`: the glass hosts (`styles/media-glass.ts`), the remote / player panel (`components/media-remote-css.ts`,
  devices.scheme rather than the app theme) and the automation editors (`screens/automation-editor-css.ts`). Defaults are unchanged for
  every existing strip.

`components/sw-chip-choice.ts`: an option may carry `icon` (part `icon`) and `count` (part `count`, a small pill); `multi` + `values`
make several chips on at once - a press fires `change { value, pressed }` (the state it asks for) and the host re-renders `values`
(controlled, as ever). `segmented-logic.ts` `chipOn` is the rule (unit-tested).

## 2. The nine tab strips drawn as segments -> `sw-tabs` (pill, controlled)

Every one keeps its data-* hooks (on the tab through `attrs`, on the strip on the element), its `aria-label` (now `group-label`) and is a
real tablist with one Tab stop; the arrows / Home / End walk the tabs and Enter / Space open one (the old strips: focus-only arrows via
`tablistKeydown`, or none). Each host stops the composed `change` at the strip.

| strip | file | notes |
|---|---|---|
| library tabs | `components/media-player-panel.ts` | `fill="always"`, `data-pn-libtabs` / `data-pn-libtab` |
| receiver zones | same | the second zone's on / off word is the tab's pill; `data-pn-zones` / `data-pn-zone` |
| remote pad / sources / apps | `components/media-remote.ts` | `fill="always"`, `data-mr-tab`, 44 px target (`--sw-tab-min-h`) |
| scenario editor when / runs | `screens/scenarios-panel.ts` | glass `.sm` key, `data-scen-runs-tab` |
| builder / code (header + phone copy) | `screens/automation-editor-base.ts` | icons as `glyph`, the phone copy `fill="always"` at 40 px, `data-view-toggle` / `data-view` |
| device test mode | `screens/automation-ext-dialogs.ts` | `data-kav-test-mode` / `data-m` |
| devices / cameras | `plan-wizard/plan-wizard.ts` | icons + count pills ("1/3"), `fill="always"`, `data-wz-dev-tabs` / `data-wz-tab` |
| kinds (automations screen) | `screens/devices-automations.ts` | `fill="phone"`, counts as plain glass figures, `data-segment` |
| kinds (schedules screen) | `screens/devices-schedules.ts` | same strip, `data-kavarnit-segments` |

Dead CSS removed with them: the remote's `.seg` tab-strip rules, the plan wizard's `.seg` rules, the devices `.seg.kinds` rules.
The glass phone key is 44 px with 8 px sides (the four kinds share the 358 px row as before).

## 3. The leftovers

- Events centre (`screens/investigate-events.ts`): the handling-state row and the view row (sw-chip rows in a `.seg` span) are
  `sw-chip-choice` with the icons and counts, at the toolbar's 28 px chip. New hooks: `data-events-ack-filter` / `data-ack-filter`,
  `data-events-view` / `data-mode-raw`; `data-mode-windows` kept. The demo-mode row (`renderDemo`) is not a `.seg` group and stays.
- Tickets overview departments (`screens/tickets-overview.ts`): `sw-segmented radio size="sm"` with counts inside the measured
  `[data-dept-chips]` box: on a paged desktop that box still scrolls sideways and fades at its end (`--sw-seg-wrap: nowrap`); a phone
  keeps two departments a line with an ellipsis (through `::part(key)` / `::part(label)`). Still a radio group (`aria-checked`).
- Personal home panel summary tiles (`shell/sw-home-personal.ts`): `sw-chip-choice multi` ("follow the installation" is the empty value,
  kept exclusive by the host as before), at the panel's 28 px compact size; the panel's own `.seg` rules and `segThumbPlainStyles` left.

## Tests actually run (workstation, Windows)

- `npx tsc --noEmit -p tsconfig.json`: exit 0; `-p tsconfig.tests.json`: exit 0.
- ESLint on every touched `src` file: 0 errors, 0 warnings (the test files are outside the lint config's scope).
- Unit (`playwright.unit.config.ts`): the new `unit-sw-tabs-2460` + `unit-sw-segmented` (chip-choice contract updated, two adopters
  added), `unit-dark-polish-beds`, `unit-a11y-r4-leftovers-2380`, `unit-a11y-polished-lint`, `unit-tab-strip`: 71 passed, 0 failed.
  Every other unit spec that reads a touched file (28 files: tickets overview x4, plan wizard x2, inv-events, events-table, home
  personal first read, token lint, chip-selected, editors memo, scenarios, shell lazy / timers, nav labels, ...): 248 passed, 0 failed.
- Browser specs on a Vite dev server on the PC (`--workers=1`, no source edits during a pass):
  - A1, desktop, `evidence-automations-builder` (`-g` the view toggle / code view / RTL and touch / script editor / existing / dark):
    16 passed, 0 failed.
  - A2, desktop: `pixel-sw-tabs` (behaviour), `pixel-sw-segmented`, `evidence-kavarnit`, `evidence-automations-list`,
    `evidence-noscroll-295`, `evidence-polish-295`, `evidence-polish2-295`, `evidence-media-player-panel`, `evidence-media-queue`,
    `evidence-media-remote`, `pixel-plan-wizard-2434`, `evidence-tickets-overview`, `evidence-dark-seg-all-2380`,
    `pixel-events-windows-2443`: 209 passed, 4 skipped (pixel checks without a Windows baseline), 0 failed.
  - B1, desktop, after the remote's 44 px key knob: `evidence-media-remote`, `-player-panel`, `-queue`: 85 passed, 0 failed.
  - B2, mobile: `evidence-kavarnit`, `evidence-noscroll-295`, `evidence-tickets-overview`, `pixel-sw-tabs`, `evidence-automations-list`:
    71 passed, 27 skipped, 0 failed.
- Looked at by eye (screenshots from the dev server): devices automations 1440 / 390 (light; dark 390 from the list spec), devices
  schedules 390 (first try overflowed the phone row with 12 px key sides: fixed with the glass phone `--sw-tabs-key-pad: 8px`),
  tickets overview 1440, the automation editor 1440 / 390, the player panel (receiver zones 390, playing dark 820), the remote 390.
  The events centre's API mode was not seen by eye (the dev server shows its demo mode, whose row stayed sw-chip).

## NOT_RUN

- Runner: the 2.45.0 release gate (`release/2450-train`, tier L, full) started 19:02 UTC and was running at the end of this session,
  so no pixel run and NO Linux baseline was refreshed or created. A script waits for the gate (and `~/.gate-pending`) to clear and then
  checks and refreshes in its own worktree, `nice -n 19`, `--workers=1`: `~/work/tabs2460-run.sh <sha> 4297` (outputs in
  `~/work/tabs2460-out/`: `summary.txt`, `take.tgz` with the changed and the new baselines, `changed.txt`, `new.txt`). The images must
  be looked at old vs new before they are committed to this branch. Expected to move: `pixel-sw-tabs` (new, 4 images: light / dark x
  desktop / mobile), `pixel-plan-wizard-2434` (the cameras tab), `visual-matrix` devices-schedules (the kind strip), possibly
  `pixel-plan-wizard-2433`, `pixel-events-windows-2443` (the events chip rows), `evidence-audit30c-tickets` (overview departments),
  `pixel-audit30a-glass-bridge`, `evidence-audit30b-shared`, `pixel-home-gaps-2436`.
- The live-backend specs `evidence-event-windows` / `evidence-event-detail` (selectors updated to the chip-choice hooks, not run: they
  need the real backend); tablet project; the entry check (`branch_check.sh`) - not queued.
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. The devices kind strips show their counts as plain small figures (the glass state strip beside them does, and a pill per kind would
   widen the 1440 toolbar), not pills. Keep? Recommendation: keep; the pill is there for any strip that wants it.
2. The events centre's two chip rows are now sw-chip-choice (accent-filled chosen chip), so they no longer follow the `ui.chip_selected`
   setting the sw-chip did. Teach sw-chip-choice that setting in a later row? Recommendation: yes, together with the chip unification
   question of CR-CMP2-SEGMENTED-C-2450 (Q1).
3. The receiver's second zone shows on / off as a small pill in its tab (was a small grey word). Keep? Recommendation: keep.
4. The remote and the player panel keep 44 px tab keys; the scenario editor and the device-test dialog use the glass / editor key.
   The tab strips elsewhere (plan wizard) take the standard 28 px pill instead of their old 34 px key. Keep? Recommendation: keep
   (the standard tab look; 44 px targets on a phone stay).
5. The personal home panel's summary tiles are separate chips now (they were one pill track like the panel's other choices, which
   suggested one-of-N for a multi-choice). Keep? Recommendation: keep - chips read as "any of these".

## Linux baselines (runner, after the 2.45.0 gate; committed by the 2.46.0 train agent)

`~/work/tabs2460-run.sh e46a04ceb 4297` ran at 22:05-22:17 UTC on 19.11 (own worktree, `nice -n 19`, `--workers=1`, built preview):

| Step | Result |
|---|---|
| check, the seven pixel files of the script (all projects, retries 1) | 120 passed, 39 skipped, 6 failed - every failure a screenshot comparison: `pixel-events-windows-2443:113` desktop + mobile, `pixel-plan-wizard-2433:53` desktop + tablet, `pixel-plan-wizard-2434:49` desktop + tablet |
| check, `visual-matrix` devices-schedules / devices-automations / multimedia-screens | 9 passed, 6 failed - devices-schedules ready light / dark x desktop / tablet / mobile (screenshots) |
| update (`--update-snapshots=changed` on the four failed files) | 48 passed, 18 skipped |
| new (`pixel-sw-tabs`, desktop + mobile, `--update-snapshots=all`) | 4 passed |
| verify without `-u` (the four files) / the new specimen | 48 passed, 18 skipped / 8 passed |

Every changed image looked at old vs new (crops of the difference box): the events centre's two chip rows are accent-filled
sw-chip-choice chips with count pills (mobile: the taller touch chips wrap the view row to its own line); the plan wizard's
devices / cameras strip is the standard 28 px pill with icon and count pills (was the 34 px key); devices schedules: the kinds strip
on sw-tabs (desktop / tablet: lighter unselected labels, the strip a little narrower, the list 1 px lower; phone: equal-width tabs).
All intended by this row; no regression seen. 13 baselines refreshed, 4 new (`pixel-sw-tabs` light / dark x desktop / mobile).
