# LAB-VIDEO-MEASURE-2026-11-12 - live / playback timing on the lab (read-only)

Branch `pilot/LAB-MEASURE-2436`, from `origin/main` @ `ab7894837`. Lab add-on **2.42.1** (2.43.0 / 2.43.1 not installed), go2rtc add-on
1.9.15, one 16-channel Hikvision NVR (16 cameras, all H.264). Run window 2026-11-12 06:41-06:54 UTC. Raw results, scripts and first-frame
snapshots stay in `private-evidence/lab-2026-11-12/` (not committed). This document carries no address, credential, serial, MAC, camera
id or camera name; cameras are named by NVR channel only.

## Method

- Everything ran from the runner, one session at a time, `nice -n 10`. The runner was **heavily loaded** by a gate (load average 31-37 on
  16 cores) for the whole run; browser decode times below include that load (see "Caveats").
- Access: one HA ingress session (Supervisor `POST /ingress/session`, ephemeral) and the owner's LLAT, read from the runner's lab env file
  and never printed. Health / inventory / recordings: `GET` only. Add-on log: `GET /api/hassio/addons/<slug>/logs` (read-only).
- Live and playback: headless **Google Chrome 154** (Playwright, `channel: chrome`) on the Arx ingress origin, driving the product's own
  sockets with the same signalling as `sw-live-player.ts`: `GET /media/live/{id}`, `WS /media/live/{id}/ws?profile=` with go2rtc `mse` or
  `webrtc/offer` + trickle candidates (no ICE servers, LAN). **Time to first frame (TTFF)** = request start -> first
  `requestVideoFrameCallback` of the `<video>` element (a decoded, presented frame), not the first byte.
- Playback: `POST /playback/sessions` -> `WS media_handle` (MSE) -> first frame, timed from the create request; seeks timed from the
  `POST .../seek` request to the new generation's first frame. Each session was closed with `DELETE`.
- Cameras (live): channels 1, 4, 7, 13 (main 2560x1440, sub 640x360) and 8, 10 (main 4256x1888, sub 1200x536). Each camera x
  {sub, main} x {MSE, WebRTC} x 2 repetitions = 48 live samples, + 6 drop/reconnect pairs. Every `smplwise_` stream had no consumer before
  the run (cold start).
- Playback: channels 7, 4 (2560x1440) and 10 (4256x1888), a recording from 1 h ago and 24 h ago each (6 starts), 5 seeks per camera
  (15), one scrub burst.
- Side effects (product behaviour, our namespace only): Arx itself created and deleted 27 temporary `smplwise_pb_*` playback streams
  and re-PUT the `smplwise_nvr-1_*` live streams it serves (see bug 1). No foreign go2rtc stream, NVR setting, add-on option, HA user or
  recording was touched; no restart. After the run: 0 playback sessions, 0 live sessions, 0 leftover `smplwise_pb_*` streams.

## Results against the spec targets

Spec: `MASTER_SPEC_HE.md` chapter 33 (performance targets, "proposed, not measured"). Percentiles are nearest-rank.

