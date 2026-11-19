"""CR-FEED-BASE-2450 (code review 2026-11-13, finding 02:P2-5): characterisation of the two WisKey feed clients' shared session
skeleton - the service feed (`intercom_sync.IntercomSync`) and the background feed (`wiskey_background_feed.BackgroundFeed`).

Written BEFORE the skeleton moved into a shared base and run green on the unchanged code; the refactor must keep every
assertion here unchanged. What is pinned, for BOTH clients:

- the reconnect ladder: the exact wait after each outcome of a session (socket failure, normal end, WisKey loading, not
  installed / refused, any other WisKey error, a refused Home Assistant token, a held attempt), the backoff doubling and its
  cap, the absent re-probe ladder and its reset, the state and last error each outcome leaves, the reconnect counter, the
  log lines (once per distinct error) and the stop path (no wait after a stop);
- the small session methods: `_fail`, `_replay_early` (early event frames handled once the subscription id is known),
  `_maybe_loading` (the RUNNING / re-probe rule), `_kick` (task name, tracked with the session) and `_refresh` (single flight,
  the error mapping of each client);
- the frames each client sends on a real (scripted) Home Assistant WebSocket, in order, for a normal start, a `refresh` push,
  `access_revoked`, WisKey loading and not installed; and what a shutdown leaves behind.

The ladder is driven without sockets: `_session` is replaced by a scripted coroutine and `ha_client.wait_or_reset` records the
delay it is asked to wait instead of sleeping."""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import replace
from typing import Any, Callable

import pytest
from test_intercom import FakeHa, fail, feed, ha_config, normal, ok
from test_wiskey_background import by_token, restricted_overview, split

from smplwise.errors import ApiError
from smplwise.services import ha_client, intercom_client, intercom_sync, wiskey_background_feed as wbf
from smplwise.services.intercom_client import IntercomError
from support.waiting import wait_for

KINDS = ("service", "background")
SHARED_FIXTURES = (feed, split)  # the scripted-socket fixtures of test_intercom / test_wiskey_background, used by name below


# ---------------------------------------------------------------- one accessor shape over both clients' state

class Client:
    """A fresh client of `kind` plus uniform access to the state it keeps (the service feed in the module's STATE, the
    background feed in its own `status`)."""

    def __init__(self, kind: str, settings: Any) -> None:
        self.kind = kind
        if kind == "service":
            intercom_sync.STATE.reset()
            self.c: Any = intercom_sync.IntercomSync()
            self.c.settings = replace(settings, ha_url="http://ha.local:8123", ha_token="svc-token")
            self.log_name = "WisKey feed"
            self.token = "svc-token"
        else:
            self.c = wbf.BackgroundFeed()
            self.c.settings = replace(settings, ha_url="http://ha.local:8123", ha_token="svc-token", wiskey_background_token="bg-token")
            self.log_name = "WisKey background feed"
            self.token = "bg-token"

    def state(self) -> str:
        return intercom_sync.STATE.state if self.kind == "service" else self.c.status["state"]

    def last_error(self) -> str | None:
        return intercom_sync.STATE.last_error if self.kind == "service" else self.c.status["last_error"]

    def connected(self) -> bool:
        return intercom_sync.STATE.connected if self.kind == "service" else self.c.status["connected"]

    def set_connected(self, value: bool) -> None:
        if self.kind == "service":
            intercom_sync.STATE.connected = value
        else:
            self.c.status["connected"] = value

    def reconnects(self) -> int:
        return intercom_sync.STATE.reconnects if self.kind == "service" else self.c.status["reconnects"]

    def hold_copy(self) -> None:
        if self.kind == "service":
            with self.c._cache_lock:
                self.c._cache = {"stations": []}
        else:
            with self.c._lock:
                self.c._projection = {"stations": []}

    def has_copy(self) -> bool:
        if self.kind == "service":
            return self.c._cache is not None
        return self.c._projection is not None

    def set_sub(self, sub: int) -> None:
        if self.kind == "service":
            self.c._wiskey_sub = sub
        else:
            self.c._sub = sub


