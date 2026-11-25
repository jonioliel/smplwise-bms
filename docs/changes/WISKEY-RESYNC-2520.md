# WISKEY-RESYNC-2520 - WisKey resync reply (24.11) -> Arx adoption plan, and slice 1 (system/status_v1 + jobs/status_v1)

Branch `pilot/WISKEY-RESYNC-2520`, cut from `origin/release/2510-train` (`df3ee6d12`, the 2.51 candidate). Target version: 2.52.
Status: plan written; slice 1 implemented with backend unit tests (results in section 9). Nothing was installed, nothing touched the lab,
no message went to WisKey (questions go to the owner, section 10).

## 1. Inputs (read only, verified)

| what | identity |
|---|---|
| WisKey hand-off branch | `codex/wiskey-mac-arx-resync-2026-11-24`, commit `8c6b10208e3fc356581d73a49a062a7a62f726f9` (fetched into the read-only checkout; `git cat-file -t` = commit; message "verify Mac Arx resync receipts and reconcile 41 responses"). The WisKey repository was not modified. |
| WisKey PRODUCT (unchanged) | `2.0.1-rc.19` = `3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d`. No rc20, no ETA. |
| WisKey's Arx baseline | `v2.50.0` = `fd600e96db885a7bb3442a6bfb605bec2d98af2d` (= origin/main). The WisKey consumer files are identical on `release/2510-train` (`git diff origin/main origin/release/2510-train` touches no `services/wiskey_*`; only routers' response models changed). |
| read, in order | `windows-mac-resync-review/`: START_HERE_HE, WINDOWS_RECEIPT_HE, FORWARD_TO_ARX_HE, WISKEY_REPLY_2026-11-24_WINDOWS_HE (41 ids), MASTER_TASKS_REVIEWED.json; `mac-arx-resync/`: CONTRACT_INDEX, CONSUMER_ADOPTION_DELTA, REMAINDERS_BY_OWNER, current-arx-source/ARX_CURRENT_REVIEW_HE + ARX_CURRENT_CONSUMER_REVIEW.json; PRODUCT contracts `docs/contracts/{system-status-v1, checkpoint-jobs-status-v1, external-visits-v1}`, PRODUCT `api_contract.py`, `websocket.py` (registrations), `panel_permissions.py`, `checkpoint_jobs_api.py`, `system_status_api.py`, `schedule_execution_api.py`, `direct_bridge_discovery.py`. |
| Arx side read | `services/wiskey_channels.py`, `wiskey_ops_views.py`, `wiskey_station_ops.py`, `wiskey_visits.py`, `wiskey_feature_status.py`, `wiskey_media_bridge.py`, `wiskey_direct_discovery.py`, `wiskey_service_write.py`, `wiskey_schedule_writes.py`, `wiskey_relay_map*.py`, `intercom_sync.py` (read path), `intercom_adapter.py` (status reads), `routers/access_control_reads.py`, `routers/access_control_ops.py`, frontend `api/access-status.ts`, `access-control/status-*.ts`; docs `WISKEY-RC10-PIN-2382`, `WISKEY-VISITS-2407`, `WISKEY-MAC-ADOPT-298`. |

WisKey's eight static findings on Arx (ARX-NEW-WIRES, -B8-PARTIAL, -KID-V2, -MANUAL-V3, -LISTEN-PARTIAL, -B2-TIMING, -WHATSAPP-SOURCE,
-CORE-VERIFIER) were re-checked against the Arx source and are all **confirmed**, with one correction recorded (contradiction, not
silently resolved): **two of the "seven wires absent from the channel constants" are not WebSocket channel commands at all.**
`service_grants/current_v3` and `direct/pairing_status_v2` are signed direct-bridge commands (WisKey `direct_bridge_api.py`,
`trusted_actions/direct_bridge_origin.py`); in Arx they belong to the direct catalog / signed transport (`wiskey_direct_catalog.py`,
`wiskey_media_bridge.py`), never to `wiskey_channels.py`. The other five are WS commands.

## 2. Deployed identity (item 7) - from existing evidence only, no live action

