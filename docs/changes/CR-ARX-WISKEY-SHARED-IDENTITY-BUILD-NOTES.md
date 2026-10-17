# CR-ARX-WISKEY-SHARED-IDENTITY - build notes (pilot/WISKEYID-BUILD)

Branch `pilot/WISKEYID-BUILD` from `origin/integ/264` @ 5fa03e7a. Design: `docs/changes/CR-ARX-WISKEY-SHARED-IDENTITY.md` (copied from
`origin/pilot/CR-WISKEYID`, unchanged). Owner answers of 2026-10-17 to the CR's 12 questions are binding and encoded in
`services/access_grants.py` (module docstring lists them).

**Everything is OFF.** `access.external_grants` defaults to `off`, and `on` is refused (409 `access_grants_not_permitted`) while
`services/access_grants.GO_LIVE_PERMITTED` is `False` - the owner's separate go-live permit, a code constant (the capture-lease
pattern). The same constant gates the live WisKey engine (`WiskeyServiceEngine` refuses every call with `not_permitted`) and the live
WhatsApp transport (`send_code` sends nothing). No real WisKey, Home Assistant, door, reader or phone was contacted; every test uses
`tests/fake_wiskey.FakeAccessEngine` and `FakeCodeTransport`.

## What was built (phases X1-X4 of the CR, backend)

