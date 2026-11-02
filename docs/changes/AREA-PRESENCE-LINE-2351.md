# AREA-PRESENCE-LINE-2351 - presence line in the devices area screen

Branch `pilot/AREA-PRESENCE-LINE-2351` (from `origin/release/2350-train`). Owner follow-up noted earlier as "presence line in devices-area"
(PRESENCE-DESIGN-2300 left the area screen without one). No version bump, no migration.

## What it shows

One compact line under the area header (`frontend/src/screens/devices-area.ts`, `data-area-presence`):

`[people icon] נוכחות · <room word> · <who>`

- **Room word** - from the tagged presence sensors of that room (BUILDING-PRESENCE-2271 / PRESENCE-2280): `פעיל` / `ריק מ־HH:MM` / `אין מידע`
  (an unavailable sensor or a stale mirror is never read as empty). Shown only to holders of `presence.building.view`, only while the
  building-presence module is on and the room has a tagged sensor.
- **Who** - from the phone app's people placement (WHOIN034-295, `services/presence_people.py`): the people a beacon places in a plan room
  (`spatial_zones`) linked to this area (`spatial_zones.ha_area_id`). Shown only to holders of `presence.view` (system_admin by default,
  sensitive), with that holder's floor scope. Names (each in `<bdi>`, up to 3 inline, then `ועוד N`; every name in the tooltip) only while the
  people setting "show names" is on; otherwise a count (`אדם אחד` / `3 אנשים`). `אין נוכחים` only when the people part stands alone.
- Green (`--sw-success-text`) only while someone is there (an occupied room or a person placed in it); quiet otherwise.
- Not shown in the layout editor.

### Sources not used, and why

- **Door / access events**: an entry says someone passed a door, not that they are still in the room; door "last entry" and identity are a
  separate privacy decision (BUILDING-PRESENCE-2271, phase 2), not taken here.
- **Wi-Fi and geofence placements**: they know a floor or a site, never a room, so they never count in an area.
- **Opted-out people**: `people_view` never places them on a floor or an area (installation-wide hidden count only), so the area line neither
  names nor counts them.

## Setting (conservative default)

`presence.building.config.area_line` (Settings > Presence > Building sensors > "שורת נוכחות במסך האזור"), **OFF by default**. Reason: the
area screen is seen by every devices viewer, and the line can carry people's names to a `presence.view` holder; the existing presence modules
(building sensors, people) are themselves off by default, so the line follows them. While off, the server reads nothing (no sensor, no
people) and answers `line: false`. The switch is `system.configure`, audited with the other building-presence settings.

## API

`GET /api/v1/presence/area/{area_id}` (`routers/building_presence.py`, logic `services/area_presence.py`):
`{area_id, line, sensors: {status, empty_since, sensors} | null, people: {count, names: string[] | null, more} | null}`.
- 403 (audited `denied`, resource `area`) without `presence.building.view` and without `presence.view`.
- Each part only with its own permission; the people rules of `people_view` are reused, not re-implemented.
- The people read is audited like `GET presence/people`: once per viewer per 10 minutes (shared throttle), counts only, never a name.
- `names` capped at 50 (`more` = the rest).
- `PUT /presence/building/settings` accepts `area_line` (bool).
- `contracts/API_INVENTORY.md`: the new row (hand-added; the generator on this train also lists unrelated calendar routes that are not in the
  committed file - not touched here).

## Live updates, no layout shift

