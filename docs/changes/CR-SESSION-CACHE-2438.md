# CR-SESSION-CACHE-2438 - one session cache for the local and app stores, revoked keys refused by a late put, lease-hook failures logged

Branch `pilot/CR-SESSION-CACHE-2438`. **Base: `origin/pilot/AUTH-REVOKE-GATE-2435` (0a3c570e1)**, not `origin/main`: that branch created
`services/session_cache.py` and changed the two caches' `attach`; this branch builds on it and must merge after it. The files of this
branch are unchanged on `origin/main` since that base (checked with `git diff 665ec8f24 origin/main` on the five service files).
`SESSION-DEMO-WS-2435` changes only frontend files (`api/session.ts`, `api/reconnecting-socket.ts`, `shell/sw-app.ts`): no overlap, not
stacked. `CR-WAVE1B-COMBINED-2436` touches none of these files: not stacked.

Source: code review 2026-11-13, part 02 (backend access / identity / intercom), findings P2-4 and P2-8; master plan section 3.3 row
`CR-SESSION-CACHE-2436`; lead decision L4. No migration, no setting, no UI change, no API change.

Files: `smplwise_vms/backend/smplwise/services/session_cache.py`, `services/local_identity.py` (`_Cache`, `revoke_all`,
`reset_for_tests`), `services/app_session.py` (`_Cache`, `reset_for_tests`), `services/ha_user_auth.py` (`SessionStore.attach_socket`,
`take_sockets_to_close`, `_lease_session_ended`), `services/intercom_sync.py` (`_lease_hook` only); new test file
`smplwise_vms/backend/tests/test_session_cache_2438.py`.

## 1. P2-4 - one session cache

`local_identity._Cache` and `app_session._Cache` carried the same `put`, `drop_user`, `take_to_close`, `clear` and almost the same `get`.
Both are now subclasses of `session_cache.SessionCache`, which holds the lock, the entries, the sockets and the close queue. Each store
keeps only what differs:

| | local (Arx-only) | app (web view) |
|---|---|---|
| clock | `time.time()` | `app_session._now()` (app_refresh's clock) |
| socket key / revocation key | sign-in chain | session |
| own methods | `peek_live`, `drop(sid)` (rotation, no socket close), `drop_chains`, `attach(sid, chain, ws)` | `drop(sids)`, `attach(sid, ws)` |

The clock and the time-to-live are read on every lookup (callables), so the stores' clocks - and the tests that move them - are unchanged.
Attribute names (`_lock`, `_by_sid`, `_sockets`, `_to_close`) are kept: tests read them. The eviction rule (above 5,000 entries the oldest
500 go) is unchanged and now named (`MAX_ENTRIES`, `EVICT_BATCH`).

`ha_user_auth.SessionStore` is a different structure (bearer index, revoked sign-ins, second-factor memory) and stays its own class; its
two copied pieces now use the shared helpers: `attach_socket` -> `session_cache.attach_if_live` (same rule, same lock), and
`take_sockets_to_close` -> `session_cache.take_queued`.

### Lead decision L4 - the clock-moved-back check in both stores

The app copy already dropped an entry loaded "in the future" (`now < loaded_at`, the wall clock moved back); the local copy did not. The
shared `get` keeps the stricter rule, so the local store now applies it too. Effect: after a backwards clock jump a local session's cache
entry is treated as a miss and the next request reads the session from the database once - the session itself is not ended. Fail-closed,
no user-visible change. Reverting it is one condition in `SessionCache.get`.

## 2. A revoked session is never put back into the cache (hardening found while extracting)

A revocation (`local_identity.revoke_chain`, `revoke_user_sessions`, `revoke_all`; `app_session._end_where`) drops the cache entries inside
its own write transaction, before the commit. A resolve that read the session row just before that commit saw it unrevoked and put it
into the cache after the drop. The cache then served the revoked session for up to the 15-second time-to-live, and - worse - a WebSocket
handshake in that window attached to a session whose sockets the revocation had already queued, so nothing would ever close it (the
same class as review M2 / P1-1, in a narrower window).

`SessionCache` now remembers the keys a revocation ended (chain for local, session for app) for `ENDED_KEEP_S` (300 s, monotonic clock)
and `put` refuses an entry under such a key: the request that was concurrent with the revocation is answered from its own read (as
before), every later request reads the database and is refused, and the socket attach finds no live entry and is refused with 4401.
This is the same idea `ha_user_auth.SessionStore` already applies with `_revoked_iss`. `local_identity.revoke_all` now names the ended
chains (`drop_chains`) before `clear()`; `clear()` keeps the ended keys; `reset_for_tests` forgets them. A revocation that rolls back
only over-revokes the cache (the session keeps working, read from the database on each request, for at most 300 s).

Not ended keys: `drop_user` (a factor / directory change, the next request re-reads) and the local `drop(sid)` of a rotation.

## 3. P2-8 - lease-hook failures are logged

The capture-lease revocation hook (`capture_lease.on_authority_change`) failed silently in two of its three wrappers.
`ha_user_auth._lease_session_ended` and `intercom_sync._lease_hook` now log a warning `capture lease hook <reason> could not run`
(the reason code only, never a user or station id), exactly as `local_identity.lease_hook` already did. Nothing else changes: the wrappers
still never raise.

## 4. Tests

New `tests/test_session_cache_2438.py` (23 tests):

- shared cache: time-to-live boundary, `expires_at` / `idle_expires_at`, clock moved back (unit and both stores), each store reads its own
  clock per lookup, eviction above the cap, `drop_user` keeps sockets, `clear` queues every socket once;
- ended keys: local `drop_chains` and app `drop` close the sockets and refuse a late put; another chain is unaffected; an ended key is
  forgotten after the keep time and pruned by the next revocation; `clear` keeps the ended keys, `forget_ended` resets them;
  `SessionStore.attach_socket` still refuses an unknown session;
- end to end (local and app): the revocation commits after the resolve's read and before its put -> the WebSocket is refused with 4401,
  nothing is cached for the chain / session, and the next HTTP request is 401; a session revoked while cached is refused at once; a live
  session is still cached and attaches;
- P2-8: a raising hook logs the warning in both wrappers, with no id in the log; an empty station list stays quiet.

Red check: with the `put` refusal disabled (a temporary local edit, not committed), the late-put and end-to-end race tests failed (the
local socket was accepted, the app session stayed cached); with it, they pass.

Local runs (Windows, Python 3.12, the repository `.venv`, `-p no:xdist`): see the commit message for the exact counts.
NOT_RUN locally: the full backend suite (runner entry check).

## 5. Rollback

Revert the commit. No data, settings or schema change.
