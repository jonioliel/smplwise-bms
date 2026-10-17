# CR-DEPT-MANAGER-HANDLERS - a department manager manages his departments' handlers and vendors

Status: implemented on `pilot/DEPTMGR` (from `integ/264` @ `75f41b19`), merged into integ/264. Owner decision 2026-10-17 (level ג).
The owner's answers to section 8 (2026-10-17) on `pilot/DEPTMGR2` (from `integ/264` @ `5fa03e7a`) - section 9; migration 0111
(provisional 0113 on the branch; renumbered at integ/270, 2.7.0).

## 1. What changed

Before: "מטפלים וספקים" (`#/tickets/handlers`) was editable only with `tickets.configure`; a department manager read the directory rows
of his departments with masked phones and did not see the members list at all.

Now a department manager with the new capability, for HIS departments only:

- **members with an account**: adds an active user as a plain member, removes a plain member;
- **directory rows** (employees without an account, vendors, contacts): attaches a row he can read to his department, detaches it,
  creates a new row, and edits / erases the rows he created that no other department uses;
- reads the members of his departments (also without the capability - read-only), phones masked by default;
- works on the standalone page and inside the manager board (`#/tickets/board?pane=handlers`, a "מטפלים וספקים" switch next to the
  requests in the board's header; the embedded page shows only the departments he manages).

He may NOT: touch another department's rows; create, change or remove a manager row (a manager role is a permission over the
department); add groups; change any global grant or a user's permissions; edit a member's mobile (the staff-link mobile is a
person-level value that stays with `tickets.configure`); edit or erase a directory row he did not create (only its attachment to his
departments); edit or erase a row another department uses; link a row to a user; set internal notes, cost defaults / hourly rate,
number verification or the department list of a row; export a row.

## 2. The permission and THE check

New permission `tickets.handlers` ("{module}: ניהול מטפלים וספקים במחלקות שבאחריותי"), smallest safe design:

- a single-permission built-in role `tickets_handlers` (bound to one person like every `tickets_<name>` role);
- **sensitive** (not implied by a custom role unless listed explicitly), **not** in `DEFAULT_DELEGABLE`;
- held by `system_admin` only among the built-in roles (every ticket permission is) - **not granted by default to anyone else**.

THE check of every write (`services/tickets/dept_handlers.py::gate`):

```
module on (router)
AND tickets.manage held (any scope - the rule of Viewer.manages_department)
AND tickets.handlers held at the INSTALLATION (departments are installation-wide configuration, like tickets.configure)
AND a MANAGER membership of the department in the path (direct or through a group - store.memberships_of)
```

`tickets.all_departments` alone is NOT a manager membership here ("his departments" are the ones he manages by membership).
`tickets.configure` holders keep the existing full routes and do not need this one.

The read (`GET /tickets/dept-handlers`) needs `tickets.manage` and at least one manager membership; `can_manage` (per department and
overall) says whether the capability applies. `GET /tickets/meta` carries `can.handlers` and `departments[].can_handlers`; the
directory list (`GET /tickets/contacts`) carries `handler_departments` and, per row, `manager_editable` for a capable manager.

## 3. Routes (`routers/tickets_dept_handlers.py`)

| Method | Path | What |
|--------|------|------|
| GET | `/tickets/dept-handlers` | his departments, their members (masked phones unless allowed), `can_manage`, `full_phones` |
| GET | `/tickets/dept-handlers/people?q=` | active users to add (id + name only, no groups) - needs the capability |
| PUT | `/tickets/dept-handlers/{dept}/members/{user}` | add as a plain member (idempotent: an existing member is answered as is, no second audit row) |
| DELETE | `/tickets/dept-handlers/{dept}/members/{user}` | remove a plain member (re-checks staff links, TKSTAFF1 R7 b) |
| POST | `/tickets/dept-handlers/{dept}/contacts` | create a row: an employee is attached to the department; a vendor / contact is shared with every department unless `shared: false` |
| PUT | `/tickets/dept-handlers/{dept}/contacts/{id}` | attach (idempotent) a row attached to another department he manages |
| DELETE | `/tickets/dept-handlers/{dept}/contacts/{id}` | detach; never the row's last department (409 `last_department`) |
| PATCH | `/tickets/dept-handlers/{dept}/contacts/{id}` | edit a row he created that no other department uses (revision required) |
| POST | `/tickets/dept-handlers/{dept}/contacts/{id}/erase` | erase such a row (`confirm: true`; never the history rewrite) |