@pytest.fixture()
def ladder(settings, monkeypatch):
    """Production-shaped ladder constants (set explicitly: other tests shorten them), the lease hook recorded, and a driver
    that runs one client's whole reconnect loop over a scripted list of session outcomes."""
    monkeypatch.setattr(intercom_sync, "RETRY_S", 5.0)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 60.0)
    monkeypatch.setattr(intercom_sync, "RETRY_ABSENT_FIRST_S", 15.0)
    monkeypatch.setattr(intercom_sync, "RETRY_ABSENT_S", 60.0)
    hooks: list[str] = []
    monkeypatch.setattr(intercom_sync, "_lease_hook", lambda reason, station_ids=None: hooks.append(reason))
    refused: list[str | None] = []

    def refused_wait(token: str | None) -> float:
        refused.append(token)
        return 300.0

    monkeypatch.setattr(ha_client, "refused_wait", refused_wait)

    def drive(kind: str, outcomes: list[Any]) -> tuple[Client, list[float]]:
        """`outcomes`: one per session - an exception to raise, None to return normally, or a callable(client) run first
        (its own return value is then the outcome)."""
        cl = Client(kind, settings)
        script = list(outcomes)
        waits: list[float] = []

        async def session(stop_evt: asyncio.Event) -> None:
            item = script.pop(0)
            if callable(item) and not isinstance(item, BaseException):
                item = item(cl)
            if isinstance(item, BaseException):
                raise item

        async def wait_or_reset(delay: float, stop: asyncio.Event) -> None:
            waits.append(round(delay, 6))
            if not script:
                cl.c.stop.set()

        monkeypatch.setattr(cl.c, "_session", session)
        monkeypatch.setattr(ha_client, "wait_or_reset", wait_or_reset)
        cl.c._run()
        assert not script, "every scripted session ran"
        return cl, waits

    drive.hooks = hooks  # type: ignore[attr-defined]
    drive.refused = refused  # type: ignore[attr-defined]
    yield drive
    intercom_sync.STATE.reset()


def ready_then_end(cl: Client) -> None:
    """A session that reached `ready` and then ended without an error (Home Assistant closed the socket)."""
    cl.c._set_state("ready", None)
    cl.set_connected(True)


def connected_then(exc: BaseException) -> Callable[[Client], BaseException]:
    def run(cl: Client) -> BaseException:
        cl.set_connected(True)
        return exc
    return run


def not_installed() -> IntercomError:
    return IntercomError("unknown_command", "overview")


# ---------------------------------------------------------------- the reconnect ladder

@pytest.mark.parametrize("kind", KINDS)
def test_socket_failures_double_the_backoff_up_to_the_cap(ladder, kind):
    cl, waits = ladder(kind, [OSError("refused")] * 6)
    assert waits == [5.0, 10.0, 20.0, 40.0, 60.0, 60.0]
    assert (cl.state(), cl.last_error(), cl.connected(), cl.reconnects()) == ("ha_unavailable", "OSError", False, 0)


@pytest.mark.parametrize("kind", KINDS)
def test_a_normal_end_waits_the_backoff_it_had_reached_then_restarts_the_ladder(ladder, kind):
    """The wait after a session that ended normally is the backoff reached BEFORE it (the reset applies to the next one)."""
    cl, waits = ladder(kind, [OSError("x"), OSError("x"), ready_then_end, OSError("x"), OSError("x")])
    assert waits == [5.0, 10.0, 20.0, 10.0, 20.0]
    assert cl.reconnects() == 1 and cl.connected() is False


@pytest.mark.parametrize("kind", KINDS)
def test_a_ready_session_that_ends_is_ha_unavailable_disconnected(ladder, kind):
    cl, waits = ladder(kind, [ready_then_end])
    assert waits == [5.0]
    assert (cl.state(), cl.last_error(), cl.connected(), cl.reconnects()) == ("ha_unavailable", "disconnected", False, 1)
    assert ladder.hooks == (["feed_reconnect"] if kind == "service" else []), "only the service feed revokes capture leases"


