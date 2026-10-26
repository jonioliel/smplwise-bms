# WKCLOSE-295 - closeout of the Arx side of the WisKey live-stream / talk work (reply to the WisKey/Mac closeout prompt of 26.10.2026)

Status: documentation + ONE new test module on top of `origin/main` @ `7b2ff4a4740fcb68627709f955b69298036d71e6` (tag `v2.21.1`).
Nothing installed, nothing enabled, no equipment touched, no WisKey / Home Assistant / station / door / provider reached. No product code changed.
Owner-facing translation (Hebrew) is the lead's; the full 34-row table and the machine appendix are private files, not in Git.

## 1. Identities (verified with git on 26.10.2026)

| what | value |
|---|---|
| closeout branch | `pilot/WKCLOSE-295`, cut from `origin/main` `7b2ff4a47`; delta vs main = `tests/test_wkclose_295.py` + this document |
| tests run on | `a05b7286256d757bc10e61cb2a95f60ba17f993a` (the commit that adds the test module; the later commits of this branch change `docs/` only - `git diff --name-only a05b72862 <head>`) |
| integrated Arx source with the WisKey adoption | `main` = tag `v2.21.1` = `7b2ff4a4740fcb68627709f955b69298036d71e6` (tag message: "gate2 pass 26.10 (full b82ad4518 + targeted rerun 7b2ff4a47)"; `v2.21.0` is the same combined line) |
| Windows review source (historical) | `pilot/WK4ADOPT-295` @ `002eec7b90e42cc52384e783800d1ca698895b27`; WR6-01 fix `80e3eed68b6fd929a6b819976e4a0430ac88efd4` (head of that branch) |
| adoption merges (all ancestors of main) | WK4ADOPT `24270307d308416256096a66619058be33ac1c96`, WKR5ADOPT (`f97862b8f775cc28d5a7ec0409428a11fe350027`) `be78c9cd259719a6478095cb231ef80c1d4cb0ef`, PEERQUERY `7cf56a569ad1f499670ec41d1d2c9d34761316f0`, CAPEMERGENCY `947dc25ff2f45c48ea5391ef677fa2f04951d70d`, CAPEMERGENCY2 `28992f95ac3cef6c7681e544acd6402460369de6`, W031 `d98c0e47b4a5f5fcad2932beb45490ee0314902b`, ADOPTR6 (`b3073998c58b6d77e3d1fa30e8aa667634ad9e1b` + receipt `2eb5fe8643b1d11f444a4f473f22e287cd18e69b`) `49ecb70f807e3e3b5b4d53ccd210030d86123eb1`, person-write cleanup `8b7657e3aa15a9bfc61e9f8e809c04770ce0a518` |
| next line (not the subject) | `release/2220` (under the lead's gate; contains main). Its only WisKey-adjacent product change is the new TPLV2-295 flow (`wa_template_v2_contract.py`, `wa_template_v2_flow.py`; OFF by default, fake only); it changes none of the WisKey files listed in section 4 |
| Mac delivery / CODE | commit `e25e1e92a9e92f7d2ae7623985c5a9977e0690cb`, product CODE `6a8a0a2cf0818c737ee6fcd3eb0a6ca530b06e8f` (WisKey repository; NOT vendored in Arx - the pairing is by CODE, there is no wire field naming it). Arx's contract base remains `9135a048c4ea605eaaa212dd42f4475580edca75` + `station-talk-audio-v1.patch` (delta sha256 `be2c1c05db06bdbb084e27bc7caaf80f2750e45bd50cb5f4c37f3ae4cd2b6d12`) |
| build / artifact / installed environment / go2rtc | NOT_IDENTIFIED. A source identity is not a build, an installed artifact or a live measurement |

The ADOPTR6 receipt (`ADOPTR6-295-ADOPTION-RECEIPT.md`) listed `release/2210` as the base and W-026 / W-031 as "not reviewed / historical symbols still exist". Both are
superseded on main: W-031 (`pilot/W031-295`) and the person-write cleanup are merged (section 6); everything else in that receipt was re-verified here at main.

## 2. B - W-002 / WMR6-HA-01: what the candidate's HA path actually is

Source facts (file + symbol + hash at main in the private appendix):
- `WiskeyBridgeTalkChannel.open` calls `self.provider.media.connect(PURPOSE_TALK)`. On the HA fallback (`AutoTransport` -> `SignedBridgeTransport.connect`) that
  call opens `ha_connector(...)` -> `HaWsConnection.open` -> `ha_client.ws_session`, i.e. ONE NEW Home Assistant WebSocket per talk. The talk's socket is dedicated to
  that talk and owned by Arx (the Arx service identity); no other talk, no video link and no other owner uses it. (The shared video link is a different object.)
- Nothing on that socket tells Arx that a pairing was revoked. `HaWsConnection._on_frame` hands over `event` frames only; `_mark_closed` runs on socket / session end.
  Bound today: the router's own session deadline (`_pump.watch`, polls every second), an explicit stop, the lease (revoke of the Arx user), a dropped socket.
- The only terminal Arx can consume WITHOUT any Arx change and WITHOUT a new wire field is WisKey's existing `media/talk_closed` event on the talk's own subscription.

Receipts (fakes; `tests/test_wkclose_295.py`, 5 PASS on `a05b72862`): (1) two talks = two distinct HA sockets, closing one closes only its socket, the other owner's
talk / socket / waiter is untouched; (2) the gap as delivered - the talk is ended silently with the socket still open: the waiter stays open, ends only at Arx's own
deadline (`expired`), one `talk_close` for the original ref, no replay, no renewal, bystander untouched; (3) the existing `media/talk_closed` frame (reasons
`access_lost`, `idle_timeout`, `expired`) ends the original waiter with no Arx change, Arx signs nothing more for the ref and closes only its own socket.

Proposal for the Mac decision (NOT a closure condition, NOT implemented): on a pairing revoke with the HA socket still open, WisKey sends the already existing
`media/talk_closed` (reason `access_lost`) for the original `talk_ref` ONLY on the subscription of the talk_open request that created it, and does not publish to any other
subscription, does not close the ActiveConnection, does not touch another owner and renews no authority. Whether an event to the connection that opened the talk
counts as "an event to the revoked identity" is Mac's call; if it does, the only remaining Arx bound is its own deadline (documented above). Ownership split: Mac -
the terminal decision and the native HA-wire test; Arx - the consumer (already accepts it, test 3) and the HA-wire test on the agreed frame.

Genuine fixed Mac CODE: the three original consumer tests (`test_wk4adopt_295.py::test_wr4_01_*`) were re-run on the real Arx CODE with fresh receipts (PASS), but their
WisKey side is Arx's own duplicate (`Rev2Station`, the fixed rule modelled). Running them against the genuine Mac native at `6a8a0a2c` is BLOCKED in Arx's environment: the Mac
product imports Home Assistant (`homeassistant.const`, `.core`, `.config_entries`) and the Mac runs used Python 3.14.2, Home Assistant 2026.9.4, pytest 9.0.3,
pytest-homeassistant-custom-component 0.13.367; the Arx runner is Python 3.12.3 with none of them, and creating that environment is a dependency installation (the Mac's
`requirements-ha-test.txt` is marked "Arx approval/runtime gate pending"). The consumer bytes that Mac's own M1-TERMINAL-02 / M1-ORIGIN-FENCES-03 runs used are byte-identical
to main (hash table in the appendix). Joint option, no install by Arx: the Mac runs its own `tools/run_reply6_native.py` with the Arx tree exported from the final candidate SHA.

## 3. C - W-001 / WMR6-DOWNLINK-02 (explicit close and admission before publish)

Unchanged since ADOPTR6 and verified at main (spans identical, line numbers moved by W031's edit elsewhere in the file):
- talk: `routers/intercom_media.py::_pump` `from_station` awaits `lease.confirm()` (fail closed), then with no await checks the session expiry, `stop_requested` and
  `lease.should_stop()` before EVERY `send_bytes`; a revoke / expiry returns, the tasks are cancelled and `downlink.close("ended")` (fence + drain + join the producer) runs in the
  `finally`, joined before `_pump` returns; `talk_ws` then calls `channel.close(outcome)`.
- listen: `routers/intercom_listen.py::_pump` runs the same four checks before every frame, tail included; `listen_ws` calls the channel's explicit `close(outcome)` with the real reason.
- a natural `_end` keeps the admitted tail only while the admission still holds; it is not a security fence.
Receipts (fakes, Starlette TestClient for the listen socket): `test_adoptr6_295.py` 25 PASS and the talk / listen suites 114 PASS on `a05b72862`.
Not claimed: full ASGI (W-016); the real listen-only downlink is still `downlink_pending` (`WiskeyDownlinkChannel`), and audio inside a talk is not proof of it.

## 4. D - W-010 / WR6-01 and the direct_join overlap

`LiveResolveTransport.read` @ `002eec7b` (file sha256 `8945d22c...`) returned `self.receipts[-1]`; a later `resolve_parameters` refusal before dispatch could therefore carry the
receipt of an EARLIER read. At main (file `94631365...`) `_once` returns the receipt of THIS call (a local refusal has none), `read` returns it, history still records real calls.
Before/after receipt on the runner (JUnit kept privately): the five WR6-01 tests (`test_adoptr6_295.py` x4, `test_wk4adopt_295.py` x1) run against `002eec7b`'s `wiskey_intents.py`
dropped into the same tree: 5 FAIL / 0 ERROR / 0 SKIP; against main's file: PASS (inside the 25 and 44 above). Verdict stays `unknown`; no replay or false-commit claim.
`wiskey_direct_join.py`: WK4ADOPT's version (`657f1241...`) = base + 9 additive lines; WKR5ADOPT's version (`bb3d1e5f...`) = base +208 / -23 lines; the merge (`9d10f06d...`) = WKR5ADOPT +
the 9 lines; ADOPTR6 added the two selection points (main `756d96b0...`). Reader / selection in the existing scope: `peer_query` -> `_installed_port` (join capture port while
`DirectJoin.selected`), `DirectJoin.registry_or_none` / `resolve_or_none` (only while their command is selected). No product caller of the resolve read exists (the UNKNOWN recovery caller
is not built; no scheduler or switch added). A real peer binding is the owner's / WisKey's allocation.

## 5. E - remaining existing work

- W-006 people_csv: the reader was adapted to the nine M3 answers in ADOPTR6 and is byte-identical at main (`wiskey_people_csv.py` `0f55bfaf...`); switch `access.people_csv_preview` OFF.
  Suites `test_wkr5_csv_295.py` + `test_bulkpeople_295.py`: 48 PASS.
- W-005 card capture: the seven-action map, protocol + DTO9 and the non-null `binding_revision` refusal are unchanged (`MAC_TABLE`, `DTO9_KEYS`, `project_dto9` hashes identical to 002eec7b),
  `MAPPING_ENABLED = False`, no transport chosen. W-013 template v2: `wire` / `wire_problem_v2` / `read_v2` byte-identical, `TEMPLATE_SEND_SUPPORTED = False`.
  Suites `test_wkcap_295.py` + `test_wkcapwire_295.py`: 79 PASS. Card capture is not a camera snapshot.
- W-004: unit E, WKOPENUNK, EMROLE and CAPEMERGENCY(2) are on main; the emergency / admission group is 133 PASS + 3 XFAIL (the XFAILs are W-031 findings 3, 4, 5, below).
- W-026: DONE on main (cleanup `8b7657e3a`): the historical names appear only in comments, in `tests/test_pwclean_295.py` (PASS) and in docs. This corrects the ADOPTR6 receipt.
- W-031: three gaps fixed (`c58ce5493`, `42eddc46a`, `2df090d09`); findings 3 (the signing session has no command allow-list - design, "no new gate"), 4 (`ArxDecision` is not bound to permission / targets - no caller),
  5 (`TemplateSender` carries no actor - no caller on main) stay documented strict/non-strict XFAILs. `release/2220` adds a route that calls `send_v2` (TPLV2-295); the 2.22 gate should re-check finding 5.

## 6. Receipts - runner, targeted, NOT a gate, NOT full ASGI (Ubuntu runner, Python 3.12.3, pytest 9.1.1, fastapi 0.141.1, starlette 1.7.0, websockets 15.0.1)

Command per group: `~/run_remote.sh backend pilot/WKCLOSE-295 <files> -rA --junitxml=...` (`-o addopts="" -q -p no:cacheprovider`), checked-out SHA `a05b7286256d757bc10e61cb2a95f60ba17f993a`,
2026-10-26T10:14:59Z .. 10:26:34Z. Counts per group, never summed; ERROR = 0, TIMEOUT = 0 in every group.

| group | files | exit | PASS | FAIL | ERROR | SKIP | XFAIL |
|---|---|---|---|---|---|---|---|
| g1 | test_wkclose_295 | 0 | 5 | 0 | 0 | 0 | 0 |
| g2 | test_wk4adopt_295 (three WR4-01 consumer tests, WR6-01) | 0 | 44 | 0 | 0 | 0 | 0 |
| g3 | test_adoptr6_295 | 0 | 25 | 0 | 0 | 0 | 0 |
| g4 | test_wkaudin_295, test_wkf01f02_295, test_wiskey_media_v11 | 0 | 114 | 0 | 0 | 0 | 0 |
| g5 | test_wkjoin_295, test_peerquery_295, test_wkdirect_295, test_wkr5_295, test_wkr5_295_bdg, test_pwclean_295, test_wkadapt_resolve_295 | 0 | 233 | 0 | 0 | 0 | 0 |
| g6 | test_wkr5_csv_295, test_bulkpeople_295 | 0 | 48 | 0 | 0 | 0 | 0 |
| g7 | test_wkcap_295, test_wkcapwire_295 | 0 | 79 | 0 | 0 | 0 | 0 |
| g8 | test_wkr5_295_emergency, test_wkr5_295_writer, test_capemergency_295, test_capemergency2_295, test_door_emergency_roles_emrole_295, test_w031_295, test_t06_admission_295 | 0 | 133 | 0 | 0 | 0 | 3 |
| g9 | test_wkvec_295, test_wkb3_295, test_wkwrite_295, test_wkpeer_295, test_wkaudin_295 (test_wkaudin also in g4) | 0 | 318 | 0 | 0 | 0 | 0 |
| before | WR6-01 tests with `002eec7b` `wiskey_intents.py` | 1 | 0 | 5 | 0 | 0 | 0 |

Disclosure: the release gate for `release/2220` started on the shared runner at about 10:15:31Z (marker `~/.gate-pending`, created 30 s after g1 started); groups g2-g9 ran while
it was active (load average about 27 at 10:26Z). The runs were small pytest invocations in their own worktree (`~/work/pilot-WKCLOSE-295`, left in place, no gate files touched); any timing-sensitive
gate test that went red in that window should be re-checked before it is blamed on the product.

## 7. NOT_RUN / not claimed

- Full ASGI (W-016). Exact command, run only on the runner when it is free, no gate lock is held and the owner says go:
  `bash scripts/gate/asgi_wiskey_run.sh <full 40-hex Arx SHA of the integrated candidate> --wiskey-code 6a8a0a2cf0818c737ee6fcd3eb0a6ca530b06e8f [--wiskey-delta-sha256 <hex>] [--timeout 1800]`
  on the runner with `~/smplwisebms/.venv` (Python 3.12.3). It runs `tests/test_asgi_wiskey_295.py` only and writes IDENTITY.json / junit.xml / pytest.log / PROCESS.txt / SUMMARY.* under
  `~/smplwise-results/asgi-wiskey/<UTC>_<sha12>/`. This work did not run it. Whether the 2.21.1 release gate collected that module was not inspected and is not W-016 acceptance.
- The three consumer tests against the genuine fixed Mac native (BLOCKED_ENV, section 2), an HA-wire test on an AGREED terminal frame (nothing agreed yet), S8 and every live item,
  installation, the whole backend suite, the frontend.
- The five missing early runs, the 491 local runs and the WK4ADOPT raw receipts stay NOT_AVAILABLE and were not reconstructed.
