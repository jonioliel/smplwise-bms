# K7 - grant re-decision in bounded transactions

Status: implemented on `pilot/K7-295` (not released). Source: `private/planning/TRIAGE_FIX_BEFORE_ENABLING_2026-10-18.md` item K7,
backlog id `k7-redecide-transaction`. Severity LOW, internal surface; needed before the go-live permit on large installations.
No schema change, no migration. `access_grants.GO_LIVE_PERMITTED` unchanged (False). Fakes only; no WisKey, door or WhatsApp call.

## Problem

`Worker.redecide()` (CR-ARX-WISKEY-SHARED-IDENTITY 3.5, owner answer 5) re-decides every decided grant (`approved`,
`provisioning`, `active`, `unknown`) against its approver's current permissions after any permission-revision bump. It ran
inside ONE `BEGIN IMMEDIATE` transaction: every grant x station x permission `rbac.authorize()` evaluation held SQLite's single
write lock. On a large installation that is seconds of every other writer (operator actions, device mirrors, the audit of a
refused request) queued behind the worker.

## Change (`smplwise/services/access_grants.py`)

The pass walks the decided grants in `id` order, in chunks of `Worker.REDECIDE_CHUNK` (200):

1. **Decide** in a read transaction (`mode="read"`, WAL snapshot, no write lock): `_decide()` returns `revoke`, `narrow(kept)`
   or `keep` for each grant - the old `_redecide_one` logic with the writes taken out. An exception while deciding is `revoke`
   (fail closed, as before). Alongside, `_approver_print()` records what the decision read that the permission revision does
   not guard: the approver's `active` / `deleted_at`, and for a local identity the local-approver switch.
2. **Apply** in a short write transaction (`access_grants.redecide.apply`). For each grant the row is re-read; a grant that left
   the decided states meanwhile is skipped. The snapshot decision is applied as made only when the permission revision, the
   grant's `revision` and the approver print are all unchanged; otherwise that grant is re-decided inside this write
   transaction exactly as the old code did (bounded by the chunk). Any exception while applying is `mark_revoking(...,
   "approver_lost_authority")`, as before. The same transaction records the resume cursor.

The permission revision guards every binding / custom-role / group input of `authorize()` (the rbac role cache relies on the
same rule: every such change bumps it). The approver row and local switch are checked directly. So a decision is applied only
when it equals what the old single transaction would have decided at the moment of the write.

### Resume

`settings["access.external.redecide_cursor"] = {"rev": n, "after": "<last applied grant id>"}` is written in each non-final
chunk's write transaction and deleted by the final one. `run_once()` resumes when the in-memory flag is clear but a cursor
stands (`redecide_pending()`), i.e. after a crash or an error between chunks. A resumed pass re-decides everything after the
cursor, plus any grant at or before it whose `approval_revision` is below the current permission revision (a bump while the
process was down, a restored row) - so a resume never leaves a stale decision behind. The key is in `backup.SETTINGS_KEEP`:
never exported, never taken from an archive.

Fail closed: an error before the first chunk commits (no cursor) re-sets the re-decision flag so the next pass starts again;
with a cursor standing the next pass resumes after it. (The old code lost the re-decision entirely if its one transaction
failed after the flag was cleared.)

### Identical results

For an uninterrupted pass with no concurrent change the end state is the same as the old code: the same `access_grants` rows
(including `revision`, `updated_at`, `approval_revision`, `needs_push`, `code_state`, `end_reason`) and the same audit rows.
Only the order of the audit rows differs (grant id order instead of rowid order). The return value is still the number of
grants re-decided.

## Tests (`tests/test_k7_redecide_chunked.py`)

The old `redecide` / `_redecide_one` are kept verbatim in the test file as the reference. A synthetic installation (24
approvers on 8 stations, a local-identity approver, a missing approver, broken `doors_json` rows, noise rows in non-decided
states) then a bump with stations lost, an approver with no stations, an approver deactivated, one soft-deleted and the local
switch off:

- equivalence old vs new for chunk sizes 1, 7, 200 and 100000 (grants, audit, settings; every outcome present);
- no `authorize()` under a write connection in the new code (the old code: hundreds), no write applies more than one chunk;
- crash between chunks -> cursor stands, flag not set -> resume reaches the old code's end state;
- a bump while "down" -> the chunks before the cursor are re-decided too;
- the worker pass resumes a standing cursor and spends it;
- a change between decide and apply (bump + binding revoked, approver deactivated without a bump, local switch off, grant row
  edited) is re-decided in the write, never applied from the snapshot;
- an error while applying is a revoke exactly as before; an error before the first commit sets the flag;
- the cursor key is never restored from an archive.

Benchmark: `K7_BENCH_GRANTS=<n> pytest tests/test_k7_redecide_chunked.py -k benchmark -s` (optional `K7_BENCH_OUT=<file>`)
measures the old and the new code on clones of the same database, with a concurrent small writer probing the lock wait.

## Benchmark results

BENCH_RESULTS_PLACEHOLDER

## Rollback

Revert the commit. No schema or data migration; a cursor row left behind is ignored by the old code (and harmless).
