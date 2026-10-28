# WISKEY-MAC-ADOPT-298 - Arx adoption of the WisKey Mac/Windows delivery of 27-28.10

Branch `pilot/WISKEY-MAC-ADOPT-297`, cut from `origin/main` `0a3b04bbe8708db794e58f8878d00250cb100b49` (v2.24.1).
Not merged, not tagged, not installed. Tests: fakes and synthetic data only.

## Inputs (read-only)

- Mac delivery (product CODE `d5a3ab862fab45537cde2f30358e0e9d1f3f9c8b`, Mac delivery `3044b4a2f60db5ec50ef3d588c5bfcc019f45c56`):
  `wiskey_inbox_2026-10-27/` items 01-07 and `00_summary/`. The binding service contract is
  `04_vectors_catalog/SERVICE_WRITE_FINAL_V1.json`; the session runbook is `07_joint_session_runbook/RUNBOOK.json`.
- Windows intake receipt of 28.10 (`windows-intake-2026-10-28/delivery/`): `RECEIPT_HE.txt`, `ARX_CURRENT_SOURCE_RECONCILIATION.json`,
  `QUESTIONS_AND_DEPENDENCIES.json`, `RUNS_VERIFIED.json`, `AUXILIARY_INPUT_AVAILABILITY.json`.
- Mac reviewed Arx `1b0ddd85cc72711592fedc7797c30f91ef8794ad`; Windows observed `origin/main` `ffd64ddbc...`. This branch starts from a
  later `origin/main` (`0a3b04bbe`, v2.24.1). The four Windows touchpoints have the SAME bytes on `0a3b04bbe` as on `ffd64ddbc`
  (router `71236168...`, services/intercom_media `1895b103...`, wa_template_send `be5ac851...`, listen adapter `88242820...`).

## 1. What was already adopted (no change made)

| Area | Evidence on `0a3b04bbe` | Status |
|---|---|---|
| Standalone listen (owner26-independent-listen) | `wiskey_listen_adapter.WiskeyDownlinkChannel.open` opens the signed `talk_open(listen=true)`; no `downlink_pending`; `publication_current` exists | ADOPTED before this branch |
| Listen route publication check | `routers/intercom_listen.py` `to_browser` checks `publication_current` after `confirm` | ADOPTED before this branch |
| Drain moved to `_fence` (natural tail kept) | `_Downlink._end` keeps the queue, `_fence` drains | ADOPTED before this branch |
| HA scoped terminal (owner26-ha-scoped-terminal) | native side; Arx consumer unchanged | Native; nothing for Arx |
| Emergency v2 (`wiskey-emergency-event.v2`), new OPEN after UNKNOWN (`retry_of`), `lock_secure` refused | `wiskey_emergency_direct.py` (`open_supported`, LOCK not_implemented) | ADOPTED before this branch |
| capture_start `binding_revision` must be null | `wiskey_capture_map.project_dto9` -> `binding_revision_unsupported` (tests/test_wk4adopt_295.py) | ADOPTED before this branch; Mac confirms compatible |
| CSV nine facts | `wiskey_people_csv.py` (ADOPTR6-295) | ADOPTED before this branch; Mac: no CSV reader / card-capture mapping reopened |
| peer_query chain (get/resolve, refusal kept, no retry) | `wiskey_peer.peer_read`, `wiskey_intents.LiveResolveTransport` | ADOPTED before this branch; Mac: no protocol mismatch |

## 2. What this branch changes

