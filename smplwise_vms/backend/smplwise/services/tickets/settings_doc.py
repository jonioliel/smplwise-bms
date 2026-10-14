"""CR-038 section 14.1: the `tickets.settings` document (JSON in the `settings` table, revision-checked, edited with
`system.configure`). NOT in routers/settings.DEFAULTS (so `GET /settings`, readable by every signed-in user, never carries it) and
kept out of project backups (backup.SETTINGS_KEEP).

Slice 1 owns the keys it uses - the display settings D18 (how a ticket opens) and D22 (how "new" opens). Each later slice adds its
own block to SCHEMA (links, send hours, code, whatsapp, costs, device_long_press, the D19-D21 display keys, retention) with its
validator; keys this version does not know are kept as stored (a newer document survives an older reader) but never served.
A corrupt or invalid value reads as the default (fail safe)."""
from __future__ import annotations

import copy
import json
import sqlite3
from typing import Any, Callable

SETTING_KEY = "tickets.settings"

# key path -> (default, validator returning the clean value or raising ValueError)
def _choice(*allowed: str) -> Callable[[Any], str]:
    def check(v: Any) -> str:
        if v not in allowed:
            raise ValueError("choice")
        return v

    return check


SCHEMA: dict[tuple[str, ...], tuple[Any, Callable[[Any], Any]]] = {
    ("ui", "detail"): ("drawer_fullscreen", _choice("drawer", "fullscreen", "drawer_fullscreen")),  # D18
    ("ui", "new_ticket"): ("sheet", _choice("sheet", "dialog")),  # D22
}


def _get(doc: dict[str, Any], path: tuple[str, ...]) -> Any:
    cur: Any = doc
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def _set(doc: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    cur = doc
    for p in path[:-1]:
        nxt = cur.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[p] = nxt
        cur = nxt
    cur[path[-1]] = value


def _stored(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    try:
        doc = json.loads(row[0]) if row else {}
    except (ValueError, TypeError):
        doc = {}
    return doc if isinstance(doc, dict) else {}


def read(conn: sqlite3.Connection) -> dict[str, Any]:
    """The known keys with their stored (valid) value or default, and the revision (0 = never saved)."""
    stored = _stored(conn)
    out: dict[str, Any] = {}
    rev = stored.get("revision")
    out["revision"] = rev if isinstance(rev, int) and not isinstance(rev, bool) and rev >= 0 else 0
    for path, (default, check) in SCHEMA.items():
        raw = _get(stored, path)
        try:
            value = check(raw) if raw is not None else copy.deepcopy(default)
        except ValueError:
            value = copy.deepcopy(default)
        _set(out, path, value)
    return out


def apply_patch(conn: sqlite3.Connection, patch: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Validate a partial update (nested dicts of known keys) and write it. Returns (the new document, the changed key paths).
    Raises ValueError("unknown:<path>") / ValueError("<path>:<code>")."""
    flat: dict[tuple[str, ...], Any] = {}

    def walk(prefix: tuple[str, ...], node: Any) -> None:
        if isinstance(node, dict) and prefix not in SCHEMA:
            for k, v in node.items():
                walk(prefix + (str(k),), v)
            return
        if prefix not in SCHEMA:
            raise ValueError(f"unknown:{'.'.join(prefix)}")
        flat[prefix] = node

    walk((), patch)
    stored = _stored(conn)
    current = read(conn)
    changed: list[str] = []
    for path, value in flat.items():
        try:
            clean = SCHEMA[path][1](value)
        except ValueError as exc:
            raise ValueError(f"{'.'.join(path)}:{exc}") from None
        if _get(current, path) != clean:
            changed.append(".".join(path))
        _set(stored, path, clean)
    stored["revision"] = current["revision"] + 1
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(stored, ensure_ascii=False, separators=(",", ":"))))
    return read(conn), changed
