# Google Drive as an off-box backup destination (GDRIVEBK-2310)

Status: **built, OFF by default** (owner approval 2026-10-31). Branch `pilot/GDRIVEBK-2310`, based on `main` v2.29.0. It finishes the
GDRIVEBK-295 design + scaffold (commit `8a96b77f2` on `pilot/GDRIVEBK-295`, never merged) and adapts it to the off-box phase 2
targets model and the off-box restore that main gained since. Not verified against real Google: every test runs against
`tests/fake_gdrive.py` (section 10).

Owner setup steps: `docs/operations/GDRIVE_BACKUP_SETUP.md` (English) and `docs/operations/GDRIVE_BACKUP_SETUP_HE.md` (Hebrew, short).

Related: `docs/architecture/DATA_STORE_HARDENING.md` section 2 (the off-box copies: S3 and SFTP), `docs/operations/OFFBOX_RESTORE_HE.md`
(restore from an off-box copy). Google Drive is one more target kind of that pipeline, not a separate backup system.

## 1. How it plugs in: one more transport behind the same interface

| Piece | Where | For Google Drive |
|---|---|---|
| Destination interface `put / get / list / delete / describe / close` | `services/backup_offbox.py` `Destination` | `offbox_gdrive.GDriveDestination` implements it |
| Target registry `build_destination(cfg)`, `CREDENTIAL_FIELDS`, `ALLOWED_FIELDS` | `services/backup_offbox.py` | kind `gdrive`: config `client_id, folder_name, chunk_mib, prune_mode, quota_margin_pct, min_free_mib`; credentials `client_secret, refresh_token` (references `store:offbox.<target>.<field>` only) |
| Targets, sealed secrets, runs | `services/offbox_store.py`, tables of migration 0136, widened by **0186** | rows of kind `gdrive`; secret fields `client_secret`, `refresh_token` |
| Push = list, plan, seal (SWXB v1, AES-256-GCM, keyring outside the DB), upload, read back, verify (deep), then prune | `backup_offbox.push` | unchanged: Drive only ever receives the sealed file |
| Daily push after the backup + `backup.offbox_failed` alert | `offbox_runtime.after_backup` / `_notify` | unchanged; Hebrew reasons added for the Drive codes |
| Connection test (marker written, read, deleted, list) | `backup_offbox.check_connection` | unchanged |
| Retention (newest N + daily / weekly / monthly; foreign names never deleted) | `backup_offbox.RetentionPolicy` | unchanged; `prune_mode` delete or trash |
| Restore drill of the newest copy | `offbox_runtime.fetch_latest_copy`, `backup_drill.run_offbox_drill` | unchanged |
| Restore FROM a copy (list copies, prepare, confirm) | `services/offbox_restore.py`, `/backups/offbox/restore*` | unchanged (uses `list` / `get`) |
| One transfer at a time | `offbox_runtime._LOCK` | shared with S3 / SFTP |
| Test seam | `offbox_runtime.S3_CLIENT / SFTP_CLIENT` | `offbox_runtime.GDRIVE_HTTP` (an `httpx.Client` factory), `offbox_gdrive.SLEEP` |

The scaffold's separate settings-based runtime (`gdrive_runtime.py`, `routers/backup_gdrive.py`, settings `backup.gdrive.*`) was NOT
brought over: a Google Drive destination is now a normal target row, so several Drive targets (for example one per building's
Google account) work like several S3 targets, and every existing screen, alert, drill and restore path covers it.

## 2. Authorization: the OAuth 2.0 device authorization grant

The add-on has no public HTTPS redirect URL and the administrator's browser usually runs on another device, so the web-server flow
does not fit, and Google turned off the out-of-band copy-paste flow. Arx uses the **device authorization grant** with a client of
type **"TVs and Limited Input devices"** created by the owner in the owner's own Google Cloud project:

1. "Connect Google account" -> `POST https://oauth2.googleapis.com/device/code` (`client_id`, `scope=https://www.googleapis.com/auth/drive.file`).
2. The screen shows the short `user_code` and Google's page `https://www.google.com/device` (any other link in Google's answer is
   refused, `remote_error`). The administrator opens it on any phone or computer, signs in to Google there (Arx never sees the
   password) and approves.
