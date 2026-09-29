# CR-009 — Shared space: one room that belongs to two floors (the double-height sports hall)

**Numbering:** registered as CR-009 on 2026-09-29 (CR-008 remote access is the previous record).

**Status:** Approved for development by the owner on 2026-09-29 from a mockup. Task T093. This note is the design
agreed before the build; §10 records what was built.

## 1. The request (owner, 2026-09-29, translated)

The sports hall is one double-height room that exists on two floors and is reachable from both: the tribunes
descend from floor 0 to the court on floor -1. Today it is drawn twice, as two unrelated rooms, one per floor. The
owner wants to see the hall WHOLE on EACH floor's map - tribunes, court, cameras, devices, everything - comfortably.

Owner decisions (2026-09-29):

1. **Editing:** the hall can be edited from either of its two floors, and the change shows on both.
2. **Marking:** the hall looks the same on both maps, with a small label naming the floor its surface is on
   ("רצפה בקומה -1").
3. **Permissions:** a user allowed on only one of the two floors sees the WHOLE hall, including its cameras and
   devices - it is reachable from both floors.
4. **Source floor** when converting the two existing drawings: the floor that holds the court (the lower one),
   unless the owner says otherwise.

3D: the hall is one tall volume with no slab in the middle; the tribunes step down from the upper floor to the
court; devices of the hall are counted once.

## 2. Facts in the code that shape the design

- A room is a row of `spatial_zones` (floor, polygon 0..1, level, ceiling, tags); the plan document's `rooms[]` is
  only a reference to it (PLAN_STUDIO_DESIGN_HE.md §4.2). Rooms are live rows, not versioned by a publish.
- The structure (walls, openings, objects incl. tribunes, labels, connectors, circuits, groups) lives in the plan
  document of the floor's plan version (`plan_geometry`, one draft + one published row per version,
  `services/geometry_store.py`). Its SHA-256 is the map bundle's cache key.
