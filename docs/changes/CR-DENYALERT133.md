# CR-DENYALERT133 - denied-entry alert of the external access

Status: implemented on `pilot/DENYALERT133-295` (from `main` @ `320e55551`, v2.12.4). Board item r133. No migration, no new permission,
no new channel. Closes the "denied-attempt alert" left open in CR-ARX-WISKEY-SHARED-IDENTITY 4.3 / WisKey W-c.

## What changes

A new notification source `access.denied_attempt` (category `security`, default severity `info`, subject kind `access_denied` = the station)
and one read step of the grants worker (`services/access_denied.py`, run from `AccessGrantWorker._screen_passes`):

1. Ask WisKey's event feed (`events/list`, `result = denied`, read channel, never a write) for events newer than a stored cursor.
2. Keep the events that concern the external access: the event names a person Arx linked (employee number -> `access_person_links` ->
   that subject's newest grant), or its station is a door of a live grant. Everything else is not ours.
3. Emit one signal per event with `dedupe_key = access.denied_attempt:<station>:<grant|->`. The engine folds repeats inside the policy's
   dedupe window (default 600 s) into one row with a count, so a brute force or a faulty reader makes one row, not a stream of phone alerts.
   When the open row plus the pass reaches 5 refusals the signal carries severity `alert` (the engine re-notifies once on the rise).
   It never sends `critical`; safety, escalation and quiet-hour rules are untouched.

## Rules kept

- Switches: OFF. Runs only while `access.external.denied_alert` is `on` (set through `PUT /access-grants/settings`, field `denied_alert`)
  AND the external-access feature is on (`access.external_grants` + the go-live permit). The policy row is listed in the notification
  matrix only then. The first pass after the switch only sets the cursor to "now"; a gap longer than an hour is never replayed.
- Recipients: users holding `access.external.grant` on THAT station (`services/notify_visibility.py`, subject kind `access_denied`,
  re-checked at every delivery). Rule `scope`, so the administrator can narrow it in the matrix like any source.
- Text: station name, the grant's first 8 characters, local time (HH:MM) and a closed reason (attempt limit, grant not active, outside the
  window, credential refused, unknown credential). The PIN, the card number, the person's name and number, the phone are matched or dropped,
  never stored in the row, the params or the origin.
- WisKey does not answer: the cursor stays, the next pass asks again. A failing step never stops the grant work.

## Not done / open

- Whether WisKey's feed reports a denied PIN when no person matched is still the open question W-c; with no `employee_no` the alert is
  per station only (`ref -`).
- The settings UI toggle (frontend) is not part of this backend change.

## Tests

`tests/test_denyalert133_295.py` (fakes only): off by default, feature off, first pass no history, emitted on refusal and not on success,
person and reason, unrelated station ignored, fold with count, burst severity (across passes and inside one pass), two stations, no secrets
in the row, recipients by station scope, WisKey silent, failing source, matrix listing, settings route.
