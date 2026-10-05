"""M069 / T069: oversized media through the go2rtc relay, against a FAKE go2rtc (a local WebSocket server that plays a
scripted stream; no real go2rtc, NVR or camera is contacted).

The authorized live socket (`/api/v1/media/live/{id}/ws`, the real route, the real `relay_ws`, the real `Go2rtc` adapter)
carries ~120 MiB of binary media in frames of 1 / 2 / 24 MiB from the fake upstream to the browser. Asserted: every byte
arrives intact and in order, the session's byte counter and the stop audit row agree, the add-on's memory does not grow
with the stream (frames are forwarded, never accumulated), the upstream sees the stream name and the go2rtc API
credentials the add-on holds (the browser never sends them), and the browser-to-go2rtc direction is limited by the ASGI
server's WebSocket frame cap (uvicorn `ws_max_size`, 16 MiB; the add-on does not raise it).

Numbers are printed with `-s` (`M069_EVIDENCE {...}`) and written to SW_M069_EVIDENCE when set.
"""
from __future__ import annotations

import asyncio
import hashlib
import inspect
import json
import os
import threading
import time
from dataclasses import replace
from typing import Any

import pytest
import websockets
from conftest import as_user, sw_time_factor
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import media

try:
    import resource
except ImportError:  # Windows: the runner (Linux) is where the numbers are taken
    resource = None

MIB = 1024 * 1024
FRAMES = [24 * MIB] + [2 * MIB] * 40 + [1 * MIB] * 16  # 24 + 80 + 16 = 120 MiB
EVIDENCE: dict[str, Any] = {}


