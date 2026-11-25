# Deep review 2.52 - area TESTS-RELEASE

Reviewed head: `origin/release/2520-train` @ `eadaa25b8` (2026-11-25). Reviewer scope: (1) add-on packaging and the release path,
(2) the test system (gate scripts, ratchets, Playwright configuration, flaky-prone patterns, coverage gaps).

Method: every finding was read end to end in the tree at the reviewed head. Three checks went beyond reading:
- TR-01 was reproduced with a five-line pytest file in a scratch folder on the workstation (one pytest process, removed afterwards).
- TR-02, TR-03, TR-06 compare the repository with what is installed on the test runner. Those were read-only probes of the runner
  (file hashes, a diff of the installed engine, the JSON reports under `~/smplwise-results`, `gate_entry.py tagcheck`, `crontab -l`).
  Nothing was run, changed or stopped there.
- Git history was used to check the last five releases for TR-04.

NOT_RUN: no gate, no backend suite, no Playwright run, no image build. `scripts/wire_route_coverage.py --static` was tried on the
workstation and did not finish in two minutes; it was not repeated (see TR-08).

Severity counts: critical 0, high 3, medium 6, low 5.

## Summary

| id | severity | title | where |
|----|----------|-------|-------|
| TR-01 | high | Backend retry turns real failures into FLAKY (gate passes) when the retry runs nothing | `scripts/gate/release_gate.py:563`, `:610-621` |
| TR-02 | high | The engine installed on the runner lacks GATE-ONEPROJECT-2480: 50 spec files run on one project only in release gates; nothing detects install drift | `scripts/gate/release_gate.py:1180-1209`, `scripts/gate/release_gate2.sh:105-110` |
| TR-03 | high | The nightly safety net has been missing or red for a week; the tagging rule (3A) is not enforced by any script | `scripts/gate/gate_entry.py:132-139`, `scripts/gate/gate_release.sh:35-38` |
| TR-04 | medium | Nothing proves the shipped UI bundle (`smplwise_vms/www`) is the build of the gated source | `scripts/release_check.py:416-422` |
| TR-05 | medium | The blocking backend lint lane of a release gate lints `~/smplwisebms`, not the branch under test (known, still open) | `scripts/gate/gate_entry.py:156`, `scripts/gate/lint_backend.py:45-54` |
| TR-06 | medium | `~/known_issues.json`: an untracked allowlist without expiry hides every failure of `evidence-pwa-push.spec.ts` | `scripts/gate/release_gate.py:90`, `:472-492`, `:1343-1347` |
| TR-07 | medium | Count-drop baseline is a month old: a full run may lose 72 % of the backend tests and still pass | `scripts/gate/gate_baselines.json:8-12`, `scripts/gate/release_gate.py:2014-2040` |
| TR-08 | medium | Coverage gaps with a wide blast radius: bridge vs. real Home Assistant, `run.sh`, aarch64 image, no coverage measurement | `scripts/gate/addon_build_check.sh:237-238`, `smplwise_vms/backend/tests/bridge_loader.py` |
| TR-09 | medium | A targeted `--after` gate can pass a head on which the full suite never ran, with no healthy nightly behind it | `scripts/gate/gate_release.sh:35-38`, `scripts/gate/release_gate2.sh:59-64` |
| TR-10 | low | Playwright reuses whatever serves port 4173; eight unit specs escape the page-spec detector | `frontend/playwright.config.ts:8`, `:46-50`, `frontend/playwright.unit.config.ts:24` |
| TR-11 | low | Two quiet-hours tests fail for one minute a day (23:59 local) | `smplwise_vms/backend/tests/test_notify_whatsapp.py:356`, `:887` |
| TR-12 | low | Bridge copy swap can leave a `.smplwise-old` / `.smplwise-new` folder in `custom_components` (PLAUSIBLE) | `smplwise_vms/backend/smplwise/services/bridge_install.py:113-131` |
| TR-13 | low | Mirror check compares by size and mtime first (`filecmp.dircmp` shallow) (PLAUSIBLE) | `scripts/sync_integration.py:35`, `scripts/release_check.py:52` |
| TR-14 | low | The nightly cron runs at 02:00 UTC, not 02:00 Asia/Jerusalem | runner crontab; `scripts/gate/nightly_tests.sh:2` |

