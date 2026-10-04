"""The multimedia API (CR-015, "מולטימדיה · מסכים ושלט"): docs/architecture/MEDIA_API.md is the binding contract (section numbers in the
comments below). Screens are PHYSICAL devices built from Home Assistant endpoints (services/media_model.py); the page lists them, the
remote sends commands, the administrator decides which detected screens are managed.

CR-016 (players, speakers, groups; docs/architecture/MEDIA_PLAYERS_API.md) adds, on the same conventions: the kinds `speaker,player,receiver,group` in `GET devices`
and every route that names a device, the commands seek / shuffle / repeat / play_item / transfer, `GET devices/{key}/up-next` and `/library`, `GET groups`,
`POST groups/join` / `leave` / `{leader_key}/volume`, the saved groups `GET / POST groups/presets`, `PUT / DELETE groups/presets/{id}`, `POST
groups/presets/{id}/apply`, `GET / PUT favourites`, `GET admin/suggestions`, the floor "עצור מוזיקה" (`kind: players_pause` on the actions routes) and, in the
administration, the volume ceilings / night window / placing a device in an area / the non-physical components.

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
import re
import sqlite3
import uuid
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import Database, commit_now, get_setting, now_iso, rollback_and_restart, set_setting, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import device_bulk as bulk
from ..services import ha_bridge, ha_client, ha_sync, ma_direct, media_commands, media_groups, media_layout, media_model as mm, media_profiles as profiles, media_query, media_queue, media_store as store, user_prefs
from .devices import _envelope, _is_json, _raw_body

router = APIRouter()
COMMAND_ID = r"^[A-Za-z0-9-]{8,64}$"
# CR-016 review L3: per USER limits of the reads that reach the bridge (tokens a second, burst): the up-next panel polls every 30 s, a library list is opened by a tap
UP_NEXT_USER = (0.5, 5.0)
LIBRARY_USER = (0.5, 4.0)
DETAIL_QUEUE_USER = (0.2, 3.0)
RID = Field(min_length=8, max_length=80)
PERSONALIZE = "screen.personalize"
QUEUE_BODY_MAX = 4096  # a queue edit names at most 25 rows of 24 characters


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


def _check_group(conn: sqlite3.Connection, principal: Principal) -> None:
    """media.group somewhere (installation or a floor), before the body is read; the audited 403 otherwise (CR-016)."""
    if not store.Access(conn, principal, (store.PERM_GROUP,)).anywhere(store.PERM_GROUP):
        require(conn, principal, store.PERM_GROUP, INSTALLATION)
    _feature_or_404(conn)


_group_gate = read_gate(_check_group)


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
    kind: str = Query("screen", max_length=80),
    floor: str | None = Query(None, max_length=128),
    area: str | None = Query(None, max_length=128),
    q: str | None = Query(None, max_length=80),
    state: str | None = Query(None, max_length=16),
) -> dict[str, Any]:
    """The approved devices of the requested kind(s) the caller may read, sorted by name. `kind` is one kind or a comma-separated list (`screen` by
    default; CR-016: `speaker,player,receiver,group`); `area=none` lists the devices without an area ("לא משויכים"); `state` is `playing`, `off` or
    `unavailable`. A device without an area has no floor either: a floor filter never lists it."""
    kinds = [k.strip() for k in kind.split(",") if k.strip()] or ["screen"]
    if any(k not in mm.RENDERED_KINDS for k in kinds) or state not in (None, "playing", "off", "unavailable"):
        raise ApiError(422, "validation", "סוג התקן או מצב לא מוכר.", details={"fields": ["kind" if any(k not in mm.RENDERED_KINDS for k in kinds) else "state"]})
    cat = store.load_catalog(conn) if kinds == ["screen"] else store.load_catalog(conn, approved_only=False, kind=tuple(kinds))
    access = store.Access(conn, principal)
    out = []
    text = (q or "").strip().casefold()
    for item in sorted(store.visible_items(cat, access, tuple(kinds)), key=lambda i: (i.name.casefold(), i.key)):
        d = store.device_item(cat, item, access)
        if floor and d["floor_id"] != floor:
            continue
        if area and (d["area_id"] is not None if area == "none" else d["area_id"] != area):
            continue
        if text and text not in d["name"].casefold() and text not in (d["area_name"] or "").casefold():
            continue
        playing_now = d["live"]["power"] == "on" and d["live"]["play"] == "playing"
        if state == "playing" and not playing_now or state == "unavailable" and d["live"]["power"] != "unavailable" \
                or state == "off" and (playing_now or d["live"]["power"] in ("unavailable", "unknown")):  # "off" = off, standby, idle or paused: not playing and available
            continue
        out.append(d)
    return {"devices": out}


@router.get("/multimedia/devices/{key}")
def get_device(key: str, request: Request, curation: bool = Query(False), principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`?curation=1` is the remote editor's read: hidden sources / apps included, each with its default name - only for a holder of
    media.layout at the screen's anchor (anyone else gets the ordinary detail)."""
    cat, item, access = store.find_visible(conn, principal, key, mm.RENDERED_KINDS)
    if item.row["kind"] != "screen" and store.caps_of(cat, item).get("up_next"):
        try:  # the detail of a player carries `live.queue` from an up-next read: a best effort, never a failure of the detail. It reuses a read up to 10 s old and
            # is rate limited per user (review L3) - a client that polls the detail never becomes a stream of bridge reads
            if media_commands.BUCKETS.take("detail-queue", principal.user_id, DETAIL_QUEUE_USER):
                media_query.up_next(conn, settings_of(request), principal, cat, item, access, max_age=media_query.QUEUE_DETAIL_TTL_S)
        except ApiError:
            pass
    if curation and item.row["kind"] == "screen" and store.Access(conn, principal, (store.PERM_LAYOUT,)).has(store.PERM_LAYOUT, item.row.get("anchor_entity_id")):
        return store.device_detail(conn, cat, item, access, curation=True)
    return store.device_detail(conn, cat, item, access)


