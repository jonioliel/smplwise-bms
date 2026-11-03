# WISKEY-S6-RELEASE-PREP — WisKey release 2.37.1: merge of 2.37.0 final, version, changelog, receipts

Branch `pilot/WISKEY-S5-PREMERGE` (worktree of S5, continued). Release order 2.37.0 -> WisKey -> 2.38.0, so the WisKey release is
**2.37.1**. Nothing here is merged to `main`, tagged, built into the UI, installed or switched on; the UI build, the release gate and the
tag are the lead's. No device, Home Assistant or WisKey contact.

## Commits

| SHA | What |
|---|---|
| `5f13d066e` | Merge `origin/release/2370-train` @ `88dc0b287` ("release: 2.37.0 - rebuilt UI after gate fixes", = tag `v2.37.0`) |
| `48295f83c` | release: 2.37.1 - version, changelog and API inventory |
| `96b43e493` | test(wiskey): the three stale pins the first Linux full-suite run found (below) |
| (this commit) | this document and the receipts under `docs/changes/receipts/WISKEY-S6-RELEASE-PREP/` |

## Merge of 2.37.0 final

The poll waited for the tip subject "release: 2.37.0 - rebuilt UI after gate fixes" (`88dc0b287`, later tagged `v2.37.0`).
One textual conflict: `contracts/API_INVENTORY.md` (ours kept, then regenerated). `smplwise_vms/www` and `www-public` auto-merged and are
byte-identical to `v2.37.0` (`git diff v2.37.0 HEAD -- smplwise_vms/www smplwise_vms/www-public` is empty). `smplwise_vms/CHANGELOG.md`
auto-merged: the WisKey section sits above 2.37.0, and from `## 2.37.0` down the file is identical to the train's.

