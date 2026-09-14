# Codex Prompt V2 — HikHA NVR for Home Assistant + Hikvision ISAPI

Build a production-grade Home Assistant NVR application for Hikvision NVR/cameras using ISAPI. The new UI must follow the mockups in this folder exactly in spirit: compact, fast, professional, RTL Hebrew, mobile-first where needed, and much less bulky than the first concept.

## Visual contract

Use these mockups as the product/UI specification:

1. `01_live_wall_layouts.png` — live wall with layout selector, stream selector, selected cameras, quick actions, and camera ordering panel.
2. `02_layout_manager.png` — drag-and-drop layout manager with saved views, 1/4/6/9/16/custom templates, and mobile override.
3. `03_camera_identity_settings.png` — camera aliases, NVR channel names, HA entity IDs, OSD sync toggle, areas, order, PTZ support.
4. `04_live_camera_actions.png` — single-camera live screen with manual recording, snapshot, clip export, bookmark, PTZ, talk, light/siren.
5. `05_mobile_wall_customization.png` — phone UI with layout bottom sheet and drag order.
6. `06_mobile_camera_control.png` — phone live camera, PTZ, record/snapshot/clip/talk actions and recent timeline.
7. `07_playback_multicam_timeline.png` — synchronized multi-camera playback, search panel, heatmap, markers, clip export.
8. `08_event_review_inbox.png` — review center for meaningful event windows, filters, treated/untreated workflow and HA automation shortcut.
9. `09_recording_rules_retention.png` — recording policy, schedules, retention, pre/post event buffer, storage forecast.
10. `10_health_diagnostics.png` — system health, channel diagnostics, bitrate, storage, auth, repair actions.
11. `11_ha_dashboard_cards.png` — Lovelace cards for camera wall, events, recording controls and health.
12. `12_setup_wizard_mapping.png` — guided setup and mapping of Hikvision channels to HA entities, names and layouts.

## Product goal

Create **HikHA NVR**, a Home Assistant-native surveillance interface that runs inside Home Assistant and is usable from the HA mobile app. It must feel like a modern NVR, not just a dashboard.

The core workflows are:

- Choose how many cameras appear on screen: 1, 2, 4, 6, 9, 12, 16, custom.
- Reorder cameras with drag-and-drop.
- Create saved camera views: outside, inside, night, alerts, all cameras, kiosk.
- Configure local aliases for cameras without changing the NVR.
- Optionally sync display names into Hikvision OSD/name overlay when enabled.
- Trigger manual recording and stop manual recording.
- Take snapshots.
- Create/export clips from recording search results.
- Review events quickly with thumbnails, playback links and HA automations.
- Use PTZ, presets, e-PTZ, zoom/focus where supported.
- See NVR health and channel diagnostics.
- Expose compact Lovelace cards.

## Recommended Home Assistant architecture

Prefer a custom integration with a sidebar panel and optional custom Lovelace cards.

```text
custom_components/hikha_nvr/
  __init__.py
  manifest.json
  config_flow.py
  const.py
  coordinator.py
  hikvision_isapi.py
  camera.py
  sensor.py
  binary_sensor.py
  button.py
  select.py
  switch.py
  media_source.py
  websocket_api.py
  panel.py
  translations/he.json
frontend/
  package.json
  src/
    hikha-nvr-panel.ts
    cards/hikha-camera-wall-card.ts
    cards/hikha-event-timeline-card.ts
    cards/hikha-recording-control-card.ts
    cards/hikha-health-card.ts
    components/
      camera-tile.ts
      layout-picker.ts
      layout-editor.ts
      timeline.ts
      event-review-card.ts
      ptz-controller.ts
      camera-name-editor.ts
    styles/tokens.ts
```

Alternative: implement as an HA add-on with Ingress, but still expose HA entities and services. In both cases, never call Hikvision directly from the browser.

## Non-negotiable security rule

