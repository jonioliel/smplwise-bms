# External schedules probe (CR-014), 2026-10-01

Question from the owner: the Home Assistant systems have schedules created in the Home Assistant interface. Can the Arx schedules
editor edit them? The editor treats a schedule it did not create as "external": editable when it is fully understood, read-only with a
reason otherwise. This probe measures, on two real systems, how many external schedules fall on each side and why.

The two systems are called **H** and **V** here. No host, name, entity id, tag or token appears in this document.

## Method

- Read-only. The script sent only `auth`, `scheduler`, `get_states`, `config/entity_registry/list`, `manifest/get` and `schedule/list`
  over the WebSocket API. No service call, no write, no reload, no state change. A message-type allow-list in the script refuses
  anything else before it is sent.
- Source of schedules: the `scheduler` custom integration (`scheduler` WS command, all items, whoever created them) and the built-in
  `schedule` helpers (`schedule/list` plus `schedule.*` states).
- Classification: the same code path the backend uses to decide `read_only`, imported unchanged from `schedule_model.py`
  (`normalize`, `classify`) and `schedule_policy.py` (`classify_entity`, `service_allowed`, `check_arguments`, `contains_code`,
  `is_scheduler_entity`). For schedules judged "understood", the draft the editor would open was built and run through
  `validate_draft` (unchanged save) to see whether the editor could also save them. Sub-reasons of `unsupported_content` are
  derived from the same decision tree, split finer than `classify` does (it reports `action_not_allowed` for several causes).
- The entity resolver Arx normally gets from its mirror (`ha_entities`) was rebuilt from `get_states` plus the entity registry
  (platform, device class, state, attributes). Assumptions: the caller is an administrator (no `no_manage_permission`,
  `sensitive_permission_required`, `grant_required`); every schedule class is enabled (the default, so no `class_disabled`); the
  write path is available; the alarm panel check passes; no cover is on the door layer; no alarm-managed or media-managed switch.
- Two scenarios, because the one thing Arx knows that Home Assistant does not is the per-switch "safe for group action" mark
  (`device_bulk_safe`): **A** = no switch marked (a fresh install), **B** = every switch marked.
- Not measured: whether a schedule was created by Arx or outside it (Arx was not queried), the Arx-side permissions of real users,
  the alarm panel code needs, and the scheduler component version (`manifest/get` returned no version on either system; the
  `scheduler` command itself worked on both). Home Assistant version on both: 2026.9.4.

## Results

| | H | V |
|---|---|---|
| Scheduler schedules (total) | 23 | 21 |
| enabled / disabled | 18 / 5 | 18 / 3 |
| Built-in `schedule` helpers | 0 | 0 |
| Editable, scenario A (no switch marked) | 11 | 7 |
| Read-only, scenario A | 12 | 14 |
| Editable, scenario B (all switches marked) | 21 | 17 |
| Read-only, scenario B | 2 | 4 |
| Editable ones whose unchanged save fails validation | 0 | 0 |

Read-only reasons (all are `unsupported_content`; a schedule can carry several, here every schedule has exactly one):

| Sub-reason | H | V | Meaning |
|---|---|---|---|
| `switch_not_marked` | 10 | 10 | the action targets a `switch.*` entity that is not marked safe for group action |
| `action_without_entity` (service `script.<id>`) | 2 | 2 | the action calls a script as a service, with no target entity and no data |
| `service_not_allowed` (`climate.turn_on`) | 0 | 1 | climate service missing from the allowed list |
| `entity_domain_not_schedulable` (`button.press`) | 0 | 1 | a `button.*` outside the door layer |
| `contains_code`, `conditions_differ`, `unknown_fields`, `argument_not_allowed`, entity missing, scheduler-platform switch | 0 | 0 | none seen |

Other measurements (both systems unless stated):

- Templates in service data: 0 / 0. Code-like keys (code, pin, password): 0 / 0. Unknown item, slot, action or condition keys: none.
- Multi-slot schedules: 21 of 23 (H), 11 of 21 (V). Slot-count histogram H: 1 slot x2, 2 x4, 3 x6, 5 x10, 7 x1; V: 1 x10, 3 x4,
  4 x1, 5 x3, 6 x2, 7 x1. Multi-slot is not a read-only cause; every multi-slot schedule here has identical conditions in all slots.
- Schedules with conditions: 15 of 23 (H, 58 conditions), 16 of 21 (V, 45 conditions). All conditions are `binary_sensor` with
  match type `is` on `state`. Conditions never made a schedule read-only.
- Weekdays: H all `daily`; V 20 `daily`, 1 named days. No `workday` / `weekend` tokens.
- Time kinds (slot starts): H 82 fixed, 3 sunrise/sunset; V 58 fixed, 2 sunrise/sunset. Point actions (no stop): 2 (H), 9 (V).
- Other fields: start or end date on 1 (H) and 0 (V); tags on 22 (H) and 16 (V); repeat type `pause` on 1 (H), otherwise `repeat`;
  unnamed schedules 2 (H) and 1 (V).
