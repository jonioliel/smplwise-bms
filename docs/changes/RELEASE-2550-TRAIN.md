# RELEASE-2550-TRAIN - the 2.55.0 train (pre-train)

Branch `release/2550-train`, worktree `C:\cloude\smplwise-2550train`, cut from `origin/release/2540-train` at `f9217db8a` (the 2.54.0
train's note commit; 2.54.0 is NOT released yet - its gate runs on that branch). Coordinator: the 2.55 pre-train agent (merges, version
bump, train checks on the PC, one runner check job in slot B - section 3.5). No release gate was started, nothing was installed, no
lab, no Home Assistant, no device, no WisKey contact. `main`, the tags, the `addon` branch and `release/2540-train` are untouched.

**The UI bundle (`smplwise_vms/www`, `www-public`) is NOT rebuilt.** It is still the 2.54.0 build of `bdae0aaaa` (stamp version 2.54.0,
source `7e2c937aa`). 2.54 may still change after its gate; the 2.55 rebuild (`npm run build:addon` on the runner, the 2.54 way, section
3.4 of `RELEASE-2540-TRAIN.md`) comes last, after the last 2.54 fix and HA-STATE-RECONCILE-2550 are merged. Until then
`release_check.py` FAILS on the two bundle rows (expected).

## 1. Merge log

Every row merged with `--no-ff` in the lead's order; each merge commit names the row head and the row's answered questions. `git log --all
--grep <ROW>` was checked for every row first: none was merged anywhere else (the only foreign hit, `8e7c3f8cf` on the 2.52 train,
quotes PILOT-ROLLBACK-2550's finding and is already in this branch's history).