| Item | Change | File(s) |
|---|---|---|
| A | `_pump.from_station` re-checks the native channel terminal AFTER the awaited `lease.confirm` and with no await before `send_bytes` (`WiskeyBridgeTalkChannel.publication_current`). Security ends (expired, access_lost, source_changed, connection_closed, talk_audio_invalid, link closed, a channel close) stop publication; a natural end (idle_timeout, ended, stopped, upstream_closed) keeps the admitted tail. Outcome stays `upstream_closed` (same as the `upstream()` task, no race on the reported outcome). | routers/intercom_media.py, services/intercom_media.py |
| B | `TemplateSender.send_v2` no longer refuses `window_open`: an explicitly requested approved template is sent inside an open window (WisKey answer 5, option b). Switch + permit, registered reference + WisKey pair, shared budget and transport selection unchanged; `window` must be open/closed/unknown. v1 `send` keeps F3C TP-04. Contract table: answers 2, 4, 5 marked `ADOPTED_MAC_2026_10_27`; pacing (3, partial) and live queue (6) stay UNCONFIRMED. | services/wa_template_send.py, services/wa_template_v2_contract.py, tests/test_tplv2_295.py |
| C | New client of `wiskey-native-service-write.v1`: closed 13-key `service_write` metadata on the four existing commands; durable journal row `unknown` BEFORE dispatch, repository-bound, request-bound (`request_sha256`, PIN value replaced by a presence marker), private format schema 3, capacity 4096 without eviction; identical request never re-dispatched (no replay after a lost receipt), changed request -> `service_operation_conflict`, reused request id -> `service_origin_or_request_already_recorded`; only closed verified refusals become `refused`; `service_write_outcome_unknown` and unknown codes stay UNKNOWN; PIN only in the original `pin_generate` reply (in memory, never journalled, never in a duplicate); `users/service_write_status_v1` read settles an UNKNOWN only with a verified completed receipt. No self-grant: grant references come from an injected owner source; production has none, so the writer is never available and nothing is sent. Wired into the grant engine through `access_service_writer.writer_for` (the Arx proposal `users/service_write_v1` is marked superseded); delete / cards keep the service channel. Service receipts never go to `peer_receipts/resolve`. | services/wiskey_service_write.py (new), services/access_service_writer.py, services/access_grant_engine.py |
| D | peer_query closed lists: `PEER_RESOLVE_STATES` (found, unknown), `PEER_COMMAND_REFUSALS` (binding_denied for both reads), `PEER_RESULT_CLASSES` and `peer_result_class`. No `never_committed` class. | services/wiskey_peer.py |
| E | Runtime catalog replaced by the trim of the FINAL catalog (source SHA-256 `dd55f9df3bc0480729fc9336d066ab741811cfbfe6806df90620166669937293`, CODE `d5a3ab86`): 276 registered + 3 direct-only = 279 commands, 43 families; adds `users/service_write_status_v1`, `features/people_csv_preview`. Caller map regenerated. Capabilities reader accepts the final document's three additive blocks (`business_contracts`, `native_service_write`, `station_talk_audio`) - each optional, closed, and any other top-level key still refused; a different service-write or talk-audio block is `capabilities_unsupported`. | services/wiskey_r5_catalog.jsonl, services/wiskey_direct_catalog.py, services/wiskey_direct_discovery.py, docs/integrations/wiskey/r5/CALLER_MAP.json, tests/test_wkr5_295.py |

## 3. Reconciliation table (before = `origin/main` 0a3b04bbe, after = this branch head; first 16 hex of SHA-256)

