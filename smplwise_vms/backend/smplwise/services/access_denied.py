"""DENYALERT133-295: the denied-entry alert of the external access (board item r133; CR-ARX-WISKEY-SHARED-IDENTITY 4.3, WisKey W-c).

What it does. WisKey's event feed reports a refused attempt at a station (`events/list`, `result = denied`). One READ pass of the grants
worker (services/access_grants.py `_screen_passes`) asks for the denied events newer than its cursor and, for each one that concerns the
external access, emits the notification source `access.denied_attempt`:

* "concerns the external access" = the event names a person Arx linked (employee number -> `access_person_links` -> that subject's newest
  grant), or the station is one of the doors of a live grant. Any other denial (a resident's own card at an unrelated door) is not ours.
* One notification per grant + station (`dedupe_key`), folded by the policy's dedupe window (default 10 minutes) with a count - a brute
  force or a faulty reader makes ONE row that keeps counting, never a stream of phone alerts. A burst (BURST_N or more in the open row plus
  this pass) raises the severity from `info` to `alert`; it never reaches `critical`, and no safety rule is touched.
* Recipients = the people who hold `access.external.grant` on THAT station (services/notify_visibility, subject kind `access_denied`).
* The text carries only the station name, the grant's short reference (its first 8 characters), the local time and a closed reason - never a
  PIN, a card number, a person's name, a phone number or an employee number (the event's own fields are read, matched and dropped).

Switches. OFF by default: it runs only while the setting `access.external.denied_alert` is `on` AND the external-access feature is on
(`access.external_grants` + the go-live permit). The first pass after the switch is turned on only sets the cursor to "now" (history is
never alerted). A WisKey that does not answer leaves the cursor where it was: the next pass asks again.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Callable

from ..db import Database, get_setting, set_setting
from . import access_grants as ag
from . import notify

log = logging.getLogger("smplwise.access_denied")

SOURCE = "access.denied_attempt"
SUBJECT = "access_denied"
SWITCH_KEY = "access.external.denied_alert"
CURSOR_KEY = "access.external.denied_cursor"  # internal runtime state: {"at": iso, "ids": [event ids seen at that instant]}
WHO = "system:access_denied"
BURST_N = 5            # this many refusals of one grant at one station in the open row -> severity `alert`
MAX_PER_PASS = 100     # one pass reads and emits at most this many events (the rest wait for the next pass)
MAX_IDS = 200
MAX_LOOKBACK_H = 1     # a switch left off for hours never replays the gap

# the closed reason codes and their Hebrew text (never free text from the device)
REASONS = {
    "attempt_limit": "הגעה למכסת ניסיונות",
    "grant_not_active": "הגישה אינה פעילה",
    "outside_window": "מחוץ למועד הגישה",
    "credential_refused": "אישור לא התקבל",
    "unknown_credential": "אמצעי זיהוי לא מוכר",
}

# tests install a fake: (db, since_iso) -> list of projected events (intercom_adapter.project_event), or None = WisKey did not answer
EVENT_SOURCE: Callable[[Database, str], list[dict[str, Any]] | None] | None = None


def switch_on(conn: sqlite3.Connection) -> bool:
    """Both gates: the alert's own switch (default off) and the external-access feature."""
    try:
        return (get_setting(conn, SWITCH_KEY) or "off") == "on" and ag.enabled(conn)
    except sqlite3.Error:
        return False


def _live_events(db: Database, since: str) -> list[dict[str, Any]] | None:
    from . import intercom_adapter as adapter

    if ag._SETTINGS is None:
        return None
    try:
        reply = adapter.ADAPTER._read_raw(ag._SETTINGS, WHO, "events", lambda call: adapter.events_list(call, {"result": "denied", "start": since, "limit": adapter.SCAN_PAGE}),
                                          adapter.project_event_page, command="events/list")
    except Exception:  # noqa: BLE001 - WisKey not reachable now: the next pass asks again
        return None
    page = reply.get("events") if isinstance(reply, dict) else None
    if not isinstance(page, dict) or not isinstance(page.get("records"), list):
        return None
    return page["records"]


def _stamp(ev: dict[str, Any]) -> str:
    return str(ev.get("received_at") or ev.get("timestamp") or "")


def _cursor(conn: sqlite3.Connection) -> dict[str, Any] | None:
    try:
        c = json.loads(get_setting(conn, CURSOR_KEY) or "null")
    except ValueError:
        return None
    return c if isinstance(c, dict) and isinstance(c.get("at"), str) else None


def _live_doors(conn: sqlite3.Connection) -> dict[str, str]:
    """station id -> the id of one live grant that opens it (the newest)."""
    out: dict[str, str] = {}
    marks = ",".join("?" * len(ag.DECIDED))
    for r in conn.execute(f"SELECT id, doors_json FROM access_grants WHERE state IN ({marks}) ORDER BY created_at", ag.DECIDED).fetchall():
        try:
            doors = json.loads(r["doors_json"] or "{}")
        except ValueError:
            continue
        for sid in doors if isinstance(doors, dict) else ():
            out[str(sid)] = r["id"]
    return out


