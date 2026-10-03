# CR-020 — NVR camera settings ("הגדרות מצלמות"): per-stream encodings, guarded writes, vendor adapters

**Status:** PROPOSED (architecture only, 2026-10-01). Nothing implemented. Release: after 0.1.151, on the owner's word.
**Contract:** `docs/architecture/NVR_SETTINGS_API.md` ("API §n"). **Adapter layer and data model:**
`docs/architecture/NVR_VENDOR_ADAPTERS.md` ("ADP §n"). **UI brief:** `docs/architecture/NVR_UI_BRIEF.md` ("UI §n").
**Client stub:** `frontend/src/api/nvr-settings.ts` (types + in-memory demo).
**Builds on:** the NVR write framework of 2026-09-17 (`services/nvr_write.py`, table `nvr_changes`, rollback), the
CR-008 D7 codec registry (`services/stream_codecs.py`, `nvr.webrtc_verdict`), T055 camera scope.
No device was contacted for this CR. Lab facts come from the read-only probe of 2026-09-14
(`private-evidence/nvr-probes/`, not copied) and the lab-shaped fixtures in `tests/test_stream_codecs.py`.

## 0. Owner decisions (2026-10-01)

| # | Decision | Effect here |
|---|---|---|
| D1 | Settings gets an NVR area with a "הגדרות מצלמות" tab: a table of **all** cameras of the NVR with codec (H.264/H.265), SVC, resolution, fps, bitrate, GOP, B-frames, smart codec, **per stream** (main, sub, and more where the camera has them) | S1 (§2), API §3.2, UI §2 |
| D2 | Encodings and settings can be **changed**; SVC is an on/off toggle | S2, API §3.4, UI §3 |
| D3 | Cameras can be **added to and removed from** the NVR | S3 (judged feasible over ISAPI InputProxy, API §3.6) |
| D4 | Phase 1 is Hikvision only (ISAPI), behind a vendor-adapter layer so other brands (Provision-ISR, Frigate) and **more than one NVR** can join later | ADP §1-§5 |
| D5 | Changing an encoding on a device: **system administrators only**, with a confirmation | permission `nvr.configure` as a *system* permission (API §2) |
| D6 | Later goals - designed for, not built: shared screens across NVRs ("all cameras" wall), synchronized multi-camera playback across NVRs, an event log from several sources | ADP §6 |

## 1. Problem

