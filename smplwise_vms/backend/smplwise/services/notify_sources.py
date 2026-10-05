"""Notification sources of the product itself (CR-018 section 5, S2): health and fault monitors, the WisKey doorbell, schedule runs, bulk and
scene results, backups, the add-on update check, new remote sign-ins and code lockouts, and the emit-able hook for CR-017's automation
failures. HA entities (leak / smoke / gas / CO, doors and windows left open, batteries, unavailable devices, the alarm panel, the doorbell
event entity) are in services/notify_sensors.py; rule alerts are emitted by services/rules.py (S1).

A source only SIGNALS (`notify.emit`). It decides nothing about who is told or how: the source's policy (administrator, notify.manage) and
services/notify_visibility do, and the notifier thread (services/push.PushNotifier) sends after the commit. No source here sends anything.

THREE KINDS OF CALLER
- State monitors (`tick`, every TICK_S on a thread of this module): a condition is read from facts that are already in the database or in
  memory (the health summary, cameras and events, ha_entities, the backups folder) and RECONCILED with the open notifications of its source:
  a condition that holds for the policy's `after_s` and has no open row is announced once; an open row whose condition ended is resolved. A
  restart loses no row (the open rows are the state) and no work is unbounded (every pass has a limit; a network call - the Supervisor's
  update check - runs with no database connection held).
- Edges inside a transaction the caller already holds (a schedule run settled, a bulk finished, a code lockout, the HA state hook): emit on
  that connection; the row commits or rolls back with the caller.
- Edges outside any transaction or on a thread that must not write (the WisKey feed's event loop, a sign-in, the daily backup): `submit()`
  queues the signal and this module's thread writes it - a slow database never stalls a feed or a request.

Every hook is wrapped: a notification problem must never break ingestion, a sign-in, a backup or a state update. Payloads carry names of
devices and places and never a person, a visitor, an image, a `last_access` field or an address.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import logging
import os
import queue
import re
import sqlite3
import threading
import time
from typing import Any, Callable

from ..config import Settings
from ..db import Database, retry_locked
from .. import __version__
from . import notify, self_update
from .notify_policy import get_policy
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.notify")

TICK_S = 30.0            # the monitors' cadence; the instant sources do not wait for it
FIRST_TICK_S = 20.0
MAX_PER_PASS = 100       # announcements one family may make in one pass (a storm of unavailable devices drains over a few passes)
RING_TTL_S = 120         # a doorbell row nobody resolved (the HA event entity has no "ended") closes by itself
STATION_RING_TTL_S = 900  # a WisKey ring whose end was never seen (a dropped feed)
ARM_WATCH_S = 300        # arm / scene requests younger than this are judged
STORAGE_HOLD_S = 7200    # an NVR storage fault the device stopped repeating this long ago is over
BACKUP_STALE_S = 2 * 86400


# ---------------------------------------------------------------- signals from threads that hold no transaction

_SIGNALS: "queue.Queue[notify.Signal]" = queue.Queue(maxsize=1000)


def submit(signal: "notify.Signal") -> bool:
    """Queue a signal for this module's thread to write (never blocks, never raises). False when the queue is full."""
    try:
        _SIGNALS.put_nowait(signal)
    except queue.Full:
        log.warning("notification signal queue full; %s dropped", signal.source)
        return False
    return True


def _take(limit: int) -> list["notify.Signal"]:
    items: list[notify.Signal] = []
    while len(items) < limit:
        try:
            items.append(_SIGNALS.get_nowait())
        except queue.Empty:
            break
    return items


def _write_batch(db: Database, items: list["notify.Signal"]) -> int:
    if not items:
        return 0

    def _write() -> None:
        with db.connection(label="notify.signals") as conn:
            for s in items:
                try:
                    conn.execute("SAVEPOINT notify_signal")
                    notify.emit_full(conn, s)
                    conn.execute("RELEASE notify_signal")
                except Exception:  # noqa: BLE001 - one bad signal never costs the others
                    log.exception("notification signal %s failed", s.source)
                    conn.execute("ROLLBACK TO notify_signal")
                    conn.execute("RELEASE notify_signal")

    try:
        retry_locked(_write, what="notification signals", attempts=3, base_s=0.25)
    except Exception:  # noqa: BLE001
        log.exception("notification signals could not be written; %d dropped", len(items))
        return 0
    return len(items)


