# CAPMAP-295: card-capture lease, receiver and DTO9 mapping (Arx side) and what is still needed from Mac

Branch `pilot/CAPMAP-295`, based on `release/2190` @ `9e060f312`. Board item W-005 (aliases r350, r305, r030, Q04, A19, R12).
Status: the Arx-side mapping layer is implemented behind a disabled build flag and tested against fakes only. Nothing is installed,
nothing is live, and the capture-lease go-live permit stays OFF.

## 1. Scope correction

"Capture" in this item means **card capture**: a door station's reader collecting one presented card for the person editor (CR-005,
capture lease CR-WISKEY-LEASE-REVOCATION-EVENT). It is not a camera snapshot. Arx has no intercom snapshot path, and this item does not
create one.

## 2. What Arx has today (release/2190)

| Layer | Arx symbol | Notes |
|---|---|---|
| Classic capture (production path) | `services/intercom_capture.py` `CaptureRegistry` (register, hold_unknown, poller) | WS `cards/capture_*` on the feed's capture lane. No lease. Unchanged. |
| Lease ledger and triggers | `services/capture_lease.py` (migrations 0099/0100) | `access.capture_lease` defaults to `off`; `GO_LIVE_PERMITTED = False`; `MIN_BRIDGE_FOR_CAPTURE_LEASE = None`, so the route cannot be switched on. |
| Signed stream, worker | `services/lease_events.py` (`sign`, `TRANSPORT`, `EVENT_ACTIONS`, `REQUEST_ACTIONS`) | DTO v3 inner text, no `kid`, at most 8192 bytes, lifetime of 15 s or less. |
| Lease route | `services/capture_lease_route.py`, `routers/access_control.py` card capture section | Uses the closed answer schemas in `docs/contracts/wiskey-capture-lease/`, enforced by `services/lease_answers.py`. |
| Direct transport (WKCAP / WKCAPWIRE) | `services/wiskey_capture_direct.py` `DirectLeaseTransport` | Sends `capture/lease_event` or `capture/lease_request` with exactly `{signed_message_json}`. |
| Selection | `services/wiskey_direct_join.py` `SelectingLeaseTransport` | Direct path only when `auto`, the key signs and the socket authenticates. |
| **Receiver / registrar / DTO9** | `custom_components/smplwise_bridge/lease_service.py` (`lease_event` / `lease_request`, `async_register_consumer`, `LeaseCapability`, `LeaseRegistration`) and `lease_contract.py` (`validate` -> **`LeaseDTO`**) | **DTO9 exists under the name `LeaseDTO`.** `LeaseDTO.as_json()` has exactly the nine keys of the vectors' `original_dto9`. |
| Vectors | `tests/fixtures/wiskey_vectors/wiskey_capture_two_layer_vectors_v1.json`, `tests/test_wkcapwire_295.py` | 8 synthetic vectors, 7 actions, public test key only. |

The appendix of the earlier reply (`NOT_IDENTIFIED ... no DTO9 symbol in the code`) is wrong: the symbol is `LeaseDTO`. The sources
the vectors were made from (`trusted_caller.py`, `ha_bridge.py`, bridge `lease_contract.py`, `keyset.py`) are byte-identical in
release/2190 to the hashes recorded in the vectors file, and a test checks this.

Emergency gating: `lease_revoke` reason `emergency` exists in the closed enum, but nothing in Arx calls
`capture_lease.on_authority_change("emergency", ...)`. A door emergency (hold-open or release, `services/door_emergency.py`) does not
revoke live capture leases today. This is an Arx gap and needs an owner decision. Because the route cannot be switched on, it has no
effect in this build. It was not wired here, because doing so would touch the emergency path on a release candidate.

## 3. What this branch adds

`smplwise_vms/backend/smplwise/services/wiskey_capture_map.py`:

- `MAPPING_ENABLED = False`: a build constant, not a setting. A test refuses `True` while any row lacks Mac's symbol and hash.
- `MAP`: the closed table, one row per action (7 rows). Each row records: action, kind, direct command, bridge service,
  receiver symbol (`lease_contract.py:LeaseDTO`), Arx answer classifier, and `mac_symbol` / `mac_sha256`. The last two are `None`
  (PENDING_MAC) until Mac sends its table.
