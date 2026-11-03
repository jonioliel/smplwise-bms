# WISKEY-R3-2272 - adoption of the WisKey R3 (Mac ARX alignment) delivery on top of the R2 alignment branch (2.27.2)

Branch `pilot/WISKEY-R3-2272`, cut from `pilot/WISKEY-R2-ALIGN-2272` (`3b73bc5cd`). Not merged to `main`, not tagged, not released,
version files not bumped. No lab host, no real platform restart, no WhatsApp, no door, microphone or speaker; synthetic trees and fakes
only. Installation at the owner NOT_PERFORMED; live NOT_MEASURED.

## Inputs (read-only; extracted with `git archive` into an isolated empty folder, never merged)

- Private repository `home-assistant-hikvision-intercom`, branch `codex/wiskey-mac-arx-alignment-delivery-2026-10-29`, fixed commit
  `11903a809d795da0bca5b3200f539ebe45a52522`, root `docs/owner-development-2026-10-29/mac-arx-alignment-completion/`.
- Native product `4407121a8ad9df2bbebc07161808bbbc2664b592` (WisKey branch `codex/wiskey-mac-wr5-development-2026-10-19`).
- The Windows intake branch `codex/wiskey-windows-arx-alignment-intake-2026-10-29` (`7ceaa30dab0a9b281ca0e15f28cd1990c171387d`): its `canonical-arx-source/` 33 files were
  compared with `3b73bc5cd` and are byte-identical to it (33 of 33), i.e. it adds nothing to merge.

## OWNER DECISION (29.10, confirmed in chat) - overrides the R3 "automatic" policy

R3 (`EXACT_INSTALLATION_CONTRACT.json`, `authorize_installation_policy`, `activate_software`) proposes that the installer turns the
switch on by itself and enables station media, listen, template send, people messaging, pacing and the code-level send permit.
**Not adopted.** `wiskey.auto_install` stays OFF by default; no code path turns it on; every installation effect (staging, restart,
projection, source export, readiness observation, discovery flag, registry sync, activation) stays behind it. A foreign / already
installed `hikvision_intercom` is left as it is (`native_foreign_installed`; a newer one `native_newer_installed`); a tree Arx staged and
replaces is kept as `hikvision_intercom.smplwise-backup`. Activation keeps review M1 (only the unset station provider `auto`; feature
switches and `TEMPLATE_SEND_SUPPORTED` stay owner steps). Recorded as a contradiction with the delivery, not silently resolved.

## 1. Native component rc.39 (task 1)