- Cameras and HA entities are `map_anchors` rows of one floor. Reach is computed from them in a handful of places:
  `rbac.scope_chain` / `rbac.camera_floors` (a camera's chain holds every floor it is anchored on),
  `services/access.py` (`_chains` - the batched chain used by `camera_scope`, hence live, playback, snapshots,
  events, the push/alert rule `row_scope`; `floor_cameras` / `floor_reach` for camera-scoped readers),
  `services/ha_scope.py` (`placements` - an entity is visible to a floor-scoped user when placed on one of their
  floors; used by the catalogue, the push socket, the map bundle and the devices area), `routers/events.py`
  (`_place_filter`, events by floor), `routers/search.py` and `routers/catalog.py` (the floors a camera-scoped user
  sees). WisKey door stations are installation-scoped only (`routers/access.py`): no floor, nothing to extend.
- The T085 stairs work already has the pattern this CR reuses: data of another floor computed on read and never
  stored or hashed (`attach_far`, `FarContext`), an edit reaching another floor's draft in the same request under
  that floor's permission (`_sync_twins`), and the editor's rebase on a 409 (`studio-controller.ts rebaseOnServer`).
- The devices area groups entities by HA floors / areas, which have no link to Arx rooms: an entity appears there
  exactly once whatever the maps show.

## 3. Data model

**Deviation from the recommended model (and why):** the brief suggested `shared_floor_ids` on the room plus a
`shared_spaces` reference stored in the other floor's plan document. Rooms are table rows, not document items, and
reach must be computed on every request for every camera (`access._chains`, three queries) - parsing documents
there is not acceptable, and a publish of one floor must not change who reaches a camera. So the share is a row of
its own table, next to the zone it shares:

```sql
-- migration 0036_shared_spaces.sql (next free number; the coordinator renumbers at merge)
CREATE TABLE shared_spaces (
  id             TEXT PRIMARY KEY,
  zone_id        TEXT NOT NULL REFERENCES spatial_zones(id),   -- the room; its floor is the HOME floor
  home_floor_id  TEXT NOT NULL REFERENCES floors(id),          -- copy of the zone's floor at share time
  floor_id       TEXT NOT NULL REFERENCES floors(id),          -- the OTHER floor that shows the room
  placement_json TEXT NOT NULL,                                -- how home coordinates map onto the other plan
  revision       INTEGER NOT NULL DEFAULT 1,
  created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  removed_at     TEXT, removed_by TEXT                          -- un-share keeps the row (history map, audit)
);
CREATE UNIQUE INDEX ux_shared_spaces_active ON shared_spaces(zone_id, floor_id) WHERE removed_at IS NULL;
```

Triggers bump `cache_versions.structure` (the events-list cache joins floors and zones) like the zone triggers.

- The **home floor** owns everything, exactly as today: the zone row, and in its plan document the walls, openings,
  objects (tribunes included), labels, same-floor connectors, circuits and groups inside the room; its anchors
  inside the room are the room's cameras and devices.
- The **other floor** stores nothing of the room. It has only the `shared_spaces` row.
- **Placement** maps a home point to the other plan: `{"mode": "same_frame"}` (the same normalized coordinates -
  both plans share a sheet or the same calibrated metres, `geometry_store.frame_of`) or
  `{"mode": "fit", "from": [x, y], "to": [x, y], "rotation_deg": r, "scale": s}`: in plan pixels,
  `q = to_px + s · R(r) · (p_px − from_px)` with `s` = other-plan pixels per home-plan pixel. `from` / `to` are
  fixed points, so editing the room's polygon never shifts the mirror.
- A room may be shared to more than one floor (one row per floor; a three-storey atrium); the UI offers one.
- **Membership** ("inside the room"), one rule used by read, write, reach and conversion: a point is inside when it
  is in the polygon or within a tolerance of its outline (walls, connectors: max(wall thickness, 0.3 m); objects,
  labels, anchors: 0.05 m) - boundary walls lie on the outline. A wall wholly inside is a *room wall*; a wall that
  crosses the outline (the building's long exterior wall) is *clipped*: its inside pieces are shown, read-only.
  Openings follow their wall (on a clipped wall: when their centre is on an inside piece). Connectors: same-floor
  ones wholly inside and the tribunes' derived ones; cross-floor stairs are not mirrored (they already have a twin
  on each floor). Circuits and groups: those whose members are all inside.

## 4. Read paths (computed, never stored, never hashed)

`services/shared_spaces.py` attaches the home floor's subset for each active share of the floor being read, like
`attach_far`:

- **Plan document** (`GET /plan-versions/{id}/geometry` draft, published, `?at=`; the SVG / PNG export; the 3D and
  the building page read the same document): the subset from the home floor's document of the same kind (editor
  draft for a draft read, the published document for a published read, the one published at `t` for `?at=t`),
  transformed by the placement, ids namespaced `"<home_floor_id>:<id>"` (never colliding with the floor's own ids),
  every item marked `"shared": {"zone_id", "home_floor_id", "readonly"?}`. The home levels come too, namespaced,
  with `elevation_m` = their elevation + the home datum relative to this floor (floor heights, `FarContext.datum`),
  so the court sits at −3.0 m on floor 0. The document gets `shared_spaces: [{zone_id, home_floor_id,
  home_floor_name, role: "mirror", polygon, placement, home_revision, datum_m, volume_height_m, label}]`; the home
  floor's own read gets the same list with `role: "home"` (label and 3D volume only, no items).
- **Stripped on every write** (`_prepare`, like `strip_far`): namespaced items, `shared` markers and
  `shared_spaces` never enter a stored document or its hash; the structural validation of a save runs on the
  floor's own items only.
- **ETag / cache key:** the published read's ETag gets a `-s<hash>` part over the share rows, zone revisions and
  the home documents' hashes; the map bundle's geometry reference gets `view_hash`, which the client uses as its
  cache key (so a change on the home floor refreshes the other floor's map).
- **Map bundle** (`GET /floors/{id}/map`, live and `?at=`): the home zone is added to `zones` with the polygon in
  this plan's coordinates and `shared`; the home anchors inside the room are added to `anchors` with transformed
  positions and rotations, their real ids and `shared`; entity states and circuit states of the attached items
  come with them. History: share rows active at `t`, anchors effective at `t`.
- **Readers:** a camera-only reader (`reach: "cameras"`) gets the drawing without circuits, as today; a reader
  with an explicit deny on the home floor gets the floor without the attached room (deny wins, §6).

## 5. Write paths

- **Editing from the other floor** (decision 1): the editor on floor B edits the mirrored items like its own. On
  `PUT …/geometry` the server splits the namespaced items off, validates the floor's own items as today, and
  routes the rest to the home floor's editor draft in the same transaction: changed, added (namespaced new ids -
  the editor namespaces an item it creates inside a shared room) and removed items, un-transformed, levels
  un-namespaced (a new item on one of B's own levels goes to the home default level). The response is B's
  document re-attached.
- **Narrowly:** only items of the room (membership in home coordinates, before and after the edit) are touched; a
  clipped wall is read-only; an item moved out of the room from B is refused (422 `shared_outside`); nothing else
  of the home document changes.
- **Permission:** `map.edit` on EITHER floor grants editing the room's content (`map.edit` on B is already required
  by the route; editing from the home floor is today's path). Anchors: `placement.edit` on either floor moves or
  deletes the room's anchors from B (`PATCH/DELETE /map-anchors/{id}?from_floor_id=B`, position un-transformed and
  kept inside the room) and a camera or entity placed on B inside a shared room is created on the home floor
  (`POST /floors/{B}/anchors` routes it); the T055 camera placement rule still applies to every camera. Zone name,
  tags and polygon from B: `PATCH /zones/{id}?from_floor_id=B` (polygon un-transformed).
- **Conflicts:** each mirror entry carries `home_revision` (the home draft's revision it was read at). A save from
  B whose shared items differ from the current attach while the home draft moved answers 409 `stale_revision`
  (`details.shared = true`); the editor reuses the stairs rebase - a 3-way merge by id, now over the shared items
  as well as the connectors - and saves again, or asks for a reload when both sides changed the same item.
- **Audit:** `geometry.shared.edit` on the home floor naming both floors (from_floor_id, zone_id, counts);
  `anchor.update`/`anchor.delete`/`anchor.create` rows carry `via_floor_id`.
- **Publish:** B's publish publishes B. Room edits made from B sit in the home floor's draft and reach the live
  maps of both floors when the home floor is published; the editor on B says so (§7) - a publish never publishes
  another floor's draft behind the person's back.

## 6. Permissions (decision 3) - one helper, deny wins

`services/shared_spaces.py` is the only place that knows about shares. It exposes `shared_zone_floors(zone_id)`
and `mirrored_anchor_floors(conn)` (anchor key → the other floors its shared room reaches), and every reach site
calls it instead of adding conditions of its own:

| Where | Change |
|---|---|
| `rbac.camera_floors` → `scope_chain('camera', …)` | also the other floors of a shared room the camera is anchored in |
| `access._chains` (camera_scope, live, playback, snapshots, recordings, events, cases, exports, push/alert `row_scope`) | the same floors, batched |
| `access.floor_cameras` / `floor_reach` | a camera mirrored onto the floor counts as anchored there |
| `ha_scope.placements` (catalogue, push socket, map bundle, devices area, bulk actions, entity actions) | a placement on each other floor, marked with its home floor |
| `routers/events._place_filter` | events by floor / building / site include the mirrored cameras and entities |
| `routers/search.py`, `routers/catalog.list_sites` | the room and its cameras are found and listed on the floors that show them |

Rules:

- A principal whose scope includes EITHER floor reaches the room's zone, its cameras (live, playback, snapshots,
  events) and its entities and device actions exactly as if the room were on their floor - and nothing else of the
  home floor (only anchors inside the room are mirrored; other home anchors are untouched).
- **Deny wins.** A camera's chain holds both floors, so an explicit deny on either floor (or on the camera) takes
  it away - the T055 rule for a camera on two maps. For entities a shared placement counts only when the principal
  has no explicit deny on the home floor; for the drawing, a reader explicitly denied map.read on the home floor
  gets the other floor without the attached room.
- **Sharing widens reach**, like placing a camera (T055 B1): converting or sharing needs `map.edit` and
  `placement.edit` on BOTH floors and `placement.edit` on every camera of the room (`require_camera_placement`).
  Un-sharing narrows reach: `map.edit` on either floor; it takes effect on the next request (reach is never cached
  across requests).
- The WisKey station scope is installation-only; nothing changes there.

## 7. UI

- **Maps** (live map, editor, history map, 3D, building page): the mirrored items render as the floor's own; the
  room gets a small chip "רצפה בקומה -1" on both floors (on the home floor too). Selection, hover, device tiles,
  camera cones and popovers work on mirrored anchors (they are ordinary anchors with transformed positions).
- **Editor on the other floor:** mirrored items are editable (move, rotate, resize, delete, add inside the room);
  a selected shared item shows "חלל משותף · השינוי יופיע גם בקומה X"; clipped walls are locked. Items outside the
  room are the floor's own, untouched.
- **Conversion** "הפוך לחלל משותף" on a room in the editor's room panel: choose the other floor, the duplicate room
  there (auto-detected by name and overlap), the source floor (default: the lower one - the court), a preview
  listing what will be removed on the other floor (its duplicate room and the walls / objects / openings / labels
  inside it) and the anchors that will be re-bound (cameras / entities of the duplicate drawing moved to the home
  room, or dropped when the home room already has them), then apply. "בטל שיתוף" removes the share.
- **3D:** the other floor's plate is cut around the room (the stairwell logic with the room's bounding box); the
  mirrored court level sits at the home datum; the room's walls rise through both floors (home floor height + the
  upper floor's ceiling); tribunes and stairs keep the existing stairs model.
