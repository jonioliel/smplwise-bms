# RELEASE-2405-TRAIN: assembly of the 2.40.5 train (seven branches)

Branch `release/2405-train` (worktree `C:\cloude\smplwise-train26`), cut from `origin/main` = v2.40.4 (`eab715e53`). Assembled
2026-11-06 on the coordinator's instruction. The version commit is included (2.40.5); the UI build (`build:addon`), the gate, the tag,
the merge to `main` and the runner install of the T074 gate scripts (after this train's gate) are the lead's. No lab, Home Assistant,
WisKey, station or device contact; no runner gate file touched.

## 1. Merges (`--no-ff`, in this order; every branch cut from `eab715e53`)

| # | Branch (change doc) | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| a | `fix/T097-LOWS-2405` - shared-space members list only readable floors (L6); `POST /devices/actions/preview` (L8) | 7a4d37eba | 5311dc995 | none |
| b | `pilot/WXH-LEFTOVERS-2405` - `security.owner_contacts`, bridge-key notices and banner, `bridge_key_watchdog` (timer-shaped, SR-1 green), the signed capability record, the ping self-echo refusal | 740400379 | 863c5991e | generated views, API inventory |
| c | `pilot/FRIGATE-F2B-2405` - the F2b tabs in every skin, the contract unit spec, 8 new pixel baselines, the folded-row state tag | c7f8ca6c2 | 9bb0e21a0 | generated views |
| d | `chore/T074-VISUAL-METRICS-2405` - the visual step blocks releases, `video_timing.py`, playback / live timing fields | 7a36dc566 | 7b5188644 | generated views |
| e | `fix/FIXTURE-SPECS-2405` - the opaque lit-circuit chip, the area screen's progressive compaction, the sections all-on / all-off wrap, stale fixture specs, `arx_fake_ha` like the tunnel | 0ab18f9c2 | ca707d0aa | none |
| f | `chore/PIXEL-DRIFT-2405` - 97 re-taken baselines, the people-writes saved shot, the installer wizard shot (:324 -> :331) | e4479223c | 5624c8e9f | none |
| g | `chore/T035-OUTAGE-RUN-2405` - the outage / safety run on fakes (`test_outage_run_t035`, 15 tests) and its fixes D1-D5 | 05963dfa6 | 8fff6f930 | generated views |

- **Generated files** (`PROJECT_BOARD.html`, `management/STATUS.md`, `contracts/API_INVENTORY.md`) were taken provisionally at each
  conflict and regenerated after the merges (`62ab4dce8`, and again with g): `project_status.py --write` PASS (451 tasks, 560
  requirements); API inventory 1844 -> **1847** routes (+ `POST /devices/actions/preview`, + `GET /system/bridge-key/notice`, +
  `PUT /system/bridge-key/owner-contacts`). Never hand-merged.
- **tasks.json** merged without a conflict each time; checked card by card against `eab715e53`: a T097, b WXH3-WXH7, c T116, d T074,
  g T035, e / f none - no card changed by two branches.
- **Baselines:** c and f touch no common image. e's product changes (opaque lit chip, area compaction) did not invalidate any of f's
  images: the full pixel set passed **without refresh** on the merged tree (section 3). No baseline was re-taken on the train.
- **Migrations:** none added; the last stays `0206`.
- `routers/ha.py` (b and g) and `routers/devices.py` merged automatically; their tests pass together (section 3).

## 2. Train fixes (test-only)

| Commit | Failure on the merged train | Cause | Fix |
|---|---|---|---|
| 0af8ef21a | `test_gate_always_run::test_every_package_scanner_is_listed_or_reviewed`: `test_wxh_leftovers_2405.py` not on `gate_always_run.json` | b's new test walks `smplwise/` (`rglob`) to pin that no module calls the bridge-key emergency notice (WXH4 not built); the branch did not list it (the commit message says the list was not enforced on its branch run - it was; the branch simply did not run that guard) | listed under `backend`; 19 passed |
| 002b3deba | `test_remote_access::test_every_route_needs_a_remote_session`: `PUT /system/bridge-key/owner-contacts` and `GET /system/bridge-key/notice` answer 404 on the tunnel | correct product behaviour (the whole `/system/bridge-key` prefix is in `remote_channel.BLOCKED_ON_REMOTE`); the test's explicit local-only list did not name b's two new routes | added beside the other bridge-key routes; 66 passed |

No product code changed on the train.

## 3. Receipts

Local: workstation, project `.venv` Python 3.12, Node 24.21.0, explicit files only; `frontend/node_modules` is a junction to the main
checkout's. Runner: `run_smart.py <job> release/2405-train ... --machine=runner`, one job at a time; before **every** job a script read
`gate_status.json` (`pass`, `release/2404-train`), looked for a `release_gate` process and required >= 30 GB free (49-93 GB seen).

| Check | Where / SHA | Result |
|---|---|---|
| `scripts/release_check.py` | workstation @ 62ab4dce8 | every item `[ok]` (2.40.4, migrations 206); RESULT: ready |
| the same | workstation @ fe3827cb2 | one version **2.40.5** everywhere; every item `[ok]` except the expected `[FAIL] git tag v2.40.5 not yet` |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ 62ab4dce8 and @ 8fff6f930 | exit 0 both |
| Unit, explicit files (20: t097 lows, building scope control, bridge key, frigate f2b contract, frigate control / frigate / frigate config, HUD opaque, menu lint, token lint, design tokens, a11y, RTL, empty-state icons, date format, white label, phone buttons, skin QA follow-up, intercom cards 2401, accordion 2402) | workstation @ 62ab4dce8 | **157 passed** |
| `node --test frontend/scripts/visual.test.mjs` (T074) | workstation | **8 passed** |
| Unit after g (ha-sync-status, bridge key, t097, HUD opaque, menu lint) | workstation @ 8fff6f930 | **32 passed** |
| Backend G1 (SR-1, `test_wxh_leftovers_2405`, shared spaces x3, devices, raw-body order, body limit, gate always-run, `test_fixture_job`, T074 gate visual block / video timing, select tests, gate2 select, plan routes unique, release check) | workstation @ 62ab4dce8 | 296 passed, **1 failed** -> fixed (`0af8ef21a`) |
| Backend G2 (all 24 `test_bridge_*`) | workstation @ 62ab4dce8 | **1034 passed, 1 skipped** |
| Backend G3 (frigate f2b / control / frigate2 / frigate playback, playback timing T074 and the 7 playback files, media api, live H.265, video transport, sub fallback, notify channels, remote access) | workstation @ 62ab4dce8 | 379 passed, **1 failed** -> fixed (`002b3deba`) |
| Backend G4 (self-update x5, pairing 2382, extid, lovelace card, adopt review, S4 observer, door bridge block, version, docs config, backup) | workstation @ 62ab4dce8 | **273 passed, 4 skipped** |
| Backend G5 (`test_outage_run_t035`, ha, intercom, devices, health report, `test_wxh_leftovers_2405`, SR-1, gate always-run, remote access, db gate) | workstation @ 8fff6f930 | **411 passed** |
| Backend G6 (the door set: 7 `test_wiskey_door_*`, d6-d8, wxd fixes, WXD10, door automation, doorwin, door bridge block, T19 fake-HA context, T06 admission, notify channels, HA names) | workstation @ 8fff6f930 | **411 passed, 3 xfailed** |
| Version pins | workstation @ fe3827cb2 | **55 passed** |
| `preview` **without** refresh, desktop + mobile + tablet, workers 1: every spec with baselines (34 files: all `pixel-*`, `visual-matrix`, `evidence-intercom-ops`, `evidence-wiskey-installer`, `evidence-wiskey-live-validation-2390`, `evidence-replay-3d`) | runner @ 62ab4dce8 (a-f) | **548 passed, 364 skipped, 0 failed** |
| `fixture` job, every group | runner @ 62ab4dce8 (a-f) | FIXTURE_FAIL: 1 failed - `evidence-home-screen:544` (the drag in edit mode did not take; the order race FIXTURE-SPECS reported) |
| `fixture` job, every group, again | runner @ 8fff6f930 (a-g) | **FIXTURE_PASS** - 8 groups, 233 expected, 0 unexpected, 0 flaky |
| `spec` job: `evidence-frigate-f2b-skins-2405`, `evidence-frigate-ui`, `evidence-frigate-control`, `evidence-wxh-leftovers-2405`, desktop + mobile + tablet | runner @ 62ab4dce8 | 138 passed, 2 skipped, **1 failed**: `evidence-frigate-ui:375` [tablet] (the typed delete sent nothing within 5 s) |
| `evidence-frigate-ui` "cases: list, create, rename", desktop + mobile + tablet, `--repeat-each=4` | runner @ 8fff6f930 | **12 passed** - a one-off flake, not reproduced |

**Order-dependent pair (known, not chased):** `test_notify_channels::test_release_route_*` with
`test_wiskey_pairing_2382::test_rotation_switch_on_*` fails on main too in a combined order and passes alone (coordinator). In this
train's groupings they ran in separate processes and both passed; not observed here.

## 4. Version commit (`fe3827cb2`)

- 2.40.4 -> **2.40.5** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`; bridge stays 0.10.5.
- `CHANGELOG.md`: bilingual entry, Hebrew first, no internal codes: a door or device command whose link drops after it left is
  "unknown - check the device" and never offered for a blind retry; a full disk is said clearly (answer + top-bar chip) and writes are
  refused, reads keep working; a revoked add-on token is said plainly; the opaque lit-light buttons on the floor map; a large room fits
  the area screen; shared-space privacy; long bulk previews; the Frigate folded-row tag; owner contacts for bridge-key alerts (and the
  banner while none is set); playback timing in the log; test and release-check maintenance. No migration; rollback to 2.40.4 safe.
- `contracts/API_INVENTORY.md`: 1847 routes, header 2.40.5.

## 5. NOT_RUN and open items

- The release gate, the full backend and unit suites, `build:addon`, Windows pixel baselines.
- The pixel set and the branch evidence specs were not re-run after g (g's frontend change is one status text in
  `api/ha-sync-status.ts`; the fixture job and the unit specs did run after it).
- The runner install of the T074 gate scripts (`release_gate.py`, `gate2_select.py`, `gate2_verdict.py`, `video_timing.py`, ...): the
  coordinator's, after this train's gate.
- Lab: T035's end-to-end run on the real equipment (AT069 / AT070 NOT_RUN), the owner contacts' real e-mail / app delivery, Frigate
  supervised writes (AT230 / AT240 / AT241), a real Ingress request with a long bulk list.
- `evidence-home-screen:544` (the edit-mode drag) failed once in the first fixture run and passed in the second; FIXTURE-SPECS records
  it as a race. `evidence-frigate-ui:375` [tablet] flaked once.
- WXH4 (fresh-key re-pair, emergency revocation) waits for owner decisions.

## 6. Rollback

No migration. Back to 2.40.4: the new settings rows (owner contacts) stay and are ignored; the new routes disappear.
