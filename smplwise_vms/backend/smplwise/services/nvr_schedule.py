"""Owner-approved NVR schedule and smart-rule writes (0.1.72): arming schedules per event type (B5), the recording
schedule of a channel's main track (C1) and the smart rules - line crossing and intrusion regions (B4). Every write
goes through `nvr_write.apply_change` (GET → mutate → PUT → verify, recorded, reversible).

Week tables: index 0 = Monday … 6 = Sunday (the ISAPI dayOfWeek 1..7 / DayOfWeek names); each day is a list of
ranges {begin: "HH:MM:SS", end: "HH:MM:SS"} (and a mode for the recording schedule). "24:00:00" is the end of day."""
from __future__ import annotations

import re
from typing import Any

from ..errors import ApiError
from .nvr_system import blocks, set_in_block, set_tag, tag

DAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
SCHEDULE_KINDS = {"motion": ("motionDetection", "VMD"), "line": ("linedetection", "linedetection"), "field": ("fielddetection", "fielddetection")}
RECORD_MODES = ("CMR", "MOTION", "EDR", "ALARM", "MOTIONORALARM", "MOTIONANDALARM", "COMMAND", "MANUAL")
TIME_RE = re.compile(r"^([01]\d|2[0-4]):[0-5]\d:[0-5]\d$")


def schedule_path(kind: str, channel: int) -> str:
    folder, prefix = SCHEDULE_KINDS[kind]
    return f"/ISAPI/Event/schedules/{folder}/{prefix}_video{channel}"


def track_path(track_id: int) -> str:
    return f"/ISAPI/ContentMgmt/record/tracks/{track_id}"


# ---------------------------------------------------------------- validation

def _check_time(v: str) -> str:
    if not TIME_RE.match(v or ""):
        raise ApiError(422, "validation", "שעה לא חוקית (HH:MM:SS).", details={"value": v})
    return v


def check_week(days: list[list[dict[str, Any]]], *, modes: bool = False) -> list[list[dict[str, Any]]]:
    """Seven days, ranges ordered and non-overlapping, at most 8 per day (the device's own limit)."""
    if len(days) != 7:
        raise ApiError(422, "validation", "לוח שבועי צריך 7 ימים.")
    out: list[list[dict[str, Any]]] = []
    for d, ranges in enumerate(days):
        if len(ranges) > 8:
            raise ApiError(422, "validation", "עד 8 טווחים ביום.", details={"day": d})
        clean = []
        last = "00:00:00"
        for r in sorted(ranges, key=lambda x: x.get("begin", "")):
            b, e = _check_time(r.get("begin", "")), _check_time(r.get("end", ""))
            if b >= e or b < last:
                raise ApiError(422, "validation", "טווחים חופפים או הפוכים.", details={"day": d, "begin": b, "end": e})
            item: dict[str, Any] = {"begin": b, "end": e}
            if modes:
                mode = str(r.get("mode") or "CMR").upper()
                if mode not in RECORD_MODES:
                    raise ApiError(422, "validation", "מצב הקלטה לא מוכר.", details={"mode": mode})
                item["mode"] = mode
            clean.append(item)
            last = e
        out.append(clean)
    return out


# ---------------------------------------------------------------- B5: arming schedules (TimeBlockList)

def week_from_schedule(xml: str) -> list[list[dict[str, str]]]:
    days: list[list[dict[str, str]]] = [[] for _ in range(7)]
    lst = next(iter(blocks(xml, "TimeBlockList")), "")
    for b in blocks(lst, "TimeBlock"):
        day = int(tag(b, "dayOfWeek") or 0)
        if 1 <= day <= 7:
            days[day - 1].append({"begin": tag(b, "beginTime") or "00:00:00", "end": tag(b, "endTime") or "24:00:00"})
    return days


def schedule_document(xml: str, days: list[list[dict[str, str]]]) -> str:
    """Rebuild the TimeBlockList from the week table; everything else in the document (holidays…) stays."""
    m = re.search(r"<TimeBlockList(?:\s[^>]*)?>.*?</TimeBlockList>", xml, re.S)
    items = []
    for d, ranges in enumerate(days):
        for r in ranges:
            items.append(f"<TimeBlock><dayOfWeek>{d + 1}</dayOfWeek><TimeRange><beginTime>{r['begin']}</beginTime><endTime>{r['end']}</endTime></TimeRange></TimeBlock>")
    new = f'<TimeBlockList size="{max(len(items), 1)}">' + "".join(items) + "</TimeBlockList>"
    if not m:
        return xml.replace("</Schedule>", new + "</Schedule>", 1)
    return xml[: m.start()] + new + xml[m.end():]


# ---------------------------------------------------------------- C1: recording schedule (Track)

def _day_index(name: str | None) -> int | None:
    return DAY_NAMES.index(name) if name in DAY_NAMES else None


