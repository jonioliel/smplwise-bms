"""The closed answers of `wiskey-capture-lease-v1` (LEASEARX-295; docs/contracts/wiskey-capture-lease/ SCHEMA.md section 4).

Pure functions, no database, no clock, no transport. Two entry points:

- `classify_event(answer, request_id, sequence, action)` - the answer of `smplwise_bridge.lease_event` (`lease.schema.json`
  `$defs.answer_event`): `acknowledged | duplicate | stale | gap | conflict | unknown_stream | rejected`.
- `classify_request(answer, request_id, action)` - the answer of `smplwise_bridge.lease_request`, one closed schema per action
  (`capture_start | capture_status | capture_confirm | capture_cancel` `.answer.schema.json`) and the closed code table
  (`CAPTURE_ANSWER_CODES.json`).

What is closed (everything else is `invalid` / `unknown`, never an acknowledgement):
- every object has exactly the keys of its variant (`additionalProperties: false`);
- `request_id` is the request's own (a UUIDv4 by construction: lease_events.sign); in `rejected` it is FORBIDDEN at the transport / encoding / parse / schema
  stages and REQUIRED at the binding / signature / time / state stages;
- `rejected` carries a stage and a code of the closed table (for a request: the table of THAT action);
- `refused` carries a code of the closed per-action table;
- `sent_unknown` exists for `capture_confirm` only;
- an acknowledged status never reports `applying` (the host answers `refused capture_operation_busy` during a confirm).

The tables below are copies of `CAPTURE_ANSWER_CODES.json` and the four answer schemas; tests/test_lease_answers_closed_295.py compares
them with the files byte for byte of meaning (and validates samples with `jsonschema` where it is installed). The card value never
appears here: a status card is the masked form only, and the person of a confirm is refused when it carries `pin`, `card_no` or `photo`.
"""
from __future__ import annotations

import re
from typing import Any

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
MASKED_NUMBER_RE = re.compile(r"^•{4}( [A-Za-z0-9_-]{4})?$")

REQUEST_ACTIONS = ("capture_start", "capture_status", "capture_confirm", "capture_cancel")

# ---- rejected: stage -> codes
PRE_SCHEMA = {
    "transport": ("transport_shape",),
    "encoding": ("invalid_utf8", "lone_surrogate", "message_too_large"),
    "parse": ("invalid_json", "duplicate_key", "non_json_constant", "non_integer_number", "integer_out_of_range", "lone_surrogate", "not_an_object"),
    "schema": ("unknown_field", "missing_field", "wrong_type", "bad_format", "bad_value"),
}
_POST_COMMON = {
    "signature": ("bad_signature",),
    "time": ("clock_invalid", "lifetime_invalid", "not_yet_valid", "expired"),
    "state": ("replay", "storage_unavailable"),
}
_BINDING = ("ts_mismatch", "action_service_mismatch", "station_scope_mismatch")
POST_SCHEMA = {  # per request action (capture_start alone has the lease window)
    "capture_start": {"binding": _BINDING + ("lease_window",), **_POST_COMMON},
    "capture_status": {"binding": _BINDING, **_POST_COMMON},
    "capture_confirm": {"binding": _BINDING, **_POST_COMMON},
    "capture_cancel": {"binding": _BINDING, **_POST_COMMON},
}
POST_SCHEMA_EVENT = {"binding": _BINDING, **_POST_COMMON}  # lease_event: no lease window (that is capture_start's)

# ---- refused: the closed per-action code table
REFUSED = {
    "capture_start": ("capture_station_busy", "capture_limit", "revision_conflict", "lease_gone", "binding_denied", "capture_unsupported",
                      "capture_reader_invalid", "capture_failed"),
    "capture_status": ("capture_not_found", "lease_gone", "binding_denied", "capture_operation_busy"),
    "capture_confirm": ("capture_not_ready", "invalid_text", "capture_operation_busy", "capture_not_found", "lease_gone", "binding_denied",
                        "card_conflict", "revision_conflict"),
    "capture_cancel": ("capture_not_found", "lease_gone", "binding_denied", "capture_applying"),
}
# refused codes after which the host's session is UNCHANGED (Arx keeps its own session; the owner may act again)
SESSION_UNCHANGED = frozenset({"capture_applying", "capture_not_ready", "capture_operation_busy", "invalid_text"})

SESSION_STATES = ("preparing", "waiting")
STATUS_STATES = ("preparing", "waiting", "captured", "error")  # `applying` is never reported on the lease route
STATUS_ERRORS = ("capture_timeout", "capture_unsupported", "capture_reader_invalid", "capture_failed")
CARD_TECHNOLOGIES = ("TypeA_M1", "TypeA_CPU", "TypeB", "ID_125K", "FelicaCard", "DesfireCard")
PERSON_FORBIDDEN = ("pin", "card_no", "photo")

INVALID: tuple[str, dict[str, Any]] = ("invalid", {"code": "invalid_response"})


def _int(value: Any, low: int = 0) -> bool:
    return type(value) is int and value >= low


def _keys(r: dict[str, Any], required: tuple[str, ...], optional: tuple[str, ...] = ()) -> bool:
    keys = set(r)
    return set(required) <= keys <= set(required) | set(optional)


def rejected(r: dict[str, Any], request_id: str, post: dict[str, tuple[str, ...]]) -> tuple[str, str] | None:
    """(stage, code) of a closed `rejected` answer, else None. `post` is the binding..state table of the action."""
    stage, code = r.get("stage"), r.get("code")
    if not isinstance(stage, str) or not isinstance(code, str):
        return None
    if stage in PRE_SCHEMA:
        if code not in PRE_SCHEMA[stage] or not _keys(r, ("result", "stage", "code")):
            return None  # request_id is FORBIDDEN here (the schema stage did not pass)
        return stage, code
    if stage in post:
        if code not in post[stage] or not _keys(r, ("result", "stage", "code", "request_id")) or r.get("request_id") != request_id:
            return None  # request_id is REQUIRED here and must be the request's own
        return stage, code
    return None


