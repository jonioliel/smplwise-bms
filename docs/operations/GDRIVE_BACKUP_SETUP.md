# Google Drive off-box backup: the owner's setup (GDRIVEBK-2310)

Hebrew short version: `GDRIVE_BACKUP_SETUP_HE.md`. Design: `docs/design/GDRIVE_BACKUP.md`.

Arx never creates a Google Cloud project, an OAuth client or a login for you. You do steps 1-5 once in your own Google account; Arx
then only stores what you paste (sealed) and asks Google for a token when you approve a short code.

Google renames console menus from time to time; the names below were current when this was written. If a menu differs, look for the
same item under "Google Auth Platform" or "APIs & Services".

## A. In the Google Cloud console (once)

1. Open https://console.cloud.google.com and sign in. Any Google account you control may own the project; the copies go to the Drive of
   the account that approves the code in step B3.
2. **Create a project** (project picker > New project), for example `SmplWise Arx backup`. Keep this project for as long as you keep the
   backups: copies uploaded through its client are visible to Arx only through that same client.
3. **Enable the Google Drive API**: APIs & Services > Library > "Google Drive API" > Enable.
4. **Consent screen** (Google Auth Platform > Branding / Audience / Data access, older consoles: "OAuth consent screen"):
   - User type: **External** (or Internal for a Google Workspace domain).
   - App name (for example `SmplWise Arx backup`), user support e-mail, developer contact e-mail.
   - Data access / scopes: add only `https://www.googleapis.com/auth/drive.file` ("See, edit, create, and delete only the specific
     Google Drive files you use with this app"). Nothing broader.
   - Audience / publishing status: **In production**. In "Testing" Google expires the refresh token after 7 days and the daily copy
     stops. `drive.file` is a non-sensitive scope; Google may still show an "unverified app" notice to you during approval
     (Advanced > continue) - that is expected for a private client.
5. **Create the OAuth client**: Clients (or Credentials > Create credentials > OAuth client ID) > Application type
   **"TVs and Limited Input devices"** > name it > Create. Copy the **Client ID** (`…apps.googleusercontent.com`) and the
   **Client secret** (`GOCSPX-…`). Do not paste them into e-mail, chat or tickets.

A Google Workspace domain may block third-party apps: the Workspace admin then allows this client id (Admin console > Security > API
controls).

## B. In Arx (Settings > Diagnostics > Backup and restore > Off-box copies)

1. If the encryption key was never exported: **Export the key** first and store it outside the system. Drive holds only encrypted
   copies; without the key they cannot be opened.
2. **Add Google Drive** > paste the Client ID and the Client secret > (optional) change the folder name, for example
   `SmplWise Arx - <site>` when several sites share one Google account > Save. The target is saved **off**.
3. **Connect Google account**: the dialog shows a short code. On any phone or computer open https://www.google.com/device, type the
   code, sign in with the Google account whose Drive should hold the copies, and allow access. The dialog says "Account connected".
4. Switch the target **on**, press **Test connection** (a small file is written, read back and deleted), then **Upload now** or wait
   for the daily backup. The folder appears in that account's Drive root.

Disconnect: "Disconnect account" revokes the grant at Google, deletes the stored token and switches the target off. The copies stay in
Drive. You can also revoke at https://myaccount.google.com > Security > Your connections to third-party apps; Arx then reports
"connect again" on the next run.

## How Arx stores and reads the client id / secret

- **Client ID**: not a secret. Kept in the target's configuration (`backup_offbox_targets.config_json`, field `client_id`).
- **Client secret**: write-only. Sealed with the installation key (AES-GCM, key under `/data/keys`, never in an archive) into
  `backup_offbox_secrets` (field `client_secret`); the configuration holds only the reference `store:offbox.<target>.client_secret`. The API
  answers only "saved / not set". It is opened in memory only when Arx asks Google for a token.
- **Refresh token**: written only by the connect step, sealed the same way (field `refresh_token`). It can never be typed or read back.
- **Access token**: memory only, about one hour.
- None of these is in a project backup, a log, an audit row or an API answer. Changing the Client ID clears the stored token (connect again).

## Statuses you may see

| Status | What to do |
|---|---|
| Not enough free space in Google Drive | free space in the Google account, or keep fewer copies (retention) |
| Google Drive is limiting requests | nothing; the next run tries again |
| The connection expired or was revoked; connect again | press Connect Google account again (also after 6 months unused, or if the consent screen is still in Testing) |
| Google refused the client id or secret | re-check the pasted values and that the client type is "TVs and Limited Input devices" |
| Google did not grant access to the backup folder | the consent screen must offer `drive.file`; approve again |
