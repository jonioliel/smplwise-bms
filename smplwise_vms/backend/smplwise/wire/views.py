"""Response models of the saved views API (routers/views.py, `/api/v1/views...`; live review F3). Field order is the order the router
builds its dicts in (`_view_dict`)."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()


class SavedViewRow(WireModel):
    """One saved view. `cameras` / `camera_names` leave out the cameras the reader may not watch live (counted in `hidden_cameras`); the
    create / update answers show every camera (the author just proved he may watch them)."""
    id: str
    name: str
    cameras: list[str]
    camera_names: list[str]
    hidden_cameras: int
    cols: int
    rows: int
    shared: bool
    kiosk: bool
    owner_user_id: str
    owner_username: str | None
    created_at: str
    updated_at: str


class SavedViewList(WireModel):
    """The caller's own views plus every shared one; what the caller may do with shared views."""
    views: list[SavedViewRow]
    can_share: bool
    can_manage_all: bool


class SavedViewDeleted(WireModel):
    id: str
    deleted: Literal[True]
