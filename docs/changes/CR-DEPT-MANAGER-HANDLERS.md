# CR-DEPT-MANAGER-HANDLERS - a department manager manages his departments' handlers and vendors

Status: implemented on `pilot/DEPTMGR` (from `integ/264` @ `75f41b19`), not merged. Owner decision 2026-10-17 (level ג).
No migration.

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

## 8. Open owner questions

1. Default grant: today nobody but a system administrator holds `tickets.handlers`; each manager needs the `tickets_handlers` role.
   Should site administrators get it by default, or should it become delegable by a delegated administrator?
2. A vendor / contact created by a manager is shared with every department by default (per the decision text); an employee is attached
   to the department. Keep, or default vendors to "my department only"?
3. A manager cannot find a vendor that is attached only to another department (no leak), so he creates a duplicate. Allow an exact
   phone-number lookup to attach an existing vendor instead?
4. Should the manager also edit a member's mobile / language (today: tickets.configure only, because it is a person-level value that
   revokes links across departments)?
5. Should the creating department be stored on the row (a column - would need migration 0102, provisional) rather than only in the
   audit row?
