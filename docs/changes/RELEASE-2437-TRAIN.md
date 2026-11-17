# RELEASE-2437-TRAIN: assembly of the 2.43.7 train (home round 32, round-30 design audit, code-review wave 1)

Branch `release/2437-train` (worktree `C:\cloude\smplwise-train41`), cut from `origin/main` = v2.43.6 (`4a345f8af`). Assembled
2026-11-16 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed. The lab Home Assistant updates the add-on by itself.

**Pushed after the merges, before the gate:** `release/2437-train` @ `ec1905db2` (the seven merges, nothing else) was pushed to
origin so that the frontend combined branch can be based on it.

## 1. Merges (`--no-ff`, in this order)

Every verdict file was read on the runner before the merge (`~/smplwise-results/entry_pilot-<branch>_<sha9>.md`): each says GREEN
("ירוק - מותר לעלות לרכבת", engine pass) for exactly the tip below, which equals the branch's origin head at merge time.

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| 1 | `pilot/AUTH-REVOKE-GATE-2435` - socket-attach revocation check, lineage administrator gate | 0a3c570e1 | GREEN (base 665ec8f24, run 29 min) | 3d04e2c11 | none |
| 2 | `pilot/TICKETS-PERF-ERASE-2435` - tickets list reads, outbox queue index, erase failures | 5719846af | GREEN (base 665ec8f24, run 33 min) | f50214e48 | none |
| 3 | `pilot/FE-LEAK-TEXTKEY-2435` - home playback leak, logic keyed on display text | f7e247b60 | GREEN (base 665ec8f24, run 63 min) | a6d07687e | none |
| 4 | `pilot/HOME-V3-AUDITFIX-2437` - home v3, round-30 audit fixes | 181c2e926 | GREEN (base 665ec8f24, run 123 min, full frontend) | b767e0481 | none (`home-recordings.ts`, `sw-home.ts` auto-merged with 3) |
| 5 | `pilot/HOME-R32-ANSWERS-2438` - home, the owner's round-32 answers (on 4) | c37dc5149 | GREEN (base 665ec8f24, run 128 min, full frontend) | de8df23e9 | none (`sw-live-player.ts`, `home-p2-ui.ts`, `sw-home.ts` auto-merged) |
| 6 | `pilot/AUDIT30-COMBINED-2435` - the round-30 design audit branches (14) | ef7f57c07 | GREEN (base 0a8fb55e1, run 97 min) | 513cbcb38 | none |
| 7 | `pilot/CR-WAVE1B-COMBINED-2436` - code-review wave 1 (contains `CR-WAVE1-COMBINED-2436`) | 1a7e19ae3 | GREEN (base 665ec8f24, run 147 min, full backend and frontend) | ec1905db2 | two, below |

Files changed by both 6 and the earlier merges: `electricity/elec-settings.ts`, `elec-settings-calendar.ts`, `elec-wizard.ts`
(3 changed the 403 / field-error tests, 6 the styles); git merged them without a conflict.

### Conflict resolutions in merge 7 (`ec1905db2`)

- `smplwise_vms/backend/smplwise/routers/settings.py`: W1B (`CR-SETTINGS-STORE-2436`) moved `DEFAULTS`, `INT_KEYS` and the stored-value
  helpers into the new `services/settings_store.py` (re-exported from the router). The train side had changed that moved block after
  2.43.4 in two releases: `media.video_notice_after_min` (default `"15"`, also in `INT_KEYS`; 2.43.5, the SHELL-TIMERS note) and the
  eight `map.*` keys of `PLAN3D-R28-UI-2433` (2.43.6). Resolution: the W1B layout (the router keeps no `DEFAULTS`), and those nine keys
  plus the `INT_KEYS` entry ported into `settings_store.py` at the same places. Checked: the train side's two conflicting blocks
  (532 and 259 lines) are line-for-line equal to the store's text after the port, apart from the move itself (the store's own
  `from . import media_store` and the call-time `ui_background` import). The `SettingsPatch` fields (`Literal[1, 5, 15, 30, 60]`,
  the eight `map_*` patterns) and `from typing import Any, Literal` auto-merged in the router.
