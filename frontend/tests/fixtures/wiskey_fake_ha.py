"""Fixture backend for tests/evidence-wiskey-actions.spec.ts (T054, CR-005 phase 3) and the fixture part of
tests/evidence-wiskey-events.spec.ts (CR-005 phase 1b activity log): the REAL SMPLWISE backend, whose
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

Control API (SW_WISKEY_CONTROL_PORT, default SW_PORT + 10, 127.0.0.1 only), JSON:
    POST /reset                         stations and modes back to the table above; the sent log is cleared
    POST /station {id, call_state}      set a station's call state and push `refresh`
    POST /mode {unlock}                 how stations/test_unlock answers: "accept" ({accepted: true}, the default) or
                                        "unexpected" (success: true with a result of an unexpected shape) or
                                        "unconfirmed" (WisKey's `release_unconfirmed`: the door may have opened)
    GET  /sent                          every hikvision_intercom/* frame the fake received, in order
    POST /events/add {count}            add `count` access events newer than any other and push `refresh` (WisKey's
                                        EventManager.changed() does the same on every accepted event)
    POST /events/prune {keep}           keep only the newest `keep` events: an older `before` cursor then expires

The event cache starts with EVENT_COUNT deterministic access events (newest first: 08:00 Asia/Jerusalem on 2026-09-27,
then every 7 minutes back), answered by `events/list` with WisKey's own EventCache.query semantics (events.py): exact
station / result / authentication / door, casefolded `person` substring over "<employee_no> <person_name>", start /
end bounds, `limit` 1-200, `before` = the previous page's last id (an unknown id is `invalid_fields`, "Event cursor
expired"), and `next` = the page's last id only while more rows match. Rows carry WisKey's full row (masked card,
portrait, evidence, major / minor), so the SMPLWISE projection is exercised too.
"""
from __future__ import annotations

import asyncio
import copy
import datetime
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

import websockets  # noqa: E402

ZONE = {"kind": "iana", "name": "Asia/Jerusalem"}
VERSION = "4.2.0-fake"


def station(sid: str, name: str, call_state: str, locks: list[dict[str, Any]], online: bool = True) -> dict[str, Any]:
    return {
        "id": sid, "name": name, "online": online, "call_state": call_state if online else "unavailable", "sync_state": "synced" if online else "offline",
        "lock_enabled": bool(locks), "integrated_locks": locks, "last_error": None, "last_seen": "2026-09-27T08:00:00+03:00",
        "pending_user_count": 0, "managed_user_count": 12, "clock": {"zone": ZONE},
        "entities": {"online": f"binary_sensor.{sid}_online", "call_status": f"sensor.{sid}_call_status"},
        "last_access": {"timestamp": "2026-09-27T07:59:00+03:00", "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1} if online else None,
    }


def initial_stations() -> list[dict[str, Any]]:
    return [
        station("gate", "שער ראשי", "ringing", [{"physical_index": 1, "api_id": 1, "name": "שער"}]),
        station("lobby", "לובי", "idle", [{"physical_index": 1, "api_id": 1, "name": "כניסה"}, {"physical_index": 2, "api_id": 7, "name": "מחסום"}]),
        station("office", "משרד", "in_call", [{"physical_index": 1, "api_id": 1, "name": None}]),
        station("store", "מחסן", "idle", [{"physical_index": 1, "api_id": 1, "name": None}], online=False),
    ]


TTS_ENGINES = {"default": "tts.piper", "engines": [
    {"engine_id": "tts.piper", "name": "Piper (local)", "supported_languages": ["en", "he"], "default_language": "he"},
    {"engine_id": "tts.google_translate_en_com", "name": "Google Translate", "supported_languages": ["en", "iw"], "default_language": "en"},
]}


EVENT_COUNT = 130  # more than one 100-row page, so "load more" has a second page
EVENT_BASE = datetime.datetime(2026, 9, 27, 8, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3)))
EVENT_STATIONS = ("gate", "lobby", "office", "store")
EVENT_PEOPLE = (("Dana Cohen", "1001"), ("Yossi Levi", "1017"), (None, "2044"), ("Maya Katz", "1033"), (None, None))


def access_event(n: int, when: datetime.datetime) -> dict[str, Any]:
    """Event number `n` (0 = the first generated, older numbers are older in time for the initial set). Every 5th is
    denied, every 11th has an unknown result and method; the rest are granted, card and PIN alternating."""
    name, employee = EVENT_PEOPLE[n % len(EVENT_PEOPLE)]
    result = "unknown" if n % 11 == 0 else "denied" if n % 5 == 0 else "granted"
    auth = "unknown" if result == "unknown" else "pin" if n % 2 else "card"
    station_id = EVENT_STATIONS[n % len(EVENT_STATIONS)]
    iso = when.isoformat()
    return {
        "id": f"ev-{n:04d}", "station_id": station_id, "timestamp": iso, "received_at": when.astimezone(datetime.timezone.utc).isoformat(),
        "time_source": "device", "person_name": name, "employee_no": employee, "door": 2 if station_id == "lobby" and n % 3 == 0 else 1,
        "authentication": auth, "result": result, "event_type": {"granted": "access_granted", "denied": "access_denied"}.get(result, "door_unlocked"),
        "card": "****1234" if auth == "card" else None, "recovered": n % 13 == 0, "major": 5, "minor": 1,
        "portrait": None, "evidence": {"identity_state": "identified" if employee else "no_identity", "origin": "device_event", "arrival_delay_seconds": 0},
        "api_door": 1, "source": "stream",
    }


