# ADOPTR6-295 - adoption receipt of the Mac reply-6 delivery (M1-M6) per the Windows review

Status: adoption branch ready for the next release assembly. Nothing installed, nothing enabled, no equipment touched.
This is the ONE adoption receipt the Windows review asks for (FORWARD_TO_ARX section 6). Owner-facing translation is the lead's.

## 1. Identities (real, verified)

| what | value |
|---|---|
| adoption branch | `pilot/ADOPTR6-295` |
| adoption head (code + tests) | `b3073998c58b6d77e3d1fa30e8aa667634ad9e1b` (tested in run 2, section 5) |
| adoption head (this document) | the commit that adds this file, directly on top of `b3073998c`; it changes `docs/` only - verify with `git ls-remote origin refs/heads/pilot/ADOPTR6-295` |
| cut from | `origin/release/2210` @ `9459502e91cc8e633ff9a0ee532d88cf4c093444` (2.21.0 assembly; verified by `git ls-remote` before the cut) |
| release/2210 contains | WK4ADOPT-295 @ `80e3eed68` (merge `24270307d`), WKR5ADOPT-295 @ `f97862b8f` (merge `be78c9cd2`), PEERQUERY-295, CAPEMERGENCY(2)-295, GENELEV-295, T06ADMIT-295 |
| Windows review source of Arx | `002eec7b90e42cc52384e783800d1ca698895b27` (pilot/WK4ADOPT-295 before the WR6-01 fix) |
| Mac delivery commit | `e25e1e92a9e92f7d2ae7623985c5a9977e0690cb` (branch `codex/wiskey-mac-wr5-development-2026-10-19`) |
| Mac product CODE | `6a8a0a2cf0818c737ee6fcd3eb0a6ca530b06e8f` |
| Mac product files changed by reply 6 | `custom_components/hikvision_intercom/bridge_command_auth.py` (`75d6f75c...`), `custom_components/hikvision_intercom/station_media_runtime.py` (`169bc848...`) - WisKey's repository, NOT vendored in Arx |
| combined 2.21.0 build / artifact / environment / go2rtc | NOT_IDENTIFIED (no build was made here; release/2210 is assembled by another agent) |

The delivery files were read in place (read-only) from the owner's local copy of the Windows review; nothing in that repository was
fetched, checked out or modified. Hashes below use the review's span algorithm (AST `lineno..end_lineno` inclusive, exact bytes with
their line endings, decorators excluded); it reproduces the review's values (e.g. `LiveResolveTransport.read` @ 002eec7b = `634f4a79...`).

## 2. Per item: Mac source, Arx touch points, before/after

### M1 / W-002 / WR4-01 - terminal completion (Mac fix; Arx consumer unchanged)

Mac source (6a8a0a2c, M1_TERMINAL_COMPLETION.json / M1_BEFORE_AFTER.json): `BridgeExecutionBinding.check` 46-52 `a724ecee...` (still enforces
the signed deadline), `BridgeExecutionBinding.check_terminal_origin` 54-79 `53427bfa...` (terminal identity only), `BridgeTalkSession.run`
610-766 `6d51fff2...` (was 607-752 `76509854...` on 924df3e9), `StationMediaHost._check_source_identity` 290-302 `f2e208a2...`.

Arx consumer touch points - byte-identical between the review source and the adoption head (no Arx change needed or made):

| file | file sha256 (002eec7b = 9459502e9 = b3073998c) | symbol | span sha256 |
|---|---|---|---|
| services/intercom_media.py | `b845c5f07fdc604856a7f139fdea081e1daafc30682479619c2a6fb2cbab2232` | WiskeyBridgeTalkChannel._on_event 890-913 | `aaa9cfe3849ada3763c383cc6a1e61d97442ae7f940bc46926c2bb6a13a1d6d1` |
| same | same | WiskeyBridgeTalkChannel.receive_audio 921-929 | `d9fac6eccb9bd37caf998312d49465cbf2880cdb3bdbc63ebdd011bd0f8c04b6` |
| same | same | WiskeyBridgeTalkChannel.wait_closed 939-940 | `c9acd940a1cd53d42b5239e805e234c781922dd9a3ab476c2b088255414e270d` |
| services/wiskey_talk_pump.py | `376ca8c17c52d6178a155d3a96fb55ffead67af5748132366673c297d244d5f2` | TalkPump.remote_closed 148-151 | `06a6d3ef9902a688c00cac6e54577d53ad54a03474e1abe9a62e11f7318ede42` |
| routers/intercom_media.py | `f80489248efb19730f6ea7ae95f2967026c2aa2e118e0fd53e9af6057defd7b8` | _pump 364-470 | `32e0e9b893d488dd068b4ae0a6d20ed48c4fd7d1e21aae303abde30dd6e02d0d` |

