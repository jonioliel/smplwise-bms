# CR-038 slice 9 - cost claims (D31 / D32): build notes

Branch `pilot/TICKETS-s9` (from `pilot/TICKETS-s1` @ 11f21002, with `pilot/TICKETS-s4` and `pilot/TICKETS-s6b` merged). Spec:
`docs/changes/CR-038-TICKETS-MODULE.md` section 11A (on `pilot/TICKETS-spec`). Frontend work happened on two sub-branches merged
back here: `pilot/TICKETS-s9-public` (the vendor-page claim step) and `pilot/TICKETS-s9-ui` (the manager side) - their own notes:
`CR-038-S9-PUBLIC-CLAIM-UI.md`, `CR-038-S9-MANAGER-UI.md`.

## 1. Module map (backend)

| File | What |
|---|---|
| `migrations/0083_ticket_costs.sql` | claims, revisions (immutable), decisions (append-only), files, revision files; cost columns on departments / contacts / assignments / tickets |
| `services/tickets/money.py` | the arithmetic - integers in minor units only, per-line half-up rounding, VAT excluded / included / none, caps |
| `services/tickets/costs.py` | the service: mode resolution, claim at done / cannot-handle, submit / supersede, approve / adjust / reject, mark / unmark paid, reopen window, requirement change, on-behalf entry, close gate, claim-mode check, window tick, payment hook, OCR hook, presentation |
| `services/tickets/store_costs.py` | all SQL of the cost tables |
| `services/tickets/cost_storage.py` | one upload (photo page re-encoded / PDF checked and stored as is), the assembled PDF of photographed pages (fpdf2) |
| `services/tickets/cost_files.py` | (public-core) PDF checks - now with a bounded inflate of FlateDecode streams (code review V7) |
| `services/tickets/costs_report.py` | the report (per currency) and the CSV |
| `services/tickets/costs_retention.py` | janitor step: window end, pending files after 24 h, claims past `purge_after`, unapproved claims of purged tickets |
| `services/tickets/public_claims.py` | `GET/POST /t/api/claim`, the claim-file sink, the claim-mode hook, the claim card of `GET /t/api/ticket` |
| `services/tickets/public_app.py` | (public-core) `link_context(allow_claim=True)`, `PublicDeps.claim_window / claim_files`, `POST /t/api/claim/file` |
| `routers/tickets_costs.py` | the internal API of 11A.12 + department defaults |

Hooks in existing files (small, marked `S9`): `handler_actions.set_status` / `give_back`, `service.change_status` (done on behalf,
close gate), `external.assign_contact` / `preview` (`cost_claim`), `routers/tickets.py` (`cost_claim`, `override_claim_reason`),
`present.ticket_detail` (`cost` block), `contacts.py` / `routers/tickets_contacts.py` (contact cost fields, erase, export),
`table.py` / `store.py` / `table_present.py` / `export.py` / `routers/tickets_table.py` (cost columns, sort, filter),
`settings_doc.py` (`costs` block), `notify_bridge.py` (`cost_submitted`, `cost_missing` no-ops for slice 6), `body_limit.py`
(`ticket_cost_file`), `main.py` (router + janitor), `routers/access.py` / `roles.json` / role catalog (permissions and roles).

## 2. Decisions taken while building (safest default, recorded)

1. **`ticket_cost_claims.ticket_id` is nullable, `ON DELETE SET NULL`** - the spec's DDL says `NOT NULL REFERENCES tickets(id)`
   with no cascade, which would block the ticket purge that 11A.11 requires ("claims stay ... no ticket link"). `department_id`
   is copied onto the claim so an orphaned claim can still be gated.
2. **Orphaned claims in the report** (ticket purged) are shown only to holders of `tickets.costs.view` AND
   `tickets.all_departments` at installation scope.
3. **Files are linked to revisions through `ticket_cost_revision_files`** (doc_no, page_no): a corrected revision can carry the
   files of an earlier revision without a new upload; an adjustment carries the files of the revision it corrects. The same
   file twice in one claim is refused (by SHA-256, at upload and at submission).
4. **"cannot handle" with a requirement of `off`** stays without a claim (the manager said no claim); `required` / `optional` become
   optional (11A.1).
