"""TKDETAILBE (docs/tickets/DETAIL_BACKEND_CONTRACT.md section 6; owner feedback 15.10 #4): ONE time-ordered list for the request
screen - messages to / from the vendor, internal notes, status changes, quotes, payment demands and owner changes - built from the
existing `ticket_events` rows (nothing is stored twice) plus the outbox rows that have not left yet.

Visibility: the existing `access.event_visible` rule (a limited viewer gets the rows marked external and their own); the queued /
held outbox rows only for managers and holders of tickets.external (as the delivery lines of the ticket answer). Cost rows carry
ids, versions and actions only - never an amount. Inbound vendor messages (the handler page's notes, WhatsApp replies that were
matched or attached) are `message` rows with `direction: in`; nothing sent outside the system is logged (owner decision 4)."""
from __future__ import annotations

import json
from typing import Any, Mapping

from . import access, model, store
from .access import Seen, Viewer, event_visible

FILTERS = ("all", "messages", "notes", "status", "costs")
STATUS_KINDS = frozenset({"created", "status", "closed", "cancelled", "reopened", "assigned", "reassigned", "returned", "auto_closed"})
OUT_MESSAGE_KINDS = {"link_sent": "sent", "update_sent": "sent", "reminder": "sent", "code_sent": "sent", "message_unknown": "unknown",
                     "message_failed": "failed", "message_fallback": "failed", "cost_message": None}
IN_MESSAGE_KINDS = frozenset({"inbound", "late_reply"})
QUOTE_KINDS = frozenset({"quote_submitted", "quote_decided"})
DEMAND_KINDS = frozenset({"cost_submitted", "cost_decision"})
PHOTO_KINDS = frozenset({"photo", "photo_removed"})
LIMIT_DEFAULT, LIMIT_MAX = 50, 200
FILTER_TYPES = {"messages": {"message"}, "notes": {"internal_note"}, "status": {"status_event", "owner_change"}, "costs": {"quote", "demand"}}


def _data(ev: Mapping[str, Any]) -> dict[str, Any]:
    try:
        d = json.loads(ev.get("data_json") or "{}")
    except ValueError:
        return {}
    return d if isinstance(d, dict) else {}


def classify(ev: Mapping[str, Any]) -> str:
    kind = ev["kind"]
    if kind == "note":
        if ev["actor_kind"] in ("contact", "inbound"):
            return "message"
        return "message" if ev.get("visible_external") else "internal_note"
    if kind in OUT_MESSAGE_KINDS or kind in IN_MESSAGE_KINDS:
        return "message"
    if kind in STATUS_KINDS:
        return "status_event"
    if kind in QUOTE_KINDS:
        return "quote"
    if kind in DEMAND_KINDS:
        return "demand"
    if kind == "owner_changed":
        return "owner_change"
    if kind in PHOTO_KINDS:
        return "photo"
    return "system"


def _item(ev: Mapping[str, Any], uid: str, *, can_forward: bool) -> dict[str, Any]:
    data = _data(ev)
    typ = classify(ev)
    item: dict[str, Any] = {
        "id": f"ev:{ev['id']}", "type": typ, "kind": ev["kind"], "at": ev["at"],
        "actor": {"kind": ev["actor_kind"], "name": ev.get("actor_name") or "", "me": ev.get("actor_user_id") == uid},
        "body": ev.get("body"), "external": bool(ev.get("visible_external")),
    }
    if typ == "message":
        if ev["kind"] == "note":
            incoming = ev["actor_kind"] in ("contact", "inbound")
            channel = "page" if ev["via"] in ("link", "app") else ev["via"]
            from_note = data.get("from_note_id")
            item["message"] = {"direction": "in" if incoming else "out", "channel": channel, "purpose": None, "delivery": None,
                               "from_note_id": f"ev:{from_note}" if isinstance(from_note, int) else None,
                               "unverified": bool(data.get("unverified")), "external_id": None,
                               "notified": data.get("notified") if not incoming else None}
        elif ev["kind"] in IN_MESSAGE_KINDS:
            item["message"] = {"direction": "in", "channel": "whatsapp" if ev["via"] == "whatsapp" else ev["via"], "purpose": None,
                               "delivery": None, "from_note_id": None, "unverified": True, "external_id": None, "late": ev["kind"] == "late_reply"}
        else:
            state = OUT_MESSAGE_KINDS[ev["kind"]]
            if state is None:  # cost_message: queued or not
                state = "queued" if data.get("queued") else "failed"
            item["message"] = {"direction": "out", "channel": data.get("channel"), "purpose": data.get("purpose"),
                               "delivery": {"state": state, "at": ev["at"]}, "from_note_id": None, "unverified": False, "external_id": None}
            item["body"] = None  # a templated notification: the text is the template, never stored
    elif typ == "status_event":
        to = ev.get("to_status")
        item["status"] = {"from": ev.get("from_status"), "to": "in_progress" if to == "waiting_part" else to,
                          "sub_state": "waiting_part" if to == "waiting_part" else None, "stored_to": to,
                          "on_behalf": bool(data.get("on_behalf")), "unverified": bool(data.get("unverified"))}
        if ev["kind"] in ("assigned", "reassigned"):
            item["status"]["assignee"] = data.get("assignee")
            item["status"]["assignee_kind"] = data.get("assignee_kind")
    elif typ == "quote":
        item["cost"] = {"subject": "quote", "id": data.get("quote_id"), "version": data.get("version"),
                        "action": data.get("action") or "submitted", "on_behalf": bool(data.get("on_behalf"))}
    elif typ == "demand":
        item["cost"] = {"subject": "claim", "id": data.get("claim_id"), "version": data.get("seq"),
                        "action": data.get("action") or "submitted", "on_behalf": bool(data.get("on_behalf"))}
    elif typ == "owner_change":
        item["owner"] = {"from": data.get("from"), "to": data.get("to"), "source": data.get("source")}
    elif typ == "photo":
        item["photo"] = {"attachment_id": data.get("attachment_id")}
    else:
        item["data"] = {k: v for k, v in data.items() if k in ("eta_at", "generation", "kind", "level", "fields")}
    item["can"] = {"forward": bool(can_forward and typ == "internal_note")}
    return item


