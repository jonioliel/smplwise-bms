# CR-033 integration notes - the WisKey door path on the 2.4.8 line (WXD-INT)

Branch `pilot/WXD-integration`, cut from `origin/integ/248` @ `10620d30`. Task WXD-INT, 2026-10-12. Owner decision of
2026-10-12 (binding): everything WisKey is stage 1, the WisKey freeze is removed, Arx RBAC is the authority. Nothing in
this work contacted a real Home Assistant, bridge, WisKey, station or door; no key or secret was read or written (the
pairing secret in the tests is the published golden-vector TEST constant). No version file, CHANGELOG or release note was
edited.

Sources: `docs/changes/CR-033-WISKEY-DOOR-PATH.md` (copied onto this branch from `origin/pilot/WISKEY-CRs`, unchanged),
`docs/security/SECURITY_REVIEW_WXD_DOORPATH_2026-10-12.md` (section 8: fix status), `docs/release/2.4.8-INTEGRATION-NOTES.md`.

## 1. What is on the branch

| Commit | Content |
|---|---|
| merge (first commit) | `origin/pilot/SEC-WXD-fixes` @ `9d7fd40e` = wave 1 (D0 fakes, D1 door map, D2 station scope, D3 door authority + grant card, D4 trusted_door transport) + D6-D9 (`pilot/WXD-d6-d8`, `pilot/WXD-d7-d9`) + the second-pass review fixes (M1-M3, L1-L6) |
| follow-up commits | D5a / D5b prep on fakes, D10a enable guard, D11 gate, review I7 / I8, a T8 fix in `services/ha_actions.py`, these notes |

### 1.1 Merge mechanics (review I1) - read before re-integrating

`integ/248` (like `main`) already contains `pilot/WXD-wave1` @ `11eecbcf` (merge `4ac95afb` into integ/245) AND its revert
`9065a130`. Git's own merge base of `SEC-WXD-fixes` and `integ/248` is therefore `11eecbcf`, and a plain `git merge` silently
keeps the revert: all of D0-D4 vanishes, D6-D9 arrive as modify/delete conflicts. The revert was not re-applied and not
cherry-picked. Instead the merge commit is a real merge of `origin/pilot/SEC-WXD-fixes` whose content was resolved with the
door path's fork point `e7201c92` (2.4.3) as the base, file by file (`git merge-file`, ours = integ/248, theirs =
SEC-WXD-fixes) for the 61 files the door path changed since that fork point: 49 merged clean, 12 resolved by hand (both sides
kept; list in the merge commit message). Result: integ/248 + the whole door path. Anyone merging this branch onward merges
normally - the revert is now behind both parents.

Integration-only changes made while resolving:

- `rbac.STATION_PERMISSIONS` (SEC-WXD L4 allowed only `access.read` / `access.release` on a station-scope ALLOW binding) now
  also holds the access permissions CR-036 S3 evaluates per station: `access.stations.read`, `access.events.read`,
  `access.events.export`, `access.people.read`, `access.people.sensitive`, `access.people.manage`, `access.admin.read`, and
  `access.cards.capture` (S11 moves card capture onto the station chain). Nothing outside `access.*` is accepted at station
  scope, as L4 intends. **When S11 lands `access.pin.generate` on the station chain, add it here too.**
- `screens/wiskey-overview.ts`: CR-036 S1 removed the per-station "last access" line (D-006); it stays removed, the door
  path's open button for door openers is kept.
- `tests/intercom_station_scope.py` (the S3/S4 stand-in for D2) now runs in its "real" mode by itself (rbac has
  `station_chain`, the bindings table accepts the scope). The double can be deleted in a later clean-up; nothing depends on
  its fallback any more.

### 1.2 Migrations

| Number | File | Content |
|---|---|---|
| 0077 | `0077_access_control_station_scope.sql` | `bindings` rebuilt with scope type `access_control_station` (0032 pattern); `intercom_station_placement`; `door_grant_bindings` |
| 0078 | `0078_intercom_door_map.sql` | `intercom_door_map` |

- Kept as 0077 / 0078: integ/248 ends at `0075_plan_bakes`, no branch on origin uses 0076-0078 (checked against the 60
  most recent remote branches), so there is **no clash** and nothing was renumbered.
- **0076 is unassigned.** `scripts/release_check.py` requires a contiguous sequence, so its "migrations contiguous" item
  FAILS on this branch until 0076 exists. Whoever integrates next either (a) lets the next migration of the 2.4.8+ line
  take 0076 (the parallel S11 / S12 / WhatsApp / media work, if any of them adds one), or (b) renumbers 0077 / 0078 to
  0076 / 0077 (headers, the comments in `rbac.py` / `services/intercom_doors.py` / `services/intercom_authority.py`, the
  four migration-list tests). WisKey S3/S4 numbers start at 0079 as agreed - if (b) is chosen they move down too.
