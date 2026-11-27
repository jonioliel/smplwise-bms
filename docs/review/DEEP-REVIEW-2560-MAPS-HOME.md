# DEEP-REVIEW-2560-MAPS-HOME - final deep review, area 7 (plans, maps, building / area model, home interface, wall)

Reviewed head: `origin/release/2560-train` at `3739e3ded`. Plan: `docs/review/FINAL-REVIEW-PLAN-2560.md` section 3, area 7.
Method: every changed hunk of the area in `v2.52.0..3739e3ded` read end to end (backend: `routers/home_family.py`, `routers/home_interface.py`,
`services/building_scope.py`, `services/home_interface.py`, `wire/home_interface.py`; frontend: `home/*` (24 files incl. the new
`home-refresh.ts`, `home-account.ts`, `home-playback-clock.ts`), `screens/devices-building.ts`, `screens/explore-floor-map.ts`, the new
`screens/map-action-args.ts`, `screens/map-room-bulk.ts`, `screens/wall-refresh.ts`, `api/area-row.ts`, `components/sw-room-card.ts`,
`wall/sw-wall.ts`, `wall/wall-logic.ts`). One backend probe test was run on the PC (one file, one process) to confirm MH-01; it was not
committed. No lab, no device, no runner job.

## 1. Summary

| Id | Severity | Title | file:line (at `3739e3ded`) |
|---|---|---|---|
| MH-01 | high | The plan editor's room field (`PATCH /zones/{id}` with `area_id`) moves an area between buildings without the round-14 `RemapGuard` - the guarded route refuses the same write | `routers/zones.py:207`, `:212` (vs `routers/plan_area_links.py:72`) |
| MH-02 | low | Home: two quick +/- on an A/C that is off - the first tap's setpoint is sent last and wins over the value the screen shows | `frontend/src/home/home-actions.ts:119-127`, `home/sw-home.ts:991` |
| MH-03 | low | Home / area counts: a `jammed` lock (and `locking` / `unlocking`) is announced as an open door | `frontend/src/home/home-logic.ts:42`, `:72`; `services/devices.py:247` |
| MH-04 | low | Floor map: a room's "all off" tapped while another room's batch still runs is dropped without a word | `frontend/src/screens/explore-floor-map.ts:2524` |

Counts: critical 0, high 1, medium 0, low 3. Old findings of the area: 14 - FIXED 14 (SCR-08 included: fixed on the 2.56 train by
`8ea7168f5`), STILL OPEN 0, PARTIAL 0. One FIXED row is re-opened in part as a new finding: D-12's installation rule is not applied on the
path of MH-01.

## 2. Findings

### MH-01 (high, CONFIRMED by a run) The room field of the plan editor bypasses the building remap guard

Round 14 (owner 02.11, answer B) made the home mapping count for a building binding's reach while the multi-building switch is on and the
setting is `map_and_mapping`. `services/building_scope.py` `RemapGuard` is the security rule for "every mapping write (the floor's home
links, the mapping assistant's apply / restore, a plan room's area link)": moving an area out of the building it resolves to now needs the
route's permission there too, and (D-12, LOWS-BACKEND-2550) mapping an unmapped area into a building needs it installation-wide; a change
also calls `mapping_changed()` so open sockets re-scope.

A plan room's area link (`spatial_zones.ha_area_id`) is the FIRST source `area_targets()` reads (`on_map`, `building_scope.py:50-57`): it
overrides the area -> floor row and the HA floor link. It has two writers:

- `POST /plan/area-links` (`routers/plan_area_links.py:53-82`): `placement.edit` on the room's floor + `RemapGuard` (`:72`, `:81`).
- `PATCH /zones/{zone_id}` (`routers/zones.py:168-215`): `placement.edit` on the room's floor only; `body.area_id` is written at `:207`
  / `:212` with no guard, no `mapping_changed()`. This is the route the plan editor's own "area" select uses
  (`frontend/src/screens/explore-plan-editor.ts:4970` -> `patchZone(z, { area_id })` -> `api/zones.ts:41 updateZone`).