5. **Claim mode** opens for links revoked as `closed` / `cancelled` / `returned` (the latter only with `return_kind =
   cannot_handle`) or not revoked but expired / past the grace; it never opens after reassign, "לא שלי", manual revoke, contact
   change / erase, key rotation or a new generation (the old token's hash no longer matches). In claim mode the link record's
   expiry is the claim's `claim_until`, so a code session (option B) issued then is bounded by the claim window.
6. **"Reopen the window once"** is enforced once per claim (409 `already_reopened`), and only after the window ended.
7. **Adjustments edit lines** (the total follows); a total typed directly is not offered (it would break the per-kind sums of the
   report). The adjustment keeps the vendor revision's VAT mode and currency.
8. **Cost data needs the members' full view** (`Seen.full`) in addition to `tickets.costs.view` on the ticket's place; a creator or
   internal assignee who is not a member sees the status chip only.
9. **Sorting or filtering the board table by cost** needs `tickets.costs.view` at installation scope (403 otherwise): an order of
   rows would leak amounts of tickets whose costs the caller may not see. The columns themselves are blank per row without the
   permission on that row's place.
10. **The requirement can be changed by a manager of the ticket** (`seen.manager`) while no claim was submitted; `off` closes an
    awaiting claim's window at once.
11. **The close gate counts REQUIRED claims not approved / paid**; cancel is not gated. The automatic close (slice 6) calls
    `costs.blocks_close(conn, ticket_id)`.
12. **Allowed currencies** are a fixed allow-list of two-decimal ISO codes (`money.CURRENCIES`: ILS, USD, EUR, GBP, CHF, CAD,
    AUD); a currency with another exponent needs its own input rule first.
13. **V2 (code review) for claim files:** the per-token file budget is spent when an upload enters its body phase (refused,
    trickled or abandoned uploads cost the same as stored ones). The photo route keeps public-core's behaviour (not changed here).
14. **V7 (code review):** `check_pdf` now inflates FlateDecode streams (bounded: 4 x the file, at most 32 MiB in total - past it
    the file is refused) and scans them; the pinned "known limit" test became a refusal test. Other filters and streams that do not
    inflate cleanly are still not looked into (stated in `cost_files.py`).
15. **Timeline rows of claims carry no amount** (`cost_submitted`, `cost_decision`, `cost_message` carry ids, sequence and action):
    members without `tickets.costs.view` read the timeline.
16. **Vendor messages** (`cost_rejected`, `cost_approved`, `cost_reopened`) go through `external.DISPATCH.queue(purpose=...)` - the
    slice-5b outbox seam. Until 5b replaces `ManualDispatch`, nothing is queued and the timeline records `cost_message` with
    `queued: false`. No amount ever travels in a message.

## 3. Hand-over

- **Slice 5b:** `DISPATCH.queue` receives the purposes `cost_rejected`, `cost_approved`, `cost_reopened` (spec 7.3 already lists
  them in the outbox CHECK); templates per language (D26) - the approved text carries no amount.
- **Slice 6:** fill `notify_bridge.cost_submitted` (holders of `tickets.costs` who can see the ticket; category tickets, severity
  info) and `notify_bridge.cost_missing` (department managers holding `tickets.costs.view`); the automatic close must skip
  `costs.blocks_close()` tickets and keep them in "waiting for me"; `waiting_reason = 'claim_missing'` is a new value.
- **Slice 4 (page):** mount the claim step of `pilot/TICKETS-s9-public` (see its notes); `GET /t/api/ticket` carries `claim`
  and the claim-mode card.
- **Slice 8 (guide):** the 7-year retention, invoices opened in an up-to-date PDF viewer (S25), claim mode, the close override.
- **Integration:** migration lists in `test_media_api.py`, `test_media_players_api.py`, `test_migrations.py`, `test_notify_core.py`
  now end in `..., 79, 80, 83]` - 0081 / 0082 of slices 5a / 5b join at integration.

## 4. UNVERIFIED / NOT_RUN

- Real phones (camera capture through the native camera app, WhatsApp's in-app browser and `capture`), a real tunnel, a real PDF
  viewer opening a stored invoice: not run (fakes only).
- The OCR hook does nothing (release 1).
