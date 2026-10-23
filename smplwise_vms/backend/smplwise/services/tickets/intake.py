"""CR-INTAKE99 (docs/changes/CR-INTAKE99.md) as answered by the owner 2026-10-24 (questions 143-156, follow-up 267) - phases 1-3 only:
free-text WhatsApp requests become DRAFTS that a human approves. NO public page, NO web form, NO external model (rules only,
services/tickets/intake_rules.py).

What this module does:
- `accept()` is called by the inbound worker for a message that matched nothing else (`unknown_sender`). Only numbers on the MANAGED
  LIST (`ticket_intake_known`, owner 146) open a draft; any other number gets one fixed reply (owner 267) and a counter that feeds the
  daily summary. A draft is never a ticket: nothing is created, assigned, dispatched or sent to a vendor before a handler approves.
- the handler's side: list / read / edit / approve / merge / reject. Approval is `create.create_ticket()` as the approver (origin
  `inbound`), so the approver needs `tickets.create` where the ticket lies; the new request carries a "needs review" note.
- the managed list: add / change / remove a number (a person on the list is NOT added to the contact directory, owner 151).
- retention (owner 152: numbers and drafts are outside the project backup) and the daily summary of unlisted attempts.

Privacy rules kept here: audit rows and notifications carry ids, counts and field names only - never the text or a number; the number
is shown masked (last four digits); a requester's text is plain text everywhere (text_hygiene.clean_text, no linkify); the draft text
is removed by the retention step.

Permission (`tickets.intake`, owner 143): nobody by default except system administrators; department managers hold it implicitly
(`may_handle`). Managing the list needs `tickets.intake` held explicitly or `tickets.configure`."""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
import sqlite3
from typing import Any, Mapping

from ...audit import audit
from ...db import new_id
from ...errors import ApiError
from . import access, create, intake_rules as rules, model, settings_doc, store
from .access import Viewer, text
from .channel import keyed_hash, phone_digits
from .text_hygiene import clean_text

log = logging.getLogger("smplwise.tickets.intake")
UTC = dt.timezone.utc

TEXT_MAX = 2000  # per draft, after cleaning
MESSAGES_MAX = 10  # per draft (the column CHECK)
NAME_MAX = 80
ORG_MAX = 80
REJECT_REASONS = ("not_a_request", "duplicate", "spam", "abusive", "out_of_scope", "test")
NOTIFY_NEW = "ticket.intake_new"
NOTIFY_UNLISTED = "ticket.intake_unlisted"
NEEDS_REVIEW_NOTE = "נפתחה מפנייה בטקסט חופשי (וואטסאפ) - לבדיקה"
EDIT_KEYS = ("department_id", "category_id", "priority_key", "location_id", "place_other", "title", "description")
PRIORITY_KEYS = ("urgent", "high", "normal", "low")
LEXICON_KINDS = ("category", "place", "urgency", "stop", "domain_map")
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


def _iso(at: dt.datetime) -> str:
    return at.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse(value: Any) -> dt.datetime | None:
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def cfg(conn: sqlite3.Connection) -> dict[str, Any]:
    return settings_doc.read(conn)["intake"]


def is_on(conn: sqlite3.Connection) -> bool:
    """Intake works only with the tickets module AND `intake.enabled`."""
    return access.module_on(conn) and bool(cfg(conn)["enabled"])


def whatsapp_on(conn: sqlite3.Connection) -> bool:
    c = cfg(conn)
    return access.module_on(conn) and bool(c["enabled"] and c["whatsapp"])


# ---------------------------------------------------------------- permissions

def may_handle(viewer: Viewer) -> bool:
    """`tickets.intake` (system administrators by role) or a department MANAGER (owner 143: managers hold it automatically)."""
    if viewer.holds_installation(access.INTAKE):
        return True
    return access.MANAGE in viewer.anywhere and any(role == "manager" for role in viewer.roles.values())


def may_manage_list(viewer: Viewer) -> bool:
    return viewer.holds_installation(access.INTAKE) or viewer.holds_installation(access.CONFIGURE)


def require_handler(conn: sqlite3.Connection, viewer: Viewer, rid: str | None = None) -> None:
    if not may_handle(viewer):
        audit(conn, actor=viewer.principal, action="ticket.intake.access", decision="denied", resource_type="installation",
              resource_id="tickets", reason="intake_not_allowed", request_id=rid)
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לקליטת פניות."), details={"permission": access.INTAKE})


def require_list_manager(conn: sqlite3.Connection, viewer: Viewer, rid: str | None = None) -> None:
    if not may_manage_list(viewer):
        audit(conn, actor=viewer.principal, action="ticket.intake.known", decision="denied", resource_type="installation",
              resource_id="tickets", reason="intake_list_not_allowed", request_id=rid)
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה לניהול רשימת המספרים."), details={"permission": access.INTAKE})


def _invalid(conn: sqlite3.Connection, field: str, code: str) -> ApiError:
    return ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": field, "code": code}]})


# ---------------------------------------------------------------- the lexicon of this installation

