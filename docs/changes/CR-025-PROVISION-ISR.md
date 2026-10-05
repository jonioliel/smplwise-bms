# CR-025 — Provision-ISR recorders and cameras (HTTP API v1 first, v2 where v1 lacks it)

**Status:** P1 implemented offline (branch `pilot/provision-isr-v1` from `g0/intake` 4ce50e12), not merged, not released.
P2-P4 proposed. **Owner request (2026-10-04):** support Provision-ISR; base the integration on API v1 (all equipment, wide
market spread), use v2 (v2.1.0, cameras firmware 5.3+, <5% of the base) only where v1 lacks a capability, eventually
support both; the system must soon manage more than one NVR. **Study:** `docs/integrations/provision-isr/API_STUDY.md`.
**Builds on:** CR-020 (adapter seam, `docs/architecture/NVR_VENDOR_ADAPTERS.md` = ADP), CR-022 (`recorder_connections`,
vendor catalogue), CR-024 (multi-NVR, branch `pilot/multi-nvr`, not merged). **Supersedes:** ADP section 5.2 (the ONVIF
plan was written before the vendor API was available). **Migrations:** none (0057 stays free). No device, go2rtc,
Home Assistant or lab system was contacted.

## 1. Owner decisions applied

| # | Decision | Effect |
|---|---|---|
| O1 | v1 first, v2 only where v1 lacks it, both eventually | P1-P3 on v1; P4 adds v2 detection and v2 paths behind the same adapter |
| O2 | Provision-ISR is the first additional vendor (CR-024 O4) | adapter behind the CR-020 seam, registered through CR-024's `register_vendor` when merged |
| O3 | An NVR needs go2rtc; NVR settings live in Arx (NVR-less decisions 2026-10-03) | live video only through go2rtc (`live_source`); connection in `recorder_connections` |
| O4 | Device access read-only by default; writes only behind approval gates | P1 has an allow-list of read commands; writes are P2 behind the CR-020 gates |
| O5 | Provision-ISR stays "coming soon" in the catalogue until validated (CR-022 D1) | the adapter is not registered; tests construct it directly |

## 2. Phases

### P1 — v1 read-only adapter (DONE offline, this branch)

