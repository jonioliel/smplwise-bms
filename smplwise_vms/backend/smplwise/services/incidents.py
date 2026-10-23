"""CR-LIVEEVENT100 (board r100): the live event mode - one record per incident in progress, its location, the cameras and doors near
it and the chain of who was notified / acknowledged / acted.

Read-mostly by design. Nothing here operates anything physical: no door open, no emergency open / lock, no alarm arm / disarm / bypass,
no PTZ. The only writes are the incident's own rows (open, acknowledge, note, close), the existing "incident opened" notification and the
acknowledge of the source event / notification - each through the permission the existing screens use (events.ack).

Default OFF: while `incident.enabled` is not exactly "true" nothing opens an incident (the routes answer 404 feature_disabled, the
alarm hook does nothing) and the shell offers nothing. Every threshold, timeout and budget the page uses is a setting (SETTINGS below,
edited in Settings > Security > "מצב אירוע חי" by system.configure); the recipients of the "incident opened" notification are the
notification policy `incident.opened` (Settings > Notifications), like every other notification source.

Permissions (no new key): an incident is scoped to its floor (installation when it has none). Reading = events.read there, acknowledge /
note / close / open = events.ack there; each panel keeps its own key (video.live per camera, entity.state.read for door states,
access.events.read for who opened, devices.read / generator.view for the infrastructure - the existing endpoints of those).
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import math
import sqlite3
from typing import Any

from ..audit import audit
from ..db import get_setting, new_id, set_setting
from ..rbac import INSTALLATION, STATION, Principal, authorize
from .correlation import OPEN_STATES, _inside, polygons_touch, tracked_kind
from .timeutil import iso_utc, parse_utc

log = logging.getLogger("smplwise.incidents")

# ---------------------------------------------------------------- settings (all editable; defaults = owner decisions 2026-10-24)

ENABLED = "incident.enabled"
# key: (kind, default, low, high) for ints; (kind, default, choices) for enums; (kind, default) for booleans
SETTINGS: dict[str, tuple[Any, ...]] = {
    ENABLED: ("bool", False),
    "incident.auto_open.alarm": ("bool", False),            # only from the burglary alarm (owner 2026-10-24); OFF initially
    "incident.merge_window_s": ("int", 300, 0, 3600),       # a second trigger on the same floor within this attaches to the open incident
    "incident.max_live": ("int", 4, 1, 6),                  # live tiles on a desktop
    "incident.max_live_phone": ("int", 1, 1, 2),            # live tiles on a phone (the rest are snapshots)
    "incident.snapshot_refresh_s": ("int", 10, 5, 120),     # how often a snapshot tile refreshes
    "incident.refresh_s": ("int", 10, 5, 120),              # the page's data poll while visible
    "incident.hidden_stop_s": ("int", 30, 5, 600),          # a hidden tab stops every player after this
    "incident.door_window_s": ("int", 600, 60, 3600),       # the doors / door-opens window around the incident (±)
    "incident.near_radius_pct": ("int", 20, 5, 60),         # "nearby" radius on the plan, percent of the plan width
    "incident.red_dot": ("enum", "active", ("active", "off")),  # the rail / tab dots: only while an incident is open, or never
    "incident.header_clock": ("bool", True),                # the wall clock in the page head
    "incidents.retention_days": ("int", 365, 30, 3650),     # closed incidents are pruned after this (open ones never)
}
# what any reader of the page needs (no secret, no person); the full set is the same values
CLIENT_KEYS = tuple(SETTINGS)

SOURCES = ("alarm", "event", "notification", "manual")
STEP_KINDS = ("opened", "notified", "acked", "door_open", "door_state", "note", "event_added", "closed")
NOTE_MAX = 500
TITLE_MAX = 120
MAX_CAMERAS = 12
MAX_DOORS = 12
DOOR_DOMAINS = ("lock",)
POLICY = "מצב אירוע חי מציג מידע בלבד. שום פעולה פיזית (פתיחת דלת, נטרול, חירום, PTZ) אינה מבוצעת מהמסך הזה."

EVENT_TYPE_HE = {
    "motion": "תנועה", "person": "אדם", "vehicle": "רכב", "line": "חציית קו", "field": "חדירה לאזור", "offline": "אובדן וידאו",
    "tamper": "חבלה במצלמה", "door": "דלת", "io": "כניסת חיווי", "storage": "אחסון", "system": "מערכת", "manual": "הקלטה ידנית",
}
SOURCE_HE = {"alarm": "אזעקת פריצה", "event": "מרכז האירועים", "notification": "התראה", "manual": "פתיחה ידנית"}


class Disabled(Exception):
    """The module is off: nothing may be opened."""


def now_utc() -> dt.datetime:
    """The clock of this module (tests replace it)."""
    return dt.datetime.now(dt.timezone.utc)


def _stamp(t: dt.datetime | None = None) -> str:
    return iso_utc(t or now_utc())


def _bool(raw: Any, default: bool) -> bool:
    if raw is None:
        return default
    return str(raw).strip().lower() == "true"


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    """Every setting with its effective value; a missing or corrupt stored value reads as the default (never out of bounds)."""
    out: dict[str, Any] = {}
    for key, spec in SETTINGS.items():
        raw = get_setting(conn, key)
        kind, default = spec[0], spec[1]
        if kind == "bool":
            out[key] = _bool(raw, default)
        elif kind == "int":
            try:
                v = int(str(raw)) if raw is not None else default
            except ValueError:
                v = default
            out[key] = v if spec[2] <= v <= spec[3] else default
        else:
            out[key] = raw if raw in spec[2] else default
    return out


def module_on(conn: sqlite3.Connection) -> bool:
    """On only when the row says exactly "true"; missing, unreadable or anything else is OFF."""
    try:
        return (get_setting(conn, ENABLED, "false") or "false") == "true"
    except sqlite3.Error:
        return False


def validate_patch(body: dict[str, Any]) -> dict[str, Any]:
    """The changes of a settings PUT, normalised. ValueError(key) for an unknown key or a value outside its bounds / choices."""
    out: dict[str, Any] = {}
    for key, value in body.items():
        spec = SETTINGS.get(key)
        if spec is None:
            raise ValueError(key)
        kind = spec[0]
        if kind == "bool":
            if not isinstance(value, bool):
                raise ValueError(key)
            out[key] = value
        elif kind == "int":
            if isinstance(value, bool) or not isinstance(value, int) or not spec[2] <= value <= spec[3]:
                raise ValueError(key)
            out[key] = value
        else:
            if value not in spec[2]:
                raise ValueError(key)
            out[key] = value
    return out


def bounds() -> dict[str, Any]:
    """The editable range of every setting (the settings card draws its inputs from it)."""
    out: dict[str, Any] = {}
    for key, spec in SETTINGS.items():
        if spec[0] == "int":
            out[key] = {"kind": "int", "min": spec[2], "max": spec[3], "default": spec[1]}
        elif spec[0] == "enum":
            out[key] = {"kind": "enum", "choices": list(spec[2]), "default": spec[1]}
        else:
            out[key] = {"kind": "bool", "default": spec[1]}
    return out


def write_settings(conn: sqlite3.Connection, changes: dict[str, Any]) -> dict[str, Any]:
    """Store validated changes; returns {key: {from, to}} of what actually changed."""
    before = read_settings(conn)
    diff: dict[str, Any] = {}
    for key, value in changes.items():
        if before[key] == value:
            continue
        set_setting(conn, key, ("true" if value else "false") if isinstance(value, bool) else str(value))
        diff[key] = {"from": before[key], "to": value}
    return diff


# ---------------------------------------------------------------- permission scope

def target_of(row: sqlite3.Row | dict[str, Any]) -> tuple[str, str]:
    fid = row["floor_id"]
    return ("floor", fid) if fid else INSTALLATION


def may(conn: sqlite3.Connection, principal: Principal, permission: str, row: sqlite3.Row | dict[str, Any]) -> bool:
    return authorize(conn, principal, permission, target_of(row)).allowed


# ---------------------------------------------------------------- the place: floor, zone, neighbours

def _zones(conn: sqlite3.Connection, floor_id: str) -> list[tuple[str, list[dict[str, float]]]]:
    out = []
    for z in conn.execute("SELECT name, polygon_json FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (floor_id,)).fetchall():
        try:
            poly = json.loads(z["polygon_json"])
        except (TypeError, ValueError):
            continue
        if isinstance(poly, list) and len(poly) >= 3:
            out.append((z["name"], poly))
    return out


def _area(poly: list[dict[str, float]]) -> float:
    return abs(sum(poly[i]["x"] * poly[(i + 1) % len(poly)]["y"] - poly[(i + 1) % len(poly)]["x"] * poly[i]["y"] for i in range(len(poly)))) / 2


def _zone_at(zones: list[tuple[str, list[dict[str, float]]]], x: float, y: float) -> tuple[str | None, list[dict[str, float]] | None]:
    best: tuple[float, str, list[dict[str, float]]] | None = None
    for name, poly in zones:
        if _inside(x, y, poly):
            a = _area(poly)
            if best is None or a < best[0]:
                best = (a, name, poly)
    return (best[1], best[2]) if best else (None, None)


def floor_info(conn: sqlite3.Connection, floor_id: str | None) -> dict[str, Any] | None:
    if not floor_id:
        return None
    r = conn.execute("SELECT f.id, f.name, f.building_id, b.name AS building_name FROM floors f JOIN buildings b ON b.id = f.building_id "
                     "WHERE f.id = ? AND f.deleted_at IS NULL", (floor_id,)).fetchone()
    return dict(r) if r else None


def anchor_of(conn: sqlite3.Connection, resource_type: str, resource_id: str) -> sqlite3.Row | None:
    """The current anchor of a camera / entity on a live floor (the newest when it sits on several maps)."""
    return conn.execute(
        "SELECT a.id, a.floor_id, a.x, a.y FROM map_anchors a JOIN floors f ON f.id = a.floor_id "
        "WHERE a.resource_type = ? AND a.resource_id = ? AND a.effective_to IS NULL AND f.deleted_at IS NULL ORDER BY a.updated_at DESC LIMIT 1",
        (resource_type, resource_id),
    ).fetchone()


def _camera_names(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["id"]: (r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") for r in conn.execute("SELECT id, alias, name_source, channel FROM cameras").fetchall()}


RELATION_RANK = {"source": -1, "same_zone": 0, "adjacent_zone": 1, "nearby": 2, "floor": 3}
RELATION_HE = {"source": "מקור האירוע", "same_zone": "אותו חדר", "adjacent_zone": "חדר סמוך", "nearby": "בקרבת מקום", "floor": "באותה קומה"}


def neighbours(conn: sqlite3.Connection, floor_id: str | None, x: float | None, y: float | None, radius: float, *, source_camera: str | None = None) -> dict[str, Any]:
    """The cameras and the door entities around a point on a floor, ranked: the event's own camera, same room, adjacent room (a shared
    wall), within `radius`, then the rest of the floor (cameras only, so the page still has something to show). Pure topology, never an
    identification. Without a point the floor's cameras are listed in their anchor order."""
    out: dict[str, Any] = {"cameras": [], "doors": []}
    if not floor_id:
        if source_camera:
            out["cameras"].append({"camera_id": source_camera, "relation": "source", "distance": 0.0})
        return out
    zones = _zones(conn, floor_id)
    zname, zpoly = _zone_at(zones, x, y) if x is not None and y is not None else (None, None)
    rows = conn.execute("SELECT resource_type, resource_id, x, y FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL ORDER BY effective_from, id", (floor_id,)).fetchall()
    seen: set[str] = set()
    for a in rows:
        key = f"{a['resource_type']}:{a['resource_id']}"
        if key in seen:
            continue
        seen.add(key)
        if x is None or y is None:
            dist, relation = 0.0, "floor"
        else:
            dist = math.hypot(a["x"] - x, a["y"] - y)
            _cz, cpoly = _zone_at(zones, a["x"], a["y"])
            if zpoly is not None and cpoly is zpoly:
                relation = "same_zone"
            elif zpoly is not None and cpoly is not None and polygons_touch(zpoly, cpoly):
                relation = "adjacent_zone"
            elif dist <= radius:
                relation = "nearby"
            else:
                relation = "floor"
        if a["resource_type"] == "camera":
            if a["resource_id"] == source_camera:
                relation = "source"
            out["cameras"].append({"camera_id": a["resource_id"], "relation": relation, "distance": round(dist, 3)})
        elif relation != "floor":
            out["doors"].append({"entity_id": a["resource_id"], "relation": relation, "distance": round(dist, 3)})
    if source_camera and not any(c["camera_id"] == source_camera for c in out["cameras"]):
        out["cameras"].append({"camera_id": source_camera, "relation": "source", "distance": 0.0})
    out["cameras"].sort(key=lambda c: (RELATION_RANK[c["relation"]], c["distance"]))
    out["doors"].sort(key=lambda d: (RELATION_RANK[d["relation"]], d["distance"]))
    out["zone"] = zname
    return out


