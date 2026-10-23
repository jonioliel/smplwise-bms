"""CR-INSIGHT215: who may have which section of the monthly building report. One place for the HTTP route (the preview and the PDF) and for the
scheduled delivery, so a message and a download never say different things to the same person.

A section needs the read permission of its own module (plus its insight switch where it has one) and is otherwise omitted with a reason.
The generator section has two parts since slice 3: the alerts (`generator.view`, as before) and the run counts and hours (owner answer 262:
visible to whoever may read the building report; the installation can narrow it to the generator's own viewers or switch it off in the settings,
`report.generator_runs`)."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere
from . import insights_common as ic

SECTION_PERMISSION = {"energy": "energy.view", "elevators": "devices.read", "temperature": "devices.read", "generator": "generator.view",
                      "cameras": "events.read", "doors": ic.READ, "waste": ic.READ}
SECTION_SWITCH = {"doors": ic.SW_DOORS, "waste": ic.SW_WASTE}


def generator_parts(conn: sqlite3.Connection, principal: Principal) -> tuple[bool, bool]:
    """(alerts, runs): which parts of the generator section the principal gets."""
    alerts = authorize(conn, principal, SECTION_PERMISSION["generator"], INSTALLATION).allowed
    mode = ic.load(conn)["report"]["generator_runs"]
    runs = mode == "report_readers" or (mode == "generator_viewers" and alerts)
    return alerts, runs


def section_gate(conn: sqlite3.Connection, principal: Principal) -> Callable[[str], str | None]:
    anywhere = set(permissions_anywhere(conn, principal))

    def allowed(section: str) -> str | None:
        if section == "tickets":
            from .tickets import access as ta

            if not ta.module_on(conn):
                return "module_off"
            return None if ta.VIEW in anywhere else "not_permitted"
        if section in SECTION_SWITCH and not ic.switch_on(conn, SECTION_SWITCH[section]):
            return "switch_off"
        if section == "generator":
            return None if any(generator_parts(conn, principal)) else "not_permitted"
        perm = SECTION_PERMISSION.get(section)
        if perm is None or not authorize(conn, principal, perm, INSTALLATION).allowed:
            return "not_permitted"
        return None

    return allowed


def build_args(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """The keyword arguments of building_report.build() that depend on who asks."""
    return {"allowed": section_gate(conn, principal), "generator_parts": generator_parts(conn, principal)}