Seven of the ten lab cameras stream an H.264 main with SVC on, three are H.265 in both streams (probe 2026-09-14). Browsers
may not decode over WebRTC on every viewer (lab probe 2026-09-14; since 0.1.151 the player tries WebRTC anyway and falls back to the sub stream on failure). Today Arx can only *say* so (the hint in
`stream_codecs.main_hint` names the NVR's own web menu). The owner wants to see every stream's encoding in one place and
fix it from Arx, and wants the adapter seam in place before a second recorder brand or a second NVR arrives.

## 2. Scope and phasing

| Slice | Content | Device effect |
|---|---|---|
| **S1 - read-only table** | Adapter layer skeleton (`RecorderAdapter` Protocol, Hikvision adapter wrapping `services/nvr.py`); `GET /nvr/recorders`, `GET /nvr/cameras`, `GET /nvr/cameras/{id}`; every stream the NVR reports (N01, N02, N03, ...); bitrate (CBR/VBR + kbps) and quality added to the parser; per-field "supported" facts; the settings tab, read-only; migration 0050 (ADP §7) | None. Read-only GETs, as discovery does today |
| **S2 - guarded encoding writes** | `GET .../options` (device capabilities), `PUT /nvr/cameras/{id}/streams/{ref}`; validation per field against the device's own options; `if_match` against a stale page; mandatory confirmation; two-phase audit + pending change row before the device call; previous document kept; undo through the existing `POST /nvr/changes/{id}/rollback`; the codec registry refreshed in the same transaction as the outcome | PUT of one `StreamingChannel` document per change |
| **S3 - add / remove a camera** | `POST /nvr/recorders/{id}/channels` (an already-activated camera by address + its credentials, typed by the administrator, never stored by Arx); `DELETE /nvr/cameras/{id}/channel` with the camera's name typed; the Arx camera row is kept (disabled) | POST / DELETE on `/ISAPI/ContentMgmt/InputProxy/channels` |

Each slice ships separately. S2 and S3 each need **one task-specific owner approval for the first real write on the lab
NVR** (AGENTS: device access is read-only by default); until then they are proven against the fake NVR only (§5, Q5).

## 3. Out of scope (explicit)

- Provision-ISR and Frigate adapters (designed in ADP §5, not built); a second NVR's connection UI and credential store
  (ADP §4, later); cross-NVR walls, synchronized cross-NVR playback, the multi-source event log (ADP §6).
- Image settings (exposure, WDR, day/night), audio encoding, ROI, OSD (exists separately), recording schedules (exist),
  storage, firmware, the NVR's network, camera activation (SADP) and camera password changes.
- Changing go2rtc configuration: the stream URLs do not change with an encoding (API §5.3).
- Automatic "fix all" from the hint, scheduled encoding changes, retries of a refused write (never: AGENTS physical rule).
- Rolling back an S3 removal (needs the camera's password again; API §3.6).

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | An encoding change restarts the camera's encoder: live drops for a few seconds, the NVR starts a new recording segment | Confirmation names the camera and stream; one write at a time per stream (`write_in_progress`); no bulk without Q2 |
| R2 | H.265→H.264 or a higher bitrate shortens retention on the NVR's disks | Codec / resolution / bitrate confirmations add one line about disk days (UI §3.2); the change log keeps the old document |
| R3 | The NVR cannot set encodings of a proxied channel (ONVIF-added cameras, some firmwares) or the write path differs (`/ISAPI/Streaming/channels/{id}` vs `/ISAPI/ContentMgmt/StreamingProxy/channels/{id}`) | Capability discovery per stream decides the path and `writable`; nothing is guessed (API §5.1). **UNVERIFIED on the lab firmware** until the approved lab write |
| R4 | Field coupling: smart codec locks GOP / bitrate on many firmwares; the resolution list depends on the codec | Options are read per codec; fields the device locks are reported `editable:false, locked_by` |
| R5 | The device answers OK and keeps the old value | The existing verify-after-write: `nvr_no_effect` (409), recorded |
| R6 | "Reboot required" answer (ISAPI statusCode 7) | Change recorded `applied` with `reboot_required:true`; Arx never reboots on its own (the reboot route exists, separately confirmed) |
| R7 | A removed then re-added channel slot gets a different physical camera while Arx keeps the old camera id (maps, permissions, cases point at the wrong camera) | Device fingerprint per camera (keyed hash of model + serial, never the serial itself); a changed fingerprint disables the camera row for administrator review (ADP §3) |
| R8 | SQLite write lock held across slow device I/O (the round-10 lock storm) | Device calls only inside `with unlocked(conn)`; adapters never touch SQLite (API §4) |
| R9 | Privilege creep through custom roles | `nvr.configure` joins `SYSTEM_PERMISSIONS` (routers/access.py): no custom role can carry it |
| R10 | The lab NVR is the owner's production recorder | Writes only after a per-channel approval (Q5); rollback ready before the write |
| R11 | Credentials typed for S3 leak into logs, audit or `nvr_changes` | The password is a request-only field; documents are stored with `<password>` redacted; audit carries no address or user name |

## 5. Acceptance tests

Real = against a device; fixture = `tests/fixtures/fake_devices.py` extended with streaming writes, capabilities and
InputProxy. Every UI test needs desktop / phone / RTL screenshots of loading, empty, error and ready.

| AT | Slice | Test | Kind |
|---|---|---|---|
| AT-020-01 | S1 | `GET /nvr/recorders` lists `nvr-1` (vendor, model, firmware, capabilities, health); NVR-less mode answers 409 `nvr_not_configured` | fixture |
| AT-020-02 | S1 | `GET /nvr/cameras` returns every InputProxy channel (incl. offline and disabled-in-Arx) with every stream of the streaming document, N03 included; lab-shaped document: SVC mains `webrtc:unknown` (reason `svc`), H.265 `unknown`, Baseline sub `ok`; only MJPEG and H.264 with B-frames are `no` (rule of 0.1.151: WebRTC is tried for every stream) | fixture |
| AT-020-03 | S1 | An element the device does not send is `null` with `fields.<f>.supported:false`, never a default; the B-frame field is unsupported on the lab-shaped document | fixture |
| AT-020-04 | S1 | Without `system.configure`: 403 audited; a camera deny (T055) removes that camera from the list and 403s its detail | fixture |
| AT-020-05 | S1 | Streaming document unreadable: the list answers with the registry's last main/sub reading, `stale:true`, `error` code; no 5xx | fixture |
| AT-020-06 | S2 | `PUT` without `nvr.configure` - including a custom role holding `nvr.config.stream` - is 403 audited and the fake NVR records **zero** writes | fixture |
| AT-020-07 | S2 | A value outside the device's options is 422 `value_not_allowed` naming the field and the allowed values; zero writes | fixture |
| AT-020-08 | S2 | Stale `if_match` is 409 `stale` with the current stream; missing `confirm` is 422 `confirm_required`; zero writes in both | fixture |
| AT-020-09 | S2 | Happy path: the attempt audit row and the `pending` change row are committed **before** the PUT (the fake NVR reads them from a second connection while it answers), the outcome row after; `nvr_changes` holds both documents; the registry flips main `svc → ok` in the same transaction | fixture |
| AT-020-10 | S2 | Device busy (statusCode 2) → 409 `nvr_busy`, change `refused`, registry unchanged, no retry | fixture |
| AT-020-11 | S2 | Device keeps the old value → 409 `nvr_no_effect`; statusCode 7 → 200 with `reboot_required:true` and no reboot call | fixture |
| AT-020-12 | S2 | Undo: rollback restores the before document, needs `nvr.configure`, refreshes the registry; refused 409 `stale` when the stream changed since | fixture |
| AT-020-13 | S2 | Lock: a parallel write request on another table completes while the fake NVR holds the PUT for 2 s | fixture |
| AT-020-14 | S2 | A pending row left by a crash is settled at start-up by re-reading the device (`applied` / `failed` / `diverged`) | fixture |
| AT-020-15 | S2 | No go2rtc write happens on an encoding change; foreign streams untouched | fixture |
| AT-020-16 | S2 | Lab: one approved channel, SVC off then undo; the remote player picks WebRTC for that main afterwards | **real**, needs Q5 approval |
| AT-020-17 | S3 | Add: password never in the response, log, audit or `nvr_changes`; the new channel appears after discovery with a fresh Arx camera | fixture |
| AT-020-18 | S3 | Remove: typed name required; Arx camera row kept, `enabled=0`, `removed_from_recorder_at` set; maps, anchors, bindings untouched | fixture |
| AT-020-19 | S1 | Fingerprint change on a channel disables the camera row and audits `cameras.replaced`; the serial never appears in the database | fixture |
| AT-020-20 | S1 | A second registered fake recorder (`nvr-2`, unit level): camera ids unique, stream names `smplwise_nvr-2_ch1_main`, routes filter by recorder | fixture |
| AT-020-21 | S1-S2 | UI: table, per-stream rows, SVC toggle confirm + undo toast, read-only state, phone layout, RTL (numbers stay LTR) | fixture (Playwright) |

## 6. Recorded contradictions and deviations

1. **Permission name.** The brief asks for a new `nvr.configure` held by system administrators only. The registry already
   has `nvr.config.stream` (in `system_admin`, sensitive, grantable to a custom role, used by no route). A custom-role
   grant would contradict D5, so CR-020 uses `nvr.configure` as a **system permission** and proposes removing
   `nvr.config.stream` from `roles.json` in S2 (no route depends on it). Not resolved silently: listed for the coordinator.
   **Resolved 2026-10-03 (owner):** removed in S2 (roles.json, labels, `NVR_PERMISSIONS`; migration 0050 strips it from custom roles).
2. **Existing `apply_change` records inside `unlocked`.** `nvr_write.apply_change` inserts `nvr_changes` and audit rows
   while the connection is in autocommit mode inside `with unlocked(conn)`. CR-020 does not reuse that path; it uses the
   two-phase pattern of `start_manual` / `_place_device` (API §4). Migrating the older routes is a separate task.

## 7. Open questions for the owner

1. **Where the tab lives.**
   א. A fourth tab in הגדרות › אבטחה, next to "NVR": אזעקה · ניהול אזעקה · NVR · הגדרות מצלמות. **(recommended: keeps the 2026-09-30 structure)**
   ב. A new settings tab "NVR" with its own tabs: מצב · הגדרות מצלמות · יומן שינויים (better once there are several recorders).
2. **Changing several cameras at once** (e.g. SVC off on all seven mains).
   א. One stream per change only.
   ב. Also "החל גם על..." - choose cameras, one confirmation, applied one by one, stops at the first failure. **(recommended, in S2 after the single-stream write is proven)**
3. **Strength of the confirmation.**
   א. One short confirmation dialog for every change. **(recommended)**
   ב. Like א, plus typing the camera name for codec and resolution changes.
   ג. Like ב, plus the second factor (CR-011).
4. **Adding and removing cameras (S3).**
   א. Both: add a camera that is already activated (address + its user and password, not saved by Arx); remove with the camera name typed; Arx keeps the removed camera hidden with its maps and permissions. **(recommended)**
   ב. Remove only.
   ג. Neither for now; decide after multi-NVR.
5. **First real write on the lab NVR.**
   א. Approve one named camera: SVC off on its main stream, check the remote player, then undo - in a time window you choose. **(recommended)**
   ב. No lab write by the agent: fixture tests only; the first real write is yours, from the screen.
6. **Who sees the table read-only.**
   א. System administrators only. **(recommended)**
   ב. Also whoever holds any NVR permission (as the NVR change log today).

## 8. Slice S1 implementation record (2026-10-02, branch `pilot/cr020-s1`)

Implemented: the adapter seam (`services/recorders/`: Protocol with the read methods only, registry, Hikvision adapter over the
existing read-only ISAPI code), `GET /nvr/recorders`, `GET /nvr/cameras`, `GET /nvr/cameras/{id}` (`system.configure`,
installation scope + the camera chain; every successful read audited as `nvr.cameras.read`, counts only), the strict streaming
LIST parser (`nvr.parse_streaming_channels_all`: every stream, bitrate, quality, GOP, SVC, smart codec, H.264+/H.265+, per-field
support, etag; 2 MB / 256-element / text caps), and the read-only tab "מצלמות" in הגדרות › אבטחה (owner Q1 option א, Q6 option א).

Deviations from the S1 row of section 2, recorded rather than resolved silently:
1. **No migration 0050 in this slice.** Nothing in the read-only table needs a column: the one recorder is `nvr-1`, `source_ref`
   is `str(channel)` in code. The vendor / connection columns, `cameras.source_ref` and the fingerprint columns land with the
   slice that first needs them (second recorder, S2's `nvr_changes` columns, S3). AT-020-19 (fingerprint disables a swapped
   camera) and AT-020-20 (second fake recorder) are therefore **not covered by S1**.
2. `GET /nvr/cameras/{id}` carries no `options` (they are S2); `can_write` is `false` and every stream is `writable:false,
   not_writable_reason:"read_only"`; the recorder's `write_encodings` / `add_channel` / `remove_channel` capabilities are `false`.
3. `camera_id` is `null` for a channel the NVR has and Arx has not discovered yet; such a row is listed to installation-wide
   holders only. Extra response fields: `codec_plus`, list-level `error` and `checked_at`.
4. The B-frames and smart-codec columns of UI brief section 2 are not separate columns: smart codec shows as the "+" of the codec
   (H.264+ / H.265+), B-frames is unsupported on the lab firmware.
5. The table reads the LIST document only: on the lab firmware a single-channel `GET /ISAPI/Streaming/channels/{id}` lacks the
   `<SVC>` element the list carries.
6. **WebRTC verdict follows the 0.1.151 rule**, not the 2026-09-14 probe: `unknown` (shown as a neutral dash, never a cross) for H.264 SVC and
   H.265 mains because the player tries WebRTC and falls back on a measured failure; `no` only for MJPEG and H.264 with B-frames.

## 9. Slice S2 phase A implementation record (2026-10-03, branch `pilot/CR020-s2-a`, backend only)

Built (fixture-tested against the fake NVR; NOTHING was run against the lab NVR - AT-020-16 stays NOT_RUN until the lead's
one approved write, plan `private/cr020-s2/PLAN.md` section 9):

- Migration **0050_nvr_stream_changes.sql**: `nvr_changes` gains `recorder_id` (default `nvr-1`), `camera_id`, `stream_ref`,
  `fields_json`, `etag_before`, `etag_after`, `reboot_required`, `device_status`, `batch_id`, `batch_index` (the last two for the
  later multi-camera phase), two indexes and the partial unique index "one pending change per recorder + stream". The same file
  strips `nvr.config.stream` from stored custom roles (0042 pattern: role revision and permission revision move). CR-021 keeps 0051.
- Permission **`nvr.configure`**: in `system_admin` (roles.json), `SYSTEM_PERMISSIONS` and `PERMISSION_LABELS`; not sensitive,
  never in a custom role, never delegable. **`nvr.config.stream` is removed** (owner decision 2026-10-03; it was in
  `NVR_PERMISSIONS` of `routers/nvr_write.py` and granted read access to the NVR state and change log - that read path is gone with it).
- `PUT /nvr/cameras/{camera_id}/streams/{stream_ref}`, `GET /nvr/cameras/{camera_id}/streams/{stream_ref}/options[?codec=]`,
  `options` and computed `writable` in `GET /nvr/cameras/{id}`, `can_write` from `nvr.configure`, `GET /nvr/changes?camera_id=`.
- Undo: `POST /nvr/changes/{id}/rollback` dispatches `kind = stream_encoding` to `nvr_settings.rollback_stream` (nvr.configure at
  installation AND on the change's camera, literal `confirm: true`, only an `applied` change, etag of `after` must match, two phases).
  The generic `nvr_write.rollback` refuses a `stream_encoding` row.
- Hikvision adapter: `stream_options` (direct capability document, then StreamingProxy, else `writable:false` with the device's sub
  status; cached per process by recorder + stream + codec - positive 10 min, negative 60 s, dropped after a change the device applied; a hit makes no device call), `read_stream`, `write_stream_encoding` (LIST read, etag check,
  ONE PUT, LIST verify; never retried). Pending janitor `settle_pending` in the 30 s housekeeping pass (first pass 30 s after start-up).

Deviations from the contract (for review):
1. **Owner rule "no capability document = abort"**: a stream whose capability documents answer 403 / 404 on both paths is not
   writable; a write answers 503 `capabilities_unreadable` with a Hebrew message, and nothing is sent. A 5xx on the capability
   path is `source_error` (no guess, nothing cached).
2. **Confirm on undo** (owner Q3=A, decision "A" of 2026-10-03): the stream rollback requires `{"confirm": true}`; the API text
   "undo confirms nothing more" is superseded. The generic rollback of other kinds keeps its bodyless shape. Rollback answers 201
   `{change, stream, rollback_of, reboot_required}`.
3. **`confirm` is checked by identity with the JSON literal `true`** before the body shape and before any device read (no pydantic
   coercion of `"true"` / `1`). Since the review fix L2 the PUT and the rollback read the RAW body (`routers/nvr_write.py::_raw_body`)
   after a permission gate on the read connection (`_writer_ro` / `_rollback_gate`, the `auth.read_gate` pattern of review L7) and
   before the write connection, and the PUT checks the `stream_ref` path segment by hand too: an unauthorised caller gets the audited
   403 for ANY body (malformed JSON included) and any stream id, and no device call. (Before the fix FastAPI's own validation answered
   422 for a body that was not JSON or a stream id that was not digits, before the handler ran - no device call either, but the
   wrong code.) An authorised caller with a body that is not JSON gets 422 `confirm_required`, with a bad stream id 422 `validation`.
4. **Unknown outcomes stay `pending`**: a timeout after the PUT was sent, a 5xx without a refusal code, or a failed verify read leave
   the change `pending` with `error:"outcome_unknown"` (503 `source_unavailable`, `details.outcome:"unknown"`, ALWAYS `retryable:false`);
   it is settled from a device read no sooner than 45 s after it was recorded (review M2) - by the next write of that stream or by
   the janitor; until then a second write of the stream is 409 `write_in_progress`. The PUT waits 25 s for the device's answer. A change whose verify shows only part of the fields is `diverged` (409 `nvr_diverged`, new code).
5. `nvr_changes.path` of a stream change holds `direct:<sid>` / `proxy:<sid>` (the write route), not the ISAPI path.
6. A request whose values all equal the device's answers 200 with `change: null` and `unchanged_fields`; no row, no PUT (audited `unchanged`).
7. A codec change on a stream with a profile element requires the profile to be valid for the new codec (named, or the current one
   allowed); Arx never picks a profile silently. B-frames are `field_not_supported` (no element written in S2).
8. Every authorized refusal before the device (confirm, validation, stale, write_in_progress, capabilities_unreadable) leaves ONE
   denied `nvr.stream.write` / `nvr.rollback` audit row (`phase:"attempt"`, reason = the code) and no change row.
9. The capability-document and dynamicCap shapes are the contract's (API 5.1) and are **UNVERIFIED on the lab firmware**; the
   lab pre-check reads them read-only before the one approved write.

### 9.1 Security review fixes (2026-10-03, branch `pilot/CR020-s2-a-fix`, test-first)

An independent Opus review of phase A found two medium and six low items; all are fixed, each with a test written first
(`tests/test_nvr_stream_review_fixes.py`, plus `tests/test_migrations.py::test_0050_*`):

- **M1 change log disclosure.** `GET /nvr/changes` lists a `stream_encoding` row only to a holder of `nvr.configure` at installation
  scope whose nvr.configure camera scope (T055) holds the change's camera; `GET /nvr/changes/{id}` of such a row is 403 (audited)
  otherwise, so `before_xml` / `after_xml` (the whole `<StreamingChannel>` incl. its transport section) never reach a caller without
  `nvr.configure`. Other kinds keep their read path (`_require_read`). Pinned for a custom role holding only `nvr.record.manual`
  (with and without a camera deny) and for a `system_admin` with a camera deny.
- **M2 unknown outcomes.** Settled no sooner than 45 s after the change was recorded (`UNKNOWN_SETTLE_MIN_S`; before that 409
  `write_in_progress` and the janitor waits), the stream PUT has a 25 s read timeout (`PUT_READ_TIMEOUT_S`), and every unknown outcome
  is `retryable:false` (timeout, 5xx without a refusal code, a failed verify read - the last is now always 503 `source_unavailable`
  with `details.cause`, never a 404). Tested with a moved clock (`nvr_settings._utcnow`).
- **L1 capability cache.** Keyed by recorder + stream + codec (the deviceInfo GET per call is gone: a hit makes no device call); a
  negative answer lives 60 s, a positive one 10 min; a change the device applied (or the janitor found applied / diverged) drops the
  stream's entries.
- **L2** see deviation 3 above (auth before the body; test that an unauthorised malformed body is 403 with no device call).
- **L3** migration 0050 writes one audit row `rbac.role.update` (reason `migration_0050`, no actor, details
  `{"migration":"0050","removed":["nvr.config.stream"],"revision":n}`) per custom role it stripped, in the migration's own transaction.
- **L4** a `diverged` change can be undone with the same guards (nvr.configure + camera, `confirm:true`) while the stream's etag still
  equals the change's `etag_after`; the undo reverts only the fields the device really changed.
- **L5** when the janitor settled the row while the request was still running, the request writes no second outcome audit row and no
  registry update; it answers with the janitor's verdict (a janitor `failed` = 409 `nvr_no_effect`).
- **L6** a restore (`project+access`) drops permissions this version does not know - and system permissions - from custom roles
  (`roles_pruned` in the answer and in the `backup.restore` audit row), so an archive from before 0050 never leaves a role whose
  next edit fails with 422 `permission_unknown`.
- Missing tests added: the undo checks the permission BEFORE `confirm` and makes zero device calls for an unauthorised caller;
  capability-cache expiry; janitor vs a long-running request.

### 9.2 Frozen API shape for the UI (phase B builds against exactly this)

- `GET /nvr/cameras`: every stream has `writable: null` and `not_writable_reason: null` (the list never discovers capabilities;
  the top-level `stale` says when the device could not be read). `can_write` (bool) at the top.
- `GET /nvr/cameras/{id}` and `GET /nvr/cameras/{id}/streams/{ref}/options[?codec=]`: `writable` is a boolean and
  `not_writable_reason` a code or null; the detail carries `options: {stream_ref: object | null}` and `can_write`.
- `PUT /nvr/cameras/{id}/streams/{ref}` body `{"if_match": "<16 hex>", "confirm": true, "changes": {field: value, ...}}`; fields:
  codec, profile, resolution, fps (number or "full"), bitrate_mode, bitrate_kbps, quality, gop, svc, smart_codec, b_frames. 200
  `{change, stream, applied_fields, unchanged_fields, reboot_required}`; a request whose values all equal the device's answers 200
  with `change: null`.
- `POST /nvr/changes/{id}/rollback` body `{"confirm": true}` for a `stream_encoding` change: **201**
  `{change, stream, rollback_of, reboot_required}`; allowed for an `applied` or `diverged` change.
- A change record (`change` above, `GET /nvr/changes`, `GET /nvr/changes/{id}`) carries `fields` as an OBJECT
  (`{"svc": [true, false]}`, null for other kinds) - never the raw `fields_json` string; the list rows carry `has_before` /
  `has_after` instead of the documents.
- Error codes of the write and the undo (the envelope `{code, user_message, retryable, details}`; `details.change_id` once a change
  row exists): `stale` 409 (`details.stream` = the current stream), `write_in_progress` 409, `nvr_busy` 409, `nvr_no_effect` 409,
  `nvr_diverged` 409, `nvr_not_supported` 409, `nvr_rejected` 409, `not_rollbackable` 409 (undo only), `capabilities_unreadable`
  503, `source_unavailable` 503 (with `details.outcome:"unknown"` when the PUT may have landed; then `retryable:false`),
  `source_forbidden` 503, `confirm_required` 422, `validation` 422, `value_not_allowed` 422 (`details.field`, `details.allowed`),
  `field_locked` 422 (`details.field`, `details.by`), `field_not_supported` 422 (`details.field`), `forbidden` 403, `not_found` 404,
  `nvr_not_configured` 409 (NVR-less mode).
### 9.3 Phase B (UI) implementation record (2026-10-03, branch `pilot/CR020-s2-b`)

SVC switch + pencil per stream for holders of `nvr.configure` (`can_write`), one confirmation (count, two buttons, details under "פרטים"), undo toast (10 s, press = `confirm:true`), editor drawer with the last five changes, error lines per code, unknown outcome = "הסטטוס נבדק" and never retried. Deviations: the confirmation is a centred `sw-dialog` also on phones (nesting-safe inside the modal drawer); the editor is the shared modal `sw-drawer` (side panel / bottom sheet) instead of a full-screen `sw-sheet`; holders of `nvr.configure` get the cards below 900 px; no disk-days line in the confirmation (no retention data in the API); no XML view. Specs: `evidence-nvr-cameras-write` (stateful mock), `evidence-nvr-cameras-fixture` (real backend + fake NVR, fresh backend per project), `layout-nvr-cameras`, `unit-nvr-cameras-edit`. Evidence: `docs/evidence/CR-020-s2/`.

### 9.4 Phase C (multi-camera batch) backend record (2026-10-03, branch `pilot/CR020-s2c`, backend only)

Design: `private/cr020-s2/PLAN_C.md`; contract: API §3.7. Owner decisions 2026-10-03 that change PLAN_C (binding, recorded
here as deviations from the plan): the batch is **always on** (no `nvr.batch_enabled` gate; PLAN_C Q1 = ב), with one audit
row `nvr.stream.batch` `phase:"attempt"` naming who started it; **no cap** on cameras (PLAN_C proposed 8; only an
input-size guard of 1024 targets remains, and progress is paged); **any H.264 main stream whose SVC is on, derived from
the device** - no channel list in code (Q4 = א); background run on the server, stoppable, survives a closed page (Q5 = א);
undo-all with ONE confirmation, the toast press (Q3 = א); single changes refused "מתבצע שינוי מרובה" while a batch runs on
the same NVR (Q8 = א); **after an unknown outcome** the batch stops, waits 45 s, checks that camera read-only and continues
automatically ONLY when the reading proves the change was applied; otherwise `interrupted` (Q7 = ב with the proof rule,
instead of PLAN_C's "never continue").

Built: `POST /nvr/stream-batches` (confirm first, allow-list `{"svc": false}`, every target authorized up front, one LIST
read preflight, placeholders + one audit row, 202), `GET /nvr/stream-batches[?active=1]`, `GET /nvr/stream-batches/{id}`
(paged items, camera-scope filter), `POST .../stop`, `POST .../rollback` (undo-all as a new reversed batch); the server
runner (own connections, one item at a time, heartbeat, per-item re-authorization, stop-at-first-failure, the unknown
rule); `recover_batches` at start-up, in the janitor and on demand; shutdown ends runners after the current camera;
`batch_guard` in the S2A single write / undo; `can_batch` on the camera responses. S2A code changed in three spots only
(`write_stream` / `rollback_stream` gain `batch` and `adopt`; `_insert_pending` claims a placeholder). No migration (0050's
`batch_id` / `batch_index`), no permission change. Tests: `test_nvr_stream_batch.py`, `test_nvr_stream_batch_recovery.py`,
`test_nvr_stream_batch_rbac.py` (fake NVR only; fake knob `put_unknown_at`).

Not built in this slice, with the reason:
- the UI (checklist, one confirmation, progress, stop, partial-failure view, undo toast with count): a separate Sonnet slice
  (PLAN_C S2-35/36) on the frozen API §3.7;
- fields other than `svc:false` in a batch: the owner approved SVC only; the allow-list is one constant (`BATCH_FIELDS`);
- a lab batch on the real NVR: no approval (PLAN_C Q2); the single write AT-020-16 is the only lab proof;
- an index on `nvr_changes.batch_id`: needs a migration (0052 belongs to NN4); the queries scan a small table and the runner
  fetches one row per item;
- more than 128 channels per recorder: the S1 LIST reader stops at 256 stream elements (`nvr.MAX_STREAMING_ELEMENTS`), so a
  larger recorder cannot be read at all yet - not a batch limit;
- multi-process runners: the add-on runs one process; start-up recovery therefore interrupts every running batch. A
  second worker would need the heartbeat path only (already used by the janitor).

### 9.5 Phase C security review fixes (2026-10-04, branch `pilot/CR020-s2c-fixes`, backend only, test-first)

Review: `private/cr020-s2c-review/SECURITY_REVIEW.md` (13 findings on 7068b093). Tests:
`test_nvr_stream_batch_review_fixes.py` (each failed on 7068b093 and passes now; fake NVR only, new fake knobs
`list_inject`, `drip_from` / `drip_s`); adjusted: `test_nvr_stream_batch_recovery.py` (a GET no longer recovers; the lock key
comes from `nvr_batch.lock_key`), `test_nvr_stream_batch.py` (the lock is per device). Contract changes (additive) are in
API §3.5 / §3.7 "Security review fixes".

| # | Finding | Result |
|---|---|---|
| 1 | unknown-outcome check took a foreign change for ours; undo sent the whole before document | fixed: `_settle_one` needs every other field unchanged (else `diverged`, batch `unknown_diverged`); `rollback_stream` builds the document from the current reading with only our fields - batch and single (janitor) paths |
| 2 | a slow device could hold the lock until restart | fixed: `nvr.deadline` (per item 90 s, check 30 s) inside every bounded read and the streamed PUT answer; a runner hung > 150 s in one item is abandoned by stop / recovery (`deadline`), lock released, no further PUT, the late thread records nothing more |
| 3 | status / list / stop took the write lock; a GET recovered and read the device | fixed: read connection; recovery only from the janitor (and stop for a gone / hung runner, without device reads) |
| 4 | replace restore deleted the batch keys; backups carried run details | fixed: `SETTINGS_KEEP_PREFIXES = ("nvr.batch.",)` - not exported, not restored, not deleted |
| 5 | no index on `batch_id` | NOT fixed: needs a migration; 0052 is the NVR connection feature, 0053 reserved - open item |
| 6 | lock keyed by recorder row, not device | fixed: `adapter.device_key` (`addon-nvr` for the add-on's NVR) |
| 7 | deep JSON -> bare 500 | fixed: `json_body` maps RecursionError / MemoryError to MALFORMED (audited 422), batch and single write |
| 8 | undo-all audited an unvalidated id | fixed: id checked first (404, nothing audited) |
| 9 | stream cut out by text search | fixed: `slice_stream_element` identifies the element by a real parse of the list and accepts the text slice only when structurally identical (comments / CDATA ignored) |
| 10 | reboot request invisible | fixed: item `reboot_required`, status `reboot_required` count |
| 11 | window between permission check and claim | fixed: `authorize` re-run under the write lock right before the claim |
| 12 | out-of-scope items still counted | accepted, documented (only system_admin holds nvr.configure) |
| 13 | single-process assumption | documented (module docstring, API §3.7) |

Behaviour change to note for the single-camera path: an undo now PUTs the current document with only the change's fields
restored (before: the stored whole `before` document); for an untouched stream the two are the same document.