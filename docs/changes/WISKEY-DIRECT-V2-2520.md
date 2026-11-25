# WISKEY-DIRECT-V2-2520 - row R7: direct transport v2 with kid, `direct/pairing_status_v2`

Branch `pilot/WISKEY-R7-2520`, cut from `origin/pilot/WISKEY-RESYNC-2520` (`a7eb3159a`, plan + slice R1). Target version: 2.52.
Spec: `docs/changes/WISKEY-RESYNC-2520.md` section 4.1 (row R7), lead decisions PAIRING-Q2 = a and B2-ABI = a.
Status: implemented and unit-tested against in-memory fakes only. Nothing installed, no lab, no Home Assistant, no WisKey contact.

## 1. Inputs (read only)

- WisKey PRODUCT `3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d` (rc19) = hand-off commit `8c6b10208e3f...` for every file below (no diff):
  `direct_bridge_api.py`, `trusted_actions/direct_bridge_origin.py`, `trusted_actions/existing_bridge_auth.py`, `bridge_command_auth.py`
  (`admit`, `bridge_kind`), `direct_bridge_discovery.py`, `tests/ha/test_m15_direct_v2.py` (read, not run).
- Contracts `docs/contracts/full-management-v1/`: `direct-hello.v2`, `direct-connect-request.v2`, `direct-connect-reply.v2`,
  `direct-identity.v2`, `direct--pairing_status_v2.{request,result,error,signed-request.v2,signed-reply.v2}`, `definitions.json`
  (`PairingStatus`, `SafeError`).
- Examples copied unchanged to `smplwise_vms/backend/tests/fixtures/wiskey_rc19/direct-v2/` (git blob prefixes at PRODUCT):
  hello valid `0e697a74` / wrong `fa2ddd27` / extra `32814e4b` / missing `ad0a74d8`; identity valid `f8eff475` / wrong `ea1f9a97` /
  extra `f4ee73bb` / missing `a905bcbd`; connect-request valid `00cd0577`; connect-reply valid `a9f14b55`; pairing_status result valid
  `70b964f5` / wrong `e9a1e7bf` / extra `14cd0089` / missing `bd6d28b8`; signed-request.v2 valid `c54832c3`; signed-reply.v2 valid `6e07b069`.

## 2. What WisKey rc19 expects (source facts)

- v2 socket: `GET /api/hikvision_intercom/arx_bridge/v2/ws`; hello `wiskey-direct-ws.v2`; connect body kind `wiskey-direct-connect.v2`
  plus `kid`; every later command kind `wiskey-bridge-command.v2` (`wiskey-peer-query.v2` for peer reads) - a proof with a kid must name
  v2 (`bridge_kind`). v1 refuses a kid (`bridge_protocol_unsupported`) and, after a rotation, refuses the legacy key.
- WisKey does NOT verify a kid message itself: `existing_bridge_auth.verify` imports `custom_components.smplwise_bridge.native_keyset`
  (`verify(hass, message)`, `Unavailable`, `legacy_allowed`) and the v2 reply is signed by that binding (`row.key_binding.sign_reply(
  canonical({connection_ref, frame, kid}))`). `smplwise_bridge` is the ARX bridge. **Arx's bridge 0.10.8 has no `native_keyset.py`**;
  the file exists only in WisKey's Mac-assembled "M15 arx-after candidate" (`HISTORICAL_ARX_BINDING.json`: 5610 bytes, sha256
  `ad9f3221...`), never delivered to Arx and not in the WisKey repository. Consequence: against today's bridge a v2 connect fails
  closed on WisKey's side (no fallback). See open question 1.
- Discovery on v2: `direct/capabilities_v3` (schema_version 3, protocol v2 on every command, `transport_authentication {version 2, kid,
  rotation_source "smplwise_bridge.KeySet", fallback_after_key_refusal false}`, optional `native_installation`, `manual_service_write`),
  `direct/time`, `direct/pairing_status_v2` (`verified true`, `direction arx_to_native`, protocol, kid, source keyset/legacy entry,
  `freshness_s 60`). The signed-reply.v2 contract pins `bridge_schema: wiskey-bridge-command.v1`.
- Today Arx's rotation is blocked while WisKey is installed (`bridge_rotation`: `wiskey_present`), so the Arx key stays the pairing
  secret / `g0-legacy` and every connection stays v1: **R7 is dormant on an installation with WisKey until that block is lifted.**

## 3. What changed

