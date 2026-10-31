# Data-store hardening (DATASTORE-295)

Status: implemented on `pilot/DATASTORE-295` - phase 1 (restore drill, off-box interface, storage-boundary report) and phase 2
(owner decision 2026-10-20: off-box targets = S3-compatible AND SFTP; real transports, settings screen, push after the daily backup
with retention and verify-after-upload and a failure alert, key export / rotation, the drill of the encrypted copy). Migration
`0132_backup_offbox.sql` is PROVISIONAL (the lead renumbers at integration; integ/293 ends at 0127).

Context: the owner decided (2026-10-01) to keep SQLite until the ticketing system's data needs are specified, and to spend the
effort on proving backups instead: a restore drill, an off-box copy, and a storage layer that keeps a later engine split possible.

## 1. Restore drill

Code: `smplwise_vms/backend/smplwise/services/backup_drill.py`; entry points `python -m smplwise.services.backup_drill` (inside the
add-on) and `scripts/backup_restore_drill.py` (from a checkout). Tests: `tests/test_backup_drill.py`, `tests/test_offbox_api.py`.

What it does:

1. Picks the newest archive whose manifest reads (`backups/`), or the one named - or (phase 2) the newest encrypted copy at an
   off-box target, downloaded and decrypted with the keyring (`run_offbox_drill`; checks `offbox_fetch`, `offbox_decrypt`).
2. Checks the archive: manifest, every member's CRC (`ZipFile.testzip`), schema not newer than this build, no settings row a restore
   must never take (`backup.SETTINGS_KEEP` / `SETTINGS_KEEP_PREFIXES`), and enough free disk (2x the uncompressed size + 64 MB).
