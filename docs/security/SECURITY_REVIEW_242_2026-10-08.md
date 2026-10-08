# Security review - releases 2.4.1 / 2.4.2 (origin/main 31fe5d7c)

Date: 2026-10-08. Task SEC242, branch `pilot/SEC242-review`, worktree `C:\cloude\wt-SEC242` (from origin/main 31fe5d7c = release 2.4.2).
Scope: what is new relative to the previous security baseline (release 2.3.1 / 2.4.0, `git diff 70c5a875..31fe5d7c`) in the backend, the
bridge custom component (both copies) and the allow-lists. Generated files, `www` bundles, fixtures and evidence images were ignored. No
device, lab host, Frigate, NVR or Home Assistant was contacted. No finding was fixed in this task.

Areas, highest risk first:
1. The Frigate write class `config` (FRGS, CR-029 section 13): `services/frigate_config_svc.py`, `services/recorders/frigate_config.py`,
   `routers/frigate_config.py`, migration 0072, the `frigate_http.WRITE_ALLOWED["config"]` entry, `frigate_control_svc.revert`.
2. PLNS, anchor references follow the reader's camera scope: `services/plan_anchor_scope.py`, `routers/plan_geometry.py`,
   `routers/plan_package.py`, `services/plan_package.py`, `services/shared_spaces.py`.
3. SEC3, persisted block counters: migration 0071, `ha_user_auth.RateLimiter`, `alarm_codes.Lockout`, `main.py` janitor / startup / shutdown.
4. Bridge 0.8.0 allow-list additions (`valve.open_valve` / `close_valve`, `vacuum.pause`, `water_heater.turn_on` / `turn_off`) in
   `custom_components/smplwise_bridge` and `smplwise_vms/integration/smplwise_bridge` (identical, `diff -r` clean), `services/ha_bridge.py`,
   `services/health_report.py`.
5. Window walls and curved walls (document schema 2.1): `services/wall_path.py`, `services/plan_glass.py`, `services/plan_geometry.py`,
   `services/plan_geometry_render.py`, `services/plan_dxf_map.py` (DXF arcs / bulged polylines), `services/plan_dxf_export.py`.
6. Equipment cards (CARD1): `services/devices.py`, `services/device_activity.py`, `routers/devices.py`, `services/ha_sync.py`.

Method: code reading of every changed backend file in the list above, plus proofs of concept against the in-process test client and the
fake Frigate only. Paths below are relative to `smplwise_vms/backend/smplwise/` unless stated otherwise.

What was run:
- On the runner (`private/runner/run_smart.py backend pilot/SEC242-review ...`, header SHA 3dc015f5): the new PoC file
  `tests/test_security_review_242_poc.py` (8 tests) together with `test_frigate_config`, `test_plan_anchor_scope_plns`,
  `test_block_counters_sec3`, `test_bridge_080`, `test_card1_equipment_path`, `test_wall_curves`, `test_plan_glass`: **107 passed**.
  A second run of the two M1 PoCs with `-s` gave the measurements quoted in M1 (2 passed).
- On the workstation, a scratch measurement of the pure function `wall_path.sampled_wall` (no app, no network), quoted in M1.
- NOT_RUN: the full backend suite, the frontend suites, anything against a real Frigate / NVR / Home Assistant.

The PoC tests assert the CURRENT (unfixed) behaviour of each finding, so they pass while the finding is open and fail on purpose once a fix
lands (invert them into regression tests then, or drop them). They are in their own commit.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 8 |
| Informational | 8 |

