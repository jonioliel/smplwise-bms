# VIDEO-SUB-FALLBACK-2402 - automatic quality: a sub stream that gives nothing moves to main (same transport)

Branch `pilot/VIDEO-SUB-FALLBACK-2402` from `origin/release/2401-train` @ `604305354` (the 2.40.1 version commit, before its UI build).
Target 2.40.2. Owner round 20 (04.11 night): Q3 = a, Q4 = a. **Built and tested on fakes only** - nothing contacted the lab, the NVR,
go2rtc, Home Assistant or WisKey. No version file, CHANGELOG, tag or merge. No migration.

## A. Sub-stream fallback (Q3 = a)

**The gap (lab audit 2026-11-04, finding 6):** the NVR accepts the sub-stream request of cameras 8 and 10 and sends 0 frames (go2rtc:
`read i/o timeout`). The player switched profile only after a step was proven UNDECODABLE (bytes, no frame); a sub stream that never
connects or gives no media left the tile empty, retrying sub forever.

**Now** (`frontend/src/components/sw-live-player.ts`, `frontend/src/api/video-policy.ts`):

| Situation | Before | After |
|---|---|---|
| Automatic quality (the wall's "ברירת מחדל" quality, `autoProfile`), sub gives NO MEDIA (MSE: no fragment within 20 s; WebRTC: statistics read, not one byte within the first-frame bound) | error, retry sub | at once: main on the SAME transport; tag "עבר לזרם הראשי" |
| Automatic quality, sub refused by go2rtc (an error frame that is not the cap / a denial / the video server down) | LAN chain: other profile; remote plan: error | main on the same transport |
| Automatic quality, sub never CONNECTS (WebRTC ICE fails) | error, retry sub | under `auto`: first sub over MSE (the 2.40.0 policy order - a connect failure is usually the network), then main on the transport that failed last; under an explicit transport: main on that transport |
| Explicit quality (the viewer chose sub or main) | error with a technical trace ("לא התקבל וידאו (ms=…)") | never switches; the tile says "הזרם המשני לא מגיע מהמצלמה" / "הזרם הראשי לא מגיע מהמצלמה" (the trace goes to the console) |
| The remote live cap refuses (4429), a denial (4401 / 4403), go2rtc down (4503 / `upstream_unavailable`), an H.265 refusal | unchanged | unchanged - never a fallback reason |

- **Never another transport because of it.** The main step is always the failing sub step's twin on the same transport
  (`subFallbackStep`); the 2.40.0 policy stays absolute. The local chain of an automatic-quality tile already held the main steps; the
  REMOTE plan now holds the main twin of each planned transport too (`planSteps` / `plan_steps` `auto_profile` on the remote channel;
  e.g. MSE only: `sub:mse,main:mse`; auto with the MSE fallback: `sub:webrtc,sub:mse,main:webrtc,main:mse`). The 480-case fixture
  `contracts/fixtures/video_transport/policy_cases.json` follows (32 remote `wall_default` rows).
- **Remembered per camera for the tab:** sessionStorage `sw.live.sub_down`, `SUB_DOWN_TTL_MS` = **10 minutes**. Meanwhile the tile's ladder
  starts on main (`mainFirst`, each profile in the policy's transport order) - no sub attempt on every reconnect or retry. After 10 minutes
  the sub stream is tried once again. Why 10 minutes: the same rhythm as the tab's "WebRTC unreachable" memory; a sub stream the NVR is
  fixed for is back within one wall session, and a dead one costs one failed attempt (up to the 20 s bound) per camera per 10 minutes.
- **The remote live cap:** a fallback is the SAME tile's next socket, opened only after the failed one is closed (`teardown` first), so it
  never holds two of the sign-in's streams; a cap refusal is never a reason to fall back.
- **The wall quality ladder:** only the automatic quality falls back, and only from sub (the installation's / `remote.wall_profile`
  quality). The device's own choice ("משני" / "ראשי") is explicit and never switches.
- **The audit line:** the main socket names why - `fallback=sub_no_media | sub_connect | sub_error | sub_remembered` (a closed set; the
  route refuses anything else and only a main-profile socket carries it). Both `video.live.start` and `video.live.stop` rows then hold
  `profile_fallback: {from: "sub", to: "main", reason}` beside the 2.40.0 `transport`, `ttff_ms`, `upstream_error` fields; the sub
  session's own stop row carries go2rtc's `upstream_error` (e.g. `timeout`) when go2rtc sent one. A decode-based switch (the 0.1.148
  rule, unchanged) is named `sub_error`.
- **The tag:** "עבר לזרם הראשי" - small, quiet (second-level text on the video scrim), top-start (the badges sit top-end), shown on compact
  wall tiles too, gone while the tile shows an error.

Not changed (no quality choice there): the kiosk and the display wall open the sub profile as before; the camera page's quality is the
viewer's own (explicit). Open for the owner if they should count as "automatic" too.

## B. The ten specs with `'media.transport_default': 'mse'` (Q4 = a)

| Spec | Asserts pre-2.40.0 behaviour? | Reason |
|---|---|---|
| evidence-wall | no | local channel; display wall layout / theme; no live player or transport assertion |
| evidence-wall-phone | no | local; 11 snapshot-only cameras (`can_view_live: false`), no relay |
| evidence-mobile-wall-kiosk | no | local; snapshot-only cameras |
| evidence-camera-card | no | fixture backend; asserts the socket transport EQUALS the installation setting (webrtc -> webrtc, mse -> mse) - exactly the 2.40.0 rule |
| evidence-wall-alerts | no | local; alert tiles, no transport assertion |
| evidence-wall-hide | no | local; snapshot-only |
| evidence-announceb-295 | no | local; announcements, no player |
| evidence-bubble-foundation | no | local; look / skin, no player |
| evidence-nav-size | no | local; navigation size, no player |
| layout-dropdown-fit | no | local; dropdown geometry, snapshot-only cameras |

None asserts WebRTC first on the remote channel under `mse` (none uses the remote channel at all): no change needed. The one spec that
did (`evidence-wall-live-cap`) was fixed for 2.40.0 (VIDEO-TRANSPORT-2400.md 7.2).

One spec encoded the rule the owner reversed in THIS change: `evidence-wall-pano` "a connection failure (not a decode failure) never
switches the profile" (0.1.148). Updated: with the automatic quality a sub connection failure now moves to main over the same transport
(WebRTC only there) and the tile shows the tag. Its "a fixed quality is never switched" test is unchanged and passes.

## Receipts

| Check | Result |
|---|---|
| `tsc --noEmit` (frontend) | clean |
| Unit (explicit files): unit-video-sub-fallback-2402 (new), unit-video-transport-2400, unit-video-policy-lan / -webrtc-only / -webrtc-first, unit-h265-support, unit-camera-card, unit-uxfix-rtl, unit-wiskey-station-media | 86 passed |
| Backend: test_video_sub_fallback_2402 (new), test_video_transport_2400, test_live_h265, test_ha_camera_live, test_intercom_media, test_rbac_camera_scope | 303 passed |
| `scripts/release_check.py` | ready (2.40.1 everywhere, migrations 0001-0205) |
| Runner (gate_status checked: the 2.40.1 gate had finished, `pass`; one job): evidence-video-sub-fallback-2402 (new), evidence-wall-pano, evidence-wall-live-cap, evidence-webrtc-first, evidence-webrtc-only, evidence-video-transport-2400, evidence-remote-video and the ten specs of part B | 155 passed, 292 skipped (desktop-only player specs on tablet / mobile, fixture-backend specs), 0 failed; `.tmp_*` removed |

NOT_RUN: anything in the lab; a real NVR sub stream with no frames (the fakes simulate it: an MSE socket that never sends a fragment, a
peer connection that never connects); pixel baselines (no pixel spec covers a wall tile in this state; nothing in an existing baseline
changed: the tag appears only after a fallback).

## Lab check for the owner

On the all-cameras wall with the quality on "ברירת מחדל" (automatic) and the setting "MSE בלבד": cameras 8 and 10 should show a picture
within about 20 seconds with the small tag "עבר לזרם הראשי" (no WebRTC attempt). Reload the page: they open on main at once. Switch the
wall's quality to "משני": those two tiles say "הזרם המשני לא מגיע מהמצלמה" and nothing switches. In the audit (`video.live.start` /
`stop`) the main sessions carry `profile_fallback` with `sub_no_media`, and the failed sub sessions show go2rtc's `upstream_error`.