Of the 12 Arx SOURCE_PARTS the Mac M1-TERMINAL-02 / M2-PEER-SERVER runs used (all from 002eec7b), these are byte-identical at the
adoption head: intercom_media, wiskey_talk_pump, wiskey_media_bridge, wiskey_media_contract, wiskey_command_port, wiskey_listen_adapter,
wiskey_capture_map (and routers/intercom_media.py). Changed since 002eec7b: wiskey_intents (WR6-01 fix), wiskey_peer, wiskey_peer_registry,
wiskey_direct_join, wa_template_send (the WKR5ADOPT merge). So the Mac's real-native-CODE talk receipts exercised the SAME consumer bytes
the candidate carries; they remain Mac receipts on their own CODE (counts are not merged).

Re-run of our three original consumer tests (section 5, group g2, on `b3073998c`) - what each part is:

| test (`tests/test_wk4adopt_295.py`) | Arx source parts (genuine, at b3073998c) | WisKey side |
|---|---|---|
| `test_wr4_01_consumer_idle_after_proof_expiry_with_the_terminal_event_closes_the_original_channel` | intercom_media, wiskey_media_bridge, wiskey_talk_pump, routers/intercom_media `_pump` | DUPLICATE: `Rev2Station(terminal_event_after_expiry=True)` - Arx's fake modelling the fixed Mac rule; NOT Mac code |
| `test_wr4_01_consumer_signed_expiry_with_the_terminal_event_closes_the_original_channel` | same | same duplicate |
| `test_wr4_01_as_delivered_the_event_is_lost_and_only_arxs_own_deadline_ends_the_channel` | same | DUPLICATE of the historical 924df3e9 behaviour (`terminal_event_after_expiry=False`) - now historical, kept as the bound of the old finding |

Running them against the GENUINE fixed Mac CODE in Arx's environment is BLOCKED: the Mac product needs the WisKey repository at 6a8a0a2c,
Home Assistant 2026.9.4 and pytest-homeassistant-custom-component; the delivery carries source excerpts, not a tree, and the brief forbids
fetching it. The genuine-native evidence is the Mac's own M1-TERMINAL-02 (4 PASS, exit 0, CODE 4dbe6922) and M1-ORIGIN-FENCES-03 (17 PASS,
exit 0, CODE 6a8a0a2c) on Arx consumer bytes identical to the candidate's (above). M1-TERMINAL-01 (8 PASS / 2 FAIL, exit 1, f2f6e32f) stays
a FAIL on its CODE.

OPEN - WMR6-HA-01 (not closed by this item): on a still-open SHARED HA WebSocket, a pairing revoke suppresses `media/talk_closed` and
nothing ends the original Arx waiter. Arx side of the gap, unchanged and verified: `HaWsConnection._on_frame` 904-911 `34131117...`
consumes event frames only; `HaWsConnection._mark_closed` 913-922 `fd7ea8b8...` depends on socket/session termination
(services/wiskey_media_bridge.py `7c8181d6...`, identical at 002eec7b and the adoption head). Path in the candidate: the talk channel's
link comes from `WiskeyBridgeProvider` (direct link first; the HA path only when the direct path is not selected); a dedicated socket
per talk on the direct path, a possibly SHARED HA ActiveConnection on the HA path. Bound today on the HA path: the router's own session
deadline (`_pump.watch`, `t.expires_at`), an explicit stop, the lease (revoke of the Arx user) or a dropped connection - one `talk_close`,
no replay, no late audio (pinned by the "as delivered" test). Required to close it: an agreed Mac+Arx terminal for the HA path (no
event to the revoked identity, no close of the shared ActiveConnection, no new authority, no unagreed wire field) plus a new HA-wire test
on both sides. W-002 is NOT closed for all transports on the direct-path PASS.

