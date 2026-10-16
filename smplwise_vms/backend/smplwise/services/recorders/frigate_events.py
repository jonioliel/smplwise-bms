"""Frigate review items and events for the per-recorder event loop (NN5 phase F1, CR-029).

Frigate's unit of "something happened" is the REVIEW ITEM: an alert or a detection that spans several tracked objects, grows
while the objects are present and ends 30-40 s after the last one (`cutoff_time`). Arx keeps one row per review id in
`frigate_reviews` (the severity layers alert | detection; `motion` is activity density only) and mirrors it as ONE row of
`events` (source `frigate`, dedup key `frigate|<recorder>|review|<id>`, updated in place) so the event centre, the rules and
the notifications see it. Notifications come from ALERTS only (owner decision): a detection never fires a rule.

Transport (study 7.4): the WebSocket `/ws` is primary, polling `GET /api/review` is ALWAYS on - as the backfill after any outage
(history exists on the device, so a backfill is `measured`, never fabricated) and as the gap detector. The payloads of the
`reviews` / `events` frames were NOT VERIFIED on the live instance (no detection happened during the passive listen), so every
frame parser here is defensive: an unknown shape is counted and ignored, and an `events` frame only hints that a poll is due.
Read-only toward Frigate: this module sends GETs through the adapter and listens on `/ws`; it never publishes a control topic.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import queue
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from ...db import now_iso, retry_locked
from ...errors import ApiError
from ..timeutil import iso_utc

if TYPE_CHECKING:
    import sqlite3

    from ..events_ingest import AlertStreamListener
    from .frigate import FrigateAdapter

log = logging.getLogger("smplwise.frigate_events")

UTC = dt.timezone.utc
SOURCE = "frigate"
SEVERITIES = ("alert", "detection")
POLL_OVERLAP_S = 600.0        # re-read this far back: an item mutates (end time, objects) after it was first seen
POLL_FIRST_BACKFILL_S = 3600.0  # the first poll of a new recorder reads this far back (not the whole history)
POLL_MAX_BACKFILL_S = 24 * 3600.0
POLL_LIMIT = 500
OPEN_REFRESH_MAX = 20         # open items older than the overlap, re-read by id each poll
WS_HEALTHY_POLL_S = 60.0
WS_DOWN_POLL_S_DEFAULT = 10.0
POLL_MIN_S = 5.0              # study risk R4: never poll faster than 5 s
AUTO_TICK_S = 2.0               # F2b: how often the loop looks for a queued alarm-change profile row
OFFLINE_AFTER_S = 60.0        # Frigate's own docs: the dead-camera flap needs debouncing
PERSON = {"person"}
VEHICLE = {"car", "truck", "bus", "motorcycle", "bicycle", "boat", "license_plate"}


# ---------------------------------------------------------------------------------------------- normalizing

def _f(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _strs(v: Any) -> list[str]:
    if isinstance(v, dict):
        v = list(v)
    return [str(x)[:64] for x in v if isinstance(x, (str, int))][:64] if isinstance(v, list) else []


def normalize_review(item: Any) -> dict[str, Any] | None:
    """One Frigate review item (an API row or the `after` of a `reviews` frame) -> the Arx shape, or None when it has no id /
    camera / start (a shape this code does not know is ignored, never guessed)."""
    if not isinstance(item, dict):
        return None
    rid, cam, start = item.get("id"), item.get("camera"), _f(item.get("start_time"))
    if not isinstance(rid, str) or not rid or not isinstance(cam, str) or not cam or start is None:
        return None
    data = item.get("data") if isinstance(item.get("data"), dict) else {}
    sev = str(item.get("severity") or "").lower()
    return {
        "review_id": rid[:64], "source_ref": cam[:64], "severity": sev if sev in SEVERITIES else "detection",
        "start_ts": start, "end_ts": _f(item.get("end_time")),
        "objects": _strs(data.get("objects")), "zones": _strs(data.get("zones")), "sub_labels": _strs(data.get("sub_labels")),
        "detections": _strs(data.get("detections")), "thumb_time": _f(data.get("thumb_time")),
    }


def event_type(objects: list[str]) -> str:
    """The normalized events type of a review's objects: person wins, then vehicle, else `other` (labels stay in the details)."""
    labels = {o.lower() for o in objects}
    if labels & PERSON:
        return "person"
    if labels & VEHICLE:
        return "vehicle"
    return "other"


