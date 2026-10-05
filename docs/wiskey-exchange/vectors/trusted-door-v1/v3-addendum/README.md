# WisKey trusted caller: v3-addendum vectors (`wiskey-trusted-door-v1`)

Status: DRAFT, Arx, 2026-10-04, for delivery on 2026-10-06 (agreed in `ARX_ACK_TO_V3_ADDENDUM_ACK_2026-10-04.md`).
This package holds documents and synthetic vectors only. No `door_open`, `door_open_status` or
`trusted_door_capabilities` service exists in Arx or in the bridge. This package does not authorize building one. Runtime
work and any live run need the owner's approval.

The package goes into the exchange folder as `trusted-door-v1/v3-addendum/`, next to `v3/`. It complements the earlier
files and does not edit any of them:

- `../GOLDEN_VECTORS.json` (v1 `vectors` + v2 `contract_vectors`), SHA-256 `2966133294109546e5a1d4b6dc319264bf17b80a1e468088b087c549f10c5a1f`
- `../v3/GOLDEN_VECTORS_v3.json` (82 cases), SHA-256 `f162f8a8a551be9ce0016844067261473df7e404fedeeb864899ed78b95b1263`

Both stay binding. The exceptions are the items listed under "Supersedes" below, plus the v2 case that v3 already superseded.

## Files

| File | What it is |
|---|---|
| `GOLDEN_VECTORS_v3_addendum.json` | The corrected response schemas, the contract additions, one metadata correction and 76 cases. Generated; do not edit by hand. |
| `MANIFEST.json` | Version fields, the file list, the pinned hashes of the earlier files, the complements/supersedes map, the per-group map to the older case ids, and the counts. Generated. |
| `ANCHOR_PROCEDURE_DRAFT.md` | Draft wording of the clock anchor procedure: bootstrap, high-water and owner-only re-anchor. Not verified. |
| `NOTE_FOR_WISKEY_v3_addendum.md` | A short note in Hebrew. |
| `check_v3_addendum.py` | An offline checker that uses only the Python 3.9+ standard library (see "How to verify"). |
| `SHA256SUMS` | The SHA-256 of every other file in this folder (`sha256sum -c SHA256SUMS` works). |

Generator and drift test, on the Arx side: `smplwise_vms/backend/tests/test_wiskey_v3_addendum.py`. Inside the
repository, the folder is `docs/wiskey-exchange/vectors/trusted-door-v1/v3-addendum/`.

The HMAC key in the file is the public TEST constant from v1-v3. It is not a pairing secret. Never use it as one, and
never derive one from it. No second key exists in this package. In the anchor scenarios, the HMAC "generation" is an
abstract label.

## Version fields

`protocol: wiskey-trusted-door-v1`, `vectors_version: 3`, `package: v3-addendum`, `addendum_version: 1`,
`format_version: 1`. A later correction becomes a new `addendum_version` or a new package. The cases in this file are
never edited.

## Supersedes and complements

| Target (older) | Replaced by | Why |
|---|---|---|
| `v3 response_schemas.status_unknown` | `response_schemas.status_unknown` here | `reason` is only `pending` or `not_found_or_expired`. `unconfirmed`, `interrupted` and `outcome_persistence_failed` belong only in `door_open_unknown` or in a `stored_result` outcome. Every v3 `status_unknown` answer stays valid (the checker verifies this). |
| v3 case `size_8193_bytes_invalid_utf8_utf8_first`, field `signed_message_code_points` (8179) | `metadata_corrections[0]`: `not_applicable` | Code points are not defined for invalid UTF-8. The refusal `encoding/invalid_utf8` and the 8193 bytes stay binding. |
| v2 `status_station_mismatch_vs_open_record` | (already done by v3) `status_station_mismatch_answers_not_found` | Carried forward for completeness. |

`MANIFEST.json` → `group_complements` maps each new group to the older case ids it extends. The station group closes
v3 open item W-f. The anchor group answers W-b as a draft.

## The cases

| Group | stateful | reject | model | Total | Marked |
|---|---|---|---|---|---|
| `schema` | 3 | 0 | 0 | 3 | |
| `station` | 8 | 0 | 0 | 8 | |
| `capabilities` | 0 | 0 | 27 | 27 | `model_only` |
| `clock` | 20 | 2 | 0 | 22 | `model_only` |
| `anchor` | 0 | 0 | 16 | 16 | `model_only` |
| **total** | **31** | **2** | **43** | **76** | |

Every `capabilities`, `clock` and `anchor` case carries `model_only: true` and `verified: false`.

- **schema (3):** one per reason that may no longer appear in `status_unknown`. Each is a signed `door_open_status` for
  an open stored as `unknown/<reason>`. The answer is `stored_result` with that outcome. The forbidden top-level
  `{"result": "unknown", ..., "reason": "<reason>"}` must fail the corrected schema. `accepted_by_v3_schema: true`
  records that the v3 schema let it through.
- **station (8):** `door_open` for an unknown station, a station whose entry is not loaded, a station with an
  unverified mapping, a station with no mapping, and a case variant of a loaded station. Each one is answered
  `state/relay_not_allowed`. `state_setup.lock_fallback_configured` is true, and neither a lock nor another station is
  used (`fallback_used: false`). Two cases bind the order on purpose, with two defects each: capability before
  mapping, and mapping before the pending record. One control case is acknowledged.