- Action counts: 102 (H), 225 (V). Action entity domains, H: switch 46, climate 36, cover 10, light 5, alarm_control_panel 1,
  no entity 4. V: switch 151, climate 56, cover 15, button 1, no entity 2.
- Action services, H: switch.turn_on/turn_off 19/27, climate.turn_off 19, climate.set_temperature 17, cover.close_cover 6,
  cover.set_cover_position 4, light.turn_on/turn_off 2/3, alarm_arm_home 1, script call 4. V: switch.turn_on/turn_off 89/62,
  climate.set_temperature 32, climate.turn_off 22, climate.turn_on 2, cover.open/close 4/6, cover.set_cover_position 5,
  button.press 1, script call 2. Service-data keys used: `temperature`, `hvac_mode`, `position`, `brightness` only.
- Switch targets of the schedules: 13 distinct (H), 33 distinct (V). Integration platforms: H vitrea 9, mqtt 3, shelly 1;
  V vitrea 30, mqtt 2, shelly 1. Device class mostly unset (H 9 of 13, V 31 of 33). Every switch is used with both on and off.
  No schedule mixes entity domains.
- Script calls: all 4 (H) and 2 (V) name a script that exists as a `script.*` entity; none passes variables.
- Action entities missing from Home Assistant: 0 / 0. Warnings on editable schedules in scenario B: 2 `entity_unavailable` (V).

Shape of every read-only schedule (scenario A, anonymised, sorted):

H (12): 10 switch-only on/off schedules (4 with 2 slots, 3 with 3 slots, 2 with 5 slots, 1 with 7 slots; 4 of the 10 carry one
condition per slot; 2 have sunrise/sunset times) - reason `switch_not_marked`; 2 script-call-only schedules (1 slot without
condition, 3 slots with one condition each) - reason `action_without_entity`.

V (14): 10 switch-only on/off schedules (3 with 1 slot, 4 with 3 slots, 2 with 5 slots, 1 with 7 slots; 6 carry one condition per
slot; 2 have sunrise/sunset times; 1 has named days) - `switch_not_marked`; 2 one-slot script-call schedules with one condition -
`action_without_entity`; 1 one-slot `button.press` - `entity_domain_not_schedulable`; 1 six-slot climate schedule (`set_temperature`,
`turn_off`, `turn_on`, one condition per slot) - `service_not_allowed`.

## Reading

- Out of the box (scenario A) the editor can edit 41% of the external schedules (18 of 44): 11 of 23 on H, 7 of 21 on V.
- The dominant cause is not content the model cannot represent. It is a policy gate: 20 of the 26 read-only schedules (77%) are plain
  on/off switch schedules whose only problem is that the switch is not yet marked safe for group action.
- With every switch marked (scenario B) 38 of 44 (86%) are editable. The remaining 6 are three small model gaps below.
- Conditions, multi-slot schedules, sunrise/sunset times, tags, dates and the `pause` repeat type are already handled and were
  never a cause of read-only on these two systems. The built-in `schedule` helper is not used at all, so nothing is lost by not
  supporting it.
- Every editable schedule in both scenarios validates unchanged, so none would be editable but unsaveable.

## Recommendation: small model extensions, ranked by schedules fixed

| Rank | Extension | Fixes (H + V) | Cumulative editable of 44 |
|---|---|---|---|
| 1 | Switches that an existing external schedule already targets stay editable. Either an owner-confirmed "adopt the switches used by existing schedules" step that sets the safe mark in one action (a list of the 46 distinct switch targets shown for review; 39 of them are on one integration platform), or an exemption that lets an unchanged existing switch action pass `classify` while a NEW switch action still needs the mark. | 10 + 10 = 20 | 38 (86%) |
| 2 | Script-call actions: accept a service of the form `script.<object_id>`, with no entity and no data, when that script exists as a `script.*` entity, shown as "run script" (a new class). The stored form stays the original service call, so edit in place only (times, days, conditions, enable), never re-target. Needs a decision about who may schedule scripts, since a script can do anything. | 2 + 2 = 4 | 42 (95%) |
| 3 | Add `climate.turn_on` to the climate action list (no arguments, mirror of `climate.turn_off`). | 0 + 1 = 1 | 43 (98%) |
| 4 | Allow `button.press` for a `button.*` entity that is not on the door layer (new class or a mark like the switch mark; one schedule on V). | 0 + 1 = 1 | 44 (100%) |

Items 3 and 4 are single schedules on one system each: worth doing only if cheap. Item 1 alone moves the editor from "half" to
"most", and it is the one that needs a product decision (the safe mark is a safety control, so adopting must be explicit and
auditable). Item 2 is the second real gap: 4 schedules, but it touches the safety policy, so treat it as a separate small change
request, with a deliberate default of "view and toggle only, edit the time and days, never change which script".

Not needed on these data: template support, per-slot different conditions, `workday` / `weekend` handling, code-carrying actions,
condition domains beyond `binary_sensor`.

## Reproduction

The probe script is not part of the repository (it prints only counts and reason codes and reads credentials from the gitignored
`secrets/` env files). It re-uses `normalize`, `classify` and `validate_draft` unchanged, so the numbers move if the model changes;
re-run it after the extensions above to confirm every external schedule reads as editable.
