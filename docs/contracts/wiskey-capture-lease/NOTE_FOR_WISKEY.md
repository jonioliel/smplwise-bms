# Note for WisKey - wiskey-capture-lease-v1 (Arx 2026-10-16; aligned with WisKey's answer of 2026-10-21 in LEASEARX-295)

What Arx has built (on its side only, switched OFF): the lease ledger, the revocation stream sender, the triggers, and a closed
contract with golden vectors. WisKey approved the contract for implementation on 2026-10-21 (with corrections, SCHEMA.md section 7);
that is not a go-live permit. What Arx needs from WisKey before anything can be switched on (CR section 7.4):

1. A consumer of `smplwise_bridge.lease_event` that applies `lease_revoke` / `lease_heartbeat` / `lease_stream_reset` with the
   sequence rules of SCHEMA.md section 3 and answers with the closed set of section 4.
2. The silence rule: destroy every live lease after 15 s without a revoke or a heartbeat from Arx (Arx beats every 5 s while a
   lease is live; a heartbeat never extends a lease; nothing is sent while no lease is live).
3. The four lease requests (`capture_start` / `status` / `confirm` / `cancel`) through `smplwise_bridge.lease_request` (FINAL name; the
   revocation stream is `smplwise_bridge.lease_event`), on the same DTO v3 wire as the stream: `protocol = wiskey-capture-lease-v1`, service
   data exactly `{signed_message_json}`, NO generalized W1 envelope field and NO `kid` on the wire (the key id of a rotated key is bound
   into the MAC only; the bridge tries the key ids of its key set). The answers are the closed shapes of section 4 (the four
   `capture_*.answer.schema.json` and `CAPTURE_ANSWER_CODES.json`): Arx treats any other shape, an extra field, a code outside the
   action's table, `sent_unknown` to anything but `capture_confirm`, or a `request_id` where it is forbidden / missing where it is
   required as an unclear outcome, never as success.
4. The meaning and source of `binding_revision` for a station target; Arx carries it opaque (null while you do not publish it).
5. Your refusal of a lease whose `actor.id` is an HA system-generated / service user (Arx never signs one).
6. The confirm barrier: a `capture_confirm` racing a revoke is decided there; past the barrier the answer is `sent_unknown`.

Oracle: `GOLDEN_VECTORS.json` (HMAC key = the published TEST constant). Every `accept` vector must pass stages 1-7 with the stated
`now`; every `reject` vector must be refused at exactly the stated stage and code. No vector carries a card value, a person name,
an address, or any real key.

Changes after Arx's security review (LEASE-FIX, 2026-10-16) that touch you:

7. `lease_heartbeat.live_leases` now lists every lease Arx holds as live - `issued` (start sent, no answer yet) as well as
   `active`. It is informational only: please never keep, create or extend a session because of it (SCHEMA.md section 3).
8. A `rejected` answer's `stage` and `code` must each match `^[a-z][a-z0-9_]{0,63}$` and belong to the closed table (for a request:
   the action's); `request_id` is forbidden at the transport / encoding / parse / schema stages and required at binding / signature /
   time / state. Anything else is treated as an invalid answer (not an acknowledgement; an event is retried, a request is an unclear
   outcome and is not resent).
9. Arx no longer revokes everything when a heartbeat answer lists a lease Arx itself ended moments before (confirm / cancel
   racing the heartbeat); a ref Arx never issued still revokes all (F7).
10. Switching the route on needs the owner's separate go-live permit, enforced in Arx's code (`GO_LIVE_PERMITTED = False`), in
    addition to your consumer and a bridge that offers the service.

Deviations from the CR that affect the contract (recorded in SCHEMA.md section 6, not resolved): duplicate / conflict are keyed
on the message's MEANING `(actor.id, station, params)`, not the body hash - you MUST implement the meaning hash, or every retry
becomes a `conflict`; a new stream's reset is sequence 1 and the first revoke is 2; the `reason` enum is larger than CR 1.4
(the closed list is in `lease.schema.json`); Arx resets the stream after ONE `unknown_stream` answer to a heartbeat.