3. The screen polls `POST .../gdrive/poll`; the server polls `https://oauth2.googleapis.com/token` with the device-code grant, never
   faster than Google's `interval` (an early poll is answered locally; `slow_down` adds 5 s). `authorization_pending` -> pending,
   `access_denied` -> denied, `expired_token` -> expired, `invalid_client` -> `gdrive_client_invalid`.
4. On success the **refresh token is sealed at once** (below) and forgotten in memory. A grant without `drive.file` is refused
   (`gdrive_scope_refused`). The device code lives only in process memory (`offbox_gdrive_connect._PENDING`) until the grant ends;
   it is never stored, returned, logged or audited. A restart drops a pending grant (press connect again).

Connecting never switches the target on: the administrator does that (OFF by default), after exporting the encryption key.

## 3. Scope: `drive.file` only, one folder

The app sees **only the files and folders it created**. One folder per target in the root of the connected Drive (`folder_name`,
default `SmplWise Arx backups`; no quote, backslash or control character), found by name among the app's own folders or created; a
trashed folder is replaced. No `drive`, `drive.readonly` or `drive.appdata` (appdata is hidden from the user, who then could not
download a copy by hand in a disaster). With `drive.file` access is bound to the OAuth client: copies uploaded through client X are
invisible to client Y, so changing the client id clears the stored refresh token (the API does it) and the old copies stay in Drive,
downloadable by hand but no longer listed or pruned by Arx.

## 4. Secrets at rest and how the add-on reads them

| Value | Where | How it is read |
|---|---|---|
| Client ID (not a secret) | `backup_offbox_targets.config_json` -> `client_id` | the configuration, validated (`<digits>-<id>.apps.googleusercontent.com`) |
| Client secret | `backup_offbox_secrets` (target, `client_secret`), sealed with the installation key (`connection_store.seal_app_secret`, name `offbox_<target>_client_secret`) | typed once in the form as a password field (write-only; the API answers only `secrets.client_secret: true/false`); opened by `offbox_store.secret_lookup` through the reference `store:offbox.<target>.client_secret` when a token is needed |
| Refresh token | `backup_offbox_secrets` (target, `refresh_token`), sealed the same way | written ONLY by the consent flow; the API refuses it in a request body (`gdrive_token_via_connect`); read like the client secret |
| Access token | memory only (`RefreshTokenSource`), refreshed 60 s before expiry and once on a 401 | never stored |

None of the tables is a backup table (`services/backup.py`), so a project archive never carries a target, a client secret or a
token, and a restore never connects a Drive. **Disconnect** asks Google to revoke the refresh token (best effort; `revoked:
true|false|null`), deletes the sealed token and switches the target off. The owner can also revoke at
myaccount.google.com > Security > Your connections to third-party apps.

## 5. Encryption before upload

The archive is sealed (SWXB v1) by `backup_offbox.push` before the transport sees it; `GDriveDestination.put` only uploads the file it
is given, and the push hands it the sealed file. Google sees ciphertext plus the object name (`<archive stem>.zip.swxb`).
**Losing the keyring loses every Drive copy**: the screen warns on a Drive target until a key has been exported.

## 6. Uploads, retention, quota, failures

- **Uploads**: multipart up to 5 MiB (the connection-test marker, small archives); above that a **resumable** upload in chunks of
  `chunk_mib` MiB (default 8; multiples of 256 KiB). After a failed chunk Arx backs off, asks the session how much it holds
  (`Content-Range: bytes */size`) and goes on from there; an expired session (404 / 410) restarts the upload once. The session URL is
  a capability: never logged, never followed to another host.
- **Same name**: Drive allows two files with one name: `put` removes the older one after the new one landed, `get` reads the newest.
- **Retention**: the target's `RetentionPolicy`, applied only after the new copy verified. `prune_mode`: `delete` (default) or
  `trash` (Drive keeps it 30 days and it still counts against the quota).
- **Quota**: before an archive upload `about.storageQuota` is read; with less free space than size + `quota_margin_pct` % (default 10)
  + `min_free_mib` (default 100) the upload is refused up front (`quota_exceeded`) - nothing uploaded, nothing pruned. Drive's own
  `storageQuotaExceeded` maps to the same code and is not retried.
- **Retries**: 429, 5xx and Drive's rate-limit reasons back off exponentially (500 ms base, 32 s cap, 5 retries, jitter). A rate limit
  that outlasts them is `rate_limited`; a server that keeps failing `destination_unavailable`. 401 refreshes the access token once.

