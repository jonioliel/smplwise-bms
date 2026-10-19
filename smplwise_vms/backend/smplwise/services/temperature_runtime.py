"""CR-INFRA-TEMPERATURE 2.9.1: the temperature units' background work - one thread, read-only against the infrastructure.

Every TICK_S (60 s) over the state mirror, for every enabled unit:

* history: one sample per minute while the temperature reading is live (flags: inside a defrost window, door open) and the door openings;
* the status evaluator (owner decisions 2026-10-19, every number a SETTING with an installation default and a per-unit override):
  - an excursion above / below the band opens ONE log row; a WARNING from its first moment (`warn_on_excursion`), an ALARM once it has lasted
    Z minutes (`high_alarm_min` / `low_alarm_min`); it ends when the reading is `hysteresis` degrees back inside the band;
  - inside a defrost window (fixed, or learned and not rejected) a reading above the band is a defrost, not an excursion (`defrost_suppress`)
    - unless it is above the hard maximum (high + `defrost_hard_margin`); a defrost is logged as an info row;
  - a door open longer than X minutes (`door_alarm_min`) is an ALARM until it closes;
  - no live reading for `offline_min` minutes is a WARNING "the sensor does not report" until it reports again;
* notifications through the CR-018 pipeline (sources temperature.alarm / .warning / .offline): a WARNING is held - logged, not sent - in the
  quiet hours (`quiet_enabled`, `quiet_from`..`quiet_to`, local time of the installation zone) and while the unit is muted; it is sent when
  the hold ends and the condition still holds. An ALARM is never held. Each row's current notification is resolved when it ends or turns into
  an alarm.

While the infrastructure session is disconnected nothing is recorded and nothing changes (the mirror is not a reading). The learner (mode
`learn`) runs hourly per unit; the janitor (hourly, main.janitor_tick) prunes the history. Nothing is ever sent to a device."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import sqlite3
import threading
import time
from typing import Any

from ..db import Database, new_id
from . import notify
from . import temperature as t
from . import temperature_defrost as learner
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.temperature")

TICK_S = 60
PRUNE_EVERY_S = 3600
LINK = "#/infra/temperature"
SRC = {"alarm": "temperature.alarm", "warning": "temperature.warning", "offline": "temperature.offline"}
_LAST = {"prune": 0.0, "learn": {}}  # type: dict[str, Any]
_lock = threading.Lock()


def reset() -> None:
    """Tests: forget the janitor and learner clocks."""
    _LAST["prune"] = 0.0
    _LAST["learn"] = {}


def _iso(ts: float) -> str:
    return iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc).replace(microsecond=0))


def _ts(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return parse_utc(iso).timestamp()
    except (ValueError, TypeError):
        return None


def fmt(v: float | None) -> str:
    return "—" if v is None else f"{v:.1f}°"


def detail_text(kind: str, ev: dict[str, Any], now_ts: float) -> str:
    """The notification's {detail} in Hebrew (no person, no entity id)."""
    mins = max(0, round((now_ts - (_ts(ev["started_at"]) or now_ts)) / 60))
    if kind == "high":
        return f"{fmt(ev.get('value'))} מעל {fmt(ev.get('threshold'))} כבר {mins} דק׳"
    if kind == "low":
        return f"{fmt(ev.get('value'))} מתחת ל־{fmt(ev.get('threshold'))} כבר {mins} דק׳"
    if kind == "door":
        return f"הדלת פתוחה {mins} דק׳"
    if kind == "offline":
        return f"אין דיווח מהחיישן {mins} דק׳"
    return ""


def _source_of(ev: dict[str, Any]) -> str | None:
    if ev["severity"] == "alarm":
        return SRC["alarm"]
    if ev["kind"] == "offline":
        return SRC["offline"]
    if ev["kind"] in ("high", "low"):
        return SRC["warning"]
    return None


def _signal(u: sqlite3.Row, ev: dict[str, Any], source: str, area: str | None, now_ts: float, *, resolve: bool = False, text: str | None = None) -> notify.Signal:
    params: dict[str, Any] = {"name": u["name"], "place": area or u["name"], "detail": detail_text(ev["kind"], ev, now_ts)}
    if resolve and text:
        params.update({"resolution": "condition_ended", "resolve_text": text})
    return notify.Signal(source, "temperature", u["id"], dedupe_key=f"{source}:{ev['id']}", resolve=resolve, params=params,
                         origin={"unit_id": u["id"], "temp_event_id": ev["id"]}, link=f"{LINK}?unit={u['id']}", area_id=u["area_id"])


