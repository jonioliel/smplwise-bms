"""EXTERNALBUILD-297 (CR-VISITOR105, owner direction 2026-10-27 "full intake"): visitor pre-registration with a temporary door code, built
on the SAME external-access grant engine (services/access_grants.py). Fakes only in tests; OFF by default.

One invitation = one `access_grants` row (source_kind 'manual', source_ref NULL - the invite row points at the grant, because a grant's
source_ref names a ticket for the R5 trigger; credential 'pin') for a minimal visitor
contact (a `ticket_contacts` person row with no vendor, no user; hidden from the tickets directory) + one `access_visitor_invites` row.
From there the grant engine does everything that touches WisKey: create the person inert, provision doors / validity / daily hours,
generate the PIN at its due time, hand it to WhatsApp and drop it, revoke at the end with read-back proof. What this module adds:

* the host (the signed-in Arx user who invites), the permission `access.visitor.invite` (station-scoped, sensitive, held by
  `system_admin` only until the owner hands it out), and the APPROVAL ENVELOPE (CR 5.2): an invitation inside the envelope is approved by
  the host's own interactive act (`approval_kind = host_envelope`); anything outside it (more doors, longer, a station not flagged
  "visitor entrance", over a host / installation count) is stored as `requested` and decided by a second person through the existing
  approve screen (`second_person`). The envelope ROUTES an invitation; it never refuses one (owner direction: no new refusal gates);
* the per-station flag "visitor entrance" (`access_station_visitor_entrance`);
* the visitor's own number confirmation: the host asks for the verification code to be sent to the visitor's number and types back the
  code the visitor reads to him (the tickets phone-verification path, `by = 'host'`); no door code is generated before that
  (`awaiting_confirmation`, checked by the worker). A public visitor page (CR V3) is not built; see docs/changes/EXTERNALBUILD-297.md;
* the "single entry" mode (the grant's `code_mode`), the entry log and the arrival notice (services/access_entries.py);
* re-decision of an envelope grant against the host's invite permission and the visitor-entrance flags (`envelope_rule`);
* retention: the visitor's name and number erased N days after the end (default 30).

Switch: `access.visitors` (default `off`); it works only while `access.external_grants` is on too. While off every visitor route answers
404 and nothing is read or sent. No code constant gates it (owner direction 2026-10-27: activation is a settings action in a session with
the lead). Audit: ids, codes and instants only - never the visitor's name, number, a code or a message text."""
from __future__ import annotations

import json
import re
import sqlite3
import uuid
from datetime import timedelta
from typing import Any

from ..db import Database, get_setting, permission_revision, set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, LOCAL_ID_PREFIX, STATION, Principal, authorize, is_system_admin
from . import access_grants as ag

PERMISSION = "access.visitor.invite"
FLAG_KEY = "access.visitors"
KEYS = {
    "max_hours": ("access.visitors.max_hours", 24, 1, 72),
    "max_ahead_days": ("access.visitors.max_ahead_days", 30, 1, 90),
    "host_live_max": ("access.visitors.host_live_max", 3, 1, 10),
    "host_day_max": ("access.visitors.host_day_max", 5, 1, 20),
    "installation_live_max": ("access.visitors.installation_live_max", 30, 1, 100),
    "erase_after_days": ("access.visitors.erase_after_days", 30, 1, 365),
}
SINGLE_DEFAULT_KEY = "access.visitors.single_entry_default"
PURPOSES = ("guest", "meeting", "delivery", "service", "other")
MODES = ag.CODE_MODES
NAME_MAX = 40
REVOKE_ALL_WORD = "בטל מבקרים"
TOMBSTONE = "מבקר (נמחק)"
_CTRL = re.compile(r"[\x00-\x1f\x7f]")


# ---------------------------------------------------------------- settings

def _int(conn: sqlite3.Connection, name: str) -> int:
    key, default, lo, hi = KEYS[name]
    try:
        value = int(get_setting(conn, key) or default)
    except (ValueError, TypeError, sqlite3.Error):
        value = default
    return max(lo, min(hi, value))


def enabled(conn: sqlite3.Connection) -> bool:
    """`on` only when the visitor switch says exactly `on` AND the external-access feature is on."""
    try:
        return (get_setting(conn, FLAG_KEY) or "off") == "on" and ag.enabled(conn)
    except sqlite3.Error:
        return False


