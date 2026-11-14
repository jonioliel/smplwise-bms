"""Playback commands for the fake Provision-ISR device (CR-025 P3), kept out of `fake_provision.py` so the two branches do
not collide. `FakeProvisionPlayback` is a `FakeProvision` that also answers `GetRecordType`, `SearchRecordDate`,
`SearchByTime` and `GetSnapshotByTime` - with the shapes the owner's NVR answered on 2026-10-04 (read-only session,
private-evidence/provision-isr-live/*-playback/), invented values:

- `SearchByTime`: oldest first, at most `max_items` (device: 1000) items, `count` = items returned, no `maxCount`, no
  `endtime` (`with_endtime = True` gives the v2 shape), items CLIPPED to the query window, an empty window = HTTP 400
  errorCode 3; only the asked `recTypes` are returned;
- `SearchRecordDate`: dates without zero padding (`2026-9-19`) when `shape == "live"`;
- `GetSnapshotByTime`: `image/h264` Annex-B bytes inside a recording, HTTP 400 errorCode 3 (`image/png`!) in a gap;
- `GetDateAndTime`: the POSIX rule `tz_rule` with `daylight` and the wall clock `now_wall`.

Recordings are given in the device's wall clock, in device order: `recordings = {channel: [(wall start, seconds, recType)]}`.
`search_bodies` keeps every SearchByTime request body; playback commands never count as writes."""
from __future__ import annotations

import datetime as dt
import re

import httpx

from fake_provision import NS, FakeProvision, _doc

PLAYBACK = {"GetRecordType", "SearchRecordDate", "SearchByTime", "GetSnapshotByTime"}
H264_KEYFRAME = b"\x00\x00\x00\x01\x67\x64\x00\x28fake-sps\x00\x00\x00\x01\x68fake-pps\x00\x00\x00\x01\x65" + b"\x88" * 64
FAIL3 = f'<?xml version="1.0" encoding="UTF-8"?>\n<config version="1.0" {NS} status="failed" errorCode="3"></config>'


def _wall(text: str) -> dt.datetime:
    m = re.match(r"\s*(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})", text)
    if not m:
        raise ValueError(text)
    return dt.datetime(*(int(x) for x in m.groups()))


def _field(body: str, name: str) -> str | None:
    m = re.search(rf"<{name}[^>]*>\s*(?:<!\[CDATA\[)?([^<\]]*)", body)
    return m.group(1).strip() if m else None


