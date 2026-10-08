"""Plan Studio API (T084, CR-003): the structure document of a plan version - draft autosave, publish, diff, history,
timeline, rollback, copy from another version - and the version's two-point calibration. Drafts need map.edit on the
floor; published documents are readable with map.read, like the plan image itself."""
from __future__ import annotations

import concurrent.futures
import json
import sqlite3
import time
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, StringConstraints

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import new_id, now_iso, rollback_and_restart, unlocked
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, authorize, require
from ..services import geometry_store as store
from ..services import plan_anchor_scope as anchor_scope
from ..services import plan_catalog
from ..services import plan_detect
from ..services import shared_spaces
from ..services import plan_geometry as pg
from ..services import plan_geometry_render as render
from ..services.access import floor_reach, require_floor_read
from ..services.timeutil import parse_utc
from .catalog import get_floor
from .plans import get_version, version_row
from .zones import floor_zones

router = APIRouter()
NO_CACHE = {"Cache-Control": "private, no-cache"}
DETECT_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="plan-detect")
# the door tool's clicks (T087) have a worker of their own: a 60 s detection by another editor never makes them wait
DOOR_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="door-proposal")


def shutdown_detect_pool() -> None:
    """The app's stop hook: queued runs are cancelled and a running one is not waited for. The stop does not stop a
    running worker: it goes on until it finishes or its own deadline passes, so at most detect_timeout_s after its
    request. A fresh pool takes the old one's place (threads start only on the first submit), so an app created again
    in the same process - the test suite - still detects."""
    global DETECT_POOL, DOOR_POOL
    old, DETECT_POOL = DETECT_POOL, concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="plan-detect")
    old.shutdown(wait=False, cancel_futures=True)
    old_door, DOOR_POOL = DOOR_POOL, concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="door-proposal")
    old_door.shutdown(wait=False, cancel_futures=True)


def _layers(raw: str | None) -> set[str] | None:
    """?layers=structure,objects,labels,connectors - any subset; an unknown name is a 422. An empty value (?layers=
    or ?layers=,) means all layers, the same as omitting the parameter - not a blank export."""
    if raw is None:
        return None
    chosen = {x.strip() for x in raw.split(",") if x.strip()}
    unknown = sorted(chosen - set(render.LAYERS))
    if unknown:
        raise ApiError(422, "validation", "שכבות לא מוכרות בייצוא.", details={"unknown": unknown, "layers": list(render.LAYERS)})
    return chosen or None


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _floor(v: sqlite3.Row) -> tuple[str, str]:
    return ("floor", v["floor_id"])


def _far_ctx(conn: sqlite3.Connection, principal: Principal | None, published: bool = False) -> store.FarContext:
    """One cache of the other floors per request (review M5); names only of floors the reader may read (review L12)."""
    return store.FarContext(conn, published=published, can_read=(lambda fid: floor_reach(conn, principal, fid) is not None) if principal is not None else None)


def _can_attach(conn: sqlite3.Connection, principal: Principal | None):
    """CR-009 §6: a shared room's content is attached for every reader of the other floor except one explicitly denied
    map.read on the room's home floor (deny wins)."""
    if principal is None:
        return None
    return lambda home_floor_id: authorize(conn, principal, "map.read", ("floor", home_floor_id)).reason != "explicit_deny"


def _shown(conn: sqlite3.Connection, principal: Principal | None, floor_id: str, doc: dict[str, Any], ctx: store.FarContext, mode: str,
           at: str | None = None, circuits: bool = True) -> dict[str, Any]:
    return _shown_r(conn, principal, floor_id, doc, ctx, mode, at, circuits)[0]


def _shown_r(conn: sqlite3.Connection, principal: Principal | None, floor_id: str, doc: dict[str, Any], ctx: store.FarContext, mode: str,
             at: str | None = None, circuits: bool = True) -> tuple[dict[str, Any], bool]:
    """What a reader gets of a stored document: `far` on its cross-floor connectors (T085 review M4) and the rooms other
    floors share with it (CR-009) - both computed now, neither stored - and (PLNS) without the anchor references the
    reader may not see (services/plan_anchor_scope.py). Returns (document, whether a reference was withheld)."""
    can_name = (lambda fid: floor_reach(conn, principal, fid) is not None) if principal is not None else None  # review L1: names of readable floors only
    shown = shared_spaces.attach(conn, floor_id, store.attach_far(conn, floor_id, doc, ctx), mode, at, can_attach=_can_attach(conn, principal), circuits=circuits,
                                 can_name=can_name)
    return anchor_scope.redact(shown, anchor_scope.visibility(conn, principal, floor_id))


def _carry_hidden(conn: sqlite3.Connection, principal: Principal, v: sqlite3.Row, incoming: dict[str, Any], stored: dict[str, Any] | None) -> dict[str, Any]:
    """PLNS: a writer's document keeps the references they were not shown; a new one to a hidden anchor is a 422."""
    try:
        return anchor_scope.carry_hidden(incoming, stored, anchor_scope.visibility(conn, principal, v["floor_id"]), anchor_scope.exists_here(conn, v["floor_id"]),
                                         strict=True)[0]
    except anchor_scope.HiddenAnchor as exc:
        raise ApiError(422, "anchor_hidden", "אין לך הרשאה לקשר פריט לעוגן הזה.", details={"ids": exc.items[:50]})


