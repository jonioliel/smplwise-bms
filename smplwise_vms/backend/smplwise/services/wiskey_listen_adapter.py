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

CONTRACT_STATE = "pending WisKey downlink contract"  # shown in the runbook and the audit of a refused start, never to an operator
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
        self.received_frames += 1
        while self._queue.qsize() >= self._queue_frames:
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:  # pragma: no cover - single loop
                break
            self.dropped_frames += 1
        self._queue.put_nowait(frame)

    def _end(self, reason: str) -> None:
        fut = self._future()
        if not fut.done():
            fut.set_result(reason)
        self._queue.put_nowait(None)

    async def frames(self) -> AsyncIterator[bytes]:
        while True:
            frame = await self._queue.get()
            if frame is None:
                return
            yield frame

    async def wait_closed(self) -> str:
        return await self._future()

    async def close(self, reason: str) -> None:
        self._end(reason)


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
        self.opened = 0
        self.closed_with: list[str] = []

    async def open(self) -> None:
        self._future()
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
        task, self._task = self._task, None
        if task is not None and not task.done():
            task.cancel()
        await super().close(reason)


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

    @classmethod
    def for_talk(cls, receive: Callable[[], Awaitable[bytes]]) -> "ReceiveDownlink":
        """The station's sound of one talk (`arx.station_talk_audio.v1`): 800-byte packets passed whole, newest wins (3 waiting)."""
        return cls(receive, frame_bytes=TALK_PACKET_BYTES, max_packet_bytes=TALK_PACKET_BYTES, queue_frames=TALK_QUEUE_PACKETS)

    async def open(self) -> None:
        self._future()
        self._task = asyncio.get_running_loop().create_task(self._pump())

    async def _pump(self) -> None:
        try:
            while True:
                packet = await self._receive()
                for frame in split_frames(bytes(packet), self._frame_bytes, self._max_packet_bytes):
                    self._offer(frame)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - the text of an upstream error is never kept
            self._end("upstream_closed")

    async def close(self, reason: str) -> None:
        task, self._task = self._task, None
        if task is not None and not task.done():
            task.cancel()
        if self._on_close is not None:
            try:
                result = self._on_close(reason)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:  # noqa: BLE001
                log.warning("listen: the downlink close handler failed")
        await super().close(reason)


class WiskeyDownlinkChannel:
    """PENDING (CONTRACT_STATE): the LISTEN-ONLY downlink (no microphone) over WisKey's signed direct link. Opening it answers
    `downlink_pending`, so a real station can never be listened to through a guess.

    WKF01F02-295: the station's sound now arrives INSIDE a two-way talk (`talk_open(listen=true)`, `arx.station_talk_audio.v1`,
    `WiskeyBridgeTalkChannel.receive_audio` wrapped in `ReceiveDownlink.for_talk`). Whether the same `talk_open(listen=true)` may serve a
    listener without floor, frames or microphone, whether it takes the station's single talk slot, and what it answers while another talk is
    active are WisKey's open answers (Arx reply section 8, addendum F02 item 2); until they come this listen-only channel stays refused."""

    def __init__(self, *_args: object, **_kwargs: object) -> None:
        self._unused = _Downlink()

    async def open(self) -> None:
        raise ListenUnavailable("downlink_pending")

    def frames(self) -> AsyncIterator[bytes]:
        return self._unused.frames()

    async def wait_closed(self) -> str:
        return await self._unused.wait_closed()

    async def close(self, reason: str) -> None:
        await self._unused.close(reason)
