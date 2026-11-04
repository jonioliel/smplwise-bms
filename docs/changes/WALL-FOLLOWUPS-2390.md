# WALL-FOLLOWUPS-2390 - Display D5: wall display follow-ups

**Card:** `WALL-FOLLOWUPS-2380` (management/tasks.json; not edited here). **Branch:** `pilot/WALL-FOLLOWUPS-2390` from
`origin/main` @ `83ce7448` (v2.38.1). **Plan:** `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md` work package D5
("wall mode on desktop" flag, foldable detection edge, AT221 / AT301 evidence on the runner). **Background:**
`docs/changes/CR-030-WALL-DISPLAY.md` (section 3.2.1 detection rule, section 13 risks "foldables near 600-700 px" and "wall
mode on desktop is a one-hour follow-up"), KIOPOL (`docs/design/KIOSK_POLISH.md`, AT301).

## 1. What changed

### 1.1 Wall mode on desktop

- **Profile flag** `config.desktop` (bool, default `false`) in `WallConfig` (`services/wall.py`); stored in the existing
  `config_json`, so **no migration**. PATCH `wall/profiles/{user_id}` accepts it as a partial config (merged and validated in
  full as before; the change is in the audited diff as `config.desktop`; the version bumps, so a running display re-reads).
- **`GET /me`** `wall` block now carries `desktop` next to `enabled` / `profile_version`. The client needs it before it mounts
  anything (the configuration itself is still fetched only in wall mode).
- **Mount rule** (`frontend/src/wall/device-class.ts` `wallModeFor`): enabled profile **and** (tablet **or** (desktop **and**
  `wall.desktop === true`)). Phones never get the wall. Presentation only: the server never looks at the class or the flag
  for authorisation; role and bindings are the same on every device (backend test asserts bindings and permissions are
  unchanged by the flag, and a wall user cannot set it - 403).
- **Settings** (הגדרות › מסכי קיר › עריכה, section "משתמש"): switch **"מסך קיר גם במחשב"**; when on, one muted line "מחשב בלי
  מגע יציג את מסך הקיר במקום המערכת". The section got `data-wall-section="user"` (test hook).
- **Desktop behaviour of the wall** (`sw-wall.ts`, `wall-logic.ts`):
  - the scale follows the **window** on a desktop (`wallScaleFor`): a 1280x720 window on a 2560x1440 monitor stays at 1, not
    1.4; tablets keep the physical-screen rule unchanged;
  - the parked mouse pointer hides after **3 s** without movement (`cursorHidden`, `CURSOR_IDLE_MS`, host attribute
    `data-cursor-idle` -> `cursor: none`); any mouse movement brings it back at once (removed in the `pointermove` handler,
    not on the next tick). No animation: a pointer cannot fade and the reappearance must be immediate;
  - the presets are unchanged: a landscape monitor takes `tablet-landscape` (2x2 / 3x2, still at most 6 sub streams per page).

### 1.2 Foldable detection (fold and unfold)

- **Rule change** (`classifyDevice`): the band `touch and mobileUA and short < 700 -> phone` now applies only to **tall**
  screens (`long / short >= 1.4`, `FOLDABLE_MAX_ASPECT`). No phone has a short side of 600 CSS px or more; what sits in that
  band is either an unfolded book-style foldable (inner screen near-square: Galaxy Z Fold 3/4 673x841 = 1.25, Fold 5 690x829 =
  1.20, Pixel Fold 841x701 = 1.20) or a 7 inch tablet that sends a phone user agent (600x960 = 1.6). The first is now a
  **tablet**, the second stays a phone. A window spread over two viewport segments (Viewport Segments API) is a tablet when
  its short side is >= 600. The folded cover screen (344-412 px short) stays a phone by the 600 rule.
- **Intended change against CR-030:** the CR's worked-table row "foldable unfolded 673x841 with Mobile -> phone" (a deliberate
  choice there) is reversed; CR-030 section 3.2.1 carries an amendment note pointing here.
- **Live re-read** (`watchDeviceClass`): `resize`, `orientationchange`, `screen.orientation` change and `devicePosture` change
  re-read the physical device after it has been stable for 250 ms (a fold animates through odd sizes); only a change of the
  class or the physical screen calls back. `sw-app` re-renders on it, and since `wallMode()` is evaluated in `render()`, the
  shell swaps between the wall and the application **in place, without a reload**. `sw-wall` re-reads its `env` the same way
  (scale, installer panel). An on-screen keyboard or split screen changes only the viewport and never flips the class.
- **Layout on fold / unfold:** the inner screen in portrait takes `tablet-portrait` (one column of two), turned to landscape
  `tablet-landscape` (2x2); folded, the application. Asserted with no horizontal or vertical overflow.

### 1.3 Files

| Area | Files |
|---|---|
| Detection, mount, desktop wall | `frontend/src/wall/device-class.ts`, `frontend/src/wall/sw-wall.ts`, `frontend/src/wall/wall-logic.ts`, `frontend/src/shell/sw-app.ts` |
| Types, settings | `frontend/src/api/types.ts`, `frontend/src/api/wall.ts`, `frontend/src/screens/system-wall.ts` |
| Backend | `smplwise_vms/backend/smplwise/services/wall.py` |
| Tests | `frontend/tests/unit-wall-device-class.spec.ts`, `frontend/tests/unit-wall-logic.spec.ts`, `frontend/tests/evidence-wall-followups-2390.spec.ts` (new), `frontend/tests/pixel-wall-followups-2390.spec.ts` (new) + `-snapshots/`, `frontend/tests/wall-followups-mocks.ts` (new), `smplwise_vms/backend/tests/test_wall.py` |
| Docs | this file, `docs/changes/CR-030-WALL-DISPLAY.md` (amendment note), `docs/user-guide/he/45-wall-mode_HE.md` (new section "מסך קיר במחשב ובמכשיר מתקפל") |

`GUIDE_ALL_HE.html` is **not** regenerated here: on `origin/main` it is already stale against other pages (announcements,
external access), so regenerating it on this branch would carry unrelated text; `python scripts/build_guide.py` at release
time picks up this page too.

## 2. Tests and receipts

RECEIPTS_PLACEHOLDER

## 3. AT221 and AT301 evidence

AT_PLACEHOLDER

## 4. Known limits

- Fakes and emulated devices only: no real foldable, tablet, desktop wall monitor or live system was used. The emulation
  overrides `screen`, `maxTouchPoints`, `userAgentData.mobile` and the pointer / hover / viewport-segment media queries; real
  browsers on a Galaxy Fold may report the inner screen differently (Samsung Internet, desktop-site mode). The installer
  panel shows the detected class and screen so a misclassification is visible on site.
- A 7 inch tablet that sends a phone user agent and has a tall screen (600x960) is still a phone (unchanged behaviour).
- A desktop browser cannot enter full screen by itself; a wall PC needs the browser's kiosk mode or F11 (user guide says so).
- `devicePosture` "folded" (half-open tabletop / book posture) does not change the class or the layout; the video grid may
  cross the hinge in a half-folded posture.
- Switching the flag off reaches an open desktop wall on the next `/me` read (sign-in revalidation or reload), not instantly.
- Not touched: `kiosk-wall.ts` (the SC31 kiosk route), per-device registry, hardware brightness, the ~6 sub-stream limit.

## 5. Migration and rollback

No migration (the flag lives in `config_json`; old rows read as `false`). Rollback = revert the branch commits; a stored
`desktop: true` is then rejected by the old `WallConfig` (`extra="forbid"`) and `config_of` falls back to the defaults for
that profile - so before a rollback, switch the flag off on every profile (or accept that those profiles show defaults).
