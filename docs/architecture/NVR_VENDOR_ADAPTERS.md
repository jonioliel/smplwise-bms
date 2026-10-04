# Recorder vendor adapters (CR-020)

**Status:** design, 2026-10-01. Nothing implemented. Phase 1 builds the Protocol, the registry and the Hikvision adapter
only (CR-020 S1-S3). Contract of the routes on top: `NVR_SETTINGS_API.md` ("API §n").

## 1. Rules for every adapter

1. **Device I/O only.** An adapter never receives a SQLite connection, never writes audit rows, never decides
   permissions. The service layer (`services/nvr_settings.py`) calls it inside `with unlocked(conn):` and records
   everything itself (API §4). This is what keeps the write lock free during device calls.
2. **Synchronous, bounded.** Plain `httpx.Client` calls with explicit timeouts (reads 8 s, writes 15 s, health 4 s);
   called from sync route handlers or the threadpool, never on the event loop.
3. **Declared, not guessed.** Every optional ability is in `capabilities()`; a route asks before it calls. A device
   that says `notSupport` makes the ability `False` for that stream or recorder, with the reason (AGENTS: capability
   discovery beats endpoint guesses).
4. **Errors are `ApiError` with the shared codes** (`source_unavailable`, `source_forbidden`, `nvr_busy`,
   `nvr_not_supported`, `nvr_rejected`, `nvr_no_effect`) so routes stay vendor-neutral.
5. **Secrets stay inside.** Addresses, user names, passwords, serials and MACs never leave an adapter except as the
   keyed fingerprint (§3.3). Raw device documents returned for the change log are already redacted (`<password>***`).
6. **Normalized values.** Codec `H.264` / `H.265` / `MJPEG` / raw string; resolution `"WxH"`; fps float (or full);
   bitrate kbps; booleans for SVC / smart codec / B-frames; `None` = the device does not say.

## 2. The interface

New package `smplwise/services/recorders/`: `base.py` (Protocol + dataclasses), `registry.py`, `hikvision.py`.

```python
from typing import ClassVar, Literal, Protocol

Role = Literal["main", "sub", "third", "other"]

@dataclass(frozen=True)
class RecorderCapabilities:
    vendor: str                          # "hikvision" | "provision_isr" | "frigate"
    read_encodings: bool
    write_encodings: bool
    encoding_fields: frozenset[str]      # the fields of API §3.4 this vendor can carry at all
    add_channel: bool
    remove_channel: bool
    max_channels: int | None
    live: Literal["rtsp", "none"]        # what go2rtc can pull
    playback: Literal["rtsp", "hls", "none"]   # later goal, declared now
    events: Literal["push", "poll", "none"]    # later goal, declared now

@dataclass(frozen=True)
class RecorderHealth:
    online: bool
    model: str | None
    firmware: str | None
    error: str | None                    # ApiError code
    clock_drift_s: float | None          # for the cross-recorder timeline (§6.2)

@dataclass(frozen=True)
class ChannelInfo:
    source_ref: str                      # vendor key: "1" (Hikvision), "front_door" (Frigate)
    channel: int | None                  # numeric slot where the vendor has one
    name: str
    online: bool | None
    fingerprint: str | None              # keyed hash, §3.3
    main_track: int | None = None        # recording track ids (Hikvision), from the device
    sub_track: int | None = None

@dataclass(frozen=True)
class StreamEncoding:
    stream_ref: str                      # "101"
    role: Role
    enabled: bool | None
    encoding: dict[str, object]          # normalized fields + per-field supported facts
    etag: str | None
    document: str | None                 # the raw device document (redacted), for the change log only

@dataclass(frozen=True)
class WriteOutcome:
    status: Literal["applied", "unchanged", "no_effect"]
    before: str                          # snapshot for undo
    after: str                           # verified document
    stream: StreamEncoding               # re-read after the write
    reboot_required: bool
    device_status: str | None            # "1", "7", sub status

class RecorderAdapter(Protocol):
    vendor: ClassVar[str]
    recorder_id: str

    def capabilities(self) -> RecorderCapabilities: ...
    def health(self) -> RecorderHealth: ...
    def list_channels(self) -> list[ChannelInfo]: ...
    def read_stream_encodings(self, source_ref: str | None = None) -> dict[str, list[StreamEncoding]]: ...
    def stream_options(self, source_ref: str, stream_ref: str, codec: str | None = None) -> dict[str, object] | None: ...
    def write_stream_encoding(self, source_ref: str, stream_ref: str, changes: dict[str, object], *, expect_etag: str) -> WriteOutcome: ...
    def add_channel(self, spec: "NewChannel") -> ChannelInfo: ...        # NewChannel holds the password; never stored
    def remove_channel(self, source_ref: str) -> None: ...
    def live_source(self, source_ref: str, role: Role) -> str: ...      # server-side URL for go2rtc (credentials inside)
```

