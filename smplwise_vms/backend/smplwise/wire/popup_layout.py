"""Response model of the area pop-up layout saves (routers/popup_layout.py: `PUT /api/v1/devices/popup-layout`,
`PUT /api/v1/devices/areas/{area_id}/popup-layout`; AREAEDIT-2290). The layout document is services/popup_layout's canonical form."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class PopupSectionItems(WireModel):
    order: list[str]
    hidden: list[str]


class PopupLayoutDoc(WireModel):
    """One layout: the section order, the hidden sections and, per item section, the entity order and the hidden entities."""
    sections: list[str]
    hidden: list[str]
    items: dict[str, PopupSectionItems]


class Popup(WireModel):
    """`version` counts saves; `site` = the default of every area without its own layout (null = the fixed order); `areas` = area id ->
    its own layout."""
    version: int
    site: PopupLayoutDoc | None
    areas: dict[str, PopupLayoutDoc]


class PopupSaved(WireModel):
    """The whole stored pop-up document after the save and the alert switch; the site save adds how many areas follow the site layout."""
    popup: Popup
    popup_alert: Literal["show", "hide"]
    affected_areas: int = None