@pytest.mark.parametrize("kind", KINDS)
def test_a_session_that_ends_before_ready_keeps_its_state(ladder, kind):
    def connecting(cl: Client) -> None:
        cl.c._set_state("connecting", None)

    cl, waits = ladder(kind, [connecting])
    assert waits == [5.0] and cl.state() == "connecting" and cl.reconnects() == 0


@pytest.mark.parametrize("kind", KINDS)
def test_wiskey_loading_retries_on_the_short_backoff_and_resets_it(ladder, kind):
    cl, waits = ladder(kind, [OSError("x"), OSError("x"), IntercomError(intercom_sync.LOADING, "overview"), OSError("x"), OSError("x")])
    assert waits == [5.0, 10.0, 5.0, 5.0, 10.0]
    assert cl.state() == "ha_unavailable"
    cl, _ = ladder(kind, [IntercomError(intercom_sync.LOADING, "overview")])
    assert (cl.state(), cl.last_error()) == ("connecting", intercom_sync.LOADING)


@pytest.mark.parametrize("kind", KINDS)
def test_not_installed_walks_the_absent_ladder_and_drops_the_copy(ladder, kind):
    def holding(cl: Client) -> IntercomError:
        cl.hold_copy()
        return not_installed()

    cl, waits = ladder(kind, [holding, not_installed(), not_installed(), not_installed(), OSError("x")])
    assert waits == [15.0, 30.0, 60.0, 60.0, 60.0], "the absent ladder; the normal backoff kept doubling underneath it"
    assert not cl.has_copy()
    cl, _ = ladder(kind, [not_installed()])
    assert (cl.state(), cl.last_error()) == ("not_installed", "unknown_command")


@pytest.mark.parametrize("kind", KINDS)
def test_the_absent_ladder_starts_again_after_any_other_outcome(ladder, kind):
    _cl, waits = ladder(kind, [not_installed(), not_installed(), OSError("x"), not_installed()])
    assert waits == [15.0, 30.0, 20.0, 15.0]


@pytest.mark.parametrize("kind", KINDS)
def test_unauthorized_is_forbidden_on_the_absent_ladder(ladder, kind):
    def holding(cl: Client) -> IntercomError:
        cl.hold_copy()
        return IntercomError("unauthorized", "overview")

    cl, waits = ladder(kind, [holding, IntercomError("unauthorized", "subscribe")])
    assert waits == [15.0, 30.0]
    assert (cl.state(), cl.last_error(), cl.has_copy()) == ("forbidden", "unauthorized", False)


@pytest.mark.parametrize("kind", KINDS)
def test_any_other_wiskey_error_is_error_on_the_normal_backoff_and_keeps_the_copy(ladder, kind):
    def holding(cl: Client) -> IntercomError:
        cl.hold_copy()
        return IntercomError("screen_locked", "subscribe")

    cl, waits = ladder(kind, [holding, IntercomError("invalid_response", "overview")])
    assert waits == [5.0, 10.0]
    assert (cl.state(), cl.last_error(), cl.has_copy()) == ("error", "invalid_response", True)


@pytest.mark.parametrize("kind", KINDS)
def test_a_refused_token_waits_on_the_shared_refusal_ladder_of_its_own_token(ladder, kind):
    cl, waits = ladder(kind, [ApiError(503, "ha_forbidden", "refused"), ApiError(503, "ha_unavailable", "down")])
    assert waits == [300.0, 10.0], "max(backoff, refused_wait(token)); the backoff doubles as usual"
    assert ladder.refused == [cl.token], "each client asks about its own token"
    assert (cl.state(), cl.last_error()) == ("ha_unavailable", "ha_unavailable")


