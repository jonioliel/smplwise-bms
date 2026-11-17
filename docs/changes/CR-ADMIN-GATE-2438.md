# CR-ADMIN-GATE-2438 - one administrator gate, one administrator count, the go-live texts, authorize's "active user"

Branch `pilot/CR-ADMIN-GATE-2438`, stacked on `pilot/CR-RBAC-EVAL-2438` @ `221a562ef` (both edit `rbac.py`; merge that one first).
MASTER_PLAN entry `CR-ADMIN-GATE-2436`: code review 02:P2-1, 02:P2-9 (lead decision L5), 02:P2-10 (owner decision O9 a), the router
side of 02:P1-5; plus the lead's answer to question 1 of CR-RBAC-EVAL-2438 (authorize uses the one "active user").

`pilot/AUTH-REVOKE-GATE-2435` (not merged) did NOT add `rbac.require_system_admin`: it gave `routers/wiskey_lineage.py` its own local
`_gate`. So the helper is added here, and `wiskey_lineage.py` is left to that branch (it can adopt the helper in one line after both merge).

## Commit 1 - the gate, the count, the evaluator (02:P2-1, 02:P2-9, 02:P1-5)

- `rbac.require_system_admin(conn, principal, *, action, text, request_id, resource_type, resource_id, details, configure_checked)`:
  `require("system.configure")` (audited by require), then `is_system_admin`, then one audited refusal with the caller's values and
  403 `not_system_admin` with the caller's text. Adopted at the 10 call sites: `access_visitors._admin_or_403`,
  `wiskey_managed._admin_or_403`, `wiskey_switches._admin_or_403`, `access_station_permissions._admin_only`, `access_grants`
  (settings GET, readiness, settings PUT - the PUT keeps its order "configure, empty body, administrator" through
  `configure_checked=True`), `access_wiskey_visits` settings PUT, `wiskey_pairing` probe and repair. Every audit action, resource id,
  details and Hebrew text is passed through unchanged (the twelve texts stay per site, as the plan says).
- `service_identity` kill switch: not moved (lead decision L6: keeps code `forbidden`; its order is "administrator first").
- `rbac.admin_count` (L5): active users allowed `rbac.roles.manage` at the installation, decided as authorize() decides (allow / deny,
  direct / group, expiry, revocation, demo mode, the local rules). Bindings, memberships and users are read once: 200 users went from
  403 statements to at most 10. `routers/access.admin_count` delegates (its importers unchanged); the setup wizard's "system
  administrators" now uses it - it counted system_admin allow-binding ROWS (on the test matrix: 8 rows vs 4 people).
- `rbac.Evaluator(conn, principal)`: authorize() for many targets reads the active flag and the bindings once; `authorize()` is now a
  one-shot Evaluator, so the rule exists once. `routers/access.assign_scopes` (the scope picker) uses it: 13 bindings reads -> 3 on
  the test tree. Lifetime: one loop, never across a bindings write. The other P1-5 loops (`access_grants`, `access_external`,
  `door_authority`, `door_emergency`) are the service side of P1-5 and are not touched here.
- `is_system_admin` docstring corrected: it is "is this user a system administrator", not the wizard's count.

## Commit 2 - the go-live permits (02:P2-10, owner decision O9 a)

The eight `GO_LIVE_PERMITTED` constants (`access_grants`, `bulk_people`, `bridge_rotation`, `door_automation`, `door_windows_engine`,
`wiskey_acr5`, `wiskey_peer`, `wiskey_peer_registry`) stay True and stay as the owner's kill switches; no branch removed. Corrected:

- docstrings / comments that said "cannot be turned on in this build" / "False in this build" (routers `access_grants`,
  `access_station_permissions`, `door_automations`; services `access_grants`, `access_cards`, `access_grant_engine`,
  `access_station_permissions`, `bulk_people`, `bulk_people_engine`, `door_automation`, `wiskey_auto_door`, `wiskey_switches`,
  `tickets/visits`); each constant gets one line naming O9 a;
- the five 409 texts shown only when a permit is set back to False said "this version does not include it"; they now say the owner's
  activation permit is not active right now (true in both states). Codes and audit reasons unchanged.
- Not edited: comments inside applied migrations (0107, 0126, 0127, 0132, 0134, 0135, 0137) - historical, and migrations are not
  rewritten; test docstrings; the permits that really are False (capture lease, partner, extended service identity, auto install).

## Commit 3 - authorize() and the one "active user"

`Evaluator._user_inactive` (so `authorize`) uses `services/active_users.is_disabled`: disabled on either side -> `user_inactive`.
No row on a side is not "disabled": a local Arx-only identity (no `ha_users` row), a first-request principal and the service identity
(an HA user with no Arx row) behave exactly as before (tested). `admin_count`, `permissions_fingerprint` and `camera_scope` follow.
`is_disabled` is now one statement.

Still reading `users.active` on their own (follow-up, not changed): `routers/me.py:42`, `services/door_authority.py:137`,
`door_automation.py:485`, `door_windows.py:212`, `emergency/access.py:81`, `access_grants.py:1705, 2247`, `bridge_key_notice.py:57`.
Most of them also call authorize(), which now refuses an HA-disabled user anyway.

## Tests (local, Windows, py 3.12 `.venv`, `-p no:xdist`)

- `tests/test_admin_gate_2438.py` (17) and `tests/test_authorize_active_2438.py` (6): 23 passed.
- Before / after: on the base, the count / statement / wizard assertions failed (`admin_count` 403 statements > 10; scope picker 13
  bindings reads > 3; wizard 8 != 4) while the matrix parity passed (the count's meaning is unchanged); `test_authorize_active_2438.py`
  on commit 2: 2 failed (the two new refusals), 4 passed (local user, no row, service identity, users-side switch).
- Regression (two batches, 19 files): `test_rbac.py`, `test_rbac_matrix.py`, `test_rbac_groups.py`, `test_rbac_camera_scope.py`,
  `test_rbac_eval_2438.py`, `test_access.py`, `test_ha_users.py`, `test_setup_wizard.py`, `test_custom_roles.py`, `test_local_identity.py`,
  `test_access_grants.py`, `test_harden271_access_grants.py`, `test_smallfixa_wiskey_switches_295.py`, `test_wiskey_managed_install_2382.py`,
  `test_wiskey_pairing_2382.py`, `test_wiskey_visits_2407.py`, `test_stationperm_295.py`, `test_bulkpeople_295.py`,
  `test_bridge_key_rotation_295.py`: two failures, both expected and the tests updated (then re-run, passed):
  - `test_ha_users.py::test_an_inactive_ha_admin_is_refused`: an HA-disabled administrator is now refused one step earlier, by
    require() (`forbidden`, audit reason `user_inactive`), instead of by the HA-admin check (`ha_admin_required`) - commit 3's intent;
  - `test_smallfixa_wiskey_switches_295.py` (and the same test in `test_wiskey_m12_policy_b_owner_switch.py`) patched
    `routers.wiskey_switches.is_system_admin`, a name the router no longer imports; they now patch `rbac.is_system_admin`.
- NOT_RUN locally: the full suite, door / emergency / intercom suites, lint. Runner entry check.
