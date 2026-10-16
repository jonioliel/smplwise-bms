# USR2 - Arx-only identity: users who exist only in SmplWise Arx

**Status:** Proposed - design record, no product code. Written 2026-10-16 from `origin/main` @ 886ef3f4 (2.5.8).
**Owner decisions needed:** section 17 (eight questions). **Related:** USR1 (HA users created from Arx, in build),
CR-001 / `docs/security/HA_IDENTITY_RBAC_HE.md` (binding identity contract), CR-008 (remote channel, sessions),
CR-011 (second factor), CR-027 (phone app, device tokens, push relay), CR-038 TKSTAFF1 (no-login links).
**Provisional migration numbers:** 0097-0099 (the lead renumbers at integration; contiguous sequence rule).

---

## תקציר לבעלים (עברית)

**מה מבוקש.** שתי דרכים לקיום משתמש: (1) משתמש שקיים ב־Home Assistant (USR1, בבנייה), ו־(2) משתמש שקיים **רק
ב־Arx** - עובדי בית, עובדים, צוות ספקים - בלי שום גישה ל־Home Assistant. 10-30 משתמשים כאלה, עם סיסמה, גורם שני
אופציונלי, איפוס, ניהול כניסות (sessions), הגנה מניסיונות פריצה, וקישור לתפקידי Arx הקיימים.

**איך זה עובד בקצרה.**
- משתמש Arx-only נכנס **רק דרך הערוץ המרוחק** (`/arx`, דרך Cloudflare) - בדפדפן או באפליקציה. דרך Ingress של Home Assistant
  הוא לא יכול להיכנס כלל, כי שם הכניסה היא של Home Assistant. דפי הספקים הציבוריים (קישורי טיקטים) לא מושפעים.
- הסיסמה נשמרת רק כ־hash (argon2id), עם מדיניות אורך ורשימת סיסמאות נפוצות שמגיעה עם התוסף (בלי קריאה לאינטרנט).
- כניסה ראשונה דרך **קישור חד־פעמי** שהמנהל מפיק (מציג / שולח בוואטסאפ למספר מאומת); איפוס סיסמה - אותו מנגנון.
  למשתמש בעל הרשאות ניהול, איפוס רק מכניסה מקומית (Ingress) של מנהל מערכת, לעולם לא דרך הודעה בלבד.
- גורם שני: אותו TOTP של CR-011, אופציונלי לכל משתמש וניתן לכפייה לפי משתמש / תפקיד; passkeys בשלב מאוחר.
- כניסות: cookie אטום (HttpOnly, Secure, SameSite=Strict), נשמר בשרת, 30 יום (7 ימים לבעלי הרשאות ניהול), רשימת
  מכשירים וניתוק - באותו מסך שקיים היום.
- הגנה: תשובה אחידה לכל כישלון (אי אפשר לגלות אם שם משתמש קיים), האטה הולכת וגדלה לחשבון, מכסה לכתובת IP, בלם גלובלי
  שמודיע למנהל. בלי נעילה קשיחה (כדי שלא יוכלו לנעול עובד בכוונה) - אלא אם הבעלים יבחר אחרת.
- RBAC: למשתמש Arx-only **תפקיד Arx אחד** בהיקף אחד, לעולם לא `system_admin`, ואין שום מסלול להרשאות Home Assistant.
  פעולות שהיום רצות ב־Home Assistant "בשם המשתמש" (שליטה במכשירים, cast, אוטומציות, לוחות זמנים) ירוצו עבורו דרך
  **זהות שירות** של התוסף עם רשימת היתר לכל תכונה; אוטומציות (כתיבה) חסומות לו.
- אדם יכול להיות עם זהות Home Assistant, זהות Arx-only, או שתיהן - הקישור מתועד בסעיף 11.
- **סתירה שצריך לאשר:** המפרט המחייב `HA_IDENTITY_RBAC_HE.md` §1 ו־§4 [H04] אוסר "מסד סיסמאות נוסף". המסמך הזה לא
  מבטל אותו בשקט - סעיף 2 מנסח תיקון שדורש אישור הבעלים (שאלה 1).

**הערכת זמן:** כ־118 שעות סוכן ב־6 שלבים (סעיף 18); שלב 1 (חנות זהות + סיסמה + כניסה ראשונה + כניסות + הגנה + מסך ניהול)
כ־44 שעות. **8 שאלות לבעלים** בסעיף 17; תקציר של עמוד אחד בסעיף 19.

---

## 1. Scope

In scope: an identity store inside Arx; sign-in with username + password on the remote channel; optional / enforceable
second factor aligned with CR-011; first-login and reset by one-time link; persistent server-side sessions with a device
list and revocation; brute-force and credential-stuffing defence; audit; RBAC binding rules; the service identity for
features that today act in Home Assistant as the user; coexistence with USR1 (HA) users; backup / restore / export;
retention and deletion; localisation; a threat model; a phased plan and a test plan.

