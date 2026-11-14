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
| `pytest -p no:xdist` the new tests of every backend branch (`test_notify_fanout_2436`, `test_bill_ledger_cross_kind`, `test_bridge_runtime_2436`, `test_query_plans`) + `test_migrations`, `test_notify_core`, the notify / alert / maintenance / billing / media-commands tests the branches name, and the bridge and WisKey bridge tests (42 files, 1,418 tests) | 1,405 passed, 13 skipped, rc 0 (about 2 h serial on the loaded workstation; counted from the progress lines, `-q` hides the summary) |

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

### Entry check round 1 (2026-11-14): RED, 24 failures

`entry_pilot-CR-WAVE1B-COMBINED-2436_ffb4af2d5.md` (queued 598 min, run 151 min; full backend and frontend selection). Every failure
was classified **real** (all failed again alone); none is infrastructure.

| Failures | Belongs to | Fix |
|---|---|---|
| 18 frontend unit specs (six specs x desktop / tablet / mobile) that read the settings registry from `routers/settings.py` | wave 1 (CR-SETTINGS-STORE) | on `pilot/CR-WAVE1-COMBINED-2436` @ `e59f9170e` (see its note), merged here |
| `test_gate_always_run.py::test_every_package_scanner_is_listed_or_reviewed` | wave 1 (BE-GATES, READCONN-A, UPLOAD-SYNC) | same commit on the base |
| `test_provision_backchannel.py::...backchannel_off`, `test_provision_playback.py::...stays_in_the_namespace` | wave 1 (GO2RTC-ADAPTER) | same commit on the base |
| `test_custom_roles.py::test_custom_role_lifecycle_and_impact` | this batch (AUDIT-INDEX): the new `idx_audit_action_at (action, at)` makes SQLite read `WHERE action LIKE 'rbac.role.%'` through the index, so rows come back in action order; the test's query had no `ORDER BY` and relied on insertion order | the test reads `ORDER BY rowid`. Production readers of `audit_log` checked: they order explicitly (`ORDER BY rowid DESC`, `ORDER BY at`) |
| `layout-dd-place.spec.ts:248` tickets `/tickets/mine` and devices `/devices/areas/living`, desktop, placement 3 | timing in the shell, made more frequent here (see below) | `fitDd` waits for a loading title (below) |

The base `pilot/CR-WAVE1-COMBINED-2436` has no verdict of its own yet (round 1 NOT RUN, runner disk full), so none of these could be
compared with it; the 21 wave-1 failures were traced to their wave-1 commit by reading the cause.

**Placement 3 (`layout-dd-place`).** Logged with a temporary probe in `fitDd` (not committed): on both screens the chips were placed
while the page heading was not drawn yet (`title: null` on every pass), and after `DD_COLLIDE_MS` (900 ms) the safety net treated
"no title on the chips' row" as a collision and dropped the route to placement 1 for the visit. On this loaded workstation the same two
cases also fail on `origin/main` source (4 of 6 runs) and failed 3 of 3 on this branch, so it is a load-sensitive race between the
heading's data load and the 900 ms net, not one wrong line of a merged branch; the runner hit it on this branch only (twice, also alone).
Fix (shell, small behaviour change on slow loads only): `shell/dd-place-fit.ts` `DD_TITLE_WAIT_MS = 4000`; in `sw-app.ts` `fitDd`,
placement 3 with **no title yet** and nothing else colliding waits (the chips stay hidden until `data-dd-fit`, nothing is covered) up to
4 s in all, then falls back exactly as before. A title under the chips' row, a covered control, the corner or the viewport edge still fall
back after 900 ms; the "safety net" test still passes. Before: a slow heading lost the chosen placement for the route; after: the chips
appear once the heading is there.

Round 2 local checks (workstation, `--workers=1` / `-p no:xdist`, Vite dev server on its own port):
- `layout-dd-place.spec.ts --project=desktop -g "desktop 1440px, placement 3|safety net"`: 6 passed (the two cases failed 3 of 3 before)
- `layout-dd-first-paint.spec.ts --project=desktop`: 7 passed, 9 failed locally ("chip drawn when settled" / "no painted frame"), mostly placements 1, 2 and 4 and demo security screens, which this change does not touch; the runner passed this spec in round 1 on this branch, so read as local load (CPU saturated) - NOT a pass, the entry check decides
- `npx tsc --noEmit`: exit 0
- `pytest tests/test_custom_roles.py`: 3 passed
- the base fix's own checks: see `CR-WAVE1-COMBINED-2436.md`
