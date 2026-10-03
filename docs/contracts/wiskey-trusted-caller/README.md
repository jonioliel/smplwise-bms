# WisKey trusted caller: signing golden vectors

Status: 2026-10-03, prepared by Arx for round 4 of the WisKey coordination (`wiskey-trusted-door-v1`).
Vectors only. There is no `door_open` or `door_open_status` service yet, on either side. The final DTO field
list is settled in a separate shared DTO file after these vectors are verified.

## Files

- `GOLDEN_VECTORS.json` - `vectors_version: 2`. The v1 `vectors` array (29 vectors, generated from the existing Arx
  signers) is unchanged; v2 adds `contract` and `contract_vectors` (68 cases). Do not edit it by hand. Locked by
  SHA-256 `2966133294109546e5a1d4b6dc319264bf17b80a1e468088b087c549f10c5a1f` (verified by WisKey 2026-10-04).
- `GOLDEN_VECTORS_v3.json` - `vectors_version: 3`, a separate file with 82 complementary cases for WisKey's answers
  W1-W8, response schemas and stateful setups. It supersedes one v2 case
  (`status_station_mismatch_vs_open_record`); everything else in `GOLDEN_VECTORS.json` stays binding.
- `DTO_DRAFT_v3.md` - the current shared DTO draft. `DTO_DRAFT.md` (v2) is kept unchanged as the verified record.
- `NOTE_FOR_WISKEY_v3.md` - what changed since vectors_version 2. `NOTE_FOR_WISKEY_v2.md` - since vectors_version 1.
- Generator and drift test: `smplwise_vms/backend/tests/test_wiskey_golden_vectors.py`.
  - `pytest tests/test_wiskey_golden_vectors.py` (from `smplwise_vms/backend`) fails if the file and the
    signers disagree.
  - `python tests/test_wiskey_golden_vectors.py --write` rewrites both files (the v2 bytes must come out identical).

The HMAC key in the file (`test_hmac_key.value`) is a public test constant. It is not a pairing secret. Never
use it as one, and never derive one from it.

## What the current canonicalization does

Both signers use the same expression: the add-on's `smplwise/services/ha_bridge.py: sign()` and the bridge's
`custom_components/smplwise_bridge/signing.py: sign()` (mirrored byte for byte in `smplwise_vms/integration/`).
The test checks that they agree on every vector.

```
canonical   = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
body_sha256 = sha256(canonical).hexdigest()                      # lower-case hex
hmac_input  = f"{ts}.{nonce}.{body_sha256}"                     # ts = decimal epoch seconds
sig         = HMAC-SHA256(key=secret.encode("utf-8"), msg=hmac_input.encode("utf-8")).hexdigest()
wire        = {**body, "ts": ts, "nonce": nonce, "sig": sig}
```

The verifier rebuilds the body as the wire message minus `ts`, `nonce` and `sig`, then recomputes `sig`.

What this does, observed in the vectors:

- **Key order:** every object, at every depth, is sorted by Unicode code point (Python `str` order). Arrays
  keep their order.
- **Whitespace:** none. Separators are `,` and `:`.
- **Strings:** non-ASCII is written as raw UTF-8, including Hebrew, non-BMP characters, U+2028/U+2029 and
  DEL (U+007F). Escapes: `\"`, `\\`, `\b \f \n \r \t`, and the other C0 controls as lower-case `\u00xx`.
  `/` is not escaped. No Unicode normalization: NFC and NFD give different hashes.
- **Integers:** plain decimal with arbitrary precision. There is no range check.
- **Floats:** Python `repr` spelling (`1.0`, `1e-07`, `1e+16`, `-0.0`).
- **NaN / Infinity:** accepted and written as bare `NaN` / `Infinity` tokens, which are not JSON.
- **Lone surrogates:** the signer raises `UnicodeEncodeError` and produces no bytes.
- **Booleans / null:** `true`, `false`, `null`.

## Differences from RFC 8785 (JCS), as tested

The test compares each vector with an independent JCS reference implementation in the test module. That
reference is itself checked against the RFC 8785 number examples. Results:

| Area | Current Arx output | JCS | Where it matters |
|---|---|---|---|
| Key order with non-BMP keys | code-point order: `U+E000` before `U+1F600` | UTF-16 code-unit order: `U+1F600` (D83D...) before `U+E000` | Only keys containing characters U+E000-U+FFFF next to non-BMP characters. The envelope keys are fixed ASCII, so `wiskey-trusted-door-v1` cannot hit this. |
| Floats | `1.0`, `100.0`, `1e-07`, `1e+16`, `-0.0` | `1`, `100`, `1e-7`, `10000000000000000`, `0` | The contract forbids floats. |
| Integers above 2^53 | exact digits (`9007199254740993`) | IEEE-754 rounding (`9007199254740992`) | The contract rejects anything outside +/-(2^53-1). |
| NaN / Infinity | emitted as bare tokens | an error | The contract rejects them. |

