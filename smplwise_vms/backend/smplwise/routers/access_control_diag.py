"""WISKEY-ACCESS-DIAG-2400 (plan 2026-11-03 T10): the "אבחון הרשאות" views - typed endpoints over WisKey's access diagnostics. The
commands and the projections: services/wiskey_access_diag.py. The browser never names a WisKey command.

Permissions (one rule for every view, decided server-side; the screen only shapes itself from `GET /access-control/diag`):
- every endpoint: `access.read` at INSTALLATION scope, unrestricted (no deny at a site / building / station) - WisKey answers these
  installation-wide, so a caller restricted to some stations is refused (audited 403 `station_scoped`), never served a filtered guess;
- a view that names people (scenario, compare, reviews, quality, lifecycle, permission audit) also needs `access.people.read`
  unrestricted (the projection filter's people rule, services/intercom_authority.py: these answers cannot be cut per station). The
  employee number follows the administrator's `access.employee_no_sensitive` (with `access.people.sensitive` it is always shown); the list
  of people without any credential needs `access.people.sensitive` unrestricted (credential kinds are sensitive). Never a PIN, a card
  number or its digits, a phone number;
- the review DECISION (the only write): `access.people.manage` somewhere at the gate (audited 403 before the body is read), then on the
  door's station; and WisKey must list `users/access_review_decide` for the add-on's identity. Otherwise the reviews are view only and the
  screen offers the deep link into the intercom panel.

Endpoints:
- `GET  /access-control/diag` - the views WisKey offers (`features`), what this caller may do (`can`), the doors (stations from the served
  copy with their door 1 / 2) and the display zone. No WisKey call.
- `GET  /access-control/diag/options?kind=person|group&query=&offset=&limit=` - the people / group pickers.
- `GET  /access-control/diag/scenario?user_id=&station_id=&lock_id=&at=` - "can X open door Y now" (`at` optional: now). WisKey's answer
  (allowed + reason: archived / inactive / no assignment / door not assigned / outside validity / outside schedule), where the grant
  comes from (group / personal allow / deny / direct), the sync evidence, the station's online state. `physical_result: not_verified`.
- `GET  /access-control/diag/compare?left_kind=&left_id=&right_kind=&right_id=` - two people or two groups, per door.
- `GET  /access-control/diag/compare-doors?left=<station>:<door>&right=<station>:<door>` - who is granted at one door, the other, both.
- `GET  /access-control/diag/reviews?station_id=&lock_id=&state=&offset=&limit=&snapshot=` - one door's periodic review list.
- `GET  /access-control/diag/reviews/preview?user_id=&station_id=&lock_id=` - one person at one door (what a decision carries back).
- `POST /access-control/diag/reviews/decide` - the decision: `{user_id, station_id, lock_id, person_revision, fingerprint, latest_id,
  decision: keep|followup, reason, cadence_days, confirmed: true, client_request_id, expires_at}`. Refused and audited `not_sent` before
  anything is sent: a malformed body, an expired / duplicate envelope, no confirmation (409), no permission on the station (403), WisKey not
  offering it (409 `diag_decide_unsupported`). Then the attempt row (committed), ONE send, the outcome row, and on success Arx's own
  record of who decided (table wiskey_access_review_decisions). Never retried. WisKey's `access_review_stale` -> 409 (reload and look again).
- `GET  /access-control/diag/quality?kind=&state=&offset=&limit=&snapshot=` - data quality.
- `GET  /access-control/diag/lifecycle?days=N` - who loses access in the next N days (1..365), temporary access, duplicates.
- `GET  /access-control/diag/sync` - sync diagnostics under `diagnostics` (stations as WisKey's pseudonymous references; `sync` is the feed's own key).
- `GET  /access-control/diag/stations/{id}/permission-audit` - one station's device users vs WisKey's (device READ only, 0 writes; one
  per station at a time, not again within 20 s; audited `intercom.permission_audit` with the counts).

Reply shape of the reads: `{state, last_error, fetched_at, <key>}`; `<key>` is null unless `state` is `ready`; `state` `unsupported` =
this WisKey does not list the command (nothing was sent)."""
from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import ConfigDict, Field, StrictInt, StrictStr

