"""WHITELABEL097-295: the installer brand profile (white label) and the customer pack, in הגדרות › כללי › מראה המערכת › מיתוג מתקין.

| Route | Who |
|---|---|
| `GET /brand/white-label` | any session: the full profile (also while off) and the facts of the stored logos |
| `PUT /brand/white-label` | system.configure: enabled, name, contact, accent (a preset id) |
| `POST /brand/white-label/logo/{variant}` | system.configure: multipart `file`; PNG / SVG / WebP / JPEG by content, <= 2 MB |
| `DELETE /brand/white-label/logo/{variant}` | system.configure |
| `GET /brand/white-label/logo/{variant}` | any session: the current image, no-store (the preview in Settings, also while off) |
| `GET /brand/white-label/logo/{variant}/{stamp}.{png,svg}` | nobody, but only while the profile is ON (404 otherwise): the stamped, immutable image |
| `GET /brand/white-label/pack` | system.configure: the customer pack (zip) |
| `POST /brand/white-label/pack` | system.configure: multipart `file` (a pack zip); validated completely before anything is written |

The public view (`GET /brand/public`, `/me.brand`) carries the profile only while the master switch is on. Every change is audited."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import set_setting, unlocked
from ..errors import ApiError, not_found, validation
from ..rbac import INSTALLATION, Principal, require
from ..services import brand_assets as ba
from ..services import white_label as wl
from .brand import IMMUTABLE, WARNING_TEXT, _image, _variant

router = APIRouter()

_STAMPED = re.compile(r"^([0-9a-f]{16})\.(png|svg)$")
_FIELD_KEY = {"enabled": wl.K_ENABLED, "name": wl.K_NAME, "contact": wl.K_CONTACT, "accent": wl.K_ACCENT}
_FIELD_TEXT = {"enabled": "מתג המיתוג", "name": "שם המתקין", "contact": "שורת יצירת קשר", "accent": "צבע הדגשה"}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/brand/white-label")
def wl_get(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return wl.full_view(conn)


class WhiteLabelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    name: str | None = Field(default=None, max_length=200)
    contact: str | None = Field(default=None, max_length=400)
    accent: str | None = Field(default=None, max_length=40)


@router.put("/brand/white-label")
def wl_put(body: WhiteLabelBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    changes: dict[str, str] = {}
    for field, value in body.model_dump(exclude_none=True).items():
        try:
            changes[_FIELD_KEY[field]] = wl.normalise_field(_FIELD_KEY[field], value)
        except ValueError as exc:
            raise validation(f"הערך אינו תקין: {_FIELD_TEXT[field]}", field=field, reason=str(exc)) from exc
    for key, value in changes.items():
        set_setting(conn, key, value)
    if changes:
        audit(conn, actor=principal, action="brand.installer.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"keys": sorted(changes), **({"enabled": changes[wl.K_ENABLED] == "1"} if wl.K_ENABLED in changes else {})})
    return wl.full_view(conn)


@router.post("/brand/white-label/logo/{variant}", status_code=201)
def wl_logo_upload(variant: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    variant = _variant(variant)
    require(conn, principal, "system.configure", INSTALLATION)
    data = file.file.read(ba.MAX_BYTES + 1)
    if len(data) > ba.MAX_BYTES:
        raise ApiError(413, "payload_too_large", "הקובץ גדול מדי (עד 2MB)", details={"max_bytes": ba.MAX_BYTES})
    with unlocked(conn):  # the decode never holds the write lock
        norm = ba.normalise(data)
    stamp = ba.put(conn, variant, norm, principal.username or principal.user_id, kind=wl.KIND)
    audit(conn, actor=principal, action="brand.installer.logo.upload", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"kind": wl.KIND, "variant": variant, "mime": norm.mime, "bytes": len(norm.data), "width": norm.width, "height": norm.height})
    return {"stamp": stamp, "variant": variant, "mime": norm.mime, "width": norm.width, "height": norm.height,
            "warnings": [{"code": w, "message": WARNING_TEXT[w]} for w in norm.warnings if w in WARNING_TEXT], "view": wl.full_view(conn)}


@router.delete("/brand/white-label/logo/{variant}")
def wl_logo_delete(variant: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    variant = _variant(variant)
    require(conn, principal, "system.configure", INSTALLATION)
    gone = ba.remove(conn, variant, kind=wl.KIND)
    audit(conn, actor=principal, action="brand.installer.logo.remove", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"kind": wl.KIND, "variant": variant, "existed": gone})
    return wl.full_view(conn)


@router.get("/brand/white-label/logo/{variant}/{filename}")
def wl_logo_stamped(variant: str, filename: str, request: Request) -> Response:
    variant = _variant(variant)
    m = _STAMPED.match(filename)
    if not m:
        raise not_found("לא נמצא.")
    with request.app.state.db.connection(mode="read", label="brand/white-label/logo") as conn:
        if not wl.enabled(conn):
            raise not_found("לא נמצא.")  # while the profile is off nothing of it is public
        got = ba.read(conn, variant, m.group(1), kind=wl.KIND)
    if got is None or (m.group(2) == "svg") != (got[0] == "image/svg+xml"):
        raise not_found("לא נמצא.")
    mime, data, stamp = got
    if request.headers.get("if-none-match", "").strip('" ') == stamp:
        return Response(status_code=304, headers={"ETag": f'"{stamp}"', "Cache-Control": IMMUTABLE})
    return _image(mime, data, stamp, IMMUTABLE)


@router.get("/brand/white-label/logo/{variant}")
def wl_logo_current(variant: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    variant = _variant(variant)
    got = ba.read(conn, variant, kind=wl.KIND)
    if got is None:
        raise not_found("אין לוגו.")
    return _image(got[0], got[1], got[2], "no-store")


@router.get("/brand/white-label/pack")
def wl_pack_export(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    require(conn, principal, "system.configure", INSTALLATION)
    data = wl.build_pack(conn)
    audit(conn, actor=principal, action="brand.installer.pack.export", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"bytes": len(data)})
    return Response(content=data, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{wl.PACK_FILENAME}"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/brand/white-label/pack")
def wl_pack_import(request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    data = file.file.read(wl.MAX_PACK_BYTES + 1)
    with unlocked(conn):  # the parse (zip + image decode) never holds the write lock
        pack = wl.parse_pack(data)
    wl.apply_pack(conn, pack, principal.username or principal.user_id)
    audit(conn, actor=principal, action="brand.installer.pack.import", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"bytes": len(data), "variants": sorted(pack.logos)})
    return wl.full_view(conn)
