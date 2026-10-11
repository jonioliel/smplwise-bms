# Security review - candidate 2.4.7 (origin/integ/247 a8b6a21d)

Date: 2026-10-12. Task SEC247, branch `pilot/SEC247-review`, worktree `C:\cloude\wt-sec247` (from origin/integ/247 a8b6a21d,
Plan Studio 6: the three merges S0+S4, S1+S2, S3 on top of the 2.4.6 gate follow-ups). Review only: no product code was
changed; the proofs of concept are in `smplwise_vms/backend/tests/test_security_review_247_poc.py` (own commits).

## Scope

`git diff origin/main...origin/integ/247` (origin/main = release 2.4.6 095ca474; 174 files, +13354 / -346). The 2.4.7 candidate
does NOT contain the SEC246 fixes (`origin/pilot/SEC246-fixes` is unmerged into both main and integ/247); those are re-verified
separately below, read-only. Backend: every changed file under `smplwise_vms/backend/smplwise/` (routers plan_bakes, plan_view,
anchors, catalog, me, settings; services plan_bakes, plan_view, plan_studio6, plan_geometry, plan_package, plan_catalog,
user_prefs, backup; body_limit, main; migrations 0074 / 0075). Frontend: the new map and screen files that touch URLs, HTML
sinks, uploads, fetches or stored ids (`api/bakes.ts`, `api/plan-view.ts`, `api/maps.ts`, `map/bake-runner.ts`,
`map/still-bake.ts`, `map/sw-plan-stills.ts`, `map/still-render-scene.ts`, `map/plan3d-assets.ts`, `map/material-resolve.ts`,
`map/studio6-fields.ts`, `map/walk-*.ts`, `map/scene-real*.ts`, `screens/floor-stills.ts`, `screens/explore-floor-map.ts`,
`screens/system-diagnostics.ts`), plus a grep of every added frontend line for `innerHTML` / `unsafeHTML` / `unsafeCSS` /
`insertAdjacentHTML` / `eval` / `new Function` / `document.write` / `srcdoc` / remote URLs / loaders. The `public/plan3d/`
asset files and their `MANIFEST.json`, and `scripts/plan3d_manifest.py`, were inspected for provenance, licence and embedded
URIs. Generated `www` bundles, evidence images, documentation-only and test-only changes were not reviewed beyond the diff. No
device, lab host, Home Assistant, NVR, go2rtc or Frigate was contacted.

Paths below are relative to `smplwise_vms/backend/smplwise/` unless stated otherwise.

## Method

Code reading of every changed backend file above and of the listed frontend files; a scratch probe of the content-sniffing,
walk-position validation and package-merge code (Pillow, Python 3.12, no app, no network); and proofs of concept against the
in-process test client with fakes only.

What was run:
- On the runner (`private/runner/run_smart.py backend <branch> ...`):
  - header SHA (pilot/SEC247-review): `tests/test_security_review_247_poc.py` - **3 passed** (every PoC holds, i.e. every
    finding it covers is open on integ/247).
  - re-verification of the SEC246 fixes, on `origin/pilot/SEC246-fixes`: `test_security_review_246_poc.py`,
    `test_security_review_242_poc.py`, `test_ui_background.py`, `test_lat1_toggle_latency.py`, `test_device_types.py`,
    `test_devices.py`, `test_backup.py`, `test_self_update_switch.py`, `test_self_update_s4_downgrade.py`,
    `test_floor_images.py`, `test_ha_authority.py` - **145 passed, 1 failed**. The one failure is
    `test_lat1_toggle_latency.py::test_toggle_reaches_ha_and_pushes_back_without_waiting`, a push-latency envelope (median
    167 ms vs a ~137 ms bound) under the shared runner's load + a 40/s state stream; it is a timing benchmark, not a security
    assertion, and every SEC246 / SEC242 security PoC and regression in the same run passed.
- On the workstation (one process, the repo venv): `tests/test_security_review_247_poc.py` - 3 passed.
- NOT_RUN: the full backend suite, the frontend suites (unit / evidence / tsc), the Plan Studio 6 frontend renderer against a
  real GPU, anything against a real Home Assistant or device, and browser behaviour of the stills / mask files beyond the
  response headers.

The PoC tests assert the CURRENT (unfixed) behaviour, so they pass while a finding is open and fail on purpose once a fix lands.

