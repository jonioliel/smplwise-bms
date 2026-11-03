# WISKEY-DOOR-TECH-2390 - door technical writes from Arx (hold-open schedules, public codes, programs)

Branch `pilot/WISKEY-DOOR-TECH-2390`, cut from `origin/main` @ `efc12d0e3` (v2.38.0), target 2.39.0. Plan:
`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`, task T6 (matrix rows 42-46). Owner decision 03.11, Q5 = "א": door
technical writes from Arx, **system administrators only, each with a confirmation and an audit row**. Built and tested against fakes and
mocked backends only. Nothing was sent to a real WisKey, Home Assistant, station or installation; no lab access; nothing runs by itself.

## 1. What an administrator gets

The stations drawer's "הגדרות דלת" section gains a "שינויים טכניים" row with one button, **ניהול טכני של הדלתות**
(`frontend/src/components/wk-door-tech.ts`, mounted with one line in `screens/wiskey-stations-views.ts`). The row is drawn only for a
caller who holds `system.configure` or `access.stations.manage` somewhere; **nothing is read or sent until the button is pressed**. The
dialog (desktop and phone, RTL) has four tabs:

- **לוחות החזקה** - per door: the hold-open schedule (WisKey's draft) with its weekly hours and special dates; **הוספה / עריכה /
  מחיקה**. The editor: name, time zone, up to 8 periods a day (`HH:MM`, end up to `24:00`), special dates with their own periods
  (closed all day by default). The editor checks WisKey's rules before anything is sent (the server checks them again).
- **תוכניות** - per door: the hold-open program (on / paused / being removed, the execution state - "acknowledged, physical state not
  verified"), **החלה מלוח ההחזקה** (saves the door's draft as an enabled program), **הפעלה מחדש** (a paused program, same schedule),
  **השהיה**, **הסרה**.
- **קודים ציבוריים** - read only when the tab opens (it reads the device): per slot "מוגדר" / "לא מוגדר" - **a code value is never
  shown**. **הגדרה / החלפה / ניקוי**: new code + repeat (password fields), the current code when the slot is set (the device needs it),
  the door the code opens, a compatibility switch only when the station does not declare support, and the **typed confirmation
  "קוד <n>"**. The fields are read at send time and cleared at once; the component never keeps a value in its state.
- **יומן** - the station's recent door writes from Arx's audit rows (any actor), with the honest status.

Every write except a code (whose typed phrase is its confirmation) opens an inline confirmation with a plain sentence ("מעכשיו דלת X
בעמדה Y תוחזק פתוחה אוטומטית בשעות של ..."); cancel sends nothing. Each write is sent once; the line under it says: "שולח…", "בוצע
ואושר", "בוצע חלקית: ...", "**WisKey סירב: <reason>**", "לא נשלח: <reason>", or "נשלח, לא התקבלה תשובה ברורה - ייתכן שבוצע". After
an answer the dialog READS again (nothing is repeated) and the drawer's own door-settings read is refreshed.

## 2. WisKey commands (verified in `C:\hik intercom` @ `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` = `2834aa5e`, rc.10)

| Arx kind | WisKey command | rc.10 schema (`websocket.py` COMMANDS) | rc.10 handler | Effect | Arx success |
|---|---|---|---|---|---|
| `hold_save` | `stations/technical_hold_save` | `station_id, door, revision, policy` | `technical_api.dispatch_technical` -> `access/hold_open.HoldOpenDrafts.update` | the door's DRAFT in WisKey storage (CAS on `revision`, 0 = new); no device write; answers `{draft, active: false, blocker: "schedule_writes_unverified"}` | `acknowledged` |
| `hold_delete` | `stations/technical_hold_delete` | `station_id, door, revision` | `HoldOpenDrafts.remove` | draft removed (revision must match) | `acknowledged` |
| `program_save` | `stations/technical_program_save` | `station_id, door, revision, policy, enabled` | `access/hold_programs.HoldPrograms.update` (+ `verify_hold_support` on the device when `enabled`) | the program saved (only while paused: `hold_pause_before_edit`); enabled = WisKey holds the door open in the windows by itself; then the door's draft is removed | `acknowledged`, or `partial` on `program_saved_draft_cleanup_unknown` |
| `program_action` | `stations/technical_program_action` | `station_id, door, revision, action` | `HoldPrograms.action` - `pause` / `remove` only | program disabled (and removed); WisKey restores normal control | `acknowledged` |
| `code_write` | `stations/technical_codes_write` | `station_id, slot, action (add/replace/remove), door (API relay id), expected, old_pin, new_pin, compatibility, confirmed` | `client/public_codes.mutate` | ISAPI `PrivilegePasswordCfg` / `DeletePrivilegePasswordList`, then a presence read-back; `{status, capabilities, acknowledged: true, physical_verified: false}` | `acknowledged` |

`policy` = `{timezone, schedule: {name, weekly (all 7 days), holidays}}` (`hold_open.policy` + `schedules.normalize`). All five are in
the pinned catalog `rc37-contract.4` with the same top-level keys, station-scoped, non-READ (`api_contract: 1` on every frame), WisKey
grant `stations: manage`. `resume` is not a WisKey action: Arx resumes with `program_save` + `enabled: true`.

**Channel and transport**: the classic service session Arx already uses for the technical reads and the station writes (the add-on's
own identity over Home Assistant WebSocket, `intercom_sync`), under a new closed allow-list **`door_technical`** in
`services/wiskey_channels.py`: exactly these five commands plus `overview`. The code write needs WisKey's API relay id, which Arx's served
copy drops; `services/wiskey_door_tech.send_code` reads it with one `overview` frame in the SAME coroutine right before the write - a
failed read or an unmapped relay means the write is NOT sent (`not_sent`, `relay_map_unreadable` / `unmanaged_lock`). Not the direct
join / signed path (the plan: "program save/pause on the classic channel when the direct join is off"; `wiskey_program_direct.py` /
door windows tier B are untouched).

## 3. Rules kept

- **Permission (owner Q5)**: `system.configure` (installation) **or** `access.stations.manage` on the station's chain (the door-admin
  permission on the door's scope; built-in holder: `system_admin` only). An explicit deny of `access.stations.manage` on the station
  wins over `system.configure`; a wall / kiosk account never. Gate before the body is read: `system.configure` or
  `access.stations.manage` somewhere, else an audited 403 (`action = access.stations.manage`). A station the caller cannot see is the
  uniform 404.
- **Confirmation**: `confirmed: true` only from the confirmation step (409 `confirmation_required` otherwise); a code also needs
  `confirm_text == "קוד <slot>"` (409 `typed_confirmation_required`).
- **Envelope**: `client_request_id` + `expires_at` (15 s): expired / duplicate refused, audited, not sent.
- **Audit rows** (`intercom.door_hold_save`, `intercom.door_hold_delete`, `intercom.door_program_save`, `intercom.door_program_action`,
  `intercom.door_code_write`): a refusal row (`phase: refused`, `outcome: not_sent`) or the attempt row committed before sending + the
  outcome row (`ok` / `partial` / `refused` with WisKey's code / `unknown` / `not_sent`); actor, station, door / slot, revision,
  set/clear, `granted_by`. **Never** a code value (new or current), its length or a hash, and never the schedule body.
- **Rate limits** (`services/wiskey_door_tech.Limits`, on top of the feed's read buckets): one write per (station, door / slot) per 3 s
  after a send; 20 door writes per operator per minute; **6 code writes per operator and 6 per station per 15 minutes** (a replace /
  clear carries the current code: no guessing loop); one write in flight per station (WisKey itself answers `device_busy`), 2
  installation-wide. A refused request never frees another request's slot.
- **Honest results** (`wiskey_door_tech.result_of`, from the rc.10 source): a code WisKey raises before any storage / device write is
  `refused` (HTTP 409 `door_tech_refused`, `details.wiskey_code`, message "WisKey סירב: ..."); `program_saved_draft_cleanup_unknown` is
  `partial` (200, `status: partial`); every other code (incl. `station_unloaded`, which rc.10 also raises AFTER the work, `ambiguous_write`,
  `readback_mismatch`, `action_failed`) and a timeout are `unknown` (504 `door_tech_outcome_unknown`). A wrong current code is therefore
  "unknown", not "refused" (the device's error does not prove "no effect"). Never retried; WisKey's own `revision` / `expected` checks
  bind every write to what the operator saw.
- **WisKey offers the command**: a write this WisKey does not list in `overview.api.commands` is 409 `door_tech_unsupported`, nothing
  sent; the dialog hides the button.
- **Device writes need an online station**: a code write and an enabling program save are refused while the served copy says offline;
  a draft save / delete and a pause / remove are always sendable (a pause must never be blocked).

## 4. Endpoints (new router `routers/access_control_door_tech.py`)

| Method | Path | Body |
|---|---|---|
| GET | `/api/v1/access-control/stations/{id}/door-tech` | - (view: allowed + reason, relays, command availability, phrase rule, limits, recent writes) |
| POST | `.../stations/{id}/doors/{door}/hold` | `{revision, policy, confirmed, client_request_id, expires_at}` |
| POST | `.../stations/{id}/doors/{door}/hold/delete` | `{revision, confirmed, ...envelope}` |
| POST | `.../stations/{id}/doors/{door}/program` | `{revision, policy, enabled, confirmed, ...envelope}` |
| POST | `.../stations/{id}/doors/{door}/program/{pause\|remove}` | `{revision, confirmed, ...envelope}` |
| POST | `.../stations/{id}/codes/{slot}` | `{action: set\|clear, door, expected, new_code?, current_code?, compatibility, confirm_text, confirmed, ...envelope}` |

The reads stay the existing ones (`/programs`, `/doors/{door}/hold`, `/codes` - `access.stations.read`).

## 5. Files

New: `smplwise_vms/backend/smplwise/services/wiskey_door_tech.py`, `smplwise_vms/backend/smplwise/routers/access_control_door_tech.py`,
`smplwise_vms/backend/tests/test_wiskey_door_tech.py`, `frontend/src/api/door-tech.ts`, `frontend/src/i18n/wiskey-door-tech.ts`,
`frontend/src/components/wk-door-tech.ts`, `frontend/tests/unit-wiskey-door-tech.spec.ts`, `frontend/tests/wiskey-door-tech-mocks.ts`,
`frontend/tests/evidence-wiskey-door-tech.spec.ts`, `frontend/tests/pixel-wiskey-door-tech.spec.ts` (+ its Linux baselines),
`docs/design/evidence/wiskey-door-tech/*.png`, this file.

**Shared edits (minimal, for the merge owner)**:
- `smplwise_vms/backend/smplwise/services/wiskey_channels.py`: + `DOOR_TECHNICAL` and its entries in `ALLOWLISTS`, `ADAPTER_CHANNELS`,
  `HA_FRAMES`, `describe()`. **Conflicts textually with `pilot/WISKEY-STATION-OPS-2390`** (it adds `maintenance` on the same lines):
  keep both entries (`..., "maintenance", "door_technical"`).
- `smplwise_vms/backend/smplwise/main.py`: + 3 lines (import + `include_router`) after the `wiskey_lineage` router (station-ops adds its
  lines after `access_control_writes` - no overlap).
- `smplwise_vms/backend/tests/test_wiskey_channels.py`: the `ADAPTER_CHANNELS` tuple and the `_channel_calls` map gain `door_technical`
  (same lines as station-ops' `maintenance`).
- `smplwise_vms/backend/tests/test_pwclean_295.py`: the pre-cleanup catalog hash excludes `door_technical` (station-ops excludes
  `maintenance` on the same line: merge as `k not in ("maintenance", "door_technical")`).
- `frontend/src/screens/wiskey-stations-views.ts`: + 1 import line and 1 mount line in `doorSettings()` (station-ops edits `technical()`).
- Pixel baseline `stations-classic-settings-{1440,390}` of `pixel-wiskey-stations.spec.ts`: the door settings section now shows the
  "שינויים טכניים" row for the admin persona - refreshed on the runner.

No migration (the audit rows use `audit_log`; nothing new is stored). No setting. Rollback: revert the branch's commits; nothing persists
on a device or in WisKey from the code itself (only what an administrator explicitly sent).

## 6. WisKey gaps / open points

- **Permission for Arx's service identity unconfirmed (plan section 5, Q-WK-11)**: the five commands need WisKey `stations: manage` and
  pass WisKey's panel security guard (`reauth_sensitive` -> `reauth_required` for non-READ commands). On an installation where WisKey's
  re-auth is on, the service identity may be refused: Arx shows "WisKey סירב: נדרש אימות מחדש לפעולות רגישות" and sends nothing more.
  Not verified on the lab (no lab access by task rule).
- **Hold-open drafts are drafts**: rc.10 answers `active: false, blocker: schedule_writes_unverified` - saving a schedule does not program
  the device; only an enabled program makes WisKey hold the door open (WisKey's own engine, not the device's native schedule;
  `native_supported: false`).
- **The code write needs WisKey's API relay id**, which the overview carries but Arx's served copy does not; the extra `overview` frame
  per code write is the cost (a wider WisKey field in `stations/technical_codes_get` would remove it).
- **A wrong current code** comes back from the device as an unspecific failure (`action_failed` / a device error after the request), so
  Arx reports "unknown", never "refused" - WisKey could map the device's `badPassword`-type sub-status to a pre-effect code.
- **`physical_verified: false`** on every code write and "acknowledged, physical state not verified" on every hold: Arx never claims a
  physical door state.
- **UI copy rule**: the refusal line names WisKey ("WisKey סירב: ...") as the task requires; the operator screens' "no platform name"
  rule is otherwise kept (this block is administrator-only). Recorded as a deliberate exception, not silently resolved.

## 7. Tests and receipts

See section 8 (filled from the actual runs).
