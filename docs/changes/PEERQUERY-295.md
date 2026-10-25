# PEERQUERY-295: peer_query `peer_bindings/get` behind the existing RegistryTransport

Status: implemented on `pilot/PEERQUERY-295`, tested with fakes only. Default OFF. Not installed, not run against WisKey, Home
Assistant or a station. No route, no UI, no migration.

## What it does

`services/wiskey_peer_query.py` wires the peer_query read `peer_bindings/get` behind the existing
`wiskey_peer_registry.RegistryTransport` (`peer_binding_get(ref, revision)`):

- `DirectRegistryTransport` sends the read over the existing direct link (`wiskey_direct_join.DirectCapturePort.call`). The link
  already signs the closed `wiskey-peer-query.v1` body for every command in `wiskey_command_port.PEER_QUERY_COMMANDS` and verifies the
  reply's MAC, `connection_ref` and id before the result is read. It hands the result over as `wiskey_peer_registry.VerifiedResult`
  and classifies failures as `wiskey_peer_registry.TransportFailure` (`not_sent`, `refused`, `timeout`, `transport_error`).
- `RegistryClient` is unchanged in its rules: the owner check runs before any request, the draft1 row is parsed strictly, revocation,
  rotation (never followed) and historical read apply as before.
- `peer_query(conn, principal, command, parameters, *, port, timeout_s, request_id)` is the one entry point. It never raises for a
  refusal and writes exactly one audit row (`action = wiskey.peer_query`, `resource_type = wiskey_peer_binding`). The row keeps codes
  and flags only: no binding reference, service subject or repository id.

## Gates, in order

| Step | Refusal code |
|---|---|
| Setting `wiskey.peer_query` (`off` / `on`; unset, or any other value, reads `off`) | `peer_query_disabled` |
| `system.configure` at the installation (system administrators only; a local identity also needs its second factor) | `forbidden` (detail = the rbac reason) |
| Command is `peer_bindings/get` | `not_implemented` (other peer_query commands) / `unknown_command` |
| Parameters: `None` (the owner-pinned binding) or exactly `{peer_binding_ref, peer_binding_revision}` | `invalid_parameters`; the `initialize` form is `not_implemented` |
| Owner pin `wiskey.peer_pin` present; a requested binding is the pinned one (same ref, revision not newer) | `not_pinned` (nothing sent) |
| Direct join installed and selected now; its identity attests | `not_connected` / `owner_mismatch` |
| Registry verdict | `ok`, `owner_mismatch`, `binding_mismatch`, `revoked`, `rotation_pending`, `historical_read_denied`, `malformed`, `refused`, `timeout`, `transport_error`, `not_sent` |

Read-only: the only request this module can send is the lookup form of `peer_bindings/get`. Nothing is retried, re-sent, cached or
followed.

## Contract basis (no new wire field)

- Command, parameters and envelope: the round-4 command catalogue Arx already adopted
  (`tests/fixtures/wiskey_round4/people_command_catalog.json`: `peer_bindings/get`, `original_peer_read_transport`,
  `wiskey-peer-query.v1`), and the existing `PEER_QUERY_COMMANDS` / `envelope_kind` of the direct join.
- Result row: the draft1 row of `wiskey_peer_registry.ROW_KEYS`, which WisKey's registry returns unchanged (WisKey source
  `NativePeerRegistry.lookup`, "Exact Arx draft1 public row").
- Query owner: over the direct API the query owner is the server-issued service subject `arx-service:<entry>`, and WisKey binds the read
  binding to that subject. `wiskey_peer.is_query_owner_id` now accepts that subject (printable ASCII without space, at most 128
  characters) next to the 32-hex HA user id. `attest_transport`, `_mint_peer`, `OwnerPin` and `parse_binding` use it. This widens
  which values are valid. It adds no field.
- An unknown binding: WisKey answers the same verified error as a denied one (`binding_denied`). Arx reports `refused` with detail
  `binding_denied` and does not claim to know which of the two it is.

## NOT_IMPLEMENTED (refusal `not_implemented`, detail = what)

- `peer_bindings/history`: WisKey's source has it, but it is not in the adopted catalogue and Mac has not published a result contract.
- `peer_protocol/get`: same reason.
- `peer_receipts/resolve`: owned by the receipt read (`wiskey_peer.py`, `wiskey_native_write.py`), not routed through here.
- `peer_bindings/get` with `{initialize: true, expected_revision: 0}`: it provisions a binding on the WisKey side, so it is not a read.

## Open dependencies on Mac (W-010)

1. Confirm from source that the registry/resolve peer_query is delivered, with command names, envelope and found/unknown semantics
   (file + symbol + hash), so the old board rows can close.
2. Say whether an unknown binding and a denied binding stay one code (`binding_denied`), or get a distinct, verified "not found".
3. Publish a result contract for `peer_bindings/history` and `peer_protocol/get` if Arx should read them.
4. Confirm that the direct service subject (`arx-service:<entry>`) is the query owner of a peer read on the direct API, and that the
   registry row's `query_owner_id` is exactly that subject.

## Owner-side items (not built here)

- No writer for `wiskey.peer_query` or `wiskey.peer_pin`. Both are owner settings, like the existing pin. `wiskey_switches` still
  refuses them.
- No route or screen calls `peer_query` yet.

## Tests

`smplwise_vms/backend/tests/test_peerquery_295.py` (fakes only): switch off (default), permission denied (no binding, site
administrator, operator, local identity without its second factor, no principal), success (pinned binding, historical receipt), unknown
peer (unpinned ref or newer revision with nothing sent, no pin, WisKey `binding_denied`), owner mismatch before any request,
transport error, not connected, timeout (three shapes), the NOT_IMPLEMENTED commands, the initialize form, parameter strictness, one
audit row per call. `tests/test_wkpeer_295.py` now lets `wiskey_peer_query.py` call `attest_transport`, because it is the transport
boundary.
