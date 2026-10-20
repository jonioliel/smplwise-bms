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
| 8 | Hashes in the project backup; sessions / links / failures / TOTP excluded | `services/backup.py` ACCESS_TABLES gains `auth_local_credentials`, `identity_links`; `NEVER_EXPORTED_COLUMNS` keeps the failure counter / lock columns out (USR2-FIX F9); **amended by BACKUP-HASH-ENC (owner 2026-10-17):** the hashes travel only encrypted with a backup password typed at export (AES-256-GCM, scrypt key; omitted without a password) - `services/backup_sensitive.py`, `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md` section 3 |

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
review fix, section 9.1, F2). **Answered 2026-10-17 - see section 11 (a reversal, behind the off-by-default switch
`security.local_identity_extended`; security review required before it is turned on).**

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
5. A counter regression is audited and (USR2MINOR-290) also emits the notification-centre signal `security.local_passkey_clone` to the managers (category security, subject `system`, fold 1 h, content-free; only for a known credential). Previously audit only.
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

## 11. SVCIDENT2 - the extended mode of the service identity (owner decisions 2026-10-17)

**This section REVERSES the posture of section 9 ("open questions 1-5 stay refused until answered", owner default 2026-10-16).** The owner
answered on 2026-10-17. Everything new is behind ONE new switch, `security.local_identity_extended`, **OFF by default**; with it off the
behaviour is exactly that of 2.6.4 (sections 9 and 9.1 hold unchanged, every refusal stays). Branch `pilot/SVCIDENT2` (from `integ/264` @
5fa03e7a). No migration. Bridge **0.9.1**.

> **A security review (Fable) is REQUIRED before the switch is ever turned on**, on any installation. Until that review is done and
> recorded here, the switch stays off. The settings card and the bridge's options-flow label both say so.

### 11.1 Owner decisions (2026-10-17) and where each is implemented

| # | Decision | With the extended mode on | Where |
|---|---|---|---|
| 1 | Doors / `lock.unlock` / `lock.open` for an Arx-only user | Allowed under the user's EXISTING Arx door permission and the door rules - no extra per-action approval step. A non-WisKey lock: `devices.control` admits `lock.unlock`; the route still requires `ha.entity.control` AND the `door.unlock` grant (`grant_required` otherwise) and the confirmation. A WisKey door: `door_authority.identity_ok` admits an active local user (`service_identity.local_door_ok`), then the one door rule decides exactly as for everyone (access.doors.open / door.unlock, deny wins, wall accounts refused); the door transport opens it, never the bridge. | `services/service_identity.py` (EXTENDED_FEATURES, local_door_ok), `services/door_authority.py` |
| 2 | Alarm zone bypass, including `arm_custom_bypass` | Allowed for an Arx-only user holding `alarm.bypass`. The zone-bypass route (which already requires `alarm.bypass` on every panel of the zone) goes on instead of refusing, and sends under the new feature `alarm.bypass` (the bypass controls `switch.turn_on/off`, `select.select_option` only). `arm_custom_bypass` goes under `alarm`; the panel route additionally requires `alarm.bypass` (for an HA user too since the second round, row 2b). PIN / remote rules unchanged. | `routers/alarm.py`, `services/service_identity.refuse_zone_bypass` |
| 3 | Live video of HA camera entities (the stream source) | Allowed: enabling a standalone HA camera (`sources.configure`, as before) reads the stream source through the service identity, feature `cameras.live` (item `read`); the viewer re-read of a camera a local user enabled goes the same way. The bridge's `stream_source` handler requires an HA administrator; for a message screened on behalf of a local person with the bridge's own switch on, that rule is waived (`admin_waived`) - only then. Viewing an already enabled camera never used the viewer's identity (it runs as whoever enabled it) and is unchanged. | `services/ha_camera_streams.py`, bridge `stream_source_service.py`, `__init__.py` |
| 4 | `devices.area` (`set_entity_area`) | STILL refused - in both modes. It is the only entry left on the never-list in the extended mode (`NEVER_LOCAL_EXTENDED = {("smplwise_bridge", "set_entity_area")}`), checked before the tables. The add-on routes also keep refusing a local principal (`identity_unmapped`, after `system.configure`). | both `service_identity.py` |
| 5 | `script.turn_on` / `scene.turn_on` | Allowed from device control (`devices.control`), under the route's `ha.entity.control`. | both `service_identity.py` |
| 5b | (second round, owner 2026-10-17) running from the AUTOMATIONS screen | Allowed - exactly three `config_item` ops, new feature `automations.run`: `trigger` (an automation's "run now", `POST automations/automation/{id}/run`, Arx permission `automation.manage` as for everyone), `run_script` (`POST automations/script/{id}/run`, `script.run` or `script.manage`) and `apply_scene` (`POST automations/scene/{id}/apply`, the scene entity's control). Each still passes the route's own checks (run reasons, confirmation, rate limits, the CR-033 door plan). NOT allowed, in both modes (`automation_write_requires_ha_identity`, before any op is recorded): `upsert` / `delete` (create, edit, code edit, delete, copy, restore from trash or a version), `enable` / `disable`, `stop_script`. The authoring model is not widened. | `routers/automations._bridge_runner`, `services/automation_ops.bridge_body`, both `service_identity.py` |
| 2b | (second round) `arm_custom_bypass` for Home Assistant users | Aligned: needs `alarm.bypass` in addition to `alarm.arm` for EVERY caller - an HA user always (independent of the switch), an Arx-only user in the extended mode. | `routers/alarm.panel_action` |

