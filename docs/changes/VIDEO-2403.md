# VIDEO-2403 - no transport-policy read without live video; kiosk and display wall count as automatic quality

Branch `pilot/VIDEO-2403` from `origin/main` @ `ccb77f28d` (v2.40.2). Target 2.40.3. Built and tested on fakes only (nothing contacted
the lab). No version file, CHANGELOG, tag or merge. No backend change, no migration.

## 1. Regression of v2.40.2: GET /media/video-policy in an installation without live video

**Symptom:** the nightly on main @ `ccb77f28d` failed `evidence-nn1-p2.spec.ts:208` ("no request reaches a gated route while the shell is
hidden from it (installation A)") on desktop, tablet and mobile: `requests to NVR routes: GET media/video-policy | GET media/video-policy`.

**Cause:** VIDEO-TRANSPORT-2400 reads the viewer's transport policy together with the product settings (`api/prefs.ts productSettings`
→ `api/video-transport.ts loadVideoPolicy`) so that `effectiveTransport()` stays synchronous for the screens. Every screen that reads
the settings therefore asked `/media/video-policy` - also in installation A (no NVR, no media server), where the shell is hidden from
every media route (NN1, `docs/architecture/CAPABILITIES.md` section 4).

**Fix (product, not the spec):** `loadVideoPolicy` - the one place that asks the route - returns at once (no request; the settings'
choice stands, as for an older server) unless the page is on the API (`isApi()`: not before `/me` answered) AND the installation has
the `live_video` capability: the same rule the player and every other media route of the shell follow. Nothing plays without live
video, so nothing is lost. The account menu's "וידאו" section is offered only with `live_video` too (it would read the policy).
The spec's route list was NOT changed: `/media/video-policy` belongs to the media server's area like every `media/...` route.

**Other 2.40.x reads checked for installation A:** the 2.40.x client added the reads `intercom/door-path-conversion`,
`access-control/triage`, `wall/profiles` (WisKey / display-wall settings screens, not NVR routes and not mounted on the gated screens) and
the settings keys `ui.wall_phone_bar` / `access.settings_layout` (part of `GET /settings`, not a route of their own). The nightly's
request log listed only the two policy reads; after the fix the same test passes on all three devices (receipts below).

## 2. Kiosk and display wall count as automatic quality (owner round 21, Q1 = a)

They have no quality choice, so their tiles now set `autoProfile` (`screens/kiosk-wall.ts`, `wall/sw-wall.ts` - the tile grid and the
alert tile). Everything of VIDEO-SUB-FALLBACK-2402 then applies unchanged: a sub stream that gives no media, never connects or is refused
moves to the main stream on the SAME transport, the tile says "עבר לזרם הראשי", the camera is remembered for the tab for 10 minutes,
the remote live cap is respected (one socket per tile, a cap refusal is never a reason), and the main socket's audit rows carry
`profile_fallback`. Like the all-cameras wall's automatic quality, `autoProfile` also lets a tile whose sub stream is proven undecodable
over WebRTC continue on the main stream (the 0.1.148 rule).

## Receipts

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| Unit (explicit files): unit-video-2403 (new), unit-video-sub-fallback-2402, unit-video-transport-2400, unit-user-menu-sections, unit-menu-lint, unit-video-policy-webrtc-first | 42 passed |
| `scripts/release_check.py` | ready (2.40.2 everywhere, migrations 0001-0205) |
| Runner (gate_status checked first: the last gate had finished, `pass`; one job): evidence-nn1-p2 (desktop, tablet, mobile), evidence-video-sub-fallback-2402 (2 new tests: kiosk, display wall), evidence-wall, evidence-mobile-wall-kiosk, evidence-wall-alerts, evidence-wall-pano, evidence-video-transport-2400, evidence-webrtc-only | 138 passed, 132 skipped (desktop-only specs on tablet / mobile, fixture-backend specs), 0 failed - including nn1-p2:208 on all three devices; `.tmp_*` removed |

NOT_RUN: the lab; pixel specs (no baseline shows a kiosk or display-wall tile after a fallback).

## Lab check for the owner

On the kiosk (`#/kiosk`) and on a display-wall tablet that show cameras 8 or 10: with "MSE בלבד" the tile shows a picture within about
20 seconds with the small tag "עבר לזרם הראשי". In an installation without the NVR / media server nothing changes on screen (no request
to `/media/video-policy` in the browser's network list).
