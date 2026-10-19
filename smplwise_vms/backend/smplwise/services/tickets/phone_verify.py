"""TKNOTIFOTP (owner decision 2026-10-16): OPTIONAL verification that a WhatsApp number belongs to the person it was set for - a
one-time code sent to that number and typed back. OFF by default and never mandatory.

Why: anyone holding `tickets.configure` can set the mobile of a vendor, a contact or a staff member (and through the directory, the
number NOTIFWA notifications resolve to). With verification on, a number counts as confirmed only once the code that went to it was
typed back, so a mistyped number, or one that belongs to a stranger, never receives links or notifications. It does NOT stop a dishonest configurer: for a vendor / contact the configurer who set the number also types the code, so a number of their own that they can read passes (delta review N-2). Insider resistance would need the vendor to type the code himself on the public handler page.

Switches (raise only, like `require_code`):
- the installation: `tickets.settings.phone_verify.required` (default False, edited with the channel settings, system.configure);
- the row: `ticket_contacts.phone_verify` (default 0, edited with the contact / the staff member's mobile, tickets.configure).
Either one on = verification is REQUIRED for that row.

What "confirmed" means (`confirmed(conn, row)`): the row has a number and `phone_confirmed_at`; while verification is required, only a
confirmation BY CODE counts (`phone_confirmed_via = 'code'`) - a manager's mark or the user's one-tap confirmation made while it was
off does not. Every change of the number clears the confirmation (contacts.update / staff_links.set_mobile) and kills a live code.

Where it holds back WhatsApp while required and not confirmed by code (`whatsapp_allowed`):
- messaging.plan_channel (vendor / contact links, reminders, notices, staff links): WhatsApp is not offered (e-mail fallback or
  "copy link" as today);
- messaging.code_channels (a link's code is never sent to such a number);
- staff_links.recipient / set_mine (no staff link; the one-tap confirmation is refused - the user types the code instead);
- notify_whatsapp.resolve_number / the opt-in (`user_number_ok`): notifications to a user's directory number stay declined.
While verification is NOT required: the manager may mark the number confirmed directly ("אני בטוח שזה המספר שלו",
`manager_confirm`, audited) exactly as the owner asked; vendor links work as before (they never needed a confirmation).

Who types the code:
- a user (a row with `user_id`): only the user themself, in "החשבון שלי" (`/tickets/me/phone-verify/*`). A manager can never verify
  a staff member's number on their behalf (409 `user_only`);
- a vendor / contact (no user): a configurer on the contact's page, after the vendor read the code to them
  (`/tickets/admin/contacts/{id}/phone-verify/*`).

Code rules: 6 digits (codes.derive_code from a 128-bit row id under the module key - the W9 pattern: the outbox renders the message
from the row id, the digits are never stored, queued, logged or audited); stored as HMAC-SHA256(k_tickets, 'pv|' id | phone_key |
code); bound to the number (`phone_key`) and the row; valid 10 minutes; single use; one live code per row (a new one ends the old);
5 wrong guesses end the code; at most 1 send per 60 s and 5 per day per row, 5 per day per number (across rows), 10 per day per requesting
actor and 50 per day per installation (at most 30 of them by configurers - the rest is reserved for people verifying their own number). Refusals are uniform: every failed check answers the same 422 `code_invalid`, every send cap the same 429
`code_rate_limited`. The message is the fixed `phone_verify` starter (message_templates.FIXED_PURPOSES), WhatsApp only, never held
by the send hours, never a fallback channel."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import logging
from typing import Any, Mapping

from ...audit import audit
from ...errors import ApiError
from ...rbac import INSTALLATION, authorize, require
from . import access, codes as codes_mod, handler_links, settings_doc, store_links
from .access import Viewer, text
from .keyring import KEYS

log = logging.getLogger("smplwise.tickets.phone_verify")

CODE_TTL = dt.timedelta(minutes=10)
MAX_ATTEMPTS = 5
COOLDOWN = dt.timedelta(seconds=60)
PER_ROW_DAY = 5
PER_NUMBER_DAY = 5
PER_INSTALLATION_DAY = 50
# delta review N-5 (TKHARDEN): one actor must not be able to use up the installation cap for everybody. A sub-cap per requesting actor,
# and the configurer path (`by = manager`) may use only part of the installation cap - the rest is reserved for people verifying their
# OWN number. (Viewer carries no client address, so the actor is the signed-in user; the answer stays the same uniform 429.)
PER_ACTOR_DAY = 10
PER_INSTALLATION_MANAGER_DAY = 30
KEEP = dt.timedelta(days=2)
DAY = dt.timedelta(days=1)


# ---------------------------------------------------------------- the rule


def installation_required(conn) -> bool:
    try:
        return bool(settings_doc.read(conn).get("phone_verify", {}).get("required", False))
    except Exception:  # noqa: BLE001 - an unreadable document reads as the default (off), like every other key
        return False


def required(conn, row: Mapping[str, Any] | None) -> bool:
    """Verification is required for this row: the installation switch OR the row's own."""
    return installation_required(conn) or bool((row or {}).get("phone_verify"))


