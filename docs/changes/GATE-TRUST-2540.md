# GATE-TRUST-2540 - can the release gate's green be trusted? (TR-05, TR-07, TR-09, TR-04 remainder)

Source: `docs/review/DEEP-REVIEW-2520-TESTS-RELEASE.md` (origin/review/DEEP-2520-TESTS-RELEASE), findings TR-05, TR-07, TR-09 and the
open part of TR-04 (index: `docs/review/DEEP-REVIEW-2520-INDEX.md` on origin/chore/REVIEW-FINDINGS-INDEX-2530). Target 2.54.
Base: `origin/release/2530-train` @ aeb05ad3d. Branch `pilot/GATE-TRUST-2540`.

All four findings were confirmed still present at the base before the fix (TR-05: `gate_entry.py` called `lb.run(lb.default_root())`;
TR-07: `gate_baselines.json` dated 2026-10-27, backend 17,611, one 0.70 threshold; TR-09: `gate_release.sh` / `release_gate2.sh` took
`--after` with no check; TR-04: only `arx-shell-<version>` was checked).

Nothing on the runner was installed or edited (`~/gate2`, `~/release_gate.py`, `~/nightly_tests.sh` untouched; a 2.53 gate had just
run). The lead installs the engine later with `engine_sync.py` - steps at the end.

## What changed and why

### TR-05 - the blocking backend lint lane lints the branch under test
Before: `gate_release.sh` ran `gate_entry.py decide`, which linted `lint_backend.default_root()`; the script sits in `~/gate2` (not a
checkout), so the lane linted whatever `~/smplwisebms` had checked out. An `--after` run skipped the lane entirely.
- `release_gate2.sh` runs the lane itself, on the engine's own worktree, right after `git checkout origin/<branch>` and before any
  test: `GATE_LINT_ROOT="$WT" gate_entry.py lint --root "$WT" --json gate_<b>_<sha>.lint.json` (timeout 300 s, nice 10). A blocking
  finding stops the gate with exit 1 ("RED - the backend lint ... nothing was run"); NOT_RUN / a timeout never blocks (as before);
  `GATE_BACKEND_LINT=warn|0` as before. The lane now also runs for `--after` runs. The dry run prints it (never blocks).
- `gate_entry.py decide` no longer lints (`decide --lint [--root]` keeps the old call for a manual check). `gate_entry.py lint` takes
  `--root` and `--json`. `lint_backend.run()` records the tree (`root`) and every summary line names it ("... in /home/sw/work/gate-x").
- `gate2_verdict.py` puts the lane's tree and result into the gate-2 summary (from `.lint.json`).

### TR-07 - the count-drop baseline refreshes itself and is tighter, per lane
Before: one tracked file (backend 17,611 vs 44,901 today) and one 0.70 threshold: a full run could lose 72 % of the backend and pass.
The 26.11 nightly on main (backend 31,941 passed, 13,460 failed by an environment crash) showed "181 % of baseline, ok".
- `release_gate.py`: the baseline of a category = max(tracked floor, that category's passed count in the newest GREEN FULL tier-L
  run of the results directories) - `reference_baseline()` / `effective_baseline()`. A run counts for a category only when its
  verdict is pass, it is not a diff selection, it is at most `GATE_BASELINE_REF_DAYS` (30) days old and that category's own
  `baseline_check` row was `ok` or `waived` (so skipped categories, lanes, early-stopped and selection runs never count). A waived run
  is the lead's accepted new count, so it becomes the reference. Directories: `GATE_RESULTS_DIR` and its `nightly/` (and the parent
  when the engine runs as the nightly); `GATE_BASELINE_REF_DIRS` overrides. Nothing found -> the floor only, with a report warning; a
  reference older than 14 days -> a warning.
- Per-category thresholds (`drop_threshold()`): backend / preview / dev 0.90, pixel / fixture 0.85, everything else 0.70. Order:
  `GATE_DROP_THRESHOLD_<CATEGORY>` > `GATE_DROP_THRESHOLD` (all, the old knob) > `"thresholds"` in `gate_baselines.json` > engine
  defaults. Calibration: the green full runs 13.11-26.11 move by less than 5 % per category (backend 44,636 / 44,902 / 46,218;
  preview 23,435-24,447; dev 1,126-1,146; pixel 380-441).
