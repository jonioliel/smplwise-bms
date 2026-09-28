"""Fixture backend for tests/evidence-wiskey-actions.spec.ts (T054, CR-005 phase 3): the REAL SMPLWISE backend, whose
Home Assistant WebSocket is an in-process fake that answers like WisKey (`hikvision_intercom/*`). No real Home
Assistant, WisKey or door station can be reached from this process: HA_URL is forced to a `.test` host (a reserved
name that never resolves) and every `websockets.connect` goes to the fake; it refuses to start inside the add-on.

Run it (a fresh data dir each time; the SMPLWISE port and the control port are yours to choose):

    SW_PORT=8347 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/wiskey_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_WISKEY_FIXTURE=1 SW_API_PORT=8347 SW_WISKEY_CONTROL=http://127.0.0.1:8357 \
        SW_BASE_URL=http://127.0.0.1:4187/ npx playwright test tests/evidence-wiskey-actions.spec.ts --project=desktop --workers=1

Fixture WisKey 4.2.0-fake, four stations:
    gate   "שער ראשי"  ringing, 1 lock      lobby "לובי"  idle, 2 locks
    office "משרד"      in a call, 1 lock    store "מחסן"  offline, 1 lock
answer -> in_call, reject / hangUp -> idle, each followed by WisKey's data-free `refresh` push, as the real one does;
a signal that does not match the call state is refused `device_unavailable`, as WisKey's device check does.

Station cameras (the entry center's stills, GET /intercom/stations/{id}/camera-snapshot.jpg, grabbed THROUGH go2rtc):
GO2RTC_URL is forced to a `.test` host whose `/api/frame.jpeg` is answered by an httpx transport hook in this process (no
real go2rtc or station is reached). Each station has a documentation-range host (192.0.2.x, RFC 5737); gate, lobby and
store have a camera, office has none. The fake go2rtc answers a small synthetic JPEG (no real frame) only for a
`smplwise_wiskey_<id>` name whose source is that station's RTSP URL with the account the station accepts: the shared
fixture account (WISKEY_USER / WISKEY_PASSWORD below) for gate and store, `lobby-admin` / `lobby-pass` for lobby - so
lobby's still appears only after a per-station override is set (PUT /api/v1/intercom/stations/lobby/credentials).

Control API (SW_WISKEY_CONTROL_PORT, default SW_PORT + 10, 127.0.0.1 only), JSON:
    POST /reset                         stations and modes back to the table above; the sent log is cleared
    POST /station {id, call_state}      set a station's call state and push `refresh`
    POST /mode {unlock}                 how stations/test_unlock answers: "accept" ({accepted: true}, the default) or
                                        "unexpected" (success: true with a result of an unexpected shape) or
                                        "unconfirmed" (WisKey's `release_unconfirmed`: the door may have opened)
    GET  /sent                          every hikvision_intercom/* frame the fake received, in order
    GET  /frame-hits                    every /api/frame.jpeg request the fake go2rtc got since start (not reset):
                                        {name, host, user, ok}
"""
from __future__ import annotations

import asyncio
import base64
import copy
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("wiskey_fake_ha: refusing to run inside the Home Assistant add-on")

BACKEND = Path(__file__).resolve().parents[3] / "smplwise_vms" / "backend"
sys.path.insert(0, str(BACKEND))
FAKE_HOST = "fake-wiskey.test"
os.environ["HA_URL"] = f"http://{FAKE_HOST}:8123"
os.environ["HA_TOKEN"] = "fake-fixture-token"
FAKE_GO2RTC = "fake-go2rtc.test"
os.environ["GO2RTC_URL"] = f"http://{FAKE_GO2RTC}:1984"
os.environ["WISKEY_USER"] = "fixture-door"
os.environ["WISKEY_PASSWORD"] = "fixture-pass"

import httpx  # noqa: E402
import websockets  # noqa: E402

ZONE = {"kind": "iana", "name": "Asia/Jerusalem"}
VERSION = "4.2.0-fake"


