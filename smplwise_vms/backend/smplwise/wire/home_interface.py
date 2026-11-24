"""Response models of the home interface (routers/home_interface.py, `/api/v1/home/...` and `PUT /api/v1/me/interface`; HOME-SIMPLE-2420).
The policy is services/home_interface.effective (also the `interface` block of `GET /me`), the preferences services/home_interface's
stored documents. The overview's device rows are the devices module's card rows (services/devices.card_row) picked per kind: the values
read from Home Assistant (states, levels, temperatures, modes) pass through as they are (`Any`), the router's own flags are typed. The
room picture (`GET /home/wallpaper/{room_key}`) is an image, not JSON."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import WireModel

NO_JSON: frozenset[str] = frozenset({"GET /home/wallpaper/{room_key}"})

Interface = Literal["home", "full"]


class HomeWallSettings(WireModel):
    """HOME-WALL-NIGHT-2500: the wall panel's rest screen (`rest`, after `rest_after_min` minutes without a touch), its night window
    (`night`, local HH:MM `night_start` .. `night_end` in the installation's zone; start == end = no window) with how strongly the screen
    is dimmed, and which events take the screen over (a door call always does, and comes first)."""
    rest: bool
    rest_after_min: int
    night: bool
    night_start: str
    night_end: str
    night_dim: Literal["medium", "soft", "strong"]
    takeover: Literal["alarm_urgent", "alarm", "call_only"]


class HomePolicy(WireModel):
    """The policy that applies to the person now (services/home_interface.effective): `interface` = the one to open; home_only / kiosk
    force home and no switch; `rooms` / `modules` null = all; `choose` = nobody configured the person and the installation asks first."""
    default_interface: Interface
    may_switch: bool
    home_only: bool
    kiosk: bool
    kiosk_area_id: str | None
    rooms: list[Any] | None
    modules: list[Any] | None
    interface: Interface
    configured: bool
    admin: bool
    kiosk_code_set: bool
    choose: bool
    kiosk_exit: Literal["code", "none"]
    wallpaper: Literal["none", "gallery", "gallery_image"]
    guests: bool
    room_wallpapers: dict[str, str]
    wall: HomeWallSettings


class HomeWeather(WireModel):
    """The first available weather entity: the rounded outside temperature (null when it reports none) and the condition in Hebrew."""
    t: int | None
    text: str


class HomeFloor(WireModel):
    id: str
    name: str
    rooms: list[str]


class HomeLight(WireModel):
    """A light, or a switch typed as a light (`kind`), as the caller may see it."""
    entity_id: str
    name: Any
    domain: str
    state: Any
    available: Any
    active: Any
    can_control: bool
    brightness_pct: Any
    dimmable: Any
    kind: Literal["light", "switch"]


class HomeSwitch(WireModel):
    """An on/off load that is not typed as a light: on/off only, never part of "turn the room off"; `protected` = an administrator's
    protection, `load_type` = its device type (or the activity kind)."""
    entity_id: str
    name: Any
    domain: str
    state: Any
    available: Any
    active: Any
    can_control: bool
    brightness_pct: Any
    dimmable: bool
    kind: Literal["switch"]
    protected: bool
    load_type: Any


class HomeClimate(WireModel):
    entity_id: str
    name: Any
    domain: str
    state: Any
    available: Any
    active: Any
    can_control: bool
    climate_kind: Any
    hvac_mode: Any
    hvac_modes: Any
    hvac_action: Any
    current_temperature: Any
    target_temperature: Any
    min_temp: Any
    max_temp: Any
    target_temp_step: Any
    preset_mode: Any
    preset_modes: Any
    unit: Any


class HomeShade(WireModel):
    entity_id: str
    name: Any
    domain: str
    state: Any
    available: Any
    active: Any
    can_control: bool
    position: Any
    moving: Any


class HomeLock(WireModel):
    """A lock; `unlock_reason` = why "open" is (not) offered (services/door_authority.unlock_reason), `can_unlock` = it is `ok`."""
    entity_id: str
    name: Any
    domain: str
    state: Any
    available: Any
    active: Any
    can_control: bool
    locked: Any
    wiskey_door: bool
    unlock_reason: str
    can_unlock: bool


class HomeRoom(WireModel):
    id: str
    name: Any
    floor_id: str
    temperature: Any
    open_count: Any
    can_bulk: bool
    lights: list[HomeLight]
    switches: list[HomeSwitch]
    climate: list[HomeClimate]
    shades: list[HomeShade]
    locks: list[HomeLock]


class HomeOverview(WireModel):
    """The caller's rooms by floor (only the rooms and categories their policy allows), the outside weather, whether they may switch the
    whole building off, whether their view is scoped, the categories shown and the policy."""
    weather: HomeWeather | None
    floors: list[HomeFloor]
    rooms: list[HomeRoom]
    can_bulk: bool
    scoped: bool
    modules: list[str]
    policy: HomePolicy


class HomePrefs(WireModel):
    """The person's own favourites (room key -> items) and layout (stored documents), and the administrator's favourites seed."""
    favourites: dict[str, Any]
    layout: dict[str, Any]
    seed: dict[str, Any]


class HomeUserPolicy(WireModel):
    """One active person on the administrator's page: who, the effective policy's fields, and whether a guest mark has an effect."""
    user_id: str
    username: str
    display_name: str
    source: str
    system_admin: bool
    default_interface: Interface
    may_switch: bool
    home_only: bool
    kiosk: bool
    kiosk_area_id: str | None
    rooms: list[Any] | None
    modules: list[Any] | None
    configured: bool
    admin: bool
    guests: bool
    can_invite: bool


class HomePolicies(WireModel):
    users: list[HomeUserPolicy]
    modules: list[str]
    seed: dict[str, Any]
    kiosk_code_set: bool


class HomeSeed(WireModel):
    seed: dict[str, Any]


class KioskCodeSet(WireModel):
    kiosk_code_set: bool


class HomeOk(WireModel):
    ok: bool


class HomeInstallSettings(WireModel):
    default_mode: Literal["full_all", "home_regular", "choose"]
    kiosk_exit: Literal["code", "none"]
    wallpaper: Literal["none", "gallery", "gallery_image"]
    wall_rest: Literal["on", "off"]
    wall_rest_after: Literal["2", "1", "5", "10", "15"]
    wall_night: Literal["on", "off"]
    wall_night_start: str
    wall_night_end: str
    wall_night_dim: Literal["medium", "soft", "strong"]
    wall_takeover: Literal["alarm_urgent", "alarm", "call_only"]


class HomeSettingsView(WireModel):
    """The installation settings, every allowed value per setting, and the built-in gallery names."""
    settings: HomeInstallSettings
    values: dict[str, list[str]]
    gallery: list[str]


class HomeSettingsSaved(WireModel):
    settings: HomeInstallSettings


class SwitchClassRow(WireModel):
    """One switch: its class now, what the system suggests from its name (null = nothing) and why, and why a change is refused (`locked`)."""
    entity_id: str
    name: str
    area_id: str | None
    area_name: str | None
    floor_name: str | None
    state: Any
    available: bool
    class_: Literal["light", "not_light", "protected"] = Field(alias="class")
    suggest: Literal["light", "protected"] | None
    suggest_reason: str | None
    locked: Literal["alarm_managed", "media_managed", "doors_layer"] | None


class SwitchClassSummary(WireModel):
    switches: int
    suggested: int
    light: int
    not_light: int
    protected: int


class SwitchClasses(WireModel):
    switches: list[SwitchClassRow]
    summary: SwitchClassSummary


class SwitchClassResult(WireModel):
    entity_id: str
    ok: bool
    reason: str | None
    changed: bool


class SwitchClassesSaved(WireModel):
    results: list[SwitchClassResult]
    changed: int
    refused: int


class WallpaperSaved(WireModel):
    """The person's own room picture stored: its size after re-encoding and the layout after the change."""
    ok: bool
    bytes: int
    layout: dict[str, Any]


class WallpaperRemoved(WireModel):
    ok: bool
    layout: dict[str, Any]
