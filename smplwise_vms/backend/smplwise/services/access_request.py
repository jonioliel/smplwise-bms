"""ACCESSREQ-293: the server side of the manual "request external access" form (owner-approved mockup
private/planning/mockup_access_request_2026-10-20, owner decisions of 2026-10-20).

  (a) the person who asked for a scope may not approve it - a second person must; a system administrator may approve his own request.
      Enforced in access_grants.approve (fail closed, `access_grant_self_approval`); "I approve now" is offered only when allowed.
  (b) a manager who may only REQUEST (tickets.manage + tickets.external, no grant permission on a station) may choose the stations
      marked "entrance for external people" plus the stations placed in the ticket's building. The same rule is enforced when the
      request is stored (`access_grant_station_not_allowed`), not only in the form.
  (c) writing the Arx name to WisKey stays manual by default (access_external.NAME_SYNC default `manual`; unchanged here).

What this module adds beside services/access_grants.py:
  - `request_rights` / `check_request_doors`: which stations the caller may put in a request (decision b) and may approve;
  - `grantable_doors`: the form's door list (stations and relays from the served WisKey copy, with its freshness);
  - `approvers`: who could approve the chosen stations (names only, Arx RBAC; the caller is left out unless he is a system administrator);
  - `notice_view`: the privacy notice text and the attestation in the person's language (access_grants.notice_text, so the organisation
    name stays in sync with the arrival page and the code message);
  - `clean_text`: the optional purpose and the internal notes;
  - `precheck_approve_now`: "I approve now" is refused BEFORE anything is stored when the caller could not approve it.

Nothing here talks to WisKey or WhatsApp; the station list is the served copy (intercom_sync.SYNC), never the device."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, LOCAL_ID_PREFIX, STATION, Principal, authorize, is_system_admin, permissions_anywhere
from . import access_grants as ag
from . import intercom_authority as ia

PURPOSE_MAX = 200
NOTES_MAX = 1000
LANGS = ("he", "en", "ar", "ru")
APPROVERS_SHOWN = 30
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮⁦-⁩]")


# ---------------------------------------------------------------- texts

def clean_text(value: Any, field_name: str, limit: int, *, multiline: bool = False) -> str | None:
    """An optional free text: trimmed, at most `limit` characters, no control or bidi-override characters (a line break only where
    `multiline`). Empty = None."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ag._invalid(field_name, "type")
    text = value.replace("\r\n", "\n").strip()
    if not multiline and "\n" in text:
        raise ag._invalid(field_name, "line_break", "השדה אינו יכול להכיל שורה חדשה.")
    if _CONTROL.search(text):
        raise ag._invalid(field_name, "characters", "השדה מכיל תווים שאינם מותרים.")
    if len(text) > limit:
        raise ag._invalid(field_name, "too_long", f"עד {limit} תווים.")
    return text or None


# ---------------------------------------------------------------- who may request what (owner decision b)

def tickets_requester(conn: sqlite3.Connection, principal: Principal) -> bool:
    """CR 3.2: a ticket manager who works with outside vendors may REQUEST (never approve) a grant."""
    return authorize(conn, principal, "tickets.manage", INSTALLATION).allowed and authorize(conn, principal, "tickets.external", INSTALLATION).allowed


def may_request(conn: sqlite3.Connection, principal: Principal) -> bool:
    return tickets_requester(conn, principal) or ag.PERMISSION in permissions_anywhere(conn, principal)


def entrance_ids(conn: sqlite3.Connection) -> set[str]:
    try:
        return {r[0] for r in conn.execute("SELECT station_id FROM access_station_entrance").fetchall()}
    except sqlite3.OperationalError:
        return set()


