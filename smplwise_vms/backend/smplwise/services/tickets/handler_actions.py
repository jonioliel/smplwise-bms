"""CR-038 slice 4, spec 10.3 / 10.7 / 11.2: what an external handler does through the link - set a status, add a note or a photo,
give an ETA, hand the ticket back ("לא שלי" / "לא אוכל לטפל") - and what the handler page shows.

Every write is ONE transaction (the request's `db.connection()`), and inside it, in this order:
1. the link and its ticket are read AGAIN (the lookup that admitted the request ran before the write lock): a link that
   stopped serving meanwhile - revoked, returned, reassigned, past its expiry or grace - is the uniform 404; a read-only grace
   is 409 `read_only` (W2);
2. the `ticket_requests` row of (`link:<id>:<generation>`, client_request_id) is CLAIMED (W5, review T22): a repeat replays the first
   answer, the same id on another route is 409 `request_id_reused`;
3. the effect: the ticket / assignment rows, the timeline row (`actor_kind = 'contact'`, `via = 'link'`, `visible_external = 1`),
   the audit row (actor `contact:<id>`, source `ticket_link`, an envelope only - never a note, a reason or a file);
4. the sliding expiry moves forward (spec 10.2: an action of the handler), the link's update count, the access row;
5. the request row receives the answer.
A crash anywhere rolls ALL of it back, so a retry can never apply a write twice or lose its answer.

What a handler may do is the `link` row of model.STATUS_MOVES (forward and lateral moves only; never close, never reassign -
section 11.2); a return revokes the link at once (D12). The page never sees another assignee's rows, an internal note or photo,
a phone number, a user id or another ticket (store_links.handler_events / handler_attachments)."""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from typing import Any, Mapping

from ...db import get_setting, new_id
from . import handler_links, model, naming, notify_bridge, settings_doc, sla, store, store_links
from .public_ports import LinkRecord, StoredImage
from .public_store import audit_link, fold

UTC = dt.timezone.utc
STATUS_TARGETS: tuple[str, ...] = ("acknowledged", "in_progress", "waiting_part", "done")
RETURN_KINDS = model.RETURN_KINDS
NOTE_MAX = model.NOTE_MAX
REASON_MAX = model.REASON_MAX
LANGS = ("he", "en", "ar", "ru")
RTL = frozenset({"he", "ar"})
HISTORY_LINES = 10
# D3 / D23: these domains' histories say when a building was unlocked, disarmed or opened - never shown outside, whatever any
# setting or a client says (spec 12.3; slice 3's device_context.EXTERNAL_HISTORY_NEVER is the same list)
EXTERNAL_HISTORY_NEVER = frozenset({"lock", "alarm_control_panel", "cover", "camera"})
HISTORY_ACTORS = frozenset({"automation", "schedule", "system", "device", "user", "manual", "unknown"})
OPEN_ACCESS_GAP = dt.timedelta(minutes=5)
PHOTO_ROUTE = "/t/api/photo"


class ActionRefused(Exception):
    """A refused handler write: the route answers `status` with `code` (+ small fields)."""

    def __init__(self, status: int, code: str, **extra: Any) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.extra = extra


class LinkGone(Exception):
    """The link stopped serving between the lookup and the write: the uniform 404."""


def iso(at: dt.datetime) -> str:
    return handler_links.iso(at)


def at_epoch(t: float) -> dt.datetime:
    return dt.datetime.fromtimestamp(float(t), UTC).replace(microsecond=0)


@dataclass(frozen=True)
class Fresh:
    link: LinkRecord
    row: dict[str, Any]
    ticket: dict[str, Any]
    assignment: dict[str, Any]
    contact: dict[str, Any] | None


def fresh(conn, link: LinkRecord, now: dt.datetime, *, write: bool = True) -> Fresh:
    """The link, its ticket and its assignment as they are NOW (inside the caller's transaction)."""
    row = store_links.link_by_id_joined(conn, link.link_id)
    rec = fold(row)
    t = now.timestamp()
    if rec is None or row is None or rec.generation != link.generation or not rec.available(t):
        raise LinkGone()
    if write and rec.read_only(t):
        raise ActionRefused(409, "read_only")
    ticket = store_links.ticket_of_link(conn, rec.link_id)
    assignment = store.assignment(conn, rec.assignment_id)
    if ticket is None or assignment is None:
        raise LinkGone()
    return Fresh(link=rec, row=row, ticket=ticket, assignment=assignment, contact=store_links.contact(conn, rec.contact_id))


