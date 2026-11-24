# RELEASE-2490-TRAIN - the 2.49.0 train

Branch `release/2490-train`, cut from `main` = tag `v2.48.0` (`d6f09395e`) on 24.11.2026 by the release-assembly agent in the worktree
`C:\cloude\smplwise-2490train`. Owner standing rule (18.11): one train and one release gate per version, fix forward with targeted
re-runs. Looks approved by the owner: the tickets table pages (phone keeps the compact list with the page scroll; rows stretch to fill
the page). Every head was checked against `origin` after `git fetch`; merges `--no-ff`, messages from UTF-8 files without BOM. Every
candidate row was based on 2.47.0 (`619f94d04`, 221 commits behind `main`); none was already merged (`git cherry`: every commit `+`).
Generated files were regenerated, never hand-merged.

## 1. What merged (in this order)

The i18n rows first (the largest, and the base of two others), then the small product rows, then the test-only rows.

| # | Branch | Head | Merge | Conflicts and resolution |
|---|---|---|---|---|
| 1 | `pilot/I18N-EN-2490` | d144aa612 | d3911d6d8 | `i18n/lang/en/i18n/msg/api-notify.ts`, `msg/system-b.ts`: both sides appended English entries at the same place (2.48.0's announce / RESPONSE-HINTS keys, the row's api-demo and settings keys) - kept both. `screens/system-alarm.ts` (4 hunks) and `screens/system-diagnostics.ts` (2 hunks): 2.48.0 changed the markup (NATIVE-SELECT-A: `<select>` inside `<sw-field>`; HAND-SWITCH: the plan-surface check box became `sw-toggle` with `toggled(e)`), the row wrapped the same texts in `tr()` - kept 2.48.0's markup with the row's `tr()` texts; import hunk: both (`sw-field` + `tr`). Checked: `<sw-field>` / `<sw-toggle>` / `<select>` / `type="checkbox"` counts equal `main`'s in both files |
| 2 | `pilot/I18N-SETTINGS-KEYWORDS-2490` | 1df34dc24 | 1ad146e8c | none |
| 3 | `pilot/I18N-BACKEND-2490` | bd8fad7b7 | aa6361d55 | none (carries I18N-EN-2490) |
| 4 | `pilot/I18N-DEFAULT-NAMES-2490` | 9b6c82cb3 | 2824cf8ac | none (carries I18N-BACKEND-2490) |
| 5 | `pilot/GEN-UNITS-FIELD-2490` | bd551962d | 16b38a7c4 | `generator/gen-settings.ts` (run-log thresholds): 2.48.0's `sw-toggle` line for the boolean settings + the row's `sw-field ... unit=` frame for the numbers - kept both (toggle / check-box counts equal `main`'s) |
| 6 | `pilot/TICKETS-PAGING-2490` | 164b1fb7a | ac0c5135e | none |
| 7 | `pilot/FLAKY-CAPTURE-SCREENSHOT-2490` | 169570cf5 | 4fb7436d1 | import lines of `evidence-automations-builder`, `evidence-automations-list`, `evidence-system-multimedia` (spec files): 2.48.0's FLAKY-SWEEP imports (`gotoApp` / `appReady` / `settle`, `skipDesktopSizeOnPhone`, `openSize`) + the row's `phoneSkipDesktopShot` - kept both. The two mechanisms overlap harmlessly: FLAKY-SWEEP skips a desktop-size TEST in the phone project, the row skips a desktop-size CAPTURE |
| 8 | `pilot/PHONE-SKIP-DESKTOP-SHOTS-2490` | d8c95810a | b1911de23 | `frontend/playwright.config.ts`: FLAKY-CAPTURE's `installCaptureGuard()` + the row's skip-list reading - kept both |

Not on this train:

- `pilot/RESPONSE-MODELS-E-2480` (head 6bf65de99): its full runner rerun is NOT green. `~/work/respe2480-results/summary.txt` (sha
  6bf65de99, 23.11 09:13 UTC): shard 0 1 failed; shard 1 13 failed, 5278 passed, 919 errors; shard 2 38 failed, 6466 passed, 690
  errors; shard 3 3 failed, 6473 passed, 831 errors. Many errors are environmental (`OSError: could not create numbered dir`,
  `sqlite3.OperationalError`, "the data disk is full"), but there are also real `ResponseValidationError`s of the row's new models
  (`GET /api/v1/ha/entities`, `GET /api/v1/intercom/calls` in `test_get_routes_read_conn.py`). `~/work/respe2480-run2.log` is empty
  (0 bytes, 23.11 07:35): no second run exists. Left out; it needs a clean rerun on a quiet runner and a fix of the two models.
- The 2.50 rows (ONVIF-*, HOME-WALL-NIGHT, HOME-FAVORITES, MULTI-BUILDING-*, MFA-*), by instruction.

## 2. Fix and housekeeping commits on the train

| Commit | What |
|---|---|
| 8500516a5 | EN ratchet (`docs/i18n/EN_RATCHET.json`) raised once with `--allow-raise`: the ratchet was written against 2.47.0, and 2.48.0 (already released) added 16 hard-coded Hebrew literals in modules not translated yet - HAND-SWITCH-2480's `sw-toggle` accessible labels repeat the visible Hebrew beside them (explore-floor-map +1, explore-plan-editor +7, plan-studio-panel +7) and one RESPONSE-HINTS-2480 text in system-notifications. explore 857 -> 865, plan 598 -> 605, system 143 -> 144, total 3144 -> 3160; gap keys (4) and placeholder keys (1) unchanged. Found by comparing the per-file report of the row's tip with the train's (only these 4 files differ). `MISSING_KEYS_EN.md` / `.json` regenerated (`--write`) |
| 9d19a0b53 | `components/page-fit.ts`: `PageFitOptions` (exported by TICKETS-PAGING-2490) is file-local - `unused-exports.mjs --enforce` failed on the merged tree (file-local 53 > baseline 52); no run-time change |
| 2bb5321c2 | `tests/test_fake_doorwin_closed_rule_sr1.py`: I18N-BACKEND-2490's third pass (5a2d92c70) added `services/automation_ext_text.py`, whose `ACTION_LABELS` table names `lock.unlock` as a key (he / en action labels - a label, never a service call); the SR-1 scan of lock service sites found it in the runner's full backend. Pinned beside the row's other label table; test-only (5 passed) |
| aaf91bf51 | `tests/test_wiskey_adopt_2272_review.py` L9: I18N-EN-2490 put `BRIDGE_INSTALL_RESTART_WARNING` (`screens/system-diagnostics.ts`) through `tr()` (English entry in `msg/system-a`); the source-text check looked for a plain string constant. It now reads the Hebrew key inside `tr()`; the warning / row / button checks are unchanged. Test-only (with the two wire-type checks: 80 passed) |

## 3. Release commits

| Commit | What |
|---|---|
| fd63bc2af | release: 2.49.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), bilingual CHANGELOG (new / improved / how to turn it on / install), API inventory (1910 routes, unchanged). No migration (0216 stays the last). Bridge unchanged (0.10.8) |
| 11eccfba8 | release: 2.49.0 - rebuilt UI at fd63bc2af (the two later fixes change backend tests only; `frontend/src` and `smplwise/` are byte-identical to fd63bc2af, so the shipped `www` matches the head): `~/work/build_ui2490.sh` (a copy of `build_ui2480.sh`), archive sha256 `e02930b67a4356e04e6c958eb4aa9b11747856d5e0dbc5e292b8d0303cbd8f41`, verified after the copy; 0 `.map` files, 0 `sourceMappingURL` in `www` / `www-public` |