from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError, forbidden
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import intercom_sync
from ..services import wiskey_access_diag as diag
from ._common import raw_body as _raw_body, rid as _rid
from .access_control import CommandEnvelope, _Action, _envelope, _parse

router = APIRouter()
API = "/access-control/diag"
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
ID = re.compile(ID_PATTERN)
DOOR = re.compile(r"^([A-Za-z0-9][A-Za-z0-9_.:-]{0,127}):([12])$")
DECIDE_ACTION = "intercom.access_review_decide"
AUDIT_ACTION = "intercom.permission_audit"


def _refuse(auth: ia.Authority, permission: str, request_id: str | None) -> ApiError:
    """The audited 403 of a permission the caller does not hold unrestricted: `station_scoped` when they hold it somewhere only."""
    reason = "station_scoped" if auth.anywhere(permission) else "no_binding"
    audit(auth.conn, actor=auth.principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason=reason, request_id=request_id)
    return forbidden(permission=permission, target_type="installation", target_id="*", reason=reason)


def _need(auth: ia.Authority, permission: str, request: Request) -> None:
    if not auth.unrestricted(permission):
        raise _refuse(auth, permission, _rid(request))


def _gate(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    """`access.read` at installation scope, unrestricted - before any parameter is looked at."""
    auth = ia.Authority(conn, principal)
    _need(auth, ia.READ, request)
    return auth


def _people_gate(request: Request, auth: ia.Authority = Depends(_gate)) -> ia.Authority:
    _need(auth, ia.PEOPLE_READ, request)
    return auth


def _employee_no(auth: ia.Authority) -> bool:
    return auth.unrestricted(ia.PEOPLE_SENSITIVE) or not auth.policy(ia.EMPLOYEE_NO_SENSITIVE)


# ---------------------------------------------------------------- the served copy

def _api(request: Request) -> dict[str, Any] | None:
    return intercom_sync.SYNC.api_facts(settings_of(request))


def _require_feature(request: Request, feature: str) -> None:
    available, reason = diag.feature_state(_api(request), feature)
    if available is False:
        raise ApiError(409, "diag_unsupported", "התכונה אינה זמינה במערכת בקרת הכניסה המותקנת.", details={"feature": feature, "reason": reason})


def _doors(request: Request) -> tuple[list[dict[str, Any]] | None, Any]:
    """The stations of the served copy with the doors WisKey's diagnostics know (1 and 2). A station whose relays the copy does not list
    offers door 1 (WisKey's group policy always means door 1)."""
    sup = intercom_sync.SYNC.stations_superset(settings_of(request))
    if sup["stations"] is None:
        return None, sup.get("default_zone")
    out = []
    for s in sup["stations"]:
        locks = [lock for lock in s.get("locks") or [] if lock.get("physical_index") in (1, 2)]
        doors = [{"lock_id": lock["physical_index"], "name": lock.get("name")} for lock in locks] or [{"lock_id": 1, "name": None}]
        out.append({"id": s["id"], "name": s["name"], "online": bool(s.get("online")), "zone": s.get("zone"), "doors": sorted(doors, key=lambda d: d["lock_id"])})
    out.sort(key=lambda s: (s["name"].casefold(), s["id"]))
    return out, sup.get("default_zone")


def _station_known(request: Request, station_id: str) -> dict[str, Any] | None:
    doors, _zone = _doors(request)
    if doors is None:
        return None
    found = next((s for s in doors if s["id"] == station_id), None)
    if found is None:
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")
    return found


def _read(request: Request, auth: ia.Authority, key: str, send: Any, project: Any, *, timeout: float | None = None) -> dict[str, Any]:
    reply = intercom_sync.SYNC.command(settings_of(request), key, send, project, who=auth.principal.user_id, channel=diag.CHANNEL, timeout=timeout)
    return {"state": reply.get("state"), "last_error": reply.get("last_error"), "fetched_at": reply.get("fetched_at"), key: reply.get(key)}


def _at(value: str | None) -> str:
    if value is None or value == "":
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00")) if len(value) <= 48 else None
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", "at חייב להיות זמן ISO עם אזור זמן.", details={"fields": ["at"]})
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


# ---------------------------------------------------------------- the bootstrap

@router.get(API)
def diag_home(request: Request, auth: ia.Authority = Depends(_gate)) -> dict[str, Any]:
    """The views the installed WisKey offers, what this caller may do there, and the doors to pick from. No WisKey call."""
    api = _api(request)
    features = {name: dict(zip(("available", "reason"), diag.feature_state(api, name))) for name in diag.FEATURES}
    doors, zone = _doors(request)
    people = auth.unrestricted(ia.PEOPLE_READ)
    return {
        "feed": intercom_sync.STATE.state,
        "features": features,
        "can": {
            "people": people,
            "decide": people and auth.anywhere(ia.PEOPLE_MANAGE),
            "sensitive": auth.unrestricted(ia.PEOPLE_SENSITIVE),
            "employee_no": people and _employee_no(auth),
        },
        "doors": doors,
        "default_zone": zone,
    }


# ---------------------------------------------------------------- pickers, scenario, compare

@router.get(f"{API}/options")
def diag_options(request: Request, auth: ia.Authority = Depends(_people_gate), kind: Literal["person", "group"] = "person",
                 query: str = Query("", max_length=128), offset: int = Query(0, ge=0, le=100_000), limit: int = Query(25, ge=1, le=100)) -> dict[str, Any]:
    _require_feature(request, "pickers")
    if any(ord(c) < 32 for c in query):
        raise ApiError(422, "validation", "החיפוש אינו תקין.", details={"fields": ["query"]})
    return _read(request, auth, "options", lambda call: diag.options(call, kind, query.strip(), offset, limit), diag.project_options)


@router.get(f"{API}/scenario")
def diag_scenario(request: Request, auth: ia.Authority = Depends(_people_gate), user_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN),
                  station_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN), lock_id: int = Query(1, ge=1, le=2),
                  at: str | None = Query(None, max_length=48)) -> dict[str, Any]:
    _require_feature(request, "scenario")
    instant = _at(at)
    station = _station_known(request, station_id)
    out = _read(request, auth, "scenario", lambda call: diag.scenario_with_source(call, user_id, station_id, lock_id, instant), diag.project_scenario_pair)
    door = next((d for d in (station or {}).get("doors") or [] if d["lock_id"] == lock_id), None)
    out["station"] = None if station is None else {"id": station["id"], "name": station["name"], "online": station["online"], "door_name": (door or {}).get("name")}
    return out