`smplwise_vms/integration/hikvision_intercom/` replaced by the delivered ZIP (`custom_components/hikvision_intercom/**`, 377 files),
byte-exact (`-text`). Archive `WISKEY_NATIVE_2.0.0-rc.39+arx-align.20261029.04.zip`, 1 729 318 bytes, sha256
`32c54c65fc0c6ae9d1c99f733fe9fa8f6f0d5bbb47e01252356ee00e92b27eb0` (recomputed, equals the delivery's). Manifest sha256
`e94a58d2f228a6c1d245111ea367332b847581a357d25575f2e5dc06a6b3439f` (recomputed, equals). Per-file pin and `tree_sha256`
`6e4c425b8417be3d9fc0e61b014a01007434e29a34a55cc1b28000302bed573f` equal WisKey's `STAGED_NATIVE_PIN.json` and the ZIP's own pin.

Label to content mapping (`hikvision_intercom.pin.json` `label_history`, tested):

| Label | Product CODE | Files | Archive sha256 (first 16) |
|---|---|---|---|
| 2.0.0-rc.38 | `0a099c53d359...` | 370 | `cc78ca07912b8f69` (Arx's earlier pin) |
| 2.0.0-rc.38 | `cc50b3b15460...` | 374 | `0028c15670a0d218` (a DIFFERENT tree under the same label; never adopted) |
| 2.0.0-rc.39+arx-align.20261029.04 | `4407121a8ad9...` | 377 | `32c54c65fc0c6ae9` (current) |

Same-label-different-content is also covered by the installer: the bridge copy and the staging compare bytes (digest), not the label
(`bridge_install.install`, `stage_native_bundle`, `test_a_tree_arx_staged_is_replaced_and_kept_as_the_backup`).

**Could not be verified:** WisKey quotes the component digest `00df5e151fa8...` (and bridge `58eb5b4fc829...`) in `VERSION_MAP.json`. Recomputing
WisKey's own `installation_files.digest` over the delivered 377 files gives `d33d843b30c5343641261e3130c6e6706edf1b1cfd4bb427d1712506e94cbef0`. Their
live-run tree is not part of the delivery. Arx binds to the per-file pin and the tree hash (both match); the quoted digests are recorded
as "claimed, not reproducible" in the pin. The bridge digest is Arx's own (its source differs from WisKey's assembled one).

## 2. Semantic merge of the Arx-side contribution (task 2)

Base facts: for `bridge_install.py`, `wiskey_auto_install.py`, `wiskey_install_generation.py` and `wiskey_r2_contracts.py` the delivery's
`before/` files are byte-identical to ours at `3b73bc5cd` (so its `after/` is a clean delta on our code, our journal race fix included); for
`config_flow.py`, `__init__.py`, `wiskey_direct_catalog.py`, `wiskey_r5_catalog.jsonl` they are base-83a7 files, which our branch had already
moved past - those were merged by hand / regenerated, never replaced.

| File | Result |
|---|---|
| `wiskey_install_generation.py` | delivery delta taken: DB writer first, then `JOURNAL_LOCK` (their P2); our CAS / generation / claim logic unchanged |
| `wiskey_r2_contracts.py` | delivery delta taken (`reason` None-tolerant, partial digest maps while not ready, outcome table path) |
| `bridge_install.py` | digest-based bridge copy + projection invalidate taken; `authorize_installation_policy` call NOT taken (owner decision); wrapper opens its own connection when none is given |
| `wiskey_auto_install.py` | taken: pair-digest restart decision, projection publish, `dispatch_claimed_restart` (signed `installation/request_restart_v2` under the one Arx claim, HA REST only for the first bootstrap, no fallback after I/O), `observe_readiness` (read-only retries, deadline never re-issues a restart), source export. NOT taken: automatic switch, `activate_software` enabling features / send permit. Added: `reconcile_due` returns before any readiness read with the switch off; `route_snapshot` |
| new `wiskey_distribution_digest.py` (services + bridge copy, identical), `wiskey_native_projection.py`, `wiskey_existing_whatsapp_source.py`, `wiskey_runtime_preflight.py` | taken; Windows-dev portability (`O_NOFOLLOW`, directory fsync) and `invalidate()` no longer creates `.storage/...` when nothing was published |
| `custom_components/smplwise_bridge/__init__.py` | only the import-time `LOADED_*` observation appended (the delivery's file lacks our owner28 `_async_setup_native`, so it was not taken); mirror re-synced |
| `config_flow.py` | no new R3 delta (the delivery's after = the owner28 file we already adopted) |
| `wiskey_r5_catalog.jsonl` | regenerated from the R3 `COMMAND_CATALOG.jsonl` (sha256 `3123d20d0868...`, 295 rows) with our trim script: 290 registered + 4 direct-only = 294 commands, 44 families; `CALLER_MAP.json` regenerated |
| `wiskey_direct_catalog.py` (approval hooks) | logic unchanged: `jobs/approval_request|decide` stay excluded unless the installation switch is on (review M2); docstring records the R3 business rules (signed actor, confirmed, revision, 24h review, different approver stay inside Native). The delivery's `OWNER_EXCLUDED_WRITES = frozenset()` NOT taken |
| `contracts/wiskey/alignment-v1/public_outcomes.v2.compact.json` | union of our R2 table and the delivery's v2 table (926 codes, 54 typed rows kept): the delivery's file drops 4 R2 codes (`intercom_snapshot_not_ready`, `intercom_media_expired`, `requested`, `intercom_no_video`) and the typed rows |
| `contracts/wiskey/alignment-v1/schemas/` | WisKey's 17 schemas + 68 examples, byte-exact (indexed sha256 checked by a test) |
| station still | the frontend keeps `GET /intercom/stations/{id}/camera-snapshot.jpg`; with the switch on and the station online, that route and `GET /access-control/stations/{id}/thumbnail.jpg` both ask the installed WisKey (`media/station_snapshot_v1`) first via `route_snapshot`; native "no still" falls back to the route's own path, any other native failure is the closed 503 `intercom_snapshot_not_ready` (no cause text). No new route, nothing overwritten with base-83 files |

R3's own limits, repeated: the canonical `intercom_media.py` / go2rtc / screen sources were not in its curated 11 files, so WisKey could not
prove the route/UI adoption (BLOCKED on its side); the cloud template export is still blocked externally; uninstall / purge is
NOT_IMPLEMENTED in the delivery.

## 3. Tests

See the run table in the hand-over report; nothing here is claimed as passed unless the table says so.
