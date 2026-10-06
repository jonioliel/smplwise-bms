# M024 (T024) and M069 (T069) - test and hardening evidence

Branch `pilot/M024-M069-tests`, advancing version 2.1.0. Measured on the Ubuntu runner (shared lock, load < 12, no gate pending),
fake Home Assistant and fake go2rtc only; nothing live was contacted.

## M024 - 1,000-entity HA sync fixture

Test: `smplwise_vms/backend/tests/test_ha_sync_1000.py` (real `HaSync` session against a generated fake HA: 1,000 entities
over 10 domains, 100 devices, 20 areas on 4 floors; half the entities resolve their area through their device).
Scenario: connect, link drops, HA changes while away (100 states moved, 20 entities deleted, 30 added, 10 area moves),
return and resync, then a burst of 1,000 `state_changed` events.

| Measure | Value |
|---|---|
| first connect, 1,000 entities (registry + states + subscribe) | 1.06 s |
| entity list (`/ha/entities?limit=2000`, 1,000 rows) | 0.47 s cold, 0.08 s warm |
| area tree (`/devices/tree`) | 0.29 s |
| list while disconnected (stale) | 0.08 s |
| reconnect resync with the change set | 0.67 s |
| 1,000 live events (sequential, full handler incl. history + correlation) | 11.3 s (about 89 events/s) |
| Python heap peak (connect + disconnect + return) | 22 MiB |
| process max RSS (pytest + app) | 186 MiB |

Asserted: counts equal 1,000 then 1,010; every row `fresh` while connected and none while disconnected, with state, last_changed
and state_seen_at unchanged (no invented continuity); changed states applied; deleted entities tombstoned (row kept,
`removed_at` set), additions present, moved entities in the new area; tree counts equal the expected per-area counts; the
sequence advances by exactly the number of events.

Findings:
- Informational: the per-subscriber push queue (`ha_sync.subscribe`) is bounded at 500 frames and lossy by design; a subscriber
  that does not drain keeps the first 500 frames of a burst. Clients detect a gap through `sequence` and resync from REST.
- Informational: a state event costs about 11 ms in the handler (`handle_state_event`: upsert, history row, correlation, rules),
  executed on the HA socket's event loop. 89 events/s sustained is far above a normal home; a 1,000-event burst blocks the
  socket loop for about 11 s (ping deadline is 20 s). No defect fixed; worth watching if an installation exceeds ~2,000 entities.
- UI: not touched. The Playwright list-performance spec is NOT_RUN (no UI code changed; the API side is measured above).

## M069 - go2rtc media, exposure, remote-channel checklist

### Big media through the relay
Test: `smplwise_vms/backend/tests/test_go2rtc_big_media.py`. A fake go2rtc WebSocket server streams 120 MiB (one 24 MiB frame,
40 x 2 MiB, 16 x 1 MiB) through the real authorized live route and the real `relay_ws`.

| Measure | Value |
|---|---|
| bytes delivered, SHA-256 compared | 120 MiB, identical, in order |
| relay time (loopback) | 0.15 s (about 800 MiB/s) |
| RSS growth while relaying | 64 MiB (bound 150 MiB; stream not buffered) |
| stop audit row | written, `bytes_down` at least 120 MiB, session left the budget |
| upstream request | pinned `src=smplwise_nvr-1_ch1_main` with the add-on's Basic credentials; the browser supplies neither |

Browser-to-go2rtc direction: `relay_ws` forwards browser frames verbatim; the only frame bound is uvicorn's `ws_max_size`
(16 MiB). A test pins that `python -m smplwise` neither raises nor disables it.