| File | Before | After | Status |
|---|---|---|---|
| `smplwise_vms/backend/smplwise/routers/intercom_media.py` | `71236168096443d5` | `195feeba20cde753` | changed |
| `smplwise_vms/backend/smplwise/services/intercom_media.py` | `1895b103e4989e61` | `cbfa5b105fa7a291` | changed |
| `smplwise_vms/backend/smplwise/services/wiskey_listen_adapter.py` | `88242820268bb8ca` | `88242820268bb8ca` | same |
| `smplwise_vms/backend/smplwise/routers/intercom_listen.py` | `eb6ef0e872e949eb` | `eb6ef0e872e949eb` | same |
| `smplwise_vms/backend/smplwise/services/wa_template_send.py` | `be5ac851fc27e3b7` | `190fb8de756f977e` | changed |
| `smplwise_vms/backend/smplwise/services/wa_template_v2_contract.py` | `73facd9a950ae139` | `7dc6c378029ba347` | changed |
| `smplwise_vms/backend/smplwise/services/wiskey_service_write.py` | `absent` | `26145ac87c270eab` | new |
| `smplwise_vms/backend/smplwise/services/access_service_writer.py` | `79534278a37889da` | `e649f6cfd0bd8c5b` | changed |
| `smplwise_vms/backend/smplwise/services/access_grant_engine.py` | `ac17d67ee7362aa7` | `034f487cadbf5601` | changed |
| `smplwise_vms/backend/smplwise/services/wiskey_peer.py` | `4f31aeab419f0cbd` | `e5c2fe1b7ceab92b` | changed |
| `smplwise_vms/backend/smplwise/services/wiskey_capture_map.py` | `1d2160dad84eb331` | `1d2160dad84eb331` | same |
| `smplwise_vms/backend/smplwise/services/wiskey_emergency_direct.py` | `d98afe71f2f1e16a` | `d98afe71f2f1e16a` | same |
| `smplwise_vms/backend/smplwise/services/wiskey_people_csv.py` | `0f55bfaf1986cbf7` | `0f55bfaf1986cbf7` | same |
| `smplwise_vms/backend/smplwise/services/wiskey_direct_discovery.py` | `eaae1e2a692f3dff` | `1fade6d88b03162f` | changed |
| `smplwise_vms/backend/smplwise/services/wiskey_direct_catalog.py` | `8e620bbe07954b29` | `987c790d405658ea` | changed |
| `smplwise_vms/backend/smplwise/services/wiskey_r5_catalog.jsonl` | `a9e8ef4c2def85f0` | `6e1513b62849cd34` | changed |
| `docs/integrations/wiskey/r5/CALLER_MAP.json` | `7aada5b3252a42d4` | `282279abbc3785fb` | changed |
| `smplwise_vms/backend/tests/test_wkr5_295.py` | `eb573135cf3c0af7` | `9c61c17ea6b0c0c5` | changed |
| `smplwise_vms/backend/tests/test_tplv2_295.py` | `6fca382413600fe0` | `9999e8e94bef404a` | changed |
| `smplwise_vms/backend/tests/test_wiskey_mac_adopt_298.py` | `absent` | `35a7c262656ab6c0` | new |

## 4. Per-item states

| Item | Implemented | Registered | Wired | Tested | Installed | Live |
|---|---|---|---|---|---|---|
| A router terminal re-check | yes | n/a (existing route) | yes (talk WS route) | fakes | NOT_PERFORMED | NOT_MEASURED |
| B send_v2 open window | yes | n/a | yes (TPLV2 route; permit still False in production) | fakes | NOT_PERFORMED | NOT_MEASURED |
| C service write v1 | yes | catalog lists the commands | engine port wired; disabled until owner grant reference (OWNER-CONFIG) | fakes + synthetic shapes | NOT_PERFORMED | NOT_MEASURED |
| D peer closed lists | yes | n/a | constants + classifier (no new caller) | fakes | NOT_PERFORMED | NOT_MEASURED |
| E catalog + capabilities | yes | final catalog adopted | discovery reader | fakes | NOT_PERFORMED | NOT_MEASURED |

## 5. Not done / open

- Mac CI recipe (`tools.verify_family_vectors`, `tools.wiskey_direct_simulator`) is WisKey-repository tooling: NOT_RUN here.
- Journal table is created by `wiskey_service_write.ensure_schema` (idempotent) instead of a numbered migration: `0182` is already used on
  other open branches (`0182_doc_extractions`). The lead picks the migration number at merge time if a migration is preferred.
