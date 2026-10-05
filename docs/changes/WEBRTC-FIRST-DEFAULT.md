# WebRTC first, MSE only when WebRTC cannot be used (owner decision 2026-10-05)

Status: approved by the owner on 2026-10-05; implemented on `pilot/webrtc-first-default`. Supersedes the transport
decision of 2026-09-14 ("MSE by default", ADR-011 context, `routers/settings.py`), which stays recorded as history.

## Decision

1. The installation default of the live video transport (`media.transport_default`) is **automatic**: every live player
   tries **WebRTC first** and plays **MSE only when WebRTC cannot be used** - no ICE connection within a short bound
   (UDP to go2rtc blocked: the Home Assistant Ingress path, a Cloudflare tunnel, CGNAT), a stream the browser does not
   decode from RTP (H.265, MJPEG, H.264 with B-frames or SVC - the registry's verdict, or the player's own measurement),
   or go2rtc refusing the stream.
2. The fallback is **fast and quiet**: the WebRTC attempt gets `WEBRTC_CONNECT_MS` = 5 s to reach an ICE connection
   (any inbound byte, or the peer connection's `connected`); the poster stays, no error flashes, and the player goes on
   to MSE in the same "connecting" state. A WebRTC that could not connect is **remembered per browser tab for 10 minutes**
   (`sessionStorage` `sw.live.webrtc_down`): every automatic player opened meanwhile starts on MSE at once (no 5 s wait
   per wall tile, no flicker loop), and WebRTC is probed again when the memory expires, when the tab is reopened, or - at
   once - when any automatic player plays over WebRTC. A stream that connected but did not decode keeps the GOP-sized
   decode grace (the first decodable frame is the next key frame on MSE too) and the 0.1.148 **24 h per-camera memory**;
   a connect failure never pins a camera to MSE for a day (it is a fact about the network, not the camera).
3. The administrator still chooses the installation default per customer (הגדרות › וידאו ומדיה): **אוטומטי** (the new
   default), **WebRTC בלבד**, or **MSE בלבד** - named so that MSE only is a deliberate choice for a customer whose browsers
   can never reach go2rtc over UDP. A viewer's own per-browser override on the camera page is unchanged.

## Why 5 s

On the LAN, ICE between Chrome and go2rtc completes well under 2 s (host candidates; the STUN server-reflexive pair a
little later on a routed segment). Where UDP to go2rtc is blocked the browser reports `failed` only after its own ICE
timeout (~15-30 s), which is the wait this bound cuts short. 5 s leaves room for a slow STUN round trip and a busy
go2rtc without making a customer behind Ingress wait noticeably; the Playwright spec asserts the fallback within 4.5-7.5 s
of the offer. The bound was reasoned, not measured on the lab in this change (the lab run is NOT_RUN - see the test
section); it is one constant (`frontend/src/components/sw-live-player.ts`, `WEBRTC_CONNECT_MS`) if a measurement asks
for another value.

## Migration of existing installations

`media.transport_default` is stored in the `settings` table **only** by an administrator's `PATCH /api/v1/settings` (the
settings screen sends only the keys that changed; no seed, backup or install path writes the key). The server reads
`get_setting(key, default)`, so a stored row and the implicit default are told apart by the row's existence:

- no row (the installation never touched the transport) → the new default **`auto`** after the upgrade, no migration;
- a stored `mse` / `webrtc` / `auto` → kept as it is: it was a choice. A customer where an administrator chose MSE for
  Ingress / Cloudflare stays on MSE; with the new behaviour he may now switch to automatic (WebRTC would simply fall
  back there) - documented in the release notes, not forced.

No SQL migration; the add-on's last migration stays `0055_multi_recorder`. Backend test:
`tests/test_media.py::test_transport_default_migration_keeps_a_stored_choice`.

### The code paths that read the default (audited 2026-10-05)

