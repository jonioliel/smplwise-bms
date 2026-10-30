# Fable security review 3 - release/2111 (gate 2 head), the hand-resolved merge, and the four unmerged branches (2026-10-21)

Independent read-only review (Fable). No product code was changed on any branch; nothing was run on the Ubuntu runner (gate 2 owns it) or
on the workstation; no live system, Home Assistant, bridge, WisKey or tunnel was contacted; no secret, host, address, serial or token
appears here. Precedence (AGENTS.md): approved change request -> `MASTER_SPEC_HE.md` / `docs/security/` -> `AGENTS.md`. Contradictions are
recorded, not resolved (section 8). Review 2 is `private/planning/FABLE_REVIEW_2_2026-10-21.md`; its IDs (HA-, W-, E-, DA-, X-, L-) are kept.

## 0. Heads reviewed (pinned) and method

| Scope | Ref | Commit | How read |
|---|---|---|---|
| 1, 2, 4 | `origin/release/2111` (= gate 2 head) | `5cbfe7df4` | detached worktree, every file:line below is at this commit |
| 2 (parents of the hand merge) | `origin/pilot/WKV2B-295`, `origin/pilot/ECCACT-295` | `284c81698`, `7e19427e4` / `3322ba37b` | `git diff <parent> origin/release/2111 -- <file>` |
| 3a | `origin/pilot/HMACACT2-295` | `97c13f812` | `git diff origin/release/2111 origin/pilot/HMACACT2-295` |
| 3b | `origin/pilot/WAPACE-295` | `86de0ea9e..f3431107a` - **already merged into release/2111** (INTEG-2111 #14) | read on release/2111 |
| 3c | `origin/pilot/W11TPL-295` | `0afdb83bb` | branch diff |
| 3d | `origin/pilot/DDAREA-295` | `c4522680a` | branch diff (UI only) |

- **READ**: every statement is from reading code at the pinned commits; routes, transactions and gates were traced by hand. Nothing below
  is a test result. The reading of sections 3, 4.2-4.4 and 5 was split across parallel readers working from written briefs on the same
  worktree; their line anchors were spot-checked (the test pins, the `consumer_on` callers, the directory route, the permit constants).
- **TESTED**: nothing. **Result: NOT_RUN** for every test file named here. The gate-2 run is the only evidence that will exist.
- **Not verified** (section 9): the frontend beyond the three files named, the bridge against a real Home Assistant, the WisKey W13-e / W1 /
  U2 contracts (they do not exist), `intercom_sync.SYNC.stations()` when the feed is down (E-10).

## 1. Summary

| Severity | Count | IDs |
|---|---|---|
| high | 0 | - |
| medium | 6 | DW-01, DW-02, DW-03, WP-01, WP-02, G-01 |
| low | 13 | DW-04, DW-05, DW-06, T-01, K-01, R3-02, HA-03, DA-06, WP-03, WP-04, WP-05, TP-01, TP-02 |
| info | 10 | DW-07, DW-08, DW-09, R3-01, K-02, WP-06, TP-03, TP-04, G-02, G-03 |

Headline: **the review-2 blockers are closed in code** (HA-01 on both sides, W-01, E-01, E-02, E-03, DA-01's direct read, HA-02 texts with the
first rotation made manual). The hand-resolved ECCACT x WKV2B merge is **correct and not weaker than either parent**. The one thing the owner
must decide before 2.11.0 ships: ECCACT opened `door_windows_engine.GO_LIVE_PERMITTED` while the WisKey engine is still `not_implemented`, which
(a) lets `doors.emergency.enabled` be switched ON for an engine that refuses every door (DW-01, the "false sense of safety" the module itself
forbids) and (b) makes the tier-D "prepared" mode of door windows - the one review 2 said GO - unreachable (DW-02). Both are one-line fixes;
one test pin (T-01) will already show gate 2 red. Nothing exploitable by a non-administrator was found in the new surfaces.

### Verdicts per capability

| Capability (permit / switch on release/2111) | Review 2 | Review 3 | Conditions |
|---|---|---|---|
| Door windows tier D "prepared" (`doors.windows.enabled`, engine permit now True) | GO | **REGRESSED -> GO after DW-02** | the factory must hand out `PreparedEngine` while the live engine is `not_implemented` (DW-02); W-01 is closed |
| Door windows tier B (WisKey programs; `door_windows_engine.GO_LIVE_PERMITTED = True`) | GO-WITH-CONDITIONS | **NO-GO today** (inert: every call `not_implemented`) | review-2 (2) program coordinator + U2 answers, (3) one lab write with the owner, (4) W-02 decision; plus DW-06 |
| Emergency LOCK (`doors.emergency.enabled`) | GO-WITH-CONDITIONS | **NO-GO to switch ON in 2.11.0** (DW-01) | DW-01 fixed; DW-03 fixed; W13-e `lock_secure` + idempotency confirmed in writing; drills first; one lab LOCK + release with the owner |
| Emergency OPEN (`doors.emergency.open_enabled`) | NO-GO | **NO-GO - confirmed unable to act** (`open_supported = False`, `open_enabled()` false, `update_settings` refuses `open_unavailable`) | everything of LOCK + E-02/DW-04 in W13-e + the E-04 WisKey condition (DW-09) + attestation + hardware review |
| Door automation (`door_automation.GO_LIVE_PERMITTED = False`) | merge GO-WITH-CONDITIONS, permit NO-GO | **merged; permit False confirmed; permit NO-GO** | DA-06 (watched entity direct read), a reviewed live sender, W1 answered |
| Bridge key rotation (`bridge_rotation.GO_LIVE_PERMITTED = True`, switch default on, first rotation manual) | NO-GO until HA-01 | **GO for 2.11.0** | gate 2 green on its two test files; R3-02 texts in the release-notes round; one lab run with the owner before the first click |
| HMACACT2 (`bridge.key.rotate`, door pause during rotation) - unmerged | - | **merge GO (2.11.1)** | its two test files run green on the runner; K-01 card line recommended |
| Extended service identity (`EXTENDED_GO_LIVE_PERMITTED = False`) | NO-GO | **unchanged, False confirmed** | X-01 steps in order |
| Capture lease (`capture_lease.GO_LIVE_PERMITTED = False`) | NO-GO | **unchanged, False confirmed** (`:65`, reverted by ECCACT 780f158ed / 3322ba37b, pin `test_bridge_key_rotation_295.py:654-660`) | L-01 conditions |
| ECCACT permits now True (`access_grants`, `bulk_people`, `wiskey_acr5`, `wiskey_peer`, `wiskey_peer_registry`) | - | **GO as shipped** (switches OFF, system-admin only, live transports `not_built`) | G-01 before `access.external_grants` is recommended ON |
| WhatsApp reserve/release port (`messaging.pacing.reserve`, in no role) | - | **GO for 2.11.0** (nobody holds the permission) | WP-02/03/05 before a WisKey identity gets it; WP-04 in 2.11.1; WP-01 before a `senders` mapping is configured |
| WhatsApp template send (W11TPL, `TEMPLATE_SEND_SUPPORTED = False`, switch OFF, no caller) - unmerged | - | **merge GO** | TP-01/TP-02 before any caller exists |
| DDAREA (UI) | - | no finding | - |

## 2. Scope 1 - the review-2 findings on release/2111 (5cbfe7df4)

### 2.1 Status table (READ)

| Finding | Status | Evidence on release/2111 |
|---|---|---|
| **HA-01** (high) bridge signing oracle + directory control bodies | **CLOSED, all three parts, both sides** | bridge `smplwise_vms/integration/smplwise_bridge/keyset.py:246-253`: a message that fails `_check` gets `{"ok": False, "code": ...}` with no `sig/kid/nonce/ts`, nothing echoed; the signed `_answer` (`:242-244`) only after a proven key; the `rotation_id` 1..64 check now after the proof (`:257-259`, HA-05 moot). `custom_components/smplwise_bridge/keyset.py` has the same SHA-256 as the integration copy. Arx `routers/ha.py:655-658`: after `verify_message`, 422 `bridge_bad_request` when `protocol` or `op` is present or `users` is not a `list`, BEFORE `note_capability` / upserts / `_apply_directory_to_users` (`:675`). Tests `tests/test_bridge_key_activation_295.py:518-534` (six hostile bodies), `:537-549` (five bodies -> 422, user stays active, `{"users": []}` -> 200). NOT_RUN |
| **HA-02** (medium) three re-pair cliffs, automatic first rotation | **CLOSED** (one stale sentence, R3-02) | `docs/user-guide/he/84-bridge-key_HE.md:21-29` names the three re-pair situations and "first rotation = one administrator click"; `CR-WISKEY-HMAC-ROTATION-295.md:251-256` (15.1/15.2); `smplwise_vms/CHANGELOG.md:22-23`; code `services/bridge_rotation.py:660-676` `first_rotation_pending` / `auto_wanted`: the worker never starts a rotation while the channel is on `g0-legacy`; `:694-701` worker gates |
| HA-03 (low) `pairing_code: null` text | **OPEN** | `frontend/src/screens/system-diagnostics.ts:668` renders a dash; the API now returns `key_set` (`routers/ha.py:632`) but the screen does not use it |
| HA-04, HA-06 (low) | unchanged, acceptable | `integration/__init__.py:370-372`, `:361-363` |
| HA-05 (low) | moot after HA-01 (1) | `ROTATE_SCHEMA` still unbounded, harmless (unsigned refusal) |
| H-01..H-09 | **unchanged** | H-01 `ha_bridge.py:74-84, 103-112`, `bridge_keys.py:304-315` (seal + `DELETE settings.bridge.secret` in one txn inside `write_aside`, `bridge_rotation.py:254-258`); H-02 `bridge_keys.py:362-377`, `keyset.py:199-234`; H-04 `bridge_keys.py:390-394`, `keyset.py:223-233`; H-05 `bridge_rotation.py:548-556`; H-07 `bridge_keys.py:287-299`; H-08 `:378-386`; H-09 `bridge_rotation.py:183, 290, 341, 387, 407` |
| **W-01** (medium) future cancel undone by the next compile | **CLOSED** | `routers/door_windows.py:291-297`: a future `prepared/planned/armed` occurrence -> `cancelled`, `resolution='override'` AND a row in `door_window_exclusions` (0143); `:313-315` wakes the worker and runs `dw.sync` at once; `services/door_windows.py:664` `compile_door` drops a span whose token is excluded (`excluded=exclusions_of(...)`, `:863`, `:993-996`); `:789-790` `_store_plan` never re-plans a row whose `resolution` is `override`; exclusions pruned after 3 days (`:886`, tokens are date-bound) |
| **E-01** (medium) release behind the master switch | **CLOSED at the service** (residual DW-05) | `services/door_emergency.py:316-320`: `prepare` reads `enabled()` / `open_enabled()` only for `action == "start"`; `release()` (`:433-453`) never reads the switch; `update_settings :158-159` refuses `ENABLED off` while an incident is active (409 `incident_active`) |
| **E-02** (medium) OPEN over LOCK supersedes in the DB only | **CLOSED at the seam** (residual DW-04) | `start :408-416`: the superseded LOCK is set `releasing` with `release_request_id = "<id>:sup"` and release-phase rows are inserted; `submit.run :630-635` dispatches the LOCK's `release` BEFORE the OPEN apply ("one attempt; the OPEN goes out whatever the answer") |
| **E-03** (medium) no deadline at the seam | **CLOSED** (residual DW-03) | `ENGINE_DEADLINE_S = 8` (`:61`), `bounded() :502-511` maps `FuturesTimeout` to `DoorOutcome("unknown", "deadline")`; `PENDING_MAX_S = 30` (`:62`), `age_pending :583-605` ages `pending/sent` rows into `unknown` with the normal retry plan, called from `retry_tick :610` |
| **E-04** (medium, design) OPEN repeated after UNKNOWN | **KEPT by owner decision (option C)**, recorded | `_retryable :521-527` with the decision in the comment; every attempt reuses the same per-door `request_id` (`:493`); residual risk and the exact WisKey condition in DW-09 |
| E-05 (low) duplicate `client_request_id` race -> 500 | unchanged | pre-check still before the UNIQUE constraint |
| E-06 (low) operator holds `access.windows.cancel` (also the manual relock confirmation) | **OPEN - owner has not answered** | `roles.json`: `operator` still has `access.windows.cancel`; `routers/door_windows.py:335` lets `.cancel` confirm a relock |
| E-07, E-08, E-09, E-10 | unchanged | - |
| **DA-01** (medium) corroboration against the mirror only | **CLOSED for the automation entity, partial for the watched entity** (DA-06) | `services/door_automation.py:908-937` `_read_state` -> `ha_client.get_state` (REST `GET /api/states/<id>`, 10 s, any non-200 / transport error -> None -> `uncorroborated`); call site `:1095-1123`: mirror gates in a read txn, ONE direct read outside any transaction, re-check up to 3 s on `mode="read"` (fixes DA-03), `_consume` under the write lock |
| DA-02, DA-04, DA-05 | unchanged / verified | - |
| A-01..A-10 | **unchanged** | `is_manual :826`, `AUTOMATIC_SOURCES :81-86`, `_switch_reason :1038`, storm `:1025-1027`, `QUEUE_MAX 256` one worker `:84, 117`, `_NOT_FROM_A_GRANT :162-166, 443`; `GO_LIVE_PERMITTED = False :48`; `LiveSender.open -> not_sent / live_transport_not_built :104-110`; feature `on` refused `:706-708` |
| X-01 (extended identity) | **unchanged, NO-GO** | `services/service_identity.py:89 EXTENDED_GO_LIVE_PERMITTED = False` |
| L-01 (capture lease) | **unchanged, NO-GO** | `services/capture_lease.py:65 GO_LIVE_PERMITTED = False` (the ECCACT opening was reverted: 780f158ed, 3322ba37b, fae9e5b25) |

### 2.2 New findings in scope 1 (all caused by or exposed through the ECCACT permit flip of `door_windows_engine`)

**DW-01 - medium - `doors.emergency.enabled` can now be switched ON for an engine that refuses every door (READ).**
`services/door_windows_engine.py:24` `GO_LIVE_PERMITTED = True`; `:172-176` `WiskeyEmergencyEngine._guard` raises `not_implemented` for every
`apply` / `release`; `services/door_emergency.py:132-133` `enabled()` = setting on AND `live_ok()` (= the permit, `:118-119`); `update_settings
:149-150` refuses `ENABLED on` only when `live_ok()` is false. So a `system.configure` holder can turn LOCK on today, the guard sees the
"Secure" button (`settings_view :141` reports `go_live_permitted: true`), and a real press writes an incident whose every door ends `refused`
(`dispatch :496-497` maps `EngineError` -> `refused`), state `in_effect_partial` with 0 doors ok. The module's own docstring (`:3-5`, build
notes T21) says this exact situation must be impossible: "a button that cannot act would be a false sense of safety". The 2.11.0 CHANGELOG
(`:48-49`) discloses it ("turning a switch on today plans and audits without moving a door") instead of preventing it. *Not an exploit*: only an
administrator can flip the switch. *Fix* (one line each): give `EmergencyEngine` an `implemented: bool` (False on `WiskeyEmergencyEngine` until
the W13-e coordinator exists) and make `live_ok()` = permit AND `emergency_engine(settings).implemented`; keep `release()` independent of it
(E-01). Test: `test_the_emergency_switch_cannot_be_turned_on_in_this_build` should run with the SHIPPED permit (DW-08). *Blocks*: the owner's
call (question 1 of the Hebrew summary): either fix in 2.11.0 (the targeted re-run gate 2 will need for T-01 anyway) or ship with the
disclosure and fix in 2.11.1. My recommendation: fix in 2.11.0 - it is a life-safety button.

