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
import math
import sqlite3
import threading
import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, commit_now, get_setting, now_iso, rollback_and_restart, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import device_bulk as bulk
from ..services import devices as svc
from ..services import ha_bridge, ha_client, ha_scope, ha_sync
from ..services.timeutil import parse_utc

router = APIRouter()
READ = "devices.read"


def _visible_entities(conn: sqlite3.Connection, principal: Principal) -> tuple[list[dict[str, Any]], bool]:
    """The caller's entity set and whether it is a floor-scoped (narrowed) view. 403 without any grant."""
    rows, scoped = ha_scope.scoped_rows(conn, principal, READ, svc.load_entities(conn))
    # review L2: the alarm's own rows (each panel, each zone's bypass control) also need alarm.view at the entity's floor
    # scope - devices.read alone shows the building's devices, not its alarm system
    from ..services import alarm as alarm_svc

    owned = {r["entity_id"] for r in rows if r["domain"] == "alarm_control_panel"} | (alarm_svc.managed_controls(conn) & {r["entity_id"] for r in rows if r["domain"] in ("switch", "select")})
    if owned:
        wide, floors = ha_scope.visible_floors(conn, principal, "alarm.view")
        if not wide:
            placed = ha_scope.own_placements(conn)
            hidden = {e for e in owned if not ha_scope.entity_visible(False, floors, placed, e)}
            if hidden:
                rows, scoped = [r for r in rows if r["entity_id"] not in hidden], True
    return rows, scoped


