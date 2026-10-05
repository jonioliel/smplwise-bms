# Provision-ISR HTTP API — study for SmplWise Arx (v1 first, v2.1.0 deltas)

**Status:** study, 2026-10-04. Written offline: no Provision-ISR device was contacted. Everything below comes from the
vendor's documents (private, gitignored, `private-evidence/provision-isr-api/`):

| Source | Version / date | Size | Read |
|---|---|---|---|
| v1 *HTTP API Protocol User Guide* (short polling) | 1.9, 2025-08 (history to 2024-08) | 252 pages | fully (smart chapter 10 skimmed for URLs and event fields) |
| v1 *Long Polling HTTP API* | 1.9, 2024-05 | 124 pages | fully (per-smart-type payload samples skimmed) |
| v1 Postman collection | 26.6 | 121 requests, 14 with saved responses | parsed completely |
| v2 *HTTP API* (short polling) | 2.1.0, 2026-08 | 537 pages | protocol, system, image, alarm, playback, network, security, talkback and change log fully; smart / schedule for URLs and formats |
| v2 *Long Polling & HTTP POST API* | 2.1, 2026-08 | 88 pages | fully (payload samples skimmed) |
| v2 Postman collection | 2.1.0 | 167 requests, many saved examples | parsed completely |

Redaction: every address, serial number, MAC and password in the vendor files is replaced here by placeholders
(`<host>`, `<user>`). The Postman files carry no real credentials (`{{username}}` / `{{pass}}` variables); their example
responses contain vendor sample serials / MACs and one example address — none is reproduced. The test fake
(`smplwise_vms/backend/tests/fixtures/fake_provision.py`) uses invented values from the documentation ranges only.

Change request built on this study: `docs/changes/CR-025-PROVISION-ISR.md`. Adapter: `smplwise_vms/backend/smplwise/services/recorders/provision_isr.py`.

---

> **Live validation 2026-10-04** (owner's NVR8-16400AN, firmware 1.4.7, read-only): every P1 command works over HTTPS +
> Basic. Seven divergences from the guide were found and fixed - zero-based stream ids, streams named by their RTSP URL
> (`/chID=<n>&streamType=main|sub1`), channel names in `GetChannelList`, `chlOfflineAlarm` in v1 alarm status, one record
> status item per stream - see CR-025 section 6.2. Where this study quotes the guide's RTSP form, the device's own URL wins.

## 1. Executive summary

1. **One protocol family, two editions.** v1 and v2 are the same transport: XML documents over HTTP, `POST
   http://<host>[:port]/<Command>[/<channelId>][/<action>]`, namespace `http://www.ipc.com/ver10`, root `<config>`. v2.0
   renamed / cleaned commands; v2.1 added device management (users, certificates, RTSP config, HTTP-POST push config).
   The XML namespace and command style identify the vendor's ODM platform (the same family as other "ipc.com/ver10"
   devices); this matters because quirks are firmware-family wide.
2. **v1 is the right base.** It works on every Provision-ISR NVR and camera in the field. v2 firmwares keep the v1 names
   working ("hidden but still callable" in the v2.0 change log: `GetChannelList`, `GetAlarmStatus`, `GetDeviceDetail`,
   ...), so a v1 client also runs on v2 devices — except where a field changed shape (section 6.3).
3. **Everything Arx needs for P1 exists in v1** — device identity, channels, live RTSP, snapshot, every stream's encoding
   and its capabilities, motion / smart / alarm-input status, disks, recording state, device clock. Playback search and
   the playback RTSP URL exist in v1 too (P3). Encoding **write** exists in v1 (`SetVideoStreamConfig`, whole `streams`
   element) and is friendlier in v2 (per-stream partial writes) — P2.
4. **The real v1 gaps** are small: no channel name list (only the OSD name, one call per channel), no NVR event push
   (long polling is documented for cameras; an NVR is polled with `GetAlarmStatus`), no "channel offline" alarm kind
   (derived from `GetChannelList` status), no disk-error alarms, no API-capability probe, Basic auth only in the v1 text.
   v2 fills each of these (`GetChannelInfo`, `GetAlarmStatusInfo.deviceAlarmStatus` / `chlOfflineAlarm`,
   `GetSupportedAPIs`, Digest).
5. **Main risks for live validation:** the exact NVR live-RTSP URL form (`?chID=` per the guide vs `/chID=` as in the
   playback URL), the auth scheme the owner's unit is configured for, whether the NVR passes `GetVideoStreamConfig` /
   `GetSnapshot` through for every proxied camera, and the device's wall-clock time semantics (no offset in any time
   string).

