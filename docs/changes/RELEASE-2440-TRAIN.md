# RELEASE-2440-TRAIN - the 2.44.0 train

Branch `release/2440-train`, cut from `origin/release/2439-train` at `670716c08` (19.11.2026 ~08:35 Israel) in the worktree
`C:\cloude\smplwise-2440train`. Owner standing rule (18.11 night): one train and one release gate per version, fix forward with
targeted re-runs; no per-branch entry checks. The 2.43.9 gate was running on the runner while this train was assembled, so only
workstation checks ran until `v2.43.9` was tagged.

## 1. What merged (in this order)

| # | Branch | Head | Merge | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/CR-SHELL-EXTRACT-2440` - the shell's notification wiring as a controller | 422fb4eb5 | 2557ad19e | none |
| 2 | `pilot/CR-G1-HOME-AREA-2440` - home / area memoisation and shared pieces | aa11792c9 | 16345779c | none |
| 3 | `pilot/CR-CMP2-TOAST-2440` - CMP-2 switches to `sw-toggle`, 32 toasts on `ToastController` | 29bd38eda | 2439ab07f | 2 files, below |
| 4 | `pilot/CR-FE-SMALL-2440` | ead8884f6 | - | already contained in merge 3 (CMP2-TOAST had merged it) |
| 5 | `pilot/CR-FE-LOGEXPORT-TARIFF-EN-2440` - log export UI, English tariff names (contains CR-BE-SMALL-2440) | 0b03431c2 | 7ec6c4267 | 1 file, below |
| 6 | `pilot/CR-BE-SMALL-2440` | 208bd6634 | - | already contained in merge 5 |
| 7 | `pilot/CR-WATER-CUSTOMER-FORM-2440` | fe60a4c82 | aff45c68c | 1 file, below (a design merge) |
| 8 | `pilot/FIX-UNIT-PAGES-CONFIG-2440` | 8c236391e | 55ad0f261 | none |
| 9 | `pilot/FIX-FLAKY-POLISH-WORSTCASE-2439` (its product fix 0f0a4850e was already in 2.43.9; adds the test follow-ups) | 09e416dfc | db1e689bb | none |

Every head was checked against `origin` before its merge. `git rerere` recorded each resolution.

### Merge 3 - CR-CMP2-TOAST-2440
- `frontend/scripts/gates-baseline.json`: the train's two extra unused-export entries (`msg.ts#msgTables`, `sun.ts#LIGHT_MOODS`)
  against the branch's list - kept both, then pruned the two (no longer on a list) in 515cef619.
- `frontend/src/screens/investigate-incidents.ts`: import lines only - `activateKeydown` (CR-A11Y-ROWS-2443) and `ToastController`
  (the branch), both kept.

### Merge 5 - CR-FE-LOGEXPORT-TARIFF-EN-2440
- `frontend/src/i18n/msg/electricity.ts`: the branch (cut before CR-I18N-LAZY-LANG-2443) added four keys to the inline English table;
  the train reads that table from the English pack. Kept the `packTable` module; the four keys went to
  `i18n/lang/en/i18n/msg/electricity.ts`.

### Merge 7 - CR-WATER-CUSTOMER-FORM-2440 (two shared customer forms)
The train already had a text-free shared customer form (`electricity/customer-form.ts`, CR-I18N-ELECTRICITY-2443, used by the
electricity page; its comment said the water page would adopt it). The branch built `components/customer-form.ts` for BOTH pages
with a field renderer. Keeping both would leave the two copies the review (08:F25) asked to remove. Resolution: one module,
`components/customer-form.ts` - the train's helpers (`customerFormProblems`, `customerSaveBody`, `customerMatches`, `CUSTOMER_EMAIL`)
plus the branch's `customerField` renderer; the branch's duplicates `validateCustomerForm` / `customerUpdateBody` dropped. The water
page now also uses `customerFormProblems` (`numberRequired: false`), `customerSaveBody` (create and update; it trimmed the name before
too) and `customerMatches` (the same name / number / address search it had inline). `electricity/customer-form.ts` removed;
`unit-electricity-customer-form.spec.ts` imports the new path, `unit-customer-form-2440.spec.ts` checks the water side and that both
pages share the module.

## 2. Fix commits on the train

