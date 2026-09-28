"""One HA action record (ha_actions) - reading it, classifying the bridge's answer and deciding its confirmation.

Shared by the single-entity route (routers/ha.py, POST /ha/entities/{id}/actions + GET /ha/actions/{id}) and the
devices area's bulk actions (services/device_bulk.py, CR-007 slice 3), so both apply exactly the same rules:
- "confirmed" only when Home Assistant reported the effect after the request - the entity's state reached the expected
  one, or the attribute that carries the effect reached the argument (ha_bridge.confirmation_kind "attribute");
- a record with nothing observable (confirmation "none") is confirmed as soon as the entity is known - the UI says
  "sent" for it, never "confirmed";
- a pending record becomes "unknown" once CONFIRM_WINDOW_S passed without that report."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any

from ..db import now_iso
from ..errors import ApiError
from . import ha_bridge
from .timeutil import parse_utc

CONFIRM_WINDOW_S = 20.0  # a pending action is "unknown" after this long without the confirming report

# States that also report an action's effect: a TV / projector turned off often reports "standby" rather than "off"
# (services/devices.py MEDIA_OFF_STATES already reads standby as off) - review round 1 of CR-007 slice 3.
EQUIVALENT_STATES: dict[str, frozenset[str]] = {"media_player.turn_off": frozenset({"off", "standby"})}


def state_matches(action_id: str, expected: str, state: str | None) -> bool:
    return state == expected or (state is not None and state in EQUIVALENT_STATES.get(action_id, frozenset()))


def action_row(conn: sqlite3.Connection, action_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM ha_actions WHERE id = ?", (action_id,)).fetchone()
    if not r:
        raise ApiError(404, "not_found", "הפעולה לא נמצאה.")
    return as_dict(r)


def as_dict(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    d["arguments"] = json.loads(d.pop("arguments_json") or "{}")
    # CR-007 slice 2 review: how this record can be confirmed - "state", "attribute" or "none". A "none" record's
    # `confirmed` status only means Home Assistant accepted the call; there is nothing to observe, and the UI says
    # "sent", never "confirmed".
    d["confirmation"] = ha_bridge.confirmation_kind(d["action_id"], d.get("expected_state"))
    return d


def bridge_status(result: dict[str, Any]) -> tuple[str, str | None]:
    """(status, error) for the bridge's answer to an execute call that returned: `pending` (accepted - the effect is
    still to be reported), `denied` (Home Assistant's own answer about this user) or `failed`."""
    ok = bool(result.get("ok"))
    error = None if ok else str(result.get("error") or "bridge_error")
    if error in ("unauthorized", "unknown_user"):
        error = "ha_" + error  # Home Assistant's own answer about this user: a denial, whatever the bridge token could do
    status = "pending" if ok else ("denied" if error in ("ha_unauthorized", "ha_unknown_user") else "failed")
    return status, error


def refresh(conn: sqlite3.Connection, a: dict[str, Any]) -> bool:
    """Advance a pending record from what Home Assistant last reported: confirmed when the entity reached the expected
    state / attribute after the request, unknown after CONFIRM_WINDOW_S. Returns True when the row was updated. The
    caller holds a write transaction (a request connection or a short write_aside)."""
    if a["status"] != "pending":
        return False
    action_id = a["id"]
    e = conn.execute("SELECT state, attributes_json, last_changed, last_updated, state_seen_at FROM ha_entities WHERE entity_id = ?", (a["entity_id"],)).fetchone()
    requested = parse_utc(a["requested_at"])
    timed_out = (dt.datetime.now(dt.timezone.utc) - requested).total_seconds() > CONFIRM_WINDOW_S

    def since_request(ts: str | None) -> bool:
        return bool(ts) and parse_utc(ts.replace("+00:00", "Z")) >= requested - dt.timedelta(seconds=2)

    if e and a["confirmation"] == "attribute":
        # the attribute that reports the effect (current_position, percentage, temperature, fan_mode, mute),
        # within its tolerance, reported after the request (last_updated: an attribute change moves it, the state's
        # last_changed does not) - never the state compared to the argument
        try:
            attrs = json.loads(e["attributes_json"] or "{}")
        except ValueError:
            attrs = {}
        spec_attr = (ha_bridge.ACTIONS.get(a["action_id"]) or {}).get("expect_attr") or {}
        if since_request(e["last_updated"]) and ha_bridge.attribute_reached(a["action_id"], a["arguments"], e["state"], attrs):
            observed = f"{spec_attr.get('attribute')}={attrs.get(spec_attr.get('attribute'))}"
            conn.execute("UPDATE ha_actions SET status = 'confirmed', confirmed_at = ?, observed_state = ? WHERE id = ?", (now_iso(), observed, action_id))
            return True
        if timed_out:
            conn.execute("UPDATE ha_actions SET status = 'unknown', observed_state = ? WHERE id = ?", (e["state"], action_id))
            return True
        return False
    if e and a["expected_state"] and state_matches(a["action_id"], a["expected_state"], e["state"]) and since_request(e["last_changed"]):
        conn.execute("UPDATE ha_actions SET status = 'confirmed', confirmed_at = ?, observed_state = ? WHERE id = ?", (now_iso(), e["state"], action_id))
        return True
    if e and not a["expected_state"]:
        conn.execute("UPDATE ha_actions SET status = 'confirmed', confirmed_at = ?, observed_state = ? WHERE id = ?", (now_iso(), e["state"], action_id))
        return True
    if timed_out:
        conn.execute("UPDATE ha_actions SET status = 'unknown', observed_state = ? WHERE id = ?", (e["state"] if e else None, action_id))
        return True
    return False
