"""SEGFAULT-PLAYBACK-2332 stress: the pattern of the home-oliel crash (fast scrubbing: a burst of frame requests, many of them for
pictures that do not exist, and playback relay sockets opened, superseded and dropped every second or two).

What this proves and what it does not (docs/changes/SEGFAULT-PLAYBACK-2332.md):
- the frame endpoint never decodes an image in the server process (the picture comes from an ffmpeg child process and is served as
  bytes), so a truncated or garbage JPEG cannot crash the server there, and at most two grabs run at once;
- the relay (services/relay.py) under a real uvicorn server with the native HTTP parser where installed (httptools), rapid open /
  supersede / abrupt drop leaves no upstream socket open and the server keeps answering.
It does NOT reproduce a segmentation fault: the workstation is Windows, where uvloop does not exist; the runner (Linux, musl image
not included) can run the uvloop variant, which is skipped here when uvloop is missing."""
from __future__ import annotations

import asyncio
import importlib.util
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

import pytest

from conftest import seed_tree
from fastapi import WebSocket
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import frames

GARBAGE_JPEGS = [b"\xff\xd8\xff\xe0\x00\x10JFIF\x00", b"\xff\xd8" + b"\x00" * 64, b"not a jpeg at all", b"\xff\xd8\xff\xdb\x00\x43" + b"\xff" * 300]


def _search_unavailable(*a, **k):
    raise OSError("no recorder in this test")


def test_frame_burst_with_broken_pictures_never_decodes_in_process(settings, monkeypatch):
    import PIL.Image

    def no_decode(*a, **k):
        raise AssertionError("the frame endpoint must not decode an image in the server process")

    monkeypatch.setattr(PIL.Image, "open", no_decode)
    app = create_app(replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p"))
    c = TestClient(app)
    seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Scrub"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 1401 WHERE id = ?", (cam["id"],))
    lock, live, peak = threading.Lock(), [0], [0]

    def fake_grab(url, out, s, timeout_s=40):
        with lock:
            live[0] += 1
            peak[0] = max(peak[0], live[0])
        try:
            time.sleep(0.02)
            n = int(out.stem[-2:]) // 10  # the bucket's seconds
            if n % 3 == 2:
                return False  # "no picture there" (404)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(GARBAGE_JPEGS[n % len(GARBAGE_JPEGS)])
            return True
        finally:
            with lock:
                live[0] -= 1

    monkeypatch.setattr(frames, "GRAB", fake_grab)
    monkeypatch.setattr(frames, "SEARCH", _search_unavailable)  # PLAYBACK-SCRUB-2341: the recorder search is not reachable here -> the asked second, as before
    frames.MEMO.clear()
    ats = [f"2026-10-31T2{m % 4}:{m:02d}:{s:02d}Z" for m in range(0, 15) for s in (0, 10, 20, 30, 40, 50)]

    def one(at):
        r = c.get(f"/api/v1/cameras/{cam['id']}/frame?at={at}")
        return r.status_code, r.content

    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(one, ats))
    codes = {code for code, _ in results}
    assert codes <= {200, 404}, codes
    assert sum(1 for code, _ in results if code == 200) > 40 and sum(1 for code, _ in results if code == 404) > 20
    assert all(body in GARBAGE_JPEGS for code, body in results if code == 200), "served as stored bytes, never re-encoded"
    assert peak[0] <= 2, f"at most two grabs at once, saw {peak[0]}"
    assert c.get("/api/v1/health/summary").status_code == 200


# ------------------------------------------------------------------------------------------------------------- relay

def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Upstream:
    """A fake go2rtc `/api/ws`: answers the client's text request, then streams binary chunks until the peer goes away."""

    def __init__(self) -> None:
        self.open = 0
        self.total = 0
        self.port = _free_port()

    async def handler(self, ws) -> None:
        self.open += 1
        self.total += 1
        try:
            try:
                await asyncio.wait_for(ws.recv(), 2)
            except Exception:  # noqa: BLE001
                pass
            chunk = b"\x00\x00\x00\x18ftypiso5" + b"\x11" * 4000
            while True:
                await ws.send(chunk)
                await asyncio.sleep(0.005)
        except Exception:  # noqa: BLE001 - the relay went away
            pass
        finally:
            self.open -= 1


