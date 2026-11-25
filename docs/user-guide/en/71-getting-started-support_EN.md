# Getting started, daily operation and support

Source: original (English edition of `docs/user-guide/he/71-getting-started-support_HE.md`)

## What it is

Three things a new operator needs on day one:

- **The getting-started list** - on a new installation, the first thing whoever configures the system sees: an ordered list of what to
  set up first, with each step's state and a link to the screen where it is done (**Settings › Getting started**, also opened from the
  row under the tabs).
- **Daily operation** - a short order of work for a shift, pointing to the full page of each screen.
- **Support** - where the versions are shown, how to download a redacted log and how to report a problem (**Settings › General ›
  Support**).

From version 2.53 (row DOCS-ONBOARDING-2530).

## The getting-started list (whoever configures the system)

### When it appears

- **On a new installation it is on by itself.** On the first sign-in of whoever configures the system, the start screen moves on to it
  once per browser tab. An address opened directly (a link to a specific screen) is never replaced.
- **On an existing installation it is off**, and nothing changes after the update. To use it, turn it on in Settings › General ›
  Support › "Getting-started list".
- While it is on and not hidden, a row "Welcome · The getting-started list shows what to set up first" appears under the tabs, with a
  link to the list. On a phone the row is a "Getting started" pill at the top of the personal menu. Meanwhile the row stands in for the
  setup wizard's "Complete the installation" row, because the list starts with the wizard.
- Only people allowed to configure the system (`system.configure` on the whole installation) see the list and the row.

### What is on it, in order

| # | Step | Where its state comes from | Where the link leads |
|---|---|---|---|
| 1 | Connect the system | the setup wizard's required steps | Settings › Setup wizard |
| 2 | Clock and time zone | installation readiness | Settings › General (when fine: the setup wizard) |
| 3 | Floors and locations | installation readiness | Map › Sites and buildings |
| 4 | People and permissions | installation readiness | Settings › Users and permissions |
| 5 | Notifications | installation readiness | Settings › Notifications |
| 6 | Backup | installation readiness | Settings › General › Backup and restore |
| 7 | Remote access | installation readiness | Settings › Security (second factor; when fine: Settings › General › Remote access) |
| 8 | Active modules | installation readiness | the settings of the module that lacks something (when fine: Settings › General › Tabs) |
| 9 | Hand-over to the customer (optional) | installation readiness | Settings › Readiness |
| 10 | Daily operation and support (information) | - | Settings › General › Support |

- **No step is ticked by hand.** Each row's state is what the setup wizard and the readiness checks measure right now; "Refresh" reads
  them again. The link of an open row is the link the check itself suggests.
- A step the installation does not need (for example remote access when it is off on purpose) is left out. Cameras and infrastructure
  connections are not repeated: they are the wizard's steps, in the first row.
- The count at the top ("3 of 6 steps done") counts the required steps only. The hand-over and the support page are not counted.
- The list only reads. It does not contact any device and changes no setting; the work is done on the screen the link opens.

### How do I…

1. **Open the list** - from the row under the tabs, from Settings › General › Support › "Open the list", or at `#/system/onboarding`.
2. **Hide it for myself** - "Hide the list" on the list itself, or the ✕ on the row under the tabs. Hiding is yours only (kept on the
   server, on every device you sign in from): the list no longer opens by itself for you and you have no row. Bring it back with "Show
   the list again", or Settings › General › Support › "Show again".
3. **Turn it off for the whole installation** - Settings › General › Support › "Getting-started list" (saved at once). Off, it opens for
   nobody and has no row; the screen itself stays available and says it is off.

> **Note:** the "Getting-started list" switch belongs to this installation only: a backup does not carry it and a restore does not
> change it. The change is recorded in the audit log like every settings change.

## Daily operation (every role)

A suggested order of work for a shift. Each line points to the full page (Hebrew guide pages).

1. **At the start of the shift: the dot in the corner.** Green = everything works; amber = something to check; red = a fault, with a
   banner at the top of every screen. Clicking the dot shows what is wrong (whoever configures the system continues to Settings ›
   General › Health and jobs).
2. **Open events.** The event centre: what happened since the previous shift, acknowledging events and opening a case when needed -
   `31-events_HE.md`.
3. **Video.** The camera wall and the map; playback from any event - `30-cameras_HE.md`, `20-map_HE.md`.
4. **Alarm.** The arming state and the open sensors, before leaving or locking a building - `32-alarm_HE.md`.
5. **Devices.** Electricity and devices: live state only; "Unknown" means there is no state, not that the device is off. Every action
   (for example opening a door) needs a permission and is recorded in the audit log - `40-devices_HE.md`.
6. **Phone notifications.** Everyone decides for themselves what reaches them: Settings › Notifications - `85-notifications_HE.md`.
7. **At the end of the shift.** No open events left unhandled, the alarm in the right state, and a fault that persists - report it
   (below).

## Support

### Where the versions are shown

**Settings › General › Support › "Versions"** - four rows; attach all of them to every request:

| Row | What it is |
|---|---|
| Arx (the server) | the version running on the server. Also shown in Settings › Updates and in the header of Settings › General › Health and jobs |
| Interface (the browser) | the version the browser loaded. After an update it differs from the server until the page is refreshed; that is normal |
| Arx bridge | the component that connects Arx to the home system |
| Home system | the home system's version as reported on the last connection |

"Unknown" in a row means the information did not arrive (for example while the connection to the home system is down) - also worth
attaching.

### How to download a redacted log

The "Redacted log export" card is in Settings › General › Support (and in Health and jobs). Only whoever configures the system can
download it.

1. Choose the **time range** (default: one hour; up to 24 hours) so it covers the moment of the problem.
2. Choose the **detail level** (default: information and above).
3. "Export the log" → a confirmation that says what the file holds and what it never holds → "Confirm and download". The browser saves
   a file `arx-logs-<time>.json`.

What the file does **not** hold: passwords, tokens, credentials in addresses, network addresses, serial numbers, phone numbers and
e-mail (hidden before the download), and no video, pictures or plans. Every download is recorded in the audit log (how many lines and
which range - never the content).

### How to report a problem

The "Reporting a problem" card in Settings › General › Support sums it up:

1. Write what happened, on which screen and at what time, and what you expected to happen.
2. Take a screenshot, with the error message if one appeared.
3. Download a redacted log of the last hour, or of the time window when it happened.
4. Attach the four versions from the "Versions" card.
5. Send it all to whoever installed the system or to SmplWise support.

> **Note:** do not send passwords, codes, floor-plan images or camera images that are not meant to be shared. The redacted log is
> already built without such details; check a screenshot before you send it.
