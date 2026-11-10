# HOME-SIMPLE-2421 - home interface: the owner's decisions of 2026-11-10 (release 2.42.1)

Branch `pilot/HOME-SIMPLE-2421` from `main` b517bb5a3 (v2.42.0). Builds on HOME-SIMPLE-2420 (read that first). No version bump, no
CHANGELOG edit, API inventory not regenerated (the release bump does it). Nothing in `private/`, the lab, `secrets/` or the WisKey folders
was touched.

## What changed

### 1. "Switch user" also inside the home system

| Where the page runs | What "החלף משתמש" does |
|---|---|
| Remote sign-in (`/<remote_path>/`) | unchanged: the Arx sign-out (`arx/auth.logout`), back to the Arx sign-in page |
| Inside the home system (Ingress, `/api/hassio_ingress/...`) | NEW: a short sheet explains that the sign-in here is the home system's own, then "לדף החשבון" opens the host's account page (`/profile/general`, same origin, the top window). The person signs out there and the next person signs in. Arx signs nobody out, revokes no token, creates no account and touches no host user. |
| Local preview / dev page | not shown (no sign-in to switch) |

`frontend/src/home/home-wall.ts` `switchUserMode()`. Not exercised inside a real Ingress frame (NOT_RUN below).

### 2. Switch classification: the system suggests, the administrator approves (bulk)

User management > "ממשק ביתי" now has three sub-tabs: משתמשים / הגדרות התקנה / סיווג מפסקים. The classification tab lists every
switch (scheduler switches excluded) with its class now - **תאורה** (device type light), **לא תאורה**, **מוגן** (an administrator's
protection) - and the system's suggestion with its reason:

* `protected` when the switch-protection classifier suggested it (boiler, fridge, pump, ... in Hebrew and English: the existing
  `switch_protection_rules.TERMS`) and nobody reviewed it, or when the name-based type is an appliance (water heater, valve, heater, fan);
* `light` when the name holds a lighting word (`switch_protection_rules.LIGHT_WORDS_EN/HE`) and it is not a light yet.

