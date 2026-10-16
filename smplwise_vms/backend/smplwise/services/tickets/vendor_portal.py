"""VPORTAL (owner-approved design 2026-10-16): the vendor portal - a NEW PUBLIC AUTHENTICATION SURFACE on the public listener.

A vendor opens `/support` (the public prefix, no link), types a mobile number and receives a one-time code over WhatsApp - if, and
only if, that number belongs to a directory row that has something to show. After the code: a READ-ONLY session of 30 minutes that
lists the vendor's open service requests and the ones closed within `vendor_portal.closed_months` (default 2), with the quote and the
payment demand (amount + status, paid / unpaid). An item opens the EXISTING handler page of that assignment (its live link, with its
own rules - a code-protected link still asks for its code); the portal itself writes nothing about any request.

OFF by default (`tickets.settings.vendor_portal.enabled`, edited with `system.configure`); with the switch off (or the module off)
every portal route answers the public uniform 404 and the page shows what it showed before.

Security rules (docs/changes/CR-VENDOR-PORTAL.md, threat model):
- NO ENUMERATION: the request answers the same 202 for a known and an unknown number; the work that differs (who the number belongs
  to, the message) runs AFTER the answer was sent (public_portal.py, a background task) - same bytes, same timing class. A code row is
  written for EVERY accepted request, also for an unknown number (nothing is sent, `contact_id` NULL), so verification walks the same
  path (row, HMAC compare, attempt count) whoever the number belongs to. Every failed verification is the same 422 `code_invalid`.
- BRUTE FORCE: 6 digits, 10 minutes, single use, 5 wrong guesses end the code; per number 1 request / 60 s, 3 / hour, 6 / day (rows of
  unknown numbers count too); per client network and installation-wide in the public rate gate (ratelimit.py `portal_*`); at most
  SENT_PER_DAY messages a day for the installation (WhatsApp cost). A cap answers the same 202 and sends nothing.
- STORAGE: the number is never stored - only its keyed index (links.phone_key under the module key); the code is never stored -
  HMAC-SHA256(k_tickets, 'vp|' id | phone_key | code), the digits derived from the 128-bit row id at render time (codes.derive_code,
  W9); the session value (256 bits) only as its SHA-256. Nothing of a number, a code or a session reaches a log line or an audit row.
- FAIL CLOSED: no module key, no WhatsApp channel, a changed number, a key rotation, an erased / deactivated / staff row, a row whose
  number verification is required and not done (phone_verify.whatsapp_allowed): nothing is sent, nothing is shown.
- SCOPE: a session sees the rows whose CURRENT keyed number is the session's (re-read on every request), never another number's;
  item ids are opaque per session (HMAC of the session and the assignment), so an id from another session or a guessed one is the
  uniform 404. Never bank details or other sensitive data: the item answer is an allow-list (ITEM_KEYS); the module collects no bank
  data at all (payment references and dates of the cost claim are never served here)."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import logging
import unicodedata
from dataclasses import dataclass
from typing import Any, Mapping

from ...audit import audit
from ...db import get_setting
from . import access, codes as codes_mod, handler_links, links, naming, settings_doc, store, store_links
from .keyring import KEYS

log = logging.getLogger("smplwise.tickets.vendor_portal")

CODE_TTL = dt.timedelta(minutes=10)  # the fixed `phone_verify` message says "valid for 10 minutes"
MAX_ATTEMPTS = 5
COOLDOWN = dt.timedelta(seconds=60)
PER_NUMBER_HOUR = 3
PER_NUMBER_DAY = 6
SENT_PER_DAY = 200  # messages for the whole installation per day (cost abuse of the WhatsApp account)
SESSION_TTL = dt.timedelta(minutes=30)  # absolute: never extended
KEEP = dt.timedelta(days=2)
ITEMS_MAX = 200
HOUR = dt.timedelta(hours=1)
DAY = dt.timedelta(days=1)
LANGS = ("he", "en", "ar", "ru")
OPEN_EXCLUDED = ("closed", "cancelled")
# what an item may carry - nothing else ever leaves (tests/test_tickets_vendor_portal.py asserts the exact key set)
ITEM_KEYS = frozenset({"id", "number", "title", "place", "department", "state", "status", "end_reason", "created_at", "assigned_at",
                       "ended_at", "eta_at", "quote", "demand", "can_open"})
QUOTE_KEYS = frozenset({"state", "total_minor", "currency"})
DEMAND_KEYS = frozenset({"status", "total_minor", "currency", "paid", "no_charge"})


@dataclass(frozen=True)
class PortalActor:
    """The synthetic principal of the portal's audit rows: it holds no permission anywhere."""

    contact_id: str | None = None
    source = "vendor_portal"

    @property
    def user_id(self) -> str:
        return f"contact:{self.contact_id}" if self.contact_id else "vendor_portal"

    @property
    def username(self) -> str:
        return "vendor_portal"