| Reader | Before | Now |
|---|---|---|
| `smplwise_vms/backend/smplwise/routers/settings.py` `DEFAULTS` | `mse` | `auto` (the single server-side source; `read_settings` and `GET /media/live/{id}` `transport_default` follow it) |
| `frontend/src/api/prefs.ts` `DEFAULTS` + `effectiveTransport` (demo mode, a failed settings read) | `mse` | `TRANSPORT_DEFAULT` = `auto` |
| `frontend/src/screens/system-diagnostics.ts` (the dropdown's selected value) | `?? 'mse'` | `?? TRANSPORT_DEFAULT`, options reordered and renamed |
| `frontend/src/screens/live-camera.ts` (the override note and "same as the default" test) | `?? 'mse'` | `?? TRANSPORT_DEFAULT`, Hebrew label |
| every live surface (camera page, all-cameras wall, kiosk wall, floor-map tiles, device camera card and its enlarged view, HA cameras on their own relay path) | `effectiveTransport(settings)` | unchanged call, new default |
| the remote plan (`remote.mse_fallback`, CR-008 D7) | WebRTC first, MSE last resort when allowed | unchanged: the remote ladder was already WebRTC first; `webrtc` only still drops its MSE step; its 30 s first-frame cap stays (a mobile link) |
| recorded playback | MSE only (`wsUrl`) | unchanged (a playback session is an MSE relay) |
| Playwright mocks that answer `'media.transport_default': 'mse'` (guide-mocks, multi-nvr-mock, wall / bubble / nav specs) | an explicit stored value | left as they are: they model an installation whose administrator chose MSE, and keep those screenshot specs independent of a WebRTC attempt |

## Mobile shells (documentation only)

- Android (`mobile/android-shell`, Android System WebView = Chrome's engine): `RTCPeerConnection` and MSE are both
  available; the shell already grants the WebRTC permission hooks (README). Automatic behaves as in Chrome.
- iOS (the planned `WKWebView` shell): `RTCPeerConnection` is available since iOS 14.3 in WKWebView; **MSE is not
  available on iPhone before iOS 17.1** (ManagedMediaSource), so a WebRTC-first default is the one that plays there at
  all. The player already reports "MSE לא נתמך בדפדפן" where MSE is missing. Nothing changes in the shells.

## Risk for customers behind Home Assistant Ingress

Through Ingress (and a Cloudflare tunnel in front of it) only HTTP and WebSockets reach the add-on; **UDP never reaches
go2rtc**, so every WebRTC attempt there fails to connect. With the new default such a customer pays the 5 s bound **once
per tab** (the first automatic player), then every player of that tab starts on MSE, and WebRTC is probed again after
10 minutes (one more 5 s wait, on one player). Before this change the same customer played MSE at once. An installer who
knows the customer has no direct path keeps the old behaviour by choosing **MSE בלבד**; a stored MSE choice from before
the upgrade is kept automatically. The STUN server (`stun.l.google.com`) is still asked during the attempt; an installation
without internet simply gathers host candidates only, within the same bound.

## Tests

- Backend: `smplwise_vms/backend/tests/test_media.py` (the default is `auto`, validation, a stored choice survives a restart).
- Unit (Node, pure functions): `frontend/tests/unit-video-policy-webrtc-first.spec.ts`.
- Mocked backend + fake media stack (`frontend/tests/live-fake-media.ts`, shared with the 2026-10-01 WebRTC-only spec):
  `frontend/tests/evidence-webrtc-first.spec.ts` - no key in the settings read → WebRTC and no MSE socket; `auto` with a
  WebRTC that never connects → MSE within the bound, one attempt, no error state, tab memory set and the camera memory
  empty; the next automatic players start on MSE; after the TTL WebRTC is probed again; a non-decoding main → MSE after
  the grace with the per-camera memory only; WebRTC only never MSE; MSE only never WebRTC; the settings screen's labels
  and default.
- Real Chrome against the lab go2rtc: NOT_RUN in this change (see the closing report of the branch).
