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
| Migrations 0107 (`access_person_links`, `access_grants`) and 0108 (`access_grant_notices`, `access_pending_contacts`, `access_station_entrance`, `access_code_sends`) | `smplwise/migrations/0108_*.sql`, `0109_*.sql` |
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

## HARDEN271 (2.7.1, `pilot/HARDEN271` from `integ/270`) - review K1-K4, K6 fixed; still `GO_LIVE_PERMITTED = False`

Review: `private/planning/RELEASE_270_REVIEW_CONSOLIDATED.md` section 2. Negative-first tests: `tests/test_harden271_access_grants.py`
(7 cases; 6 red on integ/270 before the change, all green after).

- **K1** - a vendor-page arrival whose ticket has no station placement and no "entrance for external people" station is refused at request
  time: `POST /t/api/arrival` 409 `no_doors_suggested`, and `access_grants.request_grant` refuses an empty door map for every caller
  (409 `no_doors_suggested`). Nothing is written (the public transaction rolls back: no grant, no pending technician, no notice row).
- **K2** - `approve`, `refuse`, `revoke`, `rotate`, `provision_now` answer the uniform 404 `access_grant_not_found` for a grant the caller
  cannot see (`visible()`; revoke also admits `access.people.manage` on one of the grant's stations, R2) before any authority, state or
  revision answer. Two existing "cannot" tests now expect 404 instead of 403 (`g2`, a viewer).
- **K3** - `approve()` checks the switch, the session kind, the local-approver rule, visibility and the approve permissions on the stations
  being approved BEFORE `engine.get_person()`; an unauthorised caller gets an audited 403 and Arx issues no WisKey read.
- **K4** - a widening approved while the grant is `provisioning` sets `needs_push`, and `Worker.provision` marks `needs_push` whenever the
  row's scope moved while its write was out; the next pass pushes the row's scope.
- **K6** - `access_arrival._order()` reads only the RFQ's own `order_created` rows (`ticket_rfq_events WHERE rfq_id = ?`, index
  `idx_ticket_rfq_events_rfq`), found through the quote's `rfq_vendor_id`.
- Not changed: K5 (wording, counsel), K7 (optional). Backups: `access.external_grants` and every `access.external.*` limit are in
  `backup.SETTINGS_KEEP` (never exported, never restored).

## WisKey answers (static source reading, 2.8.0 adapter fixes)

Statements WisKey gave for the access engine port (`services/access_grant_engine.py`). They come from WisKey reading its own source, not from a run against a live WisKey (NOT_RUN).

- After a write is dispatched, its state on the Arx side is `sent_unknown` until a fresh read says otherwise. Cancelling is not a rollback: a cancelled write may still have landed.
- Sync completion is known only from the `desired_revision` / `applied_revision` readback, never from the write's acknowledgement.
- `users/delete` answers `accepted` and leaves a `delete_pending` tombstone; the person and its station removals are not gone at that point.
- `users/create` for category contractor/visitor needs a valid timezone-aware `valid_from` < `valid_until` (1970-01-01 .. 2037-12-31T23:59:59Z, normalised to UTC, fractional seconds dropped) even when `active` is false (`invalid_validity` otherwise). `phone`, `responsible_person` and `access_purpose` are never sent as null (`access_purpose` may be an empty string; `responsible_person` is non-empty after strip). Name: at most 32 Unicode code points. `employee_no`: ASCII `[A-Za-z0-9_-]`, 1..32.
- `door_permissions: {}` does NOT remove existing grants, and the person result (`ManagedUser.public`) carries no `door_permissions`.

Arx adapter behaviour that follows: the create payload always carries a validity pair; the revoke write (`strip_payload`) no longer sends `door_permissions: {}` and a revoke is reported done only when a readback shows the person inactive, PIN cleared and the door map known and empty; a person record without a door map is `doors_known=False` (unknown, never "no doors"), so the revoke stays `revoking` and is retried.

Open questions for WisKey: which call really removes a person's door grants (and whether `door_permissions` on update replaces or merges per station, which also decides whether a narrowing `apply` removes a dropped station); whether any read returns the door map (without it the live revoke cannot complete).

## WisKey answers, round 2 (2026-10-18) - WisKey-stated, source-derived, NOT_RUN on hardware

Source: `private/planning/wiskey_reply2_answer_2026-10-18/` (WisKey's static reading of its pinned code, c0b2d94c; no command was sent, no
response captured). The Arx service-channel wrapper (`intercom_client` / `intercom_sync`) was NOT reviewed by WisKey. Everything below is
implemented against the fake engine only (`tests/fake_wiskey.py`); nothing ran against a WisKey, a station or a door.

- **Revoke-all** is one revision-checked `users/update` with `sync_now` and `data = {group_ids: [], permission_overrides: {}, active: false, pin: null}`.
  `door_permissions: {}` does not remove grants; `permission_overrides` is never combined with legacy `assignments`. `pin: null` is the explicit PIN
  clear (omitting `pin` keeps it, `""` is invalid) - the ONE allowed null; `phone`, `responsible_person`, `access_purpose` are never null. A successful
  update answers the public person object directly (revision + 1). `strip_payload()` sends exactly this.
- **Narrowing** replaces the COMPLETE `permission_overrides` dict: the dropped station is set to `"deny"`, every other personal entry is kept (a one-entry
  dict is not a merge). Dropping a station from `door_permissions` does not revoke it; `door_permissions` replaces the lock list of each supplied station
  only; an empty lock list (`unmanaged_lock`) and a key outside the resolved stations (`invalid_assignments`) are rejected. `plan_overrides()` /
  `push_scope()` build the replacement (new stations get `"allow"`); on a restricted projection nothing is sent (`not_sent projection_restricted`).
