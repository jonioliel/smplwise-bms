# CAPEMERGENCY-295 - an emergency OPEN revokes live card-capture leases

Implements trigger T10 of `CR-WISKEY-LEASE-REVOCATION-EVENT` (scope `all`, reason `emergency`) for the emergency OPEN path.
The reason already existed in the closed revoke enum (`custom_components/smplwise_bridge/lease_contract.py`,
`services/capture_lease.py` `REVOKE_REASONS`); nothing sent it until now.

## Behavior

- `POST /doors/emergency/incidents` (routers/door_windows.py): after the incident is committed and its apply phase submitted,
  `door_emergency.cancel_capture_leases(db, incident_id)` runs. It acts only for a real (non-drill) incident of kind `open`
  (OPEN over LOCK included). A LOCK and every drill are untouched.
- `capture_lease.on_emergency_open(conn, incident_id)`:
  - flag gate: does nothing unless `capture_lease.route_on()` - `access.capture_lease = on` AND the go-live permit
    (`GO_LIVE_PERMITTED`, False in this build) AND a bridge that offers `lease_event` (`MIN_BRIDGE_FOR_CAPTURE_LEASE`, None).
    As shipped the route is off, so the shipped behavior is unchanged;
  - calls `on_authority_change("emergency", all=True)`: every live lease is unusable at once, and the lease worker writes
    `revoked(emergency)` and sends one signed `lease_revoke` (scope `all`). The epoch moves even with no live lease, so a
    capture start decided before the incident is not issued afterwards;
  - audit: one `intercom.capture_lease.emergency_cancel` row (resource `emergency:<incident id>`, reason `emergency`, details:
    incident id, live lease count, scope, triggers queued; ids only) - only when a live lease was there to revoke;
  - idempotent per incident: an in-memory set of handled incidents plus the audit row (survives a restart); a repeat queues
    nothing and writes nothing;
  - never raises. Any failure is logged and swallowed; the open was already committed and submitted before the call, so a
    lease-side failure can never block or undo the emergency open.
- `retry_open` (WKOPENUNK-295) does not call it again: the incident's start already revoked everything live.

## Not in this change

- No new lease is refused while an OPEN incident is in effect (a lease started after the incident is not revoked by it).
  If wanted, a follow-up adds an `ensure_issuable` check on an active real OPEN incident.
- The LOCK (`lock_secure`) incident does not revoke leases (T10 says "emergency ... becoming active"; this task covers OPEN).
- No bridge / WisKey change; no migration; no UI change.

## Tests

`smplwise_vms/backend/tests/test_capemergency_295.py` (fakes only: scripted emergency engine, fake lease bridge, fake host):
shipped build / flag off = nothing; flag on + active leases = revoked with reason `emergency`, one `lease_revoke` scope `all`,
one audit row; idempotency (repeat and after the in-memory set is cleared); LOCK and drill = nothing; no live lease = nothing
sent or audited; a failure in the hook, in `route_on` or in the trigger does not block the open (all doors acknowledged).
