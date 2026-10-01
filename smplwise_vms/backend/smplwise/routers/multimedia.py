"""The multimedia API (CR-015, "מולטימדיה · מסכים ושלט"): docs/architecture/MEDIA_API.md is the binding contract (section numbers in the
comments below). Screens are PHYSICAL devices built from Home Assistant endpoints (services/media_model.py); the page lists them, the
remote sends commands, the administrator decides which detected screens are managed.

Routes (all under /api/v1/multimedia; `/api/v1/media/*` is the camera video router): `GET status` (3.1), `GET devices` (3.2),
`GET devices/{key}` (3.3), `POST devices/{key}/commands` (3.4), `GET devices/{key}/artwork` (3.5), `GET / PUT / DELETE layout` (3.6),
`GET / PUT remote-default` (3.7), `PUT devices/{key}/remote` (3.8), `GET actions/preview` + `POST actions` (3.9), `GET profiles` (3.10),
`GET admin/devices` (3.11), `PUT admin/devices/{key}` (3.12), `POST admin/links` (3.13), `POST admin/approve` (3.14). The personal layout
(3.15) is the existing `PUT /me/prefs` key `multimedia.personal` (routers/me.py).

The permission comes before the body (audited 403); a device the caller may not read - or one nobody approved - is 404, never 403 and
never listed; `multimedia.enabled = false` answers 404 `feature_disabled` everywhere but the status and the administration. Every
command goes through services/media_commands.py and the signed bridge as the caller's own HA user."""
from __future__ import annotations

import json
import sqlite3
import uuid
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import Database, commit_now, get_setting, now_iso, rollback_and_restart, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import device_bulk as bulk
from ..services import ha_bridge, ha_client, ha_sync, media_commands, media_layout, media_model as mm, media_profiles as profiles, media_store as store, user_prefs
from .devices import _envelope, _is_json, _raw_body

router = APIRouter()
COMMAND_ID = r"^[A-Za-z0-9-]{8,64}$"
RID = Field(min_length=8, max_length=80)
PERSONALIZE = "screen.personalize"


# ---------------------------------------------------------------- plumbing

class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _parse(request: Request, raw: bytes, body_model: type[BaseModel]) -> Any:
    """JSON only, then the closed body model; a failure is a 415 / 422 in the shared envelope."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        return body_model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


def _feature_or_404(conn: sqlite3.Connection) -> None:
    if not store.enabled(conn):
        raise ApiError(404, "feature_disabled", "המולטימדיה כבויה בהגדרות המערכת.")


def _check_reader(conn: sqlite3.Connection, principal: Principal) -> None:
    """media.read somewhere (installation or a floor); the audited 403 otherwise, and 404 feature_disabled when the feature is off."""
    if not store.Access(conn, principal, (store.PERM_READ,)).anywhere(store.PERM_READ):
        require(conn, principal, store.PERM_READ, INSTALLATION)
    _feature_or_404(conn)


_reader_gate = read_gate(_check_reader)


def _check_layout(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, store.PERM_LAYOUT, INSTALLATION)
    _feature_or_404(conn)


_layout_gate = read_gate(_check_layout)


def _check_configure(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, store.CONFIGURE, INSTALLATION)


_configure_gate = read_gate(_check_configure)


def _check_bulk(conn: sqlite3.Connection, principal: Principal) -> None:
    if not store.Access(conn, principal, (store.PERM_BULK,)).anywhere(store.PERM_BULK):
        require(conn, principal, store.PERM_BULK, INSTALLATION)
    _feature_or_404(conn)


_bulk_gate = read_gate(_check_bulk)


def _changed(background: BackgroundTasks, reason: str) -> None:
    """Tell the open clients to refetch - after the response (and so after the commit)."""
    background.add_task(ha_sync.publish, {"type": "media_devices_changed", "reason": reason})


# ---------------------------------------------------------------- 3.1 status

@router.get("/multimedia/status")
def multimedia_status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return store.status(conn, principal)


# ---------------------------------------------------------------- 3.2 / 3.3 devices

@router.get("/multimedia/devices")
def list_devices(
    principal: Principal = Depends(_reader_gate),
    conn: sqlite3.Connection = Depends(get_read_conn),
    kind: Literal["screen", "receiver", "speaker", "player", "group"] = "screen",
    floor: str | None = Query(None, max_length=128),
    area: str | None = Query(None, max_length=128),
    q: str | None = Query(None, max_length=80),
) -> dict[str, Any]:
    """The approved screens the caller may read, sorted by name (0.1.149 lists `screen` only; another kind is an empty list)."""
    if kind != "screen":
        return {"devices": []}
    cat = store.load_catalog(conn)
    access = store.Access(conn, principal)
    out = []
    text = (q or "").strip().casefold()
    for item in sorted(store.visible_items(cat, access), key=lambda i: (i.name.casefold(), i.key)):
        d = store.device_item(cat, item, access)
        if floor and d["floor_id"] != floor or area and d["area_id"] != area:
            continue
        if text and text not in d["name"].casefold() and text not in (d["area_name"] or "").casefold():
            continue
        out.append(d)
    return {"devices": out}


@router.get("/multimedia/devices/{key}")
def get_device(key: str, curation: bool = Query(False), principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`?curation=1` is the remote editor's read: hidden sources / apps included, each with its default name - only for a holder of
    media.layout at the screen's anchor (anyone else gets the ordinary detail)."""
    cat, item, access = store.find_visible(conn, principal, key)
    if curation and store.Access(conn, principal, (store.PERM_LAYOUT,)).has(store.PERM_LAYOUT, item.row.get("anchor_entity_id")):
        return store.device_detail(conn, cat, item, access, curation=True)
    return store.device_detail(conn, cat, item, access)