def _iso(ts: float) -> str:
    return iso_utc(dt.datetime.fromtimestamp(ts, UTC))


def dedup_key(recorder_id: str, kind: str, ident: str) -> str:
    return f"frigate|{recorder_id}|{kind}|{ident}"


# ---------------------------------------------------------------------------------------------- the store

@dataclass
class Applied:
    review: dict[str, Any]
    event: dict[str, Any] | None
    created: bool = False
    changed: bool = False
    notify: bool = False        # the first time this item is an ALERT: rules may fire (never for a detection)


def _camera_lookup(conn: "sqlite3.Connection", recorder_id: str) -> Callable[[str], Any]:
    cache: dict[str, Any] = {}

    def lookup(key: str) -> Any:
        if key not in cache:
            cache[key] = conn.execute("SELECT * FROM cameras WHERE recorder_id = ? AND source_ref = ?", (recorder_id, key)).fetchone()
        return cache[key]

    return lookup


def apply_review(conn: "sqlite3.Connection", recorder_id: str, item: Any, lookup: Callable[[str], Any], now: dt.datetime | None = None) -> Applied | None:
    """Insert / update one review item and its mirrored event. Returns None for a shape that is not a review item. Idempotent:
    the same item twice changes nothing and reports `changed=False`."""
    n = normalize_review(item)
    if n is None:
        return None
    now = now or dt.datetime.now(UTC)
    cam = lookup(n["source_ref"])
    cam_id = cam["id"] if cam else None
    channel = cam["channel"] if cam else None
    key = dedup_key(recorder_id, "review", n["review_id"])
    row = conn.execute("SELECT * FROM frigate_reviews WHERE recorder_id = ? AND review_id = ?", (recorder_id, n["review_id"])).fetchone()
    cols = (json.dumps(n["objects"]), json.dumps(n["zones"]), json.dumps(n["sub_labels"]), json.dumps(n["detections"]))
    details = {"review_id": n["review_id"], "severity_layer": n["severity"], "labels": n["objects"], "zones": n["zones"], "sub_labels": n["sub_labels"],
               "detections": n["detections"], "recorder_id": recorder_id, "camera_key": n["source_ref"], "thumb": True}
    etype, esev = event_type(n["objects"]), ("alert" if n["severity"] == "alert" else "info")
    state = "active" if n["end_ts"] is None else "inactive"
    created = changed = notify = False
    if row is None:
        created = changed = True
        conn.execute(
            "INSERT INTO frigate_reviews(recorder_id, review_id, source_ref, camera_id, severity, start_ts, end_ts, objects_json, zones_json, sub_labels_json, "
            "detections_json, thumb_time, event_id, last_seen_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)",
            (recorder_id, n["review_id"], n["source_ref"], cam_id, n["severity"], n["start_ts"], n["end_ts"], *cols, n["thumb_time"], now_iso(), now_iso()))
        notify = n["severity"] == "alert"
    else:
        new = (n["severity"], n["end_ts"], *cols, cam_id, n["thumb_time"])
        old = (row["severity"], row["end_ts"], row["objects_json"], row["zones_json"], row["sub_labels_json"], row["detections_json"], row["camera_id"], row["thumb_time"])
        changed = new != old
        notify = n["severity"] == "alert" and row["severity"] != "alert"  # escalated detection -> alert: the first alert moment
        conn.execute("UPDATE frigate_reviews SET severity = ?, end_ts = ?, objects_json = ?, zones_json = ?, sub_labels_json = ?, detections_json = ?, camera_id = ?, "
                     "thumb_time = ?, last_seen_at = ? WHERE recorder_id = ? AND review_id = ?", (*new, now_iso(), recorder_id, n["review_id"]))
    ev_row = conn.execute("SELECT * FROM events WHERE dedup_key = ?", (key,)).fetchone()
    if ev_row is None:
        eid = uuid.uuid4().hex[:12]
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, "
            "dedup_key, created_at, recorder_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, SOURCE, f"review_{n['severity']}", etype, cam_id, channel, _iso(n["start_ts"]), _iso(n["end_ts"]) if n["end_ts"] else None, iso_utc(now), state,
             max(1, len(n["detections"])), esev, "measured", json.dumps(details, ensure_ascii=False), key, now_iso(), recorder_id))
        conn.execute("UPDATE frigate_reviews SET event_id = ? WHERE recorder_id = ? AND review_id = ?", (eid, recorder_id, n["review_id"]))
    else:
        eid = ev_row["id"]
        if changed or ev_row["camera_id"] != cam_id:
            conn.execute("UPDATE events SET raw_type = ?, type = ?, camera_id = ?, channel = ?, ended_at = ?, state = ?, count = ?, severity = ?, details_json = ? WHERE id = ?",
                         (f"review_{n['severity']}", etype, cam_id, channel, _iso(n["end_ts"]) if n["end_ts"] else None, state, max(1, len(n["detections"])), esev,
                          json.dumps(details, ensure_ascii=False), eid))
        if row is not None and row["event_id"] != eid:
            conn.execute("UPDATE frigate_reviews SET event_id = ? WHERE recorder_id = ? AND review_id = ?", (eid, recorder_id, n["review_id"]))
    from ..events_ingest import row_to_event

    event = row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone())
    review = conn.execute("SELECT * FROM frigate_reviews WHERE recorder_id = ? AND review_id = ?", (recorder_id, n["review_id"])).fetchone()
    return Applied(review=dict(review), event=event, created=created, changed=changed or created, notify=notify)


