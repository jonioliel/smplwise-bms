# CR-ZONECOUNT107 - people count per area, derived from Frigate (board item r107)

Status: slice 1 (backend only) built on `pilot/ZONECOUNT107-295` from `origin/main` (v2.12.4, `320e5555`). Migration 0149 (built as provisional 0160;
renumbered at the 2.14.0 integration; `0149_zone_counts.sql`). Default OFF. No frontend in this slice.

## 1. Goal

Show how many people are in each area right now and how that changed over time (for example "lobby: 3 now, peak 7 today"), using the object
detections Frigate already produces per camera and per Frigate zone. It is **read-only** (Arx never writes to Frigate and this module sends no
request to it at all) and **privacy-preserving**: Arx keeps counts only - no faces, no identities, no snapshots, no Frigate object or review
ids, short and configurable retention.

Not a goal in slice 1: people tracking across rooms, de-duplication of one person seen by two cameras, access/door correlation, headcount
limits and alerts ("more than N people"), a screen.

## 2. What exists today (study)

* `services/recorders/frigate_events.py` ingests Frigate **review items** (WebSocket `/ws` primary, polling `GET /api/review` always on) into
  `frigate_reviews` (one row per review id: camera key `source_ref`, `start_ts`, `end_ts` NULL while open, `objects_json`, `zones_json`,
  `detections_json`, `last_seen_at`) and mirrors each as an `events` row. A poll re-applies every item of the last 10 minutes and up to 20 older
  open items by id on each round, so `last_seen_at` of an open item advances while Frigate still reports it open.
* `tracked_object_update` / `events` WebSocket frames are only treated as "a poll is due" hints today; their payload shape is NOT VERIFIED
  (CR-FRIGATE-LIVE-0180-REPORT). Review items are therefore the only trustworthy source, and the count is derived from them.
* `services/presence.py` is the **phone-app** presence of employees (CR-027). It is unrelated and untouched.
* Areas are the mirrored Home Assistant areas (`ha_areas`), the same ids plan rooms (`spatial_zones.ha_area_id`), energy meters and elevators use.
* RBAC has no area scope. Scopes are installation / site / building / floor / camera / access station. A camera's chain is its floors plus the
  installation.

## 3. Mapping Frigate -> Arx areas

Table `zone_count_map(recorder_id, camera_key, frigate_zone, area_id)`, unique per (recorder, camera, zone):

* `frigate_zone = ''` maps the **whole camera view** to an area (every review of that camera counts);
* `frigate_zone = 'lobby_zone'` maps only reviews whose `zones` contain that Frigate zone name;
* an area may be fed by several rows (several cameras / zones); a camera may feed several areas only through different Frigate zones (one row per camera and zone);
* `camera_key` must be an imported camera of that recorder (`cameras.source_ref`), `area_id` an existing `ha_areas` row. Mappings are edited with
  `system.configure` (audited); they are never inferred automatically.

## 4. Counting semantics (slice 1)

* **Current count** of an area = the sum, over the **open** review items (`end_ts` IS NULL) that match a mapping of the area and were re-seen
  within 180 s (`REVIEW_STALE_S`), of the **people in the review**, counted **once per area per review** even when two mappings of one area match.
* **People in a review** = the number of `person` entries in the review's `objects` list. Other labels (car, dog, ...) never count. Whether Frigate
  repeats `person` once per tracked object or lists it once per review is NOT VERIFIED on a live instance, so the figure is a **lower bound**
  until that is verified (owner question 3).
* A review's `zones` is the union over all its objects, so a review whose people stand in two mapped zones adds its whole people count to **both**
  areas (an over-count by design in slice 1).
* **Stale events expire**: a review that is closed, or open but not re-seen for 180 s, stops counting at once. Frigate closes a review 30-40 s
  after the last object leaves, so a person who left is still counted for up to ~40 s.
* **Unknown is not zero**: an area whose recorder has no successful poll within 300 s (`frigate_sync_state.last_poll_at`, or the last poll failed)
  reports `count = null`, `known = false`. A sample is stored as NULL in that case.
* **No de-duplication across overlapping cameras** is attempted in slice 1: two cameras that see the same room are summed, so one person seen by
  both counts twice. Map such a room with ONE camera (or one zone) until a later slice adds a policy (owner question 2).
* Open reviews older than the poll overlap beyond the 20 refreshed by id per round can go stale while still open in Frigate (undercount in a very
  busy site). Recorded as a known limit.

## 5. The data kept

| Table | Content | Personal data |
| --- | --- | --- |
| `zone_count_map` | recorder id, Frigate camera key, Frigate zone name, area id, creator user id, created at | none |
| `zone_count_samples` | area id, UTC instant, **integer** count (NULL = unknown) | none |

* A sample is written by the Frigate event path (after each poll and each frame batch, inside its existing write transaction, errors swallowed so
  ingestion never breaks) when the value **changed** or the last sample of the area is older than the 300 s **heartbeat**. A gap longer than two
  heartbeats in the series means "unknown".
* **Retention**: setting `occupancy.retention_days`, default 7, range 1-90; pruned at most hourly; additionally capped at 20 000 rows per area
  (oldest first) and rows of an area that is no longer mapped are deleted. The series endpoint never returns more than the retention.