def _emit(conn: sqlite3.Connection, signal: notify.Signal) -> notify.EmitResult | None:
    try:
        return notify.emit_full(conn, signal)
    except Exception:  # noqa: BLE001 - one failed emit never stops the pass
        log.warning("temperature notification could not reach the notification centre", exc_info=True)
        return None


def _resolve_current(conn: sqlite3.Connection, u: sqlite3.Row, ev: dict[str, Any], now_ts: float, text: str | None = None) -> None:
    src = _source_of(ev)
    if ev.get("notification_id") and src:
        _emit(conn, _signal(u, ev, src, None, now_ts, resolve=True, text=text))
    ev["notification_id"] = None


def _save(conn: sqlite3.Connection, ev: dict[str, Any]) -> None:
    conn.execute("""UPDATE infra_temp_events SET severity = ?, warned_at = ?, alarmed_at = ?, ended_at = ?, value = ?, peak = ?, notification_id = ?, suppressed = ?,
                    detail_json = ? WHERE id = ?""",
                 (ev["severity"], ev["warned_at"], ev["alarmed_at"], ev["ended_at"], ev["value"], ev["peak"], ev["notification_id"], ev["suppressed"],
                  json.dumps(ev.get("detail") or {}, ensure_ascii=False), ev["id"]))


