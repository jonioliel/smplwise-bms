"""Plan Studio object library API (T085, CR-003): the built-in catalog merged with the installation's custom items
(readable by anyone who may read a map), custom items with "based on" (catalog.manage, held at any scope: the
library is shared), and the export / import of the custom library as JSON. Built-in items never change through the
API; a custom item that a document still uses may be deleted - the object then reports unknown_item in the editor."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import plan_catalog as cat

router = APIRouter()
NO_CACHE = {"Cache-Control": "private, no-cache"}
EXPORT_FORMAT = "smplwise-catalog-1"
COLUMNS = ("based_on", "names_json", "category", "tags_json", "role", "shape", "size_json", "z_m", "params_json", "icon", "color_token")
_INSERT = f"INSERT INTO catalog_items(id, {', '.join(COLUMNS)}, created_by, created_at, updated_at) VALUES (?, {', '.join('?' * len(COLUMNS))}, ?, ?, ?)"
_UPDATE = f"UPDATE catalog_items SET {', '.join(f'{c} = ?' for c in COLUMNS)}, updated_at = ? WHERE id = ?"


def _ts() -> str:
    """A created_at/updated_at for a catalog item row: microsecond precision. now_iso() truncates to the second, so two
    items created within the same wall-clock second (routine in a fast test run, or a script) would tie on the
    custom_rows ORDER BY created_at, rowid and then re-sort on any later insert with a fresh rowid - breaking the
    "a round trip keeps created_at, so the order holds" guarantee the export/import pair promises."""
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _held_anywhere(conn: sqlite3.Connection, principal: Principal, permission: str) -> None:
    """The library is installation-wide data: a floor-scoped binding is enough (a floor viewer reads it, a floor editor
    manages it). Without the permission anywhere the refusal is audited at the root scope."""
    if authorize(conn, principal, permission, INSTALLATION).allowed or permission in permissions_anywhere(conn, principal):
        return
    require(conn, principal, permission, INSTALLATION)


def _custom(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row:
    if item_id in cat.builtin_ids():
        raise conflict("builtin_item", "פריט מובנה אינו ניתן לעריכה או למחיקה; צור פריט מותאם שמבוסס עליו.")
    r = conn.execute("SELECT * FROM catalog_items WHERE id = ?", (item_id,)).fetchone()
    if r is None:
        raise not_found("הפריט לא נמצא בספרייה.")
    return r


def _values(body: dict[str, Any], existing: sqlite3.Row | None = None) -> dict[str, Any]:
    try:
        return cat.custom_values(body, existing=existing)
    except ValueError as exc:
        raise ApiError(422, "validation", f"פריט לא תקין: {exc}.")


def _item(conn: sqlite3.Connection, item_id: str) -> dict[str, Any]:
    return cat.row_item(conn.execute("SELECT * FROM catalog_items WHERE id = ?", (item_id,)).fetchone())


def _row_dict(r: sqlite3.Row) -> dict[str, Any]:
    """The export shape of a custom row: the columns with the JSON ones decoded (what import takes back)."""
    return {"id": r["id"], "based_on": r["based_on"], "names": json.loads(r["names_json"]), "category": r["category"], "tags": json.loads(r["tags_json"] or "[]"),
            "role": r["role"], "shape": r["shape"], "size": json.loads(r["size_json"]), "z_m": r["z_m"], "params": json.loads(r["params_json"] or "{}"),
            "icon": r["icon"], "color_token": r["color_token"], "created_at": r["created_at"], "updated_at": r["updated_at"]}


class CustomItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    based_on: str | None = Field(default=None, max_length=64)
    names: dict[str, str] | None = None
    category: str | None = Field(default=None, max_length=40)
    tags: list[str] | None = Field(default=None, max_length=20)
    role: str | None = Field(default=None, max_length=40)
    shape: str | None = Field(default=None, max_length=40)
    size: dict[str, float] | None = None
    z_m: float | None = None
    params: dict[str, Any] | None = None
    icon: str | None = Field(default=None, max_length=40)
    color_token: str | None = Field(default=None, max_length=40)


class ImportIn(BaseModel):
    format: str = Field(pattern="^smplwise-catalog-1$")
    items: list[dict[str, Any]] = Field(max_length=500)


@router.get("/catalog/objects")
def list_objects(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The whole library (built-in + custom); the client filters and searches it."""
    _held_anywhere(conn, principal, "map.read")
    return cat.library(conn)


