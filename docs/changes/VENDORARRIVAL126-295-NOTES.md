# VENDORARRIVAL126-295 (board r126 + r127) - the vendor's arrival signal, the expected window, the missed-arrival alert

Branch `pilot/VENDORARRIVAL126-295`, cut from `origin/main` (v2.14.0 @ `9d4e54439`). No version / CHANGELOG edit (the integration owns it).
Nothing here contacted WisKey, a station, a door, Home Assistant, an NVR or a vendor: fakes and the test world only.

## What was there

* `stuck.py` / `monitor.py` (the SLA ladder) reacts to silence only: reminders to the assignee, then an alert to the managers. No arrival signal.
* `access_arrival.py` (`GET/POST /t/api/arrival`, GRANTS3-295) is the "who arrives, when" step that creates a door-access REQUEST (state
  `requested`, a human approves; the code goes only to the named person's verified number). It is the only door-code path and is unchanged.
* The awarded RFQ work order carries a planned arrival window (`ticket_rfq_award_terms.planned_from/planned_to`, moved by a manager's reschedule).

## What was added (all behind `vendor_arrival.enabled`, default OFF)

| Part | Where |
|---|---|
| One tap "I have arrived": `POST /t/api/arrived` - the link's token, edge rule `token_write` (the public rate window), strict JSON, mandatory `client_request_id` replayed by the request row, uniform 404 while off / staff link / ended request, 409 `invalid_state` for a request not in handling. A repeat changes nothing. Timeline row `vendor_arrived` (visible to the vendor), counts as progress of the assignment | `services/tickets/vendor_arrival.py` `signal`, `public_routes.py`, `public_http.py` |
| Expected-arrival window: the awarded order's CURRENT planned window, else the start of the vendor's own door-access request. No end -> `default_window_min`; a plain date -> `day_from`-`day_to` in the installation zone | `vendor_arrival.expected_window`, `store_arrival.py` |
| Missed-arrival alert: a step of the monitor tick; `assigned` / `acknowledged` with no arrival `grace_min` after the window end; repeat every `repeat_min` (0 = once) up to `max_alerts`; a moved window resets and resolves it; an arrival resolves it. Source `ticket.vendor_missed` through the existing CR-018 pipeline (number and place only; matrix, digest, quiet hours, channels apply) | `vendor_arrival.look/run`, `monitor.py`, `notify_bridge.py`, `notify_sources.py` |
| Recipients: the department's managers (switch) + named users; each still only for requests he may see | `notify_bridge.recipient_users` (audience `vendor_arrival`) |
| Settings (`vendor_arrival`: enabled, default_window_min, day_from, day_to, grace_min, repeat_min, max_alerts, recipients.managers/users, offer_access_request), validated server side, `system.configure`, audited with the keys | `settings_doc.py`, `routers/tickets_admin.py`, Settings > module > general card `ticket-vendor-arrival` |
| Vendor page: lazy chunk `arrived-card` (one button; shows the expected window / "late" / "arrived at"; points to the existing "Site access" card when `offer_access_request` and that step is available). Hebrew, English, Arabic, Russian | `frontend/src/public-ticket/arrived/` |
| Manager timeline rows `vendor_arrived` / `vendor_missed`; the notification source in the settings matrix (he/en/ar/ru) | `board-text.ts`, `model.ts`, `i18n/notify-matrix.ts`, `api/notifications.ts` |

## Door access (r127) - by design not automatic

The arrival tap never creates, approves or sends a grant or a code (a test counts `access_grants` rows after a tap). The request of a door code
stays the existing arrival step -> `requested` grant -> human approval -> personal code to the verified number. The card only points to it.

## Migration

`0190_vendor_arrival.sql` - **PROVISIONAL**. Main ends at 0151; release/2150 holds provisional 0152-0159, 0165, 0175 elsewhere. Renumber at the
integration that merges this branch (one table `ticket_vendor_arrivals`, ids and times only, cascades with the assignment / ticket).

## Not built / limits (honest)

* No reminder is sent to the VENDOR: "reminders" are the repeated manager alerts (cadence and maximum are settings). Messaging a vendor about a
  missed arrival would need a message template and send window decision.
* A regular assignment with no RFQ order and no door-access request has no planned arrival, hence no alert (the page still offers the tap).
* Only the first day of a multi-day access request is a window.
* A manager cannot yet mark an arrival on the vendor's behalf (the alert ends on the vendor's tap, a moved window, or the request ending/starting work).
* The Settings card is a column of rows in the existing general tab (no new scrolling container; the tab itself already scrolls as before).