### M2 + M4 / W-010 - peer reads (Arx-owned adapters; no Mac patch)

WR6-01 fix (commit `80e3eed68`, in release/2210), verified:

| symbol (services/wiskey_intents.py) | before @ 002eec7b (file `8945d22c...`) | after @ b3073998c (file `94631365372548e1e29bc36b4e14d8a49b07c2e1ed1f2351d0d99d9dfb2332bc`) |
|---|---|---|
| LiveResolveTransport._once | absent | 212-226 `3994e6629ea7b5de4ceb18c6e6e48224982511e0f4defcd50409c31b1bd02cdc` (the receipt is returned by the call itself; a local refusal has none) |
| LiveResolveTransport.resolve | 325-334 `1cbc0f9e...` | 228-233 `eefec8aa1606cc12ff6c78c7bc91b9b2ec73b1d466a686b64cae10ec4ea17787` |
| LiveResolveTransport.read | 336-342 `634f4a79...` (returned `self.receipts[-1]`) | 235-241 `de41d27acb81948360024c9041f609c994f133237b127ab088e9a2b03d52dafa` |
| resolve_intent | `60bcaf5c...` | unchanged `60bcaf5ce9772c9953d802e33afb23601184e9898f58914e04030f6e5e97d22c` |

New regression (genuine Arx CODE, fake JoinServer): `tests/test_adoptr6_295.py::test_wr6_01_a_previous_receipt_is_never_the_receipt_of_a_later_local_mismatch`
parametrized over a previous `unknown` result, a previous `found` result and a previous VERIFIED REFUSAL; then a local
`original_reference_mismatch`: zero further frames of ANY command, returned receipt None (not the previous one), history = the one real
call, verdict `unknown` / settles False / replay False. `::test_wr6_01_resolve_intent_after_a_local_mismatch_keeps_the_intent_unknown_and_unsendable`:
the intent stays `unknown`, never `never_committed`, `mark_sent` refuses (no replay). The earlier WK4ADOPT test
`test_wr6_01_a_local_refusal_after_a_successful_read_returns_no_receipt_and_sends_nothing` still passes (g2). No replay or false-commit
claim follows from any of this.

`wiskey_direct_join.py` overlap WK4ADOPT x WKR5ADOPT - resolved: the release/2210 file (`9d10f06d...`) is exactly the WKR5ADOPT file
(`bb3d1e5f...`, `f97862b8f`) plus WK4ADOPT's additive 9 lines (two attributes in `DirectJoin.__init__`, two constructions in `startup`);
`git diff f97862b8f 9459502e9` shows nothing else; nothing of either side was lost. Real callers / selection points in the existing scope:

| read | product caller | selection point |
|---|---|---|
| `peer_bindings/get` (admin read) | `wiskey_peer_query.peer_query` -> `_run` 163-202 `b7f974e1...` -> `DirectRegistryTransport` (PEERQUERY-295; switch `wiskey.peer_query` default OFF, `system.configure`, owner pin) | `_installed_port` 135-145 `7cada747...`: the join's capture port only while `DirectJoin.selected()` |
| `peer_bindings/get` (WK4ADOPT `LiveRegistryTransport`) | no route / job calls `join.registry_transport` in this build | NEW `DirectJoin.registry_or_none` 429-433 `aa91111109d628414931d80b28d012d313bbf0fcfc097319f7c18dae7e130540`: only while `selected("peer_bindings/get")` |
| `peer_receipts/resolve` (`LiveResolveTransport`, `resolve_intent`) | NONE: the recovery caller of an UNKNOWN intent is not built (no scheduler; not added) | NEW `DirectJoin.resolve_or_none` 435-440 `0d5b6f4f58d9aa52e06c4976e540e7547af096069948696f11e2394d261f19a1`: only while `selected("peer_receipts/resolve")` |

`DirectJoin.selected` (407-415 `6ef8d112...`) is unchanged; `startup` span unchanged (`c9b0fcb6...`). File after: `756d96b0f6ff37174e7c090f76f6ed1a3e2bbab9c0e1fb50009532feca23a59c`.
`test_no_product_module_calls_the_resolve_read_outside_the_join_and_its_own_module` pins the honest caller map. Both commands are
`discovered_for_native_owner` in the round-5 catalog. No new switch, scheduler or activation.

