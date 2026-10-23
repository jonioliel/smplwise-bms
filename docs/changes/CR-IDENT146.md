# CR-IDENT146 - purge and personal-data export for Arx-only (local) identities

Board item r146. Status: implemented on `pilot/IDENT146-295`, default OFF. Migration `0150` is PROVISIONAL (renumber at integration).

## Why
Arx's local identities (`users.source = 'local'`, USR2) were soft-deleted only; nothing ever removed the personal data, and a person
had no way to obtain what Arx holds about them. The owner's stated policy: purge an account 30 days after it was disabled or deleted.

## What is purged, anonymised, kept
| Data | Treatment |
|---|---|
| credentials (password hash, reset mode), sessions, first-login / reset links, reset codes and send counters, passkeys (public keys), HA identity link, group memberships, TOTP secret and failure state | deleted |
| user preferences, plan-view / automation / push preferences, ticket saved views, browser push subscriptions, mobile devices, push messages, presence events (location), notification recipient / delivery rows, action tokens, known sign-in devices, remote sign-in record, remote revoked chains, alarm PIN policy | deleted |
| `users` row | kept as a tombstone: username `purged-<8 chars>`, display name "Deleted user", e-mail and notes cleared, `purged_at` set. The id must keep resolving (audit rows, grants, ticket authorship) |
| names typed into kept records (`tickets.created_by_name`, `ticket_events.actor_name`, saved camera view owner name, announcement username) | replaced by "Deleted user" / cleared |
| tickets, ticket events, grants, bindings (already revoked) | kept (business records; they reference the pseudonymous id only) |
| `audit_log` | NEVER touched by the purge (legal-hold style exclusion). Rows follow `audit.retention_days` (365). They hold id + username at the time |
| backups | personal rows leave a live DB only; an older backup archive still holds the old account until it is rotated out (see questions) |

Selection: `source = 'local'`, `active = 0`, not yet purged, and the LATEST of `disabled_at` / `deleted_at` is at least N days old
(N = `privacy.local_purge_days`, default 30, never below 30). An account that is active again is never due. The purge is irreversible.
Each account is purged in its own transaction with one audit row (`identity.local.user.purged`: id and per-table counts, no names).

## Export
`GET auth/local/personal-data` (the signed-in local person, own data only) and `GET identity/local-users/{id}/personal-data`
(`identity.local.manage`, system_admin only, on a data-subject request). JSON bundle `arx-personal-data/1`, attachment, `no-store`, built on
request and never stored (so it can never enter a backup). Content comes from an allow-list of columns: profile, sign-in metadata,
role bindings, passkey labels / transports (no credential id, no key), sign-in sessions (masked address, country, agent), links (dates only),
preferences, push / plan / automation preferences, saved views, devices, presence events, received notifications, tickets the person
created, their ticket activity, alarm policy dates, second-factor status, audit rows where they are the actor (no details) and what
others did to the account (no actor, no details). Excluded: password hash, token / session / link hashes, TOTP secret, PIN hash, passkey
material, push endpoint and keys, device tokens, other people's data. Lists are capped at 5000 rows (`truncated` names a capped list).
Each export writes one audit row (`identity.local.user.data_exported`: subject id and counts; a refusal while the switch is off is audited too).

## Settings (all default OFF, installation policy, never restored from a backup - `backup.SETTINGS_KEEP`)
`privacy.local_purge` (on/off, off), `privacy.local_purge_days` (30-3650, 30), `privacy.personal_export` (on/off, off). Changing them needs
`system.configure` (system_admin). Hook: `main.janitor_tick -> services/local_privacy.janitor` (hourly per process, never raises).

## Open owner questions (recommendation first)
1. Disabled but not deleted accounts: purge them too (as stated), or only deleted ones? Recommendation: as stated (both), because a
   disabled account for 30 days is treated as abandoned; the administrator sees the countdown before enabling the switch.
2. Audit rows keep username for 365 days after a purge. Recommendation: keep (security trail); alternative is to blank `actor_username`
   on purge - needs lawyer's view (the legal pack already holds the open privacy items).
3. Backups: an archive written before a purge still contains the account. Recommendation: document the rotation (daily 7 / pre-upgrade 5)
   as the horizon and do not rewrite archives; a restore of an old archive re-creates the person, and the purge runs again after 30 days
   only if the account is still disabled.
4. Export for HA identities (`source = ingress`)? Not in scope here (their lifecycle is Home Assistant's); recommendation: separate item.
5. Who may switch the settings on: system_admin only (as built). Confirm.
6. Should a person be able to request the export when their own account is disabled? Recommendation: yes via the administrator route only.