def ticket_station_ids(conn: sqlite3.Connection, ticket_id: str | None) -> set[str]:
    """"The ticket's station" (owner decision b): the stations placed in the ticket's building (the arrival page's own rule,
    access_arrival.suggested_doors). A ticket with no building has none."""
    if not ticket_id:
        return set()
    try:
        row = conn.execute("SELECT building_id FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if row is None or not row[0]:
            return set()
        return {r[0] for r in conn.execute("SELECT config_entry_id FROM intercom_station_placement WHERE building_id = ?", (row[0],)).fetchall()}
    except sqlite3.OperationalError:
        return set()


class Rights:
    """The caller's rights per station for one form: request (decision b), approve (the three approve permissions) and approve with
    a code (+ pin.generate). Computed once per call; every answer is rbac.authorize (deny-overrides over the station chain)."""

    def __init__(self, conn: sqlite3.Connection, principal: Principal, ticket_id: str | None) -> None:
        self.conn, self.principal = conn, principal
        self.tickets_ok = tickets_requester(conn, principal)
        self.entrances = entrance_ids(conn)
        self.ticket_stations = ticket_station_ids(conn, ticket_id)
        self._cache: dict[str, dict[str, bool]] = {}

    def of(self, sid: str) -> dict[str, bool]:
        if sid not in self._cache:
            base = not ag.missing_on(self.conn, self.principal, ag.approve_permissions("none"), [sid])
            pin = base and authorize(self.conn, self.principal, ia.PIN_GENERATE, (STATION, sid)).allowed
            grant = authorize(self.conn, self.principal, ag.PERMISSION, (STATION, sid)).allowed
            entrance, ticket = sid in self.entrances, sid in self.ticket_stations
            self._cache[sid] = {"request": base or grant or (self.tickets_ok and (entrance or ticket)), "approve": base, "approve_pin": pin,
                                "entrance": entrance, "ticket": ticket}
        return self._cache[sid]


def check_request_doors(conn: sqlite3.Connection, principal: Principal, doors: dict[str, list[int]], ticket_id: str | None,
                        request_id: str | None = None) -> None:
    """Owner decision (b), enforced where the request is stored: every station of the request must be one the caller may request."""
    rights = Rights(conn, principal, ticket_id)
    for sid in sorted(doors):
        if not rights.of(sid)["request"]:
            ag._audit(conn, principal, "access.grant.request", sid, decision="denied", reason="station_not_allowed", resource_type=STATION,
                      request_id=request_id)
            raise ApiError(403, "access_grant_station_not_allowed", "אין לך אפשרות לבקש גישה לעמדה הזו.", details={"station_id": sid})


# ---------------------------------------------------------------- the form's door list

def _relays(conn: sqlite3.Connection, station: dict[str, Any]) -> list[dict[str, Any]]:
    """The doors of a station: WisKey's integrated locks (physical index + name) from the served copy, else the CR-033 door map,
    else relay 1 (the arrival page's rule)."""
    out = [{"relay": int(lk["physical_index"]), "name": lk.get("name") or None} for lk in station.get("locks") or []
           if isinstance(lk.get("physical_index"), int) and 1 <= lk["physical_index"] <= 8]
    if not out:
        try:
            out = [{"relay": int(r[0]), "name": None} for r in conn.execute(
                "SELECT DISTINCT physical_index FROM intercom_door_map WHERE config_entry_id = ? ORDER BY physical_index", (station["id"],)).fetchall()
                if isinstance(r[0], int) and 1 <= r[0] <= 8]
        except sqlite3.OperationalError:
            out = []
    seen: dict[int, dict[str, Any]] = {}
    for d in out or [{"relay": 1, "name": None}]:
        seen.setdefault(d["relay"], {"relay": d["relay"], "name": str(d["name"])[:64] if d["name"] else None})
    return [seen[k] for k in sorted(seen)]


def freshness() -> dict[str, Any]:
    from .intercom_sync import STATE, SYNC

    return {"as_of": STATE.fetched_at, "reachable": STATE.state == "ready" and SYNC.has_copy(), "has_copy": SYNC.has_copy()}


def grantable_doors(conn: sqlite3.Connection, principal: Principal, ticket_id: str | None) -> dict[str, Any]:
    """Every station of the served WisKey copy with its doors and the caller's rights on it. A station the caller may not request
    is listed as locked (the mockup's collapsed group) - its name and doors only, never a person, a count or a host."""
    from .intercom_sync import SYNC

    rights = Rights(conn, principal, ticket_id)
    stations = []
    for s in SYNC.stations():
        sid = str(s.get("id") or "")
        if not ia.valid_id(sid):
            continue
        r = rights.of(sid)
        stations.append({"station_id": sid, "name": str(s.get("name") or "")[:64] or None, "online": bool(s.get("online")),
                         "relays": _relays(conn, s), "may_request": r["request"], "may_approve": r["approve"], "may_approve_pin": r["approve_pin"],
                         "entrance": r["entrance"], "ticket": r["ticket"]})
    stations.sort(key=lambda x: (not x["may_request"], x["name"] or "", x["station_id"]))
    return {"stations": stations, "max_doors": ag.max_doors(conn), "max_days": ag.max_days(conn), "tickets_requester": rights.tickets_ok,
            "system_admin": is_system_admin(conn, principal.user_id), **freshness()}


# ---------------------------------------------------------------- who may approve (names only)

def approvers(conn: sqlite3.Connection, principal: Principal, stations: list[str], credential: str) -> dict[str, Any]:
    """The Arx users who hold the approve permissions on EVERY chosen station (access_grants.approve_permissions; a local identity only
    when the owner allows local approvers). Owner decision (a): the caller is left out unless he is a system administrator, who may
    approve his own request. Display names only."""
    perms = ag.approve_permissions(credential)
    local_ok = ag.local_approvers(conn)
    me_admin = is_system_admin(conn, principal.user_id)
    names: list[dict[str, Any]] = []
    for row in conn.execute("SELECT id, display_name, username FROM users WHERE active = 1 ORDER BY display_name, username, id").fetchall():
        uid = row["id"]
        if str(uid).startswith(LOCAL_ID_PREFIX) and not local_ok:
            continue
        me = uid == principal.user_id
        if me and not me_admin:
            continue
        who = ag.principal_of(uid)
        if who.source == "local":  # a local identity approves only from a session that showed the second factor (USR2): judged as one
            who = Principal(user_id=uid, username="", display_name="", source="local", via="cookie", factor_ok=True)
        if ag.missing_on(conn, who, perms, stations):
            continue
        names.append({"name": (row["display_name"] or row["username"] or "—")[:64], "me": me})
    return {"approvers": names[:APPROVERS_SHOWN], "count": len(names), "self_approval": me_admin}


# ---------------------------------------------------------------- the notice

def notice_view(conn: sqlite3.Connection, lang: str) -> dict[str, Any]:
    if lang not in LANGS:
        raise ag._invalid("lang", "unknown")
    return {"lang": lang, "version": ag.NOTICE_VERSION, "text": ag.notice_text(conn, lang), "attest": ag.NOTICE_ATTEST[lang]}


# ---------------------------------------------------------------- "I approve now"

def precheck_approve_now(conn: sqlite3.Connection, principal: Principal, scope: "ag.Scope", contact_id: str, told: bool,
                         request_id: str | None = None) -> None:
    """Refuse "I approve now" BEFORE the request is stored when the caller could not approve it: owner decision (a) (the requester
    approves only as a system administrator), an interactive session, the local-identity rule, the approve permissions on every
    chosen station, the privacy-notice tick and - for a code - a number the person confirmed. access_grants.approve repeats every
    check (and the WisKey-side ones) when it runs; this only keeps a refused "approve now" from leaving a request behind."""
    def deny(reason: str, exc: ApiError) -> ApiError:
        ag._audit(conn, principal, "access.grant.approve", contact_id, decision="denied", reason=reason, request_id=request_id, resource_type="contact",
                  approve_now=True)
        return exc

    if not ag._interactive(principal):
        raise deny("not_interactive", ApiError(403, "access_grant_interactive_only", "אישור גישה אפשרי רק ממסך מחובר של אדם, לא מאפליקציה או סקריפט."))
    if str(principal.user_id).startswith(LOCAL_ID_PREFIX) and not ag.local_approvers(conn):
        raise deny("local_not_allowed", ApiError(403, "access_grant_local_not_allowed", "משתמש Arx מקומי אינו יכול לאשר גישת דלתות."))
    try:
        admin = is_system_admin(conn, principal.user_id)
    except sqlite3.Error:
        admin = False
    if not admin:
        raise deny("self_approval", ag.self_approval_error())
    missing = ag.missing_on(conn, principal, ag.approve_permissions(scope.credential), ag.stations_of(scope.doors))
    if missing:
        perm, sid = missing[0]
        ag._audit(conn, principal, "access.grant.approve", contact_id, decision="denied", reason="no_binding", request_id=request_id, resource_type="contact",
                  permission=perm, station=sid, approve_now=True)
        raise forbidden(permission=perm, target_type=STATION, target_id=sid, reason="no_binding")
    if not told:
        raise deny("notice", ag._conflict("access_grant_notice", "יש לאשר שהאדם קיבל את הודעת הפרטיות לפני מתן הגישה."))
    if scope.credential == "pin":
        contact = ag.contact_row(conn, contact_id)
        problem = ag.number_problem(conn, contact, ag.now()) if contact else "phone_not_verified"
        if problem:
            raise deny(problem, ag._conflict("access_grant_phone", "לקוד גישה דרוש מספר וואטסאפ שהאדם אישר בעצמו (בקוד) לאחרונה.", reason=problem))


def record_requester_notice(conn: sqlite3.Connection, principal: Principal, grant_id: str, request_id: str | None = None) -> None:
    """The requester's "I have told the technician" tick, stored with the request (via `requester`), so a later approver need not
    tick again. Ids and the text version only."""
    cur = conn.execute("INSERT OR IGNORE INTO access_grant_notices(grant_id, version, via, by_ref, at) VALUES (?, ?, 'requester', ?, ?)",
                       (grant_id, ag.NOTICE_VERSION, principal.user_id, ag.iso(ag.now())))
    if cur.rowcount:
        g = ag.grant_row(conn, grant_id) or {}
        ag._audit(conn, principal, "access.grant.notice_ack", grant_id, request_id=request_id, via="requester", version=ag.NOTICE_VERSION,
                  acknowledged_for=g.get("subject_id"), technician_id=g.get("subject_id"))