Out of scope (recorded, not forgotten): single sign-on to WisKey or other embedded products; sign-in on the Ingress channel
for Arx-only users (Ingress is Home Assistant's door - section 4); an LDAP / OIDC provider; e-mail delivery of links as a
primary channel (Arx-only users may have no mailbox); account self-registration (never: an administrator creates every user).

## 2. The contract conflict and the proposed amendment

`docs/security/HA_IDENTITY_RBAC_HE.md` v1.1 §1: "no new password system for the product's users and no account
duplication"; §4 [H04]: "a standalone path ... uses HA authentication and not an additional password database"; `AGENTS.md`
v1.1 amendment: "HA is the only human identity source; local VMS records contain bindings, not passwords". USR2 contradicts
all three. Per the precedence rule (approved change request > master spec / docs/security > AGENTS.md) this needs an
**approved change request** that amends the identity contract. Proposed amendment text (English; the Hebrew mirror follows):

> §1a (USR2). Two identity sources exist: Home Assistant (unchanged, the default and the only one that can hold
> `system_admin`) and the Arx local store (`users.source = 'local'`), for people who must never hold a Home Assistant
> account. A local identity holds exactly one Arx role at one scope, never `system_admin`, never an administrative permission
> unless the owner enables it, and never any Home Assistant credential. Everything a local identity does in Home Assistant
> runs through the add-on's service identity under a per-feature allow-list (USR2 §12). Local credentials are password
> hashes only (argon2id); no password is ever stored, logged or exported in clear. The Ingress channel stays Home Assistant's.

Until that CR is approved the feature ships behind `security.local_identity = off` (default) and nothing in the product offers
it. **Question 1** asks the owner to approve the amendment.

## 3. Facts verified in the code (2026-10-16, main @ 886ef3f4)

| # | Fact | Where |
|---|---|---|
| F1 | Identity today: Ingress headers `X-Remote-User-*` trusted only from the Supervisor proxy address (`172.30.32.2`); remote channel accepts only an Arx session cookie or an HA bearer token; dev identity never inside the add-on | `auth.py resolve_principal`, `config.py trusted_proxies`, `remote_channel.py` |
| F2 | The remote channel drops inbound `X-Remote-User-*`, `X-Ingress-*`, `X-Hass-*`, `X-Sw-Dev-User`; CSRF rule on state-changing requests carrying a session cookie (`Sec-Fetch-Site: same-origin` or exact `Origin`); security headers; `BLOCKED_ON_REMOTE` list | `remote_channel.py` |
| F3 | Sessions are **in memory** (HA refresh token restores them after a restart), <= access token lifetime, 256-bit sid, rotation on every token refresh, revoke by sign-in (hashed `iss`), `remote_revoked_chains` persisted; cookie `__Secure-arx_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=<remote_path>/` | `services/ha_user_auth.py`, `routers/remote.py:111` |
| F4 | `users(id, username, display_name, source, active, first_seen_at, last_seen_at)`; `source` has no CHECK; `bindings(subject_kind user/group, role_id, scope_type, scope_id, effect, expires_at, revoked_at)`; `is_system_admin` = active allow binding of `system_admin` at installation | `migrations/0001_init.sql`, `0032`, `0077`, `rbac.py` |
| F5 | The HA directory push (bridge) is stored in `ha_users` and mirrors HA's active flag onto `users`; "a user missing from a full push loses access" | `routers/ha.py bridge_directory`, tasks.json T0xx note 2026-09-15 |
| F6 | Second factor (CR-011 slice 1 + TFA2): RFC 6238 TOTP, secret AES-256-GCM under `<data>/keys/` (outside backups), lockout 5 wrong codes / 5 min -> 10 min persisted in `auth_totp_failures`, policy `optional \| admins` + per-user / per-role override `inherit \| optional \| required`, administrator reset audited, enabling the factor ends other sign-ins and revokes device tokens | `services/second_factor.py`, `routers/second_factor.py`, migrations 0065 / 0069 |
| F7 | Every HA action goes through the signed bridge call with `user_id` = the VMS user's **HA id**; the bridge does `hass.auth.async_get_user(user_id)`, answers `unknown_user` when missing / inactive, and calls the service with `Context(user_id=user.id)`; the same pattern in cast, config (automations), media query and schedule services | `custom_components/smplwise_bridge/__init__.py:300-330`, `cast_service.py`, `config_service.py`, `media_query_service.py`, `schedule_service.py` |
| F8 | Automation writes also read `ha_users.is_admin` of the principal (delegation rule) | `services/automation_scope.py:222` |
| F9 | Phone app: a WebView holding the Arx session cookie after sign-in, plus a **device token** `arxd_...` (shown once, hash stored) for presence / push routes; `GET /me` `user.id` is the app's identity for the user | `docs/api/mobile-presence-contract.md`, `routers/presence.py` |
| F10 | WhatsApp consent resolves the number through `ticket_contacts.user_id` (an Arx user id) - no HA dependency; notifications key on the Arx user id | `services/notify_whatsapp.py:176-190` |
| F11 | Public vendor pages (tickets handler, port 18093, `tickets_public`) authenticate by signed personal links; no user session | `config.yaml`, TKSTAFF1 design |
| F12 | Backups: project tables as JSON, never key files, never the NVR connection table; alarm tables excluded | `services/backup.py` |
| F13 | Audit row: actor id + username, action, resource, decision, reason, request id, permission revision, details JSON, scope / role / binding of the grant; 365-day prune | `audit.py` |
| F14 | Error envelope `{code, user_message, retryable, correlation_id, details}`; helpers `unauthenticated`, `forbidden`, `validation`; rate-limit answers `429 rate_limited` | `errors.py`, `ha_user_auth.py` |
| F15 | `requirements.txt` has `cryptography` but no argon2 library; PINs use scrypt (`hashlib`) | `requirements.txt`, `services/alarm_codes.py` |
| F16 | `remote.session = rolling_90d \| browser_session \| rolling_90d_idle_lock`, `remote.policy = flag \| any_role`, `remote.admins_default` | CR-008 §9 table, `ha_user_auth.remote_settings` |

## 4. Trust boundary: who authenticates, what proves identity at each entry

| Entry | Who authenticates today | Arx-only user | Proof of identity | Change |
|---|---|---|---|---|
| **Ingress** (HA sidebar, LAN) | Home Assistant login; Supervisor proxy sets `X-Remote-User-*` | **Not available** - the person has no HA account, so HA's login page never lets them through. Also the break-glass path for HA users stays HA-only | Headers from the trusted proxy address (F1) | none |
| **Web via Cloudflare tunnel** (`https://<host>/arx/`) | HA login flow in the Arx login page (password never touches the add-on) -> HA token -> Arx cookie | **Yes** - the same login page gains a second mode: `POST /arx/api/v1/auth/local/sign-in` (password reaches the add-on over TLS, hashed and compared there) -> Arx cookie | Local session cookie (opaque sid, server-side row) | login page, session store, cookie namespace |
| **Phone app** (Android shell, iOS shell; a WebView on the remote origin) | Same as web, inside the WebView; device token for presence / push | **Yes** - same cookie inside the WebView; device token registration unchanged (`presence.report`, keyed by Arx user id) | Cookie (`kind = app`) + `arxd_` device token | user agent marks `kind = app`; sign-in page as on the web |
| **HA bearer path** (native API clients with an HA token) | HA token validated against HA core | **Not applicable** - no HA token exists; no local bearer token in phase 1 (question 6 asks about an app refresh token) | - | none |
| **Public vendor pages** (tickets handler, port 18093) | Signed personal link + optional code | Unaffected: no user session, no relation to the identity store | Link token (F11) | none |
| **Bridge machine routes** (`/api/v1/ha/bridge/*`, local network, signed) | Shared secret, HMAC | Unaffected | Signature | the `execute` message gains the service-identity shape (section 12) |
| **Cast relay, Provision push ports** | Their own tokens | Unaffected | - | none |

Rules that fall out of the table:

- R1. A local identity is a **remote-channel identity**. `source = 'local'` principals are refused on the Ingress channel
  (`unauthenticated("identity_missing")` as today - the headers simply never name them) and never carry a `dev` identity.
- R2. The password crosses exactly one hop in clear: browser / WebView -> Cloudflare edge (TLS) -> tunnel -> add-on. Cloudflare
  sits inside the transport trust boundary, exactly as for the HA login flow today (CR-011 §2.3 assumption). The sign-in
  endpoint refuses plain `http` unless `in_addon` is false (a developer backend).
- R3. The remote-channel middleware's CSRF rule, header stripping, security headers and `BLOCKED_ON_REMOTE` apply unchanged.
  Local-identity administration routes that mint secrets (section 9) are **local-only** for administrators of other administrators.
- R4. Client address for rate limiting = `CF-Connecting-IP` when the connection arrives from the tunnel (the same choice the
  CSRF audit makes today), else the peer address. NOT_VERIFIED: that the tunnel path cannot be reached by an attacker who
  sets `CF-Connecting-IP` themselves (depends on the owner's Cloudflare / cloudflared configuration; mitigation: the per-IP
  tier is a nuisance control; the per-account and global tiers do not trust the header).

## 5. Identity store

### 5.1 Tables (migration **0097_local_identity**, provisional)

```sql
-- users: the one identity table stays the store for every source. Additive columns only.
ALTER TABLE users ADD COLUMN email        TEXT;          -- optional, for the notification e-mail channel only
ALTER TABLE users ADD COLUMN created_by   TEXT;          -- actor user id for source = 'local'
ALTER TABLE users ADD COLUMN disabled_at  TEXT;
ALTER TABLE users ADD COLUMN disabled_by  TEXT;
ALTER TABLE users ADD COLUMN deleted_at   TEXT;          -- soft delete; hard delete by the janitor after retention
ALTER TABLE users ADD COLUMN notes        TEXT;          -- administrator's note ("vendor X, cleaning", <= 200 chars)
-- users.source values after this migration: ingress | dev | remote | local. No CHECK is added (SQLite cannot add one in place
-- without a rebuild; the service layer validates). A local user's id is 'l_' + 26 chars (ULID), so it can never collide with an
-- HA user id (32 hex chars) and every reader can tell the source from the id alone.

CREATE TABLE auth_local_credentials (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash      TEXT,                         -- PHC string "$argon2id$v=19$m=...,t=...,p=...$salt$hash"; NULL until the first-login link is used
  params_version     INTEGER NOT NULL DEFAULT 1,   -- section 6.1; a sign-in with an older version re-hashes
  set_at             TEXT,
  set_by             TEXT,                         -- 'self' | actor user id (an administrator never sets a password; only links)
  must_change        INTEGER NOT NULL DEFAULT 0,   -- 1 after an administrator-issued reset link was used with the "temporary" flag
  last_sign_in_at    TEXT,
  last_sign_in_from  TEXT,                         -- masked address (ha_user_auth.mask_address) + country
  failed_count       INTEGER NOT NULL DEFAULT 0,   -- rolling counter of the per-account tier
  delay_until        REAL,                         -- epoch seconds; the per-account delay (section 10)
  unlocked_by        TEXT,
  updated_at         TEXT NOT NULL
);

CREATE TABLE auth_local_sessions (
  sid_hash           TEXT PRIMARY KEY,             -- SHA-256 of the cookie value; the cookie value itself is never stored
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('browser', 'app')),
  created_at         TEXT NOT NULL,
  last_used_at       TEXT NOT NULL,
  expires_at         TEXT NOT NULL,                -- absolute (section 8.2)
  idle_expires_at    TEXT NOT NULL,                -- sliding
  rotated_from       TEXT,                         -- previous sid_hash of the same chain
  chain_id           TEXT NOT NULL,                -- one device's sign-in; rotations keep it (what the sessions list shows)
  factor_at          TEXT,                         -- when the second factor was last shown on this chain (step-up later)
  ip_masked          TEXT NOT NULL DEFAULT '',
  country            TEXT NOT NULL DEFAULT '',
  user_agent         TEXT NOT NULL DEFAULT '',     -- <= 200 chars
  label              TEXT,                         -- the user's own device name (<= 40 chars)
  revoked_at         TEXT,
  revoked_reason     TEXT CHECK (revoked_reason IN ('logout', 'logout_all', 'admin', 'password_changed', 'factor_enabled',
                                                   'factor_reset', 'user_disabled', 'user_deleted', 'expired', 'idle', 'rotated'))
);
CREATE INDEX idx_auth_local_sessions_user ON auth_local_sessions(user_id, revoked_at);
CREATE INDEX idx_auth_local_sessions_chain ON auth_local_sessions(chain_id);

CREATE TABLE auth_local_links (                    -- first-login and reset links (section 7)
  token_hash         TEXT PRIMARY KEY,             -- SHA-256 of the 32-byte token
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose            TEXT NOT NULL CHECK (purpose IN ('first_login', 'reset')),
  issued_by          TEXT NOT NULL,
  issued_via         TEXT NOT NULL CHECK (issued_via IN ('shown', 'whatsapp')),
  issued_channel     TEXT NOT NULL CHECK (issued_channel IN ('local', 'remote')),
  created_at         TEXT NOT NULL,
  expires_at         TEXT NOT NULL,
  used_at            TEXT,
  invalidated_at     TEXT,                         -- a newer link, a disable, a delete
  temporary          INTEGER NOT NULL DEFAULT 0    -- sets must_change
);
CREATE INDEX idx_auth_local_links_user ON auth_local_links(user_id);

CREATE TABLE auth_local_failures (                 -- the per-IP and global tiers (the per-account tier lives on the credential row)
  key                TEXT PRIMARY KEY,             -- 'ip:' + SHA-256(address)[:32] | 'global'
  window_start       REAL NOT NULL,
  count              INTEGER NOT NULL,
  blocked_until      REAL,
  updated_at         REAL NOT NULL
);
```

Settings keys (table `settings`, registered in `OPTION_TYPES`): `security.local_identity` (`off` default | `on`),
`security.local_session` (`rolling_30d` default | `rolling_90d` | `browser_session`), `security.local_admin_session_days`
(7), `security.local_password_min` (12), `security.local_link_ttl_h` (72), `security.local_lock_mode` (`delay` default |
`lock`), `security.local_admin_roles_allowed` (`false` default), `identity.service_user_id` (HA user id of the service
identity, section 12), `security.local_password_for_ha_users` (`false` default, section 11).

### 5.2 Identity record rules

- A local user has `username` unique **across all sources** after `normalize_username` (strip + casefold; F1's rule), 3-32
  characters, `[a-z0-9._-]`, must start with a letter or digit. A username equal to an HA username is refused (the login page
  would otherwise have two meanings for one name - section 11 keeps "both" as an explicit link, never a name collision).
- `display_name` 1-60 characters, any script. `email` optional, validated syntactically only, used by the e-mail notification
  channel exactly like an HA user's today (NOT_VERIFIED where the e-mail channel takes an HA user's address from; the
  implementer confirms and, if it reads HA's person / user record, reads `users.email` for `source = 'local'`).
- Creation: `POST /identity/local-users` with `{username, display_name, role_id, scope_type, scope_id, email?, notes?}` creates
  the user row (`active = 1`, `source = 'local'`), the credential row (no hash yet), **exactly one** allow binding, and a
  first-login link; the link is returned **once** in the response (section 7). Audit `identity.local.user.created`.
- The row is never touched by `touch_user`'s upsert from headers (Ingress never names it) and never by the directory sync
  (section 11, R11).

## 6. Passwords

### 6.1 Hashing

- **argon2id** (RFC 9106), via `argon2-cffi` (new dependency; its `PasswordHasher` emits PHC strings and `check_needs_rehash`).
  Parameters version 1: **m = 64 MiB, t = 3, p = 1**, 16-byte salt, 32-byte tag (above OWASP's 2025 floor of m = 19 MiB,
  t = 2; the server has at most 30 such users and a sign-in storm is bounded by the semaphore below). A `--low-memory` profile
  (m = 32 MiB, t = 4; version 2) is selected automatically when the container has < 1 GiB of RAM (`/sys/fs/cgroup/memory.max`),
  so a small host never swaps. Hash and verify run in a thread pool behind a **semaphore of 2**; a third concurrent verify
  waits (never fails), so an attacker gains at most 2 x 64 MiB and ~2 verifies / 100 ms of CPU.
- `check_needs_rehash` on every successful sign-in: a hash made with an older version is re-hashed with the current one.
- No pepper. Reason: a pepper file under `<data>/keys/` is excluded from backups by design (F12); a restore to a new host would
  then invalidate every password with no recovery except re-onboarding all users. The threat a pepper addresses (an attacker
  holding the database file but not the keys) is answered by argon2id's cost. Recorded as a conscious choice.
- Unknown username: the verifier runs argon2id against a fixed dummy hash so timing does not reveal existence (section 10).
- NOT_VERIFIED: `argon2-cffi` ships `musllinux` / `manylinux` wheels for `aarch64` and `x86_64` matching the add-on base image.
  If not, fallback = `hashlib.scrypt` (n = 2^17, r = 8, p = 1; PHC string `$scrypt$...`), already a dependency-free path the
  project uses for PINs (F15). The PHC prefix tells the verifier which algorithm a row uses, so a later switch needs no migration.

### 6.2 Policy

- Length **>= 12** (`security.local_password_min`, 10-64 allowed) and <= 128; Unicode allowed, NFKC-normalised before hashing;
  leading / trailing whitespace stripped; no composition rules (NIST SP 800-63B).
- **Denylist without outbound calls:** a bundled list of the 20 000 most common passwords (compressed, ~80 KiB, licence noted in
  `THIRD_PARTY_NOTICES.md`), matched after lower-casing and stripping trailing digits / `!`; plus **context words**: the
  username, the display name's words, `smplwise`, `arx`, the installation's site names, `password`/`סיסמה`, and any string whose
  characters are a single repeated character or a keyboard run (`123456789`, `qwerty...`). A refusal names the reason class
  (`common`, `contextual`, `too_short`, `repeated`) and never echoes the password.
- No breach lookup (HIBP's k-anonymity API is an outbound call; the owner may later drop an offline HIBP range set into
  `<data>/denylist/` - a documented optional extension, not built here).
- No forced periodic rotation. Rotation happens on compromise (administrator reset) or on the user's choice.
- Change (self): `PUT /auth/local/password {current_password, new_password, code?}` - the current password always, the TOTP
  code when enrolled; success **rotates the session**, revokes every other session of the user (`password_changed`) and
  audits `auth.local.password.changed`.

## 7. First login and reset by one-time link

- Token: 32 random bytes, base64url (43 chars); only `SHA-256(token)` is stored. Link form:
  `https://<host><remote_path>/#/welcome?t=<token>` - the token is in the **fragment**, so it never reaches Cloudflare's or the
  add-on's access logs; the page POSTs it over TLS. (Same technique the tickets module uses for its links? NOT_VERIFIED - the
  implementer aligns with TKSTAFF1 if it differs.)
- Lifetime `security.local_link_ttl_h` (default 72 h, 1-168). **Single use.** Issuing a new link invalidates the previous one
  (`invalidated_at`). A link is invalidated by disable / delete of the user and by a password change.
- Flow: `POST /auth/local/set-password {token, password}` -> policy check (section 6.2) -> hash -> `used_at` -> **no session
  is created**: the page then signs in normally (so the second-factor step and the sign-in audit run exactly once, through one
  path). A link of a user whose second-factor policy is `required` and who is not enrolled gets `must_enrol` in the answer; the
  shell routes them to enrolment on the first sign-in (reusing CR-011's `ENROLL_REQUIRED_HE` behaviour).
- Delivery: `issued_via = 'shown'` - the administrator reads / copies the link and hands it over in person or by their own
  channel; or `issued_via = 'whatsapp'` - when the user has a **confirmed** mobile in `ticket_contacts` (TKSTAFF1 confirmation)
  the link is sent through the existing WhatsApp outbox (templated message, no username in the text). The response carries the
  link only for `shown`.
- **Who may issue:** `identity.local.manage` (new permission, in `system_admin` only - question 3 offers `site_admin` within scope).
  For a target holding any permission in `ADMIN_PERMISSIONS` (`system.configure`, `rbac.assign`, `identity.directory.read`) the
  issue route is **local-channel only** (Ingress session of an HA administrator; `BLOCKED_ON_REMOTE` style refusal 404), and
  never `whatsapp`. Nobody is ever reset by a message alone: the link only sets a password; the sign-in still needs the second
  factor when enrolled, and a reset of a user **with** a factor does not remove it (that stays CR-011's separate, audited
  administrator reset).
- Self-service "forgot password" is **not offered** in phase 1 (no mailbox guaranteed, and WhatsApp-only reset is a single
  factor to a phone that may be the same stolen phone). Question 5 offers it as a later option.
- Rate limits on `set-password`: 10 / minute / IP; an unknown token answers the uniform `link_invalid` (expired, used, unknown,
  invalidated are indistinguishable to the caller; the audit row knows). Audit: `auth.local.link.issued`,
  `auth.local.link.used`, `auth.local.link.refused`.

## 8. Second factor and sessions

### 8.1 Second factor (alignment with CR-011)

- The TOTP implementation, tables (`auth_totp`, `auth_totp_failures`, `auth_totp_policy`), policy precedence (user > role >
  global) and administrator reset are **reused unchanged**; the user id is the local id. The sign-in flow asks the code **after**
  a correct password (as the remote exchange does today), bound to a 5-minute pending record (`arx_pending` cookie, HttpOnly,
  Secure, SameSite=Strict, Path = sign-in route only) that holds a random id -> `{user_id, ip, created}` in memory.
- Enforceable per user and per role through the existing override route; the global policy `admins` applies to local users
  holding an administrative permission (only possible under question 3's option b/c).
- Enabling the factor and an administrator reset revoke the user's local sessions (`factor_enabled` / `factor_reset`) and device
  tokens, as today for HA users (F6).
- **Passkeys (WebAuthn, phase 4):** `auth_webauthn_credentials` (migration **0098**): `id, user_id, credential_id BLOB UNIQUE,
  public_key BLOB, alg INTEGER, sign_count INTEGER, transports TEXT, aaguid TEXT, label TEXT, backup_eligible INTEGER,
  backup_state INTEGER, created_at, last_used_at`. Registration requires a fresh sign-in (< 5 min) with password (+ code when
  enrolled). A passkey may serve as the **second factor** (replacing TOTP for that sign-in) or, when the owner enables
  `security.local_passkey_first = on`, as a **single passwordless factor** with user verification required (`uv = required`)
  because the platform authenticator's biometric / PIN is the second factor. RP id = the remote host; origin check against
  `<scheme>://<host>`; challenge 32 bytes, 60 s, in memory; `sign_count` regression -> refuse and audit
  (`auth.local.passkey.counter_regression`). Android WebView needs `assetlinks.json` and androidx.webkit >= 1.12.1 (CR-011 §2.3);
  iOS shell NOT_VERIFIED. Library: `webauthn` (duo-labs `py_webauthn`, pure Python, depends on `cryptography` already present) -
  NOT_VERIFIED for version pinning.

### 8.2 Session model

- **Cookie, not token**, for browser and app WebView: the same cookie names `__Secure-arx_session` / `arx_session` and attributes as
  today (F3), so the CSRF middleware, `SESSION_COOKIES`, the media / WebSocket cookie readers and the shell work unchanged. The
  cookie value is `l.` + 32 random bytes base64url; the `l.` prefix routes the lookup to `auth_local_sessions` (SHA-256 of the
  value) instead of the in-memory HA store. `ha_user_auth.session_of` / `remote_principal` gain this branch; everything above
  them sees a `Principal(source="local", via="cookie")`.
- **Persistent** in SQLite (unlike HA sessions): there is no refresh token to rebuild from after a restart. A small in-process
  LRU (sid_hash -> row, 60 s) keeps the hot path off the database; `last_used_at` is written at most once a minute per session
  (the `touch_user` pattern).
- **Lifetimes:** `security.local_session`: `rolling_30d` (default) = absolute 30 days, idle 14 days; `rolling_90d` = absolute 90,
  idle 30; `browser_session` = cookie without `Max-Age`, server absolute 12 h, idle 2 h. Holders of an administrative permission:
  absolute `security.local_admin_session_days` (7) and idle 24 h regardless. The app WebView (`kind = app`, detected by the
  `(Android app)` / iOS marker in the user agent, F9) follows the same values.
- **Rotation:** a new sid (same `chain_id`, `rotated_from` set, old row `revoked_reason = 'rotated'` with a 60-second grace in
  which the old sid still resolves to the new row - two tabs racing) at sign-in, every 24 h of use, on password change, on factor
  enable, and on any privilege change of the user (`permissions_fingerprint` moved - the `/me/ws` signal already exists).
- **Device list and revoke:** `GET /auth/sessions` lists local chains next to HA sign-ins with `kind: "local"`, `label`,
  masked address, country, user agent, created / last used; `DELETE /auth/sessions/{public_id}` and `DELETE /auth/sessions`
  ("sign out everywhere") work for both; a WebSocket of a revoked session is closed within 5 s (the `revocation` generation
  signal). `PATCH /auth/sessions/{public_id} {label}` lets the user name a device (new, both kinds).
- **CSRF / Origin:** unchanged middleware (F2). The sign-in route itself carries no session cookie, so the rule does not apply to it;
  it instead requires `Origin` = this origin **or** `Sec-Fetch-Site: same-origin`, and refuses otherwise with `csrf_refused`
  (closing login-CSRF: an attacker signing the victim's browser into the attacker's account).
- **Logout:** `DELETE /auth/session` revokes the chain (`logout`); the pending second-factor record, if any, is dropped.

## 9. Routes and permissions (concrete)

All under `/api/v1`, JSON, the error envelope of F14. "remote" = remote channel; "both" = Ingress and remote; "local-only" =
listed in `BLOCKED_ON_REMOTE`.

| Method | Route | Channel | Who | Notes |
|---|---|---|---|---|
| POST | `/auth/local/sign-in` | remote | public | `{username, password}` -> `200 {second_factor: "required"\|"none", session_expires_in}` + cookie, or `202 {second_factor: "required"}` + `arx_pending`; `401 sign_in_failed` (uniform); `429 rate_limited`; `403 local_identity_off` when the feature is off |
| POST | `/auth/local/sign-in/second-factor` | remote | pending | `{code}`; `401 second_factor_invalid` / `locked`; success sets the session cookie |
| POST | `/auth/local/set-password` | remote | public | `{token, password}`; `200 {must_enrol}` / `400 password_policy {reason}` / `401 link_invalid` |
| PUT | `/auth/local/password` | both | self (`source = local`) | section 6.2 |
| GET | `/auth/sessions`, DELETE `/auth/sessions`, DELETE `/auth/sessions/{id}`, PATCH `/auth/sessions/{id}` | both | self | extended for `kind: local` |
| GET | `/identity/local-users` | both | `identity.directory.read` | list with status: `pending_first_login`, `active`, `delayed`, `disabled`, `deleted`; never a hash, never a link |
| POST | `/identity/local-users` | both | `identity.local.manage` | section 5.2; returns the first-login link once |
| GET | `/identity/local-users/{id}` | both | `identity.directory.read` | + sessions count, factor status (CR-011 `status`), binding |
| PATCH | `/identity/local-users/{id}` | both | `identity.local.manage` | `display_name`, `email`, `notes`, `active`; the role / scope through the **existing** bindings routes (one-binding rule enforced server-side, section 12) |
| DELETE | `/identity/local-users/{id}` | both | `identity.local.manage` | soft delete: sessions / links / device tokens revoked, bindings revoked, `deleted_at`; hard delete by the janitor after 30 days (section 14) |
| POST | `/identity/local-users/{id}/link` | both; **local-only when the target holds an administrative permission** | `identity.local.manage` | `{purpose: first_login\|reset, via: shown\|whatsapp, temporary?}` |
| POST | `/identity/local-users/{id}/unlock` | both | `identity.local.manage` | clears the per-account delay; audited |
| POST | `/identity/local-users/{id}/sessions/revoke` | both | `identity.local.manage` | ends every session and device token of the user (`admin`) |
| GET | `/identity/local-users/export` | both | `identity.local.manage` | CSV: id, username, display name, role, scope, status, created, last sign-in (masked address), factor on/off. No hashes, no links |
| GET | `/identity/service-identity` | local-only | `system.configure` | the configured service HA user, whether the bridge accepts it, the allow-list (section 12) |

Permissions added to `roles.json`: `identity.local.manage` (system_admin). Reused: `identity.directory.read`, `rbac.assign`,
`system.configure`. The shell shows "משתמשים והרשאות › משתמשי Arx" only to holders of `identity.directory.read`.

## 10. Brute-force and credential-stuffing defence

Three independent tiers; every refusal is the same `401 sign_in_failed` with the same Hebrew text ("שם המשתמש או הסיסמה אינם
נכונים."), the same body shape and - where a tier delays - the same **delay applied before answering**, so a correct password
for a delayed account and a wrong password for an unknown account look alike from outside.

| Tier | Key | Rule (defaults; settings-tunable within bounds) | Effect |
|---|---|---|---|
| Per account | `users.id` (from the normalised username; unknown names hit a dummy hash) | after 5 failures in 15 min: `delay_until = now + 30 s`, doubling per further failure, cap 15 min; counter resets 15 min after the last failure or on success | `security.local_lock_mode = delay`: a sign-in during the delay is refused with the uniform answer **after sleeping min(delay, 3 s)** (no thread starvation); `lock`: the account is locked until `delay_until` and the administrator may unlock. Either way the user row shows `delayed` to administrators and a notification `auth.local.account_delayed` goes to `identity.local.manage` holders after the 10th failure |
| Per IP | SHA-256 of the client address (section 4 R4) | 20 attempts / min, 100 / h, 300 / day | `429 rate_limited` (`Retry-After`), audited at most once per address per minute (the `REFUSAL_AUDITS` throttle) |
| Global | `'global'` | 300 failures across all accounts in 10 min | every sign-in waits 2 s, administrators get `auth.local.storm` once per hour, and sign-ins of accounts with **no successful sign-in in the last 30 days** are refused for the window (new-account spraying) |

Other rules: the password field is capped at 128 bytes before hashing (argon2 cost is per attempt, not per byte, but a 1 MiB body is
refused by the body limit anyway); the pending second-factor record limits code attempts through CR-011's own lockout; set-password
tokens 10 / min / IP; no "username exists" signal anywhere - the set-password route, the sign-in route, the second-factor route and
the sessions routes answer the same for unknown and known subjects; **no account enumeration through timing** (dummy hash),
through status codes or through link behaviour. Successful sign-in clears the per-account tier. Local sign-ins are recorded in
`remote_sign_ins` (masked address, country) exactly as HA sign-ins are today, so the "new location" notification works unchanged.

## 11. Coexistence with USR1 (HA users): one person, one or two identities

Model: a **person** is not a table - it is a relation between user rows. Three shapes:

| Shape | Rows | Sign-in | Bindings | Notes |
|---|---|---|---|---|
| HA identity only (today, USR1) | `users(source ∈ ingress/remote)` + `ha_users` | HA login (Ingress or remote) | any | unchanged |
| Arx-only identity | `users(source = local)` + `auth_local_credentials` | local sign-in, remote only | exactly one | this spec |
| Both | **two rows** linked by `identity_links(ha_user_id, local_user_id, linked_by, linked_at)` (migration 0097) | each by its own door | each row its own; the link is informational and drives three rules | default: allowed, question 7 |

Why two rows and not one row with two authenticators: `users.id` of an HA user **is** the HA id and is used as `Context(user_id)`
by the bridge (F7), as the directory sync key (F5), as the device-token owner (F9) and as `remote_access_users.user_id`; a local
password on that row would let a password sign-in act with the HA identity in HA - exactly the path USR2 must not open. Two rows
keep the trust boundary: the local row never carries an HA id anywhere.

Rules the link drives:

- R10. The administrators' user list shows the two rows as one card ("גם ב־Home Assistant" badge in settings only, UI_COPY_RULES);
  disabling the HA row offers to disable the local row too (never automatic - question 7).
- R11. **Directory sync exemption:** `bridge_directory` only mirrors / drops rows whose `source != 'local'`; a local row is never
  deactivated by an HA push. Regression test mandatory (section 20).
- R12. Audit search and the tickets / notifications "my things" views may union the two ids when a link exists; authority never
  unions (each row is authorised alone - "capabilities are never unioned across scopes", rbac.py).
- `security.local_password_for_ha_users` stays `false` and is **not implemented** in this spec (left as a named future switch so
  nobody adds it silently).

Migration of existing data: none required; `users.source` values already present are untouched; no existing row becomes local.

## 12. RBAC binding and features that assume an HA user context

### 12.1 Binding rules (server-side, in the bindings routes and `identity/local-users`)

- A local user holds **exactly one allow binding** at a time (role + scope); replacing it = revoke + create in one transaction
  (`identity.local.role_changed`). No group membership (groups union roles; the one-role rule would be unenforceable). No deny
  bindings needed (one role, one scope).
- Refused roles for a local subject: `system_admin`, any custom role carrying `identity.local.manage`, `system.configure`,
  `system.update`, `rbac.roles.manage`; and - unless `security.local_admin_roles_allowed = true` (question 3) - any role
  carrying `rbac.assign` or `identity.directory.read` (today `site_admin`). Built-in roles allowed by default: `viewer`, `kiosk`,
  `operator`, `editor`, the tickets grant roles, custom roles without the refused permissions.
- `remote.policy`: a local user **is** remote by nature; the `flag` policy and `remote_access_users` do not apply (a local user
  needs no flag - the binding is the admission; `remote_basis` returns `local`). `remote.admins_default` irrelevant.
- `is_system_admin` can never be true for a local id (rule above + a test).
- Wall kiosk (CR-030): a wall tablet may be a local user on `kiosk` - a cleaner fit than today's HA user per tablet. Noted, not changed.

### 12.2 Service identity for features that act in Home Assistant

Today every HA action carries the principal's HA id and the bridge runs it as that HA user (F7). A local principal has no HA id,
so the bridge would answer `unknown_user`. Design:

- The HA administrator creates (or USR1 creates - it is exactly a "limited HA user") **one** non-admin HA user "SmplWise Arx
  Service" in HA's `users` group, no password login needed (USR1 can leave it without credentials; NOT_VERIFIED that USR1 supports
  credential-less users), and the owner enters its id in `identity.service_user_id` (settings › גישה מרחוק › משתמשי Arx).
- The signed bridge messages gain `on_behalf_of: {"kind": "local", "user_id": "<local id>", "feature": "<feature key>"}` and
  `user_id = <service id>`. Bridge rule: when `on_behalf_of` is present, `user_id` **must** equal the service id configured in the
  bridge's options (the bridge holds its own copy - the add-on cannot pick an arbitrary HA user), the `feature` must be in the
  bridge's `SERVICE_FEATURES` allow-list, and the `(domain, service)` must be in that feature's list. Otherwise `service_identity_refused`.
  Both sides enforce; the add-on side is `services/service_identity.py` with the same table. Bridge minimum version bump.
- `Context(user_id = service id)` is used, so HA's own per-user entity policy for that user applies; the context id -> local
  principal mapping is stored by `device_activity.link_context` (today it already stores the Arx request / context link), so the
  activity log attributes the action to the **local person** (`actor_ref = local id, via = arx`), never to "the service".
- Audit on the add-on: the normal row (actor = local principal) + `details.service_identity = true`.

Feature inventory - what assumes an HA user context today and what a local user gets:

| Feature | Today | Local user | Allow-list key |
|---|---|---|---|
| Device control (`devices.control`, `ha.entity.control`, bulk) | bridge `execute` as the user | via service identity; same Arx permission checks first | `devices.control`: the domains / services `ALLOWED_SERVICES` already permits for execute, minus `alarm_control_panel.*` (below) |
| Alarm arm / disarm / bypass (CR-010) | bridge execute as the user; HA's own code checks | via service identity, Arx permission + Arx PIN rules unchanged | `alarm`: `alarm_control_panel.alarm_arm_*`, `alarm_disarm` - **question 4** (default: allowed for `operator`/`site_admin`-class roles only) |
| Cast (CR-028) | `cast_service` as the user | via service identity | `cast` |
| Media players / Music Assistant (CR-015/16) | `media_query_service` + execute as the user | via service identity | `media` |
| Schedules (CR-014) | `schedule_service` as the user | via service identity | `schedules` |
| Automations / scenes / scripts **writes** (CR-017) | `config_service` as the user; needs HA admin or delegation (F8) | **refused** (`automation_write_requires_ha_identity`); reads allowed | - |
| Area assignment of a device (`routers/devices.py:717`) | bridge as the user | refused unless the owner adds `devices.area` to the list (default off) | `devices.area` (off) |
| "My account" (`/me`, prefs, second factor, sessions) | Arx id | works; `source = local` shown; the "Home Assistant profile" links are hidden for local users | n/a |
| Notifications (CR-018) in-app / push / e-mail / WhatsApp | Arx id; e-mail address from HA? (NOT_VERIFIED) | works; e-mail from `users.email`; WhatsApp through `ticket_contacts.user_id` (F10) | n/a |
| WhatsApp consent (`/me/notify-whatsapp`) | Arx id | works unchanged | n/a |
| Push relay / presence (CR-027) | Arx id + device token | works unchanged; the required-sensors policy applies by role as today | n/a |
| Tickets staff links (TKSTAFF1) | Arx id + `ticket_contacts` | works unchanged | n/a |
| Live video / playback / export | add-on's own NVR / go2rtc credentials, Arx permissions | works unchanged | n/a |
| WisKey intercom screens | the add-on's WisKey connection user; Arx `access.*` permissions | works unchanged | n/a |
| Remote "sign out everywhere" at HA | deletes HA refresh tokens | n/a for local sessions (revokes local rows) | n/a |
| Second-factor "admins" policy via HA MFA (`remote.require_mfa_admin`) | checks HA MFA modules | not applicable; CR-011 TOTP policy applies instead | n/a |
| Directory sync (F5) | mirrors HA active flag | **exempt** (R11) | n/a |

## 13. Audit events (ids only; never a password, token, link, code or typed username)

`auth.local.sign_in.succeeded` (resource user; details: kind, country, masked ip, factor used), `auth.local.sign_in.failed`
(resource user **or** `unknown` - the typed name is never stored; details: tier that refused, masked ip),
`auth.local.sign_in.delayed`, `auth.local.sign_in.rate_limited` (ip only, throttled), `auth.local.storm`,
`auth.local.second_factor.required`, `auth.local.second_factor.failed` (reuse CR-011 names where identical),
`auth.local.session.created|rotated|revoked|expired` (details: reason, chain public id), `auth.local.password.changed`,
`auth.local.password.rehashed`, `auth.local.link.issued|used|refused|invalidated` (details: purpose, via, channel, temporary),
`auth.local.passkey.registered|removed|used|counter_regression`, `identity.local.user.created|updated|disabled|enabled|deleted|
purged|role_changed|unlocked|sessions_revoked|exported`, `identity.link.created|removed`, `identity.service_identity.configured|
refused` (details: feature, service). All through `audit.audit()` with the actor principal; refusals from the read path through
`write_aside` as today.

## 14. Backup, restore, export, retention, deletion

- **Project backup** (F12) gains the identity member: `users` (all sources), `bindings`, `identity_links`,
  `auth_local_credentials` (**hash included** - it is designed to withstand exposure, and without it a restore to a new host
  would lock out every local user; the backup file is already treated as sensitive because it holds the site's plans),
  `auth_webauthn_credentials` (public keys only). **Excluded:** `auth_local_sessions`, `auth_local_links`, `auth_local_failures`,
  `auth_totp*` (its key is outside the backup anyway - users re-enrol TOTP after a restore to a new host, as HA users do today).
  Restore refuses an archive member naming a key, as today. Question 8 lets the owner exclude the hashes instead.
- **Export:** section 9's CSV (no secrets). Per-user data export (the person's own rows) is `GET /me/export` - not built here; noted.
- **Retention (janitor):** `auth_local_failures` rows older than 24 h; `auth_local_links` 7 days after `used_at` /
  `expires_at` / `invalidated_at`; `auth_local_sessions` 30 days after revoke / expiry; pending second-factor records 5 min;
  audit 365 days (existing).
- **Deletion:** soft (`deleted_at`): sessions, links, device tokens and bindings revoked at once, the username released
  **only after** the hard delete; hard delete after 30 days removes `auth_local_credentials`, `auth_totp`, `auth_webauthn_credentials`,
  `user_prefs`, `remote_sign_ins` of the id, and anonymises `users.display_name` to "משתמש שנמחק" while **keeping the row** (audit,
  tickets and activity rows reference the id). A hard delete is audited `identity.local.user.purged`.

## 15. Localisation

Hebrew first, RTL login page in the Arx design; every user-facing string through the existing i18n modules with English
(`LANGS` of the tickets module as the pattern); error `user_message` in Hebrew with machine codes for the apps; no platform branding
outside settings (UI_COPY_RULES - the sign-in page says "כניסה ל־SmplWise Arx", the toggle between the two modes says "משתמש Arx" /
"משתמש תשתית המערכת"); the WhatsApp link template in Hebrew and English by the contact's `lang`; usernames are ASCII by rule,
display names any script; dates on screens in the site's IANA zone.

## 16. Threat model

| Attacker | Asset | Control(s) in this spec |
|---|---|---|
| Internet password guesser (one account) | a staff account | argon2id cost; per-account delay doubling to 15 min; uniform answers; second factor when enrolled / required; notification after 10 failures |
| Credential stuffing (many accounts, leaked lists) | any account | denylist blocks the common passwords at set time; per-IP and global tiers; new-account spraying refusal; no enumeration (dummy hash, uniform codes) |
| Phished password (+ relayed TOTP) | an account | passkeys (phase 4) are phishing-resistant; TOTP step still limits a password-only phish; sessions bound to our origin; "new location" notification |
| Stolen unlocked phone | the app session | app lock (CR-008), session revoke from any other device, administrator revoke; step-up for sensitive actions remains CR-011 §4E (not built here) |
| Stolen database file (backup copy) | hashes, TOTP ciphertext | argon2id m = 64 MiB; TOTP key outside the backup; no passwords, links or session ids in clear anywhere (hashes of all three) |
| Insider administrator | other accounts | links for administrative targets only from the local channel; every issue / reset audited with actor; cannot read a password or a link after the response; cannot make a local user `system_admin` |
| Local user escalating into Home Assistant | HA | no HA credential exists; the bridge accepts only the configured service id with a feature allow-list enforced on both sides; automations writes refused; Ingress never names a local id; `is_system_admin` impossible |
| Local user abusing the service identity | HA entities beyond their Arx scope | Arx permission check (role + scope) precedes every bridge call, as today; the service HA user is non-admin; allow-list by feature and service |
| Login CSRF / session fixation | victim's browser | sign-in requires same-origin proof; a new sid on every sign-in; cookie `SameSite=Strict`, `HttpOnly`, `Secure`, path-scoped |
| XSS on the shared origin | cookie / tokens | `HttpOnly` cookie (unreadable); CSP of CR-008; no token in `localStorage` for local sessions |
| Denial of service against a person (lock them out) | availability | `delay` mode by default (a soft delay, never a hard lock); administrator unlock; the global tier never refuses accounts with a recent successful sign-in |
| Denial of service against the server (argon2 memory) | add-on availability | semaphore of 2 verifies; per-IP tier; low-memory profile; body limit |
| Log / proxy leakage | link tokens | token in the URL fragment; hashes only in the database; audit never stores the typed username |

## 17. Open decisions for the owner (numbered; short lettered options; the lead's recommendation marked *)

1. **אישור התיקון למפרט הזהות המחייב (סעיף 2).** א) מאשר את נוסח התיקון כפי שהוא, והפיצ'ר נבנה מאחורי מתג כבוי כברירת מחדל*
   ב) מאשר, אבל רק אחרי שהבנייה של USR1 מסתיימת ג) לא מאשר - נשארים עם משתמשי Home Assistant בלבד.