M2 contract points carried (no Arx change): the peer handler code is `binding_denied`; transport disconnect/timeout is not a server receipt;
`unknown` is not `never_committed`; Arx sends no `initialize` (`peer_query` refuses it `not_implemented`); a real binding is the owner's/
WisKey's allocation - no HA user or authority is invented. W-008 vectors do not close W-010.

### M3 / W-006 - people CSV reader on the nine answers (people_csv stays OFF)

Producer unchanged (Mac). Arx consumer `services/wiskey_people_csv.py`: before `7c62e8b2...` (f97862b8f = 9459502e9) -> after
`0f55bfaf1986cbf78f564eeeadc4730274a9e854aea3e5927ce1404f7ce6be74`.

| answer | Arx change (symbol, after span) |
|---|---|
| 1 schema | `read_preview` 211-258 `76b971a16f24fd67278461eee732ff55fa54283f5c6c004d32a09c28e7d37e33`: `schema == "arx.people_csv.preview.v1"` exactly; create rows have user_id AND revision null, updates both set |
| 2 mode | `request_preview` 335-380 `c98722cfe2a10b81605cb90f3953220b38725bb05a4dbdd0767a1375b000080b`: `create` \| `upsert` only (router `?mode=`; held from preview to the fresh confirm preview); Arx person-id compare-and-set rows stay refused (not a native mode) |
| 3 column_map | `column_map` 312-327 `526347945a220a5144f7ac6d920b2df48ec7d2123177cbc732964ebfce97294f` + `_native_reader` 269-287 `ca018b58...`: every ORIGINAL header exactly as the native reader sees it (no strip - the previous `h.strip()` key was a real mismatch), unique targets incl. employee_no + display_name, native names only (`profile:<id>` never mapped by Arx); native limits 262144 B / 32 headers of 1..128 / 500 records refused locally, nothing sent |
| 4 authority | no fixed value invented: the owner-set `binding` (authority_ref/revision, scope_ref, source_epoch) feeds both request and snapshot; unchanged |
| 5 refs | `_metadata_ref_ok` 330-332 `e761ca9c...`: preview_ref / ownership_policy_ref / revision_policy_ref are 1..128-char labels, no C0; never authority |
| 6 delayed start | `start_window_open` 383-392 `01a7a3b4...` + `start` 395-412 `b5446962adb9a273eafae88ef4e9a0d3ae472ff36097e2460a944ef5488a0d34`: after the human wait a FRESH preview is taken (as before) and its start passed unchanged; if that fresh request's own window has passed, `preview_window_passed` (not_sent) - never edited, extended, re-signed or replayed |
| 7 determinism | `Preview.digest` unchanged: review_stamp + rules_stamp + per-row line/user/revision/change_digest; grant ids / origin refs excluded (they vary per operation) |
| 8 receipt | `read_receipt` 419-445 `a820e731ad1c136a8fbe3499f64946474ea30fd577de09dbd7bc793498dbd8f6` + `read_result` 448-463 `31694469...`: closed CheckpointJobs.public + source_binding + `device_application == "unknown"`; projects counts, job state, error lines, `central_committed_lines`; a central commit only, never device proof; other shapes `receipt: unreadable` |
| 9 source_line | `source_lines` 290-309 `6c3242b081529ef5c5d399dca5b7c14f5456d84b4759d523a31247bfa27dfd28`: physical END line -> Arx record number; `read_preview(lines=...)` refuses a line that ends no record (`preview_line_unknown`); the view shows both |

Router `routers/bulk_people.py` `dcd0f451...` -> `843908fb3d7a04843256ff708f565250a9c04bdd2d1fe598df96cb94c6c4f318`: `_preview_view`
`c156ccc2...` (adds `row`), `wiskey_preview` `485b2667...` (`mode` query), `wiskey_confirm` `4041243b...` (same mode at the fresh preview),
`wiskey_result` unchanged `d07ea7d4...`. The bulk dialog UI is not changed (create stays its only mode). Switch `access.people_csv_preview`
stays OFF by default. Receipts for the original reader on the source to be merged: section 5 g3 (existing suite with native-shaped fakes)
and g1 (new cases).

