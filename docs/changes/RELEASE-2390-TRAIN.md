# RELEASE-2390-TRAIN: assembly of the 2.39.0 train (WisKey operator writes, people completeness, live validation, managed install)

Branch `release/2390-train`, cut from `origin/release/2382-train` @ `2d5238efe` (the 2.38.2 train, still being integrated by its own
owner). No version bump (every version line stays 2.38.1, the train base), no changelog entry, no UI rebuild (`smplwise_vms/www` is
still 2.38.1's), no tag, no merge to `main`. This document is the input for the version commit and the runner gate.

## 1. Merged (one `--no-ff` merge commit each, in this order)

All seven branches were cut from `main` (v2.38.0 `efc12d0e3`, LIVE-VALIDATION from v2.38.1 `2dce5d48f`), not from the train.

| # | Branch (change doc in `docs/changes/`) | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/WISKEY-STATION-OPS-2390` - station maintenance (sync now, rescan, health refresh, clock check), channel `maintenance` | 3cdd9306a | 3a92fe01c | `wiskey-stations-views.ts`, `evidence-wiskey-stations.spec.ts` |
| 2 | `pilot/WISKEY-DOOR-TECH-2390` - door hold-open drafts, programs, public codes, channel `door_technical` | e3789536b | 37c9cdae3 | channels (3 files), 2 `stations-classic-settings` PNG |
| 3 | `pilot/WISKEY-PEOPLE-COMPLETE-2390` - people on stations only (adopt / ignore / delete), duplicates, PIN check, channel `station_people`, migration **0198** | ad724b60b | 0544fee92 | channels (2 files), 42 people / messaging / people-writes PNG |
| 4 | `pilot/WISKEY-PROFILES-EDIT-2390` - groups and profile fields editor `#/wiskey/profiles`, channel `profiles` | 31e6c4c6d | 5858a1552 | channels (3 files), `main.py`, `wiskey-people.ts` |
| 5 | `pilot/WISKEY-SCHED-WRITE-2390` - device schedule library writes `#/wiskey/schedules?manage=1`, channel `schedules` | 1d4741136 | e0aefe596 | channels (3 files), `main.py`, 16 `pixel-access-schedules` PNG |
| 6 | `pilot/WISKEY-LIVE-VALIDATION-2390` - station acceptance tool `#/system/wiskey-validation`, migration **0199** | 6502d2d8a | d17492bdd | none |
| 7 | `pilot/WISKEY-MANAGED-INSTALL-2382` - owner-switched managed install; the bundled WisKey becomes the rc.10 managed bundle (replaces rc.39+arx-align) | 1e5320327 | 844d79f68 | `contracts/API_INVENTORY.md` |
| - | `release/2382-train` @ `bc4f5aded` (moved after the cut: call log through an adopted sheet, pairing routes in `test_remote_access`) | bc4f5aded | 660991fcb | none |

Train commits on top:

| Commit | Kind | What |
|---|---|---|
| b98e800b9 | product (deep links) + specs | `profiles.edit` -> native `#/wiskey/profiles` (1.2) |
| c1b287592 | generated | API inventory 1728 -> 1771 routes (3) |
| b684fc553 | **product fix** + stale spec | the merged screens pass the source lints (2.1) |
| 29e7fc11f | baselines | 82 PNG re-taken on the merged UI (5) |
| c62bb597a | stale spec | `evidence-wiskey-people-native` data-path check allows the shell's call banner read (2.2) |

### 1.1 Conflict resolutions

- **`services/wiskey_channels.py`** (2-5): every branch adds one closed allow-list on the same lines. All five kept, in merge order:
  constants `MAINTENANCE`, `DOOR_TECHNICAL`, `STATION_PEOPLE`, `PROFILES`, `SCHEDULES` (each with its own comment), and in `ALLOWLISTS`,
  `ADAPTER_CHANNELS` (`read, technical, messaging, readback, pacing, maintenance, door_technical, station_people, profiles, schedules`),
  `HA_FRAMES` and `describe()`.
- **`tests/test_wiskey_channels.py`**: the adapter-channel tuple and the live-guard map list all five, same order.
- **`tests/test_pwclean_295.py`**: four branches excluded their channel from the pre-cleanup catalog (`k != "<name>"`), PEOPLE-COMPLETE
  recomputed `CATALOG_SHA256` with `station_people` inside (`38db8b1c...bb031`). The train recomputed the hash both ways: without the
  other four channels it is exactly PEOPLE's value; without all five it is the original pre-cleanup value `0fdcbd37...abafe`. One rule
  for all: a tuple `ADDED_AFTER_CLEANUP` (one line per channel and branch) is left out of the catalog and the original hash stays, so the
  test still proves what it was written for (the cleanup changed nothing). The comment records PEOPLE's value.
- **`main.py`**: STATION-OPS, PROFILES and SCHED-WRITE each insert their router after `access_control_writes`: all three kept, in that
  order. DOOR-TECH (after `wiskey_lineage`), PEOPLE (after bulk people), LIVE-VALIDATION (after the quiet router) and MANAGED (router +
  start-up recovery thread) auto-merged.
- **`tests/test_t06_admission_295.py`**: no branch of this train touches it (no conflict); the PAIRING + TALK-CAPS signed callers and
  every pin test of the 2.38.2 train are unchanged (in the targeted runner run, 4: no failure).
- **`screens/wiskey-stations-views.ts`**: the train's `wk-deep-links` import / mount and STATION-OPS' `wk-station-maintenance` import /
  mount after the technical `</dl>` both kept; DOOR-TECH's `wk-door-tech` (door settings) and LIVE-VALIDATION's `liveValidationRow`
  (inside the `<dl>`) auto-merged. `screens/wiskey-stations.ts` (STATION-OPS' toolbar action) auto-merged.
- **`screens/wiskey-people.ts`**: PEOPLE's station-people imports and PROFILES' `wk-profiles-link` import both kept (the two mounts
  auto-merged next to the train's deep-links mount).
- **`evidence-wiskey-stations.spec.ts`** (hygiene allow-list): one regex with the train's `intercom/calls(/active)` and
  `stations/{id}/media` reads and STATION-OPS' `stations/{id}/maintenance`.
- **Migrations**: 0197 (`intercom_calls`, train), 0198 (`wiskey_station_people`), 0199 (`wiskey_live_validation`): contiguous
  0001..0199, no renumbering (`release_check`: "199 files, last 0199"). The train's `test_wiskey_s5_migration_upgrade` (allows migrations
  after 0196) passes with both.
- **Pixel baselines**: 60 conflicting PNG (2 `stations-classic-settings`, 42 people / messaging / people-writes, 16 schedules) took the
  train's side at the merge; all were re-taken on the runner for the merged UI (5).
- **`contracts/API_INVENTORY.md`** (7): train's side, then regenerated (3).
- **Nothing from the train reverted**: a script compared every line the merges removed from `release/2382-train` with the lines each
  branch removed from its own base. The only extra removals are the train's intentional edits (the combined hygiene regex, the deep-link
  entry and its specs, the inventory version line). The 2.38.2 train then moved on (`bc4f5aded`, call log CSP); merged at once, since
  without it the 2.39.0 train carried the older call log.

### 1.2 Deep links registered

`frontend/src/wiskey/deep-links.ts`: `profiles.edit` (rows 26 / 27, the only route a branch reported as unregistered, PROFILES-EDIT 7)
now carries `native: { href: '#/wiskey/profiles', need: ['access.people.manage'] }`; its Q4 bridge is retired. `linkFor`, the people
place and Settings > groups follow without caller changes; `deepLinkHref` still knows the panel address. Specs updated:
`unit-wiskey-deeplinks` (native entry, remaining bridges, linkFor of every entry, "no panel, no PANEL link"), `evidence-wiskey-deeplinks`
(native href on the people screen, the panel click proven with `people.lifecycle`).

Not registered (no change doc reported them; owner / lead call, see 6): `schedules.edit` (SCHED-WRITE's `#/wiskey/schedules?manage=1`
covers row 49, but the schedules screen's "עריכה בחלון האינטרקום" button uses `linkFor('schedules.edit')` and would change meaning),
`stations.technical` (rows 34 / 36 / 45 / 46 now native inside the station drawer, row 47 still panel-only - no route of its own).

## 2. Failures found and fixed

### 2.1 Source lints over the merged screens (`b684fc553`, product fix)

The full unit run (426 files) failed 6 tests. The branches were cut before / tested without these lints over all of `src`:

| Spec | Defect | Fix |
|---|---|---|
| `unit-date-format-module` (DATEFMT60-295) | 10 date / time inputs without the Hebrew `lang`: `wk-door-tech` (2), `wk-schedule-draft-form` (6), `wk-schedule-library` (2) | `lang=${dateInputLang()}` |
| `unit-dark-polish-beds` (DARK-SEG-ALL-2380) | `wk-door-tech`'s chosen tab on a neutral surface (invisible in the dark scheme) | `--sw-seg-key` / `--sw-seg-key-ink` / `--sw-seg-thumb-shadow` |
| `unit-token-lint` (2 tests) | `system-wiskey-validation` read `--sw-danger` with a literal `#c62828` fallback (4x) | fallback dropped |
| `unit-empty-state-icons` | the validation page's empty state had no topical icon | `icon="door"` (as the stations screen) |
| `unit-wiskey-deeplinks` "no panel, no link" | stale after 1.2 | the rule is "no panel link"; a native link follows its own permission |

No baseline moved with these fixes (the second `-u` pass rewrote none of the door-tech, schedule-writes or validation images).

### 2.2 `evidence-wiskey-people-native` data path (`c62bb597a`, stale spec)

"the screen asks the typed endpoints and never a WisKey or legacy intercom route" (desktop) failed in the evidence run @ 29e7fc11f: it
bans every `intercom/` request of the page, and the 2.38.2 train's incoming-call banner (WISKEY-INBOUND-CALLS-2382, mounted in the shell
for any caller with `access.call`) reads `intercom/calls/active` on every screen. Not a product fault and not from this train's
branches: that one typed path is allowed, every other `intercom/` route stays banned. The 2.38.2 train's evidence list does not contain
this spec; by reading the code it fails there the same way (not run there - the commit message's "it has the same failure" is this
reading, not a receipt). Re-run after the fix: see 4.

### 2.3 Not product faults, recorded

- **Workstation path length**: 5 tests (`test_wiskey_adopt_2272_review` x4, `test_wiskey_r3_2272_owner_switch` x1) fail on this PC only,
  with `shutil.Error ... [WinError 3]`: they copy the shipped rc.10 bundle, whose deepest files
  (`trusted_actions/resources/capture_answers/...`) under the scratchpad's pytest basetemp exceed Windows' 260-character path limit.
  A shorter basetemp still exceeds it. All five pass on the runner (Linux) in the same targeted set (4). MANAGED-INSTALL ran them on the
  runner only.
- `pixel-access-schedules` `schedules-classic-error-program-390` rewritten in the second `-u` pass: only the top tab strip's horizontal
  scroll differs (the load-dependent shell variance SCHED-WRITE and DEEPLINKS already recorded). Not kept; it passed in the run without
  refresh.

## 3. Migrations, release check, API inventory

- Migrations: 199 files, contiguous, `0199_wiskey_live_validation.sql` last.
- `scripts/release_check.py` @ c1b287592 (project venv): every line ok - one version 2.38.1 everywhere (incl. the API inventory),
  `migrations contiguous: 199 files`, `git tag for this version: v2.38.1 exists`; RESULT: ready for the owner's approval. (The version
  commit of 2.39.0 is not part of this train.)
