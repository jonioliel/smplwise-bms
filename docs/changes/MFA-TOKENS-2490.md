# MFA-TOKENS-2490 - slice 6 of the MFA train: long-lived tokens only are exempt from step-up; the user's own token list

Branch `pilot/MFA-TOKENS-2490`, cut from `origin/pilot/MFA-STEPUP-2490` at `fb9a3ac1e` (slice 1). Train plan and slice 1:
`docs/changes/MFA-STEPUP-TRAIN-2490.md`. No merge, no version bump, no changelog entry, no tag, no lab, Home Assistant, NVR or go2rtc
contact. Fakes only (`tests/fake_ha_core.py`).

Inputs read: `AGENTS.md`, `CLAUDE.md`, `MASTER_SPEC_HE.md` and `docs/security/` (silent on long-lived tokens), the train note, the full
design `docs/design/full-2fa-t095/DESIGN.md` on `origin/pilot/FEATURE-DESIGNS-SEC-2490` (sections 2, 4.1, 9, 11 T6, 13 Q48, 14
2FA-TOKENS), and the code: `services/ha_user_auth.py` (bearer path, session store, `delete_refresh_token_at_ha`), `services/step_up.py`,
`services/app_refresh.py` / `app_session.py` / `routers/app_refresh.py`, `routers/remote.py` (sessions list), `services/partner/core.py`,
`shell/sw-user-menu.ts`, `components/sw-remote-sessions.ts`.

## 1. How bearer callers are authenticated today (finding)

| Credential | Where | Reaches the API as | Kind |
|---|---|---|---|
| HA access token, `Authorization: Bearer` on every request, no cookie | `ha_user_auth._bearer_session` (validated with HA `auth` + `auth/current_user`, cached 60 s, a bearer `RemoteSession`) | `principal.via = "bearer"` | a normal sign-in's 30-minute access token, OR a long-lived access token from the HA profile (default 3650 days) - until this slice indistinguishable to Arx |
| HA access token exchanged once for the Arx cookie (`POST auth/session`) | `ha_user_auth.exchange` | `via = "cookie"` | not a bearer caller |
| Arx-only (local) session cookie `l.` | `local_identity` | `source = "local"` | no HA token at all |
| Phone app: app refresh token `arxr_` -> access token `arxa_` -> one-time code -> WebView cookie `a.` | `app_refresh`, `app_session` | `via = "cookie"`; an `arxa_` token is accepted ONLY by `auth/app/whoami` and the exchange, never as a general bearer | the tokens Arx issues itself (families, revocable by the user and administrators) |
| Device token (presence) | `presence` | device routes only (`device_caller`), never a user principal for settings | Arx-issued, per device |
| Partner token `arxp_` | `partner/core` | the partner interface only (off, go-live not permitted) | Arx-issued, not a user's |

So the only bearer callers the step-up gate sees are HA access tokens; their kind is what this slice adds.

## 2. What this slice changes

### 2.1 The kind of a bearer token (`services/access_tokens.kind_of`)

Every HA access token is a JWT HA signs with a key of the refresh token behind it (`iss`, `iat`, `exp`). The bearer path asks HA to
accept the token before a session exists, so the claims of a session's token are HA's own: a client cannot stretch them without HA's
key. HA gives a normal access token 30 minutes and a long-lived one its `lifespan` (days). Rule: `exp - iat >= 12 h` = `long_lived`,
shorter = `short_lived`, no usable `iat` / `exp` = `unknown`. The kind is fixed when the bearer session is created
(`RemoteSession.token_kind`, `STORE.create(..., token_kind=)`, so no request ever sees a session without it) and recorded in the
`auth.remote_session.created` row (`token_kind`). HA's own `auth/refresh_tokens` type is read only for the list (2.3), not on every
sign-in (no extra HA call on the request path).

### 2.2 Step-up exemption narrowed (`services/step_up.not_applicable`)

Slice 1 exempted every bearer caller (`reason = bearer_token`). Now only a `long_lived` token is exempt (owner decision Q48, reason
still `bearer_token` so the wire and the slice-2 UI stay unchanged). A `short_lived` or `unknown` bearer token is gated exactly like a
session: the proof is kept per HA sign-in (`remote:i:<iss hash>`), so the next access token of the same sign-in keeps it; the bearer
client verifies with `POST auth/step-up/verify` like a browser; and a new bearer sign-in that showed the code (`X-Arx-Second-Factor`)
starts with a fresh proof (`step_up.note_sign_in_factor`, as the cookie exchange already did). `off`, `local_channel` and `no_method`
are evaluated as before.

### 2.3 What Arx saw, and the token list

- Migration **0219** (`remote_token_uses`, PROVISIONAL number - see 6): one row per HA sign-in seen on the bearer path: hashed key (the
  same SHA-256 of `iss` as `remote_revoked_chains`), user, kind, first / last seen, masked address (/24, /48), country, client family,
  count. No token, no refresh-token id, no full address. Written on a new bearer session and at most every 10 minutes on re-validation.
  Not a backup table.
