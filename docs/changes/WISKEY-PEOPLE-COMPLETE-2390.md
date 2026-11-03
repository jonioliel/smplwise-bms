# WISKEY-PEOPLE-COMPLETE-2390 — people on stations only (adopt / ignore / delete), duplicate checks, PIN check

Branch `pilot/WISKEY-PEOPLE-COMPLETE-2390` from `origin/main` (`efc12d0e3`, v2.38.0), target 2.39.0. Plan:
`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md` task T9 ("people completeness"), capability rows 24 and 25. Owner decision
of 03.11, Q3 "א": users found on stations but not in WisKey are shown in Arx, and an administrator adopts, ignores or deletes each one.
Not merged, not tagged; no lab, device, WisKey, Home Assistant or station contact; nothing switched on anywhere.

## What it does

1. **People screen > "בעמדות בלבד"** (managers only, `access.people.manage`): a dialog that reads every station the caller manages, one
   at a time (each station shows as it arrives), and lists the station users no WisKey person is bound to: the name and the user
   number as the station reports them, the stations (one row per user number across stations), PIN / card / face presence (never a
   value; only with `access.people.sensitive` on the station), and when Arx first saw it. A station that cannot be read says why
   (offline, busy, forbidden) - never an empty list. A station whose user numbers are sensitive for this caller is named and not read.
   Ignored users are hidden until "הצגת מוסתרים". Search by name or number.