| component | identity | evidence | not identified |
|---|---|---|---|
| Arx add-on in the lab | v2.50.0, tag `v2.50.0` -> `fd600e96d`; add-on branch `#addon` `ba153da90` | handoff READ_FIRST 24.11 ~21:30 IL: install script 2.50.0, health probe answered version 2.50.0 | image digest: **NOT_IDENTIFIED** (none recorded); build reproducibility: NOT_MEASURED |
| Arx 2.51 | not released (`release/2510-train` `df3ee6d12` is a candidate) | - | - |
| HA bridge `smplwise_bridge` | 0.10.8 active | handoff 20.11 (manual install + one Core restart, owner-approved) | file digest: NOT_IDENTIFIED |
| WisKey in the lab | reported `2.0.1-rc.10` (read-only lab read 24.11, stated in our 24.11 request) | our request + WisKey reply | source SHA / package digest: **NOT_IDENTIFIED**; rc19 install: NOT_PERFORMED |
| Home Assistant Core | 2026.11.1 | our 24.11 read-only lab read | image digest: NOT_IDENTIFIED |

WisKey's own review statement "2.49 reported installed" is superseded by the 2.50.0 install above (same 11 consumer files, per their review).

## 3. The seven wires (item 1)

Rules kept for every wire: capability discovery first (a command not listed in `overview.api.commands` / direct capabilities is not
sent); one closed channel or catalog row per wire, no blanket allow-list; a WisKey refusal is reported, never followed by an older
command; `unknown` / null kept (never a zero, false or success); WisKey's permission and Arx's permission both apply.

| wire | WisKey class / permission | Arx today | gap | change (files) | tests | risk | size | row |
|---|---|---|---|---|---|---|---|---|
| `system/status_v1` | WS READ, `management: view` unrestricted | nothing; the status page reads `overview` + `sync/status` + `fleet/alerts` (estimates) | the read, its closed projection, a route | **done in slice 1**: `services/wiskey_system_status.py` (new), `routers/access_control_system_status.py` (new), `wire/access_control_system_status.py` (new), channel `system_status` | `tests/test_wiskey_system_status_2520.py` | low (read only, cached software state) | S | R1 |
| `jobs/status_v1` | WS READ, WisKey's original **owner** check | `jobs/list` on `operations` (the actor's own jobs only) | the read; no fallback to `jobs/list` on refusal | **done in slice 1** (same files) | same | low; the add-on identity may not be WisKey's owner -> `forbidden` shown honestly (Q5) | S | R1 |
| `sync/station_v1` | WS, `stations: manage` (same queueing as `sync/station`) + in-memory `request_id` | `sync/station` on `maintenance` (`wiskey_station_ops.py`, answer `{accepted}`) | request id, link to `system/status_v1` `sync.request` | channel `station_sync_v1` **registered in slice 1, inert**; row: `wiskey_station_ops.py` (switch the op when listed, keep `sync/station` when not), `routers/access_control_station_ops.py`, `wire/access_control_station_ops.py` + generated TS, station drawer UI | unit: listed/not listed, request id kept, `accepted` is not a sync proof, no retry | low-medium (a queued reconcile, same as today) | S | R4 |
| `stations/relay_inventory_v1` | WS READ, `stations: view` | Arx relay map (`wiskey_relay_map*.py`) from the served copy; all 10 doors mapped `single_relay` on 11.11 by approval | READ of API outputs / saved mapping / physical count+role (null/unknown); show "physical relay count unknown" next to Arx's mapping; never infer `single_relay`, no relay test | channel `relay_inventory` **registered in slice 1, inert**; row: `services/wiskey_relay_inventory.py` (new), `routers/wiskey_relay_map.py` (+1 GET), `wire/wiskey_relay_map.py` + generated TS, relay-map UI | unit: null count stays null, unknown role stays unknown, `relay_test_unsupported_v1` shown, no write on the channel | low | S-M | R3 |
| `schedules/operations_execute_v1` | WS write, owner; part of a 9-command reviewed family (`watch/pending/review/decide/resume/preview/execute/status/cancel_v1`) | legacy writer: preflight only, warning from `writes_enabled:false` | the whole reviewed family incl. `operations_decide_v1` (an approval); Arx's single service identity cannot be WisKey's separate approver (same rule as `jobs/approval_*`, `platform/lifecycle_decide`) | **not in 2.52**: needs the owner decision Q2 and B2-ABI (section 7). Until then the legacy warning stays and legacy schedules are never shown as open | - | high (device schedule writes) | L | blocked |
| `service_grants/current_v3` | signed direct READ (v2/kid connection) | absent; writer knows `native-service-write.v1/.v2` only | v3 reader of the owner's current grants; no self-grant; v3 grants no cards | row R8 (section 4.2) | | medium | M | R8 |
| `direct/pairing_status_v2` | signed direct READ (v2/kid connection) | absent; Arx probe is v1 | current pairing status over v2 | row R7 (section 4.1) | | medium | S (inside R7) | R7 |

