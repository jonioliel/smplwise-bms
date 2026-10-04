"""Recorder health monitoring (CR-026, docs/changes/CR-026-NVR-HEALTH.md): per recorder, API reachability and latency for
every vendor, and - for an adapter that declares `health_detail` (Provision-ISR first) - disks, recording per channel,
channel connectivity, clock drift and the pinned certificate's expiry. Conditions become notifications through the
notification core (services/notify.py) with the same reconcile step as the other monitors (services/notify_sources.reconcile).

THREE PARTS
- The poller (`POLLER`, one daemon thread): every `interval_s` it reads each ready recorder through its adapter, holding no
  database connection during device I/O (a short read connection only builds the adapters). Read-only: an adapter's
  `health()` and `read_health()` send reads only. The result is kept in memory (`STORE`); a restart starts empty, which is
  safe because the open notification rows are the durable state.
- `evaluate()` (pure apart from the band latches): one recorder's state + thresholds -> conditions.
- `tick()` (called by notify_sources.tick every 30 s inside its write transaction): conditions -> due / active sets ->
  `reconcile`. No flapping: a condition must hold for its policy's `after_s` before it is announced (notify_sources.held),
  numeric conditions have bands (on above the threshold, off only well below it), and a condition that ended is resolved
  only after it stayed clear for `recover_s`. A part that could not be read is NOT judged: its open rows stay open and no new
  row is made (an unreachable recorder does not resolve its disk alert). Camera connectivity is NOT a source here: the fresh
  channel states feed `camera.offline` (notify_sources.cameras_tick) so a disconnected camera is announced once.

Payloads carry the recorder's and the camera's NAMES only - never an address, a credential, a serial number or a MAC."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import sqlite3
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from ..config import Settings
from ..db import Database, get_setting, set_setting
from ..errors import ApiError
from .recorders.base import HealthReading

log = logging.getLogger("smplwise.recorder_health")

SETTING_KEY = "recorder_health.thresholds"
# key -> (default, minimum, maximum). Defaults: CR-026 section 4 (owner may change them in Settings).
THRESHOLDS: dict[str, tuple[int, int, int]] = {
    "interval_s": (60, 30, 900),           # how often each recorder is read (6 reads per Provision recorder per pass)
    "latency_ms": (1500, 200, 10000),      # an answer slower than this is "slow" (clear below 70 % of it)
    "recording_gap_min": (30, 5, 1440),    # a connected camera that has not recorded this long (continuous mode)
    "clock_drift_s": (60, 5, 3600),        # device clock off the host's by more than this (clear below half of it)
    "disk_fill_days": (3, 0, 60),          # the disks will be full within this many days at the current rate (0 = off)
    "cert_days": (30, 1, 365),             # the pinned certificate expires within this many days
    "recover_s": (120, 0, 3600),           # a condition must stay clear this long before its notification is resolved
}
RECORDING_MODES = ("continuous", "exceptions")  # continuous: every connected camera should record; exceptions: device-reported only
DEFAULT_RECORDING_MODE = "continuous"

SOURCES = ("recorder.unreachable", "recorder.slow", "recorder.disk", "recorder.disk_space", "recorder.recording", "recorder.clock", "recorder.certificate")
DETAIL_SOURCES = SOURCES[2:]
STALE_PASSES = 3            # a recorder whose last read is older than this many intervals is not judged
SAMPLE_EVERY_S = 600        # free-space samples for the fill trend
SAMPLE_KEEP_S = 48 * 3600
TREND_MIN_SPAN_S = 6 * 3600
CHECK_NOW_MIN_S = 15        # "check now" at most this often
BAD_DISK = {"read_only": "alert", "locked": "alert", "unformatted": "critical", "error": "critical", "missing": "critical"}

DISK_TEXT = {"ok": "תקין", "read_only": "לקריאה בלבד", "locked": "נעול", "unformatted": "לא מאותחל", "formatting": "באתחול", "error": "תקלה",
             "missing": "אין דיסק", "unknown": "לא ידוע"}
ERROR_TEXT = {"source_unavailable": "אין תקשורת", "source_timeout": "אין תשובה בזמן", "deadline_exceeded": "אין תשובה בזמן",
              "source_forbidden": "פרטי הגישה נדחו", "tls_pin_mismatch": "תעודת המקליט השתנתה", "tls_pin_missing": "לא נשמרה תעודה למקליט",
              "vendor_not_supported": "סוג המקליט אינו נתמך", "recorder_unavailable": "המקליט אינו מחובר"}


def _now_ts() -> float:
    """The notification core's clock (tests move it), so readings, holds and the screen agree on "now"."""
    from . import notify

    return notify.now_utc().timestamp()