### 11.2 The switch (both sides must agree)

- **Add-on:** `security.local_identity_extended` (`on|off`, default `off`). Changed only by a system administrator, only from the local
  channel (`_local_only_identity_key`), audited `identity.service_identity.extended_switch` (allowed / denied, `from` / `to`); never
  restored from a backup (`SETTINGS_KEEP`). In force only while `security.local_identity` is also on (`service_identity.extended_on`).
- **Bridge 0.9.1:** the options-flow boolean `local_identity_extended` (default off; only an HA administrator opens the options flow), read
  live on every call (`entry.options.get(...) is True`), sent to the add-on with every directory push (`local_identity_extended`), stored
  as `bridge.local_identity_extended` and shown on the settings card (`extended.bridge_on`, steps `extended_bridge_off`,
  `extended_bridge_outdated`, `extended_bridge_only`).
- An item only the extended mode admits is not sent unless the bridge is >= 0.9.1 AND reported its copy on: 503
  `service_identity_extended_bridge_off` (audited `identity.service_identity.refused`). The bridge decides again with its own copy
  (fail closed if the add-on's view is stale). A WisKey door does not go through the bridge: only the add-on's switch applies there.

### 11.3 NEVER_LOCAL (identical on both sides, drift-tested)

| Switch | Never-list | Tables |
|---|---|---|
| off | `NEVER_LOCAL` = `alarm_arm_custom_bypass`, `lock.unlock`, `lock.open`, `script.turn_on`, `scene.turn_on` (unchanged) | `FEATURES` / `SERVICE_FEATURES` (unchanged) |
| on | `NEVER_LOCAL_EXTENDED` = `smplwise_bridge.set_entity_area` only | `EXTENDED_FEATURES`: `devices.control` + `lock.unlock`, `lock.open`, `script.turn_on`, `scene.turn_on`; `alarm` + `alarm_arm_custom_bypass`; new `alarm.bypass` (`switch.turn_on/off`, `select.select_option`); new `cameras.live` (`stream_source`: `read`); new `automations.run` (`config_item`: `trigger`, `run_script`, `apply_scene`); media / cast / schedules unchanged. On both sides any other `config_item` op answers `automation_write_requires_ha_identity` in both modes. |

A non-execute bridge service is named as the HA service it is (`("smplwise_bridge", "<service>")`), so one list of pairs covers both
kinds. `lock.open` is listed for parity with the owner's wording; it is in neither execute allow-list (`ha_bridge.ACTIONS`,
`ALLOWED_SERVICES`), so it still cannot be sent - recorded, not widened.

### 11.4 Audit

Kept: every `identity.service_identity.*` row of sections 9 / 9.1. Added: `identity.service_identity.extended` (allowed) for every item only
the extended mode admits - details `feature`, `bridge_service`, `item` (a (domain, service) pair or an op name: ids only, never data, codes or
URLs); `identity.service_identity.extended_switch` for the switch; `bridge.service_identity_seen` now also carries `extended`. The route
rows (`ha.action`, `alarm.*`, the door rows, `camera_card.ha_live.*`) name the local person as before.

### 11.5 Residual risks (for the security review)

1. **The bridge `execute` handler performs no per-entity check** (section 9.1, F5, unchanged). With the switch on, a door, a script, a scene
   or a bypass control reached through the service identity is bounded by Arx's own scope (`ha_scope`, the door rule, the alarm scope) alone;
   Home Assistant does not apply the service user's entity policy to an in-process call. A defect in an Arx route's scope check would let a
   local user act on any entity of an allowed (domain, service) pair. Optional defence in depth (not done): `check_entity` in `execute`.
2. **A script or a scene can do anything the service user can** - unlock a door, disarm, press an intercom button, call any service - so
   `script.turn_on` / `scene.turn_on` effectively widen an Arx-only user's reach to everything the referenced script does, independent of the
   permissions Arx would require for each of those actions directly (`door.unlock`, `alarm.disarm`, ...). Only `ha.entity.control` on the
   script entity is checked. The CR-033 door-run guard (`door_run_guard`) judges scripts that reach a WisKey door; nothing else does.
3. **The stream source is a credential** (`rtsp://user:pass@...`). With the switch on, the bridge returns it for the non-administrator service
   user when the add-on asks on behalf of a local person who holds `sources.configure` (a LOCAL_ADMIN_PERMISSION: second factor required).
   The URL still goes only to the add-on and go2rtc (never to a browser, log or the database).
