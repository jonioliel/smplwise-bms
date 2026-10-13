"""CR-038 section 12.3: the frozen 24-hour device history a device ticket carries, and who may read a device in the module.

Who may read a device (the device tab, the snapshot, the snapshot on a ticket's detail - section 8 "Device tab", review T18-3):
`devices.read` at the entity's placement (services/ha_scope - the same rule as every devices route), an alarm panel also needs
`alarm.view` there (routers/devices.py `_visible_entities`), and a lock / alarm panel needs a permission that OPERATES it
(device_activity.SECURITY_PERMISSIONS - the rule of GET /devices/{id}/activity). Anything else is "no such device" for the caller.

The snapshot is taken AS THE CREATOR when a ticket is created from a device:
- tracked domains (device_activity.ACTIVITY_DOMAINS): `device_activity.list_activity` over the last 24 h, at most 200 rows;
- any other entity: the 30-day state history (`ha_state_history`), at most 200 rows;
- each item keeps the time, the kind, the before / after values (scalars only), the changed keys and the actor's TYPE; the actor's
  NAME only when the actor is not a person (an automation, a scene ...) - person names are never stored; no attribute dump, no source;
- `truncated` when the window held more than the limit; `withheld = 'permission'` (nothing captured) when the creator may not read
  the device's history; frozen in `ticket_device_context` (later history never alters it).

The handler page (slices 4 / 7, D3 / D23) may show the snapshot only when the assignment's box is ticked, and NEVER for the domains of
EXTERNAL_HISTORY_NEVER whatever a client sends (`share_history_allowed`): those histories say when a building was unlocked, disarmed
or opened."""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ...rbac import Principal
from .. import device_activity, ha_scope
from ..timeutil import iso_utc
from . import store

WINDOW_H = 24
LIMIT = 200
PREVIEW_LINES = 5
EXTERNAL_HISTORY_NEVER = frozenset({"lock", "alarm_control_panel", "cover", "camera"})
READ = "devices.read"
_SCALAR = (str, int, float, bool, type(None))


def ha_connected() -> bool | None:
    """Whether the HA link is up (the activity read model's 'unavailable' judgement); None when the sync state cannot be read."""
    try:
        from .. import ha_sync

        return ha_sync.STATE.connected
    except Exception:  # noqa: BLE001 - a snapshot never fails a creation over a status flag
        return None


def readable_entity(conn: sqlite3.Connection, principal: Principal, entity_id: str) -> dict[str, Any] | None:
    """The catalogued entity when the caller may read it in the module (the rule in the module docstring), else None - never says why."""
    e = store.entity_row(conn, entity_id)
    if e is None:
        return None
    if not ha_scope.entity_allowed(conn, principal, entity_id, READ):
        return None
    if e["domain"] == "alarm_control_panel" and not ha_scope.entity_allowed(conn, principal, entity_id, "alarm.view"):
        return None
    perms = device_activity.SECURITY_PERMISSIONS.get(e["domain"])
    if perms and not any(ha_scope.entity_allowed(conn, principal, entity_id, p) for p in perms):
        return None
    return e


def _values(v: Any) -> dict[str, Any]:
    return {k: x for k, x in v.items() if isinstance(k, str) and isinstance(x, _SCALAR)} if isinstance(v, dict) else {}


def clean_activity_item(item: dict[str, Any]) -> dict[str, Any]:
    """One device_activity row as the snapshot keeps it: no person name, no source, no attribute beyond the watched scalars."""
    actor_in = item.get("actor") if isinstance(item.get("actor"), dict) else {}
    a_type = str(actor_in.get("type") or "unknown")
    actor: dict[str, Any] = {"type": a_type}
    if a_type != "person" and isinstance(actor_in.get("name"), str) and actor_in.get("name"):
        actor["name"] = actor_in["name"]
    return {"at": item.get("at"), "kind": item.get("kind"), "from": _values(item.get("from")), "to": _values(item.get("to")),
            "changed": [c for c in (item.get("changed") or []) if isinstance(c, str)], "actor": actor}


def _window(now: dt.datetime | None) -> tuple[str, str]:
    now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(dt.timezone.utc)
    return iso_utc(now - dt.timedelta(hours=WINDOW_H)), iso_utc(now)


