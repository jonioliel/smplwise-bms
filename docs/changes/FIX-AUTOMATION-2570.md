# FIX-AUTOMATION-2570 - automation / scene / schedule findings of the second deep review (2.57)

Base: v2.56.0 (release/2570-train, 6ea807b2e). Review: docs/review/DEEP-REVIEW-2570-CORE-DATA-RELEASE.md
(branch review/DEEP2-2570-CORE-DATA-RELEASE). Backend only; the frontend confirmation for sensitive scenes is FIX-FE2-2570.

## CD2-02 (high) - a scene's sensitive members are judged as their manual action

Every finding line re-verified at the base before the fix (`facts_of` made a step for `lock.*` members only; `control_reasons`
skips `alarm_control_panel.*`; the device route checked control of the scene entity only).

- `automation_scope.scene_member_step`: a scene member that is an alarm panel, a lock, a siren or a door-class cover is a
  sensitive step, exactly as the same manual action:
  - panel: the arm mode its state names (`armed_home|away|night|vacation|custom_bypass`) needs `alarm.arm`; `disarmed` - and any
    state that names neither (triggered, pending, unknown, a member whose state is not known) - is judged as a disarm and needs
    `alarm.disarm` (own scope, as manual control) and the remote channel's alarm rule (`_remote_block`);
  - lock: `lock.lock` (control) / `lock.unlock` (`door.unlock`);
  - siren, door-class cover: control of the member.
  The scene's `sensitive` / `sensitive_classes` follow (all classes, no longer `["lock"]` only). A native scene without a readable
  config gets the same steps from its state's member list (strictest action). An integration scene that lists members is
  checked for its sensitive members too.
- Scenes route `POST /automations/scene/{id}/apply`: unchanged contract, now applied to these scenes:
  - missing grant -> **403 `grant_required`** (`details: {entity_id, grant, path: "members"}`), or 403 `entity_not_controllable`,
    or the remote channel's alarm code; audited (`automation.run` denied, reason = the code);
  - no confirmation -> **409 `confirmation_required`**; the request field is **`confirm: true`** (body `{client_request_id,
    confirm}`) - byte-for-byte the scripts path (`POST /automations/script/{id}/run`). The list / detail item already carries
    `sensitive: true` and `sensitive_classes` (e.g. `["alarm"]`) so a client can ask before the first press;
  - then the step-up proof of the member's manual action (`step_up.guard_action`: `alarm.disarm` for a disarm, `alarm.bypass`
    for a bypass arming, `door.open` for an unlock) -> 403 `step_up_required` (only when the administrator turned step-up on;
    the client's global step-up dialog handles it); nothing is recorded or sent before it.
- Device route `POST /ha/entities/{scene}/actions` with `scene.turn_on` (tiles, map cards): `_scene_member_gate` runs the same
  member rules (`automation_scope.scene_member_reasons`) right after the other refusals, before anything is recorded or sent:
  audited 403 (`ha.action` denied, `details.member`, `details.grant`). Its confirmation stays the route's own
  (`confirmation_grant: "confirmed"`, required for every scene); the member step-up follows the confirmation.
- Schedules that run a scene judge it through the same `run_reasons`, so they inherit the member grants.
- No retry, no queue; an unknown outcome stays unknown (the send paths are unchanged).

## VD2-01 (high, review DEEP-REVIEW-2570-VIDEO-DEVICES) - a scene whose definition cannot be read fails closed

- A native scene with no readable config (a YAML / package scene, a scene without id, any scene read while the config API was
  down) whose state lists its members: each sensitive member gets its strictest step (CD2-02 above: a lock = unlock ->
  `door.unlock`, a panel = disarm -> `alarm.disarm`), so the grant, the confirmation and the step-up apply.
- When even the member list is missing and the scene is not a device integration's own (platform `homeassistant`, or one the
  mirror could not classify): `unknown_effects`. Chosen rule (safer of the two offered): the confirmation (`confirm: true`) AND
  the strongest rights - `ha.entity.control`, `door.unlock` and `alarm.disarm` all installation-wide - else **403 `forbidden`
  with `details.reason = "scene_members_unknown"`** (audited); the step-up of a disarm and of a door opening is asked. Refusing
  outright would also block the installation administrator from his own YAML scenes; this keeps them usable for exactly the
  people who could do every member's action by hand anyway. Integration scenes (Hue etc.) are unchanged (control of the scene).
