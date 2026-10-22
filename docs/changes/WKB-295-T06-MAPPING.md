# WKB-295 T06: Arx identity, role, scope and current-policy sources, the admission path, and the job-state mapping

Status: analysis only. Source: `origin/main` 90cd7d9ae (2.12.1). No code was changed for T06.
Paths are relative to `smplwise_vms/backend/smplwise/`. Line numbers are at 90cd7d9ae.

## 0. Summary

1. Arx has a real source for identity, role, scope and the per-station decision.
2. Arx has **no** admission path to WisKey's feature commands. The commands are `hikvision_intercom/features/start`,
   `features/result`, `features/cancel`, `features/prepare_media` and `features/status`. None of those strings appears in Arx code,
   and neither does `operation_ref`.
3. The one feature-execution module (`services/wiskey_feature_exec.py`) builds, judges and stores a request. Only tests call it,
   and its transport refuses every send.
4. Arx's own job states do not have the shape WisKey asks for. The table in section 4 shows where they fit and where they do not.

## 1. Identity: who is acting

| Fact | Source (file:line) | Rule |
|---|---|---|
| The principal object | `rbac.py:113-124` (`Principal`: `user_id`, `username`, `display_name`, `source`, `via`, `factor_ok`) | `source` is ingress, remote, local or dev. Internal callers also build principals with other sources (`automation`, `system` and so on). |
| Ingress identity | `auth.py:114` (`resolve_principal`), headers `auth.py:25-27` (`x-remote-user-id`, `-name`, `-display-name`) | The headers are trusted only when the client address is a configured trusted proxy (the Supervisor). Otherwise the request is refused (`untrusted_origin`). A missing id is refused (`identity_missing`). |
| Remote channel identity | `services/ha_user_auth.py:1514` (`remote_principal`), `:983` (`build_principal`) | Arx session cookie, local session, or an HA bearer token checked against HA core. The identity headers are stripped on this channel. |
| Request dependency | `auth.py:220` (`_principal`), `:254` (`current_principal`) | It refuses the HA service identity as a human (`services/service_identity.py:639`, `refuse_service_principal`) and upserts the `users` row. |
| Stated rule | `docs/security/HA_IDENTITY_RBAC_HE.md` | HA is the only human identity source. Users are keyed by the HA user id. Browser-supplied `user_id`, `is_admin` and `role` are never trusted. The add-on's service token is never a user identity. |
| WisKey connection identity | `services/wiskey_peer.py` `TransportAttestation` / `attest_transport` | This is the HA user the WisKey WebSocket connection authenticated as. **No product code calls it** (test-enforced). |

## 2. Role, scope and current policy

| Fact | Source (file:line) | Rule |
|---|---|---|
| Roles | `roles.json`, loaded in `rbac.py`. Custom roles: migration `0011_custom_roles.sql` | Built-in roles include viewer, operator, editor, site_admin, system_admin, door_opener, door_windows_*, emergency_*. |
| Scopes | `rbac.py:23` `SCOPE_ORDER` (installation, site, building, floor, camera, access_control_station). `rbac.py:29` `STATION_PERMISSIONS` | A station binding can carry only the station permissions. Station placement: migration `0077_access_control_station_scope.sql`. |
| Bindings | tables `users`, `groups`, `group_members`, `bindings` (`0001_init.sql`, rebuilt in `0077`) | Role AND scope are kept together per binding. |
| The permission check | `rbac.py:249` `authorize(conn, principal, permission, target)`. `rbac.py:268` `require`. Chains: `rbac.py:170` `scope_chain`, `:214` `station_chain` | Deny wins. The second factor and inactive users are checked first. The answer is decided from the stored bindings at call time. |
| Per-station authority | `services/intercom_authority.py:138` `Authority`, `:168` `installation`, `:178` `station` | `rbac.authorize` on the station chain. Fails closed. |
| Door rule (stricter) | `services/door_authority.py:122` `check`, `:93` `identity_ok`, `:110` `is_wall_account` | Adds an identity-source check, the wall-account refusal and HA lock decisions. **Feature policy does not use it.** |
| Policy revision | `db.py:628` `permission_revision`, `db.py:632` `bump_permission_revision` | One installation-wide counter. A bump revokes capture leases. **Nothing ties it to a WisKey feature request.** |
| Feature "current policy" | `services/wiskey_feature_exec.py:289` `resolve_policy` (`_held_on_all` `:285`, permission maps `:63` `ARX_PERMISSION_OF`, `:81` `PERMISSIONS_OF_FEATURE`, `:90` `STATION_SCOPED`) | It maps WisKey permission strings to Arx permissions and asks `Authority.station` for every target station (or `installation`). It reads the operator-confirmed relay map (`wiskey_relay_map`). If anything is missing it marks the result incomplete instead of returning a partial result. Callers: **tests only.** |
| Request authority fields | `wiskey_feature_exec.py:175` `build_request`. Columns `authority_ref`, `authority_revision`, `scope_ref`, `parameter_reference` in `wiskey_feature_intents` (migration 0145 line 77) | **Caller-supplied and syntax-checked only.** They are not derived from `permission_revision`, the bindings or `resolve_policy`. The test passes placeholders. `PolicyDocument.as_wire(source_epoch)` also takes a caller-supplied epoch. |

