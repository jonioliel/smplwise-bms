# CORE-RELIABILITY-2540 - backend core review fixes: state sync window, backup lock, bearer rate limit, app factor rule

Branch `pilot/CORE-RELIABILITY-2540`, base `origin/release/2530-train` (`aeb05ad3d`). Target 2.54. Spec: findings **CORE-03**,
**CORE-05** (`docs/review/DEEP-REVIEW-2520-BACKEND-CORE.md`), **SEC-4**, **SEC-5** (`docs/review/DEEP-REVIEW-2520-SECURITY.md`) and
**V-03** (`docs/review/DEEP-REVIEW-2520-VIDEO.md`), as listed OPEN in `docs/review/DEEP-REVIEW-2520-INDEX.md`
(`chore/REVIEW-FINDINGS-INDEX-2530`). Each finding was confirmed present at the base before it was fixed.
No version bump, no changelog entry, no UI change, no lab / Home Assistant / NVR / go2rtc contact, no device writes.

## 1. What and why

### CORE-03 - a state change between the connect snapshot and the subscription was lost

`ha_sync.HaSync._session.on_ready` fetched and stored the full state snapshot (`get_states`, written in chunks), and only then
subscribed to `state_changed`. A state that changed in that window (Home Assistant restarting: integrations loading, the time when
most entities change) was in neither, and nothing read the states again until the next reconnect. The mirror kept the old state
(screens, `notify_sensors`, scenarios), with `fresh: true`.

- `state_changed` is now subscribed BEFORE `get_states` (the registry events already were). While the snapshot is fetched and stored,
  every state event is held in memory (`held`); once the snapshot is stored they are applied in arrival order through the same handler
  a live event uses (`apply_event`: mirror row, history, correlation, notifications, rules).
- An event older than what the snapshot stored for its entity (`last_updated` strictly older) is skipped
  (`held_event_is_stale`); an unknown or unreadable time applies the event; a removal (no new state) always applies.
- Applied right after `STATE.connected = True` with no `await` in between, so a new live event is never applied before a held one, and
  the held events see the same "connected" state live events saw before.
- Bounded: past `HELD_STATES_MAX` (20 000) held events only the newest event per entity is kept (`compact_held`, one warning line).
- Not done here (question 1): the periodic `get_states` reconciliation the review also suggests (it would also cover a state update lost
  to a busy database).

### CORE-05 - the daily and the manual backup held the write lock while compressing the archive

`backup.create_standalone` (the daily backup) ran `create` inside `db.connection()` - a write transaction, the single write lock - and
`POST /backups` ran it on the request's write connection. `create` writes nothing, but it held the lock for the whole compression of
plan files, bakes, the energy / water copies and the optional events / audit JSON. Past 10 s every waiting writer failed with
"database is locked" (HA state updates dropped, recorder alerts queued, user actions answered 500), every day and on every manual backup.

- `backup.create` is split into `prepare(conn, ...)` (everything read from the database: the snapshot, the schema version, the
  history switches, the password check - one consistent read, writes nothing) and `write_prepared(settings, prepared)` (writes the zip,
  no database connection). `create` = both, unchanged for its callers.
- Daily backup: `create_standalone` reads the snapshot in a WAL READ transaction (`mode="read"`: the same consistent view, blocks no
  writer) and writes the archive after that transaction has ended.
- `POST /backups`: the snapshot is read on the request's connection, the archive is written inside `db.unlocked(conn)` (the lock is
  given up), then the lock is taken back for the audit row. A weak / oversized backup password is still refused before anything is
  read or written.
- Restore guarantee kept: the restore's safety archive (`restore_safety.write`) still uses `create` on the restore's own write
  connection, so the way back is exactly the state right before the restore and nothing can be written between the two.
- Accepted side effect: plan files are read after the snapshot; a plan file deleted in that short window is listed in the archive's
  `missing_files` (as any missing file already is) instead of being blocked by the lock.

### SEC-5 - bearer re-validation was billed to the sign-in rate limit (security change)

**Before.** A client that sends its Home Assistant token on every request (an integration with a long-lived token, the use owner
decision Q48 keeps allowed) is re-validated against Home Assistant once its last validation is 60 s old. Each re-validation spent one
hit of the address's SIGN-IN budget (10 a minute, 50 an hour) and of the user's budget. A busy client spent about one hit a minute: after
about 50 minutes its session was DROPPED and every request answered 429 for up to an hour - and every browser sign-in from the same
address was refused too (same budget). While Home Assistant was restarting, every request of such a client was a billed, failed
validation answered 503: ten requests used up the minute, fifty the hour, and the address stayed locked out after Home Assistant was
back.

**After.**
- The sign-in budgets (per address and per user) count only tokens Arx does not know yet - which is what they protect Home Assistant
  from (guessed or stolen tokens). The re-validation of a bearer session that already exists is not billed; it is bounded by its own
  cache (at most one Home Assistant question per session per 60 s) and the sessions it can exist for were each billed when they began.
- When Home Assistant cannot be asked during a re-validation, the existing session is served and not re-checked again for
  `HA_BACKOFF_S` (30 s) - the rule the cookie path already had (review M3). It is never served past its token's expiry, a token
  Arx saw refused, or a revoked sign-in.
- A session is never dropped because of a rate limit. A NEW token is limited exactly as before (429 `rate_limited`, audited
  `rate_limited_ip` / `rate_limited_user`) and still gets 503 while Home Assistant is away.
- Unchanged: a token Home Assistant refuses, a revoked sign-in, a removed remote-access flag or any other policy refusal still ends the
  session at the next re-validation.

