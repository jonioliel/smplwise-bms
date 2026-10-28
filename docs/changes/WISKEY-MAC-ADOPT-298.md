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

RECONCILIATION_TABLE

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