# ---------------------------------------------------------------- 3.4 commands

class CommandBody(_Body):
    command: Literal["power_on", "power_off", "volume_set", "volume_step", "mute", "source", "app", "sound_output", "transport", "key", "text"]
    level: Any = None
    direction: Any = None
    muted: Any = None
    target: Any = None
    source_id: Any = None
    app_id: Any = None
    output: Any = None
    action: Any = None
    key: Any = None
    text: Any = None
    client_request_id: str = RID
    expires_at: str = Field(min_length=1, max_length=40)


COMMAND_FIELDS: dict[str, set[str]] = {
    "power_on": set(), "power_off": set(), "volume_set": {"level", "target"}, "volume_step": {"direction", "target"}, "mute": {"muted", "target"},
    "source": {"source_id"}, "app": {"app_id"}, "sound_output": {"output"}, "transport": {"action"}, "key": {"key"}, "text": {"text"},
}


class _Admitted:
    """A command that passed everything that needs no catalogue: the caller's permission at the anchor, the body's shape, the rate limits."""

    def __init__(self, principal: Principal, cmd: dict[str, Any], body: "CommandBody") -> None:
        self.principal, self.cmd, self.body = principal, cmd, body


def _command_early(key: str, request: Request, principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> media_commands.Admission:
    """The anchor-level check before the body is read (the read-gate pattern): 404 for a screen the caller may not see, 403 without
    media.control / media.power at its anchor - whatever the body holds."""
    return media_commands.early(conn, principal, _rid(request), key)


def _command_admitted(request: Request, adm: media_commands.Admission = Depends(_command_early), principal: Principal = Depends(_reader_gate), raw: bytes = Depends(_raw_body),
                      conn: sqlite3.Connection = Depends(get_read_conn)) -> _Admitted:
    """The body, then the permission this command needs and its rate limits - all on the READ connection, so a refused or dropped
    command never takes the write lock and never loads the catalogue."""
    body: CommandBody = _parse(request, raw, CommandBody)
    allowed = COMMAND_FIELDS[body.command]
    given = {f for f in ("level", "direction", "muted", "target", "source_id", "app_id", "output", "action", "key", "text") if getattr(body, f) is not None}
    if given - allowed:
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(sorted(given - allowed)), details={"fields": sorted(given - allowed)})
    cmd = {"command": body.command, **{f: getattr(body, f) for f in allowed if getattr(body, f) is not None}}
    if cmd.get("target") not in (None, "screen", "linked"):
        raise ApiError(422, "validation", "יעד שמע לא מוכר.", details={"fields": ["target"]})
    media_commands.admit(conn, principal, _rid(request), adm, cmd)
    return _Admitted(principal, cmd, body)