- Number-reuse hazard (review I2, still true): `Database.migrate()` records versions by number only. A database that ran
  integ/245 between `4ac95afb` and `9065a130` has 74 / 75 recorded for the door tables and would skip 2.4.7's 0074 / 0075; a
  database that ran any `pilot/WXD-*` or `pilot/SEC-WXD-*` branch has 77 / 78 recorded already (consistent with this branch).
  Check any persistent developer database before installing.
- The four migration-list tests (`test_migrations`, `test_media_api`, `test_media_players_api`, `test_notify_core`) list
  `..., 74, 75, 77, 78`.

## 2. Behaviour changes (what an installation sees after this branch ships)

All door-path behaviour is limited to WisKey doors (lock entities of the `hikvision_intercom` / `smplwise_intercom`
platforms and door-map rows) unless stated.

1. **One door rule.** A WisKey door opens from the devices tile, the map / home cards, the WisKey screen and its
   notification deep link only through `door_authority.check`: `access.release` on the station chain OR `door.unlock` on the
   lock entity, deny of either wins; kiosk / wall-display accounts, viewers, unidentified and inactive users never. A
   custom-role `door.unlock` holder keeps opening WisKey doors from tiles and also gets the WisKey-screen open button for
   doors in scope. `ha.entity.control` is no longer needed for a WisKey door.
2. **New built-in role `door_opener` ("פותח דלתות")** = `access.read` + `access.release`; not delegable by default. Settings ->
   הרשאות gains the "פתיחת דלתות" card (user / group switches, custom-role switches; every switch says what else
   `access.release` grants - calls, announcements, entry log, people directory - review L3).
3. **Scope type `access_control_station`** (bindings wizard, station picker, placement under a site / building in Settings ->
   אינטרקום). A station binding grants nothing above or beside itself; station-scope ALLOW bindings accept only roles whose
   permissions are all in `rbac.STATION_PERMISSIONS`.
4. **Door map** (Settings -> אינטרקום -> "שיוך דלתות"): explicit, single-relay suggestion or manual; never by name or
   unique id. **An installation must map its WisKey locks before a tile can open them** - an unmapped WisKey lock is refused
   (`intercom_lock_unmapped`) where it used to go through `execute`. This is the main operational change: the system
   administrator applies the suggestions once after installing.
