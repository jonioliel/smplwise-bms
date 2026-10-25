# WK4ADOPT-295 - Arx adoption of the WisKey reply-4 deliverables (Windows review of the Mac delivery, 2026-10-25)

Source of the review (read from the private WisKey clone without touching its working tree):
`origin/codex/wiskey-windows-mac-reply4-review-2026-10-25` @ `09b5343c905dc0d0529193d187e0f087ad3ee1ca`,
`docs/owner-development-2026-10-25/windows-mac-reply4-review/`. WisKey product CODE named there: `924df3e9366c262c165fddf31d04dad5e9cb4ede`.
Base of this branch: `origin/release/2200` @ `00c7ae463930c23b009c2361a70866a17767fc53`.

Everything below is implemented and tested on FAKES only. Installation: NOT_PERFORMED. Live: NOT_MEASURED. No equipment, door,
microphone, speaker or capture action, no WhatsApp, no auto-mode change and no replay of an UNKNOWN outcome was made by this work.

## W-001 - `reply4-wkf01f02.patch` (sha256 `df1d604b8a15a73ea790f46fe557e8f75388cb49319ab6213accc37643f31f35`)

Target named by the patch: `pilot/WKF01F02-295` @ `9eca5e92441a40eff8b197b58a43ae6a543afc8b`. The three service files on
release/2200 were byte-identical to that base (before-hashes of `PATCH_TARGET.json` matched), so the patch applied without drift and
reproduced the three after-hashes exactly:

| file | after-hash (patch) | kept as is |
|---|---|---|
| `services/wiskey_media_bridge.py` | `7c8181d6...a842c` | yes, byte-identical |
| `services/intercom_media.py` | `f2ce57ab...45bc3` | the heartbeat hunk moved to the W-002 commit (taken together with the W-002 wiring) |
| `services/wiskey_listen_adapter.py` | `c87fcd07...df43a` | NO - one identified merge, below |

Adopted as reviewed: the terminal `VideoChannel.closed` fence before registry cleanup, `_get` checks before and after `connect` and
closes a late link, `_register_lease` refuses a closed owner under `_LEASE_LOCK`, `LoopThread.stop` is terminal and keeps its handles
when the join is not decided, `_LEASED` stays the only stream registry, `_LEASE_TIMERS` holds cleanup handles of every owner
generation (retired ones too) until joined, `close_leased_streams` returns False while a generation is alive and keeps quarantine and
ownership on a failed DELETE. The old WKF01F02 delta was not re-applied.

Identified merge (R04, `wiskey_listen_adapter.py`): the patch drained the frame queue in `_Downlink._end`, i.e. on EVERY end. On the
combined tree that broke four existing tests of `tests/test_wkaudin_295.py` (WKAUDIN-295 is an ancestor of 9eca; the Mac delivery did
not run the combined tree): frames admitted while current were dropped on a natural upstream end. The drain is now in a separate
`_fence(reason)` used by every close (`_Downlink.close`, `_join_downlink`) - a close still stops publication synchronously, drains the
queue, cancels and joins the producer and the close hook (a cancelled caller still waits) - while the producer's own `_end` keeps the
frames already admitted. `frames()` stops on the sentinel or on the fence.

Tests: `tests/test_wk4adopt_295.py` (W-001 section) plus the existing WKLIVE / WKF01F02 / WKAUDIN / router / app suites (see the
report for the exact runs and exit codes).

## W-002 - native lifetime (revision 2) and the floor heartbeat, together

- `WiskeyBridgeTalkChannel.open` sets `heartbeat_s = inf` (the reply-4 hunk, exactly): no periodic `talk_floor` while a talk is open;
  genuine floor, frames and close are unchanged. Taken together with WisKey's `retain_execution` lifetime (CODE `924df3e9`); there is
  no wire field naming contract revision 2, so the pairing is by WisKey CODE. Against an older WisKey a muted talk ends with
  `idle_timeout` after 12 s - no authority is extended either way.