def review_view(row: Any, *, reviewed: bool | None = None) -> dict[str, Any]:
    """The API shape of a stored review row (no path, no URL: the thumbnail is fetched through Arx by id)."""
    d = dict(row)
    return {
        "id": d["review_id"], "recorder_id": d["recorder_id"], "camera_id": d.get("camera_id"), "camera_key": d["source_ref"], "severity": d["severity"],
        "start": _iso(d["start_ts"]), "end": _iso(d["end_ts"]) if d.get("end_ts") else None, "open": d.get("end_ts") is None,
        "duration_s": round(d["end_ts"] - d["start_ts"], 1) if d.get("end_ts") else None,
        "objects": json.loads(d.get("objects_json") or "[]"), "zones": json.loads(d.get("zones_json") or "[]"),
        "sub_labels": json.loads(d.get("sub_labels_json") or "[]"), "detections": len(json.loads(d.get("detections_json") or "[]")),
        "type": event_type(json.loads(d.get("objects_json") or "[]")), "event_id": d.get("event_id"), "reviewed": reviewed,
    }


# ---------------------------------------------------------------------------------------------- frames

def parse_frame(raw: Any) -> list[tuple[str, Any]]:
    """One `/ws` frame -> [(kind, value)]. Kinds: `review` (a review item dict), `status` ((camera, online)), `hint` (something
    changed: poll soon). Anything else, or a shape this code cannot read, is `[]`. Never raises."""
    try:
        frame = json.loads(raw) if isinstance(raw, (str, bytes, bytearray)) else raw
    except (ValueError, UnicodeDecodeError):
        return []
    if not isinstance(frame, dict):
        return []
    topic, payload = frame.get("topic"), frame.get("payload")
    if not isinstance(topic, str):
        return []
    if isinstance(payload, (str, bytes)):
        try:
            payload = json.loads(payload)
        except (ValueError, UnicodeDecodeError):
            pass  # a plain-text payload ("online", "ON")
    if topic == "reviews" and isinstance(payload, dict):
        item = payload.get("after") if isinstance(payload.get("after"), dict) else payload.get("before") if isinstance(payload.get("before"), dict) else payload
        return [("review", item)]
    if topic in ("events", "tracked_object_update"):
        return [("hint", topic)]
    if topic.endswith("/status/detect") and isinstance(payload, str):
        cam = topic[: -len("/status/detect")]
        if cam and "/" not in cam:
            return [("status", (cam, payload.strip().lower() == "online"))]
    return []


