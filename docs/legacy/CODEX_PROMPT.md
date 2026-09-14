# Codex prompt - HikHA NVR for Home Assistant

Build a production-grade Home Assistant NVR application for Hikvision devices using ISAPI. The UI must match the provided mockups exactly in mood, layout density, hierarchy, RTL Hebrew copy, and responsive behavior.

## Product goal

Create **HikHA NVR**, a Home Assistant-native surveillance command center that runs inside Home Assistant and is fully usable from the Home Assistant mobile app. It connects to a Hikvision NVR/cameras via ISAPI, exposes a beautiful sidebar panel, optional Lovelace cards, live view, playback search, event center, PTZ controls, system health, and onboarding.

Use the mockups in this folder as the visual contract:

1. `01_desktop_command_center.png` - desktop Home Assistant sidebar panel with camera wall, KPIs, live events, and NVR health.
2. `02_mobile_overview.png` - mobile overview with live tiles, event card, and bottom navigation.
3. `03_mobile_live_ptz.png` - mobile live camera with PTZ joystick, presets, and quick actions.
4. `04_desktop_playback_smart_search.png` - playback, smart search, clip list, and timeline markers.
5. `05_desktop_event_center.png` - alarm/event inbox connected to HA automations.
6. `06_desktop_nvr_health_settings.png` - channel status, storage, authentication, and diagnostics.
7. `07_desktop_setup_wizard.png` - onboarding wizard to discover NVR, authenticate, discover cameras, map areas, choose streaming.
8. `08_desktop_ha_dashboard_cards.png` - compact Lovelace-style cards.

## Recommended architecture

Prefer a Home Assistant custom integration with a sidebar panel and optional custom cards:

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
  media_source.py (optional)
  websocket_api.py
  panel.py
  translations/he.json
frontend/
  package.json
  src/
    hikha-nvr-panel.ts
    cards/hikha-camera-wall-card.ts
    cards/hikha-event-timeline-card.ts
    cards/hikha-health-card.ts
    components/
    styles/tokens.ts
