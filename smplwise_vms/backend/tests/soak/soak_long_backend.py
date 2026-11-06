"""T068 long soak - the backend process. Started by `soak_long.py` (never by hand, never inside the add-on).

It runs the real application (`create_app` with explicit Settings: a fresh data directory, the fake NVR / Home Assistant +
WisKey / go2rtc of the harness on 127.0.0.1) under uvicorn on the standard asyncio loop and h11, exactly as `python -m
smplwise` does by default, and adds three things the product itself does not expose, without touching product code:

- an event-loop lag monitor: an asyncio task sleeps 0.25 s and records how late it woke (the loop's responsiveness);
- an ASGI wrapper around the application that counts open WebSockets by kind (live relay / event feed / other) and HTTP
  requests in flight, and serves `GET /__soak/stats` (handled before the application: no auth, no route, 127.0.0.1 only);
- a log tap that counts warnings, errors and "database is locked" lines.

`/__soak/stats` answers one JSON document per call: process RSS / private bytes / handles or fds / threads / CPU seconds /
Python object count, the database and WAL file sizes, the loop-lag window since the previous call (p50/p95/p99/max), the
WebSocket and live-session counts, the write-lock and ingest-queue counters and the feeds' connection state. The harness
calls it once per sample (60 s by default); the expensive part runs in a worker thread so the call itself adds no lag.

Two device calls are faked inside this process as in `soak_local.py`: the thumbnail frame grab (writes a tiny JPEG) and
ffmpeg (absent: the fake export files are not video and are delivered raw).
"""
from __future__ import annotations

import argparse
import asyncio
import collections
import gc
import json
import logging
import os
import re
import statistics
import sys
import threading
import time
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[1]
for p in (str(BACKEND), str(HERE)):
    if p not in sys.path:
        sys.path.insert(0, p)

from soak_local import memory  # noqa: E402

STATS_PATH = "/__soak/stats"
NUMBERS = re.compile(r"[0-9a-f]{12,}|\d+(\.\d+)?")
LAG_PERIOD_S = 0.25
LAG_KEEP = 20_000  # samples kept between two stats calls (~83 min at 4/s): bounded even when nobody asks


class LagMonitor:
    """How late an asyncio sleep of LAG_PERIOD_S wakes up, per wake-up; `take()` returns and clears the window."""

    def __init__(self, period: float = LAG_PERIOD_S) -> None:
        self.period = period
        self.lock = threading.Lock()
        self.window: collections.deque[float] = collections.deque(maxlen=LAG_KEEP)
        self.total = 0

    async def run(self) -> None:
        while True:
            t0 = time.perf_counter()
            await asyncio.sleep(self.period)
            lag = max(0.0, time.perf_counter() - t0 - self.period)
            with self.lock:
                self.window.append(lag)
                self.total += 1

    def take(self) -> dict[str, Any]:
        with self.lock:
            s = sorted(self.window)
            self.window.clear()
        return summarize_ms(s)


def summarize_ms(sorted_s: list[float]) -> dict[str, Any]:
    """p50 / p95 / p99 / max in milliseconds of a sorted list of seconds (None when empty)."""
    if not sorted_s:
        return {"n": 0, "p50_ms": None, "p95_ms": None, "p99_ms": None, "max_ms": None}

    def q(f: float) -> float:
        return round(sorted_s[min(len(sorted_s) - 1, int(f * (len(sorted_s) - 1) + 0.5))] * 1000, 2)

    return {"n": len(sorted_s), "p50_ms": round(statistics.median(sorted_s) * 1000, 2), "p95_ms": q(0.95), "p99_ms": q(0.99), "max_ms": round(sorted_s[-1] * 1000, 2)}


class LogTap(logging.Handler):
    """Counts warnings / errors / 'database is locked'; keeps the most frequent message shapes (at most 300 distinct)."""

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.warnings = 0
        self.errors = 0
        self.locked = 0
        self.shapes: collections.Counter[str] = collections.Counter()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = record.getMessage()
        except Exception:  # noqa: BLE001
            msg = str(record.msg)
        if "database is locked" in msg:
            self.locked += 1
        if record.levelno >= logging.ERROR:
            self.errors += 1
        else:
            self.warnings += 1
        shape = f"{record.levelname} {record.name}: {NUMBERS.sub('#', msg)[:110]}"
        if shape in self.shapes or len(self.shapes) < 300:
            self.shapes[shape] += 1


def ws_kind(path: str) -> str:
    if path.startswith("/api/v1/media/live/") and path.endswith("/ws"):
        return "live"
    if path == "/api/v1/events/ws":
        return "events"
    return "other"