def _scope(link: LinkRecord) -> str:
    """The idempotency scope of the public app (`link:<link_id>:<generation>`, code review V19) - one rule for every route."""
    from .public_app import idempotency_scope

    return idempotency_scope(link)


def claim(conn, link: LinkRecord, crid: str, route: str, now: dt.datetime) -> tuple[int, dict[str, Any]] | None:
    """(status, answer) of a repeat, or None after claiming the id for this write (spec 10.3 / review T22)."""
    prior = store_links.request_row(conn, _scope(link), crid)
    if prior is not None:
        if prior["route"] != route:
            raise ActionRefused(409, "request_id_reused")
        if prior["status_code"]:
            try:
                body = json.loads(prior["response_json"] or "{}")
            except ValueError:
                body = {}
            return int(prior["status_code"]), body if isinstance(body, dict) else {}
        raise ActionRefused(409, "request_in_progress", retry_after_s=2)
    if not store_links.claim_request(conn, _scope(link), crid, route, iso(now)):
        raise ActionRefused(409, "request_in_progress", retry_after_s=2)
    return None


def _finish(conn, link: LinkRecord, crid: str, status: int, body: Mapping[str, Any]) -> tuple[int, dict[str, Any]]:
    store_links.finish_request(conn, _scope(link), crid, status, dict(body))
    return status, dict(body)


def _progress(conn, f: Fresh, now: dt.datetime, client_key: str, *, extend: bool = True) -> None:
    """Spec 10.2 / 13.2: an action of the handler is progress - the sliding expiry moves, the counters move."""
    at = iso(now)
    if extend:
        handler_links.extend(conn, f.link.link_id, f.ticket["department_id"], now)
    store_links.note_update(conn, f.link.link_id)
    store.update_assignment(conn, f.assignment["id"], {"last_update_at": at})
    if client_key:  # the photo port has no request context: its upload counts as an update, not as a device
        store_links.insert_access(conn, f.link.link_id, at, "update", client_key)


def _actor_name(f: Fresh) -> str:
    return f.assignment.get("assignee_name") or (f.contact or {}).get("display_name") or ""


def _event(conn, f: Fresh, kind: str, now: dt.datetime, **kw: Any) -> int:
    return store_links.insert_contact_event(conn, f.ticket["id"], kind, contact_id=f.link.contact_id, actor_name=_actor_name(f),
                                            assignment_id=f.assignment["id"], at=iso(now), **kw)


# ---------------------------------------------------------------- the writes


def set_status(conn, link: LinkRecord, *, to: str, note: str | None, crid: str, now: dt.datetime, client_key: str,
               route: str = "/t/api/status") -> tuple[int, dict[str, Any]]:
    f = fresh(conn, link, now)
    replay = claim(conn, f.link, crid, route, now)
    if replay is not None:
        return replay
    frm = f.ticket["status"]
    if to not in STATUS_TARGETS or not model.may_move("link", frm, to):
        raise ActionRefused(409, "invalid_transition", current=frm)
    at = iso(now)
    fields: dict[str, Any] = {"status": to, "last_activity_at": at, "last_external_activity_at": at}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for(to)
    if to == "done":
        fields["done_at"] = at
    if not f.assignment.get("acknowledged_at") and to in ("acknowledged", "in_progress", "waiting_part", "done"):
        store.update_assignment(conn, f.assignment["id"], {"acknowledged_at": at})
    store.update_ticket(conn, f.ticket["id"], fields)
    _event(conn, f, "status", now, from_status=frm, to_status=to, body=note or None)
    _progress(conn, f, now, client_key)
    sla.refresh(conn, f.ticket["id"])  # slice 2: the dues follow every change of a ticket
    audit_link(conn, f.link, "ticket.status", **{"from": frm, "to": to, "actor": "link", "with_note": bool(note)})
    notify_bridge.ticket_status(conn, f.ticket["id"], frm, to)
    return _finish(conn, f.link, crid, 200, {"ok": True, "status": to})


