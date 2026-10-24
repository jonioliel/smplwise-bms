# WKINT-295 - the combined WisKey integration candidate for Arx 2.17.0

Branch `integ/WK-2170`, cut from `origin/release/2160B` @ `9645d4c2f` (the 2.16.0 candidate; release/2160B itself was not touched).
Everything below runs against fakes only. Nothing was run against a real WisKey, Home Assistant, station, go2rtc or installation;
nothing is installed or live; no setting, switch or capability was flipped.

## 1. Merge order (all `git merge --no-ff`)

| # | branch | head | result |
|---|---|---|---|
| 1 | `pilot/WKB3-295` | `b01cb9691` | clean |
| 2 | `pilot/WKDIRECT-295` (contains `pilot/W10CLIENT-295` `093a50fc9`) | `9135a048c` | 1 conflict (below) |
| 3 | `pilot/WKWRITE-295` | `66eec12c2` | clean (auto-merged `backup.py`, `connection_store.py`, `config.yaml`, reviewed) |
| 4 | `pilot/WKCAP-295` | `4a68d92ce` | clean |
| 5 | `pilot/PRESUNAVAIL-295` | `5d3c40db3` | clean (auto-merged `presence.py`, `test_presence.py`, `mobile-presence-contract.md`, reviewed) |
| 6 | `pilot/DROPDOWNFIT-295` | `833fc840e` | clean (cut from release/2160B already) |
| 7 | `pilot/PRESUNAVAIL2-295` | `74d70e502` | clean (one commit on top of #5; merged delta equals the branch delta line for line) |

Not merged (a later step): OFFLINE110B, ATTEST232B and the other 2.17.0 pilots. No migration was added (none of these branches adds
one; 0172 / 0176 belong to other pilots).

### Conflict and resolution
- `smplwise_vms/backend/smplwise/routers/settings.py`, `INT_KEYS`: release/2160B added `history.range_max_days` and
  `history.presence_retention_days`; WKDIRECT added `access.station_media_max_talk_s`. Resolution: the release/2160B tuple with
  `access.station_media_max_talk_s` inserted after `media.max_live_sessions` (WKDIRECT's position). Nothing else of either side changed.

### Nothing from release/2160B lost
- Every file in `git diff origin/release/2160B..HEAD` belongs to one of the merged branches or to the join commit.
- For each branch file not touched by release/2160B since `16bc3926b`, HEAD equals the branch's blob (the one deletion,
  `tests/test_wiskey_media_provider.py`, is WKDIRECT's own S6 deletion).
- For each file touched by both (`frontend/src/api/media.ts`, `backup.py`, `connection_store.py`, `config.yaml`, `presence.py`,
  `test_presence.py`, `mobile-presence-contract.md`, the DROPDOWNFIT files), the +/- lines of `release/2160B..HEAD` equal the branch's own
  +/- lines; for `settings.py` they differ only by the resolved `INT_KEYS` line above.
- The symbols WKDIRECT removed (`media_post`, `_media_hook`, `wiskey_channels.MEDIA`, `WiskeyProvider`, `SyncTransport`,
  `WiskeyTalkChannel`) have no caller left in release/2160B's code.

## 2. The join (`smplwise/services/wiskey_direct_join.py`)

- `DirectCommandSession`: ONE authenticated direct socket (`DirectApiTransport.connect("command")`: hello, signed `direct/connect`,
  server-issued `arx-service:<entry>` subject) on the private loop of WKDIRECT's `LoopThread`. Reopened only between requests; a
  request never moves to another connection; nothing is retried. After a failed connect the next attempt waits 60 s (as AutoTransport).
- `DirectLink.call_command` / `signed_body` (added to `wiskey_media_bridge.py`, the existing `call` untouched): any public command,
  WITHOUT the `hikvision_intercom/` prefix, in `wiskey-peer-query.v1` for `PEER_QUERY_COMMANDS` and `wiskey-bridge-command.v1` otherwise,
  signed by the existing recipe (`ha_bridge.sign`), query_owner_id = the server-issued subject. The reply's MAC + connection_ref are
  verified by the link's reader before anything reads it, the id here; then `verify_command_result`. Outcomes:
  - `not_sent` - only when no byte of the frame was handed to the socket (closed link, full queue, unsignable or oversize body, socket
    not opened / not authenticated for this request);
  - `refused` - only a verified error frame for this id (WisKey's code as sent; an out-of-alphabet code becomes `provider_error`);
  - `unknown` - everything else (send failure once the write began, timeout, connection lost, MAC failure, malformed frame, cancel).
- `DirectCommandPort` implements `WiskeyCommandPort` (async `send_signed`): from another loop it schedules on the session loop with
  `run_coroutine_threadsafe` and awaits through a shielded `asyncio.wrap_future` - the caller's loop is never blocked and a caller's
  timeout never cancels a request mid-write. Errors are `WiskeyCommandError(code, outcome)`.
- `DirectCapturePort` implements `WiskeyDirectPort` (sync): `identity()` from the live link, `call()` blocks only its calling thread,
  `media_ingress_header()` = the signed `features/media_ingress_v1` body with exactly {ticket, preparation_ref, connection_ref = this
  command connection's challenge}, `open_media()` opens `/api/hikvision_intercom/arx_bridge/v1/media/{ticket}` with the header (no token,
  no query string; not exercised against a real WisKey). Called on the session loop itself it refuses `not_sent` (`wrong_thread`).
- Native people writes: `DirectJoin.native_write` runs `NativePeopleWriter` on the session loop with a per-write `_RecordingPort` (keeps
  only the ACK's inner `result` for the route's projection), after one `recover(scope)` per process.

## 3. Selection rule and installation

`wiskey_direct_join.startup` (called from `main.py` after the WisKey feed starts) installs the join ONLY when:
1. the installation chose `access.station_media_provider = auto` (default `local`; this is the switch AutoTransport already lives behind), and
2. the pairing key signs (present, readable, not rotated).

Otherwise it installs NOTHING: no lineage file, no anchor row, no transport object, no thread. When installed: one lineage per
process (`open_lineage(data_dir, SettingsAnchor(db_path))`), `recover(scope)` in a background thread once the socket authenticates
(else before the first native write), `lease_events.TRANSPORT = SelectingLeaseTransport` and
`wa_template_send.TRANSPORT_PROVIDER = join.template_or_none`. At each use the rule is re-evaluated: (1) and (2) and (3) the direct socket
is (or now becomes) authenticated. When it does not hold, the existing path runs: `BridgeLeaseTransport`, `UnwiredTransport` (template
sends stay refused before any hand-over), and the Home Assistant feed for people writes. `shutdown` restores the existing transports.

Decision recorded: the brief named the rule "direct when the key signs and the socket authenticates". The join also requires (1), the
`auto` switch AutoTransport is already behind, so that deploying this build on an installation that is paired but on `local` changes
nothing (owner rule: no `auto` flips, nothing activated). This is stricter, never looser.

People-write routes: `routers/access_control.py` (`person_create`, `person_update`, `person_delete`) and
`routers/access_control_writes.py` (`_write`: archive, unarchive, set_active, temporary_cancel, cards add/remove, photo) call
`people_send(...)`. Without an installed join it returns the existing send untouched (no extra read, no audit key, byte-identical);
with the direct path selected it returns the native send, whose outcomes map onto `intercom_sync`: committed -> the ACK's result
(projected as before; `users/delete` -> `{accepted: true}`), not_sent -> the new `intercom_sync.NotSent` (only this send raises it),
pre-effect refusal -> `IntercomError(code)`, unknown -> `UnclearAnswer(code)` (the R3-06 readback gate then applies; never re-sent).
The Arx decision is a fresh `arx_decision(access.people.manage)` over the stations the existing gate covered (the installation when the
gate took the unrestricted shortcut); the actor is the operator with `session_active = interactive(principal)`. A create's origin is
`arx-create:<client_request_id>`. The audit row gains `transport: wiskey_direct` only on the direct path.
`services/access_grant_engine.py`: the grant engine acts as `system:access_grants`, which the native contract (human actor, active
interactive session) cannot carry; while the direct path is selected it refuses `not_sent native_human_actor_required`, nothing sent
(it is in any case behind `access_grants.GO_LIVE_PERMITTED = False`).

## 4. What stays default / unchanged
- No setting default changed except the one WKDIRECT added (`access.station_media_max_talk_s` = 300, new key). `access.station_media`
  `off`, `access.station_media_provider` `local`, `access.capture_lease` `off`, `capture_lease.GO_LIVE_PERMITTED` False,
  `MIN_BRIDGE_FOR_CAPTURE_LEASE` None, `TEMPLATE_SEND_SUPPORTED` False, `access_grants.GO_LIVE_PERMITTED` False,
  `door_emergency.DW09_OPEN_RETRY_AFTER_UNKNOWN` False - all untouched. PRESUNAVAIL's `UNAVAILABLE_SATISFIES_REQUIRED = True` is that
  branch's owner decision (new); PRESUNAVAIL2's `hardware_required` defaults to `[]`.
- No unsigned W10 path is selectable: WKDIRECT's S6 removal stands, `provider_for(auto)` requires a signing key, the join signs every
  command and refuses a rotated key.
- Behaviour changes that come from the merged branches themselves: WKWRITE's `backup_exclude: ["wiskey_lineage/*"]` in `config.yaml`.

## 5. Tests (receipts: `private/planning/wk_round4_receipts/wkint/<sha>/`)

Python: `.venv\Scripts\python.exe -m pytest -p no:cacheprovider -rA -q --junitxml=...` from `smplwise_vms/backend`, `PYTHONPATH=.`,
single worker. Every stderr file is empty.

On `ab7c045d8ff85f679d0d8f0ecc0c513c5542cd8a` (merges 1-6 + the join commit):

| group | files | tests | fail | skip | exit |
|---|---|---|---|---|---|
| join | test_wkjoin_295 (new) | 23 | 0 | 0 | 0 |
| wkdirect | test_wkdirect_295, test_wiskey_media_v11, test_wiskey_channels, test_wiskey_contract, test_intercom_media | 237 | 0 | 2 | 0 |
| wkwrite | test_wkwrite_295, test_wkwrite_295_crash | 35 | 0 | 0 | 0 |
| wkcap | test_wkcap_295 | 42 | 0 | 0 | 0 |
| wkb3 | test_wkb3_295, test_eccact_readback_295, test_stationperm_295, test_wkpeer_295, test_wa_template_send_w11, test_wa_pacing_coverage_295 | 353 | 0 | 0 | 0 |
| presence | test_presence, test_mobile_options, test_mobile_push | 36 | 0 | 0 | 0 |
| release | test_migrations, test_migrations_263_upgrade, test_ui_settings, test_docs_config_consistency, test_release_check, test_version | 31 | 0 | 0 | 0 |
| touched neighbours | test_intercom_writes_s11, test_intercom_people_s7, test_access_grants, test_access_control_wire, test_capture_lease_{events,ledger,local_actor,review_fixes,triggers}, test_lease_wire_closed_295, test_door_emergency, test_fake_wiskey, test_fake_wiskey_whatsapp, test_remote_mic_policy | 459 | 0 | 4 | 0 |
| frontend | `tsc --noEmit`; unit-dropdown-fit + unit-wkdirect-talk-max (node 24.21.0) | 6 | 0 | 0 | 0 / 0 |

On `c6f564810cda905c7c69728101ff6c7f02d27303` (+ PRESUNAVAIL2): join 23/0/0 exit 0; presence 38/0/0 exit 0; release 31/0/0 exit 0;
frontend tsc exit 0, units 6 passed exit 0. The other groups were not re-run there (the PRESUNAVAIL2 merge touches none of their files).

Skips (pre-existing, not caused here): 2 in test_wiskey_channels (channel commands newer than the pinned catalog); 4 in
test_lease_wire_closed_295 (jsonschema not installed).

`test_wkjoin_295.py` proves over the fake direct server (tests/w10_fake_direct.py extended with an independent envelope check): a signed
round trip on both ports (from a foreign loop for the async one), the peer-query envelope for the four peer reads, the media ingress
header (fields + HMAC + connection_ref), not_sent / refused / unknown mapping (no socket, back-off, verified error, dropped answer, closed
socket, bad MAC, unsignable float), no retry and no carry-over of a doubtful request to a new socket, a native create committed over
the direct socket with the raw PIN absent from the lineage export, a lost ACK staying UNKNOWN and not resent, the route-level outcome
mapping of `people_send`, and that without `auto` + a signing key (none, empty, rotated) nothing is installed (no lineage file, no
anchor row, transports unchanged).

NOT_RUN: the full suite, the runner gate, Playwright layout/visual specs, a route-level HTTP test of a people write with the join
installed (the router seam is tested through `people_send`; the routes themselves are covered on the non-direct path by
test_intercom_writes_s11 / test_intercom_people_s7), `open_media` against a real socket, anything against a real WisKey.

## 6. Remaining dependencies (exact)
- A run of the join against WisKey's real direct server or its simulator (`direct/capabilities`, nonce window size).
- The grant engine needs a human-actor source (or a WisKey contract for a service actor) before it can write natively.
- No production constructor of `DirectFeatureClient` / `DirectEmergencyEngine` / `TemplateSender` exists yet; they can be built on
  `JOIN.capture_port` / pick up `TRANSPORT_PROVIDER` when a caller is added.
- Admin screen for `close_unknown` / `reinitialise` (WKWRITE's list) is not built.