| file | change |
|---|---|
| `services/wiskey_media_bridge.py` | `protocol_for_key(key)` (2 only for a rotated KeySet key); `signed_kind`; `BridgeSigner(protocol_version=2)` signs with the existing KeySet v2 recipe (`bridge_keys.sign_with`, 32-hex nonce, kid on the wire) and v2 kinds; `sign_connect / reply_mac / open_reply / read_identity(..., version=2)`; v2 identity must carry exactly the signing kid (`direct_kid_mismatch`), a UUID repository_id and a contract-shaped subject; `DirectApiTransport(opener_v2=)` chooses the protocol from the key BEFORE any socket (a rotated key without `opener_v2` keeps `bridge_key_rotated` - the media path, pairing probe, auto-install and media caps are unchanged); `last_attempt_version`; PAIRING-Q2 subject pin (`pairing_ambiguous`); `DirectLink` v2: `protocol_version`, `kid`, B2-ABI cap `0 < timeout <= 58 s` (`timeout_exceeds_abi`, not_sent), `bridge_key_changed` (key set moved under the connection: never signed on it again, link closed); `AutoTransport` never falls back to Home Assistant after a v2 attempt. v1 behaviour and v1 `last_identity` shape unchanged. |
| `services/wiskey_direct_discovery.py` | `read_capabilities(..., protocol_version=2, kid=)` for the v3 document (`transport_auth_mismatch`, `lifecycle_unsupported`, closed v3 blocks as observations); `PairingStatus`, `read_pairing_status` (closed `PairingStatus` schema), `binding_refusal` (`pairing_mismatch` unless protocol, kid and source are exactly the connection's); `DirectDiscovery.refresh(..., protocol_version, kid)` reads capabilities_v3 + time + pairing_status_v2 on v2; pairing used for its `freshness_s` only (`pairing_stale`, re-read). |
| `services/wiskey_direct_join.py` | discovery passes the link's protocol/kid; a rotated key installs the join only with a v2 socket; v2 connect refusals carry `direct_v2_refused:<code>`; `V2_NO_FALLBACK` + prefix in `fallback_permitted` (no classic people write after a v2 key / pairing refusal); `direct_status(key)` (no I/O). |
| `services/wiskey_direct_catalog.py` | `WISKEY_OWNER_ONLY` (`service_grants/read_v3 / preview_v3 / commit_v3 / revoke_v3`) refused `owner_action_in_wiskey` before any byte - no self-grant, no revoke over the wire; `DIRECT_READS_V2` documented (catalog counts unchanged). |
| `routers/bridge_key.py`, `wire/bridge_key.py`, `frontend/src/api/generated/wire-bridge-key.ts` | `GET /system/bridge-key` carries optional `direct_transport` {protocol_version, kid, selection, installed, connected, pairing, pairing_state verified/mismatch/unknown, refusal, revoke_in "wiskey_owner_screen"}. Same gate (system.configure + system admin, audited 403), no new route, no I/O, never material. No UI change (no compare page). |
| tests | `tests/test_wiskey_direct_v2_2520.py` (new) with an in-file v2 fake; fixtures above. |

Public interface for R5 / R8 (kept small, documented in the module notes): `protocol_for_key`, `DirectApiTransport(opener_v2=)`,
`DirectLink.protocol_version / .kid / .call_command` (unchanged outcome contract), `MAX_CALL_TIMEOUT_S`,
`DirectDiscovery.pairing` / `Capabilities.manual_service_write_v3`, `wiskey_direct_catalog.WISKEY_OWNER_ONLY / DIRECT_READS_V2`,
`wiskey_direct_join.direct_status`.

Invariants kept: no unsigned path, no fallback after a v2 refusal (v1 or Home Assistant), nothing retried or replayed (fresh nonce per
frame, no API to send a pre-signed body), UNKNOWN stays unknown, `unknown` pairing state never shown as verified, no permission change,
no new route, no self-grant, no revoke or deletion of a pairing on the wire.

## 4. Tests (real results)

| command | where | exit | result |
|---|---|---|---|
| `python -m pytest tests/test_wiskey_direct_v2_2520.py` (repo venv) | PC | 0 | 39 passed |
| `python scripts/gen_wire_types.py --check` | PC | 0 | generated files match |
| `python scripts/wire_ratchet.py` | PC | 0 | 897 unmodelled = baseline |
| `py -3.12 -m ruff check` on the 6 changed modules + the new test file | PC | 0 findings in them | the 19 findings reported for `tests/test_wk4adopt_295.py` (F401 / F811 fixture imports) are identical at the base |
| `python -m pytest tests/<file>`, ONE file per process, repo venv, on the final bytes (`185a9aa8a`; the files that reach the bridge-key routes were re-run after its router fix): every test file that imports or scans a changed module, the bridge-key routes or the wire generator (73 files besides the new one) | PC | 0 for 72 files | all passed. Counts: `test_wkdirect_295` 53, `test_wkr5_295` 31, `test_wkjoin_295` 23, `test_bridge_key_rotation_295` 45, `test_bridge_key_activation_295` 30, `test_bridge_keyrot_harness_295` 34, `test_bridge_keyrot_harness_doors_295` 1, `test_wiskey_pairing_2382` 32, `test_wire_routers_b/c/d/e` 66/58/170/95, `test_wire_consumption_2450` 13, `test_wire_calendar_2470` 3, `test_wxh_leftovers_2405` 23, `test_wxh4_emergency_revoke_2407` 22, `test_remote_access` 66, `test_wiskey_join_live_2382` 38, `test_wiskey_mac_adopt_298` 45, `test_wiskey_mac_adopt_298_review` 40, `test_wiskey_adopt_2272_review` 38 (+3 skipped), `_contrib` 39, `_features` 38, `_install` 39 (+2 skipped), `_installer` 6 (+3 skipped), `test_wkr5_295_writer` 11, `test_wkr5_295_bdg` 10, `test_wkcapwire_295` 37, `test_wk4adopt_295` 44, `test_peerquery_295` 47, `test_adoptr6_295` 25, `test_capmap_295` 65, `test_t06_admission_295` 63 (+3 xfailed), `test_wiskey_contract` 53, `test_bridge_stale_discovery_2383` 32, `test_asgi_wiskey_295` 28, `test_authrevoke_2435` 11, `test_intercom_media` 35, `test_wiskey_media_v11` 67, `test_wkvec_295` 141, `test_wiskey_managed_install_2382` 73, `test_wiskey_live_validation_2390` 58, and 31 further files (alignment, camera discovery, error envelope, externalbuild, janitor, owner30 doors, query plans, station media readiness, video transport, w031, m12 policy/maintenance, r2/r3/rc4/rc7, relay map, s4/s5, talk caps, wa queue, wkaudin, wkf01f02, install answers, owner26 callers, intercom shared, mac managed policy) - all exit 0. |
| `python -m pytest tests/test_wiskey_rc10_pin.py` | PC | 1 | 94 passed, 1 skipped, **3 failed** - `test_every_channel_command_is_an_rc10_command...[relay_inventory / station_sync_v1 / system_status]`: the three channels R1 registered in `services/wiskey_channels.py` (not touched here); belongs to R1 (open question 6) |
| runner (slot B) | - | - | **NOT_RUN**: queued for ~40 min behind the 2.51 release gate and nine other jobs, then withdrawn (my job only); the PC runs above replaced it |
| full backend suite, frontend `tsc`, Playwright | - | - | **NOT_RUN** (not in this row; the train gate runs them) |
| real WisKey / bridge / lab | - | - | **NOT_RUN** by rule. The v2 reply recipe and the whole v2 path are unverified against WisKey; WisKey's own v2 test needs a bridge `native_keyset` Arx does not ship. |

Rollback: revert the commit; no migration, setting or data.

## 5. Open questions (owner; WisKey via the owner)

1. The bridge module WisKey v2 needs (`smplwise_bridge.native_keyset`: `verify(hass, message)` -> binding with `check()` /
   `sign_reply(bytes)`, `Unavailable`, `legacy_allowed`, `attach`). a) a new Arx bridge row (bridge 0.10.9) implementing it with the
   reply recipe fixed here, installed only with the one owner-approved HA restart (recommended) b) ask WisKey for the Mac candidate
   file (sha256 `ad9f3221...`) and review/adopt it c) leave v2 dormant.
