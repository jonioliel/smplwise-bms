# RELEASE-2403-TRAIN: assembly of the 2.40.3 train (video-policy read only with live video, kiosk / display-wall fallback, skin QA, board hygiene)

Branch `release/2403-train` (worktree `C:\cloude\smplwise-train24`), cut from `origin/main` = v2.40.2 (`ccb77f28d`). Assembled
2026-11-05 on the coordinator's instruction. The version commit is included (2.40.3); the UI build (`build:addon`), the gate, the tag and
the merge to `main` are the lead's. No lab, Home Assistant, WisKey, station or device contact; no runner gate file touched.

## 1. Merges (`--no-ff`, in this order)

All three branches were cut from `ccb77f28d` (the train's base), so each brought only its own commits.

| # | Branch (change doc) | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/VIDEO-2403` (`VIDEO-2403.md`) - `loadVideoPolicy` asks `GET /media/video-policy` only after `/me` and only with `live_video` (the nightly NN1 failure of v2.40.2, `evidence-nn1-p2:208`); the account menu's "וידאו" only with `live_video`; the kiosk and the display wall set `autoProfile` (sub -> main fallback) | 1dc701380 | 818e2a7d4 | none |
| 2 | `pilot/SKIN-QA-2403` (`SKIN-QA-2403.md`) - the fallback tag, the phone toolbar and the intercom settings cards in every skin, light and dark: 7 fixes; `layout-skin-qa-2403` (the skin matrix) and `pixel-skin-qa-2403` (5 new baselines) | ee204a2d1 | 41d8a2e72 | none |
| 3 | `chore/BOARD-HYGIENE-2403` (`BOARD-HYGIENE-2403.md`) - task board after v2.40.2 (`tasks.json` and its views) | e526848c3 | dc142795c | none |

- **The fallback tag, both branches:** VIDEO-2403 changes where the tag can appear (the kiosk and display-wall tiles now pass
  `autoProfile` to `sw-camera-tile`); SKIN-QA-2403 changes how it is drawn (`sw-live-player.ts` `.subtag`: full on-video ink and the HUD
  blur, a second row under the remote profile badge, hidden under the badge on a remote tile narrower than 160 px). The tag is drawn by
  the player itself, so the kiosk and display-wall tiles get SKIN-QA's tag with no extra change; the two branches touch no common file.
  Checked on the runner: VIDEO-2403's kiosk and display-wall fallback tests (`evidence-video-sub-fallback-2402.spec.ts:127, :137`) pass on
  the merged tree, as do SKIN-QA's matrix (which measures the tag on wall tiles) and its baselines.
- **Registry / views:** after the merges three cards were added and `scripts/project_status.py --write` was run (PASS); the generated
  views were not hand-merged.
- **API inventory:** no route added or removed (1844); regenerated in the version commit (header 2.40.3).

## 2. Train commits

| Commit | What |
|---|---|
| 5573b8e58 | Registry: `VIDEO-2403`, `SKIN-QA-2403`, `BOARD-HYGIENE-2403` added IN_PROGRESS with their requirement and test rows (checked first: no card, requirement or test with these ids; BOARD-HYGIENE-2403 was named only in other cards' evidence lines). `project_status.py --write`: PASS, 450 tasks, 559 requirements |
| 0cc5694c5 | release: 2.40.3 - version, changelog and API inventory |
| (this document) | docs |

## 3. Receipts

Local: workstation, project `.venv` Python 3.12, Node 24.21.0, explicit files only; `frontend/node_modules` is a junction to the main
checkout's (`package-lock.json` identical, gitignored). Runner: `run_smart.py <job> release/2403-train ... --machine=runner`, one job at a
time; before **every** job the script read `gate_status.json` (`pass`, the 2.40.2 gate of `ccb77f28d`) and checked that no `release_gate`
process existed, and would have stopped otherwise; 104 GB free.

| Check | Where / SHA | Result |
|---|---|---|
| `scripts/release_check.py` | workstation @ 5573b8e58 | every item `[ok]` (one version 2.40.2, tag `v2.40.2`); RESULT: ready |
| the same | workstation @ 0cc5694c5 | one version **2.40.3** everywhere; every item `[ok]` except the expected `[FAIL] git tag v2.40.3 not yet`; RESULT: ready |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ 5573b8e58 | exit 0 |
| Unit, explicit files (23: `unit-video-2403`, sub fallback 2402, video transport 2400, user menu sections, menu lint, policy webrtc-first; SKIN-QA's: token lint, design tokens x2, a11y x2, RTL, white label, motion, phone buttons 44, dark polish beds, glass scheme, glass wall, empty-state icons, intercom cards 2401, accordion 2402, wall phone bar 2401; settings index) | workstation @ 5573b8e58 | **180 passed** |
| Backend (13 files; VIDEO-2403 has no backend change: the settings tests - ui settings, settings nav pref, accordion 2402, intercom cards 2401, wall phone bar, ui tabs config - the video policy tests - sub fallback 2402, video transport 2400 - and the status / release tests - progress matcher, release check, docs config, gate always-run, version) | workstation @ 5573b8e58 | **181 passed** |
| Version pins (version, plan versions, release check, release notes marker, supervisor build check, docs config, self-update downgrade) | workstation @ 0cc5694c5 | **55 passed** |
| `preview` **without** refresh, desktop + mobile + tablet, workers 1: `evidence-nn1-p2`, `evidence-video-sub-fallback-2402`, `pixel-skin-qa-2403`, `pixel-settings-intercom-cards-2401`, `pixel-settings-cards-accordion-2402`, `visual-matrix`, `evidence-mobile-wall-kiosk`, `evidence-wall`, `-alerts`, `-answers-2400`, `-followups-2390`, `-hide`, `-live-cap`, `-pano`, `-phone`, `-plan` | runner @ 5573b8e58 | **293 passed, 226 skipped (project-scoped), 0 failed** - `evidence-nn1-p2:208` passed on desktop, tablet and mobile |
| `preview` without refresh, desktop + mobile: `layout-skin-qa-2403` (the skin matrix: 6 skins x 2 schemes x 6 + 2 remote) | runner @ 5573b8e58 | **74 passed, 74 skipped, 0 failed** |
| `spec` job (Vite dev server), desktop + mobile + tablet: `layout-settings-cards-accordion-2402`, `layout-settings-intercom-cards-2401`, `evidence-settings-intercom-cards-2401` | runner @ 5573b8e58 | **15 passed, 21 skipped, 0 failed** |

No baseline was invalidated and none was re-taken on the train: SKIN-QA's 5 new images and the 2401 / 2402 cards images, `visual-matrix`
and the wall specs passed without refresh on the merged tree.

## 4. Version commit (`0cc5694c5`)

- 2.40.2 -> **2.40.3** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`; bridge stays 0.10.4.
- `CHANGELOG.md`: bilingual entry, Hebrew first, no internal codes: an installation without video no longer asks the server for the video
  setting (and "Video" in "My account" only with live video); the kiosk and the display wall also fall back to the main stream; the
  fallback tag and the settings cards readable in every skin and dark, the phone toolbar's touch sizes and press feedback, the Domus /
  Tesla 1366x768 fit; the task board brought up to date; no migration, rollback to 2.40.2 safe, no Home Assistant restart.
- `contracts/API_INVENTORY.md`: 1844 routes, header 2.40.3.

## 5. NOT_RUN and open items

- The release gate, the full backend and unit suites, `build:addon`, Windows pixel baselines.
- Lab: the kiosk / display-wall fallback on cameras 8 and 10, and an installation without an NVR (no `/media/video-policy` in the network
  list) - VIDEO-2403 "Lab check for the owner".
- Physical phones and non-Chromium browsers for the skin fixes (SKIN-QA section 9).
- Owner decisions from SKIN-QA: the tag hidden under the profile badge on remote tiles narrower than 160 px (section 6), and the shared
  component findings K1 (`sw-badge` live: white on green) and K2 (classic dark primary button), not fixed (section 4).
- The three new cards stay IN_PROGRESS until 2.40.3 is released; then REVIEW.

## 6. Rollback

No migration, no setting, no token added. Back to 2.40.2: the client reads `/media/video-policy` again in every installation (harmless
where the route answers), and the kiosk / display wall stop falling back.