### SEC-4 - the phone app's web session counted only the authenticator code as a factor (security change)

**Before.** Once a policy required a second factor (`security.second_factor_policy = admins`, a `required` user or role override, or
the sign-in factor policy in `enforce`), the app's web session (`POST auth/app/session` and its redeem) refused every Home Assistant
user without an authenticator code - also users whose factor is the phone key (owner Q51: "password + phone key = two-factor"), a
passkey with `security.passkey_remote_factor` on, or Home Assistant's own MFA under the factor policy. The app signed in on the bearer
path (the phone key was accepted there), minted its saved sign-in, and then the web view never opened: "enrol a factor" for a user who
has one. The remote sign-in decided the same question with the full rule.

**After.**
- One shared rule, `ha_user_auth.factor_owed(conn, principal, passkey=...)`, extracted unchanged from `second_factor_need` (which now
  calls it after its own "rotation of your own cookie session" step). The app's `_enrol_refused` uses it with `passkey=True`:
  - authenticator code, a counting passkey (switch on), or - under a `required` policy - an active phone key: admitted;
  - no policy requirement: admitted (as before);
  - required by the enforced sign-in factor policy alone (`ha_mfa`): admitted only when the sign-in that minted the app's family had
    Home Assistant MFA (`app_refresh_families.ha_mfa = 1`); 0 or NULL (an older family) refuses;
  - no factor (`enroll`), an administrator's reset (`must_enroll`), or any answer the check does not know: refused, as before
    (403 `second_factor_enrollment_required`, audited `enrol_required`). Fail closed.
- Arx-only (local) identities are unchanged (their own factor gate).

### V-03 - generic NVR undo did not check the device first: NOT fixed here (already done by another 2.54 row)

Confirmed present at the base, and a fix with tests was written - but `pilot/CAST-RELAY-HARDEN-2540` (`0b1990190`) already ships the
same fix in `services/nvr_write.py` / `routers/nvr_write.py` (read and compare before the PUT, 409 `changed_since`, 409
`already_rolled_back`, explicit `force: true`, audited) with `tests/test_nvr_undo_changed_since_2540.py`. To avoid two conflicting
edits of the same function, this branch does not touch those files. One difference noted for the lead (question 3): this row's version
also recorded, on a forced undo over a changed document, the document it really overwrote as the undo row's `before` (so undoing the
undo brings that state back); the other row records the change's `after` as before.

## 2. Files

- `smplwise_vms/backend/smplwise/services/ha_sync.py` - subscribe first, hold, apply (`held_event_is_stale`, `compact_held`,
  `HELD_STATES_MAX`)
- `smplwise_vms/backend/smplwise/services/backup.py` - `prepare`, `write_prepared`; `create_standalone` on a read transaction
- `smplwise_vms/backend/smplwise/routers/backup.py` - `POST /backups` compresses inside `unlocked`
- `smplwise_vms/backend/smplwise/services/ha_user_auth.py` - `_bearer_session` budgets and back-off; `factor_owed`
- `smplwise_vms/backend/smplwise/services/app_session.py` - `_enrol_refused(conn, fam)` on the shared rule
- tests (new): `test_core_reliability_2540_sync.py`, `test_core_reliability_2540_backup.py`, `test_core_reliability_2540_bearer.py`,
  `test_core_reliability_2540_app_factor.py`

API: no route, field or code added or removed (ADR-015). No new setting: every change keeps today's behaviour for what a user sees,
except that the refusals described above no longer happen.

## 3. Tests

Each new test file was run against the base sources (the fix files checked out from `HEAD`) and then against the fixed sources, on the
PC, one pytest process per file (`.venv\Scripts\python.exe -m pytest <file> -p no:cacheprovider -rA`):

| Finding | File | Base sources (before) | Fixed sources (after) |
|---|---|---|---|
| CORE-03 | `test_core_reliability_2540_sync.py` (5) | exit 1: 4 failed, 1 passed (the "older event is skipped" guard passes on both) | exit 0: 5 passed |
| CORE-05 | `test_core_reliability_2540_backup.py` (4) | exit 1: 3 failed ("database is locked" for the probe writer while compressing), 1 passed (weak password guard) | exit 0: 4 passed |
| SEC-5 | `test_core_reliability_2540_bearer.py` (4) | exit 1: 2 failed (busy client 429 + dropped; HA outage 503), 2 passed (new tokens still limited; refusal still ends the session) | exit 0: 4 passed |
| SEC-4 | `test_core_reliability_2540_app_factor.py` (12) | exit 1: 11 failed, 1 passed. The behavioural failure is the phone-key administrator (403 `second_factor_enrollment_required`); the 10 rule-table / source tests fail at the base because `factor_owed` does not exist there | exit 0: 12 passed |
| V-03 | (dropped from this branch, see 1.) | written and run here: exit 1, 4 failed | exit 0, 4 passed - not committed |

Full backend suite and ruff: on the runner, see RUNNER_RESULTS.

## 4. Open questions

1. Periodic state reconciliation (CORE-03's second suggestion: one `get_states` every 10 minutes that rewrites only rows whose
   `last_updated` differs; it also heals a state update lost to a busy database).
   a) a follow-up row in 2.55 (recommended) - b) not needed.
2. A new token whose validation fails because Home Assistant is away still spends one sign-in hit (only existing sessions were
   exempted). a) keep it so (recommended: unknown tokens stay limited even during an outage) - b) refund the hit on 503.
3. V-03 is in `pilot/CAST-RELAY-HARDEN-2540`. a) keep that version, optionally add "record the overwritten document on a forced
   undo" there (recommended) - b) nothing more.
