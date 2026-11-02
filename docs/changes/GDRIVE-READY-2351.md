# GDRIVE-READY-2351 - Google Drive: ready for the owner's first real connection

Branch `pilot/GDRIVE-READY-2351` from `origin/release/2350-train`. No version bump, no migration, no new setting.
Builds on GDRIVEBK-2310 (`docs/design/GDRIVE_BACKUP.md`). No test reached Google: everything runs against `tests/fake_gdrive.py`
(an `httpx.MockTransport`; a request to any other host fails the test).

## 1. Review of the connect flow (what was checked)

| Area | Finding |
|---|---|
| OAuth client setup | Device authorization grant ("TVs and Limited Input devices" client). No redirect URI and no paste-back exist - correct for an add-on behind Ingress; documented explicitly because "wrong redirect" is the usual first-try confusion. |
| Token storage | Client secret and refresh token sealed with the installation key (`backup_offbox_secrets`); the device code stays in process memory; the access token is memory-only. Unchanged, re-verified by the new tests (no value in any answer, audit row or run row). |
| Scopes | `drive.file` only, enforced at start and at the grant. Gap fixed: a grant WITHOUT drive.file (granular consent, box unticked) was refused but the token Google issued was left valid - it is now revoked at once. |
| Refresh / expiry / revocation | `invalid_grant` -> `gdrive_reconnect_required` (unchanged). Added: the connection check names the seven-day expiry of a consent screen left in "Testing" when the grant is about seven days old. |
| Client errors | Bug: every client refusal collapsed into `gdrive_client_invalid` ("check the id and secret"), and `restricted_client` was reported as a scope refusal. Now: `gdrive_client_type` (Web / Desktop client - Google's "Invalid client type"), `gdrive_client_not_found` (deleted / unknown client), `gdrive_consent_not_configured` (`restricted_client`), `gdrive_client_invalid` (wrong secret). |
| Drive API errors | Bug: "Google Drive API has not been used in project ... or it is disabled" (403 `accessNotConfigured` / `SERVICE_DISABLED`) surfaced as `permission_denied` - "no write permission at the target", which sends the owner to the wrong place. Now `gdrive_api_disabled`. A token without the scope (403 `insufficientPermissions`) is `gdrive_scope_refused`; the project's daily quota (`dailyLimitExceeded`) is `rate_limited` without pointless retries. Reasons are now read from `errors[].reason`, `status` and the ErrorInfo `details[].reason`. |
| Consent denial | `admin_policy_enforced` and `org_internal` end the poll as `denied` (were `auth_failed`); the dialog explains the missing test user. |
| Quota / rate limits | Unchanged (pre-flight `about.storageQuota`, `storageQuotaExceeded`, bounded backoff); covered again. |
| Folder selection | `drive.file` can only see what Arx created, so the folder is chosen by name and found again by name each run. Docstring corrected (it claimed the id was persisted in settings). Documented: moving the folder is fine, renaming creates a new one, a new client cannot see the old folder. |
| Upload / backup / export targets | Unchanged pipeline (seal -> resumable upload -> read back -> verify -> retention); exercised end to end by the dry run (push, copies list, restore drill). |

## 2. "בדיקת חיבור Google" (connection check)

`POST /api/v1/backups/offbox/targets/{id}/gdrive/diagnose` (`backup.manage`, installation scope; audited as
`backup.offbox.gdrive_diagnose` with the failed check ids only). Service: `smplwise/services/offbox_gdrive_diagnose.py`.
Answer `{ok, connected, ready_to_connect, checks: [{id, status, title, message, fix?}], summary}`; status `ok | fail | warn | info |
skip`; all texts Hebrew, with the exact Google Cloud Console screen path in `fix`.

Checks: `client_id`, `client_secret` (missing; a client id pasted as the secret; spaces / quotes / JSON), `network` (TLS failure ->
clock hint), `clock` (Google's `Date` header vs the wall clock: fail > 5 min, warn > 60 s), `client` (one device-code request: type,
deleted / unknown client, consent screen, scope; the device code is dropped unused), `secret_match` (before connecting: a refresh grant
with a token that cannot exist - `invalid_grant` = secret matches, `invalid_client` = it does not), `account` (not connected / waiting
for approval with the test-user and `org_internal` hints / revoked with the Testing diagnosis / granted without drive.file),
`consent_mode` (info: the date a Testing grant would expire), `drive_api` (API disabled; shows the connected account's e-mail on screen
only), `quota`, `folder` (looked up, never created).

Read-only: nothing is written to the database or created in Drive; no secret, token or device code in the answer.

UI (`sw-offbox-backup`): a "בדיקת חיבור Google" button on every Google Drive target opens a dialog with one badge per step, the message
and "מה לעשות" for anything not OK, and "בדיקה חוזרת". The consent dialog now carries the "Access blocked -> test users" hint; the
"denied" text names the test-user list. New error words for the four new codes in he / en / ar / ru.

## 3. The owner's guide

`docs/operations/GDRIVE_CONNECT_SETUP_HE.md` (Hebrew, the owner's copy) and `docs/operations/GDRIVE_CONNECT_SETUP.md`: Google Cloud
project, Drive API, Google Auth Platform (Get started / Audience External / Data Access drive.file / Test users), client type TVs and
Limited Input devices (no redirect URI; the secret is shown once), what to paste into Arx, the check, connect, verify in drive.google.com,
and leaving Testing (Publish app) with a reconnect. Troubleshooting table keyed on what the check says. The two older guides point to it.

Contradiction recorded (not silently resolved): the earlier `GDRIVE_BACKUP_SETUP*.md` tell the owner to set the consent screen to
"In production" at once; this task asked for Testing + the owner as test user. The new guide follows the task for the first try and
then recommends Publish app + one reconnect, because a grant made in Testing is revoked by Google after 7 days (drive.file is a
non-sensitive scope, so publishing needs no Google verification).

## 4. Dry run

`tests/gdrive_dry_run.py` walks the guide against the fake Google through the HTTP API: key export, a Web-application client by mistake
(named, connect refused with `gdrive_client_type`), the right client (ready to connect), device-flow connect, the Drive API disabled
(named by the check and by the connection test), all green, switch on, connection test, first push (sealed copy verified), copies list,
restore drill PASS, eight days later the Testing revocation (named), reconnect, all green. `scripts/gdrive_connect_dry_run.py` runs it and
prints the Hebrew transcript.

The fake learned Google's real answers for these cases: `client_kind`, `client_deleted`, `consent_configured`, `api_disabled`,
`date_skew_s` (every answer carries a `Date` header), `refresh_scope`, `account_email`, `test_user`; unknown client ->
"The OAuth client was not found.", wrong secret -> "Unauthorized". Two expectations in `test_offbox_gdrive.py` moved from
`gdrive_client_invalid` to `gdrive_client_not_found` accordingly (an unknown client id is now named as such).

## Tests

- Backend, single process: `test_gdrive_connect_ready.py` (13, new), `test_gdrive_api.py`, `test_offbox_gdrive.py`,
  `test_backup_offbox.py`, `test_offbox_api.py`, `test_offbox_restore.py`, `test_offbox_s3.py`, `test_offbox_sftp.py` - 91 passed,
  1 skipped (sftp: paramiko not installed locally). Route guards `test_capabilities.py`, `test_secfix2_pub07_guard_first.py`,
  `test_plan_routes_unique.py` - 39 passed.
- `scripts/gdrive_connect_dry_run.py` - exit 0.
- Frontend: `npx tsc --noEmit -p .` PASS; unit specs (`--workers=1`) `unit-backup-gdrive` (+1 test), `unit-backup-offbox`,
  `unit-backup-offbox-restore` and the gating lints `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, `unit-menu-lint`,
  `unit-empty-state-icons` - 58 passed.
- Runner (`run_smart.py preview pilot/GDRIVE-READY-2351 tests/offbox-backup-ui.spec.ts --workers=1`): 24 passed (desktop, tablet,
  mobile). That spec does not open the new check dialog.
- NOT_RUN: a browser spec / pixel baseline for the new "בדיקת חיבור Google" dialog. `contracts/API_INVENTORY.md` is regenerated at
  release (`scripts/api_inventory.py`).

## Left for the owner

- The real first connection (this week), following `GDRIVE_CONNECT_SETUP_HE.md`; press "בדיקת חיבור Google" before and after connecting.
- After it works: Publish app + reconnect once (section 9 of the guide), or the daily push stops after 7 days.
