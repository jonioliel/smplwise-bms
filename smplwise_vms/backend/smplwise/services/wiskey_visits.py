"""WISKEY-VISITS-2407 (card WISKEY-VISITS-2400, owner decision 07.11 option "ב"): Arx's visitor invitations connected to WisKey's own visit
mechanism, with ONE place where the operator manages guests - Arx. Docs: docs/changes/WISKEY-VISITS-2407.md.

The roles (no double writer):

| What                                   | Owner / writer           | How Arx sees it                                                      |
|----------------------------------------|--------------------------|----------------------------------------------------------------------|
| an Arx invitation (services/access_visitors.py) | Arx (source of truth) | its own screen; the grant engine provisions the person in WisKey |
| the WisKey visit RECORD of that invitation | Arx pushes, WisKey stores | `visits/record_external_v1` (NOT in WisKey rc.10 - the ask, doc section 4) |
| a visit created in WisKey's own panel  | WisKey (two-person approval there) | read only: `visits/list`, origin `wiskey`, no action in Arx  |
| guest templates (visit presets)        | WisKey                   | read only: `guest_templates/get`, offered as presets of the invite form |

Why not WisKey's existing `visits/create` / `visits/request` / `visits/decide` (rc.10 access/visit_requests.py):
- `visits/create` creates a SECOND WisKey person for the guest - the grant engine already created one (one person = one credential);
- `visits/request` on the grant engine's person files a WisKey request that WisKey's `guard_activation` then enforces: the grant engine's
  own activation write is refused `visit_approval_required` until a WisKey operator approves it in WisKey - two approvers of one guest and
  a write race between the grant engine and WisKey's decision;
- `visits/decide` must come from the approver chosen in WisKey (`actor == approver_id`, an HA user); Arx's single service identity cannot
  be that second operator (the same reason `platform/lifecycle_decide` and `jobs/approval_*` are on no channel).
So none of the three is on any channel; Arx sends nothing that creates, requests or decides a WisKey visit.

The push (single writer, sent once, never retried):
1. gates, before anything: the administrator's switch `access.visitors.wiskey_push` (default `off`), WisKey listing the record command for
   the add-on's identity (`overview.api.commands`), the caller (the host, or a manager of one of the invitation's stations), and the
   invitation being pushable (decided in Arx, the person exists in WisKey);
2. the claim: `wiskey_visit_links` is set `sending` with the Arx revision in its own committed transaction; a second push of the same
   invitation while one is `sending`, or after an `unknown` outcome, is refused (409, nothing sent) - an `unknown` is settled only by
   `reconcile` (a read of WisKey's list), never by sending again;
3. ONE frame on the closed `visits_push` channel (services/wiskey_channels.py), the people-write lane, `target` = the invitation, so the
   feed itself refuses a second write to it after an unknown outcome until a fresh read (R3-06);
4. the outcome row and Arx's audit (`access.visitor.wiskey_push`: attempt + outcome; ids, revisions and codes only). WisKey's own audit
   row of the record is part of the ask.
The record is an idempotent upsert keyed by `external_ref` (the invitation id) with a monotonic `arx_revision` (the grant's revision + the
invitation's revision): WisKey keeps the highest revision it saw, so a late duplicate can never overwrite a newer state.

What is sent: ids, the window, the doors, the status (`approved` / `ended`), the approval kind and instant, the Arx approver's id - never
the visitor's name or number, a code, a PIN or a card. What is read is projected into a closed shape: never WisKey's actor ids (HA user ids
of the requester / approver / decider), the employee number, the responsible person, the purpose text, or credential flags.

Pure helpers + the flows; the HTTP side is routers/access_wiskey_visits.py. Tests: tests/test_wiskey_visits_2407.py (fake WisKey only)."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any

from ..db import Database, get_setting, set_setting
from ..errors import ApiError
from ..rbac import Principal
from . import access_grants as ag
from . import intercom_client
from .intercom_client import IntercomError

READ_CHANNEL = "visits"  # services/wiskey_channels.py VISITS
PUSH_CHANNEL = "visits_push"  # services/wiskey_channels.py VISITS_PUSH (unpinned: the command post-dates rc.10)
LANE = "config"  # the people-write lane of intercom_sync (one slot, never queued, never retried)

LIST = "visits/list"
TEMPLATES = "guest_templates/get"
RECORD = "visits/record_external_v1"  # THE ASK (doc section 4): not in WisKey rc.10
READS = frozenset({LIST, TEMPLATES})
# WisKey's own visit writes Arx deliberately never sends (see the module note); tests check no channel carries them
NEVER = frozenset({"visits/create", "visits/request", "visits/decide", "visits/operators", "guest_templates/upsert", "guest_templates/delete"})

FEATURES: dict[str, tuple[str, ...]] = {"visits": (LIST,), "templates": (TEMPLATES,), "push": (RECORD,)}

SWITCH_KEY = "access.visitors.wiskey_push"
AUDIT_PUSH = "access.visitor.wiskey_push"
AUDIT_RECONCILE = "access.visitor.wiskey_reconcile"
AUDIT_SETTINGS = "access.visitor.wiskey_settings"
PAGE = 200  # WisKey's page cap for visits/list
RECONCILE_PAGES = 5

STATUSES = frozenset({"pending", "approved", "rejected", "cancelled", "superseded"})
ARX_STATUSES = ("approved", "ended")
CATEGORIES = frozenset({"visitor", "contractor"})
REASON_CODES = frozenset({"approved", "visit_rejected", "visit_cancelled", "replaced"})
PUSHABLE = {"approved": "approved", "provisioning": "approved", "active": "approved", "revoking": "ended", "ended": "ended", "revoked": "ended"}

# the reason of a capability that is not available, in the operator's words (the screen shows this text as is)
REASON_HE: dict[str, str] = {
    "not_listed": "מערכת בקרת הכניסה המותקנת אינה מציעה את הפעולה הזו לזהות של Arx.",
    "push_not_offered": "מערכת בקרת הכניסה המותקנת עדיין אינה מציעה רישום של ביקור שנוצר ב-Arx. הבקשה הועברה לספק; עד אז הביקורים מנוהלים ב-Arx בלבד.",
    "commands_unknown": "מערכת בקרת הכניסה לא מסרה אילו פעולות זמינות, ולכן שום דבר לא נשלח.",
    "api_incompatible": "הגרסה המותקנת של מערכת בקרת הכניסה אינה תואמת לגרסה הזו של Arx.",
    "no_copy": "עדיין אין חיבור פעיל למערכת בקרת הכניסה.",
    "push_off": "רישום הביקורים במערכת בקרת הכניסה כבוי בהגדרות (מנהל מערכת).",
    "installation_unavailable": "ההתקנה המנוהלת של מערכת בקרת הכניסה אינה זמינה, ולכן שום דבר לא נשלח.",
    "writes_disabled": "הכתיבה כבויה בצד מערכת בקרת הכניסה, ולכן שום דבר לא נשלח.",
    "unauthorized": "מערכת בקרת הכניסה אינה מרשה לזהות של Arx לבצע את הפעולה.",
}

_CODE = re.compile(r"^[a-z0-9][a-z0-9_.:-]{0,63}$")
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")


def reason_text(reason: str | None) -> str | None:
    if reason is None:
        return None
    return REASON_HE.get(reason, f"לא זמין ({reason}).")


# ---------------------------------------------------------------- capability

def feature_state(api: dict[str, Any] | None, feature: str) -> tuple[bool, str | None]:
    """(available, reason) from the served copy's `api` facts. Fail closed: no copy = not available (`no_copy`)."""
    if api is None:
        return False, "no_copy"
    min_client = api.get("min_client")
    if isinstance(min_client, int) and min_client > intercom_client.API_CONTRACT:
        return False, "api_incompatible"
    commands = api.get("commands")
    if commands is None:
        return False, "commands_unknown"
    if not all(c in commands for c in FEATURES[feature]):
        return False, "push_not_offered" if feature == "push" else "not_listed"
    return True, None