@router.get(f"{API}/compare")
def diag_compare(request: Request, auth: ia.Authority = Depends(_people_gate), left_kind: Literal["person", "group"] = "person",
                 left_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN), right_kind: Literal["person", "group"] = "person",
                 right_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN)) -> dict[str, Any]:
    _require_feature(request, "compare")
    if left_kind != right_kind:
        raise ApiError(422, "validation", "משווים שני אנשים או שתי קבוצות.", details={"fields": ["left_kind", "right_kind"]})
    return _read(request, auth, "compare", lambda call: diag.compare(call, left_kind, left_id, right_kind, right_id), diag.project_compare)


def _door(name: str, value: str) -> tuple[str, int]:
    m = DOOR.fullmatch(value)
    if not m:
        raise ApiError(422, "validation", "דלת חייבת להיות <עמדה>:<1 או 2>.", details={"fields": [name]})
    return m.group(1), int(m.group(2))


@router.get(f"{API}/compare-doors")
def diag_compare_doors(request: Request, auth: ia.Authority = Depends(_people_gate), left: str = Query(min_length=3, max_length=131),
                       right: str = Query(min_length=3, max_length=131)) -> dict[str, Any]:
    _require_feature(request, "compare_doors")
    a, b = _door("left", left), _door("right", right)
    if a == b:
        raise ApiError(422, "validation", "בחרו שתי דלתות שונות.", details={"fields": ["left", "right"]})
    _station_known(request, a[0])
    _station_known(request, b[0])
    return _read(request, auth, "doors", lambda call: diag.compare_doors(call, a, b), diag.project_door_compare)


