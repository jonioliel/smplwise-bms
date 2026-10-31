# External calendars - the owner's setup (CALCONNECT-2330)

Hebrew short version: `CALENDAR_CONNECT_SETUP_HE.md`. Contract: `docs/changes/CALENDARS-CONTRACT-298.md` sections 12, 13.5, 15.

Arx never creates an account or an app registration, never asks for a password and never automates a consent screen. You create
your OWN app at the provider, paste its id into Arx and approve in your own browser. Everything below is off until you switch it on:
Settings › Calendars (`enabled`, then `sync_enabled`; `feeds_enabled` for outgoing feeds). Who may connect: the holders of
"Calendars: connect external calendars" (`calendar.connect`). Binding a calendar also needs an edit role in that calendar.

## 1. iCal subscription (read-only, no account)

1. In your calendar application copy the calendar's **secret iCal address** (Google: calendar settings › "Secret address in iCal
   format"; Outlook: Publish a calendar › ICS).
2. Arx › Settings › Calendar connections › iCal card › "מנוי iCal", paste the address (`https://` or `webcal://`).
3. "שיוך יומן": choose the Arx calendar it fills (import only).

Rules: https on port 443, a public address only (home-network addresses, `localhost`, `.local` are refused), at most 5 MB, 15 s.
The address is stored sealed and never shown again; to change it, paste a new one.

## 2. Google Calendar (installed-app flow, paste-back)

1. https://console.cloud.google.com › create a project (or use one) › APIs & Services › Library › enable **Google Calendar API**.
2. OAuth consent screen: user type External (or Internal for Workspace), app name of your choice, add yourself under **Test users**.
   While the app is in "Testing", Google expires the authorisation after 7 days - publish the app (no verification is needed for
   your own use) or re-authorise from the card.
3. Credentials › Create credentials › OAuth client ID › type **Desktop app**. Copy the Client ID and the Client secret.
4. Arx › Google card › "חיבור": name, read or read-write, paste Client ID and Client secret › "שמירה והמשך".
5. "פתיחת מסך האישור של Google" opens Google in a new tab. Approve **every** box (a partial approval is refused).
6. The browser then goes to `http://127.0.0.1:8749/?state=...&code=...` and shows a "cannot connect" page - that is expected (Arx is not
   reachable from your browser's own machine and does not need to be). Copy the WHOLE address from the address bar, paste it into Arx,
   "סיום". The code is single-use, valid for 10 minutes, and only for the request you started.
7. "שיוך יומן": choose the Google calendar and the Arx calendar, the direction and what leaves (busy / titles / titles and notes).

Scope: by default the full calendar scope (`calendar`, or `calendar.readonly` for a read connection) - owner answer C8. Setting
`sync_google_scope = events` asks for `calendar.events` (+ `calendar.calendarlist.readonly`, needed to list your calendars) instead.

Why not the device code here: Google does not allow calendar scopes for "TVs and Limited Input devices" clients (the Google Drive
backup uses that flow because `drive.file` is allowed there).

## 3. Microsoft 365 / Outlook (device code)

1. https://entra.microsoft.com › App registrations › New registration. Supported account types: what you use (your organisation only,
   or "any organisational directory and personal Microsoft accounts" for outlook.com).
2. Authentication › Advanced settings › **Allow public client flows: Yes**. No redirect address and no client secret are needed.
3. API permissions › Add › Microsoft Graph › Delegated › **Calendars.ReadWrite** (or **Calendars.Read** for read connections).
   An organisation may require admin consent for it.
4. Copy the Application (client) ID (and, for a single organisation, the Directory (tenant) ID).
5. Arx › Microsoft card › "חיבור": paste the client ID; directory `common` (default), `organizations`, `consumers` or your tenant id.
6. Arx shows a short code. On any phone or computer open https://microsoft.com/devicelogin, enter the code and approve. Arx notices by
   itself within a few seconds.

Microsoft has no per-token revoke: "ניתוק" deletes the tokens in Arx; also remove the app's access at https://myapps.microsoft.com
(work accounts) or https://account.live.com/consent/Manage (personal accounts).

## 4. Outgoing iCal feed

Settings › Calendars: switch on `feeds_enabled`. iCal card › "פידים יוצאים" › choose calendars (you need edit in each) and busy / titles
› "פיד חדש". The address is shown ONCE; "כתובת חדשה" replaces it, "ביטול" ends it. Notes, guests and organisers never leave.
The address works only where Arx is reachable by the subscribing application; exposing it outside the house is your installation's
choice and passes the feed security review (contract 15.11) first.

## 5. Statuses on a card

| Status | Meaning | What to do |
|---|---|---|
| ממתין להגדרה | client id / approval / iCal address missing | "המשך הגדרה" |
| נדרשת הרשאה מחדש (`auth_expired`) | the provider revoked or expired the authorisation | "הרשאה מחדש"; or "המשך" to retry once |
| `rate_limited` | the provider asks us to slow down | nothing: Arx backs off (up to 60 min) |
| `quota_exceeded` | the provider's daily quota is used | nothing: retried later |
| `client_invalid` | the provider refused the client id / secret | check the app registration, paste again |
| `feed_unreachable` / `feed_refused` | the iCal address did not answer / is not allowed | check the address |

Pause / resume / sync now / disconnect: the connection's owner or a system administrator (owner answer 19).

## 6. What Arx stores

Client id (plain - it is public anyway), client secret, refresh token, iCal address: sealed with the installation key (`v1:` AES-256-GCM)
in the `settings` table under `calendar.conn.<id>.`. Access tokens live in memory only. Nothing of it appears in answers, logs or audit.
