# WISKEY-RC4-2310 — adoption of the WisKey 2.0.1-rc.4 owner30 focused contribution

Branch `pilot/WISKEY-RC4-2310` (from `origin/main` 02db9b381, v2.27.2). Not merged to `main`; nothing released, installed or
switched on. No device, door, HA, lab or go2rtc contact.

## Inputs (verified before use)

| Input | Identity |
|---|---|
| WisKey Windows intake | commit `7083929d3b727eef2fcc6abfbf86efd6e1ca8b75`, `docs/owner-development-2026-10-30/windows-arx-upgrade-doors-intake/` |
| WisKey Mac delivery | commit `2c8b05a3ec0da9ba42dba1ff0327eab44c246cb4`, `docs/owner-development-2026-10-30/mac-arx-upgrade-doors/` |
| Native product source | `ffa92eecb90b7eb5a177837d0a6ad8f0893f4bea`, label `2.0.1-rc.4` (not re-verified here; quoted from the delivery) |
| Contribution patch | `arx-contribution/OWNER30_FOCUSED.patch`, 65078 bytes, sha256 `bf076d75714319a3a155248b2052edecc2e27f149992d8762a77df2054add7b5` (recomputed) |
| Patch base | Arx `8bd92456a798d828acd115c04cd87b2c99e73174` (= v2.27.1, an ancestor of this branch) |
| Fixture | `C03_contract/schemas/event_status.result.v1.valid.json`, 1090 bytes, sha256 `8b6087a4a49c2baad397e9f071ef8d1afe4f92e64d343173e21afbd96e43b02f` (recomputed) |

Both WisKey trees were read with `git archive` from the read-only clone; nothing was checked out or committed there.

## Merges into this branch

1. `pilot/WISKEY-R3-2272` (79de9401c) — merge 35644e578. It already contains `pilot/WISKEY-ADOPT-2272` (39d9daaf6) and
   `pilot/WISKEY-R2-ALIGN-2272` (3b73bc5cd: generation-journal CAS race fix + R2 contracts). One conflict: `CHANGELOG.md` — R3's draft
   section was titled `2.27.2 (DRAFT)` while main released a different 2.27.2; the draft now has a version-less heading
   (`## Next WisKey release (DRAFT ...)`, ignored by `release_check.changelog_head`) and states its one migration.
2. `pilot/WISKEY-R2-ALIGN-2272` — `Already up to date` (fully inside R3; the race fix is kept unchanged, R3 already reconciled the
   contracts).
3. `pilot/DOOR-ENGINE-LIVE-2310` (3e1dad166) — merge b996e4c0c, no conflict.
4. Owner30 patch — applied as a 3-way merge (the patch committed on its exact base in a scratch worktree, then `cherry-pick -n` onto this
   branch) and reconciled by hand: commit 23f3f17af.

### Migration numbers

`main` ends at `0182`. This branch adds exactly one: `0183_wiskey_installed_features.sql` (from WISKEY-ADOPT-2272), so the sequence is
contiguous today. **Renumbering note:** train 1 (`release/2280-train`) adds `0183_calendars`, `0184_building_presence`,
`0185_presence_history` and lands on `main` first. When this branch is rebased/merged after it, rename
`0183_wiskey_installed_features.sql` to `0186_wiskey_installed_features.sql` (content unchanged; its DDL uses `IF NOT EXISTS`; it was never
released, so no installed database carries the old number) and re-run `tests/test_migrations.py` and `tests/test_release_check.py`.

## Adoption map (20 paths)

Counts: **adopted as-is 16, adapted 4, superseded as a whole 0, rejected as a whole 0.** Two hunks inside adapted paths are superseded by
our code (listed under the path). "As-is" means the contribution's change is present byte-for-byte; where the final file differs from the
patch's after-file it is only by newer Arx code that was already on this line (R3/DOORLIVE) and that the patch did not touch.

