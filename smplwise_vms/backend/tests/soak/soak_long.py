"""T068 long soak (hours): the real backend in its own process against device fakes, with realistic client load, sampled
every 60 s into a CSV. Opt-in: nothing runs unless SW_SOAK=1. Device-free; everything listens on 127.0.0.1.

    SW_SOAK=1 python tests/soak/soak_long.py --run-dir <dir> --hours 13
    SW_SOAK=1 python tests/soak/soak_long.py --run-dir <dir> --until 2026-11-07T04:50:00Z
    stop early (graceful, within ~10 s, the summary is still written):  touch <dir>/STOP

Processes / actors (the backend is a separate process, so its RSS / CPU / fds are its own and not the load generator's):

- backend: `soak_long_backend.py` - `create_app` + uvicorn (asyncio, h11) on a fresh data directory `<run-dir>/data`,
  with an event-loop lag monitor and `GET /__soak/stats` (see that module);
- fake NVR (from soak_local.py): alertStream with 8 channels of motion bursts (~6 alerts/s) + search + paced download;
  restarted every --nvr-every s (down 15 s);
- fake Home Assistant with many entities (--ha-sensors x 2: motion + power) and state churn (--ha-rate state_changed/s),
  plus the fake WisKey (tests/fake_wiskey.py) answering `hikvision_intercom/*` on the same socket, as the real integration
  does through Home Assistant; restarted every --ha-every s (down 10 s);
- fake go2rtc (Starlette under uvicorn in a thread): `/api`, `/api/streams` GET / PUT / DELETE, `/api/frame.jpeg`, and the
  `/api/ws` media socket (answers the `mse` request, then sends a 16 KB binary chunk every 0.2 s, ~80 KB/s per viewer);
  restarted every --go2rtc-every s (down 10 s: every open live relay is cut, the viewers reconnect);
- clients (real HTTP / WebSocket against the backend's port): --operators operators cycling the screens (health summary,
  cameras, events list / facets / unacked, per-camera timeline, windows, storage, exports, search, intercom overview, HA
  entities, live info) with a 2-6 s think time; an acker (10 s); an exporter (one 10-minute export every 3 min, keeps 3
  finished jobs); --event-sockets event-feed WebSockets that reconnect every 5 min; --viewers live viewers that open a camera's
  live socket for 20-90 s, close it, wait 5-15 s and open the next one (live-session open / close churn).

Sampled every --interval s (60) into <run-dir>/samples.csv (append-only, one fsync'd line per sample): backend RSS /
private / CPU % / threads / fds / Python objects, DB and WAL bytes, loop-lag p50/p95/p99/max, WebSockets open by kind,
live sessions, event subscribers, API latency p50/p95/max of the interval, error counts (5xx, unexpected 4xx, client
exceptions, backend log errors, 'database is locked', write-lock busy errors), feed state, fake counters, host load and
available memory, the harness's own RSS. A summary JSON is written at the end (<run-dir>/summary.json).

Guards (the run shares the test runner with release gates and the nightly): the launcher (scripts/soak/t068_long_soak.sh)
runs everything under nice 19 / ionice idle / taskset / an address-space limit; the harness itself pauses all client load
while the host's available memory is under --pause-mem-mb (resumes above 1.5 x that) and stops the run when the backend's
RSS passes --max-rss-mb (a soft memory cap: the run ends with reason `rss_cap`). A backend that exits on its own ends the
run with reason `backend_exit` (a crash is a finding, it is not restarted). Refuses to run inside the add-on.
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import csv
import datetime as dt
import json
import os
import random
import signal
import socket
import statistics
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]
for p in (str(BACKEND), str(HERE), str(BACKEND / "tests")):
    if p not in sys.path:
        sys.path.insert(0, p)

from soak_local import TZ_OFFSET, FakeHa, FakeNvr, memory  # noqa: E402

CAMERAS = 8
EXPECTED_STATUS = {"export_create": {429, 503, 507}, "live_info": {409, 429}, "intercom_overview": {409, 503}}
CSV_HEADER = [
    "at_utc", "elapsed_s", "paused", "backend_pid", "backend_uptime_s",
    "rss_mb", "private_mb", "cpu_pct", "threads", "fds", "py_objects",
    "db_bytes", "wal_bytes",
    "loop_lag_p50_ms", "loop_lag_p95_ms", "loop_lag_p99_ms", "loop_lag_max_ms",
    "ws_live_open", "ws_events_open", "ws_other_open", "live_sessions", "events_subscribers", "http_inflight",
    "req_n", "api_p50_ms", "api_p95_ms", "api_max_ms", "reads_p95_ms",
    "err_5xx", "err_4xx_unexpected", "err_client", "err_total_cum",
    "log_errors_cum", "log_warnings_cum", "db_locked_cum", "write_lock_busy_cum", "write_lock_max_hold_s",
    "ingest_depth", "ingest_dropped_cum", "nvr_connected", "ha_connected", "intercom_state",
    "live_opened_cum", "live_failed_cum", "live_bytes_cum", "events_ws_connects_cum", "events_ws_msgs_cum",
    "exports_created_cum", "nvr_alerts_sent_cum", "ha_events_sent_cum", "wiskey_frames_cum", "go2rtc_ws_open",
    "fake_restarts_cum", "host_load1", "host_mem_avail_mb", "harness_rss_mb", "stats_ms", "note",
]


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def pct(sorted_vals: list[float], f: float) -> float | None:
    if not sorted_vals:
        return None
    return sorted_vals[min(len(sorted_vals) - 1, int(f * (len(sorted_vals) - 1) + 0.5))]


def ms(v: float | None) -> float | None:
    return None if v is None else round(v * 1000, 1)


def host_stats() -> tuple[float | None, float | None]:
    """(load average 1 min, MemAvailable MB) on Linux; (None, None) elsewhere."""
    try:
        load1 = os.getloadavg()[0]
    except (OSError, AttributeError):
        load1 = None
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return load1, round(int(line.split()[1]) / 1024, 1)
    except OSError:
        pass
    return load1, None


def proc_stats(pid: int) -> dict[str, Any] | None:
    """RSS / threads / fds / CPU seconds of another process, read from /proc (Linux only)."""
    try:
        status = Path(f"/proc/{pid}/status").read_text()
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
        tick = os.sysconf("SC_CLK_TCK")
        rss = next(int(line.split()[1]) for line in status.splitlines() if line.startswith("VmRSS:")) / 1024
        threads = next(int(line.split()[1]) for line in status.splitlines() if line.startswith("Threads:"))
        return {"rss_mb": round(rss, 1), "threads": threads, "fds": len(os.listdir(f"/proc/{pid}/fd")),
                "cpu_s": (int(fields[11]) + int(fields[12])) / tick}
    except (OSError, StopIteration, ValueError, IndexError):
        return None


# ---------------------------------------------------------------- fakes

class FakeHaWiskey(FakeHa):
    """soak_local's fake Home Assistant with many entities, plus the fake WisKey on the same socket (hikvision_intercom/*)."""

    def __init__(self, rate: float, sensors: int) -> None:
        super().__init__(rate=rate, sensors=sensors)
        from fake_wiskey import DOMAIN, PREFIX, FakeWiskey

        self.prefix = PREFIX
        self.domain = DOMAIN
        self.wiskey = FakeWiskey(token="soak-token")
        # the fake keeps every frame for assertions: bounded here, the soak runs for hours
        self.wiskey.received = collections.deque(maxlen=200)  # type: ignore[assignment]
        self.wiskey.answered = collections.deque(maxlen=200)  # type: ignore[assignment]
        self.wiskey_frames = 0
        self._keys = sorted(self.states)

    def _change(self, i: int) -> dict[str, Any]:
        eid = self._keys[i % len(self._keys)]
        old = self.states[eid]
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        new_state = ("on" if old["state"] == "off" else "off") if eid.startswith("binary_sensor.") else str(random.randint(0, 3000))
        new = {**old, "state": new_state, "last_changed": now, "last_updated": now}
        self.states[eid] = new
        return {"entity_id": eid, "old_state": old, "new_state": new}

    async def _handler(self, ws: Any) -> None:
        from websockets.exceptions import ConnectionClosed

        self.connections += 1
        self.open += 1
        subs: dict[int, str] = {}
        pusher: asyncio.Task | None = None
        try:
            await ws.send(json.dumps({"type": "auth_required", "ha_version": "soak"}))
            auth = json.loads(await ws.recv())
            if auth.get("type") != "auth":
                return
            token = auth.get("access_token") or "soak-token"
            await ws.send(json.dumps({"type": "auth_ok", "ha_version": "soak"}))
            pusher = asyncio.create_task(self._push(ws, subs))
            listings = {"config/entity_registry/list": [{"entity_id": e, "area_id": None, "device_id": None, "name": None, "platform": "soak"} for e in self.states],
                        "config/device_registry/list": [], "config/area_registry/list": [{"area_id": "hall", "name": "Hall", "floor_id": None}], "config/floor_registry/list": []}
            async for raw in ws:
                m = json.loads(raw)
                mid, kind = m.get("id"), str(m.get("type") or "")
                if kind.startswith(self.prefix) or kind == "subscribe_entities":
                    try:
                        frames = self.wiskey.respond(m, token if token in self.wiskey.identities else None)
                    except Exception:  # noqa: BLE001 - a fake answer must never kill the socket
                        frames = [{"id": mid, "type": "result", "success": False, "error": {"code": "unknown_error", "message": "soak fake"}}]
                    for f in frames:
                        await ws.send(json.dumps(f))
                    self.wiskey_frames += 1
                    continue
                if kind == "get_config":
                    result: Any = {"version": "soak-2026.11", "state": "RUNNING", "components": [self.domain]}
                elif kind == "get_states":
                    result = list(self.states.values())
                elif kind == "subscribe_events":
                    subs[mid] = m.get("event_type") or "*"
                    result = None
                elif kind == "unsubscribe_events":
                    subs.pop(m.get("subscription"), None)
                    result = None
                elif kind in listings:
                    result = listings[kind]
                else:
                    await ws.send(json.dumps({"id": mid, "type": "result", "success": False, "error": {"code": "unknown_command", "message": kind}}))
                    continue
                await ws.send(json.dumps({"id": mid, "type": "result", "success": True, "result": result}))
        except ConnectionClosed:
            pass
        finally:
            self.open -= 1
            if pusher:
                pusher.cancel()