def _impls() -> list[tuple[str, str]]:
    out = [("asyncio", "h11")]
    if importlib.util.find_spec("httptools"):
        out.append(("asyncio", "httptools"))
    out.append(("uvloop", "httptools"))
    return out


@pytest.mark.parametrize("loop,http", _impls())
def test_relay_survives_rapid_open_supersede_and_abrupt_drops(loop, http):
    if loop == "uvloop" and not importlib.util.find_spec("uvloop"):
        pytest.skip("uvloop is not installed on this platform (Windows): NOT_RUN here, run on the Linux runner")
    if http == "httptools" and not importlib.util.find_spec("httptools"):
        pytest.skip("httptools is not installed")
    import uvicorn
    import websockets
    from fastapi import FastAPI

    from smplwise.services.relay import relay_ws

    up = Upstream()
    generation = {"n": 0}
    reasons: list[str] = []
    client_errors: list[str] = []
    app = FastAPI()

    @app.get("/ping")
    def ping() -> dict:
        return {"ok": True}

    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket) -> None:
        my_gen = generation["n"]
        await websocket.accept()
        try:
            reason = await relay_ws(websocket, f"ws://127.0.0.1:{up.port}/api/ws", {}, lambda n: None, should_stop=lambda: generation["n"] != my_gen)
        except Exception as exc:  # noqa: BLE001
            reason = type(exc).__name__
        reasons.append(reason)
        try:
            await websocket.close(code=4410 if reason == "superseded" else 1000)
        except Exception:  # noqa: BLE001
            pass

    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, loop=loop, http=http, ws="auto", log_level="warning", lifespan="off")
    server = uvicorn.Server(config)
    st = threading.Thread(target=server.run, daemon=True)

    up_loop = asyncio.new_event_loop()
    up_ready = threading.Event()
    up_stop: dict = {}

    def run_upstream() -> None:
        asyncio.set_event_loop(up_loop)

        async def main() -> None:
            up_stop["fut"] = asyncio.get_running_loop().create_future()
            async with websockets.serve(up.handler, "127.0.0.1", up.port, max_size=None):
                up_ready.set()
                await up_stop["fut"]

        up_loop.run_until_complete(main())
        up_loop.close()

    ut = threading.Thread(target=run_upstream, daemon=True)
    ut.start()
    assert up_ready.wait(10)
    st.start()
    deadline = time.time() + 15
    while not server.started and time.time() < deadline:
        time.sleep(0.05)
    assert server.started

    async def client(i: int) -> None:
        try:
            async with websockets.connect(f"ws://127.0.0.1:{port}/ws", max_size=None, open_timeout=5) as ws:
                await ws.send('{"type":"mse","value":"avc1.640029"}')
                got = 0
                end = time.time() + (2.5 if i % 5 == 4 else 0.05 + (i % 4) * 0.08)  # the long ones live through a seek
                while time.time() < end:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), 0.5)
                    except Exception:  # noqa: BLE001 - superseded / closed
                        break
                    got += len(msg) if isinstance(msg, bytes) else 0
                if i % 4 == 0:
                    generation["n"] += 1  # a seek: the open sockets of the old generation are superseded
                if i % 3 == 0:
                    ws.transport.abort()  # the browser tab dropped without a close handshake
        except Exception as exc:  # noqa: BLE001 - the server may close a superseded socket first
            client_errors.append(f"{type(exc).__name__}:{getattr(getattr(exc, "response", None), "status_code", "")}")

    async def storm() -> None:
        for wave in range(10):
            await asyncio.gather(*(client(wave * 8 + k) for k in range(8)))

    try:
        asyncio.run(storm())
        deadline = time.time() + 20
        while up.open and time.time() < deadline:
            time.sleep(0.1)
        assert up.open == 0, f"{up.open} upstream sockets still open after the storm"
        assert up.total >= 60, (up.total, reasons[:5], client_errors[:5])
        import httpx

        assert httpx.get(f"http://127.0.0.1:{port}/ping", timeout=5).json() == {"ok": True}, "the server still answers"
        assert reasons and "superseded" in reasons and set(reasons) <= {"superseded", "client_closed", "upstream_closed", "WebSocketDisconnect", "ConnectionClosedError", "ConnectionClosedOK", "ended"}, set(reasons)
    finally:
        server.should_exit = True
        st.join(10)
        up_loop.call_soon_threadsafe(up_stop["fut"].set_result, None)
        ut.join(5)