| # | row | head | merge commit | base | conflicts | notes |
|---|---|---|---|---|---|---|
| 1 | `pilot/LEGACY-MIGRATION-2550` | `aa7a68c74` | `ba41fdfb6` | `91de5c377` (2.52 train) | `contracts/API_INVENTORY.md` | see below; Q1-Q4 = a |
| 2 | `pilot/LEGACY-IMPORT-UI-2550` | `14b407255` | `3e1ab2e35` | row 1 (`aa7a68c74`) | none | contains row 1 (checked: its head is an ancestor); only its own six commits come in; `system-diagnostics.ts` and the two English packs merged cleanly; Q1 = a (doc fix `6943fcfba`), Q2 = a |
| 3 | `pilot/PILOT-ROLLBACK-2550` | `9ee1eaad9` | `49d1ffffb` | `91de5c377` (2.52 train) | none | `main.py`, `db.py`, `release_check.py`, `events_ingest.py` merged cleanly; Q1 = a (already on the 2.52 train, `8e7c3f8cf`), Q2 = a, Q3 = a (blocking) |
| 4 | `pilot/ANDROID-PUSH-2550` | `3920151db` | `599398f73` | `3b4654f8b` (v2.53.0) | none | migration 0227 (section 1.1); `config.yaml` merged cleanly; Q1-Q3 = a |
| - | doc fix | - | `6943fcfba` | - | - | section 2 |
| - | version bump | - | `32a3432bc` | - | - | section 1.2 |
| - | train fix | - | `3f31dd97d` | - | - | section 2 |
| - | registry | - | `d74a31247` | - | - | section 4 |
| - | train fix | - | `1c389ba73` | - | - | section 2 |
| - | train note / registry | - | `4909a656e` / `51e390f86` | - | - | this note; section 4 |
| - | train fix | - | `8d6ce1665` | - | - | section 2 (found by runner run A, section 3.5) |
| - | train note | - | `5aa03829b` | - | - | section 3.5 |
| 5 | `pilot/LOWS-BACKEND-2550` | `9c0387c7f` | `7b068500b` | `f9217db8a` (release/2540-train) | none | `error_text_en.json` (still valid, its sorted format), `routers/notifications.py`, `wire/notifications.py`, `services/backup.py` merged cleanly with rows 1 and 4; billing golden `tests/fixtures/bill_ledger_b_sql_golden.json` refreshed in the row on purpose (D-08); no migration; Q1-Q6 = a |
| 6 | `pilot/LOWS-BRIDGE-GATE-2550` | `c68386d35` | `7a62d226c` | `f9217db8a` (release/2540-train) | none | **bridge 0.10.10** in both copies, byte-identical (section 1.3); `scripts/gate/*` and `nightly_tests.sh` are repo copies only, nothing installed; all questions = a |
| - | changelog | - | `a8f8acecf` | - | - | draft lines for rows 5-6, the bridge install note |
| - | registry / note | - | `0a8c7c96a` | - | - | rows 5-6 registered |
| 7 | `pilot/LOWS-FRONTEND-2550` | `ec2471927` | `fdc0cb1fc` | `f9217db8a` (release/2540-train) | `msg/components.ts` (en) | see below; frontend only; new `screens/map-room-bulk.ts`; `system-diagnostics.ts` merged cleanly with row 2; no baseline refreshed; Q1 = a (built), Q2-Q5 = a |
| 8 | `pilot/DOCS-GUIDE-2550` | `ae493fd48` | `907f9f446` | `5aa03829b` (this train) | none | docs + `test_docs_settings_2550.py`; documents rows 5 and 7; `GUIDE_ALL_HE.html` up to date after the merge; Q1 = a (the coordinator writes a short top-up of the what's-new page for the remaining rows at the end of the train - open point 8), Q2 = a |

Conflict:
- Row 1: `contracts/API_INVENTORY.md` - the train's version line (2.54.0, 1959 routes) against the row's three new `migration` routes
  (generated on the 2.52 base, 1951 routes). Resolved by regenerating with `scripts/api_inventory.py`: 1959 -> 1962 routes (the three
  `GET /migration/legacy`, `POST /migration/legacy/dry-run`, `POST /migration/legacy/apply`).
- Row 7: `frontend/src/i18n/lang/en/i18n/msg/components.ts` - LEGACY-IMPORT-UI-2550's English block (row 2) and LOWS-FRONTEND-2550's
  SCR-52 line were both appended at the end of the map; both kept, HEAD first; no duplicate key in the file (checked).

No other conflict (rows 5-8 included). More rows to come when the lead says: DATA-RULES-2-2550, HOME-FIT-FOLLOWUPS-2550,
HOME-PERMS-WARN-2550. HA-STATE-RECONCILE-2550 is still running (the lead says when to merge it; checked now: it adds no migration - it
touches `routers/settings.py`, `services/ha_sync.py`, `services/settings_store.py`, DOCS / DOCS_HE and its own test). 2.54 fixes made on
`release/2540-train` after its gate are merged in when the lead says.

### 1.1 Migration numbering

The train's last migration (from 2.54 / `release/2540-train`) is `0226_push_subscription_sign_in.sql`; the 2.54 rows added none. Of the
four rows only ANDROID-PUSH-2550 adds one: `0227_mobile_unifiedpush.sql` (three nullable columns on `mobile_devices` + a partial index,
additive, with its own `Rollback:` note). No other branch on origin named `*2550*` / `*2560*` adds a migration (checked with `git diff
--name-only --diff-filter=A origin/release/2540-train...<branch> -- migrations migrations_energy` over every such branch, including
HA-STATE-RECONCILE-2550). **No collision, no renumbering**: 0227 stays. `migrations_energy/` unchanged. `release_check.py`: "migrations
contiguous: 227 files, last 0227_mobile_unifiedpush.sql".

### 1.2 Version bump `32a3432bc`

`smplwise_vms/config.yaml`, the `io.hass.version` label in `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` ->
`2.55.0` (the places the 2.54 train set); `contracts/API_INVENTORY.md` regenerated (version line 2.55.0; 1962 routes). CHANGELOG: a
2.55.0 section at the top, **DRAFT** - the mark is in the section's comment, not the heading, as on the 2.52-2.54 trains
(`release_check.changelog_head()` reads 2.55.0 as the head). Draft lines for rows 1-4 and the Install note (migration 0227, the new
option `unifiedpush_servers`, rollback = the `auto-pre-upgrade` copy whose note reads "before upgrade 2.54.0 -> 2.55.0"), bilingual
per line. `frontend/package.json` keeps `0.1.0`; the demo version in `system-diagnostics.ts` is a demo constant (neither is bumped by a
train). Bridge: 0.10.10 from row 6 (section 1.3).

### 1.3 Bridge 0.10.10 (row 6)

LOWS-BRIDGE-GATE-2550 bumps the bridge 0.10.9 -> 0.10.10 (WB-06: `keyset.Persister.control` holds the lock for the whole rotation step;
a rollback leaves the set dirty) in `custom_components/smplwise_bridge/` and the add-on mirror `smplwise_vms/integration/smplwise_bridge/`.
After the merge the two copies are **byte-identical**: `diff -r` empty, the 35 git blob ids equal, `scripts/sync_integration.py --check`
"up to date", `release_check.py` "bridge integration copies identical" and "manifest = const: 0.10.10". `wiskey_media_v2.BRIDGE_REQUIRED`
stays 0.10.9 (a minimum).

**Correction of the row's note** (`docs/changes/LOWS-BRIDGE-GATE-2550.md`, "Restart"): it says the lab's active bridge stayed 0.10.8.
It is **0.10.9, active since 26.11** (the lead). So 0.10.10 does NOT ride on a pending restart: loading it in the lab needs **one more
owner-approved Home Assistant restart** after 2.55.0 is installed. The row's note is left as written (the row's record); this note and
the CHANGELOG Install line carry the correct state.

