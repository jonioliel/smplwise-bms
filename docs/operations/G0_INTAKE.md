# G0 intake — status 2026-09-14 (local workspace `C:\cloude\smplwisebms`, branch `g0/intake`)

| Input | State | Closure evidence |
|---|---|---|
| Working legacy repository + exact commit | **Obtained** | Add-on v1.5.27 zip (SHA-256 `E7182A39…89F7A`), imported unchanged on local branch `legacy/import` (commit `ab19bf1`); owner confirms it is the running version. Not published (owner decision). Audit: `docs/legacy/LEGACY_AUDIT.md`, `REUSE_MATRIX.md`, `KNOWN_QUIRKS.md`. |
| NVR model/firmware/codec/tracks | **Verified (read-only)** | DS-7616NXI-K2(D), V4.84.101 build 251212, ISAPI port 90, 10 channels H.264 2560×1440, tracks 101…1001; captures in `private-evidence/nvr-probes/20260914T071715Z/` (unredacted, local only). Source-time samples: `time_test_Q1..Q3.xml` (see KNOWN_QUIRKS §1). |
| HA version and identity/permissions path | **Partially verified** | Core 2026.9.2, tz Asia/Jerusalem, integrations `hikvision_next`, `hikvision_intercom`, `go2rtc`, `webrtc`. Owner token = non-admin user `codex` (Supervisor API 401) → usable as the ordinary-user test identity. Supervisor/OS versions, Ingress header names and proxy address: **open** until the add-on skeleton is installed (T009/T081); needs SSH or an admin action by the owner for installation. |
| External go2rtc version/config behaviour | **Verified** | 1.9.14 (AlexxIT add-on) at the HA host, 20 foreign streams (cameras, intercom door stations, hikvision_next). API PUT persists to `/config/go2rtc.yaml`, DELETE removes; probe stream cleaned up (`private-evidence/go2rtc-probes/…/verdict.json`). Restart behaviour: open (needs add-on restart approval). |
| Playback accuracy and source anchor | **Not verified** | Owner statement only (legacy playback/download work). T006 plan in ADR-013. |
| Secrets outside repository | **Done** | `secrets/lab.env` (gitignored; `git check-ignore` verified). Probe scripts redact hosts, serials, MACs and credentials before printing; raw captures stay in `private-evidence/`. |
| Lab changes/physical actions approval | **Scoped** | Read-only by default. Approved 2026-09-14: bounded go2rtc writes in the `smplwise_` namespace (probe stream, playback slots for T006). Not approved: NVR writes (manual record tests, reboot, disk tests), go2rtc restart, HA changes, physical actions. |
| AI/cloud usage budget and privacy consent | **Not needed in G0** | Development runs in a Claude Code session; no paid API calls or cloud uploads planned. Plan-normaliser AI (T060) needs its own consent later. |

## Tooling (workstation)
Python 3.12.10 (per-user), Node 24.21.0 + npm 11.19 (fnm), git 2.54.0; venv `.venv` with httpx.
`python scripts/project_status.py` → PASS on the baseline registry.

## Access inventory
| System | Address (see `secrets/lab.env`) | Auth | Status |
|---|---|---|---|
| NVR ISAPI | `NVR_HOST:90` | Digest, admin account (owner will create a dedicated non-admin account later) | reachable |
| go2rtc API | `GO2RTC_URL` | none configured | reachable |
| HA REST/WS | `HA_URL` | long-lived token, user `codex` (non-admin) | reachable |
| HA host SSH | port 22 open, add-on disabled by owner | key `smplwise_ha_ed25519` prepared | not available yet |

## `secrets/lab.env` template
```
NVR_HOST=            NVR_HTTP_PORT=90   NVR_RTSP_PORT=554   NVR_USER=   NVR_PASSWORD=
GO2RTC_URL=          GO2RTC_API_USER=   GO2RTC_API_PASSWORD=
HA_URL=              HA_USERNAME=       HA_TOKEN=
HA_SSH_HOST=         HA_SSH_PORT=22     HA_SSH_USER=root    HA_SSH_KEY=
```

Read-only does not mean unlimited: bound search windows, probes, streams and exports so the NVR keeps
recording. Capture API methods as observed, not guessed from archived endpoint tables. Never commit
secrets or identifiable camera frames.
