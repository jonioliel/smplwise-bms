# RELEASE-2402-TRAIN: assembly of the 2.40.2 train (gate hygiene, sub->main video fallback, settings accordion, the guide for 2.40.x)

Branch `release/2402-train` (worktree `C:\cloude\smplwise-train23`), cut from `origin/main` = v2.40.1 (`0e8c3109b`). Assembled
2026-11-04/05 on the coordinator's instruction. The version commit is included (2.40.2); the UI build (`build:addon`), the gate, the tag,
the merge to `main` and the runner install of the new selector are the lead's. No lab, Home Assistant, WisKey, station or device contact;
no runner gate file was touched.

## 1. Merges (`--no-ff`, in this order)

All four branches were cut from `604305354` (the 2.40.1 version commit), i.e. before main's `c74d32ec6` (the `pixel-stable` titles of
`pixel-settings-intercom-cards-2401.spec.ts`) and `d6e20460f` (the 2.40.1 UI build).

| # | Branch (change doc) | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `chore/GATE-HYGIENE-2402` (`GATE-HYGIENE-2402.md`) - `gate_always_run.json` + selector support in `scripts/gate/select_tests.py`, the `test_readiness_96` Windows check, the `bridge_install.STATE` reset in `tests/conftest.py` | 809b382ac | 0ff7dac9b | none |
| 2 | `pilot/VIDEO-SUB-FALLBACK-2402` (`VIDEO-SUB-FALLBACK-2402.md`) - automatic quality: sub -> main on the same transport, remembered 10 min, `profile_fallback` audit field, the 480-case policy table | 27ef9a234 | cb4b47767 | none |
| 3 | `pilot/SETTINGS-CARDS-ACCORDION-2402` (`SETTINGS-CARDS-ACCORDION-2402.md`) - `access.settings_layout` gains `accordion`; 1 new pixel baseline | e9f76b42f | 406bdeeb4 | none (`api/media.ts` auto-merged) |
| 4 | `docs/GUIDE-BOARD-2402` (task card `management/tasks/GUIDE-BOARD-2402.md`) - guide pages, `GUIDE_ALL_HE.html`, `tasks.json`, task cards, test catalog, requirements, status views | 3308bd1fa | 488735490 | none |