## 2. v1 protocol

### 2.1 Transport and URL

- `POST` is the documented form ("other forms are not supported"); each read command also says "POST or GET"; the v1
  Postman collection uses GET for reads. The adapter sends POST.
- `<protocol>://<host>[:port]/<cmd>[/<channelId>][/<action>]`. HTTP only in the text; default port 80. `channelId` is
  1-based; omitted = channel 1 (an IP camera). `action` selects a sub-operation (`PtzControl/1/Left`,
  `GetScheduleConfig/1/motion`, `GetAlarmTriggerConfig/1/motion`).
- HTTP/1.1; a client making several requests should send `Connection: Keep-Alive`. Answers in the Postman examples carry
  `Connection: close`, `Server: Internal Server`, HSTS and `X-Frame-Options` headers, and `Set-Cookie: Secure; HttpOnly`
  (an empty cookie; no session is documented).
- HTTPS: not described in the v1 text, but the devices expose it — `GetDeviceInfo.supportHttps`, `GetPortConfig.httpsPort`
  (Postman example: http 5001, https 5002, rtsp 5004, long polling 5005, ws 5006 on a camera with moved ports).

### 2.2 Authentication

- v1 text: **HTTP Basic** (RFC 2617) on every request; an unauthenticated request gets `401` with
  `WWW-Authenticate: Basic realm="..."`.
- v2 text: **Basic or Digest**, "depending on the device's configuration"; the v2 Postman collection defaults to Digest.
- No login handshake, token or session. (The v1 Postman has an undocumented `DoLogin` request with no body and no
  example — ignored.)
- Base64 "encryption" (`ModifyPassword`, `ModifyIntegrateUser`, v2 `encryptType=base64`) is encoding, not encryption.
- Adapter behaviour: one unauthenticated `GetDeviceInfo` learns the scheme from the 401 challenge (Digest when the device
  says Digest, otherwise Basic), cached 10 minutes per device; a 401 drops the cache. `nvr_extra.auth` can force it.

### 2.3 Request / response model

| Case | HTTP | Body |
|---|---|---|
| success, data | 200 | `<config version="1.7" xmlns="http://www.ipc.com/ver10">...</config>` |
| success, result only | 200 | `<config status="success"/>` |
| failure | 400 | `<config status="failed" errorCode="n"/>` (v2 adds `errorDesc`) |
| not authenticated | 401 | `WWW-Authenticate` challenge |

Error codes, v1: `1` invalid request (command / channel / action not supported), `2` invalid XML format, `3` invalid XML
content (incomplete or out of range), `4` permission denied, `5` network port error. v2 extends the table (`7` system
busy, `9` unauthorized, `10` user locked, `11` unsupported function, `12` channel error, `15` missing parameter, `16`
range error, `17` service not enabled, `18` modification would restart, `19` over specification, `79` internal, 80-84
upgrade, 101-111 audio, 150-153 face). Adapter mapping: 1/11/12 → `nvr_not_supported`, 4/9/10 or 403 → `source_forbidden`,
7 → `nvr_busy`, others → `source_error`; transport failures → `source_unavailable`; malformed XML → `source_invalid`.

Typed XML conventions: every element may carry `type` (`boolean`, `int8`..`uint64`, `string`, `list`), numeric `min` /
`max` / `default`, string `minLen` / `maxLen`; strings are CDATA (often with surrounding whitespace); lists are
`<x type="list" count|maxCount><itemType/><item>...`; enumerations are declared in a `<types>` block **inside each
answer** and the client is told to learn them from there. Set commands take the Get document's element **without
attributes**.

### 2.4 Rate limits and concurrency

**None documented** in either edition. Signals: account lockout exists (v2 code 10), IP allow / deny lists exist (code 5),
long-polling requires `SetSubscribe` within 10 s of the TCP connect. Arx policy (CR-025): one request at a time per device,
short-polling of alarms at 2 s (never below 1 s), no retry of a refused write, and no repeated wrong-password attempts
(the adapter makes one probe and one authenticated call per operation).

### 2.5 Discovery

UPnP only (guide 1.5). Arx does not need discovery: the installer types the address (CR-022 connection form).

## 3. v1 command map

Legend: **P1** = read by the adapter now, **P2/P3** = later phase, `-` = not planned. "NVR" / "IPC" = documented for that
device class only.

### 3.1 System

