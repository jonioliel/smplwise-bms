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
(section 7); phase 2 on `pilot/USR2-P2` (section 8, no migration); P2B (reset codes persistent, migration 0097 - provisional 0102); phase 3
(service identity) on `pilot/USR2-P3` + `pilot/USR2-P3-FIX` (section 9, no migration); phase 4 (passkeys) on `pilot/USR2-P4` +
`pilot/USR2-P4-FIX` (section 10, migration 0098 - the provisional number was the next free one at integ/264 and was kept).

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
runs the call with `Context(user_id = service id)`. That context does NOT limit which entities the call may touch (section 9.1, F5): for an
Arx-only person, Arx's own scope (`ha_scope`) is the sole entity guard.

**Allow-list (identical tables, drift-tested):** add-on `services/service_identity.FEATURES`, bridge `service_identity.SERVICE_FEATURES`.

| Feature | Bridge service | Items |
|---|---|---|
| `devices.control` | `execute` | the bridge's execute allow-list minus `alarm_control_panel.*` and minus `NEVER_LOCAL` (`lock.unlock`, `lock.open`, `script.turn_on`, `scene.turn_on`) |
| `alarm` (owner answer Q4) | `execute` | `alarm_arm_home/away/night/vacation`, `alarm_disarm` - after the Arx permission, remote rules and PIN rules (`alarm_arm_custom_bypass` removed: section 9.1, F1) |
| `media` | `execute`, `media_query` | the media pairs (`media_player`, `remote`, `webostv`, `music_assistant`); queries `queue`, `library` |
| `cast` | `cast_stream` | `play`, `stop`, `off` |
| `schedules` | `schedule` | every scheduler op |

Never for a local identity: `config_item` (automations, scenes, scripts - writes AND runs: `automation_write_requires_ha_identity`, also
refused by the add-on before any op is recorded), `set_entity_area` (the spec's `devices.area`, default off - not offered), `stream_source`,
voice announcements (USR2-FIX F4, unchanged), door actions (`door_authority.identity_ok` unchanged), zone bypass (refused explicitly by the
zone-bypass route for a local principal, and `alarm_arm_custom_bypass` is in `NEVER_LOCAL`), running scripts and scenes from device control
(`script.turn_on` / `scene.turn_on` in `NEVER_LOCAL`). `NEVER_LOCAL` is an explicit list on both sides (identical, drift-tested) checked
before the feature tables, so a later table edit cannot re-admit one of them.

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
under the service user's context that is not (yet) linked to an Arx request is recorded as `person / via arx / inferred` without a name only
while an Arx-only person's bridge request without a context id is in flight (30 s); otherwise it is recorded as `system`, named as the
service user, `via ha` (section 9.1, F4) - never as "an Arx person" nobody was. `link_context` rewrites either to the person when the bridge's
answer arrives. Audit rows: actor = the local principal; `details.service_identity = true` on the device-action and alarm rows.

**Open questions for the owner (all kept refused until answered - owner default 2026-10-16):** (1) doors / `lock.unlock` for Arx-only users;
(2) alarm zone bypass, including `arm_custom_bypass`; (3) HA camera entities' live stream source; (4) the area write (`devices.area`);
(5) running scripts / scenes - from the automations screen AND from device control (`script.turn_on` / `scene.turn_on` refused since the
review fix, section 9.1, F2).

### 9.1 USR2-P3-FIX - the P3 security review (2026-10-16)

Branch `pilot/USR2-P3-FIX` (from `pilot/USR2-P3` @ ffef4fcc). Review: `private/planning/RELEASE_264_REVIEW_USR2_P2B_P3.md`. No migration;
bridge stays 0.9.0 (unreleased; both copies byte-identical).

- **F1 - zone bypass.** `alarm_arm_custom_bypass` removed from `alarm` on both sides and listed in `NEVER_LOCAL`; the zone-bypass route
  (`POST /alarm/zones/{id}/bypass`, on and off) refuses a local principal explicitly (`service_identity_refused`, audited reason `zone_bypass`)
  after the route's own permission checks and before any code is judged - independent of whether `switch` / `select` appear in `alarm`.
  Tests: a local `site_admin` (alarm.arm + alarm.bypass) with the `alarm` table deliberately widened to the bypass controls is still refused.
- **F2 - doors by indirection.** `script.turn_on` / `scene.turn_on` removed from `devices.control` on both sides and listed in `NEVER_LOCAL`
  until the owner answers open question 5. The settings card's allowed / never-allowed lists and the he / en card text say so.
- **F3 - the stop that could not be sent.** `cast_sessions._end` sends stop / off through `service_identity.subject_for_cleanup`: when the
  local owner was disabled or deleted, as the acting Home Assistant principal, else as the service identity attributed to the acting local
  principal or the former owner (stop / off only, never play; switch, service user, bridge version and table rules unchanged; audited
  `identity.service_identity.cleanup` with `sent_as`). The janitor ends an open session of a disabled / deleted local owner within one round
  (stop_reason `admin`). Residual: while `security.local_identity` is off no service-identity message is sent at all, so a local owner's
  session ended by the janitor then revokes its token (the relay stops serving) without a stop / off command.
- **F4 - the service user as a person.** (a) Signing in to Arx as the configured service user (Ingress or the remote channel) is refused:
  403 `service_account`, audited `identity.service_identity.signin_refused`, before any user row is written (`auth._principal`). Binding an
  Arx role (allow) to it is refused (422 `service_account`, audited `rbac.bind` denied). The self-check (`GET /identity/service-identity`)
  shows step `service_signed_in` when a sign-in as that user was recorded (before it was configured). (b) `device_activity.attribute` no longer
  labels a change under the service context as an Arx person unless such a request is in flight (above). NOT detectable from add-on data: a
  person signing in to Home Assistant itself (not Arx) as the service user - Home Assistant does not tell the add-on; the owner must give that
  user no password a person knows (the card says so). Residual: the websocket / presence / notifications paths that resolve a principal
  outside `auth._principal` do not run the sign-in refusal; the service user can be given no new Arx role (one held from before is
  flagged by the existing `has_arx_role` step), so they give it no more than a role-less Home Assistant user gets.
- **F5 - recorded, not changed.** The bridge's `execute` handler performs no per-entity check (`check_entity` is called by the `schedule` and
  `config_item` handlers only), and Home Assistant Core does not apply a user's entity policy to an in-process `hass.services.async_call`
  (policy is enforced in its websocket / REST layers). So "a non-administrator service user" keeps only administrator-only services out; the
  entity guard for an Arx-only person is Arx's `ha_scope` alone - the same is true today for Home Assistant users through the bridge. The
  earlier sentence "its own per-user policy for that user applies" (bridge module docstring) overstated this and is corrected. Optional defence
  in depth (not done here): `check_entity(entity_id, POLICY_CONTROL)` in `execute`.
