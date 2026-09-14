# ADR-011 — Browser media path: add-on-relayed go2rtc signalling with per-camera authorization
Status: approved (owner, 2026-09-14, option 1ב)
Owner / date / linked tasks / requirements: Claude Code (tech lead) / 2026-09-14 / T015, T016, T017, T081 / R029–R032, R043, R157, R162

Context and evidence:
- Legacy v1.5.27 embeds go2rtc's own Ingress `stream.html` in an `<iframe>` (option `go2rtc_ingress_path`,
  pasted by hand and invalidated on every go2rtc rebuild) and also ships a WebSocket relay
  `/api/go2rtc/api/ws` (main.py 2947–3005) that the final frontend does not use.
- go2rtc 1.9.14 on the lab host serves `/api/ws?src=<name>` for WebRTC signalling, MSE and MJPEG over one
  WebSocket; its HTTP API is unauthenticated on the LAN and shared with the intercom project's streams.
- HA Ingress proxies HTTP and WebSocket but not UDP; remote access is via Cloudflare (owner), so WebRTC
  media will fail remotely and MSE must be the fallback (MASTER_SPEC chapter 21).

Constraints and source versions: go2rtc 1.9.14 (`video-rtc.js` MIT), HA Core 2026.9.2, Supervisor Ingress.

Alternatives considered:
1. Keep the legacy iframe to go2rtc's Ingress — proven, but exposes all of go2rtc to every user, no
   per-camera authorization, fragile token path, foreign UI inside ours. Rejected.
2. HA camera entities and Core's stream proxy — MJPEG/HLS through Core, no VMS authorization, not a VMS
   grade path. Rejected.
3. **Chosen:** the add-on terminates the browser WebSocket under its own Ingress path, checks the
   principal's `video.live` (or `video.playback`) on the specific camera and session, then relays to
   go2rtc `/api/ws?src=<namespaced stream>`. The browser uses go2rtc's `video-rtc` component (vendored,
   licence kept) inside our Lit UI with mode `webrtc,mse` (WebRTC on LAN, MSE through Cloudflare).

Decision and rationale: option 3 reuses the legacy relay logic, keeps credentials and go2rtc entirely
server-side, and gives the authorization hook the security spec requires for every media asset.

Effects on API, data, UX, permissions and operations:
- API: `GET /api/v1/media/live/{camera_id}/ws` (WebSocket), `POST /api/v1/playback-sessions` returns a
  session-scoped `media_handle`; both validated against `permission_revision` on open and on revocation
  (sessions closed within the 30 s target).
- Data: stream names `smplwise_cam_<camera_id>_<main|sub>` and playback slots `smplwise_pb_<n>` are the
  only go2rtc objects the product owns; a startup janitor reconciles them. Foreign streams are never listed,
  modified or deleted.
- UX: one `CameraTile`/`LivePlayer` component for grid, single view and map preview; snapshot polling
  fallback with backoff carried over from the legacy grid.
- Operations: add-on options for go2rtc URL and optional API basic-auth; health check reports go2rtc
  version and reachability. Recommend enabling go2rtc API auth on the lab host (owner action).

Validation evidence / rollback: T015/T017 tests — WS relay through Ingress for a non-admin HA user,
authorization denial for a camera outside scope, MSE fallback with UDP blocked, session teardown on
revocation. Rollback: none needed for the legacy add-on, which keeps its own path.

Approver / supersedes: owner 2026-09-14 / refines ADR-005.