3. Creates `<data>/backup_drill/scratch-<stamp>-<pid>/`, migrates an empty database there with this build's migrations.
4. Restores with the administrator's own code path: `backup.restore(mode="replace", scope="project+access", skip_sensitive=True,
   process_hooks=False)`. `process_hooks=False` is the only difference: the capture-lease revocation, the lease stream reset and the
   permission-revision hooks are process-wide and must not fire for a database the live process does not use (a drill would
   otherwise revoke every live capture lease).
5. Verifies: `PRAGMA integrity_check` = ok and `PRAGMA foreign_key_check` empty (main database and, when restored, `energy.db`);
   every migration of this build recorded; per table of the manifest, restored rows = archive rows - rows the restore dropped as
   unsafe (`notify_settings` may gain its one default row); the scratch database's values of the never-restored settings are the
   same before and after the restore. Restored files vs the manifest's file count is a warning, not a failure.
6. Removes the scratch (and downloaded) copies, writes `backup_drill/last.json` (local) or `last_offbox.json` (off-box) and a
   12-entry `history.json`; an off-box drill is also a `drill` run of its target.

Not checked: the encrypted SENSITIVE section of an archive (local password hashes, HMAC keys) - the drill never holds the backup
password, and Arx does not store it (BACKUP-HASH-ENC). The result says `sensitive_checked: false` for such an archive. The off-box
copy itself is checked end to end because its key IS held by the installation (the keyring below).

API (`backup.manage` at installation scope, i.e. system administrators only):

| Method | Path | Effect |
|---|---|---|
| GET | `/api/v1/backups/drill` | `{running, last, last_offbox, history, schedule: {monthly, next_due_at, due_now}}` |
| POST | `/api/v1/backups/drill` `{name?, target_id?}` | starts a drill on a thread, `202`; `409 drill_running`; audited `backup.drill.run` |
| PUT | `/api/v1/backups/drill/schedule` `{monthly}` | switches the monthly run; audited `backup.drill.schedule` |

Schedule: `backup.drill.monthly` (`true` / anything else = off). Default OFF. The loop checks every 6 hours and runs when the last
local drill finished 30+ days ago (or never ran); after the local drill it drills the newest copy of every ENABLED off-box target
when the keyring holds a key. The key is in `SETTINGS_KEEP`: never exported, never restored.

## 2. Off-box copies

GDRIVEBK-2310 adds a third transport, Google Drive (target kind `gdrive`, `services/offbox_gdrive.py` + `offbox_gdrive_connect.py`,
migration 0186): see `docs/design/GDRIVE_BACKUP.md` and the owner's setup `docs/operations/GDRIVE_BACKUP_SETUP.md`.

Code: `services/backup_offbox.py` (interface, SWXB encryption, retention, push, connection check), `services/offbox_s3.py`,
`services/offbox_sftp.py`, `services/offbox_keys.py`, `services/offbox_store.py` (all SQL of the three tables), `services/offbox_runtime.py`
(orchestration, alert), `routers/backup_offbox.py`. UI: `frontend/src/components/sw-offbox-backup.ts` in Settings › אבחון › גיבוי ושחזור.
Tests: `tests/test_backup_offbox.py`, `test_offbox_s3.py`, `test_offbox_sftp.py`, `test_offbox_api.py`; `frontend/tests/unit-backup-offbox.spec.ts`,
`offbox-backup-ui.spec.ts`.

### Targets and transports

| Kind | Transport | Rules |
|---|---|---|
| `s3` | `offbox_s3.SigV4Client`: AWS Signature V4 over httpx (no SDK); PutObject / GetObject / ListObjectsV2 / DeleteObject | https only, TLS verified; `path_style` (R2, MinIO) or virtual-host; region `auto` for R2; every payload signed with its real SHA-256; uploads streamed with Content-Length; errors -> `auth_failed`, `bucket_missing`, `object_missing`, `destination_unavailable`, `remote_error` |
| `sftp` | `offbox_sftp.connect`: paramiko 4.0.0 (`requirements.txt`; musllinux wheels for x86_64 and aarch64 checked) | the server's host key is PINNED (`ssh-ed25519 AAAA...` line or `SHA256:` fingerprint) and compared before authentication (`host_key_mismatch`); key authentication only (no password, no agent, no ~/.ssh); upload to `.name.partial` + posix-rename |
| `local` | a mounted share / USB disk | API only (not offered in the screen); refused inside the data directory |

`build_destination` refuses unknown configuration fields, and every credential field must be a reference.

### Credentials

Typed once in the screen (write-only fields), sent as SecretStr, sealed at once with the installation key
(`connection_store.seal_app_secret`, name `offbox_<target>_<field>`) into `backup_offbox_secrets`; the target's `config_json` holds
only `store:offbox.<target>.<field>` references. They are resolved only inside the transport at connect time
(`offbox_store.secret_lookup`) and never returned by the API (it answers `secrets: {field: true|false}`), logged, audited (audit rows
name the changed fields only) or written to a project archive (the tables are not backup tables). `env:NAME` / `file:/path`
references remain possible for a developer run.

### Encryption at rest (SWXB v1) and the keyring

`MAGIC "SWXB\x01" | u32 header length | header JSON | records (u32 length | AES-256-GCM ciphertext)`; 1 MiB records; nonce =
7-byte random prefix | final flag | u32 counter; AAD = SHA-256 of the header. Truncation, reordering, an appended record and a header
edit all fail; a missing key is named (`key_mismatch`).

Keyring `<data>/keys/offbox_keyring.json` (mode 0600; `keys/` never enters an archive and is never restorable):

- the first push creates the first key; new copies use the ACTIVE key; `open_file` picks any ring key by the header's key id;
- **export**: each key can be shown to a system administrator ONCE, after typing `EXPORT`; the answer is the only place the key ever
  appears (`SWXB-KEY-1:<id>:<base64>`); the audit row names the key id only; a second export is `key_already_exported`;
- **rotation** (typing `ROTATE`): a fresh active key; older keys stay, so older copies (and their retention deletes) keep working;
- **import**: an exported key is added on a new installation after a disaster (it becomes active only on an empty ring);
- phase 1's single key file (`offbox_backup.key`) is imported into the ring once.

### Push, verify, retention

`push(archive, dest, key, policy, dry_run, verify="deep")`: list -> plan (upload + retention) -> (dry run stops here) -> seal ->
upload -> download again -> SHA-256 of the ciphertext equals what was sent -> (deep) decrypt and compare the archive's SHA-256 ->
only then delete what the retention plan says. A failed or unverified upload never prunes; an uploaded copy that does not verify is
removed. `RetentionPolicy(keep_last, keep_daily, keep_weekly, keep_monthly)` per target (default 3/14/4/6: the newest 3, 14 daily, 4 weekly, 6 monthly; owner decision 2026-10-21 - 14 daily + 4 weekly, every value configurable); names this module did not
write are never deleted.

Connection test (`check_connection`): writes `arx-test-<16 hex>.txt`, reads it back, compares, deletes it, lists. Markers are never
listed or pruned.

### When it runs

- After every daily backup (`backup.daily_loop` -> `offbox_runtime.after_backup`): every ENABLED target, one at a time.
- "Upload now" (202, on a thread), "dry run" (answered at once), "test connection" in the screen.
- No SQLite write lock is held across a transfer: the request commits first (`db.release`), the runtime reads the target, transfers
  with no transaction open, then writes the run row (`write_aside`).

### Alert

`backup.offbox_failed` (notify_policy.SOURCES; managers, inbox + email, no push): one row per target (`offbox:<target id>`), raised
when the daily push fails or does not verify, resolved by that target's next verified push (daily or manual). Its text names the
target and a short reason - never a host, an endpoint or a credential. The frontend's static notification catalogue
(`api/notifications.ts`) does not list it yet (that list is a curated subset with spec-pinned counts); the row still shows with its
server title.

### Open items

- The settings screen offers S3 and SFTP; the `local` kind is API-only.
- The frontend notification catalogue entry for `backup.offbox_failed` (and the matrix row) - a small follow-up with the spec counts.
- A full-suite run after integration (the gate venv needs `paramiko` (5.1.0 since DEPFIX-2310) from requirements.txt; `tests/test_offbox_sftp.py` is
  skipped where paramiko is missing).
- Native review of the Arabic and Russian words (`i18n/backup-offbox.ts`, dev-marked).

## 3. Storage-layer boundary

Scanner: `scripts/sql_boundary_report.py` (static, ast). Report and proposed order: `docs/architecture/STORAGE_LAYER_BOUNDARY_REPORT.md`.
Phase 2 keeps its own SQL in a store module (`services/offbox_store.py`).
