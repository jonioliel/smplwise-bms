# WISKEY-RC10-PIN-2382 — re-pin the WisKey command contract to 2.0.1-rc.10

Task T2 of `private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md` (section 4.2, group G3). Branch
`pilot/WISKEY-RC10-PIN-2382` from `origin/main` (v2.38.0, `efc12d0e3`). Not merged, no tag, no version bump. No WisKey, station,
door, Home Assistant, NVR, lab or runner contact: every rc.10 fact below comes from a read-only `git archive` of WisKey's
repository, parsed statically.

## 1. Input

- WisKey `C:\hik intercom`, ref `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ `2834aa5e8830f55e270dc5c99b8313f3c05fe3de`,
  component `custom_components/hikvision_intercom`, manifest and `const.VERSION` `2.0.1-rc.10`.
- Lab probe 03.11 (agent d, read-only): `overview.api` version 1, `min_client` 0, 258 commands, 68 capabilities.
- Arx pins as of v2.38.0: `docs/integrations/wiskey/catalog/rc37-contract.4` (WisKey's delivered rc.37 catalogs, the only pin
  the contract tests used), `services/wiskey_r5_catalog.jsonl` + `wiskey_direct_catalog.load()` extras (302 commands),
  `wiskey_media_contract.py` (W10 v1.1), `wiskey_direct_discovery.py` (direct/capabilities reader revision 2),
  `wiskey_channels.py`, `intercom_adapter.py` (CHANNEL_OF, FEATURES), `intercom_client.py`, `wiskey_core_runtime_gate.py`, fixtures.

## 2. The contract fixture (new): `docs/integrations/wiskey/catalog/rc10-extract/`

`scripts/wiskey_rc_extract.py` (new) builds, from a WisKey tree or git ref, without importing or executing it:

| File | Content |
|---|---|
| `commands.static.json` | the 245 public WebSocket commands in the rc.37 delivery format: top-level request schema as `websocket._command_handler` builds it (optional keys, conditional extras), base permission (`panel_permissions.requirements` interpreted as a pure lookup), READ class, request byte limit |
| `errors.static.json` | 365 error codes with source locations |
| `surface.static.json` | the separate registries (W10 media, features, peer, templates v1/v2, installation, relay map, capture, name references, tts, audio, subscribe, Core observation, service-write status), the direct-only reads, `overview.api` version / min_client / capabilities (static, candidate, conditional), the projected `overview.api.commands` for an administrator / the paired bridge / the direct socket, HA services, entity keys and states, event types, bus events, and the closed shapes Arx reads (direct/capabilities v1 blocks, direct/time, W10 parameters / descriptor / events, media-ingress body, Core observation) |
| `PIN.json`, `LICENSE` | hashes, counts, ref and commit; WisKey's MIT licence |

Receipts for the extractor:
- On rc.37's commit `909579e` it reproduces WisKey's delivered `rc37-contract.4` `commands.static.json` (238) and
  `errors.static.json` (301) **exactly** (same content).
- Its administrator projection of rc.10 = **258 commands, 68 capabilities**, api version 1, min_client 0: the lab numbers.
- It is deterministic (re-runs give the same SHA-256) and fails (exit 3) on a registry module or a permission-function shape it
  does not know, instead of skipping it.
- rc.9 (`64c8a9c0`) -> rc.10 diff in one run: only the version strings change.

`scripts/wiskey_contract_diff.py`: default pin is now `rc10-extract` (rc.37 stays as the oldest baseline); when both sides have
`surface.static.json` it diffs the surface too (removed name or changed value = breaking, addition = change).

## 3. Diff rc.37 (pinned) -> rc.10

Public table: **7 added, 0 removed, 0 required-key / permission / READ changes, 0 removed error codes, 64 added error codes.**

| Added command | Request keys | Class | Arx |
|---|---|---|---|
| `users/access_state` | user_id, revision | READ, administrator only | already sent (readback channel; was "unpinned") |
| `users/access_state_v2` | user_id, revision, bridge (optional) | READ, administrator only | already sent (readback channel) |
| `schedules/normalize_user` | schedule | READ, administrator only | already sent (readback channel) |
| `whatsapp/pacing_status_v1` | - | READ, users:view | already sent (pacing channel; was "unpinned") |
| `whatsapp/send_pacing_v1` | user_id, account, token, message, confirmed | write, users:manage | not used (Arx sends `whatsapp/send`) |
| `platform/maintenance_resume_v1` | job_id, fingerprint, confirmed | write, administrator only | not used (in the direct catalog since 2.33.x) |
| `upgrade/manual_readiness_v1` | - | READ, management:view | not used yet (status page T3) |

Outside the public table (all already known to Arx's direct catalog except the last two): W10 six commands, `features/*` (8),
peer reads (4), `peer_writes/source_v1`, `users/name_ref_*_v1`, `capture/lease_*`, `events/resume_v1`, 13 installation-registry
commands (templates v3/queue, readiness, retire, restart v1/v2, capability preflight, template source status, retention policy,
station snapshot), relay map (6), `whatsapp/template_send_v1/v2`, `users/service_write_status_v1`, `tts/*`, `audio/*`, `subscribe`,
direct-only (`peer_identity/get`, `direct/capabilities`, `direct/capabilities_v2`, `direct/time`), and NEW to Arx's catalog:
`upgrade/manual_readiness_v1` (direct socket) and `installation/core_runtime_v1` (HA-authenticated only).

Renamed: none. Removed: none.

Changed shape (found by the surface extraction, not by the rc.37 catalogs):

| Item | rc.10 | Arx before | Effect before this branch |
|---|---|---|---|
| `direct/capabilities` `native_service_write` block | v1 block **plus** `installation_contract: "wiskey-native-service-write.v2"` | exact match on the v1 block | block rejected (`rejected_blocks`), `service_write` False, a warning on every discovery |
| `media/talk_closed` reasons | adds `media_not_supported` (station refuses two-way audio) | 7 known reasons, unknown -> `upstream_closed` | the precise reason was lost (talk still ended correctly) |
| W10 descriptor `audio.listen_transports` | present | read by intercom_media since F02 | none |
| direct/capabilities `lifecycle.pairing_rotation` | present | ignored (only the three v1 flags are checked) | none |

Unchanged and now checked against rc.10: W10 parameter key sets (talk_open's optional `listen`), actor keys, `talk_close`
reasons, `media/talk_audio` event keys, W10 schema `arx.station_media.v1.1`, `station_talk_audio` block, direct/time keys,
command-entry keys, lifecycle v1 flags, media-ingress body keys, Core observation and module keys, HA services
(`unlock_door` and four syncs), station entity keys and `call_status` states, capability names Arx reads (6).

## 4. What changed in Arx

| File | Change | Compatibility |
|---|---|---|
| `scripts/wiskey_rc_extract.py` (new) | the static extractor | tooling only |
| `scripts/wiskey_contract_diff.py` | default pin `rc10-extract`; surface diff | `--pinned` selects any pin; rc.37 folders (no surface) diff as before |
| `docs/integrations/wiskey/catalog/rc10-extract/` (new) | the rc.10 pin + README | rc.37 pin untouched |
| `services/wiskey_direct_discovery.py` (**shared contract module**) | reader revision 3: the `native_service_write` block is accepted in exactly two closed shapes (historical v1, rc.10 v1 + `installation_contract` v2); new `Capabilities.service_write_installation_contract` (observation only, default None) | the historical block reads as before; any other shape still rejected; new dataclass field has a default |
| `services/wiskey_direct_catalog.py` (**shared**) | two rc.10 rows: `upgrade/manual_readiness_v1` (NativeBridgeMessage, discovered) and `installation/core_runtime_v1` (HA-body: `direct_refusal` = `not_a_direct_command`); 298/302 -> 300/304 | no caller sends either on the direct envelope; the Core gate uses its own HA session |
| `services/wiskey_media_contract.py` (**shared**, read by the talk work) | `V11_EVENT_REASONS` + `media_not_supported` | additive; an unknown reason still reads as `upstream_closed` |
| `tests/test_wiskey_rc10_pin.py` (new, 81 tests) | every Arx pin against rc.10 (section 3), every classic frame Arx sends against rc.10's request validation (client, adapter, readback, pacing, messaging: 47 frames), W10, discovery, entities, capabilities, the open WisKey gaps (pinned), the extractor | - |
| `tests/test_wiskey_contract.py` | names the rc.37 pin explicitly (`--pinned`) now that the default moved | same assertions |
| `tests/test_alignment_controller.py` | catalog counts 300 / 304 | - |
| `tests/test_wkr5_295.py`, `tests/test_wiskey_mac_adopt_298.py` | catalog counts +2 and the HA-body row list (+ `installation/core_runtime_v1`) | - |

Not changed: `tests/fake_wiskey.py` still validates against rc.37 (the oldest supported WisKey; switching it would change the
feature flags of ~40 test files other agents are editing). `wiskey_channels.UNPINNED_CHANNELS` keeps its meaning ("newer than
the rc.37 pin"); the rc.10 test checks those channels too. No frontend change (no `tsc` needed). No `management/tasks.json`
edit (other agents edit it concurrently; the lead records the task).

Older WisKey: every rc.37 test still runs against the rc.37 pin; the discovery reader still reads the pre-rc.10 block; nothing
new is selected without discovery (both new catalog rows are routing facts only).

## 5. What rc.10 lacks that Arx needs (for the WisKey-team prompt)

Confirmed in rc.10 source (each pinned in `test_rc10_gaps_that_the_wiskey_prompt_lists_are_still_open`; the test fails, usefully,
when a later rc closes one):

1. **W10 in the administrator's `overview.api.commands`** (Q-WK-2). rc.10 lists the six W10 commands only in
   `direct/capabilities` and in the overview of a `bridge_full_scope` identity. Either list them for the paired service user, or
   confirm in writing that `direct/capabilities` is the discovery Arx must use (the talk branch is changing Arx's `listed()` to
   read it).
2. **kid on the direct protocol** (Q-WK-3): `lifecycle.kid_in_v1` is False; a rotated pairing key turns off every signed path.
3. **A writer for `native_service_grants_v1`** (Q-WK-4): rc.10 only reads the option (`native_service_write_api.py`,
   `direct_bridge_discovery.py`); no options flow or signed owner action writes it on a manual install.
4. **Standalone listen** (Q-WK-5): listen exists only as `talk_open.parameters.listen`.
5. **Operator-initiated ring** (Q-WK-6): `media/signal` is answer / reject / hangUp; no ring request.
6. **Emergency secure** (Q-WK-7): `emergency_secure_unsupported_v1` still published.
7. NEW - **ship the static contract with every rc.** rc.37 was the last delivered `commands.static.json` / `errors.static.json`.
   Arx now extracts them itself; ask WisKey to (a) ship their own generator output per rc (Arx diffs both), or at least
   (b) announce a new WebSocket registry module, a change in `panel_permissions.requirements`' shape, or in
   `websocket._command_handler` (the extractor refuses those rather than guess).
8. NEW - **no silent change inside a schema_version-1 block.** rc.10 added `installation_contract` to the v1
   `native_service_write` block without a version change; Arx's closed reader rejected it until this branch. Ask for a version
   bump or a changelog line for any key added to a closed block (`native_service_write`, `station_talk_audio`, `lifecycle`,
   W10 descriptor / events).
9. NEW - **closed enum for `media/talk_closed.reason`.** rc.10 can send `media_not_supported` (not in the W10 v1.1 list Arx was
   given). Ask for the full list in the contract text.
10. NEW - **response schemas** for the reads Arx projects (`overview`, `users/query`, `users/get`, `events/list`,
    `events/export`, `profiles/*`, `schedules/*`, `health/*`, `sync/status`, `conflicts/list`, `fleet/alerts`, `audit/list`,
    `stations/technical_*_get`): still "not statically generated". Arx's fixtures are recorded shapes, not a contract.
11. Carried over (no rc.10 change found): Q-WK-1 (Core provenance verifier), Q-WK-8 (stable panel tab/tool ids),
    Q-WK-9 (`authentication_failed` reason field, quiet retry, start-up concurrency), Q-WK-10 (maintenance witness),
    Q-WK-11 (classic-channel permission for the station-ops / conflicts / door-technical writes).

Opportunities, not gaps: `whatsapp/send_pacing_v1` (paced send; Arx still uses `whatsapp/send`) and
`upgrade/manual_readiness_v1` (for the status page, T3).

## 6. Tests

| Command | Result |
|---|---|
| `pytest tests/test_wiskey_rc10_pin.py` | 80 passed, 1 skipped (the source test needs `WISKEY_SOURCE_GIT`) |
| `WISKEY_SOURCE_GIT="C:/hik intercom" pytest tests/test_wiskey_rc10_pin.py` | 81 passed (reproduces rc.37's delivered catalogs and this pin from source) |
| 38 directly impacted test files in one process (every test importing the touched modules, the channels, the contract tool or the join fake) | 1305 passed, 15 skipped, 3 xfailed, 3 failed (count pins of the catalog in test_wkr5_295 x2, test_wiskey_mac_adopt_298 x1: updated) -> those 4 files re-run: 162 passed, 2 skipped |
| the wider 66-file set (adds every fake-WisKey user) | stopped by a 50 min timeout at 18% inside test_intercom_consent_link (not touched here); NOT_RUN to completion locally |
| full backend suite (runner) | NOT_RUN - the runner gate was `running` (fix/STATION-WS-PATH-2381) at 19:57 UTC, so no run was queued |
| `tsc` | NOT_RUN - no frontend change |
| lab / device | NOT_RUN by design (static only) |

Rollback: revert the commit. The rc.37 pin and every rc.37 test are unchanged, so a revert restores v2.38.0's contract state.
