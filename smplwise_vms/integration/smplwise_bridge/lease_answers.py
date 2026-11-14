"""The closed answers of `wiskey-capture-lease-v1` (SCHEMA.md section 4; the five files next to it: capture_*.answer.schema.json and
CAPTURE_ANSWER_CODES.json) - what the bridge lets back out to Arx.

WisKey (stage 8) answers a `LeaseDTO`; the bridge passes the answer on ONLY when it is exactly one of the closed shapes for that action,
names the request it was asked about (`request_id`, and for the events the same `sequence`) and carries nothing else. Anything else - an
extra key, a free-text `code`, a number where a string belongs, a card value - is NOT relayed (the caller turns it into a service error,
which Arx reads as "no acknowledgement" and retries or revokes on).

Dependency-free. Never logs, and no function here returns or raises with the offending value."""
from __future__ import annotations

import copy
import re
from typing import Any

from .lease_contract import CODES, POST_SCHEMA_STAGES, LeaseDTO

UUID4_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
SESSION_ID_RE = re.compile(r"[A-Za-z0-9_-]{1,128}")
MASKED_RE = re.compile(r"•{4}( [A-Za-z0-9_-]{4})?")

EVENT_RESULTS = {
    "acknowledged": ("sequence", "destroyed"),
    "duplicate": ("sequence",),
    "stale": ("sequence", "last_sequence"),
    "gap": ("sequence", "last_sequence", "destroyed"),
    "conflict": ("sequence", "destroyed"),
    "unknown_stream": (),
}
MAX_LIVE_LEASES_ANSWER = 64  # Arx reads at most 64 refs of a heartbeat answer (lease_events.classify)

REFUSED_CODES = {
    "capture_start": ("capture_station_busy", "capture_limit", "revision_conflict", "lease_gone", "binding_denied", "capture_unsupported",
                      "capture_reader_invalid", "capture_failed"),
    "capture_status": ("capture_not_found", "lease_gone", "binding_denied", "capture_operation_busy"),
    "capture_confirm": ("capture_not_ready", "invalid_text", "capture_operation_busy", "capture_not_found", "lease_gone", "binding_denied",
                        "card_conflict", "revision_conflict"),
    "capture_cancel": ("capture_not_found", "lease_gone", "binding_denied", "capture_applying"),
}
STAGE_CODE_RE = re.compile(r"[a-z][a-z0-9_]{0,63}")  # CAPTURE_ANSWER_CODES / SCHEMA.md section 4: both `stage` and `code`
CAPTURE_STATES = ("preparing", "waiting", "captured", "error")
CAPTURE_ERRORS = ("capture_timeout", "capture_unsupported", "capture_reader_invalid", "capture_failed")
TECHNOLOGIES = ("TypeA_M1", "TypeA_CPU", "TypeB", "ID_125K", "FelicaCard", "DesfireCard")
PERSON_KEYS = frozenset({
    "id", "employee_no", "display_name", "phone", "access_category", "responsible_person", "access_purpose", "archived_at", "access_timing_draft",
    "access_timing_policy", "active", "user_type", "valid_from", "valid_until", "assignments", "revision", "created_at", "updated_at", "identity_locked",
    "profile", "group_ids", "permission_overrides", "photo_configured", "pin_configured", "cards"})
ASSIGNMENT_KEYS = frozenset({"config_entry_id", "enabled", "allowed_locks", "schedule_template", "desired_revision", "applied_revision", "sync_state",
                             "last_sync_at", "last_error"})
SYNC_STATES = ("synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending")
PERSON_CARD_KEYS = frozenset({"id", "masked_number", "label", "card_type", "enabled"})


def _int(v: Any, lo: int = 0, hi: int | None = None) -> bool:
    return type(v) is int and v >= lo and (hi is None or v <= hi)


def _str(v: Any, lo: int = 0, hi: int | None = None) -> bool:
    return isinstance(v, str) and len(v) >= lo and (hi is None or len(v) <= hi)


def _opt_str(v: Any) -> bool:
    return v is None or isinstance(v, str)


