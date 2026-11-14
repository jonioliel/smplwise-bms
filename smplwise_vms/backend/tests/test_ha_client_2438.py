"""CR-HA-CLIENT-2438 (code review 2026-11-13, part 04: F12, F07, F08). Mocks only - nothing here talks to a real Home Assistant.

F12: every REST call of services/ha_client.py goes through a kept-alive client (the execute calls keep their own LAT1 pool), the bridge
service calls share one status mapping (`_bridge_post`), and no bridge error carries the answer's body (lead decision L8).
F07: the HA sync loop keeps its stop watcher task and cancels it when the loop ends.
F08: the bridge key rotation worker reads its "busy" flag on the worker thread, not on the event loop."""
from __future__ import annotations

import asyncio
import json
import threading
from dataclasses import replace

import httpx
import pytest

from smplwise.errors import ApiError
from smplwise.services import bridge_rotation, ha_client, ha_sync

REAL_CLIENT = httpx.Client  # the genuine class, captured before any patching
ECHO = "refused: rtsp://admin:pw@10.0.0.9/stream"  # what a refusal text could echo - never in an error


@pytest.fixture()
def s(settings):
    return replace(settings, ha_url="http://ha.local:8123", ha_token="tok")


class Wire:
    """`httpx.Client` replaced by a factory that keeps the pool's own arguments and swaps in a MockTransport; counts the clients built."""

    def __init__(self, monkeypatch, handler) -> None:
        self.handler = handler
        self.built: list[dict] = []
        self.requests: list[httpx.Request] = []

        def factory(**kw):
            self.built.append(dict(kw))

            def record(request: httpx.Request) -> httpx.Response:
                self.requests.append(request)
                return self.handler(request)

            return REAL_CLIENT(**{**kw, "transport": httpx.MockTransport(record)})

        monkeypatch.setattr(ha_client.httpx, "Client", factory)
        ha_client.reset_rest_session()
        ha_client.reset_bridge_session()


def _answer(status: int, text: str | None = None, **kw):
    if text is not None:
        kw["text"] = text
    return lambda request: httpx.Response(status, **kw)


@pytest.fixture(autouse=True)
def _fresh_pools():
    yield
    ha_client.reset_rest_session()
    ha_client.reset_bridge_session()


# ---------------------------------------------------------------- F12 (a): kept-alive clients

def test_reads_and_bridge_posts_share_one_kept_alive_client(s, monkeypatch):
    w = Wire(monkeypatch, _answer(200, json.dumps([])))
    ha_client.get_states(s)
    ha_client.get_state(s, "light.a")
    ha_client.get_config(s)
    ha_client.get_config_item(s, "automation", "x")
    ha_client.call_service(s, "smplwise_bridge", "ping", {})
    w.handler = _answer(200, json=[])
    ha_client.call_bridge_schedule(s, {"op": "list"})
    assert len(w.built) == 1, "one client for all of them"
    kw = w.built[0]
    assert "timeout" not in kw and isinstance(kw["limits"], httpx.Limits) and kw["limits"].max_connections is None
    assert [r.url.path for r in w.requests] == ["/api/states", "/api/states/light.a", "/api/config", "/api/config/automation/config/x",
                                               "/api/services/smplwise_bridge/ping", "/api/services/smplwise_bridge/schedule"]
    assert all(r.headers["authorization"] == "Bearer tok" for r in w.requests)


def test_each_call_keeps_its_own_time_out(s, monkeypatch):
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.extensions["timeout"])
        return httpx.Response(200, json={})

    Wire(monkeypatch, handler)
    ha_client.get_states(s)
    ha_client.get_state(s, "light.a")
    ha_client.get_config(s)
    ha_client.call_bridge_cast_stream(s, {"op": "stop"}, timeout=7.5)
    assert [t["read"] for t in seen] == [20, 10, 8, 7.5]


def test_execute_keeps_its_own_pool(s, monkeypatch):
    w = Wire(monkeypatch, _answer(200, json={"service_response": {"ok": True}}))
    ha_client.get_states(s)
    assert ha_client.call_bridge_execute(s, {"user_id": "ha-1", "domain": "light", "service": "turn_on"}) == {"ok": True}
    ha_client.get_state(s, "light.a")
    ha_client.call_bridge_execute(s, {"user_id": "ha-1", "domain": "light", "service": "turn_off"})
    assert len(w.built) == 2
    assert {b["limits"].max_connections for b in w.built} == {None, 8}  # the REST pool has no cap; LAT1's keeps 8


def test_a_changed_factory_or_base_url_builds_a_new_client(s, monkeypatch):
    w1 = Wire(monkeypatch, _answer(200, json={}))
    ha_client.get_config(s)
    first = ha_client._rest_client(s)
    w2 = Wire(monkeypatch, _answer(200, json={}))
    ha_client.get_config(s)
    assert len(w1.built) == 1 and len(w2.built) == 1 and first.is_closed
    ha_client.get_config(replace(s, ha_url="http://other.local:8123"))
    assert len(w2.built) == 2 and w2.requests[-1].url.host == "other.local"


