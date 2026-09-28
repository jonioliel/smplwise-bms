"""Electricity and device control API (CR-007): the floors → areas tree with live counts, the building-wide counts
and one area's per-domain cards, projected from the synced Home Assistant catalogue.

Permission `devices.read`. Scope follows /ha/entities exactly: installation-wide holders see every entity; a holder
bound to floors sees only entities placed (anchored or wired to a circuit) on those floors, and so only the HA areas
and floors that contain such an entity. Nothing here writes, calls Home Assistant or returns hosts / tokens.

Slice 2 adds `can_control` to each area card row (`devices.control` or `ha.entity.control`, same floor scope as
`devices.read` - services/ha_scope.control_checker); the action itself still runs through the existing
`POST /ha/entities/{entity_id}/actions` (routers/ha.py), which this module never calls.

Slice 3 adds the bulk actions (`devices.control_bulk`): `GET /devices/actions/preview` (exactly what a request would
send - the confirmation dialog shows it), `POST /devices/actions` (the physical request) and `GET /devices/actions/{id}`
(per-entity outcomes). The CR-005 physical-action pattern (routers/access_control.py): the permission before the
body, JSON only, `client_request_id` + `expires_at` checked on the server's clock, every refusal audited, an attempt
row committed before anything is sent, an outcome row after. The rules of the set itself live in
services/device_bulk.py; tree / area replies carry `can_bulk` flags so the screens render the controls only where
the server would accept them."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, get_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import device_bulk as bulk
from ..services import devices as svc
from ..services import ha_bridge, ha_scope, ha_sync
from ..services.timeutil import parse_utc

router = APIRouter()
READ = "devices.read"


def _visible_entities(conn: sqlite3.Connection, principal: Principal) -> tuple[list[dict[str, Any]], bool]:
    """The caller's entity set and whether it is a floor-scoped (narrowed) view. 403 without any grant."""
    return ha_scope.scoped_rows(conn, principal, READ, svc.load_entities(conn))