def _open(conn: sqlite3.Connection, unit_id: str, kind: str, severity: str, started: str, *, value: float | None = None, threshold: float | None = None,
          warned: str | None = None, alarmed: str | None = None, detail: dict[str, Any] | None = None) -> dict[str, Any]:
    ev = {"id": new_id(), "unit_id": unit_id, "kind": kind, "severity": severity, "started_at": started, "warned_at": warned, "alarmed_at": alarmed,
          "ended_at": None, "value": value, "peak": value, "threshold": threshold, "notification_id": None, "suppressed": None, "detail": detail or {}}
    conn.execute("""INSERT INTO infra_temp_events(id, unit_id, kind, severity, started_at, warned_at, alarmed_at, value, peak, threshold, detail_json)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                 (ev["id"], unit_id, kind, severity, started, warned, alarmed, value, value, threshold, json.dumps(ev["detail"], ensure_ascii=False)))
    return ev


def log_act(conn: sqlite3.Connection, unit_id: str, kind: str, at: str, by: str | None, detail: dict[str, Any] | None = None) -> str:
    """An operator act in the alert log (acknowledge, mute): an info row that starts and ends at once; `ack_by` holds who."""
    eid = new_id()
    conn.execute("""INSERT INTO infra_temp_events(id, unit_id, kind, severity, started_at, ended_at, ack_by, ack_at, detail_json) VALUES (?,?,?, 'info', ?, ?, ?, ?, ?)""",
                 (eid, unit_id, kind, at, at, by, at, json.dumps(detail or {}, ensure_ascii=False)))
    return eid


def open_events(conn: sqlite3.Connection, unit_id: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in conn.execute("SELECT * FROM infra_temp_events WHERE unit_id = ? AND ended_at IS NULL AND kind IN ('high','low','door','offline','defrost')", (unit_id,)).fetchall():
        d = dict(r)
        try:
            d["detail"] = json.loads(d.pop("detail_json") or "{}")
        except ValueError:
            d["detail"] = {}
        out[d["kind"]] = d
    return out


def close_all(conn: sqlite3.Connection, u: sqlite3.Row, now_ts: float, why: str) -> int:
    """Ends every open row of a unit (disabled, deleted, sensor changed): resolution stated, never silent."""
    n = 0
    for ev in open_events(conn, u["id"]).values():
        _resolve_current(conn, u, ev, now_ts, text="היחידה הוסרה מהניטור" if why == "removed" else "הניטור הופסק")
        ev["ended_at"] = _iso(now_ts)
        ev["detail"] = {**ev.get("detail", {}), "closed": why}
        _save(conn, ev)
        n += 1
    conn.execute("UPDATE infra_temp_doors SET closed_at = ? WHERE unit_id = ? AND closed_at IS NULL", (_iso(now_ts), u["id"]))
    return n


def _area_names(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["area_id"]: r["name"] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}


def _last_live(conn: sqlite3.Connection, u: sqlite3.Row) -> float:
    r = conn.execute("SELECT MAX(ts) FROM infra_temp_samples WHERE unit_id = ?", (u["id"],)).fetchone()
    base = _ts(u["created_at"]) or 0.0
    return max(float(r[0]) if r and r[0] is not None else 0.0, base)


def _door_track(conn: sqlite3.Connection, u: sqlite3.Row, door: bool | None, changed: str | None, now_ts: float) -> float | None:
    """Keeps infra_temp_doors in step; returns since when the door is open (unix seconds) or None when it is not known to be open."""
    row = conn.execute("SELECT opened_at FROM infra_temp_doors WHERE unit_id = ? AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1", (u["id"],)).fetchone()
    stamp = _ts(changed)
    at = stamp if stamp is not None and stamp <= now_ts else now_ts
    if door is True:
        if row is None:
            at = max(at, now_ts - 86400)
            conn.execute("INSERT OR IGNORE INTO infra_temp_doors(unit_id, opened_at) VALUES (?, ?)", (u["id"], _iso(at)))
            return at
        return _ts(row["opened_at"])
    if door is False and row is not None:
        opened = _ts(row["opened_at"]) or now_ts
        conn.execute("UPDATE infra_temp_doors SET closed_at = ? WHERE unit_id = ? AND opened_at = ?", (_iso(max(at, opened)), u["id"], row["opened_at"]))
    return None


def _notify(conn: sqlite3.Connection, u: sqlite3.Row, ev: dict[str, Any], now_ts: float, *, held: str | None, area: str | None, out: dict[str, int]) -> None:
    """Brings the row's notification in line: an alarm always; a warning unless held (quiet hours / mute)."""
    src = _source_of(ev)
    if src is None:
        return
    want = ev["severity"] == "alarm" or (ev.get("warned_at") is not None and held is None)
    if ev["severity"] != "alarm" and ev.get("warned_at") is not None and held is not None and not ev.get("notification_id"):
        ev["suppressed"] = held
    if not want or ev.get("notification_id"):
        return
    res = _emit(conn, _signal(u, ev, src, area, now_ts))
    if res is None:
        return
    if res.action in ("created", "folded", "renotified"):
        ev["notification_id"] = res.id
        ev["suppressed"] = None
        out["notified"] += 1
    elif res.action == "disabled":
        ev["suppressed"] = "off"


def evaluate(conn: sqlite3.Connection, now_ts: float, *, connected: bool) -> dict[str, int]:
    """One pass over every unit. Returns counters {sampled, opened, alarmed, closed, notified}."""
    out = {"sampled": 0, "opened": 0, "alarmed": 0, "closed": 0, "notified": 0}
    if not connected:
        return out  # the mirror is not a reading: nothing is recorded and nothing changes
    now = _iso(now_ts)
    tz = t.site_zone(conn)
    minute = t.local_min(now_ts, tz)
    defaults = t.load_defaults(conn)
    rows = t.units(conn)
    ents = t.entity_rows(conn, [x for r in rows for x in (r["temp_entity_id"], r["door_entity_id"])])
    learned = t.learned_of(conn)
    areas: dict[str, str] | None = None
    for u in rows:
        if not u["enabled"]:
            out["closed"] += close_all(conn, u, now_ts, "disabled")
            continue
        rules = t.effective(defaults, t.overrides_of(u["rules_json"]))
        reading = t.reading_of(ents.get(u["temp_entity_id"]))
        v = reading["value"]
        low, high = t.band_of(u, reading, rules)
        switched_off = t.is_off(reading, rules)
        de = ents.get(u["door_entity_id"]) if u["door_entity_id"] else None
        door = t.door_of(de["state"], invert=bool(u["door_invert"]), available=de["available"], removed=de["removed_at"], disabled=de["disabled"]) if de is not None else None
        wins = t.unit_windows(u, learned)
        defrost = t.in_defrost(wins, minute)
        quiet = t.in_quiet(rules, minute)
        muted = bool(u["muted_until"] and u["muted_until"] > now)
        held = "quiet" if quiet else "mute" if muted else None
        hard_max = high + float(rules["defrost_hard_margin"])
        flags = (1 if defrost else 0) | (2 if door else 0) | (4 if switched_off else 0)
        if v is not None and t.record_sample(conn, u["id"], int(now_ts), v, flags, reading["setpoint"]):
            out["sampled"] += 1
        door_since = _door_track(conn, u, door, de["last_changed"] if de is not None else None, now_ts) if u["door_entity_id"] else None
        evs = open_events(conn, u["id"])
        if areas is None:
            areas = _area_names(conn)
        area = areas.get(u["area_id"] or "")
        touched: list[dict[str, Any]] = []

        # -- the sensor reports / does not report
        off = evs.get("offline")
        if v is not None and off is not None:
            _resolve_current(conn, u, off, now_ts, "החיישן חזר לדווח")
            off.update(ended_at=now, value=v)
            touched.append(off)
            out["closed"] += 1
        elif v is None and off is None and rules["offline_warn"]:
            last = _last_live(conn, u)
            if now_ts - last >= int(rules["offline_min"]) * 60:
                last_v = conn.execute("SELECT v FROM infra_temp_samples WHERE unit_id = ? ORDER BY ts DESC LIMIT 1", (u["id"],)).fetchone()
                off = _open(conn, u["id"], "offline", "warning", _iso(last), value=last_v[0] if last_v else None, warned=now)
                evs["offline"] = off
                touched.append(off)
                out["opened"] += 1
        elif off is not None:
            touched.append(off)

        # -- a climate unit switched off (owner 2026-10-19): a state, not an alarm - its band rows end (unless `alert_when_off`)
        if switched_off:
            for kind in ("high", "low", "defrost"):
                ev = evs.pop(kind, None)
                if ev is not None:
                    _resolve_current(conn, u, ev, now_ts, "היחידה כובתה")
                    ev["ended_at"] = now
                    ev["detail"] = {**ev.get("detail", {}), "closed": "off"}
                    _save(conn, ev)
                    out["closed"] += 1

        # -- the band (judged only on a live reading; with none, open rows stay as they are and do not escalate)
        if v is not None and not switched_off:
            for kind, outside, back, thr, alarm_on, alarm_min in (
                ("high", v > high, v <= high - rules["hysteresis"], high, rules["high_alarm"], rules["high_alarm_min"]),
                ("low", v < low, v >= low + rules["hysteresis"], low, rules["low_alarm"], rules["low_alarm_min"]),
            ):
                in_def = kind == "high" and defrost and rules["defrost_suppress"] and v <= hard_max
                ev = evs.get(kind)
                if ev is None:
                    if outside and not in_def:
                        ev = _open(conn, u["id"], kind, "warning", now, value=v, threshold=thr, warned=now if rules["warn_on_excursion"] else None,
                                   detail={"hard_max": True} if (kind == "high" and defrost and v > hard_max) else None)
                        evs[kind] = ev
                        touched.append(ev)
                        out["opened"] += 1
                    elif outside and in_def and "defrost" not in evs:
                        evs["defrost"] = _open(conn, u["id"], "defrost", "info", now, value=v, threshold=thr, detail={"window": True})
                        out["opened"] += 1
                    continue
                ev["value"] = v
                ev["peak"] = max(ev["peak"] if ev["peak"] is not None else v, v) if kind == "high" else min(ev["peak"] if ev["peak"] is not None else v, v)
                if back:
                    _resolve_current(conn, u, ev, now_ts, "הטמפרטורה חזרה לטווח")
                    ev["ended_at"] = now
                    out["closed"] += 1
                elif not in_def and alarm_on and ev["alarmed_at"] is None and now_ts - (_ts(ev["started_at"]) or now_ts) >= int(alarm_min) * 60:
                    _resolve_current(conn, u, ev, now_ts)  # the warning gives way to the alarm
                    ev["severity"], ev["alarmed_at"], ev["suppressed"] = "alarm", now, None
                    out["alarmed"] += 1
                touched.append(ev)
            dfr = evs.get("defrost")
            if dfr is not None:
                dfr["value"] = v
                dfr["peak"] = max(dfr["peak"] if dfr["peak"] is not None else v, v)
                if not defrost or v <= high:
                    dfr["ended_at"] = now
                    out["closed"] += 1
                conn.execute("UPDATE infra_temp_events SET value = ?, peak = ?, ended_at = ? WHERE id = ?", (dfr["value"], dfr["peak"], dfr["ended_at"], dfr["id"]))

        # -- the door
        dev = evs.get("door")
        if u["door_entity_id"]:
            if dev is None and door is True and door_since is not None and rules["door_alarm"] and now_ts - door_since >= int(rules["door_alarm_min"]) * 60:
                dev = _open(conn, u["id"], "door", "alarm", _iso(door_since), threshold=float(rules["door_alarm_min"]), alarmed=now)
                out["opened"] += 1
                out["alarmed"] += 1
            elif dev is not None and (door is False or not rules["door_alarm"]):
                _resolve_current(conn, u, dev, now_ts, "הדלת נסגרה")
                dev["ended_at"] = now
                out["closed"] += 1
        elif dev is not None:
            _resolve_current(conn, u, dev, now_ts, "חיישן הדלת הוסר")
            dev["ended_at"] = now
            out["closed"] += 1
        if dev is not None:
            touched.append(dev)

        for ev in touched:
            if ev["ended_at"] is None:
                _notify(conn, u, ev, now_ts, held=held, area=area, out=out)
            _save(conn, ev)
    return out


def run_learner(conn: sqlite3.Connection, now_ts: float, *, force: bool = False) -> int:
    """The hourly learner pass over the units in mode `learn`. Returns how many units it ran for."""
    tz = t.site_zone(conn)
    defaults = t.load_defaults(conn)
    n = 0
    for u in t.units(conn, enabled_only=True):
        if u["defrost_mode"] != "learn":
            continue
        last = _LAST["learn"].get(u["id"], 0.0)
        if not force and now_ts - last < learner.RUN_EVERY_S:
            continue
        _LAST["learn"][u["id"]] = now_ts
        try:
            learner.run_unit(conn, u, t.effective(defaults, t.overrides_of(u["rules_json"])), tz, now_ts)
            n += 1
        except Exception:  # noqa: BLE001
            log.warning("defrost learner failed for one unit", exc_info=True)
    return n


def tick(db: Database, now: float | None = None, *, connected: bool | None = None) -> dict[str, Any]:
    ts = float(now if now is not None else time.time())
    with db.connection(label="temperature.tick") as conn:
        try:
            if conn.execute("SELECT 1 FROM infra_temp_units LIMIT 1").fetchone() is None:
                return {"skipped": "no_units"}
        except sqlite3.Error:
            return {"skipped": "no_schema"}
        res = evaluate(conn, ts, connected=t.mirror_connected() if connected is None else connected)
        res["learned"] = run_learner(conn, ts)
        return res


def janitor(db: Database, now: float | None = None) -> dict[str, Any] | None:
    ts = float(now if now is not None else time.time())
    if ts - _LAST["prune"] < PRUNE_EVERY_S:
        return None
    _LAST["prune"] = ts
    with db.connection(label="temperature.janitor") as conn:
        try:
            return t.prune(conn, ts, int(t.load_defaults(conn)["retention_days"]))
        except sqlite3.Error:
            return {"skipped": "no_schema"}


class Runner:
    def __init__(self) -> None:
        self.stop_evt = threading.Event()
        self.thread: threading.Thread | None = None
        self.last: dict[str, Any] = {}
        self.errors = 0

    def start(self, db: Database) -> None:
        if os.environ.get("SW_TEMPERATURE", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._run, args=(db,), name="temperature-runner", daemon=True)
        self.thread.start()

    def _run(self, db: Database) -> None:
        while not self.stop_evt.wait(TICK_S - (time.time() % TICK_S) + 1.3):
            try:
                self.last = tick(db)
            except Exception:  # noqa: BLE001 - never dies; the next pass retries
                self.errors += 1
                log.warning("temperature pass failed", exc_info=True)

    def shutdown(self) -> None:
        self.stop_evt.set()


RUNNER = Runner()