### M5 / W-001 (+ W-002 downlink) - explicit close and current admission on the candidate router

Component (unchanged, accepted): `_Downlink._end` 100-108 `241efa4e...` keeps the admitted tail; `_Downlink._fence` 110-118 `de325e71...`;
`ReceiveDownlink._pump` 205-216 `d051ff6f...`; `ReceiveDownlink.close` 218-219 `aac8a147...`; `_join_downlink` 222-251 `df176666...`
(services/wiskey_listen_adapter.py `b69dc502...`, identical at 002eec7b and the head). Natural `_end` alone is NOT a security fence.

Talk route (`routers/intercom_media.py` `f8048924...`, unchanged): `_pump` 364-470 `32e0e9b8...` - `from_station` checks the lease's
awaited `confirm()` (current admission, fail closed), then with no await the session expiry, stop and `should_stop()` before EVERY
`send_bytes`; a revoke/expiry (from `watch` or the check) returns, the task is cancelled and its `finally` calls `downlink.close(...)`
(fence + drain + join producer), joined before `_pump` returns; `talk_ws` 474-552 `33a5e476...` then calls `channel.close(outcome)`.
`CameraLease.confirm` 58-85 `088cb62b...`, `should_stop` 87-100 `7c7919bd...` (services/leases.py `20755854...`). Note: the talk
downlink's close is called with `"ended"`; the reason only feeds a close hook the talk downlink does not have; the fence is the same.

Listen route - a concrete integration gap found and fixed: `routers/intercom_listen.py` `9c84faac...` -> `2243732c782a3b58402c2d7b08a8f3f324c846a5e82c15928803b5107f84a1c2`.
Before, `_pump.to_browser` (196-243 `4cf39236...`) published every queued frame with NO admission check: a revoke reached the browser
only at the watch's next 1 s tick and a naturally ended downlink's whole tail was published regardless. After, `_pump` 196-256
`b788f980bd14e607d91a9bc6c7a9f82a3d6e26bccacc027b30ae73d7a4257679` runs the same four checks before every frame (the tail included);
`listen_ws` (span unchanged `b15d28da...`) calls the channel's explicit `close(outcome)` with the real reason. The real WisKey listen-only
downlink still answers `downlink_pending` (WiskeyDownlinkChannel); listen-only runs on the synthetic downlink only.

New receipts (section 5 g1): talk revoke x3 (`revoke_by_watch`, `revoke_before_publish`, `confirm_refused`), talk expiry, talk natural-end
tail under revoke; listen revoke x2, listen expiry, listen natural tail without revoke; and through the real listen socket (Starlette
TestClient, synthetic downlink) `test_listen_ws_closes_its_channel_explicitly_with_the_revoke_reason` (close `access_lost`, fenced). These
are NOT the five M5 component cases inside the Mac M2-PEER-SERVER-02 run and are not counted with them; the historical WKAUDIN/WK4ADOPT
raw receipts remain NOT_AVAILABLE. The pre-fix listen router was not run against the new listen tests (NOT_RUN as a before-proof).

### M6 / W-005 + W-013 - static alignment integrated (nothing enabled)

Unchanged and verified at the head (services/wiskey_capture_map.py `1d2160da...`): `MAC_TABLE` 94-102 `39eca1a8...` (the seven card-capture
actions, symbols and the three native file hashes `bcf54e34...` / `d6627564...` / `f179e698...`, identical in 6a8a0a2c), `DTO9_KEYS`
`1185342c...`, `WIRE_KEYS` `1d7cce93...`, `project_dto9` 178-219 `b92b0b75...` (non-null `binding_revision` refused), `MAPPING_ENABLED = False`
`bfbbb762...`. Template v2 (services/wa_template_send.py, 002eec7b `bdf4881c...` -> head `be5ac851...`): `TemplateRequestV2.wire`
`51ba5a12...`, `wire_problem_v2` `03d242a1...`, `read_v2` `09a4074e...` unchanged; `TemplateSender.send_v2` changed `9aaafb81...` ->
`f875bb69acc6240f5134fae48333cc842283f950499f64599a0be659241fb87f` by the release/2210 unification of WK4ADOPT W-013 and WKR5 unit D
(argument aliases + `TRANSPORT_V2_PROVIDER` selection) - the wire builder/checker the M6 review compared is byte-identical, so the
reviewed wire stays as reviewed; the selection plumbing is covered by g2/g5 tests, not by the M6 static review. `TEMPLATE_SEND_SUPPORTED
= False` (services/intercom_messaging_adapter.py `ca265fdd...`, unchanged). Card capture is a card at the door station reader, not a
camera snapshot. No transport chosen, no installer activation, no send. New pin: `test_m6_the_seven_card_capture_actions_match_the_reviewed_native_source_and_nothing_is_enabled`.