The row's runner install steps (`engine_sync.py install ... nightly_tests.sh`, the crontab line `--local-hour=02`) are NOT done - the
lead's, outside a gate / nightly.

## 2. Train fixes

| commit | what | found by |
|---|---|---|
| `6943fcfba` | `docs/operations/MIGRATION_FROM_LEGACY_HE.md` section 2א names the import screen (Settings > Backup and restore > "ייבוא מהמערכת הישנה", `#/system/diagnostics?tab=backup`) before the script / API steps | LEGACY-IMPORT-UI-2550 open question 1 = a (it named the train as the place) |
| `3f31dd97d` | `export` dropped from LEGACY-IMPORT-UI-2550's `LEGACY_WRITES` and `LegacyRun` (`api/legacy-migration.ts`, used only inside the file) | PC `unused-exports.mjs --enforce` (2 new file-local) -> OK |
| `1c389ba73` | English for ANDROID-PUSH-2550's five constant Hebrew refusals in `error_text_en.json` (`invalid_push_kind`, `unifiedpush_off`, the non-Android `invalid_platform`, `unifiedpush_endpoint_refused`, `push_keys_invalid`) | PC `i18n_backend_errors.py` "without English: 5" (the ratchet is 0); `test_i18n_errors_en_2520.py` before 1 failed + 8 passed, after 9 passed |
| `8d6ce1665` | LEGACY-IMPORT-UI-2550's card (`components/sw-legacy-import.ts`) had its own file-local table named `ACTION_LABEL`, the name of `api/access.ts`'s allow-listed table that only settings screens may read; the branding guard matches readers by name, so it reported "api/access.ts ACTION_LABEL <- components/sw-legacy-import.ts" although nothing of `api/access.ts` is read. The card's table is renamed `LEGACY_ACTION_LABEL` (no behaviour change) | runner run A: Node unit `unit-no-ha-branding-2443` 1 failed; PC after: `unit-no-ha-branding-2443` + `unit-legacy-import-2550` 10 passed, eslint 0, tsc app 0 |

## 3. Checks

All on the PC (Windows 11, Python 3.12, `C:\cloude\smplwisebms\.venv` for pytest, Node 24; the frontend `node_modules` junctioned from the
main checkout), one process at a time, at `1c389ba73` (the train fixes included) unless a line says otherwise. Nothing ran on the runner.

### 3.1 Generators, ratchets, lints

