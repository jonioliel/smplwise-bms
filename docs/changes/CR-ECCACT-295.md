# CR-ECCACT-295 - the Arx half of the WisKey ECC activation (owner decision 2026-10-21, option A)

Branch `pilot/ECCACT-295` (base `origin/main` v2.10.0 `bd4636e7f`, plus `pilot/WKV2-295` and `pilot/DOORWIN-295` merged). Migrations are
final at integ/2111: door windows = 0137 (it was 0136 on this branch), this change = 0145 (built as provisional 0137).

## Decision and what it does and does not mean

The owner decided (chat, 2026-10-21, option A) to remove the historical blockers for everything WisKey developed: "all eight switches
OFF", `GO_LIVE_PERMITTED = False`, `WAITING_OWNER_APPROVAL`, fakes-only. The directive was relayed by the WisKey team (directive repository,
branch `codex/wiskey-ecc-activation-directive-2026-10-21`, pinned commit `c741079eb8eb22e8c311319ff54358957ad64de5`, SHA256SUMS verified).

* Removing a **permit** is a code change in this branch and is reported as such. It is not an activation.
* **Activation** is a runtime fact: the installation switch is `on`, the WisKey host registered the adapter and answered, the transport
  exists, and the effect was observed. Nothing in this branch claims that a switch was turned on in an installation, and no installation
  switch is changed by the code (all remain `off` by default).
* Arx RBAC / scope stays the sole authority; signature and identity verification, revisions, deadlines and the UNKNOWN / duplicate
  fences are unchanged. A service identity is never the actor and never contributes a permission.

## Permits changed (code constants)

| constant | before | now | note |
|---|---|---|---|
| `access_grants.GO_LIVE_PERMITTED` | False | True | external grants, station permissions, the live engine; `access.external_grants` stays off |
| `bulk_people.GO_LIVE_PERMITTED` | False | True | `access.bulk_people` stays off |
| `capture_lease.GO_LIVE_PERMITTED` | False | **False** | reverted: Fable review 2 NO-GO (no bridge lease_event, MIN_BRIDGE None, WisKey consumer unverified, separate card permit) |
| `access_cards.CAPTURE_PERMITTED` | False | **False** | not a permit: `access_cards.capture()` only refuses; the grant -> capture lease -> confirm flow is not built in Arx (open implementation task) |
| `wiskey_acr5.GO_LIVE_PERMITTED` | False | True | the four `wiskey.acr5_*` switches stay off |
| `wiskey_peer.GO_LIVE_PERMITTED` | False | True | `wiskey.peer_receipt` stays off |
| `wiskey_peer_registry.GO_LIVE_PERMITTED` | False | True | the live registry read is not built (`not_built`) |
| `door_windows_engine.GO_LIVE_PERMITTED` | False | True | `door_windows.enabled` stays off; no rule exists |
| `door_automation.GO_LIVE_PERMITTED` | False | **False** | only on top of DOORHARD-295 (A-01 corroboration); that branch has uncommitted work only |
| `bridge_rotation.GO_LIVE_PERMITTED` | False | **False** | only on top of HMACACT-295 (H-01); that branch has uncommitted work only |
| `wiskey_peer.SIGNED_CAPTURE_COVERED`, `WISKEY_HALF_REVIEWED` | False | **False** | no transport, no joint review: `signed_capture_covered()` stays False |
| `service_identity.EXTENDED_GO_LIVE_PERMITTED` | False | **False** | an Arx HA-identity feature (not WisKey); needs the security amendment and a Fable re-review |
| `door_path_guard.ALLOWED_SELECTABLE`, `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED` | False | **False** | not permits: the implementation (D10a / W11 template send) does not exist in Arx |

## What was built

1. **Strict v2 consumer** (`wiskey_access_state`, `wiskey_acr5`, `access_grant_engine`): v1 never proves a revocation (WKV2B, owner
   decision 2026-10-20); capability negotiation (`negotiate`: command listed AND capability advertised; v2 preferred; v1 compatibility
   read only); a live, negotiated reader (`wiskey_readback.LiveReadback`) on a new `readback` channel (three reads, no write), wired into
   `access_grants.engine_for`; the schema of the command that was sent is pinned in the parse (no silent v2 -> v1); revisions are JSON-safe
   (1..2^53-1) on the consumer and the peer seam.
2. **Durable intents and the exact-original create resolution** (`wiskey_intents`, migration 0145): one immutable intent per people write
   written before the frame leaves; one terminal fact; one central transition per person revision; a created person's id is recorded only
   from a verified exact-original answer (`verify_create_resolution`, PROPOSED protocol `wiskey-create-resolution-draft1`); no replay.
   SUPERSEDED (PERSONWRITES-CLEANUP-295): the proposal `person_writes/resolve_create` was never shipped by WisKey and its verifier
   (`verify_create_resolution`, `settle_create`, `CreateExpectation`, `ExactOriginal.as_request`) was removed; a create intent now settles
   only through `settle_resolution` (peer_receipts/resolve). The table and migration 0145 are unchanged.
3. **Feature execution, Arx half** (`wiskey_feature_exec`, migration 0145): the strict `wiskey-arx-feature-execution.v1` request builder for the six
   adapters (compared field by field with the Mac source), the CURRENT POLICY from Arx RBAC (station chain, deny wins, creator AND approver for
   automations) plus the explicit relay map, the durable no-replay attempt, and an honest `status` that never says active from a switch.
4. **Permits** as above, tests re-framed (the shipped constant is True; tests that pin the permit-off behaviour patch it).

## Open, per side (not closed by this branch)

* Transport / route / envelope / service identity of the verified bridge (no HA admin, no new HA user): JOINT PIN with the Mac. Until then
  the live v2 readback and every feature request stay technically blocked (`LiveFeatureTransport`, `LiveResolveTransport`,
  `LiveRegistryTransport` refuse `not_built`; the `readback` channel gets WisKey `unauthorized` or `unknown_command`).
* `hikvision_intercom/peer_bindings/get`: accepted name, implemented on neither side.
* Per-station revoke row for a past station (Mac): a missing row stays UNKNOWN; a clean v2 answer with empty bookkeeping stays UNKNOWN.
* Relay map content per ECC station (operator/owner confirmation); host registration of the six adapters; capacity (32 MiB active).
