# RELEASE-2432-TRAIN: assembly of the 2.43.2 train (plan wizard rounds 1-2, home follow-up B, test fixes)

Branch `release/2432-train` (worktree `C:\cloude\smplwise-train36`), cut from `origin/main` = v2.43.1 (`ab7894837`). Assembled
2026-11-12 by the release-train agent on the lead's delegation (standing release authority: tag and push after a passing full gate).
No lab, Home Assistant, NVR, go2rtc, WisKey or device contact; nothing installed.

## 1. Merges (`--no-ff`, in this order)

| # | Branch | Tip | Runner entry check | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `pilot/WISKEY-PIXEL-QUAR-2431` (`WISKEY-PIXEL-QUAR-2431.md`) - the stations door-settings pixel shot pins the grid's own scroll; `test_body_limit` redirects the temp dir after the app is built; tests only | d1b86b514 | GREEN (`entry_pilot-WISKEY-PIXEL-QUAR-2431_d1b86b514.md`) | 85af61e99 | none |
| b | `pilot/HOME-V3-FOLLOWUP-B-2431` (`HOME-V3-FOLLOWUP-B-2431.md`) - wall panel adds a family calendar event (`POST /home/wall/events`, other kiosk calendar writes refused), photos on a new home ticket (`POST /home/tickets/{id}/photos`); no migration | 17da5c7ff | GREEN (`entry_pilot-HOME-V3-FOLLOWUP-B-2431_17da5c7ff.md`) | 169755d5f | five files (below) |
| c | `pilot/PLAN3D-R28-WIZARD2-2434` (`PLAN3D-R28-WIZARD2-2434.md`, contains `pilot/PLAN3D-R28-WIZARD-2433` @ 54d054f35 / `PLAN3D-R28-WIZARD-2433.md`) - the plan wizard, seven steps, round 2 (cameras, back keeps the plan, resume); `/me/prefs` key `plan.wizard`; no migration | 891cc6a05 | GREEN (`entry_pilot-PLAN3D-R28-WIZARD2-2434_891cc6a05.md`) | 8cd2665aa | none |

**Conflicts in b, resolved** (follow-up A is on main since 2.43.1; the same resolution was dry-run on the 2.43.1 train and recorded
with `git rerere`):
- `frontend/src/home/home-api.ts`, `sw-home-admin.ts`: A's `HomeModule` union and labels (recordings, log, intercom are their own
  categories; doors = "דלתות").
- `services/home_interface.py`: A's `MODULES_FA`; both allow-list blocks (A's bill-file pattern and `HOME_MODULE_ROUTES`, B's
  `/home/wall/events` and `KIOSK_REFUSED_WRITES_*`); both helper sets (`module_route`, `home_bill_file_check`, `kiosk_refused_write`,
  `is_kiosk`); in `enforce` B's wall-panel check first, then A's category gate.
- `tests/test_home_v3_p3.py`: A's assertion (the base nine first; phase 3 is no longer the tail).
- `frontend/tests/home-simple-mocks.ts`: main's missed-call time kept (the same midnight fix as B's; B's helper dropped).
The tree of this merge equals B's own later main merge (7cb2cca6c) except for a's files, which B does not have.

B's later heads (5198835c5 photo remove-button sizing, 10edf1847 baselines, b1d7dba07 / 1445a3ea1) are not on this train: b1d7dba07
was RED (`pixel_0: load error`, `zero tests`), 1445a3ea1 had no verdict when the train was cut.

**Not boarded:**
- `pilot/HEALTH-GO2RTC-FOLLOWUP-2431` @ 4701b32d2 - RED, 12 failures (`unit-token-lint.spec.ts:70/99/110` on every project,
  `evidence-video-services-2431.spec.ts:57` mobile, ...). New head 6e58412b0 had no verdict yet.
- `pilot/PLAN3D-FURNMERGE-2434` @ 3303d5376 - RED, one failure: `test_body_limit.py::test_a_cut_multipart_upload_leaves_the_temp_dir_empty`
  (fixed by a on this train; the branch needs main merged and a new check).
- `pilot/PLAN3D-R28-UI-2433` @ 93a94c546 - NOT RUN (the entry check waited 43226 s for the tests lock and gave up; nothing ran).

## 2. Train commits

| Commit | What |
|---|---|
| c9849e316 | release: 2.43.2 - version, changelog and API inventory (1904 routes) |
| (this document) | docs |
| (next) | release: 2.43.2 - rebuilt UI (`npm run build:addon` on the runner) |

`management/tasks.json` and `test_catalog.json` are not changed; no view regenerated.

## 3. Receipts (before the UI build)

Local: workstation, project `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's.

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit` | 169755d5f (a + b); c9849e316 (a + b + c) | exit 0, exit 0 |
| Playwright desktop: `home-v3-fb-2431`, `home-v3-followup-a`, `home-v3-p1`, `home-v3-p2`, `home-v3-p3`, `home-simple-2420`, `home-simple-2421` | 169755d5f | **98 passed** |
| backend: `test_home_interface`, `test_home_interface_doors_2421`, `test_home_v3_followup_a`, `test_home_followup_b_2431`, `test_home_v3_p1/p2/p3`, `test_rbac_matrix`, `test_me_permissions`, `test_body_limit` | 169755d5f | **115 passed** |
| `scripts/release_check.py` | c9849e316 | one version 2.43.2; migrations contiguous (215); only `[FAIL] git tag v2.43.2 not yet`; RESULT: ready |

## 4. Version commit (`c9849e316`)

- 2.43.1 -> **2.43.2** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`. No bridge change, no migration.
- `CHANGELOG.md`: bilingual entry (Hebrew + English per item): the plan wizard, the wall panel calendar event, ticket photos; fixed:
  tests only; install: nothing to do.
- `contracts/API_INVENTORY.md`: 1904 routes, header 2.43.2.

## 5. NOT_RUN and open items

- Locally: the full suites and the other Playwright projects - the runner's UI build and full release gate cover them.
- Lab: nothing installed or exercised (owner approves installs): a real plan picture through the wizard, a real wall panel, a real
  ticket photo.
- Owner questions open: the round 28 questions the wizard built with the recommended answers (`PLAN3D-R28-WIZARD-2433.md`).

## 6. Rollback

Back to 2.43.1: no migration; the `plan.wizard` preference and ticket photos stay in the database and are ignored or shown as
ordinary attachments. No bridge or Home Assistant change.
