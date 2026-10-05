# Arx golden vectors v2 for wiskey-trusted-door-v1 (2026-10-04)

Source: Arx branch pilot/wiskey-vectors-v2 (from pilot/wiskey-golden-vectors 9b05abbb). Documents and synthetic
vectors only; no service, bridge or product code changed. The HMAC key is the same public TEST constant.

What changed since vectors_version 1:

1. GOLDEN_VECTORS.json now has `vectors_version: 2`. The v1 `vectors` array (29 vectors) is unchanged; the file hash
   you verified (fd39b7ec...) is in `vectors_version_history`.
2. New `contract` object (fields, stages, codes, time rules, digests) and `contract_vectors`: 68 cases
   (6 accept, 56 reject, 6 stateful): types 21, time 14, status 10, state 4, signature 4, transport 15.
3. Every case carries `service_data_json` = `{"signed_message_json": "<wire JSON string>"}` and, where representable,
   the inner `signed_message_json`, plus `expect`, `reason`, `reject_stage`, `reject_code` and `now`.
4. Accept/stateful cases carry `body_sha256`, `authenticated_message_sha256` (SHA-256 of UTF-8 hmac_input) and
   `expected_dto`.
5. New DTO_DRAFT.md: Arx accepts your eight answers as the draft contract. One string field `signed_message_json`;
   closed schema; action is `door_open` / `door_open_status`; floats, NaN/Infinity, unsafe integers, lone surrogates
   and invalid UTF-8 refused; 30 s max lifetime, refused exactly at expiry; ts = epoch(issued_at), int only; nonce
   32 lower-case hex (Arx will pass it explicitly), sig 64; status uses `params.target_request_id`; DTO carries both
   digests, never the secret or sig.
6. Validation order before any pending or dispatch: transport, encoding, parse, schema, binding, signature, time,
   state (your store). Each reject case has one defect, so stage and code must both match.
7. Stateful cases (station vs open record, unknown target, identical duplicate, request_id reuse, nonce reuse, relay
   outside the station range) pass every stateless stage; their outcome is described, not computed.

Open items for WisKey: (W1) allowed relay range per station; (W2) tolerate up to 2 s future skew on issued_at?;
(W3) station id format and actor.id/display_name limits (Arx proposes 128); (W4) max signed_message_json length
(Arx proposes 8 KiB); (W5) capability failure codes, and whether station_mismatch should answer not_found_or_expired;
(W6) success/unknown/stored-result response shapes; (W7) clock-validity rule; (W8) refusal response shape.

Open for Arx: signer with explicit 32-hex nonce and the string transport; the bridge services, strict parser, DTO
and capability hand-off; no re-sign after unknown; access.release/lock.unlock migration per the owner's gate; the
60 s window of other bridge paths stays unchanged. None of this is implemented yet.
