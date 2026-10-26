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

## Follow-ups - DONE in CAPEMERGENCY2-295 (target 2.21.0, branch `pilot/CAPEMERGENCY2-295`)

Both follow-ups below were listed as "not in this change" here; owner decision: build both, behind the same flags. With the route
off (the shipped build) nothing changes: a capture start is refused with the plain `capture_lease_unavailable` as before, the sweep
does nothing, no new audit row is written.

1. **No new lease while an emergency OPEN is in effect.** "In effect" is the incident's own state, no new clock: a real
   (`drill = 0`) incident of kind `open` in one of the apply-phase states `door_emergency.PHASE_STATES["apply"]` (`applying`,
   `in_effect`, `in_effect_partial`). From `releasing` on the OPEN is being undone and leases are issued again.
   - `capture_lease.ensure_issuable` (called by the capture start route first, and again by `issue` inside the write transaction
     that inserts the ledger row) refuses with the closed code **409 `capture_lease_emergency`** (`outcome: not_sent`, nothing
     signed or sent) and writes `intercom.capture_lease.emergency_refuse` (decision `denied`, reason `emergency`, resource
     `emergency:<incident id>`, details: incident id only). The route's own refusal row (reason = the code) is written as usual.
     The check runs only while `route_on` is true. If the incident state cannot be read the start is refused with
     `capture_lease_unavailable` (fail closed).
   - The race gap: an issue whose write transaction precedes the incident's commit leaves a live lease that the incident's cancel
     then revokes (the epoch move covers every live lease). As a backstop, `capture_lease.emergency_sweep` runs at the start of
     every lease-worker round: while an OPEN is in effect, any lease that is still usable (live in the gap, or missed because
     the cancel hook itself failed) is revoked with reason `emergency`, scope `all`, audited
     `intercom.capture_lease.emergency_gap_cancel` (incident id, lease refs, triggers). Idempotent (after the epoch moves no lease
     is usable, so the next round finds nothing); with no live lease it does not touch the database; never raises.
2. **An emergency LOCK revokes live leases too** (T10: "emergency ... becoming active ... for the installation", scope `all`,
   reason `emergency`). `door_emergency.cancel_capture_leases` now acts for a real incident of kind `open` or `lock_secure`;
   `on_emergency_open(conn, incident_id, kind)` records `kind` in the `emergency_cancel` audit row. Same idempotency (memory +
   audit row), same failure isolation (never blocks the door action). A LOCK does not refuse new leases (the owner decision
   covers the OPEN only), and the sweep does not act on a LOCK.

Drills of either kind never cancel or refuse anything.

## Not in this change

- No bridge / WisKey change; no migration; no UI change (the start screen shows the refusal's Hebrew text as any other refusal).

## Tests

`smplwise_vms/backend/tests/test_capemergency_295.py` (fakes only: scripted emergency engine, fake lease bridge, fake host):
shipped build / flag off = nothing; flag on + active leases = revoked with reason `emergency`, one `lease_revoke` scope `all`,
one audit row; idempotency (repeat and after the in-memory set is cleared); drills (OPEN and LOCK) = nothing; no live lease = nothing
sent or audited; a failure in the hook, in `route_on` or in the trigger does not block the open (all doors acknowledged).

`smplwise_vms/backend/tests/test_capemergency2_295.py` (CAPEMERGENCY2-295, fakes only): shipped build and flag switched off = the
plain refusal, no sweep, no audit; flag on + OPEN in effect = 409 `capture_lease_emergency` + `emergency_refuse` audit, nothing
sent; every apply state counts; after the release a lease is issued; a drill OPEN and a LOCK do not refuse; unreadable incident
state = fail closed; race gap (an issue that predates the incident commit) revoked by the cancel; a lease live after the cancel
revoked once by the sweep; sweep with no live lease touches no database, and leaves leases alone with no OPEN in effect; a failed
cancel reconciled by the sweep; a sweep failure does not break the worker round; LOCK revokes with reason `emergency` (scope
`all`, one audit row with kind, idempotent across a restart); LOCK with flag off / drill LOCK / LOCK with no lease = nothing; a
cancel failure (hook, route_on, trigger) never blocks the LOCK; unknown kind ignored; the HTTP capture start refused with the
closed code while an OPEN is in effect.
