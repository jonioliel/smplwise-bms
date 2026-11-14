"""EXTERNALBUILD-297: the entry watch of the external access - the one-time ("single entry") code and the visitor entry log.

What it does. One READ pass of the grants worker (services/access_grants.py `_screen_passes`) asks WisKey's event feed (`events/list`,
`result = granted`) for the entries newer than its cursor, and only while at least one grant needs it: an ACTIVE grant whose code is a
one-time code (`access_grants.code_mode = 'single_entry'`) or a live visitor invitation (services/access_visitors.py). Nothing is polled
otherwise. For each granted entry whose employee number belongs to a person Arx linked (`access_person_links.employee_no`) and whose station
is one of that person's live grant's doors, at or after the grant's start:
 * a visitor grant -> one `access_visitor_entries` row (ids only; the primary key makes a repeated event idempotent), the invite's entry
   count and first entry, and the content-free notification `access.visitor.arrived` to the host;
 * a one-time code -> `first_entry_at` is stored and the grant's authority is withdrawn at once (`mark_revoking(..., 'ended')`); the strip
   then follows through the worker's at-least-once path with read-back proof. Best effort, stated in the screen: WisKey has no use-counted
   PIN, so between the entry and the strip (the poll interval + the write) a second entry still works.

`visitor_pass` keeps each invitation's own end reason in step with its grant (window ended, revoked, single entry used, ...) and erases
the visitor's name and number N days after the end (CR-VISITOR105 D10; the tickets erase path).

Fakes: tests install `EVENT_SOURCE` (db, since_iso) -> list of projected events (intercom_adapter.project_event) or None. The live
source is the same READ the denied-entry alert uses; nothing here writes to WisKey, a station or a door."""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import timedelta
from typing import Any, Callable

from ..db import Database, get_setting, set_setting
from . import access_grants as ag

log = logging.getLogger("smplwise.access_entries")

CURSOR_KEY = "access.external.entry_cursor"  # internal runtime state: {"at": iso, "ids": [event ids seen at that instant]}
WHO = "system:access_entries"
MAX_PER_PASS = 200
MAX_IDS = 200
MAX_LOOKBACK_H = 24
ARRIVED_SOURCE = "access.visitor.arrived"

EVENT_SOURCE: Callable[[Database, str], list[dict[str, Any]] | None] | None = None


def _live_events(db: Database, since: str) -> list[dict[str, Any]] | None:
    from . import intercom_adapter as adapter

    if ag._SETTINGS is None:
        return None
    try:
        reply = adapter.ADAPTER._read_raw(ag._SETTINGS, WHO, "events", lambda call: adapter.events_list(call, {"result": "granted", "start": since, "limit": adapter.SCAN_PAGE}),
                                          adapter.project_event_page, command="events/list")
    except Exception:  # noqa: BLE001 - WisKey not reachable now: the next pass asks again
        return None
    page = reply.get("events") if isinstance(reply, dict) else None
    if not isinstance(page, dict) or not isinstance(page.get("records"), list):
        return None
    return page["records"]


def _stamp(ev: dict[str, Any]) -> str:
    return str(ev.get("received_at") or ev.get("timestamp") or "")