def flush_signals(db: Database, limit: int = 100) -> int:
    """Write every queued signal in one short transaction (the thread of this module calls it; tests call it directly)."""
    return _write_batch(db, _take(limit))


def safe(fn: Callable[..., Any]) -> Callable[..., Any]:
    """A notification hook never raises into its caller."""
    def wrapper(*a: Any, **k: Any) -> Any:
        try:
            return fn(*a, **k)
        except Exception:  # noqa: BLE001
            log.exception("notification source %s failed", fn.__name__)
            return None

    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


# ---------------------------------------------------------------- the monitor thread

class Monitor:
    """One daemon thread: writes the queued signals the moment they arrive and runs `tick` every TICK_S."""

    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()
        self.db: Database | None = None
        self.settings: Settings | None = None

    @property
    def running(self) -> bool:
        return bool(self.thread and self.thread.is_alive()) and not self.stop_evt.is_set()

    def start(self, db: Database, settings: Settings) -> None:
        if self.running:
            return
        self.db, self.settings = db, settings
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._loop, name="notify-sources", daemon=True)
        self.thread.start()

    def shutdown(self, timeout: float = 3.0) -> None:
        self.stop_evt.set()
        t = self.thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=timeout)

    def _loop(self) -> None:
        assert self.db is not None and self.settings is not None
        next_tick = time.monotonic() + FIRST_TICK_S
        while not self.stop_evt.is_set():
            try:
                first = _SIGNALS.get(timeout=max(0.05, min(1.0, next_tick - time.monotonic())))
            except queue.Empty:
                first = None
            if self.stop_evt.is_set():
                return
            try:
                if first is not None:
                    _write_batch(self.db, [first, *_take(99)])
                if time.monotonic() >= next_tick:
                    next_tick = time.monotonic() + TICK_S
                    tick(self.db, self.settings)
            except Exception:  # noqa: BLE001 - the monitor never dies on one bad pass
                log.exception("notification monitor pass failed")


MONITOR = Monitor()


def start(db: Database, settings: Settings) -> None:
    MONITOR.start(db, settings)


def shutdown() -> None:
    MONITOR.shutdown()


# ---------------------------------------------------------------- held conditions and the reconcile step

_SINCE: dict[str, float] = {}  # dedupe key -> first time seen active (epoch s): the timer of a condition no database column dates
_since_lock = threading.Lock()


def held(key: str, active: bool, hold_s: int, now_ts: float) -> bool:
    """Whether an `active` condition has been active for `hold_s`; an inactive one forgets its start."""
    with _since_lock:
        if not active:
            _SINCE.pop(key, None)
            return False
        t0 = _SINCE.setdefault(key, now_ts)
    return now_ts - t0 >= hold_s


def reset() -> None:
    """Tests: forget every held condition, queued signal and the update-check clock."""
    with _since_lock:
        _SINCE.clear()
    _take(10_000)
    _UPDATE["checked"] = 0.0
    _HANDLED.clear()


def reconcile(conn: sqlite3.Connection, source: str, due: dict[str, "notify.Signal"], active: set[str], now: dt.datetime, limit: int = MAX_PER_PASS) -> dict[str, int]:
    """Make the open notifications of `source` say what is true now.

    `due`    dedupe key -> the signal of a condition that has held long enough to be announced;
    `active` the keys whose condition holds right now (a superset of `due`) or must not be resolved (a sensor that went unavailable while
             wet, a battery between its low and recovered thresholds, a family that cannot be judged this pass).
    A due condition with no open row is announced once (emit); one whose open row is older than the policy's fold window is announced again
    (a daily reminder: the old row is superseded). An open row whose key is not active is resolved. Emits at most `limit` per call."""
    out = {"emitted": 0, "resolved": 0}
    pol = get_policy(conn, source) or {}
    window = int(pol.get("dedupe_window_s") or 0)
    open_rows = {r["dedupe_key"]: r for r in conn.execute("SELECT dedupe_key, subject_kind, subject_id, last_at FROM notifications WHERE source = ? AND state != 'resolved'", (source,)).fetchall()}
    if pol.get("enabled", True):
        for key, sig in due.items():
            row = open_rows.get(key)
            if row is not None and not (window and (now - parse_utc(row["last_at"])).total_seconds() > window):
                continue
            if out["emitted"] >= limit:
                break
            sig.dedupe_key = key
            if notify.emit_full(conn, sig).action in ("created", "renotified"):
                out["emitted"] += 1
    for key, row in open_rows.items():
        if key in active or key in due:
            continue
        if notify.emit_full(conn, notify.Signal(source, row["subject_kind"], row["subject_id"], dedupe_key=key, resolve=True)).action == "resolved":
            out["resolved"] += 1
    return out