The frontend must never receive the Hikvision username/password and must never make direct requests to the NVR.

All Hikvision/ISAPI calls go through the Home Assistant backend:

```text
Frontend panel/card → HA websocket or authenticated REST endpoint → Python integration → Hikvision ISAPI/RTSP
```

The backend handles Digest authentication, timeouts, retries, XML/JSON parsing, stream URL generation, snapshots, event stream parsing, recording controls and redacted logs.

## ISAPI implementation map

### Device, status and capabilities

```text
GET /ISAPI/System/deviceInfo
GET /ISAPI/System/status
GET /ISAPI/System/capabilities
GET /ISAPI/System/workingstatus?format=json
GET /ISAPI/System/workingstatus/chanStatus?format=json
GET /ISAPI/System/workingstatus/hdStatus?format=json
GET /ISAPI/ContentMgmt/Storage/hdd
GET /ISAPI/ContentMgmt/Storage/hdd/capabilities
```

### Camera channels and names

```text
GET /ISAPI/ContentMgmt/InputProxy/channels
GET /ISAPI/ContentMgmt/InputProxy/channels/status
GET /ISAPI/ContentMgmt/InputProxy/channels/<ID>/status
GET /ISAPI/Streaming/channels
GET /ISAPI/Streaming/channels/<ID>
GET /ISAPI/Streaming/channels/<ID>/status
GET /ISAPI/Streaming/status
GET /ISAPI/AUXInfo/attributes/Channels
GET /ISAPI/System/Video/inputs/channels?format=json
GET /ISAPI/System/Video/inputs/channels/<ID>/overlays
PUT /ISAPI/System/Video/inputs/channels/<ID>/overlays/channelNameOverlay
```

Use a local alias model by default. Only call the OSD/name overlay endpoint when `syncNameToNvr === true`.

### Live view, snapshots and stream handling

```text
rtsp://<host>:554/ISAPI/Streaming/channels/<ID>
GET /ISAPI/Streaming/channels/<ID>/picture
GET /ISAPI/Streaming/channels/<ID>/capabilities
GET /ISAPI/Streaming/channels/<ID>/dynamicCap
```

Expose camera entities with `stream_source` when possible. For the panel, prefer WebRTC or go2rtc-compatible restreaming for low latency; fallback to HLS/MSE/MJPEG as needed.

### Manual recording, schedules and recording state

```text
GET /ISAPI/ContentMgmt/record/profile
GET /ISAPI/ContentMgmt/record/tracks
GET /ISAPI/ContentMgmt/record/tracks/<ID>
GET /ISAPI/ContentMgmt/record/tracks/<ID>/capabilities
POST /ISAPI/ContentMgmt/record/control/manual/start/tracks/<ID>
POST /ISAPI/ContentMgmt/record/control/manual/stop/tracks/<ID>
POST /ISAPI/ContentMgmt/record/control/manualRefresh/channels/<ID>
```

### Playback, search and clip export

```text
GET /ISAPI/ContentMgmt/search/profile
POST /ISAPI/ContentMgmt/search
POST /ISAPI/ContentMgmt/record/tracks/<ID>/dailyDistribution
GET /ISAPI/ContentMgmt/SmartSearch/capabilities
POST /ISAPI/ContentMgmt/SmartSearch
GET /ISAPI/ContentMgmt/download/capabilities
GET /ISAPI/ContentMgmt/download
rtsp://<host>:554/ISAPI/Streaming/tracks/<ID>?starttime=<UTC>&endtime=<UTC>
```

Search first, then open playback URI or download/export a clip. Keep clip export tasks asynchronous.

### Event stream and review center

```text
GET /ISAPI/Event/capabilities
GET /ISAPI/Event/notification/alertStream
GET /ISAPI/Event/notification/subscribeEventCap
POST /ISAPI/Event/notification/subscribeEvent
PUT /ISAPI/Event/notification/unSubscribeEvent
GET/PUT /ISAPI/Event/notification/httpHosts
```