def build_lexicon(conn: sqlite3.Connection) -> rules.Lexicon:
    """The shipped seed plus this installation's own names (categories and organisation locations, weight 3) and the configurer's
    rows (`ticket_intake_lexicon`): synonyms, the seed-domain -> category mapping, urgency words, stop words."""
    extra: list[rules.Entry] = []
    names: dict[str, str] = {}
    domain_map: dict[str, str] = {}
    stop: list[str] = []
    active_cats = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM ticket_categories WHERE active = 1 AND deleted_at IS NULL")}
    for cid, name in active_cats.items():
        names[cid] = name
        toks = rules.phrase_tokens(name)
        if toks:
            extra.append(rules.Entry(toks, "cat", f"cat:{cid}", rules.NAME_WEIGHT, f"N-cat-{cid}"))
    locations = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM ticket_org_locations WHERE active = 1")}
    for lid, name in locations.items():
        toks = rules.phrase_tokens(name)
        if toks:
            extra.append(rules.Entry(toks, "loc", f"loc:{lid}", rules.NAME_WEIGHT, f"N-loc-{lid}"))
    for r in conn.execute("SELECT kind, target_id, phrase FROM ticket_intake_lexicon ORDER BY created_at, id"):
        kind, target, phrase = r["kind"], r["target_id"], r["phrase"]
        if kind == "domain_map":
            if target in active_cats:
                domain_map[phrase] = target
            continue
        if kind == "stop":
            stop.append(phrase)
            continue
        toks = rules.phrase_tokens(phrase)
        if not toks:
            continue
        if kind == "category" and target in active_cats:
            extra.append(rules.Entry(toks, "cat", f"cat:{target}", rules.NAME_WEIGHT, f"S-cat-{target}"))
        elif kind == "place" and target in locations:
            extra.append(rules.Entry(toks, "loc", f"loc:{target}", rules.NAME_WEIGHT, f"S-loc-{target}"))
        elif kind == "urgency":
            if target == "urgent":
                extra.append(rules.Entry(toks, "safety", "U-custom", rules.SEED_WEIGHT, "U-custom"))
            elif target == "high":
                extra.append(rules.Entry(toks, "high", "U-high", rules.SEED_WEIGHT, "U-high-custom"))
            elif target == "low":
                extra.append(rules.Entry(toks, "low", "U-low", rules.SEED_WEIGHT, "U-low-custom"))
    return rules.seed_lexicon(extra, domain_category=domain_map, category_names=names, extra_stop=stop)


def suggestion_for(conn: sqlite3.Connection, body: str) -> dict[str, Any]:
    """The rule suggestion with the department of the category (or the installation's intake default) resolved."""
    c = cfg(conn)
    if c["classifier"] == "off":
        return {"category": {"value": None, "confidence": "none", "evidence": [], "candidates": []},
                "location": {"value": None, "confidence": "none", "evidence": []},
                "place": {"text": "", "confidence": "none", "evidence": [], "parts": []},
                "urgency": {"value": "normal", "confidence": "none", "evidence": []},
                "title": rules._title(body), "title_short": False, "flags": [], "unmapped_domains": [], "department_id": c["default_department"] or None}
    sug = rules.suggest(body, build_lexicon(conn))
    dept = None
    cat = sug["category"]["value"]
    if cat:
        row = store.category(conn, cat)
        dept = row["department_id"] if row else None
    sug["department_id"] = dept or (c["default_department"] or None)
    return sug


# ---------------------------------------------------------------- the managed list of known numbers

def _phone_key(digits: str) -> tuple[str, str | None]:
    from . import contacts

    key, key_id = contacts.phone_key_for(digits)
    if not key:
        raise ValueError("no_key")
    return key, key_id


def known_view(r: Mapping[str, Any]) -> dict[str, Any]:
    return {"id": r["id"], "display_name": r["display_name"], "org": r["org"], "phone_masked": "•••• " + r["last4"], "lang": r["lang"],
            "active": bool(r["active"]), "revision": r["revision"], "created_at": r["created_at"]}


def known_list(conn: sqlite3.Connection, viewer: Viewer, rid: str | None = None) -> dict[str, Any]:
    require_list_manager(conn, viewer, rid)
    rows = conn.execute("SELECT * FROM ticket_intake_known WHERE active = 1 ORDER BY display_name COLLATE NOCASE, id LIMIT 1000").fetchall()
    return {"known": [known_view(r) for r in rows]}


def known_add(conn: sqlite3.Connection, viewer: Viewer, body: Mapping[str, Any], rid: str | None = None) -> dict[str, Any]:
    from . import contacts

    require_list_manager(conn, viewer, rid)
    try:
        name = model.text_field(body.get("display_name"), "display_name", required=True, max_len=NAME_MAX)
        org = model.text_field(body.get("org") or "", "org", required=False, max_len=ORG_MAX)
    except model.Invalid as exc:
        raise _invalid(conn, exc.problems[0].field, exc.problems[0].code) from None
    lang = body.get("lang") or "he"
    if lang not in ("he", "en", "ar", "ru"):
        raise _invalid(conn, "lang", "choice")
    try:
        digits = contacts.normalize_phone(body.get("phone"))
    except contacts.ContactInvalid as exc:
        raise _invalid(conn, "phone", getattr(exc, "code", "format")) from None
    if not digits:
        raise _invalid(conn, "phone", "required")
    try:
        key, key_id = _phone_key(digits)
    except ValueError:
        raise ApiError(409, "module_key_missing", text(conn, "מפתח המודול אינו זמין.")) from None
    if conn.execute("SELECT 1 FROM ticket_intake_known WHERE phone_key = ? AND active = 1", (key,)).fetchone():
        raise ApiError(409, "already_listed", text(conn, "המספר כבר ברשימה."))
    now = _iso(dt.datetime.now(UTC))
    kid = new_id()
    conn.execute("INSERT INTO ticket_intake_known(id, phone_key, key_id, phone_e164, last4, display_name, org, lang, active, created_by, created_at, "
                 "updated_at, revision) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,1)", (kid, key, key_id, digits, digits[-4:], name, org, lang, viewer.uid, now, now))
    audit(conn, actor=viewer.principal, action="ticket.intake.known.add", decision="allowed", resource_type="ticket_intake_known", resource_id=kid,
          request_id=rid, details={"lang": lang})
    return known_view(conn.execute("SELECT * FROM ticket_intake_known WHERE id = ?", (kid,)).fetchone())


