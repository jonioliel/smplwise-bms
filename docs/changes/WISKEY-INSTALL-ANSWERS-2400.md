# WISKEY-INSTALL-ANSWERS-2400 - the owner's answers of 04.11 for WisKey installs through Arx, and the installer tools in Settings

Branch `pilot/WISKEY-INSTALL-ANSWERS-2400` from `origin/release/2400-train` (`8e3ac8398`), target 2.40.0. Not merged, not tagged, no
version bump, no migration. No lab, device, Home Assistant or Supervisor contact: every backend test uses the fake Supervisor / Core and
the synthetic config tree of `tests/test_wiskey_managed_install_2382.py`.

Builds on `docs/changes/WISKEY-MANAGED-INSTALL-2382.md` (the owner-started managed path) and `docs/changes/WISKEY-INSTALLER-NATIVE-2400.md`
(the installer tools). Owner answers: `private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md`, section "04.11 בוקר - סבב 18" (the
round-18 numbers are used below; the round-17 number in brackets). Q8's number came later on 04.11 through the lead: **5**.

## Per answer

| Round 18 | Answer | Outcome on this branch |
|---|---|---|
| Q2 | ג - the installer tools in the Settings column under the group "בקרת כניסה" (not search-only, not a top row) | new column group "בקרת כניסה" (see "Q2" below) |
| Q3 (1) | ב - also install / upgrade automatically when the add-on starts (against the recommendation) | start-up reconcile behind a new owner switch, default OFF (see "Q3" below) |
| Q4 (2) | א - the full HA backup at most 24 h old | already 24 h (`BACKUP_MAX_AGE_S`); now pinned by a boundary test and shown in the view (`backup_max_age_h`) |
| Q5 (3) | א - the owner takes the backup, Arx does not create it | unchanged: no Supervisor call creates, restores or downloads a backup (allow-list test); comments and DOCS say so |
| Q6 (4) | ב - do not turn the accepted-risk switch on | unchanged (off by default; no code path writes it ON). In addition it NEVER covers a start-up run |
| Q7 (5) | א - the three phrases stay | unchanged and pinned by a test; the start-up switch adds no fourth phrase (it asks the managed switch's phrase again) |
| Q8 (6) | ב - another number of recent upgrades; number given later: 5 | installation setting `wiskey.managed.keep_runs`, default **5**, range 1-10, system administrator, audited |

## Q3 - start-up install / upgrade (owner decision of 04.11)

**Owner decision 04.11 (round 18 Q3 = ב, against the recommendation):** a managed install / upgrade may also start by itself when the
add-on starts. Recorded here as the owner's decision; the recommendation was "manual path only".

### What policy B is, and why it was NOT opened

The unattended path of WisKey M12 policy B (`services/wiskey_auto_install.py`) is a different thing from the managed path:

- `wiskey.auto_install` (owner switch, default off) gates every EFFECT of WisKey's own automatic installation: staging the pinned bundle
  into the config directory by a plain copy (`stage_native_bundle`), the bridge's discovery flag, one Home Assistant restart per bundle
  digest (`request_component_restart`), the activation default (`access.station_media_provider = auto`), the template-registry sync, the
  existing-WhatsApp source export and the GrantRef the service writer reads from the manifest (`ManifestGrantSource`).
- `OWNER_ON_PERMITTED = False` (build constant) refuses the owner's ON of that switch (409 `auto_install_not_permitted`).

Flipping `OWNER_ON_PERMITTED` would NOT give the owner a working start-up install, and would open much more than an install:

| What still blocks the unattended staging in practice | Where |
|---|---|
| the lab's manual markers (component + config level) -> `manual_install_present` | `preflight_native` |
| after a managed conversion the installed tree is Arx-managed by `wiskey.managed.installed`, not the tree the unattended path staged (`wiskey.installation.staged_digest`) -> `foreign_install_present` | `preflight_native` / `_target_owned` |
| the shipped bundle is managed-profile, so the Core runtime gate must say `supported` - it never does today (no image verifier, WisKey W1) | `preflight_managed_runtime` |

and that path has no full-backup check, no Core stop / start, no registry comparison and no automatic rollback. So the constant stays
`False` (test-pinned, unchanged), `wiskey.auto_install` stays off, and policy B's tests are untouched.

### What was built instead

The start-up path is the SAME orchestrated run as the owner's button (`wiskey_managed_install.start(..., origin="startup")`), started
by `startup_reconcile` from the add-on's start-up thread right after `recover_interrupted` (`main.py`: `startup_safe`).

New owner switch `wiskey.managed.startup` ("התקנה ועדכון בעליית התוסף"):

- off by default; missing / null / unreadable / anything but `on` = off;
- ON only by the owner's existing route `PUT /wiskey/managed/switch` (`switch: "startup"`), system administrator + `system.configure`,
  audited before / after, with the managed switch's typed phrase (`מאשר ניהול התקנה`) - no fourth phrase (Q7);
- needs the managed switch ON (409 `managed_off`); turning the managed switch OFF turns it OFF too (as the accepted-risk switch);
- the static "one writer" test now covers it: no code writes `K_ENABLED` / `K_RISK` / `K_STARTUP` by name; `set_switch` writes only
  through the closed lists (`k == key` behind `check_switch`, dependents only ever OFF);
- it is under the `wiskey.managed.` prefix, so it is never exported in an Arx backup and never restored from one.

What a start-up run does and does not do (all test-enforced):

| Gate | Start-up run |
|---|---|
| managed switch AND start-up switch ON | required; otherwise nothing is read, nothing audited (`off`) |
| manual install | never replaced: the owner's adoption (typed phrase) is still required (`adoption_required`, audited) |
| plan | install / upgrade / convert only; `up_to_date` is silent; downgrade / unknown version / other content refused and audited |
| shipped bundle byte-exact to its pin, free space | as the owner path (`preflight`) |
| core API up | waits up to 10 min (`STARTUP_CORE_WAIT_S`); then gives up, nothing touched (`core_not_running`) |
| Core provenance gate | **strict**: only `supported` passes; the accepted-risk switch never applies to a start-up run (even if ON) |
| full platform backup <= 24 h (owner takes it) | required (`full_backup_missing` / `full_backup_stale` / `backups_unreadable` abort before Core is stopped) |
| private backup, verified swap with Core stopped, registry compare, automatic rollback | identical to the owner path |
| repeat | one attempt per shipped bundle digest (`wiskey.managed.startup_attempt`, written before the worker starts). It is tried again at the next start only when it ended `aborted` before Core was asked to stop (nothing touched, e.g. no fresh backup yet). After a stop, a swap, a rollback, an interruption or a success it is not repeated for that bundle; a NEW bundle (next release) is a new attempt; the owner re-arms by turning the start-up switch on again |
| rollback runs | never started by start-up |
| audit | `wiskey.managed.startup` (allowed with job / plan / versions, or denied with the closed code; the same outcome is not repeated at every start); the run's own `wiskey.managed.run_started` / `wiskey.managed.run` rows carry `origin: startup`; actor = none (the system) |

**What still blocks in practice (honest):** the Core gate never says `supported` today (no image verifier from WisKey, request W1) and
Q6 keeps the accepted-risk switch off - and even ON it does not cover start-up. So, with the start-up switch ON, every start-up attempt
today ends `aborted` / `core_gate_unverified` before anything is stopped, and it is tried again at each add-on start (one run record and
audit row each time, nothing touched). The start-up path becomes effective the day WisKey ships the verifier. The lab also still needs
the owner's one-time adoption of the manual rc.10 install before any managed run (start-up or owner) may convert it.

Other effects: the run stops and starts Home Assistant Core; at add-on start-up it may therefore follow a just-finished add-on update by
a Core stop / start. `bridge_install.run_startup` (Arx's own bridge copy) runs before it and is unchanged.

## Q8 - kept runs (owner number: 5)

- `wiskey.managed.keep_runs`: integer 1-10, default **5** (`KEEP_RUNS`; the owner's number of 04.11). Unset, out of range or malformed
  stored values read as 5.
- One writer: `PUT /api/v1/wiskey/managed/keep-runs` `{value: int}` - system administrator + `system.configure`, audited
  (`settings.changed`, key / before / after); a bool, string, float, null or out-of-range value is 422 `validation`, audited denied.
- A change deletes nothing by itself; the next successful run's clean-up (`_prune`) keeps that many newest stage directories
  (`<config>/.smplwise-wiskey-managed/<id>/`: previous tree, markers) and private backups (`/data/wiskey-managed/backups/<id>/`), plus
  the run just finished. Raising the number does not bring back what was already removed.
- UI: the card "התקנה ועדכון של רכיב בקרת הכניסה" (Settings › Security › קריאות בקרת כניסה) gains the row "כמה עדכונים אחרונים לשמור"
  (a 1-10 list and a save button); the view carries `keep_runs` and `keep_runs_range`.

## Q2 - the installer tools in the Settings column

The column (`screens/system-nav.ts`, drawn from `screens/system-index.ts`) shows group headers as accordions (one group open) and the
top-level rows of the open group. Owner decision 402: it never scrolls; the 2400 assembler measured the "מערכת ותשתית" group at 866 px
for 852 with one more top-level row (1440x900), so the train had made the installer tools search-only.

The owner chose option ג ("in another group") and named "בקרת כניסה". The column now has a sixth group **"בקרת כניסה"** (icon `door`,
between "מדיה" and "מערכת ותשתית") with three rows:

1. "בקרת כניסה" - the access-control screen (moved from "מערכת ותשתית"; its four segments and the six operations views stay search
   results under it, as before);
2. **"התקנה ותחזוקה"** - the installer tools screen `#/system/intercom-installer` (a top-level row of this group; its four tools -
   clock, add / remove stations, platform configuration, station technical settings - are search results under it, because the screen
   draws its own tab strip; search words still include "התקנה ותחזוקת מערכת האינטרקום");
3. "מתגי מסכי כניסה" (moved from "מערכת ותשתית").

The shell's tab row, the deep links and the permissions are unchanged.

Height (fit budget of owner decision 402), computed from the column's CSS (dense mode for height <= 960 px: row 28 px + 1 px gap, group
header 26 px, 8 px between groups; for height <= 800 px: row 24 + 1, header 24, 4 px):

| State | 1440x900 | 1366x768 |
|---|---|---|
| "מערכת ותשתית" open (the longest, 19 -> 17 rows) | -2 x 29 + 26 + 8 = **-24 px** vs the train's passing state (est. ~837 -> ~813 of 852) | -2 x 25 + 24 + 4 = -22 px |
| any other group open | +34 px for the extra header (those groups show 3-4 rows; far below the budget) | +28 px |
| "בקרת כניסה" open | 6 headers + 3 rows | 6 headers + 3 rows |

The measurement itself is the runner's `layout-settings-nav-fit-402` (every group opened one at a time, `scrollHeight <= clientHeight`
and the last link inside the window, at 1440x900 and 1366x768) - see "Tests" for its status.

## Files

Backend: `services/wiskey_managed_install.py` (start-up switch + reconcile, origin, strict gate for start-up, kept-runs setting,
`startup_safe`), `routers/wiskey_managed.py` (`startup` switch name, `PUT /wiskey/managed/keep-runs`), `main.py` (the start-up thread
calls `startup_safe`). Docs: `smplwise_vms/DOCS.md` ("What Arx may do on your system": start-up runs, 24 h, owner takes the backup).
Frontend: `src/api/wiskey-managed.ts`, `src/i18n/wiskey-managed.ts` (he / en; ar / ru fall back to en for the new and changed keys - their
old `lead` / `unattended` said "nothing installs by itself" and were removed), `src/screens/system-security-wiskey-managed.ts` (start-up
switch row, kept-runs row, "בעליית התוסף" pill on a start-up job), `src/screens/system-index.ts` (the new group).
Tests: `tests/test_wiskey_install_answers_2400.py` (new), `tests/test_wiskey_managed_install_2382.py` (switch views + the one-writer static
test extended to the start-up switch), `frontend/tests/unit-wiskey-managed.spec.ts`, `frontend/tests/unit-settings-index.spec.ts`.

Routes: `PUT /api/v1/wiskey/managed/keep-runs` is new; `contracts/API_INVENTORY.md` is regenerated at the release (as the train does).

## Tests

| Run | Where | Tree | Outcome |
|---|---|---|---|
| `pytest tests/test_wiskey_install_answers_2400.py tests/test_wiskey_managed_install_2382.py` (before the owner's number 5 arrived; default 3) | workstation, `.venv` Python 3.12 | working tree | 105 passed |
| `pytest tests/test_wiskey_install_answers_2400.py tests/test_wiskey_managed_install_2382.py tests/test_wiskey_m12_policy_b_native_gate.py tests/test_wiskey_m12_policy_b_owner_switch.py tests/test_wiskey_r3_2272_owner_switch.py tests/test_mac_managed_auto_policy.py` (default 5) | workstation, `.venv` Python 3.12 | = `b20e4ced7` | 187 passed, 3 skipped |
| `npx playwright test -c playwright.unit.config.ts` unit-wiskey-managed, unit-settings-index, unit-small-ui-bugs-2343, unit-intercom-ops, unit-settings-nav-295, unit-wiskey-installer, unit-empty-state-icons, unit-token-lint (explicit files only) | workstation, Node only | = `b20e4ced7` | 57 passed |
| `npx tsc --noEmit` | workstation | = `b20e4ced7` | exit 0 |
| `scripts/release_check.py` | workstation | = `b20e4ced7` | "ready for the owner's approval" (version 2.38.1 everywhere - the train is not bumped) |

The three skips are existing skips of the policy-B files (unchanged).

## NOT_RUN / open points

NOT_RUN (BLOCKED on the runner): at 07:01 UTC the runner was running a release gate (`release/2382-train`, tier L, Playwright pool,
load ~35), so by the rule "runner only when no gate runs" no job was sent; two later status reads over SSH did not answer within 120 s
and 400 s. Therefore:

- `layout-settings-nav-fit-402` and `layout-settings-nav-295` (desktop): the height proof of Q2 is the CSS calculation above, not a
  measurement. **Must run on the runner before this branch boards the train.**
- Pixel baselines: the new group header changes the settings column on every DESKTOP page screenshot that shows it (tablet and phone
  hide the column). Expected to change: `visual-matrix` `settings-*-desktop`, and the page screenshots of `evidence-wiskey-installer`,
  `pixel-access-status`, `pixel-access-s12`, `pixel-wiskey-messaging` and any other settings-page `toHaveScreenshot(page)` at 1440. Not
  re-taken (owner rule: a UI branch refreshes its baselines on the runner before joining a train) - suggested job:
  `run_smart.py spec pilot/WISKEY-INSTALL-ANSWERS-2400 <those specs> --project=desktop` first without `-u`, review the diffs (column
  only), then `-u` for the failing ones.
- `evidence-wiskey-managed-2382` (runner-only browser spec of the managed card): not run; its mocked view has no `startup` /
  `keep_runs`, which the card tolerates (rows hidden).
- The full backend and frontend suites, the UI build (`build:addon`), `contracts/API_INVENTORY.md` regeneration (one new route).
- Any lab / Supervisor / Home Assistant run.

Open points for the owner / lead:

1. The start-up path is inert in practice until WisKey ships the Core image verifier (W1): every start-up attempt ends
   `aborted` / `core_gate_unverified` before anything is stopped (one run record and one audit row per add-on start while the switch is on).
2. Should a start-up run ever accept the accepted-risk switch? Built: never (recommendation: keep it so - an unattended run should not
   accept an unverified environment).
3. The column row is labelled "התקנה ותחזוקה" (the group gives the context; the full name "התקנה ותחזוקת מערכת האינטרקום" is long for
   the 236 px column and stays a search word).
4. Arabic / Russian: the new keys and the reworded `lead` / `unattended` fall back to English until a native review.

## Migration and rollback

No migration (settings keys only, all under `wiskey.managed.`, never exported or restored). Rollback: revert the branch commits; a
stored `wiskey.managed.startup = on` is then inert (no reader), `wiskey.managed.keep_runs` is ignored (the 2382 code keeps 3).