| Command | Class | Purpose | Arx |
|---|---|---|---|
| `GetDeviceInfo` | all | model, brand, `softwareVersion`, build date, hardware, `chlMaxCount`, `apiVersion`, alarm in/out counts, `support*` flags (incl. `supportAPILongPolling`, `supportHttps`, `SupportHttpPost`), serial, MAC, UUID | **P1** health / kind (serial, MAC, UUID dropped) |
| `GetDeviceDetail` | IPC | same plus smart / image / alarm capability booleans | P2 (camera-direct smart capabilities) |
| `GetDiskInfo` | all | disks: total / free MB, status `read`, `read/write`, `unformat`, `formatting`, `exception` | **P1** storage |
| `GetChannelList` | NVR | channel ids + `channelStatus` (`online`, `offline`, `videoOn`, `videoLoss`); **no names**; items sit next to an empty `<channelIDList/>` | **P1** channels |
| `GetAlarmInList` / `GetAlarmOutList` | NVR | alarm input / output ids | P2 |
| `GetDateAndTime` / `SetDateAndTime` | all | wall clock (`YYYY-MM-DD HH:MM:SS`, no offset), POSIX zone (`CST-8`, `GMT0BST,M3.5.0/1,M10.5.0`), NTP | **P1** read (drift evidence) / - |
| `UpdateState`, `UpdateSliceFirmware` | all / IPC | firmware upgrade | - (AGENTS: never) |

### 3.2 Image and streams

| Command | Purpose | Arx |
|---|---|---|
| `GetStreamCaps[/ch]` | per stream: `streamName`, `resolutionCaps` (each with `maxFrameRate`), `encodeTypeCaps`, `encodeLevelCaps`; `rtspPort`; tips give the RTSP URL forms | **P1** stream options, IPC RTSP path |
| `GetVideoStreamConfig[/ch]` | per stream `item id=1..n`: `name`, `resolution`, `frameRate`, `bitRateType` (VBR/CBR), `maxBitRate` (kbps, with min/max), `bitRateLists`, `encodeTypeCaps`, `encodeType`, `encodeLevel`, `quality` (lowest..highest), `GOP` (frames, min/max); Postman adds `mutexList`, `alarmSnapBindStreamId`, `watermark` | **P1** encodings |
| `SetVideoStreamConfig[/ch]` | the whole `streams` element without attributes; values within `GetStreamCaps` | **P2** |
| `GetSnapshot[/ch]` | JPEG (Postman: `Content-Type: application/octet-stream`) | **P1** |
| `GetSnapshotByTime[/ch]` | key frame at a past time (`<search><time/><length/></search>`); v1 answer is raw (JPEG or an H.264/H.265 key frame by Content-Type) | P3 |
| `RequestKeyFrame[/ch]` | force an IDR | P3 (playback start), write |
| `GetImageConfig` / `Set...` | brightness, contrast, WDR, IR-cut, mirror / flip... | P2 (camera image) |
| `GetImageOsdConfig` / `Set...` | time / channel-name overlay; **the only channel name in v1** | **P1** read (names) |
| `GetPrivacyMaskConfig` / `Set...` | 4 rectangles on a 640x480 grid | P2 read |
| `GetAudioStreamConfig` / `Set...` | audio codec, input, output | - |

### 3.3 PTZ

`PtzGetCaps`, `GetPtzConfig` / `SetPtzConfig` (IPC), `PtzControl/{ch}/{Up|Down|Left|Right|LeftUp|...|ZoomIn|ZoomOut|IrisOpen|IrisClose|Stop}`
(`<speed>` in caps range), `PtzGotoPreset`, `PtzRunCruise` / `PtzStopCruise`, preset CRUD (max 255/360), cruise CRUD.
Arx: read caps/presets only when a PTZ feature is approved; PTZ moves are physical actions (AGENTS: explicit approval,
never queued or retried) — not in CR-025.

### 3.4 Alarms