- `contracts/API_INVENTORY.md` regenerated with `scripts/api_inventory.py` (project venv): **1771 routes** (1728 + 43): STATION-OPS +2,
  DOOR-TECH +6, PEOPLE-COMPLETE +8, PROFILES-EDIT +9, SCHED-WRITE +5, LIVE-VALIDATION +7, MANAGED-INSTALL +6; none removed. Version line
  stays 2.38.1.

## 4. Receipts

Runner jobs: `private/runner/run_smart.py <job> release/2390-train ... --machine=runner` from the train worktree. Before **every** job a
guard checked `~/smplwise-results/gate_status.json` (state `pass`, not `running`), no `release_gate` process, and `df -h /` >= 30 GB
free (69 / 59 / 56 GB seen). The runner worktree `~/work/release-2390-train` was used by this train only; two jobs shared it only at the
same SHA. `.tmp_*` removed after the backend run (4.2 GB). Before the last step the nightly gate (`release_gate.py main --tier L`) ran on the runner; no runner job was started after that.

| Check | Where / SHA | Result |
|---|---|---|
| `tsc --noEmit -p tsconfig.json` (src + tests) | workstation @ merged tree + b98e800b9 edits | 0 errors |
| the same | workstation @ b684fc553 | 0 errors |
| Unit: every `tests/unit-*.spec.ts` (426 files, explicit lists in 5 batches), `playwright.unit.config.ts --workers=2` | workstation @ b98e800b9 | 3870 passed, 8 skipped, **6 failed** (2.1) |
| Unit: the 5 failed specs + the 7 specs of the merged branches (12 files) | workstation @ b684fc553 | **90 passed, 7 skipped, 0 failed** |
| Backend targeted, one process (41 files: the 7 new suites; channels / contract / adapter / wire; live-validation neighbours W031, ECC features, peer, door automation, work states, capabilities; managed: adopt installer / review, native bundle, R3 owner switch, policy B, Mac managed, rc.7 adopt, bridge runnable / media policy, self-update x2, remote access; migrations, S5 migration upgrade, db gate; routes unique, capabilities, guard-first, T06 admission) | workstation @ b684fc553, project venv | 1436 passed, 17 skipped, 3 xfailed, **5 failed** (2.3, path length), 69 min |
| the same 41 files | runner @ 29e7fc11f | **1455 passed, 3 skipped, 3 xfailed, 0 failed** (30 min) |
| Pixel `-u`: all 22 `pixel-*` + `visual-matrix` + `evidence-wiskey-live-validation-2390`, desktop + mobile, preview, workers 1 | runner @ b98e800b9 | 335 passed, 91 skipped, 0 failed; **82 PNG** written (5) |
| Pixel `-u` again, the same set, desktop + mobile + tablet | runner @ 29e7fc11f | 369 passed, 270 skipped, 0 failed; 1 PNG written, not kept (2.3) |
| Pixel **without** `-u`, the same set, desktop + mobile + tablet | runner @ 29e7fc11f | **369 passed, 270 skipped, 0 failed** |
| Evidence + regression, preview, desktop + mobile + tablet (29 specs: the merged branches' evidence specs, `evidence-switchui-295`, stations / station media / people / people writes / messaging / schedules / access status / S12 evidence + layout specs, deep links, talk dial, incoming call) | runner @ 29e7fc11f | 718 passed, 505 skipped (project skips), **1 failed** (2.2) - 54 min |
| `evidence-wiskey-people-native` after the fix, desktop (its only project), spec mode | **workstation** @ c62bb597a (the runner had the nightly `release_gate.py main` running, so no runner job was started) | **55 passed, 2 skipped, 0 failed** |

## 5. Baseline review (29e7fc11f, 82 PNG)

Every rewritten PNG was compared with HEAD as old / new / difference sheets and crops of the changed region.

- `pixel-access-schedules` (16): SCHED-WRITE's "ניהול הספרייה" header button next to the train's "עריכה בחלון האינטרקום" and deep-link
  icon; on the phone the action row wraps to a second line and the program card below moves down. Program, week grid and texts unchanged.
- `pixel-wiskey-people` (24), `pixel-wiskey-messaging` (26), `pixel-wiskey-people-writes` (11): PEOPLE-COMPLETE's "בעמדות בלבד" header
  button together with the train's deep-link icon (each side's image had only one of them); on the phone the actions wrap and the list,
  the search and the filters move down. Dialogs, drawers and cards unchanged.
