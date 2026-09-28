"""The device-control screens' layout editor (CR-007 slice 6b, owner decisions 7.11).

One layout per installation and screen, stored here, shown to everyone who reads the screens, edited only by a holder
of `system.configure`:
- scope `building`, id `main`: the building screen - its floor cards (keys `floor:<floor id>`, the "כרטיסים" view)
  and its area tiles (keys `area:<area id>`, the "אריחים" view);
- scope `area`, id = an HA area id (or `unassigned`): that area screen's domain cards (keys `card:<card id>`).
Each record has a `desktop` variant (a 12-column grid) and optionally a `phone` variant (4 columns). No record means
the automatic layout; the phone layout is derived from the desktop one in the browser until it is edited on its own.

The layout is presentation only: grid units (column, 8 px row), a text size step, colour ROLES of the active palette
(never a colour value), a title, an icon of the product's set and "hidden". Nothing here reaches Home Assistant.

Routes: `GET /devices/layouts/{scope}/{id}` (devices.read anywhere), `PUT` (one variant, optimistic `revision`, 409
when stale), `DELETE` (reset: one variant or both), `POST /devices/layouts/area/{id}/copy-to-all-areas`. Every write
checks `system.configure` BEFORE the body is read (the permission-first, JSON-only envelope of routers/devices.py) and
is audited with the scope, the id and the revision only - never the layout itself."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from ..services import devices as svc
from ..services import ha_scope
from .devices import READ, _configure_holder, _is_json, _raw_body

router = APIRouter()

SCOPES = ("building", "area")
VARIANTS = ("desktop", "phone")
BUILDING_ID = "main"
COLUMNS = {"desktop": 12, "phone": 4}
MAX_BODY = 64 * 1024
MAX_ITEMS = 300
MAX_ROW = 4000  # in 8 px rows: 32 000 px, far below anything a screen shows
MAX_SPAN_ROWS = 400
ID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")
BUILDING_KEY_RE = re.compile(r"^(floor|area):[A-Za-z0-9_.-]{1,128}$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f‪-‮⁦-⁩]")

# The palette roles a card's background / border may take (frontend/src/styles/devices-palettes.ts resolves each per
# theme and colour scheme). Never a colour value: an edited layout looks right in every theme.
ROLES = ("accent", "warm", "cool", "success", "warning", "danger", "neutral")
TEXT_SIZES = ("sm", "md", "lg")
# The icons a card may carry, all from the product's own set (components/sw-icon.ts). Keep in step with LAYOUT_ICONS in
# frontend/src/screens/devices-layout.ts (tests/test_device_layouts.py compares the two).
ICONS = (
    "light", "bolt", "activity", "layers", "shield", "play", "sensor", "home", "building", "floor", "stairs", "elevator",
    "lock", "door", "camera", "eye", "bell", "clock", "calendar", "wifi", "volume", "users", "map", "grid", "dashboard",
    "star", "sparkle", "cube", "hand", "info",
)

Role = Literal["accent", "warm", "cool", "success", "warning", "danger", "neutral"]
TextSize = Literal["sm", "md", "lg"]


class LayoutItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)  # no "yes" for true, no "3" for 3
    x: int = Field(ge=0, le=11)
    y: int = Field(ge=0, le=MAX_ROW)
    w: int = Field(ge=1, le=12)
    h: int = Field(ge=1, le=MAX_SPAN_ROWS)
    text: TextSize = "md"
    bg: Role | None = None
    border: Role | None = None
    title: str | None = Field(None, max_length=60)
    icon: str | None = None
    hidden: bool = False

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if CONTROL_RE.search(v):
            raise ValueError("control characters are not allowed in a title")
        v = v.strip()
        return v or None

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        if v is not None and v not in ICONS:
            raise ValueError("unknown icon")
        return v


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    v: Literal[1] = 1
    cols: int
    items: dict[str, LayoutItem] = Field(max_length=MAX_ITEMS)


class PutBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    variant: Literal["desktop", "phone"]
    revision: int = Field(ge=0)  # the revision the editor started from; 0 = there was no record
    layout: Layout


class CopyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int | None = Field(None, ge=0)  # the source's desktop revision the editor saw (409 when it moved on)


def _check_scope(scope: str, scope_id: str) -> None:
    if scope not in SCOPES:
        raise ApiError(404, "not_found", "אין פריסה מהסוג הזה.")
    if not ID_RE.fullmatch(scope_id) or (scope == "building" and scope_id != BUILDING_ID):
        raise ApiError(404, "not_found", "אין פריסה כזו.")


def _known_areas(conn: sqlite3.Connection) -> list[str]:
    _floors, areas = svc.load_structure(conn, svc.load_entities(conn))
    return [a["area_id"] for a in areas]


def _check_exists(conn: sqlite3.Connection, scope: str, scope_id: str) -> None:
    if scope == "area" and scope_id != svc.UNASSIGNED and scope_id not in _known_areas(conn):
        raise ApiError(404, "area_not_found", "האזור לא נמצא ב־Home Assistant.")


def _validate_semantics(scope: str, variant: str, layout: Layout) -> list[str]:
    """What pydantic cannot say alone: the variant's column count, items inside the grid, keys of this screen."""
    errors: list[str] = []
    cols = COLUMNS[variant]
    if layout.cols != cols:
        errors.append(f"layout.cols must be {cols} for the {variant} layout")
    for key, it in layout.items.items():
        if scope == "building" and not BUILDING_KEY_RE.fullmatch(key):
            errors.append(f"layout.items.{key[:40]}: the building screen lays out floor:<id> and area:<id> only")
        if scope == "area" and key not in {f"card:{c}" for c in svc.CARD_IDS}:
            errors.append(f"layout.items.{key[:40]}: the area screen lays out its cards (card:<id>) only")
        if it.x + it.w > cols:
            errors.append(f"layout.items.{key[:40]}: x + w exceeds the {cols} columns")
    return errors


