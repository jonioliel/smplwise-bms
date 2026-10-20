"""GRANTS3-295 (`rfq-access-code-doors`, the owner-visible audit): one external grant's history for the owner.

`GET /access-grants/{id}/history` - a system administrator only (the owner, and whoever he made a system administrator): the uniform 404
first (an unknown id and a grant the caller cannot see answer the same), then 403 `not_system_admin`. Every audit row of the grant
(`resource_type = 'access_grant'`, `resource_id = <id>`), oldest first, at most HISTORY_MAX rows, as:

    {at, action, decision, reason, by: {kind: user | page | system, name}, facts: {...}}

`action` is the audit action without its `access.grant.` prefix (request, notice_ack, approve, provision, activate, code_queued,
code_sent, code_not_delivered, code_rotated, card_attached, revoke, revoked, end, ...). `by.name` is the Arx user's display name; a
vendor-page step says `page` with no name (the vendor's contact id is never served), the worker says `system`.

`facts` is a closed allow-list of the row's details: states, reason and outcome codes, counts, the notice version, the window instants
and the NUMBER of stations. Never a contact id, a WisKey person id, an employee number, a station id, a phone number, a message text, a
PIN or a card number (none of those is in an audit row to begin with - this list is the second guard)."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from ..errors import ApiError
from ..rbac import Principal, is_system_admin
from . import access_grants as ag

HISTORY_MAX = 500
_FACT_KEYS = ("via", "version", "kind", "sends", "outcome", "attempt", "code", "state", "credential", "outside_window", "source", "phase",
              "verdict", "window", "count")
_PREFIX = "access.grant."


def _by(conn: sqlite3.Connection, user_id: str | None, names: dict[str, str | None]) -> dict[str, Any]:
    if not user_id or user_id == "system":
        return {"kind": "system", "name": None}
    if user_id.startswith("contact:"):
        return {"kind": "page", "name": None}
    if user_id not in names:
        row = conn.execute("SELECT display_name FROM users WHERE id = ?", (user_id,)).fetchone()
        names[user_id] = (row["display_name"] if row else None) or None
    return {"kind": "user", "name": names[user_id]}


def _facts(details: dict[str, Any]) -> dict[str, Any]:
    out = {k: details[k] for k in _FACT_KEYS if k in details and isinstance(details[k], (str, int, bool, list)) and not isinstance(details[k], dict)}
    if isinstance(out.get("window"), list):
        out["window"] = [w for w in out["window"] if isinstance(w, str)][:2]
    if isinstance(details.get("stations"), list):
        out["doors"] = len(details["stations"])  # how many stations, never which
    return out


def history(conn: sqlite3.Connection, principal: Principal, grant_id: str) -> list[dict[str, Any]]:
    g = ag.grant_row(conn, grant_id)
    if g is None or not ag.visible(conn, principal, g):
        raise ag._not_found()
    if not is_system_admin(conn, principal.user_id):
        raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לצפות בהיסטוריית הגישה.")
    rows = conn.execute("SELECT at, actor_user_id, action, decision, reason, details_json FROM audit_log WHERE resource_type = 'access_grant' AND resource_id = ? "
                        "ORDER BY id LIMIT ?", (grant_id, HISTORY_MAX)).fetchall()
    names: dict[str, str | None] = {}
    out = []
    for r in rows:
        action = str(r["action"] or "")
        if not action.startswith(_PREFIX):
            continue
        try:
            details = json.loads(r["details_json"] or "{}")
        except ValueError:
            details = {}
        out.append({"at": r["at"], "action": action[len(_PREFIX):], "decision": r["decision"], "reason": r["reason"],
                    "by": _by(conn, r["actor_user_id"], names), "facts": _facts(details if isinstance(details, dict) else {})})
    return out
