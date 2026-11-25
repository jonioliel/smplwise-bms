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

WISKEY-R6-2520 (WisKey rc.19 contract `external-visits-v1`, docs/changes/WISKEY-R6-2520.md):
- RECORD ONLY. The command stores visit metadata next to a person WisKey already has; it creates no person, credential, activation or
  grant, and Arx sends nothing else with it (the grant engine still owns the person and its access).
- The record is contract-valid or it is not sent: `record_problems` checks the closed shape (the nine keys, exact references, a lowercase
  UUID person, explicit-offset instants with from < until inside 1970..2037, 1..100 stations of unique locks 1/2, an approval with
  kind / instant / approver, `end_reason` null for `approved` and non-empty for `ended`). A record Arx cannot make valid is refused in Arx
  (409 `wiskey_visits_record_invalid`, audited, field names only) - nothing is invented to fill a gap.
- The answer is read with a closed code table (RECORD_REFUSED / RECORD_UNKNOWN): only the contract's pre-write refusals are `refused`;
  `visit_record_outcome_unknown`, `bridge_outcome_unknown` and every code the table does not know are `unknown`, settled only by a read
  (never by sending again). A success whose result is not exactly the sent `external_ref`'s revision and status is `unknown` too.
- The reconcile reads the one row by the exact `filters.external_ref` (rc.19 B8) and compares WisKey's `arx_revision` with the sent one.
- WISKEY-VISITS-ENDED-FILTER-2520: the list's `filters.status=ended` (an Arx record that ended) is offered only when WisKey lists the
  record command - WisKey added the `ended` list filter in the same change as the command (its access/visit_requests.py `list_requests`
  at rc.19 / rc.20; rc.10 refuses `ended` with `invalid_fields`). `list_statuses` is that decision; the router refuses `ended` before
  any call when it is not offered (409 `wiskey_visits_unsupported`, feature `ended_filter`), and the panel shows the option only then.