def _parse(request: Request, raw: bytes, model: type[BaseModel]) -> BaseModel:
    content_type = request.headers.get("content-type")
    if not _is_json(content_type):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]})
    if len(raw) > MAX_BODY:
        raise ApiError(413, "too_large", "הפריסה גדולה מדי.", details={"max_bytes": MAX_BODY})
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הפריסה אינה תקינה: " + ", ".join(fields[:12]), details={"fields": fields[:50]}) from None


def _row(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str) -> dict[str, Any] | None:
    r = conn.execute(
        "SELECT l.layout_json, l.revision, l.updated_by, l.updated_at, u.display_name, u.username FROM device_layouts l LEFT JOIN users u ON u.id = l.updated_by"
        " WHERE l.scope = ? AND l.scope_id = ? AND l.variant = ?",
        (scope, scope_id, variant),
    ).fetchone()
    if not r:
        return None
    return {"layout": json.loads(r["layout_json"]), "revision": r["revision"], "updated_by": r["display_name"] or r["username"] or r["updated_by"], "updated_at": r["updated_at"]}


def _record(conn: sqlite3.Connection, principal: Principal, scope: str, scope_id: str) -> dict[str, Any]:
    return {
        "scope": scope,
        "id": scope_id,
        "desktop": _row(conn, scope, scope_id, "desktop"),
        "phone": _row(conn, scope, scope_id, "phone"),
        "can_edit": authorize(conn, principal, "system.configure", INSTALLATION).allowed,
    }


def _revision(conn: sqlite3.Connection, scope: str, scope_id: str, variant: str) -> int:
    r = conn.execute("SELECT revision FROM device_layouts WHERE scope = ? AND scope_id = ? AND variant = ?", (scope, scope_id, variant)).fetchone()
    return int(r["revision"]) if r else 0


def _write(conn: sqlite3.Connection, principal: Principal, scope: str, scope_id: str, variant: str, layout_json: str) -> int:
    rev = _revision(conn, scope, scope_id, variant) + 1
    conn.execute(
        "INSERT INTO device_layouts(scope, scope_id, variant, layout_json, revision, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        " ON CONFLICT(scope, scope_id, variant) DO UPDATE SET layout_json = excluded.layout_json, revision = excluded.revision,"
        " updated_by = excluded.updated_by, updated_at = excluded.updated_at",
        (scope, scope_id, variant, layout_json, rev, principal.user_id, now_iso()),
    )
    return rev


