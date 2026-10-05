"""Wall display profiles (CR-030 v2, WDM S1). A wall tablet is an ordinary user on the `kiosk` role; this module holds
the per-user wall configuration (`wall_profiles`), and answers the display's own reads. The camera allow list is the
user's camera-scope `kiosk` bindings (routers/wall.py writes them). Nothing here grants authority: the role and its
bindings do (rbac.py)."""
from __future__ import annotations

import json
import sqlite3
import threading
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from ..db import get_setting, now_iso

MAX_CAMERAS = 12
MAX_STATE_ENTITIES = 8
MAX_PROFILES_DEFAULT = 20
KIOSK_ROLE = "kiosk"


class Alerts(BaseModel):  # section 5: stored now, delivered by WDX (S6)
    model_config = ConfigDict(extra="forbid")
    enabled: bool = True
    categories: list[str] = Field(default_factory=lambda: ["safety", "alerts", "doors", "device_faults", "security"], max_length=12)
    min_severity: Literal["info", "alert", "critical"] = "alert"
    ack_allowed: bool = False
    takeover_timeout_s: int = Field(default=120, ge=30, le=900)
    sound: bool = False


class Frame(BaseModel):  # section 6: stored now, rendered by WDX (S7)
    model_config = ConfigDict(extra="forbid")
    enabled: bool = False
    folder: str | None = Field(default=None, max_length=200)
    idle_min: int = Field(default=10, ge=1, le=240)
    interval_s: int = Field(default=30, ge=5, le=600)
    fit: Literal["contain", "cover"] = "contain"
    clock: bool = True
    motion: Literal["none", "slow"] = "none"


class BurnIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shift: bool = True
    dim_after_min: int = Field(default=30, ge=0, le=720)
    dim_to: float = Field(default=0.6, ge=0.2, le=1.0)
    shuffle_h: int = Field(default=1, ge=0, le=24)


