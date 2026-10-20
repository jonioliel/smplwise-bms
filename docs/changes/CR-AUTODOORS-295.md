# CR-AUTODOORS-295 - Automations that open WisKey doors (Arx side, fakes only)

Status: BUILT ON FAKES, OFF. Branch `pilot/AUTODOORS-295` from `origin/integ/293`. Backlog item `wiskey-automation-opens-doors`
(owner priority; it was BLOCKED on "WisKey W1 - automation operator type"). This CR builds the Arx side of that operator type and
everything around it; the live transport is NOT built and cannot be reached: `door_automation.GO_LIVE_PERMITTED = False`, the
switch `doors.automation_open` defaults to `off` and cannot be set to `on` in this build, and the live sender refuses every call.
No Home Assistant, bridge, WisKey station, door, key or lab device was touched to build or test it.

Precedence (CLAUDE.md): an approved change request, then `MASTER_SPEC_HE.md` and `docs/security/`, then `AGENTS.md`, then this
document. This CR becomes binding only when the owner approves it; until then it is a proposal with a working fake-backed build.
It extends CR-033 (WisKey door path) slice D10a ("Arx event door jobs") and replaces D10a's "stored approving actor" by an
explicit, non-human automation operator (section 3). Contradictions are listed in section 12.

## 1. What the owner gets

In the automation editor (Devices › Automations › an automation › the "Then" section) a new block **"Open a door"** appears, below
the Home Assistant steps, for a person who holds the new permission `access.doors.automate`. The block is an Arx object bound to that
automation; it is never written into the Home Assistant automation. When Home Assistant reports that the automation ran
(`automation_triggered`), Arx - not Home Assistant - decides whether to open each door on the block's allow-list, under the block's
own constraints, with a dedicated non-human identity, and records it in the access audit as an automation.

Safe by default: a new block is a draft; it does nothing until a person **arms** it; any edit, any change of the automation in
Home Assistant, a lost permission of the person who armed it, an expired arming or a storm disarms it; a global stop switch
("kill switch") stops all of them at once; a simulation shows what would happen without sending anything.

## 2. Scope

In scope (this branch):

1. `services/door_automation.py`: the automation operator principal, the block (policy) model and validation, arm / disarm /
   expiry, the fire path (`handle_trigger`) with every gate in section 5, simulation, loop protection, storm auto-disarm, kill
   switch, feature switch, the sender seam (fake in tests; the live sender refuses).
2. Migration **0145** (PROVISIONAL number; the lead renumbers at integration): `door_automations`, `door_automation_fires`.
3. `routers/door_automations.py` (`/api/v1/door-automations...`): status, list, get, create, update, arm, disarm, simulate, delete,
   fires, kill switch, settings.
4. The right to arm (owner decision 2026-10-21, section 12.1): every holder of `automation.manage` at the installation, plus the
   explicit permission `access.doors.automate` (sensitive, listed by `system_admin`; may be carried by a custom or station-scope
   role); removable per role (setting `doors.automation.excluded_roles`) and per person (`PUT /door-automations/users/{id}`,
   setting `doors.automation.removed_users`); an explicit deny binding of `access.doors.automate` also wins.
5. The hook in `services/automations.py` (`automation_triggered` -> `door_automation.on_event`), never raising into the mirror.
6. The access audit: fire rows are `intercom.release` rows whose actor is `automation:<id>` with `details.actor_kind =
   "automation"`; `GET /access/audit?actor_kind=automation` lists exactly them.
7. Frontend: the editor block `<door-automation-block>` (he / en / ar / ru; ar and ru are an initial translation, dev-marked),
   the API module with an in-memory mock for the demo mode, unit specs.

Out of scope (each needs its own approval): the live sender (it must go through `routers/access_control.open_door` with the relay
guard and, with `doors.trusted_path = on`, the signed `door_open` carrying the automation actor - WisKey's W1 appendix decides the
DTO actor shape); turning anything on; any lab or door test; a typed "open door" step inside the Home Assistant automation itself
(never: R-17, the door step stays in Arx); schedules (CR-033 6.4 moves them to WisKey hold-open programs); scripts and scenes.

## 3. The automation operator (principal type)