def test_a_transport_error_of_a_read_leaves_the_pool_alone(s, monkeypatch):
    def down(request):
        raise httpx.ConnectError("no route")

    w = Wire(monkeypatch, down)
    with pytest.raises(ApiError) as e:
        ha_client.get_states(s)
    assert e.value.code == "ha_unavailable" and e.value.details == {"error": "ConnectError"}
    assert ha_client.get_state(s, "light.a") is None
    w.handler = _answer(200, json=[])
    assert ha_client.get_states(s) == [] and len(w.built) == 1


def test_a_transport_error_of_execute_drops_its_pool(s, monkeypatch):
    def down(request):
        raise httpx.ReadTimeout("slow")

    w = Wire(monkeypatch, down)
    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_execute(s, {"user_id": "ha-1", "domain": "light", "service": "turn_on"})
    assert e.value.status == 503 and e.value.code == "ha_unavailable" and e.value.details == {"error": "ReadTimeout"}
    assert len(w.requests) == 1, "sent once, never retried"
    w.handler = _answer(200, json={"service_response": {"ok": True}})
    ha_client.call_bridge_execute(s, {"user_id": "ha-1", "domain": "light", "service": "turn_on"})
    assert len(w.built) == 2, "the pool was dropped: a fresh client"


def test_camera_still_streams_through_the_pool(s, monkeypatch):
    jpeg = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"0" * 10
    w = Wire(monkeypatch, _answer(200, content=jpeg))
    assert ha_client.camera_image(s, "camera.gate") == (jpeg, "image/jpeg")
    assert ha_client.camera_image(s, "camera.gate") == (jpeg, "image/jpeg")
    assert len(w.built) == 1 and w.requests[0].url.path == "/api/camera_proxy/camera.gate"


# ---------------------------------------------------------------- F12 (b) + L8: one status mapping, never the body

def _payload() -> dict:
    return {"user_id": "ha-1", "domain": "light", "service": "turn_on", "op": "x"}


# (function, service path, missing statuses, missing code, extra details of "missing", time-out code or None)
CALLS = [
    (ha_client.call_bridge_execute, "execute", (400,), "bridge_not_installed", {}, None),
    (ha_client.call_bridge_schedule, "schedule", (400, 404), "bridge_too_old", {}, "scheduler_timeout"),
    (ha_client.call_bridge_config_item, "config_item", (400, 404), "bridge_too_old", {}, "config_timeout"),
    (ha_client.call_bridge_cast_stream, "cast_stream", (400, 404), "bridge_outdated", {"required": "0.7.0"}, None),
    (ha_client.call_bridge_stream_source, "stream_source", (400, 404), "bridge_too_old", {}, None),
    (ha_client.call_bridge_set_area, "set_entity_area", (400,), "bridge_not_installed", {}, None),
]
STATUSES = [(400, "Service not found"), (404, "Service smplwise_bridge.x not found"), (400, ECHO), (401, ECHO), (403, ECHO), (409, ECHO),
            (500, ECHO), (502, "bad gateway")]


@pytest.mark.parametrize("fn,service,missing_statuses,missing_code,extra,timeout_code", CALLS, ids=[c[1] for c in CALLS])
@pytest.mark.parametrize("status,text", STATUSES, ids=[f"{st}-{'nf' if 'not found' in t else 'echo'}" for st, t in STATUSES])
def test_status_table(s, monkeypatch, fn, service, missing_statuses, missing_code, extra, timeout_code, status, text):
    w = Wire(monkeypatch, _answer(status, text))
    with pytest.raises(ApiError) as e:
        fn(s, _payload())
    err = e.value
    if status in missing_statuses and "not found" in text.lower():
        assert (err.status, err.code, err.details) == (503, missing_code, {"status": status, **extra})
    elif status in (401, 403):
        assert (err.status, err.code, err.details) == (503, "ha_forbidden", {"status": status})
    else:
        assert (err.status, err.code, err.details, err.retryable) == (503, "bridge_error", {"status": status}, False)
    assert "body" not in err.details and ECHO not in json.dumps(err.details) and "rtsp" not in err.user_message
    assert len(w.requests) == 1
    r = w.requests[0]
    assert str(r.url) == f"http://ha.local:8123/api/services/smplwise_bridge/{service}?return_response"
    assert r.method == "POST" and r.headers["authorization"] == "Bearer tok" and json.loads(r.content) == _payload()


@pytest.mark.parametrize("fn,service,missing_statuses,missing_code,extra,timeout_code", CALLS, ids=[c[1] for c in CALLS])
def test_transport_errors(s, monkeypatch, fn, service, missing_statuses, missing_code, extra, timeout_code):
    def slow(request):
        raise httpx.ReadTimeout("slow")

    def down(request):
        raise httpx.ConnectError("no route")

    Wire(monkeypatch, down)
    with pytest.raises(ApiError) as e:
        fn(s, _payload())
    assert (e.value.status, e.value.code, e.value.details, e.value.retryable) == (503, "ha_unavailable", {"error": "ConnectError"}, True)
    Wire(monkeypatch, slow)
    with pytest.raises(ApiError) as e:
        fn(s, _payload())
    if timeout_code:
        assert (e.value.status, e.value.code, e.value.details) == (504, timeout_code, {"error": "ReadTimeout"})
    else:
        assert (e.value.status, e.value.code, e.value.details) == (503, "ha_unavailable", {"error": "ReadTimeout"})