**DW-02 - medium (product regression) - tier D "prepared" is unreachable; `doors.windows.enabled` ON now errors on every door and raises
"not started" alarms (READ).** `door_windows_engine.py:216-217` `_window_engine` returns `WiskeyProgramEngine` whenever the permit is True,
`PreparedEngine` only when it is False; `WiskeyProgramEngine.read/save/pause` raise `not_implemented` (`:143-147`). Consequences when an
administrator turns the switch on in 2.11.0: `services/door_windows.py:879-882` every door's `_write_program` ends `error` on every pass (every
300 s or wake) with an audit row `door.window.engine_write failed` per door per pass (`:909-912`); `_store_plan` inserts occurrences as `planned`
(never `armed`, `:782`); at each window's start the watchdog moves `planned -> not_started` and emits `door.window_not_started` for every window
of every door (`door_windows_watch.py:73-75, 133-134`); `preview` reports tier `program` (`door_windows.py:737`); `open_for` and event holds
insert `planned` rows that then alarm the same way (`door_window_triggers.py:307-308`). Review 2 gave tier D GO because a manager could plan in
Arx and apply in the panel; that mode no longer exists in the build. *Fix*: the same `implemented` flag on the window engine; `_window_engine`
returns `PreparedEngine` while the live engine is not implemented, regardless of the permit (the permit then means exactly what the comment on
`:24` says). *Blocks*: the recommendation to turn `doors.windows.enabled` on; same release choice as DW-01.

