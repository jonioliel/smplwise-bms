"""W-016 (ASGI-295): the WisKey media path qualified through the FULL application - not the isolated `_pump` test.

What runs for real (Arx code, unchanged):
- `smplwise.main.create_app` with its whole router set, its middlewares (CommitBeforeSend, body limits, the remote channel) and its
  startup / shutdown handlers, driven through the ASGI lifespan protocol on the test's OWN event loop (so `asyncio.all_tasks()` before
  startup and after shutdown are comparable);
- every HTTP route through `httpx.ASGITransport`, every WebSocket route through a minimal in-process ASGI WebSocket driver (below);
- `routers/intercom_media.py` (media, live/ws, talk, talk/ws, stop) and `routers/intercom_listen.py`, the WisKey feed thread
  (`intercom_sync`), the provider selection (`access.station_media_provider = auto`), `bridge_provider` building the production
  `WiskeyBridgeProvider` on the production `AutoTransport(DirectApiTransport(websocket_opener), SignedBridgeTransport(ha_connector))`,
  the signing key read from the settings database (`_CachedKey` -> `ha_bridge.signing_key`), the `TalkPump`, `ReceiveDownlink.for_talk`,
  the WKLIVE / F01 lease registry with its timers, and `relay_ws` (the live relay);
- rbac, the bindings API (grant / revoke), revocation and the camera-lease re-check.

What is a FAKE (explicit, nothing else):
- `websockets.connect` - one dispatcher: Home Assistant's socket -> test_intercom's scripted `FakeHa` (the WisKey feed); WisKey's direct
  API socket -> `w10_fake_direct.FakeDirectServer` over `w10_fake_station.FakeStation` (here a station that also offers its sound,
  `arx.station_talk_audio.v1`); go2rtc's media socket -> `FakeGo2rtcSocket` (scripted MSE frames). Any other address is refused and recorded;
- httpx (sync and async transports) - go2rtc's HTTP API -> `FakeGo2rtc` (registrations, strict deletes with a settable status); any other
  host is refused and recorded;
- `socket.getaddrinfo` - refused and recorded (no name lookup leaves the process).

Nothing here contacts a network, a station, WisKey, Home Assistant or a real go2rtc; nothing is installed or switched on. A pass proves the
Arx side against these fakes on this interpreter only - it says nothing about the real WisKey, go2rtc, the add-on build or a live station.
The runner run that ties this module to the Arx SHA and the WisKey CODE is scripts/gate/asgi_wiskey_run.sh (W-016)."""
from __future__ import annotations

import asyncio
import copy
import gc
import json
import socket
import threading
import time
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest
import websockets
from test_intercom import CAM_OVERVIEW, FakeHa, normal
from test_wkf01f02_295 import ListeningStation
from w10_fake_direct import FakeDirectServer
from w10_fake_station import SCHEMAS, SECRET

from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from smplwise import rbac
from smplwise.db import Database, set_setting
from smplwise.main import create_app
from smplwise.routers import media as media_router
from smplwise.services import go2rtc as g2
from smplwise.services import intercom_listen as il
from smplwise.services import intercom_media as im
from smplwise.services import intercom_sync, leases
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_contract as w10

HA_URL = "http://ha.local:8123"
HA_WS = "ws://ha.local:8123/api/websocket"
CORE_URL = "http://ha-core.test:8123"
DIRECT_WS = "ws://ha-core.test:8123" + bridge.DIRECT_PATH
GO2RTC = "http://go2rtc.test:1984"
GO2RTC_WS = "ws://go2rtc.test:1984/api/ws?src="
STATION = "entry-a"
OTHER = "entry-d"  # another online station of CAM_OVERVIEW
MEDIA = "/api/v1/access-control/stations/{}/media"
LIVE = "/api/v1/access-control/stations/{}/live/ws?profile=main"
TALK = "/api/v1/access-control/stations/{}/talk"
FRAME = bytes(range(160))
PACKET = bytes([0x55]) * 800
SOURCE_SECRETS = ("fixture-pass", "fixture-user", "station-a.invalid", "rtsp://", SECRET)
ADMIN = "joni"  # the developer identity and bootstrap administrator of the conftest settings


# ================================================================ the explicit fakes

class AsgiStation(ListeningStation):
    """The fake WisKey station (W10 v1.1 + `arx.station_talk_audio.v1`) with a settable stream-lease lifetime."""

    def __init__(self) -> None:
        super().__init__()
        self.lease_s = 15.0

    def _stream_lease(self, conn: Any, p: dict[str, Any]) -> dict[str, Any]:
        out = super()._stream_lease(conn, p)
        out["expires_at"] = (self.utcnow() + timedelta(seconds=self.lease_s)).isoformat()
        return out


class FakeGo2rtc:
    """go2rtc's HTTP API as services/go2rtc.py uses it: `/api/frame.jpeg?src=<raw>&name=<n>` registers the name in memory (GetOrPatch),
    `DELETE /api/streams?src=<n>` answers `delete_status` (a 2xx / 404 removes the stream), `GET /api/streams` lists them."""

    def __init__(self) -> None:
        self.streams: dict[str, str] = {}
        self.deletes: list[tuple[str, int]] = []
        self.delete_status = 204
        self.requests: list[str] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        path, params = request.url.path, request.url.params
        self.requests.append(f"{request.method} {path}")
        if request.method == "GET" and path == "/api/frame.jpeg":
            src, name = params.get("src", ""), params.get("name")
            if name:
                self.streams[name] = src
            elif src not in self.streams:
                return httpx.Response(404, text="stream not found")
            return httpx.Response(200, content=b"\xff\xd8\xff\xe0fake-frame\xff\xd9", headers={"Content-Type": "image/jpeg"})
        if request.method == "DELETE" and path == "/api/streams":
            name = params.get("src", "")
            assert name.startswith("smplwise_"), "nothing outside Arx's namespace is ever deleted"
            self.deletes.append((name, self.delete_status))
            if self.delete_status in (200, 204, 404):
                self.streams.pop(name, None)
            return httpx.Response(self.delete_status)
        if request.method == "GET" and path == "/api/streams":
            return httpx.Response(200, json={n: {"producers": []} for n in self.streams})
        if request.method == "GET" and path == "/api":
            return httpx.Response(200, json={"version": "fake"})
        return httpx.Response(404)


