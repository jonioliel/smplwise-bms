"""WISKEY-RESYNC-2520 slice 1: the WisKey system status of the Settings status page ("part D" of the 13.11 request) - two typed reads.

    GET /access-control/status/system   WisKey `system/status_v1`: version / api_contract / profile, per station connection, last
                                        authentication, last failure, firmware and the sync observation, write admission codes, job
                                        counts per family, templates, schedules (services/wiskey_system_status.py project_system)
    GET /access-control/status/jobs     WisKey `jobs/status_v1`: every retained checkpoint job (project_jobs)

Permission: `access.admin.read` UNRESTRICTED at the installation (WisKey answers both installation-wide; a station-scoped administrator
gets an audited 403 before anything is sent - the same rule as the status page's conflicts and the intercom's own action log). The browser
never names a WisKey command; nothing here writes or reaches a device.

Answer: `{state, reason, wiskey_code, fetched_at, data}` - HTTP 200 also when WisKey does not offer the read (`unsupported`), refuses the
add-on identity (`forbidden`), is not connected (`unavailable`), is busy (`busy`) or answered outside its contract (`error`,
`contract_mismatch`): the page says why and never shows invented or stale data (`data` is null unless `state` is `ready`)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import current_principal_ro, get_read_conn, settings_of
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import wiskey_system_status as ss
from ._common import rid as _rid
from ..wire import access_control_system_status as W
from ..wire import wire

router = APIRouter()


def _admin(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    """`access.admin.read` held at the installation and not denied on any scope a station can be in (an audited 403 otherwise)."""
    auth = ia.require_anywhere(conn, principal, ia.ADMIN_READ, _rid(request))
    ia.require_unrestricted(auth, ia.ADMIN_READ, _rid(request))
    return auth


@router.get("/access-control/status/system", **wire(W.AccessControlSystemStatusRead))
def system_status(request: Request, auth: ia.Authority = Depends(_admin)) -> dict[str, Any]:
    """WisKey's system status (`system/status_v1`, cached software state only) as `{state, reason, wiskey_code, fetched_at, data}`."""
    return ss.read(settings_of(request), "system", auth.principal.user_id)


@router.get("/access-control/status/jobs", **wire(W.AccessControlSystemStatusRead))
def jobs_status(request: Request, auth: ia.Authority = Depends(_admin)) -> dict[str, Any]:
    """WisKey's retained checkpoint jobs (`jobs/status_v1`) as `{state, reason, wiskey_code, fetched_at, data}`."""
    return ss.read(settings_of(request), "jobs", auth.principal.user_id)
