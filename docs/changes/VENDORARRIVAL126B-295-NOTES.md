# VENDORARRIVAL126B-295 (board r126 / r127 / r260) - the vendor "I have arrived" card, merged into the existing visits flow

Branch `pilot/VENDORARRIVAL126B-295`, cut from `origin/release/2160`. Supersedes `pilot/VENDORARRIVAL126-295` (bdbe80338), which was deferred
from 2.16.0 because it built a second, parallel arrival feature. No migration (0173 stays free). No new route, table, monitor step or
notification source. Nothing contacted a door, a vendor, WisKey, HA or an NVR; fakes and the test world only.

## Why the original branch could not merge as it was

`release/2160` already carries the visits flow (CR-SVC215, migration 0156 `ticket_visits`, `services/tickets/visits.py`):

| Original VENDORARRIVAL126 part | Already in the visits flow |
|---|---|
| `POST /t/api/arrived` (`vendor_arrival.signal`) | the same route, `visits.public_arrived` (claim, idempotent, audited, 409 `no_visit`, 422 `outside_window`) |
| table `ticket_vendor_arrivals` (0190) | `ticket_visits` (planned / arrived / missed, claim, late) |
| expected window (awarded order, else the access request start) | visits are planned from the vendor ETA, the confirmed RFQ date, the arrival step and a manager |
| missed-arrival alert in the monitor tick | the visits detector in the janitor (`visits.tick`), source `ticket.arrival_missed`, grace per department |
| timeline rows `vendor_arrived` / `vendor_missed` | events `arrived` / missed rows of the visits flow |
| notification source `ticket.vendor_missed` | `ticket.visit_planned`, `ticket.arrived`, `ticket.arrival_missed` |

Taking both would give two routes on one path, two truths about "arrived" and double alerts. So the duplicate backend was dropped.

## What this branch adds on top of the visits flow

1. **The vendor page card** (the original branch's UI, re-pointed). The visits backend already put a `visit` block in `GET /t/api/ticket` but the
   public page had no card that used it. New lazy chunk `public-ticket/arrived/arrived-card` shows the expected window, the late note, the
   "I have arrived" button (only when the server says `can_arrive`), the reported / arrived line, in he / en / ar / ru (ar / ru need a native review).
2. **`visits.offer_access_request`** (new setting, default **false**): when on, after the arrival the block carries `offer_access` and the card
   points to the existing "Site access" step. It never creates a grant or a code (test counts `access_grants` rows); a manager still approves.
3. **A Settings card** for the visits block (`ticket-visits-settings`): enabled, public tap, claim counts, entry-code pointer, vendor reminder,
   grace minutes, early minutes. All keys already existed server side and were editable only through the API.

## Not carried over (needs an owner decision if wanted)

* Repeating missed-arrival alerts (`repeat_min`, `max_alerts`) and a named-users recipient list: the visits flow alerts once per missed visit and
  uses the notification matrix for recipients. A counter would need a migration (0173).
* The door-access request start as a fallback window: the visits flow already creates a visit from the arrival step (`on_arrival_step`).

## Security notes

The public surface is the one the visits flow already has; the original review ("note: the arrival is a self-assertion") applies unchanged and the
card says "reported". Open point for the lead: `visits.enabled` and `visits.public_arrival` default to **on** in `release/2160`
(settings_doc.py), unlike the original branch which defaulted off; that is existing behaviour and was left unchanged.
