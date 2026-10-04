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

---

## סיכום בעברית

**מה נבנה (שלב 1, בלי ציוד אמיתי):** מתאם Provision-ISR לקריאה בלבד מעל מהדורה 1 של ה־API, מאחורי ממשק הספקים הקיים:
התחברות (זיהוי אוטומטי של שיטת האימות), פרטי מכשיר ומצב, גילוי ערוצים עם שמות, הגדרות קידוד של כל זרם, האפשרויות של כל
זרם, כתובת וידאו חי ל־go2rtc, תמונת מצב, דיסקים, מצב הקלטה, שעון המכשיר, ואירועים בדגימה כל 2 שניות (תנועה, קו, פריצה,
חבלה, כניסות, מצלמה מנותקת). כל פקודה שאינה קריאה נחסמת עוד לפני שליחה. 30 בדיקות מול מכשיר מדומה.

**מה לא נבנה ולמה:** חיבור למסכים, ל־go2rtc ולזרם האירועים (מחכה למיזוג ניהול מספר מקליטים, כדי לא לחווט פעמיים);
כתיבת הגדרות (שלב 2, מאחורי שערי האישור הקיימים, אחרי בדיקה על המכשיר); ניגון (שלב 3); מהדורה 2 (שלב 4); דחיפת
אירועים מהמכשיר (דורשת כתיבה למכשיר ופורט נכנס — החלטה שלך); PTZ, דיבור, יציאות התראה ואתחול (פעולות פיזיות).