## Findings

### TR-01 (high) - backend retry turns real failures into FLAKY when the retry runs nothing

`scripts/gate/release_gate.py`, `parse_pytest` (line 563) and `backend_finish` (lines 610-621).

A backend test that failed in its shard is run again alone. The retry's exit code and timeout flag are thrown away
(`run(...)` on line 614, result unused); the verdict is "every id that has no `FAILED`/`ERROR` line in the retry log passed alone"
(lines 615-621). An empty or broken retry log therefore means "all passed".

Two confirmed ways to get there:

1. A test id with whitespace. `parse_pytest` takes the id with `(\S+)`, so `tests/test_x.py::test_gated[GET /api/v1/x]` becomes
   `tests/test_x.py::test_gated[GET`. pytest answers the retry with `ERROR: not found: ...` (no space after `ERROR`, so the line
   does not match), "no tests ran", exit code 4 - and it runs NONE of the other ids passed in the same command either.
   Result: every backend failure of that gate is recorded FLAKY "failed in the shard run, passed alone" and counts as passed.
   Reproduced on the workstation: a parametrized case with id `GET /a` plus an unrelated `assert False` test; the shard-style run
   reports 2 failed, the engine-style retry prints "no tests ran" and no `FAILED` line.
   Ids with spaces exist today: `ids=[f"{m} {p}" ...]` in `tests/test_installation_capabilities.py` (the capability gating of routes,
   an always-run core file) and `tests/test_nvr_less.py`; Hebrew sentences and passphrases as parameters in at least five more files.
2. The retry is killed by its 900 s limit, or crashes at collection. With `-q` the `FAILED` lines are printed only in the final
   summary, so a killed retry leaves none: all FLAKY.

Failure scenario: a change breaks one capability-gated route and, separately, a migration test. Both fail in their shards. The retry
gets the truncated id, runs nothing, both become FLAKY, `compute_verdict` sees zero failures, the gate is green.

The Playwright side has the right guards (`settle`, lines 1380-1386: no result / timeout / no report = FAIL). The backend side has none.
The installed runner copies carry the same code.

Fix: take the id up to `" - "` (or read failures from the junit XML the v2 shards already write); after the retry require a pytest
summary line and `rc in (0, 1)`, and count as passed only ids the retry reports as passed (`-rA` or junit), never "absent from the
failure list". Add a selftest with a spaced id.

### TR-02 (high) - the runner's engine lacks GATE-ONEPROJECT-2480; 50 spec files run on one project in release gates

