# CR-WISKEY-V2-CONSUMER-295: one strict Arx consumer for WisKey access_state v1 and v2

Status: built on `pilot/WKV2-295` (from `release/2100`), target 2.10.1. Fakes only. GO_LIVE_PERMITTED stays False, all eight
WisKey switches stay OFF, no live access_state client exists, no migration.
Closes on the Arx side: round-12 audit finding F-01 (no v2 consumer, two duplicate v1-only parsers) and the Arx half of F-02
(empty bookkeeping read as `revocation_pending=false`). Related: F-04 (no fallback), F-05 (no physical claim), F-06 (stations_synced
taken from the answer and cross-checked).

Sources: the WisKey delivery `3d09290a4a257d470bff6081a9f31d3ad96a6267`, payload `handoff/arx-exchange/wr12/1`
(`contracts/READBACK_V2_CONTRACT_AND_MIGRATION.txt`); the implementation `c932c553f45d5e304ba87d42a422e5c9f04a1cfe`
(`access/person_readback.py`, `access/revocation_snapshot.py`, `arx_readback_api.py`, tests `test_arx_revocation_*_v2.py`); the WisKey
team's consumer rules relayed by the owner on 2026-10-21. Static reading only: nothing was run against WisKey or Home Assistant.

## 1. What changed

- New module `smplwise_vms/backend/smplwise/services/wiskey_access_state.py`: the only parser of an access_state answer
  (`parse_result`, `parse_frame`, `unwrap_frame`), the v2 verdict (`revocation_verdict_v2`) and Arx's last-known doors record
  (`last_known_stations`).
- `access_grant_engine.access_state_from_raw` (STATIONSYNC-295) and `wiskey_acr5.parse_access_state` (WKPEER-295) no longer parse.
  Both call the new module and only project the parsed value into their existing result types. The old `_station_ids`, `_row`,
  `_queues`, schedule and policy checks and the envelope check were removed from the callers (`schedule_ok`, `policy_ok`,
  `Assignment`, `PendingQueues`, `AccessState` are re-exported by `wiskey_acr5` from the new module).
- `WiskeyServiceEngine(..., last_known_stations=...)` and `engine_for(db)` wire a database-backed last-known record. Production still
  passes no access_state reader, so the live revocation status stays UNKNOWN and a live revoke stays `revoking`.
- `wiskey_acr5`: `access_state_request(..., version=2)` names `hikvision_intercom/users/access_state_v2`; capability key
  `acr5_01_v2` = `person_access_state_v2`; `parse_access_state(..., expect=)` and `revocation_pending_at(..., expect=,
  last_known_stations=)`.
- Tests: `tests/test_wkv2_295.py` (table-driven) with synthetic fixtures in `tests/fixtures/wiskey_access_state_v2/`
  (`PROVENANCE.txt` maps each file to the WisKey test or rule it comes from).

## 2. The contract Arx accepts

Version dispatch on `schema_version`, which must be a strict int (not bool, not a string, not a float):

| schema_version | command | accepted shape |
|---|---|---|
| 1 | `hikvision_intercom/users/access_state` | the frozen v1 read contract, as before. Additive top-level and row keys are ignored. |
| 2 | `hikvision_intercom/users/access_state_v2` | closed: exactly the v1 keys plus `central_revocation_predicate` and `central_revoked`. |
| anything else | - | refused, `unsupported_schema` |

A caller that sent one command pins its version (`expect=`). A v1 answer to a v2 question, or the reverse, is refused
(`schema_mismatch`). A v2-labelled answer that carries only v1 keys is refused (`missing_field`). Nothing is ever re-asked or re-judged
as v1 after a v2 failure.

Rules for both versions:

- Envelope: `type == "result"`, a positive non-bool `id`, `success` exactly true with an object `result`. An error envelope becomes a
  typed refusal carrying WisKey's error code (`readback_unavailable`, `revision_conflict`, `feature_disabled`, `unauthorized`, ...).