- Arx's separate 30 s idle timer of a muted session (`frontend/src/wiskey/talk-session.ts`, owner decision 25.10) is re-armed only by
  a verified, current packet: exactly one 800-byte PCMU packet on the open session's socket (the server publishes a packet only after
  WisKey's event, sequence, age, session and permission checks). Empty / odd binary is neither played nor activity. Native silence
  still ends the talk at 12 s; nothing in Arx keeps it alive.
- Standalone listen stays `downlink_pending` (`WiskeyDownlinkChannel`, unchanged).
- Revision-2 states covered on fakes: mute (floor released, downlink goes on), signed expiry, shared slot / `audio_busy` for a second
  caller (409 `intercom_talk_busy`, no eviction), idle.
- WR4-01 (P1, static source finding in WisKey `BridgeTalkSession.run`): the request to Mac is
  `private/planning/wiskey_inbox_2026-10-24/wr4-01-request-to-mac.md` (owner channel, not committed). Arx consumer tests: with the
  requested terminal event, idle and signed expiry close the original channel and the resource with no late audio, no renewal, no
  replay; with today's behaviour the event is lost and only Arx's own session deadline ends the channel (one `talk_close`). W-002's
  terminal-lifecycle acceptance stays OPEN until Mac returns.

## W-005 - the five mapping artifacts and seven actions (card capture at a door-station reader)

Reviewed: `W005_CAPTURE_MAP.json` (seven actions, chain, preflight, projection, actor/CAS/join, flags) and
`W005_CAPTURE_REFUSALS.json` (closed native tables, dispatch knowledge, outer alphabet gap), with their schema / answer-code
identities. The Arx files Mac mapped against (`lease_service.py` `3872e87c...`, `lease_contract.py` `16b2e9eb...`,
`wiskey_capture_direct.py` `7b6a62ae...`) are byte-identical on this branch (test-pinned).

Adopted in `services/wiskey_capture_map.py` (CAPMAP, `MAPPING_ENABLED` stays False, no transport selection change):
- `MAC_TABLE` / `MapRow.mac_symbol, mac_file, mac_sha256, params_keys`: four request actions -> `capture/lease_request`
  (`NativeCaptureComposition.start/status/confirm`, `ExperimentalLeaseHost.step`), three events -> `capture/lease_event`
  (`CaptureLeaseHost.event`); `confirmed()` is now True (a source-mapping fact; `state()` says `mac_mapping: REVIEWED`, still
  `disabled`, `NOT_PERFORMED`, `NOT_MEASURED`).
- The projection refuses (local pre-flight, `not_sent`) params whose keys differ from Mac's closed set and a `capture_start` whose
  `binding_revision` is not null (unsupported on the native path; refused, not adopted). No new wire field.
- `announced_commands(direct_capabilities, overview_api)`: the current direct connection's `capabilities.commands` first, the authorized
  `overview.api.commands` second; `api_contract: null` is ignored (not a support verdict); unreadable = `capabilities_unknown`.
- `provenance(outcome)`: keeps the phase of every outcome (local pre-flight, transport not_sent, remote rejected / refused,
  sent_unknown, unknown). Only the local pre-flight or a transport refusal before any byte proves "not sent"; `Unauthorized` /
  `invalid_fields` / any code alone never does; `replay_permitted` is always False.
- The closed inner tables in `lease_answers.py` equal Mac's `CAPTURE_ANSWER_CODES` refused / session-unchanged sets (test-pinned).
  There is no outer enum; an unlisted / malformed / missing answer stays UNKNOWN.
- Already true and unchanged: `wiskey_capture_direct.NOT_SENT_CODES` treats `capture_source_unavailable` as not sent - Mac's dispatch
  knowledge confirms it proves no call by THIS invocation only.
- Not done here (separate 2.21.0 conditions): emergency revoke, card-capture go-live, `capture_lease.GO_LIVE_PERMITTED`.

## W-010 - dedicated LiveRegistryTransport and LiveResolveTransport