def _shared_fix(conn: sqlite3.Connection, principal: Principal, v: sqlite3.Row):
    """PLNS for the items of a room another floor shares with this one (CR-009): the item as the home floor holds it
    (`cur`, None for a new one) gives back the references this writer was not shown; a new hidden one is a 422."""
    visible = anchor_scope.visibility(conn, principal, v["floor_id"])
    if visible is None:
        return None
    exists = anchor_scope.exists_here(conn, v["floor_id"])

    def fix(coll: str, cur: dict[str, Any] | None, item: dict[str, Any]) -> dict[str, Any]:
        dropped: list[str] = []
        out = anchor_scope.fix_item(cur, item, coll, visible, exists, dropped)
        if dropped:
            raise anchor_scope.HiddenAnchor(dropped)
        return out

    return fix


def _stored_doc(conn: sqlite3.Connection, v: sqlite3.Row) -> dict[str, Any] | None:
    """The stored document a draft save replaces: the draft, else the published structure the editor started from."""
    row = store.draft_row(conn, v["id"]) or store.published_row(conn, v["id"])
    return store.load_doc(row) if row is not None else None


def _payload(conn: sqlite3.Connection, version: sqlite3.Row, row: sqlite3.Row | None, doc: dict[str, Any], principal: Principal | None = None,
             published: bool = False, ctx: store.FarContext | None = None, shown: dict[str, Any] | None = None) -> dict[str, Any]:
    """The document as the reader gets it - with `far` on its cross-floor connectors, computed now (review M4), and the
    shared rooms attached (CR-009) - and its issues. `ctx` / `shown`: what the caller already computed (the published
    read computes both first, for its ETag)."""
    ctx = ctx or _far_ctx(conn, principal, published)
    shown = shown if shown is not None else _shown(conn, principal, version["floor_id"], doc, ctx, "published" if published else "draft")
    published_now = store.published_row(conn, version["id"])
    geometry = store.row_api(row) if row is not None else {
        "id": None, "plan_version_id": version["id"], "floor_id": version["floor_id"], "status": "new", "revision": 0, "doc_hash": store.doc_hash(doc),
        "created_at": None, "updated_at": None, "published_at": None, "published_by": None, "archived_at": None,
    }
    # CR-009: two real outlines check the placement - the lower one must fall inside the upper one
    misaligned = [{"code": "shared_alignment", "severity": "warning", "structural": False, "id": e.get("zone_id"), "path": "shared_spaces",
                   "message": "ודא את יישור הקומות: המתאר התחתון של החלל המשותף לא נופל בתוך המתאר העליון."}
                  for e in shown.get("shared_spaces") or [] if e.get("aligned") is False]
    out = {"geometry": geometry, "doc": shown,
            "issues": [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if not i["structural"]] + store.anchor_issues(conn, version["floor_id"], doc)
            + store.link_issues(conn, version["floor_id"], doc, ctx) + misaligned,
            "published_hash": published_now["doc_hash"] if published_now is not None else None}
    if not published and principal is not None and any(e.get("role") == "mirror" for e in shown.get("shared_spaces") or []) and _is_editor_version(conn, version):
        # the editor's publish button: the shared room's changes waiting on the home floor count as something to publish
        out["shared_pending"] = shared_spaces.shared_pending(conn, version["floor_id"], can_write=_can_publish_home(conn, principal),
                                                             can_name=lambda fid: floor_reach(conn, principal, fid) is not None, validate=False)
    return out


def _far_tag(doc: dict[str, Any]) -> str:
    """The part of a published read's ETag that follows the other floors (their names, levels and heights change the
    `far` of this document without changing its hash): empty when the document links no other floor. It hashes only the
    `far` the reader gets, so it tells nothing of a floor the reader may not read (review L-d)."""
    fars = [c.get("far") for c in doc.get("connectors") or [] if isinstance(c, dict) and c.get("far") is not None]
    return "" if not fars else "-f" + store.doc_hash({"far": fars})[:12]


def _shared_tag(doc: dict[str, Any]) -> str:
    """CR-009: the part of the ETag that follows the shared rooms - the home floor's document hash, the placement, the
    polygon and the names each entry carries - as this reader gets them (a reader denied the home floor gets none)."""
    entries = doc.get("shared_spaces")
    if not entries:
        return ""
    # review L1: exactly what this reader gets of the shared rooms - the entries and the attached content - so a publish
    # of the home floor that does not touch the room leaves the ETag as it was
    items = [i for c in (*shared_spaces.MARKED_COLLECTIONS, "levels") for i in doc.get(c) or [] if isinstance(i, dict) and "shared" in i]
    return "-s" + store.doc_hash({"shared": entries, "items": items})[:12]


def _editable(conn: sqlite3.Connection, principal: Principal, version_id: str) -> sqlite3.Row:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לעריכה; שחזר אותה קודם.")
    return v


