# Automations, scripts and scenes probe of four owner systems (CR-017 input) - 2026-10-01

Read-only inspection of four owner-operated Home Assistant systems, labelled **system-H / system-V / system-K / system-O**, to
learn what automations, scripts and scenes look like in practice before designing the create / edit / delete UI of CR-017.
Everything below is anonymised: counts, key shapes and distributions only. No aliases, entity ids, device ids, area names,
template text, hostnames, addresses or tokens appear here. Raw dumps and the analysis scripts stay in the git-ignored
`private-evidence/automations-probe/`.

## Method and limits

- Owner approval: inspection only. Nothing was changed or operated: no service call of any kind (no `automation.trigger`,
  `turn_on/off`, `script.turn_on`, `scene.turn_on`), no config write, no reload, no restart.
- WebSocket reads from an allow-list: `auth`, `get_config`, `get_states`, `config/entity_registry/list`,
  `config/device_registry/list`, `config/area_registry/list`, `config/floor_registry/list`, `config/label_registry/list`,
  `get_services`, and `trace/list` (read-only; only the number of stored runs was kept). REST `GET` only on
  `/api/config/{automation,script,scene}/config/<id>` for ids taken from entity attributes (automation and scene: the `id`
  attribute; script: the object id). A browser-like `User-Agent` was sent on every request (the front doors reject the default
  Python one). All four tokens authenticated; no other credentials were tried.
- Snapshot of one moment. "UI-managed" means the stored config is readable through the config API by id (it lives in the
  file the HA UI editor writes); "YAML-managed" means no id / the config API returns 404 (defined elsewhere, read-only for UI).
- Not checkable with these reads: `!include` / packages / YAML anchors in the source files (the config API returns the resolved
  object), the contents of traces, and entities that were defined in YAML with an `id` and live inside the UI file.
- Reading the loaded-components list: the `config` component is present on all four systems, but the sub-components
  (`config.automation`, `config.script`, `config.scene`) are not listed on any of them although the config API answered 200 for
  every stored automation and script. So the components list is NOT a reliable availability check; probe the config API itself.

## Per-system results

### Overview

| | system-H | system-V | system-K | system-O |
| --- | --- | --- | --- | --- |
| HA core | 2026.9.4 | 2026.9.4 | 2026.8.3 | 2026.9.4 |
| `config` component loaded | yes | yes | yes | yes |
| Areas / states | 20 / 1479 | 22 / 850 | 11 / 990 | 10 / 561 |
| Automations (on / off) | 23 (17 / 6) | 4 (4 / 0) | 15 (10 / 5) | 0 |
| Automations registry-disabled | 0 | 0 | 0 | 0 |
| Automations readable by id (UI-managed) | 23 | 4 | 15 | - |
| Automations YAML-managed (no id / 404) | 0 | 0 | 0 | - |
| Scripts (readable) | 2 (2) | 3 (3) | 4 (4) | 0 |
| Scenes | 86 | 65 | 88 | 0 |
| Scenes created through HA itself (`id` / homeassistant platform) | 0 | 0 | 0 | - |
| Scenes provided by an integration | 86 | 65 | 88 | - |
| Stored automation traces (runs) / script traces | 30 / 0 | 5 / 0 | 35 / 0 | 0 / 0 |
| `trace/list` command available | yes | yes | yes | yes |

System-O has no automation, script or scene at all (empty state, all three services still registered). Every readable config on
the other three systems carries an `id` and every entity has a registry entry, so there is **no YAML-only automation, script or
scene-with-config** on any of the four systems. All scenes are entities contributed by a hardware integration (one wall-switch
/ shutter controller family on all three, plus one smart-home-hub scene on system-K); none has an `id`, none exposes member
entities in its attributes, none is editable through the config API.

### (2) Automations

