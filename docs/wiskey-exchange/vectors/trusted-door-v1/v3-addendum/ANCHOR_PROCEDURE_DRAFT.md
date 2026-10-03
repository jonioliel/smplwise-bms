# Clock anchor procedure: DRAFT (`wiskey-trusted-door-v1`)

Status: DRAFT, Arx, 2026-10-04. Not verified. No implementation exists. This draft records the procedure as agreed in
the 2026-10-04 exchange (ARX_ACK_TO_V3_ADDENDUM_PLAN, ARX_REPLY_TO_V3_ADDENDUM_ACK, ARX_ACK_TO_V3_ADDENDUM_ACK). The
`clock` and `anchor` cases in `GOLDEN_VECTORS_v3_addendum.json` model it and are marked `model_only`. Neither this text
nor the cases prove real durability.

## 1. Health signal

- **Source:** the Supervisor `/host/info` of the host that runs the bridge. The fields are `dt_synchronized` and `dt_utc`.
- **Reader:** the bridge, using the Supervisor access that Arx already has. No secret goes to WisKey. WisKey receives
  only the result (healthy or not healthy, plus the UTC value) through an internal interface.
- **Healthy** means all of the following are true:
  - The Supervisor is available.
  - The sample was read without error after the last bridge restart.
  - The sample is at most **30 000 ms** old, measured on the bridge's local monotonic clock from the moment it was
    read. Exactly 30 000 ms is allowed; anything older blocks.
  - `dt_synchronized` is exactly boolean `true`.
  - `dt_utc` is a valid UTC time.
- `use_ntp` alone, the OS NTP status, or any other source is not a signal.
- An installation without a Supervisor gets no automatic fallback, so the call is blocked.
- Anything else blocks with `time/clock_invalid`. Nothing is dispatched and the replay purge does not run.
- A bridge restart invalidates the sample. No sample is valid until the next read.
- A valid sample **does not replace** the other checks, which run on every open:
  - the floor;
  - the stored high-water;
  - the 2000 ms UTC/monotonic divergence;
  - the window `issued_at <= now < expires_at`, with no tolerance for future timestamps.
- The sample's UTC is never used as the current time.
- The supported Supervisor versions, the exact field schema, the sampling schedule, the read time limit, the hand-over
  schema and the freshness check at use go into `COMPAT.md` (planned for 2026-10-08). Until then they are not defined.

## 2. Bootstrap (first anchor)

- The first anchor is written automatically only when **both** conditions hold:
  - the signal is healthy;
  - UTC ≥ the contract floor **`2026-01-01T00:00:00Z`** (the floor itself is allowed; 1 ms below it is refused).
- The anchor is written atomically. If the write fails, no anchor exists and opens and replay purge stay blocked.
- The floor alone, or a message timestamp alone, never sets an anchor.
- The floor is a fixed contract value, not a build date. Changing it requires explicit agreement and new boundary vectors.

## 3. High-water (intermediate anchor)

- WisKey stores a high-water UTC value in milliseconds in SQLite metadata. That metadata is not deleted with the
  seven-day history.
- The high-water advances only from healthy samples. It is written **before** a dispatch and before any replay purge.
- If that write fails, opens and replay purge are blocked until a later write succeeds.
- The high-water never decreases automatically. A healthy sample below it leaves it unchanged and the block remains.
- Without a decrease, the block lasts until UTC ≥ high-water. Equality is allowed. The other clock conditions must hold
  as well.
- On restart, health and UTC ≥ high-water are checked, and the UTC/monotonic reference is re-established in memory.
  Monotonic readings are never compared across boots.

## 4. Re-anchor (manual decrease)

- **Owner only, through Arx.** Arx RBAC is the only authority. WisKey adds no permission check or approval of its own.
- Every re-anchor is audited: who, when, the old value and the new value.
- It is a maintenance action under a separate maintenance contract. It is not needed for any open.
- **Why the order below matters:** after UTC is decreased, an old unconsumed envelope could fall inside its
  `issued_at`/`expires_at` window again, and the replay record does not know it. This conclusion follows from the time
  rule; no run has shown it.
- The required order:
  1. Stop trusted calls.
  2. Rotate the generation of the **HMAC authentication material between Arx and the bridge**, following the approved
     procedure.
  3. Verify that signatures from the old generation are rejected (`signature/bad_signature`).
  4. Decrease the high-water **atomically**. If the write fails, the old value stays.
  5. Re-baseline the UTC/monotonic reference.
  6. Resume trusted calls.
- `pending` and replay records are kept. Nothing is deleted, and no secret goes to WisKey.
- After the decrease, an old unconsumed envelope from the previous generation is rejected at the signature stage,
  before any time check.
- Without a generation change, no decrease is possible and the block lasts until UTC ≥ high-water.
- **Until the HMAC rotation procedure is approved, the decrease is unavailable.** That procedure has a draft planned
  for 2026-10-12 and closes after the signer is chosen. This unavailability is today's default.

## 5. Two separate rotation procedures

1. **Rotation of the HMAC authentication material between Arx and the bridge.** This rotation protects the re-anchor in
   section 4. Draft planned for 2026-10-12.
2. **The Ed25519 package signer.** It is unrelated to procedure 1 and does not replace it. It follows after the signer
   is chosen.

No key is handled in this round.

## 6. Not verified

- A real Supervisor and its versions.
- SQLite durability of the high-water, atomic writes, concurrency and restarts.
- The rotation procedure.
- Verification needs an implementation and the owner's explicit approval for that specific run.