For every input the contract accepts (only ASCII keys, strings without lone surrogates, integers within
+/-(2^53-1), booleans, null, objects and arrays, no floats), the current output equals JCS byte for byte. Every
`accept` vector checks this (`jcs_equal: true`). The format is still **not declared as JCS**. Verifiers should
match these vectors, not a generic JCS library. Any change to the serialization requires a new `protocol` value.

## How the envelope is carried by the existing signer

The existing verifier removes the top-level `ts`, `nonce` and `sig` before hashing. So with the current code:

- The envelope `nonce` is the signing nonce. It goes into `hmac_input`, not into the hashed body. It is still
  authenticated, because it is part of the HMAC input.
- `signed_body` = the envelope without `nonce`. `canonical_*` and `body_sha256` are computed over it.
- `ts` = the epoch seconds of `issued_at`. `expires_at` sits inside the hashed body.
- `wire_message_json` is the message as sent: the signed body plus `ts`, `nonce` and `sig`.

## Vector fields

- **All vectors:** `id`, `expect` (`accept` / `reject` / `accept_but_not_jcs`), `description`, `input_json`.
  `input_json` is the exact JSON text to feed your parser.
- **Signable vectors:** `canonical_utf8`, `canonical_hex`, `body_sha256`, `ts`, `nonce`, `hmac_input`,
  `hmac_sha256`, `jcs_utf8`, `jcs_equal`.
- **Envelope vectors:** in addition, `envelope`, `signed_body` and `wire_message_json`.
- **`reject` vectors:** `reject_reason`, plus `current_code_if_not_rejected`. That field shows what the existing
  code would do after stdlib `json.loads`: the canonical bytes, the HMAC, and whether the existing verifier
  accepts the HMAC. It is there to show why a separate parse/schema check is needed. It is not a target to match.

## How to verify

For each vector with `expect: accept`:

1. Parse `input_json` with your strict parser.
2. Canonicalize the parsed body (for envelopes, use `signed_body`) and compare the bytes with `canonical_hex`.
3. Check `body_sha256`.
4. Build `hmac_input`, compute the HMAC with the test key, and compare it with `hmac_sha256`.
5. For envelopes, also verify `wire_message_json` end to end.

For each vector with `expect: reject`, your parser or schema must refuse `input_json` before any side effect,
with the reason class given in `reject_reason`.

## vectors_version 2: contract vectors (DTO draft)

Added 2026-10-04 after WisKey's eight answers. The draft contract is `DTO_DRAFT.md`; the machine-readable rules are
in the file's `contract` object. Nothing in the v1 `vectors` array changed: the test pins its canonical SHA-256
(`3bb4bb22...`), and the v1 file hash WisKey verified (`fd39b7ec...`) is recorded in `vectors_version_history`.

Each entry of `contract_vectors` has:

- `id`, `category` (`types`, `time`, `status`, `state`, `signature`, `transport`), `service` (the HA service called),
  `expect` (`accept` / `reject` / `stateful`), `reason`, `reject_stage`, `reject_code`, `now` (epoch seconds; `null`
  = no valid clock) and `now_iso`.
- `signed_message_json`: the inner wire message string, and `service_data_json`: the exact outer `service_data`
  text, `{"signed_message_json": "..."}`. Feed `service_data_json` through a normal JSON parser (that is what HA does)
  and then your strict parser on the string.
- Exceptions: `transport_inner_invalid_utf8` gives `signed_message_utf8_hex` only; `transport_outer_lone_surrogate`
  gives `service_data_json` only (ASCII-escaped); `transport_outer_duplicate_collapsed_by_ha` also gives
  `service_data_as_received_by_bridge`; the `transport_*_shape` cases give a `service_data_json` that is not a
  one-string envelope.
- `accept` and `stateful` cases also carry `signed_body`, `canonical_utf8`, `body_sha256`, `hmac_input`,
  `authenticated_message_sha256`, `sig` and `expected_dto`.
- `stateful` cases pass every stateless stage; `state_setup` says what the store holds, and `reject_code` (stage
  `state`) or `stateful_expectation` says the outcome.

Every reject case has exactly one defect, so `reject_stage` and `reject_code` are both binding. Reject cases are
correctly signed wherever the defect allows it, so the refusal comes from the named stage and not from the HMAC
(placeholders are marked in `reason`).

| Category | accept | reject | stateful | Total |
|---|---|---|---|---|
| types | 1 | 20 | 0 | 21 |
| time | 2 | 12 | 0 | 14 |
| status | 1 | 7 | 2 | 10 |
| state | 0 | 0 | 4 | 4 |
| signature | 0 | 4 | 0 | 4 |
| transport | 2 | 13 | 0 | 15 |
| **total** | **6** | **56** | **6** | **68** |