- **Contract / documentation mismatches recorded (not silently resolved).**
  1. CR section 9 (then numbered 8 on the branch) said "zone bypass (not in `alarm`)" while `alarm_arm_custom_bypass` was in `alarm` - fixed by F1.
  2. CR section 9 / the bridge docstring said Home Assistant's per-user policy applies to the service identity's calls - not for `execute`
     (F5); true for the `schedule` / `config_item` handlers, which call `check_entity`.
  3. Open question 5 was listed as open while `script.turn_on` / `scene.turn_on` shipped allowed - now refused until answered (F2).
  4. `docs/security/HA_IDENTITY_RBAC_HE.md` section 8 ("the bridge checks the user's permission explicitly") and section 7 ("a generic ability
     to control entities does not include unlock ... or uncontrolled scripts"): for the service identity both rely on Arx scope (and, after F2,
     on `NEVER_LOCAL` for unlock / scripts / scenes), not on a Home Assistant permission check. The security document is NOT edited by this
     branch (it outranks this CR); the amendment of those two sentences is proposed here for the owner / the security document's owner.
- **F9** (`security.local_public_url` in `BLOCKED_ON_REMOTE`) belongs to `pilot/USR2-P2B`: the setting does not exist on this branch, so it is
  not changed here.
## 10. Phase 4 (USR2-P4, 2026-10-16) - passkeys (WebAuthn)

Branch `pilot/USR2-P4` (cut from `pilot/USR2-P2` @ 1b893bb8). **Migration 0098, provisional number** (`0098_local_passkeys.sql`: the
table `auth_webauthn_credentials` and the column `auth_local_credentials.passkey_first`; additive, older code ignores both). Everything
stays behind `security.local_identity` (off by default; with it off nothing changes - the new public routes answer 403
`local_identity_off`, 404 on the local channel, `/.well-known/assetlinks.json` answers 404, remote-config is unchanged).

### 10.1 Normative rules (as built)

