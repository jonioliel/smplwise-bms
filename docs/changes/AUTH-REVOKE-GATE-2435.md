# AUTH-REVOKE-GATE-2435 - socket-attach revocation check in the local and app session caches, lineage administrator gate

Branch `pilot/AUTH-REVOKE-GATE-2435`, from `origin/main` at 665ec8f24 (v2.43.4). Source: code review 2026-11-13, part 02 (backend
access / identity / intercom), findings P1-1, P1-2 and P1-6. No version bump, no migration, no UI change.

Files: new `smplwise_vms/backend/smplwise/services/session_cache.py`; `services/local_identity.py` and `services/app_session.py`
(`_Cache.attach` and `remote_principal_ws` only); `routers/wiskey_lineage.py`; new test file
`smplwise_vms/backend/tests/test_authrevoke_2435.py`.

## 1. P1-1 - a session revoked between the resolve and the socket attach

`ha_user_auth.SessionStore.attach_socket` already refuses a WebSocket whose session ended between the lookup and the attach
("review M2"). The two later caches attached unconditionally after the awaited thread-pool `resolve`, so a local (Arx-only) or app
web-view session revoked in that window kept a socket that the revocation pass had already missed.

- New `session_cache.attach_if_live(lock, sockets, key, websocket, live=...)`: the liveness check and the attach under the cache's own
  lock. A revocation is therefore either before the check (refused) or after the attach (the revocation queues the socket for closing).
  This is the first shared piece of the session cache (review P2-4); the rest of the extraction is left for that branch.
- `local_identity._Cache.attach(sid_hash, chain_id, websocket) -> bool`: live = the session's own cache entry, or any entry of the same
  chain (a concurrent HTTP request may rotate the chain between the resolve and the attach; the chain is still live). Every revocation
  path drops the chain's entries (`drop_chains`, `drop_user`, `clear`), so a revoked chain is never live.
- `app_session._Cache.attach(sid_hash, websocket) -> bool`: live = the session's entry (a web session never rotates; every ending drops
  it through `drop`, `drop_user` or `clear`).
- Both `remote_principal_ws` return `None` on `False`; the socket route then closes with 4401, the same answer as for an unknown cookie.
- No database read was added: "live" is the entry the resolve has just put.

Behaviour for a live session: unchanged (it attaches exactly as before).

## 2. P1-2 - the lineage administrator gate

`routers/wiskey_lineage.py` checked `is_system_admin` alone, which by its docstring leaves the active flag to its caller and ignores a
deny of `system.configure`. All four routes (GET, resolve, close, re-initialise) now go through one `_gate(conn, ...)` built like the
sibling administrator routers (`routers/wiskey_managed.py` `_admin_or_403`): `rbac.require(conn, principal, "system.configure",
INSTALLATION)` first (inactive user, explicit deny, the local second-factor rule; the refusal is audited by `require()`), then
`is_system_admin` with the audited `not_system_admin` 403, then the `interactive_only` check for the three actions, as before.

- The GET refusal is now audited (`wiskey.lineage.view`, or `system.configure` from `require()`), written aside because the route reads
  on the read connection.
- An active system administrator is unaffected (only `system_admin` carries `system.configure` in `roles.json`).
- A user who lacks `system.configure` is now refused by `require()` with code `forbidden` instead of `not_system_admin`, the same code the
  sibling administrator routes give. No UI calls these routes (checked by grep over the frontend sources).

## 3. P1-6 - blocking database work on the event loop

`async def resolve` ran the gate (a write connection that may wait for the write lock, and may write an audit row) and the allowed audit
row directly in the coroutine. Both now run through `starlette.concurrency.run_in_threadpool` (the pattern of
`routers/local_identity.py` and `routers/access_control.py`): same statements, same order, off the loop. `close` and `reinitialise` are
plain `def` routes and already run in the thread pool.

## 4. Tests

New `tests/test_authrevoke_2435.py` (11 tests), written first and run red before the fix (8 failed, 3 passed: the two "live session
still attaches" controls and the active-administrator control):

- local and app: revoke inside the resolve window (the real revocation function, `revoke_chain` / `_end_where`), then the socket
  attach: refused with 4401 and nothing left in the cache's socket map; a live session still attaches and gets `hello`.
- local: the attach follows a rotation of the same chain and is refused once the chain is revoked.
- the shared helper on its own.
- lineage: an active administrator passes the gate on all four routes; an inactive administrator and one with an explicit deny of
  `system.configure` are refused 403 on all four, audited with `user_inactive` / `explicit_deny`; a refused GET writes an audit row;
  the resolve route's gate runs on another thread than the coroutine.

Local runs (Windows, Python 3.12.10, the repository's `.venv`) are listed in the commit message and the hand-off report. The runner
entry check is queued after the push.

## 5. Rollback

Revert the commit. No data, settings or schema change.