def _any_row(conn: sqlite3.Connection, key: str) -> bool:
    """A notification with this dedupe key exists in ANY state: an event-like source (an arm request, a scene) that was already told
    about is never told again, even after the row was acknowledged and resolved."""
    return conn.execute("SELECT 1 FROM notifications WHERE dedupe_key = ? LIMIT 1", (key,)).fetchone() is not None


# ---------------------------------------------------------------- the 30 s pass

def tick(db: Database, settings: Settings, now: dt.datetime | None = None) -> dict[str, Any]:
    """One monitor pass: health items, camera and NVR faults, backups, the update check, arm / scene results, entity conditions, doorbell
    expiry. One write transaction per group; a failing group is logged and skipped, never the others."""
    from . import ha_sync, health_report, notify_sensors

    now = now or notify.now_utc()
    out: dict[str, Any] = {"signals": flush_signals(db)}
    backups = _backup_facts(settings)  # the backups folder is read here, never under a database connection

    def group(name: str, fn: Callable[[], Any]) -> None:
        try:
            out[name] = fn()
        except Exception:  # noqa: BLE001
            log.exception("notification monitor group %s failed", name)

    def health() -> Any:
        with db.connection(mode="read", label="notify.health.read") as conn:
            summary = health_report.summary(settings, conn)
        with db.connection(label="notify.health") as conn:
            return health_tick(conn, summary, backups, now)

    def cameras() -> Any:
        with db.connection(label="notify.faults") as conn:
            return {**cameras_tick(conn, now), **storage_tick(conn, now)}

    def sensors() -> Any:
        with db.connection(label="notify.sensors") as conn:
            return notify_sensors.scan(conn, bool(ha_sync.STATE.connected), now)

    def actions() -> Any:
        with db.connection(label="notify.actions") as conn:
            return action_results(conn, now)

    def sweeps() -> Any:
        with db.connection(label="notify.sweeps") as conn:
            return {**ring_expiry(conn, now), **backup_resolution(conn, backups)}

    def recorders() -> Any:
        from . import recorder_health  # CR-026: the poller's readings -> recorder.* notifications (no device I/O here)

        with db.connection(label="notify.recorders") as conn:
            return recorder_health.tick(conn, now)

    group("health", health)
    group("faults", cameras)
    group("sensors", sensors)
    group("actions", actions)
    group("sweeps", sweeps)
    group("recorders", recorders)
    group("update", lambda: update_tick(db, settings, now.timestamp()))
    return out


# ---------------------------------------------------------------- health, NVR, backups

# summary() item ids that mean the system itself is unwell (CR section 5). The NVR has its own source; these are `system.health`.
HEALTH_ITEMS = {"ha": "תשתית המערכת מנותקת", "go2rtc": "שירות הווידאו לא מסתנכרן", "discovery": "גילוי המצלמות נכשל", "thumbnails": "תמונות האירועים אינן נוצרות"}


def _backup_facts(settings: Settings) -> dict[str, Any]:
    from . import backup as backup_svc, health_report

    try:
        items = backup_svc.list_backups(settings)
    except OSError:
        return {"known": False}
    if items:
        return {"known": True, "none": False, "age_s": health_report._age_s(items[0]["created_at"]), "newest_at": items[0]["created_at"]}
    return {"known": True, "none": True, "age_s": None, "uptime_s": time.time() - health_report.STARTED}


