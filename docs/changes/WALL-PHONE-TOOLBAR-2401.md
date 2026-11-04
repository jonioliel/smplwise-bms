# WALL-PHONE-TOOLBAR-2401 - the camera wall's toolbar on a phone: one row of icons, two rows of labels as a setting

**Branch:** `pilot/WALL-PHONE-TOOLBAR-2401` from `origin/release/2400-train` @ `ac87047b2` (the 2.40.0 version commit, before the UI
build commit). **Target:** 2.40.1 (no version bump, no tag, no merge here). **Trigger:** the 2.40.0 train's red item
`evidence-mobile-wall-kiosk.spec.ts:61` [mobile] - the phone toolbar was 94 px tall against the spec's 56 px (`RELEASE-2400-TRAIN.md`
8.5): DROPDOWNFIT-295 had given every control a 150 px flex basis (`flex: 1 1 150px`) so no label is cut, which makes two rows at 390 px.

## 1. Owner decision (04.11 evening)

| Item | Decision |
|---|---|
| Default | **ONE row with icons.** Each control shows an icon; its full label on a long press, as the tooltip and as the accessible name. At 390 px the bar is at most 56 px tall, with no sideways scroll; every control is touch-sized (>= 40 px, or a 44 px hit area). |
| Option in Settings | **TWO rows with full labels** - the behaviour before this change (the 150 px basis per control). |
| Both modes | A label is never truncated with an ellipsis. |
| Where | An installation-wide setting next to the other camera-wall settings, following the existing pattern (server settings key + a settings row). The settings tab grows by one row only (owner rule: no scrolling in control screens). |

## 2. What changed

### 2.1 The setting

- **Server** (`smplwise_vms/backend/smplwise/routers/settings.py`): `ui.wall_phone_bar` in `DEFAULTS` = `icons`; `SettingsPatch`
  accepts `icons` | `labels` only (anything else 422). Read by every signed-in user through `GET /api/v1/settings` (the phone wall of a
  viewer follows it), written only with `system.configure` (the existing `PATCH /settings` rule), audited as `settings.update` like
  every settings change. No migration: a key with no row reads its default.
- **Type** (`frontend/src/api/media.ts`): `ProductSettings['ui.wall_phone_bar']?: 'icons' | 'labels'`.
- **Rules** (`frontend/src/screens/wall-phone-bar.ts`, new, pure): the two modes and the default, `wallPhoneBarMode()` (an unknown
  value reads as the default), the settings row's label / hint / choices, `keyHint()` ("<what>: <chosen>"), the badge rules, the
  long-press timings (450 ms hold, 2.5 s shown, 10 px movement = a scroll).