def _frame(i: int, size: int) -> bytes:
    seed = hashlib.sha256(f"frame-{i}".encode()).digest()
    return (seed * (size // len(seed) + 1))[:size]


class FakeGo2rtc:
    """A go2rtc /api/ws look-alike: remembers how it was called, then streams the scripted frames."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.client_messages: list[str | bytes] = []
        self.port = 0
        self._loop: asyncio.AbstractEventLoop | None = None
        self._ready = threading.Event()
        self._stop: asyncio.Future | None = None

    async def _handler(self, ws) -> None:
        self.calls.append({"path": ws.request.path, "authorization": ws.request.headers.get("Authorization")})
        await ws.send(json.dumps({"type": "mse", "value": "video/mp4; codecs=\"avc1.640029\""}))  # a control frame first, like go2rtc
        for i, size in enumerate(FRAMES):
            await ws.send(_frame(i, size))
        # keep listening a moment so a message the browser sends is recorded (the client-to-upstream direction)
        try:
            async with asyncio.timeout(3):
                async for msg in ws:
                    self.client_messages.append(msg)
        except (TimeoutError, websockets.ConnectionClosed):
            pass

    def start(self) -> None:
        def run() -> None:
            async def main() -> None:
                self._loop = asyncio.get_running_loop()
                self._stop = self._loop.create_future()
                async with websockets.serve(self._handler, "127.0.0.1", 0, max_size=None, compression=None) as server:
                    self.port = server.sockets[0].getsockname()[1]
                    self._ready.set()
                    await self._stop
            asyncio.run(main())

        threading.Thread(target=run, daemon=True, name="fake-go2rtc").start()
        assert self._ready.wait(10)

    def stop(self) -> None:
        if self._loop and self._stop:
            self._loop.call_soon_threadsafe(lambda: self._stop.done() or self._stop.set_result(None))


def rss_mb() -> float:
    if resource is None:
        return -1.0
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024


@pytest.fixture()
def big(settings, monkeypatch):
    fake = FakeGo2rtc()
    fake.start()
    s = replace(settings, go2rtc_url=f"http://127.0.0.1:{fake.port}", go2rtc_user="gateuser", go2rtc_password="gatepass")
    monkeypatch.setattr(media, "ensure_camera_stream", lambda _s, cam, profile: f"smplwise_nvr-1_ch{cam['channel']}_{profile}")
    c = TestClient(create_app(s))
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "big"}).json()
    yield c, s, fake, cam
    fake.stop()


def test_120_mib_of_media_passes_the_relay_intact_and_bounded(big):
    c, s, fake, cam = big
    f = sw_time_factor()
    want = hashlib.sha256()
    total = 0
    for i, size in enumerate(FRAMES):
        want.update(_frame(i, size))
        total += size
    got = hashlib.sha256()
    n_bytes = n_frames = 0
    rss0 = rss_mb()
    t0 = time.perf_counter()
    with c.websocket_connect(f"/api/v1/media/live/{cam['id']}/ws?profile=main", headers=as_user("joni")) as ws:
        first = ws.receive_json()
        assert first["type"] == "mse"
        while n_frames < len(FRAMES):
            msg = ws.receive_bytes()
            got.update(msg)
            n_bytes += len(msg)
            n_frames += 1
    secs = time.perf_counter() - t0
    assert (n_frames, n_bytes) == (len(FRAMES), total)
    assert got.hexdigest() == want.hexdigest(), "every byte, in order"
    EVIDENCE.update(frames=n_frames, mib=total // MIB, seconds=round(secs, 2), mib_per_s=round(total / MIB / secs, 1),
                    rss_before_mb=round(rss0, 1), rss_after_mb=round(rss_mb(), 1), rss_growth_mb=round(rss_mb() - rss0, 1))
    assert secs < 120 * f
    if resource is not None:
        # the largest frame is 24 MiB: a relay that buffered the stream would hold 120 MiB. Allow the biggest frame twice
        # (receive + forward copy) plus slack, never the whole stream.
        assert rss_mb() - rss0 < 150, f"memory grew {rss_mb() - rss0:.0f} MiB while relaying {total // MIB} MiB"

    # the upstream saw the pinned stream and the add-on's credentials; the browser supplied neither
    deadline = time.time() + 5
    while not fake.calls and time.time() < deadline:
        time.sleep(0.05)
    call = fake.calls[0]
    assert call["path"] == "/api/ws?src=smplwise_nvr-1_ch1_main"
    assert call["authorization"] and call["authorization"].startswith("Basic ")

    # the session closed and was audited with the byte count the relay saw
    deadline = time.time() + 10
    stop = None
    while stop is None and time.time() < deadline:
        with Database(s.db_path).connection(mode="read") as conn:
            stop = conn.execute("SELECT details_json FROM audit_log WHERE action = 'video.live.stop' ORDER BY rowid DESC LIMIT 1").fetchone()
        time.sleep(0.1)
    if stop is None:
        with Database(s.db_path).connection(mode="read") as conn:
            seen = [r[0] for r in conn.execute("SELECT action FROM audit_log ORDER BY rowid").fetchall()]
        raise AssertionError(f"no video.live.stop row; audit actions: {seen}")
    details = json.loads(stop["details_json"])
    assert details["bytes_down"] >= total
    assert not media.REGISTRY.sessions, "the session left the budget"
    print("\nM069_EVIDENCE " + json.dumps(EVIDENCE, sort_keys=True))
    out = os.environ.get("SW_M069_EVIDENCE")
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(EVIDENCE, fh, indent=1, sort_keys=True)


def test_the_browser_side_frame_cap_is_the_asgi_servers_and_is_not_raised():
    """The browser-to-go2rtc direction forwards what the browser sends, verbatim. The bound on one frame is uvicorn's own
    `ws_max_size` (16 MiB by default; the connection is closed with 1009 beyond it). The add-on must neither raise it nor
    disable it - this fails if `python -m smplwise` ever passes `ws_max_size`."""
    import uvicorn

    from smplwise import __main__ as entry

    assert uvicorn.Config("x:y").ws_max_size == 16 * MIB
    src = inspect.getsource(entry)
    assert "ws_max_size" not in src and "ws_per_message_deflate" not in src
