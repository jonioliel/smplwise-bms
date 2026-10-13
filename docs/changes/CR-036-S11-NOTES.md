# CR-036 slice S11 - the native WisKey WRITES for people and cards (stage 1): notes, decisions, gaps

Branch `pilot/WISKEY-s11-writes`, from `origin/integ/248`. Nothing here contacted a WisKey, Home Assistant, station or device:
every test runs against `tests/fake_wiskey.py` (backend) or a mocked backend (Playwright). Live behaviour is NOT_RUN.

Read with `docs/changes/CR-036-WISKEY-NATIVE-SCREENS.md` (sections 2-4), `docs/changes/CR-036-S3-S4-INTERFACE-NOTES.md` (the
adapter, `intercom_authority`), `docs/changes/CR-036-S7-NOTES.md` (the people screen this slice extends) and the owner decisions of
2026-10-12 (`private/wiskey-foldin/ARX_OWNER_DECISIONS_TO_WISKEY_2026-10-12_HE.md`, binding): stage 1 includes every WisKey
capability, writes approved now, DC / DW / PG approved, Arx RBAC is the only authority for Arx-started actions (no WisKey
re-authentication, MFA or dual approval added by Arx), the engine stays WisKey.

## 1. What exists now

| Piece | Where | One line |
|---|---|---|
| The write side of the adapter | `backend/smplwise/services/intercom_writes.py` (new) | the station-chain gate, the uniform 404, the field level, the effect classes, the interactive-session rule, the editor projection, local validators mirroring WisKey (timing, the JPEG photo rule) |
| The new write endpoints | `routers/access_control_writes.py` (new) | archive / unarchive, on / off, temporary cancel, card by number in / out, the photo |
| The editor's endpoints, re-gated | `routers/access_control.py` | editor context, editor person, PIN generation, create, update, delete, card capture start / poll / cancel / confirm |
| WisKey calls | `services/intercom_client.py` | `users_archive`, `users_set_active`, `users_temporary_cancel`, `cards_add`, `cards_remove` (pinned rc37-contract.4 keys) with their pre-storage refusal tables |
| The actions dialog | `frontend/src/screens/wiskey-person-actions.ts` (new) | one dialog for the menu of a person's page and each action |
| The person's page | `screens/wiskey-person-drawer.ts`, `screens/wiskey-people.ts` | a "פעולות" button, the one-line result under the header, the pending delete watched by the page |
| The editor | `screens/wiskey-person-editor.ts` | access category + responsible person + purpose, the timing form, the caller's field level, PIN generation by its own permission, capture limited to the caller's capture stations |
| Typed client | `api/access-writes.ts` (new), `api/intercom.ts` | one call per write with a fresh command envelope; the editor projection's new fields; `effect` / `pending` |
| Pure logic + strings | `access-control/people-writes-logic.ts`, `i18n/access-writes.ts` (new) | actions offered, answer states, timing form and patch, photo budget, card number; Hebrew copy without platform names |

The screen is the S7 native people screen: it is shown only when the per-screen switch `access.ui.people` is `smplwise` (OFF by
default - the classic panel stays the default). No migration: the schema stays at 0001..0075.

## 2. Endpoints

All under `/api/v1`, JSON bodies, each write with the command envelope (`client_request_id`, `expires_at`: an expired or duplicate
command is refused), the attempt audit row committed before the command is sent and the outcome row after, sent ONCE in the feed's
config lane - never queued, never retried. A refusal only for a code proven to come before WisKey's commit
(`intercom_client.PRE_STORAGE` and the new tables); anything unclear is a 504 `intercom_outcome_unknown`.