def add_note(conn, link: LinkRecord, *, text: str, crid: str, now: dt.datetime, client_key: str,
             route: str = "/t/api/note") -> tuple[int, dict[str, Any]]:
    f = fresh(conn, link, now)
    replay = claim(conn, f.link, crid, route, now)
    if replay is not None:
        return replay
    at = iso(now)
    eid = _event(conn, f, "note", now, body=text)
    store.update_ticket(conn, f.ticket["id"], {"last_activity_at": at, "last_external_activity_at": at}, bump=False)
    _progress(conn, f, now, client_key)
    sla.refresh(conn, f.ticket["id"])
    audit_link(conn, f.link, "ticket.note")
    return _finish(conn, f.link, crid, 200, {"ok": True, "id": eid})


def set_eta(conn, link: LinkRecord, *, eta_at: str | None, crid: str, now: dt.datetime, client_key: str,
            route: str = "/t/api/eta") -> tuple[int, dict[str, Any]]:
    f = fresh(conn, link, now)
    replay = claim(conn, f.link, crid, route, now)
    if replay is not None:
        return replay
    if f.ticket["status"] not in model.HANDLING:
        raise ActionRefused(409, "invalid_state", current=f.ticket["status"])
    try:
        value = model.parse_eta(eta_at, now)
    except model.Invalid as exc:
        raise ActionRefused(422, "invalid", fields=[{"field": "eta_at", "code": exc.problems[0].code}]) from None
    at = iso(now)
    store.update_ticket(conn, f.ticket["id"], {"eta_at": value, "last_activity_at": at, "last_external_activity_at": at})
    _event(conn, f, "eta", now, data={"eta_at": value})
    _progress(conn, f, now, client_key)
    sla.refresh(conn, f.ticket["id"])  # a future ETA suppresses "stuck" until it passes (13.2)
    audit_link(conn, f.link, "ticket.eta", cleared=value is None)
    return _finish(conn, f.link, crid, 200, {"ok": True, "eta_at": value})


def give_back(conn, link: LinkRecord, *, kind: str, reason: str, crid: str, now: dt.datetime, client_key: str,
              route: str = "/t/api/return") -> tuple[int, dict[str, Any]]:
    """D12: "לא שלי" (`not_mine`) / "לא אוכל לטפל" (`cannot_handle`), a reason required: the ticket goes back to the manager and
    the link is revoked AT ONCE - the answer carries everything the page's final confirmation shows."""
    f = fresh(conn, link, now)
    replay = claim(conn, f.link, crid, route, now)
    if replay is not None:
        return replay
    frm = f.ticket["status"]
    if kind not in RETURN_KINDS:
        raise ActionRefused(422, "invalid", fields=[{"field": "kind", "code": "unknown"}])
    if frm not in model.RETURN_FROM:
        raise ActionRefused(409, "invalid_transition", current=frm)
    at = iso(now)
    store.update_assignment(conn, f.assignment["id"], {"ended_at": at, "end_reason": "returned", "return_kind": kind, "return_reason": reason,
                                                        "last_update_at": at})
    fields: dict[str, Any] = {"status": "returned", "current_assignment_id": None, "last_activity_at": at, "last_external_activity_at": at,
                              "eta_at": None}
    fields["waiting_on"], fields["waiting_reason"] = model.waiting_for("returned", kind)
    store.update_ticket(conn, f.ticket["id"], fields)
    _event(conn, f, "returned", now, from_status=frm, to_status="returned", body=reason, data={"kind": kind})
    handler_links.revoke(conn, f.row, "not_mine" if kind == "not_mine" else "returned", now)
    store_links.note_update(conn, f.link.link_id)
    store_links.insert_access(conn, f.link.link_id, at, "update", client_key)
    sla.refresh(conn, f.ticket["id"])  # unassigned again: the first-response clock restarts
    audit_link(conn, f.link, "ticket.return", kind=kind)
    notify_bridge.ticket_returned(conn, f.ticket["id"], kind)
    return _finish(conn, f.link, crid, 200, {"ok": True, "status": "returned", "kind": kind, "number": f.ticket["number"]})


