# Security review - CR-033 WisKey door path, slices D0-D4 and D6-D9 (second Opus pass)

Date: 2026-10-12 (started 2026-10-11). Task SEC-WXD, branch
`pilot/SEC-WXD-review`, worktree `C:\cloude\wt-sec-wxd`. REVIEW ONLY: no product code was changed; this document and one
proof-of-concept test file were added. No device, door, station, Home Assistant, bridge or WisKey system was contacted.

Scope: the code of `origin/pilot/WXD-wave1` (11eecbcf: D0 fakes, D1 door map, D2 station scope, D3 door authority and grant card,
D4 trusted_door transport), `origin/pilot/WXD-d6-d8` (492f706d: D6 lock actions, D8 editor block) and `origin/pilot/WXD-d7-d9`
(079cd363: D7 inventory, D9 run guard), merged into the review branch. Requirements: `docs/changes/CR-033-WISKEY-DOOR-PATH.md` on
`origin/pilot/WISKEY-CRs` (267d19e7), sections 4-11 (acceptance checklist section 10, test plan 11.3) and the transition table
`DOOR_PATH_TRANSITION_TABLE.md` on `origin/pilot/WX2-transition-table` (75844343) for T1..T22; `docs/security/HA_IDENTITY_RBAC_HE.md`.
Slices D5 (bridge 0.8.1 `execute` block, D5a; bridge `door_open`, D5b) and D10 (conversions) are NOT built on any of the three
branches and could not be reviewed; their tests (T24, T13) are open.

Paths below are relative to `smplwise_vms/backend/smplwise/` unless stated otherwise. Line numbers are at the review branch.

## 0. What was run

| # | Command (all through `private/runner/run_smart.py ... --machine runner`) | Commit | Result |
|---|---|---|---|
| 1 | `backend pilot/SEC-WXD-review tests/test_wiskey_door_path.py tests/test_wiskey_d6_d8.py tests/test_wiskey_door_inventory.py` | 52602f65 | **46 passed** (18 + 15 + 13) |
| 2 | `backend pilot/SEC-WXD-review` + the 61 related files (`test_wiskey_*`, `test_ha.py`, `test_ha_authority.py`, `test_devices.py`, `test_intercom.py`, `test_notify_*`, `test_schedules_*`, `test_bridge_*`, `test_automations_*`, `test_rbac*`, `test_kiosk_role.py`, `test_access.py`, `test_custom_roles.py`, `test_migrations.py`, `test_backup.py`) | 52602f65 | **1494 passed** |
| 3 | `backend pilot/SEC-WXD-review tests/test_security_review_wxd_poc.py` + the three door-path files + `test_wiskey_golden_vectors.py` + `test_wiskey_v3_addendum.py` | 60d91910 | **101 passed** (15 PoC + 46 + 40) |
| 4 | `tsc pilot/SEC-WXD-review` | 60d91910 | **tsc ok** (the merged frontend compiles) |
| 5 | `spec pilot/SEC-WXD-review tests/unit-door-settings.spec.ts tests/unit-door-path.spec.ts --project=desktop` | 60d91910 | **11 passed** |

The PoC file was also iterated on the workstation (one pytest process at a time, the repo `.venv`). Integration was simulated
with `git merge-tree` only (no ref other than `pilot/SEC-WXD-review` was written or pushed).
NOT_RUN: the full backend suite (361 files), the full frontend suites, fixture / visual / pixel jobs, and anything against a
real Home Assistant, bridge, WisKey or door.

The PoC tests (`smplwise_vms/backend/tests/test_security_review_wxd_poc.py`) assert the CURRENT behaviour of each finding: they
pass while the finding is open and fail on purpose once a fix lands (invert them into regression tests then). On
`pilot/SEC-WXD-fixes` the file is `test_security_review_wxd_fixes.py` and the proofs are inverted - see section 8.

## 1. Combining the branches, integration and migration numbers

### 1.1 Merge into the review branch

