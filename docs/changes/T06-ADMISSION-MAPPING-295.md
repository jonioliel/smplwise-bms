# T06-ADMIT-295 - identity + role + scope -> admission, for every signed WisKey command of the 2.19.0 candidate

Branch `pilot/T06ADMIT-295`, built on `origin/release/2190` @ e476e48ae. Tests only (plus this note); no product code changed. Fakes only: no WisKey,
Home Assistant, station, door, network or runner was touched.

Test file: `smplwise_vms/backend/tests/test_t06_admission_295.py` (every id below is a test in it unless another file is named).

## How admission works in the candidate

The signing transport (`DirectCommandSession.call` -> `DirectLink.call_command`) signs **any** command string it is handed, with the pairing
(service) key; it has no allow-list and no notion of an operator. Admission therefore lives entirely in the **callers**. There are four gate kinds:

| Gate id | Where | What it judges |
|---|---|---|
| `G-PEOPLE` | route gate (`iw.gate_create` / `gate_person_write`, `people_writer()`), then `wiskey_direct_join.people_send` -> `nw.arx_decision` | `access.people.manage` on EVERY station of the person (before and after), sensitive level for credentials, an **interactive human** actor (`iw.interactive`), a fresh decision (<= 10 s) |
| `G-FEATURE` | `FeatureAdapters.prepare` -> `fx.resolve_policy` -> `build_policy_snapshot` | the Arx permission(s) behind each WisKey permission string (`fx.ARX_PERMISSION_OF`), on every station of the request (station features) or at the installation (people/CSV, live validation); deny wins; an automation needs creator AND approver |
| `G-DOOR` | `routers/access_control.release` -> `door_authority.check` | identity (`ingress`/`remote`/`dev`+dev mode, local only in the extended mode), active user, not a wall account, `access.doors.open` on the station chain or `door.unlock` on the lock entity, deny of either wins |
| `G-MEDIA-ROUTE` | `routers/intercom_media.py`, `intercom_listen.py` | `access.call` (talk, listen) / `access.read` (+ `video.live` for the live socket) on the station chain, BEFORE `im.provider_for` is touched |

`G-WRITER-INTERNAL` = a command the writer sends only inside an already admitted write (source read, binding read, receipt resolve);
`G-LEASE-SYSTEM` / `G-FEATURE-READ` / `G-DOOR-STATUS` / `G-SESSION` = system or read-back commands over records Arx itself stored;
`G-NONE-NO-CALLER` = a command that has **no admission check and no product caller** (see Findings).

## The command table

Scope for the station-chain gates = the station, its building, its site, the installation (deny wins, revoked and expired bindings do not count).

