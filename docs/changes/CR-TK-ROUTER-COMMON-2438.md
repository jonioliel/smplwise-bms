# CR-TK-ROUTER-COMMON-2438 - the tickets routers' shared helpers, batched name reads, one settings read per request, T4 in tickets

Branch `pilot/CR-TK-ROUTER-COMMON-2438`, **stacked on `pilot/CR-ROUTER-COMMON-2438`** (8f41ef680; it imports `rid` from
`routers/_common.py`), which is based on `origin/pilot/CR-WAVE1B-COMBINED-2436` (RECIPIENTS, the T4 dependency, is there).
Code-review master plan (`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.3, wave 2, row `CR-TK-ROUTER-COMMON-2436`.
No version bump, no migration, no frontend change, no pixel change, no route change.

## Findings covered

| Finding | Change | Behaviour |
|---|---|---|
| 01:F-13 `_rid` | the 17 tickets routers + `home_ticket_photo.py` import `rid as _rid` from `routers/_common.py` (identical body) | unchanged |
| 01:F-13 the 422 envelope | new `routers/_tickets_common.py`: `invalid(conn, field, code)`, `invalid_fields(conn, fields)`; the 30 inline `ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": ...})` in the tickets routers and the four `_invalid` copies use them (AST rewrite: one-problem lists -> `invalid`, other lists -> `invalid_fields`). `tickets_rules._invalid`, `tickets_table._invalid`, `tickets_visits._err`, `tickets_budgets._err` stay as adapters of their own exception types | unchanged: same status, code, text and details |
| 01:F-13 "permission or audited 403" | `need_any(conn, viewer, *permissions, request_id=None)`; `tickets._need_any` removed, `tickets_table._need` is a one-line wrapper (keeps its `rid` argument). The audited row keeps action (the first permission), resource `installation` / `*`, reason `no_binding`, details `{"permission": ...}`. `_money`, `_configurer`, the cost `_need`, the RFQ `_need_view` audit different resources / reasons and stay local | unchanged |
| 01:F-08 pickers | new `store.display_names(conn, ids)`: `display_name`'s precedence (ha_users name/username, then users display_name/username, then the id; "" for an empty id) in **two statements** (`json_each`). Used by `GET /tickets/admin/directory`, `dept_handlers.people`, `GET /tickets/admin/holders` and `service.eligible_assignees` | same names; fewer statements |
| 01:F-08 active flag | `holders` and `eligible_assignees` test `uid in store.active_user_ids(conn)` (read once) instead of `store.user_is_active` per person. The two are the same rule today for the stored 0/1 flags, and `CR-RBAC-EVAL-2438` makes `user_is_active` "the single-user form of `active_user_ids`" | same answer |
| 01:F-20 | `dept_handlers.department_view(scope, dept_id, full=None)`: `overview` computes the phone-unmask flag once (`full_phones(viewer)`) and passes it to every department; the other callers (single-department answers) compute it as before. `GET /tickets/admin/departments` already passed the document down (`inst`) - pinned by a test | same output; one read per request instead of one per department |
| T4 (tickets adoption) | `notify_matrix.role_members(conn, roles)` is `notify_recipients.expand(conn, {"roles": roles}, roles, active_only=False)` (same two statements, same order, same live-binding rule) | unchanged; parity test |

Measured before the change (new tests run against the unchanged code, workstation): admin directory picker 28 statements with
10 users -> 52 with 22 (2 per user); department manager's people picker 31 -> 55; holders 66 -> 95 for 6 more holders
(4.8 per holder); `GET /tickets/dept-handlers` 6 settings-document reads with 1 department -> 9 with 2.

## Not changed here (out of this row's files; noted for later rows)

- `T/notify_bridge.py`: `department_managers` checks 1-2 manager members (batching would cost more statements, not fewer) and its
  fallback builds a `Viewer` per active user to evaluate permissions per ticket place - not a name read; left as is.
- `T/rfq.py:997-1005` `second_approvers` (named in F-08): `rfq.py` is held by `TICKETS-PERF-ERASE-2435` and `CR-RBAC-EVAL-2438`.
- Per-member settings reads: `staff_links.view` -> `phone_verify.installation_required` reads the document once per member row
  (both on `GET /tickets/dept-handlers` and `GET /tickets/admin/departments`). Not in this row's files; the F-20 test counts the
  department-level reads only and names this explicitly.
- The 422 sentence still appears in the tickets **services** (outside this row's files).
- Pre-existing ruff F401 in `tickets_costs.py` (`Form`) and `tickets_messages.py` (`Query`) left for `CR-PYFLAKES-ENFORCE`.

## Files

- new `smplwise_vms/backend/smplwise/routers/_tickets_common.py`
- `smplwise_vms/backend/smplwise/routers/tickets*.py` (17), `home_ticket_photo.py`
- `smplwise_vms/backend/smplwise/services/tickets/store.py` (`display_names`, added after `display_name`; the lines
  `CR-RBAC-EVAL` changes are untouched), `service.py` (`eligible_assignees` only), `dept_handlers.py` (`people`, `overview`,
  `department_view`, new `full_phones`), `notify_matrix.py` (`role_members`)
- new `smplwise_vms/backend/tests/test_tickets_router_common_2438.py`; `tests/test_router_common_helpers.py` (the tickets routers
  are no longer waiting)

## Tests

- New `tests/test_tickets_router_common_2438.py` (12 tests). Run against the **unchanged** code first: 8 failed as intended
  (display_names missing x2, the two pickers' statement counts, holders per-person reads, dept-handlers per-department read, the
  shared 422 helper missing, inline envelopes / `_rid` copies present), 4 passed (admin departments read count, eligible assignees'
  answer, the audited 403, the T4 parity - these pin unchanged behaviour). After that run the dept-handlers read-count test was
  narrowed to department-level reads (per-member `phone_verify` reads excluded); that refined version was not re-run against the
  old code (the old code read once more per department at that level, so it fails there by construction).
- After the change, locally (`-p no:xdist`, focused files only): `tests/test_tickets_router_common_2438.py` +
  `tests/test_router_common_helpers.py` - **24 passed**, 0 failed (JUnit report).
- `scripts/api_inventory.py` regenerated `contracts/API_INVENTORY.md`: **no diff** (1,905 routes).
- NOT_RUN locally (workstation saturated; the entry check runs them): `test_tickets_api.py`, `test_tickets_251_security.py`,
  `test_tickets_directory_permission.py`, `test_tickets_admin.py`, `test_tickets_dept_handlers.py`, `test_tickets_handlers_page.py`,
  `test_tickets_assignees.py` and the rest of the backend suite.
