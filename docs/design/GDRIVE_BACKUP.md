# Google Drive as an off-box backup destination (GDRIVEBK-295)

Status: **design + backend scaffold, OFF by default.** The consent step that connects a Google account is a marked TODO
(`TODO(GDRIVEBK-OAUTH)`) behind an interface and waits for the owner's decisions in section 9. No screen yet; only a settings API.
Branch `pilot/GDRIVEBK-295`, based on `release/2200`.

Related: `docs/architecture/DATA_STORE_HARDENING.md` section 2 (the existing off-box copies: S3 and SFTP). Google Drive is one more
destination of that pipeline. It is not a separate backup system.

## 1. What already exists and is reused unchanged

| Piece | Where | Reused for Drive |
|---|---|---|
| Destination interface (`put / get / list / delete / describe / close`) | `services/backup_offbox.py` `Destination` | `GDriveDestination` implements it |
| Encryption before upload: SWXB v1, AES-256-GCM in 1 MiB records, keyring outside the DB, export once, rotation, import | `backup_offbox.seal_file / open_file`, `services/offbox_keys.py` | unchanged. Drive only ever stores ciphertext |
| Push = list, plan, seal, upload, download again, verify (hash or deep), and only then prune | `backup_offbox.push` | unchanged. A copy that did not verify never causes a prune |
| Retention (newest N + daily / weekly / monthly), names it did not write are never deleted | `backup_offbox.RetentionPolicy` | unchanged, values per Drive settings |
| Connection test (marker written, read back, deleted, list) | `backup_offbox.check_connection` | unchanged |
| Restore drill of the newest off-box copy | `offbox_runtime.fetch_latest_copy` + `backup_drill` | same path once wired (open item) |
| Installation-key sealing of secrets | `connection_store.seal_app_secret`, table `app_secrets` (migration 0093) | refresh token + optional client secret |
| One transfer at a time | `offbox_runtime._LOCK` | shared: a Drive transfer and an S3 / SFTP transfer never overlap |

## 2. Authorization: which OAuth flow fits a Home Assistant add-on

The add-on has no public HTTPS redirect URL, and the administrator's browser usually runs on another machine (HA Ingress, the
phone app). That rules out the usual web-server flow. Google turned off the copy-and-paste out-of-band flow (`urn:ietf:wg:oauth:2.0:oob`)
in 2022–2023.

**Recommended (A): the OAuth 2.0 device authorization grant ("TVs and Limited Input devices" client).**
1. The administrator presses "Connect Google Drive". Arx calls `POST https://oauth2.googleapis.com/device/code` with `client_id` and
   `scope=https://www.googleapis.com/auth/drive.file`.
2. Arx shows the short `user_code` and the `verification_url` (google.com/device). The administrator opens it on any device, signs in
   to Google there (Arx never sees the Google password), and approves.
3. Arx polls `POST https://oauth2.googleapis.com/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code` at the given
   `interval` (it slows down on `slow_down`). On success it seals the **refresh token** at once. The device code stays in memory and is
   never stored or returned.