- **Devices:** the devices area groups by HA areas, so a device appears there once whatever the maps show; the
  building page's floor card counts the mirrored cameras as "משותף" beside the floor's own.
- **Search:** a result in a shared room opens it on the floor the person is on when that floor shows the room.

## 8. Migration of the existing duplicate rooms

`POST /zones/{zone_id}/share/preview` and `POST /zones/{zone_id}/share` (`zone_id` = the room kept, on the home
floor; body `{floor_id, duplicate_zone_id?, rotation_deg?}`), applied atomically in one transaction:

1. Placement: `same_frame` when the two plans share a frame; else fitted from the duplicate room (centroid to
   centroid, scale from the areas in pixels, rotation as chosen - default 0); without a duplicate room, centred
   with the calibrated metres.
2. On the other floor's editor draft: remove the walls wholly inside the duplicate room, their openings, and the
   objects, labels, same-floor connectors inside it; prune circuits and groups; walls crossing its outline are kept
   and listed.
3. Anchors inside the duplicate room: a resource the home room already has is dropped (the mirror shows it);
   anything else is moved to the home floor at the un-transformed position - never lost; each is listed in the
   preview and audited.
4. The duplicate zone is deleted (soft); the share row is inserted; audit `zone.share` (both floors),
   `geometry.shared.convert` on the other floor with the counts.