Convert low-level alerts into `ReviewItem` windows. A ReviewItem may contain several underlying events/objects and multiple cameras.

### PTZ, e-PTZ, presets, auxiliaries and talk

```text
GET /ISAPI/PTZCtrl/channels/<ID>/capabilities
GET/PUT /ISAPI/PTZCtrl/channels/<ID>
GET /ISAPI/PTZCtrl/channels/<ID>/status
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/zoomFocus
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/save?format=json
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/lockPTZ
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/auxcontrols
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/auxcontrols/<ID>
GET/PUT /ISAPI/Image/channels/<ID>/EPTZ
GET /ISAPI/Image/channels/<ID>/EPTZ/mode/capabilities?format=json
GET/PUT /ISAPI/Image/channels/<ID>/EPTZ/mode?format=json
GET /ISAPI/System/TwoWayAudio/channels
PUT /ISAPI/System/TwoWayAudio/channels/<ID>/open
PUT /ISAPI/System/TwoWayAudio/channels/<ID>/close
GET/PUT /ISAPI/System/TwoWayAudio/channels/<ID>/audioData
```

Only show controls that the capability endpoints confirm.

## Frontend data model

```ts
type CameraChannel = {
  id: string;
  hikvisionChannelId: string;      // e.g. "101" main stream, "102" sub stream
  inputProxyId?: string;           // NVR channel number, usually starts from 1
  trackId?: string;
  nvrName?: string;
  displayName: string;             // local alias shown in UI
  areaId?: string;
  haEntityId?: string;
  visible: boolean;
  sortOrder: number;
  online: boolean;
  signal: 'normal' | 'loss' | 'unknown';
  record: boolean;
  recordStatus: 'recording' | 'hdd_exception' | 'camera_offline' | 'other_exception' | 'unknown';
  mainStreamId?: string;
  subStreamId?: string;
  preferredLiveStream: 'auto' | 'main' | 'sub';
  preferredMobileStream: 'auto' | 'main' | 'sub';
  snapshotUrl?: string;
  ptz: boolean;
  eptz: boolean;
  audio: boolean;
  twoWayAudio: boolean;
  vca: boolean;
  lightOrSiren: boolean;
  syncNameToNvr: boolean;
};

type NvrLayout = {
  id: string;
  name: string;
  icon?: string;
  cameraCount: 1 | 2 | 4 | 6 | 9 | 12 | 16 | 'custom';
  layoutMode: 'grid' | 'focus' | 'masonry' | 'custom';
  streamPreference: 'auto' | 'main' | 'sub';
  tiles: LayoutTile[];
  mobileOverride?: {
    enabled: boolean;
    cameraCount: 1 | 2 | 4 | 6 | 9 | 12 | 16 | 'custom';
    columns: 1 | 2 | 3;
    streamPreference: 'auto' | 'main' | 'sub';
    tiles: LayoutTile[];
  };
  ownerUserId?: string;
  kiosk: boolean;
};

type LayoutTile = {
  cameraId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  order: number;
  pinned: boolean;
  showPtzOverlay: boolean;
  showBadges: boolean;
};

type RecordingRule = {
  cameraId: string;
  mode: 'continuous' | 'event' | 'manual_only' | 'off';
  stream: 'main' | 'sub' | 'sub_live_main_record';
  retentionDays: number;
  preEventSeconds: number;
  postEventSeconds: number;
  schedule: WeeklySchedule;
};

type ReviewItem = {
  id: string;
  cameraIds: string[];
  primaryCameraId: string;
  startTime: string;
  endTime: string;
  titleHe: string;
  severity: 'info' | 'motion' | 'alert' | 'critical';
  eventTypes: string[];
  thumbnailUrl?: string;
  playbackUris: Record<string, string>;
  handled: boolean;
  bookmarked: boolean;
};
```