| ID | Severity | Component | Title |
|---|---|---|---|
| M1 | Medium | `services/wall_path.py:84-185`, `services/plan_geometry.py:557-563` | Curved walls: unbounded sampling amplification (memory / CPU DoS) |
| M2 | Medium | `services/plan_anchor_scope.py:95-104`, `services/plan_geometry.py:1103-1127` | PLNS: a body bound to a hidden camera still shows the camera's position and heading |
| L1 | Low | `routers/plan_geometry.py:135-152, 371-377`, `services/plan_package.py:621` | PLNS: stored document hashes confirm a guessed hidden camera id offline |
| L2 | Low | `services/plan_anchor_scope.py:111-147`, `services/plan_package.py:597-610` | PLNS: `anchor_hidden` 422 and the import preview are existence oracles for camera ids |
| L3 | Low | `services/plan_anchor_scope.py:131-147` | PLNS: a scoped editor can still overwrite or drop a reference they were not shown |
| L4 | Low | `services/ha_user_auth.py:615-700` | SEC3: every distinct client address becomes a live key and a persisted row, with no cap |
| L5 | Low | `services/recorders/frigate_config.py:295-329` | FRGS: the instance-schema walk recurses without a visited set (RecursionError / exponential fan-out) |
| L6 | Low | `services/frigate_config_svc.py:71-90, 152-156`, `services/recorders/frigate_config.py:266-275` | FRGS: zone delete + undo silently loses the zone fields Arx does not model |
| L7 | Low | `services/device_activity.py:62-75`, `services/device_bulk.py:115, 130` | CARD1: a valve / water heater wired as a `switch` opens without confirmation and in bulk "switches on" |
| L8 | Low | `custom_components/smplwise_bridge/__init__.py:294-330` (both copies) | Bridge 0.8.0: `execute` passes `data` through, so the new valve pair can target every valve |

## MEDIUM

### M1 - Curved walls: unbounded sampling amplification (memory / CPU denial of service)
- Where:
  - `services/wall_path.py:84-88` (`_steps`): every arc is cut into at most 128 chords and at least `sweep / MAX_STEP` chords; a bulge of
    `MAX_BULGE = 4` (about 303 degrees) always gives 61 chords, whatever the radius.
  - `services/wall_path.py:158-185` (`sample_with_s`): materialises every chord point as a Python tuple (and `sampled_wall` a list per point).
  - `services/plan_geometry.py:557-563` (`_check_walls`): for every wall with `bulges`, `pg.validate` samples the whole path to check the
    bounds. There is no limit on the number of corners of a wall, on the number of curved segments of a document or on the total sampled
    points; the only cap is the request body (16 MiB for `PUT .../geometry`, `body_limit.py:134`) or the package JSON limits
    (`plan.json` 8 MiB and 400 000 containers, `services/plan_package.py:51-53`).
  - Other callers that repeat the sampling on the same document: `shared_spaces.py:394, 859, 1733`, `plan_geometry.py:873`
    (`transform_crop`), `plan_geometry_render.py` (`_curved_wall`, SVG / PNG / DXF exports), `plan_door_tool.py`.
- Attack (remote, authenticated, needs `map.edit` on one floor, i.e. the editor role): `PUT /plan-versions/{id}/geometry` with one wall whose
  polyline zig-zags in a tiny area and has `bulges` of 4 on every segment. Each JSON segment (about 26 bytes) becomes 61 sampled points.
  The same document reaches `detect/accept` (merged candidates are validated), the package preview / import (`plan.json`) and the
  shared-room edits.
- Evidence:
  - `test_poc_m1_one_curved_wall_samples_to_about_61_points_per_segment`: 3000 segments (about 80 KB of JSON) -> 183 001 points
    (runner, 0.15 s).
  - `test_poc_m1_the_editor_route_samples_an_amplified_wall_before_any_size_check`: the editor's `PUT` of that wall answers 200 and samples
    it twice in the request (366 002 points).
  - Workstation measurement of `sampled_wall` alone: 20 000 segments (0.53 MB of JSON) -> 1.22 M points, 295 MB peak (tracemalloc),
    2.4 s without tracing. That is about 550x memory amplification. A 16 MiB body (about 600 000 segments) extrapolates to about 37 M
    points and roughly 9 GB per call, and the request samples at least twice: the add-on (and on a small HA host, Home Assistant itself)
    is OOM-killed by one request. The package import path (8 MiB, 400 000 containers) reaches about 24 M points.
