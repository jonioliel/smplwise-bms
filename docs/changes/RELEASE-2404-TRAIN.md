# RELEASE-2404-TRAIN: assembly of the 2.40.4 train (Home Assistant 2026.11 names, bridge 0.10.5 door block, board rule, skin follow-up)

Branch `release/2404-train` (worktree `C:\cloude\smplwise-train25`), cut from `origin/main` = v2.40.3 (`dbb9e18a5`). Assembled
2026-11-05 on the coordinator's instruction. The version commit is included (2.40.4); the UI build (`build:addon`), the gate, the tag and
the merge to `main` are the lead's. No lab, Home Assistant, WisKey, station or device contact; no runner gate file touched.

## 1. Merges (`--no-ff`, in this order)

| # | Branch (change doc) | Tip | Cut from | Merge commit | Conflicts |
|---|---|---|---|---|---|
| a | `fix/HA-2026-11-COMPAT-2404` (`HA-2026-11-COMPAT-2404.md`) - `services/ha_naming.py`, the name Home Assistant shows, child devices' effective area, alarm pairing and search, migration **0206** | 45748f3fd | v2.40.2 `ccb77f28d` | ab9416e09 | none |
| b | `pilot/DOOR-BRIDGE-BLOCK-2404` (`DOOR-BRIDGE-BLOCK-2404.md`) - bridge **0.10.5** (`wiskey_door_block.py`, option `wiskey_execute_policy`, default blocked), `bridge.wiskey_execute_policy` recorded by the add-on, WXD11 rows T19 (fake-HA context) and T24 | 97acc3086 | 2.40.3 train `5573b8e58` | 167be7b92 | none |
| c | `chore/BOARD-RULE-2404` (`BOARD-RULE-2404.md`) - the board rule (REVIEW when every dependency is REVIEW or DONE), OBSOLETE marks, `test_board_rule_2404` | d8654674f | `5573b8e58` | 5c6056046 | `PROJECT_BOARD.html`, `management/STATUS.md` (generated) |
| d | `pilot/SKIN-QA-FOLLOWUP-2404` (`SKIN-QA-FOLLOWUP-2404.md`) - the compact up-arrow chip on tiles under 160 px, dark ink on the filled success badge (`--sw-on-success`), the classic dark primary key deepened; 10 classic-dark baselines re-taken (the key only), 5 new | 8170328cf | `5573b8e58` | a7d998ab1 | none |

- **Migration 0206:** main ends at 0205; 0206 is still the next free number; contiguous `0001..0206` (206 files).
- **Bridge version pins:** b moves every pin 0.10.4 -> 0.10.5 (16 test files, both integration copies); no other branch touches them.
  `scripts/sync_integration.py --check`: up to date; `release_check`: bridge 0.10.5 = manifest = const, copies identical.