- **capabilities (27):** the Arx-side handling of `smplwise_bridge.trusted_door_capabilities` (read-only,
  `return_response`, `schema_version: 1`, `stations[{station, allowed_relays, mapping_revision}]`):
  - The cases cover a valid list, an empty list, a station with an empty list, and every station with an empty list.
  - A missing service, a timeout and an error each disable selection without falling back to the stale list.
  - There are 13 malformed responses and one unknown `schema_version`.
  - `relay_not_allowed` invalidates the cache and triggers a refresh, with no retry, no alternate relay and no lock.
    A second case has that refresh time out.
  - A bridge restart invalidates the cache, with and without a fresh answer.
  - A `mapping_revision` change triggers a refresh, and a plain display uses the valid cache.
  - The list is a hint for display and selection only. It never authorizes anything.
- **clock (22):** the Supervisor `/host/info` signal, layered on the v3 clock snapshot:
  - `dt_synchronized` false, missing, the string `"true"`, and `use_ntp` without it.
  - A read error and a read timeout.
  - The sample-age boundaries: exactly 30 000 ms is allowed, 30 001 ms is blocked.
  - A sample that was read before a bridge restart.
  - `dt_utc` unparseable, missing, without a UTC offset, or not a real date.
  - No Supervisor at all, with no fallback even when the OS claims NTP sync.
  - A fresh sample does not replace the other checks: ±2000/2001 ms divergence, 1 ms below the high-water, a future
    `issued_at`, and a stale sample UTC used as "now" all keep their answers.
  - A status call is blocked too.
  - Every block is `time/clock_invalid`. It has no dispatch and no replay purge.
- **anchor (16):** event scenarios, where each step states its observable result:
  - Bootstrap exactly at the floor `2026-01-01T00:00:00Z`, and 1 ms below it.
  - Bootstrap with an unhealthy signal, and bootstrap whose write fails.
  - High-water advance before the dispatch, and advance from healthy samples only.
  - A write failure that blocks, and no automatic decrease.
  - A block that lasts until UTC ≥ high-water (1 ms below is blocked, equality is allowed).
  - The decrease is unavailable until the rotation procedure is approved (today's default).
  - The full re-anchor: pending and replay are kept, an old unconsumed envelope from the previous generation is
    rejected `signature/bad_signature`, and a new-generation envelope is dispatched.
  - Refusals: without rotation, with calls still running, without verification of the old generation, from a
    non-owner. A failed decrease write leaves the old high-water in place.

A v3 clock case has no `clock_signal`. Read it as "signal healthy and fresh, not under test". All v3 outcomes stay as
they are.

## Case format

- `kind: signed`: the v3 fields (`signed_message_json`, `service_data_json`, digests and `expected_dto` for stateful
  cases, `state_setup`, `expected_side_effects`, `response_schema`, `expected_response`, `forbidden_responses`).
  `expected_side_effects` adds `fallback_used`. `state_setup` may add `station_registry`, `lock_fallback_configured`
  and `clock_signal`.
- `kind: capabilities_model`: `trigger`, `cache_before`, `service_call` (`null` = no answer yet), optional
  `open_response`, `expected_selection {enabled, reason, stations}`, `expected_cache_after`, `expected_actions`.
- `kind: anchor_scenario`: `initial_state`, then `steps` in order, each with `op`, its inputs and `expect`.

The exact definitions are in the JSON file under `case_format` and `contract_addendum`.

## How to verify

```
python check_v3_addendum.py
```

The checker works offline, uses only the standard library and writes nothing. It checks the following:

- The JSON structure, parsed strictly.
- The version fields.
- Unique case ids, including against the v2/v3 ids.
- The counts against the manifest.
- That `SHA256SUMS` covers every file and every hash matches.
- That the earlier files are unchanged: their pinned hashes, the v1 `vectors` array hash and the v3 `.sha256` files.
- For every signed case: the digests and the HMAC, recomputed with the TEST key.
- That every `expected_response` matches its schema, and that every forbidden response fails it.
- That the corrected `status_unknown` refuses the three reasons and still accepts every v3 `status_unknown` answer.
- The `model_only` marking.

It finds the earlier files in the exchange layout (`../`, `../v3/`) or in the repository layout. Use `--base DIR` to
point it elsewhere. Exit code 0 means every check passed.

The checker does not run a door service, and it does not re-run the clock, anchor or capabilities models. Their
expected values are what a conforming implementation must produce. The Arx test module runs TEST-only reference models
and checks that they agree with every case.

## Not verified

- Any runtime. No door or capabilities service exists, and no HA, network, device or secret was used.
- A real Supervisor `/host/info`, the supported versions and the exact `dt_utc` format. These go into `COMPAT.md`
  (planned for 2026-10-08), together with the sampling schedule, the read time limit, the hand-over schema to the
  bridge and the freshness check at use.
- SQLite durability of the high-water, concurrency, and behaviour across restarts.
- The HMAC rotation procedure between Arx and the bridge (draft planned for 2026-10-12). It is separate from the Ed25519
  package-signer procedure and is not replaced by it.

## Open items

1. `mapping_revision` type: Arx proposes an opaque string of 1-128 code points without control characters, compared
   for equality only. WisKey, please confirm or correct.
2. The capabilities response is treated as a closed schema: an unknown field makes it malformed. Please confirm.
3. `dt_utc` format: the cases use a model rule (RFC 3339 UTC, `Z` or `+00:00`). The binding format goes to `COMPAT.md`.

v1 lock: not declared until the open items above, `COMPAT.md` and the rotation procedure are closed.
