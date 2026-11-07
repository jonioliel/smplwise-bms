# FOLLOWUPS-2406 - five follow-ups from the 2.40.5 train (WisKey re-probe, refused token, test order, tab strip, push latency)

Branch `fix/FOLLOWUPS-2406`, cut from `origin/release/2405-train` at `eadc5b080` (the 2.40.5 train: T035, WXH, PIXEL-DRIFT already in).
Ships as 2.40.6. No merge, no version bump, no changelog entry, no UI rebuild, no tag. No lab, Home Assistant, NVR, go2rtc, WisKey or
station contact: fakes, mocks and synthetic data only.

Sources (the lead's decisions): `docs/changes/T035-OUTAGE-RUN-2405.md` §6 (the two known limits), `WXH-LEFTOVERS-2405.md` (classification of
the non-passes), `PIXEL-DRIFT-2405.md` §1.5 (installer-lifecycle-1440), `FIXTURE-SPECS-2405.md` §2 (evidence-home-screen:632).

| # | Follow-up | Kind | Result |
|---|---|---|---|
| 1 | WisKey back after a long absence waited up to 5 minutes | product | re-probe ladder 15 s, 30 s, then 60 s |
| 2 | A refused HA token was retried at least once a minute, forever, by three loops | product | one shared slow ladder per token, 30 s doubling to 15 minutes |
| 3 | `test_notify_channels::test_release_route_*` / `test_wiskey_pairing_2382::test_rotation_switch_on_*` order-dependent | tests | two leaks found and closed, plus a per-test teardown |
| 4 | The top tab strip drawn scrolled in 1 of 2 runs (installer-lifecycle-1440) | product (user-visible) | path-independent automatic reveal in `sw-tabs` |
| 5 | Home-screen weather card flake (evidence-home-screen:632) | product | the cause proven: push sockets held executor threads; now none do |

## 1. WisKey returning after a long absence

**Before.** With Home Assistant up and WisKey's commands unknown, the feed concluded `not_installed` (or `forbidden` when WisKey refuses the
add-on's user) and re-probed every `RETRY_ABSENT_S` = 300 s. The owner-reviewed B1 design kept the conclusion; only the wait was long.

