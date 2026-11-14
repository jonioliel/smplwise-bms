"""CR-039 / DOORWIN-295: door windows and emergency door controls - the HTTP surface (Arx RBAC is the only authority).

Door windows (`/doors/windows/...`): reads need `access.stations.read` (filtered per station); rule writes need `access.windows.manage` on
EVERY door of the rule; the override and the manual relock check need `access.windows.cancel` or `.manage` on the door; settings, the
exterior flag need `system.configure`. Every write needs `confirmed: true` from the client's confirmation step and an identified interactive
person (never a wall / kiosk account, never a bearer-token client).

Emergency (`/doors/emergency/...`): the state (the red strip) is readable with `access.read` anywhere; `prepare` -> `incidents` (start) /
`incidents/{id}/release` are the two server-side steps (services/door_emergency.py); `access.emergency.lock` / `.open` at a scope covering
the request. Drills go through the same two steps with `drill: true` and never reach an engine.

Shipped OFF (`doors.windows.enabled`, `doors.emergency.enabled` = off) and never live while the live engine is not built
(door_windows_engine.LIVE_ENGINE_BUILT = False; `go_live_permitted` in the answers below reports `program_ready()` for windows and `emergency_ready()` for emergency: permit AND that
engine's own flag, SPLITSWITCH-297)."""
from __future__ import annotations

import datetime as dt
import re
import secrets
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, get_read_conn, settings_of
from ..db import commit_now, rollback_and_restart
from ..errors import ApiError
from ..remote_channel import is_remote
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import door_emergency as de
from ..services import door_emergency_grants as deg
from ..services import door_window_triggers as dwt
from ..services import door_windows as dw
from ..services import door_windows_engine as dwe
from ..services import door_windows_watch as dww
from ..services import special_days

router = APIRouter()

CONFIGURE = "system.configure"
REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
UTC = dt.timezone.utc


def now_utc() -> dt.datetime:
    """The clock of these routes (tests replace it)."""
    return dt.datetime.now(UTC)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _dev(request: Request) -> bool:
    return bool(settings_of(request).dev_user)


def _confirmed(value: Any) -> None:
    if value is not True:
        raise ApiError(409, "confirmation_required", "הפעולה דורשת אישור מפורש.")


def _today(conn: sqlite3.Connection, now: dt.datetime) -> dt.date:
    from zoneinfo import ZoneInfo

    return dw.local_date(now, ZoneInfo(dw.installation_zone(conn)))


# ================================================================ door windows

def _rule_view(conn: sqlite3.Connection, row: sqlite3.Row, labels: dict[str, dw.Door], visible: set[str]) -> dict[str, Any]:
    """A rule as this reader may see it. Doors outside the reader's visible set are never listed (no station id, relay or label - review 2
    E-07); only their count is returned in `hidden_doors`."""
    doc = dw._rule_doc(conn, row)
    shown = [(s, r) for s, r in doc.doors if dw.door_key(s, r) in visible]
    return {
        "id": row["id"], "name": row["name"], "kind": row["kind"], "state": row["state"], "calendar_policy": row["calendar_policy"],
        "notes": row["notes"] or "", "revision": row["revision"], "updated_at": row["updated_at"], "approved": bool(row["approved_by"]),
        "doors": [{"station_id": s, "relay": r, "key": dw.door_key(s, r), "label": labels[dw.door_key(s, r)].label if dw.door_key(s, r) in labels else dw.door_key(s, r),
                   "visible": True} for s, r in shown],
        "hidden_doors": len(doc.doors) - len(shown),
        "periods": [{"weekday": p.weekday, "on_date": p.on_date, "start": p.start, "end": p.end} for p in doc.periods],
        **({"trigger": dwt.trigger_view(conn, row["id"]), "snippet": dwt.snippet(row["id"])} if row["kind"] == "event" else {}),
    }


def _occ_view(r: sqlite3.Row, labels: dict[str, dw.Door], rule_names: dict[str, str]) -> dict[str, Any]:
    key = dw.door_key(r["station_id"], r["relay"])
    return {"id": r["id"], "door": key, "label": labels[key].label if key in labels else key, "rule_id": r["rule_id"], "rule_name": rule_names.get(r["rule_id"] or "", ""),
            "start_at": r["start_at"], "end_at": r["end_at"], "zone": r["zone"], "state": r["state"], "tier": r["tier"], "retries": r["retries"],
            "unconfirmed_at": r["unconfirmed_at"], "last_reason": r["last_reason"], "resolution": r["resolution"], "resolved_at": r["resolved_at"]}


