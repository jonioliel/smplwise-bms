# RELEASE-2439-TRAIN - the 2.43.9 train

Branch `release/2439-train`, cut from `origin/release/2438-train` at `d40eaf5d7` (19.11.2026 ~01:00 Israel) in the worktree
`C:\cloude\smplwise-train49`. Owner standing rule (18.11 night): one train and one release gate per version, fix forward with
targeted re-runs; no per-branch entry checks. 2.43.9 tag / main push / `#addon` / lab install are pre-approved, after the 2.43.8
release (tag `v2.43.8` on origin and its release commit in this train).

## 1. What merged (in this order)

| # | Branch | Head | Merge | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/CR-W3B-FE-COMBINED-2443` - wave 3B frontend (FE-1..FE-8 + TSCONFIG-SPLIT) | 41bf2a6d6 | 3478314b0 | none (933 files) |
| 2 | `pilot/CR-W3B-BE-COMBINED-2443` - wave 3B backend (BE-1..BE-4) | 95e72d09e | 12625fe68 | none (236 files) |
| 3 | `pilot/CR-HA-WORDING-2443` | a3e2bd3d3 | 273c5124b | none |
| 4 | `pilot/CR-WISKEY-NOTIF-2443` | a964ee8fd | 8c5bb7235 | none |
| 5 | `pilot/CR-A11Y-ROWS-2443` | 8cde23d51 | 1504e6fd9 | none |
| 6 | `pilot/CR-FE-TYPES-2443` | 11099ce92 | ffe5c9922 | `api/tickets-s4.ts` imports: FE-DEAD-CODE dropped `PublicSettings`, FE-TYPES added two type imports - kept both changes |
| 7 | `pilot/CR-TOKENS-UNDEFINED-2443` | 9096c4b5c | 1d3911038 | none |
| 8 | `pilot/CR-INITIALS-B-2443` (contains CR-INITIALS-2443 f9845046b) | 3616e7ce1 | 1133dc4ac | `tickets/handlers-members.ts`, `tickets/rfq-model.ts`: import lines only (FE `hostBlockStyles` / `isoZ` + `avatarInitials`), both kept |
| 9 | `pilot/CR-EVENTS-TABLE-2443` | dab01d765 | b3ea8b0f0 | `screens/investigate-events.ts`: both sides removed the dead `.thumb` rules; kept the EVENTS-TABLE comment |
| 10 | `pilot/CR-NOSCROLL-LISTS-2443` | 4648be958 | 554660205 | none |
| 11 | `pilot/CR-I18N-ELECTRICITY-2443` | f80b15ce7 | 1c535fa87 | none |
| 12 | `pilot/CR-TV-FONTS-ESCAPE-2443` | cf51f1f57 | 4037931fd | none |
| 13 | `pilot/CR-I18N-LAZY-LANG-2443` | 015b181aa | 681af8470 | 7 files, below |
| 14 | `chore/BACKLOG-HYGIENE-2443` | 6acfa5610 | 2ec8e114f | none (registry only) |
| 15 | `pilot/CR-APP-SESSION-CACHE-2443` | 5c8af1aba | 66d461d7e | 2 files, below (a port, not a text merge) |
| - | `release/2438-train` (2.43.8 fixes after d40eaf5d7) | 4679923b4 | 4a3ffe5c5 | none |
| - | `release/2438-train` = `main` = tag `v2.43.8` (released) | 5afd3af25 | bc8419763 | none (docs only) |
| 16 | `pilot/FIX-FLAKY-POLISH-WORSTCASE-2439` - the two specs flaky in both 2.43.8 gates (lead: merge if pushed before the gate) | 0f0a4850e | 2668e8c5c | none |

Every head was checked against `origin` before its merge (`mergeone.sh`: the merge refuses a head that differs).
`git rerere` (shared) recorded every resolution below.

### Merge 13 - CR-I18N-LAZY-LANG-2443 (language packs)

The branch moved every English / Arabic / Russian table into `src/i18n/lang/<lang>/**` (`packTable(...)` in the module). The train
had meanwhile edited some of those tables inline. Resolution: the `packTable` side in the module, the train's key changes applied to
the pack file:

| File | Train change | Applied to |
|---|---|---|
| `i18n/msg/api-automation.ts` | -3 keys (dead schedule-run words, FE-DEAD-CODE) | `i18n/lang/en/i18n/msg/api-automation.ts` |
| `i18n/msg/api-notify.ts` | -1 key | `.../msg/api-notify.ts` |
| `i18n/msg/map.ts` | -1 key (`ישר`) | `.../msg/map.ts` |
| `i18n/msg/screens.ts` | `placeholder-screen` keys removed (the screen was deleted by FE-DEAD-CODE), header comment | `.../msg/screens.ts` + the module header |
| `i18n/msg/system-a.ts` | +10 diagnostics site-location keys (CR-HA-WORDING-2443) | `.../msg/system-a.ts` |
| `tickets/camera-viewfinder.ts` | `ViewfinderTextKey` un-exported, `VIEWFINDER_TEXT` removed (FE-DEAD-CODE) | the module (packTable side + the same two edits) |
| `api/notifications.ts` | import lines | both kept (`isoZ`, `packTable`) |

After the merge `node scripts/i18n-split-langs.mjs` was re-run as the branch's note asks: **moved 0 tables** (no merged branch
brought an inline English table back; the 13 "left in place" entries are the branch's own known non-literal tables), no file changed.

### Merge 15 - CR-APP-SESSION-CACHE-2443 (security: app web-session cache race)

The branch fixed `services/app_session.py` and `services/local_identity.py` with private copies of the cache. The 2.43.8 train had
moved both caches onto `services/session_cache.SessionCache` (CR-SESSION-CACHE-2438), whose **ended keys** (`ENDED_KEEP_S` = 300 s,
monotonic clock) already refuse the late `put` of an ENDED session - the branch's main finding is therefore already fixed on the train
by a stronger rule. What the train lacked, and what was ported onto the shared base:

- `SessionCache` **held users**: `drop_users` / `drop_user` hold the user for the store's `user_hold_s` (store clock; a clock that
  went back keeps the hold); `put` refuses a held user's sessions; `_user_held_live_locked` lets a held - not ended - session attach
  its WebSocket; `clear` / `forget_ended` drop the holds.
- `app_session._Cache`: `user_hold_s = DROP_HOLD_S` (30 s); a `clear` (the switch off, a start-up) holds every `put` for
  `DROP_HOLD_S`; `attach(sid, ws, user_id)`; `reset()` for tests. `on_access_changed` and `services/revocation._session_hook` (a role
  change / binding revoke / Arx disable re-checks the web session on its next request) merged as written.
- `local_identity._Cache`: `user_hold_s = DROP_HOLD_S` (new module constant, 30 s); `attach(..., user_id)`.
- `tests/test_app_session_cache_race_2443.py`: one step changed - "the session hold ends" now ends the shared ended-key rule
  (`ENDED_KEEP_S` monkeypatched) instead of advancing a 30 s per-session hold that does not exist on the train.

## 2. Fix commits on the train

| Commit | What |
|---|---|
| 0572421bf | `api/tickets-costs.ts` `CostClaimOption` exported again: FE-DEAD-CODE un-exported it, CR-FE-TYPES-2443 imports it (`tsc -p tsconfig.json` TS2459 -> exit 0) |
| fe84d1c35 | unused-exports gate (CR-FE-GATES-ENFORCE-2442) on the merged tree: `v2Eta` exported again (TV-FONTS spec imports it); five file-local exports of ELECTRICITY / LAZY-LANG / WISKEY-NOTIF lose `export`; baseline pruned (`PF_EN` gone) |
| b9ff5dcda | `v2Eta`'s doc comment taken verbatim from the lead's fix 78388f837 (`pilot/CR-FE-SMALL-2440`, only that file) so its 2.44.0 merge is clean |
| 659d732f2 | `app_session._Cache.forget_ended` (tests only) also ends the clear hold - `test_session_cache_2438::test_clear_keeps_the_ended_keys_and_forget_ended_resets_them` failed after the merge-15 port; `pixel-events-windows-2443` (new in CR-EVENTS-TABLE-2443, never run before): its facets mock lacked `unavailable_types`, `renderTech` threw and the screen stayed "loading" (runner: both projects timed out) |
| 6fd241e76 | first baselines of `pixel-events-windows-2443` (runner, 4 images, reviewed) |
| 9439362d5 | the five page-bundle unit specs (`unit-arx-local-login`, `-arx-pending-tokens`, `-brand-login`, `-local-user-create-2438`, `-service-identity`) build `esm` and inject `type: 'module'`: LAZY-LANG's `i18n/lang-packs.ts` awaits at top level, which esbuild cannot emit as `iife` (24 cases failed to build) |
| eed8da28a | `unit-no-ha-branding-2443` judges a pack file `i18n/lang/<lang>/<module>` as its module (+ an allow entry for the `msg/api-devices.ts` table of the Settings › Access labels); `unit-noticeperm-295` reads the English pack |
| 6af626d93 | `unit-shell-lazy-2436`: `tickets/nav-text.ts` now also imports `i18n/lang-packs.ts` |
| 2e1904d47 | `unit-wxmedset`: the media row's English is read from the `access-parity` pack file |

