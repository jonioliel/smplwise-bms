# WKWRITE-295 - native people writes to WisKey: source, durable intent, writer fencing, crash lineage, name_ref

Branch `pilot/WKWRITE-295` (from `origin/main` 16bc3926b, v2.15.0). WisKey round 4, completion items 8-9 (Q02), 16 (Q08) and 4
(families map, see `WKWRITE-295-ADOPTION-MAP.md`). WisKey inputs read at intake commit 3707f97fb: `reference/NATIVE_WRITE_V1.md`,
`reference/DIRECT_API_V1.md`, `reference/ROUND4_CONTRACTS.json`, `reference/command_catalog/*`, `reference/ADOPTION_MATRIX.json`; producer
source read at product CODE d2579588b0b8 (`native_peer_write_api.py`, `access/native_peer_storage.py`, `trusted_actions/envelope.py`,
`trusted_actions/resources/GENERALIZED_W1_ENVELOPE.draft3.schema.json`, `name_reference_api.py`, `admin_operations_api.py`,
`access/bulk_operations.py`, `access/name_reference_receipts.py`, `bridge_command_auth.py`, `peer_bridge_api.py`).

**Status, plainly.** Implemented and tested against a fake WisKey and real SQLite files. Crash windows were exercised both as an
in-process simulated kill and as a real OS exit (`os._exit(137)`) of a child Python process running this code against a file-backed
fake. Not wired to any router, not joined to the direct transport, not installed, not live. No device, HA user, token or WisKey
setting was touched.

## What was added

| file | symbols | role |
|---|---|---|
| `smplwise/services/wiskey_command_port.py` | `WiskeyCommandPort`, `WiskeyCommandError`, `NOT_SENT` / `REFUSED` / `UNKNOWN`, `PEER_QUERY_COMMANDS` | the seam to the direct transport (Agent A implements it) |
| `smplwise/services/wiskey_native_write.py` | `parse_source`, `WriteSource`, `WriteActor`, `ArxDecision`, `arx_decision`, `build_descriptor`, `check_descriptor`, `verify_receipt`, `verify_ack`, `NativePeopleWriter.write / resolve / rename / resolve_name_ref / recover`, `audit_to`, `PRE_EFFECT_CODES` | the people-write path |
| `smplwise/services/wiskey_write_lineage.py` | `open_lineage`, `WriteLineage` (`acquire_writer`, `admit`, `begin_send`, `mark_*`, `recover`, `close_unknown`, `purge`, `reinitialise`, `handoff_export`), `SettingsAnchor` | the durable intent store and lineage |
| `smplwise/services/connection_store.py` | `seal_lineage_record`, `open_lineage_record` | AES-256-GCM of the stored original, associated data bound to the operation |
| `smplwise/services/backup.py` | `SETTINGS_KEEP` += `wiskey.native_write.lineage_anchor` | an archive never carries or rewinds the anchor |
| `smplwise_vms/config.yaml` | `backup_exclude: ["wiskey_lineage/*"]` | the lineage file stays out of the add-on backup |
| `tests/test_wkwrite_295.py`, `tests/test_wkwrite_295_crash.py`, `tests/wkwrite_fake.py`, `tests/wkwrite_crash_child.py`, `tests/fixtures/wiskey_round4/` | | tests, the fake, the crash child, the catalog slice and the W1 schema copied from the intake |

No migration: the lineage is its own file outside the main database (migration 0173 stays unused).

## The command port (for joining with pilot/WKDIRECT-295)

```python
class WiskeyCommandPort(Protocol):
    async def send_signed(self, command: str, parameters: Mapping[str, Any], *, operation_id: str | None) -> Mapping[str, Any]: ...

class WiskeyCommandError(Exception):
    def __init__(self, code: str, *, outcome: str)   # outcome: "not_sent" | "refused" | "unknown"
    code: str; outcome: str; may_have_been_sent: bool
```

- `command` has no `hikvision_intercom/` prefix; the transport sends `type = "hikvision_intercom/" + command`, wraps `parameters` in
  `wiskey-peer-query.v1` for `PEER_QUERY_COMMANDS` (`peer_bindings/get`, `peer_bindings/history`, `peer_protocol/get`,
  `peer_receipts/resolve`) and in `wiskey-bridge-command.v1` otherwise, with the `query_owner_id` that `direct/connect` returned.
- Returns the `result` of a reply whose `wiskey-direct-reply.v1` MAC, `connection_ref` and id/type correlation were verified first,
  JSON number types preserved.