def health_tick(conn: sqlite3.Connection, summary: dict[str, Any], backups: dict[str, Any], now: dt.datetime) -> dict[str, dict[str, int]]:
    """`nvr.offline` for the NVR item in `error`, `system.health` for the items of HEALTH_ITEMS that are unwell (warn or error: Home Assistant
    and go2rtc are `warn` while disconnected), `backup.stale` for a backup older than two days (or none after two days of running)."""
    ts = now.timestamp()
    items = {i["id"]: i for i in summary.get("items", [])}
    res: dict[str, dict[str, int]] = {}

    def run(source: str, conds: list[tuple[notify.Signal, bool]]) -> None:
        hold = int((get_policy(conn, source) or {}).get("after_s") or 0)
        due: dict[str, notify.Signal] = {}
        active: set[str] = set()
        for sig, on in conds:
            key = notify.dedupe_key_of(sig)
            if on:
                active.add(key)
            if held(key, on, hold, ts):
                due[key] = sig
        res[source] = reconcile(conn, source, due, active, now)

    nvr = items.get("nvr")
    run("nvr.offline", [(notify.Signal("nvr.offline", "system", "nvr", params={"name": "המקליט"}), bool(nvr and nvr["status"] == "error"))])
    run("system.health", [(notify.Signal("system.health", "system", iid, params={"name": text}), bool(items.get(iid) and items[iid]["status"] in ("warn", "error"))) for iid, text in HEALTH_ITEMS.items()])
    stale = False
    text = "הגיבוי האחרון ישן מיומיים"
    if backups.get("known"):
        if backups.get("none"):
            stale, text = backups.get("uptime_s", 0) > BACKUP_STALE_S, "אין גיבוי של הפרויקט"
        else:
            stale = (backups.get("age_s") or 0) > BACKUP_STALE_S
    run("backup.stale", [(notify.Signal("backup.stale", "system", "backups", params={"name": text}), stale)])
    return res


def _camera_name(row: sqlite3.Row) -> str:
    return str(row["alias"] or row["name_source"] or f"ערוץ {row['channel']}")


def cameras_tick(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, dict[str, int]]:
    """`camera.offline`. A camera is offline when the last discovery says so, or when the NVR reported a video loss for it after the
    last discovery (the loss event is never closed by the device - a discovery that finds the channel online is what ends it). The
    policy's `after_s` is held by a timer, so a flapping channel makes no row. CR-026: when the recorder health monitor has a fresh
    reading of the channel (connected or not), that reading decides - camera disconnect / reconnect is noticed within a minute."""
    from . import recorder_health

    ts = now.timestamp()
    hold = int((get_policy(conn, "camera.offline") or {}).get("after_s") or 0)
    cutoff = iso_utc(now - dt.timedelta(hours=24))
    rows = conn.execute(
        """SELECT c.id, c.recorder_id, c.alias, c.name_source, c.channel, c.status, c.last_seen_at,
                  (SELECT MAX(COALESCE(e.ended_at, e.occurred_at)) FROM events e
                    WHERE e.camera_id = c.id AND e.source = 'alertstream' AND e.type = 'offline' AND e.state = 'active' AND e.occurred_at >= ?) AS loss_at,
                  (SELECT e.id FROM events e WHERE e.camera_id = c.id AND e.source = 'alertstream' AND e.type = 'offline' AND e.state = 'active' AND e.occurred_at >= ?
                    ORDER BY e.occurred_at DESC LIMIT 1) AS loss_event
           FROM cameras c WHERE c.enabled = 1 ORDER BY c.recorder_id, c.channel LIMIT 500""",  # CR-024: every recorder's cameras
        (cutoff, cutoff),
    ).fetchall()
    due: dict[str, notify.Signal] = {}
    active: set[str] = set()
    for r in rows:
        offline = r["status"] == "offline"
        if not offline and r["loss_at"]:
            try:
                offline = r["last_seen_at"] is None or parse_utc(r["loss_at"]) > parse_utc(r["last_seen_at"])
            except ValueError:
                offline = False
        live = recorder_health.channel_connected(str(r["recorder_id"]), int(r["channel"]), ts)
        if live is not None:  # CR-026: a fresh health read of the recorder (every minute) is newer than discovery and the loss event
            offline = not live
        sig = notify.Signal("camera.offline", "camera", r["id"], params={"name": _camera_name(r), "place": _camera_name(r)}, origin={"camera_id": r["id"], "event_id": r["loss_event"]})
        key = notify.dedupe_key_of(sig)
        if offline:
            active.add(key)
        if held(key, offline, hold, ts):
            due[key] = sig
    return {"camera.offline": reconcile(conn, "camera.offline", due, active, now)}


STORAGE_TEXT = {"diskfull": "הדיסק במקליט מלא", "diskerror": "תקלה בדיסק במקליט"}