def error_text(code: str | None) -> str:
    return ERROR_TEXT.get(code or "", "אין תשובה")


# ---------------------------------------------------------------- thresholds (Settings)

def thresholds_defaults() -> dict[str, Any]:
    return {**{k: v[0] for k, v in THRESHOLDS.items()}, "recording_mode": DEFAULT_RECORDING_MODE}


def thresholds(conn: sqlite3.Connection) -> dict[str, Any]:
    """The effective thresholds: the stored values over the defaults (a corrupt or out-of-range value reads as its default)."""
    out = thresholds_defaults()
    try:
        stored = json.loads(get_setting(conn, SETTING_KEY) or "{}")
    except (ValueError, sqlite3.Error):
        stored = {}
    if isinstance(stored, dict):
        for k, (_d, lo, hi) in THRESHOLDS.items():
            v = stored.get(k)
            if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi:
                out[k] = v
        if stored.get("recording_mode") in RECORDING_MODES:
            out["recording_mode"] = stored["recording_mode"]
    return out


def validate(body: Any) -> dict[str, Any]:
    """A PUT body -> the values to store (unknown keys refused). ApiError 422 `validation` with the field."""
    if not isinstance(body, dict):
        raise ApiError(422, "validation", "ערכים לא תקינים.")
    out: dict[str, Any] = {}
    for k, v in body.items():
        if k == "recording_mode":
            if v not in RECORDING_MODES:
                raise ApiError(422, "validation", "מצב הקלטה לא מוכר.", details={"field": k})
            out[k] = v
            continue
        spec = THRESHOLDS.get(k)
        if spec is None:
            raise ApiError(422, "validation", "שדה לא מוכר.", details={"field": k})
        if isinstance(v, bool) or not isinstance(v, int) or not spec[1] <= v <= spec[2]:
            raise ApiError(422, "validation", f"הערך מחוץ לטווח ({spec[1]} עד {spec[2]}).", details={"field": k, "min": spec[1], "max": spec[2]})
        out[k] = v
    return out


def save_thresholds(conn: sqlite3.Connection, changes: dict[str, Any]) -> dict[str, Any]:
    current = thresholds(conn)
    current.update(changes)
    set_setting(conn, SETTING_KEY, json.dumps(current, sort_keys=True))
    return current


def ranges() -> dict[str, dict[str, int]]:
    return {k: {"default": d, "min": lo, "max": hi} for k, (d, lo, hi) in THRESHOLDS.items()}


# ---------------------------------------------------------------- in-memory state per recorder

