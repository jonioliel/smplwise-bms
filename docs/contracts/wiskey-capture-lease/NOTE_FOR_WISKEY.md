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