| Commit | What |
|---|---|
| ac0113506 | `node scripts/i18n-split-langs.mjs` re-run (LAZY-LANG note): moved the new `i18n/log-export.ts` English table into the English pack (1 table, 1,693 B); `lang/en.ts` index regenerated |
| 515cef619 | unused-exports gate: `CustomerFields` / `CustomerFieldOptions` file-local; two stale baseline entries pruned -> OK |
| ccecc796e | `tests/test_log_export_t033.py` used five private-range addresses -> RFC 5737 documentation addresses (the redactor masks every IPv4); fixes `test_no_ip_literals::test_no_unlisted_private_ip_literals` |
| e9d17b5ab | `tests/test_tariff_names_en_2440.py` read the English of `frontend/src/i18n/msg/*.ts` only; after LAZY-LANG those tables live in `i18n/lang/en/i18n/msg/` -> reads both (was `assert 0 >= 1`) |

## 3. Tests actually run before the gate (workstation)

Python 3.12 (main checkout `.venv`; `py -3.12` for ruff), Node 24.21.0, `frontend/node_modules` junction to the main checkout.
ESLint: the shared `node_modules` has no eslint / typescript-eslint / eslint-plugin-lit, so the pinned versions of `package.json`
(eslint 10.13.0, typescript-eslint 8.72.1, eslint-plugin-lit 2.3.1, typescript 5.9.3) were installed into a scratch folder and reached
through a temporary, git-ignored `node_modules` junction at the worktree root (removed afterwards).

| Check | At | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` | aff45c68c (after merge 7) | exit 0 / exit 0 |
| unit `unit-customer-form-2440`, `unit-electricity-customer-form`, `unit-water-billing` | aff45c68c | 15 passed |
| `node scripts/i18n-split-langs.mjs` | db1e689bb | moved 1 table (log-export) -> ac0113506 |
| `node scripts/unused-exports.mjs --enforce` | ac0113506 | FAIL 2 new file-local -> fixed 515cef619 -> OK |
| Playwright unit config, all `unit-*.spec.ts`, `--workers=1` | 515cef619 | **4982 tests: 4972 passed, 10 skipped, 0 failed** (7.1 min) |
| `ruff check smplwise` (py -3.12, ruff 0.17.5) and `scripts/gate/lint_backend.py --gate` | ccecc796e | All checks passed; 0 findings (blocking lane) |
| backend `test_no_ip_literals` + `test_log_export_t033` | ccecc796e | 26 passed (the IP-literals test failed before the fix) |
| backend, touched areas, `-p no:xdist`: `test_correlation*` (3), `test_font_licences`, `test_log_export_t033`, `test_tariff_names_en_2440`, `test_router_common_helpers`, `test_energy_billing_api/_engine`, `test_energy_tou_billing/_engine`, five `test_health_*`, `test_gate_always_run`, `test_singletons_registered`, `test_setting_callers_2440`, `test_async_routes_no_inline_db`, `test_no_ip_literals`, `test_db_gate_stray_detector`, `test_rbac`, `test_access` | ccecc796e | 280 passed, 2 skipped, 1 failed (`test_english_names_agree_with_the_frontend_tables` -> fixed e9d17b5ab -> file 6 passed) |
| backend, the lock / timing tests that failed in CR-BE-SMALL-2440's loaded runner run, alone (unloaded): `test_db_gate`, `test_devices`, `test_lat1_toggle_latency`, `test_ingest_lock_bound`, `test_commit_release_limiter`, `test_bridge_keyrot_harness_doors_295`, `test_lease_wire_closed_295`, `test_media_review_fixes`, `test_get_routes_read_conn` | ccecc796e | 978 passed, 4 skipped, 1 failed: `test_devices::test_bulk_not_sent_after_its_deadline_and_orphans_settled` (a call left inside a 0 s deadline while the PC also ran the unit suite) - re-run alone 3x together with `test_bulk_bounded_concurrency`: 6 passed, 0 failed. Every test named in the BE-SMALL loaded run passes unloaded: not fixed (timing under load, as the brief expected) |
| ESLint `eslint src --pass-on-unpruned-suppressions` | e9d17b5ab | exit 0, no report |
| `npx tsc --noEmit -p tsconfig.scripts.json` / `tsconfig.tests.json` / `tsconfig.json` | e9d17b5ab | exit 0 / 0 / 0 |