Note for the copy step: `r.sh` pipes the output through `sed` (IP redaction), which corrupts a binary archive (first copy: wrong size and
sha256). The archive was copied with the same `ssh` command without the `sed` stage.

## 4. Checks before the gate

Workstation (Python 3.12, Node 24.21.0, `node_modules` junction to the main checkout - the package lock is `main`'s; only a script line
was added to `package.json`):

| Check | At | Result |
|---|---|---|
| `py -3.12 scripts/design_ratchet.py` | b1911de23 | no count above the baseline, every count equal to 2.48.0 (color 1984, px 25462, undefined-token 0, native-dialog 3, native-select 262, native-table 58, hand-switch 161, scroll 13) |
| EN ratchet spec `unit-i18n-en-ratchet-2490` | b1911de23 / 8500516a5 | 1 failed (the 2.48.0 literals, section 2) / passed in the set below |
| `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` / `tsconfig.scripts.json` | b1911de23 (app re-run at 9d19a0b53) | exit 0 / 0 / 0 |
| `node scripts/unused-exports.mjs --enforce` | b1911de23 / 9d19a0b53 | FAIL (`PageFitOptions`) / OK (unreferenced 47, file-local 52) |
| `npm run check:phone-skip` | b1911de23 | ok: 25 files, 20 also skipped on tablet |
| ESLint on the conflict-resolved and fixed src files (6) | 9d19a0b53 | exit 0 |
| `scripts/gen_wire_types.py --check`, `scripts/sync_integration.py --check` (main `.venv`) | 9d19a0b53 | exit 0 / up to date |
| `scripts/api_inventory.py` | fd63bc2af | 1910 routes (unchanged) |
| `scripts/release_check.py` | fd63bc2af / 11eccfba8 | ready for the owner's approval (only "tag v2.49.0 not yet", as expected) |
| Unit specs `unit-i18n-en-ratchet-2490`, `unit-settings-search-en-2490`, `unit-tickets-table`, `unit-i18n-api-2442`, `unit-i18n-core`, `unit-no-ha-branding-2443`, `unit-i18n-lang-packs-2443`, `unit-i18n-map-wizard-2441` | 9d19a0b53 | **81 passed, 0 failed** |
| Backend `test_i18n_backend_2490`, `test_default_names_i18n_2490`, `test_default_names_i18n_2490b`, `test_singletons_registered`, `test_error_envelope_unexpected` (main `.venv`) | fd63bc2af | **47 passed, 0 failed** |
| `project_status.py --write` | - | NOT_RUN: no `management/` file changed on this train (the lead owns those) |
| `ruff` | - | NOT_RUN on the workstation (the gate's static step runs it) |

Runner slot A (`~/work/rel2490_tests.sh fd63bc2af`, under `~/.smplwise-tests.lock`, own worktree `~/work/rel2490`, results
`~/work/rel2490-out/`; backend 4 shards at nice 19 in parallel with the frontend; Playwright `--workers=4`, never `-u`):

| Check | Result |
|---|---|
| `vite build` | rc 0 (23 s) |
| Full Node unit suite (`playwright.unit.config.ts --workers=2`) | **5,142 passed, 0 failed, 12 skipped** (2.4 min) |
| Row-touched browser specs: 100 files - every spec file the rows changed, plus `*ticket*`, generator, `system-*` / settings, investigate, readiness / setup, incidents, alarm, and every spec that names the pager (`sw-pager`, `long_lists`, `PageFit`); split like the gate's classifier | |
| - 92 files on `vite preview` (dist), desktop + mobile, `--workers=4`, `--retries=0` | **1,634 passed, 0 failed, 988 skipped** (28.2 min). The skips are the specs' own project guards (desktop-only tests in the mobile project) and the new phone skip list |
| - 7 files with a "vite dev" header on `vite dev`, desktop + mobile | **234 passed, 0 failed, 2 skipped** (3.9 min) |
| - `evidence-camera-card` (a gate fixture spec, needs its Python fixture server) | NOT_RUN here (the gate runs it) |
| Backend, full suite, 4 shards, `-m "not timing_lane"` (1,043 files) | **44,631 passed, 5 failed** (shard 0: 1 failed / 7,332 passed; 1: 1 / 11,167; 2: 0 / 11,186; 3: 3 / 14,946; ~3 h a shard on the shared runner) |
| - retry of the 5 failed ids, one process | 3 passed, 2 failed |
| - the 2 that failed twice | real, both from the i18n rows' source changes, fixed test-only in 2bb5321c2 (SR-1 pin) and aaf91bf51 (WisKey L9); re-run on the workstation: passed |
| - the 3 that passed on the retry | `test_wire_consumption_2450` / `test_wire_routers_b_2450` `test_the_generated_client_types_are_current` (`gen_wire_types --check` = 1 inside the shard only; standalone `--check` exit 0 on the workstation and on the retry - order-dependent in a long shard), `test_media_review_fixes` L4 (a rate-limit bucket that answered 202 five times instead of one 429 - timing under load). Flaky, not changed |
| Playwright tablet project | NOT_RUN here (desktop + mobile as asked; the gate runs all three) |
| Pixel baselines | the 4 files with `toHaveScreenshot` were in the preview set (0 failures, run without `-u`); no baseline was written or refreshed on the train |

## 5. Lead steps before the release gate

1. Decide on the EN ratchet raise (section 2): keep it (recommended - the literals shipped in 2.48.0 and sit in modules whose visible
   text is untranslated anyway; they go when the plan editor / floor map pass wraps those files) or wrap the 16 labels now.
2. RESPONSE-MODELS-E-2480 stays off this train unless a clean full backend rerun is green (section 1).
3. The gate runs `playwright.config.ts` with the new per-project `testIgnore` (PHONE-SKIP-DESKTOP-SHOTS-2490): 25 spec files no longer
   load in the mobile project and 20 not in the tablet project. A gate batch that names only such files with only `--project=mobile`
   (or `tablet`) would answer "No tests found" (rc 1, which the gate counts as a FAIL). The classifier runs every "rest" spec on all
   projects together, so it should not happen; worth a look if the gate reports a zero-test batch.

## 6. Release gate

Gate 2 on the runner (`~/gate2/release_gate2.sh release/2490-train`) - the lead runs it. Use the memory-safe flags
(`GATE_BACKEND_SHARDS=4 GATE_PW_SLOTS=8 GATE_PW_MAX_WORKERS=4`).
