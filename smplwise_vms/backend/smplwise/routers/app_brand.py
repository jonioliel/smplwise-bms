"""APP-SERVER-LEFTOVERS-2380 (A3, app-team note L-2): the company logo for the phone apps' splash / "about" screen - read-only.

| Route | Who |
|---|---|
| `GET /brand/app` | the app: a device token or a session (`routers/presence.any_caller`, like `notifications/categories`) - the company name and, per variant (`light`, `dark`), the stamp / type / pixel size and the relative path of the image |
| `GET /brand/app/logo/{variant}` | the same callers: the stored image (PNG, or the sanitised SVG), `ETag` = the stamp, `If-None-Match` answers 304 |

What it carries: ONLY the company name and the company logo images the administrator already published (the sign-in page shows the same through
`GET /brand/public`). Not the installer profile, the project name, the kind, who uploaded or when, the title settings, the file sizes, any setting or
person. The installed app's own identity stays SmplWise Arx (owner decision): this is the data of the one splash / "about" place where the
company logo may appear, cached by the app per server (the `version` string changes when a logo is replaced; the image `ETag` does too).

Nothing is written, nothing is audited (a read of public-by-definition branding), no setting switches it: with no logo uploaded the answer is
`logos: {light: null, dark: null}`. The images are served only through the one reader every surface uses (`services/brand_assets.read`: the stored
bytes must hash to their stamp), with the same SVG sandbox headers as `routers/brand.py`."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..db import Database
from ..errors import not_found
from ..services import brand_assets as ba
from .brand import _image, _variant
from .presence import Caller, any_caller

router = APIRouter()

CACHE = "private, no-cache"  # revalidate every time (a cheap 304); the stamp in the ETag says whether the image changed


def _db(request: Request) -> Database:
    return request.app.state.db


def _logos(conn: sqlite3.Connection) -> dict[str, dict[str, Any] | None]:
    """Per variant: the stamp the settings point at, with the stored row's type and pixel size - None when no (valid) logo is stored."""
    out: dict[str, dict[str, Any] | None] = {v: None for v in ba.VARIANTS}
    st = ba.stamps(conn)
    try:
        rows = conn.execute("SELECT variant, stamp, mime, width, height FROM brand_assets WHERE kind = ?", (ba.KIND,)).fetchall()
    except sqlite3.Error:
        return out
    for r in rows:
        if r["variant"] in out and st.get(r["variant"]) == r["stamp"] and r["mime"] in ("image/png", "image/svg+xml"):
            out[r["variant"]] = {"stamp": r["stamp"], "mime": r["mime"], "width": int(r["width"] or 0), "height": int(r["height"] or 0),
                                 "path": f"brand/app/logo/{r['variant']}"}
    return out


@router.get("/brand/app")
def app_brand(request: Request, caller: Caller = Depends(any_caller)) -> dict[str, Any]:
    """The company name and logo facts for the app's splash / "about" screen (device token or session). Read-only; no installer, project or person data."""
    with _db(request).connection(mode="read", label="brand/app") as conn:
        logos = _logos(conn)
        name = ba.company_name(conn)
    version = ".".join(f"{v[:1]}{logos[v]['stamp']}" if logos[v] else f"{v[:1]}-" for v in ba.VARIANTS)  # changes when a logo is added, replaced or removed
    return {"company": {"name": name, "logos": logos}, "version": version}


@router.get("/brand/app/logo/{variant}")
def app_brand_logo(variant: str, request: Request, caller: Caller = Depends(any_caller)) -> Response:
    """The stored company logo of one variant (`light` | `dark`) for the app; 404 when none is stored; 304 for a matching `If-None-Match`."""
    variant = _variant(variant)
    with _db(request).connection(mode="read", label="brand/app/logo") as conn:
        st = ba.stamps(conn).get(variant)
        got = ba.read(conn, variant, st) if st else None
    if got is None:
        raise not_found("אין לוגו.")
    mime, data, stamp = got
    if request.headers.get("if-none-match", "").strip('" ') == stamp:
        return Response(status_code=304, headers={"ETag": f'"{stamp}"', "Cache-Control": CACHE})
    return _image(mime, data, stamp, CACHE)