- `NOT_SENT` only when no byte of the frame was written; `REFUSED` only for a verified error frame (code = WisKey's code); `UNKNOWN` for
  everything else after the write may have started (timeout, close, MAC failure, cancellation). No retry inside the transport.
- `parameters` may carry raw PIN / card / name values: never logged or kept by the transport.
- name_ref prepare and apply must go over the same connection (WisKey binds the carrier to connection + actor): one port instance per
  writer, no reconnect between the two calls.

## Items 8-9 (Q02) - the write path

1. **Source before COMMIT.** `peer_writes/source_v1` (empty parameters) is read first; `parse_source` accepts exactly the 13 published
   fields (contract `wiskey-native-bridge-write.v1`, `replay_available` false, `delete_person_revision` `last_native_revision`). The
   write binding (`peer_binding_ref` + revision), the opaque `descriptor_epoch`, repository, verified peer and the service
   `query_owner_id` are used verbatim. Nothing is invented (no epoch, no HA user).
2. **Descriptor.** `build_descriptor` makes Arx's GENERALIZED_W1 Request (`wiskey-arx-generalized-w1-draft.3`): human actor = the Arx
   operator (equal to the signed `actor.id`), interactive channel, target = person id or, for `users/create`, the create origin ref,
   `binding_revision` = the observed write-binding revision, `urn:wiskey:native-bridge:<action>` revision `"1"`,
   `agreed_sensitive_opaque_reference` with a random opaque parameter reference (no value, no hash), TTL 10 s (WisKey max 15 s), the
   fresh RBAC decision (`ArxDecision`, at most 10 s old; `arx_decision` requires the permission on every target). `check_descriptor`
   mirrors `Request.parse`'s closed shape and cross-equalities, so a malformed descriptor never leaves Arx.
3. **Full original7 COMMIT before I/O.** The six source fields + the complete descriptor object are committed (encrypted) by
   `WriteLineage.admit` before the mutation is sent, exactly as sent; the resolve later sends that stored object back unchanged.
4. **Original commands.** users/create, users/update, users/set_active, users/archive, users/unarchive, users/temporary_cancel,
   users/delete, cards/add, cards/remove keep their closed catalog parameters + `actor {id, display_name}` + `peer_write`
   (`schema_version 1`, epoch, write binding, descriptor object, `actor_session_active`, `create_origin_ref`). users/delete carries the
   revision the caller read (the latest actual one) and its receipt must carry that same revision - a successor is refused.
5. **ACK.** `{schema_version, contract, result, receipt, replay_available:false}`; the 16-field `wiskey-native-peer-source.v2` receipt
   must repeat the stored original7 byte-for-byte (canonical JSON, so `true` is never `1`), `central_state committed`,
   `device_application unknown`, `signed_capture_covered false`, `capture_original null`, the right person and revision.
6. **Lost answer.** `resolve` gets a current read binding (`peer_bindings/get {initialize:true, expected_revision:0}`, must be `active`,
   same repository / peer / query owner) and calls `peer_receipts/resolve` with it and the stored original7. `found` + a verified
   receipt -> committed; `unknown`, an error or a mismatch -> stays UNKNOWN. A missing intent or an unreadable original (key lost)
   stays UNKNOWN and sends nothing. There is no resend, retry, replay or reconstruct method.
7. **Refusals.** A verified error settles as `refused` only for codes WisKey raises before its person commit (`PRE_EFFECT_CODES`:
   invalid_fields, revision_conflict, user_not_found, native_write_source_not_observed, native_write_action_unsupported,
   name_ref_unknown, request_too_large, unknown_command). Everything else (binding_denied, source_changed, Unauthorized,
   bridge_outcome_unknown, original_already_committed, name_ref_expired, name_ref_consumed, ...) may follow a commit in the WisKey
   source and is UNKNOWN.

### Durable intent store, writer, crash windows

- `<data>/wiskey_lineage/lineage.sqlite3`, WAL, `synchronous=FULL`. States `intent -> sending -> committed | refused | unknown`,
  `intent -> not_sent`, `unknown -> committed` (resolve only). `begin_send` is the only way to `sending` and only from `intent`.
- **Writer scope / fencing / exclusive writer.** Scope = repository + service query owner. `acquire_writer` takes a 30 s lease with a
  fence number; `admit` and `begin_send` check holder + fence + lease in the same IMMEDIATE transaction, so a writer that lost the
  scope is refused (`writer_fenced`) before I/O; a live other holder is `writer_busy`. A verified fact (ACK / resolve) may still be
  recorded by a fenced writer. A clean `close` releases the lease; a crashed holder's lease lapses after 30 s. One in-flight write
  per person (partial unique index); one create per create origin, ever (unique).
- **Three crash windows**, each tested twice (simulated kill and real child-process exit), never resent:
  - window 1, before send: intent committed, send marker not -> recovery `not_sent` (proven: the marker is committed before the
    frame is written).
  - window 2, after send without ACK, WisKey did not commit -> recovery `unknown`, resolve `remote:unknown`, stays unknown.
  - window 3, after person + receipt COMMIT in WisKey without ACK -> recovery `unknown`, resolve `found` -> committed with WisKey's
    person id and revision.
- **Outside the backup / UNKNOWN after restore.** The lineage file is not an Arx archive table, `.sqlite*` is never restored, and
  `backup_exclude` keeps it out of an add-on backup. The anchor `wiskey.native_write.lineage_anchor` (generation + last intent
  sequence) lives in the main database and is in `SETTINGS_KEEP`. Main behind the lineage (or no anchor) = restore: every open intent
  -> `unknown` (`restored`), every fence bumped, writes continue. Lineage behind the main database or another generation = stale:
  open intents -> `unknown`, new writes refused (`lineage_stale`). Lineage file missing with an anchor = missing: new writes refused
  (`lineage_missing`), nothing recreated silently. `reinitialise(actor_ref=...)` starts a new generation and records the lost /
  superseded sequence range.
- **Encryption.** The sealed original / name_ref bindings: AES-256-GCM with the per-install key `keys/connections.key` (never in a
  backup), associated data `wiskey_lineage|<operation_id>|<field>`.
- **Retention.** 30 days after the operation ended (committed, refused, not_sent, or an unknown closed with `close_unknown`), the row
  and its proof rows are deleted by `purge`. An open unknown is kept.
- **Proof rows.** `proofs` (append-only): intent_committed, send_started, ack_committed, ack_refused, ack_lost, not_sent,
  recovered_before_send, recovered_after_send, resolve_found, resolve_unknown, restored_unknown, stale_unknown, closed_by_operator,
  late_fact. `handoff_export` lists refs, states, codes and proof kinds (never the original) for the reply to WisKey.

## Item 16 (Q08) - name_ref and users/bulk_receipt

`NativePeopleWriter.rename`: source read, writer acquired, intent (bindings only: person_ref, expected revision, request_id,
operation_id) committed; `users/name_ref_prepare_v1` carries the display name (max 32) - its only appearance; a failed or unverified
prepare is `not_sent` (the 60 s carrier is bound to its connection + actor and usable only through a ref nobody received); send marker;
`users/name_ref_apply_v1`; the ACK must be exactly `{person_ref, person_revision = expected + 1, operation_id, state: committed}`.
`resolve_name_ref` sends `users/bulk_receipt {operation_id}` WITHOUT an `actor` parameter, so WisKey attributes it to the same pairing
principal that applied it (`bridge_command_auth.actor_id`), and verifies the 14-field `wiskey-name-ref-receipt.v1`.
`operation_not_found` is not a never-committed proof: it stays UNKNOWN. Nothing is renamed or rebuilt.

Raw name / PIN / card: only in the signed input that needs it. `test_raw_name_pin_and_card_only_in_the_signed_input` plants marker
values in a create (name + PIN), a cards/add (card number), an update (PIN) and a rename (name), through lost-ACK + resolve paths, and
scans the log, the audit sink, the intents, the proof rows, the decrypted originals / descriptors and bindings, the `peer_write`
metadata, the resolve / bulk_receipt requests, the handoff export and the raw bytes of every lineage file and of the main database:
no marker anywhere; the markers are present in what the fake WisKey received.

## Tests (run on Windows, Python 3.12 venv, from `smplwise_vms/backend`, `PYTHONPATH=.`)

See the branch report for the exact commands and exit codes. Not run: the full suite, the runner, anything against a real WisKey
or Home Assistant.

## What remains

- Join the port to `DirectApiTransport` (pilot/WKDIRECT-295); an adapter is all that is needed if its method names differ.
- Composition: construct one `open_lineage(settings.data_dir, SettingsAnchor(settings.db_path))` per process, call
  `recover(scope)` at start (after the source read), and route the existing people endpoints (routers/access_control.py,
  routers/access_control_writes.py, services/access_grant_engine.py) through `NativePeopleWriter` with `audit_to(conn, principal)`
  and `arx_decision(...)` from their existing station gate. Not done here because the transport does not exist on this branch.
- An administrator screen for `close_unknown` / `reinitialise` and a periodic `purge`.
- `backups/apply` on WisKey should mark open lineage intents unknown (a WisKey restore can move person revisions).