def initial_events() -> list[dict[str, Any]]:
    return [access_event(i, EVENT_BASE - datetime.timedelta(minutes=7 * i)) for i in range(EVENT_COUNT)]


def _instant(value: Any) -> datetime.datetime | None:
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def query_events(rows: list[dict[str, Any]], filters: dict[str, Any]) -> dict[str, Any] | None:
    """WisKey's EventCache.query (events.py:301-387) for the filters SMPLWISE sends; None = `invalid_fields`."""
    allowed = {"station_id", "person", "result", "authentication", "event_type", "door", "start", "end", "limit", "before"}
    if set(filters) - allowed:
        return None
    limit = filters.get("limit", 100)
    if type(limit) is not int or not 1 <= limit <= 200:
        return None
    start, end = _instant(filters.get("start")), _instant(filters.get("end"))
    if ("start" in filters and start is None) or ("end" in filters and end is None) or (start and end and start >= end):
        return None
    matches = []
    for row in sorted(rows, key=lambda r: (_instant(r["timestamp"]), r["id"]), reverse=True):
        when = _instant(row["timestamp"])
        if when is None or (start and when < start) or (end and when > end):
            continue
        if any(f in filters and row[f] != filters[f] for f in ("station_id", "result", "authentication", "event_type", "door")):
            continue
        if "person" in filters and filters["person"].casefold() not in f"{row['employee_no'] or ''} {row['person_name'] or ''}".casefold():
            continue
        matches.append(row)
    before = filters.get("before")
    if before:
        index = next((i for i, row in enumerate(matches) if row["id"] == before), None)
        if index is None:
            return None  # "Event cursor expired"
        matches = matches[index + 1:]
    page = matches[:limit]
    return {
        "records": copy.deepcopy(page), "next": page[-1]["id"] if len(matches) > limit else None, "retention_days": 30, "capacity": 5000,
        "membership_basis": None, "storage_failed": False, "stations": {sid: {"stream": "connected", "history": "recovered"} for sid in EVENT_STATIONS},
    }


class World:
    """The fake WisKey's state, shared by the fake socket (feed loop thread) and the control server (its own thread)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.reset()
        self.fake: FakeHa | None = None
        self.loop: asyncio.AbstractEventLoop | None = None

    def reset(self) -> None:
        with self.lock:
            self.stations = initial_stations()
            self.unlock_mode = "accept"
            self.sent: list[dict[str, Any]] = []
            self.events = initial_events()
            self.added = 0

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
        WORLD.fake = self

    async def __aenter__(self) -> "FakeHa":
        WORLD.loop = asyncio.get_running_loop()
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
            elif kind == "hikvision_intercom/events/list":
                filters = msg.get("filters")
                page = query_events(WORLD.events, filters) if isinstance(filters, dict) and set(msg) == {"id", "type", "filters"} else None
                self.push(ok(msg, page) if page is not None else fail(msg, "invalid_fields"))
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
        if self.path == "/events/add":
            count = body.get("count")
            if type(count) is not int or not 1 <= count <= 50:
                return self._json(422, {"error": "count must be 1..50"})
            with WORLD.lock:
                newest = max(_instant(r["timestamp"]) for r in WORLD.events) if WORLD.events else EVENT_BASE
                for i in range(count):
                    WORLD.added += 1
                    WORLD.events.append(access_event(1000 + WORLD.added, newest + datetime.timedelta(minutes=i + 1)))
                # WisKey's overview carries each station's last access record: a new access event changes it, which is
                # what makes SMPLWISE's feed relay `intercom_refresh` to browsers (it relays only real changes)
                last = WORLD.events[-1]
                for s in WORLD.stations:
                    if s["id"] == last["station_id"] and s["online"]:
                        s["last_access"] = {k: last[k] for k in ("timestamp", "time_source", "person_name", "employee_no", "authentication", "result", "event_type", "recovered", "door")}
            WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/events/prune":
            keep = body.get("keep")
            if type(keep) is not int or keep < 0:
                return self._json(422, {"error": "keep must be >= 0"})
            with WORLD.lock:
                WORLD.events = sorted(WORLD.events, key=lambda r: (_instant(r["timestamp"]), r["id"]), reverse=True)[:keep]
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
