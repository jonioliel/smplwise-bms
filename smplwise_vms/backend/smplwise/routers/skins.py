"""AI-rendered floor skins (CR-006 phase 2, slice 2a): status, the owner's connection test and the control-image upload.

Nothing leaves the installation from here except the connection test's synthetic 64x64 pattern, and only with the
privacy acknowledgement on, the API key configured (add-on option `openai_api_key`) and the monthly budget not spent.
The render-set proposal, real renders, skin storage and compositing are slices 2b/2c.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services.skins import provider as prov
from ..services.skins import store
from .catalog import get_floor
from .settings import read_settings

router = APIRouter()
log = logging.getLogger("smplwise.skins")

P_EDIT = "map.edit"
P_SYSTEM = "system.configure"
KEY_RE = re.compile(r"^[0-9a-f]{64}$")

# What the privacy acknowledgement covers - shown verbatim on the settings screen (CR-006 7.2, owner decisions 2026-09-28).
LEAVES = [
    "תמונת הבקרה הסכמטית שלנו: רינדור איזומטרי של הקומה מתוך המנוע התלת־ממדי של המוצר (קירות, פתחים, רצפות, ריהוט, גוון החדרים) - בלי תוויות.",
    "רק אם השולח בוחר בכך בשליחה מסוימת: גם תמונת התוכנית המקורית (של האדריכל) של אותה קומה.",
    "טקסט ההנחיה הקבוע של המוצר (בקשה להפוך את התמונה לפוטוריאליסטית ולשמור על הגאומטריה).",
]
NEVER_LEAVES = ["תמונות ממצלמות", "אנשים", "תוויות, שמות חדרים ושמות ישויות", "מצבי חיישנים ונתוני Home Assistant", "כתובות, שמות אתר ומזהים"]


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _provider(request: Request, conn: sqlite3.Connection) -> prov.SkinProvider:
    """The configured provider; a test swaps the factory on app.state (never the network in tests)."""
    s = read_settings(conn)
    factory = getattr(request.app.state, "skin_provider_factory", None)
    key = settings_of(request).openai_api_key
    if factory is not None:
        return factory(s["skins.provider"], key, s["skins.model"])
    return prov.make_provider(s["skins.provider"], key, s["skins.model"])


def _last_test(conn: sqlite3.Connection) -> dict[str, Any] | None:
    r = conn.execute("SELECT created_at, status, http_status, error_code, model FROM plan_skin_renders WHERE test = 1 ORDER BY created_at DESC, rowid DESC LIMIT 1").fetchone()
    return dict(r) if r else None


@router.get("/skins/status")
def skins_status(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Everything the settings section shows - never the key, only whether it is configured."""
    s = read_settings(conn)
    key_configured = bool(settings_of(request).openai_api_key)
    p = prov.OpenAIImageProvider(None, s["skins.model"])  # describes itself only; without a key it cannot send
    options = prov.RenderOptions(size=f"{store.CONTROL_SIZE[0]}x{store.CONTROL_SIZE[1]}", quality="medium")
    return {
        "provider": s["skins.provider"], "model": s["skins.model"], "key_configured": key_configured, "privacy_ack": s["skins.privacy_ack"] == "true",
        "leaves": LEAVES, "never_leaves": NEVER_LEAVES, "capabilities": p.capabilities(), "estimate": p.estimate(options),
        "budget": store.budget(conn).describe(), "last_test": _last_test(conn),
        "api": {"endpoint": f"{prov.OPENAI_BASE_URL}{prov.OPENAI_EDIT_PATH}", "shape_verified": True, "prices_verified": False},
    }