class OfflineTracker:
    """Debounce for `<cam>/status/detect` (the live instance flapped 607 times in 13 minutes): a camera is reported OFFLINE only
    after it stayed offline for `after_s`, and BACK only if an offline had been reported. Pure: the caller passes the clock."""

    def __init__(self, after_s: float = OFFLINE_AFTER_S) -> None:
        self.after_s = after_s
        self.since: dict[str, float] = {}      # camera -> offline since (not yet reported)
        self.reported: dict[str, float] = {}   # camera -> offline since (reported)

    def update(self, cam: str, online: bool, now: float) -> list[tuple[str, str, float]]:
        if online:
            self.since.pop(cam, None)
            if cam in self.reported:
                return [("online", cam, self.reported.pop(cam))]
            return []
        if cam not in self.since and cam not in self.reported:
            self.since[cam] = now
        return self.tick(now)

    def tick(self, now: float) -> list[tuple[str, str, float]]:
        out = []
        for cam, t in list(self.since.items()):
            if now - t >= self.after_s:
                self.reported[cam] = t
                del self.since[cam]
                out.append(("offline", cam, t))
        return out


def store_offline(conn: "sqlite3.Connection", recorder_id: str, lookup: Callable[[str], Any], cam: str, since: float, back_at: float | None = None) -> dict[str, Any] | None:
    """A debounced camera-offline event (type offline, severity critical), closed when the camera is back. Idempotent per
    (camera, offline-since)."""
    row = lookup(cam)
    key = dedup_key(recorder_id, "offline", f"{cam}|{int(since)}")
    ev = conn.execute("SELECT * FROM events WHERE dedup_key = ?", (key,)).fetchone()
    from ..events_ingest import row_to_event

    if ev is None:
        if back_at is not None:
            return None
        eid = uuid.uuid4().hex[:12]
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at, recorder_id) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, SOURCE, "status_detect_offline", "offline", row["id"] if row else None, row["channel"] if row else None, _iso(since), None, now_iso(), "active", 1,
             "critical", "measured", json.dumps({"camera_key": cam, "debounced_s": OFFLINE_AFTER_S}), key, now_iso(), recorder_id))
        return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (eid,)).fetchone())
    if back_at is not None and ev["state"] == "active":
        conn.execute("UPDATE events SET state = 'inactive', ended_at = ? WHERE id = ?", (_iso(back_at), ev["id"]))
        return row_to_event(conn.execute("SELECT * FROM events WHERE id = ?", (ev["id"],)).fetchone())
    return None


# ---------------------------------------------------------------------------------------------- the loop

@dataclass
class FrigateState:
    ws_state: str = "off"            # off | connected | down
    ws_frames: int = 0
    ws_unknown_frames: int = 0
    ws_changed_at: str | None = None
    last_poll_at: str | None = None
    last_poll_error: str | None = None
    last_poll_ts: float | None = None
    polls: int = 0
    reviews_seen: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in ("ws_state", "ws_frames", "ws_unknown_frames", "ws_changed_at", "last_poll_at", "last_poll_error", "last_poll_ts", "polls", "reviews_seen")}


STATES: dict[str, FrigateState] = {}


def state_of(recorder_id: str) -> FrigateState:
    return STATES.setdefault(recorder_id, FrigateState())


