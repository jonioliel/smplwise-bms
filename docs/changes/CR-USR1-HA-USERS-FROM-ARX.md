# CR-USR1 — Home-system users created from Arx (create / deactivate / activate / delete)

**Status:** APPROVED by the owner on 2026-10-16 (chat, "go ahead"). Implementation on `pilot/USR1` (c4445c86), merged onto
integ/263 as `pilot/USR1-263` (task USR1-263). Migration `0095_ha_managed_users.sql` (renumbered from the provisional 0096;
0094 is reserved for TKWISECRYPT). **Live behaviour against a real Home Assistant is NOT VERIFIED** until the owner's one-time
live check (`docs/operations/USR1_LIVE_CHECK_HE.md`) passes; every test so far ran against the in-process fake
`smplwise_vms/backend/tests/fake_ha_users.py`.

**Design:** `docs/design/USR1_HA_USERS_FROM_ARX.md` (commands, data, failure modes, UI). This document records the
contradictions with the higher-precedence documents, the decision, the exact amendment text and the rollback.

**Precedence (CLAUDE.md / AGENTS.md):** an approved change request ranks above `MASTER_SPEC_HE.md` and `docs/security/`. Following
the CR-017 §8.3 precedent, the security document itself is **not edited** here: the amendment text below is the approved wording,
to be folded into `docs/security/HA_IDENTITY_RBAC_HE.md` and `docs/changes/CR-017-AUTOMATIONS-SCENES-SCRIPTS.md` by the lead at
integration (or kept here as the binding amendment until then).

## 1. Contradictions (recorded in the design as C1-C4)

| # | Source (higher precedence) | What it says | What USR1 does |
|---|----------------------------|--------------|----------------|
| C1 | `docs/security/HA_IDENTITY_RBAC_HE.md` §1, §12 (identity contract) | No new password system; no write-back to HA of groups or admin fields; "users are created in HA only"; no button to change an HA password or to make someone an HA administrator | Arx creates an **ordinary** HA user (group `system-users` only) with a username and password typed by the administrator, and can deactivate / activate / delete **only users Arx itself created** |
| C2 | Same, §2.3 | A site / building / floor administrator has no HA management | Kept: `users.ha_manage` is a SYSTEM permission (built-in `system_admin` only; never in a custom role; never delegable) |
| C3 | Same, §8 | The admin token must not do what the acting person may not do | Kept, and enforced: the actor must hold `users.ha_manage` **and** be an active HA administrator in the bridge-synced directory (`ha_users.is_admin = 1`); otherwise `403 ha_admin_required` |
| C4 | `CR-017` §8.2 | The bridge (`smplwise_bridge`) is the **single enforcement point** for every product write to HA | USR1 calls HA's admin-only WebSocket user commands directly with the add-on's own token (Supervisor proxy) or an owner-supplied administrator token, not through the bridge |

C2 and C3 are not contradictions of the result (the stricter rule is applied); they are listed because the task text named
"site / system admins" and because C3 is the condition under which C1 and C4 are acceptable.

## 2. Decision requested and granted

**Requested (lead, 2026-10-16):** allow USR1 to go forward as a scoped, owner-approved exception to the identity contract (C1)
and to the CR-017 single-enforcement-point rule (C4), with C2 and C3 applied as the stricter guards, and the administrator token
held in the in-app secrets store (TKSECRETS2) rather than an add-on option.

**Granted (owner, 2026-10-16, chat): "go ahead".** Scope of the grant = exactly §3 below; anything outside it still needs the
bridge or a new change request.

## 3. Amendment text

### 3.1 Identity contract (`docs/security/HA_IDENTITY_RBAC_HE.md`), new §12a after §12