def storage_tick(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, dict[str, int]]:
    """`nvr.storage` from the NVR's own fault events (diskfull / diskerror): active while the device keeps reporting it, over once it has
    been quiet for STORAGE_HOLD_S (or the device reports it inactive). Instant: no hold."""
    since = iso_utc(now - dt.timedelta(seconds=STORAGE_HOLD_S))
    ev = conn.execute(
        "SELECT id, raw_type FROM events WHERE source = 'alertstream' AND type = 'storage' AND state = 'active' AND COALESCE(ended_at, occurred_at) >= ? ORDER BY occurred_at DESC LIMIT 1", (since,)
    ).fetchone()
    sig = notify.Signal("nvr.storage", "system", "nvr-storage", params={"name": STORAGE_TEXT.get(str(ev["raw_type"] if ev else "").lower(), "תקלת אחסון במקליט")}, origin={"event_id": ev["id"] if ev else None})
    key = notify.dedupe_key_of(sig)
    return {"nvr.storage": reconcile(conn, "nvr.storage", {key: sig} if ev else {}, {key} if ev else set(), now)}


@safe
def backup_failed(db: Database) -> None:
    """The daily backup raised: `backup.failed` (managers, email by default). Resolved by backup_resolution once a newer backup exists."""
    with db.connection(label="notify.backup") as conn:
        notify.emit_full(conn, notify.Signal("backup.failed", "system", "backup"))


def backup_resolution(conn: sqlite3.Connection, backups: dict[str, Any]) -> dict[str, int]:
    """A newer good backup than the failure resolves `backup.failed` ("next ok backup"). `backups` = _backup_facts (read outside the connection)."""
    row = conn.execute("SELECT id, last_at FROM notifications WHERE source = 'backup.failed' AND state != 'resolved' ORDER BY last_at DESC LIMIT 1").fetchone()
    newest = backups.get("newest_at")
    if row is None or not newest:
        return {"backup_resolved": 0}
    if parse_utc(newest) > parse_utc(row["last_at"]):
        notify.emit_full(conn, notify.Signal("backup.failed", "system", "backup", resolve=True, params={"resolution": "next_backup_ok"}))
        return {"backup_resolved": 1}
    return {"backup_resolved": 0}


# ---------------------------------------------------------------- update available (Supervisor, add-on only)

_UPDATE: dict[str, float] = {"checked": 0.0}
_LAST_FAILED: list[self_update.CheckOutcome] = []  # the scheduled read's failure, for the caller to record
UPDATE_FETCHER: Callable[[Settings], dict[str, Any] | None] | None = None  # tests install a fake; None = the Supervisor
_VERSION = self_update.VERSION_RE


def _fetch_update(settings: Settings) -> dict[str, Any] | None:
    """{update_available, version_latest, version?} or None. The scheduled check only READS (CR-021 D4: the store is refreshed by the
    manual button alone)."""
    if UPDATE_FETCHER is not None:
        return UPDATE_FETCHER(settings)
    if not self_update.configured(settings):
        return None  # a developer backend never asks the Supervisor
    out = self_update.run_check(settings, refresh=False)  # read-only; no database connection is held
    if out.info is None:
        _LAST_FAILED[:] = [out]
        return None
    return {"update_available": out.info.update_available, "version_latest": out.info.latest, "version": out.info.installed}


def update_tick(db: Database, settings: Settings, now_ts: float) -> str:
    """At most every `update.interval_hours` (default 6, 0 = off): `update.available` for a newer add-on version (one row per version,
    managers, email), resolved once it is installed (the Supervisor stops reporting it). The result is also kept as `update.*` settings for
    the CR-021 page and the user-menu marker."""
    with db.connection(mode="read", label="notify.update.interval") as rconn:
        hours = self_update.get_interval(rconn)
    if hours == 0:
        return "off"
    if now_ts - _UPDATE["checked"] < hours * 3600:
        return "skipped"
    _UPDATE["checked"] = now_ts
    _LAST_FAILED.clear()
    info = _fetch_update(settings)  # the network call, before any connection
    now = dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)
    if info is None:
        if _LAST_FAILED:  # a configured infrastructure that did not answer: the page shows when and why
            with db.connection(label="notify.update") as conn:
                self_update.record(conn, _LAST_FAILED[0], now, refresh=False)
        return "unknown"
    latest = str(info.get("version_latest") or "")
    available = bool(info.get("update_available")) and bool(_VERSION.fullmatch(latest))
    sig = notify.Signal("update.available", "system", "addon", dedupe_key=f"update.available:system:{latest}", params={"version": latest})
    with db.connection(label="notify.update") as conn:
        reconcile(conn, "update.available", {sig.dedupe_key: sig} if available else {}, {sig.dedupe_key} if available else set(), now)  # type: ignore[dict-item]
        if _VERSION.fullmatch(latest):
            installed = str(info.get("version") or "")
            shown = self_update.Info(installed if _VERSION.fullmatch(installed) else __version__, latest, available)
            self_update.record(conn, self_update.CheckOutcome("available" if available else "current", False, shown, 200), now, refresh=False)
    return "available" if available else "current"


