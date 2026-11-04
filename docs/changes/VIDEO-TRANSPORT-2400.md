# VIDEO-TRANSPORT-2400 - one decision of the live-video transport, executed by every player

Branch `pilot/VIDEO-TRANSPORT-2400` from `origin/release/2400-train` @ `0ee9302e6`. Target 2.40.0. Source: the read-only lab audit of
2026-11-04 (`private/planning/LAB_AUDIT_VIDEO_2026-11-04_HE.md`, evidence `private-evidence/lab-audit-20261104/video/`) and the owner's
decisions of the same day. **Built and tested on fakes only**: nothing here contacted the lab, Home Assistant, WisKey, go2rtc, the NVR or a
station. No version file, CHANGELOG, tag or merge. **No migration**: the personal choice is a new key of the existing per-user
preferences table (`user_prefs`, migration 0037) - 0206 was not needed and not taken.

## 1. Owner decisions (04.11) and what each became

| # | Decision | Implementation |
|---|---|---|
| 1 | The transport is exactly what the setting says - "MSE בלבד" = MSE only, "WebRTC בלבד" = WebRTC only - in every channel and on every surface; nothing hard-coded overrides it; only "אוטומטי" tries more than one, in a documented order. | `services/video_transport.py` (the one decision) + `frontend/src/api/video-policy.ts` `planSteps` (its mirror) + the player keeps only the chosen transport's steps of any plan (`sw-live-player.ts` `steps()`). The remote plan no longer puts WebRTC first for an MSE choice; the stations drawer's hard-coded "main = MSE, sub = WebRTC first" (`playerModeFor`) is removed. |
| 2 | The personal choice moves from the browser to the server, per user, shown and editable in "החשבון שלי"; personal > installation; the old `localStorage` key read once to seed, then never used. | `/me/prefs` key `video.transport` (auto / webrtc / mse, null = follow the installation). `GET /api/v1/media/video-policy` serves the effective choice. "החשבון שלי › וידאו" (`shell/sw-video-prefs.ts`); the camera page's transport buttons write the same key. `api/video-transport.ts` `seedFromLegacy`: `sw.transport` seeds an EMPTY server choice once, and is removed in every case. |
| 3 | No reduced (sub) stream for stations; station video works with BOTH MSE and WebRTC, following the settings, on Arx's own source and on WisKey's W10 source. | Both providers already describe their profile as `["mse", "webrtc"]` (Arx's own `LocalProvider`; W10 v1.1's private source mapped to both). The drawer now plays the viewer's choice on either profile; the station read carries the server's plan per profile (`video.transport.plans`). A choice a station does not offer is said on the still ("העמדה אינה משדרת בהגדרת הווידאו שלך"), never replaced. |

