"""`PATCH /settings`: the switches that get their own audit row when they actually change - self-update, and the tickets,
emergency readiness, maintenance and document-reading modules. The check only notes the change; the row is written after the
values are stored, in the order of `AFTER` (settings_patch/__init__.py)."""
from __future__ import annotations

from ...audit import audit
from ...db import get_setting
from ...services.settings_store import DEFAULTS
from .._common import rid as _rid
from . import Patch


def update_switch(patch: Patch) -> None:
    """2.4.4: the CR-021 self-update switch gets its own audit row when it actually changes."""
    changes, conn = patch.changes, patch.conn
    if "update.apply_enabled" in changes:
        current_switch = get_setting(conn, "update.apply_enabled", DEFAULTS["update.apply_enabled"]) or DEFAULTS["update.apply_enabled"]
        if changes["update.apply_enabled"] != ("false" if current_switch == "false" else "true"):
            patch.update_switch = changes["update.apply_enabled"]


def tickets_switch(patch: Patch) -> None:
    """CR-038: the module switch gets its own audit row when it actually changes."""
    changes, conn = patch.changes, patch.conn
    if "tickets.enabled" in changes:
        current_tickets = get_setting(conn, "tickets.enabled", DEFAULTS["tickets.enabled"]) or DEFAULTS["tickets.enabled"]
        if changes["tickets.enabled"] != ("true" if current_tickets == "true" else "false"):
            patch.tickets_switch = changes["tickets.enabled"]


def maintenance_switch(patch: Patch) -> None:
    """CR-MAINT215: the module switch gets its own audit row when it actually changes."""
    changes, conn = patch.changes, patch.conn
    if "maintenance.enabled" in changes:
        current_maint = get_setting(conn, "maintenance.enabled", DEFAULTS["maintenance.enabled"]) or DEFAULTS["maintenance.enabled"]
        if changes["maintenance.enabled"] != ("true" if current_maint == "true" else "false"):
            patch.maintenance_switch = changes["maintenance.enabled"]


def docread_switch(patch: Patch) -> None:
    """SUPPLIERDOCS-297: the document-reading switch gets its own audit row when it actually changes."""
    changes, conn = patch.changes, patch.conn
    if "docread.enabled" in changes:
        current_dr = get_setting(conn, "docread.enabled", DEFAULTS["docread.enabled"]) or DEFAULTS["docread.enabled"]
        if changes["docread.enabled"] != ("true" if current_dr == "true" else "false"):
            patch.docread_switch = changes["docread.enabled"]


def emergency_switch(patch: Patch) -> None:
    """CR-EMERG104: the module switch gets its own audit row when it actually changes."""
    changes, conn = patch.changes, patch.conn
    if "emergency_readiness.enabled" in changes:
        current_em = get_setting(conn, "emergency_readiness.enabled", DEFAULTS["emergency_readiness.enabled"]) or DEFAULTS["emergency_readiness.enabled"]
        if changes["emergency_readiness.enabled"] != ("true" if current_em == "true" else "false"):
            patch.emergency_switch = changes["emergency_readiness.enabled"]


# ---------------------------------------------------------------- after the values are stored

def update_changed(patch: Patch) -> None:
    if patch.update_switch is not None:
        audit(patch.conn, actor=patch.principal, action="system.update.apply_enabled", decision="allowed", resource_type="installation", resource_id="update",
              request_id=_rid(patch.request), details={"to": patch.update_switch == "true"})


def tickets_changed(patch: Patch) -> None:
    tickets_switch = patch.tickets_switch
    if tickets_switch is not None:
        audit(patch.conn, actor=patch.principal, action="tickets.module.enable" if tickets_switch == "true" else "tickets.module.disable", decision="allowed",
              resource_type="installation", resource_id="tickets", request_id=_rid(patch.request))
        from ...services.tickets.public_runtime import RUNTIME as tickets_public  # CR-038 S4: the handler page follows at once (W3, W12)

        tickets_public.module_switched(tickets_switch == "true")


def emergency_changed(patch: Patch) -> None:
    emergency_switch = patch.emergency_switch
    if emergency_switch is not None:
        audit(patch.conn, actor=patch.principal, action="emergency_readiness.module.enable" if emergency_switch == "true" else "emergency_readiness.module.disable", decision="allowed",
              resource_type="installation", resource_id="emergency_readiness", request_id=_rid(patch.request))


def maintenance_changed(patch: Patch) -> None:
    maintenance_switch = patch.maintenance_switch
    if maintenance_switch is not None:
        audit(patch.conn, actor=patch.principal, action="maintenance.module.enable" if maintenance_switch == "true" else "maintenance.module.disable", decision="allowed",
              resource_type="installation", resource_id="maintenance", request_id=_rid(patch.request))


def docread_changed(patch: Patch) -> None:
    docread_switch = patch.docread_switch
    if docread_switch is not None:
        audit(patch.conn, actor=patch.principal, action="docread.enable" if docread_switch == "true" else "docread.disable", decision="allowed",
              resource_type="installation", resource_id="docread", request_id=_rid(patch.request))