## 4. Items 2-6

### 4.1 Direct v2 / kid (item 2, C1, C2) - row R7

- Arx today: `wiskey_media_bridge.py` signs `wiskey-bridge-command.v1`, opens `wiskey-direct-ws.v1`, and REFUSES a rotated key
  (`bridge_key_rotated`); `wiskey_direct_discovery.py` requires the v1 lifecycle (`kid_in_v1: false`, else `lifecycle_unsupported`).
- WisKey rc19: discovery v3 reports `protocol: wiskey-direct-ws.v2`, `transport_authentication {version, kid, rotation_source:
  smplwise_bridge.KeySet, fallback_after_key_refusal: false}`, peer query `wiskey-peer-query.v2`.
- Change: a v2 client beside v1, chosen ONLY from discovery (v3 document + v2 protocol listed) and the bridge KeySet's current kid;
  a key refusal ends the attempt (no fallback to v1 or to the HA path for that request); `direct/pairing_status_v2` read added.
  Files: `services/wiskey_media_bridge.py`, `services/wiskey_direct_discovery.py`, `services/wiskey_direct_catalog.py`,
  `services/wiskey_direct_join.py`, `routers/bridge_key.py` (status only), their wire files, tests `test_wkr5_295.py`-style fake server.
- Tests: v2 handshake MAC with kid, rotated kid accepted only when discovery lists it, refusal -> no second attempt, ambiguity
  (two current pairings) -> refusal (until PAIRING-Q2). Risk: medium (transport for door / talk / people writes). Size: L.

### 4.2 Manual v3 vs signed CRUD vs service_write (item 2, R2, C3) - row R8 (after R7)

- Three distinct paths, never mixed: (a) the existing signed people / cards CRUD on the manual-existing profile (WisKey R2 contract,
  21 commands, peer receipt); (b) the narrow `service_write` metadata (`wiskey-native-service-write.v1/.v2/.v3`) - the four service
  actions only; (c) `service_grants/current_v3` READ of what the HA owner granted (preview / commit / revoke stay the owner's, in
  WisKey). v3 grants **no** cards: a card write goes through (a) only.
- Change: select the path explicitly per command before dispatch; a refusal is final for that request (no transport / contract
  fallback); `UNKNOWN` journal rows unchanged (no replay); no self-grant (grant references only from the v3 READ).
  Files: `services/wiskey_service_write.py`, `services/access_service_writer.py`, `services/access_grant_engine.py` (selection only),
  new `services/wiskey_service_grants_v3.py`; tests. Risk: medium-high (people writes). Size: M-L.
- A disabled card (R2): Arx must word it as "removed from the station after sync + readback", never "disabled on the station"; no
  non-open guarantee before convergence or while offline. Text lives with R8's UI strings.

### 4.3 Listen gate (item 3, C4) - row R5

- Arx today: `wiskey_feature_status._listen` appends `listen_no_downlink` unconditionally; the media contract already sends
  `listen: true` (`wiskey_media_contract.talk_open_params`).
- WisKey rc19: direct capabilities carry `station_talk_audio {schema, transport, opt_in: "media/talk_open.parameters.listen",
  default: false}`.
- Change: `listen_no_downlink` only when the last negotiated discovery does NOT carry that exact opt-in (or no discovery yet = unknown,
  reason kept); the version label never decides. Files: `services/wiskey_feature_status.py` (+ the probe projection in
  `services/wiskey_pairing.py` if `station_talk_audio` is not yet kept - then R5 merges after R7). Tests: software only (feature
  status with and without the block); **no live audio**. Risk: low. Size: S.

### 4.4 B8 visits / `record_external_v1` (item 4) - row R6