def _grant_of_person(conn: sqlite3.Connection, employee_no: str) -> dict[str, Any] | None:
    link = conn.execute("SELECT subject_kind, subject_id FROM access_person_links WHERE employee_no = ?", (employee_no,)).fetchone()
    if link is None:
        return None
    row = conn.execute("SELECT * FROM access_grants WHERE subject_kind = ? AND subject_id = ? ORDER BY created_at DESC LIMIT 1",
                       (link["subject_kind"], link["subject_id"])).fetchone()
    return dict(row) if row else None


def _reason(ev: dict[str, Any], grant: dict[str, Any] | None, at: datetime) -> str:
    if ev.get("event_type") == "attempt_limit":
        return "attempt_limit"
    if grant is None:
        return "unknown_credential"
    if grant["state"] != "active":
        return "grant_not_active"
    start, end = ag.parse_iso(grant.get("valid_from")), ag.parse_iso(grant.get("valid_until"))
    if (start and at < start) or (end and at > end):
        return "outside_window"
    return "credential_refused"


def _classify(conn: sqlite3.Connection, ev: dict[str, Any], doors: dict[str, str], now: datetime) -> dict[str, Any] | None:
    """The facts of one denied event that concerns the external access, or None. The event's person fields are used to MATCH only."""
    sid = ev.get("station_id")
    if not sid:
        return None
    person_grant = _grant_of_person(conn, ev["employee_no"]) if ev.get("employee_no") else None
    if person_grant is None and sid not in doors:
        return None  # neither an external person nor a door of a live grant: not ours
    at = ag.parse_iso(_stamp(ev)) or now
    # a person we know -> that grant; a refusal nobody can name (a guessed PIN) -> the station alone
    return {"station_id": sid, "grant_id": person_grant["id"] if person_grant else None, "reason": _reason(ev, person_grant, at), "at": at}


def _open_count(conn: sqlite3.Connection, key: str) -> int:
    r = conn.execute("SELECT count FROM notifications WHERE dedupe_key = ? AND state != 'resolved'", (key,)).fetchone()
    return int(r["count"]) if r else 0


def denied_pass(db: Database) -> int:
    """One pass. Returns the number of events that produced a signal. Never raises into the worker (the caller guards it too)."""
    now = ag.now()
    with db.connection(mode="read", label="access_denied.scan") as conn:
        if not switch_on(conn):
            return 0
        cursor = _cursor(conn)
    if cursor is None:  # first pass after the switch: start from now, alert nothing from the past
        with db.connection(label="access_denied.cursor") as conn:
            set_setting(conn, CURSOR_KEY, json.dumps({"at": ag.iso(now), "ids": []}))
        return 0
    read = EVENT_SOURCE or _live_events
    since = max(cursor["at"], ag.iso(now - timedelta(hours=MAX_LOOKBACK_H)))  # a switch left off for days never replays the gap
    events = read(db, since)
    if events is None:
        return 0
    seen = set(cursor.get("ids") or [])
    fresh = sorted((e for e in events if e.get("result") == "denied" and e.get("id") not in seen and _stamp(e) >= since), key=_stamp)[:MAX_PER_PASS]
    if not fresh:
        return 0
    sent = 0
    with db.connection(label="access_denied.emit") as conn:
        if not switch_on(conn):
            return 0
        doors = _live_doors(conn)
        zone = ag.zone_of(conn)
        facts: list[tuple[dict[str, Any], dict[str, Any]]] = []
        for ev in fresh:
            f = _classify(conn, ev, doors, now)
            if f is not None:
                facts.append((ev, f))
        batch: dict[str, int] = {}
        for _, f in facts:
            k = _key(f)
            batch[k] = batch.get(k, 0) + 1
        for ev, f in facts:
            key = _key(f)
            total = _open_count(conn, key) + batch[key]
            try:
                notify.emit(conn, notify.Signal(
                    SOURCE, SUBJECT, f["station_id"], severity="alert" if total >= BURST_N else None, dedupe_key=key,
                    params={"place": ag._station_name(f["station_id"]), "ref": (f["grant_id"] or "")[:8] or "-", "reason": REASONS[f["reason"]],
                            "time": f["at"].astimezone(zone).strftime("%H:%M"), "code": f["reason"]},
                    origin={"kind": "access_denied", "station_id": f["station_id"]}, link=_link(conn, f["grant_id"])))
                sent += 1
            except Exception:  # noqa: BLE001 - a notice never fails the pass; the cursor still moves
                log.warning("access denied: a notification failed")
        newest = max(_stamp(e) for e in fresh)
        ids = sorted({e["id"] for e in fresh if _stamp(e) == newest} | (set(cursor.get("ids") or []) if newest == cursor["at"] else set()))[:MAX_IDS]
        set_setting(conn, CURSOR_KEY, json.dumps({"at": newest, "ids": ids}))
    return sent


def _key(f: dict[str, Any]) -> str:
    return f"{SOURCE}:{f['station_id']}:{f['grant_id'] or '-'}"


def _link(conn: sqlite3.Connection, grant_id: str | None) -> str:
    from . import access_external as ax

    return ax.screen_href(conn, grant_id)