| | system-H (23) | system-V (4) | system-K (15) |
| --- | --- | --- | --- |
| Schema keys | 23 new (`triggers/conditions/actions`), 0 old, 0 mixed | 4 new | 15 new |
| Modes | single 10, queued 5, restart 6, parallel 2 | single 3, restart 1 | single 7, restart 4, queued 2, parallel 2 |
| `max:` set | 7 | 0 | 3 |
| Alias language | Hebrew 22, English 1, none 0 | Hebrew 4 | Hebrew 15 |
| Has description | 20 | 3 | 7 |
| Blueprints | 0 | 0 | 0 |
| Automations using a template anywhere | 15 | 2 | 3 |
| Templates > 400 chars / largest config | 0 / ~4.3 kB | 0 / ~1.7 kB | 0 / ~1.6 kB |
| Duplicate ids | 0 | 0 | 0 |
| Automations with a dangling entity reference | 0 | 0 | 2 |
| Triggers per automation (1 / 2 / 3 / 4) | 13 / 3 / 5 / 2 | 3 / 0 / 0 / 1 | 6 / 5 / 4 / 0 |
| Automations with trigger `id`s | 18 | 1 | 7 |

Trigger platforms (count of trigger entries):

- system-H: state 20, time_pattern 5, template 4, time 4, device 4, homeassistant 4 (all `start`), one entity-purpose trigger in
  the new 2026 style (`switch.turned_on`).
- system-V: state 3, template 3, time_pattern 1.
- system-K: state 15, time 8, time_pattern 2, device 2, event 1.
- Across the three: state is about half of all trigger entries (38 of 77) and appears in 28 of 42 automations; `time` (fixed clock
  time, no entity based `at`, 12 entries in 9 automations) is the second most common; `sun`, `zone`, `numeric_state`, `mqtt`, `webhook` do not occur at all. State triggers
  use `to` (most), `for` (6), `from` (10), `attribute` (0). State-trigger entity domains: switch (34), binary_sensor (9),
  climate (6), sensor (3), person (2), alarm_control_panel (2), timer (2), scene (2). `device` triggers come from the wall-switch
  integration (6 in total).

Conditions: 8 state + 3 template + 1 `not` (H), 1 template (V), 1 state + 1 template (K). Sparse: 17 / 4 / 13 automations have a
top-level `conditions` key, but only 14 top-level conditions exist in total (11 / 1 / 2); the rest are empty lists. Choose / if branches carry the real
logic instead (see actions).

Actions (step count, nested branches included): service calls 57 / 9 / 26; `choose` 7 / 2 / 7; `delay` 10 / 1 / 1;
condition-as-step 6 / 1 / 0; `variables` 3 / 0 / 0; `if/then` 4 / 0 / 0; `repeat` 2 / 0 / 0; device actions 0 / 0 / 2; no
`wait_template`, `wait_for_trigger`, `parallel`, `event`, `stop`, `scene:` step anywhere.

Service-call domains (calls): system-H: switch 24, climate 13, notify 8, automation 4, light 2, select 2, scene 2,
alarm_control_panel 1, homeassistant 1; system-V: switch 4, scheduler (custom integration) 4, homeassistant 1; system-K:
switch 15, media_player 4, alarm_control_panel 2, timer 2, number 1, shell_command 1, homeassistant 1. Every service call is
written with the current `action:` key; 0 use the legacy `service:` key or `data_template`. 49 + 5 + 25 service calls use a
`target:` block and 47 + 6 + 15 use a `data:` block.

Targets: every automation refers to entities by raw `entity_id`; 2 (H) + 0 (V) + 3 (K) use a `device_id` (device triggers /
device actions); **0 automations use `area_id`, `floor_id` or `label_id`** as a target.

Templates: 15 / 2 / 3 automations contain at least one. By position: entity_id fields inside actions (mostly
`entity_id` lists built by a template), `value_template` in template triggers, template conditions and choose conditions, and
data fields of service calls (climate set-points and modes, notification image / url fields, a `for_each` and a `while`). Only
system-H has templated `for:` / `minutes:` trigger fields.

Notify: 4 automations (all in system-H) call notify services: `notify.mobile_app_*` 2 calls, other named notify services 6 calls;
0 use `persistent_notification`. Systems V and K do not notify from automations.
Locks / covers: 0 automations call `lock.*` or `cover.*` (no lock or cover is referenced at all). Alarm panel: 3 automations touch it
(1 in H, 2 in K; 2 of them call `alarm_control_panel.*` services, 2 trigger on an alarm panel state).
media_player: 0 automations trigger on a `media_player` state change; system-K has 4 `media_player` service calls in actions
(volume-style media calls), none in H or V.