def _pending_outbox(conn, seen: Seen) -> list[dict[str, Any]]:
    from . import outbox_store as obs

    out = []
    for r in obs.rows_of_ticket(conn, seen.row["id"], 50):
        if r.state not in ("queued", "held", "sending"):
            continue
        at = obs.iso_s(r.created_at)
        out.append({"id": f"ob:{r.id}", "type": "message", "kind": "outbox", "at": at,
                    "actor": {"kind": "system", "name": "", "me": False}, "body": None, "external": True,
                    "message": {"direction": "out", "channel": r.channel, "purpose": r.purpose,
                                "delivery": {"state": "held" if r.state == "held" else "queued", "at": at,
                                             "held_reason": r.held_reason, "not_before": obs.iso_s(r.not_before)},
                                "from_note_id": None, "unverified": False, "external_id": None},
                    "can": {"forward": False}})
    return out


def _key(item: Mapping[str, Any]) -> tuple[str, int, str]:
    iid = str(item["id"])
    return (item["at"], 0 if iid.startswith("ev:") else 1, iid if iid.startswith("ob:") else f"{int(iid[3:]):012d}")


def _cursor(item: Mapping[str, Any]) -> str:
    return f"{item['at']}|{item['id']}"


def build(conn, viewer: Viewer, seen: Seen, *, flt: str = "all", limit: int = LIMIT_DEFAULT, before: str | None = None) -> dict[str, Any]:
    if flt not in FILTERS:
        flt = "all"
    limit = max(1, min(int(limit), LIMIT_MAX))
    uid = viewer.uid
    can_forward = seen.manager and viewer.holds(access.EXTERNAL, seen.row) and seen.row["status"] not in model.FINAL
    items = [_item(e, uid, can_forward=can_forward) for e in store.events(conn, seen.row["id"]) if event_visible(seen, e, uid)]
    if seen.manager or viewer.holds(access.EXTERNAL, seen.row):
        items += _pending_outbox(conn, seen)
    items.sort(key=_key)
    counts = {"all": len(items)}
    for name, types in FILTER_TYPES.items():
        counts[name] = sum(1 for i in items if i["type"] in types)
    if flt != "all":
        items = [i for i in items if i["type"] in FILTER_TYPES[flt]]
    if before:
        items = [i for i in items if _cursor(i) != before and _key(i) < _parse_cursor(before, items)]
    page = items[-limit:]
    more = len(items) > len(page)
    return {"items": page, "next_before": _cursor(page[0]) if more and page else None, "counts": counts, "filter": flt}


def _parse_cursor(cursor: str, items: list[dict[str, Any]]) -> tuple[str, int, str]:
    at, _, iid = cursor.partition("|")
    if iid.startswith("ev:") and iid[3:].isdigit():
        return (at, 0, f"{int(iid[3:]):012d}")
    if iid.startswith("ob:"):
        return (at, 1, iid)
    return (at, 0, "")
