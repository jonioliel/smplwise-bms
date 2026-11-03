"""WisKey tab (CR-005, access control through the owner's `hikvision_intercom` integration).

SMPLWISE's browser never talks to Home Assistant: these endpoints check SMPLWISE's own permission first and serve
what services/intercom_sync.py read from WisKey over HA's WebSocket API. Phase 1a: the read-only entry center
(`access.read`), with each station camera's still grabbed through go2rtc; phase 1b: the read-only activity log and people directory, same permission (CR-005 §3).

Phase 3 (owner-approved per capability, 2026-09-27): three PHYSICAL actions, each gated on `access.release` at
installation scope - door release (`stations/test_unlock`), call answer / reject / hang up (`media/signal`) and a spoken
announcement (`tts/engines` + `tts/start`). They ride the feed's own Home Assistant session (IntercomSync.action),
are never queued or retried, and carry a command id and an expiry. Once the caller holds `access.release`, every
request to them is written to SMPLWISE's audit log under the real SMPLWISE actor: a refusal as one row, a command sent
to WisKey as an attempt row committed before sending plus an outcome row (see the section note below). WisKey's own
log sees only the add-on's single HA user (CR-005 §3, "Accountability gap and its mitigation").

Phase 2, slice A1 (owner decision 2026-09-28): the person editor - the first WRITE to WisKey's people store this
product makes - gated on `access.people.manage` (site_admin + system_admin by default, sensitive, grantable per person
through a custom role). Its endpoints reuse the physical actions' write path unchanged (permission before body, JSON
only, envelope, attempt / outcome audit) in the feed's config lane, and serve an editor projection of their own that
is never served under `access.read`. Door technical settings, schedules and photos do not live here yet.

Phase 2, slice A2 (owner decision 2026-09-28): card capture from a station's reader - `access.cards.capture` on top of
`access.people.manage`, WisKey's own capture commands, sessions owned by the SMPLWISE user who started them
(services/intercom_capture.py); see the card-capture section note below."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import queue
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path as FilePath
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Path, Query, Request, WebSocket
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, ValidationError, model_validator
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..db import Database, commit_now, get_setting, now_iso, unlocked
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, STATION, Principal, authorize, note_grant, require
from ..services import bridge_rotation, capture_lease, capture_lease_route, door_authority, ha_bridge, lease_events, trusted_door
from ..services import go2rtc as g2
from ..services import intercom_adapter, intercom_client, intercom_sync, wiskey_background_feed, wiskey_camera, wiskey_diagnostics
from ..services import intercom_authority as ia
from ..services import intercom_writes as iw
from ..services.intercom_capture import CAPTURES, POLLED
from ..services.timeutil import parse_utc
from .media import _principal_for_ws
from .settings import read_settings

router = APIRouter()
log = logging.getLogger("smplwise.intercom")

READ = "access.read"
CREDENTIALS = "system.configure"  # device secrets: the system administrator only
DOOR_OPEN = door_authority.DOOR_OPEN  # WXPERM: the door release's permission (CR-033 door rule); calls / announcements ride ia.CALL since 2.4.9
RELEASE = door_authority.RELEASE  # its legacy name, honoured through rbac.LEGACY_PERMISSIONS (routers/access.py PERMISSION_LABELS)
MANAGE = "access.people.manage"  # the person editor (CR-005 phase 2); same default grants and sensitivity as access.release
CAPTURE = "access.cards.capture"  # card capture from a station reader (CR-005 phase 2 A2); required IN ADDITION to MANAGE
PIN_GENERATE = ia.PIN_GENERATE  # CR-036 S11 (PG): a person's PIN, shown once; required IN ADDITION to MANAGE
RECHECK_S = 60
MAX_PAGE = 200  # WisKey's own cap for events/list and users/query
MAX_STATION_ID = 128


def _reader(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.read` at installation scope, checked as a dependency: FastAPI resolves dependencies before it validates
    query parameters, so a caller without the permission learns nothing about them (WisKey's own handlers authorize
    first, too). Returns the principal, whose id keys the caller's own rate bucket."""
    require(conn, principal, READ, INSTALLATION)
    return principal


def _reader_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """`_reader` on the request's read-mode connection, for a path the browser polls (camera stills): no write lock per
    request; a refusal's audit row is still written (rbac.require -> audit's write-aside)."""
    require(conn, principal, READ, INSTALLATION)
    return principal


