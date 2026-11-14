"""CR-INFRA-TEMPERATURE 2.9.1: who sees which temperature unit.

Reading the units needs `devices.read` and follows the device screens' scope rule (services/ha_scope.py): a floor-scoped viewer sees a unit
only when he sees its TEMPERATURE sensor; the door part (state, openings, door alarms) only when he also sees the door sensor. A unit he
may not see answers the same 404 as one that does not exist. Operator answers carry friendly names, never entity ids (owner decision 7)."""
from __future__ import annotations

import sqlite3
from typing import Any, Callable

from ..rbac import INSTALLATION, Principal, require
from . import ha_scope

READ = "devices.read"


class Scope:
    """The caller's view of the units: `units` (enabled, visible) and per unit whether the door sensor is visible too."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal) -> None:
        wide, floors = ha_scope.visible_floors(conn, principal, READ)
        if not wide and not floors:
            require(conn, principal, READ, INSTALLATION)  # the audited 403
        self.wide, self.floors = wide, floors
        self._placed: ha_scope.Placements | None = None
        self._conn = conn

    def sees(self, entity_id: str | None) -> bool:
        if not entity_id:
            return False
        if self.wide:
            return True
        if self._placed is None:
            self._placed = ha_scope.placements(self._conn)
        return ha_scope.entity_visible(False, self.floors, self._placed, entity_id)

    def filter(self, rows: list[sqlite3.Row]) -> list[tuple[sqlite3.Row, bool]]:
        """[(unit, door_visible)] of the units whose temperature sensor the caller sees."""
        return [(r, bool(r["door_entity_id"]) and self.sees(r["door_entity_id"])) for r in rows if self.sees(r["temp_entity_id"])]


def visible_to(conn: sqlite3.Connection, entity_visible: Callable[[str], bool], unit_id: Any) -> bool:
    """The notification rule of subject kind `temperature`: the caller sees the unit's temperature sensor on an ENABLED unit."""
    if not unit_id:
        return False
    try:
        r = conn.execute("SELECT temp_entity_id FROM infra_temp_units WHERE id = ? AND enabled = 1", (unit_id,)).fetchone()
    except sqlite3.Error:  # before the migration
        return False
    return r is not None and bool(entity_visible(r["temp_entity_id"]))