```

Alternative: if implementing as a Home Assistant App/Add-on, enable Ingress and serve the same frontend through the HA UI. Even in add-on mode, credentials must stay on the server side.

### Critical rule

Never call the NVR directly from the browser. The frontend must call the Home Assistant backend/integration. The backend handles Digest authentication, RTSP URL generation, snapshots, event stream parsing, and credential storage.

## ISAPI implementation requirements

Implement a `HikvisionISAPIClient` with async HTTP, Digest auth, XML/JSON parsing, retries, timeouts, and redacted logs.

### Core protocol behavior

- ISAPI uses HTTP and RTSP style operations. HTTP endpoints use `GET`, `POST`, `PUT`, and `DELETE`. RTSP is used for live view, two-way audio, and playback.
- Support URL construction for `/ISAPI/...` resources and query parameters like `?format=json` when a JSON response is expected.
- Support XML as the default format, and JSON when the endpoint supports `format=json`.
- Use ISO8601 timestamps for search and event APIs.
- Use HTTP Digest auth. Handle initial `401`, parse `WWW-Authenticate`, compute the digest response, and retry. Store credentials in Home Assistant config entries/options, not in frontend state.

### Endpoint mapping

Device and security:

```text
GET /ISAPI/System/deviceInfo
GET /ISAPI/System/status
GET /ISAPI/System/workingstatus?format=json
GET /ISAPI/System/capabilities
GET /ISAPI/Security/capabilities
GET /ISAPI/Security/UserPermission
```

Channels and streams:

```text
GET /ISAPI/Streaming/channels
GET /ISAPI/Streaming/channels/<ID>
GET /ISAPI/Streaming/channels/<ID>/capabilities
GET /ISAPI/Streaming/channels/<ID>/status
GET /ISAPI/Streaming/status
GET /ISAPI/Streaming/channels/<ID>/picture
GET /ISAPI/ContentMgmt/InputProxy/channels
GET /ISAPI/ContentMgmt/InputProxy/channels/status
GET /ISAPI/ContentMgmt/InputProxy/channels/<ID>/status
GET /ISAPI/ContentMgmt/InputProxy/search
POST /ISAPI/ContentMgmt/InputProxy/sourceCapability
```

Live streaming and playback:

```text
rtsp://<host>:554/ISAPI/Streaming/channels/<ID>
rtsp://<host>:554/ISAPI/Streaming/tracks/<ID>?starttime=<UTC>&endtime=<UTC>
PUT /ISAPI/ContentMgmt/record/control/manualRefresh/channels/<ID>
```

Recordings and smart search:

```text
GET /ISAPI/ContentMgmt/search/profile
POST /ISAPI/ContentMgmt/search
POST /ISAPI/ContentMgmt/record/tracks/<ID>/dailyDistribution
GET /ISAPI/ContentMgmt/SmartSearch/capabilities
POST /ISAPI/ContentMgmt/SmartSearch
GET /ISAPI/SDT/Management/capabilities?format=json
GET /ISAPI/SDT/Management/IntelligentSearch/capabilities?format=json
POST /ISAPI/SDT/Management/IntelligentSearch?format=json
POST /ISAPI/SDT/Management/IntelligentSearch/export?format=json
GET /ISAPI/SDT/Management/IntelligentSearch/export/progress?format=json&taskID=<id>
```

Events and alarms:

```text
GET /ISAPI/Event/capabilities
GET /ISAPI/Event/notification/alertStream
GET /ISAPI/Event/notification/subscribeEventCap
POST /ISAPI/Event/notification/subscribeEvent
PUT /ISAPI/Event/notification/unSubscribeEvent
GET/PUT /ISAPI/Event/notification/httpHosts
GET/PUT/DELETE /ISAPI/Event/triggers/<ID>/notifications
```

PTZ and camera control:

```text
GET /ISAPI/PTZCtrl/channels/<ID>/capabilities
GET/PUT /ISAPI/PTZCtrl/channels/<ID>
GET /ISAPI/PTZCtrl/channels/<ID>/status
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/zoomFocus
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/auxcontrols
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/auxcontrols/<ID>
GET/PUT /ISAPI/PTZCtrl/channels/<ID>/lockPTZ
GET/PUT /ISAPI/System/Video/inputs/channels/<ID>/focus
GET/PUT /ISAPI/System/Video/inputs/channels/<ID>/iris
```

Storage and recording control:

```text
GET /ISAPI/ContentMgmt/Storage/hdd
GET /ISAPI/ContentMgmt/Storage/hdd/<ID>
GET /ISAPI/ContentMgmt/Storage/hdd/capabilities
GET /ISAPI/ContentMgmt/record/tracks
GET /ISAPI/ContentMgmt/record/tracks/<ID>
GET /ISAPI/ContentMgmt/record/tracks/<ID>/capabilities
POST /ISAPI/ContentMgmt/record/control/manual/start/tracks/<ID>
POST /ISAPI/ContentMgmt/record/control/manual/stop/tracks/<ID>
```

Two-way audio:

```text
GET /ISAPI/System/TwoWayAudio/channels
GET /ISAPI/System/TwoWayAudio/channels/<ID>
PUT /ISAPI/System/TwoWayAudio/channels/<ID>/open
PUT /ISAPI/System/TwoWayAudio/channels/<ID>/close
GET/PUT /ISAPI/System/TwoWayAudio/channels/<ID>/audioData
```

## Backend API to expose to frontend

Expose a Home Assistant websocket API or authenticated REST endpoints. Suggested frontend contract:

```ts
type NvrSummary = {
  deviceId: string;
  model: string;
  firmware?: string;
  online: boolean;
  lastUpdate: string;
  authStatus: 'ok' | 'bad_credentials' | 'locked' | 'error';
  channelOnline: number;
  channelTotal: number;
  recordingActive: number;
  storageUsedPct: number;
  events24h: number;
};

