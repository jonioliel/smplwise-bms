# WXD10-DOOR-JOBS-2400 - CR-033 D10a / D10b: disable and list, Arx event door jobs (M1), hold-open hand-over (M3)

Branch `pilot/WXD10-DOOR-JOBS-2400` from `origin/release/2400-train` @ `8e3ac8398`. Target 2.40.0 or later. Task cards
`management/tasks/WXD10A.md` ("Arx event door jobs (M1), disable-and-list") and `WXD10B.md` ("Hold-open program hand-over (M3)").
Sources: `docs/changes/CR-033-WISKEY-DOOR-PATH.md` sections 6.1-6.4, 9, 10, 11.3 (T13), `WISKEY-CR033-CR034-IMPLEMENTATION-PLAN.md`
(on `origin/pilot/WISKEY-CRs`, slices D10a / D10b), `CR-AUTODOORS-295.md` (the Arx door job = a door automation block),
`CR-039-DOOR-WINDOWS-AND-EMERGENCY.md` (the hold-open program = a weekly door window), `CR-033-INTEGRATION-NOTES.md`.

**Built and tested on fakes and fixtures only.** Nothing in this work contacted the lab, Home Assistant, WisKey, a station, the
NVR, a door, a lock or a relay; no key or secret was read. No version file, CHANGELOG, tag or merge.

## 1. Why now, and the empty case

The WXD7R inventory of 2026-11-04 (`private/planning/WXD7R_INVENTORY_2026-11-04_HE.md`) found **0** saved items that open a
WisKey door. The owner decided the same day to build both slices anyway. So the empty inventory is the normal case:
`GET /intercom/door-path-conversion` answers `state = "nothing_found"` (or `"no_wiskey"` without any WisKey door), every count 0,
nothing offered, and any action names an item that is not listed -> `404 not_listed` (audited). Tested first
(`test_wxd10_no_wiskey_and_nothing_found_are_answered_cleanly`).

## 2. What was built

### 2.1 WXD10A - disable and list + Arx event door jobs (M1)

`services/door_conversion.py` over the D7 inventory (`services/door_path.inventory`, unchanged):

| Category (per item) | What may be offered |
|---|---|
| `event_automation` (an automation) | `disable`; `convert_event_job` when its door steps are DIRECT steps of the automation itself |
| `schedule` | `disable`; `hand_over_program` (2.2) |
| `script`, `scene`, `launcher` | nothing - they never run on their own; the run guard (D9) already refuses an Arx-started run |
| `unknown` (a step that cannot be resolved) | `disable` only (manual review) |
| any item made outside Arx (`external`) | nothing - CR-033 6.4 / T16, never touched |

- **disable**: only an AUTONOMOUS item (an enabled automation or schedule) with a door step or a possible one. Done through the
  EXISTING write paths (`automation_ops.set_enabled`, `schedule_ops.set_enabled`) with all of their gates - the rights, the
  feature switches, the bridge state, the schedule rule that switching a lock schedule needs `door.unlock` on that lock (tested:
  without it the action is refused `403 grant_required` and nothing is created). The item's content is not changed.
- **convert_event_job (M1)**: allowed only when every door step is a direct step (not inside a called script / scene / lock
  group), resolves to a mapped door, and - for `lock.unlock` / `lock.open` - targets WisKey doors only (a step that also unlocks
  an ordinary lock is `mixed_target`); a branch left empty (`empty_branch`) or an automation left with no step at all
  (`empty_actions`, disable it instead) is refused. The stripped configuration is re-resolved with a fresh resolver and refused
  if any door step remains. Order: every check first (including the door job's own create rules: `access.doors.automate`,
  `automation.manage` reach, the doors present in the WisKey copy, one job per automation), then the Home Assistant write
  (`automation_ops.update_code`, the existing code-mode write; removing a door step is always allowed by the editor block), then
  the Arx door job: a CR-AUTODOORS-295 block in state **`draft`** with the item's doors. A draft opens nothing: a person arms it
  later (its arming checks, loop protection, limits), and `doors.automation_open` stays `off`.
- The run guard's `ConversionSource` (`door_run_guard.CONVERSIONS`) is deliberately **not** installed: a converted automation no
  longer has a door step in Home Assistant, so an Arx-started run is unchanged, and its door is opened only by the door job on
  `automation_triggered` (CR-AUTODOORS-295). Installing it as well would open the door twice.

### 2.2 WXD10B - hold-open program hand-over (M3)

