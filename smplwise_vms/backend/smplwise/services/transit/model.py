"""BUSTIMES-295 - settings of the bus-times feature. Pure functions: no database, no network.

Two levels (owner answers 2026-10-26, items 4 and 5):
* the INSTALLATION (`transit.config`, one JSON setting): the module switch, up to 4 stops, and the general rules - when minutes give way
  to a clock time, how long last-known data may be shown while the source is down, the walking-time offset;
* a SCREEN (`display.transit` inside the board's display JSON, no migration): whether it shows transit at all, which of the configured
  stops, one of three layouts, the window, the rows and the group-by-line choice."""
from __future__ import annotations

import json
import re
from typing import Any

CONFIG_KEY = "transit.config"
MAX_STOPS = 4
LAYOUTS = ("side", "strip", "slide")  # side column / bottom strip / rotating slide (mock-up layouts A / B / C)
GROUPS = ("auto", "always", "never")
WINDOW_CHOICES = (15, 30, 60, 120, 180)
WINDOW_RANGE = (5, 240)
ROWS_RANGE = (3, 10)
DWELL_RANGE = (6, 60)
CLOCK_AFTER_RANGE = (0, 240)  # minutes up to this, then the clock time; 0 = always the clock
GRACE_RANGE = (0, 240)  # minutes of last-known data while the source is down; 0 = none
WALK_RANGE = (0, 30)
STOP_NAME_MAX = 60
FRESH_S = 180  # the floor of "fresh": a cache younger than max(this, 3 x the poll interval) is fresh
POLL_RANGE = (15, 300)  # seconds between two polls of the public source, per distinct stop (installation)
POLL_FLOOR_S = 30  # Stride is a community service: below this the owner must lower the interval knowingly (`poll_floor_ack`)
REFRESH_RANGE = (10, 120)  # seconds between two fetches of the digest by a screen (installation default, per-screen override)
POSITION_FRESH_RANGE = (1, 30)  # minutes: a vehicle position older than this is not shown as an estimate (nor its distance)

CONFIG_DEFAULTS: dict[str, Any] = {"enabled": False, "stops": [], "clock_after_min": 60, "stale_grace_min": 30, "hide_closer_min": 0,
                                   "poll_s": 30, "poll_floor_ack": False, "refresh_s": 20, "position_fresh_min": 5, "show_distance": True}
SCREEN_DEFAULTS: dict[str, Any] = {"enabled": False, "stops": [], "layout": "side", "window_min": 60, "rows": 5, "group": "auto", "dwell_s": 15,
                                   "refresh_s": None, "show_distance": None}  # None = the installation's value


