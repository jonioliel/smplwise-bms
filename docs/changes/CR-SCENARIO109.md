# CR-SCENARIO109 - Cross-module scenarios on one condition model ("תרחישים")

Status: APPROVED by the owner with changes (answers 24.10, batch 4 questions 210-219 and batch 5 follow-ups 270, 271, 276; section 17 binds over
sections 1-16 where they differ). Build branch `pilot/XSCENARIO109-295` from `origin/release/2150`. Board items r109 / r219.
Original status: PROPOSAL, design only, no code. Branch `pilot/SCENARIO109-295` from `origin/main` (v2.12.4, 320e5555). Board item r109.
Builds on CR-017 (`docs/changes/CR-017-AUTOMATIONS-SCENES-SCRIPTS.md`, `docs/architecture/AUTOMATIONS_API.md`), CR-018 (notifications, `services/notify.py`,
`notify_policy.py`, `notify_sources.py`), CR-038 (service module, `services/tickets/create.py`, `rule_engine.py`), CR-BLUEPRINT80 (`origin/pilot/BLUEPRINT80-295`,
`docs/changes/CR-BLUEPRINT80.md`, declarative closed format), CR-INFRA-TEMPERATURE (`services/temperature_tickets.py`), the elevator / generator / presence
services and the water module (`origin/pilot/WATER78-295`, migration 0152). Door automations stay under CR-AUTODOORS-295, CR-033 and CR-039. Precedence per
CLAUDE.md: approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then this document; it binds only once the owner approves it.
No device, Home Assistant, NVR, bridge or door was contacted for this document. There is no code, so nothing here is claimed as tested (all NOT_RUN).

## 1. Goal

A site manager wants rules that look across modules: "the cold-room temperature is out of range AND its door is open AND it is after hours -> open a service
request and tell the shift manager". Today each module alerts alone (temperature alert rows, door-left-open, elevator alerts, generator alerts, leak alerts),
the CR-017 HA automations only see Home Assistant entities, and the ticket rule engine (`tickets/rule_engine.py`) only maps one notification source to one
ticket. Nobody can combine two signals from two modules.

Goal: **one condition model** over typed signals from every module, evaluated by an Arx-side engine, with a small closed action set, full explainability,
per-module visibility and an audit trail. Default OFF.

Non-goals (hard):
- A scenario can never operate a door, lock, alarm, siren, cover or gate, and never arm / disarm. Not as an action, not through a scene that contains one
  (section 6). Door automation stays exclusively in CR-AUTODOORS-295 / CR-033 / CR-039 with their own arming and kill switches.
- Not a second HA automation engine. HA-resident automations (CR-017) keep running in HA; a scenario does not write to HA, the NVR, go2rtc or any device config.
- No scripting, no templates, no webhooks, no arbitrary service calls, no code.
- No machine learning or "prediction"; only stored and live facts the modules already hold.

## 2. Why a new engine and not CR-017 or BLUEPRINT80

CR-017 automations execute inside Home Assistant on HA entities and states. The signals asked for here (temperature units, elevator status, generator state,
presence counts, water-leak state, schedule windows) live in Arx tables and in-memory runtimes, not as HA triggers, and a cross-module rule must be evaluated
where all of them are visible: Arx. Reusing the HA path would force every module state to be mirrored as a fake HA entity. BLUEPRINT80 contributes the *style*:
a declarative, closed, versioned JSON format validated server side with a hard whitelist, expanded and checked by independent code, with refusal tests. This CR
reuses that style, not its engine. Rules that only need HA entities can still be ordinary automations (section 16, Q9).

## 3. The unified condition model

### 3.1 Signals

A **signal** is a named, typed reading published by a module through a registry (`ScenarioSignalProvider` Protocol, one adapter per module). The registry is
code, not data; a module adds signals by shipping an adapter. A signal has:
`{ id, module, subject_kind, subject_id, kind, unit, max_age_s, read(ctx) -> Reading }` where
`Reading = { value | None, state: ok|unknown|stale|unavailable, as_of: UTC ISO, source }`.
Value kinds (closed): `bool`, `number` (with unit), `enum` (closed list per signal), `count` (integer >= 0).