| Command | Gate | Permission needed | Scope check | Tests |
|---|---|---|---|---|
| `users/create` | G-PEOPLE | `access.people.manage` | every station the draft names; installation if none | `test_people_send_admits_a_manager_of_the_right_station_and_nobody_else[users/create]`, `test_http_people_write_without_the_permission_is_refused_before_anything_is_signed[users/create]`, `test_http_people_write_scope_decides_which_persons_and_stations_are_admitted[users/create]`, `test_people_send_refuses_a_principal_that_is_not_an_interactive_human[users/create]` |
| `users/update` | G-PEOPLE | `access.people.manage` | every station of the person, before and after | same four, `[users/update]` |
| `users/set_active` | G-PEOPLE | `access.people.manage` | every station of the person | same four, `[users/set_active]` |
| `users/archive` | G-PEOPLE | `access.people.manage` | every station of the person | same four, `[users/archive]` |
| `users/unarchive` | G-PEOPLE | `access.people.manage` | every station of the person | same four, `[users/unarchive]` |
| `users/temporary_cancel` | G-PEOPLE | `access.people.manage` | every station of the person | same four, `[users/temporary_cancel]` |
| `users/delete` | G-PEOPLE | `access.people.manage` | every station of the person | same four, `[users/delete]` |
| `cards/add` | G-PEOPLE | `access.people.manage` + `access.people.sensitive` | every station of the person | same four, `[cards/add]` |
| `cards/remove` | G-PEOPLE | `access.people.manage` + `access.people.sensitive` | every station of the person | same four, `[cards/remove]` |
| `peer_writes/source_v1` | G-WRITER-INTERNAL | none of its own (sent inside an admitted write) | the write's scope | `test_the_only_modules_that_reach_a_signing_call_are_the_known_ones`, `test_no_router_reaches_a_writer_or_an_adapter_except_through_the_join` |
| `peer_bindings/get` | G-WRITER-INTERNAL | none of its own (recovery read) | the write's scope | same two |
| `peer_receipts/resolve` | G-WRITER-INTERNAL | none of its own (reads ONE stored original) | the stored original | same two |
| `users/name_ref_prepare_v1` | **G-NONE-NO-CALLER** | **none** (`rename()` takes no decision) | none | `test_finding_2_rename_carries_an_rbac_decision` (xfail), router-import guard |
| `users/name_ref_apply_v1` | **G-NONE-NO-CALLER** | **none** | none | same |
| `users/bulk_receipt` | **G-NONE-NO-CALLER** | **none** (reads a stored operation) | none | same |
| `capture/lease_request` (`capture_start/status/confirm/cancel`) | G-CAPTURE-LEASE | `access.cards.capture` + `access.people.manage` | reader's station + every station of the person, decided again on the write connection (`_lease_redecide`) | `test_capture_decision_needs_both_permissions_on_the_reader_station_and_every_person_station`, `test_the_signed_capture_lease_is_unreachable_in_this_build`, `test_http_card_capture_start_confirm_cancel_follow_permission_scope_and_ownership` |
| `capture/lease_event` (`lease_revoke/heartbeat/stream_reset`) | G-LEASE-SYSTEM | system (worker); any permission-revision bump revokes every live lease | the lease | `test_the_signed_capture_lease_is_unreachable_in_this_build` |
| `features/status` | G-FEATURE-READ | none (capability list) | none | `test_every_signed_command_in_the_code_has_a_row_and_a_documented_gate` |
| `features/start` | G-FEATURE | see the feature permission table | every station of the request / installation | `test_the_feature_policy_offers_a_permission_only_to_a_holder_on_the_right_scope`, `test_a_feature_request_with_no_permission_is_refused_before_anything_is_stored_or_sent`, `test_a_feature_request_with_the_permission_on_the_right_station_is_admitted`, `test_an_automation_needs_both_its_creator_and_its_approver`, `test_a_human_actor_is_required_to_have_an_active_session` |
| `features/prepare_media` | G-FEATURE | `access.stations.read` / `access.call` | every station of the request | same as `features/start` (feature `live_media`) |
| `features/result` / `features/cancel` | G-FEATURE-READ | none (an `operation_ref` Arx stored; renews nothing) | the stored operation | `tests/test_wkcap_295.py::test_a_completion_read_is_a_fresh_command_with_only_the_operation_ref_and_renews_nothing` |
| `features/media_ingress_v1` | G-FEATURE | ticket of an admitted `prepare_media` | the ticket | same as `features/prepare_media` |
| `media/station_descriptor`, `media/stream_lease` | G-MEDIA-ROUTE | `access.read` (+ `video.live` live socket) | station chain | `test_http_media_descriptor_is_gated_on_access_read_on_the_station`; live socket: `tests/test_intercom_media.py` |
| `media/talk_open`, `media/talk_frame`, `media/talk_floor` | G-MEDIA-ROUTE | `access.call` | station chain (TalkLease re-checks while the session runs) | `test_http_talk_and_listen_are_gated_on_access_call_on_the_station_before_any_provider` |
| `media/talk_close` | G-MEDIA-ROUTE | none (the caller's own session) | the session | same |
| `door_open` | G-DOOR | `access.doors.open` (legacy `access.release`) or `door.unlock` | station chain (+ lock entity); deny wins | `test_door_open_is_signed_only_for_a_holder_on_the_right_station`, `test_door_rule_maps_identity_before_permission`, `test_local_identity_exception_for_doors_is_locked_in_this_candidate_and_judged_normally_when_open` |
| `door_open_status` | G-DOOR-STATUS | none (a request id Arx recorded) | the recorded request | `tests/test_wiskey_door_signed.py` |
| `whatsapp/template_send_v1`, `whatsapp/template_send_v2` | **G-NONE-NO-CALLER** | **none** (`TemplateSender.send` takes ids only) | none | `test_finding_5_a_template_send_names_its_actor` (xfail) |
| `direct/connect` | G-SESSION | service identity (the pairing key) | the pairing | `tests/test_wkdirect_295.py` |

### WisKey permission strings of the six feature adapters (`fx.ARX_PERMISSION_OF`)

All proven by `test_the_feature_policy_offers_a_permission_only_to_a_holder_on_the_right_scope` (holder on the right scope: offered; no grant, other
station, revoked, expired, explicit deny, and a station-scoped grant used where the installation is needed: not offered).

| WisKey permission | Arx permission(s) (any) | Features that offer it |
|---|---|---|
| `door/pulse` | `access.doors.open` | door automations, live validation |
| `door/hold_open` | `access.windows.manage`, `access.emergency.open` | door windows, emergency, door automations |
| `door/restore` | `access.windows.manage`, `access.emergency.open`, `access.emergency.lock` | door windows, emergency, door automations |
| `door/emergency_secure` | `access.emergency.lock` | emergency |
| `door/emergency_open` | `access.emergency.open` | emergency |
| `door/emergency_release` | `access.emergency.lock`, `access.emergency.open` | emergency |
| `media/video_receive` | `access.stations.read` | live media |
| `media/audio_receive`, `media/microphone_send` | `access.call` | live media |
| `people/write` | `access.people.manage` | people / CSV |
| `validation/run` | `access.stations.manage` | live validation |
| `validation/identity`, `validation/door_capabilities`, `validation/door_read` | `access.stations.read` | live validation |
| `validation/media` | `access.call` | live validation |

Emergency (`DirectEmergencyEngine`): `test_emergency_hold_needs_emergency_open_on_the_station`,
`test_emergency_release_needs_a_holder_of_lock_or_open_and_the_manual_context_is_arxs_own`,
`test_emergency_fire_needs_the_automation_lineage_and_both_principals`.

### Commands on the Home Assistant feed (not the direct interface; listed so the picture is complete)

`cards/capture_start|status|confirm|cancel`, `cards/reader_capabilities`, `users/pin_generate`, `stations/test_unlock`, `whatsapp/preview|send`, `tts/*`,
`stations/call`: same route gates (`people_writer(extra)`, `_door_gate_ro`, `_gate(CALL)`, `PEOPLE_MESSAGE`); proven by the existing suites
`tests/test_intercom_writes_s11.py`, `tests/test_wiskey_door_path.py`, `tests/test_intercom_messaging.py`, `tests/test_intercom_adapter.py`. T06 adds the card-capture
matrix (`test_http_card_capture_start_confirm_cancel_follow_permission_scope_and_ownership`).

## Identity mapping

- A person: `ingress`, `dev` (developer mode only for doors), `remote`/`local` with `via == "cookie"` (an Arx sign-in session). Everything else (`remote`+`bearer`,
  `internal`, `system`, `push`, `device`) is **not** an interactive human: native people writes refuse it (`actor_session_inactive`), the door rule refuses it
  (`identity_unmapped`). Tests: `test_people_send_refuses_a_principal_that_is_not_an_interactive_human`, `test_door_rule_maps_identity_before_permission`.
- Inactive user, wall/kiosk account: refused at the door rule (`user_inactive`, `wall_account`); inactive user holds nothing in `rbac.authorize`
  (`test_an_inactive_user_holds_nothing`).
- Revoked / expired grants and explicit denies: refused everywhere they were tried (people, door, features, emergency, capture).
- **Local-identity exception.** In this candidate it is SVCIDENT2: an Arx-only identity is refused at the door rule while `EXTENDED_GO_LIVE_PERMITTED` is False
  (the build constant, False); with the permit and both switches on, the same rule decides, with no extra approval step
  (`test_local_identity_exception_for_doors_is_locked_in_this_candidate_and_judged_normally_when_open`). **EMROLE (`pilot/EMROLE-295`, 29dc3616f / bb7af019a /
  b3da0e262) is NOT in release/2190** (`git merge-base --is-ancestor 29dc3616f HEAD` is false; the three commits touch `door_emergency.py`, the new
  `door_emergency_grants.py`, `roles.json`, `door_windows.py`, `local_identity.py`). Its exception (a local identity holding `emergency_open` besides its one
  role) therefore could not be tested here; it needs its own admission rows when it lands in 2.20.0.

## Findings

| # | Finding | Severity | Pinned by |
|---|---|---|---|
| 1 | `FeatureAdapters.prepare(actor=..., principals=...)` never checks that the request's `actor.user_id` (or an automation's creator/approver) IS the principal(s) whose permissions were judged. The caller supplies both; a mismatch is admitted (actor = an unprivileged user, principals = a privileged one). Today's only production caller (`DirectEmergencyEngine`, context from `incident_context`) builds both from the same Arx user row, so it is latent. Fix is 4-6 lines (compare ids in `prepare`), not a one-liner, so it is **not** fixed here. | medium (latent) | `test_finding_1_...` (strict xfail) |
| 2 | `NativePeopleWriter.rename` (`users/name_ref_prepare_v1` + `users/name_ref_apply_v1`) takes an actor but **no `ArxDecision`**: no RBAC admission inside, and no product caller. Also `resolve_name_ref` / `users/bulk_receipt`. Unreachable from a router today (guard test); any future caller must add the decision. | low (no caller) | `test_finding_2_...` (strict xfail), router-import guard |
| 3 | The signing transport has no command allow-list and no operator identity: `DirectCommandSession.call` / `DirectCommandPort.send_signed` / `DirectCapturePort.call` sign any command string. Admission is wholly caller discipline. Mitigated here by pinning the set of modules that reach a signing call and by forbidding router imports of the writer/adapters. A catalog allow-list at the session would be defence in depth (not a one-liner). | design | `test_finding_3_...` (strict xfail), `test_the_only_modules_that_reach_a_signing_call_are_the_known_ones` |
| 4 | `ArxDecision` names neither the permission, the actor nor the targets it decided; `NativePeopleWriter.write` only checks its shape and age (<= 10 s). A decision minted for one write can be presented for another. All production paths go through `people_send`, which mints it per write. | low (no caller) | `test_finding_4_...` (strict xfail) |
| 5 | `whatsapp/template_send_v1` / `_v2`: `TemplateSender.send` and `DirectTemplateTransport` carry no actor, permission or scope; no route calls them (source comment: "No route calls this yet"). A future route must put the `access.people.message` + station-chain gate in front. | low (no caller) | `test_finding_5_...` (xfail) |
| 6 | Features other than emergency (door windows, door automations, people/CSV, live media, live validation) have **no production caller** of `FeatureAdapters.prepare` in this candidate (door automations are also `GO_LIVE_PERMITTED = False`); their admission is proven at the seam only. | info | `test_a_feature_request_with_the_permission_on_the_right_station_is_admitted` |
| 7 | The signed capture lease (`capture/lease_request`, `capture/lease_event`) cannot be switched on (`capture_lease.GO_LIVE_PERMITTED = False`, `MIN_BRIDGE_FOR_CAPTURE_LEASE = None`); capture runs on the HA feed lane in this build. The lease decision (`_lease_redecide`) is tested directly. | info | `test_the_signed_capture_lease_is_unreachable_in_this_build` |
| 8 | `users/pin_generate` is not a native command (not in `nw.ACTIONS`): it stays on the HA feed with `people_writer(PIN_GENERATE)` + interactive-only. | info | existing S11 suite |