- `GET /api/v1/auth/tokens` (any signed-in user, own tokens only; `wire/access_tokens.py`, `wire-access-tokens.ts`):
  - on the remote channel with an HA session: HA's own list via ONE read-only WebSocket command `auth/refresh_tokens` with the caller's
    own HA token (long-lived tokens with their name, sign-ins with the client host, created, last used), merged with what Arx saw
    (`used_in_arx`, `arx_last_seen_at`, masked address); `current` marks this device's own sign-in; ids are hashes (`ha_...`);
  - HA unavailable / no HA token held (app web session) / Ingress: what Arx saw, with `ha_reason`
    (`ha_unavailable` / `no_ha_token` / `local_channel`); an Arx-only user (`local_user`) has no HA tokens;
  - the tokens Arx issued: the user's live phone-app saved sign-ins (`kind = app`, `revocable = true`).
- `DELETE /api/v1/auth/tokens/{id}`: an `arf_...` id of the caller's own live family -> revoked (`revoked_by_user`, as
  `DELETE auth/app/families/{id}`: the family, its access tokens and web sessions end; the device key pin is released per owner Q296).
  Another user's family answers 404 like an unknown id. An `ha_...` id -> **409 `token_managed_in_ha`** with where to revoke it, no HA
  call at all. `DELETE /api/v1/auth/tokens`: every Arx-issued token of the caller (`signed_out_everywhere`, as `DELETE auth/app/families`).
  Revoking one's own token is not a step-up action (it only reduces access).

### 2.4 Audit rows

| Action | Decision | When | Details (never a token or HA id) |
|---|---|---|---|
| `auth.token.first_use` | allowed | the first time ever a given HA sign-in is used on the bearer path (design T6) | kind, masked address, country, client family; `via = bearer`, `channel = remote` |
| `auth.token.revoked` | allowed | a token Arx issued revoked from the list (one or all) | kind `app`, count (plus the existing `auth.app_refresh.revoked` row) |
| `auth.token.revoke_refused` | denied | a revoke of an HA token was asked | reason `token_managed_in_ha` |
| `auth.remote_session.created` | allowed | (existing) | + `token_kind` |
| `auth.step_up.required` | denied | (existing, slice 1) now also for short-lived bearer callers | `via = bearer` |

### 2.5 Screen: My account › Access tokens (`sw-access-tokens`, `sw-user-menu`)