## 3. Version and built UI

| Commit | What |
|---|---|
| da45e8bcd | release: 2.43.9 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), CHANGELOG (bilingual), API inventory (1909 routes, header only). No migration (0216 stays the last); bridge stays 0.10.7 |
| 88bd6bc54 | release: 2.43.9 - rebuilt UI at 2668e8c5c (`~/work/build_ui2439.sh`, the 2.43.8 script renamed; rc=0; 325 maps archived to `~/smplwise-results/sourcemaps/2.43.9`; tarball sha256 `c208e896...c62a5593` checked after the copy; 0 `.map`, 0 `sourceMappingURL`) |

Entry chunk of the built UI (`node scripts/bundle-budget.mjs --enforce`, `smplwise_vms/www`): raw 2,789,168 B, gzip 799,717 B
(2.43.8: gzip 1,069,859 B; -25 %, the language packs of CR-I18N-LAZY-LANG-2443). Budget gzip 1,102,000 unchanged (OK).

## 4. Tests actually run before the gate

Workstation: main checkout `.venv` (Python 3.12), Node 24.21.0, `frontend/node_modules` junction to the main checkout.

| Check | At | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | after merge 15 | 1 error (TS2459 `CostClaimOption`) -> fixed 0572421bf -> exit 0 |
| `npx tsc --noEmit -p tsconfig.tests.json` | after 0572421bf | 1 error (TS2459 `v2Eta`) -> fixed fe84d1c35 -> exit 0 |
| `npx tsc --noEmit -p tsconfig.scripts.json` | after 0572421bf | 3 errors: `eslint`, `typescript-eslint`, `eslint-plugin-lit` not installed in the workstation's shared `node_modules` (local environment, not the tree) - NOT a result; the runner build ran `tsc --noEmit` (app) inside `build:addon` |
| `node scripts/unused-exports.mjs --enforce` | after merge 15 | FAIL: 5 new file-local exports -> fixed fe84d1c35 -> OK (55 / 88 = baseline); again after merge 16: OK |
| `node scripts/i18n-split-langs.mjs` (re-run after merge 13) | 681af8470 | moved 0 tables, no file changed |
| backend, `-p no:xdist`: `test_app_session_cache_race_2443`, `test_app_session_295`, `test_app_session_fixtures_sx25`, `test_authrevoke_2435`, `test_local_session_cache_race_2438`, `test_local_identity`, `test_local_identity_units`, `test_local_passkeys`, `test_local_reset`, `test_rbac`, `test_rbac_groups`, `test_rbac_camera_scope`, `test_access`, `test_access_grants`, `test_capture_lease_triggers` | merge-15 tree | 539 passed, 0 failed |
| backend `test_session_cache_2438`, `test_version`, `test_release_notes_marker` | merge-15 tree | 1 failed (`forget_ended`, above) |
| the same + `test_app_session_cache_race_2443`, `test_local_session_cache_race_2438` | 659d732f2 | 46 passed, 0 failed |
| `scripts/api_inventory.py` | da45e8bcd | 1909 routes |
| `scripts/project_status.py --write` | after merge 14 | PASS (465 tasks); views unchanged except the timestamp (not committed) |
| tsc app + tests, unused-exports | 2668e8c5c (after merge 16) | exit 0, exit 0, OK |
| `bundle-budget.mjs --enforce` on the built UI | 88bd6bc54 | OK (above) |
| runner `run_smart.py preview` `pixel-events-windows-2443`, `evidence-audit30c-tickets`, `pixel-audit30a-glass-bridge`, `pixel-home-fb-2431`, `pixel-wiskey-station-media`, `pixel-wiskey-talk-dial-2382`, `pixel-notice-tv-mock`, `pixel-notice-tv-portrait-chips`, `-u --workers=1`, all projects | b9ff5dcda | 118 passed, 147 skipped (per project), 2 failed (`pixel-events-windows-2443`, fixed 659d732f2); **0 existing baselines rewritten** - the INITIALS / TOKENS / TV changes stay inside the specs' tolerance |
| runner, same, `pixel-events-windows-2443 -u` | 659d732f2 | 2 passed; 4 new baselines (6fd241e76) |
| runner `build:addon` | 2668e8c5c | rc=0 (above) |
| Playwright unit config, every `tests/unit-*.spec.ts`, `--workers=1` (workstation) | 2d8e82ad7 | 4938 tests: **4894 passed, 10 skipped, 34 failed** - 29 merge interactions with CR-I18N-LAZY-LANG-2443 (fixed in the four commits above; each fixed file re-run: 55 + 7 + 8 + 7 passed) and the 5 known `unit-session-me-failure-2435` cases (a browser spec the node config picks up; needs a preview server, same on every branch) |
| runner `run_smart.py preview` `layout-dd-click`, `dropdown-phone-choice`, desktop, `--workers=1` (the two early-layout failures of gate run 1) | 88bd6bc54 | 36 passed, 0 failed (load 37): run-fault flakes under load 99-107, not product |