@pytest.mark.parametrize("kind", KINDS)
def test_log_lines_once_per_distinct_error_and_never_for_a_held_attempt(ladder, kind, caplog):
    caplog.set_level(logging.DEBUG, logger="smplwise.intercom")
    ladder(kind, [
        IntercomError("unauthorized", "overview"), IntercomError("unauthorized", "overview"), IntercomError("screen_locked", "subscribe"),
        OSError("x"), ApiError(503, "ha_unavailable", "held", details={"held": True}), ready_then_end, IntercomError("screen_locked", "subscribe"),
    ])
    name = "WisKey feed" if kind == "service" else "WisKey background feed"
    lines = [r.getMessage() for r in caplog.records if r.name == "smplwise.intercom" and r.levelno == logging.WARNING]
    # the remembered error is cleared by a session's own `ready` step (on_ready), not by the ladder: the scripted session
    # here never runs on_ready, so the repeat of `screen_locked` after it stays silent
    assert lines == [
        f"{name}: forbidden (unauthorized)",
        f"{name}: error (screen_locked)",
        f"{name} disconnected: OSError (retry in 40s)",
    ], lines


@pytest.mark.parametrize("kind", KINDS)
def test_reconnects_count_only_sessions_that_were_connected(ladder, kind):
    cl, waits = ladder(kind, [connected_then(OSError("x")), OSError("x"), connected_then(IntercomError("screen_locked", "subscribe"))])
    assert waits == [5.0, 10.0, 20.0]
    assert cl.reconnects() == 2 and cl.connected() is False
    assert ladder.hooks == (["feed_reconnect", "feed_reconnect"] if kind == "service" else [])


@pytest.mark.parametrize("kind", KINDS)
def test_a_failure_after_stop_ends_the_loop_without_a_wait(ladder, kind):
    def stopping(cl: Client) -> BaseException:
        cl.set_connected(True)
        cl.c.stop.set()
        return OSError("socket closed by shutdown")

    cl, waits = ladder(kind, [OSError("x"), stopping])
    assert waits == [5.0], "no wait and no state change after the stop"
    assert (cl.state(), cl.last_error(), cl.connected(), cl.reconnects()) == ("ha_unavailable", "OSError", False, 0)


@pytest.mark.parametrize("kind", KINDS)
def test_a_wiskey_error_after_stop_still_records_and_waits_once(ladder, kind):
    """Only a socket-level failure checks the stop flag; a WisKey answer is recorded, then the loop sees the stop."""
    def stopping(cl: Client) -> BaseException:
        cl.c.stop.set()
        return IntercomError("screen_locked", "subscribe")

    cl, waits = ladder(kind, [stopping])
    assert waits == [5.0] and cl.state() == "error"


# ---------------------------------------------------------------- the small session methods

@pytest.mark.parametrize("kind", KINDS)
def test_fail_records_the_fault_and_ends_the_session(settings, kind):
    cl = Client(kind, settings)
    exc = IntercomError("unauthorized", "subscribe")
    cl.c._fail(exc)
    assert cl.c._fault is exc, "no session: the fault is still kept"
    end = asyncio.Event()
    cl.c._end = end
    other = RuntimeError("x")
    cl.c._fail(other)
    assert cl.c._fault is other and end.is_set()


@pytest.mark.parametrize("kind", KINDS)
def test_early_frames_are_replayed_once_the_subscription_id_is_known(settings, kind, monkeypatch):
    cl = Client(kind, settings)
    kicked: list[int] = []
    monkeypatch.setattr(cl.c, "_kick", lambda: kicked.append(1))
    refresh = {"id": 7, "type": "event", "event": {"kind": "refresh"}}
    stray = {"id": 99, "type": "event", "event": {"kind": "refresh"}}
    cl.c._on_message(refresh)
    cl.c._on_message(stray)
    assert list(cl.c._early) == [refresh, stray] and kicked == [], "unknown ids wait in the early buffer"
    cl.set_sub(7)
    cl.c._replay_early()
    assert kicked == [1], "the frame of the now known subscription is handled"
    assert list(cl.c._early) == [stray], "a frame still unknown goes back into the buffer"
    for i in range(30):
        cl.c._on_message({"id": 1000 + i, "type": "event", "event": {}})
    assert len(cl.c._early) == 20 and cl.c._early[0]["id"] == 1010, "the buffer keeps the newest 20"


