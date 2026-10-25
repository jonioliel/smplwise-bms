"""CR-LOGOS295: the logo and look settings of הגדרות › כללי › מראה המערכת, and the company logo's upload / serving.

| Route | Who |
|---|---|
| `GET /brand/public` | nobody (the sign-in page, before a session): the company name, the two logo stamps, the size and dark-background choices |
| `GET /brand` | any session: the full view (kind, title prefix / mode, project name) and the facts of the stored files |
| `PUT /brand` | system.configure: name, kind, logo size, logo side (start | end), dark-background mode, title prefix / mode, project name |
| `POST /brand/company-logo/{variant}` | system.configure: multipart `file`; PNG / SVG / WebP / JPEG by content, <= 2 MB |
| `DELETE /brand/company-logo/{variant}` | system.configure |
| `GET /brand/company-logo/{variant}/{stamp}.{png,svg}` | nobody: the stamped image, immutable (a replaced logo is a new stamp) |
| `GET /brand/company-logo/{variant}` | any session: the current image, no-store (the preview right after an upload) |

`variant` is `light` or `dark`. The two stamped / public routes carry only what a sign-in page and a lobby display may show (a
company's logo is public by definition). Every change is audited. The SVG is served only as the sanitised rebuild
(services/svg_sanitize.py), through `<img>`, with a sandboxing Content-Security-Policy and nosniff."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import unlocked
from ..errors import ApiError, not_found, validation
from ..rbac import INSTALLATION, Principal, require
from ..services import brand_assets as ba

router = APIRouter()

_STAMPED = re.compile(r"^([0-9a-f]{16})\.(png|svg)$")
IMMUTABLE = "public, max-age=31536000, immutable"
SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
WARNING_TEXT = {
    "odd_aspect": "יחס התמונה חריג - מומלץ לוגו רוחבי",
    "very_light": "הלוגו בהיר מאוד - מומלץ להעלות גרסה לרקע כהה",
    "no_alpha": "לתמונה אין רקע שקוף - על רקע כהה היא תוצג על לוחית",
}


def _variant(v: str) -> str:
    if v not in ba.VARIANTS:
        raise not_found("לא נמצא.")
    return v


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _image(mime: str, data: bytes, stamp: str, cache: str) -> Response:
    headers = {"Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "cross-origin",
               "Content-Disposition": "inline", "ETag": f'"{stamp}"'}
    if mime == "image/svg+xml":
        headers["Content-Security-Policy"] = SVG_CSP
    return Response(content=data, media_type=mime, headers=headers)


@router.get("/brand/public")
def brand_public(request: Request) -> dict[str, Any]:
    with request.app.state.db.connection(mode="read", label="brand/public") as conn:
        return ba.public_view(conn)


@router.get("/brand")
def brand_get(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {**ba.full_view(conn), "files": ba.meta(conn)}


class BrandBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company_name: str | None = Field(default=None, max_length=200)
    company_kind: str | None = Field(default=None, max_length=20)
    logo_size: str | None = Field(default=None, max_length=8)
    logo_side: str | None = Field(default=None, max_length=8)
    company_logo_size: str | None = Field(default=None, max_length=8)
    dark_mode: str | None = Field(default=None, max_length=8)
    title_prefix: str | None = Field(default=None, max_length=200)
    title_mode: str | None = Field(default=None, max_length=8)
    project_name: str | None = Field(default=None, max_length=200)


_FIELD_KEY = {"company_name": ba.K_NAME, "company_kind": ba.K_KIND, "logo_size": ba.K_SIZE, "logo_side": ba.K_SIDE, "company_logo_size": ba.K_CSIZE, "dark_mode": ba.K_DARK, "title_prefix": ba.K_PREFIX,
              "title_mode": ba.K_MODE, "project_name": ba.K_PROJECT}
_FIELD_TEXT = {"company_name": "שם היזם / החברה", "company_kind": "סוג", "logo_size": "גודל הלוגו", "logo_side": "צד הלוגואים", "company_logo_size": "גודל לוגו היזם", "dark_mode": "טיפול ברקע כהה", "title_prefix": "קידומת הכותרת",
               "title_mode": "תוכן הכותרת", "project_name": "שם הפרויקט"}


@router.put("/brand")
def brand_put(body: BrandBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..db import set_setting

    require(conn, principal, "system.configure", INSTALLATION)
    changes: dict[str, str] = {}
    for field, value in body.model_dump(exclude_none=True).items():
        try:
            changes[_FIELD_KEY[field]] = ba.normalise_setting(_FIELD_KEY[field], value)
        except ValueError as exc:
            raise validation(f"הערך אינו תקין: {_FIELD_TEXT[field]}", field=field, reason=str(exc)) from exc
    for key, value in changes.items():
        set_setting(conn, key, value)
    if changes:
        audit(conn, actor=principal, action="brand.company.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"keys": sorted(changes)})
    return {**ba.full_view(conn), "files": ba.meta(conn)}


@router.post("/brand/company-logo/{variant}", status_code=201)
def logo_upload(variant: str, request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    variant = _variant(variant)
    require(conn, principal, "system.configure", INSTALLATION)
    data = file.file.read(ba.MAX_BYTES + 1)
    if len(data) > ba.MAX_BYTES:
        raise ApiError(413, "payload_too_large", "הקובץ גדול מדי (עד 2MB)", details={"max_bytes": ba.MAX_BYTES})
    with unlocked(conn):  # the decode never holds the write lock
        norm = ba.normalise(data)
    stamp = ba.put(conn, variant, norm, principal.username or principal.user_id)
    audit(conn, actor=principal, action="brand.company.logo.upload", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"kind": ba.KIND, "variant": variant, "mime": norm.mime, "bytes": len(norm.data), "width": norm.width, "height": norm.height})
    return {"stamp": stamp, "variant": variant, "mime": norm.mime, "width": norm.width, "height": norm.height,
            "warnings": [{"code": w, "message": WARNING_TEXT[w]} for w in norm.warnings if w in WARNING_TEXT], **{"view": ba.full_view(conn), "files": ba.meta(conn)}}


@router.delete("/brand/company-logo/{variant}")
def logo_delete(variant: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    variant = _variant(variant)
    require(conn, principal, "system.configure", INSTALLATION)
    gone = ba.remove(conn, variant)
    audit(conn, actor=principal, action="brand.company.logo.remove", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"kind": ba.KIND, "variant": variant, "existed": gone})
    return {**ba.full_view(conn), "files": ba.meta(conn)}


@router.get("/brand/company-logo/{variant}/{filename}")
def logo_stamped(variant: str, filename: str, request: Request) -> Response:
    variant = _variant(variant)
    m = _STAMPED.match(filename)
    if not m:
        raise not_found("לא נמצא.")
    with request.app.state.db.connection(mode="read", label="brand/logo") as conn:
        got = ba.read(conn, variant, m.group(1))
    if got is None or (m.group(2) == "svg") != (got[0] == "image/svg+xml"):
        raise not_found("לא נמצא.")
    mime, data, stamp = got
    if request.headers.get("if-none-match", "").strip('" ') == stamp:
        return Response(status_code=304, headers={"ETag": f'"{stamp}"', "Cache-Control": IMMUTABLE})
    return _image(mime, data, stamp, IMMUTABLE)


@router.get("/brand/company-logo/{variant}")
def logo_current(variant: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    variant = _variant(variant)
    got = ba.read(conn, variant)
    if got is None:
        raise not_found("אין לוגו.")
    return _image(got[0], got[1], got[2], "no-store")
