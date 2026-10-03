# NVR settings API (CR-020)

**Status:** contract proposal, 2026-10-01. Nothing implemented. Change request: `docs/changes/CR-020-NVR-CAMERA-SETTINGS.md`.
Adapter layer and migration: `NVR_VENDOR_ADAPTERS.md` ("ADP §n"). Client: `frontend/src/api/nvr-settings.ts`.

All routes are under `/api/v1`, JSON, the error model of `smplwise/errors.py` (`code`, `user_message` in Hebrew,
`retryable`, `correlation_id`, `details`). Identifiers in paths: `recorder_id` (`nvr-1`), `camera_id` (the Arx camera id,
random, stable), `stream_ref` (the vendor's own stream key; Hikvision: the streaming id `101`, `102`, `103`). No route
returns a device address, a device user name, a password, a serial number or a MAC.

## 1. Vocabulary

| Term | Meaning |
|---|---|
| recorder | One NVR (or later a Frigate instance), row of `recorders`. Phase 1: exactly `nvr-1`, the add-on's NVR |
| channel / `source_ref` | The recorder's own camera key: Hikvision InputProxy channel id (`"1"`), Frigate camera name later |
| stream | One encoder output of a channel. `role`: `main` (Hikvision N01), `sub` (N02), `third` (N03), `other` (N04+) |
| encoding | The normalized fields of §3.3 |
| options | What the device accepts for one stream, read from its capability document (§5.1) |
| etag | `sha256` (first 16 hex) of the whitespace-normalized device document of that stream at read time |

## 2. Permissions

| Permission | Holder | Guards |
|---|---|---|
| `system.configure` (existing) | system administrators | every read route of this document (owner Q6 may widen to the NVR-permission holders of `_require_read`) |
| `nvr.configure` (**new**) | `system_admin` only; added to `SYSTEM_PERMISSIONS` in `routers/access.py`, so no custom role can carry it | every write: encoding PUT, undo of a `stream_encoding` / `channel_*` change, add / remove channel |

Both are checked at installation scope **and** on the camera's chain (`services.access.require_camera(conn, principal,
camera_id, perm)`, T055): an explicit deny on the camera, its floor or site removes the camera from lists (filtered) and
answers 403 on its routes (403 before 404). `nvr.config.stream` (formerly sensitive, unused) was removed in S2 (owner
decision 2026-10-03; migration 0050 strips it from custom roles). S2 deviations from this contract: CR-020 §9.

## 3. Routes

### 3.1 `GET /nvr/recorders`

```json
{
  "recorders": [{
    "recorder_id": "nvr-1", "name": "NVR ראשי", "vendor": "hikvision", "model": "DS-7616NI-FAKE", "firmware": "V4.84.000 fake",
    "enabled": true, "online": true, "checked_at": "2026-10-01T09:12:03Z",
    "capabilities": {
      "read_encodings": true, "write_encodings": true, "add_channel": true, "remove_channel": true,
      "max_channels": 16, "used_channels": 10, "encoding_fields": ["codec", "profile", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop", "svc", "smart_codec"]
    },
    "error": null
  }],
  "can_write": true
}
```

`online` / `error` come from the adapter's `health()` (one `deviceInfo` GET, 4 s timeout). NVR-less mode: 409
`nvr_not_configured` (as every NVR route).

### 3.2 `GET /nvr/cameras?recorder_id=nvr-1`

Every channel of the recorder(s) - offline ones and those disabled in Arx included - with every stream. One device read
per recorder: `GET /ISAPI/Streaming/channels` + `InputProxy/channels` (+ `/status`). `recorder_id` omitted = every
recorder (one in phase 1).

```json
{
  "cameras": [{
    "camera_id": "c7f3...", "recorder_id": "nvr-1", "source_ref": "1", "channel": 1,
    "name": "כניסה", "online": true, "enabled_in_arx": true,
    "streams": [{
      "stream_ref": "101", "role": "main", "enabled": true,
      "codec": "H.264", "codec_raw": "H.264", "profile": null,
      "resolution": "2560x1440", "fps": null, "fps_full": true,
      "bitrate_mode": "VBR", "bitrate_kbps": 3072, "quality": 60, "gop": 50,
      "svc": true, "smart_codec": false, "b_frames": null,
      "webrtc": "no", "webrtc_reason": "svc",
      "fields": {"b_frames": {"supported": false, "editable": false}, "profile": {"supported": false, "editable": false}},
      "writable": true, "not_writable_reason": null,
      "etag": "9b1e4c0a77d2f1e3"
    }],
    "error": null
  }],
  "recorders_failed": [],
  "stale": false,
  "can_write": true
}
```

Rules:
- A field the device document does not carry is `null`, and `fields.<name>.supported:false`. `fields` lists only the
  exceptions; an absent key means `{supported:true, editable:can_write}`. Never a default value.
- `fps`: frames per second (`maxFrameRate / 100`); `fps_full:true` when the device says `0` (the camera's full rate).
- `bitrate_kbps`: `constantBitRate` under CBR, `vbrUpperCap` under VBR. `quality`: `fixedQuality` (VBR only).
- `webrtc` / `webrtc_reason`: `nvr.webrtc_verdict` on the normalized encoding, unchanged logic.
- `writable` is known only after the stream's options were read once in this process (§5.1); before that `null`.
- The streaming document fails: the cameras come from the registry (`cameras.capabilities_json.encoding`: main and sub
  only), `stale:true`, `error` = the adapter's code, `etag:null`, nothing editable. Never a 5xx for a device failure.

### 3.3 `GET /nvr/cameras/{camera_id}`

The one camera as in §3.2, plus per stream `options` (read now, cached per process by recorder + firmware + stream):

```json
{
  "camera": { "...": "as §3.2" },
  "options": {
    "101": {
      "codec": ["H.264", "H.265"],
      "profile": {"H.264": ["Baseline", "Main", "High"], "H.265": ["Main"]},
      "resolution": {"H.264": ["2560x1440", "1920x1080", "1280x720"], "H.265": ["2560x1440", "1920x1080"]},
      "fps": [25, 22, 20, 18, 16, 15, 12, 10, 8, 6, 4, 2, 1, 0.5], "fps_full": true,
      "bitrate_mode": ["CBR", "VBR"], "bitrate_kbps": {"min": 32, "max": 16384}, "quality": [10, 30, 45, 60, 75, 90],
      "gop": {"min": 1, "max": 400}, "svc": true, "smart_codec": true, "b_frames": false,
      "locks": {"smart_codec": ["gop", "bitrate_mode", "quality"]},
      "source": "capabilities"
    }
  }
}
```

`GET /nvr/cameras/{camera_id}/streams/{stream_ref}/options?codec=H.265` answers one stream's options for a codec the
stream is not on yet (Hikvision `dynamicCap` when the firmware has it, else the static capability document). A stream
whose capability documents cannot be read has `options: null` and `writable:false, not_writable_reason:"capabilities_unreadable"`.

### 3.4 `PUT /nvr/cameras/{camera_id}/streams/{stream_ref}` (S2)

```json
{ "if_match": "9b1e4c0a77d2f1e3", "confirm": true, "changes": { "svc": false } }
```

Only the fields being changed; at least one. Answer 200:

```json
{
  "change": {"id": "ch_01J...", "status": "applied", "kind": "stream_encoding", "created_at": "2026-10-01T09:14:20Z"},
  "stream": { "...": "the stream re-read from the device, §3.2 shape, new etag" },
  "applied_fields": ["svc"], "unchanged_fields": [], "reboot_required": false
}
```

Validation, in this order, all **before** any device write:

| Field | Type | Rule | Device element (inside `<Video>`) |
|---|---|---|---|
| `codec` | string | in `options.codec` | `videoCodecType` |
| `profile` | string | in `options.profile[codec]`; dropped silently when the codec has no profile element | `H264Profile` / `H265Profile` |
| `resolution` | `"WxH"` | in `options.resolution[codec]` (the codec after this change) | `videoResolutionWidth` + `videoResolutionHeight` |
| `fps` | number or `"full"` | in `options.fps`; `"full"` only when `options.fps_full` | `maxFrameRate` (x100; `"full"` = 0) |
| `bitrate_mode` | `CBR` / `VBR` | in `options.bitrate_mode` | `videoQualityControlType` |
| `bitrate_kbps` | integer | `min..max`; applies to the mode after this change | `constantBitRate` (CBR) / `vbrUpperCap` (VBR) |
| `quality` | integer | in `options.quality`; VBR only | `fixedQuality` |
| `gop` | integer | `min..max` | `GovLength` |
| `svc` | boolean | `options.svc` true | `SVC/enabled` (`SVCMode` kept as is) |
| `smart_codec` | boolean | `options.smart_codec` true | `SmartCodec/enabled` |
| `b_frames` | boolean | `options.b_frames` true (false on the lab firmware: 422 `field_not_supported`) | the device's own B-frame element |

Cross-field: a field locked by another field's value after this change (`options.locks`) is 422 `field_locked`. Only
elements present in the current document are written; the one insertion is `constantBitRate` right after
`videoQualityControlType` when switching to CBR on a document that has none (ISAPI element order). Every other element
of the document is kept byte for byte (text-level edits, as `nvr_write.motion_document`; no XML re-serialization - a
namespace prefix rewrite is refused by Hikvision firmwares).

### 3.5 Undo

The existing `POST /nvr/changes/{change_id}/rollback` (the change's `permission` is `nvr.configure`, so the same
permission). For `kind = stream_encoding` it additionally: refuses 409 `stale` when the stream's current etag is not the
etag of the change's `after` document (someone changed it since); runs the same two-phase path as §4 (rollback is a
write); refreshes the registry (§5.3). `GET /nvr/changes?camera_id=` filters the existing change log (new query param).
The UI offers undo on the success toast (10 s) and in the change log.

### 3.6 Add and remove a camera (S3)

Feasible on Hikvision NVR firmware 4.x over InputProxy; the lab probe shows `inputProxyNums=16` and ten used channels.
**UNVERIFIED on the lab NVR** until an approved write. PoE-port channels are plug-and-play on PoE models: the device may
refuse their removal (`nvr_not_supported`).

`POST /nvr/recorders/{recorder_id}/channels`

```json
{ "confirm": true, "name": "חניה", "address": "camera.host.or.ip", "port": 8000, "protocol": "HIKVISION",
  "username": "admin", "password": "••••", "src_input_port": 1 }
```

`protocol`: `HIKVISION` | `ONVIF` (from the capability document's options). The camera must already be activated.
Device call: `POST /ISAPI/ContentMgmt/InputProxy/channels` with an `InputProxyChannel` document. Answer 201
`{change, channel: {source_ref, name, online}, discovery: "queued"}`; the Arx camera row is created by the discovery run
the route triggers (one code path for camera rows). The password exists only in the request body and the outgoing
document: the stored `after` document has `<password>***</password>`, the audit has neither address nor user name.
Undo of an add = removal (a new change).

`DELETE /nvr/cameras/{camera_id}/channel` with body `{ "confirm_name": "חניה" }` (must equal the camera's display name).
Device call: `DELETE /ISAPI/ContentMgmt/InputProxy/channels/{source_ref}`. The Arx camera row is **kept**: `enabled=0`,
`removed_from_recorder_at` set; anchors, bindings, cases, saved views untouched; go2rtc streams of a disabled camera are
no longer ensured (existing `ensure_streams` behaviour). Not rollbackable (409 `not_rollbackable`: re-adding needs the
password). Recordings already on the NVR's disks are not touched by Arx.

## 4. Write path: two phases and the SQLite rule

Every device write (PUT encoding, rollback, add, remove) runs in `services/nvr_settings.py` like this:

1. `require(conn, principal, "nvr.configure", INSTALLATION)`, then `require_camera(..., "nvr.configure")` (T055).
2. Pydantic shape check; `confirm` true else 422 `confirm_required`.
3. `with unlocked(conn):` adapter reads the stream document and options (fresh). Etag ≠ `if_match` → 409 `stale`
   (details: the current stream). Field validation (§3.4) → 422. Nothing written yet.
4. Under the request's write lock: refuse 409 `write_in_progress` when a `pending` change exists for the same
   `(recorder_id, stream_ref)`; insert `nvr_changes` with `status='pending'`, `before_xml` = the document read in step 3
   (the undo snapshot), `after_xml` = the intended document, `fields_json` = `{field: [from, to]}`; write the audit row
   `phase:"attempt"`.
5. `with unlocked(conn):` (commits step 4 first) adapter `write_stream_encoding`: GET again and compare the etag (409
   `stale` if it moved in between), PUT, GET-verify. No SQLite access inside the block - adapters never receive `conn`.
6. Lock retaken (`_relock` waits out a busy database; the attempt is already committed, so a device action is never
   unrecorded): update the change to `applied` / `no_effect` / `refused` / `failed` with the verified `after_xml`, write
   the audit row `phase:"outcome"`, refresh the registry (§5.3) - one transaction.
7. Start-up janitor: a `pending` row older than 2 minutes is settled by reading the device - equals `after` → `applied`,
   equals `before` → `failed` (`error:"interrupted"`), anything else → `diverged`; audited with `actor:null`.

Never retried automatically (AGENTS: no blind retry of device commands). One write per stream at a time (step 4).

### 4.1 Audit rows (`audit_log`)

| action | resource | when | details (never secrets, addresses, user names, serials) |
|---|---|---|---|
| `nvr.stream.write` | `camera` / `camera_id` | attempt + outcome | `phase`, `recorder_id`, `stream_ref`, `role`, `fields` `{svc:[true,false]}`, `change_id`, outcome: `status`, `device_status`, `reboot_required` |
| `nvr.rollback` | `camera` / `camera_id` | attempt + outcome | `phase`, `rollback_of`, `change_id` |
| `nvr.channel.add` | `recorder` / `recorder_id` | attempt + outcome | `phase`, `protocol`, `src_input_port`, `name`, `change_id`, outcome `source_ref` |
| `nvr.channel.remove` | `camera` / `camera_id` | attempt + outcome | `phase`, `source_ref`, `change_id` |
| `cameras.replaced` | `camera` / `camera_id` | discovery sees a new fingerprint | `recorder_id`, `source_ref` |
| `nvr.configure` (denied) | as targeted | `require` refuses | the standard denied row |

## 5. Device behaviour (Hikvision adapter)

### 5.1 Capability discovery, never endpoint guesses

Per stream, first time in the process (cached by `recorder_id + firmware + stream_ref`):
1. `GET /ISAPI/Streaming/channels/{sid}/capabilities` → 200: options from the `opt` / `min` / `max` attributes, write
   path `/ISAPI/Streaming/channels/{sid}`.
2. else `GET /ISAPI/ContentMgmt/StreamingProxy/channels/{sid}/capabilities` → 200: write path
   `/ISAPI/ContentMgmt/StreamingProxy/channels/{sid}` (the proxy path some NVR firmwares use for IP channels).
3. else `writable:false`, `not_writable_reason` = the device's sub status (`notSupport`, `http_403`, ...).
Codec-dependent lists come from `GET /ISAPI/Streaming/channels/{sid}/dynamicCap` when it answers 200. Width and height
`opt` lists are paired by position. The lab firmware (V4.84) answered `GET /ISAPI/Streaming/channels` with the IP
channels' streams on 2026-09-14; whether its PUT on path 1 reaches the proxied camera is **not proven** (AT-020-16).

### 5.2 Device answers

| Device answer | Arx answer | change status |
|---|---|---|
| 200, `statusCode 1` | 200 | `applied` |
| 200, `statusCode 7` (Reboot Required) | 200 `reboot_required:true` | `applied` |
| `statusCode 2` (Device Busy) - incl. a refusal while the channel records or plays back, where the firmware says so | 409 `nvr_busy`, retryable, never retried by Arx | `refused` |
| 403 / `subStatusCode notSupport` | 409 `nvr_not_supported` | `refused` |
| `statusCode 4/5/6` (Invalid Operation / XML format / XML content) | 409 `nvr_rejected` (details: code, sub) | `refused` |
| 401 / 403 without notSupport | 503 `source_forbidden` | `failed` |
| timeout / connection error | 503 `source_unavailable` | `failed` (the janitor's re-read settles a write that did land) |
| verify GET shows the old values | 409 `nvr_no_effect` | `no_effect` |

Arx does not add its own "in use" refusal: its live viewers reconnect by themselves (§5.3), and an encoding change does
not alter recordings already on disk.

### 5.3 After a write: the codec registry and the players

In the outcome transaction (step 6), for `role` `main` or `sub`: the verified document is parsed with
`nvr.parse_streaming_channel` and written into `cameras.capabilities_json["encoding"][role]` (`source:"isapi"`, fresh
`webrtc` verdict, `checked_at` now, `error` null) - the same entry the discovery builds (`stream_codecs.build`), so
`stream_codecs.summary` / `hints`, `/health`, the health report and the setup wizard show the new verdict at once. A
`third` / `other` stream is not in the registry (no player uses it). No go2rtc write: the RTSP URL
(`/Streaming/Channels/<ch>01|02`) does not change; go2rtc's producer reconnects when the camera restarts its encoder,
and the browser player re-reads the camera's verdict on its next camera list read (`frontend/src/api/video-policy.ts`).
The next discovery run (every 10 min) re-reads everything anyway.

## 6. Error codes

| HTTP | code | When |
|---|---|---|
| 403 | `forbidden` | permission or camera scope (audited) |
| 404 | `not_found` | camera, stream, recorder or change unknown |
| 409 | `nvr_not_configured` | NVR-less mode |
| 409 | `stale` | `if_match` / rollback etag does not match the device |
| 409 | `write_in_progress` | a pending change on the same stream |
| 409 | `nvr_busy` / `nvr_not_supported` / `nvr_rejected` / `nvr_no_effect` | §5.2 |
| 409 | `not_rollbackable` | removal, or a change without a `before` document |
| 409 | `channel_slots_full` | add: no free InputProxy slot |
| 422 | `validation` | body shape |
| 422 | `confirm_required` | `confirm` missing / false, or `confirm_name` mismatch |
| 422 | `value_not_allowed` | value outside the device's options (details: `field`, `allowed`) |
| 422 | `field_not_supported` / `field_locked` | §3.4 |
| 503 | `source_unavailable` / `source_forbidden` / `capabilities_unreadable` | device unreachable / refuses the account / no capability document |

## 7. Implementation map

| Piece | Where |
|---|---|
| Routes | new `routers/nvr_settings.py` (prefix `/nvr`, no clash with `/nvr/notify`, `/nvr/system`, `/nvr/changes`) |
| Service (two-phase, registry refresh, janitor) | new `services/nvr_settings.py` |
| Adapter Protocol + registry + Hikvision adapter | new `services/recorders/` (ADP §2) |
| Parser additions (all streams, bitrate, quality, capability options) | `services/nvr.py` (new functions; `parse_streaming_channels` keeps its main/sub output) |
| Rollback hook for `stream_encoding` | `routers/nvr_write.py::rollback_change` |
| Permission | `roles.json` (`system_admin`), `routers/access.py` `SYSTEM_PERMISSIONS`, `PERMISSION_LABELS` |
| Fake device | `tests/fixtures/fake_devices.py`: PUT of streaming channels, capabilities, statusCode knobs, InputProxy POST/DELETE |