- **Reading the door map**: `users/get` returns `ManagedUser.public` with `assignments` (config_entry_id, enabled, allowed_locks, desired_revision,
  applied_revision, sync_state, last_error), `group_ids`, `permission_overrides`; there is no `door_permissions` key. Arx projects enabled assignments ->
  `allowed_locks` (disabled rows keep historical locks and are skipped). The result is UNKNOWN (`doors_known=False`, never known-empty) when
  `redacted_fields` names an access field or `assignments` / `permission_overrides` / `group_ids` are missing; `pin_known=False` when credential fields may be
  unreadable (then `pin_configured=false` proves nothing). A person missing from a scoped list is not proof of absence (open question below).
- **After a revoke there is no revision row**, so an empty `assignments` map is not proof of physical removal. The worker keeps the grant `revoking` until a
  fresh central readback shows the expected state (door map known and empty, no groups, no overrides, inactive, PIN known cleared) AND
  `Engine.revocation_pending()` (central sync status) reports no pending revocation. It never reports revoked from the update result. The live engine
  returns UNKNOWN for the sync status (no confirmation endpoint is asserted; Arx's overview projection drops revocations), so a live revoke stays `revoking`
  until the pinned service-channel source shows where it can be read.
- **employee_no** is server-generated (nine digits) when omitted on create and retained when omitted on update; it can change before `identity_locked`.
  Arx omits it on create, stores what the server returns (`EnginePerson.employee_no`) and never sends it on update; it is not assumed immutable.
- **Revoke loop (Fable review H2/F1)**: after one successful write, retries are reads only (no repeated `users/update` while the readback shows nothing left
  to remove or the projection is restricted); exponential backoff 15 s ... capped 5 min using `revoke_attempts` / `updated_at`; the managers are alerted at
  2 minutes and again each hour in `revoking`.
- **F5**: `deliver_code` and `resolve_unknown` honour `doors_known` (unknown stays unknown: no code, no verdict); with the assignments projection a real WisKey
  yields a known door map.

Open questions for WisKey: where the central sync status / pending revocations can be read through the service channel (and its pinned `intercom_client` /
`intercom_sync` source); whether `users/get` of a person outside the caller's scope answers `user_not_found` (Arx maps that to "WisKey person missing").

## WisKey round 3 (2026-10-18) - R3-03..R3-08, branch pilot/WISKEYR3-280

Source: `private/planning/wiskey_reply3_answer_2026-10-18/` (WisKey's static review of `intercom_client.py` / `intercom_sync.py` at 2.7.2 and its own pinned
source c0b2d94c; PROPOSED, NOT_RUN). Implemented against fakes only; nothing ran against a WisKey, a station or a door.

- **R3-03 scope through the projection.** `intercom_sync.person_scope` reads WisKey's `redacted_fields` (category names `access`, `credentials`, `phone`, `photo`,
  `profile`) and `operator_editable`. Either marker means a projection for a restricted caller whose assignments may be station-filtered (even with an empty
  `redacted_fields`), so `stations_known` is false. `project_person` / `project_person_editor` keep `stations: []` but add `access_known`, `stations_known`,
  `credentials_known`, `redacted_fields`, `operator_editable`, `access_category` (null when withheld); a withheld PIN flag / phone is null, never false / "";
  the editor extras show category "unknown" and null responsible person / purpose when `access` is withheld (WisKey's blank "staff" is not the person's).
  `person_from_raw` uses the same reading, so `Worker._revoked` never counts a restricted or redacted readback.
- **R3-04 profile codes.** `profile_required`, `profile_value_invalid`, `profile_value_not_unique` are pre-storage refusals of every `_USER_WRITE_REFUSED`
  command (not users/delete): 422 `intercom_profile_required` / `intercom_profile_invalid` / `intercom_profile_not_unique`. `profile_issue` stays unknown.
- **R3-08 strict reads.** `intercom_client._result` and `intercom_adapter._ask` accept only `success: true` / `false`; anything else is `invalid_response`.
  A committed write whose answer the projection rejects stays `unknown` (unchanged, now tested, also for late answers).
- **R3-06 / R3-07 no retry without a fresh readback.** `IntercomSync.action(..., target=person:<id>)`: after an `unknown` outcome the next write to that
  person is refused here, nothing sent (409 `intercom_outcome_pending`, `details.wiskey_code` `outcome_pending` while the call is still out,
  `readback_required` once it is over) until a `command(..., target=)` read that STARTED after the call was over has answered (a record or `user_not_found`).
  Wired into the editor writes (update, delete, archive / unarchive / set_active / temporary_cancel / cards) and their reads, and the grants engine
  (`get_person` refuses `not_sent outcome_pending` while the write is out, so `resolve_unknown` decides nothing on such a read).
- **R3-06 late results.** When the 35 s local wait runs out, the call is still not cancelled; its eventual answer is classified (`ok` / `refused` /
  `unknown`) into `IntercomSync.late_results()` (ids and codes only, last 50) and an optional `on_late` callback. It is diagnostics: the HTTP 504 is never
  rewritten and the state is still taken from the fresh readback.
- **users/get `user_not_found` is not proof of absence.** The worker no longer ends a grant on it: provisioning moves the grant to `revoking`
  (reason `wiskey_missing`, link marked) instead of `revoked`; the revoke path stays `revoking` (backoff, hourly manager alerts) instead of finishing; an
  approval whose linked person is not found is refused 409 `access_person_missing` (the approver's authority over the person's other stations cannot be
  checked). Consequence: a person really deleted outside Arx leaves its grant `revoking` with hourly alerts (no automatic end; a manual "confirmed gone" path is NOT built - open item).