- **Relying party.** RP id = the host of `security.local_public_url` (https + a DNS name only, port 443, no IP literal - phase 2's
  validator); expected origin = `https://<that host>`, exact match. Never derived from a request header. Without the setting passkeys
  are unavailable (409 `passkey_unavailable`). A passkey stored for another RP id (the address changed) is listed as not usable,
  never offered, never accepted, and **does not count as a factor** - a changed address can never leave a user at a step nothing can
  pass (they fall back to password + TOTP, or to enrolment). The same rule covers a passkey registered **without** UV (allowed under
  `preferred` for a non-administrative user): for a user who holds an administrative permission (now or later) only a passkey
  registered with UV counts as the factor (§10.6 F3).
- **Verification library.** Own minimal implementation (`services/webauthn.py`) on the already pinned `cryptography`: CBOR subset
  (definite lengths; tags, floats, indefinite lengths, duplicates, trailing bytes refused; depth / item bounds), COSE ES256 (P-256, point
  validated) and RS256 (>= 2048 bit), authenticatorData (rpIdHash, UP / UV / BE / BS / AT / ED, BS-without-BE refused, trailing bytes
  refused), clientDataJSON (`type`, constant-time `challenge`, exact `origin`, `crossOrigin` true and any `topOrigin` refused).
  Attestation conveyance `none`: the attestation statement is not verified whatever `fmt` says; the AAGUID is display-only.
- **Challenges.** 32 random bytes, memory only, 60 s, single use (spent by the first verification that names them, whatever the
  outcome), bound to the purpose (`register` | `second_factor` | `passwordless`), to the session chain (register) or the pending
  sign-in (second factor), one open ceremony per user and purpose. One pool per purpose (§10.6 F1): `register` and `second_factor` at
  most 5000 live each (beyond: 429); the anonymous `passwordless` pool at most 3 live per address bucket (an IPv4 address / an IPv6 /64)
  and 2000 in all, evicting its oldest entry when full (never a 429, never a refusal of the other two purposes). An assertion is
  refused (`rp_changed`) when the address changed since its options were issued (§10.6 F5). Never stored, so never in a backup.