- `pixel-wiskey-door-tech` (5): the dialog itself is unchanged; only the station drawer behind the scrim differs (the train's deep-link
  line and call history); the phone "programs" shot moves sub-pixel in the "שינויים טכניים" row.
- `pixel-wiskey-stations` `stations-classic-settings-{1440,390}` (2): DOOR-TECH's "שינויים טכניים / ניהול טכני של הדלתות" row at the end
  of the door settings, with the train's "פתיחה בחלון האינטרקום (4)" line in the technical section.
- Not moved: station media (incl. tablet), talk dial, incoming call, deep links, access status / S12, schedule-writes, door-tech's own
  baselines after the lint fix, the validation tool's three baselines, visual matrix. The maintenance block and the validation row in
  the drawer take no room for the pixel personas (their reads are not answered by the pixel mocks), as STATION-OPS / LIVE-VALIDATION said.

## 6. What remains

- **The 2.38.2 train moved again** to `954cb6c7e` (WISKEY-JOIN-LIVE-2382 merged, "מצב WisKey" join line, quiet-hours test pin) after
  this train's runs. `git merge-tree` against `release/2390-train`: no conflict (13 files). Merge it (and whatever 2.38.2 adds before its
  version commit) regenerate the API inventory (it touches `routers/access_control_writes.py`, `routers/settings.py`) and re-run the stations / people / settings
  pixel set before the 2.39.0 gate.
