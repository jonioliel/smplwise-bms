# CR-FEED-BASE-2450

Code review 2026-11-13, finding 02:P2-5 (`private/code-review-2026-11-13/02-backend-access-intercom.md`).
Base: `origin/release/2440-train` (`e9d17b5ab`). Target: 2.45.0. Risk in the plan: medium; nothing else rides this branch.

## What and why

The two WisKey feed clients each kept one Home Assistant WebSocket session in a thread of their own and repeated the same
session skeleton: `intercom_sync.IntercomSync` (the service feed) and `wiskey_background_feed.BackgroundFeed` (the read-only
background feed). Five methods were byte-identical (`_replay_early`, `_fail`, `watch_stop`, `forward_stop`, `shutdown`) and
the rest ran in parallel. The skeleton now lives once in the new `services/wiskey_feed_session.py` (`FeedSession`), and both
clients inherit it:

1. **Thread and stop:** `_start_thread`, `shutdown`, `_run`.
2. **Early-message replay, fail, kick, loading probe:** `_replay_early`, `_fail`, `_kick` (the task name is a class attribute,
   `REFRESH_TASK`), `_maybe_loading` (the background feed's `_absent` / `_logged` are renamed to the service feed's
   `_absent_strikes` / `_logged_error`; nothing outside the two modules used either name).
3. **The reconnect ladder** (`_ladder`, was `IntercomSync._loop` and `BackgroundFeed._main`): backoff doubling to its cap,
   WisKey loading on the short retry, not installed / refused on the absent re-probe ladder with the copy dropped, any other
   WisKey error, a refused Home Assistant token waiting on the refusal ladder of the client's own token, the reconnect counter
   and the log lines (`LOG_NAME` gives each client its own prefix; the message strings are unchanged). Each client exposes its
   state through six small accessors; the service feed's `_count_reconnect` keeps the capture-lease revocation
   (`_lease_hook("feed_reconnect")`).
4. **One session** (`_session`): connect and authenticate through `ha_client.ws_session` (the background feed adds its core URL,
   token and internal TLS through `_connect_kwargs`), forward the stop, and on the way out drop the live call and cancel the
   session's tasks before a recorded fault is raised. What each client does once the socket is up stays in its own
   `_on_ready`; the two clean-up differences are the hooks `_session_closing` / `_session_closed`. The background feed's event
   loop attribute `_loop` is renamed `_event_loop` (the service feed's name).
5. **The overview refetch** (`_refresh`): the single-flight loop is shared; each client keeps its fetch (`_refresh_once`) and
   its failure mapping (`_refresh_failed`, the same branches in the same order as the old `except` chain).

The tunable constants stay in `intercom_sync` (the tests patch them there); the base reads them at run time. The parts that
are about what a client does, not how it runs a session (`_store`, `_drop`, `_set_state`, `_on_message`, the pollers, the
TTS and write paths), stay in each client.

Same frames in the same order: only code location moves. `tests/test_feed_session_pin_2450.py` was written first and run green
on the unchanged code (commit 1), then after every extraction step.

## Finding 02:P2-7 (person projection)

Not in these files any more: it was done by CR-PERSON-PROJECTION-2440 (already in the 2.44.0 train, `e29b392f3`:
`intercom_sync.person_fields`, the key-by-key parity test `tests/test_person_projection_parity_2440.py`). Nothing to do here.

## Files

- New: `smplwise_vms/backend/smplwise/services/wiskey_feed_session.py`,
  `smplwise_vms/backend/tests/test_feed_session_pin_2450.py`.
- Changed: `smplwise_vms/backend/smplwise/services/intercom_sync.py` (class `IntercomSync` only),
  `smplwise_vms/backend/smplwise/services/wiskey_background_feed.py` (class `BackgroundFeed` only).
- No router, no frontend, no settings, no migration.

## Tests actually run (PC, `C:\cloude\smplwisebms\.venv` Python 3.12.10, `-p no:xdist`)

- `tests/test_feed_session_pin_2450.py` (new, 60 tests) on the UNCHANGED code: 60 passed (three runs of the committed file; an intermediate edit of the fixture imports
  errored 9 tests at setup and was reverted before the commit).
- After each extraction step, `test_feed_session_pin_2450` + `test_wiskey_background` + `test_fake_wiskey` + `test_intercom`
  (+ `test_wiskey_channels` from step 3 on):
  - step 1 (base, small methods): 283 passed;
  - step 2 (reconnect ladder): 283 passed;
  - step 3 (session skeleton): 325 passed, 4 skipped;
  - step 4 (single-flight refetch): 325 passed, 4 skipped.
- The other 66 backend test files that import `intercom_sync` or `wiskey_background_feed`
  (list: `grep -lE "wiskey_background_feed|intercom_sync|wiskey_feed_session" tests/test_*.py`, minus the five above), one run
  at the final code: 2388 passed, 8 skipped, 3 xfailed (2 h 34 min on a fully loaded PC).
- `ruff check` (rule set F, the package lane config) on `smplwise/` and the new test file: all checks passed.

## NOT_RUN

- Runner entry check (not queued by this agent; the runner is reserved for the release gates today).
- Full backend suite (runner only).