| Command | Purpose | Arx |
|---|---|---|
| `GetMotionConfig[/ch]` / `Set...` | switch, sensitivity 0-8, hold time, 22x18 grid as 18 strings of 22 `0/1` | P2 read (motion zones view) |
| `GetAlarmInConfig/{id}`, `GetAlarmOutConfig/{id}` (+ Set) | sensors / relays | P2 read |
| `ManualAlarmOut`, `AlarmOutputControl` (io, flashingLight, audioAlarm), `TriggerVirtualAlarm` (NVR, Postman only) | physical outputs | - (physical) |
| `GetAlarmStatus` | levels: `motionAlarm id=<ch>`, `sensorAlarmIn` list (ids = alarm inputs; an IPC's sensors are numbered after the NVR's own), `perimeterAlarm`, `tripwireAlarm`, `cpcAlarm`, `oscAlarm`, `cddAlarm`, `ipdAlarm`, `vfdAlarm`, `avdAlarm`, `vehicleAlarm`, `aoiEntryAlarm`, `aoiLeaveAlarm`, `passlineAlarm`, `trafficAlarm`, `pvdAlarm`, `loiteringAlarm`, `asdAlarm` (smart kinds carry `id` on newer firmware) | **P1** events (short polling) |
| `GetAlarmServerConfig` / `Set...` / `SendAlarmStatus` | IPC pushes alarm status to an HTTP server (+ heartbeat) | - (needs a device write and an inbound port; see 4.3) |
| `GetAlarmTriggerConfig/{ch}/{type}` / `Set...` | linkage: snap, record, alarm out, audio, white light | P2 read |
| sound / light alarm, PIR | camera deterrence | - |

### 3.5 Playback

| Command | Purpose |
|---|---|
| `GetRecordType` | record types: `manual`, `schedule`, `motion`, `sensor`, `inteldetection`, `nicbroken` (IPC) |
| `SearchRecordDate[/ch]` | dates with recordings |
| `SearchByTime[/ch]` | `<search><recTypes/><starttime/><endtime/></search>` → `timesectionList` of `starttime` (wall clock) with `seconds` and `recType`; **max 1000 items** (shorten the window) |
| `GetRecordStatusInfo` | per channel `recording` / `norecording` / `exception` + stream type, resolution, fps, bitrate, record types | 

Playback is RTSP (guide 6.1.3 tip): `rtsp://<host>:<rtspPort>/chID=<n>&date=YYYY-MM-DD&time=HH:MM:SS&timelen=<s>[&streamType=main|sub][&action=playback|backup]`
— the example uses `chID=0` while live uses 1-based ids (to verify); `backup` sends as fast as possible (export);
the device plays "the first segment" found. No HTTP download of video. Arx: P3; `GetRecordStatusInfo` is P1 (health).

### 3.6 Network, security, talkback, smart, schedule

- `GetPortConfig` (http, net, rtsp; Postman adds `httpsPort`, `longPollingPort`, `enablelongPollingHttp`, `wsPort`) —
  **P1**. `GetNetBasicConfig` / PPPoE / DDNS / UPnP mapping and every `Set` — never (network settings: AGENTS).
- `ModifyPassword`, `ModifyIntegrateUser` (ONVIF user), `Reboot` — never from Arx without explicit approval.
- `profile_talk` (IPC) / `channel_talk/{ch}` (NVR) return an RTSP URL for two-way audio (8 kHz, single channel, RTP size a
  multiple of 320 bytes) — microphone sessions need explicit authorization (AGENTS); later, if wanted.
- Smart (chapter 10, ~120 commands): face detection / recognition with target-face DB, crowd density, people counting,
  intrusion, perimeter, tripwire, object removal, exception (AVD / ASD), license plates with plate DB and snap search,
  area entry / exit, line / area counting with statistics, thermal, heat map, video metadata, illegal parking, loitering.
  Arx: P2 reads of the smart zones that Arx already shows for Hikvision (perimeter, tripwire, AOI); databases and counting
  statistics are out of scope.
- `GetScheduleConfig/{ch}/{type}` / `SetScheduleConfig` / `SetScheduleConfigEx` — P2 read of the record schedule.
- Postman-only: `GetHttpPostUrls` / `AddHttpPostUrl` (device push to a server; v2 documents it as 7.8, IPC 5.3.1+).

## 4. Events: short polling vs long polling

### 4.1 Short polling (all devices) — Arx P1

`GetAlarmStatus` returns **levels**, not events. The adapter's `AlarmTracker` turns successive reads into edges:
first read = what is active now; a level that turns false (or disappears — v2 reports only active alarms) = inactive.
On an NVR, camera offline / back online comes from `GetChannelList` status changes (`offline` / `videoLoss`). Events are
emitted as the existing `events_ingest.ParsedAlert`, with device kinds mapped to the vocabulary `TYPE_MAP` already
normalizes: `motionAlarm`→motion, `tripwireAlarm`→line, `perimeterAlarm` / `aoiEntryAlarm` / `aoiLeaveAlarm` / `ipdAlarm`→field,
`avdAlarm` / `sceneChange` / `clarityAbnormal` / `colorAbnormal`→tamper, `vfdAlarm`→person, `vehicleAlarm`→vehicle,
`sensorAlarmIn`→io (alarm-input id kept, no channel), channel offline→offline (`IPCDisconnect`, not `videoloss`, because
the Hikvision ingest treats `videoloss/inactive` as its heartbeat); other kinds keep their name (`other`).
Time: `GetAlarmStatus` has no timestamp → the receive time (precision `received`). Latency = the poll interval (2 s).
Short alarms between two polls are missed — the documented price of short polling.