- `observation == "durable_repository_snapshot"`, `scope == "all_managed_stations"`.
- `user_id` exactly equal to the person asked about (no trimming, no case folding).
- `presence` in `present`, `delete_pending`, `absent`. Present: `person_revision` is a strict positive int, at most 2^53-1, and equal
  to the revision of the caller's fresh `users/get` (else `revision_conflict`). Not present: `person_revision` null.
- `revocation_pending`, `stations_synced` are a bool or null. Only a present person can be `revocation_pending=false`.
- `assignments`: a list of at most 1024 rows, unique `station_id`; each row has `station_id`, `enabled` (bool), `allowed_locks`
  (sorted unique subset of {1, 2}), `desired_revision` / `applied_revision` (null or a bounded revision), `sync_state` (null or one
  of WisKey's seven states), `applied` (bool or null).
- `timing_policy`: null or the mode / schedule / bindings triple (mode `ha` requires empty bindings).
- `pending`: exactly the six arrays `bindings`, `tombstones`, `cards`, `pins`, `operations`, `unverified`; each at most 1024 unique
  ids. An id is 1 to 128 characters, has no control character (C0 or DEL) and is not blank. The six arrays are never collapsed into
  one boolean, and `unverified` stays apart from the five removal arrays.
- Each former caller keeps its own extra v1 rule unchanged: the engine refuses `revocation_pending=false` beside a non-empty array;
  the ACR5 consumer refuses `delete_pending` without `revocation_pending=true`.

Extra rules for v2 (WisKey's own projection rules, so a self-contradicting answer is refused instead of half-believed):

- No unknown key at the top level, in a row or in `pending`.
- `central_revocation_predicate == "inactive-no-enabled-assignments-no-groups-no-overrides-no-pin-v1"`.
- Present: `central_revoked` is a bool. If it is true, there is no enabled row. Not present: `central_revoked` null, no rows,
  `timing_policy` null, `stations_synced` null.
- `revocation_pending` must equal what WisKey derives from the arrays: present gives true when a removal array is non-empty, false
  when all six are empty, and null when only `unverified` is non-empty. `delete_pending` gives true. `absent` gives true when a removal
  array is non-empty, else null.
- An enabled row has at least one lock. `applied=true` needs desired == person_revision == applied and `synced`. `applied=false` needs
  desired == person_revision, a non-null applied revision and state, the row behind, and the station in `operations`.
  `applied=null` needs the station in `unverified`.
- `stations_synced` must equal the value derived from the enabled rows' `applied` (none gives null, any false gives false, any null
  gives null, otherwise true).

Every refusal is a `wiskey_access_state.AccessStateError` (a `ValueError`) with a closed `code`: `malformed_envelope`, `error`,
`missing_field`, `unknown_field`, `unsupported_schema`, `schema_mismatch`, `unsupported_observation`, `user_mismatch`,
`revision_conflict`, `malformed`, `oversize`, `inconsistent`, or WisKey's own error code. The callers map every refusal to UNKNOWN.

## 3. The fail-closed verdict

`revocation_verdict_v2` returns True (tracked revocation work is still owed), False (no tracked work, see below), or None (UNKNOWN,
"not verified"). It returns False only when all of these hold:

1. The answer is v2, for this person, `present`, at the revision of the caller's fresh `users/get`.
2. `central_revoked` is true, `revocation_pending` is false, and all six arrays are empty.
3. **F-02 cross-check.** The answer carries bookkeeping: an answer with no row and six empty arrays is never proof. Arx's last-known
   doors record for the person is readable. Every station in that record has a row in the answer that is disabled and `applied=true`
   at this revision.

A missing last-known record, a last-known station with no row, an enabled row, or an unproven row all give None. `delete_pending`, or
any non-empty removal array, gives True. `absent` is never cleanup. Arx's separate central predicate still applies: the engine's
`revocation_proven(person, pending)` and ACR5's `central_revoked_at == requested_revision` must agree at the same revision.

The last-known doors record (`last_known_stations`, no migration) covers every station Arx itself wrote for the WisKey person. It is
the union of the door maps of its grants that may have reached WisKey (`access_grants.pushed = 1`, through `access_person_links`) and
its per-station decisions (`access_station_permissions` with a WisKey revision or an `allow` effect). An unreadable record or door
map gives None, never "no doors".

v1 is unchanged and remains existing compatibility only. A v1 state is never passed to the v2 verdict. Note: v1 keeps the F-02
exposure (a person with empty bookkeeping still reads `false` there). Nothing is live, but see open question Q6.

**What even a valid False does not mean.** It is central bookkeeping in WisKey's repository, read once. It is not physical proof
that a door or reader dropped the person, and it is not a fence against an older remote mutation still in flight (a later visit
approval can make the person active again, see F-05). Every revoke is read again after each mutation, with no cache.

## 4. What Arx expects from WisKey

- The command `hikvision_intercom/users/access_state_v2` and the capability `person_access_state_v2`, advertised only while the gate
  is on. A missing command or capability is UNKNOWN for Arx. There is no fallback to v1 for a revocation claim.
- The query principal: today WisKey requires an active Home Assistant admin (`arx_readback_api.authorize`, `is_active` and
  `is_admin`). Arx does not create it, its token, or its groups, and there is no workaround. **Owner decision 2026-10-21:** WisKey
  is asked to drop the full-admin requirement for `access_state_v2` and expose it through the bridge (or another integration path
  agreed with Arx), with no manual step and no new HA user. Until WisKey confirms that path, the Arx side stays fake-only and the
  live connection stays blocked. No client is built, and GO_LIVE_PERMITTED is False.
- The answer shape exactly as in section 2, with the same projection rules as `person_readback.project` and
  `revocation_snapshot.project_v2` at `c932c553`. A change to either is a new schema version, not an additive field.
- Responsibilities: Arx owns this consumer and its tests. WisKey owns the contract and the server. Acceptance is joint, and there is
  no ETA. The registry, peer, atomic receipt and capacity items (32 MiB image; 1032 MiB NOT_APPROVED) stay open on WisKey's side and
  are not built here.

## 5. Open questions for the WisKey team

1. **Q1, positive per-station evidence after a full revoke.** After a strip is fully applied, which trace remains for each station?
   Arx proves clean only with a disabled row at the current revision with `applied=true`. If WisKey drops the row, Arx will report
   "not verified" forever for any person it ever gave doors. Please confirm the row is kept, or propose another per-station positive
   proof.
2. **Q2, closed schema.** The contract lists the v2 fields but states no rule for additive fields. Arx refuses unknown keys in v2.
   Please confirm, and agree that any new field means a new schema version.
3. **Q3, bounds.** WisKey states no upper bound for v2 revisions, array lengths or row counts. Arx uses revision at most 2^53-1, and at
   most 1024 rows and 1024 ids per array. Please confirm or give the bounds of the bounded datastore format.
4. **Q4, timing_policy.** What does `normalize_policy(None)` project? Arx assumes null, or the mode / schedule / bindings triple.
5. **Q5, peer / registry / receipt alignment (F-08).** Agree on the revision bound, back-links to earlier binding versions, the
   registry command name (Arx proposes `peer_bindings/get`), and the id format (Arx's draft wants 32 hex; WisKey says opaque).
6. **Q6, v1 exposure (owner and lead).** Should Arx also refuse a v1 `false` for a person with empty bookkeeping? That would make v1
   unable to prove any full revoke, so v2 would become mandatory for revocation proof.
7. **Q7, capacity.** The bounded format, the atomic person-plus-evidence commit and the measurements (F-15) are still needed before
   the receipt work can be accepted.
8. **Q8, query principal (owner decision 2026-10-21).** Drop the full-admin requirement and serve `access_state_v2` through the
   bridge or another agreed path, with no manual step and no new HA user (F-03). Please confirm the path.
9. **Q9, round-11 private source bundle.** Please confirm the path and SHA-256 of `OWNER_PRIVATE_SOURCE_BUNDLE.zip`, and deliver it
   to the owner's PC.

## 6. Rollback

Revert the branch commits. Everything is additive or internal: no table, no setting, no switch, no wire change. The production
engine still has no access_state reader.
