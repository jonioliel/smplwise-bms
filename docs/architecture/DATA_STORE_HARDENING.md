# Data-store hardening (DATASTORE-295)

Status: implemented on `pilot/DATASTORE-295` (restore drill, off-box interface with local-path and fake destinations, SFTP / S3
adapters with stub transports, storage-boundary scanner and report). No migration. Not yet wired into the UI.

Context: the owner decided (2026-10-01) to keep SQLite until the ticketing system's data needs are specified, and to spend the
effort on proving backups instead: a restore drill, an off-box copy, and a storage layer that keeps a later engine split possible.

## 1. Restore drill

Code: `smplwise_vms/backend/smplwise/services/backup_drill.py`; entry points `python -m smplwise.services.backup_drill` (inside the
add-on) and `scripts/backup_restore_drill.py` (from a checkout). Tests: `tests/test_backup_drill.py`.

What it does:

1. Picks the newest archive whose manifest reads (`backups/`), or the one named.
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
   same before and after the restore. Restored files vs the manifest's file count is a warning, not a failure (a background picture
   that fails the re-encode is rejected on purpose).
6. Removes the scratch directory (`--keep-scratch` leaves it), writes `backup_drill/last.json` and a 12-entry `history.json`.

Not checked: the encrypted sensitive section (local password hashes, HMAC keys) - the drill never holds the backup password. The
result says `sensitive_checked: false` for such an archive.

API (`backup.manage` at installation scope, i.e. system administrators only):

| Method | Path | Effect |
|---|---|---|
| GET | `/api/v1/backups/drill` | `{running, last, history, schedule: {monthly, next_due_at, due_now}}` |
| POST | `/api/v1/backups/drill` `{name?}` | starts a drill on a thread, `202`; `409 drill_running` while one runs; audited `backup.drill.run` |
| PUT | `/api/v1/backups/drill/schedule` `{monthly}` | switches the monthly run; audited `backup.drill.schedule` |

Schedule: `backup.drill.monthly` (`true` / anything else = off). Default OFF. The loop (`monthly_loop`, started next to the daily
backup loop) checks every 6 hours and runs when the last drill finished 30+ days ago (or never ran). The key is in
`SETTINGS_KEEP`: never exported, never restored.

Load: a drill reads the whole archive and writes a scratch database of about the same size; on the add-on it runs at the
same priority as the daily backup. That is why the schedule is off by default.

## 2. Off-box copies

Code: `smplwise_vms/backend/smplwise/services/backup_offbox.py`. Tests: `tests/test_backup_offbox.py`.

### Interface

```
Destination: kind; describe() -> dict (safe to show); put(src, name); get(name, dest); list() -> [RemoteObject]; delete(name)
```

| Destination | State | Notes |
|---|---|---|
| `LocalPathDestination(root, data_dir=)` | complete | a mounted share / USB disk; refuses a folder inside the data directory; atomic write (temporary name, fsync, rename) |
| `FakeDestination` | complete | in memory; knobs `fail_put/get/list`, `corrupt_put`, `truncate_put` |
| `SftpDestination` | adapter complete, transport stub | key authentication + pinned host key (`known_hosts` reference), never a password, never trust-on-first-use; upload to `.name.partial` then `posix_rename` |
| `S3Destination` | adapter complete, transport stub | https endpoint only, any S3-compatible service, follows list continuation tokens |

The SFTP / S3 adapters take a `client_factory`; the tests use fake clients with the same method names as paramiko's `SFTPClient` and
boto3's S3 client. Without a factory, `connect()` raises `transport_not_available`. Adding the real transport is one factory each
plus the dependency pin (paramiko / boto3 or a smaller S3 client) and a container size check.

`build_destination(cfg)` builds one from a plain dict and refuses unknown fields (no `password` field can creep in).

### Credentials

Never stored in the repository, the database, a log line, an audit row or a result. A destination's configuration holds a reference:
`env:NAME` or `file:/absolute/path` (`CredentialRef`). It is resolved only inside the transport factory, at connect time.
`describe()` and `repr()` print the reference. A value that is not a reference is refused without echoing it (a pasted secret).
On the add-on, the natural home for the values is the existing secrets store (services/secrets_store.py) exposed to the transport
as a file under `/data/secrets/` or an environment variable - a wiring step, not part of this slice.

### Encryption at rest (SWXB v1)

`MAGIC "SWXB\x01" | u32 header length | header JSON | records (u32 length | AES-256-GCM ciphertext)`.

- Key: 32 random bytes, base64, in `<data>/keys/offbox_backup.key` (mode 0600) by default, or a path the administrator chooses.
  The `keys/` folder never enters a project archive (`backup._rel`), so the key never travels with the copy it protects.
- 1 MiB records; nonce = 7-byte random prefix | final flag | u32 counter; AAD = SHA-256 of the header. A truncated file, reordered or
  edited records, an appended record and a header edit all fail; a wrong key is named (`key_mismatch`, via the header's key id).
- Losing the key loses every off-box copy. The owner keeps a copy of the key outside the machine (password manager or paper). An
  "export key" screen for system administrators is an open item.

### Push

`push(archive, dest, key, policy=, dry_run=, verify="deep"|"hash")`:

1. `list()` the destination; plan the upload and the retention (`RetentionPolicy.plan`).
2. `dry_run`: return the plan; nothing is sealed, uploaded or deleted.
3. Seal into a temporary folder, `put()`.
4. Verify after upload: `get()` the object back; its SHA-256 must equal what was sent (`hash`); `deep` also decrypts it and compares
   the archive's SHA-256.
5. Only after a verified upload: delete what the plan says. A failed or unverified upload never prunes; an uploaded copy that does
   not verify is removed (`bad_copy_removed`).

`verify="none"` is refused. Every outcome is a dict with `ok`, `error` (code), `timings_ms`; destination problems never raise.

### Retention

`RetentionPolicy(keep_last=3, keep_daily=7, keep_weekly=4, keep_monthly=6)`: the newest `keep_last` objects plus the newest object
of each of the last D days, W ISO weeks and M months. Names without a time stamp this module wrote (`*-YYYYMMDD-HHMMSS*.zip.swxb`)
are `unmanaged` and never deleted, so one bucket can be shared with other data.

### Not in this slice (open items)

- Wiring: settings screen for a destination (kind, path / host / bucket, credential references), the push after each `auto-daily`
  backup, the status of the last push next to the drill status, a notification when a push fails.
- Real SFTP / S3 transports and their dependency review.
- Key export / rotation (rotation = re-seal the retained objects under the new key, then retire the old one).
- A drill that runs against an off-box copy (get -> open -> the restore drill above).

## 3. Storage-layer boundary

Scanner: `scripts/sql_boundary_report.py` (static, ast). Report and proposed order: `docs/architecture/STORAGE_LAYER_BOUNDARY_REPORT.md`.