# ---------------------------------------------------------------- arm and scene results (the requests this product made)

_HANDLED: set[str] = set()  # action ids already judged by this process (the notification rows are the durable record)


def action_results(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, int]:
    """`alarm.arm_failed` for an arm request the panel never confirmed (`unknown` after its confirmation window) or the bridge failed
    for a reason other than a wrong code, and `bulk.partial` for a scene request that failed or went unconfirmed. Each request is
    told about once. A pending request is advanced the way a reader of it would (services/ha_actions.refresh), so a request nobody
    looked at is still judged."""
    from . import ha_actions

    cutoff = iso_utc(now - dt.timedelta(seconds=ARM_WATCH_S))
    rows = conn.execute(
        """SELECT * FROM ha_actions WHERE requested_at >= ? AND (action_id LIKE 'alarm_control_panel.alarm_arm%' OR action_id = 'scene.turn_on')
           ORDER BY requested_at DESC LIMIT 100""",
        (cutoff,),
    ).fetchall()
    counts = {"arm_failed": 0, "scene_failed": 0}
    for row in rows:
        aid = row["id"]
        if aid in _HANDLED:
            continue
        a = ha_actions.as_dict(row)
        if a["status"] == "pending":
            ha_actions.refresh(conn, a)
            a = ha_actions.action_row(conn, aid)
            if a["status"] == "pending":
                continue
        _HANDLED.add(aid)
        if a["status"] not in ("unknown", "failed"):
            continue
        err = str(a.get("error") or "")
        name_row = conn.execute("SELECT name, original_name, area_name FROM ha_entities WHERE entity_id = ?", (a["entity_id"],)).fetchone()
        name = str((name_row["name"] or name_row["original_name"]) if name_row else "") or str(a["entity_id"])
        place = (name_row["area_name"] if name_row else "") or ""
        if a["action_id"].startswith("alarm_control_panel."):
            if err in _NOT_AN_ARM_FAILURE:
                continue  # a wrong code or a refusal before the panel was reached: the user was told on the spot
            key = f"alarm.arm_failed:alarm_panel:{a['entity_id']}:{aid}"
            if not _any_row(conn, key) and notify.emit_full(conn, notify.Signal("alarm.arm_failed", "alarm_panel", a["entity_id"], dedupe_key=key, params={"name": name, "place": place}, place=place or None, origin={"entity_id": a["entity_id"], "action_id": aid})).action == "created":
                counts["arm_failed"] += 1
        elif a.get("principal_user_id"):
            key = f"bulk.partial:bulk_job:{aid}"
            detail = "ההפעלה לא אושרה" if a["status"] == "unknown" else "ההפעלה נכשלה"
            if not _any_row(conn, key) and notify.emit_full(conn, notify.Signal("bulk.partial", "bulk_job", aid, dedupe_key=key, params={"name": f"סצנה · {name}", "place": "", "detail": detail}, origin={"action_id": aid}, initiator_user_id=a["principal_user_id"])).action == "created":
                counts["scene_failed"] += 1
    if len(_HANDLED) > 5000:
        _HANDLED.clear()
    return counts


# an arm request that failed because of the CODE, or before it could reach the panel at all: the person who asked was told in the answer
_NOT_AN_ARM_FAILURE = frozenset({
    "invalid_code", "code_required", "ServiceValidationError", "bridge_not_paired", "ha_not_configured", "bridge_not_installed", "ha_forbidden", "service_not_allowed", "unauthorized",
    "ha_unauthorized", "unknown_user", "ha_unknown_user", "entity_required", "bad_signature", "stale", "replay", "bridge_bad_signature", "bridge_stale", "bridge_replay",
    "identity_unmapped", "action_not_allowed", "action_domain_mismatch", "argument_not_allowed", "validation",
})


# ---------------------------------------------------------------- WisKey doorbell (intercom_sync call_state)

