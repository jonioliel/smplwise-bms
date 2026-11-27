# RELEASE-2550-TRAIN - the 2.55.0 train (pre-train)

Branch `release/2550-train`, worktree `C:\cloude\smplwise-2550train`, cut from `origin/release/2540-train` at `f9217db8a` (the 2.54.0
train's note commit; 2.54.0 was not released then). **2.54.0 was released on 27.11: `main` = `v2.54.0` = `3a0f02036`, which this
train already contains** (merged as `ac6b2063e`, checked: `origin/main` is an ancestor of the train). Coordinator: the 2.55 pre-train agent (merges, version
bump, train checks on the PC, one runner check job in slot B - section 3.5). No release gate was started, nothing was installed, no
lab, no Home Assistant, no device, no WisKey contact. `main`, the tags, the `addon` branch and `release/2540-train` are untouched.

**The UI bundle (`smplwise_vms/www`, `www-public`) is NOT rebuilt for 2.55.** Since the merge of the final 2.54.0 head (`ac6b2063e`) it
is 2.54's final build `c768bfc8a` (stamp version 2.54.0, source `7accbe97d`; before that the train carried 2.54's earlier build
`bdae0aaaa`). The 2.55 rebuild (`npm run build:addon` on the runner, the 2.54 way, section 3.4 of `RELEASE-2540-TRAIN.md`) comes last,
after the remaining rows are merged. Until then
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
| `5b72073b9` | Arabic and Russian for `waDeleteConfirm` (LOWS-FRONTEND-2550's SCR-53 confirm text, added in Hebrew / English only) in `lang/ar` and `lang/ru` `temperature.ts`, same `{when}` placeholder | PC after row 10: `unit-i18n-arru-completeness-2550` ar + ru and `unit-temperature` (ar / ru placeholders) - 3 failed, 143 passed over 14 files; after: 18 passed in the two files |
| - | train note | - | `5aa03829b` | - | - | section 3.5 |
| 5 | `pilot/LOWS-BACKEND-2550` | `9c0387c7f` | `7b068500b` | `f9217db8a` (release/2540-train) | none | `error_text_en.json` (still valid, its sorted format), `routers/notifications.py`, `wire/notifications.py`, `services/backup.py` merged cleanly with rows 1 and 4; billing golden `tests/fixtures/bill_ledger_b_sql_golden.json` refreshed in the row on purpose (D-08); no migration; Q1-Q6 = a |
| 6 | `pilot/LOWS-BRIDGE-GATE-2550` | `c68386d35` | `7a62d226c` | `f9217db8a` (release/2540-train) | none | **bridge 0.10.10** in both copies, byte-identical (section 1.3); `scripts/gate/*` and `nightly_tests.sh` are repo copies only, nothing installed; all questions = a |
| - | changelog | - | `a8f8acecf` | - | - | draft lines for rows 5-6, the bridge install note |
| - | registry / note | - | `0a8c7c96a` | - | - | rows 5-6 registered |
| 7 | `pilot/LOWS-FRONTEND-2550` | `ec2471927` | `fdc0cb1fc` | `f9217db8a` (release/2540-train) | `msg/components.ts` (en) | see below; frontend only; new `screens/map-room-bulk.ts`; `system-diagnostics.ts` merged cleanly with row 2; no baseline refreshed; Q1 = a (built), Q2-Q5 = a |
| 8 | `pilot/DOCS-GUIDE-2550` | `ae493fd48` | `907f9f446` | `5aa03829b` (this train) | none | docs + `test_docs_settings_2550.py`; documents rows 5 and 7; `GUIDE_ALL_HE.html` up to date after the merge; Q1 = a (the coordinator writes a short top-up of the what's-new page for the remaining rows at the end of the train - open point 8), Q2 = a |
| - | registry / note | - | `700486c5f` | - | - | rows 7-8 registered |
| 2.54 | `origin/release/2540-train` (final 2.54.0) | `3a0f02036` | `ac6b2063e` | - | `PROJECT_BOARD.html`, `management/STATUS.md` | see below; 2.54 passed its gate; brings the alarm-card ellipsis fix `9c5fc334c`, the test fix `7accbe97d`, the UI rebuild `c768bfc8a`, the gate note `bba451a5f`, the final changelog `3a0f02036` |
| 9 | `pilot/GATE-SPEED-2550` | `14a353ce4` | `0d9e3f0ef` | `5aa03829b` (this train) | none | gate engine repo copies only (`release_gate.py`, `gate_budget.py` new, `gate2_select.py`, `release_gate2.sh`, `branch_check.sh`, `engine_sync.py` INSTALL_MAP, `gate_durations.json`, `gate2_costs.json`, `selftest_gate_speed_2550.py` new, `test_gate_speed.py`); no file overlaps row 6's `scripts/gate` changes; NOT installed (the lead, before the 2.55 gate); all questions = a |
| - | registry / note / changelog | - | `18acfe3a0` / `7a6de3f7e` | - | - | row 9 registered; its changelog line |
| 10 | `pilot/I18N-ARRU-2550` | `553f10741` | `aa8d6a41d` | `5aa03829b` (this train) | none | ar / ru packs of door automation, elevators, generator log, temperature; `docs/i18n/ARRU_COMPLETENESS.json`, `scripts/i18n_missing_keys.mjs`; the completeness spec found row 7's new temperature key without ar / ru -> train fix `5b72073b9`; all questions = a |
| - | registry / note / changelog | - | `448681568` | - | - | row 10 registered |
| 11 | `pilot/DATA-RULES-2-2550` | `360c077e7` | `51d1ac37e` | `f9217db8a` (release/2540-train) | none (see 1.4) | generator battery choice, billing gap warning, reopen after an expired person draft; `wire-consumption.ts` regenerated in the row; 16 Linux pixel baselines of its own; no migration; all questions = a |
| 12 | `pilot/A11Y-NEW-2550` | `6affb349c` | `5adf8c729` | `5aa03829b` (this train) | none | new `components/focus-return.ts`, `a11y-new-2550.spec.ts`; 7 legacy-import-card baselines refreshed in the row; `sw-legacy-import.ts` merged cleanly with `8d6ce1665`; all = a, follow-ups deferred to a later row |
| 13 | `pilot/HOME-PERMS-WARN-2550` | `fb5fdd17a` | `1a72804a8` | `d65bbfd93` (row 5, in the train) | none | the site-wide warning (`sw-home-admin.ts`), the home electricity bill gate (bills category + `energy.bills`), `wire-home-interface.ts` regenerated in the row; new backend tests and `home-perms-warn-2550.spec.ts` with Linux baselines; all = a |
| - | registry / note / changelog | - | `e5819c35b` | - | - | rows 11-13 registered |
| 14 | `pilot/HOME-FIT-FOLLOWUPS-2550` | `ac45a3308` | `e39d511e4` | `f9217db8a` (release/2540-train) | none | `devices-building.ts` (page-area ResizeObserver) merged cleanly with rows 5, 7, 12, 13; `evidence-multibuilding-home-2330.spec.ts`: both sides kept - the 2.54 gate's `7accbe97d` (every line checked present) and this row's test appended at the end; `evidence-home-screen.spec.ts` (the picker test); all = a |
| - | registry / note / changelog | - | `e418684f4` | - | - | row 14 registered |
| 15 | `pilot/WIRE-DRIFT-2550` | `ff8f3a2f6` | `d1a7ab692` | `e418684f4` (this train) | none | wire models only: `wire/access_control_reads.py`, `wire/wiskey_validation.py`, the regenerated `wire-access-control-reads.ts` / `wire-wiskey-validation.ts`, new `test_wire_drift_2550.py`; removes `AccessControlReadsPersonPersonProfile` (no reference in `frontend/src` or `frontend/tests`); all = a |

Conflict:
- Row 1: `contracts/API_INVENTORY.md` - the train's version line (2.54.0, 1959 routes) against the row's three new `migration` routes
  (generated on the 2.52 base, 1951 routes). Resolved by regenerating with `scripts/api_inventory.py`: 1959 -> 1962 routes (the three
  `GET /migration/legacy`, `POST /migration/legacy/dry-run`, `POST /migration/legacy/apply`).
- 2.54 final (`ac6b2063e`): `PROJECT_BOARD.html` and `management/STATUS.md` (generated) - regenerated with `project_status.py --write`
  after `management/tasks.json` merged cleanly (2.54's evidence line and the 2.55 cards). `smplwise_vms/www` / `www-public`: no
  conflict (this train never changed them), so the merge carries 2.54's final bundle; kept as merged instead of forcing the older
  train build back (that would silently revert a 2.54 commit inside the merge) - either way a 2.54.0 build, rebuilt for 2.55 at the
  end. `smplwise_vms/CHANGELOG.md` merged cleanly: the 2.55.0 DRAFT section on top, the final 2.54.0 section below it byte-identical
  to `3a0f02036` (checked). Version files stay 2.55.0.
- Row 7: `frontend/src/i18n/lang/en/i18n/msg/components.ts` - LEGACY-IMPORT-UI-2550's English block (row 2) and LOWS-FRONTEND-2550's
  SCR-52 line were both appended at the end of the map; both kept, HEAD first; no duplicate key in the file (checked).

No other conflict (rows 5-8 included). All rows but one are merged. HA-STATE-RECONCILE-2550 is still running (the lead says when to merge it; checked now: it adds no migration - it
touches `routers/settings.py`, `services/ha_sync.py`, `services/settings_store.py`, DOCS / DOCS_HE and its own test). 2.54 fixes made on
`release/2540-train` after its gate are merged in when the lead says.

### 1.1 Migration numbering

The train's last migration (from 2.54 / `release/2540-train`) is `0226_push_subscription_sign_in.sql`; the 2.54 rows added none. Of the
four rows only ANDROID-PUSH-2550 adds one: `0227_mobile_unifiedpush.sql` (three nullable columns on `mobile_devices` + a partial index,
additive, with its own `Rollback:` note). No other branch on origin named `*2550*` / `*2560*` adds a migration (checked with `git diff
--name-only --diff-filter=A origin/release/2540-train...<branch> -- migrations migrations_energy` over every such branch, including
HA-STATE-RECONCILE-2550). **No collision, no renumbering**: 0227 stays. `migrations_energy/` unchanged. `release_check.py`: "migrations
contiguous: 227 files, last 0227_mobile_unifiedpush.sql".

### 1.4 The billing golden file (rows 5 and 11)

`smplwise_vms/backend/tests/fixtures/bill_ledger_b_sql_golden.json` was regenerated on purpose by LOWS-BACKEND-2550 (row 5, D-08: the
automatic run-row read) and by DATA-RULES-2-2550 (row 11). The two rows changed different statements, so git merged the file without a
conflict. Checked against the merged code: `SW_BILL_LEDGER_GOLDEN_WRITE=1 pytest tests/test_bill_ledger_lifecycle_b.py` (the rows'
way) rewrote it **byte-identical** to the merge result (no diff), and the normal run passes (25). Row 11's part of the diff: the
draft-bill retention SELECT reads `id, account_id, period_start, period_end, origin, replaces_bill_id` (not only `id`), followed by a
`DELETE FROM energy_auto_runs` / `water_auto_runs` of the period's `skipped` run rows (the reopen); row 5's run-row read stays as it was.

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

### 3.8 After the 2.54 final head and row 9 (at `0d9e3f0ef`)

| check | where | exit | result |
|---|---|---|---|
| `gen_wire_types --check` / `error_contract_inventory --check` / `i18n_backend_errors` / `wire_ratchet` / `request_strict_ratchet --check` / `sync_integration --check` / `build_guide --check` | PC | 0 each | match / 0 legacy 422 sites / 0 without English / 897 = baseline / 144 / up to date / up to date |
| `lint_spec_waits --new-since f9217db8a` / `design_ratchet` / `lint_backend --strict` | PC | 0 each | 0 findings in 10 files / no count above the baseline / 0 findings |
| `migration_downgrade_check --from origin/release/2540-train` | PC | 0 | PASS |
| `release_check.py` | PC | 1 | only the expected rows: the UI bundle (2.54.0 build) x2 and the v2.55.0 tag |
| `unused-exports.mjs --enforce` | PC | 0 | OK |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | PC | 0 each | 0 errors / 0 errors / clean / built |
| `test_gate_speed` / `test_gate2_select` / `test_gate_always_run` | PC | 0 each | 18 passed + 1 skipped / 17 / 19 passed |
| gate self-tests from the tree: `selftest_gate_trust`, `selftest_gate_speed_2550`, `selftest_gate_fast`, `selftest_engine_sync` | PC | 0 x 4 | SELFTEST PASSED / OK / PASSED / PASSED |
| `selftest_gate.py` | PC | 1 | `FileNotFoundError` (WinError 2) spawning its fake Playwright: a Linux-only self-test - the same failure at the 2.54 head `3a0f02036` on the PC, so not caused by this train |
| the five gate self-tests (`selftest_gate`, `selftest_engine_sync`, `selftest_gate_fast`, `selftest_gate_trust`, `selftest_gate_speed_2550`) from the tree | runner (`~/work/p2520_t2550_st.sh 0d9e3f0ef`, slot B, a temporary worktree removed after; nothing installed, `~/gate2` untouched) | 0 x 5 | SELFTEST PASSED x 4, SELFTEST OK |

### 3.9 After row 10 (at `5b72073b9`, PC)

| check | exit | result |
|---|---|---|
| the 14 `unit-i18n-*` files + `unit-elevators`, `unit-genlog-tempexplain`, `unit-temperature` (1 worker), at `aa8d6a41d` | 1 | 143 passed, **3 failed**: the completeness spec for ar and ru and `unit-temperature`'s ar / ru placeholder case - row 7's new `waDeleteConfirm` -> `5b72073b9` |
| the same 14 files after `5b72073b9` | 0 | **146 passed** |
| `tsc` app / `npm run typecheck` / `npm run lint` / `unused-exports --enforce` | 0 each | 0 errors / 0 errors / clean / OK |

### 3.10 After rows 11-13 (at `1a72804a8`, PC, one process at a time)

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` (rows 11 and 13 regenerated `wire-consumption.ts` / `wire-home-interface.ts`) | 0 | match |
| `api_inventory.py` / `error_contract_inventory --check` / `i18n_backend_errors` | 0 each | 1962 routes (unchanged) / 0 legacy 422 sites / 0 without English (2330 constant texts) |
| `lint_spec_waits --new-since f9217db8a` / `design_ratchet` / `wire_ratchet` / `request_strict_ratchet` / `sync_integration` / `build_guide` / `migration_downgrade_check` | 0 each | 0 findings in 17 files / no count above the baseline / 897 / 144 / up to date / up to date / PASS |
| `lint_backend --strict` / `ruff check smplwise` | 0 / 0 | 0 findings / clean |
| `release_check.py` | 1 | only the expected rows: the UI bundle (2.54.0 build) x2 and the v2.55.0 tag |
| `unused-exports --enforce` / `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 each | OK / 0 / 0 / clean / built |
| unit (1 worker): `unit-data-rules-2-2550`, `unit-legacy-import-2550`, `unit-no-ha-branding-2443`, `unit-i18n-en-ratchet-2490`, `unit-i18n-arru-completeness-2550` | 0 | 23 passed |
| **billing golden**: `SW_BILL_LEDGER_GOLDEN_WRITE=1 test_bill_ledger_lifecycle_b` (byte-identical, section 1.4), then `test_bill_ledger_lifecycle_b` 25, `test_bill_ledger_cross_kind` 11 | 0 each | passed |
| backend, one process each: `test_data_rules_2_billing_2550` 5, `_generator_2550` 2, `_water_2550` 2, `test_data_rules_billing_2540` 5, `_generator_2540` 9, `_water_2540` 4, `test_generator` 49, `test_energy_billing_api` 37, `test_water_billing_s3` 20, `test_home_bills_gate_2550` 5, `test_home_perms_warn_2550` 3, `test_home_v3_p2` 42, `test_lows_backend_2550_domain` 8, `_security` 7, `test_wire_ratchet_2480` 7, `test_i18n_errors_en_2520` 9 (+ the two golden files above) | 0 each | **250 passed** in 18 files |

NOT run on the PC: the rows' page / pixel specs (`a11y-new-2550`, `home-perms-warn-2550`, `pixel-data-rules-2-2550`,
`data-rules-2-2550-shots`, the refreshed legacy-import baselines) - Linux-only baselines and a served build; the rows ran them on the
runner.

### 3.11 After row 14 (at `e39d511e4`, PC)

| check | exit | result |
|---|---|---|
| `unused-exports --enforce` / `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 each | OK / 0 / 0 / clean / built |
| `design_ratchet` / `lint_spec_waits --new-since f9217db8a` | 0 / 0 | no count above the baseline / 0 findings in 17 files |

NOT run on the PC: the row's evidence specs (`evidence-home-screen`, `evidence-multibuilding-home-2330`) - a served build and the
runner's fixture lane; the row ran them on the runner.

### 3.12 After row 15 (at `d1a7ab692`, PC)

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` / `wire_ratchet` | 0 / 0 | match / 897 = baseline |
| `unused-exports --enforce` / `tsc` app | 0 / 0 | OK / 0 errors |
| backend, one process each: `test_wire_drift_2550` 15, `test_access_control_wire` 23, `test_wiskey_live_validation_2390` 58 | 0 each | **96 passed** |

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
2. **Row still to come** (the lead says when it is ready): HA-STATE-RECONCILE-2550 (no migration in it). Each: merge, its CHANGELOG line, registry card, PC checks.
   - **Bridge 0.10.10 in the lab** needs one more owner-approved Home Assistant restart after the 2.55.0 install (section 1.3); the
     row's runner install steps (nightly script, crontab) are the lead's.
   - **The guide top-up** (DOCS-GUIDE-2550 Q1 = a): at the end of the train the coordinator adds a short section to
     `docs/user-guide/he/19-whats-new-2530-2550_HE.md` (and DOCS / DOCS_HE "2.55.0" where needed) for the rows the guide row did not
     cover: LOWS-BRIDGE-GATE-2550 (bridge 0.10.10 and its restart) and the rows still to come; then `build_guide.py` regenerates
     `GUIDE_ALL_HE.html`. NOT done yet.
3. **2.54 gate fixes** - merged: the final 2.54.0 head `3a0f02036` (`ac6b2063e`). Any later 2.54 commit is merged in when the lead says (a merge, not a
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
