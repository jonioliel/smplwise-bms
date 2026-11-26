# MEDIUM-REST-2540 - the rest of the medium screen findings (SCR-17, SCR-26, SCR-27, SCR-30, SCR-31) and the wall display's new-build notice

Target 2.54. Base `origin/pilot/HONEST-STATES-2540` at `3e73e2d00` (it owns `home/sw-home.ts`; building on it avoids a conflict).
Branch `pilot/MEDIUM-REST-2540`. Findings: `docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (origin/review/DEEP-2520-FRONTEND-SCREENS),
index `docs/review/DEEP-REVIEW-2520-INDEX.md` (origin/chore/REVIEW-FINDINGS-INDEX-2530): all five OPEN, and confirmed still present in the
code at the base before the change (the new tests fail there - "Before / after").

## What and why

### SCR-17 - the floor map's action arguments
- Typed values were keyed by the action id only (`climate.set_temperature:temperature`): +/- on thermostat A was shown and sent for
  thermostat B. Every argument was always sent, so a light turned on from the map (the room card's switch, the card's "הדלקה") always got a
  brightness - 100 % for a light that was off - and lost its own dim level (rule SWITCH-LIGHT-DIMMER-2331).
- New `screens/map-action-args.ts`: a value is keyed by entity + action + argument (`argKey`); `argsToSend` sends a typed value as typed,
  a REQUIRED argument's default when nothing was typed, and leaves an untyped OPTIONAL argument out (`light.turn_on`: brightness_pct,
  color_temp_kelvin, transition; `fan.turn_on`: percentage - the bridge's optional arguments). An empty / broken number is not sent.
- `explore-floor-map.ts`: `argsFor`, `renderArg` and the room card's `onRoomAction` use it; the typed values are cleared when the
  selection changes (a pending confirmation keeps its own entity's values). The confirm dialogs of PHYSICAL-CONFIRM-2540 are not touched.
- Known limit: the map card's number field still SHOWS 100 for a light that is off (the default it shows); it is no longer sent unless
  the person types a value.

### SCR-26 - the walls read their cameras once; the kiosk's system tile
- `screens/wall-refresh.ts` (new): `CAMERA_REFRESH_MS` = 60 s (as the live overview), `mergeById` (an unchanged camera keeps its object, an
  unchanged list keeps its array - no tile or player is touched), `systemTile`.
- `kiosk-wall.ts` and `live-wall.ts`: re-read `listCameras()` through `PollController` (visible page only, never two reads at once) and
  merge by id; only the list - the layout, count and settings stay as the person has them. The all-cameras wall skips the read while its
  arrangement dialog is open. A failed read keeps what is shown.
- The kiosk's 4th counter said "פעיל · go2rtc + NVR" whatever the health said (and named vendor components). It now follows the health
  summary the header pill already reads: "תקין" (green) / "לתשומת לב" / "שגיאה" (red) / "לא מוגדר" / "אין קשר" (red, the server is
  lost) / "—" (not read yet), label "מצב מערכת". Demo mode unchanged.

### SCR-27 - before -> after shown backwards
- `i18n/bidi.ts`: `changeArrow()` (Hebrew "←", English "→": the arrow points from the value read first to the value read second) and
  `changeText(from, to)` (each value in a first-strong isolate).
- `live-camera.ts` motion-detection confirmation: sensitivity and on/off use `changeText` (was "${old} → ${new}" inside a Hebrew line:
  40 -> 60 read "60 → 40"; "פעיל → כבוי" pointed at the old value). The line-crossing direction is words now: "משמאל לימין" / "מימין
  לשמאל" (was "שמאל → ימין", an arrow between two Hebrew words). The HONEST-STATES-2540 OSD switch change on this file is kept.
- `nvr-confirm.ts`, `nvr-encoding-batch.ts`, `nvr-camera-editor.ts`: the fixed "←" (correct in Hebrew, "to ← from" in English) is
  `changeArrow()`.
- English: "Left to right" / "Right to left"; the four arrow texts left the English pack (no longer used).

### SCR-30 - the home's push refresh
- `home/home-refresh.ts` (new):
  - `PushRefresh`: the 600 ms quiet period with a maximum wait of 2 s (a burst of pushes refreshes at most 2 s after its first push; it
    never fired while pushes kept coming, the post-command refresh included); never two overview reads at once - a refresh due while one
    runs runs once after it.
  - `homeDraws`: only a push of what the overview draws asks for a refresh - lights, switches, climate, covers, locks, the weather, a
    room's temperature sensor and a door / window contact (the open count). A power meter, a motion sensor or a media player does not.
  - `keepLocal`: a device with this person's command in flight, or sent after the read started, keeps the object the screen shows.
- `home/home-actions.ts`: `localIds(since)` - the devices held by a command (every `run()` until `runCommand` settles; a dimmer drag
  until its last value settles; the bulk "lights off" for its lights), each hold at most 20 s (a superseded command never settles).
- `home/sw-home.ts`: uses all of it, plus a sequence guard in `loadOverview` (an answer that is not the newest read is dropped).

### SCR-31 - +/- on an A/C that is off (decision: turn it on)
- `a_temp` set the optimistic mode BEFORE `setTarget`, so `setTarget`'s `if (z.mode === 'off')` never ran: only the setpoint was sent,
  the tile showed the unit on and flipped back to off on the next refresh.
- Decision (the recommended honest behaviour): +/- on a unit that is off TURNS IT ON with the new target - `climate.set_hvac_mode` with
  `onModeFor(z)` (cool when the unit offers it, else its first mode other than off), then `climate.set_temperature`. The climate entity
  supports it when its `hvac_modes` list has a mode other than off (the overview's default list when the unit does not report one is
  off / cool / heat / auto). A unit that offers only "off" says so ("{name} כבוי ואי אפשר להדליק אותו מכאן.") and nothing is sent.
  `setTarget(z, target, wasOff)` takes the "off" read before the optimistic change; the screen shows the same mode it sends (it showed
  "auto" while "heat" might be sent).
- Found on the way, same cause (fixed here, same file): "room off" / "house off" set the lights and the A/C to off on screen and THEN
  asked `lightsOff` / `climateOff` what was on - the A/C was never turned off by "room off" (any user), and without the bulk route (no
  `devices.control_bulk`, or "all buildings") no light was sent either. The lights and zones that are on are now read first.

### The wall display after an add-on update
- CLIENT-RESILIENCE-2540 gives the main application an update card from the `/me/ws` hello frame. The wall display (`wall/sw-wall.ts`) does
  not use that socket; done here WITHOUT touching that row's files: the wall already reads `/health/summary` every 60 s, whose `version`
  is the add-on version (= `__ARX_BUILD__` of the bundle). `wall-logic.ts` `newBuildAvailable(server, own)` - the same rule as the main
  app's `noteServerBuild` (no version, a development build, the same version: nothing) and both must read as a release version (a test
  backend's "test" is not one). Another release shows a quiet chip at the bottom, "גרסה חדשה של Arx זמינה · רענון" (the main card's own
  texts, already translated); a tap reloads. Nothing reloads by itself (owner rule: today's behaviour plus a quiet notice).

## Files
- `frontend/src/screens/map-action-args.ts` (new), `screens/explore-floor-map.ts`
- `frontend/src/screens/wall-refresh.ts` (new), `screens/kiosk-wall.ts`, `screens/live-wall.ts`
- `frontend/src/i18n/bidi.ts`, `screens/live-camera.ts`, `screens/nvr-confirm.ts`, `screens/nvr-encoding-batch.ts`, `screens/nvr-camera-editor.ts`
- `frontend/src/home/home-refresh.ts` (new), `home/home-actions.ts`, `home/sw-home.ts`
- `frontend/src/wall/wall-logic.ts`, `wall/sw-wall.ts`
- English: `i18n/lang/en/i18n/msg/live.ts`, `media.ts`, `home.ts`
- Tests: `frontend/tests/unit-medium-rest-2540.spec.ts`, `evidence-medium-rest-2540.spec.ts`, `pixel-medium-rest-2540.spec.ts` (+ Linux
  baselines), `medium-rest-2540-mocks.ts`, `medium-rest-2540-shots.spec.ts` (compare captures, not a gate)
- Shared with other 2.54 rows: `sw-home.ts` (HONEST-STATES-2540 - this branch is built on it), `live-camera.ts` (HONEST-STATES-2540's OSD
  switches kept), `explore-floor-map.ts` (PHYSICAL-CONFIRM-2540 / LISTENER-DEADLINE-2540 change the two confirm dialogs' footers only -
  different lines), `i18n/lang/en/i18n/msg/home.ts` (appended at the end, as the others).

## Tests

All on the Linux runner (slot B, `~/work/p2520_mediumrest_all.sh` = `p2520_mediumrest_run.sh` at 36ebc0551, then
`p2520_mediumrest_run2.sh` at 278951603), mocked backends only. PC: one unit file at a time.

| Check | Command | Exit | Result |
|---|---|---|---|
| build (tsc + vite) | `npm run build` (36ebc0551; `vite build` again at 278951603) | 0 | - |
| typecheck tests + scripts | `npm run typecheck` | 0 | - |
| lint | `npx eslint src --pass-on-unpruned-suppressions` | 0 | - |
| design ratchet | `python scripts/design_ratchet.py` | 0 | no count above the baseline |
| unused exports | `node scripts/unused-exports.mjs --enforce` | 0 | first PC run failed on two new file-local exports (`pageRtl`, `SystemTone`); `export` dropped; then OK on PC and runner |
| unit | `playwright -c playwright.unit.config.ts` unit-medium-rest-2540 + unit-home-simple-logic, -uxfix-rtl, -poll-controller, -poll-screens-b-2440, -fe-nits-2442, -video-2403, -swlogo-295, -no-ha-branding-2443, -i18n-home, -i18n-lang-packs-2443, -i18n-en-ratchet-2490, -i18n-core, -honest-states-2540, -overlay-fade-2520, -lead-reserve | 0 | 165 passed |
| unit (PC) | unit-medium-rest-2540 / unit-home-simple-logic / unit-uxfix-rtl, one file each | 0 | 21 / 9 / 14 passed |
| behaviour, run 1 (36ebc0551) | `evidence-medium-rest-2540.spec.ts --project=desktop` | 1 | 7 passed, 4 failed: "room off" sent no `climate.turn_off` (a real bug: `climateOff` filtered on the mode the screen had already set to off - fixed in 278951603), the English case reloaded to Hebrew (the mock's `ui.lang`), the two wall-display cases ran on a computer (the mock needs the emulated tablet) - harness fixed |
| behaviour, run 2 (278951603) | the same | 0 | 11 passed |
| home regression | evidence-honest-states-2540, home-simple-2420, home-simple-2421, home-v3-p1, home-wall-night-2500, desktop + mobile | 0 | 63 passed, 55 skipped (their own project skips) |
| walls regression | evidence-wall-answers-2400, evidence-kiosk-polish, evidence-nvr-encoding-batch, evidence-wall-followups-2390, pixel-wall-followups-2390, pixel-wall-plan, desktop + mobile | 0 | 63 passed, 49 skipped - the existing wall pixels are unchanged (their mocks report version "test": no notice) |
| new pixel baselines | `pixel-medium-rest-2540.spec.ts --project=desktop --project=mobile --update-snapshots`, then compare | 0 / 0 | 5 written, 1 skipped (the wall case is desktop-only); 5 passed against them |
| compare captures | `medium-rest-2540-shots.spec.ts` SW_SHOTS=1, base build (before) and branch (after) | 0 / 0 | 9 + 9 pictures: `private/planning/medium_rest_2540_compare_2026-11-26.html` |

### Before / after (the new tests on the base build 3e73e2d00, the branch's test files copied in)

- `unit-medium-rest-2540.spec.ts`: exit 1 - the modules it tests do not exist at the base (`Cannot find module .../screens/map-action-args`);
  21 passed on the branch.
- `evidence-medium-rest-2540.spec.ts`: exit 1, **10 failed, 1 passed** at the base; **11 passed** on the branch. The one that passes at
  the base is the negative control ("the same release shows nothing"). The two motion cases fail at the base on the missing
  `data-motion-change` marker (the line had no isolated pair), not on the measured arrow direction; the arrow geometry is measured on the
  branch (Hebrew and English).
- SCR-17 has no browser case (the map needs the full floor bundle): its rules are unit-tested (`argsToSend`) and its wiring is checked in
  the source by the unit spec.

NOT_RUN: the full release gate; the other screens that use the three recorder dialogs in English (covered by the source check only); the
floor map in a browser (SCR-17); the lab (forbidden for this row).

## Open questions

1. The wall display's "new version" chip sits at the bottom centre, where the 3 s "ההגדרות עודכנו" flash already appears, and it stays
   until a refresh - on a 2x2 tablet wall it can cover part of a camera's name. (a) keep it there (recommended: one place for the wall's
   notices, small and quiet); (b) move it into the top strip next to the health chip.
2. Should an unattended wall display refresh itself after an update? (a) no - a quiet notice only, as the main app (recommended, the
   owner's rule); (b) a setting "refresh by itself at night after an update", default off.
3. The map card's brightness field still shows 100 for a light that is off (nothing is sent unless typed). (a) leave it (recommended);
   (b) show the field empty with a hint "הרמה האחרונה".
