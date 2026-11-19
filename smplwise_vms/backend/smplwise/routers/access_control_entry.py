"""WisKey tab, read side: the entry center's overview, the background feed, diagnostics, the activity log and the people
directory (CR-005 phases 1a / 1b; station-scoped since CR-036 S3).

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Path, Query, Request

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import door_authority, intercom_authority as ia, intercom_adapter, intercom_sync, wiskey_background_feed, wiskey_camera, wiskey_diagnostics
from .access_control_base import MAX_PAGE, READ, _credentials_admin_ro, _gate, _instant, _reader_ro, _visible_stations
from ._common import rid as _rid

router = APIRouter()


@router.get("/intercom/overview")
def overview(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
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
def background(request: Request, principal: Principal = Depends(_reader_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
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
def diagnostics(request: Request, principal: Principal = Depends(_credentials_admin_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """What WisKey sees Arx as (B0, ported as CR-036 S1; `system.configure`): WisKey's `authorization/session` for the service
    identity (the add-on's own Home Assistant user, which also carries the existing writes) and for the background identity (its
    own session once the owner configured `wiskey_background_token`; until then it says it shares the service identity), plus
    each channel's command allow-list. Permission facts only - areas, station scope, field levels, security state, whether
    `subscribe` is live - with `findings` derived from them. Read-only; nothing is changed in WisKey and no person field is
    involved. Each run sends a command to WisKey on the administrator's request, so it leaves one audit row (identity states
    and finding codes only)."""
    body = wiskey_diagnostics.collect(settings_of(request), who=principal.user_id)
    audit(conn, actor=principal, action="intercom.diagnostics.read", decision="allowed", resource_type="intercom", resource_id="diagnostics",
          request_id=_rid(request),
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
        ia.require_anywhere(auth.conn, auth.principal, ia.PEOPLE_READ, _rid(request))
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
