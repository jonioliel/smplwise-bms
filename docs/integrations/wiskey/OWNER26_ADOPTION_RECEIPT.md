# WisKey owner26 adoption receipt (WISKEY-OWNER26-297)

One receipt for the owner: what Arx adopted from the WisKey Mac delivery of 2026-10-26 (reviewed by Windows), on which exact source, what
was actually run, all 34 master rows in six separate states, the leftovers and the questions. Plan: `OWNER26_ADOPTION_PLAN.md`.

## 1. Identity (Q1)

| Item | Value |
|---|---|
| Arx base | `origin/main` `1b0ddd85c` (v2.23.2); reviewed base was `011c97d4d` - none of the 13 touched paths or 8 caller files changed in between |
| Branch | `pilot/WISKEY-OWNER26-297` (not merged, not released, no tag) |
| Combined full SHA | `271565d281abe6d8a71b05185034c26e22991393` (code under test; the receipt commit on top changes docs only) |
| WisKey sources (read only, no checkout) | review `2ab94af2bcf6e20ec7028421aefeefb4c84e9723`, Mac delivery `772c53961920e8e93657ecb60cb851ad05d770ea`, product CODE `e732562e232d9f606632960b75887e0bdc82cfc0` |
| Patch 1 `owner26-ha-scoped-terminal.patch` | sha256 `bf69f8df2868542282575996d20df60debb9f82700ae2f479a884cf3da337403`, commit `63e81463c` |
| Patch 2 `owner26-independent-listen.patch` | sha256 `95686d771be62b74314e1616fe106cd0cc16be9bfcb5d53b6025b7e18fba0bac`, commit `5f21e8a71` |
| Patch 3 `owner26-signed-native-metadata-feed.patch` | sha256 `7f4711e7b203ca4bba5f014afc74bc1bcf6de359263e6610d0a1cff2654bbee0`, commit `f6cd06733` |
| Caller wiring | commits `b9cc051fa`, `271565d28` (+ receipt commit, docs only) |

### File before / after (patches applied byte-for-byte; every after-hash equals the delivery's expected hash)

| Path | Before (= pinned before) | After patches (= expected) | After caller wiring |
|---|---|---|---|
| `docs/changes/T06-ADMISSION-MAPPING-295.md` | `22735bfd…` | `f9cfd152…` | changed (addendum) |
| `routers/intercom_listen.py` | `2243732c…` | `eb6ef0e8…` | unchanged |
| `services/ha_client.py` | `a260f457…` | `7ab65675…` | unchanged |
| `services/intercom_media.py` | `b845c5f0…` | `1895b103…` | unchanged |
| `services/intercom_sync.py` | `fccdeb18…` | `74f0a500…` | unchanged |
| `services/wiskey_listen_adapter.py` | `b69dc502…` | `88242820…` | unchanged |
| `services/wiskey_media_bridge.py` | `7c8181d6…` | `945bb99d…` | unchanged |
| `services/wiskey_native_feed.py` | (new) | `310dfa67…` | unchanged |
| `tests/test_asgi_wiskey_295.py` | `f89c87f2…` | `5f2bc8be…` | unchanged |
| `tests/test_mac_native_feed.py` | (new) | `363712cf…` | unchanged |
| `tests/test_t06_admission_295.py` | `d8852dfa…` | `2d0ee5f5…` | changed (3 rows, inventory, caller pin) |
| `tests/test_wk4adopt_295.py` | `4e5ad002…` | `4736129e…` | unchanged |
| `tests/test_wkaudin_295.py` | `dcb7db47…` | `7b77fda9…` | unchanged |

The key symbols the forward names are untouched by the caller wiring: `wiskey_listen_adapter.WiskeyDownlinkChannel` (file `88242820…`)
and the scoped HA terminal (`wiskey_media_bridge._HaMediaChannel`, `HaWsConnection._on_frame`, `ha_client` reader branch for
`media_subscription_closed`).

### Caller wiring (Q2) - new / changed files