A new section in the account level, next to "My sign-ins", same list look as `sw-remote-sessions` (no new style). HA rows have no revoke
button; a long-lived token carries a "no repeated check" badge and a warning ("if you do not recognise it, revoke it in Home
Assistant"); one hint line says where HA tokens are revoked (Profile › Security) and that Arx does not change them; app rows have
"Revoke", and with two or more a "Revoke all saved sign-ins" button that asks once more. Hebrew + English (`msg/components`,
`msg/shell`). Compare page: `private/planning/mfa_tokens_compare_2026-11-24.html`.

### 2.6 Files

`smplwise/services/access_tokens.py` (new), `smplwise/routers/access_tokens.py` (new), `smplwise/wire/access_tokens.py` (new),
`smplwise/migrations/0219_remote_token_uses.sql` (new), `smplwise/services/ha_user_auth.py` (`token_kind`, kind at creation, use
recording, bearer sign-in proof), `smplwise/services/step_up.py` (the exemption), `smplwise/routers/__init__.py` (mount),
`scripts/gen_wire_types.py` (family), `frontend/src/api/generated/wire-access-tokens.ts` (generated), `contracts/API_INVENTORY.md`
(regenerated), `frontend/src/api/access-tokens.ts`, `frontend/src/components/sw-access-tokens.ts`, `frontend/src/shell/sw-user-menu.ts`,
`frontend/src/i18n/lang/en/i18n/msg/{components,shell}.ts`, `tests/test_mfa_tokens_2490.py` (new), `tests/test_mfa_stepup_2490.py`
(the bearer test now uses a long-lived token), `tests/fake_ha_core.py` (a long-lived token lives its lifespan and has a name, like HA),
`frontend/tests/evidence-access-tokens.spec.ts` (new).

## 3. Never touched: Home Assistant users and tokens

The new code sends HA exactly two WebSocket commands: `auth` and `auth/refresh_tokens` (read-only) - pinned by
`test_the_list_shows_ha_tokens_read_only_and_what_arx_saw` (the fake socket records every command sent) and a source ratchet
(`test_the_token_code_only_reads_from_home_assistant`: no delete / create / revoke command or helper in the two modules). A revoke of
an HA token makes no HA call at all (`test_an_ha_token_is_never_revoked_or_changed_by_arx`: HA's refresh tokens and users unchanged,
the token still works in Arx).

## 4. Contradictions found (recorded, not resolved silently)

1. **Revoke of HA tokens.** Design T6 / row 2FA-TOKENS asks for "one-click revoke and revoke-all" of the per-user long-lived-token list.
   The lead's instruction for this slice (and the CLAUDE.md rule "never create, change or revoke HA users or HA tokens") forbids it.
   **Implemented: HA tokens read-only** with where to revoke them; revoke only for the tokens Arx issued. Open question 7.1 offers an
   Arx-side block that changes nothing at HA.
2. **Existing behaviour that does touch HA.** Since CR-008 P2, a user ending their OWN remote sign-ins ("sign out everywhere", ending
   one session in "My sign-ins") deletes at HA, with the user's own token, the refresh tokens that HA confirms are Arx's own normal
   sign-ins (`delete_refresh_token_at_ha`; never a long-lived token or another client's). That predates this slice and is unchanged;
   it is listed here because a strict reading of the rule above would forbid it too.
3. **Dependency on slice 5.** The plan makes slice 6 depend on slice 5 (provenance via `auth/refresh_tokens` at sign-in). Slice 5 is not
   built; this slice tells the kinds apart from the HA-signed token lifetime instead (2.1), with no extra HA call per sign-in, and uses
   `auth/refresh_tokens` only for the list. Slice 5 can later add the type check at sign-in without changing the gate.
4. **Fail closed vs Q48.** A bearer token whose kind cannot be read (`unknown`) is gated (design section 9: "unknown ... never silently
   pass"). Real HA tokens always carry `iat` / `exp`, so no allowed long-lived token is affected.

## 5. Residual risk (Q48, recorded)

A long-lived token skips step-up by the owner's decision. HA lets anyone holding ANY valid HA access token of a user create a new
long-lived token for that user (HA profile / WebSocket `auth/long_lived_access_token`). So a stolen short-lived token - which this slice
now gates - can be turned into an exempt one at HA. Mitigations built here: the first use of every token from outside is audited once
and shown in the user's list with when and from where; the list warns about long-lived tokens. Not built (open questions 7.1-7.3): a
notice, an Arx-side block, a maximum token age, or `security.remote_long_lived_tokens = refuse_under_policy` (slice 5).

## 6. Migration number

`0219_remote_token_uses.sql` is PROVISIONAL: the base ends at 0216, `0217_camera_discovery_origin` / `0218_mb_home_building` are on 2.50
branches (`git branch -r`, scanned 24.11), and the recovery-codes slice (`pilot/MFA-RECOVERY-2490`, not pushed yet) may add one too.
It may be renumbered at integration; the content does not depend on the number. Rollback: older code never reads the table.

## 7. Open questions (recommendation first)

1. **Block an HA long-lived token inside Arx** (Arx stops accepting it; nothing changes at HA). (a) add a per-row "stop accepting in
   Arx" with a block list that is never pruned (today `remote_revoked_chains` is pruned after 365 days, shorter than a 10-year token)
   [recommended: the mitigation T6 asked for, without touching HA]; (b) no - revoke only in HA.
2. **Notice on the first use of a token from outside.** (a) a notify source `security.token_first_use` to the token's user (and the
   owner for an administrator's token) in the next slice [recommended]; (b) audit only (today).
3. **Maximum token age** `security.remote_token_max_days` (design, default 0). (a) build it with the policy settings of slice 5
   [recommended]; (b) now.
4. **Kind rule.** (a) keep the HA-signed lifetime (>= 12 h = long-lived) [recommended: no extra HA call, cannot be forged]; (b) also ask
   HA's `auth/refresh_tokens` type on each new bearer sign-in (one more HA round trip per sign-in; slice 5 provenance).
5. **Administrators.** (a) no "all users" token view now; administrators keep the sessions list and `auth/app/families?user_id=`
   [recommended]; (b) add `scope=all`.

## 8. Overlaps with the other slices

- `services/step_up.py`: slice 3 (`pilot/MFA-STEPUP-GATES-2490`) rewrites much of it; this slice changes only the bearer branch of
  `not_applicable` (6 lines) and one docstring line.
- `tests/test_mfa_stepup_2490.py`: the bearer test renamed and switched to a long-lived token (slices 2 / 3 add tests elsewhere).
- `services/ha_user_auth.py`: `RemoteSession.token_kind`, `STORE.create(token_kind=)`, `_bearer_session` (slice 4 / 5 will touch the
  sign-in path too).
- `frontend/src/shell/sw-user-menu.ts`: one new section (slice 11 "screens" will rework the account page); slice 2 did not touch it.
- `scripts/gen_wire_types.py` and `routers/__init__.py`: one line each. Slice 7 (recovery) may add a migration (6).
- Not touched: `wire/second_factor.py` (the `reason` literal stays `bearer_token`), `he.ts` / `en.ts` (slice 2's files).

## 9. Tests (real runs)

TBD