2. **מה קורה כשהרשאות של משתמש Arx-only עומדות בסתירה למדיניות הכניסה מרחוק (`remote.policy = flag`)?** א) משתמש Arx-only
   תמיד מורשה מרחוק - התפקיד הוא ההרשאה* ב) גם הוא צריך דגל "גישה מרחוק" פר משתמש.
3. **אילו תפקידים מותרים למשתמש Arx-only?** א) רק תפקידים ללא הרשאות ניהול (צופה, מפעיל, עורך, קיוסק, תפקידי טיקטים)*
   ב) גם `site_admin` בהיקף מוגבל (כולל `rbac.assign` באותו היקף) ג) כל תפקיד חוץ מ־`system_admin`.
4. **פעולות אזעקה (דריכה / נטרול) למשתמש Arx-only דרך זהות השירות?** א) מותר - לפי התפקיד וכללי ה־PIN הקיימים* ב) דריכה בלבד,
   נטרול אסור ג) אסור לחלוטין.
5. **איפוס סיסמה בשירות עצמי ("שכחתי סיסמה")?** א) לא - רק קישור ממנהל (בשלב 1)* ב) כן, לוואטסאפ מאומת בלבד, ורק למשתמשים בלי
   הרשאות ניהול ג) כן, לדוא"ל מאומת.