Statuses (fixed codes; Hebrew words in `offbox_runtime.REASON_HE` for the alert, `routers/backup_offbox.MESSAGES` for the API,
`frontend/src/i18n/backup-offbox.ts` for the screen; never a token, a body or a URL):

| Code | Meaning |
|---|---|
| `quota_exceeded` | not enough free space in the Drive |
| `rate_limited` | Google kept limiting the requests; the next run tries again |
| `gdrive_reconnect_required` | refresh token revoked / expired (unused 6 months, consent screen left in Testing: 7 days) - connect again |
| `gdrive_not_connected` | no account connected yet (also the answer to switching the target on before connecting) |
| `gdrive_client_invalid` / `gdrive_client_missing` | Google refused the client id / secret, or they are not configured |
| `gdrive_scope_refused` | the client or the approval did not allow `drive.file` |
| `gdrive_token_via_connect` | a request tried to set the refresh token directly |
| `permission_denied`, `object_missing`, `remote_error`, `destination_unavailable`, `auth_failed` | as for the other transports |

## 7. API (all `backup.manage` at installation scope, audited without values)

The existing target routes take `kind: "gdrive"` (`POST/PUT/PATCH/DELETE /backups/offbox/targets...`, `/test`, `/push`, `/copies`,
the restore routes, the drill). New:

| Route | Does |
|---|---|
| `POST /api/v1/backups/offbox/targets/{id}/gdrive/connect` | starts the consent; answers `user_code, verification_url, expires_in, interval` (audit `backup.offbox.gdrive_connect_start`) |
| `POST /api/v1/backups/offbox/targets/{id}/gdrive/poll` | one poll: `state` none / pending / slow_down / denied / expired / connected (audit `backup.offbox.gdrive_connect` on an end state) |
| `POST /api/v1/backups/offbox/targets/{id}/gdrive/disconnect` | revoke + delete the token + switch off (audit `backup.offbox.gdrive_disconnect`) |

`GET /backups/offbox` lists `transports.gdrive: true`, and each Drive target carries `gdrive: {connected, pending, connected_at}`.
An enabled Drive target needs both secrets (`gdrive_not_connected` otherwise). The routes follow the S3 / SFTP target routes on the
remote channel (not in `remote_channel.BLOCKED_ON_REMOTE`); blocking the whole off-box administration remotely is a separate decision.

## 8. Screen

Settings > Diagnostics > Backup and restore > Off-box copies: "Add Google Drive" next to "Add S3 target" / "Add SFTP target". The form
(Hebrew labels, RTL, LTR fields for ids): name, client id, client secret (password field, write-only), folder name, old copies
(delete / trash), chunk size, quota margin, minimum free space, retention, and the switch (disabled until connected). The target row
shows "Google account connected / not connected", "Connect Google account" / "Reconnect" / "Disconnect account", and the key-export
warning until a key was exported. The consent dialog shows the three steps, the link to google.com/device and the large code, and polls
at the server's interval.

## 9. Migration 0186

`0186_offbox_gdrive.sql` widens two CHECKs (SQLite cannot): `backup_offbox_targets.kind` += `gdrive`, `backup_offbox_secrets.field` +=
`client_secret`, `refresh_token`. The three tables are rebuilt with every row kept; the children are copied aside and dropped before
the parent so the `ON DELETE CASCADE` never fires. Test: `test_migration_0186_keeps_every_row_and_accepts_gdrive`. Rollback: the
previous version reads the tables unchanged; delete the Drive targets first to go back fully (their copies stay in Drive).

## 10. Honest risks and what is not verified

- **Never run against real Google.** The fake follows Google's documented answers (device flow errors, 308 + `Range`, `storageQuota`,
  error reasons). One owner-supervised run with the owner's own test account is the next step (a separate, approved task).
- **Refresh tokens die silently**: revoked, unused 6 months, the 7-day limit of a consent screen left in "Testing", a Workspace policy,
  or the limit of live refresh tokens per client and account (each reconnect issues one). Mitigation: `gdrive_reconnect_required`
  on the daily run raises the `backup.offbox_failed` alert.
- **Client-bound visibility** (section 3): a new Google Cloud project orphans the old copies for Arx.
- **Keyring loss = copy loss** (section 5).
- **Consumer storage is small** (15 GB shared with Gmail and Photos): the pre-flight refuses and never prunes to make room.
- The client secret of a "TVs and Limited Input devices" client is not confidential in Google's model; it is still sealed and
  write-only here.
