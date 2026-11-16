# CR-BRIDGE-PREVERIFY-2440 - signed bridge calls are judged before the write gate

Branch `pilot/CR-BRIDGE-PREVERIFY-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`.
Contract: the `CR-BRIDGE-PREVERIFY` row of `private/code-review-2026-11-13/MASTER_PLAN.md` (wave 3A, backend),
findings 05:P2-02, 05:P2-03 (verify), 05:P3-08 (verify). No behaviour change: every answer a caller gets is the one it
got before; what changes is where the work happens.

## 1. P2-02 - `POST /ha/bridge/ping` and `/ha/bridge/directory`

Before: both routes declared `conn = Depends(get_conn)` next to their body. FastAPI resolves sibling dependencies
whatever the body is, so every request - unsigned, badly signed, stale, or with no body at all - took a turn in the
process-wide write queue (`WriteGate`, then `BEGIN IMMEDIATE`) and was refused only once it held the lock. That is what
`auth.resolve_remote_first` removed for the remote channel in September; the local bridge routes still had it.

Now:

- `auth.conn_after(passed)` (new): a write-connection dependency that reaches `get_conn` only through the dependency
  `passed`. When `passed` raises, or its body is refused (422), `get_conn` is never called. It only delegates
  (`contextlib.asynccontextmanager(get_conn)`): the same transaction, gate, thread rules and commit / rollback rules as
  CR-SYNC-GATE-2438. On the remote channel the session is still resolved first (`auth.remote_first`), so an
  unauthenticated `/arx` caller keeps its 401.
- `routers/ha.py`: `_ping_screened` / `_directory_screened` run the handler's own judgement, in the handler's order, on
  a short READ connection (`label="bridge.preverify"`): the `purpose` refusal of the ping, then
  `ha_bridge.verify_message(..., screen_only=True)`. The directory screen notes a refusal for the diagnostics
  (`bridge_discovery.note_directory_refused`) exactly as the handler does, once.
- The handlers are unchanged: they still call `ha_bridge.verify_message` under the write lock. So the nonce is spent,
  the high-water mark is written and a revocation that landed in between is seen exactly as before. The screen is an
  extra, earlier copy of the same check, not a replacement.
- `ha_bridge.verify_message(screen_only=True)` (see "Outside my rows"): the same checks and refusal codes, with the
  nonce recorded in a throw-away `NonceCache` (so the message is not spent) and no high-water write (a read connection
  skips it already, `bridge_keys._note_highwater`).

Cost for a legitimate call: one extra read connection and one extra HMAC. The ping runs at pairing; the directory push
once a minute.

Why not "verify once on the read connection, then write": verification is not read-only. It spends the nonce and
records the per-key high-water mark, and the key state can change between two connections (a rotation step, an
emergency revocation). Keeping the real verification under the write lock keeps all of that as it was.

## 2. P2-03 (verify) - identities resolved outside `auth._principal`

Verified: the finding stands. The dependency sweep (new, below) finds these dependencies that resolve an identity
without `auth.current_principal` / `current_principal_ro`:

| Dependency | Routes | Shared steps run |
|---|---|---|
| `routers/building_presence._principal` (now `auth.principal_light`) | 8 | now `shared_steps(light=True)` |
| `routers/presence.session_caller` / `any_caller` / `device_caller` | 20 / 9 / 5 | none (as before) |
| `routers/notifications._remote_gate` | 1 | none (as before; single-use action token) |
| `routers/calendar_feeds.feed_conn` | 1 | none (feed token) |
| the two bridge routes | 2 | none (HMAC, no user) |
| no dependency, identity in the handler: `GET/DELETE /auth/sessions`, `DELETE /auth/sessions/{session_id}` | 3 | none |

Change (my files only):

- `auth.shared_steps(request, conn, principal, *, light=False)`: the cross-cutting steps of `_principal`, moved out
  unchanged and in the same order (service-account refusal, last-seen stamp, bootstrap grant, required-sensors gate,
  home-interface restriction). `_principal` calls it. `light=True` skips the service-account refusal and the bootstrap
  grant - the two steps these routes never ran - and keeps the stamp and both path gates.
- `auth.principal_light(request)`: the identity alone (what `building_presence._principal` did).
- `routers/building_presence.py`: `_principal = principal_light`; each of the 8 handlers calls
  `shared_steps(request, conn, principal, light=True)` on its own connection where it called `touch_user`.
  Both path gates return at once for these paths (`/presence/...` is exempt from the required-sensors gate and allowed
  to a home-only person): pinned by `test_the_two_path_gates_are_noops_on_the_light_routes`. A step added to
  `shared_steps` later reaches these routes without anyone remembering them.
