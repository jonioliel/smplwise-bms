"""MULTI-BUILDING-NEXT-2500 (owner 22.11, Q67 and Q69 "then the filtering"): the building filter of the full interface's lists on a
multi-building site - the energy meters, the schedules, the calendar's shared rooms, the device search of the plan editor and the global
search (T119 design row MB-SCREENS-FILTER, docs/changes/MULTI-BUILDING-NEXT-2500.md).

Everything here is DISPLAY and only ever NARROWS. It runs after each route's own permission rules, on the items the caller already sees,
and drops the items of other buildings; it never adds an item, never grants, and never reads or writes a binding. The building an item
serves comes from the same resolution as the building cut (services/building_scope.area_buildings: map placement, then the per-area row,
then the floor's row, then the area -> building row) or, for a thing that sits on one of OUR floors (a shared room calendar, a search hit),
that floor's building.

Q67 (owner = the recommendation): an item serving two buildings shows in each of them with "גם ב...". An item of the shared building
("בניין משותף": the car park, the lobby) serves every building - the home interface's rule (frontend/src/home/home-buildings.ts
servedBy). An item the mapping places in no building shows under every building, without a note.

The switch rule of every multi-building row: while `home.multi_building.enabled` is off, or the installation setting
`home.multi_building.filter` is "off", or there are fewer than two live buildings, nothing here runs (`prepare` answers None) and every
list answers exactly as before - no new key. A `building` query parameter is then ignored (it can only narrow, and the screens do not
send it). While it is on, an unknown or deleted building is the shared 404 `building_not_found` of building_scope.cut.
"""
from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from typing import Any

from ..db import get_setting
from ..errors import ApiError
from . import building_scope
from .home_buildings import live_buildings, multi_on

FILTER_KEY = "home.multi_building.filter"
FILTER_VALUES: tuple[str, ...] = ("on", "off")
FILTER_DEFAULT = "on"


def filter_mode(conn: sqlite3.Connection) -> str:
    v = get_setting(conn, FILTER_KEY)
    return v if v in FILTER_VALUES else FILTER_DEFAULT


class View:
    """One request's building filter: the live buildings (the full interface's order, shared last), the area -> building map, our floor
    -> building map and the building the request chose (None = "כל האתר")."""

    __slots__ = ("buildings", "order", "shared", "area_b", "floor_b", "chosen", "seen")

    def __init__(self, conn: sqlite3.Connection, buildings: list[dict[str, Any]], chosen: str | None) -> None:
        self.buildings = [{"id": b["id"], "name": b["name"], "is_shared": b["is_shared"]} for b in buildings]
        self.order = {b["id"]: i for i, b in enumerate(self.buildings)}
        self.shared = {b["id"] for b in self.buildings if b["is_shared"]}
        self.area_b = {a: b for a, b in building_scope.area_buildings(conn).items() if b in self.order}
        self.floor_b = {r[0]: r[1] for r in conn.execute(
            "SELECT f.id, f.building_id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL"
        ).fetchall() if r[1] in self.order}
        self.chosen = chosen
        self.seen: set[str] = set()  # the buildings the caller's (unfiltered) items sit in directly - the choices offered

    def direct(self, *, areas: Iterable[str | None] = (), floors: Iterable[str | None] = (), buildings: Iterable[str | None] = ()) -> set[str]:
        """The buildings an item sits in directly: its areas' buildings, its floors' buildings and any building it names."""
        out = {self.area_b[a] for a in areas if a and a in self.area_b}
        out |= {self.floor_b[f] for f in floors if f and f in self.floor_b}
        out |= {b for b in buildings if b and b in self.order}
        return out

    def served(self, direct: set[str]) -> list[str]:
        """Q67: the buildings an item serves, in the buildings' order; one in the shared building serves every building."""
        ids = set(self.order) if direct & self.shared else direct
        return sorted(ids, key=self.order.__getitem__)

    def place(self, *, areas: Iterable[str | None] = (), floors: Iterable[str | None] = (), buildings: Iterable[str | None] = ()) -> list[str]:
        """The served buildings of one item the caller sees (and the choice it adds to the filter)."""
        d = self.direct(areas=areas, floors=floors, buildings=buildings)
        self.seen |= d
        return self.served(d)

    def keep(self, served: list[str]) -> bool:
        """Whether an item serving `served` shows under the chosen building: always under "כל האתר"; an item in no building shows under
        every building."""
        return not self.chosen or not served or self.chosen in served

    def meta(self) -> dict[str, Any] | None:
        """The `building_filter` key of the answer: the buildings the caller's items sit in (the choices) and the chosen one. None (no key,
        no per-item `buildings`) when they sit in fewer than two and the request chose none: the list is already one building's."""
        choices = [b for b in self.buildings if b["id"] in self.seen or b["id"] == self.chosen]
        if len(choices) < 2 and not self.chosen:
            return None
        return {"buildings": choices, "building": self.chosen}


def prepare(conn: sqlite3.Connection, building: str | None) -> View | None:
    """The filter of one list request, or None while it does not apply (the switch off, the setting off, fewer than two live buildings) -
    the list then answers exactly as before. `building`: the request's `building` parameter ("" / None = the whole site)."""
    if not multi_on(conn) or filter_mode(conn) != "on":
        return None
    bs = live_buildings(conn)
    if len(bs) < 2:
        return None
    chosen = building or None
    if chosen and chosen not in {b["id"] for b in bs}:
        raise ApiError(404, "building_not_found", "הבניין לא נמצא.", details={"building_id": chosen})
    return View(conn, bs, chosen)


def apply(view: View | None, items: list[dict[str, Any]], served: list[list[str]], answer: dict[str, Any], key: str) -> list[dict[str, Any]]:
    """Narrow one list: `items` (already permission-filtered) with their served buildings (`served`, same order). Returns the items kept,
    each with `buildings` when the answer carries the filter; writes `building_filter` into `answer`. `view` None = the list unchanged."""
    if view is None:
        return items
    meta = view.meta()
    if meta is None:
        return items
    answer["building_filter"] = meta
    out = []
    for it, s in zip(items, served, strict=True):
        if view.keep(s):
            out.append({**it, "buildings": s})
    answer[key] = out
    return out