| # | Metric (spec target) | Samples | p50 | p95 | max | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Live MSE, **sub** - first frame (p95 <= 3 s) | 12/12 frames | 250 ms | 715 ms | 715 ms | **PASS** |
| 2 | Live MSE, **main** - first frame (p95 <= 3 s) | 12/12 frames | 1617 ms | 3752 ms | 3752 ms | **FAIL** (ch10 4256x1888: 3.40 / 3.75 s; ch13 2.98 s) |
| 3 | Live WebRTC, sub - first frame (p95 <= 3 s) | **8/12** frames | 264 ms | 7798 ms | 7798 ms | **FAIL** (ch8, ch10 1200x536: no frame in 12 s; ch13 once 7.8 s) |
| 4 | Live WebRTC, main - first frame (p95 <= 3 s) | **0/12** frames | - | - | - | **FAIL** (ICE connected, track arrived, no decoded frame) |
| 5 | "Fallback explained" (spec: fallback is explained) | - | - | - | - | **N/A on the lab**: the installation's transport is set explicitly to MSE (`/media/video-policy`: `choice mse`, `order [mse]`), so no WebRTC -> MSE fallback runs |
| 6 | Live reconnect after a client-side drop, sub MSE (p95 <= 3 s, same target) | 6 | 220 ms | 926 ms | 926 ms | **PASS** |
| 7 | Playback start, 1 h and 24 h ago - first frame (no spec number; T074 provisional p90 <= 8 s) | 6/6 | 1814 ms | 3090 ms | 3090 ms | **PASS** (against T074) |
| 8 | Single seek - first frame (p95 <= 5 s) | 15/15 | 1973 ms | 5561 ms | 5561 ms | **FAIL** (ch10 only: 4.2-5.6 s; ch7 1.2-1.5 s, ch4 1.9-2.2 s) |
| 9 | Seek lands on the right time ("real frame time or limited-precision indication") | 15 + 6 snapshots | - | - | - | **PASS with note**: a moved seek lands on the next segment start within 1 s (OSD checked); an in-segment seek starts 2-10 s *before* the requested time (keyframe); the API says `time_precision: keyframe_limited`, `actual_start_at: null` |
| 10 | Scrub burst: 6 seeks back to back, then the final generation (gate: no frame of an older request, no orphan stream) | 1 burst | API 277-308 ms per seek, burst 1.7 s | - | final first frame 1276 ms | **PASS** (final frame from the final target, 0 orphan `smplwise_pb_` streams); old-generation socket closed with **1000**, not 4410 (ingress) |
| 11 | Timeline search from the cache (p95 <= 300 ms) | 3 warm repeats | 134 ms | 170 ms | 170 ms | **PASS, insufficient samples** (n=3 < 5); cold 24 h search 323-1029 ms |
| 12 | `/health` reported state vs reality | before / after | - | - | - | **PASS** (status `ok`, go2rtc configured, stream sync ok, codecs 16/16 known, summary empty - and video really worked) |
| 13 | `/health/video` | - | - | - | - | **NOT_APPLICABLE**: 404 on 2.42.1 (route ships in 2.43.0, HEALTH-GO2RTC-2430) |
| 14 | Arx log errors during the run | 568 lines | - | - | - | **PASS**: 0 WARNING / ERROR / traceback; 0 since midnight UTC |

Other timings (for the record, no target): first MSE fragment 74-99 ms (sub) and 74-242 ms (main) - the network and relay are fast;
the remainder of the TTFF is the wait for a keyframe plus decode. Server-side "first media" in the log: live 12-21 ms after the socket,
playback 121-464 ms (one 1181 ms). `GET /media/live/{id}` 36 ms. Playback create 124-620 ms. Close 33-56 ms.

## Bugs and proposed tasks (not fixed here)

1. **Every live open and every 10-minute stream sync deletes and re-creates our go2rtc streams** (`services/go2rtc.py` `ensure_stream`).
   - Evidence: the add-on log has `go2rtc stream smplwise_nvr-1_chN_<profile> updated` for all 32 streams every ~10 min (2,482 lines in
     6,000 log lines; one block of 32 per sync, e.g. 06:48:05-06 UTC), plus one `updated` on every live socket open (102 during this run;
     the two-viewer test logged `updated` again when the second viewer opened). A read-only comparison of go2rtc's `GET /api/streams`
     producer URL with the URL Arx builds showed **32/32 differ only by the missing user and password**: go2rtc 1.9.15 reports the source
     without credentials, so `existing.sources == [src]` is never true and `ensure_stream` always does `DELETE` + `PUT`.
   - Impact: a viewer already watching was **not** cut in the two-viewer test (channels 1 and 4: viewer A kept receiving fragments after B's
     re-PUT), so this is not a visible outage today. It is still ~200 needless writes per hour to a go2rtc shared with another project;
     each PUT/DELETE may rewrite go2rtc's own config file (the known limit in `go2rtc.py`'s docstring, not verified here), and on go2rtc
     <= 1.9.11 each re-PUT logs the full source URL with credentials.
   - Proposed task: compare sources with the userinfo stripped from both sides (or keep a hash of the last source written per stream, as
     the WisKey frame path already does) so an unchanged stream is `unchanged`; a test with a credential-less producer URL.