- `frontend/src/screens/system-diagnostics.ts`: imports only. Both kept - `healthSummary` / `HealthSummary` (W1B,
  `CR-DIAG-DEFECTS-2436`) and `NOTICE_AFTER_CHOICES`, `noticeAfterLabel`, `noticeAfterValue`, `sw-video-service-picker` (2.43.5).
  git rerere replayed a recorded resolution identical to this; both groups are used in the file.

Other files changed by both 7 and the train side, merged by git without a conflict: `api/electricity-billing.ts`,
`shell/lazy-screens.ts`, `shell/sw-app.ts`, `tests/evidence-schedules-editor.spec.ts`, `tests/shoot-sched-polish-2331.spec.ts`.

## 2. Train commits

| Commit | What |
|---|---|
| f5450a913 | release: 2.43.7 - version, changelog and API inventory (1908 routes, unchanged: header only) |
| e5adf7d13 | docs (this document, first version) |
| 32c4a2275 | test(gates): `test_async_routes_no_inline_db.py` - `PENDING` emptied and the strict xfail removed (below) |
| (next) | release: 2.43.7 - rebuilt UI (`npm run build:addon` on the runner at 32c4a2275, DONE rc=0; tarball sha256 `4948469a...2573d25` checked after the copy) + this document |

### A merge interaction fixed in the train (test only)

`CR-BE-GATES-2436` (in 7) listed `routers/wiskey_lineage.py::resolve` as a known async-route offender with
`@pytest.mark.xfail(strict=True, reason="... after it merges, empty PENDING and remove this mark")`, waiting for
`AUTH-REVOKE-GATE-2435` (1). Each branch was GREEN alone; together the test XPASSed, which a strict xfail reports as a failure
(seen locally at ec1905db2: 1 failed, the other tests of the four files passed). As the test itself says, `PENDING` is now empty
and the mark removed (and the unused `pytest` import): 4 passed locally at 32c4a2275.

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 3. Receipts

Local: workstation, main checkout `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's
(its lockfile lacks W1B's report-only ESLint dev dependencies; `tsc` does not use them; the runner build runs `npm ci` when the
lockfile differs).

| Check | Where / SHA | Result |
|---|---|---|
| backend: `test_map3d_r28_settings_2433`, `test_video_services_2431`, `test_setting_value_parity`, `test_f3a_acr5_gate_295` (`-p no:xdist`) | ec1905db2 | 36 passed, 0 failed |
| `npx tsc --noEmit` | ec1905db2 | exit 0 |
| backend: `test_async_routes_no_inline_db`, `test_authrevoke_2435`, `test_async_routes_hold_no_write_conn`, `test_get_routes_read_conn` | ec1905db2 | 1 failed (the strict xfail above), the rest passed |
| backend: `test_async_routes_no_inline_db` | 32c4a2275 | 4 passed |
| `scripts/api_inventory.py` | f5450a913 | 1908 routes (header only changed) |
| `scripts/release_check.py` | f5450a913 | one version 2.43.7; only `[FAIL] git tag v2.43.7 not yet`; RESULT: ready |

The full release gate's verdict on this train is recorded in the release report, not here (this document is part of the gated head).

## 4. Version commit (`f5450a913`)

- 2.43.6 -> **2.43.7** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`.
- Bridge 0.10.7 (from W1B, `CR-BRIDGE-RUNTIME-2436`): one Home Assistant restart by the owner to load it.
- Migration `0216_review_indexes.sql` (from W1B, `CR-AUDIT-INDEX-2436`): indexes only; `origin/main` ended at 0215.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item).

## 5. NOT_RUN and open items

- Locally: the full suites and the Playwright projects - the runner's full release gate covers them.
- Lab: nothing installed or exercised. Bridge 0.10.7 needs the owner's Home Assistant restart at a quiet hour (approved earlier).

## 6. Rollback

Back to 2.43.6: migration 0216 only adds indexes (harmless to 2.43.6). The bridge 0.10.7 stays loaded until the next Home Assistant
restart; its note says only the import-time digest and the runtime edges changed ("Nothing else changes"), so 2.43.6 is
expected to work with it (not tested).