## 3. Admission path

| Step | Arx today |
|---|---|
| HTTP route or worker | **None.** No router or worker imports `wiskey_feature_exec`. |
| Identity + RBAC | `resolve_policy` exists but is not chained to `build_request`. Nothing checks that the request's actor is the principal judged, or that `scope_ref` names the judged targets. |
| Feature registry / switch | `wiskey_feature_registry` (migration 0145 line 66; every feature seeded disabled). `status` (`wiskey_feature_exec.py:397`) reports blockers. **`admit_request` does not consult it.** |
| Durable intent before I/O | `admit_request` (`wiskey_feature_exec.py:327`): INSERT into `wiskey_feature_intents` with state `intent`. A duplicate `request_id` or `operation_id` is refused. |
| Transport | `LiveFeatureTransport.send` (`:364`) always raises `not_built`. The channel allow-lists (`services/wiskey_channels.py:92` `ALLOWLISTS`, `:116` `guard`) contain no `features/*` command, so a frame would be refused (`not_allowed_on_channel`). |
| Reply verifier | **None** for feature replies. `settle_feature` (`:355`) takes the state as a plain argument. |

## 4. The numbered mapping applied to Arx's own job states

WisKey's four rules:

- (R1) admitted, pending and running are not accepted.
- (R2) finished requires an original receipt.
- (R3) cancelled is not no-effect.
- (R4) unknown is not replay.

| # | Arx state machine (definition file:line) | Arx state | WisKey class | Arx today | Verdict |
|---|---|---|---|---|---|
| 1 | `wiskey_feature_intents` (0145 line 91; `wiskey_feature_exec.py:327/350/355`) | `intent` | admitted (local) | Not sent. It can be settled straight to `accepted` without ever being sent (`settle_feature` allows from `intent`). | **Gap (R1).** `intent` must never become accepted or finished without a send and a receipt. |
| 2 | same | `sent` | pending | Open. | OK (R1). |
| 3 | same | `accepted` | **ambiguous** | Terminal. "WisKey accepted the request" and "done" are the same state. There are no `running` or `finished` states. | **Gap (R1/R2).** An admitted/running answer from WisKey must not land in a terminal `accepted`. `finished` needs its own state, set only from a verified original receipt. |
| 4 | same | `refused` | finished-without-effect | Terminal. No verifier exists. | Gap (R2): needs a receipt verifier. |
| 5 | same | `unknown` | unknown | Not resent. `unknown` can later become `accepted` from a plain argument. `settled_at` is set even for `unknown`. | R4 is met (no replay). Gap: leaving `unknown` needs a resolve-by-original contract. |
| 6 | same | (none) | cancelled | No cancelled state and no `features/cancel` vocabulary. | **Gap (R3).** A cancel must not be recorded as no-effect. It needs its own state plus a receipt saying what had happened. |
| 7 | `wiskey_fence_intents` (0145 line 36; `wiskey_intents.py` `mark_sent`, `mark_unknown`, `_terminal`) | `intent` / `sent` / `unknown` | admitted / pending / unknown | Open. `unknown` is settled only through an exact-original receipt or resolve. With WKB-295 T05 an intent without a recorded original stays `unknown_no_original`. | OK (R1, R4). |
| 8 | same | `committed` / `never_committed` | finished (with receipt) | Only from `verify_receipt` (update) or `verify_create_resolution` (create). One terminal fact; a different one is `conflict`. | OK (R2). The receipt wire shape is still a proposal. |
| 9 | `intercom_write_ops` (0121 line 16; `services/intercom_write_journal.py:55` admit, `:94` finish, `:146` readback). The live person-write journal | `intent` / `dispatched` | admitted / pending | Blocks further writes for the person. | OK (R1). |
| 10 | same | `ok` / `refused` / `not_sent` | finished | Set from the WebSocket reply of the native command. That is not an original receipt: settled by a fresh readback (`reconciled`). | Partial (R2). Local admission, not a shared receipt (R11-I4-03). |
| 11 | same | `unknown` -> `reconciled` | unknown | Never resent. A fresh readback after the hold time is required. | OK (R4). |
| 12 | Door emergency per-door results (0137 line 154; `services/door_emergency.py:583` `_retryable`, `:592` `_settle`, `:645` `age_pending`) | `pending` / `sent` / `acknowledged` / `refused` / `unknown` / `skipped` | pending / finished / unknown | **`unknown` is RESENT**: at most 3 attempts 10 s apart with the same request id, in the safe direction and for an emergency OPEN apply (owner-approved E-1). | **Conflicts with R4** if this path is moved onto WisKey `features/*`. The engine is not built (`door_windows_engine.py` `WiskeyEmergencyEngine` answers `not_implemented`). Needs a joint decision before wiring. |
| 13 | Door-window occurrences (`services/door_windows.py:743` `OCC_STATES`, `:746` `TERMINAL`) | `cancelled` (terminal) | cancelled | Terminal for the occurrence. It does not claim that the door was not driven. Relock evidence is only `ProgramState.idle`. | Must not be read as no-effect (R3). The live engine is not built. |
| 14 | Door automation fires (0133 line 46; `services/door_automation.py:104` `LiveSender`) | `pending` / `sent` / `refused` / `unknown` / `not_sent` | pending / finished / unknown | Never retried. The live sender always answers `not_sent`. | OK (R4). No receipt (R2). |
| 15 | Card capture session (`services/intercom_client.py` `capture_cancel`, about line 490) | cancel answer `{cancelled: true}` | cancelled | Already documented in code as "not proof the reader left collection mode". | Matches R3. |
| 16 | Capture lease (`services/capture_lease.py`, migration `0099_capture_leases.sql`) | `issued` / `active` / `revoked` / `expired` / `destroyed` | lease, not a job | Permit is False. | The only lease concept in Arx. It is not tied to any feature job (see 5.3). |

