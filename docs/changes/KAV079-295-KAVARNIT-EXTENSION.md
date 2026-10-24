# KAV079-295 — Kavarnit extension (schedules and automations editors)

Status: built on `pilot/KAV079-295` (from `origin/main` 7551d2a22, v2.16.0). Not merged, not released, not installed anywhere, nothing live.

Source of truth: the approved mockup `private/review/mockups/kavarnit-extension-079.html` (r079 v2, 8 states) and the owner's answers
358-366 (`private/review/OWNER_OPEN_QUESTIONS_2026-10-24.html`, group "הרחבת הקברניט"):

| # | Question | Owner's choice | Where it lands |
|---|----------|----------------|----------------|
| 358 | Approve the mockup | approve | this change |
| 359 | On-device test: what happens at the end | ask each time | `automations.device_test_end = ask` (default), dialog asks |
| 360 | Who may run an on-device test | whoever may edit AND run manually; no new permission | route checks `item.can.edit && item.can.run`; each step goes through the device-control route |
| 361 | Detect by pressing the button | in the first version | `POST /automations-ext/wall-buttons/{id}/detect` + "זיהוי בלחיצה על הכפתור" |
| 362 | A button + press already used by another item | warning | `automations.button_reuse = warn` (default); `error` blocks the save |
| 363 | Critical sound inside an automation | allow, only for safety event types enabled in Settings › Notifications | `critical_not_allowed` unless a trigger is a safety sensor whose notification source is enabled |
| 364 | "Who is in the building" condition | yes, as drawn; Wi-Fi only in server mode | typed `presence` condition; Wi-Fi source shown only when `presence.wifi_match_mode = server` |
| 365 | Conflict detection in the 10-minute window | between ALL items: schedule/automation vs schedule/automation | conflict engine compares automations and schedules both ways |
| 366 | Manual merge, a part changed on both sides | the other person's version pre-marked, waits for approval | merge dialog pre-selects theirs and keeps "שמירת המיזוג" disabled until each such part is clicked |

## Switches (all OFF by default; behaviour is unchanged until the administrator turns them on)

New `automations.*` settings (Settings › Automations, `system.configure`, audited like every settings PATCH):

| Key | Default | Range / values | Meaning |
|-----|---------|----------------|---------|
| `automations.wall_buttons_editable` | `false` | bool | wall-button device triggers become the typed `button` block |
| `automations.wall_double_ms` | `400` | 150-1500 | shown on the press picker (the platform does the timing) |
| `automations.wall_long_ms` | `800` | 300-5000 | idem |
| `automations.wall_debounce_ms` | `50` | 0-500 | idem |
| `automations.wall_listen_s` | `30` | 5-120 | how long "detect by pressing" listens |
| `automations.precheck_enabled` | `false` | bool | pre-save checks (conflict, unavailable device, button reuse) and the list's conflict filter |
| `automations.conflict_window_min` | `10` | 1-120 | the conflict window |
| `automations.save_with_warnings` | `true` | bool | the "שמירה עם אזהרות" button; off = warnings block the save |
| `automations.button_reuse` | `warn` | `warn` / `error` | owner 362 |
| `automations.device_test_enabled` | `false` | bool | the on-device test |
| `automations.device_test_end` | `ask` | `ask` / `restore` / `keep` | owner 359 |
| `automations.presence_entity` | `""` | `binary_sensor.*` / `input_boolean.*` | the entity the presence condition compiles to; empty = the condition is not offered |

## Backend (additive)

- `services/wall_buttons.py` (new, pure): the closed press families (ZHA/deCONZ `remote_button_*_press`, Shelly `single/double/long` and
  `*_push`, generic `*_press`, `button_*_press`), the button number in the subtype, the trigger-list reader.
- `services/automation_model.py` / `automation_text.py`: typed `button` trigger (only with `ModelContext.wall_buttons`), typed `presence`
  condition (only with `ModelContext.presence_entity`), the notify step's `critical` flag (the exact companion payload
  `CRITICAL_DATA` inside `data.data`). Each round-trips byte for byte while unchanged; a changed button keeps the integration's own words.
  Validation codes: `wall_buttons_off`, `device_required`, `press_invalid`, `button_invalid`, `presence_entity_missing`, `presence_mode_invalid`.