2. The v2 reply MAC is Arx-defined here: HMAC-SHA256(material, "wiskey-direct-reply.v2." + canonical({connection_ref, frame, kid})).
   a) keep it and tell WisKey it is the recipe the bridge binding implements (recommended) b) adopt whatever the Mac candidate used, if (1b).
3. `direct-identity.v2` requires `repository_id` as a UUID; WisKey's source can return null when no peer registry exists. a) follow
   the contract: null refuses the v2 connection (recommended, fail closed) b) accept null as unknown.
4. Media (video / talk) over v2: `intercom_media.py` is not in R7's files, so station media with a rotated key stays refused
   (`bridge_key_rotated`) as today. a) one-line opt-in (`opener_v2`) in a later row after (1) (recommended) b) leave media on v1 only.
5. Rotation stays blocked while WisKey is installed, so v2 is dormant there. a) keep the block until (1) is installed and tested
   (recommended) b) lift it now.
6. `tests/test_wiskey_rc10_pin.py` fails for R1's three new channels (they are not rc.10 commands). a) R1 marks them unpinned /
   rc19-only in that test (recommended; R1 owns the registry) b) R7 touches it (not done: not R7's file).

Files outside the plan's R7 list, touched by necessity: `tests/test_wk4adopt_295.py` (the byte pin of `wiskey_media_bridge.py`
follows R7's bytes; the Mac contribution's original hash is kept in a comment) and the new fixtures folder
`tests/fixtures/wiskey_rc19/direct-v2/` (beside R1's files, like R6's `external-visits-v1/`).
