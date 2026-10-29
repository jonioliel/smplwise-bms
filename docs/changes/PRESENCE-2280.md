# PRESENCE-2280 - building presence, release 2.28.0 (builds on BUILDING-PRESENCE-2271)

Owner decisions (29.10): no legend filter on the plan map (the sensor list lives in settings only); history kept N days (configurable, purge
button, short privacy note); per-person presence (phase 2) is NOT part of this; everything is configurable in settings; **the whole module is OFF by
default and is switched on by the system administrator** (Settings > Presence > "Building sensors").

## Master switch (`enabled`, default off)
While off: `GET /presence/building` answers `{configured:false, enabled:false}`; no sensor state is read for it; the overview card/chip and the
plan-map chips are not drawn; the history job writes nothing; the cockpit does not offer the building-empty trigger or the room-occupied condition
(`Ctx.presence_sensors` is empty, so a stored step of that shape stays a locked template). Switching it off also erases the history. Tag edits
and the settings page stay available to `system.configure` so the owner can prepare before switching on.

## What is new
- Settings > Presence > fourth page "Building sensors": master switch, grouped sensor list with tag + room (stored in Arx only; nothing is
  written to a sensor), hold / empty timeout, home display (card | thin line | off), plan-map chips on/off, history (days kept, 0 = none,
  privacy note, number of records, oldest, "delete all" with confirmation).
- Overview: `building-presence-card` (display = card; placed above the floor cards, not inside the widget grid) or the existing thin chip.
- Plan map: each room with a tagged sensor gets a chip "פעיל" / "ריק מ־HH:MM" / "אין מידע" through the canvas's existing zone-chip slot
  (matched by area id). No legend filter.
- History: table `presence_building_history` (time, scope, area, status; no person, phone, picture or sensor id), one row per transition,
  written by the housekeeping tick (~30 s) only while enabled and `retention_days > 0` and the mirror is connected; pruned past the retention.
- Cockpit: backend blocks existed (2271); this adds the editor entry "נוכחות במבנה" (trigger: building empty N minutes; condition: occupied / empty)
  with the client twin `frontend/src/api/automations-presence.ts` and form `screens/automation-presence-forms.ts`.
- API: `PUT /presence/building/settings` takes `enabled`, `retention_days` (0..365), `home_display`, `map_tint`; `PUT /presence/building/room`;
  `GET|DELETE /presence/building/history` (system.configure; the purge is audited with a row count).

## Migrations
`0195_presence_history.sql` (new). **Collision:** `0183_building_presence.sql` (from BUILDING-PRESENCE-2271) collides with the number used by
`pilot/WISKEY-ADOPT-2272`; it was left unchanged and must be renumbered at integration (next free after the highest on the integration branch;
0190 and 0194 are taken elsewhere). 0195 only needs `presence_building_sensors` to exist before it runs, so the order 0183 -> 0195 must be kept.

## Known deviations from the mockup / not done
- The card sits above the floor cards on the overview, not in the widget row (the widget grid is a separate configurable layout system).
- The unknown map chip is a text chip; the dashed outline was not added to the canvas.
- Tag editor drawer (per-sensor "active when presence/motion", per-sensor hold) is not built: tagging, room choice and the building-wide hold are.
- Rooms with a sensor are not tinted by this module; the existing class-based room tint of the map is unchanged.
- Not run: browser/pixel/layout specs, full suites, the runner, a real phone, the other skins.