Initial catalogue (each is a read of existing module state, never a new sensor poll):

| module | signals (subject) | kind |
|---|---|---|
| temperature | `temperature.value`, `temperature.out_of_range`, `temperature.door_open` (unit), `temperature.sensor_offline` | number / bool |
| doors (read only) | `door.is_open`, `door.open_for_s` (door sensor) | bool / number; conditions only, see 6.1 |
| elevators | `elevator.status` (ok / fault / out_of_service), `elevator.fault_active` | enum / bool |
| generator | `generator.state` (off / running / fault), `generator.fuel_pct`, `generator.alarm_active` | enum / number / bool |
| presence | `presence.count` (area or floor), `presence.anyone` | count / bool, counts only, no names |
| water (WATER78) | `water.leak_active` (sensor / area), `water.flow_lpm` (meter), `water.consumption_period` | bool / number |
| HA entities | `entity.state`, `entity.numeric` for entities the author may read (the editor's picker set) | enum / number |
| schedules | `schedule.window_active` (a CR-014 schedule or a named time window) | bool |
| time | `time.in_window` (days, from / to in site time, midnight-wrapping, sun offsets), `time.after_hours` (site working hours of `tickets/work_calendar.py`) | bool |
| flags | `flag.value` (a scenario flag, 5) | bool / enum |

A signal never exposes a person, a visitor, an image, a `last_access` field or an address (same rule as `notify_sources`).

### 3.2 Freshness and unknown semantics

Three-valued logic: every leaf evaluates to `TRUE`, `FALSE` or `UNKNOWN`. **Unknown is not false.**
- A reading is `unknown` when the provider has no value (module off, sensor offline, runtime not started, reading older than the signal's `max_age_s`). A leaf may
  tighten `max_age_s`, never loosen it past the signal's cap.
- Kleene tables: AND: any FALSE -> FALSE; else any UNKNOWN -> UNKNOWN; else TRUE. OR: any TRUE -> TRUE; else any UNKNOWN -> UNKNOWN; else FALSE. NOT(UNKNOWN) = UNKNOWN.
- A rule **fires only on TRUE**. UNKNOWN never fires and never silently clears a firing rule.
- Per-rule `on_unknown` (closed): `hold` (default: keep the previous state, no fire, no clear, up to `unknown_grace_s`, then the rule goes to state `degraded`),
  or `treat_as_false`. There is no `treat_as_true`: a lost sensor must never cause an action. A `degraded` rule is visible in the list and may send one
  "the scenario cannot be evaluated" notice (source `scenario.degraded`, OFF by default).
- The reading state of each leaf is recorded in the run snapshot (section 7).

### 3.3 Boolean structure, time windows, hold durations

```
node := { "op": "and"|"or", "items": [node, ...] } | { "op": "not", "item": node } | leaf
leaf := { "signal": "<id>", "subject": "<id>", "cmp": "is_true|is_false|eq|ne|gt|ge|lt|le|between|outside|in_set",
          "value": ..., "max_age_s": n?, "hold_s": n?, "hysteresis": {...}?, "debounce_s": n? }
```
Depth <= 4, <= 12 leaves.
- **Time windows are signals** (`time.in_window`, `schedule.window_active`, `time.after_hours`), combined with AND / OR / NOT like any leaf. One model.
- **`hold_s` on a leaf** ("true continuously for N seconds"): the leaf becomes TRUE only after the raw condition has been TRUE for N seconds with no FALSE or UNKNOWN
  in between (an UNKNOWN restarts the hold). Max 24 h. A rule-level `for_s` does the same for the combined result.
- **`cooldown_s`** on the rule: no new fire for N seconds after a fire (default 900, min 60).
- **Re-arm**: fires on the edge FALSE/UNKNOWN -> TRUE after hold, then stays `active` until the condition has been FALSE for `clear_after_s` (default 60). Optional
  `repeat_every_s` (min 900), at most 5 repeats, then `suppressed`. A resolved notice follows the notification core's resolve behaviour.

### 3.4 Hysteresis to avoid flapping

- Numeric leaves take `hysteresis: {"clear_margin": x}` or `{"clear_pct": p}`: TRUE at the threshold, FALSE only after the value crosses back by the margin ("above
  8.0 C" arms at > 8.0 and releases below 7.5). Per-signal default margins (temperature 0.5 C, fuel 2 %); the author may raise them.
- Boolean leaves take `debounce_s` (default 10 for door sensors, else 0): the raw value must be stable that long before the leaf changes.
- Hysteresis and hold state are per (rule, leaf) and persisted (section 5), so a restart neither flaps nor re-fires.
- Rule-level `min_active_s` stops a rule evaluating to FALSE sooner than N seconds after it became active. With `cooldown_s` and the daily cap (6.3) this bounds
  the worst case of an oscillating sensor.

### 3.5 Validation

Server side, before save: signal ids exist and are enabled; the subject exists and the author may see it (section 8); the comparison fits the value kind and unit;
thresholds in the signal's sane range; depth / leaf / hold / cooldown bounds; no unknown keys; no flag cycles. Errors are `422 validation` with
`details.errors = [{path, code, message}]` in Hebrew, as in BLUEPRINT80.

## 4. Closed action set

Four actions, nothing else. A rule has 1-3, executed in order, each independent (one failing does not skip the rest; each result is logged).
1. **`notify`**: `notify.emit` with a new source `scenario.fired`, catalogued in `notify_policy`, so the administrator controls channels, escalation and quiet
   hours as for every source. Recipients: a user, role or approved target group the author may address. The message is a fixed Hebrew / English template with the
   scenario name and leaf values as parameters, no free HTML. Subject kind `scenario` is visible per section 8.
2. **`create_service_request`**: through the service module's one creation path (`tickets.create`, as `temperature_tickets` and `rule_engine` do), into a chosen
   department with priority, title and description rendered from the template plus the signal snapshot. Dedupe key `scenario:<rule_id>:<subject>`: a repeat while the
   request is open becomes a system note, not a second request. The module's limits apply. Owner rule: when the tickets module is off, no "open service request"
   action is offered or executed; a rule holding it is `degraded` (`tickets_off`) and its other actions still run.
3. **`set_flag`**: sets / clears a named scenario flag (boolean or one of <= 8 enum values) in a table owned by this module. Readable as signal `flag.value`, so
   scenarios can chain (depth limit 6.3). Flags affect no device.
4. **`run_safe_scene`**: calls an existing CR-017 scene by id, only if it passes the safe-scene check (6.2), via the automations transport, judge and rate limits
   as the scenario service identity (6.4).

Outside, explicitly: any service call, lock / alarm / siren / cover / garage / gate / PTZ / NVR / go2rtc / user or permission change, any scenario or automation
write, any outbound webhook or free-text WhatsApp / email (messages go only through the notification core and its channels).

## 5. Data model (migration PROVISIONAL, one file)

One file, number PROVISIONAL from `0170` per the renumbering rule (final number assigned at integration; last on main is 0145, water is 0152 on its branch):
`0170_scenarios.sql`, additive and idempotent, tables empty while the module is off, no change to existing tables.
- `scenario_rules(id, name, description, enabled, schema_version, definition_json, definition_hash, version, owner_user_id, department_id, state
  [off|ok|active|degraded|suppressed], state_since, last_eval_at, last_fire_at, fires_today, created_by, updated_by, created_at, updated_at)`; optimistic
  concurrency by `version` / `definition_hash`.
- `scenario_leaf_state(rule_id, leaf_path, raw_state, since, held_since, hyst_state, last_reading_json)`.
- `scenario_flags(name PRIMARY KEY, kind, value, set_by_rule, set_at, expires_at)`.
- `scenario_runs(id, rule_id, rule_version, at, trigger [event|tick|manual_test], outcome [fired|cleared|suppressed|degraded|test], result TRUE|FALSE|UNKNOWN,
  snapshot_json, actions_json)`; retention 90 days or 5000 rows per rule via a janitor step.
- `scenario_versions(rule_id, version, definition_json, at, by)`: history for diff and rollback.
Settings use the existing administrator settings mechanism (section 9), not a table.

## 6. Safety

### 6.1 The door / lock / alarm / cover wall (hard rule)

Enforced in three independent places, each tested alone, in the style of BLUEPRINT80 section 7:
1. **Format**: the action set contains no operating verb; `validate_definition` refuses any key outside the closed lists.
2. **Resolution**: at save and at every fire the action target (scene, flag, department, recipient) is re-resolved; a scene or member entity that is a lock, alarm
   panel, siren, door-class cover, gate or garage, is on the door layer (`door_path.possible_door_entities`), or belongs to `door_automations`, `door_windows` or an
   emergency control is refused (`scenario_forbidden_target`).
3. **Execution seam**: `run_safe_scene` goes through `door_path_guard.check_automation_item` / `check_config` (which resolve the scene's members) and
   `door_run_guard`; a refusal there fails the action, not the engine. A test injects a scene containing `lock.unlock` and an alarm arm and expects refusal at all
   three layers.
Read-only door signals (sensor open / closed, open-for) are conditions only. No provider exposes an access code, credential, reader event with a person, or intercom.

### 6.2 Safe scene

Every member entity is in {`light`, `switch`, `fan`, `climate`, `media_player`, `input_boolean`}, none sensitive, none door-related (6.1). Rechecked at each fire;
a scene that stops being safe fails the action and degrades the rule (`scene_unsafe`).

### 6.3 Loops and blast radius

- Chains through flags: depth <= 3; cycles detected at save by a graph check over flag reads / writes.
- A scenario's own effects (a notification, a request) are not signals in v1, so it cannot trigger itself through its output.
- Per rule: `cooldown_s`, `max_fires_per_day` (default 20, cap 200), `max_tickets_per_day` (default 5, cap 50). Global `scenarios.max_actions_per_hour`
  (default 120). Exceeding any cap marks the fire `suppressed`, audits it once and notifies the rule owner once; no retry storm.

### 6.4 Whose authority

The scenario runs as a **scenario service identity** (`svc:scenario`, no sign-in), never the author's session. At save the author needs the rights to see every
referenced signal and use every action (create requests in that department, address those recipients, use that scene). At **each fire** the engine rechecks the
author still holds them; otherwise the rule becomes `degraded` (`author_rights_lost`) and does nothing until an administrator reassigns it. A local (Arx-only)
identity cannot author scenarios (same as `service_identity.refuse_automation_write`). Requests opened by a scenario are authored "by the system", as the existing
rule engine does, carry the scenario name and link to the run.

## 7. Explainability

Each fire or state change writes a `scenario_runs` row with a **snapshot**: per leaf `{path, signal, subject, value, unit, reading state, as_of, comparison, result
T/F/U, hold progress, hysteresis state}`, the combined result, rule version and the clock reading used. The UI renders a Hebrew sentence and tree, for example:
"נורה כי: טמפרטורה במקרר 3 = 9.4 (מעל 8.0 מאז 12:03) וגם דלת פתוחה (מאז 12:01) וגם מחוץ לשעות העבודה (19:42)". Notifications and requests deep-link to the run.
- **Test now** (`POST .../test`): evaluates against current readings, writes only a `test` run row, performs no action, shows the same snapshot. Replay over stored
  history is a later slice, for signals that have history.
- Unchanged evaluations are not stored per tick; the list shows `last_eval_at` and per-leaf current values on demand.

## 8. Permissions and per-module visibility

- New permissions in `roles.json` / the role catalogue: `scenario.view`, `scenario.manage`, `scenario.admin` (settings, reassign, kill switch). Default grant:
  administrator only (Q6).
- **Reference rule**: a rule may only reference a signal / subject its *author* may see through that module's own permission and scope (devices.read in reach,
  tickets.create in the department, elevator / generator / water / presence / door-sensor read). Checked at save and at every edit, so no one can add signals they
  cannot see.
- **Viewers** without rights to a referenced module see the scenario name, state and owner, but leaf conditions and snapshots are redacted per leaf
  ("אין הרשאה להצגת הנתון"). Notification visibility for subject kind `scenario` requires all referenced modules; otherwise the recipient gets a generic notice
  without values (Q7).
- Scope isolation: a scenario carries the author's scope (building / floor / department); the engine evaluates and acts within it.
- A module that is off makes its signals `unknown` with reason `module_off`, never `false`.

## 9. Default OFF, settings, kill switch

- `scenarios.enabled` = `false`. Off: every route except `/status` answers `409 scenarios_disabled`, the engine thread does not start, no provider is read.
- New rules are created disabled; enabling is a separate audited call, with explicit confirmation of department and daily cap for a rule with a request action.
- `scenarios.kill_switch` (administrator, also on the operations screen): stops all actions at once (conditions still evaluate and log `suppressed:kill_switch`).
- Per-action switches `scenarios.actions.notify|create_ticket|set_flag|run_scene`, all false until enabled; slice 1 enables only `set_flag`.

## 10. Evaluation engine

- **Hybrid**: event-driven for fast signals (a provider calls `engine.signal_changed(signal_id, subject)` from its own update path; an in-memory index maps it to the
  affected rules) plus a **periodic tick** (default 30 s, range 10-300 s) that evaluates every enabled rule, advances holds and windows, expires stale readings
  and runs janitor steps. The tick guarantees correctness if an event is missed; events give latency; evaluation is idempotent so both are safe.
- **Injectable clock**: `Clock` Protocol (`now()` UTC, `monotonic()`); tests and drills use a fake that can jump. No `datetime.now()` in engine or window logic.
  Site-local windows convert through `timeutil.zone`; DST and midnight-wrap have tests.
- **Restart**: leaf state is reloaded; readings older than `max_age_s` are stale; the engine does **not** fire for holds that completed while down; an in-progress
  hold resumes only if its last reading is still fresh, else restarts.
- **Load limits**: <= 200 enabled rules, <= 12 leaves each; a per-tick CPU budget (default 200 ms, remainder deferred with a metric); providers read from memory or
  one indexed query, no network call and no database connection held across a provider call (the `notify_sources` rule); a slow or raising provider is isolated
  (its signals become `unknown` for that tick). Actions run outside the evaluation lock on a bounded queue (100, drop-oldest with an audit row), so a slow request
  creation never stalls evaluation. One engine thread, `workers=1` friendly. Every hook is wrapped: the engine can never break a module.
- **Concurrency**: per-rule lock; an edit bumps `version` and discards state of changed leaves.

## 11. Audit

Existing `audit`: `scenario.create|update|enable|disable|delete|test`, `scenario.fire` (rule, version, action results, snapshot id), `scenario.denied` (reason code),
`scenario.action_failed`, `scenario.suppressed` (cap or kill switch), `scenario.degraded` (reason), `scenario.settings.change`, `scenario.kill_switch`. Definition
diffs live in `scenario_versions`; free text is not logged in audit details. Rate limits on writes and tests (`scenarios.limits.test_per_min`).

## 12. API sketch

`GET /api/v1/scenarios/status` (never 403; `can_use`), `GET /scenarios/signals` (catalogue filtered by the viewer's reach, with units and freshness caps),
`GET/POST /scenarios`, `GET/PUT/DELETE /scenarios/{id}`, `POST /scenarios/{id}/enable|disable|test`, `GET /scenarios/{id}/runs`, `GET /scenarios/flags`.
Errors `409 scenarios_disabled`, `422 validation`, `403 forbidden`, `409 version_conflict`. Full shapes go in `docs/architecture/SCENARIOS_API.md` in slice 1.
Operator wording "תרחישים", never HA, YAML or "engine".

## 13. Tests plan (all NOT_RUN until built)

- Unit with fake clock and providers: Kleene tables exhaustive; unknown never fires; `on_unknown` modes and grace; hold and `for_s` incl. interruption by unknown;
  hysteresis up / down / equal; debounce; cooldown; re-arm and repeat cap; midnight-wrap and DST windows; stale by `max_age_s`; validation (depth, leaves, units,
  unknown keys, bounds, flag cycles); per-leaf redaction.
- Safety: forbidden-target at all three layers (lock, alarm, siren, cover, door-layer scene, `door_automations` member); safe-scene recheck after a scene change;
  author-rights-lost -> degraded; tickets-off skips the action and degrades; kill switch; caps; no self-trigger.
- Integration with module fakes: temperature + door + after hours -> one request (dedupe on repeat) and one notice; leak + presence count; generator fault +
  elevator status; flag chain depth 3 and the 4th refused; permission matrix (author A cannot reference module B; viewer redaction; generic notice); module off ->
  unknown; restart mid-hold; slow provider isolation; tick vs event idempotence.
- Migration applies on top of main and on top of the WATER78 branch; tables empty when off.

## 14. Slices (smallest first)

1. **S1 core**: migration (PROVISIONAL 0170), `Clock`, three-valued evaluator, validation, signals `time.*`, `entity.*`, `flag.*`, engine thread, test-now,
   `scenario_runs`, audit, settings OFF, status route, kill switch; action `set_flag` only. ~16-24 h.
2. **S2 notify**: `scenario.fired` source, visibility rule, resolve notice, caps. ~8-12 h.
3. **S3 module signals**: temperature (with door-open), doors read-only, schedule window, water leak (after WATER78 merges). ~12-16 h.
4. **S4 service request** through the ticket path with dedupe, tickets-off behaviour, run links. ~10-14 h.
5. **S5 more signals**: elevators, generator, presence counts. ~10-14 h.
6. **S6 `run_safe_scene`** with the three-layer wall and tests (last, most sensitive; optional). ~10-14 h.
7. **S7 UI**: builder (signal picker by module, tree editor, test-now snapshot, run history, redaction states), list, mobile and dark. ~24-32 h.
8. **S8**: scenario blueprints in the BLUEPRINT80 style; history replay. ~8-12 h.
S1 ships dark; each slice is independently releasable. Security review (Fable) after S4 and S6, before any default-on discussion.

## 15. Risks

False sense of coverage when a signal is unknown (mitigated by `degraded` and notices); flapping sensors (hysteresis, debounce, caps); notification or request
storms (caps, dedupe, kill switch); visibility leaks across modules (reference rule, redaction, generic notices); author departure (rights recheck, reassign); scene
drift (recheck at fire); load as signals grow (budgeted tick, event index); creep toward device control (the door wall and closed action set are the guardrail;
widening needs an approved CR).

## 16. Owner questions (recommendation first)

1. Placement: **Recommended: a "תרחישים" tab beside automations, separate engine and storage** (this CR). Alternative: a new block family inside the automations
   editor (more reuse, more risk to the HA path).
2. A lost sensor (`unknown`): **Recommended: never acts; holds, then `degraded` with an optional notice.** Alternative: per-rule "treat as false" only (never "as true").
3. First actions: **Recommended: set flag and notify first (S1-S2), service request in S4, safe scene last and optional (S6).** Alternative: drop `run_safe_scene`
   from v1 (safest).
4. Acting identity: **Recommended: a scenario service identity with the author's rights rechecked at each fire.** Alternative: act as the author (simpler audit, rights drift).
5. Presence: **Recommended: counts per area / floor only, never names.** Alternative: also "a role is present" (needs privacy review).
6. Who may author by default: **Recommended: administrators only until the UI and one pilot site, then a `scenario.manage` grant per site manager.** Alternative: managers from day one.
7. Notices to people lacking rights to a referenced module: **Recommended: a generic notice without values.** Alternative: send nothing.
8. Caps: **Recommended: 20 fires and 5 requests per rule per day, 120 actions per hour globally** (6.3). Confirm or change.
9. HA-entity-only rules: **Recommended: keep them as ordinary automations / blueprints and hint so in the builder.** Alternative: allow them here too.
10. History replay ("what would this rule have done last night"): **Recommended: later (S8), temperature and water first.**

## 17. Owner decisions (24.10, recorded 2026-10-23)

Source: `private/planning/OWNER_ANSWERS_2026-10-24_batch4_notes.md` (210-219) and `..._batch5_notes.md` (270, 271, 276); questions page
`private/review/OWNER_OPEN_QUESTIONS_2026-10-24.html` (ids sc-1..sc-10, follow-ups fx-210, fx-213, fx-217). No answer is frozen or postponed
(the freeze of 184 covers SMS only; the postponement of 272 covers video search only). STANDING RULE: every threshold, default, window and
recipient is editable in Settings; permissions are grantable to any role.

| Q | answer | effect on this record |
|---|---|---|
| 1 placement | 210 -> follow-up 276 **b**: a new block family inside the automations editor, not a separate tab | 17.1 |
| 2 lost sensor | 211 **a**: never acts; holds, then "defective" (`degraded`), optional notice | as 3.2 |
| 3 first actions | 212 **a**: flag and notify first, service request in phase 4, safe scene last and optional | as 4 / 14; see 17.3 |
| 4 identity | 213 -> 270 **a**: own service identity per scenario, author rights rechecked at every run; revoked = stop, mark defective, a manager reassigns | as 6.4, a service-identity record per scenario |
| 5 presence | 214 **a**: counts per area / floor only, never names | as 3.1 |
| 6 authors | 215 **b**: managers write scenarios from day one | 17.2 |
| 7 notices without rights | 216 **a**: generic notice without values | as 8 |
| 8 caps | 217 -> 271 **a**: 100 runs per day per rule, 20 service requests per day per rule, 600 actions per hour system-wide; overridable per rule, with a global default for rules that set none | 17.4 |
| 9 HA-only rules | 218 **a**: stay ordinary automations / blueprints, with a hint in the builder | as 2 |
| 10 history replay | 219 **a**: later (S8), temperature and water first | as 14 |

### 17.1 Placement inside the automations editor (Q1, implementation risk)

The scenarios appear as a **block family "חוצה מודולים"** inside the automations area: the same list chrome, tokens and editor frame as the
automations editor, with a "scenarios" filter beside automations / scenes / scripts. The owner's note says the blocks must mirror Arx data into the
editor read-only. Design that keeps the risk off the HA path:
- Evaluation and storage stay Arx-side (sections 5, 10). HA automations cannot see Arx data, and mirroring every module state as an HA entity
  is a write to HA, which this record forbids (1). So a cross-module block is never sent to HA, never converted to HA YAML and never mixed
  with HA triggers / actions in one item: an item is either an HA automation or an Arx scenario.
- The editor shows the Arx signals (catalogue, units, live values, freshness) read-only through `GET /scenarios/signals`; nothing in the
  editor writes to a module.
- Separate routes, tables, audit actions and switch (`scenarios.enabled`); the HA automation create / update path (`automation_ops`) is not
  touched, so turning scenarios off or removing them leaves automations unchanged. Tests assert that no scenario route calls the bridge.

### 17.2 Who may author (Q6)

`scenario.view` and `scenario.manage` are granted by default to the managers (`site_admin`) and the system administrator (`system_admin`);
`scenario.admin` (settings, kill switch, reassign) to `system_admin`. All three are grantable to any role. Section 8's reference rule still
applies: an author references only signals and actions they may use themselves.

### 17.3 Actions in the first build

Owner order (Q3) is flag + notify, then service request, safe scene last. The first build branch carries `set_flag`, `notify` and
`create_service_request` (each behind its own per-action switch, all OFF by default; the request action is absent when the service module is
off, owner rule of 20.10). `run_safe_scene` and every door / device action are NOT built. Any wider action needs an approved CR.

### 17.4 Caps (Q8)

Global defaults (Settings): `max_fires_per_day` 100 (range 1-1000), `max_tickets_per_day` 20 (range 0-200), `max_actions_per_hour` 600
(range 10-5000). Each rule may set its own `max_fires_per_day` / `max_tickets_per_day` inside the same ranges; a rule without its own
value uses the global default.

### 17.5 Migration

The build used PROVISIONAL migration number **0199**, final **0171** (`0171_scenarios.sql`, renumbered at the 2.16.0 integration, release/2160; it replaced the `0170` placeholder of section 5); the final number is
assigned at integration under the renumbering rule.