class Window(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    days: list[int] = Field(min_length=1, max_length=7)  # 0 = Sunday ... 6 = Saturday
    from_: str = Field(alias="from", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    to: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    windows: list[Window] = Field(default_factory=list, max_length=21)  # awake windows; empty = always on
    wake_on_alert_severity: Literal["alert", "critical"] = "critical"
    wake_on_touch: bool = True


class Offline(BaseModel):
    model_config = ConfigDict(extra="forbid")
    show_last_frame_s: int = Field(default=60, ge=10, le=600)
    then: Literal["clock"] = "clock"


class Grid(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cols: int = Field(ge=1, le=3)
    rows: int = Field(ge=1, le=3)


class WallConfig(BaseModel):
    """Section 4. The camera ORDER lives here; who may watch is the user's bindings."""
    model_config = ConfigDict(extra="forbid")
    cameras: list[str] = Field(default_factory=list, max_length=MAX_CAMERAS)
    scope: Literal["floor", "cameras"] = "cameras"  # floor = one floor-scope binding ("everything on this floor"), cameras = camera-scope bindings
    layout: Literal["auto", "tablet-landscape", "tablet-portrait", "single"] = "auto"
    grid: Literal["auto"] | Grid = "auto"
    rotate_s: Literal[0, 15, 30, 60, 120] = 0
    stream: Literal["sub"] = "sub"
    strip: list[Literal["clock", "date", "weather", "alarm", "health"]] = Field(default_factory=lambda: ["clock", "date", "health"], max_length=8)
    state_entities: list[str] = Field(default_factory=list, max_length=MAX_STATE_ENTITIES)
    show_map: bool = False
    theme: Literal["follow", "dark", "light"] = "dark"
    alerts: Alerts = Field(default_factory=Alerts)
    frame: Frame = Field(default_factory=Frame)
    burn_in: BurnIn = Field(default_factory=BurnIn)
    schedule: Schedule = Field(default_factory=Schedule)
    offline: Offline = Field(default_factory=Offline)


def default_config() -> dict[str, Any]:
    return WallConfig().model_dump(by_alias=True)


# ---- who is connected (in memory: a restart simply shows "not connected" until the display reconnects)
_lock = threading.Lock()
_open: dict[str, int] = {}
_hello: dict[str, dict[str, str]] = {}


def socket_opened(user_id: str) -> None:
    with _lock:
        _open[user_id] = _open.get(user_id, 0) + 1


def socket_closed(user_id: str) -> None:
    with _lock:
        _open[user_id] = max(0, _open.get(user_id, 0) - 1)


def connected_count(user_id: str) -> int:
    with _lock:
        return _open.get(user_id, 0)


def remember_hello(user_id: str, info: dict[str, Any]) -> None:
    with _lock:
        _hello[user_id] = {k: str(v)[:40] for k, v in info.items() if k in ("class", "screen")}


def last_hello(user_id: str) -> dict[str, str]:
    with _lock:
        return dict(_hello.get(user_id, {}))


# ---- profiles
def profile_row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM wall_profiles WHERE user_id = ?", (user_id,)).fetchone()


def enabled_profile(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    row = profile_row(conn, user_id)
    return row if row is not None and row["enabled"] else None


def me_block(conn: sqlite3.Connection, user_id: str) -> dict[str, Any] | None:
    """The `wall` entry of GET /me: presence only, never the configuration (that is fetched in wall mode)."""
    row = enabled_profile(conn, user_id)
    return None if row is None else {"enabled": True, "profile_version": int(row["version"])}


def config_of(row: sqlite3.Row) -> dict[str, Any]:
    try:
        return WallConfig.model_validate(json.loads(row["config_json"] or "{}")).model_dump(by_alias=True)
    except Exception:  # noqa: BLE001 - a stored row that no longer validates falls back to the defaults, never a 500 on a wall
        return default_config()


def max_profiles(conn: sqlite3.Connection) -> int:
    try:
        return int(get_setting(conn, "wall.max_profiles", str(MAX_PROFILES_DEFAULT)) or MAX_PROFILES_DEFAULT)
    except ValueError:
        return MAX_PROFILES_DEFAULT


def status_of(row: sqlite3.Row) -> str:
    """The list's status column: disabled / connected / not_connected / never."""
    if not row["enabled"]:
        return "disabled"
    if connected_count(row["user_id"]) > 0:
        return "connected"
    return "never" if not row["last_seen_at"] else "not_connected"


def profile_dict(conn: sqlite3.Connection, row: sqlite3.Row, names: dict[str, str] | None = None) -> dict[str, Any]:
    cfg = config_of(row)
    user = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (row["user_id"],)).fetchone()
    ha = conn.execute("SELECT username, name FROM ha_users WHERE id = ?", (row["user_id"],)).fetchone()
    username = (user["username"] if user else None) or (ha["username"] if ha else None) or ""
    display = (user["display_name"] if user else None) or (ha["name"] if ha else None) or username
    return {
        "user_id": row["user_id"], "username": username, "display_name": display, "title": row["title"],
        "area_id": row["area_id"], "floor_id": row["floor_id"], "enabled": bool(row["enabled"]), "remote_allowed": bool(row["remote_allowed"]),
        "version": int(row["version"]), "config": cfg, "status": status_of(row), "connections": connected_count(row["user_id"]),
        "last_seen_at": row["last_seen_at"], "last_channel": row["last_channel"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "camera_names": [(names or {}).get(c, c) for c in cfg.get("cameras", [])],
    }


def touch_seen(conn: sqlite3.Connection, user_id: str, channel: str) -> None:
    conn.execute("UPDATE wall_profiles SET last_seen_at = ?, last_channel = ? WHERE user_id = ?", (now_iso(), channel if channel in ("local", "remote") else "local", user_id))


def remote_refusal_needed(conn: sqlite3.Connection, user_id: str) -> bool:
    """Section 3.5: a wall user on the remote channel is refused unless the profile allows it. A disabled profile is a
    plain user again (the tablet drops to the normal application), so only an enabled profile restricts."""
    try:
        row = conn.execute("SELECT remote_allowed FROM wall_profiles WHERE user_id = ? AND enabled = 1", (user_id,)).fetchone()
    except sqlite3.OperationalError:  # before migration 0062
        return False
    return row is not None and not row["remote_allowed"]


def dumps(cfg: dict[str, Any]) -> str:
    return json.dumps(cfg, ensure_ascii=False, separators=(",", ":"))