def known_remove(conn: sqlite3.Connection, viewer: Viewer, known_id: str, revision: int, rid: str | None = None) -> dict[str, Any]:
    require_list_manager(conn, viewer, rid)
    r = conn.execute("SELECT * FROM ticket_intake_known WHERE id = ? AND active = 1", (known_id,)).fetchone()
    if r is None:
        raise ApiError(404, "known_not_found", text(conn, "הרשומה לא נמצאה."))
    if r["revision"] != revision:
        raise ApiError(409, "known_changed", text(conn, "הרשומה השתנתה בינתיים. טענו מחדש."))
    # the row goes: the number is removed with it (no history of who was listed is kept beyond the audit row)
    conn.execute("DELETE FROM ticket_intake_known WHERE id = ?", (known_id,))
    audit(conn, actor=viewer.principal, action="ticket.intake.known.remove", decision="allowed", resource_type="ticket_intake_known",
          resource_id=known_id, request_id=rid)
    return {"ok": True}


# ---------------------------------------------------------------- the inbound hook

def accept(conn: sqlite3.Connection, *, key: bytes, digits: str | None, content: str, account_key: str | None, now: dt.datetime,
           rt: Any | None = None) -> tuple[str, str | None]:
    """A text message that matched no ticket and no RFQ (`unknown_sender`). Returns (reason, draft id): the reason is written to the
    ticket_inbound envelope. Never raises for a refusal; a database error propagates to the worker's per-event guard.
    Reasons: intake_off | intake_no_number | intake_unlisted | intake_blocked | intake_cap | intake_empty | intake_draft | intake_coalesced."""
    c = cfg(conn)
    if not (access.module_on(conn) and c["enabled"] and c["whatsapp"]):
        return "intake_off", None
    if not digits:
        return "intake_no_number", None
    sender = keyed_hash(key, digits)
    known = conn.execute("SELECT * FROM ticket_intake_known WHERE phone_key = ? AND active = 1", (sender,)).fetchone()
    if known is None:
        _unlisted(conn, c, sender, digits, now, rt)
        return "intake_unlisted", None
    body = clean_text(content, multiline=True)[:TEXT_MAX]
    if not body:
        return "intake_empty", None
    blocked = conn.execute("SELECT until FROM ticket_intake_blocks WHERE sender_key = ?", (sender,)).fetchone()
    if blocked is not None and (_parse(blocked["until"]) or now) > now:
        return "intake_blocked", None
    stamp = _iso(now)
    window = _iso(now - dt.timedelta(minutes=c["coalesce_min"]))
    open_draft = conn.execute("SELECT * FROM ticket_intake_drafts WHERE state = 'open' AND sender_key = ? AND last_message_at >= ? "
                              "ORDER BY last_message_at DESC LIMIT 1", (sender, window)).fetchone()
    if open_draft is not None and open_draft["message_count"] < MESSAGES_MAX and len(open_draft["text"] or "") + len(body) + 1 <= TEXT_MAX:
        merged = (open_draft["text"] or "") + "\n" + body
        sug = suggestion_for(conn, merged)
        conn.execute("UPDATE ticket_intake_drafts SET text = ?, message_count = message_count + 1, last_message_at = ?, suggestion_json = ?, "
                     "urgency_key = ?, flags = ?, revision = revision + 1 WHERE id = ?",
                     (merged, stamp, _dumps(sug), sug["urgency"]["value"], _dumps(sug["flags"]), open_draft["id"]))
        return "intake_coalesced", open_draft["id"]
    if _over_cap(conn, c, sender, now):
        return "intake_cap", None
    sug = suggestion_for(conn, body)
    did = new_id()
    conn.execute("INSERT INTO ticket_intake_drafts(id, channel, state, revision, received_at, last_message_at, message_count, text, sender_key, known_id, "
                 "account_key, suggestion_json, edited_json, urgency_key, flags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (did, "whatsapp", "open", 1, stamp, stamp, 1, body, sender, known["id"], account_key, _dumps(sug), "{}", sug["urgency"]["value"],
                  _dumps(sug["flags"])))
    _notify_new(conn, did, sug)
    return "intake_draft", did