def _keys(obj: Any, required: frozenset[str] | set[str] | tuple[str, ...], optional: tuple[str, ...] = ()) -> bool:
    if not isinstance(obj, dict):
        return False
    want = set(required)
    return want <= set(obj) and set(obj) <= want | set(optional)


# ---------------------------------------------------------------- the closed sub-objects

def _card_ok(card: Any) -> bool:
    """WisKey CapturedCard.public(): the masked form only."""
    return (_keys(card, {"masked_number", "technology", "reader_id"}) and isinstance(card["masked_number"], str) and bool(MASKED_RE.fullmatch(card["masked_number"]))
            and (card["technology"] is None or card["technology"] in TECHNOLOGIES) and (card["reader_id"] is None or _int(card["reader_id"], 1, 8)))


def _assignment_ok(a: Any) -> bool:
    if not _keys(a, ASSIGNMENT_KEYS):
        return False
    locks = a["allowed_locks"]
    return (_str(a["config_entry_id"], 1) and type(a["enabled"]) is bool and isinstance(locks, list) and all(type(x) is int and x in (1, 2) for x in locks)
            and len(set(locks)) == len(locks) and a["schedule_template"] is None and _int(a["desired_revision"], 1)
            and (a["applied_revision"] is None or _int(a["applied_revision"], 1)) and a["sync_state"] in SYNC_STATES and _opt_str(a["last_sync_at"])
            and _opt_str(a["last_error"]))


def _person_card_ok(c: Any) -> bool:
    return (_keys(c, PERSON_CARD_KEYS) and _str(c["id"], 1) and isinstance(c["masked_number"], str) and bool(MASKED_RE.fullmatch(c["masked_number"]))
            and isinstance(c["label"], str) and c["card_type"] == "normalCard" and type(c["enabled"]) is bool)


def _person_ok(p: Any) -> bool:
    """Exactly WisKey `ManagedUser.public()` after the card was added: never `pin`, `card_no` or `photo` (the key set is closed)."""
    if not _keys(p, PERSON_KEYS):
        return False
    overrides, assignments, profile = p["permission_overrides"], p["assignments"], p["profile"]
    return (isinstance(p["id"], str) and bool(UUID_RE.fullmatch(p["id"])) and _str(p["employee_no"], 1) and _str(p["display_name"], 1, 32) and isinstance(p["phone"], str)
            and p["access_category"] in ("staff", "visitor", "contractor") and _str(p["responsible_person"], 0, 64) and _str(p["access_purpose"], 0, 128)
            and _opt_str(p["archived_at"]) and (p["access_timing_draft"] is None or isinstance(p["access_timing_draft"], dict))
            and (p["access_timing_policy"] is None or isinstance(p["access_timing_policy"], dict)) and type(p["active"]) is bool and p["user_type"] == "normal"
            and _opt_str(p["valid_from"]) and _opt_str(p["valid_until"])
            and isinstance(assignments, dict) and all(isinstance(k, str) and len(k) <= 64 and _assignment_ok(v) for k, v in assignments.items())
            and _int(p["revision"], 1) and _str(p["created_at"], 1) and _str(p["updated_at"], 1) and type(p["identity_locked"]) is bool
            and isinstance(profile, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in profile.items())
            and isinstance(p["group_ids"], list) and all(isinstance(x, str) for x in p["group_ids"])
            and isinstance(overrides, dict) and len(overrides) <= 100 and all(isinstance(k, str) and len(k) <= 64 and v in ("allow", "deny") for k, v in overrides.items())
            and type(p["photo_configured"]) is bool and type(p["pin_configured"]) is bool
            and isinstance(p["cards"], list) and all(_person_card_ok(c) for c in p["cards"]))


# ---------------------------------------------------------------- the answers

def _echo(answer: dict[str, Any], dto: LeaseDTO) -> bool:
    rid = answer.get("request_id")
    return isinstance(rid, str) and rid == dto.request_id and bool(UUID4_RE.fullmatch(rid))