> **§12a — Exception CR-USR1 (owner approval 2026-10-16): ordinary home-system users created from Arx.**
> Notwithstanding §1 ("users are created in HA only", no write-back) and §12 (no HA-management button), Arx may perform exactly
> these HA user operations, and no others:
> 1. **Create** an HA user that is **not** an administrator: `config/auth/create` with `group_ids: ["system-users"]` only (never
>    `system-admin`, never `is_owner`), then `config/auth_provider/homeassistant/create` with the username and password the
>    actor typed, and optionally `person/create` linked to it. The request body cannot even carry `is_admin`, `group_ids` or
>    `is_owner` (strict schema). The password passes through once and is never stored, logged, audited or returned. Exactly one
>    Arx role binding is created with the user.
> 2. **Deactivate / activate** (`config/auth/update` with `is_active` only) and **delete** (`config/auth/delete`, plus
>    `person/delete` of the linked person) — **only** of users listed in Arx's `ha_managed_users` table, i.e. users Arx itself
>    created. Never the owner, never an administrator (by the directory or by HA's own answer at the moment of the call), never a
>    system-generated user, never the actor, never the last active Arx administrator. Delete needs the exact username typed.
> 3. **Who:** only an actor holding `users.ha_manage` — a system permission of the built-in `system_admin` role, not delegable
>    and not available in custom roles — **who is also an active HA administrator** in the bridge-synced directory. A site /
>    building / floor administrator never has it (§2.3 unchanged). §8 is unchanged and is the reason for this double condition.
> 4. **Token:** the add-on's own Supervisor token, or — only if the owner chooses — an HA administrator long-lived token stored in
>    Arx's encrypted, write-only secrets store (הגדרות › חיבורים › סודות, entry `ha_users_token`). Never an add-on option, never
>    shown, never logged, never sent to a browser.
> 5. Arx never changes the groups, admin flag, name or password of any existing HA user, never promotes anyone, and offers no
>    "change HA password" or "make administrator" button. Users not created through Arx are managed only in HA's own screen.
> 6. Every operation is audited with ids and outcome codes only (no username, password, token or HA message text).

### 3.2 CR-017 (`docs/changes/CR-017-AUTOMATIONS-SCENES-SCRIPTS.md`), addition at the end of §8.2

> **Exception CR-USR1 (owner approval 2026-10-16).** The bridge remains the single enforcement point for every product write to
> HA **except** the HA user operations of `HA_IDENTITY_RBAC_HE.md` §12a (create a non-administrator user; deactivate / activate /
> delete a user Arx itself created), which `services/ha_user_admin.py` performs over HA's WebSocket API with the add-on's own
> token or the owner's administrator token from the secrets store, gated by `users.ha_manage` + the actor being an active HA
> administrator. No other HA write may use this path; automations, scenes, scripts, registry, entity, door and every other write
> keep going through the bridge as before. Recommended hardening (not required for this exception): a signed
> `smplwise_bridge.user_*` service that runs the same operations with the actor's `Context(user_id=...)`, so HA attributes the
> change to the acting administrator; adopting it needs a bridge release and retires this exception.

## 4. What changed in USR1-263 (relative to `pilot/USR1`)

- Merged onto integ/263 (2.6.3 base, migrations 0001-0093); migration renumbered 0096 → **0095**. The pinned migration lists of
  the older tests were already property-style on integ/263; the few that still named the release tail (`[93]`, `[92, 93]`,
  `== RELEASE`, `range(89, last+1)`) now assert "every migration file from N to the newest runs once, in order". Contiguity of
  the whole sequence stays guarded in one place (`scripts/release_check.py`, `tests/test_release_check.py`,
  `tests/test_migrations_263_upgrade.py::test_the_release_numbers_are_contiguous_and_final`): these are **expected to fail on this
  branch alone** (0094 is TKWISECRYPT's and is not on this branch) and pass once TKWISECRYPT's 0094 is integrated first.
- The add-on option `ha_users_token` (never shipped) is gone from `config.yaml`, `DOCS.md`, `DOCS_HE.md`; `config.py` no longer
  reads it from the options file (developer environment `HA_USERS_TOKEN` only). It is now the secrets-store entry
  `ha_users_token` (`services/secrets_store.SPECS`, label "אסימון מנהל לניהול משתמשי מערכת הבית"; no connection test). The
  routes in `routers/ha_users.py` (list, "בדיקת הרשאה", create, deactivate / activate, delete) read it from the store **on every
  request** (`secrets_store.current_value`): a stored value is used; a cleared or unreadable entry means none (fail closed);
  only with no entry at all the developer environment applies. No restart is needed after saving it.
- The not-authorised texts (server message and screen) now point to הגדרות › חיבורים › סודות instead of the add-on options.

## 5. Rollback

1. **Stop using the administrator token without a release:** clear the secrets entry `ha_users_token` (הגדרות › חיבורים ›
   סודות › מחק); the next request no longer uses it. This does not switch the feature off if the add-on's own token is itself
   authorised (`users.ha_manage` belongs to the built-in `system_admin` role and cannot be removed from it), so the reliable
   switch is step 2.
2. **Code rollback:** remove the `ha_users` router include in `main.py` and the "משתמשי מערכת הבית" tab; the
   `ha_managed_users` table (0095) becomes inert and is left in place (migrations are forward-only); the `ha_users_token`
   secrets entry can stay (unused) or be cleared. No HA state is touched by a rollback.
3. **Users already created through Arx** stay ordinary HA users; manage or delete them in HA's own users screen (הגדרות של
   מערכת הבית › אנשים › משתמשים). The `ha_managed_users` rows keep their ids for the audit trail.
4. **Amendment rollback:** withdrawing this CR restores §1 / §12 of the identity contract and CR-017 §8.2 verbatim; the code
   must be rolled back (step 2) in the same release.

## 6. Open items

- The owner's one-time live check N1-N5 (`docs/operations/USR1_LIVE_CHECK_HE.md`); each step needs the owner's explicit approval.
- Folding §3.1 / §3.2 into the two documents at integration (lead).
- The bridge-based hardening of §3.2 (later, optional).