def code_confirmed(row: Mapping[str, Any] | None) -> bool:
    r = row or {}
    return bool(r.get("phone_e164")) and bool(r.get("phone_confirmed_at")) and r.get("phone_confirmed_via") == "code"


def confirmed(conn, row: Mapping[str, Any] | None) -> bool:
    """The number counts as confirmed (see the module docstring)."""
    r = row or {}
    if not r.get("phone_e164") or not r.get("phone_confirmed_at"):
        return False
    return not required(conn, r) or r.get("phone_confirmed_via") == "code"


def whatsapp_allowed(conn, contact: Mapping[str, Any] | None) -> bool:
    """False only while verification is required for the row and its number was not confirmed by code."""
    if not required(conn, contact):
        return True
    return code_confirmed(contact)


def user_number_ok(conn, user_id: str, digits: str) -> bool:
    """NOTIFWA (notify_whatsapp.resolve_number): may notifications go to `digits` for this user? Unchanged while verification is not
    required. While it is: only the user's directory number, confirmed by code. A number from any other source is refused while the
    installation requires verification (it cannot be verified here - fail closed)."""
    try:
        row = store_links.contact_by_user(conn, user_id)
    except Exception:  # noqa: BLE001 - an installation without the tickets tables: nothing to verify against
        return not installation_required(conn)
    if row is None:
        return not installation_required(conn)
    if not row.get("active", 1) or (row.get("phone_e164") or "") != digits:
        # delta review N-4: a number from any other source than the directory cannot be verified here, so it fails closed whenever
        # verification is required FOR THIS PERSON - the installation switch or the person's own switch.
        return not required(conn, row)
    return whatsapp_allowed(conn, row)


def view(conn, row: Mapping[str, Any] | None) -> dict[str, Any]:
    """The verification facts of a row for an answer (never the number, never a code)."""
    r = row or {}
    live = _live(conn, r["id"], handler_links.now_utc()) if r.get("id") else None
    return {"phone_verify": bool(r.get("phone_verify")), "verify_required": required(conn, r), "confirmed": confirmed(conn, r),
            "confirmed_via": r.get("phone_confirmed_via") if r.get("phone_confirmed_at") else None, "code_pending": live is not None}


def confirm_token(row: Mapping[str, Any]) -> str:
    """An opaque token of the exact number shown (no digit in it) - the manager's mark must echo it (a number changed in between can
    never be marked by accident). The same derivation as staff_links.confirm_token."""
    seed = f"tkstaff-confirm|{row['id']}|{row.get('phone_key') or ''}|{row.get('phone_e164') or ''}"
    return hashlib.sha256(seed.encode()).hexdigest()[:16]


# ---------------------------------------------------------------- storage


def _iso(t: dt.datetime) -> str:
    return handler_links.iso(t)


def _hash(key: bytes, vid: str, phone_key: str, code: str) -> str:
    return hmac.new(bytes(key), f"pv|{vid}|{phone_key}|{code}".encode("ascii"), hashlib.sha256).hexdigest()


def _live(conn, contact_id: str, now: dt.datetime) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM ticket_phone_verifications WHERE contact_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL "
                     "AND expires_at > ? ORDER BY created_at DESC LIMIT 1", (contact_id, _iso(now))).fetchone()
    return dict(r) if r else None