# ---------------------------------------------------------------- 3.4 commands

class CommandBody(_Body):
    command: Literal["power_on", "power_off", "volume_set", "volume_step", "mute", "source", "app", "sound_output", "transport", "key", "text",
                     "seek", "shuffle", "repeat", "play_item", "transfer"]  # CR-016: no `announce` (owner decision 6א) - an unknown command is a 422
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
    position_s: Any = None
    on: Any = None
    mode: Any = None
    item_ref: Any = None
    enqueue: Any = None
    from_key: Any = None
    zone: Any = None
    confirmed: Any = None  # a static group that is a party (CR-016 review M1): the answer to its 409 confirm_required
    client_request_id: str = RID
    expires_at: str = Field(min_length=1, max_length=40)


COMMAND_FIELDS: dict[str, set[str]] = {
    "power_on": {"zone", "confirmed"}, "power_off": {"zone", "confirmed"}, "volume_set": {"level", "target", "zone"}, "volume_step": {"direction", "target", "zone"}, "mute": {"muted", "target", "zone"},
    "source": {"source_id", "zone", "confirmed"}, "app": {"app_id"}, "sound_output": {"output", "zone", "confirmed"}, "transport": {"action", "confirmed"}, "key": {"key"}, "text": {"text"},
    "seek": {"position_s", "confirmed"}, "shuffle": {"on", "confirmed"}, "repeat": {"mode", "confirmed"}, "play_item": {"item_ref", "enqueue", "confirmed"}, "transfer": {"from_key"},
}
COMMAND_ARGS = ("level", "direction", "muted", "target", "source_id", "app_id", "output", "action", "key", "text", "position_s", "on", "mode", "item_ref", "enqueue", "from_key", "zone", "confirmed")


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
    given = {f for f in COMMAND_ARGS if getattr(body, f) is not None}
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
    cat, item, access = store.find_visible(conn, principal, key, mm.RENDERED_KINDS)
    status, result = media_commands.run(conn, settings_of(request), principal, _rid(request), cat, item, access, admitted.cmd, admitted.body.client_request_id, admitted.body.expires_at)
    return JSONResponse(status_code=status, content=result)


# ---------------------------------------------------------------- 3.5 artwork

@router.get("/multimedia/devices/{key}/artwork")
def artwork(key: str, request: Request, v: str | None = Query(None, max_length=64), principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    """The content art of what the screen is playing, proxied through the add-on's HA session (never an HA URL in the browser). Only
    real content art (Cast / MA metadata of a video, movie, episode, show or music track) - never an app or channel logo; 404 otherwise."""
    cat, item, _access = store.find_visible(conn, principal, key, mm.RENDERED_KINDS)
    hit = store.artwork_source(item)
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
        access = store.Access(conn, principal, (store.PERM_READ,))
        cat = store.load_catalog(conn)
        seen = store.visible_items(cat, access)
        acat = media_groups.load_catalog(conn)
        seen_audio = store.visible_items(acat, access, tuple(mm.AUDIO_KINDS))
        keys = {i.key for i in seen} | {i.key for i in seen_audio} | {p["id"] for p in media_groups.list_presets(conn, acat, access)}
        if not can_edit:
            layout = media_layout.restrict_layout(layout, keys, {f for f in (store.floor_area(i)["floor_id"] for i in [*seen, *seen_audio]) if f})
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

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, action: str = bulk.MEDIA_AUDIT_ACTION) -> None:
        self.request, self.conn, self.principal, self.action = request, conn, principal, action
        self.rid = _rid(request)
        self.resource_type, self.resource_id = "devices_floor", "*"
        self.details: dict[str, Any] = {}

    def refuse(self, exc: ApiError) -> ApiError:
        exc.details.setdefault("outcome", "not_sent")
        audit(self.conn, actor=self.principal, action=self.action, decision="denied", resource_type=self.resource_type, resource_id=self.resource_id, reason=exc.code,
              request_id=self.rid, details={**self.details, "phase": "refused", "outcome": "not_sent"})
        return exc


class BulkBody(_Body):
    scope: Literal["floor", "area"]
    id: str = Field(min_length=1, max_length=255)
    kind: Literal["screens_off", "players_pause"] = "screens_off"
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
    kind: Literal["screens_off", "players_pause"] = Query("screens_off"),
) -> dict[str, Any]:
    """What `POST /multimedia/actions` would send, per screen (`kind: screens_off`) or per speaker / player / receiver (`kind: players_pause`, CR-016):
    `{scope, id, label, counts, devices}`. Sends nothing."""
    plan = bulk.resolve_media(conn, principal, scope, id) if kind == "screens_off" else bulk.resolve_players_pause(conn, principal, scope, id)
    return {"scope": scope, "id": id, "label": plan["name"], "counts": plan["counts"], "devices": plan["devices"]}