- `services/automation_ext.py` (new): settings echo, polarity of a device action, timed events of automations (time triggers x reached device
  steps, `choose`/`if` by trigger id, delays) and schedules (fixed slot starts), the conflict engine, the list summary, button usage, the
  pre-save warnings (`conflict`, `button_in_use`, `device_unavailable`), draft errors (`device_not_in_scope`, `critical_not_allowed`,
  `button_in_use` in error mode, `bridge_too_old`), the wall-switch picker, detect by pressing (a time-limited `subscribe_trigger` on the live
  session; never a write), the on-device test plan and restore plan, the presence sources, the catalogue extension.
- `routers/automation_ext.py` (new; prefix `/automations-ext/` so no path reads as `/automations/{kind}/{id}`):
  `GET|POST /automations-ext/conflicts`, `GET /automations-ext/wall-buttons`, `GET /automations-ext/wall-buttons/{device_id}`,
  `POST /automations-ext/wall-buttons/{device_id}/detect`, `POST /automations-ext/automation/{item_id}/device-test`,
  `POST /automations-ext/device-test/restore`. Permission before body; closed JSON bodies; 409 `feature_disabled` while the switch is off.
- Existing routes, additive fields only: `GET /automations/status` → `ui.ext`; `GET /automations/catalog` → `extension`;
  `POST /automations/preview` → pre-save warnings (only with the checks on) and `extension.critical`; items → `wall_button: true`.
- `services/ha_sync.py`: the live session's message hook hands frames of a detect subscription to `automation_ext.LISTENERS` first.
- `routers/settings.py`, `services/automation_settings.py`: the keys above.
- Permissions: reused (`automation.manage`, the item's own `can.edit` / `can.run`, `schedule.view|manage`, the device-control route's own
  grants and confirmation for every on-device step). No new permission, no role change.
- Migrations: **none** (0173 was reserved; not needed).

## Bridge (`custom_components/smplwise_bridge/config_policy.py`, mirrored by `scripts/sync_integration.py`)

The bridge's closed builder schema now accepts a wall-button press (same families / keys as the add-on) and the exact critical-sound payload
of a notify step. Anything else of `trigger: device`, and any other nested notify payload, stays outside as before. The drift test compares
both sides (`test_bridge_config_drift.py` now classifies with `wall_buttons=True`, the widest the add-on types).