class WsFeed:
    """The `/ws` reader: one thread, one connection, reconnect with back-off, frames into a bounded queue. Listen-only: nothing
    is ever sent. `connect` is `websockets.sync.client.connect` (tests inject a fake)."""

    def __init__(self, adapter: "FrigateAdapter", out: "queue.Queue[Any]", stop: threading.Event, st: FrigateState, connect: Callable[..., Any] | None = None) -> None:
        self.adapter, self.out, self.stop, self.st, self.connect = adapter, out, stop, st, connect
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        self.thread = threading.Thread(target=self.run, name=f"frigate-ws-{self.adapter.recorder_id}", daemon=True)
        self.thread.start()

    def _set(self, state: str) -> None:
        if self.st.ws_state != state:
            self.st.ws_state, self.st.ws_changed_at = state, now_iso()

    def run(self) -> None:
        connect = self.connect
        if connect is None:
            from websockets.sync.client import connect as ws_connect

            connect = ws_connect
        backoff = 5.0
        while not self.stop.is_set():
            try:
                url, headers, ssl_ctx = self.adapter.http.websocket_url(), self.adapter.http.websocket_headers(), self.adapter.http.websocket_ssl()
                kwargs: dict[str, Any] = {"additional_headers": headers, "open_timeout": 10, "max_size": 4_000_000}
                if ssl_ctx is not None:
                    kwargs["ssl"] = ssl_ctx
                with connect(url, **kwargs) as ws:
                    self._set("connected")
                    backoff = 5.0
                    while not self.stop.is_set():
                        try:
                            msg = ws.recv(timeout=5)
                        except TimeoutError:
                            continue
                        self.st.ws_frames += 1
                        try:
                            self.out.put_nowait(msg)
                        except queue.Full:
                            pass  # the poll is the truth; a full queue only means a burst
            except ApiError as exc:
                log.warning("frigate ws (%s): %s", self.adapter.recorder_id, exc.code)
                if exc.code == "source_forbidden":
                    self.adapter.http.forget_token()
            except Exception as exc:  # noqa: BLE001 - never die; the poll covers the gap
                log.warning("frigate ws (%s): %s (retry in %.0fs)", self.adapter.recorder_id, type(exc).__name__, backoff)
            self._set("down")
            self.stop.wait(backoff)
            backoff = min(120.0, backoff * 2)
        self._set("off")


def _poll_interval(extra: Any) -> float:
    try:
        return min(3600.0, max(POLL_MIN_S, float(extra or WS_DOWN_POLL_S_DEFAULT)))
    except (TypeError, ValueError):
        return WS_DOWN_POLL_S_DEFAULT


def poll_reviews(listener: "AlertStreamListener", ad: "FrigateAdapter", st: FrigateState, now_ts: float) -> int:
    """One polling round: reviews since the cursor (minus the overlap), plus the still-open items older than the overlap by id.
    Everything is applied in one write transaction; rules fire for alerts after the commit. Returns the changed count."""
    from .. import rules as rules_svc
    from ..events_ingest import publish

    cursor = st.last_poll_ts
    start = max(now_ts - POLL_MAX_BACKFILL_S, (cursor - POLL_OVERLAP_S) if cursor else now_ts - POLL_FIRST_BACKFILL_S)
    items = ad.review_items(start, now_ts + 60, limit=POLL_LIMIT)
    refresh: list[dict[str, Any]] = []
    with listener.db.connection(mode="read") as rconn:
        open_ids = [r["review_id"] for r in rconn.execute(
            "SELECT review_id FROM frigate_reviews WHERE recorder_id = ? AND end_ts IS NULL AND start_ts < ? ORDER BY start_ts LIMIT ?",
            (listener.recorder_id, start, OPEN_REFRESH_MAX)).fetchall()]
    seen = {i.get("id") for i in items}
    for rid in open_ids:
        if rid in seen:
            continue
        try:
            refresh.append(ad.review_item(rid))
        except ApiError as exc:
            if exc.code == "not_found":  # Frigate dropped it (retention / deleted): close it where it stands
                refresh.append({"id": rid, "_gone": True})
            else:
                raise
    tz = listener.tz_getter()
    fired: list[dict[str, Any]] = []
    published: list[dict[str, Any]] = []
    changed = 0

    def _write() -> int:
        fired.clear()
        published.clear()
        n = 0
        with listener.db.connection() as conn:
            lookup = _camera_lookup(conn, listener.recorder_id)
            for it in [*items, *refresh]:
                if it.get("_gone"):
                    conn.execute("UPDATE frigate_reviews SET end_ts = COALESCE(end_ts, start_ts) WHERE recorder_id = ? AND review_id = ?", (listener.recorder_id, it["id"]))
                    continue
                a = apply_review(conn, listener.recorder_id, it, lookup)
                if a is None or not a.changed:
                    continue
                n += 1
                published.append(a.event)
                if a.notify and a.event:
                    try:
                        fired.extend(rules_svc.evaluate_event(conn, a.event, tz, deliver=False))
                    except Exception:  # noqa: BLE001 - a rule must never break ingestion
                        log.exception("rule evaluation failed for a frigate review")
            newest = max((i["start_time"] for i in items if isinstance(i.get("start_time"), (int, float))), default=None)
            conn.execute("INSERT INTO frigate_sync_state(recorder_id, last_poll_ts, last_poll_at, last_poll_error, ws_state, ws_changed_at, ws_frames) VALUES (?,?,?,NULL,?,?,?) "
                         "ON CONFLICT(recorder_id) DO UPDATE SET last_poll_ts = COALESCE(?, last_poll_ts), last_poll_at = excluded.last_poll_at, last_poll_error = NULL, "
                         "ws_state = excluded.ws_state, ws_changed_at = excluded.ws_changed_at, ws_frames = excluded.ws_frames",
                         (listener.recorder_id, newest, now_iso(), st.ws_state, st.ws_changed_at, st.ws_frames, newest))
        return n

    changed = retry_locked(_write, what="frigate poll")
    rules_svc.deliver_pending(fired)
    for ev in published:
        publish(ev)
        listener.state.last_event_at = ev["occurred_at"]
        listener.state.events_stored += 1
    newest_ts = max((i["start_time"] for i in items if isinstance(i.get("start_time"), (int, float))), default=None)
    if newest_ts is not None:
        st.last_poll_ts = max(st.last_poll_ts or 0.0, newest_ts)
    elif st.last_poll_ts is None:
        st.last_poll_ts = now_ts - 1
    st.polls += 1
    st.reviews_seen += len(items)
    st.last_poll_at, st.last_poll_error = now_iso(), None
    return changed


