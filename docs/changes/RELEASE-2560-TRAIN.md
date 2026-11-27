# RELEASE-2560-TRAIN - the 2.56.0 train (pre-train)

Branch `release/2560-train`, worktree `C:\cloude\smplwise-2560train`, cut from `origin/release/2550-train` at `15ba75f92` (the 2.55.0
train; its release gate was still running, 2.55.0 not released; nothing was pushed to `release/2550-train`). Coordinator: the 2.56
pre-train agent (merges, version bump, draft changelog, PC checks). **The UI bundle (`smplwise_vms/www`, `www-public`) is NOT rebuilt
(still the 2.55.0 build), no gate was started, nothing installed, no lab / Home Assistant / device / WisKey contact.** `main`, the
tags and the `addon` branch are untouched. BACKEND-SUITE-COST-2560 is still running and is not merged.

## 1. Merge log

`git log --all --grep <ROW>` was checked first: no row was merged anywhere else. `--no-ff`, in the lead's order.

| # | row | head | merge commit | conflicts | notes |
|---|---|---|---|---|---|
| 1 | `pilot/CORE10-EVENTLOOP-2560` | `71615e9c0` | `809326af5` | `services/ha_sync.py` | see 1.1; base LOWS-BACKEND d65bbfd93 (already in 2.55) |
| 2 | `pilot/A11Y-FOLLOWUPS-2560` | `e8d5e6328` | `6da512f2d` | none | frontend only; one Linux pixel baseline added by the row |
| 3 | `pilot/WISKEY-VISIT-FILTERS-2560` | `0415275ac` | `12801e716` | none | backend only |
| 4 | `pilot/OPEN-FINDINGS-2560` | `8ea7168f5` | `71f3fa8dc` | none | frontend only |
| 5 | `pilot/GATE-NIGHTLY-2560` | `1899c99fb` | `d1a09d6d1` | none | `release_check.py` TR-03 check, tests; nothing installed on the runner |
| - | version bump / draft changelog / API inventory | - | `3f5727474` | - | 2.56.0 in `config.yaml`, `Dockerfile` label, `smplwise/__init__.py`; CHANGELOG 2.56.0 section on top, DRAFT in an HTML comment (heading clean, as on the earlier trains); `contracts/API_INVENTORY.md` version line (1962 routes, unchanged) |
| - | registry | - | (this commit) | - | section 4 |

### 1.1 The `ha_sync.py` conflict (CORE10-EVENTLOOP-2560 against HA-STATE-RECONCILE-2550)

Both edits sat at the same place at the end of `on_ready`. Resolution: **both kept** - HA-STATE-RECONCILE-2550's `reconciler` task
(inside `on_ready`) and CORE10's `resync_states` coroutine (after it, session level). No other hunk conflicted.