def erase_after_days(conn: sqlite3.Connection) -> int:
    return _int(conn, "erase_after_days")


def single_default(conn: sqlite3.Connection) -> bool:
    try:
        return (get_setting(conn, SINGLE_DEFAULT_KEY) or "off") == "on"
    except sqlite3.Error:
        return False


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    try:
        raw = get_setting(conn, FLAG_KEY) or "off"
    except sqlite3.Error:
        raw = "off"
    return {"visitors": "on" if raw == "on" else "off", "effective": enabled(conn), "external_grants": "on" if ag.enabled(conn) else "off",
            **{name: _int(conn, name) for name in KEYS}, "caps": {name: KEYS[name][3] for name in KEYS},
            "single_entry_default": "on" if single_default(conn) else "off"}


def apply_settings(conn: sqlite3.Connection, changes: dict[str, Any]) -> list[tuple[str, Any, Any]]:
    """(key, before, after) per change. The caller checked a system administrator; values were validated by the route's model."""
    before = settings_view(conn)
    out: list[tuple[str, Any, Any]] = []
    for name, value in changes.items():
        if name == "visitors":
            set_setting(conn, FLAG_KEY, str(value))
            out.append((FLAG_KEY, before["visitors"], value))
        elif name == "single_entry_default":
            set_setting(conn, SINGLE_DEFAULT_KEY, str(value))
            out.append((SINGLE_DEFAULT_KEY, before["single_entry_default"], value))
        elif name in KEYS:
            key, _default, lo, hi = KEYS[name]
            v = max(lo, min(hi, int(value)))
            set_setting(conn, key, str(v))
            out.append((key, before[name], v))
    return out


def _hidden() -> ApiError:
    return ApiError(404, "not_found", "לא נמצא.")


# ---------------------------------------------------------------- the visitor-entrance flag

def visitor_entrances(conn: sqlite3.Connection) -> set[str]:
    try:
        return {r[0] for r in conn.execute("SELECT station_id FROM access_station_visitor_entrance").fetchall()}
    except sqlite3.Error:
        return set()


def set_visitor_entrance(db: Database, principal: Principal, station_id: str, entrance: bool, request_id: str | None = None) -> dict[str, Any]:
    """D5: the flag is set by a holder of `access.external.grant` on the station who also holds `system.configure`."""
    with db.connection(label="access_visitors.entrance") as conn:
        if not (authorize(conn, principal, ag.PERMISSION, (STATION, station_id)).allowed and authorize(conn, principal, "system.configure", INSTALLATION).allowed):
            ag._audit(conn, principal, "access.visitor.station_flag", station_id, decision="denied", reason="no_binding", resource_type=STATION, request_id=request_id)
            raise forbidden(permission=ag.PERMISSION, target_type=STATION, target_id=station_id, reason="no_binding")
        if entrance:
            conn.execute("INSERT OR IGNORE INTO access_station_visitor_entrance(station_id, set_by, set_at) VALUES (?, ?, ?)",
                         (station_id, principal.user_id, ag.iso(ag.now())))
        else:
            conn.execute("DELETE FROM access_station_visitor_entrance WHERE station_id = ?", (station_id,))
        ag._audit(conn, principal, "access.visitor.station_flag_set" if entrance else "access.visitor.station_flag_cleared", station_id,
                  resource_type=STATION, request_id=request_id)
        return {"station_id": station_id, "visitor_entrance": entrance}


# ---------------------------------------------------------------- rows

