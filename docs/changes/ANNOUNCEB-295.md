# ANNOUNCEB-295 - voice announcements, stage B: the text on screens

Branch `pilot/ANNOUNCEB-295` from `release/2210` (3dd7b8c46). Board items r143 (stage B), r366. Stage A (speakers) is `ANNOUNCE-295`
(`docs/changes/CR-VOICE143.md` is the original design; the nine owner decisions of 25.10 are applied in stage A and unchanged here).
Migration **0178** (`0178_announce_screens.sql`, additive: two columns and an index on `announcements`); another branch may take the same number.

## What it does

When an announcement is sent, its text is also shown on the screens an administrator allowed. A screen is a display surface of Arx itself:

| Screen | Key | Where it is drawn |
|---|---|---|
| Notice TV board (lobby / parking / gym board) | `board:<id>` | the tokenised TV page: a full-page overlay (`.ann`), the same canvas as the board |
| Wall display | `wall:<user id>` | the kiosk wall (`sw-wall`): a full-page overlay, closable on the screen |

Nothing here reaches a physical device (no cast, no TV control call): the screens only READ. Casting text to a vendor TV (a banner through the cast relay,
CR-VOICE143 slice A4) is not part of this stage.

## Rules (the same as the speakers, because it is the same `announce()` call)

* **Targeting.** The same scopes: `device` (the media screen a screen is linked to), `area` (the room set on the screen), `all`. An unknown or not-allowed
  target is "no targets"; the caller never learns which. Nothing is allowed by default.
* **Feature switch.** `announce.enabled` (stage A) AND `announce.screens.enabled` (new, OFF by default). While either is off the feeds carry nothing and
  the board does not poll faster. The announce tab and the "screens" chips follow the same server answer (`screens_enabled`), so they hide when it is off.
* **Quiet hours, rate limit, emergency.** Evaluated once, before both channels: `suppress` refuses both, `queue` holds both (shown only when released),
  `lower` / `allow` show the text; the emergency announcement is critical, bypasses quiet hours and the limit, and is always shown where screens are on.
* **Language.** The text of every language that was announced, one block per language with its own direction. No translation (a later stage).
* **Time.** A normal announcement stays `announce.screens.seconds` (default 30), an emergency `announce.screens.critical_seconds` (default 180); it can
  be taken off at once (`POST /announcements/{id}/screens/stop`, `media.announce`, audited).
* **Audit.** The existing `media.announce` / `media.announce.emergency` rows carry the number of screens; the settings changes are audited as
  `media.announce.config` (the screen list by key only); the stop is `media.announce.screens_stop`.
* **Public feed.** The board feed block is `{id, critical, until, texts[]}`: no author, no targets, no template.

## Settings (system.configure; the per-role permission is the existing one)

הגדרות › מולטימדיה › הכרזות › "הצגה על מסכים": the switch, "show on screens by default" (what a sender gets when he does not choose), display time, display
time in an emergency, how often a screen asks (2-30 s; a board asks every 30 s as before while it is not an announcement screen), and the list of allowed
screens (display boards while the notices module is on, enabled wall profiles) each with its room and the linked media screen. Every value is validated
on the server (`seconds` 5-600, `critical_seconds` 10-3600, `poll_s` 2-30).

## Operator screen

ראשי › הכרזות: when screens are on, two chips "רמקולים / מסכים" next to the room choice (both on by default, per `default_on`). Speakers off = screens only
(no engine needed). Emergency buttons always go to both. The control screen keeps fitting 1366x768 without scrolling.

## API

| Route | Notes |
|---|---|
| `POST /announcements` | new optional `speakers` (default true) and `screens` (default = `announce.screens.default_on`); the answer adds `screens: n` only when n > 0 |
| `GET /announcements/areas` | adds `screens_enabled`, `screens_default_on`; a room with only an allowed screen is listed (`devices: []`, `screens: n`) |
| `GET/PUT /announcements/config` | `config.screens {enabled, default_on, seconds, critical_seconds, poll_s, targets[]}`; the GET adds `screen_options` |
| `POST /announcements/{id}/screens/stop` | new |
| `GET /wall/announcement` | new; the wall display's own announcement and its poll interval (`poll_s` 0 = not an announcement screen) |
| `GET /notices/display/{slug}` | the feed adds `announcement` and `board.announce_poll_s` (only for an allowed board) |

API inventory 1578 -> 1580.

## Tests

* `smplwise_vms/backend/tests/test_announce_screens_b295.py` (15): off by default and stage A unchanged, settings validation / audit / permission, the board
  feed (text only, expiry, not-allowed board), screens only without an engine, the default and the override, scopes (area, all, device link), quiet hours
  (suppress, queue + release), emergency, rate limit, stop, the wall route, ETag / version.
* `frontend/tests/unit-announceb-295.spec.ts` (10): the overlay rules, sizing, escaping, polling clamp, the settings helpers, string parity.
* `frontend/tests/evidence-announceb-295.spec.ts` (14, desktop project): the TV page at 1366x768, 1920x1080 and 1080x1920 (normal, emergency in three
  languages, expired, escaped markup), the wall at 1366x768, 1024x768 and 800x1280 (fit, close), the Settings card and the announce form's chips.

## Not done / limits

* A vendor TV (Cast, Samsung, LG) is not a target by itself: it receives text only through the board page it is pointed at. A direct on-screen banner
  through the cast relay would be a physical-device action and needs the owner's approval.
* No automatic translation (stage C). No pixel baselines were regenerated.
* The wall display draws a normal announcement over its camera view and its picture-frame view; in its sleep view only an emergency is drawn (the sleep view is otherwise left alone, no wake-up is triggered). The sleep case is not covered by a spec.
* Real-device behaviour (a TV browser, a tablet wall) is NOT_RUN; the checks use mocked wire contracts and Chromium.