@router.post("/multimedia/devices/{key}/commands", status_code=202)
def send_command(key: str, request: Request, admitted: _Admitted = Depends(_command_admitted), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """One command of the remote to one screen (contract 3.4): 202 `{command_id, status: "accepted" | "sent", action_id, confirm, error}`;
    200 with `status: "refused"` when the bridge or Home Assistant said no (audited). Refused before anything is sent, all audited:
    403 forbidden / public_screen, 404, 409 screen_off / unavailable / power_pending / expired, 422 not_supported / validation,
    429 rate_limited, 503 bridge_outdated / bridge_not_paired / ha_unavailable. Order: media.read (404) and media.control | media.power
    at the anchor (403) before the body is read; then the body (415 / 422), the permission of this command and the rate limits (429)
    - on the read connection; only then the catalogue and the write lock."""
    principal = admitted.principal
    cat, item, access = store.find_visible(conn, principal, key)
    status, result = media_commands.run(conn, settings_of(request), principal, _rid(request), cat, item, access, admitted.cmd, admitted.body.client_request_id, admitted.body.expires_at)
    return JSONResponse(status_code=status, content=result)


# ---------------------------------------------------------------- 3.5 artwork

@router.get("/multimedia/devices/{key}/artwork")
def artwork(key: str, request: Request, v: str | None = Query(None, max_length=64), principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The content art of what the screen is playing, proxied through the add-on's HA session (never an HA URL in the browser). Only
    real content art (Cast / MA metadata of a video, movie, episode, show or music track) - never an app or channel logo; 404 otherwise."""
    cat, item, _access = store.find_visible(conn, principal, key)
    hit = store.artwork_for(item.view.prim.get("now_playing"))
    if hit is None:
        raise ApiError(404, "not_found", "אין תמונה.")
    data, media_type = ha_client.media_artwork(settings_of(request), hit[0])
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, max-age=60"})


# ---------------------------------------------------------------- 3.6 layout

class LayoutBody(_Body):
    layout: dict[str, Any]
    base_revision: int = Field(ge=0)


def _layout_response(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    layout, revision = store.read_layout(conn)
    held = set(permissions_anywhere(conn, principal))
    personalize = PERSONALIZE in held
    can_edit = authorize(conn, principal, store.PERM_LAYOUT, INSTALLATION).allowed
    personal = None
    if personalize:
        stored = user_prefs.get_prefs(conn, principal.user_id)["prefs"].get(user_prefs.PERSONAL_MEDIA_KEY)
        personal = stored if stored and not media_layout.personal_is_empty(stored) else None
    if not can_edit or personal is not None:  # only what the caller may see (the editor's installation layout is whole: a save replaces it)
        cat = store.load_catalog(conn)
        seen = store.visible_items(cat, store.Access(conn, principal, (store.PERM_READ,)))
        keys = {i.key for i in seen}
        if not can_edit:
            layout = media_layout.restrict_layout(layout, keys, {f for f in (store.floor_area(i)["floor_id"] for i in seen) if f})
        if personal is not None:
            personal = media_layout.restrict_personal(personal, keys)
    return {"installation": layout, "personal": personal, "revision": revision, "can_edit": can_edit, "can_personalize": personalize}


@router.get("/multimedia/layout")
def get_layout(principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return _layout_response(conn, principal)


@router.put("/multimedia/layout")
def put_layout(request: Request, background: BackgroundTasks, principal: Principal = Depends(_layout_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body: LayoutBody = _parse(request, raw, LayoutBody)
    try:
        layout = media_layout.normalise_layout(body.layout)
    except ValueError as exc:
        raise ApiError(422, "validation", "פריסת המסך אינה תקינה.", details={"fields": ["layout"], "reason": str(exc)}) from None
    revision = store.write_layout(conn, principal, layout, body.base_revision)
    audit(conn, actor=principal, action="media.layout.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"revision": revision})
    _changed(background, "layout")
    return _layout_response(conn, principal)


@router.delete("/multimedia/layout", status_code=204)
def reset_layout(request: Request, background: BackgroundTasks, principal: Principal = Depends(_layout_gate), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    revision = store.write_layout(conn, principal, media_layout.default_layout(), None)
    audit(conn, actor=principal, action="media.layout.reset", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"revision": revision})
    _changed(background, "layout")
    return Response(status_code=204)


# ---------------------------------------------------------------- 3.7 / 3.8 remote configuration

class RemoteDefaultBody(_Body):
    sections: list[dict[str, Any]]
    more: list[str]


@router.get("/multimedia/remote-default")
def get_remote_default(principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {**store.installation_remote(conn), "scope": "default"}


@router.put("/multimedia/remote-default")
def put_remote_default(request: Request, background: BackgroundTasks, principal: Principal = Depends(_layout_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body: RemoteDefaultBody = _parse(request, raw, RemoteDefaultBody)
    try:
        cfg = media_layout.normalise_remote_config({"sections": body.sections, "more": body.more})
    except ValueError as exc:
        raise ApiError(422, "validation", "הגדרת השלט אינה תקינה.", details={"fields": ["sections"], "reason": str(exc)}) from None
    set_setting(conn, "multimedia.remote_default", json.dumps(cfg, ensure_ascii=False, separators=(",", ":")))
    audit(conn, actor=principal, action="media.remote.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request), details={"scope": "default"})
    _changed(background, "curation")
    return {**cfg, "scope": "default"}


class DeviceRemoteBody(_Body):
    remote: dict[str, Any] | None = None
    sources: list[dict[str, Any]] | None = None
    apps: list[dict[str, Any]] | None = None


def _remote_early(key: str, request: Request, principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """`media.layout` at the screen's anchor BEFORE the body is read (403 before 422; the read-gate pattern): 404 for a screen the caller may not see."""
    r = conn.execute("SELECT anchor_entity_id, approved, kind FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()
    access = store.Access(conn, principal, (store.PERM_READ, store.PERM_LAYOUT))
    if r is None or not r["approved"] or r["kind"] != "screen" or not access.has(store.PERM_READ, r["anchor_entity_id"]):
        raise ApiError(404, "not_found", "המסך לא נמצא.")
    if not access.has(store.PERM_LAYOUT, r["anchor_entity_id"]):
        audit(conn, actor=principal, action="media.remote.update", decision="denied", resource_type="media_device", resource_id=key, reason="forbidden", request_id=_rid(request))
        raise ApiError(403, "forbidden", media_commands.MESSAGES["forbidden"], details={"permission": store.PERM_LAYOUT})
    return principal


@router.put("/multimedia/devices/{key}/remote")
def put_device_remote(key: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(_remote_early), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`media.layout` at the screen's anchor (checked before the body is read): the per-screen remote override (`remote: null` returns it
    to the default) and the ordered curation of its sources and apps. Returns the new `MediaDeviceDetail`."""
    body: DeviceRemoteBody = _parse(request, raw, DeviceRemoteBody)
    cat, item, access = store.find_visible(conn, principal, key)
    if not access.has(store.PERM_LAYOUT, item.row.get("anchor_entity_id")):  # the same check on the write connection (scope may have moved)
        audit(conn, actor=principal, action="media.remote.update", decision="denied", resource_type="media_device", resource_id=key, reason="forbidden", request_id=_rid(request))
        raise ApiError(403, "forbidden", media_commands.MESSAGES["forbidden"], details={"permission": store.PERM_LAYOUT})
    store.save_device_remote(conn, key, {f: getattr(body, f) for f in body.model_fields_set})
    audit(conn, actor=principal, action="media.remote.update", decision="allowed", resource_type="media_device", resource_id=key, request_id=_rid(request),
          details={"scope": "device", "fields": sorted(body.model_fields_set)})
    _changed(background, "curation")
    cat, item, access = store.find_visible(conn, principal, key)
    return store.device_detail(conn, cat, item, access)


# ---------------------------------------------------------------- 3.9 bulk

class _MediaRefusals:
    """The audit context of one media bulk request (the `_Refusals` of routers/devices.py with the action `media.bulk`): every refusal
    before sending is one `denied` row."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal) -> None:
        self.request, self.conn, self.principal = request, conn, principal
        self.rid = _rid(request)
        self.resource_type, self.resource_id = "devices_floor", "*"
        self.details: dict[str, Any] = {}

    def refuse(self, exc: ApiError) -> ApiError:
        exc.details.setdefault("outcome", "not_sent")
        audit(self.conn, actor=self.principal, action=bulk.MEDIA_AUDIT_ACTION, decision="denied", resource_type=self.resource_type, resource_id=self.resource_id, reason=exc.code,
              request_id=self.rid, details={**self.details, "phase": "refused", "outcome": "not_sent"})
        return exc


class BulkBody(_Body):
    scope: Literal["floor", "area"]
    id: str = Field(min_length=1, max_length=255)
    kind: Literal["screens_off"]
    confirmed: Any = None
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)
    preview_digest: str | None = Field(None, min_length=1, max_length=64)


@router.get("/multimedia/actions/preview")
def bulk_preview(
    principal: Principal = Depends(_bulk_gate),
    conn: sqlite3.Connection = Depends(get_read_conn),
    scope: str = Query(..., max_length=16),
    id: str = Query(..., min_length=1, max_length=255),  # noqa: A002 - the scope's id, as in the body
) -> dict[str, Any]:
    """What `POST /multimedia/actions` would send, per screen: `{scope, id, label, counts, devices}`. Sends nothing."""
    plan = bulk.resolve_media(conn, principal, scope, id)
    return {"scope": scope, "id": id, "label": plan["name"], "counts": plan["counts"], "devices": plan["devices"]}


@router.post("/multimedia/actions", status_code=202)
def bulk_run(request: Request, principal: Principal = Depends(_bulk_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Turn off the screens of one floor or area (decision 7a): only approved screens confirmed on (or in art mode), their power endpoint
    only, the same records / in-flight bound / honest per-screen outcome as the devices area's bulk actions. Body: `{scope, id, kind:
    "screens_off", confirmed: true, client_request_id, expires_at}`; reply 202 `{bulk_id, status}` - follow it with
    `GET /devices/actions/{bulk_id}`. The building is 422 validation."""
    act = _MediaRefusals(request, conn, principal)
    if not _is_json(request.headers.get("content-type")):
        raise act.refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json)."))
    try:
        body = BulkBody.model_validate(json.loads(raw) if raw.strip() else {})
    except (ValueError, RecursionError):
        raise act.refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise act.refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None
    act.resource_type, act.resource_id = f"devices_{body.scope}", body.id
    act.details.update(scope=body.scope, id=body.id, kind=body.kind, client_request_id=body.client_request_id, expires_at=body.expires_at)
    not_after = _envelope(act, body)  # the same expiry / duplicate rules as every bulk
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "כיבוי מרוכז דורש אישור מפורש בחלון האישור."))
    try:
        plan = bulk.resolve_media(conn, principal, body.scope, body.id)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if body.preview_digest is not None and body.preview_digest != plan["digest"]:
        raise act.refuse(ApiError(409, "target_changed", "רשימת המסכים השתנתה מאז שנפתח חלון האישור, ולכן לא נשלח דבר. פתחו את הפעולה מחדש.", details={"count": plan["count"]}))
    if not plan["count"]:
        raise act.refuse(ApiError(409, "nothing_to_do", "אין מה לכבות: לפי הדיווח האחרון אין בהיקף הזה מסך שאושר כדולק.", details={"counts": plan["counts"]}))
    settings = settings_of(request)
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise act.refuse(ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן."))
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise act.refuse(ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את הגשר מותקן ומצומד."))
    bulk_id = uuid.uuid4().hex[:12]
    blocking = bulk.RUNNER.reserve(bulk.scope_key(body.scope, body.id), bulk_id, {t["entity_id"] for t in plan["targets"]})
    if blocking:
        raise act.refuse(ApiError(409, "bulk_in_progress", "כיבוי מרוכז קודם על ההיקף הזה עדיין רץ. המתינו לסיומו.", details={"bulk_id": blocking}))
    started = False
    try:
        try:
            bulk.record(conn, principal, bulk_id, plan, body.client_request_id, not_after)
        except ApiError as exc:  # never keep half a record: drop what was written, refuse, send nothing
            rollback_and_restart(conn)
            raise act.refuse(exc) from None
        audit(conn, actor=principal, action=bulk.MEDIA_AUDIT_ACTION, decision="allowed", resource_type=act.resource_type, resource_id=act.resource_id, request_id=act.rid,
              details={**act.details, "phase": "attempt", "bulk_id": bulk_id, "scope_name": plan["name"], "device_count": plan["count"], "device_keys": [t["device_key"] for t in plan["targets"]],
                       "counts": plan["counts"]})
        commit_now(conn)  # the attempt row and the queued records exist before the first call - or nothing is sent
        db: Database = request.app.state.db
        targets = plan["targets"]
        bulk.RUNNER.start(bulk_id, lambda: bulk.run(db, settings, principal, bulk_id, targets, secret, not_after, act.rid))
        started = True
    finally:
        if not started:
            bulk.RUNNER.release(bulk_id)
    return {"bulk_id": bulk_id, "status": bulk.load(conn, bulk_id)["status"]}


# ---------------------------------------------------------------- 3.10 profiles

@router.get("/multimedia/profiles")
def get_profiles(principal: Principal = Depends(_reader_gate)) -> dict[str, Any]:
    return profiles.catalogue()


# ---------------------------------------------------------------- 3.11 - 3.14 administration (system.configure)

class AdminDeviceBody(_Body):
    display_name: str | None = None
    kind: str | None = None
    approved: bool | None = None
    public: bool | None = None
    profile: str | None = None
    audio_link_key: str | None = None
    audio_default: str | None = None
    volume_max: Any = None  # validated by services/media_store.update_device (a bool is not a number)
    model_keys: list[str] | None = None
    primary: dict[str, str | None] | None = None


class LinkBody(_Body):
    op: Literal["link", "unlink", "ignore", "restore"]
    endpoint_id: str = Field(min_length=4, max_length=260)
    device_key: str | None = Field(None, max_length=64)


class ApproveBody(_Body):
    device_keys: list[str] | None = Field(None, max_length=500)
    approved: bool = True


@router.get("/multimedia/admin/devices")
def admin_devices(principal: Principal = Depends(_configure_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Every discovered media device with its endpoints (hidden ones too), the ladder's rung, the weak merge suggestions. The only place
    an anchor entity id or an endpoint id is shown."""
    return store.admin_rows(conn)


@router.put("/multimedia/admin/devices/{key}")
def admin_update_device(key: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(_configure_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body: AdminDeviceBody = _parse(request, raw, AdminDeviceBody)
    nullable = {"display_name", "kind", "profile", "audio_link_key", "volume_max"}  # null clears these; a null flag or list is "not given"
    fields = {f: getattr(body, f) for f in body.model_fields_set if getattr(body, f) is not None or f in nullable}
    result = store.update_device(conn, key, fields)
    audit(conn, actor=principal, action="media.device.update", decision="allowed", resource_type="media_device", resource_id=key, request_id=_rid(request),
          details={"fields": result["changed"], **({"approved": bool(fields["approved"])} if "approved" in fields else {}), **({"public": bool(fields["public"])} if "public" in fields else {})})
    if "approved" in fields:
        store._refresh_index(conn)
    _changed(background, "approval" if "approved" in fields else "curation")
    return next(d for d in store.admin_rows(conn)["devices"] if d["key"] == key)


@router.post("/multimedia/admin/links")
def admin_links(request: Request, background: BackgroundTasks, principal: Principal = Depends(_configure_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body: LinkBody = _parse(request, raw, LinkBody)
    store.set_link_rule(conn, principal, body.op, body.endpoint_id, body.device_key)
    store.rebuild(conn)
    audit(conn, actor=principal, action="media.link", decision="allowed", resource_type="media_device", resource_id=body.device_key or "*", request_id=_rid(request),
          details={"op": body.op, "endpoint_id": body.endpoint_id})
    _changed(background, "curation")
    return {"devices": store.admin_rows(conn)["devices"]}


@router.post("/multimedia/admin/approve")
def admin_approve(request: Request, background: BackgroundTasks, principal: Principal = Depends(_configure_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Approve (or withdraw) the named devices; without `device_keys` every detected SCREEN - the first approval is one tap
    ("אשר את כל המסכים שזוהו")."""
    body: ApproveBody = _parse(request, raw, ApproveBody)
    counts = store.approve(conn, body.device_keys, body.approved)
    audit(conn, actor=principal, action="media.approve", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"approved": body.approved, "all_screens": body.device_keys is None, **counts})
    _changed(background, "approval")
    return counts