# ---------------------------------------------------------------- lease_event

def classify_event(r: dict[str, Any], request_id: str, sequence: int | None = None, action: str | None = None) -> tuple[str, dict[str, Any]]:
    """(kind, data) for one `lease_event` answer. kind: acknowledged | duplicate | stale | gap | conflict | unknown_stream, `rejected`
    (data: code "<stage>/<code>") or `invalid` (not one of the closed shapes, or it names another request / sequence: NOT an
    acknowledgement). `live_leases` is a heartbeat answer's field only (when `action` is given)."""
    result = r.get("result")
    if result == "rejected":
        found = rejected(r, request_id, POST_SCHEMA_EVENT)
        return ("rejected", {"code": f"{found[0]}/{found[1]}"}) if found else INVALID
    if r.get("request_id") != request_id:
        return INVALID
    if result == "unknown_stream":
        return ("unknown_stream", {}) if _keys(r, ("result", "request_id")) else INVALID
    required, optional = {
        "acknowledged": (("result", "request_id", "sequence"), ("destroyed", "live_leases")),
        "duplicate": (("result", "request_id", "sequence"), ("destroyed", "live_leases")),
        "stale": (("result", "request_id", "sequence", "last_sequence"), ()),
        "gap": (("result", "request_id", "sequence", "last_sequence", "destroyed"), ()),
        "conflict": (("result", "request_id", "sequence", "destroyed"), ()),
    }.get(result, (None, ()))  # type: ignore[arg-type]
    if required is None or not _keys(r, required, optional):
        return INVALID
    seq = r.get("sequence")
    if not _int(seq, 1) or (sequence is not None and seq != sequence):
        return INVALID
    data: dict[str, Any] = {"sequence": seq}
    for key in ("destroyed", "last_sequence"):
        if key in r:
            if not _int(r[key]):
                return INVALID
            data[key] = r[key]
    if "live_leases" in r:
        live = r["live_leases"]
        if (action is not None and action != "lease_heartbeat") or not isinstance(live, list) or not all(isinstance(x, str) and UUID_RE.fullmatch(x) for x in live):
            return INVALID
        data["live_leases"] = live[:64]
    return result, data


# ---------------------------------------------------------------- lease_request

def _session_ok(s: Any) -> bool:
    return (isinstance(s, dict) and _keys(s, ("session_id", "state")) and isinstance(s["session_id"], str) and bool(SESSION_ID_RE.fullmatch(s["session_id"]))
            and s["state"] in SESSION_STATES)


def _card_ok(c: Any) -> bool:
    return (isinstance(c, dict) and _keys(c, ("masked_number", "technology", "reader_id")) and isinstance(c["masked_number"], str)
            and bool(MASKED_NUMBER_RE.fullmatch(c["masked_number"])) and (c["technology"] is None or c["technology"] in CARD_TECHNOLOGIES)
            and (c["reader_id"] is None or (_int(c["reader_id"], 1) and c["reader_id"] <= 8)))


def _capture_ok(c: Any) -> bool:
    if not (isinstance(c, dict) and _keys(c, ("state", "error", "card"))):
        return False
    state, error, card = c["state"], c["error"], c["card"]
    if state not in STATUS_STATES:  # not `applying`
        return False
    if (error in STATUS_ERRORS) != (state == "error") or (state != "error" and error is not None):
        return False
    return _card_ok(card) if state == "captured" else card is None


def _person_ok(p: Any) -> bool:
    # the exact ManagedUser.public() field list is WisKey's (checked by the schema test where jsonschema exists, projected by
    # iw.project_editor); here: an object that never carries a credential
    return isinstance(p, dict) and bool(p) and not any(k in p for k in PERSON_FORBIDDEN)


_ACK = {
    "capture_start": ("session", lambda r: _session_ok(r["session"])),
    "capture_status": ("capture", lambda r: _capture_ok(r["capture"])),
    "capture_confirm": ("person", lambda r: _person_ok(r["person"])),
    "capture_cancel": ("cancelled", lambda r: r["cancelled"] is True),
}


def classify_request(r: dict[str, Any], request_id: str, action: str) -> tuple[str, dict[str, Any]]:
    """(kind, data) for one lease request. kind: `ok` (data: the answer, shape-checked for `action`), `refused` (data: code),
    `rejected` (data: code "<stage>/<code>"), `sent_unknown` (capture_confirm only) or `unknown` (not a closed shape / another request)."""
    if action not in _ACK:
        return "unknown", INVALID[1]
    result = r.get("result")
    if result == "rejected":
        found = rejected(r, request_id, POST_SCHEMA[action])
        return ("rejected", {"code": f"{found[0]}/{found[1]}"}) if found else ("unknown", INVALID[1])
    if r.get("request_id") != request_id:
        return "unknown", INVALID[1]
    if result == "acknowledged":
        field, check = _ACK[action]
        if _keys(r, ("result", "request_id", field)) and check(r):
            return "ok", r
        return "unknown", INVALID[1]
    if result == "refused":
        if _keys(r, ("result", "request_id", "code")) and r["code"] in REFUSED[action]:
            return "refused", {"code": r["code"]}
        return "unknown", INVALID[1]
    if result == "sent_unknown" and action == "capture_confirm" and _keys(r, ("result", "request_id")):
        return "sent_unknown", {"code": "sent_unknown"}
    return "unknown", INVALID[1]