**DW-03 - medium (later enablement) - the E-03 deadline does not stop a hung engine call; queued calls fire late, after their row was aged or the
incident released (READ).** `door_emergency.py:86 LANE_SLOTS = 4`; `_pool() :463-468` is a `ThreadPoolExecutor(max_workers=4)`; `bounded :507-511`
submits `one(d)` and waits 8 s but never calls `fut.cancel()`; the waiter pool (`:516-517`) also has 4 threads. If the live engine blocks (a
transport without its own timeout, or one longer than 8 s), the first four calls occupy every pool worker; the fifth and later `one()` calls are
QUEUED, their futures time out as `unknown / deadline` without anything having been sent, and when the hung calls return the queued `one()`
calls run anyway - sending an `apply` (or a `release`) for a door whose row is already `unknown`, already retried under the same `request_id`,
or whose incident was released meanwhile. A LOCK apply landing after the release leaves a door secured while Arx says "released"; an OPEN
apply landing after the release leaves a door held open. The retry path (`retry_tick :617-621`) submits into the same saturated pool. Today the
live engine raises at once (`not_implemented`), so nothing hangs - this is a condition for the live engine. *Fix*: (1) `fut.cancel()` on timeout
(cancels a not-yet-started call); (2) a stale guard at the top of `one()`: re-read the row and skip unless it is still `pending` in this phase
and the incident still in the phase's states; (3) the live transport's own timeout <= `ENGINE_DEADLINE_S`; (4) a pool sized for the installation's
door count or a per-incident executor. Test: a fake engine that blocks for 30 s on door 1-4 and asserts doors 5-8 are still sent within the
deadline and no late send follows a release.

**DW-04 - low (OPEN enablement) - the superseded LOCK's release is dispatched serially BEFORE the OPEN apply (READ).** `submit.run :630-635`: with a
slow or hung engine the OPEN of an evacuation waits up to 8 s x ceil(doors / 4) (more under DW-03) for the LOCK release round that the comment
itself says may be ignored. *Fix*: run the superseded release concurrently with the OPEN apply, or - the review-2 option 1 - have the W13-e
contract state that an `open` apply supersedes `lock_secure` per door, and drop the pre-release round. Record in the W13-e request.

