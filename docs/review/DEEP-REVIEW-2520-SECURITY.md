# DEEP-REVIEW-2520-SECURITY - authentication and authorization of the backend as it will ship in 2.52

Owner request 25.11 ("deep review round of all the code and its improvements"), area SECURITY. Reviewed source: `origin/release/2520-train`
at `eadaa25b81c0e65c86d8aa6ff5f108816bcc7c2d` (read-only; this branch changes this one file). Scope: identity (Ingress, Arx-only
identities), sessions and cookies, the remote channel, tokens, the second factor (authenticator code, recovery codes, passkeys, phone
keys and their attestation, step-up, the factor policy, the administrator's reset), RBAC and scopes, the audit of security events, rate
limits, CSRF / origin checks, secrets and backup / restore exposure.

Method: the code paths were read end to end (`auth.py`, `remote_channel.py`, `rbac.py`, `audit.py`, `routers/remote.py`,
`services/ha_user_auth.py`, `services/local_identity.py` and its router, `services/local_reset.py`, `services/step_up.py`,
`services/second_factor.py` (lockout, verify, policy), `services/device_keys.py` and its router, `services/device_key_attestation.py`,
`services/device_attestation.py`, `services/passkey_sign_in.py`, `services/user_passkeys.py`, `services/webauthn.py`,
`services/access_tokens.py` and its router, `services/mfa_provenance.py`, `services/app_session.py`, `services/backup.py` (the table
and settings lists, restore) and `routers/backup.py`, `routers/backup_offbox.py` (the routes and the credential handling), the WebSocket
identity helper in `routers/media.py`). Earlier rounds were read first (`docs/security/MFA-REVIEW-2520.md`, the 2.4.x / 2.2.0 security
reviews, `docs/changes/MFA-SECFIX-2500.md`); nothing listed there is repeated here. No lab, no Home Assistant, no device.

What was actually run (on the PC, one small process each):

| Check | Result |
|---|---|
| SEC-1: a temporary pytest file (one test, the fixtures of `tests/test_mfa_reset_hardening_2510.py`; deleted afterwards, not committed) - 24 wrong codes in `X-Arx-Second-Factor` on the restore and the system-administrator binding routes with step-up on | every answer 400 `second_factor_invalid`, never 429; `auth_totp_failures` empty; `FAILURES.locked` False (`FAIL_MAX` = 5) - **the finding is reproduced** |
| SEC-2: a standalone script against `device_key_attestation.verify_chain` with a generated chain (pinned test root -> intermediate CA -> end-entity "device key" certificate with `CA:FALSE` -> a forged leaf signed by that end-entity key) | `Result(attested='hardware', level='tee', reason=None, ...)` - **the finding is reproduced** |
| SEC-3 .. SEC-8 | NOT_RUN - confirmed by reading the code path end to end (file:line below) |

## Summary

| Id | Severity | Title | Where (at the reviewed head) |
|---|---|---|---|
| SEC-1 | high | A wrong code typed inline on the conditional once-actions (new system administrator, backup restore) is never counted: no lockout, unlimited guessing | `services/step_up.py:701-708` with `:662-663`; `services/second_factor.py:141-150`, `:252-257` |
| SEC-2 | medium | Key attestation accepts a chain that continues below a genuine device certificate (no CA check): a software key is recorded and admitted as `hardware` | `services/device_key_attestation.py:142-147`, `:174-183`; `services/device_attestation.py:168-175` |
| SEC-3 | medium | A project restore silently puts the older remote sign-in policy back (second-factor policy, the bearer factor switch, the remote-access policy and its MFA rule) | `services/backup.py:156-327` (the keep list), `:366-367`, `:762-766` |
| SEC-4 | medium | The phone app's web session refuses every user whose factor is not the authenticator code once a policy requires a factor (phone key, passkey, HA MFA with provenance) | `services/app_session.py:207-214`, `:288-290`, `:428-429` |
| SEC-5 | medium | Re-validating a bearer session spends the sign-in rate limit: a busy token client is cut off (session dropped, 429), and an HA outage burns the address's whole budget | `services/ha_user_auth.py:1475-1491` (limits `:82-83`) |
| SEC-6 | low | WebSocket handshakes skip the home-interface gate that every HTTP request passes | `routers/media.py:444-457` against `auth.py:373-376` |
| SEC-7 | low | Arx-only sign-in: the account ceiling counter is a read-then-write across two connections; concurrent failures are counted once | `services/local_identity.py:1148-1152`, `:1219-1225` |
| SEC-8 | low | Off-box backup administration (endpoint test, push, key rotate and one-time key export) is reachable from the remote channel, unlike the other secret and SSRF-shaped routes | `routers/backup_offbox.py:295-311`, `:421-435`, `:439-450`; `remote_channel.py:170-203` |

Counts: 0 critical, 1 high, 4 medium, 3 low.

## Findings

### SEC-1 (high) - wrong inline codes on the conditional once-actions never reach the lockout

**Where.** `services/step_up.py:686-711` (`require_once_when_on`). A wrong code in `X-Arx-Second-Factor` is checked by
`once_proof` -> `second_factor.verify` (`services/second_factor.py:248-267`), which records the failure on the request's connection
(`FAILURES.fail`, `:141-150` - "counted inside the request's transaction, which commits when the request answers 4xx"). The
`SecondFactorError` is then handed to `_refuse(..., error=ApiError(...))` (`step_up.py:705-708`), and `_refuse` begins with
`rollback_and_restart(conn)` (`:662-663`: "nothing the request wrote before the gate stays"). The rollback takes the failure row with
it. The audit row `auth.step_up.failed` is written after the rollback and stays; the counter does not.

The two routes families that use this path: a binding of the `system_admin` role (`ONCE_ADMIN_ROLE`, the single / group / bulk binding
routes) and a restore (`ONCE_RESTORE`: `routers/backup.py:211-213`, the off-box restore). The other once-actions
(`routers/second_factor.require_step_up`, the bridge-key reveal) raise their `ApiError` without a rollback and count correctly, and so
does `POST auth/step-up/verify`.

**Scenario.** Step-up is on. An attacker holds an administrator's remote session cookie (the case step-up exists for); the
administrator has the authenticator code. The attacker sends `POST /arx/api/v1/access/bindings` (a `system_admin` binding for an
account of their choice) with `X-Arx-Second-Factor: 000000`, `000001`, ... Each wrong code answers 400 `second_factor_invalid`; the
5-in-5-minutes lockout never engages and no route-level rate limit exists on these routes. With the drift window (three valid steps
at any moment, `match_step`) a correct code is expected after roughly 330,000 requests - an hour or two at a modest request rate. The
correct request performs the action: a new system administrator, or a restore. The same loop also defeats the lockout the user relies
on everywhere else, because the counter the other routes read never moves.

**Reproduced** (see the table above): 24 wrong codes, 24 times 400, no row in `auth_totp_failures`.

**Fix.** Count the failure where a rollback cannot reach it: in `require_once_when_on`, after `rollback_and_restart`, record the
failure again on the fresh transaction (or write it through `db.write_aside()` inside `FAILURES.fail` for every caller - the audit
module already does this for read-mode requests). Add a regression test: five wrong inline codes on a `system_admin` binding -> the
sixth answers 429 `second_factor_locked`. Worth a per-user rate limit on the once-routes as a second line (the verify route has 10 /
5 min).

### SEC-2 (medium) - attestation: a chain extended below a genuine device certificate passes as `hardware`

**Where.** `services/device_key_attestation.py:142-147` (`_issued_by` = `verify_directly_issued_by`: issuer name and signature only)
and `:174-183` (the path walk and the anchor). No certificate of the path is required to be a CA (`basicConstraints CA:TRUE`,
`keyCertSign`), and the KeyDescription is read from `chain[0]` whatever stands above it. The older verifier of the app refresh
token's device key has the same walk (`services/device_attestation.py:168-175`).

**Scenario.** Any Android phone's Keystore hands out, for a hardware key K1 created with the signing purpose, a certificate chain
that ends at a Google root; K1's own certificate is an END-ENTITY certificate. The registrant creates an ordinary software key K2
(exportable, on any computer), builds a certificate for K2 whose issuer is K1's subject and whose KeyDescription carries
`attestationSecurityLevel = TrustedEnvironment` and the SHA-256 of this registration's payload, and lets the phone sign it with K1.
The chain `[forged K2 certificate, K1 certificate, intermediates..., root]` satisfies every check: the leaf certifies the registered
key, each link is "issued by" the next, the path ends at a pinned root, the dates and the status list pass, the challenge matches.
`verify_chain` answers `hardware`.

- Under `security.device_key_attestation = required` (the mode the owner's Q52 decision is about) the software key registers and
  counts as a sign-in factor and a step-up method - the one thing the mode promises not to allow (a copyable key).
- Under `preferred` (the default) the key list and the audit row say `hardware` for a key that is not.
- `security.app_refresh_attestation` gets `verified` the same way.

**Reproduced** with a generated chain (table above): `attested='hardware', level='tee'`.

**Fix.** In both verifiers require, for every certificate of the path above the leaf, `BasicConstraints.ca is True` (and
`key_cert_sign` when a KeyUsage extension is present), and refuse a chain in which any certificate other than `chain[0]` carries the
KeyDescription extension (Google's guidance: the extension must be read from the certificate nearest the root that has it). Add the
forged-extension chain to `tests/test_mfa_devicekey_attest_2490.py` and the ATTEST232 tests.

### SEC-3 (medium) - a restore silently reverts the remote sign-in policy

**Where.** `settings` is a project table (`services/backup.py:29`), so every restore - also the default `project` scope - runs
`DELETE FROM settings WHERE key NOT IN (<kept>)` (`:762-766`) and inserts the archive's rows; an archive is written with every
setting that is not kept (`:366-367`). The keep list (`SETTINGS_KEEP`, `:156-327`) protects every security switch added since 2.29
(`security.step_up*`, `security.factor_policy*`, `security.passkey*`, `security.device_key_*`, `security.factor_reset_channel`,
`security.local_identity`, the app-refresh keys ...) with the stated rule "a restore never loosens it". The older sign-in policy keys
are not on it (checked by name): `security.second_factor_policy`, `security.second_factor_bearer`, `remote.policy`,
`remote.require_mfa_admin`, `remote.admins_default`, `remote.csp_enforce`, `security.local_session`, `security.local_password_min`,
`security.local_lock_mode`.

**Scenario.** The owner sets `security.second_factor_policy = admins` and `remote.require_mfa_admin = true`. Later an administrator
restores an archive written before that (a daily archive, a pre-upgrade archive, an off-box copy) to bring back a floor plan. The
current rows are deleted and the archive's values - or, for an archive that has no row, the defaults - take their place:
administrators sign in from outside without a second factor again. The same restore can turn `security.second_factor_bearer` back to
`off`, `remote.policy` back to `any_role`, and the strict CSP back to report-only. Nothing tells anyone: the `backup.restore` audit
row and the answer list tables and counts, not the security settings that changed.

**Fix.** Put these keys on `SETTINGS_KEEP` (never exported, never restored - the rule of every newer key), or keep the stricter of the
two values; and name in the restore answer and its audit row every `security.*` / `remote.*` setting whose value changed. A ratchet
test would keep the list complete: every `security.*` and `remote.*` key of `routers/settings.py` is either kept or listed as
deliberately restorable.

### SEC-4 (medium) - the phone app's web session knows only the authenticator code as "a factor"

**Where.** `services/app_session.py:207-214` (`_enrol_refused`): for a Home Assistant user it answers "must enrol" when
`not second_factor.is_enrolled(...)` and the effective policy is `required`. It is applied at the exchange (`:288-290`) and at the
redeem (`:428-429`). The remote sign-in decides the same question with the full rule (`ha_user_auth.second_factor_need`,
`services/ha_user_auth.py:1124-1149`): an active phone key counts (owner Q51), a passkey counts while
`security.passkey_remote_factor` is on (MFA-HA-PASSKEY-2520), and under the enforced sign-in factor policy HA's own MFA with
provenance satisfies it.

**Scenario.** `security.second_factor_policy = admins` (or a `required` override, or the factor policy in `enforce`). An
administrator's only factor is the phone key of the Android app - the combination Q51 names ("password + phone key = two-factor").
The app signs in on the bearer path with the `dk1:` answer and is admitted; it mints its saved sign-in; then
`POST auth/app/session` answers 403 `second_factor_enrollment_required` and the WebView never opens. The user is told to enrol a
factor they already have. Same for a passkey-only user with the passkey switch on, and for a user admitted through HA MFA
provenance. Fail-closed (no bypass), but it locks exactly the users the 2.49-2.52 factors were built for out of the app as soon as
the owner turns a policy on. No test covers it (`enrol_required` appears in no test).

**Fix.** One shared function for "does this user still owe an enrolment" used by both places (the rule of `second_factor_need`
without the code prompt: authenticator code, or an active phone key, or a counting passkey, or - policy source `policy` - HA MFA as
recorded on the family's `ha_mfa`; `must_enroll` after an administrator's reset still refuses). Test: required policy + phone key
only -> exchange and redeem succeed.

### SEC-5 (medium) - bearer re-validation is billed to the sign-in rate limit

**Where.** `services/ha_user_auth.py:1449-1491` (`_bearer_session`). A known bearer session whose last validation is 60 s old is
re-validated on the request path, and that path first spends `LIMITER.hit("ip:...", IP_LIMITS)` (`:1481`; 10 a minute and 50 an hour
per address, `:82`) and later the per-user limit (`:1490`). When the limit is full, `rejected()` (`:1475-1479`) DROPS the live
session and answers 429. `HaUnavailable` answers 503 after the hit was already spent (`:1488-1489`), and - unlike the cookie path's
`recheck_after` back-off (`:1644-1646`) - the next request tries again.

**Scenario 1 (steady use).** A client that sends the HA token on every request (an integration with a long-lived token - the use
owner decision Q48 keeps allowed - or several such clients behind one address) and is busy enough that a request lands between
"60 s since the last validation" and the background pass's next 5-second tick: one hit a minute, 60 an hour against a cap of 50.
After about 50 minutes the client's session is dropped and every request answers 429 for about ten minutes; every browser sign-in
from the same address (`exchange` uses the same `ip:` key, `:1319`) is refused in that time too.

**Scenario 2 (HA restart).** While Home Assistant is away, every request of such a client is a failed validation: ten requests use
up the minute, fifty use up the hour. When HA is back the address stays locked out of bearer use and of new sign-ins for up to an
hour, and the session was dropped although its token is still valid.

**Fix.** Do not charge the sign-in limiter for the re-validation of a session that already exists (`s is not None`): the limiter
protects HA from unknown tokens, and an existing session is bounded by its own 60-second cache. Give the bearer path the cookie
path's back-off after `HaUnavailable` (serve the session, re-check after `HA_BACKOFF_S`) and never drop a session for a rate limit.

### SEC-6 (low) - WebSockets are outside the home-interface gate

**Where.** `routers/media.py:444-457` (`_principal_for_ws._touch`) repeats the cross-cutting steps of an HTTP request - the service
account refusal, the last-seen stamp, the bootstrap grant, `presence.enforce` - but not `home_interface.enforce`, which
`auth.shared_steps` runs for every HTTP request (`auth.py:373-376`). The allow-list itself expects sockets to be judged
(`/intercom/ws`, `/ha/ws` are listed in `HOME_ALLOWED_EXACT`, `services/home_interface.py:108-114`).

**Scenario.** A person limited to the home interface, with the "log" category switched off for them, opens `/events/ws` (or
`/wall/ws`): the handshake is accepted and the stream runs wherever their role allows the read, although `GET /events` answers 403
`home_module_off`. A restriction bypass only - the role checks of each socket still apply, so nothing is granted beyond the role.

**Fix.** Call `home_interface.enforce(conn, principal, path, None, root_path=..., method="GET")` in `_touch`, and refuse through
`_refuse_socket` like `presence_required`.

### SEC-7 (low) - the per-account ceiling of the Arx-only sign-in loses concurrent failures

**Where.** `services/local_identity.py`: `failed_count` is read on a read connection before the password hash is computed
(`:1148-1152`) and written back as `that value + 1` on another connection afterwards (`:1219-1225`).

**Scenario.** The ceiling (50 failures in 15 minutes from all networks together, `ACCOUNT_CEILING`) is the one tier meant to stop a
guesser who spreads over many addresses. Twenty requests from twenty addresses that overlap inside the hashing time all read the
same count and all write `count + 1`: twenty failures are booked as one, so the ceiling is reached twenty times later than designed.
The per-(account, network) delay and the per-address limits are kept in memory under a lock and are not affected.

**Fix.** One statement: `UPDATE auth_local_credentials SET failed_count = CASE WHEN <same window> THEN failed_count + 1 ELSE 1 END,
last_failed_at = ?, delay_until = CASE WHEN <new count> >= ? THEN ? ELSE delay_until END WHERE user_id = ? RETURNING failed_count`.

### SEC-8 (low) - off-box backup administration from the remote channel

**Where.** `routers/backup_offbox.py`: the connection test of an administrator-typed S3 endpoint or SFTP host (`:295-306`), the push
(`:308-311`), the key rotation (`:439-450`) and the ONE-TIME export of the key that decrypts every off-box copy (`:421-435`) are
plain `backup.manage` routes. None is in `remote_channel.BLOCKED_ON_REMOTE` (`remote_channel.py:170-203`), where the comparable
routes are local-only: the in-app secrets store, the bridge key, the NVR / music-server / video-service connections "and their
SSRF-shaped tests", the tickets address probe.

**Scenario.** With step-up off (the default) a stolen remote administrator session adds a target that points at the attacker's
endpoint, pushes the archive there, rotates the key and reads the new key from the export answer (which also spends the owner's one
chance to save that key). The endpoint test is also a server-side request to any host the add-on can reach, from outside.

**Fix (owner decision).** Make `/api/v1/backups/offbox/key` local-only like `/api/v1/system/bridge-key`, and the target create /
update / test local-only like the other connection routes; listing, push to an existing target and restore can stay.

## Improvements (short)

- **One rule for "which factors does this user have / owe".** `second_factor_need` (sign-in), `_enrol_refused` (app session),
  `local_identity._gate_for`, `factor_reset.sign_in_factor` and `step_up.methods_of` each answer a variant of it; SEC-4 and review
  N-3 both came from two of them drifting apart. One function with the caller's context as a parameter.
- **Security counters and the request transaction.** Lockout and rate counters ride the request's transaction and so depend on
  every caller's commit / rollback behaviour (SEC-1). Writing them through `write_aside` makes them independent of it.
- **`auth_kind` of a phone key is the client's own word** (`routers/device_keys.py:164`, `services/device_keys.py:292`): under
  `security.device_key_auth = biometric` nothing checks it. The attestation's authorization list carries the real user-authentication
  type; reading it (with SEC-2 fixed) would make the setting enforceable.
- **A first phone key does not end the user's other sign-ins**, unlike a first authenticator code or passkey
  (`services/user_passkeys.py:256-261` against `routers/device_keys.py:169-200`).
- **`rbac._CUSTOM_CACHE`** is keyed by (database file, permission revision). A write transaction that bumps the revision, reads the
  custom roles and then rolls back leaves an entry under a revision number the next real change reuses; it is evicted only when some
  reader asks at the old revision first. Narrow (PLAUSIBLE, not reproduced); clearing the cache on rollback or keying it by SQLite's
  `data_version` removes the question.
- **`client_ip`** believes `CF-Connecting-IP` from any peer on the internal add-on network (`services/ha_user_auth.py:843-857`).
  Behind Cloudflare that header is the edge's; behind another reverse proxy add-on it is whatever the client sent, and every
  per-address limit can be dodged. A setting that names the header to trust would close it.
- **Username probing by timing** on the Arx-only sign-in: a known name's failure writes a row and an audit row, an unknown name's is
  throttled to memory (`services/local_identity.py:1159-1171`, `:1217-1236`). Small next to the hashing time, but measurable in bulk.

## Checked and found sound

- **Ingress identity.** Headers are believed only from the Supervisor proxy address (`auth.py:238`, `config.py`), an `l_` id is refused
  from headers, the developer identity never exists inside the add-on, the bootstrap grant is once, Ingress-only and audited.
- **Remote channel.** Channel from the path alone; identity headers dropped before anything reads them; blocked prefixes compared on
  the decoded path with whole-segment matching; source maps refused; security headers and `no-store` added to every answer; the
  rotated Arx-only cookie rides the response.
- **CSRF / origin.** Every unsafe request carrying a session cookie (HA, Arx-only `l.`, app `a.` - one cookie name) needs
  `Sec-Fetch-Site: same-origin` or a matching `Origin`; the public Arx-only routes run the same proof before the body is read;
  cookies are `HttpOnly`, `Secure`, `SameSite=Strict`, path-scoped; every WebSocket with a cookie checks `Origin` against `Host`.
- **HA sessions.** 256-bit ids, in memory, never longer than the access token, re-validated against HA and the policy every 60 s of
  use and before an idle session is served; revocation marks the sign-in before dropping sessions (no exchange can slip through),
  survives a restart, closes sockets, and negative-caches the tokens. The pre-check of unverified JWT claims is only a filter; `iss`
  and `exp` are used after HA accepted the token.
- **Arx-only identities.** Password hashing through a bounded waiting room; uniform 401 with a dummy hash; delays per (name, network); only
  the cookie's SHA-256 stored; rotation with a 60 s grace; idle / absolute caps and the administrative cap applied on use; gated
  sessions (must change / must enrol) reach only their allow-list and no WebSocket; links are 256-bit, single use, hashed, in the URL
  fragment; a password change or reset ends the other sessions, the phones' tokens and the open links.
- **Self-service reset.** 6 digits, HMAC bound to the credential and the number, 5 guesses, 10 minutes, one live code, daily caps,
  never for a holder of an administrative permission (checked again at use), uniform answers, attempts counted in a write transaction.
- **Passkeys.** `webauthn.py`: client data type, challenge, exact origin, no cross-origin, RP id hash, user presence / verification,
  the signature over `authData || SHA-256(clientDataJSON)`, the counter, key parsing limits. Challenges are single use, 60 s, bound to
  the purpose, the user, the session (or the HA sign-in) and the action. The 2.52 passkey sign-in step offers credential ids only
  after HA validated that user's token and refuses the answer on the bearer path.
- **Phone keys.** Payload binds purpose, origin, user or key, action and nonce; challenges single use; the public sign-in challenge
  answers the same for any key id and is rate limited; failures lock out; `required` mode fails closed for a hand-edited value.
- **Step-up.** Marks on a monotonic clock, per sign-in, never from a recovery code where strict; once-proofs consumed under the lock;
  long-lived tokens are told apart by HA-signed lifetime claims. (SEC-1 is the one gap.)
- **RBAC.** Default deny; deny beats allow on the whole chain; allows on deleted places grant nothing; a station binding grants only
  station permissions; Arx-only identities never hold `system_admin` or anything through a group, and need their factor for every
  administrative permission; `require()` audits every refusal; the last-administrator count uses the same rule.
- **Audit.** Sign-in, refusal, revocation, factor, token, restore and CSRF events are written with ids, masked addresses and reason
  codes; refusals an anonymous caller can repeat are throttled with their count kept; no row was found carrying a password, code,
  cookie, token, challenge, signature or key.
- **Backup.** No session, link, failure counter, factor, recovery code, phone key, passkey, refresh family, partner token or bridge
  key table is exported or restored; password hashes travel only in the encrypted section; file names are pattern-checked; restore
  writes only files its own rows reference inside the restorable roots; credentials of off-box targets are always sealed `store:`
  references through the API (never `env:` / `file:`). (SEC-3 is the settings gap.)
- **Rate limits.** Exchange, logout, the public Arx-only routes, CSP reports, the APK download and the phone-key challenges are
  limited per address (IPv6 by /64) and persisted across restarts; forwarded-for headers are believed only from the add-on network.