**Now** (`services/intercom_sync.py`, `services/wiskey_background_feed.py`): `absent_delay(n)` = `min(RETRY_ABSENT_S, RETRY_ABSENT_FIRST_S *
2^(n-1))` with `RETRY_ABSENT_FIRST_S` = 15 s and `RETRY_ABSENT_S` = 60 s (the cap): 15 s, 30 s, 60 s, 60 s ... The count is the number of
consecutive absent answers on a working HA socket; any other outcome (ready, WisKey loading, HA down) starts it over, so the ladder applies
only while the HA connection is up. Each re-probe is one `hikvision_intercom/overview` on an authenticated socket (no HA login, no IP-ban
exposure). The main feed and the background feed use the same function. Unchanged: the B1 rules (an HA restart is not read as "not
installed"; after a ready session `ABSENT_AFTER_READY` quick probes before concluding), the copy dropped when absent, nothing replayed.

Tests: `test_intercom.py::test_absent_re_probe_ladder_values` (production values) and
`::test_absent_wiskey_is_re_probed_on_the_ladder_and_comes_back_by_itself` (scaled ladder: the gaps grow, the cap caps, the first probe after
WisKey is back turns the feed `ready` without a restart). `test_outage_run_t035.py::test_s04_wiskey_restarting` unchanged in substance (its
known-limit text now names the ladder).

## 2. Rejected HA token: a slow, shared, resettable back-off

**Before.** `auth_invalid` at the WebSocket `auth` step raised `ha_forbidden`; the HA sync (5 s doubling to 60 s), the WisKey feed (5 s to
60 s) and the background feed each retried on their own back-off - three failed logins a minute or more, for as long as the token stayed
revoked. With HA's `http: login_attempts_threshold` on, those count toward an IP ban.

**Now** (`services/ha_client.py`):

- A token HA refused (`auth_invalid` only; any other broken handshake is not counted) is entered in a process-wide ledger keyed by a SHA-256
  prefix of the token (the token itself is never kept, logged or returned).
- Every WebSocket session with that token waits on one ladder: `refused_step(n)` = 30 s, 60 s, 120 s, 240 s, 480 s, then 900 s (15 minutes,
  `REFUSED_MAX_S`). One attempt per step is let through, whichever loop asks first (`_claim_attempt` reserves it); a session asked for in
  between is refused at once with the same `ha_forbidden` (`details.held: true`, `retry_in_s`) **without contacting HA**. So the whole add-on
  makes at most one failed login per step, not one per loop.
- Reset: `auth_ok` forgets the token; a different token is never held (the owner's new token, a fresh Supervisor token after an add-on
  restart - a new process anyway); `reset_refusals()` clears the ledger and wakes every loop waiting one out. It is called when the add-on
  restarts the platform (`ha_sync.note_restart_initiated`, used by `addon_restart` and the WisKey managed install) and when any secret is
  saved in Settings (`secrets_store.apply_live`).
- The loops (`ha_sync._loop`, `IntercomSync._loop`, `BackgroundFeed._main`) wait `max(own back-off, refused_wait(token))` and log only
  attempts that reached HA (a held one is not logged again). The WisKey feeds' wait is `ha_client.wait_or_reset`, so a reset ends it at once.
- Operator state: unchanged words (T035 D3: the top bar's `ha` **error** "תשתית המערכת דחתה את הרשאת הגישה של התוסף ..." and the sync line
  "תשתית המערכת דחתה את ההרשאה" stay for the whole slow back-off, since `last_error` stays `ha_forbidden`); new in `ha_sync.STATE` (served in
  `/ha/status` `sync` and the `/ha/ws` heartbeat): `auth_refusals` (consecutive refusals, 0 while accepted) and `next_attempt_at` (UTC). Typed
  as optional fields in `frontend/src/api/ha.ts`; no screen change.
- REST calls are not gated: they are made on demand, at a person's pace.

Tests (`tests/test_followups_2406.py`): the ladder values; one attempt per step, a new token never held, `auth_ok` forgets, a reset clears;
the ledger holds no token text; a held session does not open a socket to HA while another token does; the HA sync loop on a refused token
(scaled ladder 0.2 s doubling to 0.8 s against its own 0.05 s back-off: the gaps follow the ladder, `ha_forbidden`, `auth_refusals`,
`next_attempt_at`; then `note_restart_initiated` ends a 30 s wait at once). `test_outage_run_t035.py::test_s03_token_revoked` scales the new
ladder (0.1 s doubling to 0.4 s) and keeps every assertion: refused, the summary error, it keeps trying (slowly), ready again by itself after
a valid token, 0 frames. `tests/conftest.py` clears the ledger before and after each test (all fakes use the token "t").

## 3. The order-dependent pair

Both tests failed in the WXH combined selection (also on `main`) and passed alone. A leak probe (a pytest hook that recorded every test
after which `intercom_sync.STATE` / the served copy / `SW_HA_CONFIG_DIR` had changed) over that selection named two leaks:

| Leak | Where | Effect |
|---|---|---|
| A WisKey copy (stations of a bridge-key test, no `station-1`) and `STATE.state = "ready"` left in `intercom_sync.SYNC` | `tests/fake_trusted_bridge.FakeWisKeyFeed.install` set `_cache` and `STATE.state` directly (only `served` / `action` went through monkeypatch); first seen after `test_bridge_key_pause_295` | `test_release_route_*`: `_station` answered 404 `intercom_station_not_found` before the route recorded `origin`, so no audit row carried it |
| `intercom_sync.STATE.wiskey_version = "4.2.0"` | `test_notify_sources::test_the_real_intercom_cache_store_signals_a_ring` stores an overview on a private `IntercomSync()`, and `_store` writes the module-wide `STATE` | `test_rotation_switch_on_*`: `bridge_rotation.wiskey_present()` read WisKey as present, so the rotation line was `rotation_blocked_wiskey` (ok) instead of `rotation_risk` (warn) |

Fixes, all fixture teardown: `FakeWisKeyFeed.install` sets the copy and the state through `monkeypatch` (undone with the test); the
notify-sources test puts `intercom_sync.STATE` back through `monkeypatch`; and `tests/conftest.py::_intercom_feed_state_is_per_test` (autouse)
returns the feed STATE to idle and drops a left-over copy before and after every test - skipped while a feed thread a test started is
still alive, never pulled from under it.

Proof (workstation, explicit node ids; receipts below): on the base `eadc5b080`, leakers first
(`test_bridge_key_pause_295::test_every_unfinished_state_pauses_a_door_open_and_nothing_is_sent`, then the notify-sources test, then the two
victims): **both victims FAIL**. On the branch, the same order: **11 passed**; the reverse order (victims first, then the leakers): **11
passed**.

## 4. The tab-strip race (installer-lifecycle-1440)

**Cause.** `sw-tabs.revealActive()` scrolls the active tab into view by a delta from the CURRENT scroll position, on every resize / font
event. The shell's top strip changes width while it settles (`sw-app.updated()`: the title-row chips from 1100 px, the fit pump over several
frames). When a callback saw a narrower intermediate width, the reveal scrolled further; at the final width the active tab was already in
view, so nothing moved back - the final scroll depended on which widths the callbacks happened to see. A person could see it too (a strip
opened scrolled, both arrows showing, a different window of tabs), so it is a product fix.

