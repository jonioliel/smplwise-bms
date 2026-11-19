# CR-CMP2-TOAST-2440

2.44.0 programme rows (private/planning/REMAINING_WORK_2026-11-18.md section C "Programmes"; code-review
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.6):

1. **CMP-2 step 2** (06:CMP-2; owner O13 = a: "family by family, after the cleanup, with new baselines") - hand-built controls
   swapped to the shared components.
2. **Toast adoption** (07:F12 adoption) - the private flash/toast timers moved onto `components/toast-controller.ts`.

Branch `pilot/CR-CMP2-TOAST-2440`, base `origin/pilot/CR-W3B-FE-COMBINED-2443` (41bf2a6d6), then merged (no conflicts):
`origin/release/2438-train` (4679923b4), `origin/pilot/CR-G1-HOME-AREA-2440` (aa11792c9),
`origin/pilot/CR-SHELL-EXTRACT-2440` (422fb4eb5), `origin/pilot/CR-FE-SMALL-2440` (ead8884f6).
Not touched: `frontend/src/screens/water/*` (another agent's area tonight).

One commit per family / per screen group, so the train can drop a part.

## 1. CMP-2 step 2 - families

### Family 1: switches (hand-built `role="switch"` -> `sw-toggle`)

The review counted 20 hand-rolled switches against 95 `sw-toggle`. Swapped here (track-only switches, the review's named examples
included):

| File | Switches |
|---|---|
| `screens/system-notifications.ts` | the section switches (`data-tog`), the policy switch (`data-pol-on`) |
| `components/notify-whatsapp-section.ts` | `data-wa-switch` |
| `components/sw-automation-card.ts`, `components/sw-automation-row.ts` | `data-card-toggle` |
| `components/script-fields-form.ts` | boolean script field (`data-field`) |
| `screens/devices-schedules.ts`, `screens/schedule-drawer.ts` | `data-toggle`, `data-drawer-toggle` |
| `screens/multimedia-remote-editor.ts` | section / item "show" switches |
| `screens/security-alarm.ts` | zone bypass (`data-bypass`); "on" keeps the bypass colour (`--sw-toggle-on: var(--al-bypass)`) |
| `screens/system-brand-installer.ts` | white label (`data-wl-enabled`) |
| `screens/system-mapping.ts` | multi-building (`data-mapping-toggle`) |
| `screens/investigate-history-map.ts` | the layer switches of the history map |
| `incidents/settings-form.ts` | the boolean incident settings (`data-setting`) |
| `screens/system-security-privacy-masks.ts` | the write switch (`data-pm-switch`) and the mask switch (`data-pm-enabled`), label visible |

How behaviour is kept:

- `components/sw-toggle.ts` gains `switchPress(shown, act)`: the old buttons showed the MODEL's value (the switch moved when the answer
  re-rendered it). The handler puts the sw-toggle back at the rendered value, stops the new `change` event (no parent heard it before)
  and runs the old click action; the template binds `.checked=${live(shown)}`. Data attributes, labels (`aria-label` -> `label` +
  `labelHidden`), `disabled` and `title` moved to the `sw-toggle` host.
- The 44 px hit area the glass `.tog` had (a `::before`) is kept by padding the host in the block axis and pulling it back by the same
  margin (`automations-glass.ts`, `notify-css.ts`); `sw-toggle` already flips on a press on its own host box.
- `sw-toggle`: a press on its VISIBLE label now flips it too (as a `<label>` does) - the privacy-mask switches had their text inside
  the button. No pixel change; `labelHidden` users are unaffected.
- Dead CSS of the swapped switches removed: `.tog` in `styles/media-glass.ts`, `styles/automations-glass.ts`,
  `components/notify-css.ts`, `multimedia-remote-editor.ts`; `button.tgl` in `security-alarm.ts`; `.tgl` in
  `system-brand-installer.ts`; `.toggle` in `system-mapping.ts`; `.lyr .sw` in `investigate-history-map.ts`; `.sw` in
  `incidents/settings-form.ts`; `.sw-switch .track` in `system-security-privacy-masks.ts`.