def _dumps(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def _over_cap(conn: sqlite3.Connection, c: Mapping[str, Any], sender: str, now: dt.datetime) -> bool:
    def count(since: dt.timedelta, sender_key: str | None = None) -> int:
        at = _iso(now - since)
        if sender_key:
            return int(conn.execute("SELECT COUNT(*) FROM ticket_intake_drafts WHERE sender_key = ? AND received_at >= ?", (sender_key, at)).fetchone()[0])
        return int(conn.execute("SELECT COUNT(*) FROM ticket_intake_drafts WHERE received_at >= ?", (at,)).fetchone()[0])

    open_now = int(conn.execute("SELECT COUNT(*) FROM ticket_intake_drafts WHERE state = 'open'").fetchone()[0])
    return (open_now >= c["open_max"] or count(dt.timedelta(days=1), sender) >= c["sender_per_day"]
            or count(dt.timedelta(days=7), sender) >= c["sender_per_week"] or count(dt.timedelta(hours=1)) >= c["installation_per_hour"]
            or count(dt.timedelta(days=1)) >= c["installation_per_day"])


def _unlisted(conn: sqlite3.Connection, c: Mapping[str, Any], sender: str, digits: str, now: dt.datetime, rt: Any | None) -> None:
    """Owner 267: no draft; one fixed reply (bounded per number and day); the attempt is counted for the daily summary."""
    day = now.date().isoformat()
    conn.execute("INSERT INTO ticket_intake_unlisted(day, sender_key, last4, attempts, replied) VALUES (?,?,?,1,0) "
                 "ON CONFLICT(day, sender_key) DO UPDATE SET attempts = attempts + 1", (day, sender, digits[-4:]))
    row = conn.execute("SELECT attempts, replied FROM ticket_intake_unlisted WHERE day = ? AND sender_key = ?", (day, sender)).fetchone()
    if not c["unlisted_reply"] or rt is None or int(row["replied"]) >= c["unlisted_reply_per_day"]:
        return
    try:
        rt.enqueue(conn, purpose="intake_reply", channel="whatsapp", test_target=digits, template_id="starter:intake_unlisted",
                   idempotency_key=f"intake-unlisted:{day}:{sender}:{int(row['replied'])}")
        conn.execute("UPDATE ticket_intake_unlisted SET replied = replied + 1 WHERE day = ? AND sender_key = ?", (day, sender))
    except Exception as exc:  # noqa: BLE001 - a reply that cannot be queued never loses the counted attempt
        log.warning("intake unlisted reply not queued (%s)", type(exc).__name__)


def _signal(conn: sqlite3.Connection, source: str, subject_id: str | None, dedupe: str, title: str, body: str, *, resolve: bool = False) -> None:
    from .. import notify

    try:
        if resolve:
            notify.emit_full(conn, notify.Signal(source=source, subject_kind="system", subject_id=None, dedupe_key=dedupe, resolve=True))
        else:
            notify.emit_full(conn, notify.Signal(source=source, subject_kind="system", subject_id=subject_id, dedupe_key=dedupe,
                                                 params={"title": title, "body": body}, link="#/tickets?intake=1"))
    except Exception:  # noqa: BLE001 - a notification never loses a draft
        log.warning("intake notification failed", exc_info=True)


def _notify_new(conn: sqlite3.Connection, draft_id: str, sug: Mapping[str, Any]) -> None:
    safety = "safety" in sug.get("flags", [])
    _signal(conn, NOTIFY_NEW, f"intake:{draft_id}", f"ticket-intake:{draft_id}",
            "פנייה דחופה ממתינה לאישור" if safety else "פנייה חדשה ממתינה לאישור", "לאישור בתור הפניות")  # counts / urgency only: never the text


# ---------------------------------------------------------------- drafts (the handler's side)

def draft_view(conn: sqlite3.Connection, r: Mapping[str, Any], *, detail: bool = False) -> dict[str, Any]:
    sug = json.loads(r["suggestion_json"] or "{}")
    edited = json.loads(r["edited_json"] or "{}")
    known = conn.execute("SELECT display_name, org, last4 FROM ticket_intake_known WHERE id = ?", (r["known_id"],)).fetchone() if r["known_id"] else None
    text_ = r["text"] or ""
    out: dict[str, Any] = {
        "id": r["id"], "state": r["state"], "revision": r["revision"], "received_at": r["received_at"], "last_message_at": r["last_message_at"],
        "message_count": r["message_count"], "urgency": r["urgency_key"] or "normal", "flags": json.loads(r["flags"] or "[]"),
        "requester": ({"name": known["display_name"], "org": known["org"], "phone_masked": "•••• " + known["last4"]} if known else None),
        "first_line": text_.split("\n", 1)[0][:140], "ticket_id": r["ticket_id"], "reject_reason": r["reject_reason"],
        "department_id": edited.get("department_id", sug.get("department_id")),
        "category_id": edited.get("category_id", (sug.get("category") or {}).get("value")),
    }
    if detail:
        out.update({"text": text_, "suggestion": sug, "edited": edited, "duplicates": _duplicates(conn, r, sug)})
    return out


def _duplicates(conn: sqlite3.Connection, r: Mapping[str, Any], sug: Mapping[str, Any]) -> dict[str, Any]:
    """Possible duplicates: other OPEN drafts of the same sender; open tickets in the same category in the last 7 days (numbers only)."""
    same = conn.execute("SELECT id FROM ticket_intake_drafts WHERE state = 'open' AND sender_key = ? AND id <> ? LIMIT 5", (r["sender_key"], r["id"])).fetchall()
    cat = (sug.get("category") or {}).get("value")
    tickets: list[int] = []
    if cat:
        since = _iso(dt.datetime.now(UTC) - dt.timedelta(days=7))
        tickets = [x["number"] for x in conn.execute(
            "SELECT number FROM tickets WHERE category_id = ? AND created_at >= ? AND status NOT IN ('closed','cancelled') ORDER BY number DESC LIMIT 5",
            (cat, since))]
    return {"drafts": [x["id"] for x in same], "ticket_numbers": tickets}


def list_drafts(conn: sqlite3.Connection, viewer: Viewer, *, state: str = "open", limit: int = 20, offset: int = 0, rid: str | None = None) -> dict[str, Any]:
    require_handler(conn, viewer, rid)
    state = state if state in ("open", "approved", "merged", "rejected", "expired") else "open"
    limit = max(1, min(int(limit), 50))
    order = ("CASE urgency_key WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, received_at"
             if state == "open" else "received_at DESC")
    rows = conn.execute(f"SELECT * FROM ticket_intake_drafts WHERE state = ? ORDER BY {order} LIMIT ? OFFSET ?", (state, limit, max(0, int(offset)))).fetchall()
    total = int(conn.execute("SELECT COUNT(*) FROM ticket_intake_drafts WHERE state = ?", (state,)).fetchone()[0])
    return {"drafts": [draft_view(conn, r) for r in rows], "total": total, "enabled": is_on(conn)}


def _draft(conn: sqlite3.Connection, draft_id: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM ticket_intake_drafts WHERE id = ?", (draft_id,)).fetchone()
    if r is None:
        raise ApiError(404, "draft_not_found", text(conn, "הפנייה לא נמצאה."))
    return r


def get_draft(conn: sqlite3.Connection, viewer: Viewer, draft_id: str, rid: str | None = None) -> dict[str, Any]:
    require_handler(conn, viewer, rid)
    return draft_view(conn, _draft(conn, draft_id), detail=True)


def _open_draft(conn: sqlite3.Connection, draft_id: str, revision: int) -> sqlite3.Row:
    r = _draft(conn, draft_id)
    if r["state"] != "open" or r["revision"] != revision:
        raise ApiError(409, "draft_changed", text(conn, "הפנייה כבר טופלה או שהשתנתה. טענו מחדש."))
    return r


def _clean_edits(conn: sqlite3.Connection, raw: Mapping[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in raw.items():
        if k not in EDIT_KEYS:
            raise _invalid(conn, k, "unknown")
        if v is None or v == "":
            out[k] = None
            continue
        if not isinstance(v, str):
            raise _invalid(conn, k, "type")
        if k in ("department_id", "category_id", "location_id"):
            if not ID.match(v):
                raise _invalid(conn, k, "format")
            exists = {"department_id": "ticket_departments", "category_id": "ticket_categories", "location_id": "ticket_org_locations"}[k]
            if conn.execute(f"SELECT 1 FROM {exists} WHERE id = ?", (v,)).fetchone() is None:
                raise _invalid(conn, k, "unknown")
            out[k] = v
        elif k == "priority_key":
            if v not in PRIORITY_KEYS:
                raise _invalid(conn, k, "choice")
            out[k] = v
        elif k == "title":
            out[k] = model.text_field(v, "title", required=False, max_len=model.TITLE_MAX)
        elif k == "description":
            out[k] = model.text_field(v, "description", required=False, max_len=model.DESCRIPTION_MAX, multiline=True)
        else:
            out[k] = model.text_field(v, "place_text", required=False, max_len=create.PLACE_OTHER_MAX)
    return out


def edit_draft(conn: sqlite3.Connection, viewer: Viewer, draft_id: str, revision: int, values: Mapping[str, Any], rid: str | None = None) -> dict[str, Any]:
    require_handler(conn, viewer, rid)
    r = _open_draft(conn, draft_id, revision)
    try:
        clean = _clean_edits(conn, values)
    except model.Invalid as exc:
        raise _invalid(conn, exc.problems[0].field, exc.problems[0].code) from None
    edited = json.loads(r["edited_json"] or "{}")
    edited.update(clean)
    conn.execute("UPDATE ticket_intake_drafts SET edited_json = ?, revision = revision + 1 WHERE id = ?", (_dumps(edited), draft_id))
    audit(conn, actor=viewer.principal, action="ticket.intake.edit", decision="allowed", resource_type="ticket_intake_draft", resource_id=draft_id,
          request_id=rid, details={"fields": sorted(clean)})
    return draft_view(conn, _draft(conn, draft_id), detail=True)


def _feedback(conn: sqlite3.Connection, r: Mapping[str, Any], final: Mapping[str, Any], now: str) -> None:
    """Counts material only (record 4.8): the suggested vs the final id per field, never the text."""
    sug = json.loads(r["suggestion_json"] or "{}")
    pairs = {"category": ((sug.get("category") or {}).get("value"), final.get("category_id"), (sug.get("category") or {}).get("confidence")),
             "department": (sug.get("department_id"), final.get("department_id"), None),
             "urgency": ((sug.get("urgency") or {}).get("value"), final.get("priority_key") or (sug.get("urgency") or {}).get("value"),
                         (sug.get("urgency") or {}).get("confidence")),
             "location": ((sug.get("location") or {}).get("value"), final.get("location_id"), (sug.get("location") or {}).get("confidence"))}
    for field, (suggested, fin, conf) in pairs.items():
        conn.execute("INSERT OR REPLACE INTO ticket_intake_feedback(draft_id, field, suggested, final, confidence, rules, at) VALUES (?,?,?,?,?,?,?)",
                     (r["id"], field, suggested, fin, conf, "[]", now))


def _final_values(conn: sqlite3.Connection, r: Mapping[str, Any]) -> dict[str, Any]:
    c = cfg(conn)
    sug = json.loads(r["suggestion_json"] or "{}")
    edited = json.loads(r["edited_json"] or "{}")
    body = r["text"] or ""

    def pick(key: str, suggested: Any) -> Any:
        return edited[key] if key in edited else suggested

    urgency = (sug.get("urgency") or {}).get("value")
    return {
        "department_id": pick("department_id", sug.get("department_id")) or (c["default_department"] or None),
        "category_id": pick("category_id", (sug.get("category") or {}).get("value")),
        "priority_key": pick("priority_key", urgency if urgency and urgency != "normal" else None),
        "location_id": pick("location_id", (sug.get("location") or {}).get("value")),
        "place_other": pick("place_other", (sug.get("place") or {}).get("text") or "") or "",
        "title": pick("title", sug.get("title") or "") or "",
        "description": pick("description", body) or body,
    }


def approve(conn: sqlite3.Connection, viewer: Viewer, draft_id: str, revision: int, rid: str | None = None, rt: Any | None = None) -> dict[str, Any]:
    """The draft becomes ONE ordinary request through the module's one creation path, as the approver (origin `inbound`). The approver
    needs tickets.create where the ticket lies (create_ticket checks). The request carries a 'needs review' note; nothing is assigned
    or dispatched. One reply with the request number goes to the requester when `intake.approval_reply` is on (owner 144)."""
    require_handler(conn, viewer, rid)
    r = _open_draft(conn, draft_id, revision)
    v = _final_values(conn, r)
    if not v["department_id"]:
        raise _invalid(conn, "department_id", "required")
    title = v["title"] or (v["place_other"] and f"פנייה - {v['place_other']}") or "פנייה ללא נושא"
    try:
        spec = create.TicketSpec(department_id=v["department_id"], title=title, description=v["description"], category_id=v["category_id"],
                                 priority_key=v["priority_key"], origin="inbound", location_id=v["location_id"], place_other=v["place_other"])
        res = create.create_ticket(conn, spec, viewer, rid=rid)
    except model.Invalid as exc:
        raise _invalid(conn, exc.problems[0].field, exc.problems[0].code) from None
    now = _iso(dt.datetime.now(UTC))
    store.insert_event(conn, res.ticket_id, "note", actor_kind="system", actor_name="", via="system", body=NEEDS_REVIEW_NOTE,
                       data={"intake_draft": draft_id, "needs_review": True}, at=now)
    conn.execute("UPDATE ticket_intake_drafts SET state = 'approved', decided_by = ?, decided_at = ?, ticket_id = ?, revision = revision + 1 WHERE id = ?",
                 (viewer.uid, now, res.ticket_id, draft_id))
    _feedback(conn, r, v, now)
    audit(conn, actor=viewer.principal, action="ticket.intake.approve", decision="allowed", resource_type="ticket_intake_draft", resource_id=draft_id,
          request_id=rid, details={"ticket_id": res.ticket_id, "number": res.number})
    _resolve_notification(conn, draft_id)
    replied = _reply_approved(conn, r, res.number, rt)
    return {"ticket_id": res.ticket_id, "number": res.number, "reply_queued": replied}


def _reply_approved(conn: sqlite3.Connection, r: Mapping[str, Any], number: int, rt: Any | None) -> bool:
    if rt is None or not cfg(conn)["approval_reply"] or not r["known_id"]:
        return False
    known = conn.execute("SELECT phone_e164, lang FROM ticket_intake_known WHERE id = ? AND active = 1", (r["known_id"],)).fetchone()
    if known is None:
        return False
    try:
        rt.enqueue(conn, purpose="intake_reply", channel="whatsapp", test_target=known["phone_e164"], template_id=f"starter:intake_approved:{known['lang']}",
                   params={"number": str(number)}, idempotency_key=f"intake-approved:{r['id']}")
        return True
    except Exception as exc:  # noqa: BLE001 - the request exists; a failed reply never undoes an approval
        log.warning("intake approval reply not queued (%s)", type(exc).__name__)
        return False


def merge(conn: sqlite3.Connection, viewer: Viewer, draft_id: str, revision: int, ticket_id: str, rid: str | None = None) -> dict[str, Any]:
    """Attach the text to an existing request as an INTERNAL note (needs: the ticket visible and tickets.manage for its department)."""
    require_handler(conn, viewer, rid)
    r = _open_draft(conn, draft_id, revision)
    seen = access.require_visible(viewer, ticket_id)
    if not viewer.is_manager(seen.row):
        audit(conn, actor=viewer.principal, action="ticket.intake.merge", decision="denied", resource_type="ticket", resource_id=ticket_id,
              reason="not_manager", request_id=rid)
        raise ApiError(403, "forbidden", text(conn, "רק מנהל המחלקה מצרף פנייה ל{the_ticket}."), details={"permission": access.MANAGE})
    now = _iso(dt.datetime.now(UTC))
    store.insert_event(conn, ticket_id, "note", actor_kind="user", actor_user_id=viewer.uid, actor_name="", via="whatsapp",
                       body=(r["text"] or "")[:model.NOTE_MAX] or None, data={"intake_draft": draft_id, "unverified": True}, at=now)
    store.update_ticket(conn, ticket_id, {"last_activity_at": now}, bump=False)
    conn.execute("UPDATE ticket_intake_drafts SET state = 'merged', decided_by = ?, decided_at = ?, ticket_id = ?, revision = revision + 1 WHERE id = ?",
                 (viewer.uid, now, ticket_id, draft_id))
    audit(conn, actor=viewer.principal, action="ticket.intake.merge", decision="allowed", resource_type="ticket_intake_draft", resource_id=draft_id,
          request_id=rid, details={"ticket_id": ticket_id})
    _resolve_notification(conn, draft_id)
    return {"ticket_id": ticket_id}


def reject(conn: sqlite3.Connection, viewer: Viewer, draft_id: str, revision: int, reason: str, block: bool = False, rid: str | None = None) -> dict[str, Any]:
    require_handler(conn, viewer, rid)
    if reason not in REJECT_REASONS:
        raise _invalid(conn, "reason", "choice")
    r = _open_draft(conn, draft_id, revision)
    now_dt = dt.datetime.now(UTC)
    now = _iso(now_dt)
    conn.execute("UPDATE ticket_intake_drafts SET state = 'rejected', reject_reason = ?, decided_by = ?, decided_at = ?, revision = revision + 1 WHERE id = ?",
                 (reason, viewer.uid, now, draft_id))
    blocked = False
    if block and r["sender_key"]:
        until = _iso(now_dt + dt.timedelta(days=cfg(conn)["block_days"]))
        conn.execute("INSERT INTO ticket_intake_blocks(sender_key, until, by_user, at) VALUES (?,?,?,?) "
                     "ON CONFLICT(sender_key) DO UPDATE SET until = excluded.until, by_user = excluded.by_user, at = excluded.at",
                     (r["sender_key"], until, viewer.uid, now))
        blocked = True
    audit(conn, actor=viewer.principal, action="ticket.intake.reject", decision="allowed", resource_type="ticket_intake_draft", resource_id=draft_id,
          request_id=rid, details={"reason": reason, "blocked": blocked})
    _resolve_notification(conn, draft_id)
    return {"ok": True, "blocked": blocked}


def _resolve_notification(conn: sqlite3.Connection, draft_id: str) -> None:
    _signal(conn, NOTIFY_NEW, None, f"ticket-intake:{draft_id}", "", "", resolve=True)


def counts(conn: sqlite3.Connection, viewer: Viewer) -> dict[str, Any]:
    """The chip on the list: how many drafts wait (0 for someone who may not handle them - the same answer, no leak)."""
    if not may_handle(viewer) or not access.module_on(conn):
        return {"open": 0, "can": False, "enabled": False}
    n = int(conn.execute("SELECT COUNT(*) FROM ticket_intake_drafts WHERE state = 'open'").fetchone()[0])
    return {"open": n, "can": True, "enabled": is_on(conn), "list": may_manage_list(viewer)}


# ---------------------------------------------------------------- the configurer's lexicon rows

def lexicon_overview(conn: sqlite3.Connection, viewer: Viewer) -> dict[str, Any]:
    if not viewer.holds_installation(access.CONFIGURE):
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה להגדרת מילון הפניות."), details={"permission": access.CONFIGURE})
    rows = [{"id": r["id"], "kind": r["kind"], "target_id": r["target_id"], "phrase": r["phrase"]}
            for r in conn.execute("SELECT * FROM ticket_intake_lexicon ORDER BY kind, phrase LIMIT 500")]
    return {"rows": rows, "domains": rules.seed_domains(), "kinds": list(LEXICON_KINDS)}


def lexicon_add(conn: sqlite3.Connection, viewer: Viewer, body: Mapping[str, Any], rid: str | None = None) -> dict[str, Any]:
    if not viewer.holds_installation(access.CONFIGURE):
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה להגדרת מילון הפניות."), details={"permission": access.CONFIGURE})
    kind = body.get("kind")
    if kind not in LEXICON_KINDS:
        raise _invalid(conn, "kind", "choice")
    try:
        phrase = model.text_field(body.get("phrase"), "phrase", required=True, max_len=60)
    except model.Invalid as exc:
        raise _invalid(conn, "phrase", exc.problems[0].code) from None
    target = str(body.get("target_id") or "")
    if kind == "category" and not conn.execute("SELECT 1 FROM ticket_categories WHERE id = ?", (target,)).fetchone():
        raise _invalid(conn, "target_id", "unknown")
    if kind == "place" and not conn.execute("SELECT 1 FROM ticket_org_locations WHERE id = ?", (target,)).fetchone():
        raise _invalid(conn, "target_id", "unknown")
    if kind == "urgency" and target not in ("urgent", "high", "low"):
        raise _invalid(conn, "target_id", "choice")
    if kind == "domain_map":
        if phrase not in rules.seed_domains():
            raise _invalid(conn, "phrase", "unknown")
        if not conn.execute("SELECT 1 FROM ticket_categories WHERE id = ?", (target,)).fetchone():
            raise _invalid(conn, "target_id", "unknown")
        norm = phrase
    else:
        if kind == "stop":
            target = ""
        norm = " ".join(rules.phrase_tokens(phrase))
        if not norm:
            raise _invalid(conn, "phrase", "required")
    lid = new_id()
    try:
        conn.execute("INSERT INTO ticket_intake_lexicon(id, kind, target_id, phrase, norm, created_by, created_at) VALUES (?,?,?,?,?,?,?)",
                     (lid, kind, target, phrase, norm, viewer.uid, _iso(dt.datetime.now(UTC))))
    except sqlite3.IntegrityError:
        raise ApiError(409, "already_listed", text(conn, "הערך כבר קיים.")) from None
    audit(conn, actor=viewer.principal, action="ticket.intake.lexicon.add", decision="allowed", resource_type="ticket_intake_lexicon", resource_id=lid,
          request_id=rid, details={"kind": kind})
    return {"id": lid}


def lexicon_remove(conn: sqlite3.Connection, viewer: Viewer, lexicon_id: str, rid: str | None = None) -> dict[str, Any]:
    if not viewer.holds_installation(access.CONFIGURE):
        raise ApiError(403, "forbidden", text(conn, "אין הרשאה להגדרת מילון הפניות."), details={"permission": access.CONFIGURE})
    cur = conn.execute("DELETE FROM ticket_intake_lexicon WHERE id = ?", (lexicon_id,))
    if cur.rowcount == 0:
        raise ApiError(404, "lexicon_not_found", text(conn, "הערך לא נמצא."))
    audit(conn, actor=viewer.principal, action="ticket.intake.lexicon.remove", decision="allowed", resource_type="ticket_intake_lexicon",
          resource_id=lexicon_id, request_id=rid)
    return {"ok": True}


# ---------------------------------------------------------------- janitor (hourly, from messaging.janitor)

def janitor(conn: sqlite3.Connection, now: dt.datetime) -> int:
    """Expire undecided drafts, drop the text of decided ones, delete old rows, and send the daily summary of unlisted attempts."""
    c = cfg(conn)
    n = 0
    stamp = _iso(now)
    cur = conn.execute("UPDATE ticket_intake_drafts SET state = 'expired', decided_at = ?, revision = revision + 1 "
                       "WHERE state = 'open' AND received_at < ?", (stamp, _iso(now - dt.timedelta(days=c["draft_ttl_days"]))))
    n += cur.rowcount
    keep = _iso(now - dt.timedelta(days=c["rejected_keep_days"]))
    n += conn.execute("UPDATE ticket_intake_drafts SET text = NULL, suggestion_json = '{}', edited_json = '{}' "
                      "WHERE state IN ('rejected','expired') AND text IS NOT NULL AND decided_at < ?", (keep,)).rowcount
    n += conn.execute("UPDATE ticket_intake_drafts SET text = NULL, suggestion_json = '{}', edited_json = '{}' "
                      "WHERE state IN ('approved','merged') AND text IS NOT NULL AND decided_at < ?", (_iso(now - dt.timedelta(days=30)),)).rowcount
    old = _iso(now - dt.timedelta(days=90))
    n += conn.execute("DELETE FROM ticket_intake_drafts WHERE state <> 'open' AND decided_at < ?", (old,)).rowcount
    n += conn.execute("DELETE FROM ticket_intake_feedback WHERE at < ?", (_iso(now - dt.timedelta(days=365)),)).rowcount
    n += conn.execute("DELETE FROM ticket_intake_blocks WHERE until < ?", (stamp,)).rowcount
    n += conn.execute("DELETE FROM ticket_intake_unlisted WHERE day < ?", ((now - dt.timedelta(days=14)).date().isoformat(),)).rowcount
    n += daily_summary(conn, now)
    return n


def daily_summary(conn: sqlite3.Connection, now: dt.datetime) -> int:
    """Owner 267: ONE notification a day with the COUNT of attempts from unlisted numbers (yesterday); no number, no text."""
    from ...db import get_setting, set_setting

    if not (access.module_on(conn) and cfg(conn)["enabled"]):
        return 0
    day = (now - dt.timedelta(days=1)).date().isoformat()
    if get_setting(conn, "tickets.intake.summary_day") == day:
        return 0
    row = conn.execute("SELECT COUNT(*) AS senders, COALESCE(SUM(attempts), 0) AS attempts FROM ticket_intake_unlisted WHERE day = ?", (day,)).fetchone()
    set_setting(conn, "tickets.intake.summary_day", day)
    if not row["senders"]:
        return 0
    _signal(conn, NOTIFY_UNLISTED, f"intake-unlisted:{day}", f"ticket-intake-unlisted:{day}",
            "ניסיונות פנייה ממספרים שאינם ברשימה", f"{row['senders']} מספרים, {row['attempts']} הודעות - לניהול הרשימה בתור הפניות")
    return 1
