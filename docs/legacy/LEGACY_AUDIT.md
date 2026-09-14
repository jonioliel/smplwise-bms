# LEGACY_AUDIT — Hikvision NVR Panel add-on v1.5.27 (the running system)

**Status:** code audit complete (2026-09-14); runtime characterization partially done with read-only probes
against the production NVR and go2rtc. Items marked *observed in code* have not yet been executed.
**Task:** T001 (R001/R002). **Source snapshot:** `legacy/hikvision_nvr_v1.5.27/` on the local branch
`legacy/import` (owner decision 2026-09-14: the legacy code stays local, not in the public repository).
Zip SHA-256 `E7182A397E0DFDE439CC9822EF8B63DDF53FC21EE1A0542E1FE1DD260FC89F7A`, files dated 2026-04-25.

## 1. What it is

A Home Assistant **add-on** (slug `hikvision_nvr`, Ingress port 8099, `panel_icon: mdi:cctv`), not the
"HikHA NVR" custom integration described by the historical documents in this folder. Owner confirmation:
this exact version is what runs today; live view (HD/SD), recording search, playback and MP4 download work.

| Component | Facts |
|---|---|
| Backend | Python 3.11 (Alpine 3.18 HA base image), FastAPI 0.111.0, uvicorn 0.29.0, httpx 0.27.0, websockets 12.0. One file, `app/main.py`, 3 185 lines. |
| Frontend | One file, `app/static/index.html`, 5 317 lines: vanilla JS, no build step, RTL Hebrew, three themes (dark default). Functions are re-declared in "override layers" (e.g. `renderMaintenance` ×7, `playRec` ×5); only the last declaration is live. |
| Persistence | `/config/hikvision_nvr_override.json` (NVR connection overrides, `camera_names`, `manual_recording`, display-offset settings) and `/config/hikvision_nvr_event_store.jsonl` (max 4 000 rows). Add-on options via `/data/options.json` copied to `/tmp/addon_config.json` by `run.sh`. |
| Auth | Shared numeric PIN (`app_pin`) → in-memory session cookie `hik_session` (60 min sliding). Technician PIN exists but the final frontend override (`ensureTechAccess`) skips it, and `/api/auth/pin` issues the technician cookie together with the main one. |
| Media | Live: go2rtc stream `hik_ch<N>[_main|_sub]` created via `PUT /api/streams` with the NVR RTSP URL **including credentials**; viewed through an `<iframe>` of go2rtc's own Ingress `stream.html` (option `go2rtc_ingress_path`). Playback: go2rtc stream `pb_<track>_<ts>` from the NVR RTSP playback URL; MP4 download through `/api/stream/<track>` (ISAPI `ContentMgmt/download`). |
| Events | Complete UI and three server-side search engines, all behind `EVENTS_ENABLED = False`; owner does not remember why it was disabled. |

## 2. Runtime environment (verified 2026-09-14, read-only)

| Item | Value | Evidence |
|---|---|---|
| NVR | Hikvision DS-7616NXI-K2(D), firmware V4.84.101 build 251212, encoder V5.0, NTP | `private-evidence/nvr-probes/20260914T071715Z/device_info.xml` |
| ISAPI port | **90** (port 80 refused) — matches the add-on default `nvr_port: 90` | probe summary |
| Channels | 10 InputProxy channels (DS-2CD1143G2-LIU, 4 MP), all online; recording tracks 101…1001; streaming ids `<ch>01` (main) / `<ch>02` (sub) | `inputproxy_channels.xml`, `record_tracks.xml`, `streaming_channels.xml` |
| Recording | `workingstatus` shows record=1 on channels 4,7,8,9,10 only (owner: intentional) | `working_status.json` |
| Storage | one 2 TB SATA HDD, status ok, ≈597 GB free; `/Storage/quota` → 403 | `storage_hdd.xml` |
| Time | see `KNOWN_QUIRKS.md` §1 — wall clock correct, offset suffix is the standard offset, search times are local | `system_time.xml`, `time_test_Q*.xml` |
| go2rtc | 1.9.14 (AlexxIT add-on) on the HA host, port 1984, API without authentication, 20 streams | `private-evidence/go2rtc-probes/` |
| HA | Core 2026.9.2, timezone Asia/Jerusalem; integrations present: `hikvision_next`, `hikvision_intercom`, `go2rtc`, `webrtc` | `private-evidence/ha-probes/` |

## 3. Backend module map (`app/main.py`)

