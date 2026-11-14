"""Device-free soak (T068): the whole backend in one process against a fake NVR and a fake Home Assistant that restart
on a schedule, with continuous ingest, readers, a WebSocket client, acks, slow-database episodes and exports into a
small pretend disk. Opt-in: nothing runs unless SW_SOAK=1.

    SW_SOAK=1 python tests/soak/soak_local.py --minutes 10 --out <scratch>/soak.json
    SW_SOAK=1 SW_SOAK_MIN=10 SW_SOAK_OUT=<scratch>/soak.json python -m pytest tests/soak/soak_local.py -s -p no:cacheprovider

What runs (all on 127.0.0.1, real sockets, nothing leaves the machine; refuses to run inside the add-on):
- fake NVR (HTTP): `alertStream` (multipart, 8 channels of motion bursts ~6 alerts/s + a heartbeat every 5 s),
  `ContentMgmt/search` (3 files covering the requested window) and `ContentMgmt/download` (the file's bytes, paced);
  restarted every --nvr-every s, down for 10 s and 50 s alternately (the second one longer than the coverage-gap
  threshold, so gap events are recorded);
- fake Home Assistant (WebSocket): auth, config, states, registry listings, `subscribe_events`; pushes ~10
  `state_changed`/s (motion sensors that become HA events, power sensors that only update states); restarted every
  --ha-every s, down 8 s;
- the application itself (TestClient lifespan: alert-stream listener + writer, HA sync, export worker, janitor,
  thumbnail worker with a fake frame grabber), 3 readers cycling the event centre / timeline / windows / health /
  storage endpoints, an acker, a WebSocket client that reconnects every 20 s, a "slow database" that holds the write
  lock for 3 s every 40 s, and an exporter that creates a job every 2 s into a pretend 50 MB data disk
  (storage.min_free_mb = 20) while it alternates between keeping 5 finished jobs (the disk fills: 507s and paused
  jobs) and keeping 1 (room again: automatic resume).

Sampled every 5 s: RSS / private bytes, thread count, handles (Windows) or fds (Linux), TCP connections of the
process by state (every 30 s), Python object count, queue depths. Asserted at the end (after a drain phase and the
application's shutdown): no "database is locked" and no busy errors, no HTTP 500, RSS slope after warm-up under
--rss-slope-mb-h, no thread / handle / socket growth, no product thread alive after shutdown, the ingest queue within
its bound and its counters consistent (accepted = processed + failed + coalesced + dropped + depth; the stored burst
counts add up to every accepted motion alert when nothing was dropped), export counters matching what the client saw
(every 507 counted, pauses and resumes happened, nothing left running), WebSocket subscribers back to zero, both
feeds connected again after their last restart. The JSON report goes to --out; a summary to the console."""
from __future__ import annotations

import argparse
import asyncio
import collections
import ctypes
import datetime as dt
import gc
import json
import logging
import os
import random
import re
import sqlite3
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

MB = 1024 * 1024
TZ_OFFSET = dt.timezone(dt.timedelta(hours=3))
CAMERAS = 8
FILE_BYTES = 2 * MB
PRODUCT_THREADS = ("alertstream", "alertstream-writer", "ha-sync", "intercom-sync", "export-worker", "storage-warm", "event-thumbs")
NUMBERS = re.compile(r"[0-9a-f]{12,}|\d+(\.\d+)?")


# ---------------------------------------------------------------- process metrics

def _win_mem() -> tuple[float, float, int]:
    from ctypes import wintypes

    class PMC(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t), ("PrivateUsage", ctypes.c_size_t)]

    k32 = ctypes.windll.kernel32
    k32.GetCurrentProcess.restype = wintypes.HANDLE
    h = k32.GetCurrentProcess()
    pmc = PMC()
    pmc.cb = ctypes.sizeof(PMC)
    psapi = ctypes.windll.psapi
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PMC), wintypes.DWORD]
    psapi.GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb)
    n = wintypes.DWORD()
    k32.GetProcessHandleCount.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    k32.GetProcessHandleCount(h, ctypes.byref(n))
    return pmc.WorkingSetSize / MB, pmc.PrivateUsage / MB, int(n.value)


def memory() -> dict[str, float]:
    """rss_mb, private_mb, handles (Windows) / fds (Linux)."""
    if sys.platform == "win32":
        rss, private, handles = _win_mem()
        return {"rss_mb": round(rss, 1), "private_mb": round(private, 1), "handles": handles}
    status = Path("/proc/self/status").read_text()
    rss = int(re.search(r"VmRSS:\s+(\d+)", status).group(1)) / 1024
    private = int(re.search(r"RssAnon:\s+(\d+)", status).group(1)) / 1024 if "RssAnon" in status else rss
    return {"rss_mb": round(rss, 1), "private_mb": round(private, 1), "handles": len(os.listdir("/proc/self/fd"))}


def tcp_connections() -> dict[str, int]:
    """TCP connections owned by this process, by state."""
    pid = os.getpid()
    out: collections.Counter[str] = collections.Counter()
    if sys.platform == "win32":
        try:
            text = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True, timeout=30).stdout
        except (OSError, subprocess.TimeoutExpired):
            return {}
        for line in text.splitlines():
            parts = line.split()
            if len(parts) == 5 and parts[0] == "TCP" and parts[4] == str(pid):
                out[parts[3]] += 1
        return dict(out)
    socks = 0
    for fd in os.listdir("/proc/self/fd"):
        try:
            if os.readlink(f"/proc/self/fd/{fd}").startswith("socket:"):
                socks += 1
        except OSError:
            pass
    return {"sockets": socks}


