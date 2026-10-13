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
import re
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


def int_range(lo: int, hi: int) -> Callable[[Any], int]:
    def check(v: Any) -> int:
        if isinstance(v, bool) or not isinstance(v, int):
            raise ValueError("integer")
        if not lo <= v <= hi:
            raise ValueError("range")
        return v

    return check


def boolean(v: Any) -> bool:
    if not isinstance(v, bool):
        raise ValueError("boolean")
    return v


_HHMM = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")


def send_hours(v: Any) -> dict[str, str]:
    """D4 / 14.1: a local-time window `{"from": "HH:MM", "to": "HH:MM"}`, every day, in the installation's time zone. `from` must be
    earlier than `to`: a window across midnight is refused in release 1, and `from == to` (an empty window) too."""
    if not isinstance(v, dict) or set(v) != {"from", "to"}:
        raise ValueError("shape")
    a, b = v["from"], v["to"]
    if not isinstance(a, str) or not isinstance(b, str) or not _HHMM.match(a) or not _HHMM.match(b):
        raise ValueError("time")
    if a >= b:
        raise ValueError("order")
    return {"from": a, "to": b}


def _org_name(v: Any) -> str:
    """Slice 4: the organisation name the handler page shows at the top - plain text, controls / bidi marks stripped."""
    from .text_hygiene import clean_text

    if not isinstance(v, str):
        raise ValueError("type")
    text = clean_text(v)
    if len(text) > 80 or "{" in text or "}" in text:
        raise ValueError("invalid")
    return text


def _base_url(v: Any) -> str:
    """Slice 4: the public address of the handler page (`https://<host>`, spec 14.1); empty = not configured."""
    from .links import PublicUrlError, validate_public_base_url

    if v == "":
        return ""
    try:
        return validate_public_base_url(v)
    except PublicUrlError as exc:
        raise ValueError(exc.code) from None


def _cidrs(v: Any) -> list[str]:
    """Slice 4: the peers whose client-address header is believed (spec 10.2, review T1a); at most 8, none broader than /8."""
    from .ratelimit import parse_trusted_cidrs

    if not isinstance(v, list) or len(v) > 8 or not all(isinstance(x, str) and 0 < len(x) <= 64 for x in v):
        raise ValueError("invalid")
    nets = parse_trusted_cidrs(v)
    if len(nets) != len(v):
        raise ValueError("invalid")
    return [str(n) for n in nets]


# section 14.1 / D5: link lifetime ranges (shared with the per-department overrides, services/tickets/policy.py)
SLIDING_DAYS = (1, 90)
CAP_DAYS = (7, 365)
GRACE_HOURS = (0, 168)

SCHEMA: dict[tuple[str, ...], tuple[Any, Callable[[Any], Any]]] = {
    ("ui", "detail"): ("drawer_fullscreen", _choice("drawer", "fullscreen", "drawer_fullscreen")),  # D18
    ("ui", "new_ticket"): ("sheet", _choice("sheet", "dialog")),  # D22
    # slice 2 (CR-038 section 14.1): the installation values the department overrides fall back to
    ("links", "sliding_days"): (14, int_range(*SLIDING_DAYS)),  # D5
    ("links", "cap_days"): (90, int_range(*CAP_DAYS)),  # D5, >= sliding_days (checked across keys below)
    ("links", "grace_hours"): (24, int_range(*GRACE_HOURS)),  # D5
    ("send_hours",): ({"from": "07:00", "to": "21:00"}, send_hours),  # D4
    ("urgent_is_critical",): (True, boolean),  # D28
    # slice 4: the handler page (section 10 / 14.1)
    ("organization_name",): ("", _org_name),
    ("public", "base_url"): ("", _base_url),
    ("public", "trusted_proxy_cidrs"): (["172.30.32.0/23"], _cidrs),
    # where a trusted proxy puts the client address (code review V3): cloudflared's header, or another proxy's X-Forwarded-For
    ("public", "client_ip_header"): ("cf-connecting-ip", _choice("cf-connecting-ip", "x-forwarded-for")),
}


def _cross_problem(doc: dict[str, Any]) -> str | None:
    """A rule over several keys: the link cap is never shorter than the sliding window (section 14.1)."""
    links = doc.get("links") or {}
    if links.get("cap_days", 0) < links.get("sliding_days", 0):
        return "links.cap_days:below_sliding"
    return None


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
    if _cross_problem(out):  # a stored pair that breaks the cross-key rule reads as the default pair (fail safe)
        for path in (("links", "sliding_days"), ("links", "cap_days")):
            _set(out, path, SCHEMA[path][0])
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
        _set(current, path, clean)
    problem = _cross_problem(current)
    if problem:
        raise ValueError(problem)
    stored["revision"] = current["revision"] + 1
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(stored, ensure_ascii=False, separators=(",", ":"))))
    return read(conn), changed
