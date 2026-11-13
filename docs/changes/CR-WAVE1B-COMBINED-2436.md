# CR-WAVE1B-COMBINED-2436 - the second and third wave-1 code-review batches in one branch, for one runner entry check

Branch `pilot/CR-WAVE1B-COMBINED-2436`, cut from `origin/pilot/CR-WAVE1-COMBINED-2436` @ `94ba976b8` (the first combined batch, whose
entry check is queued), so this check also tests the interactions with that batch. Plan: `private/code-review-2026-11-13/MASTER_PLAN.md`
section 3. No version bump, no CHANGELOG entry. The only migration is CR-AUDIT-INDEX's 0216. No device, NVR, go2rtc, Home Assistant or
lab host was contacted.

## Merged heads (in this order, `git merge --no-ff`)

All eight branches share the merge base `665ec8f24` (2.43.4) with the base branch.

| # | Branch | Head | Conflicts |
|---|---|---|---|
| 1 | `pilot/CR-NOTIFY-FANOUT-2436` | `7ce51c137` | none |
| 2 | `pilot/CR-BILL-LEDGER-A-2436` | `7158fcfef` | none |
| 3 | `pilot/CR-BRIDGE-RUNTIME-2436` | `4d1d4b841` | none |
| 4 | `pilot/CR-AUDIT-INDEX-2436` | `bae5d7d3b` | none |
| 5 | `pilot/CR-DIAG-DEFECTS-2436` | `0e95b7213` | none |
| 6 | `pilot/CR-PLAN-EDITOR-HOT-2436` | `98bd41580` | none |
| 7 | `pilot/CR-MOCKS-LAZY-2436` | `60a309aed` | none |
| 8 | `pilot/CR-SHELL-LAZY-2436` | `a035d7e36` (contains `pilot/CR-NAV-LABELS-2436` @ `7e0c44191`) | none |

No two of the eight branches, and none of them and the base, change the same file, so git reported no conflict. Each branch's own note
stays in `docs/changes/<name>.md`.

## Interactions checked

- **NOTIFY-FANOUT and RECIPIENTS (base).** They agree. RECIPIENTS added `notify._active_principals` (one statement for every active
  user, used by `notify.managers`); FANOUT added `notify_visibility.active_principals` / `principals_of` (the same statement, the same
  `Principal` fields and `source="push"`, the same `ORDER BY id`), used by `maintenance/reminders.py` and `notify_channels.py`.
  Resolution, the one edit of this branch: `notify._active_principals` now returns `notify_visibility.active_principals(conn)`, so one
  builder remains. Same rows, same order; the name stays because `test_notify_recipients.py` calls it.
- **MOCKS-LAZY and API-BLOB (base), `frontend/src/api`.** No file in common. API-BLOB converted `tickets-table.ts`, `tickets-costs.ts` and
  `electricity-billing.ts` with its own `import('./tickets-mock')`; MOCKS-LAZY converted the other demo selectors through the new
  `api/demo-load.ts`. Both patterns stay (one per row's file list). After both, the entry chunk carries **0 mock modules**
  (`bundle-budget.mjs` deny-list), so the MOCKS-LAZY note's open item about `tickets-table.ts` is closed by the base. The "no `*-mock`
  module in the entry" rule is not added to `unit-entry-chunk.spec.ts` here: FE-GATES keeps its tools report-only in wave 1.
- **SHELL-LAZY and MOCKS-LAZY.** No file in common; `lazy-tags-check.mjs` (SHELL-LAZY's deny-list) is green on the combined build.
- **Migration 0216.** Only CR-AUDIT-INDEX adds a 0216 (`0216_review_indexes.sql`). `git ls-tree` of every `origin/pilot/*` and
  `origin/release/*` tip found no other `0216`; `origin/main` ends at 0215.
- **Bridge 0.10.7.** Both manifests read `0.10.7`; `scripts/sync_integration.py --check`: "integration mirror is up to date", rc 0.

## Tests run (workstation, Windows, Python 3.12 venv, Node 24.21.0; `-p no:xdist` / `--workers=1`)

| Command | Result |
|---|---|
| `scripts/sync_integration.py --check` | up to date, rc 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (368 s) |
| `node scripts/bundle-budget.mjs --dir dist` | see the entry chunk below; 0 mock modules, 36 dictionary modules in the entry |
| `node scripts/lazy-tags-check.mjs` | OK (1470 files, 366 eager, 549 tags, 96 route screens, 8 not in the entry) |
| `npx playwright test -c playwright.unit.config.ts --workers=1` `unit-mocks-lazy unit-media-players unit-plan-editor-hot-2436 unit-plan-editor-hot-lint-2436 unit-nav-labels-2436 unit-shell-lazy-2436 unit-entry-chunk unit-client-blob unit-client` | 107 passed |
| `npx playwright test --project=desktop --workers=1 tests/evidence-diagnostics-defects.spec.ts` (preview of this build on its own port) | 9 passed |
| `pytest -p no:xdist` the new tests of every backend branch (`test_notify_fanout_2436`, `test_bill_ledger_cross_kind`, `test_bridge_runtime_2436`, `test_query_plans`) + `test_migrations`, `test_notify_core`, the notify / alert / maintenance / billing / media-commands tests the branches name, and the bridge and WisKey bridge tests (42 files, 1,418 tests collected) | still running when this commit was pushed (serial, loaded workstation); the result is recorded in the follow-up commit |

NOT_RUN locally: the full backend and Playwright suites, pixel specs (DIAG-DEFECTS' General-tab baseline) - that is the runner entry check.

## Entry chunk (`npm run build`, `dist/assets/index-*.js`, this workstation)

| | raw bytes | gzip -9 bytes |
|---|---:|---:|
| `origin/main` 665ec8f24 (FE-GATES budget) | 4,074,343 | 1,156,938 |
| this branch | 3,212,305 | 918,045 |
| change | -862,038 (-21.2 %) | -238,893 (-20.6 %) |

## Entry check

Queued on the runner: `ENTRY_TOTAL_SECS=10800 ~/gate2/branch_check.sh pilot/CR-WAVE1B-COMBINED-2436 --max-wait 0`. The verdict is
recorded in a follow-up commit on this branch.
