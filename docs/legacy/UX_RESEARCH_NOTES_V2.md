# HikHA NVR V2 — Product and UX Research Notes

## What changed from V1

The first concept looked polished but behaved more like a dashboard. V2 is designed as a daily-use NVR console:

- Layout count and layout editing are first-class features.
- Camera ordering is visible and editable.
- Camera aliases are separated from Hikvision/NVR names.
- Actions such as recording, snapshot, clip export and PTZ are available at tile and camera level.
- Playback is multi-camera and synchronized.
- Events are grouped into reviewable windows rather than a noisy feed.
- Recording policy and retention are understandable and actionable.
- Mobile uses bottom sheets and saved views instead of squeezing desktop tables into a phone.

## Key product decisions

### 1. Saved views instead of one fixed wall

A good NVR is not one grid. It should support “outside”, “inside”, “night”, “alerts only”, “all cameras”, “kiosk” and custom views. Each view stores order, count, tile sizes and stream preference.

### 2. Local aliases by default

Users often want friendly names in the app without changing the device. HikHA should store `displayName` locally and only write to Hikvision OSD/name overlay when the user turns on explicit sync.

### 3. Per-device mobile override

A 16-camera desktop layout is not useful on a phone. Each saved view can have a mobile override with fewer cameras, different order and Sub stream preference.

### 4. Capability-aware controls

The UI must not show PTZ/talk/light/smart-search controls unless the device reports support. Unsupported controls should either disappear or show as disabled with a clear reason.

### 5. Event review, not raw alert spam

Raw event streams are noisy. The app should group close alerts into a review item with start/end time, primary camera, related cameras, severity and actions.

### 6. Storage forecast matters

Users need to understand how recording mode and retention affect storage. The recording screen should estimate days remaining and suggest optimizations.

## Usability checklist

- Can the user create a 6-camera layout in under 20 seconds?
- Can the user reorder cameras without opening YAML?
- Can the user rename “Camera 101” to “שער כניסה” and know whether it is local or synced to the NVR?
- Can the user start recording and clearly see that it is active?
- Can the user take a snapshot from desktop and mobile?
- Can the user search yesterday 21:30–22:00 across 4 cameras?
- Can the user export a clip without understanding RTSP URLs?
- Can the user see why one camera is offline and what to try next?
- Does the phone UI avoid dense tables?

## Suggested MVP phases

### Phase 1 — Solid NVR foundation

- Config flow and Digest auth.
- Discover channels and streaming channels.
- Camera aliases, order, area and visibility.
- Live wall with layout selector and saved views.
- Snapshot action.
- Manual recording start/stop.
- Basic health/status.

### Phase 2 — Playback and events

- Search recordings.
- Daily distribution/timeline.
- Playback URI generation.
- Clip export/download task.
- Alert stream parser.
- Review center.

### Phase 3 — Smart controls

- PTZ and e-PTZ.
- Presets/position save where supported.
- Two-way audio where supported.
- OSD sync.
- Recording schedules and retention planner.
- Lovelace cards.

### Phase 4 — Polish and automation

- HA automation shortcuts.
- Kiosk mode.
- Advanced diagnostics.
- Stream optimization for mobile/remote.
- Accessibility and keyboard shortcuts.