- One operator per block: `Principal(user_id="automation:<block id>", username="automation", display_name="<block name>",
  source="automation")`. The `automation:` prefix contains a colon, which no Home Assistant user id (32 hex), Arx local id (`l_...`)
  or developer id (`dev-...`) contains, so it can never collide with a person.
- **Never a human.** `door_authority.identity_ok` accepts only `ingress`, `remote`, `local` (extended mode) and `dev` (dev mode)
  sources, so the operator is refused by every human door path (tile, WisKey screen, notification, run). It holds no binding, so
  `rbac.authorize` gives it nothing anywhere. Conversely the automation path never accepts a human principal: `handle_trigger`
  builds its own operator from the stored block and nothing else (test `test_operator_is_never_a_human_and_humans_never_fire`).
- **Its own permission class.** The operator's authority is not RBAC; it is the block's allow-list, bounded by the authority of the
  person who armed it: at arm time AND again at every fire, that person must be active, still hold the right to arm for the
  station of every door on the list (`door_automation.may_automate`: not removed per person, no explicit deny, and either
  `access.doors.automate` on the station chain or `automation.manage` at the installation through a role that is not excluded),
  and pass the one door rule (`door_authority.check`) for that door. A person can therefore never delegate to an automation a door
  they cannot open themselves, and losing either right stops the automation at its next fire.
- Neither `access.doors.automate` nor `automation.manage` grants a person any door opening (they are not `access.doors.open`).

## 4. The block (policy)

| Field | Rule (validated on the server; defaults first) |
|---|---|
| `doors` | 1..16 entries `{station_id, relay}`; distinct; the station must exist in the served WisKey copy with that relay (at create, update and arm; fail closed without a copy) |
| `windows` | OPTIONAL (owner decision 2026-10-21): 0..7 entries `{days: [0..6] (Mon=0), start: "HH:MM", end: "HH:MM" or "24:00"}`, start < end; none = any time; evaluated in the installation zone (`time.zone`, IANA); an invalid zone refuses (`clock_untrusted`) |
| `cooldown_s` | optional; installation default 10 s (1..3600): per door, since this block's last attempt on it |
| `max_per_hour` | optional; installation default 30 (1..600): attempts per door in the last 60 minutes |
| `max_per_day` | optional; installation default 300 (1..10000): attempts of the block in the last 24 hours |
| `arm_days` | optional; installation default 180 (1..365): an arming expires; re-arming is a new human step |

Every number is an administrator setting (`doors.automation.<name>`, `PUT /door-automations/settings`, system administrator,
confirmed, audited), including the storm rule (`storm_refusals` default 5, 2..100; `storm_window_s` default 600, 60..3600). A step
that sets its own value uses it; otherwise the installation's value at fire time applies. A garbage or out-of-bounds stored value
falls back to the default, never to "no limit".

Every save bumps `policy_revision` and disarms (reason `edited`). The block binds to the automation's live revision at arm.

## 5. The fire path (`handle_trigger`) - order of gates, every refusal recorded, nothing sent

1. The event is `automation_triggered` for an automation that has a block (else: nothing, no row).
2. The block is armed (else: nothing - a draft or disarmed block is silent).
3. Feature: `doors.automation_open == "on"` AND `GO_LIVE_PERMITTED` (else `feature_off`).
4. Kill switch `doors.automation_kill` (anything but absent / `off` = stopped: fail closed on a garbage value) -> `killed`.
5. Arming not expired -> else `arm_expired` + disarm.
6. Autonomous trigger only: an event whose context carries a user id, or whose source is a manual run (`trigger action`,
   `manual`), is refused (`manual_trigger`): a person who wants a door open uses the human door path, judged as that person.
7. The automation's live revision equals the armed one, and it still exists -> else `item_changed` / `item_missing` + disarm.
8. Time window in the installation zone -> else `outside_window`.
9. Per door: the armer's authority (section 3) -> else `armer_lost_authority` + disarm; cooldown -> `cooldown`; hourly cap ->
   `rate_hour`; daily cap -> `rate_day`; station / relay still in the WisKey copy and online -> `door_unavailable`.
10. Send once through the sender with the operator as actor: attempt row committed first, then the outcome row. Never retried,
    never queued; an unknown outcome stays unknown; one door's failure does not stop the next door.
11. Storm: `storm_refusals` (default 5) refusals of kind cooldown / rate within `storm_window_s` (default 10 minutes) disarm the
    block (`storm`) and audit it.

