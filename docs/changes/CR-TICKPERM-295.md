# CR-TICKPERM-295 - the handlers' permissions and the directory's permissions are separate

Status: implemented on `pilot/TICKPERM-295` (from `integ/2101` @ `55ae49d53`). Owner: "accelerate" (2026-10-21), plan task
`tickets-separate-permissions` (2.10.0, effort S, left open by SMALL-294). No new permission name, no migration, no `roles.json`
data change (one role display name only).

## 1. The problem

Three families of ticket administration exist, and two of them were still mixed:

| Family | Who it is about | Permission today |
|---|---|---|
| Settings | departments, categories, SLA, templates, naming | `tickets.configure` |
| Directory | vendors and outside contacts | `tickets.configure` or `tickets.directory` (SMALL-294) |
| Handlers | department members, employees without an account, rows linked to a user, staff links | `tickets.configure` (all) or `tickets.handlers` (a department manager, his departments only) |

The mix: the directory routes (`/tickets/contacts*`) also carry the **handlers' rows** (kind `employee`, or `user_id` set). A holder of
`tickets.directory` alone could create, list, edit, erase and export them, link a row to a user and read their full phone numbers.
Those rows decide where a person's staff links and WhatsApp go; the code already treats exactly that as the stricter case
(`phone_verify.manager_confirm`: "a STAFF row ... needs system.configure", `staff_links.set_mobile`: `tickets.configure`). The
permission-screen words of `tickets.directory` also did not say which side it covers. Separately, the per-row phone verification
(`phone_verify._admin_row`) still demanded `tickets.configure`, although the directory screen offers the card to every directory editor.

(`tickets.handle` in the task text is r1's name, folded by D15; the live permission is `tickets.handlers`.)

## 2. The split (minimal)

| Permission | Opens | Does not open |
|---|---|---|
| `tickets.directory` | Vendor and outside-contact rows: list (every row), read, create, edit, erase, export, full phones, per-row number verification | Handlers' rows (employee, user-linked): not listed, 404 on read / edit / erase / export, 403 on create or on turning a row into one; settings, departments, members |
| `tickets.handlers` (+ `tickets.manage` + manager membership, installation scope) | Unchanged: members of his departments, attach / detach / create rows for his departments, own routes `/tickets/dept-handlers*` | Everything outside his departments; the directory routes |
| `tickets.configure` | Everything it opened before (it stays the umbrella): settings, members, directory **and** handlers' rows | - |

Rule in code (`services/tickets/contacts.py`): `is_staff_row(row)` = `employee` or `user_id`; `may_edit_staff_rows(viewer)` = holds
`tickets.configure` at the installation; `_staff_gate` / `require_staff_rows` apply it to update, erase, export, create and per-row
verification. The refusal of a write that *makes* a handler row (create with kind employee / `user_id`, PATCH to them) is the audited
403 naming `tickets.configure`; a read or write on an *existing* handler row by a directory-only holder is the same 404
`contact_not_found` as an unknown id (nothing says whether the row exists). The list answers `can_edit_staff` (false for a
directory-only holder); the department manager's routes (`dept_handlers`, `insert_checked`, `update_checked`) are untouched.

Arx RBAC is the only authority: no client flag, no Home Assistant admin flag, no WisKey claim grants any of this. Every route stays
behind the module switch: with the tickets module off, all of it is the uniform 404 `feature_disabled` (tested for a directory holder).

## 3. Existing roles - no regression

- `system_admin` (all permissions) and anyone with `tickets.configure`: unchanged, every test of the old behaviour still holds.
- `tickets_handlers` holders (department managers): unchanged.
- `tickets_directory` holders: lose only the handlers' rows. The permission was introduced by SMALL-294 in the unreleased 2.10.0
  train and is held by no built-in role besides `system_admin`, so no released installation can have a user who relied on it.
- Frontend: the "מטפלים וספקים" directory view hides the "employee" kind and its new-row button when `can_edit_staff` is false (an
  older server omits the flag: shown, the server still refuses).
- Words: `tickets.directory` becomes "ספרייה: ספקים ואנשי קשר חיצוניים" (he / en / ar / ru; backend label and the role name of
  `tickets_directory` follow). Labels only, no hint paragraphs.

## 4. Migration

None. `roles.json` gets a changed display name only (no permission list changes); no table, setting or binding changes.
Provisional number: none needed (the lead's range 0140+ stays untouched).

## 5. Tests

`tests/test_tickperm_295.py` (negative first): directory holder runs vendors / contacts; cannot create a handlers' row (employee,
user-linked) - 403 naming configure, nothing written; sees none, 404 on read / edit / erase / export / verify of one; cannot convert
a vendor row (kind employee, `user_id`); verifies a vendor number, not a handler's; configure keeps everything; roles without any
ticket permission refused; module off closes every directory route; catalogue pins. Frontend unit spec for `can_edit_staff`.

## 6. Open owner questions (safest option taken)

1. Should handlers' rows also be reachable by a new **installation-level** handlers permission (staff administration without
   `tickets.configure`)? Taken: no - `tickets.handlers` stays the department manager's, `tickets.configure` the rest.
2. Should `tickets.handlers` managers keep **creating vendors** for their departments (CR-DEPT-MANAGER-HANDLERS, owner 2026-10-17)?
   Taken: yes, unchanged (tightening would regress an owner decision).
3. Should the staff mobile (`PUT /tickets/admin/staff/{user}`) open to directory editors? Taken: no (fail closed, T19-4).
