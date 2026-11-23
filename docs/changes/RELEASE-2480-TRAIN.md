# RELEASE-2480-TRAIN - the 2.48.0 train

Branch `release/2480-train`, cut from `main` = tag `v2.47.0` (`619f94d04`) on 23.11.2026 by the release-assembly agent in the worktree
`C:\cloude\smplwise-2480train`. Owner standing rule (18.11): one train and one release gate per version, fix forward with targeted
re-runs. The owner approved all looks on 23.11. Merge order from the trial (`private/planning/trial_2480_train_2026-11-23.md`, section 7)
as set by the lead; PHONE-SHEET-2480 added by the lead after CMP2-POLISH (owner approved the look; runner: sheet specs green,
electricity specs 138 passed). Every head was checked against `origin` after `git fetch`; merges `--no-ff`, messages from UTF-8 files
without BOM. Generated files were regenerated, never hand-merged.

## 1. What merged (in this order)

| # | Branch | Head | Merge | Conflicts and resolution |
|---|---|---|---|---|
| 1 | `pilot/COLOR-LITERAL-B-2480` | cc342daa4 | 9815fc5be | `scripts/design_ratchet_baseline.json` (generated): main's file, then `design_ratchet.py --update` |
| 2 | `pilot/COLOR-LITERAL-A-2480` | e4899b75d | 76e1ad582 | `frontend/src/wall/sw-wall.ts`: both rows tokenised the takeover text shadow (B: local `--wl-text-shade`, A: shared `--sw-video-shadow-ink` via `color-mix`) - kept A's shared token in both rules and dropped B's unused `--wl-text-shade` declaration (same `rgba(0,0,0,.75)`, pixel-neutral; as in the trial). Baseline regenerated. The row no longer carries the 18 `docs/evidence/USR2` images (e4899b75d restored them) |
| 3 | `pilot/NATIVE-SELECT-A-2480` | fb1f55a54 | a4b84cc54 | none (changes the native-select rule of `design_ratchet.py`) |
| 4 | `pilot/SCROLL-AUDIT-2480` | 8c8a87e9a | bb711ff3a | `scripts/design_ratchet.py`: NATIVE-SELECT-A's `count_bare_selects` + the row's `count_text(..., allow)` signature - kept both. Baseline regenerated; `test_build_guards_2438.py` + `test_scroll_allow_2480.py` 14 passed |
| 5 | `pilot/HAND-SWITCH-2480` | dab624c06 | b51274eb0 | `scripts/design_ratchet.py`: help text (hand-switch allow-list note + scroll allow-list note) and `count_text` (scroll-container allow-list branch + hand-switch `_SWITCH_ALLOWED` branch) - kept both in each hunk; baseline regenerated; the two ratchet test files 15 passed |
| 6 | `pilot/SHARED-CHECKBOX-2480` | 3d35ce1c9 | 83b0fd3e2 | none |
| 7 | `pilot/SEG-MODULE-LOOK-2480` | a7805ed91 | 764ba3882 | none (carries SEG-WRAP-2480 a7805ed91 and the commits of the held CR-SEG-MODULE-LOOK-2470) |
| 8 | `pilot/A11Y-AUDIT-2490` | 00cd9168e | b31dd99cf | `components/sw-segmented.ts` and `tests/unit-sw-segmented.spec.ts`: the trial's resolution (module-look key sizes + A11Y's `aria-checked` sentence; the chosen-key regex expects both selectors with the module-look inks). Compared with the trial file: the only differences are SEG-WRAP's additions |
| 9 | `pilot/CMP2-POLISH-2480` | d8e063ffe | a81d12399 | `tests/unit-sw-segmented.spec.ts`: both rows appended a `describe` at the end (SEG-WRAP, sw-chip-choice module look) - kept both. (The row is built on the held CR-CMP2-POLISH-2470 and reverts its selected-chip look; CR-CMP2-POLISH-2470 itself is not merged) |
| 10 | `pilot/PHONE-SHEET-2480` (lead, 23.11) | 2aa5c58b7 | 87a1f017f | none |
| 11 | `pilot/FLAKY-SWEEP-2480` | 67efe251c | 848f2ec20 | none (carries the product fix DOOR-TECH-REREAD-2480 in `components/wk-door-tech.ts`, and the `PAGE_SPEC` / `gotoApp` fix of the trial) |
| 12 | `pilot/TIMING-LANE-2480` | 0ed97d04a | 849e3c347 | none |
| 13 | `pilot/COMPLEXITY-3-2480` | 5fa014861 | 94e1deae7 | none |
| 14 | `pilot/SINGLETONS-REST-2480` | e1454b1e1 | 773c91b87 | none |
| - | *`pilot/RESPONSE-MODELS-E-2480` goes here when the lead adds it (pending runner reruns): merge right after SINGLETONS-REST (the trial's dry merge: conflicts in `routers/ha.py`, `health.py`, `wiskey_installer_clock.py` - SINGLETONS-REST's `register_reset` lines next to the row's response models, keep both), then `scripts/gen_wire_types.py` once and `--check`* | | | |
| 15 | `pilot/RESPONSE-HINTS-2480` | 461375ecb | 869f065d0 | `screens/system-notifications.ts`: the channel chips line - the row's new `announce` chip kept, with A11Y's `role="img"` on the Companion chip (A11Y 768271c77; the row still had `aria-disabled="true"`) |
| 16 | `pilot/PERF-2490` | cb98eac1c | 7438ab2a7 | none |
| 17 | `pilot/UNIT-NO-DOCS-WRITES-2480` | 343d9a617 | 97789b6c3 | none |
| 18 | `pilot/EVIDENCE-PREEXIST-2480` | 28133a35d | 8b0419d8b | none |
| 19 | `pilot/GATE-ONEPROJECT-2480` | b4357f905 | d6e0ff163 | `tests/evidence-readiness-96.spec.ts` (both rows open the hand-over pane on a phone): kept ONE version, EVIDENCE-PREEXIST's - it waits for `[data-readiness]` first and opens the pane by its name when the pane switcher is visible (GATE-ONEPROJECT's `nth(2)` without the wait dropped). EVIDENCE-PREEXIST's re-worded desktop-only skip message keeps the "one project" words out of code (harmless with the new classifier either way). Desktop / tablet / mobile result: section 4 |
| 20 | `chore/MGMT-OWNER-ANSWERS-2211` | 61fdaef15 | 72733e88b | none |
| 21 | `pilot/FEATURE-DESIGNS-SEC-2490` | 87e4bdfef | 6056dd12a | none (docs / design only) |
| 22 | `pilot/API-CONTRACT-ADR-2490` | c1f4ce920 | 66b6d49ac | none (ADR-019; no ADR collision, see the trial section 2) |