@router.post("/catalog/objects", status_code=201)
def create_object(body: CustomItemIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _held_anywhere(conn, principal, "catalog.manage")
    values = _values(body.model_dump(exclude_unset=True))
    iid, now = new_id(), _ts()
    conn.execute(_INSERT, (iid, *[values[c] for c in COLUMNS], principal.user_id, now, now))
    audit(conn, actor=principal, action="catalog.item.create", decision="allowed", resource_type="catalog", resource_id=iid, request_id=_rid(request),
          details={"based_on": values["based_on"], "category": values["category"], "name": json.loads(values["names_json"])["he"]})
    return _item(conn, iid)


@router.patch("/catalog/objects/{item_id}")
def update_object(item_id: str, body: CustomItemIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _held_anywhere(conn, principal, "catalog.manage")
    r = _custom(conn, item_id)
    fields = body.model_dump(exclude_unset=True)
    values = _values(fields, existing=r)
    conn.execute(_UPDATE, (*[values[c] for c in COLUMNS], _ts(), item_id))
    audit(conn, actor=principal, action="catalog.item.update", decision="allowed", resource_type="catalog", resource_id=item_id, request_id=_rid(request),
          details={"fields": sorted(fields)})
    return _item(conn, item_id)


@router.delete("/catalog/objects/{item_id}", status_code=204)
def delete_object(item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    _held_anywhere(conn, principal, "catalog.manage")
    r = _custom(conn, item_id)
    conn.execute("DELETE FROM catalog_items WHERE id = ?", (item_id,))
    audit(conn, actor=principal, action="catalog.item.delete", decision="allowed", resource_type="catalog", resource_id=item_id, request_id=_rid(request),
          details={"name": json.loads(r["names_json"]).get("he"), "based_on": r["based_on"]})


@router.get("/catalog/export", response_model=None)
def export_catalog(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> JSONResponse:
    """The custom items as a JSON file (the built-in ones ship with the add-on and are not exported)."""
    _held_anywhere(conn, principal, "catalog.manage")
    body = {"format": EXPORT_FORMAT, "catalog_version": cat.builtin()["catalog_version"], "exported_at": now_iso(), "items": [_row_dict(r) for r in cat.custom_rows(conn)]}
    return JSONResponse(body, headers={"Content-Disposition": 'attachment; filename="smplwise-catalog-custom.json"', **NO_CACHE})


@router.post("/catalog/import")
def import_catalog(body: ImportIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Custom items from an export: an id already in the table is replaced, a new one inserted (its created_at kept
    when the file carries one, so a round trip keeps the order); an id of a built-in item or a malformed id refuses
    the whole file before anything is written."""
    _held_anywhere(conn, principal, "catalog.manage")
    builtin_ids = cat.builtin_ids()
    prepared: list[tuple[str, dict[str, Any], str | None]] = []
    for i, item in enumerate(body.items):
        iid = item.get("id")
        if not isinstance(iid, str) or not cat.ID_RE.match(iid):
            raise ApiError(422, "validation", f"פריט {i + 1}: מזהה לא תקין.")
        if iid in builtin_ids:
            raise ApiError(422, "validation", f"פריט {i + 1}: המזהה {iid} שמור לפריט מובנה.")
        created = item.get("created_at")
        prepared.append((iid, _values(item), created if isinstance(created, str) and len(created) >= 20 else None))
    imported = replaced = 0
    now = _ts()
    for iid, values, created in prepared:
        if conn.execute("SELECT 1 FROM catalog_items WHERE id = ?", (iid,)).fetchone():
            conn.execute(_UPDATE, (*[values[c] for c in COLUMNS], now, iid))
            replaced += 1
        else:
            conn.execute(_INSERT, (iid, *[values[c] for c in COLUMNS], principal.user_id, created or now, now))
            imported += 1
    audit(conn, actor=principal, action="catalog.import", decision="allowed", resource_type="catalog", resource_id="*", request_id=_rid(request),
          details={"imported": imported, "replaced": replaced})
    return {"imported": imported, "replaced": replaced, "revision": cat.revision(conn)}