Repository: `scripts/gate/release_gate.py:1180-1209` (commit `c4ff2bdc8`, 2026-11-23, part of v2.48.0's tree).
Runner (probed 2026-11-25): `~/release_gate.py` and `~/gate2/release_gate.py` are identical to each other and differ from the
repository file by exactly that commit (`header_comments` missing; `one = re.search(r"one project", header, ...)` scans code too).
`~/nightly-gate/release_gate.py` IS the repository version.

Effect: `classify()` on the release-gate engine treats a spec whose first 70 lines contain the words "one project" anywhere - for
example in a `test.skip(..., 'one project runs the whole sweep')` message - as a one-project spec and runs it on the first
`--project=` of its header, else on desktop only. At the reviewed head that is 50 files more than the fixed classifier limits
(counted with both versions of the rule), among them `evidence-mobile.spec.ts`, `evidence-mobile-touch.spec.ts`,
`evidence-mobile-layers.spec.ts`, `layout-a11y-295.spec.ts`, `layout-tickets-board.spec.ts`, `layout-setup-wizard.spec.ts`,
`evidence-wiskey-people-native.spec.ts`. Their phone and tablet tests do not run in a release gate; on desktop the phone-only ones
skip themselves, and a skip is not a failure.

So the 2.48.0 - 2.51.0 release gates ran without that coverage while the nightly (fixed engine) runs it. The nightly reports on main
of 20.11 (11 failures) and 25.11 (4 failures) list mostly `[mobile]` / `[tablet]` rows among their failures (TR-03).

Root cause is the install model: three hand-copied engine copies (`~`, `~/gate2`, `~/nightly-gate`), `release_gate2.sh:105-110`
copies `~` over `~/gate2` at every run without comparing either to the branch under test, and no report records the engine's hash.

Fix, in order: (a) install the current engine before the 2.52.0 gate (README_GATE_FAST.md install steps, quiet window);
(b) `release_gate2.sh` prints and stores the sha256 of the engine it runs and of `origin/main:scripts/gate/release_gate.py`, and
fails with a clear message (override flag for a deliberate pin) when they differ; (c) in every report, list tests that were
skipped on every project they ran on - today nobody sees a test that ran nowhere (the 2.50.0 full gate had 9,557 skipped rows in
the preview category).

### TR-03 (high) - the nightly safety net has been missing or red for a week; the tagging rule is not enforced

Facts from the runner's `~/smplwise-results` (read-only, 2026-11-25):

| night | result |
|-------|--------|
| 18.11 | pass (the last green full nightly on main) |
| 20.11 | fail, 11 failures |
| 21.11, 22.11 | `nightly-NODISK` (did not run) |
| 23.11 | `nightly-SKIPPED` |
| 24.11 | got the lock after 27 minutes, no `gate_main_*.json` report |
| 25.11 | fail, 4 failures on v2.50.0's sha: `evidence-fleet-report.spec.ts:39 [mobile]`, `evidence-tabs-styles.spec.ts:120 [mobile]` and `[tablet]` (all three a 60 s test timeout, failed again alone), `unit-home-clock.spec.ts:74 [desktop]` "it crosses midnight: the date and the Hebrew date roll over" (the Hebrew date did not change; failed again alone) |

`python3 ~/gate2/gate_entry.py tagcheck` answers today `{"ok": false, "why": "no full green nightly on main within 7 days"}`.
v2.51.0 was tagged this morning. Rule 3A ("tag only with a full green nightly on main at most 7 days old", `gate_release.sh:12`) is a
manual command: `gate_entry.py:132-139` is called by no script, `release_check.py` does not know it, the `--tag` hint of
`release_check.py:488-489` prints the tag commands regardless.

Why it matters: the change-based gate and the `--after` re-run both name the nightly as the coverage of everything they did not
run (`gate2_verdict.py:135-136`). With no green nightly since 18.11, the releases since then (2.47.0 - 2.51.0) have that coverage only
from their own gate runs, and the four failures of 25.11 sit on released code un-triaged. `unit-home-clock` did not fail the 2.50.0 full
gate (evening run) and failed twice in the night run on the same product code: either a time-of-day dependency or a real defect in the
midnight roll-over; it needs an owner.

Fix: (a) triage the four failures before the 2.52.0 gate (fix, or quarantine with ticket and expiry); (b) make `tagcheck` part of
the release step that prints the tag commands - `release_check.py --tag` refuses without it, with an explicit, logged override;
(c) a nightly that could not run (NODISK / SKIPPED / no report) is a red status on the dashboard, and two in a row block the next
select-mode gate (it already falls back to FULL after 36 h, which is the right behaviour - keep it); (d) fix the disk shortage cause
(the twice-weekly prune does not keep up).

### TR-04 (medium) - nothing proves the shipped UI bundle is the build of the gated source

The gate builds `frontend/dist` and tests that. The add-on ships `smplwise_vms/www` and `www-public`, which are committed build
output produced by hand (`npm run build:addon`) in a "release: X - rebuilt UI at <sha>" commit. `release_check.py:416-422` checks only
that `index.html` and one `assets/index-*.js` exist.

Evidence at the reviewed head: `config.yaml`, the Dockerfile label and `__version__` say 2.52.0, `smplwise_vms/www/arx-sw.js` still
carries the cache name `arx-shell-2.51.0`, and "built UI present in the add-on (www)" is `ok`. A release cut with a forgotten or
partial rebuild, or with a frontend fix committed after the rebuild, passes every check and ships the old UI to every installation
(and, with the old service-worker cache name, browsers keep the old shell).

History check: for v2.47.0 - v2.51.0 `git diff <sha named in the rebuild commit> <tag> -- frontend/src frontend/public
frontend/index.html frontend/vite.config.ts frontend/package-lock.json` is empty, so the last five releases were correct. It is
discipline, not a guard.

Fix: `build:addon` writes `www/build-stamp.json` with the git tree hash of `frontend/` (`git rev-parse HEAD:frontend`) and the
version; `release_check.py` compares it with the checkout's tree hash and checks `arx-shell-<config version>` in `www/arx-sw.js`.
Better still, the gate itself compares the file list and hashes of `dist/assets` with `www/assets` on a release head (Vite's hashed
names make that an exact check on the same toolchain).

### TR-05 (medium) - the blocking backend lint lane lints the wrong tree (known, still open)

`gate_release.sh:40` runs `gate_entry.py decide`; `gate_entry.py:156` calls `lb.run(lb.default_root())`; `lint_backend.py:45-54`
resolves to `GATE_LINT_ROOT`, else the checkout the script sits in, else `~/smplwisebms`. On the runner the script sits in `~/gate2`
(not a checkout) and `gate_release.sh` does not set `GATE_LINT_ROOT`, so the lane lints whatever is checked out in `~/smplwisebms`.
`branch_check.sh:213` does pass the worktree; the release gate does not.

Scenario: a train branch gains an undefined name (ruff F821) in a rarely imported module. The entry check of some other branch is
green, the release gate lints `~/smplwisebms`, reports 0 findings, the "blocking" lane passes. The reverse also holds: an unrelated
state of `~/smplwisebms` can stop a clean release gate.

Already written down as a known weakness in `docs/changes/CR-PYFLAKES-ENFORCE-2442.md:141` and `CR-W3B-BE-COMBINED-2443.md:84`;
unfixed at this head.

Fix: move the lane behind the worktree checkout in `release_gate2.sh` (after line 138) and call
`GATE_LINT_ROOT="$WT" lint_backend.py --gate` there; drop it from `decide`.

### TR-06 (medium) - `~/known_issues.json` hides one whole spec file, with no expiry and outside git

`release_gate.py:90` reads `~/known_issues.json`; a matching failure is `KNOWN`, not `FAIL` (`:1343-1347` for Playwright,
`:603-606` for the backend), and tests of the same file that did not run because of it are silently skipped (`:1351-1353`).
The file is not tracked, has no expiry, ticket or owner, and is validated by nothing.

On the runner it holds one entry, dated 2 October: `kind=playwright, file=evidence-pwa-push.spec.ts`, no line, no project, no title -
reason "intermittent timeout ...; known". Every failure of every test in that file on every project has been unable to fail a gate or
a nightly for eight weeks. That spec is the evidence of the PWA push / service-worker update path.

The managed quarantine (`gate2_quarantine.json`: ticket, owner, 7-day expiry, validated, tracked) exists precisely to replace this.

Fix: the engine ignores `known_issues.json` entries that have no `expires` within 7 days (and says so in the report); move the one
entry into the quarantine with a ticket or delete it and see whether the spec is still flaky after FLAKY-SWEEP-2480.

### TR-07 (medium) - the count-drop baseline is a month old

`scripts/gate/gate_baselines.json:8-12` (source note dated 2026-10-27): preview 14,971, backend 17,611, pixel 175, dev 935, fixture 15.
The 2.50.0 full gate passed 23,814 preview and 44,901 backend tests, 390 pixel, 28 fixture. `check_baselines`
(`release_gate.py:2014-2040`) fails a category below 70 % of the baseline, i.e. below 12,328 backend tests: a full run can lose
72 % of the backend suite (a collection mistake that drops most files, a glob change, a shard list bug that still runs at least one
test per shard) and pass. In select mode the ratio is never checked (line 2026), by design.

The file's own comment says "refresh after each release"; that step has no owner in the release flow.

Fix: compare with the newest green FULL report of the same branch family in the results directory (the engine already reads those
for costs) and keep the tracked file only as a floor; or make the refresh a line of the release checklist that `release_check.py`
verifies (baseline `source` names the previous version).

### TR-08 (medium) - coverage gaps with a wide blast radius

Ranked by what breaks for an owner if the untested part is wrong:

1. **The bridge integration against real Home Assistant.** `custom_components/smplwise_bridge` is 7,978 lines that run inside Home
   Assistant Core. Every test loads it through `tests/bridge_loader.py` / `tests/keyrot_harness.py` over hand-written fakes
   (`fake_ha_core.py`, `fake_ha_config.py`). No test imports the real `homeassistant` package, there is no hassfest run, and
   the image build check does not touch it. A Home Assistant release that changes a helper the bridge uses is found in the lab, after
   publishing (the 2026.11 compatibility fix was such a case). Suggested: one small job on the runner that installs the current
   `homeassistant` wheel in a throw-away venv and runs hassfest plus an import/`async_setup_entry` smoke of the mirror copy.
2. **`run.sh` is never executed.** `addon_build_check.sh:237-238` starts the image with `--entrypoint python3` ("s6 bypassed"); the
   only tests of `run.sh` match strings in it (`test_frigate_addon_option.py:17-18`, `test_crashguard_2332.py:239`). A bashio typo, a
   wrong shebang or a missing executable bit passes the gate and gives an add-on that does not start on any installation. Suggested:
   one more step in the build check that runs the image with its real entrypoint and a minimal `/data/options.json`, and waits for
   `/healthz` (the Supervisor token is not needed for that).
3. **aarch64.** `config.yaml` offers `aarch64`; the gate builds amd64 only and checks aarch64 by wheel availability
   (`addon_build_check.sh:20`). The `apk add` line and the native wheels are never exercised on arm. Accept and document, or build
   under qemu in the nightly.
4. **No coverage measurement.** Neither `pytest-cov` nor a JS coverage tool is used anywhere; "which module has no test" cannot be
   answered from a gate report. A name-based scan (module name never mentioned in any backend test file) lists 143 of 1,173 backend
   modules, but most of the large ones are reached through their HTTP paths, so that number is an upper bound and not a finding.
   `scripts/wire_route_coverage.py` gives the real per-route answer and needs one recorded backend run (`SW_WIRE_COVERAGE_DIR`);
   it was NOT_RUN in this review. Suggested: record it in the nightly and publish the uncovered-route list with the report.
5. **Live-only specs.** 74 `test.skip(process.env.SW_LIVE !== '1', ...)` guards: those tests run only against the lab by hand. They
   are counted as skipped rows in every gate; a list of them with the date each last ran would show which evidence is stale.
6. **The gate tooling's own tests.** `selftest_gate.py`, `selftest_gate_fast.py`, `selftest_entry_check.py`, `selftest_fe_static.py`
   are not run by any gate or nightly (only by hand after an install). TR-01 and TR-02 are the kind of defect they exist for.

### TR-09 (medium) - a targeted `--after` gate can pass a head on which the full suite never ran

`gate_release.sh:35-38` sends `--after` straight to `release_gate2.sh` with no nightly decision; `release_gate2.sh:59-64` takes the
red report's sha as the base and selects the failed files plus what the diff since then touches plus the core. There is no limit on
how large that diff may be, how many `--after` runs may chain, or how old the red report is, and the red report's own non-failing
rows are trusted although they were measured on a different sha.

2.51.0 as the example: full run red at `df3ee6d12` (3 preview failures), `--after` run green at `d886d7929` with 43 of 1,156 preview
spec files, 2 of 89 dev, 0 of 56 pixel, 143 of 1,071 backend files, and no healthy nightly behind it (TR-03). In that case the
commits in between touched no product source, so the result is sound - but nothing checks that.

Fix: `release_gate2.sh --after` prints and stores the diff stat between the two shas and refuses (asks for `--full`) when product
source (`frontend/src`, `smplwise_vms/backend/smplwise`, `custom_components`) changed by more than a small, stated bound, or when
the nightly is not healthy and product source changed at all.

### TR-10 (low) - Playwright reuses whatever serves port 4173; eight unit specs escape the page-spec detector

- `frontend/playwright.config.ts:8` defaults to `http://127.0.0.1:4173/` and `:46-50` sets `reuseExistingServer: true`. A run without
  `SW_BASE_URL` on a machine where another worktree's preview (or an orphan one - the runner had those on 22-23.11) holds 4173
  tests that other build and reports its result for this branch. The gate engine is safe (own free port, `--strictPort`); agent runs
  and local runs are not. Fix: `reuseExistingServer: !!process.env.SW_REUSE_SERVER`, or have the config fail when the page served
  does not carry the checkout's build stamp.
- `frontend/playwright.unit.config.ts:24`: `PAGE_SPEC` recognises navigation only when the address starts with a quote and `/`.
  Eight `unit-*` specs navigate another way and land in the node-only run: `unit-mfa-passkeys-2490` (confirmed: three
  `ERR_CONNECTION_REFUSED` on `localhost:4173`, RELEASE-2520-TRAIN.md line 120; with a server on 4173 it would test that server
  instead), and candidates `unit-arx-local-login`, `unit-arx-pending-tokens`, `unit-brand-login`, `unit-local-user-create-2438`,
  `unit-service-identity`, `unit-unit-config-pages-2440`, `unit-walk-ui` (they call `.goto(` and do not match; not run here).
  Fix: detect by `page.goto(` / `gotoApp(` at all, or let a spec declare itself with a header marker.

### TR-11 (low) - two quiet-hours tests fail for one minute a day

`tests/test_notify_whatsapp.py:356` and `:887` set the window `00:00`-`23:59` and use the real clock (the file does not use the
`daytime_clock` fixture, `conftest.py:112-133`). `notify_settings.in_quiet_hours` (line 327) is `start <= hm < end`, so at 23:59
local the notification is not held and both tests fail. A gate or nightly shard that reaches the file in that minute gets a red (or,
with TR-01, a FLAKY). Fix: use `daytime_clock`, as `test_push.py:27` does.

### TR-12 (low, PLAUSIBLE) - the bridge copy swap can leave a stray folder in `custom_components`

`bridge_install.py:113-131`: copy to `smplwise_bridge.smplwise-new`, rename the old tree to `smplwise_bridge.smplwise-old`, rename
new into place, `rmtree(old, ignore_errors=True)`. A stop between the steps, or a failed removal, leaves a sibling folder that holds
a `manifest.json` with `domain: smplwise_bridge`. `.smplwise-new` is cleaned at the next copy; `.smplwise-old` is cleaned only when
another copy is needed, so it can stay for a whole version. Home Assistant lists every folder under `custom_components` and keys
custom integrations by the manifest's domain; I did not verify on a real Core which folder wins or what it logs, hence PLAUSIBLE.
Fix: remove both leftover names at the start of every `install()` run, whether or not a copy is needed, and stage the new tree
outside `custom_components` (for example `<config>/.smplwise-staging/`) on the same filesystem.

### TR-13 (low, PLAUSIBLE) - the mirror checks compare by size and mtime first

`scripts/sync_integration.py:35` and `scripts/release_check.py:52` use `filecmp.dircmp`, whose `diff_files` is a shallow comparison:
two files with the same size and the same mtime are "identical" without being read. A same-length edit (a version string
`0.10.8` -> `0.10.9`) checked out in the same timestamp tick would be reported as in sync. Unlikely on the runner's filesystem, but
this check is the only guard that the image ships the bridge that was tested. Fix: compare with
`wiskey_distribution_digest.digest()` of both trees (already in the code base), or `filecmp.cmp(..., shallow=False)` per file.

### TR-14 (low) - the nightly cron runs at 02:00 UTC

The runner's crontab sets `CRON_TZ=Asia/Jerusalem` and `0 2 * * *`; the cron log and the reports show starts at `02:00:0x+00:00`
(04:00 local in winter) and ends around 05:16 UTC = 07:16 local. `CRON_TZ` is not honoured by that cron. The run holds the tests
lock into the morning, when gates and agents start (the 24.11 nightly itself waited 27 minutes for the lock). Fix: schedule in UTC
explicitly (`0 0 * * *` in winter) or wrap with a `TZ=` date test as the line already does for its date guards.

## Improvements (short)

- One installer for the gate tooling (`scripts/gate/install_runner.sh`: back up, copy to the three locations, run the selftests,
  write a manifest of hashes). Replaces the hand `scp` list in README_GATE_FAST.md and makes TR-02's check trivial.
- An explicit header marker for gate classification (`// @gate projects=desktop,mobile workers=1 server=dev`) instead of reading
  free text: today 384 spec files have their gate projects set by a usage example in a comment and 37 by the words "one project".
- `config.yaml:66-74`: the six deprecated secret options ("2.6.3 only ... removed in the next version") are still declared 46
  versions later; a value typed there sits in plain text in the Supervisor's options. Remove them after confirming no installation
  still has one filled (DOCS.md describes a warning for that case).
- pytest: add `--strict-markers` and `xfail_strict = true` to `pyproject.toml`; cheap protection against a mistyped `timing_lane`
  mark (which would silently put a timing test back into the gate, or a gate test into the lane).
- 1,236 `waitForTimeout(` calls in 454 spec files. `lint_spec_waits.py` covers new specs only; a ratchet per file (count may only
  go down), like the design ratchet, would stop the growth.
- `scripts/check-phone-skip-list.mjs` (25 files skipped on phone, 20 also on tablet) is only an npm script; run it in the
  `fe_static` phase so a renamed spec cannot leave a dead entry.
- `sync_integration.py` and `release_check.dir_identical` are two implementations of the same comparison; keep one.
- The repository root `CHANGELOG.md` stops at 0.1.0-dev.1 while the real one is `smplwise_vms/CHANGELOG.md`; delete or point to it.

## Checked and fine

- `smplwise_vms/config.yaml`, `build.yaml`, `Dockerfile`, `.dockerignore`, `run.sh`, `repository.yaml`: versions agree (2.52.0 in
  config, label, `__version__`, API inventory); the CHANGELOG head is marked DRAFT, so `release_check` correctly refuses the train
  head as a release until the draft mark is removed. Base images by tag, same tag for both arches, Dockerfile default = build.yaml
  amd64. Ports unmapped by default; `backup_exclude` for the WisKey lineage present.
- Python pins: `requirements.txt` + `constraints.txt` (49 exact pins), `lock_python.py` checks wired into `addon_build_check.sh`;
  docker is now installed on the runner and `addon_build` reported PASS in the 2.50.0 and 2.51.0 gates.
- Bridge mirror: `custom_components/smplwise_bridge` and `smplwise_vms/integration/smplwise_bridge` are identical at this head
  (0.10.9 in both manifests); `bridge_install.install` verifies the copy by digest, ignores `__pycache__` and its own marker, never
  writes under a manual owner profile, and a start-up failure cannot stop the add-on (`run_startup`).
- `crashguard.py`: stop signals are not treated as crashes, backoff is bounded, safe mode is time-windowed; no finding.
- Release path for v2.47.0 - v2.51.0: each tag is the gated sha plus a docs-only commit; the UI rebuild precedes the gate and no
  frontend source changed after it.
- `release_gate2.sh` / `gate_release.sh`: locks, the stale-report guard for a repeated sha, the engine-timeout path (a report with a
  hard failure is still written), the all-quarantined re-run (a missing second report cannot turn into a pass), the fallback to FULL
  when the nightly is stale, red or missing, or when `gate_entry.py` fails.
- `gate2_verdict.py` / `gate_quarantine` rules: expiry at most 7 days, expired or invalid entries explain nothing; the list is empty.
- Playwright `settle()`: zero tests, load errors, timeouts, odd exit codes and "did not run" rows are failures; the retry is keyed
  by file, line and title.
- `helpers/capture-guard.ts`: retries only the one Chromium refusal, never an assertion, does not wrap `toHaveScreenshot`.
- Ratchets: design (in `release_check`), wire, request-strict, error-contract, backend i18n and the English i18n ratchet are each
  enforced by a backend test or a unit spec that the gate runs; `fe_static` (entry budget, unused exports, ESLint) is blocking.
- Time zone handling of the test harness: both Playwright configs pin `TZ` and `timezoneId` to Asia/Jerusalem; `daytime_clock`
  covers the push and notification suites that use it.
- No lab, Home Assistant, NVR or go2rtc access; no secrets, addresses or serials in this document.
