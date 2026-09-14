# Legacy security findings — document only (owner decision 7א, 2026-09-14)

These findings concern the running add-on v1.5.27 and the lab environment. They are **not** fixed in the
legacy code; each has a corresponding requirement in the new system. Values (addresses, secrets) are
intentionally omitted.

| # | Finding | Where | Impact | New-system requirement |
|---|---|---|---|---|
| 1 | NVR credentials are returned to the browser inside the RTSP URL | `/api/live-stream-url/{ch}` (main.py 3072) and `S.gridStreams` flow | Any logged-in user can read the NVR admin password | Credentials never leave the server; browser gets opaque media handles (ADR-005/011). |
| 2 | Any PIN holder can create/delete go2rtc streams and call any go2rtc API path | `/api/go2rtc/add`, `/api/go2rtc/{path}` proxy | Affects other projects' streams on the shared go2rtc (intercom door stations); go2rtc `exec:` sources could allow command execution on the host | Namespaced streams created only server-side; no generic proxy; allow-listed paths. |
| 3 | Disruptive device actions behind the main PIN only | reboot NVR/camera, SMART/bad-sector tests, NVR connection edit | Technician gate is bypassed by the final frontend override | Sensitive capabilities (`nvr.config.write`, reboot) with explicit grants, confirmation and audit. |
| 4 | Playback streams accumulate in go2rtc with credentials in `src`; never deleted | `/api/go2rtc/playback` | Resource growth; persistence depends on go2rtc version (see G0 intake) | Bounded session pool, leases and cleanup (T016). |
| 5 | PIN lockout keyed by client IP; behind Ingress all users share the proxy IP | `_attempts` in `/api/auth/pin` | One user's typos lock everyone out until restart | HA identity; no PIN. |
| 6 | Default options ship with PINs `1234`/`2468` and an example NVR address | `config.yaml` | Weak defaults | No PIN concept; options schema with `password` types and no defaults for secrets. |
| 7 | NVR password stored in plain JSON under `/config` | `save_nvr` | Readable by any add-on/user with `/config` access | Secrets in add-on options only; nothing secret in `/config`. |
| 8 | `/api/config` is unauthenticated | main.py 2118 | Leaks go2rtc URL/ingress path and PIN policy | Every endpoint authenticated and authorized. |
| 9 | Generic ISAPI GET proxy for any logged-in user | `/api/isapi/{path}` | Reads any NVR configuration (users, network) | Removed; typed adapter only. |
| 10 | `CORSMiddleware(allow_origins=["*"])` and `Access-Control-Allow-Origin: *` on proxied media | main.py 2061, 3054 | Cross-origin reads of authenticated resources are easier | Same-origin only; Ingress path awareness; CSRF checks on state changes. |
| 11 | Sessions are in-memory and unrevocable per user | `_sessions` | Cannot revoke a single user; restart logs everyone out | Server sessions keyed by HA identity with `permission_revision` (T080). |
| 12 | Lab: go2rtc API on the LAN port without authentication; four stream *names* are raw RTSP URLs containing credentials (created by another component); `GET /api/streams` reveals source URLs | go2rtc add-on config | Anyone on the LAN can read the NVR password | Recommend enabling go2rtc API auth and cleaning those names — **owner action, outside this product's scope**; our add-on will support go2rtc basic-auth credentials in its options. |

None of the above is exploitable from outside the LAN without an HA session (Ingress is HA-authenticated);
the residual risk is insider/shared-PIN misuse and LAN exposure of go2rtc.