The preview answers the same lists without writing. `DELETE /zones/{zone_id}/share/{floor_id}` un-shares;
`PATCH /zones/{zone_id}/share/{floor_id}` adjusts the placement.

## 9. Out of scope

- A shared room whose home floor is in another building; sharing to a floor without a plan.
- Automatic re-fit of the placement when either floor gets a new plan version with another crop (the placement is
  in plan pixels of the current versions; "יישור" is a PATCH away and the editor warns when the mirror leaves the
  plan).
- Mirroring cross-floor stairs (each floor already has its twin), `rooms[]` document entries and uncertain regions.
- The SVG / PNG export draws the mirrored structure but not the chip; the per-floor iso thumbnail does not cut the
  room.
- A devices-area badge per room (HA areas are not linked to Arx rooms).
- Publishing the home floor from the other floor's publish button.

## 10. Build status

Built on branch `pilot/CR009-shared-space` (from `g0/intake` 6e8a86a), 2026-09-29; not merged, no version bump.

| Commit | What |
|---|---|
| 41dc766 / 058242c | this note, its Hebrew mirror, T093 (R187-R189, AT187-AT189) |
| bc0fe93 | backend: migration `0036_shared_spaces.sql`, `services/shared_spaces.py`, the routes and every reach site |
| 1f979cf | frontend: `map/shared-space.ts`, chip, editing from the other floor, share dialog, 3D, search, building page |
| ebab091 | live spec; the editor reloads its structure after a share / un-share |