2. **Actions** (each with a confirmation step and one honest result per station: בוצע / נדחה / לא ידוע / לא נשלח):
   - **אימוץ** - WisKey `users/adopt`: the person is created from the station user as the station holds it, or linked to the existing
     WisKey person with the same number (`user_id` + the revision a fresh read returned). Several stations of one number become ONE
     person (the second station links to the first's id and revision). Nothing is created on a station. Before sending,
     `users/duplicate_check`: the same number = link; a possible duplicate under another number (same name / phone) blocks until the
     operator ticks "בדקתי - זה אדם אחר". A user WisKey cannot import as is (face / fingerprint, unmanaged door, local validity, a
     device-managed PIN) is shown with the reason and no adopt button.
   - **הסתרה / ביטול הסתרה** - stored in Arx (migration 0198) and mirrored to WisKey's own flag (`users/ignore`); a refused mirror keeps
     the Arx decision and says so.
   - **מחיקה מהעמדה** - WisKey `users/delete_unmanaged` (WisKey records the user and its removal in one commit; its own sync deletes the
     user from the device). A DEVICE WRITE, not immediate: the operator types the user number to confirm; the reply is `pending`.
3. **Duplicate checks**
   - People screen strip "ייתכן שיש אנשים שרשומים פעמיים (N קבוצות)" from WisKey `users/data_quality kind=duplicate` (same name; same
     phone and same unique profile value only for an unrestricted `access.people.sensitive`); each person is a button that opens them
     (the link to resolve). Station-scoped managers get no list (`restricted`): the groups name people across every station.
   - **Duplicate PIN**: the editor asks WisKey `users/pin_check` once when the PIN field is left (sensitive level, interactive session,
     6 checks a minute per user) and says "הקוד הזה כבר בשימוש אצל אדם אחר" next to the existing "צור קוד פנוי" button. The value goes
     to WisKey once and is never stored, logged, cached or audited (the audit row has who / for whom / free or not).
   - **Same person twice** at adopt time: see 2 (`users/duplicate_check`).

## WisKey commands used (all through the new `station_people` channel guard, the feed's own session)

| Command | Kind (pinned catalog rc37-contract.4) | Where |
|---|---|---|
| `stations/inventory {station_id}` | READ, `stations: view` (WisKey scans the device) | station list read |
| `users/duplicate_check {user_id, data}` | READ, `users: view` | adopt check and the server's re-check |
| `users/data_quality {kind: duplicate, state: current, offset, limit, snapshot}` | READ, `users: view` | duplicate strip (up to 5 pages of 100) |
| `users/pin_check {user_id, pin}` | non-READ, `users: manage` (+ `credentials: manage`), side-effect free | editor PIN check |
| `users/adopt {station_id, employee_no, review_token[, user_id, revision]}` | non-READ write, `users: manage` | adopt |
| `users/ignore {station_id, employee_no, ignored}` | non-READ write | ignore mirror |
| `users/delete_unmanaged {station_id, employee_no, review_token}` | non-READ write (device delete through WisKey's sync) | delete |

Source read (read-only): `C:\hik intercom`, `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ `2834aa5e` (rc.10) - `websocket.py`
(schemas, dispatch), `access/manager.py` (`async_inventory`, `_import_data`, `async_adopt`, `async_ignore`), `access/repository.py`
(`async_adopt`, `async_ignore`, `pin_available`), `access/identity_lifecycle.py` (`candidate_matches`), `access/data_quality.py`,
`panel_permissions.py`. The refusal table (`services/station_people.py` `PRE_COMMIT`) is a static reading of that source: every code
raised before WisKey's commit is "refused"; `storage_write_failed`, `manager_closed`, `action_failed` and unknown codes are "unknown".

## Security and privacy

- The review token (WisKey's fingerprint of the station user; it covers a short PIN) never leaves the server: the inventory is kept in
  process memory per station (`CACHE_S` 120 s for the view, `TOKEN_MAX_AGE_S` 600 s for an action; older = "רעננו את הרשימה").
- Nothing personal is stored: migration 0198 keeps (station, user number, first / last seen, ignored at / by). Not in a backup.
- Audit: every adopt / delete / ignore station has an attempt row committed before the send and an outcome row after (actor, request
  ids, station, user number, outcome, WisKey's code, the new person's id + revision); every refusal one `denied` row; no token, PIN,
  card number or name.
- Writes: JSON only, command envelope (expiry, a repeated `client_request_id` refused), `confirmed: true`, typed number for delete; sent
  once in the config lane, never retried; after an `unknown` station the remaining stations are NOT sent (`stopped_after_unknown`).
- The request holds the READ connection only; audit rows and the stored rows use a short write of their own (no WisKey round trip
  under SQLite's write lock).

## Files

- New: `smplwise_vms/backend/smplwise/services/station_people.py`, `routers/access_control_station_people.py`,
  `migrations/0198_wiskey_station_people.sql`; `frontend/src/api/station-people.ts`, `access-control/station-people-logic.ts`,
  `i18n/station-people.ts`, `screens/wiskey-station-people.ts`.
- Tests: `smplwise_vms/backend/tests/test_wiskey_station_people_2390.py` (fake WisKey subclass with station inventories),
  `frontend/tests/unit-station-people-2390.spec.ts` (node), `frontend/tests/evidence-station-people-2390.spec.ts` +
  `station-people-mock.ts` (runner, desktop + mobile).

### Shared edits (kept minimal)

| File | Change | May conflict with |
|---|---|---|
| `services/wiskey_channels.py` | new `STATION_PEOPLE` list; `station_people` added to `ALLOWLISTS`, `ADAPTER_CHANNELS`, `HA_FRAMES`, `describe()` | station ops (T4 adds a `maintenance` channel to the same lines) |
| `tests/test_wiskey_channels.py` | the two exact channel tuples / dicts gain `station_people` | station ops |
| `tests/test_pwclean_295.py` | `CATALOG_SHA256` recomputed (the allow-lists changed) | any branch that adds a channel - recompute at merge |
| `smplwise/main.py` | one `include_router` line after bulk people | - |
| `frontend/src/screens/wiskey-people.ts` | the "בעמדות בלבד" header button, the duplicate strip (+ styles), the dialog mount | - |
| `frontend/src/screens/wiskey-person-editor.ts` | the PIN check on leaving the PIN field (+ its status lines) | - |

Not touched: the people write transport (`people_send`, `wiskey_direct_join.py`), `wiskey_direct_catalog.py`, `intercom_client.py`.

## Migration

`0198_wiskey_station_people.sql` (additive). Main ends at 0196; `pilot/WISKEY-INBOUND-CALLS-2382` claims 0197 - renumber to the next
free number at merge time. Rollback: drop the table (first-seen dates and Arx ignore decisions are lost; WisKey's mirrored ignore flags
stay); going back to 2.38.x is safe (older code never reads it).

## Gaps (honest)

- **Face presence**: rc.10's inventory row has no face / fingerprint field. Arx shows "פנים או טביעת אצבע" only when WisKey refuses to
  import the user for it (`unsupported_credentials`); otherwise "not reported". Ask WisKey for `num_of_face` / `num_of_fp` per row.
- **Duplicate PIN between a station-only user and a WisKey person**: Arx never sees PIN values, and rc.10's `async_adopt` does not
  check `pin_available` (static reading) - an adopt could import a PIN another person already holds. Ask WisKey to check PIN uniqueness
  in `users/adopt` (refuse `pin_conflict`) or to report `pin_available` per inventory row. Arx already maps `pin_conflict` to a sentence.
- **First seen** is "first seen by Arx" (WisKey has no such date); it starts when this version first reads the station.
- **Duplicate list** for a station-scoped manager is not shown (`restricted`): WisKey's report has no station per person; filtering by
  reading every person was not built.
- **Editor duplicate-person check before create** (plan T9 bullet): not wired in the editor (the adopt flow has it); conditional profile
  fields and photo crop (also T9 bullets) not in this branch.
- `stations/inventory` scans the device every time it is not cached: a refresh of 10 stations is 10 device reads (paced one at a time,
  read-lane rate limits apply - a station answers "busy" rather than queueing).
- The refusal table and the frame shapes are verified against the fake and the pinned catalog only - NOT_RUN against a live WisKey.
- `contracts/API_INVENTORY.md` not regenerated (the release train does it); `management/tasks.json` not edited.