5. **Transport:** flag `doors.trusted_path` is `off` (interim mode: today's station release, `stations/test_unlock`, with the
   person in Arx's audit); a WisKey door is never sent through the bridge's `execute` in any mode. "Sent", never "opened"
   (tile row confirmation `none`).
6. **`lock.lock` is never sent to a WisKey lock**; "lock all" skips WisKey doors with "לא רלוונטי"; scheduled lock jobs on
   them are listed as never working.
7. **Editor block** `doors.editor_block` = `blocked` (default; `allowed` not selectable until D10a): the automation /
   script / scene editors (typed and code), scene capture and the schedule editor refuse, on save, a NEW step that reaches a
   WisKey door directly or indirectly (lock groups, device actions, called scripts, scene members) and new steps on template /
   universal entities where a WisKey door exists (review M1 / M3).
8. **Run guard (R-17):** Arx-started runs (automation run, script run, scene apply, schedule run now, tile / map-card actions
   on scripts, scenes, buttons, lock groups and template entities) of an item that reaches a WisKey door are refused until
   D10a converts them.
9. **NEW in WXD-INT - enable guard (D10a groundwork, review I5):** enabling an automation, or a schedule (alone or in a bulk
   enable), whose steps reach a WisKey door - or may (unresolvable / template) - is refused while the editor block is
   `blocked`; disabling is always allowed. Previously an operator could re-arm such an item from Arx.
10. **NEW - add-on `execute` block (D5a, add-on side):** `ha_client.call_bridge_execute` refuses, before anything is sent, a
    `lock` / `button` payload that targets a WisKey-platform entity or a door-map row, and (only where a WisKey door exists) a
    lock the mirror does not know or whose platform is still unknown (review I9). Every caller (tile route, alarm, bulk, media)
    gets `409 wiskey_door_execute_blocked`, `details.outcome = not_sent`. Other domains are not looked at (no database read).
11. **NEW - tile rows of a door never turn "confirmed" by a poll** (`services/ha_actions.refresh`, T8): before this a pending
    `via = trusted_door` row (an open in flight, or one cut off by a restart) was marked `confirmed` - i.e. "sent" - by the
    first `GET /ha/actions/{id}` because it has no expected state. It now stays `pending` and becomes `unknown` after the
    confirmation window. Only the door path writes its outcome.
12. **NEW - status read rate limit** (review I7): `POST /doors/requests/{id}/status`, 6 per person per minute (429).
13. **NEW - signed actor names** (review I8): a display name with a Unicode format character (bidi controls, LRM / RLM, zero
    width) is never signed; the user name, then the id, is used instead (signed mode only).
14. Map placement of a WisKey lock needs `door.unlock` for it (or role administration) - review M2; bulk actions leave
    template / universal entities out where a WisKey door exists (M3); integration scenes are judged by their members (L6).

## 3. Routes and permissions

New routes (all under `/api/v1`, router `routers/doors.py`, tag `access-control`):

| Route | Gate |
|---|---|
| `GET /intercom/door-map` | `system.configure` @ installation |
| `PUT /intercom/door-map/{entity_id}` | `system.configure`, `confirmed: true`, audited `intercom.door.mapped` |
| `DELETE /intercom/door-map/{entity_id}` | `system.configure`, audited |
| `POST /intercom/door-map/apply-suggestions` | `system.configure`, `confirmed: true` |
| `PUT /intercom/stations/{station_id}/placement` | `system.configure`, confirmed, audited `intercom.station.placed`, permission revision bump |
| `GET /access/door-grants` | `rbac.roles.manage` @ installation, or delegated (`rbac.assign` + door_opener delegable) |
| `POST /access/door-grants/subjects` | as above; confirmed; audited `rbac.bind` / `rbac.revoke` with `via: door_grants_card` |
| `PUT /access/door-grants/roles/{role_id}` | `rbac.roles.manage`; confirmed; built-in and delegable roles refused; stale revision refused |
| `GET /doors/settings`, `PUT /doors/settings` | `system.configure`; confirmed; audited `settings.changed` |
| `POST /doors/requests/{request_id}/status` | the open's own actor, else `system.configure`; signed mode only; 6 / min / person |
| `GET /intercom/door-path-inventory` | `system.configure`, read-only |

Changed routes: `POST /intercom/stations/{id}/release` (door rule at station level, then per relay), `POST
/ha/entities/{id}/actions` (WisKey lock: door rule first, `lock.lock` refused, `lock.unlock` through `open_from_tile`; every
tile action judged by the run guard), `GET /ha/entities` (no `lock.lock` for WisKey locks), anchors create / delete (M2), the
automations / schedules write, run and (new) enable routes, `POST /access/bindings` (station scope), scene capture.

### 3.1 403 codes and reasons a client can now meet

| Status / code | `details.reason` / where |
|---|---|
| 403 `forbidden` "אין הרשאה לפתוח דלת זו" | `no_binding`, `explicit_deny`, `user_inactive`, `identity_unmapped`, `wall_account` (release, tile, converted run) |
| 403 `forbidden` (anchors) | `door_unlock_required` - placing / removing a WisKey lock on a map without door.unlock for it |
| 403 `forbidden` (grant card, settings, inventory, map, placement) | the route's own permission (`system.configure`, `rbac.roles.manage`) |
| 403 on the tile for a caller with no control at all | the same audited 403 as any lock (review L2: nothing about the door is disclosed first) |

Other new codes (not 403): 409 `intercom_lock_unmapped`, `intercom_release_in_progress`, `wiskey_lock_unsupported`,
`door_step_not_converted`, `door_steps_unresolvable` (run AND, new, enable - `details.op = "enable"`), `use_automations_screen`,
`trusted_path_unavailable`, `editor_allowed_unavailable`, `door_refused`, `door_status_unavailable`, `intercom_relay_taken`,
`intercom_map_station_mismatch`, `stale_revision`, `builtin_role`, **`wiskey_door_execute_blocked` (new)**; 422
`wiskey_door_step_blocked`, `scope_not_allowed_for_role`, `wall_account`, `door_message_invalid`, `scope_unknown`; 404
`intercom_lock_not_wiskey`; 429 `rate_limited` (status read, new); 503 `intercom_unavailable` (no WisKey copy, L5),
`bridge_not_paired`, `door_path_unavailable`; 504 `door_outcome_unknown`.

## 4. D5a / D5b preparation (fakes only)

- **D5a, add-on side, done:** `services/door_execute_guard.py` + the hook in `ha_client.call_bridge_execute` (behaviour 10).
  Same code as the bridge 0.8.1 contract (`wiskey_door_execute_blocked`) so the screens need no second mapping;
  `ha_actions.bridge_status` already maps the bridge's answer to `failed`.
- **D5a, bridge side, NOT built:** the `execute` refusal inside `custom_components/smplwise_bridge` (and its mirror), the
  `wiskey_execute_policy` entry option (default `blocked`), the signed `bridge_policy.set` message, the Arx setting
  `bridge.wiskey_execute_policy`. Reason: it changes the bridge's behaviour and must ship with the bridge version bump to 0.8.1
  (lesson of bridge 0.8.0: an unversioned bridge change never reaches installed bridges), and version files were out of scope
  here. Release order stays CR-033 5.5: the add-on carrying D4 first, then bridge 0.8.1.
- **D5b, Arx acceptance path, proven on the fake WisKey consumer** (FakeTrustedBridge = the DTO v3 reference model): the
  signature binds actor, command, station, relay and request id (any change -> rejected, nothing dispatched); a replay is
  answered from the store and never dispatched twice, and is refused after the 30 s lifetime; `unknown` (unconfirmed,
  interrupted, persistence failed, timeout after delivery) is never success - 504, tile row `unknown`, relay held; no
  automatic retry - one `door_open` per click, the status read is the only follow-up, a new open is a new request id with its
  own confirmation.
- **Trusted path:** `MIN_BRIDGE_FOR_TRUSTED_PATH` stays `None` - the flag cannot be switched on whatever bridge version is
  reported; it moves only through `PUT /doors/settings` (system administrator, confirmed, audited), never through
  `PATCH /settings` or a restore. Bridge-side `door_open` / `door_open_status` (D5b proper) wait for WisKey's consumer.

## 5. Tests

New files (backend, `smplwise_vms/backend/tests/`):

| File | Tests | What |
|---|---|---|
| `test_wiskey_door_gate.py` | 11 | D11: the T1..T26 gate map (every named test must exist; T13 / T19 / T24 partly OPEN) + T6 gaps, D2 placement through the route, T23 registry change, T7 logs, T8 restart, T10, T11 kiosk via group, T20, T22, "sent never opened" |
| `test_wiskey_door_signed.py` | 14 | D5a add-on execute block, D5b acceptance path, I7, I8 |
| `test_wiskey_door_enable.py` | 3 | D10a enable guard (automations, schedules, bulk) |

Known red on this branch: `tests/test_release_check.py::test_repository_is_release_consistent` fails on its
"migrations contiguous" item because 0076 is unassigned (section 1.2) - expected until the 0076 decision is made; it is the
only failure of the local merged-tree run (848 passed, 1 failed, 38 related files).

Still OPEN on fakes (never counted as covered): T13 (the D10a conversion itself), T19's fake HA with `context.user_id` /
`parent_id` and concurrent runs, T24 bridge side.

## 6. For the integrator of the next release

1. Merge this branch normally (no revert gymnastics left). Decide 0076 (section 1.2) and re-run `release_check`.
2. Regenerate `contracts/API_INVENTORY.md` (`scripts/api_inventory.py`; 12 new routes) and the role catalogue checks if a
   test asks; `door_opener` is in `roles.json` - check `contracts/examples/role-catalog.design.json` agrees if its test does.
3. After install the system administrator must open Settings -> אינטרקום -> "שיוך דלתות" and apply the suggestions, or
   WisKey tiles answer "הדלת לא מוגדרת לפתיחה" (behaviour 4). Put this in the release notes' "how to enable".
4. Ask the owner the open questions below before switching anything on; `doors.trusted_path` stays off.
5. S11 (people / card writes on the station chain) touches `routers/access_control.py` heavily; this branch changed one line
   there (`trusted_door.actor_name`) plus the door section brought by the merge. Add `access.pin.generate` to
   `rbac.STATION_PERMISSIONS` when S11 lands.

## 7. Open questions (owner)

1. L3: a door-only permission (`access.door_open`) separate from `access.release` (calls, announcements, entry log, people)?
   Today the grant card discloses the extra rights; nothing else changed.
2. D10a scope: convert the autonomous items the inventory finds (Arx event door jobs, WisKey hold-open programs), or keep
   "refuse run and enable, allow disable" as the stage-1 end state?
3. 0076: let the next migration take it, or renumber the door migrations to 0076 / 0077 (section 1.2)?
4. M3 cost: on installations with many template / universal entities, tile actions, runs and bulk actions on them are
   refused where a WisKey door exists. Is an administrator attestation "this virtual entity is not a door" wanted?
