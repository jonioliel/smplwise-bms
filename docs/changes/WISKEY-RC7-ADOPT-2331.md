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

## WisKey M12 policy B: slices S1 and S2 (02.11)

Input: WisKey contribution `M12-POLICY-B.20261102.01` (`docs/owner-development-2026-11-02/mac-policy-policy-b-completion/M12-01/Arx-source-patch/`
at WisKey `51a058e7`; intake verified at `f6c4b8fe`). Plan: `private/planning/WISKEY_M12_INTAKE_AND_ADOPTION_PLAN_2026-11-02.md`.
Neither `M12_POLICY_B_COMBINED.patch` nor `POLICY_B_FROM_RC10_CANDIDATE.patch` applies to this branch (`routers/settings.py` and
`wiskey_relay_map_native.py` moved on); adopted semantically by hand, no patch applied or committed. Policy B (owner, binding):
`wiskey.auto_install` OFF by default, no code path turns it on, only the owner's explicit verified action. Owner defaults applied
(recommendations, the owner may override): D1=b, D2=a, D3=a.

| Slice | Commit | What |
|---|---|---|
| S1 | `ed78a6a0e` | `wiskey.auto_install` is a separate closed entry (`wiskey_switches.INSTALL_SWITCH`) on the owner's EXISTING writer `PUT /wiskey/switches` (system.configure + system administrator, all or nothing, audited `settings.changed` before / after). D1=b: ON is refused 409 `auto_install_not_permitted` with a Hebrew reason while the build constant `wiskey_auto_install.OWNER_ON_PERMITTED` is False; OFF is always allowed; GET reports `auto_install_permitted`. Missing / null / unreadable / any value but the exact `on` is OFF; a null or non-string value is refused 422. Settings > Security > "קריאות בקרת כניסה": a separate "התקנה אוטומטית" group with the row, its confirmation wording and the refusal line (he / en / ar / ru; ar / ru initial translation). |
| S2 | `03b833626` | new `wiskey_auto_install.preflight_managed_runtime`, called by `installer_step` before the native writer: guards first (honest `refused` / `error` state also with the switch off - changed from `off`), then OFF refuses before any Core read and before the native writer (`auto_install_off`), then - owner ON + managed pin only - the Core runtime READ gate; anything but `supported` is `blocked` with the gate's closed code, audited. New `services/wiskey_core_runtime_gate.py` (contribution logic unchanged). No setting is written by the gate. A legacy pin keeps the earlier rule (no Core read). |

Not adopted / deviations (to tell WisKey):

1. The contribution's `SettingsPatch` field `wiskey.auto_install` (`PATCH /api/v1/settings`) is NOT adopted: it would be a second
   writer next to Arx's existing owner path. Pinned by `test_wiskey_rc7_adopt_2331::test_1b_exactly_one_writer_is_the_owners_switch_route`
   and `test_wiskey_m12_policy_b_owner_switch::test_the_generic_settings_route_is_not_a_second_writer`. The audit action is the
   route's existing `settings.changed` (key, before, after), not the contribution's `wiskey.auto_install.owner_action`.
2. D2=a (Arx deviation): the contribution's `preflight_managed_runtime` call in `bridge_install.install` BEFORE the bridge copy is not
   adopted - Arx's own `smplwise_bridge` keeps updating while the WisKey switch is OFF (the contribution's protection test asserts the
   opposite). The gate sits inside `installer_step`, in front of the native writer only. The manual profile still blocks both writers
   (unchanged). A foreign native tree does not block the bridge copy.
3. D1=b: the owner sees the switch but cannot turn it ON in this build. The build constant gates the writer only; the effects keep
   reading the stored value (a stored `on` can come only from a later permitting build or a direct database edit).
4. D3=a: the bundled native pin stays the rc.39 legacy pin; the rc.10 managed bundle is not shipped. The Core gate therefore has no
   production effect today (legacy pin = no Core read), and the switch cannot be turned ON anyway.
5. The Core gate has no image verifier in Arx: it is never `supported`. The positive controls in the tests use a SYNTHETIC
   `supported` verdict (labelled) to prove only the order (gate, then the original writer) - no Core support is claimed.
   `read_core` inside a running event loop refuses (`core_runtime_observation_thread_required`); the add-on start-up runs it in a
   worker thread. The bridge observer (`smplwise_bridge/core_runtime_v1`) is slice S4, not on this branch.