@dataclass(frozen=True)
class Session:
    id_hash: str
    phone_key: str
    key_id: str
    created_at: str
    expires_at: str


# ---------------------------------------------------------------- the switch and the number


def enabled(conn) -> bool:
    try:
        return access.module_on(conn) and bool(settings_doc.read(conn)["vendor_portal"]["enabled"])
    except Exception:  # noqa: BLE001 - an unreadable document or a database before the migrations: off (fail closed)
        return False


def closed_months(conn) -> int:
    try:
        return int(settings_doc.read(conn)["vendor_portal"]["closed_months"])
    except Exception:  # noqa: BLE001
        return 2


def canonical_phone(raw: Any) -> str | None:
    """One canonical form (E.164 digits, no '+') of what a person types, or None. Israeli formats: `050-900-7676`, `0509007676`,
    `+972 50 900 7676`, `+972-50-9007676`, `00972509007676`, `972509007676`, and the common `+972 050...` (the trunk 0 kept after the
    country code) all give `972509007676`. Decimal digits of any script are read as ASCII; spaces, dashes, dots and parentheses are
    ignored. contacts.normalize_phone is the directory's own rule (the number on file was stored by it), so the same input gives the
    same key here as on the contact row. Never raises."""
    from .contacts import ContactInvalid, normalize_phone

    if not isinstance(raw, str) or len(raw) > 40:
        return None
    chars: list[str] = []
    for ch in raw:
        d = unicodedata.decimal(ch, None)
        chars.append(str(d) if d is not None else ch)
    try:
        digits = normalize_phone("".join(chars))
    except ContactInvalid:
        return None
    if digits is None:
        return None
    if digits.startswith("9720") and len(digits) == 13:
        digits = "972" + digits[4:]
    return digits if 8 <= len(digits) <= 15 else None


def number_key(digits: str) -> tuple[str, str] | None:
    """(phone_key, key_id) of a canonical number under the CURRENT module key, or None (no key: fail closed). Never creates a key."""
    try:
        key_id, key = KEYS.current(create=False)
    except Exception:  # noqa: BLE001 - no module key yet / a damaged key file
        return None
    pk = links.phone_key(key, digits)
    return (pk, key_id) if pk else None


def _iso(t: dt.datetime) -> str:
    return handler_links.iso(t)


def _code_hash(key: bytes, vid: str, phone_key: str, code: str) -> str:
    return hmac.new(bytes(key), f"vp|{vid}|{phone_key}|{code}".encode("ascii"), hashlib.sha256).hexdigest()


# ---------------------------------------------------------------- who the number belongs to and what it may see


def contacts_of(conn, phone_key: str) -> list[dict[str, Any]]:
    """The directory rows the portal serves for this keyed number: a live (active, not erased) contact or vendor row whose CURRENT
    number has this key - never a row that names an internal user (staff use the app), never an employee row without an account,
    never a row whose WhatsApp number verification is required and not done (TKNOTIFOTP: a number nobody proved owns it)."""
    from . import phone_verify

    rows = conn.execute("SELECT * FROM ticket_contacts WHERE phone_key = ? AND erased_at IS NULL AND active = 1 AND user_id IS NULL "
                        "AND COALESCE(employee, 0) = 0 ORDER BY created_at, id", (phone_key,)).fetchall()
    out = []
    for r in rows:
        row = dict(r)
        if not row.get("phone_e164"):
            continue
        if not phone_verify.whatsapp_allowed(conn, row):
            continue
        out.append(row)
    return out


def _since(now: dt.datetime, months: int) -> str:
    return _iso(now - dt.timedelta(days=30 * max(1, int(months))))