def capture(conn: sqlite3.Connection, principal: Principal, entity_id: str, *, now: dt.datetime | None = None, connected: bool | None = None) -> dict[str, Any]:
    """The 24 h snapshot of a device as `principal` may read it (nothing is written here)."""
    since, until = _window(now)
    base: dict[str, Any] = {"entity_id": entity_id, "captured_at": until, "window_from": since, "window_to": until, "items": [], "coverage": {},
                            "truncated": False, "withheld": None}
    e = readable_entity(conn, principal, entity_id)
    if e is None:
        return {**base, "source": "none", "withheld": "permission"}
    if e["domain"] in device_activity.ACTIVITY_DOMAINS:
        page = device_activity.list_activity(conn, entity_id, since=since, until=None, actor=None, kind=None, limit=LIMIT, cursor=None, connected=connected)
        cov = page.get("coverage") or {}
        return {**base, "source": "device_activity", "items": [clean_activity_item(i) for i in page.get("items") or []],
                "truncated": bool(page.get("next_cursor")),
                "coverage": {"from": cov.get("from"), "gaps": cov.get("gaps") or [], "availability": page.get("availability")}}
    rows = store.state_history(conn, entity_id, since, LIMIT + 1)
    truncated = len(rows) > LIMIT
    rows = rows[:LIMIT]
    items: list[dict[str, Any]] = []
    for i, r in enumerate(rows):
        older = rows[i + 1]["state"] if i + 1 < len(rows) else None
        items.append({"at": r["changed_at"], "kind": "state", "from": {"state": older} if older is not None else {}, "to": {"state": r["state"]},
                      "changed": ["state"], "actor": {"type": "unknown"}})
    return {**base, "source": "state_history", "items": items, "truncated": truncated}


def freeze(conn: sqlite3.Connection, ticket_id: str, snapshot: dict[str, Any]) -> None:
    store.insert_device_context(conn, ticket_id, snapshot)


def summary(snapshot: dict[str, Any], lines: int = PREVIEW_LINES) -> dict[str, Any]:
    """What a screen shows of a snapshot before (the create sheet) or after (the ticket) - the count, the flags and the newest lines."""
    items = snapshot.get("items") or []
    return {"source": snapshot.get("source"), "window_hours": WINDOW_H, "window_from": snapshot.get("window_from"), "window_to": snapshot.get("window_to"),
            "count": len(items), "truncated": bool(snapshot.get("truncated")), "withheld": snapshot.get("withheld"), "lines": items[:lines]}


def for_ticket(conn: sqlite3.Connection, principal: Principal, ticket_row: dict[str, Any], *, full: bool) -> dict[str, Any] | None:
    """The stored snapshot on a ticket's detail: only for a viewer of the ticket's INTERNAL content (`full`) who may read the device too
    (section 12.3); None otherwise or when the ticket has no device."""
    entity_id = ticket_row.get("entity_id")
    if not entity_id or not full:
        return None
    snap = store.device_context(conn, ticket_row["id"])
    if snap is None:
        return None
    if readable_entity(conn, principal, entity_id) is None:
        return None
    out = summary(snap, lines=LIMIT)
    out["captured_at"] = snap.get("captured_at")
    out["coverage"] = snap.get("coverage") or {}
    out["shareable"] = share_history_allowed(entity_id, snap)
    return out


def share_history_allowed(entity_id: str | None, snapshot: dict[str, Any] | None) -> bool:
    """D3 / D23: may the snapshot ever be shown on the handler page? Never without a device, without a snapshot (`withheld` / `none`),
    or for the domains of EXTERNAL_HISTORY_NEVER - whatever a client or a stored default says."""
    if not entity_id or not snapshot:
        return False
    if snapshot.get("withheld") or snapshot.get("source") == "none":
        return False
    return entity_id.split(".", 1)[0] not in EXTERNAL_HISTORY_NEVER


def share_history_default(department: dict[str, Any] | None, contact_default: int | None = None) -> bool:
    """D23: the assign dialog's box is preselected from the vendor / contact (when set), else from the department (default off)."""
    if contact_default is not None:
        return bool(contact_default)
    return bool((department or {}).get("share_history_external"))


def resolve_share_history(entity_id: str | None, snapshot: dict[str, Any] | None, requested: bool | None, department: dict[str, Any] | None,
                          contact_default: int | None = None) -> bool:
    """The value an assignment stores (slices 4 / 7 call this): the manager's per-ticket choice, else the D23 default - and always False
    where `share_history_allowed` says never (a client cannot turn it on for a lock, an alarm panel, a cover or a camera)."""
    if not share_history_allowed(entity_id, snapshot):
        return False
    return bool(requested) if requested is not None else share_history_default(department, contact_default)
