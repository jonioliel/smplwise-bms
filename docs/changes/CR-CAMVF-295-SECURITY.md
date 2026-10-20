# CR-CAMVF-295 - Live in-page camera viewfinder (opt-in): security design and threat model

Status: implemented on `pilot/CAMVF-295` for the authenticated app only, **OFF by default**.
Inventory item: "Live in-page camera viewfinder" (CR-038 section 18 / D32: "needs `Permissions-Policy: camera=(self)` and a
permission prompt"). Owner 2026-10-19: camera = leave as is; the viewfinder is a future idea - then approved to build as an
OPT-IN feature, default OFF.

## 1. What changes, in one paragraph

A ticket's photo section (the request drawer, Overview, "תמונות") gains a second tile, "מצלמה חיה", next to the existing
"הוספת תמונה" tile - and only when the installation setting `tickets.settings` -> `ui.camera_viewfinder` is `true` AND the
browser exposes `navigator.mediaDevices.getUserMedia` in a secure context. Pressing it opens a dialog with a live
`<video>` preview from the rear camera; "צילום" grabs one frame onto a `<canvas>`, shows it for confirmation, and "שימוש
בתמונה" hands a JPEG `File` to the SAME upload function the file input already uses (`POST /tickets/{id}/attachments`,
unchanged, re-encoded by `image_intake` on the server). The existing file input (and the camera app it may open on a
phone) is not touched and remains the fallback in every failure path. No HTTP header changes anywhere.

## 2. Why no `Permissions-Policy` change is needed (and none was made)

The task card assumed the authenticated app is served with `camera=()`. The code says otherwise:

| Surface | Document header today | Who governs camera | Change in this CR |
|---|---|---|---|
| Ingress (HA sidebar panel, `/api/hassio_ingress/...`) | Arx sends **no** `Permissions-Policy` (asserted by `test_remote_access.py`: Ingress responses carry no CSP either) | The HA frontend page that frames the add-on. The Ingress iframe is same-origin with HA; the `camera` feature's default allowlist is `self`, so a same-origin frame inherits it unless HA itself sends a restrictive header or `allow` | none |
| Remote channel (`/arx/...`, CR-008 section 3e) | `camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()` on every response | Arx | none |
| Public vendor page (`/support/...`, `/t/...`, CR-038 section 10.4) | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` on every response | Arx (`public_http.SECURITY_HEADERS`) | none - stays `camera=()` |

`Permissions-Policy` is evaluated per **document**, not per API route. The authenticated app is a single-page app: one
`index.html` document hosts every screen, so "camera only on the ticket route" cannot be expressed in a header - a
`camera=(self)` on the document grants the whole SPA, and a `camera=()` anywhere in the SPA would deny the ticket screen
too. The scoping therefore lives in the application (section 4), and the header tests pin the current values so that a
later change cannot widen them silently (section 8).

Defense-in-depth option, NOT done (decision 1 in section 10): the remote channel's `camera=(self)` predates this CR (CR-008) and
is granted even while nothing in the product uses the camera. It could follow the setting (`camera=()` while
`ui.camera_viewfinder` is off). It was left unchanged because (a) CR-008 section 3e is an approved header set that ranks
above a task card, and (b) the same-origin WisKey panel (`frame-src 'self'`, `/hikvision-intercom`) inherits the remote
document's policy, and its camera use was not audited here.

## 3. Assets and actors

- Assets: the live camera image of the operator's surroundings (may show people, screens, documents, door codes); the
  captured photo; the operator's trust in the permission prompt.
- Actors: the signed-in operator (has `tickets.*` rights and `can.attach` on the ticket); the installation administrator
  (`system.configure`, owns the switch); a hostile script (XSS in the SPA, a malicious frame); a vendor on the public page;
  a passer-by with physical access to an unlocked device.

## 4. Threats and controls

| # | Threat | Control |
|---|---|---|
| T1 | Camera opened without the operator meaning to (on page load, on route change, by a timer) | `getUserMedia` is called ONLY from the click handler of the "מצלמה חיה" tile (`openViewfinder`), never in `connectedCallback`, `updated`, a timer or a route handler. The tile is absent when the setting is off. A Playwright test asserts `getUserMedia` is not called before the click and is never called with the setting off. |
| T2 | The stream outlives the dialog ("camera light stays on") | One owner of the stream (`<ticket-camera-viewfinder>`); every exit stops every track (`stopStream`): close button, Escape / dialog cancel, "שימוש בתמונה", an error, `disconnectedCallback` (drawer closed, ticket changed, route changed - the drawer element is removed), `pagehide`, `visibilitychange` -> hidden, `hashchange` / `popstate` (SPA navigation). After capture the preview shows the still frame and the live tracks are already stopped; "צילום מחדש" asks for a new stream (still from a click). Tested: every track's `readyState` is `ended` after each exit. |
| T3 | Upload without consent (frames streamed or sent before the operator presses capture and confirms) | No network request carries camera data until "שימוש בתמונה". The frame lives in a `<canvas>` and a `Blob` in memory; it is never put in `localStorage`, IndexedDB, the Cache API or a URL. A Playwright test counts upload requests before confirm (zero) and after (exactly one, to the existing attachments route). No `MediaRecorder`, no WebRTC peer, no `ImageCapture` upload path. |
| T4 | Captured image carries location / device metadata | A canvas `toBlob('image/jpeg')` writes no EXIF / GPS. The server re-encodes every photo anyway (`image_intake`: fresh JPEG, no EXIF/XMP/ICC). |
| T5 | XSS or a third-party script uses the granted permission | Not a new risk: the remote document already has `camera=(self)` and Ingress inherits HA's default; `script-src 'self'` on the remote channel; no third-party script in the bundle. The feature adds no code path that a page message, URL parameter or server field can trigger - only a trusted click event. With the setting off, the module still ships in the bundle but its entry point is not rendered and `openViewfinder` refuses (`enabled` checked again inside). |
| T6 | Cross-origin frames | The app never frames third-party content with `allow="camera"`. The remote channel keeps `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`, so a foreign site cannot frame Arx to borrow its permission. The public page keeps `frame-ancestors 'none'` + `DENY`. |
| T7 | Insecure context (Ingress over plain `http://<lan-ip>:8123`) | `getUserMedia` exists only in secure contexts. Availability is checked (`window.isSecureContext && navigator.mediaDevices?.getUserMedia`); when absent the tile is not shown and the file input works as before. No attempt to polyfill or downgrade. |
| T8 | Permission prompt fatigue / nagging | One prompt, from the browser, on the click. A refusal (`NotAllowedError` / `SecurityError`) closes the stream path and shows one short line pointing at the existing "הוספת תמונה" tile; no retry loop, no automatic re-ask. |
| T9 | Resource abuse (huge frames, memory) | Constraints ask for `ideal` 1920x1080 (no `exact`); the captured frame is scaled to at most 2048 px on the long side (the server's own limit) and JPEG quality 0.85 - well under the 8 MiB intake cap. One frame in memory at a time; the object URL of the preview is revoked on every exit. |
| T10 | Kill switch | `ui.camera_viewfinder` (boolean, default `false`) in the tickets settings document; `system.configure` to change it (the existing `PUT /tickets/settings` gate, revision-checked, same audit as every settings change). Off = the tile is not rendered on the next load of the module answer (`GET /tickets/module` carries `ui`); an already open viewfinder is not force-closed by a remote flip (it is closed on navigation as in T2). |
| T11 | A camera-capable surface is reached by a vendor | Out of scope: the public page bundle does not import the viewfinder module (a build test asserts no `getUserMedia` string in `www-public`), and its header stays `camera=()`. |

## 5. Browser behaviour (expected; device rows UNVERIFIED)

| Platform | Expected | Verified |
|---|---|---|
| Desktop Chrome / Edge | Prompt on first click; remembered per origin; `facingMode: environment` ignored on a laptop (front camera used) | Chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` (Playwright) only |
| Android Chrome (remote channel, HTTPS) | Prompt; rear camera via `facingMode: {ideal: 'environment'}` | NOT RUN on a device |
| iOS Safari (remote channel, HTTPS) | Prompt each session unless "Allow" is set for the site; `<video>` needs `playsinline` + `muted` (both set) or it goes full-screen / does not autoplay; tracks must be stopped or the green indicator stays | NOT RUN on a device |
| HA Companion app (Android WebView / iOS WKWebView) through Ingress | Depends on the Companion app granting WebView media permission; when refused, `NotAllowedError` -> the fallback line | NOT RUN |
| Ingress over `http://` LAN address | Not a secure context: no tile, file input only | by construction (T7) |
| In-app browsers (WhatsApp, Facebook) | Not relevant: the authenticated app is not opened from vendor links | - |

The WisKey talk microphone (`frontend/src/wiskey/talk-mic.ts`) already uses `getUserMedia` on both channels with the same
secure-context check; this CR follows that precedent.

## 6. Fallback (unchanged)

The `<input type="file" accept="image/jpeg,image/png" multiple>` tile in the photo section is byte-for-byte the same
template as before; its upload path is the same function. Every viewfinder failure (no API, insecure, `NotAllowedError`,
`NotFoundError` / `OverconstrainedError`, `NotReadableError` (camera busy), an unknown error) ends with the stream
stopped, the dialog closed and one line in the drawer's existing flash row. A file input cannot be opened
programmatically after an `await` (the user activation is gone), so the line points at the tile instead of clicking it.

## 7. Public vendor page - deferred (follow-up)

Bundle budget: the initial public page is 23.9 KB gzip of its 60 KB budget and the capture chunk is 2.2 KB of 25 KB
(measured on `origin/main` 586f191b3), so a ~3 KB lazy viewfinder chunk would fit. It is NOT built here because:
1. CR-038 sections 10.4 and 11A.6A (approved) fix the public header at `camera=()` and the capture at `<input capture>`;
   an approved CR ranks above a task card (CLAUDE.md precedence) - the change needs the owner's explicit approval.
2. The public page is internet-facing and unauthenticated; widening to `camera=(self)` there should be scoped to the
   document routes (`/t/`, `/t/r/{rid}`, `/support/...`) only, with the JSON routes kept at `camera=()`, and reviewed
   with the in-app-browser matrix (WhatsApp / Facebook WebViews often refuse `getUserMedia`).
Decision 2 in section 10: not now.

## 8. Tests that hold the line

- `smplwise_vms/backend/tests/test_camera_viewfinder_policy.py`
  - every public route (each rule of `public_http.ROUTES`, through the real `PublicEdge`) answers `camera=()`, and a route
    that tries to send its own `Permissions-Policy` is overridden;
  - the remote channel's header is exactly the CR-008 value with the setting off AND on (the setting never widens it);
  - Ingress responses carry no `Permissions-Policy` from Arx with the setting off and on;
  - the setting: default `false`, boolean only, `PUT /tickets/settings` round-trip, `system.configure` required, visible
    in `GET /tickets/module`.
- `frontend/tests/unit-camera-viewfinder.spec.ts`: availability rules, error classification, frame scaling, track stopping.
- `frontend/tests/evidence-camera-viewfinder.spec.ts` (Chromium with fake media device): no tile and no `getUserMedia`
  with the setting off; with it on - no call before the click, preview, capture, zero uploads before confirm, one after,
  every track ended on confirm / close / Escape / navigation; denied permission -> fallback line, the file input
  unchanged; settings row toggles the key. Screenshots: `docs/design/evidence/camera-viewfinder/`.

## 9. Rollback

Set `ui.camera_viewfinder` to off (Settings -> service requests -> display), or revert the branch. No migration (the
settings document takes the new key with its default); no header changed, so nothing to restore at the edge.

## 10. Decisions and open items

Decided by the lead on the owner's delegation (2026-10-20):
1. The remote channel's `camera=(self)` stays as CR-008 set it (it does not follow the setting).
2. No viewfinder on the public vendor page now (CR-038 unchanged; section 7 stays the follow-up record).
3. Other capture places (the new-request sheet, the conversation composer, RFQ files) - a later slice.

Open: real-device evidence - Android Chrome and iOS Safari over the remote channel; the HA Companion app through Ingress.