**Now** (`frontend/src/components/sw-tabs.ts`): until the person scrolls the strip (wheel, swipe/pointer, an arrow, the arrow keys), the
automatic reveal starts from the start edge every time (`scrollLeft = 0`, the start in both directions, then the same reveal) - so the result
depends only on the final width. Both steps run in one task before any paint (no flicker). After a manual scroll a reveal only nudges the
active tab into view, as before (a resize or a new count never throws the person's scroll away); a new set of tab ids starts over.

Test: `frontend/tests/evidence-tabs-scroll-2331.spec.ts` "FOLLOWUPS-2406: the automatic reveal does not depend on the widths the strip passed
through" (a 12-tab strip, active tab 8: straight to 560 px vs 260 px then 560 px must give the same scroll; the narrow width must differ, and
560 px must still overflow, so the check proves something; after a manual scroll and a resize the active tab stays in view).

## 5. The home-screen weather flake (evidence-home-screen:632)

**Cause, proven.** The three push sockets (`/ha/ws`, `/events/ws`, `/intercom/ws`) waited for their next frame with
`run_in_executor(None, q.get, True, 30)`: one thread of the event loop's default executor per open socket, held for the socket's whole life.
That executor has `min(32, cpu_count + 4)` threads. Idle sockets of the OTHER kinds (an `/events/ws` with no camera event, an `/intercom/ws`)
hold threads too; once they fill the pool, an `/ha/ws` socket's wait sits in the executor's queue and its state push is delivered only when
one of those 30 s waits runs out. In the combined fixture runs several browsers each hold their sockets (plus sockets of closed tabs until
their next send fails) - the two 20 s timeouts in FIXTURE-SPECS-2405 §2. On a real installation the same happens with enough open screens
(wall displays, phones): a light's or a sensor's state reaches a screen up to 30 s late. Product, not test.

**Now** (`services/push_queue.py`): `PushQueue` is a `queue.Queue` (publishers unchanged: `put_nowait`, `queue.Full` for a slow socket) that
also wakes its one waiting coroutine through `loop.call_soon_threadsafe`; `next_item(q, timeout)` waits without any thread and raises
`queue.Empty` after the timeout (the handlers send their heartbeat then, as before). `ha_sync.subscribe`, `events_ingest.subscribe` and
`intercom_sync.subscribe` return a `PushQueue`; the three handlers call `push_queue.next_item(q, 30)`. A plain `queue.Queue` (a test's
stand-in) is polled every 50 ms.

