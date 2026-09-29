"""Map anchors (placements) with optimistic revisions and tombstones; the floor map bundle used by the
viewer and the editor (ch. 12, 13)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, authorize, require
from ..services.access import camera_reach_for_placement, camera_scope, require_camera_placement, require_floor_read
from .catalog import building_row, floor_row, get_building, get_floor, get_site, site_row
from ..services.timeutil import parse_utc
from .plans import needs_alignment, version_at, version_row
from .settings import read_settings

router = APIRouter()


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def anchor_row(r: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": r["id"], "floor_id": r["floor_id"], "plan_version_id": r["plan_version_id"], "resource_type": r["resource_type"],
        "resource_id": r["resource_id"], "position": {"x": r["x"], "y": r["y"]}, "rotation_degrees": r["rotation_degrees"],
        "field_of_view_degrees": r["field_of_view_degrees"], "layer_id": r["layer_id"], "label": r["label"], "revision": r["revision"],
        "effective_from": r["effective_from"], "effective_to": r["effective_to"], "updated_at": r["updated_at"],
        "coverage_radius": r["coverage_radius"], "coverage_polygon": _polygon(r["coverage_polygon"]),
        "label_pos": r["label_pos"] or "auto",
        "level_id": r["level_id"] if "level_id" in r.keys() else None,
        "mount_height_m": r["mount_height_m"] if "mount_height_m" in r.keys() else None,
        "tilt_deg": r["tilt_deg"] if "tilt_deg" in r.keys() else None,
    }


def _polygon(raw: str | None) -> list[list[float]] | None:
    if not raw:
        return None
    try:
        pts = json.loads(raw)
    except ValueError:
        return None
    return pts if isinstance(pts, list) and len(pts) >= 3 else None


COVERAGE_KEYS = ("coverage_radius", "coverage_polygon")
# Fields an explicit null clears in a PATCH (absent = unchanged): the coverage pair, the 3D pair (T087), the label and
# the field of view (null = no cone; ruling R-P4-T3-1).
NULLABLE_KEYS = COVERAGE_KEYS + ("mount_height_m", "tilt_deg", "label", "field_of_view_degrees")


def _check_polygon(pts: list[list[float]] | None) -> str | None:
    """JSON text of a valid polygon (3..40 points, each [x, y] within the plan) or None; raises 422 otherwise."""
    if pts is None:
        return None
    if not 3 <= len(pts) <= 40 or any(len(p) != 2 or not all(isinstance(v, (int, float)) and 0 <= v <= 1 for v in p) for p in pts):
        raise ApiError(422, "validation", "מצולע הכיסוי צריך 3 עד 40 נקודות בתוך התוכנית.")
    return json.dumps([[round(float(p[0]), 4), round(float(p[1]), 4)] for p in pts])


def camera_row(r: sqlite3.Row) -> dict[str, Any]:
    try:
        caps = json.loads(r["capabilities_json"] or "{}")
    except ValueError:
        caps = {}
    return {
        "id": r["id"], "recorder_id": r["recorder_id"], "channel": r["channel"], "name": r["alias"] or r["name_source"] or f"ערוץ {r['channel']}",
        "name_source": r["name_source"], "alias": r["alias"], "enabled": bool(r["enabled"]), "sort_order": r["sort_order"],
        "main_track": r["main_track"], "sub_track": r["sub_track"], "status": r["status"], "last_seen_at": r["last_seen_at"],
        "stream": caps.get("stream"),
        # CR-008 D7: the main / sub stream encodings from the NVR and whether each plays over WebRTC (services/stream_codecs)
        "encoding": caps.get("encoding") if isinstance(caps.get("encoding"), dict) else None,
        # N1 review note: `r["grid_col_span"]` alone is NOT safe here even after migration 0023 ships - this
        # exact defensive fallback pattern already exists for the anchor 3D fields two lines up, precisely
        # because test_anchor_3d.py's own "populated database from before 0021" test runs this CURRENT router
        # code against a database deliberately kept at an older migration set (an earlier, unrelated migration
        # is what that test is about) - camera_row() is called from that same code path. Removing the fallback
        # broke that pre-existing test; keeping it costs nothing once every row genuinely has the column.
        "grid_col_span": r["grid_col_span"] if "grid_col_span" in r.keys() else 1,
    }


def get_anchor(conn: sqlite3.Connection, anchor_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM map_anchors WHERE id = ? AND effective_to IS NULL", (anchor_id,)).fetchone()
    if not row:
        raise not_found("העוגן לא נמצא.")
    return row


def _current_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published'", (floor_id,)).fetchone()


def _zones_for(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    from .zones import floor_zones  # local import: zones depends on this module

    return floor_zones(conn, floor_id)


def _marked_zones(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    """The floor's rooms; one that other floors show too carries `shared` (role "home"; CR-009: the floor chip is drawn
    on the home map as well)."""
    from ..services import shared_spaces

    marks = shared_spaces.home_zone_marks(conn, floor_id)
    return [dict(z, shared=marks[z["id"]]) if z["id"] in marks else z for z in _zones_for(conn, floor_id)]


def _editor_version(conn: sqlite3.Connection, floor_id: str) -> sqlite3.Row | None:
    draft = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1", (floor_id,)).fetchone()
    return draft or _current_version(conn, floor_id)


@router.get("/floors/{floor_id}/map")
def floor_map(floor_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), draft: bool = False, at: str | None = None) -> dict[str, Any]:
    """Everything the map needs in one call. `draft=true` (editors) prefers the latest draft background; `at=<UTC>`
    returns the version that was published at that instant and the anchors effective then (historical map, T038)."""
    f = get_floor(conn, floor_id)
    # T055: "floor" = a binding on the floor or above; "cameras" = only camera-scoped bindings for cameras anchored
    # here - the drawing and those cameras' anchors, nothing else of the floor (no entities, zones, circuit states)
    reach = require_floor_read(conn, principal, floor_id)
    cam_scope = camera_scope(conn, principal, "map.read")
    camera_only = reach == "cameras"
    can_edit = authorize(conn, principal, "placement.edit", ("floor", floor_id)).allowed
    can_structure = authorize(conn, principal, "map.edit", ("floor", floor_id)).allowed  # loading a structure draft needs map.edit
    can_publish = authorize(conn, principal, "map.publish", ("floor", floor_id)).allowed
    at_iso: str | None = None
    history: str | None = None
    history_from = conn.execute("SELECT MIN(published_at) FROM plan_versions WHERE floor_id = ? AND published_at IS NOT NULL", (floor_id,)).fetchone()[0]
    if at:
        try:
            at_iso = parse_utc(at).strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
    if at_iso and history_from and at_iso >= history_from:
        # the floor's map history begins with its first publish; from then on the version and the anchors of that instant
        history = "exact"
        version = version_at(conn, floor_id, at_iso)
        anchors = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?) ORDER BY layer_id, resource_id", (floor_id, at_iso, at_iso)).fetchall()
    else:
        # before the history begins (or without `at`): the current map, so older events still get a map
        history = "current" if at_iso else None
        version = _editor_version(conn, floor_id) if (draft and can_edit and not at_iso) else _current_version(conn, floor_id)
        anchors = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (floor_id,)).fetchall()
    # T055: a camera the caller cannot see is not in the bundle - not as an anchor, not in the camera list; a
    # camera-only reader gets camera anchors alone
    anchors = [a for a in anchors if (cam_scope.allows(a["resource_id"]) if a["resource_type"] == "camera" else not camera_only)]
    from ..services import geometry_store, plan_catalog, shared_spaces

    geometry_row = None
    if version is not None:
        if at_iso and history == "exact":
            geometry_row = geometry_store.at_row(conn, version["id"], at_iso)
        elif draft and can_edit and can_structure and not at_iso:
            geometry_row = geometry_store.draft_row(conn, version["id"]) or geometry_store.published_row(conn, version["id"])
        else:
            geometry_row = geometry_store.published_row(conn, version["id"])
    geometry = geometry_store.ref(geometry_row)
    levels = geometry_store.levels_of(geometry_row)
    circuits = [] if camera_only else geometry_store.circuits_of(geometry_row)
    # CR-009: the rooms other floors share with this one - their zones, anchors and circuits in this plan's coordinates
    # (the structure itself comes with the geometry document); a reader denied on the home floor gets none (deny wins)
    share_mode = "at" if (at_iso and history == "exact") else ("draft" if geometry_row is not None and geometry_row["status"] == "draft" else "published")
    share_at = at_iso if share_mode == "at" else None
    can_attach = lambda hf: authorize(conn, principal, "map.read", ("floor", hf)).reason != "explicit_deny"  # noqa: E731
    mirrored_zones, mirrored = shared_spaces.bundle_parts(conn, floor_id, version, share_at, can_attach=can_attach)
    mirrored = [(a, o) for a, o in mirrored if (cam_scope.allows(a["resource_id"]) if a["resource_type"] == "camera" else not camera_only)]
    if not camera_only:
        from ..services import plan_geometry as _pg

        circuits = circuits + [k for k in shared_spaces.mirrored_circuits(conn, floor_id, share_mode, share_at, can_attach=can_attach)
                               if isinstance(k.get("switch_entity_id"), str) and _pg.SWITCH_RE.match(k["switch_entity_id"])]
    tag = shared_spaces.shared_tag(conn, floor_id, share_mode, share_at)
    if geometry is not None and tag:
        geometry = {**geometry, "view_hash": f"{geometry['doc_hash']}-s{tag}"}
    # the placement editor lists the cameras it may place (security review T055 B1: cameras it already reaches, or
    # every camera but its denied ones for an installation-wide placement.edit holder) plus the ones it sees here; a
    # viewer's list is the visible cameras on this map (below)
    placeable = camera_reach_for_placement(conn, principal) if can_edit else None
    cameras = {r["id"]: camera_row(r) for r in conn.execute("SELECT * FROM cameras ORDER BY sort_order, channel").fetchall()
               if cam_scope.allows(r["id"]) or (placeable is not None and placeable.allows(r["id"]))}
    from ..services import ha_bridge, ha_history, ha_sync

    entity_ids = sorted({a["resource_id"] for a in [*anchors, *(m[0] for m in mirrored)] if a["resource_type"] == "ha_entity"})
    entities: dict[str, Any] = {}
    ha_hist = None
    if entity_ids:
        can_control = authorize(conn, principal, "ha.entity.control", ("floor", floor_id)).allowed
        states_at = ha_history.state_at(conn, entity_ids, at_iso) if at_iso else {}
        if at_iso and str(read_settings(conn).get("history.ha_secondary", "false")) == "true":
            # S2: the Home Assistant recorder fills what the local history does not know (marked as a secondary source)
            missing = [e for e in entity_ids if not states_at.get(e, {}).get("known")]
            if missing:
                states_at.update(ha_history.recorder_state_at(missing, at_iso))
        if at_iso and str(read_settings(conn).get("history.ha_secondary", "false")) == "true":
            # S2: the Home Assistant recorder fills what the local history does not know (marked as a secondary source)
            missing = [e for e in entity_ids if not states_at.get(e, {}).get("known")]
            if missing:
                states_at.update(ha_history.recorder_state_at(missing, at_iso))
        for r in conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' * len(entity_ids))})", entity_ids).fetchall():
            e = ha_sync.entity_row(r)
            e["actions"] = ha_bridge.actions_for(e["domain"]) if (can_control and not at_iso) else []
            if at_iso:
                # historical bundle: the live state is not the answer; state_at is (known only when the history covers t)
                e["state_at"] = states_at.get(e["entity_id"], {"state": None, "changed_at": None, "known": False, "reason": "אין היסטוריה"})
                e["state"] = None
            entities[e["entity_id"]] = e
    if at_iso:
        ha_hist = ha_history.coverage(conn)
    circuit_states: dict[str, Any] = {}
    if circuits:
        # The switch of a circuit is the live state of its lamps (design 2a, rule 2). Control mirrors the entity
        # action route's own scope check exactly (_entity_allowed - placement or installation-wide), never a bare
        # floor-scoped permission: a draft circuit is not yet validated against Home Assistant's catalogue (the
        # switch/light shape check is an error-severity but non-structural issue, so it blocks publish but not saving
        # the draft) and may name any entity id, so its state is shown only once the switch is placed (an anchor, or a
        # published circuit) or the caller already holds entity.state.read on it directly - a published document's
        # circuits are always already placed, so reading one needs nothing beyond the floor's map.read (review R1).
        from .ha import _entity_allowed

        is_draft_geometry = geometry_row is not None and geometry_row["status"] == "draft"
        switch_ids = sorted({c["switch_entity_id"] for c in circuits})
        rows = {r["entity_id"]: ha_sync.entity_row(r) for r in conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' * len(switch_ids))})", switch_ids).fetchall()}
        hist = ha_history.state_at(conn, switch_ids, at_iso) if at_iso else {}
        for c in circuits:
            eid = c["switch_entity_id"]
            e = rows.get(eid)
            control = bool(not at_iso and e is not None and not e["removed_at"] and not e["disabled"] and _entity_allowed(conn, principal, eid, "ha.entity.control"))
            readable = (not is_draft_geometry) or control or _entity_allowed(conn, principal, eid, "entity.state.read")
            past = hist.get(eid, {})
            state = (past.get("state") if at_iso else (e["state"] if e else None)) if readable else None
            known = (bool(past.get("known")) if at_iso else e is not None) if readable else False
            circuit_states[c["id"]] = {
                "entity_id": eid, "name": c.get("name"), "color_token": c.get("color_token"), "member_ids": list(c.get("member_ids") or []), "power_w": c.get("power_w"),
                "state": state, "known": known, "fresh": bool(e and e["fresh"]) and not at_iso and readable, "available": bool(e and e["available"]) and readable,
                "can_control": control,
                "actions": [a for a in ha_bridge.actions_for(e["domain"]) if a["id"].endswith(("turn_on", "turn_off"))] if control else [],
            }
    b = get_building(conn, f["building_id"])
    s = get_site(conn, b["site_id"])
    return {
        "floor": floor_row(conn, f),
        "building": building_row(b),
        "site": site_row(s),
        "plan": version_row(version) if version else None,
        "geometry": geometry,
        "catalog_revision": plan_catalog.revision(conn),
        "levels": levels,
        "circuit_states": circuit_states,
        "anchors": [dict(anchor_row(a), camera=cameras.get(a["resource_id"]) if a["resource_type"] == "camera" else None, entity=entities.get(a["resource_id"]) if a["resource_type"] == "ha_entity" else None) for a in anchors]
                   + [dict(anchor_row(a), **over, camera=cameras.get(a["resource_id"]) if a["resource_type"] == "camera" else None, entity=entities.get(a["resource_id"]) if a["resource_type"] == "ha_entity" else None)
                      for a, over in mirrored],
        "ha_sync": ha_sync.STATE.as_dict(),
        "zones": [] if camera_only else _marked_zones(conn, floor_id) + mirrored_zones,
        "reach": reach,
        "needs_alignment": needs_alignment(conn, version, anchors),
        "at": at_iso,
        "history": history,
        "history_from": history_from,
        "ha_history": ha_hist,
        "permissions": {"edit": can_edit, "publish": can_publish, "import": authorize(conn, principal, "map.import", ("floor", floor_id)).allowed,
                        "structure": can_structure},
        # the placement editor's list: exactly the cameras it may place (placement.edit on their chain, T055 re-review)
        "cameras": [c for c in cameras.values() if placeable.allows(c["id"])] if placeable is not None else [c for c in cameras.values() if any(a["resource_id"] == c["id"] for a in [*anchors, *(m[0] for m in mirrored)])],
    }


class AnchorIn(BaseModel):
    resource_type: str = Field(pattern="^(camera|ha_entity)$")
    resource_id: str = Field(min_length=1, max_length=120)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    rotation_degrees: float = Field(default=0, ge=0, lt=360)
    field_of_view_degrees: float | None = Field(default=None, gt=0, le=360)
    layer_id: str = Field(default="cameras", max_length=40)
    level_id: str | None = Field(default=None, max_length=64)  # free text: not checked against the document's levels
    label: str | None = Field(default=None, max_length=120)
    coverage_radius: float | None = Field(default=None, gt=0, le=1)  # fraction of the plan width
    coverage_polygon: list[list[float]] | None = None  # [[x, y], ...] normalized
    mount_height_m: float | None = Field(default=None, ge=0, le=30)  # metres above the level's floor (T087); null = the kind's default
    tilt_deg: float | None = Field(default=None, ge=-90, le=90)  # positive = down
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")


class AnchorPatch(BaseModel):
    revision: int = Field(ge=1)
    x: float | None = Field(default=None, ge=0, le=1)
    y: float | None = Field(default=None, ge=0, le=1)
    rotation_degrees: float | None = Field(default=None, ge=0, lt=360)
    field_of_view_degrees: float | None = Field(default=None, gt=0, le=360)
    layer_id: str | None = Field(default=None, max_length=40)
    level_id: str | None = Field(default=None, max_length=64)  # free text: not checked against the document's levels
    label: str | None = Field(default=None, max_length=120)
    # coverage: an explicit null clears it (back to the default cone); absent = unchanged
    coverage_radius: float | None = Field(default=None, gt=0, le=1)
    coverage_polygon: list[list[float]] | None = None
    mount_height_m: float | None = Field(default=None, ge=0, le=30)  # metres above the level's floor (T087); null = the kind's default
    tilt_deg: float | None = Field(default=None, ge=-90, le=90)  # positive = down
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")
    label_pos: str | None = Field(default=None, pattern="^(auto|top|bottom|left|right)$")


@router.get("/floors/{floor_id}/anchors")
def list_anchors(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "map.read", ("floor", floor_id))
    rows = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY layer_id, resource_id", (floor_id,)).fetchall()
    scope = camera_scope(conn, principal, "map.read")  # T055: a denied camera's anchor is not listed
    return {"anchors": [anchor_row(r) for r in rows if r["resource_type"] != "camera" or scope.allows(r["resource_id"])]}


def _shared_error(exc: Exception) -> ApiError:
    return ApiError(exc.status, exc.code, exc.message, details=exc.details)  # type: ignore[attr-defined]


@router.post("/floors/{floor_id}/anchors", status_code=201)
def create_anchor(floor_id: str, body: AnchorIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    get_floor(conn, floor_id)
    require(conn, principal, "placement.edit", ("floor", floor_id))
    from ..services import shared_spaces

    via_floor_id: str | None = None
    hit = shared_spaces.room_at(conn, floor_id, body.x, body.y)
    if hit is not None:
        # CR-009: a camera or device placed inside a room another floor shares with this one belongs to that room - it is
        # created on the room's home floor (placement.edit here is decision 1's grant) and every floor that shows the
        # room shows it
        share, place = hit
        via_floor_id, floor_id = floor_id, share.home_floor_id
        hx, hy = place.inv(body.x, body.y)
        body.x, body.y = round(min(1.0, max(0.0, hx)), 6), round(min(1.0, max(0.0, hy)), 6)
        body.rotation_degrees = place.iangle(body.rotation_degrees) % 360
        body.level_id = None
        if body.coverage_polygon is not None:
            body.coverage_polygon = [place.ipt(p) for p in body.coverage_polygon]
        if body.coverage_radius is not None and not place.same:
            body.coverage_radius = min(1.0, body.coverage_radius / place.k)
    version = _editor_version(conn, floor_id)
    if not version:
        raise conflict("no_plan", "לקומה אין תוכנית; העלה תוכנית לפני הצבת פריטים.")
    if body.resource_type == "camera" and not conn.execute("SELECT 1 FROM cameras WHERE id = ?", (body.resource_id,)).fetchone():
        raise ApiError(422, "validation", "המצלמה אינה רשומה במערכת.")
    if body.resource_type == "camera":
        # T055 B1: placing a camera widens who reaches it - only an editor who already reaches it on its current chain
        # (or holds placement.edit installation-wide, minus its denied cameras) may put it on this floor
        require_camera_placement(conn, principal, body.resource_id)
    if body.resource_type == "ha_entity":
        ent = conn.execute("SELECT domain FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (body.resource_id,)).fetchone()
        if not ent:
            raise ApiError(422, "validation", "ההתקן אינו בקטלוג המערכת.")
        if body.layer_id == "cameras":  # default layer by domain unless the editor chose one
            body.layer_id = "doors" if ent["domain"] in ("lock", "cover") else "lights" if ent["domain"] in ("light", "switch", "fan") else "sensors"
    dup = conn.execute("SELECT id FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND resource_type = ? AND resource_id = ?", (floor_id, body.resource_type, body.resource_id)).fetchone()
    if dup:
        raise conflict("already_placed", "הפריט כבר מוצב על הקומה הזו.", anchor_id=dup["id"])
    aid, now = new_id(), now_iso()
    conn.execute(
        """INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at, coverage_radius, coverage_polygon, label_pos, level_id, mount_height_m, tilt_deg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (aid, floor_id, version["id"], body.resource_type, body.resource_id, body.x, body.y, body.rotation_degrees, body.field_of_view_degrees, body.layer_id, body.label, now, principal.user_id, principal.user_id, now,
         body.coverage_radius, _check_polygon(body.coverage_polygon), body.label_pos, body.level_id or None, body.mount_height_m, body.tilt_deg),
    )
    audit(conn, actor=principal, action="anchor.create", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"anchor_id": aid, "resource": f"{body.resource_type}:{body.resource_id}", "x": body.x, "y": body.y, **({"via_floor_id": via_floor_id} if via_floor_id else {})})
    return anchor_row(get_anchor(conn, aid))