def _load_cursor(listener: "AlertStreamListener", st: FrigateState) -> None:
    try:
        with listener.db.connection(mode="read") as conn:
            row = conn.execute("SELECT last_poll_ts FROM frigate_sync_state WHERE recorder_id = ?", (listener.recorder_id,)).fetchone()
        if row and row["last_poll_ts"]:
            st.last_poll_ts = float(row["last_poll_ts"])
    except Exception:  # noqa: BLE001 - a missing table (older database) just means no cursor
        pass


def run_loop(listener: "AlertStreamListener", *, adapter: "FrigateAdapter | None" = None, ws_connect: Callable[..., Any] | None = None,
             clock: Callable[[], float] = time.time, max_rounds: int | None = None) -> None:
    """The reader of a Frigate recorder's AlertStreamListener (`events_ingest._loop` calls it for vendor `frigate`). Never raises.
    WebSocket frames update review items at once; polling backfills and detects gaps; a debounced `status/detect` offline
    becomes an `offline` event. A disconnection longer than GAP_AFTER_S records a coverage gap exactly like the alert stream."""
    import os

    from ..events_ingest import GAP_AFTER_S, publish, record_gap
    from .frigate import FrigateAdapter

    if os.environ.get("SW_FRIGATE_EVENTS", "1") == "0":  # tests (like SW_RECORDER_HEALTH): the loop stays off, they call poll_reviews / run_loop directly
        listener.state.last_error = "disabled_by_env"
        return
    s = listener.settings
    stt = listener.state
    st = state_of(listener.recorder_id)
    ad = adapter or FrigateAdapter(listener.recorder_id, s)
    extra = s.nvr_extra if isinstance(s.nvr_extra, dict) else {}
    down_interval = _poll_interval(extra.get("poll_interval_s"))
    frames: "queue.Queue[Any]" = queue.Queue(maxsize=2000)
    feed = WsFeed(ad, frames, listener.stop, st, ws_connect)
    _load_cursor(listener, st)
    feed.start()
    tracker = OfflineTracker()
    last_poll = 0.0
    last_auto = 0.0
    hint = False
    backoff = 5.0
    rounds = 0
    wait = listener.stop.wait
    while not listener.stop.is_set():
        rounds += 1
        if max_rounds is not None and rounds > max_rounds:
            break
        now = clock()
        # 1) frames: reviews are applied at once, status frames feed the debouncer, an events frame hints that a poll is due
        batch: list[tuple[str, Any]] = []
        try:
            while len(batch) < 200:
                batch.extend(parse_frame(frames.get_nowait()))
        except queue.Empty:
            pass
        reviews = [v for k, v in batch if k == "review"]
        transitions: list[tuple[str, str, float]] = []
        for kind, val in batch:
            if kind == "status":
                transitions += tracker.update(val[0], val[1], now)
            elif kind == "hint":
                hint = True
        transitions += tracker.tick(now)
        if reviews or transitions:
            try:
                _apply_frames(listener, reviews, transitions, now)
            except Exception:  # noqa: BLE001 - one bad frame batch must not stop the loop; the poll repairs it
                log.exception("frigate frame handling failed (%s)", listener.recorder_id)
        # 1b) NN5 F2b: an alarm-state change queued a profile suggestion / switch for this recorder (one cheap read every few seconds)
        if listener.db is not None and now - last_auto >= AUTO_TICK_S:
            last_auto = now
            try:
                from ..frigate_auto_profile import tick as auto_profile_tick

                auto_profile_tick(listener.db, ad, now)
            except Exception:  # noqa: BLE001 - a failed automatic switch is final for its row and never stops the reader
                log.exception("frigate auto-profile pass failed (%s)", listener.recorder_id)
        # 2) the poll: always on (backfill + gap detector); faster while the WebSocket is not connected
        interval = WS_HEALTHY_POLL_S if st.ws_state == "connected" else down_interval
        if hint:
            interval = min(interval, POLL_MIN_S)
        if now - last_poll >= interval:
            last_poll = now
            hint = False
            try:
                poll_reviews(listener, ad, st, now)
            except ApiError as exc:
                st.last_poll_error = exc.code
                stt.last_error = exc.code
                if stt.connected:
                    stt.reconnects += 1
                stt.connected = False
                if stt.disconnected_since is None:
                    stt.disconnected_since = time.time()
                log.warning("frigate poll (%s): %s (retry in %.0fs)", listener.recorder_id, exc.code, backoff)
                last_poll = now - interval + backoff  # retry after the back-off, not after a whole interval
                backoff = min(60.0, backoff * 2)
            except Exception:  # noqa: BLE001 - never die
                log.exception("frigate poll (%s) crashed; retrying", listener.recorder_id)
                last_poll = now - interval + backoff
                backoff = min(60.0, backoff * 2)
            else:
                backoff = 5.0
                if stt.disconnected_since is not None:
                    gap = time.time() - stt.disconnected_since
                    if gap >= GAP_AFTER_S and listener.db is not None:
                        since, until, why = dt.datetime.fromtimestamp(stt.disconnected_since, UTC), dt.datetime.now(UTC), stt.last_error or "disconnected"

                        def _gap() -> dict[str, Any]:
                            with listener.db.connection() as conn:
                                return record_gap(conn, since, until, why, recorder_id=listener.recorder_id)

                        publish(retry_locked(_gap, what="frigate gap"))
                    stt.disconnected_since = None
                stt.connected = True
                stt.last_error = None
                stt.last_heartbeat_at = now_iso()
        wait(1.0 if max_rounds is None else 0.05)
    stt.connected = False