6. **אסימון לאפליקציה (refresh token) בנוסף ל־cookie?** א) לא - cookie בלבד, 30 יום* ב) כן, בשלב 5, לאפליקציה בלבד.
7. **אדם עם שתי זהויות (Home Assistant + Arx-only):** א) מותר, קישור ידני, השבתה של אחת מציעה (לא כופה) להשבית את השנייה*
   ב) אסור - אדם עם חשבון Home Assistant לא מקבל זהות Arx-only ג) מותר, והשבתה של זהות Home Assistant משביתה אוטומטית גם את השנייה.
8. **גיבוי:** א) ה־hash של הסיסמאות נכלל בגיבוי הפרויקט (שחזור למחשב חדש משאיר את המשתמשים)* ב) לא נכלל - אחרי שחזור כל
   משתמש Arx-only מקבל קישור כניסה ראשונה מחדש.

Defaults applied if the owner does not answer: the starred options.

## 18. Phased build plan (agent hours; design-only estimates, NOT measured)

| Phase | Content | Hours | Depends on |
|---|---|---|---|
| **P0** | CR document amending the identity contract (EN + HE), task cards, test catalogue rows, `roles.json` permission, settings registry | 4 | question 1 |
| **P1** | Identity store (0097), argon2id service + policy + denylist bundle, local-users routes, one-binding rule, first-login link (shown), sign-in + session store + cookie branch in `ha_user_auth`, sessions list / revoke extension, brute-force tiers, uniform errors, audit, janitor, login page second mode (RTL, he/en), settings screen "משתמשי Arx", directory-sync exemption (R11) | 44 | P0 |
| **P2** | Second-factor alignment (pending record, policy, resets revoke local sessions and device tokens), password change, reset links + WhatsApp delivery, local-only rule for administrative targets, unlock, notifications (`account_delayed`, `storm`, new location) | 14 | P1 |
| **P3** | Service identity: bridge message shape + both-side allow-list + options flow field, add-on `service_identity.py`, feature wiring (devices, alarm, cast, media, schedules), automations-write refusal, activity attribution, settings page + self-check, bridge version bump | 20 | P1, bridge release |
| **P4** | Passkeys (0098): registration / assertion, as second factor and passkey-first switch, WebView `assetlinks.json`, sessions list shows passkey use | 22 | P2 |
| **P5** | Backup / restore identity member, CSV export, soft / hard delete + purge, retention janitor, Hebrew user-guide page, API inventory, security review round (public surface: sign-in, set-password) | 14 | P1-P3 |
| **Total** | | **118** | |

