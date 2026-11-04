# RELEASE-2401-TRAIN: assembly of the 2.40.1 train (bridge 0.10.4, phone camera-wall toolbar, intercom settings cards)

Branch `release/2401-train` (worktree `C:\cloude\smplwise-train22`), cut from `origin/main` = v2.40.0 (`d6294fc51`). Assembled
2026-11-04 on the coordinator's instruction. The version commit is included (2.40.1); the UI build (`build:addon`), the gate, the tag and
the merge to `main` are the lead's. No lab, Home Assistant, WisKey, station or device contact.

## 1. Merges (`--no-ff`, in this order)

| # | Branch (change doc in `docs/changes/`) | Tip | Cut from | Merge commit | Conflicts |
|---|---|---|---|---|---|
| 1 | `fix/BRIDGE-UPDATE-LISTENER-2401` - bridge 0.10.4: the update listener and the config-flow reload no longer combine (Home Assistant 2026.12) | 4c6bf7fae | 2400 train ac87047b2, main d6294fc51 merged | 61d8f1794 | none |
| 2 | `pilot/WALL-PHONE-TOOLBAR-2401` - the phone camera-wall toolbar: one row of icon keys by default, setting `ui.wall_phone_bar` (`icons` / `labels`); `sw-dropdown` `icon-only` / `badge`; 2 `visual-matrix` live-wall mobile baselines re-taken | be89ef02b | same | 4d4fdeb7d | none |
| 3 | `pilot/SETTINGS-INTERCOM-CARDS-2401` - the "מתגי מסכי כניסה" tab as folding cards, setting `access.settings_layout` (`cards` / `tabs` / `list`), `sw-fold-cards`; 11 `pixel-access-s12` baselines re-taken, 5 new | 51106f4ab | same | b8afa129a | none (3 files auto-merged) |

Then `604305354` - "release: 2.40.1 - version, changelog and API inventory", and this document.

