"""W10CLIENT-295: the talk pump - Arx's browser audio frames into WisKey's signed `media/talk_frame` batches.

One `TalkPump` serves one talk on its own dedicated connection (`MediaLink`). It is the ONLY sender on that link, and it keeps the
rules read from WisKey's code (not yet run against it):

- ONE signed request at a time (floor, frames, heartbeat all go through one worker): WisKey refuses a `floor` while a batch is being
  pushed and a batch while another is (`source_changed`), and its handlers may run concurrently, so Arx never relies on arrival order.
- Sequence: a batch is `BATCH` consecutive frames (5 by default = 100 ms), `seq` starts at 0, is assigned when the batch is SENT (not
  when the frame arrived) and must equal the `next_seq` of the answer; any mismatch ends the talk.
- Floor first: frames before the answer to `floor(held=true)` are dropped; a release sends what is queued, pads the last partial batch
  with mu-law silence to a whole batch, then `floor(held=false)`.
- Backpressure: at most ONE full batch waits behind the one in flight; a newer batch replaces an older waiting one (audio is dropped,
  never queued - latency is bounded). Batches are never sent faster than real time (one per `BATCH * 20 ms` at the earliest), because
  WisKey meters them with a credit bucket (capacity 2, 10 per second, a batch of 5 costs one).
- No retry, ever: an answer that does not arrive within `frame_timeout_s` (`media_outcome_unknown`), a refusal, or an answer that does
  not match the batch ends the talk; the batch is consumed on WisKey's side before its reply and must never replay old speech.
- Heartbeat: WisKey ends a talk that has seen no signed request for 12 s and expires the principal of the last request after at most
  15 s, so while the talk is open and idle a `talk_floor(held=<current>)` goes out at least every `heartbeat_s` (5 s). (Read from the
  code; it needs a synthetic check on WisKey's side.)

Audio is never kept, logged or put into an error: a frame lives in the batch until it is sent."""
from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from collections.abc import Callable
from typing import Any

from . import wiskey_media_contract as w10
from .wiskey_media_bridge import MediaBridgeError, MediaLink

log = logging.getLogger("smplwise.intercom.media.pump")


