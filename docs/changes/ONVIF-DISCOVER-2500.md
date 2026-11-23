# ONVIF-DISCOVER-2500 - camera discovery phase 1: the backend scan

Branch `pilot/ONVIF-DISCOVER-2500` (from `main` @ 619f94d04, v2.47.0). Target: the 2.5x series. Design
`docs/design/onvif-discovery-2412/DESIGN.md` on `pilot/FEATURE-DESIGNS-SEC-2490` (sections 4, 8, 9, 13 owner decisions 2026-11-22,
14 build rows). This is the **ONVIF-DISCOVER** row only. No route, no wire model, no migration, no UI (ONVIF-API / ONVIF-UI rows).
No device, camera, recorder, go2rtc, Supervisor or lab network was contacted: every test runs on fakes (below).

## What

`smplwise/services/camera_discovery/` (new package):

| Module | Content |
|---|---|
| `wsd.py` | the WS-Discovery `Probe` (fixed template: a fresh `uuid:` MessageID and one of two fixed type lists) and the defensive `ProbeMatches` reader: 64 KiB cap, no DOCTYPE / ENTITY, UTF-8 only (`xmlsafe`), depth <= 32, <= 2000 elements, <= 8 matches, bounded and cleaned scopes / values; `same_host_xaddrs` keeps only plain http(s) service addresses to the very address that answered (SSRF guard D1); `classify` -> `camera` / `nvr` / `unknown` |
| `ranges.py` | the site's own network (Q56): the HA host's interface networks from the Supervisor `GET /network/info` (new read-only entry in `self_update.ALLOWED`), RFC 1918 IPv4 only (not the Supervisor bridge 172.30.32.0/23, not CGNAT / overlay VPN, not public, link-local or documentation ranges - `ipaddress.is_private` alone would accept 192.0.2.0/24), cached 60 s; `plan()` accepts a range only inside a site network, at most 1,024 addresses (and at most the `cameras.discovery_range_max` setting), narrowed by `cameras.discovery_allowed_ranges`; no known site network = every range refused (`site_network_unknown`) |
| `sweep.py` | the unicast sweep (Q55): one UDP socket, Probe to port 3702 of each address, paced (`rate_pps`, default 50/s, shared token pacer), two rounds (round 1 `dn:NetworkVideoTransmitter` to all; round 2 `tds:Device` only to the silent addresses - recorders that advertise only `tds:Device`, and a second chance for a lost datagram), listen window 4 s, deadline 10 min, cancellation checked between datagrams and every 50 ms while listening. Answers accepted only from a probed address and, when `RelatesTo` is present, only for the probe sent to that same address. Optional HTTP fallback (setting, off): ONE unauthenticated `GetSystemDateAndTime` to port 80 of each silent address, 8 workers, same pacing |
| `onvif_http.py` | the two device-service reads: `GetSystemDateAndTime` (no credentials: the device clock) and ONE `GetDeviceInformation` with a WS-Security UsernameToken PasswordDigest built on the device's clock; closed `ALLOWED_ACTIONS` (Get* only, design D9); 64 KiB cap read in chunks, no redirects, 3 s timeout, no proxy env; outcome codes only (`ok`, `wrong_password`, `digest_required`, `no_answer`, `not_onvif`); the serial is returned only for the keyed fingerprint (not in `repr`) |
| `known.py` | known-device marks: `standalone` (host of a camera without a recorder, from the masked display address), `behind_recorder` (address a recorder reported for a channel - in memory, see below - or a recorder camera's manual source host, or after identification its keyed fingerprint), `recorder` (the host of a configured recorder connection, or after identification the keyed recorder identity). Same HMAC formulas as `autosync.fingerprint` / `device_identity` (a test pins them equal) |
| `service.py` | `MANAGER`: the scan job (memory, TTL), the credential rules, limits, RBAC, audit. `start_scan`, `get`, `cancel`, `identify`, `capabilities`, `credentials_for` (for the ONVIF-API add step). `Identifier` protocol: the ONVIF-CLIENT row plugs its fuller client in here without changing the attempt rules |

Small changes outside the package:
- `services/nvr.py`: `DiscoveredChannel.device_address` (repr=False) from `sourceInputPortDescriptor/ipAddress` (or `hostName`).
- `services/autosync.py`: after each recorder discovery, `known.note_channel_hosts(recorder_id, addresses)` - memory only, never stored,
  never logged; names are dropped (never resolved for this).
- `services/self_update.py`: `("GET", "/network/info")` added to the Supervisor allow-list (read only; matches the Supervisor's default
  role pattern `/.+/info`); `tests/test_self_update_s3.py` exact-set updated.

## Owner decisions applied (2026-11-22)

| # | Decision | Where |
|---|---|---|
| Q55 | Arx probes each address directly (unicast); go2rtc / bridge are not engines now | `sweep.py`; `service.ENGINES = ("unicast",)` (+ `http` fallback only when its setting is on) |
| Q56 | Only the site's own network, up to 1,024 addresses; no arbitrary private range | `ranges.plan` (MAX_ADDRESSES 1024 can never be lifted by a setting) |
| Q57 | Same user / password allowed for all; one attempt per camera, never repeated automatically | `Manager.identify` / `_attempt`: one `GetDeviceInformation` per device per press; a refused pair is not sent to that device again in the scan (keyed digest, memory); guard 3 refusals / 15 min per camera address across scans -> `locked_guard` without contact; at most one authenticated request in flight per camera (`busy`); more than one device needs `same_for_all` |
| Q58 | Cameras behind the recorder are marked and cannot be added | `known` = `behind_recorder` -> `addable: false`; never sent the password (`auth: skipped`) |
| Q59 | A recorder-looking device: "add as a recorder" in the recorder wizard | `kind: "nvr"` (types / scope types NetworkVideoStorage / NVR..., model families DS-7/8/9xxx, iDS-, NVR / DVR / XVR / HCVR / NVS); not addable, not sent the camera password. The wizard pre-fill payload itself is the ONVIF-API row |
| Q60 | No weekly notice | no periodic job, no notification source (a test greps the package for a worker) |
| Q61 | No recorder channel writes | nothing in the package writes to a recorder, a camera or go2rtc (test) |

## Design choices (where the design left room)

1. **Who may scan**: `system.configure` at the installation, checked by every entry point (`rbac.require`: audited 403). A job is
   visible / identifiable / cancellable only by its starter or a system administrator (another holder gets 404 `scan_not_found`, no
   existence leak).
2. **Result kind** is `camera | nvr | unknown` (the brief's `nvr`; the design sketch said `recorder`). `known` adds `recorder` (this
   installation's own recorder) next to the design's `none | standalone | behind_recorder`.
3. **Round 2 asks `tds:Device`** instead of repeating round 1: catches recorders that do not call themselves video transmitters and
   still serves as the UDP retransmission.
4. **Unauthenticated clock first**: before the one credential attempt the device's `GetSystemDateAndTime` is read (not a credential
   attempt); a device that does not answer it as ONVIF is never sent the password (`no_answer` / `not_onvif`).
5. **HTTP Digest is not attempted** by this row (`digest_required` is reported and counted toward the guard). The design's "try HTTP
   Digest once in the same press" belongs to the ONVIF-CLIENT row's identifier.
6. **Credentials** live only on the device object inside the job, only after `ok` and only for an addable device; wiped on cancel and
   expiry. Never in a view, an audit row, a log line or an error.
7. **Settings** are read raw with design defaults and clamped (`cameras.discovery`, `_range_max`, `_allowed_ranges`, `_rate_pps`,
   `_http_fallback`, `_job_ttl_min`); registering them in `settings_store.DEFAULTS` with PATCH validation is the ONVIF-API row.
8. **Limits**: one running scan per installation (409 `scan_running`); 6 scans / hour / installation and 3 / 10 min / person (429
   `rate_limited` + `retry_after_s`); 20 identification presses / 10 min / person; at most 64 devices per press; 2048 devices per job.
   `ScopedRateLimiter` in memory (scopes `camera_discovery`, `camera_discovery_auth`).
9. **Audit**: `camera.discovery.scan` one row per scan, written at start (range, addresses, engines, rate) and completed in place at
   the end (state, found / cameras / recorders / unknown / known / addable, sent, answers, rejected, duration); every refused start
   is a `denied` row with the reason (`discovery_off`, `scan_running`, `range_*`, `site_network_unknown`, `rate_limited`).
   `camera.discovery.identify` one row per press (devices, same_for_all, results by class - no user name). `camera.discovery.cancel`.
10. **Threads / DB**: the sweep runs on its own daemon thread with no database connection; identification runs under
    `db.unlocked(conn)` on a 4-worker pool, so no device call ever holds the SQLite write lock.

## Tests

`tests/test_camera_discovery_2500.py` with `tests/fixtures/fake_onvif.py` (a fake UDP network + an httpx.MockTransport ONVIF device
service that verifies the PasswordDigest against the device clock, can lock its account, records every action). One test uses a real
UDP socket pair on 127.0.0.1 only. Addresses: a made-up RFC 1918 network 10.77.0.0/24 (a site network must be RFC 1918, see below); users, passwords, serials made up; secrets grepped in answers, audit rows and
logs.

41 tests: the probe template; ProbeMatch reading (scopes, several matches, missing / foreign / IPv6 / named / user-info XAddrs);
7 hostile datagrams (empty, oversize, DOCTYPE, UTF-16, deep, not ProbeMatches, not XML); recorder recognition; site networks from
`/network/info`; the range rules (Q56, 1,024 cap not liftable, allow-list narrows only, fail closed); the Get-only allow-list (and a
source scan that every built action is in it); the PasswordDigest formula; device reads incl. a clock 10 min ahead, digest-only,
oversize / DOCTYPE / redirect answers; the sweep (two rounds, pacing measured, round 2 only for silent addresses, spoofed / stray
answers, cancel, deadline, HTTP fallback concurrency <= 8 and GetSystemDateAndTime only, a real loopback UDP pair); fingerprints equal
autosync's; channel addresses from `sourceInputPortDescriptor`; the scan job (marks, counts, one audit row completed in place, RBAC
403s audited, refusals audited with nothing sent, fail-closed site network, capabilities, one running scan + cancel, rate limits, TTL
wipes credentials); identification (same password for all = one GetDeviceInformation per camera; behind-recorder / recorder never
contacted; the refused pair never resent; a new pair = one more attempt; guard: 3 refusals then `locked_guard` without contact, also
across scans, the camera's own lock never reached; fingerprint marks after identification; input rules; press rate limit); no
periodic job and no write path in the package. Every secret-bearing test greps answers, audit rows and the log.

| Run | Where | Command | Result |
|---|---|---|---|
| discovery tests | PC, main `.venv` Python 3.12.10 | `python -m pytest -q -p no:cacheprovider tests/test_camera_discovery_2500.py` | 41 passed (41 dots, no failure) |
| pyflakes lane | runner | `python -m ruff check smplwise` (ruff 0.17.5) at f55518ad7 | All checks passed |
| touched areas | runner slot A (`flock ~/.smplwise-tests.lock nice -n 19`) | discovery + `test_self_update_s3`, `test_self_update`, `test_singletons_registered`, `test_autosync`, `test_source_policy`, `test_camera_sources_2410`, `test_nvr_system` | RUNNER_RESULT |

On the PC the touched-area set did not finish inside 900 s (the workstation was loaded; `test_self_update_s3` alone ran for minutes)
- that PC attempt is NOT a result; the runner row is.

## Known limits / not done here

- Routes, wire module, generated types, settings registration, preview form of `/cameras/source/test`, batch add, origin migration:
  ONVIF-API. UI: ONVIF-UI. Media profiles / stream URIs / HTTP Digest: ONVIF-CLIENT. Lab read-only run: ONVIF-LAB-DOCS (needs the
  owner's per-step approval).
- `behind_recorder` by address needs a recorder that reports `ipAddress` in `sourceInputPortDescriptor` (Hikvision ISAPI) and a
  recorder discovery since the add-on started (memory only); otherwise the fingerprint mark after identification is the fallback.
  A camera behind a recorder's PoE switch is usually not reachable from the LAN at all.
- A standalone camera or recorder configured by host NAME is matched only through the scan's bounded resolver (recorders) or not at
  all (standalone display addresses).
- Real-device behaviour (unicast Probe answered through the add-on's NAT, vendor fault shapes) is NOT_RUN: fixtures only.

## Rollback

Code only. Revert the branch; nothing is stored (no migration, no setting written), the Supervisor allow-list entry is read only.
