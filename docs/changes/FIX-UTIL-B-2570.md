# FIX-UTIL-B-2570 - presence settings, notice TV recovery, insights delivery, maintenance files

Review: `docs/review/DEEP-REVIEW-2570-COMMS-UTILITIES.md` (branch `review/DEEP2-2570-COMMS-UTILITIES`). Base `release/2570-train` (v2.56.0).

## Changes
- CU2-09 (medium): `PUT /presence/settings` refuses with 422 (`fields: ["required_sensors.sensors"]`) a policy that is enabled and requires a
  sensor that is not on the approved list. It is judged on the state the save leaves behind, so unticking an approved sensor that the stored
  policy requires is refused too. The screen (`system-presence.ts`) disables Save for the same problem (`policyBlocker`); the notice textarea
  gets `maxlength=8000`. English text added to `error_text_en.json`.
- CU2-10 (medium): `update_settings` runs inside a SAVEPOINT; any refusal part-way rolls every write of the call back (an `ApiError` still
  commits the request transaction, so this is what makes the save all-or-nothing). The router now audits the refusal
  (`presence.settings.update`, decision `denied`, reason = the error code, the names of the fields sent, never values).
- CU2-11 (medium): the notice TV no longer stops polling after a 404. While "gone" it probes with a bounded back-off (1, 2, 4, 8, then every
  10 minutes; `nextPollMs`), and recovers on a 200. The gone screen says the screen keeps checking (he + en).
- CU2-19 (low): an insights report row is claimed in its own committed transaction before anything is sent (it reads `failed` /
  `unknown_outcome` while in flight; the table has no `sending` state and no migration was added), so a restart after the send never
  re-queues it. An exception after the send began is recorded as `unknown_outcome`, never retried; a failing `note_result` no longer turns a
  delivered WhatsApp message into a retry.
- CU2-21 (low): deleting a maintenance task marks its files deleted and removes the bytes; the bytes of a file or task delete are removed after
  the request transaction commits (background task), not before.
- CU2-33 (low): the three tests that could not fail for their stated reason are made real (insights send time, emergency verdict derived
  from the items, water alerts never call a device - behaviour instead of a source grep).

## Not touched (other rows)
CU2-20 (insights attempts burned on transient states) is left as is: the brief names only duplicates. The readiness test fix (CU2-33, second
item) sits in a file the readiness row (FIX-UTIL-A-2570) may also edit.

## Tests
See the report; results are recorded in the branch commit message / lead report (runner, slot B).
