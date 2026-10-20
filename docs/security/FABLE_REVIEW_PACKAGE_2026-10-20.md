# Fable security review package - Arx public surfaces (2026-10-20)

Prepared on `pilot/SECFIX2-295` for a Fable review of every surface of SmplWise Arx that answers without an Arx / Home Assistant
identity, plus the two authenticated-app changes that touch browser policy (camera) and the new document links. This file is the
reviewer's starting point: scope and heads, entry points, threat model, what changed since the last review, the test inventory and the
specific questions we want answered. Read-only review requested; no live system, tunnel or phone is in scope (fakes only).

Precedence (AGENTS.md): approved change request -> `MASTER_SPEC_HE.md` and `docs/security/` -> `AGENTS.md`. Contradictions found are to be
recorded as findings, not resolved.

## 1. Heads to review

| Ref | Commit | What it carries |
|---|---|---|
| `origin/main` (2.9.2, tag `v2.9.2`) | c30753f0d | The baseline the last public review (2026-10-20) covered: `private/planning/SECURITY_REVIEW_PUBLIC_2026-10-20.md` (+ `_FINDINGS.json`), done at 586f191b3 / f87e78fcc, no public-surface difference to c30753f0d. |
| `origin/integ/293` (2.9.3 integration) | 90a50db90 (base of the two rows below; integ/293 has since moved to 9b14e158b with no public-surface change known to this package) | SECFIX-293: PUB-01, PUB-02, PUB-05 fixes; PUB-03 / PUB-04 proposals. |
| `origin/integ/2100` (2.10.0 integration) | 9c65a495c | + VENDORQ-294 document links (new public routes and page mode), CAMVF-295 camera viewfinder (authenticated app, header pins), EXTID-295, GRANTSMIN-295 and others (authenticated). |
| `origin/pilot/SECFIX2-295` (this branch) | see the branch report | + PUB-07 guard-first routes, PUB-03 retention + cap (OFF), PUB-04 portal start worker (OFF), the uniform-404 switch for unknown WisKey person records (OFF). Not yet in any integration branch. |

Review integ/2100 for the document links and the camera policy, and pilot/SECFIX2-295 for the four items above; everything else is the
same code on both.

## 2. Scope