Methods a vendor cannot offer raise `ApiError(409, "nvr_not_supported")`; `capabilities()` already says so, so routes
normally never call them. `registry.adapter_for(conn, recorder_id) -> RecorderAdapter` reads the `recorders` row
(vendor, connection reference) and builds the adapter; `registry.all_recorders(conn)` lists enabled ones.

## 3. Identity

### 3.1 Recorders

`recorders.id` is assigned once at registration and never derived from an address: `nvr-1` today (the add-on's NVR,
`autosync.DEFAULT_RECORDER`), then `nvr-2`, `frigate-1`, ... (`<kind>-<n>`, matching go2rtc's name rule `[A-Za-z0-9_.-]`,
never starting with `ha_`). Changing an NVR's address or credentials keeps its id; replacing the box with a new one is
a connection change, not a new recorder, unless the administrator says so.

### 3.2 Cameras

`cameras.id` stays the random id from discovery (`new_id()`); everything in Arx (anchors, bindings T055, cases, saved
views, walls, events) references it. Discovery matches a channel to its row by `(recorder_id, source_ref)` (new, unique)
instead of `(recorder_id, channel)`; for Hikvision `source_ref = str(channel)`, so migration 0050 back-fills it with no
behaviour change. Frigate has no numeric slot: `channel` gets a synthetic number (the next free one on that recorder,
assigned once) because `cameras.channel` is `NOT NULL` and the UI shows a channel column.

### 3.3 The physical camera behind a slot

Hikvision `InputProxyChannel/sourceInputPortDescriptor` carries model and serial number (lab probe). Discovery stores
`device_fingerprint = HMAC-SHA256(installation signing key, recorder_id | model | serial)[:16]` - the serial itself is
never stored. When a known slot reports a different fingerprint (a camera swapped or a slot reused after S3 removal),
the camera row is disabled, `cameras.replaced` is audited and the settings table shows it for review; the administrator
either confirms it is the same place (keep the id) or lets discovery create a new camera (the old one stays disabled).
A missing fingerprint (ONVIF channels often have none) disables nothing.

### 3.4 Streams

go2rtc names already carry the recorder: `smplwise_{recorder_id}_ch{channel}_{main|sub}` (`go2rtc.stream_name`), so a
second recorder cannot collide. `stream_ref` is the vendor's key (Hikvision streaming id `101`); `role` is the
normalized position. Hikvision: id `N01` = main, `N02` = sub, `N03` = third, higher = other.

## 4. More than one recorder

