# SHARED-CHECKBOX-2480

2.48.0 row: the shared SELECTION check box `sw-checkbox`, recommended by HAND-SWITCH-2480 (its note, "Kept on purpose": about 150
selection boxes stayed native because no shared check box existed). Branch `pilot/SHARED-CHECKBOX-2480`, base
`origin/release/2470-train` (4d244a419). This row is the component only: **no screen is converted here**.

## What is new

- `frontend/src/components/sw-checkbox.ts` - the element (`<sw-checkbox>`), built in the shape of `sw-toggle` (which is not touched).
- `frontend/src/components/sw-checkbox-logic.ts` - the pure state rules (`ariaChecked`, `pressed`, `selectAllState`, `checkedOf`).
- `frontend/src/design/tokens.ts` - a new `check` group with the three SIZE knobs (px values live in `design/`):
  `--sw-check-size` 18px, `--sw-check-border-w` 2px, `--sw-check-touch` 44px. No skin overrides them.
- `frontend/src/shell/sw-app.ts` - one import line: the element is registered app-wide (as `sw-toggle` is), so a screen that moves
  onto it needs no import of its own and the specimen sheet can draw it. Entry-chunk cost: a few hundred bytes gzip.
- Specs: `tests/unit-sw-checkbox-2480.spec.ts` (node), `tests/pixel-sw-checkbox.spec.ts` (browser specimen + behaviour).
- Owner comparison page: `private/planning/shared_checkbox_compare_2026-11-22.html` (not in git).

Ratchet: unchanged (`color-literal` 2497, `px-literal` 25486, `hand-switch` 359 - the component has no colour or px literal, and its
`role="checkbox"` is not a hand-built switch).

## Usage

```ts
// a selection list: one handler, the value in the detail
${rows.map((r) => html`<sw-checkbox .checked=${sel.has(r.id)} value=${r.id} label=${r.name}
  @change=${(e: Event) => toggle(r.id, checkedOf(e))}></sw-checkbox>`)}

// the select-all box of a table
${(() => { const s = selectAllState(sel.size, rows.length);
  return html`<sw-checkbox .checked=${s.checked} .indeterminate=${s.indeterminate} label=${tr('בחר הכל')} labelHidden
    @change=${(e: Event) => setAll(checkedOf(e))}></sw-checkbox>`; })()}

// an acknowledgement with rich text (a link in it keeps its own press)
<sw-checkbox .checked=${this.ack} @change=${(e: Event) => (this.ack = checkedOf(e))}>
  ${t('ackPrefix')} <a href=${termsHref}>${t('terms')}</a></sw-checkbox>

// where a native box sat inside the row's own <label> (the label keeps its class, gap and font)
<label class="chk"><sw-checkbox in-label label=${name} labelHidden .checked=${on} @change=${...}></sw-checkbox>${name}</label>
```

| | |
|---|---|
| Properties | `checked`, `indeterminate`, `disabled` (all reflected), `label`, `labelHidden`, `in-label` (attribute), `value` |
| Slot | default: rich label text; it names the box through the shadow `<label>` (no `label` needed) |
| Event | `change` (bubbles, composed), `detail: { checked, value }`; `checkedOf(e)` reads it. Native `click` still bubbles from the host after the state moved, so `@click` handlers that read `e.currentTarget.checked` and `e.shiftKey` (range selection) keep working |
| Keyboard | Tab reaches the box (a `<button role="checkbox">`), **Space** ticks, Enter does not (as on a native box); `host.focus()` focuses the box (`delegatesFocus`) |
| ARIA | `role="checkbox"`, `aria-checked` `true` / `false` / `mixed`, native `disabled`, the mark is `aria-hidden` |
| Press rules | a mixed box becomes checked (native rule); a disabled box never moves; a press on the label text, on the host's padding, or (with `in-label`) on the enclosing label ticks once; a link / control inside the label keeps its press |
| Parts | `row`, `box`, `label` |
| Knobs | sizes (tokens): `--sw-check-size`, `--sw-check-border-w`, `--sw-check-touch`; colours etc. (read with a token fallback, so a screen that re-tints its accent or surface locally is followed): `--sw-check-on` (`--sw-accent`), `--sw-check-off` (`--sw-toggle-off`), `--sw-check-bg` (`--sw-surface-solid`), `--sw-check-mark` (`--sw-text-inverse`), `--sw-check-radius` (`--sw-r-2xs`), `--sw-check-gap` (`--sw-s-2`), `--sw-check-fs` (`--sw-fs-sm`) |
| Phone | under `(pointer: coarse)` a transparent `::before` makes the box 44 px tall (block axis only, absolute: the row does not move and nothing overflows sideways - the sw-toggle rule); the visible label is the inline extent |
| RTL | logical properties only; the box sits at the start (right in Hebrew); the check mark is not mirrored |
| Wrapping | a long label wraps beside the box; the box stays centred on the FIRST line (`1lh`) |
| Forced colours | `CanvasText` ring, `Highlight` fill |
| Not form-associated | as `sw-toggle`: no screen submits a native form; the screens read `checked` / `change` |