No command was found whose route can send without ANY check; the "no admission" rows (2, 5) are commands with no caller.

## Tests run

`cd smplwise_vms/backend && ..\..\..\smplwisebms\.venv\Scripts\python.exe -m pytest tests/test_t06_admission_295.py -q -p no:cacheprovider` on the Windows
workstation, fakes only (nothing on the Ubuntu runner): 58 passed, 5 xfailed (the five FINDING tests, strict), exit code 0.

NOT_RUN: anything against a real WisKey / Home Assistant / station; the live video socket (`/live/ws`) and the talk / listen WebSockets (covered by
`tests/test_intercom_media.py` and `tests/test_wkaudin_295.py`, not re-run here); a physical door OPEN (S8 owner session); the full backend suite (no product
code changed); the EMROLE exception (not in this candidate).

## REL2210 addendum (2.21.0 assembly, release/2210)

Merging T06 next to WK4ADOPT-295, WKR5ADOPT-295 (with WKR5-295) and PEERQUERY-295 added signing callers and one signed command that the
2.19.0 inventory did not have. The test now pins them on purpose (`test_every_signed_command_in_the_code_has_a_row_and_a_documented_gate`,
`test_the_only_modules_that_reach_a_signing_call_are_the_known_ones`, `test_no_router_reaches_a_writer_or_an_adapter_except_through_the_join`):

