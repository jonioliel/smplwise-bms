"""The capture-lease settings (CR-WISKEY-LEASE-REVOCATION-EVENT section 7.3; slices L5 + L6).

`GET|PUT /access/capture-lease/settings` - system administrator only (`rbac.is_system_admin`, the `schedules.allow_disarm`
pattern: `system.configure` first, then 403 `not_system_admin` audited), every change audited `settings.changed` with
before / after:

- `access.capture_lease` `off` (default) / `on`. `on` is refused (409 `capture_lease_not_permitted`, audited) while the owner's
  separate go-live permit is not in the build - `capture_lease.GO_LIVE_PERMITTED`, a code constant that is False and is flipped
  only by the commit carrying that written permit (review M4), whatever bridge is known - and (409 `capture_lease_unavailable`,
  audited) while no bridge offering the lease service is known (MIN_BRIDGE_FOR_CAPTURE_LEASE is None in this build). Switching
  off revokes every live lease (T9 `feature_off`).
- `access.capture_lease_seconds` `120` (default = the cap) / `90` / `60` - may only lower the lease length.
- `access.lookup_scope` `holder` (default) / `holder_or_audit_readers` (C03, owner decision option a + q5): the wider value
  needs the typed confirmation `lookup_scope_confirm` (never stored). Explicit deny still wins under both
  (services/intercom_authority.lookup_allowed).
- `clock_reenable: true` - an administrator's explicit re-enable after the bridge reported an untrusted clock (F5), audited.
- `degraded_reenable: true` - an administrator's explicit re-enable after a ledger failure degraded the route (F3, review M3),
  audited: the rows still live in the ledger are marked `revoked(ledger_unavailable)` and a new stream is announced.

GET is system administrator only too (review L6).

A restore never takes any of the three keys from an archive (services/backup.SETTINGS_KEEP); its answer lists what it dropped."""
from __future__ import annotations

import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn
from ..db import set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, is_system_admin, require
from ..services import capture_lease as cl

router = APIRouter()
CONFIGURE = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {
        "capture_lease": cl.mode(conn),
        "capture_lease_available": cl.bridge_available(conn),
        "capture_lease_go_live_permitted": cl.go_live_permitted(),
        "capture_lease_seconds": cl.lease_seconds(conn),
        "capture_lease_seconds_values": [int(v) for v in cl.SECONDS_VALUES],
        "lookup_scope": cl.lookup_scope(conn),
        "lookup_scope_values": list(cl.LOOKUP_VALUES),
        "degraded": cl.GUARDS.degraded,
        "ledger_busy": cl.GUARDS.ledger_busy,
        "clock_untrusted": cl.GUARDS.clock_untrusted,
    }


@router.get("/access/capture-lease/settings")
def get_lease_settings(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    if not is_system_admin(conn, principal.user_id):  # CR 7.3 / review L6: system administrator, like the PUT
        audit(conn, actor=principal, action="settings.read", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"keys": list(cl.KEYS)})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לצפות בהגדרה זו.")
    return view(conn)


class LeaseSettingsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    capture_lease: Literal["off", "on"] | None = None
    capture_lease_seconds: Literal[120, 90, 60] | None = None
    lookup_scope: Literal["holder", "holder_or_audit_readers"] | None = None
    lookup_scope_confirm: str | None = Field(default=None, max_length=32)  # the typed confirmation for the wider value; never stored
    clock_reenable: bool | None = None
    degraded_reenable: bool | None = None


def _changed(conn: sqlite3.Connection, request: Request, principal: Principal, key: str, before: Any, after: Any) -> None:
    audit(conn, actor=principal, action="settings.changed", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"key": key, "before": before, "after": after})


