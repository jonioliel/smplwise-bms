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
is never served under `access.read`. Door technical settings, schedules, photos and card capture do not live here."""
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
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, now_iso, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import go2rtc as g2
from ..services import intercom_client, intercom_sync, wiskey_camera
from ..services.timeutil import parse_utc
from .media import _principal_for_ws
from .settings import read_settings

router = APIRouter()
log = logging.getLogger("smplwise.intercom")

READ = "access.read"
CREDENTIALS = "system.configure"  # device secrets: the system administrator only
RELEASE = "access.release"  # every PHYSICAL WisKey command; role grants: see the note at routers/access.py PERMISSION_LABELS
MANAGE = "access.people.manage"  # the person editor (CR-005 phase 2); same default grants and sensitivity as access.release
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


def _credentials_admin(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    require(conn, principal, CREDENTIALS, INSTALLATION)
    return principal


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
    """The entry center: stations with online / ringing / sync state and the last access record, plus the feed's own
    state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`, `ready`).
    `overview` is null whenever there is nothing honest to show; `fresh` is false for a copy from before a disconnect.
    `camera_access` says, per station with a camera, whether its still can be had (`ready`) or why not (`no_media`,
    `no_host`, `no_credentials`) - see wiskey_camera.camera_access."""
    require(conn, principal, READ, INSTALLATION)
    settings = settings_of(request)
    body = intercom_sync.SYNC.snapshot(settings)
    body["camera_access"] = wiskey_camera.camera_access(conn, settings, body["overview"])
    return body


@router.get("/intercom/events")
def events(
    request: Request,
    principal: Principal = Depends(_reader),
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
    `intercom_refresh` notice, like WisKey's own panel."""
    start, end = _instant("start", start), _instant("end", end)
    if start and end and datetime.fromisoformat(start.replace("Z", "+00:00")) >= datetime.fromisoformat(end.replace("Z", "+00:00")):
        raise ApiError(422, "validation", "start חייב להיות לפני end.")
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "door": door, "start": start, "end": end, "limit": limit, "before": before, "current_group": current_group}
    try:
        return intercom_sync.SYNC.command(settings_of(request), "events", lambda call: intercom_client.events_list(call, filters), intercom_sync.project_event_page, who=principal.user_id)
    except ApiError as exc:
        if exc.code == "intercom_invalid_request" and before is not None:
            # every other field was validated above, so a refused paged request is WisKey's pruned cursor
            raise ApiError(422, "intercom_cursor_expired", "רשימת האירועים התעדכנה והסמן של 'טען עוד' פג - טענו מחדש מההתחלה.", details=exc.details) from exc
        raise


@router.get("/intercom/people")
def people(
    request: Request,
    principal: Principal = Depends(_reader),
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
    fetched_at, people, sync}`."""
    filters: dict[str, Any] = {k: v for k, v in {"station": station, "group": group, "rights": rights, "state": state}.items() if v is not None}
    filters["sort"] = sort
    return intercom_sync.SYNC.people(settings_of(request), principal.user_id, query, filters, offset, limit, snapshot)


@router.get("/intercom/people/{user_id}")
def person(request: Request, principal: Principal = Depends(_reader), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person (WisKey `users/get`), same projection as a directory row; an unknown id is a 404
    `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`."""
    return intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id), intercom_sync.project_person, who=principal.user_id)


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
            raise ApiError(503, "ha_not_configured", "אין גישה ל־Home Assistant, ולכן אין נתוני WisKey ואין תמונת מצלמה.")
        raise ApiError(503, "intercom_unavailable", "נתוני WisKey אינם זמינים כרגע, ולכן אין תמונת מצלמה.", retryable=True, details={"state": state})
    station = next((s for s in overview.get("stations", []) if s["id"] == station_id), None)
    if station is None:
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    if not station.get("camera_entity"):
        raise ApiError(404, "intercom_no_camera", f"לעמדה {station['name']} אין מצלמה ב־WisKey.")
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
    principal: Principal = Depends(_credentials_admin),
    conn: sqlite3.Connection = Depends(get_conn),
    station_id: str = Path(min_length=1, max_length=MAX_STATION_ID),
    raw: bytes = Depends(_credentials_body),
) -> dict[str, Any]:
    body = _parse_credentials(conn, principal, request, station_id, raw)
    replaced = wiskey_camera.set_override(conn, station_id, body.username, body.password, principal.user_id)
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