def _gate(permission: str):
    """CR-036 S3: a station-scoped read's permission somewhere a station can be (intercom_authority.require_anywhere), as a
    dependency on the request's READ connection - checked before any parameter is validated, refused with an audited 403;
    the rows are then filtered per station by the same Authority."""

    def dep(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
        return ia.require_anywhere(conn, principal, permission, getattr(request.state, "correlation_id", None))

    return dep


def _visible_stations(auth: ia.Authority, stations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """CR-036 S3: only the stations on the caller's chain (`access.read`) - omitted, never greyed."""
    return [s for s in stations if auth.station(READ, s.get("id"))]


def _credentials_admin(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, CREDENTIALS, INSTALLATION)
    return principal


_credentials_admin_ro = read_gate(lambda conn, principal: require(conn, principal, CREDENTIALS, INSTALLATION))  # review L7


def _instant(name: str, value: str | None) -> str | None:
    """WisKey accepts only an aware ISO instant (<=40 chars) for `start` / `end`; refuse anything else here with a clear
    422 instead of letting WisKey answer `invalid_fields`."""
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן ISO עם אזור זמן (למשל 2026-09-27T08:00:00Z).")
    return value


@router.get("/intercom/overview")
def overview(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The entry center: stations with online / ringing / sync state (no last-access record and no people counts since
    B0: D-006, a person's name reaches a screen only through the activity log), plus the feed's own
    state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`, `ready`).
    `overview` is null whenever there is nothing honest to show; `fresh` is false for a copy from before a disconnect.
    `camera_access` says, per station with a camera, whether its still can be had (`ready`) or why not (`no_media`,
    `no_host`, `no_credentials`) - see wiskey_camera.camera_access."""
    require(conn, principal, READ, INSTALLATION)
    settings = settings_of(request)
    body = intercom_sync.SYNC.snapshot(settings)
    if body["overview"] is not None:  # CR-036 S3: a station denied on its chain is omitted (CR-033 station scope)
        body["overview"] = {**body["overview"], "stations": _visible_stations(ia.Authority(conn, principal), body["overview"]["stations"])}
    body["camera_access"] = wiskey_camera.camera_access(conn, settings, body["overview"])
    # CR-033 D3: per station, whether this caller may open a door there (the one door rule) - the screen offers the open
    # button only then; the release route decides again
    stations = [s["id"] for s in (body["overview"] or {}).get("stations", [])]
    body["door_access"] = door_authority.door_access_map(conn, principal, stations, dev_mode=bool(settings.dev_user))
    return body


@router.get("/intercom/background")
def background(request: Request, principal: Principal = Depends(_reader), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The background (read) channel (B0, D-006): the closed station-health projection `{schema_version, generated_at,
    permission_revision, stations: [{id, name, online, last_seen}]}` and nothing else - no last access, no person, no
    counts, no operational detail. `identity` says whose session produced it: `background` (the dedicated account, the
    channel split from the service session) or `service` (no background account configured yet: the same four fields cut
    down from the service feed's copy, `split: false`). `projection` is null whenever there is nothing honest to show.
    CR-036 S3: only the stations on the caller's chain."""
    view = wiskey_background_feed.channel_view(settings_of(request))
    if view.get("projection") is not None:
        view["projection"] = {**view["projection"], "stations": _visible_stations(ia.Authority(conn, principal), view["projection"]["stations"])}
    return view


@router.get("/intercom/diagnostics")
def diagnostics(request: Request, principal: Principal = Depends(_credentials_admin), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What WisKey sees Arx as (B0, ported as CR-036 S1; `system.configure`): WisKey's `authorization/session` for the service
    identity (the add-on's own Home Assistant user, which also carries the existing writes) and for the background identity (its
    own session once the owner configured `wiskey_background_token`; until then it says it shares the service identity), plus
    each channel's command allow-list. Permission facts only - areas, station scope, field levels, security state, whether
    `subscribe` is live - with `findings` derived from them. Read-only; nothing is changed in WisKey and no person field is
    involved. Each run sends a command to WisKey on the administrator's request, so it leaves one audit row (identity states
    and finding codes only)."""
    body = wiskey_diagnostics.collect(settings_of(request), who=principal.user_id)
    audit(conn, actor=principal, action="intercom.diagnostics.read", decision="allowed", resource_type="intercom", resource_id="diagnostics",
          request_id=getattr(request.state, "correlation_id", None),
          details={"service": body["service"]["authorization_state"], "background": body["background"]["authorization_state"],
                   "split": bool(body["background"].get("split")), "findings": [f["code"] for f in body["findings"]]})
    return body


@router.get("/intercom/events")
def events(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.EVENTS_READ)),
    station_id: str | None = Query(None, min_length=1, max_length=128),
    person: str | None = Query(None, min_length=1, max_length=128),
    result: Literal["granted", "denied", "unknown"] | None = Query(None),
    authentication: Literal["card", "pin", "unknown"] | None = Query(None),
    door: int | None = Query(None, ge=1, le=2),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    limit: int = Query(100, ge=1, le=MAX_PAGE),
    before: str | None = Query(None, min_length=1, max_length=128),
    current_group: str | None = Query(None, min_length=1, max_length=128),
) -> dict[str, Any]:
    """The activity log: one page of WisKey's `events/list`, newest first (WisKey keeps 5 000 records / 30 days).
    `before` is the previous page's `events.next`; WisKey refusing a request that carried `before` is a 422
    `intercom_cursor_expired` (reload from page one), any other refusal a 422 `intercom_invalid_request`. WisKey's
    `current_profile` filter is deliberately not offered: matching events by a profile value (an ID number, say) would
    let a reader probe values the people endpoints never show. Reply: `{state, configured, last_error, fetched_at,
    events, sync}`, `events` null unless `state` is `ready`. WisKey has no event push: refetch on the
    `intercom_refresh` notice, like WisKey's own panel.

    CR-036 S3/S4: `access.events.read` (was `access.read`), the rows of the caller's stations only (the projection
    filter; `next` is then an opaque cursor), `current_group` needs `access.people.read`; read by the adapter
    (services/intercom_adapter.py) on the read channel. The native screens' own endpoint is GET /access-control/events."""
    start, end = _instant("start", start), _instant("end", end)
    if start and end and datetime.fromisoformat(start.replace("Z", "+00:00")) >= datetime.fromisoformat(end.replace("Z", "+00:00")):
        raise ApiError(422, "validation", "start חייב להיות לפני end.")
    if current_group is not None:
        ia.require_anywhere(auth.conn, auth.principal, ia.PEOPLE_READ, getattr(request.state, "correlation_id", None))
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "door": door, "start": start, "end": end, "current_group": current_group}
    try:
        return intercom_adapter.ADAPTER.events(settings_of(request), auth, filters, limit=limit, before=before, legacy=True)
    except ApiError as exc:
        if exc.code == "intercom_invalid_request" and before is not None:
            # every other field was validated above, so a refused paged request is WisKey's pruned cursor
            raise ApiError(422, "intercom_cursor_expired", "רשימת האירועים התעדכנה והסמן של 'טען עוד' פג - טענו מחדש מההתחלה.", details=exc.details) from exc
        raise


@router.get("/intercom/people")
def people(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ)),
    query: str = Query("", max_length=160),
    offset: int = Query(0, ge=0, le=10_000_000),
    limit: int = Query(50, ge=1, le=MAX_PAGE),
    snapshot: str | None = Query(None, max_length=64),
    station: str | None = Query(None, min_length=1, max_length=128),
    group: str | None = Query(None, min_length=1, max_length=128),
    rights: Literal["assigned", "unassigned", "disabled"] | None = Query(None),
    state: Literal["active", "inactive", "expired", "upcoming"] | None = Query(None),
    sort: Literal["name", "name_desc", "employee"] = Query("employee"),
) -> dict[str, Any]:
    """The people directory, projected to what a read-only list shows (no phones, cards, PIN flags or profile values).
    `query` is matched by SMPLWISE against name and employee number only and is never sent to WisKey (whose own search
    also matches phone digits and card last-4); `total` and the offsets then count matches. `people.complete` is false
    when the scan stopped early (`incomplete_reason` `scan_limit` / `rate_limited`: narrow the search). Pass the
    previous page's `people.snapshot` back; `people.stale` then says the directory changed underneath the paging. The
    `credential` and `profile` filters are deliberately not offered. Reply: `{state, configured, last_error,
    fetched_at, people, sync}`.

    CR-036 S3/S4: `access.people.read` (was `access.read`); the people the caller may see only (through an assignment
    on a station of theirs), counted over them (`total_all` null unless the caller sees everyone); the employee number
    and the employee-number order where the caller sees it; read by the adapter on the read channel. The native screens'
    own endpoint is GET /access-control/people."""
    filters: dict[str, Any] = {"station": station, "group": group, "rights": rights, "state": state, "sort": sort}
    return intercom_adapter.ADAPTER.people(settings_of(request), auth, query=query, filters=filters, offset=offset, limit=limit, snapshot=snapshot, legacy=True)


@router.get("/intercom/people/{user_id}")
def person(request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ)), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person (WisKey `users/get`), same projection as a directory row; an unknown id - or one the caller may not see
    (CR-036 S3) - is a 404 `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`."""
    return intercom_adapter.ADAPTER.person(settings_of(request), auth, user_id, legacy=True)


# ---------------------------------------------------------------- station camera stills (access.read), through go2rtc

def _still_path(settings: Any, station_id: str) -> FilePath:
    folder = settings.data_dir / "snapshots" / "intercom"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{hashlib.sha256(station_id.encode()).hexdigest()[:32]}.jpg"


@router.get("/intercom/stations/{station_id}/camera-snapshot.jpg")
def camera_snapshot(
    request: Request,
    principal: Principal = Depends(_reader_ro),
    conn: sqlite3.Connection = Depends(get_read_conn),
    station_id: str = Path(min_length=1, max_length=MAX_STATION_ID),
) -> Response:
    """A still of the station's camera for the entry center's door cards (WisKey's own overview shows one per station,
    `.live=${false}`). Read-only, `access.read` like the rest of the overview. The owner's rule is that all video goes
    through go2rtc: the frame comes from go2rtc's /api/frame.jpeg, which pulls the station's own RTSP stream (host from
    the served WisKey copy, credentials from SMPLWISE - wiskey_camera.credentials). Home Assistant is never asked for
    the picture. Cached in /data for `snapshots.max_age_s` and served like the NVR snapshot (routers/cameras.py): a
    stale copy with X-Snapshot-Stale / X-Snapshot-Error when no new frame can be had, else the error itself.

    Errors: 404 `intercom_station_not_found` / `intercom_no_camera`; 503 `ha_not_configured` / `intercom_unavailable`
    (no served copy), `intercom_camera_host_unknown`, `source_not_configured` (no credentials), `media_not_configured`
    (no go2rtc) - these configuration gaps are answered before any cached copy is looked at - and, with no cached
    copy, `intercom_station_offline`, `media_unavailable` / `media_error` / `snapshot_unavailable` from go2rtc."""
    settings = settings_of(request)
    state, overview = intercom_sync.SYNC.served(settings)
    if overview is None:
        if state == "ha_not_configured":
            raise ApiError(503, "ha_not_configured", "אין גישה לתשתית המערכת, ולכן אין נתוני WisKey ואין תמונת מצלמה.")
        raise ApiError(503, "intercom_unavailable", "נתוני WisKey אינם זמינים כרגע, ולכן אין תמונת מצלמה.", retryable=True, details={"state": state})
    station = next((s for s in overview.get("stations", []) if s["id"] == station_id), None)
    if station is None or not ia.Authority(conn, principal).station(READ, station_id):  # CR-036 S3: off the chain = not found
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    if not station.get("camera_entity"):
        raise ApiError(404, "intercom_no_camera", f"לעמדה {station['name']} אין מצלמה ב־WisKey.")
    from ..services import wiskey_auto_install as wai

    if station.get("online") and wai.switch_on(conn):
        # WISKEY-R3-2272: with the installation switch on the door cards get the installed WisKey still first (the frontend keeps
        # this URL; `GET /access-control/stations/{id}/thumbnail.jpg` serves the same still) - never cached, never stale
        with unlocked(conn):
            installed = wai.route_snapshot(settings, station_id)
        if installed is not None:
            return Response(installed[0], media_type=installed[1], headers={"Cache-Control": "private, no-store", "X-Snapshot-Stale": "false"})
    host = intercom_sync.SYNC.station_host(settings, station_id)
    if not host:
        raise ApiError(503, "intercom_camera_host_unknown", "WisKey לא מסר את כתובת העמדה, ולכן אין ממנה תמונה.")
    username, password = wiskey_camera.credentials(conn, settings, station_id)
    source = g2.wiskey_rtsp_url(host, username, password)
    client = g2.Go2rtc(settings)
    max_age = read_settings(conn)["snapshots.max_age_s"]
    path = _still_path(settings, station_id)
    cached = _read_still(path)
    if cached is not None and time.time() - cached[1] < max_age:
        age = int(time.time() - cached[1])
        return Response(cached[0], media_type="image/jpeg", headers={"Cache-Control": f"private, max-age={max(1, max_age - age)}", "X-Snapshot-Age": str(age)})
    try:
        if not station["online"]:
            raise ApiError(503, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת, ולכן אין ממנה תמונה עדכנית.")
        with unlocked(conn):
            data = client.frame_jpeg(g2.wiskey_stream_name(station_id), source)
    except ApiError as exc:
        if cached is None:
            raise
        return Response(cached[0], media_type="image/jpeg", headers={"Cache-Control": "private, max-age=10", "X-Snapshot-Stale": "true", "X-Snapshot-Error": exc.code})
    _store_still(path, data)
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": f"private, max-age={max_age}", "X-Snapshot-Age": "0"})


def _read_still(path: FilePath) -> tuple[bytes, float] | None:
    """The cached still and its time, read once; None when there is none (an override change may drop it any time)."""
    try:
        mtime = path.stat().st_mtime
        return path.read_bytes(), mtime
    except OSError:
        return None


def _store_still(path: FilePath, data: bytes) -> None:
    """Best effort: a temp file of this request's own (two cache misses for one station never share one - security
    review S2), then an atomic replace. The frame is served from memory either way; a replace that fails (Windows
    refuses to replace a file another request is reading at that moment) only skips caching this one."""
    tmp = path.with_name(f"{path.stem}.{uuid.uuid4().hex}.tmp")
    try:
        tmp.write_bytes(data)
        os.replace(tmp, path)
    except OSError as exc:
        log.debug("camera still not cached (%s)", type(exc).__name__)
    finally:
        tmp.unlink(missing_ok=True)


# ---------------------------------------------------------------- per-station camera credentials (system.configure)
# Every station is assumed to share the add-on options' account (owner decision 2026-09-28); these set or clear one
# station's own. Write-only: no reply ever carries a username or password (like HA's `password` option type).

class StationCredentials(BaseModel):
    username: str = Field(min_length=1, max_length=256)  # WisKey's own limits (ConnectionSettings)
    password: str = Field(min_length=1, max_length=256)


async def _credentials_body(request: Request) -> bytes:
    """The body, unparsed; declared AFTER the permission dependency, so a caller without system.configure gets an
    audited 403 whatever they sent (FastAPI would otherwise parse a declared body model first: 422 before 403)."""
    return await request.body()


def _refuse_credentials(conn: sqlite3.Connection, principal: Principal, request: Request, station_id: str, exc: ApiError) -> ApiError:
    audit(conn, actor=principal, action="intercom.credentials.set", decision="denied", resource_type="intercom_station", resource_id=station_id,
          reason=exc.code, request_id=getattr(request.state, "correlation_id", None))
    return exc


def _parse_credentials(conn: sqlite3.Connection, principal: Principal, request: Request, station_id: str, raw: bytes) -> StationCredentials:
    """The physical endpoints' order (_parse): the content type, then the JSON, then the fields - each an audited refusal."""
    content_type = request.headers.get("content-type")
    if not _is_json(content_type):
        raise _refuse_credentials(conn, principal, request, station_id, ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise _refuse_credentials(conn, principal, request, station_id, ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    try:
        return StationCredentials.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise _refuse_credentials(conn, principal, request, station_id, ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None


def _drop_still(request: Request, station_id: str) -> None:
    """Another account may show another picture (or none): the cached still is not served for up to max_age (N4a)."""
    _still_path(settings_of(request), station_id).unlink(missing_ok=True)


@router.get("/intercom/stations/credentials")
def stations_credentials(request: Request, principal: Principal = Depends(_credentials_admin), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The admin screen's list: the feed's state, whether the shared default is set, and per station (every one the
    feed knows, plus any override row for a station it no longer lists - `known: false`) whether an override exists and
    since when. Names come from the feed; no username, password or host is ever in the reply."""
    settings = settings_of(request)
    state, overview = intercom_sync.SYNC.served(settings)
    return {"state": state, **wiskey_camera.listing(conn, settings, overview)}


@router.get("/intercom/stations/{station_id}/credentials")
def station_credentials(request: Request, principal: Principal = Depends(_credentials_admin), conn: sqlite3.Connection = Depends(get_conn), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID)) -> dict[str, Any]:
    """Whether the station has its own credentials, whether the shared default is set, and which one applies."""
    return wiskey_camera.status(conn, settings_of(request), station_id)


@router.put("/intercom/stations/{station_id}/credentials")
def set_station_credentials(
    request: Request,
    principal: Principal = Depends(_credentials_admin_ro),
    raw: bytes = Depends(_credentials_body),
    conn: sqlite3.Connection = Depends(get_conn),
    station_id: str = Path(min_length=1, max_length=MAX_STATION_ID),
) -> dict[str, Any]:
    body = _parse_credentials(conn, principal, request, station_id, raw)
    replaced = wiskey_camera.set_override(conn, settings_of(request), station_id, body.username, body.password, principal.user_id)
    _drop_still(request, station_id)
    audit(conn, actor=principal, action="intercom.credentials.set", decision="allowed", resource_type="intercom_station", resource_id=station_id,
          request_id=getattr(request.state, "correlation_id", None), details={"replaced": replaced})
    return wiskey_camera.status(conn, settings_of(request), station_id)


@router.delete("/intercom/stations/{station_id}/credentials")
def clear_station_credentials(request: Request, principal: Principal = Depends(_credentials_admin), conn: sqlite3.Connection = Depends(get_conn), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID)) -> dict[str, Any]:
    removed = wiskey_camera.clear_override(conn, station_id)
    _drop_still(request, station_id)
    audit(conn, actor=principal, action="intercom.credentials.clear", decision="allowed", resource_type="intercom_station", resource_id=station_id,
          request_id=getattr(request.state, "correlation_id", None), details={"removed": removed})
    return wiskey_camera.status(conn, settings_of(request), station_id)


# ---------------------------------------------------------------- physical actions (access.release)
#
# Accountability (CR-005 §3; T054 review B1). Once the caller holds access.release, EVERY request to a physical endpoint
# leaves audit rows under the real SMPLWISE actor, all with the endpoint's action (`intercom.release` / `.call` / `.tts`):
# - a request refused before anything is sent (malformed body, expired or duplicate command, unknown station, no such
#   relay, offline, missing confirmation, a release of that relay still unresolved): ONE row, decision `denied`,
#   `reason` = the refusal code, `details.phase` = "refused", `details.outcome` = "not_sent";
# - a command handed on to WisKey: an ATTEMPT row (`phase` "attempt") committed BEFORE the command is sent - if it
#   cannot be written, nothing is sent - and then an OUTCOME row (`phase` "outcome", `outcome` ok / not_sent / refused /
#   unknown, `reason` = the failure code) written in a short transaction of its own after WisKey answered. The outcome
#   row is best effort by design: if the database is locked at that moment, the caller still gets the real result and
#   the attempt row (same `command_id`) stands as the record that the command was sent.
# The request's own write transaction is committed before the WisKey call and is NOT re-taken afterwards (only a
# deferred, lock-free BEGIN), so a contended database can never turn a sent command into a 500 without a record.
#
# Command envelope (MASTER_SPEC_HE §15; T054 review S2): every physical request carries `client_request_id` and
# `expires_at`, as the HA bridge's actions do (routers/ha.py). An expired request is refused, a request whose expiry
# lies more than EXPIRY_MAX_S ahead is refused (it would make the expiry meaningless), and the command is checked
# again on the feed's loop immediately before its frame is written: it is sent only before min(expires_at, arrival +
# SEND_WITHIN_S). A `client_request_id` already used by the same caller for a command that was handed on to WisKey
# is refused as a duplicate (the attempt rows are the durable record; DEDUPE_WINDOW_S >> EXPIRY_MAX_S, so a replay can
# never outlive its dedupe).

COMMAND_ID = r"^[A-Za-z0-9-]{8,64}$"  # no LIKE wildcards: the duplicate check matches it inside the audit JSON
EXPIRY_MAX_S = 60.0
SEND_WITHIN_S = 15.0
DEDUPE_WINDOW_S = 600.0
UNKNOWN_HOLD_S = 10.0  # a relay stays blocked this long after a release with an unknown outcome settled (S1)
CALL_LIMIT_S = 60.0  # ha_client's own per-call limit: WisKey's answer to a sent command cannot come later than this
GUARD_MAX_S = 90.0  # safety net only: a relay entry never settled is free again after this long (ha_client gives up at 60 s)


class CommandEnvelope(BaseModel):
    client_request_id: str = Field(pattern=COMMAND_ID)
    expires_at: str = Field(min_length=1, max_length=40)


ORIGIN_RE = re.compile(r"notification:[A-Za-z0-9_-]{1,64}")


class ReleaseBody(CommandEnvelope):
    # the relay (`integrated_locks[].physical_index`); may be left out when the station has exactly one
    lock: StrictInt | None = Field(None, ge=1, le=64)
    # the UI's confirmation step, stated explicitly (the same rule as a sensitive HA action's `confirmation_grant`).
    # Any JSON value is accepted here and only `true` confirms, so a wrong value is an audited refusal, not a bare 422.
    confirmed: Any = None
    # CR-018: where the release was started from - `notification:<id>` when the in-app confirmation was reached through a notification's
    # "open door" deep link. Recorded in the audit rows only; it changes nothing about the permission, the confirmation or the send. Any other
    # value is ignored (never refused), so an older client behaves exactly as before.
    origin: Any = None


class CallBody(CommandEnvelope):
    command: Literal["answer", "reject", "hangUp"]


class TtsBody(CommandEnvelope):
    engine_id: str = Field(min_length=1, max_length=128)
    language: str | None = Field(None, min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=4 * intercom_client.TTS_MESSAGE_MAX)  # checked again once collapsed


# 2.4.10 (TTSLOG): the announcement's audit rows record how long the text was, never the text. The buckets are coarse on
# purpose (a length is a weak fingerprint of a short message); the last one is the refusal of an over-long text.
TTS_LENGTH_BUCKETS: tuple[tuple[int, str], ...] = ((0, "0"), (20, "1-20"), (60, "21-60"), (150, "61-150"), (intercom_client.TTS_MESSAGE_MAX, f"151-{intercom_client.TTS_MESSAGE_MAX}"))


def tts_length_bucket(length: int) -> str:
    """The bucket of a collapsed announcement's length (`TTS_LENGTH_BUCKETS`); `over_<max>` beyond WisKey's limit."""
    for upper, label in TTS_LENGTH_BUCKETS:
        if length <= upper:
            return label
    return f"over_{intercom_client.TTS_MESSAGE_MAX}"


class _Relay:
    """One relay's release in progress (see _RelayGuard)."""

    __slots__ = ("since", "settled", "unknown", "hold_until")

    def __init__(self) -> None:
        self.since = time.monotonic()
        self.settled = False
        self.unknown = False
        self.hold_until = 0.0


class _RelayGuard:
    """T054 review S1: at most one release per (station, relay) at a time, never queued. A relay is busy from the moment
    a release is accepted for sending until the WisKey call is really over - IntercomSync.action's `on_settled`, called
    when WisKey answers, the session ends or ha_client's own limit expires, which can be long after the HTTP request
    gave up with "outcome unknown" - and, after an unknown outcome, for UNKNOWN_HOLD_S more, so nobody can fire a second
    release into an ambiguous state straight away."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._relays: dict[tuple[str, int], _Relay] = {}

    def acquire(self, key: tuple[str, int]) -> _Relay | None:
        now = time.monotonic()
        with self._lock:
            held = self._relays.get(key)
            if held is not None and now - held.since < GUARD_MAX_S and (not held.settled or now < held.hold_until):
                return None
            entry = self._relays[key] = _Relay()
            return entry

    def settle(self, entry: _Relay) -> None:
        with self._lock:
            entry.settled = True
            if entry.unknown:
                entry.hold_until = max(entry.hold_until, time.monotonic() + UNKNOWN_HOLD_S)

    def remaining(self, key: tuple[str, int]) -> float:
        """An upper bound, in seconds, on how long this relay stays blocked: the rest of the hold when the call already
        settled, else the rest of ha_client's own call limit plus the hold."""
        now = time.monotonic()
        with self._lock:
            held = self._relays.get(key)
            if held is None or now - held.since >= GUARD_MAX_S:
                return 0.0
            if held.settled:
                return max(0.0, held.hold_until - now)
            return max(0.0, CALL_LIMIT_S - (now - held.since)) + (UNKNOWN_HOLD_S if held.unknown else 0.0)

    def mark_unknown(self, entry: _Relay) -> None:
        with self._lock:
            entry.unknown = True
            entry.hold_until = max(entry.hold_until, time.monotonic() + UNKNOWN_HOLD_S)

    def clear(self) -> None:
        with self._lock:
            self._relays.clear()


RELAYS = _RelayGuard()


# 2.4.9 (owner decision 2026-10-13; CR-036 owner answer 6 of 2026-10-12): the call signal (answer / reject / hang up), the
# announcement and the TTS engine list ride `access.call` - the permission S18's talk already uses - on the station chain,
# no longer `access.release` at installation scope. The gate: `access.call` anywhere a station can be, checked on a READ
# connection before the body is read (review L7; a refusal is audited as `access.call` denied); the route then judges the
# named station (`_call_station`). `access.read` alone, and the door grant alone (`access.release`), never act on a call.
_caller_ro = read_gate(lambda conn, principal: ia.require_anywhere(conn, principal, ia.CALL))


def _caller(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """The same `access.call` gate for the body-less read of the TTS engines."""
    ia.require_anywhere(conn, principal, ia.CALL, getattr(request.state, "correlation_id", None))
    return principal


def _call_station(act: "_Action") -> None:
    """`access.call` on the named station's chain (deny wins), before anything is sent; refused and audited as not sent."""
    if not ia.Authority(act.conn, act.principal).station(ia.CALL, act.station_id):
        raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לשיחות ולהכרזות בעמדה הזו.", details={"permission": ia.CALL}))


def _door_gate_ro(request: Request, station_id: str = Path(), principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """CR-033 D3: the door release's permission gate, before the body is read (the read_gate pattern). The one door rule
    (services/door_authority.py) at station level: `access.doors.open` on the station's chain (or its legacy name
    `access.release` in a custom role), or `door.unlock` on a lock entity the door map links to this station, and no deny of
    either. The precise relay is judged again once the body names it. A refusal is audited as `access.doors.open` denied
    (WXPERM; it was `access.release` before the rename)."""
    sid = station_id[:MAX_STATION_ID]
    decision = door_authority.may_open_some_door(conn, principal, sid, dev_mode=bool(settings_of(request).dev_user))
    if not decision.allowed:
        audit(conn, actor=principal, action=DOOR_OPEN, decision="denied", resource_type=STATION, resource_id=sid, reason=decision.reason)
        raise forbidden(permission=DOOR_OPEN, target_type=STATION, target_id=sid, reason=decision.reason)
    return principal


class _Action:
    """One physical request's (or people write's) audit context: who, which endpoint, which station (or person), and
    what is known so far."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, action: str, resource_id: str, resource_type: str = "intercom_station") -> None:
        self.request, self.conn, self.principal, self.action, self.resource_id, self.resource_type = request, conn, principal, action, resource_id, resource_type
        self.rid = getattr(request.state, "correlation_id", None)
        self.details: dict[str, Any] = {"command": action.removeprefix("intercom.")}

    @property
    def station_id(self) -> str:
        return self.resource_id

    def _row(self, conn: sqlite3.Connection, decision: str, reason: str | None, fields: dict[str, Any]) -> None:
        audit(conn, actor=self.principal, action=self.action, decision=decision, resource_type=self.resource_type, resource_id=self.resource_id,
              reason=reason, request_id=self.rid, details={**self.details, **fields})

    def refuse(self, exc: ApiError) -> ApiError:
        """Audit a refusal before anything was sent, and return the error to raise (its `details.outcome` is
        `not_sent`, so the UI can say for certain that nothing happened)."""
        exc.details.setdefault("outcome", "not_sent")
        self._row(self.conn, "denied", exc.code, {"phase": "refused", "outcome": "not_sent"})
        return exc

    def attempt(self) -> None:
        """The attempt row, committed before the command is sent: no record, no command."""
        self.details["command_id"] = uuid.uuid4().hex
        self._row(self.conn, "allowed", None, {"phase": "attempt"})
        commit_now(self.conn, keep_reading=False)  # hands the write lock on: the command and the outcome row run without it

    def outcome(self, outcome: str, reason: str | None, fields: dict[str, Any]) -> None:
        try:
            db: Database = self.request.app.state.db
            with db.write_aside() as w:
                self._row(w, "allowed", reason, {"phase": "outcome", "outcome": outcome, **fields})
        except Exception:  # noqa: BLE001 - the command was sent; its attempt row stands (see the section note)
            log.exception("audit: the outcome (%s) of %s command %s could not be recorded; its attempt row stands", outcome, self.action, self.details.get("command_id"))


async def _raw_body(request: Request) -> bytes:
    """The request body, unparsed. Declared AFTER the permission dependency, so a caller without access.release gets
    403 whatever they sent, and a body that is not JSON is an audited refusal (`_parse`), not FastAPI's bare 422."""
    return await request.body()


def _is_json(content_type: str | None) -> bool:
    """`application/json` or an `application/<x>+json` subtype, parameters (charset) ignored."""
    media = (content_type or "").split(";", 1)[0].strip().lower()
    return media == "application/json" or (media.startswith("application/") and media.endswith("+json"))


def _parse(act: _Action, model: type[BaseModel], raw: bytes) -> Any:
    """Validate the station id, the content type and the body; every failure is an audited refusal (nothing is sent).

    The content type is enforced explicitly (T054 final confirmation B-1): `text/plain` and form-encoded bodies are
    CORS "simple requests" that a browser sends cross-site WITHOUT a preflight, so a JSON payload smuggled in one of
    them must never actuate a door. Only `application/json` (or a `+json` subtype) is read; a JSON Content-Type forces
    the preflight. FastAPI's own body parsing rejected the others implicitly; reading the raw body here, it must be said."""
    if not 1 <= len(act.resource_id) <= MAX_STATION_ID:
        act.resource_id = act.resource_id[:MAX_STATION_ID]  # the audit row keeps a bounded id
        raise act.refuse(ApiError(422, "validation", "מזהה העמדה אינו תקין." if act.resource_type == "intercom_station" else "מזהה האדם אינו תקין.", details={"fields": ["station_id" if act.resource_type == "intercom_station" else "user_id"]}))
    content_type = act.request.headers.get("content-type")
    if not _is_json(content_type):
        raise act.refuse(ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).", details={"content_type": (content_type or "")[:100]}))
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):  # RecursionError: a pathologically nested body (N-1) is a refusal, not a 500
        raise act.refuse(ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]})) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise act.refuse(ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields})) from None


def _envelope(act: _Action, body: CommandEnvelope) -> datetime:
    """Expiry and duplicate checks. Returns the instant after which the command must not be sent."""
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at)
    try:
        expires = parse_utc(body.expires_at)
    except ValueError:
        raise act.refuse(ApiError(422, "validation", "expires_at חייב להיות זמן UTC (Z).")) from None
    now = datetime.now(timezone.utc)
    if expires <= now:
        raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שהגיעה לשרת, ולכן לא נשלחה. אם השעון במכשיר שלכם אינו מדויק, תקנו אותו."))
    if expires > now + timedelta(seconds=EXPIRY_MAX_S):
        raise act.refuse(ApiError(422, "expires_too_far", f"תוקף הבקשה חייב להסתיים תוך {int(EXPIRY_MAX_S)} שניות."))
    since = (now - timedelta(seconds=DEDUPE_WINDOW_S)).strftime("%Y-%m-%dT%H:%M:%SZ")
    seen = act.conn.execute(
        "SELECT 1 FROM audit_log WHERE action = ? AND actor_user_id = ? AND at >= ? AND details_json LIKE ? AND details_json LIKE ? LIMIT 1",
        (act.action, act.principal.user_id, since, f'%"client_request_id": "{body.client_request_id}"%', '%"phase": "attempt"%'),
    ).fetchone()
    if seen:
        raise act.refuse(ApiError(409, "intercom_duplicate_command", "הפקודה הזו כבר נשלחה (אותו מזהה פקודה), ולכן לא נשלחה שוב."))
    return min(expires, now + timedelta(seconds=SEND_WITHIN_S))


def _station(act: _Action, require_online: bool = True) -> dict[str, Any] | None:
    """The station from the served copy. 404 when there is a copy and it has no such station; without any copy (feed
    not configured / never ready) there is nothing to check against, and the action fails as `not_sent` on its own."""
    station = intercom_sync.SYNC.station(act.station_id)
    if station is None and intercom_sync.SYNC.has_copy():
        raise act.refuse(ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey."))
    if station is not None:
        act.details["station_name"] = station["name"]
        if require_online and not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה."))
    return station


def _perform(
    act: _Action,
    key: str,
    send: Callable[[intercom_client.Call], Any],
    project: Callable[[Any], dict[str, Any]],
    not_after: datetime,
    on_settled: Callable[[], None] | None = None,
    on_unknown: Callable[[], None] | None = None,
    lane: str = "action",
    summary: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    slot_wait: float = 0.0,
    free: bool = False,
    on_result: Callable[[dict[str, Any], str], None] | None = None,
    target: str | None = None,
) -> dict[str, Any]:
    """Audit the attempt (committed), send once through IntercomSync.action, audit the outcome. `target` (a people write to an
    existing person, `intercom_sync.person_target`): after an unknown outcome the next write to that person is refused, nothing
    sent, until the editor has read the person fresh (WisKey round 3, R3-06). `on_settled` is always
    called exactly once (by IntercomSync once the command was handed over, here when it never got that far);
    `on_unknown` when the outcome is unknown. `summary` turns the projected result into what the outcome row records
    (the physical actions record the result itself; a people write records counts and names only). `slot_wait`: how
    long the lane's slot may be waited for (the capture lane's; the others answer `busy` at once); `free`: no rate
    token is spent (a capture cancel); `on_result(reply, outcome)`: the caller's record of the outcome, made before the
    lane's slot is freed (IntercomSync._execute)."""
    try:
        act.attempt()
    except BaseException:
        if on_settled:
            on_settled()
        raise
    try:
        reply = intercom_sync.SYNC.action(settings_of(act.request), key, send, project, who=act.principal.user_id, not_after=not_after, on_settled=on_settled, lane=lane, slot_wait=slot_wait, free=free,
                                          on_result=on_result, target=target)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        if outcome == "unknown" and on_unknown:
            on_unknown()
        if outcome == "unknown" and act.resource_type == PERSON and act.action != "intercom.card_capture.start":
            capture_lease.on_authority_change("person_changed", person_ids=[act.resource_id])  # T12: the person may have changed
        code = str(exc.details.get("wiskey_code") or exc.code)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        raise
    except BaseException as exc:
        if on_unknown:
            on_unknown()
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        raise
    finally:
        act.conn.execute("BEGIN")  # deferred: takes no lock, cannot wait on a busy database; nothing more is written here
    act.outcome("ok", None, {"result": summary(reply[key]) if summary else reply[key]})
    reply["command_id"] = act.details["command_id"]
    if act.resource_type == PERSON and act.action != "intercom.card_capture.start":
        # CR-WISKEY-LEASE-REVOCATION-EVENT T12: the person changed under any live capture lease for them (non-blocking, never raises)
        capture_lease.on_authority_change("person_changed", person_ids=[act.resource_id])
    return reply


def _relay_of(act: _Action, station: dict[str, Any] | None, lock: int | None) -> int:
    """The relay a release names, checked against the served copy: refused (audited, nothing sent) when the station has no
    active integrated lock, more than one relay and none named, a relay it does not have, or is offline."""
    if station is not None:
        if not station["lock_enabled"] or not station["locks"]:
            raise act.refuse(ApiError(409, "intercom_no_lock", f"לעמדה {station['name']} אין מנעול משולב פעיל ב־WisKey."))
        indexes = [entry["physical_index"] for entry in station["locks"]]
        if lock is None:
            if len(indexes) != 1:
                raise act.refuse(ApiError(422, "intercom_lock_required", "לעמדה יותר ממנעול אחד - יש לבחור איזה לשחרר.", details={"locks": indexes}))
            lock = indexes[0]
        elif lock not in indexes:
            raise act.refuse(ApiError(422, "intercom_lock_unknown", "לעמדה אין מנעול במספר הזה.", details={"locks": indexes}))
        if not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה."))
    if lock is None:
        lock = 1  # no copy to check against: WisKey's own default relay (panel.ts unlock(station, physical = 1))
    return lock


@router.post("/intercom/stations/{station_id}/release")
def release(request: Request, station_id: str, principal: Principal = Depends(_door_gate_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Release a station's door relay once. Body: `{lock?, confirmed, client_request_id, expires_at, origin?}`; `confirmed:
    true` is sent only by the UI's confirmation dialog. Permission (CR-033 D3): the one door rule (services/door_authority.py)
    - `access.doors.open` (legacy name `access.release`) on the station's chain or `door.unlock` on the mapped lock entity, deny of either wins - at the gate
    and again for the named relay. Transport (CR-033 D4): services/trusted_door.py - today's `stations/test_unlock` while
    `doors.trusted_path` is off, the signed `door_open` once it is on; never `execute`. The reply's `release.accepted`
    means the command was ACCEPTED ("sent"); it does not mean the door moved. Refused before sending, each refusal
    audited: a malformed body, an expired or duplicate command, an unknown station (404), a station without an integrated
    lock, offline, a relay it does not have, no permission for that relay, a missing confirmation, or a release of the same
    relay not yet resolved (409 `intercom_release_in_progress`). Anything that then does not complete is an error whose
    `details.outcome` says whether the command was not sent, refused, or has an unknown outcome. Reply: `{state,
    configured, last_error, fetched_at, release, sync, note, command_id, door_request_id}`."""
    act = _Action(request, conn, principal, "intercom.release", station_id)
    body: ReleaseBody = _parse(act, ReleaseBody, raw)
    not_after = _envelope(act, body)
    station = _station(act, require_online=False)
    lock = _relay_of(act, station, body.lock)
    act.details["lock"] = lock
    entry_point = "wiskey_screen"
    if isinstance(body.origin, str) and ORIGIN_RE.fullmatch(body.origin):
        act.details["origin"] = body.origin  # CR-018: started from a notification's deep link (audit only, never authority)
        entry_point = "notification"
    decision = door_authority.check(conn, principal, station_id, lock, dev_mode=bool(settings_of(request).dev_user))
    if not decision.allowed:
        raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לפתוח דלת זו", details={"reason": decision.reason}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שחרור דלת דורש אישור מפורש."))
    reply = open_door(act, station_id, lock, entry_point, not_after, decision)
    reply["note"] = "WisKey קיבל את הפקודה. זה אינו אישור שהדלת נפתחה בפועל."
    return reply


# ---------------------------------------------------------------- the one door path (CR-033 D4)
#
# Every Arx-started opening of a WisKey door ends here, after the route's own checks and the one door authority: the WisKey
# screen and its notification deep link (release above) and the devices tile / map card (`open_from_tile`, called by
# routers/ha.py for a WisKey lock's lock.unlock). The transport is chosen by `doors.trusted_path` (services/trusted_door.py).

def _door_details(act: _Action, station_id: str, lock: int, entry_point: str, decision: door_authority.DoorDecision, mode: str) -> str:
    request_id = trusted_door.new_request_id()
    act.details.update(transport=trusted_door.TRANSPORT, mode="signed" if mode == "on" else "interim", entry_point=entry_point, door_request_id=request_id,
                       station=station_id, relay=lock, **decision.audit_fields())
    note_grant(decision.as_rbac(), decision.granted_by or door_authority.UNLOCK)
    return request_id


def open_door(act: _Action, station_id: str, lock: int, entry_point: str, not_after: datetime, decision: door_authority.DoorDecision,
              before_attempt: Callable[[sqlite3.Connection], None] | None = None) -> dict[str, Any]:
    """Send one WisKey door opening that every check already allowed: the relay guard, the attempt row (committed before
    sending), the transport, the outcome row. Never retried, never queued. `before_attempt(conn)` writes the caller's own
    pending record in the same transaction as the attempt row (the tile's ha_actions row)."""
    mode = trusted_door.mode(act.conn)
    if not intercom_sync.SYNC.has_copy() and (mode == "on" or intercom_sync.STATE.state == "ready"):
        # SEC-WXD L5: without a WisKey copy the station, the relay and its online state cannot be checked (a relay re-wired
        # or removed in WisKey would be opened as mapped) - refused, nothing is sent. The signed transport does not use the
        # feed, so it is refused here always; the interim one needs the feed, which refuses on its own (with the feed's
        # state) unless the feed is up and the copy is not there yet
        raise act.refuse(ApiError(503, "intercom_unavailable", "הפקודה לא נשלחה: אין כרגע נתונים עדכניים ממערכת האינטרקום."))
    request_id = _door_details(act, station_id, lock, entry_point, decision, mode)
    entry = RELAYS.acquire((station_id, lock))
    if entry is None:
        wait = RELAYS.remaining((station_id, lock))
        raise act.refuse(ApiError(409, "intercom_release_in_progress", f"פקודה קודמת עדיין בטיפול. המתינו עד {int(wait) + 1} שניות ובדקו במצלמה לפני שמנסים שוב.", details={"retry_after_s": round(wait, 1)}))
    if before_attempt is not None:
        try:
            before_attempt(act.conn)
        except BaseException:
            RELAYS.settle(entry)
            raise
    try:
        if mode == "on":
            reply = _perform_signed(act, station_id, lock, request_id, not_after, on_settled=lambda: RELAYS.settle(entry), on_unknown=lambda: RELAYS.mark_unknown(entry))
        else:
            reply = _perform(act, "release", lambda call: intercom_client.release_door(call, station_id, lock), intercom_sync.project_release, not_after,
                             on_settled=lambda: RELAYS.settle(entry), on_unknown=lambda: RELAYS.mark_unknown(entry))
    except ApiError as exc:
        if exc.details.get("outcome") == "unknown":
            exc.details["retry_after_s"] = round(RELAYS.remaining((station_id, lock)), 1)  # the UI holds the button this long
        if mode == "on":
            exc.details["door_request_id"] = request_id  # the status read asks about it (the interim transport has none)
        raise
    reply["door_request_id"] = request_id
    return reply


# the add-on's own call to the bridge failed before anything could reach it: nothing was sent
_NOT_SENT_CODES = {"ha_not_configured", "service_not_found", "ha_forbidden", "bridge_not_paired",
                    "wiskey_direct_not_connected", "capture_source_unavailable",  # WKCAP-295: the direct capture transport (services/wiskey_capture_direct.py)
                    "capture_receiver_unsupported", "capture_dto9_unmappable"}  # CAPMAP-295: the disabled DTO9 pre-flight (services/wiskey_capture_map.py)
_NOT_SENT_ERRORS = {"ConnectError", "ConnectTimeout"}


def _perform_signed(act: _Action, station_id: str, lock: int, request_id: str, not_after: datetime, on_settled: Callable[[], None], on_unknown: Callable[[], None]) -> dict[str, Any]:
    """The signed transport (mode `on`): sign `door_open` with the real principal as actor, commit the attempt row (with
    `body_sha256`), call `smplwise_bridge.door_open` once, map WisKey's closed answer, record the outcome. An answer
    after a possible delivery is never `refused`; an unknown outcome is resolved only by `door_open_status`."""
    settled = False

    def settle() -> None:
        nonlocal settled
        if not settled:
            settled = True
            on_settled()

    try:
        secret = ha_bridge.signing_key(act.conn)
        if not secret or not get_setting(act.conn, "bridge.paired_at"):
            raise act.refuse(ApiError(503, "bridge_not_paired", "אין חיבור לתשתית המערכת"))
        if bridge_rotation.door_commands_paused(act.conn):  # HMACACT2-295: no door command is signed while the key set may be half switched
            raise act.refuse(ApiError(503, bridge_rotation.PAUSE_CODE, bridge_rotation.PAUSE_TEXT))
        if datetime.now(timezone.utc) >= not_after:
            raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שנשלחה."))
        p = act.principal
        signed = trusted_door.sign_message(secret, "door_open", p.user_id, trusted_door.actor_name(p), station_id, {"relay": lock}, request_id)
        act.details["body_sha256"] = signed.body_sha256  # computed after signing, recorded only in the audit
        act.attempt()
    except BaseException:
        settle()
        raise
    try:
        try:
            answer = trusted_door.call_bridge(settings_of(act.request), "door_open", signed.text)
        except ApiError as exc:
            not_sent = exc.code in _NOT_SENT_CODES or (exc.code == "ha_unavailable" and exc.details.get("error") in _NOT_SENT_ERRORS)
            outcome = "not_sent" if not_sent else "unknown"
            if outcome == "unknown":
                on_unknown()
            act.outcome(outcome, exc.code, {"error": exc.code, "code": exc.code})
            if not_sent:
                raise ApiError(503, exc.code, "אין חיבור לתשתית המערכת", details={"outcome": "not_sent"}) from None
            raise ApiError(504, "door_outcome_unknown", trusted_door.OUTCOME_TEXT["unknown"], details={"outcome": "unknown"}) from None
        except BaseException as exc:
            on_unknown()
            act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
            raise
    finally:
        settle()
        act.conn.execute("BEGIN")  # deferred, lock-free: nothing more is written on the request connection
    outcome, code = trusted_door.classify(answer, request_id)
    if outcome == "sent":
        act.outcome("ok", None, {"result": {"accepted": True}, "code": code})
        return {"release": {"accepted": True}, "command_id": act.details["command_id"]}
    if outcome == "refused":
        act.outcome("refused", code, {"code": code})
        raise ApiError(409, "door_refused", trusted_door.refusal_text(code), details={"outcome": "refused"})
    on_unknown()
    act.outcome("unknown", code, {"code": code})
    raise ApiError(504, "door_outcome_unknown", trusted_door.OUTCOME_TEXT["unknown"], details={"outcome": "unknown"})


def open_from_tile(request: Request, principal: Principal, entity_id: str, action_id: str, client_request_id: str, expires_at: str, confirmation_grant: str | None) -> dict[str, Any]:
    """A1/A2/A4 (CR-033 5.2): `lock.unlock` of a WisKey lock entity from a devices tile, the tiles panel's dialog or a map /
    home card - the same route (`POST /ha/entities/{id}/actions`) and the same response shape as before, but judged by the
    one door authority (no `ha.entity.control` needed for a WisKey door) and sent through `open_door`, never through the
    bridge's `execute`. The `ha_actions` row is written with `via = trusted_door` and no expected state, so the screens
    show "sent" and never "opened" (decision 22); an unknown outcome is `unknown`, a refusal `failed`."""
    from ..services import ha_actions, intercom_doors

    db: Database = request.app.state.db
    settings = settings_of(request)
    with db.connection(label="door.open tile") as conn:
        existing = conn.execute("SELECT id FROM ha_actions WHERE principal_user_id = ? AND client_request_id = ?", (principal.user_id, client_request_id)).fetchone()
        if existing:
            return ha_actions.action_row(conn, existing["id"])  # idempotent: a duplicate click never sends twice
        act = _Action(request, conn, principal, "intercom.release", entity_id, resource_type="ha_entity")
        act.details.update(client_request_id=client_request_id[:80], expires_at=expires_at[:40], entity_id=entity_id)
        try:
            expires = parse_utc(expires_at)
        except ValueError:
            raise act.refuse(ApiError(422, "validation", "expires_at חייב להיות UTC (Z).")) from None
        now = datetime.now(timezone.utc)
        if expires <= now:
            raise act.refuse(ApiError(409, "expired", "הבקשה פגה; נסה שוב."))
        not_after = min(expires, now + timedelta(seconds=SEND_WITHIN_S))
        try:
            target = intercom_doors.resolve(conn, entity_id)
        except ApiError as exc:
            raise act.refuse(exc) from None
        station = intercom_sync.SYNC.station(target.station_id)
        if station is None and intercom_sync.SYNC.has_copy():
            raise act.refuse(intercom_doors.unmapped(entity_id))
        if station is not None:
            act.details["station_name"] = station["name"]
        lock = _relay_of(act, station, target.relay)
        act.details["lock"] = lock
        decision = door_authority.check(conn, principal, target.station_id, lock, entity_id=entity_id, dev_mode=bool(settings.dev_user))
        if not decision.allowed:
            raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לפתוח דלת זו", details={"reason": decision.reason, "action": action_id}))
        if confirmation_grant != "confirmed":
            raise act.refuse(ApiError(409, "confirmation_required", "פעולה רגישה דורשת אישור מפורש.", details={"action": action_id}))
        aid = uuid.uuid4().hex[:12]

        def pending_row(w: sqlite3.Connection) -> None:
            w.execute(
                "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (aid, entity_id, action_id, "{}", principal.user_id, principal.username, client_request_id, "pending", now_iso(), None, trusted_door.TRANSPORT),
            )

        def record(status: str, error: str | None) -> None:
            try:
                with db.write_aside(label="door.open tile answer") as w:
                    w.execute("UPDATE ha_actions SET status = ?, error = ?, responded_at = ?, confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END WHERE id = ?",
                              (status, error, now_iso(), status, now_iso(), aid))
            except Exception:  # noqa: BLE001 - the door's own audit rows are the record; the tile row stays pending and turns unknown on its own
                log.exception("door.open tile: the answer of %s could not be recorded", aid)

        try:
            open_door(act, target.station_id, lock, "devices_tile", not_after, decision, before_attempt=pending_row)
        except ApiError as exc:
            outcome = exc.details.get("outcome")
            record("unknown" if outcome == "unknown" else "failed", exc.code)
            raise
        record("confirmed", None)  # confirmation "none": the screens say "sent", never "opened"
    with db.connection(mode="read", label="door.open tile row") as r:
        out = ha_actions.action_row(r, aid)
    out["note"] = "נשלח. זה אינו אישור שהדלת נפתחה בפועל."
    return out


@router.post("/intercom/stations/{station_id}/call")
def call_signal(request: Request, station_id: str, principal: Principal = Depends(_caller_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Answer / reject a ringing call or hang up a call in progress (WisKey `media/signal`). Body: `{command,
    client_request_id, expires_at}`. Permission (2.4.9): `access.call` anywhere a station can be at the gate, then on this
    station's chain. WisKey checks the call state on the device itself and refuses a mismatch
    (`device_unavailable`), so SMPLWISE does not second-guess it from its own copy, which can lag a ring by a moment.
    The reply's `call` is WisKey's result as sent: `acknowledged` (true, or null when the device's answer was lost),
    `observed_state` / `observation` after the signal, and `physical_result: "unverified"`. Refusals and outcomes are
    audited like a release. Reply: `{state, configured, last_error, fetched_at, call, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.call", station_id)
    body: CallBody = _parse(act, CallBody, raw)
    act.details["signal"] = body.command
    not_after = _envelope(act, body)
    _call_station(act)
    _station(act)
    return _perform(act, "call", lambda call: intercom_client.media_signal(call, station_id, body.command), intercom_sync.project_signal, not_after)


@router.get("/intercom/tts/engines")
def tts_engines(request: Request, principal: Principal = Depends(_caller), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Home Assistant's TTS engines WisKey can speak through (`tts/engines`, a read): `{state, configured, last_error,
    fetched_at, tts, sync}` with `tts = {default, engines: [{engine_id, name, supported_languages, default_language}]}`,
    null unless `state` is `ready`. Gated like the announcement itself (WisKey gates it at manage level too)."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "tts", intercom_client.tts_engines, intercom_sync.project_tts_engines, who=principal.user_id)


@router.post("/intercom/stations/{station_id}/tts")
def tts_speak(request: Request, station_id: str, principal: Principal = Depends(_caller_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Speak `message` through the station's speaker (WisKey `tts/start`). Body: `{engine_id, language, message,
    client_request_id, expires_at}`. Permission (2.4.9): `access.call` anywhere at the gate, then on this station's chain
    (an announcement to several stations is one request per station, each judged). The text goes to the Home Assistant TTS engine `engine_id` - which may be a cloud
    provider, so the text can leave the premises. SMPLWISE's audit rows (refused requests too) hold the envelope only:
    the station (the row's resource), the engine, the language, a length bucket of the collapsed text (`length_bucket`,
    TTS_LENGTH_BUCKETS) and the outcome - never the text itself (2.4.10, TTSLOG). The reply's `tts` is the
    announcement's progress when WisKey took it (`started`, or already `generating` / ...); later progress arrives as
    `intercom_tts` notices on /intercom/ws, ending in `completed` (`physical_result: "unverified"`) or `closed` with a
    reason. Reply: `{state, configured, last_error, fetched_at, tts, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.tts", station_id)
    body: TtsBody = _parse(act, TtsBody, raw)
    message = intercom_client.collapse(body.message)
    act.details.update(engine_id=body.engine_id, language=body.language, length_bucket=tts_length_bucket(len(message)))
    if not 1 <= len(message) <= intercom_client.TTS_MESSAGE_MAX:
        raise act.refuse(ApiError(422, "validation", f"ההודעה חייבת להכיל 1-{intercom_client.TTS_MESSAGE_MAX} תווים."))
    not_after = _envelope(act, body)
    _call_station(act)
    _station(act)
    language = body.language
    return _perform(act, "tts", lambda call: intercom_sync.SYNC.tts_start(call, station_id, body.engine_id, language, message), lambda status: status, not_after)


# ---------------------------------------------------------------- person editor (access.people.manage), CR-005 phase 2 A1
#
# The first write to WisKey's people store. Brief A.4-A.6, owner decisions 2026-09-28: the editor's own projection
# (`intercom_sync.project_person_editor`: phone, masked cards, PIN flag - never a PIN value or a full card number) is
# served only here, never under `access.read`; every write follows the physical actions' path exactly (permission as a
# dependency before the body, JSON only, `client_request_id` + `expires_at`, attempt row committed before sending,
# outcome row after) in the feed's config lane, so a save WisKey holds can never take a door release's slot. The draft
# is validated locally with models mirroring WisKey's USER_FIELDS / CARD_FIELDS (extra keys forbidden, strict types),
# so a malformed draft is an audited `not_sent` refusal, not a round trip. Audit details carry field NAMES and counts
# (and the person's id / employee number / display name, which every access.read holder sees anyway) - never a PIN, a
# card number (not even the masked form), a phone or a profile value.
#
# Timing in this slice is permanent / date-range only; weekly and station-native schedules, custom profile fields,
# groups and photos are slice A3 and are deliberately not accepted here (`extra="forbid"` refuses their keys). Card
# capture from a station reader is slice A2. WisKey's `pin_check` oracle is not offered (owner decision 8): a
# conflicting PIN surfaces at save time as `intercom_pin_conflict`, and `users/pin_generate` gives a free one.
#
# CR-036 S11 (owner decisions 2026-10-12: every write in stage 1; Arx RBAC the only authority; DW / PG approved): these endpoints
# moved from installation scope onto the access-control station chain - `access.people.manage` (and `access.cards.capture` /
# `access.pin.generate` where they apply) anywhere a station can be as the dependency (before the body, audited 403), then the
# person's own stations before AND after the change (services/intercom_writes.py `gate_person_write`, a fresh `users/get` unless
# the caller is unrestricted; the write then carries the revision that read returned); a sensitive field needs
# `access.people.sensitive` on the same stations. The audit rows keep the actor, the request ids, the logical target and the
# outcome, plus the field NAMES of an update - never a value (no PIN, card number, phone, name, relay map, count or hash). Every
# reply says its effect class (`effect`, `pending`); delete and the capture commands are UNKNOWN_EFFECT ("sent, result
# pending"). The editor accepts the access category, the responsible person and purpose, and the timing proposal / enforced
# policy too; the photo, archive, activation, temporary cancel and single cards have endpoints of their own
# (routers/access_control_writes.py). The editor projection is served at the caller's field level (iw.view_editor_person).

IDENTIFIER = r"^[A-Za-z0-9_-]{1,32}$"  # WisKey validate_identifier / validate_card (client/access.py)
PIN_PATTERN = r"^[0-9]{1,128}$"  # models.py build_user
PHONE = re.compile(r"^\+?[0-9 ()-]+$")  # models.py phone_value, 7-15 digits
UUID_TEXT = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")  # uuid_text: canonical form
MAX_CARDS = 255
MAX_ASSIGNMENTS = 100
PERIOD_MIN = datetime(1970, 1, 1, tzinfo=timezone.utc)  # valid_period bounds
PERIOD_MAX = datetime(2037, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
PERSON = "intercom_person"


def _no_control(value: str) -> bool:
    return not any(ord(c) < 32 for c in value)


class CardData(BaseModel):
    """One card of the draft (WisKey CARD_FIELDS): a saved card by `id` (its stored number is kept - the browser never
    has it) or a new card by `card_no`, never both."""

    model_config = ConfigDict(extra="forbid")
    id: str | None = None
    card_no: str | None = Field(None, pattern=IDENTIFIER)
    label: str = Field("", max_length=64)
    card_type: Literal["normalCard"] = "normalCard"
    enabled: StrictBool = True

    @model_validator(mode="after")
    def _one_identity(self) -> "CardData":
        if (self.id is None) == (self.card_no is None):
            raise ValueError("a card is either a saved one by id or a new one by card_no")
        if self.id is not None and not UUID_TEXT.fullmatch(self.id):
            raise ValueError("card id")
        if not _no_control(self.label):
            raise ValueError("label")
        return self


def _station_key(key: str) -> bool:
    return 1 <= len(key) <= 64 and _no_control(key)


class PersonData(BaseModel):
    """The draft, as a patch: only the keys present are sent to WisKey (`users/update` keeps the rest). Mirrors WisKey's
    USER_FIELDS for what this slice edits; `profile`, `group_ids`, `photo`, `access_timing_*`, `user_type` are not
    accepted (extra keys are refused locally).

    Station access travels as WisKey's own editor sends it (panel.ts save(): `permission_overrides` + `door_permissions`
    + `access_policy_revision`), NEVER as the legacy absolute `assignments`: in WisKey's `group_permissions.prepare` an
    already-allowed station keeps its previous `allowed_locks` unless `door_permissions` names it, so a relay removed
    from an existing assignment would be silently kept (review B1). `door_permissions` lists the ENABLED stations with
    their relays; `permission_overrides` the personal allow / deny per station (a station granted by a group and left
    alone has none). `access_policy_revision` is the profile policy revision the editor loaded, when WisKey has one, so
    WisKey's `group_policy_changed` check applies."""

    model_config = ConfigDict(extra="forbid")
    employee_no: str | None = Field(None, pattern=IDENTIFIER)
    display_name: str | None = Field(None, min_length=1, max_length=32)
    phone: str | None = Field(None, max_length=32)
    active: StrictBool | None = None
    valid_from: str | None = Field(None, max_length=40)
    valid_until: str | None = Field(None, max_length=40)
    pin: str | None = Field(None, pattern=PIN_PATTERN)  # present and null = remove the PIN (WisKey: `pin: null`)
    cards: list[CardData] | None = Field(None, max_length=MAX_CARDS)
    permission_overrides: dict[str, Literal["allow", "deny"]] | None = None
    door_permissions: dict[str, list[StrictInt]] | None = None
    access_policy_revision: StrictInt | None = Field(None, ge=0)
    # CR-036 S11: the access category with its responsible person and purpose (a visitor / contractor needs both a responsible
    # person and an end date - WisKey's `guest_responsible_required` / `invalid_validity`), and the timing: the proposal
    # (`access_timing_draft`, never a grant) and the enforced policy (`access_timing_policy`: `ha` = Arx's own enforcement
    # through WisKey's rolling validity window, `native` = the device's own schedule with per-station slot bindings). Present
    # and null clears it. Both are validated exactly as WisKey validates them (services/intercom_writes.py).
    access_category: Literal["staff", "visitor", "contractor"] | None = None
    responsible_person: str | None = Field(None, max_length=64)
    access_purpose: str | None = Field(None, max_length=128)
    access_timing_draft: dict[str, Any] | None = None
    access_timing_policy: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _rules(self) -> "PersonData":
        if self.display_name is not None and (not self.display_name.strip() or not _no_control(self.display_name)):
            raise ValueError("display_name")
        for text in (self.responsible_person, self.access_purpose):
            if text is not None and not _no_control(text):
                raise ValueError("text")
        if "access_category" in self.model_fields_set and self.access_category is None:
            raise ValueError("access_category")  # WisKey always has one: it can be changed, never removed
        try:
            if "access_timing_draft" in self.model_fields_set:
                self.access_timing_draft = iw.timing_draft(self.access_timing_draft)
            if "access_timing_policy" in self.model_fields_set:
                self.access_timing_policy = iw.timing_policy(self.access_timing_policy)
        except ValueError as exc:
            raise ValueError(f"timing: {exc}") from None
        if self.phone and (not PHONE.fullmatch(self.phone) or not 7 <= len(re.sub(r"[^0-9]", "", self.phone)) <= 15):
            raise ValueError("phone")
        if ("valid_from" in self.model_fields_set) != ("valid_until" in self.model_fields_set) or (self.valid_from is None) != (self.valid_until is None):
            raise ValueError("valid_from and valid_until go together")
        if self.valid_from is not None and self.valid_until is not None:
            try:
                start, end = parse_utc(self.valid_from), parse_utc(self.valid_until)
            except ValueError:
                raise ValueError("validity") from None
            if not PERIOD_MIN <= start < end <= PERIOD_MAX:
                raise ValueError("validity")
        if self.cards is not None:
            new = [c.card_no for c in self.cards if c.card_no is not None]
            ids = [c.id for c in self.cards if c.id is not None]
            if len(set(new)) != len(new) or len(set(ids)) != len(ids):
                raise ValueError("duplicate card")
        if (self.permission_overrides is None) != (self.door_permissions is None):
            raise ValueError("permission_overrides and door_permissions go together")
        if self.permission_overrides is not None and (len(self.permission_overrides) > MAX_ASSIGNMENTS or any(not _station_key(k) for k in self.permission_overrides)):
            raise ValueError("permission_overrides")
        if self.door_permissions is not None:
            if len(self.door_permissions) > MAX_ASSIGNMENTS or any(not _station_key(k) for k in self.door_permissions):
                raise ValueError("door_permissions")
            for locks in self.door_permissions.values():  # group_permissions.prepare: non-empty, within {1, 2}, distinct
                if not locks or any(lock not in (1, 2) for lock in locks) or len(set(locks)) != len(locks):
                    raise ValueError("door_permissions")
            if any(self.permission_overrides.get(k) == "deny" for k in self.door_permissions):  # type: ignore[union-attr]
                raise ValueError("a denied station cannot carry relays")
        return self

    def wiskey(self) -> dict[str, Any]:
        """The `data` dict for WisKey: exactly the keys the draft set, in WisKey's shapes."""
        out: dict[str, Any] = {}
        for key in ("employee_no", "display_name", "phone", "active", "valid_from", "valid_until", "pin",
                    "access_category", "responsible_person", "access_purpose", "access_timing_draft", "access_timing_policy"):
            if key in self.model_fields_set:
                out[key] = getattr(self, key)
        if self.cards is not None:
            out["cards"] = [
                {**({"id": c.id} if c.id is not None else {"card_no": c.card_no}), "label": c.label, "card_type": c.card_type, "enabled": c.enabled}
                for c in self.cards
            ]
        if self.permission_overrides is not None and self.door_permissions is not None:
            out["permission_overrides"] = dict(self.permission_overrides)
            out["door_permissions"] = {sid: sorted(locks) for sid, locks in self.door_permissions.items()}
        if self.access_policy_revision is not None:
            out["access_policy_revision"] = self.access_policy_revision
        return out


class PersonSaveBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")  # a stray top-level key (a `pin` outside `data`, say) is refused, not ignored
    data: PersonData
    # WisKey's own "Save & sync" (queue the stations now) vs "Save" (its periodic reconciliation, ~300 s, carries it)
    sync_now: StrictBool = True


class PersonUpdateBody(PersonSaveBody):
    revision: StrictInt = Field(ge=1)  # compare-and-set: the revision the editor loaded


class PersonDeleteBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)
    confirmed: Any = None  # only `true` (from the confirmation dialog) confirms, as ReleaseBody


class PinGenerateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field("", max_length=128)  # "" for a person not saved yet


def people_writer(*extra: str):
    """CR-036 S11: `access.people.manage` - and `extra` (`access.cards.capture`, `access.pin.generate`) - somewhere a station can
    be, as a dependency on the request's READ connection, checked before the body is read (audited 403s); the person's own
    stations are checked per request (services/intercom_writes.py). Returns the request's Authority. `access.read` alone never
    reaches the editor projection, let alone a write (was: installation scope)."""

    def dep(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
        rid = getattr(request.state, "correlation_id", None)
        auth = ia.require_anywhere(conn, principal, MANAGE, rid)
        for permission in extra:
            ia.require_anywhere(conn, principal, permission, rid)
        return auth

    return dep


def _write_summary(data: dict[str, Any]) -> dict[str, Any]:
    """What the audit records about a draft (D06, 2026-10-12): the NAMES of the fields it sets - never a value, a count, a
    relay map, a hash or a length."""
    return {"fields": sorted(data)}


def _person_summary(person: dict[str, Any]) -> dict[str, Any]:
    """The outcome row's record of the saved person: the logical target and its new revision only (D06)."""
    return {"id": person["id"], "revision": person["revision"]}


def gated(act: "_Action", conn: sqlite3.Connection, check: Callable[[], Any]) -> Any:
    """Run a station-scope check that may read the person from WisKey (services/intercom_writes.py) with the request's write lock
    released (a WisKey round trip never holds SQLite's single write lock); its refusal is an audited `not_sent`."""
    try:
        with unlocked(conn):
            return check()
    except ApiError as exc:
        raise act.refuse(exc) from None


def native_targets(stations: Any) -> list[tuple[str, str]]:
    """WKINT-295: the RBAC targets of the native write's fresh Arx decision - every station the station-scope gate covered, or the
    installation itself when the gate took the unrestricted shortcut (no station list)."""
    ids = [s for s in dict.fromkeys(stations or []) if isinstance(s, str) and s]
    return [(ia.STATION_SCOPE, s) for s in ids] or [INSTALLATION]


def people_send(act: "_Action", conn: sqlite3.Connection, command: str, business: dict[str, Any], fallback: Callable[[intercom_client.Call], Any], *,
                stations: Any, create_origin_ref: str | None = None) -> Callable[[intercom_client.Call], Any]:
    """WKINT-295: the people write's `send`. With WisKey's direct API selected (services/wiskey_direct_join.py: `access.station_media_provider
    = auto`, a pairing key that signs and an authenticated direct socket) it is the NATIVE write (services/wiskey_native_write.py:
    durable intent, signed command, verified receipt, UNKNOWN never re-sent); otherwise `fallback` - the Home Assistant send, unchanged.
    Without an installed join (no usable key, or `local`) nothing here runs at all. The selection may open the direct socket, so it
    runs with the request's write lock released."""
    from ..services import wiskey_direct_join

    if wiskey_direct_join.installed() is None:
        return fallback
    with unlocked(conn):
        native = wiskey_direct_join.people_send(conn, act.principal, command, business, targets=native_targets(stations),
                                                create_origin_ref=create_origin_ref)
    if native is None:
        return fallback
    act.details["transport"] = "wiskey_direct"
    return native


@router.get("/intercom/people-editor/context")
def people_editor_context(request: Request, auth: ia.Authority = Depends(people_writer())) -> dict[str, Any]:
    """What the editor needs from WisKey's `overview` beyond the entry center (intercom_sync.project_editor_context):
    the stations with their relays and whether each can take a keypad PIN, the HA display zone, WisKey's
    `api.capabilities`, whether the people-write commands are listed for the add-on's HA user (`writes_listed` /
    `users_manage`, null when WisKey does not say - the user needs WisKey's `users:manage` area), and whether a
    profile policy exists. A fresh read each time (never cached). Reply: `{state, configured, last_error, fetched_at,
    context, sync}`.

    CR-036 S11: only the stations the caller manages (`access.people.manage` on the station chain) - a station off it is
    omitted, never greyed; `capture_stations` the ids of those where the caller may also read a card (`access.cards.capture`);
    `pin_generate` whether this caller, in this session, may generate a PIN (the permission somewhere and an interactive
    session)."""
    reply = intercom_sync.SYNC.command(settings_of(request), "context", intercom_client.overview, intercom_sync.project_editor_context, who=auth.principal.user_id)
    ctx = reply.get("context")
    if ctx is not None:
        ctx["stations"] = [s for s in ctx["stations"] if auth.station(MANAGE, s["id"])]
        ctx["capture_stations"] = [s["id"] for s in ctx["stations"] if auth.station(CAPTURE, s["id"])]
        ctx["pin_generate"] = auth.anywhere(PIN_GENERATE) and iw.interactive(auth.principal)
    return reply


@router.get("/intercom/people/{user_id}/editor")
def person_editor(request: Request, auth: ia.Authority = Depends(people_writer()), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person for editing (WisKey `users/get`): the read projection plus phone, the PIN flag, the cards in WisKey's masked
    form (`•••• 1234` - the full number never leaves WisKey), the overrides, `identity_locked`, `has_timing`, each assignment's
    sync bookkeeping and (S11) the archive state, the access category, the responsible person and purpose, the photo flag and the
    timing proposal / policy. 404 `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`.

    CR-036 S11: only for a person the caller may change (`access.people.manage` on every station of theirs; a person they cannot
    see is the uniform 404, one shared with a station outside their chain a 403 `intercom_person_scope`), at the caller's field
    level (`person.level`; phone, the PIN flag, the cards, the photo flag, the responsible person and purpose are null below the
    sensitive level)."""
    try:
        reply = intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id),
                                           lambda raw: {"superset": intercom_adapter.project_one_person(raw), "editor": iw.project_editor(raw)}, who=auth.principal.user_id,
                                           target=intercom_sync.person_target(user_id))
    except ApiError as exc:
        if exc.code == "intercom_person_not_found":
            raise iw.uniform_not_found() from None
        raise
    found = reply.get("person")
    if found is not None:
        target = iw.check_person(auth, found["superset"])
        reply["person"] = iw.view_editor_person(auth, found["editor"], target.level)
    return reply


@router.post("/intercom/people/pin-generate")
def person_pin_generate(request: Request, response: Response, auth: ia.Authority = Depends(people_writer(PIN_GENERATE)), raw: bytes = Depends(_raw_body),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A free six-digit PIN from WisKey (`users/pin_generate`; body `{user_id}`, "" for a person not saved yet). Not
    reserved: the save still answers `intercom_pin_conflict` if it was taken meanwhile. Reply: `{state, ..., pin: {pin}}`; a
    WisKey refusal is `state: error` with `last_error` (`pin_generation_failed`), an unknown person a 404.

    CR-036 S11 (owner decision 2026-10-12, PG): `access.pin.generate` on top of `access.people.manage` (and, for a saved person,
    both on every station of theirs with the sensitive level - a PIN is a credential); an interactive human session only
    (services/intercom_writes.interactive: a bearer-token client is refused 403 `intercom_pin_interactive_only`). The value is in
    THIS response only (`Cache-Control: no-store`) for the requesting operator: never stored, logged, cached, audited, put in an
    error or replayed. The audit rows say who asked, for whom, the request ids and the outcome - never the value, its hash or its
    length."""
    response.headers["Cache-Control"] = "no-store"
    act = _Action(request, conn, auth.principal, "intercom.person.pin_generate", "new", PERSON)
    body: PinGenerateBody = _parse(act, PinGenerateBody, raw)
    act.resource_id = body.user_id or "new"
    act.details.update(iw.effect_fields("users/pin_generate"))
    if not iw.interactive(auth.principal):
        raise act.refuse(ApiError(403, "intercom_pin_interactive_only", "יצירת קוד PIN זמינה רק בהפעלה אינטראקטיבית של אדם (דפדפן), לא ללקוח עם אסימון.",
                                  details={"reason": "interactive_session_required"}))
    settings = settings_of(request)
    if body.user_id:
        gated(act, conn, lambda: iw.gate_person_write(settings, auth, body.user_id, permissions=(MANAGE, PIN_GENERATE), sensitive=True))
        # R4-07: a PIN for a person whose earlier write has no clear outcome could only be saved after a fresh read - refused here, nothing
        # sent (pin_generate is a read in WisKey, so it carries no `target` of its own and never counts as that fresh read)
        blocked = intercom_sync.SYNC.write_gate(intercom_sync.person_target(body.user_id))
        if blocked is not None:
            raise act.refuse(intercom_sync.action_error({"state": "error", "last_error": blocked}, "not_sent", "config"))
    elif not auth.anywhere(ia.PEOPLE_SENSITIVE):
        raise act.refuse(iw.field_refusal())
    act.attempt()
    try:
        reply = intercom_sync.SYNC.command(settings, "pin", lambda call: intercom_client.users_pin_generate(call, body.user_id), intercom_sync.project_pin, who=auth.principal.user_id)
    except ApiError as exc:
        act.outcome("refused", exc.code, {})
        if exc.code == "intercom_person_not_found":
            raise iw.uniform_not_found() from None
        raise
    except BaseException as exc:
        act.outcome("unknown", type(exc).__name__, {})
        raise
    finally:
        conn.execute("BEGIN")  # deferred, lock-free (as _perform): nothing more is written on the request's connection
    pin = reply.get("pin")
    state = reply.get("state")
    outcome = "ok" if pin is not None else ("not_sent" if state not in ("error", "forbidden", "unsupported") or reply.get("last_error") in ("busy", RATE_LIMITED_CODE) else "failed")
    act.outcome(outcome, None if pin is not None else str(reply.get("last_error") or state), {})  # never the value, its hash or length
    return reply


RATE_LIMITED_CODE = intercom_sync.RATE_LIMITED
SAVE_NOTE = "WisKey שמר את הרשומה. הסנכרון לתחנות מתבצע על ידי WisKey בנפרד - מצב הסנכרון של כל תחנה מוצג ברשומה."


@router.post("/intercom/people")
def person_create(request: Request, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Create a person in WisKey (`users/create`). Body: `{data: PersonData, sync_now, client_request_id, expires_at}`;
    `data` needs at least `display_name` and `employee_no`. Refused before sending (each refusal audited): a malformed
    draft, an expired or duplicate command. WisKey's refusals come back by name (`intercom_employee_conflict`,
    `intercom_pin_conflict`, `intercom_card_conflict`, `intercom_invalid_request` ...) with `details.outcome`
    `refused`; no clear answer is a 504 `intercom_outcome_unknown` (reload the directory before trying again - the
    person may exist). Reply: `{state, configured, last_error, fetched_at, person, sync, note, command_id, effect, pending}`;
    `person` is the saved record in the editor projection at the caller's field level (WisKey accepted it into its store - the
    stations follow, `sync_now` true asks them at once).

    CR-036 S11: `access.people.manage` on every station the draft names (unrestricted for a person with none), the sensitive
    level there for a sensitive field (403 `intercom_person_scope` / `intercom_field_level`, audited, nothing sent)."""
    act = _Action(request, conn, auth.principal, "intercom.person.create", "new", PERSON)
    body: PersonSaveBody = _parse(act, PersonSaveBody, raw)
    data = body.data.wiskey()
    act.details.update(sync_now=body.sync_now, **_write_summary(data), **iw.effect_fields("users/create"))
    not_after = _envelope(act, body)  # before the draft's own checks: every refusal row from here carries the command id
    missing = [k for k in ("display_name", "employee_no") if not data.get(k)]
    if missing:
        raise act.refuse(ApiError(422, "validation", "לאדם חדש נדרשים שם ומזהה עובד.", details={"fields": missing}))
    try:
        iw.gate_create(auth, iw.draft_stations(data), sensitive=iw.sensitive_write(auth, data))
    except ApiError as exc:
        raise act.refuse(exc) from None
    send = people_send(act, conn, "users/create", {"data": data, "sync_now": body.sync_now}, lambda call: intercom_client.users_create(call, data, body.sync_now),
                       stations=iw.draft_stations(data), create_origin_ref=f"arx-create:{body.client_request_id}")
    reply = _perform(act, "person", send, iw.project_editor, not_after, lane="config", summary=_person_summary)
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply["note"] = SAVE_NOTE
    reply.update(iw.effect_fields("users/create"))
    return reply


@router.put("/intercom/people/{user_id}")
def person_update(request: Request, user_id: str, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Update a person in WisKey (`users/update`, compare-and-set on `revision`). Body: `{data: PersonData (a patch),
    revision, sync_now, client_request_id, expires_at}`. A stale revision is a 409 `intercom_revision_conflict`
    (reload the person, then retry); the other refusals and the unknown outcome as for create. Reply as create.

    CR-036 S11: `access.people.manage` on every station of the person before AND after the change (the stations the patch
    names); the sensitive level for a sensitive field; a caller who is not unrestricted is checked against a fresh read and the
    patch must carry that read's revision."""
    act = _Action(request, conn, auth.principal, "intercom.person.update", user_id, PERSON)
    body: PersonUpdateBody = _parse(act, PersonUpdateBody, raw)
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, revision=body.revision)
    data = body.data.wiskey()
    if not data:
        raise act.refuse(ApiError(422, "validation", "אין שינוי לשמור.", details={"fields": ["data"]}))
    act.details.update(sync_now=body.sync_now, **_write_summary(data), **iw.effect_fields("users/update"))
    settings = settings_of(request)
    gate = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, after=iw.draft_stations(data), sensitive=iw.sensitive_write(auth, data), revision=body.revision))
    not_after = _envelope(act, body)  # expiry and duplicate under the write lock again, right before the attempt row
    send = people_send(act, conn, "users/update", {"user_id": user_id, "revision": body.revision, "data": data, "sync_now": body.sync_now},
                       lambda call: intercom_client.users_update(call, user_id, body.revision, data, body.sync_now),
                       stations=None if getattr(gate, "stations", None) is None else [*gate.stations, *iw.draft_stations(data)])
    reply = _perform(act, "person", send, iw.project_editor, not_after, lane="config", summary=_person_summary,
                     target=intercom_sync.person_target(user_id))
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply["note"] = SAVE_NOTE
    reply.update(iw.effect_fields("users/update"))
    return reply


@router.post("/intercom/people/{user_id}/delete")
def person_delete(request: Request, user_id: str, auth: ia.Authority = Depends(people_writer()), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Delete a person from WisKey (`users/delete`). Body: `{revision, confirmed, client_request_id, expires_at}`;
    `confirmed: true` is sent only by the confirmation dialog (WisKey's own `confirm_delete`, naming the stations the
    removal is scheduled on). WisKey answers `accepted`: the person left its list and the removal from each station
    (offline ones included) is queued, not done. Reply: `{state, ..., deleted: {accepted: true}, sync, note, command_id, effect,
    pending}`.

    CR-036 S11: `access.people.manage` on every station of the person. UNKNOWN_EFFECT (the DW matrix of 2026-10-12: WisKey
    schedules jobs): `pending: true` - the screens say "sent, result pending" until a read no longer finds the person."""
    act = _Action(request, conn, auth.principal, "intercom.person.delete", user_id, PERSON)
    body: PersonDeleteBody = _parse(act, PersonDeleteBody, raw)
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, revision=body.revision, **iw.effect_fields("users/delete"))
    if body.confirmed is not True:
        _envelope(act, body)  # an expired or duplicate command is refused as such first (the order the rows always had)
        raise act.refuse(ApiError(409, "confirmation_required", "מחיקת אדם דורשת אישור מפורש."))
    settings = settings_of(request)
    gate = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, revision=body.revision))
    not_after = _envelope(act, body)
    send = people_send(act, conn, "users/delete", {"user_id": user_id, "revision": body.revision},
                       lambda call: intercom_client.users_delete(call, user_id, body.revision), stations=getattr(gate, "stations", None))
    reply = _perform(act, "deleted", send, intercom_sync.project_accepted, not_after, lane="config",
                     target=intercom_sync.person_target(user_id))
    reply["note"] = "WisKey קיבל את המחיקה. ההסרה מכל תחנה (גם מנותקת) מתוזמנת על ידי WisKey ואינה מיידית."
    reply.update(iw.effect_fields("users/delete"))
    return reply


# ---------------------------------------------------------------- card capture (access.cards.capture + access.people.manage), CR-005 phase 2 A2
#
# The product's first long-running physical interaction: a station's card reader is put into collection mode, the
# person presents one card, WisKey reads it and shows it masked, and only the administrator's explicit approval adds it
# to the person (brief A.7; WisKey's own flow, access/enrollment.py + panel.ts:1432-1630, ported like for like - owner
# decision 2026-09-28, answers 2 and 10). Permissions: `access.cards.capture` is its own sensitive permission, required
# IN ADDITION to `access.people.manage` on every endpoint here (a capture ends in a people write), both checked as
# dependencies before the body is read. The write path is the physical actions' one (JSON only, envelope on start and
# confirm, attempt row committed before sending, outcome row after); the start needs `confirmed: true` (the dialog's
# confirmation step - it is a physical action on a reader at a door). Start and cancel ride the feed's capture lane (one
# slot, own buckets), the confirm the config lane (it is a people write), so none of them can take a door release's
# slot. Sessions are SMPLWISE-owned (services/intercom_capture.py): WisKey sees every SMPLWISE user as the add-on's one
# HA user, so a session is served, cancelled or confirmed only for the SMPLWISE user who started it - for anyone else
# it is a 404. The collected card is WisKey's masked form (`•••• 1234`) and appears only in its owner's replies: never
# in an audit row (the rows carry ids, station, reader, states, WisKey's codes, `cards_added: 1`) or a log line.
#
# Refused vs unknown per command: intercom_client.PRE_CAPTURE (verified against the WisKey source). A start whose
# outcome is unknown may have put the reader into collection mode under a session SMPLWISE cannot see: the station is
# held for the rest of WisKey's 120 s and the reply says so; nothing is ever added to a person without the confirm.
#
# CR-036 S11: both permissions anywhere a station can be as the dependency, then per request - the start: both on the reader's
# station and on every station of the person, with the sensitive level (a card is a credential), against a fresh read unless the
# caller is unrestricted (the start carries that read's revision); the stations decided at the start are kept with the session
# and checked again at the confirm (a scope taken away meanwhile refuses it). All three commands are UNKNOWN_EFFECT (DW matrix,
# 2026-10-12): the replies say `pending: true`. The browser cancels ONCE (no automatic retry of a write); a session nobody
# follows any more is cancelled by the backend after ABANDON_S (services/intercom_capture.py), not by a retry.

CAPTURE_NOTE = "הקורא בעמדה במצב קריאת כרטיס. הצמידו כרטיס אחד לקורא; שום כרטיס לא יתווסף לאדם עד שתאשרו אותו."
_capturer_ro = people_writer(CAPTURE)  # access.people.manage + access.cards.capture anywhere, on the read connection


def _capture_starter_ro(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    """`_capturer_ro` for the capture START, which may issue a capture lease: the permission revision and the authority epochs are
    taken on the gate's own connection BEFORE any decision (review 2026-10-16 H1), so a permission change anywhere between this
    gate and the ledger insert - including the body upload the caller controls - refuses the lease (`capture_lease_stale`)."""
    request.state.capture_lease_mark = capture_lease.gate_mark(conn)
    return _capturer_ro(request, principal, conn)


class CaptureStartBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    station_id: str = Field(min_length=1, max_length=MAX_STATION_ID)
    reader_id: StrictInt = Field(ge=0, le=8)  # WisKey enrollment.start: 0..8, 0 = the station's default reader
    revision: StrictInt = Field(ge=1)  # the person's revision the editor loaded (WisKey checks it: revision_conflict)
    confirmed: Any = None  # only `true` (from the dialog's confirmation step) confirms, as ReleaseBody


class CaptureCancelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CaptureConfirmBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    label: str = Field("", max_length=64)  # WisKey text_field(label, 64, empty=True)
    confirmed: Any = None


def _capture_or_refuse(act: _Action, session_id: str) -> Any:
    capture = CAPTURES.owned(session_id, act.principal.user_id)
    if capture is None:
        raise act.refuse(ApiError(404, "intercom_capture_not_found", "קריאת הכרטיס הזו אינה קיימת (או שאינה שלכם)."))
    act.details.update(session_id=capture.session_id, person_id=capture.person_id, station_id=capture.station_id, station_name=capture.station_name, reader_id=capture.reader_id)
    return capture


# ---------------------------------------------------------------- the capture-lease route (CR-WISKEY-LEASE-REVOCATION-EVENT L5)
#
# Reached only while `access.capture_lease` is `on` (default `off`; it cannot be switched on in this build - no bridge offers the
# lease service). Same permissions, same body, same attempt / outcome audit rows as the classic path; the WisKey traffic is the
# signed lease route instead of the WS capture lane, and every start carries an Arx-issued lease (services/capture_lease.py).

def _lease_refused(act: _Action, exc: ApiError) -> ApiError:
    exc.details.setdefault("outcome", "not_sent")
    return act.refuse(exc)


def _lease_redecide(conn: sqlite3.Connection, principal: Principal, station_id: str, target: Any) -> None:
    """The capture start's decision once more, on the request's WRITE connection (review H1): both permissions somewhere, then
    both on the reader's station and on every station of the person decided at the start (`target.stations`; None = the
    unrestricted shortcut, which must still hold), with the sensitive level. A fresh Authority: nothing cached from the read
    connection's decision is reused. Raises the refusal."""
    fresh = ia.Authority(conn, principal)
    if not (fresh.anywhere(MANAGE) and fresh.anywhere(CAPTURE)):
        raise iw.scope_refusal()
    iw.check_stations(fresh, target.stations, permissions=(MANAGE, CAPTURE), extra_stations=[station_id], sensitive=True)
    if target.stations is not None and not (fresh.station(CAPTURE, station_id) and fresh.station(MANAGE, station_id)):
        raise iw.scope_refusal()


def _lease_start(request: Request, act: _Action, conn: sqlite3.Connection, auth: ia.Authority, body: "CaptureStartBody", user_id: str, target: Any,
                 station: dict[str, Any] | None, token: str, lease_mark: capture_lease.GateMark | None) -> dict[str, Any]:
    principal = auth.principal
    settings = settings_of(request)
    db: Database = request.app.state.db
    try:
        capture_lease.ensure_issuable(conn)
    except ApiError as exc:
        raise _lease_refused(act, exc) from None
    lease_events.WORKER.attach(db, settings)
    with unlocked(conn):  # the stream must be known to the host before a lease of it is signed (a round trip: no write lock held)
        announced = lease_events.WORKER.ensure_announced()
    if not announced:
        raise _lease_refused(act, capture_lease.unavailable())
    if lease_mark is None:  # the gate could not take its mark: fail closed
        raise _lease_refused(act, capture_lease._stale())
    # Review H1 (a): the decision is taken AGAIN on this write connection, inside the transaction that inserts the ledger row
    # (CR F3) - the write lock is held from here to the commit, so no permission write can land between this decision and the
    # row. (b): the issue compares the revision / epochs with the gate's mark, taken before the first decision.
    try:
        _lease_redecide(conn, principal, body.station_id, target)
    except ApiError as exc:
        raise _lease_refused(act, exc) from None
    binding_revision = station.get("binding_revision") if isinstance(station, dict) and isinstance(station.get("binding_revision"), str) else None
    try:
        lease = capture_lease.issue(conn, principal=principal, station_id=body.station_id, reader_id=body.reader_id, person_id=user_id, person_revision=body.revision,
                                    binding_revision=binding_revision, decision_revision=lease_mark.revision, start_request_id=lease_events_request_id(),
                                    snap=lease_mark.snapshot(principal.user_id, body.station_id, user_id))
    except ApiError as exc:
        raise _lease_refused(act, exc) from None
    act.details.update(lease_ref=lease.lease_ref, lease_seconds=lease.seconds, transport="capture_lease")
    try:
        try:
            signed = lease_events.sign(conn, "capture_start", principal.user_id, trusted_door.actor_name(principal), body.station_id, {"lease": lease.lease_object()},
                                       request_id=lease.start_request_id)
        except lease_events.NotSendable as exc:
            capture_lease.discard(conn, lease.lease_ref, "start_refused")
            if exc.code == bridge_rotation.PAUSE_CODE:  # HMACACT2-295: a clear reason, nothing sent
                raise _lease_refused(act, capture_lease.unavailable(bridge_rotation.PAUSE_CODE, bridge_rotation.PAUSE_TEXT)) from None
            raise _lease_refused(act, capture_lease.unavailable("bridge_not_paired" if exc.code == "bridge_not_paired" else "capture_lease_unavailable")) from None
        act.details["body_sha256"] = signed.body_sha256  # computed after signing, recorded only in the audit
        act.attempt()  # commits the ledger row and the attempt row together: no record, no command
    except BaseException:
        capture_lease._forget(lease.lease_ref, "destroyed")  # review L3: no committed row -> no live cache entry either
        raise
    try:
        try:
            answer = lease_events.TRANSPORT.request(settings, "capture_start", signed.text)
        except ApiError as exc:
            not_sent = exc.code in _NOT_SENT_CODES or (exc.code == "ha_unavailable" and exc.details.get("error") in _NOT_SENT_ERRORS)
            if not_sent:
                capture_lease.finish(db, lease.lease_ref, "destroyed", "start_refused")
                act.outcome("not_sent", exc.code, {"error": exc.code})
                raise ApiError(503, exc.code, capture_lease.UNAVAILABLE_TEXT, details={"outcome": "not_sent"}) from None
            answer = None
        except Exception as exc:  # noqa: BLE001 - a timeout after a possible delivery
            log.warning("capture lease start: no clear answer (%s)", type(exc).__name__)
            answer = None
    finally:
        conn.execute("BEGIN")  # deferred, lock-free: nothing more is written on the request connection
    kind, data = capture_lease_route.classify_request(answer, signed.request_id, "capture_start") if answer is not None else ("unknown", {"code": "no_answer"})
    capture_lease_route._clock_check(kind, data)
    session = None
    if kind == "ok":
        try:
            session = intercom_sync.project_capture_session(data.get("session"))
        except (ValueError, TypeError):
            kind, data = "unknown", {"code": "invalid_session"}  # F9: acknowledged without a usable session id = unknown start
    if kind in ("refused", "rejected"):
        capture_lease.finish(db, lease.lease_ref, "destroyed", "start_refused")
        act.outcome("refused", data["code"], {"code": data["code"]})
        text = capture_lease.CLOCK_TEXT if data["code"] in lease_events.CLOCK_CODES else intercom_client_text(data["code"])
        raise ApiError(409, "intercom_refused", text, details={"outcome": "refused", "wiskey_code": data["code"]})
    if kind != "ok" or session is None:
        capture_lease.on_authority_change("start_unknown", lease_refs=[lease.lease_ref])  # a session Arx cannot see may drive the reader
        held = CAPTURES.hold_unknown(token)
        act.outcome("unknown", data.get("code"), {"code": data.get("code")})
        raise ApiError(504, "intercom_outcome_unknown", "לא ידוע אם הקורא הופעל. הקריאה בוטלה, והעמדה תהיה פנויה בעוד זמן קצר.",
                       details={"outcome": "unknown", "retry_after_s": round(held, 1)})
    if not capture_lease.activate(db, lease.lease_ref, session["session_id"]):
        # revoked between the send and the answer: the host's session is cancelled with the lease's own signed cancel
        capture_lease_route.cancel_known(db, settings, principal.user_id, body.station_id, lease.lease_ref, session["session_id"])
        CAPTURES.release(token)
        act.outcome("refused", "capture_lease_gone", {"code": "capture_lease_gone"})
        raise capture_lease_route.gone()
    capture = CAPTURES.register(token, session, principal, user_id, body.station_id, act.details.get("station_name"), body.reader_id, body.revision, settings, db,
                                lease_ref=lease.lease_ref)
    capture.person_stations = target.stations
    act.outcome("ok", None, {"result": {"session_id": session["session_id"], "state": session["state"]}})
    return {"state": "ready", "configured": True, "last_error": None, "capture": CAPTURES.view(capture), "note": CAPTURE_NOTE, "command_id": act.details["command_id"],
            **iw.effect_fields("cards/capture_start")}


def lease_events_request_id() -> str:
    return str(uuid.uuid4())


def intercom_client_text(code: str) -> str:
    """The operator text for a WisKey refusal code on the lease route (never the code itself, never input)."""
    return {
        "capture_station_busy": "בעמדה הזו כבר פתוחה קריאת כרטיס. הקורא לא הופעל שוב.",
        "capture_limit": "כבר פתוחות שלוש קריאות כרטיס במערכת. נסו שוב בעוד רגע.",
        "revision_conflict": "הרשומה השתנתה מאז שנטענה. טענו אותה מחדש ונסו שוב.",
        "lease_gone": capture_lease_route.GONE_TEXT,
    }.get(code, "הפקודה נדחתה ולא בוצעה.")


def _lease_confirm(request: Request, act: _Action, auth: ia.Authority, capture: Any, label: str, not_after: datetime) -> dict[str, Any]:
    """F8: refused locally while the lease is not usable; otherwise ONE signed capture_confirm, never retried."""
    db: Database = request.app.state.db
    settings = settings_of(request)
    act.details.update(lease_ref=capture.lease_ref, transport="capture_lease")
    if not capture_lease.usable(capture.lease_ref):
        CAPTURES.back_to_captured(capture)
        capture_lease_route.stop(CAPTURES, capture, audit=False)
        raise act.refuse(capture_lease_route.gone())
    if datetime.now(timezone.utc) >= not_after:
        CAPTURES.back_to_captured(capture)
        raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שנשלחה."))
    # R5-A5: the signed confirm writes a card to the person - the SAME per-person admission and unknown reconciliation as every other
    # people write (the classic confirm's `_perform(..., target=)`), around the unchanged signed operation: an earlier write to this
    # person still out or unsettled refuses it here, nothing signed; an unclear answer blocks the next write until a fresh readback.
    target = intercom_sync.person_target(capture.person_id)
    pending = intercom_sync.SYNC.write_gate(target)
    if pending is not None:
        CAPTURES.back_to_captured(capture)
        raise act.refuse(_gate_refusal(pending, capture))
    p = act.principal
    try:
        signed = lease_events.sign(act.conn, "capture_confirm", p.user_id, trusted_door.actor_name(p), capture.station_id,
                                   {"lease_ref": capture.lease_ref, "session_id": capture.session_id, "label": label})
    except lease_events.NotSendable:
        CAPTURES.back_to_captured(capture)
        raise act.refuse(capture_lease.unavailable()) from None
    act.details["body_sha256"] = signed.body_sha256
    act.attempt()
    blocked, op_id = intercom_sync.SYNC.begin_external(target, "capture_confirm")  # checked AND registered in one step (after the commit)
    if blocked is not None:
        CAPTURES.back_to_captured(capture)
        act.outcome("not_sent", blocked, {"error": blocked})
        act.conn.execute("BEGIN")
        raise _gate_refusal(blocked, capture)
    settled = {"outcome": "unknown", "code": None}
    try:
        return _lease_confirm_admitted(act, auth, capture, db, settings, signed, settled)
    finally:
        intercom_sync.SYNC.end_external(target, op_id, settled["outcome"], settled["code"])


def _gate_refusal(code: str, capture: Any) -> ApiError:
    exc = intercom_sync.action_error({"state": "error", "last_error": code}, "not_sent", "config")
    exc.details["capture"] = CAPTURES.view(capture)
    return exc


def _lease_confirm_admitted(act: _Action, auth: ia.Authority, capture: Any, db: Database, settings: Any, signed: Any, settled: dict[str, Any]) -> dict[str, Any]:
    """`_lease_confirm` after the per-person admission: ONE signed capture_confirm, never retried. `settled` receives what is known about
    the write (`ok` / `refused` / `not_sent`; it stays `unknown` otherwise) for the admission's own record (R5-A5)."""
    answer: Any = None
    try:
        try:
            answer = lease_events.TRANSPORT.request(settings, "capture_confirm", signed.text)
        except ApiError as exc:
            if exc.code in _NOT_SENT_CODES or (exc.code == "ha_unavailable" and exc.details.get("error") in _NOT_SENT_ERRORS):
                CAPTURES.back_to_captured(capture)
                act.outcome("not_sent", exc.code, {"error": exc.code})
                settled.update(outcome="not_sent", code=exc.code)
                raise ApiError(503, exc.code, capture_lease.UNAVAILABLE_TEXT, details={"outcome": "not_sent", "capture": CAPTURES.view(capture)}) from None
        except Exception as exc:  # noqa: BLE001 - after a possible delivery
            log.warning("capture lease confirm: no clear answer (%s)", type(exc).__name__)
    finally:
        act.conn.execute("BEGIN")
    kind, data = capture_lease_route.classify_request(answer, signed.request_id, "capture_confirm") if answer is not None else ("unknown", {"code": "no_answer"})
    capture_lease_route._clock_check(kind, data)
    if kind in ("refused", "rejected"):
        code = data["code"]
        if code in ("capture_not_ready", "invalid_text", "capture_operation_busy") or kind == "rejected":
            CAPTURES.back_to_captured(capture)
        else:
            CAPTURES.set_state(capture, "lost" if code in ("capture_not_found", "lease_gone") else "closed", code, only_from=("applying",))
            capture_lease.finish(db, capture.lease_ref, "destroyed", "lost" if code in ("capture_not_found", "lease_gone") else "error")
        settled.update(outcome="refused", code=code)
        act.outcome("refused", code, {"code": code})
        raise ApiError(409, "intercom_refused", intercom_client_text(code), details={"outcome": "refused", "wiskey_code": code, "capture": CAPTURES.view(capture)})
    person = None
    if kind == "ok":
        try:
            person = iw.project_editor(data.get("person"))
        except (ValueError, TypeError, KeyError):
            person = None
    if kind != "ok" or person is None:
        CAPTURES.set_state(capture, "unconfirmed", data.get("code"), only_from=("applying",))
        capture_lease.finish(db, capture.lease_ref, "destroyed", "confirm_unknown")
        act.outcome("unknown", data.get("code"), {"code": data.get("code")})
        raise ApiError(504, "intercom_outcome_unknown", capture_lease_route.CONFIRM_UNKNOWN_TEXT, details={"outcome": "unknown", "capture": CAPTURES.view(capture)})
    CAPTURES.set_state(capture, "confirmed", only_from=("applying",))
    capture_lease.finish(db, capture.lease_ref, "destroyed", "confirmed")
    settled.update(outcome="ok", code=None)
    act.outcome("ok", None, {"result": _person_summary(person)})
    return {"state": "ready", "configured": True, "last_error": None, "person": iw.view_editor_person(auth, person), "capture": CAPTURES.view(capture),
            "note": "WisKey הוסיף את הכרטיס לאדם וביקש לסנכרן את התחנות שלו. מצב הסנכרון של כל תחנה מוצג ברשומה.", "command_id": act.details["command_id"],
            **iw.effect_fields("cards/capture_confirm")}


def _lease_cancel(request: Request, act: _Action, capture: Any) -> dict[str, Any]:
    """ONE signed capture_cancel. Acknowledged -> destroyed(cancelled); no clear answer -> the lease is revoked (cancel_unknown)."""
    db: Database = request.app.state.db
    settings = settings_of(request)
    act.details.update(lease_ref=capture.lease_ref, transport="capture_lease")
    p = act.principal
    try:
        signed = lease_events.sign(act.conn, "capture_cancel", p.user_id, trusted_door.actor_name(p), capture.station_id,
                                   {"lease_ref": capture.lease_ref, "session_id": capture.session_id})
    except lease_events.NotSendable:
        capture_lease.on_authority_change("cancel_unknown", lease_refs=[capture.lease_ref])  # nothing could be sent: the lease is revoked instead
        CAPTURES.set_state(capture, "cancel_unknown", only_from=POLLED)
        raise act.refuse(capture_lease.unavailable()) from None
    act.details["body_sha256"] = signed.body_sha256
    act.attempt()
    answer: Any = None
    try:
        try:
            answer = lease_events.TRANSPORT.request(settings, "capture_cancel", signed.text)
        except Exception as exc:  # noqa: BLE001
            log.warning("capture lease cancel: no clear answer (%s)", type(exc).__name__)
    finally:
        act.conn.execute("BEGIN")
    kind, data = capture_lease_route.classify_request(answer, signed.request_id, "capture_cancel") if answer is not None else ("unknown", {"code": "no_answer"})
    capture_lease_route._clock_check(kind, data)
    if kind == "ok" and data.get("cancelled") is True:
        CAPTURES.set_state(capture, "cancelled", only_from=POLLED)
        capture_lease.finish(db, capture.lease_ref, "destroyed", "cancelled")
        act.outcome("ok", None, {"result": {"cancelled": True}})
        return {"state": "ready", "configured": True, "last_error": None, "cancelled": True, "capture": CAPTURES.view(capture), "command_id": act.details["command_id"],
                "note": "WisKey הפסיק להמתין לכרטיס ושום כרטיס לא נוסף. זמן ההמתנה של הקורא עצמו נקבע בקושחה שלו.", **iw.effect_fields("cards/capture_cancel")}
    if kind == "refused" and data["code"] in ("capture_not_found", "lease_gone"):
        CAPTURES.set_state(capture, "lost", only_from=POLLED)
        capture_lease.finish(db, capture.lease_ref, "destroyed", "lost")
        act.outcome("refused", data["code"], {"code": data["code"]})
        raise ApiError(409, "intercom_capture_not_found", "קריאת הכרטיס כבר אינה קיימת ב־WisKey.", details={"outcome": "refused", "capture": CAPTURES.view(capture)})
    capture_lease.on_authority_change("cancel_unknown", lease_refs=[capture.lease_ref])
    CAPTURES.set_state(capture, "cancel_unknown", only_from=POLLED)
    act.outcome("unknown", data.get("code"), {"code": data.get("code")})
    raise ApiError(504, "intercom_outcome_unknown", "לא ידוע אם הביטול התקבל. הקריאה בוטלה בצד Arx.", details={"outcome": "unknown", "capture": CAPTURES.view(capture)})


@router.get("/intercom/stations/{station_id}/card-readers")
def card_readers(request: Request, station_id: str, auth: ia.Authority = Depends(_capturer_ro)) -> dict[str, Any]:
    """The station's card readers (WisKey `cards/reader_capabilities`, a read that reaches the device - WisKey allows it
    35 s): `readers` (0 = the station's default reader) and the card-number length bounds. A station that advertises
    no card collection is `state: error`, `last_error: capture_unsupported`; offline / no managed lock likewise by
    WisKey's code. Reply: `{state, configured, last_error, fetched_at, readers, sync}`.

    CR-036 S11: both permissions on THIS station's chain - a station off it answers exactly like an unknown one (404
    `intercom_station_not_found`), and nothing is asked of the device."""
    if not 1 <= len(station_id) <= MAX_STATION_ID:
        raise ApiError(422, "validation", "מזהה העמדה אינו תקין.", details={"fields": ["station_id"]})
    if not (auth.station(CAPTURE, station_id) and auth.station(MANAGE, station_id)):
        raise ApiError(404, intercom_adapter.STATION_NOT_FOUND[0], intercom_adapter.STATION_NOT_FOUND[1])
    return intercom_sync.SYNC.command(settings_of(request), "readers", lambda call: intercom_client.reader_capabilities(call, station_id), intercom_sync.project_readers,
                                      who=auth.principal.user_id, timeout=intercom_sync.READERS_TIMEOUT_S)


@router.post("/intercom/people/{user_id}/card-capture")
def card_capture_start(request: Request, user_id: str, auth: ia.Authority = Depends(_capture_starter_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Start reading a card at a station (WisKey `cards/capture_start`, PHYSICAL: the station's reader enters card-
    collection mode). Body: `{station_id, reader_id, revision, confirmed, client_request_id, expires_at}`; `confirmed:
    true` comes only from the dialog's confirmation step. Refused before sending (each audited, `not_sent`): a malformed
    body, an expired or duplicate command, an unknown station, a station without a managed lock or offline, a missing
    confirmation, a capture of the caller's own still open (`intercom_capture_user_busy`) or one at that station
    (`intercom_capture_station_busy`, also for the rest of WisKey's 120 s after a start with an unknown outcome there).
    WisKey's refusals by name (`intercom_capture_station_busy`, `intercom_capture_limit`, `intercom_revision_conflict`
    ...); an unclear answer is a 504 `intercom_outcome_unknown` - the reader may be collecting. Reply: `{state, ...,
    capture: <the session as GET /intercom/card-capture/{id} serves it>, sync, note, command_id, effect, pending}`.

    CR-036 S11: `access.cards.capture` and `access.people.manage` on the reader's station and on every station of the person,
    with the sensitive level (a card is a credential); not unrestricted = checked against a fresh read whose revision the start
    must carry. UNKNOWN_EFFECT: `pending: true` (the session state the dialog polls is what tells)."""
    principal = auth.principal
    # capture-lease route (CR-WISKEY-LEASE-REVOCATION-EVENT L5): the permission revision and the authority epochs were taken at
    # the permission gate, BEFORE the decision (`_capture_starter_ro`, review H1) - a permission change or a trigger between
    # there and the ledger insert makes the issue refuse (capture_lease.issue). Harmless when off.
    lease_mark = getattr(request.state, "capture_lease_mark", None)
    act = _Action(request, conn, principal, "intercom.card_capture.start", user_id, PERSON)
    body: CaptureStartBody = _parse(act, CaptureStartBody, raw)
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, station_id=body.station_id, reader_id=body.reader_id, revision=body.revision,
                       **iw.effect_fields("cards/capture_start"))
    settings = settings_of(request)
    target = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, permissions=(MANAGE, CAPTURE), extra_stations=[body.station_id], sensitive=True, revision=body.revision))
    if target.person is None and not (auth.station(CAPTURE, body.station_id) and auth.station(MANAGE, body.station_id)):
        raise act.refuse(iw.scope_refusal())  # (unrestricted callers hold both everywhere; kept explicit, fail closed)
    not_after = _envelope(act, body)
    station = intercom_sync.SYNC.station(body.station_id)
    if station is None and intercom_sync.SYNC.has_copy():
        raise act.refuse(ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey."))
    if station is not None:
        act.details["station_name"] = station["name"]
        if not station["lock_enabled"] or not station["locks"]:
            raise act.refuse(ApiError(409, "intercom_no_lock", f"לעמדה {station['name']} אין מנעול מנוהל ב־WisKey, ולכן אי אפשר לקרוא בה כרטיס."))
        if not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הקורא לא הופעל."))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "הפעלת קורא הכרטיסים בעמדה דורשת אישור מפורש."))
    try:
        token = CAPTURES.reserve(principal.user_id, body.station_id)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if capture_lease.mode(conn) == "on":  # the lease route (fails closed with 503 unless it can really serve: route_on, not degraded, clock)
        try:
            return _lease_start(request, act, conn, auth, body, user_id, target, station, token, lease_mark)
        except BaseException:
            CAPTURES.release(token)  # a no-op after hold_unknown / register
            raise
    held = {"s": 0.0}

    def unknown() -> None:
        held["s"] = CAPTURES.hold_unknown(token)

    station_id, reader_id, revision = body.station_id, body.reader_id, body.revision
    try:
        reply = _perform(act, "capture", lambda call: intercom_client.capture_start(call, station_id, user_id, revision, reader_id), intercom_sync.project_capture_session, not_after,
                         on_unknown=unknown, lane="capture", summary=lambda s: {"session_id": s["session_id"], "state": s["state"]}, slot_wait=intercom_sync.CAPTURE_SLOT_WAIT_S)
    except ApiError as exc:
        if exc.details.get("outcome") == "unknown":
            exc.details["retry_after_s"] = round(held["s"], 1)
        CAPTURES.release(token)  # a no-op after hold_unknown
        raise
    except BaseException:
        CAPTURES.release(token)
        raise
    capture = CAPTURES.register(token, reply["capture"], principal, user_id, station_id, act.details.get("station_name"), reader_id, revision, settings_of(request), request.app.state.db)
    capture.person_stations = target.stations  # S11: checked again at the confirm (None = decided by the unrestricted shortcut)
    reply["capture"] = CAPTURES.view(capture)
    reply["note"] = CAPTURE_NOTE
    reply.update(iw.effect_fields("cards/capture_start"))
    return reply


@router.get("/intercom/card-capture/{session_id}")
def card_capture_status(session_id: str, auth: ia.Authority = Depends(_capturer_ro)) -> dict[str, Any]:
    """The caller's own capture session as SMPLWISE's poller last read it from WisKey (no WisKey traffic per request):
    `state` preparing | waiting | captured | applying (active) or error | cancelled | cancel_unknown | expired | lost |
    confirmed | unconfirmed | closed; `error` (WisKey's code, e.g. `capture_timeout`); `card` (`{masked_number,
    technology, reader_id}` while captured - the masked form only); the countdowns (`collect_remaining_s` of WisKey's
    70 s collection, `session_remaining_s` of its 120 s session); `reader_may_be_collecting`. Reading it keeps the session
    alive: one nobody asked about for 20 s is cancelled by the backend. Another user's session is a 404."""
    capture = CAPTURES.owned(session_id, auth.principal.user_id)
    if capture is None:
        raise ApiError(404, "intercom_capture_not_found", "קריאת הכרטיס הזו אינה קיימת (או שאינה שלכם).")
    return {"capture": CAPTURES.view(capture)}


@router.post("/intercom/card-capture/{session_id}/cancel")
def card_capture_cancel(request: Request, session_id: str, auth: ia.Authority = Depends(_capturer_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Cancel the caller's own capture (WisKey `cards/capture_cancel`): WisKey stops waiting for a card and drops the
    session. Body `{}` (JSON). WisKey's reader timeout is the firmware's own: cancelling is not proof the reader left
    collection mode (WisKey `capture_limits`). A cancel with no clear answer is 504 unknown (the session is then
    `cancel_unknown`). A cancel spends no rate token: polling or other captures can never get it refused locally.
    Reply: `{state, ..., cancelled, capture, sync, note, command_id, effect, pending}`.

    CR-036 S11: the owner of the session may always cancel it (it only ever ends a reader's collection); UNKNOWN_EFFECT
    (`pending: true`). The screens send it ONCE - no automatic retry."""
    act = _Action(request, conn, auth.principal, "intercom.card_capture.cancel", session_id, "intercom_capture")
    act.details.update(iw.effect_fields("cards/capture_cancel"))
    _parse(act, CaptureCancelBody, raw)
    capture = _capture_or_refuse(act, session_id)
    if capture.state == "applying":
        raise act.refuse(ApiError(409, "intercom_capture_applying", "הכרטיס נמצא בשמירה. יש להמתין לתוצאה לפני פעולה נוספת."))
    if capture.state not in POLLED:
        raise act.refuse(ApiError(409, "intercom_capture_over", "קריאת הכרטיס הזו כבר הסתיימה; אין מה לבטל.", details={"capture": CAPTURES.view(capture)}))
    if capture.lease_ref is not None:  # the capture-lease route (L5): the lease's own signed cancel
        return _lease_cancel(request, act, capture)
    not_after = datetime.now(timezone.utc) + timedelta(seconds=SEND_WITHIN_S)

    def record(reply: dict[str, Any], outcome: str) -> None:
        # recorded while the capture lane's slot is still this cancel's: no poller status read can reach WisKey between
        # its answer and this record (and find the session it just dropped: `lost`) - T054
        if outcome == "ok":
            CAPTURES.set_state(capture, "cancelled", only_from=POLLED)
        elif outcome == "unknown":
            CAPTURES.set_state(capture, "cancel_unknown", only_from=POLLED)
        elif outcome == "refused" and reply.get("last_error") == "capture_not_found":
            CAPTURES.set_state(capture, "lost", only_from=POLLED)

    try:
        reply = _perform(act, "cancelled", lambda call: intercom_client.capture_cancel(call, capture.session_id), intercom_sync.project_cancelled, not_after,
                         lane="capture", slot_wait=intercom_sync.CAPTURE_SLOT_WAIT_S, free=True, on_result=record)  # never refused by SMPLWISE's own rate budget
    except ApiError as exc:
        exc.details["capture"] = CAPTURES.view(capture)
        raise
    reply["capture"] = CAPTURES.view(capture)
    reply["note"] = "WisKey הפסיק להמתין לכרטיס ושום כרטיס לא נוסף. זמן ההמתנה של הקורא עצמו נקבע בקושחה שלו."
    reply.update(iw.effect_fields("cards/capture_cancel"))
    return reply


@router.post("/intercom/card-capture/{session_id}/confirm")
def card_capture_confirm(request: Request, session_id: str, auth: ia.Authority = Depends(_capturer_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add the collected card to the person (WisKey `cards/capture_confirm`, a people write: the card, enabled, goes to
    the person's existing station assignments with WisKey's immediate sync - it opens their doors). Body: `{label,
    confirmed, client_request_id, expires_at}`; `confirmed: true` comes only from the confirmation step naming the
    person. Only from `captured`. WisKey's refusals by name (`intercom_revision_conflict`, `intercom_card_conflict`,
    `intercom_capture_not_found` ...); an unclear answer is a 504 `intercom_outcome_unknown` (reload the person and look
    for the new card before anything else). The audit rows name the session, the person and the station - never the number,
    not even masked. Reply: `{state, ..., person (the editor projection), capture, sync, note, command_id, effect, pending}`.

    CR-036 S11: the stations decided when the capture started are checked again (a scope taken away meanwhile refuses the
    confirm, 403, nothing sent; WisKey's own revision check binds the person). UNKNOWN_EFFECT (DW matrix 2026-10-12: WisKey
    adds the card and asks the stations): `pending: true` until a read of the person shows the card on their stations."""
    act = _Action(request, conn, auth.principal, "intercom.card_capture.confirm", session_id, "intercom_capture")
    act.details.update(iw.effect_fields("cards/capture_confirm"))
    body: CaptureConfirmBody = _parse(act, CaptureConfirmBody, raw)
    capture = _capture_or_refuse(act, session_id)
    not_after = _envelope(act, body)
    if not _no_control(body.label):
        raise act.refuse(ApiError(422, "validation", "תווית הכרטיס אינה תקינה (ללא תווי בקרה).", details={"fields": ["label"]}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "הוספת הכרטיס לאדם דורשת אישור מפורש."))
    try:
        iw.check_stations(auth, capture.person_stations, permissions=(MANAGE, CAPTURE), extra_stations=[capture.station_id], sensitive=True)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if capture.lease_ref is not None and not capture_lease.usable(capture.lease_ref):  # F8: refused locally, nothing signed
        capture_lease_route.stop(CAPTURES, capture, audit=False)
        raise act.refuse(capture_lease_route.gone())
    if not CAPTURES.begin_applying(capture):
        raise act.refuse(ApiError(409, "intercom_capture_not_ready", "אין כרטיס שנקרא וממתין לאישור.", details={"capture": CAPTURES.view(capture)}))
    if capture.lease_ref is not None:  # the capture-lease route (L5): ONE signed capture_confirm
        return _lease_confirm(request, act, auth, capture, body.label, not_after)
    label = body.label
    try:
        # R4-07: the confirm writes a card to the person - the same per-person gate as every other people write
        reply = _perform(act, "person", lambda call: intercom_client.capture_confirm(call, capture.session_id, label), iw.project_editor, not_after,
                         lane="config", summary=_person_summary, target=intercom_sync.person_target(capture.person_id))
    except ApiError as exc:
        outcome, code = exc.details.get("outcome"), str(exc.details.get("wiskey_code") or "")
        if outcome == "not_sent" or (outcome == "refused" and (code in intercom_client.PRE_DISPATCH or code in ("capture_not_ready", "invalid_text"))):
            CAPTURES.back_to_captured(capture)  # WisKey's session is untouched: the card still waits for approval
        elif outcome == "refused":
            CAPTURES.set_state(capture, "lost" if code == "capture_not_found" else "closed", code, only_from=("applying",))
        else:
            CAPTURES.set_state(capture, "unconfirmed", code or None, only_from=("applying",))
        exc.details["capture"] = CAPTURES.view(capture)
        raise
    except BaseException:
        CAPTURES.set_state(capture, "unconfirmed", None, only_from=("applying",))
        raise
    CAPTURES.set_state(capture, "confirmed", only_from=("applying",))
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply["capture"] = CAPTURES.view(capture)
    reply["note"] = "WisKey הוסיף את הכרטיס לאדם וביקש לסנכרן את התחנות שלו. מצב הסנכרון של כל תחנה מוצג ברשומה."
    reply.update(iw.effect_fields("cards/capture_confirm"))
    return reply


@router.websocket("/intercom/ws")
async def intercom_ws(websocket: WebSocket) -> None:
    """Change notices for the entry center (data-free, like WisKey's own `subscribe`): `intercom_refresh` when the
    stations changed, `intercom_state` when the feed's state changed, a heartbeat every 30 s. The client refetches
    GET /intercom/overview; the permission is re-checked every minute and the socket closes (4403) once it is gone."""
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _allowed() -> bool:
        with db.connection() as conn:
            return authorize(conn, principal, READ, INSTALLATION).allowed

    if not await run_in_threadpool(_allowed):
        await websocket.close(code=4403)
        return
    q = intercom_sync.subscribe()  # before accept: nothing published after the handshake can be missed
    seq = 0
    last_check = time.time()

    def envelope(kind: str, payload: dict[str, Any]) -> str:
        return json.dumps({"version": 1, "type": kind, "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": payload}, ensure_ascii=False, default=str)

    try:
        await websocket.accept()
        while True:
            try:
                msg = await asyncio.wait_for(asyncio.get_event_loop().run_in_executor(None, q.get, True, 30), timeout=31)
            except (asyncio.TimeoutError, queue.Empty):
                msg = None
            if time.time() - last_check > RECHECK_S:
                if not await run_in_threadpool(_allowed):
                    await websocket.close(code=4403)
                    return
                last_check = time.time()
            seq += 1
            if msg is None:
                await websocket.send_text(envelope("heartbeat", {"sync": intercom_sync.STATE.as_dict()}))
            else:
                await websocket.send_text(envelope(str(msg.get("type")), msg))
    except Exception:
        pass
    finally:
        intercom_sync.unsubscribe(q)