Connect (auth scheme detected from the device's 401 challenge: Basic or Digest; HTTP or HTTPS), device info / health,
channel discovery (NVR `GetChannelList` + OSD names; IPC = channel 1), every stream's encoding normalized to the ADP
vocabulary, stream options (read-only), live RTSP URL for go2rtc (NVR query / path forms, IPC stream names), JPEG
snapshot, disks, recording state, ports, device clock, events by short polling (`GetAlarmStatus` + channel status →
`ParsedAlert` edges), experimental long-polling session (REALTIME_SUBSCRIBE, cameras).

Files: `smplwise_vms/backend/smplwise/services/recorders/provision_isr.py` (adapter, `AlarmTracker`, `PullSubscription`),
`.../provision_isr_xml.py` (pure parsers), `smplwise_vms/backend/tests/fixtures/fake_provision.py` (fake device),
`smplwise_vms/backend/tests/test_provision_isr.py` (30 tests).

Interface note: CR-024 is not merged, so P1 implements the **existing** `RecorderAdapter` Protocol of `g0/intake`
(`services/recorders/base.py`, unchanged) plus vendor methods the ADP already names (`live_source`) or that the multi-NVR
work will need (`snapshot`, `poll_events`, `storage`, `record_status`, `device_time`, `transport_info`). The constructor has
the registry's signature `(recorder_id, settings)` and reads only the `nvr_*` fields, so it works with CR-024's per-recorder
settings unchanged. `device_key` hashes the destination like CR-024's Hikvision adapter. Nothing in `registry.py`,
`base.py` or any route was edited (no merge conflict with `pilot/multi-nvr` or `pilot/nvr-bulk-encoding`).

### P2 — settings read / write behind the existing approval gates

1. Wire the adapter (after CR-024 merges): `register_vendor`, vendor spec fields (scheme, HTTPS port, TLS verify /
   pinning, RTSP style), go2rtc sync via `live_source`, snapshot route via `snapshot`, per-recorder poll loop for
   `events="poll"`, `/health` block.
2. Encoding write: `write_stream_encoding` = read `GetVideoStreamConfig/{ch}` → refuse 409 `stale` when the stream's etag
   moved → `SetVideoStreamConfig/{ch}` with the whole `streams` element (v1 rule: no attributes), only the target stream
   edited, values validated against `GetStreamCaps` and the stream's bounds → read again → `applied` / `no_effect` /
   `diverged` decided by the service (CR-020). Never retried; timeout after send = `outcome: unknown`. Bulk encoding
   (CR-020 batch runner, `pilot/nvr-bulk-encoding`) reuses this per item; batches never mix recorders (CR-024).
3. Read-only views reused from Hikvision screens: motion grid (22x18), privacy masks, record schedule, smart zones
   (perimeter, tripwire, area entry / exit), alarm inputs / outputs, image settings.
4. HTTPS certificate pinning at the connection test.

### P3 — playback

`SearchRecordDate`, `SearchByTime` (1000-item cap → windowing), playback RTSP URL
(`/chID=<n>&date=...&time=...&timelen=...&streamType=...`), export with `action=backup`, `GetSnapshotByTime` for thumbnails.
Device wall-clock times converted with the recorder's IANA zone (CR-024 `recorders.time_zone`), raw strings kept
(KNOWN_QUIRKS T2). AGENTS rule: playback is not "seekable synchronized recording" until anchors, seek generations and
rendered time are measured on the real unit.

### P4 — v2 support

`GetSupportedAPIs` probe at connect (cached per firmware); where present: `GetChannelInfo` (names in one call),
`GetAlarmStatusInfo` (disk and channel-offline alarms), partial `SetVideoStreamConfig`, `bitRateLists` /
`encodeLevelCaps265` from `GetStreamCaps`, v2 record-type names, v2 long-polling schema (and NVR push via HTTP POST if the
owner approves the device write + inbound port). One adapter, a capability table per device — never two vendor tags.

## 3. Cuts, with reasons

| Item | Why not now | What is needed |
|---|---|---|
| Registration in the vendor catalogue / selectable in the UI | Owner D1: "coming soon" until a real unit is validated; CR-024's `register_vendor` is not merged | CR-024 merge + live validation (section 6) |
| Routes / go2rtc / event-loop wiring | Those modules are being made per-recorder on `pilot/multi-nvr`; wiring them twice would conflict | P2 step 1 after CR-024 merges |
| Encoding writes | Read-only first (AGENTS, owner rule); no real device to verify the write shape | P2, behind CR-020 gates, first write approved by the owner on his unit |
| BASE_SUBSCRIBE long polling (device writes HTTP onto the client socket) | needs a raw-socket HTTP server inside the client connection; REALTIME_SUBSCRIBE gives the same data | only if REALTIME misbehaves on real units |
| Device push (`SetAlarmServerConfig`, `AddHttpPostUrl`) | a device configuration write + an inbound port on the add-on | owner approval (question 5) |
| PTZ, talkback, alarm outputs, reboot, firmware, users, network | physical or administrative actions (AGENTS) | separate, explicitly authorized tasks |
| Smart databases (faces, plates), counting statistics, heat map | not in Arx's product scope | an owner request |
| ONVIF adapter (ADP 5.2) | the vendor API covers everything ONVIF would, with encoding fields ONVIF lacks | none |

## 4. Test plan

**Offline (done, P1):** `tests/test_provision_isr.py` against `FakeProvision` (recorded-shape answers rebuilt from the
guide and the Postman examples, invented values): protocol conformance, auth detection (Basic, Digest, forced), wrong
password / device down / not configured, no secret in errors, channel list quirk, OSD names (incl. turned off), IPC as one
channel, encoding normalization (H.265, H.265+, H.264 Baseline, MJPEG, unsupported fields), read-only stream options,
write refused + allow-list + `writes == []` after every read method, RTSP URLs (NVR query / path, IPC, escaped
credentials), snapshot (JPEG / empty), storage / record status / ports / clock, serial and MAC dropped, error-code
mapping, unsafe XML, deadline, alarm parser (v1 and list shapes), edge tracker (first read, no change, inactive,
alarm input, channel offline / back), IPC alarms without id, unknown kinds, long-polling session and refusal.

**P2 offline:** write path against the fake (etag stale, accepted, no effect, diverged, timeout after send = unknown,
busy code 7, range code 3/16), batch runner with a Provision recorder, recorder-isolation tests of CR-024 with one
Hikvision fake + one Provision fake.

**Live validation (when the owner's NVR is on the network; read-only, approved session):** see section 6.

## 5. Dependencies on multi-NVR (CR-024)

1. `registry.register_vendor` (seam) — to make the adapter reachable.
2. Per-recorder `Settings` (`recorder_scope.settings_for`) — the adapter already reads only `nvr_*`.
3. Per-recorder background work: the event loop must dispatch on `capabilities().events` (`push` = Hikvision alert stream,
   `poll` = `poll_events` every 2 s).
4. `events.recorder_id` (migration 0055) — Provision events carry the recorder like any other.
5. go2rtc sync through `adapter.live_source` (ADP section 4), snapshot route through `adapter.snapshot`.
6. Vendor spec fields for the Provision connection extras (`nvr_extra`: scheme, https_port, tls_verify, rtsp_style, auth).

## 6. Live validation checklist (first session with the owner's unit, read-only)

1. `GetDeviceInfo` → model, firmware, `apiVersion`; `GetSupportedAPIs` (P4 gate).
2. Auth scheme from the challenge; HTTPS available; a non-admin account's read rights.
3. Live RTSP: `?chID=` vs `/chID=` form, main and sub, through go2rtc; RTSP auth = same account.
4. `GetChannelList` vs the NVR's UI; OSD names; offline / video-loss statuses.
5. `GetVideoStreamConfig/{ch}` for each proxied camera (does the NVR pass it through?), compare with `GetStreamCaps`.
6. `GetSnapshot/{ch}` per channel.
7. `GetAlarmStatus` while walking in front of a camera: ids per channel, latency at 2 s.
8. `GetDateAndTime` vs real time (drift, zone string).
9. Long-polling port reachable? (`GetPortConfig`), only if a camera is directly reachable.
10. Recorded fixtures: redacted captures into `private-evidence/` first, then into `tests/fixtures/` after review.

### 6.1 First live attempt, 2026-10-04 (read-only, owner's NVR, address and account in secrets only)

- Probe: `GetDeviceInfo`, `GetPortConfig`, `GetDateAndTime`, `GetDiskInfo`, `GetRecordStatusInfo`, `GetAlarmStatus`,
  `GetVideoStreamConfig/1`, `GetSnapshot/1` through the P1 adapter, about one request per second, no write.
- Result: **every request answered 401 with a `Digest` challenge**; Digest with the stored account was refused each time.
  No endpoint, model, firmware or channel count could be read. Finding 1: the unit is configured for **Digest** (not the
  v1 guide's Basic). Finding 2 (bug, fixed): the adapter re-tried the login on every call after a refusal (~17 refused
  attempts in the probe) — a lockout risk; one refusal now blocks further login attempts for 5 minutes
  (`REFUSED_BACKOFF_S`, test `test_refused_credentials_stop_further_logins`).
- Redacted request log (no bodies were returned): `private-evidence/provision-isr-live/<timestamp>/summary.json`.
- Second attempt after the owner enabled the API server (encryption MD5 = Digest): a gated probe (ONE authenticated
  `GetDeviceInfo`, stop on anything but success) was refused again (401 Digest). The challenge itself (read without
  credentials) is `Digest qop="auth"`, realm, 32-char nonce, `stale="TRUE"` already on the first challenge, no
  `algorithm` (MD5 by default) and a vendor parameter `AuthVersion`. HTTPS 443 was not tried (the probe stops at the gate).
- Owner confirmed (2026-10-04): the same account logs into the web UI; Administrator group with remote login.
- Investigation (owner-approved: at most 3 single attempts, 60 s apart; 2 used, both 401):
  - attempt 1: Digest built by hand with the vendor guide's quoting (`qop="auth"`, `algorithm="MD5"`, uri `/GetDeviceInfo`);
  - attempt 2: the same with the guide's uri form without the leading slash (`uri="GetDeviceInfo"`);
  - the guide's own Digest example could not be reproduced offline with its stated password (no combination of realm,
    uri, method or MD5'd password yields its `response`), so the example proves nothing about a variant.
- Facts gathered without credentials: the API is served on the HTTP port (an unknown command answers 400, a known one
  401 `Digest realm="Web Service", qop="auth", stale="TRUE", AuthVersion="1.1"`, a fresh nonce per request,
  `Connection: close`); HTTPS 443 refuses the TCP connection; the "server port" is not HTTP.
- The web UI does NOT use HTTP Digest: its public script (`js/app/login.js`) logs in with `reqLogin` (nonce, token,
  session id) and `doLogin` (SHA-512 of the password, MD5 key for the session key). A working web login therefore says
  nothing about the API's Digest; `AuthVersion=1.1` is undocumented in every vendor file.
- Next step proposed to the owner: switch the API server's authentication to plaintext / Basic temporarily (the v1
  guide's documented scheme) and enable HTTPS, then spend the last approved attempt on Basic.

### 6.2 Live read-only validation, 2026-10-04 (owner set the API server to Base64 = Basic, HTTPS on)

**Result: authenticated at the first attempt (HTTPS 443, Basic, certificate not verified for this test only). Every v1
read used by P1 answered 200; no write was sent.** 93 requests in the full run + 25 in the re-check after the fixes, about
one per second. Redacted shape samples: `private-evidence/provision-isr-live/<timestamp>-https/` (address, account,
serial, MAC, device name and URL host replaced; no image saved).

| Fact | Value |
|---|---|
| Model | NVR8-16400AN(1U) |
| Firmware | 1.4.7.62634B230830.N0S.U2(16A820) (`apiVersion` absent) |
| Channels | 16 (15 online, 1 offline); 8 alarm inputs, 1 output; 1 disk |
| Streams per channel | 2 (main 1920x1080 H.264 Baseline 25 fps 2 Mb/s VBR, sub 704x576 H.265 6 fps; one channel 2560x1440) |
| HTTPS | TLS 1.3, **self-signed** RSA certificate (valid to 2034), fails system-CA verification |
| v2 | **does not apply** to this unit: NVR v2 core APIs need firmware 1.4.12+ (v2 guide); not probed (v2 calls were not in the approval) |

| v1 command | Live |
|---|---|
| GetDeviceInfo, GetChannelList, GetImageOsdConfig, GetStreamCaps, GetVideoStreamConfig, GetSnapshot (16/16 JPEG), GetAlarmStatus, GetDiskInfo, GetRecordStatusInfo, GetPortConfig, GetDateAndTime | 200, parsed |
| Long polling | not offered (`GetPortConfig` has no `longPollingPort`; no `supportAPILongPolling`) - sampling or device push |
| Motion sample (10 polls, 2 s) | motion edges on 12 channels, channel-offline alarm on 1; latency = poll interval |

Divergences from the vendor guide found and fixed (adapter + fake, `fake.shape = "live"`, tests
`test_provision_isr_live_shape.py`), all re-verified on the unit:

1. **Stream ids start at 0** (`<item id="0">` = main, `1` = sub). The first parser dropped id 0 and reported the SUB stream
   as the main one. Now the position decides `stream_ref` / role; the device id is kept for writes.
2. **Each stream is named by its RTSP URL** (`rtsp://<device>:554/chID=1&streamType=main`, sub = **`sub1`**). The guide's
   `?chID=...&streamType=sub` form is wrong for this unit. `live_source` now takes the path from the device and always
   uses the connection's own host, port and credentials; the URL-shaped name is never kept or written back.
3. **Channel names are an attribute of `GetChannelList` items** (`name="..."`): no per-channel OSD read is needed.
4. **`chlOfflineAlarm` is reported in v1 `GetAlarmStatus`** (list shape, active items only); the derived offline event from
   the channel list is skipped when the device reports it (no duplicates).
5. **Record status has one item per stream** (same channel id twice) and spells `no recording`; aggregated per channel.
6. `GetStreamCaps`: profiles in a top-level `encodeLevelCaps` enum list, empty per-stream `encodeTypeCaps`.
7. `GetDeviceInfo`: no `apiVersion`, no `support*` smart flags beyond fisheye / RS485 / SD (smart events offered: motion
   and alarm inputs only); `softwareBuildDate` repeats the firmware string.

8. **RTSP checked with ffprobe** (one read-only session per form, channel 1): the device's form
   `/chID=1&streamType=main` plays (H.264 **High**, 1920x1080, 25 fps, no B-frames) and `streamType=sub1` / `sub` play
   (H.265 Main 704x576 6 fps); the guide's `?chID=1&streamType=main` answers **404 Stream Not Found**. The API reported
   `baseLine` for that High stream, so the API's profile is not used as WebRTC evidence any more (verdict `unknown`,
   the player measures). go2rtc itself was not run against the unit (the lab go2rtc is shared; no stream was created).

Settings design (owner request): the connection test records the device certificate's SHA-256 and the recorder then
**pins** it (a changed certificate refuses the connection until an administrator accepts it). `tls_verify=false` is for
this validation only.

### 6.3 Wiring on CR-024 (branch pilot/provision-wiring) and the HA2 browser test, 2026-10-04

- Registry: Provision-ISR registered through `register_vendor`, **selectable** (validated read-only); connection form with
  select fields: HTTPS / HTTP, certificate pin / verify / trust, auth (auto / Basic / Digest), events (sampling / push), time
  basis (device clock / always Israel time), advanced: pin value, poll interval, push port, RTSP style, go2rtc source,
  warning suppression. The connection test returns transport facts, warnings and the certificate to pin; saving "pin"
  without a fingerprint is refused (`tls_pin_required`). Plain-HTTP Basic shows a dismissible warning.
- Discovery, go2rtc stream sync (`smplwise_` only), snapshot, events (sampling 2 s or push with fallback), health probe,
  recordings search, playback sessions, thumbnails / frames and exports reach the Provision adapter / playback module
  through `services/recorders/vendor_io.py`; Hikvision recorders keep their paths. Provision cameras use their channel as
  recording track. Exports: RTSP backup (MPEG-TS) remuxed to MP4 without video re-encode (owner, corrected decision).
- Camera identity: v1 names no serial number of the camera behind an NVR channel, so `device_fingerprint` stays empty for
  Provision cameras (nothing is disabled on a swap); rows match by recorder + channel (CR-024 rule).
- **HA2 go2rtc (1.9.14) browser test** (owner-approved, one `smplwise_pb_cr025_test` stream created and deleted, no other
  stream touched, verified before / after): go2rtc's native RTSP client gets **no tracks** from this NVR (playback and
  live alike, "codecs not matched:  => ..."), while ffprobe from the PC plays the same URLs. Through go2rtc's **ffmpeg
  source** (`ffmpeg:<url>#video=copy`) the playback request played in headless Chrome over MSE: 1920x1080, currentTime
  advancing in real time, buffer ahead. So every Provision go2rtc source is wrapped that way by default
  (`vendor_io.go2rtc_source`; `go2rtc_source: rtsp` per recorder for firmware where the native client works). Audio is not
  carried by that source yet. Screenshot in `private-evidence/provision-isr-live/ha2-playback/` (real frame, not in Git).