> **Status 2026-10-04 (CR-024, `docs/changes/CR-024-MULTI-NVR.md`, migration 0055):** built - every recorder has its
> `recorder_connections` row; `recorder_scope.settings_for` gives each recorder its own effective connection (overlaid at start-up)
> and the Hikvision adapter is built with it (`registry.adapter_for`, the device lock key per destination); the `nvr-1` literals are
> the camera's `recorder_id`; discovery and the alert stream run per recorder; the Settings recorders list exists. Not built: the
> per-recorder live budget, `adapter.live_source` (the RTSP URL builder still takes the recorder's settings), Provision-ISR / Frigate.

Phase 1 keeps one recorder and changes nothing for users. What the second recorder will need (not built in CR-020):

| Today | Needed for recorder n |
|---|---|
| ~~NVR connection in the add-on options / `data_dir/nvr_connection.json`~~ - since CR-022 (migration 0052): `recorder_connections`, one row per recorder (vendor, host, ports, user, AES-GCM `password_enc`), overlaid onto `Settings.nvr_*` once at start-up (`services/connection_store.py`) | every recorder, `nvr-1` included, gets its row in `recorder_connections`; `connection_ref` and the planned `recorder_credentials` table are redundant (CR-022 section 4: it IS that table, vendor-agnostic, system administrator only, never returned, not in backups) |
| `nvr.py` functions take `Settings` | the Hikvision adapter builds a per-recorder `Settings`-like connection and calls the same functions (no rewrite of the proven ISAPI code) |
| `'nvr-1'` literals: `routers/cameras.py` (5), `services/autosync.py` (5), `routers/nvr_write.py`, `services/events_ingest.py`, `services/go2rtc.py`, `services/setup_wizard.py`, `frontend/src/screens/devices-camera-card.ts` | each becomes "the camera's `recorder_id`" or "for each recorder"; discovery and the alert stream run per recorder |
| `stream_codecs.recorder_model` reads the first recorder | the camera's own recorder |
| `go2rtc.hikvision_rtsp_url(settings, ...)` | `adapter.live_source(...)` |
| Settings: one NVR connection form | a recorders list in the NVR settings area (add, test, enable, remove) |

Per-recorder limits (concurrent RTSP sessions, bandwidth) belong to the recorder row, so the live budget
(`frontend/src/api/live-budget.ts`) can count per recorder.

## 5. Vendors

### 5.1 Hikvision (phase 1) mapped to the current code

| Adapter method | Implementation | ISAPI |
|---|---|---|
| `health` | `nvr.device_info` (+ `nvr_system.time_status` for drift) | `GET /ISAPI/System/deviceInfo`, `/ISAPI/System/time` |
| `list_channels` | `nvr.discover_channels` + fingerprint from the same document | `GET /ISAPI/ContentMgmt/InputProxy/channels`, `/status`, `/ISAPI/ContentMgmt/record/tracks` |
| `read_stream_encodings` | new `nvr.parse_streaming_channels_all` (every stream, bitrate, quality, per-field supported); `parse_streaming_channel` is reused per element | `GET /ISAPI/Streaming/channels` |
| `stream_options` | new `nvr.parse_stream_capabilities` | `GET /ISAPI/Streaming/channels/{sid}/capabilities` → `.../StreamingProxy/channels/{sid}/capabilities`; `.../dynamicCap` |
| `write_stream_encoding` | new `nvr.stream_document(xml, changes)` (text-level edit) + the `nvr_write._put` / verify GET pattern | `PUT` on the path the capability probe chose |
| `add_channel` / `remove_channel` | new, InputProxy | `POST /ISAPI/ContentMgmt/InputProxy/channels`, `DELETE .../channels/{id}`; slots from `/ISAPI/ContentMgmt/capabilities` (`inputProxyNums`) |
| `live_source` | `go2rtc.hikvision_rtsp_url` | RTSP `/Streaming/Channels/{ch}01\|02` |
| capabilities | `read/write_encodings` true; `encoding_fields` all of API §3.4; add / remove true unless the probe says otherwise; `live:"rtsp"`, `playback:"rtsp"`, `events:"push"` (alert stream) | |

### 5.2 Provision-ISR (later; needs a read-only probe of a real unit first)

> **Superseded 2026-10-04 by CR-025** (`docs/changes/CR-025-PROVISION-ISR.md`): the vendor's own HTTP API v1 / v2.1
> documentation is now available (study: `docs/integrations/provision-isr/API_STUDY.md`). The adapter is
> `services/recorders/provision_isr.py` over HTTP API v1 (P1 read-only, built offline), not ONVIF. The text below is the
> earlier plan, kept for history.

The documented common ground is ONVIF. Provision-ISR's own HTTP API is not publicly documented to us.

| Ability | Via | Expectation |
|---|---|---|
| list channels, live | ONVIF Profile S `GetProfiles`, `GetStreamUri` | likely; whether the NVR exposes each proxied camera as a profile is **unverified** |
| read encodings | ONVIF Media2 `GetVideoEncoderConfigurations` (+ `...Options`) | codec, resolution, fps, bitrate, GOP. No SVC, no smart codec (not in ONVIF) → `encoding_fields` without them |
| write encodings | `SetVideoEncoderConfiguration` | whether the NVR passes it to the camera is **unverified** |
| add / remove channel | vendor API only | `False` until documented |
| playback | ONVIF Profile G (`FindRecordings`, replay URI) | only if the NVR implements Profile G |
| events | ONVIF PullPoint | `poll` |

Adapter: `onvif.py` (generic ONVIF NVR) with a `provision_isr` vendor tag for quirks; zeep / plain SOAP over httpx.

### 5.3 Frigate (later; never required - AGENTS: continuous recording stays on Hikvision)

| Ability | Via | Expectation |
|---|---|---|
| list channels | `GET /api/config` (camera names) | yes; `source_ref` = camera name, synthetic `channel` |
| live | Frigate's own go2rtc restream `rtsp://<frigate>:8554/<camera>` | yes |
| read encodings | `GET /api/ffprobe?paths=<camera>` (codec, resolution, fps of the input) | read-only facts; no SVC / smart codec / GOP control |
| write encodings | - | `False`: Frigate does not own the camera's encoder |
| add / remove channel | Frigate config save + restart (version-dependent) | `False` in this design (restarts every camera of that Frigate) |
| playback | HLS VOD `/vod/<camera>/start/<ts>/end/<ts>/index.m3u8` | `hls`: a different player path from RTSP playback |
| events | MQTT `frigate/events` / `GET /api/events` (`/api/review` on newer versions) | `push` (MQTT) or `poll` |

## 6. The later goals and what this design already fixes for them

### 6.1 One wall across recorders ("all cameras")

Walls, views and layouts already reference `camera_id` only; stream names carry the recorder. Needed later: the camera
list routes stop assuming one recorder, and the live budget counts per recorder. Nothing in CR-020 blocks it.

### 6.2 Synchronized playback across recorders

The shared timeline is UTC (`services/playback_groups.py`). Each recorder has its own wall clock, zone and drift
(`KNOWN_QUIRKS` T2): `RecorderHealth.clock_drift_s` and a per-recorder `time_zone` (migration 0050) let each member's
seek be converted on its own recorder. Members on different recorders are separate go2rtc producers with separate seek
generations; an HLS member (Frigate) needs its own player. AGENTS still applies: a playback stream is not a proven
synchronized recording until anchors, seek generations and rendered time are measured per recorder.

### 6.3 Event log from several sources

`events.source` is `alertstream | recording | system`. Later: a `recorder_id` column (NULL = not a recorder event, e.g.
Home Assistant) and sources `frigate` / `onvif`; the dedup key gains the recorder id; adapters expose an event iterator
(`capabilities.events`). Not in migration 0050 (no consumer yet).

## 7. Data model: migration 0050

> **Status 2026-10-03:** 0050 shipped with CR-020 S2 as `0050_nvr_stream_changes.sql` carrying only the `nvr_changes` columns
> (and the removal of `nvr.config.stream` from custom roles). The `recorders` / `cameras` columns below move to the first slice
> that needs them (S3 / second recorder) under the next free number. CR-021 holds 0051.
>
> **CR-022 (2026-10-03):** 0052 is `0052_recorder_connections.sql` (the NVR connection stored in Arx). When the `recorders`
> columns below land (NN1 P4, from 0053), drop `connection_ref`: the connection of every recorder lives in
> `recorder_connections`, and `vendor` there is the installer's choice (`hikvision` | `provision_isr` | `frigate` | `none`).

**Number chosen: 0050.** `g0/intake` ends at `0044_media_players.sql`. Other branches hold `0045_notifications`,
`0046_notify_settings`, `0047_notify_policies` (`integ/notify`, renumbered for CR-018), an automations migration (CR-017,
committed as `0045_automations`, to be renumbered after the notification ones) and `0049_switch_protection`
(`pilot/switch-model*`, CR-019); `0048_notify_policies` exists in an older worktree. 0050 is the first number no branch
uses. Re-check at merge time and renumber if another lands first.

```sql
-- 0050_recorder_adapters.sql (CR-020 S1)
ALTER TABLE recorders ADD COLUMN vendor TEXT NOT NULL DEFAULT 'hikvision';
ALTER TABLE recorders ADD COLUMN connection_ref TEXT NOT NULL DEFAULT 'addon';  -- 'addon' (add-on options) | 'db' (later: recorder_credentials)
ALTER TABLE recorders ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE recorders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE recorders ADD COLUMN time_zone TEXT;                                -- NULL = the installation's zone
ALTER TABLE recorders ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '{}';  -- last RecorderCapabilities

ALTER TABLE cameras ADD COLUMN source_ref TEXT;                                 -- the vendor's channel key
UPDATE cameras SET source_ref = CAST(channel AS TEXT) WHERE source_ref IS NULL;
CREATE UNIQUE INDEX ux_cameras_recorder_source ON cameras (recorder_id, source_ref);
ALTER TABLE cameras ADD COLUMN device_fingerprint TEXT;                         -- keyed hash, never the serial
ALTER TABLE cameras ADD COLUMN removed_from_recorder_at TEXT;                   -- S3: removed on the device, row kept

-- the change log gains the target, the field diff and the pending phase (status: pending | applied | unchanged |
-- no_effect | refused | failed | diverged | rolled_back)
ALTER TABLE nvr_changes ADD COLUMN recorder_id TEXT NOT NULL DEFAULT 'nvr-1';
ALTER TABLE nvr_changes ADD COLUMN camera_id TEXT;
ALTER TABLE nvr_changes ADD COLUMN stream_ref TEXT;
ALTER TABLE nvr_changes ADD COLUMN fields_json TEXT;                            -- {"svc": [true, false]}
ALTER TABLE nvr_changes ADD COLUMN etag_before TEXT;
ALTER TABLE nvr_changes ADD COLUMN etag_after TEXT;
ALTER TABLE nvr_changes ADD COLUMN reboot_required INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_nvr_changes_camera ON nvr_changes (camera_id, created_at);
CREATE INDEX idx_nvr_changes_pending ON nvr_changes (status) WHERE status = 'pending';
```

Not in 0050 (each with the feature that needs it): `recorder_credentials` (second recorder), `events.recorder_id`
(multi-source log). No per-stream cache table: the table view reads the device live (one GET), and the registry
(`cameras.capabilities_json.encoding`) remains the offline fallback and the players' source.

Rollback of the migration: the new columns are additive and ignored by older code; `ux_cameras_recorder_source` is
dropped by a down-script if ever needed. Project backups (`services/backup.py` `PROJECT_TABLES`) already carry
`recorders` and `cameras`, so the new columns travel with them; `nvr_changes` is not a project table and stays out.