- `project_dto9(text, kind)`: the DTO9 the receiver will build from that exact text. It is computed locally without a key, so it is
  a projection and never a verification. Tests prove it equals both the vectors' `original_dto9` and the real bridge
  `validate(...).as_json()` for all 8 vectors.
- `MappedLeaseTransport`: a pre-flight in front of the existing `DirectLeaseTransport`, with no new engine and no new wire.
  - It raises `CaptureUnsupported` (`capture_receiver_unsupported`, HTTP 503, `outcome=not_sent`, `state=unsupported`) when the
    mapping is disabled, the peer's announced command list is unknown, or the list lacks the command.
  - It raises `CaptureProjectionError` (`capture_dto9_unmappable`, HTTP 400, `not_sent`) when the text cannot become DTO9.
  - Otherwise it sends the same text once and returns the host's answer unchanged. It never builds a success.
- `state()` reports `disabled` / `unsupported` / `mapped_unverified` / `mapped`, plus `mac_mapping = PENDING_MAC`,
  `installation = NOT_PERFORMED` and `live = NOT_MEASURED`.
- `routers/access_control._NOT_SENT_CODES` gains the two codes, so the routes read these refusals as "nothing was sent".

Not wired: `wiskey_direct_join.startup` still installs the plain `DirectLeaseTransport`. A test checks this.

## 4. What is still needed from Mac (blocking the flag flip)

1. **The mapping table** (W-005 Mac_action), one row per action for all 7 actions: Mac symbol -> Arx symbol -> payload/schema -> file
   sha256. It must cover the outer handler (`capture_native_api` handler for `capture/lease_event` / `capture/lease_request`), the
   composition and source binding (`NativeCaptureBridgeSource.bind_registration` / `owns_dto` / `project_dto`), and the consumer
   (`CaptureLeaseHost.handle` / `event` / `_request`). These names were seen in the delivered source; Arx has not confirmed them. The
   table fills `MapRow.mac_symbol` / `mac_sha256`.
2. **The announcement source for the direct path**: which reply carries the command list Arx should check before sending (the direct
   connect capabilities `commands[].name`, or `overview.api.commands`), and whether `api_contract: null` on the two capture commands
   (simulator profile) is final.
3. **The DTO9 + protocol projection**: confirm that `project_dto` returns exactly `{"protocol": ..., **LeaseDTO.as_json()}` with no
   other field. Arx's projection deliberately stops at the 9 keys.
4. **Outer adapter refusal codes**: confirm the full closed list the outer adapter can send before calling the bridge (`invalid_fields`,
   `capture_source_unavailable`, `Unauthorized`, `capture_outcome_unknown`), and which of them guarantee that nothing was called. Arx
   maps only `capture_source_unavailable` and `wiskey_direct_not_connected` to `not_sent`. Every other refusal is `refused` (502), and
   anything unclear is `unknown` (504).
5. **Join / CAS / person revision / actor fields** named in W-005 (`start/status/confirm/cancel/revoke/heartbeat/reset with actor,
   person revision, CAS and join`): confirm they are all inside the existing closed `lease` object and params (the `lease.schema.json`
   keys), with no new wire field. If anything else is expected, name it, because the v1 wire is closed.

## 5. Arx follow-ups (not done here)

- Review Mac's table, fill `MAP`, then wire `MappedLeaseTransport` around the direct transport inside `SelectingLeaseTransport`, with
  the announcement reader from item 4.2.
- Owner decision on revoking live leases on a door emergency (`emergency` reason has no caller).
- Go-live stays a separate owner session (`GO_LIVE_PERMITTED`, `MIN_BRIDGE_FOR_CAPTURE_LEASE`), after a supervised run and a full gate.

## 6. Tests

`smplwise_vms/backend/tests/test_capmap_295.py` (65 cases) uses fakes, the public test key and the real bridge modules loaded without
Home Assistant. No real WisKey, station, reader, door, Home Assistant or runner was used.