# a 64x36 synthetic picture (flat colours, no camera frame), the body of every good frame.jpeg answer
STILL_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAkAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiqKKK6jhCitvwd/yNVn/wP/0Bq9Rrz8VjfYTUeW+nc66GG9rHmvY8Tor2yvPPiD/yHYP+vVf/AEJqnD4729Tk5bfP/gDrYX2cea9zlqKKK9I4woq5/ZN9/wA8P/H1/wAaP7Jvv+eH/j6/40Gftaf8y+8v+Dv+Rqs/+B/+gNXqNeZ+GrabT9ftrq6Ty4Y9+5sg4ypA4HPU13v9uab/AM/P/jjf4V4eY0qk6qcYt6dvNnp4TEUY02nNLXui/XnnxB/5DsH/AF6r/wChNXaf25pv/Pz/AOON/hXGeMEbVdWinsh5sawBC33edzHvj1FRgKVSNa8otfIrFYmjKnZTX3o5Wirn9k33/PD/AMfX/Gj+yb7/AJ4f+Pr/AI1755Xtaf8AMvvOjooooPECiiigAooooAKKKKAP/9k="
)
HOSTS = {"gate": "192.0.2.21", "lobby": "192.0.2.22", "office": "192.0.2.23", "store": "192.0.2.24"}
ACCOUNTS = {"gate": ("fixture-door", "fixture-pass"), "lobby": ("lobby-admin", "lobby-pass"), "store": ("fixture-door", "fixture-pass")}