`pilot/SEC-WXD-review` = `origin/pilot/WXD-wave1` + merge of `origin/pilot/WXD-d6-d8` (f9206975, no conflict: wave 1 is the merge
base) + merge of `origin/pilot/WXD-d7-d9` (52602f65). The second merge had five conflicts, all trivial (both sides kept):
`services/automation_ops.py` and `services/schedule_ops.py` (imports `door_path_guard as guard` and `door_run_guard`),
`routers/doors.py` (services import: `door_path` and `door_path_guard`), `frontend/src/api/doors.ts` (D8 `setEditorBlock` next to
D7's inventory types), `frontend/src/screens/system-doors.ts` (union of the `api/doors` import list). Auto-merged files that both
sides touched (`routers/ha.py`, `routers/automations.py`, the run functions of `automation_ops.py` / `schedule_ops.py`) were read
after the merge: D8 (save-time) and D9 (run-time) guards sit side by side without interaction. Run 2 above is the regression check
of the merge result. No non-trivial conflict.

### 1.2 I1 - wave 1 is already merged into `main` and reverted: re-merging the branches does not bring it back (process, act before integration)

`4ac95afb` merged `pilot/WXD-wave1 @ 11eecbcf` into `integ/245` (renumbering 0077 -> 0074, 0078 -> 0075) and `9065a130` reverted it
(`git revert -m 1`, "the WisKey door path does not ship in 2.4.5"). Both commits are in `origin/main` (095ca474, 2.4.6), so
11eecbcf is an ancestor of `main`. The code is in no release (verified: 2.4.5 = 02a175f3 and 2.4.6 do not contain the files), but:

- `git merge-tree --write-tree origin/main origin/pilot/WXD-wave1` yields exactly `main`'s tree (ea931d95): merging wave 1 again
  is a silent no-op - none of D0-D4 would arrive.
- Merging `WXD-d6-d8` or `WXD-d7-d9` into `main` brings only their own diffs on top of a `main` that lacks wave 1: modify/delete
  conflicts on `routers/doors.py`, `frontend/src/api/doors.ts`, `system-doors.ts`, `system-doors-logic.ts`,
  `unit-door-settings.spec.ts`, `test_wiskey_door_path.py`, plus content conflicts in `routers/ha.py` / `system-setup.ts`.

The integrator must first revert the revert (`git revert 9065a130`) or re-apply wave 1 as new commits (cherry-pick / rebase), then
merge D6-D9 and this review's fixes. Merging the pilot branches as they are either drops the security controls of wave 1 silently
(wave 1 alone) or fails loudly (D6-D9).

### 1.3 I2 - migration numbers

| Ref | Newest migrations |
|---|---|
| `origin/main` 095ca474 (2.4.6) | ... 0072_frigate_config_class, **0073_device_type** |
| `origin/integ/247` a8b6a21d (Studio 6, also `pilot/ST7-*`) | 0073, **0074_plan_view_prefs**, **0075_plan_bakes** |
| WXD wave 1 / d6-d8 / d7-d9 (based on 2.4.3, no 0073) | ... 0072, **0077_access_control_station_scope**, **0078_intercom_door_map** |
| `origin/pilot/DEVTYPE-settings` (stale; its content is 0073 on main) | 0076_device_type |
| CR-034 (reserved, not written) | 0079 `bridge_rotations` |

- No two migrations share a number today: 0077/0078 do not collide with `main` (<= 0073) or `integ/247` (0074/0075). D6-D9 add no
  migration.
- Gap: on top of 2.4.7 the sequence would be 0001..0075, 0077, 0078; `release_check` requires a contiguous sequence (merge note of
  4ac95afb), so the door migrations are renumbered at integration (0076 / 0077 if nothing else lands first), and CR-034 then takes
  the next free number, not a reserved 0079. Update the headers, the comments in `rbac.py` / `services/intercom_doors.py` and the
  four migration-list tests together, as 4ac95afb did.
- Number-reuse hazard: `Database.migrate()` (db.py:395-411) records applied migrations by NUMBER only. Any database that ran
  `integ/245` between 4ac95afb and 9065a130 has versions 74 and 75 recorded for the door tables, and would silently SKIP 2.4.7's
  `0074_plan_view_prefs` / `0075_plan_bakes`. Only 0036/0037 are guarded by object checks (`GUARDED_MIGRATIONS`). The runner's gate
  and fixture jobs use fresh data directories, so this is probably limited to a developer database; check any persistent database
  that ran that build (look for `intercom_door_map` with version 75 recorded) before 2.4.7, or add 0074/0075 to the object guard.

## 2. Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 6 |
| Informational | 13 (I1, I2 above; I3-I13 in section 5) |

| ID | Severity | Location | Title |
|---|---|---|---|
| M1 | Medium | `services/door_path_guard.py:54-167`, `services/schedule_ops.py:830, 974, 1073` | D8 editor block: indirect targets and three schedule paths add new WisKey door steps while "blocked" |
| M2 | Medium | `services/door_authority.py:56-76`, `routers/anchors.py:373-392` | `door.unlock` reaches whatever WisKey door an editor places on the floor |
| M3 | Medium | `services/door_path.py:311-379`, `services/door_run_guard.py:115-140` | R-17 is fail-open for template entities other than locks and buttons |
| L1 | Low | `services/door_authority.py:79-105`, `routers/doors.py:187-266` | A wall-display (kiosk) account is not refused as such |
| L2 | Low | `routers/ha.py:239-255`, `routers/access_control.py:842-866` | The tile path answers before any permission check (door facts, station name and state) |
| L3 | Low | `roles.json` (door_opener), `routers/access_control.py:901, 926`, `frontend/src/screens/system-doors-logic.ts:15-21` | The one door switch also grants calls, announcements and the WisKey screen |
| L4 | Low | `routers/access.py:513-515`, `rbac.py` `permissions_anywhere` consumers | A station-scope binding of a broad role is honoured "anywhere" |
| L5 | Low | `services/intercom_doors.py:133-145`, `routers/access_control.py:857-865` | Signed mode trusts the door map when no WisKey copy is held |
| L6 | Low | `services/door_path.py:471-489, 527-541` | Every integration scene is "unresolvable" once one WisKey lock exists (availability) |

## 3. MEDIUM

### M1 - D8 editor block: indirect targets and three schedule paths add new WisKey door steps while "blocked"

- Where:
  - `services/door_path_guard.py:54-62` (`target_kind`): only an entity id that starts with `lock.` and whose registry platform is
    WisKey (or that the mirror does not know) is a blocked target; a lock GROUP (platform `group`) is "other".
  - `:105-139` (`check_automation_item`): walks only `facts["steps"]`, i.e. the item's own typed lock steps by entity id; a
    `script.turn_on` / `scene.turn_on` step is never followed into the called item, and a lock group is not expanded. For scenes,
    `is_new` (line 121) asks only whether the lock was a member before, so `locked` -> `unlocked` is not new. (Code-mode area /
    device / label targets come out as `effects: "unknown"` and ARE refused - that part works.)
  - `:82-102` (`_locked_block_opens`, code mode): a block "opens" only by service name (`lock.unlock|open`, `*.unlock_door`) - a
    device action (`type: unlock`, no service) never matches; a lock group in `effects` is "other".
  - `:142-167` (`check_capture`, `check_schedule`): direct `lock.*` ids only; schedule actions calling a script are not judged.
  - `services/schedule_ops.py`: `split` (830), `copy` (974) and trash `restore` (1073) each create a NEW schedule
    (`evaluate(..., creating=True)`) without calling `guard.check_schedule` (only `create` 592 and `update` 650 do).
  - CR-033 section 12 says the D7 resolver "is reused by D8/D9 for refusal"; D8 has its own, much narrower matcher.
- Evidence (PoC, all under `doors.editor_block = blocked`, the default):
  - `test_poc_m1_typed_builder_saves_a_new_door_step_through_a_lock_group`: `lock.unlock` on the WisKey lock -> 422
    `wiskey_door_step_blocked`; the same on a lock group over it -> 201, and the D7/D9 resolver reports a door step in the saved item.
  - `test_poc_m1_code_mode_saves_a_new_door_step_through_a_lock_group`: code mode, lock group -> 200; device action
    `{domain: lock, type: unlock, entity_id: <the WisKey lock>}` -> 200 (the resolver sees the door).
  - `test_poc_m1_typed_builder_saves_a_call_of_a_script_that_opens_the_door`: `script.turn_on` of a script that unlocks the WisKey
    lock -> 201; the D9 guard then refuses to RUN the very item the D8 guard let through.
  - `test_poc_m1_an_author_without_door_unlock_adds_a_door_opening_through_a_script`: an HA non-administrator writing under the
    delegated-authoring switch with `automation.manage` + `ha.entity.control` and NO door permission is refused `lock.unlock` on an
    ordinary lock (403, door.unlock required) but saves a motion-triggered automation that calls the door script (201). The
    CR-017 rights (`services/automation_scope.py:301-375, 484-501`) ask the sensitive grant only for the item's own typed steps
    and only control of a called script's targets - a pre-existing gap for every lock that D8 was the place to close for WisKey.
  - `test_poc_m1_scene_member_flipped_from_locked_to_unlocked_is_not_a_new_step`: 200; the stored scene now opens the door.
  - `test_poc_m1_schedule_copy_creates_a_new_door_step_the_editor_refuses`: create -> 422, copy of an existing door schedule ->
    201 with the door step.
- Impact: owner decision 16 ("block creating NEW WisKey door steps in the Arx editors") is not enforced on the server for these
  paths. The new item is autonomous: Home Assistant fires it on its own trigger (DR-7 path, not judged by Arx; until WisKey's
  lock-breaking release the WisKey lock entity checks nobody), so a door opens on a motion / time trigger. D9 refuses only
  Arx-started runs. Requires `automation.manage` / `schedule.manage` (sensitive grants); for the called-script variant no door
  permission at all (proven; a called scene follows the same CR-017 rule, not tested). Needs an existing script or scene that opens
  the door for that variant. Confidence: high (proven). Exploitable: remotely, authenticated.
- Minimal fix:
  1. Judge the saved content with the D7 resolver (`door_path.Resolver.resolve_config` / `resolve_schedule_slots`): refuse when the
     new content has a door step or an unresolved entry whose (path-independent) door / reason the stored content did not have.
     Use it in `check_automation_item` (typed and code), `check_capture` (expand groups), and `check_schedule`.
  2. Call the schedule check in `split`, `copy` and `restore` (and decide `set_enabled` / `bulk` enable, see I5).
  3. Treat a scene member change to an open state as new.
  4. Add T25 cases for each vector above; separately, require the door grant for door steps reached through called scripts and
     scenes (CR-017 `grant_reasons`), for every lock.

### M2 - `door.unlock` reaches whatever WisKey door an editor places on the floor

- Where:
  - `services/door_authority.py:56-76`: the `door.unlock` leg judges the lock entity's chain = installation + every floor
    `ha_scope.placements()` lists for it (map anchors; also circuit switches of a published plan and shared-room members).
  - `routers/anchors.py:373-392` (`create_anchor`): placing an HA entity needs only `placement.edit` on the target floor. Cameras
    need `require_camera_placement` (T055 B1, line 384: the editor must already reach the camera on its current chain); HA entities
    have no such rule.
- Evidence: `test_poc_m2_a_floor_editor_extends_floor_door_unlock_to_any_wiskey_door_by_placing_it`. `ed` holds the built-in editor
  role on floor 2 and a floor-2 custom role with `door.unlock` (meant for floor 2's own locks). The entrance's WisKey lock is not on
  floor 2: the WisKey screen refuses ed (403). ed places the lock entity on floor 2 (201); `door_authority.check` now allows with
  `granted_by = door.unlock`, scope floor 2, and ed opens the entrance from the WisKey screen (200) and the tile (202).
- Impact: physical access to any WisKey door for anyone who combines floor-scoped `door.unlock` with `placement.edit` on the same
  floor (one person with both, or an editor and a door.unlock holder of that floor). The mechanism is pre-existing in `ha_scope`
  for every lock; CR-033 inherits it for WisKey doors, drops the `ha.entity.control` requirement (decision 13) and extends it to the
  WisKey-screen route (B1 was installation-scope `access.release` only). Confidence: high (proven). Exploitable: remotely,
  authenticated, needs two sensitive-ish grants.
- Minimal fix (choose one, owner-visible):
  1. Judge `door.unlock` for a WisKey door on a chain an editor cannot move: installation + the station's placement chain (station
     -> building -> site), i.e. the same chain as `access.release`; keep the entity chain for ordinary locks only.
  2. Or apply the T055 B1 rule to door-class entities (lock domain, door layer): placing / moving one needs `placement.edit` AND
     `door.unlock` on its CURRENT chain (an unplaced one: installation-wide), for anchors, circuit switches and shared rooms alike.
  3. Either way, audit-alert `anchor.create` of a WisKey lock entity.

### M3 - R-17 is fail-open for template entities other than locks and buttons

- Where:
  - `services/door_path.py:311-361` (`_call`): `lock.*` on a `template` lock is unresolved (line 379) and `button.press` on a
    template button is unresolved (line 361), but no other service is looked at: `switch.turn_on`, `cover.open_cover`,
    `light.turn_on`, `fan.turn_on`, `select.select_option`, `number.set_value`, `valve.open_valve`, `vacuum.start`,
    `alarm_control_panel.*` on a template entity run an action sequence the mirror does not hold, exactly like a template lock.
  - `services/door_run_guard.py:115-140` (`judge_entity_action`): a tile action is judged only for `script.turn_on`,
    `scene.turn_on`, `button.press`, `lock.unlock`, `lock.open`; every other bridge action goes to `execute` unjudged.
- Evidence: `test_poc_m3_a_template_switch_wrapper_is_not_judged_as_a_possible_door`: a script that unlocks a template lock is
  refused (`door_steps_unresolvable`); a script that turns on a template switch runs unchanged (`judge_item` -> None); the tile
  guard does not refuse `switch.turn_on` on it; an operator (`devices.control`, no door permission, refused by the WisKey screen)
  presses the template switch and it is sent through `execute` (202, `via: bridge`).
- Impact: a template switch / cover ("שער") whose `turn_on` / `open_cover` calls `lock.unlock` on a WisKey lock - a known Home
  Assistant wrapper pattern - opens the door from an Arx tile or an Arx-started run with only device control, outside the door
  authority, its audit fields and R-17 ("an item whose door steps cannot all be resolved statically is refused"). The D7 inventory
  does not list such items either (T12 incompleteness). Requires a wrapper that an HA administrator created. Confidence: high
  (proven for the guard; the wrapper's content is by definition invisible to Arx).
- Minimal fix: when a WisKey door exists, treat every service call on an entity of platform `template` (and other script-backed
  platforms, e.g. `universal`) as unresolved, and judge every tile action through `resolve_actions` instead of five action ids;
  list them in the inventory; add T12 / T19 cases for each template domain.

## 4. LOW

### L1 - A wall-display (kiosk) account is not refused as such
- Where: `services/door_authority.py:79-105` refuses only unidentified, developer-outside-dev-mode and inactive principals; kiosk and
  viewer are refused only because their roles hold neither permission (docstring line 16). CR-033 4.1 step 1 and T11 refuse "a
  kiosk or viewer principal" before anything else. The grant card (`routers/doors.py:187-266`, `acc._users`) lists every user,
  wall-display accounts included.
- Evidence: `test_poc_l1_a_kiosk_account_opens_doors_once_any_grant_reaches_it`: a kiosk-bound account is offered by the card, one
  switch grants door_opener, and the account opens the entrance (200).
- Impact: an unattended lobby display session can open doors once any grant reaches it (card switch, a group, a custom role).
  Needs an administrator's grant. Confidence: high.
- Fix: refuse a principal with an active kiosk binding or a wall profile in `door_authority.check` (before the permission checks);
  hide such accounts from the card; add the T11 case "kiosk with door_opener".

### L2 - The tile path answers before any permission check
- Where: `routers/ha.py:239-255` diverts a WisKey lock's `lock.lock` / `lock.unlock` before `ha_scope.control_allowed`;
  `routers/access_control.py:856-866` (`open_from_tile`) refuses `intercom_lock_unmapped`, `intercom_station_offline` (message with
  the station's name), `intercom_no_lock` before `door_authority.check` (line 866).
- Evidence: `test_poc_l2_a_caller_without_any_permission_learns_door_and_station_facts`: a user with no binding at all gets 403 for an
  ordinary lock but 409 `intercom_lock_unmapped` / `wiskey_lock_unsupported` / `intercom_station_offline` ("... דלת צד ...") for
  WisKey locks, while the WisKey screen (`access.read`) refuses them.
- Impact: whether an entity is a WisKey door, whether it is mapped, the station's name and online state, to any authenticated
  user; one audit row per probe. Confidence: high.
- Fix: decide the permission first (the station-level door rule, as `_door_gate_ro` does for the WisKey screen) and answer a uniform
  403; refuse D6's `lock.lock` after the same check.

### L3 - The one door switch also grants calls, announcements and the WisKey screen
- Where: `door_opener` = `access.read` + `access.release` (CR-033 4.2). `access.release` at installation is also the gate of call
  answer / reject / hang-up (`call_signal`, line 901) and of announcements (`tts_speak`, line 926; the text may go to a cloud TTS);
  `access.read` opens the WisKey screen, its entry events and the people directory (`_reader`). The card says "רשאי לפתוח דלתות"
  and asks "לתת ל<שם> הרשאה לפתוח דלתות?" (`system-doors-logic.ts:15-21`); the custom-role switch adds `access.release`.
- Evidence: `test_poc_l3_the_door_switch_also_grants_calls_announcements_and_the_wiskey_directory`: after the switch, the call and
  announcement routes pass their permission gate (422 on an empty body instead of 403) and the overview answers 200.
- Impact: least privilege / informed consent: the owner asked for an easy door grant; the switch also lets the person talk to the
  door station and read the entry log and directory. Confidence: high (by design of CR 4.2, not visible in the UI).
- Fix (owner decision): a door-only permission (for example `access.door_open`) for the switch and the door rule, with calls / TTS
  staying on `access.release`; or name all of it in the switch's confirmation and the role switch.

### L4 - A station-scope binding of a broad role is honoured "anywhere"
- Where: `routers/access.py:513-515` refuses only roles that carry `rbac.assign` at station scope; `rbac.permissions_anywhere`
  (`rbac.py:237`) counts every allow binding, and some routes decide on a permission held at ANY scope
  (`routers/plan_catalog._held_anywhere`, `routers/presence._require_anywhere`; the alarm / multimedia / Frigate routes use it as a
  pre-check before their own scope checks).
- Evidence: `test_poc_l4_a_station_scope_binding_of_a_broad_role_grants_beside_the_station`: `editor` bound to one station (201)
  gives `catalog.manage`, `placement.edit`, `presence.report` "anywhere"; the installation's object library gate passes.
- Impact: CR-033 4.3 "a station binding grants nothing above or beside itself" holds for the door permissions, not for other
  roles an administrator may bind to a station. Confidence: high.
- Fix: at station scope allow only roles whose permissions are within `{access.read, access.release}` (door_opener, matching custom
  roles), or leave station-scope bindings out of `permissions_anywhere`.

### L5 - Signed mode trusts the door map when no WisKey copy is held
- Where: `services/intercom_doors.py:133-145` (`row_valid` checks station / relay only `if SYNC.has_copy()`),
  `routers/access_control.py:857-865` and `_relay_of` (station None -> no station, relay or online check),
  `services/door_run_guard.py:163-172` (same pattern). The docstring says nothing can be sent without a copy: true for the interim
  transport (`IntercomSync._execute` needs the ready feed), not for the signed `door_open`, which does not use the feed.
- Evidence: `test_poc_l5_signed_mode_signs_a_stale_mapping_when_no_wiskey_copy_is_held`: with the copy saying the relay is gone the
  tile is refused; with no copy at all (after a restart, before the feed is up) the same stale row is signed and sent (202).
- Impact: a relay re-wired or re-assigned in WisKey is opened as mapped. Not reachable in this release (`MIN_BRIDGE_FOR_TRUSTED_PATH`
  is None). Fix: refuse (`not_sent`) without a copy in every mode, or validate against the bridge's capability snapshot.

### L6 - Every integration scene is "unresolvable" once one WisKey lock exists
- Where: `services/door_path.py:527-541` sends a scene without config to `resolve_entity_item`, whose member branch (471-480) runs
  only when the scene has NO mirror row; an integration scene has one (config_json NULL, `services/automations.py:351-352`), so it is
  `unreadable_item` (line 487).
- Evidence: `test_poc_l6_an_integration_scene_with_no_lock_is_refused_once_any_wiskey_lock_exists`: a member-less integration
  scene is `None` (not judged) without WisKey and `door_steps_unresolvable` (409 on apply, listed in the door report) as soon as one
  WisKey lock exists.
- Impact: availability (fail closed): every Hue-style integration scene stops working from Arx and floods the inventory. Fix: use the
  member branch for a scene row whose config is NULL and source `integration`; add a D9 test.

## 5. Informational

- I3 - The deny rule is chain-specific (`test_poc_i3_a_deny_written_on_the_other_chain_does_not_stop_either_permission`): a deny of
  door_opener on the floor where the door's lock entity is placed, and a deny of a door.unlock role on the station itself, are both
  ignored. This is CR-033 4.1 step 2 as written; the binding wizard should say so, or treat a deny of either permission on either
  chain as a deny.
- I4 - Station placement (`PUT /intercom/stations/{id}/placement`) bumps `permission_revision` but marks no user in
  `services/revocation`; open sockets and the `/me` fingerprint do not learn it. Decisions are per request, so only buttons go stale.
- I5 - Enabling an automation or schedule (`set_enabled`, schedule `bulk`) that holds a WisKey door step is not judged by D8 or D9;
  after the D10 "disable and list" run, an operator can re-arm the autonomous door opener from Arx.
- I6 - Audit details: the entry point `map_card` is never recorded (tile and map card share the route); `intercom.door.mapped`
  records `replaced: true` but not the previous station / relay (placement records `before`); `DELETE /intercom/door-map/{id}`
  takes no confirmation (the safe direction).
- I7 - The signed transport spends no `IntercomSync` lane token and holds no in-flight slot (only the per-relay guard), and
  `POST /doors/requests/{id}/status` has no rate limit; both signed-mode only.
- I8 - `trusted_door._text_ok` filters C0/C1 controls but not Unicode bidi / format characters (U+200E/F, U+202A-E, U+2066-9) in the
  signed actor `display_name`: WisKey-side audit display spoofing. Signed mode only.
- I9 - Door-ness comes from the mirror's `platform`; a new lock entity first seen through a state event has `platform` NULL until
  the registry sync (`services/ha_sync.py:328-331`), and in that window a WisKey lock is an ordinary lock (`execute`, not a door step
  for D8/D9). Bridge 0.8.1 (D5a, refuse `execute` for WisKey or unknown registry entries) would close it; it is not built.
- I10 - Map cards (`routers/anchors.py:252`) still offer `lock.lock` for WisKey locks and decide `lock.unlock` by
  `ha.entity.control` on the floor, not by the door rule (transition table A4); the server refuses both correctly. The door
  notification's `can_open` and the WisKey screen stay installation-scope (`services/notify_visibility.py:207`), so a station-scoped or
  door.unlock opener gets no button there (function gap, not a hole).
- I11 - D5 and D10 are not built: no bridge-side `execute` block (T24, X1 defence in depth), no conversions (T13). The converted-run
  path (`door_run_guard.open_plan_doors` -> `open_door` -> `act.attempt()`) commits the automation route's own transaction mid-request;
  it is reachable only through the test-only conversion source - review it again with D10a.
- I12 - CR naming deviations: the editor setting is `doors.editor_block` (CR: `doors.editor_wiskey_steps`);
  `bridge.wiskey_execute_policy` does not exist yet (D5a). Restores keep the installation's own `doors.*` values (never tighten from
  an archive either) - recorded in the wave-1 report.
- I13 - Interim mode (flag off, the only mode reachable now): WisKey sees the add-on's infrastructure user and Arx's audit holds the
  person (CR 5.5, known and accepted).

## 6. T1..T26 coverage (tests on the three branches; my PoCs are not counted as coverage)

| Id | Status | Where / what is missing |
|---|---|---|
| T1 | Partial | `test_d4_interim_wiskey_screen_release_...`, `test_d4_tile_unlock_...`, `test_d4_signed_open_...`, `test_d9_a_converted_run_...`: tile, WisKey screen, notification, run. Map card / panel dialog share the tile route; `map_card` is never recorded (I6) |
| T2 | Covered | `test_d4_refusals_before_signing_send_nothing` (no permission, kiosk, viewer, confirmation, expired, duplicate, unknown relay), `test_d4_tile_unlock_...` (unmapped), `test_d4_wiskey_screen_permission_gate_...` (per relay), `test_d4_tile_outcomes_...` (relay held) |
| T3 | Covered (direct) | `test_d4_tile_unlock_...` (never `execute`, ordinary lock unchanged), `test_d4_signed_open_...` (flag on: no `test_unlock`). Gaps: M3 wrappers, I9 window |
| T4 | Covered | `test_d4_signed_refusal_unknown_and_status`, `test_d4_tile_outcomes_...` |
| T5 | Partial | `test_d0_classify_maps_every_closed_answer` + one refusal code; not every stage/code; "no input echoed" not asserted |
| T6 | Partial | `test_d3_either_permission_...`, `test_d2_*`, `test_d3_grant_card_...`. Missing: a group binding's / custom-role switch's effect on the decision, expired binding, revoked HA user (`ha_users.is_active`), placement (M2), kiosk with a grant (L1) |
| T7 | Partial | `test_d4_signed_open_...` scans `audit_log` only; logs not scanned |
| T8 | Missing | no restart between attempt and outcome is simulated (the docstring of `test_d4_signed_refusal_...` names T8; it tests a timeout) |
| T9 | Covered | `test_d6_*` (server), `unit-door-path.spec.ts` (lock all) |
| T10 | Missing | no test that notification tokens / service worker / email cannot open (code reading: `origin` is audit-only, tokens carry ack/snooze) |
| T11 | Partial | kiosk / viewer / dev / nobody without grants only (L1) |
| T12 | Covered | `test_d7_resolver_...`, `test_d7_inventory_...` (M3, L6 not modelled) |
| T13 | Missing | D10 not built; only the approver rule (`test_d7_approver_must_cover_...`) |
| T14 | Partial | seeded version history, not a write -> HA edit -> mirror round trip |
| T15 | Covered | `test_d6_scheduled_lock_jobs_...` |
| T16 | Covered | `test_d7_inventory_...` (external -> untouched; no disabling code exists) |
| T17 | Covered | `test_d9_schedule_run_now_...` (refused per R-17) |
| T18 | Covered | `test_t25_scene_capture_...`, `test_d9_unconverted_...` (scene apply) |
| T19 rev. | Partial | `test_d9_*` with a fake conversion source: refusals, per-door request ids, real actor, nested / parallel config. Missing: concurrent runs, restart, permission change during a run, a fake HA with `context.user_id` / `parent_id` |
| T20 | Partial | ordinary lock unchanged; covers / switches / buttons not asserted |
| T21 | Partial | not in the door-path files; existing `test_intercom.py` (call / TTS on `access.release`) green in run 2 |
| T22 | Missing | no documentation / permission-name test |
| T23 | Covered | `test_d1_door_map_fill_order_and_refusals` (`wiskey_explicit` has no source yet) |
| T24 | Missing | D5a not built |
| T25 | Partial | `test_t25_*`: direct targets only; the M1 vectors are missing |
| T26 | Covered | `test_d3_grant_card_switches_users_groups_and_custom_roles` |

Totals: 11 covered (T2, T3 with the M3 / I9 gaps, T4, T9, T12, T15, T16, T17, T18, T23, T26), 10 partial (T1, T5, T6, T7, T11,
T14, T19, T20, T21, T25), 5 missing (T8, T10, T13 and T24 - the last two blocked by the unbuilt D10 / D5a - and T22).

## 7. Checked and found fine

Route permissions (every route added or changed):

| Route | Gate |
|---|---|
| `GET /intercom/door-map`, `PUT` / `DELETE /intercom/door-map/{id}`, `POST .../apply-suggestions` | `system.configure` @ installation first; PUT / POST need `confirmed: true`; audited |
| `PUT /intercom/stations/{id}/placement` | `system.configure`, confirmed, audited `intercom.station.placed`, revision bump |
| `GET /access/door-grants`, `POST /access/door-grants/subjects` | `rbac.roles.manage` @ installation, or delegated (`rbac.assign` + door_opener delegable) through `validate_binding` / `check_delegation` (no self, no own group, no deny); confirmed; audited |
| `PUT /access/door-grants/roles/{id}` | `rbac.roles.manage`; confirmed; built-in roles refused; delegable roles refused; stale revision refused; audited |
| `GET` / `PUT /doors/settings` | `system.configure`; confirmed; `on` / `allowed` refused while unavailable, audited as denied |
| `POST /doors/requests/{id}/status` | the open's own actor, else `system.configure`; signed mode only |
| `GET /intercom/door-path-inventory` | `system.configure`, read connection |
| `POST /intercom/stations/{id}/release` | door rule at station level before the body (`_door_gate_ro`), door rule for the relay after it |
| `POST /ha/entities/{id}/actions` (WisKey) | door rule inside `open_from_tile` (order: L2) |
| D8 / D9 hooks | existing automation / schedule gates plus the guards |

- D1: no name or `unique_id` use anywhere in the door code (grep); suggestions only for one entity per config entry and one relay;
  manual mapping checks WisKey platform, station and relay in the copy, the registry config entry and a free relay;
  `UNIQUE (config_entry_id, physical_index)`; a row stops resolving when the station / relay is gone or the registry entry differs;
  unmapped / invalid -> 409 `not_sent`, nothing sent.
- D2: 0077 rebuilds `bindings` with the same columns, rows and both indexes (the 0032 pattern; no later migration added to the
  table); the station chain is station -> (building -> site) -> installation; a deleted building / site drops out (fail closed); no
  floor / camera / entity chain contains a station; `rbac.assign` roles refused at station scope; screens never show the opaque id.
- D3: one function for the WisKey screen gate and route, the tile, D9 and the inventory's approver status (grep test); deny wins
  across both permissions on the CR's chains; identity = Ingress / remote (developer only in dev mode); inactive users refused;
  door_opener is not delegable by default; the card creates / revokes only its own bindings (`door_grant_bindings`) and terminates
  sessions on revoke; the role switch moves both revisions.
- D4: the flag is `on` only for exactly `on`, cannot be switched on in this release; a WisKey `lock.unlock` is diverted before the
  `execute` path in every mode; the DTO is validated locally (lengths, control characters, UUIDv4), nonce 32 hex, 30 s lifetime; the
  attempt row is committed before sending; `body_sha256` over the exact bytes; no signature, nonce, key or body in `audit_log`
  (tested); answers outside the closed set or naming another request are `unknown`; unknown holds the relay and is never re-signed;
  "sent" (confirmation `none`) never "opened" on the tile and the WisKey screen; `doors.*` never leaves in a backup; the generic
  `PATCH /settings` has no `doors.*` field.
- D6: `lock.lock` refused for WisKey locks for every caller, action lists drop it (`/ha/entities`), lock-all skips with "לא רלוונטי".
- D7: read-only (table counts unchanged in the test), administrator only, names only (no entity / station id in the reply); fail
  closed for templates, labels, unknown items, groups without members, WisKey buttons / device actions, depth.
- D9: the guard runs before the item's own rights and before the bridge; with no conversion source every door item is refused;
  schedules are judged on a fresh read from the component; converted runs re-check the door rule per door right before sending.
- Concurrency and replay: B1 dedupes `client_request_id` through the attempt rows under the write lock; the tile dedupes through
  `ha_actions`; both share the per-relay guard; a mapping change and an open serialize on SQLite's write lock.
- Frontend: no `unsafeHTML`, `innerHTML`, `href` or `location` sink in the new screens; names are text bindings; `can()` is
  installation-scope, so call / TTS buttons match the server.
- Personal model: `home.personal` overrides presentation only (no entities, no launcher items), so no personal door button can be
  added; the installation launcher runs through the judged routes.
- SQL: parameters everywhere; the two `LIKE` patterns use regex-validated ids.

## 8. Fix status (task SECWXDF, branch `pilot/SEC-WXD-fixes`, 2026-10-12)

Every medium and every low was fixed on `pilot/SEC-WXD-fixes` (based on `pilot/SEC-WXD-review` @ ae83636d; not rebased, not
part of release 2.4.8). The PoC file was renamed to `smplwise_vms/backend/tests/test_security_review_wxd_fixes.py`; each
fixed finding's proof was inverted into regression tests, and every one of them was run against the unfixed product code
(the fix's product files stashed) and FAILED there, then passed with the fix. No migration was added; no live door command
and no default-enabled behaviour was added (`doors.editor_block` stays `blocked`, `doors.trusted_path` stays unavailable).

| Finding | Commit | Fix | Regression tests (`test_security_review_wxd_fixes.py` unless stated) |
|---|---|---|---|
| M1 | e253c96c | `door_path_guard.check_config` / `check_schedule_payload`: a save is refused when the new content holds MORE of a door (lock entity, station, relay) or of an unresolvable reason than the stored content, as the shared D7 / D9 resolver sees it (lock groups, device actions, called scripts / automations / scenes, scene member states, templates); applied where a WisKey door exists. Called for create / replace / code save / copy / trash restore / version restore of automations, scripts, scenes (`automation_ops._raise_judgement`) and for schedule create / update / split / copy / trash restore. Scene capture expands lock groups; a scene member flipped to an open state is new. | `test_m1_typed_builder_refuses_a_new_door_step_through_a_lock_group`, `test_m1_scene_capture_refuses_a_lock_group_over_a_wiskey_lock`, `test_m1_code_mode_refuses_a_new_door_step_through_a_lock_group_or_a_device_action`, `test_m1_typed_builder_refuses_a_call_of_a_script_that_opens_the_door`, `test_m1_an_author_without_door_unlock_cannot_add_a_door_opening_through_a_script`, `test_m1_scene_member_flipped_from_locked_to_unlocked_is_a_new_step`, `test_m1_schedule_copy_split_and_restore_are_creates_for_the_editor_block`, `test_m1_schedule_guard_follows_a_called_script_and_keeps_existing_calls` |
| M2 | cf2ffa9e | Review option 2 (keeps CR-033 4.1 step 3 as written): `door_authority.placement_allowed` - placing or removing the anchor of a door entity (a WisKey lock or a door-map row) needs `door.unlock` for it on its CURRENT chain (installation, or a floor with its own anchor; unplaced: installation only) and no deny on any of its floors, or `rbac.roles.manage` at the installation. `routers/anchors.py` create / delete refuse with an audited 403 (`door_unlock_required`), an allowed create is audited with `door: true`, both bump the permission revision. The door.unlock ALLOW targets exclude a shared room's mirrored floors (a deny there still wins; the alarm's `own_placements` rule); plan circuits never carry a lock. | `test_m2_a_floor_editor_cannot_extend_floor_door_unlock_by_placing_a_wiskey_door`, `test_m2_who_may_place_and_remove_a_wiskey_door` |
| M3 | bc3da37e | `door_path.SCRIPT_BACKED_PLATFORMS = {template, universal}`: any service on such an entity (direct, area / device / floor / `all` targets, `homeassistant.*`, a template or label target where one exists in that domain, a scene member that sets one, an integration scene member) is unresolved `template_entity`; a template lock is unresolved for every lock service. `door_run_guard.judge_entity_action` judges EVERY tile / map card action. Bulk actions leave such entities out (`door_possible`, `device_bulk.SwitchPolicy`). All only where a WisKey door exists. | `test_m3_a_template_switch_wrapper_is_judged_as_a_possible_door`, `test_m3_every_template_domain_area_targets_and_scene_members_are_judged`, `test_m3_no_wiskey_door_means_template_entities_are_not_judged`, `test_m3_bulk_actions_leave_script_backed_entities_out_where_a_wiskey_door_exists` |
| L1 | fbb7ab0f | `door_authority.check` refuses `wall_account` (an enabled wall profile, or an active `kiosk` allow binding, direct or through a group) right after identity / active; the grant card hides such accounts and refuses to grant them (422 `wall_account`). | `test_l1_a_kiosk_account_is_refused_as_such`, `test_l1_an_enabled_wall_profile_is_a_wall_account` |
| L2 | fbb7ab0f | `routers/ha.py` `_door_gate`: for a WisKey lock's `lock.lock` / `lock.unlock` the one door rule is asked first at station level (the door map's station, else the registry's); without it a caller lacking control gets the same audited 403 as for any lock, one with control the door rule's 403; D6's refusal and the map / online answers come only after. | `test_l2_a_caller_without_any_permission_learns_nothing_about_a_wiskey_door` |
| L3 | f01e5f3f | Owner decision pending (a door-only permission). Safest default applied: the granting questions of the grant card (user / group switch, custom-role switch) name everything the permission also allows (`GRANT_ALSO`: calls, announcements, entry log, people directory). No role or permission changed. | `frontend/tests/unit-door-settings.spec.ts` (built-in roles test) |
| L4 | fbb7ab0f | Station scope accepts ALLOW bindings only for roles within `rbac.STATION_PERMISSIONS = {access.read, access.release}` (`routers/access.py` `check_delegation`, 422 `scope_not_allowed_for_role`); `permissions_anywhere` counts nothing else from a station binding (a custom role edited later, a restored / older binding). Deny bindings at station scope stay possible. | `test_l4_a_station_scope_binding_carries_door_permissions_only` |
| L5 | fbb7ab0f | `access_control.open_door` refuses (503 `intercom_unavailable`, `not_sent`) without a WisKey copy in signed mode, and in interim mode when the feed is up but the copy is not there yet (otherwise the interim transport refuses on its own with the feed's state, as before). | `test_l5_no_wiskey_copy_means_nothing_is_sent_in_any_mode` |
| L6 | bc3da37e | `door_path.Resolver.resolve_entity_item`: an integration scene (mirror row, `config_json` NULL) is judged by its members (`_scene_by_members`) like a scene without a row - not `unreadable_item`. | `test_l6_an_integration_scene_is_judged_by_its_members` |

Not fixed here, with the reason:

- M1 item 4 (CR-017: require `door.unlock` for lock steps reached through a called script or scene, for EVERY lock) - a
  pre-existing gap of the CR-017 rights for ordinary locks, outside the CR-033 door path. For WisKey doors it is closed by
  the editor block above (refused for everyone while `blocked`). Needs its own change in `services/automation_scope.py`
  (`grant_reasons` over the resolver's expansion) and its own tests; left for a separate task.
- M1 item 2's `set_enabled` / schedule `bulk` enable (I5) - informational in this review: enabling does not add a door step,
  and the D10 "disable and list" run does not exist yet. To be decided with D10a.
- L3's door-only permission (`access.door_open`) - an owner decision (permission catalogue, roles.json, migration of
  existing grants); only the disclosure was done.
- Informational I3, I4, I6-I13 - unchanged (informational; I8 / I7 must be closed before `doors.trusted_path` can be on).
- `test_poc_i3_a_deny_written_on_the_other_chain_does_not_stop_either_permission` stays a `test_poc_*`: it documents CR-033
  4.1 step 2 as written (chain-specific deny), deliberately unchanged.

Behaviour changes the integrator should know (all only where a WisKey door exists, except L1 / L4 / M2's shared-room rule):
the editors refuse new indirect door steps (M1); tile presses, Arx-started runs and bulk actions refuse / leave out template
and universal entities (M3 - an availability cost for installations with many template entities; a future "this virtual
entity is not a door" administrator attestation would be an owner decision); placing a WisKey lock on a map needs door.unlock
or role administration (M2); kiosk / wall accounts never open doors (L1); station-scope allow bindings are door roles only
(L4).

Behaviour of the editor block for script-backed entities (5751322a): when a save adds only steps on template / universal
entities, the refusal says so (`details.reason = possible_door`, its own Hebrew text) instead of the door-step text.

Runs for the fixes:

| # | Where | Commit | What | Result |
|---|---|---|---|---|
| 1 | workstation (one pytest process at a time) | each fix | the finding's regression tests with the fix's product files stashed | every regression test FAILED on the unfixed code (M1 8/8, M3 + L6 5/5, M2 2/2, L1 L2 L4 L5 5/5) |
| 2 | workstation | fbb7ab0f | regression file + `test_wiskey_d6_d8` / `_door_inventory` / `_door_path` + `test_kiosk_role` | 69 passed |
| 3 | workstation | fbb7ab0f | `test_intercom` + `test_rbac` / `_camera_scope` / `_groups` / `_matrix` | 303 passed |
| 4 | workstation | various | `test_devices`, `test_ha`, `test_ha_authority`, `test_shared_spaces`, `test_access`, `test_custom_roles`, `test_automations_extra`, `test_anchor_3d` | all passed |
| 5 | runner, 4 parallel shards (`run_smart.py backend`) | f01e5f3f | 76 related files (the review's run-2 set plus anchors, plans, presence, plan catalogue, shared spaces, wall, media bulk, home screen) | 1697 passed, 6 errors / failures all `sqlite3.OperationalError: unable to open database file` at setup (four shards in one runner worktree during the release gate) in `test_access` (3), `test_anchor_3d` (2), `test_automations_extra` (1) - those three files re-run on the workstation: all passed |
| 6 | runner `tsc` | f01e5f3f | frontend type check | tsc ok |
| 7 | runner `spec --project=desktop` | f01e5f3f | `unit-door-settings.spec.ts`, `unit-door-path.spec.ts` | 11 passed |
| 8 | workstation | 5751322a | regression file (23) + `test_wiskey_d6_d8` / `_door_inventory` / `_door_path` | 69 passed |

NOT_RUN: the full backend suite, fixture / visual / pixel jobs, browser evidence specs, anything against a real Home Assistant,
bridge, WisKey or door.

## 9. Suggested order before integration

1. I1: decide the integration mechanics (revert `9065a130` or re-apply wave 1 as new commits) and the final migration numbers (I2),
   with a schema check of any persistent database that ran `integ/245` between 4ac95afb and 9065a130.
2. Fix M1 (one resolver for D7 / D8 / D9; the three schedule paths), M3 (template entities, every tile action judged) and L6 (the
   integration-scene branch) - they are the same resolver work - and M2 (door.unlock chain or a placement rule).
3. L1 and L2 (small, in `door_authority.check` / `open_from_tile`); L4 (station-scope role filter).
4. Owner decision on L3 (a door-only permission, or the full text in the switch).
5. Tests: T8 (restart), T10, T22, the T6 gaps, T25 for every M1 vector, T12 / T19 for M3; then the gate run of T1..T26 (D11).
   L5, I7 and I8 must be closed before `doors.trusted_path` can be switched on (D5b).
