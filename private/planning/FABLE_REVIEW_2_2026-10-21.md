# Fable security review 2 - door windows / emergency, door-automation hardening, bridge key-rotation activation, extended identity and capture-lease permits (2026-10-21)

Independent read-only review (Fable). No product code was changed on any branch; no live system, Home Assistant, bridge, WisKey or
tunnel was contacted; no secret, host, address, serial or token appears here. Owner context: on 2026-10-21 the owner approved removing
the activation blockers for the WisKey capabilities in the ECC and made every door-related activation conditional on a security review.
This document is that review for the four items the lead named. Precedence (AGENTS.md): approved change request -> `MASTER_SPEC_HE.md` /
`docs/security/` -> `AGENTS.md`. Contradictions are recorded, not resolved (section 7).

## 0. Heads reviewed (pinned) and method

| Scope | Ref | Commit reviewed | Base used for the diff |
|---|---|---|---|
| 1 door windows + emergency | `origin/integ/2102` | `9a8adbaf8` | `origin/main` bd4636e7f |
| 2 door-automation hardening | `origin/pilot/DOORHARD-295` (in progress) | `cb508bd5d` | bd4636e7f |
| 3 bridge key-rotation activation | `origin/pilot/HMACACT-295` | `2243a6ca5` | bd4636e7f |
| 4 extended identity / capture lease | `origin/main` bd4636e7f = the same files on `origin/integ/2102` | `service_identity.py`, `capture_lease.py`, bridge `runnable.py` | - |
| reference | `origin/pilot/FABLE-REVIEW-295` | `32ae1b1ce` (`docs/security/FABLE_REVIEW_REPORT_2026-10-21.md`, findings A-*, H-*) | - |

- **Verified by reading (READ)**: every file:line below was read at the pinned commit in a detached worktree; routes, transactions and
  gates were traced by hand. Unless a line says TESTED, it is READ.
- **Tested (this review)**: the branch test files were queued on the workstation through `local_run.sh` (the only allowed way to run
  pytest locally). The wrapper admits a job only with more than 3 GB free memory; the machine had 2.4-2.8 GB free throughout the review,
  so the jobs were still waiting when this report was written. **Result: NOT_RUN** for every test file (section 6). Nothing below is
  reported as passing on the strength of a test this review did not see run.
- **Not verified** (section 8): the frontend specs, the integration against a real Home Assistant, the WisKey W13 wire shapes (they do not
  exist), the ha_sync mirror's handling of bus events, the stale-copy emergency start.

## 1. Summary

| Severity | Count | IDs |
|---|---|---|
| high | 1 | HA-01 |
| medium | 9 | W-01, E-01, E-02, E-03, E-04, DA-01, HA-02, X-01, L-01 |
| low | 13 | W-02, W-03, E-05, E-06, E-07, E-08, DA-02, DA-03, DA-04, HA-03, HA-04, HA-05, HA-06 |
| info | 8 | W-04, E-09, E-10, DA-05, HA-07, HA-08, X-02, L-02 |

### Verdicts per capability (details and exact conditions in sections 2-5)

