"""Bounded W10 v1.1 batches for the original 800-byte native audio sink.

Five160-byte frames/100ms require1200 signed requests per120s, within the
existing4096-nonce window. Audio contents never enter repr, errors or receipts.
"""

from __future__ import annotations

import base64
import binascii
import time
import weakref
from dataclasses import dataclass

FRAME_BYTES = 160
FRAMES_PER_PACKET = 5
MAX_BATCH_FRAMES = 10
MAX_SEQUENCE = 2**53 - 1
_STATES = weakref.WeakKeyDictionary()


class MediaFrameError(Exception):
    def __init__(self, code):
        super().__init__("Station audio batch refused")
        self.code = code


@dataclass(repr=False)
class _State:
    clock: object
    sequence: int = 0
    held: bool = False
    active: bool = True
    pushing: bool = False
    last: float | None = None
    credit: float = 2.0


class BridgeFrameIngress:
    def __init__(self, *, clock=time.monotonic):
        _STATES[self] = _State(clock)

    @property
    def next_sequence(self):
        return _STATES[self].sequence

    def floor(self, held):
        state = _STATES[self]
        if type(held) is not bool:
            raise MediaFrameError("invalid_fields")
        if not state.active or state.pushing:
            raise MediaFrameError("source_changed")
        state.held = held

    def close(self):
        state = _STATES[self]
        state.active, state.held = False, False

    def push(self, frames, *, send, guard):
        state = _STATES[self]
        if not state.active or state.pushing:
            raise MediaFrameError("source_changed")
        if not state.held:
            raise MediaFrameError("floor_not_held")
        state.pushing = True
        try:
            if guard() is not None:
                raise MediaFrameError("source_changed")
            if type(frames) is not list or len(frames) not in {5, 10}:
                raise MediaFrameError("invalid_fields")
            if state.sequence + len(frames) > MAX_SEQUENCE:
                raise MediaFrameError("sequence_invalid")
            packets = []
            packet = bytearray()
            for index, frame in enumerate(frames):
                if (
                    type(frame) is not dict
                    or set(frame) != {"seq", "data"}
                    or type(frame["seq"]) is not int
                    or frame["seq"] != state.sequence + index
                    or not 0 <= frame["seq"] <= MAX_SEQUENCE
                ):
                    raise MediaFrameError("sequence_invalid")
                value = frame["data"]
                if type(value) is not str or len(value) != 216:
                    raise MediaFrameError("invalid_fields")
                try:
                    decoded = base64.b64decode(value, validate=True)
                except (ValueError, binascii.Error):
                    raise MediaFrameError("invalid_fields") from None
                if (
                    len(decoded) != FRAME_BYTES
                    or base64.b64encode(decoded).decode("ascii") != value
                ):
                    raise MediaFrameError("invalid_fields")
                packet.extend(decoded)
                if len(packet) == FRAME_BYTES * FRAMES_PER_PACKET:
                    packets.append(bytes(packet))
                    packet.clear()
            now = state.clock()
            if state.last is not None and now < state.last:
                raise MediaFrameError("source_changed")
            credit = (
                min(2.0, state.credit + (now - state.last) * 10)
                if (state.last is not None)
                else state.credit
            )
            if credit + 1e-9 < len(packets):
                raise MediaFrameError("rate_limited")
            if guard() is not None or not state.active or not state.held:
                raise MediaFrameError("source_changed")
            # Consume the complete batch before crossing the sink boundary.
            # Partial acceptance or a lost reply must never replay old speech.
            state.sequence += len(frames)
            state.last, state.credit = now, max(0.0, credit - len(packets))
            try:
                for packet in packets:
                    if not state.active or not state.held or guard() is not None:
                        raise MediaFrameError("source_changed")
                    if send(packet) is not None:
                        raise MediaFrameError("source_changed")
                    if guard() is not None:
                        raise MediaFrameError("source_changed")
            except BaseException as error:
                state.active, state.held = False, False
                if not isinstance(error, Exception):
                    raise
                raise MediaFrameError("media_outcome_unknown") from None
            return {
                "next_seq": state.sequence,
                "accepted_frames": len(frames),
                "retry_permitted": False,
            }
        finally:
            state.pushing = False
