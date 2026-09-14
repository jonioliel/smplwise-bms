# HikHA NVR V2 — ISAPI Feature Mapping

This document maps the redesigned UX to Hikvision ISAPI capabilities.

## Live wall and streams

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| Discover channels | Load NVR/channel list | `GET /ISAPI/ContentMgmt/InputProxy/channels`, `GET /ISAPI/Streaming/channels` |
| Channel status | Online/signal/record state | `GET /ISAPI/ContentMgmt/InputProxy/channels/status`, `GET /ISAPI/System/workingstatus?format=json` |
| Live video | Generate stream source | `rtsp://<host>:554/ISAPI/Streaming/channels/<ID>` |
| Stream quality | Main/Sub/Auto selection | `GET /ISAPI/Streaming/channels/<ID>`, `GET /ISAPI/Streaming/channels/<ID>/dynamicCap` |
| Snapshot | Save image through backend | `GET /ISAPI/Streaming/channels/<ID>/picture` |

## Layouts, order and aliases

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| Camera order | Store locally | HA storage/config entry options |
| Display alias | Store locally | HA storage/config entry options |
| HA entity ID | Create/update entity | HA entity registry |
| Import names | Read channel/NVR names | `GET /ISAPI/ContentMgmt/InputProxy/channels`, `GET /ISAPI/System/Video/inputs/channels?format=json` |
| Sync OSD name | Explicit NVR update | `PUT /ISAPI/System/Video/inputs/channels/<ID>/overlays/channelNameOverlay` |

## Manual recording and schedules

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| Start manual recording | Command track | `POST /ISAPI/ContentMgmt/record/control/manual/start/tracks/<ID>` |
| Stop manual recording | Command track | `POST /ISAPI/ContentMgmt/record/control/manual/stop/tracks/<ID>` |
| Read recording rules | Fetch tracks | `GET /ISAPI/ContentMgmt/record/tracks` |
| Edit recording schedule | Update track | `PUT /ISAPI/ContentMgmt/record/tracks/<ID>` |
| Daily recording heatmap | Query distribution | `POST /ISAPI/ContentMgmt/record/tracks/<ID>/dailyDistribution` |

## Playback and clip export

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| Search recordings | Query device resources | `POST /ISAPI/ContentMgmt/search` |
| Smart search | Query VCA-supported recordings | `POST /ISAPI/ContentMgmt/SmartSearch` |
| Playback | Generate playback RTSP | `rtsp://<host>:554/ISAPI/Streaming/tracks/<ID>?starttime=<UTC>&endtime=<UTC>` |
| Download clip | Download by playback URI/time | `GET /ISAPI/ContentMgmt/download` |
| Download capability | Check support | `GET /ISAPI/ContentMgmt/download/capabilities` |

## Events and review

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| Live event stream | Parse alert stream | `GET /ISAPI/Event/notification/alertStream` |
| Event subscription | Subscribe where supported | `POST /ISAPI/Event/notification/subscribeEvent` |
| Event capabilities | Decide filters/labels | `GET /ISAPI/Event/capabilities` |
| HA automation shortcut | Emit HA events/services | `hass.bus.async_fire`, HA automation UI/deep links |

## PTZ, e-PTZ and two-way audio

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| PTZ availability | Capability check | `GET /ISAPI/PTZCtrl/channels/<ID>/capabilities` |
| Move/stop PTZ | PTZ control | `PUT /ISAPI/PTZCtrl/channels/<ID>` |
| PTZ status | Read status | `GET /ISAPI/PTZCtrl/channels/<ID>/status` |
| Zoom/focus | Set zoom/focus | `GET/PUT /ISAPI/PTZCtrl/channels/<ID>/zoomFocus` |
| Save/read PTZ position | Preset/position support | `GET/PUT /ISAPI/PTZCtrl/channels/<ID>/save?format=json` |
| E-PTZ | Digital PTZ | `GET/PUT /ISAPI/Image/channels/<ID>/EPTZ` |
| Aux controls | light/wiper/etc. | `GET/PUT /ISAPI/PTZCtrl/channels/<ID>/auxcontrols/<ID>` |
| Two-way audio | Talk session | `PUT /ISAPI/System/TwoWayAudio/channels/<ID>/open`, `GET/PUT /audioData`, `PUT /close` |

## Health and diagnostics

| UX feature | Backend action | ISAPI / HA interface |
|---|---|---|
| Device health | Status/capabilities | `GET /ISAPI/System/status`, `GET /ISAPI/System/capabilities` |
| Working status | Channel/HDD/record status | `GET /ISAPI/System/workingstatus?format=json` |
| HDD details | Disk capacity/status | `GET /ISAPI/ContentMgmt/Storage/hdd` |
| Disk capability | Format/SMART/quota support | `GET /ISAPI/ContentMgmt/Storage/hdd/capabilities` |
| User permissions | Validate account abilities | `GET /ISAPI/Security/UserPermission` |

## Important implementation notes

- Always probe capabilities before showing controls.
- Treat local aliases and layout state as HA app state, not Hikvision device state.
- OSD sync is explicit because it changes the device configuration.
- Clip export should be task-based and asynchronous.
- Download/playback may require double verification on some NVR configurations.
- Stream encryption and Digest auth must be handled server-side.