**DW-05 - low - the release path still needs the engine factory's permit (READ).** `dispatch :485` -> `engine_for` -> `dwe.emergency_engine(settings)`
-> `WiskeyEmergencyEngine._guard` raises `not_permitted` first (`:174-175`). A build whose permit is False cannot release an incident started by
a build whose permit was True (every release row ends `refused`). Review 2's E-01 asked that a release only require the engine's `release`
method to exist. Theoretical today (2.10.x has no door-windows code at all, so a rollback does not reach this path). *Fix*: `_guard(phase)` -
skip the permit check for `release`.

**DW-06 - low - the installation-wide storm cap counts simulated triggers, so a token holder can block a person's `open-for` (READ).**
`door_window_triggers.py:247-249`: `STORM_PER_HOUR = 20` over `started | simulated | extended` of EVERY source; `:420` every `ha_event` is
`simulated` in this build (`automation_actor_available()` is False, `door_windows.py:89-106`). An automation holding a valid rule token (or a
person who can fire the event with it) fires 20 events in an hour and every `arx_button` `open-for` of every door answers `storm` for the rest of
the hour (`routers/door_windows.py:380-381`). Not an opening - a denial of the manual hold. *Fix*: count the storm per source, or exclude
`simulated` from it (simulations never reach an engine).

**DW-07 - info / owner question - a built-in role `emergency_open` exists (READ).** `roles.json` roles `door_windows_manager`, `door_windows_guard`,
`emergency_lock`, `emergency_open`; `routers/access.py:360-362` only `door_windows_guard` is delegable by default; a built-in role is exempt from the
"custom role must name its sensitive permissions" rule (`:555`). So a system administrator can bind `emergency_open` to any user at any scope,
and `rbac.delegable_roles` could let a delegated administrator do it. Owner decision 2026-10-13 (CR 7.2) says OPEN is for system administrators;
the preset is a deliberate escape hatch ("everyone else through a custom role") - the owner should confirm it (Hebrew question 4).

**DW-08 - info (test evidence) - the "cannot be turned on in this build" tests run with the permit patched to False (READ).**
`tests/test_doorwin_api.py:12-14` `ProductWorld(settings, monkeypatch, go_live=False)` (`fake_doorwin_adapters.py:111` sets
`dwe.GO_LIVE_PERMITTED = go_live`), then `:29-31` asserts 409 `go_live_not_permitted`, `:24-27` asserts `go_live_permitted is False` and tier
`prepared`. These tests no longer describe the shipped build (permit True): a green run is not evidence that the switch is protected (it is not,
DW-01). After DW-01/DW-02 add one test with the shipped permit: switch ON refused `engine_not_implemented`, tier `prepared`.

**DW-09 - info (recorded) - E-04 kept: residual risk and the exact WisKey condition.** With `_retryable` as built (`:521-527`) an UNKNOWN OPEN apply is
re-sent at +10 s and +20 s with the same `request_id`. Residual risk (a) a `deadline` UNKNOWN whose original call is still in flight (DW-03) means
the SAME `request_id` can reach WisKey twice within seconds; (b) if WisKey implements `open` as a pulse or a toggle rather than a level ("hold
until release"), a repeat can CLOSE an exit or pulse it; (c) a late apply after Arx's release (DW-03) re-opens a door Arx shows as released.
**Condition to put in W13-e, verbatim**: "`apply(open, request_id)` is idempotent by `request_id` for at least 15 minutes (a second apply with a
known `request_id` returns the first answer and has no effect); `open` is a level (held until the matching `release`), never a pulse or a toggle;
a `release` for a door wins over any later-arriving `apply` carrying an older `request_id` of the same incident; the per-door answer states
`duplicate: true` on a repeat." Until WisKey confirms all four, the E-1 retry should ship behind a setting defaulting OFF (review 2's fallback).

## 3. Scope 2 - the hand-resolved merge and every permit (release/2111)

### 3.1 ECCACT x WKV2B (INTEG-2111 conflict 4) - v1 never proves a revocation (READ)

- `services/access_grant_engine.py:518-532` `_v1_status`: True when work is owed, None for absent / other revision / `unverified` / flag not False,
  **False only for the clean-looking shape** (the tail the lead restored). `:535-545` `revocation_pending_verdict`: v2 -> `revocation_verdict_v2`;
  v1 -> `True if _v1_status(...) is True else None` - never False. `:548-553` `revocation_evidence_verdict` -> `was.evidence_of` maps a v1 False
  to `EVIDENCE_UNVERIFIED`, never `EVIDENCE_VERIFIED` (`wiskey_access_state.py:391-404`), so `revoked_unverified` is still answerable.
- `services/wiskey_acr5.py:148-163, 166-183, 186-196`: the same structure; `_v1_status` tail restored identically; `revocation_evidence` demotes a
  VERIFIED without the central predicate to None.
- `station_removal_from` (`access_grant_engine.py:590-602`) -> `station_removal_verdict_v2` (`wiskey_access_state.py:436-459`): `schema_version !=
  SCHEMA_V2` -> None. `station_removal_pending :765-776` and `access_station_permissions.py:545-555` `_station_removal_pending`: any failure or
  non-bool -> None. `:558-568` `proven(deny)` needs `pending is False` -> only a v2 per-station proof makes a block `applied`; `:537-542`
  `deny_unverified` -> `unverified` / `revoked_unverified`, **nothing written again** (`:662-663, 682-683`). `_send_once` returns the GRANTDENY
  4-tuple on every path (`:651-684`), `_send :632-639` unpacks 4 and returns 5 (inherit -> deny escalation kept).
- Grant strip (`services/access_grants.py:2599-2607, 2627-2632`): `revocation_proven` (central predicate AND `pending is False`) ends a grant
  `revoked` with `revoke_proof = 'verified'`; a v1 clean answer ends it `revoked` with `revoke_proof = 'unverified'` only when evidence is
  `EVIDENCE_UNVERIFIED`; anything else stays `revoking`. Migration 0140 carries the one CHECKed column.
- Against both parents (`git diff 284c81698 / 3322ba37b origin/release/2111`): the merge is the WKV2B file plus ECCACT's `(answer, schema)`
  unpacking in `revocation_evidence_from`, the `station_removal_*` helpers and `_status_inputs`. **Nothing is weaker than either parent**; ECCACT's
  "always None" tail would have made `revoked_unverified` unreachable and the lead's restoration fixed that in both modules.