- `management/tasks.json` / test catalog rows were not added on this branch (lead's call; `scripts/project_status.py --write` not run).
- Build artifact: NOT produced (no `npm run build:addon`, no add-on image) - backend-only source change.
- Owner: grant reference source (OWNER-CONFIG), session-day target, installation instruction and per-action notices (OWNER-LIVE).

## 6. Tests run (synthetic, fakes only; venv .venv\Scripts\python.exe -m pytest, each run kept with stdout/stderr/JUnit outside Git)

| Run | Scope | Result |
|---|---|---|
| run01 | tests/test_wiskey_mac_adopt_298.py (first version) | 44 PASS, 1 FAIL (a test that wrongly matched the docstring; test fixed) |
| run02 | tests/test_wiskey_mac_adopt_298.py | 45 PASS, 0 FAIL, 0 ERROR, 0 SKIP |
| run03 | 33 impacted suites in one process | INTERRUPTED by the agent after ~40 min at 13 % (one F visible in partial output, not identified); counts not used |
| run04 | the same 33 suites, one process per file | 1093 tests: 1090 PASS, 0 FAIL, 0 ERROR, 3 SKIP (test_t06_admission_295.py: pre-existing documented FINDING-3/4/5 xfail-style skips, unchanged by this branch) |

Full suite: NOT_RUN. Runs are not summed (run02 and run04 do not overlap).

## 7. Independent review fixes (after 00066e011)

Each fix has a regression test written first in `smplwise_vms/backend/tests/test_wiskey_mac_adopt_298_review.py` (watched failing, then
passing). The section 3 table describes `00066e011`; the files below changed again after it.

| Finding | Fix | Tests |
|---|---|---|
| F1 journal cap never pruned | `Journal.prune` (run by `write`): settled rows (completed / refused) older than 30 days, and the oldest settled rows older than 24 h from 3072 down to 2048; UNKNOWN rows and freshly settled rows never. A write within 64 rows of the 4096 cap is `service_write_capacity`; `FinalServiceWriter.available()` is False there (`ServiceWriteClient.has_room`, a read-only occupancy count). | `test_f1_*` |
| F2 UNKNOWN write does not hold the person | `users/update` / `users/temporary_cancel` take the shared people gate (`intercom_sync.SYNC.begin_external` / `end_external`, like the capture-lease confirm): an UNKNOWN keeps the person `readback_required` until a fresh read. Arx's own UNKNOWN row holds the person on the service path across restarts (`service_write_unsettled`) until a status read settles it (`status`, `unsettled`, `settle_unknown`). `users/pin_generate` respects the gate but does not take it. | `test_f2_*` |
| F3 PIN duplicate answered `completed` | A PIN-bearing duplicate (`users/pin_generate`, or `data.pin` set) of a completed row returns `unknown` / `pin_duplicate_unverified`, no receipt, nothing sent. | `test_f3_*` |
| F4 unsalted request hash | `request_mac`: HMAC-SHA256 under an install-local 32-byte key in `<data_dir>/keys/wiskey-service-write.key` (`load_or_create_key`, 0600, linked into place), never in the database. No key: nothing sent. The column keeps its name `request_sha256` (64 hex). | `test_f4_*` |
| F5 raw exceptions, PIN shape, receipt person | sqlite errors before dispatch are `journal_unavailable` (not_sent), after it the row stays UNKNOWN; non-JSON / odd input is `invalid_fields` (not_sent); the generated PIN must be exactly six ASCII digits; a receipt (result or status) of a write to an existing person must name that person, else UNKNOWN. | `test_f5_*` |
| M1 natural tail and link close | A link torn down after a natural end keeps the admitted tail; a closed link with no native end still fences. | `test_m1_*` |
| M2 audit of security ends | `TalkSession.publication_end`; the `intercom.talk.end` audit details carry `publication_end` when a security end stopped the sound (outcome stays `upstream_closed`). | `test_m2_*` |
| M3 one bad block fails discovery | A malformed / different optional block (`business_contracts`, `native_service_write`, `station_talk_audio`) is not read (`Capabilities.rejected_blocks`, feature off); the core document still is. An unknown top-level key is still refused. | `test_m3_*`, `test_e_*` |
| M4 window check order in send_v2 | `window` is validated first, before the switch, registry and the shared budget. | `test_m4_*` |

Migration: the journal table is still created by `ensure_schema` (idempotent); `0182` is taken on other branches, so no migration number
was chosen here - the lead picks it at merge. The service writer stays disabled (`from_join`: no grant source, no client, no key).
Open: an UNKNOWN service row whose status stays `unknown` holds that person on the service path until WisKey's record answers; the human
path is held only by the shared gate (cleared by a fresh read). Whether a fresh read should also release the service-path hold is an
owner / lead decision (not implemented).