def _count(conn, column: str, value: str | None, since: dt.datetime) -> int:
    if column == "requested_by":
        return conn.execute("SELECT COUNT(*) FROM ticket_phone_verifications WHERE requested_by = ? AND created_at > ?", (value, _iso(since))).fetchone()[0]
    if column == "*":
        return conn.execute("SELECT COUNT(*) FROM ticket_phone_verifications WHERE created_at > ?", (_iso(since),)).fetchone()[0]
    return conn.execute(f"SELECT COUNT(*) FROM ticket_phone_verifications WHERE {column} = ? AND created_at > ?",  # noqa: S608 - fixed names
                        (value, _iso(since))).fetchone()[0]


def _last_sent(conn, contact_id: str) -> str | None:
    r = conn.execute("SELECT MAX(created_at) FROM ticket_phone_verifications WHERE contact_id = ?", (contact_id,)).fetchone()
    return r[0] if r else None


def kill_codes(conn, contact_id: str, now: dt.datetime | None = None) -> None:
    """A changed / removed number or an erased row: every live code of the row ends, its queued message is cancelled."""
    at = _iso(now or handler_links.now_utc())
    conn.execute("UPDATE ticket_phone_verifications SET invalidated_at = ? WHERE contact_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
                 (at, contact_id))
    try:  # VPORTAL: a portal sign-in code that went to the old number ends too
        conn.execute("UPDATE ticket_portal_codes SET invalidated_at = ? WHERE contact_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
                     (at, contact_id))
    except Exception:  # noqa: BLE001 - a database before 0105
        pass
    _cancel_queued(conn, contact_id)


def _cancel_queued(conn, contact_id: str) -> None:
    try:
        from . import messaging, outbox_store as obs

        rt = messaging.RUNTIME
        if rt.outbox is not None:
            with obs.bound(conn):
                rt.outbox.cancel_where("number_changed", rt.clock(), contact_id=contact_id, purposes=("phone_verify",))
    except Exception:  # noqa: BLE001 - the code row is dead anyway: a message that still leaves can verify nothing
        log.warning("phone verification message not cancelled")


def forget(conn, contact_id: str) -> None:
    """Erase (15.2): the row's verification rows go (they hold its keyed number index)."""
    _cancel_queued(conn, contact_id)
    conn.execute("DELETE FROM ticket_phone_verifications WHERE contact_id = ?", (contact_id,))
    from . import vendor_portal  # VPORTAL: the portal's code rows sent to this row hold its keyed number index too

    vendor_portal.forget_contact(conn, contact_id)


def derive_for_outbox(conn, vid: str | None, contact_id: str | None) -> str | None:
    """The six digits of a live verification row at render time (the outbox lost its in-memory copy, e.g. after a restart). A code
    that is no longer live is never rendered - the row ends `code_lost` and the person asks again."""
    if not vid or not codes_mod.is_link_id(vid):
        return None
    r = conn.execute("SELECT * FROM ticket_phone_verifications WHERE id = ?", (vid,)).fetchone()
    if r is None:
        # VPORTAL: the vendor portal's sign-in code uses the same fixed message (purpose `phone_verify`); its row is its own table
        from . import vendor_portal

        return vendor_portal.derive_for_outbox(conn, vid, contact_id)
    if r["contact_id"] != contact_id or r["consumed_at"] or r["invalidated_at"] or r["expires_at"] <= _iso(handler_links.now_utc()):
        return None
    try:
        return codes_mod.derive_code(KEYS.get(r["key_id"]), vid)
    except Exception:  # noqa: BLE001 - a missing key: the code is lost
        return None


# ---------------------------------------------------------------- refusals (uniform)


def _invalid(conn) -> ApiError:
    return ApiError(422, "code_invalid", text(conn, "הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש."))


def _limited(conn) -> ApiError:
    return ApiError(429, "code_rate_limited", text(conn, "לא ניתן לשלוח קוד נוסף כרגע. נסו שוב מאוחר יותר."), retryable=True)


def _unavailable(conn) -> ApiError:
    return ApiError(409, "verify_unavailable", text(conn, "לא ניתן לשלוח קוד כרגע: חסר מספר, או שערוץ הוואטסאפ אינו פעיל."))


# ---------------------------------------------------------------- send / check


def _target(conn, row: Mapping[str, Any] | None) -> dict[str, Any]:
    if row is None or row.get("erased_at") or not row.get("active", 1) or not row.get("phone_e164") or not row.get("phone_key"):
        raise _unavailable(conn)
    return dict(row)


