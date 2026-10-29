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

## Mockup build check (29.10, round 7 `presence/`)
Fixed after the visual comparison: plan-map chips now follow the mockup (active = solid green pill with a small people glyph and the room tinted green; empty =
solid neutral pill; no data = dashed outline); the settings sensor list is a paged table (6 rows, 5 on a phone) with a state chip per sensor, an all / tagged /
not-tagged filter and a "..." that opens the tag editor drawer (room, state now, remove tag); on wide screens the times and history sit beside the table; the
home card caps its room chips and links to the map. Spec: `tests/evidence-presence-2280-layout.spec.ts` (fixture group `devices_floor`).

## Still different from the mockup / not done
- The card sits above the floor cards on the overview, not in the widget row (the widget grid is a separate configurable layout system: a new widget kind
  touches `home-config`, the edit panel and the stored layout). Owner decision needed.
- The home card lists room chips; the mockup shows a per-floor breakdown.
- Tag editor: only room, state now and remove-tag. Per-sensor "active when presence / motion", per-sensor hold and a display name need server fields
  (migration + API) and are not stored yet.
- Not run: the other skins, a real phone, pixel baselines for the new UI (none exist yet; none were created).