@safe
def on_stations(old: list[dict[str, Any]] | None, new: list[dict[str, Any]]) -> int:
    """The WisKey feed's station list changed (services/intercom_sync._store, on the feed's event loop): a station that STARTS ringing signals
    `door.ring`; one that stops (answered, rejected, ended, offline) resolves it. The row carries the station's NAME only - never a visitor,
    an image or any `last_access` field (the feed carries none, and none is read here). Nothing is executed: the row's "open the door"
    is a deep link into an in-app confirmation (CR section 9)."""
    before = {s["id"]: s for s in (old or []) if isinstance(s, dict) and s.get("id")}
    n = 0
    for s in new:
        sid = s.get("id") if isinstance(s, dict) else None
        if not sid:
            continue
        ringing = s.get("call_state") == "ringing" and bool(s.get("online"))
        was = bool(before.get(sid) and before[sid].get("call_state") == "ringing" and before[sid].get("online"))
        if ringing and not was:
            name = str(s.get("name") or "העמדה")
            submit(notify.Signal("door.ring", "door", str(sid), params={"name": name, "place": name}, origin={"station_id": str(sid)}))
            n += 1
        elif was and not ringing:
            submit(notify.Signal("door.ring", "door", str(sid), resolve=True, params={"resolution": "answered_or_ended"}))
    return n


def ring_expiry(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, int]:
    """A doorbell row that never got its end (the HA event entity has none; a dropped WisKey feed) closes by itself."""
    n = 0
    for r in conn.execute("SELECT dedupe_key, subject_kind, subject_id, last_at FROM notifications WHERE source = 'door.ring' AND state != 'resolved' LIMIT 200").fetchall():
        ttl = STATION_RING_TTL_S if r["subject_kind"] == "door" else RING_TTL_S
        if (now - parse_utc(r["last_at"])).total_seconds() > ttl:
            n += notify.emit_full(conn, notify.Signal("door.ring", r["subject_kind"], r["subject_id"], dedupe_key=r["dedupe_key"], resolve=True, params={"resolution": "expired"})).action == "resolved"
    return {"rings_expired": n}


# ---------------------------------------------------------------- schedules (CR-014 run settlement) and automations (CR-017)

@safe
def on_schedule_run(conn: sqlite3.Connection, schedule_id: str, name: str, result: str, sensitive: bool, entity_ids: list[str], owner_user_id: str | None, run_id: str) -> None:
    """A run was settled (services/schedules.settle_runs, inside its transaction): a SENSITIVE schedule whose run was not confirmed or was
    skipped signals `schedule.not_confirmed` (the administrators by default - the setting `notify.failures_audience`); the next confirmed run
    of that schedule resolves it. The wording is never "failed" (SCHEDULER_API)."""
    if result in ("not_confirmed", "skipped") and sensitive:
        detail = "הריצה לא אושרה במלואה" if result == "not_confirmed" else "הריצה דולגה: התקן לא זמין"
        notify.emit_full(conn, notify.Signal("schedule.not_confirmed", "schedule", schedule_id, params={"name": name or "תזמון", "place": name or "", "detail": detail},
                                             origin={"run_id": run_id, "owner_user_id": owner_user_id, "entity_ids": list(entity_ids)[:50]}, initiator_user_id=owner_user_id))
    elif result == "confirmed":
        notify.emit_full(conn, notify.Signal("schedule.not_confirmed", "schedule", schedule_id, resolve=True, params={"resolution": "next_run_confirmed"}))


def _automation_link(automation_id: str, run_id: str | None = None) -> str:
    """The deep link of an automation's notification: its drawer (the run's trace for a failure) in הבית › אוטומציות."""
    from urllib.parse import quote

    return f"#/devices/automations/{quote(automation_id, safe='')}" + (f"?view=trace&run={quote(run_id, safe='')}" if run_id else "")


def automation_failed(conn: sqlite3.Connection, automation_id: str, name: str, detail: str, *, owner_user_id: str | None = None, entity_ids: list[str] | None = None, run_id: str | None = None) -> str | None:
    """The hook CR-017's runner calls when an automation run ends in an error (`automation.failed`; audience = the setting
    `notify.failures_audience`, default the administrators). Emits inside the caller's transaction; returns the new row's id (None when folded or
    disabled). `detail` is a short Hebrew phrase about the step - never a person, a secret or raw output."""
    return notify.emit(conn, notify.Signal("automation.failed", "automation", automation_id, params={"name": name or "אוטומציה", "place": name or "", "detail": detail},
                                           origin={"run_id": run_id, "owner_user_id": owner_user_id, "entity_ids": (entity_ids or [])[:50]}, initiator_user_id=owner_user_id,
                                           link=_automation_link(automation_id, run_id)))