- Arx today (WISKEY-VISITS-2407): `visits_push` channel, switch default off, single send, `unknown` settled only by reading the list,
  record keys equal to WisKey's contract.
- Gaps against `external-visits-v1`: `approval.approved_at` / `approver_ref` can be null in Arx (`g.get(...)`), the contract requires
  strings; `end_reason` must be non-empty for `ended` and null for `approved`; timestamps must carry an offset; the closed refusal
  codes (`visit_record_stale`, `revision_conflict`, `visit_request_limit`) must map to `refused`, `bridge_outcome_unknown` to
  `unknown`; reconcile can use the exact `filters.external_ref` instead of scanning pages.
- Change: `services/wiskey_visits.py` (record builder refuses a record it cannot make contract-valid - nothing sent; code table),
  `routers/access_wiskey_visits.py` (text only), tests with WisKey's synthetic examples copied to `tests/fixtures/wiskey_rc19/`.
- Operator / runbook text (docs only): record only - no person, credential or activation is created; after WisKey writes store-v2 a
  code-only downgrade to rc17 is not possible; WisKey's users / visits backup is not a full HA / Arx backup.
- Verification: software tests only; producer rc19 + the real connection stay NOT_MEASURED until the owner approves an rc19 install.
  Risk: low-medium. Size: S-M.

### 4.5 Joint decisions (item 5) - section 7. 4.6 Owner-only items (item 6) - listed, nothing invented

- WHATSAPP-METADATA (B1, D5): the approved WhatsApp integration's maintainer must provide body / language / parameters / revision /
  approval / account binding. Arx's `existing_whatsapp_source.describe` keeps `templates=[]` and the missing-field list.
- CORE-PRODUCER-VERIFIER (A1): an authoritative image / ABI verifier; `wiskey_core_runtime_gate` stays `unverified`; policy B/OFF unchanged.
- B03-WITNESS (A1): a witness outside both restore sets (HAOS / Supervisor evidence).
- OWNER-V5-LIVE: any rc19 install, station / card / door / audio / messaging test needs its own approval (targets, window, witness).

## 5. Answers to the 41 master ids (Arx side)

Legend: **adopted** (Arx already consumes it), **gap** (a 2.52 row), **not needed** (nothing for Arx to build), **needs owner**,
**needs WisKey** (or joint).