- Owner / lead calls: register `schedules.edit` as native (and decide what the schedules screen's "edit in the panel" button becomes);
  `stations.technical` stays a Q7 bridge while row 47 (station technical settings) has no Arx screen.
- PROFILES-EDIT and the deep-link need: the native link is offered to whoever holds `access.people.manage` anywhere; the screen itself
  requires it at installation scope (a station-scoped manager reaches the screen's forbidden state). PROFILES' own question 1 is open.
- Each branch's open WisKey asks and owner questions stand as written in its change doc (Q-WK-11 service-identity permissions for every
  new write channel; managed-install Q1-Q6; profiles Q1-Q2).
- `management/tasks.json` / `test_catalog.json` not edited by this train.
- NOT_RUN: `evidence-wiskey-people-native` on the runner after its fix (ran on the workstation; the nightly gate held the runner);
  the full backend suite and the release gate (the gate covers them); any lab / WisKey / station / Supervisor contact (none of
  the branches allows it without the owner); the UI build (`build:addon`); the 5 path-length tests on the workstation (pass on the runner).

## 7. Cascade: the finished 2.38.2 train merged in (2026-11-04, workstation only, runner down)

- `git merge --no-ff origin/release/2382-train` (`be6879190`: version 2.38.2 committed, main `83ce74480` merged in). Before it this train
  held the 2382 head `bc4f5aded`; the merge brings the 12 later 2382 commits (WISKEY-JOIN-LIVE-2382, the quiet-hours test pin, the pairing
  test isolation, the 2.38.2 version / changelog commit, the main registry audit). `origin/main` is an ancestor after the merge.
- One textual conflict: `contracts/API_INVENTORY.md` (header line only, 2.38.1 vs 2.38.2), regenerated with `scripts/api_inventory.py`
  (1771 routes, header 2.38.2). Everything else merged cleanly: version lines take 2.38.2 (no 2.39.0 bump here; it comes separately),
  `CHANGELOG.md` has the 2.38.2 entry on top and no 2.39.0 entry, the WisKey channel lists / `test_wiskey_channels.py` /
  `test_pwclean_295.py` / `test_t06_admission_295.py` were not touched by the later 2382 commits, no frontend file and no PNG baseline
  changed (2382's later commits are backend, docs and registry only).
- `scripts/project_status.py --write` after the merge: PASS (423 tasks, 532 requirements); the merged generated views differ from a fresh
  run only by the timestamp, so the merged versions were kept.
- Local receipts (workstation @ the merge): migrations contiguous 0001..0199 (199 files, no duplicate); `release_check.py` all `[ok]`
  except the expected missing tag `v2.38.2`; `npx tsc --noEmit` exit 0; targeted backend pytest, 32 files (T06 admission, WisKey
  channels, pwclean, the migration tests, the 2382 join-live / pairing / intercom-calls / intercom-writes / talk-caps tests, the 2390
  live-validation / station-people tests, and every test importing `wiskey_direct_join`, `wiskey_feature_status`,
  `access_control_writes` or `join_state`): 1005 tests, 988 passed, 14 skipped, 3 xfailed, 0 failed (exit 0).
- Needs the runner (NOT_RUN here): the stations / people / settings pixel set without `-u` on the merged UI, the full backend suite,
  the evidence / regression specs, the release gate, the UI build (`build:addon`).

## 8. Release preparation for 2.39.0 (2026-11-04)

- **Main merged** (`c60a210cf`, `git merge --no-ff origin/main` @ `d9d4e55b1`): brings `c7cc22769` (2.38.2 rebuilt `www` / `www-public`),
  `f5fbbe7b2` (people-native data-path spec) and the PROGRESS-MARKER-FIX merge (`scripts/progress.py`, its test, management views; no
  add-on code). One textual conflict: `frontend/tests/evidence-wiskey-people-native.spec.ts` - the train (`c62bb597a`, 2.2) and main
  (`f5fbbe7b2`) made the same fix (only `intercom/calls/active` allowed); main's text taken, so the file equals main's. `www` /
  `www-public`: no conflict (the train never touched them); after the merge both are byte-identical to `origin/main` (the 2.38.2 build).
  The lead's 2.39.0 `build:addon` replaces them. `contracts/API_INVENTORY.md`: no conflict. `git merge-base --is-ancestor origin/main
  HEAD`: true.
- **Version 2.39.0** in `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile` (`io.hass.version`), `smplwise/__init__.py`; API inventory
  regenerated (`scripts/api_inventory.py`, project venv): 1771 routes, only the header line changed.
- **CHANGELOG** `## 2.39.0 (pilot)` on top: migrations 0198 / 0199 additive, back to 2.38.2 = the backup taken before the update, nothing
  turns on by itself (managed-install switch off; the two automatic checks named: duplicate people, PIN check), reload once; added (station
  maintenance, door technical, on-stations-only people, duplicates / PIN, groups and fields, schedule library, acceptance check, managed
  install), improved (bundled WisKey 2.0.1-rc.10 managed; profiles deep link native), fixed (none to an existing screen). Every item from
  the seven change docs and 1.2 of this document.

| Check | Where / SHA | Result |
|---|---|---|
| Pixel **without** `-u`: all 21 `pixel-*` specs + `visual-matrix` + `evidence-wiskey-live-validation-2390` + `evidence-wiskey-people-native` (closes its NOT_RUN in 6), desktop + mobile + tablet, preview, `--workers=1` (`run_smart.py preview release/2390-train ... --machine=runner`) | runner @ `c60a210cf` (gate state `pass`, no gate / Playwright process, 107 GB free before) | 810 tests: **448 passed, 362 skipped (project skips), 0 failed, 0 flaky**, 16.2 min; no PNG re-taken (the merge changed no frontend source, only the one spec); `evidence-wiskey-people-native` desktop 55 passed incl. the data-path test. No `.tmp_*` left in `~/work/release-2390-train` |
| `scripts/release_check.py` (project venv) | workstation @ version tree | every line `[ok]` (one version 2.39.0 incl. CHANGELOG head and API inventory; migrations contiguous 199 files, last 0199) except `[FAIL] git tag v2.39.0 not yet`; **RESULT: ready for the owner's approval** |
| `npx tsc --noEmit -p tsconfig.json` | workstation (Node 24.21.0) @ version tree | exit 0 |
| Backend targeted, one process, 12 files: `test_migrations`, `test_migrations_263_upgrade`, `test_wiskey_s5_migration_upgrade`, `test_db_gate`, `test_release_check`, `test_version`, `test_wiskey_channels`, `test_pwclean_295`, `test_t06_admission_295`, `test_progress_matcher`, `test_wiskey_station_people_2390`, `test_wiskey_live_validation_2390` | workstation, project venv @ version tree | **279 passed, 2 skipped, 3 xfailed, 0 failed** (19.7 min) |

NOT_RUN: the UI build (`build:addon`, the lead), the release gate, the full backend suite, the evidence / regression browser specs on
the merged-with-main tree (only the pixel set above), any lab / WisKey / station / Supervisor contact.

## 9. Gate 2 of 8216c6359 failed: causes and fixes (`24d50bf5b`)

`8216c6359` is the lead's rebuilt UI (`build:addon` on the runner @ `3d4335bce`). Gate report:
`~/smplwise-results/gate_release-2390-train_8216c6359.gate2.md` (runner).

| Failure | Cause | Fix |
|---|---|---|
| [lint] `evidence-station-people-2390.spec.ts:215` geometry read after a click | the delete dialog was measured with the spec's own two-frame `settle` (no animation wait) | the local `settle` replaced by `helpers/settle` (waits for running animations) and awaited before the measurement; `lint_spec_waits.py --new-since v2.38.2`: 0 findings in 16 files |
| [backend] `test_wiskeyarx_291::test_n07_arx_sends_api_contract_one_or_omits_it` | **stale lint**: STATION-OPS, DOOR-TECH, PROFILES-EDIT, SCHED-WRITE pass `api_contract=intercom_client.API_CONTRACT` (the same constant, asserted == 1); the regex knew only the bare name. None of the four branches ran this file | the pattern accepts the bare or `intercom_client.`-qualified constant and still refuses a literal or any other name (checked against 8 samples) |
| [backend] `test_bkpfix_295::test_sync_integration_writes_the_readme_with_lf` | **real defect (tooling)**: MANAGED-INSTALL hand-edited the generated `smplwise_vms/integration/README.md`; the next `scripts/sync_integration.py` would have erased the `hikvision_intercom/` paragraph | the paragraph moved into the generator's `README_TEXT` (byte-equal to the committed file); `sync_integration.py --check`: up to date |
| [backend] `test_no_ip_literals::test_no_unlisted_private_ip_literals` | three new 2390 test files used a private `10.x` address as a fake host (`test_wiskey_door_tech.py`, `test_wiskey_live_validation_2390.py`, `test_wiskey_station_ops.py`) | RFC 5737 `192.0.2.9` (the leak assertion follows) |
| [addon_build] `failed to prepare extraction snapshot` | **infrastructure**: all 14 Dockerfile steps finished and the image was exported; the error is containerd's snapshot store at the final unpack (`parent snapshot ... does not exist: not found`) | none (no product or Dockerfile change) |

No product runtime file changed.

| Check | Where / SHA | Result |
|---|---|---|
| Backend, 11 files: the three failed files + `test_wiskey_door_tech`, `test_wiskey_live_validation_2390`, `test_wiskey_station_ops`, `test_wiskey_profiles`, `test_wiskey_schedule_writes`, `test_bridge_install`, `test_bridge_media_policy`, `test_bridge_config_drift` | workstation, project venv, tree of `24d50bf5b` | **298 passed, 0 failed** (14.4 min) |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ `24d50bf5b` tree | exit 0 |
| `evidence-station-people-2390.spec.ts`, preview, desktop + mobile + tablet, `--repeat-each=2` | runner @ `24d50bf5b` (gate state `fail`, no gate running, 110 GB free) | **18 passed, 30 skipped (project skips), 0 failed** |

NOT_RUN: the gate re-run (the lead runs `--after`), the add-on image build.