class ReleaseBody(CommandEnvelope):
    # the relay (`integrated_locks[].physical_index`); may be left out when the station has exactly one
    lock: StrictInt | None = Field(None, ge=1, le=64)
    # the UI's confirmation step, stated explicitly (the same rule as a sensitive HA action's `confirmation_grant`).
    # Any JSON value is accepted here and only `true` confirms, so a wrong value is an audited refusal, not a bare 422.
    confirmed: Any = None


class CallBody(CommandEnvelope):
    command: Literal["answer", "reject", "hangUp"]


class TtsBody(CommandEnvelope):
    engine_id: str = Field(min_length=1, max_length=128)
    language: str | None = Field(None, min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=4 * intercom_client.TTS_MESSAGE_MAX)  # checked again once collapsed


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


def _releaser(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.release` at installation scope, as a dependency (checked before the body is looked at; a refusal is
    audited by `require`). `access.read` alone is not enough: seeing the stations never implies acting on them."""
    require(conn, principal, RELEASE, INSTALLATION)
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
        self.conn.execute("COMMIT")

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
) -> dict[str, Any]:
    """Audit the attempt (committed), send once through IntercomSync.action, audit the outcome. `on_settled` is always
    called exactly once (by IntercomSync once the command was handed over, here when it never got that far);
    `on_unknown` when the outcome is unknown. `summary` turns the projected result into what the outcome row records
    (the physical actions record the result itself; a people write records counts and names only)."""
    try:
        act.attempt()
    except BaseException:
        if on_settled:
            on_settled()
        raise
    try:
        reply = intercom_sync.SYNC.action(settings_of(act.request), key, send, project, who=act.principal.user_id, not_after=not_after, on_settled=on_settled, lane=lane)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        if outcome == "unknown" and on_unknown:
            on_unknown()
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
    return reply


@router.post("/intercom/stations/{station_id}/release")
def release(request: Request, station_id: str, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Release a station's door relay once (WisKey `stations/test_unlock`). Body: `{lock?, confirmed, client_request_id,
    expires_at}`; `confirmed: true` is sent only by the UI's confirmation dialog. The reply's `release.accepted` means
    WisKey ACCEPTED the command; it does not mean the door moved (the device's own relay time applies, and WisKey
    reports no physical confirmation). Refused before sending, each refusal audited: a malformed body, an expired or
    duplicate command, an unknown station (404), a station without an integrated lock, offline, a relay it does not
    have, a missing confirmation, or a release of the same relay not yet resolved (409 `intercom_release_in_progress`:
    until WisKey's answer arrives, and UNKNOWN_HOLD_S longer when the outcome was unknown). Anything that then does
    not complete is an error whose `details.outcome` says whether the command was not sent, refused, or has an unknown
    outcome (IntercomSync.action). Reply: `{state, configured, last_error, fetched_at, release, sync, note, command_id}`."""
    act = _Action(request, conn, principal, "intercom.release", station_id)
    body: ReleaseBody = _parse(act, ReleaseBody, raw)
    not_after = _envelope(act, body)
    station = _station(act, require_online=False)
    lock = body.lock
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
    act.details["lock"] = lock
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שחרור דלת דורש אישור מפורש."))
    entry = RELAYS.acquire((station_id, lock))
    if entry is None:
        wait = RELAYS.remaining((station_id, lock))
        raise act.refuse(ApiError(409, "intercom_release_in_progress", f"שחרור קודם של הדלת הזו עדיין לא הוכרע (ממתין לתשובה, או שתוצאתו לא ידועה). המתינו עד {int(wait) + 1} שניות ובדקו במצלמה לפני שמנסים שוב.", details={"retry_after_s": round(wait, 1)}))
    try:
        reply = _perform(act, "release", lambda call: intercom_client.release_door(call, station_id, lock), intercom_sync.project_release, not_after,
                         on_settled=lambda: RELAYS.settle(entry), on_unknown=lambda: RELAYS.mark_unknown(entry))
    except ApiError as exc:
        if exc.details.get("outcome") == "unknown":
            exc.details["retry_after_s"] = round(RELAYS.remaining((station_id, lock)), 1)  # the UI holds the button this long
        raise
    reply["note"] = "WisKey קיבל את הפקודה. זה אינו אישור שהדלת נפתחה בפועל."
    return reply


@router.post("/intercom/stations/{station_id}/call")
def call_signal(request: Request, station_id: str, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Answer / reject a ringing call or hang up a call in progress (WisKey `media/signal`). Body: `{command,
    client_request_id, expires_at}`. WisKey checks the call state on the device itself and refuses a mismatch
    (`device_unavailable`), so SMPLWISE does not second-guess it from its own copy, which can lag a ring by a moment.
    The reply's `call` is WisKey's result as sent: `acknowledged` (true, or null when the device's answer was lost),
    `observed_state` / `observation` after the signal, and `physical_result: "unverified"`. Refusals and outcomes are
    audited like a release. Reply: `{state, configured, last_error, fetched_at, call, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.call", station_id)
    body: CallBody = _parse(act, CallBody, raw)
    act.details["signal"] = body.command
    not_after = _envelope(act, body)
    _station(act)
    return _perform(act, "call", lambda call: intercom_client.media_signal(call, station_id, body.command), intercom_sync.project_signal, not_after)


@router.get("/intercom/tts/engines")
def tts_engines(request: Request, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Home Assistant's TTS engines WisKey can speak through (`tts/engines`, a read): `{state, configured, last_error,
    fetched_at, tts, sync}` with `tts = {default, engines: [{engine_id, name, supported_languages, default_language}]}`,
    null unless `state` is `ready`. Gated like the announcement itself (WisKey gates it at manage level too)."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "tts", intercom_client.tts_engines, intercom_sync.project_tts_engines, who=principal.user_id)


@router.post("/intercom/stations/{station_id}/tts")
def tts_speak(request: Request, station_id: str, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Speak `message` through the station's speaker (WisKey `tts/start`). Body: `{engine_id, language, message,
    client_request_id, expires_at}`. The text goes to the Home Assistant TTS engine `engine_id` - which may be a cloud
    provider, so the text can leave the premises - and is recorded, as spoken, in SMPLWISE's audit log (refused
    requests too). The reply's `tts` is the announcement's progress when WisKey took it (`started`, or already
    `generating` / ...); later progress arrives as `intercom_tts` notices on /intercom/ws, ending in `completed`
    (`physical_result: "unverified"`) or `closed` with a reason. Reply: `{state, configured, last_error, fetched_at,
    tts, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.tts", station_id)
    body: TtsBody = _parse(act, TtsBody, raw)
    message = intercom_client.collapse(body.message)
    act.details.update(engine_id=body.engine_id, language=body.language, message=message)
    if not 1 <= len(message) <= intercom_client.TTS_MESSAGE_MAX:
        raise act.refuse(ApiError(422, "validation", f"ההודעה חייבת להכיל 1-{intercom_client.TTS_MESSAGE_MAX} תווים."))
    not_after = _envelope(act, body)
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

    @model_validator(mode="after")
    def _rules(self) -> "PersonData":
        if self.display_name is not None and (not self.display_name.strip() or not _no_control(self.display_name)):
            raise ValueError("display_name")
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
        for key in ("employee_no", "display_name", "phone", "active", "valid_from", "valid_until", "pin"):
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


def _manager(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.people.manage` at installation scope, as a dependency (before the body; a refusal is audited by
    `require`). `access.read` alone never reaches the editor projection, let alone a write."""
    require(conn, principal, MANAGE, INSTALLATION)
    return principal


def _draft_summary(data: dict[str, Any]) -> dict[str, Any]:
    """What the audit records about a draft: the field names and counts, never a value that is a secret or personal
    (no PIN, no card number, no phone)."""
    cards = data.get("cards")
    out: dict[str, Any] = {"fields": sorted(data)}
    if "pin" in data:
        out["pin_change"] = "removed" if data["pin"] is None else "set"
    if isinstance(cards, list):
        out.update(card_count=len(cards), enabled_cards=sum(1 for c in cards if c.get("enabled")), new_cards=sum(1 for c in cards if "card_no" in c))
    if isinstance(data.get("door_permissions"), dict):
        out["door_permissions"] = dict(data["door_permissions"])
        out["permission_overrides"] = dict(data.get("permission_overrides") or {})
    if "access_policy_revision" in data:
        out["access_policy_revision"] = data["access_policy_revision"]
    return out


def _person_summary(person: dict[str, Any]) -> dict[str, Any]:
    """The outcome row's record of the saved person: identity, revision, the PIN flag and counts (WisKey's own audit
    summary keeps the same: `{pin_configured, card_count, enabled_cards, assignments}`)."""
    return {
        "id": person["id"], "employee_no": person["employee_no"], "display_name": person["display_name"], "revision": person["revision"],
        "active": person["active"], "pin_configured": person["pin_configured"],
        "card_count": len(person["cards"]), "enabled_cards": sum(1 for c in person["cards"] if c["enabled"]),
        "assignments": {s["station_id"]: {"enabled": s["enabled"], "allowed_locks": s["doors"]} for s in person["stations"]},
    }


def _parse_read(request: Request, model: type[BaseModel], raw: bytes) -> Any:
    """A read endpoint's JSON body (pin-generate): content type, JSON, then the fields - no audit row (nothing is
    written anywhere), the same 415 / 422 as `_parse`."""
    if not _is_json(request.headers.get("content-type")):
        raise ApiError(415, "unsupported_media_type", "הבקשה חייבת להישלח כ־JSON (Content-Type: application/json).")
    try:
        data = json.loads(raw) if raw.strip() else {}
    except (ValueError, RecursionError):
        raise ApiError(422, "validation", "גוף הבקשה אינו JSON תקין.", details={"fields": ["body"]}) from None
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        fields = sorted({".".join(str(p) for p in err["loc"]) or "body" for err in exc.errors()})
        raise ApiError(422, "validation", "הבקשה אינה תקינה: " + ", ".join(fields), details={"fields": fields}) from None


@router.get("/intercom/people-editor/context")
def people_editor_context(request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """What the editor needs from WisKey's `overview` beyond the entry center (intercom_sync.project_editor_context):
    the stations with their relays and whether each can take a keypad PIN, the HA display zone, WisKey's
    `api.capabilities`, whether the people-write commands are listed for the add-on's HA user (`writes_listed` /
    `users_manage`, null when WisKey does not say - the user needs WisKey's `users:manage` area), and whether a
    profile policy exists. A fresh read each time (never cached). Reply: `{state, configured, last_error, fetched_at,
    context, sync}`."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "context", intercom_client.overview, intercom_sync.project_editor_context, who=principal.user_id)


@router.get("/intercom/people/{user_id}/editor")
def person_editor(request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person for editing (WisKey `users/get`, intercom_sync.project_person_editor): the read projection plus
    phone, the PIN flag, the cards in WisKey's masked form (`•••• 1234` - the full number never leaves WisKey), the
    overrides, `identity_locked`, `has_timing` and each assignment's sync bookkeeping. 404 `intercom_person_not_found`.
    Reply: `{state, configured, last_error, fetched_at, person, sync}`."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id), intercom_sync.project_person_editor, who=principal.user_id)


@router.post("/intercom/people/pin-generate")
def person_pin_generate(request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """A free six-digit PIN from WisKey (`users/pin_generate`; body `{user_id}`, "" for a person not saved yet). Not
    reserved: the save still answers `intercom_pin_conflict` if it was taken meanwhile. The value is shown once in
    the form and is never logged or audited by SMPLWISE. Reply: `{state, ..., pin: {pin}}`; a WisKey refusal is
    `state: error` with `last_error` (`pin_generation_failed`), an unknown person a 404."""
    body: PinGenerateBody = _parse_read(request, PinGenerateBody, raw)
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "pin", lambda call: intercom_client.users_pin_generate(call, body.user_id), intercom_sync.project_pin, who=principal.user_id)


SAVE_NOTE = "WisKey שמר את הרשומה. הסנכרון לתחנות מתבצע על ידי WisKey בנפרד - מצב הסנכרון של כל תחנה מוצג ברשומה."


@router.post("/intercom/people")
def person_create(request: Request, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Create a person in WisKey (`users/create`). Body: `{data: PersonData, sync_now, client_request_id, expires_at}`;
    `data` needs at least `display_name` and `employee_no`. Refused before sending (each refusal audited): a malformed
    draft, an expired or duplicate command. WisKey's refusals come back by name (`intercom_employee_conflict`,
    `intercom_pin_conflict`, `intercom_card_conflict`, `intercom_invalid_request` ...) with `details.outcome`
    `refused`; no clear answer is a 504 `intercom_outcome_unknown` (reload the directory before trying again - the
    person may exist). Reply: `{state, configured, last_error, fetched_at, person, sync, note, command_id}`; `person`
    is the saved record in the editor projection (WisKey accepted it into its store - the stations follow later)."""
    act = _Action(request, conn, principal, "intercom.person.create", "new", PERSON)
    body: PersonSaveBody = _parse(act, PersonSaveBody, raw)
    data = body.data.wiskey()
    act.details.update(sync_now=body.sync_now, **_draft_summary(data))
    not_after = _envelope(act, body)  # before the draft's own checks: every refusal row from here carries the command id
    missing = [k for k in ("display_name", "employee_no") if not data.get(k)]
    if missing:
        raise act.refuse(ApiError(422, "validation", "לאדם חדש נדרשים שם ומזהה עובד.", details={"fields": missing}))
    reply = _perform(act, "person", lambda call: intercom_client.users_create(call, data, body.sync_now), intercom_sync.project_person_editor, not_after, lane="config", summary=_person_summary)
    reply["note"] = SAVE_NOTE
    return reply


@router.put("/intercom/people/{user_id}")
def person_update(request: Request, user_id: str, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Update a person in WisKey (`users/update`, compare-and-set on `revision`). Body: `{data: PersonData (a patch),
    revision, sync_now, client_request_id, expires_at}`. A stale revision is a 409 `intercom_revision_conflict`
    (reload the person, then retry); the other refusals and the unknown outcome as for create. Reply as create."""
    act = _Action(request, conn, principal, "intercom.person.update", user_id, PERSON)
    body: PersonUpdateBody = _parse(act, PersonUpdateBody, raw)
    not_after = _envelope(act, body)
    data = body.data.wiskey()
    if not data:
        raise act.refuse(ApiError(422, "validation", "אין שינוי לשמור.", details={"fields": ["data"]}))
    act.details.update(revision=body.revision, sync_now=body.sync_now, **_draft_summary(data))
    reply = _perform(act, "person", lambda call: intercom_client.users_update(call, user_id, body.revision, data, body.sync_now), intercom_sync.project_person_editor, not_after, lane="config", summary=_person_summary)
    reply["note"] = SAVE_NOTE
    return reply


@router.post("/intercom/people/{user_id}/delete")
def person_delete(request: Request, user_id: str, principal: Principal = Depends(_manager), conn: sqlite3.Connection = Depends(get_conn), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Delete a person from WisKey (`users/delete`). Body: `{revision, confirmed, client_request_id, expires_at}`;
    `confirmed: true` is sent only by the confirmation dialog (WisKey's own `confirm_delete`, naming the stations the
    removal is scheduled on). WisKey answers `accepted`: the person left its list and the removal from each station
    (offline ones included) is queued, not done. Reply: `{state, ..., deleted: {accepted: true}, sync, note, command_id}`."""
    act = _Action(request, conn, principal, "intercom.person.delete", user_id, PERSON)
    body: PersonDeleteBody = _parse(act, PersonDeleteBody, raw)
    act.details["revision"] = body.revision
    not_after = _envelope(act, body)
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "מחיקת אדם דורשת אישור מפורש."))
    reply = _perform(act, "deleted", lambda call: intercom_client.users_delete(call, user_id, body.revision), intercom_sync.project_accepted, not_after, lane="config")
    reply["note"] = "WisKey קיבל את המחיקה. ההסרה מכל תחנה (גם מנותקת) מתוזמנת על ידי WisKey ואינה מיידית."
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