@router.get("/doors/windows/state")
def windows_state(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Everything the door-windows screen shows to this person: the switch and tier, the doors they may see (and which they may manage or
    override), the rules touching those doors, and the occurrences of the next 7 days plus every open alarm on them."""
    visible = dw.visible_doors(conn, principal)
    manage = {d.key for d in dw.visible_doors(conn, principal, dw.MANAGE)}
    cancel = {d.key for d in dw.visible_doors(conn, principal, dw.CANCEL)} | manage
    vis_keys = {d.key for d in visible} | manage
    labels = dw.doors_by_key(conn)
    ext = dw.exterior_doors(conn)
    rules = []
    rule_names: dict[str, str] = {}
    for row in conn.execute("SELECT * FROM door_window_rules WHERE state <> 'retired' ORDER BY name, id").fetchall():
        rule_names[row["id"]] = row["name"]
        view = _rule_view(conn, row, labels, vis_keys)
        if view["doors"]:
            view["manageable"] = not view["hidden_doors"] and all(d["key"] in manage for d in view["doors"])
            rules.append(view)
    now = now_utc()
    horizon = dw.iso(now + dt.timedelta(days=7))
    occ = [o for o in (_occ_view(r, labels, rule_names) for r in conn.execute(
        """SELECT * FROM door_window_occurrences WHERE (end_at >= ? AND start_at <= ? AND state NOT IN ('cancelled'))
           OR state IN ('relock_unconfirmed','ending','active','starting') ORDER BY start_at LIMIT 500""", (dw.iso(now - dt.timedelta(hours=12)), horizon)).fetchall())
        if o["door"] in vis_keys]
    engine_tier = dwe.window_engine(settings_of(request)).tier
    engine_rows = {dw.door_key(r["station_id"], r["relay"]): r for r in conn.execute("SELECT * FROM door_window_engine").fetchall()}  # DOORWRITE-297
    return {
        "enabled": dw.enabled(conn), "tier": engine_tier if dw.enabled(conn) else "prepared", "go_live_permitted": dwe.program_ready(),
        "settings": {k.split(".")[-1]: v for k, v in dw.settings_view(conn).items()},
        "can": {"manage": bool(manage), "cancel": bool(cancel), "configure": authorize(conn, principal, CONFIGURE, INSTALLATION).allowed},
        "automation_actor": dw.automation_actor_on(conn),
        "foreign_paused": [f | {"label": labels[f["door"]].label if f["door"] in labels else f["door"]} for f in dw.foreign_paused_list(conn) if f["door"] in vis_keys],
        "triggers": [{"at": t["at"], "source": t["source"], "door": dw.door_key(t["station_id"], t["relay"]), "decision": t["decision"], "reason": t["reason"],
                      "end_at": t["end_at"]} for t in conn.execute(
            "SELECT at, source, station_id, relay, decision, reason, end_at FROM door_window_trigger_log WHERE station_id IS NOT NULL ORDER BY at DESC LIMIT 60").fetchall()
            if dw.door_key(t["station_id"], t["relay"]) in vis_keys][:20],
        "doors": [{"key": d.key, "station_id": d.station_id, "relay": d.relay, "label": d.label, "station_name": d.station_name, "name": d.name, "zone": d.zone,
                   "manage": d.key in manage, "cancel": d.key in cancel, "exterior": d.key in ext, "program": dw.program_view(engine_rows.get(d.key))}
                  for d in sorted(visible, key=lambda d: d.label)],
        "rules": rules, "occurrences": occ, "now": dw.iso(now),
    }


class RuleBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    kind: Literal["weekly", "once", "event"]
    calendar_policy: Literal["skip_holidays", "holidays_like_friday", "ignore_calendar"] = "skip_holidays"
    notes: str = Field(default="", max_length=300)
    doors: list[dict[str, Any]] = Field(min_length=1, max_length=64)
    periods: list[dict[str, Any]] = Field(default_factory=list, max_length=56)
    trigger: dict[str, Any] | None = None   # an `event` rule: {source, duration_s, allowed_from, allowed_to, max_per_day, cooldown_s, automation_id, regenerate_token}
    revision: int | None = None
    enable: bool = False
    confirmed: Any = None


def _body_doors(body: RuleBody) -> list[tuple[str, int]]:
    out = []
    for d in body.doors:
        sid, relay = d.get("station_id"), d.get("relay")
        if isinstance(sid, str) and isinstance(relay, int) and not isinstance(relay, bool):
            out.append((sid, relay))
    return out


@router.post("/doors/windows/rules/preview")
def preview_rule(body: RuleBody, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The compiled occurrences of the next 7 days per door, without saving (no engine call)."""
    dw.require_doors(conn, principal, _body_doors(body), dw.MANAGE, "door.window.preview")
    return dw.preview(conn, body.model_dump(), now_utc())


def _after_write(request: Request, conn: sqlite3.Connection) -> None:
    commit_now(conn)
    dw.WORKER.wake()


def _save(request: Request, principal: Principal, conn: sqlite3.Connection, body: RuleBody, rule_id: str | None) -> dict[str, Any]:
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.rule_saved", dev_mode=_dev(request))
    if rule_id is not None:
        row = dw.rule_row(conn, rule_id)
        if row is None:
            raise ApiError(404, "not_found", "החלון לא נמצא.")
        dw.require_doors(conn, principal, dw._rule_doc(conn, row).doors, dw.MANAGE, "door.window.rule_saved")  # the old scope too
    dw.require_doors(conn, principal, _body_doors(body), dw.MANAGE, "door.window.rule_saved")
    secrets_out: dict[str, str] = {}
    rid = dw.save_rule(conn, principal, body.model_dump(), rule_id=rule_id, today=_today(conn, now_utc()), secrets_out=secrets_out)
    row = dw.rule_row(conn, rid)
    audit(conn, actor=principal, action="door.window.rule_saved", decision="allowed", resource_type="door_window_rule", resource_id=rid, request_id=_rid(request),
          details={"revision": row["revision"], "kind": row["kind"], "doors": len(body.doors), "periods": len(body.periods), "created": rule_id is None})
    if body.enable and row["state"] != "enabled":
        row = dw.set_rule_state(conn, principal, rid, "enabled")
        audit(conn, actor=principal, action="door.window.rule_enabled", decision="allowed", resource_type="door_window_rule", resource_id=rid, request_id=_rid(request),
              details={"revision": row["revision"]})
    view = _rule_view(conn, row, dw.doors_by_key(conn), {d.key for d in dw.visible_doors(conn, principal)})
    _after_write(request, conn)
    out: dict[str, Any] = {"rule": view}
    if secrets_out.get("token"):  # the trigger token, ONCE: it is never stored or audited in the clear
        out["token"] = secrets_out["token"]
        out["snippet"] = dwt.snippet(rid, secrets_out["token"])
    return out


@router.post("/doors/windows/rules", status_code=201)
def create_rule(body: RuleBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _save(request, principal, conn, body, None)


@router.put("/doors/windows/rules/{rule_id}")
def update_rule(body: RuleBody, request: Request, rule_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return _save(request, principal, conn, body, rule_id)


class ConfirmBody(BaseModel):
    confirmed: Any = None


# NOTE: the two routes below are declared BEFORE the generic `/rules/{rule_id}/{action}` route on purpose (first match wins).
class ArmBody(BaseModel):
    armed: bool
    confirmed: Any = None


@router.post("/doors/windows/rules/{rule_id}/arm")
def arm_rule(body: ArmBody, request: Request, rule_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Arm (or return to simulation) an event rule whose trigger is Home Assistant / an Arx automation (CR-039 9.4). Arming is refused while the
    contract reports no automation actor: a simulated rule cannot be armed by any setting (fail closed). `access.windows.manage` on every door."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.rule_armed", dev_mode=_dev(request))
    row = dw.rule_row(conn, rule_id)
    if row is None or row["state"] == "retired" or row["kind"] != "event":
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    dw.require_doors(conn, principal, dw._rule_doc(conn, row).doors, dw.MANAGE, "door.window.rule_armed")
    try:
        state = dwt.set_arm_state(conn, principal, rule_id, body.armed)
    except ApiError as exc:
        audit(conn, actor=principal, action="door.window.rule_armed", decision="denied", resource_type="door_window_rule", resource_id=rule_id, reason=exc.code,
              request_id=_rid(request))
        commit_now(conn)
        raise
    audit(conn, actor=principal, action="door.window.rule_armed", decision="allowed", resource_type="door_window_rule", resource_id=rule_id, request_id=_rid(request),
          details={"arm_state": state, "revision": row["revision"]})
    view = _rule_view(conn, dw.rule_row(conn, rule_id), dw.doors_by_key(conn), {d.key for d in dw.visible_doors(conn, principal)})
    _after_write(request, conn)
    return {"rule": view}


@router.post("/doors/windows/rules/{rule_id}/token")
def regenerate_token(body: ConfirmBody, request: Request, rule_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A new secret for a Home Assistant event rule (the old one stops working at once). Shown ONCE in this answer, stored as SHA-256 only."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.token_regenerated", dev_mode=_dev(request))
    row = dw.rule_row(conn, rule_id)
    trig = conn.execute("SELECT source FROM door_window_triggers WHERE rule_id = ?", (rule_id,)).fetchone()
    if row is None or row["state"] == "retired" or row["kind"] != "event" or trig is None or trig["source"] != "ha_event":
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    dw.require_doors(conn, principal, dw._rule_doc(conn, row).doors, dw.MANAGE, "door.window.token_regenerated")
    token = secrets.token_urlsafe(24)
    at = dw.iso(now_utc())
    conn.execute("UPDATE door_window_triggers SET token_sha256 = ?, token_set_at = ?, authorising_actor = ?, arm_state = 'simulate' WHERE rule_id = ?",
                 (dwt.token_sha(token), at, principal.user_id, rule_id))
    audit(conn, actor=principal, action="door.window.token_regenerated", decision="allowed", resource_type="door_window_rule", resource_id=rule_id, request_id=_rid(request))
    commit_now(conn)
    return {"token": token, "snippet": dwt.snippet(rule_id, token)}


@router.post("/doors/windows/rules/{rule_id}/{action}")
def rule_action(body: ConfirmBody, request: Request, rule_id: str = Path(min_length=1, max_length=64), action: Literal["enable", "pause", "retire"] = Path(),
                principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _confirmed(body.confirmed)
    name = {"enable": "door.window.rule_enabled", "pause": "door.window.rule_paused", "retire": "door.window.rule_retired"}[action]
    dw.require_person(conn, principal, name, dev_mode=_dev(request))
    row = dw.rule_row(conn, rule_id)
    if row is None or row["state"] == "retired":
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    dw.require_doors(conn, principal, dw._rule_doc(conn, row).doors, dw.MANAGE, name)
    row = dw.set_rule_state(conn, principal, rule_id, {"enable": "enabled", "pause": "paused", "retire": "retired"}[action])
    audit(conn, actor=principal, action=name, decision="allowed", resource_type="door_window_rule", resource_id=rule_id, request_id=_rid(request),
          details={"revision": row["revision"]})
    view = _rule_view(conn, row, dw.doors_by_key(conn), {d.key for d in dw.visible_doors(conn, principal)})
    _after_write(request, conn)
    return {"rule": view}


@router.post("/doors/windows/occurrences/{occ_id}/end-now")
def end_now(body: ConfirmBody, request: Request, occ_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The guard override (CR-039 2 / 7.1): end a running window of one door now. The engine is told to pause the door's program (the close
    direction) and the occurrence is watched to its relock like any end. The program stays paused until the overridden window's end."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.override", dev_mode=_dev(request))
    occ = dw.occurrence_row(conn, occ_id)
    if occ is None:
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    if not (dw.may(conn, principal, dw.CANCEL, occ["station_id"]) or dw.may(conn, principal, dw.MANAGE, occ["station_id"])):
        audit(conn, actor=principal, action="door.window.override", decision="denied", resource_type="door", resource_id=dw.door_key(occ["station_id"], occ["relay"]), reason="no_permission")
        raise ApiError(403, "forbidden", "אין הרשאה להפסיק חלון בדלת זו.")
    if occ["state"] == "superseded":
        raise ApiError(409, "under_incident", "הדלת במצב חירום - רק שחרור החירום מסיים אותו.")
    now = now_utc()
    at = dw.iso(now)
    if occ["state"] in ("prepared", "planned", "armed") and occ["start_at"] > at:
        conn.execute("UPDATE door_window_occurrences SET state = 'cancelled', resolution = 'override', resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
                     (principal.user_id, at, at, occ_id))
        # W-01: the cancel must reach the engine - the window leaves the compiled program (an exclusion by token), and the next compile never re-plans it
        conn.execute("INSERT OR REPLACE INTO door_window_exclusions(station_id, relay, token, excluded_by, excluded_at) VALUES (?, ?, ?, ?, ?)",
                     (occ["station_id"], occ["relay"], occ["token"], principal.user_id, at))
        outcome = "cancelled"
    elif occ["state"] in ("starting", "active", "not_started", "prepared", "armed", "planned"):
        conn.execute("""UPDATE door_window_occurrences SET state = CASE WHEN tier = 'prepared' THEN 'elapsed' ELSE 'ending' END, end_at = ?, last_reason = 'override',
                        resolved_by = ?, updated_at = ? WHERE id = ?""", (at, principal.user_id, at, occ_id))
        outcome = "ending"
    else:
        raise ApiError(409, "not_running", "החלון אינו פעיל.")
    audit(conn, actor=principal, action="door.window.override", decision="allowed", resource_type="door", resource_id=dw.door_key(occ["station_id"], occ["relay"]),
          request_id=_rid(request), details={"occurrence_id": occ_id, "outcome": outcome, "planned_end": occ["end_at"]})
    from ..services import notify

    notify.emit(conn, notify.Signal("door.window_overridden", "door", dw.door_key(occ["station_id"], occ["relay"]), dedupe_key=f"door.window_overridden:{occ_id}",
                                    params={"name": (dw.doors_by_key(conn).get(dw.door_key(occ["station_id"], occ["relay"])) or dw.Door("", 0, "", "", "")).label}))
    commit_now(conn)
    if outcome == "ending":
        dw.pause_door(request.app.state.db, settings_of(request), occ["station_id"], occ["relay"], occ["end_at"], why="override")
    dw.WORKER.wake(sync=outcome == "cancelled")
    if outcome == "cancelled":  # W-01: rewrite the engine's program now, so the cancelled window cannot open the door
        dw.sync(request.app.state.db, settings_of(request), now_utc())
    with request.app.state.db.connection(mode="read") as rconn:
        return {"occurrence": _occ_view(dw.occurrence_row(rconn, occ_id), dw.doors_by_key(rconn), {})}


class CheckedBody(BaseModel):
    checked: Literal["camera", "door"]
    confirmed: Any = None


@router.post("/doors/windows/occurrences/{occ_id}/confirm-closed")
def confirm_closed(body: CheckedBody, request: Request, occ_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The manual relock check (CR-039 4.4 step 4): a person looked at the door or its camera. Only an unconfirmed relock can be confirmed."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.confirm_closed", dev_mode=_dev(request))
    occ = dw.occurrence_row(conn, occ_id)
    if occ is None:
        raise ApiError(404, "not_found", "החלון לא נמצא.")
    key = dw.door_key(occ["station_id"], occ["relay"])
    if not (dw.may(conn, principal, dw.CANCEL, occ["station_id"]) or dw.may(conn, principal, dw.MANAGE, occ["station_id"])):
        audit(conn, actor=principal, action="door.window.confirm_closed", decision="denied", resource_type="door", resource_id=key, reason="no_permission")
        raise ApiError(403, "forbidden", "אין הרשאה לאשר דלת זו.")
    if occ["state"] != "relock_unconfirmed":
        raise ApiError(409, "not_unconfirmed", "אין מה לאשר בדלת זו.")
    dww.confirm_closed(conn, occ, principal.user_id, body.checked, now_utc())
    audit(conn, actor=principal, action="door.window.confirm_closed", decision="allowed", resource_type="door", resource_id=key, request_id=_rid(request),
          details={"occurrence_id": occ_id, "checked": body.checked, "retries": occ["retries"]})
    view = _occ_view(dw.occurrence_row(conn, occ_id), dw.doors_by_key(conn), {})
    _after_write(request, conn)
    return {"occurrence": view}


class OpenForBody(BaseModel):
    duration_s: int = Field(ge=60, le=43200)
    confirmed: Any = None


_REFUSAL_TEXT = {
    "closed_day": "המבנה סגור היום.", "quiet_hours": "החלון נוגע בשעות השקטות.", "crosses_midnight": "החלון חוצה חצות.", "too_long": "החלון ארוך מהמותר.",
    "daily_cap": "הדלת הגיעה למספר החלונות המותר ליום.", "storm": "יותר מדי הפעלות בשעה האחרונה.", "relock_unconfirmed": "חזרת הדלת למצב רגיל טרם אושרה.",
    "emergency": "מצב חירום פעיל.", "paused": "החלון הופסק ידנית.", "inside_window": "הדלת כבר בחלון פתיחה.", "overlaps_window": "החלון חופף חלון אחר.",
    "already_covered": "הדלת כבר פתוחה לפחות עד אז.", "would_extend_running": "הארכת חלון שרץ כבויה.", "exterior_not_allowed": "דלת חיצונית אינה יכולה להיות בחלון פתיחה.",
}


@router.post("/doors/windows/doors/{station_id}/{relay}/open-for")
def open_for(body: OpenForBody, request: Request, station_id: str = Path(min_length=1, max_length=128), relay: int = Path(ge=1, le=64),
             principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The `arx_button` source (CR-039 9.1): "hold this door open for N hours", a person's confirmed click. `access.windows.manage` on the door
    (`.cancel` is not enough). The hold is a plan row like any window; the engine holds and relocks, the watchdog confirms - nothing opens from here."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.open_for", dev_mode=_dev(request))
    dw.require_doors(conn, principal, [(station_id, relay)], dw.MANAGE, "door.window.open_for")
    if not dw.enabled(conn):
        raise ApiError(409, "windows_off", "חלונות הפתיחה כבויים.")
    door = dw.doors_by_key(conn).get(dw.door_key(station_id, relay))
    if door is None:
        raise ApiError(422, "door_unknown", "הדלת אינה מוכרת כרגע.")
    commit_now(conn)
    d = dwt.open_for(request.app.state.db, settings_of(request), now_utc(), principal, door, body.duration_s)
    with request.app.state.db.connection() as wconn:
        audit(wconn, actor=principal, action="door.window.open_for", decision="allowed" if d.decision in ("started", "extended") else "denied",
              resource_type="door", resource_id=door.key, reason=d.reason or d.decision, request_id=_rid(request),
              details={"decision": d.decision, "reason": d.reason, "occurrence_id": d.occurrence_id, "duration_s": body.duration_s})
    if d.decision not in ("started", "extended"):
        raise ApiError(409, "not_started", _REFUSAL_TEXT.get(d.reason or "", "החלון לא התחיל."), details={"reason": d.reason})
    return {"decision": d.as_dict()}


@router.post("/doors/windows/doors/{station_id}/{relay}/foreign-handled")
def foreign_handled(body: ConfirmBody, request: Request, station_id: str = Path(min_length=1, max_length=128), relay: int = Path(ge=1, le=64),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A person marks a door's foreign program as dealt with after an emergency LOCK paused it (CR-039 19.3): they enabled it again in the
    intercom window, or decided to leave it off. Arx never re-activates a program a person made."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.foreign_handled", dev_mode=_dev(request))
    if not (dw.may(conn, principal, dw.MANAGE, station_id) or dw.may(conn, principal, dw.CANCEL, station_id)):
        audit(conn, actor=principal, action="door.window.foreign_handled", decision="denied", resource_type="door", resource_id=dw.door_key(station_id, relay), reason="no_permission")
        raise ApiError(403, "forbidden", "אין הרשאה לדלת זו.")
    if not dw.clear_foreign_paused(conn, station_id, relay):
        raise ApiError(409, "nothing_to_clear", "אין תוכנית שהושהתה בדלת זו.")
    audit(conn, actor=principal, action="door.window.foreign_handled", decision="allowed", resource_type="door", resource_id=dw.door_key(station_id, relay), request_id=_rid(request))
    return {"door": dw.door_key(station_id, relay), "handled": True}


# ---------------------------------------------------------------- DOORWRITE-297: the door's program - dry run and "write again"

@router.get("/doors/windows/doors/{station_id}/{relay}/program/preview")
def program_preview(request: Request, station_id: str = Path(min_length=1, max_length=128), relay: int = Path(ge=1, le=64),
                    principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The dry run of the door's program write: what Arx would write, whether it is valid, what the engine holds now and what the write
    would do (pause first? inside a running window?). Writes nothing (only a refusal is audited). `access.windows.manage` on the door."""
    dw.require_doors(conn, principal, [(station_id, relay)], dw.MANAGE, "door.window.program_preview")
    commit_now(conn)  # the engine read below runs outside this request's write lock
    return {"preview": dw.program_preview(request.app.state.db, settings_of(request), station_id, relay, now_utc())}


class ProgramApplyBody(BaseModel):
    expect_sha: str | None = Field(default=None, max_length=64)  # the `sha` of the preview the person confirmed
    confirmed: Any = None


_APPLY_REFUSAL = {"prepared": "התוכנית מוכנה בלבד: אין כתיבה לאינטרקום בגרסה זו.", "windows_off": "חלונות הפתיחה כבויים.",
                  "preview_stale": "התוכנית השתנתה מאז התצוגה המקדימה. פתחו אותה שוב."}


@router.post("/doors/windows/doors/{station_id}/{relay}/program/apply")
def program_apply(body: ProgramApplyBody, request: Request, station_id: str = Path(min_length=1, max_length=128), relay: int = Path(ge=1, le=64),
                  principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A person's "write again" for one door after a drift, a failed write or a wait: clears the door's hold and writes now (read first,
    pause-then-save when needed, read-back proof). `access.windows.manage` on the door and an explicit confirmation. Never writes over a
    program a person made in the intercom window (that stays `foreign`)."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.program_apply", dev_mode=_dev(request))
    dw.require_doors(conn, principal, [(station_id, relay)], dw.MANAGE, "door.window.program_apply")
    key = dw.door_key(station_id, relay)
    db, settings, now = request.app.state.db, settings_of(request), now_utc()

    def refuse(code: str, c: sqlite3.Connection) -> None:
        audit(c, actor=principal, action="door.window.program_apply", decision="denied", resource_type="door", resource_id=key, reason=code, request_id=_rid(request))
        raise ApiError(409, code, _APPLY_REFUSAL[code])

    if not dw.enabled(conn):
        refuse("windows_off", conn)
    if dwe.window_engine(settings).tier != "program":
        refuse("prepared", conn)
    commit_now(conn)  # the engine I/O below runs outside this request's write lock (the open-for pattern)
    if body.expect_sha is not None:
        current = dw.program_preview(db, settings, station_id, relay, now)["sha"] or ""
        if current != body.expect_sha:
            with db.connection() as wconn:
                audit(wconn, actor=principal, action="door.window.program_apply", decision="denied", resource_type="door", resource_id=key,
                      reason="preview_stale", request_id=_rid(request))
            raise ApiError(409, "preview_stale", _APPLY_REFUSAL["preview_stale"])
    result = dw.write_again(db, settings, station_id, relay, now, actor=f"user:{principal.user_id}")
    with db.connection() as wconn:
        audit(wconn, actor=principal, action="door.window.program_apply", decision="allowed" if result["outcome"] in ("written", "unchanged", "verified", "paused", "nothing") else "failed",
              resource_type="door", resource_id=key, reason=result["outcome"], request_id=_rid(request),
              details={"outcome": result["outcome"], "write_state": result["write"]["state"], "version": result["write"]["version"]})
    return {"result": result}


@router.get("/doors/windows/calendar")
def get_calendar(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    if not dw.visible_doors(conn, principal) and not authorize(conn, principal, dw.MANAGE, INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "אין הרשאה.")
    start = (now_utc() - dt.timedelta(days=1)).date()
    rows = conn.execute("SELECT on_date, scope_key, day_type, label FROM door_window_calendar WHERE on_date >= ? ORDER BY on_date", (start.isoformat(),)).fetchall()
    overrides = {r["on_date"]: dict(r) for r in rows if r["scope_key"] == "*"}
    # the holiday list (CR-039 5.4): the generated Israeli holidays and eves under the manager's overrides, for the next 400 days
    return {"days": [dict(r) for r in rows], "generator": special_days.generator_of(conn),
            "holidays": special_days.listing(conn, start, dw.HORIZON_DAYS, overrides)}


class CalendarDay(BaseModel):
    on_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    day_type: Literal["holiday", "holiday_eve", "regular", "closed", "none"]
    label: str = Field(default="", max_length=60)


class CalendarBody(BaseModel):
    days: list[CalendarDay] = Field(max_length=120)
    confirmed: Any = None


@router.put("/doors/windows/calendar")
def put_calendar(body: CalendarBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Installation-wide special days (`none` removes one). `access.windows.manage` at the installation (CR-039 10.4)."""
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.calendar", dev_mode=_dev(request))
    require(conn, principal, dw.MANAGE, INSTALLATION)
    at = dw.iso(now_utc())
    for d in body.days:
        try:
            dt.date.fromisoformat(d.on_date)
        except ValueError:
            raise ApiError(422, "invalid_date", "תאריך לא תקין.") from None
        if d.day_type == "none":
            conn.execute("DELETE FROM door_window_calendar WHERE on_date = ? AND scope_key = '*'", (d.on_date,))
        else:
            conn.execute("""INSERT INTO door_window_calendar(on_date, scope_key, day_type, label, set_by, set_at) VALUES (?, '*', ?, ?, ?, ?)
                            ON CONFLICT(on_date, scope_key) DO UPDATE SET day_type = excluded.day_type, label = excluded.label, set_by = excluded.set_by,
                            set_at = excluded.set_at""", (d.on_date, d.day_type, d.label.strip() or None, principal.user_id, at))
    audit(conn, actor=principal, action="door.window.calendar", decision="allowed", resource_type="door_window_calendar", request_id=_rid(request),
          details={"days": [[d.on_date, d.day_type] for d in body.days][:60]})
    _after_write(request, conn)
    return {"saved": len(body.days)}


@router.get("/doors/windows/settings")
def get_window_settings(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return {"settings": dw.settings_view(conn), "go_live_permitted": dwe.program_ready(), "program_engine_built": dwe.program_engine_built()}


class SettingsBody(BaseModel):
    changes: dict[str, str] = Field(max_length=20)
    confirmed: Any = None


@router.put("/doors/windows/settings")
def put_window_settings(body: SettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "settings.changed", dev_mode=_dev(request))
    changed = dw.update_settings(conn, body.changes)
    for key, (before, after) in changed.items():
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=key, request_id=_rid(request),
              details={"key": key, "before": before, "after": after})
    out = {"settings": dw.settings_view(conn), "changed": sorted(changed)}
    _after_write(request, conn)
    return out


class FlagsBody(BaseModel):
    exterior: bool
    confirmed: Any = None


@router.put("/doors/windows/doors/{station_id}/{relay}/flags")
def put_door_flags(body: FlagsBody, request: Request, station_id: str = Path(min_length=1, max_length=128), relay: int = Path(ge=1, le=64),
                   principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mark a door exterior (owner decision 2026-10-13: interior doors first). System administrator."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.window.door_flags", dev_mode=_dev(request))
    conn.execute("""INSERT INTO door_window_door_flags(station_id, relay, exterior, set_by, set_at) VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(station_id, relay) DO UPDATE SET exterior = excluded.exterior, set_by = excluded.set_by, set_at = excluded.set_at""",
                 (station_id, relay, 1 if body.exterior else 0, principal.user_id, dw.iso(now_utc())))
    audit(conn, actor=principal, action="door.window.door_flags", decision="allowed", resource_type="door", resource_id=dw.door_key(station_id, relay),
          request_id=_rid(request), details={"exterior": body.exterior})
    return {"door": dw.door_key(station_id, relay), "exterior": body.exterior}


# ================================================================ emergency

def _any(conn: sqlite3.Connection, principal: Principal, permission: str) -> bool:
    return permission in permissions_anywhere(conn, principal)


@router.get("/doors/emergency/state")
def emergency_state(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The visible state (CR-039 8.1): the active incident (the red strip) for everyone who sees doors, and - for the holders of an
    emergency permission - the switches, the scopes they may press in and the recent history."""
    perms = permissions_anywhere(conn, principal)
    if "access.read" not in perms and de.LOCK not in perms and de.OPEN not in perms and deg.GRANT not in perms:
        raise ApiError(403, "forbidden", "אין הרשאה.")
    settings = settings_of(request)
    can_lock, can_open = de.LOCK in perms, de.OPEN in perms
    lock_live = de.lock_available(settings, conn)  # DOORLIVE-2310: the LOCK control is hidden while no WisKey command exists for it
    active = de.active_incident(conn)
    drill = de.active_incident(conn, drill=True)
    out: dict[str, Any] = {
        "enabled": de.enabled(conn), "open_enabled": de.open_enabled(conn, settings), "hold_ms": int(de.setting(conn, de.HOLD_MS)),
        "home_widget": de.setting(conn, de.HOME_WIDGET) == "on",  # DOORWIN2-295: the optional home-screen entry (off by default)
        "can": {"lock": can_lock and lock_live, "open": can_open, "grant": deg.grant_basis(conn, principal) is not None},  # EMROLE-295: the holders panel
        "active": de.incident_view(conn, active, with_doors=can_lock or can_open) | {"can_release": authorize(conn, principal, de.PERMISSION[active["kind"]],
                                                                                                                de.scope_target(active["scope_type"], active["scope_id"])).allowed,
                                                              "can_retry_open": active["kind"] == "open" and not active["drill"] and de.retry_open_basis(conn, principal) is not None}
        if active is not None else None,
    }
    if active is not None:
        from ..services import door_engine_live

        out["active"]["verify_required"] = door_engine_live.verify_required(active["id"])  # DOORLIVE-2310: found active at start - verify against the access system
    if can_lock or can_open:
        out["scopes"] = {"lock_secure": de.scopes_for(conn, principal, "lock_secure") if can_lock and lock_live else [],
                         "open": de.scopes_for(conn, principal, "open") if can_open else []}
        out["drill"] = de.incident_view(conn, drill) if drill is not None and drill["requested_by"] == principal.user_id else None
        labels = dw.doors_by_key(conn)
        out["foreign_paused"] = [f | {"label": labels[f["door"]].label if f["door"] in labels else f["door"]} for f in dw.foreign_paused_list(conn)]
        out["recent"] = [de.incident_view(conn, r, with_doors=False) for r in conn.execute(
            "SELECT * FROM door_emergency_incidents ORDER BY requested_at DESC LIMIT 10").fetchall()]
    return out


class PrepareBody(BaseModel):
    action: Literal["start", "release"] = "start"
    kind: Literal["lock_secure", "open"]
    scope_type: Literal["installation", "site", "building"] = "installation"
    scope_id: str = Field(default="*", min_length=1, max_length=128)
    incident_id: str | None = Field(default=None, max_length=64)
    drill: bool = False


@router.post("/doors/emergency/prepare")
def emergency_prepare(body: PrepareBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return de.prepare(conn, settings_of(request), principal, action=body.action, kind=body.kind, scope_type=body.scope_type, scope_id=body.scope_id,
                      incident_id=body.incident_id, drill=body.drill, now=now_utc(), dev_mode=_dev(request))


class StartBody(BaseModel):
    confirm_token: str = Field(min_length=16, max_length=64)
    confirmed: Any = None
    reason: str = Field(default="", max_length=200)
    client_request_id: str = Field(min_length=8, max_length=64)


def _request_id(value: str) -> str:
    if not REQUEST_ID.match(value):
        raise ApiError(422, "invalid_request_id", "מזהה בקשה לא תקין.")
    return value


@router.post("/doors/emergency/incidents", status_code=201)
def emergency_start(body: StartBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    rid = _request_id(body.client_request_id)
    if conn.execute("SELECT id FROM door_emergency_incidents WHERE request_id = ?", (rid,)).fetchone():
        raise ApiError(409, "duplicate_request", "הבקשה כבר התקבלה.")
    settings = settings_of(request)
    try:
        iid = de.start(conn, settings, principal, token=body.confirm_token, confirmed=body.confirmed, reason=body.reason, client_request_id=rid, now=now_utc(),
                       dev_mode=_dev(request))
    except sqlite3.IntegrityError as exc:
        # E-05 (F3C): a duplicate client_request_id that raced the pre-check above hits the UNIQUE constraint (0137): answer 409, not 500
        if "request_id" not in str(exc):
            raise
        rollback_and_restart(conn)
        raise ApiError(409, "duplicate_request", "הבקשה כבר התקבלה.") from None
    commit_now(conn)
    db = request.app.state.db
    de.submit(db, settings, iid, "apply")
    de.pause_windows_for_lock(db, settings, iid)
    de.cancel_capture_leases(db, iid)  # CAPEMERGENCY-295 / CAPEMERGENCY2-295: OPEN or LOCK, after the door action is out; never raises
    with db.connection(mode="read") as rconn:
        return {"incident": de.incident_view(rconn, de.incident_row(rconn, iid))}


class ReleaseBody(BaseModel):
    confirm_token: str = Field(min_length=16, max_length=64)
    confirmed: Any = None
    client_request_id: str = Field(min_length=8, max_length=64)


@router.post("/doors/emergency/incidents/{incident_id}/release")
def emergency_release(body: ReleaseBody, request: Request, incident_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    rid = _request_id(body.client_request_id)
    settings = settings_of(request)
    released = de.release(conn, settings, principal, token=body.confirm_token, confirmed=body.confirmed, client_request_id=rid, now=now_utc(), dev_mode=_dev(request))
    if released != incident_id:
        raise ApiError(409, "confirmation_invalid", "האישור אינו תקף.")
    commit_now(conn)
    db = request.app.state.db
    de.submit(db, settings, incident_id, "release")
    with db.connection(mode="read") as rconn:
        return {"incident": de.incident_view(rconn, de.incident_row(rconn, incident_id))}


class RetryOpenBody(BaseModel):
    station_id: str = Field(min_length=1, max_length=128)
    relay: int = Field(ge=0, le=64)
    confirm_door: str = Field(min_length=1, max_length=120)


@router.post("/doors/emergency/incidents/{incident_id}/retry-open")
def emergency_retry_open(body: RetryOpenBody, request: Request, incident_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """WKOPENUNK-295: the explicit new OPEN attempt for ONE door whose OPEN ended UNKNOWN (system administrator, confirmation by the door's name, one at a time)."""
    settings = settings_of(request)
    de.retry_open(conn, settings, principal, incident_id=incident_id, station_id=body.station_id, relay=body.relay, confirm_door=body.confirm_door, now=now_utc(),
                  dev_mode=_dev(request))
    commit_now(conn)
    db = request.app.state.db
    de.submit(db, settings, incident_id, "apply")
    with db.connection(mode="read") as rconn:
        return {"incident": de.incident_view(rconn, de.incident_row(rconn, incident_id))}


class GrantBody(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    scope_type: Literal["installation", "site", "building", "access_control_station"] = "installation"
    scope_id: str = Field(default="*", min_length=1, max_length=200)
    expires_at: str | None = Field(default=None, max_length=40)
    no_expiry: bool = False
    confirmed: Any = None


class RevokeGrantBody(BaseModel):
    confirmed: Any = None


@router.get("/doors/emergency/grants")
def emergency_grants(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """EMROLE-295: who holds the emergency-open role, and the people / places a grant may name (system administrators and security managers)."""
    return deg.view(conn, principal)


@router.post("/doors/emergency/grants", status_code=201)
def emergency_grant(body: GrantBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """EMROLE-295: give the built-in emergency-open role to one person, with an expiry (default from the settings)."""
    _confirmed(body.confirmed)
    out = deg.grant(conn, request, principal, user_id=body.user_id, scope_type=body.scope_type, scope_id=body.scope_id, expires_at=body.expires_at, no_expiry=body.no_expiry,
                    now=now_utc(), dev_mode=_dev(request), remote=is_remote(request))
    return {"grant": out}


@router.post("/doors/emergency/grants/{binding_id}/revoke")
def emergency_grant_revoke(body: RevokeGrantBody, request: Request, binding_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _confirmed(body.confirmed)
    return deg.revoke(conn, settings_of(request), request, principal, binding_id, dev_mode=_dev(request))


@router.get("/doors/emergency/incidents/{incident_id}")
def emergency_incident(incident_id: str = Path(min_length=1, max_length=64), principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    perms = permissions_anywhere(conn, principal)
    if de.LOCK not in perms and de.OPEN not in perms:
        raise ApiError(403, "forbidden", "אין הרשאה.")
    row = de.incident_row(conn, incident_id)
    if row is None or (row["drill"] and row["requested_by"] != principal.user_id and not authorize(conn, principal, CONFIGURE, INSTALLATION).allowed):
        raise ApiError(404, "not_found", "לא נמצא.")
    return {"incident": de.incident_view(conn, row)}


@router.get("/doors/emergency/settings")
def get_emergency_settings(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    return {"settings": de.settings_view(conn, settings_of(request))}


class EmergencySettingsBody(SettingsBody):
    confirm_engine_off: Any = None  # SPLITSWITCH2-297: the explicit confirmation of turning the emergency-buttons switch off


@router.put("/doors/emergency/settings")
def put_emergency_settings(body: EmergencySettingsBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "settings.changed", dev_mode=_dev(request))
    try:
        changed = de.update_settings(conn, settings_of(request), body.changes, confirm_engine_off=body.confirm_engine_off is True)
    except ApiError as exc:
        audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="setting", reason=exc.code, request_id=_rid(request),
              details={"keys": sorted(body.changes)[:8]})
        raise
    for key, (before, after) in changed.items():
        audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="setting", resource_id=key, request_id=_rid(request),
              details={"key": key, "before": before, "after": after})
    return {"settings": de.settings_view(conn, settings_of(request)), "changed": sorted(changed)}


class AttestBody(BaseModel):
    version: int
    accepted: bool
    confirmed: Any = None


@router.post("/doors/emergency/attestation")
def post_attestation(body: AttestBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-039 8.9: the life-safety acknowledgement (read, then accepted), recorded by hash and version, audited with the person."""
    require(conn, principal, CONFIGURE, INSTALLATION)
    _confirmed(body.confirmed)
    dw.require_person(conn, principal, "door.emergency.attested", dev_mode=_dev(request))
    if body.accepted is not True:
        raise ApiError(422, "not_accepted", "יש לאשר את ההצהרה.")
    de.attest(conn, principal.user_id, body.version, now_utc())
    audit(conn, actor=principal, action="door.emergency.attested", decision="allowed", resource_type="door_emergency", request_id=_rid(request),
          details={"version": de.ATTESTATION_VERSION, "text_sha": de.ATTESTATION_SHA[:16]})
    return {"attested": True, "version": de.ATTESTATION_VERSION}