| # | Path | Disposition | Notes |
|---|---|---|---|
| 1 | `custom_components/smplwise_bridge/__init__.py` | adopted as-is | `LOADED_DISTRIBUTION` = rc.4 digest of the loaded tree at import. Coexists with R3's later digest use. |
| 2 | `custom_components/smplwise_bridge/wiskey_distribution_digest.py` | adopted as-is | rc.4 `wiskey-posix-tree-sha256.v1` (exact names, case-alias/reserved-name refusal, no host case-fold ordering) replaces the R3 copy. Same bytes in all three copies. |
| 3 | `scripts/wiskey_posix_digest.py` | adopted as-is | Read-only recipe; run in the evidence. |
| 4 | `smplwise_vms/backend/smplwise/db.py` | adopted as-is | Connection/busy timeout clamped to the call budget. R3's `rollback_now` kept. |
| 5 | `smplwise_vms/backend/smplwise/services/bridge_install.py` | **adapted** | Adopted: manual-owner-profile guard (no copy, no discovery), digest-verified copy, re-copy on label OR content change. Adapted: kept R3's `wiskey_native_projection.invalidate` and the missing-target guard; an installed tree the digest refuses counts as "different" (replaced) instead of raising; a refused **source** tree is now `copy_failed:ValueError` (the patch raised an uncaught `ValueError` past `except OSError`). |
| 6 | `smplwise_vms/backend/smplwise/services/door_windows_engine.py` | adopted as-is | `EngineError` unknown-kind → `unknown`; idle docstring (software evidence, not a physical relock proof). `PROGRAM_/EMERGENCY_ENGINE_BUILT = True` were already set by DOORLIVE-2310 (same value); the DOORLIVE comment is kept. All admin switches stay OFF. |
| 7 | `.../services/wiskey_call_budget.py` | adopted as-is | New absolute RPC budget (context-scoped). |
| 8 | `.../services/wiskey_direct_catalog.py` | adopted as-is | `load()` adds `features/emergency_event_status_v1` and `features/emergency_secure_v1` (catalog file and its pin unchanged). |
| 9 | `.../services/wiskey_direct_discovery.py` | **adapted** | Adopted: `READER_REVISION = 2`, the named shapes (`_NATIVE_V1_KEYS`); unknown top-level keys still refused. **Superseded hunk:** the patch's hard `capabilities_invalid` on a malformed optional block — our review-M3 rule (a bad optional block is not offered and named in `rejected_blocks`; the core discovery stands) is owner-reviewed behaviour and accepts every document the rc.4 test requires. |
| 10 | `.../services/wiskey_direct_join.py` | **adapted** | Adopted: call budget in `call`/`run_sync`/`DirectCapturePort.call`, `SelectedFeaturePort`, `emergency_engine()` over the selected port. **Superseded hunk:** `startup()` installing the raw `DirectEmergencyEngine` as the process engine — DOORLIVE-2310's `door_engine_live.startup` (runs right after) installs `LiveEmergencyEngine`, which resolves the current join per call, keeps `lock_supported = False` (LOCK hidden) and delegates to the same `emergency_engine()`. Installing both would let `wiskey_auto_install`'s late `startup()` replace the live engine. |
| 11 | `.../services/wiskey_distribution_digest.py` | adopted as-is | See 2. |
| 12 | `.../services/wiskey_emergency_direct.py` | adopted as-is | `go_live_permitted` check, end-to-end budget (`unknown end_to_end_deadline`), durable event-status read on reconcile. |
| 13 | `.../services/wiskey_feature_direct.py` | adopted as-is | `event_status` + closed `read_event_status`; emergency start refused after admission → `unknown`. |
| 14 | `.../services/wiskey_program_direct.py` | adopted as-is | A non-CAS refusal → `unknown` (no false "not written"). |
| 15 | `.../services/wiskey_selected_readonly.py` | adopted as-is | Module only, wired nowhere; for the separately authorised read-only phase after an owner installation. |
| 16 | `smplwise_vms/backend/tests/test_owner30_doors.py` | **adapted** | Fixture path only (see below). |
| 17 | `smplwise_vms/backend/tests/test_wkcap_295.py` | adopted as-is | |
| 18 | `smplwise_vms/backend/tests/test_wkr5_295.py` | adopted as-is | Merged onto R3's catalog pins (294 commands). |
| 19 | `smplwise_vms/integration/smplwise_bridge/__init__.py` | adopted as-is | Mirror of 1 (`sync_integration.py --check` passes). |
| 20 | `smplwise_vms/integration/smplwise_bridge/wiskey_distribution_digest.py` | adopted as-is | Mirror of 2. |

### Our tests aligned with the adopted behaviour (commit 9020a3b34)

The targeted run on 23f3f17af found 3 failures out of 3563, all caused by deliberate rc.4 behaviour that our older pins did not know:

- `test_fake_doorwin_closed_rule_sr1::test_program_writes_are_pinned` — `wiskey_selected_readonly.py` names
  `technical_program_save/action`. Reviewed against SR-1: the names are used only for `join.selected(name)`, the catalog lookup and
  `transport_refusal(name)`. The only command it calls is `features/status`. The two sites are pinned.
- `test_wiskey_mac_adopt_298::test_e_the_runtime_catalog_is_the_final_one` — it now pins the catalog FILE (290 registered / 294) and
  asserts that the rc.4 runtime `load()` adds exactly the two emergency event commands.