@router.get("/plan-versions/{version_id}/geometry", response_model=None)
def get_geometry(version_id: str, request: Request, draft: bool = False, at: str | None = None,
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Any:
    v = get_version(conn, version_id)
    if draft:
        require(conn, principal, "map.edit", _floor(v))
        doc, row = store.working_doc(conn, v)
        body = _payload(conn, v, row, doc, principal)
        if pg.is_empty(doc):
            body["copy_candidates"] = store.copy_candidates(conn, v)
        return body
    if v["status"] == "draft":
        require(conn, principal, "map.edit", _floor(v))
        reach = "floor"
    else:
        reach = require_floor_read(conn, principal, v["floor_id"])  # T055: camera-scoped readers get the drawing only
    iso: str | None = None
    if at:
        try:
            iso = parse_utc(at).strftime("%Y-%m-%dT%H:%M:%SZ")
        except (ValueError, OverflowError):  # an extreme offset (9999-12-31T23:59:59-01:00) overflows the UTC conversion
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
        row = store.at_row(conn, v["id"], iso)
    else:
        row = store.published_row(conn, v["id"])
    if row is None:
        raise not_found("אין מבנה מפורסם לגרסה הזו.")
    # the walls, rooms and openings locate the camera; the circuits name HA entities a camera reader holds nothing on
    doc = store.load_doc(row) if reach == "floor" else {k: v2 for k, v2 in store.load_doc(row).items() if k != "circuits"}
    # review L-d: only `far` and the shared rooms are computed before the 304 check (the ETag follows them); issues and
    # the rest only on a 200
    ctx = _far_ctx(conn, principal, published=True)
    shown, redacted = _shown_r(conn, principal, v["floor_id"], doc, ctx, "at" if iso else "published", iso, circuits=reach == "floor")
    tags = f"{_far_tag(shown)}{_shared_tag(shown)}"
    # PLNS: with a reference withheld the body is not the stored document - the ETag then follows what is served (a
    # change of the reader's camera scope changes it), never the stored hash another reader's cached copy carries
    base = f"{store.doc_hash(shown)}-r" if redacted else row["doc_hash"]
    etag = f'"{base}{tags}"' if reach == "floor" else f'"{base}{tags}-c"'
    headers = {"ETag": etag, **NO_CACHE}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    body = _payload(conn, v, row, doc, principal, published=True, ctx=ctx, shown=shown)
    if reach != "floor":
        body = {**body, "issues": [], "reach": reach}
    return JSONResponse(body, headers=headers)


class GeometryPut(BaseModel):
    doc: dict[str, Any]
    base_revision: int = Field(ge=0)


@router.put("/plan-versions/{version_id}/geometry")
def put_geometry(version_id: str, body: GeometryPut, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = _editable(conn, principal, version_id)
    # CR-009: the items of a room another floor shares with this one are split off first - the floor's own items are
    # validated and stored as always, the shared ones are routed to the home floor's draft (map.edit here is decision 1's
    # grant: either floor edits the room). Every refusal comes before the first write (an API error still commits).
    own, shared_items, echoed, deleted = shared_spaces.split(body.doc)
    own = _carry_hidden(conn, principal, v, own, _stored_doc(conn, v))  # PLNS: before any write
    structural = [i for i in pg.validate(own) if i["structural"]]
    if structural:
        raise ApiError(422, "geometry_structure", "מבנה המסמך אינו תקין; השינוי לא נשמר.", details={"issues": structural[:50]})
    if v["id"] != (store.editor_version(conn, v["floor_id"]) or {"id": None})["id"]:
        shared_items, echoed = {}, {}  # only the floor's editor version shows the mirror; another version routes nothing
    # security review M2: every check before the first write - this floor's revision, then the home floors' plan - and
    # the home writes before this floor's save (its stairs twin sync reads the home drafts afresh after them); any error
    # after a write rolls the whole request back
    d = store.draft_row(conn, v["id"])
    if body.base_revision != (d["revision"] if d is not None else 0):
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=d["revision"] if d is not None else 0, sent_revision=body.base_revision)

    def can_write(home_floor_id: str) -> bool:  # review M1: a deny on the home floor wins over decision 1
        return all(authorize(conn, principal, perm, ("floor", home_floor_id)).reason != "explicit_deny" for perm in ("map.edit", "map.read"))

    try:
        from ..services import alarm, ha_scope

        # review L1: what the alarm section owns is never a circuit's switch from the other floor, whoever holds ha.entity.control
        planned = shared_spaces.plan_edits(conn, v["floor_id"], shared_items, echoed, deleted, can_write=can_write,
                                           can_control=lambda eid: ha_scope.entity_allowed(conn, principal, eid, "ha.entity.control") and not alarm.is_managed_control(conn, eid),
                                           fix=_shared_fix(conn, principal, v))
    except shared_spaces.SharedEditError as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details)
    except anchor_scope.HiddenAnchor as exc:
        raise ApiError(422, "anchor_hidden", "אין לך הרשאה לקשר פריט לעוגן הזה.", details={"ids": exc.items[:50]})
    synced: list[str] = []
    skipped: list[str] = []
    try:
        records = shared_spaces.commit_edits(conn, planned, principal.user_id, now_iso())
        row = store.save_draft(conn, v, own, body.base_revision, principal.user_id, can_edit=lambda fid: authorize(conn, principal, "map.edit", ("floor", fid)).allowed,
                               synced=synced, skipped=skipped)
    except ApiError:
        rollback_and_restart(conn)  # nothing half-written stays (an API error would otherwise commit)
        raise
    for rec in records:
        audit(conn, actor=principal, action="geometry.shared.edit", decision="allowed", resource_type="floor", resource_id=rec["home_floor_id"],
              details={"from_floor_id": v["floor_id"], "version_id": v["id"], **{k: rec[k] for k in ("zone_ids", "changed", "added", "removed")}})
    for fid in synced:  # the stairs model reached the twin on the other floor's draft (review M3)
        audit(conn, actor=principal, action="geometry.connector.twin_sync", decision="allowed", resource_type="floor", resource_id=fid, details={"version_id": v["id"], "from_floor_id": v["floor_id"]})
    body_out = _payload(conn, v, row, store.load_doc(row), principal)
    if skipped:  # review M-a: the stairs there stay as they were; the editor says so (names only of floors the person may read)
        body_out["twins_skipped"] = [{"floor_id": fid, "name": (r["name"] if r is not None and floor_reach(conn, principal, fid) is not None else "קומה אחרת")}
                                     for fid in skipped for r in [conn.execute("SELECT name FROM floors WHERE id = ?", (fid,)).fetchone()]]
    return body_out


class GeomPublishIn(BaseModel):
    """CR-009 re-review low: the shared-space items to leave out of this publish (their published version stays) - the
    ids a 422 `shared_invalid` named."""
    shared_skip: list[str] = Field(default_factory=list, max_length=200)