Migrations: `origin/main`, `origin/release/2370-train` and the four `fix/GATE2370-*` branches all end at `0193_calendar_feed_review.sql`, so
no renumbering was needed; WisKey stays `0194`-`0196` (release_check: "migrations contiguous: 196 files, last
0196_wiskey_relay_map_exports.sql").

## Version 2.37.1

`config.yaml`, the Dockerfile `io.hass.version` label, `smplwise/__init__.py`, the CHANGELOG head and the API inventory read 2.37.1. The
WisKey DRAFT section became `## 2.37.1 (pilot) - WisKey alignment: ...` (English + Hebrew). Its "After installing" line names the three
migrations (0194 installed-client tables, 0195 relay map station revisions, 0196 sealed relay map export log), says that going back to
2.37.0 needs the pre-update database backup, states policy B (the switch stays OFF in this release, a request to turn it on is refused)
and asks for one page reload (the UI is rebuilt with the add-on). A policy-B line was added at the top of "Known limits".
API inventory: 1716 -> 1717 routes (the train's `POST /api/v1/nvr/stream-batches/{batch_id}/verify`).

## Policy B invariant (re-verified on `48295f83c`)

- `wiskey.auto_install` defaults OFF: `wiskey_auto_install.switch_on` reads `get_setting(...) or "off"` and only `"on"` is on.
- No migration names the key (`grep -rl auto_install smplwise/migrations/` is empty); no production `set_setting` names it except
  `services/wiskey_switches.apply`, which writes only keys from its closed list after `check()`.
- ON is refused: `wiskey_auto_install.OWNER_ON_PERMITTED = False`; `check()` raises `SwitchRefused("auto_install_not_permitted", 409)`, and
  the router audits the refusal (`settings.changed`, decision `denied`).
- Pinned by tests that passed here: `test_wiskey_rc7_adopt_2331` (static single writer, OFF on a fresh database),
  `test_wiskey_m12_policy_b_owner_switch` (34 passed), `test_wiskey_m12_policy_b_native_gate` (31 passed) and
  `test_wiskey_s5_migration_upgrade` (no migration seeds the switch, upgraded database reads OFF, constant False).

## Tests

| Run | Where | HEAD | Command | Exit | Result |
|---|---|---|---|---|---|
| release check | workstation | `48295f83c` | `python scripts/release_check.py` | 0 | every line ok except `[FAIL] git tag for this version: v2.37.1 not yet` (expected); "RESULT: ready for the owner's approval" |
| API inventory | workstation | before `48295f83c` | `python scripts/api_inventory.py` | 0 | 1717 routes, committed |
| tsc | workstation | `48295f83c` | `npx tsc --noEmit -p tsconfig.json` (frontend, Node 24.21.0) | 0 | no errors (500 s) |
| frontend unit | workstation | `48295f83c` | `npx playwright test -c playwright.unit.config.ts --workers=1 --reporter=line` + the 16 WisKey / bridge / service-identity specs of S5 | 0 | **186 passed** (1.3 min) |
| backend run 1 | workstation (Windows, single process) | `48295f83c` | `pytest -q -p no:cacheprovider -rfEs` test_migrations, test_migrations_263_upgrade, test_wiskey_s5_migration_upgrade, test_wiskey_m12_policy_b_owner_switch, test_wiskey_m12_policy_b_native_gate, test_wiskey_rc7_adopt_2331, test_smallfixa_wiskey_switches_295 | 0 | **130 passed, 5 skipped, 0 failed** (1249 s), receipt `receipts/WISKEY-S6-RELEASE-PREP/run1-policyb-migrations.junit.xml` |
| backend run 2 | workstation (Windows, single process) | `48295f83c` | `pytest -q -p no:cacheprovider -rfEs` the other 40 `tests/test_wiskey*.py` | 0 | **1078 passed, 18 skipped, 0 failed** (1979 s), receipt `receipts/WISKEY-S6-RELEASE-PREP/run2-wiskey-rest.junit.xml` |
| backend full suite | runner (Linux) | `48295f83c` | `run_smart.py backend pilot/WISKEY-S5-PREMERGE --machine runner` (2 shards, every `tests/test_*.py`) | 0 (run_smart does not propagate shard failures) | **19542 passed, 3 failed, 24 skipped, 3 xfailed** (shard 1: 9223 / 1 / 11; shard 2: 10319 / 2 / 13 / 3 xfailed; 2:23 h), receipt `receipts/WISKEY-S6-RELEASE-PREP/runner-full-suite-48295f83c.txt` - the 3 failures are fixed in `96b43e493`, see below |
| fixes, local | workstation | `96b43e493` | `pytest -q -p no:cacheprovider -rfEs tests/test_no_ip_literals.py tests/test_t06_admission_295.py tests/test_wkr5_295.py` | 0 | **95 passed, 3 xfailed, 0 failed** (372 s), receipt `run3-runner-fixes.junit.xml` |
| fixes + POSIX skips | runner (Linux) | `96b43e493` | `run_smart.py backend pilot/WISKEY-S5-PREMERGE --machine runner -rfEs` the 3 fixed files + the 9 files with Windows-only skips | 0 | **345 passed, 4 skipped, 3 xfailed, 0 failed** (128 s), receipt `runner-targeted-96b43e493.txt`; `gate_status.json` read first: state pass / phase done |

Per file (run 1, passed / skipped / failed): test_migrations 4/0/0, test_migrations_263_upgrade 2/0/0, test_wiskey_s5_migration_upgrade 4/0/0,
test_wiskey_m12_policy_b_owner_switch 34/0/0, test_wiskey_m12_policy_b_native_gate 31/0/0, test_wiskey_rc7_adopt_2331 27/5/0,
test_smallfixa_wiskey_switches_295 28/0/0.

Windows skips (23, NOT_RUN on the workstation, not passes): symlink fixtures (POSIX / privilege), the rc.7 row 5b and S3 generation fence
(fcntl), flock (fcntl), POSIX mode bits, `jsonschema` not installed, and the two `test_wiskey_channels` "channel holds commands newer than
the pinned catalog" skips. On Linux (targeted run) the symlink, fcntl / flock, generation-fence and mode-bit cases RAN and passed;
still skipped there: `jsonschema` not installed on the runner either (1, NOT_RUN), the two channel / pinned-catalog skips (by design), and
`test_wiskey_m12_s3_maintenance.py:629` (the Windows-only "no fcntl" case, the mirror of the Linux one).

## The three runner failures (full suite on `48295f83c`) and their fix (`96b43e493`)

None is a product change; all three are pins that the RC7 / S3 / S4 / S5 slices never ran (their runs were WisKey-file subsets).

1. `test_t06_admission_295::test_the_only_modules_that_reach_a_signing_call_are_the_known_ones` - `wiskey_relay_map_native.py` (RC7 row 6,
   M12 S3) calls the signing seam (`port.call`) but was never added to the pinned caller set. **An admission decision, made here on
   purpose and flagged for the lead:** the module is added, a new test pins what it sends (only `installation/relay_map_*` and
   `installation/readiness_v1`; no door / people / program write), and `T06-ADMISSION-MAPPING-295.md` gets a "WISKEY-S6-RELEASE-PREP
   addendum". Its production entry `publish_selected` and the dormant `maintain` return before any I/O while `wiskey.auto_install` is off,
   which policy B keeps in 2.37.1.
2. `test_wkr5_295::test_catalog_counts_names_not_lines_and_skips_provenance` - `wiskey_direct_catalog.load()` declares the six relay map
   commands (RC7 row 4 + S3's prepare v3) on top of the two emergency ones: 302 = 294 + 2 + 6, not 296. The pin now counts them.
3. `test_no_ip_literals::test_no_unlisted_private_ip_literals` - the committed JUnit receipts of WISKEY-S4-OBSERVER, WISKEY-S5-PREMERGE and
   WISKEY-RC4-2310 repeat the parametrized test ids of the allowlisted `test_bridge_cast_policy.py` (its two address-class fixtures;
   checked without printing them: they are that test's literals and not a lab address). Two receipt globs join
   `ip_literal_allowlist.txt` with that reason. The S6 receipts contain no address.

The unit run rewrites four committed screenshots (`docs/evidence/USR2/service-identity-*.png`); they were restored with `git checkout --`,
not committed.

## For the lead

- `frontend/src` differs from `v2.37.0` in 8 files (+451 / -16: the WisKey relay map screen and API, the switches API / strings, the
  WisKey security tab, diagnostics and setup), while the committed `smplwise_vms/www` is still exactly the 2.37.0 build. **A UI rebuild
  (`npm run build:addon`) is required for 2.37.1.**
- Then the release gate and the `v2.37.1` tag.

## NOT_RUN

- The full backend suite was not re-run after `96b43e493` (only the three fixed files + the Windows-skip files, above, on
  both machines); the lead's release gate covers it.
- `test_wiskey_r2_align_2272_contracts.py:120` (`jsonschema` missing on both machines).
- The UI build, Vite build / preview, Playwright browser suites and pixel baselines (the lead's, with the gate).
- The release gate for 2.37.1; the `v2.37.1` tag (release_check's only failing line).
- Nothing installed, no Home Assistant restart, no device, no WisKey contact.
