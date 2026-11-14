"""Wall display alert tiles (CR-030 v2 section 5, WDX). The wall is a delivery channel of the notification core (CR-018): it
never decides what an alert is, it only reads the open rows the wall profile's filter and scope allow. A wall user is not a
notification recipient (the kiosk role holds neither events.read nor devices.read), so the scope is decided here, by the same
subject facts the core stores: a camera subject must be one of the display's cameras, a place subject must lie in the display's
area (a display without an area shows every place), the installation-wide device-fault rows (recorder / NVR) reach every display
that asked for `device_faults`. Automations, scheduler, system, backup and session rows never reach a wall."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from . import notify, notify_policy as policies

NEVER_KINDS = {"schedule", "automation", "bulk_job", "session"}
NEVER_CATEGORIES = {"automations", "system"}
MAX_ALERTS = 20


def _camera_of(row: sqlite3.Row) -> str | None:
    try:
        origin = json.loads(row["origin_json"] or "{}")
    except ValueError:
        origin = {}
    cam = origin.get("camera_id") if isinstance(origin, dict) else None
    if cam:
        return str(cam)
    return row["subject_id"] if row["subject_kind"] == "camera" else None


def _in_scope(row: sqlite3.Row, camera_ids: set[str], area_id: str | None) -> bool:
    if row["subject_kind"] in NEVER_KINDS or row["category"] in NEVER_CATEGORIES:
        return False
    cam = _camera_of(row)
    if row["subject_kind"] == "camera" or cam:
        return cam in camera_ids
    if row["subject_kind"] == "system":
        return row["category"] == "device_faults"  # recorder / NVR faults are installation-wide
    if row["subject_kind"] == "door":
        return True
    if area_id:
        return row["area_id"] == area_id
    return True


def alerts_for(conn: sqlite3.Connection, cfg: dict[str, Any], camera_ids: set[str], area_id: str | None) -> list[dict[str, Any]]:
    a = cfg["alerts"]
    if not a["enabled"] or not a["categories"]:
        return []
    cats = [c for c in a["categories"] if c in policies.CATEGORIES and c not in NEVER_CATEGORIES]
    if not cats:
        return []
    floor = policies.SEVERITY_RANK.get(a["min_severity"], 1)
    sev = [s for s, r in policies.SEVERITY_RANK.items() if r >= floor]
    rows = conn.execute(
        f"SELECT * FROM notifications WHERE state = 'open' AND category IN ({','.join('?' * len(cats))}) AND severity IN ({','.join('?' * len(sev))}) "
        "ORDER BY last_at DESC, id DESC LIMIT 200", (*cats, *sev)).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        if not _in_scope(r, camera_ids, area_id):
            continue
        out.append({"id": r["id"], "source": r["source"], "category": r["category"], "severity": r["severity"], "title": r["title"], "place": r["place"],
                    "body": r["body"], "count": int(r["count"]), "first_at": r["first_at"], "last_at": r["last_at"], "camera_id": _camera_of(r)})
        if len(out) >= MAX_ALERTS:
            break
    # critical first, then newest: the display shows the head of the list
    out.sort(key=lambda x: (0 if x["severity"] == "critical" else 1))
    return out


def signature(alerts: list[dict[str, Any]]) -> str:
    return "|".join(f"{a['id']}:{a['count']}:{a['last_at']}" for a in alerts)


def ack(conn: sqlite3.Connection, user_id: str, nid: str, cfg: dict[str, Any], camera_ids: set[str], area_id: str | None) -> str:
    """'ok' | 'not_found'. Called only after the route checked `alerts.ack_allowed`; the actor is the wall user."""
    row = conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()
    if row is None or not any(a["id"] == nid for a in alerts_for(conn, cfg, camera_ids, area_id)):
        return "not_found"
    if row["state"] == "open":
        notify._ack_state(conn, row, user_id)
    return "ok"