| File | What |
|---|---|
| `services/wiskey_auto_door.py` (new) | auto: `NativeDoorSender` -> `features/start` `door_automations` |
| `services/door_automation.py` | `LiveSender` = the Native sender (was: refuse `live_transport_not_built`) |
| `services/wiskey_program_direct.py` (new) | program: `technical_program_list/save/action` on the selected direct connection |
| `services/door_windows_engine.py` | `WiskeyProgramEngine` delegates to it (was: `not_implemented`) |
| `services/wiskey_direct_join.py` | card: `mapped_card_transport` puts the CAPMAP DTO9 pre-flight in front of `DirectLeaseTransport` |
| `tests/test_wiskey_owner26_callers_297.py` (new) | the four callers on fakes |
| `tests/test_door_automation_295.py` | the `LiveSender` assertion follows the new sender |

## 2. The four original callers (Q2) - exact state

No go-live / activation constant was changed: `door_automation.GO_LIVE_PERMITTED = False`, `door_windows_engine.LIVE_ENGINE_BUILT = False`,
`wiskey_capture_map.MAPPING_ENABLED = False`, `capture_lease.GO_LIVE_PERMITTED = False`, `intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED = False`
(pinned by `test_no_activation_constant_is_flipped_by_this_adoption`).

| Caller | Original caller -> Native API | Actor / policy / revision / target | Selected in this build? | Software receipt |
|---|---|---|---|---|
| auto (W-018) | `door_automation._fire_door` -> `LiveSender` -> `features/start` feature `door_automations`, then `features/result` | actor = automation: `automation_id` = block id, `run_id` = the fire's door request id, `trigger_id` = matched `last_triggered`, creator = `created_by`, approver = `armed_by`, `grant_revision` = `authority_revision` = block policy revision; policy judged for creator AND approver (`door/pulse` = `access.doors.open` on the station); target = station + physical relay + `mapping_revision` of the confirmed relay map; `expiry` = the fire's `not_after` | No: `GO_LIVE_PERMITTED` False -> `feature_off` before any sender | `test_wiskey_owner26_callers_297.py` (auto group) |
| program (W-023) | door-windows routes / watchdog -> `WiskeyProgramEngine` -> `stations/technical_program_list / _save / _action(pause)` | human admitted by the route (`access.windows.manage`, station chain) before the engine; wire = pairing signature; `door` = physical relay; `revision` = CAS revision (`revision_conflict` mapped) | No: `LIVE_ENGINE_BUILT` False -> the factory hands out the tier-D `PreparedEngine` | program group |
| template (W-013) | `POST /access-control/people/{id}/messages/template-v2` -> `wa_template_send.send_v2` -> `TRANSPORT_V2_PROVIDER` -> `DirectJoin.template_v2_or_none` -> `whatsapp/template_send_v2` | route gate `base._gate` (people/message permission, station chain), attempt recorded before send; wire carries no actor (T06 finding 5 stays) | No: `TEMPLATE_SEND_SUPPORTED` False | already wired by TPLV2-295 (2.22.0); pinned by `test_the_template_caller_is_the_installed_v2_provider` |
| card (W-005) | capture routes / lease worker -> `lease_events.TRANSPORT` = `SelectingLeaseTransport` -> (direct) `MappedLeaseTransport` DTO9 pre-flight -> `DirectLeaseTransport` -> `capture/lease_request | lease_event` | actor / person_revision / permission_revision stay inside the signed lease (Mac's W-005 table); announced commands = this connection's discovery | No: `capture_lease.GO_LIVE_PERMITTED` False and `MAPPING_ENABLED` False (the direct path stays the plain `DirectLeaseTransport` as before; the route itself cannot be switched on) | card group |

## 3. What was run (Q3) - this branch only, nothing summed with WisKey receipts

All runs below are on the Ubuntu runner (Python of `~/smplwisebms/.venv`, Node v24.21.0), fakes only: no WisKey, Home Assistant, station,
reader, door or network. Not the release gate. Counts are per run and are never added to each other or to WisKey's receipts.

| Run | Code SHA | What | Result |
|---|---|---|---|
| A | `b9cc051fa` | targeted backend: 25 files (owner26 callers, mac_native_feed, t06, wk4adopt, wkaudin, asgi_wiskey, door_automation, capmap, doorwin watch/api/review2, f3a dw03/dw05, door_emergency, smallfixa switches, w031, wkjoin, wkdirect, wkcap, wkr5 bdg, tplv2, wkf01f02, intercom_media, wiskey_media_v11, wiskey_channels) | 783 passed, 2 skipped, 3 xfailed, **3 failed** (19 min) |
| B | `271565d28` | targeted rerun after the fix: the 3 failing files + callers, t06, door_automation, mac_native_feed, wk4adopt, wkaudin (9 files) | **397 passed, 3 xfailed, 0 failed** (7 min) |
| C | `271565d28` | `npm run build:addon` (tsc + vite, www and www-public) | exit 0; the rebuilt `smplwise_vms/www` + `www-public` are identical to the committed files (0 differences, 155 files, tree hash `2e33f68f5a4eef432090e6bf6d07ab521062fe35653945083c486e09692f0614`) |
| D | `b9cc051fa` | full backend suite (2 shards) | **NOT_RUN**: started, stopped by me at ~5% after 30 min (runner load ~40 from other work); replaced by A |

Run A failures and what was done (none was a WisKey patch defect):
1. `test_wkjoin_295::test_installed_join_selects_direct_only_while_the_socket_authenticates` and `test_capmap_295::test_the_go_live_permit_and_the_lease_route_are_untouched`:
   my first card wiring put the DTO9 pre-flight in front of the direct path unconditionally, so with `MAPPING_ENABLED` False every direct
   capture call was refused. Fixed in `271565d28`: the pre-flight is used only while the mapping is enabled; otherwise the plain direct
   transport, as before. The capmap pin now says "wired, gated".
2. `test_wiskey_media_v11::test_ha_ws_connection_asks_who_it_is_routes_events_and_closes`: patch 1 (HA-scoped terminal) deliberately stops
   handing a `media/talk_closed` of a subscription no media channel owns to the socket handler. The test (not one of the 13 delivery files)
   still expected the old routing. Updated to assert the adopted behaviour, plus the channel's own routing and that
   `media_subscription_closed` ends only the channel, not the shared socket.

The 3 xfails are the documented strict T06 findings (unchanged).

Build artifact (Q3): `tar` of the add-on folder `smplwise_vms/` at `271565d28` (sorted, fixed mtime, owner 0, no `__pycache__`, no
`backend/tests`): `ow26_addon_271565d28.tar`, **66,201,600 bytes, sha256 `ae984166c2ec3299786a91d6b2f01221f5bce3fe83e51e7558833f0d6b3b8b54`**,
add-on `config.yaml` version 2.23.2. It is a build of the branch on the runner (`/tmp` there), not an installed release and not a tag.
GitHub CI is not used as evidence (billing block).

## 4. The 34 rows - six states each (Arx side after this branch)

States: **Impl** implementation / **Reg** registration / **Conn** connection / **Tests** / **Install** installation / **Live** live measurement.
"Native" = WisKey CODE e732562e as reviewed by Windows (not re-run here). Installation is NOT_PERFORMED and live is NOT_MEASURED for every
row: no live install, no physical S8, no device in this task.

| Row | Title | Impl | Reg | Conn | Tests (this branch) | Install | Live |
|---|---|---|---|---|---|---|---|
| W-001 | Live video, descriptor/lease | done (lifecycle 002eec7b in main) | single `_LEASED` registry | Arx app path unchanged | run A/B (intercom_media, wiskey_media_v11, asgi_wiskey) | NOT_PERFORMED | NOT_MEASURED (virtual only at WisKey) |
| W-002 | Incoming audio / independent listen | done: patch 1 (scoped HA terminal) + patch 2 (listen over signed `talk_open(listen=true)`, no floor/uplink) | existing talk_open/listen/talk_closed; no new wire field | listen router -> `WiskeyBridgeProvider.listen_open` -> `WiskeyDownlinkChannel` (no more `downlink_pending`); switch `access.station_listen` unchanged | run A/B (wkaudin, asgi_wiskey incl. new listen + fence-on-revoke/expiry/off) | NOT_PERFORMED | NOT_MEASURED |
| W-003 | Talk and duplex | done (unchanged) | talk_open v1.1 | signed link unchanged | run A/B (intercom_media, wiskey_media_v11, asgi_wiskey) | NOT_PERFORMED | NOT_MEASURED (acoustic) |
| W-004 | Emergency: new OPEN after UNKNOWN | done (WKOPENUNK, EMROLE, WKR5 unit E) | `wiskey_emergency_direct` path, not installed | unchanged; UNKNOWN never replayed | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-005 | Card capture lease / DTO9 | done (map + Mac column) | `MAPPING_ENABLED` False | NEW: caller goes through the DTO9 pre-flight on the direct path whenever the mapping is enabled | card group + capmap suite | NOT_PERFORMED | NOT_MEASURED |
| W-006 | people_csv preview | done, switch off | `access.people_csv_preview` off | `people_csv_or_none` | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-007 | KEY guard, two installers | WisKey side | WisKey | WisKey | not run here (WisKey receipts) | NOT_PERFORMED | NOT_MEASURED |
| W-008 | Signed vectors | done | - | - | existing suite, NOT re-run here unless listed in run A (`test_wkvec_295`) | NOT_PERFORMED | NOT_MEASURED |
| W-009 | Durable event cursor | optional, not built | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-010 | peer / registry / resolve | done (WR6-01 closed, not reopened) | `wiskey.peer_query` off + owner pin | `DirectRegistryTransport`; no recovery caller | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-011 | People writes | done | off by default | native writer via `people_send` | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-012 | Station removal verdict v2 | done | switches off | unchanged | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-013 | WhatsApp template v2 | done | `TEMPLATE_SEND_SUPPORTED` False | caller wired (TPLV2-295), unchanged here | template pin + existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED (no external send) |
| W-014 | name_ref | done | - | no product caller of rename (T06 finding 2) | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-015 | Candidate identity | this receipt (section 1) | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-016 | Full ASGI of the combined candidate | `test_asgi_wiskey_295.py` on this branch | - | real `create_app` + routers, fake WisKey/HA | run A: `test_asgi_wiskey_295.py` PASS at `b9cc051fa` (Arx ASGI with fakes; not the release qualification) | NOT_PERFORMED | NOT_MEASURED |
| W-017 | S8 / live proof | not started (owner) | - | target / go2rtc not identified | NOT_RUN | NOT_PERFORMED | NOT_MEASURED |
| W-018 | Automations that open doors | NEW: Native sender | `GO_LIVE_PERMITTED` False (owner) | NEW: caller -> `features/start door_automations` | auto group + door automation suite | NOT_PERFORMED | NOT_MEASURED |
| W-019 | Emergency buttons live enabling | built off | - | `LIVE_ENGINE_BUILT` False | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-020 | Supervised run of extended identity | not required (decision kept) | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-021 | Key rotation | not required | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-022 | Generic operation/status | not required | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-023 | Door-window program writes | NEW: Native program engine | `LIVE_ENGINE_BUILT` False (owner) | NEW: `WiskeyProgramEngine` -> `technical_program_*` | program group + door-windows suites | NOT_PERFORMED | NOT_MEASURED |
| W-024 | Visitor pre-registration | frozen, Arx side off | - | - | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-025 | wiskey-bridge-command.v1 | not required (replaced by direct) | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-026 | Historical person_writes | removed in main (not reopened) | catalog hash unchanged | no caller | existing suite, NOT re-run here unless listed in run A (`test_pwclean_295`) | NOT_PERFORMED | NOT_MEASURED |
| W-027 | Meta WhatsApp business templates | owner task | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-028 | Earlier switches / backup | done | - | - | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-029 | Earlier adapters / metadata feed | done + patch 3 (`wiskey_native_feed`, opt-in `SW_WISKEY_NATIVE_SIGNED_READS=1`, default 0) | G-NATIVE-METADATA | `intercom_sync` binds the metadata reads | run A/B (`test_mac_native_feed.py`) | NOT_PERFORMED | NOT_MEASURED |
| W-030 | W10 slices / direct connection | done + patch 1 | - | shared HA socket: terminal scoped to its own subscription | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-031 | T06 admission mapping | done + G-NATIVE-METADATA + G-DOOR-WINDOWS rows | hooks | unchanged admission; new signing caller pinned | run A/B (`test_t06_admission_295.py`) | NOT_PERFORMED | NOT_MEASURED |
| W-032 | T01-T11 table | done | - | - | - | NOT_PERFORMED | NOT_MEASURED |
| W-033 | Emergency adapter hash | done | - | - | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |
| W-034 | HA 2026.10 | done | - | - | existing suite, NOT re-run here unless listed in run A | NOT_PERFORMED | NOT_MEASURED |

### Media capabilities kept separate

| Capability | State on this branch |
|---|---|
| Video | unchanged; Arx tests only (fakes); WisKey virtual receipt not re-run |
| Incoming call audio | unchanged consumer; scoped HA terminal adopted (patch 1) |
| Independent listen | NEW: connected (patch 2); was `downlink_pending` |
| Talk / duplex / mute | unchanged |
| Descriptor / lease / cleanup | unchanged; HA shared socket no longer closed by one subscription's terminal |
| New OPEN after UNKNOWN | unchanged; no replay |
| Camera snapshot | not touched; not the same as card capture |
| Card capture | caller wired to the DTO9 pre-flight (used when the mapping is enabled); off |

## 5. Leftovers

1. **Activation (owner only)** - every caller is wired but OFF: door automations (`GO_LIVE_PERMITTED`), door-window programs
   (`LIVE_ENGINE_BUILT`), template v2 (`TEMPLATE_SEND_SUPPORTED`), card capture (`capture_lease.GO_LIVE_PERMITTED` + `MAPPING_ENABLED`),
   listen (`access.station_listen`), signed metadata reads (`SW_WISKEY_NATIVE_SIGNED_READS`, env, default 0).
2. **Merge / release** - this branch is not merged and not in a release; the lead decides the version and runs the gate.
3. **Full backend suite and full ASGI qualification of the final merged release** - NOT_RUN here (W-016 for the release itself).
4. **Live install, physical S8, real media / door / reader** - NOT_PERFORMED / NOT_MEASURED (W-017, Q4).
5. **WhatsApp external send and operational secrets** - not touched (Q5, W-027).
6. **`LIVE_ENGINE_BUILT` covers two engines** - the program engine is now wired, the W13-e `WiskeyEmergencyEngine` still answers
   `not_implemented` (the v2 `DirectEmergencyEngine` exists but is not installed). Turning the flag on would also enable the emergency switch path.
7. **T06 finding 5 (template wire has no actor)** stays open by design of the WisKey v2 contract; the route admits the person before the send.
8. **Door-automation authority gap** - the Native policy maps `door/pulse` to `access.doors.open`, but Arx lets a block be armed with
   `access.doors.automate` (or implied by `automation.manage`). A creator without `access.doors.open` makes the send `not_sent`
   (`policy_incomplete`), fail-closed.

## 6. Questions for the owner

1. Activation order: which of the wired callers should be switched on first, and for which test site (after the release gate)?
   (a) door-window programs, (b) door automations, (c) card capture, (d) none yet.
2. Door automations: should the block's creator also need `access.doors.open` on the door (current Native rule, fail closed), or should
   Arx map WisKey `door/pulse` to `access.doors.automate` for an automation actor? (a) keep as is, (b) change the mapping (needs WisKey to agree).
3. `LIVE_ENGINE_BUILT`: split it into a program flag and an emergency flag before turning it on? (a) yes, split, (b) one flag.
4. Q4 (live install / S8): which installed host, build and go2rtc instance, and when is the joint session? (owner + integration teams)
5. Q5 (WhatsApp / secrets): the separate instruction for the existing secret mechanism, the approved template and the recipient. (owner)