## 6. Loop protection

- **Static, at arm:** the automation's triggers are read from the Arx mirror (`ha_config_items.config_json`). Arming is refused
  (`loop_risk`) when a trigger watches an entity of a door on the list (`intercom_doors.entities_for`) or any entity of the same
  WisKey station (`ha_entities.config_entry_id`), and refused (`triggers_unresolvable`) when a trigger cannot be resolved to
  entities (template, device, event, webhook, MQTT, purpose-specific, a templated entity id) - fail closed.
- **Runtime:** cooldown and the two caps bound any loop the static check missed; the storm rule disarms a block that keeps hitting
  them; a manual / human-context trigger never fires (step 6).

## 7. Kill switch, feature switch, simulation

- **Kill switch** `PUT /door-automations/kill {on, confirmed}`: turning it ON is allowed to any holder of `access.doors.automate`
  anywhere or a system administrator (stopping is the safe direction); turning it OFF needs `system.configure` (system
  administrator). Audited `door_automation.kill`. It stops firing; it does not disarm (so lifting it restores the previous state
  without re-arming dozens of blocks; each block still re-checks everything at the next fire).
- **Feature switch** `doors.automation_open` (`off` default): `PUT /door-automations/settings` refuses `on` with
  `door_automation_not_permitted` while `GO_LIVE_PERMITTED` is False. Both keys start with `doors.`, so a backup never carries them
  and a restore never loosens them (CR-033 section 9, existing rule).
- **Simulation** `POST /door-automations/{id}/simulate {at?, source?}`: the same gates, evaluated read-only (no rate counters
  consumed, no disarm, nothing sent), returns each gate with its result and each door with its decision; audited
  `door_automation.simulate`. Allowed while the feature is off (that is its purpose).

## 8. Audit ("shows up in the access audit as automation")

Every fire attempt writes the same two rows as a human opening (attempt committed before sending, then outcome), action
`intercom.release`, actor `automation:<id>`, with `details`: `actor_kind: "automation"`, `automation_id`, `automation_name`,
`automation_item_id`, `item_revision`, `policy_revision`, `trigger {source (<= 120 chars), time_fired}`, `armed_by`,
`entry_point: "door_job"`, `origin: "automation:<item id>"`, `door_request_id`, `station`, `relay`, `outcome`, `code`. A refusal
before sending is one `denied` row with the reason. Block life-cycle rows: `door_automation.create|update|arm|disarm|delete|
simulate|kill|settings|auto_disarm`. Never a signature, key, nonce, body or code.

## 9. Data (migration 0145, PROVISIONAL)

`door_automations` (one per automation, soft delete, state `draft|armed|disarmed`, policy JSON, `policy_revision`,
`bound_item_revision`, armer id / name / source, armed and expiry instants, disarm reason) and `door_automation_fires` (one row per
door decision that reached the per-door stage: outcome `sent|refused|unknown|not_sent`, reason, request id) for cooldown / caps /
storm and the block's history. Not in the backup allow-list: a restore can never revive an armed block (a decision to record:
the definitions are lost on a restore too; alternative: back them up and restore as `disarmed`). Rollback: older code ignores both
tables; drop them to remove the feature.

## 10. Tests (fakes only; `tests/test_door_automation_295.py`)

Operator identity, permission catalogue and grants, policy validation, create / update disarms, arm (human only, confirmation,
permission on every door, door rule, loop risk, unresolvable triggers, kill switch), every fire gate in order, outcomes and the
two audit rows, never retried, storm, expiry, revision binding, armer losing the right, kill switch rights, feature switch refusal
while not permitted, simulation side-effect free, the audit filter, the mirror hook never raising. Frontend unit spec: strings in
four languages, the block's view model (state chip, safe defaults, what is sent).

## 11. Section for the Fable security review (to be done before any go-live; reviewer: Fable, per owner policy)

Please review, with the code at the head named in the report:

1. **MANDATORY PRE-GO-LIVE ITEM - trust in the trigger (lead decision under the owner's delegation, 2026-10-21).** The fire is caused
   by a Home Assistant event (`automation_triggered`) received on the add-on's WS session; anyone who can fire that event in Home
   Assistant (an HA administrator, `event.fire`, a custom integration) can cause an attempt, bounded only by the gates of section 5
   and refused when it carries a person's context. Decision: the event stays the trigger for now, and BEFORE go-live Arx must also
   require the matching state change - the automation entity's `last_triggered` moving in the Arx mirror to the event's instant
   (within a few seconds, same entity, no earlier match consumed) - and refuse (`trigger_uncorroborated`) otherwise. NOT BUILT in
   this branch. Review the design of that check (ordering of the event and the state frame, clock skew, a reload or reconnect
   between them, replay of an old state frame) and confirm no go-live happens without it.
2. **Delegation semantics.** The armer's authority is re-checked at every fire; the operator itself holds nothing. Check that no
   path lets the operator principal reach `rbac.authorize` with a binding (prefix collision, a `users` row named `automation:...`
   from a restore or the directory sync).
3. **Fail-closed review** of every gate in section 5, especially the zone handling at DST changes (a window that starts in a
   skipped hour) and the kill-switch parsing.
4. **Loop protection completeness.** The static check covers state / numeric_state triggers by entity; review `zone`, `sun`, `time`
   (always safe), and whether a door's camera / doorbell entities (same WisKey config entry) are all covered by
   `config_entry_id`.
5. **Rate and storm numbers** (owner defaults 2026-10-21: 10 s / 30 per hour / 300 per day / 180-day arming / 5 refusals in 10
   minutes, all administrator settings) as physical-safety bounds in a public building, including the fire-safety question already
   open for door windows (owner fire-safety review); and the bounds an administrator may set (section 4).
6. **Audit completeness and privacy**: trigger source text is truncated to 120 characters and may contain an entity name; confirm
   that is acceptable in the access audit.
7. **The live sender** (not built): it must use `open_door` (relay guard, attempt-before-send), and with the signed path the DTO
   actor must be the operator (`automation:<id>`) plus the armer as `authorising_actor` - WisKey's W1 appendix must confirm the
   shape. Check that no live wiring can be added without flipping `GO_LIVE_PERMITTED` in the same commit.
8. **Concurrency**: two `automation_triggered` events for the same automation at once (two add-on workers are not supported:
   workers=1); the cooldown check and the attempt row are in one write transaction.

## 12. Decisions taken and remaining notes

Owner decisions of 2026-10-21 (taken, not open):

1. **Who may arm.** Anyone who may create automations (`automation.manage` at the installation) may arm a door-opening step; the
   explicit permission `access.doors.automate` (system_admin, custom roles, station-scope roles) grants it too. An administrator
   removes the right per role (`doors.automation.excluded_roles`, Settings) and per person (`PUT /door-automations/users/{id}`,
   system administrator or role administrator, confirmed, audited); an explicit deny binding of `access.doors.automate` also wins.
   The re-check at every fire that the arming person can still arm and can open each door themselves stays. (Creating a step still
   needs `automation.manage` at the installation, so a floor-scoped automation editor cannot create one.)
2. **Trust in the Home Assistant "automation ran" event** (delegated by the owner to the lead): the event stays the trigger for now;
   the matching state-change check is a MANDATORY pre-go-live item, not built now, listed first in section 11.
3. **Limits.** Few limits, reasonable (possibly heavy) use in a public building: the mechanisms stay, loosened, and every number is
   an administrator setting - wait between openings 10 s, 30 per door per hour, 300 per day, arming expiry 180 days, storm stop
   after 5 refusals in 10 minutes. Time windows are optional (none = any time); the doors a step opens are named per step (the
   step's door list is what it opens - there is no separate allow-list to configure). The global kill switch stays.
Remaining notes:

4. The automation operator model (section 3) replaces CR-033 6.4's "stored approving actor" for automations (the operator plus the
   arming person's re-check; the audit names both). Not yet confirmed by the owner as such.
5. CR-017 decision 6ג allows sensitive steps in HA automations under manual-control grants; CR-033 R-17 forbids WisKey door steps
   inside HA. This step keeps R-17: the door step never enters Home Assistant.
6. Backup: steps are not backed up (section 9), so a restore never revives an armed step; the definitions are lost on a restore.
   The `doors.automation.*` settings start with `doors.` and are therefore never carried by a backup (CR-033 section 9).
7. Migration number 0145 is provisional; the lead renumbers at integration.