def _privacy_variant(conn, target: Mapping[str, Any]) -> dict[str, Any]:
    """PRIVORG-291: once the installation set a privacy contact point, the code to a directory person (a technician, a vendor contact -
    not a signed-in user verifying their own number) carries one neutral privacy line with that contact and the organisation name. Unset:
    the fixed text exactly as before."""
    if target.get("user_id"):
        return {}
    from ..privacy_org import identity

    who = identity(conn)
    if not who.contact:
        return {}
    params = {"privacy_contact": who.contact}
    if who.organization:
        params["organization"] = who.organization
    return {"template_id": "starter:verify_privacy", "params": params}


def send_code(conn, viewer: Viewer, row: Mapping[str, Any] | None, *, by: str, rid: str | None = None) -> dict[str, Any]:
    """Issue the row's next code and queue the fixed message (inside the request's transaction). The caller checked who may ask."""
    from . import messaging

    target = _target(conn, row)
    rt = messaging.RUNTIME
    if rt.outbox is None or not messaging.whatsapp_code_ready(conn, target, rt):
        audit(conn, actor=viewer.principal, action="ticket.contact.phone_verify_send", decision="denied", resource_type="ticket_contact",
              resource_id=target["id"], reason="unavailable", request_id=rid, details={"by": by})
        raise _unavailable(conn)
    now = handler_links.now_utc()
    conn.execute("DELETE FROM ticket_phone_verifications WHERE created_at < ?", (_iso(now - KEEP),))
    last = _last_sent(conn, target["id"])
    since = now - DAY
    if ((last and last > _iso(now - COOLDOWN)) or _count(conn, "contact_id", target["id"], since) >= PER_ROW_DAY
            or _count(conn, "phone_key", target["phone_key"], since) >= PER_NUMBER_DAY or _count(conn, "*", None, since) >= PER_INSTALLATION_DAY
            or _count(conn, "requester_id", viewer.uid, since) >= PER_ACTOR_DAY
            or (by != "self" and _count(conn, "requested_by", by, since) >= PER_INSTALLATION_MANAGER_DAY)):
        audit(conn, actor=viewer.principal, action="ticket.contact.phone_verify_send", decision="denied", resource_type="ticket_contact",
              resource_id=target["id"], reason="rate_limited", request_id=rid, details={"by": by})
        raise _limited(conn)
    try:
        key_id, key = KEYS.current(create=False)
    except Exception:  # noqa: BLE001 - no module key: no phone key either, nothing can be verified
        raise _unavailable(conn) from None
    conn.execute("UPDATE ticket_phone_verifications SET invalidated_at = ? WHERE contact_id = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
                 (_iso(now), target["id"]))  # one live code per row
    vid = codes_mod.new_code_id()
    code = codes_mod.derive_code(key, vid)
    conn.execute("INSERT INTO ticket_phone_verifications(id, contact_id, phone_key, key_id, code_hash, requested_by, requester_id, created_at, expires_at) "
                 "VALUES (?,?,?,?,?,?,?,?,?)", (vid, target["id"], target["phone_key"], key_id, _hash(key, vid, target["phone_key"], code),
                                                by, viewer.uid, _iso(now), _iso(now + CODE_TTL)))
    extra = _privacy_variant(conn, target)
    try:
        out = rt.enqueue(conn, purpose="phone_verify", contact_id=target["id"], channel="whatsapp", code=code, code_id=vid,
                         requested_by=viewer.uid, **extra)
    except Exception as exc:  # noqa: BLE001 - the code stays dead (it still counts against the caps)
        log.warning("phone verification code not queued (%s)", type(exc).__name__)
        conn.execute("UPDATE ticket_phone_verifications SET invalidated_at = ? WHERE id = ?", (_iso(now), vid))
        raise _unavailable(conn) from None
    finally:
        del code
    conn.execute("UPDATE ticket_phone_verifications SET outbox_id = ? WHERE id = ?", (out.id, vid))
    audit(conn, actor=viewer.principal, action="ticket.contact.phone_verify_send", decision="allowed", resource_type="ticket_contact",
          resource_id=target["id"], request_id=rid, details={"by": by, "user_linked": bool(target.get("user_id"))})
    return {"sent": True, "expires_in_s": int(CODE_TTL.total_seconds()), "resend_after_s": int(COOLDOWN.total_seconds())}