def station(sid: str, name: str, call_state: str, locks: list[dict[str, Any]], online: bool = True, camera: bool = True) -> dict[str, Any]:
    return {
        "id": sid, "name": name, "online": online, "call_state": call_state if online else "unavailable", "sync_state": "synced" if online else "offline",
        "lock_enabled": bool(locks), "integrated_locks": locks, "last_error": None, "last_seen": "2026-09-27T08:00:00+03:00",
        "pending_user_count": 0, "managed_user_count": 12, "clock": {"zone": ZONE},
        "host": HOSTS[sid],
        "entities": {"online": f"binary_sensor.{sid}_online", "call_status": f"sensor.{sid}_call_status", **({"camera": f"camera.{sid}"} if camera else {})},
        "last_access": {"timestamp": "2026-09-27T07:59:00+03:00", "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1} if online else None,
    }


def initial_stations() -> list[dict[str, Any]]:
    return [
        station("gate", "שער ראשי", "ringing", [{"physical_index": 1, "api_id": 1, "name": "שער"}]),
        station("lobby", "לובי", "idle", [{"physical_index": 1, "api_id": 1, "name": "כניסה"}, {"physical_index": 2, "api_id": 7, "name": "מחסום"}]),
        station("office", "משרד", "in_call", [{"physical_index": 1, "api_id": 1, "name": None}], camera=False),
        station("store", "מחסן", "idle", [{"physical_index": 1, "api_id": 1, "name": None}], online=False),
    ]


TTS_ENGINES = {"default": "tts.piper", "engines": [
    {"engine_id": "tts.piper", "name": "Piper (local)", "supported_languages": ["en", "he"], "default_language": "he"},
    {"engine_id": "tts.google_translate_en_com", "name": "Google Translate", "supported_languages": ["en", "iw"], "default_language": "en"},
]}


class World:
    """The fake WisKey's state, shared by the fake socket (feed loop thread) and the control server (its own thread)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.reset()
        self.fake: FakeHa | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        # every frame the fake go2rtc was asked for since the fixture started - not cleared by /reset: the backend's
        # still cache outlives a reset, so a spec must be able to see a grab made before it began
        self.frame_hits: list[dict[str, Any]] = []

    def reset(self) -> None:
        with self.lock:
            self.stations = initial_stations()
            self.unlock_mode = "accept"
            self.sent: list[dict[str, Any]] = []

    def push_refresh(self) -> None:
        if self.fake is not None and self.loop is not None:
            self.loop.call_soon_threadsafe(self.fake.refresh)


WORLD = World()


def ok(msg: dict[str, Any], result: Any = None) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": True, "result": result}


def fail(msg: dict[str, Any], code: str) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": False, "error": {"code": code, "message": code}}


class FakeHa:
    """Home Assistant's WebSocket API as `ha_client.ws_session` uses it (auth handshake, then result / event frames)."""

    def __init__(self) -> None:
        self.q: asyncio.Queue = asyncio.Queue()
        self.wiskey_sub: int | None = None

    async def __aenter__(self) -> "FakeHa":
        self.q.put_nowait({"type": "auth_required", "ha_version": "2026.9.0"})
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def recv(self) -> str:
        return json.dumps(await self.q.get())

    def __aiter__(self) -> "FakeHa":
        return self

    async def __anext__(self) -> str:
        return json.dumps(await self.q.get())

    def push(self, frame: dict[str, Any]) -> None:
        self.q.put_nowait(frame)

    def refresh(self) -> None:
        if self.wiskey_sub is not None:
            self.push({"id": self.wiskey_sub, "type": "event", "event": {"kind": "refresh"}})

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        kind = msg.get("type", "")
        if kind == "auth":
            self.push({"type": "auth_ok", "ha_version": "2026.9.0"})
            return
        with WORLD.lock:
            if kind.startswith("hikvision_intercom/"):
                WORLD.sent.append(msg)
            by_id = {s["id"]: s for s in WORLD.stations}
            if kind == "hikvision_intercom/overview":
                self.push(ok(msg, {"version": VERSION, "api": {"version": 1, "min_client": 0}, "default_zone": ZONE, "user_count": 12, "users": [], "stations": copy.deepcopy(WORLD.stations)}))
            elif kind == "hikvision_intercom/subscribe":
                self.wiskey_sub = msg["id"]
                # the control API's pushes go to THIS socket, on its own loop: SMPLWISE's HA sync opens a second socket
                # to the same fake host on another thread, so "the last socket created" was a start-up race
                WORLD.fake, WORLD.loop = self, asyncio.get_running_loop()
                self.push(ok(msg))
            elif kind == "hikvision_intercom/stations/test_unlock":
                if WORLD.unlock_mode == "unconfirmed":
                    self.push(fail(msg, "release_unconfirmed"))
                else:
                    self.push(ok(msg, {"accepted": True} if WORLD.unlock_mode == "accept" else {"queued": "maybe"}))
            elif kind == "hikvision_intercom/media/signal":
                s = by_id.get(msg.get("station_id"))
                want = "ringing" if msg.get("command") in ("answer", "reject") else "in_call"
                if s is None or not s["online"] or s["call_state"] != want:
                    self.push(fail(msg, "device_unavailable"))
                    return
                before = s["call_state"]
                s["call_state"] = "in_call" if msg["command"] == "answer" else "idle"
                self.push(ok(msg, {"command": msg["command"], "acknowledged": True, "physical_result": "unverified", "before_state": before, "observed_state": s["call_state"], "observation": "state_changed", "checked_at": "2026-09-27T08:01:00+00:00"}))
                asyncio.get_running_loop().call_later(0.3, self.refresh)
            elif kind == "hikvision_intercom/tts/engines":
                self.push(ok(msg, copy.deepcopy(TTS_ENGINES)))
            elif kind == "hikvision_intercom/tts/start":
                self.push(ok(msg))
                fmt = {"format": "hikvision_intercom.tts"}
                loop = asyncio.get_running_loop()
                loop.call_later(0.4, self.push, {"id": msg["id"], "type": "event", "event": {**fmt, "state": "generating"}})
                loop.call_later(1.0, self.push, {"id": msg["id"], "type": "event", "event": {**fmt, "state": "speaking", "duration_seconds": 1.5, "packet_count": 15}})
                loop.call_later(2.5, self.push, {"id": msg["id"], "type": "event", "event": {**fmt, "state": "completed", "duration_seconds": 1.5, "bytes_written": 12000, "physical_result": "unverified"}})
            elif kind.startswith("hikvision_intercom/"):
                self.push(fail(msg, "unknown_command"))
            elif kind == "get_config":
                self.push(ok(msg, {"state": "RUNNING", "version": "2026.9.0", "components": []}))
            else:  # HA core commands SMPLWISE's other background services may send (states, registries, subscriptions)
                self.push(ok(msg, []))


def connect(url: str, **_kw: Any) -> FakeHa:
    if FAKE_HOST not in url:
        raise OSError(f"wiskey_fake_ha: refusing a connection to {url}")
    return FakeHa()


websockets.connect = connect  # type: ignore[assignment]

_real_handle = httpx.HTTPTransport.handle_request


def fake_frame(request: httpx.Request) -> httpx.Response:
    """go2rtc's /api/frame.jpeg as SMPLWISE uses it: `src` = the station's RTSP URL, `name` = smplwise_wiskey_<id>."""
    from urllib.parse import unquote, urlsplit

    name = request.url.params.get("name", "")
    src = urlsplit(request.url.params.get("src", ""))
    sid = name.removeprefix("smplwise_wiskey_")
    user, password = unquote(src.username or ""), unquote(src.password or "")
    ok = (
        name.startswith("smplwise_wiskey_") and src.scheme == "rtsp" and src.hostname == HOSTS.get(sid)
        and src.port == 554 and src.path == "/Streaming/Channels/101" and ACCOUNTS.get(sid) == (user, password)
    )
    with WORLD.lock:
        WORLD.frame_hits.append({"name": name, "host": src.hostname, "user": user, "ok": ok})
    if ok:
        return httpx.Response(200, content=STILL_JPEG, headers={"Content-Type": "image/jpeg"}, request=request)
    return httpx.Response(500, text="rtsp: 401 Unauthorized", request=request)  # the station refused the account


def handle_request(self: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
    """The fake go2rtc answers only /api/frame.jpeg; anything else to it, and every REST call to the fake HA host,
    fails as an unresolvable `.test` name would."""
    if request.url.host == FAKE_GO2RTC and request.url.path == "/api/frame.jpeg":
        return fake_frame(request)
    if request.url.host in (FAKE_GO2RTC, FAKE_HOST):
        raise httpx.ConnectError(f"wiskey_fake_ha: no answer for {request.url.host}{request.url.path}", request=request)
    return _real_handle(self, request)


httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]


class Control(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/sent":
            with WORLD.lock:
                return self._json(200, list(WORLD.sent))
        if self.path == "/frame-hits":
            with WORLD.lock:
                return self._json(200, list(WORLD.frame_hits))
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        body = self._body()
        if self.path == "/reset":
            WORLD.reset()
            WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/station":
            with WORLD.lock:
                s = next((x for x in WORLD.stations if x["id"] == body.get("id")), None)
                if s is None:
                    return self._json(404, {"error": "no_such_station"})
                s["call_state"] = str(body.get("call_state"))
            WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/mode":
            if body.get("unlock") not in ("accept", "unexpected", "unconfirmed"):
                return self._json(422, {"error": "unlock must be accept, unexpected or unconfirmed"})
            with WORLD.lock:
                WORLD.unlock_mode = body["unlock"]
            return self._json(200, {"ok": True})
        self._json(404, {"error": "not_found"})

    def log_message(self, *_args: Any) -> None:
        pass


def main() -> None:
    port = int(os.environ.get("SW_WISKEY_CONTROL_PORT") or int(os.environ.get("SW_PORT", "8099")) + 10)
    server = ThreadingHTTPServer(("127.0.0.1", port), Control)
    threading.Thread(target=server.serve_forever, name="wiskey-fixture-control", daemon=True).start()
    print(f"wiskey_fake_ha: WisKey {VERSION} fixture; control API on http://127.0.0.1:{port}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