| check | exit | result |
|---|---|---|
| `scripts/gen_wire_types.py --check` | 0 | generated types match (ANDROID-PUSH-2550's `wire-notifications.ts` was regenerated in the row) |
| `scripts/api_inventory.py` | 0 | 1962 routes, version 2.55.0 (committed) |
| `scripts/error_contract_inventory.py --check` | 0 | 0 legacy 422 sites |
| `scripts/i18n_backend_errors.py` | 0 | **5 without English** before `1c389ba73`; after: 0 without English, 0 run-time (2329 constant texts) |
| `scripts/wire_ratchet.py` | 0 | 897 unmodelled routes = baseline |
| `scripts/request_strict_ratchet.py --check` | 0 | 144 tolerant web-UI models |
| `scripts/sync_integration.py --check` / `scripts/build_guide.py --check` | 0 / 0 | mirror up to date / guide up to date |
| `scripts/legacy_parity.py check` | 0 | PASS (C1-C8; C8 "Arx never touches the legacy files" holds) |
| `scripts/gate/lint_spec_waits.py --new-since f9217db8a` | 0 | 0 findings in 3 files (the legacy-import specs) |
| `scripts/design_ratchet.py` | 0 | no count above the baseline (px-literal 25512 against 25513 may be lowered) |
| `scripts/gate/lint_backend.py --strict` | 0 | 0 findings (ruff 0.17.5) |
| `ruff check smplwise` (backend) and the rows' new Python files | 0 | All checks passed |
| `ruff check` `scripts/migrate_legacy.py` / `scripts/release_check.py` | 1 | 4 / 7 findings - the same counts as at `f9217db8a` (pre-existing; the gate's ruff covers `smplwise` only) |
| `frontend/scripts/unused-exports.mjs --enforce` | 1 -> 0 | 2 new file-local exports (LEGACY-IMPORT-UI-2550) -> `3f31dd97d` -> OK, no export outside the baseline |
| `scripts/release_check.py` | 1 | everything ok (one version 2.55.0 everywhere incl. CHANGELOG head and API inventory; bridge 0.10.9; **migrations contiguous: 227 files, last 0227**; **downgrade-safe: v2.53.0 -> this tree 1 added, 1 backward-compatible**; design ratchet) except the expected: the two UI bundle rows (www still the 2.54.0 build) and the v2.55.0 tag |

### 3.2 Frontend (PC, one at a time)

| check | exit | result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` (app) | 0 | 0 errors (192 s) |
| `npm run typecheck` (tests + scripts) | 0 | 0 errors |
| `npm run lint` (eslint src) | 0 | clean |
| `npm run build` (to `frontend/dist`, not `www`) | 0 | built |
| `bundle-budget.mjs --dir dist --enforce` / `api-client-check.mjs` | 0 / 0 | OK / OK |
| unit (`playwright.unit.config.ts`, 1 worker): `unit-legacy-import-2550`, `unit-confirm-words-2442`, `unit-i18n-en-ratchet-2490` | 0 | 19 passed |

### 3.3 Backend, one pytest process per file (`pytest -q -o addopts= -p no:cacheprovider`)

| file | exit | result |
|---|---|---|
| rows' new / changed tests: `test_legacy_import_2550` 16, `test_migrate_legacy` 4, `test_confirm_words_2442` 52, `test_legacy_parity_t070` 10, `test_migration_downgrade_check` 28, `test_pilot_safety_2550` 6, `test_soak_edges_2450` 12, `test_android_push_2550` 34 | 0 each | **162 passed** |
| neighbours: `test_mobile_push` 53, `test_migrations` 4, `test_version` 1, `test_body_limit` 12, `test_backup` 8, `test_health_summary` 1, `test_commit_release_limiter` 2, `test_presence` 21, `test_local_privacy` 18, `test_docs_config_consistency` 7, `test_self_update_s3_fixes` 25, `test_singletons_registered` 4, `test_wire_ratchet_2480` 7, `test_error_contract_inventory_2490` 7 | 0 each | **170 passed** |
| `test_i18n_errors_en_2520` | 1 -> 0 | before `1c389ba73`: 1 failed + 8 passed; after: **9 passed** |
| `test_release_check` | 1 | 1 failed + 2 passed - `test_repository_is_release_consistent`, the UI bundle before the rebuild (the same expected row as `release_check.py`; the 2.54 train's run A had the same) |

### 3.4 Migrations (`0227_mobile_unifiedpush.sql`)

| check | exit | result |
|---|---|---|
| `scripts/migration_downgrade_check.py --from origin/release/2540-train` (-> the tree) | 0 | PASS: 0227 compatible (additive columns + index; its rollback note) |
| `scripts/migration_downgrade_check.py --chain v2.52.0,v2.53.0,origin/release/2540-train,WORKTREE` | 0 | PASS on every step and on v2.52.0 -> the tree |
| apply on an EMPTY database (the train's `Database.migrate()`) | 0 | 227 migrations applied, last 227; the three `push_up_*` columns and `idx_mobile_devices_up_endpoint` present; `PRAGMA integrity_check` ok |
| apply on a **2.54 database** (built with `release/2540-train`'s migration files), then the train | 0 | 226 applied (last 226, no `push_up_*` column), then the train applies exactly `[227]`; integrity ok; the resulting schema equals the empty-database path's schema |
| run the train's migrate again | 0 | applies nothing (idempotent) |
| backward compatibility: 2.54's migration set on the 2.55 database | 0 | applies nothing, no error; every 2.54 `mobile_devices` column kept (2.54 code never reads the new nullable columns; the downgrade check found no positional `INSERT INTO mobile_devices VALUES`) |
| `test_migrations.py` / `test_migration_downgrade_check.py` | 0 / 0 | 4 / 28 passed (above) |

### 3.5 Runner run A at `51e390f86` (`~/work/p2520_t2550_a.sh 51e390f86`, slot B, queued during the 2.54 gate; started 21:12 UTC after it, done 22:40 UTC; results `~/work/p2550a-out`)

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` / `i18n_backend_errors` / `lint_backend --strict` / `ruff check smplwise` | 0 each | match / 0 without English, 0 run-time / 0 findings / clean |
| `release_check.py` | 1 | NOT ready - only the expected rows (the UI bundle is the 2.54.0 build; the v2.55.0 tag) |
| backend, one process each, rows 1-4 and neighbours: `test_legacy_import_2550` 16, `test_migrate_legacy` 4, `test_legacy_parity_t070` 10, `test_confirm_words_2442` 52, `test_body_limit` 12, `test_backup` 8, `test_cameras` 8, `test_wire_consumption_2450` 13, `test_plan_routes_unique` 1, `test_raw_body_order` 16, `test_get_routes_read_conn` 744, `test_migration_downgrade_check` 28, `test_pilot_safety_2550` 6, `test_soak_edges_2450` 12, `test_health_summary` 1, `test_commit_release_limiter` 2, `test_android_push_2550` 34, `test_mobile_push` 53, `test_notices_push_295` 15, `test_tickets_app_push` 8, `test_notify_recipient_lang_2520` 13, `test_xsecfix_297` 48, `test_presence` 21, `test_presence_contract_v22` 63, `test_docs_config_consistency` 7, `test_fleet_report_215` 51, `test_frigate_addon_option` 3, `test_self_update_s3_fixes` 25, `test_push` 12, `test_local_privacy` 18, `test_no_ip_literals` 2, `test_migrations` 4, `test_singletons_registered` 4, `test_wire_ratchet_2480` 7, `test_error_contract_inventory_2490` 7, `test_i18n_errors_en_2520` 9, `test_version` 1 | 0 each | **1338 passed** in 37 files |
| `test_release_check` | 1 | 1 failed + 2 passed - `test_repository_is_release_consistent` (`res["ok"]`), the UI bundle before the rebuild, as on the PC |
| `tsc` app / `npm run build` | 0 / 0 | 0 errors / built |
| **Node unit suite** (2 workers) | 1 | **5465 passed, 4 failed**, 17 skipped: `unit-mfa-passkeys-2490` x3 (the known node-only harness, as on every train) and **`unit-no-ha-branding-2443` "the texts allowed outside the settings area are read by settings screens only"** -> train fix `8d6ce1665` (section 2) |
| `legacy-import-ui-2550.spec.ts` (mocks) desktop + mobile, 2 workers | 0 | **16 passed**, 4 skipped (the SW_SHOTS-only evidence cases) |
| backup-tab neighbours `offbox-backup-ui`, `evidence-diagnostics-defects`, `evidence-backup`, `evidence-backup-meters`, desktop + mobile | 0 | **29 passed**, 15 skipped (their own skips) |
| `pixel-legacy-import-2550` with `--grep pixel-stable` (as the gate), 1 worker | 0 | **6 passed** |
| `pixel-legacy-import-2550`, all cases, against the committed baselines | 0 | **6 passed** - the 2.52-based Linux baselines still match the 2.54-based tree; **no baseline refreshed, 0 PNG changed** (the job would have refreshed and re-checked them twice only on a mismatch) |

### 3.6 PC re-run after rows 5-6 (at `a8f8acecf`, one process at a time)

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` / `api_inventory.py` / `error_contract_inventory --check` / `i18n_backend_errors` | 0 each | match / 1962 routes (unchanged) / 0 legacy 422 sites / 0 without English, 0 run-time |
| `lint_spec_waits --new-since f9217db8a` / `design_ratchet` / `wire_ratchet` / `request_strict_ratchet --check` / `build_guide --check` | 0 each | 0 findings in 4 files / no count above the baseline / 897 = baseline / 144 / up to date |
| **bridge mirror**: `sync_integration.py --check`, `diff -r`, git blob ids; `test_bridge_install` 5, `test_mirror_deep_compare_2550` 3 | 0 each | up to date / identical / 35 equal / passed |
| `lint_backend --strict` / `ruff check smplwise` | 0 / 0 | 0 findings / clean |
| `release_check.py` | 1 | ok: bridge copies identical, manifest = const 0.10.10, covers the allow-list, migrations contiguous (227, last 0227), downgrade-safe; FAIL only the expected two UI bundle rows and the tag |
| `migration_downgrade_check.py --from origin/release/2540-train` | 0 | PASS (rows 5-6 add no migration; 0227 the only one) |
| `unused-exports.mjs --enforce` | 0 | OK, no export outside the baseline |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 each | 0 errors / 0 errors / clean / built |
| unit: `unit-pw-server-reuse-2550` (row 6), `unit-no-ha-branding-2443`, `unit-legacy-import-2550` | 0 | 13 passed |
| backend, one process each: `test_lows_backend_2550_security` 7, `_video` 6, `_core` 9, `_domain` 8, `test_janitor` 12, `test_bill_ledger_lifecycle_b` 25 (the refreshed golden), `test_bridge_install` 5, `test_mirror_deep_compare_2550` 3, `test_bridge_install_leftovers_2550` 2 (+1 skipped: no link right on Windows), `test_bridge_persister_rollback_2550` 2, `test_wiskey_service_grant_observe_2550` 4, `test_run_sh_sandbox_2550` 4, `test_coverage_lane_2550` 4, `test_nightly_local_hour_2550` 0 (7 skipped: Git Bash has no zone data - the row ran it on the runner), `test_wiskey_s4_core_observer` 30 (+1), `test_bridge_080` 3, `test_bridge_runnable` 110 (+1), `test_capmap_295` 65, `test_gate_addon_build` 6 (+6), `test_lovelace_card` 5, `test_bridge_config_drift` 13, `test_version` 1, `test_i18n_errors_en_2520` 9 | 0 each | **333 passed**, 16 skipped, 0 failed in 23 files |

Not re-run on the runner after rows 5-6: the Node unit suite (row 6's TR-10 moves `unit-mfa-passkeys-2490` out of the node-only run, so
its 3 known failures should be gone there), the Playwright / pixel specs, and the rows' wider backend areas.

### 3.7 PC re-run after rows 7-8 (at `907f9f446`, one process at a time)

| check | exit | result |
|---|---|---|
| `unused-exports.mjs --enforce` | 0 | OK, no export outside the baseline |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 each | 0 errors / 0 errors / clean / built |
| unit (1 worker): the five node-only `unit-lows-frontend-2550-*` (core, doors, screens, settings, wiskey), the changed `unit-automations`, `unit-i18n-api-2442`, `unit-studio-controller`, and `unit-legacy-import-2550`, `unit-no-ha-branding-2443`, `unit-pw-server-reuse-2550`, `unit-i18n-en-ratchet-2490`, `unit-i18n-lang-packs-2443` | 0 | **171 passed** |
| `test_docs_settings_2550` (row 8) / `test_docs_config_consistency` | 0 / 0 | 11 / 7 passed |
| `build_guide.py --check` / `lint_spec_waits --new-since f9217db8a` / `design_ratchet` | 0 each | up to date / 0 findings in 10 files / no count above the baseline (px-literal 25511) |

NOT run on the PC: `unit-lows-frontend-2550-pages.spec.ts` (a page spec with a mocked server - the row ran it on the runner), the
row's pixel files (the row: no baseline refreshed, the Hebrew screens unchanged), the Node unit suite as a whole after rows 5-8.

The migration script is a throw-away check in the coordinator's scratchpad (`migtest.py`: `smplwise.db.Database.migrate()` with
`MIGRATIONS_DIR` pointed at a `git archive` of `release/2540-train`'s migrations, then at the train's); no file of it is in the branch.

## 4. Registry

`management/tasks.json`: cards LEGACY-MIGRATION-2550, LEGACY-IMPORT-UI-2550, PILOT-ROLLBACK-2550, ANDROID-PUSH-2550 as REVIEW with the
row head and the merge commit (R-<id>-1 PLANNED, AT-<id>-1 NOT_RUN); RELEASE-2550-TRAIN IN_PROGRESS with evidence lines. T070, T035,
T036 and T096 unchanged (their acceptance needs the owner's installation, real equipment or the phone app). `py -3.12
scripts/project_status.py --write`: PASS (750 tasks, 864 requirements).

## 5. Open points

1. **The UI rebuild** (`npm run build:addon`, the build stamp) - NOT done; after the last 2.54 fix and HA-STATE-RECONCILE-2550. Until
   then `release_check.py` fails on "shipped UI bundle built for this version" and "built from these sources" (both say 2.54.0).
2. **Rows still to come** (the lead says when each is ready): DATA-RULES-2-2550, HOME-FIT-FOLLOWUPS-2550, HOME-PERMS-WARN-2550,
   HA-STATE-RECONCILE-2550 (no migration in it). Each: merge, its CHANGELOG line, registry card, PC checks.
   - **Bridge 0.10.10 in the lab** needs one more owner-approved Home Assistant restart after the 2.55.0 install (section 1.3); the
     row's runner install steps (nightly script, crontab) are the lead's.
   - **The guide top-up** (DOCS-GUIDE-2550 Q1 = a): at the end of the train the coordinator adds a short section to
     `docs/user-guide/he/19-whats-new-2530-2550_HE.md` (and DOCS / DOCS_HE "2.55.0" where needed) for the rows the guide row did not
     cover: LOWS-BRIDGE-GATE-2550 (bridge 0.10.10 and its restart) and the rows still to come; then `build_guide.py` regenerates
     `GUIDE_ALL_HE.html`. NOT done yet.
3. **2.54 gate fixes** - any commit added to `release/2540-train` after `f9217db8a` is merged in when the lead says (a merge, not a
   cherry-pick, so the 2.54 release commit stays an ancestor).
4. **Runner checks before the 2.55 gate** - the lead chose a): run A (section 3.5) at `51e390f86`. One real failure (the branding guard,
   fixed in `8d6ce1665`); the pixel baselines still match (none refreshed). `8d6ce1665` changes one frontend file after run A: the
   Node unit file that failed passed on the PC after the fix; the full Node unit suite was not re-run on the runner after it.
5. **Design ratchet** says `px-literal` can be lowered (25512 against 25513); left for the release step (`--update` only lowers).
6. The rows' open questions: all answered by the owner's standing rule (unanswered = the recommendation, "a" everywhere), as listed in
   the merge commits. ANDROID-PUSH-2550's owner checklist (pick a push server, set `unifiedpush_servers`) and the app team's connector
   are outside the release; the option stays empty = off.

NOT_RUN on the train: the release gate (the lead's), the UI rebuild, the full backend suite in one sweep (the rows' areas only, sections
3.3 and 3.5), the full Playwright suites beyond the specs named, the Node unit suite after `8d6ce1665`, tablet, every lab / Home
Assistant / device / WisKey / push-server / phone check.