**Ordering of the reconcile's writes - changed, not left as is.** After the merge the periodic `reconcile_states` ran in the default
thread pool, concurrently with the state worker. A frame that arrived BEFORE the listing was asked for (so it was not in the
reconcile's `touched` set) could still be waiting in the worker queue; the repair would store the newer listed state, and the older
queued frame would then be applied on top of it (`on_state_changed` has no staleness guard) until that entity's next change. Fix in
this train (`809326af5`): `HaSync.reconcile_now` now runs `reconcile_states` as a **control job on the same `STATE_WORKER`**
(`_run_on_state_worker`: never refused, FIFO behind every queued frame, result awaited on the session loop; a cancelled awaiter drops
the result). A frame that arrives after the listing is in `touched` (marked by `on_event` on the reader, before it is queued) and the
repair leaves it alone; the same worker also runs `apply_resync`, so the two repairs cannot interleave. `touched` is cleared only after
the job finished (unchanged `finally`). The listing itself (`get_states`) is still awaited on the loop, never on the worker.
Test change: `test_a_state_update_lost_to_a_busy_database_is_repaired` patched `handle_state_event` around a synchronous `on_event`;
frames are now handled on the worker, so the test waits for `STATE_WORKER.wait_idle` before restoring the real writer (the
assertion that the update was really lost is unchanged). No new test for the ordering race itself (NOT_RUN: left for the row owner;
it needs a stalled worker and a controlled listing).

## 2. Train fixes

`809326af5` (section 1.1) only. No frontend change beyond the rows.

## 3. Checks (PC, Windows 11, Python 3.12 venv of the main checkout, Node 24; `frontend/node_modules` junctioned; one process at a time; at `3f5727474` plus the registry commit)

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` / `error_contract_inventory --check` / `i18n_backend_errors` / `wire_ratchet` / `request_strict_ratchet --check` | 0 each | match / ok / ok / ok / ok |
| `sync_integration --check` / `build_guide --check` / `design_ratchet` / `lint_spec_waits --new-since origin/release/2550-train` / `migration_downgrade_check --from origin/release/2550-train` | 0 each | up to date / up to date / no count above baseline / 0 findings in 1 file / PASS (no migration added) |
| `api_inventory.py` | 0 | 1962 routes (unchanged), version 2.56.0 |
| `ruff check smplwise` | 0 | All checks passed (`lint_backend.py --strict` itself: NOT_RUN, ruff is not in the venv; ruff 0.17.5 run directly) |
| `release_check.py` | 1 | only the expected rows fail: the two shipped-UI rows (www is the 2.55.0 build) and the v2.56.0 tag; TR-03 green-gate check is NOT_CHECKED (a WARNING: no `~/smplwise-results` on the PC) |
| `unused-exports.mjs --enforce` / `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` (to `frontend/dist`) | 0 each | OK / 0 errors / 0 errors / clean / built |
| `test_ha_state_reconcile_2550` + `test_core10_eventloop_2560` in one process, after the merge and fix | 0 | 16 passed |
| one file per process: `test_wiskey_visit_filters_2560` 6, `test_wiskey_visits_ended_filter_2520` 7, `test_nightly_lightening_2560` 2, `test_release_check_green_2560` 12, `test_core10_eventloop_load_2560` 1, `test_version` 1 | 0 each | passed |
| `test_release_check` | 1 | 1 failed + 2 passed - `test_repository_is_release_consistent`, the not-rebuilt UI bundle (same as `release_check.py`) |
| unit `unit-open-findings-2560` (1 worker) | 0 | 4 passed |

NOT_RUN: the Node unit suite as a whole, the Playwright / pixel specs (`a11y-new-2550`, `legacy-import-ui-2550` changed by A11Y-FOLLOWUPS-2560, the new DST baseline) - served build and Linux baselines, the rows ran theirs; `lint_backend --strict`; the
CORE10 soak (the row ran it); every lab / device / WisKey check; the release gate.

## 4. Registry

`management/tasks.json`, `requirements.json`, `test_catalog.json`: the five rows as REVIEW (R-<id>-1 PLANNED, AT-<id>-1 NOT_RUN) with
row head and merge commit; RELEASE-2560-TRAIN IN_PROGRESS. `scripts/project_status.py --write`: PASS (768 tasks, 882 requirements).

## 5. Open points

1. BACKEND-SUITE-COST-2560: merge when the lead says; add its CHANGELOG line (the draft marks it).
2. UI rebuild (`npm run build:addon` on the runner) at the end of the train, then the gate (the lead's). Any later change under the stamp inputs needs a new build.
3. The ordering test for the reconcile / worker race (section 1.1) is not written.
4. The CHANGELOG 2.55.0 section is still below the 2.56.0 one (2.55.0 is not released); the lead merges / rewrites at release.

## 6. Second round (27.11, after 2.55.0 was released: main = v2.55.0 = ad778e4ea)

| # | what | head | merge | conflicts | notes |
|---|---|---|---|---|---|
| 6 | `ad778e4ea` (v2.55.0) | - | `90ec8596e` | `PROJECT_BOARD.html`, `management/STATUS.md` (generated, regenerated) | `tasks.json` / CHANGELOG merged cleanly; 2.56.0 draft on top, the 2.55.0 and older sections byte-identical to `ad778e4ea` (checked); version files stay 2.56.0 |
| 7 | `pilot/BACKEND-SUITE-COST-2560` | `2275071fd` | next merge commit | none | route-analysis cache (tests only, `tests/support/route_cache.py`), faster DB copy, read-time WisKey timeout; one CHANGELOG line |
| 8 | `pilot/GATE-SETUP-FLAKE-2560` | `bb710e95c` | 0de366cc7 | none | `scripts/gate/release_gate.py` + `selftest_gate.py` repo copies only; nothing installed on the runner |

Checks (PC, one process at a time, before row 8): `gen_wire_types --check`, `i18n_backend_errors`, `wire_ratchet`, `sync_integration`, `build_guide`,
`design_ratchet`, `migration_downgrade_check --from origin/main`: exit 0; `ruff check smplwise` clean; `unused-exports`, `tsc`, `eslint`: 0;
`release_check`: only the two UI-bundle rows and the tag fail (expected). Backend: `test_ha_state_reconcile_2550` + `test_core10_eventloop_2560` together 16 passed;
`test_route_cache` (equivalence) 4 passed; `test_wiskey_visit_filters_2560` 6, `test_release_check_green_2560` 12, `test_version` 1 passed.
After row 8: `test_gate_speed` + `test_gate_always_run` 37 passed (1 skipped), `selftest_gate_speed_2550` OK, both gate scripts compile;
`selftest_gate.py` itself is Linux-only (NOT_RUN). RECONCILE-TEST-LEAK-2560 still running, not merged.

## 7. The shipped UI (the 2.55 way)

`npm run build:addon` on the runner (`~/work/p2520_t2560_buildui.sh fc170982f`, slot B, a copy of the 2.55 script: detached worktree, main
checkout's `node_modules` linked, 0 untracked files under the stamp inputs); `tar` of `www` / `www-public` copied to the PC as base64,
sha256 `be0038b3a2c5...f2199` verified equal on both sides, both directories emptied, archive extracted. rc 0; arx-shell-2.56.0; 0 `.map` files and 0
`sourceMappingURL` (370 maps archived under `~/smplwise-results/sourcemaps/2.56.0`); `www/build-stamp.json`: version 2.56.0, 2135 input files,
inputs_sha256 `966f83130294...`, source_commit `fc170982f`. `scripts/release_check.py` on the PC: "ready for the owner's approval" - only the v2.56.0 tag is missing.
RECONCILE-TEST-LEAK-2560 (backend tests and fixtures only) joins after the build: no stamp input changes. Any later change under `frontend/src`, `frontend/public`,
the entry pages, Vite configs, `package*.json` or `tsconfig.json` needs a new build.

## 8. Final-review fix rows and the second UI build (27.11)

The full 2.56 gate at `57de3270c` failed at the early layout stage (the A11Y-FOLLOWUPS announcer added ~15 px of document height). Seven fix rows
on top of `3739e3ded` (RECONCILE-TEST-LEAK-2560 `4458e236f` merged there by the lead), merged `--no-ff`, no conflicts: FIX-NOSCROLL-2560
(`d793ea046`), FIX-PUSH-APPROVAL-2560 (`d8b047d13`; results section added to its note), FIX-NVR-PULSE-2560 (`c42fd3eac`), FIX-CORE-2560
(`db40cf0d3`), FIX-TICKETS-2560 (`ea925c529`, the corrected head with the missing `store_links` import; `012f2e8ec` was merged first and
`ea925c529` on top), FIX-SERVER-CLOCK-2560 (`daf6feb61`; `api/client.ts`, `api/nvr.ts` and the step-up path merged cleanly: the fresh-expiry
resend and the push-approval watch's rate-limit fix are both present), FIX-MH01-2560 (`cb16e5c14`). All registered REVIEW; the 2.56.0 CHANGELOG draft has a line per
fix group and the API change lines (pulse body, `request_body_changed`, local-only backup relink).

**Train fix `2986edf80`**: FIX-NOSCROLL's announcer used `inline-size:1px;block-size:1px` - two new `px-literal`s (design ratchet 25513 -> 25515, also a
`release_check` row). Changed to `1em` (the host is `position:fixed`, so its size never reaches the scroll area). Ratchet back to the baseline.

**Engine files changed** (the lead installs before the gate): `scripts/release_check.py` (FIX-CORE-2560 CD-01, GATE-NIGHTLY-2560 TR-03), `scripts/gate/release_gate.py` and `selftest_gate.py` (GATE-SETUP-FLAKE-2560).

Runner: the three ticket files (`~/work/p2520_t2560_tickets.sh`, slot B) at `b5e00da72` and again at `01ed02003`: `test_tickets_quotes` 13, `test_tickets_claim_prefill` 10, `test_tickets_s4_public` 28 passed (the run at `5be08864a`, before the import fix, had 10 failed in `test_tickets_quotes`).

UI rebuilt once at the end (`~/work/p2520_t2560_buildui.sh 2986edf80`): rc 0, arx-shell-2.56.0, 0 maps, archive sha256 `b05e3e2d1827...4578` verified equal on both sides, stamp 2135 files, inputs_sha256 `5ea9df99847c...`, source_commit `2986edf80`. `release_check.py` on the PC: "ready for the owner's approval", only the v2.56.0 tag missing. The earlier build (`57de3270c`, and the `c93f77643` one) is replaced.
