# SMPLWISE VMS add-on (pilot 0.1.0)

Map-centred video management for a Hikvision NVR, served inside Home Assistant through Ingress.
This build contains the catalogue (sites → buildings → floors), architectural plan import (PDF / PNG /
JPG with page selection, rotation and crop), camera placement with view cones, server-side roles and
scopes, and an audit log. Live video, playback and events arrive in the following builds.

## Installation

1. Settings → Apps → App store → ⋮ → **Repositories** → paste
   `https://github.com/jonioliel/smplwise-bms` → **Add**.
2. Install **SMPLWISE VMS**. The Supervisor builds the image locally (a few minutes on first install).
3. Open the add-on **Configuration** tab:
   - `bootstrap_admin_username` — the Home Assistant **username** (not display name) that becomes the
     VMS system administrator. The grant happens once, on that user's first visit, and is written to
     the audit log. Leave everything else empty for now if you only want to try the maps.
   - `nvr_host`, `nvr_http_port`, `nvr_rtsp_port`, `nvr_username`, `nvr_password` — read-only ISAPI
     access used by "Sync cameras" and snapshots; the RTSP port is what go2rtc pulls video from. Prefer
     a dedicated non-admin NVR account. The add-on never changes NVR settings.
   - `go2rtc_url` — the external go2rtc API, e.g. `http://<ha-host>:1984` (the AlexxIT add-on). The
     product creates only streams named `smplwise_*` there and never touches other streams. Optional
     `go2rtc_api_username` / `go2rtc_api_password` if the go2rtc API is protected.
4. Start the add-on and open it from the sidebar (**SMPLWISE VMS**). With NVR details set, the cameras
   appear by themselves within a minute (discovery at start-up and every 10 minutes); הגדרות → מצלמות
   → "סנכרון מה־NVR" refreshes immediately. If the list stays empty, check the add-on log and
   `/api/v1/health` (`discovery.cameras_last_error`).

## Identity and access

- Users are Home Assistant users. The Supervisor forwards the authenticated user with every Ingress
  request; the add-on trusts that identity only when the request comes from the Supervisor proxy.
- Nobody has access until a VMS administrator assigns a role in a scope (site, building, floor).
  Home Assistant admin status grants nothing inside the product, and the product never changes HA
  users, groups or admin flags.
- Every decision, upload, publish and placement is recorded in the audit log (no secrets).

## Data and backups

- Everything lives in `/data` (SQLite database + original plan files + derived images) and is
  included in Home Assistant backups (`backup: hot`).
- Original plan uploads are never modified; backgrounds are derived and can be regenerated.

## Live video

- Browser ↔ add-on WebSocket relay ↔ go2rtc. The browser never learns the go2rtc address or any
  RTSP URL; every stream request is authorized per camera (a viewer sees only cameras anchored on
  floors in their scope).
- Transport: **MSE** is the default (fMP4 over the relay socket: works through Ingress, Cloudflare
  tunnels and behind CGNAT). **WebRTC** gives the lowest latency but needs UDP between the browser
  and the go2rtc host (fine on the LAN, not through a tunnel or CGNAT); `auto` tries WebRTC and
  falls back to MSE. The product default is set in Settings → וידאו ומדיה; every player can
  override it for the current browser.
- What to expect with a Hikvision NVR (measured on the pilot lab, Chrome): the **sub** profile (H.264
  Baseline 640×360) plays over WebRTC within a few seconds; the **main** profile (H.264 Main
  2560×1440) connects over WebRTC but browsers do not decode it from RTP, so `auto` switches to MSE
  after ~12 s. MSE shows the first frame only at the next key frame — with the NVR's ~8 s GOP that is
  8–12 s. Failed streams retry with back-off (3 s → 30 s); a denied camera or a quota hit is shown as
  such and never as "live".
- First open the streams in go2rtc: Settings → וידאו ומדיה → **סנכרון זרמים** (system.configure).
  Only `smplwise_*` streams are created or updated; other streams on the same go2rtc are listed as
  "foreign" and never touched.
- Camera tiles show a fresh NVR snapshot (read-only ISAPI picture, cached in /data for
  `snapshots.max_age_s`) until the stream plays.
- Session cap (`media.max_live_sessions`, default 8) protects the NVR; the wall and the kiosk use sub
  streams, the single-camera view the main stream. Tiles beyond the cap show the snapshot only.

## Recordings and playback