### 6.4 End-to-end playback through Arx's own screen (HA2 go2rtc, 2026-10-04, owner-approved)

A throwaway Arx backend on the PC (real NVR read-only, HA2's go2rtc; a guard refused every go2rtc write outside
`smplwise_pb_*`, live stream sync / derived events / thumbnails / event loop off) and the playback screen in headless Chrome,
channel 2 (1920x1080 H.264):

| Measure | Result |
|---|---|
| Recording search (3 h, 39 segments, gaps 4-40 s visible) | 0.3-1.1 s, coverage complete, device clock rule |
| Open playback -> first frame | 6.1-6.3 s (MSE) |
| Real-time advance | 5.7-6.0 s of media in 6 s |
| Seek through the screen's own seek (3 targets, 17 min to 2 h back) | new generation each, playing again after 5.1-5.2 s |
| Displayed time vs the camera's OSD after the last seek | screen 18:51:24, OSD 18:51:25 (about 1 s, key-frame start) |
| Close | session closed, no `smplwise_pb_` stream left in HA2's go2rtc (checked: 0) |

Finding fixed: the adapter still declared `playback: "none"`, so the installation's playback capability was off and the
screen said "requires a media server"; it now declares `rtsp`. A seek sent to the API from outside the screen ends the
screen's player ("session replaced") - expected: the screen owns its session. Not measured: frame accuracy, speeds other than
x1, reconnect after a network drop, two cameras in sync.

