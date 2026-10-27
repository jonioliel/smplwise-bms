# WISKEYNEXT-297 slice B - temporary keypad code for vendors (board r381): evidence, not a new path

Branch `pilot/WISKEYNEXT-297` from `origin/main` @ 1b0ddd85c (v2.23.2). Tests only, no product code, no migration, no setting.
Fakes only: no WisKey, Home Assistant, station, door, reader or WhatsApp was touched.

## The board row

r381: "a temporary access code for keypads, for vendors and visitors (through WisKey)"; goal "a code for a day or an hour through WisKey,
with revocation"; replaces the technician card; recorded dependency "a new WisKey command that does not exist yet".

## Finding

For a **vendor's technician** the whole goal already ships in Arx, behind the existing switch `access.external_grants` (default off,
`GO_LIVE_PERMITTED = True` since ECCACT-295):

| Need | Where it already is |
|---|---|
| A code for an hour or a day | `access_grants.parse_window`: UTC instants, any length from 1 minute up to the 14-day cap (owner answer 8) |
| Created in WisKey | the grant worker: person created inert, door map + validity + daily hours, then `users/pin_generate` + `users/update` (catalog commands, HA feed lane; T06 row "users/pin_generate is not a native command") |
| Delivered | WhatsApp only, to the number the person confirmed, separate message without a link (owner answer 3); nobody in Arx sees it |
| Revocation | window end (R1), manual revoke (R2) and R3-R10; at-least-once strip with read-back proof |
| Permission + audit | approve needs `access.external.grant` + `access.people.manage` + `access.people.sensitive` + `access.pin.generate` on every station, an interactive human; audit rows with ids only |

So no new WisKey command is needed for the vendor case. The tests below prove the one-hour and one-day cases end to end on fakes.

What r381 could still mean beyond this - each needs a WisKey answer or an owner decision, so none of it was built (AGENTS.md: stop at a
missing contract, do not invent behaviour):

1. **A code that is not bound to a WisKey person** (a station keypad code; the catalog has `stations/technical_codes_get|write`, whose
   semantics Arx has never been given). Writing station technical codes from Arx would be a new device-write path.
2. **A one-time / use-counted code.** The catalog Arx holds has no one-time PIN (CR-VISITOR105 F10); "single entry" can only be
   best-effort (revoke on the first `access_granted` event).
3. **Visitors** (r105 / W-024): designed in `docs/changes/CR-VISITOR105.md` (host envelope, visitor page, retention), frozen by the owner;
   it reuses this same grant engine, so it needs no new WisKey command either.
4. **Showing the code to a manager** (e.g. to read it out on the phone) contradicts owner answer 3 and the PIN safety design.

## Tests

`smplwise_vms/backend/tests/test_r381_short_code_window_297.py` (10 cases): one-hour code due at once, exact WisKey validity, still valid
one minute before the end, stripped at the end; one-day code sent 18:00 local the evening before and ended with the day; manual revoke
inside the hour strips PIN, doors and active; windows of 1 min / 15 min / 1 h / 1 day / 14 days accepted, 14 days + 1 min refused; the PIN
sentinel never appears in the list, digest or CSV export answers. Results: see the slice report (runner run, SHA in the header).

## NOT_RUN

A real WisKey person, a real keypad entry, a real WhatsApp message (owner session, action by action).

## Rollback

Delete the test file and this note.
