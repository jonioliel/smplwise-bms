# Service management: the assignee abstraction (TKSTAFF2)

Status: implemented on `pilot/TKSTAFF2-assign-contacts` (owner request 2026-10-16). Code: `smplwise_vms/backend/smplwise/services/tickets/assignees.py`
(server) and `frontend/src/tickets/assignee-model.ts` (screens). Context: CR-038 (`docs/changes/CR-038-TICKETS-MODULE.md`), migration 0084.

## Why it was needed (root cause)

A staff member created in the handlers page's "without an account" section is a directory row (`ticket_contacts`, API kind `employee`,
stored as `kind = 'person'` with `employee = 1` by migration 0084). The assignment model already stored contacts
(`ticket_assignments.assignee_kind = 'contact'`, `contact_id`), but every path that offers or assigns a contact treated it as an OUTSIDE
party (slice 4):

- `contacts.assignable_for` returned nothing unless the caller held `tickets.external` ("send outside", D25), and
  `external.preview` / `external.assign_contact` / the link actions answered 403 `external_permission_missing` without it. The built-in
  `tickets_manage` role (a department manager) does not hold `tickets.external`, so a department manager could never assign them.
- The assign dialog's "employees without an account" group was blocked by the same outside rule (`outsideBlock`: the `external`
  reason first).
- The other pickers read only `users` of `GET /tickets/assignees` (account holders): the create sheet, the table's handler menu and the
  bulk bar; the create route refused every contact outright.

## The model

A handler is one of:

| kind      | who                                                                       | how it works                                        |
|-----------|---------------------------------------------------------------------------|-----------------------------------------------------|
| `user`    | an active member of the department holding `tickets.view` where it lies    | in-app notification, signs in                       |
| `contact` | a staff contact: `employee = 1`, no `user_id`, no vendor, active, allowed in the department | the scoped personal handler link and the assignment message of slice 4/5b (same dispatcher, same templates, same channel rules); never a login |

Reference on the wire and in storage: `{kind, id}`; key `user:<id>` / `contact:<id>` (the board and table filter key).
`GET /tickets/assignees` returns `handlers` - one list, one shape:
`{key, kind, id, name, account, member_role, phone, has_phone, preferred_channel}` (account holders first, then staff; the phone is
masked unless the directory's existing rule `contacts.full_phone_for` allows the full number). `users` stays for older clients;
`contacts` now holds the outside contacts only (vendors and persons).

Every screen that picks a handler (assign dialog, create sheet, table menu, bulk bar) reads `handlersOf(answer)` and sends
`assigneeRef(handler)`; the table filter lists the holders of the loaded rows by key. There is no separate code path for staff in
the UI: the dialog keeps the owner's three tiles (2026-10-14), but "with an account" and "without an account" are the same picker and the
same submit over the `handlers` list; only "vendors and contacts" uses the outside flow (preview, code, history, cost claim).

## Rules (decisions recorded)

- Who may assign a staff contact: whoever may assign an account holder - manager rights in the ticket's department. `tickets.external`
  is not asked, because a staff contact is placed in the directory as staff by a `tickets.configure` holder (the authority that also
  adds department members). No permission is added to any role and the RBAC catalogue is unchanged. The same rule covers the link
  panel's copy / new link / resend for a staff link. One switch restores the earlier rule: `assignees.STAFF_NEEDS_EXTERNAL = True`.
- Outside contacts (vendors, persons) keep every slice-4 rule (`tickets.external`, D25). A non-manager assigns nobody.
- The personal link still needs the handler page (public page, address, module key): without it the staff group shows the reason
  line with the link to the setting, and the server answers 409 `public_link_unavailable`.
- Messages: a staff assignment queues the existing assignment message through the existing dispatcher - the contact's preferred
  channel, the WhatsApp master switch and account mapping, the send hours. Nothing new is sent. The handlers page's "alert on new"
  toggle (`notify_new`) keeps deciding who is told about NEW unassigned tickets (department managers only); it is untouched.
- History: an assignment freezes `assignee_name`; deactivating a staff row only removes it from the pickers; erasing it tombstones the
  row (the assignment keeps pointing at it) and, only when asked, rewrites the name in the history. Nothing is orphaned.
- Audit rows carry ids and flags only (`assignee_kind`, `contact_id`, `channel`, ...), never a phone number or a name.
- Not changed in this task: the delivery lines' "send now" / "send again" / "send update" routes of slice 5b
  (`routers/tickets_messages.py`, `messaging.py`) still need `tickets.external`, also for a staff assignment.

## For the next task (TKSTAFF1)

- A mobile field for account holders: add it to the `user` handler (e.g. `phone` / `has_phone` in `assignees.handlers`) - the shape
  already carries them.
- The internal-staff no-login link: build on `assignees.is_staff` / `may_send` and the `contact` handler kind; keep `handlers` the
  single picker list and `assigneeRef` the single reference so no screen grows a parallel path.

## TKSTAFF1 (2026-10-16): the no-login staff link of an account holder

- Built: `services/tickets/staff_links.py`. An account holder whose directory row (`ticket_contacts.user_id`) has a mobile gets,
  when assigned (service.assign), a WhatsApp message with a scoped no-login link (`ticket_links.kind = 'staff'`); the assignment
  stays `assignee_kind = 'user'` and its `contact_id` names that row (the inbound matcher and the page's "since first assigned"
  rule work unchanged). The mobile, the message language and the user's own WhatsApp switch are edited in "מטפלים וספקים" ›
  מטפלים › "עם חשבון במערכת" (`PUT /tickets/admin/staff/{user_id}`, `tickets.configure`). `handlers` now carries `phone` /
  `has_phone` for account holders too (masked unless the caller configures the directory).
- `notify_new` is unchanged: it decides who is told (in the app / by the notification engine, with a signed-in deep link) about NEW
  tickets; the staff link goes only to the CURRENT assignee, gated by their mobile and `notify_whatsapp` (security design R11 / R12).
- Security rules, revocation triggers and the spec amendment: CR-038 spec 8.1 (amendment 2026-10-16) and the module docstring.

## Decision 2026-10-16 (release 2.5.8 consolidated review F4, lead decision, fail closed): no money surface for staff

A staff contact without an account (TKSTAFF2) is internal staff, like an account holder with a TKSTAFF1 staff link: it is never put
into the vendor-payment pipeline. Built as the minimal safe change (its link stays `kind = 'external'`, so the TKSTAFF2 channels -
WhatsApp, e-mail redeem, "copy link" - keep working; minting `kind = 'staff'` would have dropped e-mail / copy and would be revoked by
the staff-link recheck, which keys on a user assignment):
- `external.assign_contact` forces the assignment's `cost_claim` to `off` for `assignees.is_staff(contact)`, whatever the request sent;
  the preview offers `cost_claim: {default: off, choices: [off]}`;
- the public surface keys on `LinkRecord.no_money` (`kind = 'staff'` OR the joined contact is a staff contact): `/t/api/claim`,
  `/t/api/claim/file` and `/t/api/quote` answer the uniform 404, no claim mode, no `claim` block in the view, "done" opens no claim;
- `quotes.public_quote` / `submit` treat a staff contact's assignment as not external.
Managers still assign staff contacts without `tickets.external` (unchanged). Residual: a `tickets.costs` holder can still enter a cost
on the manager side for such an assignment (an authorised internal act, not a public surface).
