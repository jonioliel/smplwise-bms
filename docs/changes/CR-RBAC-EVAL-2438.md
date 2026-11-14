# CR-RBAC-EVAL-2438 - deleted places grant nothing; one "active user"; the single-signer award

Branch `pilot/CR-RBAC-EVAL-2438`, based on `origin/main`. Code review 2026-11-13: 02:P3-4 and 01:F-05.
Owner decisions (round 32, 14.11.2026): Q-SEC-4 / O20 **a** and Q-SEC-5 / O16 **a** (with the owner's single-signer note).

## 1. A permission on a deleted building grants nothing (02:P3-4, O20 a)

Before: `scope_chain` did not look at `deleted_at`, so an allow bound on a deleted building still granted on the building
and on any floor (or camera) still hanging under it, and it still counted in `permissions_anywhere` (navigation) and
`has_any_binding` (`/me.has_access`). `station_chain` already skipped a deleted building - the two disagreed.

After:

- `rbac.dead_places(conn, nodes)`: a site / building / floor is dead when it is soft-deleted, when its row is gone (an orphaned
  scope row), or when it hangs under a deleted or missing building / site. At most three statements, only for the place types
  present in the principal's allow bindings.
- `rbac._active_bindings` drops every **allow** bound on a dead place. All evaluation readers go through it: `authorize`,
  `effective_permissions`, `permissions_anywhere`, `bindings_of` (also used by search and automation role checks),
  `has_any_binding`, `permissions_fingerprint` (so the shell re-fetches when a building is deleted), `services/access.camera_scope`.
- A **deny** bound on a dead place is kept: it can only take access away (fail closed).
- `scope_chain`: a deleted building is cut from its site (chain = floor -> building -> installation), the same rule as
  `station_chain`. The building node stays so a deny on it still bites. `services/access._chains` (the batched camera scope)
  follows the same rule; `services/notices/audience._floor_chain` reaches no one through a floor of a deleted building.
- `station_chain` is unchanged (door path; it already skipped deleted buildings).

No migration: the rule is evaluated at read time, so existing rows on deleted places stop granting immediately and a restored
place (if one is ever restored) grants again. Latest migration on `origin/main` is 0215; `pilot/CR-AUDIT-INDEX-2436` (and
`CR-WAVE1B-COMBINED-2436`) add 0216; the next free number would be **0217** - not used.

## 2. One "active user" (01:F-05, O16 a) and the single signer

New `services/active_users.py`: disabled on either side (`users.active = 0` or `ha_users.is_active = 0`) = not active; active =
present on at least one side and disabled on none. `is_disabled` is the weaker form ("no row" is not disabled) for principals that
may have no row yet. The four copies now delegate to it: `tickets/store.user_is_active`, `tickets/store.active_user_ids`,
`tickets/store_rfq.active_user_ids` (the second-approver search; it read `users.active = 1` only), `routers/access.active_user_ids`,
and `tickets/access.Viewer.anywhere` (read `users.active` only).

`notify_recipients.active_user_ids` on `pilot/CR-WAVE1-COMBINED-2436` reads `users.active = 1` only, so it is not the two-sided
definition and was not reused; this branch does not depend on any unmerged branch. When CR-RECIPIENTS merges, its helper can
delegate to `services/active_users` in one line (follow-up, not done here).

Single signer (owner note: many organisations have one signer):

- At award time (unchanged rule, now with the correct active set): with no active eligible second approver, the first approval
  is final even above the threshold.
- New: an award already waiting in `pending_second` whose only possible second approver was disabled afterwards used to be stuck
  (nobody could confirm, decline, cancel or close). `rfq.second_signer` now answers "approver" / "sole" / None; when no second
  approver exists any more, the **first approver** may confirm or decline it alone. The audit row carries `sole_signer: true`.
  The confirm and decline routes, the manager dashboard list and its approvals count all use `second_signer`.
- With an active second signer nothing changes: the first approver still gets 409 `second_approver_required`.

Not changed: `rbac.authorize`'s own active check still reads `users.active` only (outside F-05; the two tables are mirrored by
`ha_users._set_active`). Recorded as a follow-up question, not silently widened.

## Tests

New `smplwise_vms/backend/tests/test_rbac_eval_2438.py` (deleted building / site / floor, orphaned rows, deny still bites, site
no longer reaches a deleted building's floors, camera scope, the active-user table across all callers, one signer, signer
disabled on either side, sole-signer confirm / decline / dashboard).

Local runs (Windows, py 3.12 `.venv`, `-p no:xdist`, the workstation heavily loaded):

- `tests/test_rbac_eval_2438.py`: 16 passed.
- Regression, 15 files: `test_rbac.py`, `test_rbac_matrix.py`, `test_rbac_groups.py`, `test_rbac_camera_scope.py`, `test_access.py`,
  `test_tickets_rfq.py`, `test_tickets_mgrdash_summary.py`, `test_tickets_mgrdash_alerts.py`, `test_notices_106.py`,
  `test_notices_perm_295.py`, `test_intercom_authority.py`, `test_ha_users.py`, `test_permcam63_shared_spaces.py`,
  `test_tickets_s4_assign.py`, `test_building_scope_single_2351.py`. The first run was stopped by my own 50-minute timeout at about
  91 % (no failure, no error up to that point, past the first eleven files); the last four files were then re-run alone: all passed
  (145 tests, exit 0).
- NOT_RUN locally: the full backend suite, `test_door_*`, `test_wiskey_*`, the other `test_tickets_*` and `test_notice*` files, lint.
  They belong to the runner entry check.