Not on this train: NATIVE-SELECT-B-2480 (dropped), CR-CMP2-POLISH-2470 and CR-SEG-MODULE-LOOK-2470 (held rows; their kept parts come
through rows 7 and 9), DOCS-RELNOTES-2480B (already in 2.47.0), I18N-EN-2490, I18N-BACKEND-2490, GEN-UNITS-FIELD-2490,
TICKETS-PAGING-2490, FLAKY-CAPTURE-SCREENSHOT-2490 (2.49.0), RESPONSE-MODELS-E-2480 (pending, place marked above).

## 2. Fix and housekeeping commits on the train

| Commit | What |
|---|---|
| c7756d161 | `scripts/error_contract_inventory.py` docstring: ADR-019 covers both L2 and L14 (there is no ADR-020) - the trial's db82dc6ec |
| 60b5f7c45 | regenerated: `design_ratchet_baseline.json` (`--update`; against 2.47.0 every count is lower or equal: color-literal 2497 -> 1984, px-literal 25485 -> 25462, native-select 551 -> 262, hand-switch 359 -> 161, scroll-container 226 -> 13; undefined-token 0, native-dialog 3, native-table 58 unchanged), `gates-baseline.json` (`unused-exports.mjs --update-baseline`: `src/design/palette.ts#SCHEMA` pruned; unreferenced 47, file-local 52), management views (`project_status.py --write`: only the timestamp moves) |
| b48f6542b | `tests/pixel-sw-checkbox.spec.ts`: the created element is cast through `unknown` (`tsc -p tsconfig.tests.json` TS2352 on the merged tree: `SwCheckbox` in `HTMLElementTagNameMap` is not comparable to `HTMLElement & Record<string, unknown>`); test-only |
| 6a6aaf716 | merge regression of HAND-SWITCH-2480: `screens/plan-studio-panel.ts` imported `toggled` from `components/sw-toggle`, so the Node unit specs that import plain helpers from it (`unit-geometry`, `unit-curve-fit`, `unit-glass-wall`) loaded the decorated element and the WHOLE unit run aborted at collection ("Unsupported decorator location: field", the R5-ASSEMBLY pattern). `toggled()` moved to the decorator-free `components/toggle-value.ts`; `sw-toggle.ts` re-exports it (every other caller unchanged); the panel imports it from there. No run-time change (sw-toggle is registered by the shell). A relative-import walk of every `unit-*.spec.ts` finds no other path to a decorated module |
| eabc1ee75 | `tests/unit-polish4-wp4-home.spec.ts` (D2 source guard): PERF-2490 put `if (!this.remoteReady && this.wantsRemote) this.loadRemote();` first in `home-widgets.ts` `updated()`; the guard allows that one optional line before `syncTicker()` / `watchEditBars()`; test-only |