Pixels: yes (O13 "the look changes slightly"): every swapped switch now has the sw-toggle size (42 x 24) and colours (the glass
`.tog` was 46 x 28, the history-map layer switch 30 x 18, the remote editor's 48 x 30 green).

Left on purpose (recorded, recommendation taken):

- `messaging/policy-switch.ts` users (`system-access-messaging`, `system-access-policy`, `wiskey-person-messages`) and
  `system-security-public.ts`: a whole settings ROW is the switch (title, text and track in one button) - a row control, not a copy of
  `sw-toggle`; swapping would make only the track pressable.
- `home/*` `.hsw`: the home screen's own approved design language (Domus home), not a settings switch.
- `devices-area-bubble.ts` power key (an icon button with `role="switch"`), `camera-image-health-settings.ts` (a check box look).

### Families not done in this branch (recommendation: separate planning cards)

- **Selects** (411 native `<select>` vs 30 `sw-dropdown`; 189 already sit in `sw-field`, which gives them the shared look): a swap
  changes keyboard and pointer behaviour and most evidence specs drive them with `selectOption`; needs a per-screen list first.
- **Tables** (54 `<table>` vs 27 `sw-table`): data grids with their own column rules; per screen, with the screen's owner.
- **Segmented controls**: there is no shared segmented component to swap to; step 1 (`segTrackStyles` / `segThumbStyles` in
  `styles/fragments.ts`) is their shared form. A `sw-segmented` would be a new component first.
- **Sheets / in-sheet confirms**: the review's line numbers (`devices-building.ts:4213`, `area-quick-sheet.ts:1839`) no longer exist
  after the G1 / shell extractions; the area sheet's reset confirm sits inside a modal sheet (modal-stack interplay) - to plan with
  MODAL-STACK.

## 2. Toast adoption

The 39 private `flash` / `toast` methods counted by 07:F12 (listed by `grep "private (flash|toast|showToast)("`). Adopted: **32**.

Method, per element: the `@state()` message field becomes `private readonly toaster = new ToastController(this, { ms: <the
element's own duration> })` plus a read-only getter with the SAME name and shape (`toast`, `message`, `notice`, `info`, `toastText`,
`msg` = `{ tone, text } | null`). The template is not touched, so the same element with the same classes is rendered: **no pixel
moves**. `flash()` keeps its signature and calls `this.toaster.show(...)`; the private timer field and its `clearTimeout` lines are
gone. The read-only getter makes `tsc` list every other write to the field; each became `this.toaster.clear()` (for `''`) or
`this.toaster.show(text, { ms: 0 })` (a message that was written without a timer stays until the next one, as before).

What changes in behaviour (all on purpose, the finding's point): a second message always gets its full time (several copies never
cleared the first timer); a message written without a timer is no longer wiped by an older flash's timer; nothing fires after the
element left the page.

| Group (commit) | Elements |
|---|---|
| Calendars | `calendars/cal-page.ts`, `screens/system-calendar-sync.ts`, `screens/system-calendars.ts` |
| Frigate admin components | `components/frigate-auto-profile`, `-camera-control`, `-cases-panel`, `-config-panel`, `-control-settings`, `-event-control`, `-exports-panel`, `-manual-events` |
| Infrastructure + maintenance | `maintenance/list-page.ts`, `maintenance/tags-page.ts`, `screens/infra-temperature.ts`, `pwa/notifications-settings.ts` |
| Water meter card (own commit, droppable) | `water/meter-card.ts` (not under `screens/water/`) |
| Investigate + security | `screens/door-windows.ts`, `screens/investigate-incidents.ts`, `screens/investigate-reviews.ts`, `screens/security-alarm.ts` |
| Settings | `screens/system-access.ts`, `system-brand-installer.ts`, `system-brand-logos.ts`, `system-diagnostics.ts` (keeps `flash(text, ms)`), `system-look.ts`, `system-palette-editor.ts`, `system-plan-view.ts`, `system-tabs-mode.ts`, `wa-installed-card.ts` |
| Plan editor + 3D | `screens/explore-plan-editor.ts` (06:MSG-1: the ~11 direct writes go through the controller), `map/sw-plan-3d.ts` |
| Home | `home/sw-home.ts` (the undo action rides beside the controller's text; 08:F01's `toastT` is the controller now) |

Not adopted (recorded, recommendation taken):

- `screens/water/page-alerts.ts`, `screens/water/page-settings.ts`: out of bounds tonight (another agent's area). Same one-line
  adoption when that work lands.
- `screens/electricity/page-meters.ts`: its `notice` field lives in the meters base class shared with `screens/water/page-meters.ts`.
- `screens/access-external.ts`: a STACK of toasts (several at once, each with its own timer) - one controller would show only the
  latest.
- `calendars/view-calendar.ts`: an undo toast with an enter / exit animation (two timers: hide, then remove after the fade); the
  controller has no exit phase, adopting it would cut the fade.
- `screens/system-security-cameras.ts`: the toast is the `nvr-undo-toast` element, which owns its 10 s timer already.
- `screens/system-ha-users.ts`: `flash()` sets a lasting "ok" line, no timer at all.

## Merge repair

`unit-fe-nits-2442` (RTL-1) still asked for `text-align: left / right` on four LTR blocks that `CR-FE-SMALL-2440` (776385244) made
logical (`start` / `end`); on LTR content they are the same value, so the guard accepts both (fb8f0ac9f).

## Baselines refreshed (runner, linux)

`frontend/tests/visual-matrix.spec.ts-snapshots/` (bac78aaf5), 12 images, all switch-only changes:
`devices-schedules-ready-{light,dark}-{desktop,tablet,mobile}`, `settings-notifications-ready-{light,dark}-{desktop,mobile}`,
`security-alarm-ready-{light,dark}-tablet`. Checked by eye: notifications 1440 light, alarm 1024 light (bypass colour kept),
schedules 390 light. The `pixel-*` suite has no shot of a swapped switch: none refreshed there.

## Tests actually run

Workstation (Windows):

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (after the switches, and again after the toast adoption).
- Unit (`playwright.unit.config.ts --workers=1`): 22 lint / unit specs reading the touched files - 210 passed, 2 failed (the
  contrast spec before its update, the FE-NITS merge red) -> fixed, the three re-run: 31 passed. Toast set (toast controller, plan
  editor lint + browser, frigate x3, maintenance, temperature, door-windows, wa-installed, access-external, home-v3-p1, home simple,
  calendars UI, fe-nits, a11y lint, poll screens, home lazy): 179 passed.
- Evidence, desktop project, `--workers=1` (27 files: calendars, frigate, brand, palettes, push, WhatsApp installed, home x4,
  diagnostics, incidents, look, maintenance, plan studio x2, temperature, alarm, security polish, the hit-area test): 293 passed,
  43 skipped, 0 failed.

Runner (`~/work/cmp2`, nice -n 10):

- Pass 1 @ 6d34b756c (switches): evidence + layout specs of the swapped screens, 3 projects: 698 passed, 81 skipped, 7 failed -
  3 x the hit-area check (fixed in the spec: it now measures the drawn track), 4 x specs that need the Vite dev server
  (`evidence-media-remote.spec.ts:100`, `layout-media-admin-list.spec.ts:74` import `/src/...`; not runnable on a preview build).
  `pixel-*` (816): 427 passed, 385 skipped, 4 failed (access-schedules, bus times x2, plan wizard tablet) - all 4 passed at the
  merged base AND again at the head cd407c9f6 (pass 4): load flakes (load average 30-45), not this branch.
- Pass 3 @ fcb84bb8b (toast): toast groups' evidence specs, 3 projects: 650 passed, 316 skipped, 9 failed -> re-run at cd407c9f6:
  25 passed, 11 skipped, 0 failed (the mobile hit-area case was fixed in cd407c9f6; the rest were load flakes / timeouts).
  Screenshot specs outside `pixel-*` (visual-matrix + 9 audit / evidence shots): 306 passed, 144 skipped, 12 failed = exactly the
  12 switch images above; at the base 486d5942c the same visual-matrix run: 97 passed, 20 skipped, 0 failed.
- Pass 4 @ cd407c9f6: visual-matrix refresh of the three screens, then 21 of 21 passed without `-u`.

The runner disk filled up (100 %, another job's pytest temp) during pass 3; the first attempt of pass 3 died on ENOSPC and was
re-run when space returned. My runner worktree was removed at the end.

## NOT_RUN

- The two Vite-dev-server specs named above (environment, not this branch).
- Full unit / evidence / pixel suites (only the specs of the touched screens + the whole `pixel-*` and `visual-matrix` ran).
- Entry check (`branch_check.sh`): not queued (task rule: push only).
- No lab / device test (none needed: UI only, no device call changed).