**The bridge version is NOT bumped here.** The add-on gates new button / critical blocks on `BRIDGE_KAV_REQUIRED = "0.10.0"`
(`automation_ext.py`): with an older paired bridge such a save is refused up front (`bridge_too_old`, "נדרש עדכון של רכיב החיבור") instead
of the bridge answering "a locked part changed". The release that ships this must bump the bridge to 0.10.0 (manifest, `const.VERSION`, the
card's `VERSION`, `test_one_version_everywhere...`), or change the constant to the version it chooses.

## Frontend

- `api/automations.ts` (contract file, additive): the new block types, `critical`, `Issue.detail/other/delta_min`, `PreviewResult.extension`,
  `status.ui.ext`, `catalog.extension`, `Item.wall_button/conflicts`, the settings keys, and the client twins (parse / emit / sentences) of
  the three new blocks.
- `api/automations-ext.ts` (new): the client of the new routes (no backend = everything off) and the pure helpers (pre-save warnings, save mode,
  the three-way merge).
- `screens/automation-ext-forms.ts` (new): `trigger:button` (light-DOM `<kav-button-form>`), `condition:presence`, the critical-sound row on a
  notify step; the type chooser entries "כפתור קיר" and "מי במבנה" (offered only with their switches on).
- `screens/automation-ext-dialogs.ts` (new): `<kav-device-test>` (dry / on device) and `<kav-merge>`.
- `screens/automation-editor-base.ts`: the warnings box, block warning chips, "שמירה עם אזהרות", the on-device test dialog, "השוואה ומיזוג".
- `screens/devices-automations.ts` / `automations-logic.ts`: the "התנגשות אפשרית" filter (only with the checks on), the conflict and
  wall-button chips.
- `screens/schedule-editor.ts`: the conflict box and "שמירה עם אזהרות".
- `screens/system-automations.ts`: the cards "כפתורי קיר ומתגים" and "בדיקות לפני שמירה", the role table's "בדיקה על ההתקן" column, the
  "מי במבנה" entity picker.

## Mockup states

| State | Built | Notes |
|-------|-------|-------|
| 1 List | yes | filter "התנגשות אפשרית N" and chips; with the checks off nothing changes |
| 2 Wall button for editing | yes | switch picker, button grid with "בשימוש", press kind with timings, detect by pressing |
| 3 On-device test | yes | dry / on device, listen to the button, step-by-step through the device-control route, restore, end mode |
| 4 Warnings and save with warnings | yes | conflict, device unavailable, button reuse; "מעבר לצעד" / "פתיחת התזמון/האוטומציה" |
| 5 Changed elsewhere, manual merge | yes | the existing banner gains "השוואה ומיזוג"; owner 366 rule. The other person's NAME is not shown (the item detail has no last-editor field) - the column reads "החדש · HH:MM" |
| 6 Critical sound and "who is in the building" | partly | both blocks are built; see "Not built" for the presence data feed and the escalation sentence |
| 7 Schedule editor: conflict and test | partly | the conflict box and "שמירה עם אזהרות" are built; see "Not built" |
| 8 Settings › Automations | yes | plus the "מי במבנה" entity row (needed to compile the condition; not drawn in the mockup) |

### Not built (and why)

- **Presence data in the platform.** The condition compiles to a `state` condition on `automations.presence_entity` (the Shabbat pattern).
  Nothing in Arx publishes "someone is in the building" into the platform today; until an entity exists (a helper the integrator keeps, or a
  future Arx publisher) the condition cannot be offered. The source chips show the site's presence configuration (read-only), not a per-condition choice.
- **"In every escalation step the sound is sent again"** (state 6 text): an automation's notification is a one-shot platform notify; it does not go
  through Arx's escalation. The line is not shown.
- **Schedule editor (state 7), follow-up KAVLEFT-295:** built now: "בדיקה בלי הפעלה" (a dialog with the next runs of the draft; nothing is sent), the dashed
  conflict mark on the board's slots (draft slots only, not the split-day arrangement), and "הזזת המשבצת ל־HH:MM" in the conflict box (a fixed-time
  slot moves just outside the window through the board's own move; hidden in a split-day arrangement). **Built in KAVDEVTEST-295 (owner approved):** "בדיקה על ההתקן" for a schedule. `POST /automations-ext/schedule/{id}/device-test` returns a PLAN only (the same
  shape as the automation's): a slot action is a device step when its service is an id of the device-control allow-list (`ha_bridge.ACTIONS`), the entity matches
  that action's domain, the caller may read it and holds `schedule.manage` on it, and its arguments validate; anything else (a notify, an unknown service, a bad
  argument) is listed with no entities and its button stays disabled. Nothing is sent from the server: the client sends each step through the ordinary
  device-control route, one click per step, one at a time, after the person confirms the list once ("לפני שמתחילים..."), with that route's own permission, grant and
  confirmation rules and its audit. Off by default: the same switch as the automations' on-device test (`automations.device_test_enabled`); the route audits
  `schedule.device_test`. The restore at the end uses the existing snapshot / restore plan and `automations.device_test_end`. The schedule editor learns the flag from
  the conflicts answer, which now also carries `device_test` and `device_test_end`. No bridge change.
- **Wall-button timing values** are stored and shown; the platform's integration does the actual press timing (ZHA / Shelly decide double /
  long themselves) - nothing applies them to the devices.
- No evidence screenshots were produced (the evidence spec exists but was not run).

## Tests

Backend (`smplwise_vms/backend`, `PYTHONPATH=.`, single process, `-p no:cacheprovider`): `tests/test_kav079_model.py`,
`tests/test_kav079_checks.py`, `tests/test_kav079_api.py`, plus the drift test and the automation / bridge / schedules neighbours.
Frontend: `tsc --noEmit`; `tests/unit-kavarnit-ext.spec.ts` (playwright unit config). `tests/evidence-kavarnit-ext.spec.ts` was written, NOT run.