Step-count histogram (nested branches counted): system-H: <=1: 8, <=2: 2, <=3: 5, <=4: 1, <=5: 2, <=6: 1, <=8: 2, <=11: 1, >16: 1.
system-V: <=1: 1, <=3: 1, <=4: 1, <=5: 1. system-K: <=1: 7, <=2: 1, <=3: 2, <=4: 4, <=5: 1. Across 42 automations: 27 have
<= 3 steps, 40 have <= 8, 1 has more than 16.

### (3) Scripts

| | system-H | system-V | system-K |
| --- | --- | --- | --- |
| Count / readable | 2 / 2 | 3 / 3 | 4 / 4 |
| With `fields:` (parameters) | 0 | 0 | 1 |
| Sequence length (steps) | 1, 1 | 3, 3, 3 | 1, 2, 4, 5 |
| Modes | single 2 | single 3 | single 3, restart 1 |
| Alias | Hebrew 2 | Hebrew 3 | Hebrew 3, English 1 |
| Templates | 0 | 0 | 2 scripts |
| Service domains used | alarm_control_panel | switch, select (+ delay) | media_player, climate, switch, input_select, homeassistant, plus custom services (`browser_mod`, a blink helper) and one `repeat` |
| Called from an automation | 0 | 0 | 0 |

Scripts are few, short, called manually (dashboard buttons) rather than from automations; the only parametrised script is one in
system-K.

### (4) Scenes

