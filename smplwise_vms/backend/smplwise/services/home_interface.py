"""HOME-SIMPLE-2420: the home interface ("ממשק ביתי") - a second, simpler, room-centred interface next to the full one.

What lives here (owner request 2026-11-10 and the round-25 mockup decisions):

* The per-person interface policy an administrator sets in user management: which interface opens first, whether the personal menu
  offers the switch, whether the person may never open the full interface (`home_only`), the wall-panel lock (`kiosk`: home only,
  locked to one room, no personal menu, leaving needs the administrator's exit code) and which rooms / modules the home interface
  shows. No row = `default_policy`: home for a regular user, full for an administrator (system.configure installation-wide).
* `enforce`: the server half of `home_only`, called by auth._principal on every authenticated request (the presence gate's pattern).
  A home-only person reaches only the API areas the home interface uses (HOME_ALLOWED_*); every other route is refused 403
  `home_interface_only`, audited at most once per person per GATE_AUDIT_EVERY_S. This is a restriction ON TOP of the role model -
  it never grants anything: every allowed route still checks its own permission.
* The person's own favourites per room and layout choices, and the administrator's starting favourites (the seed).

Nothing here talks to Home Assistant or any device. HA users, groups and admin flags are never touched.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from typing import Any

from ..db import get_setting, now_iso, set_setting
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, is_system_admin

INTERFACES = ("home", "full")
# the home interface's categories an administrator can hide (the mockup's admin page; "scenes" and "security" added: the alarm panel
# is shown only where Arx already has the alarm integration and the person holds alarm.view)
MODULES = ("lights", "climate", "shades", "doors", "cameras", "energy", "alerts", "scenes", "security")
ROOM_KEY_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,128}$")
FAV_TYPES = ("scene", "light", "switch", "climate", "shade", "cam", "door", "allLights", "energy", "security")
FAV_ID_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,200}$")
MAX_FAV_PER_ROOM = 48
MAX_FAV_ROOMS = 200
MAX_ROOM_LIST = 500
LAYOUT_START = ("home", "last", "fixed")
SCHEMES = ("dark", "light", "auto")
THEME_RE = re.compile(r"^[a-z0-9-]{1,32}$")
KIOSK_CODE_RE = re.compile(r"^[0-9]{4,8}$")
KIOSK_CODE_KEY = "home.kiosk_exit_code"
KIOSK_TRIES = 5
KIOSK_WINDOW_S = 300.0
GATE_AUDIT_EVERY_S = 300.0

# HOME-SIMPLE-2421 (owner 2026-11-10): installation settings of the home interface (settings rows; rbac.assign; audited)
# - default_mode: the interface of a person nobody configured yet: full for everyone (the default), home for regular users and full
#   for administrators (the 2.42.0 rule), or a choice screen at the first sign-in.
# - kiosk_exit: a wall panel leaves with the administrator's code (the default), or never (locked to its room, no exit at all).
# - wallpaper: the room screens' background: none (the default), the built-in gallery, or the gallery plus a personal picture per room.
INSTALL_KEYS = {"default_mode": "home.default_mode", "kiosk_exit": "home.kiosk_exit", "wallpaper": "home.wallpaper"}
INSTALL_VALUES: dict[str, tuple[str, ...]] = {
    "default_mode": ("full_all", "home_regular", "choose"),
    "kiosk_exit": ("code", "none"),
    "wallpaper": ("none", "gallery", "gallery_image"),
}
LEGACY_FROZEN_BY = "migration:0212"
# the built-in gallery (drawn by the frontend from CSS gradients only - no picture files); the server only checks the names
GALLERY = ("dusk", "tide", "dune", "moss", "ember", "slate", "aurora", "linen")
WALL_RE = re.compile(r"^(g:[a-z0-9-]{1,32}|img)$")
WALL_IMAGE_BYTES, WALL_IMAGE_SIDE = 2_000_000, 1920

API_PREFIX = "/api/v1"
# What a home-only person may call: the routes the home interface itself uses (plus sign-in, health and the phone app's own
# registration). Exact routes and whole-segment prefixes only, never a substring (the presence gate's rule).
HOME_ALLOWED_EXACT = frozenset((
    "/me", "/health", "/csp-report", "/presence", "/notifications", "/notifications/summary", "/notifications/read-all",
    "/notifications/devices", "/notifications/categories",
    "/devices/tree", "/devices/items", "/devices/entities", "/devices/actions", "/devices/actions/preview",
    "/automations", "/automations/status", "/cameras", "/energy/meters", "/energy/consumption",
    "/intercom/calls", "/intercom/calls/active", "/intercom/ws", "/intercom/overview", "/energy/tariffs", "/alarm/panels", "/ha/ws",
))
HOME_ALLOWED_PREFIXES = (
    "/me/", "/home/", "/auth/", "/presence/", "/health/", "/notifications/",
    "/devices/areas/", "/devices/actions/", "/devices/camera-card/",
    "/ha/entities/", "/ha/actions/",
    "/automations/scene/",
    "/intercom/stations/", "/intercom/calls/", "/access-control/stations/",
    "/cameras/", "/media/", "/energy/meters/", "/alarm/panels/",
)
# inside an allowed prefix, the administrative leaves stay refused (a home-only person never edits a device's type, protection or area)
HOME_REFUSED_SUFFIXES = ("/device-type", "/bulk-protected", "/bulk-on", "/climate-kind", "/area")
# Routes a home-only person may READ only (GET / HEAD): the same path also carries a write the home interface never makes.
HOME_READ_ONLY_EXACT: frozenset[str] = frozenset()
HOME_READ_ONLY_PREFIXES: tuple[str, ...] = ()
# Routes allowed only to a home-only person whose policy carries the named per-person flag: {flag: (exact, prefixes, refused leaves)}.
HOME_FLAG_ROUTES: dict[str, tuple[frozenset[str], tuple[str, ...], tuple[str, ...]]] = {}

# HOME-V3-P1-2430 (mockup v3, phase 1: security and intercom). Every route still checks its own permission.
HOME_ALLOWED_EXACT = HOME_ALLOWED_EXACT | {"/alarm/me", "/alarm/me/pin", "/playback/sessions"}
HOME_ALLOWED_PREFIXES = HOME_ALLOWED_PREFIXES + ("/playback/sessions/",)
HOME_READ_ONLY_EXACT = HOME_READ_ONLY_EXACT | {"/events", "/intercom/people"}
HOME_READ_ONLY_PREFIXES = HOME_READ_ONLY_PREFIXES + ("/events/",)
# the guest invitation (services/access_visitors): only for a person the home administrator marked; the visitor settings, the
# installation-wide revoke and the visitor-entrance flag stay refused
HOME_FLAG_ROUTES["guests"] = (frozenset({"/access/visitors"}), ("/access/visitors/",),
                              ("/access/visitors/settings", "/access/visitors/revoke-all", "/access/visitors/entrances"))

_LOCK = threading.Lock()
_GATE_AUDITED: dict[str, float] = {}
_KIOSK_FAILS: dict[str, list[float]] = {}


class HomeInterfaceError(ApiError):
    pass


# ---------------------------------------------------------------- policy

def is_admin(conn: sqlite3.Connection, user_id: str) -> bool:
    """An administrator for the default: system_admin, or system.configure installation-wide."""
    if is_system_admin(conn, user_id):
        return True
    p = Principal(user_id=user_id, username="", display_name="", source="")
    return authorize(conn, p, "system.configure", INSTALLATION).allowed


def install_settings(conn: sqlite3.Connection) -> dict[str, str]:
    """The installation settings of the home interface; an unknown or missing value reads as the default (the first one listed)."""
    out = {}
    for k, key in INSTALL_KEYS.items():
        v = get_setting(conn, key)
        out[k] = v if v in INSTALL_VALUES[k] else INSTALL_VALUES[k][0]
    return out


def set_install_settings(conn: sqlite3.Connection, body: dict[str, Any]) -> dict[str, str]:
    for k, v in body.items():
        if k not in INSTALL_KEYS or v not in INSTALL_VALUES[k]:
            raise HomeInterfaceError(422, "validation", "ערך לא מוכר בהגדרות הממשק הביתי.")
    for k, v in body.items():
        set_setting(conn, INSTALL_KEYS[k], v)
    return install_settings(conn)


def default_policy(admin: bool, mode: str = "full_all") -> dict[str, Any]:
    """A person nobody configured yet. HOME-SIMPLE-2421 (owner): full for everyone by default; `home_regular` is the 2.42.0 rule
    (home for a regular user, full for an administrator); `choose` opens the choice screen first (see effective). All may switch."""
    home = mode == "home_regular" and not admin
    return {"default_interface": "home" if home else "full", "may_switch": True, "home_only": False, "kiosk": False, "kiosk_area_id": None,
            "rooms": None, "modules": None, "current_interface": None, "guests": False}


def _loads(v: str | None) -> Any:
    if v is None:
        return None
    try:
        return json.loads(v)
    except ValueError:
        return None


def _row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM home_interface_policy WHERE user_id = ?", (user_id,)).fetchone()


def stored_policy(conn: sqlite3.Connection, user_id: str) -> dict[str, Any] | None:
    r = _row(conn, user_id)
    if r is None:
        return None
    rooms, modules = _loads(r["rooms_json"]), _loads(r["modules_json"])
    return {"default_interface": r["default_interface"], "may_switch": bool(r["may_switch"]), "home_only": bool(r["home_only"]) or bool(r["kiosk"]),
            "kiosk": bool(r["kiosk"]), "kiosk_area_id": r["kiosk_area_id"],
            "rooms": rooms if isinstance(rooms, list) else None, "modules": modules if isinstance(modules, list) else None,
            "current_interface": r["current_interface"], "updated_at": r["updated_at"], "updated_by": r["updated_by"],
            "guests": bool(r["guests"]) if "guests" in r.keys() else False}


def effective(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    """The policy that applies to this person now, and `interface`: the one to open. home_only / kiosk force home and no switch."""
    stored = stored_policy(conn, user_id)
    admin = is_admin(conn, user_id)
    inst = install_settings(conn)
    pol = stored if stored is not None else default_policy(admin, inst["default_mode"])
    home_only = bool(pol["home_only"])
    may_switch = bool(pol["may_switch"]) and not home_only
    default = "home" if home_only else pol["default_interface"]
    current = pol.get("current_interface") if may_switch else None
    # `choose`: a person nobody configured, who never chose, opens the home interface's choice screen (which saves the choice)
    choose = stored is None and inst["default_mode"] == "choose"
    if choose:
        current = "home"
    return {
        "default_interface": default,
        "may_switch": may_switch,
        "home_only": home_only,
        "kiosk": bool(pol["kiosk"]),
        "kiosk_area_id": pol["kiosk_area_id"] if pol["kiosk"] else None,
        "rooms": pol["rooms"],
        "modules": pol["modules"],
        "interface": current if current in INTERFACES else default,
        "configured": stored is not None,
        "admin": admin,
        "kiosk_code_set": bool(get_setting(conn, KIOSK_CODE_KEY)),
        "choose": choose,
        "kiosk_exit": inst["kiosk_exit"],
        "wallpaper": inst["wallpaper"],
        # HOME-V3-P1-2430: the administrator marked this person for guest invitations; the room wallpapers set for everyone
        "guests": bool(pol.get("guests")),
        "room_wallpapers": _room_walls(conn, inst["wallpaper"]),
    }


def _room_walls(conn: sqlite3.Connection, mode: str) -> dict[str, str]:
    from . import home_v3

    return home_v3.room_wallpapers(conn, mode)


def freeze_legacy_defaults(conn: sqlite3.Connection) -> int:
    """HOME-SIMPLE-2421, once (main.py, in the start that applied migration 0212): a person who arrived under 2.42.0 without a policy
    row had the 2.42.0 default (home for a regular user, full for an administrator). The new default (full for everyone) must not
    move them, so each such person gets an explicit row with what they had. Returns the number of rows written."""
    n = 0
    for u in conn.execute("SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM home_interface_policy)").fetchall():
        legacy = default_policy(is_admin(conn, u["id"]), "home_regular")
        conn.execute(
            "INSERT INTO home_interface_policy (user_id, default_interface, may_switch, home_only, kiosk, updated_at, updated_by) VALUES (?, ?, 1, 0, 0, ?, ?)",
            (u["id"], legacy["default_interface"], now_iso(), LEGACY_FROZEN_BY),
        )
        n += 1
    return n


def _clean_list(v: Any, allowed: tuple[str, ...] | None, what: str) -> list[str] | None:
    if v is None:
        return None
    if not isinstance(v, list) or len(v) > MAX_ROOM_LIST:
        raise HomeInterfaceError(422, "validation", f"רשימת {what} אינה תקינה.")
    out: list[str] = []
    for x in v:
        if not isinstance(x, str) or not ROOM_KEY_RE.match(x) or (allowed is not None and x not in allowed):
            raise HomeInterfaceError(422, "validation", f"ערך לא מוכר ברשימת {what}.")
        if x not in out:
            out.append(x)
    return out


def set_policy(conn: sqlite3.Connection, actor: Principal, user_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """An administrator's change of one person's policy (the caller already holds rbac.assign). A system administrator can never be
    made home-only (nobody locks the installation's own administrator out of the full interface), and kiosk implies home-only."""
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is None:
        raise HomeInterfaceError(404, "not_found", "המשתמש לא נמצא.")
    cur = stored_policy(conn, user_id) or default_policy(is_admin(conn, user_id), install_settings(conn)["default_mode"])
    merged = {**cur}
    for k in ("default_interface", "may_switch", "home_only", "kiosk", "kiosk_area_id", "guests"):
        if k in body and body[k] is not None:
            merged[k] = body[k]
    if "rooms" in body:
        merged["rooms"] = _clean_list(body["rooms"], None, "החדרים")
    if "modules" in body:
        merged["modules"] = _clean_list(body["modules"], MODULES, "הקטגוריות")
    if merged["default_interface"] not in INTERFACES:
        raise HomeInterfaceError(422, "validation", "ממשק לא מוכר.")
    if merged.get("kiosk_area_id") is not None and (not isinstance(merged["kiosk_area_id"], str) or not ROOM_KEY_RE.match(merged["kiosk_area_id"])):
        raise HomeInterfaceError(422, "validation", "החדר של מסך הקיר אינו תקין.")
    kiosk = bool(merged["kiosk"])
    home_only = bool(merged["home_only"]) or kiosk
    if home_only and is_system_admin(conn, user_id):
        raise HomeInterfaceError(422, "home_only_admin", "אי אפשר להגביל מנהל מערכת לממשק הביתי בלבד.")
    if kiosk and not merged.get("kiosk_area_id"):
        raise HomeInterfaceError(422, "validation", "מסך קיר צריך חדר קבוע.")
    default = "home" if home_only else merged["default_interface"]
    may_switch = bool(merged["may_switch"]) and not home_only
    current = merged.get("current_interface") if may_switch else None
    conn.execute(
        """INSERT INTO home_interface_policy (user_id, default_interface, may_switch, home_only, kiosk, kiosk_area_id, rooms_json, modules_json, current_interface, updated_at, updated_by, guests)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET default_interface = excluded.default_interface, may_switch = excluded.may_switch, home_only = excluded.home_only,
             kiosk = excluded.kiosk, kiosk_area_id = excluded.kiosk_area_id, rooms_json = excluded.rooms_json, modules_json = excluded.modules_json,
             current_interface = excluded.current_interface, updated_at = excluded.updated_at, updated_by = excluded.updated_by,
             guests = excluded.guests""",
        (user_id, default, int(may_switch), int(home_only), int(kiosk), merged.get("kiosk_area_id") if kiosk else None,
         json.dumps(merged["rooms"]) if merged.get("rooms") is not None else None,
         json.dumps(merged["modules"]) if merged.get("modules") is not None else None,
         current, now_iso(), actor.user_id, int(bool(merged.get("guests")))),
    )
    return effective(conn, user_id)


def set_current(conn: sqlite3.Connection, user_id: str, interface: str) -> dict[str, Any]:
    """The person's own switch (the personal menu). Refused when the policy does not let them switch to that interface."""
    if interface not in INTERFACES:
        raise HomeInterfaceError(422, "validation", "ממשק לא מוכר.")
    eff = effective(conn, user_id)
    if interface != eff["interface"] and not eff["may_switch"] and not eff["choose"]:
        raise HomeInterfaceError(403, "interface_locked", "הממשק נקבע על ידי מנהל הבית.")
    if eff["home_only"] and interface == "full":
        raise HomeInterfaceError(403, "interface_locked", "הממשק נקבע על ידי מנהל הבית.")
    stored = stored_policy(conn, user_id)
    if stored is None:
        base = default_policy(eff["admin"], install_settings(conn)["default_mode"])
        conn.execute(
            "INSERT INTO home_interface_policy (user_id, default_interface, may_switch, home_only, kiosk, current_interface, updated_at, updated_by) VALUES (?, ?, 1, 0, 0, ?, ?, ?)",
            (user_id, base["default_interface"], interface, now_iso(), user_id),
        )
    else:
        conn.execute("UPDATE home_interface_policy SET current_interface = ? WHERE user_id = ?", (interface, user_id))
    return effective(conn, user_id)


def list_policies(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every active person with their effective policy (the administrator's page)."""
    out = []
    for u in conn.execute("SELECT id, username, display_name, source FROM users WHERE active = 1 ORDER BY COALESCE(display_name, username)").fetchall():
        eff = effective(conn, u["id"])
        out.append({"user_id": u["id"], "username": u["username"], "display_name": u["display_name"] or u["username"], "source": u["source"],
                    "system_admin": is_system_admin(conn, u["id"]), **{k: eff[k] for k in ("default_interface", "may_switch", "home_only", "kiosk", "kiosk_area_id", "rooms", "modules", "configured", "admin", "guests")},
                    "can_invite": holds_anywhere(conn, u["id"], "access.visitor.invite")})
    return out


def holds_anywhere(conn: sqlite3.Connection, user_id: str, permission: str) -> bool:
    """HOME-V3-P1-2430: whether the person holds a permission on any scope (the administrator's page says when a mark has no effect)."""
    from ..rbac import permissions_anywhere

    try:
        return permission in set(permissions_anywhere(conn, Principal(user_id=user_id, username="", display_name="", source="")))
    except Exception:  # noqa: BLE001 - a display hint only, never an authorization
        return False


# ---------------------------------------------------------------- the server-side gate

def api_route_of(path: str, root_path: str = "") -> str | None:
    """The route below /api/v1, or None when the path is not a canonical API route (the presence gate's normalisation)."""
    from .presence import api_route_of as _route

    return _route(path, root_path)


def home_allowed(path: str, root_path: str = "", method: str = "GET") -> bool:
    """True for the API routes the home interface uses. A non-API path (the page itself, assets) is not this gate's concern.
    HOME-V3-P1-2430: the read-only routes are allowed for GET / HEAD only."""
    rest = api_route_of(path, root_path)
    if rest is None:
        p = path or ""
        rp = (root_path or "").rstrip("/")
        if rp and (p == rp or p.startswith(rp + "/")):
            p = p[len(rp):]
        return not p.startswith(API_PREFIX + "/")  # a malformed API path is refused; anything outside /api/v1 is not judged here
    rest_cmp = rest[:-1] if len(rest) > 1 and rest.endswith("/") else rest
    if rest_cmp in HOME_ALLOWED_EXACT:
        return True
    if (method or "GET").upper() in ("GET", "HEAD") and (rest_cmp in HOME_READ_ONLY_EXACT or any(rest.startswith(p) for p in HOME_READ_ONLY_PREFIXES)):
        return True
    if not any(rest.startswith(p) for p in HOME_ALLOWED_PREFIXES):
        return False
    return not any(rest_cmp.endswith(s) for s in HOME_REFUSED_SUFFIXES)


def flag_route(path: str, root_path: str = "") -> str | None:
    """HOME-V3-P1-2430: the per-person flag a route needs (HOME_FLAG_ROUTES), or None when it is not a flagged route."""
    rest = api_route_of(path, root_path)
    if rest is None:
        return None
    rest_cmp = rest[:-1] if len(rest) > 1 and rest.endswith("/") else rest
    for flag, (exact, prefixes, refused) in HOME_FLAG_ROUTES.items():
        if any(rest_cmp == r or rest_cmp.startswith(r + "/") for r in refused):
            continue
        if rest_cmp in exact or any(rest.startswith(p) for p in prefixes):
            return flag
    return None


def enforce(conn: sqlite3.Connection, principal: Principal, path: str, request_id: str | None = None, *, root_path: str = "", method: str = "GET") -> None:
    """Refuse (403 `home_interface_only`) a home-only person's request outside the home interface's own routes. One cheap primary-key
    read for everyone else. Never applies to a system administrator (set_policy refuses that combination; this is the second lock)."""
    if home_allowed(path, root_path, method):
        return
    try:
        r = conn.execute("SELECT * FROM home_interface_policy WHERE user_id = ?", (principal.user_id,)).fetchone()
    except sqlite3.OperationalError as exc:
        # A database from before migration 0211 (no policy table yet) has no home-only person: nothing to refuse.
        if "no such table" in str(exc):
            return
        raise
    if r is None or not (r["home_only"] or r["kiosk"]):
        return
    flag = flag_route(path, root_path)
    if flag and flag in r.keys() and r[flag]:
        return
    if is_system_admin(conn, principal.user_id):
        return
    now = time.monotonic()
    with _LOCK:
        audit_now = now - _GATE_AUDITED.get(principal.user_id, 0.0) >= GATE_AUDIT_EVERY_S
        if audit_now:
            _GATE_AUDITED[principal.user_id] = now
    if audit_now:
        from ..audit import audit

        audit(conn, actor=principal, action="home_interface.gate.refused", decision="denied", resource_type="route", resource_id=(api_route_of(path, root_path) or path)[:200],
              reason="home_interface_only", request_id=request_id)
    raise HomeInterfaceError(403, "home_interface_only", "החשבון הזה פתוח לממשק הביתי בלבד.")


# ---------------------------------------------------------------- favourites and layout

def _clean_item(it: Any) -> dict[str, Any] | None:
    if not isinstance(it, dict):
        return None
    t = it.get("t")
    if t not in FAV_TYPES:
        return None
    out: dict[str, Any] = {"t": t}
    if t not in ("allLights", "energy", "security"):
        fid = it.get("id")
        if not isinstance(fid, str) or not FAV_ID_RE.match(fid):
            return None
        out["id"] = fid
    if t == "light" and it.get("w") in (1, 2):
        out["w"] = it["w"]
    return out


def clean_favourites(v: Any) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(v, dict) or len(v) > MAX_FAV_ROOMS:
        raise HomeInterfaceError(422, "validation", "רשימת המועדפים אינה תקינה.")
    out: dict[str, list[dict[str, Any]]] = {}
    for key, items in v.items():
        if not isinstance(key, str) or not ROOM_KEY_RE.match(key) or not isinstance(items, list) or len(items) > MAX_FAV_PER_ROOM:
            raise HomeInterfaceError(422, "validation", "רשימת המועדפים אינה תקינה.")
        clean = []
        for it in items:
            c = _clean_item(it)
            if c is None:
                raise HomeInterfaceError(422, "validation", "פריט מועדף לא מוכר.")
            if not any(x["t"] == c["t"] and x.get("id") == c.get("id") for x in clean):
                clean.append(c)
        out[key] = clean
    return out


def clean_layout(v: Any) -> dict[str, Any]:
    if not isinstance(v, dict):
        raise HomeInterfaceError(422, "validation", "ההגדרות אינן תקינות.")
    out: dict[str, Any] = {}
    for k in ("fav_rooms", "hidden_rooms"):
        if k in v:
            out[k] = _clean_list(v[k], None, "החדרים") or []
    if "start" in v:
        if v["start"] not in LAYOUT_START:
            raise HomeInterfaceError(422, "validation", "מסך הפתיחה אינו מוכר.")
        out["start"] = v["start"]
    if "start_room" in v:
        if v["start_room"] is not None and (not isinstance(v["start_room"], str) or not ROOM_KEY_RE.match(v["start_room"])):
            raise HomeInterfaceError(422, "validation", "החדר אינו תקין.")
        out["start_room"] = v["start_room"]
    if "scheme" in v:
        if v["scheme"] not in SCHEMES:
            raise HomeInterfaceError(422, "validation", "המראה אינו מוכר.")
        out["scheme"] = v["scheme"]
    if "theme" in v:
        if v["theme"] is not None and (not isinstance(v["theme"], str) or not THEME_RE.match(v["theme"])):
            raise HomeInterfaceError(422, "validation", "ערכת הצבעים אינה מוכרת.")
        out["theme"] = v["theme"]
    for k in ("big_text", "welcomed"):
        if k in v:
            out[k] = bool(v[k])
    if "wallpapers" in v:  # HOME-SIMPLE-2421: {room_key: "g:<gallery name>" | "img"}; an empty value = no wallpaper
        w = v["wallpapers"]
        if not isinstance(w, dict) or len(w) > MAX_ROOM_LIST:
            raise HomeInterfaceError(422, "validation", "רקעי החדרים אינם תקינים.")
        clean: dict[str, str] = {}
        for key, val in w.items():
            if not isinstance(key, str) or not ROOM_KEY_RE.match(key):
                raise HomeInterfaceError(422, "validation", "החדר אינו תקין.")
            if val is None or val == "":
                continue
            if not isinstance(val, str) or not WALL_RE.match(val) or (val.startswith("g:") and val[2:] not in GALLERY):
                raise HomeInterfaceError(422, "validation", "הרקע אינו מוכר.")
            clean[key] = val
        out["wallpapers"] = clean
    return out


def get_prefs(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT favourites_json, layout_json FROM home_user_prefs WHERE user_id = ?", (user_id,)).fetchone()
    favs = _loads(r["favourites_json"]) if r else None
    layout = _loads(r["layout_json"]) if r else None
    seed = {row["room_key"]: _loads(row["items_json"]) or [] for row in conn.execute("SELECT room_key, items_json FROM home_favourites_seed").fetchall()}
    return {"favourites": favs if isinstance(favs, dict) else {}, "layout": layout if isinstance(layout, dict) else {}, "seed": seed}


def set_prefs(conn: sqlite3.Connection, user_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """The person's own favourites / layout. `favourites` replaces the listed rooms only (a room not named keeps its list); `layout`
    merges key by key. Never another person's row: the user id is the caller's own."""
    cur = get_prefs(conn, user_id)
    favs = dict(cur["favourites"])
    layout = dict(cur["layout"])
    if "favourites" in body and body["favourites"] is not None:
        favs.update(clean_favourites(body["favourites"]))
        if len(favs) > MAX_FAV_ROOMS:
            raise HomeInterfaceError(422, "validation", "יותר מדי חדרים עם מועדפים.")
    if "layout" in body and body["layout"] is not None:
        layout.update(clean_layout(body["layout"]))
    conn.execute(
        """INSERT INTO home_user_prefs (user_id, favourites_json, layout_json, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET favourites_json = excluded.favourites_json, layout_json = excluded.layout_json, updated_at = excluded.updated_at""",
        (user_id, json.dumps(favs, ensure_ascii=False), json.dumps(layout, ensure_ascii=False), now_iso()),
    )
    return get_prefs(conn, user_id)


def set_seed(conn: sqlite3.Connection, actor: Principal, seed: Any) -> dict[str, Any]:
    clean = clean_favourites(seed)
    for key, items in clean.items():
        if items:
            conn.execute(
                """INSERT INTO home_favourites_seed (room_key, items_json, updated_at, updated_by) VALUES (?, ?, ?, ?)
                   ON CONFLICT(room_key) DO UPDATE SET items_json = excluded.items_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by""",
                (key, json.dumps(items), now_iso(), actor.user_id),
            )
        else:
            conn.execute("DELETE FROM home_favourites_seed WHERE room_key = ?", (key,))
    return {row["room_key"]: _loads(row["items_json"]) or [] for row in conn.execute("SELECT room_key, items_json FROM home_favourites_seed").fetchall()}


# ---------------------------------------------------------------- the wall panel's exit code

def _hash_code(code: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", code.encode(), salt, 120_000).hex()


def set_kiosk_code(conn: sqlite3.Connection, code: str | None) -> bool:
    """An administrator's exit code for the wall panels (4-8 digits), stored as a salted PBKDF2 hash; None / "" clears it."""
    if not code:
        set_setting(conn, KIOSK_CODE_KEY, "")
        return False
    if not KIOSK_CODE_RE.match(code):
        raise HomeInterfaceError(422, "validation", "קוד היציאה הוא 4 עד 8 ספרות.")
    salt = secrets.token_bytes(16)
    set_setting(conn, KIOSK_CODE_KEY, salt.hex() + "$" + _hash_code(code, salt))
    return True


def check_kiosk_code(conn: sqlite3.Connection, user_id: str, code: str) -> bool:
    """True when `code` is the exit code. At most KIOSK_TRIES wrong codes per person per KIOSK_WINDOW_S (then 429)."""
    if install_settings(conn)["kiosk_exit"] == "none":
        raise HomeInterfaceError(403, "kiosk_no_exit", "מסך הקיר נעול לחדר שלו. היציאה ממנו סגורה בהגדרות ההתקנה.")
    now = time.monotonic()
    with _LOCK:
        fails = [t for t in _KIOSK_FAILS.get(user_id, []) if now - t < KIOSK_WINDOW_S]
        _KIOSK_FAILS[user_id] = fails
        if len(fails) >= KIOSK_TRIES:
            raise HomeInterfaceError(429, "too_many_attempts", "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.", retryable=True)
    stored = get_setting(conn, KIOSK_CODE_KEY) or ""
    ok = False
    if "$" in stored and isinstance(code, str) and KIOSK_CODE_RE.match(code):
        salt_hex, want = stored.split("$", 1)
        try:
            ok = hmac.compare_digest(_hash_code(code, bytes.fromhex(salt_hex)), want)
        except ValueError:
            ok = False
    if not ok:
        with _LOCK:
            _KIOSK_FAILS.setdefault(user_id, []).append(now)
    else:
        with _LOCK:
            _KIOSK_FAILS.pop(user_id, None)
    return ok


def reset_state_for_tests() -> None:
    with _LOCK:
        _GATE_AUDITED.clear()
        _KIOSK_FAILS.clear()