class FakeGo2rtc:
    """A go2rtc stand-in: stream registry over HTTP and the media WebSocket, under uvicorn in a thread."""

    CHUNK = b"\x00\x00\x00\x18moof" + b"\x00" * (16 * 1024 - 8)

    def __init__(self) -> None:
        self.port = free_port()
        self.streams: dict[str, str] = {}
        self.counters: collections.Counter[str] = collections.Counter()
        self.ws_open = 0
        self.restarts = 0
        self.server: Any = None
        self.thread: threading.Thread | None = None

    def _app(self) -> Any:
        from starlette.applications import Starlette
        from starlette.requests import Request
        from starlette.responses import JSONResponse, Response
        from starlette.routing import Route, WebSocketRoute
        from starlette.websockets import WebSocket

        fake = self

        async def api(_r: Request) -> Response:
            return JSONResponse({"version": "soak-1.9", "config_path": "/soak"})

        async def streams(r: Request) -> Response:
            fake.counters[f"streams_{r.method.lower()}"] += 1
            if r.method == "GET":
                src = r.query_params.get("src")
                listing = {n: {"producers": [{"url": s, "medias": ["video, recvonly, H264"]}], "consumers": []} for n, s in fake.streams.items()}
                if src:
                    return JSONResponse(listing[src]) if src in listing else Response(status_code=404)
                return JSONResponse(listing)
            if r.method == "PUT":
                fake.streams[r.query_params.get("name", "")] = r.query_params.get("src", "")
                return Response(status_code=200)
            if r.method == "DELETE":
                fake.streams.pop(r.query_params.get("src", ""), None)
                return Response(status_code=200)
            return Response(status_code=405)

        async def frame(_r: Request) -> Response:
            return Response(b"\xff\xd8\xff\xe0soak\xff\xd9", media_type="image/jpeg")

        async def media(ws: WebSocket) -> None:
            await ws.accept()
            fake.ws_open += 1
            fake.counters["ws_accepted"] += 1
            try:
                try:
                    first = await asyncio.wait_for(ws.receive_text(), 10)
                except asyncio.TimeoutError:
                    first = ""
                if '"mse"' in first:
                    await ws.send_text(json.dumps({"type": "mse", "value": 'video/mp4; codecs="avc1.640029"'}))
                while True:
                    await ws.send_bytes(fake.CHUNK)
                    fake.counters["chunks"] += 1
                    await asyncio.sleep(0.2)
            except Exception:  # noqa: BLE001 - the relay went away
                pass
            finally:
                fake.ws_open -= 1

        return Starlette(routes=[Route("/api", api), Route("/api/streams", streams, methods=["GET", "PUT", "DELETE"]),
                                 Route("/api/frame.jpeg", frame), WebSocketRoute("/api/ws", media)])

    def start(self) -> None:
        import uvicorn

        config = uvicorn.Config(self._app(), host="127.0.0.1", port=self.port, log_level="error", lifespan="off", ws="auto", loop="asyncio", http="h11")
        self.server = uvicorn.Server(config)
        self.thread = threading.Thread(target=self.server.run, name="soak-fake-go2rtc", daemon=True)
        self.thread.start()
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline and not self.server.started:
            time.sleep(0.05)

    def stop(self) -> None:
        if self.server is not None:
            self.server.should_exit = True
            if self.thread:
                self.thread.join(15)
            self.server = None