Contract: `W010_PEER_QUERY_V1.json` (WisKey `peer_server` / `peer_client` / `direct_dispatch`, CODE 924df3e9). The WisKey-side portable
transports log in to HA with a user token; Arx's owner of the verified connection is the direct join
(`services/wiskey_direct_join.py`: `DirectCommandSession` + `DirectCapturePort`, one authenticated `direct/connect` socket, every reply's
MAC + connection_ref + id verified before `result` is read). WisKey's `direct_dispatch` accepts the four peer commands on that socket
with `wiskey-peer-query.v1` and binds them to the server-issued subject `arx-service:<entry>`.

Built (fakes only):
- `wiskey_peer_registry.LiveRegistryTransport(port)` - `peer_bindings/get {peer_binding_ref, peer_binding_revision}`; `attestation()`
  from the connection's own identity; without a port it still refuses `not_built` (no frame).
- `wiskey_intents.LiveResolveTransport(port)` - `peer_receipts/resolve` with exactly `wiskey_peer.resolve_parameters` (current read
  binding + full original); `read()` never raises; `resolve_intent()` settles through `settle_resolution`.
- `wiskey_peer.peer_read` / `PeerReadReceipt` (result | refused | not_sent | unknown) and `attest_port`.
- `wiskey_peer.is_query_owner_id`: the query owner may be an HA user id OR the direct subject `arx-service:[A-Za-z0-9_.-]{1,96}`
  (OwnerPin, attestation, minting and the binding row). Still: the owner pin must match, the attestation comes from the transport only.
- `DirectJoin.registry_transport` / `.resolve_transport` are built by `startup` on the join's port. Their clients stay behind the
  existing gates (`wiskey.peer_receipt` switch off by default, owner pin `wiskey.peer_pin`); nothing calls them on a schedule.

Receipts (tests): found -> committed once; `unknown` result, a verified refusal, a disconnect, a timeout, a malformed row -> UNKNOWN,
never never_committed, the intent is never sendable again (no replay), each read is sent once. Vectors stay W-008.
Missing on WisKey's side: nothing for the direct path per the contract; whether the owner pins a binding whose `query_owner_id` is the
direct subject is an owner/WisKey bootstrap step (`peer_bindings/get {initialize: true, expected_revision: 0}` is NOT called by Arx).

## W-013 - the numbered `template_send_v2` contract and the installer read point

Contract: `W013_TEMPLATE_SEND_V2.json` items 1-9 (CODE 924df3e9; WisKey `whatsapp_template_api_v2.send_v2`). TPLWIRE-295 had stopped
because no command existed; this is that wiring against the original source.
- `wa_template_send.TemplateRequestV2` + `wire_problem_v2`: the closed ten keys and WisKey's `descriptor_v2` bounds. No parameters,
  phone, PIN or body; the `{{i}}` order is WisKey's private `ApprovedTextTemplate.parameter_fields`.
- `TemplateRef.wiskey_ref / wiskey_revision` (stored as `template_ref` / `template_revision`, both or neither).
- `TemplateSender.send_v2`: switch + permit, reference with the WisKey pair, the shared budget, the window, then ONE call of
  `DirectTemplateTransport.send_v2` (signed `wiskey-bridge-command.v1` on the direct join's verified connection) read by `read_v2` only.
  `accepted` = provider acceptance (delivery unknown); a v1 result, an error frame, a disconnect -> UNKNOWN, never not_sent, never resent.
- Installer read point (WisKey-side, documented constants only): `__init__.async_setup -> setup_native_template_installation(hass,
  config[DOMAIN]["native_whatsapp_templates_v1"])`. Arx writes no configuration and activates no installer.
- `TEMPLATE_SEND_SUPPORTED` stays False: production refuses `template_unsupported` before any hand-over (test). The fake-sender tests
  open the permit inside the test only. No WhatsApp message was sent. TP-02 (no consent gate) unchanged.

## WR6-01 (Windows review of 002eec7b9) - the receipt of a resolve read belongs to that read

LiveResolveTransport.read returned self.receipts[-1] when resolve_parameters refused locally after an earlier read had appended a receipt (a stale receipt; the verdict was already UNKNOWN). The call now returns its own receipt (_once); a local refusal before any frame returns None and appends nothing. Test: test_wr6_01_a_local_refusal_after_a_successful_read_returns_no_receipt_and_sends_nothing (fails on the old code, passes on the fix).
