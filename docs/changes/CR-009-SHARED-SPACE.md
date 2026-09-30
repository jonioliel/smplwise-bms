# CR-009 — Shared space: one room that belongs to two floors (the double-height sports hall)

**Numbering:** registered as CR-009 on 2026-09-29 (CR-008 remote access is the previous record).

**Status:** Approved for development by the owner on 2026-09-29 from a mockup. Task T097 (registered as T093 on the
branch, renumbered at the merge with g0/intake - T093 is CR-010's). This note is the design
agreed before the build; §10 records the first build. **§11 (the owner's answers and the security review, the same
day) supersedes §3-§8 and §10 wherever they differ, and §12 (the security re-review and the owner's answers of
2026-09-30) supersedes §11** - above all: each floor keeps its own outline and walls of the room (two-outline model),
the room's content is what lies in its home outline or is explicitly marked as its content, cameras and devices are
shared by an explicit member list (reach only while anchored on the room's floors), publishing the other floor
publishes the room's pending changes on its home floor, and one tribune rises from the court through the upper floor's
level with an entry row (no slab ring). **§13 and §14 (owner decisions of 2026-09-30, later that day) add WisKey stations as
members of a shared space and one-step deletion of a shared room; §13 supersedes the last sentence of §12.2 item 3.**

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
-- migration 0038_shared_spaces.sql (0036 is CR-010's alarm, 0037 the shell's user prefs)
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
- ~~Publishing the home floor from the other floor's publish button.~~ Done differently by owner answer 1 (§11.1):
  only the room's content is published there.

## 10. Build status

Built on branch `pilot/CR009-shared-space` (from `g0/intake` 6e8a86a), 2026-09-29; not merged, no version bump.

| Commit | What |
|---|---|
| 41dc766 / 058242c | this note, its Hebrew mirror, T093 (R187-R189, AT187-AT189) - now T097 (R199-R201, AT199-AT201) |
| bc0fe93 | backend: migration `0036_shared_spaces.sql` (now `0038_shared_spaces.sql`), `services/shared_spaces.py`, the routes and every reach site |
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

## 11. Revision: the owner's answers and the security review (2026-09-29)

After the first build the owner answered three questions and an independent security review returned
CHANGES_REQUIRED. Both were built on the same branch; this section is the design as it now stands.

### 11.1 Owner answers

1. **Publish (answer ב):** publishing the OTHER floor also publishes the shared room's pending changes on its home
   floor - only the room's content (objects, labels, same-floor connectors, circuits, groups inside the room); the rest
   of the home draft stays a draft, and an item moved out of the room in the home draft keeps its published place.
   `map.publish` on the floor being published is the grant; a principal with an explicit deny (map.publish, map.edit or
   map.read) on the home floor publishes nothing there. Only when the home floor's editor version is its published plan
   version. Planned and validated before any write (422 `geometry_invalid` with `home_floor_id`), rolled back on error
   (`rollback_and_restart`). Audit `geometry.shared.publish` on BOTH floors. The diff (`GET …/geometry/diff`) and the
   draft read return `shared_pending: [{home_floor_id, home_floor_name, zone_ids, changes}]`; the publish answer
   returns `shared_published`. The editor's publish button appears when the room has pending changes, and the dialog
   says "כולל שינויים באולם המשותף (קומה ‎-1)" with the count. Publishing the home floor works as before.
2. **Settings "מפה" (הגדרות › מפה):** `map.default_view` = `2d` | `3d` (default `2d`) - the live map, the history map and
   the event page open in 3D when the floor has a structure (no per-device memory of the last choice existed, and none
   was added; the 2D / 3D button still switches per visit); `plan.levels` mirrored there (the key and its place on the
   media tab stay); `map.shared_levels` = `show` | `hide` (default `show`) - whether the editor's level bar lists the
   shared room's home levels. Validated in `routers/settings.py` (422 on another value), audited as every setting.
3. **Two-outline model (answer ב + details):** the hall is wider on the upper floor, so each floor keeps its OWN outline
   and its own walls and openings of the room; only the CONTENT (tribunes, markings, objects, lighting, circuits) and
   the member cameras / devices are shared.
   - `shared_spaces.other_zone_id` names the other floor's outline zone. At conversion the duplicate room is KEPT as
     that outline, with the walls along it (`boundary_walls_kept`); only duplicate content inside it is removed
     (interior walls such as a second drawing of the court's lines, objects, labels, connectors). Without a duplicate
     room an outline is created from the home room.
   - The room's region (membership of content) is the union of the home outline and the other outline mapped home.
     Walls and openings are never attached nor routed; `guardShared` claims only content.
   - Map: every entry carries `other_polygon` / `other_label`. The court's floor draws the upper outline dashed with a
     light tint and "מפלס עליון" (content inside it but outside the court - the upper rows - is the hall's and draws
     normally); the upper floor draws the court thin dashed with "מפלס תחתון". Never hit-tested.
   - 3D (`sharedVolumes` + `Builder.sharedVolume`): the lower outline stands from the court up to the upper level, the
     upper outline from there to the upper ceiling; each floor stands its own walls along its own outline and the view
     adds the other floor's outline as thin walls (`vol:<zone>#lower.<i>` / `#upper.<i>`). ~~At the step between them a
     slab ring at the upper level, unless a tribune stands in the ring~~ - removed 2026-09-30 (§12.2). The upper
     plate's opening is the whole upper outline (its bounding box); the court level's plate spans the lower outline.
   - Placement check: when the lower outline does not fall inside the upper one the entry says `aligned: false`, the
     editor's issue list and the share dialog warn "ודא את יישור הקומות". No alignment screen (the PATCH exists).

### 11.2 Security review - what changed

- **B1 explicit members.** New table `shared_space_members(zone_id, resource_type camera|ha_entity, resource_id,
  added_by/at, removed_by/at)`, set at share time from the cameras and devices anchored inside the room and changed
  only by `POST /zones/{id}/share/members` / `DELETE /zones/{id}/share/members/{type}/{rid}` with the share rights
  (map.edit + placement.edit on every floor of the room, `require_camera_placement` for a camera). Reach
  (`mirrored_anchor_floors`, `access.camera_reach_floors`, `ha_scope.placements`) follows membership only - an anchor
  moved or drawn into the room grants nothing. The editor shows "מצלמה בתוך האולם שאינה משותפת - הוסף?" on a
  candidate with an add button, and "הסר מהחלל המשותף" on a member. A polygon edit needs the rights on every floor that
  shows the room.
- **B2 write hardening.** An "addition" whose id exists in the home document is refused (422 `shared_id_taken`);
  circuits and groups must have all members inside the room (422 `shared_outside`); a circuit's switch cannot be
  changed from the other floor (422 `shared_switch`); walls and openings are never routed.
- **M1** a deny on the home floor is honoured on writes (403 `shared_denied`, nothing written); a missing item is never
  deleted - the client lists deletions in `shared_deleted` (`sharedDeleted(base, doc)`); no revision leaks in 403 /
  409 bodies; the same rules for the anchor edit scope.
- **M2** every home write is planned first, written in an order that cannot fail halfway, and rolled back on error.
- **M3** conversion: `require_camera_placement` for every member camera; a camera whose home anchor lies elsewhere
  keeps its anchor on the other floor (`kept`); no clamping of positions outside the room.
- **M4** deleting a shared zone answers 409 `zone_shared`; `accept_zones` (replace_auto) keeps shared zones.
- **M5** un-share and member removal call `revocation.mark` (open streams re-checked).
- **M6** the published GET answers 304 before building the attach; `shared_tag` hashes without parsing documents;
  `rbac.camera_floors` reads the member table.
- **L1** a reader who may not read the home floor gets "קומה אחרת" for its name and no home levels, hashes or version
  ids; the ETag hashes only what the reader gets. **L3** tests for a deny on floor B (cameras and entities alike).
  **L5** anchors created from B use the editor's plan version. **L7** the dialog always sends `duplicate_zone_id`; the
  un-share confirm says the removed duplicate content does not come back. **L8** a backup from before migration 0036 (now 0038)
  restores (both tables emptied), and a backup of a shared room round-trips.

### 11.3 Build status of the revision

| Commit | What |
|---|---|
| 7cf6e5b | merge of `g0/intake` (for `rollback_and_restart`) |
| 74ee105 | security review B1, B2, M1-M6, L1, L3, L5 + the two-outline backend |
| 1c5fde5 | publish from the other floor (answer 1), settings keys (answer 2), member delete trigger, tests incl. L8 |
| 7eef429 | frontend: outlines on the map, 3D volume, share dialog, members, shared deletions, publish count, הגדרות › מפה |
| fe2d380 | live spec for the wider upper floor |

Tests (run 2026-09-29, workstation):

- Backend: `tests/test_shared_spaces.py` 21 passed; with 23 related modules (access, rbac, rbac camera scope, rbac
  matrix, zones, search, anchors 3D, backup, devices, events, events cache, correlation, HA authority, push, catalog
  images, circuits search, geometry api / store / binding / integration / stairs, settings) 288 passed. Full suite not
  run here.
- Frontend: `tsc --noEmit` clean, `npm run build` OK; `tests/unit-shared-space.spec.ts` 9 passed (content drawn on
  every level, claim of content only, shared deletions, 409 merge, the volume from two outlines, the 3D of both floors
  with the ring and the tribune rule, hint and search); all `unit-*` specs 237 passed.
- Live: `tests/evidence-shared-space.spec.ts` 2 passed on a throwaway backend (floor 0's outline 2 m wider on each
  side): conversion keeps floor 0's outline and walls, both dashed outlines, the upper rows on floor -1, the tribune
  moved from floor 0, the publish dialog's count and the publish on floor -1, both floors in 3D, the map opening in 3D
  from הגדרות › מפה. The owner's real plans were not used.

Known limits of the revision: the upper plate's hole and the court plate are bounding boxes; the ring is drawn at the
upper level of the step whatever the tribune's real footprint (one tribune anywhere in the ring suppresses it); the
member list is edited per anchor in the editor (no bulk screen); the alignment warning has no alignment screen; the
publish count is per item, not per field.

## 12. Security re-review and the owner's answers (2026-09-30)

A second security review of §11 closed both blockers and verified B2, M1-M6, L1, L3 and L5; it raised three mediums
and five lows. The owner answered three more questions the same night. All built on the same branch.

### 12.1 Re-review fixes

- **N1 - reach only while anchored.** A member reaches the room's floors only while it has a live anchor on one of
  them (`mirrored_anchor_floors`, `member_share_floors`, `camera_shared_floors`). Deleting a member's last anchor on
  the room's floors ends its membership (audit `zone.share.member_remove`, reason `anchor_removed`; `revocation.mark`):
  a hall camera taken off the map and placed elsewhere is no longer reachable from the hall's other floor.
- **N2 - switches.** A NEW circuit written from the other floor may only reuse a switch that a circuit of the room
  already uses, unless the actor holds `ha.entity.control` on that entity (a delete + add in one save cannot bring in
  any switch).
- **N3 - content is explicit.** The home outline holds the room's content by geometry; the part under the upper level
  (the other outline brought home) holds only items that carry `shared_space_id` = the room's home zone id. The home
  floor's own items there, on its own level (a storage room under the tribune), stay its own: not attached, not
  writable or deletable from the other floor, not published by its publish. An item drawn or moved there from the other
  floor gets the id from the server; on the home floor the editor's "חלק מהחלל המשותף" sets it. The field is validated
  (string, 1-64) and documented in `plan_geometry.v2.schema.json`.
- **Lows:** an addition may not reuse a wall or opening id of the home floor; the mirrored-content cache key carries
  the home floor's name; a publish from the other floor that trips over draft items (a level or group that exists only
  in the home draft) answers 422 `shared_invalid` naming them, and `POST …/geometry/publish {shared_skip}` publishes the
  rest while those keep their published version (the dialog offers "פרסם בלי הפריטים האלה"); `ensure_schema`, run at
  start after the migrations, gives a database that recorded the first shape of the migration the `other_zone_id`
  column and the members table; a member anchor moved from another floor's map stays inside the room's outline on its
  own floor.
- **Merge with g0/intake:** the migration is `0038_shared_spaces.sql` (0036 the alarm, 0037 the shell's user prefs);
  the task is T097 with R199-R201 / AT199-AT201. An alarm-managed member (CR-010 `alarm.managed_controls`) stays
  read-only on every floor that shows it.

### 12.2 Owner answers

1. **Wording (ג):** the UI says "חלל משותף", never "אולם", unless it is the room's own name - e.g. "כולל שינויים בחלל
   המשותף (קומה ‎-1)".
2. **The tribune through the upper floor's level.** There is no slab between the two outlines in the owner's building:
   ONE tribune spans the height, entered from floor 0 straight into its middle and from floor -1 onto the parquet. So
   nothing horizontal is generated anywhere inside a shared space except the objects the user places (the ring is
   gone). A stepped object of a shared space standing on the lower floor (`sharedUpperLevel`) has a bottom (its level +
   z) and a top (bottom + its height, possibly above the upper level); `tribuneLayout` shares the rise to the upper
   level evenly among k rows (k from the nominal step, `params.step_height_m` or height / rows) so that row k-1 - the
   ENTRY ROW - tops out exactly at the upper floor's level (computed from the floor heights and the levels'
   elevations, the room's datum), and the same step continues to the top. The entry row carries an access landing:
   the stairs model's landing plate reused (`LANDING_PLATE_M`, the circulation colour, the `#landing` part); the
   stepped tribune itself had no intermediate landing, so the entry row is new. A door of the upper floor's own
   outline whose centre lies on the tribune's footprint (`tribuneEntrances`) is its entrance: the upper floor's 2D map
   shows "כניסה לטריבונה" at it, and the 3D a threshold from the door to the landing at the upper level.
3. **Members list (ב):** "חברים בחלל המשותף" in the room's panel (editor, either floor) and on the live map when a shared
   room is selected: cameras, door stations and devices, each with the floor it is anchored on; "הסר" per row and
   "הוסף" from the anchors of the room's floors for whoever holds the share rights on both floors (removing now needs
   them too, like adding); read-only for everyone else. Visibility (owner's rule): whoever reaches ANY floor that
   contains the shared space sees, of its members, exactly what their own permissions allow per member - a camera
   through `camera_scope` (a deny on it hides it), a device through its entity's visibility - in the list and on the
   maps alike (`GET /zones/{id}/share/members`, the map bundle). Door stations are members when they are placed on the
   map as entities; WisKey stations are installation-scoped and have no anchor, so they cannot be members (superseded by §13: they are listed members, without reach).

### 12.3 Future work (not built)

**Camera security.** The owner plans personal permissions per person for a camera or a camera group. The membership
model must compose with it: a member camera is visible through a shared space only if the viewer's own camera
permissions allow that camera. This already holds structurally - the members list, the map bundle and every reach
site filter a member camera through `camera_scope` / the camera chain, and membership only ever adds floors to a
camera's chain, never a grant - so the per-person camera rule has to live in that one place (`access.camera_scope`,
`rbac` camera bindings) and the shared space will follow it without a change of its own; a test of the combination
belongs to that work.

### 12.4 Build status of 2026-09-30

| Commit | What |
|---|---|
| e0c670f | N1 |
| 7f5c526 | N2 |
| ee4cf0a | N3 |
| ff1a0f8 | lows (ids, cache name, publish skip, schema guard, anchor moves) |
| 2509418 | merge of g0/intake (alarm) |
| 70ac916 | alarm-managed member read-only test |
| 6293f28 | generic wording |
| 68d4154 | no ring; the tribune through the upper level, entry row, landing, entrance |
| 55b7e9a | migration 0038, task T097 |
| c1dd26d | members list API, per-member filtering |
| 56f03df | members list UI (editor, live map), live spec |

Tests (run 2026-09-30, workstation): backend `tests/test_shared_spaces.py` 27 passed; with 25 related modules (the §11.3 set plus alarm and migrations) 332 passed; frontend `tsc --noEmit` clean, `npm run build` OK, `unit-shared-space` 11 passed, all `unit-*` 239 passed; live `evidence-shared-space` 2 passed on a throwaway backend (screens `wide-*` outside the repository). Full backend suite not run here.

Known limits: the entry row's landing is drawn across the row (1.6 m wide, centred on the door when there is one); the
2D symbol of a tribune still draws `params.rows` lines, not the derived rows; the tribune's rows are derived only when it
stands on the lower floor of a shared space; door stations only as placed entities.

## 13. WisKey stations as members of a shared space (owner decision, 2026-09-30)

**Decision.** Every WisKey station (door station / intercom) may be a member of a shared space, like cameras and HA
entities. `resource_type` is now `camera | ha_entity | wiskey_station`; for a station `resource_id` is WisKey's station id
(the `id` of the served overview, at most 128 characters).

**What "member" means for a station - precisely, because this is the security-relevant part.** A station has no map
anchor and no floor (`access.read` is installation-scoped, T054), so unlike a camera or an entity a station member adds
**no reach at all**. The room only *lists* it. Nothing in `services/access.py` (`_chains`, `camera_scope`, `floor_reach`),
`rbac.camera_floors`, `services/ha_scope.py`, the map bundle or the events / search / catalog filters reads a station
member: the reach helpers (`mirrored_anchor_floors`, `member_share_floors`) skip every type outside `ANCHORED_TYPES`
(`camera`, `ha_entity`), and the anchor rules (N1 "reach only while anchored", `end_unplaced_memberships`) never apply to a
station. What a reader gets through a room, per station member, is exactly this and nothing more:

| Through the room | Yes / no |
|---|---|
| The fact "this station belongs to this space", its WisKey id and its display name (`name` of the served overview) | yes, in `GET /zones/{id}/share/members` and the members lists (editor room panel, live map) |
| Online / ringing / call state, last access, people, cards, events, the station's camera still or stream, host / model / firmware, lock names | **no** - none of it is in the members answer; each stays behind its own WisKey route (`/intercom/...`, `access.read` at installation scope), which a membership never changes |
| Any command: door release (`access.release`), answering / rejecting / hanging up, an announcement, card capture, people writes | **no** - a member grants no control; those routes authorise on their own permissions, at installation scope, exactly as before |
| An icon / marker on the map | no map marker (a station has no position); the members list shows an icon per kind |

**Who sees a station member.** Only a reader who holds `access.read` at installation scope - the WisKey model, reused
through one helper (`shared_spaces.station_visible`, the same check as `routers/access_control._reader`). It fails closed:
an inactive user, a deny, any error, an empty or over-long id is "not visible". Because `access.read` has no floor or
site scope, a floor-scoped reader who reaches the room's cameras never sees its station members (the rest of the list is
unchanged for them); an installation-wide viewer sees the stations by name, which the entry center already shows them. If
WisKey later gets a per-station or per-area scope, it composes in that one helper. A station that WisKey no longer
reports (served copy present, id absent) is listed only for a manager, as "עמדה שאינה קיימת עוד ב־WisKey", so it can be
removed.

**Who may add and remove.** The same share rights as a camera - `map.edit` + `placement.edit` on **every** floor of the
room (`_share_rights`) - and, to add, also `access.read` at installation scope (the audited 403 names it) and a station
that exists in WisKey's served copy (404 for an unknown id, 503 `intercom_unavailable` when WisKey has no honest copy).
No anchor is needed (`not_placed` applies to cameras and entities only). Removing a station member needs the share rights AND `access.read` at installation scope, checked (audited 403)
before the lookup, so a caller who cannot see stations can neither remove one nor tell a member from a non-member by 404
vs 204 (Opus review); removing a camera or an entity still needs the share rights only (it narrows). `candidates` lists the stations of the served copy that are not members yet, for a manager who holds
`access.read`.

**Revocation and audit.** A station member ends with the last un-share (`unshare`), with the room's deletion (§14), with a
floor delete (`end_for_floor` - its SQL is type-blind, so the hardening path already ends station members) and by
`DELETE /zones/{id}/share/members/wiskey_station/{id}`; each marks revocation like other members. Audit rows are the
existing ones: `zone.share.member_add` / `zone.share.member_remove` with `resource: "wiskey_station:<id>"`.

**UI.** `sw-share-members` (room panel of either floor, live map): an icon per kind (camera, door station, device,
WisKey station), the chip "עמדת WisKey", the line "מוצג בכל קומות החלל" (a station has no floor), a search box over the
picker for whoever may manage, and "הסר" per row.

**Schema.** The CHECK of `shared_space_members.resource_type` grows by `'wiskey_station'`. SQLite cannot alter a CHECK: the
text of `0038_shared_spaces.sql` carries the wider CHECK for new databases and `shared_spaces.ensure_schema` (run at start,
after the migrations) rebuilds the table of a database that ran the earlier text (rows copied, indexes and triggers
recreated, one transaction; idempotent). No new migration number was taken, so this cannot collide with another branch's.

**Tests.** `tests/test_shared_space_stations.py` (backend: list / add / remove, exact answer shape, no reach in any helper,
a floor-scoped reader does not see them, an installation reader does, the fail-closed helper, the rights and 404 / 503 /
422 paths, a stale member, un-share and floor delete end them, the schema widening keeps rows and constraints);
`frontend/tests/evidence-shared-space-stations.spec.ts` (live, against the real backend with the WisKey fixture
`tests/fixtures/wiskey_fake_ha.py`: search, add, icon in the editor and on the live map, remove).

**Open point for the owner.** Because `access.read` is installation-only, floor-scoped users never see station members. If
the owner wants a floor-scoped reader to see the door stations of a room she reaches, that needs a per-station scope in
the WisKey permission model first - not a change here.

## 14. Deleting a shared room in one step (owner decision, 2026-09-30)

**Before.** `DELETE /zones/{id}` on a shared room answered 409 `zone_shared` ("בטל את השיתוף לפני מחיקתו") and a mirror
floor showed no delete button and no explanation.

**Server.** `DELETE /zones/{id}?with_unshare=true` on the room's **home** zone ends every share of the room, its members
and the room itself in one request - one transaction, all or nothing: every right is checked before the first write
(`map.edit` + `placement.edit` on **all** floors of the room, like un-share; a deny on any floor answers 403 and writes
nothing), the writes cannot fail halfway, and an unexpected error rolls the whole request back (tested). Audit as the two
steps would have written: `zone.unshare` per floor (`reason: "zone_deleted"`), then `zone.delete` (`unshared_floors`);
`revocation.mark` so the other floors lose reach on the next request. Cameras, entities and their anchors are not touched
(they are the room's members, not its content), nor is anything else in the plan documents; a floor's own outline of the
room stays as an ordinary room on that floor. Without the flag a shared room still answers 409 `zone_shared`, now with
`details.home_zone_id`, `home_floor_id` and `home_floor_name` - only for a caller who may read the home floor, otherwise
`home_floor_name` is "קומה אחרת" and nothing else (no ids, no `floors`); the map bundle and the shared-room marks hide the names of
floors the reader may not read the same way (`can_name`), so the editor offers no jump to an unreadable home floor and its
confirmation prints "קומה אחרת" for such floors. Revocation is marked before the commit and once more after it (a background
task runs after `CommitBeforeSend` commits), so a stream that recomputes on the first mark cannot keep the old reach; the
same for un-share and member removal; a call for another floor's outline zone, with the
flag, also answers 409 (it is deleted from the home floor).

**Home floor UI.** "מחק אזור" on a shared room opens ONE confirmation - "החדר משותף עם <floors>. המחיקה תבטל את השיתוף,
תסיר את חברי החלל ותמחק את האזור. המצלמות והישויות לא נמחקות." - and on confirm sends the one call, then reloads the floor.

**Mirror floor UI.** The delete button stays hidden. The zone panel shows the note "האזור נוצר בקומה X — מחק אותו שם, או
בטל שיתוף כאן" and a button "עבור לקומה X" (not shown when the reader may not read the home floor: the server names it
"קומה אחרת") that saves pending edits and opens the home floor's editor with the room selected
(`#/explore/floors/<home>/edit?zone=<id>`; the shell keys the editor by floor). "בטל שיתוף" stays.

**Tests.** `tests/test_shared_space_stations.py` (the plain 409 with the home floor, the flag from the home zone, an outline
zone refused, rights on every floor and nothing written on a refusal, a deny on one floor, rollback on failure, an ordinary
room unchanged); `frontend/tests/evidence-shared-space-stations.spec.ts` (the mirror note and the jump, the single
confirmation text, refuse then confirm, the API state after).
