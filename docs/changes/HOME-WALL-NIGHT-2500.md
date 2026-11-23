# HOME-WALL-NIGHT-2500 - wall panel: rest screen, night mode (dim only) and screen takeover

Branch `pilot/HOME-WALL-NIGHT-2500` from `main` 619f94d04 (v2.47.0). Owner decisions 22.11 on the home interface, part B
(`private/planning/questions_all_open_2026-11-22.html`, Q70-Q79, all answered "the recommendation"); this row builds four of them:

| Q | Question | Answer built |
|---|---|---|
| Q70 | Rest screen on the wall panel? | On by default, after 2 minutes without a touch (settable). Time, weather, what is on today, doors and alarm. The first touch only wakes. |
| Q71 | Night mode? | Fixed hours 23:00-06:00, editable. |
| Q73 | Tablet lighting at night? | Only dim the screen - a layer the page draws, works on every tablet; no backlight / device API. |
| Q74 | Screen takeover? | The alarm and an urgent notice. A door call always comes first. |

Q72 ("קראתי" on a shared wall), Q75-Q79 are other rows and were not touched. No version bump, no CHANGELOG edit, API inventory not
regenerated (the release bump does it). No migration: the settings are rows of the existing `settings` table. Nothing in `secrets/`,
the lab, `management/*.json`, main, tags or the `addon` branch was touched.

## What changed

### Where it lives (existing code, integrated)

A wall panel is the existing per-person policy `kiosk` (HOME-SIMPLE-2420/2421: a person locked to the home interface and to one room;
`sw-home-admin.ts` "מצב מסך קיר"). The rest machine reuses the plan kiosk's idle state machine (`frontend/src/map/kiosk-idle.ts`,
`KioskIdle`, CR-029 S5-B) unchanged. The rest screen's facts come from what the room screen already holds: the overview weather, the
calendar module's "next event" line (`home-calendar.ts` tile), `doorsText` of the doors, `alarmWord` of the first alarm panel. The
takeover reads the existing `GET /alarm/panels` and `GET /notices`; the door call is the existing `sw-home-call` (HOME-SIMPLE-2420).

### Frontend

* `frontend/src/home/wall-rest-logic.ts` (new, pure, no DOM): `wallSettings()` (normalises the policy's `wall` block; a missing or
  unknown value takes the default, so a 2.47 server gives the owner's defaults), `inWindow` / `localMinutes` / `isNight` (the window may
  cross midnight; start == end = no window; local time by the IANA zone `Asia/Jerusalem`, never a fixed offset), `dimOpacity`,
  `takeoverFor()` and the `WallRest` class (KioskIdle with `wakeOnChange: false` - an automation switching a light does not light the
  wall up - plus holds: a ringing call, a takeover on screen). Clock and timers injected.