- **Pixel test titles:** no branch edits `pixel-settings-intercom-cards-2401.spec.ts`; main's `classic is pixel-stable: ...` titles are kept.
  The new `pixel-settings-cards-accordion-2402` test title already contains "pixel-stable" (the gate's `-g` filter, RELEASE-2401-TRAIN 6.1).
- **Registry / status views:** main had changed nothing under `management/` since `604305354`; after the merges
  `scripts/project_status.py --write` was run (PASS) instead of a hand merge. The generator writes CRLF on Windows; `.gitattributes`
  normalizes, so only real content changes are committed.
- **API inventory:** no branch adds or removes a route (1844, unchanged); regenerated in the version commit (header 2.40.2).

## 2. Train commits

| Commit | What |
|---|---|
| 92d0b2ef8 | Guide: `30-cameras_HE.md` (the sub -> main fallback: automatic quality only, the tag "עבר לזרם הראשי", the 10-minute memory, the explicit-quality message "הזרם המשני לא מגיע מהמצלמה", what is never a reason), `80-settings_HE.md` (four layouts, the new "כרטיסים: נפתחים במקום"), `15-whats-new-2400-2401_HE.md` (a 2.40.2 section), `00-INDEX_HE.md`; `GUIDE_ALL_HE.html` rebuilt with `scripts/build_guide.py` (it was up to date before these edits; `--check` passes after). Registry: `GATE-HYGIENE-2402`, `VIDEO-SUB-FALLBACK-2402`, `SETTINGS-CARDS-ACCORDION-2402` added IN_PROGRESS with their requirement and test rows (checked: no duplicate ids); `RELEASE-2401-TRAIN`, `BRIDGE-UPDATE-LISTENER-2401`, `WALL-PHONE-TOOLBAR-2401`, `SETTINGS-INTERCOM-CARDS-2401` -> REVIEW (released, v2.40.1 = `0e8c3109b`); `project_status.py --write` PASS (447 tasks, 556 requirements) |
| 4afb04580 | release: 2.40.2 - version, changelog and API inventory |
| (this document) | docs |

## 3. Receipts

Local: workstation, project `.venv` Python 3.12, Node 24.21.0, explicit files only; `frontend/node_modules` is a junction to the main
checkout's (`package-lock.json` identical, gitignored). Runner: `run_smart.py <job> release/2402-train ... --machine=runner`; before
**every** job `gate_status.json` = `pass` (the 2.40.1 gate of `0e8c3109b`), no `release_gate` process, 99-101 GB free.

| Check | Where / SHA | Result |
|---|---|---|
| `scripts/release_check.py` | workstation @ 92d0b2ef8 | every item `[ok]` (one version 2.40.1, tag `v2.40.1`); RESULT: ready |
| the same | workstation @ 4afb04580 | one version **2.40.2** everywhere; every item `[ok]` except the expected `[FAIL] git tag v2.40.2 not yet`; RESULT: ready |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ 92d0b2ef8 | exit 0 |
| Unit, explicit files (21: `unit-video-sub-fallback-2402`, video transport, policy lan / webrtc-only / webrtc-first, H.265, camera card, station media, `unit-settings-cards-accordion-2402`, intercom cards 2401, settings index, wall phone bar, and the lints: tokens, design tokens, a11y, menu, RTL, empty-state icons, date format, white label, phone buttons) | workstation @ 92d0b2ef8 | **182 passed** |
| Backend (18 files: `test_gate_always_run`, `test_select_tests`, `test_gate2_select`, `test_readiness_96`, `test_video_sub_fallback_2402`, `test_video_transport_2400`, live H.265, HA camera live, intercom media, camera scope, `test_settings_cards_accordion_2402`, intercom cards 2401, ui settings, ui tabs config, settings nav pref, wall phone bar, release check, docs config) | workstation @ 92d0b2ef8 | **441 passed** - `test_readiness_96` passes on Windows (failed there on 2.39.1 / 2.40.0) |
| `test_bridge_install` + `test_self_update` + `test_self_update_s3`, bridge_install FIRST | workstation @ 92d0b2ef8 | **71 passed** (before GATE-HYGIENE: 4 failed in this order) |
| the same three, bridge_install LAST | workstation @ 92d0b2ef8 | **71 passed** |
| Version pins (version, plan versions, release check, release notes marker, supervisor build check, docs config, self-update downgrade) | workstation @ 4afb04580 | **55 passed** |
| `preview` **without** refresh, desktop + mobile + tablet, workers 1: `evidence-wall-live-cap`, `evidence-wall-pano`, `evidence-video-transport-2400`, `evidence-video-sub-fallback-2402`, `evidence-webrtc-first`, `evidence-webrtc-only`, `evidence-remote-video`, `pixel-settings-intercom-cards-2401`, `pixel-settings-cards-accordion-2402`, `pixel-access-s12`, `layout-settings-nav-fit-402`, `visual-matrix` | runner @ 92d0b2ef8 | **157 passed, 161 skipped (project-scoped), 0 failed** |
| `spec` job (Vite dev server), desktop + mobile + tablet: `layout-settings-intercom-cards-2401`, `evidence-settings-intercom-cards-2401`, `layout-settings-cards-accordion-2402`, `evidence-settings-cards-2380` | runner @ 92d0b2ef8 | **35 passed, 25 skipped, 0 failed** |

No baseline was invalidated across branches and none was re-taken on the train (the accordion's new image and the 2401 cards images
passed without refresh; the 2401 images' area-card summary names the layout, and the new label stayed inside the specs' tolerance, as
the accordion branch recorded).

## 4. Version commit (`4afb04580`)

- 2.40.1 -> **2.40.2** in `smplwise_vms/config.yaml`, the Dockerfile label and `smplwise/__init__.py`; bridge stays 0.10.4.
- `CHANGELOG.md`: bilingual entry, Hebrew first, no internal codes: the camera falls back to the main stream when the sub stream sends
  nothing (automatic quality only, same transport, small tag, remembered 10 min; an explicit quality never switches); a fourth layout
  "cards opening in place" for the intercom settings tab; the guide updated for 2.40.x; test and release-check maintenance with no
  user-visible change; no migration, rollback to 2.40.1 safe, no Home Assistant restart.
- `contracts/API_INVENTORY.md`: 1844 routes, header 2.40.2.

## 5. NOT_RUN and open items

- The release gate, the full backend suite (GATE-HYGIENE changes `tests/conftest.py`, a full-backend-tier trigger, so the 2.40.2 gate
  runs the full backend tier), the full unit sweep, `build:addon`, Windows pixel baselines.
- **The runner install of `scripts/gate/select_tests.py`** (GATE-HYGIENE section 1): the coordinator installs it; until then the runner
  selects as before (the list file is harmless to the old selector).
- Lab: the sub -> main fallback on the cameras whose sub stream sends no frames (VIDEO-SUB-FALLBACK "Lab check for the owner"); the
  accordion in skins other than classic light.
- VIDEO-SUB-FALLBACK open point for the owner: the kiosk, the display wall and the camera page are not "automatic quality" and do not fall
  back.
- `GATE-HYGIENE-2402`, `VIDEO-SUB-FALLBACK-2402`, `SETTINGS-CARDS-ACCORDION-2402` (and `GUIDE-BOARD-2402`) stay IN_PROGRESS until 2.40.2
  is released; then REVIEW.

## 6. Rollback

No migration. Back to 2.40.1: a stored `access.settings_layout = accordion` reads as the default `cards` in 2.40.1; the sub-fallback memory
lives in the browser tab only.