Each phase ends with a tier-M gate on the runner; P1 and P4 end with a tier-L gate (release-sized surfaces).

## 19. Test plan (negative-first)

Backend (`smplwise_vms/backend/tests/test_local_identity*.py`, fixtures / in-process, no device):

1. Unknown username and wrong password return byte-identical bodies and status; timing of unknown vs known within the dummy-hash
   envelope (assert both ran a hash: counter on the hasher).
2. Per-account delay doubling and cap; `lock` mode; administrator unlock; successful sign-in clears; the delay is applied before
   the answer; notification after the 10th failure.
3. Per-IP 429 with `Retry-After`; audit throttle one row / address / minute; `CF-Connecting-IP` used only on tunnel requests.
4. Global storm: 2 s wait, refusal of accounts without a recent success, administrators notified once per hour.
5. Password policy: too short, common (denylist sample), contextual (username, site name), repeated / keyboard run, NFKC
   normalisation, 128-byte cap; the refusal never echoes the password.
6. Links: single use, expiry, invalidation by a newer link / disable / delete / password change; unknown / used / expired
   indistinguishable; token never in a log line (assert the audit row and the log capture contain no 43-char base64url string);
   administrative target -> issue refused on the remote channel (404) and `whatsapp` refused; `must_enrol` when required.