def _anchor_edit_scope(conn: sqlite3.Connection, principal: Principal, a: sqlite3.Row, from_floor_id: str | None):
    """The floor whose placement.edit authorizes an edit of this anchor and, for an edit made on another floor's map
    (CR-009 decision 1: a shared room is edited from either floor), the share and placement it goes through."""
    if not from_floor_id or from_floor_id == a["floor_id"]:
        require(conn, principal, "placement.edit", ("floor", a["floor_id"]))
        return None
    from ..services import shared_spaces

    get_floor(conn, from_floor_id)
    try:
        share, place = shared_spaces.anchor_via(conn, a, from_floor_id)
    except shared_spaces.SharedEditError as exc:
        raise _shared_error(exc)
    require(conn, principal, "placement.edit", ("floor", from_floor_id))
    return share, place


class RealignIn(BaseModel):
    mode: str = Field(pattern="^(crop|accept)$")


@router.post("/floors/{floor_id}/anchors/realign")
def realign_anchors(floor_id: str, body: RealignIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """S4: items placed on an earlier plan version. `crop` maps them through the two crops when both versions come from
    the same asset / page / rotation (a re-crop keeps the drawing, so the maths is exact); `accept` re-stamps them on the
    current version after the editor checked them by eye. Anything else is left for the editor."""
    get_floor(conn, floor_id)
    require(conn, principal, "placement.edit", ("floor", floor_id))
    version = _editor_version(conn, floor_id) or _current_version(conn, floor_id)
    if not version:
        raise conflict("no_plan", "לקומה אין תוכנית.")
    versions = {r["id"]: r for r in conn.execute("SELECT * FROM plan_versions WHERE floor_id = ?", (floor_id,)).fetchall()}
    anchors = conn.execute("SELECT * FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL AND plan_version_id != ?", (floor_id, version["id"])).fetchall()
    moved: list[str] = []
    skipped: list[str] = []
    now = now_iso()
    nc = json.loads(version["crop_json"]) if version["crop_json"] else {"x": 0, "y": 0, "w": 1, "h": 1}
    for a in anchors:
        old = versions.get(a["plan_version_id"])
        if body.mode == "crop":
            same_drawing = old is not None and old["asset_id"] == version["asset_id"] and old["page"] == version["page"] and old["rotation"] == version["rotation"]
            if not same_drawing:
                skipped.append(a["id"])
                continue
            oc = json.loads(old["crop_json"]) if old["crop_json"] else {"x": 0, "y": 0, "w": 1, "h": 1}
            sx, sy = oc["x"] + a["x"] * oc["w"], oc["y"] + a["y"] * oc["h"]
            nx, ny = (sx - nc["x"]) / nc["w"], (sy - nc["y"]) / nc["h"]
            nx, ny = round(max(0.0, min(1.0, nx)), 4), round(max(0.0, min(1.0, ny)), 4)
            conn.execute("UPDATE map_anchors SET x = ?, y = ?, plan_version_id = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (nx, ny, version["id"], principal.user_id, now, a["id"]))
        else:
            conn.execute("UPDATE map_anchors SET plan_version_id = ?, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (version["id"], principal.user_id, now, a["id"]))
        moved.append(a["id"])
    audit(conn, actor=principal, action="anchor.realign", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"mode": body.mode, "version_id": version["id"], "moved": len(moved), "skipped": len(skipped)})
    return {"mode": body.mode, "version_id": version["id"], "moved": len(moved), "skipped": len(skipped), "needs_alignment": bool(skipped)}


@router.patch("/map-anchors/{anchor_id}")
def update_anchor(anchor_id: str, body: AnchorPatch, request: Request, from_floor_id: str | None = None, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = get_anchor(conn, anchor_id)
    via = _anchor_edit_scope(conn, principal, a, from_floor_id)
    if a["resource_type"] == "camera":
        require_camera_placement(conn, principal, a["resource_id"])  # T055 B1: moves only a camera the editor reaches
    if body.revision != a["revision"]:
        raise conflict("stale_revision", "העוגן השתנה בינתיים; טען מחדש ובחר איך למזג.", current_revision=a["revision"], sent_revision=body.revision)
    if via is not None:
        # the other floor's map coordinates back to the home plan (CR-009); the anchor stays inside the room
        from ..services import shared_spaces

        share, place = via
        if body.x is not None or body.y is not None:
            hx, hy = place.inv(body.x if body.x is not None else place.fwd(a["x"], a["y"])[0], body.y if body.y is not None else place.fwd(a["x"], a["y"])[1])
            if not shared_spaces.anchor_in_room(hx, hy, share, shared_spaces._anchor_tol(conn, share.home_floor_id)) or not (0 <= hx <= 1 and 0 <= hy <= 1):
                raise ApiError(422, "shared_outside", "אפשר להזיז מכאן רק בתוך החלל המשותף; את השאר ערוך בקומה שלו.")
            body.x, body.y = round(hx, 6), round(hy, 6)
        if body.rotation_degrees is not None:
            body.rotation_degrees = place.iangle(body.rotation_degrees) % 360
        if body.coverage_polygon is not None:
            body.coverage_polygon = [place.ipt(p) for p in body.coverage_polygon]
        if body.coverage_radius is not None and not place.same:
            body.coverage_radius = min(1.0, body.coverage_radius / place.k)
        if body.level_id is not None:
            body.level_id = shared_spaces.un_ns(share.home_floor_id, body.level_id) if str(body.level_id).startswith(f"{share.home_floor_id}:") else ""
    fields = {k: v for k, v in body.model_dump().items() if k != "revision" and (v is not None or (k in NULLABLE_KEYS and k in body.model_fields_set))}
    if "coverage_polygon" in fields:
        fields["coverage_polygon"] = _check_polygon(fields["coverage_polygon"])
    if "level_id" in fields:
        fields["level_id"] = fields["level_id"] or None  # "" clears: back to the floor's default level
    fields = {k: v for k, v in fields.items() if a[k] != v}  # an unchanged value is no change
    if not fields:
        return anchor_row(a)  # nothing changed: no revision bump, no audit row (ruling R-P4-T3-1)
    before = {k: a[k] for k in fields}
    sets = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE map_anchors SET {sets}, revision = revision + 1, updated_by = ?, updated_at = ? WHERE id = ?", (*fields.values(), principal.user_id, now_iso(), anchor_id))
    audit(conn, actor=principal, action="anchor.update", decision="allowed", resource_type="floor", resource_id=a["floor_id"], request_id=_rid(request),
          details={"anchor_id": anchor_id, "before": before, "after": fields, **({"via_floor_id": from_floor_id} if via is not None else {})})
    return anchor_row(get_anchor(conn, anchor_id))


@router.delete("/map-anchors/{anchor_id}", status_code=204)
def delete_anchor(anchor_id: str, request: Request, from_floor_id: str | None = None, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> None:
    a = get_anchor(conn, anchor_id)
    via = _anchor_edit_scope(conn, principal, a, from_floor_id)
    if a["resource_type"] == "camera":
        # T055 B1: taking a camera off a floor can lift a deny that sat on that floor - the same reach as placing it
        require_camera_placement(conn, principal, a["resource_id"])
    now = now_iso()
    conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, principal.user_id, now, anchor_id))
    from ..services import geometry_store

    unbound = geometry_store.unbind_anchor(conn, a["floor_id"], a["resource_type"], a["resource_id"], principal.user_id, now,
                                           last={"x": a["x"], "y": a["y"], "rotation": a["rotation_degrees"] or 0})  # its bodies stay where the anchor was, unbound
    audit(conn, actor=principal, action="anchor.delete", decision="allowed", resource_type="floor", resource_id=a["floor_id"], request_id=_rid(request),
          details={"anchor_id": anchor_id, "resource": f"{a['resource_type']}:{a['resource_id']}", "unbound_bodies": unbound, **({"via_floor_id": from_floor_id} if via is not None else {})})