def _bulk_flags(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    return bulk.scope_flags(conn, principal, svc.load_entities(conn))


async def _raw_body(request: Request) -> bytes:
    """The body, unparsed; declared after the permission dependency (403 whatever was sent) - the same JSON-only,
    permission-before-body pattern for every write route in this module (bulk actions, and slice 4's assign_area)."""
    return await request.body()


def _configure_holder_early(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """system.configure before the body is read (the same envelope as the slice-4 assign route); the refusal is audited."""
    require(conn, principal, "system.configure", INSTALLATION)
    return principal


def _is_json(content_type: str | None) -> bool:
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


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
    # CR-010 review B1: what the alarm section owns (the panel, a zone's bypass control) is listed read-only here
    from ..services import alarm as alarm_svc

    managed = alarm_svc.managed_controls(conn)
    for card in body["cards"].values():
        for r in card.get("entities", []):
            r["alarm_managed"] = r["entity_id"] in managed
            if r["alarm_managed"]:
                r["can_control"] = False
                r["managed_label"] = alarm_svc.MANAGED_LABEL
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
    # CR-007 slice 4: an administrator may assign an entity of the "ללא שיוך" bucket to an HA area
    # (PUT /devices/entities/{id}/area, system.configure)
    body["can_assign_area"] = area_id == svc.UNASSIGNED and authorize(conn, principal, "system.configure", INSTALLATION).allowed
    body["sync"] = ha_sync.STATE.as_dict()
    return body


ItemKind = Literal["lights", "switches", "covers", "climate", "media", "locks", "alarm"]


@router.get("/devices/items")
def items(
    principal: Principal = Depends(current_principal_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    kind: ItemKind = Query(...),
    scope: Literal["building", "floor", "area"] = Query("building"),
    id: str | None = Query(None, min_length=1, max_length=255),  # noqa: A002 - the scope's id, as in the bulk routes
) -> dict[str, Any]:
    """CR-007 overview tiles (owner 2026-09-29): every entity of one kind in the building, one HA floor or one HA area,
    grouped by floor › area, each with the area card's own fields and `can_control` - what the panel behind a summary
    tile ("0/33 מתגים פעילים") lists and controls. The controls still run through `POST /ha/entities/{id}/actions`
    (single entity) and `POST /devices/actions` (bulk, `can_bulk` says where); a lock row also says whether this caller
    may unlock it (`can_unlock`: `door.unlock` at the lock's own scope - the action route checks it again). Same
    visibility as the tree (`devices.read`, a floor-scoped reader sees only what is placed on their floors); a scope
    this caller cannot see is a 404. Read-only: nothing here calls Home Assistant."""
    if scope != "building" and not id:
        raise ApiError(422, "validation", "נדרש מזהה קומה או אזור (id).", details={"fields": ["id"]})
    entities, scoped = _visible_entities(conn, principal)
    control_of = ha_scope.control_checker(conn, principal)
    body = svc.build_items(conn, entities, kind, scope, id or "*", scoped=scoped, control_of=control_of)
    if body is None:
        raise ApiError(404, "not_found", "הקומה או האזור לא נמצאו.")
    flags = _bulk_flags(conn, principal)
    if scope == "building":
        body["can_bulk"] = bool(flags["building"])
    elif scope == "floor":
        body["can_bulk"] = bool(flags["all"] or body["id"] in flags["floors"])
    else:
        body["can_bulk"] = body["id"] != svc.UNASSIGNED and bool(flags["all"] or body["id"] in flags["areas"])
    # re-review M1: which rows a bulk action would reach (the same SwitchPolicy the bulk resolves with - the bulk-safe
    # mark, the door layer, door covers, alarm-managed), so the master control counts only those
    policy = bulk.SwitchPolicy(conn)
    for f in body["floors"]:
        for a in f["areas"]:
            for r in a["items"]:
                # CR-010: what the alarm section owns is listed read-only here too, and never counted by the master control
                r["alarm_managed"] = r["entity_id"] in policy.alarm_managed
                if r["alarm_managed"]:
                    r["can_control"] = False
                    if kind == "locks":
                        r["can_unlock"] = False
                reason = policy.excluded_reason(r)
                r["bulk_excluded"] = reason
                if r["domain"] == "switch":
                    r["bulk_safe"], r["bulk_reason"] = policy.switch_reason(r["entity_id"])
    body["can_mark_bulk_safe"] = kind == "switches" and authorize(conn, principal, "system.configure", INSTALLATION).allowed
    if kind == "locks":
        wide, floors = ha_scope.visible_floors(conn, principal, "door.unlock")
        placed = ha_scope.placements(conn) if floors and not wide else {}
        for f in body["floors"]:
            for a in f["areas"]:
                for r in a["items"]:
                    r["can_unlock"] = bool(r["can_control"]) and not r.get("alarm_managed") and ha_scope.entity_visible(wide, floors, placed, r["entity_id"])
    body["sync"] = ha_sync.STATE.as_dict()
    return body


REFRESH_EVERY_S = 10.0  # per user: the button is a nudge, not a poll
_refresh_lock = threading.Lock()
_last_refresh: dict[str, float] = {}


@router.post("/devices/refresh")
def refresh_from_ha(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """"רענן מ-Home Assistant": re-read HA's entity / device / area / floor registries now instead of waiting for the
    next registry event or the periodic refresh (CR-007 HA refresh). Read-only towards HA - the same listings the sync
    runs on its own - so `devices.read` anywhere is enough; one per user per REFRESH_EVERY_S (429 with
    `retry_after_s`). Open screens learn of a change through the `structure_changed` push like any other refresh."""
    ha_scope.scoped_rows(conn, principal, READ, [])  # 403 without devices.read anywhere
    now = time.monotonic()
    with _refresh_lock:
        last = _last_refresh.get(principal.user_id)
        if last is not None and now - last < REFRESH_EVERY_S:
            wait = max(1, math.ceil(REFRESH_EVERY_S - (now - last)))
            raise ApiError(429, "refresh_rate_limited", f"הרענון האחרון היה לפני רגע; אפשר לרענן שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})
        _last_refresh[principal.user_id] = now
    result = ha_sync.SYNC.refresh_now()
    return {**result, "sync": ha_sync.STATE.as_dict()}


class BulkSafeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bulk_safe: bool


# ---------------------------------------------------------------- הגדרות › חשמל › פעולה קבוצתית (owner 2026-09-30)
#
# The bulk-safe mark exists for switches only (CR-007 §7.10: lights, covers, climate and screens follow the kind's own
# rules; input_booleans never enter; locks, the alarm and door releases never). One screen manages it for every switch.

BULK_SAFE_MAX = 500


@router.get("/devices/bulk-safe")
def list_bulk_safe(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every switch with its bulk-safe mark, place, state, why it is or is not included and who marked it when -
    the settings screen's list. system.configure (the mark's own permission)."""
    require(conn, principal, "system.configure", INSTALLATION)
    policy = bulk.SwitchPolicy(conn)
    marks = {r["entity_id"]: dict(r) for r in conn.execute("SELECT entity_id, marked_by_username, marked_at FROM device_bulk_safe").fetchall()}
    floors, areas = svc.load_structure(conn, svc.load_entities(conn))
    fname = {f["floor_id"]: f["name"] for f in floors}
    area_floor = {a["area_id"]: a.get("floor_id") for a in areas}
    out = []
    for e in svc.load_entities(conn):
        if e["domain"] != "switch":
            continue
        ok, reason = policy.switch_reason(e["entity_id"])
        m = marks.get(e["entity_id"]) or {}
        fid = area_floor.get(e.get("area_id")) if e.get("area_id") else None
        out.append({
            "entity_id": e["entity_id"], "name": e.get("name") or e.get("original_name") or e["entity_id"],
            "area_id": e.get("area_id"), "area_name": e.get("area_name"), "floor_id": fid, "floor_name": fname.get(fid) if fid else None,
            "state": e.get("state"), "available": bool(e.get("available")),
            "marked": e["entity_id"] in policy.marked, "included": ok, "reason": reason, "reason_label": bulk.EXCLUDED_LABELS.get(reason) if not ok else None,
            "alarm_managed": e["entity_id"] in policy.alarm_managed,
            "marked_by": m.get("marked_by_username"), "marked_at": m.get("marked_at"),
        })
    out.sort(key=lambda r: (r["name"].casefold(), r["entity_id"]))
    return {"switches": out, "note": "הסימון קיים למתגים בלבד: תאורה, תריסים, מיזוג ומסכים נכללים לפי סוגם; מנעולים, אזעקה ושחרור דלתות לעולם לא."}


class BulkSafeManyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_ids: list[str] = Field(min_length=1, max_length=BULK_SAFE_MAX)
    bulk_safe: bool


@router.post("/devices/bulk-safe")
def set_bulk_safe_many(request: Request, principal: Principal = Depends(_configure_holder_early), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Mark (or unmark) many switches as bulk-safe in one call - the settings screen's "אשר לנבחרים" / "הסר אישור
    מהנבחרים". system.configure, checked before the body; JSON only; at most BULK_SAFE_MAX ids. Per id: refused when it
    is not a switch in the catalogue, when the alarm section owns it (`alarm_managed`) or - to mark - when it sits on the
    map's door layer; otherwise set through the same path as the single route. One audit row per changed entity
    (`devices.bulk_safe`) and one summary row (`devices.bulk_safe.batch`)."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        body = BulkSafeManyBody.model_validate(json.loads(raw) if raw.strip() else {})
    except (ValueError, ValidationError) as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()}) if isinstance(exc, ValidationError) else ["body"]
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None
    policy = bulk.SwitchPolicy(conn)
    rid = getattr(request.state, "correlation_id", None)
    results = []
    changed = 0
    for eid in dict.fromkeys(body.entity_ids):  # each id once, in the order given
        row = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (eid,)).fetchone()
        if not row or row["domain"] != "switch":
            results.append({"entity_id": eid, "ok": False, "reason": "not_switch"})
            continue
        if eid in policy.alarm_managed:
            results.append({"entity_id": eid, "ok": False, "reason": "alarm_managed"})
            continue
        if body.bulk_safe and eid in policy.door_layer:
            results.append({"entity_id": eid, "ok": False, "reason": "doors_layer"})
            continue
        was = eid in policy.marked
        if was != body.bulk_safe:
            bulk.set_bulk_safe(conn, principal, eid, body.bulk_safe)
            audit(conn, actor=principal, action="devices.bulk_safe", decision="allowed", resource_type="ha_entity", resource_id=eid, request_id=rid, details={"bulk_safe": body.bulk_safe, "batch": True})
            changed += 1
        results.append({"entity_id": eid, "ok": True, "reason": None, "changed": was != body.bulk_safe})
    audit(conn, actor=principal, action="devices.bulk_safe.batch", decision="allowed", resource_type="installation", resource_id="*", request_id=rid,
          details={"bulk_safe": body.bulk_safe, "requested": len(results), "changed": changed, "refused": [r["entity_id"] for r in results if not r["ok"]][:100]})
    return {"results": results, "changed": changed, "refused": sum(1 for r in results if not r["ok"])}


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
    from ..services import alarm as alarm_svc

    if body.bulk_safe and alarm_svc.is_managed_control(conn, entity_id):  # CR-010 review B1
        audit(conn, actor=principal, action="devices.bulk_safe", decision="denied", resource_type="ha_entity", resource_id=entity_id, reason="alarm_managed",
              request_id=getattr(request.state, "correlation_id", None), details={"bulk_safe": True})
        raise ApiError(409, "alarm_managed", "מתג עקיפה של חיישן אזעקה נשלט ממסך האזעקה ולעולם לא נכלל בפעולה מרוכזת.")
    bulk.set_bulk_safe(conn, principal, entity_id, body.bulk_safe)
    audit(conn, actor=principal, action="devices.bulk_safe", decision="allowed", resource_type="ha_entity", resource_id=entity_id,
          request_id=getattr(request.state, "correlation_id", None), details={"bulk_safe": body.bulk_safe})
    ok, reason = bulk.SwitchPolicy(conn).switch_reason(entity_id)
    return {"entity_id": entity_id, "bulk_safe": ok, "bulk_reason": reason, "marked": body.bulk_safe}


# ---------------------------------------------------------------- slice 4: assign an unassigned entity to an area


class AssignAreaBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    area_id: str = Field(min_length=1, max_length=255)


def _configure_holder(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """system.configure, checked before the body is looked at (review MEDIUM 5: an unauthorized caller must get an
    audited 403, never a bare 422 for a malformed body it was never entitled to send) - require() itself audits the
    refusal."""
    require(conn, principal, "system.configure", INSTALLATION)
    return principal


@router.put("/devices/entities/{entity_id}/area")
def assign_area(entity_id: str, request: Request, principal: Principal = Depends(_configure_holder), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """CR-007 slice 4: assign an entity of the "ללא שיוך" bucket (or move any entity) to an HA area - a Home
    Assistant CONFIG write, never a domain service call, through the bridge's own registry-write path
    (services/ha_client.call_bridge_set_area - the bridge accepts exactly this one registry op, nothing else).
    system.configure (an administrator's statement, the same gate as bulk-safe) checked before the body is even
    read (_configure_holder, the same JSON-only / permission-first envelope the bulk route uses); audited under the
    real actor with the honest bridge answer; on success the local registry mirror is updated at once from our own
    area/floor tables, so the tree and area screens show the move without waiting for the next HA registry refresh."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (request.headers.get("content-type") or "")[:100]})
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        body = AssignAreaBody.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None
    erow = conn.execute("SELECT entity_id, area_id FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
    if not erow:
        raise ApiError(404, "not_found", "הישות לא נמצאה בקטלוג.")
    arow = conn.execute("SELECT area_id, name, floor_id FROM ha_areas WHERE area_id = ?", (body.area_id,)).fetchone()
    if not arow:
        raise ApiError(404, "area_not_found", "האזור לא נמצא.")
    settings = settings_of(request)
    rid = getattr(request.state, "correlation_id", None)
    if principal.source not in ("ingress", "remote") and not settings.dev_user:  # CR-008: the Arx remote channel is the same HA user
        raise ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן.")
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise ApiError(503, "bridge_not_paired", "שיוך אזור דורש את הגשר מותקן ומצומד.")
    bridge_rid = uuid.uuid4().hex[:12]
    payload = ha_bridge.sign(secret, {"user_id": principal.user_id, "entity_id": entity_id, "area_id": body.area_id, "request_id": bridge_rid})
    # two-phase: the attempt row is committed (by unlocked) before Home Assistant is asked, so an area change is never
    # unrecorded - not even when the database stays busy afterwards and the outcome row cannot be written
    audit(conn, actor=principal, action="devices.assign_area", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=rid,
          details={"area_id": body.area_id, "from_area_id": erow["area_id"], "phase": "attempt", "request": bridge_rid})
    try:
        with unlocked(conn):  # the HA call runs without the request's write lock (round-10 lock storm)
            result = ha_client.call_bridge_set_area(settings, payload)
    except ApiError as exc:
        audit(conn, actor=principal, action="devices.assign_area", decision="denied", resource_type="ha_entity", resource_id=entity_id, reason=exc.code, request_id=rid,
              details={"area_id": body.area_id, "from_area_id": erow["area_id"], "phase": "outcome", "request": bridge_rid})
        raise
    ok = bool(result.get("ok"))
    error = None if ok else str(result.get("error") or "bridge_error")
    audit(conn, actor=principal, action="devices.assign_area", decision="allowed" if ok else "denied", resource_type="ha_entity", resource_id=entity_id, reason=error, request_id=rid,
          details={"area_id": body.area_id, "from_area_id": erow["area_id"], "phase": "outcome", "request": bridge_rid})
    if not ok:
        status = 404 if error in ("entity_not_found", "area_not_found") else 502
        raise ApiError(status, "bridge_error", "תשתית המערכת דחתה את שיוך האזור.", details={"error": error})
    frow = conn.execute("SELECT name FROM ha_floors WHERE floor_id = ?", (arow["floor_id"],)).fetchone() if arow["floor_id"] else None
    conn.execute(
        "UPDATE ha_entities SET area_id = ?, area_name = ?, ha_floor_id = ?, ha_floor_name = ?, updated_at = ? WHERE entity_id = ?",
        (arow["area_id"], arow["name"], arow["floor_id"], frow["name"] if frow else None, now_iso(), entity_id),
    )
    return {"entity_id": entity_id, "area_id": arow["area_id"], "area_name": arow["name"]}


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
Kind = Literal["lights_off", "covers_close", "covers_open", "covers_stop", "covers_position", "climate_off", "screens_off", "all_off", "switches_off", "switches_on", "lights_on", "screens_on"]


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
    # CR-007 slice 4: the one argument a bulk kind ever carries - "כל התריסים" position, required exactly for
    # covers_position (bulk.resolve refuses a mismatch either way)
    position: int | None = Field(None, ge=0, le=100)
    # owner 2026-09-29 (the tiles' panel): the entity ids the panel shows (its filter / search) - narrows the set, never
    # widens it (services/device_bulk.resolve)
    only: list[str] | None = Field(None, max_length=500)


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


def _only(raw: str | None) -> set[str] | None:
    """The preview's `only` (comma-separated entity ids) - None when absent."""
    if raw is None:
        return None
    return {x.strip() for x in raw.split(",") if x.strip()}


@router.get("/devices/actions/preview")
def bulk_preview(
    principal: Principal = Depends(_bulk_reader),
    conn: sqlite3.Connection = Depends(get_read_conn),
    scope: Scope = Query(...),
    id: str = Query(..., min_length=1, max_length=255),  # noqa: A002 - the scope's id, as in the request body
    kind: Kind = Query(...),
    position: int | None = Query(None, ge=0, le=100),
    only: str | None = Query(None, max_length=20000),
) -> dict[str, Any]:
    """Exactly what `POST /devices/actions` would send for this scope and kind, per entity - the confirmation dialog
    states it (count by domain, what is skipped as already off / unavailable, what is never included). Sends nothing."""
    try:
        return bulk.resolve(conn, principal, scope, id, kind, position, _only(only))
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
        plan = bulk.resolve(conn, principal, body.scope, body.id, body.kind, body.position, set(body.only) if body.only is not None else None)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if body.preview_digest is not None and body.preview_digest != plan["digest"]:
        raise act.refuse(ApiError(409, "target_changed", "רשימת ההתקנים השתנתה מאז שנפתח חלון האישור, ולכן לא נשלח דבר. פתחו את הפעולה מחדש.", details={"count": plan["count"]}))
    if not plan["count"]:
        raise act.refuse(ApiError(409, "nothing_to_do", "אין מה לשלוח: לפי הדיווח האחרון אין בהיקף הזה התקן פעיל מהסוג הזה.", details={"skipped": plan["skipped"]}))
    settings = settings_of(request)
    if principal.source not in ("ingress", "remote") and not settings.dev_user:  # CR-008: the Arx remote channel is the same HA user
        raise act.refuse(ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן."))
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise act.refuse(ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את הגשר מותקן ומצומד."))
    bulk_id = uuid.uuid4().hex[:12]
    blocking = bulk.RUNNER.reserve(bulk.scope_key(body.scope, body.id), bulk_id, {t["entity_id"] for t in plan["targets"]})
    if blocking:
        raise act.refuse(ApiError(409, "bulk_in_progress", "פעולה מרוכזת קודמת על ההיקף הזה (או על חלק מההתקנים שלו) עדיין רצה. המתינו לסיומה.", details={"bulk_id": blocking}))
    started = False
    try:
        try:
            bulk.record(conn, principal, bulk_id, plan, body.client_request_id, not_after)
        except ApiError as exc:  # never keep half a record: drop what was written, refuse, send nothing
            rollback_and_restart(conn)
            raise act.refuse(exc) from None
        audit(conn, actor=principal, action=bulk.AUDIT_ACTION, decision="allowed", resource_type=act.resource_type, resource_id=act.resource_id, request_id=act.rid,
              details={**act.details, "phase": "attempt", "bulk_id": bulk_id, "scope_name": plan["name"], "entity_count": plan["count"], "by_domain": plan["by_domain"],
                       "entity_ids": [t["entity_id"] for t in plan["targets"]], "skipped": plan["skipped"], "excluded": [x["entity_id"] for x in plan["excluded"]]})
        commit_now(conn)  # the attempt row and the queued records exist before the first call - or nothing is sent; nothing more is written here
        db: Database = request.app.state.db
        targets = plan["targets"]
        bulk.RUNNER.start(bulk_id, lambda: bulk.run(db, settings, principal, bulk_id, targets, secret, not_after, act.rid))
        started = True
    finally:
        if not started:
            bulk.RUNNER.release(bulk_id)
    out = bulk.load(conn, bulk_id)
    out["note"] = "הבקשה התקבלה ונשלחת להתקנים. התקן נחשב כבוי רק כשמתקבל דיווח על כך."
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
        commit_now(conn)  # a fresh read snapshot
        b = bulk.load(conn, bulk_id)
    return b
