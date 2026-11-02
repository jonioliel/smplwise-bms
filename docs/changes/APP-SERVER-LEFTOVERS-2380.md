# APP-SERVER-LEFTOVERS-2380 - company logo API for the apps, quiet window narrowed to phone / browser push

Package M3 of `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md` (items A3 of section 1.3; A4, the employee notice, belongs to M1 and `mobile/`).
Branch `pilot/APP-SERVER-LEFTOVERS-2380` from `origin/release/2360-train`. No version bump, no migration, no frontend change, no `mobile/` change.
Sources: `APP_TEAM_REQUESTS_2026-10-24_HE.md` section 2.7 (L-2: company logo in the app) and section 2.6 (Q-3: the window holds only phone and browser push).

## 1. Quiet window: phone and browser push only (Q-3)

Owner decision (told to the app teams as Q-3): a quiet window silences only the push to the phone and the browser; the inbox keeps everything.
Before this change the window held every channel of an informational notification (web push, the phone app, e-mail, WhatsApp, the spoken announcement).

| Aspect | Now |
|---|---|
| New setting | `quiet.windows.channels` = `push` (default) or `all`; read / written through the existing `GET` / `PUT /quiet/settings` (`system.configure`, confirmed, audited, 422 on any other value) |
| `push` (default) | held: `webpush` and `app` (the app follows the push column of the matrix, so it is the same decision). Not held: `email`, `whatsapp`, `announce` - they run as if no window existed and keep their own rules (quiet hours, the announcement's own quiet mode) |
| `all` | the previous behaviour, every channel |
| Never held (unchanged) | critical severity, `safety`, `doors`, `security`, `door.*` / `access.*` / `intercom.*` sources, escalations, notifications with no area; the notification row and the inbox |
| Delivery log | a held push channel still says `quiet_window`; a channel the window does not hold but quiet HOURS do says `quiet_hours` (the reason is now decided per channel) |
| Feature switch | unchanged: `quiet.windows.enabled` is off by default, so nothing changes anywhere until an administrator turns windows on |

Code: `services/quiet_windows.py` (`CHANNELS_KEY`, `PUSH_CHANNELS`, `ALL_CHANNELS`, `held_channels`), `services/notify_channels.py` (`Dispatch.window_holds`,
`held`, `held_reason(channel)`, the dispatch stores the set next to `quiet_window`), `services/mobile_push.py` (reason per channel), `notify_email.py`,
`notify_whatsapp.py` (plan and the `still_wanted` re-check), `announce_channel.py`. No push is sent by this change: the relay is still unconfigured on every
installation (`SW_PUSH_RELAY_URL` / `_KEY`), and the tests use a fake relay.

Owner-visible effect once windows are switched on: an email or WhatsApp copy of an informational notification in a muted place is now delivered
during the window (before: skipped). To get the old behaviour back set `quiet.windows.channels` to `all`. The settings card of the quiet window
(frontend) does not show the new key yet; it is changed through the API until a UI slice adds a two-way choice.

## 2. Company logo for the apps (L-2)

The app shows the company logo only on its splash / "about" screen (the installed identity stays SmplWise Arx; the web pages show it themselves at the top of
home and on the sign-in page). The existing `GET /brand/public` already serves the sign-in page without a session; the apps get a small, separate, read-only
surface so they do not depend on that page's shape and can cache per server.

| Route | Who | Returns |
|---|---|---|
| `GET /api/v1/brand/app` | device token or session (`routers/presence.any_caller`, like `notifications/categories`; the remote channel needs a session or a device token as everywhere) | `{company: {name, logos: {light, dark}}, version}`; each logo is `null` or `{stamp, mime, width, height, path}` (`path` relative to `/api/v1/`) |
| `GET /api/v1/brand/app/logo/{variant}` | the same | the image (PNG, or the sanitised SVG with the sandbox CSP and `nosniff`), `ETag` = the stamp, `Cache-Control: private, no-cache`, 304 on a matching `If-None-Match`, 404 when none is stored |

Public-safe: only the company name and the two logo images the administrator already publishes through `GET /brand/public`. Not carried: the installer
profile, the project name, the company kind, who uploaded or when, the title settings, byte sizes, any person or setting. Images come only through
`services/brand_assets.read` (the stored bytes must hash to their stamp), so a damaged row is never served. `version` (`l<stamp>.d<stamp>`, `-` for none)
changes when a logo is added, replaced or removed. Nothing is written or audited; there is no switch because there is nothing new to expose (with no logo the
answer is two nulls). Code: `routers/app_brand.py`, mounted in `main.py`.

## 3. Tests

`smplwise_vms/backend/tests/test_app_server_leftovers_2380.py` (13 tests; fake web-push service and fake relay only): setting default and validation; default
window holds exactly `webpush` + `app` through the real Dispatch rules, `all` restores five channels; other places, critical, doors and escalations are held
on no channel; quiet-hours reason stays per channel; real web push row skipped / inbox keeps it; the phone app held through the fake relay in the window's
place, sent elsewhere, critical sent; WhatsApp re-check follows the set; brand route empty / filled / private fields absent / version changes; image bytes, ETag,
304, SVG sandbox, delete; device token and session accepted, bad or revoked token 401, write methods 405. Regression runs are listed in the segment report.

## 4. Not done / for the owner

* No UI for `quiet.windows.channels` (API only); no frontend or `mobile/` file touched. The app teams can use the brand route once they want it (L-2 is P3).
* No real device, no real push, no runner run tonight (NOT_RUN).
* `contracts/API_INVENTORY.md` regenerated for the two new routes.