class TalkPump:
    HEARTBEAT_S = 5.0
    FRAME_TIMEOUT_S = 1.5
    FLOOR_TIMEOUT_S = 5.0
    MAX_WAITING_BATCHES = 1

    def __init__(self, link: MediaLink, talk_ref: str, *, on_end: Callable[[str], None], batch: int = w10.BATCH_FRAMES,
                 frame_s: float = 0.02, heartbeat_s: float = HEARTBEAT_S, frame_timeout_s: float = FRAME_TIMEOUT_S,
                 floor_timeout_s: float = FLOOR_TIMEOUT_S, clock: Callable[[], float] = time.monotonic) -> None:
        if batch not in w10.BATCH_SIZES:
            raise ValueError("batch")
        self.link = link
        self.ref = talk_ref
        self.batch = batch
        self.interval = batch * frame_s
        self.heartbeat_s = heartbeat_s
        self.frame_timeout_s = frame_timeout_s
        self.floor_timeout_s = floor_timeout_s
        self._clock = clock
        self._on_end = on_end
        self._seq = 0
        self._held = False  # the floor as WisKey has acknowledged it
        self._target = False  # the floor as asked
        self._buffer: list[bytes] = []
        self._ready: deque[list[bytes]] = deque()
        self._waiters: list[tuple[bool, asyncio.Future[None]]] = []
        self._wake = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._last_signed = clock()
        self._next_batch_at = 0.0
        self.ended = False
        self.end_code: str | None = None
        self.closed_by_wiskey = False
        # counters (never audio)
        self.sent_batches = 0
        self.sent_frames = 0
        self.padded_frames = 0
        self.dropped_frames = 0
        self.dropped_batches = 0
        self.dropped_not_held = 0
        self.dropped_bad_size = 0
        self.heartbeats = 0

    @property
    def seq(self) -> int:
        return self._seq

    @property
    def held(self) -> bool:
        return self._held

    def start(self) -> None:
        self._last_signed = self._clock()
        self._task = asyncio.get_running_loop().create_task(self._run())

    # ------------------------------------------------------------ intake (the browser side; same loop, never blocks)

    def push(self, frame: bytes) -> None:
        """One 160-byte frame from the browser. Dropped (and counted) unless the floor is held and acknowledged."""
        if self.ended or not self._held or not self._target:
            self.dropped_not_held += 1
            return
        if len(frame) != w10.FRAME_BYTES:
            self.dropped_bad_size += 1
            return
        self._buffer.append(bytes(frame))
        if len(self._buffer) >= self.batch:
            full, self._buffer = self._buffer[: self.batch], self._buffer[self.batch:]
            if len(self._ready) >= self.MAX_WAITING_BATCHES:
                old = self._ready.popleft()
                self.dropped_batches += 1
                self.dropped_frames += len(old)
            self._ready.append(full)
            self._wake.set()

    async def set_floor(self, held: bool) -> None:
        """Ask for the floor (or release it); returns when WisKey has answered it, it was superseded, or the talk ended."""
        if self.ended:
            return
        self._target = bool(held)
        waiter: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        self._waiters.append((bool(held), waiter))
        self._wake.set()
        await waiter

    # ------------------------------------------------------------ the worker

    def _resolve_waiters(self) -> None:
        keep: list[tuple[bool, asyncio.Future[None]]] = []
        for wanted, fut in self._waiters:
            if self.ended or wanted == self._held or wanted != self._target:
                if not fut.done():
                    fut.set_result(None)
            else:
                keep.append((wanted, fut))
        self._waiters = keep

    def _finish(self, reason: str, code: str | None = None) -> None:
        if self.ended:
            return
        self.ended = True
        self.end_code = code
        self._ready.clear()
        self._buffer.clear()
        self._resolve_waiters()
        self._wake.set()
        try:
            self._on_end(reason)
        except Exception:  # noqa: BLE001
            log.warning("station media: the talk end handler failed")

    def remote_closed(self, reason: str) -> None:
        """WisKey ended the talk (`media/talk_closed`): no more requests are made for it."""
        self.closed_by_wiskey = True
        self._finish("upstream_closed", code=reason)

    def fail(self, code: str) -> None:
        """The connection is gone (or failed): the talk is over; WisKey cannot be told."""
        self._finish("upstream_closed", code=code)

    async def stop(self) -> None:
        """Ends the worker and waits for it; whatever request it had in flight is abandoned (not retried)."""
        if not self.ended:
            self._finish("stopped")
        task, self._task = self._task, None
        if task is not None and task is not asyncio.current_task():
            task.cancel()
            try:
                await task
            except BaseException:  # noqa: BLE001 - cancelled or failed: either way it is over
                pass

    def _pick(self) -> Callable[[], Any] | None:
        if self._target != self._held:
            if not self._target and self._held:
                if self._ready:
                    return lambda: self._send(self._ready.popleft())
                if self._buffer:
                    return self._send_padded
            return lambda: self._floor(self._target)
        if self._held and self._ready:
            return lambda: self._send(self._ready.popleft())
        if self._clock() - self._last_signed >= self.heartbeat_s:
            return self._heartbeat
        return None

    def _idle_s(self) -> float:
        return max(0.001, self._last_signed + self.heartbeat_s - self._clock())

    async def _run(self) -> None:
        try:
            while not self.ended:
                self._wake.clear()
                step = self._pick()
                if step is None:
                    try:
                        await asyncio.wait_for(self._wake.wait(), self._idle_s())
                    except asyncio.TimeoutError:
                        pass
                    continue
                await step()
                self._resolve_waiters()
        except asyncio.CancelledError:
            raise
        except MediaBridgeError as exc:
            self._finish("upstream_closed", code=exc.code)
        except w10.ContractError as exc:
            self._finish("upstream_closed", code=exc.code)
        except Exception as exc:  # noqa: BLE001 - nothing escapes the worker; the talk ends
            log.warning("station media: the talk pump failed (%s)", type(exc).__name__)
            self._finish("upstream_closed", code="pump_error")

    async def _send_padded(self) -> None:
        rest, self._buffer = self._buffer, []
        pad = self.batch - len(rest)
        self.padded_frames += pad
        await self._send(rest + [w10.SILENCE_PCMU] * pad)

    async def _send(self, frames: list[bytes]) -> None:
        wait = self._next_batch_at - self._clock()
        if wait > 0:
            await asyncio.sleep(wait)
        if self.ended:
            return
        first = self._seq
        params = w10.talk_frame_params(self.ref, first, frames)
        now = self._last_signed = self._clock()
        self._next_batch_at = now + self.interval
        result = await self.link.call(w10.TALK_FRAME, params, timeout=self.frame_timeout_s)
        ack = w10.parse_frame_ack(result, first_seq=first, count=len(frames))
        self._seq = ack.next_seq
        self.sent_batches += 1
        self.sent_frames += len(frames)

    async def _floor(self, held: bool) -> None:
        params = w10.talk_floor_params(self.ref, held)
        self._last_signed = self._clock()
        result = await self.link.call(w10.TALK_FLOOR, params, timeout=self.floor_timeout_s)
        if w10.parse_floor(result, held=held) != self._seq:
            raise w10.ContractError("floor_seq_mismatch")
        if held and not self._held:
            self._buffer.clear()
            self._ready.clear()
            self._next_batch_at = 0.0
        self._held = held
        if not held:
            self._buffer.clear()
            self._ready.clear()

    async def _heartbeat(self) -> None:
        self.heartbeats += 1
        await self._floor(self._held)
