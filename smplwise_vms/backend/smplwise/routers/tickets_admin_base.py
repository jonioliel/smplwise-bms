"""The tickets settings API: the field patterns, the grant-role list and the two helpers every part shares.

CR-SPLIT-TICKETS-ADMIN-2440 (review 05:P2-08): moved unchanged out of routers/tickets_admin.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any

from ..rbac import INSTALLATION, Principal, require
from ..services.tickets import access, model
from ..services.tickets.access import Viewer
from ._tickets_common import invalid


KEY = r"^[a-z][a-z0-9_-]{1,31}$"
ICON = r"^[a-z][a-zA-Z0-9_-]{0,31}$"
COLOR = r"^--sw-[a-z0-9-]{1,40}$"
DOMAIN = r"^[a-z][a-z0-9_]{0,39}$"
GRANT_ROLES = ("tickets_view", "tickets_create", "tickets_manage", "tickets_all_departments", "tickets_external", "tickets_configure",
               "tickets_costs_view", "tickets_costs", "tickets_delete",  # + S9 (D31, 11A.8); + full deletion (owner 14.10)
               "tickets_handlers", "tickets_directory",  # + SMALL-294: the directory without the settings; + department managers' handlers (owner 2026-10-17)
               "tickets_technician_requests",  # + VPORTALRFQ: the portal's technician requests (owner 2026-10-17)
               "tickets_intake")  # + CR-INTAKE99: the free-text request queue (owner 143, 2026-10-24)


def _configurer(conn: sqlite3.Connection, principal: Principal) -> Viewer:
    require(conn, principal, access.CONFIGURE, INSTALLATION)
    return Viewer(conn, principal)


def _clean(conn: sqlite3.Connection, value: Any, field: str, *, required: bool, max_len: int) -> str:
    try:
        return model.text_field(value, field, required=required, max_len=max_len)
    except model.Invalid as exc:
        raise invalid(conn, exc.problems[0].field, exc.problems[0].code) from None
