# Fable security review 4 - extended service identity (impact-check re-review) and the capture lease to card intake (2026-10-21)

Independent read-only review (Fable). No product code was changed; nothing was run on the Ubuntu runner or on the workstation; no live
system, Home Assistant, bridge, WisKey or tunnel was contacted; no secret, host, address, serial or token appears here. Precedence
(AGENTS.md): approved change request -> `MASTER_SPEC_HE.md` / `docs/security/` -> `AGENTS.md`. Contradictions are recorded, not resolved
(section 10). Reviews 2 and 3 are `private/planning/FABLE_REVIEW_2_2026-10-21.md` / `FABLE_REVIEW_3_2026-10-21.md`; their IDs (X-01, L-01,
L-02, K-02) are kept. New findings here are `V-` (extended identity) and `L-03..L-07` (capture lease).

## 0. Head reviewed, method, and what this review could not find

| Scope | Ref | Commit | How read |
|---|---|---|---|
| everything below | `origin/release/2111` (= gate 2 head, 2.11.0, bridge 0.9.5) | `5cbfe7df4` | detached worktree; every file:line is at this commit |
| the go-live pack | `private/planning/svcident_golive_pack_2026-10-18/` (workstation copy, gitignored) | files of 2026-10-18 | read in full: `FABLE_REREVIEW_BRIEF.md`, `GOLIVE_CHECKLIST_HE.md`, `RESIDUAL_RISK.md`, `AMENDMENT_DIFF_REVIEW.md` |

- **READ**: every statement is from reading code and documents at the pinned commit; routes and gates were traced by hand. **TESTED: nothing.**
  Every test named here is **NOT_RUN** by this review (the test names are evidence of what the authors claim, not of what passes).
- **The "20 questions".** Review 2 called the brief "20 questions". The brief (`FABLE_REREVIEW_BRIEF.md`) lists **18** numbered questions
  (1-7 impact check, 8-9 entity policy, 10-18 add-on fences, audit, guard). All 18 are answered in section 3. No other list of questions
  exists in the pack, in CR-USR2 or in `docs/security/`.
- **Baseline drift.** The brief, the draft amendment and `RESIDUAL_RISK.md` pin `origin/main @ 2c2c19466` (2.7.1, bridge 0.9.2). The code
  that would actually be permitted is release/2111: bridge 0.9.5 (HMACACT key set), the remote kill switch (SVCIDENT-AMEND273, merged in 2.7.3),
  the bridge allowlist picker and the residual-risk texts (EXTID-295, 2.10.0). This review answers against release/2111, which is what the
  brief could not. The step list (Appendix A of the draft) is unchanged between 0.9.2 and 0.9.5 (checked pair by pair against
  `runnable.IMPACT_STEP_PAIRS` / `STEP_ADDITIONS` / `TOGGLE_PAIRS` and `service_identity.DEVICE_PAIRS`).
- **Could not find**: (a) any written WisKey confirmation of a consumer for `smplwise_bridge.lease_event` or of the four lease request
  answers - the newest status I found (`private/planning/arx_reply_all_open_2026-10-17/STATUS_TABLE.json`) lists `ARX-LEASE-RESPONSE.WK`
  as **OPEN** and `WAO-03` as "agreed finding, ETA TBC"; (b) any bridge release, branch or file that defines a `lease_event` or
  `lease_request` service (grep over `smplwise_vms/integration/` and `custom_components/` at 5cbfe7df4: none; `services.yaml` lists
  `execute, set_entity_area, schedule, stream_source, media_query, sync_directory, config_item, cast_stream, rotate` only); (c) a Home
  Assistant installation to confirm V-01's premise about Home Assistant's own schema (stated from knowledge of HA core, flagged NOT VERIFIED).

## 1. Summary

| Severity | Count | IDs |
|---|---|---|
| high | 0 | - |
| medium | 2 | V-01 (code, cheap fix, must fix before the permit), V-02 (pre-existing basic-mode path, record / ticket) |
| low | 5 | V-03, V-04, V-05, V-07, L-05 |
| info | 4 | V-06, V-08, L-04, L-06 |
| external blockers | 2 | L-03 (no bridge lease service, no WisKey consumer), L-07 (card-grant capture flow not built) |

### Verdicts

| Capability | Review 2 / 3 | Review 4 | One-line reason |
|---|---|---|---|
| Extended service identity - **the code**, judged by the 18 questions with the owner's decisions of 2026-10-18 taken as given | not reviewed | **GO-WITH-CONDITIONS** | no HIGH; one MEDIUM correctness gap in the impact check (V-01: a device-action step with a decoy `action` key is judged as the decoy) - a one-line reorder plus a test; everything else the brief asked holds, or is a risk the owner explicitly accepted (R1, R2, R3, R4, R5/R6, R8, R12) |
| Extended service identity - **the permit** (`EXTENDED_GO_LIVE_PERMITTED`) | NO-GO (X-01) | **NO-GO today; GO after the ordered checklist of section 7** | the binding document is still "מפרט מחייב 1.1" (`docs/security/HA_IDENTITY_RBAC_HE.md:1`), the amendment is still a DRAFT (`..._DRAFT_HE.md:3`), V-01 is open, no full gate, no supervised run. This review closes checklist step 3 (the re-review) - with one condition |
| Capture lease (`capture_lease.GO_LIVE_PERMITTED`) | NO-GO (L-01) | **NO-GO - nothing Arx can do alone** | the bridge service does not exist (L-03), WisKey's consumer is unconfirmed (L-03), `MIN_BRIDGE_FOR_CAPTURE_LEASE` is None (`capture_lease.py:61`), and the card-grant capture flow is a missing implementation, not a locked one (L-07) |

## 2. The documents - where each stands on release/2111 (READ)