- The line is read **together with the area** (`Promise.all` with `getDevicesArea`), so it is part of the first paint: it never appears later
  and pushes the screen down. Every area reload (the area's own entity pushes, throttled) refreshes it; a 30 s poll (`POLL_MS`) runs while
  the line is switched on and the page is visible. A failed read keeps the last answer (nothing invented).
- One fixed-height (28 px, like the security chips) non-wrapping row; a long list ends in an ellipsis. Text changes never move the screen.
  Switching the setting itself on / off adds or removes the row on the next read (an administrator action, rare).
- Tokens only (`--sw-text*`, `--sw-success-text`, `--sw-fs-sm`, `--sw-fw-semibold`); Hebrew first, English twin in `i18n/building-presence.ts`.

## Tests (this workstation)

- `pytest tests/test_area_presence_line_2351.py tests/test_building_presence_2271.py tests/test_presence_history_2280.py tests/test_presence_compact_2310.py` - 45 passed.
- `npx tsc --noEmit` - pass.
- `npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-area-presence-line-2351.spec.ts` (+ presence, token-lint, design-token,
  a11y-lint specs) - 75 passed. A wider unit sweep (152 files) - 1543 passed, 1 failed: `unit-date-format-module.spec.ts` "every lit date/time
  input ... lang=dateInputLang()", in `calendars/grid-overlays.ts` - present on the base branch, not touched here.
- `scripts/gate/lint_spec_waits.py` on the new spec - 0 findings.
- NOT_RUN: browser / screenshot evidence and pixel runs (workstation low on memory; runner busy with release gates).

## Baselines affected

- Pixel (`visual-matrix`): none - it has no devices-area or presence-settings shot, and the line is off by default.
- Evidence screenshots that will differ when re-taken: `evidence-presence-design-2300.spec.ts` settings "ready" / "off" states (one more toggle
  row in "זמנים ותצוגה"). `evidence-presence-2280-layout.spec.ts` settings shots likewise. Devices-area evidence is unchanged unless a fixture
  turns `area_line` on.

## Owner decisions 02.11 (round 14)

Both answered "yes". No migration and no new setting key: both follow the existing switch `presence.building.config.area_line` (still OFF
by default).

1. **An anonymous count for `presence.building.view` without `presence.view` - enforced on the server.**
   - `services/area_presence.py` `area_line`: with `presence.view` the people part is as before (names under `show_names`); otherwise, with
     `presence.building.view`, `people_part(..., anonymous=True)` answers `{count, names: null, more: 0, anonymous: true}` whatever
     `show_names` says. With `presence.view` the part carries `anonymous: false`.
   - The count reuses `presence_people.people_view` (same placement, same opt-out rule: an opted-out person is never placed in an area),
     with two new keyword arguments: `perm` - the permission whose installation / floor scope decides which floors count (here
     `presence.building.view`, so a floor-scoped holder counts only his floors) - and `with_names=False`, which never builds the
     per-person list. No name, user id, source, time, site, floor or zone of a person can reach that answer.
   - The read is audited like the named one (`presence.people.view`, resource `area`, once per viewer per 10 minutes, counts only), with
     `anonymous: true|false` in the details.
   - The permission's description (`routers/access.py`) now says it includes the anonymous people count of the area line.
2. **The same line in the area quick pop-up** (`screens/area-quick-sheet.ts`, `data-qc-area-presence`), only while `area_line` is on (the
   server's `line`). It sits under the pop-up's title (sub-line), one fixed-height (24 px) non-wrapping row with an ellipsis and the full
   list in the tooltip, the same words as the area screen (`areaLineView`). While it is drawn, the sub-line's own room word
   (PRESENCE-COMPACT-2310) is left out (`quickSheetPresence` in `api/building-presence-logic.ts`) - it is the line's first part; with the
   switch off the pop-up is exactly as before. The line is read together with the area (`Promise.all` in `load()`), so it lands in the
   same render as the pop-up's body; entity pushes reload it with the area, and a 30 s poll runs while the pop-up is open, the line is on
   and the page is visible. Nothing is asked without `presence.building.view` or `presence.view`; not shown while editing the pop-up.
   Works for both hosts (the building screen and a neighbour area opened from the area screen's plan card).
   The settings hint now says the line shows on the area screen and in the area quick window.

### Tests (round 14)

| Check | Result |
|---|---|
| pytest `test_area_presence_line_2351` (12, 3 new: building.view-only -> anonymous count, `people_view` asked with `perm=presence.building.view, with_names=False`, no person field in the body, names-off and module-off; floor scope + opt-out for the anonymous count; presence.view keeps names, both combinations audited with the `anonymous` flag and without names), `test_whoin034_295`, `test_building_presence_2271`, `test_building_presence_cockpit_2271`, `test_presence`, `test_presence_history_2280`, `test_presence_compact_2310` | **93 passed / 93** |
| `npx tsc --noEmit` | **0 errors** |
| `playwright -c playwright.unit.config.ts --workers=1`: `unit-area-presence-line-2351` (4 new: anonymous count, pop-up line on / off, pop-up source contract), `unit-a11y-polished-lint`, `unit-area-popup-edit-2290`, `unit-building-presence-logic`, `unit-presence-compact-2310`, `unit-token-lint`, `unit-menu-lint` | **77 passed / 77** |
| Browser evidence of the pop-up line | see the runner line in the round-14 report |

## Open for the owner (answered 02.11, round 14 - kept for the record)

1. Should a holder of `presence.building.view` without `presence.view` see an anonymous people **count** in the area line? Today: no
   (conservative - the people data stays with `presence.view`).
2. Should the line also appear in the area quick pop-up (it shows the room word only today)?

## Rollback

Revert the branch commits. The stored `area_line` key is ignored by an older server (unknown keys are dropped by `get_config`).
