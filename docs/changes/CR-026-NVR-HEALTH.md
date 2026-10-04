# CR-026 — Recorder health monitoring (Provision-ISR first, any vendor through the adapter seam)

Status: implemented on `pilot/nvr-health` (base `pilot/provision-wiring`), target release 2.0.0. Fake-device tests only; the
live read check was BLOCKED (TLS handshake to the lab NVR timed out from the workstation; no credentials were sent).
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
| Free space trend | — | samples every 10 min for 48 h, least squares over ≥ 6 h | `recorder.disk_space` (info) when full within `disk_fill_days` |
| Recording per channel | — | `GetRecordStatusInfo`: recording / no recording / exception | `recorder.recording` (alert, subject = the camera) |
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
| `recording_mode` | `continuous` (every connected, enabled camera should record) | `continuous` / `exceptions` (device-reported faults only) |
| `recording_gap_min` | 30 | 5–1440 |
| `clock_drift_s` | 60 | 5–3600 |
| `latency_ms` | 1500 | 200–10000 |
| `disk_fill_days` | 3 (0 = off) | 0–60 |
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

## 7. Open points (owner)

1. Default recording expectation: `continuous` alerts on a motion-only camera that is quiet for 30 minutes.
2. Whether the free-space trend alert should exist at all for overwriting NVRs (default on, 3 days).
3. Hikvision detail (HDD status / recording state via ISAPI) is not implemented; Hikvision recorders show reachability only.
4. Live validation on the owner's NVR (one read pass, ~6 requests) once it is reachable from the workstation.
