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