### 4.2 Long polling (v1 guide; IP cameras)

- Connect a TCP client to `GetPortConfig.longPollingPort` (separate from the HTTP port; `enablelongPollingHttp` must be
  true); send `SetSubscribe` **within 10 s** or the device closes the connection; **the subscription ends when the TCP
  connection drops**; the subscription id is the `serverAddress` string returned (URL-like, opaque).
- `subscribeFlag`: `BASE_SUBSCRIBE` (recommended by the vendor: the **device writes HTTP POSTs back over the same
  connection** — `SendAlarmData`, `SendAlarmStatus`, `SubscribeTimeOut`), `REALTIME_SUBSCRIBE` (the client pulls with
  `GetPullMessages`, `timeout` ≤ 20-60 s, `messageLimit`), `STREAM_SUBSCRIBE` (not supported).
- `subscribeList` items: `smartType` (`MOTION`, `SENSOR`, `PEA`, `AVD`, `OSC`, `CPC`, `CDD`, `IPD`, `VFD`, `VFD_MATCH`, `VEHICLE`,
  `AOIENTRY`, `AOILEAVE`, `PASSLINECOUNT`, `TRAFFIC`, `VSD`) × relation `ALARM` / `FEATURE_RESULT` / `ALARM_FEATURE`
  (features = target boxes, base64 images, plates, faces — large).
- `initTermTime` 0 = permanent; otherwise renew with `SetRenew` before `terminationTime` (epoch seconds); `SetUnSubscribe`.
- `GetPullMessages` answer: `alarmInfoList` items = `alarmStatusInfo` + `dataTime` (wall clock) + `deviceInfo` (name, number,
  serial, IP, MAC — dropped by the parser).
- Appendix A: which smart types produce feature data and which only status (AVD and SENSOR: status only).

Arx: `PullSubscription` implements REALTIME_SUBSCRIBE with ALARM relation (status only) — the request / response model
of plain httpx, one keep-alive client per session. **Experimental**: IPC-only per the guide, not wired into the event
loop, and never run against a real unit. BASE_SUBSCRIBE (device-initiated HTTP on a client socket) needs a raw socket
HTTP server inside the client connection; not worth it while REALTIME works.

### 4.3 Device push to a server (not used)

`SetAlarmServerConfig` (v1, IPC; v2 adds NVR with `url`) and `AddHttpPostUrl` (v2 7.8, IPC 5.3.1+) make the device POST
alarms to an HTTP server. Both need a **device configuration write** and an **inbound port on the add-on** reachable from
the camera network — rejected for P1 (owner approval and network exposure). Recorded as an option for P4.

Update 2026-10-05 (NN2A): implemented as an option, off by default (`event_mode: push`, listener in the add-on on 18091/tcp,
unmapped by default). The owner's NVR (firmware 1.4.7) has `serverAddr` + `serverPort` only, so it authenticates by source
address. Validation tool and runbook: CR-025 section 6.6.

Update 2026-10-05 (NN2A protocol fix): the one approved write was **rejected** by that NVR (`source_error`, device unchanged).
Most likely cause: the v1 guide marks `GetAlarmServerConfig` / `SetAlarmServerConfig` "Only IPC is supported"; NVR support
arrives with the v2 API (v2 examples show NVR firmware 1.4.12; the v2 NVR form has a required `switch` and an NVR-only `url`).
The 1.4.7 answer is a v1 stub (empty `serverAddr` + `serverPort`, no attributes, no heartbeat). The adapter and the write
script now refuse the Set unless the device lists it in `GetSupportedAPIs` (v2), is an IP camera, or answers with the v2
NVR form; a v2 body sends `<switch>true</switch>` first. Details and evidence: CR-025 section 6.6.

## 5. Streams for go2rtc