- Compared with 2.2.0 M3 (about 25x JSON amplification, Medium): the same class of issue, more than an order of magnitude worse, reachable
  by one ordinary editor request.
- Confidence: high (measured). Exploitable: remotely, authenticated (map.edit).
- Minimal fix:
  1. Cap the corners of one wall (for example 512) and the curved segments of one document (for example 5 000), refused as structural in
     `_check_fields` before any sampling.
  2. Count the chords with `_steps` (cheap arithmetic) before sampling and refuse a document whose total exceeds a budget (for example
     200 000 points).
  3. Check the arc bounds analytically (the arc's bounding box from centre, radius and sweep) instead of materialising every sample.
  4. Apply the same caps to the DXF import's curved output (`plan_dxf_map.py`, bulged polylines and arcs are not counted today) and to
     `merge_candidates`.

### M2 - PLNS: a body bound to a hidden camera still shows the camera's position and heading
- Where:
  - `services/plan_anchor_scope.py:95-104` (`redact`): only `anchor_ref` is set to `null`; the item keeps its `position`, `rotation_deg`,
    `item_id`, `label` and `size`.
  - `services/plan_geometry.py:1103-1127` (`apply_anchor_positions`): on every save and publish the store copies the anchor's position and
    rotation into the bound object, so the stored position IS the camera's position and heading.
  - The design note says so (`docs/changes/ST5-PLAN-PACKAGE-DXF.md`, PLNS "Known limits": the body is drawn "where the last save put it,
    which is the anchor's position at that save"); the anchors list, the floor bundle and the DXF devices layer hide the same camera.
- Attack (remote, authenticated, any `map.read` on the floor with the camera denied): read `GET /plan-versions/{id}/geometry` (or the SVG,
  PNG, DXF, the signed package, the historical `?at=` read). The body that followed the hidden camera sits exactly on its anchor, with its
  rotation; a catalog item or label chosen for a camera ("camera body", "כספת") makes the meaning obvious. The 2.2.0 M2 fix and PLNS both
  intend to keep a denied camera's position from that reader.
- Evidence: `test_poc_m2_a_body_bound_to_a_hidden_camera_still_shows_the_cameras_position_and_heading`: `ron` (vault camera denied) cannot
  list the vault anchor, but his geometry read shows `o-vault` at `[0.6, 0.4]`, the vault anchor's position.
- Confidence: high (proven). Exploitable: remotely, authenticated. Impact: the position and heading (not the identity, see L1) of a camera
  the reader is denied.
- Minimal fix (choose one; the first is the simplest and matches "withhold what is bound to the hidden anchor"):
  1. Treat a body whose reference is hidden as hidden: drop the item from the served document and the exports, and carry it back on write by
     id exactly as `carry_hidden` carries the reference (a writer cannot delete what they were not shown).
  2. Or serve such a body at a neutral position (for example the position it had before it was bound, stored on bind), never the anchor's.
  Either way the SVG / PNG / DXF / package follow automatically, since they are built from the redacted document.

## LOW

### L1 - PLNS: stored document hashes confirm a guessed hidden camera id offline
- Where: `routers/plan_geometry.py:135-152` (`_payload`: `geometry.doc_hash` and `published_hash` are the STORED row's hash, also for a
  redacted reader), `routers/plan_geometry.py:371-377` (`timeline`: the stored `doc_hash` of every published row, to any floor reader,
  camera-only readers included), `services/plan_package.py:621` (preview `current_hash` / `result_hash`).
- Scenario: the served document differs from the stored one only in the withheld `anchor_ref`. A reader who holds candidate camera ids (an
  old export, an event link, ids seen before a deny) recomputes `doc_hash` with each candidate and learns which hidden camera a body is
  bound to. Camera ids are 64-bit random (`db.new_id`), so blind guessing is not feasible; the oracle confirms, it does not enumerate.
- Evidence: `test_poc_m2_the_stored_doc_hash_confirms_which_camera_a_redacted_body_is_bound_to`.
- Fix: for a reader whose document was redacted, serve opaque revision tokens (for example an HMAC of the stored hash with a server key, or
  the hash of the redacted body, as the ETag already does); keep the stored hash for unredacted readers and for the server's own compares.

### L2 - PLNS: `anchor_hidden` and the import preview are existence oracles for camera ids
- Where: `services/plan_anchor_scope.py:111-147` (`exists_here` / `fix_item`: a hidden reference that exists is refused with 422
  `anchor_hidden`, one that does not exist is stored with only the `anchor_missing` warning); `services/plan_package.py:597-610` (the
  preview's `anchors_missing` / `anchors_unplaced` are computed for every camera id the uploaded package names, without the caller's scope).
- Scenario: an editor with a camera deny submits a reference (or a package `anchors.json`) with a candidate id: 422 = a registered camera,
  200 = not; the preview additionally tells "registered but not placed here" from "placed on this floor". Same precondition as L1 (a
  candidate id).
- Evidence: `test_poc_l_anchor_hidden_answers_differently_for_a_registered_camera_and_an_unknown_id`.
- Fix: decide on scope alone: refuse any new camera reference the writer's scope does not allow, whether or not it exists; in the preview,
  report hidden ids as `anchors_missing` (or omit them) for a scoped caller.

### L3 - PLNS: a scoped editor can still overwrite or drop a reference they were not shown
- Where: `services/plan_anchor_scope.py:131-147` (`fix_item`): a hidden stored reference comes back only when the writer sends `null`. A
  writer who sends any other reference that is not hidden-and-existing (a visible camera, or an unknown id: kept, see L2) replaces it, and
  deleting the item deletes it. An administrator who imports a package exported by a scoped editor (its `plan.json` has the `null`s) silently
  unbinds every such body (`carry_hidden` is a no-op for an unscoped importer).
- Impact: integrity only (bindings of cameras the editor may not see are lost); no read of hidden data.
- Fix: for an item whose stored reference is hidden, keep the stored reference whatever the writer sends unless they hold the camera; for
  the delete, at least warn. Mark a redacted package in its manifest (`document.redacted: true`) and make the import preview warn that the
  package's bindings were withheld.

### L4 - SEC3: every distinct client address becomes a live key and a persisted row, with no cap
- Where: `services/ha_user_auth.py:615-633` (`hit`: the 20 000-key sweep only drops keys idle for longer than the longest window, one hour),
  `:639-659` (`flush`: every dirty key is written in one transaction every 30 s), `:792-801` (`client_ip`: `CF-Connecting-IP`, else the first
  `X-Forwarded-For` hop, full IPv6 address, no /64 aggregation).
- Scenario: the IP limiter is hit before the token is validated (`exchange`, `_bearer_session` after a parseable `exp`) and on the public
  routes (`auth/app-download`, `.../file`, `logout`, `csp-report`). An unauthenticated client rotating IPv6 addresses (a /64 is enough), or
  spoofing the header where the remote channel is not behind Cloudflare, creates one live key per request: memory grows for an hour per key
  (pre-existing) and, new in SEC3, the same number of rows in `block_counters` plus a growing write transaction every 30 s. The per-address
  limit itself is also bypassed by the rotation (pre-existing).
- Also: `flush` clears `_dirty` before writing; a `sqlite3.OperationalError` (busy) drops that batch until the keys change again, and up to
  30 s of hits are lost on an unclean stop (OOM kill), so a crash still returns a little budget.
- Evidence: `test_poc_l_every_distinct_client_address_becomes_a_persisted_counter_row` (5 000 addresses -> 5 000 rows and 5 000 live keys).
- Fix: a hard cap on live keys (evict the oldest), aggregate IPv6 to /64, persist only keys that are close to a limit (for example at least
  half of a window's cap), cap the rows of one flush, and put the batch back into `_dirty` when the write fails.

### L5 - FRGS: the instance-schema walk recurses without a visited set
- Where: `services/recorders/frigate_config.py:295-329` (`_resolve` limits a `$ref` chain to 20 hops, but `_children` recurses into
  `anyOf` / `allOf` / `oneOf` and `_has_path` into every child, with no visited set and no node budget).
- Scenario: `GET /frigate/{rid}/config/schema?verify=true` (system.configure) against a hostile or compromised Frigate (or a MITM where TLS
  is `trust`): a self-referencing `anyOf` raises `RecursionError` (an unhandled 500, no audit); `anyOf: [B, B]` nested a few dozen levels
  deep (well inside the 3 MB cap) is exponential CPU in a request thread.
- Evidence: `test_poc_l_a_self_referencing_instance_schema_raises_recursion_error`.
- Fix: a visited set keyed by `id(node)` / `$ref` and a node budget (for example 50 000 visits); catch `RecursionError` and answer
  `{"checked": false}`.

### L6 - FRGS: zone delete + undo silently loses the zone fields Arx does not model
- Where: `services/frigate_config_svc.py:71-90` (`delete_zone` stores `comparable(cur)`: points, objects, inertia, loitering time only),
  `:152-156` (`revert_kind` writes that back), `services/recorders/frigate_config.py:266-275` (`write_zone(None)` sends `{name: ""}`, which
  removes the whole zone).
- Scenario: a zone that also carries `filters`, `speed_threshold`, `distances` (or any field of a newer Frigate) is deleted and undone. The
  undo reports `verified: true` (the comparison covers only the modelled fields) but the other fields are gone from Frigate's persisted
  configuration. Integrity of a security-relevant setting (detection filters of a zone); needs system.configure.
- Evidence: `test_poc_l_zone_delete_then_undo_loses_the_fields_arx_does_not_model`.
- Fix: keep the raw zone (an allow-listed key set, JSON-sized cap) in `before` for a delete and restore it on undo; or refuse to delete a
  zone that has keys Arx does not model (show it read-only, as an unparsable zone is today).

### L7 - CARD1: a valve / water heater wired as a `switch` opens without confirmation and in bulk "switches on"
- Where: `services/device_activity.py:62-75` (`switch_equipment`: the server now names a `switch.*` whose name says ברז / השקיה / valve /
  irrigation a `valve`, and דוד / boiler a `water_heater`), while the controls stay `switch.turn_on` (routine, no confirmation, reachable
  with `devices.control`) and `services/device_bulk.py:115, 130` (`switches_on`) turns every such switch on in one bulk request unless an
  administrator protected it (CR-019).
- Contrast: the real `valve.open_valve` is `attention` (confirmation) and needs `ha.entity.control`. The same physical risk (water flowing)
  has two policies, and the product now knows which switches are valves but does not use it.
- Fix: feed `switch_equipment` into the risk: require the confirmation for `switch.turn_on` on a switch classified `valve` (and optionally
  `water_heater`), and leave such switches out of `switches_on` (or offer them to the CR-019 protection list automatically).

### L8 - Bridge 0.8.0: `execute` passes `data` through, so the new valve pair can target every valve
- Where: `custom_components/smplwise_bridge/__init__.py:294-330` (identical in `smplwise_vms/integration/smplwise_bridge/`): after the
  signature and the `(domain, service)` allow-list, `data` is passed to `hass.services.async_call` as sent. It only checks that
  `entity_id` is truthy: it does not bind the entity's domain to the service domain, and it does not refuse `entity_id: "all"`, a list,
  a comma-separated string, or `area_id` / `device_id` / `floor_id` targets.
- Scenario: defence in depth only. The add-on side is correct (`ha_bridge.validate_action` binds the domain and builds `data` from one
  registered entity id). A holder of the pairing secret (a compromised add-on) can already call every allow-listed pair; with 0.8.0 that
  includes `valve.open_valve` with `entity_id: "all"` (every valve of the house) under any active user's context.
- Fix (bridge 0.8.1, both copies): for the new pairs (ideally for all), require `data["entity_id"]` to be ONE string `"<domain>.<object_id>"`
  matching the service's domain, refuse `all`, lists and the other target keys, and refuse any key outside the pair's argument list.

## INFORMATIONAL

- I1: `confirm: true` and `supervised: true` on the config writes are client-asserted flags (as 2.2.0 I1). They are UX safeguards. The real
  controls are sound: `system.configure` on the camera (`_camera_row` and again in `_gate`), the class OFF by default (0072 copies the rows
  and adds no row), and `supervised` honoured only for a holder of `system.configure` at installation scope (`check_supervised`).
- I2: The config writes and the config read have no rate limit. Every `GET .../cameras/{cid}/config` (video.live on the camera plus any
  control permission) fetches the whole `/api/config` from Frigate; writes need system.configure. Consider a short per-user limit.
- I3: The undo of a config change is single-shot (the 2.2.0 I2 claim is in place), but between the stale check and the write Frigate can
  still change (TOCTOU on the Frigate side, a short window); a refused (stale / not reversible) undo writes no audit row.
- I4: `CAMERA_KEY` (`services/recorders/frigate.py:39`) still admits `.`. Frigate's `config/set` flattens `config_data` keys on `.`, so a
  camera key with a dot would address another path of the YAML. Not reachable (Frigate refuses such camera names and the keys come from
  Frigate's own list); for the config class alone, require `[A-Za-z0-9_-]`.
- I5: A zone or setting write that makes Frigate's configuration invalid (for example zone objects that the camera does not track) is
  expected to be refused by Frigate, which restores the previous file on a parse error (Frigate source, NOT verified for 0.18). If that ever
  does not hold, a persisted invalid configuration stops Frigate at its next restart. Include this in the supervised first-write session.
- I6: `alarm_codes.Lockout` now runs SQL while holding its `threading.Lock`. Safe today because every caller passes a write connection that
  holds SQLite's write lock from `BEGIN IMMEDIATE`; a future caller with a read connection would get a silent `OperationalError` (the
  window then lives in memory only). Worth a comment at `fail`.
- I7: `valve.open_valve` is `attention` (a confirmation), not `sensitive` (its own grant). Opening a main water valve may deserve a grant;
  a product decision.
- I8: The bridge's nonce cache is in memory: after a Home Assistant restart a captured signed message can be replayed within the timestamp
  window (pre-existing; an attacker needs a captured message from the add-on to the bridge on the internal network).

## Checked and sound

- FRGS / config class:
  - The write allow-list adds exactly `PUT /api/config/set` under class `config`; `/api/config/save`, restart and `config/set` under any
    other class stay refused (`test_the_schema_check_is_a_control_read_never_a_plain_read`); the schema check is a control read only.
  - What is written is constructed server-side from an allow-list: zone names `[a-z0-9_]{1,40}` (fullmatch; no dots, slashes,
    `__proto__`-style traversal or newline), labels `[a-z0-9_]{1,40}` (at most 30), points 3..40 finite numbers in 0..1 with a real area,
    integers and numbers range-checked (bools refused, NaN / inf refused), keys only from `SETTINGS` and of the named section, one section
    of one camera, the update topic built from the validated camera key and a fixed section name. The body is capped (`WRITE_BODY_MAX`) and
    pydantic models are `extra="forbid"`; a zone named like its camera is refused.
  - No SSRF: the Frigate base URL is the stored recorder setting; nothing in a request reaches the host or the path.
  - The camera read returns only the curated fields (no inputs, RTSP credentials, ONVIF, `ffmpeg`), proven by
    `test_a_camera_view_carries_zones_relative_and_curated_settings_only`. Frigate error bodies are never relayed (status and exception type
    only).
  - Every applied, unverified or failed write writes a `frigate_changes` row and an audit row; a class-off refusal and a first-write refusal
    are audited; an undo needs the same permission, class, confirmation and supervision as the write.
  - Migration 0072 copies every policy row unchanged and only widens the CHECK list; with the class off nothing is ever written.
- PLNS:
  - Every geometry read path of the plan router goes through `_shown_r` (draft, published, `?at=`, PUT / copy-from / detect-accept answers,
    SVG, PNG, DXF), and the signed package builds from the redacted document with matching hashes; the preview / import never return the
    planned document (`pkg_svc.public`).
  - The ETag of a redacted body is computed over that body, so another reader's cached copy is never confirmed.
  - Writes carry hidden references back by item id (and wall id + panel number), never across collections; new hidden references to an
    existing anchor are refused (editor routes) or dropped (import); shared-room edits apply the same rule through `plan_edits(fix=)`.
  - Anchor resource types are only `camera` and `ha_entity` (`routers/anchors.py:323`), matching the visibility rule.
- SEC3:
  - Keys are `scope + ip/user/panel` (no code, token or secret is stored); rows expire (`expires_at`) and are pruned by the janitor and by
    every flush; restore loads only unexpired rows and drops future timestamps; the hot path of the sign-in limiter does not touch SQLite.
  - The alarm lockout keys stay user (personal PIN) and user + panel (panel code), so the 2.2.0 rule that an arm-only user cannot lock
    disarming for everyone holds; a lock in force is still also in `alarm_lockouts`; the TOTP lockout was already persisted (0069).
  - No lock inversion between `Lockout._lock` and SQLite with the current callers (write connections take the lock at `BEGIN IMMEDIATE`).
- Bridge 0.8.0 / CARD1:
  - Both copies are identical; the add-on maps each new action to its own domain (`validate_action` refuses another entity domain and any
    argument), the entity must exist and be enabled, `valve.open_valve` asks for the confirmation, and `devices.control` does not reach
    `valve`, `vacuum` or `water_heater` (`DEVICES_CONTROL_DOMAINS` unchanged; `test_card1_equipment_path`).
  - The signed payload keeps the timestamp window + nonce + HMAC-SHA256 with constant-time compare; the health notice compares only the
    bridge-reported version string.
  - The new cards expose only named attributes (`battery_level`, `fan_speed`, `status`, `current_position`, temperatures), and `ha_sync`
    stores only `fan_speed` and `status` beyond the previous allow-list.
- Window walls: `MAX_PANELS = 200`, operable list at most 200, operations from a fixed enum (the only panel text that reaches DXF XDATA);
  curved DXF arcs are paired only below `MAX_PAIR_CURVES = 2000` (no quadratic pairing beyond) and the DXF import runs in the worker pool
  under the detect timeout.

## Not reviewed

- The frontend (FRGD / FRGS panels, the zone editor, the equipment cards, Plan Studio glass / curve tools) and the `www` bundle.
- The DXF parser itself (ezdxf) and the full `plan_dxf_map.py` beyond the curved-wall additions; memory limits of the DXF worker pool.
- The real Frigate wire shape of `config/set` and its validation / restore behaviour (I5), anything on a real instance.
- Mobile apps, the push relay, release scripts, documentation-only changes.
- A full regression run (only the related suites above were run).

## Top 5 to fix first

1. M1: cap corners per wall, curved segments per document and total sampled points before any sampling; analytic arc bounds.
2. M2: withhold (or neutralise) the pose of a body bound to a hidden camera, not only its reference.
3. L4: cap and aggregate the sign-in limiter's keys; persist only keys near a limit.
4. L8 + L7: bind the bridge's new pairs to one entity of their own domain; give valve-like switches the valve's confirmation and keep them
   out of bulk "switches on".
5. L1 + L2: opaque hashes and scope-only refusals for redacted readers / writers.