def _door_entities(conn: sqlite3.Connection, ids: list[str]) -> list[sqlite3.Row]:
    if not ids:
        return []
    q = f"SELECT entity_id, name, domain, device_class, state, last_changed, available, area_name FROM ha_entities WHERE removed_at IS NULL AND entity_id IN ({','.join('?' * len(ids))})"
    rows = {r["entity_id"]: r for r in conn.execute(q, ids).fetchall()}
    out = []
    for eid in ids:
        r = rows.get(eid)
        if r is None:
            continue
        if r["domain"] in DOOR_DOMAINS or tracked_kind(r["entity_id"], r["domain"], r["device_class"], r["name"] or "") == "door":
            out.append(r)
    return out


# ---------------------------------------------------------------- open / merge

def _row(conn: sqlite3.Connection, incident_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()


def get(conn: sqlite3.Connection, incident_id: str) -> sqlite3.Row | None:
    return _row(conn, incident_id)


def add_step(conn: sqlite3.Connection, incident_id: str, kind: str, *, at: str | None = None, actor: str | None = None, actor_user_id: str | None = None,
             actor_kind: str = "user", ref_type: str | None = None, ref_id: str | None = None, text: str | None = None) -> None:
    conn.execute("INSERT INTO incident_steps(incident_id, at, kind, actor, actor_user_id, actor_kind, ref_type, ref_id, text) VALUES (?,?,?,?,?,?,?,?,?)",
                 (incident_id, at or _stamp(), kind, actor, actor_user_id, actor_kind, ref_type, ref_id, (text or "")[:NOTE_MAX] or None))


def _actor_name(p: Principal | None) -> str | None:
    if p is None:
        return None
    return p.display_name or p.username or None


def _merge_target(conn: sqlite3.Connection, floor_id: str | None, window_s: int, now: dt.datetime) -> sqlite3.Row | None:
    if window_s <= 0:
        return None
    lo = _stamp(now - dt.timedelta(seconds=window_s))
    if floor_id:
        return conn.execute("SELECT * FROM incidents WHERE status = 'open' AND floor_id = ? AND last_trigger_at >= ? ORDER BY last_trigger_at DESC LIMIT 1", (floor_id, lo)).fetchone()
    return conn.execute("SELECT * FROM incidents WHERE status = 'open' AND floor_id IS NULL AND last_trigger_at >= ? ORDER BY last_trigger_at DESC LIMIT 1", (lo,)).fetchone()


def open_incident(conn: sqlite3.Connection, *, source: str, title: str, floor_id: str | None = None, x: float | None = None, y: float | None = None,
                  anchor_id: str | None = None, source_ref: str | None = None, source_camera: str | None = None, actor: Principal | None = None,
                  request_id: str | None = None, event_label: str | None = None) -> tuple[sqlite3.Row, bool]:
    """Open an incident - or, within the merge window, attach this trigger to the open incident of the same floor as a chain step.
    Returns (row, merged). Raises Disabled while the module is off. The caller has checked the permission (events.ack at the floor)."""
    if source not in SOURCES:
        raise ValueError(source)
    if not module_on(conn):
        raise Disabled()
    cfg = read_settings(conn)
    now = now_utc()
    at = _stamp(now)
    title = (title or SOURCE_HE[source]).strip()[:TITLE_MAX] or SOURCE_HE[source]
    who = _actor_name(actor)
    kind = "user" if actor is not None else "system"
    merge = _merge_target(conn, floor_id, int(cfg["incident.merge_window_s"]), now)
    if merge is not None:
        conn.execute("UPDATE incidents SET last_trigger_at = ? WHERE id = ?", (at, merge["id"]))
        add_step(conn, merge["id"], "event_added", at=at, actor=who, actor_user_id=getattr(actor, "user_id", None), actor_kind=kind,
                 ref_type=source, ref_id=source_ref, text=title)
        audit(conn, actor=actor, action="incident.merge", decision="allowed", resource_type="incident", resource_id=merge["id"], request_id=request_id,
              details={"source": source, "source_ref": source_ref, "auto": actor is None})
        return _row(conn, merge["id"]), True
    fl = floor_info(conn, floor_id)
    radius = cfg["incident.near_radius_pct"] / 100.0
    near = neighbours(conn, fl["id"] if fl else None, x, y, radius, source_camera=source_camera)
    names = _camera_names(conn)
    doors = _door_entities(conn, [d["entity_id"] for d in near["doors"]][:MAX_DOORS])
    facts = {
        "event_label": event_label,
        "source_label": SOURCE_HE[source],
        "cameras": [{"camera_id": c["camera_id"], "name": names.get(c["camera_id"], c["camera_id"]), "relation": c["relation"]} for c in near["cameras"][:MAX_CAMERAS]],
        "doors": [{"entity_id": d["entity_id"], "name": d["name"] or d["entity_id"]} for d in doors],
    }
    iid = new_id()
    conn.execute(
        """INSERT INTO incidents(id, status, source, source_ref, title, building_id, floor_id, anchor_id, x, y, zone, opened_at, opened_by, opened_by_user_id,
                                 last_trigger_at, facts_json) VALUES (?, 'open', ?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (iid, source, source_ref, title, fl["building_id"] if fl else None, fl["id"] if fl else None, anchor_id, x, y, near.get("zone"), at,
         (actor.username if actor else "system"), getattr(actor, "user_id", None), at, json.dumps(facts, ensure_ascii=False)),
    )
    add_step(conn, iid, "opened", at=at, actor=who, actor_user_id=getattr(actor, "user_id", None), actor_kind=kind, ref_type=source, ref_id=source_ref,
             text=title)
    audit(conn, actor=actor, action="incident.open", decision="allowed", resource_type="incident", resource_id=iid, request_id=request_id,
          details={"source": source, "floor_id": fl["id"] if fl else None, "auto": actor is None})
    _notify_opened(conn, iid, title, fl)
    return _row(conn, iid), False


def _notify_opened(conn: sqlite3.Connection, iid: str, title: str, fl: dict[str, Any] | None) -> None:
    """The existing notification pipeline: source `incident.opened` (its recipients and channels are edited in Settings > Notifications).
    Never raises into the opening: a failing notification leaves the incident open, without the 'notified' step."""
    from . import notify

    place = " · ".join(p for p in ((fl or {}).get("building_name"), (fl or {}).get("name")) if p) or None
    try:
        r = notify.emit_full(conn, notify.Signal("incident.opened", "incident", iid, dedupe_key=f"incident.opened:{iid}", params={"name": title, "place": place or ""},
                                                 place=place, link=f"#/investigate/incidents/{iid}", origin={"incident_id": iid, "floor_id": (fl or {}).get("id")}))
    except Exception:  # noqa: BLE001 - the notification never blocks the incident itself
        log.exception("incident %s: the opened notification failed", iid)
        return
    if r.id and r.action == "created":
        conn.execute("UPDATE incidents SET notification_id = ? WHERE id = ?", (r.id, iid))
        n = conn.execute("SELECT COUNT(*) FROM notification_recipients WHERE notification_id = ?", (r.id,)).fetchone()[0]
        add_step(conn, iid, "notified", actor_kind="system", ref_type="notification", ref_id=r.id, text=str(n))


# ---------------------------------------------------------------- the chain

def _user_names(conn: sqlite3.Connection, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    q = f"SELECT id, username, display_name FROM users WHERE id IN ({','.join('?' * len(ids))})"
    return {r["id"]: (r["display_name"] or r["username"] or r["id"]) for r in conn.execute(q, ids).fetchall()}


def chain(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal) -> dict[str, Any]:
    """The chain of handling in time order: the incident's own steps, the notification's recipients and acknowledge (mirrored from the
    notification tables at read time - one row and its events, no join against the video path), the door-open commands near the incident
    (the audit rows of the release path; the person only with access.events.read), and who is still waiting."""
    steps: list[dict[str, Any]] = []
    for s in conn.execute("SELECT * FROM incident_steps WHERE incident_id = ? ORDER BY at, id", (row["id"],)).fetchall():
        d = {k: s[k] for k in ("at", "kind", "actor", "actor_kind", "ref_type", "ref_id", "text")}
        if s["kind"] == "notified" and s["ref_id"]:
            uids = [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ? ORDER BY added_at, user_id", (s["ref_id"],)).fetchall()]
            d["recipients"] = list(_user_names(conn, uids).values())
        steps.append(d)
    pending: list[str] = []
    nid = row["notification_id"]
    if nid:
        for e in conn.execute("SELECT at, by_user_id FROM notification_events WHERE notification_id = ? AND kind = 'acknowledged' ORDER BY at", (nid,)).fetchall():
            name = _user_names(conn, [e["by_user_id"]]).get(e["by_user_id"]) if e["by_user_id"] else None
            if not any(x["kind"] == "acked" and x["at"] == e["at"] for x in steps):
                steps.append({"at": e["at"], "kind": "acked", "actor": name, "actor_kind": "user", "ref_type": "notification", "ref_id": nid, "text": None})
        n = conn.execute("SELECT state FROM notifications WHERE id = ?", (nid,)).fetchone()
        if row["status"] == "open" and not row["acked_at"] and n is not None and n["state"] == "open":
            uids = [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ? ORDER BY added_at, user_id", (nid,)).fetchall()]
            pending = list(_user_names(conn, uids).values())
    steps += door_opens(conn, row, principal)
    steps.sort(key=lambda s: s["at"])
    return {"steps": steps, "pending": pending}


def _window(conn: sqlite3.Connection, row: sqlite3.Row) -> tuple[str, str]:
    w = int(read_settings(conn)["incident.door_window_s"])
    lo = parse_utc(row["opened_at"]) - dt.timedelta(seconds=w)
    hi = parse_utc(row["closed_at"]) if row["closed_at"] else now_utc()
    return _stamp(lo), _stamp(hi + dt.timedelta(seconds=1))


def _facts(row: sqlite3.Row) -> dict[str, Any]:
    try:
        f = json.loads(row["facts_json"] or "{}")
        return f if isinstance(f, dict) else {}
    except ValueError:
        return {}


def door_opens(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal) -> list[dict[str, Any]]:
    """The release commands of the doors near the incident inside its window, from the audit (the outcome rows of `intercom.release`).
    The actor's name only for a holder of access.events.read on that station (or the installation)."""
    entity_ids = [d.get("entity_id") for d in _facts(row).get("doors") or [] if isinstance(d, dict) and d.get("entity_id")]
    if not entity_ids:
        return []
    stations = {r["entity_id"]: r["config_entry_id"] for r in conn.execute(
        f"SELECT entity_id, config_entry_id FROM intercom_door_map WHERE entity_id IN ({','.join('?' * len(entity_ids))})", entity_ids).fetchall()}
    names = {d["entity_id"]: d.get("name") or d["entity_id"] for d in _facts(row).get("doors") or [] if isinstance(d, dict) and d.get("entity_id")}
    lo, hi = _window(conn, row)
    ids = list(entity_ids) + [s for s in stations.values() if s]
    q = (f"SELECT at, actor_username, actor_user_id, resource_type, resource_id, details_json FROM audit_log WHERE action = 'intercom.release' AND decision = 'allowed' "
         f"AND at >= ? AND at <= ? AND resource_id IN ({','.join('?' * len(ids))}) ORDER BY at LIMIT 50")
    out: list[dict[str, Any]] = []
    for a in conn.execute(q, (lo, hi, *ids)).fetchall():
        try:
            det = json.loads(a["details_json"] or "{}")
        except ValueError:
            det = {}
        if det.get("phase") != "outcome" or det.get("outcome") not in ("ok", "unknown"):
            continue
        if a["resource_type"] == "ha_entity":
            eid, sid = a["resource_id"], stations.get(a["resource_id"])
        else:
            sid = a["resource_id"]
            eid = next((e for e, s in stations.items() if s == sid), None)
        see_who = authorize(conn, principal, "access.events.read", (STATION, sid) if sid else INSTALLATION).allowed
        who = (_user_names(conn, [a["actor_user_id"]]).get(a["actor_user_id"]) if a["actor_user_id"] else a["actor_username"]) if see_who else None
        out.append({"at": a["at"], "kind": "door_open", "actor": who, "actor_kind": "user", "ref_type": "door", "ref_id": eid,
                    "text": names.get(eid or "", ""), "unconfirmed": det.get("outcome") == "unknown"})
    return out


# ---------------------------------------------------------------- the panels

def cameras_panel(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal) -> dict[str, Any]:
    """The cameras near the incident the caller may watch live (video.live per camera, the same check as the player's stream route):
    cameras the caller lacks are not listed at all. Ranking = the current map; the snapshot at open time when the map has none."""
    from .access import camera_allowed

    cfg = read_settings(conn)
    names = _camera_names(conn)
    src_cam = None
    if row["source"] == "event" and row["source_ref"]:
        ev = conn.execute("SELECT camera_id FROM events WHERE id = ?", (row["source_ref"],)).fetchone()
        src_cam = ev["camera_id"] if ev else None
    near = neighbours(conn, row["floor_id"], row["x"], row["y"], cfg["incident.near_radius_pct"] / 100.0, source_camera=src_cam)
    ranked = near["cameras"] or [{"camera_id": c.get("camera_id"), "relation": c.get("relation") or "floor", "distance": 0.0}
                                 for c in _facts(row).get("cameras") or [] if isinstance(c, dict) and c.get("camera_id")]
    known = set(names)
    out, hidden = [], 0
    for c in ranked:
        cid = c["camera_id"]
        if cid not in known:
            continue
        if not camera_allowed(conn, principal, cid, "video.live"):
            hidden += 1
            continue
        out.append({"camera_id": cid, "name": names[cid], "relation": c["relation"], "relation_label": RELATION_HE.get(c["relation"], ""), "distance": c["distance"]})
        if len(out) >= MAX_CAMERAS:
            break
    return {"cameras": out, "withheld": hidden > 0 and not out, "max_live": cfg["incident.max_live"], "max_live_phone": cfg["incident.max_live_phone"],
            "snapshot_refresh_s": cfg["incident.snapshot_refresh_s"]}


def doors_panel(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal) -> dict[str, Any]:
    """The doors near the incident (lock entities and door sensors on the plan around the point; the snapshot at open time otherwise):
    state and since with entity.state.read; `station_id` / `door` (to read who opened from the access log) only with access.events.read
    on that station. Read-only: there is no action here - "לדלת" opens the door page, which enforces its own permissions."""
    cfg = read_settings(conn)
    state_ok = authorize(conn, principal, "entity.state.read", target_of(row)).allowed
    near = neighbours(conn, row["floor_id"], row["x"], row["y"], cfg["incident.near_radius_pct"] / 100.0)
    ids = [d["entity_id"] for d in near["doors"]] or [d.get("entity_id") for d in _facts(row).get("doors") or [] if isinstance(d, dict) and d.get("entity_id")]
    ents = _door_entities(conn, [i for i in ids if i][:MAX_DOORS])
    mapped = {}
    if ents:
        eids = [e["entity_id"] for e in ents]
        mapped = {r["entity_id"]: (r["config_entry_id"], r["physical_index"]) for r in conn.execute(
            f"SELECT entity_id, config_entry_id, physical_index FROM intercom_door_map WHERE entity_id IN ({','.join('?' * len(eids))})", eids).fetchall()}
    lo, hi = _window(conn, row)
    out = []
    for e in ents:
        st = e["state"] if state_ok else None
        is_open = bool(st) and st in OPEN_STATES
        d: dict[str, Any] = {"entity_id": e["entity_id"], "name": e["name"] or e["entity_id"], "area_name": e["area_name"], "domain": e["domain"],
                             "state": st, "open": is_open if state_ok else None, "since": e["last_changed"] if state_ok else None,
                             "available": bool(e["available"]) if state_ok else None}
        m = mapped.get(e["entity_id"])
        if m and authorize(conn, principal, "access.events.read", (STATION, m[0])).allowed:
            d["station_id"], d["door"] = m[0], m[1]
        out.append(d)
    return {"doors": out, "state_visible": state_ok, "window": {"from": lo, "to": hi}, "window_s": cfg["incident.door_window_s"]}


# ---------------------------------------------------------------- serialise, list, summary

def serialize(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal, *, with_chain: bool = True) -> dict[str, Any]:
    fl = floor_info(conn, row["floor_id"])
    d: dict[str, Any] = {k: row[k] for k in ("id", "status", "source", "source_ref", "title", "building_id", "floor_id", "anchor_id", "x", "y", "zone",
                                             "opened_at", "opened_by", "acked_at", "acked_by", "closed_at", "closed_by", "close_note")}
    d["source_label"] = SOURCE_HE.get(row["source"], row["source"])
    d["floor_name"] = fl["name"] if fl else None
    d["building_name"] = fl["building_name"] if fl else None
    opener = row["opened_by_user_id"]
    d["opened_by_name"] = (_user_names(conn, [opener]).get(opener) if opener else None) or ("המערכת" if row["opened_by"] == "system" else row["opened_by"])
    facts = _facts(row)
    d["event_label"] = facts.get("event_label")
    if with_chain:
        d.update(chain(conn, row, principal))
        d["can_ack"] = may(conn, principal, "events.ack", row)
        d["can_case"] = authorize(conn, principal, "cases.manage", INSTALLATION).allowed
        d["can_audit"] = authorize(conn, principal, "audit.read", INSTALLATION).allowed
        d["can_configure"] = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    return d


def visible(conn: sqlite3.Connection, principal: Principal, *, status: str = "all", limit: int = 50) -> list[sqlite3.Row]:
    where, args = ("", []) if status == "all" else ("WHERE status = ?", [status])
    rows = conn.execute(f"SELECT * FROM incidents {where} ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, opened_at DESC LIMIT 500", args).fetchall()
    out = []
    cache: dict[tuple[str, str], bool] = {}
    for r in rows:
        t = target_of(r)
        if t not in cache:
            cache[t] = authorize(conn, principal, "events.read", t).allowed
        if cache[t]:
            out.append(r)
            if len(out) >= limit:
                break
    return out


def summary(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """What the shell needs for the pill and the dots: the number of open incidents this viewer may read and the newest one."""
    if not module_on(conn):
        return {"enabled": False, "open": 0, "latest_id": None, "red_dot": "off"}
    rows = visible(conn, principal, status="open", limit=50)
    cfg = read_settings(conn)
    return {"enabled": True, "open": len(rows), "latest_id": rows[0]["id"] if rows else None, "latest_title": rows[0]["title"] if rows else None,
            "red_dot": cfg["incident.red_dot"]}


# ---------------------------------------------------------------- acknowledge / note / close

def ack(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal, request_id: str | None = None) -> bool:
    """One acknowledge step per person (a second press by the same person is a no-op); the first sets acked_at / acked_by. Also
    acknowledges the source event (events.ack on its camera, as the event page does) and the incident's notification (its own rule)."""
    already = conn.execute("SELECT 1 FROM incident_steps WHERE incident_id = ? AND kind = 'acked' AND actor_user_id = ?", (row["id"], principal.user_id)).fetchone()
    if already:
        return False
    at = _stamp()
    first = not row["acked_at"]
    if first:
        conn.execute("UPDATE incidents SET acked_at = ?, acked_by = ? WHERE id = ?", (at, principal.display_name or principal.username, row["id"]))
    add_step(conn, row["id"], "acked", at=at, actor=_actor_name(principal), actor_user_id=principal.user_id, text="first" if first else None)
    audit(conn, actor=principal, action="incident.ack", decision="allowed", resource_type="incident", resource_id=row["id"], request_id=request_id, details={"first": first})
    if row["source"] == "event" and row["source_ref"]:
        ev = conn.execute("SELECT id, camera_id, type, occurred_at, acked_at FROM events WHERE id = ?", (row["source_ref"],)).fetchone()
        if ev is not None and not ev["acked_at"]:
            from .access import camera_allowed

            ok = camera_allowed(conn, principal, ev["camera_id"], "events.ack") if ev["camera_id"] else authorize(conn, principal, "events.ack", INSTALLATION).allowed
            if ok:
                conn.execute("UPDATE events SET acked_at = ?, acked_by = ?, acked_by_username = ? WHERE id = ?", (at, principal.user_id, principal.username, ev["id"]))
                audit(conn, actor=principal, action="event.ack", decision="allowed", resource_type="event", resource_id=ev["id"], request_id=request_id,
                      details={"type": ev["type"], "camera_id": ev["camera_id"], "occurred_at": ev["occurred_at"], "via": "incident"})
    if row["notification_id"]:
        from . import notify

        try:
            notify.acknowledge(conn, principal, row["notification_id"])
        except Exception:  # noqa: BLE001 - the incident's acknowledge stands on its own
            log.exception("incident %s: acknowledging the notification failed", row["id"])
    return True


def note(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal, text: str, request_id: str | None = None) -> None:
    add_step(conn, row["id"], "note", actor=_actor_name(principal), actor_user_id=principal.user_id, text=text.strip()[:NOTE_MAX])
    audit(conn, actor=principal, action="incident.note", decision="allowed", resource_type="incident", resource_id=row["id"], request_id=request_id,
          details={"length": len(text.strip())})


def close(conn: sqlite3.Connection, row: sqlite3.Row, principal: Principal, close_note: str | None, request_id: str | None = None) -> None:
    """Close the incident. Never acknowledges the alarm panel and never touches the NVR or a door. Audited with the duration and the
    acknowledgers. Closing a closed incident is a no-op for the caller to report."""
    at = _stamp()
    text = (close_note or "").strip()[:NOTE_MAX] or None
    conn.execute("UPDATE incidents SET status = 'closed', closed_at = ?, closed_by = ?, close_note = ? WHERE id = ?",
                 (at, principal.display_name or principal.username, text, row["id"]))
    add_step(conn, row["id"], "closed", at=at, actor=_actor_name(principal), actor_user_id=principal.user_id, text=text)
    ackers = [r[0] for r in conn.execute("SELECT DISTINCT actor FROM incident_steps WHERE incident_id = ? AND kind = 'acked' AND actor IS NOT NULL", (row["id"],)).fetchall()]
    duration = int((parse_utc(at) - parse_utc(row["opened_at"])).total_seconds())
    audit(conn, actor=principal, action="incident.close", decision="allowed", resource_type="incident", resource_id=row["id"], request_id=request_id,
          details={"note": text, "duration_s": duration, "acknowledgers": ackers})
    if row["notification_id"]:
        from . import notify

        try:  # the condition ended: the open "incident opened" notification is resolved (its policy keeps the row)
            notify.emit(conn, notify.Signal("incident.opened", "incident", row["id"], dedupe_key=f"incident.opened:{row['id']}", resolve=True,
                                            params={"resolution": "incident_closed"}))
        except Exception:  # noqa: BLE001
            log.exception("incident %s: resolving the notification failed", row["id"])


# ---------------------------------------------------------------- retention

def prune(conn: sqlite3.Connection, days: int | None = None, now: dt.datetime | None = None) -> int:
    """Delete CLOSED incidents (and their steps) closed more than `days` ago; an open incident is never pruned. The audit rows stay
    under audit.retention_days."""
    if days is None:
        days = int(read_settings(conn)["incidents.retention_days"])
    cutoff = _stamp((now or now_utc()) - dt.timedelta(days=days))
    try:
        return conn.execute("DELETE FROM incidents WHERE status = 'closed' AND closed_at < ?", (cutoff,)).rowcount
    except sqlite3.OperationalError:  # a database before the migration
        return 0


def prune_db(db: Any) -> int:
    with db.connection() as conn:
        return prune(conn)


# ---------------------------------------------------------------- the alarm hook (T1)

def on_ha_state(conn: sqlite3.Connection, old: dict[str, Any] | None, new: dict[str, Any]) -> sqlite3.Row | None:
    """An alarm_control_panel entering `triggered` opens an incident - only with the module ON and `incident.auto_open.alarm` ON (both
    OFF by default). The location is the first open zone of that panel that is placed on a floor plan, else the panel's own anchor; without
    either the incident opens without a location. Runs inside the HA state transaction in its own savepoint; never raises."""
    eid = str((new or {}).get("entity_id") or "")
    if not eid.startswith("alarm_control_panel.") or (new or {}).get("state") != "triggered" or (old or {}).get("state") == "triggered" or old is None:
        return None
    try:
        if not module_on(conn) or not read_settings(conn)["incident.auto_open.alarm"]:
            return None
    except sqlite3.Error:
        return None
    conn.execute("SAVEPOINT incident_alarm")
    try:
        row = _open_from_alarm(conn, eid, new)
        conn.execute("RELEASE incident_alarm")
        return row
    except Exception:  # noqa: BLE001 - the state update itself is never lost
        conn.execute("ROLLBACK TO incident_alarm")
        conn.execute("RELEASE incident_alarm")
        log.exception("incident alarm hook failed for %s", eid)
        return None


def _open_from_alarm(conn: sqlite3.Connection, panel_id: str, new: dict[str, Any]) -> sqlite3.Row | None:
    from . import alarm as alarm_svc

    zone_name = None
    anchor = None
    try:
        disc = alarm_svc.discover(conn)
        panel = next((p for p in disc["panels"] if p["entity_id"] == panel_id), None)
    except Exception:  # noqa: BLE001 - discovery is best effort; the incident still opens
        panel = None
    for z in (panel or {}).get("zones") or []:
        if z.get("open"):
            a = anchor_of(conn, "ha_entity", z["entity_id"])
            zone_name = zone_name or z.get("name")
            if a is not None:
                anchor, zone_name = a, z.get("name")
                break
    if anchor is None:
        anchor = anchor_of(conn, "ha_entity", panel_id)
    attrs = (new or {}).get("attributes") or {}
    pname = (panel or {}).get("name") or attrs.get("friendly_name") or panel_id
    title = f"אזעקת פריצה · {zone_name}" if zone_name else f"אזעקת פריצה · {pname}"
    row, _merged = open_incident(conn, source="alarm", title=title, floor_id=anchor["floor_id"] if anchor else None, x=anchor["x"] if anchor else None,
                                 y=anchor["y"] if anchor else None, anchor_id=anchor["id"] if anchor else None, source_ref=panel_id, actor=None,
                                 event_label="אזעקת פריצה")
    return row