Also done (the audit's proposed design): one server-side decision that the players only execute; a retry starts from what worked last;
a frozen-MSE watch with recovery (and, for "automatic" only, a fallback); the WisKey leased stream stays registered for a short grace after
close; go2rtc's error frames are logged and audited (sanitized); the cause of the 12:12 cycles traced in the code (section 6).

## 2. The single policy table

Inputs: the installation's `media.transport_default` (הגדרות › וידאו ומדיה), the viewer's `video.transport` (/me/prefs), the channel (from
the request path: `/arx/...` = remote, everything else = local), `remote.mse_fallback` (remote `auto` only), the registry's WebRTC verdict
per profile (`encoding.<profile>.webrtc`, remote only, as before) and, for a station, the transports its descriptor offers.

**Effective choice** = personal (if set) > installation (if set) > `auto`. Source reported as `personal` / `installation` / `default`.

| Effective choice | Channel | Steps for profile P (O = the other profile) | Never |
|---|---|---|---|
| `mse` | local | P:mse (+ O:mse when the profile is not the viewer's own, the wall's default quality) | WebRTC |
| `mse` | remote | P:mse - whatever `remote.mse_fallback` says | WebRTC |
| `webrtc` | local | P:webrtc (+ O:webrtc, wall default quality) | MSE |
| `webrtc` | remote | P:webrtc, O:webrtc (a profile the registry knows undecodable over WebRTC is skipped) | MSE |
| `auto` | local | P:webrtc, P:mse (+ wall default quality: O on main MSE first / sub WebRTC first) | - |
| `auto` | remote, `remote.mse_fallback` on | P:webrtc, P:mse (MSE through the tunnel = the announced last resort) | - |
| `auto` | remote, `remote.mse_fallback` off | P:webrtc, O:webrtc | MSE |
| any | station (either channel) | the rows above restricted to P (the quality is the viewer's choice) and to the transports the station offers; nothing left = "not offered" | the other transport, the other profile |

`auto`'s memories (the tab's "WebRTC unreachable" for 10 minutes, the per-camera "step that worked" for 24 h, the H.265 MSE-first order) act
on `auto` only, as before. The full table - every installation choice (auto / webrtc / mse / unset) x personal choice (none / auto / webrtc
/ mse) x channel x `remote.mse_fallback` x profile x surface (viewer, wall default, station, station offering MSE only, undecodable main) =
480 cases - is `contracts/fixtures/video_transport/policy_cases.json`; the backend test asserts the module computes exactly it and that no
explicit row holds the other transport; the frontend unit spec asserts its mirror computes the same 480 rows.

The frontend mirror is used only when the server has no policy route (an older server, the demo mode): then it derives the policy from the
installation's setting alone (`localPolicy`) - never a choice of its own.

## 3. Before / after, per channel and surface

| Surface | Before (2.38.2 / train) | After |
|---|---|---|
| Camera page, local | the per-browser override, else the installation; MSE honoured | the server policy; the buttons save the personal choice on the server ("ברירת המחדל של המערכת: …" shown while a personal choice is set) |
| Camera page, remote (`/arx/`, phone) | WebRTC first even for "MSE בלבד" (`remoteVideoFor` handled `webrtc` only, `videoLadder` always WebRTC first); no transport buttons; every retry restarted on WebRTC | MSE only = `main:mse`; the buttons are shown on the remote channel too; a retry starts from the step that played last |
| All-cameras wall / display wall / kiosk tiles, local | installation (+ override) | the server policy (personal > installation) |
| Same, remote | WebRTC first for MSE | the remote plan of the choice (`playerPlan` → `planSteps`) |
| Device camera card and its enlarged view (NVR camera, Home Assistant camera) | installation (+ override); remote WebRTC first for MSE | the server policy, the remote plan of the choice |
| Floor-map camera tiles | installation (+ override) | the server policy |
| Stations drawer (Arx's own source and WisKey W10) | hard-coded per profile: main = MSE, sub = WebRTC first; ignored the setting and the override | the viewer's choice on both profiles; the server's per-profile plan (`video.transport.plans`); "not offered" said on the still |
| Recorded playback | MSE (a playback session is MSE by design) | unchanged |

## 4. The player (execution only)

`sw-live-player.ts`:
- `steps()`: an explicit `mse` or `webrtc` keeps only that transport's steps of any plan a screen hands over (before: `webrtc` only).
- **Retry from what worked last**: `lastGood` (set when a step plays, cleared by a deliberate `reconnect()`); the automatic retry starts at
  `retryIndex(steps, lastGood)` (remote plan) or puts it first in the local chain (before: "a plan starts over: WebRTC first again").
- **Frozen MSE** (`freezeStep`, polled every 2 s while a live MSE stream plays): neither the playhead nor, while paused (autoplay refused),
  the buffer moves for 8 s → "הווידאו נעצר · מתחבר מחדש" and a reconnect on the same step (any choice). Only `auto` moves on to WebRTC after
  2 freezes in a row (`freezeFallback`; a chain-less `auto` source - a station, a Home Assistant camera - starts the retry on WebRTC). A hidden
  tab is never judged. Recorded playback is not watched (it may pause on purpose).
- A stream error frame's value goes into `player-status`'s `code` and `console.warn('sw-live-player: stream error', …)`.

## 5. Server side

- `GET /api/v1/media/video-policy` (any signed-in caller; reads only the caller's own preference and product settings): `choice`, `source`,
  `explicit`, `installation`, `personal`, `channel`, `order`, `label`, `remote`. `GET /media/live/{id}` also returns `video_plan` (the
  policy and the steps for that profile with the registry's verdicts) for diagnostics.
- `GET /access-control/stations/{id}/media` → `video.transport` = `{choice, source, channel, order, plans: {main: "main:mse", …}}` (only
  for a caller who may watch).
- **go2rtc errors explained** (`services/live_diag.py`): the `video.live.stop` audit row now carries `transport` (what go2rtc answered:
  `webrtc/answer` or the MSE codec line), `ttff_ms` (first media byte over the socket), `answer_ms`, and go2rtc's first error frame as
  `upstream_error` (auth / timeout / refused / codecs / not_found / busy / eof / other) + `upstream_error_text` (addresses, URLs,
  credentials, MAC addresses and serial-like ids replaced; at most 120 characters). The same goes to the add-on log as a warning; the
  "session ended" line names the transport and the first-media time. The browser still never sees go2rtc's text for a station or a Home
  Assistant camera (the existing sanitizers run after the observer).
- **WisKey lease re-open grace** (`services/intercom_media.py`): when a station's last viewer leaves, its leased stream is no longer
  deleted at once; it stays registered, idle, for `REOPEN_GRACE_S` = 45 s (inside the existing `LEASE_GRACE_S` = 60 s post-lease window this
  registry already allowed a viewer-less stream). A re-open within the grace still asks WisKey for a FRESH signed lease (WisKey authorizes
  every open), and the same owner / station / profile / source renews the existing registration - no new go2rtc registration, no frame grab.
  After the grace the timer removes it as before; a lease WisKey refuses removes the station's idle streams at once (`retire_idle_streams`);
  the application shutdown and the owner's close remove everything as before. The thumbnail route uses the same grace (the live view that
  usually follows it reuses the registration). Names stay in `smplwise_wiskey_…`; `Go2rtc.discard_leased_stream` still refuses any other
  name (tested) - streams outside `smplwise_*` are never touched.

## 6. The 12:12-12:13 cycles (8 sub-second sessions of one station)

Read from the audit rows (`04_live_sessions_audit.tsv`) against the add-on log (`06_…`) and the code:

| Session start (UTC) | Gap | Log before it | Reading |
|---|---|---|---|
| 10:12:21 | - | `GET media`, `GET listen`, live socket | the drawer opened (a new `wk-station-live`: its listen button reads once) |
| 10:12:25 | +4 s | talk POST, talk socket, live socket - no `GET listen` | the SAME player's automatic retry: 3 s back-off + ~1 s lease / registration |
| 10:12:33 | +8 s | `GET listen`, live socket | retry 2: 6 s + ~2 s (the listen read can also come from the listen button when the feed's `live` flag toggles) |
| 10:12:37 | +4 s | `GET listen`, live socket | NOT the back-off (that would be +12 s): a re-created live view or a re-open of the drawer (not provable from the log) |
| 10:13:18 | +41 s | 3 x `GET media`, `GET listen`, live socket | the drawer opened again |
| 10:13:22 / :30 / :44 | +4 / +8 / +14 s | live sockets, no `GET listen` | retries 1-3 of that player (3 / 6 / 12 s back-off + setup) |

So most of the cycles are **the player's own back-off (3 s, 6 s, 12 s) after a failure that came at once**, plus a fresh start at 10:12:37
and the re-open at 10:13:18 - not a re-render loop on every talk start (the sockets right after a talk start come without a `GET listen`, so
that player element was kept). Each session failed within a second
with 0 bytes and ended `client_closed`: the browser closed the socket itself. In the code the only paths that do that without any byte are
the player's `fail()` paths; on a station socket go2rtc's error frame reaches the player as `upstream_error` (sanitized), the player failed
"שגיאת זרם" and retried. Since the stream was registered (the audit `start` row exists only after registration), the failure came from go2rtc's
producer (the RTSP session to the station) - most likely refused or dropped by the station while WisKey held a talk session with it (the
log shows "talk session … could not open: intercom_talk_busy" and "WisKey ended a talk" around each burst) or while WisKey's own panel held
a second RTSP session (audit finding 10). **The exact go2rtc error was not recorded then**; from this build on the stop row and the log name
it (`upstream_error`, `upstream_error_text`). Each re-open also paid the full cold start (new lease, new registration with a frame grab) - the
re-open grace removes that part.

## 7. Tests

- Backend: `tests/test_video_transport_2400.py` (policy precedence 25 cases, the exhaustive plan sweep, remote MSE only, the documented
  `auto` order, stations, the 480-case fixture, the route and the personal key, per-user isolation and closed values, the remote policy,
  the station read's plans for both sources, the sanitized stop row, the error classifier, `LiveDiag`, the lease re-open grace, its bound,
  a refused lease, the namespace guard). Updated: `tests/test_asgi_wiskey_295.py` (the full-app lifecycle now expects the idle grace and
  the shutdown removal; the three tests that pin the viewer-end delete run with `REOPEN_GRACE_S = 0`).
- Frontend unit (node only): `tests/unit-video-transport-2400.spec.ts` (the 480-case parity, every setting x channel x personal choice,
  remote MSE only, the settings-derived policy, stations, `retryIndex`, `freezeStep`, `freezeFallback`, the one-time seed, the policy
  parser); updated `unit-video-policy-webrtc-only.spec.ts` (MSE on the remote channel is MSE only), `unit-wiskey-station-media.spec.ts`
  (`playerModeFor` removed), `unit-user-menu-sections.spec.ts` (the new section flag).
- Evidence (players with fakes, runner only): new `tests/evidence-video-transport-2400.spec.ts` (remote MSE only on the camera page, wall
  and kiosk; a retry after a drop stays MSE; personal over installation on both channels; the old key never followed and seeded once; the
  camera page saves the personal choice; retry from the step that played last; frozen MSE reconnects on MSE; `auto` moves to WebRTC after
  repeated freezes); updated `evidence-webrtc-only.spec.ts` (the personal choice through `/media/video-policy` instead of `sw.transport`),
  `evidence-wiskey-station-media.spec.ts` (main follows the choice; MSE only / WebRTC only on both profiles; personal over installation with
  the server plans) and its mock.

### 7.1 What was run (2026-11-04)

| Check | Command / place | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` (frontend, workstation) | clean |
| Unit specs (explicit files) | 18 video / station / menu specs + 4 lint and string specs + 10 source-walk lint specs, `playwright.unit.config.ts` | 137 + 42 passed; the 10-file lint batch 100 passed after one fix (a Hebrew string used `›` instead of `‹`) |
| Backend (targeted) | `pytest` of the new file + 11 related files (station media, W10 lease lifecycle, ASGI WisKey lifecycle, prefs, HA camera live, H.265, camera scope, readiness, settings nav pref) | 504 passed |
| Release check | `scripts/release_check.py` | ready (one version 2.39.0, migrations 0001-0205 contiguous) |
| API inventory | `scripts/api_inventory.py` | 1843 -> 1844 routes (`GET /media/video-policy`) |
| Evidence + pixel + layout (runner, no gate running, 106 GB free) | `run_smart.py preview pilot/VIDEO-TRANSPORT-2400` - evidence-video-transport-2400, evidence-webrtc-only, evidence-webrtc-first, evidence-remote-video, evidence-wall-pano, evidence-wiskey-station-media, pixel-wiskey-station-media, pixel-wiskey-talk-dial-2382, layout-wiskey-station-media | 128 passed, 145 skipped (desktop-only player specs on tablet / mobile, fixture-backend specs), 0 failed; no pixel baseline changed |

Observed once: `test_full_app_lifecycle_…` (ASGI WisKey) failed its "no OS socket more than before" check inside one long combined run and
passed alone, with the new file, and in the final combined run - recorded as order-dependent, not reproduced.

## 7.2 Gate 2.40.0 @ 36385bcb2: evidence-wall-live-cap.spec.ts (stale spec, not a regression)

Four tests failed on desktop and mobile (:201, :225, :301, :310). Every count the spec makes still held - 4 sockets for a cap of 4, one
attempt per refused tile, the snapshot tiles, the profile of each tile; what failed was the TRANSPORT: `kind === 'webrtc'` /
"no MSE socket" / the badge `main·WebRTC` / `sub·WebRTC`, received `mse` / `main·MSE` / `sub·MSE`. The spec's mocked settings said
`media.transport_default: 'mse'` on the remote channel and still expected WebRTC first - exactly the behaviour the owner decision of
2026-11-04 removed (lab audit finding 1: "MSE only" was ignored remotely). The remote live cap and the wall quality ladder work as
before; they are about the ladder of `auto`. The fix is in the spec only: the fixture's transport is a parameter, `auto` by default (what
those tests describe), and one new test pins the decision itself - installation "MSE only" on the remote wall under a cap of 4: four MSE
sockets of the sub profile, four snapshot tiles, no WebRTC, no cap error, no extra socket.

## 8. Known limits

- The frozen-MSE evidence uses the player's own first-frame entry on a fake MSE socket (the fake stack decodes no fMP4); a real frozen stream
  is for the lab test below.
- Why the station's RTSP failed at 12:12 is still unknown until the new stop row records it in the lab.
- go2rtc's own log level (`webrtc` trace) is a setting of the shared go2rtc add-on - an owner action, not changed here.
- WisKey's own panel keeps its own media setting (MSE + HLS) and its own RTSP session; unchanged and documented in the audit.

## 9. Owner test plan (lab, after the train is installed)

1. הגדרות › וידאו ומדיה = "MSE בלבד". On the phone through `/arx/`: open a camera, the wall, the kiosk, a camera card - the badge reads
   `main·MSE` / `sub·MSE`, never "מנסה …WebRTC". Leave a camera open 2 minutes, then turn the phone's Wi-Fi off and on: it comes back on MSE.
2. "החשבון שלי › וידאו" = "WebRTC בלבד" (installation still MSE). The same screens play WebRTC on the phone AND on the PC (the choice follows
   the account); "כמו ההגדרה של המערכת" returns to MSE.
3. Stations drawer, Arx's own source, then WisKey's source (`access.station_media_provider = auto`): with "MSE בלבד" and with "WebRTC בלבד"
   - both profiles play on both sources.
4. Station re-open: open a station's drawer, close it, open it again within ~30 s - the picture should appear noticeably faster the second
   time (no cold start).
5. Start a talk with a station while its video plays; if the video stops, read the add-on log line `live session … go2rtc error <code>:
   <text>` (or the `video.live.stop` row's `upstream_error`) and send it - that is the 12:12 cause.
6. Optional: "אוטומטי" on the phone; a camera that froze (picture stuck) should show "הווידאו נעצר · מתחבר מחדש" within ~10 s and recover.
