"""Live event ingestion from the NVR's alert stream (MASTER_SPEC ch. 26, T031).

`GET /ISAPI/Event/notification/alertStream` is a long-lived multipart response: one `<EventNotificationAlert>`
document per event, plus a `videoloss/inactive` heartbeat every ~10 s. This module

- parses the stream robustly (documents split on their closing tag, unknown types kept as `other`),
- keeps the heartbeat as a health signal only (never stored as an event),
- normalizes device types to product types, maps `channelID` to the camera row, converts the device
  time (ISO with offset) to UTC and keeps the raw string,
- de-duplicates bursts: an `active` event opens a row (dedup key camera+type+minute bucket), repeats
  within DEDUP_WINDOW_S increase `count`, `inactive` closes it,
- records a `coverage_gap` event when the connection was lost for longer than GAP_AFTER_S,
- reconnects with back-off and exposes its state for /health,
- pushes stored events to WebSocket subscribers through a thread-safe queue.

Everything here is read-only against the device. Historical events are never fabricated from the
live stream; the recording-derived motion events live in `events_derive.py` with confidence "inferred".
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import queue
import re
import sqlite3
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

from ..config import Settings
from ..db import Database, now_iso
from .timeutil import UTC, iso_utc, nvr_wall_to_utc, zone
from . import xmlsafe

log = logging.getLogger("smplwise.events")

DEDUP_WINDOW_S = 30
GAP_AFTER_S = 45
HEARTBEAT_TIMEOUT_S = 90

# device eventType (lower-case) → normalized type, severity
TYPE_MAP: dict[str, tuple[str, str]] = {
    "vmd": ("motion", "info"),
    "motiondetection": ("motion", "info"),
    "linedetection": ("line", "alert"),
    "fielddetection": ("field", "alert"),
    "regionentrance": ("field", "alert"),
    "regionexiting": ("field", "alert"),
    "intrusion": ("field", "alert"),
    "videoloss": ("offline", "critical"),
    "videolost": ("offline", "critical"),
    "ipcdisconnect": ("offline", "critical"),
    "shelteralarm": ("tamper", "alert"),
    "tamperdetection": ("tamper", "alert"),
    "facedetection": ("person", "info"),
    "humandetect": ("person", "info"),
    "vehicledetection": ("vehicle", "info"),
    "io": ("io", "alert"),
    "diskfull": ("storage", "critical"),
    "diskerror": ("storage", "critical"),
    "nicbroken": ("system", "critical"),
    "ipconflict": ("system", "critical"),
    "illaccess": ("system", "alert"),
}


@dataclass
class ParsedAlert:
    raw_type: str
    state: str  # active | inactive
    channel: int | None
    dyn_channel: int | None
    device_time: str
    description: str
    target: str  # human | vehicle | ''
    active_post_count: int
    raw_tags: dict[str, str] = field(default_factory=dict)

    @property
    def is_heartbeat(self) -> bool:
        return self.raw_type.lower() in ("videoloss", "videolost") and self.state == "inactive"


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_alert(xml: str) -> ParsedAlert | None:
    try:
        root = xmlsafe.parse(xml)
    except ET.ParseError:
        return None
    tags: dict[str, str] = {}
    for el in root.iter():
        name = _local(el.tag)
        if el.text and el.text.strip() and name not in tags:
            tags[name] = el.text.strip()
    if not tags.get("eventType"):
        return None
    ch = tags.get("channelID") or ""
    dyn = tags.get("dynChannelID") or ""
    return ParsedAlert(
        raw_type=tags.get("eventType", ""),
        state=(tags.get("eventState") or "active").lower(),
        channel=int(ch) if ch.isdigit() else None,
        dyn_channel=int(dyn) if dyn.isdigit() else None,
        device_time=tags.get("dateTime", ""),
        description=tags.get("eventDescription", ""),
        target=(tags.get("detectionTarget") or tags.get("targetType") or "").lower(),
        active_post_count=int(tags["activePostCount"]) if tags.get("activePostCount", "").isdigit() else 0,
        raw_tags={k: v for k, v in tags.items() if k not in ("ipAddress", "macAddress")},  # never keep addresses
    )


def normalize_type(alert: ParsedAlert) -> tuple[str, str]:
    """(type, severity). `detectionTarget` refines smart events only when the device provided it."""
    base, severity = TYPE_MAP.get(alert.raw_type.lower(), ("other", "info"))
    if alert.target == "human" and base in ("motion", "line", "field", "other"):
        return "person", severity
    if alert.target == "vehicle" and base in ("motion", "line", "field", "other"):
        return "vehicle", severity
    return base, severity


def device_time_to_utc(value: str, tz_name: str, now: dt.datetime | None = None) -> tuple[dt.datetime, str]:
    """The stream's dateTime carries an offset ('2026-09-15T20:49:02+03:00'). Trust it when it lands within an
    hour of now; otherwise fall back to the wall-clock interpretation (KNOWN_QUIRKS T1). Returns (utc, precision)."""
    now = now or dt.datetime.now(UTC)
    v = value.strip()
    try:
        parsed = dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return now, "received"
    if parsed.tzinfo is not None:
        utc = parsed.astimezone(UTC)
        # live alerts arrive within seconds; an hour-sized error is the standard-vs-DST offset quirk (T1)
        if abs((utc - now).total_seconds()) <= 900:
            return utc, "device_offset"
    wall = nvr_wall_to_utc(parsed.replace(tzinfo=None).isoformat(), zone(tz_name))
    return wall, "wall_clock"


class IngestState:
    def __init__(self) -> None:
        self.connected = False
        self.last_heartbeat_at: str | None = None
        self.last_event_at: str | None = None
        self.last_error: str | None = None
        self.reconnects = 0
        self.events_stored = 0
        self.started_at: str | None = None
        self.disconnected_since: float | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "last_heartbeat_at": self.last_heartbeat_at,
            "last_event_at": self.last_event_at,
            "last_error": self.last_error,
            "reconnects": self.reconnects,
            "events_stored": self.events_stored,
            "started_at": self.started_at,
        }


STATE = IngestState()
_subscribers: list[queue.Queue] = []
_sub_lock = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    with _sub_lock:
        _subscribers.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _sub_lock:
        if q in _subscribers:
            _subscribers.remove(q)


def publish(event: dict[str, Any]) -> None:
    with _sub_lock:
        subs = list(_subscribers)
    for q in subs:
        try:
            q.put_nowait(event)
        except queue.Full:
            pass


def row_to_event(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["details"] = json.loads(d.pop("details_json") or "{}")
    return d


def store_alert(conn: sqlite3.Connection, alert: ParsedAlert, tz_name: str, camera_lookup: Callable[[int], sqlite3.Row | None], now: dt.datetime | None = None) -> dict[str, Any] | None:
    """Insert / merge one parsed alert. Returns the stored (or updated) event, or None for heartbeats/noise."""
    if alert.is_heartbeat:
        return None
    now = now or dt.datetime.now(UTC)
    etype, severity = normalize_type(alert)
    cam = None
    channel = alert.channel
    if channel is not None:
        cam = camera_lookup(channel)
    if cam is None and alert.dyn_channel is not None:
        cam = camera_lookup(alert.dyn_channel)
        if cam is not None:
            channel = alert.dyn_channel
    if etype == "offline" and channel == 0:
        return None  # device-wide videoloss noise carries channel 0 (KNOWN_QUIRKS C4)
    occurred, precision = device_time_to_utc(alert.device_time, tz_name, now)
    cam_key = cam["id"] if cam else ""
    if alert.state == "inactive":
        # close the most recent open row of this camera/type (bursts may span buckets)
        open_row = conn.execute(
            "SELECT * FROM events WHERE source = 'alertstream' AND type = ? AND COALESCE(camera_id, '') = ? AND state = 'active' AND occurred_at >= ? ORDER BY occurred_at DESC LIMIT 1",
            (etype, cam_key, iso_utc(occurred - dt.timedelta(minutes=10))),
        ).fetchone()
        if open_row is None:
            return None  # an inactive without a known active: nothing to show
        conn.execute("UPDATE events SET state = 'inactive', ended_at = ? WHERE id = ?", (iso_utc(occurred), open_row["id"]))
        return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (open_row["id"],)).fetchone())
    # active: merge into a row that is still open and was last seen within the window
    prev = conn.execute(
        "SELECT * FROM events WHERE source = 'alertstream' AND type = ? AND COALESCE(camera_id, '') = ? AND state = 'active' AND COALESCE(ended_at, occurred_at) >= ? ORDER BY occurred_at DESC LIMIT 1",
        (etype, cam_key, iso_utc(occurred - dt.timedelta(seconds=DEDUP_WINDOW_S))),
    ).fetchone()
    if prev is not None:
        conn.execute("UPDATE events SET count = count + 1, ended_at = ? WHERE id = ?", (iso_utc(occurred), prev["id"]))
        return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (prev["id"],)).fetchone())
    key = f"as:{cam_key or f'ch{channel}'}:{etype}:{iso_utc(occurred)}"
    if conn.execute("SELECT 1 FROM events WHERE dedup_key = ?", (key,)).fetchone():
        return None
    details = {"description": alert.description, "device_time": alert.device_time, "time_precision": precision, "target": alert.target or None, "active_post_count": alert.active_post_count}
    eid = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, "alertstream", alert.raw_type, etype, cam["id"] if cam else None, channel, iso_utc(occurred), None, iso_utc(now), "active", 1, severity, "measured", json.dumps(details, ensure_ascii=False), key, now_iso()),
    )
    return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone())


def record_gap(conn: sqlite3.Connection, started: dt.datetime, ended: dt.datetime, reason: str) -> dict[str, Any]:
    eid = uuid.uuid4().hex[:12]
    key = f"gap:{iso_utc(started)}"
    conn.execute(
        "INSERT OR IGNORE INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (eid, "system", "alertstream_disconnected", "coverage_gap", None, None, iso_utc(started), iso_utc(ended), now_iso(), "none", 1, "alert", "measured", json.dumps({"reason": reason, "seconds": int((ended - started).total_seconds())}), key, now_iso()),
    )
    return row_to_event(conn.execute("SELECT * FROM events WHERE dedup_key = ?", (key,)).fetchone())


class AlertStreamListener:
    """Background thread: connect → read documents → store → publish; back-off on failure."""

    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop = threading.Event()
        self.db: Database | None = None
        self.settings: Settings | None = None
        self.tz_getter: Callable[[], str] = lambda: "Asia/Jerusalem"

    def start(self, db: Database, settings: Settings, tz_getter: Callable[[], str]) -> None:
        self.db, self.settings, self.tz_getter = db, settings, tz_getter
        if not (settings.nvr_host and settings.nvr_user and settings.nvr_password):
            STATE.last_error = "nvr_not_configured"
            return
        self.stop.clear()
        STATE.started_at = now_iso()
        self.thread = threading.Thread(target=self._loop, name="alertstream", daemon=True)
        self.thread.start()

    def shutdown(self) -> None:
        self.stop.set()

    def _camera_lookup(self, conn: sqlite3.Connection) -> Callable[[int], sqlite3.Row | None]:
        cache: dict[int, sqlite3.Row | None] = {}

        def lookup(channel: int) -> sqlite3.Row | None:
            if channel not in cache:
                cache[channel] = conn.execute("SELECT * FROM cameras WHERE channel = ? AND recorder_id = 'nvr-1'", (channel,)).fetchone()
            return cache[channel]

        return lookup

    def _handle(self, alert: ParsedAlert) -> None:
        assert self.db
        if alert.is_heartbeat:
            STATE.last_heartbeat_at = now_iso()
            return
        with self.db.connection() as conn:
            stored = store_alert(conn, alert, self.tz_getter(), self._camera_lookup(conn))
            if stored:
                from . import rules as rules_svc  # local import: rules depend on correlation which depends on this module

                try:
                    rules_svc.evaluate_event(conn, stored, self.tz_getter())
                except Exception:  # noqa: BLE001 - a rule must never break ingestion
                    log.exception("rule evaluation failed for %s", stored.get("id"))
        if stored:
            STATE.last_event_at = stored["occurred_at"]
            STATE.events_stored += 1
            publish(stored)

    def _loop(self) -> None:
        assert self.settings and self.db
        s = self.settings
        backoff = 5.0
        url = f"http://{s.nvr_host}:{s.nvr_http_port}/ISAPI/Event/notification/alertStream"
        while not self.stop.is_set():
            try:
                with httpx.Client(auth=httpx.DigestAuth(s.nvr_user or "", s.nvr_password or ""), timeout=httpx.Timeout(connect=15, read=HEARTBEAT_TIMEOUT_S, write=15, pool=15)) as c:
                    with c.stream("GET", url, headers={"Accept": "application/xml"}) as r:
                        if r.status_code != 200:
                            STATE.last_error = f"http_{r.status_code}"
                            raise RuntimeError(f"alertStream HTTP {r.status_code}")
                        if STATE.disconnected_since is not None:
                            gap = time.time() - STATE.disconnected_since
                            if gap >= GAP_AFTER_S:
                                with self.db.connection() as conn:
                                    ev = record_gap(conn, dt.datetime.fromtimestamp(STATE.disconnected_since, UTC), dt.datetime.now(UTC), STATE.last_error or "disconnected")
                                publish(ev)
                            STATE.disconnected_since = None
                        STATE.connected = True
                        STATE.last_error = None
                        backoff = 5.0
                        log.info("alertStream connected")
                        buf = b""
                        for chunk in r.iter_bytes(4096):
                            if self.stop.is_set():
                                break
                            buf += chunk
                            while True:
                                end = buf.find(b"</EventNotificationAlert>")
                                if end < 0:
                                    break
                                start = buf.rfind(b"<EventNotificationAlert", 0, end)
                                doc = buf[start:end + len(b"</EventNotificationAlert>")].decode("utf-8", "ignore") if start >= 0 else ""
                                buf = buf[end + len(b"</EventNotificationAlert>"):]
                                alert = parse_alert(doc) if doc else None
                                if alert:
                                    try:
                                        self._handle(alert)
                                    except Exception:  # one bad document must not kill the stream
                                        log.exception("alert handling failed")
                            if len(buf) > 1_000_000:
                                buf = buf[-100_000:]
            except Exception as exc:
                if self.stop.is_set():
                    break
                STATE.last_error = STATE.last_error or type(exc).__name__
                log.warning("alertStream disconnected: %s (retry in %.0fs)", type(exc).__name__, backoff)
            if STATE.connected:
                STATE.reconnects += 1
            STATE.connected = False
            if STATE.disconnected_since is None:
                STATE.disconnected_since = time.time()
            self.stop.wait(backoff)
            backoff = min(60.0, backoff * 2)
        STATE.connected = False


LISTENER = AlertStreamListener()