**Second run (same set-up, 2026-10-04 evening; superseded by the third run below).** First frame 18.6 s (the first run's 6 s
was with a warm go2rtc producer). Speed control: x0.25, x0.5 and x1 offered, x2 and x4 disabled by the screen (RTSP
playback has no fast-forward on this firmware). Real-time advance read 0.36-0.71 s of media per 6 s - implausibly low next to
the first run's 5.7-6.0 s; the cause is not established (the samples followed the speed changes, so a re-buffering player or
the probe itself is suspected); NOT accepted as a result. +/-10 s nudges landed on the requested position and played
again after about 20 s. Producer-drop recovery: 10.1 s measured, but the script's drop was not a faithful network drop, so the
number is NOT accepted either. No `smplwise_pb_` stream left in HA2's go2rtc (0).
**Third run (2026-10-05 night, corrected script; accepted).** Every sample starts only once the player reports playing with
data ready; the advance is sampled every second for 12 s (media time and the screen's own position, generation tracked).
Channel 2, a 353 s recording segment, real NVR read-only, HA2 go2rtc (only our own `smplwise_pb_` stream; every other stream
unchanged, 0 left after close):

| Measure | Result |
|---|---|
| Open playback -> first frame | 7.7 s |
| Advance at x1 (twice, before and after the speed changes) | 12.44 s of media in 12.4 s (ratio 1.00), screen position +12.5 s, 0 stalls, no new generation |
| x0.5 | 6.15 s in 12.3 s (0.50), position +6.3 s, settled in 0.2 s, no new generation |
| x0.25 | 3.10 s in 12.4 s (0.25), position +3.1 s, settled in < 0.1 s, no new generation |
| x2 / x4 | disabled by the screen (no fast-forward on RTSP playback for this firmware) |
| Resume at the current position (a new start, what the screen does after a failure) | playing again after 8.6 s |

The second run's low advance numbers were a measurement artefact (samples taken before the player was ready). **Drop recovery
is still not measured:** deleting our own stream in go2rtc's configuration does not end a running go2rtc session - playback
continued for the full 60 s observation without a single stall - so that proxy cannot simulate a network drop (and the second
run's 10.1 s was not a recovery either). A real drop needs the network path to the NVR cut for a moment, which is a network
change outside the read-only approval; it is left for an owner-approved session (or a fake RTSP source in a test rig).

**Follow-up (2.0.0, all vendors):** the screen now detects the stall itself (no media progress for `playback.stall_s`, default 5 s),
says "מתחבר מחדש", resumes automatically from the frozen position with the same new-generation seek (back-off, at most
`playback.auto_resume_attempts`, default 3), then says "הניגון נעצר" with a retry. See `docs/changes/PLAYBACK-STALL-RESUME.md`.

### 6.5 Security review fixes (2026-10-04/05, branch pilot/provision-wiring)

Two reviews (adapter + multi-NVR). Fixed, each with tests: export credentials no longer stored (HIGH); disabled / removed
recorders never contacted (M3); push listener bounded (M1); shared-address push refused (M2); certificate pin checked on the
request's own connection and no credentials before a pin exists; Hikvision ISAPI routes refuse other vendors (finding 3);
push token from its own secret plus a recorder generation (finding 5); Digest-to-Basic downgrade refused in auto mode
(finding 10); exact alarm-server restore in the write script; UTF-8-only device XML (L1); per-recorder health detail only for
who may see recorders (L2); recorder health cached 10 s (L3); export jobs bound to their recorder (L6); vendor extras validated
by kind; stored password not reused across scheme / HTTPS port / certificate mode / auth changes; CDATA escaping; ffmpeg with
a minimal environment and an input protocol whitelist; recorder ids limited to `nvr-<n>`; duplicate-recorder refusals audited.

**Known limitation - DNS rebinding.** A recorder configured by host name is resolved again on every request (httpx), after
the connection test's source-policy check. A name whose DNS answer changes later (rebinding, or an attacker controlling the
resolver) can point the stored credentials at another address. This is shared with the Hikvision path and is not new. Mitigations
in place: the source policy at test and save, HTTPS with certificate pinning (a different host cannot present the pinned
certificate, so the request is closed before any byte), Digest preferred over Basic. Recommended for installers: configure
recorders by IP address or use pinned HTTPS. Pinning the resolved address per session is deferred (it needs a custom
transport for both vendors).

## 7. ETA (focused agent time; owner review time not included)

| Phase | Work | ETA |
|---|---|---|
| P1 | study + adapter + fake + tests | done (this branch) |
| P2 step 1 (wiring) | after CR-024 merges | 1 day |
| P2 steps 2-4 (write + read-only views + pinning) | offline with the fake | 2-3 days |
| P3 playback | search, URL, export, thumbnails; offline | 2 days, + measurement on the unit |
| P4 v2 | probe + v2 paths + v2 long polling | 2-3 days |
| Live validation | first session on the owner's NVR (checklist section 6) | half a day on site/remote, + 1 day of fixes |

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | NVR live URL form differs from the guide | `rtsp_style` switch; validation item 3 |
| R2 | NVR does not pass encoding reads / writes to some cameras | per-channel refusal tolerated (channel left out); writes declared per stream after validation |
| R3 | Device wall clock without offset (playback, events) | receive time for polled events; IANA zone conversion in P3; raw string kept |
| R4 | Basic over HTTP exposes the password | HTTPS / Digest preferred; `transport_info().insecure` warning; owner question 4 |
| R5 | Short polling misses alarms shorter than the interval | 2 s interval; long polling / push in P4 |
| R6 | Firmware variation (ODM platform) | tolerant parsers, capability discovery, fixtures from real captures |
| R7 | DNS rebinding of a recorder host name (section 6.5) | IP addresses or pinned HTTPS recommended; per-session address pinning deferred |

---

## סיכום בעברית

**מה נבנה (שלב 1, בלי ציוד אמיתי):** מתאם Provision-ISR לקריאה בלבד מעל מהדורה 1 של ה־API, מאחורי ממשק הספקים הקיים:
התחברות (זיהוי אוטומטי של שיטת האימות), פרטי מכשיר ומצב, גילוי ערוצים עם שמות, הגדרות קידוד של כל זרם, האפשרויות של כל
זרם, כתובת וידאו חי ל־go2rtc, תמונת מצב, דיסקים, מצב הקלטה, שעון המכשיר, ואירועים בדגימה כל 2 שניות (תנועה, קו, פריצה,
חבלה, כניסות, מצלמה מנותקת). כל פקודה שאינה קריאה נחסמת עוד לפני שליחה. 30 בדיקות מול מכשיר מדומה.

**מה לא נבנה ולמה:** חיבור למסכים, ל־go2rtc ולזרם האירועים (מחכה למיזוג ניהול מספר מקליטים, כדי לא לחווט פעמיים);
כתיבת הגדרות (שלב 2, מאחורי שערי האישור הקיימים, אחרי בדיקה על המכשיר); ניגון (שלב 3); מהדורה 2 (שלב 4); דחיפת
אירועים מהמכשיר (דורשת כתיבה למכשיר ופורט נכנס — החלטה שלך); PTZ, דיבור, יציאות התראה ואתחול (פעולות פיזיות).

---

## Appendix P3 — playback and recording search (branch `pilot/provision-playback`)

**Status:** P3 core implemented offline and validated read-only on the owner's NVR (2026-10-04); not wired into routes or
the session engine (waits for CR-024, like P2 step 1); not merged, not released. The P1 adapter file was **not edited**:
the playback commands go through the adapter's `_call(..., allowed=PLAYBACK_COMMANDS)` per call, so the adapter's own
allow-list stays the P1 one.

Files: `smplwise_vms/backend/smplwise/services/recorders/provision_playback.py` (search, calendar, playback request,
snapshot at a time, export source), `.../provision_time.py` (device wall clock <-> UTC, POSIX TZ rule, DST), tests
`tests/test_provision_playback.py` (56) and `tests/test_provision_time.py` (24), fake
`tests/fixtures/fake_provision_playback.py` (a `FakeProvision` subclass; `fake_provision.py` untouched).

### P3.1 What the real unit does (read-only: 18 HTTP requests + 3 RTSP sessions, about one per 1.5 s)

Redacted shape samples: `private-evidence/provision-isr-live/20261004-2018*-playback*/` (no image saved; address and account
replaced).

| # | Fact | Consequence in the code |
|---|---|---|
| L1 | `SearchByTime` caps at **1000** items, oldest first, `count="1000"`, no `maxCount` (a 3.8-day window on a motion channel hit it) | cursor paging from the end of the last item; `MAX_REQUESTS` 30, then `coverage: partial` (never "empty") |
| L2 | v1 items carry `starttime` + `seconds` + `recType` only | end = start + seconds (real seconds); `end_raw = "<start_raw>+<n>s"`, or the v2 `endtime` when present |
| L3 | items are **clipped to the query window** (12:48:37 / 36 s comes back as 12:49:00 / 5 s for a 12:49:00-12:49:05 query) | clipped pieces merge again (`recordings.merge`: same kind, gap <= 2 s) |
| L4 | a window **without recordings = HTTP 400 errorCode 3**; so is `GetSnapshotByTime` in a gap (with `Content-Type: image/png`) | errorCode 3 on these two commands = "nothing recorded" (empty list / 404 `no_recording`) |
| L5 | `SearchRecordDate` writes `2026-9-19` (no zero padding); 16 days on the unit | tolerant date parser |
| L6 | `GetRecordType`: `manual, schedule, motion, sensor, intel detection` (v1 names) | kind mapping; the v2 spelling `intelligentDetection` is sent only when the device lists it |
| L7 | `GetSnapshotByTime` answers `image/h264` (Annex-B key frame, 45-125 KB), not a JPEG | `to_jpeg` decodes it with ffmpeg over pipes (live: a 125 KB key frame became a 40 KB JPEG) |
| L8 | playback RTSP `/chID=<n>&date=&time=&timelen=&streamType=main|sub&action=playback` works with **1-based** chID (chID=8 played the 2560x1440 camera of channel 8; the guide's example shows chID=0) and `streamType=sub` (704x576; live view needs `sub1`, playback does not) | `nvr_extra.playback_channel_base` (default 1) for a firmware that counts from 0 |
| L9 | the device does NOT play only "the first segment": it concatenates every recording in [time, time + timelen], starts at the **first recorded frame at or after `time`**, and keeps the real gaps in the PTS (a 65 s gap = a 65.8 s PTS jump) | `media_anchor(search, t)` = the instant PTS 0 shows; precision stays `keyframe_limited` |
| L10 | `action=backup`: 300 s of the sub stream in 35 s (about 8x); no speed parameter; no HTTP video download | export = RTSP backup copied by ffmpeg (`rtsp_download`, same signature as `exports.Worker.downloader`); playback speeds stay the engine's MSE-side 0.25 / 0.5 / 1 |
| L11 | the unit records on **motion** only (`recordTypes="motion"`, `manual,motion` on one channel); a `continuous` search answers empty | the UI must not promise a continuous timeline on such a unit (partial coverage is real coverage) |
| L12 | device clock rule `IST-2IDT,M3.5.5/2,M10.5.0/2`, NTP | see P3.2 |

The module end to end on the unit (6 requests, 10.6 s including the pacing): zone source `device`, a 3-day search on channel
8 = 1 page, 772 items -> 741 merged motion segments, a snapshot at a time decoded to JPEG.

### P3.2 Time (device wall clock, DST)

The device writes local wall-clock digits without an offset, produced by ITS POSIX rule. `M3.5.5` (last Friday of March)
is not Israel's rule (the Friday before the last Sunday of March): the two differ in 2023, **2028**, 2029, 2034 and 2035
(one week, e.g. 2028-03-24 to 03-31), when recordings are stamped one hour off the IANA zone. Conversions therefore use the
device's rule by default (`time_basis: "device"`, read from `GetDateAndTime`, cached 10 minutes), fall back to the
recorder's IANA zone when the rule is missing or unreadable, and `zone_report()` lists the periods where the two disagree
(for the health screen). `nvr_extra.time_basis = "iana"` forces the IANA zone. AGENTS rule kept: no fixed offset, raw
strings kept. Spring forward: a time inside the gap is read with the offset before the change (shifted forward). Fall
back: an item in the repeated hour is placed by the device's own end time (v2) when that decides it, else by list order
(a later item never starts before an earlier one ended), else on the earlier pass, and the result note says how many were
placed by assumption. Query windows near a change are widened by one DST step and filtered by UTC (the plain wall window
can even come out inverted).

### P3.3 Interfaces (for the wiring after CR-024)

| Function | Use |
|---|---|
| `ProvisionPlayback(adapter, tz_name).search(ch, start, end, kinds)` | -> `recordings.SearchResult` (the Hikvision `Segment` model; `track_id` = channel); kinds `continuous / motion / alarm / event / manual` |
| `.day(ch, date)`, `.record_days(ch)` | calendar (device-local days, 23 / 25 hours on DST days) |
| `.playback_request(ch, start, end, stream, action)` | RTSP URL (server-side only, at most 6 h, `ambiguous` flag in the repeated hour) |
| `rtsp_playback_url(settings, track_id, start, end, tz_name)` | drop-in for `playback.playback_rtsp_url`; the session engine keeps its `smplwise_pb_*` names (test: go2rtc receives only `smplwise_pb_*` writes, a foreign `door_station_1` stream is untouched, seek = a new generation) |
| `.snapshot_at(ch, t)` + `to_jpeg(snap)` | event thumbnails without an ffmpeg RTSP session |
| `.export_files(ch, start, end)` + `rtsp_download` | `exports.ExportFile`s with RTSP backup URIs + the matching downloader |
| `media_anchor(result, t)` | the instant PTS 0 shows |
| `.zone_report(year)` | device rule vs IANA zone |

Wiring list (one call site each, in files CR-024 is changing): `playback._create_stream` picks `rtsp_playback_url` for
`provision_isr`; `recordings.search_segments` calls `ProvisionPlayback.search` for a Provision camera (the cache stays in
`recordings`); `thumbnails.generate` uses `snapshot_at` + `to_jpeg`; `exports._files_for` / `Worker.downloader` use
`export_files` / `rtsp_download`; the adapter's `capabilities().playback` becomes `"rtsp"` once wired.

### P3.4 Cuts, with reasons

| Item | Why | Needed |
|---|---|---|
| Route / engine wiring | those files are being made per-recorder on `pilot/multi-nvr` | CR-024 merge, then the wiring list above (half a day) |
| "Seekable synchronized" claim | AGENTS: anchors, seek generations, rendered time and reconnect must be measured through go2rtc in a browser | one browser session on the unit through go2rtc (owner approval for `smplwise_pb_*` streams on the lab go2rtc) |
| Fast-forward / reverse playback | the API has no speed or direction parameter | none (MSE-side slow motion and frame step stay) |
| Export container | the existing pipeline remuxes downloaded files; Provision files arrive as MPEG-TS from ffmpeg | check `Worker._finish` with `.ts` inputs during the wiring |
| v2 search | v1 covers everything on this unit; v2 adds only `endtime` (already parsed when present) | none |

### P3.5 Tests (2026-10-04, Windows workstation, repo `.venv`, Python 3.12, from `smplwise_vms/backend`)

`python -m pytest tests/test_provision_time.py tests/test_provision_playback.py`: 80 passed (offline against the fake; the
ffmpeg decode test uses a key frame generated by the local ffmpeg, not a camera frame). With the regression set
`tests/test_provision_isr.py tests/test_provision_isr_p2.py tests/test_provision_isr_live_shape.py
tests/test_playback_race.py tests/test_playback_release.py tests/test_recordings.py`: 154 passed. Full suite and runner
gate: NOT_RUN (the runner is busy with a tier-L gate; this slice adds new files only).

### סיכום בעברית (ניגון)

נבנה: חיפוש הקלטות לפי ערוץ, טווח זמן וסוג (רציף, תנועה, התראה, אירוע חכם, ידני) במודל המקטעים של המערכת, עם דפדוף מעבר
לתקרת 1000 התוצאות של המכשיר; לוח ימים עם הקלטות; כתובת ניגון RTSP שאומתה על המכשיר האמיתי (ערוצים מ־1, זרם ראשי ומשני);
חיבור למנוע הניגון הקיים דרך go2rtc בשמות smplwise_pb_ בלבד; תמונה מזמן נתון (המכשיר מחזיר פריים H.264 ואנחנו ממירים
ל־JPEG); מקור לייצוא (RTSP במצב גיבוי, פי 8 מהזמן האמיתי). זמנים: המכשיר כותב שעון מקומי בלי אזור; ההמרה לפי חוק השעון
של המכשיר עצמו, כולל מעבר לשעון קיץ וחזרה ממנו, ודיווח על שבוע ב־2028 שבו חוק המכשיר שונה מחוק ישראל. עדיין לא חובר
למסכים (מחכה למיזוג ניהול מספר מקליטים).

## Health monitoring (CR-026)

Recorder health (disks, recording per channel, channel connectivity, clock drift, API reachability / latency, pinned
certificate expiry) is specified in `docs/changes/CR-026-NVR-HEALTH.md`. The Provision adapter implements it as
`read_health()` (reads `GetDiskInfo`, `GetRecordStatusInfo`, `GetChannelList`, `GetAlarmStatus`, `GetDateAndTime`; all in
`READ_COMMANDS`) and declares `health_detail=True`.