def switch_on(conn: sqlite3.Connection) -> bool:
    try:
        return (get_setting(conn, SWITCH_KEY) or "off") == "on"
    except sqlite3.Error:
        return False


def set_switch(conn: sqlite3.Connection, on: bool) -> tuple[str, str]:
    before = "on" if switch_on(conn) else "off"
    set_setting(conn, SWITCH_KEY, "on" if on else "off")
    return before, "on" if on else "off"


def capabilities(conn: sqlite3.Connection, api: dict[str, Any] | None) -> dict[str, Any]:
    """The three capabilities with their Hebrew reason. `push` needs WisKey's command AND the administrator's switch."""
    out: dict[str, Any] = {}
    for name in FEATURES:
        available, reason = feature_state(api, name)
        if name == "push" and available and not switch_on(conn):
            available, reason = False, "push_off"
        out[name] = {"available": available, "reason": reason, "message": reason_text(reason)}
    out["push"]["switch"] = "on" if switch_on(conn) else "off"
    out["push"]["offered"] = feature_state(api, "push")[0]
    return out


# ---------------------------------------------------------------- the frames

def _result(frame: Any, command: str) -> Any:
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        raise IntercomError(str(error.get("code") or "action_failed"), command)
    raise IntercomError("invalid_response", command)


async def ask(call: intercom_client.Call, command: str, **fields: Any) -> Any:
    """One frame with exactly the catalog's keys. The two reads are READ commands (no `api_contract`); the record is a write and carries it."""
    if command not in READS and command != RECORD:
        raise IntercomError("not_allowed_on_channel", command)
    if command == RECORD:
        fields["api_contract"] = intercom_client.API_CONTRACT
    return _result(await call(intercom_client.command_type(command), **fields), command)