- **Registration** (`POST auth/passkeys/register[/options]`): a local principal on its own session, signed in < 5 minutes ago, and -
  when the user already has a factor (TOTP or a usable passkey) - a session whose sign-in presented it (`factor_at`); otherwise 403
  `reauth_required`. Resident key required; UV `required` for a user holding an administrative permission (LOCAL_ADMIN_PERMISSIONS),
  `preferred` otherwise (checked again at verification against the user's permissions NOW). A credential id already stored for anyone
  is refused (uniform). At most 10 passkeys per user. A user's **first factor** made this way behaves exactly like a TOTP enrolment
  (`routers/second_factor.confirm`): every other local session and device token of the user ends, the current session rotates and
  counts as having shown the factor (the accepted design risk F10, now for passkeys too).
- **Owner answer Q3 (the factor_ok mechanism).** `local_identity.has_factor` = TOTP enrolled **or** a usable passkey; it drives the
  enrolment gate (`_gate_for`), `must_enrol` of the links and of the self-service reset, and the sign-in's pending step. After a correct
  password, a user with a usable passkey gets the 202 pending step with `methods` (`["totp","passkey"]` or `["passkey"]`; a TOTP-only
  user's 202 body is unchanged). `POST auth/local/sign-in/passkey[/options]` answers that step with an assertion bound to the pending
  record; success creates the session with `factor_at` set, so `principal.factor_ok` opens the administrative permissions exactly as a
  TOTP code does. An administrative user's assertion must carry UV. Failures are the uniform 401 `passkey_invalid` and use the pending
  record's attempts (5); a counter regression ends the pending record.
- **Passkey first** (passwordless): only while the owner switch `security.local_passkey_first` is on (default off; system administrators
  only; audited `identity.local.passkey_setting`; never restored from a backup) AND the user opted in (`PUT auth/passkeys/first {on}`:
  needs a usable passkey and a fresh sign-in; off always allowed; an administrator may switch it **off** - never on - through
  `PATCH identity/local-users/{id} {passkey_first: false}`). Discoverable credential, empty allow list, UV always required (as asserted
  by the authenticator: attestation `none` means the UV flag is the authenticator's word, not verified - §10.6 F11), the user
  handle must match the credential's owner. The session counts as factor-verified (the authenticator's biometric / PIN is the second
  factor). Every refusal is the same 401 `passkey_invalid`. The route consumes the password sign-in's per-address budget
  (`TIERS.hit_ip`: 20 / min, 100 / h, 300 / day) and the global storm wait; a failure counts towards the global storm.
- **Never a silent lock-out.** Passkey first never removes or disables the password: password sign-in, the manager's links and the
  self-service reset keep working. Removing the last passkey switches the user's passkey-first mode off (audited). A
  "password removed / passkeys only" mode is **not built**: it would need an administrator-approved recovery path (a manager-issued link
  that re-creates a password is that path today); it is left to a later owner decision.
- **Counter / clone detection.** When the stored or the received signCount is non-zero, the received one must be strictly greater;
  the update is conditional on the stored value (a concurrent use of the same value loses). A regression refuses the assertion and writes
  `auth.local.passkey.counter_regression`. Both zero = an authenticator without a counter (synced passkeys) - accepted.
- **Removal.** Self: `DELETE auth/passkeys/{id}` needs a fresh sign-in (as registration) or the current TOTP code; the user's other
  sessions end (`factor_reset`); when no factor is left, the caller's kept session stops counting as factor-verified (`factor_at`
  cleared - administrative permissions close at once; the same for TOTP `disable` of a local user; §10.6 F2). Administrator: `DELETE identity/local-users/{id}/passkeys/{pk}` (`identity.local.manage`; an
  administrator who has a TOTP factor shows their own code - the CR-011 M1 step-up, now shared as `routers/second_factor.require_step_up`
  by both resets); every local session of the user ends; the password is never touched.
- **Password change of a passkey-only user** (no TOTP): needs a fresh sign-in that presented the passkey (403 `reauth_required`
  otherwise) - the passkey equivalent of "the current code". The TOTP rules (incl. F11) are unchanged.
- **Backup (owner answer Q8 extended).** `auth_webauthn_credentials` joins `backup.ACCESS_TABLES` right after `auth_local_credentials`:
  public keys, counters, labels travel like the password hashes; challenges never exist outside memory. The two new settings are in
  `SETTINGS_KEEP` (never exported, never restored).
- **Android app WebView.** `GET /.well-known/assetlinks.json` (outside `/api/v1`, public by nature) serves the Digital Asset Links
  statement (`delegate_permission/common.get_login_creds`) built from `security.local_passkey_android` (`<package>:<SHA-256
  fingerprint>` lines; validated; system administrators only; never restored) - only while the feature is on, else 404. Each site
  still needs a tunnel route for that root path to the add-on (CR-011 §4.C) - **the exact path `/.well-known/assetlinks.json`, never a
  wildcard** (a non-prefixed path lands on the local channel; §10.6 F9).
- **Local-channel-only settings** (§10.6 F4): `security.local_public_url`, `security.local_passkey_first` and
  `security.local_passkey_android` change only from the local channel (Ingress / LAN); a remote PATCH that changes one answers 403
  `local_only` (audited `identity.local.setting_local_only`; the whole PATCH writes nothing); repeating the current value passes.
- **Audit** (ids only - the credential's public `pk_` id, never a credential id, a public key, a challenge or a signature):
  `auth.local.passkey.registered|removed|used|refused|counter_regression|first_enabled|first_disabled`,
  `identity.local.user.passkey_removed`, `identity.local.passkey_setting`; the sign-in rows carry `factor: passkey | passkey_first`.
- Session revoke reasons reuse the 0097 CHECK list (`factor_enabled` on a first passkey, `factor_reset` on a removal) - adding a reason
  would need a table rebuild.

### 10.2 Exposed surfaces added to §4 (for the security review)

| Surface | Who can reach it | Controls |
|---|---|---|
| `POST /arx/api/v1/auth/local/sign-in/passkey/options` | holder of a pending cookie (a correct password < 5 min ago) | public guard (remote, switch, https, login CSRF); 30 / min + 300 / h per address; 401 without a live pending record; reveals only that user's credential ids (to the password holder) |
| `POST /arx/api/v1/auth/local/sign-in/passkey` | holder of a pending cookie | public guard; 20 / min per address shared with the TOTP step; challenge bound to the pending record + user; cross-user credential refused; UV for administrative users; the pending record's 5 attempts; uniform 401 |
| `POST /arx/api/v1/auth/local/passkey/options` | anyone on the internet (through the tunnel) | public guard; 403 unless `security.local_passkey_first` is on; 30 / min + 300 / h per address; empty allow list (no user enumeration); its own options budget (not shared with the second-step options); its own challenge pool (3 live per address, 2000 in all, evict-oldest, 60 s) |
| `POST /arx/api/v1/auth/local/passkey` | anyone on the internet | public guard; the sign-in's per-address tier (shared with the password route) and the global storm wait; owner switch + user opt-in + UV + user handle; uniform 401; unknown-credential audit rows throttled per address |
| `/arx/api/v1/auth/passkeys*` | the local user itself | own session only (`LocalSession` of the same user); fresh sign-in rule for register / remove / passkey-first on; 20 / min + 100 / h per user; part of the enrolment gate's allowed paths |
| `/api/v1/identity/local-users/{id}/passkeys*` | `identity.directory.read` (list) / `identity.local.manage` (remove) - system administrators | audited; CR-011 step-up when the administrator has TOTP; lists never carry credential ids or keys |
| `GET /.well-known/assetlinks.json` | anyone (Android fetches it without credentials) | 404 unless the feature is on and an app is configured; content = package name + signing-key fingerprints only (public data) |

### 10.3 Deviations (recorded, not silently resolved)

1. `credential_id` / `public_key` are TEXT (base64url) instead of the design record's BLOB - the project backup writes JSON.
2. Library: no `py_webauthn` (its `cbor2` / `asn1crypto` / `pyOpenSSL` musllinux wheels for the Alpine 3.22 image could not be verified
   here); own minimal verifier on `cryptography` (already pinned). EdDSA (-8) is neither offered nor accepted.
3. The RP id comes only from `security.local_public_url` (the design record said "the remote host"): never from a request header.
4. Passkey first is two switches - the owner's installation switch (the design record's `security.local_passkey_first`) plus a per-user
   opt-in (the brief's "per-user optional mode").
5. A counter regression is audited but sends no notification-centre signal (a new catalogue source is a follow-up item).
6. A passkey sign-in is accepted while the account's password ceiling lock (§7) runs: the lock is an anti-guessing control and an
   assertion cannot be guessed; the per-address tier still applies.
7. "Sessions list shows passkey use" (design record P4): the sign-in audit row carries the factor; the sessions list itself is
   unchanged (it has no per-chain factor column).
8. No task card / test-catalogue rows were added (`management/*` left to the lead to avoid parallel-branch conflicts).

### 10.4 NOT_VERIFIED / NOT_RUN

- **Real devices: NOT_RUN.** Only a software authenticator (`tests/webauthn_fake.py`). Checklist for the owner / a later lab round:
  1. Chrome desktop (Windows Hello / a security key): register, second factor, passkey first, remove; `excludeCredentials` stops a
     duplicate.
  2. Chrome on Android (Google Password Manager passkey): the same; a synced passkey reports `synced`.
  3. iOS Safari (iCloud Keychain): the same; the counter stays 0 (accepted).
  4. Cross-device (QR / hybrid) from a desktop to a phone.
  5. The Android app WebView: androidx.webkit >= 1.12.1, `setWebAuthenticationSupport(...FOR_APP)`, the tunnel route for
     `/.well-known/assetlinks.json`, and which `origin` the WebView puts into clientDataJSON (assumed the page origin).
  6. iOS app shell WebView: passkey support NOT_VERIFIED.
  7. An administrative user with a non-UV security key: refused at registration; a non-UV key registered before an administrative
     role arrived is not offered at the second step and does not count as the factor (the user signs in with the password to the
     enrolment path - §10.6 F3). Real-device check NOT_RUN.
- Frontend: `tsc` and the node-only helper spec ran; the browser spec `unit-arx-local-login.spec.ts` and the UI screenshots
  (desktop / mobile / RTL, loading / empty / error / ready) were NOT_RUN (local light checks only during this round).
- Timing uniformity of the passwordless route between a known and an unknown credential: not measured (an unknown credential skips
  one signature check, < 1 ms).

### 10.5 Rollback

Switch `security.local_passkey_first` off (passwordless stops at once) or `security.local_identity` off (everything stops). Code
rollback: revert the branch; migration 0098 is additive (a new table, a defaulted column) and older code ignores both.

### 10.6 Security review RELEASE_264 (USR2-P4) - fixes on `pilot/USR2-P4-FIX` (2026-10-16)

Review: `private/planning/RELEASE_264_REVIEW_USR2_P4.md` (verdict: no blocker, no account-takeover path). Migration number unchanged
(0098, provisional); no migration added. Tests: `tests/test_local_passkeys.py` section 6b (written first and seen failing on the
unfixed code).

| # | Fix | Choice and reason |
|---|---|---|
| F3 | For a user who holds an administrative permission, `usable_rows` (hence `has_factor`, the 202 `methods`, `allowCredentials`, `me.passkeys`, the list's `usable`) counts only passkeys registered with UV (`uv_registered = 1`). | The smaller safe change of the two the review offered: requiring UV at every registration would refuse every non-UV security key for ordinary users (a behaviour change for them) and would not help keys registered before. Counting only UV keys makes the user fall back to password + enrolment - the same path as the RP-change case - so there is never a step nothing can pass. |
| F2 | `local_identity.on_factor_removed`: after a self-removal (passkey `remove`, TOTP `disable` of a local user), when no factor is left, `factor_at` is cleared on every session row of the user and the session cache dropped; audited `factor_cleared`. | Option (a) (clear) instead of (b) (refuse the last-factor removal for administrative users): the administrative permissions close at once, the user keeps an ordinary session to re-enrol from, and no new refusal path / recovery dependency is introduced. HA identities' TOTP `disable` is unchanged (their remote sign-in is outside this CR). |
| F1 | One challenge pool per purpose; `passwordless` at most 3 live per address bucket and 2000 in all with evict-oldest; `register` / `second_factor` keep their own 5000 + 429. | As the review proposed; the passwordless TTL stays 60 s (a shorter one would cut slow device prompts). |
| F4 / P2B-P3 F9 | `security.local_public_url`, `security.local_passkey_first`, `security.local_passkey_android`: an actual change from the remote channel answers 403 `local_only` (`routers/settings._local_only_identity_key`, `remote_channel.is_remote`, the `routers/tickets_admin` pattern). | `/api/v1/settings` cannot go into `BLOCKED_ON_REMOTE` as a path (every other setting stays remote-editable), so the refusal is per key. `pilot/USR2-P3-FIX` had not touched `routers/settings.py` when this was written (checked, not merged); whichever branch merges second must keep one implementation (this helper covers `local_public_url` too). |
| F5 | Both assertion paths refuse `rp_changed` when the current `security.local_public_url` differs from the challenge's RP. | As registration already did. |
| F6 | `b64url_decode` is strict: `=` only as trailing padding of the right length, canonical encoding (unused bits zero). | The docstring's claim is now true. |
| F7 | An assertion whose BE flag differs from the registered value is refused (`backup_eligibility_changed`). | WebAuthn L3. |
| F10 | `POST auth/local/passkey/options` has its own per-address budget (`lpkp`), no longer shared with the second-step options (`lpko`). | |
| F8 | NOT fixed: pydantic validation before `_public_guard` (422 instead of 404 / 403) - the same pattern as the existing sign-in routes; changing it means moving body parsing into every public route. Recorded. | |
| F9 | Documentation only (exact tunnel path, §10.1). The middleware handling of `/.well-known/assetlinks.json` (strip identity headers, 404 for other non-prefixed paths from a non-proxy peer) is NOT built - a `remote_channel` change outside this branch's scope. | |
| F11 | Recorded (§10.1): UV is the authenticator's assertion under attestation `none`. | Inherent to the owner-approved conveyance. |

Contract / documentation mismatches the review listed (item 3), recorded rather than silently resolved:

1. §10.1 "a changed address can never leave a user at a step nothing can pass" was true only for the RP change; the non-UV-passkey +
   later administrative role case contradicted it until F3. Now covered and stated in §10.1; §10.4 item 7 reworded (the old wording
   "refused ... at the second step" meant a lock-out).
2. §10.1 "at most 5000 live (beyond: 429)" described one shared pool reachable anonymously once passkey first is on (F1). Replaced by
   the per-purpose description.
3. `services/webauthn.py` "Strict base64url" was not strict (F6). Code fixed to match the docstring.
4. §10.1 "UV always required" (passwordless) did not say UV is self-asserted under attestation `none` (F11). Added.
5. §10.1 Android: the tunnel route's exact-path requirement was missing (F9). Added.
6. §10.1 "the session counts as having shown the factor" had no converse rule for the last factor leaving (F2); `routers/second_factor.disable`
   and `local_passkeys.remove_own` cleared nothing. The converse rule now exists (§10.1 Removal) for local users; for HA identities the
   TOTP `disable` still leaves their remote sign-in as it was (pre-existing, outside CR-USR2).
