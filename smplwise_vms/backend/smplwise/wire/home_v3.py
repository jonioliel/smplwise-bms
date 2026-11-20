"""Response models of the home interface's phase-1 additions (routers/home_v3.py: `/api/v1/home/room-wallpapers...`,
`/api/v1/home/guest-doors`; HOME-V3-P1-2430). The room picture itself (`GET .../image`) is an image, not JSON."""
from __future__ import annotations

from typing import Literal

from . import WireModel

NO_JSON: frozenset[str] = frozenset({"GET /home/room-wallpapers/{room_key}/image"})

WallpaperMode = Literal["none", "gallery", "gallery_image"]


class RoomWallpaperList(WireModel):
    """The administrator's wallpaper per room as it applies now (room key -> `g:<gallery name>` | `img`; empty while the installation
    offers none), the installation's wallpaper mode and the built-in gallery names."""
    walls: dict[str, str]
    mode: WallpaperMode
    gallery: list[str]


class RoomWallpapers(WireModel):
    """`PUT /home/room-wallpapers/{room_key}`: the wallpapers after the change."""
    walls: dict[str, str]


class RoomWallpaperImage(WireModel):
    """The picture stored (PUT) or removed (DELETE): the wallpapers after the change."""
    ok: bool
    walls: dict[str, str]


class GuestDoor(WireModel):
    """A door (station + lock relay) the caller may put in a guest invitation; `name` = the lock's name, else the station's."""
    station_id: str
    relay: int
    name: str
    station_name: str


class GuestDoors(WireModel):
    """At most 24 doors; empty when the caller holds the invite permission on no station."""
    doors: list[GuestDoor]
