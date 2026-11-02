# First Google Drive connection for off-box backups - step by step

Hebrew version (the owner's copy): `GDRIVE_CONNECT_SETUP_HE.md`. Earlier short guide: `GDRIVE_BACKUP_SETUP.md`.
Design: `docs/design/GDRIVE_BACKUP.md`. Change: `docs/changes/GDRIVE-READY-2351.md`.

Time: 15-20 minutes, once. You need a browser, the Google account that will hold the copies, and system-administrator access to Arx.

Arx creates nothing in Google for you. You create a small (free) Google Cloud project; Arx needs only its **Client ID** and **Client
secret**. The only scope requested is `drive.file`: Arx sees the folder and files it created, nothing else in the Drive.

Screen names below are the English names of Google Cloud Console (2026 layout, "Google Auth Platform").

## Part A - Google Cloud Console

1. **Project.** https://console.cloud.google.com › project picker › **New project** › Project name `SmplWise Arx backup` › **Create**.
   Make sure it is selected. Keep the project as long as the copies are kept.
2. **Drive API.** ☰ › **APIs & Services** › **Library** › `Google Drive API` › **Enable**. (The most common first-try miss; the
   connection check says "Google Drive API is not enabled in the project".)
3. **Consent screen.** ☰ › **Google Auth Platform** (APIs & Services › OAuth consent screen leads there) › **Get started** ›
   App Information (App name `SmplWise Arx`, User support email) › Audience **External** (Internal only works inside a Workspace
   organisation; a Gmail account then fails with `org_internal`) › Contact Information › Finish (accept the User Data Policy) ›
   **Create**. Do not upload a logo (it triggers brand verification).
4. **Scope.** Google Auth Platform › **Data Access** › **Add or remove scopes** › filter `drive.file` › tick `.../auth/drive.file` ›
   **Update** › **Save**. Nothing else.
5. **Test user.** Google Auth Platform › **Audience**: Publishing status stays **Testing** for the first try › **Test users** ›
   **Add users** › the backup account › **Save**. Without it Google shows "Access blocked" and Arx reports "denied".
   While the status is Testing, Google revokes the grant **7 days** after approval - see step 9.
6. **Client.** Google Auth Platform › **Clients** › **Create client** › Application type **TVs and Limited Input devices** (not Web
   application, not Desktop app) › Name `SmplWise Arx` › **Create** › copy **Client ID** and **Client secret** from the "OAuth client
   created" dialog. The secret is shown only now; later use Clients › the client › **Add secret**.
   There is **no redirect URI**: Arx uses the device flow (a short code approved at google.com/device). A screen asking for
   redirect URIs means the wrong client type.

## Part B - Arx (Settings › Diagnostics › Backup and restore › Off-box copies)

7. **Key first.** Export the encryption key once (`EXPORT`) and keep it outside the system. Drive holds only the sealed copy.
8. **Target, check, connect.**
   1. **Add Google Drive** › paste Client ID (`….apps.googleusercontent.com`) and Client secret (`GOCSPX-…`, the value only - no
      spaces, no quotes, not the JSON file) › keep the folder name › **Save** (the target is saved OFF - expected).
   2. **Check Google connection** ("בדיקת חיבור Google"). Expected: "Google settings are fine. Next: connect the Google account."
      It writes nothing and creates nothing in Drive.
   3. **Connect Google account** › on a phone or computer open https://www.google.com/device › type the code › pick the test-user
      account › "Google hasn't verified this app" › **Continue** (expected in Testing) › keep the Drive-files permission ticked ›
      **Continue/Allow**. Arx shows "Account connected" within seconds.
   4. **Check Google connection** again: every row green, the Drive API row names the account.
   5. Switch the target on › **Test** (marker written, read, deleted) › **Push now**. In drive.google.com the folder
      `SmplWise Arx backups` holds a `*.zip.swxb` file. Optionally run the restore drill from the Drive copy.
9. **Leave Testing (strongly recommended).** Google Auth Platform › **Audience** › **Publish app** › **Confirm** (status
   **In production**; `drive.file` without a logo needs no Google verification). Then **Reconnect** once in Arx (a grant made in
   Testing still expires after 7 days). If skipped, the daily push fails after 7 days with "connection expired or revoked" and the
   connection check names the Testing status as the cause.

## What the connection check reports

| Check (id) | Failure means | Fix |
|---|---|---|
| `client_id` | no client id saved | step 6, then edit the target |
| `client_secret` | missing; a client id pasted as the secret; spaces / quotes / JSON | paste the `GOCSPX-…` value only |
| `network` | no route to oauth2.googleapis.com; TLS failure (almost always a wrong clock) | outbound HTTPS / DNS; fix the host clock |
| `clock` | the host clock is > 5 min off Google's `Date` (warn > 60 s) | NTP on the host |
| `client` | wrong client type (Web / Desktop - "no redirect URI is used"), unknown / deleted client, consent screen or scope not configured | steps 3, 4, 6 |
| `secret_match` | the secret does not belong to the client (probe: Google answers `invalid_client` instead of `invalid_grant`) | Clients › Add secret |
| `account` | not connected (skip); waiting for approval (info: test-user / org_internal hints); revoked - after ~7 days: the Testing status; earlier: removed at myaccount / password change; a grant without drive.file | step 5 / 9 / reconnect |
| `consent_mode` | info only: the date a Testing grant would expire | step 9 |
| `drive_api` | Drive API not enabled (`accessNotConfigured` / `SERVICE_DISABLED`); token without drive.file | step 2 / reconnect |
| `quota` | free space below the target's minimum (warn under 5x) | free space in Drive or lower the minimum |
| `folder` | info: not created yet (created by the test or the first push) | none |

Read-only by design: two requests reach Google before an account is connected (a device-code request that is discarded unused - it
tells the client type, consent screen and scope apart - and a token request with a refresh token that cannot exist, which tells a
matching secret from a wrong one). No folder is created, nothing is stored, no token or secret is in the answer; the account e-mail is
shown on the screen only, never audited.

## Things to know
- The folder is found by name: moving it inside Drive is fine, renaming it makes the next run create a new one. A folder you created
  yourself with the same name is never used (`drive.file` shows only what Arx created). A new Google project or client cannot see the
  old folder; the old copies stay in Drive.
- **Disconnect** revokes at Google, deletes the token and switches the target off; copies stay in Drive. Google side:
  myaccount.google.com › Security › Your connections to third-party apps & services.
- Secrets (client secret, refresh token) are sealed with the installation key, never shown, logged or put in a project backup.

## Dry run without Google
`python scripts/gdrive_connect_dry_run.py` runs this whole flow against the fake Google (tests/fake_gdrive.py) and prints what the
connection check says at every step, including the two common mistakes and the seven-day Testing expiry.