- Recommendation taken where the finding offered two ("one `principal_light` ... or a test listing the exemptions"):
  both, as far as my files go. `routers/presence.py` and `routers/notifications.py` are not in my row; they are listed
  by name in the inventory test and left for the closing chain (3B).

Not changed on purpose: the light variant does not start refusing the service account or granting the bootstrap
administrator on the presence routes. Either would be a behaviour change; say so if it is wanted.

## 3. P3-08 (verify) - the connection label

Verified: `get_conn` / `get_read_conn` labelled the connection with the raw request path, and the label reaches the
slow-hold and busy log lines (`db.lock_stats`). Routes with a secret in the path that use the generic dependencies:
none found - the calendar feed has its own `feed_conn`, the notice-board routes (`/notices/display/{slug}/...`,
`/b/{slug}`) and the stamped brand images open their own connections. So nothing leaked; the label is now safe by
construction instead of by inventory:

- `auth.conn_label(request)`: method + path with the matched route's template in place of its parameters
  (`GET /api/v1/ha/entities/{entity_id}`). A route without parameters is labelled exactly as before, remote prefix
  included (`POST /arx/api/v1/sites` - `test_remote_auth_first.py` reads that label). When the values cannot be placed
  (an encoded segment), the template alone is used; a value never appears.

## Outside my rows

- `smplwise/services/ha_bridge.py`: `verify(..., nonces=None)` and `verify_message(..., screen_only=False)` - two
  keyword parameters with the old defaults, 13 lines. Needed so the screen does not spend the nonce; the alternative
  (swapping `bridge_keys.NONCES` from the router) would have been a hack around the module. Not held by another 3A row.
- `tests/test_local_auth_inventory.py` (named in the row): extended with the dependency-name inventory.

## Resolved file list

`smplwise/auth.py`, `smplwise/routers/ha.py`, `smplwise/routers/building_presence.py`, `smplwise/services/ha_bridge.py`,
`tests/test_bridge_preverify_2440.py` (new), `tests/test_local_auth_inventory.py`, this note.

No bridge integration file is touched (no bridge version bump needed). No route, schema or envelope changed
(`scripts/api_inventory.py` lists routes and docstrings only; not regenerated).

## Tests

RESULTS (actually run, 2026-11-16, workstation, `.venv` Python 3.12, `pytest -p no:xdist`; the machine was short on
memory, hence the long wall times):

- `tests/test_bridge_preverify_2440.py` (new, 17 tests) + `tests/test_local_auth_inventory.py` (4 tests, one new):
  **21 passed** in one run (14 min wall: the local-auth sweep calls all ~1,900 route-methods).
  - `test_a_bad_signature_never_touches_the_write_gate`: ten refused calls (wrong key, tampered, stale, unsigned, a
    `purpose` body, no body, a non-object body) on both routes; `lock_stats()["holds"]` does not move.
  - `test_a_bad_signature_is_answered_while_a_writer_holds_the_gate`: the same calls answer while another thread holds
    the write gate (busy time-out raised to 20 s, so a call that still queued would hang the test).
  - `test_a_signed_call_is_answered_as_before_and_is_spent_once`, `test_the_screen_does_not_spend_the_nonce_...`,
    `test_a_refused_directory_push_is_counted_once_for_the_diagnostics`, `test_while_revoked_...`.
  - `test_conn_label_carries_the_route_template` (8 cases), `test_a_path_parameter_never_reaches_the_connection_label`.
  - `test_the_two_path_gates_are_noops_on_the_light_routes`, `test_the_light_routes_run_the_shared_steps_on_their_own_connection`
    (the 8 building-presence routes run the two gates and never the two skipped steps; `/me` runs all four in the old order).
  - `test_identity_dependencies_outside_principal_are_listed`: the dependency-name inventory (section 2).
- First run of the new file: 4 failed, 13 passed - all four were mistakes in the new tests (the error envelope's shape, a
  request body the route's model refused), none in the change.

NOT_RUN:

- The existing suites of the touched area (`test_ha.py`, `test_bridge_*`, `test_wxh*`, `test_remote_auth_first.py`,
  `test_raw_body_order.py`, the building-presence and gate suites) were started and had not finished when this commit
  was made; a follow-up commit records their result.
- `tests/test_remote_access.py` (the remote-channel sweep), the full backend suite, the entry check: NOT_RUN.

## For the closing chain (3B) / the lead

- `routers/presence.py` (`session_caller`, `any_caller`, `device_caller`: 34 routes) and
  `routers/notifications._remote_gate` still run none of the shared steps. They can adopt
  `auth.principal_light` + `shared_steps(light=True)` the same way; check the required-sensors gate first - these are the
  routes that lead OUT of the blocked state, so they must stay exempt.
- No entry check was run (batch rule): the lead combines.
