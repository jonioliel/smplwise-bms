# Camera card - Home Assistant camera sources (decision needed)

Status: implemented for NVR channels; a standalone Home Assistant camera shows a still picture only. This note records
what was considered for a real stream and why it was not built inside the time-box. Owner decision requested at the end.

## What ships

| Source | Result |
| --- | --- |
| NVR channel (`{kind: nvr, recorder_id, channel}`) | Live through the existing relay (`WS /media/live/{camera_id}/ws`, go2rtc `smplwise_<recorder>_ch<n>_<profile>`), WebRTC or MSE by הגדרות, sub profile by the wall profile, main when enlarged. |
| HA camera that is an NVR channel (`{kind: ha, entity_id}`) | Mapped to the catalogue camera and streamed exactly as the NVR source (`services/camera_cards.link_ha_cameras`). |
| HA camera that is not an NVR channel | "תמונה בלבד": `GET /devices/camera-card/still` through HA's `camera_proxy`, cached `max(10 s, snapshots.max_age_s)`, stale copy on failure, needs `devices.read` on the entity plus `video.live` installation-wide. |

### The entity -> NVR channel rule (conservative)
All must hold: platform `hikvision`; entity id ends `_<channel>01` (main) / `_<channel>02` (sub); the object id starts with
the recorder model as the integration slugs it (`DS-7616NXI-K2/D` -> `ds_7616nxi_k2_d_`); every entity passing that for the
recorder is on ONE registry device (two recorders of one model are not told apart, so none is linked); exactly one recorder
has that model; the catalogue has that channel, enabled. The recorder serial is not stored by discovery, so it is not part of
the rule. Limit: an entity the owner renamed (its id no longer starts with the model) is not linked and shows as a picture.
Option if that matters: store the deviceInfo serial at discovery and compare it with the HA device's `serial_number`.

## Options considered for a standalone camera stream (not built)

1. **HA `camera_proxy_stream` (MJPEG) -> ffmpeg -> go2rtc.** go2rtc source `ffmpeg:http://<ha>/api/camera_proxy_stream/<entity>?token=...`.
   The URL needs the entity's short-lived `access_token` (rotates roughly every 5 minutes) or a long-lived token; either lands in
   go2rtc's config / process list / logs (go2rtc up to 1.9.11 logs whole sources). A stream that must be re-written every few
   minutes is also a config-persistence hazard on a go2rtc shared with another project. **Rejected: secret handling.**
2. **HA `stream` component (HLS) via the `camera/stream` WebSocket command.** Returns a signed, expiring URL; go2rtc would
   need `hls:` sources rewritten on every expiry, and HLS latency is 5-10 s, which defeats a "live" card. Same rewrite hazard.
3. **The entity's `stream_source` (RTSP).** Best technically (a stable `rtsp://` go2rtc can pull), but HA does not expose it
   through the state, and the mirror's attribute allow-list (`ha_sync.ATTR_ALLOW`) drops everything it does not know.
   Reading it needs the WebSocket `camera/stream_source`-style call or the integration's own config (credentials again).
4. **Ask HA for a snapshot repeatedly (built).** No go2rtc write, no secret persisted, token stays in memory of one request.

## Risks of what ships
- The still is a single frame every >= 10 s; it says so ("תמונה בלבד"). It is not a substitute for live video.
- `video.live` has no camera scope for a non-NVR camera, so the still requires installation-wide `video.live`; a user with only
  floor/camera-scoped grants sees no such camera in the picker.
- Copy-to-all-areas copies camera cards too (a layout is a layout); a card whose camera the viewer may not watch shows a
  "no permission" state, naming nothing.

## Decision requested
Approve one of: (a) keep pictures only; (b) add option 3 with a bridge/`smplwise_bridge` read of `stream_source` (needs an
allow-listed read-only bridge command and an owner-approved go2rtc write in the `smplwise_ha_<entity>` namespace); (c) store
the recorder serial and compare it with the HA device to link renamed NVR entities.