def check_code(conn, viewer: Viewer, row: Mapping[str, Any] | None, presented: Any, *, by: str, rid: str | None = None) -> None:
    """A typed code. Correct -> the number is confirmed BY CODE (and the code is spent). Anything else -> the uniform 422 (a wrong guess
    is counted and committed with the refusal - ApiError commits the transaction; the fifth ends the code)."""
    if row is None or row.get("erased_at"):
        raise _invalid(conn)
    now = handler_links.now_utc()

    def deny(reason: str) -> ApiError:
        audit(conn, actor=viewer.principal, action="ticket.contact.phone_verify", decision="denied", resource_type="ticket_contact",
              resource_id=row["id"], reason=reason, request_id=rid, details={"by": by})
        return _invalid(conn)

    code = codes_mod.parse_code(presented)
    live = _live(conn, row["id"], now)
    if code is None:
        raise deny("malformed")
    if live is None or live["attempts"] >= MAX_ATTEMPTS:
        raise deny("no_code")
    if not row.get("phone_key") or not hmac.compare_digest(str(live["phone_key"]), str(row["phone_key"])):
        raise deny("number_changed")
    try:
        key = KEYS.get(live["key_id"])
    except Exception:  # noqa: BLE001
        raise deny("key_missing") from None
    if not hmac.compare_digest(_hash(key, live["id"], live["phone_key"], code), live["code_hash"]):
        n = live["attempts"] + 1
        conn.execute("UPDATE ticket_phone_verifications SET attempts = ?, invalidated_at = CASE WHEN ? >= ? THEN ? ELSE invalidated_at END WHERE id = ?",
                     (n, n, MAX_ATTEMPTS, _iso(now), live["id"]))
        raise deny("invalid")
    if conn.execute("UPDATE ticket_phone_verifications SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND invalidated_at IS NULL",
                    (_iso(now), live["id"])).rowcount != 1:
        raise deny("no_code")
    store_links.update_contact(conn, row["id"], {"phone_confirmed_at": _iso(now), "phone_confirmed_via": "code"}, None)
    audit(conn, actor=viewer.principal, action="ticket.contact.phone_verify", decision="allowed", resource_type="ticket_contact",
          resource_id=row["id"], request_id=rid, details={"by": by, "user_linked": bool(row.get("user_id"))})


# ---------------------------------------------------------------- the two entry points (who may)


def _admin_row(conn, viewer: Viewer, contact_id: str) -> dict[str, Any]:
    require(conn, viewer.principal, access.CONFIGURE, INSTALLATION)
    row = store_links.contact(conn, contact_id)
    if row is None or row.get("erased_at"):
        raise ApiError(404, "contact_not_found", text(conn, "איש הקשר לא נמצא."))
    return row


def _not_for_users(conn, row: Mapping[str, Any]) -> None:
    if row.get("user_id"):
        raise ApiError(409, "user_only", text(conn, "את המספר של משתמש מאמת רק המשתמש עצמו, בתפריט החשבון שלי."))


def admin_send(conn, viewer: Viewer, contact_id: str, rid: str | None = None) -> dict[str, Any]:
    row = _admin_row(conn, viewer, contact_id)
    _not_for_users(conn, row)
    return send_code(conn, viewer, row, by="manager", rid=rid)


def admin_check(conn, viewer: Viewer, contact_id: str, body: Any, rid: str | None = None) -> dict[str, Any]:
    row = _admin_row(conn, viewer, contact_id)
    _not_for_users(conn, row)
    check_code(conn, viewer, row, _code_of(conn, body), by="manager", rid=rid)
    return view(conn, store_links.contact(conn, contact_id))