- `services/backup.py:76-83` `NEVER_EXPORTED_TABLES` holds `door_automation_fires` (DOORHARD) and the four `wiskey_*` tables (ECCACT) with the
  import-time guard `:90-91`. Migration 0145 stores refs, ids and states only.

**G-01 - medium (contract mismatch, not an exploit) - the `wiskey.acr5_*` switches gate nothing; the live readback runs on the grants switch alone
(READ).** `access_grants.engine_for` (`access_grants.py:274-292`) always wires `LiveReadback`; `WiskeyServiceEngine._status_inputs`
(`access_grant_engine.py:748-763`) checks the permit and the write gate only; `wiskey_readback.py:19` says "`wiskey_acr5.consumer_on` is the
caller's gate" but **no product caller calls `consumer_on` / `consumer_mode`** (grep: only `wiskey_acr5.py:101, 364` itself). The comment on
`wiskey_acr5.py:56` ("each wiskey.acr5_* switch still defaults OFF") and the CHANGELOG (`:50`) therefore promise a gate that does not exist. Once
`access.external_grants` is ON, every revoke pass sends an `overview` read and a `users/access_state(_v2)` read to WisKey under the add-on's
service session regardless of the acr5 switches. Reads only, rate-limited through `intercom_sync.SYNC.command`, refused by WisKey for a non-admin
identity - a refusal keeps the grant `revoking`. *Fix*: make `revocation_pending` / `revocation_evidence` / `station_removal_pending` consult
`consumer_on(conn, "acr5_01")` (and `normalize_user` `acr5_02`), or delete the four dead switches and correct both texts. *Blocks*: nothing for
2.11.0 (grants switch OFF, system-admin only); record before the grants switch is recommended ON.

**G-02 - info - `revoke_proof` middle path is a recorded owner exception, not a defect**: a grant can end `revoked` on a v1 clean answer + Arx's
central predicate, labelled `unverified` in the row, the API (`access_grants.py:1498`) and the audit (`outcome=stripped_unverified`). Section 8.

**G-03 - info - the ACR5 consumer and the peer registry have no settings writer**: no router sets `wiskey.acr5_*`, `wiskey.peer_receipt`,
`wiskey.peer_pin` (the `PATCH /settings` whitelist for `wiskey.*` keys was not read). Nothing can turn them on from the UI; `not_built` stays final.

### 3.2 HOMELIVE x DOORWIN2 timers (frontend, READ)

`frontend/src/screens/devices-building.ts:27, 1017` one `LiveController`; `:1367` the `doors` source is registered through `poll(...)` with the
widget-offered / first-read-failed predicate; `:1389-1395` `loadDoors()` returns `noteRead('doors', ok)`; `:1386` `isStale()` counts doors;
`:1407` the failure panel's retry calls `live.refreshOne('doors')`; `:2487` connect marks the first read; `:2557` disconnect removes every source.
The one remaining `setInterval` (`:2518`) is the 15 s `tick` counter for relative times, not a widget poll. Matches INTEG-2111 conflict 3.

### 3.3 Every permit and switch default on release/2111 (READ)

| Constant | Value | Switch(es) and default | Who flips the switch | What the permit unlocks today | Review-2 verdict | Review 3 |
|---|---|---|---|---|---|---|
| `door_automation.GO_LIVE_PERMITTED` (`:48`) | **False** | `doors.automation_open` cannot be on (`:706-708`) | - | nothing; `LiveSender` refuses | must be False | **matches** |
| `capture_lease.GO_LIVE_PERMITTED` (`:65`) | **False** | `route_on` false | - | nothing | must be False | **matches** |
| `service_identity.EXTENDED_GO_LIVE_PERMITTED` (`:89`) | **False** | `security.local_identity_extended` inert | - | nothing | must be False | **matches** |
| `access_cards.CAPTURE_PERMITTED` (`:37`) | False (a missing implementation, not a permit) | - | - | `capture()` refuses | - | ok |
| `door_windows_engine.GO_LIVE_PERMITTED` (`:24`) | **True** | `doors.windows.enabled` off; `doors.emergency.enabled` off; `open_enabled` off (cannot be on: `open_supported` False); `automations` off (cannot be on); `doors.automation_actor` off (cannot be on, probe False) | `system.configure` at the installation (`routers/door_windows.py:450, 461`; emergency settings route the same) | the live engines are selected but answer `not_implemented`; the switches CAN be turned on (DW-01, DW-02) | tier D GO, tier B conditions, LOCK conditions, OPEN NO-GO | **DW-01 / DW-02** |
| `bridge_rotation.GO_LIVE_PERMITTED` (`:49`) | True | `bridge.key_rotation` default **on** (`:82-83`); first rotation manual (`:660-676`) | system admin + `system.configure` (`routers/bridge_key.py`) | the rotation engine | NO-GO until HA-01 | **GO** |
| `access_grants.GO_LIVE_PERMITTED` (`:79`) | True | `access.external_grants` off | PUT `/access-grants/settings`: `system.configure` AND `is_system_admin` (`routers/access_grants.py:298-310`) | `WiskeyServiceEngine._guard` passes (`access_grant_engine.py:632-636`): revision-checked people writes + readback - the designed grant writes | - | GO as shipped; G-01 |
| `bulk_people.GO_LIVE_PERMITTED` (`:42`) | True | `access.bulk_people` off | PUT `/people/bulk/settings` system admin (`routers/bulk_people.py:94-106`); other routes 409 while off (`:58`) | `BulkEngine._guard` passes | - | GO as shipped |
| `wiskey_acr5.GO_LIVE_PERMITTED` (`:56`) | True | four `wiskey.acr5_*` off - **no route writes them** | - | `consumer_on()` could be true; the plan consumer answers `adapter_not_implemented` (`:357-366`) | - | inert; G-01 |
| `wiskey_peer.GO_LIVE_PERMITTED` (`:38`) | True | `wiskey.peer_receipt` off, no writer | - | `enabled()`; `signed_capture_covered()` = `SIGNED_CAPTURE_COVERED and WISKEY_HALF_REVIEWED and permit` = **False** (`:39-40, 224-226`), imported by nothing | - | inert |
| `wiskey_peer_registry.GO_LIVE_PERMITTED` (`:36`) | True | - | - | `client_for` may return a client, whose live read answers **`not_built`** (`:61-67`); imported by no product module | - | inert |