| id | WisKey answer (short) | Arx status | Arx action / row |
|---|---|---|---|
| 1.1 | all requests received | not needed | ack |
| 1.2 | rc19 on the development branch; hand-off branch is documentation | not needed | ack |
| 1.3 | no rc20 / ETA; rc19 packages verified | needs owner | rc19 install = separate owner approval (Q7) |
| 1.4 | Arx main identified; blockers: deployment identity, consumer adoption, Q2, B2-ABI, metadata, verifier, witness | gap | this plan; identity in section 2 |
| R1 | reload fix in rc19; Core 2026.12 / beta NOT_RUN | needs WisKey | re-test when 2026.12 beta exists; Arx bridge already fixed (0.10.4) |
| R2 | signed manual CRUD separate from service_write; v3 no cards; disabled card removed after sync/readback | gap | R8; wording rule 4.2 |
| R3 | first refresh before attach; lab window not measured | not needed | Arx shows `connecting` / `auth_failed` from `system/status_v1` (R1/R2 rows) |
| R4 | `recovered` + `time_source` kept; minor 92 undecided | adopted | Arx events already keep `recovered` / `time_source` (`intercom_adapter`); 92 stays an unexplained code |
| R5 | no non-actuating relay test; inventory READ | gap | R3 (READ only) |
| A1 | Core verifier missing; gate stays unverified | needs owner | 4.6 |
| A2 | reviewed `operations_*_v1` family; legacy writer stays blocked | needs owner + WisKey | blocked (Q2, B2-ABI); legacy warning kept |
| A3 | same as R1 | needs WisKey | as R1 |
| A4 | same as R3; `public_v2` + status committed | gap (display) | R1 + R2 rows |
| A5 | same as R4 | adopted | as R4 |
| B1 | WhatsApp callable found, templates empty, metadata missing | needs owner | 4.6 |
| B2 | timeout58 / sign 10 / max 15 vs inspection 130; needs ABI | needs WisKey (joint) | section 7, B2-ABI |
| B3 | `jobs/status_v1` for the owner | gap -> **done (slice 1)** | R1 |
| B4 | not fixable; inventory READ | gap | R3 (no relay test) |
| B5 | add station = HA config flow | not needed | Arx installer keeps "add in WisKey" (no WS installer) |
| B6 | PIN conflict atomic on adopt; face/fp counts or null | adopted | `station_people` channel already sends `users/adopt`; null counts shown as unknown (check in R2 UI) |
| B7 | `sync/station_v1` request id + status | gap | R4 (channel registered in slice 1) |
| B8 | `record_external_v1` record-only, CAS, UNKNOWN kept | gap | R6 |
| C1 | W10 commands in direct capabilities | adopted | discovery-driven join already in place |
| C2 | v2 / kid / KeySet, no fallback; Q2 open | gap + needs WisKey | R7; PAIRING-Q2 |
| C3 | v3 service grants via the real HA owner | gap | R8 |
| C4 | listen opt-in, default false | gap | R5 |
| C5 | no ring primitive | not needed | Arx shows "not supported" (no invented command) |
| C6 | secure LOCK unsupported | adopted | feature status `lock_unsupported` already shown |
| C7 | embed ids v1 (`panelTabIds`, `managementToolIds`) | adopted | `frontend/src/wiskey/deep-links.ts`; ABI change needs a version |
| C8 | one contract index (155 + R2 21) | adopted (partly) | R2 table consumed in `wiskey_r2_contracts.py`; catalog re-pin to rc19 = part of each row's tests |
| D1 | `system/status_v1` integration block | gap -> **done (slice 1)** | R1 |
| D2 | per-station connection / auth / failure / firmware / sync | gap -> **done (slice 1)** | R1 (UI in R2) |
| D3 | `writes_enabled=null` + codes | gap -> **done (slice 1)** | R1 (refuses a document claiming writes open) |
| D4 | per-family counts, null failures, history incomplete | gap -> **done (slice 1)** | R1 (no sum; absent family = unknown) |
| D5 | templates + schedules status | gap -> **done (slice 1)** | R1 |
| E1 | optional, not opened | not needed | none (optional) |
| F1 | inventory READ separates outputs / mapping / physical | gap | R3; Arx's `single_relay` mapping stays an Arx approval, never "confirmed" |
| F2 | go2rtc 1.9.15 checked synthetically; provider / setting, no fixed 1.9.14 address | adopted | Arx already on 1.9.15; `smplwise_` streams only |
| F3 | private RTSP source backend-only; no zero-exposure claim | adopted | Arx masks credentials (GO2RTC-STREAM-SYNC); never serialises a private source to the UI |
| F4 | same as R1 | needs WisKey | as R1 |
| F5 | 11 consumer files: 7 wires, v1/kid, manual v3, B8 / listen partial | gap | this plan (R1-R8) |

## 6. Row split for 2.52 (file-disjoint; shared registries are owned by R1 only)

Slice 1 (this branch) pre-registers the two inert WS channels the later rows need, and adds the only new router / wire family line,
so no later row edits `services/wiskey_channels.py`, `tests/test_wiskey_channels.py`, `tests/test_pwclean_295.py`,
`routers/__init__.py` or `scripts/gen_wire_types.py`. Each later row extends its OWN existing router and wire family.