@pytest.mark.parametrize("fn,service,missing_statuses,missing_code,extra,timeout_code", CALLS, ids=[c[1] for c in CALLS])
def test_nothing_is_sent_without_configuration_or_for_a_local_id(s, monkeypatch, fn, service, missing_statuses, missing_code, extra, timeout_code):
    w = Wire(monkeypatch, _answer(200, json={}))
    with pytest.raises(ApiError) as e:
        fn(replace(s, ha_token=""), _payload())
    assert e.value.code == "ha_not_configured"
    with pytest.raises(ApiError) as e:
        fn(s, {**_payload(), "user_id": "l_someone"})
    assert e.value.code == "service_identity_refused"
    assert w.requests == []


def test_answers_are_read_as_before(s, monkeypatch):
    Wire(monkeypatch, _answer(200, json={"service_response": {"ok": True, "request_id": "r", "context_id": "c", "error": None, "extra": 1}}))
    assert ha_client.call_bridge_execute(s, _payload()) == {"ok": True, "request_id": "r", "context_id": "c", "error": None, "extra": 1}
    assert ha_client.call_bridge_cast_stream(s, _payload()) == {"ok": True, "request_id": "r", "context_id": "c", "error": None}
    assert ha_client.call_bridge_stream_source(s, _payload()) == {"ok": True, "request_id": "r", "error": None}
    Wire(monkeypatch, _answer(200, "not json"))
    assert ha_client.call_bridge_schedule(s, _payload()) == {} and ha_client.call_bridge_set_area(s, _payload()) == {}
    Wire(monkeypatch, _answer(200, json=["a list"]))
    assert ha_client.call_bridge_config_item(s, _payload()) == {}
    Wire(monkeypatch, _answer(200, content=b"x" * (ha_client.STREAM_SOURCE_ANSWER_MAX + 1)))
    with pytest.raises(ApiError) as e:
        ha_client.call_bridge_stream_source(s, _payload())
    assert e.value.code == "bridge_error" and e.value.details == {"reason": "too_large"}


# ---------------------------------------------------------------- F07: the sync loop's stop watcher

def test_sync_loop_cancels_its_stop_watcher(s, monkeypatch):
    sync = ha_sync.HaSync()
    sync.db, sync.settings = object(), s
    monkeypatch.setattr(ha_sync, "publish", lambda *_a, **_k: None)

    async def main() -> tuple[bool, bool]:
        go = asyncio.Event()

        async def session(stop_evt):
            await go.wait()
            raise RuntimeError("the session ended")  # with stop set: the loop breaks at once, before the watcher's next poll

        sync._session = session
        loop_task = asyncio.create_task(sync._loop())
        await asyncio.sleep(0.05)
        watchers = [t for t in asyncio.all_tasks() if t.get_name() == "ha-sync-watch-stop"]
        assert len(watchers) == 1 and not watchers[0].done()
        sync.stop.set()
        go.set()
        await asyncio.wait_for(loop_task, 5)
        await asyncio.sleep(0)
        return watchers[0].cancelled(), any(t.get_name() == "ha-sync-watch-stop" and not t.done() for t in asyncio.all_tasks())

    cancelled, still_pending = asyncio.run(main())
    assert cancelled and not still_pending
    assert ha_sync.STATE.connected is False


# ---------------------------------------------------------------- F08: the rotation worker's busy read

def test_rotation_worker_reads_busy_off_the_event_loop(monkeypatch):
    seen: dict[str, int] = {}

    class Conn:
        pass

    class Db:
        def connection(self, mode="write", **_kw):
            seen["read_thread"] = threading.get_ident()
            seen["mode"] = mode

            class Cm:
                def __enter__(self):
                    return Conn()

                def __exit__(self, *a):
                    return False

            return Cm()

    monkeypatch.setattr(bridge_rotation, "worker_pass", lambda db, settings: seen.setdefault("pass_thread", threading.get_ident()))
    monkeypatch.setattr(bridge_rotation, "active_row", lambda conn: {"id": "r1"})

    async def main() -> int:
        loop_thread = threading.get_ident()
        task = asyncio.create_task(bridge_rotation.worker_loop(Db(), object(), first_delay_s=0))
        for _ in range(500):
            if "read_thread" in seen:
                break
            await asyncio.sleep(0.01)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        return loop_thread

    loop_thread = asyncio.run(main())
    assert seen["mode"] == "read" and seen["read_thread"] != loop_thread and seen["read_thread"] == seen["pass_thread"]
