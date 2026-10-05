"""CR-031 GEN1: the generator alert engine, the alert history and the routing settings.

Engine: `evaluate()` runs on the 15 s tick of services/generator_runtime.py over the state mirror. For every generator and every alert
type the DETECTED roles can produce (`generator_catalog.type_available`) it judges the condition (a controller alarm output when the
controller exposes one, else a threshold on the value), holds it for the type's hold time, then raises / clears a `generator_alerts`
row and the matching notification-centre row (CR-018, source `generator.<key>`, subject kind `generator`). A type whose sensors are
missing is never emitted. Event types (mains restored, load transferred, test done / failed) are moments: raised and closed at once.
A re-raise within FOLD_S of its clearing re-opens the same row (count + 1) instead of making a new one.

Routing starts EMPTY (owner 2026-10-05): a policy row exists only after an administrator saved one, with no recipients and no channels
beyond the notification centre. The recipients rule `generator` of services/notify.recipients_for resolves roles AND scope at emit time
through `recipient_users`. Nothing is sent from here: delivery stays with the CR-018 pipeline.

Not persisted across a restart: the hold timers and the previous values the event types compare against (the first pass after a
start raises no event)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
import threading
from typing import Any, Callable

from ..audit import audit
from ..db import new_id, now_iso
from ..rbac import INSTALLATION, authorize
from . import generator_catalog as cat
from . import generator_core as core
from . import notify
from .notify_visibility import principal_of
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.generator")

FOLD_S = 900
MUTE_MAX_H = 24 * 7
ROUTABLE_ROLES = ("operator", "site_admin", "system_admin")  # viewers and kiosks are refused (they hold no generator.view)
CHANNELS = ("push", "app", "email")
CHANNELS_RESERVED = ("whatsapp", "ha_mobile")
QUIET = ("pass", "matrix", "hold")
SOURCE_PREFIX = "generator."

_SINCE: dict[tuple[str, str], float] = {}
_PREV: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def reset() -> None:
    """Tests: forget every hold timer and previous value."""
    with _lock:
        _SINCE.clear()
        _PREV.clear()


def _held(dev: str, key: str, active: bool, hold_s: int, now_ts: float) -> bool:
    with _lock:
        if not active:
            _SINCE.pop((dev, key), None)
            return False
        t0 = _SINCE.setdefault((dev, key), now_ts)
    return now_ts - t0 >= hold_s


# ---------------------------------------------------------------- judging

class Ctx:
    def __init__(self, dev: sqlite3.Row, values: dict[str, dict[str, Any]], th: dict[str, float], avail: str, prev: dict[str, Any], stale_s: int) -> None:
        self.dev, self.values, self.th, self.avail, self.prev, self.stale_s = dev, values, th, avail, prev, stale_s

    def v(self, role: str) -> Any:
        item = self.values.get(role)
        return item["value"] if item and item["available"] else None

    def has(self, role: str) -> bool:
        return role in self.values

    def running(self) -> bool | None:
        state, rpm = self.v("engine_state"), self.v("rpm")
        if state is None and rpm is None:
            return None
        return state in ("running", "starting", "cooling") if state is not None else float(rpm) > self.th["running_rpm"]

    def snapshot(self) -> dict[str, Any]:
        return {r: i["value"] for r, i in self.values.items() if i["available"] and i["value"] is not None and cat.ROLES[r][0] in ("num", "enum", "bool")}


Judge = Callable[[Ctx], "tuple[bool | None, str]"]


def _n(x: float, digits: int = 1) -> str:
    return f"{round(float(x), digits):g}"


def _alarm_or(role: str, fn: Callable[[Ctx], "tuple[bool | None, str]"]) -> Judge:
    def judge(c: Ctx) -> tuple[bool | None, str]:
        a = c.v(role)
        if a is not None:
            return a, ""
        return fn(c)
    return judge


_FAIL_START = re.compile(r"fail.{0,6}to.{0,6}start|start.{0,6}fail|כשל התנעה", re.I)
_ESTOP = re.compile(r"emergency|e[ _-]?stop|חירום", re.I)


def _raw_state(c: Ctx) -> str | None:
    item = c.values.get("engine_state")
    return item.get("raw") if item and item["available"] else None


def _j_fail_start(c: Ctx) -> tuple[bool | None, str]:
    raw = _raw_state(c)
    return (None, "") if raw is None else (bool(_FAIL_START.search(raw)), "")


def _j_low_oil(c: Ctx) -> tuple[bool | None, str]:
    oil, run = c.v("oil_pressure"), c.running()
    if oil is None or run is None:
        return None, ""
    return bool(run and oil < c.th["oil_min_bar"]), f"לחץ השמן {_n(oil)} בר"


def _j_coolant(c: Ctx) -> tuple[bool | None, str]:
    t = c.v("coolant_temp")
    return (None, "") if t is None else (t > c.th["coolant_max_c"], f"טמפרטורת נוזל הקירור {_n(t, 0)}°C")


def _j_overspeed(c: Ctx) -> tuple[bool | None, str]:
    r = c.v("rpm")
    return (None, "") if r is None else (r > c.th["rpm_max"], f"{_n(r, 0)} סל\"ד")


def _j_emergency(c: Ctx) -> tuple[bool | None, str]:
    raw = _raw_state(c)
    return (None, "") if raw is None else (bool(_ESTOP.search(raw)), "")


def _j_unexpected(c: Ctx) -> tuple[bool | None, str]:
    s = c.v("engine_state")
    if s is None:
        return None, ""
    specific = any(c.v(a) for a in ("alarm_fail_to_start", "alarm_emergency_stop", "alarm_low_oil", "alarm_high_temp", "alarm_overspeed"))
    return bool(s == "fault" and not specific), ""


def _j_low_fuel(c: Ctx) -> tuple[bool | None, str]:
    f = c.v("fuel_pct")
    return (None, "") if f is None else (f < c.th["fuel_low_pct"], f"מפלס הדלק {_n(f, 0)}%")


def _j_fuel_empty(c: Ctx) -> tuple[bool | None, str]:
    f = c.v("fuel_pct")
    return (None, "") if f is None else (f <= c.th["fuel_empty_pct"], f"מפלס הדלק {_n(f, 0)}%")


def _j_overload(c: Ctx) -> tuple[bool | None, str]:
    pct, kw = c.v("load_pct"), c.v("gen_kw")
    if pct is not None:
        return pct > c.th["overload_pct"], f"עומס {_n(pct, 0)}%"
    rated = c.dev["rated_kw"]
    if kw is not None and rated:
        return kw > float(rated) * c.th["overload_pct"] / 100, f"הספק {_n(kw, 0)} קילוואט מתוך {_n(rated, 0)}"
    return None, ""


def _j_gen_voltage(c: Ctx) -> tuple[bool | None, str]:
    run = c.running()
    vs = [(r, c.v(r)) for r in cat.GEN_V if c.v(r) is not None]
    if run is None or not vs:
        return None, ""
    if not run:
        return False, ""
    bad = [(r, x) for r, x in vs if not c.th["v_min"] <= x <= c.th["v_max"]]
    return bool(bad), (f"מתח {_n(bad[0][1], 0)} וולט ב־L{bad[0][0][-1]}" if bad else "")


def _j_gen_freq(c: Ctx) -> tuple[bool | None, str]:
    hz, run = c.v("gen_hz"), c.running()
    if hz is None or run is None:
        return None, ""
    return bool(run and not c.th["hz_min"] <= hz <= c.th["hz_max"]), f"תדר {_n(hz)} הרץ"


def _j_battery(c: Ctx) -> tuple[bool | None, str]:
    b = c.v("battery_v")
    if b is None:
        return None, ""
    low = c.th["battery_min_12v"] if b <= 16 else c.th["battery_min_24v"]
    return b < low, f"מתח המצבר {_n(b)} וולט"


def _j_charger(c: Ctx) -> tuple[bool | None, str]:
    ch, run = c.v("charger_v"), c.running()
    if ch is None or run is None:
        return None, ""
    return bool(run and ch < 10), f"מתח המטען {_n(ch)} וולט"


def _j_mains_lost(c: Ctx) -> tuple[bool | None, str]:
    m = c.v("mains_available")
    return (None, "") if m is None else (not m, "")


def _j_ats_fail(c: Ctx) -> tuple[bool | None, str]:
    ats, mains, run = c.v("ats_position"), c.v("mains_available"), c.running()
    if ats is None or mains is None or run is None:
        return None, ""
    return bool(not mains and run and c.v("engine_state") == "running" and ats != "generator"), "מתג ההעברה לא עבר לגנרטור"


def _j_service(c: Ctx) -> tuple[bool | None, str]:
    left = c.v("service_hours_left")
    if left is None and c.th["service_every_h"] > 0 and c.v("run_hours") is not None:
        left = c.th["service_every_h"] - (float(c.v("run_hours")) % c.th["service_every_h"])
    if left is None:
        return None, ""
    return left <= c.th["service_warn_h"], ("הטיפול התקופתי מועד" if left <= 0 else f"נותרו {_n(left, 0)} שעות עד הטיפול התקופתי")


def _j_offline(c: Ctx) -> tuple[bool | None, str]:
    if c.avail == "offline":
        return True, ""
    mon = c.values.get("monitoring_status")
    if mon and mon["available"] and str(mon["value"]).strip().lower() not in ("ok", "online", "connected", "healthy"):
        return True, ""
    return False, ""


def _flag(role: str) -> Judge:
    def judge(c: Ctx) -> tuple[bool | None, str]:
        v = c.v(role)
        return (None, "") if v is None else (bool(v), "")
    return judge


def _j_not_auto(c: Ctx) -> tuple[bool | None, str]:
    m = c.v("controller_mode")
    return (None, "") if m is None else (m not in ("auto", "test"), "")


def _ev_mains_restored(c: Ctx) -> bool:
    return c.prev.get("mains_available") is False and c.v("mains_available") is True


def _ev_ats(c: Ctx) -> bool:
    role = "ats_position" if c.has("ats_position") else "supply_source"
    p = c.prev.get(role)
    return p is not None and p != "generator" and c.v(role) == "generator"


def _ev_started(c: Ctx) -> bool:
    return c.prev.get("generator_running") is False and c.v("generator_running") is True


def _test_changed(c: Ctx) -> tuple[bool, bool]:
    at, res = c.v("last_test_at"), c.v("last_test_result")
    p_at, p_res = c.prev.get("last_test_at"), c.prev.get("last_test_result")
    changed = (at is not None and p_at is not None and at != p_at) or (res is not None and p_res is not None and res != p_res)
    return changed, bool(res is not None and cat.FAIL_RESULT.search(str(res)))


def _ev_test_done(c: Ctx) -> bool:
    changed, failed = _test_changed(c)
    return changed and not failed


def _ev_test_failed(c: Ctx) -> bool:
    changed, failed = _test_changed(c)
    return changed and failed


STATE_JUDGES: dict[str, Judge] = {
    "fail_to_start": _alarm_or("alarm_fail_to_start", _j_fail_start),
    "low_oil_pressure": _alarm_or("alarm_low_oil", _j_low_oil),
    "high_coolant_temp": _alarm_or("alarm_high_temp", _j_coolant),
    "overspeed": _alarm_or("alarm_overspeed", _j_overspeed),
    "emergency_stop": _alarm_or("alarm_emergency_stop", _j_emergency),
    "unexpected_stop": _j_unexpected,
    "low_fuel": _alarm_or("alarm_low_fuel", _j_low_fuel),
    "fuel_shutdown": _j_fuel_empty,
    "overload": _j_overload,
    "gen_voltage": _j_gen_voltage,
    "gen_frequency": _j_gen_freq,
    "battery_low": _j_battery,
    "charger_fail": _alarm_or("alarm_charger_fail", _j_charger),
    "mains_lost": _j_mains_lost,
    "ats_fail": _alarm_or("alarm_ats_fail", _j_ats_fail),
    "controller_warning": _flag("warning_active"),
    "controller_shutdown": _flag("shutdown_active"),
    "controller_trip": _flag("trip_active"),
    "service_due": _j_service,
    "controller_offline": _j_offline,
    "not_auto": _j_not_auto,
}
EVENT_JUDGES: dict[str, Callable[[Ctx], bool]] = {"mains_restored": _ev_mains_restored, "ats_to_gen": _ev_ats, "generator_started": _ev_started, "test_done": _ev_test_done, "test_failed": _ev_test_failed}


# ---------------------------------------------------------------- policy rows

def _policy_row(conn: sqlite3.Connection, device_id: str, key: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM generator_alert_policies WHERE device_id = ? AND alert_key = ?", (device_id, key)).fetchone()


def _muted(conn: sqlite3.Connection, device_id: str, key: str, now: str) -> bool:
    r = conn.execute("SELECT until FROM generator_mutes WHERE device_id = ? AND alert_key = ?", (device_id, key)).fetchone()
    return r is not None and r["until"] > now


# ---------------------------------------------------------------- raise / clear

def _signal(dev: sqlite3.Row, t: cat.AlertType, severity: str, detail: str, alert_id: str, resolve: bool = False) -> notify.Signal:
    return notify.Signal(
        SOURCE_PREFIX + t.key, "generator", dev["id"], severity=None if resolve else severity, dedupe_key=f"{SOURCE_PREFIX}{t.key}:{dev['id']}", resolve=resolve,
        params={"name": dev["name"], "detail": detail, "place": dev["name"]}, origin={"alert_id": alert_id, "generator_id": dev["id"]}, link="#/infra/generator/alerts", area_id=dev["area_id"])


def _emit(conn: sqlite3.Connection, signal: notify.Signal) -> str | None:
    try:
        res = notify.emit_full(conn, signal)
        return res.id if res.action in ("created", "folded", "renotified") else None
    except Exception:  # noqa: BLE001 - the alert row stands even if the centre refused the signal
        log.warning("generator alert could not reach the notification centre", exc_info=True)
        return None


def _raise(conn: sqlite3.Connection, dev: sqlite3.Row, t: cat.AlertType, severity: str, detail: str, snapshot: dict[str, Any], now: str, now_ts: float) -> str:
    muted = _muted(conn, dev["id"], t.key, now)
    recent = None if t.event else conn.execute(
        "SELECT id, count FROM generator_alerts WHERE device_id = ? AND alert_key = ? AND cleared_at IS NOT NULL ORDER BY cleared_at DESC LIMIT 1", (dev["id"], t.key)).fetchone()
    if recent is not None:
        last = conn.execute("SELECT cleared_at FROM generator_alerts WHERE id = ?", (recent["id"],)).fetchone()["cleared_at"]
        if (parse_utc(now) - parse_utc(last)).total_seconds() > FOLD_S:
            recent = None
    if recent is not None:  # a flap: the same row again
        aid = recent["id"]
        conn.execute("UPDATE generator_alerts SET cleared_at = NULL, count = count + 1, last_at = ?, severity = ?, snapshot_json = ?, acked_by = NULL, acked_at = NULL, ack_note = NULL WHERE id = ?",
                     (now, severity, json.dumps(snapshot, ensure_ascii=False), aid))
    else:
        aid = new_id()
        conn.execute(
            "INSERT INTO generator_alerts(id, device_id, alert_key, severity, raised_at, cleared_at, snapshot_json, count, last_at) VALUES (?,?,?,?,?,?,?,1,?)",
            (aid, dev["id"], t.key, severity, now, now if t.event else None, json.dumps(snapshot, ensure_ascii=False), now))
    if not muted:
        nid = _emit(conn, _signal(dev, t, severity, detail, aid))
        if nid:
            conn.execute("UPDATE generator_alerts SET notification_id = ? WHERE id = ?", (nid, aid))
    return aid


def _clear(conn: sqlite3.Connection, dev: sqlite3.Row, t: cat.AlertType, row: sqlite3.Row, now: str) -> None:
    conn.execute("UPDATE generator_alerts SET cleared_at = ?, last_at = ? WHERE id = ?", (now, now, row["id"]))
    if row["notification_id"]:
        _emit(conn, _signal(dev, t, row["severity"], "", row["id"], resolve=True))


def evaluate(conn: sqlite3.Connection, now_ts: float, mirror_connected: bool = True) -> dict[str, int]:
    """One pass over every live generator. Returns {raised, cleared}."""
    now = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc))
    out = {"raised": 0, "cleared": 0}
    stale_s = core.int_setting(conn, "stale_after_s")
    for dev in conn.execute("SELECT * FROM generator_devices WHERE status <> 'removed'").fetchall():
        values = core.read_values(conn, dev["id"])
        roles = set(values)
        avail = core.availability(values, mirror_connected)
        prev = _PREV.get(dev["id"], {})
        ctx = Ctx(dev, values, core.thresholds(conn, dev["id"]), avail, prev, stale_s)
        offline = avail == "offline"
        open_rows = {r["alert_key"]: r for r in conn.execute("SELECT * FROM generator_alerts WHERE device_id = ? AND cleared_at IS NULL", (dev["id"],)).fetchall()}
        for t in cat.ALERT_TYPES:
            if not cat.type_available(t, roles):
                continue
            pol = _policy_row(conn, dev["id"], t.key)
            enabled = True if pol is None else bool(pol["enabled"])
            severity = t.severity if pol is None else pol["severity"]
            row = open_rows.get(t.key)
            if t.event:
                if enabled and not offline and EVENT_JUDGES[t.key](ctx):
                    _raise(conn, dev, t, severity, "", ctx.snapshot(), now, now_ts)
                    out["raised"] += 1
                continue
            if t.key != "controller_offline" and offline:
                continue  # nothing can be judged while the controller does not answer: open rows stay as they are
            active, detail = STATE_JUDGES[t.key](ctx)
            if active is None:
                continue
            due = _held(dev["id"], t.key, bool(active) and enabled, int(t.hold_s + (pol["after_s"] if pol else 0)), now_ts)
            if due and row is None:
                _raise(conn, dev, t, severity, detail, ctx.snapshot(), now, now_ts)
                out["raised"] += 1
            elif row is not None and (not active or not enabled):
                _clear(conn, dev, t, row, now)
                out["cleared"] += 1
        _PREV[dev["id"]] = {r: i["value"] for r, i in values.items() if i["available"]}
    return out


# ---------------------------------------------------------------- history reads

def _alert_dict(r: sqlite3.Row, device_names: dict[str, str] | None = None) -> dict[str, Any]:
    t = cat.TYPE_BY_KEY.get(r["alert_key"])
    return {
        "id": r["id"], "device_id": r["device_id"], "device_name": (device_names or {}).get(r["device_id"]), "key": r["alert_key"], "group": t.group if t else None,
        "title": t.title_he if t else r["alert_key"], "severity": r["severity"], "state": "open" if r["cleared_at"] is None else "closed",
        "raised_at": r["raised_at"], "cleared_at": r["cleared_at"], "last_at": r["last_at"], "count": r["count"], "acknowledged": r["acked_at"] is not None,
        "acked_by": r["acked_by"], "acked_at": r["acked_at"], "ack_note": r["ack_note"],
    }


def list_alerts(conn: sqlite3.Connection, *, device_id: str | None, state: str | None, severity: str | None, key: str | None, ack: bool | None,
                start: str | None, end: str | None, before: str | None, limit: int) -> dict[str, Any]:
    where, params = ["1=1"], []
    for col, val in (("a.device_id", device_id), ("a.severity", severity), ("a.alert_key", key)):
        if val:
            where.append(f"{col} = ?")
            params.append(val)
    if state == "open":
        where.append("a.cleared_at IS NULL")
    elif state == "closed":
        where.append("a.cleared_at IS NOT NULL")
    if ack is True:
        where.append("a.acked_at IS NOT NULL")
    elif ack is False:
        where.append("a.acked_at IS NULL")
    if start:
        where.append("a.raised_at >= ?")
        params.append(start)
    if end:
        where.append("a.raised_at <= ?")
        params.append(end)
    if before:
        where.append("a.raised_at < ?")
        params.append(before)
    rows = conn.execute(f"SELECT a.* FROM generator_alerts a WHERE {' AND '.join(where)} ORDER BY a.raised_at DESC, a.id DESC LIMIT ?", (*params, limit + 1)).fetchall()
    names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM generator_devices").fetchall()}
    page = rows[:limit]
    total_open = conn.execute("SELECT COUNT(*) FROM generator_alerts WHERE cleared_at IS NULL" + (" AND device_id = ?" if device_id else ""), ((device_id,) if device_id else ())).fetchone()[0]
    return {"alerts": [_alert_dict(r, names) for r in page], "next_before": page[-1]["raised_at"] if len(rows) > limit and page else None, "open_count": total_open}


def alert_detail(conn: sqlite3.Connection, alert_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM generator_alerts WHERE id = ?", (alert_id,)).fetchone()
    if r is None:
        return None
    names = {x["id"]: x["name"] for x in conn.execute("SELECT id, name FROM generator_devices").fetchall()}
    d = _alert_dict(r, names)
    try:
        d["snapshot"] = json.loads(r["snapshot_json"] or "{}")
    except ValueError:
        d["snapshot"] = {}
    timeline: list[dict[str, Any]] = [{"at": r["raised_at"], "kind": "raised"}]
    if r["notification_id"]:
        for e in conn.execute("SELECT at, kind, step, count, channel FROM notification_events WHERE notification_id = ? ORDER BY id", (r["notification_id"],)).fetchall():
            if e["kind"] in ("escalated", "delivery_failed", "folded"):
                timeline.append({"at": e["at"], "kind": e["kind"], "step": e["step"], "count": e["count"], "channel": e["channel"]})
    if r["acked_at"]:
        timeline.append({"at": r["acked_at"], "kind": "acknowledged", "by": r["acked_by"], "note": r["ack_note"]})
    if r["cleared_at"]:
        timeline.append({"at": r["cleared_at"], "kind": "cleared"})
    d["timeline"] = sorted(timeline, key=lambda x: x["at"])
    m = conn.execute("SELECT until FROM generator_mutes WHERE device_id = ? AND alert_key = ?", (r["device_id"], r["alert_key"])).fetchone()
    d["muted_until"] = m["until"] if m is not None and m["until"] > now_iso() else None
    return d


def acknowledge(conn: sqlite3.Connection, principal: Any, alert_id: str, note: str | None) -> str:
    """'ok' | 'not_found'. Idempotent. Also acknowledges the notification-centre row."""
    r = conn.execute("SELECT * FROM generator_alerts WHERE id = ?", (alert_id,)).fetchone()
    if r is None:
        return "not_found"
    if r["acked_at"] is None:
        conn.execute("UPDATE generator_alerts SET acked_by = ?, acked_at = ?, ack_note = ? WHERE id = ?", (principal.user_id, now_iso(), (note or "").strip()[:300] or None, alert_id))
        notify.ack_from_alert(conn, r["notification_id"], principal)
        audit(conn, actor=principal, action="generator.alert.ack", decision="allowed", resource_type="generator_alert", resource_id=alert_id)
    return "ok"


def acknowledge_all(conn: sqlite3.Connection, principal: Any, device_id: str) -> int:
    n = 0
    for r in conn.execute("SELECT id FROM generator_alerts WHERE device_id = ? AND cleared_at IS NULL AND acked_at IS NULL", (device_id,)).fetchall():
        acknowledge(conn, principal, r["id"], None)
        n += 1
    return n


def mute(conn: sqlite3.Connection, principal: Any, alert_id: str, hours: int) -> str | None:
    """Mute re-raises of the alert's type on its device for `hours`; returns the end instant, None when the alert is unknown."""
    r = conn.execute("SELECT device_id, alert_key FROM generator_alerts WHERE id = ?", (alert_id,)).fetchone()
    if r is None:
        return None
    until = iso_utc(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=hours))
    conn.execute("INSERT INTO generator_mutes(device_id, alert_key, until, muted_by) VALUES (?,?,?,?) ON CONFLICT(device_id, alert_key) DO UPDATE SET until = excluded.until, muted_by = excluded.muted_by",
                 (r["device_id"], r["alert_key"], until, principal.user_id))
    audit(conn, actor=principal, action="generator.alert.mute", decision="allowed", resource_type="generator_alert", resource_id=alert_id, details={"hours": hours})
    return until