def record_photo(conn, link: LinkRecord, image: StoredImage, crid: str, *, now: float, client_key: str = "") -> dict[str, Any]:
    """PhotoSink.record (public_store.SqlPhotoSink): the attachment, its timeline row, the audit row, the sliding expiry and the
    request row in ONE transaction (W5). Raising makes the photo route delete the stored file."""
    from .public_app import PublicError

    when = at_epoch(now)
    try:
        f = fresh(conn, link, when)
    except LinkGone:
        raise PublicError(404, "link_unavailable") from None
    except ActionRefused as exc:
        raise PublicError(exc.status, exc.code) from None
    prior = store_links.request_row(conn, _scope(f.link), crid)
    if prior is not None:
        # the app's Idempotency read found nothing a moment ago: a concurrent duplicate - this file goes, the retry replays
        raise PublicError(409, "request_id_reused" if prior["route"] != PHOTO_ROUTE else "request_in_progress", retry_after_s=2)
    store_links.claim_request(conn, _scope(f.link), crid, PHOTO_ROUTE, iso(when))
    at = iso(when)
    att_id = new_id()
    eid = _event(conn, f, "photo", when, data={"attachment_id": att_id})
    store.insert_attachment(conn, {"id": att_id, "ticket_id": f.ticket["id"], "event_id": eid, "kind": "photo", "path": image.rel_path,
                                   "sha256": image.sha256, "bytes": image.bytes, "width": image.width, "height": image.height,
                                   "uploaded_by_kind": "contact", "uploaded_by": f.link.contact_id, "visible_external": 1, "created_at": at})
    store.update_ticket(conn, f.ticket["id"], {"last_activity_at": at, "last_external_activity_at": at}, bump=False)
    _progress(conn, f, when, client_key)
    sla.refresh(conn, f.ticket["id"])
    audit_link(conn, f.link, "ticket.photo", attachment_id=att_id, bytes=image.bytes)
    answer = {"id": att_id, "width": image.width, "height": image.height}
    store_links.finish_request(conn, _scope(f.link), crid, 201, answer)
    return answer


def record_open(conn, link: LinkRecord, now: dt.datetime, client_key: str) -> None:
    """An open of the page WITH the token (spec 9.7 / D14 "הקישור נפתח ב-..."): the first one writes the timeline line, every one
    moves the counters, one access row per device every few minutes. Never extends the link (a preview must not keep it alive)."""
    at = iso(now)
    first = store_links.note_open(conn, link.link_id, at)
    if first:
        ticket = store_links.ticket_of_link(conn, link.link_id)
        asg = store.assignment(conn, link.assignment_id)
        if ticket is not None:
            store_links.insert_contact_event(conn, ticket["id"], "link_opened", contact_id=link.contact_id,
                                             actor_name=(asg or {}).get("assignee_name") or "", assignment_id=link.assignment_id, at=at,
                                             data={"generation": link.generation}, visible_external=False)
    if not store_links.recent_access(conn, link.link_id, "open", client_key, iso(now - OPEN_ACCESS_GAP)):
        store_links.insert_access(conn, link.link_id, at, "open", client_key)


# ---------------------------------------------------------------- the page


def _priority(conn, ticket: dict[str, Any]) -> dict[str, Any] | None:
    p = store.priority(conn, ticket["priority_id"])
    return {"key": p["key"], "name": p["name"]} if p else None


def _history(conn, ticket: dict[str, Any], assignment: dict[str, Any]) -> list[dict[str, Any]] | None:
    """D3 / D23: at most 10 lines of the frozen 24 h snapshot, only when THIS assignment shares it, never for a security domain,
    never a person's name or an attribute dump."""
    if not assignment.get("share_history") or not ticket.get("entity_id"):
        return None
    if str(ticket["entity_id"]).split(".", 1)[0] in EXTERNAL_HISTORY_NEVER:
        return None
    ctx = store_links.device_context(conn, ticket["id"])
    if ctx is None or ctx.get("withheld") or ctx.get("source") == "none":
        return None
    try:
        items = json.loads(ctx.get("items_json") or "[]")
    except ValueError:
        return None
    out: list[dict[str, Any]] = []
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict) or not isinstance(it.get("at"), str):
            continue
        actor = it.get("actor") if isinstance(it.get("actor"), dict) else {}
        kind = actor.get("type") if actor.get("type") in HISTORY_ACTORS else "unknown"
        line = {"at": it["at"][:25], "from": _state_text(it.get("from")), "to": _state_text(it.get("to") if "to" in it else it.get("state")),
                "actor": kind}
        out.append(line)
        if len(out) >= HISTORY_LINES:
            break
    return out


def _state_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)[:40]
    from .text_hygiene import clean_text

    return clean_text(text) or None