In scope (the owner's list):

1. **Ticket public page** - the public listener (container port 18093, tunnel only): handler links, RFQ links, claims, quotes, arrival
   step, consent page, photos / files, map picture, codes.
2. **Vendor portal** - `/t/api/portal/*` (+ VPORTALRFQ sections), its session cookie, the start / verify flow, the start worker (PUB-04).
3. **Document links** - `reports.documents` (CR-VENDORQ-294 section 5): `#d.<token>` page mode, `GET /t/api/doc`, `GET /t/api/doc/file`,
   minting and revocation (`services/tickets/out_documents.py`).
4. **Camera policy headers** - `Permissions-Policy` on the public listener (`camera=()`), the remote channel (`camera=(self)`, CR-008
   3e), Ingress (none from Arx); the opt-in viewfinder `ui.camera_viewfinder` (CR-CAMVF-295) that must never widen a header.
5. **Local identity** - Arx-only sign-in, second factor, set-password links, self-service reset, passkeys (second step and passkey-first),
   `/.well-known/assetlinks.json`.
6. **Remote channel** - `/arx/*` on the main app (8099 via a tunnel path route): identity-header stripping, `BLOCKED_ON_REMOTE`, login
   CSRF, cookie session, body limits, CSP (+ report sink), `client_ip` / trusted proxies, source maps.

Out of scope: the cast relay (18092, CR-028), the Provision-ISR push (18091, device-facing), the HA-bridge pairing routes (local channel,
HMAC), WisKey itself, Cloudflare dashboard configuration (assumptions listed in section 4.4 are in scope as assumptions only), the
mobile shells.

## 3. Entry points

### 3.1 Public listener (S1) - `services/tickets/public_http.py` `ROUTES` is the exact-path allow-list

| Group | Routes | Handler modules | Gate |
|---|---|---|---|
| Shell / assets | `GET /t/`, `/t/r/{rid}`, `/t/assets/*`, `/t/healthz`, `/t/brand/<stamp>.jpg`, bare `/<prefix>` any case | `public_app.py`, `public_prefix.py`, `brand.py` | module switch; prefix mapping with raw-path byte equality |
| Handler link | `/t/api/ticket`, `status`, `note`, `eta`, `return`, `photo` (POST/GET), `map-image`, `code/send`, `code/verify`, `claim`, `claim/file`, `quote`, `redeem` | `public_routes.py`, `public_app.py`, `handler_actions.py`, `public_claims.py`, `public_quotes.py`, `codes.py`, `links.py` | 192-bit token in `X-Ticket-Token`, code session `X-Ticket-Session`, rate gate before any DB read |
| Arrival step | `GET/POST /t/api/arrival` | `services/access_arrival.py`, `access_grants.py` | `access.external_grants` (+ `GO_LIVE_PERMITTED`), RFQ order only; SECFIX2: per-vendor cap (OFF) |
| RFQ link | `/t/api/rfq`, `rfq/quote`, `withdraw`, `decline`, `message`, `arrival`, `code/*`, `file/*`, `upload`, `upload/remove`, `ticket/rfq-file/*` | `public_rfq.py`, `rfq_vendor.py`, `rfq_files.py`, `rfq_vendor_files.py` | token domain `rfq`; vendor uploads behind `rfq.vendor_uploads.enabled` (OFF) |
| Consent | `GET/POST /t/api/consent` | `intercom_consent.py` | token domain `wac` |
| Vendor portal | `/t/api/portal/config`, `start`, `verify`, `items`, `open`, `logout`, `rfqs`, `rfqs/open`, `techs`, `techs/cancel` | `public_portal.py`, `vendor_portal.py`, `portal_more.py` | `vendor_portal.enabled` (OFF); cookie `__Secure-arx_vp` on the portal path only |
| Document link (integ/2100) | `GET /t/api/doc`, `GET /t/api/doc/file`; page mode `#d.<token>` (`frontend/src/public-ticket/doc/`) | `public_documents.py`, `out_documents.py` | `reports.documents` (OFF); token domain `doc`; `token_read` / `file_read` kinds |

### 3.2 Remote channel (S2) - `remote_channel.py`, `auth.py`, `body_limit.py`, `routers/remote.py`

`GET /arx/`, static bundle (source maps 404 since PUB-05), `arx-sw.js`, `healthz`; `GET api/v1/auth/remote-config`, `auth/app-download`,
`auth/app-download/file`; `POST/DELETE api/v1/auth/session`; `POST api/v1/csp-report`; every authenticated `/arx/api/v1/*` route after the
session cookie / bearer is resolved (`auth.resolve_remote_first`).

### 3.3 Local identity (S2, remote only) - `routers/local_identity.py`, `routers/local_passkeys.py`, `services/local_identity.py`, `local_reset.py`, `local_passkeys.py`, `webauthn.py`

`POST auth/local/sign-in`, `sign-in/second-factor`, `set-password`, `reset/request`, `reset/confirm`, `sign-in/passkey/options`,
`sign-in/passkey`, `passkey/options`, `passkey`; `GET /.well-known/assetlinks.json` (root, `main.py`). Since SECFIX2-295 every one of the
nine POST routes is a `GuardFirstRoute` (`smplwise/guarded_route.py`): `_public_guard` runs before FastAPI reads the body.

### 3.4 Camera policy (headers)

| Surface | Header source | Value |
|---|---|---|
| Public listener | `public_http.SECURITY_HEADERS` (edge, every answer) | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| Remote channel | `remote_channel.py` | `camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()` |
| Ingress | none from Arx | the HA frontend governs |
| Viewfinder (integ/2100) | application switch `tickets.settings.ui.camera_viewfinder` (OFF) | no header change (CR-CAMVF-295 section 2) |

## 4. Threat model

### 4.1 Assets

Ticket / RFQ / claim content and attachments; vendor and technician names and phone numbers (directory, `access_pending_contacts`);
handler / RFQ / consent / document tokens and code sessions; portal codes and sessions; Arx-only identities (password hashes, TOTP
secrets, passkey credentials, reset links and codes, sessions); the snapshot bytes of a sent document (a HACCP report); audit integrity
("link opened" lines, device rows); the operator's camera stream; the existence of a person / route / account (enumeration).

### 4.2 Actors

Anonymous Internet client (through Cloudflare); holder of a forwarded or leaked link (ticket, RFQ, consent, document); vendor with a
legitimate link; vendor portal user (a number on file); a peer on the hassio Docker network (another add-on, a misconfigured port
mapping); a signed-in restricted operator (station-scoped) probing ids he may not see; a hostile script in the SPA or in an HTML report;
an attacker with a stolen portal cookie or a phone number (SIM swap).

### 4.3 Trust boundaries

Internet -> Cloudflare -> cloudflared (inside `172.30.32.0/23`) -> the public listener (own thread / loop / pool, exact allow-list) or the
main app's `/arx` path; the hassio network (trusted-proxy set; PUB-10 residual); the main app's local channel (Supervisor Ingress peer);
the WisKey service channel (writes, `intercom_writes.py`); WhatsApp via Home Assistant events (no HTTP receiver); the browser's per-document
Permissions-Policy and CSP.

### 4.4 Assumptions (UNVERIFIED unless stated; challenge them)

1. cloudflared connects from inside `172.30.32.0/23` and sets `CF-Connecting-IP`; the remote channel now believes the header only from a
   trusted peer (PUB-01, `ha_user_auth.client_ip`).
2. A Cloudflare rate-limit rule on `/<prefix>/api/*`, no "Cache Everything", Rocket Loader / Email Obfuscation / Bot Fight OFF, tunnel
   keep-alive < 5 s and pool <= 8 (`docs/user-guide/he/46-tickets_HE.md` part A).
3. Whether Cloudflare buffers request bodies decides whether body-phase costs are reachable from the Internet (`CR-038-PUBLIC-CORE-NOTES.md` 8).
4. HSTS on `/arx` is Cloudflare's; the public listener sends its own.
5. `GO_LIVE_PERMITTED = False` and the eight WisKey switches OFF in every build until the owner says "activate".

## 5. What changed since the last review (2.9.2, 2026-10-20)

| # | Change | Where | Default | Tests |
|---|---|---|---|---|
| C1 | PUB-01: `client_ip` believes `CF-Connecting-IP` / first `X-Forwarded-For` only from a trusted-proxy peer | `services/ha_user_auth.py` (SECFIX-293 7f9ca7f25) | on | `test_client_ip_trusted_proxy.py` |
| C2 | PUB-02: a pre-code open of a code-protected ticket link writes no "opened" line and no device row (mirrors the RFQ page) | `public_routes.py` (dd9a34198) | on | `test_tickets_s4_public.py` |
| C3 | PUB-05: the remote channel answers 404 for `*.map` | `remote_channel.py` (98bb37902) | on | `test_remote_sourcemaps.py` |
| C4 | Document links: minting, snapshot table (migration 0128 on integ/2100), token domain `doc`, two public routes, the `#d.` page (blob download), HTML report filter `_HTML_FORBIDDEN` | `out_documents.py`, `public_documents.py`, `public_http.py` ROUTES, `links.py`, `frontend/src/public-ticket/doc/` (VENDORQ-294) | `reports.documents` OFF | `test_vendorq_294_documents.py`, `_migration.py`, `_reports.py`, `unit-public-doc.spec.ts` |
| C5 | Camera viewfinder (authenticated app), header pins for every public route, the remote channel and Ingress | CAMVF-295, `docs/changes/CR-CAMVF-295-SECURITY.md` | `ui.camera_viewfinder` OFF | `test_camera_viewfinder_policy.py`, `test_tickets_public_camera_header.py`, `unit-camera-viewfinder.spec.ts`, `evidence-camera-viewfinder.spec.ts` |
| C6 | PUB-07: guard before body on the nine local-identity / passkey public routes (`GuardFirstRoute`) | `smplwise/guarded_route.py`, `routers/local_identity.py`, `routers/local_passkeys.py` (SECFIX2-295) | on (no switch) | `test_secfix2_pub07_guard_first.py`, `test_local_identity.py` |
| C7 | PUB-03: retention janitor for undecided vendor-typed technicians + per-vendor cap | `services/pending_retention.py`, `access_arrival._new_technician`, `access_grants` settings (SECFIX2-295) | both OFF (`0`) | `test_secfix2_pub03_pending_retention.py` |
| C8 | PUB-04: portal `start` work on the listener's own worker thread (bounded queue, silent counted drop) | `public_portal.py` `StartWorker`, `public_server.stop` (SECFIX2-295) | `vendor_portal.start_worker` OFF | `test_secfix2_pub04_portal_start_worker.py` |
| C9 | Uniform 404 for a restricted writer and a malformed WisKey person record he cannot see | `intercom_writes.check_person` / `unknown_station_refusal`, `intercom_authority.UNKNOWN_PERSON_UNIFORM_404` (SECFIX2-295) | `access.unknown_person_uniform_404` OFF (today's 403) | `test_secfix2_unknown_person_404.py` |

Open from the last review, unchanged here: PUB-06 (no limiter on `remote-config`), PUB-08 (assetlinks route unreachable by tunnel design),
PUB-09 (`remote.csp_enforce` owner action), PUB-10 (trusted-proxy CIDR narrowing, owner action), PUB-11 (portal cookie not client-bound,
accepted), PUB-12 (Cloudflare controls unverified).

## 6. Test inventory (backend unless noted; all fakes, no live system)

| Surface | Test files |
|---|---|
| Public listener core | `test_tickets_public_app.py`, `test_tickets_public_server.py`, `test_tickets_public_prefix.py`, `test_tickets_public_multipart.py`, `test_tickets_public_logs.py`, `test_tickets_public_theme.py`, `test_tickets_s4_public.py`, `test_tickets_rfq_public.py`, `test_intercom_consent_link.py`; frontend `unit-public-ticket*.spec.ts`, `evidence-public-ticket.spec.ts` |
| Arrival step | `test_access_arrival.py`, `test_needs_review.py`, `test_secfix2_pub03_pending_retention.py` |
| Vendor portal | `test_tickets_vendor_portal.py`, `test_tickets_vendor_portal_more.py`, `test_secfix2_pub04_portal_start_worker.py`, `test_gate_hygiene.py` (safe defaults) |
| Document links (integ/2100) | `test_vendorq_294_documents.py`, `test_vendorq_294_migration.py`, `test_vendorq_294_reports.py`; frontend `unit-public-doc.spec.ts` |
| Camera policy (integ/2100) | `test_tickets_public_camera_header.py`, `test_camera_viewfinder_policy.py`; frontend `unit-camera-viewfinder.spec.ts`, `evidence-camera-viewfinder.spec.ts` |
| Local identity | `test_local_identity.py`, `test_local_identity_units.py`, `test_local_passkeys.py`, `test_local_reset.py`, `test_secfix2_pub07_guard_first.py` |
| Remote channel | `test_remote_access.py`, `test_remote_hardening.py`, `test_remote_auth_first.py`, `test_remote_admins_default.py`, `test_remote_sourcemaps.py`, `test_client_ip_trusted_proxy.py`, `test_body_limit.py` |
| WisKey write gate (C9) | `test_secfix2_unknown_person_404.py`, `test_permovr_293.py`, `test_wiskeyarx_291.py`, `test_intercom_writes_s11.py`, `test_intercom_authority.py` |

Last known results: the SECFIX2-295 branch report carries PASS / FAIL / NOT_RUN with counts for the files it ran. The integ/2100 rows are
as reported by their branches (CAMVF-295 commit 662000fa9: 166 backend passed incl. the two camera files; VENDORQ-294: see its branch
report) - re-run on the reviewed head before relying on them. NOT_RUN anywhere: real Cloudflare tunnel, real phones (Android / iOS /
Companion), real WhatsApp, the Linux add-on image.

## 7. Specific questions for the reviewer

### Ticket public page / arrival
- Q1. PUB-02 now skips `record_open` before the code. Is there any other pre-code write left on the handler, RFQ or consent paths
  (timeline rows, device rows, `last_seen`, idempotency rows) that a link holder without the code can trigger?
- Q2. The arrival cap (C7) answers `429 rate_limited` after `handler_actions.claim` ran in the same transaction (rolled back by the plain
  `Exception`). Confirm nothing of the refused request survives (idempotency row, audit, budget) and that a replay of the same
  `client_request_id` cannot bypass the cap.
- Q3. The retention janitor (C7) erases with `actor=None` through `contacts.erase_checked` and `mark_revoking`. Is an audit row without an
  actor acceptable for the audit trail, and can a race with a manager's accept in between the read and the erase transaction erase an
  accepted technician? (`_erasable` re-reads inside the erase transaction.)

### Vendor portal
- Q4. With `start_worker` on (C8), is the remaining observable difference between a known and an unknown number only the worker's
  database write lock contention seen by OTHER requests? Is a 64-deep queue with silent drop the right trade (a flood suppresses real
  codes; no 429 by design)? Should the drop count be exposed to the administrator?
- Q5. `worker_for(db)` keys workers by `id(db)`; the listener stops them all on `stop()`. Any lifetime / restart hazard (a job holding a
  stale `Database` after a restore or a module-key rotation)?
- Q6. PUB-11: is a 30-minute, read-only, non-client-bound portal cookie still acceptable now that VPORTALRFQ adds writes (`techs`,
  `techs/cancel`)?

### Document links (`reports.documents`)
- Q7. The page downloads through a `blob:` URL created on the public listener's origin with `download=`. If a browser ignores `download`
  and navigates to a `text/html` blob, the report renders on the listener origin. Does the listener CSP reach a blob document (CSP3
  inheritance for local schemes) in the browsers we support, and is `_HTML_FORBIDDEN` (regex) a sufficient second line? Would serving
  HTML reports as `application/octet-stream` (or wrapping in a sandboxed response) be safer?
- Q8. `GET /t/api/doc/file` spends one of `document_max_opens` per download with compare-and-set. Can a link holder exhaust the opens to
  deny the real recipient, and is that acceptable for a 72-hour, 5-download link?
- Q9. `X-Document-Digest` exposes the SHA-256 of the snapshot to every holder of the link. Any linkage / confirmation risk for small
  templated reports?
- Q10. Confirm the token domain separation (`tkt` / `rfq` / `wac` / `doc`) and that the `#d.` fragment parser can never hand a document
  token to a ticket route or the reverse.

### Camera policy
- Q11. The remote channel keeps `camera=(self), microphone=(self)` while nothing uses the microphone and the viewfinder is OFF (CAMVF
  decision 1). Recommend whether the remote header should follow `ui.camera_viewfinder`, given the same-origin WisKey panel.
- Q12. Are the header pins (`test_camera_viewfinder_policy.py`, `test_tickets_public_camera_header.py`) complete - every public route
  including errors, the uniform 404, 431 / 400 edge answers and the brand image?

### Local identity
- Q13. `GuardFirstRoute` (C6) overrides `APIRoute.get_route_handler`. On FastAPI 0.141 the included router keeps the original route
  object (`_IncludedRouter`), so the override runs. Is this robust against FastAPI upgrades, and is the end-to-end test (malformed body on
  the local channel = the same 404) the right guard rail? Should the same class cover any other public JSON route on the main app
  (`auth/session`, `csp-report`)?
- Q14. The guard runs a database read (`li.enabled_db`) on the event loop before the body is read - unchanged in cost from before. Is an
  unauthenticated request able to make this read expensive (lock contention) before `body_limit` and the per-route limiters?
- Q15. Re-check the uniform-answer claims (401 `sign_in_failed`, 202 reset request, 422 `code_invalid`, 401 `passkey_invalid`) for timing,
  now that the passkey-first pool and the reset sender thread are in place.

### Remote channel
- Q16. PUB-01: with `client_ip` trusting only proxy peers, is `limit_ip` keying (the /24 or /48 bucket) still correct for IPv6 clients
  behind Cloudflare, and are all per-address limiters (`hua.LIMITER`) now immune to a spoofing hassio peer?
- Q17. PUB-06: `remote-config` has no limiter and one read connection per call. Low or worth fixing now?
- Q18. Is the cookie-bearing CSRF rule (`Sec-Fetch-Site: same-origin` or a matching `Origin`) complete for every state-changing method,
  including `DELETE auth/session` and `PATCH` routes?

### WisKey write gate (authenticated, existence oracle)
- Q19. With `access.unknown_person_uniform_404` on (C9), compare every answer a restricted writer can obtain for (a) an unknown id, (b) a
  malformed record he cannot see, (c) a well-formed record on a foreign station: status, body, headers, audit rows, timing (one
  `users/get` in each case?). Any remaining oracle (e.g. the editor route, the revision 409, capture start)?
- Q20. Should the default flip to the 404 (the read side already hides such records), or does the 403 carry operational value for a
  restricted operator whose own person has a malformed record?

## 8. Deliverable requested

`docs/security/SECURITY_REVIEW_FABLE_PUBLIC_<date>.md` + `_FINDINGS.json` in the format of the 2026-10-20 review (ID, severity, evidence
file:line at the reviewed head, exploit scenario, recommended fix, effort), a verdict per question of section 7, and an explicit list of
what was NOT verified. Fakes only; no live device, tunnel or account.
