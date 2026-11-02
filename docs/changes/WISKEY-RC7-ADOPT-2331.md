# WISKEY-RC7-ADOPT-2331 — the Arx side of the WisKey Mac rc.7 adoption (owner decision 1B)

Branch `pilot/WISKEY-RC7-ADOPT-2331` from `pilot/WISKEY-RELAYEXPORT-2320` (`e3de0d960`), merged with `origin/main` (`52a8d9129`).
Not merged to main, not in any train (WisKey ships last), no version bump. Nothing installed, released or switched on. No WisKey,
door, station, Home Assistant, NVR or runner contact. Plan: `private/planning/REPLY_TO_WISKEY_RC7_INTAKE_2026-11-01_HE.md`
(sections 3-8a).

## Input

- WisKey intake branch `codex/wiskey-windows-rc7-intake-2026-11-01` @ `3f4e5c1c47c70fac078796923a55db22004c0d20`,
  `docs/owner-development-2026-11-01/windows-rc7-intake/source/Arx-contribution/` (identical to the Mac handoff's
  `02_prepare_controller/Arx-source-patch/`).
- `Arx876-to-Mac-rc7.patch`, sha256 `e81859f6c9c24cf92a49eade6525e0cba2688fc431e16db05ae7d9f6cef69078` (re-measured at adoption).
  The patch applied cleanly on the merged base and was then adapted semantically; the verbatim patch was never committed.
- Owner decision 01.11 (1B): `wiskey.auto_install` stays OFF by default and NO code path turns it on; turning it on is an explicit
  owner step. The guards are adopted fully, the auto-activation is not.

## Merge with main

Four textual conflicts, resolved by hand:

| File | Resolution |
|---|---|
| `contracts/API_INVENTORY.md` | main's header (2.33.0). The route count is regenerated at release prep (`scripts/api_inventory.py`), not here. |
| `smplwise_vms/CHANGELOG.md` | the WisKey DRAFT section kept above main's 2.33.0 section |
| `smplwise_vms/backend/smplwise/main.py` | both router imports (`home_mapping` from main, `wiskey_relay_map` from the chain) |
| `smplwise_vms/backend/smplwise/services/backup.py` | both `SETTINGS_KEEP` additions (WisKey installation keys + main's restore-scope keys) |

Migrations renumbered after main's last migration (`0189_home_mapping`), contiguous 0001-0192 at that merge, content unchanged (a header line
records the renumbering):

| On the chain | At the main merge | Now (after the 2.35.0 train merge) |
|---|---|---|
| `0186_wiskey_installed_features.sql` | `0190_wiskey_installed_features.sql` | `0192_wiskey_installed_features.sql` |
| `0187_wiskey_relay_map_stations.sql` | `0191_wiskey_relay_map_stations.sql` | `0193_wiskey_relay_map_stations.sql` |
| `0188_wiskey_relay_map_exports.sql` | `0192_wiskey_relay_map_exports.sql` | `0194_wiskey_relay_map_exports.sql` |