### Test run 3 (S1 + S2)

Workstation (Windows 11, Python 3.12 venv), one pytest process, the 22 run2 files plus the two new M12 files and the switches route
file. HEAD `03b833626808447b2d689b10f0c49df9e6554e21`. Exit 0: **452 passed, 0 failed, 21 skipped** (2143 s). Receipt
`receipts/WISKEY-RC7-ADOPT-2331/run3.junit.xml`. The 21 skips are the same POSIX / fcntl / jsonschema cases as run2.

| File | P | S | F |
|---|---|---|---|
| test_wiskey_rc7_adopt_2331 | 27 | 5 | 0 |
| test_mac_managed_auto_policy | 5 | 3 | 0 |
| test_wiskey_relay_map_native_mac | 4 | 1 | 0 |
| test_wiskey_rc4_deadline_2310 | 5 | 0 | 0 |
| test_wiskey_rc5_relay_binding_2310 | 9 | 0 | 0 |
| test_wiskey_r2_align_2272_generation | 6 | 0 | 0 |
| test_wiskey_r2_align_2272_contracts | 9 | 1 | 0 |
| test_wiskey_relay_map_export_2320 | 32 | 0 | 0 |
| test_wiskey_relay_map_writer_2310 | 20 | 0 | 0 |
| test_alignment_controller | 6 | 1 | 0 |
| test_alignment_lock_order | 1 | 0 | 0 |
| test_alignment_staging | 4 | 2 | 0 |
| test_bridge_install | 5 | 0 | 0 |
| test_wiskey_adopt_2272_installer | 6 | 3 | 0 |
| test_wiskey_adopt_2272_install | 39 | 2 | 0 |
| test_wiskey_adopt_2272_review | 38 | 3 | 0 |
| test_wiskey_adopt_2272_contrib | 39 | 0 | 0 |
| test_wiskey_adopt_2272_features | 38 | 0 | 0 |
| test_wiskey_native_bundle_2272 | 7 | 0 | 0 |
| test_wiskey_r3_2272_owner_switch | 10 | 0 | 0 |
| test_migrations | 4 | 0 | 0 |
| test_wiskey_mac_adopt_298 | 45 | 0 | 0 |
| test_wiskey_m12_policy_b_owner_switch (new, S1) | 34 | 0 | 0 |
| test_wiskey_m12_policy_b_native_gate (new, S2) | 31 | 0 | 0 |
| test_smallfixa_wiskey_switches_295 | 28 | 0 | 0 |
| **Total** | **452** | **21** | **0** |

Frontend (workstation, Node 24): `npx tsc --noEmit -p .` exit 0; `npx playwright test -c playwright.unit.config.ts
tests/unit-wiskey-switches.spec.ts --workers=1`: 9 passed.

Existing tests changed on purpose: `test_smallfixa_wiskey_switches_295` (the view has five keys and `auto_install_permitted`);
`test_wiskey_rc7_adopt_2331::test_8a_existing_install_is_never_overwritten_and_the_refusal_is_audited[*-switch_off]` (the honest
`refused` / `error` state instead of `off`); `::test_8a_d_after_the_owner_switch...` and two `test_mac_managed_auto_policy` positive
controls (a synthetic `supported` Core verdict).

### NOT_RUN (S1 + S2)

- the runner (Linux): the 21 POSIX / fcntl / jsonschema skips above, and the full backend suite;
- browser checks: `frontend/tests/evidence-switchui-295.spec.ts` (two new install-row cases, counts updated) and
  `frontend/tests/r5-security-shoot.spec.ts` (mock carries the install row) - updated, not run (no local vite / Playwright browser);
  no screenshots of the new row (desktop / phone / RTL) yet;
- the contribution's `test_m12_existing_install_protection.py` with the real rc.7 manual / rc.10 managed ZIP fixtures (not adopted
  as a file: its bridge-copy assertion contradicts D2; the same four refusals are covered synthetically in
  `test_wiskey_m12_policy_b_native_gate.py` and `test_wiskey_rc7_adopt_2331.py`) and `test_m12_controller_and_gate.py` (maintenance
  part is S3; the gate part is covered synthetically);