| Capability (permit / switch) | Verdict | Blocking conditions (all must be true before the permit flips) |
|---|---|---|
| Door windows, tier D "prepared" (`doors.windows.enabled` on, no engine) | **GO** | none; W-01 is a correctness bug even in this tier (the UI promises a cancel that reverts) - fix in the same release as the switch default |
| Door windows, tier B (WisKey hold-open programs; `door_windows_engine.GO_LIVE_PERMITTED`) | **GO-WITH-CONDITIONS** | (1) W-01 fixed; (2) the WisKey program coordinator exists and the W13/U2 answers are written into `WiskeyProgramEngine` - today every live call is `not_implemented`; (3) one lab write of a program to one interior door with the owner present, then a full relock cycle watched to `closed_confirmed`; (4) W-02 decision recorded (self-approval accepted or a second approver required) |
| Emergency LOCK ("Secure"; `doors.emergency.enabled`) | **GO-WITH-CONDITIONS** | (1) E-01 fixed (release never behind the master switch); (2) E-03 (a deadline at the seam, `pending` rows age into `unknown`); (3) the W13-e `lock_secure` command and its idempotency by `request_id` confirmed in writing by WisKey; (4) drills run first (allowed today); (5) one lab LOCK + release with the owner present |
| Emergency OPEN (`doors.emergency.open_enabled`) | **NO-GO** (today impossible: `open_supported` is False) | everything of LOCK, plus (6) E-02 resolved in the W13-e contract (OPEN supersedes LOCK on the engine, or Arx releases the LOCK first); (7) E-04: WisKey confirms the apply is idempotent by `request_id`, otherwise the E-1 retry ships OFF by default; (8) the life-safety attestation (built) and the owner's hardware review (CR-039 8.9) |
| Door automation (`doors.automation_open`; branch DOORHARD-295) | **Merge: GO-WITH-CONDITIONS. Permit: NO-GO** | merge after the branch's tests have run green (they were "not yet run" at the head reviewed); permit only after (1) DA-01 (corroborate against a direct Home Assistant state read, not the event-fed mirror); (2) a reviewed live sender exists (`LiveSender` refuses today) and the WisKey W1 operator contract is answered; (3) owner answers 12.1/12.4 are in the CR (they are) and the ten A-items stay closed |
| Bridge key rotation (`bridge_rotation.GO_LIVE_PERMITTED = True` on HMACACT-295) | **NO-GO as the head stands; GO-WITH-CONDITIONS after HA-01** | (1) HA-01 fixed on both sides (the bridge never signs a refusal of an unverified message; Arx's inbound routes refuse a control-protocol body and a push without a `users` list); (2) the branch's two test files run green (NOT_RUN here; the head's own commits say "untested"); (3) HA-02: release notes + user guide state the three re-pair situations (rollback, restore to another host or key-file loss, Home Assistant restored from a pre-rotation backup) and the first automatic rotation is either announced to the administrator or made a one-click manual step; (4) one lab run against the real bridge 0.9.5 (never done - "no HA access was used") |
| Extended service identity (`EXTENDED_GO_LIVE_PERMITTED`) | **NO-GO today** | the go-live pack's own steps are not done: (1) the amendment of `docs/security/HA_IDENTITY_RBAC_HE.md` sections 7-8 is still a DRAFT file and the master still says 1.1 (X-01); (2) the dedicated re-review of the bridge impact check (`FABLE_REREVIEW_BRIEF.md`, 20 questions) has not been performed - not by the 2026-10-21 review and not by this one; (3) the permit commit recipe of `GOLIVE_CHECKLIST_HE.md` step 5 (tests flipped, texts changed, CR-USR2 12.8); (4) full gate; (5) supervised first run (step 7). With HMACACT merged first, the extended-mode messages ride the key set unchanged (X-02) |
| Capture lease to card intake (`capture_lease.GO_LIVE_PERMITTED`) | **NO-GO today** | its dependencies do not exist: (1) no bridge release offers `lease_event` (grep: none) and `MIN_BRIDGE_FOR_CAPTURE_LEASE` / `trusted_door.MIN_BRIDGE_FOR_TRUSTED_PATH` are None; (2) WisKey's consumer of the lease events (CR 7.4) is unverified; (3) after HMACACT the lease and trusted-door envelopes carry a `kid` - the bridge-side verifier of those services must be `keyset.KeySet.verify`; (4) the card grant path itself (`access_grants.GO_LIVE_PERMITTED`) is a separate permit (`grants-cards-x5` answers `access_grant_card_not_built`); (5) owner permit + lab run with the owner's test card (the owner form item) |

## 2. Scope 1 - door windows and emergency controls (`origin/integ/2102` 9a8adbaf8)

Files: `services/door_windows_engine.py` (233), `services/door_windows.py` (936), `services/door_windows_watch.py` (210),
`services/door_emergency.py` (612), `routers/door_windows.py` (515), `rbac.py:40-44`, `roles.json`, `migrations/0137_door_windows_emergency.sql`,
`docs/changes/CR-039-DOOR-WINDOWS-AND-EMERGENCY.md`.

### 2.1 What holds (READ)

- **Authority.** The four permissions are station permissions judged on the chain with deny-wins (`rbac.py:44`; `door_windows.py:200-221`;
  `door_emergency.py:170-181`). Defaults (`roles.json`): `access.emergency.open` -> `system_admin` only (owner decision 2026-10-13, CR 7.2);
  `access.emergency.lock` -> `system_admin` + `site_admin`; `access.windows.manage` -> `system_admin` + `site_admin`; `access.windows.cancel`
  -> those + `operator`. The lead's phrase "system_admin only" is true for OPEN; LOCK is wider by design - the owner should know (E-06).
  Settings and the exterior flag need `system.configure` (`routers/door_windows.py:322-362, 477-515`).
- **Person rule.** Every write goes through `require_person` (`door_windows.py:176-197`): `identity_ok` (ingress / remote / dev-in-dev-mode /
  local only in the extended mode), active user, never a wall or kiosk account, never a bearer-token client. `actor_kind` is never read from
  the client (`routers/door_windows.py:409, 432`); the only non-person path (`doors.emergency.automations`) cannot be switched on
  (`door_emergency.py:140-141`) and nothing calls it.
- **Replay / spoofing of the emergency press.** Two-step: `prepare` stores only SHA-256 of a 24-byte token bound to person, action, kind,
  scope, incident and drill, 20 s TTL (`door_emergency.py:319-325`); `start` / `release` consume it with a compare-and-set
  (`UPDATE ... WHERE used_at IS NULL`, rowcount 1, `:341-342`), re-run every check (`:355-377`) and need `confirmed: true` (`:350`).
  `client_request_id` is UNIQUE (0137) and pre-checked (`routers/door_windows.py:429-430`). The request connection is BEGIN IMMEDIATE
  (`auth.py:85-91`, `db.py:455-460`), so two concurrent starts are serialised and the second sees the first's incident (`active_incident`).
  A drill token cannot start a real incident (the drill flag is in the token row, `:353`). A drill never gets the live engine (`:445-447`).
- **Kill switch / permit.** `enabled()` = setting on AND `GO_LIVE_PERMITTED` (`:116-117`); the setting cannot be turned on without the
  permit (`:133-134`); OPEN additionally needs its own switch, the attestation (hash + version) and `open_supported` (`:120-121, 135-139`);
  turning LOCK off turns OPEN off (`:148-150`). The live engines refuse `not_permitted` and below that `not_implemented`
  (`door_windows_engine.py:143-147, 172-176`); the factory never hands a live window engine out without the permit (`:216-217`).
- **Fail closed on UNKNOWN.** `EngineError(kind="unknown")` -> door outcome `unknown`, any other error -> `refused`, any transport exception
  -> `unknown`, never `acknowledged` (`door_emergency.py:470-473`). For windows: `_write_program` reads before every write (`door_windows.py:758`),
  an `error` outcome clears `written_sha256` and the next pass re-reads instead of saving blind (`:835-836`), the watchdog treats an
  unreadable status as no confirmation (`door_windows_watch.py:71-72, 90-93, 112-113`), `ProgramState.idle` needs an EXISTING program in
  `idle` and not `owned` (`door_windows_engine.py:61-64`), and `program_state_of` maps anything unreadable to `unknown` / `owned`
  (`:75-79`). SR-1 holds: the seam has `read / save / pause` only, the watchdog's one write is `pause` (`door_windows_watch.py:173`).
- **Rate limits.** `prepare` 10 / min per person in memory (`:239-247`); `start` one per 10 s and five per hour per person, twelve per hour
  per installation, drills ten per hour, counted from the incidents table (`:250-262`).
- **Audit.** Every refusal and every allow writes a row with the person (`_refuse`, `:271-273`); per-door results and watchdog transitions
  are system rows with ids only; tokens never appear (`test_doorwin_api.py::test_nothing_secret_lands_in_the_audit_or_the_answers`, NOT_RUN here).

### 2.2 Findings

**W-01 - medium - a guard's cancel of a FUTURE occurrence does nothing on the engine and is undone by the next compile (READ).**
`routers/door_windows.py:224-227` (`end-now` on a `prepared / planned / armed` occurrence whose start is ahead marks it `cancelled`,
`resolution = 'override'`, and sends nothing - the `pause_door` call runs only for the `ending` outcome, `:241-242`);
`services/door_windows.py:727-728` (`_store_plan` re-plans ANY `cancelled` future occurrence whose token is still in the plan - it does not
look at `resolution`); `:845-846` (`sync` stores the plan on every pass, every 300 s or on any wake). *Consequence*: in tier B the WisKey
program still contains the period, so the door is held open at the planned time; between the cancel and the next `sync` the occurrence is
`cancelled` and therefore NOT judged by the watchdog (`door_windows_watch.py:37`); at the next `sync` it silently comes back as `planned` /
`armed`. The screen told the guard "cancelled". *Fix*: either refuse `end-now` for a future occurrence (409 `not_running`) - the honest
minimum - or make the override part of the compile: a per-door, per-date exclusion (the `door_window_calendar` shape, scope the door) that
`compile_door` subtracts, so the program on the engine omits the period and `_store_plan` never re-plans it; and never re-plan a row whose
`resolution` is `override`. CR-039 7.1 promises "cancel the rest of today's occurrences", so the second option is the one that matches the CR.

**E-01 - medium - the release path is behind the same master switch and permit as the start path (READ).**
`services/door_emergency.py:294-298` (`prepare` refuses `emergency_off` for `action = "release"` too), `:116-117` (`enabled()` is the
setting AND the build permit). *Consequence*: a LOCK or OPEN that is in effect cannot be released through Arx once an administrator turns
`doors.emergency.enabled` off, or after a rollback / downgrade to a build whose permit is False - the doors stay in the emergency state until
someone acts in the WisKey panel. For an OPEN that is every door held open with no Arx release. *Fix*: the release step must not read the
master switch (keep the permission, the person rule and the token); the permit check for a release should only require the engine's
`release` method to exist; and `update_settings` should refuse turning `ENABLED` off while an incident is active (409 `incident_active`) or
offer the release in the same dialog. Add a test: switch off during an incident -> release still works.

**E-02 - medium - OPEN over LOCK supersedes the LOCK in the database without releasing it on the engine (READ, W13-dependent).**
`door_emergency.py:386-390` (the superseded LOCK is set to `released` with `superseded_by`; no `release`-phase rows are written for it, so
`dispatch(..., "release")` never runs for its doors), `:509-517` (its pauses are cleared only when the OPEN is later released). Whether this is
safe depends entirely on a W13-e contract that does not exist: if `lock_secure` is a state the engine must be told to end, the OPEN apply may
be refused or doors may stay secured while Arx says "released". *Fix*: write into the W13-e request that an `open` apply supersedes a
`lock_secure` per door (and that the per-door answer says so), OR insert `release` rows for the superseded incident and send them before the
OPEN apply. Condition for OPEN.

**E-03 - medium - no deadline anywhere between the confirmation and the engine (READ).**
`door_emergency.py:463-480` (`dispatch`: `_pool().map(one, pending)` with no timeout; `one()` only maps exceptions), `:542-555` (`retry_tick`
looks at `unknown` rows only). A WisKey call that hangs leaves the door row `pending` and the incident `applying` for ever; the headline never
becomes partial, no retry, no notification. *Fix*: the live engine must bound every call (a few seconds) and map a timeout to
`EngineError("unknown")`; independently, `retry_tick` (or `_recount`) should age rows still `pending` / `sent` after N seconds into `unknown`
so the bounded retry and the partial headline apply. Condition for LOCK.

**E-04 - medium (design, recorded as a contradiction) - the E-1 exception repeats an OPEN after an UNKNOWN outcome (READ).**
`door_emergency.py:483-486` (`_retryable`: `phase == "apply"` for both kinds), `:497` (three attempts, 10 s apart), CR-039 8.4 and 19.5.
The lead's brief says "must never open on UNKNOWN"; AGENTS.md says "never queue or blindly retry physical commands"; the CR records the
exception deliberately (a closed exit during an evacuation is the greater harm). The code does the right small things: the same per-door
`request_id` is reused on every attempt (`:467`), so an engine that de-duplicates by request id makes the repeat harmless. *Condition*:
WisKey confirms in W13-e that `apply` is idempotent by `request_id`; if it cannot, ship E-1 behind a setting that defaults OFF (retry the
close direction only). Either way the contradiction stays recorded (section 7).

**E-05 - low - a duplicate `client_request_id` racing the pre-check becomes a 500, not a 409 (READ).** `routers/door_windows.py:429-430` reads
first; the UNIQUE constraint (0137) catches the race as `IntegrityError`. Harmless (the second press fails), cosmetic fix: catch and answer
`duplicate_request`.

**E-06 - low - defaults the owner has not confirmed (READ).** `roles.json:38` gives `operator` `access.windows.cancel`, which also allows the
manual relock confirmation (`routers/door_windows.py:263`) - the action that clears a CRITICAL "relock unconfirmed" alarm on a person's word.
CR-039 20.4 marks the operator default "recommended, not yet explicitly confirmed". `access.emergency.lock` is held by `site_admin` by default
(CR 7.2, confirmed). *Ask the owner*: (a) operators may end a window AND confirm a relock by eye; (b) operators may end a window only; (c)
neither. Recommend (b): confirmation of a relock belongs to `manage`.

**E-07 - low - station ids of doors the reader may not see are returned (READ).** `routers/door_windows.py:66-74, 98-101`: a rule that touches
one visible door is returned with all its doors (`visible: false` for the others, but with `station_id` / `relay`). Ids only; low. *Fix*:
replace non-visible doors by a count.

**E-08 - low - `prepare`'s rate limit is per process (READ).** `door_emergency.py:230-247`: a restart resets it. The start limits are durable
(`:250-262`), so the effect is bounded to token minting. Acceptable; note.

**E-09 - info - `put_door_flags` does not check that the door exists in the directory (READ).** `routers/door_windows.py:350-362`. A stray row
can only ever REFUSE a rule (`exterior_not_allowed`). Safe direction.

**E-10 - info - the stale-copy start of CR-039 8.7 is NOT VERIFIED.** `doors_in_scope` reads `dw.doors(conn)` = `intercom_sync.SYNC.stations()`
(`door_windows.py:140-156`); whether that returns the last known copy or an empty list when the feed is down was not traced. If empty, a start
answers `no_doors` (safe direction, but not what the CR promises).

**W-02 - low - self-approval (READ).** `door_windows.py:450, 468-470`: the person who saves or enables a rule is its approver; an enabled rule
edited by another manager makes the editor the approver. No second pair of eyes for an installation-wide hold-open. The CR-033 6.4 / D10a
contradiction is already recorded (first review 8.2). *Recommend*: a second approver for rules touching more than N doors or any exterior door.

**W-03 - low - a lost approval stops the program only at the next compile (READ).** `door_windows.py:481-498, 783-784, 819-821`: `stale_approvals`
runs inside `sync` (every 300 s or on a wake). Deactivating the approver or removing the permission does not wake the worker, so the engine
program can run up to 5 minutes on a stale approval. *Fix*: wake `dw.WORKER` from the user-deactivation and binding-revocation paths.

**W-04 - info - verified**: the compile is pure and bounded (`compile_door`, `:585-619`: per-day cap, exception cap, no fixed offsets); DST
handled by wall-clock token semantics (`wall_instant`, `:259-275`); the master switch off compiles "no program" for every door and pauses
what Arx wrote (`sync`, `:775-779`); a foreign program is never written (`_write_program`, `:759-760`), only paused in an emergency
(`pause_door`, `:859-860`, CR 19.3).

## 3. Scope 2 - door-automation hardening (`origin/pilot/DOORHARD-295` cb508bd5d) against A-01..A-10

Files: `services/door_automation.py` (1182), `services/backup.py` (restore: `:552-593, 686-721`), `migrations/0150_door_automation_hardening.sql`,
`docs/changes/CR-AUTODOORS-295.md` (sections 6-9, 12), `tests/test_door_automation_295.py` (56 tests; the head's commit says "tests not yet run").

### 3.1 Status of the first review's findings (READ)

| Finding | Status at cb508bd5d | Evidence |
|---|---|---|
| A-01 trust in `automation_triggered` (high) | **Closed on the Arx side, with a residual (DA-01)** | `corroboration()` `:871-909`: the automation entity's `last_triggered` within `corroborate_window_s` (default 10 s, bounds 2..120) of now AND newer than `door_automations.corroborated_trigger`; for state / numeric_state triggers a watched entity changed in the same window (`last_changed`, or `last_updated` for an attribute trigger); unreadable fails closed; `_consume` `:912-916` matches one run to one event under the write lock; re-check for 3 s because the event may precede the state frame (`:1061-1086`); `uncorroborated` counts as a storm reason (`:77`) |
| A-02 switches outside the per-door transaction (medium) | **Closed** | `_switch_reason` `:1010-1020` re-reads kill, feature+permit and expiry inside `_fire_door`'s transaction (`:1025-1030`) |
| A-03 one-hop loop check, per-block caps (medium) | **Closed** | per-door cap across every block, deleted blocks included (`:971-977`, index in 0150), administrator settings with bounds (`:70-72`); the one-hop limit is written into the CR (6) |
| A-04 manual detection by HA wording (low) | **Closed** | `is_manual` `:830-841`: `user_id` OR `parent_id` -> manual; empty or unknown source -> manual (fail closed); allow-list `AUTOMATIC_SOURCES` `:85-86` |
| A-05 dev_mode (info) | unchanged | `:1065` |
| A-06 delegation (info) | unchanged, still correct; owner 12.1 adds the armer to every fire row (`:987-989, 1036-1038`, 0150) | |
| A-07 backup / kill-switch persistence (low) | **Closed, owner 12.3** | `door_automations` in `PROJECT_TABLES` and `KEEP_WHEN_ABSENT`, `door_automation_fires` in `NEVER_EXPORTED_TABLES` (`backup.py:50-80`); `_sanitise_door_blocks` drops invalid rows and disarms armed ones before insert (`:686-709`); `_disarm_restored_blocks` runs whenever the table exists in the installation (`tables` is the installation's list, `:552, 593`), so an older archive without the table also leaves no armed block (`:711-718`) |
| A-09 one thread per event (low) | **Closed** | bounded queue of 256 and ONE worker, drops counted and shown to the administrator (`:1107-1135, 757`) |
| A-10 DST edges (low) | **Documented** | `in_window` docstring `:213-216`, CR 6 step 8, test `test_dst_edges_are_safe_and_documented` |
| GO_LIVE_PERMITTED | still False (`:48`); `LiveSender` refuses (`:108-114`); the feature switch cannot be on (`:710-712`) | |

### 3.2 Findings

**DA-01 - medium - the corroboration trusts the same bus the attacker fires on (READ; mirror ingestion NOT VERIFIED).**
`door_automation.py:886-891, 903-905` read `ha_entities.attributes_json` (`last_triggered`) and `last_changed` / `last_updated` - the Arx
mirror, which is fed by `state_changed` events over the same WebSocket subscription that delivers `automation_triggered`. The adversary of
A-01 ("any integration or script in Home Assistant can fire `automation_triggered` with no context") can fire `state_changed` events for
`automation.<x>` (with `last_triggered = now`) and for the watched entity just as easily; a bus subscriber cannot tell a fired event from a
state-machine change. If `ha_sync` applies `state_changed` frames to the mirror without consulting the state machine (not traced here), the
gate is defeated by the same capability it was built against. *Fix*: at decision time read the automation entity and the watched entity
once from Home Assistant's state machine (`GET /api/states/<entity_id>` through `ha_client`, one authenticated REST call, fail closed on any
error) and corroborate against THAT; keep the mirror as the cheap pre-filter. The state machine cannot be changed by firing an event. The
HA administrator remains trusted either way (he can run `automation.trigger` with his own context - which `is_manual` refuses - or edit the
automation, which `item_changed` disarms). Condition for `doors.automation_open`.

**DA-02 - low - the one worker sleeps up to 3 s per uncorroborated event (READ).** `:1066-1085` with `CORROBORATE_WAIT_S = 3.0`; `:1098-1101`
already filters to automations that have a block, so only events of armed blocks reach the loop. A burst of forged events for one armed block
delays every legitimate event behind it by up to 3 s each, and 256 of them fill the queue. Storm disarm (`:994-999`) ends it after
`storm_refusals` (default 5). *Fix*: skip the wait when the queue depth is above a few items, or wait once per (block, stamp) rather than per event.

**DA-03 - low - the poll loop takes a write transaction every 0.2 s (READ).** `:1068` opens `db.connection()` (BEGIN IMMEDIATE) for every
re-check although only `_consume` writes. Up to 15 short write transactions per event compete with the application's single write lock.
*Fix*: evaluate the gates on `mode="read"` and open the write only when `matched` is non-empty.

**DA-04 - low - `at = now()` is the dequeue time, not `time_fired` (READ).** `:1072`, `:802` keeps `time_fired` for the audit only. Under queue
delay beyond `corroborate_window_s` a legitimate event is refused as `uncorroborated` (safe direction) and counts towards a storm disarm.
Acceptable; document, or widen the window by the queue age.

**DA-05 - info - verified**: `validate_policy` rejects unknown keys, non-literal ids, duplicate doors, bad windows (`:260-306`); the operator
principal never reaches a grant (`_NOT_FROM_A_GRANT`, `:98, 541, 1042`); `manage_reach` at a floor is bounded to the automations the person
may see (`:390-413`) and the operator is refused there (`:395-396`); the per-user removal and role exclusion are honoured at arm and at every
fire (`:447, 957`); migration 0150 is additive and provisional.

## 4. Scope 3 - bridge key-rotation activation (`origin/pilot/HMACACT-295` 2243a6ca5) against H-01..H-09

Files: `services/bridge_keys.py` (441), `services/bridge_rotation.py` (727), `services/bridge_rotation_peer.py`, `services/ha_bridge.py`,
`routers/ha.py:626-700`, `main.py:583-590, 725-733`, `migrations/0155_bridge_key_activation.sql`, integration `keyset.py` (336),
`__init__.py` (the `rotate` service, the `Store`, `persist`), `const.py`, `services.yaml`; `tests/test_bridge_key_activation_295.py` (23 tests,
NOT_RUN here; the head's commits say "WIP, untested" and "test fix").

### 4.1 Status of the first review's findings (READ)

| Finding | Status at 2243a6ca5 | Evidence |
|---|---|---|
| H-01 rotation rotates nothing that is verified (high) | **Closed** | `ha_bridge.signing_key` returns the current sealed key as a `BridgeKey` once adopted (`ha_bridge.py` diff `:226-236`), `sign` signs v2 for any kid but `g0-legacy` (`:256-261`), both inbound routes verify through `verify_message` (`routers/ha.py:643, 654`), which uses the key set once adopted and the plain secret before (`ha_bridge.py:287-299`); `adopt_legacy` seals the secret and `DELETE`s `settings.bridge.secret` in the SAME transaction (`bridge_keys.py:304-316`), called inside `write_aside()` = BEGIN IMMEDIATE (`bridge_rotation.py:250-253`, `db.py:499-511`); a restore never brings the plain secret back (`backup.py:424-425`, `bridge.secret` in `SETTINGS_KEEP` is skipped on insert) |
| H-02 state oracle before the MAC (medium) | **Closed** | `bridge_keys.verify` `:362-377`: MAC first with a dummy key, one wire code `bad_signature` for every pre-MAC refusal, reasons in a process counter; `stale` and the high-water after the MAC (`:388-393`); the same order in the bridge (`keyset.py:199-234`); the HTTP routes collapse to `bridge_bad_signature` except `stale` / `replay` after a proven key (`ha_bridge.py:284-297`) |
| H-03 hygiene, not recovery (medium) | **Closed (text)** | card string, CR section 15, user guide `84-bridge-key_HE.md` ("חשוב: תחזוקה, לא טיפול בדליפה"); test `test_h03_...` |
| H-04 process-local nonce cache (low) | **Closed** | `bridge_keys.hw_ts` (0155), `_boot_hw` / `_note_highwater` (`:390-409`); the same rule in the bridge (`keyset.py:223-233`) |
| H-05 repair on the peer's word (low) | **Closed** | `_repair` probes under K_next and requires `ok` under K_next before retiring K_cur (`bridge_rotation.py:544-554`) |
| H-06 old material as a Python str (info) | unchanged, unavoidable | |
| H-07 sealed blob in free pages / WAL (info) | **Closed** | `PRAGMA secure_delete` on the wipe, `wal_checkpoint(TRUNCATE)` after retire / discard / rollback / repair (`bridge_keys.py:277-301`) |
| H-08 downgrade guard | **Kept, correctly relaxed** | a kid-less message verifies against `g0-legacy` while it is `current` or inside its `retiring` window, INCLUDING while K_next is `pending` / `next` (`:380-387`) - necessary, because the bridge signs kid-less until the commit; after the first completed rotation the legacy key has no material and every kid-less message is `bad_signature` (`:371-372`) |
| H-09 answers under either key (low) | **Closed** | `_call(expect=...)`: `begin` / `abort` / pre-switch probes under K_cur, `commit` / `retire` / post-switch probes under K_next (`bridge_rotation.py:183-208`); a `status` claiming `committed` must be signed under K_next (`:446-448`) |

Upgrade order (READ, matches CR 15): Arx first -> `auto_wanted` is true (legacy secret present) but `peer_available` is false until the bridge
announces `rotation_v1` in its signed push, so nothing starts and nothing is adopted (`bridge_rotation.py:677-686`, `bridge_rotation_peer.py:78-104`,
TTL 600 s). Bridge first -> the bridge signs kid-less with the pairing secret until it receives `begin` (`keyset.py:178-189`); the extra
`rotation` field is inside the signed body and ignored by an old Arx. Both updated -> the first rotation starts by itself 45 s + one worker
pass after boot, once the directory push has been verified (`main.py:725-733`, `worker_loop`). `ha_client.call_service` unwraps
`service_response` (`ha_client.py:567`), so the peer's answer is the signed message itself; `CALL_TIMEOUT_S = 20` fits the 100 s commit budget.

### 4.2 Findings

**HA-01 - HIGH - the bridge's `rotate` service is a signing oracle for unauthenticated callers, and one of its answers deactivates every
operator in Arx (READ).**
Bridge: `keyset.py:246-257` (`handle_control` answers EVERY message - including one that failed `_check` - with `_answer(...)`, which signs the
body with the bridge's signing key, `:242-244`); the body is `{protocol, op, rotation_id, reply_to, ok: false, code}` with `op` (12 chars) and
`rotation_id` (unbounded at that point) taken from the caller. Before this slice the bridge signed exactly one thing, its own directory push
(`origin/main` `__init__.py:493`); it never signed a reply to anyone. The `rotate` service is a Home Assistant service like any other: any
Home Assistant user or automation allowed to call services can call it (`__init__.py` diff `:481`; HA has no admin-only flag for a custom
service). Arx: `routers/ha.py:654-671` verifies the push and applies it; `users = message.get("users") or []` turns an ABSENT key into an empty
directory; `_apply_directory_to_users` (`:711-714`) then sets `active = 0` for every ingress / remote user who is not a system administrator
("missing_from_directory") and revokes their sessions. `/ha/bridge/ping` (`:641-648`) accepts the same body and rewrites `bridge.paired_at`,
`bridge.integration_version = ""` and runs `_lease_repair`. `note_capability(None)` clears the rotation capability (`bridge_rotation_peer.py:83-84`).
*Exploit*: once Arx has adopted the key set (the first automatic rotation does that, `bridge_rotation.py:253`), an HA user with service-call
rights calls `smplwise_bridge.rotate` with any well-formed but unsigned message, receives a correctly signed v2 answer, and POSTs it to the
add-on's `/api/v1/ha/bridge/directory` (reachable from the Home Assistant host network, where every add-on and integration lives) within 60 s:
every operator is locked out of Arx until the next real push (60 s) re-enables them - repeatable every minute, with `bridge.integration_version`
and the rotation capability flapping. Before adoption the attack fails (the v2 input string does not match the v1 recipe Arx still uses).
*Fix* (all three, cheap): (1) `keyset.handle_control`: when `_check` refuses, answer an UNSIGNED `{"ok": false, "code": "bad_signature"}`
(the add-on's `_call` already treats an unverifiable answer as `peer_bad_answer`); never sign a body a non-holder of the key chose; (2) domain
separation on Arx: `verify_message` / the two inbound routes refuse a body whose `protocol` is the rotation protocol (or, better, give every
signed body a `purpose` the route checks, as `cast_origin` already does); (3) `bridge_directory` requires `isinstance(message.get("users"), list)`
(422 otherwise) - a push without a user list is malformed, never "everyone left". Add tests for each. **Blocks the merge of HMACACT-295.**

**HA-02 - medium - the first rotation is automatic and has three cliff edges the administrator is not told about (READ).**
`bridge_rotation.py:652-660, 689-702` (starts by itself when the bridge announces); `migrations/0155` (the note says a rollback to an older
build must re-pair); `bridge_keys` rows are `NEVER_EXPORTED` and the seal uses the per-install key file (`connection_store.seal_bridge_key`),
so (a) a rollback of Arx to a pre-HMACACT build, (b) a restore of Arx to another host or any loss / unreadability of the key file (before this
slice the plain secret survived both), and (c) a Home Assistant restored from a backup taken before the rotation (`KeySet` falls back to the
pairing code in the entry if the Store is gone, `keyset.py:119-120`, but that code is a retired key on the Arx side) each leave the bridge
dead until a re-pair. `signing_key` returns None in (b) - fail closed, correct, but silent. The user guide covers hygiene, not these.
*Fix*: release notes and `84-bridge-key_HE.md` name the three cases and the re-pair procedure; show a one-time notice on the card before /
when the first rotation runs ("the pairing code will be retired; keep a bridge backup from after this moment"), or make the FIRST rotation a
one-click manual step and only the reminder rotations automatic. Condition for the permit.

**HA-03 - low - the pairing endpoint answers `pairing_code: null` after adoption (READ).** `ha_bridge.ensure_pairing` returns None (`:241-249`);
`routers/ha.py:636-640` returns it as is. The frontend change (`system-diagnostics.ts`, 6 lines) was not reviewed; make sure the screen says
"the pairing code was retired by the key rotation; regenerate to re-pair" rather than an empty field.

**HA-04 - low - the bridge's delayed save clears `dirty` before the save happened (READ).** `__init__.py` diff `:449-451`: `store.async_delay_save`
is scheduled and `keyset.dirty = False` is set at once; if that save fails, the high-water mark is not retried until the next change. The
`rotate` path (`persist`, write-ahead, `:429-441, 469-479`) is correct. Low: at most the H-04 window re-opens after a crash.

**HA-05 - low - `rotation_id` length is checked only after the signature (READ).** `keyset.py:254-256`; `ROTATE_SCHEMA` has no length limit
(`__init__.py` diff `:350-361`). Harmless once HA-01 (1) is in (unsigned refusal); until then it enlarges the oracle's controllable body.

**HA-06 - low - the pairing-code copy in the config entry is blanked after the Store save, not with it (READ).** `__init__.py` diff `:439-441`.
A restart between the two leaves the (now retired) code in `.storage/core.config_entries` - harmless for Arx (it refuses kid-less), but the
plaintext of a key that was current a moment ago lingers. Acceptable; note.

**HA-07 - info - verified**: permit and switch (`bridge_rotation.py:49, 82-87`: ON unless set OFF; `preflight` still refuses without permit /
peer / with an active or `needs_repair` rotation, `:220-231`); back-off after failed automatic attempts (1 h doubling, max a day, `:663-686`);
the budget rules (`CAP_S`, `COMMIT_MIN_REMAINING_S`, `RETIRE_BY_S`, `:57-59, 327-329, 346-350`); every step committed before the next peer call;
`_unknown_commit` / `tick` recovery table (`:437-513`); the bridge's monotonic cap survives a restart via `t0_wall` (`keyset.py:113-116`); hard cut
drops the old key at commit (`:296-298`); `retire` only for a committed rotation under the signing key (`:302-311`); R3 abort under the old key
only while it is held (`:325-330`); the bridge persists BEFORE answering and reloads on a failed save (`__init__.py` diff `:469-479`).
`test_no_key_material_in_audit_logs_after_an_activation_run` exists (NOT_RUN here).

**HA-08 - info - texts.** `routers/bridge_key.py:36` still says the build lacks the permit (`rotation_not_permitted`) - unreachable now, cosmetic.

## 5. Scope 4 - the two permits that were not in the first review

### 5.1 Extended service identity (`services/service_identity.py:89 EXTENDED_GO_LIVE_PERMITTED = False`)

What the code does (READ): `extended_on` is permit AND `security.local_identity_extended` AND `security.local_identity` (`:241-249`);
`local_door_ok` lets the WisKey door rule judge an active, non-deleted local user only in that mode (`:509-516`; `door_authority.py:93-103`);
the remote kill switch can only REMOVE authority (`:479-501`, owner decision 5 of 2026-10-18); the bridge's impact check and never-lists exist
(`integration/smplwise_bridge/runnable.py:63-77, 157-184`). The owner's nine decisions of 2026-10-18 (memory: no second factor, template /
dangerous services inside scripts accepted, entity policy a recommendation, remote OFF-only kill, no rate limit, notify as built) are recorded
and are not re-litigated here.

**X-01 - medium - the go-live pack's gating steps are not done, so the permit must not flip (READ).** `GOLIVE_CHECKLIST_HE.md` steps 2-7:
(2) the amendment is still `docs/security/HA_IDENTITY_RBAC_AMENDMENT_EXTENDED_SERVICE_IDENTITY_DRAFT_HE.md` on `origin/main`, and
`HA_IDENTITY_RBAC_HE.md:1` still reads "מפרט מחייב 1.1" - the binding document does not yet permit what the code would do; (3) the dedicated
re-review of the bridge impact check (`FABLE_REREVIEW_BRIEF.md`: 20 questions on `runnable.py`, `service_identity.py`, `stream_source_service.py`,
`config_service.py`, `schedule_service.py`) was NOT performed - not by the 2026-10-21 review (scope 1-4 there) and not by this one (scope 1-4
here); it is the review the owner's decision 9 asked for; (5) the permit commit recipe (flip the four tests that pin False, change the "review
required" texts in both bridge copies, CR-USR2 12.8, bilingual CHANGELOG); (6) a full gate; (7) the supervised first run with one dedicated
local user. **Verdict NO-GO today; GO-WITH-CONDITIONS = exactly those steps, in that order.**

**X-02 - info - interaction with HMACACT (READ).** `on_behalf_of` messages ride `ha_bridge.sign` / `keyset.verify` like every other; after the
first rotation they carry a `kid`; the `PREVENT_EXTRA` schemas gained `vol.Optional("kid")` (`__init__.py` diff `:383, 390, 407`). No change in
trust; HA-01's fix does not touch these paths.

### 5.2 Capture lease to card intake (`services/capture_lease.py:65 GO_LIVE_PERMITTED = False`)

What the code does (READ): `route_on` = switch AND permit AND `bridge_available` (`:175-178`); `bridge_available` is False while
`MIN_BRIDGE_FOR_CAPTURE_LEASE is None` (`:63, 159-164`); `ensure_issuable` refuses before anything is signed (`:201-206`); the lease is issued only
by the fresh decision of `card_capture_start` (`routers/access_control.py:1560-1643`), one live lease per receiver and per actor (0099 partial
unique indexes), revoked on ANY permission-revision bump and on a key rotation (`bridge_rotation.py:356-360`).

**L-01 - medium - the dependencies outside Arx do not exist yet (READ).** No bridge release offers `lease_event` (grep over
`smplwise_vms/integration` at 9a8adbaf8: no match); `trusted_door.MIN_BRIDGE_FOR_TRUSTED_PATH` is None too (`trusted_door.py:47`); WisKey's
consumer of the four lease envelopes, the sequence / gap / silence rules and the confirm barrier are "not verified" (CR-WISKEY-LEASE-REVOCATION-EVENT
7.4); the card grant route is behind its own permit (`access_grants.GO_LIVE_PERMITTED`, `grants-cards-x5` answers `access_grant_card_not_built`).
**Verdict NO-GO today.** Conditions: (1) a bridge release with `lease_event` AND `door_open`, verifying with `keyset.KeySet.verify` (after
HMACACT every lease / trusted-door envelope carries a `kid`, CR-HMAC 15); (2) WisKey's written confirmation of the consumer and of `capture_start`
idempotency; (3) set both `MIN_BRIDGE_*` constants and flip the permit in ONE commit; (4) the owner's separate permit in chat and the lab run
with the owner's test card (the owner form item: "the previous run is not a permit for this"); (5) the card grant permit decided separately.

**L-02 - info - verified**: the lease settings are `SETTINGS_KEEP` (a restore never loosens, `backup.py:679`); dev principals never hold a
lease (`:66-68`); the lease cap is a constant (`LEASE_MAX_S`, `:60`) and the setting may only lower it (`:181-185`).

## 6. Tests

| Head | File(s) | Result |
|---|---|---|
| HMACACT-295 2243a6ca5 | `tests/test_bridge_key_activation_295.py`, `tests/test_bridge_key_rotation_295.py` | **NOT_RUN** (queued through `local_run.sh`; not admitted: free memory stayed below the wrapper's 3 GB floor) |
| DOORHARD-295 cb508bd5d | `tests/test_door_automation_295.py` (56 tests) | **NOT_RUN** (same) |
| integ/2102 9a8adbaf8 | `tests/test_door_emergency.py`, `tests/test_doorwin_api.py`, `tests/test_doorwin_watch.py` | **NOT_RUN** (same) |

The coverage the files CLAIM was read (names only): emergency - single-use token of the same person, 20 s expiry, start vs release token,
prepare rate limit, partial headline with bounded retries, LOCK release never retried, engine exception = unknown, operator / viewer cannot
press, OPEN for system administrators only, scope = binding with a station deny, duplicate `client_request_id`, bearer refused, automation
actor refused, OPEN over LOCK, E-1 three attempts, switch off turns OPEN off; door automation - the ten A-items each have a named test;
key rotation - H-02, H-03, H-04, H-05, H-07, H-09 and both upgrade orders each have a named test. None of them was run by this review; the
HMACACT and DOORHARD heads say so themselves ("tests not yet run", "WIP, untested"). No test exists for W-01, E-01 or HA-01 (they would fail).

## 7. Contradictions recorded (not resolved)

1. CR-039 E-1 (a bounded OPEN repeat after an unknown outcome) vs AGENTS.md "never queue or blindly retry physical commands" and the lead's
   brief "must never open on UNKNOWN" (E-04). The CR records it as a deliberate exception; this review conditions it on WisKey's idempotency.
2. CR-039 7.1 ("cancel the rest of today's occurrences") vs the code (a future cancel is a database flag that the next compile reverts, W-01).
3. CR-039 8.7 ("an incident is still started on the last known copy") vs `no_doors` if the directory is empty (E-10, not verified).
4. CR-WISKEY-HMAC-ROTATION-295 15 says both upgrade orders were "tested with the real bridge key set and the 0.9.4 verifier"; the head's own
   commit messages say "WIP, untested" / "test fix". Which is true is a matter for the gate; this review treats them as NOT_RUN.
5. `docs/security/HA_IDENTITY_RBAC_HE.md` 1.1 forbids what the extended mode would allow; the amendment that permits it is a draft (X-01).
6. The first review's A-01 fix asked for corroboration "in the mirror"; this review finds the mirror itself inside the adversary's reach (DA-01).

## 8. Not verified

The frontend (door-windows screen, emergency sheet, bridge-key card, diagnostics pairing field); `ha_sync`'s application of `state_changed`
frames to `ha_entities` (DA-01's premise); `intercom_sync.SYNC.stations()` when the feed is down (E-10); the rotation against a real Home
Assistant and bridge 0.9.5 (the branch says none was used); the WisKey W13 / W1 contracts (they do not exist); every test listed in section 6;
the `custom_components` mirror of the integration beyond the asserted byte-identity test (not run); whether Home Assistant restricts
`call_service` for non-admin users on custom services (assumed not, per HA's model: the service call itself is not permission-gated).

## 9. Recommended order of work

1. HA-01 (three small changes + tests) before HMACACT-295 is merged; then run its two test files on the runner; then HA-02 texts.
2. W-01 and E-01 on integ/2102 (or the next door-windows slice) before `doors.windows.enabled` or `doors.emergency.enabled` can default or be
   recommended; E-03 and E-02 / E-04 go into the W13-e request to WisKey.
3. DOORHARD-295: run the 56 tests, fix DA-03 (cheap), record DA-01 as the remaining go-live condition in CR-AUTODOORS-295 12.
4. Extended identity: apply the amendment as 1.2 after the owner's approval, then the dedicated impact-check review (the brief), then the permit
   commit, gate, supervised run - in that order.
5. Capture lease: nothing to do on the Arx side until a bridge offers `lease_event` and WisKey answers CR 7.4.
