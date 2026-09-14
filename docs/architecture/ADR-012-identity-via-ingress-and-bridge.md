# ADR-012 — Identity: Supervisor Ingress headers plus a thin HA bridge integration
Status: approved (owner, 2026-09-14, option 3א)
Owner / date / linked tasks / requirements: Claude Code / 2026-09-14 / T011, T076, T077, T079, T080, T081 / R021–R022, R151–R162

Context and evidence:
- v1.1 mandates HA as the only identity source, no VMS passwords, scoped VMS roles, and server-side
  enforcement (docs/security/HA_IDENTITY_RBAC_HE.md).
- The legacy add-on uses a shared PIN with an IP-keyed lockout that misfires behind Ingress.
- Lab: HA Core 2026.9.2. The owner-supplied token belongs to the non-admin user `codex` (Supervisor
  endpoints return 401), which makes it a ready-made "ordinary HA user" test identity.
- Supervisor Ingress forwards authenticated user headers (`X-Remote-User-Id`, `X-Remote-User-Name`,
  `X-Remote-User-Display-Name`); the exact names and the proxy source address must be verified on the
  lab Supervisor before trust (T081, [H03]).

Constraints and source versions: HA 2026.9.x, Supervisor current stable; `config/auth/list` is admin-only,
so directory sync must run inside HA Core via the bridge (`hass.auth.async_get_users()`), never from the
browser and never by promoting users.

Alternatives considered:
1. PIN or local accounts — forbidden by the spec.
2. Standalone HA OAuth (IndieAuth) login page — valid for a future non-Ingress entry; deferred (off in Pilot).
3. **Chosen:** Ingress headers as the sole runtime identity, accepted only when the request arrives from
   the Supervisor proxy on the add-on's Ingress port (no host port published), plus a thin custom
   integration ("bridge") that (a) pushes a minimal user directory and (b) executes allow-listed actions
   with `Context(user_id=…)` so HA's own per-entity permission check applies (`entity_service_call`).

Decision and rationale: option 3 is the documented HA mechanism, needs no HA privilege changes, and keeps
the bridge minimal and auditable. Bridge↔add-on traffic uses a pairing secret established once at
bootstrap by an HA admin, per-request HMAC with timestamp and nonce, and versioned payloads.

Effects on API, data, UX, permissions and operations:
- Principal = `(ha_instance_id, ha_user_id)`; VMS session record with `permission_revision`; default deny.
- Bootstrap (SC26): the pairing admin explicitly selects the first VMS system administrator; no automatic
  promotion of HA admins; lock after completion; last-admin recovery only by an explicit HA-admin action.
- `panel_admin: false` shows the sidebar entry to everyone; unassigned users get the `forbidden` state,
  never content. This limitation is documented for the owner.
- Directory refresh ≤ 60 s (polling + reconciliation); disabled/removed HA users lose access when observed;
  audit rows keep the id.

Validation evidence / rollback: T081 proves ingress entry for `codex` and rejects forged headers on any
other path; T083 runs the three-identity scenario. Rollback: uninstalling the bridge disables directory
sync and HA actions; map/video features degrade to "identity stale, read-only".

Approver / supersedes: owner 2026-09-14 / implements the v1.1 ADR amendment.