def record_from_track(xml: str) -> dict[str, Any]:
    """The track's weekly schedule as 7 days of {begin, end, mode}; an action that ends on the next day at 00:00 is a
    range to 24:00:00 of its start day (the device writes whole days that way)."""
    days: list[list[dict[str, Any]]] = [[] for _ in range(7)]
    sched = next(iter(blocks(xml, "TrackSchedule")), "")
    for a in blocks(sched, "ScheduleAction"):
        start = next(iter(blocks(a, "ScheduleActionStartTime")), "")
        end = next(iter(blocks(a, "ScheduleActionEndTime")), "")
        d0, d1 = _day_index(tag(start, "DayOfWeek")), _day_index(tag(end, "DayOfWeek"))
        t0, t1 = tag(start, "TimeOfDay") or "00:00:00", tag(end, "TimeOfDay") or "24:00:00"
        if d0 is None:
            continue
        if d1 is not None and d1 != d0 and t1 == "00:00:00":
            t1 = "24:00:00"
        mode = tag(next(iter(blocks(a, "Actions")), ""), "ActionRecordingMode") or "CMR"
        if tag(next(iter(blocks(a, "Actions")), ""), "Record") == "false":
            continue
        days[d0].append({"begin": t0, "end": t1, "mode": mode})
    ext = next(iter(blocks(xml, "CustomExtension")), "")
    return {"enabled": tag(xml, "Enable") == "true", "schedule_enabled": tag(ext, "enableSchedule") != "false" if ext else None, "default_mode": tag(xml, "DefaultRecordingMode"),
            "pre_record_s": int(tag(ext, "PreRecordTimeSeconds") or 0) if ext else None, "post_record_s": int(tag(ext, "PostRecordTimeSeconds") or 0) if ext else None, "days": days}


def track_document(xml: str, days: list[list[dict[str, Any]]] | None, *, enabled: bool | None = None, schedule_enabled: bool | None = None) -> str:
    """Rebuild the ScheduleActionList inside the first ScheduleBlock (the weekly one); the block's GUID / type and the
    holiday schedule in the extension stay as they are."""
    out = xml
    if enabled is not None:
        out = set_tag(out, "Enable", "true" if enabled else "false")
    if schedule_enabled is not None:
        out = set_in_block(out, "CustomExtension", "enableSchedule", "true" if schedule_enabled else "false")
    if days is None:
        return out
    m = re.search(r"<TrackSchedule(?:\s[^>]*)?>.*?</TrackSchedule>", out, re.S)
    if not m:
        raise ApiError(409, "nvr_not_supported", "למסמך הערוץ אין לוח הקלטה לעריכה.")
    sched = m.group(0)
    block = re.search(r"<ScheduleBlock(?:\s[^>]*)?>.*?</ScheduleBlock>", sched, re.S)
    if not block:
        raise ApiError(409, "nvr_not_supported", "למסמך הערוץ אין בלוק לוח שבועי.")
    b = block.group(0)
    head = re.search(r"^.*?(?=<ScheduleAction>)", b, re.S)
    prefix = head.group(0) if head else b[: b.index("</ScheduleBlock>")]
    actions = []
    n = 1
    for d, ranges in enumerate(days):
        for r in ranges:
            end_day, end_time = (DAY_NAMES[(d + 1) % 7], "00:00:00") if r["end"] == "24:00:00" else (DAY_NAMES[d], r["end"])
            actions.append(f"<ScheduleAction><id>{n}</id><ScheduleActionStartTime><DayOfWeek>{DAY_NAMES[d]}</DayOfWeek><TimeOfDay>{r['begin']}</TimeOfDay></ScheduleActionStartTime>"
                           f"<ScheduleActionEndTime><DayOfWeek>{end_day}</DayOfWeek><TimeOfDay>{end_time}</TimeOfDay></ScheduleActionEndTime><ScheduleDSTEnable>true</ScheduleDSTEnable>"
                           f"<Description>nothing</Description><Actions><Record>true</Record><Log>false</Log><SaveImg>false</SaveImg><ActionRecordingMode>{r['mode']}</ActionRecordingMode></Actions></ScheduleAction>")
            n += 1
    new_block = prefix + "".join(actions) + "</ScheduleBlock>"
    new_sched = sched[: block.start()] + new_block + sched[block.end():]
    return out[: m.start()] + new_sched + out[m.end():]


# ---------------------------------------------------------------- B4: smart rules (line crossing, intrusion)

def _coords(points: list[list[float]]) -> str:
    return "<CoordinatesList>" + "".join(f"<Coordinates><positionX>{int(x)}</positionX><positionY>{int(y)}</positionY></Coordinates>" for x, y in points) + "</CoordinatesList>"


def _region_coords(points: list[list[float]]) -> str:
    return "<RegionCoordinatesList>" + "".join(f"<RegionCoordinates><positionX>{int(x)}</positionX><positionY>{int(y)}</positionY></RegionCoordinates>" for x, y in points) + "</RegionCoordinatesList>"


def _check_points(points: list[list[float]], lo: int, hi: int) -> list[list[int]]:
    if not lo <= len(points) <= hi or any(len(p) != 2 or not all(isinstance(v, (int, float)) and 0 <= v <= 1000 for v in p) for p in points):
        raise ApiError(422, "validation", f"נדרשות {lo} עד {hi} נקודות בתחום 0..1000.")
    return [[int(round(p[0])), int(round(p[1]))] for p in points]