7. Sessions: cookie attributes; `l.` prefix routing; persistence across a process restart; absolute and idle expiry; rotation
   (24 h, password change, factor enable, permission change) with the 60 s grace; list / revoke / label / sign-out-everywhere
   covering both kinds; a revoked session's WebSocket closes; administrator-session caps for administrative permission holders.
8. Login CSRF: sign-in without `Origin` / `Sec-Fetch-Site` refused; cross-site refused; the existing CSRF suite still green.
9. Ingress: a request naming a local id in `X-Remote-User-Id` from the proxy address is refused (the id form `l_...` is never
   accepted from headers - explicit check, since Ingress trust is by address).
10. RBAC: `system_admin` and refused roles rejected for local subjects; second binding refused; group membership refused;
    `is_system_admin` false; `remote_basis` = `local`; `permissions_fingerprint` moves on role change and the session rotates.
11. Directory sync: a full push without the local id does **not** deactivate it; HA active flag never written onto a local row.
12. Service identity: bridge refuses `on_behalf_of` with a non-service `user_id`, an unknown feature, a service outside the
    feature's list; add-on refuses the same before sending; automations write for a local principal -> 403 with its own code;
    activity attribution to the local person via context link; the configured service id missing -> `service_identity_unconfigured`.
13. Second factor: pending record expiry, code lockout reuses CR-011 tables, factor enable / reset revoke local sessions and device tokens.
14. Backup: identity member round-trips; sessions / links / failures / TOTP excluded; restore with an archive member named like a key refused.
15. Deletion: soft delete revokes everything; purge after 30 days anonymises, keeps the row, releases the username.
16. Audit: no row's `details_json` or `actor_username` contains a typed unknown username, a password, a link token or a code.

