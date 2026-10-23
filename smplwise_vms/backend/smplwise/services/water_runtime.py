"""CR-WATER78 slice 2: the leak evaluator - read-only against the infrastructure, nothing is ever sent to a device (owner Q6: no valve,
no shut-off, not even on a detected leak).

Runs on the janitor (main.janitor_tick, every 30 s) once per closed 15-minute bucket (EVAL_GRACE_S after the boundary, so the sampler's
minute has landed), only while the module is on. It judges the water store (water.db: 15-minute buckets, daily totals, the cursor) and
the state mirror's availability flag - never the mirror's values:

| rule       | condition (installation default; per-meter override)                                                    | severity           |
|------------|----------------------------------------------------------------------------------------------------------|--------------------|
| night_flow | inside night_from..night_to (local), `night_min_intervals` consecutive buckets each >= `night_min_lph`    | warning; alarm when the flow ran through the whole window |
| abnormal   | today so far > `abnormal_factor` x the median of the same weekday over `baseline_days`, and > `abnormal_min_l`; no rule for a meter younger than 7 days or without a baseline | warning |
| burst      | a bucket's rate > `burst_lph` (= the meter's max_flow_lph)                                              | alarm at once      |
| offline    | no accepted reading for `offline_min` AND the entity unavailable / unknown / gone (a still meter is not offline) | warning |

Irrigation meters: night rule off by default (owner Q9). One OPEN row per meter and kind (a partial unique index); a row closes when its
condition ends (night flow: a bucket below the threshold closes, or the window ends - an alarm stays until the flow stops), when the rule
is switched off, the meter paused / retired, or the module switched off (`alerts_disabled`). The burst rule scans every bucket since the
meter's cursor (`water_alert_state.last_bucket`), so a restart neither repeats nor skips one.

Notifications go through the CR-018 pipeline (services/notify.emit_full) as subject kind `water`; the dedupe key is the alert row, so a
row is one notification that folds, re-notifies when it turns into an alarm and resolves when the row closes. Holds (the temperature
module's rule): `alerts_enabled` off logs everything and sends nothing; the module's quiet hours and a mute (water.ack) hold WARNINGS;
an ALARM is held only when `quiet_includes_alarms` / `mute_includes_alarms` say so (both default off). A held row is still logged with
`suppressed`, and is sent when the hold ends while the condition still holds.

`clock` is the module's clock (tests replace it, or pass `now`)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
import statistics
import time
from decimal import Decimal
from typing import Any, Callable

from ..db import Database, new_id
from . import energy_store as st
from . import notify
from . import water_alerts as wa
from . import water_meters as wm
from . import water_settings as ws
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.water")

BUCKET_S = st.BUCKET_S
EVAL_GRACE_S = 90              # judge a bucket 90 s after it closed (the sampler writes once a minute)
MAX_SCAN_BUCKETS = 96          # after a long stop the burst scan looks back one day at most
MIN_BASELINE_AGE_S = 7 * 86400 # a meter younger than 7 days has no baseline (and no abnormal rule)
LINK = "#/infra/water/alerts"
SEVERITY = {"warning": "alert", "alarm": "critical"}  # the pipeline severity of a row (leak = alert; burst / a whole night = critical)
LEAK_KINDS = ("night_flow", "burst")
CONDITION_KINDS = ("night_flow", "abnormal", "burst", "offline")
RESOLVE_TEXT = {"night_flow": "הזרימה בלילה נעצרה", "burst": "הספיקה חזרה לרגיל", "abnormal": "הצריכה חזרה לרגיל", "offline": "המונה חזר לדווח"}
OFF_STATES = {"unavailable", "unknown", "none", ""}

clock: Callable[[], float] = time.time
_LAST: dict[str, int] = {"due": 0}


def reset() -> None:
    """Tests: forget the janitor's last judged boundary (a restart)."""
    _LAST["due"] = 0


def _iso(ts: float) -> str:
    return iso_utc(dt.datetime.fromtimestamp(int(ts), dt.timezone.utc))