def line_document(xml: str, spec: dict[str, Any]) -> str:
    """spec: {enabled, lines: [{id, enabled, sensitivity, direction, points[2], human, vehicle}]} - items not listed stay."""
    out = xml
    if spec.get("enabled") is not None:
        out = set_tag(out, "enabled", "true" if spec["enabled"] else "false")  # the first <enabled> is the document's
    for ln in spec.get("lines") or []:
        lid = int(ln["id"])
        pts = _check_points(ln.get("points") or [], 2, 2)
        m = re.search(rf"<LineItem(?:\s[^>]*)?>\s*<id>{lid}</id>.*?</LineItem>", out, re.S)
        if not m:
            raise ApiError(422, "validation", "קו לא קיים במסמך.", details={"id": lid})
        item = m.group(0)
        item = set_tag(item, "enabled", "true" if ln.get("enabled", True) else "false")
        if ln.get("sensitivity") is not None:
            item = set_tag(item, "sensitivityLevel", str(max(1, min(100, int(ln["sensitivity"])))))
        if ln.get("direction") in ("any", "left-right", "right-left"):
            item = set_tag(item, "directionSensitivity", ln["direction"])
        item = re.sub(r"<CoordinatesList>.*?</CoordinatesList>", _coords(pts), item, count=1, flags=re.S)
        if ln.get("human") is not None:
            item = set_tag(item, "humanMisinfoFilterEnabled", "true" if ln["human"] else "false")
        if ln.get("vehicle") is not None:
            item = set_tag(item, "vehicleMisinfoFilterEnabled", "true" if ln["vehicle"] else "false")
        out = out[: m.start()] + item + out[m.end():]
    return out


def field_document(xml: str, spec: dict[str, Any]) -> str:
    """spec: {enabled, regions: [{id, sensitivity, points[4..10], human, vehicle}]}; an empty points list clears the region."""
    out = xml
    if spec.get("enabled") is not None:
        out = set_tag(out, "enabled", "true" if spec["enabled"] else "false")
    for reg in spec.get("regions") or []:
        rid = int(reg["id"])
        raw = reg.get("points") or []
        pts = _check_points(raw, 4, 10) if raw else []
        m = re.search(rf"<FieldDetectionRegion(?:\s[^>]*)?>\s*<id>{rid}</id>.*?</FieldDetectionRegion>", out, re.S)
        if not m:
            raise ApiError(422, "validation", "אזור לא קיים במסמך.", details={"id": rid})
        item = m.group(0)
        if reg.get("sensitivity") is not None:
            item = set_tag(item, "sensitivityLevel", str(max(1, min(100, int(reg["sensitivity"])))))
        item = re.sub(r"<RegionCoordinatesList>.*?</RegionCoordinatesList>|<RegionCoordinatesList\s*/>", _region_coords(pts), item, count=1, flags=re.S)
        if reg.get("human") is not None:
            item = set_tag(item, "humanMisinfoFilterEnabled", "true" if reg["human"] else "false")
        if reg.get("vehicle") is not None:
            item = set_tag(item, "vehicleMisinfoFilterEnabled", "true" if reg["vehicle"] else "false")
        out = out[: m.start()] + item + out[m.end():]
    return out


def smart_from_docs(line_xml: str | None, field_xml: str | None) -> dict[str, Any]:
    """The editable view of both smart documents (every item, even the empty ones, so the editor can fill them)."""
    lines = []
    for item in blocks(next(iter(blocks(line_xml or "", "LineItemList")), ""), "LineItem"):
        pts = [[int(tag(c, "positionX") or 0), int(tag(c, "positionY") or 0)] for c in blocks(item, "Coordinates")]
        lines.append({"id": int(tag(item, "id") or 0), "enabled": tag(item, "enabled") == "true", "sensitivity": int(tag(item, "sensitivityLevel") or 50),
                      "direction": tag(item, "directionSensitivity") or "any", "points": pts, "human": tag(item, "humanMisinfoFilterEnabled") == "true", "vehicle": tag(item, "vehicleMisinfoFilterEnabled") == "true"})
    regions = []
    for reg in blocks(next(iter(blocks(field_xml or "", "FieldDetectionRegionList")), ""), "FieldDetectionRegion"):
        pts = [[int(tag(c, "positionX") or 0), int(tag(c, "positionY") or 0)] for c in blocks(reg, "RegionCoordinates")]
        regions.append({"id": int(tag(reg, "id") or 0), "sensitivity": int(tag(reg, "sensitivityLevel") or 50), "points": pts,
                        "human": tag(reg, "humanMisinfoFilterEnabled") == "true", "vehicle": tag(reg, "vehicleMisinfoFilterEnabled") == "true"})
    return {"line": {"enabled": tag(line_xml, "enabled") == "true", "lines": lines} if line_xml else None,
            "field": {"enabled": tag(field_xml, "enabled") == "true", "regions": regions} if field_xml else None}