@router.post("/plan-versions/{version_id}/geometry/publish")
def publish_geometry(version_id: str, request: Request, body: GeomPublishIn | None = None, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", _floor(v))
    if v["status"] == "draft":
        raise conflict("publish_plan_first", "זו טיוטת תוכנית: פרסום הגרסה יפרסם גם את המבנה שלה.")
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לפרסום.")
    # CR-009, owner answer 1 (2026-09-29): publishing the other floor of a shared room also publishes the room's pending
    # changes on its home floor - only the room's content, the rest of the home draft stays a draft. map.publish on the
    # floor being published is the grant; a deny on the home floor leaves it out. Planned (and validated) before any write.
    try:
        shared = shared_spaces.plan_shared_publish(conn, v["floor_id"], can_write=_can_publish_home(conn, principal),
                                                   skip=(body.shared_skip if body is not None else ())) if _is_editor_version(conn, v) else []
    except shared_spaces.SharedEditError as exc:
        raise ApiError(exc.status, exc.code, exc.message, details=exc.details)
    result = store.publish(conn, v, principal.user_id)
    if not result["unchanged"]:
        audit(conn, actor=principal, action="geometry.publish", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "geometry_id": result["published"]["id"], "changes": result["diff"]["total"],
                       "collections": {k: {kk: len(vv) for kk, vv in c.items()} for k, c in result["diff"]["collections"].items()}})
    try:
        done = shared_spaces.commit_shared_publish(conn, shared, principal.user_id, now_iso())
    except ApiError:
        rollback_and_restart(conn)
        raise
    for rec in done:  # owner answer 1: audited on both floors
        audit(conn, actor=principal, action="geometry.shared.publish", decision="allowed", resource_type="floor", resource_id=rec["home_floor_id"], request_id=_rid(request),
              details={"from_floor_id": v["floor_id"], "version_id": v["id"], "zone_ids": rec["zone_ids"], "changes": rec["changes"], "geometry_id": rec["geometry_id"]})
        audit(conn, actor=principal, action="geometry.shared.publish", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"home_floor_id": rec["home_floor_id"], "version_id": v["id"], "zone_ids": rec["zone_ids"], "changes": rec["changes"]})
    result["shared_published"] = [{k: rec[k] for k in ("home_floor_id", "zone_ids", "changes")} for rec in done]
    if done and result["unchanged"]:
        result["unchanged"] = False
    return result


def _is_editor_version(conn: sqlite3.Connection, v: sqlite3.Row) -> bool:
    return v["id"] == (store.editor_version(conn, v["floor_id"]) or {"id": None})["id"]


def _can_publish_home(conn: sqlite3.Connection, principal: Principal):
    return lambda home_floor_id: all(authorize(conn, principal, perm, ("floor", home_floor_id)).reason != "explicit_deny" for perm in ("map.publish", "map.edit", "map.read"))