class SoakAsgi:
    """Counts open WebSockets / HTTP requests in flight around the application and serves STATS_PATH itself."""

    def __init__(self, app: Any, stats: Any) -> None:
        self.app = app
        self.stats = stats
        self.ws_open: collections.Counter[str] = collections.Counter()
        self.ws_total: collections.Counter[str] = collections.Counter()
        self.http_inflight = 0
        self.http_total = 0

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        kind = scope.get("type")
        if kind == "http" and scope.get("path") == STATS_PATH:
            body = json.dumps(await asyncio.to_thread(self.stats, self), default=str).encode()
            await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
            await send({"type": "http.response.body", "body": body})
            return
        if kind == "websocket":
            k = ws_kind(scope.get("path") or "")
            self.ws_open[k] += 1
            self.ws_total[k] += 1
            try:
                await self.app(scope, receive, send)
            finally:
                self.ws_open[k] -= 1
            return
        if kind == "http":
            self.http_inflight += 1
            self.http_total += 1
            try:
                await self.app(scope, receive, send)
            finally:
                self.http_inflight -= 1
            return
        await self.app(scope, receive, send)


def _size(p: Path) -> int | None:
    try:
        return p.stat().st_size
    except OSError:
        return None


def _fds() -> int | None:
    try:
        return len(os.listdir("/proc/self/fd"))
    except OSError:
        return None


def build(args: argparse.Namespace) -> tuple[Any, LagMonitor]:
    from smplwise import db as db_mod
    from smplwise.config import Settings
    from smplwise.main import create_app
    from smplwise.routers.media import REGISTRY
    from smplwise.services import events_cache, events_ingest, exports as ex, ha_sync, intercom_sync, thumbnails

    def fake_grab(url: str, out_path: Path, _settings: Any, timeout_s: int = 40) -> bool:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(b"\xff\xd8\xff\xe0soak\xff\xd9")
        return True

    thumbnails._grab = fake_grab
    ex.ffmpeg_path = lambda: None  # the fake files are not video: deliver them raw

    tap = LogTap()
    settings = Settings(data_dir=Path(args.data_dir), www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="soak",
                        bootstrap_admin_username="soak", nvr_host="127.0.0.1", nvr_http_port=args.nvr_port, nvr_user="soak",
                        nvr_password="soak-only", go2rtc_url=f"http://127.0.0.1:{args.go2rtc_port}", log_level="warning",
                        ha_url=f"http://127.0.0.1:{args.ha_port}", ha_token="soak-token")
    app = create_app(settings)
    logging.getLogger().addHandler(tap)  # after create_app configured logging
    db_path = Path(app.state.db.path)
    lag = LagMonitor()
    t_boot = time.monotonic()

    def stats(wrapper: SoakAsgi) -> dict[str, Any]:
        mem = memory()
        out: dict[str, Any] = {
            "pid": os.getpid(), "uptime_s": round(time.monotonic() - t_boot, 1), "cpu_s": round(time.process_time(), 3), **mem,
            "fds": _fds() if sys.platform != "win32" else None, "threads": threading.active_count(),
            "thread_names": dict(collections.Counter(re.sub(r"\d+", "#", t.name) for t in threading.enumerate()).most_common(12)),
            "py_objects": len(gc.get_objects()), "loop_lag": lag.take(),
            "ws_open": dict(wrapper.ws_open), "ws_total": dict(wrapper.ws_total), "http_inflight": wrapper.http_inflight, "http_total": wrapper.http_total,
            "live_sessions": REGISTRY.count(), "events_subscribers": len(events_ingest._subscribers),
            "db_bytes": _size(db_path), "wal_bytes": _size(db_path.with_name(db_path.name + "-wal")),
            "db_write_lock": db_mod.lock_stats(), "ingest": events_ingest.QUEUE.stats(),
            "nvr_connected": bool(events_ingest.STATE.connected), "ha_connected": bool(ha_sync.STATE.connected),
            "intercom_state": getattr(intercom_sync.STATE, "state", None), "events_cache": events_cache.CACHE.stats(),
            "export_counters": ex.stats(),
            "log": {"warnings": tap.warnings, "errors": tap.errors, "database_is_locked": tap.locked, "top": tap.shapes.most_common(8)},
        }
        return out

    return SoakAsgi(app, stats), lag


async def serve(args: argparse.Namespace) -> None:
    import uvicorn

    wrapped, lag = build(args)
    from smplwise.main import warm_route_tables

    warm_route_tables(wrapped.app)
    config = uvicorn.Config(wrapped, host="127.0.0.1", port=args.port, log_level="warning", loop="asyncio", http="h11", ws="auto",
                            proxy_headers=False, lifespan="on")
    server = uvicorn.Server(config)
    monitor = asyncio.create_task(lag.run())
    try:
        await server.serve()
    finally:
        monitor.cancel()


def main() -> None:
    if os.environ.get("SUPERVISOR_TOKEN"):
        raise SystemExit("soak_long_backend: refusing to run inside the Home Assistant add-on")
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--nvr-port", type=int, required=True)
    ap.add_argument("--ha-port", type=int, required=True)
    ap.add_argument("--go2rtc-port", type=int, required=True)
    asyncio.run(serve(ap.parse_args()))


if __name__ == "__main__":
    main()
