"""CR-NOTICE106 - the notice board API (docs/changes/CR-NOTICE106.md section 4).

Order of every gated route: the signed-in principal -> the module switch (404 `feature_disabled` while `notices.enabled` is off - a
router-level dependency, so a route added later is gated too) -> the permission (the audited 403) -> visibility (a notice outside the
caller's audience is the same 404 as an unknown id). `open_router` answers while the module is off: the module state, the module
settings (system.configure) and the company logo of the TV boards.

The display routes (`/b/{slug}` and `/api/v1/notices/display/{slug}...`) need no login: they go through services/notices/display.py
(one long random revocable token per board, in the URL fragment, sent back as `X-Board-Token`), exactly like the LAN listener. On the
remote channel they answer only while `notices.boards.remote` is on.

Not in this build (CR slices 2 and 4): the push of a notice through the notification pipeline (`notices.push` is catalogued, the
`push_requested` column is kept), the home widget, promo slides, the building photo of template 2, the building-status chips."""
from __future__ import annotations

import datetime as dt
import sqlite3
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, has_any_binding, permissions_anywhere, require
from ..services.notices import audience as aud
from ..services.notices import display as disp
from ..services.notices import model, page, store
from ..services.notices.model import PERM_BOARDS, PERM_MANAGE, PERM_PUSH, PERM_VIEW, Invalid

ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
OFF_HE = "לוח ההודעות כבוי בהגדרות המערכת."


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _invalid(exc: Invalid) -> ApiError:
    return ApiError(422, "validation", str(exc), details={"field": exc.field})