@router.post("/multimedia/actions", status_code=202)
def bulk_run(request: Request, principal: Principal = Depends(_bulk_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Turn off the screens of one floor or area (decision 7a; CR-016: `kind: players_pause` pauses the speakers, players and receivers that are playing there):
    only approved screens confirmed on (or in art mode), their power endpoint
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
        raise act.refuse(ApiError(409, "confirmation_required", "כיבוי מרוכז דורש אישור מפורש בחלון האישור." if body.kind == "screens_off" else "עצירת מוזיקה מרוכזת דורשת אישור מפורש בחלון האישור."))
    try:
        plan = bulk.resolve_media(conn, principal, body.scope, body.id) if body.kind == "screens_off" else bulk.resolve_players_pause(conn, principal, body.scope, body.id)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if body.preview_digest is not None and body.preview_digest != plan["digest"]:
        raise act.refuse(ApiError(409, "target_changed", "רשימת המסכים השתנתה מאז שנפתח חלון האישור, ולכן לא נשלח דבר. פתחו את הפעולה מחדש.", details={"count": plan["count"]}))
    if not plan["count"]:
        raise act.refuse(ApiError(409, "nothing_to_do", "אין מה לכבות: לפי הדיווח האחרון אין בהיקף הזה מסך שאושר כדולק." if body.kind == "screens_off" else "אין מה לעצור: לפי הדיווח האחרון לא מנגן בהיקף הזה דבר שאושר.", details={"counts": plan["counts"]}))
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
    volume_night: Any = None  # CR-016: {from, to, max} or null - a second ceiling inside a window (validated by media_store.update_device)
    area_id: str | None = Field(None, min_length=1, max_length=255)  # CR-016: place the device in an HA area (the bridge writes the entity registry)
    model_keys: list[str] | None = None
    primary: dict[str, str | None] | None = None


class LinkBody(_Body):
    op: Literal["link", "unlink", "ignore", "restore"]
    endpoint_id: str = Field(min_length=4, max_length=260)
    device_key: str | None = Field(None, max_length=64)


class ApproveBody(_Body):
    device_keys: list[str] | None = Field(None, max_length=500)
    approved: bool = True
    kinds: list[Literal["speaker", "player", "receiver", "group"]] | None = Field(None, max_length=4)  # CR-016: "אשר את כל הנגנים שזוהו" (without device_keys)


@router.get("/multimedia/admin/devices")
def admin_devices(principal: Principal = Depends(_configure_gate), conn: sqlite3.Connection = Depends(get_read_conn), kind: str | None = Query(None, max_length=80)) -> dict[str, Any]:
    """Every discovered media device with its endpoints (hidden ones too), the ladder's rung, the weak merge suggestions. The only place
    an anchor entity id or an endpoint id is shown. The non-physical components (sessions, helper groups, a Spotify list) are left out - `non_physical` counts
    them - unless `kind` names them (`?kind=session,virtual_group,service`, CR-016 3.28)."""
    kinds = tuple(k.strip() for k in kind.split(",") if k.strip()) if kind else None
    if kinds is not None and any(k not in mm.KINDS for k in kinds):
        raise ApiError(422, "validation", "סוג התקן לא מוכר.", details={"fields": ["kind"]})
    return store.admin_rows(conn, kinds)


@router.get("/multimedia/admin/suggestions")
def admin_suggestions(principal: Principal = Depends(_configure_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The merge wizard's list (CR-016 7.4): `{suggestions: MergeSuggestion[]}` - what the ladder could not decide (the same model twice, the same name with an
    area on one side or both), minus the ones dismissed. Answer a row with `POST admin/links` `link` (merge) or `ignore` + the row's `device_key` (dismiss)."""
    return {"suggestions": store.suggestion_rows(conn)}


def _place_device(request: Request, conn: sqlite3.Connection, principal: Principal, key: str, area_id: str) -> None:
    """Place a device in an HA area (CR-016 7.1: "חדר" for an unplaced speaker): the one Home Assistant CONFIG write this product makes, through the
    bridge's `set_entity_area` path (the anchor entity), exactly as the devices area's assign route does - system.configure, two-phase audit (the attempt
    row is committed before Home Assistant is asked), the local mirror updated at once."""
    row = conn.execute("SELECT anchor_entity_id FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone()
    if row is None or not row["anchor_entity_id"]:
        raise ApiError(404, "not_found", "ההתקן לא נמצא.")
    entity_id = row["anchor_entity_id"]
    arow = conn.execute("SELECT area_id, name, floor_id FROM ha_areas WHERE area_id = ?", (area_id,)).fetchone()
    if not arow:
        raise ApiError(404, "area_not_found", "האזור לא נמצא.")
    settings = settings_of(request)
    rid = _rid(request)
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן.")
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise ApiError(503, "bridge_not_paired", "שיוך אזור דורש את הגשר מותקן ומצומד.")
    old = conn.execute("SELECT area_id FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    bridge_rid = uuid.uuid4().hex[:12]
    payload = ha_bridge.sign(secret, {"user_id": principal.user_id, "entity_id": entity_id, "area_id": area_id, "request_id": bridge_rid})
    audit(conn, actor=principal, action="media.place", decision="allowed", resource_type="media_device", resource_id=key, request_id=rid,
          details={"area_id": area_id, "from_area_id": old["area_id"] if old else None, "phase": "attempt", "request": bridge_rid})
    try:
        with unlocked(conn):  # the HA call runs without the request's write lock
            result = ha_client.call_bridge_set_area(settings, payload)
    except ApiError as exc:
        audit(conn, actor=principal, action="media.place", decision="denied", resource_type="media_device", resource_id=key, reason=exc.code, request_id=rid,
              details={"area_id": area_id, "phase": "outcome", "request": bridge_rid})
        raise
    ok = bool(result.get("ok"))
    error = None if ok else str(result.get("error") or "bridge_error")
    audit(conn, actor=principal, action="media.place", decision="allowed" if ok else "denied", resource_type="media_device", resource_id=key, reason=error, request_id=rid,
          details={"area_id": area_id, "phase": "outcome", "request": bridge_rid})
    if not ok:
        raise ApiError(404 if error in ("entity_not_found", "area_not_found") else 502, "bridge_error", "תשתית המערכת דחתה את שיוך האזור.", details={"error": error})
    frow = conn.execute("SELECT name FROM ha_floors WHERE floor_id = ?", (arow["floor_id"],)).fetchone() if arow["floor_id"] else None
    conn.execute("UPDATE ha_entities SET area_id = ?, area_name = ?, ha_floor_id = ?, ha_floor_name = ?, updated_at = ? WHERE entity_id = ?",
                 (arow["area_id"], arow["name"], arow["floor_id"], frow["name"] if frow else None, now_iso(), entity_id))


@router.put("/multimedia/admin/devices/{key}")
def admin_update_device(key: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(_configure_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    body: AdminDeviceBody = _parse(request, raw, AdminDeviceBody)
    nullable = {"display_name", "kind", "profile", "audio_link_key", "volume_max", "volume_night"}  # null clears these; a null flag or list is "not given"
    fields = {f: getattr(body, f) for f in body.model_fields_set if getattr(body, f) is not None or f in nullable}
    area_id = fields.pop("area_id", None)
    if conn.execute("SELECT 1 FROM media_devices WHERE device_key = ? AND removed_at IS NULL", (key,)).fetchone() is None:
        raise ApiError(404, "not_found", "ההתקן לא נמצא.")
    if area_id:
        _place_device(request, conn, principal, key, area_id)
    result = store.update_device(conn, key, fields)
    if area_id:
        result["changed"] = sorted([*result["changed"], "area_id"])
    audit(conn, actor=principal, action="media.device.update", decision="allowed", resource_type="media_device", resource_id=key, request_id=_rid(request),
          details={"fields": result["changed"], **({"approved": bool(fields["approved"])} if "approved" in fields else {}), **({"public": bool(fields["public"])} if "public" in fields else {})})
    if "approved" in fields:
        store._refresh_index(conn)
    _changed(background, "approval" if "approved" in fields else ("placed" if area_id and not fields else "curation"))
    return next(d for d in store.admin_rows(conn, tuple(mm.KINDS))["devices"] if d["key"] == key)


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
    counts = store.approve(conn, body.device_keys, body.approved, list(body.kinds) if body.kinds else None)
    audit(conn, actor=principal, action="media.approve", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"approved": body.approved, "all_screens": body.device_keys is None and not body.kinds, **({"kinds": list(body.kinds)} if body.kinds else {}), **counts})
    _changed(background, "approval")
    return counts


# ---------------------------------------------------------------- CR-016: up next and the library (MEDIA_PLAYERS_API.md 3.16 / 3.17)

def _read_limit(conn: sqlite3.Connection, principal: Principal, request: Request, key: str, name: str, bucket: str, limit: tuple[float, float]) -> None:
    """A read of the music layer (up next, a library list) is limited per USER (429, one aggregated audit row per user and device a minute) - after the visibility check,
    so a device nobody may read is a 404 and never a bucket."""
    if not media_commands.BUCKETS.take(bucket, principal.user_id, limit):
        media_commands._audit_limited(conn, principal, _rid(request), key, name, "user")
        raise media_commands.err(429, "rate_limited", scope="user")


@router.get("/multimedia/devices/{key}/up-next")
def get_up_next(key: str, request: Request, principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`UpNext` of a speaker, player, receiver or group: the current and the next item and the queue length (Music Assistant's `get_queue` through the bridge,
    or a Sonos player's own queue attributes). `confirmed: false` when the read failed - the panel says "לא זמין", never "empty". 503 no_library when no
    music layer answers, 503 bridge_outdated before bridge 0.5.0. A member of a live group is answered with its leader's queue."""
    cat, item, access = store.find_visible(conn, principal, key, tuple(mm.AUDIO_KINDS))
    _read_limit(conn, principal, request, key, "up_next", "up-next-user", UP_NEXT_USER)
    return media_query.up_next(conn, settings_of(request), principal, cat, item, access)


@router.get("/multimedia/devices/{key}/library")
def get_library(key: str, request: Request, kind: Literal["favourites", "stations", "playlists"] = Query(...), offset: int = Query(0, ge=0, le=5000),
                include_hidden: bool = Query(False, alias="all"), principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`LibraryPage`: the favourites, stations or playlists of the device's music layer in the administrator's order, hidden items left out (the same list for
    everyone). Items travel as opaque `item_ref`s - never a URI. `?all=1` adds the hidden ones (`hidden: true`) for a holder of media.layout (the curation
    editor). 422 not_supported when the device does not offer the list, 503 no_library, 503 bridge_outdated."""
    cat, item, access = store.find_visible(conn, principal, key, tuple(mm.AUDIO_KINDS))
    _read_limit(conn, principal, request, key, "library", "library-user", LIBRARY_USER)
    show = include_hidden and store.Access(conn, principal, (store.PERM_LAYOUT,)).has(store.PERM_LAYOUT, item.row.get("anchor_entity_id"))
    return media_query.library_page(conn, settings_of(request), principal, cat, item, access, kind, offset, show_hidden=show)


# ---------------------------------------------------------------- CR-016 phase 2b: the full queue, the library tab, the direct connection (CR 17.7)

@router.get("/multimedia/devices/{key}/queue")
def get_queue(key: str, request: Request, offset: int | None = Query(None, ge=0, le=10000), limit: int = Query(50, ge=1, le=100),
              principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`QueueList`: the rows of the device's queue from `offset` (default: the current item) through the direct Music Assistant connection; locked rows (the
    current one and what is buffered) marked. A member answers with its leader's queue. `confirmed: false` when the read failed (never an empty queue);
    422 not_supported without an MA player; 503 ma_unavailable while the direct connection is not ready. Shares the up-next read budget per user."""
    cat, item, access = store.find_visible(conn, principal, key, tuple(mm.AUDIO_KINDS))
    _read_limit(conn, principal, request, key, "queue", "up-next-user", UP_NEXT_USER)
    return media_queue.queue_list(conn, principal, cat, item, access, offset, limit)


class QueueEditBody(_Body):
    op: Literal["move", "next", "top", "delete", "play", "delete_many", "clear_upcoming", "clear"]
    item: str | None = Field(None, max_length=24)
    items: list[str] | None = Field(None, max_length=media_queue.MANY_MAX)
    to: Any = None
    confirmed: Any = None
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


def _check_queue(conn: sqlite3.Connection, principal: Principal) -> None:
    """media.queue somewhere (installation or a floor), before the body is read; the audited 403 otherwise."""
    if not store.Access(conn, principal, (store.PERM_QUEUE,)).anywhere(store.PERM_QUEUE):
        require(conn, principal, store.PERM_QUEUE, INSTALLATION)
    _feature_or_404(conn)


_queue_gate = read_gate(_check_queue)


@router.post("/multimedia/devices/{key}/queue", status_code=202)
def post_queue(key: str, request: Request, principal: Principal = Depends(_queue_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> Any:
    """One queue edit (`op` move | next | top | delete | play | delete_many (`items`, up to 25) | clear_upcoming | clear) through the direct Music Assistant connection: 202 `{status: accepted, op}`; 200 `{status: refused,
    op, error}` when Music Assistant said no (its numeric code only). media.queue + media.control at the device (and at every follower of a live leader);
    `clear` needs `confirmed: true` (409 confirm_required + `count`); 409 locked / queue_changed / expired, 422 unknown_item / validation, 429, 503
    ma_unavailable. Every attempt is one audited `media.queue` row (never an item name or id)."""
    if len(raw) > QUEUE_BODY_MAX:
        raise ApiError(413, "payload_too_large", "הבקשה גדולה מדי.")
    body: QueueEditBody = _parse(request, raw, QueueEditBody)
    cat, item, access = store.find_visible(conn, principal, key, tuple(mm.AUDIO_KINDS))
    status, out = media_queue.edit(conn, settings_of(request), principal, _rid(request), cat, item, access, body.model_dump())
    return JSONResponse(status_code=status, content=out)


@router.get("/multimedia/devices/{key}/browse")
def get_browse(key: str, request: Request, media_type: Literal["track", "album", "artist", "playlist", "radio"] = Query(..., alias="type"), q: str | None = Query(None, max_length=60),
               offset: int = Query(0, ge=0, le=5000), principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`BrowsePage`: one page of the library of one media type, browsed through the bridge (`q` empty) or searched through the direct Music Assistant
    connection (`q`). Items are opaque `item_ref`s started with the `play_item` command. media.browse at the device's anchor (the audited 403 otherwise)."""
    cat, item, access = store.find_visible(conn, principal, key, tuple(mm.AUDIO_KINDS))
    if not access.has(store.PERM_BROWSE, item.row.get("anchor_entity_id")):
        require(conn, principal, store.PERM_BROWSE, INSTALLATION)
    if q and q.strip():
        _read_limit(conn, principal, request, key, "search", "search-user", media_queue.SEARCH_USER)
    else:
        _read_limit(conn, principal, request, key, "library", "library-user", LIBRARY_USER)
    return media_queue.browse(conn, settings_of(request), principal, cat, item, access, media_type, q, offset)


class MaConnectionBody(_Body):
    enabled: bool | None = None
    url: str | None = Field(None, max_length=200)
    token: str | None = Field(None, max_length=ma_direct.TOKEN_MAX)
    clear_token: bool | None = None


@router.get("/multimedia/admin/ma-connection")
def get_ma_connection(principal: Principal = Depends(_configure_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The direct Music Assistant connection (system.configure): switch, address, whether a token is set (never the token), the state and the last test."""
    return ma_direct.admin_view(conn)


@router.put("/multimedia/admin/ma-connection")
def put_ma_connection(request: Request, background: BackgroundTasks, principal: Principal = Depends(_configure_gate), raw: bytes = Depends(_raw_body),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """`{enabled?, url?, token?, clear_token?}`: the token is write-only (a 0600 file); the audit row names what changed (`url_changed`, `token: set |
    cleared`, `enabled`) and never a value."""
    body: MaConnectionBody = _parse(request, raw, MaConnectionBody)
    fields = {f: getattr(body, f) for f in body.model_fields_set}
    if fields.get("url") not in (None, ""):  # SSRF defences before anything is stored: scheme, no user-info, a private LAN address (CR-016 section 18)
        try:
            new_url = ma_direct.validate_url(fields["url"])
            with unlocked(conn):  # the name lookup runs without the request's write lock
                ma_direct.check_address(new_url)
        except ApiError as exc:
            if exc.code in ("host_refused", "port_refused", "host_unresolved"):
                audit(conn, actor=principal, action="media.ma_connection", decision="denied", resource_type="installation", resource_id="*", reason=exc.code,
                      request_id=_rid(request), details={"op": "update", "outcome": exc.code})
            raise
    view, changed = ma_direct.update_config(conn, fields)
    audit(conn, actor=principal, action="media.ma_connection", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"op": "update", **changed})
    if changed:
        _changed(background, "connection")
    return view


@router.post("/multimedia/admin/ma-connection/test")
def test_ma_connection(request: Request, principal: Principal = Depends(_configure_gate), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """"בדוק חיבור": the address check, the server's schema gate and the number of players the account sees (no names). Audited with the state only.
    5 tests a minute per user and 20 per installation (the NVR connection test's numbers); one hard time budget."""
    wait = request.app.state.ma_test_limiter.take(principal.user_id or principal.username or "?")
    if wait:
        audit(conn, actor=principal, action="media.ma_connection", decision="denied", resource_type="installation", resource_id="*", reason="rate_limited",
              request_id=_rid(request), details={"op": "test", "outcome": "rate_limited"})
        raise ApiError(429, "rate_limited", f"יותר מדי בדיקות חיבור; אפשר לנסות שוב בעוד {wait} שניות.", retryable=True, details={"retry_after_s": wait})
    with unlocked(conn):
        out = ma_direct.probe(conn)
    ma_direct.save_test(conn, out)
    audit(conn, actor=principal, action="media.ma_connection", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"op": "test", "state": out["state"]})
    return out


# ---------------------------------------------------------------- CR-016: favourites curation (MEDIA_PLAYERS_API.md 3.25)

class FavouritesBody(_Body):
    kinds_on: list[Literal["favourites", "stations", "playlists"]] = Field(max_length=3)
    items: list[dict[str, Any]] = Field(max_length=500)
    base_revision: int = Field(ge=0)


def _favourites_clean(body: FavouritesBody) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()
    for it in body.items:
        ref, hidden, order = it.get("item_ref"), it.get("hidden", False), it.get("order")
        if set(it) - {"item_ref", "hidden", "order"} or not isinstance(ref, str) or not re.fullmatch(r"[a-f0-9]{24}", ref) or ref in seen or not isinstance(hidden, bool) \
                or isinstance(order, bool) or not isinstance(order, int) or not 0 <= order < 100000:
            raise ApiError(422, "validation", "רשימת המועדפים: פריט לא תקין.", details={"fields": ["items"]})
        seen.add(ref)
        items.append({"item_ref": ref, "hidden": hidden, "order": order})
    return {"kinds_on": [k for k in store.LIB_KINDS if k in body.kinds_on], "items": sorted(items, key=lambda i: (i["order"], i["item_ref"]))}


@router.get("/multimedia/favourites")
def get_favourites(principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`FavouritesCuration`: which lists appear and, per item, its order and whether it is hidden - one list for everyone (owner decision 5א). A holder of
    media.layout (the curation editor) also gets each item's `name`, `artist` and `kind` where the server knows them (the items it listed in the last 30
    minutes, or - after a restart - the names saved with the curation), so a HIDDEN item can be listed and shown again without reading the library."""
    cfg = store.favourites_config(conn)
    if store.Access(conn, principal, (store.PERM_LAYOUT,)).anywhere(store.PERM_LAYOUT):
        names = media_query.known_names(conn, [i["item_ref"] for i in cfg["items"]])
        cfg = {**cfg, "items": [{**i, **names[i["item_ref"]]} if i["item_ref"] in names else i for i in cfg["items"]]}
    else:  # a reader is never sent the refs of the items the administrator hid (review L2): the library lists already leave them out
        cfg = {**cfg, "items": [i for i in cfg["items"] if not i.get("hidden")]}
    return cfg


@router.put("/multimedia/favourites")
def put_favourites(request: Request, background: BackgroundTasks, principal: Principal = Depends(_layout_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """media.layout: save the curation. `base_revision` is the revision the editor loaded (409 revision_conflict otherwise); audited `media.favourites.update`."""
    body: FavouritesBody = _parse(request, raw, FavouritesBody)
    current = store.favourites_config(conn)
    if body.base_revision != current["revision"]:
        raise ApiError(409, "revision_conflict", "הרשימה נערכה במקום אחר; טענו מחדש.", details={"revision": current["revision"]})
    cfg = {**_favourites_clean(body), "revision": current["revision"] + 1}
    set_setting(conn, "multimedia.favourites", json.dumps(cfg, ensure_ascii=False, separators=(",", ":")))
    media_query.save_names(conn, [i["item_ref"] for i in cfg["items"]])
    audit(conn, actor=principal, action="media.favourites.update", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"revision": cfg["revision"], "kinds_on": cfg["kinds_on"], "items": len(cfg["items"])})
    background.add_task(ha_sync.publish, {"type": "media_groups_changed"})
    _changed(background, "curation")
    return {**cfg, "items": [{**i, **media_query.known_names(conn, [i["item_ref"]]).get(i["item_ref"], {})} for i in cfg["items"]]}


# ---------------------------------------------------------------- CR-016: groups (MEDIA_PLAYERS_API.md 3.18 - 3.24)

class GroupJoinBody(_Body):
    leader_key: str = Field(min_length=1, max_length=64)
    member_keys: list[str] = Field(min_length=1, max_length=16)
    confirmed: Any = None
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


class GroupLeaveBody(_Body):
    device_keys: list[str] = Field(min_length=1, max_length=16)
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


class GroupVolumeBody(_Body):
    level: Any = None
    mode: Literal["relative", "absolute"] = "relative"
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


class GroupApplyBody(_Body):
    confirmed: Any = None
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


class PresetBody(_Body):
    name: str = Field(min_length=1, max_length=media_groups.PRESET_NAME_MAX)
    leader_key: str = Field(min_length=1, max_length=64)
    member_keys: list[str] = Field(min_length=1, max_length=15)
    volumes: dict[str, int] | None = None


class PresetUpdateBody(PresetBody):
    base_revision: int = Field(ge=0)


@router.get("/multimedia/groups")
def get_groups(principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{groups: MediaGroup[]}`: the live groups (one per leader), the static groups (a device of kind `group`) and the helper groups (`virtual: true`, a
    shortcut) with at least one member the caller may read; the members listed are the readable ones."""
    return {"groups": media_groups.list_groups(media_groups.load_catalog(conn), store.Access(conn, principal))}


def _group_request(request: Request, conn: sqlite3.Connection, principal: Principal, raw: bytes, model: type[BaseModel], rid_key: str = "*") -> tuple[_MediaRefusals, Any, Any]:
    """The envelope of every group write: JSON only, the closed body model, `client_request_id` + `expires_at` on the server's clock (409 expired /
    duplicate_command) - each refusal one audited `media.group` row."""
    act = _MediaRefusals(request, conn, principal, bulk.GROUP_AUDIT_ACTION)
    act.resource_type, act.resource_id = "devices_group", rid_key
    if not _is_json(request.headers.get("content-type")):
        raise act.refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json)."))
    try:
        body = model.model_validate(json.loads(raw) if raw.strip() else {})
    except (ValueError, RecursionError):
        raise act.refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise act.refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at)
    return act, body, _envelope(act, body)


def _group_bridge(request: Request, conn: sqlite3.Connection, principal: Principal, act: _MediaRefusals) -> tuple[Any, str]:
    """The prerequisites of a group write: the caller's identity maps to a Home Assistant user, the bridge is paired and at least 0.5.0 (503 otherwise)."""
    settings = settings_of(request)
    if principal.source not in ("ingress", "remote") and not settings.dev_user:
        raise act.refuse(ApiError(403, "identity_unmapped", "לא ניתן למפות את הזהות לפעולת ההתקן."))
    secret = ha_bridge.signing_key(conn)
    if not secret or not get_setting(conn, "bridge.paired_at"):
        raise act.refuse(ApiError(503, "bridge_not_paired", "פעולות אלו דורשות את הגשר מותקן ומצומד."))
    if not store.bridge_state(conn)["players_ready"]:
        raise act.refuse(ApiError(503, "bridge_outdated", media_commands.MESSAGES["bridge_outdated"], details={"required": store.BRIDGE_PLAYERS_REQUIRED}))
    return settings, secret


def _start_group(request: Request, conn: sqlite3.Connection, principal: Principal, act: _MediaRefusals, plan: dict[str, Any], body: Any, not_after: Any, settings: Any, secret: str,
                 reserve: str | None) -> dict[str, Any]:
    """Record the plan (one ha_actions record per call, the per-device rows) and the attempt audit row - committed before anything is sent - then run it on the
    bulk engine. `reserve` is the scope one operation at a time is allowed in (a leader: 409 group_pending); None = only rate-limited (a group volume)."""
    bulk_id = uuid.uuid4().hex[:12]
    blocking = bulk.RUNNER.reserve(reserve or bulk.scope_key("gvol", bulk_id), bulk_id, {t["entity_id"] for t in plan["targets"]} if reserve else set())
    if blocking:
        raise act.refuse(media_commands.err(409, "group_pending", bulk_id=blocking))
    started = False
    try:
        try:
            bulk.record(conn, principal, bulk_id, plan, body.client_request_id, not_after)
        except ApiError as exc:  # never keep half a record: drop what was written, refuse, send nothing
            rollback_and_restart(conn)
            raise act.refuse(exc) from None
        audit(conn, actor=principal, action=bulk.GROUP_AUDIT_ACTION, decision="allowed", resource_type=act.resource_type, resource_id=act.resource_id, request_id=act.rid,
              details={**act.details, "phase": "attempt", "bulk_id": bulk_id, "kind": plan["kind"], "scope_name": plan["name"], "device_count": len(plan["members"]),
                       "device_keys": [m["device_key"] for m in plan["members"]][:64], "sent": len(plan["targets"])})
        commit_now(conn)  # the attempt row and the queued records exist before the first call - or nothing is sent
        db: Database = request.app.state.db
        targets, phases = plan["targets"], plan.get("phases")
        bulk.RUNNER.start(bulk_id, lambda: bulk.run(db, settings, principal, bulk_id, targets, secret, not_after, act.rid, phases))
        started = True
    finally:
        if not started:
            bulk.RUNNER.release(bulk_id)
    return {"bulk_id": bulk_id, "status": "accepted", "preview": plan.get("preview")}


@router.post("/multimedia/groups/join", status_code=202)
def groups_join(request: Request, principal: Principal = Depends(_group_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Join rooms to a leader (decision 3א). media.group + media.control at every involved device's anchor; one `media_player.join` on the leader's grouping
    layer, confirmed by reading the membership back (8 s), an outcome per room on `GET /devices/actions/{bulk_id}`. 409 confirm_required (with the
    `preview`) for four devices or more or more than one floor, 403 bulk_required for the whole building without media.bulk, 422 not_groupable, 409
    group_pending (one in flight per leader), 409 nothing_to_do, 503 bridge_outdated / bridge_not_paired."""
    act, body, not_after = _group_request(request, conn, principal, raw, GroupJoinBody)
    act.resource_id = body.leader_key
    settings, secret = _group_bridge(request, conn, principal, act)
    try:
        plan = media_groups.plan_join(conn, store.Access(conn, principal), media_groups.load_catalog(conn), body.leader_key, body.member_keys, body.confirmed is True)
    except ApiError as exc:
        raise act.refuse(exc) from None
    return _start_group(request, conn, principal, act, plan, body, not_after, settings, secret, bulk.scope_key("group", body.leader_key))


@router.post("/multimedia/groups/leave", status_code=202)
def groups_leave(request: Request, principal: Principal = Depends(_group_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Take devices out of their live group: one `media_player.unjoin` per device through its own grouping layer, an outcome per device (`left` / `unknown`)."""
    act, body, not_after = _group_request(request, conn, principal, raw, GroupLeaveBody)
    settings, secret = _group_bridge(request, conn, principal, act)
    try:
        plan = media_groups.plan_leave(conn, store.Access(conn, principal), media_groups.load_catalog(conn), body.device_keys)
    except ApiError as exc:
        raise act.refuse(exc) from None
    return _start_group(request, conn, principal, act, plan, body, not_after, settings, secret, bulk.scope_key("group-leave", plan["id"]))


@router.post("/multimedia/groups/{leader_key}/volume", status_code=202)
def groups_volume(leader_key: str, request: Request, principal: Principal = Depends(_group_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set a group's volume: a `media_player.volume_set` per member, `relative` (default: every member scaled by the same factor, the balance kept) or
    `absolute`; each level clamped to the member's ceilings WHEN an administrator set them; a member that is muted, off or unavailable is skipped with its
    reason, one the caller may not control is `not_allowed` (not an error). Rate limit 2/s per group (429), no single-flight: the last value wins."""
    # a cheap per-user flood gate first (before the body and the catalogue); the 2/s limit itself is keyed by (user, leader) and counted only for a leader the caller
    # may read: a path key nobody validated never allocates a bucket (review L4)
    if not media_commands.BUCKETS.take("user", principal.user_id, media_commands.USER_ALL):
        media_commands._audit_limited(conn, principal, _rid(request), "*", "group_volume", "user")
        raise media_commands.err(429, "rate_limited", scope="user")
    act, body, not_after = _group_request(request, conn, principal, raw, GroupVolumeBody, leader_key[:64])
    settings, secret = _group_bridge(request, conn, principal, act)
    try:
        access = store.Access(conn, principal)
        cat = media_groups.load_catalog(conn)
        if media_groups._visible(cat, access, leader_key) is not None and not media_commands.BUCKETS.take("grp-vol", f"{principal.user_id}:{leader_key}", media_groups.VOLUME_RATE):
            media_commands._audit_limited(conn, principal, _rid(request), leader_key, "group_volume", "device")
            raise media_commands.err(429, "rate_limited", scope="group")
        plan = media_groups.plan_volume(conn, access, cat, leader_key, body.level, body.mode)
    except ApiError as exc:
        raise act.refuse(exc) from None
    return _start_group(request, conn, principal, act, plan, body, not_after, settings, secret, None)


def _preset_out(conn: sqlite3.Connection, principal: Principal, preset_id: str) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM media_group_presets WHERE preset_id = ?", (preset_id,)).fetchone()
    return media_groups._preset_dict(conn, media_groups.load_catalog(conn), store.Access(conn, principal), row)


@router.get("/multimedia/groups/presets")
def get_presets(principal: Principal = Depends(_reader_gate), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """`{presets: GroupPreset[]}`: the saved groups whose rooms the caller may read, with the rooms that are no longer approved (`missing`) and an apply that
    is in flight or finished less than 30 s ago (`running`)."""
    return {"presets": media_groups.list_presets(conn, media_groups.load_catalog(conn), store.Access(conn, principal))}


@router.post("/multimedia/groups/presets", status_code=201)
def post_preset(request: Request, background: BackgroundTasks, principal: Principal = Depends(_layout_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """media.layout: save a group (a name of at most 40 characters, a leader, up to 15 more rooms of the same grouping layer, optional per-room volumes)."""
    body: PresetBody = _parse(request, raw, PresetBody)
    row = media_groups.create_preset(conn, principal, media_groups.load_catalog(conn), body.model_dump())
    audit(conn, actor=principal, action="media.group.preset", decision="allowed", resource_type="media_group_preset", resource_id=row["preset_id"], request_id=_rid(request),
          details={"op": "create", "name": row["name"], "members": len(json.loads(row["members_json"]))})
    background.add_task(ha_sync.publish, {"type": "media_groups_changed"})
    return _preset_out(conn, principal, row["preset_id"])


@router.put("/multimedia/groups/presets/{preset_id}")
def put_preset(preset_id: str, request: Request, background: BackgroundTasks, principal: Principal = Depends(_layout_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """media.layout: edit a saved group; `base_revision` is the revision the editor loaded (409 revision_conflict otherwise)."""
    body: PresetUpdateBody = _parse(request, raw, PresetUpdateBody)
    fields = body.model_dump()
    base = fields.pop("base_revision")
    row = media_groups.update_preset(conn, principal, media_groups.load_catalog(conn), preset_id, fields, base)
    audit(conn, actor=principal, action="media.group.preset", decision="allowed", resource_type="media_group_preset", resource_id=preset_id, request_id=_rid(request),
          details={"op": "update", "name": row["name"], "revision": row["revision"]})
    background.add_task(ha_sync.publish, {"type": "media_groups_changed"})
    return _preset_out(conn, principal, preset_id)


@router.delete("/multimedia/groups/presets/{preset_id}", status_code=204)
def delete_preset(preset_id: str, request: Request, background: BackgroundTasks, base_revision: int | None = Query(None, ge=0), principal: Principal = Depends(_layout_gate),
                  conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """media.layout: delete a saved group (`?base_revision=` makes it conditional on the revision the editor loaded)."""
    media_groups.delete_preset(conn, preset_id, base_revision)
    audit(conn, actor=principal, action="media.group.preset", decision="allowed", resource_type="media_group_preset", resource_id=preset_id, request_id=_rid(request), details={"op": "delete"})
    background.add_task(ha_sync.publish, {"type": "media_groups_changed"})
    return Response(status_code=204)


@router.post("/multimedia/groups/presets/{preset_id}/apply", status_code=202)
def apply_preset(preset_id: str, request: Request, principal: Principal = Depends(_group_gate), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Start a saved group with one tap (decision 3א): the group as a DIFF against the leader's live group - leave the extras, join the missing, then the saved
    volumes clamped to each room's ceilings - in three ordered phases, an outcome per room. The same permission, confirmation and bridge rules as a join."""
    act, body, not_after = _group_request(request, conn, principal, raw, GroupApplyBody, preset_id[:64])
    row = conn.execute("SELECT * FROM media_group_presets WHERE preset_id = ?", (preset_id,)).fetchone()
    if row is None:
        raise act.refuse(media_commands.err(404, "not_found"))
    settings, secret = _group_bridge(request, conn, principal, act)
    try:
        plan = media_groups.plan_preset(conn, store.Access(conn, principal), media_groups.load_catalog(conn), row, body.confirmed is True)
    except ApiError as exc:
        raise act.refuse(exc) from None
    act.resource_type = "devices_preset"
    return _start_group(request, conn, principal, act, plan, body, not_after, settings, secret, bulk.scope_key("group", row["leader_key"]))