- **tasks.json:** b changed the cards WXD5A and WXD11, c changed 31 other cards; the automatic merge kept both (no card changed by both,
  checked card by card against the common base `5573b8e58`). The generated views (`PROJECT_BOARD.html`, `management/STATUS.md`) were the
  only conflicts and were regenerated with the merged `scripts/project_status.py --write` (c's new rule), not hand-merged.
- **Baselines:** no HA-COMPAT run forced a re-take (section 3), so d's 10 re-taken and 5 new baselines overlap nothing of the train;
  they all pass without refresh on the merged tree.

## 2. Train commits

| Commit | What |
|---|---|
| 1f4a6dc24 | Registry: `HA-2026-11-COMPAT-2404` card IN_PROGRESS with its requirement and test row (checked: no duplicate). b updated the existing WXD5A / WXD11 cards itself; c is the board change. `project_status.py --write`: PASS, 451 tasks, 560 requirements |
| 8f293b61f | release: 2.40.4 - version, changelog and API inventory |
| (this document) | docs |

## 3. Receipts

Local: workstation, project `.venv` Python 3.12, Node 24.21.0, explicit files only; `frontend/node_modules` is a junction to the main
checkout's (`package-lock.json` identical). Runner: `run_smart.py <job> ... --machine=runner`, one job at a time; before **every** job a
script read `gate_status.json` (`pass`, the 2.40.3 gate of `release/2403-train`) and looked for a `release_gate` process, and would have
stopped otherwise; 103-107 GB free.

| Check | Where / SHA | Result |
|---|---|---|
| `scripts/release_check.py` | workstation @ 1f4a6dc24 | every item `[ok]` (2.40.3, migrations 206 / last 0206, bridge 0.10.5); RESULT: ready |
| the same | workstation @ 8f293b61f | one version **2.40.4** everywhere; every item `[ok]` except the expected `[FAIL] git tag v2.40.4 not yet` |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ 1f4a6dc24 and @ a7d998ab1 | exit 0 both |
| Unit, explicit files (24: `unit-skin-qa-followup-2404`, token lint, design tokens x2, palettes, muted contrast, HUD opaque, dark polish, a11y x2, menu, RTL, white label, motion, phone buttons, glass x2, round4 leftovers, intercom cards 2401, accordion 2402, wall phone bar, video 2403, sub fallback 2402, empty-state icons) | workstation @ a7d998ab1 | **199 passed** |
| Backend HA set (25 files: `test_ha_names_2611`, alarm, alarm managed cache, search, global search gate, ha, ha state shapes, ha structure refresh, ha sync 1000, ha labels sync, devices, device types, media api / model / sync / review fixes, switch protection classifier, migrations x3, db gate, db template, backup, home screen, semantic) | workstation @ 1f4a6dc24 | **814 passed** |
| Backend bridge set (all 24 `tests/test_bridge_*.py`: K-01 / K-02 harness, install, `update_listener_2401`, `stale_discovery_2383`, version pins) | workstation @ 1f4a6dc24 | **1034 passed, 1 skipped** |
| Backend self-update and pins (5 `test_self_update*`, bkpfix, extid followups, lovelace card, adopt 2272 review, S4 core observer, pairing 2382, native bundle 2272, version, plan versions, release check, docs config) | workstation @ 1f4a6dc24 | **260 passed, 4 skipped** |
| Backend door set (`test_door_bridge_block_2404`, `test_wxd11_t19_fake_ha_context`, SR-1, `test_gate_always_run`, `test_board_rule_2404`, the 7 `test_wiskey_door_*`, d6-d8, wxd fixes, WXD10, door automation, doorwin, T06 admission) | workstation @ 1f4a6dc24 | **406 passed, 3 xfailed** |
| `scripts/sync_integration.py --check` | workstation | up to date |
| Version pins after the bump | workstation @ 8f293b61f | **55 passed** |
| `preview` **without** refresh, desktop + mobile + tablet, workers 1: the 25 entity-name specs (`evidence-alarm`, `evidence-device-*` x4, `evidence-devices*` x3, `evidence-elevators-home`, `evidence-generator-home`, `evidence-home-*` x7, `evidence-homeinfo-295`, `evidence-homelive-295`, `evidence-multibuilding-home-2330`, `evidence-search`, `evidence-spatial-search`, `evidence-tickets-device`, `layout-devices-break-297`, `layout-home-edit-bar-wp4`, `layout-home-widgets-wide-298`) + `visual-matrix` | runner @ 1f4a6dc24 | **275 passed, 485 skipped (project / fixture-scoped), 0 failed** |
| `fixture` job (backend + fake HA, where the backend's names reach the screen): the 15 specs of the `devices` group | runner @ 1f4a6dc24 | 149 passed, **26 failed** - all pre-existing (next row) |
| the failing fixture specs on **main** v2.40.3 (`dbb9e18a5`, without this train): `evidence-area-redesign`, `evidence-devices`, `evidence-home-screen`, `evidence-hud-opaque-live`, `evidence-plan-glass-entity`, `evidence-plan-glass` | runner @ dbb9e18a5 | 88 passed, **27 failed** - the same 26 tests fail on main (plus `evidence-area-redesign:304`), so none is caused by this train |
| `preview` without refresh on the merged tree, desktop + mobile + tablet, workers 1: `pixel-skin-qa-followup-2404`, `pixel-skin-qa-2403`, `pixel-wiskey-people`, `-people-writes`, `-messaging`, `pixel-round4-leftovers-2390`, `pixel-wiskey-station-media`, `pixel-settings-intercom-cards-2401`, `pixel-settings-cards-accordion-2402`, `pixel-access-s12`, `visual-matrix`, `evidence-mobile-wall-kiosk`, `evidence-video-sub-fallback-2402` | runner @ a7d998ab1 | **225 passed, 120 skipped, 0 failed** |
| `preview` without refresh, desktop + mobile: `layout-skin-qa-followup-2404`, `layout-skin-qa-2403` | runner @ a7d998ab1 | **99 passed, 99 skipped, 0 failed** |

**Entity names on screen.** HA-COMPAT changes no frontend file; the browser specs that draw names use mocked API answers, so their names
and baselines did not move (0 failed, nothing re-taken). The fixture backend is where the new names reach the screen; its failures are the
pre-existing ones above (HUD panel alpha, the 3D / glass plan, home-screen widget counts and layout, `evidence-devices:2359` media count),
identical on main. No baseline or evidence spec needed a change for the fuller names.

**Pre-existing fixture failures (not this train, reported):** `evidence-hud-opaque-live:75` (16, desktop + mobile, a circuit button
background with alpha 0.32), `evidence-home-screen` :235, :416, :850, :934 (x2), :983, `evidence-area-redesign:286`,
`evidence-devices:2359`, `evidence-plan-glass:138`, `evidence-plan-glass-entity:173`. These specs are mostly `gate: false` in
`fixture_specs.json`, so no gate runs them; they need their own triage.

## 4. Version commit (`8f293b61f`)

- 2.40.3 -> **2.40.4** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`; bridge 0.10.5.
- `CHANGELOG.md`: bilingual entry, Hebrew first, no internal codes: install before upgrading Home Assistant to 2026.11; entity names as
  Home Assistant shows them (device + name); child devices take their parent's area; alarm zone pairing with the new names; bridge 0.10.5
  blocks WisKey door commands through the bridge's device commands (default blocked; Home Assistant › Devices & services › SMPLWISE
  Bridge › Configure; a manual WisKey install copies the bridge folder by hand and restarts Home Assistant once); the compact chip on
  narrow tiles; dark ink on the green badge and the deeper classic dark key; the task board. Migration 0206 runs by itself; back to 2.40.3
  needs the pre-upgrade backup.
- `contracts/API_INVENTORY.md`: 1844 routes, header 2.40.4.

## 5. NOT_RUN and open items

- The release gate, the full backend and unit suites, `build:addon`, Windows pixel baselines.
- Lab: the names before / after the Home Assistant 2026.11 upgrade (HA-COMPAT section 7), the bridge 0.10.5 block seen in the real
  Home Assistant logbook and options form (DOOR-BRIDGE-BLOCK section 5), the chip on a physical phone.
- From SKIN-QA-FOLLOWUP section 6: dark-scheme drift in other baselines that branch does not cause (the top bar's selected pill, the
  WisKey people toolbar chip, an icon beside "מחובר"); they pass without refresh but were not traced.
- DOOR-BRIDGE-BLOCK deviation 2: the policy lives in the bridge's options flow, not as an Arx setting (owner follow-up if wanted).
- The 2.40.3 cards (VIDEO-2403, SKIN-QA-2403, BOARD-HYGIENE-2403) are still IN_PROGRESS on this train although v2.40.3 is released
  (not changed here: not asked); `HA-2026-11-COMPAT-2404` is IN_PROGRESS until 2.40.4 is released.

## 6. Rollback

Back to 2.40.3 needs the database backup taken before the update (migration 0206 adds columns). Installed bridges go back to 0.10.4 with
the next add-on that bundles it and one Home Assistant restart; the stored option `wiskey_execute_policy` is then ignored.