async def list_visits(call: intercom_client.Call, *, offset: int, limit: int, status: str = "all", query: str = "") -> Any:
    filters: dict[str, Any] = {"status": status, "scope": "all"}
    if query:
        filters["query"] = query
    return await ask(call, LIST, offset=offset, limit=limit, filters=filters)


async def templates_get(call: intercom_client.Call) -> Any:
    return await ask(call, TEMPLATES)


async def record_external(call: intercom_client.Call, record: dict[str, Any]) -> Any:
    return await ask(call, RECORD, record=record)


async def find_external(call: intercom_client.Call, external_ref: str) -> dict[str, Any]:
    """Every page of WisKey's list (at most RECONCILE_PAGES) searched for the record of `external_ref`. `complete` says the whole list was read."""
    offset = 0
    for _ in range(RECONCILE_PAGES):
        page = await list_visits(call, offset=offset, limit=PAGE)
        if not isinstance(page, dict):
            raise IntercomError("invalid_response", LIST)
        for row in page.get("items") or []:
            if isinstance(row, dict) and row.get("external_ref") == external_ref and row.get("source") == "arx":
                return {"found": project_visit(row), "complete": True}
        nxt = page.get("next_offset")
        if not isinstance(nxt, int) or nxt <= offset:
            return {"found": None, "complete": True}
        offset = nxt
    return {"found": None, "complete": False}


# ---------------------------------------------------------------- projections (closed shapes)

def _text(v: Any, limit: int) -> str | None:
    if not isinstance(v, str):
        return None
    t = "".join(c for c in v if ord(c) >= 32).strip()
    return t[:limit] or None


def _iso(v: Any) -> str | None:
    t = _text(v, 40)
    return t if t and re.match(r"^\d{4}-\d{2}-\d{2}T", t) else None


def _id(v: Any) -> str | None:
    return v if isinstance(v, str) and _ID.match(v) else None


def _doors(v: Any) -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    if not isinstance(v, dict):
        return out
    for sid, locks in list(v.items())[:100]:
        if _id(sid) and isinstance(locks, list):
            clean = sorted({lock for lock in locks if type(lock) is int and lock in (1, 2)})
            if clean:
                out[sid] = clean
    return out


def _int(v: Any) -> int | None:
    return v if type(v) is int and v >= 0 else None


def project_visit(raw: Any) -> dict[str, Any] | None:
    """One `visits/list` row. Dropped whatever WisKey sends: requested_by / approver_id / decided_by (HA user ids), the employee number, the
    responsible person, the purpose text, pin_configured / enabled_cards (credential flags), the timing schedule body."""
    if not isinstance(raw, dict) or not _id(raw.get("id")):
        return None
    snap = raw.get("snapshot") if isinstance(raw.get("snapshot"), dict) else {}
    status = raw.get("status") if raw.get("status") in STATUSES else "unknown"
    reason = raw.get("reason_code") if raw.get("reason_code") in REASON_CODES else (None if not raw.get("reason_code") else "other")
    source = raw.get("source") if raw.get("source") in ("arx", "wiskey") else "wiskey"
    external = _id(raw.get("external_ref")) if source == "arx" else None
    return {
        "id": raw["id"], "user_id": _id(raw.get("user_id")), "status": status, "reason_code": reason,
        "requested_at": _iso(raw.get("requested_at")), "decided_at": _iso(raw.get("decided_at")),
        "display_name": _text(snap.get("display_name"), 32),
        "access_category": snap.get("access_category") if snap.get("access_category") in CATEGORIES else "unknown",
        "valid_from": _iso(snap.get("valid_from")), "valid_until": _iso(snap.get("valid_until")), "doors": _doors(snap.get("doors")),
        "weekly_hours": isinstance(snap.get("timing_schedule"), dict),
        "stale": raw.get("stale") is True, "user_deleted": raw.get("user_deleted") is True,
        "source": source, "external_ref": external, "revision": _int(raw.get("revision")),
    }