def prune_alerts(conn: sqlite3.Connection, now_ts: float) -> int:
    days = core.int_setting(conn, "alert_retention_days")
    cutoff = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc) - dt.timedelta(days=days))
    conn.execute("DELETE FROM generator_mutes WHERE until < ?", (iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc)),))
    return conn.execute("DELETE FROM generator_alerts WHERE cleared_at IS NOT NULL AND cleared_at < ?", (cutoff,)).rowcount


# ---------------------------------------------------------------- routing settings

class RoutingInvalid(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code, self.message, self.details = code, message, details or {}


def _policy_dict(r: sqlite3.Row | None) -> dict[str, Any] | None:
    if r is None:
        return None
    try:
        rec = json.loads(r["recipients_json"] or "{}")
    except ValueError:
        rec = {}
    try:
        ch = json.loads(r["channels_json"] or "[]")
    except ValueError:
        ch = []
    return {"enabled": bool(r["enabled"]), "severity": r["severity"], "recipients": {"roles": list(rec.get("roles") or []), "users": list(rec.get("users") or [])},
            "channels": [c for c in ch if c in CHANNELS], "quiet_mode": r["quiet_mode"], "escalate": bool(r["escalate"]), "after_s": r["after_s"], "row_version": r["row_version"]}


def list_policies(conn: sqlite3.Connection, device_id: str) -> dict[str, Any]:
    roles = core.roles_of(conn, device_id)
    stored = {r["alert_key"]: r for r in conn.execute("SELECT * FROM generator_alert_policies WHERE device_id = ?", (device_id,)).fetchall()}
    items = []
    for t in cat.ALERT_TYPES:
        ok = cat.type_available(t, roles)
        items.append({"key": t.key, "group": t.group, "title": t.title_he, "title_en": t.title_en, "default_severity": t.severity, "event": t.event, "available": ok,
                      "needs": None if ok else cat.needs_label(t), "message": t.body, "policy": _policy_dict(stored.get(t.key))})
    return {"groups": [{"key": k, "title": v} for k, v in cat.GROUPS], "items": items, "available": sum(1 for i in items if i["available"]), "total": len(items),
            "channels": list(CHANNELS), "channels_reserved": list(CHANNELS_RESERVED), "quiet_modes": list(QUIET),
            "note": "ניתוב נשמר כאן; ההתראות תמיד מגיעות למרכז ההתראות, ושליחה בערוצים נוספים נעשית דרכו."}


def validate_policy(conn: sqlite3.Connection, body: dict[str, Any], current: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(current or {"enabled": True, "severity": None, "recipients": {"roles": [], "users": []}, "channels": [], "quiet_mode": "matrix", "escalate": False, "after_s": 0})
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise RoutingInvalid("validation", "הערך חייב להיות כן/לא.", {"field": "enabled"})
        out["enabled"] = body["enabled"]
    if "severity" in body:
        if body["severity"] not in cat.SEVERITIES:
            raise RoutingInvalid("validation", "חומרה לא מוכרת.", {"field": "severity"})
        out["severity"] = body["severity"]
    if "recipients" in body:
        rec = body["recipients"] or {}
        roles, users = rec.get("roles") or [], rec.get("users") or []
        if not isinstance(roles, list) or not isinstance(users, list) or len(roles) > 10 or len(users) > 100:
            raise RoutingInvalid("validation", "נמענים לא תקינים.", {"field": "recipients"})
        bad = [r for r in roles if r not in ROUTABLE_ROLES]
        if bad:
            raise RoutingInvalid("validation", "תפקיד לא יכול לקבל התראות גנרטור.", {"field": "recipients.roles", "roles": bad})
        known = {r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1").fetchall()}
        missing = [u for u in users if not isinstance(u, str) or u not in known]
        if missing:
            raise RoutingInvalid("validation", "משתמש לא מוכר.", {"field": "recipients.users"})
        out["recipients"] = {"roles": sorted(set(roles)), "users": sorted(set(users))}
    if "channels" in body:
        ch = body["channels"]
        if not isinstance(ch, list):
            raise RoutingInvalid("validation", "ערוצים לא תקינים.", {"field": "channels"})
        for c in ch:
            if c in CHANNELS_RESERVED:
                raise RoutingInvalid("channel_reserved", "הערוץ הזה עדיין לא זמין.", {"channel": c})
            if c not in CHANNELS and c != "inbox":
                raise RoutingInvalid("validation", "ערוץ לא מוכר.", {"field": "channels"})
        out["channels"] = [c for c in CHANNELS if c in ch]
    if "quiet_mode" in body:
        if body["quiet_mode"] not in QUIET:
            raise RoutingInvalid("validation", "מצב שעות שקט לא מוכר.", {"field": "quiet_mode"})
        out["quiet_mode"] = body["quiet_mode"]
    if "escalate" in body:
        if not isinstance(body["escalate"], bool):
            raise RoutingInvalid("validation", "הערך חייב להיות כן/לא.", {"field": "escalate"})
        out["escalate"] = body["escalate"]
    if "after_s" in body:
        v = body["after_s"]
        if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= 86400:
            raise RoutingInvalid("validation", "ערך מספרי מחוץ לטווח.", {"field": "after_s"})
        out["after_s"] = v
    return out


def _bridge(conn: sqlite3.Connection, key: str, pol: dict[str, Any] | None, default_severity: str) -> None:
    """Mirror the choice onto the CR-018 source policy `generator.<key>` (one transaction with the generator row)."""
    from . import notify_policy

    notify_policy.ensure_defaults(conn)
    src = SOURCE_PREFIX + key
    if pol is None:
        d = notify_policy.default_row(notify_policy.BY_KEY[src])
        conn.execute("UPDATE notify_policies SET enabled = ?, severity = ?, after_s = 0, recipients_json = ?, channels_json = ?, revision = revision + 1, updated_at = ? WHERE source = ?",
                     (int(d["enabled"]), d["severity"], json.dumps(d["recipients"]), json.dumps(d["channels"]), now_iso(), src))
        return
    ch = {"inbox": True, "webpush": "push" in pol["channels"], "email": "email" in pol["channels"], "app": "app" in pol["channels"], "ha_mobile": False, "whatsapp": False}
    conn.execute("UPDATE notify_policies SET enabled = ?, severity = ?, after_s = ?, recipients_json = ?, channels_json = ?, revision = revision + 1, updated_at = ? WHERE source = ?",
                 (int(pol["enabled"]), pol["severity"] or default_severity, 0, json.dumps({"rule": "generator"}), json.dumps(ch), now_iso(), src))


def save_policy(conn: sqlite3.Connection, principal: Any, device_id: str, key: str, body: dict[str, Any]) -> dict[str, Any]:
    t = cat.TYPE_BY_KEY[key]
    if not cat.type_available(t, core.roles_of(conn, device_id)):
        raise RoutingInvalid("type_unavailable", "סוג ההתראה דורש חיישן שלא זוהה.", {"key": key})
    row = _policy_row(conn, device_id, key)
    if "row_version" in body and row is not None and body["row_version"] != row["row_version"]:
        raise RoutingInvalid("revision_conflict", "ההגדרה השתנתה בינתיים.", {"row_version": row["row_version"]})
    new = validate_policy(conn, body, _policy_dict(row))
    new["severity"] = new["severity"] or t.severity
    conn.execute(
        """INSERT INTO generator_alert_policies(device_id, alert_key, enabled, severity, recipients_json, channels_json, quiet_mode, escalate, after_s, row_version, updated_by, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
           ON CONFLICT(device_id, alert_key) DO UPDATE SET enabled = excluded.enabled, severity = excluded.severity, recipients_json = excluded.recipients_json, channels_json = excluded.channels_json,
             quiet_mode = excluded.quiet_mode, escalate = excluded.escalate, after_s = excluded.after_s, row_version = row_version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at""",
        (device_id, key, int(new["enabled"]), new["severity"], json.dumps(new["recipients"]), json.dumps(new["channels"]), new["quiet_mode"], int(new["escalate"]), new["after_s"], principal.user_id, now_iso()))
    _bridge(conn, key, new, t.severity)
    audit(conn, actor=principal, action="generator.policy.update", decision="allowed", resource_type="generator_policy", resource_id=f"{device_id}:{key}")
    return _policy_dict(_policy_row(conn, device_id, key)) or {}


def reset_policies(conn: sqlite3.Connection, principal: Any, device_id: str) -> int:
    keys = [r["alert_key"] for r in conn.execute("SELECT alert_key FROM generator_alert_policies WHERE device_id = ?", (device_id,)).fetchall()]
    conn.execute("DELETE FROM generator_alert_policies WHERE device_id = ?", (device_id,))
    for k in keys:
        _bridge(conn, k, None, cat.TYPE_BY_KEY[k].severity)
    audit(conn, actor=principal, action="generator.policy.reset", decision="allowed", resource_type="generator_device", resource_id=device_id)
    return len(keys)


def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """The `generator` recipient rule of services/notify.recipients_for: the saved routing of the notification's device and alert type.
    Roles are resolved against the CURRENT bindings; the caller intersects the result with visibility (generator.view at installation
    scope), so role AND scope both apply. No policy row = no recipients (routing starts empty)."""
    source = str(n.get("source") or "")
    key = source[len(SOURCE_PREFIX):] if source.startswith(SOURCE_PREFIX) else ""
    row = _policy_row(conn, str(n.get("subject_id") or ""), key) if key else None
    pol = _policy_dict(row)
    if pol is None or not pol["enabled"]:
        return []
    out: list[str] = list(pol["recipients"]["users"])
    roles = [r for r in pol["recipients"]["roles"] if r in ROUTABLE_ROLES]
    if roles:
        marks = ",".join("?" * len(roles))
        out += [r[0] for r in conn.execute(f"SELECT DISTINCT subject_id FROM bindings WHERE subject_kind = 'user' AND role_id IN ({marks}) AND revoked_at IS NULL AND effect = 'allow'", roles).fetchall()]
    ok = []
    for uid in dict.fromkeys(out):
        p = principal_of(conn, uid)
        if p is not None and authorize(conn, p, "generator.view", INSTALLATION).allowed:
            ok.append(uid)
    return ok