## 3. Dependency / owner map

| item | Arx owner (this repo) | Mac / WisKey owner | blocks only |
|---|---|---|---|
| W-002 HA revoke (WMR6-HA-01) | identify the HA path socket ownership (done above); agree the terminal; HA-wire test | terminal for the shared HA socket without notifying the revoked identity | universal W-002 revoke claim |
| W-010 | the two adapters, WR6-01, the selection point, a future recovery caller (not built) | the real peer binding allocation (owner/WisKey) | per-invocation evidence; live reads |
| W-006 | the reader (done), the UI mode choice (not built), turning it on (owner) | producer (unchanged) | live CSV import |
| W-001 / W-002 downlink | router/session fences (done for talk and listen); full ASGI qualification | real listen-only downlink contract (`downlink_pending`) | integrated no-late-publish proof on the gate |
| W-005 / W-013 | static pins (done); CAPMAP transport choice, template permit (owner decisions) | native sources (unchanged) | any activation |
| W-016 full ASGI, W-017 S8 | release gate on the combined SHA, owner session | - | candidate qualification / live |

## 4. Evidence - kept separate

Existing (NOT re-run here, NOT merged with new counts): Mac M1-TERMINAL-01 (f2f6e32f, 8 PASS / 2 FAIL, exit 1), M1-TERMINAL-02 (4dbe6922,
4 PASS, exit 0), M1-ORIGIN-FENCES-03 (6a8a0a2c, 17 PASS, exit 0), M2-PEER-SERVER-01 (4dbe6922, 6 PASS / 1 FAIL, exit 1), M2-PEER-SERVER-02
(6a8a0a2c, 6 PASS, exit 0, includes the five M5 component cases - not counted again); the Windows static review; Arx historical receipts
of WK4ADOPT/WKR5ADOPT on their own CODE (491 local and WK4ADOPT raw NOT_AVAILABLE).

New (this item, section 5): runner runs on `b3073998c` only.

## 5. Test receipts (runner, targeted - NOT a release gate, NOT full ASGI)

Command per group: `~/run_remote.sh backend pilot/ADOPTR6-295 <files> --junitxml=...` (pytest, `-o addopts="" -q -p no:cacheprovider`) on
the Ubuntu runner, Python 3.12; logs and JUnit under `~/adoptr6_295_r2/` on the runner. Exit codes are pytest's own.

Run 2 - SHA checked out on the runner `b3073998c58b6d77e3d1fa30e8aa667634ad9e1b`, 2026-10-25T19:23:35Z .. 19:25:26Z:

| group | files | exit | pytest summary | JUnit failures/errors |
|---|---|---|---|---|
| g1 | tests/test_adoptr6_295.py (new) | 0 | 25 passed | 0 |
| g2 | tests/test_wk4adopt_295.py (incl. the three WR4-01 consumer tests, WR6-01, W-013) | 0 | 44 passed | 0 |
| g3 | tests/test_wkr5_csv_295.py, tests/test_bulkpeople_295.py | 0 | 48 passed | 0 |
| g4 | tests/test_wkaudin_295.py, tests/test_wkf01f02_295.py | 0 | 47 passed | 0 |
| g5 | tests/test_wkjoin_295.py, tests/test_peerquery_295.py, tests/test_wkdirect_295.py, tests/test_wkr5_295.py, tests/test_wkr5_295_bdg.py | 0 | 164 passed | 0 |
| g6 | tests/test_wkcap_295.py, tests/test_wkcapwire_295.py | 0 | 79 passed | 0 |