def project_visit_page(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise ValueError("unexpected visits/list answer")
    return {"items": [v for r in raw["items"] if (v := project_visit(r)) is not None], "total": _int(raw.get("total")) or 0,
            "offset": _int(raw.get("offset")) or 0, "next_offset": _int(raw.get("next_offset")), "revision": _int(raw.get("revision"))}


def project_templates(raw: Any) -> dict[str, Any]:
    """`guest_templates/get` -> presets. Dropped: `updated_by` (an HA user), the responsible person and purpose texts (CR-036: sensitive)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise ValueError("unexpected guest_templates/get answer")
    items = []
    for t in raw["items"][:100]:
        if not isinstance(t, dict) or not _id(t.get("id")):
            continue
        minutes = t.get("duration_minutes")
        items.append({"id": t["id"], "label": _text(t.get("label"), 80) or "",
                      "access_category": t.get("access_category") if t.get("access_category") in CATEGORIES else "unknown",
                      "duration_minutes": minutes if type(minutes) is int and 15 <= minutes <= 43200 else None,
                      "doors": _doors(t.get("doors")), "weekly_hours": isinstance(t.get("weekly_timing"), dict),
                      "updated_at": _iso(t.get("updated_at"))})
    items.sort(key=lambda t: (t["label"].casefold(), t["id"]))
    return {"items": items, "revision": _int(raw.get("revision"))}


def project_record(raw: Any) -> dict[str, Any]:
    """The record command's answer (the ask's shape): `{visit_id, revision, arx_revision, status}`."""
    if not isinstance(raw, dict) or not _id(raw.get("visit_id")):
        raise ValueError("unexpected visits/record_external_v1 answer")
    return {"visit_id": raw["visit_id"], "revision": _int(raw.get("revision")), "arx_revision": _int(raw.get("arx_revision")),
            "status": raw.get("status") if raw.get("status") in ARX_STATUSES else "unknown"}


# ---------------------------------------------------------------- Arx's side: origin, eligibility, the record

def arx_people(conn: sqlite3.Connection) -> dict[str, str]:
    """WisKey person id -> Arx invitation id, for every invitation whose grant has a linked WisKey person."""
    try:
        rows = conn.execute("SELECT l.wiskey_person_id, vi.id FROM access_visitor_invites vi JOIN access_grants g ON g.id = vi.grant_id "
                            "JOIN access_person_links l ON l.id = g.link_id ORDER BY vi.created_at").fetchall()
    except sqlite3.Error:
        return {}
    return {r[0]: r[1] for r in rows}


def mark_origin(conn: sqlite3.Connection, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """`origin`: `arx` when the row is the record Arx pushed or its person is an Arx visitor's; `wiskey` otherwise (read only in Arx)."""
    people = arx_people(conn)
    known = set(people.values())
    for row in items:
        invite = row["external_ref"] if row["source"] == "arx" and row["external_ref"] in known else people.get(row.get("user_id") or "")
        row["origin"] = "arx" if invite else "wiskey"
        row["arx_invite_id"] = invite
        row["read_only"] = True  # every WisKey row is read only in Arx; an Arx invitation is managed on its own card
        row.pop("user_id", None)
    return items