As designed, with these precisions:

- `PUT …/geometry` plans every home-floor write before the first write (an API error still commits the request's
  transaction): 409 `stale_revision` with `details.shared`, 422 `shared_outside`, 422 `geometry_structure` for a
  malformed shared item, and a client that does not echo `shared_spaces` routes nothing (it can never delete the
  room by omission). An untouched mirror writes nothing home (integral floats compared as a browser sends them).
- Reach for the drawing: `access.camera_reach_floors` is the one rule behind `floor_reach` "cameras" and the site
  tree. A camera in a shared room opens the OTHER floor's drawing only for a binding on the camera itself - a user of
  floor 0 reaches the hall's cameras but not floor -1's map (§6 "nothing else of the home floor").
- Deny: a camera's chain holds both floors (deny on either floor or on the camera wins); entities and the drawing honour
  an explicit deny on the home floor (`ha_scope.FloorSet.denied`, `_can_attach`).
- Read-only pieces are also `locked`; a new opening on one is dropped in the editor (`guardShared`).
- Shared items show on every level filter (2D, anchors, 3D); the home levels appear in the level bar as
  "<level> · <home floor>".
- The share dialog lists the floors the person may edit (`…/geometry/link-targets`), nearest first; the source floor
  defaults to the lower one (decision 4).

Tests (all run on 2026-09-29, workstation, Python 3.12 / Node 24):

- Backend: `tests/test_shared_spaces.py` 14 passed (placement maths, membership and clipping, conversion preview and
  apply with audit, attach on draft / published / ETag / bundle / export never stored or hashed, edit routing incl.
  add / delete / read-only / moved-out / stale / malformed / echo-less, anchors and zone through the placement,
  permissions matrix: floor-B-only user, deny on the home floor, deny on the hall camera, share rights, the other
  floor's editor, un-share at once, history, camera-only reader). Targeted modules around it (rbac camera scope,
  stairs, geometry integration and binding, zones, search, anchor 3D, circuits search, backup, HA, devices, events,
  events cache, correlation, rbac, rbac matrix, access, push, catalog images) with it: 252 passed. The full suite was
  not run here (the coordinator's run).
- Frontend: `tsc --noEmit` clean; `npm run build` OK; `tests/unit-shared-space.spec.ts` 6 passed; all `unit-*` specs
  219 passed (at 1f979cf).
- Live: `tests/evidence-shared-space.spec.ts` 1 passed (`SW_LIVE=1`, a throwaway backend on its own port and data
  directory, preview on its own port): convert from floor 0, the hall whole on both floors with the chip, the tribune
  moved on floor 0 lands in floor -1's draft, floor 0's live map shows it after publishing. The owner's real plans
  were not used.

Known limits (besides §9): the room's hole in the upper plate is its bounding box; the placement is in the current
plan versions' coordinates (a new version with another crop needs "יישור", which has an API but no UI yet); the
historical map shows a shared room as it was when the floor's structure was published; an edit from the other floor
raises the home draft's revision, so an editor open on the home floor reloads on its next save (as with the stairs'
twin sync); B's editor lists the home floor's levels in its level bar; the devices area (HA areas) has no per-room
"משותף" badge - the building page's floor card counts the shared cameras instead.
