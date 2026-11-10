# HOME-SIMPLE-2420 - the home interface (task T120)

Branch `pilot/HOME-SIMPLE-2420` from `origin/main` f5a951a0a (v2.41.2). Owner request 2026-11-10: a second, simpler, room-centred
"home interface" next to the full one; the administrator chooses the interface per person, with a switch, and a person may be limited
to the home interface only. "Under lighting we have both switches and lights." The spec is the approved round-25 mockup
`private/design-system-2026-10-27/round25/home-simple-v2/` (app.html, home.js, data.js, home.css, v2.css, themes.css,
research/CONTROL4_UI_NOTES.md) plus the lead's defaults (switch rules, themes) of 2026-11-10. Nothing in `private/` was edited.

## What was built

### Slice 1 - backend (commit 30cba2c1d, plus the weather line in the slice 2-6 commit)

* Migration `0211_home_interface.sql`: `home_interface_policy` (default interface, may switch, home only, wall panel + its room,
  visible rooms / categories, the person's last choice), `home_user_prefs` (favourites per room, layout: favourite rooms, hidden rooms,
  what opens first, theme, scheme, big text, welcomed), `home_favourites_seed` (the administrator's starting favourites). Every user
  known at upgrade time gets an explicit `full` row, so the upgrade moves nobody; people who arrive later get the defaults.
* `services/home_interface.py`: defaults (home for a regular user, full for an administrator = system_admin or system.configure),
  `enforce()` called from `auth._principal` on every authenticated request (the presence gate's pattern): a home-only person reaches
  only the home interface's API areas (`HOME_ALLOWED_EXACT` / `HOME_ALLOWED_PREFIXES`, whole-segment matching, administrative leaves
  such as `/device-type`, `/bulk-protected` refused inside allowed prefixes); anything else is 403 `home_interface_only`, audited once per
  person per 5 minutes. It is a restriction on top of the role model and never grants anything: every allowed route still checks its own
  permission. A system administrator can never be made home-only (refused on write, ignored on enforce). HA users are not touched.
* `routers/home_interface.py` (tag `home`): `GET /home/interface`, `PUT /me/interface` (403 `interface_locked` when the policy says no,
  audited), `GET /home/overview` (floors -> rooms with lights + light-typed switches, the other on/off switches with their protection,
  climate, shutters (door/gate covers excluded), locks; filtered by the policy's rooms and categories; the same visible entity set and
  `can_control` as the devices routes; the outside weather line), `GET/PUT /home/prefs` (the caller's own row only),
  `GET /home/policies`, `PUT /home/policies/{user_id}`, `PUT /home/seed`, `PUT /home/kiosk-code` (all `rbac.assign`, audited; the code
  is stored as a salted PBKDF2 hash, never logged), `POST /home/kiosk/exit` (5 tries per 5 minutes, then 429; audited).
* `GET /me` carries `interface`. Backup: `home_interface_policy` in ACCESS_TABLES, the other two in PROJECT_TABLES.

### Slices 2-6 - frontend (one commit; the slices were built together because the shell, the screens and the controls share one element)

* Routing: a new top-level route family `#/home/...` (`router.ts` mode `home`), rendered by `sw-app` as its own full-screen shell
  (no rail / tabs), with the existing `<sw-incoming-call>` banner on top. A person whose interface is `home` lands there from a default
  address; a home-only person is sent back to `#/home` from any full-interface address (`enforceHome`, next to `enforceKiosk`).
* Switch: the personal menu of the full interface has "לממשק הביתי" (shown when `may_switch`; remembered with `PUT /me/interface`);
  the home interface's own menu has the interface choice (disabled with "הממשק נקבע על ידי מנהל הבית" when locked). First visit of a
  person who may switch shows the mockup's welcome choice.
* Administrator page: user management > tab "ממשק ביתי" (`sw-home-admin`, `rbac.assign`): per person default interface, may switch,
  home only, wall panel + room, visible categories, visible rooms; the wall panels' exit code; "העתק את המועדפים שלי" as the starting set.
* Home interface (`frontend/src/home/`): `sw-home.ts` (shell + screens + overlays), `home-api.ts` (reads + view model),
  `home-actions.ts` (controls), `home-logic.ts` (words, paging, default favourites; unit-tested), `home-icons.ts` (the mockup's own icon
  set), `home-styles.ts` (GENERATED from home.css + v2.css + themes.css by a mechanical port: scoped to the shadow root, `--sw-*` -> `--hs-*`,
  the full-interface frame and the dev bar dropped), `home-styles-extra.ts` (product-only additions).
* Themes: all 7 (classic, ocean, sand, plum, midnight dark-only, nordic, pastel) x dark/light, as `data-hs-theme` + `data-hs-scheme` on
  the host; per person (`layout.theme` / `layout.scheme`), picker in settings > "ערכות נושא"; `--hs-on-accent` honoured.

## Control paths (no new control route)

| What | Path |
|---|---|
| Light on/off, dimmer | `POST /ha/entities/{id}/actions` `light.turn_on` (`brightness_pct`) / `light.turn_off` via `api/device-commands.runCommand` / `debouncedCommand` |
| Light switch, non-light switch | `switch.turn_on` / `switch.turn_off`, same route |
| Room / house off | lights: bulk `lights_off` (preview + run, `devices.control_bulk`) where the person may run bulk actions, else one `turn_off` per lit light; climate: `climate.turn_off` per running A/C. Never a non-light switch (lights_off reaches lights and light-typed switches only; checked in `test_home_interface.py` against the bulk preview, and by the unit spec on the source) |
| Climate | `climate.set_temperature`, `climate.set_hvac_mode`, `climate.turn_off` |
| Shutters | `cover.open_cover` / `close_cover` with the movement confirmation the server asks for (second tap), `cover.stop_cover` at once |
| Door | confirmation sheet, then `lock.unlock` with `confirmation_grant: confirmed` -> the door authority path (`open_from_tile`), its permission and audit; a WisKey door is never locked from here |
| Intercom call | the existing `<sw-incoming-call>` banner (answer / talk / open, its own confirmation and permission) |
| Scenes | `POST /automations/scene/{id}/apply` (sensitive scenes ask first) |
| Alarm | `POST /alarm/panels/{id}/actions` with the confirmation, and the code prompt the panel asks for |
| Alerts | `POST /notifications/{id}/ack` |

## Switch rules (lead defaults 2026-11-10, reusing the existing classification)

* Arx already classifies switches: an administrator's device type `light` (Settings > device types, `device_type_override`) makes a
  switch a light (counted, in the lights list, reached by `lights_off`); everything else stays a non-light switch. Protection (Settings >
  protected switches, `device_bulk_protected` / approved suggestions by category: boiler, fridge, pump, ...) marks a switch guarded.
  Both are suggest-then-admin-confirms and default safe (a switch is not a light and not reached by any off sweep unless typed so).
  No new per-switch setting was added.
* Lighting category: dimmable light = bulb + dimmer + %; light switch = rocker + on/off + "מפסק, בלי עמעום"; non-light switches in their
  own "מפסקים" tab ("לא נכבה ב\"כיבוי הכל\""), guarded ones ask before turning off even by hand; the toast of every off sweep says what
  stayed on; "פעיל עכשיו" ends with the row of non-light switches that are on; the master dimmer moves dimmable lights only, 0 also turns
  light switches off; a room with only switches has no master dimmer; a favourite switch is a small on/off tile with no resize.

## Built / not built against the mockup

| Mockup element | Status | Notes |
|---|---|---|
| Strip: back, room name = room picker, favourite-room arrows + dots, clock, date, weather, doors pill, alerts bell + count, avatar menu | built | weather from the first available weather entity (none = no weather line) |
| Strip: "מחכים בדלת" pending-call pill | not built | the existing call banner shows the call; an ignored call is in "מי הגיע" |
| Side navigation (הבית שלי, סצנות, פעיל עכשיו, התראות, הגדרות), phone bottom bar | built | items hidden when the category is off for the person |
| "Now" bar: room / house text, active room chips, master dimmer, room off / house off | built | |
| Swipe between favourite rooms; long press = add to favourites | built | not tried on a real tablet / phone |
| Toasts with undo | built | undo restores the lights that were on (re-sent as commands) |
| Room screen: category row (up to 8) | built | categories: תאורה, אקלים, תריסים, דלתות, מצלמות, אינטרקום, חשמל, סצנות, אבטחה (alarm, when a panel exists) |
| Favourite widgets: scene, light (small / wide with dimmer), switch, climate, camera (live), door, shutter, all lights, energy | built | room scenes = scenes whose only area is the room |
| Edit mode: move, resize light, remove; paging | built | arrows, as the mockup (no drag) |
| Rooms: floors in columns (tablet / desktop), floor tabs (phone), room lamp, hearts | built | |
| Lighting: lights / switches / scenes tabs, room-floor-house scope, all / on filter, turn all off, stars, paging | built | |
| Climate: dial, up / down, presets, modes, zone list, phone zone sheet | built | presets are Arx values (23 / 26 / 22) clamped to the device's range; modes = the device's own |
| Climate: "החזק כך" (hold) | not built | no generic platform concept to map it to |
| Shutters: open / stop / close, open all / close all, open filter | built | open / close need a second tap (the server's movement confirmation); "all" asks once |
| Doors: list, open with confirmation, lock, not-locked filter | built | |
| Doors: "דבר עם הכניסה", "הדגמה" | not built | outgoing talk is not offered without a call; the demo button is mockup-only |
| "מי הגיע" visitors | built (partly) | from the intercom call log (station, time, who answered / opened); no picture - the log keeps no frames |
| Intercom call overlay (ring, answer, talk, open + confirm, opened, ignore) | built differently | the existing `sw-incoming-call` banner (its paths, permissions, audit) instead of the mockup's full-screen overlay |
| Cameras: grid, room / house, offline state, full screen with previous / next | built | grid = refreshed stills, full screen and the favourite = live (`sw-camera-tile`) |
| Energy: today / week, chart with the usual line, tooltip, by room | built | usual = mean of the 7 days before (hourly) / 4 weeks before (daily), up to 12 meters; by room = meters by area |
| Energy: "בערך ₪" cost | not built | the tariffs need energy.bills / energy.manage, which a family member does not hold |
| Alerts: waiting / all, acknowledge, done | built | the mockup's custom actions ("כבה את הדוד") are not offered: the notification carries no such action |
| Scenes: home + room scenes, one tap | built | no "active scene" highlight (the platform has no such state) |
| Active now + non-light switches row + house off | built | |
| Settings: favourites, rooms (heart + show), themes, view (interface choice, what opens first, theme, big text) | built | |
| Settings: scenes + the simplified scene edit dialog | partly | the list is built; editing is for administrators only and opens the full scene editor (the platform's scenes are captured states, not the dialog's abstract options) |
| Welcome choice | built | shown once to a person who may switch |
| Personal menu: interface choice, my settings, light / dark | built | "החלף משתמש" not built (sign-in belongs to the home system) |
| Full-interface admin page (users, default, may switch, wall panel, categories, rooms) | built | in user management (product components), plus exit code and starting favourites |
| Wall panel locked to its room, no personal menu, exit | built | exit: long press on the clock, the administrator's code, 5 minutes |
| Media, per-room wallpaper | not built | decision (no media module; calm screen) |
| Dev data toggle (demo / worst / empty) | not applicable | mockup tool; the specs use mocked datasets |

## Tests (run locally, 2026-11-10)

| Command | Exit | Result |
|---|---|---|
| `pytest tests/test_home_interface.py` | 0 | 15 passed |
| `pytest tests/test_backup.py tests/test_backup_sensitive.py tests/test_body_limit.py tests/test_me_permissions.py tests/test_migrations.py tests/test_migrations_263_upgrade.py tests/test_rbac_matrix.py tests/test_user_prefs.py tests/test_devices.py tests/test_presence*.py tests/test_home_interface.py` | 0 | all passed (the -q addopts prints no summary; exit 0, no F/E) |
| `npx tsc --noEmit` | 0 | clean |
| `npx playwright test -c playwright.unit.config.ts tests/unit-home-simple-logic.spec.ts` | 0 | 6 passed |
| `npx playwright test tests/home-simple-2420.spec.ts --project=desktop` | see below | 3 size sweeps (18 screens each: no scroll, scrollTop 0, RTL, >= 56 px targets on the tablet / 44 on the phone, no forbidden words) + behaviour + admin |
| `python scripts/gate/lint_spec_waits.py frontend/tests/home-simple-2420.spec.ts` | 0 | 0 findings |
| `node scripts/lazy-tags-check.mjs` | 0 | OK |

The final counts of the last runs are in the report to the lead. NOT_RUN: the full backend suite, the full Playwright suite and the
pixel baselines (runner, via the lead); any live run against the lab; real tablet / phone.

## Design skills (SKILLS_BRIEF.md)

Evidence in `docs/changes/evidence/HOME-SIMPLE-2420/inspect/`:
* `ui-ux-pro-max.txt` - design-system and UX searches. Taken: large targets, paging over scrolling, status colour only for state. Rejected:
  its landing-page pattern and green accent (green is status only).
* `taste-lint.txt` - 0 FAIL, 16 WARN: shadows are on sheets / toasts / the switch thumb (real overlays, kept); "unlock" is an icon name
  (false positive); padStart builds the hour labels of the chart (kept); the em dashes are the "no value" placeholder of a number (kept).
* `impeccable-detect-source.txt` - the detector on the sources returned no findings. The URL detector was not run: the home interface
  needs a backend (the specs mock it inside Playwright) and the detector does not pierce shadow DOM.
* Not re-run: the motion skills and the dataviz palette validation - motion and colours are a 1:1 port of the approved mockup, which ran
  them (its own inspect/ folder, themes-contrast.txt). `review-animations` cannot be run by an agent.

Side-by-side with the mockup (same sizes, mockup on the left, built on the right, mocked backend):
`docs/changes/evidence/HOME-SIMPLE-2420/compare/<tablet|phone|desktop>-<screen>.jpg` (51 images). Differences seen: the camera picture
is the real tile (a "connecting" state with the mock), no active-scene highlight, the hold switch absent, otherwise the same structure,
sizes and colours.

## API inventory

`contracts/API_INVENTORY.md` regenerated (1874 routes): 10 new rows under router `home` (+ `PUT /me/interface`).

## Migration and rollback

Additive migration 0211. Rollback: deploy the previous version; it ignores the three tables (and the `/me` `interface` block). With the
tables left in place a later upgrade keeps the choices. The home-only gate exists only in this version: rolling back removes the
server-side restriction for home-only people (they would see the full interface again with their role's permissions).

## Known limits / open questions

1. The owner may still change any lead default (defaults for new users, room-off = lights + A/C, presets 23/26/22).
2. A home-only person keeps only the API areas listed in `HOME_ALLOWED_*`; a full-interface feature added later is refused for them
   until listed (safe by default).
3. Live control was exercised only against mocks; first lab run should check one light, one switch, one shutter, the door (with the
   owner's approval) and the bulk off on a real room.
