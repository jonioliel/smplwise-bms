"""ANNOUNCEB-295 (voice announcements, stage B): the announcement TEXT is also shown on screens.

A screen is a display surface of Arx itself: a notice TV board (`board:<id>`, the tokenised lobby page) or a wall display (`wall:<user id>`, the
kiosk wall of a wall profile). An administrator allows screens one by one (`announce.screens.targets`); nothing is allowed by default and the whole
feature is OFF by default (`announce.screens.enabled`, and it needs `announce.enabled` too). Each allowed screen may carry an area and a linked
media screen device, so the SAME scopes as the speakers address it: `device` (the media screen it is linked to), `area` (its area) and `all`.
An unknown or not-allowed target is simply "no targets" - the caller never learns which.

The text shown is the text of the announcement (every language, one block per language, no translation). It follows the speakers' rules because it
is part of the same `announce()` call: the feature switch, the quiet hours (suppress refuses both, queue holds both, lower / allow show it), the
rate limits, the critical / emergency flag and the audit. What is editable in Settings (system.configure): the switch, whether a new announcement
is shown on screens by default, how long a normal and an emergency announcement stays, how often a screen asks, and the allowed screens.
The display side only READS: `active_for` (a board's feed block, a wall display's route). Nothing here ever reaches a physical device.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from typing import Any

from ..db import get_setting
from .timeutil import iso_utc

K_ENABLED, K_TARGETS, K_DEFAULT_ON = "announce.screens.enabled", "announce.screens.targets", "announce.screens.default_on"
K_SECONDS, K_CRIT_SECONDS, K_POLL = "announce.screens.seconds", "announce.screens.critical_seconds", "announce.screens.poll_s"
DEFAULTS = {K_ENABLED: "false", K_TARGETS: "[]", K_DEFAULT_ON: "true", K_SECONDS: "30", K_CRIT_SECONDS: "180", K_POLL: "5"}
SECONDS_RANGE, CRIT_RANGE, POLL_RANGE = (5, 600), (10, 3600), (2, 30)
MAX_TARGETS = 100
KEY_RE = re.compile(r"^(board|wall):[A-Za-z0-9_-]{1,64}$")
SETTING_KEYS = ("enabled", "default_on", "seconds", "critical_seconds", "poll_s", "targets")


def _int(raw: Any, default: str, lo_hi: tuple[int, int]) -> int:
    try:
        return min(lo_hi[1], max(lo_hi[0], int(raw)))
    except (TypeError, ValueError):
        return int(default)


def _targets(raw: Any) -> list[dict[str, Any]]:
    try:
        data = json.loads(raw or "[]")
    except ValueError:
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for t in data if isinstance(data, list) else []:
        if not isinstance(t, dict) or not isinstance(t.get("key"), str) or not KEY_RE.match(t["key"]) or t["key"] in seen:
            continue
        seen.add(t["key"])
        area, dev = t.get("area_id"), t.get("device_key")
        out.append({"key": t["key"], "area_id": area if isinstance(area, str) and 0 < len(area) <= 64 else None,
                    "device_key": dev if isinstance(dev, str) and 0 < len(dev) <= 64 else None})
    return out[:MAX_TARGETS]


def config(conn: sqlite3.Connection) -> dict[str, Any]:
    def g(k: str) -> str:
        return get_setting(conn, k, DEFAULTS[k]) or DEFAULTS[k]

    return {"enabled": g(K_ENABLED) == "true", "default_on": g(K_DEFAULT_ON) == "true", "seconds": _int(g(K_SECONDS), DEFAULTS[K_SECONDS], SECONDS_RANGE),
            "critical_seconds": _int(g(K_CRIT_SECONDS), DEFAULTS[K_CRIT_SECONDS], CRIT_RANGE), "poll_s": _int(g(K_POLL), DEFAULTS[K_POLL], POLL_RANGE),
            "targets": _targets(g(K_TARGETS))}


def feature_on(conn: sqlite3.Connection) -> bool:
    """Screens show announcements only while the voice announcements feature AND the screens switch are both on."""
    return (get_setting(conn, "announce.enabled", "false") or "false") == "true" and config(conn)["enabled"]


def merge(conn: sqlite3.Connection, body: Any) -> dict[str, str]:
    """PUT config `screens` (system.configure): every key optional; returns the settings to store. Raises ValueError(field) on a bad value."""
    if not isinstance(body, dict) or set(body) - set(SETTING_KEYS):
        raise ValueError("screens")
    out: dict[str, str] = {}
    for name, value in body.items():
        if name in ("enabled", "default_on"):
            if not isinstance(value, bool):
                raise ValueError(f"screens.{name}")
            out[K_ENABLED if name == "enabled" else K_DEFAULT_ON] = "true" if value else "false"
        elif name in ("seconds", "critical_seconds", "poll_s"):
            lo, hi = {"seconds": SECONDS_RANGE, "critical_seconds": CRIT_RANGE, "poll_s": POLL_RANGE}[name]
            if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
                raise ValueError(f"screens.{name}")
            out[{"seconds": K_SECONDS, "critical_seconds": K_CRIT_SECONDS, "poll_s": K_POLL}[name]] = str(value)
        else:  # targets
            if not isinstance(value, list) or len(value) > MAX_TARGETS:
                raise ValueError("screens.targets")
            known = {s["key"] for s in candidates(conn)}
            devices = _screen_devices(conn)
            clean: list[dict[str, Any]] = []
            for t in value:
                if not isinstance(t, dict) or set(t) - {"key", "area_id", "device_key"} or not isinstance(t.get("key"), str) or t["key"] not in known \
                        or any(t["key"] == c["key"] for c in clean):
                    raise ValueError("screens.targets")
                area, dev = t.get("area_id") or None, t.get("device_key") or None
                if (area is not None and (not isinstance(area, str) or len(area) > 64)) or (dev is not None and (not isinstance(dev, str) or dev not in devices)):
                    raise ValueError("screens.targets")
                clean.append({"key": t["key"], "area_id": area, "device_key": dev})
            out[K_TARGETS] = json.dumps(clean)
    return out


def _screen_devices(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """The approved media screens (TVs) by device key: `{name, area_id, area_name, floor_name}` - what a target can be linked to."""
    from . import media_store as store

    out: dict[str, dict[str, Any]] = {}
    for item in store.load_catalog(conn, approved_only=True, kind="screen").items.values():
        a = store.floor_area(item)
        out[item.key] = {"name": item.name, "area_id": a["area_id"], "area_name": a["area_name"], "floor_name": a["floor_name"]}
    return out


def candidates(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every display surface that could show an announcement: the notice TV boards (while the notices module is on) and the enabled wall profiles."""
    from .notices import store as nstore

    out: list[dict[str, Any]] = []
    if nstore.module_on(conn):
        for b in nstore.list_boards(conn):
            out.append({"key": f"board:{b['id']}", "kind": "board", "name": b["name"], "area_id": None})
    for r in conn.execute("SELECT user_id, title, area_id FROM wall_profiles WHERE enabled = 1 ORDER BY title, user_id").fetchall():
        out.append({"key": f"wall:{r['user_id']}", "kind": "wall", "name": r["title"], "area_id": r["area_id"]})
    return out


