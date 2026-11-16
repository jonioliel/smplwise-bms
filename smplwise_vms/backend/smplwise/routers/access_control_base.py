"""WisKey tab: the permission names, the read gates and the small helpers every part of the router shares.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime
from typing import Any

from fastapi import Depends, Request

from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, read_gate
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import door_authority, intercom_authority as ia


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


def _reader_ro(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    """`access.read` at installation scope, checked as a dependency: FastAPI resolves dependencies before it validates
    query parameters, so a caller without the permission learns nothing about them (WisKey's own handlers authorize
    first, too). Returns the principal, whose id keys the caller's own rate bucket. On the request's read-mode connection:
    no write lock per request; a refusal's audit row is still written (rbac.require -> audit's write-aside).
    CR-READCONN-A-2436 (review 02:P3-5): the write-connection twin `_reader` lost its last user and is gone."""
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