2. **Live main profile TTFF exceeds the 3 s target on the 8 MP cameras** (row 2) and **a seek on them exceeds 5 s** (row 8).
   - Evidence: ch10 main live 3.40 / 3.75 s, ch13 main 2.38 / 2.98 s; ch10 seeks 4.2, 5.6, 4.3, 4.7, 5.0 s while the first fragment
     arrived after 0.2-1.0 s. Playback always uses the main track (4256x1888 on ch10).
   - Caveat: measured with the runner at load 31-37 on 16 cores; software decode of an 8 MP keyframe is CPU-bound. Re-measure on an idle
     runner and on a real client before treating it as a product defect.
   - Proposed task: re-measure on an idle machine; if it holds, consider opening playback / seek on the sub track first (or as a scrub
     preview) and moving to main once playing, and record the keyframe interval of these cameras.

3. **WebRTC gives no picture for any main stream and for the 1200x536 sub streams** (rows 3-4).
   - Evidence: in 16 of 24 WebRTC attempts the socket answered (`webrtc/answer` 77-104 ms), ICE reached `connected` (140-216 ms) and a
     video track arrived (82-105 ms), but no frame was decoded in 12 s. Works only on 640x360 subs. Matches the earlier lab note that
     WebRTC decodes only the small sub profile. The installation policy is MSE, so users are not affected today; any user or remote plan
     that chooses WebRTC / auto would wait the 12 s timeout before the MSE fallback.
   - Proposed task: investigate (go2rtc WebRTC packetisation / keyframe requests for large H.264 frames, Main-profile level), and until then
     let the camera's WebRTC verdict (`encoding` -> `webrtc_ok`) mark these profiles so the plan skips WebRTC for them.

4. **`GET /media/streams` reports every stream `online: false`** (41/41 before and after the run) while every tested stream played in
   < 1 s. `online` means "go2rtc has an active producer now", which is false for an idle on-demand stream. If any screen shows this as
   stream health it reads as "all offline". Proposed task: rename / document the field (`active`), or add a separate playable check.

5. **Superseded playback socket closes with 1000 through HA ingress, not 4410** (row 10). Same ingress behaviour as the 4503 case in
   HEALTH-GO2RTC-2430; a client that relies on the code to tell "superseded" from "ended" cannot. Proposed task: send a
   `{"type":"superseded"}` text frame before the close, as 2.43.0 does for `media_unavailable`.

Not bugs (observed and checked): seeks / starts that "moved to the next segment" were correct - these cameras record on events, and the
recordings API showed the gap (ch7 at 18:48 UTC: next segment starts 19:28:25 UTC, the frame OSD shows 19:28:26 UTC). NVR disk `free_mb: 0` with
recorder status `ok` is the normal overwrite mode.

## Caveats

- Runner under gate load for the whole run; decode-bound numbers (main profile, 8 MP playback) are pessimistic. Network-bound numbers
  (first fragment, API latency) are not affected much.
- Headless Chrome on Linux, software decode, `--disable-gpu`; a desktop browser with hardware decode will be faster on main.
- 2 repetitions per camera/profile/transport; the drop test is a client-side close + reopen (no upstream drop was induced: read-only).
- Spec chapter 24 gate "20 consecutive seeks" was not run in full (5 + 6 per session); the cache-search row has 3 samples.

## Receipts

| Step | Result |
| --- | --- |
| `prep.py` before / after (health, summary, report, health/video, recorder and image health, media streams and sessions, cameras, go2rtc read-only summary) | run, 200 except `/health/video` 404 |
| `measure.mjs all` (48 live, 6 reconnect, 6 playback starts, 15 seeks, 1 scrub) | run, exit 0, 06:41:18-06:49:59 UTC |
| `dual.mjs` (two viewers, ch1 and ch4 sub) | run, exit 0, 06:53-06:54 UTC |
| `segs.py` (recording coverage around the requested times, warm/cold search) | run |
| `srccmp.py` (go2rtc producer URL vs the URL Arx builds; categories only) | run, 32/32 differ in user + password only |
| `logs.py` (add-on log, last 6,000 lines, redacted) | run |
| Unit / gate tests | NOT_RUN (measurement only, no code change) |