Frontend (Playwright, mocked backend): login page mode switch, RTL and English, uniform error rendering, pending second-factor
step, welcome / set-password page with fragment token, sessions list with `kind: local` rows and labels, settings "משתמשי Arx"
create -> link shown once -> copy, administrative-target link action hidden on the remote channel.

Needs a **real device / real installation** (NOT_RUN until then; recorded as such in `test_catalog.json`): the cookie surviving
an Android WebView restart and an iOS shell restart for 30 days; sign-in through the real Cloudflare tunnel with `CF-Connecting-IP`;
passkey registration and assertion on a real Android (WebView + `assetlinks.json`) and a real iPhone; WhatsApp delivery of a
first-login link to a confirmed number; the bridge service identity against the owner's HA with a real non-admin service user;
argon2id timing on the owner's actual host (choose the memory profile from measurement).

## 20. NOT_VERIFIED (explicit)

1. `argon2-cffi` wheels for the add-on base image architecture / libc (fallback scrypt specified).
2. `py_webauthn` version and WebView passkey behaviour on the iOS shell; Android per CR-011 §2.3 facts (reported, not re-run).
3. Cloudflare: that `CF-Connecting-IP` cannot be spoofed on the tunnel path in the owner's setup; that the HTML of `/arx/#/welcome`
   is not cached in a way that breaks the fragment flow.
