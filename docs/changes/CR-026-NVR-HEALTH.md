# CR-026 — Recorder health monitoring (Provision-ISR first, any vendor through the adapter seam)

Status: implemented on `pilot/nvr-health` (base `pilot/provision-wiring`), target release 2.0.0. Fake-device tests plus one
live read-only pass on the owner's NVR (section 8). Owner decisions of 2026-10-05 applied (section 7).
Related: CR-024 (multi-recorder core), CR-025 (Provision-ISR adapter), CR-018 (notification core).

## 1. What it does

For every ready, enabled recorder, a background poller (default once a minute) reads the recorder's health **read-only**
and the notification monitor turns conditions into notifications:

| Part | All vendors | Provision-ISR (`health_detail`) | Notification source |
|---|---|---|---|
| API reachability | `adapter.health()` | same | `recorder.unreachable` (critical, managers, email, 120 s hold) |
| API latency | time of `health()` | same | `recorder.slow` (info, inbox only, 300 s hold) |
| Disk state | — | `GetDiskInfo`: read/write → ok, read → read-only, locked, unformat, formatting, exception → error; no disk on an NVR → missing | `recorder.disk` (critical for error / unformatted / missing, alert for read-only / locked; 60 s hold) |
| Disk alarms | — | `GetAlarmStatus` kinds containing "disk"/"hdd" | `recorder.disk` (critical) |
| Free space trend | — | samples every 10 min for 48 h, least squares over ≥ 6 h | `recorder.disk_space` (info) when full within `disk_fill_days` (**off by default**) |
| Recording per channel | — | `GetRecordStatusInfo`: recording / no recording / exception | `recorder.recording` (alert, subject = the camera): a device-reported exception always; "not recording for `recording_gap_min`" only on recorders marked continuous |
| Channel connectivity | — | `GetChannelList` + `chlOfflineAlarm` / video loss in `GetAlarmStatus` | **`camera.offline`** (existing source; see 3) |
| Clock drift | — | `GetDateAndTime` read with the device's own POSIX rule, minus the host clock at the request midpoint | `recorder.clock` (alert, 600 s hold) |
| Certificate expiry | — | pinned HTTPS only: one TLS handshake (no credentials) every 6 h | `recorder.certificate` (alert; critical once expired) |

Every source is a normal CR-018 policy row: the administrator can change severity, channels, recipients and the hold in
הגדרות › התראות. Titles and bodies carry the recorder's and the camera's names only.

## 2. Architecture

- `services/recorders/base.py`: `RecorderCapabilities.health_detail` (default False), `DiskReading`, `ChannelReading`,
  `HealthReading`, the optional `HealthReader` protocol (`read_health()`). A new vendor plugs in by implementing
  `read_health` and declaring `health_detail=True`; without it the recorder still gets reachability and latency.
- `services/recorders/provision_isr.py`: `read_health()` (allow-listed reads only; part failures are recorded in
  `errors`, a refusal / unreachable device stops the read), `certificate_facts()`, `clock_drift()`; `peer_certificate`
  now also returns `not_after`.
- `services/recorder_health.py`: thresholds, the in-memory store, the poller thread (`SW_RECORDER_HEALTH=0` disables it;
  not started in NVR-less mode), `evaluate()` (conditions), `tick()` (called by `notify_sources.tick` every 30 s),
  `view()` (the screen).
- `routers/recorder_health.py`: `GET /recorder-health` (recorder readers), `POST /recorder-health/check` (system.configure,
  at most every 15 s), `GET|PUT /recorder-health/settings` (system.configure, audited `recorder_health.settings`).
- No migration: thresholds are one JSON value in `settings` (`recorder_health.thresholds`); readings live in memory (the
  open notification rows are the durable state, so a restart loses nothing that matters).

## 3. Rules against noise

- **Hold on the way up**: a condition must hold for its policy's `after_s` (`notify_sources.held`).
- **Bands**: latency on above `latency_ms`, off below 70 % of it; clock drift on above `clock_drift_s`, off below half;
  disk fill on below `disk_fill_days`, off above 1.5×.
- **Hold on the way down**: a condition that ended is resolved only after it stayed clear for `recover_s` (default 120 s);
  the recovery notice follows the policy (`resolve_notice`).
- **Not judged ≠ resolved**: a part that could not be read (the recorder does not answer, a failed read, a stale reading
  older than three intervals) keeps its open rows open and creates none.
- **One announcement per root cause**: a disconnected camera is `camera.offline` only (not also "not recording"); the
  primary NVR's "not answering" is suppressed while `nvr.offline` (its alert stream) is open; a fresh health reading of a
  channel decides `camera.offline` ahead of discovery and the never-closed loss event, so reconnects resolve within a minute.
- **Full is not a fault by itself**: an NVR that overwrites stays full; full only matters when cameras stop recording,
  which `recorder.recording` reports.

## 4. Thresholds (הגדרות › בריאות ועבודות, system.configure)

| Key | Default | Range |
|---|---|---|
| `continuous_recorders` | none (only recording faults the recorder reports) | recorder ids whose connected, enabled cameras should record all the time (chips per recorder in the card) |
| `camera_recording` | none (every camera follows its recorder) | NN6B: camera id -> `continuous` or `events`, over the recorder's choice (at most 2000 entries) |
| `recording_gap_min` | 30 | 5–1440 |
| `clock_drift_s` | 60 | 5–3600 |
| `latency_ms` | 1500 | 200–10000 |
| `disk_fill_days` | 0 = off | 0–60 |
| `cert_days` | 30 | 1–365 |
| `recover_s` | 120 | 0–3600 |
| `interval_s` | 60 (6 reads per Provision recorder per pass) | 30–900 |