Answers, uniform with the module:

- no capability: **403 `forbidden`** `{permission: "tickets.handlers"}`, audited, says nothing about any department;
- an unknown department and a department he does not manage: the **same 404 `not_found`** (same text), audited `denied`
  (`not_manager_of_department`);
- an unknown row and a row of another department: the **same 404 `contact_not_found`**;
- a row he may only attach / detach: **403 `attachment_only`** (one code for "not his" and "used elsewhere" - no reason given);
- a manager row: **403 `manager_row`**; a shared row on attach / detach: **409 `shared_entry`**; the last department: **409 `last_department`**.

"Used by another department" = attached to a department outside his managed set, assigned on a ticket of such a department, or
invited to a request for quotation of such a department - for the row and, for a vendor, any of its persons.

## 4. Phones

Masked (the last four digits) for department managers by default - members' mobiles and directory rows alike. New installation setting
`directory.managers_full_phones` (settings document, default **off**), "מנהלי מחלקה רואים מספרים מלאים", on
Settings › ניהול השירות › ערוץ הודעות. Changed through `PUT /tickets/settings` = `system.configure` (a system permission: system_admin
only, never in a custom role), audited by `tickets.settings.update` with the changed key. When on, a manager (`tickets.manage` + manager
membership) sees full numbers of the rows ATTACHED to departments he manages and of his departments' members. Rows shared with every
department (no department rows) and rows of other departments stay masked. The existing D25 rule (`tickets.external` unmasks the rows
of the departments the holder manages) is unchanged.

## 5. Audit (ids only)

`ticket.member.add` / `ticket.member.remove` with `{subject_kind, subject_id, role, via: "department_manager"}`;
`ticket.contact.create` adds `{department_id, shared, via}` (the creating department is recorded here and returned once as
`created_department`; the creator is the row's existing `created_by` column); `ticket.contact.update` / `.erase` add
`{department_id, via}`; new actions `ticket.contact.attach` / `ticket.contact.detach` `{department_id, via}`. Refusals are `denied`
rows with a reason. No name, phone, e-mail or free text in any of them (tested).

## 6. Accepted residual signals (documented, not leaks of names, counts or which department)

- A creator who sees his own row turn non-editable (`manager_editable: false`, 403 `attachment_only`) learns that SOME other
  department now uses it.
- Detaching answers 409 `last_department` only when his department is the row's only one, so success implies other departments hold
  it. Inherent in "a row with no department rows is allowed everywhere".
- The people picker lists the names of all active users (as the assign pickers already do for members).

## 7. Tests

Backend `tests/test_tickets_dept_handlers.py` (negative first: the catalogue, the 403 matrix for six users, capability without
membership / without manage, foreign = unknown 404, manager rows, another department's row untouched, global rows untouched,
attachment-only rows, the last department, a row used elsewhere, no leak in the overview, meta, masking and the setting, audit
ids-only, idempotence, injection / length). Updated catalogue pins in `test_tickets_admin.py`, `test_tickets_s2.py`,
`test_wiskey_door_path.py`. Frontend unit spec `tests/unit-tickets-dept-handlers.spec.ts`.

## 8. Owner questions - answered 2026-10-17 (all approved), implemented on `pilot/DEPTMGR2`

1. **Default grant** - `tickets.handlers` is for department managers only and is granted **manually by the owner** (the
   `tickets_handlers` role per person). No default for site administrators, not delegable. Unchanged code; pinned by
   `test_the_capability_is_granted_manually_only`.
2. **Vendors default to "my department only"** - a vendor / contact a manager creates is attached to the department in the path unless
   he sends `shared: true` (the UI switch "זמין לכל המחלקות" starts off). Section 1 and the route table are superseded on this point.
3. **Exact-phone lookup** - see section 9.1.
4. **A member's mobile and language** - see section 9.2. Section 1's "may NOT edit a member's mobile" is superseded for plain members
   (including one who manages another department; never the super manager or a system administrator).
5. **The creating department on the row** - see section 9.3 (migration **0111**, provisional 0113 on the branch, renumbered at integ/270).

## 9. The answers' implementation (DEPTMGR2)

### 9.1 Exact-phone lookup of an existing vendor

| Method | Path | Body | What |
|--------|------|------|------|
| POST | `/tickets/dept-handlers/{dept}/contacts/lookup` | `{phone}` | the live vendors whose number is EXACTLY this one |
| POST | `/tickets/dept-handlers/{dept}/contacts/attach-by-phone` | `{contact_id, phone}` | attach such a vendor to the department |

- THE check (`gate`) first: no capability = 403 `forbidden`; a department he does not manage = the uniform 404.
- Exact only: the typed number is normalised the usual way (spaces, dashes, dots, parentheses, `+`, `00`, a leading `0` = +972) and
  compared for equality with `phone_e164` (`store_links.vendors_by_phone`) - no prefix, `LIKE`, wildcard or partial match; a fragment
  shorter than 8 digits is a 422. At most 5 rows. Vendors only (kind `vendor`), never a row that names a user, never an erased row.
- The phone travels in the JSON body, never in the URL (so never in an access log); it never reaches an audit row
  (`ticket.contact.lookup` `{department_id, via, matches}`).
- The answer per vendor: `id, kind, display_name, company, phone` (masked, last four digits), `active, shared, attached` - no department
  name, id or count of its other departments.
- Rate limit per caller (and per database): 5 a minute, 30 an hour, lookups and attaches together; a miss counts like a hit. Over the
  limit: 429 `rate_limited`, audited `denied` with reason `rate_limited`. In-process (resets on restart) - acceptable for a manager-only
  route behind sign-in.
- Attaching needs the SAME number again: an unknown id, a non-vendor, a user's row, an erased row and a number that does not match are
  the same 404 `contact_not_found` (audited `phone_mismatch`). The plain attach route still refuses a row of another department by id
  alone. A vendor shared with every department: 409 `shared_entry`. Idempotent; audited `ticket.contact.attach` with `by: "phone"`.
  An attached row stays `manager_editable: false` (not his) - only the attachment is his.
- Accepted residual signal: a manager who knows a vendor's exact number learns that the vendor exists and its name (that is the
  feature); he cannot list numbers or names.