def _assignment_rows(conn, contact_ids: list[str], since: str, limit: int = ITEMS_MAX) -> list[dict[str, Any]]:
    if not contact_ids:
        return []
    marks = ",".join("?" * len(contact_ids))
    rows = conn.execute(
        "SELECT a.id AS a_id, a.ticket_id, a.contact_id, a.assigned_at, a.ended_at, a.end_reason, "
        "t.number, t.title, t.place_text, t.device_name, t.department_id, t.status, t.created_at, t.closed_at, t.eta_at, t.current_assignment_id "
        "FROM ticket_assignments a JOIN tickets t ON t.id = a.ticket_id "
        f"WHERE a.assignee_kind = 'contact' AND a.contact_id IN ({marks}) "  # noqa: S608 - placeholders only
        "AND ((a.ended_at IS NULL AND t.status NOT IN ('closed', 'cancelled')) "
        "     OR COALESCE(a.ended_at, t.closed_at, t.updated_at) >= ?) "
        "ORDER BY (a.ended_at IS NULL AND t.status NOT IN ('closed', 'cancelled')) DESC, COALESCE(a.ended_at, t.closed_at, a.assigned_at) DESC, a.id "
        "LIMIT ?", (*contact_ids, since, limit)).fetchall()
    return [dict(r) for r in rows]


def has_items(conn, contacts: list[dict[str, Any]], now: dt.datetime, months: int) -> bool:
    return bool(_assignment_rows(conn, [c["id"] for c in contacts], _since(now, months), limit=1))


def _quote(conn, assignment_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT state, total_minor, approved_total_minor, currency FROM ticket_quotes WHERE assignment_id = ? "
                     "ORDER BY version DESC LIMIT 1", (assignment_id,)).fetchone()
    if r is None:
        return None
    approved = r["state"] in ("approved", "partially_approved") and r["approved_total_minor"] is not None
    return {"state": r["state"], "total_minor": int(r["approved_total_minor"] if approved else r["total_minor"]), "currency": r["currency"]}


def _demand(conn, assignment_id: str) -> dict[str, Any] | None:
    """The payment demand (cost claim) of the assignment: status, amount, paid / unpaid. NEVER the payment reference or date."""
    r = conn.execute("SELECT status, currency, no_charge, current_revision_id, approved_total_minor FROM ticket_cost_claims WHERE assignment_id = ?",
                     (assignment_id,)).fetchone()
    if r is None:
        return None
    total: int | None = None
    if r["status"] in ("approved", "paid") and r["approved_total_minor"] is not None:
        total = int(r["approved_total_minor"])
    elif r["current_revision_id"]:
        rev = conn.execute("SELECT total_minor FROM ticket_cost_revisions WHERE id = ?", (r["current_revision_id"],)).fetchone()
        total = int(rev["total_minor"]) if rev is not None else None
    return {"status": r["status"], "total_minor": 0 if r["no_charge"] else total, "currency": r["currency"],
            "paid": r["status"] == "paid", "no_charge": bool(r["no_charge"])}


def item_id(sess: Session, assignment_id: str) -> str:
    """An opaque id of an item, valid in THIS session only (an id from another session, or a guessed one, matches nothing)."""
    return hmac.new(sess.id_hash.encode("ascii"), f"vpi|{assignment_id}".encode("ascii"), hashlib.sha256).hexdigest()[:24]


def _live_link(conn, assignment_id: str, now: dt.datetime):
    from .public_store import fold

    row = store_links.link_for_assignment(conn, assignment_id)
    if row is None:
        return None
    rec = fold(store_links.link_by_id_joined(conn, row["id"]))
    if rec is None or rec.no_money or not rec.available(now.timestamp()):
        return None
    return rec