def invite_row(conn: sqlite3.Connection, invite_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM access_visitor_invites WHERE id = ?", (invite_id,)).fetchone()
    return dict(r) if r else None


def invite_of_grant(conn: sqlite3.Connection, grant_id: str) -> dict[str, Any] | None:
    try:
        r = conn.execute("SELECT * FROM access_visitor_invites WHERE grant_id = ?", (grant_id,)).fetchone()
    except sqlite3.Error:
        return None
    return dict(r) if r else None


def awaiting_confirmation(db: Database, grant_id: str) -> bool:
    """D8: a visitor grant whose visitor has not confirmed his own number yet - the worker generates no code for it."""
    try:
        with db.connection(mode="read", label="access_visitors.awaiting") as conn:
            inv = invite_of_grant(conn, grant_id)
    except sqlite3.Error:
        return False
    return inv is not None and not inv.get("confirmed_at")


def envelope_rule(conn: sqlite3.Connection, g: dict[str, Any]) -> tuple[tuple[str, ...], set[str]] | None:
    """CR 5.3: the re-decision rule of a grant the host approved inside the envelope - (the permissions the approver must still hold per
    station, the stations still allowed). None for every other grant (the existing approve permissions apply)."""
    inv = invite_of_grant(conn, g["id"])
    if inv is None or inv.get("approval_kind") != "host_envelope":
        return None
    return (PERMISSION,), visitor_entrances(conn)


# ---------------------------------------------------------------- invite

def _clean_name(value: Any) -> str:
    text = _CTRL.sub("", str(value or "")).strip()[:NAME_MAX].strip()
    if not text:
        raise ag._invalid("visitor_name", "required", "יש להקליד את שם המבקר.")
    return text


def _phone(value: Any) -> str:
    from .tickets.contacts import ContactInvalid, normalize_phone

    try:
        digits = normalize_phone(value)
    except ContactInvalid:
        digits = None
    if not digits:
        raise ag._invalid("phone", "format", "מספר הטלפון אינו תקין.")
    return digits


def _counts(conn: sqlite3.Connection, host: str, at: Any) -> dict[str, int]:
    marks = ",".join("?" * len(ag.LIVE))
    live_host = conn.execute(f"SELECT COUNT(*) FROM access_visitor_invites vi JOIN access_grants g ON g.id = vi.grant_id WHERE vi.host_user_id = ? "
                             f"AND g.state IN ({marks})", (host, *ag.LIVE)).fetchone()[0]
    day_host = conn.execute("SELECT COUNT(*) FROM access_visitor_invites WHERE host_user_id = ? AND created_at >= ?",
                            (host, ag.iso(at - timedelta(days=1)))).fetchone()[0]
    live_all = conn.execute(f"SELECT COUNT(*) FROM access_visitor_invites vi JOIN access_grants g ON g.id = vi.grant_id WHERE g.state IN ({marks})",
                            ag.LIVE).fetchone()[0]
    return {"host_live": int(live_host), "host_day": int(day_host), "installation_live": int(live_all)}


def envelope_misses(conn: sqlite3.Connection, scope: ag.Scope, counts: dict[str, int], at: Any) -> list[str]:
    """Why an invitation is OUTSIDE the envelope (empty = inside). A miss routes to a second person; it never refuses."""
    misses: list[str] = []
    entrances = visitor_entrances(conn)
    if any(s not in entrances for s in scope.doors):
        misses.append("not_visitor_entrance")
    if sum(len(r) for r in scope.doors.values()) > ag.max_doors(conn):
        misses.append("doors")
    vf, vu = ag.parse_iso(scope.valid_from), ag.parse_iso(scope.valid_until)
    if vf and vu and (vu - vf) > timedelta(hours=_int(conn, "max_hours")):
        misses.append("too_long")
    if vf and vf > at + timedelta(days=_int(conn, "max_ahead_days")):
        misses.append("too_far_ahead")
    if counts["host_live"] >= _int(conn, "host_live_max"):
        misses.append("host_live")
    if counts["host_day"] >= _int(conn, "host_day_max"):
        misses.append("host_day")
    if counts["installation_live"] >= _int(conn, "installation_live_max"):
        misses.append("installation_live")
    return misses


def _visitor_contact(conn: sqlite3.Connection, host: Principal, name: str, digits: str, lang: str) -> str:
    """The host's visitor contact for this number (re-used when the same host invites the same number again), else a new one."""
    row = conn.execute("SELECT c.id FROM ticket_contacts c JOIN access_visitor_invites vi ON vi.visitor_contact_id = c.id WHERE c.phone_e164 = ? "
                       "AND c.erased_at IS NULL AND vi.host_user_id = ? ORDER BY vi.created_at DESC LIMIT 1", (digits, host.user_id)).fetchone()
    if row is not None:
        conn.execute("UPDATE ticket_contacts SET display_name = ?, lang = ?, active = 1, updated_at = ?, revision = revision + 1 WHERE id = ?",
                     (name, lang, ag.iso(ag.now()), row[0]))
        return row[0]
    try:
        from .tickets.contacts import phone_key_for

        pkey, pkid = phone_key_for(digits)
    except Exception:  # noqa: BLE001 - no tickets module key: the number cannot be verified until the module is on
        pkey, pkid = None, None
    cid = uuid.uuid4().hex
    at = ag.iso(ag.now())
    conn.execute("INSERT INTO ticket_contacts(id, kind, display_name, phone_e164, phone_key, phone_key_id, lang, active, created_by, created_at, updated_at) "
                 "VALUES (?, 'person', ?, ?, ?, ?, ?, 1, ?, ?, ?)", (cid, name, digits, pkey, pkid, lang, host.user_id, at, at))
    return cid


def _number_conflict(conn: sqlite3.Connection, host: Principal, digits: str) -> str | None:
    """Identity rules that keep one person = one credential (not limits): the host's own number, a signed-in user's number and a vendor's
    technician (who has his own grant path) are never invited as a visitor."""
    rows = conn.execute("SELECT id, user_id, vendor_id, employee FROM ticket_contacts WHERE phone_e164 = ? AND erased_at IS NULL", (digits,)).fetchall()
    for r in rows:
        if r["user_id"] == host.user_id:
            return "own_number"
        if r["user_id"] or r["employee"]:
            return "staff_number"
        if r["vendor_id"]:
            return "technician_number"
    return None


def invite(db: Database, principal: Principal, body: dict[str, Any], request_id: str | None = None) -> dict[str, Any]:
    """POST /access/visitors. Interactive host holding `access.visitor.invite` on EVERY chosen station."""
    at = ag.now()
    with db.connection(label="access_visitors.invite") as conn:
        if not enabled(conn):
            raise _hidden()

        def deny(reason: str, exc: ApiError) -> ApiError:
            ag._audit(conn, principal, "access.visitor.invite", "*", decision="denied", reason=reason, resource_type="access_visitor_invite", request_id=request_id)
            return exc

        if not ag._interactive(principal):
            raise deny("not_interactive", ApiError(403, "access_grant_interactive_only", "הזמנת מבקר אפשרית רק ממסך מחובר של אדם."))
        if str(principal.user_id).startswith(LOCAL_ID_PREFIX) and not ag.local_approvers(conn):
            raise deny("local_not_allowed", ApiError(403, "access_grant_local_not_allowed", "משתמש Arx מקומי אינו יכול להזמין מבקרים."))
        crid = str(body.get("client_request_id") or "")[:64] or None
        if crid:
            old = conn.execute("SELECT id FROM access_visitor_invites WHERE host_user_id = ? AND client_request_id = ?", (principal.user_id, crid)).fetchone()
            if old is not None:  # a replayed request answers the stored invitation
                return present(conn, principal, invite_row(conn, old[0]))
        doors = ag.parse_doors(body.get("doors"), ag.MAX_DOORS_CAP)
        missing = ag.missing_on(conn, principal, (PERMISSION,), ag.stations_of(doors))
        if missing:
            perm, sid = missing[0]
            ag._audit(conn, principal, "access.visitor.invite", "*", decision="denied", reason="no_binding", resource_type="access_visitor_invite",
                      request_id=request_id, permission=perm, station=sid)
            raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
        name = _clean_name(body.get("visitor_name"))
        digits = _phone(body.get("phone"))
        lang = body.get("lang") if body.get("lang") in ag.TEMPLATES else "he"
        mode = ag.parse_code_mode(body.get("mode")) or ("single_entry" if single_default(conn) else "window")
        purpose = body.get("purpose") if body.get("purpose") in PURPOSES else "guest"
        vf, vu = ag.parse_window(body.get("valid_from"), body.get("valid_until"), ag.max_days(conn), at)
        scope = ag.Scope(doors, vf, vu, ag.parse_timing(body.get("timing")), "pin")
        conflict = _number_conflict(conn, principal, digits)
        if conflict:
            raise deny(conflict, ag._conflict("access_visitor_number", "אי אפשר להזמין את המספר הזה כמבקר.", reason=conflict))
        counts = _counts(conn, principal.user_id, at)
        misses = envelope_misses(conn, scope, counts, at)
        contact_id = _visitor_contact(conn, principal, name, digits, lang)
        live = ag.live_grant_of(conn, "contact", contact_id)
        if live is not None and invite_of_grant(conn, live["id"]) is not None and invite_of_grant(conn, live["id"])["host_user_id"] != principal.user_id:
            raise deny("other_host", ag._conflict("access_visitor_number", "אי אפשר להזמין את המספר הזה כמבקר.", reason="other_host"))
        invite_id = uuid.uuid4().hex
        # source_ref stays NULL: a grant's source_ref names a ticket (the R5 trigger reads it); the invite row points at the grant instead
        g, outcome = ag.request_grant(conn, actor=principal, requested_by=principal.user_id, contact_id=contact_id, source_kind="manual",
                                      source_ref=None, assignment_id=None, scope=scope, request_id=request_id, purpose=None, code_mode=mode)
        existing = invite_of_grant(conn, g["id"])
        kind = "host_envelope" if not misses else "second_person"
        if existing is None:
            conn.execute("INSERT INTO access_visitor_invites(id, grant_id, host_user_id, visitor_contact_id, mode, approval_kind, purpose, client_request_id, "
                         "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                         (invite_id, g["id"], principal.user_id, contact_id, mode, kind, purpose, crid, ag.iso(at), ag.iso(at)))
        else:
            invite_id = existing["id"]
            conn.execute("UPDATE access_visitor_invites SET mode = ?, purpose = ?, updated_at = ?, revision = revision + 1 WHERE id = ?",
                         (mode, purpose, ag.iso(at), invite_id))
        ag._audit(conn, principal, "access.visitor.invite", invite_id, resource_type="access_visitor_invite", request_id=request_id, grant_id=g["id"],
                  stations=ag.stations_of(doors), window=[vf, vu], mode=mode, purpose=purpose, approval_kind=kind, outcome=outcome,
                  envelope_misses=misses or None)
        if not misses and g["state"] == "requested":
            _approve_as_host(conn, principal, ag.grant_row(conn, g["id"]), told=bool(body.get("told")), request_id=request_id)
            ag._audit(conn, principal, "access.visitor.approve_envelope", invite_id, resource_type="access_visitor_invite", request_id=request_id, grant_id=g["id"])
        elif misses:
            ag._audit(conn, principal, "access.visitor.needs_approval", invite_id, resource_type="access_visitor_invite", request_id=request_id,
                      grant_id=g["id"], reasons=misses)
            ag.notify_request(conn, g["id"])
        out = present(conn, principal, invite_row(conn, invite_id))
    ag.WORKER.wake()
    return out


def _approve_as_host(conn: sqlite3.Connection, host: Principal, g: dict[str, Any], *, told: bool, request_id: str | None) -> None:
    """D4: the host's own interactive act approves an invitation inside the envelope. The visitor's number is confirmed later (D8): the
    worker provisions the doors, and the code waits for the confirmation (`awaiting_confirmation`)."""
    at = ag.now()
    contact = ag.contact_row(conn, g["subject_id"]) or {}
    if told:
        conn.execute("INSERT OR IGNORE INTO access_grant_notices(grant_id, version, via, by_ref, at) VALUES (?, ?, 'approver', ?, ?)",
                     (g["id"], ag.NOTICE_VERSION, host.user_id, ag.iso(at)))
    fields = {"state": "approved", "approved_by": host.user_id, "approved_at": ag.iso(at), "approval_revision": permission_revision(conn),
              "phone_confirmed_at": contact.get("phone_confirmed_at"), "provision_after": None, "provision_attempts": 0, "code_state": "pending",
              "code_due_at": ag.code_due(conn, g["valid_from"], at), "card_state": None}
    ag._touch(conn, g["id"], fields, expect_revision=g["revision"])
    ag._audit(conn, host, "access.grant.approve", g["id"], request_id=request_id, stations=ag.stations_of(json.loads(g["doors_json"] or "{}")),
              window=[g["valid_from"], g["valid_until"]], credential="pin", approval_revision=fields["approval_revision"], kind="host_envelope",
              code_mode=g.get("code_mode"))


# ---------------------------------------------------------------- the visitor's number (D8)

def _own_or_404(conn: sqlite3.Connection, principal: Principal, invite_id: str) -> dict[str, Any]:
    inv = invite_row(conn, invite_id)
    if inv is None or inv["host_user_id"] != principal.user_id:
        raise _hidden()
    return inv


def verify_send(db: Database, principal: Principal, invite_id: str, request_id: str | None = None) -> dict[str, Any]:
    """The host asks for the verification code to go to the visitor's number (the tickets phone-verification caps apply)."""
    from .tickets import phone_verify
    from .tickets.access import Viewer

    with db.connection(label="access_visitors.verify_send") as conn:
        if not enabled(conn):
            raise _hidden()
        inv = _own_or_404(conn, principal, invite_id)
        row = ag.contact_row(conn, inv["visitor_contact_id"])
        out = phone_verify.send_code(conn, Viewer(conn, principal), row, by="host", rid=request_id)
        ag._audit(conn, principal, "access.visitor.verify_send", invite_id, resource_type="access_visitor_invite", request_id=request_id)
        return out


def verify_check(db: Database, principal: Principal, invite_id: str, code: Any, request_id: str | None = None) -> dict[str, Any]:
    """The code the visitor read to the host. Correct -> the visitor's number is confirmed BY CODE; the code may then be generated."""
    from .tickets import phone_verify
    from .tickets.access import Viewer

    with db.connection(label="access_visitors.verify_check") as conn:
        if not enabled(conn):
            raise _hidden()
        inv = _own_or_404(conn, principal, invite_id)
        row = ag.contact_row(conn, inv["visitor_contact_id"])
        phone_verify.check_code(conn, Viewer(conn, principal), row, code, by="host", rid=request_id)
        on_confirmed(conn, inv)
        ag._audit(conn, principal, "access.visitor.confirm", invite_id, resource_type="access_visitor_invite", request_id=request_id)
        out = present(conn, principal, invite_row(conn, invite_id))
    ag.WORKER.wake()
    return out


def on_confirmed(conn: sqlite3.Connection, inv: dict[str, Any]) -> None:
    """After the visitor's number is confirmed by code: the invitation and the grant record it (so the number check of the code and the
    R3 trigger see the same confirmation), and a pending code becomes due at its normal time."""
    at = ag.now()
    contact = ag.contact_row(conn, inv["visitor_contact_id"]) or {}
    conn.execute("UPDATE access_visitor_invites SET confirmed_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?", (ag.iso(at), ag.iso(at), inv["id"]))
    g = ag.grant_row(conn, inv["grant_id"])
    if g is not None and g["state"] in ag.LIVE:
        fields: dict[str, Any] = {"phone_confirmed_at": contact.get("phone_confirmed_at")}
        if g.get("code_state") == "pending" and g["state"] in ag.DECIDED:
            fields["code_due_at"] = ag.code_due(conn, g["valid_from"], at)
        ag._touch(conn, g["id"], fields)


# ---------------------------------------------------------------- cancel / revoke all / views

def cancel(db: Database, principal: Principal, invite_id: str, request_id: str | None = None) -> dict[str, Any]:
    """The host cancels his invitation (even after losing the invite permission); a holder of the grant / people-manage permission on one
    of its stations may revoke it too. The grant's authority is withdrawn now; the strip follows (at least once, with proof)."""
    with db.connection(label="access_visitors.cancel") as conn:
        if not enabled(conn) and not ag.enabled(conn):
            raise _hidden()
        inv = invite_row(conn, invite_id)
        if inv is None:
            raise _hidden()
        g = ag.grant_row(conn, inv["grant_id"])
        stations = ag.stations_of(json.loads((g or {}).get("doors_json") or "{}"))
        own = inv["host_user_id"] == principal.user_id
        manager = any(ag.holds_somewhere(conn, principal, p, stations) for p in (ag.PERMISSION, "access.people.manage")) if stations else False
        if not own and not manager:
            raise _hidden()
        if g is not None:
            ag.mark_revoking(conn, g, "manual", actor=principal, request_id=request_id)
        conn.execute("UPDATE access_visitor_invites SET end_reason = COALESCE(end_reason, ?), updated_at = ?, revision = revision + 1 WHERE id = ?",
                     ("host_cancelled" if own else "manager_revoked", ag.iso(ag.now()), invite_id))
        ag._audit(conn, principal, "access.visitor.cancel", invite_id, resource_type="access_visitor_invite", request_id=request_id, by="host" if own else "manager")
        return present(conn, principal, invite_row(conn, invite_id))


def revoke_all(db: Database, principal: Principal, confirm: str, request_id: str | None = None) -> int:
    """System administrator, typed word: every live visitor grant withdrawn now."""
    with db.connection(label="access_visitors.revoke_all") as conn:
        if not is_system_admin(conn, principal.user_id):
            ag._audit(conn, principal, "access.visitor.revoke_all", "*", decision="denied", reason="not_system_admin", resource_type="installation", request_id=request_id)
            raise ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לבטל את כל המבקרים.")
        if (confirm or "").strip() != REVOKE_ALL_WORD:
            raise ApiError(422, "confirm_word", f"יש להקליד \"{REVOKE_ALL_WORD}\" לאישור.")
        marks = ",".join("?" * len(ag.LIVE))
        rows = [dict(r) for r in conn.execute(f"SELECT g.* FROM access_grants g JOIN access_visitor_invites vi ON vi.grant_id = g.id WHERE g.state IN ({marks})",
                                              ag.LIVE).fetchall()]
        for g in rows:
            ag.mark_revoking(conn, g, "manual", actor=principal, request_id=request_id)
        ag._audit(conn, principal, "access.visitor.revoke_all", "*", resource_type="installation", request_id=request_id, count=len(rows))
        return len(rows)


def present(conn: sqlite3.Connection, principal: Principal, inv: dict[str, Any] | None) -> dict[str, Any]:
    """The host's (or a station manager's) view of one invitation. The visitor's first name is shown to the host only; never the number
    beyond the last two digits, never a code."""
    if inv is None:
        raise _hidden()
    g = ag.grant_row(conn, inv["grant_id"]) or {}
    contact = ag.contact_row(conn, inv["visitor_contact_id"]) or {}
    doors = json.loads(g.get("doors_json") or "{}")
    own = inv["host_user_id"] == principal.user_id
    return {"id": inv["id"], "grant_id": inv["grant_id"], "state": g.get("state"), "code_state": g.get("code_state"), "mode": inv["mode"],
            "approval_kind": inv["approval_kind"], "purpose": inv["purpose"], "valid_from": g.get("valid_from"), "valid_until": g.get("valid_until"),
            "doors": [{"station_id": s, "name": ag._station_name(s), "relays": doors[s]} for s in ag.stations_of(doors)],
            "visitor": {"name": contact.get("display_name") if own else None, "number": ag.mask_number(contact) if own else None},
            "confirmed": bool(inv.get("confirmed_at")), "entries": inv["entries"], "first_entry_at": inv.get("first_entry_at"),
            "end_reason": inv.get("end_reason"), "created_at": inv["created_at"], "own": own}


def list_for(conn: sqlite3.Connection, principal: Principal, *, mine_only: bool = False, limit: int = 200) -> list[dict[str, Any]]:
    """The caller's own invitations, plus (unless `mine_only`) every invitation on a station where he holds the grant / people-read permission."""
    rows = [dict(r) for r in conn.execute("SELECT * FROM access_visitor_invites ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()]
    out = []
    for inv in rows:
        if inv["host_user_id"] == principal.user_id:
            out.append(present(conn, principal, inv))
            continue
        if mine_only:
            continue
        g = ag.grant_row(conn, inv["grant_id"])
        if g is not None and ag.visible(conn, principal, g):
            out.append(present(conn, principal, inv))
    return out


def erase_due(conn: sqlite3.Connection) -> int:
    """D10: the visitor's name and number erased once the erase date of an ended invitation passed (the tickets tombstone; ids stay)."""
    from .tickets import store_links

    at = ag.iso(ag.now())
    rows = conn.execute("SELECT id, visitor_contact_id FROM access_visitor_invites WHERE erased_at IS NULL AND erase_due_at IS NOT NULL AND erase_due_at <= ?",
                        (at,)).fetchall()
    n = 0
    for r in rows:
        live = conn.execute("SELECT 1 FROM access_visitor_invites vi JOIN access_grants g ON g.id = vi.grant_id WHERE vi.visitor_contact_id = ? "
                            f"AND g.state IN ({','.join('?' * len(ag.LIVE))})", (r["visitor_contact_id"], *ag.LIVE)).fetchone()
        if live is None:
            store_links.erase_contact(conn, r["visitor_contact_id"], TOMBSTONE)
        conn.execute("UPDATE access_visitor_invites SET erased_at = ?, updated_at = ? WHERE id = ?", (at, at, r["id"]))
        ag._audit(conn, None, "access.visitor.erase", r["id"], resource_type="access_visitor_invite")
        n += 1
    return n