Severity rubric (as in the 2.4.2 / 2.4.6 reviews): Critical = unauthenticated compromise or safety bypass; High = privilege
escalation, cross-scope data exposure or a physical action without its control; Medium = an ordinary authenticated role can
deny service or read data it is denied; Low = needs an administrator / a holder of a specific scope, defence in depth,
integrity or audit gaps with a narrow trigger; Informational = hardening, consistency, or no demonstrated impact.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 1 |
| Informational | 5 |

| ID | Severity | Component | Title | Owner decision needed |
|---|---|---|---|---|
| M1 | Medium | `routers/plan_bakes.py:55-72`, `services/plan_bakes.py` (`file_of`, `bundle_part`, `describe`) | A room mask served to a `map.read` reader lists cameras that reader's camera scope denies | No |
| L1 | Low | `services/plan_bakes.py:203-212, 650-667` (`bake_key`, `describe`) | `GET /floors/{id}/bakes` hands a scoped reader the stored geometry `doc_hash` / `geometry_key` (the 2.4.2 L1 oracle) | No |
| I1 | Info | `services/plan_studio6.py:193-260`, `contracts/schemas/plan_geometry.v2.schema.json` | A saved walk position keeps extra keys and an untrimmed name past the schema's `maxLength 40` | No |
| I2 | Info | `services/plan_bakes.py:509-536` (`_evict`) | A bake upload on one floor can evict stale bake rows / files of other floors (installation cap) | No |
| I3 | Info | `routers/settings.py:142-146, 370-374`, `services/plan_view.py` | `site.latitude` / `site.longitude` are returned to every settings reader (a viewer) | No |
| I4 | Info | `services/plan_studio6.py:92-93, 207-211` | Walk-position and material ids accept any character (unlike the mask ids' `MASK_ID`); safe only because Lit escapes | No |
| I5 | Info | `frontend/public/plan3d/MANIFEST.json`, `scripts/plan3d_manifest.py` | The asset licence / provenance manifest is enforced only by a frontend unit test and a human-run script, never at runtime | No |

## MEDIUM

### M1 - A room mask served to a `map.read` reader lists cameras that reader's camera scope denies
- Component: `routers/plan_bakes.py:46-72` (`list_bakes`, `bake_file`: `require(P_READ, ("floor", floor_id))` only),
  `services/plan_bakes.py:383-412` (`validate_mask`: cameras are kept whole), `:670-699` (`bundle_part`: current masks by url),
  frontend `map/still-bake.ts:290-325` (`buildMask`: every camera of the live description), `map/bake-runner.ts:112`.
- Description: an editor's browser renders a floor's room masks and uploads them (the add-on has no 3D renderer). `buildMask`
  puts every camera of the editor's live scene into the mask document (`cameras: [{id, p}]`, the projected pixel position).
  The mask is stored once per `(level, preset)` and served by `GET /floors/{id}/bakes/{id}/file` (and listed by the floor map
  bundle) to anyone holding `map.read` on the floor - with no camera-scope filtering. The 2.4.2 M2 fix and the SEC244 follow-up
  established that a reader whose camera scope hides a camera must not see that camera's id, position or heading: the geometry
  reads serve it at a withheld position, the DXF / SVG exports and the signed package drop it, and the skins / geometry keys are
  built over the redacted document. The bake files bypass all of that. A floor viewer with a per-camera deny (the SEC244
  threat model: `ron`, a viewer of the floor denied the vault camera) reads the vault camera's id and its exact projected
  position from the mask.
- Exploit scenario: cross-scope read. `ron` is a floor viewer explicitly denied one camera (a vault / back-office camera).
  The geometry read, the anchors list and the exports all withhold it from him. He opens `GET /floors/{id}/bakes`, follows the
  mask url, and the JSON hands him the denied camera's id and its position on the plan - which lets him locate a camera he was
  not allowed to know exists.
- Evidence: `test_poc_f1_a_room_mask_leaks_a_denied_cameras_id_and_position_to_a_scoped_viewer`: an object is bound to the
  vault camera and the structure published (so the geometry read withholds the vault reference from `ron`); the administrator
  uploads a mask listing the lobby and vault cameras; `ron` (viewer on the floor, vault denied) reads the mask file and the
  vault camera's id and `p:[420,210]` are both present, although `vault not in geometry.text` for him.
- Confidence: high (proven). Exploitable: any floor `map.read` holder with a per-camera deny; the floor must have a baked mask
  (an editor who can see the camera baked it). Camera-only readers (reach == "cameras") cannot reach the route - they hold no
  `map.read` at floor scope and the bundle gives them `bakes: None`.
- Recommendation: redact the mask for the reader the same way the geometry read is redacted. Either (a) build the mask bundle
  and serve the mask file through the camera scope - drop a `cameras[]` entry whose id the reader's `camera_scope` does not
  allow (and, like the geometry read, omit the whole bundle for a reader with a withheld reference, or serve a per-reader
  filtered copy); or (b) store masks without camera outlines and draw the cameras client-side from the already-scoped bundle
  `cameras` / anchors list (`sw-plan-stills` already receives the scoped bundle). Option (b) also removes the need to re-bake
  masks when camera placement changes.

## LOW

### L1 - `GET /floors/{id}/bakes` hands a scoped reader the stored geometry `doc_hash` / `geometry_key`
- Component: `services/plan_bakes.py:203-212` (`bake_key`: `skins_store.geometry_key`, the STORED key), `:650-667`
  (`describe`: returns `bake_key`, `geometry_key`, `doc_hash` from the stored values), `routers/plan_bakes.py:46-52`.
- Description: `describe` builds `geometry_key` and `doc_hash` from `skins_store.geometry_key(conn, floor_id)`, which returns
  the stored published `doc_hash`. The SEC244 fix for 2.4.2 L1 added `skins_store.served_geometry_key` precisely so that a
  reader from whom a reference is withheld is handed keys built over the document as redacted for them, and every geometry /
  skins endpoint was moved onto it. `plan_bakes` did not adopt it, so `GET /floors/{id}/bakes` hands a scoped reader the stored
  `doc_hash` and `geometry_key`, while the geometry read hands them a different (redacted) hash. This re-opens the offline
  hash oracle of 2.4.2 L1 on the new route (a scoped reader can confirm a guessed hidden-camera id by reproducing the stored
  hash).
- Exploit scenario: the same narrow oracle as 2.4.2 L1 - a scoped reader (a camera denied, a reference withheld) obtains the
  stored structure hash, against which an offline guess of the hidden reference can be checked. No bake need exist on the floor
  (`describe` answers without one).
- Evidence: `test_poc_f2_the_bakes_endpoint_hands_a_scoped_reader_the_stored_doc_hash_oracle`: with an object bound to the
  denied vault camera, `ron`'s geometry read returns a redacted `doc_hash`, but `GET /floors/{id}/bakes` returns the
  administrator's stored `doc_hash` to `ron` (and it differs from his geometry hash).
- Confidence: high (proven). Exploitable: a floor reader with a withheld reference; defence-in-depth / integrity only, no data
  beyond the hash.
- Recommendation: build the `bakes` response's `geometry_key` and `doc_hash` from `served_geometry_key(conn, floor_id,
  anchor_scope.visibility(conn, principal, floor_id))`, as the skins endpoint does; keep the stored key for the server's own
  stale-check and for the editor's upload comparison. (The upload's `geometry_changed` check must keep comparing to the stored
  key, exactly as the skins control-image upload keeps the real key behind `served_key` - review the two together.)

## INFORMATIONAL

- I1 - A saved walk position keeps extra keys and an untrimmed name past the contract's `maxLength 40`. `plan_studio6.check`
  validates the STRIPPED length of a name (`1 <= len(p["name"].strip()) <= 40`) and `check_doc_fields` validates only the
  structural types of the listed keys; neither rejects an extra object key nor a very long untrimmed name. The contract
  (`contracts/schemas/plan_geometry.v2.schema.json` `walk_position`: `name maxLength 40`, no `additionalProperties`) is not
  enforced server-side. Bounded only by the 16 MiB geometry-document body limit and by `MAX_WALK_POSITIONS = 50`, and it is
  per-floor presentation data (map.edit), so no escalation. Evidence: `test_poc_ia_...`. Recommendation: reject a walk position
  with an unknown key, and bound the raw `name` length (not only the stripped one), so the server and the schema agree.
- I2 - `_evict` frees room for an upload by deleting stale rows oldest-first; for the installation total cap it deletes stale
  rows of ANY floor (`for r in list(stale)` across floors), unlinking their files. An editor who holds `map.edit` on floor A
  and uploads a bake can therefore delete another floor's STALE bakes (rows and files). Stale rows are never served (the bundle
  shows current rows only) and are re-created on the next bake, so the effect is limited to forcing a re-bake of an unrelated
  floor; still, it is a cross-floor side effect of a single-floor permission. Recommendation: evict stale rows of the uploading
  floor first and only; for the installation cap, prefer refusing (`storage_full`, as it already does for current rows) over
  deleting another floor's data, or make cross-floor eviction an explicit maintenance action.
- I3 - `GET /settings` returns `site.latitude` / `site.longitude` (the site's geographic position, added for the realistic
  sun) to every settings reader, a viewer included (`routers/settings.py` `get_settings` uses `current_principal`, not a
  configure gate). The comment says the coordinates are "never sent anywhere", but they are the site's location and are now
  readable by every signed-in principal. Low value (an administrator set them, and the add-on already knows its own site), but
  worth noting that the field is not administrator-only. Recommendation: none required; if the coordinates are considered
  sensitive, gate them behind `system.configure` as other administrator-only settings are, or round them for non-configurers.
- I4 - A walk position's `id` and `name` and a material id accept any character up to their length (`_id`: `isinstance(str)
  and 1 <= len <= 64`; `name`: stripped length only), unlike the mask documents' ids which must match `MASK_ID`
  (`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`). No injection was found - `sw-plan-3d` renders the walk label and id through Lit text
  / attribute bindings (escaped) and the walk id is only ever compared, never used to build markup or a selector - but the
  inconsistency means a future consumer that builds a string from these ids would inherit a wider charset than elsewhere.
  Recommendation: constrain the walk-position id (and ideally the material id) to the plain-id charset used elsewhere.
- I5 - `frontend/public/plan3d/MANIFEST.json` records each CC0 asset's source, author, licence and sha256, and
  `scripts/plan3d_manifest.py --check` / `frontend/tests/unit-plan3d-assets.spec.ts` confirm the files match it and every
  licence is in the allow-list (`CC0-1.0`). This was verified here (72 files, all hashes match, all sources `https://`
  ambientCG / Kenney, all licences CC0; the 19 `.glb` models carry no external `uri` and no embedded images). But the check is
  build / test time only: the add-on never reads `MANIFEST.json` and serves the files as static content, so nothing at runtime
  stops a tampered asset from being served if the `www` tree were modified after build. Low value (the same is true of every
  bundled asset, and the `www` tree is inside the signed add-on image). Recommendation: none required; keep the manifest check
  in the release gate.