def view(conn, sess: Session, now: dt.datetime) -> dict[str, Any]:
    """GET /t/api/portal/items: the brand, the vendor's language and labels, the items (allow-listed keys only) and the time left."""
    from . import brand

    contacts = contacts_of(conn, sess.phone_key)
    lang = next((c.get("lang") for c in contacts if c.get("lang") in LANGS), "he")
    names = naming.names_for(conn, lang)
    months = closed_months(conn)
    depts: dict[str, str] = {}
    items: list[dict[str, Any]] = []
    for r in _assignment_rows(conn, [c["id"] for c in contacts], _since(now, months)):
        if r["department_id"] not in depts:
            depts[r["department_id"]] = (store.department_any(conn, r["department_id"]) or {}).get("name") or ""
        open_ = r["ended_at"] is None and r["status"] not in OPEN_EXCLUDED
        place = ", ".join(p for p in (r.get("device_name") or "", r.get("place_text") or "") if p)
        items.append({
            "id": item_id(sess, r["a_id"]), "number": r["number"], "title": r["title"], "place": place, "department": depts[r["department_id"]],
            "state": "open" if open_ else "closed",
            "status": r["status"] if (open_ or r["end_reason"] in (None, "closed", "cancelled")) else "ended",
            "end_reason": r["end_reason"] if r["end_reason"] in ("reassigned", "returned") else None,
            "created_at": r["created_at"], "assigned_at": r["assigned_at"], "ended_at": r["ended_at"] or r["closed_at"],
            "eta_at": r["eta_at"] if open_ else None,
            "quote": _quote(conn, r["a_id"]), "demand": _demand(conn, r["a_id"]),
            "can_open": _live_link(conn, r["a_id"], now) is not None,
        })
    left = int((handler_links.parse(sess.expires_at) - now).total_seconds())
    return {**brand.public_brand(conn), "lang": lang, "dir": "rtl" if lang in ("he", "ar") else "ltr",
            "labels": {"one": names["one"], "many": names["many"], "gender": names["gender"]},
            "time_zone": get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem",
            "theme": settings_doc.read(conn)["public"].get("theme", "light"),
            "closed_months": months, "expires_in_s": max(0, left), "items": items}


def config(conn) -> dict[str, Any]:
    """GET /t/api/portal/config (only while the portal is on): what the sign-in screen shows - the brand and the look."""
    from . import brand

    return {**brand.public_brand(conn), "theme": settings_doc.read(conn)["public"].get("theme", "light"),
            "code_ttl_s": int(CODE_TTL.total_seconds()), "session_ttl_s": int(SESSION_TTL.total_seconds())}


# ---------------------------------------------------------------- the code (request -> WhatsApp -> verify)


def _count(conn, where: str, args: tuple[Any, ...]) -> int:
    return int(conn.execute(f"SELECT COUNT(*) FROM ticket_portal_codes WHERE {where}", args).fetchone()[0])  # noqa: S608 - fixed text


def request_code(conn, digits: str, now: dt.datetime) -> str:
    """The work behind POST /t/api/portal/start, run AFTER the uniform answer left (public_portal.py). Returns what happened, for
    tests only (`capped` | `unknown` | `sent` | `unavailable` | `nokey`) - never sent to the client, never logged with the number."""
    from . import messaging

    nk = number_key(digits)
    if nk is None:
        return "nokey"
    phone_key, key_id = nk
    conn.execute("DELETE FROM ticket_portal_codes WHERE created_at < ?", (_iso(now - KEEP),))
    last = conn.execute("SELECT MAX(created_at) FROM ticket_portal_codes WHERE phone_key = ?", (phone_key,)).fetchone()[0]
    if ((last and last > _iso(now - COOLDOWN)) or _count(conn, "phone_key = ? AND created_at > ?", (phone_key, _iso(now - HOUR))) >= PER_NUMBER_HOUR
            or _count(conn, "phone_key = ? AND created_at > ?", (phone_key, _iso(now - DAY))) >= PER_NUMBER_DAY):
        return "capped"
    try:
        key = KEYS.get(key_id)
    except Exception:  # noqa: BLE001
        return "nokey"
    contacts = contacts_of(conn, phone_key)
    recipient = None
    rt = messaging.RUNTIME
    if contacts and has_items(conn, contacts, now, closed_months(conn)):
        sent_today = _count(conn, "contact_id IS NOT NULL AND created_at > ?", (_iso(now - DAY),))
        if rt.outbox is not None and sent_today < SENT_PER_DAY:
            recipient = next((c for c in contacts if messaging.whatsapp_code_ready(conn, c, rt)), None)
    conn.execute("UPDATE ticket_portal_codes SET invalidated_at = ? WHERE phone_key = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
                 (_iso(now), phone_key))  # one live code per number
    vid = codes_mod.new_code_id()
    code = codes_mod.derive_code(key, vid)
    conn.execute("INSERT INTO ticket_portal_codes(id, phone_key, key_id, code_hash, contact_id, created_at, expires_at) VALUES (?,?,?,?,?,?,?)",
                 (vid, phone_key, key_id, _code_hash(key, vid, phone_key, code), recipient["id"] if recipient else None, _iso(now), _iso(now + CODE_TTL)))
    if recipient is None:
        del code
        return "unknown" if not contacts else "unavailable"
    try:
        out = rt.enqueue(conn, purpose="phone_verify", contact_id=recipient["id"], channel="whatsapp", code=code, code_id=vid,
                         requested_by="vendor_portal")
    except Exception as exc:  # noqa: BLE001 - the code stays dead (it still counts against the caps)
        log.warning("portal code not queued (%s)", type(exc).__name__)
        conn.execute("UPDATE ticket_portal_codes SET invalidated_at = ? WHERE id = ?", (_iso(now), vid))
        return "unavailable"
    finally:
        del code
    conn.execute("UPDATE ticket_portal_codes SET outbox_id = ? WHERE id = ?", (out.id, vid))
    audit(conn, actor=PortalActor(recipient["id"]), action="ticket.portal.code_send", decision="allowed", resource_type="ticket_contact",
          resource_id=recipient["id"], details={"source": "vendor_portal"})
    return "sent"