## 5. What is missing (for WisKey's result/cancel binding and the admission)

1. **No `operation_ref`** and no start/result/cancel/prepare_media/status vocabulary. Arx has `request_id`, `operation_id` and a
   random `operation_binding_ref` (`build_request`). Definition needed from WisKey: is `operation_ref` WisKey-assigned (returned by
   `start`) or Arx-assigned?
2. **No binding of result/cancel to the same user, connection and lease.** `wiskey_feature_intents` has no `query_owner_ref`,
   `peer_binding_ref`, connection ref or `issued_epoch`, unlike `wiskey_fence_intents`. `TransportAttestation` is never called.
   Definition needed from WisKey: what "the same lease" is for features. Arx's only lease is the card capture lease.
3. **`authority_revision` / `scope_ref` are not derived.** They should come from `db.permission_revision` (or a per-feature authority
   revision) and from the targets `resolve_policy` judged. A permission bump should invalidate open intents, as it does for capture
   leases.
4. **Policy and request are disconnected.** The actor must be the principal judged. The targets must match the params
   (`station_id`, `relay`, `mapping_revision`). The door rule's `identity_ok` and wall-account checks are not applied.
5. **The registry gate is not enforced** at admission (`enabled`, `host_registered`).
6. **No reply verifier and no running/finished/cancelled states** (rows 1, 3, 4, 6). Expiry of `request_expires_at` /
   `execution_expires_at` is not enforced.
7. **`features/status` must not be used as capability proof.** Arx does not use it today. Capabilities come from
   `overview.api.commands` negotiation (`wiskey_channels`), and that stays the rule.
8. **The door emergency retry** (row 12) conflicts with R4 if that path is moved onto WisKey features. It needs a joint decision.

## 6. Questions for WisKey (definition needed)

1. The wire contract of `features/start|result|cancel|prepare_media|status`: fields, `operation_ref` origin, and the receipt that
   proves `finished`.
2. What binds `result` and `cancel`: the HA user (which one, the dedicated principal?), the connection, and which lease.
3. How a `cancel` reports partial effect, so Arx can record "cancelled after effect" distinctly.
4. Whether Arx's `authority_revision` must equal a WisKey-visible policy revision, and whether WisKey re-checks it at `start`.