def automation_notify(conn: sqlite3.Connection, automation_id: str, name: str, *, severity: str | None = None, key: str | None = None, owner_user_id: str | None = None,
                      entity_ids: list[str] | None = None) -> str | None:
    """CR-017's `notify` action: `automation.notify` for the automation (its policy's recipients, channels and quiet hours; a `critical` severity is
    the caller's to authorise - CR section 15). `key` separates the notifications of one automation."""
    return notify.emit(conn, notify.Signal("automation.notify", "automation", automation_id, severity=severity, dedupe_key=f"automation.notify:automation:{automation_id}:{key}" if key else None,
                                           params={"name": name or "אוטומציה", "place": name or ""}, origin={"owner_user_id": owner_user_id, "entity_ids": (entity_ids or [])[:50]}, initiator_user_id=owner_user_id,
                                           link=_automation_link(automation_id)))


# ---------------------------------------------------------------- bulk results

@safe
def on_bulk_finished(conn: sqlite3.Connection, body: dict[str, Any]) -> None:
    """A bulk device action (or a group operation) finished with something refused, not confirmed or unknown (services/device_bulk.finish, inside its
    transaction): the INITIATOR hears about it, so leaving the page never loses the partial-failure outcome. A bulk that succeeded says nothing."""
    c = body.get("counts") or {}
    total = int(c.get("total") or 0)
    bad = sum(int(c.get(k) or 0) for k in ("not_confirmed", "refused", "unknown"))  # "sent" (nothing observable to confirm) and "confirmed" are not failures
    if not total or not bad or not body.get("principal_user_id"):
        return
    name = str(body.get("kind_label") or body.get("kind") or "פעולה")
    if body.get("scope_name"):
        name += f" · {body['scope_name']}"
    notify.emit_full(conn, notify.Signal("bulk.partial", "bulk_job", str(body["id"]), params={"name": name, "place": str(body.get("scope_name") or ""), "detail": f"{bad} מתוך {total} לא אושרו"},
                                         origin={"bulk_id": body["id"]}, initiator_user_id=body["principal_user_id"]))


# ---------------------------------------------------------------- security: remote sign-ins and code lockouts

def device_hash(family: str) -> str:
    return hashlib.sha256((family or "").encode("utf-8")).hexdigest()[:32]


@safe
def remote_sign_in(db: Database, user_id: str, meta: dict[str, str]) -> bool:
    """A new remote sign-in (not a continuation of one): when the account has signed in from other devices before but never from this one (a hash
    of the coarse browser · system family, never the user-agent string or an address), the ACCOUNT'S OWN user gets `security.new_signin`. The
    first device the system learns for an account is learned silently. Returns whether it was announced."""
    from .ha_user_auth import agent_family

    family = agent_family(meta.get("user_agent") or "")
    h = device_hash(family)
    label = family or "מכשיר לא מזוהה"
    with db.connection(label="notify.signin") as conn:
        if conn.execute("SELECT 1 FROM notify_known_devices WHERE user_id = ? AND device_hash = ?", (user_id, h)).fetchone():
            return False
        known = conn.execute("SELECT COUNT(*) FROM notify_known_devices WHERE user_id = ?", (user_id,)).fetchone()[0]
        conn.execute("INSERT INTO notify_known_devices(user_id, device_hash, first_seen_at) VALUES (?,?,?)", (user_id, h, iso_utc(notify.now_utc())))
        if not known:
            return False
        notify.emit_full(conn, notify.Signal("security.new_signin", "session", user_id, dedupe_key=f"security.new_signin:session:{user_id}:{h}", params={"name": label, "place": label},
                                             initiator_user_id=user_id, origin={"channel": "remote"}))
    return True


@safe
def code_lockout(conn: sqlite3.Connection, user_id: str) -> None:
    """Too many wrong alarm codes locked a user out (routers/alarm.gate_code, inside its transaction): `security.lockout` for the administrators.
    Never the code, never the panel."""
    notify.emit_full(conn, notify.Signal("security.lockout", "session", user_id, dedupe_key=f"security.lockout:session:{user_id}", params={"name": "קוד אזעקה", "place": "אזעקה"}, initiator_user_id=user_id,
                                         origin={"kind": "alarm_code"}))