| Device | Live URL (guide 3.1.1 tip) | Notes |
|---|---|---|
| NVR / DVR | `rtsp://<user>:<pass>@<host>:<rtspPort>?chID=<n>&streamType=main|sub` | no path in the documented form; the playback URL uses `/chID=...`. Adapter default `query`, `nvr_extra.rtsp_style=path` switches. **Live-validation item 1.** Main / sub only. |
| IPC | `rtsp://<user>:<pass>@<host>:<rtspPort>/<streamName>` | `streamName` from `GetStreamCaps` (`profile1`, `profile2`, `profile3`) |
| Playback | `rtsp://<host>:<rtspPort>/chID=<n>&date=...&time=...&timelen=...&streamType=...&action=playback|backup` | P3 |

RTSP authentication is not described; assumed to be the same account (to verify). Credentials stay server-side
(`live_source` is called by the go2rtc sync only; AGENTS: never to the browser). Stream names in go2rtc keep the CR-024
form `smplwise_{recorder_id}_ch{n}_{main|sub}`. v2.1 adds `GetRtspConfig` (RTSP on/off, RTSP over TLS `rtspOverTLSPort`,
multicast) — IPC only.

Codec facts for the player (`webrtc_verdict`): v1 names `h264`, `h264plus`, `h264smart`, `h265`, `h265plus`, `h265smart`,
`mjpeg`, `mpeg4`; profile `baseLine` / `mainProfile` / `highProfile`. No B-frame and no SVC field → only H.264 Baseline is
`ok`; Main / High H.264 is `unknown` (the player's first-frame watch decides), H.265 `unknown`, MJPEG `no`.

## 6. v2 (2.1.0) deltas

### 6.1 What v2 is

- Same transport and URL grammar; `config version="2.0.0"`; Basic **or Digest**; richer error table with `errorDesc`.
- Minimum firmware stated per command: core v2 reads **IPC 5.3.0 / NVR 1.4.12**; 2.1 management **IPC 5.3.1**
  (`GetHttpPostUrls` 5.3.5). So v2 is not strictly cameras-only — an NVR on 1.4.12+ answers the core v2 reads. The owner's
  "<5% of the installed base" figure is consistent with how new these firmwares are.
- Detection: `GetSupportedAPIs` (unknown command → 400 errorCode 1 on older firmware). `GetDeviceInfo.apiVersion` says
  `2.0.0` even on 2.1 firmware — the presence of 2.1-only commands in the supported list is the reliable marker.

### 6.2 Only in v2 (useful to Arx)

| v2 command | Fills which v1 gap |
|---|---|
| `GetSupportedAPIs` | capability discovery instead of trial calls |
| `GetChannelInfo` | channel **names**, status, attribute (thermal / fisheye / PTZ ...), attached camera IP — one call |
| `GetAlarmStatusInfo` | `deviceAlarmStatus` (no disk, disk full, disk RW error, HDD pulled, illegal access, IP conflict), `chlOfflineAlarm` / `chlVideoLoss` (NVR), alarm-output status — storage and offline events without derivation |
| `GetStreamCaps` + `bitRateLists`, `encodeLevelCaps265` | bitrate choices and H.265 profiles in the capability document |
| `SetVideoStreamConfig` partial (only `item id` required) | per-stream bulk encoding without rewriting siblings |
| `SearchByTime` with `endtime` | segment ends without computing |
| `GetSnapshotByTime` as XML base64 JPEG | always a JPEG |
| Long polling v2 / HTTP POST: `messageType` alarmStatus / alarmData / trajectory / keepalive, `deviceInfo.channelId`, NVR + DVR + AI-BOX as push sources | NVR push events (HTTP POST mode) |
| `GetDisarmingStatus` / `RequestDisarming` | camera deterrence disarm (security alarm integration later) |
| users, certificates, 802.1x, syslog, RTSP config, factory reset | device administration — out of Arx scope |

### 6.3 Changed or hidden (v1 client on v2 firmware)

- Hidden but callable: `GetChannelList`, `GetAlarmInList`, `GetAlarmOutList`, `GetDeviceDetail`, `GetAlarmStatus`,
  `SetPrivacyMaskConfig`, white-light alarm, `ModifyIntegrateUser`, target-face groups.
- "Modified fields, may cause incompatibility" (v2.0 change log): `GetVideoStreamConfig` (capabilities moved to
  `GetStreamCaps`; `bitRateLists` / `encodeTypeCaps` may be missing from the stream items — the parser treats them as
  optional), `GetRecordType` (`inteldetection` → `intelligentDetection`, `nicbroken` → `networkBroken`), `GetAlarmTriggerConfig`,
  most smart configs (not diffed — P2 must use v2 shapes when the device is v2).
- `GetAlarmStatus` answers may use the list shape (`<motionAlarm><item id="3">true</item></motionAlarm>`) and report only
  active kinds — the parser and tracker accept both.
- Removed: legacy people counting / crowd density / intrusion configs, thermography calibration, infrared access
  control, PIR, v1 plate DB commands (re-added in 2.1 under new names), `SetScheduleConfigEx` (still listed by devices).
- Long polling: lower-camel enums (`baseSubscribe`, `realtimeSubscribe`, `motion`, `lineCrossing`...), `smartSubscribeList`,
  `messageList` instead of `alarmInfoList` — a separate v2 parser (P4).

### 6.4 v1 vs v2 matrix for Arx

| Arx need | v1 | v2.1 | Choice |
|---|---|---|---|
| Device identity / health | `GetDeviceInfo` | same + `GetSupportedAPIs` | v1 (P1); probe v2 in P4 |
| Channel list | `GetChannelList` (NVR) / implicit 1 (IPC) | `GetChannelInfo` (both) | v1 |
| Channel names | `GetImageOsdConfig` per channel | `GetChannelInfo` | v1 (P1, best-effort), v2 when present (P4) |
| Live RTSP URL | doc forms (5) | same + RTSP config (IPC) | v1 |
| Snapshot | `GetSnapshot` | same | v1 |
| Encodings read | `GetVideoStreamConfig` | same (fields moved) | v1, tolerant parser |
| Encoding options | `GetStreamCaps` + stream `bitRateLists` | `GetStreamCaps` (+ bitrates, H.265 profiles) | v1, merge both |
| Encoding write (incl. bulk) | `SetVideoStreamConfig`, whole `streams` | partial per stream | v1 whole-element write (P2); v2 partial where supported (P4) |
| Motion / smart events | `GetAlarmStatus` polling; long polling (IPC) | `GetAlarmStatusInfo`, long polling / HTTP POST incl. NVR | v1 polling (P1) |
| Camera offline | derived from `GetChannelList` | `chlOfflineAlarm` | v1 derived |
| Disk errors | `GetDiskInfo` status polling | `deviceAlarmStatus` | v1 polling |
| Recording state | `GetRecordStatusInfo` | same | v1 |
| Record search | `SearchByTime` (1000 cap) | same + `endtime` | v1 (P3) |
| Playback | RTSP `chID=...&date=...` | same | v1 (P3) |
| Clock drift | `GetDateAndTime` | same | v1 |
| Capability probe | none (trial + errorCode 1) | `GetSupportedAPIs` | v2 when present |
| Auth | Basic | Basic or Digest | detect from challenge (both) |

## 7. Mapping to Arx (adapter seam)

| Arx surface | Adapter method (P1) | Device command(s) |
|---|---|---|
| `RecorderAdapter.capabilities` | static: read encodings yes, write no (P2), live `rtsp`, playback `none` (P3), events `poll` | none |
| `health` | `GetDeviceInfo` (4 s) | 1 call (+1 auth probe on first use) |
| `list_channels` | `GetChannelList` + `GetImageOsdConfig/{ch}` for online channels; IPC = channel 1 | 1 + n |
| `read_stream_encodings` | `GetVideoStreamConfig/{ch}` per channel; refused / offline channels left out | n |
| `stream_options` | `GetStreamCaps/{ch}` + the stream's own bounds; `writable: false` (`read_only_phase`) | 2 |
| `read_stream` | `GetVideoStreamConfig/{ch}`; `stream_ref` = `<ch><id:02>` (Hikvision-shaped, so digit validators keep working) | 1 |
| `write_stream_encoding` | refused 409 `nvr_not_supported` until P2 | none |
| `live_source(source_ref, role)` (ADP section 2) | URL per section 5 | 0 (NVR with `device_kind`), else `GetDeviceInfo` / `GetStreamCaps` |
| snapshot | `snapshot(ch)` — JPEG signature checked | 1 |
| storage / recording / ports / clock | `storage`, `record_status`, `ports`, `device_time` | 1 each |
| events | `poll_events(AlarmTracker)` → `ParsedAlert` list | 1-2 per round |

Encoding normalization (ADP section 1.6): codec `H.264` / `H.265` / `MJPEG` / raw; `smart_codec` true for `*plus` / `*smart`
(`codec_plus` for `*plus`); profile `baseline` / `main` / `high`; resolution `WxH`; fps float; `bitrate_kbps` = `maxBitRate`
(cap in VBR, rate in CBR); `quality` = the vendor word; `gop` frames; `svc` and `b_frames` None and listed in
`fields` as unsupported.

Hooks needed from the multi-NVR work (CR-024), none implemented here: (a) `registry.register_vendor(spec, ProvisionIsrAdapter)`
once validated; (b) the per-recorder event loop must call `poll_events` for adapters declaring `events="poll"` instead of
the Hikvision alert-stream listener; (c) the go2rtc sync must call `adapter.live_source` (ADP section 4 table: replace
`go2rtc.hikvision_rtsp_url`) and the snapshot route `adapter.snapshot`; (d) `nvr_extra` keys of section 8 need form
fields in the vendor spec (scheme, HTTPS port, TLS verify, RTSP style) — the Provision spec today has the generic five.

## 8. Security notes

1. **Basic over plain HTTP sends the password (base64) on every request.** Recommended: HTTPS (`nvr_extra.scheme=https`,
   `https_port`), or Digest if the device offers it. The adapter reports `transport_info().insecure` so the settings screen
   can warn. The device's HTTPS certificate is normally self-signed: `tls_verify=false` works but trusts any certificate;
   certificate **pinning** (store the SHA-256 at the connection test, refuse a change) is the proper fix (P2).
2. RTSP URLs carry the credentials; built server-side only and handed to go2rtc (go2rtc ≤1.9.11 logs sources — the
   existing once-per-source registration rule applies).
3. Device answers are untrusted input: `xmlsafe` (no DOCTYPE), size caps (XML 2 MB, JPEG 8 MB), text caps, numeric
   validation, list caps, no device string ever used as a URL path except a validated stream name (`[A-Za-z0-9._-]{1,32}`).
4. No serial, MAC, IP, UUID or administrator name leaves the parsers; error details carry the command name, HTTP status and
   device error code only.
5. P1 is enforced read-only by an allow-list (`READ_COMMANDS`): a command outside it is refused before a request is built.
   The long-polling session commands are a separate list.
6. Use a dedicated least-privilege device account for Arx (the guide's user types: administrator / advance / normal;
   whether "normal" may read stream configuration is a live-validation item). Avoid repeated failed logins (lockout).
7. Never from Arx without task-specific approval: `Reboot`, firmware, factory reset, user / password changes, network /
   port settings, alarm outputs, PTZ, talkback, `SetAlarmServerConfig` / `AddHttpPostUrl`.

## 9. Open questions for the owner

1. Which model and firmware is the NVR you will bring (model string, `softwareVersion`)? It decides whether v2 core reads
   (NVR 1.4.12+) are available from day one.
2. Is HTTPS enabled on it, and is it configured for Basic or Digest?
3. May Arx use a dedicated read-only account on the NVR (and later a separate account for the encoding writes of P2)?
4. When the device offers only Basic over plain HTTP: allow with a warning on the settings screen (a), or refuse until
   HTTPS / Digest is enabled (b)?
5. Events: is 2-second polling (short alarms may be missed) acceptable for P1 (a), or do you want the device-push route
   (requires one configuration write on each device and an inbound port on the add-on) (b)?
6. Are any Provision cameras connected directly (not through an NVR) in your installations, or always behind an NVR?
7. Which smart events matter to you beyond motion / line / intrusion (faces, plates, counting)?

---

## סיכום בעברית

ל־Provision-ISR שני מהדורות של אותו פרוטוקול: מסמכי XML ב־HTTP POST. מהדורה 1 עובדת על כל הציוד בשטח, ומכשירים עם
קושחה חדשה ממשיכים לקבל את הפקודות שלה, ולכן היא הבסיס. כל מה שנדרש לשלב הראשון קיים בה: פרטי מכשיר, ערוצים, כתובות
וידאו חי, תמונת מצב, הגדרות הקידוד של כל זרם והיכולות שלו, מצב התראות (תנועה, חכמות, כניסות), דיסקים, מצב הקלטה
ושעון המכשיר. הפערים של מהדורה 1 קטנים: אין רשימת שמות ערוצים (רק שם ה־OSD, קריאה לכל ערוץ), אין דחיפת אירועים מה־NVR
(דוגמים כל 2 שניות), אין התראת "מצלמה מנותקת" או "תקלת דיסק" מוכנה (נגזרות מסטטוס), ואימות Basic בלבד במסמך. מהדורה 2.1
סוגרת את כולם, ועובדת גם על NVR מקושחה 1.4.12 ומעלה. הסיכונים לבדיקה מול המכשיר: הצורה המדויקת של כתובת הווידאו החי
ב־NVR, שיטת האימות, ושעון המכשיר (זמנים בלי אזור זמן).