All three branches already contained `d6294fc51` (merge base = the train's base), so each brought only its own commits.

### 1.1 Expected conflicts - what happened

- **`routers/settings.py`** (2 and 3): auto-merged. Both settings are present: `DEFAULTS` `ui.wall_phone_bar = icons` and
  `access.settings_layout = cards`; `SettingsPatch` patterns `^(icons|labels)$` and `^(cards|tabs|list)$`; the corrupt-value read-back of
  `access.settings_layout` in `read_settings`. No separate settings registry lists either key (searched the tree: only `settings.py`,
  `api/media.ts`, the screens, tests and docs name them).
- **`frontend/src/api/media.ts`** (2 and 3): auto-merged, both `ProductSettings` keys typed.
- **`frontend/src/screens/system-diagnostics.ts`** (2 and 3): auto-merged - the wall row "סרגל קיר המצלמות בטלפון" in the media tab and
  the cards / tabs / list layout of the access-control tab are in different parts of the file.
- **`sw-dropdown`**: only branch 2 changed it; no conflict.
- **User guide `docs/user-guide/he/80-settings_HE.md`**: only branch 2 changed it (one row for the wall toolbar); branch 3 did not
  describe the layout row (its NOT_RUN). `GUIDE_ALL_HE.html` not regenerated (both branches: at the release).
- **API inventory**: no branch adds or removes a route. Regenerated after the merges (1844 routes, unchanged) and in the version commit
  (header 2.40.1).
- **Bridge mirror**: `scripts/sync_integration.py --check` - up to date (both copies 0.10.4).

## 2. Receipts

Local: workstation, project `.venv` Python 3.12, Node 24.21.0; `frontend/node_modules` is a junction to the main checkout's
(`package-lock.json` identical, gitignored). Runner: `private/runner/run_smart.py <job> release/2401-train ... --machine=runner`; before
**every** job `~/smplwise-results/gate_status.json` read (`pass`, the 2.40.0 gate of `release/2400-train`), no `release_gate` process,
103-104 GB free.

| Check | Where / SHA | Result |
|---|---|---|
| `scripts/release_check.py` | workstation @ b8afa129a | every item `[ok]` (one version 2.40.0, tag `v2.40.0`, bridge copies identical, bridge 0.10.4 = manifest = const, migrations 205 contiguous); RESULT: ready |
| the same | workstation @ 604305354 | every item `[ok]` (one version **2.40.1** incl. CHANGELOG head and API inventory) except the expected `[FAIL] git tag v2.40.1 not yet`; RESULT: ready |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ b8afa129a and @ 604305354 | exit 0 both |
| Unit, explicit files (37: `unit-wall-phone-bar-2401`, `unit-settings-intercom-cards-2401`, settings index / nav / rows, intercom ops, TTS default, wxmedset, talk max, parity logic, stations, triage, embed connector, dropdown fit, multi-select, wall count / grid / logic / arrangement, kiosk idle, glass wall, walk touch, and the lints: tokens, design tokens x2, pending tokens, a11y x2, menu, RTL, white label, motion, phone buttons, dark beds, empty-state icons, date format, page background) | workstation @ b8afa129a | **371 passed, 0 failed** |
| Backend group 1 (14 files: `test_bridge_update_listener_2401`, `test_bridge_stale_discovery_2383`, `test_wall_phone_bar`, `test_settings_intercom_cards_2401`, ui settings, settings nav pref, release check, version, docs config, extid followups, lovelace card, adopt 2272 review, S4 core observer, pairing 2382) | workstation @ b8afa129a | **210 passed, 4 skipped** |
| Backend group 2 (the other 22 `tests/test_bridge_*.py`) | workstation @ b8afa129a | **990 passed, 1 skipped** |
| Version pins (version, plan versions, release check, release notes marker, supervisor build check, docs config, self-update downgrade) | workstation @ 604305354 | **55 passed** |
| `preview` **without** refresh, desktop + mobile + tablet, workers 1: `visual-matrix`, `pixel-access-s12`, `pixel-settings-intercom-cards-2401`, `evidence-mobile-wall-kiosk`, `layout-settings-nav-fit-402`, `layout-settings-nav-295`, `layout-dropdown-fit`, `layout-dropdown-capsule`, `evidence-wall`, `evidence-wall-alerts`, `-answers-2400`, `-followups-2390`, `-hide`, `-live-cap`, `-pano`, `-phone`, `-plan`, `evidence-access-s12`, `layout-access-s12`, `evidence-incoming-call`, `evidence-tts-default-2400` | runner @ b8afa129a | **330 passed, 297 skipped (project-scoped), 0 failed** |
| `spec` job (Vite dev server), desktop + mobile + tablet: the 7 `dropdown-*` specs, `layout-settings-intercom-cards-2401`, `evidence-settings-intercom-cards-2401`, `evidence-settings-cards-2380` | runner @ b8afa129a | **344 passed, 40 skipped, 0 failed** |

- `evidence-mobile-wall-kiosk.spec.ts:61` (red on 2.40.0, `RELEASE-2400-TRAIN` 8.5) now passes on the phone as the default icon row
  (:64), with the long-press test and the "two rows with full labels" option test (:126, :162).
- `layout-settings-nav-fit-402`: passed at 1440x900 and 1366x768.
- **Cross-branch baselines**: none invalidated. Branch 2's re-taken `visual-matrix` live-wall mobile images, branch 3's 11 re-taken
  `pixel-access-s12` images and its 5 new `pixel-settings-intercom-cards-2401` images all passed without refresh on the merged train, and
  no other image of `visual-matrix` / `pixel-access-s12` moved (branch 2's wall row sits in the media tab, which no pixel spec of
  branch 3 shows; branch 3's cards are not on the wall). Nothing re-taken on the train.

## 3. Version commit (`604305354`)

- 2.40.0 -> **2.40.1** in `smplwise_vms/config.yaml`, the Dockerfile label `io.hass.version` and `smplwise/__init__.py`. Bridge stays
  0.10.4 (from branch 1).
- `CHANGELOG.md`: bilingual 2.40.1 entry at the top (Hebrew first, as 2.40.0), no internal codes: no migration (back to 2.40.0 is
  safe); the phone toolbar (one icon row by default, two rows with full names in Settings › General › Video and media); the intercom
  settings tab cards (folding cards / two tabs / one list, chosen in the tab itself); bridge 0.10.4 (Arx copies it automatically, one
  Home Assistant restart after the copy; a manual WisKey install copies `custom_components/smplwise_bridge` by hand, before Home
  Assistant 2026.12).
- `contracts/API_INVENTORY.md`: 1844 routes, header 2.40.1.

## 4. NOT_RUN and known limits

- The full backend suite, the full unit sweep (430+ files), the release gate, `build:addon` (the lead's), Windows pixel baselines.
- The bridge against a real Home Assistant core (no `homeassistant` package on the workstation; branch 1's stubs model 2026.12) and in
  the lab: that the warning is gone after the next Home Assistant start is not verified.
- The icon toolbar's long press on a physical phone (branch 2, section 4: a native select may open its picker on release).
- Layout "folding cards" in skins other than classic light (branch 3, section 8); the user guide does not describe the layout row yet.
- Pre-existing, from branch 1: `tests/test_bridge_install.py` leaks `bridge_install.STATE` into `test_self_update*.py` when run before
  them in one process (4 tests); not hit here (the self-update files did not run in the same process); not changed.
- `management/tasks.json` / `test_catalog.json` not edited.

## 5. Rollback

No migration. Revert the train's merges, or go back to 2.40.0: the two settings rows stay in `settings` and are ignored; the bridge
0.10.3 of 2.40.0 keeps working on Home Assistant up to 2026.11 (with the warning).

## 6. Gate of d6e20460f (UI build commit): two pixel items

The 2.40.1 gate on `release/2401-train` @ `d6e20460f` failed on two pixel-only items (`gate_release-2401-train_d6e20460f.gate2.md`).

### 6.1 Shard pixel_10 "No tests found" - fixed (`c74d32ec6`, test only)

- Cause: the gate's pixel lane runs every mapped pixel spec as `playwright test <spec> --project=desktop --project=mobile -g
  pixel-stable`. Shard pixel_10 was `pixel-settings-intercom-cards-2401.spec.ts` (new in SETTINGS-INTERCOM-CARDS-2401), and none of its
  three test titles contained "pixel-stable", so Playwright found no test (rc 1). The branch's own runs had not used the `-g` filter.
- Fix: the three titles now start with "classic is pixel-stable:" (the convention of the other pixel specs), and the spec's header says
  why. Baseline file names are passed by the spec (`compare(page, 'cards-...')`), not derived from the title, so no image changes. No
  product code changed - no UI rebuild needed.
- Checked: of the other `tests/pixel-*.spec.ts`, `pixel-dialog-toplayer-2381` builds its titles with `pixelTitle()` and
  `pixel-notice-tv-mock` has no baselines (the gate does not map it to the pixel lane); no other pixel spec is missing the word.

### 6.2 `evidence-wiskey-installer.spec.ts:324` [mobile] (`installer-lifecycle-wizard-card-390`, 952 px) - not reproduced, nothing changed

- The gate run and its retry alone failed (retry 20:38 UTC). The gate's actual / diff images were not kept: the next gate phase emptied
  `~/work/gate-release-2401-train/frontend/test-results` (only `.last-run.json` is left), so the diff could not be looked at.
- The gate's `dist` and the one `run_smart.py preview` builds for this train are the same build (`dist/index.html` identical, same
  `index-xLRE7Qht.js`, 476 assets, both at `d6e20460f`).
- On the runner, after the gate (no gate running, `release_gate` absent): the test alone at `d6e20460f` [mobile] **1 passed**; the whole
  installer spec the gate's way (`-g pixel-stable`, desktop + mobile, workers 1, `--repeat-each=3`) **42 passed**; and the gate's whole
  pixel set (below) passed it again. So the merged change does not move this card in a clean run; it was not re-taken (re-taking an image
  that matches would only hide the cause). The test fixes the clock and mocks the backend; the remaining suspects are environmental
  (machine load while the gate ran other phases; the shell's floating pill that the 2.40.0 train noted over this card's corner on the
  phone). If it fails again in the re-gate, the gate must keep that run's actual / diff images so the region can be looked at.

### 6.3 Receipts (runner, before every job `gate_status.json` = `fail` (ended), no `release_gate` process, 104 GB free)

| Job | SHA | Result |
|---|---|---|
| `preview` `evidence-wiskey-installer` [mobile] `-g "connection step"` | d6e20460f | 1 passed |
| `preview` `evidence-wiskey-installer`, desktop + mobile, workers 1, `-g pixel-stable`, `--repeat-each=3` | d6e20460f | **42 passed** |
| `preview`, the gate's 23 mapped pixel spec files (`evidence-intercom-ops`, `evidence-wiskey-installer`, `evidence-wiskey-live-validation-2390` and the 20 `pixel-*` of the gate selection incl. `pixel-settings-intercom-cards-2401`), desktop + mobile, workers 1, `-g pixel-stable` | c74d32ec6 | **197 passed, 25 skipped, 0 failed** |

NOT_RUN: the re-gate (the lead's).