| Lines | Area | Notes |
|---|---|---|
| 1–78 | config load, logging, constants | `EVENTS_ENABLED=False`; go2rtc URL default `http://172.30.32.1:1984` |
| 81–124 | override file, `hik_time`, `playback_rtsp`, `normalize_playback_rtsp` | RTSP playback URL builder; rewrites playbackURI port (HTTP→RTSP) and appends `#transport=tcp` |
| 126–160 | XML helpers (`_ns`, `_txt`, `_children_dict[_with_attrs]`) | namespace-agnostic, reusable |
| 163–205 | NVR time parsing | derives offset from `localTime` suffix, POSIX-style `timeZone` fallback |
| 207–269 | NVR config + camera aliases + `track_id_for_channel` (`<ch>01` formula) | |
| 272–370 | generic ISAPI GET → dict, trigger probes, disk tests (SMART / bad sectors, 4 body variants × PUT/POST/GET) | |
| 372–1870 | event subsystem: alertStream splitter/parser, payload normalizer, filters, local JSONL store, logSearch / metadata search / picture search engines with many XML variants, listener loop | disabled in production |
| 1871–1890 | httpx client factory (Digest, base_url, 15 s, follow redirects) | |
| 1892–2004 | in-memory sessions, manual-recording state with auto-stop tasks and persistence | |
| 2006–2116 | PIN / technician auth endpoints | |
| 2118–2229 | public config, display-offset config, NVR config/aliases, `/api/nvr/test`, **generic ISAPI GET proxy** `/api/isapi/{path}` | |
| 2231–2450 | snapshot (3 URL fallbacks), channel status, camera/NVR reboot, storage (+deep), maintenance aggregate | |
| 2453–2676 | manual-recording status, events endpoints (disabled) | |
| 2679–2807 | record tracks/profile/search profile, `_manual_record` (4 method/body variants), start/stop, daily distribution | |
| 2809–2900 | `/api/stream/{track}` ISAPI download proxy (4 XML variants × GET/POST, streams `video/mp4`) | |
| 2902–3070 | go2rtc: add stream, playback stream (credentials injected), list, **WebSocket relay** `/api/go2rtc/api/ws`, generic HTTP proxy | |
| 3072–3079 | `/api/live-stream-url/{ch}` returns RTSP URL **with credentials** to the browser | |
| 3081–3176 | `/api/recordings/search` (paged CMSearchDescription, dedupe) | verified against the NVR |
| 3178–3185 | static files + SPA fallback | |

## 4. Frontend feature inventory (`app/static/index.html`)

- **Login:** PIN pad (masked dots), technician gate (bypassed by final override).
- **Shell:** brand (SmplWise logo), device model, clock, connection dot, theme cycle, maintenance/settings/logout buttons; tabs Live / Recordings (Events tab hidden, Maintenance reachable via button); health chips (cameras, disks, recording).
- **Live:** screen count 1/2/4/6/8/12/16; camera picker with checkbox selection, ordering (▲▼) and draft/apply; grid tile sizing math (`renderGrid`); per-tile WebRTC iframe with muted autoplay or snapshot polling every 2 s with 3-failure backoff and 30 s retry; single-camera overlay player with HD/SD toggle, manual record (duration modal: 5–60 min presets or custom ≤ 24 h), stop, snapshot download; REC badges; side thumbnail list refreshed every 4 s on desktop.
- **Recordings:** camera, date/time range, presets (today/yesterday/week), collapsible search panel; results list with duration badges; canvas timeline (hour gridlines, segments, click-to-play, highlight); summary chips (results, total minutes, range, recorded days from dailyDistribution); player via go2rtc playback iframe (`mode=webrtc,mse,mp4,mjpeg`); MP4 download and RTSP copy buttons; display-offset model (auto/manual/auto+manual with direction and minutes).
- **Events (disabled):** log/pictures modes, camera & type pickers, range presets, page size, split/grid/compact views, detail card with raw fields.
- **Maintenance:** system card (model, serial, firmware, NVR IP/ports/user, timezone, display-offset controls, reboot NVR), active trigger alerts only, recording schedules summary, camera table (rename, reboot, manual record), disk tiles (SMART / bad-sector tests), NVR connection modal.
- **Responsive:** breakpoints at 1280/1100/960/900/800/760/700/520 px; mobile stacks recordings, hides the side list.

## 5. How to run it for characterization (not yet executed)

1. Locally on Windows: create `C:\tmp\addon_config.json`? — no: the code hard-codes `/tmp/addon_config.json` and `/config/...`. Run inside WSL/Linux or a container with those paths mapped, `uvicorn app.main:app --port 8099`, options JSON copied to `/tmp/addon_config.json`. Never point it at production `/config` files.
2. In HA: it is installed as a local add-on and built by the Supervisor from `Dockerfile`.
3. Characterization (T004): drive the legacy endpoints (`/api/recordings/search`, `/api/recordings/daily-distribution`, `/api/stream/<track>`, `/api/nvr/*`) against the NVR and record redacted responses as fixtures; compare with the new adapter on identical inputs.

## 6. Verification ledger

| Claim | Verified? | How |
|---|---|---|
| Search XML shape and pagination work on this NVR | **Yes** | `scripts/lab/nvr_probe.py --search`, three time tests |
| Time semantics (local wall clock, STD mode shift) | **Yes** (one session, DST period) | `time_test_Q1..Q3.xml`; repeat in winter |
| Playback RTSP URL from playbackURI plays through go2rtc | Owner statement + log (go2rtc accepts `pb_*` sources, HTTP 200) | needs T006 measurement of first-frame time |
| Legacy display times are correct | **Open** — log implies an effective +120 min display offset, owner reports +0 | parity question to owner (KNOWN_QUIRKS T5) |
| ISAPI download variant that succeeds | **Yes** (owner log 2026-09-08: variant 1 + GET → 200, `Opaque/data`) | container format still to inspect in T006 |
| Manual record method variant that succeeds | Not verified | T004 (requires write approval) |
| go2rtc API stream persistence | see `docs/operations/G0_INTAKE.md` | `scripts/lab/go2rtc_persistence_probe.py` |
| Events engines | Disabled in production | learn only |

See `REUSE_MATRIX.md`, `KNOWN_QUIRKS.md`, `LEGACY_SECURITY_FINDINGS.md`.