### 9.2 A plain member's mobile and language

`PUT /tickets/dept-handlers/{dept}/members/{user}/mobile` `{phone?, lang?}` (nothing else: `notify_whatsapp`, `phone_verify`, `user_id`
are 422). THE check, then: the user is an active PLAIN member of the department (else 404). **Owner's second answer (2026-10-17):** a
member who manages ANOTHER department is allowed; refused with 403 `manager_row` (audited `denied`) are only a manager row of THIS
department, the all-departments ("super") manager (holds `tickets.all_departments`) and a system administrator - for both the number
and the language (`dept_handlers._protected_person`). A department outside his own is the uniform 404 as always. The write is the configurer's own
(`staff_links.set_mobile_checked`): a changed number revokes the person's live links in every department, kills pending codes, clears
the confirmation (the person confirms again) and tells the person; audit rows carry `department_id`, `subject_id`, `via` and field
names only. The answer is the department view (the number masked by the usual rule). The overview's members carry `lang` and
`mobile_editable`.

### 9.3 The creating department (migration 0111)

`ticket_contacts.created_department_id` (nullable, no foreign key). Set by the manager's create; NULL for rows created in Settings.
The migration backfills it from the `ticket.contact.create` audit rows with `via: department_manager` (ids only). The directory list and
the one-row answer carry `created_department`: `{id, name, other: false}` for a directory editor and for a manager of that department
(or of every department); `{id: null, name: null, other: true}` for anyone else (a shared row created by another department);
`null` for a Settings row. The UI shows "נוצר במחלקה: ..." on every vendor / employee card and in the read-only card. (The create
answer's former plain-string `created_department` is now this object.)

**Migration number:** 0111 (provisional 0113 on the branch; integ/270 renumbered the 2.7.0 set to 0107..0114).
`test_migrations_263_upgrade.py::test_the_release_numbers_are_contiguous_and_final` fails on this branch alone until the gap is closed
at integration (renumber to the next free number).

### 9.4 Texts

Hebrew and English in `frontend/src/tickets/text-deptmgr.ts`; Arabic and Russian drafts of the new words are exported as
`DM_AR_DEV` / `DM_RU_DEV` (dev-marked, need a native review; the tickets screens read Hebrew / English only, so nothing reads them yet).

### 9.5 Tests

Backend `tests/test_tickets_dept_handlers_decisions.py` (negative first per answer); updated `tests/test_tickets_dept_handlers.py`
(shared rows now opt in). Frontend unit `tests/unit-tickets-dept-handlers-decisions.spec.ts`.