def manager_confirm(conn, viewer: Viewer, contact_id: str, body: Any, rid: str | None = None) -> dict[str, Any]:
    """"אני בטוח שזה המספר שלו": a configurer marks the number shown as confirmed - ONLY while verification is not required for the
    row (409 `code_required` otherwise). `{confirm: <token of the number shown>}`; audited without the number; a user whose number was
    marked is told in the app (they may withdraw it in "החשבון שלי")."""
    row = _admin_row(conn, viewer, contact_id)
    keys = set(body) if isinstance(body, dict) else set()
    if keys != {"confirm"} or not isinstance(body["confirm"], str) or not 0 < len(body["confirm"]) <= 64 or not body["confirm"].isascii():
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "confirm", "code": "type"}]})
    if not row.get("phone_e164"):
        raise ApiError(409, "no_number", text(conn, "לא הוגדר מספר."))
    if row.get("user_id"):
        # delta review N-1 (2.6.3, lead decision - the stricter option): a STAFF row (linked to a user) decides where that user's
        # no-login staff links go, so marking its number needs system.configure (tickets.configure alone could point them at any
        # number), and the person's own "verify with a code" switch is never bypassed (checked below, also when the installation
        # switch is off). Vendor / contact rows keep tickets.configure.
        if row.get("phone_verify"):
            audit(conn, actor=viewer.principal, action="ticket.contact.phone_confirm", decision="denied", resource_type="ticket_contact",
                  resource_id=row["id"], reason="code_required", request_id=rid)
            raise ApiError(409, "code_required", text(conn, "אימות המספר בקוד פעיל: המספר ייחשב מאושר רק אחרי הקלדת הקוד שנשלח אליו."))
        if not authorize(conn, viewer.principal, "system.configure", INSTALLATION).allowed:
            audit(conn, actor=viewer.principal, action="ticket.contact.phone_confirm", decision="denied", resource_type="ticket_contact",
                  resource_id=row["id"], reason="staff_needs_system_configure", request_id=rid)
            raise ApiError(403, "forbidden", text(conn, "אישור הנייד של משתמש מחייב הרשאת מנהל מערכת. המשתמש יכול לאשר בעצמו בתפריט החשבון שלי."))
    if required(conn, row):
        audit(conn, actor=viewer.principal, action="ticket.contact.phone_confirm", decision="denied", resource_type="ticket_contact",
              resource_id=row["id"], reason="code_required", request_id=rid)
        raise ApiError(409, "code_required", text(conn, "אימות המספר בקוד פעיל: המספר ייחשב מאושר רק אחרי הקלדת הקוד שנשלח אליו."))
    if not hmac.compare_digest(body["confirm"], confirm_token(row)):
        raise ApiError(409, "number_changed", text(conn, "המספר השתנה מאז שהוצג. טענו מחדש ובדקו את המספר."))
    store_links.update_contact(conn, row["id"], {"phone_confirmed_at": _iso(handler_links.now_utc()), "phone_confirmed_via": "manager"}, None)
    audit(conn, actor=viewer.principal, action="ticket.contact.phone_confirm", decision="allowed", resource_type="ticket_contact",
          resource_id=row["id"], request_id=rid, details={"via": "manager", "user_linked": bool(row.get("user_id"))})
    if row.get("user_id") and row["user_id"] != viewer.uid:
        _tell_marked(conn, row["user_id"])
    return view(conn, store_links.contact(conn, contact_id))


def _tell_marked(conn, user_id: str) -> None:
    if not access.module_on(conn):
        return
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(
            source="ticket.staff_mobile", subject_kind="session", subject_id=user_id,
            dedupe_key=f"ticket.staff_mobile:{user_id}:marked:{handler_links.iso(handler_links.now_utc())}",
            params={"title": text(conn, "מנהל אישר את הנייד שלך לקישורי עבודה"),
                    "body": text(conn, "אם זה לא המספר שלך, בטלו את האישור בתפריט החשבון שלי.")},
            initiator_user_id=user_id, link="#/tickets"))
    except Exception:  # noqa: BLE001 - a notice never fails the change
        log.warning("staff mobile notice failed", exc_info=True)


def _code_of(conn, body: Any) -> Any:
    if not isinstance(body, dict) or set(body) != {"code"}:
        raise ApiError(422, "validation", text(conn, "ערך לא תקין."), details={"fields": [{"field": "code", "code": "shape"}]})
    return body["code"]


def my_send(conn, viewer: Viewer, rid: str | None = None) -> dict[str, Any]:
    """The caller's OWN directory row only (no id in the request)."""
    return send_code(conn, viewer, store_links.contact_by_user(conn, viewer.uid), by="self", rid=rid)


def my_check(conn, viewer: Viewer, body: Any, rid: str | None = None) -> None:
    check_code(conn, viewer, store_links.contact_by_user(conn, viewer.uid), _code_of(conn, body), by="self", rid=rid)