def _host_rejected(answer: dict[str, Any], dto: LeaseDTO) -> bool:
    """A `rejected` the host (WisKey) maps onto the wire. It can only come from a stage AFTER the schema stage (the bridge ran the first four itself), so
    `request_id` is required and equal to the request's; `stage` and `code` match the closed regex AND belong to CAPTURE_ANSWER_CODES.json
    (`rejected.post_schema`: binding, signature, time, state; `lease_window` is a `capture_start` code only)."""
    if not (_keys(answer, {"result", "stage", "code", "request_id"}) and answer["result"] == "rejected" and _echo(answer, dto)):
        return False
    stage, code = answer["stage"], answer["code"]
    if not (isinstance(stage, str) and isinstance(code, str) and STAGE_CODE_RE.fullmatch(stage) and STAGE_CODE_RE.fullmatch(code)):
        return False
    if stage not in POST_SCHEMA_STAGES or code not in CODES[stage]:
        return False
    return code != "lease_window" or dto.action == "capture_start"


def event_answer(dto: LeaseDTO, answer: Any) -> dict[str, Any] | None:
    """The closed `lease_event` answer for `dto`, or None when `answer` is not one (SCHEMA.md section 4)."""
    if not isinstance(answer, dict) or dto.action not in ("lease_revoke", "lease_heartbeat", "lease_stream_reset"):
        return None
    if answer.get("result") == "rejected":
        return copy.deepcopy(answer) if _host_rejected(answer, dto) else None
    fields = EVENT_RESULTS.get(answer.get("result")) if isinstance(answer.get("result"), str) else None
    if fields is None:
        return None
    optional = ("live_leases",) if answer["result"] == "acknowledged" and dto.action == "lease_heartbeat" else ()
    if not _keys(answer, {"result", "request_id", *fields}, optional) or not _echo(answer, dto):
        return None
    if "sequence" in fields and answer["sequence"] != dto.params["sequence"]:
        return None
    if any(not _int(answer[f]) for f in fields if f != "sequence"):
        return None
    if "live_leases" in answer:
        live = answer["live_leases"]
        if (not isinstance(live, list) or len(live) > MAX_LIVE_LEASES_ANSWER or len(set(live)) != len(live)
                or not all(isinstance(x, str) and UUID_RE.fullmatch(x) for x in live)):
            return None
    return copy.deepcopy(answer)


def request_answer(dto: LeaseDTO, answer: Any) -> dict[str, Any] | None:
    """The closed `lease_request` answer for `dto` (one per action), or None when `answer` is not one."""
    a = dto.action
    if not isinstance(answer, dict) or a not in REFUSED_CODES:
        return None
    result = answer.get("result")
    if result == "rejected":
        return copy.deepcopy(answer) if _host_rejected(answer, dto) else None
    if result == "refused":
        ok = _keys(answer, {"result", "request_id", "code"}) and _echo(answer, dto) and answer["code"] in REFUSED_CODES[a]
        return copy.deepcopy(answer) if ok else None
    if result == "sent_unknown":
        ok = a == "capture_confirm" and _keys(answer, {"result", "request_id"}) and _echo(answer, dto)
        return copy.deepcopy(answer) if ok else None
    if result != "acknowledged":
        return None
    payload = {"capture_start": "session", "capture_status": "capture", "capture_confirm": "person", "capture_cancel": "cancelled"}[a]
    if not _keys(answer, {"result", "request_id", payload}) or not _echo(answer, dto):
        return None
    body = answer[payload]
    if a == "capture_start":
        ok = _keys(body, {"session_id", "state"}) and isinstance(body["session_id"], str) and bool(SESSION_ID_RE.fullmatch(body["session_id"])) and body["state"] in ("preparing", "waiting")
    elif a == "capture_status":
        ok = (_keys(body, {"state", "error", "card"}) and body["state"] in CAPTURE_STATES
              and (body["error"] in CAPTURE_ERRORS if body["state"] == "error" else body["error"] is None)
              and (_card_ok(body["card"]) if body["state"] == "captured" else body["card"] is None))
    elif a == "capture_confirm":
        ok = _person_ok(body)
    else:
        ok = body is True
    return copy.deepcopy(answer) if ok else None