The three consumer tests appear in g2's JUnit without failure: `test_wr4_01_consumer_idle_after_proof_expiry_with_the_terminal_event_closes_the_original_channel`,
`test_wr4_01_consumer_signed_expiry_with_the_terminal_event_closes_the_original_channel`,
`test_wr4_01_as_delivered_the_event_is_lost_and_only_arxs_own_deadline_ends_the_channel` - on Arx's duplicate of the WisKey side (M1 table).
All on fakes / synthetic doubles; no WisKey, Home Assistant, station, door or provider was reached.

Run 1 (on `f02def0d0`, superseded): g1 exit 1 (1 failed, 24 passed - a test bug: the `confirm_refused` case queued no packet, fixed in
`b3073998c`), g2-g6 exit 0. Kept for honesty; not evidence for the head.

NOT_RUN: full ASGI qualification of the combined candidate (W-016), S8 (W-017), any test against the genuine Mac CODE in Arx's environment
(BLOCKED, see M1), an HA-wire talk revoke test (does not exist yet), the frontend (not changed), the whole backend suite.

## 6. The 34 parent rows - six states

Legend: impl = implemented, reg = registered, wired = connected in the candidate, tests = this receipt's evidence state, inst = installed,
live = measured live. Every row: inst NOT_PERFORMED, live NOT_MEASURED (nothing installed or run on equipment by this item).