class FakeProvisionPlayback(FakeProvision):
    def reset(self) -> None:
        super().reset()
        self.recordings: dict[int, list[tuple[str, int, str]]] = {}
        self.record_types = ["manual", "schedule", "motion", "sensor", "intel detection"]
        self.record_type_missing = False
        self.max_items = 1000
        self.with_endtime = False
        self.tz_rule = "IST-2IDT,M3.5.5/2,M10.5.0/2"
        self.daylight = True
        self.now_wall = "2026-10-04 20:18:00"
        self.snapshot_kind = "h264"
        self.search_bodies: list[str] = []

    def handle(self, request: httpx.Request) -> httpx.Response:
        response = super().handle(request)
        parts = [p for p in request.url.path.split("/") if p]
        if parts and parts[0] in PLAYBACK and self.writes and self.writes[-1] == parts[0]:
            self.writes.pop()  # a playback command is a read
        return response

    # ------------------------------------------------------------------ commands
    def _GetRecordType(self, request: httpx.Request, ch: int) -> httpx.Response:
        if self.record_type_missing:
            return self._xml(request, '<?xml version="1.0" encoding="utf-8"?><config status="failed" errorCode="1"/>', 400)
        items = "".join(f"<item>{t}</item>" for t in self.record_types)
        return self._xml(request, _doc(f'<recTypeCaps type="list" count="{len(self.record_types)}"><itemType type="string" maxLen="20"></itemType>{items}</recTypeCaps>', "1.0"))

    def _segments(self, ch: int) -> list[tuple[dt.datetime, int, str]]:
        return [(_wall(w), int(s), t) for w, s, t in self.recordings.get(ch, [])]

    def _SearchRecordDate(self, request: httpx.Request, ch: int) -> httpx.Response:
        days = sorted({w.date() for w, _s, _t in self._segments(ch)})
        if not days:
            return self._xml(request, FAIL3, 400)
        fmt = (lambda d: f"{d.year}-{d.month}-{d.day}") if self.shape == "live" else (lambda d: f"<![CDATA[{d.isoformat()}]]>")
        items = "".join(f"<item>{fmt(d)}</item>\n" for d in days)
        return self._xml(request, _doc(f'<dateList type="list" count="{len(days)}">{items}</dateList>', "1.0"))

    def _SearchByTime(self, request: httpx.Request, ch: int) -> httpx.Response:
        body = request.content.decode("utf-8")
        self.search_bodies.append(body)
        types = set(re.findall(r"<item>(?:<!\[CDATA\[)?([^<\]]+)", body))
        try:
            ws, we = _wall(_field(body, "starttime") or ""), _wall(_field(body, "endtime") or "")
        except ValueError:
            return self._xml(request, FAIL3, 400)
        if we <= ws:
            return self._xml(request, FAIL3, 400)
        found = []
        for w, s, t in self._segments(ch):
            e = w + dt.timedelta(seconds=s)
            if t not in types or e <= ws or w >= we:
                continue
            cs, ce = max(w, ws), min(e, we)  # live: clipped to the query window
            found.append((cs, int((ce - cs).total_seconds()), t, ce))
        if not found:
            return self._xml(request, FAIL3, 400)
        found = found[: self.max_items]
        items = []
        for cs, secs, t, ce in found:
            end = f'<endtime type="string"><![CDATA[{ce:%Y-%m-%d %H:%M:%S}]]></endtime>' if self.with_endtime else ""
            items.append(f'<item><starttime type="string" seconds="{secs}" recType="{t}"><![CDATA[{cs:%Y-%m-%d %H:%M:%S}]]></starttime>{end}\n</item>')
        return self._xml(request, _doc(f'<timesectionList type="list" count="{len(found)}">{"".join(items)}</timesectionList>', "1.0"))

    def _GetSnapshotByTime(self, request: httpx.Request, ch: int) -> httpx.Response:
        body = request.content.decode("utf-8")
        try:
            at = _wall(_field(body, "time") or "")
        except ValueError:
            return self._xml(request, FAIL3, 400)
        if not any(w <= at < w + dt.timedelta(seconds=s) for w, s, _t in self._segments(ch)):
            return httpx.Response(400, content=FAIL3.encode(), headers={"Content-Type": "image/png"}, request=request)
        if self.snapshot_kind == "jpeg":
            from fake_provision import JPEG

            return httpx.Response(200, content=JPEG, headers={"Content-Type": "image/jpeg"}, request=request)
        return httpx.Response(200, content=H264_KEYFRAME, headers={"Content-Type": "image/h264"}, request=request)

    def _GetDateAndTime(self, request: httpx.Request, ch: int) -> httpx.Response:
        return self._xml(request, _doc(
            '<time><timezoneInfo>'
            f'<timeZone type="string"><![CDATA[{self.tz_rule}]]></timeZone><daylightSwitch type="boolean">{str(self.daylight).lower()}</daylightSwitch>'
            '</timezoneInfo><synchronizeInfo><type type="synchronizeType">NTP</type>'
            f'<currentTime type="string"><![CDATA[{self.now_wall}]]></currentTime></synchronizeInfo></time>', "1.0"))


def motion_day(day: str, start: str = "08:00:00", count: int = 10, seconds: int = 60, gap: int = 30, kind: str = "motion") -> list[tuple[str, int, str]]:
    """`count` recordings of `seconds` every `seconds + gap` from `day start` (wall clock)."""
    t = _wall(f"{day} {start}")
    out = []
    for _ in range(count):
        out.append((f"{t:%Y-%m-%d %H:%M:%S}", seconds, kind))
        t += dt.timedelta(seconds=seconds + gap)
    return out


__all__ = ["FakeProvisionPlayback", "motion_day", "H264_KEYFRAME", "PLAYBACK"]