- Report: every `baseline_check` row carries `threshold` and `source` (which report or the floor); the JSON gains `drop_thresholds`,
  `baseline_sources`, `baseline_reference_reports`; the Hebrew table shows the per-row threshold and a "source" line.
- `gate_baselines.json`: floor = the newest green full run (2.50.0 gate, release/2500-train @ bdf28fc37, 24.11: backend 44,902,
  preview 23,818, dev 1,126, pixel 390, fixture 28) plus `"thresholds"`; the comment says it needs no hand refresh any more.

### TR-09 - a targeted `--after` run needs a coverage anchor
Before: `--after <red report>` selected the failed files + the diff + the core, with no bound on how far the head was from a full run.
- New `gate_entry.py anchor` (`anchor_check()`): looks for a run behind the head that covers what the targeted run does not select:
  - a nightly judged green (or red only through quarantined tests), or
  - a release-gate FULL tier-L run that completed (backend ran, no `gate` / `baseline` FAIL) and is green, or red ON THE SAME BRANCH
    (the normal "full run red -> fix -> `--after`" flow; a red full run of another branch is not an anchor: nobody re-runs its failures);
  - its sha an ancestor of the head, at most 20 commits (`GATE2_ANCHOR_MAX_COMMITS`), 36 h (`GATE2_ANCHOR_MAX_HOURS`) and 40 changed
    product source files (`frontend/src`, `smplwise_vms/backend/smplwise`, `custom_components`; `GATE2_ANCHOR_MAX_PRODUCT_FILES`) behind;
  - the `--after` report's own sha must be an ancestor of the head too.
  The real chains of 2.44-2.52 were 2-6 commits, 0-11 product files and at most a few hours.
- `release_gate2.sh` (real run): before the selection, an `--after` run checks the anchor; none -> it runs the FULL tier instead, says
  so and why, and keeps `gate_<b>_<sha>.anchor.json`; `gate2_verdict.py` writes the decision into the gate-2 summary.
  `--accept-no-anchor "<reason>"` (or `GATE2_ACCEPT_NO_ANCHOR`) keeps the targeted run with the reason on record. The dry run prints
  the decision. `gate_release.sh` passes `--after` through as before (the check lives in release_gate2.sh, so a direct call is covered).

### TR-04 remainder - the shipped bundle is the build of the gated source
Before: `release_check.py` checked that `www/arx-sw.js` carries `arx-shell-<version>` (GATE-HARDEN-2520) - a frontend fix committed
after the release rebuild still passed.
- `frontend/scripts/build-stamp.mjs` (new; last step of `npm run build:addon`) writes `smplwise_vms/www/build-stamp.json`: version,
  `inputs_sha256`, file count, the input list, the build commit. Inputs: `frontend/scripts/build-stamp-inputs.json` (`frontend/src`,
  `public`, the three HTML entry pages, both Vite configs, `package.json`, `package-lock.json`, `tsconfig.json`). Digest: the tracked
  and untracked-not-ignored files (`git ls-files --cached --others --exclude-standard`), sorted by UTF-8 bytes, each
  `<path> NUL <sha256 of the bytes with CRLF->LF> LF`, sha256 of it all. Tests and scripts are not inputs.
- `release_check.py` row "shipped UI bundle built from these sources (www/build-stamp.json)": recomputes the digest on the checkout
  (the gate runs release_check on its worktree, so the gate checks it) and compares version + digest; on a mismatch it names the input
  files changed since the build commit. Fails once the CHANGELOG head is the release AND the version is >= 2.54.0
  (`STAMP_REQUIRED_FROM`); before that a `[WARN]` row (this branch: 2.53.0 without a stamp -> WARN). The 2.54.0 release rebuild with
  this tree writes the first stamp.