The test module also holds a strict reference validator (TEST code only, not product code). The tests prove that
every reject case is refused at its declared stage and code with zero pending records and zero dispatches, that
every accept case yields exactly its `expected_dto`, that a status call never opens, that the v1 reject vectors are
also refused by the v2 validator, and that the existing verifier accepts several of these cases (string `ts`, numeric
nonce, 31 s lifetime, extra fields, collapsed duplicates), which is why the strict stages are required.

## vectors_version 3: complementary vectors (DTO draft v3)

Added 2026-10-04 after WisKey's reply to v2 (W1-W8 accepted by Arx). `GOLDEN_VECTORS_v3.json` is a separate file;
it references the v2 file by hash (`complements`) and lists the one superseded v2 case (`supersedes`). Cases are in
`contract_vectors_v3` with the v2 fields (`id`, `category`, `service`, `expect`, `reason`, `reject_stage`,
`reject_code`, `now`, `now_iso`, `signed_message_json`, `service_data_json`, digests and `expected_dto` for accept and
stateful cases) plus:

- `response_schema` and `expected_response` wherever the answer is determinate (every reject and stateful case; a
  stateless accept depends on the store and has `null`). The schemas are in `response_schemas`.
- `state_setup` (machine-readable store, capability, mapping, storage, dispatch result, clock) and
  `expected_side_effects` (`pending_created`, `dispatched`, `status_read`, `replay_purge_allowed`) for stateful cases.
- `forbidden_responses` on rejection cases: answers that must fail the case's schema.
- `signed_message_utf8_bytes` / `signed_message_code_points` on size cases; `verified: false` on clock cases;
  `replaces` on the replacement case.

| Category | accept | reject | stateful | Total |
|---|---|---|---|---|
| relay | 0 | 0 | 5 | 5 |
| size | 2 | 5 | 0 | 7 |
| identity | 16 | 17 | 0 | 33 |
| capability | 0 | 0 | 4 | 4 |
| status | 0 | 0 | 8 | 8 |
| response | 0 | 0 | 8 | 8 |
| rejection | 0 | 7 | 0 | 7 |
| clock | 0 | 1 | 7 | 8 |
| time | 0 | 2 | 0 | 2 |
| **total** | **18** | **32** | **32** | **82** |

The test module models the v3 path in TEST code only (stateless validator plus a toy store) and checks every case's
response and side effects, the forbidden responses, the byte counts, the v2 hash lock, and that the v3 reference keeps
every v2 accept/reject outcome. Current open items: `DTO_DRAFT_v3.md` section 11.

## Open items (historical)

All items below are decided. Items 1, 2, 6, 7 and 8 were settled by the v2 draft (string transport, closed schema,
exact ts/nonce, `params.target_request_id`, both digests); item 3 by the strict parser of the contract; item 4 by the
lone-surrogate reject vectors; item 5 by the 30 s lifetime in the contract while the 60 s window of other paths stays
unchanged. They are kept as the record of round 4. The current open items are in `DTO_DRAFT_v3.md` section 11.

1. **Duplicate keys cannot be detected after parsing.** Python's `json.loads` (and, as far as we know, the
   JSON loader in front of an HA service call; not verified here) keeps the last value. The bridge service
   handler receives a dict, so a duplicate `station` collapses and its HMAC verifies
   (`reject_envelope_duplicate_station`). Rejecting duplicates needs either a raw-text check where the JSON is
   parsed, or carrying the body as a signed string. To decide in the DTO file.
2. **The existing verifier does not reject unknown fields.** HMAC validity alone accepts them (the three
   `reject_envelope_unknown_*` vectors). The `door_open` handler needs an exact-schema check.
3. **No range or type checks in the signer.** Out-of-range integers, floats and NaN are signed without complaint.
   A strict parser on the verifier side is required. The test module's `_strict_loads` is a reference.
4. **Lone surrogates:** the signer cannot produce a vector (`UnicodeEncodeError`). Only a reject case exists.
5. **Window:** the existing `SIGNATURE_WINDOW_S` is 60 s on both sides. The trusted-caller contract asks for
   30 s, enforced through `expires_at`. Not changed here.
6. **Loose ts / nonce coercion in the existing verifier:** `int(message["ts"])` also accepts numeric strings and
   truncates floats; `str(message["nonce"])` accepts non-strings. The `door_open` handler should require an
   integer `ts` equal to `issued_at` and a string nonce of fixed format.
7. **`door_open_status` target:** the field that names the queried `door_open` request is not fixed. The
   status vector shows the envelope shape with empty `params` only.
8. **DTO digest:** which digest the bridge passes to WisKey (proposal: `body_sha256` of `signed_body`) is
   settled in the DTO file.
