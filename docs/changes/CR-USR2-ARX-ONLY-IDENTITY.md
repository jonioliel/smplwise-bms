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
**Implementation:** phase P0 + P1 on `pilot/USR2-P1` (migration 0097 provisional, the lead renumbers).

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
>    Home Assistant action of a local identity is refused (fail closed).
> 6. Local credentials are **memory-hard password hashes only**, stored as PHC strings (argon2id when the argon2-cffi library is
>    present in the add-on image; until that is verified, scrypt N=2^17, r=8, p=1, 128 MiB - or N=2^16 on a host under 1 GiB);
>    no password, link token or session id is ever stored, logged, audited, exported or returned in clear (hashes of all three).
>    The password hashes travel in the access part of a project backup; sessions, links, failure counters and TOTP secrets never do.
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
| 5 | Both reset kinds, chosen per user (`manager_only` default / `self_service`), self-service refused for admins | `auth_local_credentials.reset_mode`, create / PATCH validation, admin role switches back to `manager_only`; manager-issued links (`POST .../link`). The self-service flow (WhatsApp code) is phase 2 |
| 6 | App refresh token, app only - later (P5) | Not built. Schema compatible: `auth_local_sessions.kind IN ('browser','app')`, chain model, hashed ids |
| 7 | Both identities allowed, manual link, disable suggests | `identity_links` (migration 0097), `PUT/DELETE /identity/local-users/{id}/ha-link`, PATCH active answers `suggest_also` |
| 8 | Hashes in the project backup; sessions / links / failures / TOTP excluded | `services/backup.py` ACCESS_TABLES gains `auth_local_credentials`, `identity_links` |

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
never delegable); the settings keys; migration 0097; `services/local_passwords.py` (hashing, policy, local denylist);
`services/local_identity.py` (sessions, tiers, links, janitor); `routers/local_identity.py`; the cookie branch in
`services/ha_user_auth.py`; the sessions list / revoke extension; the one-binding rule; the directory-sync exemption (R11); the TOTP
sign-in step and the administrative-permission rule; the sign-in page mode and the welcome (set-password) page; the settings tab
"משתמשי Arx".

Later phases (design record §18): P2 self-service reset through WhatsApp, WhatsApp link delivery, notifications
(`auth.local.account_delayed`, `auth.local.storm`, new location), P3 the service identity (bridge message shape, both-side
allow-list, device control / alarm / cast / media / schedules), P4 passkeys, P5 the app refresh token (answer 6), purge after 30
days, `GET /me/export`, the Hebrew user guide, the API inventory and the security review round.

## 4. Exposed surfaces (for the security review)

| Surface | Who can reach it | Controls |
|---|---|---|
| `POST /arx/api/v1/auth/local/sign-in` | anyone on the internet (through the tunnel) | remote only; 403 while off; login CSRF (same-origin proof); https behind the tunnel; per-address tier 20 / min, 100 / h, 300 / day (429 + Retry-After, audit throttled); per-account delay from the 5th failure in 15 min (30 s doubling to 15 min, sleep <= 3 s on the event loop; unknown names follow the same schedule in memory); global tier 300 failures / 10 min (2 s wait, stale accounts refused); uniform 401 body; one hash computation on every path (dummy hash, made once per process before the lookup); 128-byte cap; semaphore of 2 around hashing |
| `POST /arx/api/v1/auth/local/sign-in/second-factor` | holder of a 5-minute pending cookie (random 256-bit id, memory only, Path = the sign-in route) | 5 attempts per pending record; CR-011 lockout (5 wrong / 5 min -> 10 min, persisted); per-address 20 / min |
| `POST /arx/api/v1/auth/local/set-password` | holder of a link token (fragment of the URL) | 10 / min / address; SHA-256 of the token stored; single use, 1-168 h, invalidated by a newer link / disable / delete / password change; uniform 401 `link_invalid`; policy check; no session created; every session of the user ends |
| Session cookie `l.<43>` under `__Secure-arx_session` | the signed-in browser / app WebView | HttpOnly, Secure (behind https), SameSite=Strict, Path=/arx/; SHA-256 stored; rotation (sign-in, 24 h, password change, factor enrolment, permission change) with a 60 s grace; absolute + idle expiry; existing CSRF middleware; revocation empties the 15 s cache at once; WebSockets attached per chain and closed on revoke |
| `/api/v1/identity/local-users*` | `identity.directory.read` (read) / `identity.local.manage` (write) - system administrators | audited; links returned once and never readable later; admin targets local-channel only (404 remotely); CSV with formula neutralisation |
| `PUT /auth/local/password`, `PATCH /auth/sessions/{id}` | the local user itself | current password (+ TOTP when enrolled); 5 / min per user |
| Ingress headers | the Supervisor proxy address | an `l_` id in `X-Remote-User-Id` is refused |
| Bridge directory push | the paired bridge (HMAC) | `l_` ids ignored; `source = 'local'` rows never mirrored or dropped |

## 5. Rollback

Switch `security.local_identity` off (every local session ends; nothing else changes). Code rollback: revert the branch; migration
0097 is additive (new tables, nullable columns) - older code ignores them; the `identity.local.manage` permission in `roles.json`
is unknown to older code and harmless.

## 6. NOT_VERIFIED

1. argon2-cffi wheels for the add-on image (Alpine 3.22 musl, amd64 + aarch64): not checked here, so the dependency is not added
   and scrypt is the active algorithm (PHC prefix `$scrypt$`; an `$argon2id$` row verifies only when the library is present).
2. scrypt cost on the owner's host (N=2^17 is 128 MiB per computation; two at most at once): not measured.
3. Cloudflare: that `CF-Connecting-IP` cannot be set by a caller on the tunnel path (only the per-address tier trusts it); that
   cloudflared sends `X-Forwarded-Proto: https` (the https check refuses only an explicit `http`).
4. The phone app WebView keeping the cookie for 30 days across restarts (Android / iOS): needs real devices.
5. The tickets module's link-token technique (fragment vs path) - the welcome link uses the fragment.