Second renumbering (02.11): `origin/release/2350-train` was merged in (one textual conflict, `smplwise_vms/CHANGELOG.md`: the
WisKey DRAFT section kept above the train's sections; versions and the API inventory from the train, plus the WisKey route rows).
The train took 0190 / 0191 (`0190_calendar_attendees.sql`, `0191_calendar_grid_edit.sql`), so the three WisKey files follow it at
0192 / 0193 / 0194, contiguous 0001-0194, content unchanged (one more header line each). `wiskey.auto_install` stays OFF (decision B,
re-confirmed 02.11); the merge does not touch it.

References updated: `wiskey_installed_features.MIGRATION`, the docstrings of `wiskey_relay_map.py` / `wiskey_relay_map_export.py`,
`tests/test_wiskey_adopt_2272_review.py::test_l3_the_tables_come_from_migration_0192_and_the_consumers_run_no_ddl` and the docstring
of `tests/test_wiskey_relay_map_writer_2310.py`. None of the three was ever released, so no installed database recorded the old
numbers. The earlier change docs (WISKEY-RC4-2310, WISKEY-RELAYMAP-2310, WISKEY-RELAYEXPORT-2320) keep their historical numbers.

## Final adoption map

| # | Contribution file | Arx target | Adopted | Not adopted / changed |
|---|---|---|---|---|
| 1 | `routers/wiskey_relay_map.py` | `PUT /api/v1/wiskey/relay-map/{station_id}`, new `_sync_native` | After the CAS and its audit: commit, then `publish_selected` outside the transaction (`db.unlocked`) within one absolute 10 s budget. A failure never undoes, replays or fails the approval and is not shown as a CAS conflict. | (a) the outcome is an **audit row** (`wiskey.relay_map.synced` with seq / digest / ack state, or `wiskey.relay_map.sync_deferred` with the reason: `switch_off`, `not_selected`, `staged_activation_blocked`, a port code + outcome), not only a log warning. (b) nothing is sent unless the owner switched `wiskey.auto_install` on. |
| 2 | `services/bridge_install.py` | `_manual_owner_profile` | a symlinked component `_manual_upgrade_profile.json` is the manual profile | plus: `install()` under a manual profile now records the refusal through the native guard (read-only, no write to either component) |
| 3 | `services/wiskey_auto_install.py` | new `preflight_native`, `installer_step`, `stage_native_bundle` | manual / foreign detection before any write; lstat scan of the source before reading it; byte-exact pin; managed pin verification (profile, product_CODE, file_count, recomputed digest, no manual marker); an existing tree only if Arx owns it by `STAGED_DIGEST_KEY` (a byte-identical tree Arx did not stage is foreign); the manual check in `stage_native_bundle` as defence in depth | **`_approve_managed_bundle` (the switch write) is not adopted (1B).** The guards run read-only whatever the switch says; each new refusal is audited (`wiskey.installation.native_refused`, reason + code + switch + bundle digest, deduplicated against the latest refusal row in audit_log - no setting is written, so with the switch off nothing `wiskey.*` is written). With the switch off nothing is written (state `off`, reason `auto_install_off`). A legacy pin without a profile keeps the earlier staging rule. |
| 4 | `services/wiskey_direct_catalog.py` | `load()` extra entries | the five `installation/relay_map_*` commands (source, stage v1/v2, prepare v1/v2), taken from `wiskey_relay_map_native.COMMANDS` | review M2 exclusion of `jobs/approval_*` unchanged. Declared only. |
| 5 | `services/wiskey_native_projection.py` | `generation_fence`, `invalidate`, `publish` | flock on `generation.lock` around the projection write and delete; order DB -> `JOURNAL_LOCK` -> fence; busy > 2 s = `generation_fence_busy` | a **publication fence only** (WISKEY-R2-ALIGN-2272 stands): the file holds no state, counter or claim; the SQLite journal stays the only journal. Without `fcntl` every write/delete is refused with the typed `generation_fence_unsupported` (`publish` refuses before any DB write) - never skipped silently. The unlock is skipped when the lock was never taken. Cross-container flock is a B03 measurement. |
| 6 | `services/wiskey_relay_map_native.py` | new, same name | `publish` (commit before I/O, closed source / ACK shapes, ACK = staging only, local ack by `native:<entry_id>`, no retry, invalid ACK = `unknown`), `publish_selected`, `prepare_quiesced` | `publish_selected`: returns `switch_off` with no join lookup and no I/O while the switch is off; stage v1 only. `prepare_quiesced` requires a `maintenance_token` and has no caller: its only intended caller is the original controller's `maintenance_v1` (NOT_BUILT, section 3). The version check now happens before the export commit (a wrong version is `not_sent` before any I/O). |
| 7 | `tests/test_mac_managed_auto_policy.py` | same path | all 7 contribution tests (8 with the parametrization) | per 1B the two auto-activation tests became `test_approved_managed_fresh_install_does_not_activate_without_owner_switch` and `test_existing_owned_managed_tree_is_not_activated_by_the_installer`: the switch is not turned on by the installer, and after the owner's own switch the managed path stages / is up to date. The other refusal tests run with the owner's switch on (the guard must hold then too). Symlink tests are POSIX-only. |
| 8 | `tests/test_wiskey_relay_map_native_mac.py` | same path | all 5 contribution tests | the fake port is not Native proof; the symlink test is POSIX-only |

Closed fixes kept and re-run (not reopened): the deadline (`tests/test_wiskey_rc4_deadline_2310.py`), the door relay is the physical
relay (`e584d1533`, `tests/test_wiskey_rc5_relay_binding_2310.py`), the generation journal (CAS, I/O outside the lock -
`tests/test_wiskey_r2_align_2272_generation.py`, `tests/test_alignment_controller.py`, `tests/test_alignment_lock_order.py`),
non-CAS -> UNKNOWN without replay, tombstones and a row revision that only rises (migration 0194,
`tests/test_wiskey_relay_map_export_2320.py`, `tests/test_wiskey_relay_map_writer_2310.py`).

Not built here (design only, awaiting WisKey's answer): `maintenance_v1` (section 3), `relay-export-incarnation.v1` (section 4),
the Core runtime compatibility gate `core_runtime_unsupported` (section 5).

## Section 8a: no-overwrite proofs

`tests/test_wiskey_rc7_adopt_2331.py`. Every case asserts the digest of `custom_components/hikvision_intercom` (names, link
targets, bytes; lstat only) before == after, no new sibling (`.smplwise-backup`, `.smplwise-new`), `STAGED_DIGEST_KEY` unchanged, the
switch unchanged, no restart, and exactly one `wiskey.installation.native_refused` audit row (`decision = denied`, reason, code,
`component_written: false`, no path). Each runs with the switch off and on:

| Fixture | Reason | Code (switch on) |
|---|---|---|
| (a) manual install - component `_manual_upgrade_profile.json` | `manual_install_present` | `native_foreign_installed` |
| (a) manual install - config-level `hikvision_intercom_manual_upgrade.json` over an Arx-staged tree | `manual_install_present` | `native_foreign_installed` |
| (a) manual marker as a dangling link (POSIX) | `manual_install_present` | |
| (b) foreign tree (Arx staged something else) | `foreign_install_present` | `native_foreign_installed` |
| (b) byte-identical tree Arx never staged | `foreign_install_present` | `native_foreign_installed` |
| (b) target that is a link (POSIX) | `foreign_install_present` | |
| (c) bad managed pin - recomputed digest | `pin_mismatch` | `native_pin_mismatch` |
| (c) bad pin - bundle bytes changed after the pin | `pin_mismatch` | `native_pin_mismatch` |
| (d) valid managed bundle, switch off, Arx-owned older tree / fresh | `auto_install_off` | - |

Also: the positive control of (d) (owner switch on -> the owned tree is replaced and kept as the one backup), the bridge install under
a manual profile (neither component written, refusal audited), a static check that no production code writes `wiskey.auto_install`,
a check that `preflight_native` writes nothing, the fence refusal / exclusivity, and the relay map sync (switch off: no join lookup;
switch on: one stage, ack by the verified subject; lost ACK: approval kept, `unknown`, no retry).

## Test runs and receipts

Workstation (Windows 11, Python 3.12 venv), one pytest process, targeted files only (low memory: no vite, no Playwright, no full
suite). Command, from `smplwise_vms/backend`:

```
python -m pytest -p no:cacheprovider -o addopts="" -q -rs --junitxml=<receipt> <files>
```

| Run | HEAD | Files | Exit | Result | Receipt |
|---|---|---|---|---|---|
| run1 | `35a249ad235c2ef47f462ae289ae0b42eaa7bdd4` | the 21 files below without `test_wiskey_mac_adopt_298.py` | 1 | 311 passed, 10 failed, 13 skipped (814 s) | `receipts/WISKEY-RC7-ADOPT-2331/run1.junit.xml` |
| run2 | `d23ed8b4f30218ae89ada33ba863e355d7038f66` | the 22 files below | 0 | **358 passed, 0 failed, 21 skipped** (1067 s) | `receipts/WISKEY-RC7-ADOPT-2331/run2.junit.xml` |

run1's 10 failures, fixed in `d23ed8b4f`: 8 tests that publish the generation projection hit the new, intended
`generation_fence_unsupported` refusal on Windows (now POSIX-only, see below); `test_wiskey_r3_2272_owner_switch::test_the_switch_is_off_by_default_and_nothing_wiskey_is_written`
caught the first refusal dedupe writing a `wiskey.*` setting with the switch off (now deduplicated from audit_log, no setting);
`test_alignment_controller::test_current_runtime_catalog_and_approval_business_commands_are_reachable` expected 290 registered
commands (now 297 = the file's 290 + 2 emergency + 5 relay map; the base already had 292 runtime entries by arithmetic, so this
assertion was most likely already stale on `e3de0d960` - NOT verified by a run on the base).

run2 per file (passed / skipped / failed):

| File | P | S | F |
|---|---|---|---|
| test_wiskey_rc7_adopt_2331 (new: 8a proofs, 1B, fence, sync) | 26 | 5 | 0 |
| test_mac_managed_auto_policy (contribution, adapted to 1B) | 5 | 3 | 0 |
| test_wiskey_relay_map_native_mac (contribution) | 4 | 1 | 0 |
| test_wiskey_rc4_deadline_2310 (closed: deadline) | 5 | 0 | 0 |
| test_wiskey_rc5_relay_binding_2310 (closed: physical relay) | 9 | 0 | 0 |
| test_wiskey_r2_align_2272_generation (closed: generation journal, non-CAS -> UNKNOWN) | 6 | 0 | 0 |
| test_wiskey_r2_align_2272_contracts | 9 | 1 | 0 |
| test_wiskey_relay_map_export_2320 (closed: tombstones, row revision, migration 0194) | 32 | 0 | 0 |
| test_wiskey_relay_map_writer_2310 (migration 0193) | 20 | 0 | 0 |
| test_alignment_controller | 6 | 1 | 0 |
| test_alignment_lock_order | 1 | 0 | 0 |
| test_alignment_staging | 4 | 2 | 0 |
| test_bridge_install | 5 | 0 | 0 |
| test_wiskey_adopt_2272_installer | 6 | 3 | 0 |
| test_wiskey_adopt_2272_install | 39 | 2 | 0 |
| test_wiskey_adopt_2272_review (migration 0192) | 38 | 3 | 0 |
| test_wiskey_adopt_2272_contrib | 39 | 0 | 0 |
| test_wiskey_adopt_2272_features | 38 | 0 | 0 |
| test_wiskey_native_bundle_2272 | 7 | 0 | 0 |
| test_wiskey_r3_2272_owner_switch | 10 | 0 | 0 |
| test_migrations | 4 | 0 | 0 |
| test_wiskey_mac_adopt_298 | 45 | 0 | 0 |
| **Total** | **358** | **21** | **0** |

## NOT_RUN (for the runner, Linux)

Skipped on Windows in run2 - must run on the runner before this branch boards a train:

- symlink fixtures: `test_mac_managed_auto_policy::test_existing_manual_marker_refuses_before_policy_and_copy`,
  `::test_ignored_symlink_source_refused_before_target_read[.DS_Store|__pycache__]`;
  `test_wiskey_relay_map_native_mac::test_original_manual_profile_guards_even_when_probe_or_marker_is_broken`;
  `test_wiskey_rc7_adopt_2331::test_8a_manual_marker_as_a_dangling_link_is_a_manual_install[switch_off|switch_on]`,
  `::test_8a_target_that_is_a_link_or_holds_a_link_is_foreign[switch_off|switch_on]`;
  `test_wiskey_adopt_2272_install` (POSIX mode bits, symlinks), `test_wiskey_adopt_2272_review` (directory symlink).
- flock: `test_wiskey_rc7_adopt_2331::test_fence_is_exclusive_and_busy_is_typed`.
- the generation projection (fence refusal on Windows): `test_alignment_controller::test_projection_is_derived_from_only_current_sqlite_journal`,
  `test_alignment_staging::test_interrupted_native_rename_restores_old_tree_and_invalidates_ready`,
  `::test_partial_pair_is_observation_not_installed_generation`,
  `test_wiskey_adopt_2272_installer::test_switch_on_stages_the_pinned_bundle_and_requests_one_restart_per_digest`,
  `::test_a_tree_edited_after_staging_is_never_overwritten_and_never_restarted`, `::test_a_failed_restart_answer_is_never_replayed`,
  `test_wiskey_adopt_2272_review::test_h3_the_installer_stores_the_staged_digest_and_refuses_a_newer_tree`,
  `::test_m8_installer_step_on_a_database_error[request_component_restart]`.
- missing dependency on the workstation: `test_wiskey_r2_align_2272_contracts` (jsonschema).
- not run at all: the full backend suite, `scripts/release_check.py` (migration contiguity checked by test_migrations / test_calendar_attendees_2343: 0001-0194, 194 files),
  `scripts/api_inventory.py`, frontend / tsc / Playwright, the runner entry check, any live or B03 measurement
  (cross-container flock, HA backup/restore of `wiskey_lineage/*`).

## State

- Arx artifact: NOT_BUILT. No version bump, no merge to main, not in any train.
- Owner installation: NOT_PERFORMED. `wiskey.auto_install`: off by default, never turned on by code.
- Open for WisKey (section 8a of the plan): the full list of Native's manual / foreign markers and profiles (Arx detects
  `hikvision_intercom_manual_upgrade.json` at the config root and `_manual_upgrade_profile.json` in the component, link included);
  confirmation that Native never writes the component directory under a manual install (update, repair, recovery); a real rc.7
  manual-ZIP fixture if it differs. Section 3: the ABI of `maintenance_v1` (previous state `restart_requested`, the typed refusal of
  `prepare_v2`) before `prepare_quiesced` gets a caller. Section 4: the `incarnation` contract delta.