Filters: all / suggestions / light / not light / protected, plus room. Multi-select (per row and "select all shown"), a bulk bar:
"אישור ההצעות" (applies each selected row's own suggestion), תאורה, לא תאורה, מוגן. 20 rows per page.

Server: `GET /home/switches`, `POST /home/switches {entity_ids (1-500), mark: light | not_light | protected}`, both `system.configure`
(the permission of Settings > device types / protected switches, whose stores they write - `device_type_override` and
`device_bulk_protected`, through `device_types.set_kind`, `switch_protection.set_protected` / `approve`). Every change keeps its own audit
row there, plus one `home_interface.switch_class.batch` row. Refused per id: `not_switch`; for a protection change `alarm_managed`,
`media_managed`, `doors_layer`. Classes are exclusive: `light` removes protection; `not_light` drops a light type (back to automatic, or
`switch` where the name alone would say light) and removes protection; `protected` drops a light type and protects. An administrator
without `system.configure` sees the tab's error panel (403).

### 3. Scenes and non-light switches (checked, documented, no code change)

A scene changes only its own members: an Arx scene is captured from the entities the administrator explicitly selected
(`POST /automations/scene/capture`, `automation_view.capture(ctx, entity_ids)`), and applying it is the scene entity's own apply
(`automation_ops.apply_scene` -> bridge `apply_scene`), which sets those members and nothing else. So a scene turns a non-light switch
off only when the administrator put that switch in the scene. The home interface runs scenes through the same route (no new path).
"כיבוי החדר" / "כיבוי הבית" stay `lights_off` (lights and light-typed switches) + `climate.turn_off`: never a non-light or protected
switch - re-checked after bulk classification in `test_house_off_and_room_off_never_reach_a_protected_or_not_light_switch_after_bulk_marking`.

### 4. Unchanged by decision

Room off = lights + A/C; the `HOME_ALLOWED_*` allowlist; all 7 themes; media out; favourites per person; the switch in the personal menu;
a wall panel opens its room.

### 5. Default interface of NEW people (installation setting)

`home.default_mode`: `full_all` (**default**: full for everyone) / `home_regular` (home for a regular user, full for an administrator =
the 2.42.0 rule) / `choose` (the home interface's choice screen at the first sign-in; the choice is saved with `PUT /me/interface`, which
writes the person's row, so the screen never comes back). Existing people are unaffected: everyone known at 2.42.0's upgrade already has
an explicit row (migration 0211), and people who arrived under 2.42.0 without a row get their 2.42.0 default written as an explicit row
once, in the start that applies migration 0212 (`home_interface.freeze_legacy_defaults`, called from `main.py`; the administrator test
needs the role model, so it is Python, not SQL). `GET /me` / `GET /home/interface` carry `choose`.

### 6. Wall panel exit (installation setting)

`home.kiosk_exit`: `code` (**default**, as built: long press on the clock, the administrator's code, 5 minutes) / `none` (locked to the
home interface and its room, no personal menu, no exit: the long press does nothing and `POST /home/kiosk/exit` answers 403
`kiosk_no_exit`). Changed only from the administrator page.

### 7. Room wallpaper (installation setting)

`home.wallpaper`: `none` (**default**, the clean screen) / `gallery` / `gallery_image`.

* Gallery: 8 original abstract backgrounds (דמדומים, גאות, דיונה, אזוב, גחלים, צפחה, זוהר, פשתן) drawn from CSS gradients only - no
  picture files, nothing downloaded (`home-wall.ts`; the server checks the names, `home_interface.GALLERY`). On the room screen the
  field sits under a scrim of the theme's own background (`color-mix(var(--hs-bg) 76%)`, `home-styles-extra.ts .hs.walled`), so text and
  tiles keep the theme's contrast in all 7 themes, dark and light. Per person, per room (`layout.wallpapers`), chosen in
  settings > "רקע" (the tab exists only when the installation offers wallpapers).
* Personal picture: BUILT. `PUT /home/wallpaper/{room_key}` (multipart, JPEG / PNG only, <= 2 MB - body limit rule `home_wallpaper`),
  re-encoded by the existing `bill_pdf_logo.sanitize_image` (magic bytes, pixels rebuilt, EXIF dropped, long side <= 1920 px), stored in
  `home_room_image` (migration 0212, base64 text, in the project backup); `GET` serves only the caller's own picture (`Cache-Control:
  private`, `nosniff`), 404 for anyone else or when the installation turned pictures off; `DELETE` removes it. Audited
  (`home_interface.wallpaper.set` / `.delete`, never the picture). WebP is not accepted: the shared sanitizer re-encodes PNG / JPEG only.
* Installation settings: `GET / PUT /home/settings` (`rbac.assign`, audited `home_interface.settings.set` with before / after).

### 8. Alarm (verified, no change)

"אבטחה" arms with a tap plus one confirmation sheet (the panel's `no_code` arm policy) and disarms through the code pad when the panel
asks for a code (`code_required`). The existing spec covers the arm path; the disarm code pad was verified by reading the code only.

### Lab finding (coordinator, 2.42.0 lab): doors offered "open" that the door path refuses

`GET /home/overview` lock items now carry `unlock_reason` and `can_unlock` from THE rule (`door_authority.unlock_reason`, the one the
devices panel and `GET /ha/entities/{id}` use; WisKey doors detected with `intercom_doors.wiskey_lock_ids`). The home interface shows
"פתח" only when the reason is `ok`; otherwise a quiet line: `door_not_mapped` -> "הדלת עדיין לא משויכת לעמדה", `no_permission` /
`no_control` -> "אין הרשאה לפתוח", `not_placed` -> "אין הרשאה לפתוח את הדלת הזו", `wall_profile` -> "מסך קיר לא פותח דלתות",
`alarm_managed` -> "נשלטת ממסך האזעקה". The action route still decides.

## Migration and rollback

Additive migration `0212_home_interface_2421.sql` (`home_room_image`). Rollback: the previous version ignores the table and the three
`home.*` settings rows. The legacy-default rows written by 0212's start stay valid for 2.42.0 (same columns).

## Tests (run locally, 2026-11-10)

| Command | Exit | Result |
|---|---|---|
| `pytest tests/test_home_interface.py tests/test_home_interface_doors_2421.py` | 0 | 26 passed (15 from 2.42.0, one changed to the new default; 10 new; 1 new doors file) |
| `pytest` home_interface (both) + backup, backup_sensitive, body_limit, device_types, me_permissions, migrations, migrations_263_upgrade, rbac_matrix, switch_protection_reach_guard, unlock_reason_2370, devices (172 collected) | 1 | 171 passed, 1 failed: `test_devices.py::test_bulk_not_sent_after_its_deadline_and_orphans_settled` - a deadline test, run while a frontend build loaded the PC; re-run alone: 1 passed (exit 0). Treated as load-timing, not this change (it touches no bulk code) |
| `npx tsc --noEmit` | 0 | clean |
| `npx playwright test -c playwright.unit.config.ts tests/unit-home-simple-logic.spec.ts` | 0 | 9 passed (2 new: door reason words, gallery is CSS-only and matches the server list; the words check now also reads home-wall.ts and sw-home-admin.ts) |
| `npx playwright test tests/home-simple-2421.spec.ts tests/home-simple-2420.spec.ts --project=desktop` (after `vite build`, own port 4291) | 0 | 31 passed: 9 new (door not mapped / no permission, choose at first sign-in, kiosk without exit, wallpaper on the room screen with no scroll + settings tab, no wallpaper by default, picture upload offered, admin installation settings, admin switch classification with filter + select all + approve + bulk protect) + the 22 of 2.42.0 unchanged |
| `python scripts/gate/lint_spec_waits.py frontend/tests/home-simple-2421.spec.ts frontend/tests/home-simple-2420.spec.ts` | 0 | 0 findings |
| impeccable `detect --json` on sw-home.ts, home-styles-extra.ts, sw-home-admin.ts, home-wall.ts | 0 | `[]` (evidence/HOME-SIMPLE-2421/inspect/) |

NOT_RUN: the full backend suite, the full Playwright suite and the pixel baselines (runner, via the lead - the room screen with a
wallpaper and the admin sub-tabs are new pixels); the 3-size sweep with a wallpaper (desktop size only); "switch user" inside a real
Ingress frame (no host here - the account page navigation is untested); a real upload from a browser (the server path is tested with
TestClient); a run against the lab; real tablet / phone; `lazy-tags-check.mjs`.

## Open questions for the owner

1. Alarm: arming is a tap plus one confirmation sheet (as built in 2.42.0). Should arming be a single tap with no confirmation?
2. "Switch user" inside the home system opens the home system's account page (sign out there). Acceptable, or hide it there?
3. Personal wallpaper is per person per room. Should the administrator also be able to set a room wallpaper for everyone (e.g. wall panels)?
