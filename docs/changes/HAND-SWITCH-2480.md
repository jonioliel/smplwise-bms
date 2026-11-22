# HAND-SWITCH-2480

2.48.0 row (private/planning/WORK_PLAN_2448_2449_2026-11-19.md, "HAND-SWITCH-2480"): the hand-built switches and the native check
boxes that stand for ONE on/off setting become the shared `sw-toggle`. Branch `pilot/HAND-SWITCH-2480`, base
`origin/release/2470-train` (2c211966d).

Scope: `frontend/src` except `home/` and `screens/home-*` (left as they are). Other agents convert native selects and colour literals
in some of the same files tonight: every edit here is local to the switch markup, its handler and the import line.

Owner answers applied: N12 (the home `.hsw` and the row switches stay, allow-listed in the ratchet), N13 (smaller toggles are fine:
the converted rows use the compact `size="sm"` track).

## The shared switch (`components/sw-toggle.ts`)

Three opt-in additions; nothing changes for the 117 files that already used `sw-toggle` (pixel-neutral there):

- `size="sm"` (attribute): a 32 x 18 track with a 14 px thumb for the rows where a check box stood - the row keeps about its height
  (owner N13). On a touch phone the transparent hit area still grows to 44 px in the block axis.
- `in-label`: the switch sits where the check box sat, inside the row's `<label>`; a press on the label's text flips it, as it flipped
  the check box (a link, button or other control inside the label keeps its own press). Opt-in, so the older switches that sit inside a
  label keep their behaviour.
- `toggled(e)`: the new value inside a `change` handler (what `(e.target as HTMLInputElement).checked` read before).

Keyboard and semantics: the inner `<button role="switch" aria-checked>` (Space / Enter flip it, Tab reaches it, the visible label text
stays the accessible name through `label` + `labelHidden`). Every `data-*` spec hook, `?disabled`, `.checked` and `live()` binding moved
to the `sw-toggle` host unchanged. The row's own `<label>` (its class, gap, font, 44 px phone target) is kept: the module keeps its
look (LOOK RULE), only the box becomes a track.

## Converted (on/off settings and one-shot dialog options)

| Area | Files (switches) |
|---|---|
| Temperature | `temperature/report.ts` (chart, signature, events, samples), `temp-settings.ts` (escalation on, bool rule fields, alert kind on), `ticket-dialog.ts`, `whatsapp.ts` (schedule), `wizard.ts` (door invert, rule switches, warn now, when off, quiet, alerts, quiet/mute include alarms, exclude defrost, enabled) |
| Notices | `notices/compose-dialog.ts` (push, pinned, until archived), `display-info.ts` (show, the info block), `display-slides.ts` (promo), `display-transit.ts` (show), `info-sources.ts` (invert), `news-sources.ts` (enabled), `screens/system-notices.ts` (13: remote boards, places tree, custom feeds, send to TVs, night dim, burn-in, logos, clock / Hebrew date / welcome / weather / news blocks) |
| Tickets | `contacts-directory.ts`, `costs-tab.ts` (notify), `external-assign.ts` (5), `intake-queue.ts`, `rfq-board.ts` (3), `rfq-compare.ts` (5), `rfq-files.ts`, `rfq-message-dialog.ts`, `rfq-new.ts` (code, navigation), `rfq-question-dialog.ts` (2), `rfq-quote-dialog.ts`, `rfq-terms.ts` (2), `settings-locations.ts` (2), `settings-rules.ts`, `ticket-cost-card.ts` |
| Shared components | `nvr-connection-form.ts` (bool fields), `sw-cast-stop.ts`, `sw-offbox-backup.ts` (restore options), `sw-passkeys.ts` (2), `wk-door-tech.ts`, `wk-triage-panel.ts` (2), `frigate-manual-events.ts` |
| Settings | `system-access.ts` (assign me, delegable), `system-announcements.ts` (screen / speaker allowed), `system-call-banner.ts` (sound), `system-diagnostics.ts` (plan surfaces), `system-local-users.ts` (2), `system-multimedia.ts` (behind "more keys"), `system-transit.ts` (2), `system-update.ts` (backup - the drawn box and its CSS are gone), `system-wiskey-pairing.ts`, `insights-settings.ts` (invert), `installer-clock.ts`, `installer-lifecycle.ts`, `installer-platform.ts` (2), `installer-technical.ts`, `investigate-rules.ts` |
| Screens | `access-external.ts` (the locked extended-identity mark, disabled), `area-row-editor.ts` (4), `devices-layout.ts` (hidden, tile hidden), `devices-type-admin.ts` (bulk on), `door-windows.ts` (settings switches), `explore-floor-map.ts`, `explore-plan-editor.ts` (9: shared content, align, lights all, layers, rooms, plan image, replace auto, keep lines, shared skip), `explore-sites.ts`, `live-camera.ts` (7: schedule, smart line / field, line on, OSD name / time, motion), `live-wall.ts` (show), `multimedia-edit-panel.ts` (2), `multimedia-remote-editor.ts` (fold, hook `data-ed-fold` added), `plan-studio-panel.ts` (10), `scenarios-panel.ts`, `schedule-conditions.ts`, `schedule-drawer.ts`, `schedule-slot-panel.ts` (bool fields), `wiskey-person-editor.ts` (active, card, station), `wiskey-profiles.ts` (required, unique), `wiskey-station-people.ts` (show ignored) |
| Modules | `plan-wizard/plan-wizard.ts` (4), `door-windows/emergency-grants.ts`, `emergency.ts`, `event-rules.ts` (2), `elevators/elevator-alerts.ts` (master), `elevator-settings.ts` (2), `generator/gen-routing.ts` (enabled, escalate), `gen-settings.ts` (2), `maintenance/task-form.ts` (2), `calendars/grid-overlays.ts` (all day) |