type CameraChannel = {
  id: string;
  channelId: string;
  trackId?: string;
  name: string;
  area?: string;
  online: boolean;
  signal: 'normal' | 'loss' | 'unknown';
  recordStatus: 'recording' | 'exception_hdd' | 'exception_camera_offline' | 'exception_other' | 'unknown';
  mainStreamId?: string;
  subStreamId?: string;
  snapshotUrl: string;
  liveStreamUrl?: string;
  ptz: boolean;
  audio: boolean;
  vca: boolean;
};

type NvrEvent = {
  id: string;
  type: 'motion' | 'person' | 'vehicle' | 'line_crossing' | 'intrusion' | 'hdd' | 'video_exception' | 'record_exception' | 'auth' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cameraId?: string;
  cameraName?: string;
  timestamp: string;
  titleHe: string;
  descriptionHe: string;
  confidence?: number;
  snapshotUrl?: string;
  playbackUri?: string;
  handled: boolean;
};

type RecordingClip = {
  id: string;
  cameraId: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  eventType?: string;
  confidence?: number;
  playbackUri: string;
  thumbnailUrl?: string;
};

type DiskStatus = {
  id: string;
  name: string;
  type?: string;
  status: 'ok' | 'unformatted' | 'error' | 'offline' | 'smartFailed' | 'formatting' | 'unknown';
  capacityMb: number;
  freeMb: number;
  usedPct: number;
};
```

Suggested endpoints/actions:

```text
GET  /api/hikha_nvr/summary
GET  /api/hikha_nvr/cameras
GET  /api/hikha_nvr/cameras/<id>/snapshot
GET  /api/hikha_nvr/cameras/<id>/stream-source
GET  /api/hikha_nvr/events?limit=50
POST /api/hikha_nvr/events/<id>/ack
GET  /api/hikha_nvr/recordings?camera_id=&start=&end=&type=
POST /api/hikha_nvr/recordings/export
POST /api/hikha_nvr/ptz/<camera_id>/move
POST /api/hikha_nvr/ptz/<camera_id>/preset
POST /api/hikha_nvr/cameras/<id>/snapshot
POST /api/hikha_nvr/cameras/<id>/manual-record/start
POST /api/hikha_nvr/cameras/<id>/manual-record/stop
GET  /api/hikha_nvr/storage
GET  /api/hikha_nvr/diagnostics
WS   hikha_nvr/subscribe_events
```

## Streaming behavior

Implement streaming in layers:

1. If Home Assistant camera entities are created, use HA’s native camera stream support in the frontend.
2. Return RTSP sources from the backend for HA/ffmpeg/go2rtc to consume.
3. Prefer WebRTC for live mobile viewing when available; fall back to HLS; fall back to still snapshot refresh for unsupported devices.
4. For playback, use recording search results and `playbackURI`/RTSP track URLs returned by the NVR; keep start/end in UTC.
5. Do not assume channel numbering. Discover streaming channels and recording tracks and map them during onboarding.

## Frontend implementation requirements

Use TypeScript and Lit custom elements. Use Home Assistant design conventions and CSS variables, but apply the custom HikHA visual system from the mockups.

### Visual style

- Dark glassmorphism command center.
- RTL Hebrew by default with `dir="rtl"`; keep technical values and URLs with `dir="ltr"`.
- Rounded panels: 22-30px.
- Colors: deep navy background, cyan primary, green OK, amber warning, red alert, purple accent.
- No generic admin dashboard look. It must feel like a premium Home Assistant security console.
- Use animated skeletons for camera loading and smooth transitions under 180ms.
- Respect `prefers-reduced-motion`.
- Use responsive layouts: desktop sidebar panel, tablet 2-column, mobile bottom navigation.

### Main routes/views

1. **Live / Command Center**
   - KPIs: channels online, recording active, events in 24h, storage usage.
   - Camera wall with live/snapshot tiles, event overlays, confidence badges.
   - Event feed and NVR health side rail.

2. **Mobile Overview**
   - Compact live tiles.
   - Event summary.
   - Bottom navigation: חי, אירועים, הקלטות, PTZ, NVR.

3. **Live Camera + PTZ**
   - Full video pane.
   - PTZ joystick.
   - Presets.
   - Quick actions: record, snapshot, talk, light/siren/aux.
   - Disable PTZ controls if capability check fails.

4. **Playback / Smart Search**
   - Date/time/channel filters.
   - Event-type chips.
   - Clip results.
   - Timeline with colored markers.
   - Export selected clip.

5. **Event Center**
   - Real-time event stream.
   - Acknowledge/handled status.
   - Link to HA actions: turn on light, siren, notification, automation.
   - Event distribution chart.

6. **NVR Health and Settings**
   - Channel table.
   - HDD cards and donut usage.
   - Digest/HTTPS status.
   - Device info and diagnostics.
   - Re-auth and reconnect controls.

7. **Setup Wizard**
   - Connect to NVR.
   - Digest authentication test.
   - Discover cameras.
   - Map cameras to HA areas.
   - Choose WebRTC/HLS/snapshot fallback.
   - Configure privacy, masks, notification rules.

8. **Lovelace Cards**
   - `custom:hikha-camera-wall-card`
   - `custom:hikha-event-timeline-card`
   - `custom:hikha-nvr-health-card`

## Hebrew UI copy

Use these Hebrew labels exactly where practical:

```text
מרכז בקרה NVR
מצלמות הבית
תצוגה חיה
אירועים חיים
בריאות NVR
חיפוש הקלטות חכם
מרכז אירועים ואוטומציות
בריאות מערכת והגדרות ISAPI
אשף התקנה מהיר
מצב פרטיות
פתח תצוגת קיר
ייצוא קליפ
בדיקת חיבור
שמור הגדרות
המשך
חי
אירועים
הקלטות
PTZ
NVR
אדם זוהה
קו נחצה
רכב זוהה
הקלטה פעילה
אחסון בשימוש
ערוצים אונליין
```

## Security and privacy acceptance criteria

- Credentials never appear in logs, URLs, browser storage, frontend state, or diagnostics dumps.
- Use a least-privilege Hikvision user where possible instead of `admin`.
- Handle failed authentication and locked users gracefully.
- Support HTTPS to NVR where available.
- If running as an Ingress app, only accept requests from the Home Assistant ingress gateway and rely on HA authentication.
- Provide privacy mode that can hide live images in the UI and optionally pause polling/notifications according to user settings.
- Provide masks/blur placeholders in the UI for private areas.

## Error states

Implement beautiful empty/error states:

- NVR offline.
- Bad credentials.
- User locked.
- Camera offline/signal loss.
- Recording exception.
- HDD error/unformatted/offline.
- PTZ unsupported.
- WebRTC unavailable; falling back to HLS/snapshot.
- Device returns XML/JSON ResponseStatus with `notSupport`, `lowPrivilege`, `badAuthorization`, or `deviceBusy`.

## Testing

Add tests for:

- Digest auth header generation.
- XML parsing for channel, recording search, hdd, and response status.
- JSON parsing for working status and VCA search.
- Event stream parsing and reconnect.
- Time-zone conversion to/from ISO8601 UTC.
- UI rendering in desktop and mobile widths.
- RTL layout preservation.

## Definition of done

- Frontend visually matches the mockups at 1440x1024 desktop and 390x844 mobile.
- Setup wizard can connect to a real or mocked Hikvision NVR.
- Camera list, status, storage, and event feed are populated from backend data.
- Live view uses real HA camera stream/WebRTC/HLS if configured, otherwise snapshot fallback.
- Playback search returns clips from ISAPI ContentMgmt search and renders them on the timeline.
- PTZ buttons call backend APIs only when PTZ capability is detected.
- Lovelace cards can be registered and added to a dashboard.
- Works in Home Assistant desktop web UI and the Home Assistant mobile app.