def admin_screens(conn: sqlite3.Connection) -> dict[str, Any]:
    """Settings (system.configure): the candidates with their allowed state, and the media screens a target can be linked to."""
    allowed = {t["key"]: t for t in config(conn)["targets"]}
    rows = []
    for c in candidates(conn):
        t = allowed.get(c["key"])
        rows.append({**c, "allowed": t is not None, "area_id": (t or {}).get("area_id") or c["area_id"], "device_key": (t or {}).get("device_key")})
    devs = _screen_devices(conn)
    return {"screens": rows, "devices": [{"key": k, "name": v["name"], "area_id": v["area_id"]} for k, v in sorted(devs.items(), key=lambda kv: kv[1]["name"] or "")]}


def resolve(conn: sqlite3.Connection, scope: str, ref: str) -> list[str]:
    """The screen keys an announcement to `scope` (`device` | `area` | `all`) `ref` reaches: allowed by the administrator and still existing."""
    cfg = config(conn)
    if not cfg["enabled"]:
        return []
    live = {c["key"] for c in candidates(conn)}
    out = []
    for t in cfg["targets"]:
        if t["key"] not in live:
            continue
        if scope == "all" or (scope == "device" and t["device_key"] == ref) or (scope == "area" and t["area_id"] == ref):
            out.append(t["key"])
    return out


def areas(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """The areas the allowed screens sit in (the announce form lists them next to the speakers' rooms): `{area_id, name, floor_name, screens: n}`."""
    cfg = config(conn)
    if not cfg["enabled"]:
        return []
    devs = _screen_devices(conn)
    live = {c["key"] for c in candidates(conn)}
    by: dict[str, dict[str, Any]] = {}
    for t in cfg["targets"]:
        if t["key"] not in live or not t["area_id"]:
            continue
        meta = next((v for v in devs.values() if v["area_id"] == t["area_id"]), None) or {}
        row = by.setdefault(t["area_id"], {"area_id": t["area_id"], "name": meta.get("area_name") or t["area_id"], "floor_name": meta.get("floor_name"), "screens": 0})
        row["screens"] += 1
    return list(by.values())


def until(conn: sqlite3.Connection, now: dt.datetime, critical: bool) -> str:
    cfg = config(conn)
    return iso_utc(now + dt.timedelta(seconds=cfg["critical_seconds"] if critical else cfg["seconds"]))


def mark(conn: sqlite3.Connection, announcement_id: str, keys: list[str], now: dt.datetime, critical: bool) -> None:
    conn.execute("UPDATE announcements SET screens_json = ?, screen_until = ? WHERE id = ?", (json.dumps(keys), until(conn, now, critical), announcement_id))


def stop(conn: sqlite3.Connection, announcement_id: str, now: dt.datetime) -> bool:
    """Stop showing an announcement now (the speech, if any, is not touched). False when it was not being shown."""
    cur = conn.execute("UPDATE announcements SET screen_until = ? WHERE id = ? AND screen_until IS NOT NULL AND screen_until > ?", (iso_utc(now), announcement_id, iso_utc(now)))
    return cur.rowcount > 0


def active_for(conn: sqlite3.Connection, key: str, now: dt.datetime) -> dict[str, Any] | None:
    """The announcement a screen shows right now (an emergency first, then the newest), or None. Public fields only: no author, no targets."""
    if not feature_on(conn) or not any(t["key"] == key for t in config(conn)["targets"]):
        return None
    row = conn.execute(
        "SELECT id, at, critical, screen_until, texts_json FROM announcements WHERE screen_until > ? AND status IN ('pending', 'sent', 'failed') "
        "AND EXISTS (SELECT 1 FROM json_each(screens_json) WHERE value = ?) ORDER BY critical DESC, at DESC, rowid DESC LIMIT 1", (iso_utc(now), key)).fetchone()
    if row is None:
        return None
    try:
        parts = [{"language": p[0], "text": p[1]} for p in json.loads(row["texts_json"] or "[]") if isinstance(p, list) and len(p) == 2 and p[1]]
    except ValueError:
        parts = []
    if not parts:
        return None
    return {"id": row["id"], "critical": bool(row["critical"]), "at": row["at"], "until": row["screen_until"], "texts": parts}
