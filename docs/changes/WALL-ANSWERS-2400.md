# WALL-ANSWERS-2400 - the owner's wall display answers of 04.11 (round 18, questions 18-20)

**Branch:** `pilot/WALL-ANSWERS-2400` from `origin/release/2400-train` @ `8e3ac839`. **Target:** 2.40.0 (no version bump, no tag,
no merge here). **Source of the answers:** `private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md`, section "04.11 בוקר - סבב 18",
items 18-20 (round 17 numbers 16-18). **Background:** `docs/changes/WALL-FOLLOWUPS-2390.md` (merged into this train: the desktop
flag, the foldable rule, and the two display bugs it observed and left alone in its section 4), `docs/changes/CR-030-WALL-DISPLAY.md`.

| Question | Owner answer | Outcome |
|---|---|---|
| 18 - an unfolded foldable is detected as a tablet and shows the wall | **א** (keep it) **+ a setting** so an administrator can switch to **ב** (open = phone) | default unchanged (tablet); new installation setting "טלפון מתקפל פתוח" under the wall displays list, admin only, audited |
| 19 - two display bugs: "המערכת תקינה" twice on a portrait wall; the camera wall (kiosk) header breaks on a phone | **א** (fix) | both root-caused and fixed, each with a regression test |
| 20 - "מסך קיר גם במחשב" lives inside the profile's settings blob, so a rollback resets those profiles | **ב** (own field) | moved to the column `wall_profiles.desktop`, migration **0204** (additive), existing values migrated, rollback documented |

## 1. Question 18: the open-foldable setting

- **Rule** (`frontend/src/wall/device-class.ts`): `isOpenFoldable(env)` names the case WALL-FOLLOWUPS-2390 turned into a tablet - a
  touch screen with a short side of at least 600 CSS px that is spread over a hinge (two viewport segments), or carries the phone
  ("Mobile") user agent on a near-square screen (long / short under 1.4) with a short side under 900 (`FOLDABLE_MAX_SHORT`; the inner
  screens of the Galaxy Z Fold 3-7, Pixel Fold, Pixel 9 Pro Fold sit at 673-~790). `classifyDevice(env, { foldableOpen })` returns
  `tablet` for it by default and `phone` when the setting says so. **No other device changes class** under either value (unit table:
  the cover screen, phones, a tall 7 inch tablet with a phone UA, an iPad, a near-square tablet without the Mobile token, a desktop).
  With the default every device gets the same class as under the 2390 rule (the unit table holds both).
- **Setting:** `wall.foldable_open` in `settings` (`tablet` | `phone`, default `tablet`; an unknown stored value reads as the
  default). `GET /api/v1/wall/settings`, `PATCH /api/v1/wall/settings` (`{"foldable_open": ...}`, extra keys 422), both behind
  `system.configure` on the installation (the same check as every wall administration route); a change writes one audit row
  `wall.settings.update` with `{"foldable_open": {"from", "to"}}` (an unchanged value writes none). `GET /wall/profiles` carries the
  value so the settings page needs no extra request.
- **Delivery:** `GET /me` `wall` block gains `foldable_open` (only for a user with an enabled wall profile - the only user the class
  matters for). `sw-app` classifies with `classifyOptionsFor(me)`. Presentation only, like the class itself: backend tests assert the
  bindings and permissions are identical before and after a change, and a wall user gets 403 on both routes.