@pytest.mark.parametrize("kind", KINDS)
def test_access_revoked_fails_the_session_as_unauthorized(settings, kind, monkeypatch):
    cl = Client(kind, settings)
    monkeypatch.setattr(intercom_sync, "_lease_hook", lambda *_a, **_k: None)
    cl.set_sub(3)
    cl.c._end = asyncio.Event()
    cl.c._on_message({"id": 3, "type": "event", "event": {"kind": "access_revoked"}})
    assert isinstance(cl.c._fault, IntercomError) and cl.c._fault.code == "unauthorized" and cl.c._fault.command == "subscribe"
    assert cl.c._end.is_set()


@pytest.mark.parametrize("kind", KINDS)
def test_maybe_loading_rule(settings, kind, monkeypatch):
    monkeypatch.setattr(intercom_sync, "ABSENT_AFTER_READY", 3)
    sent: list[str] = []

    def call_with(state: str | None, success: bool = True) -> Any:
        async def call(msg_type: str, **_kw: Any) -> dict[str, Any]:
            sent.append(msg_type)
            return {"success": success, "result": {"state": state} if state else None}
        return call

    async def run(cl: Client, call: Any) -> bool:
        return await cl.c._maybe_loading(call)

    cl = Client(kind, settings)
    assert asyncio.run(run(cl, call_with("STARTING"))) is True, "HA not RUNNING: may still be loading"
    assert asyncio.run(run(cl, call_with(None, success=False))) is True, "no answer: may still be loading"
    assert asyncio.run(run(cl, call_with("RUNNING"))) is False, "HA RUNNING and never ready: not installed"
    cl.c._was_ready = True
    assert [asyncio.run(run(cl, call_with("RUNNING"))) for _ in range(4)] == [True, True, False, False], "after a ready session: re-probed"
    assert sent == ["get_config"] * 7


@pytest.mark.parametrize("kind", KINDS)
def test_kick_starts_a_named_refresh_tracked_with_the_session(settings, kind, monkeypatch):
    cl = Client(kind, settings)
    ran: list[int] = []

    async def refresh() -> None:
        ran.append(1)

    monkeypatch.setattr(cl.c, "_refresh", refresh)

    async def main() -> tuple[str, bool, bool]:
        cl.c._kick()
        (task,) = list(cl.c._tasks)
        name = task.get_name()
        await task
        await asyncio.sleep(0)
        return name, task in cl.c._tasks, bool(ran)

    name, still, ran_ = asyncio.run(main())
    assert name == ("intercom-refresh" if kind == "service" else "wiskey-background-refresh")
    assert ran_ and not still, "dropped from the session's tasks once done"


@pytest.mark.parametrize("kind", KINDS)
def test_refresh_is_single_flight_and_runs_once_more_for_a_request_meanwhile(settings, kind, monkeypatch):
    cl = Client(kind, settings)
    fetched: list[int] = []
    stored: list[int] = []

    async def overview(call: Any) -> dict[str, Any]:
        fetched.append(1)
        if len(fetched) == 1:
            await cl.c._refresh()  # a second request while the first is in flight: coalesced
            await cl.c._refresh()
        return {"n": len(fetched)}

    async def watch(call: Any, ids: set[str]) -> None:
        return None

    monkeypatch.setattr(intercom_client, "overview", overview)
    monkeypatch.setattr(cl.c, "_store", lambda raw: stored.append(raw["n"]))
    if kind == "service":
        monkeypatch.setattr(cl.c, "_watch", watch)

    async def main() -> None:
        await cl.c._refresh()  # no session: nothing
        cl.c._call = object()
        await cl.c._refresh()

    asyncio.run(main())
    assert fetched == [1, 1] and stored == [1, 2] and cl.c._refreshing is False and cl.c._fault is None


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("error,fails", [
    (IntercomError("rate_limited", "overview"), False),
    (IntercomError("unauthorized", "overview"), True),
    (IntercomError("invalid_response", "overview"), True),
    (TimeoutError(), True),
    (RuntimeError("socket gone"), True),
])
def test_refresh_failure_mapping(settings, kind, error, fails, monkeypatch):
    cl = Client(kind, settings)
    retried: list[Any] = []

    async def overview(call: Any) -> dict[str, Any]:
        raise error

    monkeypatch.setattr(intercom_client, "overview", overview)
    if kind == "service":
        monkeypatch.setattr(cl.c, "_retry_refresh", lambda delay=None: retried.append(delay))

    async def main() -> None:
        cl.c._call = object()
        cl.c._end = asyncio.Event()
        await cl.c._refresh()

    asyncio.run(main())
    assert (cl.c._fault is error) is fails and cl.c._end.is_set() is fails and cl.c._refreshing is False
    if kind == "service":
        assert retried == ([None] if not fails else []), "the service feed schedules one retry after rate_limited"