- הקלטות (Playback) searches the NVR for one local day per camera (`GET /api/v1/cameras/{id}/recordings?date=`).
  The search is read-only, paged, serialized (the NVR allows one search at a time) and reports
  `coverage: complete | partial` — a truncated search is never shown as "no recordings".
- Times: the NVR speaks its local wall clock; the add-on converts with the IANA zone in Settings →
  וידאו ומדיה → אזור זמן (default `Asia/Jerusalem`, DST-aware). Every API time is UTC (`Z`).
- A playback session is one go2rtc stream (`smplwise_pb_<session>_g<generation>`) built from the NVR's
  RTSP playback URL. Clicking the timeline or ±10 s seeks: the old stream is deleted, a new generation is
  created, and a socket of the old generation is closed (code 4410) so no old frame can appear.
  Sessions are capped (`playback.max_sessions`) and expire after `playback.lease_s` without a socket;
  leftovers are removed on start-up. Precision is labelled `keyframe_limited`: the first frame is the
  key frame at or after the requested time (typically 2–4 s to first frame on the lab NVR).
- A gap is shown as a gap. Requesting a time without recording starts at the next segment (and says
  so) or reports "no recording" — it never switches to live.

## Events

- Two sources, both labelled: **measured** alerts from the NVR's alert stream (`/ISAPI/Event/notification/alertStream`,
  read-only, reconnecting, heartbeat used as a health signal, gaps recorded as `coverage_gap`), and
  **inferred** events derived from the recording search (every motion/alarm recording file is an event
  with confidence `inferred`). Inferred events are never shown as measured alerts.
- The NVR only sends an alert to the stream when the trigger's linkage includes **Notify Surveillance
  Center**. On the pilot NVR motion and intrusion triggers are linked to "record" and "white light" only,
  so the stream carries heartbeats but no motion alerts until that linkage is enabled in the NVR
  (Configuration → Event → … → Linkage Method → Notify Surveillance Center). The add-on never changes NVR
  settings.
- אירועים (Event centre): day/type/camera/unacked filters, live updates over a WebSocket, acknowledge
  (`events.ack`, audited), "נגן" jumps to the recording at the event time. Markers also appear on the
  playback timeline. Retention: `events.retention_days` (default 30).

## Export

- ייצוא (Export) from the playback screen: pick a range on the selected day, get an estimate (number of
  NVR files and bytes), confirm, and follow the job under ניגון → ייצוא. Jobs are durable rows; one
  download at a time; progress is byte-based; cancel and partial results are honest states.
- The lab NVR only supports download **by file** (KNOWN_QUIRKS S4), so the add-on downloads the whole
  recording files overlapping the range and then, with ffmpeg (in the image), remuxes the Hikvision PS
  container to MP4 (H.264 copied, G.711 audio to AAC), concatenates and trims to the requested range at
  key frames. The manifest records requested vs. actual range, source files, pipeline version and
  SHA-256. Without ffmpeg the original PS files are delivered as `.mpg` (VLC plays them) and marked so.
- Export needs the explicit `video.export` permission (operator, site_admin, system_admin). Files are
  deleted after `exports.retention_days`; jobs above `exports.max_mb` are refused up front.

## Multi-camera playback

- On the playback screen, "השוואה" adds up to three more cameras: one reference time and generation,
  a session per camera, the timeline follows the leading camera and each tile shows its drift. Without a
  verified PTS↔UTC anchor this is labelled best effort (chapter 25); a camera without a recording at that
  time is shown as such, never as a frozen frame.

## Limits in this build

- Uploads: PDF/PNG/JPG up to 40 MB, PDF up to 20 pages; SVG and DWG/DXF are rejected.
- PDF rasterization runs in a separate process (pdftoppm) with a 30 s limit.
- Playback: speed 1× only, no frame step; up to four cameras side by side (best effort sync); events are
  not drawn on the timeline yet. Export trims at key frames (the start may be a few seconds early). PTZ and two-way audio are not exposed until the
  capability is verified per camera.
- Live video needs a browser with H.264 support (Chrome, Edge, Safari, Firefox on desktop); Playwright's
  bundled Chromium has none, so the evidence suites run with `SW_CHROME=1`.

## Troubleshooting

- "Home Assistant לא העביר זהות משתמש": the Supervisor did not send the `X-Remote-User-*` headers.
  Update Supervisor/Core; the add-on refuses to guess an identity.
- "אין הרשאה": your HA user has no VMS role yet — ask the VMS administrator (bootstrap user).
- Logs: the add-on **Log** tab; set `log_level: debug` for request-level detail (never prints secrets).