- **UI** (`frontend/src/screens/system-wall.ts`): one card under the list with one setting line, **"טלפון מתקפל פתוח"**, a select
  **"כמו טאבלט (מסך קיר)"** / **"כמו טלפון (המערכת הרגילה)"**. Saved at once (like the list's enable / disable); a failure puts the
  old value back and shows the error in the toolbar. The page is the existing Settings > מסכי קיר list page (it is not a control
  screen); the row adds one card under the list (desktop 1440x900: it ends at 475 px; phone: under the cards).
- **When it applies:** a device that is already open picks the new value up on its next `/me` read (sign-in revalidation or a
  reload), the same as the desktop flag.

## 2. Question 19: the two display bugs

### 2.1 "המערכת תקינה" twice on a portrait wall

- **Root cause:** `sw-wall.ts` built one list of status chips (alert chips, the health chip, the state entities) and rendered it in
  the top strip **and**, on the `tablet-portrait` preset, again in the bottom band. CR-030 section 4.1 gives portrait "strip, cameras,
  then the map band + state band"; the strip of a portrait wall was never meant to carry the chips. A spec comment even recorded it
  ("portrait repeats the chips in the band").
- **Fix:** `chipHome(preset)` in `wall-logic.ts` (pure, unit-tested): `band` for `tablet-portrait`, `strip` otherwise; `sw-wall`
  renders the chips (or the "אין חיבור למערכת · מנסה שוב" banner that replaces them) in that one place only. The portrait strip keeps
  the title and the clock. Landscape and single are unchanged.
- **Regression tests:** `unit-wall-logic.spec.ts` "the status chips have exactly one home per preset"; `evidence-wall-answers-2400.spec.ts`
  "question 19 (1)" - portrait tablet 800x1280 and the unfolded foldable 690x829: exactly one `[data-wall-health]`, in the band, none
  in the strip; landscape 1280x800: one, in the strip, no band; no overflow.

### 2.2 The kiosk header on a phone spills over the first camera

- **Root cause:** a kiosk-only user on a phone lands on `#/kiosk/all` (`kiosk-wall.ts`). The kiosk element is a flex item of the
  shell's `<main>` (a 100dvh flex column) and has `min-block-size: 100%`; when its content is taller than the screen - always on a
  phone: the header wraps to three rows (title, layout select and health, the clock row) and the 16:9 tiles pack from the top - the
  item shrinks to exactly 100dvh and **its own** flex items shrink. The header had an explicit `min-block-size: 48px`, which replaces
  the automatic (content) minimum of a flex item, so the header was squeezed to 48 px while its wrapped rows overflowed it: the grid
  started at the squeezed header's bottom and the clock row was drawn over the first tile. Seen at 344 px (folded cover screen) and
  at every phone width where the header wraps.
- **Fix:** `header { flex: none }` and `.stats { flex: none }` - the header and the counters keep their content height; the grid
  starts under the header; the page scrolls inside `<main>` exactly as it already did on a phone. Tablet and desktop are unaffected
  (their grid is `flex: 1; min-block-size: 0` and absorbs the space; the header never had to shrink there).
- **Regression test:** `evidence-wall-answers-2400.spec.ts` "question 19 (2)" at 344x882, 360x780, 393x852, 412x915 (mobile
  project): every header child stays inside the header box and the screen, the header is never shorter than its content, the grid
  starts under the header, the clock intersects no camera tile, no sideways scroll.

## 3. Question 20: "מסך קיר גם במחשב" in its own field

- **Before:** `config.desktop` inside `wall_profiles.config_json`. Older code validates `config_json` with `extra="forbid"` and, on
  any unknown key, `config_of` falls back to the **default configuration** for that profile (cameras order, layout, alerts, frame,
  schedule all shown as defaults; a save from that state would write the defaults back).
- **After:** migration **`0204_wall_profiles_desktop.sql`** (the next free number after the train's 0203; checked against every
  recent remote branch): `ALTER TABLE wall_profiles ADD COLUMN desktop INTEGER NOT NULL DEFAULT 0`; rows whose `config_json` holds
  `"desktop": true` get `desktop = 1`; the key is then removed from `config_json` with `json_remove` (all other keys and their order
  kept; rows that are not valid JSON are left alone). `WallConfig` no longer has the field (`config.desktop` in a PATCH is now a 422);
  `ProfilePatch` has a top-level strict `desktop` next to `enabled` / `remote_allowed`; the profile answer carries top-level `desktop`;
  `GET /me` reads the column. The change still bumps the version and lands in the `wall.profile.update` audit row's `changed` list
  (as `desktop`). `config_of` also drops a stray `desktop` key from a row that was never migrated (a restored older row), so such a
  row keeps its configuration.
- **Frontend:** `WallProfile.desktop` (top level), the drawer's switch edits `draft.desktop` and the save sends `desktop`.
- **Tests:** backend `test_desktop_flag_reaches_me_and_changes_no_permission` (rewritten for the column; `config.desktop` is 422;
  the stored blob has no `desktop`), `test_desktop_column_survives_a_rollback_of_the_configuration` (the stored blob of a profile
  with the switch on validates under the model without the field, `extra="forbid"`), `test_migration_0204_moves_the_switch_out_of_the_blob`
  (true / false / absent / not JSON, key order kept, a legacy key in a live row ignored); the 2390 evidence spec now asserts the drawer
  sends a top-level `desktop` and no `config.desktop`.

### Migration and rollback

- **Forward:** automatic at start-up (0204). Additive: one column with a default. The only data change is moving one key out of
  `config_json` into that column; nothing else in the blob changes.
- **Rollback (to 2.39.x or older):** nothing to do first. Older code never reads the column and finds no unknown key in
  `config_json`, so every profile keeps its settings; only the desktop switch itself is not honoured by a version that never had it.
  Rolling forward again finds the column with its values intact (`schema_migrations` already holds 0204).
- **Column removal** (never required): `ALTER TABLE wall_profiles DROP COLUMN desktop` (SQLite 3.35+), and delete the
  `schema_migrations` row 0204 only if 0204 must run again.
- The foldable setting is a `settings` row; older code ignores it. No migration.

## 4. Files

| Area | Files |
|---|---|
| Backend | `smplwise_vms/backend/smplwise/services/wall.py`, `smplwise_vms/backend/smplwise/routers/wall.py`, `smplwise_vms/backend/smplwise/migrations/0204_wall_profiles_desktop.sql` (new) |
| Frontend | `frontend/src/wall/device-class.ts`, `frontend/src/wall/wall-logic.ts`, `frontend/src/wall/sw-wall.ts`, `frontend/src/screens/kiosk-wall.ts`, `frontend/src/screens/system-wall.ts`, `frontend/src/shell/sw-app.ts`, `frontend/src/api/wall.ts`, `frontend/src/api/types.ts` |
| Tests | `smplwise_vms/backend/tests/test_wall.py`, `frontend/tests/unit-wall-device-class.spec.ts`, `frontend/tests/unit-wall-logic.spec.ts`, `frontend/tests/evidence-wall-answers-2400.spec.ts` (new), `frontend/tests/wall-followups-mocks.ts`, `frontend/tests/evidence-wall-followups-2390.spec.ts`, `frontend/tests/evidence-wall-alerts.spec.ts` (comment), pixel baselines (section 5) |
| Docs | this file, `contracts/API_INVENTORY.md` (regenerated: 2 routes), `docs/changes/CR-030-WALL-DISPLAY.md` (amendment note), `docs/changes/WALL-FOLLOWUPS-2390.md` (superseded note), `docs/user-guide/he/45-wall-mode_HE.md` |

`management/tasks.json` / `test_catalog.json` are not edited (registry owner). `GUIDE_ALL_HE.html` is not regenerated here (same
reason as WALL-FOLLOWUPS-2390: `scripts/build_guide.py` at release time).

## 5. Tests and receipts

Environment: workstation (Windows, Python 3.12 venv, Node 24.21.0) for backend pytest, `tsc` and the Node-only unit specs;
runner (Ubuntu, `private/runner/run_smart.py ... --machine runner`, Vite preview of the pushed branch, Chromium) for every browser
spec, after the 2.38.2-train L gate had finished (`gate_status.json` state `pass`, no `release_gate` process, 102-112 GB free).
Mocked backend in every browser spec; no device, lab host or live system.

| What | Command | Commit | Result |
|---|---|---|---|
| Repro before the fix | `run_smart.py preview pilot/WALL-ANSWERS-2400 tests/evidence-wall-answers-2400.spec.ts --project=desktop --project=mobile` (branch at the spec-only commit, train code unfixed) | `0868c190` | **6 failed** as expected (portrait 800x1280 and 690x829: 2 health chips, expected 1; kiosk at 344 / 360 / 393 / 412: the clock row's bottom 220 px against a header bottom of 141-154 px), 1 passed (landscape), 7 skipped |
| Backend (targeted) | `.venv\Scripts\python.exe -m pytest tests/test_wall.py tests/test_wall_alerts.py tests/test_kiosk_role.py tests/test_me_permissions.py tests/test_announce_screens_b295.py tests/test_migrations.py tests/test_migrations_263_upgrade.py tests/test_app_refresh_295.py tests/test_security_review_wxd_fixes.py tests/test_t06_admission_295.py` | `8c21388b` tree | **172 passed, 3 xfailed** (the xfails are pre-existing markers in those files); `test_wall.py` alone: 15 passed |
| Typecheck | `npx tsc --noEmit` | `e8e824f1` tree and later | 0 errors |
| Unit (Node), wall + related lints | `npx playwright test -c playwright.unit.config.ts tests/unit-wall-device-class.spec.ts tests/unit-wall-logic.spec.ts tests/unit-token-lint.spec.ts tests/unit-design-tokens.spec.ts tests/unit-a11y-polished-lint.spec.ts tests/unit-phone-buttons-44.spec.ts tests/unit-menu-lint.spec.ts tests/unit-uxfix-rtl.spec.ts tests/unit-wall-alerts.spec.ts tests/unit-kiosk-idle.spec.ts tests/unit-settings-rows-2380.spec.ts tests/unit-white-label.spec.ts tests/unit-glass-wall.spec.ts` | final tree | **166 passed** (the two wall unit files alone: 67 passed) |
| Evidence + regression, three projects | `run_smart.py preview <branch> tests/evidence-wall-answers-2400.spec.ts evidence-wall-followups-2390 evidence-wall evidence-wall-alerts evidence-wall-plan evidence-wall-phone evidence-mobile-wall-kiosk evidence-kiosk-polish evidence-kiosk layout-wall-plan evidence-look-polish-2331 --project=desktop --project=tablet --project=mobile` | `e8e824f1` | **157 passed, 1 failed, 271 skipped** (project-scoped). The failure is `evidence-mobile-wall-kiosk.spec.ts:61` [mobile] (camera wall phone toolbar 94 px > 56): pre-existing on `main`, recorded by WALL-FOLLOWUPS-2390, not the kiosk header and not touched here |
| Settings row with a hit test | `... tests/evidence-wall-answers-2400.spec.ts --project=desktop --project=mobile -g "settings row"` | `12be96ec` | 2 passed |
| Pixel, against the committed baselines (before the re-take) | `... tests/pixel-wall-followups-2390.spec.ts tests/pixel-wall-plan.spec.ts --project=desktop --workers=1` | `12be96ec` | 12 passed, **1 failed** as intended: `wall-fold-inner-portrait` (the portrait strip lost its duplicate health chip) |
| Pixel re-take | same spec, `--update-snapshots=changed` | `f379589c` | 1 baseline rewritten and reviewed by eye against the old one: only the strip's "המערכת תקינה" chip is gone (the band chip stays, the clock re-centres in the strip); nothing else moved |
| Pixel + new evidence, final verify | `... tests/pixel-wall-followups-2390.spec.ts tests/pixel-wall-plan.spec.ts tests/evidence-wall-answers-2400.spec.ts --project=desktop --project=mobile --workers=1` | `c561beb4` | **24 passed**, 22 skipped (project-scoped), 0 failed |
| Release check | `python scripts/release_check.py` | final tree | ready for the owner's approval (version 2.38.1 everywhere - no bump on this branch; migrations contiguous, 204 files, last 0204) |

Screenshots (hand review, not committed; runner `test-results/**/wa2400-*.png`, 10 shots): the kiosk at 344 / 360 / 393 / 412
(header complete above the cameras: title and logo, page pill and count badge, layout select and health, exit, clock row, then the
first tile); the portrait tablet and the unfolded foldable (one "המערכת תקינה", in the bottom band); landscape (one, in the strip);
an open foldable with the setting on "phone" (the kiosk route); the settings row on desktop and phone (RTL, in the screen, no
sideways scroll, a 44 px select on the phone). Runner temp `~/work/pilot-WALL-ANSWERS-2400/.tmp_b` (172 MB) deleted after the runs.

NOT_RUN: the full release gate; real devices (foldable, phone, tablet, desktop wall monitor); the backend on the runner (the
targeted set ran on the workstation); a live Home Assistant / NVR.

## 6. Known limits

- Emulated devices and a mocked backend only: no real foldable, phone, tablet or live system.
- The foldable setting reaches an open device on its next `/me` read, not instantly.
- With the setting on "phone", a window spread over a hinge on a large dual-screen device (short side 900 or more, or two segments
  of any size) is also treated as a phone: two viewport segments are the signal of an open foldable, whatever its size.
- The kiosk page on a phone still scrolls inside `<main>` (one column of 16:9 tiles plus the counters is taller than a phone); that
  is the existing phone design of the kiosk (mobile audit 2026-09-30), not changed here - the fix only stops the header being squeezed.
- Not changed: `evidence-mobile-wall-kiosk.spec.ts:61` (the camera wall `/live/wall` phone toolbar, 94 px against a 56 px bound) is
  a pre-existing failure on `main` recorded by WALL-FOLLOWUPS-2390: the toolbar wraps to two rows by the DROPDOWNFIT-295 design
  (basis 150 px); it is the camera wall screen, not the kiosk header of question 19.