- `scripts/release_check.py`, `scripts/api_inventory.py` (the route's GET answer gained `auto_install_permitted`; inventory at S5);
- any Core read against a real Home Assistant, any device, HA, runner install or live action.

## WisKey M12 policy B: slice S3 - Q1 maintenance, DORMANT (03.11)

Input: the same contribution `M12-POLICY-B.20261102.01` (WisKey `51a058e7`, `M12-01/Arx-source-patch/after/`: `wiskey_install_generation.py`,
`wiskey_native_projection.py`, `wiskey_relay_map_native.py`, `tests/test_m12_controller_and_gate.py`; their `before/` files are byte-equal
to this branch except one docstring line), WisKey `docs/contracts/relay-maintenance-v1/` (`6049821d`, shapes of intent / witness /
request / result / journal.v2) and `history/rc10/M12-02/LIFECYCLE_ORDER_CLARIFICATION_HE.txt`, which wins over the shortened sentence of
the old `CONTRACT_HE` (witness before intent): the intent is committed and published with `witness = null` first, the witness provider
is called only afterwards, outside DB / JOURNAL_LOCK / fence. All read with `git show` only; no patch applied. Q2 (the witness producer)
stays BLOCKED, so the path is dormant.

| Slice | Commit | What |
|---|---|---|
| S3a | `ea6203200` | `db.on_transaction_end` (new, generic): a release that runs once right after the COMMIT / ROLLBACK of a write transaction (or when the lease closes), before the write gate is handed on. `wiskey_native_projection`: `MAINTENANCE_RELATIVE` (`maintenance.v1.json` next to `controller.v1.json`), `publish_maintenance` (DB -> JOURNAL_LOCK -> fence; writes the committed intent exactly as stored; `stale` without a published `installed` + `restart_requested` controller of the same generation; never writes or removes the controller), `invalidate` also withdraws `maintenance.v1`, and the fence may be re-entered by the thread that holds it (depth count; other threads / processes wait as before). `wiskey_install_generation`: the fenced `_store` - every writer that changes generation / digest / claim withdraws `controller.v1` + `maintenance.v1` under the fence BEFORE the row changes and keeps the fence until its transaction ENDS (also inside the add-on start-up transaction; `unlocked()` commits release it); no projection directory = nothing withdrawn, nothing created; without fcntl the writer refuses typed (`generation_fence_unsupported`, nothing written); journal.v2 (`format` / `schema_version` 2 / `maintenance_v1` / `maintenance_proof` / `maintenance_history`) in the SAME setting; `begin_maintenance`, `bind_maintenance_witness`, `maintenance_transition`, `_archive_maintenance`, `intent_sha256`; `begin` carries the history into the next generation. |
| S3b | `eb1c42733` | `wiskey_relay_map_native`: `PREPARE_V3` (sixth catalog command), `maintain` (the prepare_v3 caller), catalog comment; `test_alignment_controller` count 297/301 -> 298/302, `test_wiskey_rc7_adopt_2331` six commands. |
| S3c | `7afac5908` | `tests/test_wiskey_m12_s3_maintenance.py` (new). |
| S3d | `66a825c9e` | `test_wiskey_mac_adopt_298::test_e_the_runtime_catalog_is_the_final_one`: file + 8 runtime extras (was + 7), found by run 4. |

Order in `maintain` (all outside calls inside ONE `budget.scope`): switch OFF -> `switch_off`, nothing else; no provider ->
`blocked / relay_witness_unavailable`, nothing else; source + signed readiness (ready, same generation, `pair_digest(loaded)` = journal
digest) + current export; intent COMMITTED (`begin_maintenance`, witness null, `deadline_unix_ms` = the budget's end) and PUBLISHED; the
provider (outside every lock); witness bound by CAS; re-published; CAS `invalidated` + publication; CAS `dispatched` (refused past the
intent's deadline) + publication; ONE `prepare_v3` (request.v1 with `intent_sha256` of the exact stored intent); the answer verified
(result.v1 + the ACK of the same export) and kept as `maintenance_proof`. Before dispatch any failure cancels / refuses the intent;
after dispatch every failure - a lost answer, a transport `not_sent`, a signed error, a wrong hash or ACK, the end passing during the
call - is UNKNOWN; a second `maintain` is `stale` (UNKNOWN is never replayed, prepare_v3 is never sent twice).

Deviations / strengthenings against the contribution (to tell WisKey):

1. The fence is held until the caller's transaction ENDS, not released before the commit (`db.on_transaction_end`); the start-up
   transaction keeps it across its commit. Re-entry by the holding thread avoids a self-deadlock (flock is per open file description).
2. The withdrawing set is generation / digest / claim (as the contribution), plus the very first journal row; a state-only change
   (`finish_restart`, a proof, any maintenance CAS) does not withdraw `controller.v1` (Native's start-up may still be reading it; the
   caller re-publishes right after). `invalidate` also withdraws `maintenance.v1`.
3. Policy B inside the journal: `begin_maintenance` and the forward steps (`invalidated`, `dispatched`) refuse while the switch is OFF;
   settling (`cancelled`, `refused`, `unknown`, `prepared`) is always possible.
4. Closed shapes: the intent must be intent.v1 exactly with `witness = null` and a deadline still ahead; the witness must be witness.v1
   exactly, `status = current` and bound to the intent's generation / token / seq / content digest / repository / bridge entry / query
   owner; `invalidated` / `dispatched` need a bound witness; a token is never reused (also not from the history).
5. Local bookkeeping after the end has passed (cancel, UNKNOWN, the verified proof) runs outside the call budget: the database layer
   refuses every write inside an expired budget (`db._begin_immediate`), so the contribution's caller would have lost the UNKNOWN
   record of a timed-out prepare_v3. Pinned by `test_after_dispatch_every_failure_is_unknown_and_never_replayed[deadline]` and
   `test_a_verified_answer_at_the_very_end_of_the_budget_is_still_recorded`.
6. The loaded pair of the signed readiness must equal the journal's pair digest (the contribution checked state and generation only).
7. A failing provider is recorded `refused` and answered `refused / relay_witness_failed` (the contribution re-raised).
8. `prepare_quiesced` (v1 / v2) still has no caller; `maintain` sends prepare_v3 directly.

Dormancy proof (policy B, Q2 blocked): `test_dormant_switch_off_the_journal_writer_refuses_and_writes_nothing`,
`test_dormant_maintain_with_the_switch_off_does_nothing_at_all` (no port call, no provider call, journal unchanged),
`test_dormant_maintain_without_a_witness_provider_is_blocked_before_any_io`, and the static
`test_static_no_production_caller_no_witness_provider_and_prepare_v3_only_in_the_adapter` (no production module calls `maintain`, names
`witness_provider`, calls the maintenance writers outside the three S3 modules, or names prepare_v3). `wiskey.auto_install` is still
OFF by default, its one writer refuses ON in this build (S1), and nothing in S3 writes it.

### Test run 4 (S3)

Workstation (Windows 11, Python 3.12 venv), one pytest process, the 25 run3 files plus `test_wiskey_m12_s3_maintenance.py` and four
DB suites (db.py gained `on_transaction_end`). HEAD `7afac59085590bcd909f1142233defcd29863355`. Exit 1: **582 passed, 1 failed,
26 skipped** (3151 s). Receipt `receipts/WISKEY-RC7-ADOPT-2331/run4.junit.xml`. The one failure was a stale count pin
(`test_wiskey_mac_adopt_298::test_e_the_runtime_catalog_is_the_final_one`, + 7 -> + 8 for prepare_v3), fixed in `66a825c9e`; that file
re-run alone at `66a825c9e`: exit 0, **45 passed, 0 failed, 0 skipped** (receipt `run4b.junit.xml`). The other 29 files were NOT re-run
after that test-only commit. Run 4 skips = run3's 21 + the 5 POSIX-only fence cases of the new file.

| File | P | S | F |
|---|---|---|---|
| test_wiskey_rc7_adopt_2331 | 27 | 5 | 0 |
| test_mac_managed_auto_policy | 5 | 3 | 0 |
| test_wiskey_relay_map_native_mac | 4 | 1 | 0 |
| test_wiskey_rc4_deadline_2310 | 5 | 0 | 0 |
| test_wiskey_rc5_relay_binding_2310 | 9 | 0 | 0 |
| test_wiskey_r2_align_2272_generation | 6 | 0 | 0 |
| test_wiskey_r2_align_2272_contracts | 9 | 1 | 0 |
| test_wiskey_relay_map_export_2320 | 32 | 0 | 0 |
| test_wiskey_relay_map_writer_2310 | 20 | 0 | 0 |
| test_alignment_controller | 6 | 1 | 0 |
| test_alignment_lock_order | 1 | 0 | 0 |
| test_alignment_staging | 4 | 2 | 0 |
| test_bridge_install | 5 | 0 | 0 |
| test_wiskey_adopt_2272_installer | 6 | 3 | 0 |
| test_wiskey_adopt_2272_install | 39 | 2 | 0 |
| test_wiskey_adopt_2272_review | 38 | 3 | 0 |
| test_wiskey_adopt_2272_contrib | 39 | 0 | 0 |
| test_wiskey_adopt_2272_features | 38 | 0 | 0 |
| test_wiskey_native_bundle_2272 | 7 | 0 | 0 |
| test_wiskey_r3_2272_owner_switch | 10 | 0 | 0 |
| test_migrations | 4 | 0 | 0 |
| test_wiskey_mac_adopt_298 | 44 | 0 | 1 (stale pin; run4b 45 / 0 / 0) |
| test_wiskey_m12_policy_b_owner_switch | 34 | 0 | 0 |
| test_wiskey_m12_policy_b_native_gate | 31 | 0 | 0 |
| test_smallfixa_wiskey_switches_295 | 28 | 0 | 0 |
| test_wiskey_m12_s3_maintenance (new, S3) | 47 | 5 | 0 |
| test_db_gate | 31 | 0 | 0 |
| test_db_conn_pool | 26 | 0 | 0 |
| test_db_gate_stray_detector | 6 | 0 | 0 |
| test_db_locking | 21 | 0 | 0 |
| **Total** | **582** | **26** | **1** |

### NOT_RUN (S3, runner only - Linux, between release gates)

- the five real-fence cases of `test_wiskey_m12_s3_maintenance.py` (fcntl): `test_an_arx_decision_writer_waits_for_natives_commit_fence`,
  `test_the_fence_is_held_across_the_callers_start_up_commit[commit|rollback]`,
  `test_publish_maintenance_writes_the_exact_committed_intent_and_never_the_controller`, `test_the_caller_end_to_end_on_the_real_fence`;
- every run3 POSIX / fcntl skip again, now ALSO exercising the fenced `_store` (every generation / claim write with a projection
  directory takes the fence): `test_alignment_controller::test_projection_is_derived_from_only_current_sqlite_journal`,
  `test_alignment_staging` (2), `test_wiskey_adopt_2272_installer` (3), `test_wiskey_adopt_2272_review` (h3, m8),
  `test_wiskey_rc7_adopt_2331::test_fence_is_exclusive_and_busy_is_typed`, plus the symlink / mode-bit / jsonschema skips listed above;
- the full backend suite (db.py changed: only the four DB suites above ran here);
- not applicable on Windows by design: `test_without_fcntl_a_decision_writer_refuses_typed_and_changes_nothing` runs ONLY without
  fcntl (it passed here; it is skipped on the runner);
- cross-container flock between the add-on and HA (B03), any device / HA / runner / install / live action.

Open points (S3): the maintenance path stays dormant until (1) a Q2 witness producer exists (lineage outside Core and Arx restore,
advancing checkpoint per intent - BLOCKED, B03) and (2) a caller is wired (none); a crash between the intent commit and dispatch leaves an
active `intent` / `invalidated` row that blocks the next intent until the next generation (conservative, no janitor cancels it - for
WisKey to confirm); the fence's hold across the start-up commit and the thread re-entry are Arx additions to tell WisKey.

## State

- Arx artifact: NOT_BUILT. No version bump, no merge to main, not in any train.
- Owner installation: NOT_PERFORMED. `wiskey.auto_install`: off by default, never turned on by code; its one writer is the owner's
  `PUT /wiskey/switches`, and ON is refused in this build (`OWNER_ON_PERMITTED = False`, D1=b).
- M12 policy B: S1 + S2 + S3 done on this branch (above; S3 dormant: switch OFF and no witness provider). Open: S4 (bridge Core
  observer), S5 (merge main after 2.36.0 + migration renumbering - NOT done here; S3 added no migration), S6 (runner receipts incl. the
  S3 fence cases + build).
- Open for WisKey (section 8a of the plan): the full list of Native's manual / foreign markers and profiles (Arx detects
  `hikvision_intercom_manual_upgrade.json` at the config root and `_manual_upgrade_profile.json` in the component, link included);
  confirmation that Native never writes the component directory under a manual install (update, repair, recovery); a real rc.7
  manual-ZIP fixture if it differs. Section 3: `maintenance_v1` / prepare_v3 adopted dormant in S3 (previous state `restart_requested`);
  `prepare_quiesced` (v1 / v2) still has no caller. Section 4: the `incarnation` contract delta.