ECCACT's new seam modules `services/wiskey_intents.py` and `services/wiskey_feature_exec.py`: **no route and no import** by any router, `main.py`,
worker or service (tests only); `LiveResolveTransport.resolve :278-283` and `LiveFeatureTransport.send :364-368` raise `not_built` before any I/O;
a peer is only a sealed `VerifiedPeerRef` minted by the registry client (`wiskey_peer.py:1-28, 57-59`); create resolutions are byte-exact against
the stored original (`wiskey_intents.py:202-257`); policy comes from Arx RBAC with deny-wins and both creator and approver for automations
(`wiskey_feature_exec.py:289-322`), a service identity never contributes (`:16`); error strings are closed codes; no audit rows of their own
(they are their own ledger) - a route added later must audit.

## 4. Scope 3 - the unmerged branches

### 4.1 `pilot/HMACACT2-295` (97c13f812) - `bridge.key.rotate` and the door pause during a rotation (READ)

What it does: new permission `bridge.key.rotate` - `rbac.py:134` (in `LOCAL_ADMIN_PERMISSIONS`: a local identity needs its second factor),
`roles.json:231` (system_admin only), `:501` (sensitive, never implied), `routers/access.py:87, 358` (label; in `SYSTEM_PERMISSIONS`: no custom
role may carry it, never delegable; `local_identity.py:212` and `backup.py:793` exclude SYSTEM_PERMISSIONS too). Routes `routers/bridge_key.py:
53-58, 129, 144`: start / resume need `bridge.key.rotate` AND `is_system_admin`; GET and the switch / reminder keep `system.configure` + system
admin. A bearer client or a `site_admin` cannot start, abort or resume (abort has no route). Door pause: `bridge_rotation.py:78-102`
`door_commands_paused` = switch on AND (a row in an ACTIVE state OR the latest row `needs_repair`), derived from `bridge_rotations` (survives a
restart, no in-memory flag); checked in `access_control._perform_signed :893-894` (inside the request's BEGIN IMMEDIATE connection, before
signing, refused through `act.refuse` -> audited `intercom.release denied`), `doors.door_status :404-405` (503 `not_sent`, NOT audited) and
`lease_events._secret :114-115` (`NotSendable` -> held). Only the trusted-door bridge path is paused; emergency LOCK/OPEN, door windows and door
automation never go through `ha_bridge.sign` (grep: none) and are unaffected. Tests `test_bridge_key_rotation_295.py:570-594` (system.configure
alone -> 403 naming `bridge.key.rotate`; a custom role cannot carry it), `test_bridge_key_pause_295.py` (every ACTIVE state + `needs_repair` ->
503 and no `door_open` leaves; finished states do not pause; switch off lifts; lease held). NOT_RUN; the head's message does not say they ran.

**K-01 - low - `needs_repair` pauses remote door opening until a successful resume or the rotation switch is turned OFF (READ).**
`bridge_rotation.py:92-93`; test `test_switching_the_rotation_off_lifts_the_pause`. Fail-closed is right (a door never opens on a half-switched key;
WisKey-local credentials still work), but the switch-off exit lifts the pause while the key state is still unknown - the next command is signed
with whichever key Arx holds and the peer refuses it if misaligned (fail closed again, CR 16.2). No non-admin can trigger a pause: a rotation
starts only from `bridge.key.rotate` + system admin or the worker's reminder, and a forged `status` cannot reach the engine (`_call(expect=)`). A
system administrator can deny remote opening for ~3 min per start, bounded by `_LOCK` and the back-off. *Fix*: a card line "doors paused" while
`door_commands_paused`; audit the status refusal (`doors.py:404`) like the release refusal. Does not block the merge.

**K-02 - info** - held lease messages have no age bound while paused (`lease_events.py:377`); the host's 15 s silence rule destroys the lease
anyway (`:50`). Capture lease is NO-GO regardless. CR 16.3 (`fresh_repair`, `emergency`) is a feasibility note; nothing is built - consistent.

**R3-01 - info** - `/ha/bridge/ping` (`routers/ha.py:641-648`) accepts any verified body, rewrites `integration_version`, re-runs `_lease_repair`;
reachable only by a key holder after HA-01. Cosmetic hardening: require `version`, refuse `protocol` / `op` like the directory route.

**R3-02 - low (docs)** - `CR-WISKEY-HMAC-ROTATION-295.md:253` still says the first rotation is automatic (contradicts 15.2 and the code);
`docs/release/2.11.0-RELEASE-NOTES.md` has no re-pair wording; the guide's case 1 is a failed rotation, not a build rollback. Release-notes round.

Verdict: **merge GO for 2.11.1** once its two test files run green on the runner; no permit or switch changes; both sides fail closed.

### 4.2 `pilot/WAPACE-295` (86de0ea9e..f3431107a, all on release/2111) - the reservation port (READ)

What holds: `routers/messaging_accounts.py:292-296` `_port()` requires exactly `messaging.pacing.reserve` at the INSTALLATION on all three routes
(`:299-319`); `messaging.accounts.manage` does not open the port and the port principal is refused on GET / PUT pacing (`test_wa_pacing.py:632`,
NOT_RUN). The permission is in the catalogue only (`roles.json:500`), in **no built-in role** (no wildcard in `rbac.authorize`). Not on any public /
`www-public` router; routes use `current_principal` (session or HA-validated bearer); the service-identity user is refused at sign-in
(`service_identity.py:566-585`); a wall / kiosk reaches it only if bound to a role holding it. Bodies `extra="forbid"`, `request_id`
`^[A-Za-z0-9_.:\-]{8,128}$`, `retry_after_s` 1..86400 (`:269-286`). The route store is the request connection for reads AND writes
(`messaging_runtime.py:448-456`) under the BEGIN IMMEDIATE write gate, so admission + lease row are one step; the worker's pacer uses a bound
write connection (`tickets/messaging.py:484-496`). Accounting: idempotent by `request_id` (`wa_pacing.py:703-707`); the first release outcome
stands, another outcome -> `conflict` (`:733-734`); unknown id -> `unknown_request`; closed outcome vocabulary (`:679-681, 726-729`); only
`not_sent` / `expired` credit (`:680, 735`); an unreleased lease stays counted (`:310, 377`); `_count` rejects bool / negative; no arithmetic can go
negative or overflow; lease rows pruned after 8 days (`tickets/messaging.py:816`). The tolerant reader `parse_wiskey_account` (`:422-438`) needs
schema v1 + a regex `sender_ref`; counts are used only when `sender_match_verified is True`, `counters_complete is True` and the sender is mapped
(`:504-519`); null = unknown, never zero; the input is WisKey's `whatsapp/status` answer over the Home Assistant WebSocket
(`intercom_messaging_adapter.py:257-264`), cached <= 300 s, never an HTTP body from a client. No phone number, text, host or token anywhere
(recipients are ledger HMAC keys; `senders` values are opaque refs; `_problems` carries field names only); PUT audits before / after (`:259-263`).

