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
| Privacy masks | `GetPrivacyMaskConfig` / `Set...` (4 rectangles, 640x480 frame) | read OK, all 4 off | Hikvision read-only zones; Provision cameras got ISAPI calls | Provision view | **built:** read-only in the zones overlay (`GET /cameras/{id}/zones`). Write: **planned** behind the change log |
| Image settings | `GetImageConfig` / `Set...` (bright, contrast, hue, saturation; WB / IR modes on cameras) | read OK (4 values) | none | view / edit | **planned** (low value; write pattern exists) |
| Motion detection | `GetMotionConfig` / `Set...` (switch, sensitivity 1-8, bit-row grid: guide 18x22, lab 9x32 / 18x32) | read OK; write OK (section 3) | Hikvision read + write; Provision got ISAPI calls | Provision motion | **built + live:** zones overlay (grid, sensitivity scale 1..8), `PUT /cameras/{id}/motion` on / off + sensitivity through `SetMotionConfig` with the change log and rollback (grid edits refused: the device's own grid size); sanctioned script `set-motion` |
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

## 3. Live writes on the lab NVR (2026-10-20, owner-approved, one action at a time)

Evidence: `private-evidence/provision-2026-10-20/` (`STEPS.log`, `nvr-write-log.jsonl`, the full previous documents
`stream-before-*.xml` / `motion-before-*.xml`, independent raw reads `enc_after_write/`, `enc_after_restore/`,
`motion_after_restore/`). Restore records: `secrets/provision-restore/<entry>.json`. Tool: `scripts/provision_nvr_write.py`.

| # | Write | Read-back | Rollback | Final state |
|---|---|---|---|---|
| 1 | channel 16 sub stream `maxBitRate` 128 -> 192 kbps (v1 whole-`streams` body, `name` never sent), entry `9a458c6e9abb` | verified by the script and by an independent raw read (main stream unchanged) | `restore-from-log` -> entry `8f4c9309c6dd`, verified 128 | raw read: only that value differed between after-write and after-restore; 128 = original |
| 2 | channel 16 motion sensitivity 4 -> 5 (`SetMotionConfig`, 18x32 grid sent back as read), entry `fc3be4206dfb` | verified | `restore-from-log` -> entry `fd2027b9d46d`, verified 4 | full `GetMotionConfig` document identical to the saved original |

Nothing was left changed on the device. The writes went through the same adapter methods the routes use
(`write_stream_encoding`, `put_config_doc`).

## 4. Audio in video, live (read-only + smplwise_ streams only)

- ffprobe of every channel's main stream (16/16) and channel 1 sub: **video only, no audio track** (`audio_probe_*.json`).
- `GetAudioStreamConfig` on all 16 channels: G711A, input MIC (14) / LIN (2), **no `audioInSwitch` element** - the NVR does
  not expose an audio enable on this firmware, so Arx cannot turn the cameras' sound on through the API.
- Lab go2rtc (shared host, only in-memory `smplwise_pv2_audio_*` streams via `/api/frame.jpeg`, deleted after; 36 foreign
  streams identical before / after): channel 1 main with `live_audio` `off`, `copy`, `opus`, `copy_opus` - every mode still
  delivers a decodable video frame (`go2rtc_audio_check_main*.json`). So enabling the option on a recorder whose cameras have
  no sound does not break live video. Channel 1 sub (H.265) returns no JPEG in any mode, including the existing `off` - a
  go2rtc frame-grab limit for H.265, not a regression.
- Not verified (needs a camera with a microphone): that the browser actually plays the sound (WebRTC PCMA / MSE).

### 4.1 v2 detection on the lab unit (live, read-only)

`api_facts` = level v1, no `apiVersion`, no v2 reads in use, whole-streams writes; 16/16 channels through the v1 list; health
read complete (1 disk, no disk alarm, clock drift +25.9 s against this PC); `camera_facts(1)`: PTZ unsupported, audio in
G711A / MIC, state unknown (no switch on this firmware), live audio off. One transient connect timeout during the first health
read (no write involved); the device answered the next reads normally (`STEPS.log`).

## 5. Tests

`smplwise_vms/backend/tests/test_provision2.py` and `test_provision_nvr_write_script.py` (fake device only; the fake now answers
GetAudioStreamConfig, PtzGetCaps / PtzGetPresets, GetChannelInfo, GetAlarmStatusInfo, GetMotionConfig / SetMotionConfig,
GetPrivacyMaskConfig and the v2 GetStreamCaps extras). Results: in the branch report.

## 6. Activation on the owner's installation

The owner's install runs a released add-on; these features exist only on this branch. Activation (recorder extras
`writes_enabled: true`, and `live_audio` if a camera with sound is added) is done after the branch is merged and released -
open item, not done here.

## 7. Remaining plan (feasible, not built in this branch)

| Item | Needs | Estimate |
|---|---|---|
| PTZ control + preset recall | a PTZ camera on the lab (none today); per-action approval rule | 1 day + live |
| Two-way audio (`channel_talk`) | a camera with a speaker; microphone-session approval | 1-2 days |
| Privacy mask / image / OSD writes | change-log documents like motion (`CONFIG_DOCS`) + UI | 0.5 day each |
| Alarm output pulse (`ManualAlarmOut`) | physical-action approval | 0.5 day |
| v2 push (HTTP POST, `messageList` long polling) | a v2 device (firmware 1.4.12+) and the inbound port decision | 1 day + live |
| v2 live verification of every v2 read | a v2 device | 0.5 day |