| Command | Gate | Arx permission | Scope | Module |
|---|---|---|---|---|
| `features/people_csv_preview` | G-PEOPLE-CSV | `access.people.manage` for the preview and the result read (interactive session); system administrator for the confirm (interactive, typed line count); switch `access.people_csv_preview` (default off) and the owner binding `access.people_csv_binding` | the installation (WisKey permission `people/write`) | `wiskey_people_csv.py` (WKR5ADOPT W-006) |
| `peer_bindings/get` (also) | G-PEER-QUERY | `system.configure` at the installation; switch `wiskey.peer_query` (default off); owner pin `wiskey.peer_pin` | the pinned binding | `wiskey_peer_query.py` (PEERQUERY-295) |
| `peer_bindings/get`, `peer_receipts/resolve` (also) | G-WRITER-INTERNAL | none of its own: the dedicated live reads behind `wiskey.peer_receipt` (default off) + owner pin | the pinned binding / the stored original | `wiskey_peer.py` `peer_read` (WK4ADOPT W-010) |

`wiskey_capture_map.py` only names `port.call(` in its docstring (no call). The lineage admin router `routers/wiskey_lineage.py` (WKR5 unit C) imports
the writer's error class `NativeWriteError` only; its resolve / close / reinitialise go through the installed join. The test stub join takes the
per-command `selected(command)` of WKR5 unit A.