def view(conn, link: LinkRecord, *, code_ok: bool, read_only: bool, now: dt.datetime) -> dict[str, Any]:
    """GET /t/api/ticket. Without a code session on a code-protected link: the number, the department and the organisation
    only (spec 10.5 - a forwarded link alone discloses nothing beyond "a ticket exists")."""
    ticket = store_links.ticket_of_link(conn, link.link_id)
    if ticket is None:
        raise LinkGone()
    contact = store_links.contact(conn, link.contact_id) or {}
    lang = contact.get("lang") if contact.get("lang") in LANGS else "he"
    names = naming.names_for(conn, lang)
    doc = settings_doc.read(conn)
    dept = store.department_any(conn, ticket["department_id"]) or {}
    out: dict[str, Any] = {
        "number": ticket["number"],
        "department": dept.get("name") or "",
        "organization": doc["organization_name"],
        "lang": lang,
        "dir": "rtl" if lang in RTL else "ltr",
        "labels": {"one": names["one"], "many": names["many"], "gender": names["gender"]},
        "time_zone": get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem",
        "code_required": bool(link.require_code),
        "code_ok": bool(code_ok),
        "read_only": bool(read_only),
        "read_only_until": iso(at_epoch(link.grace_until)) if read_only and link.grace_until else None,
        "expires_at": iso(at_epoch(link.expires_at)),
    }
    if link.require_code and not code_ok:
        return out
    asg = store.assignment(conn, link.assignment_id) or {}
    since = store_links.first_assigned_at(conn, ticket["id"], link.contact_id) or asg.get("assigned_at") or ticket["created_at"]
    status = ticket["status"]
    a_count, t_count = store_links.photo_counts(conn, ticket["id"], link.assignment_id)
    from .image_intake import MAX_BYTES, PHOTOS_PER_ASSIGNMENT, PHOTOS_PER_TICKET

    photos_left = max(0, min(PHOTOS_PER_ASSIGNMENT - a_count, PHOTOS_PER_TICKET - t_count))
    writable = not read_only and status not in model.FINAL and status != "returned"
    moves = [to for to in STATUS_TARGETS if model.may_move("link", status, to)] if writable else []
    timeline = []
    for ev in store_links.handler_events(conn, ticket["id"], link.contact_id, since):
        try:
            data = json.loads(ev.get("data_json") or "{}")
        except ValueError:
            data = {}
        data = data if isinstance(data, dict) else {}
        mine = ev["actor_kind"] == "contact"
        item: dict[str, Any] = {"id": ev["id"], "at": ev["at"], "kind": ev["kind"], "mine": mine, "name": "" if mine else (ev.get("actor_name") or ""),
                                "from": ev.get("from_status"), "to": ev.get("to_status"), "body": ev.get("body")}
        if ev["kind"] == "photo" and isinstance(data.get("attachment_id"), str):
            item["photo_id"] = data["attachment_id"]
        if ev["kind"] == "eta":
            item["eta_at"] = data.get("eta_at")
        if ev["kind"] == "returned":
            item["return_kind"] = data.get("kind")
        timeline.append(item)
    photos = [{"id": a["id"], "at": a["created_at"], "width": a["width"], "height": a["height"], "mine": a["uploaded_by_kind"] == "contact"}
              for a in store_links.handler_attachments(conn, ticket["id"], link.contact_id, since)]
    out.update({
        "title": ticket["title"],
        "description": ticket.get("description") or "",
        "priority": _priority(conn, ticket),
        "place_text": ticket.get("place_text") or "",
        "device_name": ticket.get("device_name") or "",
        "status": status,
        "eta_at": ticket.get("eta_at"),
        "assigned_by": store.display_name(conn, asg.get("assigned_by")) if asg.get("assigned_by") else "",
        "assigned_at": asg.get("assigned_at"),
        "created_at": ticket["created_at"],
        "actions": {
            "statuses": moves,
            "note": writable,
            "eta": writable and status in model.HANDLING,
            "photo": writable and photos_left > 0,
            "return": writable and status in model.RETURN_FROM,
        },
        "timeline": timeline,
        "photos": photos,
        "history": _history(conn, ticket, asg),
        "limits": {"note_max": NOTE_MAX, "reason_max": REASON_MAX, "photo_max_bytes": MAX_BYTES, "photos_left": photos_left},
    })
    return out