def slope_per_hour(points: list[tuple[float, float]]) -> float:
    """Least-squares slope of (seconds, value) in value per hour."""
    if len(points) < 3:
        return 0.0
    xs = [p[0] / 3600 for p in points]
    ys = [p[1] for p in points]
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    den = sum((x - mx) ** 2 for x in xs)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den if den else 0.0


# ---------------------------------------------------------------- fake NVR

ALERT_DOC = ('<EventNotificationAlert version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema"><channelID>{ch}</channelID>'
             "<dateTime>{ts}</dateTime><activePostCount>1</activePostCount><eventType>{et}</eventType><eventState>{st}</eventState>"
             "<eventDescription>{et} alarm</eventDescription></EventNotificationAlert>")
SEARCH_XML = ('<?xml version="1.0" encoding="UTF-8"?><CMSearchResult><searchID>soak</searchID><responseStatus>true</responseStatus>'
              "<responseStatusStrg>OK</responseStatusStrg><numOfMatches>{n}</numOfMatches><matchList>{items}</matchList></CMSearchResult>")
SEARCH_ITEM = ("<searchMatchItem><trackID>{track}</trackID><timeSpan><startTime>{start}</startTime><endTime>{end}</endTime></timeSpan>"
               "<mediaSegmentDescriptor><contentType>video</contentType><codecType>H.264-BP</codecType>"
               "<playbackURI>rtsp://127.0.0.1:554/Streaming/tracks/{track}/?starttime=x&amp;endtime=y&amp;name=soak{track}_{i}&amp;size={size}</playbackURI>"
               "</mediaSegmentDescriptor><metadataMatches><metadataDescriptor>recordType.meta.hikvision.com/MOTION</metadataDescriptor></metadataMatches></searchMatchItem>")


class FakeNvr:
    def __init__(self) -> None:
        self.port = 0
        self.server: ThreadingHTTPServer | None = None
        self.generation = 0
        self.lock = threading.Lock()
        self.sent = collections.Counter()  # active / inactive / heartbeat documents fully written
        self.streams = 0
        self.downloads = collections.Counter()
        self.restarts = 0

    def start(self) -> None:
        nvr = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_a: Any) -> None:
                return

            def _body(self) -> bytes:
                n = int(self.headers.get("Content-Length") or 0)
                return self.rfile.read(n) if n else b""

            def do_GET(self) -> None:  # noqa: N802
                if self.path.startswith("/ISAPI/Event/notification/alertStream"):
                    return nvr._stream(self)
                if self.path.startswith("/ISAPI/ContentMgmt/download"):
                    return nvr._download(self, self._body())
                self.send_error(404)

            def do_POST(self) -> None:  # noqa: N802
                body = self._body()
                if self.path.startswith("/ISAPI/ContentMgmt/search"):
                    return nvr._search(self, body)
                self.send_error(404)

            def do_PUT(self) -> None:  # noqa: N802
                self.send_error(404)

        with self.lock:
            self.generation += 1
        srv = ThreadingHTTPServer(("127.0.0.1", self.port), Handler)
        srv.daemon_threads = True
        self.port = srv.server_address[1]
        self.server = srv
        threading.Thread(target=srv.serve_forever, kwargs={"poll_interval": 0.2}, name="soak-fake-nvr", daemon=True).start()

    def stop(self) -> None:
        with self.lock:
            self.generation += 1  # every open stream / download notices and closes its connection
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None

    def _alive(self, gen: int) -> bool:
        return gen == self.generation

    def _stream(self, h: BaseHTTPRequestHandler) -> None:
        gen = self.generation
        self.streams += 1
        h.send_response(200)
        h.send_header("Content-Type", "multipart/mixed; boundary=boundary")
        h.send_header("Connection", "close")
        h.end_headers()
        t0 = time.monotonic()
        tick = 0
        try:
            while self._alive(gen):
                now = dt.datetime.now(TZ_OFFSET).replace(microsecond=0).isoformat()
                docs: list[tuple[str, str]] = []
                for ch in range(1, CAMERAS + 1):
                    phase = (tick + ch) % 8  # active for 5 s, inactive, quiet 2 s
                    if phase < 5:
                        docs.append(("active", ALERT_DOC.format(ch=ch, ts=now, et="VMD", st="active")))
                    elif phase == 5:
                        docs.append(("inactive", ALERT_DOC.format(ch=ch, ts=now, et="VMD", st="inactive")))
                if tick % 5 == 0:
                    docs.append(("heartbeat", ALERT_DOC.format(ch=0, ts=now, et="videoloss", st="inactive")))
                for kind, doc in docs:
                    raw = doc.encode()
                    h.wfile.write(b"--boundary\r\nContent-Type: application/xml; charset=\"UTF-8\"\r\nContent-Length: " + str(len(raw)).encode() + b"\r\n\r\n" + raw + b"\r\n")
                    h.wfile.flush()
                    with self.lock:
                        self.sent[kind] += 1
                tick += 1
                delay = t0 + tick - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
        except OSError:
            pass  # the listener went away

    def _search(self, h: BaseHTTPRequestHandler, body: bytes) -> None:
        text = body.decode("utf-8", "ignore")
        track = int(re.search(r"<trackID>(\d+)</trackID>", text).group(1))
        start = re.search(r"<startTime>([^<]+)</startTime>", text).group(1)
        end = re.search(r"<endTime>([^<]+)</endTime>", text).group(1)
        s = dt.datetime.fromisoformat(start.rstrip("Z"))
        e = dt.datetime.fromisoformat(end.rstrip("Z"))
        step = (e - s) / 3
        items = [SEARCH_ITEM.format(track=track, i=i, size=FILE_BYTES, start=(s + step * i).isoformat() + "Z", end=(s + step * (i + 1)).isoformat() + "Z") for i in range(3)]
        raw = SEARCH_XML.format(n=3, items="".join(items)).encode()
        h.send_response(200)
        h.send_header("Content-Type", "application/xml")
        h.send_header("Content-Length", str(len(raw)))
        h.end_headers()
        h.wfile.write(raw)

    def _download(self, h: BaseHTTPRequestHandler, body: bytes) -> None:
        gen = self.generation
        m = re.search(r"size=(\d+)", body.decode("utf-8", "ignore"))
        size = int(m.group(1)) if m else FILE_BYTES
        h.send_response(200)
        h.send_header("Content-Type", "video/mpeg")
        h.send_header("Content-Length", str(size))
        h.end_headers()
        chunk = b"\x00\x00\x01\xba" + b"\x00" * (64 * 1024 - 4)
        sent = 0
        try:
            while sent < size:
                if not self._alive(gen):
                    self.downloads["cut"] += 1
                    return
                n = min(len(chunk), size - sent)
                h.wfile.write(chunk[:n])
                sent += n
                time.sleep(0.04)  # ~1.3 s per 2 MB file: the worker falls behind the exporter, so jobs queue up and the disk can fill mid-job
            self.downloads["complete"] += 1
        except OSError:
            self.downloads["client_gone"] += 1


