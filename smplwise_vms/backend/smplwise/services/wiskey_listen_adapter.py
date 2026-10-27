"""WKAUDIN-295: station audio TO Arx ("listen") - THE ONE adapter between WisKey's downlink and Arx. PENDING WisKey's downlink contract.

WisKey states (09_arx_decisions_mac_continuation/LIVE_STREAMS_AND_TALK_HE.md, 24.10) that its engine has `client.audio.AudioSession.receive`
but that `BridgeTalkSession.run` neither reads it nor publishes a downlink, and that the MSE path with a native permit is video only. The
contract of the downlink (command name, frame batching, codec negotiation, end events) is NOT published. This file is where Arx will
change when it is; everything else (session registry, router, browser) talks only to the `ListenChannel` protocol below.

What is assumed (every item is a PENDING assumption, named here and nowhere else):
- the packets are G.711 mu-law, 8 kHz mono, as `AudioSession.receive()` returns them: `bytes`, one packet per call, `b""` when nothing
  arrived within its 2 s timeout (silence, NOT an end), and an `AudioError("audio_connection_lost")` when the session is gone (an end);
- a packet is whole 20 ms frames of 160 bytes (the engine's `FRAME_BYTES`); anything else is split into whole frames and a remainder is dropped;
- WisKey drops packets older than 0.3 s itself (`MAX_PACKET_AGE`), so Arx never queues audio: when the browser is slower than the station,
  the oldest frames are dropped (bounded latency), never buffered.

Rules kept here: no codec is invented, no audio engine is parallel to WisKey's (the real channel is WisKey's own `receive` over the signed
direct link, joined in `WiskeyDownlinkChannel` once the contract exists); audio is never kept, logged, counted by content or put into an
error: a frame lives in the channel's small queue until the socket sends it."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from typing import Protocol

log = logging.getLogger("smplwise.intercom.listen")

CONTRACT_STATE = "signed talk_open(listen=true), shared native audio slot"  # shown in the runbook and the audit of a refused start, never to an operator
CODEC = "pcmu"
SAMPLE_RATE = 8000
FRAME_BYTES = 160
FRAME_MS = 20
MAX_PACKET_BYTES = FRAME_BYTES * 10  # a packet larger than 200 ms is not a packet of this stream: dropped
QUEUE_FRAMES = 25  # 500 ms: bounded latency; the oldest frame goes first when the browser is slower
IDLE_FRAME_S = 2.0  # `receive()`'s own timeout: an empty read, not an end


class ListenUnavailable(Exception):
    """The downlink cannot be opened now; `code` is served as the refusal (never WisKey's text)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class ListenChannel(Protocol):
    """The upstream end of one listen session (server side only): whole 160-byte G.711 frames, newest wins."""

    async def open(self) -> None: ...

    def frames(self) -> AsyncIterator[bytes]: ...

    async def wait_closed(self) -> str: ...

    async def close(self, reason: str) -> None: ...


def split_frames(packet: bytes, frame_bytes: int = FRAME_BYTES, max_packet_bytes: int = MAX_PACKET_BYTES) -> list[bytes]:
    """A packet as whole frames. An empty packet (a timeout) is nothing; an oversize one is dropped; a partial tail is dropped."""
    if not packet or len(packet) > max_packet_bytes:
        return []
    whole = len(packet) // frame_bytes
    return [bytes(packet[i * frame_bytes:(i + 1) * frame_bytes]) for i in range(whole)]


# WKF01F02-295 (F02): the station's sound inside a talk (`arx.station_talk_audio.v1`, Mac delta be2c1c05): WisKey's native 100 ms packets of
# 800 bytes PCMU are passed whole (the talk screen's player takes exactly that packet), at most 3 waiting (300 ms, WisKey's MAX_PACKET_AGE).
TALK_PACKET_BYTES = 800
TALK_QUEUE_PACKETS = 3


class _Downlink:
    """Shared plumbing: a bounded drop-oldest frame queue and the one end reason (`wait_closed`)."""

    def __init__(self, queue_frames: int = QUEUE_FRAMES) -> None:
        self._queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._closed: asyncio.Future[str] | None = None
        self._queue_frames = queue_frames
        self.dropped_frames = 0
        self.received_frames = 0

    def _future(self) -> asyncio.Future[str]:
        if self._closed is None:
            self._closed = asyncio.get_running_loop().create_future()
        return self._closed

    def _offer(self, frame: bytes) -> None:
        if self._future().done():
            return
        self.received_frames += 1
        while self._queue.qsize() >= self._queue_frames:
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:  # pragma: no cover - single loop
                break
            self.dropped_frames += 1
        self._queue.put_nowait(frame)

    _fenced = False

    def _end(self, reason: str) -> None:
        """The producer's own end (upstream gone): nothing new is offered; frames ALREADY admitted while current still play, then the
        sentinel. WK4ADOPT-295 identified merge of reply4 R04: the drain moved to `_fence` (the close path), because draining here too
        dropped admitted frames on a natural upstream end (tests/test_wkaudin_295.py on the combined tree)."""
        fut = self._future()
        if fut.done():
            return
        fut.set_result(reason)
        self._queue.put_nowait(None)

    def _fence(self, reason: str) -> None:
        """A close: publication stops synchronously - the queue is drained and no frame is yielded after this (reply4 R04)."""
        self._fenced = True
        while not self._queue.empty():
            self._queue.get_nowait()
        fut = self._future()
        if not fut.done():
            fut.set_result(reason)
        self._queue.put_nowait(None)

    async def frames(self) -> AsyncIterator[bytes]:
        while True:
            frame = await self._queue.get()
            if frame is None or self._fenced:
                return
            yield frame

    async def wait_closed(self) -> str:
        return await asyncio.shield(self._future())

    async def close(self, reason: str) -> None:
        self._fence(reason)


class SyntheticDownlink(_Downlink):
    """FAKES ONLY (tests and SW_FAKE_STATION_MEDIA): plays a scripted list of packets like `AudioSession.receive()` would hand them over,
    then ends with `end_reason`. `gap_s` spaces the packets; `packets` may contain `b""` (a timeout) and odd sizes on purpose."""

    def __init__(self, packets: Iterable[bytes], *, gap_s: float = 0.0, end_reason: str | None = "upstream_closed", fail_open: bool = False) -> None:
        super().__init__()
        self._packets = list(packets)
        self._gap = gap_s
        self._end_reason = end_reason
        self._fail_open = fail_open
        self._task: asyncio.Task[None] | None = None
        self._close_task: asyncio.Task[None] | None = None
        self.opened = 0
        self.closed_with: list[str] = []

    async def open(self) -> None:
        if self._future().done() or self._task is not None:
            raise ListenUnavailable('downlink_closed')
        if self._fail_open:
            raise ListenUnavailable("downlink_failed")
        self.opened += 1
        self._task = asyncio.get_running_loop().create_task(self._play())

    async def _play(self) -> None:
        try:
            for packet in self._packets:
                if self._gap:
                    await asyncio.sleep(self._gap)
                for frame in split_frames(packet):
                    self._offer(frame)
                await asyncio.sleep(0)
            if self._end_reason is not None:
                self._end(self._end_reason)
        except asyncio.CancelledError:
            raise

    async def close(self, reason: str) -> None:
        self.closed_with.append(reason)
        await _join_downlink(self, reason)


class ReceiveDownlink(_Downlink):
    """The shape the real channel will have: pumps `receive()` of an AudioSession-like object (`async receive() -> bytes`) into frames.

    `b""` is silence (kept reading); an exception whose text is `audio_connection_lost` is an upstream end; any other exception is an end
    with `upstream_closed` (its text is never kept). Used with `SyntheticReceiver` in tests; the real receiver is WisKey's, over the
    signed link, joined in `WiskeyDownlinkChannel` when the contract is published.

    WKF01F02-295 (F02): also the one adapter of the station's sound INSIDE a talk - `for_talk(channel.receive_audio)` (routers/intercom_media.py
    `_pump`): whole 800-byte packets, three waiting at most."""

    def __init__(self, receive: Callable[[], Awaitable[bytes]], on_close: Callable[[str], object] | None = None, *,
                 frame_bytes: int = FRAME_BYTES, max_packet_bytes: int = MAX_PACKET_BYTES, queue_frames: int = QUEUE_FRAMES) -> None:
        super().__init__(queue_frames)
        self._receive = receive
        self._on_close = on_close
        self._frame_bytes = frame_bytes
        self._max_packet_bytes = max_packet_bytes
        self._task: asyncio.Task[None] | None = None
        self._close_task: asyncio.Task[None] | None = None

    @classmethod
    def for_talk(cls, receive: Callable[[], Awaitable[bytes]]) -> "ReceiveDownlink":
        """The station's sound of one talk (`arx.station_talk_audio.v1`): 800-byte packets passed whole, newest wins (3 waiting)."""
        return cls(receive, frame_bytes=TALK_PACKET_BYTES, max_packet_bytes=TALK_PACKET_BYTES, queue_frames=TALK_QUEUE_PACKETS)

    async def open(self) -> None:
        if self._future().done() or self._task is not None:
            raise ListenUnavailable("downlink_closed")
        self._task = asyncio.get_running_loop().create_task(self._pump())

    async def _pump(self) -> None:
        try:
            while not self._future().done():
                packet = await self._receive()
                if self._future().done():
                    return
                for frame in split_frames(bytes(packet), self._frame_bytes, self._max_packet_bytes):
                    self._offer(frame)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - the text of an upstream error is never kept
            self._end("upstream_closed")

    async def close(self, reason: str) -> None:
        await _join_downlink(self, reason)


async def _join_downlink(channel: _Downlink, reason: str) -> None:
    """Fence publication synchronously, then join the producer and close hook.

    A cancelled close caller still owns and awaits the same cleanup task. A
    receive callback must not recursively close its own producer.
    """
    channel._fence(reason)
    task = channel._task
    if task is asyncio.current_task():
        raise RuntimeError("downlink_self_join")
    if channel._close_task is None:
        async def finish() -> None:
            if task is not None:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            hook = getattr(channel, "_on_close", None)
            if hook is not None:
                result = hook(reason)
                if asyncio.iscoroutine(result):
                    await result
        channel._close_task = asyncio.create_task(finish())
    cancelled = False
    while not channel._close_task.done():
        try:
            await asyncio.shield(channel._close_task)
        except asyncio.CancelledError:
            cancelled = True
    channel._close_task.result()
    if cancelled:
        raise asyncio.CancelledError


class WiskeyDownlinkChannel:
    """Listen without microphone through the existing signed talk channel.

    Native owns the station slot, proof, deadline, idle clock and cleanup. This
    wrapper exposes no floor or uplink and only splits its verified 800-byte
    downlink into the standalone player's existing 160-byte frames.
    """

    SECURITY_ENDS = {"expired", "access_lost", "source_changed", "connection_closed", "talk_audio_invalid"}

    def __init__(self, provider=None, settings=None, descriptor=None, *,
                 actor_id=None, actor_name=None, request_id=None, expires_at=None):
        self._talk = None
        self._downlink = _Downlink()
        self._watcher = None
        self._close_task = None
        self._expires_at = expires_at
        if provider is not None and descriptor is not None and actor_id and actor_name and expires_at is not None:
            from .intercom_media import WiskeyBridgeTalkChannel
            from .wiskey_media_contract import Actor
            self._talk = WiskeyBridgeTalkChannel(provider, settings, descriptor,
                Actor(actor_id, actor_name), request_id, expires_at)

    @property
    def dropped_frames(self):
        return self._downlink.dropped_frames

    def publication_current(self):
        import time
        if self._expires_at is not None and time.time() >= self._expires_at:
            self._downlink._fence("expired")
        talk = self._talk
        reason = getattr(getattr(talk, "pump", None), "end_code", None)
        if reason in self.SECURITY_ENDS or (talk is not None and talk.link is not None and talk.link.closed):
            self._downlink._fence(reason if reason in self.SECURITY_ENDS else "connection_closed")
        return not self._downlink._fenced

    async def open(self):
        if self._talk is None:
            raise ListenUnavailable("listen_not_configured")
        if self._watcher is not None or self._close_task is not None:
            raise ListenUnavailable("downlink_closed")
        await self._talk.open()
        if not self._talk.listening:
            await self._talk.close("ended")
            raise ListenUnavailable("listen_not_offered")
        self._downlink = ReceiveDownlink(self._talk.receive_audio, self._talk.close)
        await self._downlink.open()
        self._watcher = asyncio.create_task(self._watch())

    async def _watch(self):
        await self._talk.wait_closed()
        reason = getattr(self._talk.pump, "end_code", None) or "upstream_closed"
        if reason in self.SECURITY_ENDS:
            self._downlink._fence(reason)
        else:
            self._downlink._end(reason)

    async def frames(self):
        async for frame in self._downlink.frames():
            if not self.publication_current():
                return
            yield frame

    async def wait_closed(self):
        return await self._downlink.wait_closed()

    async def close(self, reason):
        # Fence before the first await; every caller joins one cleanup owner.
        self._downlink._fence(reason)
        if self._close_task is None:
            async def finish():
                if self._watcher is not None:
                    self._watcher.cancel()
                    await asyncio.gather(self._watcher, return_exceptions=True)
                await self._downlink.close(reason)
                if self._talk is not None and not isinstance(self._downlink, ReceiveDownlink):
                    await self._talk.close(reason)
            self._close_task = asyncio.create_task(finish())
        cancelled = False
        while not self._close_task.done():
            try:
                await asyncio.shield(self._close_task)
            except asyncio.CancelledError:
                cancelled = True
        self._close_task.result()
        if cancelled:
            raise asyncio.CancelledError