| row | content | files (exclusive) | depends | size | risk |
|---|---|---|---|---|---|
| **R1 WISKEY-RESYNC-2520** (this branch) | system/status_v1 + jobs/status_v1 backend; channel registry incl. reserved `relay_inventory`, `station_sync_v1` | `services/wiskey_channels.py`, `services/wiskey_system_status.py`, `routers/access_control_system_status.py`, `wire/access_control_system_status.py`, `routers/__init__.py` (1 line), `scripts/gen_wire_types.py` (1 line), `frontend/src/api/generated/wire-access-control-system-status.ts`, tests `test_wiskey_system_status_2520.py`, `test_wiskey_channels.py`, `test_pwclean_295.py`, fixtures `tests/fixtures/wiskey_rc19/*`, this note | - | S-M | low |
| R2 WISKEY-STATUS-UI-2520 | status page section "מצב מערכת האינטרקום" (D1-D5 + jobs), unknown shown as unknown, no global "writes open", compare page | `frontend/src/api/wiskey-system-status.ts` (new), `frontend/src/access-control/status-*.ts`, `frontend/src/i18n/access-status.ts` + en copy, frontend unit spec | R1 | M | low |
| R3 WISKEY-RELAY-INV-2520 | relay inventory READ next to the relay map | `services/wiskey_relay_inventory.py` (new), `routers/wiskey_relay_map.py`, `wire/wiskey_relay_map.py`, `frontend/src/api/generated/wire-wiskey-relay-map.ts`, relay-map UI files, tests | R1 | S-M | low |
| R4 WISKEY-SYNC-V1-2520 | `sync/station_v1` with request id | `services/wiskey_station_ops.py`, `routers/access_control_station_ops.py`, `wire/access_control_station_ops.py` + generated TS, station-drawer UI file, tests | R1 | S | low-medium |
| R5 WISKEY-LISTEN-GATE-2520 | capability-driven listen gate | `services/wiskey_feature_status.py` (+ `wiskey_pairing.py` probe projection if needed), tests | R7 only if the probe needs the new block | S | low |
| R6 WISKEY-B8-VERIFY-2520 | record_external_v1 contract conformance, code table, reconcile filter, runbook text | `services/wiskey_visits.py`, `routers/access_wiskey_visits.py`, tests + fixtures under `tests/fixtures/wiskey_rc19/external-visits-v1/`, `docs/user-guide` visits page | - | S-M | low-medium |
| R7 WISKEY-DIRECT-V2-2520 | direct WS v2 / kid / KeySet, `direct/pairing_status_v2` | `services/wiskey_media_bridge.py`, `wiskey_direct_discovery.py`, `wiskey_direct_catalog.py`, `wiskey_direct_join.py`, `routers/bridge_key.py`, `wire/bridge_key.py` + generated TS, tests | PAIRING-Q2 for history semantics only | L | medium |
| R8 WISKEY-MANUAL-V3-2520 | v3 grants reader, explicit path selection (CRUD vs service_write), no card via v3 | `services/wiskey_service_write.py`, `access_service_writer.py`, `access_grant_engine.py`, `wiskey_service_grants_v3.py` (new), tests | R7 | M-L | medium-high |
| (blocked) A2 reviewed schedule execution | the 9-command `operations_*_v1` family | - | Q2 (approver), B2-ABI | L | high |

Merge order: R1 -> (R2, R3, R4, R6 in any order) -> R7 -> (R5, R8). All software-verified only; the lab stays on WisKey rc10 until the
owner approves rc19 (Q7) - every new wire then answers `unsupported` (not listed) and nothing is sent, which is the tested path.

## 7. Joint decisions (via the owner)

**PAIRING-Q2 - which pairing does a signed command address?**
- a) One explicit **current** pairing per entry; Arx always addresses "current"; WisKey keeps history read-only for itself; revoke is
  the owner's action in WisKey's own UI; ambiguity (two current) refuses. **Recommended**: smallest authority surface, matches
  `fallback_after_key_refusal: false`, no new revoke wire.
- b) A pairing-history list / read / revoke over the wire (new signed commands, owner authority in Arx).
- c) a) now, b) later as an additive v-next.

**B2-ABI - reads / checks that take up to 130 s**
- a) A versioned signed long-operation ABI: a short signed start (<= 10 s sign window, <= 15 s max) returns an operation id; signed
  status / watch reads (each well under HA's 60 s, under Arx's 58 s) follow it to a server-side deadline (<= 130 s); a lost receipt
  stays UNKNOWN and is settled only by the status read; no replay, no permission change. **Recommended**: WisKey already has this shape
  (`operations_watch_v1` / `status_v1`), and it needs no timeout raise.
- b) Raise the caller timeout and the signing window to cover 130 s. Rejected: HA's 60 s limit, weakens the proof window.
- c) Split inspection into per-slot calls under 58 s orchestrated by Arx. More round trips and partial states; fallback only if a) is refused.

## 8. Slice 1 - what changed