* **Switching the feature OFF deletes every sample** (the mapping stays). While OFF nothing is written.
* REL2140 review M-2: `occupancy.enabled` and `occupancy.retention_days` are installation privacy policy - never exported or restored by a backup
  (`backup.SETTINGS_KEEP`). The main janitor (`zone_counts.janitor`) deletes every sample left while the switch is OFF (whatever switched it off
  without the PUT delete) and applies the retention hourly while it is ON, also when no Frigate poll runs; an OFF install with no samples only
  reads.
* The review rows the count is read from are the existing `frigate_reviews` (their own retention is unchanged); no copy of their ids, labels or
  thumbnails is made.

## 6. Privacy

Counts only. No faces, no identities, no sub-labels (the `sub_labels` field is never read), no snapshots or clips, no Frigate object / review ids
in the table or the API. **Occupancy of a room can still be sensitive** (who is working late, an empty building), so reading it is a sensitive,
never-implied permission, judged per camera (section 7), the feature is OFF by default, and every settings/mapping change is audited. Employment
law: counting people at work places is a monitoring measure; the employee notice (CR-027 section 7) is the place to mention it before it is
switched on at a workplace (owner question 6).

## 7. Permissions

* **New** `occupancy.view` - sensitive, never implied, not a system permission (assignable to a custom role). Built-in holder: `system_admin` only
  (recommendation, owner question 5). Registered in `roles.json`, the design contract and `PERMISSION_LABELS`.
* Scope: an area is visible to a caller only when `occupancy.view` is allowed on **every camera that feeds the area** (a mapped camera that is
  not imported yet is judged at the installation). A deny binding on any feeding camera hides the area. An area the caller may not see is not
  listed and its detail answers 404 (its existence is not revealed).
* Mapping and switches: `system.configure` at the installation.

## 8. API (`/api/v1/occupancy`, router `routers/occupancy.py`)

| Route | Permission | Answer |
| --- | --- | --- |
| `GET /occupancy/areas` | `occupancy.view` per area | `{as_of, items:[{area_id, name, count, known}]}` |
| `GET /occupancy/areas/{area_id}?hours=24` | same | `{area_id, name, as_of, count, known, series:{from,to,hours,start_value,points:[{at,count}],max}}` |
| `GET/PUT /occupancy/settings` | `system.configure` | `{enabled, retention_days, ...}`; PUT `{enabled?, retention_days?}`; OFF deletes samples |
| `GET/POST /occupancy/mappings`, `DELETE /occupancy/mappings/{id}` | `system.configure` | the mapping rows |

While OFF the two read routes answer **409 `occupancy_disabled`**. `hours` is 1-2160 and is cut to the retention. The routes only read Arx's own
tables; the count is computed at request time from the open reviews, the series from `zone_count_samples`.

## 9. Tests (`tests/test_zonecount107_295.py`, fake review items, no Frigate)

Zone mapping (zone / whole camera / unmapped camera / unmapped zone), count up and down, only `person` counts, several cameras summed,
once-per-area dedup of mappings, a review in two zones, stale open review expires, source-not-fresh -> unknown, mapping validation, sampling on
change + heartbeat, unknown stored as NULL, retention purge + per-area cap + unmapped area rows, the real `_apply_frames` hook feeds the series and
is silent while OFF, no personal columns exist, routes OFF by default (409), current count + series over the API, null count, permission and
camera-scope (viewer sees nothing; a camera-scoped holder sees only areas fed by that camera alone; a deny binding hides the area), OFF deletes
the samples, retention validation and the series bound, mapping routes.

Not covered (NOT_RUN by design): a real Frigate (nothing is contacted), the `reviews` frame shape on a live instance, any UI.

## 10. Slices

1. **(this CR) Backend**: tables, ingestion hook, service, routes, permission, tests.
2. Better source: per-object zones from Frigate's tracked-object data (`GET /api/events?in_progress=1` or verified `events` frames) instead of the
   review union - removes the two-zone over-count and the "one label per review" uncertainty. Needs a verified payload shape first (read-only lab
   check with the owner's approval).
3. Frontend: a count chip on area / plan room cards and a small history chart (separate task card; design assets from the area redesign).
4. Policies: overlapping-camera policy (max instead of sum), capacity thresholds and notifications, optional hourly roll-ups kept longer than the
   raw series.

## 11. Rollback

Additive: two tables, one router, one permission, a no-op hook. Leave `occupancy.enabled` off (the default) or run the previous version; the
tables are ignored by it. Deleting the data: switch the feature OFF.

## 12. Owner questions (recommendation first)

1. Default retention of the series: **(a) 7 days (recommended)**, (b) 1 day, (c) 30 days.
2. Two cameras covering one room: **(a) map one camera per room for now and take the maximum later (recommended)**, (b) sum them (current
   behaviour), (c) build a de-duplication policy first.
3. May a read-only lab check of the real Frigate show how `person` appears in a review's `objects` and in `GET /api/events?in_progress=1`
   (one GET each, nothing written)? **(a) yes, before slice 2 (recommended)**, (b) no, accept the lower bound.
4. Should the count also cover vehicles or other labels later? **(a) people only (recommended)**, (b) add a label list setting.
5. Who may read counts by default: **(a) system_admin only, others by custom role (recommended)**, (b) also site_admin, (c) operators too.
6. Is the employee notice text to be extended before this is switched on at a workplace? **(a) yes, lawyer-reviewed wording first (recommended)**,
   (b) not needed.
7. Alerts such as "more than N people in an area" - **(a) later, a separate item (recommended)**, (b) include in slice 4 now.
