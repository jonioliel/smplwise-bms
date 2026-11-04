# RELEASE-2382-TRAIN: assembly of the 2.38.2 train (WisKey talk / calls / pairing + board and TV fixes)

Branch `release/2382-train`, cut from `main` = v2.38.1 (`2dce5d48f`). No version bump (every version line stays 2.38.1), no changelog
entry, no UI rebuild (`smplwise_vms/www` is still 2.38.1's), no tag, no merge to `main`: this document is the input for the version commit
and the runner gate. JOIN-LIVE (merge 10) is the last branch of 2.38.2 (lead, 04.11).

## 1. Merged (one `--no-ff` merge commit each, in this order)

| # | Branch (change doc in `docs/changes/`) | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/WISKEY-TALK-DIAL-2382` - provider row, `GET /access-control/station-media/readiness`, native dial in the drawer | 604fe0c73 | 2aa7ae42d | none |
| 2 | `pilot/TV-CHIPS-2381` - portrait chips default "drop", parking / gym entities | a2710c917 | 779d68d4d | none |
| 3 | `pilot/DIALOG-TOPLAYER-2381` - `sw-dialog` in the top layer, toast lift | 13b53721a | 2b32d3215 | none |
| 4 | `pilot/BOARD-MGMT-2381` - copy vs replace link, resend, the editor role | 6142b9a64 | 30b92b6a2 | none |
| - | lead fix `b6ba65be7` - notice-board toasts lifted above an open `sw-dialog`; the `unit-noticeperm-295` copy-link regex (stale spec) | - | - | - |
| 5 | `pilot/WISKEY-INBOUND-CALLS-2382` - incoming-call window, call ledger, migration **0197** | 086bff1a2 | 38d6dfbb5 | none |
| 6 | `pilot/WISKEY-RC10-PIN-2382` - rc.10 pins, accepts the rc.10 service-write v2 block | eb83bebd5 | b3bf61ca9 | none |
| 7 | `pilot/WISKEY-DEEPLINKS-2382` - capability-keyed deep-link map | dc696f3a2 | d27c6695c | 13 `pixel-wiskey-station-media` baselines (TALK-DIAL's kept, re-taken in 3) |
| 8 | `pilot/WISKEY-PAIRING-2382` - "חיבור Arx ל-WisKey" status block, "בדוק חיבור חתום", "צימוד מחדש", "מצב WisKey" | 47110f79c | 30176808e | `frontend/src/screens/system-diagnostics.ts` |
| 9 | `pilot/WISKEY-TALK-CAPS-2382` - W10 from WisKey's signed `direct/capabilities` when the overview lacks it, readiness code `capabilities_unread`, `services/wiskey_media_caps.py` | 670506b99 | 9d5b2963b | `tests/test_t06_admission_295.py` |
| 10 | `pilot/WISKEY-JOIN-LIVE-2382` - WisKey's direct join starts / stops at runtime (`services/wiskey_join_live.py`, `MANAGER.boot/shutdown`), the provider save re-evaluates, people writes record their `transport` in audit | 07b81eb69 | 2b0f007b2 | none |

Integration commits on the train (this slice):

| Commit | Kind | What |
|---|---|---|
| d110a176f | test fix + generated | `test_calendar_attendees_2343` time bomb (2.1); API inventory 1719 -> 1725 |
| b308cf54c | baselines | the merged station drawer (3) |
| b7557e0f9 | **product fix** | incoming-call banner / Settings card token fallbacks (2.2) |
| aec6061ff | generated | API inventory after PAIRING: 1728 routes |
| 2d5238efe | test fix | `test_wiskey_s5_migration_upgrade` allows migrations after 0196 (2.3) |
| bc4f5aded | **product fix** + test fix | the station call log without an inline `<style>` (2.4); `test_remote_access` knows the pairing routes (2.5) |
| fe73cf9e6 | feature wiring (lead's request) | "מצב WisKey": the direct-join row reads `wiskey_join_live.join_state()` (2.6) |
| 954cb6c7e | test fix | intercom-calls tests pin the quiet hours off (2.8) |

### 1.1 Conflict resolutions

- **system-diagnostics.ts** (8): two side-effect imports on the same line - INBOUND-CALLS' `./system-call-banner` and PAIRING's
  `./system-wiskey-pairing`. Both kept, in that order.
- **test_t06_admission_295.py** (9): PAIRING and TALK-CAPS each add one signed sender to the pinned caller set of
  `test_the_only_modules_that_reach_a_signing_call_are_the_known_ones`. Both kept (`wiskey_pairing.py`, `wiskey_media_caps.py`), each
  with its comment; each branch's own pin test (`test_wiskey_pairing_2382::test_the_probe_sends_only_the_two_discovery_reads`,
  `test_wiskey_talk_caps_2382::test_the_signed_read_sends_only_the_two_discovery_reads`) is untouched. The file after the merge: 62 passed,
  3 xfailed (workstation). PAIRING's addendum to `T06-ADMISSION-MAPPING-295.md` came in; TALK-CAPS added no row there (open point, 6).
- `remote_channel.py` (`BLOCKED_ON_REMOTE` + `/api/v1/system/wiskey-pairing`) and `main.py` (router mounts) auto-merged with both intents.

## 2. Failures found and fixed

### 2.1 `test_calendar_attendees_2343::test_whatsapp_channel_through_the_shared_account_on_the_fake_adapter` - test time bomb

Root cause: the booking runs on the fixed test clock (`cal_router._now` = 2026-10-05), the entry is booked for 2026-11-03 10:00-11:00Z
(the helper's default `T(3, 10)`), but this one test dispatched at the **wall clock** (`dt.datetime.now(UTC)`). From 2026-11-03 11:00Z
on, the dispatcher correctly retracted the queued invite as `past` (`sent 0, retracted 1`) - it passed until that morning and fails on
every day after. Not a product fault. Fix: dispatch at `NOW`, as every other dispatch in the file does (the WhatsApp path - the account
mapping, the pacing gate, the fake ha-whatsapp transport - is exercised unchanged). Workstation: the test passes.

### 2.2 `unit-token-lint` (2 tests) - product fix in src

INBOUND-CALLS' `components/sw-incoming-call.ts` read declared tokens with literal colour fallbacks (`var(--sw-surface, #fff)`,
`var(--sw-success, #15803d)` ...) and `screens/system-call-banner.ts` one (`var(--sw-accent, #4f46e5)`). The fallbacks are dropped (size
fallbacks untouched). One real defect behind it: the picture placeholder read the **undeclared** `--sw-surface-sunken`, so it always
drew its light `#e5e7eb` fallback, also in the dark scheme; it now falls back to the themed `--sw-surface-3` (as `wk-listen-button` falls
back to a token). `pixel-incoming-call` passed against its committed baselines after the change (4).

### 2.3 `test_wiskey_s5_migration_upgrade` (3 tests) - stale test

It pinned the LAST migration to 0196; INBOUND-CALLS adds 0197 (2.39.0 brings 0198 people, 0199 live validation). It now proves what it
means without a hard-coded number past 0196: the sequence is contiguous and unique, the WisKey files stay 0194..0196 after the train's
0192 / 0193, a 0191 database runs 0192..0196 once and in order and a 0193 database exactly the three WisKey files - each then followed by
every later file once, in order (`_after(196)`). Workstation: 4 / 4 passed.

### 2.4 `test_remote_hardening::test_m4_no_inline_style_elements_in_the_app` - product fix in src

Found by the full backend suite (shard 2). INBOUND-CALLS' `components/wk-call-history.ts` rendered an inline `<style>` element into the
stations screen's tree (light DOM). The strict CSP (`style-src-elem 'self'`) refuses inline style elements, so under that policy the
station drawer's call log lost its layout. The same rules now live in one constructable `CSSStyleSheet`, adopted once by the tree the
element is connected to (the screen's shadow root, or the document); the literal colour fallbacks of declared tokens are dropped (as 2.2).
The test passes; the call-log evidence and pixels re-ran green (4, @ bc4f5aded).

### 2.5 `test_remote_access::test_every_route_needs_a_remote_session` - stale test

Found by the full backend suite (shard 2). PAIRING made `/api/v1/system/wiskey-pairing` local-only (`remote_channel.BLOCKED_ON_REMOTE`:
the remote channel answers 404), as its change doc says, but the test's own blocked set did not list the three routes (it expected 401).
Added with the branch's reason. The test passes.

### 2.6 JOIN-LIVE on the "מצב WisKey" page (wiring, lead's request)

`services/wiskey_feature_status.Facts` now reads `wiskey_join_live.join_state()` (no I/O, never raises; `{}` if unreadable). The
direct-join reasons say where the join is: `join_starting` ("מופעל" / "מתחבר" / "נעצר"), `join_error` (with the join's last error code) or
`join_not_started`, whose fix text no longer asks for a restart (the join starts and stops at runtime). Every row that depends on the join
(people writes, door programs, feature host, ...) inherits it. New `test_wiskey_pairing_2382::test_the_join_line_follows_the_runtime_join`;
`test_wiskey_pairing_2382` + `test_wiskey_join_live_2382`: **70 passed** (workstation). **Follow-up, not done:** `join_state()`'s
`people_writes` path (direct / classic + reason) is not shown - the page renders reasons per row only, so it needs a page field and its
browser coverage.

### 2.8 `test_intercom_calls_2382::test_everyone_with_the_call_right_on_the_station_gets_the_ringing_call` - time-of-day test

Found by the full backend suite (shard 1, ~01:30Z = 03:30 local). The banner's ring follows the installation's quiet hours on the wall
clock (default night window), so at night the product correctly answered `sound: silent, sound_reason: quiet_hours` where the test
expected `ring` - the same kind of fault as 2.1. The file's `world` fixture now patches `notify_settings.in_quiet_hours` to False; the
quiet-hours test still switches it on itself (`test_the_ring_is_silent_in_quiet_hours_unless_the_doorbell_passes_them`). Workstation, at
night: 1 failed -> **17 passed** (954cb6c7e).

### 2.7 Not product faults, recorded

- `evidence-incoming-call` in `spec` mode (vite dev) @ 9d5b2963b: every test timed out on `sw-app` staying hidden. The runner's vite log
  shows "Re-optimizing dependencies because vite config has changed": every worktree's `frontend/node_modules` is a symlink to the clone's,
  so all agents' vite dev servers share one `node_modules/.vite` deps cache, and a re-optimisation by another branch's config mid-run
  leaves the page without its modules. Re-run in spec mode @ 2d5238efe and @ bc4f5aded: **35 passed, 4 skipped, 0 failed**; in preview: 43 passed (4).
  Runner infra point for the lead (6).
- `visual-matrix` `security-alarm ready light` (desktop) once failed with `Protocol error (Page.captureScreenshot): Unable to capture
  screenshot` under `-u` (load ~10); it passed in every later run.

## 3. Migrations, release check, API inventory

- Migrations: 197 files, contiguous 0001..0197, `0197_intercom_calls.sql` (INBOUND-CALLS) last; no other branch of this train adds one.
- `scripts/release_check.py` @ aec6061ff (and @ d110a176f): every line ok - one version 2.38.1 everywhere (config.yaml, Dockerfile,
  `__init__.py`, CHANGELOG head, API inventory), `migrations contiguous: 197 files, last 0197_intercom_calls.sql`,
  `git tag for this version: v2.38.1 exists`; RESULT: ready for the owner's approval.
- `contracts/API_INVENTORY.md` regenerated with `scripts/api_inventory.py` (project venv): **1728 routes** (2.38.1's 1719 + station-media
  readiness, intercom calls x4, notices resend, wiskey-pairing x3). Version line stays 2.38.1. TALK-CAPS changes no route (regenerated: no
  diff).

## 4. Receipts

Runner jobs: `run_smart.py <job> release/2382-train --machine=runner --workers=1`. Before **every** job a guard checked
`~/smplwise-results/gate_status.json` (not `running`; its last start > 2 min ago), no `release_gate.py` / `release_gate2.sh` process, and
(from 02:15 on) `df -h /` >= 20 GB free; it was `pass` (fix/STATION-WS-PATH-2381, started 19:07Z) with no gate process throughout.

| Check | Where / SHA | Result |
|---|---|---|
| `tsc --noEmit -p tsconfig.json` (src + tests) | workstation @ d27c6695c, aec6061ff, 2d5238efe, bc4f5aded | 0 errors (each) |
| Unit suite: every `tests/unit-*.spec.ts` (417 files), `playwright.unit.config.ts --workers=1` | workstation @ d110a176f | 3817 passed, 1 skipped, **2 failed** (2.2) |
| the same | workstation @ aec6061ff (after 2.2 + PAIRING) | **3822 passed, 1 skipped, 0 failed** |
| the same | workstation @ 2d5238efe | **3826 passed, 1 skipped, 0 failed** |
| the same, and `tsc` | workstation @ bc4f5aded (final code) | **3826 passed, 1 skipped, 0 failed**; tsc 0 errors |
| `test_calendar_attendees_2343 -k whatsapp_channel_through` | workstation | failed before 2.1, 1 passed after |
| `test_t06_admission_295` after merge 9 | workstation | 62 passed, 3 xfailed |
| `test_wiskey_s5_migration_upgrade` | workstation | 4 passed |
| Backend touched areas, one process (99 files: every test importing a changed module - intercom calls / media / sync, notices, roles, the WisKey direct catalog / discovery / media contract - + the changed tests + migrations / db gate / docs config) | workstation @ d110a176f | stopped at ~11 % (373 passed, 0 failed): about 50 s per module start on this PC, ~13 h projected |
| the same list + PAIRING files, one process | runner @ 9d5b2963b | stopped at ~19 % (734 passed, 0 failed) in favour of the full suite below, which contains every file of the list |
| `test_wiskey_talk_caps_2382` + `test_station_media_readiness_2382` | runner @ 2d5238efe | **57 passed** |
| Full backend suite (`run_smart.py backend`, two shards of 428 / 429 files) | runner @ 2d5238efe | **cut short**: both shards were killed at ~03:32Z when the SSH session that carried the run dropped (the nightly `release_gate.py main` had started at ~02:22Z; runner load 31-51). Reached: shard 1 8224 / 9398 tests, shard 2 8115 / 10584 - **16 313 passed, 19 skipped, 3 xfailed, 4 failed** (of 16 339 reached): `test_remote_access::test_every_route_needs_a_remote_session` (2.5), `test_remote_hardening::test_m4_no_inline_style_elements_in_the_app` (2.4), `test_intercom_calls_2382::test_everyone_with_the_call_right_on_the_station_gets_the_ringing_call` (2.8), `test_media_review_fixes::test_l4_the_group_volume_bucket_...` (a rate-limit bucket test that expects a 429 within five quick requests; under load 30-50 the bucket refills between them; file unchanged since 2.0, passes alone on the workstation @ 954cb6c7e - load flake) |
| The rest of the full suite + the final head's targeted set, one process (167 files: every file the cut shards had not finished - 54 + 80 - plus the 56 files around merge 10 and the fixes: every test importing `wiskey_direct_join` / `wiskey_join_live` / `wiskey_feature_status` / `access_control_writes` or touching `station_media_provider`, the four JOIN-LIVE files, `test_remote_access`, `test_remote_hardening`, `test_intercom_calls_2382`, `test_calendar_attendees_2343`, `test_wiskey_s5_migration_upgrade`, `test_t06_admission_295`, `test_wiskey_pairing_2382`, `test_wiskey_talk_caps_2382`, `test_station_media_readiness_2382`, `test_migrations`, `test_settings*`) | runner @ 954cb6c7e | LAST_BACKEND_RESULT |
| Pixel `-u`: all 20 `pixel-*` + `visual-matrix`, desktop + mobile | runner @ d27c6695c | 306 passed, 91 skipped, 1 failed (2.7, screenshot protocol error); 15 PNG written |
| the same, tablet (`pixel-wiskey-station-media`, `visual-matrix`) | runner @ d27c6695c | 34 passed, 5 skipped; 5 PNG written |
| Pixel **without** `-u`, desktop + mobile / tablet | runner @ b308cf54c | **307 passed, 91 skipped, 0 failed** / **34 passed, 5 skipped, 0 failed** |
| Pixel `-u` again after PAIRING | runner @ aec6061ff | 307 passed / 34 passed; 1 PNG written, not kept (3) |
| Pixel `-u` again after TALK-CAPS | runner @ 2d5238efe | 307 passed / 34 passed; 1 PNG written, not kept (3) |
| Pixel **without** `-u`, final | runner @ 2d5238efe | **307 passed, 91 skipped, 0 failed** / **34 passed, 5 skipped, 0 failed** |
| Evidence, preview, desktop + tablet + mobile: `evidence-wiskey-station-media`, `layout-wiskey-station-media`, `evidence-wiskey-stations`, `evidence-wiskey-stations-skins`, `layout-wiskey-stations`, `evidence-wiskey-deeplinks`, `evidence-wiskey-talk-dial-2382`, `evidence-notices`, `evidence-noticepage-295`, `evidence-noticeslides-295`, `evidence-noticedel-295`, `evidence-board-mgmt-2381`, `evidence-tv-chips-2381`, `evidence-notice-tv`, `evidence-dialog-toplayer-2381`, `a11y-dialog-focus-2310`, `evidence-access-schedules`, `evidence-access-s12`, `layout-access-s12`, `evidence-wiskey-pairing-2382` | runner @ aec6061ff | **530 passed, 196 skipped (project skips), 0 failed** |
| Evidence after TALK-CAPS, preview, 3 projects: `evidence-wiskey-talk-caps-2382`, `evidence-wiskey-talk-dial-2382`, `evidence-wiskey-station-media`, `layout-wiskey-station-media`, `evidence-wiskey-stations`, `layout-wiskey-stations`, `evidence-wiskey-deeplinks` | runner @ 2d5238efe | **232 passed, 59 skipped, 0 failed** |
| `evidence-wiskey-talk-caps-2382` + `evidence-wiskey-talk-dial-2382`, spec (vite dev), desktop + mobile (the branch's own mode) | runner @ 2d5238efe | **25 passed, 7 skipped, 0 failed** |
| `evidence-incoming-call` + `pixel-incoming-call`, preview, 3 projects | runner @ 2d5238efe | **43 passed, 8 skipped, 0 failed** |
| `evidence-incoming-call`, spec (vite dev), 3 projects (the branch's own mode) | runner @ 9d5b2963b / 2d5238efe | all failed (shared vite cache, 2.6; stopped at 22 / 39) / **35 passed, 4 skipped, 0 failed** |
| After the call-log fix, preview, 3 projects: `evidence-incoming-call`, `pixel-incoming-call`, `evidence-wiskey-station-media`, `pixel-wiskey-station-media`, `evidence-wiskey-stations`, `layout-wiskey-stations`, `pixel-wiskey-talk-dial-2382` (no `-u`) | runner @ bc4f5aded | **262 passed, 44 skipped, 0 failed** |
| `evidence-incoming-call`, spec (vite dev), 3 projects | runner @ bc4f5aded | **35 passed, 4 skipped, 0 failed** |

## 5. Baseline review (b308cf54c, 20 PNG)

Every rewritten PNG was compared with HEAD and with both branch tips (`origin/pilot/WISKEY-TALK-DIAL-2382`,
`origin/pilot/WISKEY-DEEPLINKS-2382`), as difference bands and side-by-side crops.

- `pixel-wiskey-station-media`, desktop 1440 and phone 390 (14: classic busy / drawer / drawer-dark / no-talk / talking / talking-dark,
  domus drawer / drawer-dark): against TALK-DIAL's images (kept at the merge) the only differences are (a) DEEPLINKS' deep-link icon
  button in the page actions next to the "מחובר" chip and (b) on the phone drawer a <= 1 px sub-pixel offset of the quality switch, the talk
  row and the door rows (same content; the drawer is scrolled into view, and the page header above changed). The drawer's call section is
  TALK-DIAL's (talk control moved into "שיחה", "בלוח הקלאסי" link).
- `pixel-wiskey-station-media`, tablet 1024 (5: classic drawer dark / light, talking dark, domus drawer dark / light): HEAD still had the
  pre-TALK-DIAL drawer (TALK-DIAL took no tablet baselines); the new images show TALK-DIAL's call section (talk control, "ניתוק", the
  timer) next to DEEPLINKS' header icon - the two features, nothing else.
- `pixel-wiskey-talk-dial-2382` `talk-dial-classic-provider-local-390`: the same pixels, the element box 210 px high instead of 211 (the
  call section's sub-pixel offset after the scroll); identical to the branch's image over the common area.
- Rewritten and **not kept** (both passed against the committed baseline in other runs; only load-dependent scroll positions differ):
  `pixel-wiskey-stations` `stations-classic-settings-390` (@ aec6061ff: only the station list behind the drawer moved; the drawer is
  identical) and `pixel-access-schedules` `schedules-classic-draft-390` (@ 2d5238efe: only the top tab strip's horizontal scroll). Both are
  the two shots DEEPLINKS already re-took "at low runner load".
- PAIRING and TALK-CAPS moved no baseline (`pixel-access-status`, the Settings page shots, unchanged); the token fix (2.2) moved none.

## 6. Open points and what comes next

- **Merges after 2.38.2.** JOIN-LIVE was the last branch of this train. `pilot/WISKEY-MANAGED-INSTALL-2382` (1e5320327, not in 2.38.2):
  `git merge-tree` against the train shows one conflict, `contracts/API_INVENTORY.md` (regenerate). Its `test_t06_admission_295` has no change
  against its merge base with the train, so the PAIRING + TALK-CAPS caller set (1.1) should merge clean; if it reaches the file later, keep
  all three intents. 2.39.0's 0198 (people) / 0199 (live validation) pass `test_wiskey_s5_migration_upgrade` as it is now (2.3).
- Time-of-day tests: two were found on this train (2.1 calendar wall clock, 2.8 quiet hours at night). The full suite ran 23:27Z-03:32Z (night, Asia/Jerusalem);
  a daytime run could hide another of the same kind, a night run (the gate) shows them.
- TALK-CAPS adds a signed sender (`wiskey_media_caps.py`) without a row in `docs/changes/T06-ADMISSION-MAPPING-295.md` (PAIRING added one).
- Runner infra: the shared `node_modules/.vite` deps cache across worktrees breaks a concurrent vite-dev (`spec`) job (2.7); the runner disk
  filled up at 00:00 (100 %, 0 B): pytest basetemps of full runs (`.tmp_s1` / `.tmp_s2`) reach 20-50 GB per worktree. The train's were
  removed after its runs; `pilot-BOARD-MGMT-2381`'s (51 GB, merged here, no process) were removed to continue.
- A unit spec rewrites `docs/evidence/USR2/*.png` on every full unit run (reverted each time; not committed).
- Before the version commit: rebuild the UI, bump to 2.38.2, CHANGELOG, regenerate the API inventory with the new version, release_check.

## 7. NOT_RUN

- The runner entry check (`~/gate2/branch_check.sh`) - not part of `run_smart.py`; the 2.38.2 train gate is that check.
- The full Playwright tier (all evidence / layout specs beyond the ones listed in 4): the train gate.
- Backend "touched areas in one process" to the end: replaced by the full suite (4).
- The full backend suite on the FINAL head: it ran @ 2d5238efe (before merge 10 and the fixes 2.4-2.8); the final head ran the targeted set (4).
- The notices / board / TV / dialog evidence specs after merges 8-9 (run @ aec6061ff, before TALK-CAPS; TALK-CAPS touches only the
  station-media client, its i18n and the access display Settings row).
- Real devices: no WisKey, station, Home Assistant or go2rtc contact in this slice (mocks and fakes only).