- **hand_over_program**: a RECURRING fixed schedule (`repeat_type = repeat`, no start / end date, no slot conditions, every slot
  with a fixed start AND end time, every action a direct door step) -> a draft **weekly door window** (CR-039 `door_window_rules`,
  kind `weekly`, calendar policy `ignore_calendar`, the same weekdays - `workday` = Sunday..Thursday, `weekend` = Friday/Saturday -
  and hours, the same doors). The window's own rules decide too: maximum length, quiet hours, per-day count, overlap, exterior
  doors (each refusal is a reason in the list: `window_too_long`, `quiet_hours`, ...). A slot without an end time (`no_end_time`)
  or with other actions (`mixed_schedule`) is not handed over - disable it instead.
- Order: every check first (the window rules, the person rule and `access.windows.manage` on every door), then the schedule is
  switched off through the existing write path, then the draft window is saved (Arx's own tables only). **Nothing is written to
  WisKey**: a window reaches WisKey only after a person enables it on the door windows screen, with `doors.windows.enabled` on and
  the engine's own checks (DOORWRITE-297). The CR's external gate "WisKey offers program creation for an Arx operator" is met by
  that existing path; this slice does not call it.

### 2.3 Common rules (both cards)

- Switch **`doors.conversion`**: `off` (default) / `on`, through `PUT /doors/settings` (system administrator, `confirmed: true`,
  audited `settings.changed`). A `doors.*` setting: never exported or restored by a backup. While off, the list is readable and
  every action and undo is refused `409 door_conversion_off` (audited).
- Every action: system administrator (`system.configure`), explicit `confirmed: true` from the client, the item must be listed
  with that action offered, `revision` must equal its live revision (`409 stale_revision`), and no earlier action on it may still
  be in force (`409 already_handled`). Audit: `door.path_disabled` / `door.path_converted` / `door.path_handed_over` (allowed and
  denied rows, the refusal code as reason); `door.path_restored` for undo.
- **Reversible** (`POST /intercom/door-path-conversion/records/{id}/undo`, same switch / administrator / confirmation / audit):
  - a disable: the item is enabled again through the existing write path, only while its live revision equals the one recorded
    right after the disable (`409 stale_revision` otherwise). This is the ONE place the enable refusal of review I5 is lifted:
    `door_run_guard.restore_pass(kind, item_id)` - a context variable for that one item, for that one call (grep test pins the
    single caller). Every other enable of a door item stays refused (tested right after an undo).
  - a hand-over: refused while the created window is `enabled` (`409 program_in_use`: pause it first); otherwise the schedule is
    enabled again and the draft / paused window is retired.
  - a conversion: the door job is deleted (disarmed first if armed - the safe direction). **The removed Home Assistant steps are
    NOT put back by Arx** (adding a door step is what the editor block refuses); they are kept in the register row
    (`removed_steps_json`) and in the automation's version history. See owner question 2.
- Never: a door, lock, relay, station or WisKey command; a retry or queue; an item made outside Arx. A test pins that the module
  names none of the door senders, and every test world fails if `execute`, `open_door` or a WisKey action is reached.

## 3. Routes (router `routers/doors.py`, tag `access-control`)

| Route | Gate |
|---|---|
| `GET /api/v1/intercom/door-path-conversion` | `system.configure`, read only (names only, like the inventory) |
| `POST /api/v1/intercom/door-path-conversion/actions` `{key, action, revision, confirmed}` | `system.configure`, switch on, confirmed, audited |
| `POST /api/v1/intercom/door-path-conversion/records/{record_id}/undo` `{confirmed}` | `system.configure`, switch on, confirmed, audited |
| `PUT /api/v1/doors/settings` gains `conversion: off\|on`; `GET` returns it | unchanged gate |

New codes: 409 `door_conversion_off`, `already_handled`, `stale_revision`, `action_not_offered` (`details.reason`), `already_undone`,
`program_in_use`, `item_gone`; 404 `not_listed`. Refusals of the underlying write paths come through unchanged (e.g. 403
`grant_required`, `code_view_required`). `contracts/API_INVENTORY.md` regenerated (1837 -> 1840 routes).

Frontend: API types and calls in `frontend/src/api/doors.ts` and pure helpers in `frontend/src/screens/system-doors-logic.ts`
(summary with the empty cases, one confirmation question per action, register line). **No screen was built** (no local browser
runs were allowed for this task; a UI slice needs its desktop / mobile / RTL screenshots) - see section 7.

## 4. Migration

**0205** `0205_door_path_conversions.sql` - the register (one row per successful action: item key / kind / id / name, action,
state `done|undone`, the item's state and revisions before / after, the created door job id or window rule id, the removed steps,
the door keys, who / when, who / when undone). A partial unique index allows one action in force per item. Additive; not a backup
table; rollback = drop the table.

**Number:** the 2.40.0 train ends at 0203; 0204 is reserved for another branch of the same train (the wall setting). This branch
therefore takes **0205**, and `scripts/release_check.py` reports "migrations contiguous" as FAILED on this branch alone until 0204
is merged (see section 5). If 0204 does not land first, renumber this file to 0204 at integration (only the file name and the
header comment name the number; the test reads the file by name - update `test_wxd10_switch_defaults_off_and_is_never_carried_by_a_backup`).

## 5. Tests (all on fakes)

Backend, `smplwise_vms/backend/tests/test_wxd10_door_jobs.py` - 13 tests:

| Test | Proves |
|---|---|
| `test_wxd10_no_wiskey_and_nothing_found_are_answered_cleanly` | the WXD7R result (0 items): `no_wiskey`, `nothing_found`, zero counts, `404 not_listed` audited, no bridge op |
| `test_wxd10_list_categories_and_offers_per_kind` | synthetic event automation (convertible), automation via a called script, computed target (`unknown`), door-only automation (`empty_actions`), external automation (T16), script (`list_only`); Hebrew reasons; no entity id in the answer |
| `test_wxd10_every_action_is_refused_while_off_unconfirmed_stale_or_not_offered` | switch off, no confirmation, stale revision, action not offered, non-administrator 403; denied audit rows; nothing written |
| `test_wxd10a_disable_and_list_then_undo_restores_exactly_that_item` | disable through the existing path, listed + handled, `already_handled`, the ordinary enable still refused, undo re-enables, `already_undone`, the restore pass does not outlive its call |
| `test_wxd10a_undo_is_refused_when_the_item_changed_since` | a changed item is not re-armed by undo |
| `test_wxd10a_convert_event_automation_to_a_draft_arx_door_job` | the door step leaves Home Assistant, the light step and the enabled state stay, a DRAFT door job with the door, register + audit; undo deletes the job, the step is not restored |
| `test_wxd10a_strip_door_steps_nested_mixed_and_area_targets` | removal inside choose / if-else / parallel; `mixed_target`; `empty_branch`; a disabled step is left alone |
| `test_wxd10b_schedule_offers` | recurring workday 07:00-09:00 door schedule offered with its program; `mixed_schedule`; `no_end_time`; template switch = `unknown` |
| `test_wxd10b_hand_over_creates_a_draft_window_and_undo_puts_the_schedule_back` | the schedule path's own `grant_required` gate first (nothing created), then: schedule off, draft weekly window with 5 periods and the door, no occurrence planned; undo refused while the window is enabled, then retires it and re-enables the schedule; the ordinary enable still refused |
| `test_wxd10b_disable_the_unknown_schedule_and_hand_over_refusals` | disable of an unresolvable schedule; a mixed schedule is not handed over |
| `test_wxd10b_program_plan_reasons` | `window_too_long`, `quiet_hours` from the window settings; a station gone from the WisKey copy -> `unresolvable` (fail closed) |
| `test_wxd10_the_restore_pass_has_one_caller_and_the_module_sends_no_door_command` | static pins |
| `test_wxd10_switch_defaults_off_and_is_never_carried_by_a_backup` | `doors.` prefix kept out of backups; the register is not a backup table |

`test_wiskey_door_gate.py`: row **T13** now names four of these tests and is removed from `OPEN` (T19 and T24 stay OPEN).

Frontend unit spec `frontend/tests/unit-door-conversion-wxd10.spec.ts` - 4 tests (Node only).

Results: see the closing report of this task (commands and counts); `release_check` is expected to fail only on "migrations
contiguous" (section 4).

## 6. Not done / limits

- No Settings screen for the list (API and pure helpers only). UI slice with screenshots is a follow-up.
- An automation whose door opens through a called script, scene or lock group is not converted (only disabled): the door step
  lives in another item, which may be shared. The called script itself is listed (`script`, list only).
- Momentary door steps in a schedule (a start time without an end) are not turned into hold-open windows: a pulse is not a hold.
- `management/tasks.json` was not edited (the registry rule keeps WXD10A / WXD10B BACKLOG while WXD9 / WXD7R are BACKLOG; the lead
  updates the registry).
- The live inventory read on the installation stays the owner-approved WXD7R step; nothing here reads or writes the lab.

## 7. Questions for the owner

1. Undo of a disable re-arms an item that opens a door by itself in Home Assistant (that is what "reversible" means).
   a. keep it for the system administrator, confirmed and audited (as built);
   b. also require the editor block to be `allowed`;
   c. no undo of a disable at all (re-enable only from Home Assistant's own screen).
2. Undo of a conversion deletes the Arx door job but does not put the door step back into the Home Assistant automation.
   a. acceptable (as built; the step is in the register and the version history);
   b. also restore the step (a second, narrow exception to the editor block).
3. A Settings screen for this list:
   a. later, while the inventory is empty (API only, as built);
   b. now, as a UI slice with desktop / mobile / RTL screenshots.