| Piece | Files |
|---|---|
| Migrations 0108 (`access_person_links`, `access_grants`) and 0109 (`access_grant_notices`, `access_pending_contacts`, `access_station_entrance`, `access_code_sends`) | `smplwise/migrations/0108_*.sql`, `0109_*.sql` |
| The engine port + the live S11 adapter (refused without the permit) | `services/access_grant_engine.py` |
| Links, grants, approval, re-decision, triggers R1-R10, worker (provisioning, revocation, unknown outcomes, code delivery, retention, managers' notices) | `services/access_grants.py` |
| The arrival step on the RFQ work order's handler page (`GET|POST /t/api/arrival`) | `services/access_arrival.py`, `services/tickets/public_routes.py`, `services/tickets/public_http.py` |
| Staff API (`/api/v1/access-grants...`) and settings | `routers/access_grants.py`, `main.py` |
| New permission `access.external.grant` (sensitive, station-scoped, built-in holder `system_admin` only) | `roles.json`, `contracts/examples/role-catalog.design.json`, `routers/access.py`, `rbac.py` |
| Hooks: permission revision bump -> re-decision; ticket done / closed / cancelled / returned -> revoke in the same transaction | `db.py`, `services/tickets/service.py`, `services/tickets/handler_actions.py` |
| Two content-free managers' notification sources | `services/notify_policy.py` (`access.grant_request`, `access.grant_attention`) |
| Fakes and tests | `tests/fake_wiskey.py`, `tests/test_access_grants.py`, `tests/test_access_arrival.py` |

## Owner answers -> code

1. Separate link table, manual match only (`match_link`), no authority union; a link carries ids only.
2. `access.external.grant` on EVERY station of the grant + `access.people.manage` + `access.people.sensitive` (+ `access.pin.generate`
   for a code) on every station of the grant AND of the linked WisKey person; interactive human session only (bearer / internal refused);
   a USR2 local identity is refused unless `access.external.local_approvers` = on.
3. Code only by WhatsApp to a number with `phone_confirmed_via IN ('user','code')`, confirmed within 180 days; separate fixed template
   with no link; nobody in Arx sees it (no "show once" fallback was built - the owner chose option א).
4. `code_due_at` = 18:00 local the evening before `valid_from` (setting `access.external.code_hour`), at once when nearer.
5. `bump_permission_revision` -> the worker re-decides every decided grant; revoked only when the approver lost authority (fail closed
   on error); losing some stations narrows the grant (R9).
6. Ticket `done` (manager or the handler's page), `closed`, `cancelled` -> `on_ticket_ended` in the ticket's own transaction.
7. Vendor picks his persons (first name + ····NN) or adds a technician -> `ticket_contacts` row active = 0 + `access_pending_contacts`;
   approval refused (`contact_pending`) until `POST /access-grants/pending-contacts/{id}/accept`, then `phone_not_verified` until the
   technician confirms his own number by code.
8. `MAX_DAYS_CAP = 14` (constant); the setting may only lower it.
9. Fixed notice on the arrival page (version `n1`), stored in `access_grant_notices`; manual grants need the approver's `told: true`;
   one notice line in the code message.
10. No automatic deletion; `POST /access-grants/links/{id}/delete-person` ("delete now", typed word) for a person Arx created.
11. The code message names the doors (station names), the dates and the hours (the CR's he/en templates).
12. One live grant per person (partial unique index); a widening is held in `pending_json` for a new approval while the approved scope
    keeps working; a narrowing / the same scope merges at once (pushed to WisKey by the worker, PIN kept).

## Deviations from the CR text (recorded, not silently resolved)

- **Grant subject instead of a mandatory link.** `access_grants` names `(subject_kind, subject_id)`; `link_id` is filled at provisioning,
  because a vendor-page request exists before any WisKey person does. The one-live index is on the subject.
- **The PIN is generated at the code's due time, not at provisioning.** Provisioning writes the door map, validity, timing and
  `active = true` with NO PIN (and clears a PIN a matched person had); at the due time the worker runs `pin_generate` + `users/update`
  (revision check) and hands the message to the transport at once. The PIN lives in memory for one call instead of days (smaller
  exposure; a restart only loses a code that was `queued` at that moment).
- **PIN conflicts three times** -> `code_state = not_delivered` (grant stays active, no credential) instead of the whole grant `failed`.
- **A matched person's door map is REPLACED by the grant's** at provisioning (one WisKey person has one door map and one validity window).
  Open question 3 below.
- **R9 (station left the overview)** is implemented only as "the approver no longer holds a station" inside the re-decision; a station
  disappearing from WisKey's overview is not watched (needs the live feed).
- **Revocation of a manual `ticket` grant on reassignment** is caught only when the ticket's status changes; a vendor-page (`rfq_order`)
  grant is also caught by its assignment ending.
- Arabic / Russian contacts receive the English template (native review pending, as the CR says).
- `ticket_events.kind = 'access_request'` is a new timeline kind; the staff timeline renders it as an unknown kind until the UI learns it.

## Not built (scope cut, with the reason)

- **UI** (the grants screen, the approval dialog with the exact message preview, the people/contact screen link actions, the arrival step
  on the public page, Settings): backend first; no screen work was in this task. The public page bundle (`www-public`) is unchanged, so the
  arrival step is reachable only by API until the page learns it.
- **Cards (X5)**: refused with `access_grant_card_not_built` (needs the lease route, OFF).
- **Drift view / rename push (T12)**: `last_pushed_rev` is recorded; no screen compares it yet.
- **Weekly managers' digest of approvals** (T4 proposal) and the denied-attempt alert (4.3, needs WisKey W-c).
- **Contact export with grants** (2.6 rights): not added to `GET /tickets/contacts/{id}/export`.
- **Retention of WisKey persons**: none by design (owner answer 10); grant rows are pruned 12 months after their end.

## Tests

`tests/test_access_grants.py`, `tests/test_access_arrival.py` (fakes only) - see the closing report for the exact runs. Real-device /
real-phone checks are NOT_RUN: a provisioned grant on a real WisKey station, a real keypad entry with the delivered code, offline-device
expiry (W-a), PIN uniqueness / quarantine (W-b), WhatsApp delivery on the owner's account.

## Rollback

Both migrations are additive; older code ignores the tables. Before a downgrade run "revoke all" (`POST /access-grants/revoke-all`) so
provisioned PINs are removed; WisKey's own validity is the backstop.

## Open questions for the owner

1. The PIN generated at the due time instead of at approval (see deviations) - keep?
2. A widening while active: the old scope keeps working until the new approval - or should the old access be suspended meanwhile?
3. Matching a WisKey person who already has staff doors replaces their door map and sets a validity window on them - allow matching
   only persons without other doors, or keep the approver's dialog warning?
4. Who may "delete now" a person: today the grant permission somewhere + `access.people.manage` unrestricted.
5. The arrival step for a regular (non-RFQ) external assignment ("access needed" tick on the assignment) - not built; wanted?