## 5. Screen

הגדרות › בריאות ועבודות: below the system health report, a "מקליטים" card with one card per recorder (connection, disks,
recording, cameras, clock, certificate; a part the vendor does not report is not shown) and "בדוק עכשיו"; for
system.configure, "ספי התראה למקליטים". Short values only, no explanatory text. Layout guard:
`frontend/tests/layout-recorder-health.spec.ts` (4 skins × light/dark × 10 widths 320–1440: 80 checks, 0 findings);
evidence `docs/design/evidence/cr026/`.

## 6. Tests

`smplwise_vms/backend/tests/test_recorder_health.py` (27, fake device): the adapter read and each disk state, missing disk
and disk alarms, live-shape offline alarm, partial failure, pinned certificate with cached handshakes, device down; fill
projection; threshold validation; notifications for disk locked (hold, fold, recover hold), disk error (critical), disk full
with recording continuing (no fault), recording stopped and back, exception mode, clock drift band, API down keeping the disk
alert open, stale reading, camera disconnect / reconnect via `camera.offline`, certificate expiry, the primary's dedupe with
`nvr.offline`; the API (cards, no secrets in the answer, 403 for an operator, ranges, 422, audit row); Hikvision
reachability-only. Every scenario asserts `fake.writes == []`.

## 7. Owner decisions (2026-10-05)

1. Recording: by default only recording faults the recorder itself reports are alerts. The continuous-recording expectation
   is a per-recorder choice, off by default (many units, the owner's included, record on motion only).
2. The disk-fill forecast is off by default (an overwriting NVR is always full); the setting stays.
3. Hikvision detail comes after Provision; Hikvision recorders show reachability and latency only for now (done in NN6H,
   section 9).

## 8. Live read-only pass (owner's Provision NVR, 2026-10-05)

HTTPS 443, Basic, certificate not verified for this test only; one TLS handshake (no credentials) for the expiry, then six
API reads (GetDeviceInfo, GetDiskInfo, GetRecordStatusInfo, GetChannelList, GetAlarmStatus, GetDateAndTime); no 401, no write.
Result: answering, 250 ms; no part failed; one disk `read/write` with **0 % free** (the unit overwrites - confirms decision
2); no disk alarm; 16 channels, 15 connected, 1 disconnected; 14 recording, 2 idle (motion-only recording - confirms decision
1); clock drift 0 s (NTP); certificate self-signed, about 2,650 days left. No address, account or serial number recorded.

## 9. Follow-ups NN6B and NN6H (branch `pilot/NN6-health-detail`)

**NN6B - continuous expectation per camera.** `camera_recording` (section 4) adds a per-camera choice on top of the
recorder's: `continuous` (expected to record all the time, "not recording for `recording_gap_min`" alerts) or `events`
(never "not recording"; a device-reported exception still alerts). A camera without an entry follows its recorder. Both
stay off by default (owner decision 1 unchanged). Stored in the same `recorder_health.thresholds` JSON value: **no
migration**. `GET|PUT /recorder-health/settings` also answer `cameras` (id, name, recorder, channel of the enabled cameras)
for the card; the card's "לפי מצלמה" section (collapsed) has one choice per camera of a recorder that reports recording
state ("כמו המקליט (רציפה / לא רציפה)" / "רציפה" / "לא רציפה"). The recording section of a card adds `expected` (cameras
expected to record continuously).

**NN6H - Hikvision detail.** `HikvisionAdapter` declares `health_detail` and implements `read_health()` with four GETs per
pass (plus `deviceInfo` for reachability):

| Part | Read | Mapping |
|---|---|---|
| Disks | `/ISAPI/ContentMgmt/Storage` (hdd and NAS) | status ok / idle / sleeping -> ok (property RO -> read-only); unformatted -> unformatted; formating -> formatting; error / abnormal / offline / smartFailed / mismatch / notexist -> error; other words -> unknown (raw word kept). No hdd and no NAS -> missing. |
| Connectivity | `/ISAPI/ContentMgmt/InputProxy/channels/status` | `online` per input channel id (the same read discovery uses) |
| Recording | `/ISAPI/System/workingstatus?format=json` | `ChanStatus.record` 1 -> recording, 0 -> idle. Used only when its channel numbers cover every input channel id (`channel_map_unproven` otherwise: not judged; no channel-number formula is guessed). |
| Clock | `/ISAPI/System/time` | `localTime` read in the recorder's zone (`recorders.time_zone`, else the installation's) with the known summer-offset quirk (`nvr_system.device_instant`); drift against the host clock at the request midpoint. |

Hikvision reports recording / not recording only, never a recording exception: with the owner's default (no continuous
expectation) Hikvision produces no recording alert; disk faults, unreachable / slow, clock drift and camera connectivity
(through `camera.offline`) do. No disk alarm read and no certificate (the ISAPI connection is not pinned). A 403 on one path
is that part only (`errors`); a device that does not answer or refuses the credentials (401) stops the read.

The shapes come from the lab's read-only probe capture of 2026-09-14 (workingstatus JSON, Storage, channel status, time);
no new device call was made for this change. Tests: `smplwise_vms/backend/tests/test_recorder_health_nn6.py` (fake devices,
GET-only assertions); layout and behaviour: `frontend/tests/layout-recorder-health.spec.ts`.