class FakeGo2rtcSocket:
    """go2rtc's media WebSocket for one viewer (what `relay_ws` opens): one MSE text frame and two binary segments, then it stays open
    until the relay leaves (its `async with` exits) or `close_all` ends it."""

    def __init__(self, world: "World", url: str) -> None:
        self.world, self.url = world, url
        self.queue: asyncio.Queue[Any] = asyncio.Queue()
        self.sent: list[Any] = []
        self.closed = False

    async def __aenter__(self) -> "FakeGo2rtcSocket":
        self.world.go2rtc_sockets.append(self)
        for item in ('{"type":"mse","value":"video/mp4; codecs=\\"avc1.640029\\""}', b"\x00\x00\x00\x18ftyp-fake", b"\x00\x00\x00\x10moof-fake",
                     '{"type":"error","value":"rtsp://fixture-user:fixture-pass@station-a.invalid refused"}'):
            self.queue.put_nowait(item)
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        self.closed = True
        self.queue.put_nowait(None)
        return False

    def __aiter__(self) -> "FakeGo2rtcSocket":
        return self

    async def __anext__(self) -> Any:
        item = await self.queue.get()
        if item is None:
            raise StopAsyncIteration
        return item

    async def send(self, message: Any) -> None:
        self.sent.append(message)


class World:
    """The fakes and the guards of one test, and the bookkeeping the leak checks read."""

    def __init__(self, settings: Any, monkeypatch: pytest.MonkeyPatch) -> None:
        self.monkeypatch = monkeypatch
        self.station = AsgiStation()
        self.server = FakeDirectServer(self.station)
        self.go2rtc = FakeGo2rtc()
        self.go2rtc_sockets: list[FakeGo2rtcSocket] = []
        self.ha_sockets: list[FakeHa] = []
        self.refused: list[str] = []
        self.direct_opened = 0
        self.overview = copy.deepcopy(CAM_OVERVIEW)
        api = json.loads((__import__("pathlib").Path(__file__).parent / "fixtures" / "wiskey_w10" / "overview_api.json").read_text(encoding="utf-8"))
        api.pop("_note", None)
        self.overview["api"] = api  # WisKey's discovery lists the six W10 commands (served through the real feed)
        self.settings = replace(settings, nvr_host=None, ha_url=HA_URL, ha_token="t", ha_core_url=CORE_URL, go2rtc_url=GO2RTC)

    # -- install every fake and guard
    def install(self) -> None:
        mp = self.monkeypatch
        world = self
        mp.setattr(intercom_sync, "RETRY_S", 0.05)
        mp.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
        mp.delenv(im.FAKE_ENV, raising=False)
        mp.setitem(SCHEMAS["media/talk_open"]["parameters_schema"].setdefault("properties", {}), "listen", {"type": "boolean"})
        mp.setattr(g2, "_REGISTERED", {})
        mp.setattr(leases, "RECHECK_S", 0.3)  # the camera-lease re-check of a talk / a live view (production: 20 s)

        def connect(url: str, **_kw: Any) -> Any:
            if url == HA_WS:
                fake = FakeHa(lambda msg, f: normal(msg, f, world.overview))
                world.ha_sockets.append(fake)
                return fake
            if url == DIRECT_WS:
                world.direct_opened += 1
                return world.server.opener()  # awaited by bridge.websocket_opener on whichever loop opens it
            if url.startswith(GO2RTC_WS):
                return FakeGo2rtcSocket(world, url)
            world.refused.append(f"websocket {url}")
            raise OSError("network refused by the test")

        mp.setattr(websockets, "connect", connect)

        def sync_handle(transport: Any, request: httpx.Request) -> httpx.Response:
            if request.url.host == "go2rtc.test":
                return world.go2rtc.handle(request)
            world.refused.append(f"http {request.method} {request.url.host}")
            raise httpx.ConnectError("network refused by the test", request=request)

        async def async_handle(transport: Any, request: httpx.Request) -> httpx.Response:
            if request.url.host == "go2rtc.test":
                return world.go2rtc.handle(request)
            world.refused.append(f"http-async {request.method} {request.url.host}")
            raise httpx.ConnectError("network refused by the test", request=request)

        mp.setattr(httpx.HTTPTransport, "handle_request", sync_handle)
        mp.setattr(httpx.AsyncHTTPTransport, "handle_async_request", async_handle)
        real_getaddrinfo = socket.getaddrinfo

        def getaddrinfo(host: Any, *args: Any, **kw: Any) -> Any:
            if host in (None, "localhost", "127.0.0.1", "::1"):
                return real_getaddrinfo(host, *args, **kw)
            world.refused.append(f"dns {host}")
            raise socket.gaierror(socket.EAI_NONAME, "name lookup refused by the test")

        mp.setattr(socket, "getaddrinfo", getaddrinfo)
        reset_media_state()

    def teardown(self) -> None:
        intercom_sync.SYNC.shutdown()
        if intercom_sync.SYNC.thread is not None:
            intercom_sync.SYNC.thread.join(timeout=5)
        intercom_sync.SYNC.reset()
        self.go2rtc.delete_status = 204
        if im._bridge is not None:  # a test that left the provider (an unresolved delete): released here, never across tests
            im.shutdown_bridge()
        reset_media_state()


def reset_media_state() -> None:
    im.set_provider(None)
    im._bridge, im._bridge_for = None, None
    with im._LEASE_LOCK:
        rows = list(im._LEASED.values())
        im._LEASED.clear()
    for rec in rows:
        for timer in rec.timers:
            timer.cancel()
    im.MEDIA.reset()
    media_router.REGISTRY.sessions.clear()
    if hasattr(il.LISTEN, "reset"):
        il.LISTEN.reset()


# ================================================================ the ASGI drivers (lifespan, HTTP, WebSocket) on the test's own loop

class Asgi:
    def __init__(self, app: Any) -> None:
        self.app = app
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=("127.0.0.1", 50000)), base_url="http://testserver")
        self._to: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._from: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._task: asyncio.Task[Any] | None = None
        self.sockets: list[Ws] = []

    async def startup(self) -> None:
        self._task = asyncio.get_running_loop().create_task(
            self.app({"type": "lifespan", "asgi": {"version": "3.0", "spec_version": "2.0"}, "state": {}}, self._to.get, self._from.put), name="asgi-lifespan")
        await self._to.put({"type": "lifespan.startup"})
        message = await asyncio.wait_for(self._from.get(), 60)
        assert message["type"] == "lifespan.startup.complete", message

    async def shutdown(self, *, close_sockets: bool = True) -> None:
        """uvicorn's order: open WebSockets are closed (1012) and their handlers finish, then the lifespan shutdown runs."""
        if close_sockets:
            for ws in self.sockets:
                if ws.task is not None and not ws.task.done():
                    await ws.disconnect(1012)
        await self._to.put({"type": "lifespan.shutdown"})
        message = await asyncio.wait_for(self._from.get(), 60)
        assert message["type"] == "lifespan.shutdown.complete", message
        assert self._task is not None
        await asyncio.wait_for(self._task, 10)
        await self.http.aclose()

    async def req(self, method: str, path: str, user: str = ADMIN, **kw: Any) -> httpx.Response:
        return await self.http.request(method, path, headers={"X-SW-Dev-User": user, **kw.pop("headers", {})}, **kw)

    def ws(self, path: str, user: str = ADMIN) -> "Ws":
        ws = Ws(self.app, path, user)
        self.sockets.append(ws)
        return ws