def _watched(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """The active grants the watch is for: one-time codes and visitor grants."""
    rows = conn.execute("SELECT g.* FROM access_grants g WHERE g.state = 'active' AND (g.code_mode = 'single_entry' "
                        "OR EXISTS (SELECT 1 FROM access_visitor_invites vi WHERE vi.grant_id = g.id))").fetchall()
    return [dict(r) for r in rows]


def _cursor(conn: sqlite3.Connection) -> dict[str, Any] | None:
    try:
        c = json.loads(get_setting(conn, CURSOR_KEY) or "null")
    except ValueError:
        return None
    return c if isinstance(c, dict) and isinstance(c.get("at"), str) else None


def _grant_for(conn: sqlite3.Connection, employee_no: str) -> dict[str, Any] | None:
    link = conn.execute("SELECT subject_kind, subject_id FROM access_person_links WHERE employee_no = ?", (employee_no,)).fetchone()
    if link is None:
        return None
    return ag.live_grant_of(conn, link["subject_kind"], link["subject_id"])


def _granted(ev: dict[str, Any]) -> bool:
    return ev.get("result") == "granted" or ev.get("event_type") == "access_granted"


def entry_pass(db: Database) -> int:
    """One pass. Returns the number of entries matched. Never raises into the worker (the caller guards it too)."""
    now = ag.now()
    with db.connection(mode="read", label="access_entries.scan") as conn:
        if not ag.enabled(conn):
            return 0
        watched = _watched(conn)
        cursor = _cursor(conn)
    if not watched:
        return 0
    floor = ag.iso(now - timedelta(hours=MAX_LOOKBACK_H))
    if cursor is None:
        # first pass: from the earliest start among the watched grants (bounded), so an entry made before the first pass still counts
        starts = sorted(g["valid_from"] for g in watched if g.get("valid_from"))
        since = max(starts[0] if starts else ag.iso(now), floor)
        cursor = {"at": since, "ids": []}
    since = max(cursor["at"], floor)
    events = (EVENT_SOURCE or _live_events)(db, since)
    if events is None:
        return 0
    seen = set(cursor.get("ids") or [])
    fresh = sorted((e for e in events if _granted(e) and e.get("id") not in seen and _stamp(e) >= since), key=_stamp)[:MAX_PER_PASS]
    matched = 0
    with db.connection(label="access_entries.apply") as conn:
        if not ag.enabled(conn):
            return 0
        for ev in fresh:
            try:
                matched += 1 if _apply(conn, ev, now) else 0
            except sqlite3.Error:
                log.warning("access entries: one entry could not be recorded")
        if fresh:
            newest = max(_stamp(e) for e in fresh)
            ids = sorted({e["id"] for e in fresh if _stamp(e) == newest and e.get("id")} | (seen if newest == cursor["at"] else set()))[:MAX_IDS]
            set_setting(conn, CURSOR_KEY, json.dumps({"at": newest, "ids": ids}))
        elif _cursor(conn) is None:
            set_setting(conn, CURSOR_KEY, json.dumps({"at": since, "ids": []}))
    return matched


def _apply(conn: sqlite3.Connection, ev: dict[str, Any], now: Any) -> bool:
    emp, sid = ev.get("employee_no"), ev.get("station_id")
    if not emp or not sid:
        return False
    g = _grant_for(conn, str(emp))
    if g is None or g["state"] != "active":
        return False
    doors = json.loads(g["doors_json"] or "{}")
    at = ag.parse_iso(_stamp(ev)) or ag._parse_any(_stamp(ev)) or now
    start = ag.parse_iso(g["valid_from"])
    if str(sid) not in doors or (start is not None and at < start):
        return False
    stamp = ag.iso(at)
    invite = conn.execute("SELECT * FROM access_visitor_invites WHERE grant_id = ?", (g["id"],)).fetchone()
    if invite is not None:
        door = ev.get("door") if ev.get("door") in (1, 2) else None
        added = conn.execute("INSERT OR IGNORE INTO access_visitor_entries(invite_id, event_id, station_id, door, result, event_at, seen_at) "
                             "VALUES (?, ?, ?, ?, 'granted', ?, ?)", (invite["id"], str(ev.get("id") or stamp), str(sid), door, stamp, ag.iso(now))).rowcount
        if added:
            conn.execute("UPDATE access_visitor_invites SET entries = entries + 1, first_entry_at = COALESCE(first_entry_at, ?), updated_at = ?, "
                         "revision = revision + 1 WHERE id = ?", (stamp, ag.iso(now), invite["id"]))
            ag._audit(conn, None, "access.visitor.arrived", invite["id"], resource_type="access_visitor_invite", grant_id=g["id"], station=str(sid))
            _tell_host(conn, invite, str(sid), at)
    if g.get("code_mode") == "single_entry" and not g.get("first_entry_at"):
        ag._touch(conn, g["id"], {"first_entry_at": stamp})
        cur = ag.grant_row(conn, g["id"])
        ag.mark_revoking(conn, cur, "ended")
        ag._audit(conn, None, "access.grant.single_entry_used", g["id"], station=str(sid), at=stamp)
        if invite is not None:
            conn.execute("UPDATE access_visitor_invites SET end_reason = COALESCE(end_reason, 'single_entry_used'), updated_at = ? WHERE id = ?",
                         (ag.iso(now), invite["id"]))
    return True


def _tell_host(conn: sqlite3.Connection, invite: Any, station_id: str, at: Any) -> None:
    """The content-free arrival notice to the host: the door's name and the time - never the visitor's name, number or an image."""
    try:
        from . import notify

        notify.emit(conn, notify.Signal(ARRIVED_SOURCE, "access_visitor", invite["id"], dedupe_key=f"{ARRIVED_SOURCE}:{invite['id']}:{ag.iso(at)}",
                                        params={"place": ag._station_name(station_id), "time": at.astimezone(ag.zone_of(conn)).strftime("%H:%M")},
                                        origin={"kind": "access_visitor", "host_user_id": invite["host_user_id"]}))
    except Exception:  # noqa: BLE001 - a notice never fails the pass (the source may not be registered on this installation)
        log.info("access entries: the arrival notice was not emitted")


# ---------------------------------------------------------------- visitor bookkeeping

_GRANT_TO_INVITE = {"ended": "window_ended", "manual": "manager_revoked", "approver_lost_authority": "host_lost_permission",
                    "contact_erased": "visitor_erased", "station_changed": "station_changed", "feature_off": "feature_off", "refused": "refused",
                    "failed": "failed"}


def visitor_pass(db: Database) -> int:
    """Each finished visitor grant gives its invitation an end reason (once), and the visitor contact is erased N days after the end."""
    from . import access_visitors as av

    n = 0
    with db.connection(label="access_entries.visitors") as conn:
        rows = conn.execute("SELECT vi.*, g.state AS g_state, g.end_reason AS g_reason, g.ended_at AS g_ended, g.code_state AS g_code FROM access_visitor_invites vi "
                            "JOIN access_grants g ON g.id = vi.grant_id WHERE vi.end_reason IS NULL AND g.state IN ('ended', 'revoked', 'refused', 'failed')").fetchall()
        for r in rows:
            reason = _GRANT_TO_INVITE.get(r["g_reason"] or "", "manager_revoked")
            if reason == "window_ended" and not r["confirmed_at"]:
                reason = "expired_unconfirmed"
            ended = r["g_ended"] or ag.iso(ag.now())
            due = ag.iso((ag.parse_iso(ended) or ag.now()) + timedelta(days=av.erase_after_days(conn)))
            conn.execute("UPDATE access_visitor_invites SET end_reason = ?, erase_due_at = COALESCE(erase_due_at, ?), token_sha256 = NULL, updated_at = ?, "
                         "revision = revision + 1 WHERE id = ?", (reason, due, ag.iso(ag.now()), r["id"]))
            ag._audit(conn, None, "access.visitor.ended", r["id"], resource_type="access_visitor_invite", reason=reason, grant_id=r["grant_id"])
            n += 1
        n += av.erase_due(conn)
    return n