### go2rtc network exposure review (repo side)
| Item | Result |
|---|---|
| host ports mapped by the add-on | PASS: none by default (`ports: 18091/tcp: null` only, the optional alarm push) |
| ports of go2rtc itself (1984 API/UI, 8554 RTSP, 8555 WebRTC) | NOT_RUN: a separate add-on on the owner's host; DOCS now says what must stay private (new section "go2rtc exposure", EN + HE) |
| authentication | PASS: `go2rtc_api_username/password` are sent as Basic on every call; the browser never sees them (test above) |
| only `smplwise_` streams written/deleted | PASS: `Go2rtc.ensure_stream/delete_stream/frame_jpeg` refuse other names (tests/test_media.py::test_stream_naming_and_namespace_guard) and sources are rtsp/rtsps only (source_policy) |
| actual exposure from outside the LAN | NOT_RUN: manual on the owner's host (port scan / router), unchanged owner item 12 |

Finding (documentation gap, fixed): DOCS did not warn that go2rtc's 1984 is unauthenticated by default and can run commands via
`exec:` sources. Added to `DOCS.md` / `DOCS_HE.md`.

### Remote-channel penetration checklist (docs/operations/ARX_REMOTE_PENTEST_HE.md)
Run by `scripts/m069_remote_checklist.py` against the real backend with the remote channel on and a fake HA core (real HTTP,
no tunnel). 14 PASS, 0 FAIL, 10 NOT_RUN.

| # | Result | Note |
|---|---|---|
| 1.1 | PASS (config) | no host port mapped; the LAN probe stays manual |
| 1.2 | PASS | forged `CF-Connecting-IP`: 401 `remote_token_invalid`, audited. Cloudflare overwriting the header: NOT_RUN |
| 1.3 | PASS | 10 x 401 then 429 per address. See finding below |
| 2.1, 2.2 | NOT_RUN | need a real HA `ip_ban` and a phone; in-process coverage: test_remote_access.py (garbage / refused tokens never reach HA) |
| 3.1 | NOT_RUN | Cloudflare Always Use HTTPS |
| 3.2 | PASS | over plain http the non-Secure cookie name is used, no `__Secure-` cookie |
| 3.3 | PASS | `__Secure-arx_session`, HttpOnly, Secure, SameSite=strict, Path=/arx/, no Domain, Max-Age 1799 |
| 4.1-4.4 | NOT_RUN | real browser + real HA tokens; the add-on side of sign-out-everywhere is covered by 5.3 and test_remote_hardening.py |
| 5.1 | NOT_RUN | needs more than 3 idle minutes; covered in-process by test_idle_session_revoked_at_ha_gets_no_request_through |
| 5.2 | PASS | revoked at the (fake) HA while in use: refused after 65 s (the documented limit) |
| 5.3 | PASS | disconnect from the list: old cookie 401, re-exchange refused |
| 5.4 | NOT_RUN | browser idle timer |
| 6.1-6.3 | PASS | same-origin write 200; cross-site 403 `csrf_refused` (beats a matching Origin); no proof 403; Origin-only passes the gate |
| 6.4 | PASS | same-site simple POST with the cookie refused and audited with `sec_fetch_site=same-site`; a real sibling subdomain NOT_RUN |
| 7.1 | PASS | CSP, report-only CSP and Reporting-Endpoints present; Cloudflare keeping them NOT_RUN |
| 7.2 | PASS | 204 / 31st 429 / 20 KB 413 / text/plain 415; stored host only, no query |
| 7.3 | NOT_RUN | needs camera streams; covered by test_remote_live_cap_per_sign_in |
| 7.4 | PASS | bearer client 200, listed, revoked, next request 401 |

Finding (Medium, conditional, existing design): the per-address rate limit and the audit address come from `CF-Connecting-IP`
(then `X-Forwarded-For`). Rotating that header gets 11 of 11 attempts through (401 each), so the 10/min limit and address-based
audit are only as strong as the guarantee that nothing reaches the add-on except through the tunnel (item 1.1, which holds for
the shipped config: Ingress only, no host port). It is not a defect while 1.1 holds; it is why a mapped host port or a second
reverse proxy in front of the add-on must never be added without re-running the checklist.

Findings summary: 0 High, 1 Medium (conditional, design assumption), 2 Informational (M024), 1 doc gap fixed.