**WP-01 - medium (before a `senders` mapping is configured) - a verified WisKey counter or throttle can silence Arx's own alerts (READ).**
`wa_pacing.py:541-552`: the window caps apply to EVERY class including `alert`; with a huge `charged[window]` the wait is ~1 s on every re-check
for as long as the cache is fresh; `charged_*` / `throttled_until` have no upper bound (`:408-419`). A WisKey bug or whoever answers the WisKey
command inside Home Assistant reports `charged_24h` in the billions or `throttled_until` far in the future for a verified mapped sender, and every
Arx alert is deferred until its class age limit and ends `pacing_expired`; `throttled_until` already excludes alerts (`:527`), the count path does
not. *Fix*: cap `extra` at 2x the window cap (beyond = unknown, ignored); never let a count-only excess delay `CLASS_ALERT` (the owner's rule
"alerts are counted but never delayed"); clamp `throttled_until` to `now + ACCOUNT_BACKOFF_S[1]`. *Blocks*: not 2.11.0 (needs WisKey's unbuilt status
block + a mapped verified sender).

**WP-02 - medium (design, later enablement) - the port principal can starve Arx's notifications (READ).** `reserve :695-715` admits with the same
shares as Arx; an `alert`-class lease takes 100 % of every window; no per-caller or per-class ceiling, no floor for Arx. A stolen WisKey token or a
WisKey loop reserving `alert` fills burst / minute / hour / day and Arx's own alerts wait (`:548-550`). *Fix*: a lease ceiling (leases <= N % of
each window, or `alert` leases capped per minute), a `lease_active` cap per account, audit a lease storm. Record in the port contract.

**WP-03 - low - contract rules not enforced (READ).** `CR-WA-PACING-295-PORT-CONTRACT.md` 2.2 says the port user MUST NOT be an HA administrator and
MUST be dedicated; nothing checks `HaUser.is_admin`, and `maybe_bootstrap` (2.5) would make the first caller after a reset a system administrator.
*Fix*: refuse the port for an HA admin / the bootstrap candidate, or state it as owner procedure only. Later enablement.

**WP-04 - low (2.11.1) - no audit row for reserve / release / lease status (READ).** `messaging_accounts.py:299-319`; only refusals are audited by
`require`; a `conflict` release, a `late` release and a `slowdown` report (which starts an account back-off, `:738-741`) leave no actor trace.

**WP-05 - low - `mode: off` grants and records every reserve (READ).** `admit :585-586` allows when `budget is None`; each distinct `request_id` writes
a lease row until the 8-day prune. *Fix*: cap `lease_active` per account even in `off`. Later enablement.

**WP-06 - info** - `lease_expired` denial is per id; expired unreleased leases stay counted (correct) - combined with WP-02 this is the
starvation path, not a separate bug.

### 4.3 `pilot/W11TPL-295` (0afdb83bb) - template send outside the 24-hour window (READ)

What holds: `intercom_messaging_adapter.py:57 TEMPLATE_SEND_SUPPORTED = False` unchanged (the branch adds only `send_template`, `:309-312`);
`wa_template_send.permit()` reads it at call time; `switch_on` default OFF, unreadable OFF; `admit` refuses `template_unsupported` first; the
production transport `UnwiredTransport` answers `not_sent / template_unsupported`; **no route, screen or caller exists** (`send_template` is called
nowhere). Arx never holds a template body; params are a closed slot set (<= 8), each a non-empty str <= 1024, sent as an ordered list - no string
formatting into a template; `name` / `language` / `id` regex-bound; registry max 20, any bad entry -> empty registry (fail closed). `read_answer`
is closed (`accepted` exact; `not_sent` only with a `PRE_SEND_CODES` code; else `unknown`, never retried); `params` excluded from `repr`; the log
line prints the exception type only. `declined` consent always refused; rate answers feed `WaPacer.on_result`. Tests pin each (NOT_RUN).

**TP-01 - low** - the pacer is optional in `TemplateSender` (`admit` checks the budget only when `pacer` and `pacing_for` are set); a future caller
built without them sends paid templates outside the shared budget. *Fix*: required, or refuse `paced_unavailable`. Later enablement.
**TP-02 - low (product)** - a `notice` template to a person with `unknown` consent is admitted while `consent_by_link` is off (CR open question 7);
a first contact outside the window is by definition someone who never replied. Owner decision at enablement.
**TP-03 - info** - `person_id` / `account` are unvalidated strings on the wire; a route built later must validate and audit (ids only).
**TP-04 - info** - `needs_template()` is defined but unused by `send`; `send` refuses a non-consent template unless the caller says `open`.

Verdict: **merge GO**; nothing can send.

### 4.4 `pilot/DDAREA-295` (c4522680a) - UI only

`frontend/src/screens/devices-area-nav.ts`: the phone pickers read `data-dd-phone` from `<html>` (set by `shell/tabs-mode.ts`) and choose sheet vs
popover; CSS and attribute logic only; no `unsafeHTML`, `innerHTML`, storage or network. Two Playwright specs. No finding.

## 5. Scope 4 - what is exposed, to whom

New routes between integ/2102 and release/2111 (READ): `GET/PUT /messaging/whatsapp/pacing` (`messaging.accounts.manage`), `POST .../pacing/reserve`,
`POST .../pacing/release`, `GET .../pacing/lease/{request_id}` (`messaging.pacing.reserve`, held by nobody); `POST /doors/windows/rules/{id}/arm`,
`POST /doors/windows/rules/{id}/token` (`access.windows.manage` on every door of the rule + person rule + confirmation; `arm` refused while
`automation_actor_on` is False, `door_window_triggers.py:170-171`); `POST /doors/windows/doors/{station}/{relay}/open-for` (`.manage` on the door,
`.cancel` is not enough; bounded 60 s..12 h and by `max_hours`; creates a plan row only); `POST .../foreign-handled` (`.manage` or `.cancel`).
Nothing new on the public (`www-public`) surface. New permissions: `messaging.pacing.reserve` (catalogue only), `bridge.key.rotate` (HMACACT2,
system permission, system_admin only). New built-in roles: the four door presets (DW-07). Error texts: closed codes everywhere read; the one
message that names a host (`/ha/bridge/pairing` `addon_url`) is pre-existing and `system.configure`-only. Secrets: the `ha_event` trigger token is
returned once (`routers/door_windows.py:184-187, 253`) and stored as SHA-256 (`door_window_triggers.py:117-132`); compared constant-time (`:393`);
event data never logged (`:478-497`); refusal audits capped 60 / h (`:347-360`). i18n: new door-window strings carry `{name}` placeholders filled
by the renderer; no string embeds a host, id of a person or a token. Audit gaps: WP-04; `doors.py:404` (K-01); the ECCACT seam modules (by
design, nothing wired).