| Document | State | Evidence |
|---|---|---|
| `docs/security/HA_IDENTITY_RBAC_HE.md` (binding) | **1.1, unchanged**; §7 forbids "scripts לא מבוקרים" under a generic control ability, §8 ¶3 says scripts / scenes are blocked "עד allowlist ובדיקת השפעות" | `:1` header; `:72`, `:84`; git log: last touched by the USR2 P0 amendment (`2cff07a2d`), nothing since |
| `docs/security/HA_IDENTITY_RBAC_AMENDMENT_EXTENDED_SERVICE_IDENTITY_DRAFT_HE.md` | **DRAFT, not binding**; E1-E12 applied (owner decision 1); section 4a lists the accepted risks; section 6 lists seven flip conditions; section 7 is the application note (bump to 1.2) | `:3-8`, `:105-121`, `:133-149`; commit `06864fed1` |
| `docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md` §12.8 | the nine owner decisions recorded; "nothing here is a permit"; item 7 says `notify` **not decided** | `:797-819` |
| the DRAFT's section 4a, decision 7 | says `notify` **decided, option b (as built)** | `:102`, `:115` |
| `GOLIVE_CHECKLIST_HE.md` | steps 1-8; step 3 = this review; step 5 = the permit commit recipe; step 7 = the supervised run (11 sub-steps) | pack |
| code | `EXTENDED_GO_LIVE_PERMITTED = False` | `services/service_identity.py:89`; `extended_on()` `:241-249`; the switch ON refused 409 `extended_not_permitted` `routers/settings.py:1020-1025` |

**Contradiction recorded (not resolved):** CR-USR2 12.8 item 7 ("notify - not decided; R4 stays open") vs. the draft's 4a decision 7 ("notify
stays as built, accepted"). One of the two must be corrected before the owner approves the amendment (section 5, A-3).