def _apply_frames(listener: "AlertStreamListener", reviews: list[Any], transitions: list[tuple[str, str, float]], now: float) -> None:
    from .. import rules as rules_svc
    from ..events_ingest import publish

    tz = listener.tz_getter()
    fired: list[dict[str, Any]] = []
    published: list[dict[str, Any]] = []

    def _write() -> None:
        fired.clear()
        published.clear()
        with listener.db.connection() as conn:
            lookup = _camera_lookup(conn, listener.recorder_id)
            for item in reviews:
                a = apply_review(conn, listener.recorder_id, item, lookup)
                if a is None or not a.changed:
                    continue
                published.append(a.event)
                if a.notify and a.event:
                    try:
                        fired.extend(rules_svc.evaluate_event(conn, a.event, tz, deliver=False))
                    except Exception:  # noqa: BLE001
                        log.exception("rule evaluation failed for a frigate review")
            for kind, cam, since in transitions:
                ev = store_offline(conn, listener.recorder_id, lookup, cam, since, back_at=now if kind == "online" else None)
                if ev:
                    published.append(ev)

    retry_locked(_write, what="frigate frames")
    rules_svc.deliver_pending(fired)
    for ev in published:
        publish(ev)
        listener.state.last_event_at = ev["occurred_at"]
        listener.state.events_stored += 1
