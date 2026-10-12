"""CR-036 S4: the typed access-control read endpoints - the native screens' only data path to WisKey ("בקרת כניסה").

One endpoint per projection, no generic proxy: the browser never names a WisKey command. Every endpoint:
- gates on its permission ANYWHERE a station can be (services/intercom_authority.require_anywhere: installation, a site, a
  building or a station - CR-033's scope), as a dependency, so a caller without it learns nothing about the parameters and
  gets an audited 403;
- runs on the request's READ connection (no write lock is held while WisKey answers; the few audit rows - a refusal, a photo
  or event-picture view, an export - go through the audit's own short write);
- asks services/intercom_adapter.py, which reads WisKey on the service socket's read / technical channel and hands the answer
  to the projection filter: rows the caller may not see are omitted, fields they may not see are never built, counts are
  recounted over what they see. A station, person or event they may not see answers exactly like one that does not exist.

Reply shape of the JSON reads: `{state, configured, last_error, fetched_at, <key>, sync}` (+ `fresh` for the cached and the
station reads). `<key>` is null whenever `state` is not `ready`; `state` `unsupported` = this WisKey does not list the
command (`last_error` not_listed / api_incompatible / commands_unknown) and nothing was sent. The legacy phase-1b reads
(GET /intercom/events, /intercom/people, /intercom/people/{id}) use the same adapter and filter (routers/access_control.py).
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import Response

from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_adapter as adapter
from ..services import intercom_authority as ia

router = APIRouter()

MAX_ID = ia.MAX_ID
ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"  # station / person / event ids as WisKey makes them (no control, no slash)
IMAGE_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}
CODE_PATTERN = r"^[a-z0-9][a-z0-9_./:-]{0,63}$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(permission: str):
    """The endpoint's permission somewhere a station can be, as a dependency (before any parameter is validated)."""

    def dep(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
        return ia.require_anywhere(conn, principal, permission, _rid(request))

    return dep


def _instant(name: str, value: str | None) -> datetime | None:
    """An aware ISO instant (WisKey's own rule for `start` / `end`: at most 40 characters, a time zone)."""
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן ISO עם אזור זמן (למשל 2026-09-27T08:00:00Z).", details={"fields": [name]})
    return parsed


def _window(start: str | None, end: str | None) -> None:
    a, b = _instant("start", start), _instant("end", end)
    if a and b and a >= b:
        raise ApiError(422, "validation", "start חייב להיות לפני end.", details={"fields": ["start", "end"]})


def _field_filters(auth: ia.Authority, request: Request, credential: str | None, profile: list[str] | None) -> dict[str, Any]:
    """The people list's FIELD filters (S7): `credential` (pin | no_pin | card | no_card) and `profile` (repeated
    `profile=<field id>=<value>`, exact match, at most eight, one value per field). Filtering by credentials or by profile values
    separates people by what the sensitive level shows, so they need `access.people.sensitive` somewhere (an audited 403
    otherwise); the adapter then answers from the people the caller sees at that level only. Returns the filters to hand on."""
    out: dict[str, Any] = {}
    wanted: dict[str, str] = {}
    for item in profile or []:
        field, sep, value = item.partition("=")
        if not sep or not adapter.ID.fullmatch(field) or not value or len(value) > 100 or any(ord(c) < 32 for c in value):
            raise ApiError(422, "validation", "מסנן שדה פרופיל חייב להיות מהצורה שדה=ערך.", details={"fields": ["profile"]})
        if field in wanted:
            raise ApiError(422, "validation", "שדה פרופיל מופיע במסנן פעם אחת בלבד.", details={"fields": ["profile"]})
        wanted[field] = value
    if len(wanted) > adapter.MAX_PROFILE_FILTERS:
        raise ApiError(422, "validation", "יותר מדי מסנני שדות פרופיל.", details={"fields": ["profile"]})
    if credential is not None or wanted:
        ia.require_anywhere(auth.conn, auth.principal, ia.PEOPLE_SENSITIVE, _rid(request))
    if credential is not None:
        out["credential"] = credential
    if wanted:
        out["profile"] = wanted
    return out


def _group_filter(auth: ia.Authority, request: Request, current_group: str | None) -> None:
    """Filtering events by a person's group reveals group membership - people data: `access.people.read` somewhere."""
    if current_group is not None:
        ia.require_anywhere(auth.conn, auth.principal, ia.PEOPLE_READ, _rid(request))


# ---------------------------------------------------------------- features and stations (access.read)

@router.get("/access-control/features")
def features(request: Request, auth: ia.Authority = Depends(_gate(ia.READ))) -> dict[str, Any]:
    """Which native features the installed WisKey offers (its `api.commands`), per feature: `{available, reason}`; null
    `available` while there is no served copy yet. WisKey facts only - a screen hides what is not available."""
    return adapter.ADAPTER.features(settings_of(request), auth)


@router.get("/access-control/stations")
def stations(request: Request, auth: ia.Authority = Depends(_gate(ia.READ))) -> dict[str, Any]:
    """The stations the caller sees (`access.read` on each): online, call state (no caller name), sync state, doors, camera
    id; `technical` (model, firmware, capabilities, clock, event stream) with `access.stations.read` on the station, else
    null; `errors` (last sync / scan error) under the sync-error rule, else null. From the feed's live copy - no WisKey
    call. Reply: `{state, configured, last_error, fresh, fetched_at, stations, default_zone, sync}`."""
    return adapter.ADAPTER.stations(settings_of(request), auth)


@router.get("/access-control/stations/{station_id}")
def station(request: Request, auth: ia.Authority = Depends(_gate(ia.READ)), station_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """One station, as in the list; 404 `intercom_station_not_found` when there is no such station or the caller may not
    see it. Reply: `{state, ..., station, default_zone, sync}`."""
    return adapter.ADAPTER.station(settings_of(request), auth, station_id)


# ---------------------------------------------------------------- one station's technical reads (access.stations.read)

@router.get("/access-control/stations/{station_id}/programs")
def door_programs(request: Request, auth: ia.Authority = Depends(_gate(ia.STATIONS_READ)), station_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """The station's door programs (hold-open programs on the device, `programs`) and saved drafts (`saved`), each with its
    weekly windows and holidays. View only (edits are the write phase's). Reply: `{state, ..., fresh, programs, sync}`."""
    return adapter.ADAPTER.door_programs(settings_of(request), auth, station_id)


@router.get("/access-control/stations/{station_id}/doors/{door}/hold")
def hold_schedule(request: Request, auth: ia.Authority = Depends(_gate(ia.STATIONS_READ)), station_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN),
                  door: int = Path(ge=1, le=2)) -> dict[str, Any]:
    """The hold-open schedule draft of one door (`door` = the relay's physical index); 404 `intercom_lock_unknown` for a
    relay the station does not have. Reply: `{state, ..., fresh, hold: {draft, active, blocker, timezone}, sync}`."""
    return adapter.ADAPTER.hold_schedule(settings_of(request), auth, station_id, door)


@router.get("/access-control/stations/{station_id}/codes")
def codes_presence(request: Request, auth: ia.Authority = Depends(_gate(ia.STATIONS_READ)), station_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """Whether the station's public door codes are set - presence only, per slot (`configured` true / false / null); never a
    value. WisKey reads the device for it (cached five minutes). Reply: `{state, ..., fresh, codes, sync}`."""
    return adapter.ADAPTER.codes_presence(settings_of(request), auth, station_id)


# ---------------------------------------------------------------- the Settings status page (access.admin.read)

@router.get("/access-control/status/stations")
def status_stations(request: Request, auth: ia.Authority = Depends(_gate(ia.ADMIN_READ))) -> dict[str, Any]:
    """The status page's station list (`access.read` and `access.admin.read` on each), as GET /access-control/stations."""
    return adapter.ADAPTER.status_stations(settings_of(request), auth)


@router.get("/access-control/stations/{station_id}/health")
def health(request: Request, auth: ia.Authority = Depends(_gate(ia.ADMIN_READ)), station_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """One station's health card: polling, request times, access sync worker, event stream, clock. Reply: `{state, ...,
    fresh, health, sync}`."""
    return adapter.ADAPTER.health(settings_of(request), auth, station_id)


@router.get("/access-control/stations/{station_id}/health/history")
def health_history(request: Request, auth: ia.Authority = Depends(_gate(ia.ADMIN_READ)), station_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """Seven days of one station's health samples (online, poll time, sync, event stream). Reply: `{state, ..., history}`."""
    return adapter.ADAPTER.health_history(settings_of(request), auth, station_id)


@router.get("/access-control/status/sync")
def sync_status(request: Request, auth: ia.Authority = Depends(_gate(ia.ADMIN_READ))) -> dict[str, Any]:
    """Per-station sync counts (pending people, operations by state, revocations, card / PIN removals, deletions) and their
    totals - over the stations the caller sees on the status page only. No person in it. Reply: `{state, ..., sync_status}`."""
    return adapter.ADAPTER.sync_status(settings_of(request), auth)


@router.get("/access-control/status/conflicts")
def conflicts(request: Request, auth: ia.Authority = Depends(_gate(ia.ADMIN_READ))) -> dict[str, Any]:
    """Sync conflicts and errors per (person or removal, station). Installation-wide in WisKey: `access.admin.read`
    unrestricted (a station-scoped administrator gets an audited 403); the person on a row as the people rules allow on its
    station. Reply: `{state, ..., conflicts: [{kind, station_id, sync_state, last_error, person}], sync}`."""
    return adapter.ADAPTER.conflicts(settings_of(request), auth, _rid(request))


@router.get("/access-control/status/alerts")
def alerts(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.ADMIN_READ)),
    kind: Literal["", "offline", "sync_stalled", "sync_conflict", "sync_error", "event_gap", "clock_drift"] = Query(""),
    include_suppressed: bool = Query(False),
    offset: int = Query(0, ge=0, le=10_000),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Fleet alerts of the stations the caller sees on the status page, paged and counted over those (`total`,
    `active_count`, `suppressed_count`). Reply: `{state, ..., fresh, alerts, sync}`."""
    return adapter.ADAPTER.alerts(settings_of(request), auth, kind=kind, include_suppressed=include_suppressed, offset=offset, limit=limit)


@router.get("/access-control/status/audit")
def wiskey_audit(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.ADMIN_READ)),
    user_id: str | None = Query(None, min_length=1, max_length=MAX_ID, pattern=ID_PATTERN),
    station_id: str | None = Query(None, min_length=1, max_length=MAX_ID, pattern=ID_PATTERN),
    action: str | None = Query(None, pattern=CODE_PATTERN),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    before: int | None = Query(None, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    """The intercom's own action log ("פעולות שנעשו בחלון האינטרקום": what was done in its own panel; Arx's actions are in
    Arx's audit). Installation-wide in WisKey: `access.admin.read` unrestricted. Reply: `{state, ..., audit: {records,
    next_cursor, total, retention_days}, sync}`."""
    _window(start, end)
    filters = {"user_id": user_id, "station_id": station_id, "action": action, "start": start, "end": end, "before": before, "limit": limit}
    return adapter.ADAPTER.wiskey_audit(settings_of(request), auth, filters, _rid(request))


# ---------------------------------------------------------------- people (access.people.read)

@router.get("/access-control/people")
def people(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ)),
    query: str = Query("", max_length=160),
    offset: int = Query(0, ge=0, le=10_000_000),
    limit: int = Query(50, ge=1, le=200),
    snapshot: str | None = Query(None, max_length=64),
    station: str | None = Query(None, min_length=1, max_length=MAX_ID),
    group: str | None = Query(None, min_length=1, max_length=MAX_ID),
    rights: Literal["assigned", "unassigned", "disabled"] | None = Query(None),
    state: Literal["active", "inactive", "expired", "upcoming", "archived"] | None = Query(None),
    sort: Literal["name", "name_desc", "employee"] | None = Query(None),
    credential: Literal["pin", "no_pin", "card", "no_card"] | None = Query(None),
    profile: list[str] | None = Query(None, max_length=16),
) -> dict[str, Any]:
    """One page of the people the caller may see (a person is visible through an assignment on a station where the caller
    holds `access.people.read`). `query` is matched by Arx on the name and - where the caller sees it - the employee
    number; it never reaches WisKey. `people.sort` is the order applied (the employee-number order only for a caller who
    sees every number). `total` counts what the caller sees; `total_all` is null unless they see everyone; `complete`
    false = the scan stopped early (`incomplete_reason` scan_limit / rate_limited). `employee_no_visible` says whether the caller
    sees every employee number (the number column, the search by number and the number order follow it). `credential` and
    `profile` are sensitive-level filters (`access.people.sensitive` somewhere, else an audited 403; a person is matched only
    where the caller sees them at that level). A list row carries no phone, photo flag, profile values or timing - one person's
    page does. Reply: `{state, ..., people, sync}`."""
    filters = {"station": station, "group": group, "rights": rights, "state": state, "sort": sort, **_field_filters(auth, request, credential, profile)}
    return adapter.ADAPTER.people(settings_of(request), auth, query=query, filters=filters, offset=offset, limit=limit, snapshot=snapshot)


@router.get("/access-control/people/{user_id}")
def person(request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ)), user_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """One person at the caller's level (`level` names / sensitive; `editable`; the visible assignments with their sync
    state; groups, validity, timing; phone, photo flag and profile values at the sensitive level only); 404
    `intercom_person_not_found` when there is no such person or the caller may not see them."""
    return adapter.ADAPTER.person(settings_of(request), auth, user_id)


@router.get("/access-control/people/{user_id}/photo")
def person_photo(request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ)), user_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> Response:
    """The person's photo (image/jpeg, never cached by the browser): the person visible at the sensitive level
    (`access.people.sensitive` on every visible station of theirs), else an audited 403; 404 `intercom_photo_not_found`
    when there is none. Every view is audited (`intercom.person.photo_view`, the person id only)."""
    data = adapter.ADAPTER.person_photo(settings_of(request), auth, user_id, _rid(request))
    return Response(content=data, media_type="image/jpeg", headers=IMAGE_HEADERS)


# ---------------------------------------------------------------- events (access.events.read)

@router.get("/access-control/events")
def events(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.EVENTS_READ)),
    station_id: str | None = Query(None, min_length=1, max_length=MAX_ID),
    person: str | None = Query(None, min_length=1, max_length=128),
    result: Literal["granted", "denied", "unknown"] | None = Query(None),
    authentication: Literal["card", "pin", "unknown"] | None = Query(None),
    event_type: Literal[adapter.FILTERABLE_EVENT_TYPES] | None = Query(None),  # type: ignore[valid-type]
    door: int | None = Query(None, ge=1, le=2),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    limit: int = Query(100, ge=1, le=200),
    before: str | None = Query(None, min_length=1, max_length=128),
    current_group: str | None = Query(None, min_length=1, max_length=MAX_ID),
) -> dict[str, Any]:
    """One page of the entry log as the caller may see it, newest first. `before` = the previous page's `events.next` (an
    opaque cursor when Arx filtered the page itself). A refused cursor is a 422 `intercom_cursor_expired` (reload from the
    first page). `current_group` needs `access.people.read` as well. `portrait` on a row says whether it has a picture the
    caller may open (GET /access-control/events/{id}/portrait). Reply: `{state, ..., events: {records, next, retention_days,
    capacity, storage_failed, stations, complete, incomplete_reason}, sync}`."""
    _window(start, end)
    _group_filter(auth, request, current_group)
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "event_type": event_type, "door": door,
               "start": start, "end": end, "current_group": current_group}
    try:
        return adapter.ADAPTER.events(settings_of(request), auth, filters, limit=limit, before=before)
    except ApiError as exc:
        if exc.code == "intercom_invalid_request" and before is not None:
            raise ApiError(422, "intercom_cursor_expired", adapter.CURSOR_EXPIRED, details=exc.details) from exc
        raise


@router.get("/access-control/events/export.csv")
def events_export(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.EVENTS_EXPORT)),
    station_id: str | None = Query(None, min_length=1, max_length=MAX_ID),
    person: str | None = Query(None, min_length=1, max_length=128),
    result: Literal["granted", "denied", "unknown"] | None = Query(None),
    authentication: Literal["card", "pin", "unknown"] | None = Query(None),
    event_type: Literal[adapter.FILTERABLE_EVENT_TYPES] | None = Query(None),  # type: ignore[valid-type]
    door: int | None = Query(None, ge=1, le=2),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    current_group: str | None = Query(None, min_length=1, max_length=MAX_ID),
) -> Response:
    """The entry log as a CSV file (UTF-8 with BOM, every cell quoted, formula-safe): no card column; the employee number only
    where the caller sees it; the rows of stations the caller sees only. A caller who does not see every station must name
    one (422 `intercom_export_station_required`). Audited (`intercom.events.export`: filters, rows, columns - never a row).
    Needs `access.events.export` and `access.events.read` on the stations exported."""
    _window(start, end)
    _group_filter(auth, request, current_group)
    if not auth.anywhere(ia.EVENTS_READ):
        ia.require_anywhere(auth.conn, auth.principal, ia.EVENTS_READ, _rid(request))
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "event_type": event_type, "door": door,
               "start": start, "end": end, "current_group": current_group}
    data, rows, _columns = adapter.ADAPTER.events_export(settings_of(request), auth, filters, _rid(request))
    return Response(content=data, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="access-events.csv"', "Cache-Control": "private, no-store", "X-Export-Rows": str(rows)})


@router.get("/access-control/events/{event_id}")
def event_detail(request: Request, auth: ia.Authority = Depends(_gate(ia.EVENTS_READ)), event_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN)) -> dict[str, Any]:
    """One event with WisKey's evidence (how the identity and the time were established - flags, no person field); 404
    `intercom_event_not_found` when there is no such event or the caller may not see it. Reply: `{state, ..., event, sync}`."""
    return adapter.ADAPTER.event_detail(settings_of(request), auth, event_id)


@router.get("/access-control/events/{event_id}/portrait")
def event_portrait(
    request: Request,
    auth: ia.Authority = Depends(_gate(ia.EVENTS_READ)),
    event_id: str = Path(min_length=1, max_length=MAX_ID, pattern=ID_PATTERN),
    station_id: str = Query(min_length=1, max_length=MAX_ID),
    at: str = Query(min_length=1, max_length=40),
) -> Response:
    """The event's picture (image/jpeg, never cached by the browser). `station_id` and `at` are the row's own `station_id`
    and `timestamp` as the list served them (WisKey keeps the picture as a reference on the list row; Arx finds the row
    again and WisKey's row decides the station). Owner answer 4 of 2026-10-12: the events view on the station is enough
    (`access.event_portrait_sensitive` makes it need `access.people.sensitive` too). Each view is audited unless the
    administrator switched that off (`access.event_portrait_audit`)."""
    moment = _instant("at", at)
    assert moment is not None
    data = adapter.ADAPTER.event_portrait(settings_of(request), auth, event_id, station_id, moment, _rid(request))
    return Response(content=data, media_type="image/jpeg", headers=IMAGE_HEADERS)


# ---------------------------------------------------------------- groups, policy versions, schedules

@router.get("/access-control/groups")
def groups(request: Request, auth: ia.Authority = Depends(_gate(ia.PEOPLE_READ))) -> dict[str, Any]:
    """The person groups the caller may see (all for a caller who sees everyone; otherwise the groups whose every station
    they see) with the stations each grants, the photo switch and - for `access.people.sensitive` or the Settings status -
    the custom field definitions. Reply: `{state, ..., fresh, groups: {revision, photo_enabled, groups, fields}, sync}`."""
    return adapter.ADAPTER.groups(settings_of(request), auth)


@router.get("/access-control/groups/versions")
def group_versions(request: Request, auth: ia.Authority = Depends(_gate(ia.ADMIN_READ)), offset: int = Query(0, ge=0, le=10_000), limit: int = Query(20, ge=1, le=50)) -> dict[str, Any]:
    """The history of the groups and fields policy (revision, when, which kind of change, how many fields / groups changed;
    never who). `access.admin.read` unrestricted. Reply: `{state, ..., fresh, versions, sync}`."""
    return adapter.ADAPTER.group_versions(settings_of(request), auth, offset, limit, _rid(request))


@router.get("/access-control/schedules")
def schedules_library(request: Request, auth: ia.Authority = Depends(_gate(ia.STATIONS_READ))) -> dict[str, Any]:
    """WisKey's device schedule library ("לוחות זמנים של דלתות"): weekly windows and holidays. Installation-wide in WisKey:
    `access.stations.read` unrestricted. Reply: `{state, ..., fresh, schedules, sync}`."""
    return adapter.ADAPTER.schedules(settings_of(request), auth, "library", _rid(request))


@router.get("/access-control/schedules/plans")
def schedules_plans(request: Request, auth: ia.Authority = Depends(_gate(ia.STATIONS_READ))) -> dict[str, Any]:
    """The schedule deployment plans per station with their last check (blockers, resources). Reply as the library."""
    return adapter.ADAPTER.schedules(settings_of(request), auth, "plans", _rid(request))


@router.get("/access-control/schedules/operations")
def schedules_operations(request: Request, auth: ia.Authority = Depends(_gate(ia.STATIONS_READ))) -> dict[str, Any]:
    """The schedule operations (jobs, archive, journal, claims; `writes_enabled`). Reply as the library."""
    return adapter.ADAPTER.schedules(settings_of(request), auth, "operations", _rid(request))
