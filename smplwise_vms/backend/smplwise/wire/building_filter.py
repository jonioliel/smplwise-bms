"""MULTI-BUILDING-NEXT-2500: the building filter key a list answers with on a multi-building site (services/building_filter)."""
from __future__ import annotations

from . import WireModel


class BuildingFilterChoice(WireModel):
    """One building the filter offers (the buildings the caller's items sit in; the full interface's order, the shared building last)."""
    id: str
    name: str
    is_shared: bool


class BuildingFilter(WireModel):
    """The filter of one list: the choices and the chosen building (null = the whole site)."""
    buildings: list[BuildingFilterChoice]
    building: str | None