class Ws:
    """A WebSocket client as a server would present it to the app (ASGI 3 `websocket` scope). Every message the app sends is kept with
    the instant it was sent (`events`), so a test can tell what was published before and after a revoke / an expiry."""

    def __init__(self, app: Any, path: str, user: str | None) -> None:
        self.app = app
        route, _, query = path.partition("?")
        headers = [(b"host", b"testserver")]
        if user:
            headers.append((b"x-sw-dev-user", user.encode()))
        self.scope = {"type": "websocket", "asgi": {"version": "3.0", "spec_version": "2.3"}, "http_version": "1.1", "scheme": "ws",
                      "server": ("testserver", 80), "client": ("127.0.0.1", 50001), "root_path": "", "path": route, "raw_path": route.encode(),
                      "query_string": query.encode(), "headers": headers, "subprotocols": [], "state": {}, "extensions": {}}
        self.inbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.outbox: asyncio.Queue[tuple[float, dict[str, Any]]] = asyncio.Queue()
        self.events: list[tuple[float, dict[str, Any]]] = []
        self.task: asyncio.Task[Any] | None = None
        self.close_code: int | None = None

    async def _send(self, message: dict[str, Any]) -> None:
        item = (time.time(), message)
        self.events.append(item)
        await self.outbox.put(item)

    async def connect(self, timeout: float = 15) -> bool:
        await self.inbox.put({"type": "websocket.connect"})
        self.task = asyncio.get_running_loop().create_task(self.app(self.scope, self.inbox.get, self._send), name=f"ws {self.scope['path']}")
        message = await self.next(timeout)
        if message["type"] == "websocket.accept":
            return True
        assert message["type"] == "websocket.close", message
        await asyncio.wait_for(self.task, 10)
        return False

    async def next(self, timeout: float = 10) -> dict[str, Any]:
        getter = asyncio.ensure_future(self.outbox.get())
        waiters: set[asyncio.Future[Any]] = {getter}
        if self.task is not None:
            waiters.add(self.task)
        done, _ = await asyncio.wait(waiters, timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
        if getter in done:
            _at, message = getter.result()
            if message["type"] == "websocket.close":
                self.close_code = message.get("code", 1000)
            return message
        getter.cancel()
        with __import__("contextlib").suppress(asyncio.CancelledError):
            await getter
        if self.task is not None and self.task.done():
            exc = self.task.exception() if not self.task.cancelled() else None
            raise AssertionError(f"the handler ended without a message ({exc!r})")
        raise AssertionError("no message from the app in time")

    async def text(self, timeout: float = 10) -> dict[str, Any]:
        while True:
            message = await self.next(timeout)
            if message["type"] == "websocket.send" and message.get("text") is not None:
                return json.loads(message["text"])
            if message["type"] == "websocket.close":
                raise AssertionError(f"closed {message.get('code')} while a text was expected")

    async def binary(self, timeout: float = 10) -> bytes:
        while True:
            message = await self.next(timeout)
            if message["type"] == "websocket.send" and message.get("bytes") is not None:
                return message["bytes"]
            if message["type"] == "websocket.close":
                raise AssertionError(f"closed {message.get('code')} while a binary message was expected")

    async def closed(self, timeout: float = 10) -> int:
        """Reads until the app closes the socket; returns the close code and waits for the handler to end."""
        while self.close_code is None:
            await self.next(timeout)
        await self.inbox.put({"type": "websocket.disconnect", "code": self.close_code})
        assert self.task is not None
        await asyncio.wait_for(self.task, 10)
        return self.close_code

    async def send_text(self, text: str) -> None:
        await self.inbox.put({"type": "websocket.receive", "text": text})

    async def send_json(self, value: Any) -> None:
        await self.send_text(json.dumps(value))

    async def send_bytes(self, data: bytes) -> None:
        await self.inbox.put({"type": "websocket.receive", "bytes": data})

    async def disconnect(self, code: int = 1000) -> None:
        await self.inbox.put({"type": "websocket.disconnect", "code": code})
        assert self.task is not None
        await asyncio.wait_for(self.task, 15)

    def texts(self) -> list[dict[str, Any]]:
        return [json.loads(m["text"]) for _t, m in self.events if m["type"] == "websocket.send" and m.get("text") is not None]

    def binaries(self) -> list[tuple[float, bytes]]:
        return [(t, m["bytes"]) for t, m in self.events if m["type"] == "websocket.send" and m.get("bytes") is not None]


# ================================================================ helpers

MEDIA_TASK_MARKERS = ("TalkPump", "_pump", "from_browser", "from_station", "upstream", "watch", "DirectLink", "ReceiveDownlink", "relay_ws",
                      "pump_down", "pump_up", "station_live_ws", "talk_ws", "_serve", "_recheck", "WiskeyBridge")


def describe_task(task: asyncio.Task[Any]) -> str:
    coro = task.get_coro()
    return f"{task.get_name()}:{getattr(coro, '__qualname__', type(coro).__name__)}"


def media_tasks(tasks: set[asyncio.Task[Any]]) -> list[str]:
    return sorted(d for d in (describe_task(t) for t in tasks) if any(m in d for m in MEDIA_TASK_MARKERS))


def open_os_sockets() -> int:
    gc.collect()
    count = 0
    for obj in gc.get_objects():
        try:
            if isinstance(obj, socket.socket) and obj.fileno() != -1:
                count += 1
        except Exception:  # noqa: BLE001 - an object half torn down
            continue
    return count


def lease_timers_alive() -> list[threading.Thread]:
    return [t for t in threading.enumerate() if isinstance(t, threading.Timer) and getattr(t, "function", None) is im._on_timer and t.is_alive()]


def bridge_threads_alive() -> list[threading.Thread]:
    return [t for t in threading.enumerate() if t.name == "wiskey-media-bridge" and t.is_alive()]


async def until(predicate: Any, timeout: float = 5.0, what: str = "condition") -> None:
    end = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > end:
            raise AssertionError(f"{what} not reached in time")
        await asyncio.sleep(0.01)


async def settle_tasks(before: set[asyncio.Task[Any]], timeout: float = 3.0) -> set[asyncio.Task[Any]]:
    """The tasks created since `before` that are still not done after `timeout` (cancelled ones get loop turns to finish)."""
    me = asyncio.current_task()
    end = time.monotonic() + timeout
    while True:
        left = {t for t in asyncio.all_tasks() if t not in before and t is not me and not t.done()}
        if not left or time.monotonic() > end:
            return left
        await asyncio.sleep(0.02)


def audit_rows(world: World, action: str) -> list[dict[str, Any]]:
    with Database(world.settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


async def make_user(a: Asgi, username: str) -> None:
    r = await a.req("GET", "/api/v1/me", user=username)
    assert r.status_code == 200, r.text


async def grant(a: Asgi, username: str, role: str, scope_type: str = "installation", scope_id: str = "*", **extra: Any) -> str:
    await make_user(a, username)
    r = await a.req("POST", "/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": f"dev-{username}", "role_id": role,
                                                              "scope_type": scope_type, "scope_id": scope_id, **extra})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def configure(a: Asgi, mode: str = "video_talk", **more: Any) -> None:
    """The administrator's switches, through the settings API: the drawer's media mode and WisKey's signed provider."""
    r = await a.req("PATCH", "/api/v1/settings", json={"access.station_media": mode, "access.station_media_provider": "auto", **more})
    assert r.status_code == 200, r.text


async def wait_feed_ready() -> None:
    await until(lambda: intercom_sync.STATE.state == "ready", 10, "the WisKey feed")


async def start_talk(a: Asgi, user: str = ADMIN, station: str = STATION) -> dict[str, Any]:
    r = await a.req("POST", TALK.format(station), user=user, json={"client_request_id": f"asgi-{user}-{int(time.time() * 1000)}"})
    assert r.status_code == 200, r.text
    return r.json()


async def open_talk(a: Asgi, user: str = ADMIN, station: str = STATION) -> tuple[dict[str, Any], Ws]:
    t = await start_talk(a, user, station)
    ws = a.ws("/" + t["ws_path"], user)
    assert await ws.connect()
    state = await ws.text(15)
    assert state["type"] == "talk/state" and state["value"] == "open", state
    return t, ws


def talk_ref(world: World) -> str:
    refs = list(world.station.talks)
    assert len(refs) == 1, refs
    return refs[0]


def no_secret(*texts: str) -> None:
    for text in texts:
        for secret in SOURCE_SECRETS:
            assert secret not in text, f"a private value reached the client: {secret!r}"


# ================================================================ fixtures

@pytest.fixture()
def world(settings, monkeypatch):
    w = World(settings, monkeypatch)
    w.install()
    yield w
    w.teardown()


@pytest.fixture()
def app(world):
    application = create_app(world.settings)
    with Database(world.settings.db_path).connection() as conn:
        set_setting(conn, "bridge.secret", SECRET)  # the pairing key the signer reads (production: written by the pairing flow)
    return application


def run(coro: Any) -> Any:
    return asyncio.run(coro)


# ================================================================ 1. the full lifecycle: startup, HTTP + WS, downlink, shutdown, no leaks

def test_full_app_lifecycle_media_and_talk_with_downlink_leaves_no_task_socket_thread_or_timer(world, app):
    """One application from startup to shutdown on this loop: the drawer's descriptor, a live view through the real relay, a two-way talk
    (uplink frames + the station's sound) through the production provider on the direct API, then shutdown. Afterwards: no asyncio task
    created since before startup is still pending, no OS socket more than before, no bridge loop thread and no lease timer alive, every
    fake socket closed."""
    async def scenario() -> dict[str, Any]:
        sockets_before = open_os_sockets()
        before = set(asyncio.all_tasks())
        a = Asgi(app)
        await a.startup()
        await wait_feed_ready()
        await configure(a)

        body = (await a.req("GET", MEDIA.format(STATION))).json()
        assert body["state"] == "ready", body
        assert body["video"]["paths"] == {"main": LIVE.format(STATION).lstrip("/")} and body["talk"]["available"] is True
        no_secret(json.dumps(body))
        provider = im._bridge
        assert isinstance(provider, im.WiskeyBridgeProvider), "auto + a signing key + WisKey's discovery: the production provider"
        assert isinstance(provider.media, bridge.AutoTransport) and isinstance(provider.media.direct, bridge.DirectApiTransport)

        live = a.ws(LIVE.format(STATION))
        assert await live.connect()
        assert (await live.text())["type"] == "mse"
        assert await live.binary() and await live.binary()
        assert await live.text() == {"type": "error", "value": "upstream_error"}, "go2rtc's error text (a source) never reaches the viewer"
        assert provider.media.last_kind == "direct_api", "the video connection authenticated on WisKey's direct API"
        [name] = list(im._LEASED)
        assert world.go2rtc.streams.get(name, "").startswith("rtsp://"), "the private source is registered in go2rtc's memory only"
        assert im.MEDIA.viewers(STATION) == 1

        t, talk = await open_talk(a)
        await talk.send_json({"type": "talk/ptt", "value": "down"})
        assert await talk.text() == {"type": "talk/floor", "value": "held"}
        for _ in range(10):  # paced like a microphone (20 ms): the pump keeps one waiting batch only (a burst is dropped by design)
            await talk.send_bytes(FRAME)
            await asyncio.sleep(0.02)
        await until(lambda: len(world.station.frames_sink) >= 10, 5, "uplink frames at WisKey")
        assert set(world.station.frames_sink) == {FRAME}
        ref = talk_ref(world)
        for seq in range(3):
            world.station.emit_audio(ref, seq, bytes([seq + 1]) * 800)
            assert await talk.binary() == bytes([seq + 1]) * 800, "the station's sound reaches the browser in order"
        await talk.send_json({"type": "talk/stop"})
        assert await talk.text() == {"type": "talk/closed", "value": "stopped"}
        assert await talk.closed() == 1000
        assert world.station.by_command(w10.TALK_CLOSE) and not world.station.talks and not world.station.station_talk

        await live.disconnect()
        assert not im._LEASED and name not in world.go2rtc.streams, "the last viewer took the leased stream out of go2rtc"
        mid = media_tasks(await settle_tasks(before, 2.0))
        assert mid == [], f"media tasks still pending after both sessions ended: {mid}"

        await a.shutdown()
        assert im._bridge is None and not bridge_threads_alive(), "shutdown closed the provider and stopped its loop thread"
        leaked = await settle_tasks(before, 3.0)
        return {"leaked": sorted(describe_task(t) for t in leaked), "sockets_before": sockets_before, "talk": t}

    out = run(scenario())
    assert not lease_timers_alive(), "no lease timer outlives the application"
    assert all(dc.sock.closed for dc in world.server.connections), "every direct socket closed"
    assert all(c.closed for c in world.station.conns), "every WisKey connection closed"
    assert all(s.closed for s in world.go2rtc_sockets), "every go2rtc media socket closed"
    assert world.refused == [], f"something tried the network: {world.refused}"
    assert open_os_sockets() <= out["sockets_before"], "no OS socket more than before startup"
    media_left = [d for d in out["leaked"] if any(m in d for m in MEDIA_TASK_MARKERS)]
    assert media_left == [], f"media-path asyncio tasks still pending after shutdown: {media_left}"
    # the application-wide delta (any task, media or not) is pinned by test_the_application_shutdown_leaves_no_asyncio_task


def test_the_application_shutdown_leaves_no_asyncio_task(world, app):
    """`asyncio.all_tasks()` after the lifespan shutdown equals the set before the startup (cancelled tasks get loop turns to finish).
    FINDING ASGI-295-F2 while it fails: `main.py` starts `app.state.backup_task = asyncio.create_task(backup_svc.daily_loop(...))` at
    startup, but `_stop_janitor` cancels only janitor / remote_revalidation / backup_drill_task / bridge_rotation_task /
    fleet_report_task / partner_webhooks_task - the daily backup loop is left pending (not WisKey-specific)."""
    async def scenario() -> list[str]:
        before = set(asyncio.all_tasks())
        a = Asgi(app)
        await a.startup()
        await wait_feed_ready()
        await configure(a)
        await a.req("GET", MEDIA.format(STATION))
        await a.shutdown()
        return sorted(describe_task(t) for t in await settle_tasks(before, 3.0))

    leaked = run(scenario())
    assert leaked == [], f"asyncio tasks created by the application and still pending after its shutdown: {leaked}"


def test_wiskeys_discovery_from_the_real_feed_selects_the_signed_provider(world, app):
    """ASGI-295 F1 (fixed): WisKey lists the six W10 commands in its overview, the feed serves them (as the frozenset
    `intercom_adapter.project_api` makes), the installation chose `auto` and the pairing key signs - the drawer is then served by
    WisKey's signed provider. Every scenario of this module reads the real feed's facts unchanged."""

    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            facts = intercom_sync.SYNC.api_facts(world.settings)
            body = (await a.req("GET", MEDIA.format(STATION))).json()
            return {"facts_type": type((facts or {}).get("commands")).__name__, "listed": w10.listed(facts), "state": body["state"],
                    "reason": body["reason"], "provider": type(im._bridge).__name__ if im._bridge is not None else None}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["listed"][0] is True and out["state"] == "ready" and out["provider"] == "WiskeyBridgeProvider", out
    assert out["facts_type"] == "frozenset", "the real projected type reached the selection"


@pytest.mark.parametrize("container", [list, tuple, set, frozenset])
def test_listed_reads_the_feeds_projected_commands_in_any_collection(container):
    """Unit (F1): `w10.listed` on what `intercom_adapter.project_api` really projects (a frozenset), and the same names in any other
    collection, gives the same answer as a list; a string, a mapping or None stays `commands_unknown`."""
    from smplwise.services import intercom_adapter

    names = ["overview", *w10.VIDEO_COMMANDS, *w10.TALK_COMMANDS]
    projected = intercom_adapter.project_api({"version": 1, "min_client": 1, "commands": names})
    assert isinstance(projected["commands"], frozenset)
    assert w10.listed(projected) == (True, True, None)
    assert w10.listed({**projected, "commands": container(names)}) == w10.listed({**projected, "commands": list(names)}) == (True, True, None)
    video_only = container(["overview", *w10.VIDEO_COMMANDS])
    assert w10.listed({"min_client": 1, "commands": video_only}) == (True, False, None)
    assert w10.listed({"min_client": 1, "commands": container(["overview"])}) == (False, False, "not_listed")
    for bad in ("media/station_descriptor media/stream_lease", {"media/station_descriptor": 1}, None):
        assert w10.listed({"min_client": 1, "commands": bad}) == (False, False, "commands_unknown")


# ================================================================ 2. RBAC per role and the station scope

ROLE_CASES = ["viewer", "kiosk", "operator", "editor", "site_admin", "door_opener", "tickets_view", None]


def expected_for(role: str | None) -> dict[str, Any]:
    perms = set(rbac.ROLES.get(role, [])) if role else set()
    return {"media": 200 if "access.read" in perms else 403,
            "talk": 200 if {"access.read", "access.call"} <= perms else 403,
            "live": "accepted" if {"access.read", "video.live"} <= perms else 4403}


def test_rbac_per_role_on_the_descriptor_the_talk_and_the_live_socket(world, app):
    """Every route of the path, for each built-in role bound installation-wide (and for a user with no binding): what the role catalogue
    (`rbac.ROLES`) grants is exactly what the routes allow."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        seen: dict[str, Any] = {}
        try:
            await wait_feed_ready()
            await configure(a)
            for role in ROLE_CASES:
                user = f"u-{role or 'none'}"
                if role:
                    await grant(a, user, role)
                else:
                    await make_user(a, user)
                media = await a.req("GET", MEDIA.format(STATION), user=user)
                talk = await a.req("POST", TALK.format(STATION), user=user)
                if talk.status_code == 200:
                    stop = await a.req("POST", f"/api/v1/access-control/talk/{talk.json()['session']}/stop", user=user)
                    assert stop.json() == {"stopped": True}
                live = a.ws(LIVE.format(STATION), user)
                accepted = await live.connect()
                if accepted:
                    assert (await live.text())["type"] == "mse"
                    await live.disconnect()
                seen[str(role)] = {"media": media.status_code, "talk": talk.status_code, "live": "accepted" if accepted else live.close_code}
                if media.status_code == 200:
                    body = media.json()
                    perms = set(rbac.ROLES.get(role, []))
                    assert body["talk"]["available"] is ("access.call" in perms), (role, body["talk"])
                    assert body["video"]["allowed"] is ("video.live" in perms), (role, body["video"])
        finally:
            await a.shutdown()
        return seen

    seen = run(scenario())
    assert seen == {str(r): expected_for(r) for r in ROLE_CASES}
    assert world.refused == []


def test_station_scope_and_a_station_deny(world, app, station_scope):  # noqa: F811
    """An operator bound to ONE station reaches that station only (descriptor, talk, live); a station the binding does not cover answers
    like an absent one (404 / 4403); a deny on the station closes it for an installation-wide viewer."""
    async def scenario() -> None:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            await make_user(a, "otto")
            station_scope.bind("dev-otto", "operator", STATION)
            assert (await a.req("GET", MEDIA.format(STATION), user="otto")).json()["state"] == "ready"
            talk = await a.req("POST", TALK.format(STATION), user="otto")
            assert talk.status_code == 200, talk.text
            await a.req("POST", f"/api/v1/access-control/talk/{talk.json()['session']}/stop", user="otto")
            live = a.ws(LIVE.format(STATION), "otto")
            assert await live.connect()
            await live.disconnect()
            assert (await a.req("GET", MEDIA.format(OTHER), user="otto")).status_code == 404
            assert (await a.req("POST", TALK.format(OTHER), user="otto")).status_code == 404
            off_chain = a.ws(LIVE.format(OTHER), "otto")
            assert not await off_chain.connect() and off_chain.close_code == 4403

            await grant(a, "vera", "viewer")
            station_scope.bind("dev-vera", "viewer", STATION, effect="deny")
            assert (await a.req("GET", MEDIA.format(STATION), user="vera")).status_code == 404
            denied = a.ws(LIVE.format(STATION), "vera")
            assert not await denied.connect() and denied.close_code == 4403
            assert (await a.req("GET", MEDIA.format(OTHER), user="vera")).status_code == 200, "the deny is on one station only"
        finally:
            await a.shutdown()

    run(scenario())
    assert world.refused == []


# ================================================================ 3. revoke and expiry while the path awaits

def test_a_revoke_through_the_bindings_api_ends_a_two_way_talk_and_its_station_sound(world, app):
    """The operator talks and hears the station; the administrator revokes the binding (DELETE /access/bindings/{id}) while the pump awaits
    the browser, the station and the watch. The talk ends `access_lost` (4403), WisKey gets its close, the station's sound stops."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            bid = await grant(a, "olga", "operator")
            _t, talk = await open_talk(a, "olga")
            ref = talk_ref(world)
            world.station.emit_audio(ref, 0, PACKET)
            assert await talk.binary() == PACKET
            r = await a.req("DELETE", f"/api/v1/access/bindings/{bid}")
            assert r.status_code == 200, r.text
            revoked_at = time.time()
            seq = 1
            while talk.close_code is None and time.time() - revoked_at < 4:
                if ref in world.station.talks:
                    world.station.emit_audio(ref, seq, PACKET)
                    seq += 1
                await asyncio.sleep(0.05)
            code = await talk.closed()
            after = [t for t, _b in talk.binaries() if t > revoked_at]
            closed_at = next(t for t, m in talk.events if m["type"] == "websocket.close")
            return {"code": code, "after": len(after), "last_after": max(after, default=revoked_at) - revoked_at,
                    "closed_after": closed_at - revoked_at, "texts": talk.texts()}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["code"] == 4403 and {"type": "talk/closed", "value": "access_lost"} in out["texts"]
    assert out["closed_after"] < 2.5, out
    assert out["last_after"] < 1.0, f"the station's sound kept flowing after the revoke: {out}"
    assert world.station.by_command(w10.TALK_CLOSE) and not world.station.talks
    end = json.loads(audit_rows(world, "intercom.talk.end")[-1]["details_json"])
    assert end["outcome"] == "access_lost"


def test_a_revoke_while_the_talk_open_awaits_wiskey_never_publishes_a_packet_and_closes_the_talk(world, app):
    """WisKey answers `talk_open` slowly; the binding is revoked while Arx awaits that answer. Once the talk opens, no packet of the
    station's sound reaches the revoked user, and the opened talk is closed at WisKey.

    FINDING ASGI-295-F3 while it fails: `_pump.from_station` checks `lease.should_stop()` before each packet, but `CameraLease.should_stop`
    only SCHEDULES the re-check when the user's access generation moved and returns the stale `False` until the thread-pool re-check
    answers - so the first packet(s) after a revoke that happened during `talk_open` are still published (observed: 1 of 2)."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            bid = await grant(a, "olga", "operator")
            world.station.delays[w10.TALK_OPEN] = 1.0
            t = await start_talk(a, "olga")
            talk = a.ws("/" + t["ws_path"], "olga")
            assert await talk.connect()
            await until(lambda: world.station.by_command(w10.TALK_OPEN), 5, "talk_open at WisKey")
            r = await a.req("DELETE", f"/api/v1/access/bindings/{bid}")
            assert r.status_code == 200
            revoked_at = time.time()
            await until(lambda: bool(world.station.talks), 5, "the talk opened at WisKey")
            ref = talk_ref(world)
            seq = 0
            while talk.close_code is None and time.time() - revoked_at < 5:
                if ref in world.station.talks:
                    world.station.emit_audio(ref, seq, PACKET)
                    seq += 1
                await asyncio.sleep(0.05)
            code = await talk.closed()
            return {"code": code, "published": len(talk.binaries()), "texts": talk.texts(), "emitted": seq}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["code"] == 4403 and {"type": "talk/closed", "value": "access_lost"} in out["texts"], out
    assert out["published"] == 0, f"the station's sound reached a user whose permission was revoked during talk_open: {out}"
    assert world.station.by_command(w10.TALK_CLOSE) and not world.station.talks, "the talk opened during the revoke was closed at WisKey"


def test_the_lease_confirm_awaits_a_moved_generation_and_fails_closed_on_an_error(monkeypatch):
    """Unit (F3): `CameraLease.confirm` answers on a COMPLETED re-check when the access generation moved; an error of that re-check is
    a lost lease (fail closed); an unchanged, recently checked lease answers without awaiting anything."""
    from smplwise.services import revocation

    answers: list[Any] = []

    class Lease(leases.CameraLease):
        def allowed_now(self) -> bool:
            value = answers.pop(0)
            if isinstance(value, Exception):
                raise value
            return value

    principal = rbac.Principal(user_id="u-confirm", username="u", display_name="u", source="dev")

    async def scenario() -> list[Any]:
        out: list[Any] = []
        lease = Lease(None, principal, "entry-a", "access.call")
        out.append(await lease.confirm())  # nothing moved: no re-check at all
        revocation.changed(["u-confirm"])
        answers.append(True)
        out.append(await lease.confirm())  # moved: re-checked (allowed)
        revocation.changed(["u-confirm"])
        answers.append(False)
        out.append(await lease.confirm())  # moved: re-checked (revoked)
        failing = Lease(None, principal, "entry-a", "access.call")
        revocation.changed(["u-confirm"])
        answers.append(RuntimeError("database is locked"))
        out.append((await failing.confirm(), failing.lost))
        return out

    assert run(scenario()) == [True, True, False, (False, True)]
    assert answers == []


def test_a_binding_that_expires_during_the_talk_ends_it_through_the_lease_recheck(world, app):
    """A binding with `expires_at` a few seconds ahead: nobody revokes it, the lease re-check (leases.RECHECK_S) finds it gone and the talk
    ends `access_lost` while it is open."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            until_iso = (datetime.now(timezone.utc) + timedelta(seconds=6)).isoformat()
            await grant(a, "eli", "operator", expires_at=until_iso)
            _t, talk = await open_talk(a, "eli")
            expires = datetime.fromisoformat(until_iso).timestamp()
            assert time.time() < expires - 1, "the talk opened well before the binding's end"
            code = await talk.closed(12)
            closed_at = next(t for t, m in talk.events if m["type"] == "websocket.close")
            return {"code": code, "late": closed_at - expires, "texts": talk.texts()}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["code"] == 4403 and {"type": "talk/closed", "value": "access_lost"} in out["texts"], out
    assert -0.1 < out["late"] < 2.5, out
    assert not world.station.talks


def test_the_talk_session_expiring_during_await_publishes_nothing_after_its_instant(world, app):
    """The session's own expiry (`expires_at`) arrives while the pump awaits the station's next packet: no packet is published at or after
    that instant (checked with nothing awaited between the check and the send), the socket closes 4408, WisKey gets its close."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            t, talk = await open_talk(a)
            session = im.MEDIA.talk(t["session"])
            assert session is not None
            ref = talk_ref(world)
            expires_at = time.time() + 0.6
            session.expires_at = expires_at
            seq = 0
            while talk.close_code is None and time.time() - expires_at < 3:
                if ref in world.station.talks:
                    world.station.emit_audio(ref, seq, PACKET)
                    seq += 1
                await asyncio.sleep(0.02)
            code = await talk.closed()
            return {"code": code, "late": [round(ts - expires_at, 4) for ts, _b in talk.binaries() if ts >= expires_at],
                    "before": sum(1 for ts, _b in talk.binaries() if ts < expires_at), "texts": talk.texts()}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["code"] == 4408 and {"type": "talk/closed", "value": "expired"} in out["texts"], out
    assert out["late"] == [], f"packets published at or after the session's expiry: {out['late']}"
    assert out["before"] >= 1, "the station's sound did flow before the expiry"
    assert world.station.by_command(w10.TALK_CLOSE) and not world.station.talks
    assert json.loads(audit_rows(world, "intercom.talk.end")[-1]["details_json"])["outcome"] == "expired"


def test_turning_the_setting_off_ends_an_open_talk_and_a_live_view(world, app):
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            _t, talk = await open_talk(a)
            live = a.ws(LIVE.format(STATION))
            assert await live.connect()
            r = await a.req("PATCH", "/api/v1/settings", json={"access.station_media": "off"})
            assert r.status_code == 200
            talk_code = await talk.closed(6)
            live_code = await live.closed(6)
            return {"talk": talk_code, "live": live_code, "texts": talk.texts()}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["talk"] == 4403 and {"type": "talk/closed", "value": "access_lost"} in out["texts"]
    assert out["live"] == 4403
    assert not im._LEASED and not world.station.talks


# ================================================================ 4. cancel and join

def test_a_browser_that_leaves_while_talk_open_awaits_wiskey_ends_the_talk_and_closes_it_at_wiskey(world, app):
    async def scenario() -> list[str]:
        before = set(asyncio.all_tasks())
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            world.station.delays[w10.TALK_OPEN] = 0.8
            t = await start_talk(a)
            talk = a.ws("/" + t["ws_path"])
            assert await talk.connect()
            await until(lambda: world.station.by_command(w10.TALK_OPEN), 5, "talk_open at WisKey")
            await talk.inbox.put({"type": "websocket.disconnect", "code": 1001})  # the browser is gone while Arx awaits WisKey
            await asyncio.wait_for(talk.task, 10)
            assert im.MEDIA.talk(t["session"]) is None
            pending = media_tasks(await settle_tasks(before, 2.0))
        finally:
            await a.shutdown()
        return pending

    pending = run(scenario())
    assert pending == [], f"media tasks left after the talk ended: {pending}"
    assert world.station.by_command(w10.TALK_CLOSE) and not world.station.talks and not world.station.station_talk
    assert json.loads(audit_rows(world, "intercom.talk.end")[-1]["details_json"])["outcome"] == "ended"


def test_a_server_cancel_in_the_middle_of_the_pump_joins_every_subtask_and_releases_the_station(world, app):
    """The server cancels the talk handler while `_pump` awaits (what a server does to a handler it gives up on): the cancellation
    propagates, every pump subtask and the TalkPump are joined, the station is released at WisKey and in Arx, and an end row is written."""
    async def scenario() -> dict[str, Any]:
        before = set(asyncio.all_tasks())
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            t, talk = await open_talk(a)
            await talk.send_json({"type": "talk/ptt", "value": "down"})
            assert await talk.text() == {"type": "talk/floor", "value": "held"}
            await asyncio.sleep(0.2)
            assert talk.task is not None
            talk.task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(talk.task, 10)
            pending = media_tasks(await settle_tasks(before, 2.0))
            busy = im.MEDIA.busy(STATION)
            follow = await a.req("POST", TALK.format(STATION), json={"client_request_id": "asgi-after-cancel-1"})
            if follow.status_code == 200:
                await a.req("POST", f"/api/v1/access-control/talk/{follow.json()['session']}/stop")
            return {"pending": pending, "busy": busy, "follow": follow.status_code, "session": im.MEDIA.talk(t["session"])}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["pending"] == [], f"subtasks left after a cancel: {out['pending']}"
    assert out["session"] is None and out["busy"] is False and out["follow"] == 200, out
    assert not world.station.talks and not world.station.station_talk, "the cancelled talk does not keep the station at WisKey"
    rows = audit_rows(world, "intercom.talk.end")
    assert rows, "the cancelled talk still writes its end row"


def test_one_talker_per_station_and_a_second_talk_after_the_first_joins_cleanly(world, app):
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            await grant(a, "sara", "operator")
            first, talk = await open_talk(a)
            busy = await a.req("POST", TALK.format(STATION), user="sara")
            await talk.send_json({"type": "talk/stop"})
            assert await talk.closed() == 1000
            second, talk2 = await open_talk(a, "sara")
            ref2 = talk_ref(world)
            world.station.emit_audio(ref2, 0, PACKET)
            assert await talk2.binary() == PACKET, "the second talk's station sound starts at sequence 0 on its own connection"
            await talk2.send_json({"type": "talk/stop"})
            assert await talk2.closed() == 1000
            return {"busy": (busy.status_code, busy.json()["code"]), "connections": len(world.server.connections)}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["busy"] == (409, "intercom_talk_busy")
    assert len(world.station.by_command(w10.TALK_OPEN)) == 2 and len(world.station.by_command(w10.TALK_CLOSE)) == 2
    assert not world.station.talks


# ================================================================ 5. the downlink: the station's sound in the talk, listen-only pending

def test_the_station_sound_rides_the_talk_socket_even_while_muted_and_a_malformed_packet_ends_the_talk(world, app):
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            _t, talk = await open_talk(a)
            req = world.station.by_command(w10.TALK_OPEN)[-1].params
            assert req.get("listen") is True, "WisKey offers signed_ws_pcmu_v1: the talk asks for the station's sound"
            ref = talk_ref(world)
            world.station.emit_audio(ref, 0, PACKET)
            assert await talk.binary() == PACKET, "muted (floor never held): the station's sound still plays"
            assert not world.station.frames_sink
            world.station.emit_audio(ref, 1, PACKET, {"codec": "pcma"})
            code = await talk.closed(6)
            return {"code": code, "texts": talk.texts()}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["code"] == 1000 and {"type": "talk/closed", "value": "upstream_closed"} in out["texts"], out
    assert not world.station.talks


def test_listen_only_on_the_signed_provider_stays_pending_and_reaches_no_station(world, app):
    """`access.station_listen = probe`: the drawer may offer listening, but WisKey's listen-only downlink is not contracted - the socket
    closes without one byte of audio and no W10 command beyond the descriptor reaches WisKey (no talk is opened as a listen substitute)."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a, **{"access.station_listen": "probe"})
            cap = (await a.req("GET", f"/api/v1/access-control/stations/{STATION}/listen")).json()
            r = await a.req("POST", f"/api/v1/access-control/stations/{STATION}/listen", json={})
            out: dict[str, Any] = {"cap": cap, "start": r.status_code, "code": None, "bytes": 0}
            if r.status_code == 200:
                ws = a.ws("/" + r.json()["ws_path"])
                if await ws.connect():
                    out["code"] = await ws.closed(8)
                else:
                    out["code"] = ws.close_code
                out["bytes"] = len(ws.binaries())
                out["texts"] = ws.texts()
            return out
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["cap"]["available"] is True and out["start"] == 200, out
    assert out["code"] == 4503 and out["texts"] == [{"type": "listen/closed", "value": "upstream_unavailable"}], out
    assert out["bytes"] == 0, out
    assert not world.station.by_command(w10.TALK_OPEN), "no talk is opened as a listen-only substitute"
    rows = audit_rows(world, "intercom.listen.end")
    assert rows and json.loads(rows[-1]["details_json"])["outcome"] == "upstream_unavailable"


# ================================================================ 6. the lease stream lifecycle (owner / generation / quarantine / timers) across shutdown

def test_two_viewers_renew_one_owned_stream_and_the_last_viewer_retires_it_and_its_timers(world, app):
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            first = a.ws(LIVE.format(STATION))
            assert await first.connect()
            [name] = list(im._LEASED)
            rec = im._LEASED[name]
            assert rec.owner is im._bridge.video and rec.generation == 1 and rec.timer.is_alive()
            second = a.ws(LIVE.format(STATION))
            assert await second.connect()
            assert list(im._LEASED) == [name] and rec.generation == 2, "an unchanged source renews the one registration"
            registrations = [r for r in world.go2rtc.requests if r == "GET /api/frame.jpeg"]
            timers = tuple(rec.timers)
            await first.disconnect()
            kept = name in im._LEASED and name in world.go2rtc.streams
            await second.disconnect()
            return {"kept": kept, "registrations": len(registrations), "timers": timers, "name": name}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["kept"], "a viewer keeps its stream (WKLIVE)"
    assert not im._LEASED and out["name"] not in world.go2rtc.streams and world.go2rtc.deletes == [(out["name"], 204)]
    assert not any(t.is_alive() for t in out["timers"]) and not lease_timers_alive()


def test_an_unconfirmed_delete_is_quarantined_and_the_shutdown_retires_it_once_go2rtc_confirms(world, app):
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        await wait_feed_ready()
        await configure(a)
        live = a.ws(LIVE.format(STATION))
        assert await live.connect()
        [name] = list(im._LEASED)
        world.go2rtc.delete_status = 500
        await live.disconnect()
        rec = im._LEASED.get(name)
        quarantined = rec is not None and rec.quarantined and name in g2._REGISTERED and name in world.go2rtc.streams
        world.go2rtc.delete_status = 204
        await a.shutdown()
        return {"quarantined": quarantined, "name": name}

    out = run(scenario())
    assert out["quarantined"], "an unconfirmed delete keeps the record and the registration"
    assert not im._LEASED and out["name"] not in world.go2rtc.streams
    assert world.go2rtc.deletes == [(out["name"], 500), (out["name"], 204)]
    assert im._bridge is None and not bridge_threads_alive() and not lease_timers_alive()


def test_a_shutdown_with_go2rtc_still_refusing_keeps_the_exact_owner_and_record_and_joins_the_timers(world, app):
    """The documented unresolved case: go2rtc refuses the delete at the viewer's end AND at shutdown. The provider (the exact owner) and
    the quarantined record stay; no timer is left running. The bridge loop thread is NOT stopped in this case (the owner stays) - recorded
    as `bridge_thread_alive`, by design of `VideoChannel.close` (it raises before `runner.stop()`)."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        await wait_feed_ready()
        await configure(a)
        live = a.ws(LIVE.format(STATION))
        assert await live.connect()
        [name] = list(im._LEASED)
        world.go2rtc.delete_status = 500
        await live.disconnect()
        await a.shutdown()
        return {"name": name}

    out = run(scenario())
    rec = im._LEASED.get(out["name"])
    assert rec is not None and rec.quarantined and isinstance(im._bridge, im.WiskeyBridgeProvider) and rec.owner is im._bridge.video
    assert out["name"] in world.go2rtc.streams, "never forgotten while go2rtc may still hold the source"
    assert not lease_timers_alive(), "every timer generation of the owner was cancelled and joined"
    world.go2rtc.delete_status = 204
    assert im.shutdown_bridge() is True and not im._LEASED and not bridge_threads_alive()


def test_a_lease_timer_never_deletes_under_a_viewer_and_the_viewer_end_does(world, app, monkeypatch):
    monkeypatch.setattr(im, "LEASE_GRACE_S", 0.0)

    async def scenario() -> dict[str, Any]:
        world.station.lease_s = 1.0
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            live = a.ws(LIVE.format(STATION))
            assert await live.connect()
            [name] = list(im._LEASED)
            await asyncio.sleep(1.6)  # the lease (1 s) and the grace (0) are over while the viewer watches
            under_viewer = name in im._LEASED and not world.go2rtc.deletes
            await live.disconnect()
            return {"under_viewer": under_viewer, "name": name}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["under_viewer"], "the timer does not delete a watched stream"
    assert world.go2rtc.deletes == [(out["name"], 204)] and not im._LEASED and not lease_timers_alive()


def test_the_provider_is_built_once_per_application_and_not_replaced_by_each_request(world, app):
    """`bridge_provider` keys the provider on (settings, database): every route and lease of one application must reach the SAME
    provider - a rebuild would close the earlier owner and its leased streams under a live viewer."""
    async def scenario() -> dict[str, Any]:
        a = Asgi(app)
        await a.startup()
        try:
            await wait_feed_ready()
            await configure(a)
            await a.req("GET", MEDIA.format(STATION))
            first = im._bridge
            live = a.ws(LIVE.format(STATION))
            assert await live.connect()
            await a.req("GET", MEDIA.format(STATION))
            await asyncio.sleep(0.8)  # the StationLease re-check (leases.RECHECK_S = 0.3) builds the descriptor through provider_for too
            second = im._bridge
            alive = bool(im._LEASED)
            await live.disconnect()
            return {"same": first is second, "alive": alive, "direct": world.direct_opened}
        finally:
            await a.shutdown()

    out = run(scenario())
    assert out["same"] and out["alive"], out
    assert out["direct"] == 1, f"one shared video connection for the whole application, got {out['direct']}"