Probe (run on the PC, `tests/` fixtures of `test_building_reach_round14.py`: `_site`, `_multi_on`, `bulk_app`; a `site_admin` bound to
building A's floor only, the area `office` resolving to building B):

```
reach_on True   office before = B
POST /plan/area-links {zone on A's floor -> office}   -> 403 forbidden   (the guard)
PATCH /zones/{zone} {"area_id": "office"}             -> 200
office after = A
```

Failure scenario: on a multi-building site with the mapping counting for reach, a floor editor of building A links one of building B's
areas to a room on his own floor. Every device of that area (lights, locks, covers) leaves B's reach and enters the reach of every
building-A role holder - the exact "pull building B's areas into the reach of A's holders" the guard's docstring names; B's holders lose
it, and their open sockets keep streaming the area until something else re-scopes them. The same path also maps an area that resolved to no
building into A without the installation-wide permission D-12 now requires. Audit: one `zone.update` row with `ha_area_id`, no denied row.

Fix: in `update_zone`, when `body.area_id is not None`, open `building_scope.RemapGuard(conn, principal, "placement.edit")` before
`patch_zone` and call `guard.check()` after it, before the audit row (the `plan_area_links` pattern). Add the probe above as a regression
test (both routes, both directions, switch off = today's behaviour). Consider the same guard for room delete / floor delete, which also
change `area_to_zone` (an area falling back to its area -> floor row can change building; today that is only the "leaving" direction, which
the guard's rule allows for the deleting editor, but `mapping_changed()` is still not called).

### MH-02 (low, CONFIRMED by reading) Two quick +/- on an A/C that is off: the stale setpoint wins

`sw-home.ts:991 a_temp` reads `wasOff` before the optimistic change (the SCR-31 fix) and sets `z.mode` to the on-mode at once. The first
tap goes to `setTarget(z, T1, true)` (`home-actions.ts:119`): `await run('home:<id>:mode', set_hvac_mode)` (key `...:mode`), and only
after that settles (the climate domain's follow-up, seconds) `run('home:<id>', set_temperature T1)`. A second tap inside that window
sees the optimistic mode, so `wasOff` is false and `set_temperature T2` goes out at once under the key `home:<id>`. When the first tap's
mode command settles, its `set_temperature T1` is sent under the same key and supersedes T2. The unit ends on T1 while the tile shows T2;
the next refresh after the hold flips the tile back to T1. Also T2 reached a unit that was still off (some units drop it).
Fix: serialise the zone's commands while the mode command is in flight (keep a per-zone pending promise and chain the second setpoint on
it), or debounce the setpoint as the dimmer is (`debouncedCommand`) and send the latest target after the mode.

### MH-03 (low, CONFIRMED by reading) A jammed lock reads "open"

HONEST-STATES-2540 made unknown / offline locks neutral, but `LOCK_STATES` (`home-logic.ts:42`) and the server's `LOCK_KNOWN_STATES`
(`services/devices.py:247`) count `jammed`, `locking` and `unlocking` as known; `locked` is true only for `locked`. A jammed lock - the
original SCR-10 named it - is therefore `doorOpen()`: "<name> פתוחה" in the strip (`doorsText`), the warn tone, the "open" count of the
area row and the locks tile ("יש מנעול פתוח"), and `doorState` (`:72`) says "פתוחה". A lock in the middle of locking shows the same for a
few seconds. The person is told a door is open when the system does not know it (jammed) or it is closing.
Fix: word `jammed` as its own state ("תקועה", warn tone, not counted as open) and `locking` / `unlocking` as "ננעלת…" / "נפתחת…"; keep
them out of `doorOpen` and out of the server's unlocked count.

### MH-04 (low, CONFIRMED by reading) A room's "all off" can be dropped silently

`explore-floor-map.ts:2524` `if (this.bulkRunning) return;` - the guard is per map, not per room. Tap "all off" in room A (a slow batch:
one `awaitAction` per device), select room B, tap its "all off": nothing is sent and nothing is said (the room card's line is cleared on
the room change, `:1676`). The person believes room B is going off.
Fix: key the in-flight guard by zone, or show a short "a batch is still running" note on the card instead of returning silently.

## 3. Re-verification of old findings (area 7)

| Old id | Status at `3739e3ded` | Evidence |
|---|---|---|
| SCR-06 (high) | FIXED (`91de5c377`, SCREENS-FIX-A-2520) | `home/sw-home.ts:358-377` `loadPanels` keeps the last panels on a failed read (`panelsRead = 'error'`), `alarmPushed` re-reads on any `alarm_control_panel.*` push on every home; `home/home-alarm-follow.ts` follows the action record, "sent" until confirmed / failed / unknown. Re-read. |
| SCR-08 (medium) | FIXED (`8ea7168f5`, OPEN-FINDINGS-2560 - on the 2.56 train; the plan's OPEN predates it) | `home/sw-home.ts:426-430` `saveFavs` -> `home-logic.ts keepHiddenFavs` keeps every stored favourite that `favOk` hides now (other building, hidden room, scenes / cameras not loaded); all edit paths (`:943-979`) go through it; `tests/unit-open-findings-2560.spec.ts` asserts it. Hidden ones move to the end of the list (see improvements). |
| SCR-09 (medium) | FIXED (`3ce7a0e21`, HONEST-STATES-2540 + AREA-HONEST-COUNT-2540) | `home/home-v3-words.ts:90 alarmLook`, `:99 securityChip`; `home-alarm.ts:138-150` offers no arm button for an unknown state; `api/area-row.ts` alarm indicator grey when not known. Re-read. |
| SCR-10 (medium) | FIXED for offline / unknown (`3ce7a0e21`) - `jammed` is new finding MH-03 | `home/home-logic.ts:41-60` `lockKnown` / `doorOpen` / `doorTone`, `home-api.ts:153` `known`; `api/area-row.ts lockUnknown`, `devices-building.ts lockKpi`. Re-read. |
| SCR-16 (medium) | FIXED (`8ef4eb6d3`, PHYSICAL-CONFIRM-2540) | `screens/explore-floor-map.ts:3170` and `:2549`: cancel first with `autofocus`, the danger / run button second. |
| SCR-17 (medium) | FIXED (`edc766955`, MEDIUM-REST-2540) | `screens/map-action-args.ts:29 argsToSend` keyed by entity + action + argument, optional light / fan arguments not sent unless typed; `explore-floor-map.ts:1677-1681` clears on selection change (a pending confirmation keeps its own). Re-read. |
| SCR-28 (medium) | FIXED (`704d791c2`, STALE-ANSWERS-2540) | `home/home-recordings.ts:45` one `SeekCoalescer` (no debounce): a second play seeks the session the first opened; `stop()` cancels the waiting one; `home-playback-clock.ts playerMinute` takes the position from the player's media clock. |
| SCR-30 (medium) | FIXED (`edc766955`) | `home/home-refresh.ts PushRefresh` (600 ms quiet, 2 s max wait, one read at a time), `homeDraws` domain filter, `keepLocal` + `home-actions.ts localIds` for commands in flight; `sw-home.ts:380` `ovSeq` guard. |
| SCR-31 (medium) | FIXED (`edc766955`) - an ordering race of the fix is new finding MH-02 | `sw-home.ts:991-1004` `wasOff` read first, `home-actions.ts:119 setTarget(z, t, wasOff)`. |
| SCR-32 (medium) | FIXED (`704d791c2`) | `home/home-p3.ts:174-191` `Latest` token + account check; other account's amounts cleared on switch. |
| SCR-33 (medium) | FIXED (`704d791c2`) | `home/home-scene-2500.ts:131-175` one token per sheet opening, id captured; save / delete close only their own sheet. |
| SCR-52 (low) | FIXED (`fdc0cb1fc`, LOWS-FRONTEND-2550) | `explore-floor-map.ts:2520-2541` in-flight guard + failed count; `map-room-bulk.ts`; `sw-room-card.ts` line. Residual: MH-04. |
| SCR-57 (low) | FIXED (`9035eacfd`, LOWS-FRONTEND-2550) | `home/home-styles.ts:260`, `:649` logical inline start for the dimmer fill and value. Not rendered in this review. |
| D-12 (low) | FIXED in `RemapGuard` (`7b068500b`, LOWS-BACKEND-2550) - not applied on the route of MH-01 | `services/building_scope.py:194-202`: `set(after) - set(before)` needs the permission installation-wide; `area_targets` leaves an unresolved area absent, so the set difference is exactly "unmapped -> mapped". |

## 4. Improvements (short)

- `devices-building.ts:1405` (HOME-FIT-FOLLOWUPS-2550): a building switch keeps the packing step, and the packing only tightens per key - after
  visiting a large building, a small one stays at fit 2 / squeeze until the window size changes. Allow one loosening re-measure after a switch
  settles (measure at the next looser step off-screen, keep it if it fits).
- `home/sw-home.ts:276` `disconnectedCallback` clears `armT` / `holdT` but not `alarmPushT` (one late `loadPanels` after leaving; harmless).
- `home/home-actions.ts run()`: the outcome promise never resolves when a newer command with the same key supersedes it (pre-existing);
  `sw-home.outcome()` then never schedules its follow-up refresh for that tap. Resolve superseded runs with `{ ok: true, note: null }`.
- `keepHiddenFavs` appends the hidden favourites after the visible ones - a room hidden for a while comes back with its favourites at the end.
  Mapping the visible index back into the stored list would keep the order (the SCR-08 fix text suggested that).
- `wall/sw-wall.ts:1104` a hold-to-acknowledge whose request fails is silent (the alert stays, so it is not dishonest; a short "not
  acknowledged" note would help on a wall that is often offline).

## 5. Checked and fine / not covered

Checked and fine:
- HOME-PERMS-WARN-2550: `services/home_interface.py:559-584 bills_route` / `_refuse_audited`, `:655-663` (category, then `energy.bills` installation-wide,
  audited at most once per person and reason; system administrators and non-home-only people untouched); the home bill screen is the only
  home caller of `energy/accounts*` (`home-p3.ts:164-185`, `home-p3-bills.ts`), so the energy / water categories are not broken by it;
  `site_wide_reads` / `shared_scope` are display only and the columns they count exist (`0054_electricity_billing.sql`).
- `services/home_interface.py:163-168` the talk / listen socket patterns are anchored `fullmatch` patterns.
- `routers/home_family.py:205-230` note idempotency: same key and route returns the first answer, another route 409; per-user scope.
- `home-account.ts`: not offered on a wall panel or without a server; reuses the full interface's own elements and routes.
- `wall-refresh.ts mergeById` / `systemTile`, `wall-logic.ts newBuildAvailable` (release-version check both sides, no auto reload).
- `area-row.ts` / `devices-building.ts` honest lock and alarm counts against `services/devices.py` `locks_unknown` / `alarms_unknown`.
- `building_scope.RemapGuard` (savepoint, rollback before the audited 403) on the three guarded writers (`catalog.py:584`,
  `home_mapping.py:375`, `:476`, `plan_area_links.py:72`); `plan_catalog.py` writes need `catalog.manage`; `plan_geometry.copy_geometry`
  checks the target floor and refuses another floor's source.
- `home-alarm.ts`: `arming` / `pending` / `disarming` count as armed (disarm offered), unknown offers nothing.

Not covered (honest list):
- The plan / floor-map editors (`explore-plan-editor.ts` 327 KB) beyond the area field of MH-01, the plan wizard, `sw-plan-3d.ts` /
  `scene-three.ts`, `xsection/`, `design/` tokens and skins, `skins.py`, `palettes.py`.
- `screens/home-widgets*.ts`, `home-edit-panel.ts`, `home-site-view.ts`, `system-home-screen.ts`, `system-wall.ts` and the `sw-wall.ts`
  rendering - only grepped for physical actions (none besides the alert acknowledgement).
- `devices-building.ts` control paths beyond the changed hunks (its bulk menu is a shared component).
- Phone width (360-430 px), RTL / English layouts and the no-scroll rule: nothing rendered (no build or browser run - the 2.56 gate was
  running; PC rules).
- Frontend unit specs of the area were read for assertions only where named above; none were run.