- `services/wiskey_channels.py`: channel `system_status` = {`system/status_v1`, `jobs/status_v1`} (in use); `relay_inventory` =
  {`stations/relay_inventory_v1`} and `station_sync_v1` = {`sync/station_v1`} registered **inert** (`in_use: False`,
  `RESERVED_CHANNELS`); all three unpinned (newer than the rc.10 pin). No existing list changed.
- `services/wiskey_system_status.py` (new): the two reads (one frame `{type}`, no `api_contract` - both are READ in WisKey's
  api_contract), capability discovery fail-closed (`no_copy`, `commands_unknown`, `api_incompatible`, `not_listed` -> nothing sent),
  closed projections; pinned guarantees checked and a violating document refused whole (`contract_mismatch`); `families_absent`;
  answer `{state, reason, wiskey_code, fetched_at, data}`.
- `routers/access_control_system_status.py` (new): `GET /api/v1/access-control/status/system`, `GET /api/v1/access-control/status/jobs`,
  `access.admin.read` unrestricted at the installation (audited 403 before anything is sent). Mounted on its own line.
- `wire/access_control_system_status.py` (new) + `scripts/gen_wire_types.py` family `AccessControlSystemStatus` +
  generated `frontend/src/api/generated/wire-access-control-system-status.ts`. No UI change (that is R2; no compare page needed).
- Tests: `tests/test_wiskey_system_status_2520.py` (new), registry expectations in `tests/test_wiskey_channels.py` and
  `tests/test_pwclean_295.py`; WisKey's synthetic contract examples copied unchanged to `tests/fixtures/wiskey_rc19/` (git blobs at
  PRODUCT: system-status-v1 result.valid `573dda52`, .wrong `fb172e13`, .extra `a2407748`, .missing `e53490c4`;
  checkpoint-jobs-status-v1 result.valid `ce80c871`, .wrong `e0195f49`, .extra `dad85ee9`, .missing `510e06ff`).
- Rollback: revert the commit; no migration, no setting, no data.

## 9. Tests run (PC, one file at a time; real results)

| command | exit | result |
|---|---|---|
| `python -m pytest -rA tests/test_wiskey_system_status_2520.py` (repo venv) | 0 | 40 passed |
| `python -m pytest -rA tests/test_wiskey_channels.py` | 0 | 42 passed, 7 skipped (unpinned channels skip the rc.10 catalog check, as before) |
| `python -m pytest -rA tests/test_pwclean_295.py` | 0 | 15 passed |
| `python scripts/gen_wire_types.py --check` | 0 | generated files match |
| `python scripts/wire_ratchet.py` | 0 | 897 unmodelled = baseline 897 (the two new routes are modelled) |
| `ruff check` on the changed Python files | 0 new findings | one pre-existing F811 in `tests/test_wiskey_channels.py` (unchanged line) |
| full backend suite, frontend `tsc`, Playwright | - | **NOT_RUN** (PC memory rule; runner slot B not used for this slice). The train gate runs them. |
| live WisKey / lab | - | **NOT_RUN** by rule (no lab access; the lab has rc10, where both reads answer `unsupported` and send nothing) |

## 10. Open questions (owner; WisKey via the owner)

1. Shared registry: slice 1 pre-registers two inert channels so the 2.52 rows stay file-disjoint. a) keep (recommended) b) each row
   registers its own channel and rows merge serially.
2. A2 reviewed schedule execution: `operations_decide_v1` is an approval. a) defer A2 to 2.53, keep the legacy warning (recommended)
   b) the owner approves in WisKey's own panel, Arx shows status only c) Arx's service identity decides (not recommended: self-approval).
3. PAIRING-Q2 (section 7): a) current-only (recommended) b) history over the wire c) a) now, b) later.
4. B2-ABI (section 7): a) signed long-operation ABI (recommended) b) raise timeouts (rejected) c) per-slot split.
5. `jobs/status_v1` needs WisKey's owner; if the add-on identity is not the owner the page shows "WisKey refused". a) show it
   honestly, no fallback (recommended) b) ask WisKey for a signed owner delegation path for this READ.
6. Owner-only items (4.6): WhatsApp metadata, Core verifier, witness - a) list them to the respective maintainers now (recommended)
   b) park until rc19 is installed.
7. rc19 install in the lab: a) not before R1-R6 are on a released Arx and the owner sets a window (recommended) b) now (every new
   wire would then become listed and testable live, read-only first).
