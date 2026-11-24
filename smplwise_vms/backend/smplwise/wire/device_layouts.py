"""Response models of routers/device_layouts.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class DeviceLayoutsLayoutDesktopLayout(ExactModel):
    v: Num
    cols: Num
    items: dict[str, Any]


class DeviceLayoutsLayoutDesktop(ExactModel):
    layout: DeviceLayoutsLayoutDesktopLayout
    revision: Num
    updated_by: str | None
    updated_at: str


class DeviceLayoutsLayout(ExactModel):
    """The screen's stored layout (desktop and phone; null = automatic) - everyone who reads the device screens."""
    scope: str
    id: str
    can_edit: bool
    narrowed: bool
    desktop: DeviceLayoutsLayoutDesktop | None
    phone: DeviceLayoutsLayoutDesktop | None


class DeviceLayoutsPutLayoutDesktop(ExactModel):
    layout: DeviceLayoutsLayoutDesktopLayout
    revision: Num
    updated_by: str
    updated_at: str


class DeviceLayoutsPutLayout(ExactModel):
    """Save one variant. `revision` is the one the editor started from (0 = none); another save in between is a 409 `layout_conflict` with the current revision, and nothing is written."""
    scope: str
    id: str
    can_edit: bool
    narrowed: bool
    desktop: DeviceLayoutsPutLayoutDesktop | None
    phone: DeviceLayoutsPutLayoutDesktop | None


class DeviceLayoutsResetLayout(ExactModel):
    """Back to the automatic layout: `all` ("אפס לברירת מחדל": desktop and phone) or one variant (`phone`: "חזור לאוטומטי" - the phone layout is derived from the desktop one again)."""
    scope: str
    id: str
    can_edit: bool
    narrowed: bool
    desktop: DeviceLayoutsPutLayoutDesktop | None
    phone: Any


class DeviceLayoutsCopyToAllAreasSource(ExactModel):
    scope: str
    id: str
    can_edit: bool
    narrowed: bool
    desktop: DeviceLayoutsPutLayoutDesktop
    phone: DeviceLayoutsPutLayoutDesktop | None


class DeviceLayoutsCopyToAllAreas(ExactModel):
    """This area's STORED layout becomes every other area's (the "ללא שיוך" bucket included): the desktop record and, when this area has one, the phone record; an area whose phone layout was edited but whose source has none goes back to the derive"""
    copied_to: Num
    source: DeviceLayoutsCopyToAllAreasSource