## Verified safe

- Bake uploads (`services/plan_bakes.py`):
  - The slot is validated against closed lists per kind (`check_slot`: kind in `still|mask|lightmap`, preset / style / band /
    variant in their tuples, fields a kind does not use must be empty); `level_id` must be a plain token (no `/`, `\`, NUL) and
    must exist in the floor's published structure (422 `bad_slot`). `recipe` must match `^[a-z0-9][a-z0-9._-]{0,39}$`, the key
    must be the floor's current bake key (409 `geometry_changed`), and `bake_key` / `recipe` are re-validated in `store`.
  - Content is decided by magic bytes (`sniff`) and must match the kind's allow-list; images pass a full structural walk that
    rejects metadata before any decode - PNG: a chunk walk with CRC check, only the allow-listed ancillary chunks (no `tEXt` /
    `iTXt` / `zTXt` / `eXIf`); JPEG: a marker walk that refuses `APPn` (EXIF / XMP), `COM` and anything outside the canvas
    encoder's set; WebP: a chunk walk that refuses `EXIF` / `XMP` and the animation flag. The decode then checks `w*h` against
    `STILL_W[1]*STILL_H[1]` (6.55 MP) BEFORE `im.load()` (no decompression amplification; `DecompressionBombError` and
    `MemoryError` are caught as `corrupt_image`), confirms the format matches the mime, and enforces the per-kind size
    (`still` 640..2560 x 360..2560, `lightmap` power-of-two 64..2048, RGB/RGBA). A JPEG `COM` placed before the scan is
    refused; one after the scan or bytes after EOI are ignored by the decoder (the stored file is the raw upload, served with
    `nosniff`, so an appended payload is inert). Decoding runs behind a 2-slot semaphore from the thread pool (`busy` after 5 s),
    never on the event loop.
  - Mask documents are validated strictly: exact key set, `version == 1`, preset match, size in range, bounded room / door /
    camera counts (`MASK_MAX_*`), every point finite and near the picture, every id matches the plain pattern; a malformed mask
    is `corrupt_mask`. `meta` is bounded (4 KiB) with a per-kind key allow-list and typed values.
  - Per-file / per-floor / per-installation storage caps are enforced; only STALE rows are evicted (never a current one -
    `storage_full` otherwise, see I2 for the cross-floor note); the eviction list is computed from the live bake keys.
  - Storage is confined: `check_floor_id` (plain id), `confine` / `confine_stored` (resolved path must be strictly under
    `<data>/plans/bakes/`, no absolute path, drive, backslash or `..`), the stored `path` is relative to the data dir, the
    filename is built from the slot hash and the content sha (never the upload's name or mime). `sweep_orphans` drops rows that
    do not confine or whose floor is gone and never follows a poisoned `path` (a `../canary.txt` row is removed, the file
    untouched); it skips symlinks.
- Bake RBAC and audit: read = `map.read` on the floor, every write = `map.edit` on the floor, each checked after `get_floor`;
  every state-changing route is audited (`plan.bake.upload` / `.regenerate` / `.job` / `.delete`), and `floor.delete` records
  `bakes_deleted`. A viewer may read but not upload / regenerate / claim / finish / delete (403), and a principal with no
  binding is refused (403). The `plan.bakes` installation setting is `system.configure` only, audited as `settings.update`, and
  travels with every backup.
- Regenerate jobs: one open job per floor; a claim takes a 10-minute lease and a second browser is refused (`job_claimed`) until
  it expires; a request for an outdated key is superseded; `finish` with `done` requires every requested slot stored for the
  current key; the stored `error` is cleaned (`[^\w .,:;()/-]` stripped) and capped at 200 chars. The job tables are runtime
  state (`plan_bake_jobs` is not a backup table).
- Serving: `bake_file` sets `X-Content-Type-Options: nosniff`, a fixed `media_type` and a private `Cache-Control`, with an ETag
  of the content sha (304 on revalidation); a missing / non-confining file is a clean 404.
- plan_view `/plan-view/prefs`: read and write need `map.read` somewhere; a person reads and writes only their own row
  (`principal.user_id`), never another's; the body is `extra="forbid"` with at most `len(USER_DIALS)` keys, each value
  validated by `_dial` (closed choices, ranges snapped to their step, flags boolean); `null` resets a dial; writes are audited
  (`plan.view_prefs`), a denial too. The installation's `plan.view` is `system.configure` only; a corrupt stored dial reads as
  its default. `default_view` is deliberately not an installation dial (stays per person).
- `plan.view` / `plan.bakes` settings: partial updates validated in full by the service (unknown dials / keys refused), stored
  as canonical JSON, read back as objects; `site.latitude` / `site.longitude` bounded by a pattern and a range check (see I3 for
  the read side). `/me/prefs` `plan.quality` extends the closed set to `auto|1|2|realistic|lite` (a `_choice` validator); it is
  presentation only, per user, no permission.
- Document 2.2 geometry: the Plan Studio 6 fields are optional and additive; `document_version` stamps 2.2 only when one is
  present, so every 2.0 / 2.1 document stays byte-identical and an older reader refuses (never misreads) a 2.2 one
  (`SCHEMA_VERSIONS`, the package import's `package_doc_version`). Structural type checks run before the value checks; numeric
  bounds (`north_deg` 0..<360, light `color_k` / `lumens` / `beam_deg`, `eye_m`, `dpr_cap`) and enums (`tint`, light `kind`)
  are enforced; an unknown `material_id` is a WARNING that draws the default, never an error, so an older library opens a newer
  document; `walk_positions` is bounded (50) with per-item structural checks, a duplicate-id and single-default check, and
  bounds / unknown-level checks. `_find_nonfinite` still catches any non-finite number. `rebase` keeps the server-owned
  version block and recomputes the stored version. The package `geometry_hash` adds `north_deg` / `walk_positions` only when
  present, so 2.0 / 2.1 hashes are unchanged; `_merge` carries `north_deg` and merges `walk_positions` by id. `_merge` runs
  before `validate` in merge mode and would raise an unhandled `TypeError` on an unhashable walk-position id, but it only ever
  runs on a signed package whose `doc` is a previously-stored (already validated) document - `export_package` signs the stored
  document, and the import refuses an unsigned or tampered package (`package_unsigned` / `package_signature_invalid` /
  `package_tampered`, the signature over the manifest and the manifest over `doc_hash`) before `_merge` - so an unhashable id
  cannot reach it without this installation's private key.
- Material resolver and manifest: `services/plan_studio6.resolve` is pure (no network, no device); `canonical` maps an id or
  alias to a library id or `None`; the library (`catalog/materials.json`) is validated at first use and is byte-identical to the
  frontend copy (`frontend/src/map/materials.json`). `material-resolve.ts` loads the library from a bundled JSON import, not a
  fetch. The 3D assets are loaded from relative `plan3d/` URLs (the Ingress rule; same-origin under the add-on), never a CDN;
  `scene-real.ts` fetches only `modelUrl(file)` (a relative path); no `GLTFLoader` / `KTX2` / `Draco` / HDRI remote decoder path
  (`three-post.ts`, `scene-three.ts` note "no HDRI, no KTX2, no Draco"). The glTF export builds a `blob:` URL and an `<a download>`
  (no navigation). See I5 for the runtime-vs-build-time manifest note.
- Frontend sinks: no new `innerHTML` / `unsafeHTML` / `insertAdjacentHTML` / `eval` / `new Function` / `document.write` /
  `srcdoc` in the added Plan Studio 6 code. `sw-plan-stills` builds SVG through Lit's `svg` tag with `href=${url}` and
  `clip-path=${url(#lit-<id>)}` where the ids come from the server-validated mask (`MASK_ID`); the still / mask / lightmap urls
  are `api/v1/floors/<id>/bakes/<id>/file?v=<sha16>` built from DB ids and a hex sha, resolved by `resourceUrl`. `loadMask`
  fetches same-origin with `credentials: 'same-origin'`. Walk labels / ids reach the DOM only through escaped Lit bindings (see
  I4). `data-*` attributes carry numbers.
- Migrations 0074 (`plan_view_prefs`: one row per user, JSON value) and 0075 (`plan_bakes` + `plan_bake_jobs`, with a `kind`
  CHECK and a `UNIQUE (floor, level, kind, preset, style, band, variant)` slot key and a `status` CHECK) are additive; the
  previous version ignores both tables (rollback = leave them). `plan_view_prefs` is `KEEP_WHEN_ABSENT` (an older archive does
  not wipe a person's look); `plan_bakes` travels with the project (files under `plans/`, swept on a replace restore);
  `plan_bake_jobs` stays out (runtime state). A restore round-trip of a bake file was exercised by the candidate's own
  `test_plan_bakes.py`.

## SEC246 fix re-verification (origin/pilot/SEC246-fixes, read-only)

`origin/pilot/SEC246-fixes` is NOT merged into 2.4.7 (neither into origin/main nor origin/integ/247); it carries the 2.4.6
review's fixes plus a perf follow-up (`b1084113`). Verified by code reading and by running its regression tests on the runner
(145 passed; the single failure is the LAT1 latency envelope, a timing benchmark, see Method). Each fix of the SEC246 fix-status
table holds:

| ID | Status on pilot/SEC246-fixes | How verified |
|---|---|---|
| L1 | Holds | `routers/ui_background.reencode`: `Image.open(..., formats=[...])` header only, `image_guard.check_pixels` before any decode (JPEG 64 MP via `draft`, PNG / WebP 40 MP -> 422 `too_many_pixels`; `DecompressionBombError` too), one decode at a time (`_decode_slot`, 429 `busy` after 5 s). `test_security_review_246_poc.py` L1 tests passed. |
| L2 | Holds | `device_bulk.SENSITIVE_ON_KINDS` + `device_types.bulk_on_excluded`: a fixed valve / water heater is left out of `switches_on` (reason `sensitive_type`) unless included per device; `PUT /devices/entities/{id}/bulk-on` is `system.configure`, 409 `not_sensitive_type` otherwise, audited `devices.bulk_on_allowed`; a type change resets the inclusion; the setting travels with a backup (an older archive leaves all out). `test_device_types.py` / `test_devices.py` passed. |
| L3 | Holds | `routers/ha._run_action`: the pending `ha_actions` row and an `ha.action` attempt audit row are committed in one `write_aside(wait_s=PENDING_WAIT_S=2, priority=True)` BEFORE the signed call; on failure 503 `busy`, `details.sent=false`, nothing sent, a WARNING log line with user / entity / action / request id. The command leaves from the request thread, bounded by an 8-slot dispatch semaphore. `test_security_review_246_poc.py` L3 tests passed. |
| L4 | Holds | `update.apply_enabled` is in `SETTINGS_KEEP` (never exported, never restored); `restore` records `_update_switch` and the router writes a `system.update.apply_enabled` audit row (`kept_on_restore`, with `kept` / `archive` / `archive_differed`). `test_security_review_246_poc.py` L4 tests + `test_self_update_switch.py` passed. |
| I1 | Holds | `body_limit.LIMITS` row `ui_background` (12 MiB + framing), allowed only with the L1 guard. Verified in the diff and by `test_ui_background.py`. |
| I2 | Holds | `backup.restore` passes each `ui_backgrounds/*` file through `reencode` (a failing one is not written, listed in `backgrounds_rejected`); the picture response carries `nosniff`. `test_backup.py` passed. |
| I3 | Holds | `services/image_guard.py` sets `MAX_IMAGE_PIXELS` once (60 M); `plan_render` / `floor_images` / `wall_photos` import it and no longer write it, keeping their own explicit ceilings. Confirmed that NONE of the three writes the global any more on this branch (they do on integ/247, where this fix is absent). `test_floor_images.py` passed. |
| I5 | Holds | `self_update.view` uses `is_newer`; the `self_update_disabled` refusal is audited once by the router. Confirmed in the diff. |
| I6 / I7 / I8 / I9 / L8 (2.4.2) | Still open (as the SEC246 table says) | Not in the SEC246 fix scope; unchanged on integ/247 (e.g. `connection_probe` still DNS-resolves `X-Forwarded-Host`; the bridge is still 0.8.0). |

Note for the integrator: because 2.4.7 is built on origin/main (2.4.6) WITHOUT the SEC246 fixes, every SEC246 Low / Info is
present again on integ/247 (L1 background decode, L2 typed valves, L3 fire-first command, L4 restore switch, I1-I5). They must
be carried forward when SEC246-fixes is merged. A `git merge-tree` of SEC246-fixes into integ/247 conflicts only in
`body_limit.py` and `services/backup.py` (both because 2.4.7 added its own `LIMITS` row and `PROJECT_TABLES` / `FILE_COLUMNS`
entries next to the SEC246 edits) - small, mechanical conflicts.

## Residual risks

- M1 (mask camera exposure) is the one cross-scope leak the Plan Studio 6 surface adds; until it is redacted, a floor's baked
  masks must be treated as visible to every `map.read` holder of the floor, camera denies included.
- L1 (the bakes hash oracle) leaves the 2.4.2 L1 oracle open on one more route for scoped readers.
- The SEC246 Low / Info findings are all present on 2.4.7 (it predates the fix branch) - see the note above.
- Not reviewed: the Plan Studio 6 frontend renderer against a real GPU, the full backend and frontend suites, and anything on
  real devices / Home Assistant.

## Top items to fix first

1. M1: redact the mask cameras for the reader (serve through the camera scope, or draw cameras client-side from the already-scoped bundle).
2. L1: build the `bakes` endpoint's `geometry_key` / `doc_hash` from `served_geometry_key`, as the skins endpoint does.
3. Carry the SEC246 fixes forward into the 2.4.7 train (the merge conflicts are mechanical).
4. I1 / I4: align the walk-position validation (raw name length, unknown keys, id charset) with the contract.

## Fix status

Review branch: open findings, no product code changed (`pilot/SEC247-review`, a0d748ad). Fixes: task SEC247-fixes, branch
`pilot/SEC247-fixes` (on top of the review branch). The PoC file `tests/test_security_review_247_poc.py` was inverted into
regression tests of the fixed behaviour, with a test for every new rule.

| ID | Status | Fix | Regression tests (`tests/test_security_review_247_poc.py`) |
|---|---|---|---|
| M1 | Fixed | Option (a), served through the camera scope, derived on every read. `services/plan_bakes.mask_view` / `hidden_mask_cameras`: for a reader whose `plan_anchor_scope.visibility` is not None, every `cameras[]` entry whose id resolves (anchor id -> its camera, else a camera id) to a camera their scope denies - or resolves to nothing - is left out; `GET .../bakes/{id}/file` serves that copy with its own ETag, and `describe` (`GET .../bakes`) and `bundle_part` (the floor map bundle) hand them that copy's sha256 / size / `?v=`, never the stored file's. The stored file is unchanged, so the editor's bake / upload flow is untouched and every mask stored before the fix is redacted on read (no migration). A reader from whom nothing can be withheld gets the stored file byte for byte. A scoped reader's mask whose file is gone is a 404 and is listed without any hash (`?v=0000000000000000`). Option (b) (no cameras in the stored mask) was not chosen: `sw-plan-stills` draws the camera markers from the mask's projected positions and has no 3D projection of its own. | `test_f1_a_room_mask_is_served_through_the_readers_camera_scope`, `test_f1_an_unrestricted_viewer_gets_the_stored_mask_and_a_scoped_one_with_nothing_hidden_too`, `test_f1_a_mask_stored_before_the_fix_is_sanitised_on_read` |
| L1 | Fixed | `services/plan_bakes.served_bake_key` builds the geometry key and doc_hash from SEC244's `skins_store.served_geometry_key` and the bake key over that geometry key; `describe`, `bundle_part` and the upload / regenerate / claim / finish answers hand those (`shown_key`: a stale row's or job's stored key is null for a scoped reader). An upload is compared with the key the editor was handed and stored under the real key (as the skins control-image upload); jobs, rows and the stale checks keep the stored key. Unchanged for a reader from whom nothing is withheld. The bakes `doc_hash` now equals the bundle's geometry ref for a scoped editor, so the editor's "map shows a draft" guard no longer blocks a scoped editor from baking. | `test_f2_the_bakes_endpoint_hands_a_scoped_reader_the_served_keys`, `test_f2_a_stale_rows_stored_key_is_not_handed_to_a_scoped_reader`, `test_f2_a_scoped_editor_bakes_with_the_key_they_were_handed` |
| I1 | Fixed | `services/plan_studio6.check_doc_fields` (structural, refused at save): a walk position with a key outside `WALK_KEYS` (`unknown_field`), or a name longer than 40 as written (`name`). The value rule still refuses a blank name. | `test_ia_a_walk_position_with_extra_keys_or_a_padded_name_is_refused`, `test_ia_walk_position_edge_cases`, `test_ia_a_blank_name_stays_a_value_error`, `test_ia_the_save_route_refuses_and_accepts_as_the_contract_says` |
| I2 | Fixed | `services/plan_bakes._evict`: the uploading floor's stale rows go first for both caps; other floors' stale rows only as the last resort for the installation cap (documented in the docstring; the evicted `floor:slot` names stay in the upload's audit row). Current rows are still never evicted (`storage_full`). Refusing instead of the last-resort eviction was not chosen: stale leftovers of a floor nobody bakes would block every other floor until an administrator deletes them. | `test_i2_eviction_takes_the_uploading_floors_stale_rows_first_and_others_only_as_last_resort` |
| I3 | Not in this fix scope | Left to the agent changing the site-location source. | - |
| I4 | Fixed | Walk-position id: the plain-id charset `[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}`, matched in full (structural `id`). Material id: an unknown id outside that charset is dropped by `normalize` on save (it drew the default anyway; an unknown id never becomes an error, so an older library still opens a newer document). The mask id check in `validate_mask` now uses `fullmatch` too (a `$` let a trailing newline through). | `test_ia_walk_position_edge_cases`, `test_i4_an_unknown_material_id_outside_the_plain_charset_is_dropped_on_save_and_never_an_error`, `test_i4_a_document_whose_only_22_field_was_an_unsafe_material_falls_back_to_its_old_version`, `test_a_mask_id_with_a_trailing_newline_is_refused` |
| I5 | Not in this fix scope | - | - |

Documents 2.0 / 2.1 are untouched by the I1 / I4 rules (the fields exist only in a 2.2 document): their normalisation is
deep-equal, their hashes unchanged, no new issue (`test_documents_20_and_21_are_untouched_by_the_new_rules`; the existing
`test_plan_studio6.py` version / hash tests stay green). The contract (`contracts/schemas/plan_geometry.v2.schema.json`) now
says `additionalProperties: false` and the id pattern for `walk_position`, and the pattern for `material_id`.

Residual found while fixing (not fixed here, owner decision): the STILLS and the LIGHTMAP of a floor are rendered from the
editor's live scene, which draws an object bound to a camera anchor at its stored pose - the camera's position (the 2.4.2 M2
pose) - and a lamp bound to one lights the lightmap there. A scoped reader therefore sees, in the picture, a body at a place
the geometry read serves at WITHHELD_POSITION. No camera body, id or label is in a still (`stillDescription` drops camera parts
and text). Recommendation: `stillDescription` / the lightmap bake leave out (or place at the withheld position) every object
whose `anchor_ref` is a camera; that is a frontend renderer change needing a visual check on a GPU.