# ---------------------------------------------------------------- client-side metrics

class Metrics:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.window: list[tuple[str, float]] = []
        self.win_err: collections.Counter[str] = collections.Counter()
        self.cum: collections.Counter[str] = collections.Counter()
        self.codes: collections.Counter[str] = collections.Counter()  # cumulative "<name> <status>"

    def record(self, name: str, seconds: float, status: int) -> None:
        with self.lock:
            if len(self.window) < 200_000:
                self.window.append((name, seconds))
            self.cum["requests"] += 1
            self.codes[f"{name} {status}"] += 1
            if status in EXPECTED_STATUS.get(name, set()):
                pass  # a documented backpressure / not-configured answer (429 / 503 / 507), not an error
            elif status >= 500:
                self.win_err["5xx"] += 1
                self.cum["5xx"] += 1
            elif status >= 400 and status not in EXPECTED_STATUS.get(name, set()):
                self.win_err["4xx"] += 1
                self.cum["4xx"] += 1

    def client_error(self, name: str, exc: BaseException) -> None:
        with self.lock:
            self.win_err["client"] += 1
            self.cum["client"] += 1
            self.codes[f"{name} {type(exc).__name__}"] += 1

    def bump(self, key: str, n: int = 1) -> None:
        with self.lock:
            self.cum[key] += n

    def take(self) -> dict[str, Any]:
        with self.lock:
            win, self.window = self.window, []
            err, self.win_err = self.win_err, collections.Counter()
        all_s = sorted(s for _, s in win)
        reads = sorted(s for n, s in win if n not in ("export_create", "export_delete", "ack"))
        return {"n": len(all_s), "p50": ms(statistics.median(all_s)) if all_s else None, "p95": ms(pct(all_s, 0.95)), "max": ms(all_s[-1]) if all_s else None,
                "reads_p95": ms(pct(reads, 0.95)), "5xx": err["5xx"], "4xx": err["4xx"], "client": err["client"]}