- **Settings row** (`frontend/src/screens/system-diagnostics.ts`, הגדרות > כללי > וידאו ומדיה, right after "פריסת קיוסק כברירת
  מחדל"): **"סרגל קיר המצלמות בטלפון"** with the hint "הכפתורים מעל הקיר בטלפון. בשורה אחת: אייקונים, והשם המלא בלחיצה ארוכה" and the
  select **"שורה אחת עם אייקונים (ברירת מחדל)"** / **"שתי שורות עם שמות מלאים"**. Same shape as its neighbours (draft + save, disabled
  without `system.configure`, hidden in NVR-less mode with the other wall rows). One row; nothing else in the tab moved.
- **User guide** (`docs/user-guide/he/80-settings_HE.md`): one row in the media settings table. `GUIDE_ALL_HE.html` was NOT
  regenerated here: on the train it was already behind its sources (a rebuild pulls in other branches' text); regenerate at the release.

### 2.2 The toolbar (`frontend/src/screens/live-wall.ts`)

`renderPhoneBar()` picks the mode from the installation's settings (`data-mode` on `[data-wall-phone-bar]`):

- **`icons` (default)** - one row (`flex-wrap: nowrap`, 8 px gap) of keys: quality (aperture icon), camera count (camera icon, the
  chosen count in a small corner badge; the total for "all"; none for a map selection), columns (the shared `sw-dropdown`, grid icon,
  a badge only for a column count chosen by hand), the recorder filter (layers icon, only with two or more recorders, as before) and
  the kiosk (expand icon). Each key is 44 x 44 px (a 46 px circle in the capsule dropdown style; 44 / 48 px at the sm / lg size dial,
  never above 48). The quality / count / recorder keys keep their native `<select>` (same `data-wall-*` hooks, same options) laid over
  the whole key, its border included, with `opacity: 0` (the select's box is the 44 px key), so a tap opens the phone's own picker exactly as before; the select stays a child of `sw-field`,
  so it keeps the field's focus treatment (no second ring from the focus policy) and the key draws the focus ring (`:focus-within`).
  No text is drawn on a key, so nothing can be cut or ellipsised. Full name: the accessible name (`aria-label` of the select /
  "<label>: <option>" on the dropdown chip), the tooltip (`title`), and a **long press**: holding a key 450 ms shows a bubble
  under the row ("איכות: אוטו", "מספר מצלמות: 9 מצלמות", "עמודות בקיר: עמודות אוטו", "NVR: ...", "קיוסק: פותח את הקיוסק בלשונית
  חדשה") for 2.5 s. The bubble is absolutely positioned (the row keeps its height, the wall does not move) and wraps instead of being
  cut. The release that ends a long press does not also open the control: a capture-phase click listener on the row swallows exactly
  that click (verified for the dropdown and the kiosk key; for a native select the phone may still open its picker on release - see
  section 4). A long press does not raise the phone's text-selection / context menu (`contextmenu` prevented on keys,
  `-webkit-touch-callout: none`). Measured by the spec at 390 px: 4 keys (no second recorder) = 200 px of the row.
- **`labels`** - the toolbar as it was (DROPDOWNFIT-295): the labelled quality / count selects and the columns dropdown each with a
  150 px basis (two rows at 390 px), the recorder select, the 40 px kiosk button. The markup is the same as before (the selects were
  only factored into `qualityControl()` / `countControl()` / `recorderControl()`, shared by both modes).
- The desktop toolbar is unchanged in both modes.

### 2.3 The shared dropdown (`frontend/src/components/sw-dropdown.ts`)

New `icon-only` (reflected) and `badge` properties for a single-choice dropdown: the closed control is a square key (44 px; the
capsule style draws its ring as a circle), the icon centred, the optional short badge in the corner, no label text and no chevron;
the full name becomes the chip's `title` next to its `aria-label`. The list opens exactly as before (`pickCols()` and the phone
presentation choice `ui.dd_phone` are untouched). Without the attribute nothing renders differently; the only other edit is that the
label fit drops a stale `data-tight` also when there is no label to fit. In non-capsule styles the key always gets the chip's border,
fill and shadow (so a bare style such as `text` still reads as a control).

### 2.4 The kiosk (`frontend/src/screens/kiosk-wall.ts`) - checked, not changed

The kiosk has no toolbar of this kind: its phone header (brand, counters, layout select, health, clock, exit) wraps by design and was
fixed in WALL-ANSWERS-2400 (2.40.0); its own phone tests (`evidence-mobile-wall-kiosk.spec.ts` "kiosk on a phone") are unchanged and
run in the same receipts. The setting applies to the camera wall's toolbar only.

### 2.5 Tests changed

- `frontend/tests/evidence-mobile-wall-kiosk.spec.ts`: the toolbar test (:61) now asserts the default icon row - `data-mode="icons"`,
  height <= 56 px, the four keys >= 44 px, inside 390 px, no label drawn on a key, no ellipsis, the full names (hint / tooltip /
  accessible name), the count badge; the old assertions (touch sizes of the three hooks, first camera high, no sideways scroll, count
  and columns work) stay. New: "a long press shows the key's full name and does not also open the control" and "the option two rows
  with full labels: every label whole, no ellipsis, no sideways scroll" (`ui.wall_phone_bar: labels`: two rows, 56 < height <= 120,
  each selected label measured whole inside its control, no ellipsis, touch-sized, inside the screen, the count still works).
- `frontend/tests/layout-dropdown-fit.spec.ts`: its mock sets `ui.wall_phone_bar: labels` - it is the label-fit guard of the
  labelled phone controls (the default icon row has no label to fit).
- New `frontend/tests/unit-wall-phone-bar-2401.spec.ts` (Node only, 16 tests) and
  `smplwise_vms/backend/tests/test_wall_phone_bar.py` (6 tests).
- `frontend/tests/visual-matrix.spec.ts-snapshots/live-wall-ready-{light,dark}-mobile-linux.png` re-taken (section 3).

## 3. Receipts

Merged `origin/main` (v2.40.0, `d6294fc51`: test-only gate fixes) into the branch at `5075df4bc` before the runner jobs.
Local: workstation, project `.venv` Python 3.12, Node 24.21.0; unit specs only with explicit file lists (`playwright.unit.config.ts`, no
browser). Runner: `private/runner/run_smart.py <job> pilot/WALL-PHONE-TOOLBAR-2401 ... --machine=runner`; before **every** job
`~/smplwise-results/gate_status.json` was `pass` (the 2.40.0 gate of `release/2400-train` ended 16:58 UTC; no runner job was started
while it ran - the local work was done meanwhile) and no `release_gate` process existed. `.tmp_*` in the runner worktree removed after
the runs.

| Check | Where / SHA | Result |
|---|---|---|
| Backend: `test_wall_phone_bar.py` (new) | workstation @ the first commit | **6 passed** |
| Backend: wall phone bar, ui settings, mobile options, xs options, timeline colors, ui tabs config, settings nav pref (7 files) | workstation @ `db2763350`, and again @ `5075df4bc` (merged tree; the backend is unchanged after it) | **70 passed** both |
| Unit: `unit-wall-phone-bar-2401` (new) | workstation | **16 passed** |
| Unit: 35 files (the new spec; token lint, design tokens x2, pending tokens, a11y x2, menu, RTL, white label, motion, phone buttons, dark beds, polish x4, uxrest x2, settings index / nav / rows, dropdown fit, multi-select, nav, empty-state icons, date format, page background, skincomp, wall count / grid / logic / arrangement, kiosk idle, glass wall, walk touch) | workstation @ `db2763350` (after fixing 2 token-lint findings of the first draft: badge font / radius literals) and @ `2d4ba79fa` | **271 passed** both |
| `npx tsc --noEmit -p tsconfig.json` | workstation @ `db2763350`, `5075df4bc`, `2d4ba79fa` | exit 0 |
| `scripts/release_check.py` | workstation @ `db2763350` / @ `2d4ba79fa` + this document | first: every item `[ok]` except the tag `v2.40.0` (not created yet, the gate was running); final: **every item `[ok]`** (incl. the tag `v2.40.0`), RESULT: ready for the owner's approval |
| Preview, desktop + tablet + mobile: `evidence-mobile-wall-kiosk`, `layout-dropdown-fit`, `wall-live-count`, `evidence-wall-phone`, `evidence-mobile-touch`, `layout-a11y-295`, `evidence-multi-nvr`, `evidence-multi-nvr-live`, `evidence-wall-live-cap`, `evidence-nvr-less`, `evidence-webrtc-first`, `evidence-kiosk`, `evidence-kiosk-polish`, `evidence-wall`, `dropdown-capsule`, `dropdown-styles`, `dropdown-styles-b`, `dropdown-phone-choice`, `dropdown-picker-choice` | runner @ `5075df4bc` | 380 passed, 189 skipped, **55 failed**: 52 = the five `dropdown-*` files import `/src/...` modules and need the Vite dev server (`spec` job), not a preview harness fault of this branch (they pass below); 3 = this branch (fixed in `2d4ba79fa`): the new spec expected "9 מצלמות" where the mock's 8 cameras make the stored 9 "all" (x2), and `layout-a11y-295:79` measured the icon key's select at 42 px (inside the key's 1 px border) |
| Preview, desktop + tablet + mobile: the 14 non-`dropdown-*` specs above | runner @ `2d4ba79fa` | **134 passed**, 172 skipped (project-scoped), 0 failed |
| `spec` job (Vite dev server), desktop + tablet + mobile: the 5 `dropdown-*` specs | runner @ `2d4ba79fa` | **301 passed**, 17 skipped, 0 failed |
| Pixel **without** refresh: all 25 `pixel-*` + `evidence-intercom-ops` + `evidence-wiskey-installer` + `evidence-wiskey-live-validation-2390` + `visual-matrix` + `evidence-replay-3d`, desktop + tablet + mobile | runner @ `2d4ba79fa` | 525 passed, 348 skipped, **3 failed**: `visual-matrix` live-wall ready light / dark [mobile] (the expected toolbar change, re-taken below) and `pixel-wiskey-stations:87` classic settings 1440 [desktop] (2 % - not touched by this branch: the same spec alone **8 passed** on this branch @ `2d4ba79fa` and on main @ `d6294fc51`; a load flake of the 30-spec run) |
| Re-take `--update-snapshots=changed`: `visual-matrix -g live-wall`, mobile | runner @ `2d4ba79fa` | 2 passed; **2 PNG written** (reviewed below, committed with this document) |

**Baseline review (2 PNG: `visual-matrix.spec.ts-snapshots/live-wall-ready-{light,dark}-mobile-linux.png`).** The demo-mode wall at
390 x 844. Old and new were compared by script (bounding box of pixels differing by more than 16 levels) and side by side. Unchanged:
everything above y 144 (shell tabs, the page heading and subheading) and the bottom navigation. Changed: the toolbar - the old two
rows (quality and count as labelled selects, the kiosk button alone on a second row) became one row of three icon keys (quality,
count with the badge "4", kiosk). Below it the wall content is the same image moved up 46 px (old y 250-520 equals new y 204-474 except
6 / 9 anti-aliased pixels at the tiles' top edge), because the toolbar is 46 px shorter. Nothing else moved or changed.

## 4. NOT_RUN and known limits

- **Real phones:** not run on a physical Android / iOS phone. The long press was verified with Playwright's mouse on the Pixel 7
  profile (touch emulation) for the columns dropdown and the kiosk key. On a native select, a phone may open its own picker when the
  finger lifts after a long press even though the click is swallowed (Android Chrome / iOS Safari open a select on touch, not on the
  DOM click); the name bubble still shows during the hold. Not verified on a device.
- **Live installation / lab HA:** not run (no device access needed; the setting is UI only).
- **The full Playwright suite / release gate:** not run on this branch (only the specs listed above). Unit specs: the 35 files above,
  not all 430+ `unit-*` files.
- **Backend:** only the 7 settings files above, not the whole suite.
- **Capsule style / size dial in the icon row:** the CSS sizes (46 / 44 / 48 px) are unit-asserted; no browser spec drives the icon row
  in the capsule style or at the sm / lg dial (`layout-dropdown-fit` covers the capsule style in the labels mode only).
- **Dark / skins:** the icon row in the bubble / crystal / other skins is covered only by `visual-matrix` (classic light / dark, demo
  mode) - no per-skin pixel baseline of the phone wall exists.
- `GUIDE_ALL_HE.html` not regenerated (section 2.1).
- No version bump, no tag, no merge (2.40.1 is the coordinator's).

## 5. Rollback

Revert the branch's commits. The setting has no migration: a stored `ui.wall_phone_bar` row stays in `settings` and is ignored by an
older build (unknown keys are not read); the older build shows the two-row toolbar.
