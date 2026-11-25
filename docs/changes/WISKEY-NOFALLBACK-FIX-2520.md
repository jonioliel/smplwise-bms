# WISKEY-NOFALLBACK-FIX-2520 - no classic people write after a v2 refusal at connect / discovery (WB-01), self-healing discovery (WB-03)

Branch `pilot/WISKEY-NOFALLBACK-FIX-2520`, cut from `origin/release/2520-train` (`189ec3f4a`). Target version: 2.52.
Source: deep review 2.52, area WISKEY-BRIDGE (`docs/review/DEEP-REVIEW-2520-WISKEY-BRIDGE.md` on `origin/review/DEEP-2520-WISKEY-BRIDGE`,
`1f8045720`), findings **WB-01** (high, latent: v2 only) and **WB-03** (medium). Rule: WisKey rc19 / rc20 R2 `transports.selection`
("never downgrade or switch transport automatically after refusal or UNKNOWN"), `transport_authentication.fallback_after_key_refusal:
false`, and the lead / owner decision of 25.11 (WISKEY-R8-2520 Q3: final on v2, v1 / rc10 unchanged).
Status: implemented and unit-tested against in-memory fakes only. No lab, no Home Assistant, no WisKey contact, nothing installed.

## 1. What was wrong

- **WB-01.** `people_send` asked `join.selected(command)`, and `connect_ready` turned every failure into `False` - including a v2 connect
  refusal (`direct_v2_refused:<code>`, made a line earlier by `link()`) and a v2 discovery / pairing refusal (`pairing_mismatch`,
  `direct_v2_refused:discovery_refused:...`, ...). `None` ("not selected") made the people route send its own Home Assistant write, audited
  `transport=classic, transport_reason=wiskey_direct_not_connected`. `fallback_permitted` and `V2_NO_FALLBACK` were consulted only after a
  selected write, so the far more likely place of a key / pairing refusal - the connect and the discovery of a new connection - never
  reached them; and for the 60 s back-off after it, every write went classic without any direct attempt.
- **WB-03.** `DirectDiscovery._fail` latched `failed_ref = connection_ref`: `refresh` returned at once for it, `discovery_due()` answered
  False, nothing closed the link. One discovery timeout (6 s) of `direct/time` or `direct/pairing_status_v2`, or a first discovery while
  WisKey was still loading, switched the direct path off until the socket dropped for another reason (possibly days) - people writes
  classic (v1) or (v2, after this fix) refused, the emergency engine and the door automation sender `transport_not_selected`.

## 2. What changed

| file | change |
|---|---|
| `smplwise_vms/backend/smplwise/services/wiskey_direct_join.py` | `DirectJoin.v2_refusal(command)` - THE decision point (no I/O beyond the cached key read, never raises): with a v2 key (`v2_key()`: `protocol_for_key` of the transport's own key provider; else the latest attempt / the open link), the code that keeps the direct path from being selected now when it is a v2 refusal - prefixed `direct_v2_refused:` or one of `V2_NO_FALLBACK`; otherwise None. `DirectCommandSession.selection_refusal(command)`: like `transport_refusal`, but while no socket is open it returns the latest connect attempt's own code (`last_error`). `people_send`: when the join is installed, has a lineage and is configured but not selected, and `v2_refusal` answers, it returns a send that raises `intercom_sync.NotSent(<code>)` and records `transport=wiskey_direct, transport_reason=<code>, direct_state=not_sent, direct_code=<code>` - the route's classic send is never called. Otherwise `None` exactly as before. `connect_ready`: a v2 connect whose wait ended first (outcome unknown, cancelled; `link()` recorded nothing) is kept as `direct_v2_refused:connect_unknown` (R2: no switch after UNKNOWN either); v1 unchanged. `discovery_due()`: a connection whose discovery failed is due again once its back-off ended (WB-03). `people_path()`: `{path: "refused", reason: <code>}` in that case (v2 only; the status page's `people_writes`). Module note updated. |
| `smplwise_vms/backend/smplwise/services/wiskey_direct_discovery.py` | WB-03: `FAILED_RETRY_MIN_S = 30`, `FAILED_RETRY_MAX_S = TIME_RECHECK_S (600)`; `failed_at`, `failures` (consecutive on the same connection), `retry_after_s()` (30 s doubling per consecutive failure, at most 600 s), `retry_due(ref)`. `refresh` asks a failed connection again only once its back-off ended; a successful (re-)read clears the failure; `forget()` clears it too. Until then the failure stays the connection's `transport_refusal` (on v2 prefixed by the join, so it refuses people writes rather than re-routing them). A new connection is asked at once, as before. Discovery reads are reads - nothing is replayed. |
| `smplwise_vms/backend/tests/test_wiskey_nofallback_2520.py` (new) | 19 tests, below. |

Not changed: `routers/access_control_people.py` (its `native is None -> classic` branch stays right: a v2 refusal no longer returns None;
the router already sets `transport=wiskey_direct` for a returned send, the send adds the rest of the audit fields), `fallback_permitted`,
`V2_NO_FALLBACK`, the R8 after-the-write rule, `wiskey_media_bridge.py`, the bridge, the emergency engine, the door automation sender.
No setting, no migration, no route, no wire model, no UI. Rollback: revert.

### What is a v2 refusal here, and what is not (unchanged path)