@dataclass
class RecState:
    recorder_id: str
    name: str = ""
    vendor: str = ""
    checked_at: float | None = None
    reachable: bool | None = None
    error: str | None = None
    latency_ms: int | None = None
    model: str | None = None
    firmware: str | None = None
    detail_supported: bool = False
    reading: HealthReading | None = None
    reading_at: float | None = None
    samples: deque = field(default_factory=lambda: deque(maxlen=SAMPLE_KEEP_S // SAMPLE_EVERY_S + 2))  # (ts, free_mb, total_mb)
    rec_seen: dict[int, float] = field(default_factory=dict)    # channel -> last time seen recording
    idle_since: dict[int, float] = field(default_factory=dict)  # channel -> first time seen not recording (since the last recording)


STORE: dict[str, RecState] = {}
_LOCK = threading.Lock()
_LATCH: dict[str, bool] = {}        # band conditions: key -> currently on
_LAST_ACTIVE: dict[str, float] = {}  # key -> last time the condition was active (the recover hold)
_CHECKED = {"at": 0.0}


def reset() -> None:
    """Tests: forget every reading, latch and hold."""
    with _LOCK:
        STORE.clear()
        _LATCH.clear()
        _LAST_ACTIVE.clear()
    _CHECKED["at"] = 0.0


def record(state: RecState, *, reachable: bool, error: str | None, latency_ms: int | None, reading: HealthReading | None, now_ts: float,
           model: str | None = None, firmware: str | None = None) -> None:
    """Store one probe result (the poller; tests call it directly with a reading)."""
    with _LOCK:
        state.checked_at, state.reachable, state.error, state.latency_ms = now_ts, reachable, error, latency_ms
        state.model, state.firmware = model or state.model, firmware or state.firmware
        if reading is None:
            return
        state.reading, state.reading_at = reading, now_ts
        if reading.disks is not None:
            free = sum(d.free_mb or 0 for d in reading.disks if d.state != "missing")
            total = sum(d.total_mb or 0 for d in reading.disks if d.state != "missing")
            if total and (not state.samples or now_ts - state.samples[-1][0] >= SAMPLE_EVERY_S):
                state.samples.append((now_ts, free, total))
            while state.samples and now_ts - state.samples[0][0] > SAMPLE_KEEP_S:
                state.samples.popleft()
        for ch in reading.channels or ():
            if ch.record_state == "recording":
                state.rec_seen[ch.channel] = now_ts
                state.idle_since.pop(ch.channel, None)
            elif ch.record_state in ("idle", "exception"):
                state.idle_since.setdefault(ch.channel, now_ts)


def state_of(recorder_id: str) -> RecState:
    with _LOCK:
        st = STORE.get(recorder_id)
        if st is None:
            st = STORE[recorder_id] = RecState(recorder_id)
        return st


def fresh(state: RecState, interval_s: int, now_ts: float) -> bool:
    return state.checked_at is not None and now_ts - state.checked_at <= STALE_PASSES * interval_s + 5


def channel_connected(recorder_id: str, channel: int, now_ts: float | None = None, interval_s: int | None = None) -> bool | None:
    """The fresh connectivity of one channel (None: no fresh reading says). Used by notify_sources.cameras_tick."""
    now_ts = now_ts or _now_ts()
    with _LOCK:
        st = STORE.get(recorder_id)
        if st is None or not st.reachable or st.reading is None or st.reading.channels is None or st.reading_at is None:
            return None
        if now_ts - st.reading_at > STALE_PASSES * (interval_s or THRESHOLDS["interval_s"][0]) + 5:
            return None
        for ch in st.reading.channels:
            if ch.channel == channel:
                return ch.connected
    return None


def fill_projection(samples: list[tuple[float, int, int]]) -> float | None:
    """Days until the disks are full at the current rate (least squares over the samples), or None: too short a history, free
    space not shrinking, or already full (an NVR that overwrites its oldest recordings stays full - not a fault by itself)."""
    if len(samples) < 2 or samples[-1][0] - samples[0][0] < TREND_MIN_SPAN_S:
        return None
    n = len(samples)
    mx = sum(s[0] for s in samples) / n
    my = sum(s[1] for s in samples) / n
    den = sum((s[0] - mx) ** 2 for s in samples)
    if den <= 0:
        return None
    slope = sum((s[0] - mx) * (s[1] - my) for s in samples) / den  # MB per second
    free, total = samples[-1][1], samples[-1][2]
    if slope >= 0 or free <= 0 or (total and free / total < 0.01):
        return None
    return round(free / -slope / 86400, 1)


# ---------------------------------------------------------------- conditions

@dataclass
class Cond:
    source: str
    key: str
    subject_kind: str
    subject_id: str
    params: dict[str, Any]
    active: bool
    severity: str | None = None
    origin: dict[str, Any] = field(default_factory=dict)
    link: str | None = None


LINK = "#/system/diagnostics?tab=health"


def _band(key: str, value: float | None, on_above: float, off_below: float) -> bool:
    """A latched band: on when value > on_above, off only when value < off_below (no flapping around one threshold)."""
    if value is None:
        return _LATCH.get(key, False)
    was = _LATCH.get(key, False)
    now = value > on_above if not was else value >= off_below
    _LATCH[key] = now
    return now


def _camera_name(row: Any, channel: int) -> str:
    if row is None:
        return f"ערוץ {channel}"
    return str(row["alias"] or row["name_source"] or f"ערוץ {channel}")


def evaluate(state: RecState, th: dict[str, Any], now_ts: float, cameras: dict[int, Any]) -> tuple[list[Cond], set[str]]:
    """One recorder -> (conditions, the sources that cannot be judged now). `cameras` = channel -> camera row (id, alias,
    name_source, enabled) of this recorder; a channel without an enabled camera is not watched for recording."""
    rid = state.recorder_id
    name = state.name or rid
    conds: list[Cond] = []
    unjudged: set[str] = set()
    sys = dict(subject_kind="system", subject_id=rid, link=LINK, origin={"recorder_id": rid})
    if not fresh(state, th["interval_s"], now_ts):
        return conds, set(SOURCES)
    conds.append(Cond("recorder.unreachable", f"recorder.unreachable:{rid}:api", params={"name": name, "detail": error_text(state.error)},
                      active=state.reachable is False, **sys))
    if state.reachable is False:
        return conds, set(DETAIL_SOURCES) | {"recorder.slow"}
    lim = th["latency_ms"]
    slow = _band(f"recorder.slow:{rid}:api", state.latency_ms, lim, lim * 0.7)
    conds.append(Cond("recorder.slow", f"recorder.slow:{rid}:api", params={"name": name, "detail": f"זמן תגובה {state.latency_ms or 0} מ״ש"}, active=slow, **sys))
    r = state.reading
    if r is None or not state.detail_supported:
        return conds, set(DETAIL_SOURCES)
    # disks
    if r.disks is None:
        unjudged |= {"recorder.disk", "recorder.disk_space"}
    else:
        for d in r.disks:
            sev = BAD_DISK.get(d.state)
            label = "אין דיסק במקליט" if d.state == "missing" else f"דיסק {d.ref}: {DISK_TEXT.get(d.state, d.state)}"
            conds.append(Cond("recorder.disk", f"recorder.disk:{rid}:{d.ref}", params={"name": name, "detail": label}, active=sev is not None,
                              severity=sev, **sys))
        conds.append(Cond("recorder.disk", f"recorder.disk:{rid}:alarm", params={"name": name, "detail": "המקליט מדווח על תקלת דיסק"},
                          active=bool(r.disk_alarms), severity="critical", **sys))
        days = fill_projection(list(state.samples))
        limit = th["disk_fill_days"]
        on = bool(limit) and _band(f"recorder.disk_space:{rid}:fill", -days if days is not None else -10_000.0, -limit, -limit * 1.5)
        conds.append(Cond("recorder.disk_space", f"recorder.disk_space:{rid}:fill", params={"name": name, "detail": f"יתמלא בעוד כ־{days} ימים" if days is not None else "מתמלא"},
                          active=on, **sys))
    # recording
    if r.channels is None or all(c.record_state is None for c in r.channels):
        unjudged.add("recorder.recording")
    else:
        gap = th["recording_gap_min"] * 60
        for c in r.channels:
            cam = cameras.get(c.channel)
            if cam is None or not cam["enabled"] or c.record_state is None:
                continue
            stopped = False
            if c.connected is not False:  # a disconnected camera is `camera.offline`, not a recording fault
                if c.record_state == "exception":
                    stopped = True
                elif th["recording_mode"] == "continuous" and c.record_state == "idle":
                    stopped = now_ts - state.idle_since.get(c.channel, now_ts) >= gap
            cname = _camera_name(cam, c.channel)
            detail = "תקלת הקלטה" if c.record_state == "exception" else f"לא מקליט יותר מ־{th['recording_gap_min']} דקות"
            conds.append(Cond("recorder.recording", f"recorder.recording:{rid}:{c.channel}", subject_kind="camera", subject_id=str(cam["id"]),
                              params={"name": cname, "place": name, "detail": detail}, active=stopped, origin={"recorder_id": rid, "camera_id": cam["id"]}))
    # clock
    if r.clock_drift_s is None:
        if "clock" in r.errors:
            unjudged.add("recorder.clock")
    else:
        lim_s = th["clock_drift_s"]
        on = _band(f"recorder.clock:{rid}:drift", abs(r.clock_drift_s), lim_s, lim_s / 2)
        ahead = "מקדים" if r.clock_drift_s > 0 else "מאחר"
        conds.append(Cond("recorder.clock", f"recorder.clock:{rid}:drift", params={"name": name, "detail": f"{ahead} ב־{abs(round(r.clock_drift_s))} שניות"}, active=on, **sys))
    # certificate (pinned HTTPS only)
    if "certificate" in r.errors:
        unjudged.add("recorder.certificate")
    elif r.certificate and r.certificate.get("not_after"):
        left = cert_days_left(str(r.certificate["not_after"]), now_ts)
        if left is not None:
            on = left < th["cert_days"]
            detail = "התעודה פגה" if left <= 0 else f"פגה בעוד {int(left)} ימים"
            conds.append(Cond("recorder.certificate", f"recorder.certificate:{rid}:tls", params={"name": name, "detail": detail}, active=on,
                              severity="critical" if left <= 0 else None, **sys))
    return conds, unjudged


def cert_days_left(not_after: str, now_ts: float) -> float | None:
    try:
        end = dt.datetime.fromisoformat(not_after.replace("Z", "+00:00"))
    except ValueError:
        return None
    if end.tzinfo is None:
        end = end.replace(tzinfo=dt.timezone.utc)
    return (end.timestamp() - now_ts) / 86400


# ---------------------------------------------------------------- the notification pass (inside notify_sources.tick)

def _cameras_by_recorder(conn: sqlite3.Connection) -> dict[str, dict[int, Any]]:
    out: dict[str, dict[int, Any]] = {}
    for row in conn.execute("SELECT id, recorder_id, channel, alias, name_source, enabled FROM cameras ORDER BY recorder_id, channel LIMIT 2000").fetchall():
        out.setdefault(str(row["recorder_id"]), {})[int(row["channel"])] = row
    return out


def tick(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, dict[str, int]]:
    """Every recorder's conditions -> `reconcile` per source. A recorder no longer monitored has no conditions, so its open
    rows are resolved."""
    from . import notify
    from .notify_policy import get_policy
    from .notify_sources import held, reconcile

    ts = now.timestamp()
    th = thresholds(conn)
    cams = _cameras_by_recorder(conn)
    with _LOCK:
        states = list(STORE.values())
    conds: list[Cond] = []
    keep: list[tuple[str, str]] = []  # (source, key prefix) whose open rows stay open (not judged this pass)
    for st in states:
        c, unjudged = evaluate(st, th, ts, cams.get(st.recorder_id, {}))
        conds.extend(c)
        keep.extend((s, f"{s}:{st.recorder_id}:") for s in unjudged)
    # the primary NVR's "not answering" is already told by nvr.offline (its alert stream): one announcement per root cause
    primary_offline = conn.execute("SELECT 1 FROM notifications WHERE source = 'nvr.offline' AND state != 'resolved' LIMIT 1").fetchone() is not None
    recover = th["recover_s"]
    res: dict[str, dict[str, int]] = {}
    for source in SOURCES:
        hold = int((get_policy(conn, source) or {}).get("after_s") or 0)
        due: dict[str, notify.Signal] = {}
        active: set[str] = set()
        for c in (x for x in conds if x.source == source):
            if c.active:
                _LAST_ACTIVE[c.key] = ts
                active.add(c.key)
            elif ts - _LAST_ACTIVE.get(c.key, -1e12) < recover:
                active.add(c.key)  # cleared, but not for long enough to resolve (no flapping)
            sig = notify.Signal(source, c.subject_kind, c.subject_id, severity=c.severity, dedupe_key=c.key, params=c.params, origin=c.origin, link=c.link)
            if held(c.key, c.active, hold, ts) and not (source == "recorder.unreachable" and c.subject_id == "nvr-1" and primary_offline):
                due[c.key] = sig
        prefixes = [p for s, p in keep if s == source]
        if prefixes:
            for (k,) in conn.execute("SELECT dedupe_key FROM notifications WHERE source = ? AND state != 'resolved'", (source,)).fetchall():
                if any(k.startswith(p) for p in prefixes):
                    active.add(k)
        res[source] = reconcile(conn, source, due, active, now)
    return res


# ---------------------------------------------------------------- the poller

def _targets(db: Database, settings: Settings, only: str | None = None) -> list[tuple[str, str, str, Any]]:
    """(recorder id, name, vendor, adapter) for every ready recorder, built under a short read connection (no device I/O)."""
    from ..recorder_scope import ready_ids
    from .recorders import registry

    out = []
    with db.connection(mode="read", label="recorder_health.targets") as conn:
        names = {}
        try:
            names = {r["id"]: (r["name"], r["vendor"], r["enabled"], r["removed_at"]) for r in conn.execute("SELECT id, name, vendor, enabled, removed_at FROM recorders").fetchall()}
        except sqlite3.OperationalError:
            pass
        for rid in ready_ids(settings):
            if only and rid != only:
                continue
            meta = names.get(rid)
            if meta and (meta[3] or meta[2] == 0):
                continue  # removed or disabled
            try:
                adapter = registry.adapter_for(conn, settings, rid)
            except ApiError:
                continue
            out.append((rid, (meta[0] if meta else None) or rid, getattr(adapter, "vendor", ""), adapter))
    return out


def probe(rid: str, name: str, vendor: str, adapter: Any, now_ts: float | None = None) -> RecState:
    """One recorder: `health()` (reachability, latency), then `read_health()` when the adapter declares it. Read-only."""
    from . import nvr

    st = state_of(rid)
    st.name, st.vendor = name, vendor
    try:
        detail = bool(adapter.capabilities().health_detail)
    except Exception:  # noqa: BLE001
        detail = False
    st.detail_supported = detail
    t0 = time.monotonic()
    with nvr.deadline(30.0):
        try:
            h = adapter.health()
            online, error, model, firmware = h.online, h.error, h.model, h.firmware
        except ApiError as exc:
            online, error, model, firmware = False, exc.code, None, None
        latency = int((time.monotonic() - t0) * 1000)
        reading = None
        if online and detail:
            try:
                reading = adapter.read_health()
            except ApiError as exc:
                online, error = False, exc.code
    record(st, reachable=bool(online), error=error, latency_ms=latency if online else None, reading=reading, now_ts=now_ts or _now_ts(),
           model=model, firmware=firmware)
    return st


def poll_once(db: Database, settings: Settings, only: str | None = None) -> int:
    targets = _targets(db, settings, only)
    if only is None:
        ids = {t[0] for t in targets}
        with _LOCK:
            for rid in [r for r in STORE if r not in ids]:
                STORE.pop(rid, None)  # removed / disabled: its rows resolve at the next tick
    for rid, name, vendor, adapter in targets:
        try:
            probe(rid, name, vendor, adapter)
        except Exception:  # noqa: BLE001 - one recorder never stops the others
            log.exception("recorder health probe %s failed", rid)
    return len(targets)


def check_now(db: Database, settings: Settings) -> bool:
    """The health screen's "check now": one pass, at most every CHECK_NOW_MIN_S. False when skipped."""
    if time.monotonic() - _CHECKED["at"] < CHECK_NOW_MIN_S and _CHECKED["at"]:
        return False
    _CHECKED["at"] = time.monotonic()
    poll_once(db, settings)
    return True


class Poller:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()

    def start(self, db: Database, settings: Settings) -> None:
        if os.environ.get("SW_RECORDER_HEALTH", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._loop, args=(db, settings), name="recorder-health", daemon=True)
        self.thread.start()

    def shutdown(self, timeout: float = 3.0) -> None:
        self.stop_evt.set()
        t = self.thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=timeout)

    def _loop(self, db: Database, settings: Settings) -> None:
        if self.stop_evt.wait(15.0):
            return
        while not self.stop_evt.is_set():
            interval = THRESHOLDS["interval_s"][0]
            try:
                with db.connection(mode="read", label="recorder_health.interval") as conn:
                    interval = thresholds(conn)["interval_s"]
                poll_once(db, settings)
            except Exception:  # noqa: BLE001 - the poller never dies on one bad pass
                log.exception("recorder health pass failed")
            self.stop_evt.wait(interval)


POLLER = Poller()


# ---------------------------------------------------------------- the health screen

def _section(state: str, **kw: Any) -> dict[str, Any]:
    return {"state": state, **kw}


def view(conn: sqlite3.Connection, settings: Settings, now_ts: float | None = None) -> list[dict[str, Any]]:
    """One entry per monitored recorder for GET /recorder-health. Section states: ok | warn | error | unknown | off (the vendor
    does not report it). Names only, never an address."""
    from ..recorder_scope import ready_ids

    now_ts = now_ts or _now_ts()
    th = thresholds(conn)
    cams = _cameras_by_recorder(conn)
    with _LOCK:
        states = {k: v for k, v in STORE.items()}
    try:
        names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM recorders WHERE removed_at IS NULL").fetchall()}
    except sqlite3.OperationalError:
        names = {}
    ids = [rid for rid in ready_ids(settings)] + [rid for rid in states if rid not in ready_ids(settings)]
    out = []
    for rid in ids:
        st = states.get(rid)
        if st is None:
            out.append({"id": rid, "name": names.get(rid) or rid, "status": "unknown", "checked_at": None, "detail_supported": False,
                        "api": _section("unknown"), "disks": None, "recording": None, "channels": None, "clock": None, "certificate": None})
            continue
        out.append(_recorder_view(st, th, now_ts, cams.get(rid, {}), names.get(rid)))
    return out


def _iso(ts: float | None) -> str | None:
    return None if ts is None else dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _recorder_view(st: RecState, th: dict[str, Any], now_ts: float, cams: dict[int, Any], name: str | None) -> dict[str, Any]:
    is_fresh = fresh(st, th["interval_s"], now_ts)
    if not is_fresh:
        api = _section("unknown", latency_ms=None, error=None)
    elif st.reachable is False:
        api = _section("error", latency_ms=None, error=st.error, text=error_text(st.error))
    else:
        slow = (st.latency_ms or 0) > th["latency_ms"]
        api = _section("warn" if slow else "ok", latency_ms=st.latency_ms, error=None)
    r = st.reading if (st.detail_supported and is_fresh and st.reachable) else None
    off = None if st.detail_supported else _section("off")
    disks = recording = channels = clock = cert = off
    if r is not None:
        recording_ok = True
        if r.channels is not None:
            watched = [c for c in r.channels if (cams.get(c.channel) is not None and cams[c.channel]["enabled"]) or not cams]
            stopped, exception = [], []
            for c in watched:
                if c.connected is False or c.record_state is None:
                    continue
                nm = _camera_name(cams.get(c.channel), c.channel)
                if c.record_state == "exception":
                    exception.append({"channel": c.channel, "name": nm})
                elif c.record_state == "idle" and th["recording_mode"] == "continuous" and now_ts - st.idle_since.get(c.channel, now_ts) >= th["recording_gap_min"] * 60:
                    stopped.append({"channel": c.channel, "name": nm, "since": _iso(st.idle_since.get(c.channel))})
            rec_n = sum(1 for c in watched if c.record_state == "recording")
            reported = [c for c in watched if c.record_state is not None and c.connected is not False]
            recording_ok = not stopped and not exception
            recording = _section("error" if exception else "warn" if stopped else "ok" if reported else "unknown", recording=rec_n, watched=len(reported),
                                 stopped=stopped, exception=exception, mode=th["recording_mode"])
            down = [{"channel": c.channel, "name": _camera_name(cams.get(c.channel), c.channel)} for c in watched if c.connected is False]
            known = [c for c in watched if c.connected is not None]
            channels = _section("warn" if down else "ok" if known else "unknown", total=len(known), connected=sum(1 for c in known if c.connected), disconnected=down)
        elif "recording" in r.errors or "channels" in r.errors:
            recording = channels = _section("unknown")
        if r.disks is not None:
            bad = [d for d in r.disks if d.state in BAD_DISK]
            free = sum(d.free_mb or 0 for d in r.disks)
            total = sum(d.total_mb or 0 for d in r.disks)
            pct = round(free * 100 / total, 1) if total else None
            days = fill_projection(list(st.samples))
            full = pct is not None and pct < 1
            filling = days is not None and th["disk_fill_days"] and days < th["disk_fill_days"]
            state = "error" if bad or r.disk_alarms else "warn" if filling or (full and not recording_ok) else "ok"
            disks = _section(state, items=[{"ref": d.ref, "state": d.state, "text": DISK_TEXT.get(d.state, d.state), "total_mb": d.total_mb, "free_mb": d.free_mb} for d in r.disks],
                             free_mb=free, total_mb=total, free_pct=pct, full=full, fill_days=days, alarms=list(r.disk_alarms))
        elif "disks" in r.errors:
            disks = _section("unknown")
        if r.clock_drift_s is not None:
            d = r.clock_drift_s
            clock = _section("warn" if abs(d) > th["clock_drift_s"] else "ok", drift_s=d, sync=r.clock_sync)
        else:
            clock = _section("unknown")
        if r.certificate and r.certificate.get("not_after"):
            left = cert_days_left(str(r.certificate["not_after"]), now_ts)
            cert = _section("error" if left is not None and left <= 0 else "warn" if left is not None and left < th["cert_days"] else "ok",
                            not_after=r.certificate.get("not_after"), days_left=None if left is None else int(left), self_signed=r.certificate.get("self_signed"))
        else:
            cert = None  # not a pinned HTTPS connection: nothing to show
    elif st.detail_supported:
        disks = recording = channels = clock = _section("unknown")
        cert = None
    parts = [api] + [p for p in (disks, recording, channels, clock, cert) if p]
    states = [p["state"] for p in parts]
    status = "error" if "error" in states else "warn" if "warn" in states else "unknown" if api["state"] == "unknown" else "ok"
    return {"id": st.recorder_id, "name": name or st.name or st.recorder_id, "vendor": st.vendor, "status": status, "checked_at": _iso(st.checked_at),
            "detail_supported": st.detail_supported, "model": st.model, "firmware": st.firmware,
            "api": api, "disks": disks, "recording": recording, "channels": channels, "clock": clock, "certificate": cert}