class Invalid(ValueError):
    """A value the API refuses (422); `field` names the offending key."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field


def _int(v: Any, lo: int, hi: int) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else None


def clean_code(v: Any) -> int | None:
    """A stop code: a positive integer (the Ministry's code as printed on the stop sign)."""
    if isinstance(v, str) and v.strip().isdigit():
        v = int(v.strip())
    return _int(v, 1, 99_999_999)


def clean_stop(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    code = clean_code(raw.get("code"))
    if code is None:
        return None
    name = raw.get("name")
    name = re.sub(r"\s+", " ", name).strip()[:STOP_NAME_MAX] if isinstance(name, str) and not any(ord(c) < 32 for c in name) else ""
    return {"code": code, "name": name}


def normalize_config(raw: Any, *, strict: bool = False) -> dict[str, Any]:
    """The stored / sent installation settings with every key present and inside its range. `strict` (an API save) refuses a bad value
    instead of replacing it by the default."""
    src = raw if isinstance(raw, dict) else {}
    out = json.loads(json.dumps(CONFIG_DEFAULTS))
    if "enabled" in src:
        if isinstance(src["enabled"], bool):
            out["enabled"] = src["enabled"]
        elif strict:
            raise Invalid("enabled", "ערך לא תקין.")
    if "stops" in src:
        stops = src["stops"] if isinstance(src["stops"], list) else []
        cleaned: list[dict[str, Any]] = []
        for s in stops:
            c = clean_stop(s)
            if c is None:
                if strict:
                    raise Invalid("stops", "קוד תחנה לא תקין.")
                continue
            if any(x["code"] == c["code"] for x in cleaned):
                if strict:
                    raise Invalid("stops", "תחנה מופיעה פעמיים.")
                continue
            cleaned.append(c)
        if len(cleaned) > MAX_STOPS:
            if strict:
                raise Invalid("stops", f"עד {MAX_STOPS} תחנות.")
            cleaned = cleaned[:MAX_STOPS]
        out["stops"] = cleaned
    for key in ("poll_floor_ack", "show_distance"):
        if key in src:
            if isinstance(src[key], bool):
                out[key] = src[key]
            elif strict:
                raise Invalid(key, "ערך לא תקין.")
    for key, rng, msg in (("poll_s", POLL_RANGE, "שניות בין 15 ל-300."), ("refresh_s", REFRESH_RANGE, "שניות בין 10 ל-120."),
                          ("position_fresh_min", POSITION_FRESH_RANGE, "דקות בין 1 ל-30.")):
        if key in src:
            v = _int(src[key], *rng)
            if v is not None:
                out[key] = v
            elif strict:
                raise Invalid(key, msg)
    if strict and out["poll_s"] < POLL_FLOOR_S and not out["poll_floor_ack"]:
        raise Invalid("poll_s", "מתחת ל-30 שניות נדרש אישור מפורש (poll_floor_ack): המקור הציבורי הוא שירות קהילתי.")
    for key, rng, msg in (("clock_after_min", CLOCK_AFTER_RANGE, "דקות בין 0 ל-240."), ("stale_grace_min", GRACE_RANGE, "דקות בין 0 ל-240."),
                          ("hide_closer_min", WALK_RANGE, "דקות בין 0 ל-30.")):
        if key in src:
            v = _int(src[key], *rng)
            if v is not None:
                out[key] = v
            elif strict:
                raise Invalid(key, msg)
    return out


def load_config(raw_json: str | None) -> dict[str, Any]:
    try:
        raw = json.loads(raw_json or "{}")
    except ValueError:
        raw = {}
    return normalize_config(raw)


def normalize_screen(raw: Any, *, strict: bool = False) -> dict[str, Any]:
    """The per-screen block of a board's display settings (`display.transit`)."""
    src = raw if isinstance(raw, dict) else {}
    out = json.loads(json.dumps(SCREEN_DEFAULTS))

    def bad(key: str) -> None:
        if strict:
            raise Invalid(f"display.transit.{key}", "ערך לא תקין.")

    if "enabled" in src:
        if isinstance(src["enabled"], bool):
            out["enabled"] = src["enabled"]
        else:
            bad("enabled")
    if "stops" in src:
        codes = src["stops"] if isinstance(src["stops"], list) else None
        cleaned = [clean_code(c) for c in codes] if codes is not None else None
        if cleaned is None or any(c is None for c in cleaned) or len(set(cleaned)) != len(cleaned) or len(cleaned) > MAX_STOPS:
            bad("stops")
        else:
            out["stops"] = cleaned
    if "layout" in src:
        if src["layout"] in LAYOUTS:
            out["layout"] = src["layout"]
        else:
            bad("layout")
    if "group" in src:
        if src["group"] in GROUPS:
            out["group"] = src["group"]
        else:
            bad("group")
    if "show_distance" in src:
        if src["show_distance"] is None or isinstance(src["show_distance"], bool):
            out["show_distance"] = src["show_distance"]
        else:
            bad("show_distance")
    if "refresh_s" in src and src["refresh_s"] is not None:
        v = _int(src["refresh_s"], *REFRESH_RANGE)
        if v is not None:
            out["refresh_s"] = v
        else:
            bad("refresh_s")
    for key, rng in (("window_min", WINDOW_RANGE), ("rows", ROWS_RANGE), ("dwell_s", DWELL_RANGE)):
        if key in src:
            v = _int(src[key], *rng)
            if v is not None:
                out[key] = v
            else:
                bad(key)
    return out


def poll_s(config: dict[str, Any]) -> int:
    """The poll interval in force: below the Stride floor only when the owner acknowledged it."""
    v = int(config.get("poll_s") or CONFIG_DEFAULTS["poll_s"])
    return v if config.get("poll_floor_ack") else max(v, POLL_FLOOR_S)


def fresh_s(config: dict[str, Any]) -> int:
    """A cache younger than this is `fresh`: it keeps the 3-minute floor and follows a slower poll (3 x the interval)."""
    return max(FRESH_S, 3 * poll_s(config))


def position_fresh_s(config: dict[str, Any]) -> int:
    return int(config.get("position_fresh_min") or CONFIG_DEFAULTS["position_fresh_min"]) * 60


def screen_refresh_s(config: dict[str, Any], screen: dict[str, Any]) -> int:
    return int(screen.get("refresh_s") or config.get("refresh_s") or CONFIG_DEFAULTS["refresh_s"])


def show_distance(config: dict[str, Any], screen: dict[str, Any]) -> bool:
    v = screen.get("show_distance")
    return bool(config.get("show_distance", True)) if v is None else bool(v)


def selection(config: dict[str, Any], screen: dict[str, Any]) -> list[int]:
    """The stop codes a screen shows, in the installation's order: the screen's own pick, or (an empty pick) every configured stop. A code the
    installation no longer lists is ignored."""
    configured = [s["code"] for s in config.get("stops") or []]
    picked = screen.get("stops") or []
    return [c for c in configured if not picked or c in picked]


def iso_utc(t: Any) -> str:
    import datetime as dt

    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
