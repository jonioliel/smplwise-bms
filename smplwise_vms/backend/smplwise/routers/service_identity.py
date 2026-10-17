"""USR2 phase 3: the service identity's administration (design record section 9, last row).

`GET /identity/service-identity`   the configured service HA user, whether the bridge agrees, the allow-list and - in plain Hebrew - what is
                                   still missing (services/service_identity.status)
`PUT /identity/service-identity {user_id}`  set it (32-hex HA user id) or clear it (null / ""); an administrator (HA or Arx), an unknown or an
                                   inactive user is refused; audited `identity.service_identity.configured`
`PUT /identity/service-identity/runnable {entity_ids}`  SVCIDENT3 (review S1 a): replace the allowlist of the scripts / scenes / automations
                                   Arx-only users may run in the extended mode (empty by default; at most 100 entity ids of those three
                                   domains); audited `identity.service_identity.runnable` (ids added / removed). Inert while the extended mode
                                   is off - the owner may prepare it; the bridge needs the same list in its options flow.

Both: `system.configure` at the installation, LOCAL CHANNEL ONLY (remote_channel.BLOCKED_ON_REMOTE answers 404 on the remote channel; the
route checks again). The switch `security.local_identity` does not gate them: the owner may prepare the identity before turning it on.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..auth import current_principal, get_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..remote_channel import is_remote
from ..services import service_identity as si

router = APIRouter()


def _local_only(request: Request) -> None:
    if is_remote(request):
        raise ApiError(404, "not_found", "Not found")


class RunnableBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_ids: list[str] = Field(default_factory=list, max_length=1000)  # the rule (<= MAX_RUNNABLE, the three domains) is judged and audited by configure_runnable


class ServiceIdentityBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str | None = Field(default=None, max_length=64)


@router.get("/identity/service-identity")
def get_service_identity(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _local_only(request)
    require(conn, principal, "system.configure", INSTALLATION)
    return si.status(conn)


@router.put("/identity/service-identity")
def put_service_identity(body: ServiceIdentityBody, request: Request, principal: Principal = Depends(current_principal),
                         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _local_only(request)
    require(conn, principal, "system.configure", INSTALLATION)
    if si.is_local(principal):  # defence in depth: a local identity never holds system.configure (owner answer Q3), and never configures this
        raise ApiError(403, "forbidden", "הפעולה אינה זמינה למשתמשי Arx.")
    return si.configure(conn, principal, body.user_id, getattr(request.state, "correlation_id", None))


@router.put("/identity/service-identity/runnable")
def put_runnable(body: RunnableBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _local_only(request)
    require(conn, principal, "system.configure", INSTALLATION)
    if si.is_local(principal):  # defence in depth, as above: a local identity never configures what local identities may run
        raise ApiError(403, "forbidden", "הפעולה אינה זמינה למשתמשי Arx.")
    return si.configure_runnable(conn, principal, body.entity_ids, getattr(request.state, "correlation_id", None))
