# FIX-AUTOMATION2-2570 - runs judged for what the items they call reach; step-up for runs; "turn on now" after copy / restore (2.57)

Base: origin/pilot/FIX-AUTOMATION-2570 (0a95b58dd; its change note docs/changes/FIX-AUTOMATION-2570.md). The gaps that row reported,
owner decision: fix in 2.57.

## 1. A run is judged for the scenes, scripts and automations it calls (transitively)

Before: an automation's "run now" / "test" and a script's run checked the grants of the item's OWN typed steps only
(`automation_scope.facts_of` expands a called scene / script into its device targets, never into its sensitive steps), so an automation
or script that runs a scene / script which disarms an alarm panel or unlocks a lock ran without `alarm.disarm` / `door.unlock`, without
the confirmation and without the step-up.

Now (`automation_scope.run_closure`, `closure_reasons`; `automation_ops.run_automation` / `run_script`):

- Every call that runs content - `scene.turn_on`, `script.turn_on` or a script's own service (`script.<key>`), `automation.trigger` - is
  resolved from the mirror, transitively (depth `EFFECT_DEPTH` = 3), cycle-safe (an item met before on the same run is not walked
  again). `script.turn_off`, `automation.turn_on` / `turn_off` run nothing and are not walked (controlling another automation keeps its
  own rule, `ref_reasons`).
- A called scene's sensitive members are judged exactly as FIX-AUTOMATION-2570 judges them (`scene_sensitive_steps`, shared with
  `scene_member_reasons`, behaviour unchanged): arm mode -> `alarm.arm`, disarm / unknown state -> `alarm.disarm` (own scope) and the
  remote channel's alarm rule, lock -> control / `door.unlock`, siren / door-class cover -> control. A called script / automation adds
  its own sensitive typed steps and is walked further.
- Refusal: 403 `grant_required` (`details: {entity_id, grant, path: "calls"}`), 403 `entity_not_controllable` or the remote channel's
  alarm code; audited (`automation.run` denied, reason = the code; `details.nested_entities` / `nested_classes` / `nested_unknown`
  name what the calls reach). Nothing is recorded or sent.
- Confirmation: a run that reaches a sensitive step through a call (or a locked sensitive block inside a called item) asks
  **409 `confirmation_required`** until `confirm: true`, as the item's own sensitive steps already did.
- Fail closed (the VD2-01 `scene_members_unknown` rule): a called item whose content cannot be read - not in the mirror, no / an
  unparseable config, a scene known neither by its config nor by its member list (not an integration's own), a chain deeper than the
  depth - needs the confirmation AND `ha.entity.control`,
  `door.unlock` and `alarm.disarm` installation-wide, else **403 `forbidden`, `details.reason = "scene_members_unknown"`** (audited);
  the step-up of a disarm and of a door opening is asked. (An integration scene without a member list stays as before: control of it.)
- NOT changed (open question for the owner): the item ITSELF without a readable config - a YAML / package script, or any script while
  the automations mirror is off - keeps its route's earlier rule (automations screen: `script.run` installation-wide for unknown
  effects; tile: control of the script entity). Failing it closed was tried and refused the bootstrap administrator's tile of a script the
  mirror does not hold (`test_devices::test_devices_control_never_reaches_...`): with the automations feature off every script tile
  would need `door.unlock` + `alarm.disarm` installation-wide.
- The device route `POST /ha/entities/{script}/actions` with `script.turn_on` (a tile / a map card): `_scene_member_gate` now judges a
  script too (`automation_scope.item_closure_reasons`): its own sensitive steps (before: control of the script entity only) and
  everything it reaches, same codes, audited `ha.action` denied with `details.member` / `details.grant`; the step-up follows the route's
  own confirmation (`confirmation_grant: "confirmed"`).

## 2. The step-up for runs

`automation_ops.run_step_up`: a human-started run of an automation / script that disarms an alarm panel (`alarm.disarm`), arms it with
the bypass set (`alarm.bypass`) or unlocks a lock (`door.open`) - itself or through any call - asks the same fresh step-up proof as the
manual action and as a scene (`SCENE_STEP_UP`), after the grants and the confirmation, before anything is recorded or sent (403
`step_up_required`; only when the administrator turned step-up on - the client's global step-up dialog handles it). Same on the device
route's `script.turn_on`. A converted WisKey door item keeps its own door step-up (`_door_plan`).

## What applies to saving / enabling (unchanged, documented)

Saving and enabling an automation that will later run sensitive actions unattended keeps the existing rules:
- save (create / update / code / version restore): the manage right at every target (a called scene's / script's device targets
  included), control and the grants of the item's own sensitive typed steps, `ref_reasons`, and the confirmation for unknown effects or a
  self-trigger;
- enable (`set_enabled`): `run_reasons` (the same rights as above), the door guard (`judge_enable_item`: no autonomous WisKey door
  opener is re-armed), and the confirmation for a risky item (its own sensitive / unknown / non-routine steps);
- copy / restore write an automation disabled (CD2-04); it goes live only through the enable route.
The new transitive grants, the closure confirmation and the step-up apply to human-started runs only: a run Home Assistant starts on its
own (a trigger, the scheduler) is not an Arx request and is never gated (`step_up.guard_action` outside a request; DR-7).
Not changed: the list / detail item's `sensitive` / `sensitive_classes` and `can.run` still describe the item's own steps (computing
the closure for every listed item would read every called config per list request); the run route's 409 makes the client ask, and a
refusal names the grant. The schedules' "run now" of a script (`schedule_view.item_run_reasons`) is not in this row.

## 3. Frontend: "turn on now" after a copy / restore

- `automations-logic.offersEnableNow(item)`: an automation in state `off` that the caller may toggle.
- After a copy (drawer, open on the copy) and after a restore from the trash (drawer, trash view): a banner in the drawer
  "<name> כבוי עד שתפעילו אותו." with **"הפעל עכשיו" / "Turn on now"** (`automation-drawer.enableNow`): the list switch's route
  (`toggleAutomation`) - its own "להפעיל?" dialog first for an item with unknown effects, or when the server answers 409
  `confirmation_required`, then `confirm: true`; never a retry. The toast says the item is off. (A first version put the button in the
  toast: under the modal drawer it cannot be pressed - the page test caught it.)
- After the delete toast's undo (the drawer is closed then): the toast offers the same button, which runs the list switch's own
  `toggle(item, true)` with its dialog.
- Texts (he + en; the module has no ar / ru): `שוכפל. העותק כבוי עד שתפעילו אותו.`, `"{name}" שוחזר. הוא כבוי עד שתפעילו אותו.`,
  `"{name}" כבוי עד שתפעילו אותו.`, `הפעל עכשיו`.
- The demo store (`api/automations-mock.ts`) writes a copied / restored automation disabled, as the server does.
- Styles: the existing `.banner info` and `.btn sm` (no new token or CSS). Compare page:
  private/planning/fix_automation2_2570_compare_2026-11-28.html.

## Tests

See the table below (runner, slot B).