## Files
- `scripts/gate/release_gate2.sh`, `scripts/gate/gate_release.sh`, `scripts/gate/gate_entry.py`, `scripts/gate/lint_backend.py`,
  `scripts/gate/gate2_verdict.py`, `scripts/gate/release_gate.py`, `scripts/gate/gate_baselines.json`, `scripts/gate/engine_sync.py`
  (INSTALL_MAP: `gate_baselines.json`, `selftest_gate_trust.py`), `scripts/gate/INSTALL_ON_RUNNER.md`
- `scripts/gate/selftest_gate_trust.py` (new), `scripts/gate/selftest_gate.py` (the "71 percent is green" case now states its 0.70
  threshold; new "89 percent is RED at 0.90")
- `scripts/release_check.py`; `frontend/scripts/build-stamp.mjs`, `build-stamp-inputs.json`, `build-stamp.test.mjs` (new);
  `frontend/package.json` (`build:addon` ends with the stamp; `build-stamp:test`)
- `smplwise_vms/backend/tests/test_release_build_stamp_2540.py` (new); `test_build_guards_2438.py` (it asserted that `build:addon`
  ENDS with the source-map move; now: the move comes after both Vite builds)

## Tests

RESULTS_PLACEHOLDER

## Install on the runner (the lead; NOT done by this row)

Install together with the first train that contains this row, on an idle runner (no gate, nightly or entry check: the installer
refuses otherwise). Once installed, `release_gate2.sh`'s strict engine check refuses a gate of a branch WITHOUT this engine (as for
every engine change since GATE-HARDEN-2520) unless `--engine-drift-ok "<reason>"`.

```
cd ~/smplwisebms && git fetch -q origin
git worktree add --detach ~/work/gt2540-install origin/<the train that contains GATE-TRUST-2540>
G=~/work/gt2540-install/scripts/gate
F=release_gate.py,release_gate2.sh,gate_release.sh,gate_entry.py,gate2_verdict.py,lint_backend.py,engine_sync.py,selftest_gate.py,gate_baselines.json,selftest_gate_trust.py
python3 $G/engine_sync.py install --src ~/work/gt2540-install --files $F                        # dry run: what goes where
python3 $G/engine_sync.py install --src ~/work/gt2540-install --files $F --apply --suffix .bak_2540
python3 ~/selftest_gate.py && python3 ~/gate2/selftest_gate_trust.py                             # both: SELFTEST PASSED
python3 ~/gate2/engine_sync.py check --repo ~/smplwisebms --ref origin/<train>                   # engine in sync
~/gate2/release_gate2.sh <train> --dry-run --after ~/smplwise-results/<a red report of that train>.json   # prints anchor + lint lines
git -C ~/smplwisebms worktree remove ~/work/gt2540-install
```

`release_gate.py` lands in `~/`, `~/gate2/` and `~/nightly-gate/` (the nightly runs the new count-drop rule warn-free from then on:
a nightly that loses more than 10 % of the backend / preview / dev tests of the last green full run is RED). Rollback: the
`.bak_2540` copies, or `engine_sync.py install` from the previous commit. The frontend part (build stamp) needs no install: it
takes effect at the next `npm run build:addon` (the 2.54.0 release rebuild).

## Open questions (recommendation first)
1. Pixel and fixture thresholds: a) 0.85 (recommended: small counts that follow the touched screens) b) 0.90 like the rest.
2. Anchor limits (20 commits / 36 h / 40 product files): a) keep (recommended: the real chains were at most 6 / a few hours / 11)
   b) tighter (10 / 24 h / 20) c) looser.
3. No anchor: a) run the FULL tier automatically, with the reason (recommended: same as the "nightly not healthy" rule, no idle wait)
   b) refuse the gate (exit 2) and wait for the lead.
4. The stronger TR-04 check from the review (compare `dist/assets` of the gate's own build with `www/assets` file by file):
   a) not now (recommended: Vite's hashed names depend on the toolchain - PC build vs runner build - and the stamp already proves the
   source) b) add it to the gate as a warning.