def derive_for_outbox(conn, vid: str | None, contact_id: str | None) -> str | None:
    """The six digits of a LIVE portal code at render time (the outbox lost its in-memory copy, e.g. after a restart) - called from
    phone_verify.derive_for_outbox when the id is not a number-verification row. A code that is no longer live is never rendered."""
    if not vid or not codes_mod.is_link_id(vid):
        return None
    try:
        r = conn.execute("SELECT * FROM ticket_portal_codes WHERE id = ?", (vid,)).fetchone()
    except Exception:  # noqa: BLE001 - a database before 0110
        return None
    if (r is None or not r["contact_id"] or r["contact_id"] != contact_id or r["consumed_at"] or r["invalidated_at"]
            or r["expires_at"] <= _iso(handler_links.now_utc())):
        return None
    try:
        return codes_mod.derive_code(KEYS.get(r["key_id"]), vid)
    except Exception:  # noqa: BLE001
        return None


def verify(conn, digits: str | None, presented: Any, now: dt.datetime) -> str | None:
    """A typed code for a number. Correct (and the number still serves someone) -> a NEW session value (the caller sets the cookie);
    anything else -> None (the route answers the uniform 422). A wrong guess is counted (the 5th ends the code); the caller commits the
    transaction in every case."""
    code = codes_mod.parse_code(presented)
    nk = number_key(digits) if digits else None
    if nk is None:
        return None
    phone_key, _key_id = nk
    live = conn.execute("SELECT * FROM ticket_portal_codes WHERE phone_key = ? AND consumed_at IS NULL AND invalidated_at IS NULL "
                        "AND expires_at > ? ORDER BY created_at DESC, rowid DESC LIMIT 1", (phone_key, _iso(now))).fetchone()
    if live is None or live["attempts"] >= MAX_ATTEMPTS or code is None:
        return None  # a malformed value is not a guess (it cannot succeed); no live code: nothing to count
    try:
        key = KEYS.get(live["key_id"])
    except Exception:  # noqa: BLE001
        return None
    if not hmac.compare_digest(_code_hash(key, live["id"], live["phone_key"], code), live["code_hash"]):
        n = live["attempts"] + 1
        conn.execute("UPDATE ticket_portal_codes SET attempts = ?, invalidated_at = CASE WHEN ? >= ? THEN ? ELSE invalidated_at END WHERE id = ?",
                     (n, n, MAX_ATTEMPTS, _iso(now), live["id"]))
        # no audit row here: writing one only for a number that belongs to someone would make a wrong guess slower for a known
        # number than for an unknown one (an enumeration through timing). Refusals are counted by the rate gate (health).
        return None
    if conn.execute("UPDATE ticket_portal_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
                    (_iso(now), live["id"])).rowcount != 1:
        return None  # a concurrent use of the same code: single use
    if not live["contact_id"]:
        return None  # a row of a number that serves nobody can never sign in (its digits were never sent anywhere)
    contacts = contacts_of(conn, phone_key)
    if not contacts:
        return None  # the number changed / the row was deactivated meanwhile: fail closed
    value = links.new_session_value()
    conn.execute("INSERT INTO ticket_portal_sessions(id_hash, phone_key, key_id, created_at, expires_at) VALUES (?,?,?,?,?)",
                 (links.session_hash(value), phone_key, live["key_id"], _iso(now), _iso(now + SESSION_TTL)))
    audit(conn, actor=PortalActor(contacts[0]["id"]), action="ticket.portal.sign_in", decision="allowed", resource_type="ticket_contact",
          resource_id=contacts[0]["id"], details={"source": "vendor_portal", "rows": len(contacts)})
    return value