Dead CSS of the converted boxes removed where nothing else used it: `temp-settings.ts` `.row input[type='checkbox']`,
`system-update.ts` (`.chk input`, `.chk .box`), `schedule-slot-panel.ts`, `schedule-drawer.ts`, `nvr-connection-form.ts`
(`:not([type='checkbox'])` guards with no check box left).

## Kept on purpose (recorded, recommendation taken)

There is no shared check-box component; these stay native check boxes (they still count in the ratchet) until one exists:

- **Selection in lists and tables** (pick a subset): row / page selection (`tickets-table`, `devices-schedules`, `vendor-accounts`,
  `frigate-review-card`, `investigate-*`, `devices-protected-switches-admin`, `devices-type-admin` rows, `plan-area-links-admin`,
  `devices-layout` entity / group / "all" pickers, `explore-plan-editor` candidates, `plan-studio-panel` candidates), recipient and
  channel lists (`temperature/*`, `elevators/elevator-alerts` recipients and channels, `generator/gen-routing` channel chooser,
  `scenario-recipients`, `system-call-banner`, `insights-settings` domains / sections / delivery / users, `system-presence` sensors),
  doors / stations / cameras / days / languages / categories / columns / scopes chips (`access-external`, `request-dialog`,
  `door-windows`, `event-rules`, `door-automation-block`, `installer-platform`, `system-wall`, `system-announcements` chips,
  `system-access` members and permissions, `wiskey-person-editor` days and locks, `sw-partner-api-card` chips, `media-preset-editor`,
  `media-admin-list` / `wiskey-people` / `system-xs-options` / `tickets/table-toolbar` column choosers, `elevator-settings` include
  list, `system-multimedia` extra keys, `notices/display-info` info kinds, `display-transit` stops, `calendars` lists,
  `live-camera` human / vehicle targets, `explore-plan-import` layers, `schedule-entity-picker`, `maintenance/emergency-config`).
- **Acknowledgements and attestations** ("I confirm ..."): `sw-bridge-key-revoke`, `sw-offbox-backup` key export, the Frigate
  "supervised" box (`frigate-admin-shared`, `frigate-config-panel`, `frigate-control-settings`, `investigate-reviews`),
  `schedule-lowering-dialog`, `notices/delete-dialog`, `plan-package-dialog` (foreign package), `wiskey-profiles` confirm,
  `wiskey-station-people` accept duplicate, `tickets/costs-tab` expired quote, `access-external` told / gone checklist,
  `system-access-parity` checklist, `system-readiness` printed, `maintenance/round-run` (a round checklist).
- **`shell/sw-home-personal.ts`**: the personal home widget list mirrors `screens/home-edit-panel.ts` (out of scope tonight); converting
  one of the two would split the same list's look.
- **Owner N12, allow-listed in `scripts/design_ratchet.py`** (not counted any more): the home `<button class="hsw" role="switch">`
  (`home/*`) and the settings ROW switch `<button class="sw" role="switch">` (`system-access-messaging`, `system-access-policy`,
  `system-security-public`, `wiskey-person-messages`: the whole row is one button).
- Still counted, as before: `devices-area-bubble.ts` power key (an icon button with `role="switch"`), `camera-image-health-settings.ts`
  (a check-box look on purpose), `public-ticket/claim/claim-step.ts` (the public page builds its DOM by hand, no Lit components), and
  the generic guards `input:not([type='checkbox'])` in `sw-field`, `design/*`, `styles/bubble-chrome`.

Ratchet: `hand-switch` 359 -> 173 (only that line of `scripts/design_ratchet_baseline.json` lowered, so the baselines the other
2.48.0 rows lower merge cleanly).

## Specs

The hooks moved from `<input>` to the `sw-toggle` host, so the specs that drove them changed the same way: `.check()` / `.uncheck()`
-> `.click()` (each one checked for its starting state), `toBeChecked()` -> `toHaveAttribute('checked', '')`,
`not.toBeChecked()` -> `not.toHaveAttribute('checked')`, `toBeDisabled()` / `toBeEnabled()` -> the `disabled` attribute,
`[hook] input` / `input[hook]` -> `sw-toggle`. Two selectors were narrowed because a section now holds a second switch
(`evidence-media-remote`: `sw-toggle:not([data-ed-fold])`; `evidence-schedules-editor`: the helper switch is the non-`sm` one).
`unit-board-answers-2400` reads the new handler text. New backend test: `test_the_owner_kept_switches_are_not_counted`.

## Tests run

See the final report of the row (filled in after the runs).