# ---------------------------------------------------------------- reviews

def _arx_actors(conn: sqlite3.Connection, receipts: list[dict[str, Any]]) -> None:
    """Who in Arx took each decision the page shows (WisKey's own receipt names only the add-on's identity)."""
    ids = [r["id"] for r in receipts if r]
    if not ids:
        return
    marks = ",".join("?" for _ in ids)
    found = {row["receipt_id"]: row["actor_name"] or row["actor_user_id"] for row in conn.execute(
        f"SELECT receipt_id, actor_user_id, actor_name FROM wiskey_access_review_decisions WHERE receipt_id IN ({marks})", ids).fetchall()}
    for r in receipts:
        if r:
            r["arx_actor"] = found.get(r["id"])


@router.get(f"{API}/reviews")
def diag_reviews(request: Request, auth: ia.Authority = Depends(_people_gate), station_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN),
                 lock_id: int = Query(1, ge=1, le=2), state: Literal["all", "pending", "due", "stale", "completed", "followup", "archived"] = "all",
                 offset: int = Query(0, ge=0, le=100_000), limit: int = Query(50, ge=1, le=100), snapshot: str = Query("", max_length=64, pattern=r"^[a-f0-9]*$")) -> dict[str, Any]:
    _require_feature(request, "reviews")
    _station_known(request, station_id)
    out = _read(request, auth, "reviews", lambda call: diag.reviews(call, station_id, lock_id, state=state, offset=offset, limit=limit, snapshot=snapshot), diag.project_reviews)
    page = out.get("reviews")
    if page:
        _arx_actors(auth.conn, [r["latest"] for r in page["records"]])
    return out


@router.get(f"{API}/reviews/preview")
def diag_review_preview(request: Request, auth: ia.Authority = Depends(_people_gate), user_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN),
                        station_id: str = Query(min_length=1, max_length=128, pattern=ID_PATTERN), lock_id: int = Query(1, ge=1, le=2)) -> dict[str, Any]:
    _require_feature(request, "reviews")
    _station_known(request, station_id)
    out = _read(request, auth, "preview", lambda call: diag.review_preview(call, user_id, station_id, lock_id), diag.project_preview)
    preview = out.get("preview")
    if preview:
        _arx_actors(auth.conn, preview["history"])
    available, reason = diag.feature_state(_api(request), "review_decide")
    out["decide"] = {"available": available, "reason": reason, "allowed": auth.station(ia.PEOPLE_MANAGE, station_id)}
    return out


class DecideBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    user_id: StrictStr = Field(min_length=1, max_length=128, pattern=ID_PATTERN)
    station_id: StrictStr = Field(min_length=1, max_length=128, pattern=ID_PATTERN)
    lock_id: StrictInt = Field(ge=1, le=2)
    person_revision: StrictInt = Field(ge=0)
    fingerprint: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    latest_id: StrictStr = Field(max_length=32, pattern=r"^(?:[a-f0-9]{32})?$")
    decision: Literal["keep", "followup"]
    reason: StrictStr = Field(min_length=1, max_length=500)
    cadence_days: StrictInt = Field(ge=1, le=365)
    confirmed: Any = None  # only `true` (the confirmation step) confirms


_decider_ro = read_gate(lambda conn, principal: ia.require_anywhere(conn, principal, ia.PEOPLE_MANAGE))

STALE = "access_review_stale"
WISKEY_REFUSALS = {
    STALE: (409, "diag_review_stale", "הנתונים של האדם או של ההחלטה הקודמת השתנו מאז שנפתחה הסקירה. ההחלטה לא נשמרה - טענו מחדש ובדקו שוב."),
    "unauthorized": (403, "diag_decide_not_allowed", "מערכת בקרת הכניסה אינה מתירה לזהות של המערכת לרשום החלטת סקירה. אפשר לרשום אותה בחלון האינטרקום."),
    "field_access_denied": (403, "diag_decide_not_allowed", "מערכת בקרת הכניסה אינה מתירה לזהות של המערכת לרשום החלטת סקירה. אפשר לרשום אותה בחלון האינטרקום."),
    "access_review_limit": (409, "diag_review_limit", "מערכת בקרת הכניסה הגיעה למספר הקבלות המרבי. ההחלטה לא נשמרה."),
    "access_reviews_unavailable": (503, "diag_reviews_unavailable", "שירות הסקירות של מערכת בקרת הכניסה אינו זמין כרגע. ההחלטה לא נשמרה."),
    "station_not_found": (404, "intercom_station_not_found", "העמדה לא נמצאה."),
    "user_not_found": (404, "intercom_person_not_found", "האדם לא נמצא."),
}