- Rollback boundary (WisKey's, documented for the operator): WisKey's first stored record migrates its visits store to schema 2, which the
  older WisKey code refuses - there is no code-only downgrade to rc.17 after it; WisKey's users / visits backup taken at that moment is
  not a full Home Assistant / Arx backup.

Pure helpers + the flows; the HTTP side is routers/access_wiskey_visits.py. Tests: tests/test_wiskey_visits_2407.py,
tests/test_wiskey_visits_b8_2520.py (fake WisKey only)."""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any

from ..db import Database, get_setting, set_setting
from ..error_text import tpl
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
RECORD = "visits/record_external_v1"  # WisKey rc.19 contract external-visits-v1 (B8); not in rc.10
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

# `ended` is an Arx record's status in the rc.19 list (external rows keep `approved` / `ended`)
STATUSES = frozenset({"pending", "approved", "rejected", "cancelled", "superseded", "ended"})
ARX_STATUSES = ("approved", "ended")
# the list's status filter values every WisKey version accepts (rc.10 access/visit_requests.py `STATUSES | {"all"}`); `ended` only with
# the record command (WISKEY-VISITS-ENDED-FILTER-2520, `list_statuses`)
LIST_STATUSES = ("all", "pending", "approved", "rejected", "cancelled", "superseded")
ENDED_FILTER = "ended"

# ---- external-visits-v1 (WisKey rc.19 docs/contracts/external-visits-v1, record.v1 / result.v1 / error.v1)
RECORD_FIELDS = ("external_ref", "arx_revision", "user_id", "status", "valid_from", "valid_until", "doors", "approval", "end_reason")
APPROVAL_FIELDS = ("kind", "approved_at", "approver_ref")
MAX_REVISION = 9_007_199_254_740_991
EARLIEST = datetime(1970, 1, 1, tzinfo=timezone.utc)
LATEST = datetime(2037, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
_REF = re.compile(r"^[^\s\x00-\x1f\x7f](?:[^\x00-\x1f\x7f]*[^\s\x00-\x1f\x7f])?$")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_INSTANT = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})$")
# The answer's closed code table. `refused` = the contract's refusals before the authoritative write (CONTRACT.txt "Known refusals
# before authoritative write": the seven named codes, the original validation, limit, permission and transport errors). `unknown` = the
# two UNKNOWN codes. A code on neither list is read as `unknown` too (fail toward unknown, never toward refused).
RECORD_REFUSED = (intercom_client.PRE_EFFECT.get(RECORD, frozenset()) | intercom_client.PRE_DISPATCH
                  | frozenset({"installation_unavailable", "writes_disabled", "visit_record_stale", "revision_conflict", "user_not_found",
                               "visit_user_not_temporary", "storage_stopping", "invalid_text", "invalid_id", "invalid_validity",
                               "visit_request_limit"}))
RECORD_UNKNOWN = frozenset({"visit_record_outcome_unknown", "bridge_outcome_unknown"})
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
    "ended_filter_not_offered": "מערכת בקרת הכניסה המותקנת אינה מציעה סינון של ביקורים שהסתיימו. לא נשלח דבר.",
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
    out["visits"]["statuses"] = list_statuses(api)
    return out


def list_statuses(api: dict[str, Any] | None) -> list[str]:
    """WISKEY-VISITS-ENDED-FILTER-2520: the `filters.status` values the connected WisKey accepts on `visits/list`. `ended` only when WisKey
    lists the record command for the add-on's identity (`overview.api.commands`) - the list filter came with that command in WisKey's
    source; no version label is read. No copy, unknown commands or rc.10: the six statuses every version takes (fail closed)."""
    return [*LIST_STATUSES, ENDED_FILTER] if feature_state(api, "push")[0] else list(LIST_STATUSES)


# ---------------------------------------------------------------- the frames

def _result(frame: Any, command: str) -> Any:
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        raise IntercomError(str(error.get("code") or "action_failed"), command)
    raise IntercomError("invalid_response", command)


def record_answer(frame: Any) -> Any:
    """The record command's answer through the closed code table: a success returns its result (the projection judges it); a failure
    is a refusal (IntercomError) only for a RECORD_REFUSED code; RECORD_UNKNOWN, any other code and a frame that is neither are
    `UnclearAnswer` - outcome unknown, settled only by reading WisKey's list."""
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code in RECORD_REFUSED and code not in RECORD_UNKNOWN:
            raise IntercomError(code, RECORD)
        raise intercom_client.UnclearAnswer(RECORD, code or "action_failed")
    raise intercom_client.UnclearAnswer(RECORD, "invalid_response")


async def ask(call: intercom_client.Call, command: str, **fields: Any) -> Any:
    """One frame with exactly the catalog's keys. The two reads are READ commands (no `api_contract`); the record is a write and carries it."""
    if command not in READS and command != RECORD:
        raise IntercomError("not_allowed_on_channel", command)
    if command == RECORD:
        fields["api_contract"] = intercom_client.API_CONTRACT
        return record_answer(await call(intercom_client.command_type(command), **fields))
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


def _hit(row: Any, external_ref: str) -> dict[str, Any] | None:
    if isinstance(row, dict) and row.get("source") == "arx" and row.get("external_ref") == external_ref:
        projected = project_visit(row)
        if projected is not None:
            return {"found": projected, "arx_revision": _rev(row.get("arx_revision")), "complete": True}
    return None


async def find_external(call: intercom_client.Call, external_ref: str, *, exact: bool = False) -> dict[str, Any]:
    """The record of `external_ref` in WisKey's list. `exact` (the producer offers the record command, rc.19 B8): ONE read with the exact,
    case-sensitive `filters.external_ref` (native rows excluded) - more than one row for the key is ambiguity, answered `complete: False`
    (undecided, nothing settled). Otherwise every page (at most RECONCILE_PAGES) is searched. `complete` says the answer is conclusive;
    `arx_revision` is the revision WisKey holds (None when WisKey did not say)."""
    if exact:
        page = await ask(call, LIST, offset=0, limit=PAGE, filters={"status": "all", "scope": "all", "external_ref": external_ref})
        if not isinstance(page, dict) or not isinstance(page.get("items"), list):
            raise IntercomError("invalid_response", LIST)
        hits = [h for row in page["items"] if (h := _hit(row, external_ref)) is not None]
        if len(hits) > 1:
            return {"found": None, "arx_revision": None, "complete": False}
        return hits[0] if hits else {"found": None, "arx_revision": None, "complete": True}
    offset = 0
    for _ in range(RECONCILE_PAGES):
        page = await list_visits(call, offset=offset, limit=PAGE)
        if not isinstance(page, dict):
            raise IntercomError("invalid_response", LIST)
        for row in page.get("items") or []:
            if (hit := _hit(row, external_ref)) is not None:
                return hit
        nxt = page.get("next_offset")
        if not isinstance(nxt, int) or nxt <= offset:
            return {"found": None, "arx_revision": None, "complete": True}
        offset = nxt
    return {"found": None, "arx_revision": None, "complete": False}


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


def _rev(v: Any) -> int | None:
    """A contract revision: a strict JSON integer in [1, MAX_REVISION] (a boolean or a float is not one)."""
    return v if type(v) is int and 1 <= v <= MAX_REVISION else None


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


RESULT_FIELDS = frozenset({"visit_id", "revision", "arx_revision", "status"})


def project_record(raw: Any, expect: dict[str, Any] | None = None) -> dict[str, Any]:
    """The record command's answer, result.v1 exactly: `{visit_id (lowercase UUID), revision, arx_revision, status}`, closed. With
    `expect` (the record sent) the answer must name the sent `arx_revision` and `status` - WisKey answers the stored revision, so a
    different one is not a receipt of this record. Anything else raises: after a success frame that is "outcome unknown", never ok."""
    if (not isinstance(raw, dict) or set(raw) != RESULT_FIELDS or not isinstance(raw.get("visit_id"), str) or not _UUID.match(raw["visit_id"])
            or _rev(raw.get("revision")) is None or _rev(raw.get("arx_revision")) is None or raw.get("status") not in ARX_STATUSES):
        raise ValueError("unexpected visits/record_external_v1 answer")
    if expect is not None and (raw["arx_revision"] != expect.get("arx_revision") or raw["status"] != expect.get("status")):
        raise ValueError("visits/record_external_v1 answer is not the sent revision")
    return {"visit_id": raw["visit_id"], "revision": raw["revision"], "arx_revision": raw["arx_revision"], "status": raw["status"]}


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
    """The record Arx hands WisKey (None = not pushable: not decided in Arx, or no WisKey person yet). Ids, window, doors, status only -
    exactly the nine RECORD_FIELDS, values as Arx holds them (nothing invented; `record_problems` says whether they make a valid record).
    `end_reason` of an ended record: the invitation's reason, else the grant's (both Arx's own words, e.g. `host_cancelled`, `ended`)."""
    status = PUSHABLE.get(g["state"])
    person = wiskey_person(conn, g)
    if status is None or person is None:
        return None
    try:
        doors: Any = json.loads(g.get("doors_json") or "{}")
    except ValueError:
        doors = None
    return {"external_ref": inv["id"], "arx_revision": arx_revision(inv, g), "user_id": person, "status": status,
            "valid_from": g.get("valid_from"), "valid_until": g.get("valid_until"), "doors": doors,
            "approval": {"kind": inv.get("approval_kind"), "approved_at": g.get("approved_at"), "approver_ref": g.get("approved_by")},
            "end_reason": (inv.get("end_reason") or g.get("end_reason")) if status == "ended" else None}


def _ref_ok(v: Any, limit: int) -> bool:
    return isinstance(v, str) and 1 <= len(v) <= limit and _REF.match(v) is not None


def _instant(v: Any) -> datetime | None:
    """An explicit-offset RFC 3339 instant (the contract's pattern, at most 40 characters) as an aware UTC datetime; None otherwise."""
    if not isinstance(v, str) or len(v) > 40 or not _INSTANT.match(v):
        return None
    try:
        when = datetime.fromisoformat(v)
    except ValueError:
        return None
    return when.astimezone(timezone.utc) if when.tzinfo is not None else None


def record_problems(record: Any) -> list[str]:
    """The record.v1 rules (and the producer's business parser) the record breaks, as field paths - empty = contract-valid. Field names
    only, never values: the list goes to the audit row and the screen."""
    if not isinstance(record, dict):
        return ["record"]
    out: list[str] = []
    if set(record) != set(RECORD_FIELDS):
        out.append("record.keys")
    if not _ref_ok(record.get("external_ref"), 128):
        out.append("external_ref")
    if _rev(record.get("arx_revision")) is None:
        out.append("arx_revision")
    if not isinstance(record.get("user_id"), str) or not _UUID.match(record["user_id"]):
        out.append("user_id")
    status = record.get("status")
    if status not in ARX_STATUSES:
        out.append("status")
    start, end = _instant(record.get("valid_from")), _instant(record.get("valid_until"))
    if start is None:
        out.append("valid_from")
    if end is None:
        out.append("valid_until")
    if start is not None and end is not None and not (EARLIEST <= start < end <= LATEST):
        out.append("validity")
    doors = record.get("doors")
    if not isinstance(doors, dict) or not 1 <= len(doors) <= 100:
        out.append("doors")
    else:
        for station, locks in doors.items():
            if (not _ref_ok(station, 64) or not isinstance(locks, list) or not 1 <= len(locks) <= 2
                    or any(type(lock) is not int or lock not in (1, 2) for lock in locks) or len(set(locks)) != len(locks)):
                out.append("doors")
                break
    approval = record.get("approval")
    if not isinstance(approval, dict) or set(approval) != set(APPROVAL_FIELDS):
        out.append("approval")
    else:
        if not _ref_ok(approval.get("kind"), 64):
            out.append("approval.kind")
        if _instant(approval.get("approved_at")) is None:
            out.append("approval.approved_at")
        if not _ref_ok(approval.get("approver_ref"), 128):
            out.append("approval.approver_ref")
    reason = record.get("end_reason")
    if status == "approved" and reason is not None:
        out.append("end_reason")
    if status == "ended" and not _ref_ok(reason, 128):
        out.append("end_reason")
    return out


def link_view(conn: sqlite3.Connection, inv: dict[str, Any], g: dict[str, Any]) -> dict[str, Any]:
    """The invitation's WisKey record state as the screen shows it. `in_sync`: WisKey confirmed the current Arx revision. `pushable`:
    decided in Arx, the person exists in WisKey, and the record is contract-valid."""
    link = link_row(conn, inv["id"]) or {}
    record = record_of(conn, inv, g)
    current = arx_revision(inv, g)
    return {"invite_id": inv["id"], "state": link.get("state") or "never", "pushed_revision": link.get("pushed_revision"),
            "current_revision": current, "in_sync": link.get("state") == "pushed" and link.get("pushed_revision") == current,
            "pushable": record is not None and not record_problems(record), "wiskey_visit_id": link.get("wiskey_visit_id"),
            "last_code": link.get("last_code"), "attempted_at": link.get("attempted_at")}


# ---------------------------------------------------------------- the push

def _deny(conn: sqlite3.Connection, principal: Principal, invite_id: str, reason: str, request_id: str | None, exc: ApiError, **extra: Any) -> ApiError:
    ag._audit(conn, principal, AUDIT_PUSH, invite_id, decision="denied", reason=reason, resource_type="access_visitor_invite", request_id=request_id, **extra)
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
        problems = record_problems(record)
        if problems:  # WISKEY-R6-2520: a record Arx cannot make contract-valid is never sent (and nothing is filled in to make it valid)
            raise _deny(conn, principal, invite_id, "record_invalid", request_id,
                        ApiError(409, "wiskey_visits_record_invalid",
                                 "לא ניתן לבנות רישום תקין של ההזמנה עבור מערכת בקרת הכניסה (חסרים או לא תקינים: " + ", ".join(problems) + "). לא נשלח דבר.",
                                 details={"problems": problems,
                                          "message_en": "The invitation cannot be turned into a valid record for the access control system (missing or invalid: "
                                                        + ", ".join(problems) + "). Nothing was sent."}), problems=problems)
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


# The refusal table (WisKey's closed error.v1 codes that mean "not written"): Hebrew text as raised, English in `details.message_en`.
REFUSAL_TEXT: dict[str, tuple[int, str, str, str]] = {
    "installation_unavailable": (409, "wiskey_visits_installation_unavailable", REASON_HE["installation_unavailable"],
                                 "The managed access control installation is not available, so nothing was sent."),
    "writes_disabled": (409, "wiskey_visits_writes_disabled", REASON_HE["writes_disabled"],
                        "Writing is switched off on the access control side, so nothing was sent."),
    "unauthorized": (403, "wiskey_visits_unauthorized", REASON_HE["unauthorized"],
                     "The access control system does not allow Arx's identity to do this."),
    "visit_record_stale": (409, "wiskey_visits_stale", "במערכת בקרת הכניסה יש גרסה חדשה יותר של הרישום. טענו מחדש ובדקו.",
                           "The access control system holds a newer version of this record. Reload and check."),
    "revision_conflict": (409, "wiskey_visits_revision_conflict",
                          "במערכת בקרת הכניסה רשומה אותה גרסה של ההזמנה עם פרטים אחרים, או שהרישום שייך לאדם אחר. לא נרשם דבר.",
                          "The access control system holds the same revision of this invitation with other details, or the record belongs to another person. Nothing was recorded."),
    "visit_request_limit": (409, "wiskey_visits_limit", "מאגר הביקורים במערכת בקרת הכניסה מלא, ולכן ביקור חדש לא נרשם. לא נרשם דבר.",
                            "The access control system's visit store is full, so a new visit cannot be recorded. Nothing was recorded."),
    "user_not_found": (409, "wiskey_visits_person_missing", "המבקר לא נמצא במערכת בקרת הכניסה. לא נרשם דבר.",
                       "The visitor was not found in the access control system. Nothing was recorded."),
    "visit_user_not_temporary": (409, "wiskey_visits_person_not_temporary", "האדם במערכת בקרת הכניסה אינו מסומן כמבקר או כקבלן. לא נרשם דבר.",
                                 "The person in the access control system is not marked as a visitor or contractor. Nothing was recorded."),
    "storage_stopping": (409, "wiskey_visits_storage_stopping", "מערכת בקרת הכניסה בעצירה או בהפעלה מחדש. לא נרשם דבר - נסו שוב מאוחר יותר.",
                         "The access control system is stopping or restarting. Nothing was recorded - try again later."),
    "rate_limited": (409, "wiskey_visits_rate_limited", "מערכת בקרת הכניסה עמוסה כרגע. לא נרשם דבר - נסו שוב בעוד רגע.",
                     "The access control system is busy right now. Nothing was recorded - try again in a moment."),
}
RETRYABLE = frozenset({"storage_stopping", "rate_limited"})


def wiskey_refusal(code: str) -> ApiError:
    """A proven refusal (RECORD_REFUSED) as the screen says it. Validation codes (`invalid_*`, `request_too_large`, `api_incompatible`)
    and any other refusal keep the generic text with the code."""
    if code in REFUSAL_TEXT:
        status, api_code, he, en = REFUSAL_TEXT[code]
        return ApiError(status, api_code, he, retryable=code in RETRYABLE, details={"wiskey_code": code, "message_en": en})
    return ApiError(409, "wiskey_visits_refused", tpl("מערכת בקרת הכניסה דחתה את רישום הביקור ({code}). לא נרשם דבר.", code=code),
                    details={"wiskey_code": code, "message_en": f"The access control system refused the visit record ({code}). Nothing was recorded."})
