# CR-PROVISION2 — Provision-ISR capability matrix (device vs Arx), 2026-10-20

**Branch:** `pilot/PROVISION2-295` (from `origin/integ/293`). **Builds on:** CR-025 (adapter, wiring, playback, push), CR-020
(encoding write pattern), CR-024 (multi-NVR), CR-026 (health). **Migrations:** none. **Sources studied:** the vendor's v1 short /
long-polling guides (2025-08, 2024-05), the v2.1 short / long-polling + HTTP POST guides (2026-08), both Postman collections
(`private-evidence/provision-isr-api/`), `docs/integrations/provision-isr/API_STUDY.md`, the lab agent's read-only report
(`private-evidence/lab-validation-2026-10-20/provision_v2_capability.md`) and this branch's own read-only probes of the lab NVR
(`private-evidence/provision-2026-10-20/`).

**Lab unit (owner's lab NVR):** NVR8-16400AN(1U), firmware 1.4.7 (2023-08), API **v1 only** (every v2 command answers 400;
v2 needs NVR firmware 1.4.12+ or IPC 5.3.0+), HTTPS 443 + Basic, 16 channels / 16 online, no PTZ camera, 8 alarm inputs
(4 local + 4 virtual), 1 output, 1 disk.

## 1. Matrix

Legend — Device: what the vendor API offers (v1 / v2) and what the lab unit answered (live, read-only, 2026-10-20).
Arx today: before this branch. Status after this branch: **built** (with fakes + tests), **live** (verified on the lab NVR),
**planned** (feasible, not built here), **out** (not offered, with the reason).