4. Where the e-mail notification channel takes an HA user's address from today.
5. Whether USR1 can create an HA user without any credential (for the service identity) and the HA `users` group's effective
   entity permissions on the owner's HA version.
6. The tickets module's exact link-token technique (fragment vs path) - alignment only.
7. Bridge minimum version and options-flow change for the service id.
8. All hour estimates.

## 21. One-page summary for the owner (decisions required)

**Approve first:** amend the identity contract so that two identity sources exist (question 1). Without it nothing ships.

**Then eight decisions** (section 17; starred options are the defaults the lead will build if unanswered):

1. Contract amendment - approve now and build behind an off switch* / after USR1 / reject.
2. Remote admission of Arx-only users - the role is the admission* / also a per-user remote flag.
3. Roles allowed - non-administrative roles only* / also scoped `site_admin` / anything but `system_admin`.
4. Alarm via the service identity - by role and PIN rules* / arm only / never.
5. Self-service "forgot password" - not in phase 1* / WhatsApp for non-administrators / e-mail.
6. App refresh token - no, cookie only* / yes, phase 5.
7. Two identities for one person - allowed with a manual link and a prompt to disable both* / forbidden / cascading disable.
8. Password hashes in the project backup - included* / excluded (re-onboard after a restore).

**What you get in phase 1 (about 44 agent hours):** Arx-only users created from "משתמשים והרשאות", first login by a one-time
link you hand over, sign-in on the remote address and in the app, one role each, devices list with sign-out, brute-force
protection, full audit, no path into Home Assistant. **Phase 2 (14 h)** adds the second factor and resets; **phase 3 (20 h)** makes
device control / alarm / cast / media / schedules work for these users through the service identity; **phase 4 (22 h)** passkeys;
**phase 5 (14 h)** backup / export / deletion / guide. **Total about 118 hours**, estimates not measured.