4. **Alarm zone bypass** lowers protection; the bypass control entity is reached through `switch` / `select` pairs that the bridge cannot
   tell from any other switch / select (no per-entity check, item 1).
4b. **Running an automation / script / scene from the automations screen** (second round) has the reach of item 2: the item runs as the service
   user, whatever its steps do (an automation's `trigger` may also skip its conditions when the caller asks). The bridge's runtime-op handler
   does check the service user's HA entity policy, but only for the item's own entity (`_check_permissions`), not for what its steps touch.
5. The add-on's view of the bridge's switch is at most one directory push (60 s) old; the bridge decides with its live copy, so a stale view
   can only cause a refusal, never an extra action.
6. Section 9.1 F4 residuals are unchanged (the service user must have no password a person knows; the add-on cannot see an HA sign-in as it).
7. **Contradiction with the binding security document, recorded:** `docs/security/HA_IDENTITY_RBAC_HE.md` section 7 (a generic control ability
   does not include unlock / disarm or uncontrolled scripts), section 8 paragraph 2 (the bridge checks the user's own HA permission explicitly)
   and section 8 paragraph 3 (scripts / scenes are blocked by default until an allowlist and an impact check) are further from the as-built
   behaviour in the extended mode: scripts / scenes are admitted by `ha.entity.control` on the script entity, with no per-script allowlist or
   impact check. With the switch off the document holds as before. The security document is NOT edited here (it outranks this CR); turning the
   switch on needs either its amendment or an approved change request, decided together with the security review.

### 11.6 Open questions / deviations (recorded, not silently resolved)

1. **Resolved (owner, second round 2026-10-17):** running from the automations screen is allowed in the extended mode (row 5b: `trigger`,
   `run_script`, `apply_scene` only); writes, `enable` / `disable` stay refused. Recorded: `stop_script` (stopping a running script) is not in
   the owner's list and stays refused.
2. **Accepted (owner, second round):** a switch on both sides - the add-on's setting and the bridge's options-flow mirror (the `service_user_id`
   pattern), so turning the mode on also needs an HA administrator.
3. **Accepted (owner, second round):** decision 3 as built - enable / re-read a standalone HA camera's stream source through the service
   identity; viewing an enabled camera (already possible for a local user with `video.live` + `devices.read` in 2.6.4) is unchanged.
4. **Resolved (owner, second round):** `arm_custom_bypass` needs `alarm.bypass` for every caller (row 2b). For HA users this is a behaviour
   change independent of the switch: an HA user with `alarm.arm` only now gets the audited 403 `forbidden`. With the switch off an Arx-only user
   is still refused by the service identity exactly as in 2.6.4. Not changed: the panel's `arm_modes` list still offers `arm_custom_bypass` to a
   caller without `alarm.bypass` (UI follow-up).
4a. **Owner, second round:** the contradiction with `docs/security/HA_IDENTITY_RBAC_HE.md` sections 7-8 (11.5 item 7) is handled in the
   security review; it stays recorded here and the document is not edited.
5. Bridge version bumped to 0.9.1 (0.9.0 is in the unreleased 2.6.4 line); the add-on requires 0.9.1 for extended items only.

### 11.7 Rollback

Switch `security.local_identity_extended` off (or the bridge's option off): the 2.6.4 refusals apply at once (both read live). Code
rollback: revert the branch; no migration, no stored data depends on it (the two settings rows are ignored by older code).

### 11.8 Tests

`tests/test_service_identity_extended.py` (add-on, negative first: switch off = refused exactly as before for each new item; the bridge copy
off or a 0.9.0 bridge = 503; each item works only with the switch on AND the user's own permission, through the routes for doors / scripts /
scenes, zone bypass / `arm_custom_bypass`, the WisKey door rule and camera enable (both sides together); the area write always refused; the
switch is system-admin / local-channel only and audited; the drift of the never-lists and tables), `tests/test_bridge_service_identity.py`
(bridge: the same negative-first matrix through `screen`), `tests/test_bridge_stream_source.py` (the administrator waiver only when
`__init__` passes it), `frontend/tests/unit-service-identity.spec.ts` (the card's extended line). Second round: the run / trigger / apply
routes through the real bridge screen + config_item handler (switch off = refused as before; the bridge copy off = 503; the bridge's own copy
off = refused there; on = sent as the service identity under `automations.run`), writes / enable / disable / stop still refused with the switch
on, no run permission = refused, an HA user with `alarm.arm` only refused `arm_custom_bypass`.

### 11.9 The go-live guard and what must land before the switch may be turned on (integ/270, 2.7.0 security review)

The consolidated 2.7.0 security review (`private/planning/RELEASE_270_REVIEW_CONSOLIDATED.md`, findings S1-S7) found that the extended
mode, as built, cannot be enabled consistently with `docs/security/HA_IDENTITY_RBAC_HE.md` sections 7 and 8 (finding **S1**, HIGH: a script,
scene or automation run widens an Arx-only user's reach to everything the referenced item does - e.g. a script that unlocks every door - with no
Arx grant checked). The switch therefore ships in 2.7.0 behind a code constant, like `services/access_grants.GO_LIVE_PERMITTED`:

- `services/service_identity.EXTENDED_GO_LIVE_PERMITTED = False` (finding **S7**). While it is False, `PATCH /api/v1/settings` refuses
  `security.local_identity_extended = "on"` with **409 `extended_not_permitted`** (after the existing local-channel and system-administrator
  checks; one audit row `identity.service_identity.extended_switch`, denied, reason `extended_not_permitted`; nothing is stored), turning it
  `off` always works, and `extended_on()` answers False whatever the stored value says - every Arx-only user is refused exactly as in 2.6.4.
  The self-check reply carries `extended.permitted` (False). Tests (negative first, red before the guard):
  `tests/test_service_identity_extended.py::test_the_extended_mode_ships_without_the_go_live_permit`,
  `::test_the_switch_cannot_be_turned_on_without_the_go_live_permit`, `::test_a_stored_on_value_changes_nothing_without_the_go_live_permit`
  (every extended item); the tests that describe the enabled behaviour run with the permit monkeypatched on.
- The constant is flipped ONLY in the commit that lands all of the following, each with its own tests:
  1. **S1 (a)** a per-installation allowlist of the script / scene / automation entity ids that Arx-only users may run
     (`security.local_identity_runnable`, **default empty**, edited by a system administrator on the local channel, audited), enforced in
     `_local_subject` with the entity id passed into the feature check;
  2. **S1 (b)** a bridge-side impact check for a screened `script.turn_on` / `run_script` / `trigger`: the item's configured sequence is read
     and the call refused (`service_identity_refused`, reason `impact`) when it names a service outside that person's extended allow-list
     (lock, alarm panel, intercom, a script that calls a script) unless the allowlist row says so;
  3. **S2** the service user's Home Assistant entity-policy check in the bridge's `execute` handler for every message screened on behalf of an
     Arx-only person (`permissions.check_entity(entity_id, POLICY_CONTROL)` - a second fence independent of Arx's scope computation);
  4. **S1 (c)** the amendment of `docs/security/HA_IDENTITY_RBAC_HE.md` sections 7-8 proposed in the review (the conditional paragraph after
     section 8 paragraph 3: the section 7/8 defaults hold for Arx-only users; the extension only with both switches on, the action's own
     dedicated permission, the runnable allowlist + the bridge impact check, and the service user's entity policy), **approved by the owner as
     a change request**. The security document itself is NOT edited by this integration.
  Also before enabling (2.7.1): S4 (the card says doors follow the add-on switch alone), S5 (a stream a local user enabled is removed when the
  mode goes off; no audit row per refresh). S6 (an HA user now needs `alarm.bypass` for `arm_custom_bypass`) ships in 2.7.0 and is named in
  the bilingual release notes; the panel list no longer offers that arming mode to a caller without the permission
  (`pilot/ALARM-ARMMODES`, merged in the same release).
- Bridge: 2.7.0 ships this branch's bridge as **0.9.1** (finding S3: the key-rotation branch, which also claimed 0.9.1, is not in 2.7.0 and
  becomes 0.9.2 when it lands). Manifest, `const.VERSION`, the card's `VERSION` and every `test_bridge_*` pin say 0.9.1; the two copies
  (`custom_components/smplwise_bridge`, `smplwise_vms/integration/smplwise_bridge`) are byte-identical. The bridge's own options-flow switch
  is not guarded by the add-on constant, but the add-on never sends an extended item while `extended_on()` is False, so the bridge copy alone
  changes nothing (section 11.2).

## 12. SVCIDENT3 - the fences the extended mode needs before it may be enabled (2.7.0 security review S1, S2, S4, S5)

Branch `pilot/SVCIDENT3` (from `integ/270` @ 4fde337e). No migration. Bridge **0.9.2** (2.7.0 ships 0.9.1; the key-rotation branch WXROT
becomes 0.9.3). **The extended mode stays impossible to turn on:** `services/service_identity.EXTENDED_GO_LIVE_PERMITTED = False` is NOT
changed here. Flipping it needs, in this order: (1) the owner's approval of the draft amendment
`docs/security/HA_IDENTITY_RBAC_AMENDMENT_EXTENDED_SERVICE_IDENTITY_DRAFT_HE.md` as a change request and its application to
`docs/security/HA_IDENTITY_RBAC_HE.md` by that document's owner, (2) a Fable security re-review of this branch, (3) the owner's explicit,
separate permit, landed in its own commit with tests, (4) a full gate on the runner. The security document itself is NOT edited here.

### 12.1 What was built (each item negative-first tested)

| Review item | Add-on | Bridge 0.9.2 |
|---|---|---|
| **S1 (a)** runnable allowlist | `security.local_identity_runnable` (JSON list of `script.` / `scene.` / `automation.` entity ids, max 100, **empty by default**, never restored from a backup). `PUT /identity/service-identity/runnable {entity_ids}`: `system.configure`, local channel only (`BLOCKED_ON_REMOTE` prefix), a local principal refused, audited `identity.service_identity.runnable` (added / removed ids; a refused list audited `denied`, nothing stored). Enforced in `_local_subject` with the entity id the route passes (`subject(..., entity_id=)`: `routers/ha.py`, `device_bulk.record`, `automation_ops.bridge_body` via `run_entity`): a run item (`execute` `script.turn_on` / `scene.turn_on`, `config_item` `trigger` / `run_script` / `apply_scene`) without a listed entity id of the right kind is 403 `service_identity_not_runnable` (audited reason `not_runnable`) **even with both switches on**; listed here but missing from the bridge's reported copy: 503 `service_identity_runnable_bridge_missing` (not sent). A malformed stored list is empty. | Options-flow field `local_identity_runnable` (text, ids separated by commas; errors `runnable_format`, `runnable_too_many`; stored as a sorted list; malformed at run time = empty). Reported with every directory push (`local_identity_runnable`), stored by the add-on as `bridge.local_identity_runnable` and shown on the card (`runnable.agrees`, step `runnable_mismatch`). For a message screened on behalf of an Arx-only person: `execute` `script.turn_on` / `scene.turn_on` and `config_item` run ops refuse an entity not on the list: `service_identity_not_runnable`. |
| **S1 (b)** impact check | - (the add-on cannot see the item's steps) | `runnable.py`: the item's configuration is read from the UI files (`scripts.yaml` / `automations.yaml` / `scenes.yaml`, the same store `config_service` writes; the registry entry must be of the UI platform) and every step is walked at any depth plus ONE nested level (`script.turn_on`, `script.<object id>`, `automation.trigger`, `scene.turn_on`, the `scene:` step, inline `scene.apply`). Closed refusal codes: `impact_never_local` (`lock.unlock`, `lock.open`, `alarm_disarm`, `alarm_arm_custom_bypass`, a scene setting a lock to anything but `locked` or setting an alarm panel), `impact_service_not_allowed` (outside `IMPACT_STEP_PAIRS` = the 2.6.4 `DEVICE_PAIRS` + plain arming), `impact_template`, `impact_target_unresolved` (area / device / floor / label / `all` / none / another domain), `impact_device_action`, `impact_event`, `impact_step_unknown`, `impact_nesting_too_deep`, `impact_too_large` (depth > 24 or > 500 steps), `impact_unknown_item` (not registered, not a UI-file item, missing, unreadable), `impact_entity_policy` (a step target - or a nested item - the service user may not control). The allowlist does NOT override the impact check. |
| **S2** entity policy | - | For every message screened on behalf of an Arx-only person, `execute` checks `user.permissions.check_entity(entity_id, POLICY_CONTROL)` of the service user for every entity (`service_identity_entity_policy`); a target that is not a literal entity list (`area_id`, `device_id`, `floor_id`, `label_id`, `target`, a template, `all`): `service_identity_target`; a permission API that is missing / raises, or an administrator user: `service_identity_policy_unavailable`. Placed after the allow-list / media checks and before `Context(...)` - nothing runs on a refusal. A Home Assistant user's own message is not judged here (unchanged). |
| Version | `BRIDGE_EXTENDED_REQUIRED = "0.9.2"`: no extended item (doors, bypass, camera source, runs) is sent to a 0.9.0 / 0.9.1 bridge (503 `service_identity_extended_bridge_off`) - 0.9.1 has the switch but not the fences. | `const.VERSION`, `manifest.json`, the card's `VERSION` = 0.9.2; both copies byte-identical (tested file by file). |
| **S4** | `status().extended.doors_addon_only = true`; the `doors` label says WisKey doors follow the add-on switch alone (infrastructure locks need both); the card shows one line under the extended note (`data-si-doors-addon-only`). | - |
| **S5** | `ha_camera_streams`: a camera whose `enabled_by` is an `l_` id while `extended_on()` is False is not served (`ensure_ready` answers 503 `ha_live_unavailable` before any identity call - no `identity.service_identity.refused` row per attempt); `reconcile()` drops its opt-in and deletes its stream with ONE `camera_card.ha_live.disable` row, reason `extended_off`; a background re-read in the extended mode passes `quiet=True` (no `identity.service_identity.extended` row per refresh; the existing `camera_card.ha_live.refresh` row stays). A Home Assistant user's camera is untouched. | - |
| Cheap extras | `automation_ops.bridge_call` settles the op as `failed` when the identity is refused before sending; `BRIDGE_ERRORS` maps the bridge's new codes (403 `service_identity_not_runnable`, 403 `run_impact_refused` with `details.reason`). | Docstrings corrected (the F5 sentence "execute performs no per-entity check" is no longer true for screened messages). |

### 12.2 Exposed surfaces added

`PUT /api/v1/identity/service-identity/runnable` (local channel, `system.configure`); `GET /identity/service-identity` gains `runnable` and
`extended.doors_addon_only`; the directory push carries `local_identity_runnable`; the bridge options flow gains one text field. No public
route, no new permission, no migration.

### 12.3 Residual risks (for the Fable re-review)

1. The step allow-list is the everyday device list: a `switch` / `button` wired to a gate relay looks like any other switch / button. Bounded by
   the allowlist (an administrator picks each item), the service user's entity policy and - for direct control - Arx's scope.
2. The impact check reads the files, not Home Assistant's loaded configuration; a hand-edited, not-reloaded file may differ from what runs
   (an HA administrator's act). Items outside the UI files (YAML packages, integration scenes) are refused (`impact_unknown_item`).
3. The entity policy protects only when the HA administrator restricted the service user (a group with an entity policy); the default policy
   of a non-administrator user is broad. The ops guide / card must say so (follow-up).
4. (Resolved in 12.7: a nested item must be on the allowlist too.)
5. Arx-only users holding `schedules` (2.6.4, not the extended mode) can schedule scripts / scenes; that path is governed by the existing
   "script allowed in schedules" administrator mark for disarm / unlock scripts (`schedule_ops.mark_script`) and the bridge's schedule handler
   checks the service user's entity policy - not by the runnable allowlist. Recorded, not changed (out of this branch's scope).
6. A live viewing session that is already open when the mode goes off is not cut by S5 (new opens are refused at once; reconcile deletes the
   stream within its 300 s throttle).

### 12.4 Open questions (recorded, not silently resolved) - all four answered by the owner on 2026-10-18, see 12.7

1. Device-control runs (`script.turn_on` / `scene.turn_on`) need `ha.entity.control` on the item + the allowlist + the impact check; the
   review's proposed amendment names "the action's own dedicated permission" (`script.run`). Should device-control runs also need `script.run`?
2. Widen the step list (`notify.*`, `*.toggle`, `input_boolean.toggle`)? Today they are refused.
3. Must a nested item be on the allowlist too?
4. The bridge's allowlist is a free-text options field (Home Assistant's options flow has no multi-entity picker without a selector import);
   a selector is a possible UI follow-up.

### 12.5 Rollback

Revert the branch. No migration; the settings rows `security.local_identity_runnable` / `bridge.local_identity_runnable` are ignored by older
code. A 0.9.1 bridge with a 0.9.2-aware add-on: every extended item is refused (fail closed) - and the mode cannot be on anyway.

### 12.6 Tests (local only - the runner was busy with a gate)

`tests/test_bridge_runnable.py` (bridge: every impact code, one nesting level, scenes / inline scenes, the entity policy incl. unavailable /
administrator / raising APIs, the allowlist option, the `__init__` wiring by AST, version 0.9.2 + both copies byte-identical, the closed
code list known to the add-on); `tests/test_service_identity_runnable.py` (add-on: the constant False, empty default refuses every run with
both switches on, entity id / kind / bridge copy, older bridges, malformed lists, the route's authority / channel / validation / audit, the
directory push, S4, S5 with the real bridge screen); `tests/test_service_identity_extended.py` updated (0.9.2, both copies of the list; the
device-control and automations-screen route tests now first prove the allowlist refusal); version pins in the `test_bridge_*` /
`test_lovelace_card` files; `frontend/tests/unit-service-identity.spec.ts` (the runnable section and the doors line, screenshots
`docs/evidence/USR2/service-identity-runnable-{desktop,mobile}.png`). A mutation check (each fence disabled in turn) turned its tests red.

### 12.7 Owner answers of 2026-10-18 to the open questions of 12.4 (second commit on `pilot/SVCIDENT3`; bridge stays 0.9.2)

1. **Device-control script runs need `script.run` too - built.** In the extended mode, `POST /ha/entities/script.<x>/actions` `script.turn_on`
   for an Arx-only person additionally requires `script.run` or `script.manage` held anywhere (the automations screen's run rule); otherwise the
   audited 403 `forbidden` (`require(..., "script.run")`), before anything is recorded or sent. Scenes unchanged (`ha.entity.control`). With
   the switch off nothing changes (the 2.6.4 refusal comes first).
2. **The closed step list is widened - built, each addition with its reason in `runnable.STEP_ADDITIONS`:**
   - `notify.*` - only with literal content: a template anywhere in the step (message, title, data, target) refuses it (`impact_template`); an
     unknown key refuses it (`impact_step_unknown`); `notify.send_message` entity targets still pass the service user's entity policy.
   - `light.toggle`, `switch.toggle`, `fan.toggle`, `input_boolean.toggle`, `media_player.toggle` (`TOGGLE_DOMAINS`) - no physical-access effect
     (a switch wired to a gate relay is the same residual risk as `switch.turn_on`, already in the list).
   - **Never toggled:** `cover`, `lock`, `alarm_control_panel`, `climate`, `siren`, `valve` and every other domain (`impact_service_not_allowed`).
   - **Covers, decided in this commit (fail closed):** the owner's rule for `cover.toggle` - "physical access unless the device class is plainly
     not a door / gate / garage; when unsure refuse" - is applied to EVERY cover a runnable item drives, because `cover.open_cover` /
     `close_cover` / `set_cover_position` on a garage door are the same physical access as a toggle. A cover service step, or a scene that sets a
     cover, passes only when Home Assistant reports the cover's `device_class` in `COVER_SAFE_CLASSES` = `blind`, `curtain`, `shade`, `awning`;
     `door`, `gate`, `garage`, `shutter`, `damper`, `window`, any other or a missing class, or a cover without a state: `impact_physical_access`.
     `cover.toggle` itself stays OUTSIDE the step list (refused even on a blind), as the owner listed cover among the never-toggled domains.
     **Recorded for the owner:** this tightens the 12.1 behaviour for open / close / position steps on non-window covers.
3. **A nested item must be on the allowlist too - built.** A runnable item that calls a script / scene / automation (any of the nested forms)
   is refused `impact_nested_not_runnable` unless the nested entity id is on the bridge's allowlist as well; a listed nested item is still
   judged on its own steps.
4. **A picker for the bridge's list** (a multi-entity selector in the options flow instead of free text) is a later UI task - recorded here,
   not built.

New closed codes: `impact_physical_access`, `impact_nested_not_runnable` (both mapped by the add-on to 403 `run_impact_refused`). Tests:
`tests/test_bridge_runnable.py` (negative first: notify with a template in message / title / data, an unknown notify key, each never-toggled
domain, `cover.toggle` even on a blind, open / close / position on a garage / gate / door / shutter / unknown-class / stateless cover, a scene
setting such a cover, each nested form not on the list; then each addition passing with literal content), `tests/test_service_identity_extended.py`
(an operator without `script.run` is refused `forbidden` with the switch on and the refusal is audited, then with `script.run` the allowlist
decides).

### 12.8 Owner decisions of 2026-10-18 on the go-live hardening (go-live pack `private/planning/svcident_golive_pack_2026-10-18/`)

Recorded for the pack's checklist questions 1-9 (risk ids from its `RESIDUAL_RISK.md`). The go-live constant stays `False`; nothing here is a
permit (the permit gets its own section and commit later).

1. Apply the wording fixes E1-E12 to the amendment draft - **applied** (`docs/security/HA_IDENTITY_RBAC_AMENDMENT_EXTENDED_SERVICE_IDENTITY_DRAFT_HE.md`;
   the binding `HA_IDENTITY_RBAC_HE.md` is NOT edited - that is the document owner's separate commit, E12).
2. No second factor for extended actions - **accepted residual risk R3**.
3. Dangerous services inside scripts and template entities - **accepted residual risk R1, R2**, no code change.
4. Entity policy for the service user - **recommendation only, no enforcement** (R5; the camera stream source without an entity-policy check,
   R6, read as covered by the same decision). **Recorded contradiction:** fix E5 proposed making the restricted group a go-live *condition*; the
   draft keeps it as a recommendation, following decision 4.
5. Remote kill switch without a second factor - **built** on `pilot/SVCIDENT-AMEND273` (R7): a system administrator may turn
   `security.local_identity_extended` OFF from the remote channel (`PATCH /settings`; ON stays local-only, 403 `local_only`), and may call
   `POST /api/v1/identity/extended-mode/off {turn_off?, clear_runnable?}` from either channel (both default true; it has no ON direction and
   cannot add an id; extra fields 422). The route sits outside the remote-blocked `/identity/service-identity` prefix on purpose; the full
   allowlist editor and the configuration stay local-only. Audited `identity.service_identity.kill_switch` (allowed and denied) plus the usual
   `extended_switch` / `runnable` rows; the answer carries counts and the switch state only. The bridge's own switch and list are untouched
   (no bridge change, no version bump). Tests: `tests/test_service_identity_remote_kill.py`, `tests/test_remote_access.py` (the route table).
6. No rate limit - **accepted residual risk R8**.
7. `notify` - **not decided**; nothing changed (R4 stays open).
8. Gate / garage as a `cover` on the direct path - **leave as is**, accepted residual risk R12.
9. Build the selected hardening first, then one Fable review of everything.
## 13. EXTID-295 - the documented follow-ups (backlog item `extended-identity-followups`, 2026-10-20)

Branch `pilot/EXTID-295` (from `origin/main` @ 586f191b). No migration. Bridge **0.9.4** (0.9.3 stays reserved for the key-rotation branch
WXROT, per the 2.8.0 integration notes). **The extended mode stays locked:** `EXTENDED_GO_LIVE_PERMITTED = False` is not touched, nothing
here is a permit, and the remote kill switch (12.8 item 5) is unchanged. Fakes only; no Home Assistant was contacted or restarted.

### 13.1 What was built

| Follow-up | Where it was recorded | Built |
|---|---|---|
| A picker for the bridge's runnable list | 12.4 item 4, 12.7 item 4 | The bridge options-flow field `local_identity_runnable` is a Home Assistant multi-entity selector (`EntitySelector`, domains `automation` / `scene` / `script`, `multiple=True`) instead of free text. It is pre-filled with `suggested_value` (not `default`, so clearing every item stores an empty list instead of bringing the old one back). The picked list goes through the unchanged `parse_runnable` (format, domains, at most 100) and is stored exactly as before (a sorted list) - the add-on, the directory push, the card's agreement check and every run fence are unchanged. `runnable.selector_value` shows the stored value as the run time uses it (a 0.9.2 text value becomes a list; a malformed value shows nothing). The add-on's own list stays a text field (it lists ids the add-on cannot enumerate from Home Assistant's registry). `BRIDGE_EXTENDED_REQUIRED` stays 0.9.2: no stored format changed. |
| The entity-policy residual risk in the ops guide and the cards | 12.3 item 3; go-live pack risk R5 (minimum mitigation: card + options-flow + ops guide) | The bridge's options-flow description (en / he / strings.json); the add-on's service-identity card (one line under the extended note, `data-si-policy-risk`, he / en - the `local-identity` table has no ar / ru columns); `smplwise_vms/DOCS.md` / `DOCS_HE.md` ("Extended service identity - residual risks the installer must know": R5, the owner-accepted R1 / R2 / R3 / R4 / R8 / R12, R9 / R10, R13, the kill paths of R7 and R14); the Hebrew guide chapter `docs/user-guide/he/47-identity-users_HE.md` (same content, no Home Assistant name - "תשתית המערכת" / "רכיב החיבור"), `GUIDE_ALL_HE.html` rebuilt. The bridge-side check that the service user's policy is not the default (R5 "better") is NOT built. |
| The bypass control offered by permission (the backlog's "bypass button by permission") | 11.6 item 4 | `GET /alarm/panels`: for an Arx-only person, `can.bypass`, `can.restore` and the `arm_custom_bypass` arming mode are offered only while `service_identity.extended_on()` is true (never in this build). Before, a local person holding `alarm.bypass` was shown zone bypass / restore / arming with bypass that the service identity always refused. The routes' refusals are unchanged (still audited `service_identity_refused`); Home Assistant users are unchanged. |

### 13.2 Tests

`tests/test_extid_followups.py` (negative first: the shipped build is locked; a local site administrator with a stored "on" is not offered
bypass / restore / arming with bypass and the route refusal is unchanged; with the permit monkeypatched, offered only once the mode is in
force; an HA user unchanged; the free-text field is gone; the picker, its domains and `suggested_value`; `selector_value` incl. malformed
values; the picker's list judged like the text; bridge 0.9.4 in both copies byte-identical while the add-on still requires 0.9.2; the
residual-risk text in the options flow (en / he / strings) and in DOCS / DOCS_HE / the guide chapter, and no Home Assistant name in the
guide section). Version pins moved to 0.9.4 in the `test_bridge_*` / `test_lovelace_card` files; `test_bridge_runnable.py` asserts the
picker. `frontend/tests/unit-service-identity.spec.ts`: the residual-risk line in he and en, and absent for an older server (a mutation
check - the line removed - turned it red); evidence screenshots refreshed under `docs/evidence/USR2/`.

### 13.3 Not verified / owner actions

- The picker was never rendered by a real Home Assistant (no HA access by rule); its behaviour is taken from the selector API. The first
  real check is the owner's, after the update.
- **Bridge 0.9.4 needs one Home Assistant restart after the update - the owner does it** (`[platform-restart]` in the release notes).
- Release-note lines (draft, for the integration): EN "Extended service identity (still locked): the bridge's list of runnable scripts,
  scenes and automations is picked from a list instead of typed (bridge 0.9.4 - restart Home Assistant once); the residual risks are
  stated in the bridge options, the service-identity card and the documentation; Arx-only people are no longer offered zone bypass,
  its restore or arming with bypass while the extended mode is not in force (they were always refused)." HE: "זהות שירות מורחבת (עדיין
  נעולה): רשימת הסקריפטים, הסצנות והאוטומציות להרצה ברכיב החיבור נבחרת מרשימה במקום הקלדה (גשר 0.9.4 - יש להפעיל מחדש את Home
  Assistant פעם אחת); הסיכונים שנותרו מוסברים באפשרויות הגשר, בכרטיס זהות השירות ובתיעוד; משתמשי Arx בלבד כבר לא רואים עקיפת אזור,
  ביטול עקיפה ודריכה עם עקיפה כל עוד המצב המורחב אינו בתוקף (הם תמיד נדחו)."

### 13.4 Rollback

Revert the branch. The bridge stores the same list in both versions, so a 0.9.2 bridge reads what 0.9.4 saved (and vice versa).