| Area | Device (API) | Lab unit (live) | Arx before | Gap | After this branch / plan |
|---|---|---|---|---|---|
| Live video | RTSP `/chID=n&streamType=main\|sub1` | H.264 High main, H.265/H.264 sub, plays | go2rtc via `ffmpeg:` source (CR-025 6.3) | none | unchanged |
| Playback / search / export | `SearchRecordDate`, `SearchByTime`, RTSP playback, `action=backup`, `GetSnapshotByTime` | works (CR-025 P3) | built and wired (CR-025 6.3/6.4) | fast-forward (no API) | unchanged |
| Events and alarms | v1 `GetAlarmStatus` short polling; v1 long polling (IPC); v2 HTTP POST / long polling, `GetAlarmStatusInfo` (IPC) | motion + channel offline + inputs; no long polling port; `SetAlarmServerConfig` refused (v1 NVR) | 2 s polling, push with fallback (CR-025) | v2 device alarms (disk full / no disk / pulled out / R/W error / illegal access) | **built:** v2 `deviceAlarmStatus` parsed; health reads `GetAlarmStatusInfo` when listed (disk alarms to CR-026), v1 keeps `GetAlarmStatus` |
| API generation detection | v2 `GetSupportedAPIs` | 400 (v1) | cached probe gating partial writes / push | not exposed | **built + live:** `api_level()` / `api_facts()`, `api_level` in the connection test |
| Channels | v1 `GetChannelList` (+ OSD name); v2 `GetChannelInfo` (name, status, type incl. PTZ / thermal / fisheye, one call) | v1 list with `name` attribute | v1 list | v2 one-call names / type | **built:** `GetChannelInfo` when listed, v1 fallback on any soft failure; the `ip` element is never read |
| Encoding read | `GetVideoStreamConfig`, `GetStreamCaps` (v2 adds `encodeLevelCaps265`, `bitRateLists`) | `encodeTypeCaps` empty, no bitrate list | read + normalized | v2 caps not used | **built:** H.265 profiles and bitrate list from v2 caps feed the editor options |
| Encoding write | v1 `SetVideoStreamConfig` (whole `streams`), v2 partial item | writes accepted on v1 (live, section 3) | single + bulk with preview / diff / confirm / apply / verify / undo, fakes (NN2B) | first live write | **live:** one bitrate step on one channel, read back, restored, verified (section 3) |
| Audio in video | `GetAudioStreamConfig` / `Set...` (codec G711A / G711U / AAC, input MIC / LIN, `audioInSwitch`) | codec G711A + input only, **no `audioInSwitch`**, **no audio track on any channel's RTSP** (16/16 probed) | dropped (`#video=copy`) | no way to carry sound | **built:** `nvr_extra.live_audio` `off` (default) / `copy` / `opus` / `copy_opus`; audio facts on the camera capabilities route. Live: the lab cameras send no sound, so only the "video still plays with the audio option" check is possible (section 4) |
| Two-way audio (talk) | `Talkback`, `channel_talk/{ch}` RTSP back-channel, 8 kHz | not probed (a microphone session = physical action) | Hikvision: read-only facts; none for Provision | facts + talk | facts: `audio` = unknown with the reason. Talk: **planned**, needs a camera with a speaker on the lab and its own task (AGENTS: microphone session) |
| PTZ and presets | `PtzGetCaps`, `PtzGetPresets`, `PtzControl`, `PtzGotoPreset`, cruises | 400 errorCode 3 on every channel (no PTZ camera) | Hikvision facts via ISAPI (a Provision camera got wrong ISAPI calls); Frigate control | facts for Provision; control | **built:** PTZ caps + presets read through the adapter (route dispatch fixed). Control: **planned**, needs a PTZ camera to verify (no blind physical commands) |
| Privacy masks | `GetPrivacyMaskConfig` / `Set...` (4 rectangles) | read OK, all 4 off | Hikvision read-only zones | Provision view | **planned** read-only view (reuse the Hikvision zones overlay); write behind the CR-020 gates |
| Image settings | `GetImageConfig` / `Set...` (bright, contrast, hue, saturation; WB / IR modes on cameras) | read OK (4 values) | none | view / edit | **planned** (low value; write pattern exists) |
| Motion detection | `GetMotionConfig` / `Set...` (switch, sensitivity 1-8, 22x18 grid as bit rows) | read OK (switch on, sensitivity 4) | Hikvision read + write (`PUT /cameras/{id}/motion`); refused for other vendors | Provision motion | **planned**: same route behind the vendor seam (`SetMotionConfig`), change log + rollback |
| OSD | `GetImageOsdConfig` / `Set...` | read OK | names read; Hikvision OSD write | Provision OSD write | **planned** |
| Time sync | `GetDateAndTime` / `SetDateAndTime` (POSIX zone, NTP) | NTP, rule `IST-2IDT,M3.5.5/2,M10.5.0/2` | drift + rule read, DST conversion (CR-025 P3.2) | write | **out by default**: a clock write changes every recording timestamp; owner task only |
| Storage / disks | `GetDiskInfo` (+ v2 disk alarms) | 1 disk, read/write, free 0 (overwrite) | health (CR-026) | v2 alarms | **built** (see events) |
| Record state | `GetRecordStatusInfo`, `GetRecordType` | motion-only recording | health + playback kinds | none | unchanged |
| Alarm inputs / outputs | `GetAlarmInList`, `GetAlarmOutList`, `ManualAlarmOut`, `AlarmOutputControl` | 8 inputs (4 local, 4 virtual), 1 output | inputs as events; outputs none | output pulse | **planned** (physical output: per-action owner approval) |
| Users | `ModifyPassword`, `ModifyIntegrateUser` | not probed | none | - | **out** (AGENTS: no user / password changes) |
| Channels / IPC management | none in v1 (no add / remove channel) | - | `add_channel=False` | - | **out** (no API) |
| Firmware | `UpdateSliceFirmware`, `UpdateState` | not probed | none | - | **out** (AGENTS: never firmware) |
| Network / ports / DDNS | `Get/SetNetBasicConfig`, `Get/SetPortConfig`, DDNS | ports read only | ports read | - | **out** for writes (network change) |
| Reboot | `Reboot` | not probed | Hikvision reboot route (approval) | Provision reboot | **planned**, per-action owner approval only |
| Health | composite (disks, record, channels, alarms, clock, certificate) | all parts read | built (CR-026) | v2 alarms, API level | **built** |
| Smart analytics config | `GetSmart*Config` (perimeter, tripwire, intrusion, ...) | NVR flags: none offered beyond motion / inputs | events only | config views | **planned** read-only, only for devices that offer them |

## 2. Product defaults (owner rule 2026-10-20: new capabilities OFF unless zero risk)

| Capability | Default for customers | Why |
|---|---|---|
| v2 reads (`GetChannelInfo`, `GetAlarmStatusInfo`, v2 caps) | ON, gated by the device's own `GetSupportedAPIs` | read-only; a v1 device never sees them except the one cached `GetSupportedAPIs` probe (10 min), which v1 answers 400 |
| `live_audio` | **OFF** | adds an audio track (and with `opus`, an ffmpeg transcode) to every live / playback source; untested on a camera with sound |
| PTZ / audio facts on the capabilities route | ON | read-only; replaces wrong ISAPI calls the route sent to Provision recorders |
| Encoding writes | OFF (`writes_enabled`) | unchanged CR-025 rule; per unit after owner approval |

## 3. Live encoding write (2026-10-20)

See section "Live evidence" at the end (filled from `private-evidence/provision-2026-10-20/`).

## 4. Audio in video, live

See section "Live evidence".

## 5. Tests

`smplwise_vms/backend/tests/test_provision2.py` (fake device only). Results: see the report of the branch head.