**T-01 - low (gate hygiene; gate 2 will show it red) - a test pin asserts the pre-ECCACT permits.** `tests/test_wkv2b_295.py:193-194`
`test_the_live_engine_stays_refused_and_no_switch_is_on`: `assert ag.GO_LIVE_PERMITTED is False and a5.GO_LIVE_PERMITTED is False` with no
monkeypatch; both are True on release/2111. INTEG-2111-NOTES lists `test_wkv2_295.py` but not `test_wkv2b_295.py`. Not a security weakness. *Fix*:
follow ECCACT (True) or monkeypatch, as `test_wkpeer_295.py:96-103` does; `test_stationsync_295.py:12` docstring is stale. Owner rule applies:
red from a stale pin -> a targeted run on the release head, not a full re-gate.

**DA-06 - low (later `doors.automation_open` enablement) - the watched entity is still corroborated against the mirror only (READ).**
`door_automation.py:896-905` reads `ha_entities.last_changed / last_updated` for state / numeric_state triggers; `direct_run` reads only the
automation entity. The attacker must ALSO make Home Assistant's own state machine show the automation ran in the window, which firing events
cannot do - so the mirror clause is defence in depth now, not the gate. *Fix*: read the first matching watched entity through `_read_state` too.

## 6. Tests

| Head | Files named | Result |
|---|---|---|
| release/2111 5cbfe7df4 | `test_bridge_key_activation_295.py` (HA-01/HA-02 pins), `test_door_emergency.py`, `test_doorwin_api.py`, `test_doorwin_watch.py`, `test_doorwin2_review2.py`, `test_door_automation_295.py`, `test_wkv2_295.py`, `test_wkv2b_295.py`, `test_stationsync_295.py`, `test_eccact_*.py`, `test_wa_pacing.py`, `test_messaging_accounts.py`, `test_notify_whatsapp.py` | **NOT_RUN** here; gate 2 is running them. Expected red: T-01. Evidence gap: DW-08 |
| HMACACT2-295 97c13f812 | `test_bridge_key_pause_295.py`, `test_bridge_key_rotation_295.py` | **NOT_RUN** |
| W11TPL-295 0afdb83bb | `test_wa_template_send_w11.py` | **NOT_RUN** |
| DDAREA-295 | two Playwright specs | **NOT_RUN** |

No test exists for DW-01 / DW-02 with the shipped permit, DW-03 (a blocking fake engine), DW-06, WP-01 (unbounded counters), WP-02 (lease floor).

## 7. Recommended order of work

1. Decide DW-01 / DW-02 (Hebrew questions 1-2). If fixed in 2.11.0: the `implemented` flag on both live engines (+ `live_ok()` and `_window_engine`),
   the T-01 pin, one test with the shipped permit; targeted run on the release head.
2. 2.11.1: HMACACT2 merge after its tests; WP-04 audit rows; K-01 card line + audit; R3-02 texts; HA-03 screen text; `test_doorwin_api` fixture (DW-08).
3. Into the W13-e request to WisKey: DW-09's four idempotency / level / ordering sentences, DW-04 (OPEN supersedes LOCK at the engine), E-03's
   transport timeout <= 8 s.
4. Before the live emergency engine: DW-03 (cancel + stale guard + transport timeout), DW-05.
5. Before `access.external_grants` is recommended ON: G-01. Before a WisKey identity holds `messaging.pacing.reserve`: WP-02, WP-03, WP-05.
   Before a `senders` mapping: WP-01. Before `doors.automation_open`: DA-06 + live sender + W1.
6. Extended identity and capture lease: unchanged from review 2 (X-01 steps; L-01 conditions).

## 8. Contradictions recorded (not resolved)

1. CR-039 build notes T21 / `door_emergency.py:3-5` ("a button that cannot act would be a false sense of safety") vs the ECCACT permit flip +
   CHANGELOG 2.11.0 `:48` ("turning a switch on today plans and audits without moving a door") - DW-01.
2. Review 2 verdict "tier D prepared: GO" vs the build (tier D unreachable while the permit is True) - DW-02.
3. CR-039 E-1 (bounded OPEN repeat after UNKNOWN) vs AGENTS.md "never queue or blindly retry physical commands" - kept by owner decision 2026-10-21
   option C; conditioned on WisKey (DW-09).
4. `wiskey_acr5.py:56` and CHANGELOG `:50` ("each wiskey.acr5_* switch still defaults OFF") vs the code (no caller of `consumer_on`) - G-01.
5. `CR-WISKEY-HMAC-ROTATION-295.md:253` ("first rotation automatic") vs 15.2, the guide and the code (manual) - R3-02.
6. Owner decision 2026-10-13 (emergency OPEN: system administrators only) vs the built-in `emergency_open` role a system administrator can bind
   to anyone - DW-07 (may be intended).
7. CR-WA-PACING port contract 2.2/2.5 (dedicated non-admin port user) vs no enforcement in code - WP-03.
8. The owner's revoke middle path (a v1 clean answer ends a grant as `revoked / unverified`) vs AGENTS.md "never claim unseen proof" - G-02, labelled honestly in row, API and audit.
9. Review-2 items still open: E-06 (operator cancel + relock confirmation), HA-03, E-05.

## 9. Not verified

Any test (section 6); the frontend beyond `devices-building.ts`, `devices-area-nav.ts`, `system-diagnostics.ts:668`; the rotation against a real
Home Assistant and bridge 0.9.5; the WisKey W13-e / W1 / U2 contracts (they do not exist); `intercom_sync.SYNC.stations()` when the feed is down
(E-10); the `PATCH /settings` whitelist for `wiskey.*` keys (G-03); `ha_sync`'s handling of `state_changed` frames (DA-06's premise is now moot
for the automation entity); whether Home Assistant restricts `call_service` for non-admin users on custom services (assumed not).