* `frontend/src/home/home-wall-rest.ts` (new): `WallPanel`, the glue to `<sw-home>`: touches / keys / wheel on the host keep the panel
  awake; the board is read every minute (and once the person's features arrive) while urgent notices may take over; the alarm panels are
  re-read on a pushed `alarm_control_panel.*` change (debounced 400 ms) and every minute; the three layers are drawn:
  * **rest screen** (`[data-wall-rest]`, z 50): date, a large clock, weather, pills for today / doors / alarm, "נגיעה מעירה את המסך".
    The touch that wakes it is consumed by the layer (`click` on the layer, after the finger lifted - no ghost click reaches the control
    underneath). One fixed screen, no scroll.
  * **takeover** (`[data-wall-takeover="alarm|notice"]`, z 55, `role="alertdialog"`): the alarm when `triggered` (sounding) or `pending`
    (entry delay: enter the code at the keypad), with up to three open sensors; an urgent notice (`severity` `critical` / `urgent`,
    published within the last 48 hours, not ended), newest first. "הבנתי" hides that alarm episode (panel + state + last change: a new
    change shows again) or that notice on this panel (kept in `localStorage` `arx-wall-seen`, last 60); "ללוח ההודעות" opens the board.
    The takeover wakes the panel and holds it awake; no dim under it. No disarm button: a locked wall panel has no alarm screen today,
    and adding one is not part of the answer.
  * **night layer** (`[data-wall-dim]`, z 70, `pointer-events: none`): black at the chosen opacity on an idle panel at night (soft 0.5 /
    medium 0.68 / strong 0.82), 40 % of that while someone uses it (0.2 / 0.27 / 0.33), 0 by day or under a takeover or a call. With the
    rest screen switched off, an idle panel at night gets a transparent catcher (`.wcatch`) so its first touch also only wakes.
  * **door call first**: a visible ringing call (`ringing > waiting` from `sw-home-call`) holds the panel awake, and no takeover is drawn
    while it rings; the takeover appears when the call ends.
* `frontend/src/home/home-wall-rest-styles.ts` (new): the layers' styles, theme tokens only (all seven themes), reduced motion honoured.
* `frontend/src/home/sw-home.ts`: five hooks only (construct, connect / disconnect, `willUpdate` sync, HA push forward, render + call
  state) - kept small because `pilot/CR-HOME-V3-SEGMENTS-2470` also edits this file.
* `frontend/src/home/sw-home-admin.ts`: a fourth sub-tab **"מסכי קיר"** in משתמשים והרשאות › ממשק ביתי, drawn in this tab's own look
  (cards, switch rows, option lists): rest screen on / off, after 1 / 2 / 5 / 10 / 15 minutes (`sw-segmented`), night mode on / off, the
  two hours (`input type=time`), the dim (soft / medium / strong), takeover (alarm + urgent notice / alarm only / door call only, as
  before). `saveInstall` takes the saved message, and clears an old error.
* `frontend/src/i18n/lang/en/i18n/msg/home.ts`: 39 English texts (unit-i18n-home keeps the table complete).

### Backend

* `services/home_interface.py`: `INSTALL_VALUES` gains `wall_rest` (on/off), `wall_rest_after` ("2","1","5","10","15"), `wall_night`
  (on/off), `wall_night_dim` (medium/soft/strong), `wall_takeover` (alarm_urgent/alarm/call_only) - first value = default; new
  `INSTALL_TIMES` `wall_night_start` / `wall_night_end` (HH:MM, defaults 23:00 / 06:00; a stored value that is not a time reads as the
  default; a PUT with one is 422). `wall_settings()` and the policy's new `wall` block (`effective()`), so the panel needs no admin read.
* `routers/home_interface.py`: `InstallBody` accepts the seven keys (Literal / HH:MM pattern). Same route, same `rbac.assign`, same audit
  row `home_interface.settings.set` (before / after).
* `wire/home_interface.py`: `HomeWallSettings`, `HomePolicy.wall`, `HomeInstallSettings` + seven fields. `frontend/src/api/generated/
  wire-home-interface.ts` and `wire-me.ts` regenerated (`scripts/gen_wire_types.py`).

## Tests

| Command | Where | Result |
|---|---|---|
| `pytest tests/test_home_interface.py` (2 new: defaults reach the panel; change + validate + audit + bad stored value; 1 assertion extended) | PC | see the closing report of the branch commit |
| `npx playwright test -c playwright.unit.config.ts tests/unit-home-wall-night-2500.spec.ts tests/unit-kiosk-idle.spec.ts` (15 new, fake clock) | PC | 29 passed |
| `npx playwright test -c playwright.unit.config.ts tests/unit-i18n-home.spec.ts` | PC | 6 passed |
| `npx playwright test tests/home-wall-night-2500.spec.ts --project=desktop` (8 new, mocked backend, installed page clock) | PC | see the closing report |
| `npx tsc --noEmit`, `eslint` on the changed sources | PC | clean |

The browser spec: the rest screen after exactly 2 minutes with its pills, no scroll, the first touch on top of a light switches nothing and
the second does; night dim 0.27 in use / 0.68 at rest; settings (rest off, 1 minute, strong, 22:00-07:00) reach the panel; a sounding
alarm takes over a resting night panel (dim 0) and "הבנתי" gives it back; an urgent notice takes over once per panel and not with
"alarm only" / "door call only"; a door call wakes the rest screen and hides the takeover until it ends; a non-wall person sees nothing;
the settings tab sends the five PUTs.

Captures (evidence, not a gate): `tests/home-wall-night-2500-shots.spec.ts` (`SW_SHOTS=1`, `SW_SHOTS_PHASE=before|after`) ran against a
build of 619f94d04 (before) and of this branch (after), wall 1280x800 and tablet 1024x768, day / night, awake / rest, plus the two
takeovers. Owner page: `private/planning/home_wall_night_2500_compare_2026-11-23.html` (local, not in Git).

## Known limits

* The settings are per installation, not per panel. A home with two wall panels that want different night hours needs a per-panel row
  (not asked).
* Night is by fixed hours only (Q71 answer); sunset / sunrise was the other option and is not built.
* The rest screen and night apply only to a person whose policy is a wall panel; a family tablet that is not set as a wall panel keeps
  the 2.47 behaviour.
* A panel takes new settings when it reloads its policy (page load / the home data reload), not live.
* "Urgent" = the notice board's `critical` (and `urgent`) severity. Notices are read every minute, so an urgent notice can take up to a
  minute to appear (the alarm also comes on its pushed state change at once).
* Real tablets were not tried: the dim is CSS only, so a kiosk browser that keeps its own backlight at full still glows; Q73's other
  option (backlight through the kiosk app) is not built.

## Rollback

Revert the branch commits. The seven settings rows (`home.wall_*`) stay in the `settings` table and are ignored by older code.