Note on px-literal: the value written after merge 5 was 25456; the rows merged later each added a few px literals against their own
25485 baseline (sw-toggle, sw-chip-choice, sw-segmented, public-ticket arrival / claim, explore-presence, ...), so the final count is
25462. It is below the 2.47.0 baseline (25485), so nothing is raised against `main`; `--update --allow-raise` was used only to move the
train's own intermediate number.

## 3. Release commits

| Commit | What |
|---|---|
| 2dd223282 | release: 2.48.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), bilingual CHANGELOG, API inventory (1910 routes, unchanged). No migration (0216 stays the last). Bridge unchanged (0.10.8) |
| (UI) | release: 2.48.0 - rebuilt UI: see the end of this section |

## 4. Checks before the gate (workstation, Python 3.12, Node 24.21.0, `npm ci` in the worktree)

| Check | At | Result |
|---|---|---|
| `py -3.12 scripts/design_ratchet.py` | 6a6aaf716 | no count above the baseline (color 1984, px 25462, undefined-token 0, native-dialog 3, native-select 262, native-table 58, hand-switch 161, scroll 13) |
| `test_build_guards_2438.py` + `test_scroll_allow_2480.py` (main `.venv`) | after merges 4 and 5 | 14 / 15 passed |
| `scripts/gen_wire_types.py --check`, `scripts/sync_integration.py --check` (main `.venv`) | 60b5f7c45 | exit 0 / up to date |
| `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` / `tsconfig.scripts.json` | 6a6aaf716 / eabc1ee75 / 60b5f7c45 | exit 0 / 0 (after b48f6542b; 1 error before) / 0 |
| `npx eslint src --pass-on-unpruned-suppressions` | 050fe87b3 (+ the three files of 6a6aaf716) | exit 0 |
| `node scripts/unused-exports.mjs --enforce` | 6a6aaf716 | OK (unreferenced 47, file-local 52) |
| EN ratchet | - | NOT_RUN: the ratchet lives on I18N-EN-2490 (not on this train) |
| `scripts/api_inventory.py` | 2dd223282 | 1910 routes (unchanged) |
| `project_status.py --write` | 60b5f7c45 | PASS (647 tasks, 761 requirements) |
| Full frontend unit suite `playwright.unit.config.ts --workers=2` | 050fe87b3 | ABORTED at collection (the sw-toggle decorator, fixed in 6a6aaf716) |
| same | 6a6aaf716 | **5,127 passed, 1 failed, 10 skipped** (14.0 min); the failure = the D2 guard fixed in eabc1ee75 |
| `unit-polish4-wp4-home` + `unit-geometry` + `unit-curve-fit` + `unit-glass-wall` | eabc1ee75 | 47 passed (the full suite was not re-run after this test-only fix) |
| Backend: the 21 test files the train adds / changes + `test_singletons_registered.py` + the 8 `test_calendar*.py` (30 files, main `.venv`, `-m "not timing_lane"`) | 050fe87b3 | PARTIAL: stopped by its own 2,400 s cap at ~99 % (the PC was shared with the unit run): **16,708 passed, 0 failed**; the last ~1 % did not run - the gate's full backend covers it |
| `ruff` | - | NOT_RUN (not installed in the main `.venv`; the gate's fe/be static runs it) |

## 5. Lead steps before the release gate

1. Deploy the GATE-ONEPROJECT classifier to the runner (only while no gate runs; never stop a running gate), from this train's
   `scripts/gate/release_gate.py` and `scripts/gate/selftest_gate.py` (procedure: `docs/changes/GATE-ONEPROJECT-2480.md` section 5):
   back up `~/gate2/release_gate.py` (`.bak-oneproject2480`), copy the file, `md5sum` equals the repository file, copy
   `selftest_gate.py` next to it and run it (`SELFTEST PASSED`); then the same file to `~/nightly-gate/release_gate.py`. Without it the
   gate keeps limiting 38 specs (among them `evidence-readiness-96`) to one project.
2. If RESPONSE-MODELS-E-2480 boards: merge it after SINGLETONS-REST as marked in section 1, regenerate the wire types, re-run
   `design_ratchet.py`, `unused-exports.mjs --enforce`, tsc, and rebuild the UI.

## 6. Release gate

Not started by this agent (the lead runs it).