| with a v2 (rotated) key | people write |
|---|---|
| connect / hello / identity / reply refusal (`direct_v2_refused:direct_connect_refused`, `..:direct_hello_invalid`, `..:direct_kid_mismatch`, `..:reply_unauthenticated`, `..:pairing_ambiguous`, ...) - and the 60 s back-off after it | refused `not_sent <code>`, never classic |
| connect wait ended with no answer (`direct_v2_refused:connect_unknown`) | refused |
| discovery refusal or failure on the v2 connection (`direct_v2_refused:discovery_refused:*`, `..:discovery_unknown:*`, `..:capabilities_invalid`, `..:transport_auth_mismatch`, ...), pairing refusal (`pairing_mismatch`, `pairing_unverified`, `pairing_stale`, `pairing_status_invalid`) | refused until a re-read after the back-off succeeds |
| socket unreachable (`direct_unreachable`), not yet tried, join stopping, the command not listed by discovery (`command_not_discovered`), Arx's clock window not admitted (`clock_skew`, `ttl_exceeds_server_max`) | existing path, as before (none is a refusal of a v2 attempt; see open question 1) |
| provider `local` (join not configured) | existing path, as before |

With a v1 key (pairing secret / `g0-legacy`; WisKey rc10, the lab) nothing of the table applies: `v2_refusal` is always None and every
"not selected" keeps the existing path byte for byte, including R8's classic fallback for the three "cannot carry" codes.

### Emergency engine and door automation sender (documented, unchanged, now tested)

Both have no classic path. `door_engine_live.LiveEmergencyEngine` and `wiskey_auto_door.NativeDoorSender` need `selected("features/start")`
(through `features_or_none`); after a v2 connect refusal they answer `not_sent transport_not_selected` and nothing reaches WisKey; the
emergency OPEN control stays offered (`open_supported` = configured), the attempt itself is what is refused. WB-03 is what changes for
them: a single failed discovery no longer keeps them `transport_not_selected` for the socket's life - the connection is re-read after
the back-off (30 s first).

### One v1 behaviour change (WB-03, intended)

WB-03 is not v2-only: on v1 too, a connection whose discovery failed is now asked again after the back-off instead of never. Before the
re-read the v1 path is exactly as before (not selected -> classic). The existing pin "asked once on this connection, not on every
selection" (`test_wkr5_295::test_a_wiskey_without_discovery_is_not_selected_and_nothing_else_is_written`) still holds inside the back-off
and passes untouched.

## 3. Tests (real results)

PC only, one pytest process per file, main checkout venv (`C:\cloude\smplwisebms\.venv`) importing this worktree's `smplwise`
(verified), in `smplwise_vms/backend`.

| command | exit | result |
|---|---|---|
| `python -m pytest -rA tests/test_wiskey_nofallback_2520.py` | 0 | **19 passed** |
| the same file with the two service files reverted to the base (stash) | 1 | 14 failed, 5 passed - the 5 that pass pin behaviour that must not change (v1 discovery refusal, command not listed, provider `local`, emergency engine, door automation sender) |
| `python -m pytest -q tests/<file>.py` for each of: `test_wiskey_direct_v2_2520`, `test_wiskey_join_live_2382`, `test_wiskey_service_grants_v3_2520`, `test_wkr5_295`, `test_wkjoin_295`, `test_door_engine_live_2310`, `test_wiskey_owner26_callers_297`, `test_wiskey_talk_caps_2382`, `test_wiskey_pairing_2382`, `test_wkdirect_295`, `test_wkr5_295_writer`, `test_externalbuild_297`, `test_bridge_stale_discovery_2383`, `test_intercom_writes_s11` (all untouched) | 0 for all 14 | all passed; per-file counts were not captured (the repo's pytest `-q` addopts swallowed the summary line in that loop) |
| `py -3.12 -m ruff check` on the two changed modules + the new test file | 0 | all checks passed |
| runner (slot B), full backend suite, Playwright | - | **NOT_RUN** (backend-only row with no UI; the train gate runs the full suites) |
| real WisKey / bridge / lab | - | **NOT_RUN** by rule. The lab is v1 (rc10), where nothing in WB-01 applies; v2 stays dormant while rotation is blocked with WisKey installed. |

## 4. Open questions (recommendation first)

1. A v2 key whose socket is merely unreachable / not yet tried, or whose discovery does not list the command, keeps the classic people
   write. a) keep: only a refusal (or UNKNOWN) of a v2 attempt is final - the reviewer's suggested scope and the row's rule
   (recommended) b) strict: with a v2 key there is no classic people write at all while the join is installed (the reviewer's
   "simplest, strictest" variant; an unreachable WisKey then refuses every people write).
2. The same root in two other selectors named by the review (not in this row's file list): the grant engine's `access_service_writer.
   select_path` (R8's file) answers `service_channel / direct_not_selected`, and `SelectingLeaseTransport._pick` hands the capture lease to
   the bridge transport. a) a follow-up row that routes both through `DirectJoin.v2_refusal` (refuse instead of switching) before the
   rotation block is lifted (recommended; today both are dormant: the service-write journal is not wired and `capture_lease.
   GO_LIVE_PERMITTED` is False) b) leave them.
3. The emergency engine / door automation keep the code `transport_not_selected` after a v2 refusal (their Hebrew text exists for it).
   a) keep (recommended; fail closed, the v2 code is visible on the bridge-key status and `people_writes`) b) pass the v2 code through
   (needs new user texts).
4. WB-03 back-off: re-read on the same socket (30 s doubling to 600 s) rather than closing the socket. a) keep - a close could cut a
   request in flight on the same socket into UNKNOWN (recommended) b) close the link on a transport-level discovery failure so it
   reconnects after the 60 s connect back-off.
