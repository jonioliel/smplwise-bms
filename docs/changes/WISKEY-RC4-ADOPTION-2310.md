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

**Done in round 2 (2026-10-30):** `origin/main` (v2.28.0, `eda683371`) was merged into this branch (`b185d62f7`) and the file was
renamed `0186_wiskey_installed_features.sql` (`d72cebccf`, byte-identical content; its header comment still tells the history of the
number 0183). `wiskey_installed_features.MIGRATION` and the L3 review test follow it; `scripts/release_check.py` reports the sequence
contiguous (186 files, last 0186). Receipts: `docs/evidence/WISKEY-RC4-2310/round2/`.

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

## Round 2 — WisKey Windows review (review branch commit 8d57fad905d94f85c189a334a69edc78ff034469)

### WIN-ARX-RC4-DEADLINE-01 (P1) — fixed in `887344fb0`

Finding (static on WisKey's side): `LiveEmergencyEngine._engine` ran `selected` / `features_or_none` before any budget existed; after
`call_with_deadline` returned UNKNOWN the daemon kept waiting in the selection, and the inner `DirectEmergencyEngine._run` then opened a
fresh 6 s budget and could admit and send a `features/start` that never left before the deadline. Same on release.

Reproduced synthetically on `8c7c22a48` by the new test before the fix (receipt `round2/deadline_red_8c7c22a48.*`, EXIT CODE 1:
3 failed / 2 passed — a late hold `features/start` and a late release start were sent after UNKNOWN). Fix, no new engine/journal/scheduler:

| File | Change |
|------|--------|
| `services/wiskey_call_budget.py` | `until(end)` enters an absolute end; `scope()` = `until(now + s)`; both only shorten (`min`). `now()`, `deadline()`, injectable `_clock`. |
| `services/door_emergency.py` | `call_with_deadline` fixes the end BEFORE the daemon thread starts and runs the call inside `until(end)`; a spent budget inside is UNKNOWN `end_to_end_deadline`. |
| `services/door_engine_live.py` | apply/release enter the budget (the caller's end, shortened to `transport_timeout_s`, never extended) before selection and re-check it after; a wait that spent it starts nothing. Kind check, `lock_supported=False` and the permit-free release unchanged. |
| `services/wiskey_emergency_direct.py` | one budget re-check right before the admit (`client.start`). |
| `tests/test_wiskey_rc4_deadline_2310.py` | new, 5 tests (see the module docstring). |

Kept: UNKNOWN / partial-commit classification, actor/incident/target validation, release available with the business permit off.
A timeout does not cancel I/O already sent; it only stops new effects.

### Native bundle (packaging question)

The embedded Native is still `2.0.0-rc.39+arx-align.20261029.04`, product `4407121a8ad9df2bbebc07161808bbbc2664b592`, 377 files
(`smplwise_vms/integration/hikvision_intercom.pin.json`); it is not the manual rc.4 package (382 files, `ffa92eecb`). Not swapped.
Source fact: the embedded tree carries the emergency v2 contract but not `features/emergency_event_status_v1`, which the adopted
`DirectEmergencyEngine._read_durable` (C03) calls; against rc.39 that read fails closed (the attempt stays UNKNOWN). The required
package type (managed bundle in the image vs. owner-installed manual profile) is undecided.

## Round 3 (2026-10-31) — WisKey rc.5 host-assembly intake: consumer/ABI check + one Arx-side fix

Inputs read only (fetch + `git archive` into a scratch directory; nothing checked out, merged or installed):

| Input | Identity (verified here) |
|---|---|
| Windows intake | `codex/wiskey-windows-host-assembly-intake-2026-10-30` @ `ae3d677a854519e739190b8a847caf85abf10214`; archive 81608 bytes, sha256 `fbffb25d…f8053e8` (recomputed, equal) |
| Mac follow-up | `codex/wiskey-mac-host-assembly-followup-2026-10-30` @ `5439ffa465ad5afb86242b05bf6b70ebb45deb4d`; archive 27749810 bytes, sha256 `690041f9…85fc6a79` (recomputed, equal) |
| Native product | `bc2d8574543701c55b4380418b1909ffc1838d8d`, label `2.0.1-rc.5` (ancestor of the Mac follow-up head) |
| Manual package | `WISKEY_MANUAL_EXISTING_2.0.1-rc.5.zip` from the Mac archive: 1718764 bytes, sha256 `648f6fd6…2efd8c1fb`, 382 files; `scripts/wiskey_posix_digest.py` over it = `fa0aa0ec…dd888f45` (equal to the delivered component digest); its 381 Native files are byte-identical to `git archive bc2d8574` (only `_manual_upgrade_profile.json` differs) |

rc.4 -> rc.5 Native delta (`git diff ffa92eecb..bc2d8574 -- custom_components`): `access/native_emergency_recovery.py`,
`native_emergency_recovery_host.py` (startup binding covers exactly the entries with `managed_locks`; a relay-less entry gets no invented
StationGrant; a newly managed relay cancels readiness), `const.py` / `manifest.json` (label). No wire command, request field or answer field
that Arx reads changed. The consumer table is in the owner reply (`private/planning/REPLY_TO_WISKEY_RC5_HOST_2026-10-31_HE.md`).

### WISKEY-RC5-2310 — the door relay is WisKey's physical relay (fixed)

Found while mapping the relay/StationGrant consumers (pre-existing; not introduced by rc.5). Arx keys every door by WisKey's
`physical_index` (`door_windows._sync_doors`, the automation door list). WisKey binds a station-scoped request by
`params.relay == grant.physical_relay` and `params.mapping_revision == grant.mapping_revision` (`access/arx_door_execution.py:265-281`
`_primary` at bc2d8574; same rule in `arx_emergency_execution.py:141` / `arx_emergency_event_execution.py:156`), needs the grant
`(station, api_relay, physical_relay, revision)` to be a row of its startup mapping (`native_emergency_recovery_host.py:606-643`), and reads
the C07 history by the physical door (`emergency_status_api.py:58-70`). The three Arx callers looked the relay map up by **api** relay with
the door's physical relay. With a crossed map (api 1 -> physical 2, api 2 -> physical 1) a door automation sent the OTHER physical relay
(a consistent grant WisKey would execute), and an emergency hold was refused `binding_denied`; with an identity map nothing changed.
In production the map has no writer yet (relay map content is an open ECCACT item), so this was latent.

| File | Change |
|------|--------|
| `services/wiskey_feature_exec.py` | `relay_row_for_door(conn, station, physical_relay)`: the single active row naming that physical relay (none or ambiguous -> None). |
| `services/wiskey_emergency_direct.py` | apply/release: map row by the door's physical relay; `params.relay = row.physical_relay`, target `(station, row.api_relay)`. C07 read: `door = row.physical_relay`; a history target settles only when station, api_relay, physical_relay and revision all match. |
| `services/wiskey_auto_door.py` | same lookup; target `(station, mapped.api_relay)`. |
| `services/wiskey_feature_direct.py` | `FeatureAdapters.prepare`: default target of a relay request = the api relay of the physical door; after the snapshot, a request that does not bind exactly one grant (station, physical relay, revision) is refused `binding_denied` / `not_sent` (nothing stored, nothing sent). |
| `tests/test_wiskey_rc5_relay_binding_2310.py` | new, 9 tests (crossed map: lookup, emergency hold, missing row, C07 read door + api match, adapter guard, default target, door automation). |
| `tests/test_wkcap_295.py`, `test_t06_work_states_297.py`, `test_wiskeya06_297.py`, `test_t06_admission_295.py` | fixture only: the crossed map now has both rows (api 2 -> physical 1 added); their doors are physical relay 1, which the old fixture never mapped. |

Receipts: `docs/evidence/WISKEY-RC4-2310/round3/` (RECEIPTS.json, outputs, junit, file lists; Windows workstation, not the runner):

| Run | SHA | Result | EXIT CODE |
|-----|-----|--------|-----------|
| new relay test, red (before the fix) | `5b843c9f2` + the test file only | 8 failed, 1 passed | 1 |
| new relay test, green | `e584d1533` | 9 passed | 0 |
| deadline test (WIN-ARX-RC4-DEADLINE-01) | `e584d1533` | 5 passed | 0 |
| source suite (5 files) | `e584d1533` | 100 passed | 0 |
| targeted shards 0-5 (round-2 lists, 116 files) | `e584d1533` | 3563 passed, 0 failed, 7 skipped | 0 each |
| touched/related files (6) | `e584d1533` | 301 passed, 3 xfailed, 1 failed (pre-existing) | 1 |
| that failing test at `5b843c9f2` | `5b843c9f2` | 1 failed | 1 |

The one failure is pre-existing and outside this change: `test_t06_work_states_297::test_no_production_module_reads_features_status_as_a_result_or_a_go_live`
flags `services/wiskey_selected_readonly.py:25,26,33` (the owner30 read-only probe adopted in round 1 reads `features/status`). That test file is
not in the round-2 targeted lists. Left as is and reported to the owner. `sync_integration --check`, digests and `release_check`: EXIT CODE 0
(`round3/mirror_digest_checks.txt`); the embedded Native bundle is unchanged (377 files, `00df5e15…`).
Kept: UNKNOWN/partial-commit classification, the one deadline (WIN-ARX-RC4-DEADLINE-01, `887344fb0`), no replay, LOCK hidden.

## Remainders (unchanged by this work)

- B03 HAOS/Supervisor native backup/restore: BLOCKED_RESOURCE / NOT_MEASURED (lab).
- C06 independent relock on power/network/HA outage and C09 `lock_secure`: NOT_PROVEN; LOCK stays hidden (owner decision).
- Installation at the owner: NOT_PERFORMED. Installed candidate `selected` and equipment: NOT_MEASURED.
- Arx built artifact / label for this branch: NOT_BUILT (no release; the Ubuntu runner was not used — a release gate is running).
- WisKey's original receipts (168 / 100 / 32 PASS) are theirs and were not re-run or re-attributed; our runs are separate receipts.

## Rollback

Revert commit 23f3f17af (the adoption) and, if needed, the two merge commits; no migration or setting is introduced by the adoption itself.
