# CR-APP-SESSION-CACHE-2443 - an ended app web session is not cached back; access changes reach it on the next request

Security follow-up of `pilot/CR-LOCAL-USER-CREATE-2438` (e26f001ec, its second commit fixed a revoked-session cache race in
`services/local_identity.py`). Its note left `services/app_session.py` (the phone app's WebView session, SESSIONEXCH2-295) unchecked
because it has the same cache shape. This branch is cut from that branch so the earlier fix and its helpers are present.

## Finding (real)

`app_session.resolve()` reads the web-session row on a read connection, then calls `CACHE.put()`. Every ending
(`_end_where`: family revoke, sign-out everywhere, the sessions-list row, the web sign-out, a local user's password set / disable /
sessions revoke through `app_refresh.hook("revoke_user")`, the remote flag removed, a device re-registration ...) drops the cache entry
**inside the ending transaction, before its commit**. A request that read its row before that commit put the session back after the
drop. Measured with the interleaving read -> ending commits -> put (tests below, before the fix):

| What | Before | After |
|---|---|---|
| HTTP after an ending (family / sign-out everywhere / sessions-list row / web sign-out) | 200 for up to `CACHE_TTL_S` (15 s) | 401 on the next request |
| A WebSocket handshake in that window | attached, and **never closed by the ending** (the drop that closes sockets had already run) - open until the client disconnects | refused (4401 path: `attach` returns False) |
| A role change / binding revoke / Arx disable of the user (`revocation.mark` / `changed`) | the cached session kept answering until its entry aged out (up to 15 s); rbac already re-reads bindings per request, so permission checks were current - the session's own re-checks (permission fingerprint -> end, user state, the administrators' 1 h / 30 min caps) were late | re-checked on the next request (the session ends with `permissions` at once) |
| A factor removed (`drop_user_cache`, local users' `factor_ok`) | same race as an ending: a request that read before the commit cached the old principal for 15 s | not cached back |

Worst case before the fix: an ended web session kept working for up to 15 s after the ending was answered, and a WebSocket opened in
that window stayed open indefinitely.

The same `drop_user` race exists in `local_identity._Cache` (a factor removed / enrolled, a display-name change): the cached
`LocalSession.principal.factor_ok` could be put back for 15 s after the last factor was removed. Fixed here too (chain holds from 2438
unchanged).

Checked and NOT the same shape: `ha_user_auth.STORE` (the authoritative in-memory store, not a cache of a database row; its create
already refuses a revoked `iss` that landed during validation, review M2); `app_refresh.resolve_access` (reads the database on every
request, no cache); partner API keys (only a 5 s global switch cache, set directly on change, and per-token counters).

## Fix (matches e26f001ec: a time hold, no extra work on a cache hit)

`services/app_session.py` `_Cache`:
- `drop(sids)` records each session; `drop_user` / new `drop_users(ids)` record each user; `clear()` records the time of the clear.
- `put()` caches nothing marked within `DROP_HOLD_S` (30 s, longer than any transaction). The request in flight is answered from what it
  read; the next one reads the committed row. A rolled-back ending only costs 30 s of database reads for that session / user.
- `attach(sid, ws, user_id)`: a session that could not be cached only because its USER is held (a factor / access change - not an
  ending) still attaches its WebSocket; a session that was ended (session mark or clear) is refused. An ending after the attach closes
  the socket as before.
- `reset()` for tests (no holds); `reset_for_tests()` uses it.
- `on_access_changed(user_ids)`: called by `services/revocation.mark` / `changed` (new `_session_hook`, memory only, never raises) -
  drops and holds the users' entries.

`services/local_identity.py` `_Cache`: `drop_user` records the user; `put` holds it for `DROP_HOLD_S`; `attach(..., user_id)` lets a
user-held (not revoked) chain attach; `clear()` clears the user marks with the chain marks.

Hot path: a cache hit is unchanged (`get`). `put` (a cache miss only) does two dict lookups under the lock it already takes. The access
signal is sent only by administrative changes (bindings, roles, groups, zones, catalog, users).

Cost accepted: for 30 s after a change of a user (or after a catalog / zone edit that marks every user), that user's web sessions are
read from the database on every request (two reads per request: the pre-resolve and the in-lock re-check), and body_limit's
"live credential" tier treats them as uncached (the same as after any 15 s cache miss today).

## Tests

New `smplwise_vms/backend/tests/test_app_session_cache_race_2443.py` (written first; 10 tests, all 10 FAILED on the unfixed code):
- the interleaving read -> ending commits -> put for the family revoke, sign-out everywhere, the sessions-list row and the web sign-out:
  the next request is 401 (was 200);
- a WebSocket handshake that read before the ending's commit cannot attach (was attached and never closed);
- a binding granted / a binding revoked through the access API: the very next request ends the web session with `permissions` (was 200
  until the 15 s entry aged out);
- the access signal touches only the named users; a held user's session still answers and its WebSocket still attaches, and it is
  cached again after the hold;
- the hold per session and per user, and its end;
- the local identity cache holds a user after `drop_user` and ends the hold.

Runs (workstation, venv Python 3.12, `-p no:xdist`):
- `tests/test_app_session_cache_race_2443.py` on the unfixed code: 10 failed (the race: 200 instead of 401; the socket attached; the
  role change: 200; the hold API absent). On the final code: 10 passed.
- Related suites on the final code in one run - `test_app_session_295.py`, `test_app_session_fixtures_sx25.py`,
  `test_authrevoke_2435.py`, `test_local_session_cache_race_2438.py`, `test_local_identity.py`, `test_local_identity_units.py`,
  `test_local_passkeys.py`, `test_local_reset.py`, `test_rbac.py`, `test_rbac_groups.py`, `test_rbac_camera_scope.py`,
  `test_access.py`, `test_access_grants.py`, `test_capture_lease_triggers.py`: 522 passed, 0 failed.

## NOT_RUN

- The full backend suite, frontend, pixel runs; the runner entry check (by instruction: no entry check until the 2.43.8 release gate).
- No check against the lab add-on or the owner's site.
- A real phone / WebView: the race is shown by forcing the interleaving in-process; no timing-based reproduction.

## Owner questions

1. Hold length after a change: 30 s, as in 2438 (recommended; a. keep 30 s, b. 60 s - safer for very slow transactions, more reads).