@router.post("/skins/test")
def skins_test(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The owner's connection test: ONE fixed synthetic 64x64 pattern and a fixed prompt, a plan_skin_renders row flagged
    test, the provider's reply status (and its picture, when one came back). Refused without the acknowledgement, the key
    or the monthly budget - nothing is sent then."""
    require(conn, principal, P_SYSTEM, INSTALLATION)
    s = read_settings(conn)

    def refuse(code: str, message: str, status: int = 409, **details: Any) -> ApiError:
        audit(conn, actor=principal, action="skins.test", decision="denied", resource_type="installation", resource_id="*", reason=code, request_id=_rid(request), details=details or None)
        return ApiError(status, code, message, details=details or None)

    if s["skins.privacy_ack"] != "true":
        raise refuse("skins_privacy_ack_required", "לא נשלח דבר: יש לאשר קודם בהגדרות מה יוצא מהמתקן לספק הרינדור.")
    if not settings_of(request).openai_api_key:
        raise refuse("skins_key_missing", "לא נשלח דבר: מפתח ה־API של OpenAI לא הוגדר באפשרויות ה־Add-on (openai_api_key).")
    b = store.budget(conn)
    if not b.allows(1):
        raise refuse("skins_budget_exhausted", "לא נשלח דבר: התקציב החודשי של רינדורים נוצל.", **b.describe())
    try:
        p = _provider(request, conn)
    except prov.SkinProviderError as exc:
        raise refuse("skins_provider_unavailable", exc.message, 503)
    image = store.test_pattern_png()
    control_hash = hashlib.sha256(image).hexdigest()
    options = prov.RenderOptions(size=store.TEST_SIZE, quality=store.TEST_QUALITY)
    # the attempt is on record (committed by unlocked) before anything is sent
    audit(conn, actor=principal, action="skins.test.attempt", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"provider": p.id, "model": p.model, "control_hash": control_hash, "prompt_version": store.TEST_PROMPT_VERSION, "size": options.size, "quality": options.quality})
    result: prov.RenderResult | None = None
    error: prov.SkinProviderError | None = None
    with unlocked(conn):
        try:
            result = p.render(image, store.TEST_PROMPT, options)
        except prov.SkinProviderError as exc:
            error = exc
    key = settings_of(request).openai_api_key
    if result is not None:
        rid = store.record_render(conn, floor_id=None, level_id=None, state_key=store.TEST_STATE, provider=result.provider, model=result.model, prompt_version=store.TEST_PROMPT_VERSION,
                                  control_hash=control_hash, geometry_key=None, sent_plan_raster=False, cost_estimate_usd=result.cost_estimate_usd, status="ok",
                                  http_status=result.http_status, error_code=None, usage=result.usage, image_path=None, test=True, actor_id=principal.user_id)
        out = {"ok": True, "render_id": rid, **result.describe(), "message": None,
               "image": f"data:image/png;base64,{base64.b64encode(result.image).decode('ascii')}" if result.image else None}
    else:
        assert error is not None
        message = prov.redact(error.message, key)
        rid = None
        if error.http_status:  # the provider answered: a sent request, on record (not counted - status error)
            rid = store.record_render(conn, floor_id=None, level_id=None, state_key=store.TEST_STATE, provider=p.id, model=p.model, prompt_version=store.TEST_PROMPT_VERSION,
                                      control_hash=control_hash, geometry_key=None, sent_plan_raster=False, cost_estimate_usd=None, status="error",
                                      http_status=error.http_status, error_code=error.provider_code or error.code, usage=None, image_path=None, test=True, actor_id=principal.user_id)
        log.warning("skins connection test failed: %s %s", error.code, message)
        out = {"ok": False, "render_id": rid, "provider": p.id, "model": p.model, "http_status": error.http_status, "code": error.code,
               "provider_code": error.provider_code, "message": message, "image": None, "usage": {}, "cost_estimate_usd": None, "image_bytes": 0, "request_id": None}
    audit(conn, actor=principal, action="skins.test", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={k: out[k] for k in ("ok", "render_id", "provider", "model", "http_status", "message", "image_bytes", "request_id") if k in out} | {"code": out.get("code")})
    out["budget"] = store.budget(conn).describe()
    return out


@router.get("/floors/{floor_id}/skins")
def floor_skins(floor_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The floor's geometry key (what a control image must be made from), its stored control images and its budget."""
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    gk = store.geometry_key(conn, floor_id)
    key, doc_hash = gk if gk else (None, None)
    return {"floor_id": floor_id, "geometry_key": key, "doc_hash": doc_hash, "states": list(store.STATES), "size": list(store.CONTROL_SIZE),
            "controls": [dict(c, current=c["geometry_key"] == key) for c in store.controls_of(conn, floor_id)],
            "budget": store.budget(conn, floor_id, key).describe()}


@router.post("/floors/{floor_id}/skins/control-image", status_code=201)
async def upload_control_image(floor_id: str, request: Request, state: str = Form(...), geometry_key: str = Form(...), file: UploadFile = File(...),
                               principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The browser's level-2 isometric capture of the floor for a synthetic state, labels stripped. Stored locally only,
    keyed by floor + state + geometry key; refused when the structure changed since the capture."""
    settings = settings_of(request)
    get_floor(conn, floor_id)
    require(conn, principal, P_EDIT, ("floor", floor_id))
    if state not in store.STATES:
        raise ApiError(422, "bad_state", "מצב לא מוכר לתמונת בקרה.", details={"choices": list(store.STATES)})
    if not KEY_RE.match(geometry_key):
        raise ApiError(422, "validation", "מפתח הגאומטריה אינו תקין.")
    gk = store.geometry_key(conn, floor_id)
    if gk is None:
        raise ApiError(409, "no_geometry", "לקומה אין מבנה מפורסם; פרסמו את המבנה ב־Plan Studio קודם.")
    if gk[0] != geometry_key:
        raise ApiError(409, "geometry_changed", "המבנה או החדרים של הקומה השתנו מאז הצילום; צלמו שוב.", details={"geometry_key": gk[0]})
    data = await file.read(store.CONTROL_MAX_BYTES + 1)
    try:
        row, identical = store.store_control(settings, conn, floor_id, state, geometry_key, data, principal.user_id)
    except store.ControlImageError as exc:
        raise ApiError(413 if exc.code == "payload_too_large" else 415 if exc.code == "unsupported_format" else 422, exc.code, exc.message, details=exc.details or None)
    audit(conn, actor=principal, action="skins.control.upload", decision="allowed", resource_type="floor", resource_id=floor_id, request_id=_rid(request),
          details={"state": state, "geometry_key": geometry_key, "sha256": row["sha256"], "bytes": row["bytes"], "identical": identical})
    return {**row, "identical": identical}