def _bulk_flags(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    return bulk.scope_flags(conn, principal, svc.load_entities(conn))


@router.get("/devices/tree")
def tree(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    entities, scoped = _visible_entities(conn, principal)
    body = svc.build_tree(conn, entities, scoped=scoped)
    # CR-007 slice 3: where this caller may start a bulk action (devices.control_bulk at the entities' own floors;
    # the building only installation-wide). The screens render the floor menu / area popover / building buttons
    # only where this is true; the server checks it again on every request.
    flags = _bulk_flags(conn, principal)
    body["can_bulk"] = flags["building"]
    for f in body["floors"]:
        f["can_bulk"] = flags["all"] or f["floor_id"] in flags["floors"]
        for a in f["areas"]:
            a["can_bulk"] = flags["all"] or a["area_id"] in flags["areas"]
    body["sync"] = ha_sync.STATE.as_dict()
    return body


@router.get("/devices/building")
def building(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    entities, scoped = _visible_entities(conn, principal)
    t = svc.build_tree(conn, entities, scoped=scoped)
    return {
        "counts": t["building"],
        "floors": len([f for f in t["floors"] if f["floor_id"] != svc.NO_FLOOR]),
        "areas": sum(len(f["areas"]) for f in t["floors"]),
        "unassigned": t["unassigned"]["counts"]["entities"],
        "scoped": scoped,
        "sync": ha_sync.STATE.as_dict(),
    }


@router.get("/devices/areas/{area_id}")
def area(area_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`area_id` is an HA area id, or `unassigned` for the entities that belong to no area."""
    entities, scoped = _visible_entities(conn, principal)
    control_of = ha_scope.control_checker(conn, principal)
    body = svc.build_area(conn, entities, area_id, scoped=scoped, control_of=control_of)
    if body is None:
        raise ApiError(404, "not_found", "האזור לא נמצא.")
    flags = _bulk_flags(conn, principal)
    body["can_bulk"] = area_id != svc.UNASSIGNED and (flags["all"] or area_id in flags["areas"])
    # review round 1: whether each switch may enter a bulk action (a lighting circuit's switch, or marked bulk-safe
    # by an administrator; a switch on the map's door layer never) - shown to bulk holders, editable with
    # system.configure (PUT /devices/entities/{id}/bulk-safe)
    if flags["building"] or flags["areas"]:
        policy = bulk.SwitchPolicy(conn)
        body["can_mark_bulk_safe"] = authorize(conn, principal, "system.configure", INSTALLATION).allowed
        for r in body["cards"]["switches"]["entities"]:
            if r["domain"] == "switch":
                ok, reason = policy.switch_reason(r["entity_id"])
                r["bulk_safe"], r["bulk_reason"] = ok, reason
    body["sync"] = ha_sync.STATE.as_dict()
    return body


class BulkSafeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bulk_safe: bool


@router.put("/devices/entities/{entity_id}/bulk-safe")
def set_bulk_safe(entity_id: str, body: BulkSafeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Mark a switch as safe (or no longer safe) to be turned off by a bulk action - an administrator's statement that it
    is not a door / gate release or anything else that must not go off with the lights (system.configure; audited).
    The mark is the only way a switch enters a bulk action (a lighting circuit only suggests it); a switch on the map's
    door layer is never included, mark or not."""
    require(conn, principal, "system.configure", INSTALLATION)
    row = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if not row:
        raise ApiError(404, "not_found", "הישות לא נמצאה בקטלוג.")
    if row["domain"] != "switch":
        raise ApiError(422, "validation", "רק מתג (switch) מסומן כבטוח לכיבוי מרוכז; שאר הסוגים נקבעים לפי הכללים.")
    bulk.set_bulk_safe(conn, principal, entity_id, body.bulk_safe)
    audit(conn, actor=principal, action="devices.bulk_safe", decision="allowed", resource_type="ha_entity", resource_id=entity_id,
          request_id=getattr(request.state, "correlation_id", None), details={"bulk_safe": body.bulk_safe})
    ok, reason = bulk.SwitchPolicy(conn).switch_reason(entity_id)
    return {"entity_id": entity_id, "bulk_safe": ok, "bulk_reason": reason, "marked": body.bulk_safe}


# ---------------------------------------------------------------- slice 3: bulk actions (devices.control_bulk)
#
# Accountability, as the CR-005 physical actions: once the caller holds devices.control_bulk somewhere, every request
# leaves audit rows under the real actor with the action `devices.bulk` - a request refused before anything is sent:
# ONE row, decision `denied`, `reason` = the refusal code, `details.phase` "refused" / `outcome` "not_sent"; a request
# that goes out: an ATTEMPT row (`phase` "attempt": scope, id, kind, entity count and ids) committed together with the
# queued per-entity records BEFORE the first call, then ONE outcome row (`phase` "outcome", the counts and the ids that
# were not confirmed) once every entity is confirmed or its window passed (services/device_bulk.finish).

COMMAND_ID = r"^[A-Za-z0-9-]{8,64}$"
Scope = Literal["building", "floor", "area"]
Kind = Literal["lights_off", "covers_close", "climate_off", "screens_off", "all_off"]


class BulkBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scope: Scope
    id: str = Field(min_length=1, max_length=255)
    kind: Kind
    # the confirmation dialog's own button, stated explicitly; any JSON value is accepted here and only `true`
    # confirms, so a wrong value is an audited refusal rather than a bare 422
    confirmed: Any = None
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)
    # the preview's digest: when given, the request is refused if the set changed since the dialog showed it
    preview_digest: str | None = Field(None, min_length=1, max_length=64)


def _bulk_holder(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """devices.control_bulk somewhere (installation or a floor), checked before the body is looked at; a refusal is
    audited by `require`. devices.control alone (an operator) is never enough."""
    wide, floors = ha_scope.visible_floors(conn, principal, bulk.PERMISSION)
    if not wide and not floors:
        require(conn, principal, bulk.PERMISSION, INSTALLATION)
    return principal


def _bulk_reader(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    wide, floors = ha_scope.visible_floors(conn, principal, bulk.PERMISSION)
    if not wide and not floors:
        require(conn, principal, bulk.PERMISSION, INSTALLATION)
    return principal


async def _raw_body(request: Request) -> bytes:
    """The body, unparsed; declared after the permission dependency (403 whatever was sent)."""
    return await request.body()


def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


class _Refusals:
    """The audit context of one bulk request: every refusal before sending is one `denied` row."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal) -> None:
        self.request, self.conn, self.principal = request, conn, principal
        self.rid = getattr(request.state, "correlation_id", None)
        self.resource_type, self.resource_id = "devices_bulk", "*"
        self.details: dict[str, Any] = {}

    def refuse(self, exc: ApiError) -> ApiError:
        exc.details.setdefault("outcome", "not_sent")
        audit(self.conn, actor=self.principal, action=bulk.AUDIT_ACTION, decision="denied", resource_type=self.resource_type, resource_id=self.resource_id,
              reason=exc.code, request_id=self.rid, details={**self.details, "phase": "refused", "outcome": "not_sent"})
        return exc


def _parse(act: _Refusals, raw: bytes) -> BulkBody:
    """JSON only (a text/plain or form body is a CORS simple request a browser sends cross-site without a preflight:
    it must never switch anything off), then the closed body model; each failure an audited refusal."""
    content_type = act.request.headers.get("content-type")
    if not _is_json(content_type):
        raise act.refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise act.refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    try:
        return BulkBody.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise act.refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None


def _envelope(act: _Refusals, body: BulkBody) -> dt.datetime:
    """Expiry on the server's clock, and the duplicate check. Returns the instant after which nothing is sent."""
    try:
        expires = parse_utc(body.expires_at)
    except ValueError:
        raise act.refuse(ApiError(422, "validation", "expires_at חייב להיות זמן UTC (Z).")) from None
    now = dt.datetime.now(dt.timezone.utc)
    if expires <= now:
        raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שהגיעה לשרת, ולכן לא נשלח דבר. אם השעון במכשיר שלכם אינו מדויק, תקנו אותו."))
    if expires > now + dt.timedelta(seconds=bulk.EXPIRY_MAX_S):
        raise act.refuse(ApiError(422, "expires_too_far", f"תוקף הבקשה חייב להסתיים תוך {int(bulk.EXPIRY_MAX_S)} שניות."))
    seen = act.conn.execute("SELECT id FROM device_bulk_actions WHERE principal_user_id = ? AND client_request_id = ?", (act.principal.user_id, body.client_request_id)).fetchone()
    if seen:
        raise act.refuse(ApiError(409, "duplicate_command", "הפקודה הזו כבר נשלחה (אותו מזהה פקודה), ולכן לא נשלחה שוב.", details={"bulk_id": seen["id"]}))
    return min(expires, now + dt.timedelta(seconds=bulk.SEND_WITHIN_S))


@router.get("/devices/actions/preview")
def bulk_preview(
    principal: Principal = Depends(_bulk_reader),
    conn: sqlite3.Connection = Depends(get_read_conn),
    scope: Scope = Query(...),
    id: str = Query(..., min_length=1, max_length=255),  # noqa: A002 - the scope's id, as in the request body
    kind: Kind = Query(...),
) -> dict[str, Any]:
    """Exactly what `POST /devices/actions` would send for this scope and kind, per entity - the confirmation dialog
    states it (count by domain, what is skipped as already off / unavailable, what is never included). Sends nothing."""
    try:
        return bulk.resolve(conn, principal, scope, id, kind)
    except ApiError as exc:
        if exc.status == 403:
            audit(conn, actor=principal, action=bulk.AUDIT_ACTION, decision="denied", resource_type=f"devices_{scope}", resource_id=id, reason=exc.code,
                  details={"phase": "preview", "scope": scope, "id": id, "kind": kind})
        raise


@router.post("/devices/actions", status_code=202)
def bulk_run(request: Request, principal: Principal = Depends(_bulk_holder), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Turn off the lights / close the covers / turn off the climate / turn off the screens / turn everything off for
    the building, an HA floor or an HA area. Body: `{scope, id, kind, confirmed, client_request_id, expires_at,
    preview_digest?}`; `confirmed: true` is sent only by the confirmation dialog's own button. The set is resolved here
    (services/device_bulk.resolve - never a lock, an alarm panel, a siren, a script, a scene, a button or a door) and
    each entity becomes one ordinary HA action record through the bridge, at most 8 calls in flight. Refused before
    sending, each refusal audited: a malformed / non-JSON body, an expired or duplicate command, a missing
    confirmation, an unknown scope (404), a scope outside the caller's floors (403), a set that changed since the
    preview (409 `target_changed`), nothing to do (409 `nothing_to_do`), the bridge not paired (503), another bulk on
    the same scope or the same entities still running (409 `bulk_in_progress`). Reply 202: the bulk record with each
    entity queued; `GET /devices/actions/{id}` follows it to the end."""
    act = _Refusals(request, conn, principal)
    body = _parse(act, raw)
    act.resource_type, act.resource_id = f"devices_{body.scope}", body.id
    act.details.update(scope=body.scope, id=body.id, kind=body.kind, client_request_id=body.client_request_id, expires_at=body.expires_at)
    not_after = _envelope(act, body)
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "פעולה מרוכזת דורשת אישור מפורש בחלון האישור."))
    try:
        plan = bulk.resolve(conn, principal, body.scope, body.id, body.kind)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if body.preview_digest is not None and body.preview_digest != plan["digest"]:
        raise act.refuse(ApiError(409, "target_changed", "רשימת ההתקנים השתנתה מאז שנפתח חלון האישור, ולכן לא נשלח דבר. פתחו את הפעולה מחדש.", details={"count": plan["count"]}))
    if not plan["count"]:
        raise act.refuse(ApiError(409, "nothing_to_do", "אין מה לשלוח: לפי הדיווח האחרון של Home Assistant אין בהיקף הזה התקן פעיל מהסוג הזה.", details={"skipped": plan["skipped"]}))
    settings = settings_of(request)
    if principal.source != "ingress" and not settings.dev_user:
        raise act.refuse(ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת HA."))
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise act.refuse(ApiError(503, "bridge_not_paired", "פעולות HA דורשות את גשר SMPLWISE מותקן ומצומד ב־Home Assistant."))
    bulk_id = uuid.uuid4().hex[:12]
    blocking = bulk.RUNNER.reserve(bulk.scope_key(body.scope, body.id), bulk_id, {t["entity_id"] for t in plan["targets"]})
    if blocking:
        raise act.refuse(ApiError(409, "bulk_in_progress", "פעולה מרוכזת קודמת על ההיקף הזה (או על חלק מההתקנים שלו) עדיין רצה. המתינו לסיומה.", details={"bulk_id": blocking}))
    started = False
    try:
        try:
            bulk.record(conn, principal, bulk_id, plan, body.client_request_id, not_after)
        except ApiError as exc:  # never keep half a record: drop what was written, refuse, send nothing
            conn.execute("ROLLBACK")
            conn.execute("BEGIN IMMEDIATE")
            raise act.refuse(exc) from None
        audit(conn, actor=principal, action=bulk.AUDIT_ACTION, decision="allowed", resource_type=act.resource_type, resource_id=act.resource_id, request_id=act.rid,
              details={**act.details, "phase": "attempt", "bulk_id": bulk_id, "scope_name": plan["name"], "entity_count": plan["count"], "by_domain": plan["by_domain"],
                       "entity_ids": [t["entity_id"] for t in plan["targets"]], "skipped": plan["skipped"], "excluded": [x["entity_id"] for x in plan["excluded"]]})
        conn.execute("COMMIT")  # the attempt row and the queued records exist before the first call - or nothing is sent
        conn.execute("BEGIN")  # deferred: nothing more is written on this connection
        db: Database = request.app.state.db
        targets = plan["targets"]
        bulk.RUNNER.start(bulk_id, lambda: bulk.run(db, settings, principal, bulk_id, targets, secret, not_after, act.rid))
        started = True
    finally:
        if not started:
            bulk.RUNNER.release(bulk_id)
    out = bulk.load(conn, bulk_id)
    out["note"] = "הבקשה התקבלה ונשלחת להתקנים. התקן נחשב כבוי רק כש־Home Assistant מדווח על כך."
    return out


@router.get("/devices/actions/{bulk_id}")
def bulk_status(bulk_id: str, request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """A bulk request's per-entity outcomes (queued / accepted / confirmed / not_confirmed / refused / unknown), the
    counts and `done`. Its own requester, or a system administrator."""
    b = bulk.load(conn, bulk_id)
    if b["principal_user_id"] != principal.user_id and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "הפעולה שייכת למשתמש אחר.")
    if not b["done"] and not bulk.RUNNER.running(bulk_id):
        # its worker is gone (the add-on restarted mid-bulk): record what was never sent, read the rest once more
        db: Database = request.app.state.db
        bulk.settle_orphan(db, bulk_id)
        conn.execute("COMMIT")
        conn.execute("BEGIN")
        b = bulk.load(conn, bulk_id)
    return b