| row | title | impl | reg | wired | tests | inst | live |
|---|---|---|---|---|---|---|---|
| W-001 | Live video, descriptor/lease, cleanup | adopted (002eec7b); unchanged | single `_LEASED` registry | release/2210; router talk/listen explicit close + admission (listen fixed here) | NEW g1 router cases on b3073998c; full ASGI NOT_RUN; video lifecycle not re-run here | NOT_PERFORMED | NOT_MEASURED |
| W-002 | Incoming audio / listen-only | Mac terminal fix (6a8a0a2c, WisKey repo); Arx consumer unchanged | existing talk_open/listen/talk_closed | direct path: consumer bytes = Mac-run bytes; HA path gap WMR6-HA-01 OPEN; real listen-only downlink `downlink_pending` | g2 three consumer tests on Arx duplicate; genuine-Mac in Arx env BLOCKED; Mac receipts separate | NOT_PERFORMED | NOT_MEASURED |
| W-003 | Talk and duplex | done | talk_open v1.1 | signed link | g2/g4 (fakes) | NOT_PERFORMED | NOT_MEASURED |
| W-004 | Emergency new OPEN after UNKNOWN | WKOPENUNK + EMROLE + WKR5 unit E merged in release/2210 | `wiskey_emergency_direct` install path; nothing enabled | present by merge; not re-qualified here | not run by this item | NOT_PERFORMED | NOT_MEASURED |
| W-005 | Capture lease, receiver, DTO9 | static alignment integrated (7 actions, protocol+DTO9, binding_revision refusal) | CAPMAP `MAPPING_ENABLED=False` | no mapping transport selected | g1 M6 pin + g6 capture suites | NOT_PERFORMED | NOT_MEASURED |
| W-006 | people_csv preview | reader adapted to the nine answers (b3073998c) | switch OFF by default | direct join `people_csv_or_none` (unchanged) | g1 + g3 (fakes in native shapes) | NOT_PERFORMED | NOT_MEASURED |
| W-007 | KEY guard, two installers | done (Mac) | done | Mac | Mac receipts (existing) | NOT_PERFORMED | NOT_MEASURED |
| W-008 | Signed vectors, simulator, catalog | done | done | Mac | existing; does NOT close W-010 | NOT_PERFORMED | NOT_MEASURED |
| W-009 | Durable event cursor | not implemented (optional) | - | - | NOT_RUN | NOT_PERFORMED | NOT_MEASURED |
| W-010 | peer / registry / resolve | WR6-01 fixed (80e3eed68); selection point added | `wiskey.peer_query` OFF; owner pin required | admin `peer_query` caller; WK4ADOPT reads: selection point, no caller; resolve: no caller (not built) | g1 WR6-01 regression x3 + caller map; g2, g5 | NOT_PERFORMED | NOT_MEASURED |
| W-011 | People writes durable intent | done | default OFF | fakes | existing | NOT_PERFORMED | NOT_MEASURED |
| W-012 | Station removal verdict v2 | done | switches OFF | fakes | existing | NOT_PERFORMED | NOT_MEASURED |
| W-013 | WhatsApp template v2, PIN | static alignment integrated; send_v2 unified in release/2210 (wire unchanged) | `TEMPLATE_SEND_SUPPORTED=False` | v2 provider via `template_v2_or_none` only when selected; no installer read activated | g1 pin, g2/g5 (fake sender) | NOT_PERFORMED | NOT_MEASURED |
| W-014 | name_ref and raw values | done | done | fakes | existing | NOT_PERFORMED | NOT_MEASURED |
| W-015 | Candidate identity, push, source bundle | this branch + SHA (section 1); combined 2.21.0 SHA not final | n/a | release/2210 assembly by another agent | n/a | NOT_PERFORMED | NOT_MEASURED |
| W-016 | Full ASGI qualification | - | - | NOT_QUALIFIED | NOT_RUN | NOT_PERFORMED | NOT_MEASURED |
| W-017 | S8 live proof | runbook preparation only | no activation | environment/go2rtc NOT_IDENTIFIED | NOT_RUN | NOT_PERFORMED | NOT_MEASURED |
| W-018 | Automations that open doors | built locked | - | - | - | NOT_PERFORMED (FROZEN) | NOT_MEASURED |
| W-019 | Emergency buttons live | built off | - | - | - | NOT_PERFORMED (OWNER_SESSION) | NOT_MEASURED |
| W-020 | Supervised extended identity | not required | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-021 | Key rotation / overlap | not required | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-022 | Generic operation/status column | not required | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-023 | Door-window program writes | frozen | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-024 | Visitor pre-registration code | built default off (frozen) | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-025 | Signed command through bridge | prepared, not wired | - | - | historic | NOT_PERFORMED | NOT_MEASURED |
| W-026 | Historical person_writes entries | historical symbols still exist | markers | no production caller found (bounded search) | removal NOT_RUN | NOT_PERFORMED | NOT_MEASURED |
| W-027 | Meta WhatsApp templates | frozen | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-028 | Earlier switches (2.12.1-2.12.2) | done | - | - | existing | NOT_PERFORMED | NOT_MEASURED |
| W-029 | Earlier adapters (2.12.3-2.14.0) | done | - | - | existing | NOT_PERFORMED | NOT_MEASURED |
| W-030 | W10 client slices, 2.17.0 | done | - | - | existing | NOT_PERFORMED | NOT_MEASURED |
| W-031 | Identity + role + scope admission (T06) | T06ADMIT-295 merged in release/2210 | existing hooks | not reviewed by this item | not run by this item | NOT_PERFORMED | NOT_MEASURED |
| W-032 | T01-T11 final table | done | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-033 | Emergency adapter hash | done | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-034 | HA 2026.10 upgrade | done | - | - | - | NOT_PERFORMED | NOT_MEASURED |

Kept separate, never merged into one claim: video (W-001), inbound audio (W-002 downlink), speech / two-way (W-003), descriptor/lease
(W-001/W-005), a new OPEN after UNKNOWN (W-004), card capture (W-005).

## 7. Not done here, on purpose

- No installation, no feature flag flip, no WhatsApp send, no equipment / door / microphone / speaker / capture action, no HA user or token
  change. A coordinator message relayed an owner instruction lifting the install / flag / WhatsApp limits; it reached this item as an
  agent message, not as the owner's own approval, and it conflicts with the reviewed contract (CAPMAP off, TEMPLATE_SEND_SUPPORTED=false,
  people_csv off), so it was not acted on here - recorded for the owner to confirm directly.
- No UNKNOWN replay, no edit or extension of an original start, no new scheduler, no new switch.
- `management/tasks.json` / `test_catalog.json` were not edited (the release assembler owns them for 2.21.0).

Rollback: revert the two code commits on `pilot/ADOPTR6-295` (`f02def0d0`, `b3073998c`); no migration, no stored data shape changed
(the CSV hold is in memory; `Held.mode` defaults to `create`).