def test_service_refresh_failure_during_an_announcement_is_deferred(settings, monkeypatch):
    cl = Client("service", settings)
    deferred: list[str] = []

    for error, expect in ((IntercomError("invalid_response", "overview"), ["invalid_response"]), (TimeoutError(), ["timeout"])):
        deferred.clear()

        async def overview(call: Any, error: BaseException = error) -> dict[str, Any]:
            raise error

        monkeypatch.setattr(intercom_client, "overview", overview)
        monkeypatch.setattr(cl.c, "_defer_failure", lambda code: deferred.append(code))

        async def main() -> None:
            cl.c._fault = None
            cl.c._call = object()
            cl.c._tts = {5: "entry-a"}
            await cl.c._refresh()

        asyncio.run(main())
        assert deferred == expect and cl.c._fault is None
    for code in ("unauthorized", "unknown_command"):
        async def overview2(call: Any, code: str = code) -> dict[str, Any]:
            raise IntercomError(code, "overview")

        monkeypatch.setattr(intercom_client, "overview", overview2)
        deferred.clear()

        async def main2() -> None:
            cl.c._fault = None
            cl.c._call = object()
            cl.c._tts = {5: "entry-a"}
            await cl.c._refresh()

        asyncio.run(main2())
        assert deferred == [] and isinstance(cl.c._fault, IntercomError) and cl.c._fault.code == code


# ---------------------------------------------------------------- frames on a scripted Home Assistant WebSocket

SERVICE_START = ["auth", "hikvision_intercom/overview", "subscribe_entities", "hikvision_intercom/subscribe"]
BACKGROUND_START = ["auth", "hikvision_intercom/overview", "hikvision_intercom/subscribe"]


def test_service_frames_on_a_normal_start_and_what_a_shutdown_leaves(feed):
    _app, s, install = feed
    fakes = install(normal)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    assert fakes[0].types() == SERVICE_START
    t0 = time.monotonic()
    intercom_sync.SYNC.shutdown()
    assert time.monotonic() - t0 < 3.0 and not intercom_sync.SYNC.thread.is_alive(), "the stop wakes the loop at once"
    st = intercom_sync.STATE
    assert (st.state, st.last_error, st.connected, st.reconnects) == ("ha_unavailable", "disconnected", False, 1)
    assert len(fakes) == 1 and fakes[0].types() == SERVICE_START, "nothing is sent on the way out"
    assert intercom_sync.SYNC._call is None and intercom_sync.SYNC._tasks == set()


def test_service_frames_after_a_refresh_push(feed):
    _app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "refresh"}}]
        return normal(msg, fake)

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.refreshes >= 2)
    assert fakes[0].types()[:5] == [*SERVICE_START, "hikvision_intercom/overview"]


def test_service_access_revoked_ends_the_session_as_forbidden(feed):
    _app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "access_revoked"}}]
        return normal(msg, fake)

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "forbidden")
    assert intercom_sync.STATE.last_error == "unauthorized" and intercom_sync.SYNC.served(s)[1] is None
    time.sleep(0.3)
    assert len(fakes) == 1 and fakes[0].types() == SERVICE_START, "forbidden waits on the absent ladder (15 s first)"


