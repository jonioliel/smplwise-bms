# CR-INTERCOM-SHARED-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-INTERCOM-SHARED-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; findings 02:P2-6 and 02:P3-3 (the listen pump part).
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`). Risk in the plan: medium (live audio paths).

## What and why

Talk and listen were parallel implementations. The parts that were the same now exist once; the direction-specific
loops (what a frame is, who may send, the admission checks before each frame) are untouched.

1. **One registry base (02:P2-6).** `services/intercom_media.py` gets `SessionSlots` (`attach` once, finish once) and
   `session_ref(session_id)` (the audit's digest prefix). `MediaState` (talk) and `intercom_listen.ListenState`
   (listen) inherit it; `TalkSession.ref` and `ListenSession.ref` call `session_ref`. Each registry keeps its own
   lock object, its own dict (`talks` / `sessions`), its reservation rules, pruning and lookups.
2. **One pump tail (02:P2-6).** `routers/intercom_media.run_until_first(tasks, what, ref, log)`: wait for the first
   task, cancel the others, join them all under a shield, and re-raise a cancellation of the caller only after the
   join. The talk `_pump` and the listen `_pump` end with one call to it. The cancel / join code is the text both
   had, moved; each pump still logs on its own logger with its own word ("talk session ..." / "listen session ...").
3. **A fixed outcome when two tasks finish together (02:P3-3).** Both pumps took their result from an arbitrary
   member of the `done` set. The order is now fixed:
   1. a finished task raised: `upstream_closed` (logged with the exception's type);
   2. the first finished task, in the order the pump lists its tasks, whose result is not `ended`;
   3. `ended`.
   So a stop reason (`expired`, `access_lost`, `stopped`, `upstream_closed`) wins over the browser's plain
   disconnect when both happen in the same turn - the review's recommendation ("stop reasons before `ended`").
   A single finished task behaves exactly as before. Two small determinisations: the listen pump used to return the
   first task's result even when another finished task had raised (now `upstream_closed`, as the talk pump always
   did), and the talk pump's pick among several clean results is now the list order instead of the set order.

## Decision recorded

- **02:P3-3 "verify the intended priority".** No document states an intended priority. Taken: the review's
  recommendation above. The audit row of a session that expired (or lost access) at the instant its browser left
  now says so instead of sometimes saying `ended`; the close codes are unchanged per outcome.

## Files

Changed: `smplwise_vms/backend/smplwise/services/intercom_media.py` (registry only), `services/intercom_listen.py`,
`routers/intercom_media.py` (the pump tail and the new helper), `routers/intercom_listen.py` (the pump tail).
New: `smplwise_vms/backend/tests/test_intercom_shared_2440.py`.

Not in this branch: the entry-center socket's silent `except` (02:P3-3, first half) is in `routers/access_control.py`,
which is not a file of this row.

Related: `pilot/CR-LIVE-SOCKET-CAPS-2440` (same agent) adds one argument (`cap=cap`) to the `_live_relay` call in
`routers/intercom_media.py`. This branch does not touch that line; the two merge without conflict.

Outside my rows: none.

## Tests actually run

See the end of this file (filled after the run).