def module_gate(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> None:
    if not store.module_on(conn):
        raise ApiError(404, "feature_disabled", OFF_HE)


open_router = APIRouter()
router = APIRouter(dependencies=[Depends(module_gate)])
display_router = APIRouter()  # no login: the TV feed (token in X-Board-Token)
page_router = APIRouter()  # no login: the static TV page at /b/{slug}


def _can(conn: sqlite3.Connection, principal: Principal) -> dict[str, bool]:
    anywhere = set(permissions_anywhere(conn, principal))
    return {
        "view": PERM_VIEW in anywhere or has_any_binding(conn, principal),
        "manage": PERM_MANAGE in anywhere,
        "manage_all": authorize(conn, principal, PERM_MANAGE, INSTALLATION).allowed,
        "push": PERM_PUSH in anywhere,
        "boards": authorize(conn, principal, PERM_BOARDS, INSTALLATION).allowed,
        "configure": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
    }


def _need_anywhere(conn: sqlite3.Connection, principal: Principal, permission: str) -> None:
    if permission in permissions_anywhere(conn, principal):
        return
    audit(conn, actor=principal, action=permission, decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
    raise ApiError(403, "forbidden", "אין הרשאה ללוח ההודעות.", details={"permission": permission})


def _need_reader(conn: sqlite3.Connection, principal: Principal) -> None:
    """Reading is open to every signed-in user with a live binding (a notice is filtered by its audience anyway); `notices.view` is the
    explicit grant for a principal without one. Not a role permission of viewer / operator / editor: adding a permission to those roles
    would raise every delegated administrator's ceiling check (a delegated admin whose own role lacks it could no longer hand out viewer)."""
    if PERM_VIEW in permissions_anywhere(conn, principal) or has_any_binding(conn, principal):
        return
    audit(conn, actor=principal, action=PERM_VIEW, decision="denied", resource_type="installation", resource_id="*", reason="no_binding")
    raise ApiError(403, "forbidden", "אין הרשאה ללוח ההודעות.", details={"permission": PERM_VIEW})


def _may_manage(conn: sqlite3.Connection, principal: Principal, audience: dict[str, Any]) -> bool:
    """Section 5.2: installation-wide manage writes any audience; a scoped manager only floors (and areas on them) inside his scope."""
    if authorize(conn, principal, PERM_MANAGE, INSTALLATION).allowed:
        return True
    if audience.get("everyone") or audience.get("groups") or audience.get("roles"):
        return False
    floors = list(audience.get("floors") or []) + aud._area_floors(conn, list(audience.get("areas") or []))
    return bool(floors) and all(authorize(conn, principal, PERM_MANAGE, ("floor", f)).allowed for f in floors)


def _require_manage(conn: sqlite3.Connection, principal: Principal, audience: dict[str, Any], notice_id: str = "*") -> None:
    if _may_manage(conn, principal, audience):
        return
    audit(conn, actor=principal, action=PERM_MANAGE, decision="denied", resource_type="notice", resource_id=notice_id, reason="audience_out_of_scope")
    raise ApiError(403, "audience_out_of_scope", "קהל היעד מחוץ לתחום ההרשאה שלך.")


# ---------------------------------------------------------------- the module (answers while off)

@open_router.get("/notices/module")
def module_state(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"enabled": store.module_on(conn), "can": _can(conn, principal)}


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool | None = None
    default_days: int | None = None
    default_severity: Literal["info", "alert"] | None = None
    push_default: Literal["by_severity", "always", "never"] | None = None
    reads_names: bool | None = None
    retention_days: int | None = None
    home_empty: Literal["hide", "line"] | None = None
    boards_remote: bool | None = None
    boards_max: int | None = None
    weather_entity: str | None = Field(default=None, max_length=200)
    weather_fallback: bool | None = None
    news_custom: bool | None = None
    building_name: str | None = Field(default=None, max_length=60)
    boards_origin: str | None = Field(default=None, max_length=220)


def _weather_entities(conn: sqlite3.Connection) -> list[dict[str, str]]:
    return [{"entity_id": r["entity_id"], "name": r["name"] or r["entity_id"]}
            for r in conn.execute("SELECT entity_id, name FROM ha_entities WHERE domain = 'weather' AND removed_at IS NULL ORDER BY name, entity_id").fetchall()]


@open_router.get("/notices/settings")
def get_settings(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    can = _can(conn, principal)
    if not (can["configure"] or can["boards"]):
        require(conn, principal, "system.configure", INSTALLATION)
    s = store.settings(conn)
    data_dir = settings_of(request).data_dir
    return {"settings": s, "can": can, "weather_entities": _weather_entities(conn), "company_logo": disp.has_company_logo(data_dir),
            "listener": bool(getattr(settings_of(request), "notice_boards", False)), "building_fallback": disp.fallback_name(conn)}


@open_router.patch("/notices/settings")
def patch_settings(body: SettingsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    patch = body.model_dump(exclude_none=True)
    try:
        values = model.settings_values(patch)
    except Invalid as exc:
        raise _invalid(exc)
    changed = store.write_settings(conn, values)
    if "notices.enabled" in changed:
        audit(conn, actor=principal, action="notices.module.enable" if changed["notices.enabled"] == "true" else "notices.module.disable",
              decision="allowed", resource_type="installation", resource_id="notices", request_id=_rid(request))
    if changed:
        audit(conn, actor=principal, action="notices.settings.update", decision="allowed", resource_type="installation", resource_id="notices",
              request_id=_rid(request), details={"keys": sorted(changed)})
    return {"settings": store.settings(conn)}


def _logo_path(request: Request) -> Path:
    return Path(settings_of(request).data_dir) / "notices" / "company-logo.png"


@open_router.put("/notices/settings/logo")
async def put_logo(request: Request, file: UploadFile = File(...), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The developer / management-company logo of the TV boards (CR-LOGOS295 is not in this build: the boards keep their own copy).
    PNG or JPEG up to 1 MB, decoded and re-encoded to a clean PNG (the bill-logo pipeline); SVG and anything else is refused."""
    require(conn, principal, "system.configure", INSTALLATION)
    from ..services.bill_pdf_logo import LogoError, sanitize_logo

    data = await file.read(1_000_001)
    try:
        png = sanitize_logo(data)
    except LogoError as exc:
        raise ApiError(422, "logo_refused", "הלוגו: PNG או JPEG עד 1MB.", details={"reason": str(exc)})
    path = _logo_path(request)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)
    conn.execute("UPDATE notice_boards SET updated_at = ? WHERE deleted_at IS NULL", (model.iso(store.utcnow()),))
    audit(conn, actor=principal, action="notices.logo.update", decision="allowed", resource_type="installation", resource_id="notices", request_id=_rid(request))
    return {"company_logo": True}


@open_router.delete("/notices/settings/logo")
def delete_logo(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    path = _logo_path(request)
    if path.is_file():
        path.unlink()
    conn.execute("UPDATE notice_boards SET updated_at = ? WHERE deleted_at IS NULL", (model.iso(store.utcnow()),))
    audit(conn, actor=principal, action="notices.logo.delete", decision="allowed", resource_type="installation", resource_id="notices", request_id=_rid(request))
    return {"company_logo": False}


@open_router.get("/notices/settings/logo")
def get_logo(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    _need_reader(conn, principal)
    path = _logo_path(request)
    if not path.is_file():
        raise ApiError(404, "not_found", "אין לוגו.")
    return Response(path.read_bytes(), media_type="image/png", headers={"Cache-Control": "private, max-age=60"})


# ---------------------------------------------------------------- boards (notices.boards) - before /notices/{notice_id}

class BoardIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=model.BOARD_NAME_MAX)
    slug: str = Field(min_length=1, max_length=model.SLUG_MAX)
    display: dict[str, Any] | None = None


class BoardPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=model.BOARD_NAME_MAX)
    enabled: bool | None = None
    display: dict[str, Any] | None = None


class ItemsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notice_ids: list[str] = Field(max_length=200)


class ControlIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cmd: Literal["next", "prev", "pause", "play"]


class PreviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display: dict[str, Any] | None = None


def _boards_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    require(conn, principal, PERM_BOARDS, INSTALLATION)
    return principal


def _boards_w(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, PERM_BOARDS, INSTALLATION)
    return principal


def _board_out(b: dict[str, Any], counts: dict[str, int]) -> dict[str, Any]:
    return {"id": b["id"], "name": b["name"], "slug": b["slug"], "enabled": bool(b["enabled"]), "display": model.load_display(b["display_json"]),
            "has_token": bool(b["token_hash"]), "token_rotated_at": b["token_rotated_at"], "last_seen_at": b["last_seen_at"],
            "item_count": counts.get(b["id"], 0), "created_at": b["created_at"], "updated_at": b["updated_at"]}


def _board_or_404(conn: sqlite3.Connection, board_id: str) -> dict[str, Any]:
    b = store.get_board(conn, board_id)
    if b is None:
        raise ApiError(404, "not_found", "הלוח לא נמצא.")
    return b


@router.get("/notices/boards")
def list_boards(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every board for notices.boards; the enabled boards' names only for a notice manager (the compose dialog's chips)."""
    can = _can(conn, principal)
    if not can["boards"]:
        _need_anywhere(conn, principal, PERM_MANAGE)
        return {"boards": [{"id": b["id"], "name": b["name"], "slug": b["slug"], "enabled": bool(b["enabled"])} for b in store.list_boards(conn)], "full": False}
    counts = store.item_counts(conn)
    s = store.settings(conn)
    return {"boards": [_board_out(b, counts) for b in store.list_boards(conn)], "full": True, "max": s["boards_max"], "remote": s["boards_remote"]}


@router.post("/notices/boards")
def create_board(body: BoardIn, request: Request, principal: Principal = Depends(_boards_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = store.settings(conn)
    if len(store.list_boards(conn)) >= s["boards_max"]:
        raise ApiError(409, "boards_limit", f"אפשר עד {s['boards_max']} לוחות תצוגה.")
    try:
        slug = model.clean_slug(body.slug)
        name = model.clean_text(body.name, "name", model.BOARD_NAME_MAX, required=True)
        display = model.merge_display(model.default_display(), body.display or {})
        board, token = store.create_board(conn, principal.user_id, name, slug, display)
    except Invalid as exc:
        raise _invalid(exc)
    audit(conn, actor=principal, action="notices.board.create", decision="allowed", resource_type="notice_board", resource_id=board["id"], request_id=_rid(request))
    return {"board": _board_out(board, {}), "token": token}


@router.get("/notices/boards/{board_id}")
def get_board(board_id: str, principal: Principal = Depends(_boards_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    b = _board_or_404(conn, board_id)
    items = store.board_notices(conn, b["id"])
    now = store.utcnow()
    return {"board": _board_out(b, store.item_counts(conn)),
            "notices": [{**_notice_brief(n), "state": model.effective_state(n, now), "position": n["position"]} for n in items]}


@router.patch("/notices/boards/{board_id}")
def patch_board(board_id: str, body: BoardPatch, request: Request, principal: Principal = Depends(_boards_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    b = _board_or_404(conn, board_id)
    cols: dict[str, Any] = {}
    try:
        if body.name is not None:
            cols["name"] = model.clean_text(body.name, "name", model.BOARD_NAME_MAX, required=True)
        if body.enabled is not None:
            cols["enabled"] = body.enabled
        if body.display is not None:
            d = model.merge_display(model.load_display(b["display_json"]), body.display)
            if d["hold"] and not conn.execute("SELECT 1 FROM notice_board_items WHERE board_id = ? AND notice_id = ?", (b["id"], d["hold"])).fetchone():
                raise Invalid("display.hold", "ההשהיה: הודעה שאינה בלוח.")
            if not store.settings(conn)["news_custom"]:
                curated = {f["url"] for f in model.CURATED_NEWS}
                if any(f["url"] not in curated for f in d["news"]["feeds"]):
                    raise Invalid("display.news.feeds", "רק מקורות מהרשימה.")
            cols["display"] = d
    except Invalid as exc:
        raise _invalid(exc)
    nb = store.update_board(conn, b["id"], principal.user_id, cols) if cols else b
    action = "notices.board.disable" if body.enabled is False and b["enabled"] else "notices.board.update"
    details: dict[str, Any] = {"keys": sorted(k for k in cols)}
    if body.display is not None:
        old = {f["url"] for f in model.load_display(b["display_json"])["news"]["feeds"]}
        curated = {f["url"] for f in model.CURATED_NEWS}
        details["custom_feeds_added"] = len([f for f in cols["display"]["news"]["feeds"] if f["url"] not in old and f["url"] not in curated])
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="notice_board", resource_id=b["id"], request_id=_rid(request), details=details)
    return {"board": _board_out(nb, store.item_counts(conn))}


@router.post("/notices/boards/{board_id}/rotate-token")
def rotate_token(board_id: str, request: Request, principal: Principal = Depends(_boards_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    b = _board_or_404(conn, board_id)
    token = store.rotate_token(conn, b["id"], principal.user_id)
    audit(conn, actor=principal, action="notices.board.rotate", decision="allowed", resource_type="notice_board", resource_id=b["id"], request_id=_rid(request))
    return {"token": token, "board": _board_out(store.get_board(conn, b["id"]), store.item_counts(conn))}  # type: ignore[arg-type]


@router.delete("/notices/boards/{board_id}")
def delete_board(board_id: str, request: Request, principal: Principal = Depends(_boards_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    b = _board_or_404(conn, board_id)
    store.delete_board(conn, b["id"], principal.user_id)
    audit(conn, actor=principal, action="notices.board.delete", decision="allowed", resource_type="notice_board", resource_id=b["id"], request_id=_rid(request))
    return {"deleted": True}


@router.put("/notices/boards/{board_id}/items")
def put_items(board_id: str, body: ItemsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_anywhere(conn, principal, PERM_MANAGE)
    b = _board_or_404(conn, board_id)
    try:
        store.set_board_items(conn, b["id"], body.notice_ids)
    except Invalid as exc:
        raise _invalid(exc)
    audit(conn, actor=principal, action="notices.board.items", decision="allowed", resource_type="notice_board", resource_id=b["id"], request_id=_rid(request),
          details={"count": len(body.notice_ids)})
    return {"notice_ids": [n["id"] for n in store.board_notices(conn, b["id"])]}


@router.post("/notices/boards/{board_id}/preview")
def preview(board_id: str, body: PreviewIn, request: Request, principal: Principal = Depends(_boards_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The Settings preview: the TV's own payload through the session, with the draft display settings when given."""
    b = _board_or_404(conn, board_id)
    d = None
    if body.display is not None:
        try:
            d = model.merge_display(model.load_display(b["display_json"]), body.display)
        except Invalid as exc:
            raise _invalid(exc)
    return disp.preview_feed(conn, b, d, settings_of(request).data_dir)


@router.get("/notices/boards/{board_id}/preview")
def preview_get(board_id: str, request: Request, principal: Principal = Depends(_boards_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return disp.preview_feed(conn, _board_or_404(conn, board_id), None, settings_of(request).data_dir)


@router.post("/notices/boards/{board_id}/control")
def control(board_id: str, body: ControlIn, request: Request, principal: Principal = Depends(_boards_w), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Section 8.6: next / previous / pause / play on the real TVs of a board, through the feed's `control` field (a 60 s lease)."""
    b = _board_or_404(conn, board_id)
    ctl = store.set_control(conn, b["id"], body.cmd)
    return {"control": {"seq": ctl["seq"], "cmd": ctl["cmd"]}}


# ---------------------------------------------------------------- notices

class NoticeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(max_length=model.TITLE_MAX * 2)
    body: str = Field(default="", max_length=model.BODY_MAX * 2)
    severity: Literal["info", "alert", "critical"] | None = None
    starts_at: str | None = Field(default=None, max_length=40)
    ends_at: str | None = Field(default=None, max_length=40)
    until_archived: bool = False
    pinned: bool | None = None
    dwell_s: int | None = None
    when_text: str | None = Field(default=None, max_length=model.WHEN_MAX * 2)
    audience: dict[str, Any] | None = None
    boards: list[str] | None = Field(default=None, max_length=50)
    publish: bool = False


class NoticePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, max_length=model.TITLE_MAX * 2)
    body: str | None = Field(default=None, max_length=model.BODY_MAX * 2)
    severity: Literal["info", "alert", "critical"] | None = None
    starts_at: str | None = Field(default=None, max_length=40)
    ends_at: str | None = Field(default=None, max_length=40)
    until_archived: bool | None = None
    pinned: bool | None = None
    dwell_s: int | None = None
    clear_dwell: bool = False
    when_text: str | None = Field(default=None, max_length=model.WHEN_MAX * 2)
    audience: dict[str, Any] | None = None
    boards: list[str] | None = Field(default=None, max_length=50)


class AudienceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audience: dict[str, Any]


def _parse_time(value: str | None, field: str) -> dt.datetime | None:
    if value in (None, ""):
        return None
    t = model.parse_iso(value)
    if t is None:
        raise Invalid(field, "תאריך לא תקין.")
    return t


def _dwell(v: int | None) -> int | None:
    if v is None:
        return None
    if not model.DWELL_MIN <= v <= model.DWELL_MAX:
        raise Invalid("dwell_s", f"זמן הצגה: {model.DWELL_MIN}-{model.DWELL_MAX} שניות.")
    return v


def _notice_brief(n: dict[str, Any]) -> dict[str, Any]:
    return {"id": n["id"], "title": n["title"], "severity": n["severity"], "starts_at": n["starts_at"], "ends_at": n["ends_at"], "pinned": bool(n["pinned"])}


def _notice_out(n: dict[str, Any], now: dt.datetime, boards: list[str], *, manager: bool, read: bool | None = None, reads: int | None = None) -> dict[str, Any]:
    out = {**_notice_brief(n), "body": n["body"], "state": model.effective_state(n, now), "dwell_s": n["dwell_s"], "when_text": n["when_text"],
           "published_at": n["published_at"], "updated_at": n["updated_at"], "boards": boards}
    if read is not None:
        out["read"] = read
    if manager:
        out["audience"] = aud.parse(n["audience_json"])
        out["status"] = n["status"]
        out["created_at"] = n["created_at"]
        if reads is not None:
            out["reads"] = reads
    return out


def _visible(conn: sqlite3.Connection, principal: Principal, n: dict[str, Any], can: dict[str, bool], now: dt.datetime, cache: dict[str, Any]) -> bool:
    if can["manage"] and _may_manage(conn, principal, aud.parse(n["audience_json"])):
        return True
    return model.effective_state(n, now) == "active" and aud.in_audience(conn, principal.user_id, aud.parse(n["audience_json"]), cache=cache)


@router.get("/notices")
def list_notices(scope: Literal["mine", "all"] = "mine", principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    can = _can(conn, principal)
    if scope == "all":
        _need_anywhere(conn, principal, PERM_MANAGE)
    else:
        _need_reader(conn, principal)
    now = store.utcnow()
    rows = store.list_notices(conn)
    cache: dict[str, Any] = {}
    if scope == "all":
        rows = [n for n in rows if _may_manage(conn, principal, aud.parse(n["audience_json"]))]
    else:
        rows = [n for n in rows if model.effective_state(n, now) == "active" and aud.in_audience(conn, principal.user_id, aud.parse(n["audience_json"]), cache=cache)]
    rows.sort(key=store.sort_key)
    boards = store.boards_of(conn, [n["id"] for n in rows])
    read = store.read_ids(conn, principal.user_id)
    counts = store.read_counts(conn) if scope == "all" else {}
    return {"notices": [_notice_out(n, now, boards[n["id"]], manager=scope == "all", read=n["id"] in read, reads=counts.get(n["id"], 0)) for n in rows],
            "can": can, "now": model.iso(now), "defaults": {k: store.settings(conn)[k] for k in ("default_days", "default_severity", "home_empty")}}


@router.post("/notices/audience/preview")
def audience_preview(body: AudienceIn, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_anywhere(conn, principal, PERM_MANAGE)
    try:
        a = model.clean_audience(body.audience)
    except Invalid as exc:
        raise _invalid(exc)
    return {"users": len(aud.resolve_users(conn, a)), "in_scope": _may_manage(conn, principal, a)}


@router.get("/notices/audience/options")
def audience_options(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The floors, groups and built-in roles the compose dialog offers (names only)."""
    _need_anywhere(conn, principal, PERM_MANAGE)
    floors = [{"id": r["id"], "name": r["name"], "building": r["bname"]} for r in conn.execute(
        """SELECT f.id, f.name, b.name AS bname FROM floors f JOIN buildings b ON b.id = f.building_id
           WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY b.sort_order, b.name, f.level, f.sort_order""").fetchall()]
    groups = [{"id": r["id"], "name": r["name"]} for r in conn.execute("SELECT id, name FROM groups ORDER BY name").fetchall()]
    from ..rbac import ROLE_NAMES_HE

    roles = [{"id": k, "name": v} for k, v in ROLE_NAMES_HE.items() if k in ("viewer", "operator", "editor", "site_admin", "system_admin", "kiosk")]
    # NOTICEPAGE-295: the named areas (rooms / zones) under each floor, for the page's places tree (an area in an audience resolves to its floor)
    areas = [{"id": r["id"], "name": r["name"], "floor": r["floor_id"]} for r in conn.execute(
        """SELECT z.id, z.name, z.floor_id FROM spatial_zones z JOIN floors f ON f.id = z.floor_id
           WHERE z.deleted_at IS NULL AND f.deleted_at IS NULL AND TRIM(z.name) <> '' ORDER BY f.level, f.sort_order, z.name LIMIT 500""").fetchall()]
    return {"floors": floors, "areas": areas, "groups": groups, "roles": roles}


def _get_visible(conn: sqlite3.Connection, principal: Principal, notice_id: str) -> tuple[dict[str, Any], dict[str, bool]]:
    n = store.get_notice(conn, notice_id)
    can = _can(conn, principal)
    if n is None or not _visible(conn, principal, n, can, store.utcnow(), {}):
        raise ApiError(404, "not_found", "ההודעה לא נמצאה.")
    return n, can


@router.get("/notices/{notice_id}")
def get_notice(notice_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _need_reader(conn, principal)
    n, can = _get_visible(conn, principal, notice_id)
    manager = can["manage"] and _may_manage(conn, principal, aud.parse(n["audience_json"]))
    return {"notice": _notice_out(n, store.utcnow(), store.boards_of(conn, [n["id"]])[n["id"]], manager=manager)}


def _window(conn: sqlite3.Connection, severity: str, starts: dt.datetime | None, ends: dt.datetime | None, until_archived: bool) -> tuple[str, str | None]:
    now = store.utcnow()
    start = starts or now
    end = ends
    if end is None and not until_archived:
        end = start + dt.timedelta(days=store.settings(conn)["default_days"])
    store.validate_window(severity, start, end)
    return model.iso(start), (model.iso(end) if end else None)


@router.post("/notices")
def create_notice(body: NoticeIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_anywhere(conn, principal, PERM_MANAGE)
    try:
        severity = body.severity or store.settings(conn)["default_severity"]
        audience = model.clean_audience(body.audience if body.audience is not None else {"everyone": True})
        starts, ends = _window(conn, severity, _parse_time(body.starts_at, "starts_at"), _parse_time(body.ends_at, "ends_at"), body.until_archived)
        data = {"title": model.clean_text(body.title, "title", model.TITLE_MAX, required=True),
                "body": model.clean_text(body.body, "body", model.BODY_MAX, multiline=True), "severity": severity,
                "starts_at": starts, "ends_at": ends, "pinned": body.pinned if body.pinned is not None else severity == "critical",
                "dwell_s": _dwell(body.dwell_s), "when_text": model.clean_text(body.when_text, "when_text", model.WHEN_MAX),
                "audience": audience, "boards": body.boards}
    except Invalid as exc:
        raise _invalid(exc)
    _require_manage(conn, principal, audience)  # tagging a notice to a TV board is part of notices.manage (section 6)
    try:
        n = store.create_notice(conn, principal.user_id, data)
    except Invalid as exc:
        raise _invalid(exc)
    audit(conn, actor=principal, action="notices.create", decision="allowed", resource_type="notice", resource_id=n["id"], request_id=_rid(request),
          details={"audience": aud.summary(conn, audience), "boards": len(body.boards or [])})
    if body.publish:
        store.publish(conn, n["id"], principal.user_id)
        audit(conn, actor=principal, action="notices.publish", decision="allowed", resource_type="notice", resource_id=n["id"], request_id=_rid(request))
        n = store.get_notice(conn, n["id"])
    return {"notice": _notice_out(n, store.utcnow(), store.boards_of(conn, [n["id"]])[n["id"]], manager=True)}  # type: ignore[index]


def _managed(conn: sqlite3.Connection, principal: Principal, notice_id: str) -> dict[str, Any]:
    _need_anywhere(conn, principal, PERM_MANAGE)
    n = store.get_notice(conn, notice_id)
    if n is None:
        raise ApiError(404, "not_found", "ההודעה לא נמצאה.")
    if not _may_manage(conn, principal, aud.parse(n["audience_json"])):
        if not aud.in_audience(conn, principal.user_id, aud.parse(n["audience_json"])):
            raise ApiError(404, "not_found", "ההודעה לא נמצאה.")
        _require_manage(conn, principal, aud.parse(n["audience_json"]), notice_id)
    return n


@router.patch("/notices/{notice_id}")
def patch_notice(notice_id: str, body: NoticePatch, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    n = _managed(conn, principal, notice_id)
    if n["status"] == "archived":
        raise ApiError(409, "archived", "הודעה בארכיון אינה נערכת.")
    data: dict[str, Any] = {}
    try:
        if body.title is not None:
            data["title"] = model.clean_text(body.title, "title", model.TITLE_MAX, required=True)
        if body.body is not None:
            data["body"] = model.clean_text(body.body, "body", model.BODY_MAX, multiline=True)
        severity = body.severity or n["severity"]
        if body.severity is not None:
            data["severity"] = body.severity
        if body.pinned is not None:
            data["pinned"] = body.pinned
        if body.clear_dwell:
            data["dwell_s"] = None
        elif body.dwell_s is not None:
            data["dwell_s"] = _dwell(body.dwell_s)
        if body.when_text is not None:
            data["when_text"] = model.clean_text(body.when_text, "when_text", model.WHEN_MAX)
        if body.audience is not None:
            data["audience"] = model.clean_audience(body.audience)
        start = _parse_time(body.starts_at, "starts_at") if body.starts_at is not None else model.parse_iso(n["starts_at"])
        if body.until_archived:
            end = None
        elif body.ends_at is not None:
            end = _parse_time(body.ends_at, "ends_at")
        else:
            end = model.parse_iso(n["ends_at"])
        store.validate_window(severity, start or store.utcnow(), end)
        if body.starts_at is not None:
            data["starts_at"] = model.iso(start)  # type: ignore[arg-type]
        if body.ends_at is not None or body.until_archived:
            data["ends_at"] = model.iso(end) if end else None
        if body.boards is not None:
            data["boards"] = body.boards
    except Invalid as exc:
        raise _invalid(exc)
    if "audience" in data:
        _require_manage(conn, principal, data["audience"], notice_id)
    try:
        n2 = store.update_notice(conn, notice_id, principal.user_id, data)
    except Invalid as exc:
        raise _invalid(exc)
    audit(conn, actor=principal, action="notices.update", decision="allowed", resource_type="notice", resource_id=notice_id, request_id=_rid(request),
          details={"keys": sorted(data)})
    return {"notice": _notice_out(n2, store.utcnow(), store.boards_of(conn, [notice_id])[notice_id], manager=True)}


@router.post("/notices/{notice_id}/publish")
def publish(notice_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    n = _managed(conn, principal, notice_id)
    if n["status"] != "draft":
        raise ApiError(409, "not_draft", "רק טיוטה מתפרסמת.")
    store.validate_window(n["severity"], model.parse_iso(n["starts_at"]) or store.utcnow(), model.parse_iso(n["ends_at"]))
    store.publish(conn, notice_id, principal.user_id)
    audit(conn, actor=principal, action="notices.publish", decision="allowed", resource_type="notice", resource_id=notice_id, request_id=_rid(request))
    n2 = store.get_notice(conn, notice_id)
    return {"notice": _notice_out(n2, store.utcnow(), store.boards_of(conn, [notice_id])[notice_id], manager=True)}  # type: ignore[arg-type]


@router.post("/notices/{notice_id}/archive")
def archive(notice_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _managed(conn, principal, notice_id)
    store.archive(conn, notice_id, principal.user_id)
    audit(conn, actor=principal, action="notices.archive", decision="allowed", resource_type="notice", resource_id=notice_id, request_id=_rid(request))
    n2 = store.get_notice(conn, notice_id)
    return {"notice": _notice_out(n2, store.utcnow(), store.boards_of(conn, [notice_id])[notice_id], manager=True)}  # type: ignore[arg-type]


@router.delete("/notices/{notice_id}")
def delete_notice(notice_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    n = _managed(conn, principal, notice_id)
    if n["status"] != "draft":
        raise ApiError(409, "not_draft", "הודעה שפורסמה עוברת לארכיון ואינה נמחקת.")
    store.delete_draft(conn, notice_id)
    audit(conn, actor=principal, action="notices.delete", decision="allowed", resource_type="notice", resource_id=notice_id, request_id=_rid(request))
    return {"deleted": True}


@router.post("/notices/{notice_id}/read")
def mark_read(notice_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _need_reader(conn, principal)
    _get_visible(conn, principal, notice_id)
    store.mark_read(conn, notice_id, principal.user_id)
    return {"read": True}


@router.get("/notices/{notice_id}/reads")
def reads(notice_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Who read (owner decision 2026-10-24: names visible to notice managers; `notices.reads_names = false` -> counts only)."""
    n = _managed(conn, principal, notice_id)
    users = aud.resolve_users(conn, aud.parse(n["audience_json"]))
    rows = {r["user_id"]: r["read_at"] for r in conn.execute("SELECT user_id, read_at FROM notice_reads WHERE notice_id = ?", (notice_id,)).fetchall()}
    out: dict[str, Any] = {"audience": len(users), "read": len([u for u in users if u in rows])}
    if store.settings(conn)["reads_names"]:
        names = {r["id"]: (r["display_name"] or r["username"]) for r in conn.execute("SELECT id, display_name, username FROM users").fetchall()}
        place = aud.places_of(conn, users)
        out["users"] = [{"user_id": u, "name": names.get(u, u), "place": place.get(u, ""), "read_at": rows[u]} for u in users if u in rows]
        out["unread"] = [{"user_id": u, "name": names.get(u, u), "place": place.get(u, "")} for u in users if u not in rows]
    return out


# ---------------------------------------------------------------- display routes (no login)

def _display_service(request: Request) -> disp.DisplayService:
    svc = getattr(request.app.state, "notice_display", None)
    if svc is None:
        db = request.app.state.db
        svc = disp.DisplayService(lambda: db.connection(mode="read", label="notices.display"), settings_of(request).data_dir, touch=disp.touch_seen(db),
                                  limiter=disp.RateLimiter())  # the application's own counters (the LAN listener has its own too)
        request.app.state.notice_display = svc
    return svc


def _client(request: Request) -> str:
    return request.client.host if request.client else ""


def _respond(r: disp.Reply) -> Response:
    resp = Response(r.body, status_code=r.status, media_type=r.content_type.split(";")[0])
    for k, v in r.all_headers():
        if k.lower() == "content-type":
            continue
        resp.headers[k] = v
    if r.content_type.startswith(("application/json", "text/")):
        resp.headers["Content-Type"] = r.content_type
    return resp


def _is_remote(request: Request) -> bool:
    from ..remote_channel import is_remote

    return is_remote(request)


@display_router.get("/notices/display/{slug}")
def display_feed(slug: str, request: Request) -> Response:
    req = disp.Request(slug=slug, token=request.headers.get("x-board-token"), if_none_match=request.headers.get("if-none-match"), client=_client(request),
                       remote=_is_remote(request))
    return _respond(_display_service(request).feed(req))


@display_router.get("/notices/display/{slug}/logo/company")
def display_logo(slug: str, request: Request) -> Response:
    req = disp.Request(slug=slug, token=request.headers.get("x-board-token"), client=_client(request), remote=_is_remote(request),
                       variant=request.query_params.get("variant", "light"))
    return _respond(_display_service(request).logo(req))


@page_router.get("/b/{slug}", include_in_schema=False)
def tv_page(slug: str, request: Request) -> Response:
    """The static TV page. It carries nothing of the board (the board is read by the page with its token), so it answers for any
    slug shape-valid name; the feed is where a wrong link is refused."""
    if not disp.SLUG_PATH.match(slug):
        return _respond(disp.not_found())
    if _is_remote(request):
        with request.app.state.db.connection(mode="read", label="notices.page") as conn:
            if not store.settings(conn)["boards_remote"]:
                return _respond(disp.not_found())
    html = page.page_html(settings_of(request).www_dir)
    if html is None:
        return _respond(disp.not_found())
    return _respond(disp.Reply(200, html, "text/html; charset=utf-8"))