# ---------------------------------------------------------------- the run

class Soak:
    def __init__(self, a: argparse.Namespace) -> None:
        self.a = a
        self.run_dir = Path(a.run_dir).resolve()
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir = self.run_dir / "data"
        self.stop = threading.Event()
        self.pause = threading.Event()  # set = client load paused (host memory pressure)
        self.metrics = Metrics()
        self.reason = "duration"
        self.notes: list[str] = []
        self.restarts: list[dict[str, Any]] = []
        self.t0 = time.monotonic()
        self.base = ""
        self.backend: subprocess.Popen | None = None
        self.cams: list[str] = []
        self.end_wall = dt.datetime.fromisoformat(a.until.replace("Z", "+00:00")).timestamp() if a.until else None
        self.duration = a.hours * 3600 + a.minutes * 60

    def start_clock(self) -> None:
        """The load phase starts now (after the backend's start-up and the seed); --until stays an absolute end."""
        self.t0 = time.monotonic()
        if self.end_wall is not None:
            self.duration = max(60.0, self.end_wall - time.time())

    def elapsed(self) -> float:
        return time.monotonic() - self.t0

    def note(self, text: str) -> None:
        self.notes.append(f"{round(self.elapsed())}s {text}")
        print(f"[soak-long] {text}", flush=True)

    # -- backend
    def start_backend(self) -> None:
        port = free_port()
        self.base = f"http://127.0.0.1:{port}"
        log = open(self.run_dir / "backend.log", "ab")  # noqa: SIM115 - kept open for the child's lifetime
        argv = [sys.executable, str(HERE / "soak_long_backend.py"), "--port", str(port), "--data-dir", str(self.data_dir),
                "--nvr-port", str(self.nvr.port), "--ha-port", str(self.ha.port), "--go2rtc-port", str(self.g2.port)]
        env = {k: v for k, v in os.environ.items() if not k.startswith("SW_")}
        env["PYTHONUNBUFFERED"] = "1"
        self.backend = subprocess.Popen(argv, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, env=env, cwd=str(BACKEND))
        (self.run_dir / "backend.pid").write_text(str(self.backend.pid))
        import httpx

        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            if self.backend.poll() is not None:
                raise SystemExit(f"soak_long: the backend exited during start-up (rc {self.backend.returncode}); see {self.run_dir / 'backend.log'}")
            try:
                if httpx.get(self.base + "/__soak/stats", timeout=5).status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.5)
        raise SystemExit("soak_long: the backend did not answer within 180 s")

    def seed(self) -> None:
        import httpx

        with self.client() as c:
            for ch in range(1, CAMERAS + 1):
                r = c.post("/api/v1/cameras", json={"channel": ch, "alias": f"soak{ch}"})
                r.raise_for_status()
                self.cams.append(r.json()["id"])
        import sqlite3

        db_files = sorted(self.data_dir.rglob("*.db"), key=lambda p: p.stat().st_size, reverse=True)
        if db_files:  # main_track as in soak_local (the fake NVR's search answers the track it is asked for)
            conn = sqlite3.connect(str(db_files[0]), timeout=30)
            try:
                for i, cam in enumerate(self.cams):
                    conn.execute("UPDATE cameras SET main_track = ? WHERE id = ?", ((i + 1) * 100 + 1, cam))
                conn.commit()
            except sqlite3.Error as exc:
                self.note(f"seed: main_track not set ({type(exc).__name__})")
            finally:
                conn.close()

    # -- clients
    def client(self) -> Any:
        """One keep-alive client per actor. Idle connections expire after 3 s, before uvicorn's 5 s keep-alive timeout closes them
        (otherwise a request sent on a connection the server is closing at that moment fails with RemoteProtocolError - a client
        artefact, not a backend error)."""
        import httpx

        return httpx.Client(base_url=self.base, timeout=60, limits=httpx.Limits(keepalive_expiry=3))

    def http(self, c: Any, method: str, path: str, name: str, **kw: Any) -> Any:
        t = time.perf_counter()
        try:
            r = c.request(method, path, **kw)
        except Exception as exc:  # noqa: BLE001 - counted
            self.metrics.client_error(name, exc)
            return None
        self.metrics.record(name, time.perf_counter() - t, r.status_code)
        return r

    def loop(self, name: str, step: Callable[[int], float | None], first_delay: float = 0.0) -> threading.Thread:
        def run() -> None:
            self.stop.wait(first_delay)
            i = 0
            while not self.stop.is_set():
                if self.pause.is_set():
                    self.stop.wait(5)
                    continue
                try:
                    wait = step(i)
                except Exception as exc:  # noqa: BLE001 - counted, the actor goes on
                    self.metrics.client_error(name, exc)
                    wait = 5.0
                i += 1
                self.stop.wait(wait or 0)
        return threading.Thread(target=run, name=f"soak-{name}", daemon=True)

    def operator(self, k: int) -> Callable[[int], float]:
        c = self.client()
        rnd = random.Random(k)

        def step(i: int) -> float:
            day = dt.datetime.now(TZ_OFFSET).date().isoformat()
            cam = self.cams[rnd.randrange(len(self.cams))]
            screens = [
                [("health_summary", "/api/v1/health/summary"), ("cameras", "/api/v1/cameras")],
                [("events_list", "/api/v1/events?limit=200"), ("events_facets", "/api/v1/events/facets")],
                [("events_unacked", "/api/v1/events?limit=50&unacked=true")],
                [("timeline", f"/api/v1/cameras/{cam}/events?date={day}"), ("windows", "/api/v1/events/windows")],
                [("live_info", f"/api/v1/media/live/{cam}?profile=sub")],
                [("storage_local", "/api/v1/storage/local"), ("exports_list", "/api/v1/exports")],
                [("intercom_overview", "/api/v1/intercom/overview")],
                [("ha_entities", "/api/v1/ha/entities"), ("health", "/api/v1/health")],
                [("me", "/api/v1/me"), ("sites", "/api/v1/sites")],
            ]
            for name, path in screens[rnd.randrange(len(screens))]:
                self.http(c, "GET", path, name)
            return rnd.uniform(2, 6)
        return step

    def acker(self) -> Callable[[int], float]:
        c = self.client()

        def step(i: int) -> float:
            r = self.http(c, "GET", "/api/v1/events?limit=5&unacked=true", "events_unacked")
            evs = r.json().get("events", []) if r is not None and r.status_code == 200 else []
            if evs:
                self.http(c, "POST", f"/api/v1/events/{evs[0]['id']}/ack", "ack")
            return 10.0
        return step

    def exporter(self) -> Callable[[int], float]:
        c = self.client()

        def step(i: int) -> float:
            end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) - dt.timedelta(hours=1)
            start = end - dt.timedelta(minutes=10)
            r = self.http(c, "POST", "/api/v1/exports", "export_create", json={"camera_id": self.cams[i % len(self.cams)], "from_at": start.strftime("%Y-%m-%dT%H:%M:%SZ"), "to_at": end.strftime("%Y-%m-%dT%H:%M:%SZ")})
            if r is not None and r.status_code == 201:
                self.metrics.bump("exports_created")
            r = self.http(c, "GET", "/api/v1/exports", "exports_list")
            jobs = r.json().get("jobs", []) if r is not None and r.status_code == 200 else []
            finished = sorted((j for j in jobs if j.get("state") in ("done", "partial", "failed", "cancelled", "interrupted")), key=lambda j: j.get("created_at") or "")
            for j in finished[: max(0, len(finished) - 3)]:
                self.http(c, "DELETE", f"/api/v1/exports/{j['id']}", "export_delete")
            return 180.0
        return step

    def ws_url(self, path: str) -> str:
        return self.base.replace("http://", "ws://") + path

    def event_socket(self, k: int) -> Callable[[int], float]:
        from websockets.sync.client import connect

        def step(i: int) -> float:
            try:
                with connect(self.ws_url("/api/v1/events/ws"), open_timeout=20, close_timeout=5, max_size=None) as ws:
                    self.metrics.bump("events_ws_connects")
                    until = time.monotonic() + 300
                    while time.monotonic() < until and not self.stop.is_set() and not self.pause.is_set():
                        try:
                            ws.recv(timeout=2)
                            self.metrics.bump("events_ws_msgs")
                        except TimeoutError:
                            continue
            except Exception as exc:  # noqa: BLE001
                self.metrics.client_error("events_ws", exc)
                return 5.0
            return 1.0
        return step

    def viewer(self, k: int) -> Callable[[int], float]:
        from websockets.sync.client import connect

        rnd = random.Random(100 + k)

        def step(i: int) -> float:
            cam = self.cams[(k + i) % len(self.cams)]
            hold = rnd.uniform(20, 90)
            got = 0
            t = time.perf_counter()
            try:
                with connect(self.ws_url(f"/api/v1/media/live/{cam}/ws?profile=sub"), open_timeout=20, close_timeout=5, max_size=None) as ws:
                    ws.send(json.dumps({"type": "mse", "value": "avc1.640029,avc1.64002A,mp4a.40.2"}))
                    until = time.monotonic() + hold
                    first = True
                    while time.monotonic() < until and not self.stop.is_set() and not self.pause.is_set():
                        try:
                            msg = ws.recv(timeout=5)
                        except TimeoutError:
                            continue
                        if first:
                            self.metrics.record("live_first_frame", time.perf_counter() - t, 200)
                            first = False
                        got += len(msg)
                self.metrics.bump("live_opened")
                self.metrics.bump("live_bytes", got)
                if got == 0:
                    self.metrics.bump("live_no_media")
            except Exception as exc:  # noqa: BLE001 - e.g. the relay cut by a go2rtc restart
                self.metrics.bump("live_failed")
                self.metrics.bump("live_bytes", got)
                self.metrics.codes[f"live_ws {type(exc).__name__}"] += 1
            return rnd.uniform(5, 15)
        return step

    # -- device restarts
    def restarter(self) -> None:
        a = self.a
        plan = {"nvr": a.nvr_every, "ha": a.ha_every, "go2rtc": a.go2rtc_every}
        down = {"nvr": 15, "ha": 10, "go2rtc": 10}
        due = dict(plan)
        while not self.stop.is_set():
            t = self.elapsed()
            for what, at in sorted(due.items(), key=lambda kv: kv[1]):
                if plan[what] > 0 and t >= at and t < self.duration - min(120.0, self.duration * 0.25):
                    fake = {"nvr": self.nvr, "ha": self.ha, "go2rtc": self.g2}[what]
                    fake.stop()
                    self.restarts.append({"at_s": round(t, 1), "what": what, "down_s": down[what]})
                    self.stop.wait(down[what])
                    fake.start()
                    if hasattr(fake, "restarts"):
                        fake.restarts += 1
                    due[what] = at + plan[what]
                    break
            self.stop.wait(1)

    # -- sampling
    def fetch_stats(self) -> tuple[dict[str, Any] | None, float]:
        import httpx

        t = time.perf_counter()
        try:
            r = httpx.get(self.base + "/__soak/stats", timeout=45)
            return (r.json() if r.status_code == 200 else None), (time.perf_counter() - t) * 1000
        except (httpx.HTTPError, ValueError):
            return None, (time.perf_counter() - t) * 1000

    def write_row(self, row: dict[str, Any]) -> None:
        path = self.run_dir / "samples.csv"
        new = not path.exists()
        with open(path, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=CSV_HEADER, extrasaction="ignore")
            if new:
                w.writeheader()
            w.writerow(row)
            f.flush()
            os.fsync(f.fileno())

    def sample(self, prev: dict[str, Any]) -> dict[str, Any]:
        st, stats_ms = self.fetch_stats()
        win = self.metrics.take()
        load1, avail = host_stats()
        now_wall = time.monotonic()
        row: dict[str, Any] = {"at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "elapsed_s": round(self.elapsed()),
                               "paused": int(self.pause.is_set()), "backend_pid": self.backend.pid if self.backend else None,
                               "req_n": win["n"], "api_p50_ms": win["p50"], "api_p95_ms": win["p95"], "api_max_ms": win["max"], "reads_p95_ms": win["reads_p95"],
                               "err_5xx": win["5xx"], "err_4xx_unexpected": win["4xx"], "err_client": win["client"],
                               "host_load1": round(load1, 2) if load1 is not None else None, "host_mem_avail_mb": avail,
                               "harness_rss_mb": memory()["rss_mb"], "stats_ms": round(stats_ms, 1)}
        cum = dict(self.metrics.cum)
        row.update({"err_total_cum": cum.get("5xx", 0) + cum.get("4xx", 0) + cum.get("client", 0),
                    "live_opened_cum": cum.get("live_opened", 0), "live_failed_cum": cum.get("live_failed", 0), "live_bytes_cum": cum.get("live_bytes", 0),
                    "events_ws_connects_cum": cum.get("events_ws_connects", 0), "events_ws_msgs_cum": cum.get("events_ws_msgs", 0),
                    "exports_created_cum": cum.get("exports_created", 0), "nvr_alerts_sent_cum": self.nvr.sent["active"] + self.nvr.sent["inactive"],
                    "ha_events_sent_cum": self.ha.sent_events, "wiskey_frames_cum": self.ha.wiskey_frames, "go2rtc_ws_open": self.g2.ws_open,
                    "fake_restarts_cum": len(self.restarts)})
        notes: list[str] = []
        if st is None:
            notes.append("stats_unavailable")
        else:
            lag = st.get("loop_lag") or {}
            wl = st.get("db_write_lock") or {}
            ing = st.get("ingest") or {}
            log = st.get("log") or {}
            ws_open = st.get("ws_open") or {}
            row.update({"backend_uptime_s": st.get("uptime_s"), "rss_mb": st.get("rss_mb"), "private_mb": st.get("private_mb"),
                        "threads": st.get("threads"), "fds": st.get("fds") if st.get("fds") is not None else st.get("handles"), "py_objects": st.get("py_objects"),
                        "db_bytes": st.get("db_bytes"), "wal_bytes": st.get("wal_bytes"),
                        "loop_lag_p50_ms": lag.get("p50_ms"), "loop_lag_p95_ms": lag.get("p95_ms"), "loop_lag_p99_ms": lag.get("p99_ms"), "loop_lag_max_ms": lag.get("max_ms"),
                        "ws_live_open": ws_open.get("live", 0), "ws_events_open": ws_open.get("events", 0), "ws_other_open": ws_open.get("other", 0),
                        "live_sessions": st.get("live_sessions"), "events_subscribers": st.get("events_subscribers"), "http_inflight": st.get("http_inflight"),
                        "log_errors_cum": log.get("errors"), "log_warnings_cum": log.get("warnings"), "db_locked_cum": log.get("database_is_locked"),
                        "write_lock_busy_cum": wl.get("busy_errors"), "write_lock_max_hold_s": wl.get("max_hold_s"),
                        "ingest_depth": ing.get("depth"), "ingest_dropped_cum": ing.get("dropped"),
                        "nvr_connected": int(bool(st.get("nvr_connected"))), "ha_connected": int(bool(st.get("ha_connected"))), "intercom_state": st.get("intercom_state")})
            cpu_s = st.get("cpu_s")
            if self.backend is not None:  # Linux: the process's own numbers from /proc (RSS / threads / fds / CPU of all threads)
                ps = proc_stats(self.backend.pid)
                if ps:
                    row.update({"rss_mb": ps["rss_mb"], "threads": ps["threads"], "fds": ps["fds"]})
                    cpu_s = ps["cpu_s"]
            if cpu_s is not None and prev.get("cpu_s") is not None:
                row["cpu_pct"] = round(100 * (cpu_s - prev["cpu_s"]) / max(1e-6, now_wall - prev["wall"]), 1)
            prev.update(cpu_s=cpu_s, wall=now_wall, last=st)
        for r in [r for r in self.restarts if r["at_s"] > prev.get("restarts_seen", -1)]:
            notes.append(f"restart_{r['what']}")
        if self.restarts:
            prev["restarts_seen"] = self.restarts[-1]["at_s"]
        row["note"] = " ".join(notes + prev.pop("pending_notes", []))
        self.write_row(row)
        return row

    def guard(self, row: dict[str, Any], prev: dict[str, Any]) -> None:
        avail = row.get("host_mem_avail_mb")
        if avail is not None:
            if not self.pause.is_set() and avail < self.a.pause_mem_mb:
                self.pause.set()
                prev.setdefault("pending_notes", []).append("load_paused_host_memory")
                self.note(f"host available memory {avail} MB < {self.a.pause_mem_mb} MB: client load paused")
            elif self.pause.is_set() and avail > self.a.pause_mem_mb * 1.5:
                self.pause.clear()
                prev.setdefault("pending_notes", []).append("load_resumed")
                self.note("host memory back: client load resumed")
        rss = row.get("rss_mb")
        if rss is not None and rss > self.a.max_rss_mb:
            self.reason = "rss_cap"
            self.note(f"backend RSS {rss} MB above the soft cap {self.a.max_rss_mb} MB: stopping")
            self.stop.set()

    # -- main
    def run(self) -> dict[str, Any]:
        a = self.a
        (self.run_dir / "harness.pid").write_text(str(os.getpid()))
        stop_file = self.run_dir / "STOP"
        stop_file.unlink(missing_ok=True)
        self.nvr = FakeNvr()
        self.nvr.start()
        self.ha = FakeHaWiskey(rate=a.ha_rate, sensors=a.ha_sensors)
        self.ha.start()
        self.g2 = FakeGo2rtc()
        self.g2.start()
        self.start_backend()
        self.seed()
        self.start_clock()
        cfg = {k: v for k, v in vars(a).items()}
        cfg.update(duration_s=round(self.duration), backend=self.base, python=sys.version.split()[0], platform=sys.platform,
                   entities=len(self.ha.states), started_utc=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"))
        (self.run_dir / "config.json").write_text(json.dumps(cfg, indent=1, default=str), encoding="utf-8")
        self.note(f"backend {self.base} pid {self.backend.pid if self.backend else None}; {len(self.ha.states)} HA entities; duration {round(self.duration)} s")

        threads = [threading.Thread(target=self.restarter, name="soak-restarter", daemon=True)]
        threads += [self.loop(f"operator{k}", self.operator(k), first_delay=k * 0.7) for k in range(a.operators)]
        threads += [self.loop("acker", self.acker(), 3), self.loop("exporter", self.exporter(), 20)]
        threads += [self.loop(f"events_ws{k}", self.event_socket(k), k) for k in range(a.event_sockets)]
        threads += [self.loop(f"viewer{k}", self.viewer(k), 2 + k * 3) for k in range(a.viewers)]
        for t in threads:
            t.start()

        prev: dict[str, Any] = {}
        st0, _ = self.fetch_stats()
        if st0:
            ps = proc_stats(self.backend.pid) if self.backend else None
            prev.update(cpu_s=ps["cpu_s"] if ps else st0.get("cpu_s"), wall=time.monotonic())
        next_sample = time.monotonic() + a.interval
        first_row = last_row = None
        while not self.stop.is_set():
            self.stop.wait(1)
            if stop_file.exists():
                self.reason = "stop_file"
                self.note("STOP file found: stopping")
                break
            if self.backend is not None and self.backend.poll() is not None:
                self.reason = "backend_exit"
                self.note(f"the backend exited on its own (rc {self.backend.returncode})")
                break
            if self.elapsed() >= self.duration:
                break
            if time.monotonic() >= next_sample:
                next_sample += a.interval
                last_row = self.sample(prev)
                first_row = first_row or last_row
                self.guard(last_row, prev)
                if int(last_row["elapsed_s"]) // 600 != int(last_row["elapsed_s"] - a.interval) // 600:
                    print(f"[soak-long] {last_row['at_utc']} rss {last_row.get('rss_mb')} MB cpu {last_row.get('cpu_pct')}% fds {last_row.get('fds')} "
                          f"lag p99 {last_row.get('loop_lag_p99_ms')} ms api p95 {last_row.get('api_p95_ms')} ms errors {last_row.get('err_total_cum')}", flush=True)
        self.stop.set()
        final_row = self.sample(prev) if self.backend is not None and self.backend.poll() is None else None
        for t in threads:
            t.join(20)
        stuck = [t.name for t in threads if t.is_alive()]
        last_stats = prev.get("last") or {}
        rc = self.stop_backend()
        for fake in (self.g2, self.nvr, self.ha):
            try:
                fake.stop()
            except Exception:  # noqa: BLE001
                pass
        self.ha.close()
        summary = {
            "reason": self.reason, "duration_s": round(self.elapsed()), "planned_s": round(self.duration), "backend_rc": rc,
            "restarts": collections.Counter(r["what"] for r in self.restarts), "client_cumulative": dict(self.metrics.cum),
            "status_codes": dict(self.metrics.codes.most_common(60)), "stuck_client_threads": stuck, "notes": self.notes[-200:],
            "first_row": first_row, "last_row": final_row or last_row,
            "backend_last_stats": {k: last_stats.get(k) for k in ("log", "db_write_lock", "ingest", "events_cache", "export_counters", "thread_names", "ws_total", "http_total")},
            "fakes": {"nvr_sent": dict(self.nvr.sent), "nvr_downloads": dict(self.nvr.downloads), "ha_events_sent": self.ha.sent_events, "ha_connections": self.ha.connections,
                      "wiskey_frames": self.ha.wiskey_frames, "go2rtc": dict(self.g2.counters)},
        }
        (self.run_dir / "summary.json").write_text(json.dumps(summary, indent=1, default=str), encoding="utf-8")
        print(f"[soak-long] done: {self.reason}, {summary['duration_s']} s, backend rc {rc}; summary {self.run_dir / 'summary.json'}", flush=True)
        return summary

    def stop_backend(self) -> int | None:
        if self.backend is None:
            return None
        if self.backend.poll() is None:
            self.backend.terminate()  # SIGTERM: uvicorn shuts the application down (lifespan exit)
            try:
                self.backend.wait(60)
            except subprocess.TimeoutExpired:
                self.backend.kill()
                self.backend.wait(10)
        return self.backend.returncode


def parse(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--run-dir", required=True)
    ap.add_argument("--hours", type=float, default=0.0)
    ap.add_argument("--minutes", type=float, default=0.0)
    ap.add_argument("--until", help="UTC end instant, e.g. 2026-11-07T04:50:00Z (wins over --hours / --minutes)")
    ap.add_argument("--interval", type=float, default=60.0, help="seconds between samples")
    ap.add_argument("--operators", type=int, default=4)
    ap.add_argument("--viewers", type=int, default=4)
    ap.add_argument("--event-sockets", type=int, default=3)
    ap.add_argument("--ha-sensors", type=int, default=300, help="x2 entities (motion + power)")
    ap.add_argument("--ha-rate", type=float, default=20.0, help="state_changed events per second")
    ap.add_argument("--nvr-every", type=float, default=1800)
    ap.add_argument("--ha-every", type=float, default=2700)
    ap.add_argument("--go2rtc-every", type=float, default=3600)
    ap.add_argument("--max-rss-mb", type=float, default=1200.0)
    ap.add_argument("--pause-mem-mb", type=float, default=800.0)
    a = ap.parse_args(argv)
    if not a.until and a.hours <= 0 and a.minutes <= 0:
        ap.error("give --hours, --minutes or --until")
    return a


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("SW_SOAK") != "1":
        raise SystemExit("opt-in soak: set SW_SOAK=1")
    if os.environ.get("SUPERVISOR_TOKEN"):
        raise SystemExit("soak_long: refusing to run inside the Home Assistant add-on")
    soak = Soak(parse(argv))

    def on_term(_sig: int, _frame: Any) -> None:
        soak.reason = "signal"
        soak.stop.set()

    signal.signal(signal.SIGTERM, on_term)
    try:
        signal.signal(signal.SIGINT, on_term)
    except ValueError:
        pass
    try:
        summary = soak.run()
    finally:
        soak.stop.set()
        if soak.backend is not None and soak.backend.poll() is None:
            soak.stop_backend()
    return 0 if summary["reason"] in ("duration", "stop_file", "signal") else 1


if __name__ == "__main__":
    raise SystemExit(main())
