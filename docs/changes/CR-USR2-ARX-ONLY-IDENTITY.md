# CR-USR2 - Arx-only identities: amendment of the binding identity contract

**CR number:** provisional (`CR-USR2`); the lead assigns the next free CR number at integration.
**Status:** APPROVED by the owner on 2026-10-16 (answer to question 1 of the USR2 design record: "approve the contract amendment,
the feature ships behind a switch `security.local_identity`, default OFF"). The approval was relayed by the lead in the USR2-P0P1
task brief; this document records it and the other seven answers.
**Design record:** `docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md` (branch `pilot/USR2-spec` @ 807facfe).
**Amends:** `docs/security/HA_IDENTITY_RBAC_HE.md` v1.1 section 1 ("no new password system ...") and section 4 [H04] ("a standalone
path ... uses HA authentication and not an additional password database"), and - by the precedence rule (approved change request >
`MASTER_SPEC_HE.md` and `docs/security/` > `AGENTS.md`) - the sentence of the `AGENTS.md` v1.1 amendment "HA is the only human
identity source; local VMS records contain bindings, not passwords". `AGENTS.md` itself is not edited by this change (it is the
agents' operating contract); the lead / owner updates its wording, and until then this CR takes precedence over that sentence.
**Implementation:** phase P0 + P1 on `pilot/USR2-P1` (migration 0096 - provisional 0097, renumbered at integ/264); USR2-FIX on `pilot/USR2-FIX`
(section 7); phase 2 on `pilot/USR2-P2` (section 8, no migration).

---

## 1. The amendment (normative text)

> **§1a (USR2).** Two identity sources exist: **Home Assistant** (unchanged, the default, and the only source that can hold
> `system_admin`) and the **Arx local store** (`users.source = 'local'`, ids `l_` + 26 characters), for people who must never hold a
> Home Assistant account. The feature is behind the setting `security.local_identity` (`off` by default; only a VMS system
> administrator changes it; switching it off ends every local session; a backup restore never switches it on).
>
> 1. A local identity holds **exactly one Arx role at one scope** - any role except `system_admin` (and therefore no role carrying a
>    system permission, which only `system_admin` holds, and never `identity.local.manage`); no deny binding, no group membership.
>    It never holds any Home Assistant credential and `is_system_admin` is never true for it.
> 2. A local identity signs in **only on the remote channel** (`/arx`). Ingress stays Home Assistant's door: an Ingress request that
>    names an id of the local form is refused whatever its source address. The role alone admits a local identity to the remote
>    channel - no per-user remote-access flag applies to it.
> 3. **Administrative targets.** A local identity whose role carries an administrative permission - `rbac.assign`,
>    `identity.directory.read`, `system.configure`, `identity.local.manage` or any system permission (`rbac.roles.manage`,
>    `sources.configure`, `audit.read`, `backup.manage`, `nvr.configure`, `system.update`) - can **use** those permissions only in a
>    session whose sign-in presented a valid TOTP second factor (CR-011). Until the user has enrolled a factor and signed in with
>    it, every such permission is refused (`second_factor_required`) - fail closed - while the rest of the role keeps working. In
>    addition, for an administrative target: its sessions last at most 7 days (`security.local_admin_session_days`, 1-7) and 24 hours
>    idle, whatever the session mode; creating it, issuing its first-login or reset links and giving it an administrative role are
>    possible **only from the local (Ingress) channel**, and its links are **never sent by WhatsApp**; self-service password reset
>    is never available to it.
> 4. Password reset: per user, the administrator chooses `manager_only` (default: every reset is a link issued by a manager) or
>    `self_service` (the user may reset through a code sent to the verified WhatsApp number, with the design record's rate
>    limits). `self_service` is refused for a user holding an administrative permission - whoever controls the phone number would
>    otherwise take over an administrator - and an administrative role switches a user back to `manager_only`.
> 5. Everything a local identity does in Home Assistant runs through the add-on's **service identity** under a per-feature
>    allow-list enforced on both sides (USR2 §12, phase 3); automation / scene / script writes stay refused to it. Until phase 3 a
>    Home Assistant action of a local identity is refused (fail closed) - including voice announcements, which run on the add-on's
>    own infrastructure token (USR2-FIX F4: `media.announce` answers 403 `local_identity_not_allowed` for a local principal).
> 6. Local credentials are **memory-hard password hashes only**, stored as PHC strings (argon2id when the argon2-cffi library is
>    present in the add-on image; until that is verified, scrypt N=2^17, r=8, p=1, 128 MiB - or N=2^16 on a host under 1 GiB);
>    no password, link token or session id is ever stored, logged, audited, exported or returned in clear (hashes of all three).
>    The password hashes travel in the access part of a project backup; sessions, links, failure counters and TOTP secrets never do
>    (the counter / lock columns of `auth_local_credentials` - `failed_count`, `last_failed_at`, `delay_until`, `unlocked_by` - are
>    left out of every archive and ignored when an older archive carries them; USR2-FIX F9).
> 7. One person may hold both a Home Assistant identity and a local identity (two user rows, a manual informational link);
>    authority is never unioned across them, and disabling one only **suggests** disabling the other.

### Hebrew mirror (§1א)

> **§1א (USR2).** קיימים שני מקורות זהות: **Home Assistant** (ללא שינוי, ברירת המחדל, והמקור היחיד שיכול להחזיק `system_admin`)
> ו**מאגר הזהויות המקומי של Arx** (`users.source = 'local'`, מזהים `l_` + 26 תווים) לאנשים שאסור שיהיה להם חשבון ב־Home Assistant.
> היכולת מאחורי ההגדרה `security.local_identity` (כבויה כברירת מחדל; רק מנהל מערכת VMS משנה אותה; כיבוי מנתק כל כניסה מקומית;
> שחזור גיבוי לעולם לא מדליק אותה).
> 1. לזהות מקומית **תפקיד Arx אחד בהיקף אחד** - כל תפקיד חוץ מ־`system_admin` (ולכן לא תפקיד עם הרשאת מערכת, ולעולם לא
>    `identity.local.manage`); בלי חסימות ובלי קבוצות; בלי שום הרשאת Home Assistant.
> 2. זהות מקומית נכנסת **רק בערוץ המרוחק** (`/arx`). Ingress נשאר הדלת של Home Assistant: בקשת Ingress שמציינת מזהה בצורה המקומית
>    נדחית. התפקיד לבדו מתיר גישה מרחוק - אין דגל גישה מרחוק פר משתמש.
> 3. **יעדי ניהול.** זהות מקומית שתפקידה כולל הרשאת ניהול (`rbac.assign`, `identity.directory.read`, `system.configure`,
>    `identity.local.manage` או כל הרשאת מערכת) יכולה **להשתמש** בהרשאות האלה רק בכניסה שהציגה קוד TOTP תקף; עד שהמשתמש הפעיל
>    אימות דו־שלבי ונכנס איתו - כל הרשאה כזו נדחית (`second_factor_required`), ושאר התפקיד ממשיך לעבוד. בנוסף: כניסה של יעד ניהול
>    נמשכת לכל היותר 7 ימים ו־24 שעות ללא פעילות; יצירתו, הפקת קישורי כניסה ראשונה / איפוס ומתן תפקיד ניהול - **רק מכניסה מקומית**,
>    והקישורים **לעולם לא נשלחים בוואטסאפ**; איפוס עצמי לא זמין לו.
> 4. איפוס סיסמה: פר משתמש המנהל בוחר `manager_only` (ברירת מחדל) או `self_service` (קוד לוואטסאפ המאומת). `self_service` נדחה
>    למשתמש עם הרשאת ניהול - מי שמשתלט על המספר היה משתלט על מנהל.
> 5. כל פעולה של זהות מקומית ב־Home Assistant עוברת דרך **זהות השירות** של התוסף עם רשימת היתר לכל תכונה (שלב 3); עד אז - נדחית.
> 6. נשמרים רק hash של סיסמאות (PHC: ‏argon2id כשהספרייה קיימת בתמונה, אחרת scrypt); שום סיסמה, אסימון קישור או מזהה כניסה לא
>    נשמרים, נרשמים או מיוצאים בגלוי. ה־hash נכלל בגיבוי הפרויקט (חלק ההרשאות); כניסות, קישורים, מוני כישלונות וסודות TOTP - לא.
> 7. אדם יכול להחזיק גם זהות Home Assistant וגם זהות מקומית (שתי שורות, קישור ידני לתיעוד בלבד); הרשאות לעולם לא מתאחדות, והשבתה
>    של אחת רק **מציעה** להשבית את השנייה.

## 2. Owner answers (2026-10-16, final) and where each is implemented

| # | Answer | Phase 1 implementation |
|---|---|---|
| 1 | Approve the amendment; ship behind `security.local_identity`, default off | This CR; `routers/settings.py` DEFAULTS + patch (system_admin only, audited `identity.local.feature_enabled/disabled`, off revokes every local session); `services/backup.py` SETTINGS_KEEP |
| 2 | An Arx-only user is always allowed remotely; the role is the permission | No flag / `remote.policy` check on the local path; `access._users` shows `remote_access_basis: "local"` |
| 3 | Any role except system_admin, with every administrative-target protection | `services/local_identity.role_refusal`, `routers/access.local_binding_check`; `rbac.LOCAL_ADMIN_PERMISSIONS` + `local_factor_gate` in `authorize` / `effective_permissions` / `permissions_anywhere`; 7-day / 24 h cap at creation and on every use; local-channel-only create / link / admin role; WhatsApp refused for admin targets |
| 4 | Alarm arm / disarm through the service identity per role and PIN rules | Phase 3 (service identity). Phase 1: the remote alarm rules (`alarm.remote_control`, `alarm.remote_disarm`, `alarm.remote_codeless`) already apply to local principals (`routers/alarm.py`, `services/schedule_view.py` treat `source = local` as remote) |
| 5 | Both reset kinds, chosen per user (`manager_only` default / `self_service`), self-service refused for admins | `auth_local_credentials.reset_mode`, create / PATCH validation, admin role switches back to `manager_only`; manager-issued links (`POST .../link`). Phase 2 (section 8): the self-service flow (WhatsApp code), refused at the moment of use for an administrator; links by WhatsApp for non-administrators only |
| 6 | App refresh token, app only - later (P5) | Not built. Schema compatible: `auth_local_sessions.kind IN ('browser','app')`, chain model, hashed ids |
| 7 | Both identities allowed, manual link, disable suggests | `identity_links` (migration 0096), `PUT/DELETE /identity/local-users/{id}/ha-link`, PATCH active answers `suggest_also` |
| 8 | Hashes in the project backup; sessions / links / failures / TOTP excluded | `services/backup.py` ACCESS_TABLES gains `auth_local_credentials`, `identity_links`; `NEVER_EXPORTED_COLUMNS` keeps the failure counter / lock columns out (USR2-FIX F9) |

**Exact rule implemented for answer 3 (normative for the code):** `rbac.authorize(conn, principal, permission, target)` returns
`Decision(False, "second_factor_required")` before looking at any binding when `principal.source == "local"`,
`permission ∈ LOCAL_ADMIN_PERMISSIONS` and `principal.factor_ok` is false. `principal.factor_ok` is true only when the session row's
`factor_at` is set, which happens only when the sign-in passed `POST auth/local/sign-in/second-factor` with a valid TOTP code, or
when the user enrolled a factor from inside that very session (`auth/second-factor/confirm`: the session rotates and records the
factor). `effective_permissions` and `permissions_anywhere` leave the same permissions out, so the shell never offers them. A user
whose TOTP policy is `required` (user / role override, or the global `admins` policy for an administrative target) and who has not
enrolled gets a session that reaches only `/me`, `/auth/second-factor*`, `/auth/session`, `/auth/sessions*`, `/auth/local/password`
and `/auth/remote-config` (403 `second_factor_enrollment_required` elsewhere).

## 3. Phase 1 scope (built) and what follows

Built (P0 + P1): this CR; the permission `identity.local.manage` (system_admin only, a system permission: never in a custom role,
never delegable); the settings keys; migration 0096; `services/local_passwords.py` (hashing, policy, local denylist);
`services/local_identity.py` (sessions, tiers, links, janitor); `routers/local_identity.py`; the cookie branch in
`services/ha_user_auth.py`; the sessions list / revoke extension; the one-binding rule; the directory-sync exemption (R11); the TOTP
sign-in step and the administrative-permission rule; the sign-in page mode and the welcome (set-password) page; the settings tab
"משתמשי Arx".

Later phases (design record §18) - **P2 is built (section 8)**: P2 self-service reset through WhatsApp, WhatsApp link delivery, notifications
(`auth.local.account_delayed`, `auth.local.account_locked`, `auth.local.storm` - global tier and hashing admission - and new
location; phase 1 writes them as audit rows only: wiring them into the notification centre (`services/notify.emit`, a `security.*`
source to managers) is a phase-2 item and should ship with the switch if the owner turns it on before P2 - security review F7), the
point-of-use self-service refusal for a user who holds an administrative permission NOW (F6), P3 the service identity (bridge message shape, both-side
allow-list, device control / alarm / cast / media / schedules), P4 passkeys, P5 the app refresh token (answer 6), purge after 30
days, `GET /me/export`, the Hebrew user guide, the API inventory and the security review round.

## 4. Exposed surfaces (for the security review)

| Surface | Who can reach it | Controls |
|---|---|---|
| `POST /arx/api/v1/auth/local/sign-in` | anyone on the internet (through the tunnel) | remote only; 403 while off; login CSRF (same-origin proof); https behind the tunnel; per-address tier 20 / min, 100 / h, 300 / day (429 + Retry-After, audit throttled); per-(account, source network) delay from the 5th failure in 15 min (30 s doubling to 15 min, sleep <= 3 s on the event loop); per-account ceiling 50 failures in one fixed 15-min window from all networks -> 15-min lock, audited, administrator unlock (section 7); unknown names follow both schedules in memory; global tier 300 failures / 10 min (2 s wait, stale accounts refused); bounded hashing admission (2 dedicated threads + 8 waiters, beyond: uniform 429 + Retry-After without hashing); uniform 401 body; one hash computation on every path (dummy hash, made once per process before the lookup); 128-byte cap; stored hash parameters capped at the shipped profiles |
| `POST /arx/api/v1/auth/local/sign-in/second-factor` | holder of a 5-minute pending cookie (random 256-bit id, memory only, Path = the sign-in route) | 5 attempts per pending record; CR-011 lockout (5 wrong / 5 min -> 10 min, persisted); per-address 20 / min |
| `POST /arx/api/v1/auth/local/set-password` | holder of a link token (fragment of the URL) | 10 / min / address; the same bounded hashing admission (429 beyond it); SHA-256 of the token stored; single use, 1-168 h, invalidated by a newer link / disable / delete / password change; uniform 401 `link_invalid`; policy check; no session created; every session of the user ends |
| Session cookie `l.<43>` under `__Secure-arx_session` | the signed-in browser / app WebView | HttpOnly, Secure (behind https), SameSite=Strict, Path=/arx/; SHA-256 stored; rotation (sign-in, 24 h, password change, factor enrolment, permission change) with a 60 s grace; absolute + idle expiry; existing CSRF middleware; revocation empties the 15 s cache at once; WebSockets attached per chain and closed on revoke |
| `/api/v1/identity/local-users*` | `identity.directory.read` (read) / `identity.local.manage` (write) - system administrators | audited; links returned once and never readable later; admin targets local-channel only (404 remotely); CSV with formula neutralisation |
| `/api/v1/access/bindings` (+ `/bulk`, and every route built on `validate_binding`) for a local subject | `rbac.assign` holders | one allow binding, no system role; an administrative role only from the local channel (404 remotely, or when the caller's channel is unknown - fail closed; USR2-FIX F1); binding an administrative role invalidates the user's open links |
| `PUT /auth/local/password`, `PATCH /auth/sessions/{id}` | the local user itself | current password (+ TOTP when enrolled); 5 / min per user |
| Ingress headers | the Supervisor proxy address | an `l_` id in `X-Remote-User-Id` is refused |
| Bridge directory push | the paired bridge (HMAC) | `l_` ids ignored; `source = 'local'` rows never mirrored or dropped |

## 5. Rollback

Switch `security.local_identity` off (every local session ends; nothing else changes). Code rollback: revert the branch; migration
0096 is additive (new tables, nullable columns) - older code ignores them; the `identity.local.manage` permission in `roles.json`
is unknown to older code and harmless.

## 6. NOT_VERIFIED

1. argon2-cffi wheels for the add-on image (Alpine 3.22 musl, amd64 + aarch64): not checked here, so the dependency is not added
   and scrypt is the active algorithm (PHC prefix `$scrypt$`; an `$argon2id$` row verifies only when the library is present).
2. scrypt cost on the owner's host (N=2^17 is 128 MiB per computation; two at most at once): not measured.
3. Cloudflare: that `CF-Connecting-IP` cannot be set by a caller on the tunnel path (only the per-address tier trusts it); that
   cloudflared sends `X-Forwarded-Proto: https` (the https check refuses only an explicit `http`).
4. The phone app WebView keeping the cookie for 30 days across restarts (Android / iOS): needs real devices.
5. The tickets module's link-token technique (fragment vs path) - the welcome link uses the fragment.

## 7. USR2-FIX - closing the security review's FIX FIRST items (2026-10-16)

Review: `private/planning/RELEASE_USR2_P1_SECURITY_REVIEW_2026-10-16.md` (verdict FIX FIRST before `security.local_identity` is
switched on anywhere). Branch `pilot/USR2-FIX` (cut from `pilot/USR2-P1` @ 7ee88ea6). Every fix has a regression test that failed
on 7ee88ea6 (`tests/test_local_identity.py`, `tests/test_local_identity_units.py`).

| # | Resolution |
|---|---|
| F1 (P2) | `access.local_binding_check` refuses a role carrying an administrative permission for a local subject unless the request is on the local channel (`validate_binding(..., request)`; no request = treated as remote, fail closed). The refusal is the dedicated routes' 404 `not_found`, audited `rbac.bind` denied `local_admin_target_remote`. `insert_binding` invalidates every open link of a local user that receives an administrative role (generic route, bulk, `PUT /identity/local-users/{id}/role`), audited `auth.local.link.invalidated` reason `admin_role`. Test: the exact attack (remote viewer -> generic revoke -> generic site_admin bind) is refused, and the local promotion kills the remotely minted link. |
| F2 (P2) | Brute-force semantics below. A guesser's failures never refuse the person's correct password from another network. |
| F3 (P2) | The public hashing routes (`sign-in`, `set-password`) run their blocking work in a dedicated 2-thread executor (`arx-hash`) awaited on the event loop, behind a bounded admission of 2 + 8 requests; beyond it: uniform 429 `rate_limited` + `Retry-After: 5` without hashing, for every username alike, one throttled `auth.local.storm` (reason `admission`) audit row a minute. The shared worker pool of the other routes is never used by them. |
| F4 (P3) | `services/announcements.announce` refuses a local principal before anything else: 403 `local_identity_not_allowed`, audited `media.announce` denied `local_identity_ha_action`; nothing is spoken. Door opening and video keep running on the add-on's authority as the design record allows - recorded, not changed. |
| F5 (P3) | `_parse_scrypt` accepts only parameters within the shipped profiles (ln <= 17, r <= 8, p <= 1, maxmem <= 160 MiB, 8-64-byte salt, 32-byte hash); argon2 strings are checked (m <= 128 MiB, t <= 10, p <= 4) before the library is touched; `ValueError` / `MemoryError` / `OSError` during a computation is a failed verification (uniform), never a crash. |
| F9 (P3) | Excluded from the backup (not a wording change): `backup.NEVER_EXPORTED_COLUMNS`. |
| F11 (functional) | Chosen option: the forced password change after a temporary link (`must_change`) of an enrolled user accepts the TOTP code that THIS session's sign-in presented (`factor_at` on the session row - an enrolled user never gets a session without it; the session can reach nothing but the password route while `must_change` is set). No second code is asked; every other password change of an enrolled user still requires a fresh code. Backend only; the login page's change step works unchanged. |

**Brute-force semantics (normative after USR2-FIX F2):**
- **Per (account, source network)**, in memory: the key is the typed name (normalised, hashed) plus the network bucket of
  `limit_ip` (an IPv4 address, or an IPv6 /64). From the 5th failure within 15 minutes of quiet (the window restarts after 15 min
  without a failure from that network) every attempt of that name from that network - also with the right password - is refused
  with the uniform 401 after a sleep of min(delay, 3 s); the delay is 30 s doubling to 15 min. A success from that network clears
  it. Known and unknown names follow exactly the same schedule. Not persisted (a restart clears it).
- **Per account ceiling**, in `auth_local_credentials` (`failed_count`, `last_failed_at`, `delay_until`): failures from all networks
  together are counted in fixed, clock-aligned 15-minute windows; the 50th failure in one window locks the account for 15 minutes
  (`delay_until`) - every sign-in, also with the right password and from any network, is refused with the uniform 401 - and writes
  the audit row `auth.local.account_locked` (reason `ceiling`). It ends by time or by `POST /identity/local-users/{id}/unlock`
  (`identity.local.manage`), which also clears every network's delay of the name. An unknown name has the same ceiling in memory, so
  the lock is not an existence signal. Keeping a named account locked therefore needs ~50 counted failures every 15 minutes, which
  the per-network delay limits to about 9 per network: at least six networks continuously - visible in the audit.
- `auth.local.account_delayed` (audit) is written when one network reaches its 10th failure on a known account.
- `security.local_lock_mode` no longer changes behaviour; it only names the network-tier refusal in the audit
  (`account_delay` | `account_locked`).
- Per address (20 / min, 100 / h, 300 / day) and the global storm tier are unchanged.

**Accepted / deferred (not changed by USR2-FIX):**
- F6 (P3) - deferred to phase 2: the self-service reset flow is not built, so a stale `reset_mode` cannot be used; phase 2 refuses
  self-service at the point of use when the user holds an administrative permission now.
- F7 (P3) - accepted for phase 1 as anti-spraying (design record); the notification wiring of `auth.local.storm` /
  `auth.local.account_delayed` / `auth.local.account_locked` is on the phase-2 list (section 3) and should ship with the switch if it
  is turned on earlier; raising `GLOBAL_STORM_AT` or counting distinct accounts is part of that item.
- F8 (P3) - accepted: the known/unknown timing delta is a few ms against a 300-600 ms scrypt and Cloudflare jitter; write-behind of
  the counter is a later hardening item.
- F10 (P3) - accepted design risk approved in section 2 (in-session enrolment counts as the factor); a local-channel-only enrolment
  for administrative targets is a later-phase option for the owner.
- F12 (P3) - accepted as an installation prerequisite: port 8099 is never mapped on the host and cloudflared always sends
  `X-Forwarded-Proto: https` (NOT_VERIFIED item 3).
- F13 (P3) - accepted: same address-trust posture as the existing HA sign-in limiter; the per-account and global tiers do not depend
  on it; prerequisite as F12.

## 8. Phase 2 (USR2-P2, 2026-10-16) - self-service reset, WhatsApp links, notifications

Branch `pilot/USR2-P2` (cut from `pilot/USR2-FIX` @ f5ea0c2d); persistence follow-up `pilot/USR2-P2B` (cut from `pilot/USR2-P2` @
1b893bb8) with **migration 0097 (provisional 0102, renumbered at the integ/264 integration)**; see "Persistence (USR2-P2B)" below.
Everything stays behind `security.local_identity` (off by default): the new public routes
answer 403 `local_identity_off` while it is off and 404 on the local channel, and nothing else changes with the switch off.

**Owner answer Q5 (final), as built:** both reset modes, chosen per user (`reset_mode`).

| Item | Built | Where |
|---|---|---|
| Self-service "forgot password" | `POST /arx/api/v1/auth/local/reset/request {username}` - **always the same 202** (unknown name, `manager_only`, no password yet, administrator, no verified number, channel down, a cap: alike; the message leaves later on the sender thread, so no answer waits for WhatsApp). `POST /arx/api/v1/auth/local/reset/confirm {username, code, password}` - 200 `{must_enrol}` / uniform 422 `code_invalid` / 400 `password_policy` (only after a correct code; the code stays live) / 429. Success: the password policy of §6.2, `set_by = 'self_service'`, every session and open link of the user ends, the per-network delays of the name and the ceiling counter clear, **no session is created** (the page signs in normally, so the TOTP step still applies). | `services/local_reset.py`, `routers/local_identity.py` |
| Code rules (as the tickets code engine) | 6 digits (OS random); stored only as HMAC-SHA256(reset key, `lr`, code id, user id, **credential fingerprint** (password hash + set_at), **number key**, code) - a password set in between, or a changed number, kills it; the reset key is HMAC(`k_messaging` file, label), never in the database or a backup (USR2-P2B); 10 minutes; single use (one `UPDATE ... SET consumed = 1 WHERE consumed = 0` in the confirm's write transaction, before the hash; rowcount 1 wins); one live code per user; 5 wrong guesses end it; 1 send / 60 s and 5 / day per user, 5 / day per number, 50 / day per installation; per address 5 / min + 20 / h (request) and 10 / min + 40 / h (confirm); the confirm runs in the bounded hashing admission (F3) and hashes only after a correct code. | `services/local_reset.py` |
| Administrative user refused at the moment of use (F6) | The eligibility rule (`active`, has a password, `reset_mode = self_service`, **not `holds_admin` now**) runs at the request AND again at the confirm, whatever `reset_mode` says; a custom role that gained `rbac.assign` after the code was sent makes the correct code fail (audited `admin_target`). The live code also ends on disable / delete / switch back to `manager_only`. | `local_reset._refusal` |
| Verified number | The user's own tickets directory row (`ticket_contacts.user_id`, active, not erased) with `phone_confirmed_at` (TKSTAFF1: confirmed by the user). Where 2.6.3's number verification is merged (`phone_confirmed_via`), only `user` / `code` count (never a manager's mark) and `tickets.phone_verify.confirmed()` must agree. | `local_reset.verified_number` |
| Delivery | The tickets / NOTIFWA WhatsApp infrastructure through its public functions: a new account use `identity.local` ("איפוס סיסמה וקישורי כניסה של משתמשי Arx", Settings › ערוץ ההודעות; inherits the `tickets.messages` account when not set; shown while the switch is on), the adapter `WhatsAppChannel`, the pacing gate over the shared send ledger (kind `code` / `message`), `notify_whatsapp.transport()`. Fixed code-owned texts in he / en / ar / ru by the contact's language (**ar and ru need a native review**), no username or name, never editable, never held by send hours. A code that ended before its message left is never sent. | `local_reset.Sender`, `TEXTS` |
| Manager link by WhatsApp | `POST identity/local-users/{id}/link {via: whatsapp}` is real for a **non-administrative** target: 409 `no_verified_number` / `whatsapp_unavailable` / `public_url_unknown`; on success the link row says `issued_via = whatsapp`, the token exists only in the sender's memory and **the answer never carries it** (`{via, expires_at, queued}`). An **administrative target** keeps 422 `whatsapp_not_for_admins` on every channel (and its links stay local-channel only - phase 1). | `routers/local_identity.issue_local_link` |
| Where WhatsApp links point | New setting `security.local_public_url` (`https://<dns name>` only - no IP literal, path, query, user part, port other than 443; default empty). **System administrators only** (whoever sets it decides where reset tokens go), audited `identity.local.public_url`, never restored from a backup (`SETTINGS_KEEP`). Without it a link can be sent only from a remote session (its own host). | `routers/settings.py`, `local_reset.normalize_public_url` |
| Notifications (F7) | `auth.local.storm` (global tier and hashing admission), `auth.local.account_delayed` (10th failure from one network) and `auth.local.account_locked` (the ceiling) now also emit notification-centre signals `security.local_storm` / `security.local_account_delayed` / `security.local_account_locked` (category security, recipients `managers`, subject `system` = system.configure visibility, fold window 1 h, content-free: never a username, address or person). | `services/notify_policy.py`, `local_identity._notify` |
| Storm cost (F7) | The global storm now needs `GLOBAL_STORM_AT` (300) failures **from at least `GLOBAL_STORM_NETWORKS` (5) distinct networks** (IPv4 address / IPv6 /64); restored counters count as one network. Two addresses at the per-address allowance no longer refuse every dormant account. | `local_identity._Tiers.storm` |
| Settings UI | Per-user reset mode with the reasons it is refused (administrator; no verified number), the user's verified WhatsApp state (`····NN`), "link by WhatsApp" for non-administrators only (the administrator note otherwise), the "sent to ····NN, valid until" confirmation without the link, the public link address field. The sign-in page: "שכחתי את הסיסמה" (local mode only) -> username -> code + new password twice -> back to sign-in with the username filled. he / en strings. | `frontend/src/screens/system-local-users.ts`, `frontend/src/arx/arx-login.ts`, `frontend/src/arx/local-auth.ts`, `frontend/src/i18n/local-identity.ts` |

New audit actions (ids only; never a code, a number, a token or a typed username): `auth.local.reset.requested` (reason:
`unknown_user` (throttled per address), `inactive`, `no_password`, `manager_only`, `admin_target`, `no_verified_number`,
`channel_unavailable`, `cooldown`, `cap_user`, `cap_number`, `cap_installation`, `busy`; allowed rows carry a 12-hex code id),
`auth.local.reset.refused` (`unknown_user`, `no_code`, `malformed`, `invalid`, plus the eligibility reasons), `auth.local.reset.completed`,
`auth.local.password.changed` (`via: self_service`), `auth.local.delivery` (kind, ref, outcome, account key), `identity.local.public_url`.

**Exposed surfaces added to §4:** `POST /arx/api/v1/auth/local/reset/request` and `.../reset/confirm` - anyone on the internet
(through the tunnel); remote only; 403 while off; login CSRF; https; the limits and the uniformity above.

**Deviations from the brief / design record (recorded, not silently resolved):**
1. The brief named "the existing WhatsApp outbox (fixed template purpose like phone_verify)". `phone_verify` and the outbox's fixed
   purposes exist only on `integ/263` (2.6.3), not on this base; adding a purpose to `ticket_outbox` needs a table rebuild (its CHECK)
   that would collide with 2.6.3's single rebuild (0089). Chosen instead: the same WhatsApp infrastructure (account use, adapter,
   pacing, shared ledger, transport) with an in-memory sender - so there is **no outbox row at all** and the code is never stored.
2. ~~Codes and caps live in memory (no migration).~~ **Superseded by USR2-P2B (owner decision 2026-10-16, option b): codes and caps
   are persistent** - see "Persistence (USR2-P2B)" below. (The phase-2 build kept them in memory; a restart ended every live code
   and started the caps afresh.)
3. The design record's "notification after the 10th failure" fires only when one network really reaches 10 counted failures
   (the per-network delay stops counting while it runs, so a single guesser reaches it after the delays expire); the ceiling
   notification covers the many-network case.
4. Notification texts follow the catalogue rule "never a person": they do not name the account; the audit row and the Settings tab
   show which one.

**Persistence (USR2-P2B, owner decision 2026-10-16 option b).** The self-service codes and their counters survive an add-on
restart. Migration **0097 (`0097_local_reset_codes.sql`; provisional 0102, renumbered at the integ/264 integration)**, additive:

| Object | What it holds | Notes |
|---|---|---|
| `auth_local_reset_codes` | one row per user (PK `user_id`, FK users ON DELETE CASCADE): `code_id`, `code_mac` (the HMAC above), `number_key` (keyed hash of the number), `created_at` / `expires_at` (epoch), `attempts` used, `consumed` (0/1) | a new request replaces the row (attempts / consumed start afresh); the confirm reads, counts a wrong guess (`attempts + 1`, committed with the uniform 422) and consumes with `UPDATE ... WHERE consumed = 0` (rowcount 1 wins; the confirm runs under `BEGIN IMMEDIATE`, so a parallel confirm waits and then finds the row consumed / gone; a failure after it rolls the consumption back) |
| `auth_local_reset_sends` | one row per code sent: `sent_at`, `user_id` (no FK: a deleted user must not hand the number / installation a fresh budget), `number_key` | the 60 s cooldown and the per-user / per-number / per-installation daily caps are counted from the rows of the last 24 h, inside the request's write transaction |
| triggers | delete a user's code on a password / set_at / reset_mode change of the credential row (also a sign-in re-hash - the MAC already died with it), on a disable or a (soft / hard) delete of the user; delete every code on any change of the `security.local_identity` row | the services delete explicitly as well (`kill_codes(conn, ...)` in the router's disable / delete / manager_only paths; the settings route on switch-off) |

- **Never stored:** the code, the phone number, the username. The code MAC and the number key use the **reset key** = HMAC(`k_messaging`,
  label) - the messaging key FILE (`<data>/secrets/messaging_key`, mode 600, never in the database, never in a backup), so a copy of
  the database alone cannot brute-force a 6-digit code or a phone number. When that file is unreadable a per-process key is used
  (codes then end with the process - the safe direction; logged without any value). No code / number / username in a log line or
  an audit row (unchanged; the audit keeps the user id and a 12-hex code id).
- **Restore on start:** nothing is held in memory any more (every decision reads the rows), so there is nothing to restore; the
  sender thread's queue is the only memory state - a code whose message had not left before a restart stays valid for its
  10 minutes but is not re-sent (the user asks again after the cooldown).
- **Request ordering:** the code row and the send row are committed BEFORE the message job is queued (the sender checks that the very
  code of the job is still live, from its own connection); a full queue then deletes that code (`busy`). The audit row of an
  allowed / busy request is written in a second short transaction.
- **Janitor** (`local_reset.janitor`, from `main.janitor_tick`): code rows 1 h after their expiry (dead ones - consumed, five wrong
  guesses - included; retention <= 24 h as asked), send rows after their 24-hour window. A read first, so a quiet installation takes
  no write lock.
- **Backups:** neither table is a backup table. New `backup.NEVER_EXPORTED_TABLES` (sessions, links, failure tiers, TOTP state, the two
  reset tables) - the archive stays an allow-list; the set is filtered out of `snapshot` and of the restore's table list, and the module
  refuses to import if one of them is ever added to `PROJECT_TABLES` / `ACCESS_TABLES` / `OPTIONAL_TABLES`.
- **Per-address limits** (5 / min + 20 / h request, 10 / min + 40 / h confirm): unchanged - the shared sign-in limiter
  (`ha_user_auth.LIMITER`), whose counters are already written behind to `block_counters` and restored at start (SEC3 L4). No new table.
- **Switch off:** behaviour unchanged (the routes refuse first; nothing is written); turning the switch off deletes every code row.
- Tests (negative first, `tests/test_local_reset.py` section 7): an expired code is not usable after a restart; a consumed code stays
  consumed; attempts used survive a restart (3 + 2 = dead); the cooldown and the three daily caps survive a restart; a live code
  survives a restart and is usable exactly once; four concurrent confirms consume the code exactly once; no plain code / number /
  username in the rows or in the raw database files (db, -wal / -shm when present); every kill path deletes the row (including a direct
  write behind the routes' back); the janitor retention; backups exclude both tables; the switch off writes nothing.

**NOT_VERIFIED (phase 2):** WhatsApp delivery of a code / a link to a real phone through the real `ha-whatsapp` (fakes only); ar / ru
texts (native review); the mapping UI of the new account use on a real installation; link previews of WhatsApp clients (the token is
in the URL fragment, which a preview fetch does not send - by HTTP semantics, not tested on a device).

## 9. USR2-P3 - the service identity (2026-10-16)

Branch `pilot/USR2-P3` (cut from `pilot/USR2-FIX` @ f5ea0c2d). No migration. Bridge **0.9.0**. Everything stays behind
`security.local_identity` (off by default); a Home Assistant principal's bridge message is byte-for-byte what it was.

**Message shape (both sides).** For a local principal the signed bridge message carries
`user_id = <service HA user id>` and `on_behalf_of = {"kind": "local", "user_id": "<the session principal's l_ id>", "feature": "<key>"}`.
`on_behalf_of.user_id` is taken from the authenticated principal only (never from a body or a header) and is ATTRIBUTION ONLY: the bridge
runs the call with `Context(user_id = service id)`.

**Allow-list (identical tables, drift-tested):** add-on `services/service_identity.FEATURES`, bridge `service_identity.SERVICE_FEATURES`.

| Feature | Bridge service | Items |
|---|---|---|
| `devices.control` | `execute` | the bridge's execute allow-list minus `alarm_control_panel.*` and minus `lock.unlock` |
| `alarm` (owner answer Q4) | `execute` | `alarm_arm_home/away/night/vacation/custom_bypass`, `alarm_disarm` - after the Arx permission, remote rules and PIN rules |
| `media` | `execute`, `media_query` | the media pairs (`media_player`, `remote`, `webostv`, `music_assistant`); queries `queue`, `library` |
| `cast` | `cast_stream` | `play`, `stop`, `off` |
| `schedules` | `schedule` | every scheduler op |

Never for a local identity: `config_item` (automations, scenes, scripts - writes AND runs: `automation_write_requires_ha_identity`, also
refused by the add-on before any op is recorded), `set_entity_area` (the spec's `devices.area`, default off - not offered), `stream_source`,
voice announcements (USR2-FIX F4, unchanged), door actions (`door_authority.identity_ok` unchanged), zone bypass (not in `alarm`).

**The service identity.** `identity.service_user_id` (add-on, `PUT /identity/service-identity`, local channel + `system.configure`) and the
bridge's options-flow field `service_user_id` (only an HA administrator opens it). Both refuse an HA administrator; the add-on also refuses an
Arx system administrator, an unknown or inactive directory user and a malformed id. The bridge refuses: `on_behalf_of` with any other
`user_id`, an unconfigured / inactive / system-generated / administrator service user, a malformed or padded `on_behalf_of`, an item outside the
feature; and - without `on_behalf_of` - the service id acting as itself or an `l_` id as `user_id`. The directory push carries the bridge's
copy (`service_identity`, `service_user_id`) so the settings card can show whether both sides agree.

**Add-on refusals (before anything is recorded or sent):** `local_identity_off`, `user_inactive`, `service_identity_refused`,
`service_identity_unconfigured` (503), `service_identity_admin`, `service_identity_bridge_outdated` (503, bridge < 0.9.0); all audited
`identity.service_identity.refused`. Every bridge transport (`ha_client.call_bridge_*`, `media_query.call_bridge_media_query`) refuses an
`l_` id as `user_id` and a malformed `on_behalf_of` before sending.

**Attribution.** `ha_actions.principal_user_id` stays the local id; `device_activity._user_name` names an `l_` id from `users`; a state change
under the service user's context that is not (yet) linked to an Arx request is recorded as `person / via arx / inferred` without a name -
never as the service user - and `link_context` rewrites it to the person when the bridge's answer arrives. Audit rows: actor = the local
principal; `details.service_identity = true` on the device-action and alarm rows.

**Open questions for the owner (kept refused until answered):** (1) doors / `lock.unlock` for Arx-only users; (2) alarm zone bypass;
(3) HA camera entities' live stream source; (4) the area write (`devices.area`); (5) running scripts / scenes from the automations screen
(device control can still `script.turn_on` / `scene.turn_on` an entity the role controls).