def link_row(conn: sqlite3.Connection, invite_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT * FROM wiskey_visit_links WHERE invite_id = ?", (invite_id,)).fetchone()
    return dict(r) if r else None


def _invite_and_grant(conn: sqlite3.Connection, invite_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    inv = conn.execute("SELECT * FROM access_visitor_invites WHERE id = ?", (invite_id,)).fetchone()
    if inv is None:
        return None
    g = ag.grant_row(conn, inv["grant_id"])
    return (dict(inv), g) if g is not None else None


def may_act(conn: sqlite3.Connection, principal: Principal, inv: dict[str, Any], g: dict[str, Any]) -> bool:
    """The host, or a holder of the grant / people-manage permission on one of the invitation's stations (the cancel rule)."""
    if inv["host_user_id"] == principal.user_id:
        return True
    stations = ag.stations_of(json.loads(g.get("doors_json") or "{}"))
    return bool(stations) and any(ag.holds_somewhere(conn, principal, p, stations) for p in (ag.PERMISSION, "access.people.manage"))


def arx_revision(inv: dict[str, Any], g: dict[str, Any]) -> int:
    return int(g.get("revision") or 1) + int(inv.get("revision") or 1)


def wiskey_person(conn: sqlite3.Connection, g: dict[str, Any]) -> str | None:
    if not g.get("link_id"):
        return None
    r = conn.execute("SELECT wiskey_person_id FROM access_person_links WHERE id = ? AND state = 'linked'", (g["link_id"],)).fetchone()
    return r[0] if r else None


def record_of(conn: sqlite3.Connection, inv: dict[str, Any], g: dict[str, Any]) -> dict[str, Any] | None:
    """The record Arx hands WisKey (None = not pushable: not decided in Arx, or no WisKey person yet). Ids, window, doors, status only."""
    status = PUSHABLE.get(g["state"])
    person = wiskey_person(conn, g)
    if status is None or person is None:
        return None
    return {"external_ref": inv["id"], "arx_revision": arx_revision(inv, g), "user_id": person, "status": status,
            "valid_from": g["valid_from"], "valid_until": g["valid_until"], "doors": json.loads(g.get("doors_json") or "{}"),
            "approval": {"kind": inv["approval_kind"], "approved_at": g.get("approved_at"), "approver_ref": g.get("approved_by")},
            "end_reason": inv.get("end_reason") if status == "ended" else None}


def link_view(conn: sqlite3.Connection, inv: dict[str, Any], g: dict[str, Any]) -> dict[str, Any]:
    """The invitation's WisKey record state as the screen shows it. `in_sync`: WisKey confirmed the current Arx revision."""
    link = link_row(conn, inv["id"]) or {}
    record = record_of(conn, inv, g)
    current = arx_revision(inv, g)
    return {"invite_id": inv["id"], "state": link.get("state") or "never", "pushed_revision": link.get("pushed_revision"),
            "current_revision": current, "in_sync": link.get("state") == "pushed" and link.get("pushed_revision") == current,
            "pushable": record is not None, "wiskey_visit_id": link.get("wiskey_visit_id"), "last_code": link.get("last_code"),
            "attempted_at": link.get("attempted_at")}


# ---------------------------------------------------------------- the push

def _deny(conn: sqlite3.Connection, principal: Principal, invite_id: str, reason: str, request_id: str | None, exc: ApiError) -> ApiError:
    ag._audit(conn, principal, AUDIT_PUSH, invite_id, decision="denied", reason=reason, resource_type="access_visitor_invite", request_id=request_id)
    return exc


def _hidden() -> ApiError:
    return ApiError(404, "not_found", "לא נמצא.")


def claim(db: Database, principal: Principal, invite_id: str, api: dict[str, Any] | None, request_id: str | None) -> dict[str, Any]:
    """Steps 1-2: every gate, then the `sending` claim, committed. Returns the record to send. Raises an audited ApiError when not sent."""
    with db.connection(label="wiskey_visits.claim") as conn:
        pair = _invite_and_grant(conn, invite_id)
        if pair is None or not may_act(conn, principal, *pair):
            raise _hidden()
        inv, g = pair
        if not switch_on(conn):
            raise _deny(conn, principal, invite_id, "push_off", request_id,
                        ApiError(409, "wiskey_visits_push_off", REASON_HE["push_off"], details={"reason": "push_off"}))
        available, reason = feature_state(api, "push")
        if not available:
            raise _deny(conn, principal, invite_id, str(reason), request_id,
                        ApiError(409, "wiskey_visits_push_unsupported", reason_text(reason) or "", details={"reason": reason}))
        record = record_of(conn, inv, g)
        if record is None:
            raise _deny(conn, principal, invite_id, "not_pushable", request_id,
                        ApiError(409, "wiskey_visits_not_ready", "ההזמנה עדיין לא אושרה ב-Arx או שהמבקר עוד לא נוצר במערכת בקרת הכניסה. נסו שוב אחרי שההזמנה פעילה.",
                                 details={"state": g["state"]}))
        link = link_row(conn, invite_id)
        if link and link["state"] == "sending":
            raise _deny(conn, principal, invite_id, "in_flight", request_id,
                        ApiError(409, "wiskey_visits_in_flight", "שליחה קודמת של ההזמנה הזו עדיין בדרך. לא נשלח דבר נוסף."))
        if link and link["state"] == "unknown":
            raise _deny(conn, principal, invite_id, "outcome_unknown", request_id,
                        ApiError(409, "wiskey_visits_outcome_unknown", "לשליחה הקודמת אין תוצאה ברורה. יש לבצע \"בדיקה מול מערכת בקרת הכניסה\" לפני ששולחים שוב."))
        if link and link["state"] == "pushed" and link["pushed_revision"] == record["arx_revision"]:
            raise _deny(conn, principal, invite_id, "in_sync", request_id,
                        ApiError(409, "wiskey_visits_in_sync", "הרישום במערכת בקרת הכניסה כבר מעודכן. לא נשלח דבר."))
        at = ag.iso(ag.now())
        conn.execute("INSERT INTO wiskey_visit_links(invite_id, state, sent_revision, sent_status, attempted_by, attempted_at, created_at, updated_at) "
                     "VALUES (?, 'sending', ?, ?, ?, ?, ?, ?) ON CONFLICT(invite_id) DO UPDATE SET state = 'sending', sent_revision = excluded.sent_revision, "
                     "sent_status = excluded.sent_status, attempted_by = excluded.attempted_by, attempted_at = excluded.attempted_at, "
                     "updated_at = excluded.updated_at, last_code = NULL WHERE wiskey_visit_links.state NOT IN ('sending', 'unknown')",
                     (invite_id, record["arx_revision"], record["status"], principal.user_id, at, at, at))
        if conn.execute("SELECT changes()").fetchone()[0] != 1:  # another request claimed it between the read above and this write
            raise _deny(conn, principal, invite_id, "in_flight", request_id,
                        ApiError(409, "wiskey_visits_in_flight", "שליחה קודמת של ההזמנה הזו עדיין בדרך. לא נשלח דבר נוסף."))
        ag._audit(conn, principal, AUDIT_PUSH, invite_id, resource_type="access_visitor_invite", request_id=request_id, phase="attempt",
                  arx_revision=record["arx_revision"], status=record["status"], stations=ag.stations_of(record["doors"]))
        return record


def settle(db: Database, principal: Principal | None, invite_id: str, outcome: str, *, code: str | None = None, reply: dict[str, Any] | None = None,
           revision: int | None = None, request_id: str | None = None, action: str = AUDIT_PUSH) -> None:
    """Step 4 (and the reconcile's verdict): `pushed` | `refused` | `not_sent` | `unknown`, plus Arx's outcome audit row."""
    at = ag.iso(ag.now())
    safe_code = code if isinstance(code, str) and _CODE.match(code) else (None if code is None else "other")
    with db.connection(label="wiskey_visits.settle") as conn:
        if outcome == "pushed":
            conn.execute("UPDATE wiskey_visit_links SET state = 'pushed', pushed_revision = ?, wiskey_visit_id = COALESCE(?, wiskey_visit_id), last_code = NULL, "
                         "settled_at = ?, updated_at = ? WHERE invite_id = ?", (revision, (reply or {}).get("visit_id"), at, at, invite_id))
        else:
            conn.execute("UPDATE wiskey_visit_links SET state = ?, last_code = ?, settled_at = ?, updated_at = ? WHERE invite_id = ?",
                         (outcome, safe_code, at, at, invite_id))
        ag._audit(conn, principal, action, invite_id, resource_type="access_visitor_invite", request_id=request_id, phase="outcome", outcome=outcome,
                  code=safe_code, arx_revision=revision, wiskey_visit_id=(reply or {}).get("visit_id"))


def wiskey_refusal(code: str) -> ApiError:
    if code in ("installation_unavailable", "writes_disabled", "unauthorized"):
        return ApiError(409 if code != "unauthorized" else 403, f"wiskey_visits_{code}", REASON_HE[code], details={"wiskey_code": code})
    if code in ("revision_conflict", "visit_record_stale"):
        return ApiError(409, "wiskey_visits_stale", "במערכת בקרת הכניסה יש גרסה חדשה יותר של הרישום. טענו מחדש ובדקו.", details={"wiskey_code": code})
    return ApiError(409, "wiskey_visits_refused", f"מערכת בקרת הכניסה דחתה את רישום הביקור ({code}). לא נרשם דבר.", details={"wiskey_code": code})