- The device route's `scene.turn_on` applies the same rule.

## VD2-03 (medium, review DEEP-REVIEW-2570-VIDEO-DEVICES) - "may have run" is unknown and keeps the run gap

`automation_ops.bridge_call` for the run ops (`trigger`, `run_script`, `apply_scene`): a 504 `config_timeout`, a transport error
after the connection was made (`ha_unavailable` whose `details.error` is not `ConnectError` / `ConnectTimeout` / `PoolTimeout`) and
a bridge `ok: false` naming an exception class (the service raised after it started) record the op `unknown` (never `failed`) and
answer **504 `config_timeout`** (the code the automations client already reads as "may have happened"), `retryable: false`,
`details: {outcome: "unknown", error}`. The `audited` wrapper writes such a call as `allowed` with `outcome: unknown` (it is not a
refusal). The per-item run gap (`run_interval_s`, `scene_apply_interval_s`) is kept after an unknown outcome, so an immediate
re-press answers 429 `run_too_soon` instead of running twice; a policy refusal (lower-case bridge code) or a connect error stays
`failed` and gives the gap back. A 504 on a write op is audited `allowed / unknown` too (it already recorded the op `unknown`).
New text (he + en in `error_text_en.json`): the "not known whether it ran" message.

## CD2-04 (medium) - copy / restore never go live on their own

`copy_item` and `restore_trash` write the new automation DISABLED (the same disable step create uses for `enabled: false`; a
failed disable is the existing `not_disabled` warning). It goes live only through the enable route (its confirmation for a risky
item, the door guard, the review). A self-triggering automation is copied / restored in single-run mode (`mode: single`, no
`max`), as create and update write it. Scripts and scenes: unchanged (they do not run by themselves).

## CD2-05 (medium) - a `pending` op is settled

`automations.PENDING_EXPIRE_S` = 600 s (schedules: the same value). The automations and schedules janitors settle an op still
`pending` past it as `unknown` (never `failed`, never `ok`; nothing re-sent; a schedule op keeps what it sent so a late adoption
can still claim it), logged as a warning. The "is this Arx's own write?" checks (`_arx_create_in_flight`, `_recent_arx_op`, both
services) no longer count a pending op older than that, so the "changed outside Arx" audit resumes. A retry with the same key
then answers `unknown` instead of `op_pending` for ever.

## CD2-07 (medium) - trace calls outside the write lock

`automation_runs`: `trace/list` (runs list), `trace/get` (run detail) and the prefetch `trace/get` calls (runs list and the
mirror's `check_item`) run inside `db.unlocked(conn)`, so no Home Assistant round trip holds the single write lock.

## Schedule lows (re-verified at the base)

- CD2-11: copy / split / restore of a disabled schedule - a failed disable is audited (`schedule.disable` denied) and returned as
  the `not_disabled` warning (existing texts); split's `keep_disabled` warning of the original is no longer dropped.
  NOT done: creating disabled in the `add` itself (the component's payload support is unverified).
- CD2-16: a folder sent without a position keeps its list index (was a 500); a manager scoped to part of the installation no
  longer removes a folder that holds schedules they cannot see (installation-wide managers unchanged).
- CD2-19: the run-now gap is taken after the "no switch" and slot-time refusals, so a refused run never blocks the next one.

Not in this row (not in the automation / schedule services): CD2-12, CD2-13, CD2-17 (`notify_email.py`), CD2-18
(`access_external.py`); CD2-15 (`insights_delivery.py`).

## Tests

`tests/test_fix_automation_2570.py` (runner, slot B). Results: see the report section below.
