# Deep review 2.52 - area WISKEY-BRIDGE

Reviewed head: `origin/release/2520-train` at `eadaa25b81c0e65c86d8aa6ff5f108816bcc7c2d`.
WisKey contracts read (read only, never modified): PRODUCT rc20 `dcebb9f34c8f95638e498115a2aeb5ce2711981e`; hand-off
`57e4615e0b943638b7e6cdcd4565c183e559483e`, `docs/owner-development-2026-11-25/mac-arx-adoption`.
Method: code read end to end on the paths named below; one read-only probe script (dependency-free bridge modules loaded from the
worktree, no Home Assistant, no network) for WB-02. No pytest, no lab, no device, no WisKey contact. Nothing in product code changed.

**Coverage is partial - read section 4 before relying on this report.** The area is about 4 MB of Python. The planned parallel
sub-reviewers could not be started (the session's sub-agent limit was already used by the other areas), so one reviewer read the
security-critical core in depth and the rest only at outline level or not at all. Section 4 says which is which.

## 1. Summary

| id | severity | title | file:line |
|---|---|---|---|
| WB-01 | high (latent: v2 only) | A direct v2 refusal at connect / discovery time silently re-routes people writes to the classic channel | `services/wiskey_direct_join.py:309-331, 571-579, 883-885`; `routers/access_control_people.py:141-146`; `services/access_service_writer.py:295-313` |
| WB-02 | high | A re-pair is undone, and the old rotated key keeps verifying (also on WisKey v2), on a bridge whose first rotation was saved before the pairing tag existed (Arx 2.11.0 - 2.14.0) | `custom_components/smplwise_bridge/keyset.py:119-125, 402-408`; `__init__.py:425`; `native_keyset.py:168-172` |
| WB-03 | medium | One failed discovery read disables the direct path for the whole life of the socket (nothing closes or re-reads it) | `services/wiskey_direct_discovery.py:353-354, 374-384`; `services/wiskey_direct_join.py:144-151, 333-344` |
| WB-04 | low | v2 admission writes the bridge key store up to once per second and per key under steady traffic | `custom_components/smplwise_bridge/native_keyset.py:235-244` |
| WB-05 | low | `GET /system/bridge-key/service-grant` sends a signed WisKey read on every call, under a process-wide lock | `routers/bridge_key.py:153-160`; `services/wiskey_service_grants_v3.py:259-263` |
| WB-06 | low | `Persister.control` rollback also discards unrelated unsaved state and can answer "ok" for a step it rolled back | `custom_components/smplwise_bridge/keyset.py:436-446, 150-156` |
| WB-07 | low | The re-pair fence of 25.11 covers WisKey's v2 path only; the bridge's own signed services still accept the old pairing until the reload runs | `custom_components/smplwise_bridge/__init__.py:434-439, 704-719` |

Counts: critical 0, high 2, medium 1, low 4. All CONFIRMED by reading the path end to end (WB-02 also by execution); none PLAUSIBLE.

## 2. Findings

### WB-01 (high, latent while every connection is v1) - a v2 refusal demotes the selection, and the write goes classic

Rule under review (change notes WISKEY-DIRECT-V2-2520 section 3 and WISKEY-R8-2520; WisKey R2 `transports.selection`: "never downgrade
or switch transport automatically after refusal or UNKNOWN"; `transport_authentication.fallback_after_key_refusal: false`): after a v2
key / pairing refusal no people write may go over the classic Home Assistant channel.

What the code does:

- `people_send` (`wiskey_direct_join.py:883-885`) first asks `join.selected(command)` and returns `None` when it is false.
- `selected` -> `DirectCommandSession.connect_ready` (`:309-331`) opens the socket and runs discovery itself, and turns **every** failure
  into `False` (`except Exception: return False`, and `transport_refusal(command) is None`). That includes the v2 refusals `link()`
  produced a line earlier with the final prefix (`direct_v2_refused:<code>`, `:154-163`) and the discovery refusals `pairing_mismatch`,
  `pairing_unverified`, `pairing_status_invalid`, `transport_auth_mismatch`, `direct_kid_mismatch`, `pairing_ambiguous`.
- The router reads `None` as "not selected" and sends the route's own Home Assistant write
  (`routers/access_control_people.py:144-146`: `return fallback`), recording `transport=classic` and
  `transport_reason = people_path(command)["reason"]`, which is `wiskey_direct_not_connected` - the v2 refusal code is not even in the
  audit row.
- `fallback_permitted` / `V2_NO_FALLBACK` / `V2_REFUSED_PREFIX` (`:847-859`) are only consulted inside `send`, i.e. only when the link
  was already selected and the refusal arrives later inside `native_write`. The far more likely place for a key or pairing refusal -
  the connect and the discovery of a new connection - never reaches them.
- Same root for the grant engine: `access_service_writer.select_path` (`:295-313`) answers `service_channel / direct_not_selected`,
  and for the capture lease: `SelectingLeaseTransport._pick` (`wiskey_direct_join.py:530-531`) picks the bridge transport.
- After the first refusal the session backs off for 60 s (`_down_until`), so every write in that minute takes the classic path
  without any direct attempt at all.

Failure scenario: an installation with a rotated key (v2), WisKey rc19+ and bridge 0.10.9. The owner revokes / re-pairs in WisKey, or
two bridge entries hold the kid, so WisKey refuses the v2 connect (or answers `pairing_mismatch`). An operator saves a person. Expected:
the write fails visibly with the v2 code and nothing is sent. Actual: the same request is sent on the classic channel under the add-on's
Home Assistant identity and succeeds; the audit says "classic, not connected".

Why "latent": rotation is still refused while WisKey is installed (`bridge_rotation.wiskey_present`), so a v2 connection exists only
where the key was rotated before WisKey arrived, or once that block is lifted (R7 open question 5). It must be fixed before the block
is lifted. v1 / rc10 behaviour is not affected and must stay as it is (on v1 "not selected -> existing path" is the designed rule).

Suggested fix: make the decision in one place. In `people_send` (and `select_path`, `SelectingLeaseTransport._pick`), when the join
is installed and configured but not selected, look at why: if the transport's `last_attempt_version == 2` (or the key's
`protocol_for_key` is 2) and the reason is anything but "unreachable / not yet tried", return a `send` that raises
`NotSent(<the prefixed v2 code>)` instead of `None`. Simplest rule that is also the strictest: **with a v2 key there is no classic
people write at all while the join is installed** - not selected means refused. Record `session.last_error` in the audit row. Add a
test that drives `connect()` to a v2 refusal with the link initially closed (today's tests start from a connected link).

### WB-02 (high) - a re-pair on a bridge with a pre-tag retired key set is wiped; the old key stays valid

`KeySet.__init__` recognises a new pairing code in the entry (K-02) only when the stored state carries the one-way tag of the retired
code (`keyset.py:119-123`: `... and self.legacy_fp is not None and ...`). The tag is written only at the moment the pairing secret is
retired (`_drop`, `:176-183`), and only since KEYROT-FIX-295 (`1213e264b`, first released in v2.15.0). Releases v2.11.0 - v2.14.0
shipped the key set with rotation live (`GO_LIVE_PERMITTED = True`, default mode on) and no tag (verified with
`git tag --contains` / `git show <tag>:.../keyset.py`). A bridge that completed its first rotation on one of those releases holds
`legacy_retired: true` with no `legacy_fp`, forever - nothing backfills it.

On such a bridge a re-pair (Supervisor discovery or the owner writing the regenerated code into the entry) goes like this:

1. entry updated with the new code -> the listener reloads the entry (correct);
2. the new setup builds `KeySet(new_code, state)`: no tag -> not `repaired` -> `legacy_retired` stays true -> the new code is ignored,
   the old rotated keys stay the key set;
3. `saver.clean_entry()` at setup (`__init__.py:425`, `keyset.py:402-408`) sees "saved state retired + entry holds a code" and
   **blanks the new pairing code**;
4. `native_keyset._same_pairing` (`:168-172`) now sees `legacy is None` and a blank code -> "same pairing" -> every kid of the old key
   set verifies again, for the bridge's own services and for WisKey's v2 socket.

Probe (read only, the worktree's `keyset.py` + `native_keyset.py` with fakes): state
`{signing: g1-…, keys: {g1-…}, legacy_retired: true}` without `legacy_fp`, entry code = a new value ->
`repaired False`, `clean_entry()` returned True and the entry code became `''`, `_same_pairing` False before the wipe and **True after
it**, and `native_keyset.verify` admitted a message signed with the old `g1` key.

Consequences: (a) security - the re-pair is the documented cure for a suspected key leak (keyset.py module note; the emergency
revocation WXH4 ends in a re-pair), and here it leaves the suspect key accepted by the bridge and by WisKey v2; this is exactly the
WisKey acceptance scenario of 25.11 (`test_old_key_cannot_open_new_v2_socket_during_repair`) surviving past the reload; (b)
availability - the add-on signs with the new code, the bridge verifies only the old set: every push and service call fails until the
integration is deleted and added again (only `async_remove_entry` clears the store); the owner sees a pairing that "does not take".

Affected population: only installations that rotated between v2.11.0 and v2.14.0 and never re-created the bridge entry since. Small,
but the lab is a candidate (rotation was live there before the WisKey block of 2.38.3).

Suggested fix (bridge, small): in `KeySet.__init__` treat "retired, no tag, the entry holds a non-empty code that is not a key of the
set" as a re-pair too. The HA-06 window the old behaviour protected (a restart between the key save and the entry blank) cannot still
be open for a state that old - every setup since has run `clean_entry()`. Add the case to `test_bridge_native_keyset_2520.py` (third
acceptance test: tag-less state) and tell WisKey the new module hash with the next hand-off. Until fixed: check the lab's key store for
`legacy_retired` without `legacy_fp` before any re-pair there (read only).

### WB-03 (medium) - a single failed discovery read latches the direct path off until the socket happens to drop

`DirectDiscovery._fail` (`wiskey_direct_discovery.py:381-384`) records `failed_ref = connection_ref`; `refresh` returns at once for
that ref (`:353-354`), `discovery_due()` answers False for it (`wiskey_direct_join.py:340-341`), and `transport_refusal` then answers
`last_error` for every command. Nothing closes the link: `DirectCommandSession.link()` keeps returning the same open socket
(`:149-151`), the websocket keep-alive keeps it open, and the runtime manager (`wiskey_join_live`) restarts the join only when the
provider or the key changes.

The failure does not have to be a refusal: a 6 s timeout (`DISCOVERY_TIMEOUT_S`) of `direct/time` - re-read every 600 s - or, on v2,
of `direct/pairing_status_v2` - re-read every 60 s - or a first discovery that runs while WisKey is still loading after a Home
Assistant restart, is enough (`except bridge.MediaBridgeError -> _fail`, `:376-377`).

Outcome: from that moment until the socket drops for another reason (possibly days), `selected(command)` is False for everything:
people writes go classic (v1; see WB-01 for v2), the native features are `transport_not_selected` - including the emergency engine and
the door automation sender, which both require `selected("features/start")` - and the status screens show "connected" with a refusal
code. Fail closed, but self-inflicted and not self-healing.

Suggested fix: treat a discovery failure of outcome `unknown` / a transport error as "this connection is not usable": close the link
(the next request reconnects after the existing 60 s back-off) instead of keeping an open socket that will never be asked again. Keep
the latch only for a deterministic document refusal (`capabilities_invalid`, `lifecycle_unsupported`, ...), and even there re-try on a
slow timer (e.g. the 600 s time re-check). Nothing is replayed by this: discovery reads are reads.

### WB-04 (low) - one key-store write per second of v2 traffic

`native_keyset.verify` awaits `Persister.persist()` whenever the message's second is above the saved mark (`:238-244`); Home
Assistant's `Store.async_save` writes the file at once. With a v2 connection that carries periodic traffic (pairing re-read, event
cursor, media) that is up to one atomic file write per second and per kid on the Home Assistant disk (often flash). The rule itself
(saved mark before admission) is WisKey's requirement and stays.

Suggestion: save the mark **ahead** - persist `ts + N` (N around 10 s) and admit without a write while `ts <=` the saved mark.
`saved_through(kid, ts)` stays true for WisKey's regression, the cross-restart guarantee is unchanged (a restart takes longer than N),
writes drop to one per N seconds. The only cost: the first N seconds after an entry reload refuse (the boot mark is ahead) - choose N
with that in mind and say so in the change note.

### WB-05 (low) - the service-grant GET is an unthrottled signed read

`get_service_grant` calls `v3.SOURCE.refresh()` on every request (`routers/bridge_key.py:153-160`); `refresh` holds the source's
`threading.Lock` across the network call (up to 6 s + 5 s margin; `wiskey_service_grants_v3.py:259-263`). A page that polls, or two
administrators, serialise behind each other, each call sends a signed frame (and on v2 costs a key-store write, WB-04), and a write
that needs `current_grant()` waits behind them. Suggestion: answer the fresh observation (`_fresh`, 60 s) unless the request asks for a
refresh, and bound the forced refresh with a short cool-down.

### WB-06 (low) - `Persister.control` rollback details

`control` snapshots `state()` before the op and, when the save fails, calls `reload(saved)` (`keyset.py:436-446`). (a) `reload`
re-runs `__init__`, which sets `dirty = False` (`:142`), although the snapshot itself may hold high-water marks that were never saved
(the 2 s delayed save was pending): they are then not written until the next message raises the mark again - a short cross-restart
replay gap for the bridge's own services. Fix: after `reload(saved)` set `dirty = True` (a redundant save is harmless). (b) A second
`control` that ran `handle_control` while the first one's save was in flight returns its "ok" answer after the first one's rollback
reverted its change (its `persist()` finds the set clean). The add-on drives rotation serially, so this needs a hostile or buggy
caller holding the key; cheap fix: take the Persister lock around the whole of `control` (snapshot, op, save), not only the save.

### WB-07 (low) - the re-pair fence is on the native path only

`_same_pairing` (25.11) is checked by `native_keyset.verify / check / sign_reply / source_fingerprint / legacy_allowed`. The bridge's
own signed services (`execute`, `schedule`, `config_item`, `rotate`, the lease services) verify with `keyset.verify` directly
(`__init__.py:434-439`), so between the entry update and the scheduled reload (`:704-719`) the old pairing's key still operates them.
The window is one event-loop turn plus the unload, so the exposure is small; but it is the same class WisKey reported and the fix is
one line: refuse in `screened()` / the rotate and lease handlers when `native_keyset._same_pairing(entry, keyset)` is False
(`bridge_pairing_changed`), or expose that check as a method of the Persister. (For the tag-less states of WB-02 the window never
closes; WB-02's fix covers that.)

## 3. Improvements (short)

- `wiskey_direct_join.people_path` reports `wiskey_direct_not_connected` after a failed connect; report `session.last_error` (it holds
  the real reason, e.g. `direct_v2_refused:...`) so the audit row and the status page say why.
- `DirectApiTransport._v2_subjects` (PAIRING-Q2 pin) lives for the transport's life; a legitimate bridge entry re-creation with the
  same key set cannot happen today (a new entry means a new pairing), but the pin should be cleared when the join restarts on a key
  change - it is, because the join is rebuilt; worth one assertion in the runtime manager's test.
- `wiskey_system_status._station` silently drops a station row it cannot read; the module's own rule is "no row is not no data" -
  count the dropped rows and show "N rows unreadable".
- `Persister._saved_hw` starts empty when the set is dirty at setup (correct, conservative); document it next to `saved_through`,
  because it means the first v2 message after a setup that closed a capped rotation always writes.
- `wiskey_media_bridge.DirectLink.call` (the media form) reports a send failure as `closed`, `call_command` as `unknown`; both are
  handled correctly by their callers today, but one vocabulary would remove a trap for the next caller.
- The CLAUDE.md commit trailer still names Fable 5.1; the review brief and the session attribute commits to 5.2 (used here).

## 4. Checked and fine / coverage

Read in depth, end to end, no finding beyond the ones above:

- **Bridge key set and v2 binding** - `keyset.py` (verify order: format, constant-time MAC first with a dummy key, window, boot
  high-water, nonce cache; rotation ops begin / probe / commit / retire / abort / status; the 180 s cap; HKDF; answer-only reflection
  guard; unsigned refusal for unauthenticated control messages), `native_keyset.py` (no v1 fallback, `g0-legacy` refused on v2,
  ambiguity across entries, re-pair fence in all five entry points, `sign_reply` is not a signing oracle: exact canonical bytes, own
  kid, 32-hex connection_ref, object frame, size bound; request / reply domain separation by prefix; bindings carry no material; the
  save-before-admit rule including the rollback race WisKey's regression covers - traced by hand for both orders of the lock),
  `__init__.py` setup / unload / update listener / rotate service / housekeeping, `_common.canonical`, `signing.py`.
- **Mirror** - `diff -rq custom_components/smplwise_bridge smplwise_vms/integration/smplwise_bridge`: identical.
- **Signing correctness, both sides** - add-on `bridge_keys.sign_with / verify`, `ha_bridge.sign / verify / verify_message /
  signing_key` (revocation blocks every outbound signature), `wiskey_media_bridge` `_sign_body`, `sign_connect`, `reply_mac`,
  `open_reply`, `read_identity` against hand-off answer 2.2 (reply recipe: HMAC-SHA256 over `wiskey-direct-reply.v2.` + canonical
  `{connection_ref, frame, kid}`, sort_keys, compact separators, `ensure_ascii=False`, no NaN) and 4.1 (UUID `repository_id`
  required on v2, null refused). Same canonical JSON on bridge and add-on.
- **Transport** - `DirectLink` (`call`, `call_command`: outcome classes `not_sent` / `refused` / `unknown`, fresh nonce per frame, no
  API to send a pre-signed body, late answers dropped and never re-attributed, MAC failure closes the link and ends requests in
  flight `unknown`, B2-ABI guard `0 < timeout <= 58 s` on v2, `bridge_key_changed` closes the link), `DirectApiTransport` (protocol
  chosen from the key before any socket, no v1 after v2, hello / connect timeouts 10 s), `AutoTransport` (no Home Assistant fallback
  after a v2 attempt or with a rotated key), `LoopThread`. Every WisKey call timeout constant in the area is <= 58 s
  (`wiskey_installer.WRITE_TIMEOUT_S` and `wiskey_schedule_writes.DEVICE_TIMEOUT_S` are exactly 58).
- **Direct join / discovery / catalog** - `DirectCommandSession` (cancellation and budget expiry settle `unknown`, never
  `not_sent`), `people_send` / `fallback_permitted` (unknown is never followed by a classic write; verified refusal final on v2 -
  for the case it reaches, see WB-01), `DirectDiscovery` (closed v1 / v3 documents, pairing status closed and bound to the
  connection's own protocol + kid, 60 s freshness), `wiskey_direct_catalog` (`WISKEY_OWNER_ONLY` refused before any byte; no caller
  of the owner's v3 grant writes exists on any channel - grep over the backend).
- **Service grant v3 reader** - closed document, `active` only with a grant, refusal final (no other command tried), observation
  bound to the connection and 60 s fresh; the v3 / v2 service writers have no journal client in production, so no service write can
  be sent at all (`FinalServiceWriter.available` returns False first).
- **2.52 numbered wires vs WisKey rc20 contracts** - `sync/station_v1` (request keys, result constants, UUID request id,
  `effect_proven` false, `accepted` never shown as done, refusal final - no classic `sync/station` after it, hand-off 4.3),
  `stations/relay_inventory_v1` (closed result schema, constants type-exact, never read as authorisation), `system/status_v1` and
  `jobs/status_v1` (constants enforced, unknown enum -> `unknown`, null counts stay null), `visits/record_external_v1` and the
  `ended` filter (record validated before sending, closed code table, WisKey's post-write refusals arrive as
  `visit_record_outcome_unknown` - checked in WisKey's `websocket.py` / `external_visits_api.py` - and Arx settles them `unknown`,
  never re-sent; reconcile compares `arx_revision`).
- **Door path** - `routers/access_control_door.py` (`release`, `open_door`, `_perform_signed`, `open_from_tile`): one door
  authority, explicit confirmation, step-up guard, relay reservation, attempt row committed before sending, idempotent tile click,
  unknown never retried and settled only by the status read, no door command while a rotation may be half switched, refused without
  a WisKey copy. `wiskey_auto_door.py` and `wiskey_feature_direct.start`: intent committed before I/O, one attempt per request id,
  both creator and approver re-judged, nothing sent while the switch is off.
- **Secrets** - grep of every log call in `wiskey_*`, `bridge_*`, `ha_bridge`, `intercom_*` and the bridge for key / secret / pairing
  code / PIN / token arguments: none; `BridgeKey`, `Key`, attachments and bindings have material-free reprs.

Read at outline level only (gates and structure, not every path): `wiskey_channels.py` (allow-lists, reserved keys guard),
`routers/access_control_station_ops.py`, `access_control_door_tech.py`, `access_control_schedule_writes.py`,
`access_control_command.py`, `wiskey_switches.py`, `access_control_system_status.py`, `wiskey_station_ops.py`,
`routers/access_control_people.py`, `services/intercom_media.py` (talk channel open / close / listen gate R5 only),
`wiskey_service_write.py`, `access_service_writer.py`, `wiskey_join_live.py`, `bridge_rotation.py` (pre-flight and peer call only).

**Not reviewed in this round** (no claim is made about them): the bridge's `lease_*`, `schedule_*`, `media_*`, `config_*`,
`cast_*`, `stream_source_service`, `service_identity`, `runnable`, `wiskey_door_block`, `config_flow`; backend
`bridge_rotation` state machine in full, `bridge_install`, `bridge_discovery`, `bridge_key_*`; `intercom_sync`, `intercom_adapter`,
`intercom_client`, `intercom_writes` / `_write_journal`, `intercom_authority`, `intercom_messaging*`, `intercom_consent`,
`intercom_calls`, `intercom_listen`, `intercom_capture`, the media / listen / calls / messaging / capture routers and websockets;
`wiskey_native_write`, `wiskey_write_lineage`, `wiskey_schedule_writes` (service), `wiskey_door_tech` (service),
`wiskey_emergency_direct`, `wiskey_feature_exec`, `wiskey_event_resume`, `wiskey_intents`, `wiskey_peer*`, `wiskey_pairing`,
`wiskey_managed_install`, `wiskey_auto_install`, `wiskey_installer*`, `wiskey_profiles`, `wiskey_people_csv`, `wiskey_triage`,
`wiskey_wa_queue`, `wiskey_ops_views`, `wiskey_access_*`, `wiskey_relay_map*`, `wiskey_live_validation`, the access-grant engine
and its routers. Recommendation: a second pass for these, split by the four scopes that were prepared for the sub-reviewers
(bridge services; intercom media / calls / messaging; door-tech / schedule / station writes and the write journal; people / lineage /
install), each against the same invariants.

Tests: NOT_RUN (review only). The single probe for WB-02 ran on the PC with `py -3.12 -I`, exit 0, output quoted in WB-02.
