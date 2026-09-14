# HikHA NVR V2 — Design System & UX Direction

## Design principles

1. **NVR first, dashboard second** — the app must support daily security work: camera wall, quick actions, playback, event review, health and retention.
2. **Compact but readable** — less bulky cards, smaller controls, more information per screen, clear hierarchy.
3. **RTL native** — Hebrew labels, right-aligned headings, logical RTL navigation, no “translated LTR” feel.
4. **Mobile is not a copy of desktop** — mobile has bottom sheets, fewer tiles, saved views and one-handed actions.
5. **Safe controls** — destructive or noisy actions like siren, light alarm, stop recording and disk formatting require confirmation.
6. **Capability-aware UI** — PTZ, e-PTZ, two-way audio, white light, smart search and OSD sync appear only when supported by the device.

## Visual style

- Theme: professional midnight NVR, inspired by Home Assistant but denser.
- Background: deep navy with subtle grid/noise, not pure black.
- Panels: `#111A2E` / `#0F1729`, 1px border, soft radius.
- Accent: cyan/turquoise for primary actions and active state.
- Danger: red/pink for active recording and critical alarms.
- Warning: amber for VCA alerts, disk warnings and unresolved events.
- Success: green for online, healthy and recording states.

## Core screens

### Live Wall

Purpose: watch cameras and act immediately.

Required controls:

- Saved views: Outside, Inside, Night, Alerts, All.
- Layout selector: 1, 2, 4, 6, 9, 12, 16, Custom.
- Stream selector: Auto, Main, Sub.
- Smart grid toggle.
- Drag order side panel.
- Bulk selected actions.
- Per-tile actions: snapshot, manual record, open, PTZ.

### Layout Manager

Purpose: configure camera walls once and reuse them.

Required controls:

- Saved view list.
- Drag-and-drop grid.
- Camera source pool with search.
- Mobile override: count, columns, order, stream.
- Pin primary camera.
- Save as user-specific or global layout.

### Camera Names & Mapping

Purpose: solve the user’s requested camera rename/ordering problem.

Required controls:

- Hikvision channel ID.
- Current NVR name.
- Local display alias.
- Area.
- HA entity ID.
- OSD sync toggle.
- Visibility toggle.
- Sort order.
- PTZ/audio/VCA capability badges.

### Live Camera Actions

Purpose: every camera has an operator panel.

Required controls:

- Start/stop manual recording with timer.
- Snapshot.
- Create clip from last 15/30/60 seconds.
- Bookmark event.
- Open Playback at current time.
- PTZ joystick and presets if supported.
- Two-way audio if supported.
- Aux controls such as light/siren/wiper if supported.

### Playback

Purpose: find and export footage quickly.

Required controls:

- Multi-camera synchronized playback.
- Timeline heatmap.
- Event markers.
- Date/time filter.
- Event type filter.
- Export clip.
- Download progress.

### Review Center

Purpose: reduce noise by turning raw events into reviewable items.

Required controls:

- Unhandled/handled filters.
- Severity filters.
- Camera/area filters.
- Preview grid.
- Open clip.
- Save snapshot.
- Create HA automation.
- Mark handled.

### Recording Rules

Purpose: make NVR storage understandable.

Required controls:

- Per-camera recording mode: continuous, event, manual only, off.
- Retention days.
- Pre/post event buffer.
- Stream used for recording.
- Weekly schedule.
- Storage forecast and optimization suggestions.

### Health & Diagnostics

Purpose: know what is broken and what to try next.

Required controls:

- Channel online/offline.
- Signal loss.
- Recording status.
- Bitrate.
- Connected clients.
- HDD/storage state.
- Auth/permission status.
- API latency.
- Suggested repair actions.

## Interaction details

- Drag handle is always visible in editing contexts.
- Any renamed field should save on explicit save, not blur.
- Long-running operations show progress and can be canceled where possible.
- Active manual recording is shown in three places: tile badge, camera action button, recording rules screen.
- Tile click opens camera. Long press / context menu opens quick actions.
- Keyboard shortcuts on desktop:
  - `1/4/6/9` switch layout.
  - `F` fullscreen selected tile.
  - `R` start/stop manual recording on selected tile.
  - `S` snapshot selected tile.
  - `P` open playback at current time.

## Responsive rules

- Desktop: sidebar panel, 2–3 column layouts, persistent editors.
- Tablet: hide HA-like sidebar, keep side drawer collapsible.
- Mobile: bottom navigation, bottom sheets, 1–2 column camera grids, no dense tables.
- Per-device stream preference is allowed, but backend config remains source of truth.