def _ts(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return parse_utc(iso).timestamp()
    except (ValueError, TypeError):
        return None


def due_boundary(now_ts: float) -> int:
    """The end of the last bucket that may be judged: the latest 15-minute boundary at least EVAL_GRACE_S old."""
    t = int(now_ts)
    b = t - t % BUCKET_S
    return b if t - b >= EVAL_GRACE_S else b - BUCKET_S


def rate_lph(ml: int | None) -> float | None:
    """The flow of one 15-minute bucket in litres per hour (None: the bucket has no measurement)."""
    return None if ml is None else ml / 1000.0 * (3600 / BUCKET_S)


def fmt_volume(ml: float | None) -> str:
    if ml is None:
        return "—"
    if ml >= 1_000_000:
        return f"{ml / 1_000_000:.3f} מ״ק"
    return f"{ml / 1000:.0f} ליטר"


def detail_text(kind: str, value: dict[str, Any], now_ts: float, opened_at: str) -> str:
    """The notification's {detail} in Hebrew - the meter's figure only, never a person or an entity id (CR section 10)."""
    mins = max(0, round((now_ts - (_ts(opened_at) or now_ts)) / 60))
    if kind == "night_flow":
        return f"ספיקת לילה {value.get('floor_lph', 0):.0f} ליטר/שעה כבר {value.get('run_min', 0)} דק׳"
    if kind == "burst":
        return f"ספיקה של {value.get('rate_lph', 0):.0f} ליטר/שעה, מעל {value.get('threshold_lph', 0):.0f}"
    if kind == "abnormal":
        return f"צריכה היום {fmt_volume(value.get('today_ml'))} לעומת {fmt_volume(value.get('median_ml'))} ביום רגיל"
    if kind == "offline":
        return f"אין דיווח מהמונה {max(mins, int(value.get('silent_min') or 0))} דק׳"
    return ""


def in_window(minute: int, a: int, b: int) -> bool:
    if a == b:
        return False
    return a <= minute < b if a < b else minute >= a or minute < b


def holds(rules: dict[str, Any], *, quiet: bool, muted: bool) -> tuple[str | None, str | None]:
    """(why a WARNING is held, why an ALARM is held) - None = it goes out."""
    if not rules.get("alerts_enabled", True):
        return "off", "off"
    warn = "quiet" if quiet else "mute" if muted else None
    alarm = "quiet" if quiet and rules.get("quiet_includes_alarms") else "mute" if muted and rules.get("mute_includes_alarms") else None
    return warn, alarm


def _local_ts(day: dt.date, minute: int, tz: Any) -> int:
    return int(dt.datetime(day.year, day.month, day.day, minute // 60, minute % 60, tzinfo=tz).timestamp())


def night_window(ref_ts: int, rules: dict[str, Any], tz: Any) -> tuple[int, int] | None:
    """(start, end) unix of the night window that started most recently at or before `ref_ts` (local time; may cross midnight)."""
    a, b = wa.minutes_of(rules["night_from"]), wa.minutes_of(rules["night_to"])
    if a == b:
        return None
    d = st.local_date(ref_ts, tz)
    for day in (d, d - dt.timedelta(days=1)):
        start = _local_ts(day, a, tz)
        end = _local_ts(day if b > a else day + dt.timedelta(days=1), b, tz)
        if start <= ref_ts:
            return start, end
    return None


# ---------------------------------------------------------------- the alert log

def _ev(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    try:
        d["value"] = json.loads(d.pop("value_json") or "{}")
    except ValueError:
        d["value"] = {}
    return d


def open_events(conn: sqlite3.Connection, meter_id: str) -> dict[str, dict[str, Any]]:
    return {r["kind"]: _ev(r) for r in conn.execute("SELECT * FROM water_alert_events WHERE meter_id = ? AND closed_at IS NULL", (meter_id,)).fetchall()}


def _open(conn: sqlite3.Connection, meter_id: str, kind: str, severity: str, at: str, value: dict[str, Any]) -> dict[str, Any]:
    ev = {"id": new_id(), "meter_id": meter_id, "kind": kind, "severity": severity, "opened_at": at, "closed_at": None, "close_reason": None,
          "value": value, "suppressed": None, "ack_by": None, "ack_at": None, "notification_id": None, "_new": True}
    conn.execute("INSERT INTO water_alert_events(id, meter_id, kind, severity, opened_at, value_json) VALUES (?,?,?,?,?,?)",
                 (ev["id"], meter_id, kind, severity, at, json.dumps(value, ensure_ascii=False)))
    return ev


def _save(conn: sqlite3.Connection, ev: dict[str, Any]) -> None:
    conn.execute("UPDATE water_alert_events SET severity = ?, closed_at = ?, close_reason = ?, value_json = ?, suppressed = ?, notification_id = ? WHERE id = ?",
                 (ev["severity"], ev["closed_at"], ev["close_reason"], json.dumps(ev["value"], ensure_ascii=False), ev["suppressed"], ev["notification_id"], ev["id"]))


def _source(ev: dict[str, Any]) -> str:
    return wa.SOURCE[wa.EVENT_KIND_TO_ROUTE[ev["kind"]]]


def _signal(m: Any, ev: dict[str, Any], now_ts: float, *, resolve: bool = False, text: str | None = None) -> notify.Signal:
    src = _source(ev)
    params: dict[str, Any] = {"name": m["display_name"], "place": m["area_name"] or m["display_name"], "detail": detail_text(ev["kind"], ev["value"], now_ts, ev["opened_at"])}
    if resolve:
        params.update({"resolution": "condition_ended", "resolve_text": text or RESOLVE_TEXT.get(ev["kind"])})
    return notify.Signal(src, "water", m["id"], severity=SEVERITY[ev["severity"]], dedupe_key=f"{src}:{ev['id']}", resolve=resolve, params=params,
                         origin={"meter_id": m["id"], "water_event_id": ev["id"]}, link=f"{LINK}?meter={m['id']}", area_id=m["eff_area_id"])


def _emit(conn: sqlite3.Connection, signal: notify.Signal) -> notify.EmitResult | None:
    try:
        return notify.emit_full(conn, signal)
    except Exception:  # noqa: BLE001 - one failed emit never stops the pass
        log.warning("water notification could not reach the notification centre", exc_info=True)
        return None


def _close(conn: sqlite3.Connection, m: Any, ev: dict[str, Any], now_ts: float, reason: str, text: str | None = None, resolution: str | None = None) -> None:
    if ev.get("notification_id"):
        sig = _signal(m, ev, now_ts, resolve=True, text=text)
        if resolution:
            sig.params["resolution"] = resolution
        _emit(conn, sig)
    ev["closed_at"], ev["close_reason"] = _iso(now_ts), reason
    _save(conn, ev)


def _notify(conn: sqlite3.Connection, m: Any, ev: dict[str, Any], now_ts: float, held: str | None, held_alarm: str | None, out: dict[str, int],
            *, renotify: bool = False) -> None:
    """Brings the row's notification in line: sent unless held; a held row keeps `suppressed`; a row that turned into an alarm re-notifies."""
    hold = held_alarm if ev["severity"] == "alarm" else held
    if hold is not None:
        if not ev.get("notification_id"):
            ev["suppressed"] = hold
        return
    if ev.get("notification_id") and not renotify:
        return
    res = _emit(conn, _signal(m, ev, now_ts))
    if res is None:
        return
    if res.action in ("created", "folded", "renotified"):
        ev["notification_id"] = res.id
        ev["suppressed"] = None
        out["notified"] += 1
    elif res.action == "disabled":
        ev["suppressed"] = "off"


# ---------------------------------------------------------------- the rules

def _buckets(store: st.EnergyStore, meter_id: str, a: int, b: int) -> dict[int, int]:
    return {bk: ml for bk, ml, cov, _q in store.intervals(meter_id, a, b) if cov > 0}


def judge_night(rules: dict[str, Any], buckets: dict[int, int], due: int, tz: Any) -> dict[str, Any] | None:
    """The night-flow facts at `due` (None outside any window): the window, the trailing run of flowing buckets, whether it fires, whether
    the flow ran through the whole window, and the floor (the lowest bucket flow inside the window - the figure shown everywhere)."""
    w = night_window(due - BUCKET_S, rules, tz)
    if w is None:
        return None
    ws_, we = w
    thr = float(rules["night_min_lph"])
    last = min(we, due) - BUCKET_S
    run = 0
    b = last
    while b >= ws_:
        r = rate_lph(buckets.get(b))
        if r is None or r < thr:
            break
        run += 1
        b -= BUCKET_S
    total = (we - ws_) // BUCKET_S
    seen = [rate_lph(buckets.get(x)) or 0.0 for x in range(ws_, last + 1, BUCKET_S)]
    run_rates = [rate_lph(buckets.get(last - i * BUCKET_S)) or 0.0 for i in range(run)]
    return {"start": ws_, "end": we, "run": run, "total": total, "over": due >= we, "fires": run >= int(rules["night_min_intervals"]),
            "full": due >= we and run >= total, "floor_lph": round(min(run_rates) if run_rates else (min(seen) if seen else 0.0), 2),
            "threshold_lph": thr, "latest_lph": rate_lph(buckets.get(due - BUCKET_S))}


def _night_seen(conn: sqlite3.Connection, meter_id: str, window_start: str) -> bool:
    """A row for this night window already exists (open or closed): the same night never opens twice."""
    for r in conn.execute("SELECT value_json FROM water_alert_events WHERE meter_id = ? AND kind = 'night_flow' ORDER BY opened_at DESC LIMIT 3", (meter_id,)).fetchall():
        try:
            if json.loads(r[0] or "{}").get("window_start") == window_start:
                return True
        except ValueError:
            continue
    return False


def judge_abnormal(store: st.EnergyStore, m: Any, rules: dict[str, Any], due: int, tz: Any) -> dict[str, Any] | None:
    """Today so far vs the median of the same weekday over the baseline (None = no rule: young meter, or no baseline day)."""
    created = _ts(m["created_at"]) or due
    if due - created < MIN_BASELINE_AGE_S:
        return None
    today = st.local_date(due - 1, tz)
    start = st.day_bounds(today, tz)[0]
    days = int(rules["baseline_days"])
    rows = store.daily(m["id"], today - dt.timedelta(days=days), today)
    base = [r[0] for d, r in rows.items() if d.weekday() == today.weekday() and r[1] > 0]
    if not base:
        return None
    median = float(statistics.median(base))
    today_ml = sum(_buckets(store, m["id"], start, due).values())
    limit = Decimal(str(rules["abnormal_factor"])) * Decimal(str(median))
    fires = Decimal(today_ml) > limit and today_ml > int(rules["abnormal_min_l"]) * 1000
    return {"fires": fires, "today_ml": today_ml, "median_ml": median, "factor": str(rules["abnormal_factor"]), "date": today.isoformat(), "baseline_n": len(base)}


def _entity_off(conn: sqlite3.Connection, ref: str) -> bool:
    r = conn.execute("SELECT state, removed_at FROM ha_entities WHERE entity_id = ?", (ref,)).fetchone()
    return r is None or r["removed_at"] is not None or str(r["state"] or "").strip().lower() in OFF_STATES


# ---------------------------------------------------------------- one pass

def _meters(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(f"{wm.AREA_SQL} WHERE m.status <> 'retired' ORDER BY m.id").fetchall()


def evaluate(conn: sqlite3.Connection, store: st.EnergyStore, now_ts: float) -> dict[str, int]:
    """One pass over every live meter (the caller holds the write connection and has checked the module switch)."""
    out = {"meters": 0, "opened": 0, "alarmed": 0, "closed": 0, "notified": 0}
    tz = wm.tz_of(conn)
    due = due_boundary(now_ts)
    base = wa.load(conn)["rules"]
    minute = (lambda d: d.hour * 60 + d.minute)(dt.datetime.fromtimestamp(int(now_ts), tz))
    quiet = bool(base["quiet_enabled"]) and in_window(minute, wa.minutes_of(base["quiet_from"]), wa.minutes_of(base["quiet_to"]))
    now = _iso(now_ts)
    meters = _meters(conn)
    cursors = store.cursor_info([m["id"] for m in meters])
    for m in meters:
        evs = open_events(conn, m["id"])
        if m["status"] != "active":  # paused: its rows end (stated, never silent)
            for ev in evs.values():
                _close(conn, m, ev, now_ts, "meter_paused", "המונה הושהה")
                out["closed"] += 1
            continue
        out["meters"] += 1
        rules = wa.effective(base, m)
        muted = bool(m["muted_until"] and m["muted_until"] > now)
        held, held_alarm = holds(rules, quiet=quiet, muted=muted)
        state = conn.execute("SELECT last_bucket FROM water_alert_state WHERE meter_id = ?", (m["id"],)).fetchone()
        last_judged = state["last_bucket"] if state and state["last_bucket"] is not None else None
        latest = due - BUCKET_S
        scan_from = latest if last_judged is None else max(last_judged + BUCKET_S, latest - (MAX_SCAN_BUCKETS - 1) * BUCKET_S)
        w = night_window(latest, rules, tz)
        lo = min(scan_from, w[0] if w else scan_from, st.day_bounds(st.local_date(due - 1, tz), tz)[0])
        buckets = _buckets(store, m["id"], lo, due)
        touched: list[tuple[dict[str, Any], bool]] = []

        # -- night flow
        ev = evs.get("night_flow")
        nf = judge_night(rules, buckets, due, tz) if rules["night_rule"] else None
        if not rules["night_rule"]:
            if ev is not None:
                _close(conn, m, ev, now_ts, "rule_off", "כלל הלילה כובה")
                out["closed"] += 1
        elif ev is None:
            if nf and nf["fires"] and (not nf["over"] or nf["full"]) and not _night_seen(conn, m["id"], _iso(nf["start"])):
                sev = "alarm" if nf["full"] else "warning"
                ev = _open(conn, m["id"], "night_flow", sev, now, {"window_start": _iso(nf["start"]), "window_end": _iso(nf["end"]), "floor_lph": nf["floor_lph"],
                                                                    "run_min": nf["run"] * 15, "threshold_lph": nf["threshold_lph"]})
                out["opened"] += 1
                out["alarmed"] += sev == "alarm"
                touched.append((ev, False))
        else:
            same_night = nf is not None and ev["value"].get("window_start") == _iso(nf["start"])
            if same_night and nf["fires"]:
                ev["value"].update(floor_lph=nf["floor_lph"], run_min=nf["run"] * 15)
            if ev["severity"] == "alarm":
                lat = nf["latest_lph"] if nf else None
                if lat is None or lat < float(rules["night_min_lph"]):
                    _close(conn, m, ev, now_ts, "flow_stopped")
                    out["closed"] += 1
                else:
                    touched.append((ev, False))
            elif same_night and nf["full"]:
                ev["severity"] = "alarm"  # the flow ran through the whole night window
                out["alarmed"] += 1
                touched.append((ev, True))
            elif not same_night or nf["over"]:
                _close(conn, m, ev, now_ts, "window_ended", "חלון הלילה הסתיים")
                out["closed"] += 1
            elif nf["run"] == 0:
                _close(conn, m, ev, now_ts, "flow_stopped")
                out["closed"] += 1
            else:
                touched.append((ev, False))

        # -- burst (every bucket since the cursor)
        ev = evs.get("burst")
        thr = float(rules["burst_lph"])
        if not rules["burst_rule"]:
            if ev is not None:
                _close(conn, m, ev, now_ts, "rule_off", "כלל הספיקה כובה")
                out["closed"] += 1
        else:
            hits = [(b, rate_lph(buckets.get(b))) for b in range(scan_from, due, BUCKET_S)]
            hits = [(b, r) for b, r in hits if r is not None and r > thr]
            if ev is None and hits:
                b, r = max(hits, key=lambda x: x[1])
                ev = _open(conn, m["id"], "burst", "alarm", now, {"rate_lph": round(r, 1), "threshold_lph": thr, "bucket": _iso(b)})
                out["opened"] += 1
                out["alarmed"] += 1
                touched.append((ev, False))
            elif ev is not None:
                r_latest = rate_lph(buckets.get(latest))
                if r_latest is None or r_latest <= thr:
                    _close(conn, m, ev, now_ts, "flow_normal")
                    out["closed"] += 1
                else:
                    ev["value"]["rate_lph"] = max(float(ev["value"].get("rate_lph") or 0), round(r_latest, 1))
                    touched.append((ev, False))

        # -- abnormal daily consumption
        ev = evs.get("abnormal")
        ab = judge_abnormal(store, m, rules, due, tz) if rules["abnormal_rule"] else None
        if ev is None:
            if ab and ab["fires"]:
                ev = _open(conn, m["id"], "abnormal", "warning", now, {k: ab[k] for k in ("today_ml", "median_ml", "factor", "date", "baseline_n")})
                out["opened"] += 1
                touched.append((ev, False))
        elif not rules["abnormal_rule"] or ab is None or not ab["fires"] or ev["value"].get("date") != ab["date"]:
            _close(conn, m, ev, now_ts, "rule_off" if not rules["abnormal_rule"] else "condition_ended")
            out["closed"] += 1
        else:
            ev["value"]["today_ml"] = ab["today_ml"]
            touched.append((ev, False))

        # -- not reporting (a silent meter whose entity is available is NOT offline: water is often still)
        ev = evs.get("offline")
        cur = cursors.get(m["id"])
        last_seen = (cur.seen_ts if cur and cur.seen_ts is not None else None) or _ts(m["created_at"]) or now_ts
        silent = now_ts - last_seen
        off = rules["offline_rule"] and _entity_off(conn, m["source_ref"]) and silent >= int(rules["offline_min"]) * 60
        if ev is None and off:
            ev = _open(conn, m["id"], "offline", "warning", now, {"last_reading_at": _iso(last_seen), "silent_min": int(silent // 60)})
            out["opened"] += 1
            touched.append((ev, False))
        elif ev is not None and not off:
            _close(conn, m, ev, now_ts, "reporting" if rules["offline_rule"] else "rule_off")
            out["closed"] += 1
        elif ev is not None:
            ev["value"]["silent_min"] = int(silent // 60)
            touched.append((ev, False))

        for ev, renotify in touched:
            _notify(conn, m, ev, now_ts, held, held_alarm, out, renotify=renotify)
            _save(conn, ev)
        conn.execute("""INSERT INTO water_alert_state(meter_id, last_bucket, evaluated_at) VALUES (?, ?, ?)
                        ON CONFLICT(meter_id) DO UPDATE SET last_bucket = MAX(COALESCE(last_bucket, 0), excluded.last_bucket), evaluated_at = excluded.evaluated_at""",
                     (m["id"], latest, now))
    # rows of meters that were retired meanwhile end too
    for r in conn.execute("""SELECT e.*, m.display_name FROM water_alert_events e JOIN water_meters m ON m.id = e.meter_id
                             WHERE e.closed_at IS NULL AND m.status = 'retired'""").fetchall():
        mrow = wm.get(conn, r["meter_id"])
        _close(conn, mrow, _ev(r), now_ts, "meter_retired", "המונה הוצא משימוש")
        out["closed"] += 1
    return out


def close_all(conn: sqlite3.Connection, now_ts: float, reason: str = "alerts_disabled") -> int:
    """Ends every open row (the module switched off): each notification is resolved with `alerts_disabled` (the elevators' rule)."""
    n = 0
    try:
        rows = conn.execute("SELECT * FROM water_alert_events WHERE closed_at IS NULL").fetchall()
    except sqlite3.Error:
        return 0
    for r in rows:
        m = wm.get(conn, r["meter_id"])
        if m is None:
            continue
        _close(conn, m, _ev(r), now_ts, reason, "התראות המים כובו", resolution=reason)
        n += 1
    return n


def tick(db: Database, settings: Any, now: float | None = None) -> dict[str, Any]:
    ts = float(now if now is not None else clock())
    with db.connection(label="water.alerts") as conn:
        if not ws.enabled(conn):
            return {"skipped": "module_off"}
        try:
            conn.execute("SELECT 1 FROM water_alert_settings LIMIT 1").fetchone()
        except sqlite3.Error:
            return {"skipped": "no_schema"}
        return evaluate(conn, wm.store_for(settings), ts)


def janitor(db: Database, settings: Any, now: float | None = None) -> dict[str, Any] | None:
    """Called by main.janitor_tick every 30 s: one pass per closed 15-minute bucket (nothing while the module is off)."""
    ts = float(now if now is not None else clock())
    due = due_boundary(ts)
    if due <= _LAST["due"]:
        return None
    _LAST["due"] = due
    return tick(db, settings, ts)


# ---------------------------------------------------------------- reads for the API

def summary(conn: sqlite3.Connection, visible: Callable[[Any], bool], now_ts: float) -> dict[str, int]:
    """The KPI row (open / acknowledged open / opened in the last 7 days / open leaks) over the meters the caller may see."""
    since = _iso(now_ts - 7 * 86400)
    rows = conn.execute("""SELECT e.kind, e.closed_at, e.ack_at, e.opened_at, m.source_ref FROM water_alert_events e JOIN water_meters m ON m.id = e.meter_id
                           WHERE e.closed_at IS NULL OR e.opened_at >= ?""", (since,)).fetchall()
    rows = [r for r in rows if visible(r)]
    open_ = [r for r in rows if r["closed_at"] is None]
    return {"open": len(open_), "acked": sum(1 for r in open_ if r["ack_at"]), "last_7d": sum(1 for r in rows if r["opened_at"] >= since),
            "open_leaks": sum(1 for r in open_ if r["kind"] in LEAK_KINDS)}