The binding document and the code agree today: the document forbids, the constant refuses. The amendment is the only thing that makes the
permit consistent with precedence; it must be applied as 1.2 **before** the permit commit (the draft's own section 7 says so).

## 3. The impact-check re-review - the brief's 18 questions against release/2111 (READ)

Files: bridge `smplwise_vms/integration/smplwise_bridge/runnable.py` (470), `service_identity.py` (249), `__init__.py:328-593`,
`stream_source_service.py:219-251`, `config_service.py:69-156`, `config_policy.py:119-126, 470`, `config_store.py:71-102`,
`schedule_service.py:117-133`; add-on `services/service_identity.py` (752), `routers/ha.py:238-332`, `routers/settings.py:836-849, 1000-1028`,
`routers/service_identity.py` (103), `rbac.py:127-141`, `services/automation_ops.py:228-276`, `routers/alarm.py:414-431, 478-497, 561-604`,
`services/door_authority.py:93-144`, `services/ha_camera_streams.py:199-331`, `services/schedule_ops.py:1242-1262`, `services/backup.py:95-149`.
The two bridge copies are byte-identical for `runnable.py`, `service_identity.py`, `__init__.py`, `keyset.py` (SHA-256 compared).

| # | Question (short) | Verdict | Evidence | Severity / fix |
|---|---|---|---|---|
| 1 | Can any step shape reach a never-target and pass `analyse`? | **One shape can - V-01.** Everything else refused: `service_template` alone -> `impact_step_unknown` (`runnable.py:303`); `action` as list / dict -> `impact_step_unknown` (`:237-238`); a template in `action` -> `impact_template` (`:239-240`); upper-case / spaces are lowered and stripped exactly as HA's `cv.service` does (`:241`); `repeat` / `choose` / `if` / `parallel` / `sequence` children are walked (`:305-317`), odd keys inside `choose` options refused (`:311-312`); `enabled: false` steps are still judged (conservative); `variables` cannot feed a non-template field and templates are refused; `scene.apply` inline is judged as a scene, one level (`:245-252`); `script.<object_id>` is a nested call (`:258-259`); `automation.trigger` is nested (`:260-261`); a scene with `entities` as a list -> `impact_step_unknown` (`:208-209`); a lock state `"Locked"` -> refused (`:217`, conservative); `homeassistant.turn_on` / `automation.turn_on` / `script.turn_off` -> `impact_service_not_allowed` (`:268-269`); a `data.entity_id` of another domain -> `impact_target_unresolved` (`:270-271`); a cycle -> `impact_nesting_too_deep` (`:228-229` at level 1) | **V-01 MEDIUM**: `_walk` tests `"action" in raw or "service" in raw` **before** `"device_id" in raw` (`:291-296`). Home Assistant decides a step's type by the order of its `ACTIONS_MAP`, where `device_id` comes before `action` / `service`, and the device-action schemas are built on `DEVICE_ACTION_BASE_SCHEMA` with `extra=ALLOW_EXTRA`, so a step `{device_id, domain: lock, type: unlock, entity_id: lock.x, action: "lock.lock"}` is a valid *device action* for HA (runs `lock.unlock`) while the impact check judges `("lock","lock")` on a matching target and passes it; the service user's default policy passes too. Who can write it: an HA administrator editing the item in YAML mode (a delegated author is refused any device action by `config_policy.py:470`; HA's visual editor never adds an `action` key to a device action). *Fix*: in `_walk`, check `device_id` / `event` / `scene` / the control keys **first**, in HA's order, and refuse any step dict that carries more than one action-type key (`impact_step_unknown`); test: the decoy step is refused, a plain device action still `impact_device_action`. **Must fix before the permit: yes** (one line + one test; it restores the amendment's sentence "פעולת מכשיר ... נדחה"). NOT VERIFIED against a live HA: the `extra=ALLOW_EXTRA` premise is from HA core as I know it - the permit commit's test should import `homeassistant.helpers.config_validation` and assert the schema behaviour rather than trust this sentence |
| 2 | Indirect effects (R1): is a platform-based refusal sound and cheap? | **Confirmed R1; refusal is sound and cheap; the owner declined it (decision 3).** `_service_step` judges the service, never what the target does (`:268-274`); `switch.turn_on` on a `template` switch, `button.press` on a template / door-station button, `input_boolean.toggle` on a helper an HA automation watches, `remote.send_command` - all pass. The registry platform is one lookup and already exists in `__init__.py:494-496` (`_registry_platform`); `template`, `group`, `input_boolean` (helpers) are reliable platform names | Accepted residual risk (R1, decision 3). Recorded; re-offered as a one-line option in section 8 (owner question 4) |
| 3 | The step list (R2): what must leave or be re-validated? | **Confirmed R2 - unchanged by owner decision 3.** `IMPACT_STEP_PAIRS = DEVICE_PAIRS | plain arming` (`:77`) still contains `remote.send_command`, `remote.turn_on`, `webostv.button`, `button.press`, `siren.turn_on/off`, `media_player.play_media`, `music_assistant.play_media`, `valve.*` (`service_identity.py:70-90`). On the direct path `media_policy.refusal` re-checks media / remote calls (`__init__.py:393-406`); inside a runnable item nothing does | Accepted (decision 3). The draft names them (Appendix A, E7). Nothing further unless the owner reverses decision 3 |
| 4 | `notify.*` (R4) | **Confirmed R4.** Keys closed to `NOTIFY_KEYS` and any template refused (`:262-267`); `message: command_*`, `data.actions`, TTS, SMS targets all pass as literal content | Draft 4a decision 7 says accepted; CR-USR2 12.8 item 7 says not decided (section 2 contradiction). Owner to confirm once (section 8, Q5) |
| 5 | Cover rule | **Holds as written, with the self-declared-class limit (V-03).** `cover_refusal` reads the live `device_class` (`:386-395`); every cover service in the list (`open/close/stop/set_position/*_tilt`) collects covers (`:272-273`); a scene setting a cover too (`:221-222`); `cover.toggle` never in the list (`:88-91`). A template or group cover declares its own class, so a "blind" wrapping a garage passes; class can change between check and run (TOCTOU, R10) | **V-03 LOW** - inside R1 (accepted). Cheap hardening: refuse covers whose registry platform is `template` / `group` (same lookup as Q2). Not a permit blocker given decision 3 |
| 6 | Nested items | **Enforced for every nested form.** `script.turn_on` targets, `script.<id>`, `automation.trigger`, `scene.turn_on`, the `scene:` step, inline `scene.apply` all go through `_nested` (`:226-232, 256-261, 297-300`); `impact_refusal` refuses a nested id not on the allowlist (`:410-412`) and judges the nested item at level+1 (`:413`), where any further nesting is `impact_nesting_too_deep` (`:228-229`) - a self-reference or cycle is refused; the policy check covers `facts.targets + facts.nested` (`:419`) | holds |
| 7 | `_load_item`: YAML / integration items, unreadable files, stale cache | **Holds.** Registry platform must be the UI platform (`:362-364`; `PLATFORM` = automation / script / `homeassistant` for scenes, `config_service.py:34`), `unique_id` must exist (`:365-367`), the store reads `scripts.yaml` / `automations.yaml` / `scenes.yaml` **on every call, no cache** (`config_store.py:71-95`: `path.read_text` each time; tags refused; unreadable -> `StoreError` -> `impact_unknown_item` `:369-374`). A YAML-package automation has the same platform but is not in `automations.yaml` -> `impact_unknown_item`. A duplicate `id` between a YAML package and the UI file is an HA registry collision (HA keeps one entry) - NOT VERIFIED, negligible | holds; TOCTOU between the file read and the run is R10 (accepted, recorded) |
| 8 | Default non-admin policy passes everything (R5); can the bridge detect it? | **Confirmed R5.** HA's default `system-users` group policy allows every entity; `policy_refusal` (`:340-355`) therefore refuses nothing for an unrestricted service user. Detection is feasible and specified: CR-USR2 13.6 (`:870-885`) - `user.groups` beyond `system-users` and a non-default `PolicyPermissions`, reported with the directory push, add-on step `service_policy_default`, 503 refusal on both sides. **Not built** (owner decision 4: recommendation only; 13.5 item 2: text only). The text exists (bridge options description, card line `data-si-policy-risk`, DOCS, guide 47 - EXTID-295) | **V-08 INFO** - the one decision I would ask the owner to revisit (section 8, Q3): without it, R1 / R2 are bounded by the allowlist alone |
| 9 | Is S2 applied on every on-behalf path? | **Yes for `execute` (`:433-450`, every entity), impact targets and nested ids (`:419`), `config_item` run ops (own entity: `config_service.py:211` `_check_permissions`; and `:283` for the item's targets), `schedule` (`schedule_service.py:117-133`). No for `stream_source` (`stream_source_service.py:236-240`: `admin_waived` checks only existence - R6, accepted by decision 4), `cast_stream` and `media_query` (basic mode, read-only / Cast-origin bound; no extended item)** | R6 accepted; recorded in the draft 2.2 / 4.13. The admin waiver is passed only for an on-behalf message with the bridge switch on (`__init__.py:474-480`) |
| 10 | `_local_subject` order; any route sending a run without `entity_id`? | **Order as the brief states** (`service_identity.py:359-406`): id form -> switch -> live local user -> `extended_on` -> never-list -> feature table -> runnable (add-on list, by the passed `entity_id`; absent = `no_entity` = refused, `:454-460`) -> service id -> candidate -> bridge >= 0.9.0 -> extended item: bridge >= 0.9.2 AND bridge copy on -> bridge allowlist copy -> audit. **Every run caller passes the entity id**: `routers/ha.py:305-306`, `services/device_bulk.py:775-776`, `automation_ops.bridge_body:236-237` (`run_entity`; `apply_scene` passes `entity_id`). The other `subject()` callers (`alarm.py:427`, `media_commands.py:801`, `media_query.py:226`, `schedule_ops.py:339`, `schedules.py:456`, `cast_sessions.py:458-460, 717`, `ha_camera_streams.py:206-207`) name features whose tables hold no run item, so `runnable_item()` is None and the feature table refuses a smuggled `script.turn_on`. The payload guard (`guard_payload`, `:590-599`) and `ha_client._guard_subject` run on every transport | holds |
| 11 | Second factor (R3) | **Confirmed R3 - accepted by decision 2.** `LOCAL_ADMIN_PERMISSIONS` (`rbac.py:131-135`) holds `sources.configure` (so the camera path needs the factor) but not `door.unlock`, `alarm.bypass`, `alarm.disarm`, `script.run`, `automation.manage`, `ha.entity.control`; `local_factor_gate` (`:139-141`) withholds only the listed ones; `local_door_ok` (`service_identity.py:509-516`) does not read `factor_ok`. Arx-only users sign in on the remote channel only (CR-USR2 `:30`) | Accepted. Recorded in the draft (4.9, 4a decision 2). My opinion in section 8 |
| 12 | Kill switch from the remote channel (R7) | **Built and correct (SVCIDENT-AMEND273).** `PATCH /settings`: ON is local-only (`settings.py:1014-1015`), OFF from either channel, system administrator, audited (`:1016-1028`); `POST /identity/extended-mode/off` outside the remote-blocked prefix, system administrator + `system.configure`, 422 when neither flag is set, never an ON direction (`routers/service_identity.py:83-102`; `kill_switch` `:479-501` can only remove); `extended_on()` is read live on every call so OFF applies at once. Tests `test_service_identity_remote_kill.py` (13, NOT_RUN) | R7 closed. No security reason found against it |
| 13 | Rate limits (R8) | **Confirmed R8 - none, accepted by decision 6.** The action route has idempotency per `client_request_id` and an in-flight claim only (`routers/ha.py:283-285, 322-332`); the bridge `execute` has no limit (`__init__.py:374-430`); only `stream_source` is rate limited (`stream_source_service.py:203-216`) | Accepted. Recorded |
| 14 | WisKey door path | **As documented (S4), with two things the owner should hold in mind (V-07).** `local_door_ok` = extended mode (add-on switch + `security.local_identity` + permit) AND an active, non-deleted local user (`:509-516`); then `door_authority.check` exactly as for everyone: wall accounts refused, deny wins, `access.doors.open` or `door.unlock` (`door_authority.py:122-144`); the door leaves by the station-release WS path while `doors.trusted_path` is off (`trusted_door.py:3-10`). What the bridge switch "adds" for infrastructure locks and is absent for WisKey doors: the HA administrator's consent (second administrator) - for WisKey doors the Arx system administrator alone decides. No second factor (Q11). The card says so (`EXTENDED_FEATURE_LABELS["doors"]`, `status().extended.doors_addon_only`) | **V-07 LOW** (design, recorded in the draft 4.5) |
| 15 | Stream source URL hygiene (R6 / S5) | **Holds.** The URL is returned once by the bridge (`stream_source_service.py:251`), the bridge logs class names only (`:244-246`; test `test_no_log_line_on_any_path_carries_the_url_or_its_parts`, NOT_RUN); the add-on hands it to go2rtc and drops it (`ha_camera_streams.py:218-232, 264-275`); audit rows carry `stream` name and `result` = `created` / `updated` / `unchanged` (`go2rtc service :218, :229`), never the URL; errors are closed codes (`_BRIDGE_REFUSALS`, `CODE_RE`). S5: a camera an `l_` person enabled is not served while the mode is off (`_local_off :210-215`) and `reconcile()` removes it; background refreshes pass `quiet=True` (`:505`). By design the URL does live in go2rtc's configuration (AGENTS.md: go2rtc persists config) - not an Arx leak | holds |
| 16 | Audit chain (R13) | **Reconstructable from the add-on alone, with one reading rule (V-04).** Per extended item: `identity.service_identity.extended` (feature, bridge service, item, `entity_id` for runs) `:400-405`; the route rows name the person (`ha.action` attempt / outcome `routers/ha.py:356, 381, 394`; `alarm.*` through `_Act`; the door rows; `automation.run`; `camera_card.ha_live.*`); `ha_actions.context_id` (migration 0063 `:46-47`) is filled from the bridge answer (`ha_client.py:363`) and `device_activity` links HA state changes to the person by it (`device_activity.py:11, 297`). Refusals: `identity.service_identity.refused` with the reason; bridge impact refusals come back as closed codes and settle the op (`automation_ops.bridge_call :269-271`) or the action row | **V-04 LOW**: the `extended` row is written *before* the bridge decides (`:400-405`, the call leaves after `subject()` returns); after a bridge refusal an investigator sees an "allowed" identity row next to a failed route row. Reading rule: the route's outcome row is the truth; say so in the ops guide (or write the identity row after the answer - more work, not needed) |
| 17 | Residual risks CR-USR2 12.3 / draft section 4 accurate and bounded? | **Accurate, with one severity note (V-02) and one staleness (V-05).** 12.3 items 1-3, 5, 6 and the draft's 4.1-4.13 match the code read above. Item 5 / draft 4.7 (schedules): `SERVICE_FEATURES["schedules"]` is a **basic-mode** feature (`service_identity.py:103`), the bridge schedule handler checks the service user's entity policy for the payload's entities (`schedule_service.py:117-133`) but applies neither the runnable allowlist nor the impact check; `mark_script` (`schedule_ops.py:1242-1262`) is required only for a script "that disarms / unlocks / opens a door, or whose content is not known - an ordinary script is schedulable without one" | **V-02 MEDIUM (pre-existing, basic mode)**: an Arx-only person with `schedules` can schedule `script.turn_on` of any script the schedule view classes as ordinary (e.g. one that switches a relay or a template switch), under the service user, with no allowlist and no impact check - the exact reach the extended-mode fences were built to bound, through a door that is open today. *Fix*: for a local principal, route scheduled `script.turn_on` / `scene.turn_on` through the bridge's `runnable.impact_refusal` with the allowlist (the `schedule` handler already has the user and `hass`), or refuse script / scene actions in schedules for local principals until then. Not a permit blocker by the owner's own logic (the path exists in 2.6.4) - but it belongs in the amendment's section 4 **as a medium**, and a ticket should exist before the permit (section 8, Q6). **V-05 LOW (docs)**: the draft header, section 1 and Appendix A pin `main @ 2c2c19466` / bridge 0.9.2; the approved text must be re-pinned at the permit head (release/2111 or later) - the step list is unchanged, the kill switch (4.10) and the picker are now facts, not plans |
| 18 | The go-live guard: what else still says "not permitted"? | **V-06 INFO - the permit commit's inventory**, section 6 | - |

### R1-R17 confirmation table

| R | Result on release/2111 | Note |
|---|---|---|
| R1 | confirmed, HIGH as a risk, **accepted** (decision 3) | Q2; V-03 is inside it |
| R2 | confirmed, **accepted** (decision 3) | Q3 |
| R3 | confirmed, **accepted** (decision 2) | Q11 |
| R4 | confirmed; **decision status contradictory** (CR 12.8 item 7 vs draft 4a) | Q4; A-3 |
| R5 | confirmed, **accepted as text only** (decision 4, 13.5); detection designed, not built (13.6) | Q8; V-08 |
| R6 | confirmed, **accepted** (decision 4) | Q9 |
| R7 | **closed** - built (AMEND273) | Q12 |
| R8 | confirmed, **accepted** (decision 6) | Q13 |
| R9 | confirmed (allowlist binds an id; the impact check re-runs each time; a retarget within the list is possible); no change notice built | LOW stays |
| R10 | confirmed (files, no cache; TOCTOU) | LOW stays |
| R11 | confirmed (`routers/automations.py:83` `skip_condition = True` default; the draft 4.11 names it) | LOW stays |
| R12 | confirmed, **accepted** (decision 8) | - |
| R13 | confirmed, with V-04's reading rule | LOW stays |
| R14 | confirmed (`_local_off`, reconcile within its throttle) | LOW stays |
| R15 | confirmed - **severity raised to MEDIUM (V-02)** | Q17 |
| R16 | confirmed (design) | - |
| R17 | confirmed (revert the permit commit; settings rows ignored; `extended_on()` False whatever is stored) | verify in the supervised run |

## 4. Findings (extended identity)

| ID | Sev | Title | Where | Must fix before the permit? |
|---|---|---|---|---|
| V-01 | medium | a device-action step with a decoy `action` / `service` key is judged as the decoy (never-target reachable by an HA administrator's YAML edit) | `runnable.py:291-296` | **yes** - one reorder + "more than one action-type key = unknown" + test (and a test against HA's real schema) |
| V-02 | medium (pre-existing) | the basic-mode `schedules` feature runs any "ordinary" script under the service user without the allowlist or the impact check | `service_identity.py:103`, `schedule_service.py:117-133`, `schedule_ops.py:1242-1262` | no by the owner's logic; **name it medium in the amendment and open a ticket** |
| V-03 | low | cover class is self-declared (template / group covers), TOCTOU | `runnable.py:386-395` | no (R1 accepted); cheap hardening offered |
| V-04 | low | the `identity.service_identity.extended` "allowed" row precedes the bridge's decision | `service_identity.py:400-405` | no; one sentence in the ops guide |
| V-05 | low (docs) | the draft and the pack pin 2.7.1 / bridge 0.9.2; the permit head is 2.11.x / bridge 0.9.5 | draft `:13`, `:151`; pack | **yes** - re-pin in the applied 1.2 text |
| V-06 | info | inventory of texts / tests the permit commit must change (section 6) | many | yes (it is the permit commit) |
| V-07 | low (design) | WisKey doors: no HA-administrator consent and no second factor - the Arx system administrator's switch alone | `service_identity.py:509-516`, `door_authority.py:93-104` | no; owner awareness |
| V-08 | info | the default-entity-policy refusal (13.6) is designed, not built; decision 4 keeps R5 as text | CR-USR2 `:870-885` | owner question |

**What I looked for and did not find (negative results, READ):** a path that sends an extended item while `extended_on()` is False (none: every
caller goes through `subject()` / `_local_subject`, which reads `extended_on` live; `refuse_automation_run`, `refuse_zone_bypass`,
`local_door_ok`, `ha_camera_streams._identity_ok` all read it); a route that lets a local principal reach `set_entity_area` (never-list in
both modes, `:72-73`, plus the route's `identity_unmapped`); a way for the bridge's own switch to act without the add-on's (the bridge only
judges what the add-on sends; `screen` strips `on_behalf_of` and the handler runs as the service user only after `obo_refusal` passed,
`service_identity.py:213-239`); a forged `on_behalf_of` that changes who acts (`user_id` must equal the configured service id, `:234-235`;
the local id never travels as `user_id`, `guard_payload`); a stale bridge view that allows rather than refuses (the add-on's copy can only
cause a 503, the bridge decides live, `__init__.py:343-349`); a way to turn the extended switch ON remotely or without the permit
(`settings.py:1014-1025`, tests `test_remote_on_is_refused_even_with_the_permit`, `test_local_on_still_needs_the_go_live_permit`, NOT_RUN).

## 5. Amendment text changes beyond E1-E12 (for the owner's approval; NOT applied)

- **A-1 (V-05)** Header / section 1 / section 6 item 2 / Appendix A: replace the pin `main @ 2c2c19466 (2.7.1), רכיב החיבור 0.9.2` with the
  permit head (`release/2111` or the commit chosen) and `רכיב החיבור 0.9.5`; state that Appendix A was re-checked against that commit
  (unchanged since 0.9.2). Section 4 item 10: "נבנה ב-pilot/SVCIDENT-AMEND273" -> "נבנה ושוחרר ב-2.7.3".
- **A-2 (V-01)** Section 2.3 (ד): after "הוא פעולת מכשיר (device action) או ירי אירוע" add "- גם כשהצעד נושא בנוסף מפתח action או service
  (צעד עם יותר ממפתח-סוג אחד נדחה)". This sentence is true only after the V-01 fix.
- **A-3 (R4)** Decide the `notify` record: either CR-USR2 12.8 item 7 becomes "decided 2026-10-18, option b, accepted" or the draft's 4a
  decision 7 and 4.12 revert to "open". The two documents cannot both be right.
- **A-4 (V-02)** Section 4 item 7 (schedules): add the severity and the bound: "חמור-בינוני: סקריפט 'רגיל' לפי מסך התזמונים מתוזמן ללא
  רשימת ההיתר וללא בדיקת ההשפעות, תחת משתמש השירות; מוגבל במדיניות הישויות של משתמש השירות ובסימון 'מותר בתזמונים' לסקריפטים שפותחים
  דלת / מנטרלים. כרטיס מעקב: <id>".
- **A-5 (V-04)** Section 4, new item: "שורת האודיט identity.service_identity.extended נכתבת לפני החלטת רכיב החיבור; שורת התוצאה של המסלול
  (ha.action / automation.run / alarm / דלת / מצלמה) היא המקור לשאלה 'מה קרה'."
- **A-6 (Q14, V-07)** Section 4 item 5: add "ואין גורם שני" (consistent with 4.9) so the WisKey-door sentence states both absences in one place.

## 6. The permit commit - what must be inverted or changed (V-06, READ)

Code: `services/service_identity.py:89` (`False` -> `True`, comment with the permit date and this review's file). Nothing else in code (the
guard sites read the constant).

Tests that pin False and must be inverted or re-scoped: `test_service_identity_extended.py::test_the_extended_mode_ships_without_the_go_live_permit`
(`:83-85`), `::test_the_switch_cannot_be_turned_on_without_the_go_live_permit` (`:88`), `::test_a_stored_on_value_changes_nothing_without_the_go_live_permit`
(`:102`) - and the autouse fixture `:74-77` that monkeypatches the permit ON for every test *not* named `without_the_go_live_permit` (after the
flip the three "without" tests need the permit patched OFF instead); `test_service_identity_runnable.py::test_the_go_live_constant_stays_false_and_a_list_changes_nothing_without_it`
(`:70`); `test_extid_followups.py::test_the_build_still_ships_locked` (`:45-46`) and `::test_a_local_user_is_not_offered_bypass_while_the_extended_mode_is_off_without_the_go_live_permit`
(`:49`); `test_service_identity_remote_kill.py::test_local_on_still_needs_the_go_live_permit` (`:105`). New tests: switch default OFF; ON only
by a system administrator on the local channel (403 remote); add-on ON + bridge OFF -> 503; empty allowlist -> every run refused; the V-01 decoy
step refused; `frontend/tests/unit-service-identity.spec.ts` (the card's "review required" line).

Texts: `services/service_identity.py:695-696` (step `extended_on`: "נדרשת סקירת אבטחה לפני הפעלה" -> "נסקר ב-21.10.2026 (סקירה 4)");
`EXTENDED_FEATURE_LABELS["devices.control"]` (`:153`: add `script.run`); `routers/settings.py:1025` (unreachable after the flip; cosmetic);
module docstrings `services/service_identity.py:37-38`, bridge `service_identity.py:31-32`, `__init__.py:43-51`; bridge
`translations/he.json:37`, `en.json:37`, `strings.json:37` in **both** copies (a bridge text change = a version bump, 0.9.6, and one HA
restart - or leave the bridge text for its next version, as the checklist suggests); `smplwise_vms/DOCS.md:1520, 1526, 1583, 1599`,
`DOCS_HE.md:1359, 1364, 1413, 1428`, `docs/user-guide/he/47-identity-users_HE.md:21, 47` ("נעולה בקוד"); CR-USR2: a new section 12.9 (permit
date, the owner's quoted words, this review, the hardening built); bilingual CHANGELOG. `GOLIVE_CHECKLIST_HE.md` step 5 already lists most of
these; add the `test_extid_followups` and `remote_kill` pins and the frontend spec.

## 7. Ordered checklist - extended service identity to GO

| # | What must be true | Who | Evidence it is done |
|---|---|---|---|
| 1 | **V-01 fixed** on a branch from release/2111 (bridge `runnable.py` reorder + two tests; both copies byte-identical; no bridge version bump needed if shipped with 0.9.6 anyway - a Python-only change still needs one HA restart) | lead / Opus | commit + the two tests named; a targeted Fable look at the diff (10 minutes) |
| 2 | **A-3 decided** (notify) and **A-1, A-2, A-4, A-5, A-6 applied to the DRAFT**; the owner approves the draft as a change request **in chat, explicitly** | owner (decision), lead (text) | the chat line; the draft commit |
| 3 | The **document owner applies the amendment** to `docs/security/HA_IDENTITY_RBAC_HE.md`: header `מפרט מחייב 1.2`, status line with the date, 2.1 / 2.2 / 2.3 + Appendix A at the anchors (draft section 7). A **separate docs commit**, before the permit | document owner | `HA_IDENTITY_RBAC_HE.md:1` reads 1.2 |
| 4 | Owner decisions re-confirmed or changed for: second factor (Q11), default-policy refusal 13.6 (Q8), the schedules ticket (V-02) - section 8 questions 3-6. If 13.6 is chosen: build + tests + bridge 0.9.6 before step 6 | owner | CR-USR2 12.9 |
| 5 | HA-side preparation by the owner (checklist step 4): a dedicated non-admin service user with no human password, in a restricted group; bridge >= 0.9.5 installed; card "ready"; both sides agree | owner | card screenshot |
| 6 | **Permit commit** on `pilot/EXT-ID-PERMIT` from the then-current main: exactly section 6; message carries `Owner permit: <date> (<quote>); Fable re-review: GO-WITH-CONDITIONS, private/planning/FABLE_REVIEW_4_2026-10-21.md` | lead | the commit; the five identity test files run locally (honest NOT_RUN for what did not run) |
| 7 | **Full gate (L)** on the runner, clean before and after; green | lead | gate log |
| 8 | **Release**; the switch stays OFF in the installation | lead | release notes (bilingual) |
| 9 | **Supervised first run** - checklist step 7, items 1-11, owner present, every door action approved by the owner one by one; add: the V-01 decoy script refused; a kill-switch OFF from the remote channel mid-session; the audit chain read back (`extended` row + route row + `ha_actions.context_id`) | owner + lead | the step-7 report (pass / fail / not run per item, no addresses) |
| 10 | **Permanent enablement** - a separate owner decision after step 9 (first week: 1-2 Arx-only users, a short allowlist, daily audit review) | owner | chat |

Steps 1-3 and 6 are hours of work; 7 is the runner queue; 9 is about two hours with the owner.

## 8. Residual risks and my recommendation (extended identity)

With decisions 2, 3, 4, 6, 8 as they stand, the fences the permit relies on are: the add-on and bridge **allowlists** (an administrator picks
every item and every nested item), the **impact check** (direct never-targets and the closed step list - after V-01), the service user's
**entity policy only if the HA administrator restricted it** (R5, text only), the person's **own Arx permission** for every item, **deny wins**
on doors, and the **remote kill switch**. What stays open by the owner's choice: a stolen Arx-only password opens doors over the internet
(R3); a listed script may drive a relay, an RF code or a template switch that opens a gate (R1 / R2); an unrestricted service user gives
the second fence no bite (R5). These are honest trade-offs, written down; they are not defects.

My recommendation, stated plainly (the owner asked for opinions, not agreement):
1. Pursue the permit only after steps 1-3 of section 7; they are cheap and they are what precedence requires.
2. **Revisit decision 2 for doors and zone bypass only** (second factor for `door.unlock` / `alarm.bypass` / `alarm.disarm` on a local
   principal - the `LOCAL_ADMIN_PERMISSIONS` mechanism exists, `rbac.py:131-141`, one line each + tests). A door over the internet on a
   password alone is the one risk here that an outsider can exploit without any administrator's help.
3. **Build 13.6** (default-policy refusal) before the permit if the owner wants R1 / R2 bounded by more than the allowlist; otherwise keep
   the allowlist very short and treat every entry as a door key.
4. Do not block the permit on V-02, but open its ticket and state it in the amendment.

## 9. Capture lease to card intake

### 9.1 What exists (READ, release/2111)

- **Arx side, complete and locked**: the ledger and triggers (`services/capture_lease.py`: states `:9`, `LEASE_MAX_S = 120` `:56`, one
  live lease per receiver / actor by partial unique indexes, `issue()` `:560-624` with the H1 gate mark, M1 savepoint, dev / kiosk / unwired
  sources refused `:569-576`), the event sender and worker (`services/lease_events.py`: `lease_revoke` retried at least once, `lease_heartbeat`
  every 5 s, `lease_stream_reset`; `BridgeLeaseTransport` calls `smplwise_bridge.lease_event` / `lease_request` `:77-91`), the route
  (`services/capture_lease_route.py`, `routers/access_control.py:1561-1612` `_lease_start`, `:1866` the mode branch), the settings route
  (`routers/capture_lease.py`: `on` refused 409 `capture_lease_not_permitted` `:101-104` and `capture_lease_unavailable` `:105-108`; off
  revokes all `:112-113`), `SETTINGS_KEEP` (L-02). `GO_LIVE_PERMITTED = False` (`capture_lease.py:65`), `MIN_BRIDGE_FOR_CAPTURE_LEASE = None`
  (`:61`), `route_on` = switch AND permit AND bridge (`:175-178`), `ensure_issuable` before anything is signed (`:201-206`).
- **The contract**: `docs/contracts/wiskey-capture-lease/` (SCHEMA.md, lease.schema.json, GOLDEN_VECTORS.json, NOTE_FOR_WISKEY.md - items 1-9
  of what WisKey must build / confirm); the Arx answer schemas `private/planning/arx_reply_all_open_2026-10-17/A_lease_response/`.
- **Bridge side: nothing.** No `lease_event`, no `lease_request` (section 0). The service names themselves are provisional
  (`NOTE_FOR_WISKEY.md` item 3: "Arx uses `lease_request` provisionally").
- **WisKey side: unconfirmed.** `STATUS_TABLE.json`: `ARX-LEASE-RESPONSE.WK` OPEN ("WisKey: lease_service.request answers with these closed
  shapes"), `WAO-03` agreed finding, ETA TBC; CR 7.4 "Not verified". The owner's 2026-10-20 night list still carries "capture lease / card
  capture" under **no answer** (`OWNER_DECISIONS_2026-10-20_NIGHT.md:70, 81`).
- **The classic path is live and unaffected**: `cards/capture_*` over the WS service channel with the add-on's identity (`wiskey_channels.py`;
  `access_control.py:1879`) - no lease, never revoked by the event (CR 8.6). The lease route is **additive** for the people-editor capture.

### 9.2 Findings

**L-03 - external blocker (confirms L-01 (1)-(2)).** No bridge offers the service; WisKey's consumer and answer shapes are not confirmed in
writing anywhere I could find. Nothing on the Arx side can change this; the Arx permit without them would flip a constant that
`bridge_available()` still answers False to (`:159-164`) - harmless, but pointless.

**L-04 - info (scope clarity).** "Capture lease to card intake" is two different flows: (a) the **people-editor card capture** (exists today
on the classic path; the lease route would add revocable authority and the signed transport to it); (b) **card grants for a vendor's
technicians** (`services/access_cards.py`): a card is typed by number and written through the WisKey seam (`attach` `:95-160`); a card READ at a
reader (`capture` `:163-170`) answers 409 `access_grant_card_capture_off` because `CAPTURE_PERMITTED = False` is, in the module's own words,
"NOT a permit but a missing implementation - the grant -> capture lease -> confirm flow is not built in Arx" (`:37`). Flow (b) needs building
(route + lease start bound to the grant + confirm -> `card_add`), its own tests and its own permit, after flow (a) is live.

**L-05 - low (confirms L-01 (3)).** After HMACACT the lease envelopes are signed through `ha_bridge.signing_key` (`lease_events._secret :112-115`)
and carry a `kid` once a rotation completed; the bridge's future `lease_event` / `lease_request` verifier must be `keyset.KeySet.verify` (as the
other services use), never the plain pairing code, and must honour the rotation pause (`door_commands_paused`, HMACACT2 - K-02: held lease
messages have no age bound while paused; the host's 15 s silence rule destroys the lease anyway).

**L-06 - info.** Card grants by typed number are now enable-able in principle (`access_grants.GO_LIVE_PERMITTED = True`, ECCACT; switch
`access.external.cards` OFF, needs `access.external_grants` ON, system administrator) - independent of the lease. Review 3 G-01 (the acr5
switches gate nothing) applies to that path; it is not a lease matter.

**L-07 - blocker for flow (b).** See L-04: not locked, not built.

### 9.3 Ordered checklist - capture lease to GO

| # | What must be true | Who |
|---|---|---|
| 1 | WisKey confirms **in writing**, through the owner: items 1-9 of `NOTE_FOR_WISKEY.md` (consumer of `lease_event`, 15 s silence rule, the four requests in the W1 envelope with final service names, `binding_revision` meaning, refusal of a service-user actor, the confirm barrier, `live_leases` informational, bounded `stage` / `code`, the M2 reconciliation) and `ARX-LEASE-RESPONSE.WK` (the closed answer shapes) | owner -> WisKey |
| 2 | Bridge slice L4: `lease_event` + `lease_request` services (stages 1-7 with `KeySet.verify`, closed schemas, `supports_response: ONLY`, data exactly `{signed_message_json}`), version 0.9.6+, both copies byte-identical, `tests/test_bridge_lease_event.py`, the GOLDEN_VECTORS pass against the bridge verifier; the rotation pause honoured | lead / Opus |
| 3 | **One commit**: `MIN_BRIDGE_FOR_CAPTURE_LEASE = "0.9.6"` (or the real number) AND `GO_LIVE_PERMITTED = True` (`capture_lease.py:61, 65`), with the owner's written permit quoted in the message; invert the pins (`test_capture_lease_review_fixes.py:193` `capture_lease_go_live_permitted is False`, and the `MIN_BRIDGE ... is None` assertions in the lease test files); add the fake-bridge tests for the real service names | lead |
| 4 | Full gate (L); release; the switch `access.capture_lease` stays OFF | lead |
| 5 | **Supervised lab run**, owner present, with the owner's test card and one interior station: start -> captured -> confirm (card appears in WisKey, lease `destroyed(confirmed)`); start -> a permission change by another administrator -> session reads "קריאת הכרטיס הופסקה" within a second and WisKey's session is gone; stop the add-on mid-capture -> WisKey destroys after 15 s; a clock-invalid answer -> no new lease until re-enable; audit export (ids only) read back. The owner's form item stands: "the previous run is not a permit for this" | owner + lead |
| 6 | Flow (b) (card grants read at a reader): decide whether wanted; if yes, build (`access_cards.capture` -> lease start bound to the grant -> confirm -> `card_add`), review, its own permit and lab run - **after** step 5 | owner, then lead |

### 9.4 Residual risks (lease) and recommendation

Recorded already in the CR (section 8): at-least-once revoke vs. AGENTS.md (the message only removes authority), the heartbeat as liveness
(needs WisKey's agreement), two transports during the transition (the classic path has no lease), `binding_revision` opaque. New here: none
on the Arx side. **Recommendation: NO-GO, park it.** Spend nothing on the Arx side until WisKey answers; the one useful action now is for the
owner to forward `NOTE_FOR_WISKEY.md` items 1-9 and the answer schemas as a numbered request and ask for a date. The classic capture path
serves the people editor meanwhile exactly as today.

## 10. Contradictions recorded (not resolved)

1. `HA_IDENTITY_RBAC_HE.md` 1.1 §7-8 forbids what the extended mode would allow; the amendment that permits it is a draft (X-01, unchanged).
2. CR-USR2 12.8 item 7 (`notify` not decided) vs. the draft's 4a decision 7 (`notify` accepted as built) - A-3.
3. The draft's section 2.3 (ד) "פעולת מכשיר ... נדחה" vs. the code (V-01: refused only when no `action` / `service` key is present).
4. `AMENDMENT_DIFF_REVIEW.md` E5 ("make the restricted group a condition") vs. owner decision 4 (recommendation only) - recorded in CR 12.8 item 4; 13.6 designed, not built.
5. The brief's baseline (2c2c19466 / 0.9.2) vs. the code that would be permitted (release/2111 / 0.9.5) - V-05.
6. The lease CR 1.1 names the service `lease_event` and the requests ride the W1 envelope; `lease_events.py:91` sends `lease_request` "provisionally" - the final names are WisKey's (NOTE item 3).
7. `access_cards.CAPTURE_PERMITTED` is called a permit by its name and documented as "not a permit but a missing implementation" (`:37`) - L-04.
8. Review-2 wording "20 questions" vs. the brief's 18 - section 0.

## 11. Not verified

Any test (all NOT_RUN); Home Assistant's `DEVICE_ACTION_BASE_SCHEMA` `extra=ALLOW_EXTRA` and `ACTIONS_MAP` order (V-01's premise - from
knowledge of HA core, to be asserted by a test against the installed package); the schedule view's classification of an "ordinary" script
(V-02's bound; `view.read_script_marks` / `script_content_hash` not traced); the frontend card and the bridge options flow in a real HA (the
picker was never rendered - CR 13.3); the registry collision case of Q7; WisKey's side of everything in section 9; whether the HA logbook
attributes to the service user (expected, R13) - no HA was contacted.