Runner full backend outside the gate: started twice and stopped by me - the first time (load 52-75 while the 2.43.8 gate ran) to
keep that gate clean; the second time at ~4,000 tests because the runner's disk was full (my four `/tmp/t49-pytest-*` basetemps had
grown to 15 GB - no `tmp_path_retention_policy=failed`; the late failures in that run, 26 `F`, came after the disk filled and are not
a result). The temp folders were deleted (disk 100 % -> 94 %). The full backend then runs inside the release gate (selection: full
backend, 996 files).

## 5. Release gate

Runner tooling (lead note, 19.11): `release_gate.py` + `gate_summary.py` of W3B-FE in `~`, `~/gate2`, `~/nightly-gate`; ruff installed.
Launched by `~/wait_gate_2439.sh` (`release_gate2.sh release/2439-train`, nice 10; selection vs `v2.43.8` = the full tier: backend
996/996 files, frontend 1163/1163 specs). The runner was shared all night (other agents' backend / Playwright jobs; load 50-115 on
16 cores). Its disk was full when the first gate was queued: my own run's temp folders were removed and the owner-approved
`prune_gate_dirs.sh` logic was run once by hand (7 old entry worktrees of merged branches, 7.9 -> 22 GB free); the gate waited for
the tests lock held by `push_watch`.

| Run | Sha | Result |
|---|---|---|
| 1 | 88bd6bc54 | **FAIL** after 24 min in the early layout stage (fail-fast): `layout-dd-click:66` placement 4 desktop and `dropdown-phone-choice:411` desktop, both failed again alone at load 99-107. Re-run alone on the runner (`run_smart preview`, desktop, workers 1, load 37): 36 passed - run faults |
| 2 | 88bd6bc54 (`GATE_EARLY_FAILFAST=continue`, `--resume`) | **FAIL**, 200-minute budget exhausted (load up to 115). Backend complete: 23,501 passed, 10 failed (no retry time). Preview 20,985 passed, 192 failed (180 = the unit specs fixed in 9439362d5..2e1904d47, which the gate ran in all three projects; the rest timeouts), dev 378 / 151 failed (timeouts), pixel / fixture / visual did not finish. One real hard failure: ESLint `no-misused-promises` in `notice-tv/main.ts:715` |

Fixes after run 2:

| Commit | What |
|---|---|
| ba7b82a46 | `notice-tv/main.ts`: `if (document.fonts)` instead of a Promise in the condition (CR-TV-FONTS-ESCAPE x CR-FE-GATES-ENFORCE); runner `npx eslint src`: rc=0 |
| 7257b2d53 | `test_bridge_key_activation_295::test_h03` reads the bridge-key module and its three pack files; `test_lease_wire_closed_295::test_a_status_binding_denied_ends_the_session_as_lost` reads the lease row until it is written (pre-existing race, failed 2 of 3 alone on the runner; code and test unchanged since v2.43.8) |
| 670716c08 | UI rebuilt at 7257b2d53 (only the TV board chunk changed; sha256 `2a76283b...fa63a54`) |

Runner re-runs at ba7b82a46 before run 3: the 10 backend failures alone - 8 passed, 2 failed (fixed in 7257b2d53, then both files
passed locally); `layout-timescrub-noscroll` + `dropdown-phone-choice`, all projects, workers 1: 96 passed.