Test: `test_followups_2406.py::test_a_state_push_is_not_held_up_by_other_idle_sockets` - 34 idle `/events/ws` sockets (more than the largest
default executor) and one `/ha/ws`; a published state reaches it in under 5 s. The same test with the old wait patched back in fails: the
`/ha/ws` socket's first frame is the 30 s heartbeat, not the push (receipt below). Plus `test_push_queue_wakes_its_waiter_without_a_thread`
and `test_a_plain_queue_still_works`. The Playwright spec itself is not changed (its 20 s bound is right once the push is not starved).

## 6. Tests and receipts

All on the workstation (Windows, Python 3.12, explicit files / node ids). The 2.40.5 release gate occupied the runner for the whole
session, and the work was stopped at the 97 % usage limit before it ended: **no runner job was run** (see section 7, TODO).
Receipts: `docs/changes/receipts/FOLLOWUPS-2406/`.

| What | Code | Result | Receipt |
|---|---|---|---|
| `test_followups_2406.py` (8 new) | branch | 8 passed | (console) |
| `test_intercom.py` ladder tests + the absent / restart / gone-after-ready tests | branch | passed | (console) |
| 7 files: `test_outage_run_t035`, `test_intercom`, `test_wiskey_background`, `test_automations_probe`, `test_media_probe`, `test_scheduler_probe`, `test_fake_wiskey` | branch (parts 1-2) | 278 passed, 0 failed | (console) |
| 24 affected files (ha, ha_sync_1000, ha_users, events, backpressure, media_*, schedules_mirror, secrets_*, self_update_s3_fixes, announce_*, lat1, the T035 / intercom / background / notify-sources / bridge-key / door-path files, the new file) | `46b4cb579` | **1 failed**, the rest passed: `test_lat1_toggle_latency::test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock` (2651 ms > 1900 ms bound) - the timing-bound test T035 §5 already saw miss once on the busy workstation; two pytest runs shared the machine; this branch does not touch its path | (console) |
| Order proof, base `eadc5b080`, leakers first | base | **2 failed** (the pair), 9 passed | `order_base_leakers_first.txt` |
| Order proof, branch, both orders | `46b4cb579` | 11 passed / 11 passed | `order_branch_both_orders.txt` |
| The WXH-like 25-file selection with the leak probe | branch code before the leak fixes | the pair failed, nothing else; the probe named the two leaks | `leak_probe_selection_workstation.txt` |
| Socket test: new wait vs the old executor wait | `46b4cb579` | new passed; old failed (first frame = the 30 s heartbeat) | `push_socket_old_vs_new_workstation.txt` |
| `tsc --noEmit` | branch | exit 0 | (console) |
| `scripts/release_check.py` | branch | RESULT: ready for the owner's approval (2.40.5 unchanged; the only FAIL is the expected missing tag v2.40.5) | (console) |

## 7. Known limits, NOT_RUN, TODO

- **TODO (NOT_RUN, runner):** the backend selection on the runner (the new file, the 24 affected files, the WXH 25-file selection in both
  file orders), `evidence-tabs-scroll-2331.spec.ts` (the new reveal test + the existing ones, every project) and
  `evidence-home-screen.spec.ts:632` in a combined fixture run. Not started: the release gate held the runner, then the usage stop.
- `test_lat1_toggle_latency` missed its timing bound once on the workstation (above); to be confirmed green on the runner.

- No hardware, no real Home Assistant: the IP-ban exposure is reasoned from HA's documented `login_attempts_threshold`, not measured; the
  ladder bounds the add-on to at most one failed login per step (30 s, 60 s, ... 15 minutes).
- The background feed's refused-token handling shares the ledger and the loop change, but has no scenario test of its own (the main feed's
  S03 and the HA sync loop test cover the same code paths in `ha_client`).
- REST calls with a refused token are not held (on demand, at a person's pace).
- A saved background token still needs an add-on restart to be used by the background feed (`restart_required`, unchanged); the save only
  clears the ledger.
- The UI is not rebuilt here (the release train rebuilds it); `sw-tabs` changes no layout, so no screenshots beyond the spec.

## 8. Rollback

Revert the branch's commits. The five parts are independent of each other and of the schema (no migration, no setting). Reverting part 2
brings back the per-loop retries (≤ 60 s); part 5 the executor wait (thread per socket).