Look: an 18 px box with a 2 px `--sw-toggle-off` ring (the switch's off track: >= 3:1 on every surface), filled with the accent and a
white mark when checked; the filled box keeps a ring a quarter of the way to the text colour, because the bare accent reads under
3:1 on some dark beds (classic / infra / soft dark, measured 2.56 - 2.89). With the ring every selectable skin reads >= 3:1 for the
empty ring, the filled box's edge and the mark (unit spec prints the table). Hover (fine pointer only) tints the ring / darkens the
fill; press uses the skin's `--sw-press-scale`; the mark draws in on `--sw-t-fast` (zero under reduced motion).

## Conversion plan (later rows, NOT this one)

Counted on `origin/pilot/HAND-SWITCH-2480` (after its switch conversion): **146 native `<input type="checkbox">` template sites in 78
files** (+ 1 built by hand in `public-ticket/claim/claim-step.ts`, + 24 CSS selectors that style them). A row per module group, each
with its own before / after shots (LOOK RULE: the row keeps its label, chip and gap styling; only the box changes; where a module
draws a smaller box, set `--sw-check-size` on that module's host instead of changing the default).

| Group | Files (sites) | Kind |
|---|---|---|
| Settings - access, roles, members | `system-access` (4), `sw-search-access` (1), `system-access-parity` (1), `access-external` (3), `access-external/request-dialog` (2) | members / permissions / doors chips; parity + told / gone checklists (acknowledgement) |
| Settings - presence, wall, announcements, call banner | `system-presence` (3), `system-building-presence` (1), `automation-presence-forms` (1), `system-wall` (4), `system-announcements` (3), `system-call-banner` (2), `system-multimedia` (1), `system-xs-options` (1), `system-readiness` (1) | sensors, days, cameras, strips, categories, languages, roles / stations; one "printed" tick |
| Insights | `insights-settings` (6) | domains, sections, REX pairs (max 4), delivery channels and users |
| Devices | `devices-schedules` (5), `devices-layout` (4), `devices-type-admin` (1), `devices-protected-switches-admin` (1), `devices-override-admin` (CSS only) | table / page selection, entity pickers (one already `indeterminate` - a direct fit), shift-click ranges |
| Plans / explore | `explore-plan-editor` (1), `explore-plan-import` (1), `plan-studio-panel` (1), `plan-area-links-admin` (1), `plan-package-dialog` (2) | candidates, DXF layers, area links, "accept foreign package" acknowledgement |
| Investigation / Frigate | `investigate-events` (1), `investigate-event-detail` (1), `investigate-reviews` (1), `frigate-review-card` (2), `frigate-admin-shared` (1), `frigate-config-panel` (1), `frigate-control-settings` (1), `live-camera` (4) | window / route / review ticks, the "supervised" acknowledgement, human / vehicle targets |
| WisKey / doors | `wiskey-person-editor` (2), `wiskey-people` (1), `wiskey-profiles` (2), `wiskey-station-people` (1), `wk-schedule-library` (1), `wk-stations-maintenance` (1), `door-windows` (1), `door-windows/event-rules` (1), `door-automation-block` (1), `installer-platform` (3) | days, locks, columns, stations, doors; confirm / accept-duplicate acknowledgements |
| Tickets | `tickets-table` (2), `tickets/vendor-accounts` (2), `tickets/table-toolbar` (2), `tickets/costs-tab` (2), `tickets/rfq-board` (1), `tickets/rfq-compare` (2), `tickets/rfq-new` (1) | page / row selection (one `indeterminate`), column chooser, quote lines; expired-quote acknowledgement |
| Temperature | `temp-settings` (5), `wizard` (3), `report` (1), `detail` (1), `whatsapp` (1) | recipients (roles / users / groups), channels, units, compare picks (max n) |
| Elevators / generator / maintenance | `elevator-alerts` (2), `elevator-settings` (1), `gen-routing` (3), `maintenance/emergency-config` (1), `maintenance/round-run` (1) | channels and recipients, the always-on "inbox" box (`checked disabled`), include list, cameras, a round checklist |
| Notices / calendars / media | `notices/display-info` (1), `notices/display-transit` (1), `notices/delete-dialog` (1), `calendars/connect-dialogs` (1), `calendars/view-rooms` (1), `media-preset-editor` (1), `media-admin-list` (1), `scenario-recipients` (2), `schedule-entity-picker` (1), `schedule-lowering-dialog` (1) | info kinds, stops, feeds, equipment, presets, columns, recipients, entities; delete / lowering acknowledgements |
| Shared cards | `sw-partner-api-card` (7), `sw-bridge-key-revoke` (1), `sw-offbox-backup` (1) | partner / scope / department / event chips and options; two acknowledgements |
| Home (wait) | `screens/home-edit-panel` (8), `screens/home-edit-bv1` (2), `screens/home-site-off` (2), `home/sw-home-admin` (4), `shell/sw-home-personal` (2) | HAND-SWITCH left `home/` and `screens/home-*` out; several of these are on/off settings (widget on, clock seconds / Hebrew date) that belong to `sw-toggle`, not here. Convert with the home owner's look decision, both lists of the personal home widget together |

Must stay native (or need a small addition first):

- `public-ticket/claim/claim-step.ts`: the public page builds its DOM by hand without Lit components (and loads none of the app shell).
- `screens/tickets-table.ts:714` (`tabindex="-1"`: the grid row is the keyboard stop) - needs a "not a tab stop" option on
  sw-checkbox first.
- `tickets/rfq-new.ts:202` (`aria-describedby` to a hint) and `screens/system-wall.ts:464` (`id` + an outside `<label for>`): the
  description / label cannot cross the shadow boundary - use `label` + `in-label`, and add a `description` property before
  converting the rfq one.
- The CSS guards `input:not([type='checkbox'])` in `sw-field`, `design/mobile-polish-css`, `design/skins/classic`,
  `styles/bubble-chrome` stay (they keep native boxes out of the text-field styling); the per-module box CSS
  (`insights/styles`, `electricity/styles`, `tickets/*-styles`, `devices-schedules-css`, `door-windows/events-styles`) is removed by
  the row that converts that module.
- `components/camera-image-health-settings.ts` (a check-box LOOK on a `role="switch"`), `screens/devices-area-bubble.ts` (an icon
  power key): these are switches, counted in `hand-switch`, not check boxes.

Specs to adjust per converted screen (the HAND-SWITCH recipe): `.check()` / `.uncheck()` -> `.click()`, `toBeChecked()` ->
`toHaveAttribute('checked', '')`, `[hook] input` -> `sw-checkbox[hook]`, `toBeDisabled()` -> the `disabled` attribute.

## Tests run (22.11, workstation only - the runner was held by the 2.47.0 release gate, owner override "no runner today")

- `npx tsc --noEmit`: PASS (twice, the second after the `delegatesFocus` change).
- ESLint on the changed source files: PASS (the spec files are outside the lint config).
- `scripts/design_ratchet.py --base origin/release/2470-train`: no count above the baseline (all counts unchanged).
- `node scripts/unused-exports.mjs --enforce`: OK (no export outside the baseline).
- `node scripts/bundle-budget.mjs --dir dist --enforce` on this branch's own build: within budget (entry gzip 813659 B, budget 849000).
- `tests/unit-sw-checkbox-2480.spec.ts`: 7 passed.
- Token / skin unit specs touched by the new token group (`unit-design-tokens`, `unit-designtokens-297`, `unit-token-lint`,
  `unit-palettes`, `unit-skinfound-297`, `unit-polish-phone-297`, `unit-skincomp-297`, `unit-switch-contrast-2380`,
  `unit-brand-colors`, `unit-hud-opaque`, `unit-menu-surfaces`): 92 passed.
- `tests/pixel-sw-checkbox.spec.ts`, desktop + mobile, `--workers=1`, against this branch's own `vite build` (preview on a private
  port): run 1 - 10 passed, 3 failed, 5 skipped (the focus test x2: `host.focus()` did not reach the box -> `delegatesFocus`; the
  comparison capture hit the 60 s test timeout -> its own 10 min timeout); run 2 after the fixes - **13 passed, 5 skipped** (the four
  pixel-stable shots without a baseline on this OS, the comparison capture on mobile). The comparison capture was then re-run alone
  (1 passed) after the specimen sheet moved to the opaque `--sw-surface-solid` (the Soft skin's translucent surface showed the
  screen behind it).
- NOT RUN: the Linux pixel baselines of `pixel-sw-checkbox` (none exist - the two pixel-stable tests SKIP until the runner creates
  them: `run_smart.py preview <branch> tests/pixel-sw-checkbox.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner`),
  the full lanes, the existing pixel specs (no screen changes here; the shell import draws nothing until a screen uses the element).