def test_service_loading_reprobes_on_the_short_backoff(feed):
    _app, s, install = feed

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        return [ha_config(msg, "STARTING")] if msg["type"] == "get_config" else [fail(msg, "unknown_command")]

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: len(fakes) >= 2)
    assert intercom_sync.STATE.state == "connecting" and intercom_sync.STATE.last_error == intercom_sync.LOADING
    assert fakes[0].types() == ["auth", "hikvision_intercom/overview", "get_config"]


def test_background_frames_on_a_normal_start_and_what_a_shutdown_leaves(split):
    _app, s, install, feed_mod = split

    def background(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, restricted_overview())]
        return [ok(msg)]

    conns = install(normal, background)
    feed_mod.FEED.start(s)
    wait_for(lambda: feed_mod.FEED.status["state"] == "ready")
    bg_conn = by_token(conns, "bg-token")
    assert bg_conn.types() == BACKGROUND_START
    assert feed_mod.FEED.status["subscribe"] == "ok" and feed_mod.FEED.status["connected"] is True
    t0 = time.monotonic()
    feed_mod.FEED.shutdown()
    assert time.monotonic() - t0 < 3.0 and not feed_mod.FEED.thread.is_alive(), "the stop wakes the loop at once"
    st = feed_mod.FEED.status
    assert (st["state"], st["last_error"], st["connected"], st["reconnects"], st["subscribe"]) == ("ha_unavailable", "disconnected", False, 1, "ok")
    assert bg_conn.types() == BACKGROUND_START and feed_mod.FEED._call is None and feed_mod.FEED._tasks == set()


def test_background_frames_after_a_refresh_push_and_a_failed_subscribe(split):
    _app, s, install, feed_mod = split
    n = {"overview": 0}

    def background(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            n["overview"] += 1
            return [ok(msg, restricted_overview(revision=n["overview"]))]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "refresh"}}]
        return [ok(msg)]

    conns = install(normal, background)
    feed_mod.FEED.start(s)
    wait_for(lambda: feed_mod.FEED.status["refreshes"] >= 2)
    assert by_token(conns, "bg-token").types()[:4] == [*BACKGROUND_START, "hikvision_intercom/overview"]


def test_background_subscribe_refused_keeps_the_session_and_says_why(split):
    _app, s, install, feed_mod = split

    def background(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, restricted_overview())]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [fail(msg, "unauthorized")]
        return [ok(msg)]

    conns = install(normal, background)
    feed_mod.FEED.start(s)
    wait_for(lambda: feed_mod.FEED.status["state"] == "ready")
    assert feed_mod.FEED.status["subscribe"] == "failed:unauthorized"
    assert by_token(conns, "bg-token").types() == BACKGROUND_START


def test_background_screen_locked_push_is_error_and_reconnects(split):
    _app, s, install, feed_mod = split

    def background(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, restricted_overview())]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "screen_locked"}}]
        return [ok(msg)]

    conns = install(normal, background)
    feed_mod.FEED.start(s)
    wait_for(lambda: len([c for c in conns if c.token == "bg-token"]) >= 2)
    first = by_token(conns, "bg-token")
    assert first.types() == BACKGROUND_START
    wait_for(lambda: feed_mod.FEED.status["reconnects"] >= 1)
    assert feed_mod.FEED.status["last_error"] in ("screen_locked", None), "error between sessions, cleared once ready again"


def test_background_not_installed_and_loading(split):
    _app, s, install, feed_mod = split
    ha = {"state": "STARTING"}

    def background(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        if msg["type"] == "get_config":
            return [ha_config(msg, ha["state"])]
        return [fail(msg, "unknown_command")]

    conns = install(normal, background)
    feed_mod.FEED.start(s)
    wait_for(lambda: len(conns) >= 2)
    assert feed_mod.FEED.status["state"] == "connecting" and feed_mod.FEED.status["last_error"] == intercom_sync.LOADING
    assert conns[0].types() == ["auth", "hikvision_intercom/overview", "get_config"]
    assert feed_mod.FEED.status["subscribe"] == "not_attempted"
    ha["state"] = "RUNNING"
    wait_for(lambda: feed_mod.FEED.status["state"] == "not_installed")
    assert feed_mod.FEED.status["last_error"] == "unknown_command"