| Method | Path | Body | WisKey | Effect |
|---|---|---|---|---|
| POST | `/intercom/people/{id}/archive` | `{revision, confirmed}` | `users/archive` | sync |
| POST | `/intercom/people/{id}/unarchive` | `{revision, confirmed}` | `users/unarchive` | sync |
| POST | `/intercom/people/{id}/active` | `{active, revision}` | `users/set_active` | sync |
| POST | `/intercom/people/{id}/temporary-cancel` | `{reason_code, revision, confirmed}` (visit_cancelled / visit_completed / access_no_longer_needed) | `users/temporary_cancel` | sync |
| POST | `/intercom/people/{id}/cards` | `{card_no, label, enabled, revision}` (sensitive) | `cards/add` | sync |
| POST | `/intercom/people/{id}/cards/{card_id}/remove` | `{revision, confirmed}` (sensitive) | `cards/remove` | sync |
| PUT | `/intercom/people/{id}/photo` | `{photo: JPEG data URL or null, revision, sync_now}` (sensitive) | `users/update` `{photo}` | sync |
| POST | `/intercom/people` | `{data, sync_now}` | `users/create` | sync |
| PUT | `/intercom/people/{id}` | `{data (a patch), revision, sync_now}` | `users/update` | sync |
| POST | `/intercom/people/{id}/delete` | `{revision, confirmed}` | `users/delete` | **unknown_effect** |
| POST | `/intercom/people/pin-generate` | `{user_id}` ("" for a new person) | `users/pin_generate` | personal_value |
| POST | `/intercom/people/{id}/card-capture` | `{station_id, reader_id, revision, confirmed}` | `cards/capture_start` | **unknown_effect** |
| POST | `/intercom/card-capture/{sid}/cancel` | `{}` | `cards/capture_cancel` | **unknown_effect** |
| POST | `/intercom/card-capture/{sid}/confirm` | `{label, confirmed}` | `cards/capture_confirm` | **unknown_effect** |

`sync_now` is explicit on create, update and the photo (default `true`: WisKey asks the stations at once). Every successful write
answers `effect` and `pending`: `sync` / `false` (WisKey stored it; the stations follow through WisKey's own sync), or
`unknown_effect` / `true` - sent, the result is shown as "נשלח · ממתין לאישור" until the read model shows it (the delete: until the
person's page answers 404; the capture confirm: until the card is in the person's record). Never "done" for an unknown.

`PersonData` gains `access_category` (staff / visitor / contractor; null refused), `responsible_person` (<= 64), `access_purpose`
(<= 128), `access_timing_draft` (a proposal, never a grant) and `access_timing_policy` (`ha`: enforced by the system, no bindings;
`native`: enforced by the device, per-station slots), validated locally with WisKey's own rules (weekdays Monday first, 1-64 real
dates 2000..2037, 1-8 windows, no overlap, `24:00` only as an end, an IANA zone; template / weekly slots <= 65532, one holiday slot
per run of dates, at most 100 slots per station).

