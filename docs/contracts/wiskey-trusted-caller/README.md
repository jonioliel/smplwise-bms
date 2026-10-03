# WisKey trusted caller: signing golden vectors

Status: 2026-10-03, prepared by Arx for round 4 of the WisKey coordination (`wiskey-trusted-door-v1`).
Vectors only. There is no `door_open` or `door_open_status` service yet, on either side. The final DTO field
list is settled in a separate shared DTO file after these vectors are verified.

## Files

- `GOLDEN_VECTORS.json` - 29 vectors, generated from the existing Arx signers. Do not edit it by hand.
- Generator and drift test: `smplwise_vms/backend/tests/test_wiskey_golden_vectors.py`.
  - `pytest tests/test_wiskey_golden_vectors.py` (from `smplwise_vms/backend`) fails if the file and the
    signers disagree.
  - `python tests/test_wiskey_golden_vectors.py --write` rewrites the file.

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

## Open items

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
