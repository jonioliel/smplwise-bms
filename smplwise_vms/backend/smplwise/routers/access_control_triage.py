"""WISKEY-CONFLICTS-2400 (plan 2026-11-03 T5): resolve WisKey's sync conflicts and act on its fleet alerts from Arx - the conflicts screen
(#/wiskey/conflicts, #/wiskey/alerts), its section on the "מצב WisKey" page and the stations screen's link. The commands and their
meaning: services/wiskey_triage.py. The LISTS are the status page's existing reads (`GET /access-control/status/conflicts` and
`/status/alerts`, routers/access_control_reads.py); this module adds the page's own facts and the three steps that act.

Endpoints (the browser never names a WisKey command):

- `GET  /access-control/triage` - READ ONLY: whether this caller may resolve / act (the rule below), the notification feed's setting and
  whether this caller may change it, Arx's limits, and the newest outcome of each conflict / alert this installation acted on in the last
  7 days (from Arx's own audit rows). Gate: `access.admin.read` anywhere, or the manage rule (an audited 403 otherwise).
- `POST /access-control/stations/{station_id}/conflicts/{person_id}/review` - body `{kind: person | removal}`. WisKey's preview: it
  READS the station and answers the comparison, the plan and which resolutions it allows; nothing is written. The answer is kept (a
  review id, 10 minutes, single use, this operator only) and shown: the impact, never WisKey's token.
- `POST /access-control/triage/reviews/{review_id}/resolve` - body `{direction: central | device | delete, confirmed: true,
  client_request_id, expires_at}`. Sends the reviewed resolution once (`conflicts/resolve` / `conflicts/resolve_deletion`, WisKey's own
  stale check on the device record). `delete` only for a removal, `central` / `device` only for a person, and only what the review said
  WisKey allows.
- `POST /access-control/stations/{station_id}/alerts/{kind}/{action}` - `action` `snooze` | `restore`; body `{duration_minutes, reason,
  confirmed: true, client_request_id, expires_at}` (snooze: 15 | 60 | 240 | 1440 | 10080 minutes and a closed reason). A fresh
  `fleet/alerts` read first (WisKey's compare-and-set revision, and that the alert / the snooze is there), then `fleet/alerts_action` once.
- `PUT  /access-control/triage/settings` - body `{notify: bool}`: feed new WisKey fleet alerts into the notification centre (default
  OFF). `system.configure` at installation scope, audited (`settings.changed`).

The manage rule (owner brief T5): `access.stations.manage` UNRESTRICTED (allowed at the installation, no deny on any scope that can hold a
station) or `system.configure` at the installation - WisKey's conflicts and suppressions are installation-wide records. Checked before
the body is read (audited 403); the named station must also be visible (`access.read` on its chain, else the uniform 404).

Every acting step is refused and audited as `not_sent` before anything is sent when: the body is not JSON / malformed, the envelope is
expired or a duplicate, there is no confirmation (409), the review is missing / used / expired / another operator's, the direction is
not one WisKey allowed, the station is offline (a review or a resolution reads the device), the alert is not active / not snoozed, or
Arx's own limits say no (429 with `retry_after_s`). Then: the attempt row committed, the command sent ONCE, the outcome row. The reply
says honestly what is known: `acknowledged` (WisKey accepted the resolution and QUEUED the sync - the station follows through WisKey's
worker) / `completed` (the snooze is saved in WisKey); anything else is an HTTP error whose `details.outcome` is `not_sent`, `refused`
(WisKey answered a failure: `details.wiskey_code`) or `unknown` (sent, no clear answer). Nothing is retried or queued.

Audit rows: the real Arx actor, the request ids, the station (resource), the WisKey person id (never a name), the step, the direction /
alert kind, the outcome and WisKey's code."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Request
from pydantic import BaseModel, ConfigDict, StrictBool, StrictInt

from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, Principal, require
from ..services import intercom_authority as ia
from ..services import intercom_sync
from ..services import wiskey_triage as tr
from .access_control import MAX_STATION_ID, CommandEnvelope, _Action, _envelope, _parse, _raw_body, _station

router = APIRouter()
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
REVIEW_PATTERN = r"^rv_[A-Za-z0-9_-]{8,64}$"
CONFIGURE = "system.configure"
HISTORY_DAYS = 7
UNSETTLED_AFTER_S = 90

DIRECTION_TEXT = {
    "central": "החלת הרשומה המנוהלת על העמדה",
    "device": "עדכון הרשומה לפי העמדה",
    "delete": "המשך המחיקה מהעמדה",
}
ACTION_TEXT = {"snooze": "השתקת ההתראה", "restore": "ביטול ההשתקה"}


def may_manage(auth: ia.Authority) -> bool:
    """The manage rule: `access.stations.manage` unrestricted, or `system.configure` at the installation."""
    return auth.unrestricted(ia.STATIONS_MANAGE) or auth.installation(CONFIGURE).allowed


def _require_manage(conn: sqlite3.Connection, principal: Principal, request_id: str | None = None) -> ia.Authority:
    auth = ia.Authority(conn, principal)
    if may_manage(auth):
        return auth
    reason = "station_scoped" if auth.anywhere(ia.STATIONS_MANAGE) else auth.installation(ia.STATIONS_MANAGE).reason
    audit(conn, actor=principal, action=ia.STATIONS_MANAGE, decision="denied", resource_type="installation", resource_id="*", reason=reason, request_id=request_id)
    raise forbidden("פתרון התנגשויות וטיפול בהתראות של WisKey דורשים הרשאת ניהול עמדות בכל המערכת, או הרשאת מנהל מערכת.",
                    permission=ia.STATIONS_MANAGE, target_type="installation", target_id="*", reason=reason)


_manager_ro = read_gate(lambda conn, principal: _require_manage(conn, principal))


def _viewer(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    auth = ia.Authority(conn, principal)
    if auth.anywhere(ia.ADMIN_READ) or may_manage(auth):
        return auth
    return ia.require_anywhere(conn, principal, ia.ADMIN_READ, getattr(request.state, "correlation_id", None))  # raises the audited 403


def _not_found() -> ApiError:
    return ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


# ---------------------------------------------------------------- the page's facts

def _recent(conn: sqlite3.Connection) -> dict[str, Any]:
    """The newest outcome per conflict (`<station>:<person>`) and per alert (`<station>:<kind>`) in the last HISTORY_DAYS days, any actor:
    `status` sent (an attempt with no outcome row yet) | acknowledged | completed | failed (WisKey refused: `code`) | not_sent | unknown."""
    since = (datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = conn.execute(
        "SELECT at, action, resource_id, reason, details_json FROM audit_log WHERE at >= ? AND action IN (?, ?, ?) ORDER BY id DESC LIMIT 400",
        (since, tr.AUDIT_RESOLVE, tr.AUDIT_DELETION, tr.AUDIT_ALERT),
    ).fetchall()
    conflicts: dict[str, Any] = {}
    alerts: dict[str, Any] = {}
    now = datetime.now(timezone.utc)
    for r in rows:
        try:
            d = json.loads(r["details_json"] or "{}")
        except ValueError:
            continue
        alert = r["action"] == tr.AUDIT_ALERT
        key = f"{r['resource_id']}:{d.get('alert_kind') if alert else d.get('person_id')}"
        bucket = alerts if alert else conflicts
        if key in bucket:
            continue
        phase, outcome = d.get("phase"), d.get("outcome")
        success = "completed" if alert else "acknowledged"
        if phase == "attempt":
            try:
                age = (now - datetime.fromisoformat(str(r["at"]).replace("Z", "+00:00"))).total_seconds()
            except ValueError:
                age = 0
            status = "unknown" if age > UNSETTLED_AFTER_S else "sent"
        elif phase == "refused":
            status = "not_sent"
        elif outcome == "ok":
            status = success
        elif outcome == "refused":
            status = "failed"
        else:
            status = outcome if outcome in ("not_sent", "unknown") else "unknown"
        bucket[key] = {"status": status, "at": r["at"], "code": r["reason"] if status not in ("sent", success) else None,
                       "direction": d.get("direction"), "action": d.get("alert_action")}
    return {"conflicts": conflicts, "alerts": alerts}


@router.get("/access-control/triage")
def triage_view(auth: ia.Authority = Depends(_viewer)) -> dict[str, Any]:
    conn = auth.conn
    manage = may_manage(auth)
    return {
        "may_resolve": manage,
        "may_act_alerts": manage,
        "feed": intercom_sync.STATE.state,
        "notify": {"enabled": tr.notify_enabled(conn), "can_edit": auth.installation(CONFIGURE).allowed, "last": tr.FEED.last},
        "review_ttl_s": tr.REVIEW_TTL_S,
        "durations": list(tr.DURATIONS),
        "reasons": list(tr.REASONS),
        "recent": _recent(conn) if manage or auth.unrestricted(ia.ADMIN_READ) else None,
    }


class NotifyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notify: StrictBool


@router.put("/access-control/triage/settings")
def triage_settings(body: NotifyBody, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    before = tr.notify_enabled(conn)
    set_setting(conn, tr.NOTIFY_KEY, "true" if body.notify else "false")
    audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"key": tr.NOTIFY_KEY, "before": before, "after": body.notify})
    return {"notify": {"enabled": body.notify, "can_edit": True, "last": tr.FEED.last}}


# ---------------------------------------------------------------- shared steps

def _limited(act: _Action, cls: str, target: str) -> None:
    limited = tr.LIMITS.admit(act.principal.user_id, cls, target)
    if limited is None:
        return
    code, retry = limited
    message = {
        "triage_cooldown": f"הפעולה הזו נשלחה לפני רגע. אפשר לנסות שוב בעוד {int(retry + 0.999)} שניות.",
        "triage_rate_limited": "נשלחו יותר מדי בקשות בזמן קצר. הבקשה לא נשלחה - נסו שוב בעוד דקה.",
        "triage_busy": "בקשה אחרת עדיין רצה. הבקשה לא נשלחה - נסו שוב בעוד רגע.",
    }[code]
    raise act.refuse(ApiError(429, code, message, retryable=True, details={"retry_after_s": retry}))


def _error(what: str, exc: ApiError, stale_hint: bool = False) -> ApiError:
    details = dict(exc.details or {})
    outcome = str(details.get("outcome") or "unknown")
    code = str(details.get("wiskey_code") or exc.code)
    if outcome == "not_sent":
        return ApiError(exc.status, exc.code, f"{what}: {exc.user_message}", retryable=exc.retryable, details=details)
    if outcome == "refused":
        if code in ("review_stale", "revision_conflict") and stale_hint:
            return ApiError(409, "triage_stale", f"{what} לא בוצע: הרשומה בעמדה או ב־WisKey השתנתה מאז הבדיקה ({code}). בדקו שוב לפני שמחליטים.", details=details)
        return ApiError(502, "triage_failed", f"{what} נדחה על ידי WisKey ({code}). לפי WisKey דבר לא השתנה.", details=details)
    return ApiError(504, "triage_outcome_unknown", f"{what} נשלח, אך לא התקבלה תשובה ברורה ({code}). ייתכן שבוצע - בדקו את הרשימה לפני שמנסים שוב.", details=details)


def _run(act: _Action, cls: str, target: str, key: str, send: Any, project: Any, not_after: datetime | None, stale_hint: bool, what: str) -> dict[str, Any]:
    """The attempt row (committed), the command sent once on the triage channel, the outcome row."""
    act.attempt()
    try:
        reply = intercom_sync.SYNC.action(settings_of(act.request), key, send, project, who=act.principal.user_id, not_after=not_after, lane=tr.LANE,
                                          channel=tr.CHANNEL)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        code = str(exc.details.get("wiskey_code") or exc.code)
        if outcome != "not_sent":
            tr.LIMITS.sent(cls, target)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        raise _error(what, exc, stale_hint) from None
    except BaseException as exc:
        tr.LIMITS.sent(cls, target)
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        raise
    finally:
        act.conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
    tr.LIMITS.sent(cls, target)
    return reply


# ---------------------------------------------------------------- the review (WisKey's preview)

class ReviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["person", "removal"]


def _person_view(auth: ia.Authority, station_id: str, impact: dict[str, Any]) -> dict[str, Any]:
    """The impact as this caller may see it: the names (WisKey's and the device's) only under the people rules on that station."""
    names = auth.person_level([station_id]) != ia.NONE
    out = {k: v for k, v in impact.items() if not k.startswith("_")}
    for side in ("central", "device"):
        if isinstance(out.get(side), dict) and not names:
            out[side] = {**out[side], "display_name": None}
    out["names_hidden"] = not names
    return out


@router.post("/access-control/stations/{station_id}/conflicts/{person_id}/review")
def review(request: Request, station_id: str, person_id: str, principal: Principal = Depends(_manager_ro), raw: bytes = Depends(_raw_body),
           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    act = _Action(request, conn, principal, tr.AUDIT_REVIEW, station_id)
    act.details["person_id"] = person_id[:128]
    body: ReviewBody = _parse(act, ReviewBody, raw)
    act.details["kind"] = body.kind
    if not _valid(person_id):
        raise act.refuse(ApiError(422, "validation", "מזהה האדם אינו תקין.", details={"fields": ["person_id"]}))
    auth = ia.Authority(conn, principal)
    if not auth.station(ia.READ, station_id):
        raise act.refuse(_not_found())
    _station(act, require_online=True)
    target = f"{station_id}:{person_id}"
    _limited(act, "review", target)
    try:
        reply = _run(act, "review", target, "review", lambda call: tr.send_review(call, station_id, person_id), tr.project_review, None, False, "בדיקת ההתנגשות")
    finally:
        tr.LIMITS.done("review")
    impact = reply["review"]
    token = impact.pop("_token")
    if impact.get("station_id") not in (None, station_id) or impact.get("user_id") not in (None, person_id):
        act.outcome("unknown", "review_mismatch", {"error": "review_mismatch"})
        raise ApiError(502, "triage_review_mismatch", "WisKey ענה על בדיקה של עמדה או אדם אחרים. דבר לא נשמר - נסו שוב.")
    db = request.app.state.db
    with db.write_aside() as w:
        stored = tr.store_review(w, actor=principal.user_id, kind=body.kind, station_id=station_id, person_id=person_id, revision=impact.get("revision"),
                                 token=token, impact=impact)
    act.outcome("ok", None, {"review_id": stored["id"], "differences": impact.get("differences"), "allowed": [k for k, v in impact["actions"].items() if v["allowed"]]})
    return {"review_id": stored["id"], "expires_at": stored["expires_at"], "kind": body.kind, "station_id": station_id, "person_id": person_id,
            "impact": _person_view(auth, station_id, impact)}


def _valid(value: str) -> bool:
    import re

    return bool(re.fullmatch(ID_PATTERN, value))


# ---------------------------------------------------------------- the resolution

class ResolveBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    direction: Literal["central", "device", "delete"]
    confirmed: Any = None


@router.post("/access-control/triage/reviews/{review_id}/resolve")
def resolve(request: Request, review_id: str, principal: Principal = Depends(_manager_ro), raw: bytes = Depends(_raw_body),
            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    import re

    row = tr.load_review(conn, review_id) if re.fullmatch(REVIEW_PATTERN, review_id) else None
    station_id = row["station_id"] if row is not None and row["actor_user_id"] == principal.user_id else "*"
    act = _Action(request, conn, principal, tr.AUDIT_RESOLVE, station_id)
    act.details["review_id"] = review_id[:80]
    body: ResolveBody = _parse(act, ResolveBody, raw)
    act.details["direction"] = body.direction
    if body.direction == "delete":
        act.action = tr.AUDIT_DELETION
    not_after = _envelope(act, body)
    problem = tr.review_problem(row, principal.user_id)
    if problem is not None:
        status, text = {"review_not_found": (404, "הבדיקה לא נמצאה. פתחו את ההתנגשות ובדקו אותה שוב."),
                        "review_used": (409, "הבדיקה הזו כבר שימשה להחלטה. כדי להחליט שוב - בדקו שוב."),
                        "review_expired": (409, "הבדיקה ישנה מדי (יותר מעשר דקות). בדקו שוב לפני שמחליטים.")}[problem]
        raise act.refuse(ApiError(status, problem, text))
    assert row is not None
    person_id, kind = str(row["person_id"]), str(row["kind"])
    act.details["person_id"] = person_id
    impact = json.loads(row["impact_json"])
    auth = ia.Authority(conn, principal)
    if not auth.station(ia.READ, station_id):
        raise act.refuse(_not_found())
    if (kind == "removal") != (body.direction == "delete"):
        raise act.refuse(ApiError(422, "resolution_kind_mismatch", "הפעולה אינה מתאימה לסוג ההתנגשות.", details={"kind": kind}))
    allowed = (impact.get("actions") or {}).get(body.direction) or {}
    if allowed.get("allowed") is not True:
        raise act.refuse(ApiError(409, "resolution_not_allowed", f"WisKey לא מאפשר את הפעולה הזו כרגע ({allowed.get('reason') or 'unknown'}).",
                                  details={"wiskey_reason": allowed.get("reason")}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "פתרון התנגשות דורש אישור מפורש אחרי הצגת ההשפעה.", details={"direction": body.direction}))
    _station(act, require_online=True)
    if body.direction != "delete" and not isinstance(row["revision"], int):
        raise act.refuse(ApiError(409, "review_incomplete", "WisKey לא החזיר גרסה של הרשומה בבדיקה. בדקו שוב."))
    target = f"{station_id}:{person_id}"
    _limited(act, "write", target)
    try:
        if not tr.consume_review(conn, review_id, body.direction):
            raise act.refuse(ApiError(409, "review_used", "הבדיקה הזו כבר שימשה להחלטה. כדי להחליט שוב - בדקו שוב."))
        token = str(row["review_token"])
        what = DIRECTION_TEXT[body.direction]
        if body.direction == "delete":
            send = lambda call: tr.send_resolve_deletion(call, station_id, person_id, token)  # noqa: E731
            project = tr.project_accepted
        else:
            revision = int(row["revision"])
            send = lambda call: tr.send_resolve(call, station_id, person_id, token, revision, body.direction)  # noqa: E731
            project = tr.project_resolved
        try:
            reply = _run(act, "write", target, "resolution", send, project, not_after, True, what)
        except ApiError as exc:
            _settle(request, review_id, str(exc.details.get("outcome") or "unknown"))
            raise
    finally:
        tr.LIMITS.done("write")
    _settle(request, review_id, "ok")
    data = reply["resolution"]
    act.outcome("ok", None, {"result": {"revision": data.get("revision")} if body.direction != "delete" else {"accepted": True}})
    return {
        "review_id": review_id,
        "station_id": station_id,
        "person_id": person_id,
        "direction": body.direction,
        "status": "acknowledged",
        "command_id": act.details["command_id"],
        "at": reply.get("fetched_at"),
        "data": data,
        "affected_stations": impact.get("affected_stations") or [],
    }


def _settle(request: Request, review_id: str, outcome: str) -> None:
    try:
        with request.app.state.db.write_aside() as w:
            tr.settle_review(w, review_id, outcome if outcome in ("ok", "refused", "unknown", "not_sent") else "unknown")
    except Exception:  # noqa: BLE001 - the audit rows carry the outcome; the review row is bookkeeping
        pass


# ---------------------------------------------------------------- fleet alerts: snooze / restore

class AlertBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    duration_minutes: StrictInt | None = None
    reason: Literal["planned_maintenance", "network_work", "investigating"] | None = None
    confirmed: Any = None


@router.post("/access-control/stations/{station_id}/alerts/{kind}/{action}")
def alert_action(request: Request, station_id: str, kind: str, action: str, principal: Principal = Depends(_manager_ro), raw: bytes = Depends(_raw_body),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if action not in tr.ALERT_ACTIONS or kind not in tr.SUPPRESS_KINDS:
        raise ApiError(404, "not_found", "אין פעולה כזו על התראה.")
    act = _Action(request, conn, principal, tr.AUDIT_ALERT, station_id)
    act.details.update(alert_kind=kind, alert_action=action)
    body: AlertBody = _parse(act, AlertBody, raw)
    not_after = _envelope(act, body)
    if action == "snooze" and (body.duration_minutes not in tr.DURATIONS or body.reason is None):
        raise act.refuse(ApiError(422, "validation", "השתקה דורשת משך (15 דקות עד שבוע) וסיבה.", details={"fields": ["duration_minutes", "reason"]}))
    auth = ia.Authority(conn, principal)
    if not auth.station(ia.READ, station_id):
        raise act.refuse(_not_found())
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "פעולה על התראה דורשת אישור מפורש.", details={"action": action}))
    _station(act, require_online=False)
    target = f"{station_id}:{kind}"
    _limited(act, "write", target)
    try:
        page = _fresh_alerts(act)
        mine = [i for i in page.get("items") or [] if i.get("station_id") == station_id]
        if action == "snooze" and kind != "maintenance" and not any(i.get("kind") == kind and not i.get("suppressed") for i in mine):
            raise act.refuse(ApiError(409, "alert_not_active", "ההתראה כבר לא פעילה או שכבר הושתקה. הרשימה רועננה.", details={"alert_kind": kind}))
        if action == "restore" and not any((i.get("suppression") or {}).get("kind") == kind for i in mine):
            raise act.refuse(ApiError(409, "alert_not_snoozed", "אין השתקה כזו פעילה כרגע. הרשימה רועננה.", details={"alert_kind": kind}))
        revision = page.get("revision")
        if not isinstance(revision, int):
            raise act.refuse(ApiError(503, "alert_revision_missing", "WisKey לא החזיר גרסה של רשימת ההתראות, ולכן הפעולה לא נשלחה."))
        duration = body.duration_minutes if action == "snooze" else 60
        reason = body.reason if action == "snooze" else "investigating"  # WisKey requires both fields on every frame and ignores them on restore
        act.details.update(duration_minutes=duration if action == "snooze" else None, reason=reason if action == "snooze" else None)
        reply = _run(act, "write", target, "alert_action", lambda call: tr.send_alert_action(call, revision, station_id, kind, action, int(duration or 60), str(reason)),
                     tr.project_alert_action, not_after, True, ACTION_TEXT[action])
    finally:
        tr.LIMITS.done("write")
    act.outcome("ok", None, {"result": reply["alert_action"]})
    return {"station_id": station_id, "kind": kind, "action": action, "status": "completed", "command_id": act.details["command_id"], "at": reply.get("fetched_at"),
            "data": reply["alert_action"]}


def _fresh_alerts(act: _Action) -> dict[str, Any]:
    """WisKey's fleet alerts read now (the READ channel; not the served cache): the compare-and-set revision and this alert's state."""
    try:
        reply = intercom_sync.SYNC.command(settings_of(act.request), "alerts", lambda call: tr.ad.fleet_alerts(call, "", True), tr.project_alert_page,
                                           who=act.principal.user_id, channel="read")
    except ApiError as exc:
        raise act.refuse(ApiError(exc.status, exc.code, f"רשימת ההתראות לא נקראה, ולכן הפעולה לא נשלחה: {exc.user_message}", retryable=exc.retryable)) from None
    if reply.get("state") != "ready" or reply.get("alerts") is None:
        raise act.refuse(ApiError(503, "intercom_unavailable", "רשימת ההתראות של WisKey אינה זמינה כרגע, ולכן הפעולה לא נשלחה.",
                                  details={"state": reply.get("state"), "wiskey_code": reply.get("last_error")}))
    return reply["alerts"]


__all__ = ["router", "may_manage", "MAX_STATION_ID"]