@router.get("/plan-versions/{version_id}/geometry/diff")
def geometry_diff(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    doc, _ = store.working_doc(conn, v)
    p = store.published_row(conn, v["id"])
    old = store.load_doc(p) if p is not None else None
    return {"diff": pg.diff(old, doc),
            "issues": [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if not i["structural"]] + store.anchor_issues(conn, v["floor_id"], doc),
            "counts": pg.counts(doc), "published_counts": pg.counts(old) if old is not None else None,
            # CR-009: "כולל שינויים בחלל המשותף (קומה -1)" - what the publish of this floor also publishes there
            "shared_pending": shared_spaces.shared_pending(conn, v["floor_id"], can_write=_can_publish_home(conn, principal),
                                                           can_name=lambda fid: floor_reach(conn, principal, fid) is not None) if _is_editor_version(conn, v) else []}


@router.get("/plan-versions/{version_id}/geometry/versions")
def geometry_versions(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    return {"versions": [dict(store.row_api(r), counts=pg.counts(store.load_doc(r))) for r in store.history(conn, v["id"])]}


@router.get("/plan-versions/{version_id}/geometry/timeline")
def geometry_timeline(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """When each published structure of the version was in force - the historical map picks the one of its instant."""
    v = get_version(conn, version_id)
    require_floor_read(conn, principal, v["floor_id"])
    return {"timeline": [{"id": r["id"], "doc_hash": r["doc_hash"], "published_at": r["published_at"], "archived_at": r["archived_at"]}
                         for r in reversed(store.history(conn, v["id"]))]}


class GeometryRollbackIn(BaseModel):
    geometry_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/rollback")
def rollback_geometry(version_id: str, body: GeometryRollbackIn, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", _floor(v))
    if v["status"] != "published":
        raise conflict("not_published", "שחזור מבנה אפשרי בגרסת התוכנית המפורסמת.")
    row = store.rollback(conn, v, body.geometry_id, principal.user_id)
    audit(conn, actor=principal, action="geometry.rollback", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "restored_from": body.geometry_id, "geometry_id": row["id"]})
    return {"published": store.row_api(row)}


class CopyFromIn(BaseModel):
    from_version_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/copy-from")
def copy_geometry(version_id: str, body: CopyFromIn, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = _editable(conn, principal, version_id)
    src = get_version(conn, body.from_version_id)
    if src["floor_id"] != v["floor_id"]:
        raise ApiError(422, "validation", "אפשר להעתיק מבנה רק מגרסה של אותה קומה.")
    row = store.copy_from(conn, v, src, principal.user_id)
    audit(conn, actor=principal, action="geometry.copy", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "from_version_id": src["id"]})
    return _payload(conn, v, row, store.load_doc(row), principal)


class LinkIn(BaseModel):
    connector_id: str = Field(min_length=1, max_length=64)
    floor_id: str = Field(min_length=1, max_length=32)
    # T085: the level the stairs reach on the other floor (one of that floor's levels); absent = its default level
    level_to: str | None = Field(default=None, min_length=1, max_length=64)
    # moving a link to another floor deletes the twin on the old one: the person confirmed it (review B1)
    replace: bool = False


@router.post("/plan-versions/{version_id}/geometry/link")
def link_connector(version_id: str, body: LinkIn, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Stairs / an elevator to another floor: the connector keeps one id in both floors' drafts (map.edit on both)."""
    v = _editable(conn, principal, version_id)
    if body.floor_id == v["floor_id"]:
        raise ApiError(422, "validation", "קשר לקומה אחרת, לא לאותה קומה.")
    target = get_floor(conn, body.floor_id)
    if target["building_id"] != get_floor(conn, v["floor_id"])["building_id"]:
        raise ApiError(422, "validation", "אפשר לקשר רק לקומה באותו בניין.")  # review L11
    require(conn, principal, "map.edit", ("floor", body.floor_id))
    # review B1: every floor the connector names now may lose its twin - the person must be allowed to edit each of them
    for fid in store.connector_floor_ids(conn, v, body.connector_id):
        if fid not in (v["floor_id"], body.floor_id) and conn.execute("SELECT 1 FROM floors WHERE id = ? AND deleted_at IS NULL", (fid,)).fetchone():
            require(conn, principal, "map.edit", ("floor", fid))
    result = store.link_connector(conn, v, body.connector_id, body.floor_id, principal.user_id, level_to=body.level_to, replace=body.replace)
    audit(conn, actor=principal, action="geometry.connector.link", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "connector_id": body.connector_id, "to_floor_id": body.floor_id, "target_version_id": result["target"]["version_id"],
                   "level_to": result["target"]["level_id"], "placement": result["target"]["placement"], "removed_floors": result["removed_floors"]})
    for fid in result["removed_floors"]:
        audit(conn, actor=principal, action="geometry.connector.twin_delete", decision="allowed", resource_type="floor", resource_id=fid, request_id=_rid(request),
              details={"version_id": v["id"], "connector_id": body.connector_id, "from_floor_id": v["floor_id"], "reason": "relink"})
    result["connector"] = next((c for c in store.attach_far(conn, v["floor_id"], {"connectors": [result["connector"]]}, _far_ctx(conn, principal))["connectors"]), result["connector"])
    return result


@router.get("/plan-versions/{version_id}/geometry/link-targets")
def link_targets(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The "מחבר אל" picker (T085): the other floors of this building the person may edit, each with its levels and
    whether its plan shares this plan's frame (a new twin then lands at the same plan coordinates)."""
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    return {"floors": store.link_targets(conn, v, lambda fid: authorize(conn, principal, "map.edit", ("floor", fid)).allowed)}


class TwinDeleteIn(BaseModel):
    connector_id: str = Field(min_length=1, max_length=64)
    floor_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/twin-delete")
def delete_twin(version_id: str, body: TwinDeleteIn, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Deleting cross-floor stairs "גם בקומה השנייה" (T085): the editor removes its own copy (an undoable edit) and asks
    for the twin on the other floor's draft to go too (map.edit on both floors). Only a connector of that id that names
    this floor among its floors is removed; nothing else there changes."""
    v = _editable(conn, principal, version_id)
    if body.floor_id == v["floor_id"]:
        raise ApiError(422, "validation", "התאום נמצא בקומה אחרת, לא באותה קומה.")
    get_floor(conn, body.floor_id)
    require(conn, principal, "map.edit", ("floor", body.floor_id))
    removed = store.remove_twin(conn, body.floor_id, body.connector_id, v["floor_id"], principal.user_id)
    if removed:
        audit(conn, actor=principal, action="geometry.connector.twin_delete", decision="allowed", resource_type="floor", resource_id=body.floor_id, request_id=_rid(request),
              details={"version_id": v["id"], "connector_id": body.connector_id, "from_floor_id": v["floor_id"]})
    return {"removed": removed, "floor_id": body.floor_id}


class CalPair(BaseModel):
    a: list[float] = Field(min_length=2, max_length=2)
    b: list[float] = Field(min_length=2, max_length=2)
    metres: float = Field(gt=0, le=1000)


class EstimateIn(BaseModel):
    scale_m_per_px: float = Field(gt=0, le=10)
    method: str = Field(default="door_width", pattern="^(door_width)$")
    reason: str = Field(default="לפי רוחב דלת אופייני", max_length=200)


class CalibrationIn(BaseModel):
    pairs: list[CalPair] | None = Field(default=None, min_length=1, max_length=4)
    estimate: EstimateIn | None = None
    replace_measured: bool = False  # an estimate over a measured calibration only when the person confirms it


@router.patch("/plan-versions/{version_id}/calibration")
def calibrate(version_id: str, body: CalibrationIn, request: Request, principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Two points and a known distance (more pairs average and expose a distorted scan), or - phase 3 - the estimate the
    detector offers from the door widths, recorded as an estimated calibration (design 6.3: metres then show as
    approximate). Nothing moves on the map: positions are 0..1; only the metres change. Viewers see it after the
    structure is published."""
    v = _editable(conn, principal, version_id)
    if (body.pairs is None) == (body.estimate is None):
        raise ApiError(422, "validation", "שלח pairs (כיול בשתי נקודות) או estimate (הערכה), לא שניהם.")
    now = now_iso()
    residual: float | None
    if body.estimate is not None:
        was_measured = pg.calibration_of(v, None)["status"] == "measured"
        if was_measured and not body.replace_measured:
            raise conflict("calibration_measured", "לתוכנית כבר יש כיול מדוד; הערכה תחליף אותו רק באישור (replace_measured).")
        scale, residual, status = body.estimate.scale_m_per_px, None, "estimated"
        record: dict[str, Any] = {"method": body.estimate.method, "status": status, "pairs": [], "residual_pct": None, "reason": body.estimate.reason, "at": now, "by": principal.user_id}
        details: dict[str, Any] = {"version_id": v["id"], "method": body.estimate.method, "status": status, "scale_m_per_px": scale, "replaced_measured": was_measured}
    else:
        pairs = body.pairs or []
        if any(not 0 <= c <= 1 for p in pairs for c in (*p.a, *p.b)):
            raise ApiError(422, "validation", "נקודות הכיול חייבות להיות בתוך התוכנית.")
        try:
            scale, residual = pg.two_point_scale([(p.a, p.b, p.metres) for p in pairs], v["width_px"], v["height_px"])
        except ValueError:
            raise ApiError(422, "validation", "שתי הנקודות קרובות מדי זו לזו; בחר נקודות רחוקות יותר.")
        status = "measured"
        record = {"method": "two_point", "status": status, "pairs": [{"a": [round(p.a[0], 6), round(p.a[1], 6)], "b": [round(p.b[0], 6), round(p.b[1], 6)], "metres": p.metres} for p in pairs],
                  "residual_pct": residual, "reason": None, "at": now, "by": principal.user_id}
        details = {"version_id": v["id"], "method": "two_point", "status": status, "scale_m_per_px": scale, "residual_pct": residual, "pairs": len(pairs)}
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ?, revision = revision + 1 WHERE id = ?",
                 (scale, json.dumps(record, ensure_ascii=False), v["id"]))
    v2 = get_version(conn, v["id"])
    doc, row = store.working_doc(conn, v2)
    store.save_draft(conn, v2, doc, row["revision"] if row is not None else 0, principal.user_id, now)
    audit(conn, actor=principal, action="plan.calibrate", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request), details=details)
    warning = "הזוגות לא מסכימים ביניהם ביותר מ־3%: ייתכן שהסריקה מעוותת. כייל שוב או הוסף זוג." if residual is not None and residual > 3 else None
    return {"version": version_row(v2), "scale_m_per_px": scale, "residual_pct": residual, "warning": warning, "status": status}


# ---------------------------------------------------------------- detection (phase 3, T086)

CandidateId = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class DetectIn(BaseModel):
    targets: list[str] = Field(default=["walls", "openings"], min_length=1, max_length=4)
    strength: float = Field(default=0.6, ge=0.3, le=1.0)
    level_id: str | None = Field(default=None, max_length=64)
    # T087: "arc_v2" adds the door-symbol search that needs no gap (plan_detect_doors); off by default
    door_model: Literal["gap", "arc_v2"] = "gap"
    # T087: the hollow-wall pass (plan_detect_hollow, walls drawn as two thin lines); on by default, a plan opts out
    hollow_walls: bool = True
    # T086 tuning (detector 1.4, the 0.1.90 list items 3-6), each on by default, a plan opts out: section-cut lines
    # crossing into the building are no walls; a white gap under 0.3 m with no symbol is no passage; a tribune is
    # proposed as a steps object; a pier grid as column objects with the envelope line between them
    section_lines: bool = True
    join_gaps: bool = True
    steps_regions: bool = True
    columns: bool = True


class CandidateSet(BaseModel):
    walls: list[dict[str, Any]] = Field(default=[], max_length=2000)
    openings: list[dict[str, Any]] = Field(default=[], max_length=4000)
    objects: list[dict[str, Any]] = Field(default=[], max_length=5000)


class DetectorIn(BaseModel):
    """What the client says produced the candidates; stored in meta.last_detection, so bounded (unknown keys dropped)."""
    name: str = Field(min_length=1, max_length=64)
    version: str | None = Field(default=None, max_length=32)
    params: dict[str, Any] = Field(default={}, max_length=64)


class AcceptIn(BaseModel):
    accepted: list[CandidateId] = Field(min_length=1, max_length=11000)
    edits: dict[CandidateId, dict[str, Any]] = Field(default={}, max_length=11000)
    replace_auto: bool = False
    candidates: CandidateSet
    base_revision: int = Field(ge=0)
    detector: DetectorIn | None = None


def _auto_counts(doc: dict[str, Any]) -> dict[str, int]:
    """The draft's detected items per collection; objects since detector 1.4 (tribunes and columns are proposed too)."""
    return {c: sum(1 for i in doc.get(c) or [] if isinstance(i, dict) and i.get("source") == "auto") for c in ("walls", "openings", "objects")}


@router.post("/plan-versions/{version_id}/detect")
def detect_structure(version_id: str, body: DetectIn, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Candidates (walls, openings) from the version's picture by the local detector (design section 9): synchronous,
    in a worker thread, at most detect_timeout_s (decision 6); nothing is stored - the client sends back what it
    accepts to /detect/accept. The calibration, when there is one, sets the metres; otherwise the answer carries a
    door-width hint."""
    settings = settings_of(request)
    v = _editable(conn, principal, version_id)
    targets = list(dict.fromkeys(body.targets))
    if "walls" not in targets or any(t not in plan_detect.TARGETS for t in targets):
        raise ApiError(422, "validation", "targets: walls חובה, openings אופציונלי.")
    doc, _row = store.working_doc(conn, v)
    level_ids = {lv["id"] for lv in doc["levels"]}
    level_id = body.level_id or next((lv["id"] for lv in doc["levels"] if lv.get("is_default")), pg.DEFAULT_LEVEL_ID)
    if level_id not in level_ids:
        raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    cal = pg.calibration_of(v, None)
    scale = float(v["scale_m_per_px"]) if v["scale_m_per_px"] and cal["status"] in ("measured", "estimated") else None
    png = src.read_bytes()
    t0 = time.perf_counter()
    # the same guard inside the run: a worker past the deadline stops at its next stage (plan_detect.DetectTimeout)
    # instead of finishing a result nobody reads, so a timed-out run does not hold one of the two workers
    deadline = time.monotonic() + settings.detect_timeout_s
    future = DETECT_POOL.submit(plan_detect.detect, png, targets=targets, strength=body.strength, scale_m_per_px=scale, level_id=level_id, run_id=new_id()[:6], deadline=deadline,
                                 door_model=body.door_model, hollow_walls=body.hollow_walls, section_lines=body.section_lines, join_gaps=body.join_gaps,
                                 steps_regions=body.steps_regions, columns=body.columns)
    try:
        with unlocked(conn):  # the write lock is not held while the worker runs
            result = future.result(timeout=settings.detect_timeout_s)
    except (concurrent.futures.TimeoutError, plan_detect.DetectTimeout):
        future.cancel()  # a queued run never starts; a running one stops at its deadline, its result is never read
        audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "targets": targets, "strength": body.strength, "timeout_s": settings.detect_timeout_s, "timed_out": True})
        raise ApiError(504, "detect_timeout", "הזיהוי לא הסתיים בזמן; נסה עוצמה נמוכה יותר או תוכנית קטנה יותר.", retryable=True, details={"timeout_s": settings.detect_timeout_s})
    except (OSError, ValueError, MemoryError, RuntimeError) as exc:  # RuntimeError: the thinning's iteration bound in plan_detect
        audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "targets": targets, "strength": body.strength, "failed": type(exc).__name__})
        raise ApiError(500, "detect_failed", "זיהוי המבנה נכשל.", details={"error": type(exc).__name__})
    if scale is not None and isinstance(result.get("scale"), dict):
        result["scale"]["status"] = cal["status"]  # the detector calls any given scale measured; an estimate stays an estimate
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "targets": targets, "strength": body.strength, "walls": len(result["walls"]), "openings": len(result["openings"]), "objects": len(result.get("objects") or []), "ms": elapsed_ms,
                   "calibrated": scale is not None, "tilt_deg": result["detector"]["params"].get("tilt_deg") if isinstance(result.get("detector"), dict) else None})
    return {**result, "version_id": v["id"], "level_id": level_id, "existing_auto": _auto_counts(doc), "elapsed_ms": elapsed_ms}


@router.post("/plan-versions/{version_id}/detect/accept")
def accept_detection(version_id: str, body: AcceptIn, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The candidates a person kept, merged into the draft under the draft's revision rules (design 9.5). The server
    remembers no candidates: the client sends them back. Nothing is published."""
    v = _editable(conn, principal, version_id)
    doc, row = store.working_doc(conn, v)
    current = row["revision"] if row is not None else 0
    if body.base_revision != current:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=current, sent_revision=body.base_revision)
    try:
        merged, counts = pg.merge_candidates(doc, body.candidates.model_dump(), body.accepted, body.edits, body.replace_auto)
    except pg.CandidateError as exc:
        raise ApiError(422, exc.code, exc.user_message, details={"ids": exc.ids})
    merged = _carry_hidden(conn, principal, v, merged, doc)  # PLNS: a candidate edit cannot bind a hidden anchor
    structural = [i for i in pg.validate(merged) if i["structural"]]
    if structural:
        raise ApiError(422, "geometry_structure", "מבנה המועמדים אינו תקין; דבר לא נשמר.", details={"issues": structural[:50]})
    meta = dict(merged.get("meta") or {})
    detector = body.detector.model_dump() if body.detector is not None else None
    meta["last_detection"] = {"at": now_iso(), "by": principal.user_id, "detector": detector, "accepted": counts["accepted"], "replace_auto": body.replace_auto}
    if body.detector is not None:
        meta["detector_version"] = f"{body.detector.name} {body.detector.version or ''}".strip()
    merged["meta"] = meta
    saved = store.save_draft(conn, v, merged, body.base_revision, principal.user_id)
    audit(conn, actor=principal, action="geometry.detect.accept", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], **counts, "edits": len(body.edits), "replace_auto": body.replace_auto, "detector": body.detector.name if body.detector is not None else None})
    return {**_payload(conn, v, saved, store.load_doc(saved), principal), "merge": counts}


# ---------------------------------------------------------------- the door tool (T087, "סמן דלת")

DOOR_PROPOSAL_TIMEOUT_S = 5.0  # a click waits at most this long (or detect_timeout_s, if lower); the target is 0.3 s
DOOR_DEBUG_KEYS = ("scores", "stats", "hinge_point", "leaf_tip")  # the analysis' own readings: only with ?debug=1


class DoorProposalIn(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    wall_id: str | None = Field(default=None, min_length=1, max_length=64)
    level_id: str | None = Field(default=None, min_length=1, max_length=64)


def _door_job(path: Any, x: float, y: float, walls: list[dict[str, Any]], scale: float, calibrated: bool, wall_id: str | None, deadline: float) -> dict[str, Any]:
    from ..services import plan_door_tool as pdt  # numpy work in the pool thread, like the detector

    return pdt.propose(pdt.picture(path), x, y, walls, scale, calibrated, wall_id=wall_id, deadline=deadline)


@router.post("/plan-versions/{version_id}/door-proposal")
def door_proposal(version_id: str, body: DoorProposalIn, request: Request, debug: bool = False, principal: Principal = Depends(current_principal_ro),
                  conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The "סמן דלת" tool: one click (x, y in the picture's 0..1 space) on a door symbol or on the wall where a door is,
    and the door the local analysis proposes there - the draft wall it sits on and its position (t), or a short wall
    piece of its own when no draft wall runs along it, the width in version pixels (the client turns it into metres
    with the document's effective scale), hinge side, swing, what was found and how sure. The analysis reads a small
    crop of the version's picture at its own resolution (services/plan_door_tool.py) under
    a short deadline, in a worker of its own. `?debug=1` adds the analysis' readings (scores, stats, the hinge point and
    leaf tip it read). Nothing is stored, nothing is audited (nothing changes) and no picture leaves the server; the
    client adds the door to the draft like any other opening once the person accepts it. Needs map.edit on the floor."""
    settings = settings_of(request)
    v = _editable(conn, principal, version_id)
    doc, _row = store.working_doc(conn, v)
    default_level = next((lv["id"] for lv in doc["levels"] if lv.get("is_default")), pg.DEFAULT_LEVEL_ID)
    if body.level_id is not None and body.level_id not in {lv["id"] for lv in doc["levels"]}:
        raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    walls = [w for w in doc.get("walls") or [] if isinstance(w, dict) and (body.level_id is None or (w.get("level_id") or default_level) == body.level_id)]
    if body.wall_id is not None and not any(w.get("id") == body.wall_id for w in walls):
        raise ApiError(422, "unknown_wall", "הקיר לא נמצא בטיוטה השמורה; שמור וחזור.", details={"wall_id": body.wall_id})
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    # the document's effective scale (as the editor turns pixels into metres); a calibration - measured, or the
    # door-width estimate - also bounds the leaf sizes searched, the bare wall estimate does not
    scale, _estimated = pg.effective_scale(doc)
    cal = (doc.get("dimensions") or {}).get("calibration")
    calibrated = isinstance(cal, dict) and cal.get("status") in ("measured", "estimated")
    timeout = min(DOOR_PROPOSAL_TIMEOUT_S, float(settings.detect_timeout_s))
    deadline = time.monotonic() + timeout
    future = DOOR_POOL.submit(_door_job, src, body.x, body.y, walls, scale, calibrated, body.wall_id, deadline)
    try:
        result = future.result(timeout=timeout)
    except (concurrent.futures.TimeoutError, TimeoutError):
        future.cancel()
        raise ApiError(504, "door_proposal_timeout", "ההצעה לא חושבה בזמן; נסה שוב.", retryable=True, details={"timeout_s": timeout})
    except ValueError as exc:
        from ..services import plan_door_tool as pdt

        if isinstance(exc, pdt.NoWall):
            raise ApiError(422, "no_wall", "לא נמצאו סמל דלת או קיר ליד הלחיצה. לחץ על סמל הדלת עצמו, או צייר קודם את הקיר.")
        raise ApiError(500, "door_proposal_failed", "חישוב ההצעה נכשל.", details={"error": type(exc).__name__})
    except (OSError, MemoryError, RuntimeError) as exc:
        raise ApiError(500, "door_proposal_failed", "חישוב ההצעה נכשל.", details={"error": type(exc).__name__})
    if not debug:
        for k in DOOR_DEBUG_KEYS:
            result.pop(k, None)
    return {**result, "version_id": v["id"], "level_id": body.level_id or default_level}


def _export_doc(conn: sqlite3.Connection, principal: Principal, version_id: str, draft: bool) -> tuple[sqlite3.Row, dict[str, Any]]:
    v = get_version(conn, version_id)
    if draft:
        require(conn, principal, "map.edit", _floor(v))
        return v, _shown(conn, principal, v["floor_id"], store.working_doc(conn, v)[0], _far_ctx(conn, principal), "draft")
    require(conn, principal, "map.edit" if v["status"] == "draft" else "map.read", _floor(v))
    row = store.published_row(conn, v["id"])
    if row is None:
        raise not_found("אין מבנה מפורסם לגרסה הזו.")
    return v, _shown(conn, principal, v["floor_id"], store.load_doc(row), _far_ctx(conn, principal, published=True), "published")


def _export_zones(conn: sqlite3.Connection, principal: Principal, v: sqlite3.Row) -> list[dict[str, Any]]:
    """The floor's rooms and the rooms other floors share with it (CR-009), in this plan's coordinates."""
    mirrored, _anchors = shared_spaces.bundle_parts(conn, v["floor_id"], v, can_attach=_can_attach(conn, principal), can_name=lambda fid: floor_reach(conn, principal, fid) is not None)
    return floor_zones(conn, v["floor_id"]) + mirrored


@router.get("/plan-versions/{version_id}/export.svg", response_model=None)
def export_svg(version_id: str, draft: bool = False, level: str | None = None, labels: bool = True, rooms: bool = True, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    text = render.render_svg(doc, _export_zones(conn, principal, v), v["width_px"], v["height_px"], level=level, labels=labels, rooms=rooms, layers=_layers(layers),
                             anchors=store.anchor_positions(conn, v["floor_id"]), items=plan_catalog.item_index(conn))
    return Response(content=text.encode("utf-8"), media_type="image/svg+xml; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.svg"', **NO_CACHE})


@router.get("/plan-versions/{version_id}/export.png", response_model=None)
def export_png(version_id: str, request: Request, draft: bool = False, level: str | None = None, background: bool = True, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    picture = settings_of(request).data_dir / v["image_path"] if background else None
    data = render.render_png(doc, _export_zones(conn, principal, v), v["width_px"], v["height_px"], background=picture if picture is not None and picture.exists() else None,
                             level=level, layers=_layers(layers), anchors=store.anchor_positions(conn, v["floor_id"]), items=plan_catalog.item_index(conn))
    return Response(content=data, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.png"', **NO_CACHE})