# ---------------------------------------------------------------- the session


def session(conn, value: str | None, now: dt.datetime) -> Session | None:
    """The live session of a cookie value, or None (malformed, unknown, expired, signed out, or its key no longer current)."""
    v = links.parse_session(value)
    if v is None:
        return None
    r = conn.execute("SELECT * FROM ticket_portal_sessions WHERE id_hash = ? AND revoked_at IS NULL AND expires_at > ?",
                     (links.session_hash(v), _iso(now))).fetchone()
    if r is None:
        return None
    try:
        current_id, _key = KEYS.current(create=False)
    except Exception:  # noqa: BLE001 - no key: nothing can be matched
        return None
    if r["key_id"] != current_id:
        return None  # a key rotation re-keyed every number: the session's key matches nothing any more (fail closed)
    return Session(id_hash=r["id_hash"], phone_key=r["phone_key"], key_id=r["key_id"], created_at=r["created_at"], expires_at=r["expires_at"])


def logout(conn, value: str | None, now: dt.datetime) -> bool:
    v = links.parse_session(value)
    if v is None:
        return False
    return conn.execute("UPDATE ticket_portal_sessions SET revoked_at = ? WHERE id_hash = ? AND revoked_at IS NULL",
                        (_iso(now), links.session_hash(v))).rowcount == 1


def open_item(conn, sess: Session, wanted: str, now: dt.datetime) -> tuple[str, dict[str, Any]] | None:
    """The handler token of ONE item of this session (its live link), or None (not this session's, no live link, a staff link).
    The token is the one already sent to this number for that assignment; the handler page keeps its own rules (code, grace)."""
    if not isinstance(wanted, str) or len(wanted) != 24:
        return None
    contacts = contacts_of(conn, sess.phone_key)
    for r in _assignment_rows(conn, [c["id"] for c in contacts], _since(now, closed_months(conn))):
        if not hmac.compare_digest(item_id(sess, r["a_id"]), wanted):
            continue
        rec = _live_link(conn, r["a_id"], now)
        if rec is None:
            return None
        token = links.derive_token(KEYS.get(rec.key_id), rec.link_id, rec.generation)
        audit(conn, actor=PortalActor(r["contact_id"]), action="ticket.portal.open", decision="allowed", resource_type="ticket",
              resource_id=r["ticket_id"], details={"source": "vendor_portal", "number": r["number"], "link": rec.link_id[:6]})
        return token, {"number": r["number"]}
    return None


# ---------------------------------------------------------------- retention and erase


def prune(conn, now: dt.datetime) -> None:
    """The janitor (public_runtime): code rows after 2 days, sessions once ended."""
    try:
        conn.execute("DELETE FROM ticket_portal_codes WHERE created_at < ?", (_iso(now - KEEP),))
        conn.execute("DELETE FROM ticket_portal_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL", (_iso(now),))
    except Exception:  # noqa: BLE001 - a database before 0110
        pass


def forget_contact(conn, contact_id: str) -> None:
    """Erase (15.2): the contact's portal code rows go (they hold its keyed number index)."""
    try:
        conn.execute("DELETE FROM ticket_portal_codes WHERE contact_id = ?", (contact_id,))
    except Exception:  # noqa: BLE001 - a database before 0110
        pass


def sanitized(item: Mapping[str, Any]) -> bool:
    """Test helper: an item carries only allow-listed keys (and its money blocks too)."""
    if set(item) - ITEM_KEYS:
        return False
    if item.get("quote") is not None and set(item["quote"]) - QUOTE_KEYS:
        return False
    return not (item.get("demand") is not None and set(item["demand"]) - DEMAND_KEYS)