New refusal codes answered by name: `intercom_approval_required` (WisKey's own dual approval is on - refused, never bypassed),
`intercom_archive_state_changed`, `intercom_not_temporary`, `intercom_already_inactive`, `intercom_card_not_found`,
`intercom_person_archived`, `intercom_responsible_required`, `intercom_photo_disabled`; the gates: `intercom_person_scope` (403),
`intercom_field_level` (403), `intercom_revision_conflict` (409), `intercom_pin_interactive_only` (403), and the uniform
`intercom_person_not_found` (404).

## 3. Permissions and the gate

- `access.people.manage` anywhere a station can be, as a dependency, before the body is read (an audited 403 `forbidden`); then
  every station of the person - before AND after the change (an assignment, a binding or an override that adds a station counts) -
  through `intercom_writes.gate_person_write`: a fresh `users/get` unless the caller is unrestricted; the write carries the revision
  that read returned (the TOCTOU bound). A person the caller cannot see answers exactly like one that does not exist (no existence
  oracle); a person shared with a station off the caller's chain is a 403 `intercom_person_scope`.
- The sensitive fields (phone, PIN, cards, photo, responsible person, access purpose; the employee number when the administrator
  made it sensitive) need `access.people.sensitive` on every station of the person: 403 `intercom_field_level`. The editor
  projection nulls them below that level (null = not shown, never "none"), and the screen never SENDS a field it was not shown.
- Card capture: `access.cards.capture` (+ manage, + the sensitive level) on the person's stations AND on the capture station.
- **New permission `access.pin.generate`** (my choice for "a dedicated permission", PG): sensitive, granted to `site_admin` and
  `system_admin`, on top of `access.people.manage`; for a saved person on every station of theirs with the sensitive level. An
  interactive human session only (`intercom_writes.interactive`: Ingress / dev sessions and a remote browser on its cookie; a
  bearer-token client gets 403 `intercom_pin_interactive_only`). The value is in that one response (`Cache-Control: no-store`) and
  nowhere else - not a row, a log line, a cache, telemetry, an error or a replay; tests use a fake sentinel only.
- The editor context lists only the stations the caller manages (an off-chain station is omitted, never greyed),
  `capture_stations` and `pin_generate` for this caller in this session.

## 4. The audit rows (D06, 2026-10-12)

Initiator, request ids (`request_id`, `client_request_id`, the command id), the logical target (the person; a card by its id) and
the outcome; for an update the field NAMES (`fields`); the effect class. Never a value: no name, phone, PIN, card number or mask,
photo, profile value, relay map, count, hash or length. PIN generation is audited (attempt + outcome) without the value.

## 5. The screen

- The person's page (S7 drawer) gets "פעולות" when the page says the caller may change the person (`editable`) and they hold
  manage: off / on, end a visitor's or contractor's access (with WisKey's three reasons), archive / restore (an archived person is
  restored first, never switched on from here), cards (sensitive level), photo (sensitive level + the installation's photo switch),
  delete. Every action that changes access asks one line first; the cards ask inline.
- Each write is one typed request sent once per confirmation. The answer reads: "נשמר · HH:MM" (sync), "נשלח · ממתין לאישור"
  (unknown_effect), "לא נשלח · reason" (a structured not_sent / a 403), "לא בוצע · reason" (refused by name), "לא ידוע אם בוצע ·
  טענו מחדש לפני ניסיון נוסף" (anything else, a dropped connection included). After a write that may have happened the list and the
  page are read again (a read is always safe); nothing is re-sent by the screen.
- A delete is pending until the person's page answers 404 (ten checks three seconds apart, then "בדיקה חוזרת"); when the dialog is
  closed first, the page keeps watching and says "האדם הוסר" when it is confirmed.
- The photo is made in the browser: drawn at most 512 x 512 on white (a JPEG has no transparency), the best JPEG quality that fits
  32 KB, smaller again if needed; a file that is not a picture is refused before anything is sent.
- The editor: the access category (a visitor / contractor needs a responsible person and an end date - checked before sending),
  the timing (always / fixed weekdays / dates, windows, zone; a proposal or system-enforced; a device-enforced one is shown and left
  out of the save), the field level, PIN generation only with `access.pin.generate` (`ctx.pin_generate`), capture only at the
  caller's capture stations; the capture's confirm is read back before the card is said to be there.
- Copy: Hebrew, no platform name (the area is "בקרת כניסה", the classic panel "חלון האינטרקום"), no codes. Five skins through the
  existing tokens only (no skin rule added).

## 6. Decisions and safest defaults recorded

1. The PIN permission is a new `access.pin.generate` (sensitive) rather than reusing manage + sensitive: generation hands a
   credential to a person and the owner asked for a dedicated permission.
2. `sync_now` defaults to `true` on create / update / photo (the owner's stage-1 decision supersedes the earlier Arx DW proposal of
   a default `false`).
3. Archive is gated like any other write (manage on every station) and asks first, like a delete.
4. Capture requires the sensitive level (a card is a credential), on the person's stations and on the capture station.
5. A site-scoped `site_admin` (the old installation-scope editor tests' "sally") now passes the anywhere-gate and is then held to
   the person's stations (before S11 she was refused at the door): the station chain, not the installation, is the scope.
6. The editor nulls the sensitive fields for a names-level manager and never sends them, so a save cannot overwrite a value the
   caller did not see; a hidden employee number is not sent either.
7. No automatic retry anywhere: the card capture cancel is sent once (the backend's abandon watchdog ends a forgotten session).
8. WisKey's `photo_disabled` is answered by name (409 `intercom_photo_disabled`, refused) instead of the generic invalid-request.

## 7. Shared files touched (other slices work next to these)

Backend: `routers/access_control.py` (the editor routes re-gated, `PersonData`), `routers/access.py` (a label), `main.py` (the new
router), `services/intercom_client.py`, `services/intercom_sync.py` (`WRITE_REFUSALS`), `services/wiskey_channels.py`
(`SERVICE_WRITES`), `services/intercom_authority.py` (`PIN_GENERATE`), `services/intercom_capture.py` (`person_stations`),
`roles.json`, `contracts/examples/role-catalog.design.json`; tests `fake_wiskey.py`, `test_wiskey_contract.py`,
`test_intercom_authority.py`, `test_intercom.py`. Frontend: `access-control/access.ts`, `api/intercom.ts`,
`screens/wiskey-people.ts`, `screens/wiskey-person-drawer.ts`, `screens/wiskey-person-editor.ts`, `screens/wiskey-card-capture.ts`,
`screens/wiskey-format.ts`.

## 8. Gaps, not built, open

- Calls / TTS (`access.call`) were not re-gated onto the station chain here; the TTS audit row still holds the message text,
  which D06 would not allow - left for the slice that owns calls.
- The native (device-enforced) timing is shown, not edited, in the screen (the API accepts it, validated); group / profile edits
  stay in the classic panel ("חלון האינטרקום").
- A names-level manager cannot make someone a visitor / contractor unless the person already has a responsible person (that field
  is sensitive).
- The S7 pixel baselines of the administrator's person page (`pixel-wiskey-people` `drawer-*`, `drawer-access`, and `msg-single` /
  `msg-sent` where the page shows behind the message dialog; desktop and phone) change: the page now has the "פעולות" button.
  They need regenerating on the runner; this slice generates no baseline.
- The new pixel spec `pixel-wiskey-people-writes.spec.ts` has no baselines yet (skipped with an annotation until generated).
- `contracts/API_INVENTORY.md` is not regenerated here (seven new routes; `scripts/api_inventory.py` at integration).
- `tests/evidence-wiskey-editor.spec.ts` / `evidence-wiskey-capture.spec.ts` (the SW_WISKEY_FIXTURE opt-in, CR-005) target the
  pre-S7 detail pane and also assert texts this slice reworded; they were already stale after S7 and are not updated here.

## 9. Verification

Backend (local, `.venv` Python 3.12): `test_intercom_writes_s11.py` 41 passed; `test_access_writes_wire.py` 3 passed;
`test_wiskey_contract.py` + `test_wiskey_channels.py` + `test_intercom_authority.py` 109 passed; `test_intercom.py` (the full file,
updated) 6 expected failures fixed, the affected subset 73 passed; `fake_wiskey` + contract 73 passed.
Frontend (local): `tsc --noEmit` clean; node units `unit-people-writes-logic` 15, `unit-people-writes-wire` 4, and the related
existing units (token lint, design tokens, people logic / strings / nav, native tabs, settings index, stations) 112 passed; evidence
`evidence-wiskey-people-writes` 26/26 desktop + 20/20 mobile and tablet; `layout-wiskey-people-writes` full sweep 1/1 (44 runs);
`pixel-wiskey-people-writes` flows 14/14 (no baseline); S7's `evidence-wiskey-people-native` desktop 57 passed / 2 skipped and its
layout guard at 320 / 360 / 390 / 768 2/2 (no regression from the new button). The rest is queued on the runner (see the report).
