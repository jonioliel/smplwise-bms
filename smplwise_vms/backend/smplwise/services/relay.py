"""Bidirectional WebSocket relay between an authorized browser socket and go2rtc's `/api/ws`.

Used by the live endpoint and by playback sessions. The browser never learns the upstream address;
binary media frames are counted through `on_down`. Returns a short reason string when either side
closes; raises for upstream failures so the caller can tell the client."""
from __future__ import annotations

import asyncio
import contextlib
from typing import Awaitable, Callable

from fastapi import WebSocket


async def relay_ws(websocket: WebSocket, upstream_url: str, headers: dict[str, str], on_down: Callable[[int], None], should_stop: Callable[[], bool] | None = None,
                   on_text: Callable[[str], str | None] | None = None, stop_event: asyncio.Event | None = None,
                   close_timeout: float | None = None) -> str:
    """`on_text`: sees every text frame from go2rtc before it reaches the browser and returns the text to send (None drops it) -
    a source that must not leak its own error texts (a Home Assistant camera's, ha_camera_streams.sanitize_frame) rewrites here.
    `stop_event` (PLAYBACK-SCRUB-2341): set from another thread (loop.call_soon_threadsafe) to stop at once - a seek waits for this
    relay to return, i.e. for its upstream socket to be closed by the `async with` below, before it deletes the go2rtc stream.
    `close_timeout`: how long the close handshake with go2rtc may take before the connection is dropped (None = the library's 10 s);
    a stopped relay stops reading, so a go2rtc still sending media can hold the handshake up - playback bounds it below the seek's wait."""
    import websockets

    extra = {"close_timeout": close_timeout} if close_timeout is not None else {}
    async with websockets.connect(upstream_url, additional_headers=headers, max_size=None, open_timeout=8, ping_interval=20, **extra) as upstream:

        async def pump_down() -> str:
            async for msg in upstream:
                if isinstance(msg, (bytes, bytearray)):
                    on_down(len(msg))
                    await websocket.send_bytes(bytes(msg))
                else:
                    text = on_text(msg) if on_text else msg
                    if text is not None:
                        await websocket.send_text(text)
            return "upstream_closed"

        async def pump_up() -> str:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    return "client_closed"
                if message.get("text") is not None:
                    await upstream.send(message["text"])
                elif message.get("bytes") is not None:
                    await upstream.send(message["bytes"])

        async def watch() -> str:
            while True:
                await asyncio.sleep(1)
                if should_stop and should_stop():
                    return "superseded"

        async def stopped() -> str:
            assert stop_event is not None
            await stop_event.wait()
            return "superseded"

        tasks = [asyncio.create_task(pump_down()), asyncio.create_task(pump_up())]
        if should_stop:
            tasks.append(asyncio.create_task(watch()))
        if stop_event is not None:
            tasks.append(asyncio.create_task(stopped()))
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
            with contextlib.suppress(BaseException):
                await task
        reason = "ended"
        for task in done:
            exc = task.exception()
            reason = type(exc).__name__ if exc else str(task.result())
        return reason


RelayCallback = Callable[[], Awaitable[None]]