Persist layouts and aliases in HA config entry options or a dedicated storage collection. Also support browser-specific preferences for stream choice and mobile layout, but do not rely only on localStorage.

## Backend websocket API

Expose authenticated HA websocket commands:

```text
hikha_nvr/get_summary
hikha_nvr/get_channels
hikha_nvr/update_camera_alias
hikha_nvr/sync_camera_name_to_nvr
hikha_nvr/get_layouts
hikha_nvr/save_layout
hikha_nvr/delete_layout
hikha_nvr/reorder_layout
hikha_nvr/get_live_stream
hikha_nvr/snapshot
hikha_nvr/manual_record_start
hikha_nvr/manual_record_stop
hikha_nvr/search_recordings
hikha_nvr/get_daily_distribution
hikha_nvr/export_clip
hikha_nvr/get_export_status
hikha_nvr/get_events
hikha_nvr/mark_event_handled
hikha_nvr/ptz_move
hikha_nvr/ptz_stop
hikha_nvr/ptz_preset
hikha_nvr/twoway_audio_open
hikha_nvr/twoway_audio_close
hikha_nvr/get_health
hikha_nvr/run_diagnostics
```

Also expose HA services for automations:

```yaml
hikha_nvr.snapshot
hikha_nvr.start_recording
hikha_nvr.stop_recording
hikha_nvr.export_clip
hikha_nvr.ptz_preset
hikha_nvr.set_layout
hikha_nvr.mark_event_handled
```

## UI behavior and acceptance criteria

### Live wall

- Layout selector must include 1, 2, 4, 6, 9, 12, 16 and custom.
- Camera order can be changed by drag-and-drop.
- Tiles can be selected for bulk actions.
- Tile actions: snapshot, manual record, open full camera, clip last N seconds, PTZ if supported.
- Saved views are available from desktop and mobile.
- Mobile can have a separate override for count/order/stream.
- When network is slow or device is mobile, use Sub stream automatically when configured.

### Camera aliases

- Every channel has `nvrName` and `displayName`.
- The app shows `displayName` by default.
- `syncNameToNvr` is optional and explicit.
- UI clearly explains whether a rename is local only or synced to Hikvision OSD.

### Recording and snapshots

- Manual record button shows active timer and can stop recording.
- Snapshot button saves image through the HA backend and returns a media URL.
- Clip export is asynchronous and exposes progress.
- Errors show friendly Hebrew messages and exact redacted technical details.

### Playback

- Search by camera(s), date, time range and event type.
- Show timeline heatmap and markers.
- Multi-camera playback keeps a synchronized playhead.
- Export selected time range as clip.

### Events

- Parse alert stream continuously.
- Merge related events into ReviewItems where useful.
- Show filters: camera, area, type, severity, handled/unhandled, time.
- Allow one-click HA automation creation using event metadata.

### Health

- Show channel online/offline, signal loss, record state, bitrate and connected client count.
- Show storage usage, quotas and SMART/status when available.
- Diagnostics should suggest next actions: check PoE, refresh channel, test credentials, verify permissions, inspect disk.

## Technical quality

- Python: async I/O, `aiohttp`, digest auth, XML and JSON parser helpers, retries with backoff.
- Frontend: Lit web components, TypeScript, no hardcoded credentials, RTL-first CSS, accessible controls, keyboard shortcuts.
- Large camera walls must be virtualized/lazy-loaded.
- Do not keep all Main streams active when not visible.
- Use snapshots or Sub streams for non-focused tiles when appropriate.
- Redact credentials, tokens, RTSP passwords and NVR host in logs.
- Include tests for ISAPI XML parsing, Digest auth flow, layout save/reorder, camera alias sync, manual recording and search payloads.

## Final deliverable

Produce a working Home Assistant custom integration and frontend panel/cards matching the provided V2 mockups. Include README, installation instructions, config flow, Hebrew translations, services, diagnostics, and example Lovelace YAML.
