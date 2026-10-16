# Note for WisKey - wiskey-capture-lease-v1 (DRAFT, Arx 2026-10-16)

What Arx has built (on its side only, switched OFF): the lease ledger, the revocation stream sender, the triggers, and a closed
contract with golden vectors. What Arx needs from WisKey before anything can be switched on (CR section 7.4, all W?):

1. A consumer of `smplwise_bridge.lease_event` that applies `lease_revoke` / `lease_heartbeat` / `lease_stream_reset` with the
   sequence rules of SCHEMA.md section 3 and answers with the closed set of section 4.
2. The silence rule: destroy every live lease after 15 s without a revoke or a heartbeat from Arx (Arx beats every 5 s while a
   lease is live; a heartbeat never extends a lease; nothing is sent while no lease is live).
3. The four lease requests (`capture_start` / `status` / `confirm` / `cancel`) in your generalized W1 envelope: please fix the
   bridge service name (Arx uses `lease_request` provisionally) and confirm or correct the answer shapes of section 4.
4. The meaning and source of `binding_revision` for a station target; Arx carries it opaque (null while you do not publish it).
5. Your refusal of a lease whose `actor.id` is an HA system-generated / service user (Arx never signs one).
6. The confirm barrier: a `capture_confirm` racing a revoke is decided there; past the barrier the answer is `sent_unknown`.

Oracle: `GOLDEN_VECTORS.json` (HMAC key = the published TEST constant). Every `accept` vector must pass stages 1-7 with the stated
`now`; every `reject` vector must be refused at exactly the stated stage and code. No vector carries a card value, a person name,
an address, or any real key.

Changes after Arx's security review (LEASE-FIX, 2026-10-16) that touch you:

7. `lease_heartbeat.live_leases` now lists every lease Arx holds as live - `issued` (start sent, no answer yet) as well as
   `active`. It is informational only: please never keep, create or extend a session because of it (SCHEMA.md section 3).
8. A `rejected` answer's `stage` and `code` must each match `^[a-z][a-z0-9_]{0,63}$`; anything else is treated as an invalid
   answer (not an acknowledgement, retried).
9. Arx no longer revokes everything when a heartbeat answer lists a lease Arx itself ended moments before (confirm / cancel
   racing the heartbeat); a ref Arx never issued still revokes all (F7).
10. Switching the route on needs the owner's separate go-live permit, enforced in Arx's code (`GO_LIVE_PERMITTED = False`), in
    addition to your consumer and a bridge that offers the service.

Deviations from the CR that affect the contract (recorded in SCHEMA.md section 6, not resolved): duplicate / conflict are keyed
on the message's MEANING `(actor.id, station, params)`, not the body hash - you MUST implement the meaning hash, or every retry
becomes a `conflict`; a new stream's reset is sequence 1 and the first revoke is 2; the `reason` enum is larger than CR 1.4
(the closed list is in `lease.schema.json`); Arx resets the stream after ONE `unknown_stream` answer to a heartbeat.