# ---------------------------------------------------------------- fake Home Assistant

class FakeHa:
    def __init__(self, rate: float = 10.0, sensors: int = 12) -> None:
        self.rate = rate
        self.port = 0
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, name="soak-fake-ha", daemon=True)
        self.thread.start()
        self.server: Any = None
        self.states: dict[str, dict[str, Any]] = {}
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        for i in range(sensors):
            self.states[f"binary_sensor.soak_motion_{i}"] = {"entity_id": f"binary_sensor.soak_motion_{i}", "state": "off", "attributes": {"friendly_name": f"Motion {i}", "device_class": "motion"}, "last_changed": now, "last_updated": now}
            self.states[f"sensor.soak_power_{i}"] = {"entity_id": f"sensor.soak_power_{i}", "state": "0", "attributes": {"friendly_name": f"Power {i}", "device_class": "power", "unit_of_measurement": "W"}, "last_changed": now, "last_updated": now}
        self.sent_events = 0
        self.connections = 0
        self.open = 0
        self.restarts = 0

    def _run(self, coro: Any, timeout: float = 15) -> Any:
        return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout)

    def start(self) -> None:
        self._run(self._start())

    def stop(self) -> None:
        self._run(self._stop())

    def close(self) -> None:
        self.loop.call_soon_threadsafe(self.loop.stop)

    async def _start(self) -> None:
        from websockets.asyncio.server import serve

        self.server = await serve(self._handler, "127.0.0.1", self.port, max_size=None, ping_interval=None)
        self.port = next(iter(self.server.sockets)).getsockname()[1]

    async def _stop(self) -> None:
        if self.server is not None:
            self.server.close()
            await self.server.wait_closed()
            self.server = None

    def _change(self, i: int) -> dict[str, Any]:
        keys = sorted(self.states)
        eid = keys[i % len(keys)]
        old = self.states[eid]
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        if eid.startswith("binary_sensor."):
            new_state = "on" if old["state"] == "off" else "off"
        else:
            new_state = str(random.randint(0, 3000))
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
            await ws.send(json.dumps({"type": "auth_ok", "ha_version": "soak"}))
            pusher = asyncio.create_task(self._push(ws, subs))
            listings = {"config/entity_registry/list": [{"entity_id": e, "area_id": None, "device_id": None, "name": None, "platform": "soak"} for e in self.states],
                        "config/device_registry/list": [], "config/area_registry/list": [{"area_id": "hall", "name": "Hall", "floor_id": None}], "config/floor_registry/list": []}
            async for raw in ws:
                m = json.loads(raw)
                mid, kind = m.get("id"), m.get("type")
                if kind == "get_config":
                    result: Any = {"version": "soak-2026.9"}
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

    async def _push(self, ws: Any, subs: dict[int, str]) -> None:
        i = 0
        while True:
            await asyncio.sleep(1.0 / self.rate)
            sid = next((k for k, v in subs.items() if v == "state_changed"), None)
            if sid is None:
                continue
            await ws.send(json.dumps({"id": sid, "type": "event", "event": {"event_type": "state_changed", "data": self._change(i)}}))
            self.sent_events += 1
            i += 1


# ---------------------------------------------------------------- the soak