- 239 scene entities in total (86 / 65 / 88 / 0), **all integration-provided** (wall-switch controller family 238, hub 1).
  None is UI-created, none has an `id`, none of the state objects lists member entities (entity-per-scene histogram: all
  entries in the `<=1` bucket, i.e. the scene's own entity at most), so `entities` with states versus attributes cannot be
  observed on these systems: there is no HA-native scene to sample.
- The scene state is "unknown" until first activation, then the last-activated timestamp. On system-K, 28 of 88 scenes have
  been activated; a few automations trigger on a scene entity state (2 trigger entries, system-K) and all device triggers
  in system-H / system-K come from the same controller family (the physical scene buttons).
- The `scene.create`, `scene.apply`, `scene.delete` and `scene.reload` services exist on all four systems (so UI scene creation is
  possible there); there is simply no HA-native scene yet.

### (5) Traces

`trace/list` answers on all four systems (read-only), for both `automation` and `script`. Stored automation runs: 30 (H), 5 (V),
35 (K), 0 (O); stored script runs: 0 everywhere. Contents were not read. Implication: traces exist and are cheap to list, but on
these systems they cover recent history only (a handful of runs per automation).

### (7) Things that would break or complicate a UI editor

- Device triggers (`trigger: device`, `domain` plus an opaque `device_id` / `type` / `subtype`): 6 trigger entries, all from the
  wall-switch integration; device actions: 2 (K). These need either a typed editor that reads the device automation
  capabilities (`device_automation/*` WS calls) or a preserved read-only chip.
- Custom-integration services as actions (`scheduler.*` 4 calls in V, `browser_mod`, a blink helper, `shell_command` in K):
  the service picker must be fed from `get_services`, not from a hard-coded list, and unknown domains must round-trip unchanged.
- Dangling references: 2 of 15 automations in K reference entities that do not exist in states or the registry.
- Templates are common but short (none over 400 chars, largest whole automation ~4.3 kB): a plain multi-line text box with a
  `{{ }}` badge is enough; no need for a template IDE.
- Missing-entity, YAML includes, anchors, packages and duplicated ids: no duplicated ids; no YAML-only entities; include / anchor
  usage cannot be detected through the API (resolved objects only).
- Legacy: zero occurrences of legacy schema keys (`trigger:` / `platform:` / `service:` / `data_template`). The
  machine-written file format of HA 2026 is what is in use. Automation trigger ids (`id:`) are widely used (18 / 1 / 7 automations) because
  choose branches test them (`condition: trigger`), i.e. they must be editable.
- Blueprints: none. One `switch.turned_on` style entity-purpose trigger exists (new 2026 key), so the trigger picker must keep
  unknown `trigger:` values intact.

## Cross-system summary

- 42 automations, 9 scripts, 239 scenes across three systems; the fourth is empty. All 42 automations and 9 scripts are
  UI-managed (readable by id, all with a registry entry), 0 YAML-managed, 0 blueprints, 0 disabled in the registry. 11 of the 42
  automations are currently turned off (6 in H, 5 in K).
- The automation population is small and simple: one or two triggers, at most a couple of conditions, mostly <= 3 steps; the
  dominant shape is "state (or time) trigger on a switch -> switch / climate service call, sometimes via `choose`", plus a
  fixed time of day for the scheduled ones. Modes are spread across single / restart / queued / parallel, so the mode field
  must be editable, not hidden.
- The owner population targets by raw entity id only (no area / floor / label targets anywhere), even though 10-22 areas are
  defined per system; hardware-provided scenes and device triggers carry the wall-switch side of the installation.
- Aliases are Hebrew in 41 of 42 cases; descriptions are used in 30 of 42. The editor must be RTL-safe for alias and
  description and must not assume English.
- Notify usage is rare (4 automations, one system); locks, covers and media_player triggers do not occur; alarm panel appears in
  3 automations and 2 scripts (system-H scripts are the alarm arm / disarm actions), which are security-relevant and deserve
  permission gating.
- Custom or third-party pieces that a generic editor must tolerate: custom-integration services (scheduler, browser mod, shell
  command), device triggers from the controller integration, timers, and scene-entity triggers.

## Implications for CR-017

1. **Schema.** Support the new schema (`triggers` / `conditions` / `actions`) as the native format; 100 % of stored configs use
   it. Still read legacy keys (`trigger`, `platform`, `service`) for safety, but plan to write only the new form.
2. **Most valuable features first.** (a) Trigger: state (entity, `to` / `from`, `for`), time (fixed clock time, weekdays),
   time_pattern, template, HA start; (b) action: service call with a `target` block and `data` block, `choose`, `delay`,
   `if/then`, `variables`; (c) conditions: state, template, `not`, trigger-id; (d) mode + `max`, alias, description, enabled
   switch, trigger ids. `sun`, `zone`, `numeric_state`, `mqtt`, `webhook`, `repeat`, `wait_*`, `parallel`, blueprints can
   be added later or be shown read-only.
3. **Areas, floors and labels as targets are not in use.** Offering them is an improvement over current practice and fits the
   product's area model, but the first release can keep entity pick-lists (filtered by area in the picker) without changing what
   gets saved.
4. **What must be read-only / preserved.** Anything the UI does not model must round-trip unchanged: device triggers and device
   actions (opaque ids), custom-integration and shell-command services, templated `entity_id` fields, unknown `trigger:` values,
   `continue_on_error`, `enabled: false` steps. Show them as locked blocks, never drop them. Hardware-integration scenes are
   activate-only (no config API); HA-native scene editing is greenfield on these systems (no sample to import).
5. **YAML-managed.** 0 of 51 automation / script configs are YAML-managed here, but the UI must still detect 404 / no-id and
   mark the item "managed in YAML - view only"; do not attempt a write when the config API returns 404. Include / anchor /
   package usage cannot be detected in advance.
6. **Do not gate on the `config` components list.** Sub-components are not listed even though the config API works; check by
   probing the config API (a `GET` on a known id, or a dry-run `POST` in a later, approved step) or fall back to a capability
   flag in the add-on.
7. **Permissions.** Alarm-panel actions and notify targets should require an elevated role to edit; deleting or disabling an
   automation needs a confirmation; `shell_command` and other non-presentation services should be flagged.
8. **Small data, simple list.** One screen listing is enough (42 rows at most here), with filter by state (on / off) and by the
   trigger entity's area; the trace viewer can show run count and last-run only (traces are few).
9. **Non-English aliases.** Hebrew aliases and descriptions dominate; RTL, mixed-direction templates and Unicode search must work.
10. **Templates.** Treat templates as short text fields with a preview-free badge; no template debugger is needed for phase 1.