@router.put("/access/capture-lease/settings")
def put_lease_settings(body: LeaseSettingsBody, request: Request, principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, CONFIGURE, INSTALLATION)
    if body.capture_lease is None and body.capture_lease_seconds is None and body.lookup_scope is None and not body.clock_reenable and not body.degraded_reenable:
        raise ApiError(422, "validation", "לא נשלחה הגדרה לשינוי.")
    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
              request_id=_rid(request), details={"keys": sorted(k for k in ("capture_lease", "capture_lease_seconds", "lookup_scope", "clock_reenable", "degraded_reenable")
                                                                 if getattr(body, k) is not None)})
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשנות הגדרה זו.")
    if body.lookup_scope == "holder_or_audit_readers" and cl.lookup_scope(conn) != "holder_or_audit_readers" and (body.lookup_scope_confirm or "").strip() != cl.LOOKUP_WIDE_WORD:
        raise ApiError(422, "confirm_required", f"כדי להרחיב את הבירור גם למחזיקי הרשאת צפייה באודיט יש להקליד \"{cl.LOOKUP_WIDE_WORD}\".", details={"field": "lookup_scope_confirm"})
    if body.capture_lease is not None:
        before = cl.mode(conn)
        if body.capture_lease == "on" and not cl.go_live_permitted():  # review M4: the owner's separate go-live permit, in code
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="capture_lease_not_permitted", details={"key": cl.FLAG_KEY, "requested": "on"})
            raise ApiError(409, "capture_lease_not_permitted", "הפעלת קריאת כרטיס דרך הגשר דורשת אישור הפעלה נפרד מבעל המערכת, וגרסה זו אינה כוללת אותו.")
        if body.capture_lease == "on" and not cl.bridge_available(conn):
            audit(conn, actor=principal, action="settings.changed", decision="denied", resource_type="installation", resource_id="*", request_id=_rid(request),
                  reason="capture_lease_unavailable", details={"key": cl.FLAG_KEY, "requested": "on"})
            raise ApiError(409, "capture_lease_unavailable", "קריאת כרטיס דרך הגשר עדיין אינה זמינה.")
        if body.capture_lease != before:
            set_setting(conn, cl.FLAG_KEY, body.capture_lease)
            _changed(conn, request, principal, cl.FLAG_KEY, before, body.capture_lease)
            if body.capture_lease == "off":
                cl.on_authority_change("feature_off", all=True)  # T9: every live lease goes at once
    if body.capture_lease_seconds is not None:
        before_s = cl.lease_seconds(conn)
        if body.capture_lease_seconds != before_s:
            set_setting(conn, cl.SECONDS_KEY, str(body.capture_lease_seconds))
            _changed(conn, request, principal, cl.SECONDS_KEY, before_s, body.capture_lease_seconds)
    if body.lookup_scope is not None:
        before_l = cl.lookup_scope(conn)
        if body.lookup_scope != before_l:
            set_setting(conn, cl.LOOKUP_KEY, body.lookup_scope)
            _changed(conn, request, principal, cl.LOOKUP_KEY, before_l, body.lookup_scope)
    if body.clock_reenable:
        was = cl.GUARDS.clock_untrusted
        cl.clock_trusted_again("administrator")
        audit(conn, actor=principal, action="intercom.capture_lease.clock_reenable", decision="allowed", resource_type="installation", resource_id="*",
              request_id=_rid(request), details={"was_untrusted": was})
    if body.degraded_reenable:
        # review M3: after a ledger failure the route is off in memory; this request holds the write lock, so the ledger is
        # writable right now. Rows still live in the ledger -> revoked(ledger_unavailable), then a new stream for the host.
        was_degraded = cl.GUARDS.degraded
        marked = cl.reenable_after_degraded(conn) if was_degraded else 0
        audit(conn, actor=principal, action="intercom.capture_lease.degraded_reenable", decision="allowed", resource_type="installation", resource_id="*",
              request_id=_rid(request), details={"was_degraded": was_degraded, "rows_revoked": marked})
        if was_degraded:
            from ..services import lease_events

            lease_events.WORKER.request_reset("repair")
    return view(conn)