@router.post(f"{API}/reviews/decide")
def diag_review_decide(request: Request, principal: Principal = Depends(_decider_ro), raw: bytes = Depends(_raw_body),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    act = _Action(request, conn, principal, DECIDE_ACTION, "-", resource_type="intercom_person")
    body: DecideBody = _parse(act, DecideBody, raw)
    act.resource_id = body.user_id
    act.details.update(station_id=body.station_id, lock_id=body.lock_id, decision=body.decision, cadence_days=body.cadence_days)
    not_after = _envelope(act, body)
    auth = ia.Authority(conn, principal)
    if not auth.unrestricted(ia.READ) or not auth.unrestricted(ia.PEOPLE_READ):
        raise act.refuse(ApiError(403, "forbidden", "אבחון ההרשאות דורש צפייה בבקרת הכניסה ובאנשים בכל ההתקנה.", details={"permission": ia.PEOPLE_READ}))
    if not auth.station(ia.PEOPLE_MANAGE, body.station_id):
        raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לנהל אנשים בעמדה הזו.", details={"permission": ia.PEOPLE_MANAGE}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "החלטת סקירה דורשת אישור מפורש."))
    reason = " ".join(body.reason.split())
    if not reason or any(ord(c) < 32 for c in reason):
        raise act.refuse(ApiError(422, "validation", "יש לכתוב סיבה (שורה אחת, עד 500 תווים).", details={"fields": ["reason"]}))
    available, why = diag.feature_state(_api(request), "review_decide")
    if available is not True:
        raise act.refuse(ApiError(409, "diag_decide_unsupported", "מערכת בקרת הכניסה אינה מציעה רישום החלטת סקירה לזהות של המערכת. אפשר לרשום אותה בחלון האינטרקום.",
                                  details={"reason": why}))
    try:
        _station_known(request, body.station_id)
    except ApiError as exc:
        raise act.refuse(exc) from None
    payload = {**body.model_dump(include={"user_id", "station_id", "lock_id", "person_revision", "fingerprint", "latest_id", "decision", "cadence_days"}), "reason": reason}
    act.attempt()
    try:
        reply = intercom_sync.SYNC.action(settings_of(request), "decision", lambda call: diag.review_decide(call, payload), diag.project_decide,
                                          who=principal.user_id, not_after=not_after, lane=diag.LANE, channel=diag.WRITE_CHANNEL)
    except ApiError as exc:
        details = dict(exc.details or {})
        outcome = str(details.get("outcome") or "unknown")
        code = str(details.get("wiskey_code") or exc.code)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        if outcome == "refused" and code in WISKEY_REFUSALS:
            status, own, message = WISKEY_REFUSALS[code]
            raise ApiError(status, own, message, details=details) from None
        if outcome == "unknown":
            raise ApiError(504, "diag_decide_unknown", "ההחלטה נשלחה, אך לא התקבלה תשובה ברורה. ייתכן שנשמרה - טענו מחדש את הסקירה ובדקו לפני ששולחים שוב.",
                           details=details) from None
        raise
    finally:
        act.conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
    receipt = reply["decision"]["receipt"]
    act.outcome("ok", None, {"receipt_id": receipt["id"]})
    try:
        with request.app.state.db.write_aside() as w:
            w.execute(
                "INSERT OR IGNORE INTO wiskey_access_review_decisions(receipt_id, user_id, station_id, lock_id, person_revision, decision, reason, cadence_days, "
                "decided_at, due_at, actor_user_id, actor_name, command_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (receipt["id"], body.user_id, body.station_id, body.lock_id, body.person_revision, receipt["decision"], receipt["reason"] or reason,
                 receipt["cadence_days"] or body.cadence_days, receipt["at"] or "", receipt["due_at"] or "", principal.user_id, principal.display_name or "",
                 act.details["command_id"], datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")),
            )
    except Exception:  # noqa: BLE001 - WisKey saved the receipt; the audit rows stand; only the "decided by" line is missing
        pass
    receipt["arx_actor"] = principal.display_name or principal.user_id
    return {"status": "saved", "command_id": act.details["command_id"], "receipt": receipt, "access_changed": False, "at": reply.get("fetched_at")}


# ---------------------------------------------------------------- data quality, lifecycle, sync

@router.get(f"{API}/quality")
def diag_quality(request: Request, auth: ia.Authority = Depends(_people_gate), kind: Literal["all", "missing", "invalid", "duplicate"] = "all",
                 state: Literal["all", "current", "archived"] = "current", offset: int = Query(0, ge=0, le=100_000), limit: int = Query(50, ge=1, le=100),
                 snapshot: str = Query("", max_length=64, pattern=r"^[a-f0-9]*$")) -> dict[str, Any]:
    _require_feature(request, "quality")
    if offset and not snapshot:
        raise ApiError(422, "validation", "דף המשך דורש את מזהה התמונה של הדף הראשון.", details={"fields": ["snapshot"]})
    emp = _employee_no(auth)
    return _read(request, auth, "quality", lambda call: diag.quality(call, kind, state, offset, limit, snapshot), lambda raw: diag.project_quality(raw, employee_no=emp))


@router.get(f"{API}/lifecycle")
def diag_lifecycle(request: Request, auth: ia.Authority = Depends(_people_gate), days: int = Query(30, ge=1, le=365)) -> dict[str, Any]:
    _require_feature(request, "lifecycle")
    emp, cred = _employee_no(auth), auth.unrestricted(ia.PEOPLE_SENSITIVE)
    return _read(request, auth, "lifecycle", lambda call: diag.lifecycle(call, days), lambda raw: diag.project_lifecycle(raw, employee_no=emp, credentials=cred))


@router.get(f"{API}/sync")
def diag_sync(request: Request, auth: ia.Authority = Depends(_gate)) -> dict[str, Any]:
    _require_feature(request, "sync")
    return _read(request, auth, "diagnostics", diag.sync_diagnostics, diag.project_sync)


# ---------------------------------------------------------------- station permission audit

@router.get(f"{API}/stations/{{station_id}}/permission-audit")
def diag_permission_audit(request: Request, auth: ia.Authority = Depends(_people_gate),
                          station_id: str = Path(min_length=1, max_length=128, pattern=ID_PATTERN)) -> dict[str, Any]:
    _require_feature(request, "permission_audit")
    station = _station_known(request, station_id)
    if station is not None and not station["online"]:
        raise ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן לא נבדקה.")
    limited = diag.AUDIT_GATE.admit(station_id)
    if limited is not None:
        code, retry = limited
        message = "בדיקת ההרשאות של העמדה עדיין רצה." if code == "diag_audit_busy" else f"העמדה נבדקה לפני רגע. אפשר לבדוק שוב בעוד {int(retry + 0.999)} שניות."
        raise ApiError(429, code, message, retryable=True, details={"retry_after_s": retry})
    emp = _employee_no(auth)
    try:
        out = _read(request, auth, "audit", lambda call: diag.permission_audit(call, station_id), lambda raw: diag.project_audit(raw, employee_no=emp), timeout=diag.AUDIT_TIMEOUT_S)
    finally:
        diag.AUDIT_GATE.done(station_id)
    report = out.get("audit")
    audit(auth.conn, actor=auth.principal, action=AUDIT_ACTION, decision="allowed", resource_type="intercom_station", resource_id=station_id,
          reason=None if out.get("state") == "ready" else str(out.get("last_error") or out.get("state")), request_id=_rid(request),
          details={"state": out.get("state"), "counts": (report or {}).get("counts"), "device_writes": (report or {}).get("device_writes")})
    return out
