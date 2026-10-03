# Arx golden vectors v3 for wiskey-trusted-door-v1 (2026-10-04)

Source: Arx branch pilot/wiskey-vectors-v3 (from pilot/wiskey-vectors-v2 c22b5f6a). Documents and synthetic vectors
only; no service, bridge or product code changed. Same public TEST HMAC constant.

Arx accepts W1-W8 as written in your reply of 2026-10-04. What changed since v2:

1. New `DTO_DRAFT_v3.md` (the current joint draft). `DTO_DRAFT.md` and `GOLDEN_VECTORS.json` are unchanged; the v2
   file keeps SHA-256 2966133294109546e5a1d4b6dc319264bf17b80a1e468088b087c549f10c5a1f (locked in the test).
2. New separate file `GOLDEN_VECTORS_v3.json`, `vectors_version: 3`, 82 cases (18 accept, 32 reject, 32 stateful):
   relay 5, size 7, identity 33, capability 4, status 8, response 8, rejection 7, clock 8, time 2. It complements v2
   (`complements.file_sha256`); run both files.
3. Replaced vector: v2 `status_station_mismatch_vs_open_record` is superseded by v3
   `status_station_mismatch_answers_not_found` (answer `unknown/not_found_or_expired` with `target_request_id`).
   `state/station_mismatch` is removed from the code set. The v2 case itself was not edited.
4. Codes added: `encoding/message_too_large`, `state/capability_missing`, `capability_invalid`, `capability_revoked`,
   `state/storage_unavailable`.
5. W1: relay = `physical_index` of your verified active mapping; vectors with mapping {2} (relay 2 accepted, relay 1
   refused) and relay 3 / 2^53-1 refused, all before pending.
6. W2: no forward skew; issued_at 1 s and 2 s in the future are `time/not_yet_valid`.
7. W3: station/actor.id/display_name 1/128/129 code points, non-BMP counted as 1, C0/C1/DEL (U+0001, TAB, U+001F,
   U+007F, U+0080, U+0085, U+009F, LF) refused, U+00A0 accepted, whitespace kept, case kept, non-UUID accepted.
8. W4: 8192/8193 bytes, ASCII and multi-byte, 8192 code points = 8320 bytes refused, size before parse, UTF-8 before
   size. The exact-size accept cases are padded with insignificant JSON whitespace.
9. W6/W8: every case with a determinate answer has `response_schema` and `expected_response`; the file has
   `response_schemas` (closed JSON Schema subset). Stateful cases carry a machine-readable `state_setup` and
   `expected_side_effects`. Rejection cases carry `forbidden_responses` that must fail the schema (request_id before
   the schema pass, leaked text/digests/station, wrong stage/code, rejected after a possible send).
10. W7: clock-health cases (anchor missing, UTC regression, divergence 2000 ms allowed, +/-2001 ms blocked, healthy
    clock is not a skew allowance) are marked `verified: false`.
11. Pinned: MASTER_SPEC_HE.md 1.1.0-planning and docs/security HA_IDENTITY_RBAC_HE.md 1.1 / DEPENDENCY_AND_SECRETS_AUDIT.md,
    by commit and SHA-256 (`relies_on_documents`). A contradicting change needs an agreed change request.

Open for WisKey (please confirm or correct): (a) `time/clock_invalid` as the code for all clock-health blocks;
(b) the anchor procedure and its owner; (c) the order inside stage `state`; (d) request_id echoed if and only if the
schema passed, including signature refusals; (e) reason sets (not_found_or_expired only for status; stored outcome
never pending; status on a completed open = stored_result; duplicate open while pending = unknown/pending without
target_request_id); (f) door_open for a station with no verified mapping (Arx proposes `relay_not_allowed`, no
vector yet); (g) your parser accepts insignificant JSON whitespace; (h) run v3 and report per case.

Open for Arx: signer (explicit nonce, string transport, 8192-byte guard), bridge services and capability hand-off,
response handling (no re-sign after unknown), access.release/lock.unlock migration per the owner's gate, the 60 s
window of other paths unchanged, owner approval before runtime work. None of this is implemented.
