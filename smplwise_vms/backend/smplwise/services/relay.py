"""Bidirectional WebSocket relay between an authorized browser socket and go2rtc's `/api/ws`.

Used by the live endpoint and by playback sessions. The browser never learns the upstream address;
binary media frames are counted through `on_down`. Returns a short reason string when either side
closes; raises for upstream failures so the caller can tell the client."""
from __future__ import annotations

import asyncio
import contextlib
from typing import Awaitable, Callable

from fastapi import WebSocket


async def relay_ws(websocket: WebSocket, upstream_url: str, headers: dict[str, str], on_down: Callable[[int], None], should_stop: Callable[[], bool] | None = None) -> str:
    import websockets

    async with websockets.connect(upstream_url, additional_headers=headers, max_size=None, open_timeout=8, ping_interval=20) as upstream:

        async def pump_down() -> str:
            async for msg in upstream:
                if isinstance(msg, (bytes, bytearray)):
                    on_down(len(msg))
                    await websocket.send_bytes(bytes(msg))
                else:
                    await websocket.send_text(msg)
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

        tasks = [asyncio.create_task(pump_down()), asyncio.create_task(pump_up())]
        if should_stop:
            tasks.append(asyncio.create_task(watch()))
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