@router.get("/devices/layouts/{scope}/{scope_id}")
def get_layout(scope: str, scope_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The screen's stored layout (desktop and phone; null = automatic) - everyone who reads the device screens."""
    ha_scope.scoped_rows(conn, principal, READ, [])  # the audited 403 without devices.read anywhere
    _check_scope(scope, scope_id)
    return _record(conn, principal, scope, scope_id)


@router.put("/devices/layouts/{scope}/{scope_id}")
def put_layout(scope: str, scope_id: str, request: Request, principal: Principal = Depends(_configure_holder), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Save one variant. `revision` is the one the editor started from (0 = none); another save in between is a 409
    `layout_conflict` with the current revision, and nothing is written."""
    _check_scope(scope, scope_id)
    body = _parse(request, raw, PutBody)
    assert isinstance(body, PutBody)
    errors = _validate_semantics(scope, body.variant, body.layout)
    if errors:
        raise ApiError(422, "validation", "הפריסה אינה תקינה: " + "; ".join(errors[:5]), details={"errors": errors[:50]})
    _check_exists(conn, scope, scope_id)
    current = _revision(conn, scope, scope_id, body.variant)
    if body.revision != current:
        raise ApiError(409, "layout_conflict", "מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש וערכו שוב.", details={"revision": current})
    rev = _write(conn, principal, scope, scope_id, body.variant, json.dumps(body.layout.model_dump(exclude_defaults=False), ensure_ascii=False, separators=(",", ":")))
    audit(conn, actor=principal, action="devices.layout.update", decision="allowed", resource_type=f"device_layout_{scope}", resource_id=scope_id,
          request_id=getattr(request.state, "correlation_id", None), details={"scope": scope, "id": scope_id, "variant": body.variant, "revision": rev})
    return _record(conn, principal, scope, scope_id)


@router.delete("/devices/layouts/{scope}/{scope_id}")
def reset_layout(
    scope: str,
    scope_id: str,
    request: Request,
    principal: Principal = Depends(_configure_holder),
    conn: sqlite3.Connection = Depends(get_conn),
    variant: Literal["desktop", "phone", "all"] = Query("all"),
    revision: int | None = Query(None, ge=0),
) -> dict[str, Any]:
    """Back to the automatic layout: `all` ("אפס לברירת מחדל": desktop and phone) or one variant (`phone`: "חזור
    לאוטומטי" - the phone layout is derived from the desktop one again). `revision`, when given, must be the current
    revision of the desktop record (`all` / `desktop`) or of the phone record (`phone`)."""
    _check_scope(scope, scope_id)
    variants = VARIANTS if variant == "all" else (variant,)
    if revision is not None:
        current = _revision(conn, scope, scope_id, "phone" if variant == "phone" else "desktop")
        if revision != current:
            raise ApiError(409, "layout_conflict", "מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש.", details={"revision": current})
    before = {v: _revision(conn, scope, scope_id, v) for v in variants}
    conn.execute(f"DELETE FROM device_layouts WHERE scope = ? AND scope_id = ? AND variant IN ({', '.join('?' * len(variants))})", (scope, scope_id, *variants))
    audit(conn, actor=principal, action="devices.layout.reset", decision="allowed", resource_type=f"device_layout_{scope}", resource_id=scope_id,
          request_id=getattr(request.state, "correlation_id", None), details={"scope": scope, "id": scope_id, "variant": variant, "revision": before})
    return _record(conn, principal, scope, scope_id)


@router.post("/devices/layouts/area/{scope_id}/copy-to-all-areas")
def copy_to_all_areas(scope_id: str, request: Request, principal: Principal = Depends(_configure_holder), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """This area's STORED layout becomes every other area's (the "ללא שיוך" bucket included): the desktop record and,
    when this area has one, the phone record; an area whose phone layout was edited but whose source has none goes back
    to the derived phone layout. The screens confirm first; one audit row (scope, id, revision, how many areas)."""
    _check_scope("area", scope_id)
    body = _parse(request, raw, CopyBody)
    assert isinstance(body, CopyBody)
    _check_exists(conn, "area", scope_id)
    src_rev = _revision(conn, "area", scope_id, "desktop")
    if not src_rev:
        raise ApiError(409, "nothing_to_copy", "לאזור הזה אין פריסה שמורה להעתקה. שמרו אותה קודם.")
    if body.revision is not None and body.revision != src_rev:
        raise ApiError(409, "layout_conflict", "מישהו אחר שמר את הפריסה בינתיים. טענו אותה מחדש.", details={"revision": src_rev})
    src = {r["variant"]: r["layout_json"] for r in conn.execute("SELECT variant, layout_json FROM device_layouts WHERE scope = 'area' AND scope_id = ?", (scope_id,)).fetchall()}
    targets = [a for a in [*_known_areas(conn), svc.UNASSIGNED] if a != scope_id]
    for area_id in targets:
        _write(conn, principal, "area", area_id, "desktop", src["desktop"])
        if "phone" in src:
            _write(conn, principal, "area", area_id, "phone", src["phone"])
        else:
            conn.execute("DELETE FROM device_layouts WHERE scope = 'area' AND scope_id = ? AND variant = 'phone'", (area_id,))
    audit(conn, actor=principal, action="devices.layout.copy", decision="allowed", resource_type="device_layout_area", resource_id=scope_id,
          request_id=getattr(request.state, "correlation_id", None), details={"scope": "area", "id": scope_id, "revision": src_rev, "areas": len(targets)})
    return {"copied_to": len(targets), "source": _record(conn, principal, "area", scope_id)}