class LogTap(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.counts: collections.Counter[str] = collections.Counter()
        self.locked = 0
        self.errors = 0

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = record.getMessage()
        except Exception:  # noqa: BLE001
            msg = str(record.msg)
        if "database is locked" in msg:
            self.locked += 1
        if record.levelno >= logging.ERROR:
            self.errors += 1
        shape = NUMBERS.sub("#", msg)[:110]
        self.counts[f"{record.levelname} {record.name}: {shape}"] += 1


class Http:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.lat: dict[str, list[float]] = collections.defaultdict(list)
        self.status: collections.Counter[str] = collections.Counter()
        self.codes: collections.Counter[str] = collections.Counter()

    def call(self, client: Any, method: str, path: str, name: str, **kw: Any) -> Any:
        t0 = time.perf_counter()
        r = client.request(method, path, **kw)
        dt_s = time.perf_counter() - t0
        with self.lock:
            self.lat[name].append(dt_s)
            self.status[f"{name} {r.status_code}"] += 1
            if r.status_code >= 400:
                try:
                    self.codes[f"{r.status_code} {r.json().get('code')}"] += 1
                except ValueError:
                    self.codes[f"{r.status_code} ?"] += 1
        return r

    def summary(self) -> dict[str, Any]:
        with self.lock:
            out = {}
            for k, v in sorted(self.lat.items()):
                s = sorted(v)
                out[k] = {"n": len(s), "p50_ms": round(statistics.median(s) * 1000, 1), "p95_ms": round(s[int(0.95 * (len(s) - 1))] * 1000, 1), "max_ms": round(s[-1] * 1000, 1)}
            return {"endpoints": out, "status": dict(self.status), "errors_by_code": dict(self.codes),
                    "http_500": sum(n for k, n in self.status.items() if k.endswith(" 500"))}


def run(minutes: float, out: Path | None, nvr_every: float = 120, ha_every: float = 150, rss_slope_mb_h: float = 60.0) -> dict[str, Any]:
    if os.environ.get("SUPERVISOR_TOKEN"):
        raise SystemExit("soak_local: refusing to run inside the Home Assistant add-on")
    from fastapi.testclient import TestClient

    from smplwise import db as db_mod
    from smplwise.config import Settings
    from smplwise.main import create_app
    from smplwise.services import events_cache, events_ingest, exports as ex, ha_sync, thumbnails

    duration = minutes * 60
    warmup = max(60.0, duration * 0.3)
    tap = LogTap()
    logging.getLogger().addHandler(tap)
    baseline_threads = threading.active_count()

    nvr = FakeNvr()
    nvr.start()
    ha = FakeHa()
    ha.start()
    tmp = Path(tempfile.mkdtemp(prefix="sw-soak-"))
    settings = Settings(data_dir=tmp / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="soak", bootstrap_admin_username="soak",
                        nvr_host="127.0.0.1", nvr_http_port=nvr.port, nvr_user="soak", nvr_password="soak-only", go2rtc_url=None, log_level="warning",
                        ha_url=f"http://127.0.0.1:{ha.port}", ha_token="soak-token")

    # the pretend data disk: 50 MB minus what the export folders hold (the rest of the machine's disk is untouched)
    import shutil

    real_usage = shutil.disk_usage
    disk = {"total_mb": 50}
    exports_dir = settings.data_dir / "exports"

    def fake_usage(path: Any) -> Any:
        if not str(Path(path).resolve()).startswith(str(settings.data_dir.resolve())):
            return real_usage(path)
        used = sum(p.stat().st_size for p in exports_dir.rglob("*") if p.is_file()) if exports_dir.exists() else 0
        total = disk["total_mb"] * MB
        free = max(0, total - used)
        return shutil._ntuple_diskusage(total, total - free, free)  # type: ignore[attr-defined]

    shutil.disk_usage = fake_usage  # type: ignore[assignment]
    saved = {"resume_margin": ex.RESUME_MARGIN_MB, "grab": thumbnails._grab, "ffmpeg": ex.ffmpeg_path, "submit": events_ingest.AlertStreamListener.submit}
    ex.RESUME_MARGIN_MB = 2  # scaled with the pretend disk
    ex.ffmpeg_path = lambda: None  # the fake files are not video: deliver them raw

    def fake_grab(url: str, out_path: Path, _settings: Any, timeout_s: int = 40) -> bool:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(b"\xff\xd8\xff\xe0soak\xff\xd9")
        return True

    thumbnails._grab = fake_grab
    submitted = collections.Counter()
    real_submit = events_ingest.AlertStreamListener.submit

    def counting_submit(self: Any, alert: Any) -> str:
        if not alert.is_heartbeat:
            submitted[alert.state] += 1
        return real_submit(self, alert)

    events_ingest.AlertStreamListener.submit = counting_submit  # type: ignore[method-assign]
    events_ingest.QUEUE.reset()
    ex.STATS.update({k: 0 for k in ex.STATS})
    events_cache.CACHE.clear()
    events_cache.CACHE.reset_stats()

    app = create_app(settings)
    db = app.state.db
    boot = TestClient(app)
    cams = [boot.post("/api/v1/cameras", json={"channel": ch, "alias": f"soak{ch}"}).json() for ch in range(1, CAMERAS + 1)]
    with db.connection() as conn:
        for i, cam in enumerate(cams):
            conn.execute("UPDATE cameras SET main_track = ? WHERE id = ?", ((i + 1) * 100 + 1, cam["id"]))
    assert boot.patch("/api/v1/settings", json={"storage.min_free_mb": 20}).status_code == 200
    boot.close()

    http = Http()
    stop = threading.Event()
    samples: list[dict[str, Any]] = []
    restarts: list[dict[str, Any]] = []
    export_seen = collections.Counter()
    exporter_keep = {"n": 5}
    t_start = time.monotonic()
    report: dict[str, Any] = {"config": {"minutes": minutes, "nvr_restart_every_s": nvr_every, "ha_restart_every_s": ha_every, "warmup_s": warmup, "cameras": CAMERAS,
                                         "pretend_disk_mb": disk["total_mb"], "min_free_mb": 20, "file_mb": FILE_BYTES // MB, "platform": sys.platform, "python": sys.version.split()[0]}}

    with TestClient(app, raise_server_exceptions=False) as main_client:
        def elapsed() -> float:
            return time.monotonic() - t_start

        def worker(name: str, pause: float, step: Callable[[int], None]) -> threading.Thread:
            def loop() -> None:
                i = 0
                while not stop.is_set():
                    try:
                        step(i)
                    except Exception as exc:  # noqa: BLE001 - counted
                        http.codes[f"client {name} {type(exc).__name__}"] += 1
                    i += 1
                    stop.wait(pause)
            return threading.Thread(target=loop, name=f"soak-{name}", daemon=True)

        def reader(k: int) -> Callable[[int], None]:
            c = TestClient(app, raise_server_exceptions=False)

            def step(i: int) -> None:
                day = dt.datetime.now(TZ_OFFSET).date().isoformat()
                cam = cams[(i + k) % CAMERAS]["id"]
                paths = [("events_list", "/api/v1/events?limit=200"), ("events_facets", "/api/v1/events/facets"), ("timeline", f"/api/v1/cameras/{cam}/events?date={day}"),
                         ("windows", "/api/v1/events/windows"), ("health", "/api/v1/health"), ("storage_local", "/api/v1/storage/local"),
                         ("events_unacked", "/api/v1/events?limit=50&unacked=true"), ("exports_list", "/api/v1/exports")]
                name, path = paths[(i + k) % len(paths)]
                http.call(c, "GET", path, name)
            return step

        ac = TestClient(app, raise_server_exceptions=False)

        def acker(i: int) -> None:
            r = http.call(ac, "GET", "/api/v1/events?limit=5&unacked=true", "events_unacked")
            evs = r.json().get("events", []) if r.status_code == 200 else []
            if evs:
                http.call(ac, "POST", f"/api/v1/events/{evs[0]['id']}/ack", "ack")

        xc = TestClient(app, raise_server_exceptions=False)

        def exporter(i: int) -> None:
            end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0) - dt.timedelta(hours=1)
            start = end - dt.timedelta(minutes=30)
            r = http.call(xc, "POST", "/api/v1/exports", "export_create", json={"camera_id": cams[i % CAMERAS]["id"], "from_at": start.strftime("%Y-%m-%dT%H:%M:%SZ"), "to_at": end.strftime("%Y-%m-%dT%H:%M:%SZ")})
            export_seen[r.status_code] += 1
            if r.status_code == 201:
                export_seen["created_ids"] += 1
            # alternate between letting finished jobs pile up (the disk fills) and cleaning up (room again)
            exporter_keep["n"] = 5 if int(elapsed() // 60) % 2 == 0 else 1
            jobs = http.call(xc, "GET", "/api/v1/exports", "exports_list").json().get("jobs", [])
            finished = sorted((j for j in jobs if j["state"] in ("done", "partial", "failed", "cancelled", "interrupted")), key=lambda j: j["created_at"])
            for j in finished[: max(0, len(finished) - exporter_keep["n"])]:
                if http.call(xc, "DELETE", f"/api/v1/exports/{j['id']}", "export_delete").status_code == 200:
                    export_seen["deleted"] += 1

        ws_stats = collections.Counter()

        def ws_client(i: int) -> None:
            c = TestClient(app)
            with c.websocket_connect("/api/v1/events/ws") as ws:
                ws_stats["connects"] += 1
                until = time.monotonic() + 20
                while time.monotonic() < until and not stop.is_set():
                    msg = json.loads(ws.receive_text())
                    ws_stats[msg.get("type", "?")] += 1
            c.close()

        def slow_db(i: int) -> None:
            if i == 0:
                return
            conn = sqlite3.connect(str(db.path), timeout=10, isolation_level=None)
            try:
                conn.execute("BEGIN IMMEDIATE")
                time.sleep(3.0)
                conn.execute("ROLLBACK")
            finally:
                conn.close()

        def restarter() -> None:
            next_nvr, next_ha, n_nvr = nvr_every, ha_every, 0
            while not stop.is_set():
                t = elapsed()
                if t >= next_nvr and t < duration - 90:
                    down = 10 if n_nvr % 2 == 0 else 50
                    nvr.stop()
                    restarts.append({"at_s": round(t, 1), "what": "nvr", "down_s": down})
                    stop.wait(down)
                    nvr.start()
                    nvr.restarts += 1
                    n_nvr += 1
                    next_nvr += nvr_every
                elif t >= next_ha and t < duration - 60:
                    ha.stop()
                    restarts.append({"at_s": round(t, 1), "what": "ha", "down_s": 8})
                    stop.wait(8)
                    ha.start()
                    ha.restarts += 1
                    next_ha += ha_every
                else:
                    stop.wait(1)

        def sampler() -> None:
            last_tcp = -1e9
            while not stop.is_set():
                s: dict[str, Any] = {"t_s": round(elapsed(), 1), **memory(), "threads": threading.active_count(), "py_objects": len(gc.get_objects()),
                                     "ingest_depth": events_ingest.QUEUE.depth(), "ws_subscribers": len(events_ingest._subscribers)}
                with db.connection(mode="read") as conn:
                    st = dict(conn.execute("SELECT state, COUNT(*) FROM export_jobs GROUP BY state").fetchall())
                s["exports_waiting"] = st.get("queued", 0) + st.get("paused_disk_full", 0)
                s["exports_paused"] = st.get("paused_disk_full", 0)
                if time.monotonic() - last_tcp >= 30:
                    s["tcp"] = tcp_connections()
                    last_tcp = time.monotonic()
                samples.append(s)
                stop.wait(5)

        threads = [threading.Thread(target=sampler, name="soak-sampler", daemon=True), threading.Thread(target=restarter, name="soak-restarter", daemon=True)]
        threads += [worker(f"reader{k}", 0.2, reader(k)) for k in range(3)]
        threads += [worker("acker", 5.0, acker), worker("exporter", 2.0, exporter), worker("ws", 2.0, ws_client), worker("slowdb", 40.0, slow_db)]
        for t in threads:
            t.start()
        last_print = 0.0
        trace = os.environ.get("SW_SOAK_TRACEMALLOC") == "1"  # diagnosis: where Python memory grew between warm-up and the end
        snap0 = None
        if trace:
            import tracemalloc

            tracemalloc.start(8)
        while elapsed() < duration:
            time.sleep(1)
            if trace and snap0 is None and elapsed() >= warmup:
                snap0 = tracemalloc.take_snapshot()
            if elapsed() - last_print >= 60:
                last_print = elapsed()
                s = samples[-1] if samples else {}
                print(f"[soak] {elapsed() / 60:5.1f} min - rss {s.get('rss_mb')} MB - threads {s.get('threads')} - ingest queue {events_ingest.QUEUE.stats()} - exports {dict(ex.stats())}", flush=True)
        if trace and snap0 is not None:
            snap1 = tracemalloc.take_snapshot()
            flt = [tracemalloc.Filter(False, tracemalloc.__file__), tracemalloc.Filter(False, "<frozen importlib._bootstrap>")]
            diff = snap1.filter_traces(flt).compare_to(snap0.filter_traces(flt), "traceback")
            report["tracemalloc_growth"] = [{"kb": round(d.size_diff / 1024, 1), "count": d.count_diff, "at": [f"{Path(f.filename).name}:{f.lineno}" for f in d.traceback][-6:]} for d in diff[:15]]
            report["tracemalloc_total_mb"] = {"warmup": round(sum(s.size for s in snap0.statistics("filename")) / MB, 1), "end": round(sum(s.size for s in snap1.statistics("filename")) / MB, 1)}
            tracemalloc.stop()
        stop.set()
        for t in threads:
            t.join(40)
        stuck_clients = [t.name for t in threads if t.is_alive()]

        # drain: room on the disk again, feeds up, let the worker and the writer finish what is queued
        disk["total_mb"] = 10_000
        ex.WORKER.wake()
        drain_deadline = time.monotonic() + 120
        while time.monotonic() < drain_deadline:
            with db.connection(mode="read") as conn:
                active = conn.execute("SELECT COUNT(*) FROM export_jobs WHERE state IN ('queued', 'running', 'paused_disk_full')").fetchone()[0]
            if not active and events_ingest.QUEUE.depth() == 0 and events_ingest.STATE.connected and ha_sync.STATE.connected:
                break
            ex.WORKER.wake()
            time.sleep(2)
        connected = {"nvr": events_ingest.STATE.connected, "ha": ha_sync.STATE.connected}
        # the NVR stops sending, so the queue can empty and the stored counts can be compared with what was submitted
        nvr.stop()
        settle = time.monotonic() + 30
        while time.monotonic() < settle:
            st = events_ingest.QUEUE.stats()
            if st["depth"] == 0 and st["accepted"] == st["processed"] + st["failed"] + st["coalesced"] + st["dropped"]:
                break
            time.sleep(0.5)
        end_state = {
            "alertstream_connected": connected["nvr"], "ha_connected": connected["ha"],
            "ingest_state": events_ingest.STATE.as_dict(), "ha_state": {k: v for k, v in ha_sync.STATE.as_dict().items() if k in ("connected", "reconnects", "entities", "last_error")},
            "export_counters": ex.stats(), "events_cache": events_cache.CACHE.stats(), "db_write_lock": db_mod.lock_stats(),
            "thumbnail_index_rebuilds": thumbnails.INDEX.rebuilds,
        }
        with db.connection(mode="read") as conn:
            end_state["exports_by_state"] = dict(conn.execute("SELECT state, COUNT(*) FROM export_jobs GROUP BY state").fetchall())
            end_state["events_by_source"] = dict(conn.execute("SELECT source, COUNT(*) FROM events GROUP BY source").fetchall())
            end_state["alert_count_sum"] = conn.execute("SELECT COALESCE(SUM(count), 0) FROM events WHERE source = 'alertstream' AND raw_type = 'VMD'").fetchone()[0]
            end_state["coverage_gaps"] = conn.execute("SELECT COUNT(*) FROM events WHERE type = 'coverage_gap'").fetchone()[0]
        subscribers_before_shutdown = len(events_ingest._subscribers)
        for c in (ac, xc):
            c.close()

    # the application has shut down (lifespan exit); now the fakes go, and product threads must end
    nvr.stop()
    ha.stop()
    ha.close()
    shutdown_deadline = time.monotonic() + 30
    while time.monotonic() < shutdown_deadline and any(t.name in PRODUCT_THREADS for t in threading.enumerate()):
        time.sleep(0.5)
    left = sorted(t.name for t in threading.enumerate() if t.name in PRODUCT_THREADS)
    after = {"threads": threading.active_count(), "names": sorted(collections.Counter(re.sub(r"\d+", "#", t.name) for t in threading.enumerate()).items()), **memory(), "tcp": tcp_connections()}

    # restore what the soak patched
    shutil.disk_usage = real_usage  # type: ignore[assignment]
    ex.RESUME_MARGIN_MB, thumbnails._grab, ex.ffmpeg_path = saved["resume_margin"], saved["grab"], saved["ffmpeg"]
    events_ingest.AlertStreamListener.submit = saved["submit"]  # type: ignore[method-assign]
    logging.getLogger().removeHandler(tap)
    shutil.rmtree(tmp, ignore_errors=True)  # the temporary data dir (database, exports, thumbnails)
    report["config"]["temp_dir_removed"] = not tmp.exists()

    # ---------------------------------------------------------------- evaluation
    post = [s for s in samples if s["t_s"] >= warmup]
    rss_pts = [(s["t_s"], s["rss_mb"]) for s in post]
    priv_pts = [(s["t_s"], s["private_mb"]) for s in post]
    obj_pts = [(s["t_s"], s["py_objects"]) for s in post]
    thr = [s["threads"] for s in post] or [0]
    han = [s["handles"] for s in post] or [0]
    tcp_samples = [s["tcp"] for s in post if "tcp" in s]
    tcp_totals = [sum(v for k, v in t.items() if k != "LISTENING") for t in tcp_samples] or [0]
    close_wait = [t.get("CLOSE_WAIT", 0) for t in tcp_samples] or [0]
    q = events_ingest.QUEUE.stats()
    httpsum = http.summary()
    counters = end_state["export_counters"]
    n507 = export_seen.get(507, 0)
    checks: list[tuple[str, bool, Any]] = []

    def check(name: str, ok: bool, detail: Any) -> None:
        checks.append((name, bool(ok), detail))

    check("no 'database is locked' in the log", tap.locked == 0, tap.locked)
    check("no busy errors (db.write_lock.busy_errors)", end_state["db_write_lock"]["busy_errors"] == 0, end_state["db_write_lock"])
    check("no HTTP 500", httpsum["http_500"] == 0, httpsum["http_500"])
    check(f"RSS slope after warm-up < {rss_slope_mb_h} MB/h", slope_per_hour(rss_pts) < rss_slope_mb_h, round(slope_per_hour(rss_pts), 1))
    check(f"private bytes slope after warm-up < {rss_slope_mb_h} MB/h", slope_per_hour(priv_pts) < rss_slope_mb_h, round(slope_per_hour(priv_pts), 1))
    check("threads bounded after warm-up (max - first <= 12)", max(thr) - thr[0] <= 12, {"first": thr[0], "max": max(thr), "last": thr[-1]})
    check("handles/fds bounded after warm-up (last - first <= 150)", han[-1] - han[0] <= 150, {"first": han[0], "max": max(han), "last": han[-1]})
    check("TCP connections bounded (<= 60) and no CLOSE_WAIT build-up (<= 5)", max(tcp_totals) <= 60 and max(close_wait) <= 5, {"max_open": max(tcp_totals), "max_close_wait": max(close_wait)})
    check("no product thread alive after shutdown", not left, left)
    check("ingest queue within its bound", q["high_water"] <= events_ingest.QUEUE.maxlen, q)
    check("ingest counters consistent (accepted = processed + failed + coalesced + dropped + depth)",
          q["accepted"] == q["processed"] + q["failed"] + q["coalesced"] + q["dropped"] + q["depth"], q)
    check("every submitted alert was accepted by the queue", q["accepted"] == submitted["active"] + submitted["inactive"], {"submitted": dict(submitted), "accepted": q["accepted"]})
    sent_alerts = nvr.sent["active"] + nvr.sent["inactive"]
    check("the listener read what the NVR sent (docs cut by a restart excepted)", 0 <= sent_alerts - q["accepted"] <= 50 * max(1, nvr.restarts), {"sent": dict(nvr.sent), "accepted": q["accepted"]})
    if q["dropped"] == 0 and q["failed"] == 0:
        check("stored burst counts add up to every accepted motion alert", end_state["alert_count_sum"] == submitted["active"], {"sum_count": end_state["alert_count_sum"], "active": submitted["active"]})
    check("WebSocket subscribers back to zero", subscribers_before_shutdown == 0, subscribers_before_shutdown)
    check("export queue within its bound (waiting <= MAX_QUEUED_TOTAL)", max((s["exports_waiting"] for s in samples), default=0) <= ex.MAX_QUEUED_TOTAL, max((s["exports_waiting"] for s in samples), default=0))
    check("every 507 the client saw was counted", counters["refused_disk"] == n507, {"counted": counters["refused_disk"], "seen": n507})
    check("the disk filled mid-job at least once and jobs resumed", counters["paused_disk_full"] >= 1 and counters["resumed"] >= 1, counters)
    check("no export left queued / running / paused after the drain", not any(end_state["exports_by_state"].get(k) for k in ("queued", "running", "paused_disk_full")), end_state["exports_by_state"])
    check("both feeds connected again after their last restart", end_state["alertstream_connected"] and end_state["ha_connected"], {"nvr": end_state["alertstream_connected"], "ha": end_state["ha_connected"]})
    check("the soak clients did not hang", not stuck_clients, stuck_clients)

    report.update({
        "duration_s": round(time.monotonic() - t_start, 1),
        "restarts": restarts,
        "fakes": {"nvr_sent": dict(nvr.sent), "nvr_streams": nvr.streams, "nvr_downloads": dict(nvr.downloads), "nvr_restarts": nvr.restarts,
                  "ha_events_sent": ha.sent_events, "ha_connections": ha.connections, "ha_restarts": ha.restarts},
        "submitted_alerts": dict(submitted), "ingest_queue": q, "end_state": end_state,
        "exports_client": {str(k): v for k, v in export_seen.items()}, "ws_client": dict(ws_stats), "http": httpsum,
        "memory": {"rss_first_mb": samples[0]["rss_mb"] if samples else None, "rss_at_warmup_mb": post[0]["rss_mb"] if post else None,
                   "rss_last_mb": samples[-1]["rss_mb"] if samples else None, "rss_max_mb": max((s["rss_mb"] for s in samples), default=None),
                   "rss_slope_mb_per_h": round(slope_per_hour(rss_pts), 2), "private_slope_mb_per_h": round(slope_per_hour(priv_pts), 2),
                   "py_objects_slope_per_h": round(slope_per_hour(obj_pts)), "py_objects_first": post[0]["py_objects"] if post else None, "py_objects_last": post[-1]["py_objects"] if post else None},
        "threads": {"baseline_before_app": baseline_threads, "after_warmup_first": thr[0], "max": max(thr), "last": thr[-1]},
        "after_shutdown": after, "product_threads_left": left,
        "log": {"warnings_and_errors": sum(tap.counts.values()), "errors": tap.errors, "database_is_locked": tap.locked, "top": tap.counts.most_common(12)},
        "samples": samples,
        "checks": [{"check": n, "ok": ok, "detail": d} for n, ok, d in checks],
        "passed": all(ok for _, ok, _ in checks),
    })
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print("\n[soak] summary")
    print(f"  duration {report['duration_s']} s - restarts: {sum(1 for r in restarts if r['what'] == 'nvr')} NVR, {sum(1 for r in restarts if r['what'] == 'ha')} HA")
    print(f"  NVR sent {dict(nvr.sent)} - ingest queue {q}")
    print(f"  HA events sent {ha.sent_events} - events stored by source {end_state['events_by_source']} - coverage gaps {end_state['coverage_gaps']}")
    print(f"  exports client {report['exports_client']} - counters {counters} - end {end_state['exports_by_state']}")
    print(f"  memory {report['memory']}")
    print(f"  threads {report['threads']} - after shutdown {after['threads']} - product threads left {left}")
    print(f"  http 500: {httpsum['http_500']} - errors by code {httpsum['errors_by_code']}")
    print(f"  events cache {end_state['events_cache']}")
    for n, ok, d in checks:
        print(f"  [{'PASS' if ok else 'FAIL'}] {n} :: {d}")
    print(f"[soak] {'PASSED' if report['passed'] else 'FAILED'}" + (f" - report {out}" if out else ""))
    return report


def test_soak_local() -> None:
    import pytest

    if os.environ.get("SW_SOAK") != "1":
        pytest.skip("opt-in soak (SW_SOAK=1)")
    out = os.environ.get("SW_SOAK_OUT")
    report = run(float(os.environ.get("SW_SOAK_MIN", "10")), Path(out) if out else None)
    assert report["passed"], [c for c in report["checks"] if not c["ok"]]


def main() -> None:
    if os.environ.get("SW_SOAK") != "1":
        raise SystemExit("opt-in soak: set SW_SOAK=1")
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--minutes", type=float, default=float(os.environ.get("SW_SOAK_MIN", "10")))
    ap.add_argument("--out", type=Path, default=Path(os.environ["SW_SOAK_OUT"]) if os.environ.get("SW_SOAK_OUT") else None)
    ap.add_argument("--nvr-every", type=float, default=120)
    ap.add_argument("--ha-every", type=float, default=150)
    ap.add_argument("--rss-slope-mb-h", type=float, default=60.0)
    a = ap.parse_args()
    report = run(a.minutes, a.out, a.nvr_every, a.ha_every, a.rss_slope_mb_h)
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
