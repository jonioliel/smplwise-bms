"""Bounded fail-closed fragmented MP4 track inspection for video-only MSE.

MIME and codec negotiation alone cannot prove absence of incoming audio. Bytes
are held until the actual init's every track is video; each later fragment must
name only those original video track IDs. This is not a decoder or transcoder.
"""

from __future__ import annotations

MAX_INIT = 4 * 1024 * 1024
MAX_BOXES = 256


class VideoTrackError(ValueError):
    pass


def _header(data, start=0):
    if len(data) - start < 8:
        return None
    size = int.from_bytes(data[start : start + 4], "big")
    kind = bytes(data[start + 4 : start + 8])
    header = 8
    if size == 1:
        if len(data) - start < 16:
            return None
        size = int.from_bytes(data[start + 8 : start + 16], "big")
        header = 16
    if size < header or size > MAX_INIT:
        raise VideoTrackError()
    return kind, size, header


def _boxes(data, budget, depth=0):
    if depth > 8:
        raise VideoTrackError()
    offset = 0
    result = []
    while offset < len(data):
        item = _header(data, offset)
        budget[0] += 1
        if item is None or budget[0] > MAX_BOXES:
            raise VideoTrackError()
        kind, size, header = item
        if offset + size > len(data):
            raise VideoTrackError()
        result.append((kind, data[offset + header : offset + size]))
        offset += size
    return result


def _one(boxes, kind):
    found = [body for name, body in boxes if name == kind]
    if len(found) != 1:
        raise VideoTrackError()
    return found[0]


def _tracks(moov):
    budget = [0]
    tracks = set()
    top = _boxes(moov, budget)
    for kind, trak in top:
        if kind != b"trak":
            continue
        fields = _boxes(trak, budget, 1)
        tkhd = _one(fields, b"tkhd")
        if not tkhd or tkhd[0] not in {0, 1}:
            raise VideoTrackError()
        offset = 12 if tkhd[0] == 0 else 20
        if len(tkhd) < offset + 4:
            raise VideoTrackError()
        track = int.from_bytes(tkhd[offset : offset + 4], "big")
        if track == 0 or track in tracks:
            raise VideoTrackError()
        media = _boxes(_one(fields, b"mdia"), budget, 2)
        handler = _one(media, b"hdlr")
        if len(handler) < 12 or handler[8:12] != b"vide":
            raise VideoTrackError()
        # The actual sample description must also declare only video codecs.
        info = _boxes(_one(media, b"minf"), budget, 3)
        samples = _boxes(_one(info, b"stbl"), budget, 4)
        description = _one(samples, b"stsd")
        if len(description) < 8 or description[:4] != b"\0\0\0\0":
            raise VideoTrackError()
        entries = _boxes(description[8:], budget, 5)
        if (
            int.from_bytes(description[4:8], "big") != len(entries)
            or not entries
            or any(name not in {b"avc1", b"avc3", b"hvc1", b"hev1"} for name, _ in entries)
        ):
            raise VideoTrackError()
        tracks.add(track)
    if not tracks:
        raise VideoTrackError()
    return frozenset(tracks)


def _fragment(moof, tracks):
    budget = [0]
    top = _boxes(moof, budget)
    found = set()
    for kind, body in top:
        if kind != b"traf":
            continue
        fields = _boxes(body, budget, 1)
        header = _one(fields, b"tfhd")
        if len(header) < 8 or header[0] != 0:
            raise VideoTrackError()
        track = int.from_bytes(header[4:8], "big")
        if track not in tracks or track in found:
            raise VideoTrackError()
        found.add(track)
    if not found:
        raise VideoTrackError()


class VideoOnlyMP4:
    def __init__(self):
        self._buffer = bytearray()
        self._init = bytearray()
        self._tracks = None
        self._file_type = False
        self._init_boxes = 0
        self._fragment = False
        self._failed = False

    def feed(self, data: bytes) -> tuple[bytes, ...]:
        if self._failed:
            raise VideoTrackError()
        try:
            if type(data) is not bytes or not data or len(data) > MAX_INIT:
                raise VideoTrackError()
            if len(self._buffer) + len(self._init) + len(data) > MAX_INIT:
                raise VideoTrackError()
            self._buffer.extend(data)
            output = []
            boxes = 0
            while self._buffer:
                item = _header(self._buffer)
                if item is None:
                    break
                kind, size, header = item
                if len(self._buffer) < size:
                    break
                box = bytes(self._buffer[:size])
                del self._buffer[:size]
                body = box[header:]
                boxes += 1
                if boxes > MAX_BOXES:
                    raise VideoTrackError()
                if self._tracks is None:
                    self._init_boxes += 1
                    if self._init_boxes > MAX_BOXES:
                        raise VideoTrackError()
                    if kind == b"ftyp" and not self._file_type and len(body) >= 8:
                        self._file_type = True
                    elif kind == b"moov" and self._file_type:
                        self._tracks = _tracks(body)
                    elif kind not in {b"free", b"skip"}:
                        raise VideoTrackError()
                    self._init.extend(box)
                    if len(self._init) > MAX_INIT:
                        raise VideoTrackError()
                    if self._tracks is not None:
                        output.append(bytes(self._init))
                        self._init.clear()
                else:
                    if kind == b"moof" and not self._fragment:
                        _fragment(body, self._tracks)
                        self._fragment = True
                    elif kind == b"mdat" and self._fragment:
                        self._fragment = False
                    elif kind not in {b"styp", b"sidx", b"emsg", b"prft", b"free"}:
                        raise VideoTrackError()
                    output.append(box)
            return tuple(output)
        except (ValueError, TypeError, OverflowError):
            self._failed = True
            self._buffer.clear()
            self._init.clear()
            raise VideoTrackError() from None
