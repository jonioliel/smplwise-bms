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
- K5 (2.8.0, branch pilot/TECHPRIVACY280): notice version `n2` - third-person notice in he/en/ar/ru, vendor attestation (`NOTICE_ATTEST`), ar/ru code messages (no more English for ar/ru), `acknowledged_for` in the notice audit details. Wording adopted by the lead under the owner's delegation on 2026-10-18; owner sign-off still required before go-live (`GO_LIVE_PERMITTED` stays False).
- Not changed: K7 (optional). Backups: `access.external_grants` and every `access.external.*` limit are in
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

## WISKEYFINAL-280 (2026-10-19) - the composed worker: round 3 + GRANTS-FIX280 intent + WisKey round 4, branch pilot/WISKEYFINAL-280

Base: pilot/WISKEYR3-280 (275c3a008). pilot/GRANTS-FIX280 (f8a17cb79) was cut from 2.7.3 and is NOT merged: its intent (F2, F3, F4, F6)
is ported onto the round-3 worker, so the round-3 protections stay (user_not_found never ends a grant, revoke only on a complete readback AND
the sync status, backoff and hourly re-alerts, 409 `access_person_missing`, server-generated employee_no). Source of the round-4 findings:
`private/planning/wiskey_reply4_answer_2026-10-19/` (WisKey's STATIC review, PROPOSED, NOT_RUN). Everything below runs against fakes only
(`tests/test_wiskey_final280.py`, 41 cases; 36 of them red on 275c3a008). Nothing ran against a WisKey, a station, a door or WhatsApp.

- **F2 / R4-04 narrowing proof.** `access_grants.scope_proven(readback, scope)`: the COMPLETE scope - door map KNOWN (fail closed: an absent
  `doors_known` is not "carried"), active, enabled stations and relays equal to the grant's, no group, the validity window AND the timing
  schedule. `push_narrowing` reads first (a scope already there - a write whose readback failed - is proven without a second write), writes, reads
  again, and clears `needs_push` only by a compare-and-set on the row revision the pass read (`push_superseded` otherwise). An unprovable readback
  revokes the grant (`station_changed`). `pushed` means the CENTRAL desired state was read back (`central_only: true`); `EnginePerson.stations_synced`
  (every enabled assignment `synced` with applied_revision == desired_revision) is recorded beside it, never taken as physical completion.
  `deliver_code` uses the same predicate before a PIN is generated.
- **R4-03 unknown settlement.** `resolve_unknown` writes its verdict only by a compare-and-set on the row revision it read; a narrowing that landed
  while the read was out leaves the grant `unknown` (audit `scope_moved`) for a fresh read against the CURRENT scope. `request_grant` and the
  re-decision set `needs_push` for an `unknown` row too; a fresh read that shows the earlier, broader scope of such a row activates it only with
  `needs_push` kept, so the narrowing is written and proven on the next pass. Anything else fails the grant.
- **F3 / R4-05 origin guard at every write.** Approval (after the caller's authority) and provisioning refuse a person Arx did not create
  (409 `access_person_not_ours`; a link matched after approval fails the grant with `pushed` restored - nothing written). `resolve_unknown`,
  `push_narrowing`, `strip` and `deliver_code` re-read the grant's link and never write through a matched one: the authority is withdrawn in Arx
  (`failed`), a grant that may have reached WisKey stays `revoking` with no WisKey call (audit `revoke_retry code=person_not_ours`, hourly alerts) -
  the matched person is reconciled by hand; no automatic "done" (open item, see R4-10).
- **F4 / R4-06 one process, never two writers.** Precondition "workers=1" (`python -m smplwise` hands uvicorn an app object). Checked by an exclusive
  non-blocking OS lock on ONE canonical path, `<db dir>/.<db name>.access-grants.lock` (hidden so no `<db name>*` sweep reads it while locked).
  Every entry point (`run_once`, `run_grant`) needs the lease (taken when free; a standby process takes over once the owner is gone and only then
  runs the start-up rewrite). `stop()` gives the lease up only when no pass can still be writing: a pass that outlives the bounded wait keeps it and
  drops it itself when it ends. The lock does not cover API-triggered work outside the worker (`delete_person_now`, editor writes) - those are
  guarded per person by R4-07.
- **F6 vendor page.** `access_arrival.request` refuses 409 `arrival_other_ticket` when the person's live grant belongs to another ticket /
  assignment or to no ticket; nothing is written (the public transaction rolls back).
- **R4-07 per-person write gate.** `IntercomSync._admit` checks the target's gate AND registers the write as in flight in one step under the gate's
  lock, before the lane slot is waited for; a second write to the same person (or the engine's readback, or a PIN generation) while one is out is
  refused 409 `intercom_outcome_pending`, nothing sent. Targets: every people write with a person id (editor update / delete / archive / set_active /
  temporary_cancel / cards, card-capture confirm - added - and the grant engine's apply / strip / delete), the readbacks (`users/get` of the editor,
  of the grant engine and - added - of the read adapter's person pages). `users/pin_generate` is a read in WisKey: it carries no target (it must not
  count as the settling readback) but both the editor route and the engine refuse it while the person's gate is closed. `users/create` has no person
  yet and is not idempotent (a wire id is not a business key) - unchanged, stated.
- **R4-08 reserved frame keys.** `wiskey_channels.guard` refuses a keyword `type` / `id` (IntercomError `reserved_frame_key`, nothing sent) and
  `ha_client.call` refuses them too and serialises its own `id` / `type` last (`{**kw, "id": mid, "type": msg_type}`).
- **R4-09 read adapter completeness.** `intercom_adapter.project_person` uses `intercom_sync.person_scope`: `access_known`, `stations_known`,
  `redacted_fields` are served; a field-named access redaction (`assignments`, `group_ids` ...) or a malformed marker withholds the category
  (assignments null, never an empty list). `intercom_authority.view_person` adds `stations_known`, false whenever WisKey's record is restricted or the
  principal does not see every assignment.
- **R4-13 employee_no.** Unchanged from round 2 and now tested: create omits it, the link stores the value the engine returns, update never sends it.
- **R4-01 / R4-02.** The composed worker is the ONE worker (`services/access_grants.py`, imported by the router); the engine port
  (`services/access_grant_engine.py`) and the editor callers (`routers/access_control.py`, `routers/access_control_writes.py`,
  `services/intercom_writes.py`, `services/intercom_adapter.py`) are in the same tree for the round-5 review.

Open items (not built): an administrative acknowledgement for a grant stuck in `revoking` (person gone outside Arx, or a matched person reached
by an older build) that never claims physical removal; a readable central sync status for `revocation_pending` (the live engine answers UNKNOWN,
so a live revoke stays `revoking`); persistence of the in-memory write gate across a restart (a restart forgets an unsettled write - the worker's
own start-up rewrite moves a cut provisioning to `unknown`, editor writes have no such record).

## WISKEYFINAL2-281 (2026-10-19) - WisKey round 5 (Part A, R5-A1..R5-A7), branch pilot/WISKEYFINAL2-281

Base: pilot/WISKEYFINAL-280 (f1ef57d5). Source: `private/planning/wiskey_reply5_answer_2026-10-19/PART_A_STATIC_REVIEW.txt` (WisKey's STATIC
review, PROPOSED, NOT_RUN). Owner/lead decision: accept R5-A1..A7. Fakes only: `tests/test_wiskey_final281.py` (50 cases, 44 red on f1ef57d5).
Nothing ran against a WisKey, Home Assistant, a station, a door, a reader or WhatsApp. `GO_LIVE_PERMITTED` stays False.

- **R5-A0** (delivery: flattened worker/router name collision) - nothing to build on the Arx side.
- **R5-A1 unknown create without a link.** Every worker `users/create` is journaled (`intercom_write_ops`, target `create:grant:<id>`): an
  `intent` row is written in the SAME transaction that marks the grant `pushed`, moved to `dispatched` and committed before the call, and
  closed `ok` (with the returned person id, in the link's transaction) / `refused` / `not_sent` / `unknown`. A grant with no link is decided
  by that journal (`create_verdict`): a create that answered (or a recovered target) is linked and handled like any other person; one that
  provably never landed (refused / not sent / never dispatched) closes the grant WITHOUT a revocation claim (audit `access.grant.closed`
  `no_person_created`, not counted as `revoked`; a refused create at provisioning restores `pushed`, so it ends at once); anything else -
  an unresolved create, or a legacy `pushed` grant with no record at all - stays `revoking` with NO WisKey call (`revoke_retry`
  `create_unresolved`, backoff, hourly manager alerts): never `failed` / `revoked`, never audited `access.grant.revoked`. No second create for
  a subject while one is unresolved (`access.grant.provision_held`). Hook: `access_grants.attach_recovered_person(db, grant_id, person_id)`
  (service level, no route) links a recovered target to an UNRESOLVED create of that grant, after which the normal revoke (read, strip,
  readback, sync status) runs. No WisKey idempotency key or employee/PIN workaround is assumed.
- **R5-A2 the whole timing policy.** `EnginePerson.timing_policy` keeps mode / schedule / bindings as returned (an absent key stays absent);
  `scope_proven` requires exactly the policy a grant push writes (`requested_policy`: `{mode: "ha", schedule, bindings: {}}`, or no policy
  without timing) and `readback_covers` only compares a policy of that form. A native-mode policy or bindings with the same schedule is
  NOT proven (fail closed). The schedule is compared EXACTLY: the requested one is already in `intercom_writes.timing_draft` normal form, but
  WisKey's stored-policy normaliser is not an accepted contract (ACR5-02 is a proposal), so Arx does not re-normalise the readback - an
  equivalent but reordered schedule fails closed (never widened).
- **R5-A3 presentation.** `present()` serves `grant_state`, `needs_push`, `pending_sync`, `scope_verified`, `doors_state` (`desired` until a
  fresh central readback proved the scope, then `verified_central` - never a station-sync claim) and the attention `sync_pending` for an
  active grant with a narrowing still to push. The arrival reply keeps `state: approved` (a human decision) and adds `grant_state`,
  `pending_sync`, `scope_verified`.
- **R5-A4 incomplete before-scope.** `intercom_authority.person_station_ids` answers None (unknown) when the record says `stations_known` /
  `access_known` false, so `check_person`, the messaging caps and the people views require an unrestricted grant (or refuse / hide);
  the grant approval and the manual match use the linked person's stations only when the record is complete (`doors_known` and
  `overrides_known`), else every involved permission must be held installation-wide. A record WITHOUT the marker keeps the old reading
  (every projection Arx builds carries it).
- **R5-A5 signed capture-lease confirm.** `_lease_confirm` checks the person's gate before signing, then takes the same atomic per-person
  admission (`IntercomSync.begin_external`, after the attempt row's commit) and records the outcome (`end_external`; `unknown` keeps the
  person blocked until a fresh readback). The capture DTO, lease duration, authority and transport are unchanged.
- **R5-A6 durable intent and recovery hold.** New table `intercom_write_ops` (migration **0121**, provisional 0119 on the branch, see below) and
  `services/intercom_write_journal.py`. `IntercomSync` records every targeted person write before dispatch (`dispatched`) and its outcome
  after; a journal that cannot record refuses the write (nothing sent). An unresolved row (an `unknown` outcome, or a `dispatched` row of
  another process - restart or standby takeover) blocks the next write to that person (409 `intercom_outcome_pending`) and also PIN
  generation; a fresh targeted readback settles it only when it STARTED after the row's call was over - for a row of a process that is
  gone, after `HOLD_S` (75 s, the transport's own call limit) past its start; until then the gate answers `outcome_pending` and the grant
  engine does not read. No PIN, hash, card number, name or phone is stored. Installed in `main.py` at start-up (None in tests that do not
  start the app). Limit: a fresh snapshot after the hold is still not a distributed exactly-once proof.
- **R5-A7 malformed input.** `person_from_raw`: the id must be a non-empty string and the revision an int that is not a bool (else not a
  person); a malformed assignment row / lock list / `enabled` / override value / group id makes the door map UNKNOWN (never skipped, so it
  cannot shrink a known map); bool bookkeeping revisions are missing; no enabled assignment gives `stations_synced` None (no evidence).

**Migration number.** Provisional `0119_intercom_write_ops.sql` on the branch (then the next free number after 0118). Renumbered at
integ/281 to **`0121_intercom_write_ops.sql`**: 2.8.0 shipped 0119 (elevator history / alerts) and 0120 (manager-dashboard indexes), so
`scripts/release_check.py` (contiguous 0001..N) passes with 0001..0121. The content does not depend on the number.

**Hooks left for the proposed WisKey contracts (NOT built - ACR5-01..04 are proposals, not accepted on the wire):** ACR5-01
`users/access_state` -> `Engine.revocation_pending` (still None) only. CORRECTED in WISKEYFINAL3-281 (R6-A5): access_state carries no
purpose / correlation / ownership evidence and can never feed create recovery (`_attach_recovered_person`) or `create_verdict`;
ACR5-02 `schedules/normalize_user` -> `access_grants._policy_is` (today exact equality); ACR5-03 presence diagnostics -> the open
"externally deleted person" acknowledgement (decision (a), still open: `revoking` with hourly alerts); ACR5-04 feature dry-plans -> nothing
consumes them yet.

## WISKEYFINAL3-281 (2026-10-19) - WisKey round 6 (Part A, R6-A2..R6-A5), branch pilot/WISKEYFINAL3-281

Base: pilot/WISKEYFINAL2-281 (15cb9f6b8). Source: `private/planning/wiskey_reply6_answer_2026-10-19/PART_A_STATIC_REVIEW.txt` and
`ARX_CHANGE_REQUESTS_R6.json` (WisKey's STATIC review, PROPOSED, NOT_RUN). Scope: only the Arx-side changes that need no new WisKey
protocol (ACR6-01, ACR6-03, ACR6-04). Fakes only: `tests/test_wiskey_final3_281.py`. Nothing ran against a WisKey, Home Assistant, a
station or a door. `GO_LIVE_PERMITTED` stays False; the extended service identity stays locked (`EXTENDED_GO_LIVE_PERMITTED` False).
Migration `0121_intercom_write_ops.sql` (provisional 0119 on the branch, renumbered at integ/281) is unchanged; no new migration.

- **R6-A2 / ACR6-01 atomic admission.** `WriteJournal.admit(target, op, lane)` is ONE write transaction (`BEGIN IMMEDIATE`, SQLite's
  single write lock, which also excludes other processes): it reads every unresolved (`dispatched` / `unknown`) row of the target and
  inserts exactly one `dispatched` intent only when none blocks; else it answers `outcome_pending` / `readback_required` with nothing
  inserted (the caller refuses `intercom_outcome_pending`, outcome `not_sent`); a journal that cannot be opened answers
  `journal_unavailable` (fail closed, nothing sent). `IntercomSync._journal_admit` (editor writes, grant engine writes, the signed
  capture confirm via `begin_external`) uses only `admit`; the split `blocking()` + `begin()` shape is gone from the product path
  (`begin` stays as an unchecked helper for tests). Tests: a deterministic two-instance counterexample (two `Database` objects on one
  file, a barrier between check and insert) shows the old shape admits both; the same barrier with `admit` admits exactly one and the
  other is refused with no row; two `IntercomSync` instances on one database send exactly one frame; an unresolved row refuses with no
  side effect; a source check that `_journal_admit` no longer splits. Open risks: the grant worker's `users/create` intents
  (`create_intent`, keyed by grant) are already written in the grant's own transaction and are not changed here; the per-write DB cost
  (one write transaction per admission) was not measured.
- **R6-A4 / ACR6-03 parser.** `person_from_raw` now requires a positive non-bool record revision (0 / -1 -> not a person), an explicit
  boolean `active` (missing / non-bool -> map UNKNOWN, and never "inactive" revoke proof), and validates EVERY assignment row, disabled
  ones too: explicit boolean `enabled` (missing is no longer "disabled"), a lock list of supported relays only (`RELAYS` = {1, 2}; 0 / 3
  -> unknown), present bookkeeping revisions positive ints (null still = not applied yet); group ids and override keys must be non-blank
  strings. Any malformed field makes the door map UNKNOWN (`doors_known` / `overrides_known` False, `stations_synced` None) - never
  dropped. Tests: missing enabled (alone and next to a valid row), disabled with bad / missing / relay-3 locks, revision 0 / -1 (record
  and bookkeeping), relay 0 / 3, blank station / group / override ids, missing / non-boolean `active` (never `_revoked`), plus valid
  shapes that stay known. Open risk: the authorization projectors in `intercom_sync` (`person_scope` / station projection, R6-A4's
  "equivalent completeness" note) were not changed in this round.
- **R6-A3 / ACR6-03 label - chosen option: never label verified.** The simpler, safer of the two options: no proof revision is
  recorded anywhere (that needs a schema column and a fresh post-write read on the provisioning path), so `sync_status` now answers
  `scope_verified: false` for every grant and `doors_state` is `accepted` for an active grant with no push outstanding (WisKey accepted
  the central write; not re-read) and `desired` for the other live states; `verified_central` is no longer served. This covers normal
  provisioning and legacy active rows alike. The arrival reply now carries the same five fields as `present()` (`grant_state`,
  `needs_push`, `pending_sync`, `scope_verified`, `doors_state`) from the one `sync_status`. Tests: the label table, a provisioned grant
  is `accepted`, the arrival reply shape; the round-5 narrowing test now expects `accepted`. Open: recording a proof revision after a
  complete fresh post-write read that satisfies `scope_proven` at the current grant revision (invalidated on any scope change, legacy rows
  unknown until read) is the later, stronger option; no UI consumes `doors_state` yet.
- **R6-A5 / ACR6-04 recovery helper.** Renamed to the private `access_grants._attach_recovered_person(db, grant_id, op_id,
  wiskey_person_id, *, actor, evidence_ref, request_id=None)`; no public name, no route, no product caller (test-enforced). It requires an
  Arx system administrator (`is_system_admin`; None / system / contact actors -> 403), a per-operation evidence reference (8..128 safe
  characters, audited with the op id), and the `op_id` of THIS grant's one unresolved create; it refuses `access_create_ambiguous` when
  more than one create of the grant is unresolved (several lost creates are never collapsed onto one person) and reconciles only that
  operation. It reads nothing from WisKey and never infers from presence. The misleading comments that named `users/access_state` as a
  future recovery feed (the helper's docstring and the hooks paragraph above) are corrected: access_state carries no purpose /
  correlation / ownership evidence. Open: the helper records an administrator's claim, it cannot verify the evidence itself; a reviewed
  recovery workflow is still required before anything calls it.

**Not in scope (WisKey designs these next round):** R6-A1 / ACR6-02 remote-completion fence, reading `users/access_state`, schedule
normalisation, any new WisKey command. **Open risk, unchanged on purpose: the 75 s hold (`HOLD_S`).** A local call end or the 75 s
timer is still what lets a fresh readback settle a row of a process that is gone; it is NOT proof that the remote handler ended, and a
wall-clock jump can expire it early (forward) or hold it indefinitely (backward). Until ACR6-02 is designed, an unknown write settled after
the hold is not an exactly-once or completion proof.
## SHAREDID-293 - the shared identity screen (owner decisions 2026-10-20, pilot/SHAREDID-293)

Server (`services/access_external.py`, hooks in `services/access_grants.py`, routes in `routers/access_grants.py`) and the screen
(`frontend/src/screens/access-external.ts`, `frontend/src/access-external/`). Mockup: private/planning/mockup_shared_identity_2026-10-20.
PROVISIONAL migration **0128_access_external_identity** (renumber at integration: 0124-0125 2.9.2 integration, 0126 TEMPCTL3, 0127 PERMOVR).

- **Decision 1 - "WisKey" in the UI.** Every text of the screen and the identity card names WisKey, never "the intercom system" (a unit test
  scans the four languages).
- **Decision 2 - "Active - verified" only with stored read-back proof.** This supersedes the R6-A3 "never label verified" choice above with
  its stronger option: `access_grants.scope_proof` (sha256 of the scope) + `scope_proof_at` are written in the same transaction as every
  verdict a FRESH read that satisfies `scope_proven` backs (an unknown outcome settled, a narrowing pushed) and by the hourly
  `verify_pass` (a read only, never a write; compare-and-set on the row revision, which the pass does not bump). `scope_is_proven(g)`:
  active, no push outstanding, stored digest == digest of the scope now - so any scope change invalidates it and legacy rows are unproven
  until read. Only then `scope_verified: true` and `doors_state: verified_central` (the central record; never a station claim). A mismatch
  clears the proof and is audited (`access.grant.verify` outcome `mismatch`) - a digest gap. A person not found on the verify read withdraws
  the authority (`revoking`, `wiskey_missing`), the R3 rule.
- **Decision 3 - manual "confirmed gone".** `POST /access-grants/{id}/confirm-gone`: an interactive system administrator, a grant in
  `revoking` whose link is `wiskey_missing`, three ticked checks, the typed word (נמחק) and an 8..128-character reference without a phone
  number. The grant ends as `ended` (never `revoked`) with an `access_grant_closures` row; the hourly alerts stop; every manager gets
  `access.grant_closed_manual`. The reference is kept in the closure row only (the audit has ids) and shown to system administrators
  only. `watch_gone` reads the person once an hour: found again -> `reappeared_at`, an attention notice at once, and the grant goes back to
  `revoking` (when the subject has no other live grant and the link exists) so the normal strip runs.
- **Decision 4 - weekly digest.** Source `access.weekly_digest` (managers, content-free: "a new digest is ready"); the channel setting IS
  that source's notification policy (`app` = app + phone, `app_whatsapp` adds WhatsApp); day/hour settings (default Sunday 08:00, the
  installation zone, DST-safe); sent once per period, a period more than 6 h late is skipped (audited), never a burst. `GET
  /access-grants/digest`: the last full period over the grants the caller may see (counts, slow revocations > 2 min, approvers, gaps:
  name drift, scope mismatch, persons Arx created with no live grant). WisKey's own name values are never stored (digests only), so a
  name gap says only that the names differ.
- **Decision 5 - name drift.** `access_person_links.name_seen` / `name_pushed` (digests). `POST /access-grants/links/{id}/push-name`
  (people.manage on every station of the live grant, installation-wide when none; interactive; a person Arx created only) and the
  automatic push (`name_sync` = auto; retried after 15 minutes when it did not land). A matched person is never renamed.
- **Decision 6 - placement.** `access.external.placement` (access | tickets | both), readable by everyone in GET /settings, written only by a
  system administrator through PUT /access-grants/settings; the tab follows (`shell/nav.ts`), notification links follow.
- **Decision 7 - attach a recovered person.** `POST /access-grants/{id}/attach-recovered` over the private helper (unchanged guards):
  system administrators, interactive; every refusal - the helper's included - is audited with its code (owner Q3 of 08:10). The identity
  card shows the op id to system administrators only. The R6-A5 "no product caller" test now pins this route as the ONE caller.
- **Extended service identity stays LOCKED** (shown as a locked row; nothing here touches it).
- Not built in this slice: the manual "request access" form (no approved design for its dialog; requests arrive from the vendor page),
  an "offline" banner (the list endpoint carries no WisKey connectivity signal), the 75 s hold countdown of the mockup's unknown state
  (the worker keeps its own holds; "read back now" asks the worker), per-grant audit history (the drawer derives "what happened" from
  the row's instants).
## GRANTSMIN-295 - the Arx-only leftovers (pilot/GRANTSMIN-295 from pilot/SHAREDID-293 @ ee2f6a1b0)

Backlog item `grants-minor-leftovers` (private/planning/BACKLOG_RECONCILED_2026-10-20.md). SHAREDID-293 already shipped the weekly digest
(decision 4), the name-drift detection and push (decision 5), confirm-gone and attach-recovered; this slice adds what was left. No
migration (everything reads tables 0107/0108/0128). `GO_LIVE_PERMITTED` stays False; fakes only (`tests/test_grantsmin_295.py`); nothing
contacts WisKey, a station, a door or WhatsApp.

- **Drift view (CR 2.3 / T12, the X1 "drift view").** `GET /access-grants/drift` (`access_external.drift`): per person, where Arx and WisKey
  differ, built ONLY from what Arx stored - the read-back proof and the last `access.grant.verify` outcome, the name digests, the link
  state. It never reads WisKey and never serves a WisKey value (its name is kept as a digest). Kinds, most urgent first: `missing`
  (link `wiskey_missing`), `scope` (the last complete read-back mismatched), `unknown`, `sync_pending` (a narrowing not yet proven),
  `name`, `unverified` (accepted, no stored proof), `idle_person` (a person Arx created with no live grant). Visibility: the person's
  current grant must be visible to the caller (`access_grants.visible`; with no live grant, one of its grants); a link with no grant at
  all only with people.manage installation-wide. Per row `can.push_name` (the same authority as `push_name`, offered only for a name
  difference) and `can.read_now` (the same authority as `read_now`). The screen: a side panel (the three most urgent) and a dialog with
  "push the name", "read back now" and "open the grant"; `#/wiskey/external?drift=1` opens the dialog. Off -> empty, `enabled: false`.
- **The external-access CSV.** `GET /access-grants/export.csv?lang=he|en&live=` (`access_external.export_rows`): the grants the caller may
  see (every row through `visible`), newest first, at most 5,000 (413), one export a minute per user (429 `export_rate`), UTF-8 + BOM,
  every cell quoted and through `text_hygiene.csv_cell` (formula guard), times in the installation's zone, the screen's state words.
  The number is never more than BOTH rules allow: nothing below people.sensitive on every station of the grant; the screen's mask
  (····NN) at that level; the full number only when the directory would also show it to this caller (`tickets/contacts.full_phone_for`).
  The code delivery state likewise only at the sensitive level. Gate: the grant permission or people.read somewhere, or
  tickets.configure; a refusal is audited (`access.grant.export` denied `no_binding`); an export is audited with the row count only
  (no names, no numbers). The screen's "Export CSV" button downloads it (Hebrew headers for he, English otherwise; ar/ru columns are
  English like the tickets export).
- **The person's data export (CR 2.6 "Rights").** `GET /tickets/contacts/{id}/export` gains `access`: the link's origin, state and time, and
  every kept grant (window, timing, doors by name, state, end reason, source, the notice acknowledgements). Never WisKey's ids, the
  employee number, a PIN (Arx holds none) or the closure's free-text reference. A person without access: `{"link": null, "grants": []}`.
- **Not built:** the denied-attempt alert (needs WisKey W-c, out of scope by instruction). The CSV is not offered on the contact
  directory screen (the per-person JSON export already is). Arabic / Russian CSV headers (English is served for them).