- Fits a headless box exactly, and needs no redirect URI at all.
- To verify at implementation time against Google's current list: `drive.file` must be one of the scopes the device flow allows
  (Google's documentation listed it at the time of writing). If Google removes it, use fallback B.

**Fallback (B): installed-app ("Desktop") client with a loopback redirect, finished by hand.** Arx builds the authorization URL with
PKCE and `redirect_uri=http://127.0.0.1:<port>`. After approval, the browser fails to load `127.0.0.1` (it is the administrator's own
machine, not the add-on). The administrator copies the address bar into Arx, and Arx exchanges the `code` together with the PKCE
verifier. It works, but it is clumsy and error-prone. Use it only if A is not possible.

Rejected: a SmplWise-hosted redirect relay (it would put SmplWise in the token path of every customer's Drive, and needs a
public service plus a security review). An HA "application credentials" integration: Arx is an add-on, not an HA integration, and HA
would hold the token, not Arx.

**Interface (built).** `offbox_gdrive.OAuthFlow` has `start(client_id, scope) -> DeviceAuthorization` and
`poll(client_id, auth) -> PollResult(state, refresh_token)`. The production value is `NotImplementedFlow`, which refuses every
call with `gdrive_oauth_not_implemented` (HTTP 501), so nothing calls Google. The tests inject a fake flow. The routes, the
pending-authorization handling, the sealing and the audit are built and tested around the interface.

## 3. Scope: the narrowest one

`https://www.googleapis.com/auth/drive.file` only. The app sees **only the files and folders it created itself**, nothing else in the
user's Drive. Google classifies it as a non-sensitive scope, so verification is lighter (section 9). No `drive`, no
`drive.readonly`, no `drive.appdata`: appdata is hidden from the user, who then cannot see or download the copies from Drive in a
disaster.

Consequence: with `drive.file`, access is tied to the OAuth client. A copy uploaded through client X is invisible to client Y. If
the client id ever changes (a new Google Cloud project), the old copies stay in the user's Drive and are still downloadable by hand
from drive.google.com, but Arx cannot list or prune them. This is a reason to decide the project ownership once (section 9).

## 4. Tokens and secrets at rest

- **Refresh token**: sealed with the installation key (`connection_store.seal_app_secret`, associated data
  `app_secret|gdrive_refresh_token|value`) into the `app_secrets` table. It is **not** a `secrets_store.SPECS` entry: the Secrets
  screen does not offer it for typing, because it only ever arrives from the consent flow. Not a backup table. Never returned,
  logged or audited. A blob that cannot be read (the key changed) counts as "not connected" (fail closed).
- **Client secret** (optional; device and desktop clients have one, and Google says it is not confidential for those client types): written only
  through `PUT /backups/gdrive/settings` as a SecretStr, sealed the same way (`gdrive_client_secret`), answered only as
  `client_secret_configured: true|false`.
- **Access token**: only in memory (`RefreshTokenSource`), refreshed 60 s before it expires and on any 401 (once).
- **Client id**: not a secret. It is kept in the settings (`backup.gdrive.config`).
- Settings `backup.gdrive.config` and `backup.gdrive.state` are under the `backup.gdrive.` prefix of `backup.SETTINGS_KEEP_PREFIXES`.
  A project archive never carries them, and a restore never switches the Drive backup on or moves its folder id.
- **Disconnect**: Arx asks Google to revoke the refresh token (best effort; the answer says `revoked: true|false|null`), then deletes the
  sealed token. The folder id is kept, so a reconnect through the same client finds the same folder and copies.

## 5. Encryption before upload

Unchanged SWXB v1 (section 1). Google, and anyone with access to the Google account, sees only ciphertext plus the file names
(`<archive stem>.zip.swxb`, which carry the backup time stamp and nothing else). **Losing the off-box keyring loses every Drive copy.**
The existing "export the key once" step is a precondition for relying on Drive, and the future screen must say so before the
switch is turned on.

## 6. Folder, names, uploads, retention, quota, failures

- **Folder**: one folder per installation in the root of the connected Drive, `folder_name` (default `SmplWise Arx backups`; editable;
  no quote, backslash or control character). Found by name among the app's own folders, else created. Its id is remembered in
  `backup.gdrive.state`. If the user trashes or deletes the folder, a new one is made. Recommendation for several sites on one Google
  account: include the site name in `folder_name` (the screen can suggest `SmplWise Arx – <site>`).
- **Object names**: those of the off-box pipeline (`OBJECT_RE`). Drive allows two files with the same name, so `put` deletes the
  older file(s) of that name after the new one landed, and `get` reads the newest.
- **Uploads**: multipart up to `simple_upload_max_mib` (default 5 MiB: the connection-test marker, small archives). Above that, a
  **resumable** upload in chunks of `chunk_mib` (default 8 MiB, always a multiple of 256 KiB). After a failed chunk (5xx, network),
  Arx backs off, asks the session how much it holds (`Content-Range: bytes */size`), and goes on from there. An expired session
  (404 / 410) restarts the upload once. The session URL is a capability and is never logged or returned.
- **Retention**: `RetentionPolicy` (default newest 3, 14 daily, 4 weekly, 6 monthly, as for S3 / SFTP), applied only after the new
  copy verified. `prune_mode`: `delete` (default: permanent, frees the space at once) or `trash` (Drive keeps it for 30 days.
  Trashed files still count against the quota, so this needs more headroom).
- **Quota**: before an archive upload Arx reads `about.storageQuota`. If free space < size + `quota_margin_pct` % (default 10) +
  `min_free_mib` (default 100), the upload is refused up front with `quota_exceeded`: nothing is uploaded and nothing is pruned. Drive's own
  `storageQuotaExceeded` maps to the same code and is not retried. An account that reports no limit skips the pre-flight.
- **Retries**: 429, 500/502/503/504 and the 403 rate-limit reasons back off exponentially (`retry_base_ms` 500, cap
  `retry_max_ms` 32 000, `max_retries` 5) with jitter. 401 refreshes the access token once. Everything else maps to a fixed code:
  `auth_failed`, `permission_denied`, `object_missing`, `remote_error`, `destination_unavailable`, `quota_exceeded`,
  `gdrive_reconnect_required` (refresh token revoked or expired), `gdrive_client_invalid`, `gdrive_not_connected`,
  `gdrive_disabled`. No code or message ever carries a token, a response body or a URL.
- **Timeouts**: `request_timeout_s` (default 60) per request, connect 20 s.

## 7. Restore drill, audit, permissions

- **Restore drill**: the existing monthly or manual drill can take `target_id` (an off-box target) today. For Drive the same function
  (`fetch_latest_copy`: newest copy, download, open with the keyring, then the drill restores into a scratch DB) is reused with the
  Drive destination. This is an open item: `POST /backups/drill` needs a `destination: "gdrive"` choice. Drill results go into the existing
  drill history.
- **Audit** (built): `backup.gdrive.settings_update` (the names of the changed fields, the switch, and client secret set or cleared; never
  values), `backup.gdrive.connect_start` (allowed / denied + code), `backup.gdrive.connect` (connected / denied),
  `backup.gdrive.test`, `backup.gdrive.disconnect` (whether a token was there, whether Google confirmed the revoke). The daily push
  should record its outcome in `backup.gdrive.state.last_push` (built in the runtime) and raise / resolve `backup.offbox_failed` with
  subject `offbox:gdrive` (open item).
- **Permissions**: every route needs `backup.manage` at installation scope (system administrators), the same as every other backup
  and off-box route. A site_admin or any scoped role gets 403 (tested). Recommendation for the integration: add
  `/api/v1/backups/gdrive/connect` and `/settings` to `remote_channel.BLOCKED_ON_REMOTE`, like the Secrets routes, so connecting an
  account or changing the client is done only on the local or Ingress channel (not done in the scaffold; owner decision 9.6).

## 8. Settings (all editable, OFF by default)

`PUT /api/v1/backups/gdrive/settings` replaces the whole configuration (strict schema, unknown fields refused, 422 on any invalid
value). `GET /api/v1/backups/gdrive` returns it with the connection state.

| Field | Default | Range / values |
|---|---|---|
| `enabled` | **false** | switch: connect / test / push are refused while off (`gdrive_disabled`) |
| `client_id` | "" | `<digits>-<id>.apps.googleusercontent.com` |
| `client_secret` (write-only) | not set | 1–4096 chars, "" clears |
| `folder_name` | `SmplWise Arx backups` | 1–100 chars, no `'`, `\`, control chars |
| `retention.keep_last / keep_daily / keep_weekly / keep_monthly` | 3 / 14 / 4 / 6 | 1–1000 / 0–1000 |
| `verify` | `deep` | `deep` \| `hash` (never none) |
| `prune_mode` | `delete` | `delete` \| `trash` |
| `chunk_mib` | 8 | 1–64 |
| `simple_upload_max_mib` | 5 | 1–5 |
| `max_retries` | 5 | 0–10 |
| `retry_base_ms` / `retry_max_ms` | 500 / 32000 | 50–60000 / 100–600000, max ≥ base |
| `request_timeout_s` | 60 | 5–600 |
| `quota_margin_pct` | 10 | 0–100 |
| `min_free_mib` | 100 | 0–1 000 000 |

A stored configuration that no longer validates (after a downgrade, say) fails **closed**: Arx uses the defaults, so the backup is
disabled.

## 9. What needs the owner (decisions before the TODO can be built)

1. **Who owns the Google Cloud project and the OAuth client.**
   (a) SmplWise owns one project, and its client id ships with the add-on. Customers see "SmplWise Arx" on the consent screen.
   SmplWise must keep the project, the brand verification and the API quota alive forever, because copies are bound to that client
   (section 3).
   (b) Each installer or customer creates their own project and pastes the client id / secret. Nothing is centralised, but setup
   is hard for a non-technical customer.
   Recommendation: (a), with (b) kept possible through the `client_id` setting.
2. **Client type**: "TVs and Limited Input devices" (device flow, recommended) or "Desktop" (fallback B).
3. **Consent screen**: user type External. Publishing status **In production**. In "Testing" status Google expires refresh tokens
   after **7 days** and limits use to 100 listed test users, so the daily backup would silently stop after a week. Needed: app name, support
   e-mail, privacy policy URL and home page (the existing legal pack may cover the privacy text), and the authorised domain.
   `drive.file` is non-sensitive, so brand verification is expected to be enough (no security assessment). To be confirmed in the
   Google console when the project is created.
4. **Google Workspace customers**: a Workspace admin can block third-party apps or unverified apps. Their IT may have to allow the
   client id.
5. **One Google account per installation** (the scaffold's model), or several Drive destinations (needs a migration: a `gdrive` kind in
   `backup_offbox_targets`, next free number below).
6. **Remote channel**: block connect/settings on the remote channel (recommended), or allow them.
7. Default `prune_mode` (`delete` recommended) and whether the screen offers `trash`.

## 10. Honest risks

- **Refresh tokens die silently**: revoked by the user, 6 months unused, the 7-day Testing-mode limit, a Workspace policy, or the
  per-client limit of 100 live refresh tokens per Google account (each reconnect issues one, and the oldest is revoked). Mitigation:
  `gdrive_reconnect_required` on the daily run, then the `backup.offbox_failed` alert to managers (to be wired), plus a "last
  verified copy" age in the status.
- **Client-bound visibility** (section 3): changing the Google Cloud project orphans the old copies for Arx.
- **Keyring loss = copy loss**: Drive holds ciphertext only. The export-once step is mandatory before turning Drive on.
- **Consumer storage is small**: 15 GB is shared with Gmail and Photos, so retention × archive size must fit. The pre-flight refuses
  the upload and never prunes to make room.
- **Rate limits / Google outages**: backoff, then a failed run and the alert. The next daily run tries again. Nothing is queued forever.
- **Shipping a client secret** in the add-on (option 9.1a): Google treats it as not confidential for these client types. Anyone can
  copy it, but it grants nothing without the user's consent. The blast radius is quota abuse on the SmplWise project.
- **Not verified against real Google**: every test runs against `tests/fake_gdrive.py`. Google's exact answers (error reasons,
  `Range` headers, 308 handling, device-flow scope list) must be checked once against a real test account when the owner
  provides the project. That is a separate, owner-approved task.

## 11. What the scaffold contains

| File | Content |
|---|---|
| `smplwise_vms/backend/smplwise/services/offbox_gdrive.py` | `GDriveDestination` (Drive v3 over an injected `httpx.Client`), `RefreshTokenSource`, `RetryPolicy`, `OAuthFlow` + `NotImplementedFlow` (TODO), `revoke` |
| `smplwise_vms/backend/smplwise/services/gdrive_runtime.py` | settings schema `GDriveSettingsIn` + load/save (fail closed), state, sealed secrets in `app_secrets`, `run_check`, `run_push` (the shared `push()`), connect start/poll around the interface, revoke + disconnect; seams `HTTP_TRANSPORT`, `OAUTH_FLOW`, `SLEEP` |
| `smplwise_vms/backend/smplwise/routers/backup_gdrive.py` | `GET /backups/gdrive`, `PUT /backups/gdrive/settings`, `POST /backups/gdrive/connect/start` + `/connect/poll` (501 until the flow exists), `POST /backups/gdrive/disconnect` (`confirm: DISCONNECT`), `POST /backups/gdrive/test` |
| `smplwise_vms/backend/smplwise/services/backup.py` | `backup.gdrive.` added to `SETTINGS_KEEP_PREFIXES` |
| `smplwise_vms/backend/smplwise/main.py` | router included before `/backups/{name}` |
| `smplwise_vms/backend/tests/fake_gdrive.py` | the fake Drive + token endpoint (MockTransport; foreign hosts recorded) |
| `smplwise_vms/backend/tests/test_offbox_gdrive.py`, `test_gdrive_api.py` | unit and API tests |

**No migration.** The settings table and the existing `app_secrets` table (no CHECK on `name`) hold everything. A migration is needed
only for decision 9.5 (several Drive destinations as `backup_offbox_targets` rows: the `kind` CHECK lists `s3, sftp, local`). The next
free number on `release/2200` at the time of writing is **0178** (the last is `0177_announce_stage_a.sql`). Re-check at integration.

## 12. Open items (next tasks)

1. `TODO(GDRIVEBK-OAUTH)`: the device-flow `OAuthFlow` (after section 9), then one owner-supervised run against a real test account.
2. Wire the daily push (`offbox_runtime.after_backup`) for an enabled and connected Drive, and the `backup.offbox_failed` alert with
   subject `offbox:gdrive`.
3. `POST /backups/drill` with the Drive as a source (`fetch_latest_copy` with the Drive destination).
4. `POST /backups/gdrive/push` (manual push and dry run), like the off-box target routes.
5. The screen (Settings › Diagnostics › Backup and restore › Off-box copies), including the key-export precondition and the
   user_code display.
6. `remote_channel.BLOCKED_ON_REMOTE` entries (decision 9.6). `contracts/API_INVENTORY.md` is regenerated by the release
   (`scripts/api_inventory.py`).