- `test_wiskey_owner26_callers_297::test_program_errors_map_to_the_engine_kinds` — a non-CAS signed refusal of a program save is now
  `unknown`, not `refused`. The rc.4 change (row 14) is adopted, because nothing proves the program was not written.

## Fixture

The test read `Path(__file__).resolve().parents[4]/'contracts/event_status.result.v1.valid.json'` (a sibling folder of the Mac clone).
The exact delivered file is staged at `smplwise_vms/backend/tests/fixtures/wiskey/event_status.result.v1.valid.json` (1090 bytes,
sha256 `8b6087a4a49c2baad397e9f071ef8d1afe4f92e64d343173e21afbd96e43b02f`, unchanged). The test now reads it from there and asserts the
size and SHA-256 before use. `.gitattributes` marks `tests/fixtures/wiskey/*.json` `-text` (byte-exact). New hashes of the changed test
and of the run are in `docs/evidence/WISKEY-RC4-2310/RECEIPTS.json`.

## Test runs (this workstation only; receipts in `docs/evidence/WISKEY-RC4-2310/RECEIPTS.json`)

Python 3.12.10 (`C:\cloude\smplwisebms\.venv`, a venv of `%LOCALAPPDATA%\Programs\Python\Python312`), cwd `smplwise_vms/backend`.

| Run | Code SHA | Result |
|---|---|---|
| Source suite (C-ARX-FINAL-04 file list: owner30_doors, wkr5_295_emergency, wkr5_295, bridge_install, wkcap_295) | 23f3f17af | 100 passed |
| Targeted round 1: 116 files (`wiskey*`, `wk*`, `door*`, `bridge*`, digest, `migrat*`, `release_check`), 6 shards | 23f3f17af | 3560 passed, 3 failed, 7 skipped |
| Shards 0 and 4 re-run after the pin alignment | 9020a3b34 | 594 + 635 passed, 5 skipped |
| Targeted effective at 9020a3b34 | 9020a3b34 | 3563 passed, 0 failed, 7 skipped |
| `scripts/sync_integration.py --check`, `scripts/wiskey_posix_digest.py` (both bridge copies, staged Native tree) | 23f3f17af | exit 0; the two bridge copies have the same digest; the three digest modules are byte-identical |

NOT_RUN: full backend suite, UI build/screenshots (no UI change), Ubuntu runner, anything live. WisKey's 168/100/32 PASS
receipts are theirs; our 100 in the source suite is an independent run on Arx code.

## Item 3 — verified positive connection of the current feature host (manual path)

**Outcome: NOT_MEASURED / BLOCKED on an external source. Nothing was fabricated.**

Searched: both WisKey deliveries (all `STATUS.json`, `EVIDENCE_QUALIFICATIONS.json`, `ARX_SOURCE_REVIEW.json`, run starts), our repository
and `private-evidence/` (including the 29.10 lab backup of the HA config entries, keys only). Findings:

- The Mac delivery states that no genuine, already-existing current feature-host/ECC mapping exists in the manual legacy HA lab; positive
  paths are only original software tests with synthetic authority (C02 and C07 `current_feature_host_positive: NOT_MEASURED`).
- The lab config-entry backup holds only legacy `hikvision_intercom` entries and the `smplwise_bridge` pairing entry — no Native feature
  host, no native service grant, no ECC peer mapping.
- In Arx the connection itself exists and is wired (DirectJoin, provider `auto`, signed socket, `features/status`,
  `wiskey_selected_readonly.probe`), but a positive result needs a counterpart that does not exist yet.

Exact dependency: a WisKey Native 2.0.1-rc.4 **installed in the owner's HA** whose feature host is current and authenticated, with an
already-valid owner pairing/ECC peer mapping that admits Arx — created by the normal owner flow, never by Arx and never for a test.
Responsible: **owner** (installation and pairing, by a separate instruction), **WisKey** (the Native feature host and its mapping),
then **Arx** (the read-only `selected` probe in the separately authorised phase). Until then the measured refusal remains the only fact.

## Remainders (unchanged by this work)

- B03 HAOS/Supervisor native backup/restore: BLOCKED_RESOURCE / NOT_MEASURED (lab).
- C06 independent relock on power/network/HA outage and C09 `lock_secure`: NOT_PROVEN; LOCK stays hidden (owner decision).
- Installation at the owner: NOT_PERFORMED. Installed candidate `selected` and equipment: NOT_MEASURED.
- Arx built artifact / label for this branch: NOT_BUILT (no release; the Ubuntu runner was not used — a release gate is running).
- WisKey's original receipts (168 / 100 / 32 PASS) are theirs and were not re-run or re-attributed; our runs are separate receipts.

## Rollback

Revert commit 23f3f17af (the adoption) and, if needed, the two merge commits; no migration or setting is introduced by the adoption itself.
