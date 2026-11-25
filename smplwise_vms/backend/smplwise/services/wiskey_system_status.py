"""WISKEY-RESYNC-2520 slice 1 (plan docs/changes/WISKEY-RESYNC-2520.md, master ids D1-D5, B3, B7): Arx's reader of WisKey's two numbered
status READs, for the Settings status page that waited for "part D" of the 13.11 request.

| read   | WisKey command      | contract (WisKey PRODUCT 3e7bfc58, 2.0.1-rc.19, docs/contracts/...) | WisKey permission                     |
|--------|---------------------|-----------------------------------------------------------------------|---------------------------------------|
| system | `system/status_v1`  | system-status-v1, format `wiskey-system-status.v1`                     | READ, `management: view` unrestricted |
| jobs   | `jobs/status_v1`    | checkpoint-jobs-status-v1, contract `wiskey-checkpoint-jobs-status.v1`  | READ, WisKey's original owner check   |

Both are READ commands in WisKey's api_contract (`READ_COMMANDS`), so the frame carries no `api_contract`; they read cached software
state only (`observation_scope: cached_software_only_no_device_reads`) - no device, no job start, no write. They leave Arx on the closed
`system_status` channel (services/wiskey_channels.py), once, never queued, never retried, and only when WisKey lists the command for the
add-on's identity in `overview.api.commands` (capability discovery: an unlisted or unknown command list sends NOTHING; there is no
fallback to an older command after a refusal - `jobs/list` answers a different question, the actor's own jobs).

What the projection keeps (closed construction - known keys only; everything else is dropped):
- UNKNOWN stays unknown: a value outside WisKey's enumeration becomes `unknown`, a missing / malformed number or instant becomes null.
  Nothing is turned into a zero, a `false` or a success. A job family WisKey did not report is listed in `families_absent` (its owner
  is not loaded) - never a family with zero jobs. No global job sum is computed (the families overlap by design).
- The guarantees WisKey's schema pins as constants are CHECKED, not copied: `writes.writes_enabled` must be null (per-command admission,
  never one global "writes open"), the legacy schedule writer must be off, `effect_proven` of a sync result must be false,
  `history_complete` must be false, `physical_result` / `physical_acceptance` must be `not_measured`. A document that claims anything
  else is refused as a whole (`contract_mismatch`): Arx never shows writes, schedules or a sync effect as proven on a label.
- A sync `request_id` is WisKey's in-memory id of the current attached runtime only (`scope: current_attached_runtime_only`); it is not a
  durable log, not a proof of effect, and `last_intent` (a person / station intent id) is kept apart from it.

The caller's permission is Arx's (routers/access_control_system_status.py: `access.admin.read` unrestricted at the installation - WisKey
answers installation-wide, so a station-scoped administrator gets an audited 403 before anything is sent). WisKey's own refusal of the
add-on identity (`unauthorized`, e.g. `jobs/status_v1` when the add-on user is not WisKey's owner) is reported as `forbidden`, never
retried with another command. Tests: tests/test_wiskey_system_status_2520.py (fake SYNC and contract fixtures only)."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Iterable

from ..config import Settings
from . import intercom_client, intercom_sync
from .intercom_client import IntercomError

CHANNEL = "system_status"  # services/wiskey_channels.py SYSTEM_STATUS
READ_TIMEOUT_S = 25.0  # both reads answer from memory (no device read); the feed's ordinary read limit
UNKNOWN = "unknown"

SYSTEM_FORMAT = "wiskey-system-status.v1"
OBSERVATION_SCOPE = "cached_software_only_no_device_reads"
JOBS_CONTRACT = "wiskey-checkpoint-jobs-status.v1"
JOBS_SCOPE = "all_retained_checkpoint_jobs"
JOBS_NOTIFICATION = "original_data_free_refresh_requires_authorized_read"
NOT_MEASURED = "not_measured"

PROFILES = ("manual-existing", "managed", "unknown")
CONNECTIONS = ("connected", "connecting", "auth_failed", "offline")
FAILURE_CHANNELS = ("request", "events")
SUB_STATUSES = ("unauthorized", "nopermission", "accountlocked", "userlocked", "userislocked", "lockout", "locked")
FAILURE_REASONS = ("authentication_failed", "authorization_denied", "account_locked", "timeout", "connection_failed", "device_rejected",
                   "source_changed")
SYNC_STATES = ("synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending", "unavailable")
RESULT_STATES = ("synced", "pending", "syncing", "offline", "conflict", "error", "delete_pending", "cancelled", "interrupted",
                 "cancelled_before_run")
INTENT_STATES = ("pending", "failed", "verified", "settled")
FAMILIES = ("checkpoint", "schedules", "maintenance", "templates")
JOB_KINDS = ("csv", "bulk")
JOB_STATES = ("paused", "running", "completed", "completed_with_errors", "cancelled")
APPROVAL_STATES = ("pending", "approved", "rejected")
APPROVAL_ACTIONS = ("resume", "retry_failed")

MAX_STATIONS = 500
MAX_JOB_RECORDS = 100  # WisKey's own retention bound of checkpoint jobs (contract: no paging)
MAX_JOB_ERRORS = 200

CODE = re.compile(r"[a-z][a-z0-9_]{0,79}")  # WisKey's stable reason / state codes (templates.installation_state pattern)
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}")
JOB_ID = re.compile(r"[0-9a-f]{32}")


class ContractMismatch(ValueError):
    """The document breaks a guarantee its contract pins (a constant, the format): refused as a whole, never shown in part."""


# ---------------------------------------------------------------- small closed readers

def _dict(v: Any) -> dict[str, Any]:
    if not isinstance(v, dict):
        raise ContractMismatch("not an object")
    return v


def _int(v: Any, lo: int = 0, hi: int = 10**9) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi else None


def _enum(v: Any, allowed: Iterable[str]) -> str:
    return v if isinstance(v, str) and v in allowed else UNKNOWN


def _opt_enum(v: Any, allowed: Iterable[str]) -> str | None:
    """A nullable enumeration: null stays null (no value), a value outside the list is `unknown`."""
    return None if v is None else _enum(v, allowed)


def _id(v: Any) -> str | None:
    return v if isinstance(v, str) and ID.fullmatch(v) else None


def _code(v: Any) -> str | None:
    return v if isinstance(v, str) and CODE.fullmatch(v) else None


def _text(v: Any, n: int) -> str | None:
    """A display text: NFC, control and format characters removed, whitespace collapsed, at most `n` characters."""
    if not isinstance(v, str):
        return None
    cleaned = "".join(ch for ch in unicodedata.normalize("NFC", v) if unicodedata.category(ch)[0] != "C")
    cleaned = " ".join(cleaned.split())
    return cleaned[:n] or None


def _iso(v: Any) -> str | None:
    """An aware ISO instant (WisKey: RFC 3339, at most 64 characters), normalised to UTC `...Z`; None when it is not one."""
    if not isinstance(v, str) or len(v) > 64:
        return None
    try:
        parsed = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _list(v: Any) -> list[Any]:
    return v if isinstance(v, list) else []


def _required_list(v: Any, what: str) -> list[Any]:
    """A list the contract requires: absent or not a list is a broken document, never an empty list (no row is not "no data")."""
    if not isinstance(v, list):
        raise ContractMismatch(what)
    return v


def _expect(value: Any, wanted: Any, what: str) -> None:
    """A contract constant: the exact JSON value (type included - `0` is not `false`, `1.0` is not `1`)."""
    if type(value) is not type(wanted) or value != wanted:
        raise ContractMismatch(what)


def _codes(v: Any, allowed: tuple[tuple[str, ...], ...], what: str) -> list[str]:
    """A reason-code list the contract fixes to one of a few exact lists."""
    if not isinstance(v, list) or tuple(v) not in allowed:
        raise ContractMismatch(what)
    return list(v)


# ---------------------------------------------------------------- system/status_v1

def _failure(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    return {
        "at": _iso(v.get("at")),
        "channel": _enum(v.get("channel"), FAILURE_CHANNELS),
        "http_status_code": _int(v.get("http_status_code"), 100, 599),
        "isapi_status_code": _int(v.get("isapi_status_code"), 0, 9),
        "sub_status": _opt_enum(v.get("sub_status"), SUB_STATUSES),
        "reason": _enum(v.get("reason"), FAILURE_REASONS),
    }


def _last_result(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    _expect(v.get("effect_proven"), False, "sync.request.last_result.effect_proven")
    return {
        "request_id": _text(v.get("request_id"), 128),
        "state": _enum(v.get("state"), RESULT_STATES),
        "observed_at": _iso(v.get("observed_at")),
        "code": _text(v.get("code"), 128),
        "effect_proven": False,
    }


def _request(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    _expect(v.get("scope"), "current_attached_runtime_only", "sync.request.scope")
    return {
        "scope": "current_attached_runtime_only",
        "pending_request_id": _text(v.get("pending_request_id"), 128),
        "active_request_id": _text(v.get("active_request_id"), 128),
        "last_result": _last_result(v.get("last_result")),
    }


def _intent(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    return {
        "operation_id": _text(v.get("operation_id"), 128),
        "state": _enum(v.get("state"), INTENT_STATES),
        "updated_at": _iso(v.get("updated_at")),
        "verified_at": _iso(v.get("verified_at")),
    }


def _station(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict) or not (sid := _id(v.get("station_id"))):
        return None
    sync = v.get("sync") if isinstance(v.get("sync"), dict) else {}
    loaded = v.get("loaded")
    return {
        "station_id": sid,
        "loaded": loaded if isinstance(loaded, bool) else None,
        "connection": _enum(v.get("connection"), CONNECTIONS),
        "last_authenticated_at": _iso(v.get("last_authenticated_at")),
        "last_failure": _failure(v.get("last_failure")),
        "firmware": _text(v.get("firmware"), 256),
        "sync": {
            "state": _enum(sync.get("state"), SYNC_STATES),
            "last_reconciled_at": _iso(sync.get("last_reconciled_at")),
            "request": _request(sync.get("request")),
            "last_intent": _intent(sync.get("last_intent")),
        },
    }


def _family(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict) or v.get("family") not in FAMILIES:
        return None
    return {
        "family": v["family"],
        "waiting": _int(v.get("waiting")),  # null = not a valid count (never a zero)
        "running": _int(v.get("running")),  # retained state / writing intent, not process liveness (running_scope)
        "failed_last_24h": _int(v.get("failed_last_24h")),  # null = WisKey has no transition time (not zero failures)
    }


def project_system(raw: Any) -> dict[str, Any]:
    """`system/status_v1` -> the closed status document (see the module note)."""
    raw = _dict(raw)
    _expect(raw.get("format"), SYSTEM_FORMAT, "format")
    _expect(raw.get("schema_version"), 1, "schema_version")
    _expect(raw.get("observation_scope"), OBSERVATION_SCOPE, "observation_scope")
    _expect(raw.get("physical_result"), NOT_MEASURED, "physical_result")

    integration = _dict(raw.get("integration"))
    writes = _dict(raw.get("writes"))
    _expect(writes.get("writes_enabled"), None, "writes.writes_enabled")
    _expect(writes.get("legacy_schedule_writes_enabled"), False, "writes.legacy_schedule_writes_enabled")
    jobs = _dict(raw.get("jobs"))
    _expect(jobs.get("history_complete"), False, "jobs.history_complete")
    templates = _dict(raw.get("templates"))
    schedules = _dict(raw.get("schedules"))
    _expect(schedules.get("legacy_writes_enabled"), False, "schedules.legacy_writes_enabled")
    _expect(schedules.get("physical_acceptance"), NOT_MEASURED, "schedules.physical_acceptance")

    stations: dict[str, dict[str, Any]] = {}
    for item in _required_list(raw.get("stations"), "stations")[:MAX_STATIONS]:
        st = _station(item)
        if st is not None and st["station_id"] not in stations:  # a repeated id keeps its first row (never merged)
            stations[st["station_id"]] = st
    families: dict[str, dict[str, Any]] = {}
    for item in _required_list(jobs.get("families"), "jobs.families"):
        fam = _family(item)
        if fam is not None and fam["family"] not in families:
            families[fam["family"]] = fam
    api_contract = _int(integration.get("api_contract"), 0, 10**6)
    return {
        "generated_at": _iso(raw.get("generated_at")),
        "observation_scope": OBSERVATION_SCOPE,
        "integration": {
            "version": _text(integration.get("version"), 128),
            "api_contract": api_contract,
            "profile": _enum(integration.get("profile"), PROFILES),
        },
        "stations": sorted(stations.values(), key=lambda s: s["station_id"]),
        "writes": {
            "writes_enabled": None,
            "reason_codes": _codes(writes.get("reason_codes"), (("per_command_authorization_and_business_admission",),), "writes.reason_codes"),
            "legacy_schedule_writes_enabled": False,
            "legacy_schedule_reason": _code(writes.get("legacy_schedule_reason")),
            "reviewed_schedule_contract": _text(writes.get("reviewed_schedule_contract"), 64),
            "reviewed_schedule_reason": _code(writes.get("reviewed_schedule_reason")),
        },
        "jobs": {
            "families": [families[f] for f in FAMILIES if f in families],
            "families_absent": [f for f in FAMILIES if f not in families],  # the family's owner is not loaded: unknown, not zero
            "scope": _code(jobs.get("scope")),
            "running_scope": _code(jobs.get("running_scope")),
            "failed_window": _code(jobs.get("failed_window")),
            "history_complete": False,
            "reason_codes": [c for c in (_code(x) for x in _list(jobs.get("reason_codes"))[:8]) if c],
        },
        "templates": {
            "installation_state": _code(templates.get("installation_state")) or UNKNOWN,
            "configured_accounts": _int(templates.get("configured_accounts")),
            "configured_templates": _int(templates.get("configured_templates")),
            "reason_codes": _codes(templates.get("reason_codes"), ((), ("template_installation_unavailable",)), "templates.reason_codes"),
            "send_admission": _code(templates.get("send_admission")),
        },
        "schedules": {
            "legacy_writes_enabled": False,
            "reviewed_execution_contract": _text(schedules.get("reviewed_execution_contract"), 64),
            "physical_acceptance": NOT_MEASURED,
        },
        "physical_result": NOT_MEASURED,
    }


# ---------------------------------------------------------------- jobs/status_v1

def _approval(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict):
        return None
    return {"state": _enum(v.get("state"), APPROVAL_STATES), "action": _enum(v.get("action"), APPROVAL_ACTIONS), "expires_at": _iso(v.get("expires_at"))}


def _job(v: Any) -> dict[str, Any] | None:
    if not isinstance(v, dict) or not (isinstance(v.get("id"), str) and JOB_ID.fullmatch(v["id"])):
        return None
    errors = []
    for e in _list(v.get("errors"))[:MAX_JOB_ERRORS]:
        if isinstance(e, dict) and (row := _int(e.get("row"), 1)) is not None:
            errors.append({"row": row, "code": _text(e.get("code"), 128)})
    return {
        "id": v["id"],
        "kind": _enum(v.get("kind"), JOB_KINDS),
        "state": _enum(v.get("state"), JOB_STATES),
        "revision": _int(v.get("revision"), 1),
        "created_at": _iso(v.get("created_at")),
        "updated_at": _iso(v.get("updated_at")),
        "approval": _approval(v.get("approval")),
        "total": _int(v.get("total")),
        "saved": _int(v.get("saved")),
        "failed": _int(v.get("failed")),
        "pending": _int(v.get("pending")),
        "errors": errors,
        "errors_truncated": len(_list(v.get("errors"))) > MAX_JOB_ERRORS,
    }


def project_jobs(raw: Any) -> dict[str, Any]:
    """`jobs/status_v1` -> every retained checkpoint job WisKey reported (no person, no payload, no actor)."""
    raw = _dict(raw)
    _expect(raw.get("contract"), JOBS_CONTRACT, "contract")
    _expect(raw.get("scope"), JOBS_SCOPE, "scope")
    _expect(raw.get("history_complete"), False, "history_complete")
    _expect(raw.get("notification"), JOBS_NOTIFICATION, "notification")
    records: dict[str, dict[str, Any]] = {}
    for item in _required_list(raw.get("records"), "records")[:MAX_JOB_RECORDS]:
        job = _job(item)
        if job is not None and job["id"] not in records:
            records[job["id"]] = job
    return {
        "records": sorted(records.values(), key=lambda r: (r["created_at"] or "", r["id"])),
        "scope": JOBS_SCOPE,
        "history_complete": False,
        "notification": JOBS_NOTIFICATION,
    }


# ---------------------------------------------------------------- the reads

@dataclass(frozen=True)
class Op:
    name: str
    command: str
    project: Callable[[Any], Any] = field(default=lambda raw: raw)


OPS: dict[str, Op] = {o.name: o for o in (
    Op("system", "system/status_v1", project_system),
    Op("jobs", "jobs/status_v1", project_jobs),
)}


async def send(call: intercom_client.Call, op: Op) -> Any:
    """ONE frame: `{id, type}` only (both are READ commands: no `api_contract`, no other key)."""
    frame = await call(intercom_client.command_type(op.command))
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = error.get("code")
        raise IntercomError(code if isinstance(code, str) and re.fullmatch(r"[a-z0-9][a-z0-9_.:/-]{0,95}", code) else "other", op.command)
    raise IntercomError("invalid_response", op.command)


def availability(settings: Settings, name: str) -> tuple[bool, str | None]:
    """(listed, reason) from the served copy's `api` facts. Fail closed: no served copy, an unknown command list or a WisKey that needs
    a newer client means nothing is sent."""
    facts = intercom_sync.SYNC.api_facts(settings)
    if facts is None:
        return False, "no_copy"
    min_client = facts.get("min_client")
    if isinstance(min_client, int) and not isinstance(min_client, bool) and min_client > intercom_client.API_CONTRACT:
        return False, "api_incompatible"
    names = facts.get("commands")
    if not isinstance(names, (list, set, frozenset, tuple)):
        return False, "commands_unknown"
    return (True, None) if OPS[name].command in names else (False, "not_listed")


NOT_READY = frozenset({"ha_not_configured", "connecting", "ha_unavailable", "not_installed", "idle"})


def read(settings: Settings, name: str, who: str) -> dict[str, Any]:
    """One status read: `{state, reason, wiskey_code, fetched_at, data}`. `state` is `ready` (with `data`), `unsupported` (this WisKey
    does not list the command: nothing sent), `forbidden` (WisKey refused the add-on identity), `unavailable` (no live session),
    `busy` (Arx's or WisKey's rate limit / slots) or `error` (`contract_mismatch` / another WisKey code). `data` is null unless ready."""
    op = OPS[name]
    listed, reason = availability(settings, name)
    if not listed:
        return {"state": "unsupported", "reason": reason, "wiskey_code": None, "fetched_at": None, "data": None}
    mismatch: list[str] = []

    def project(raw: Any) -> Any:
        try:
            return op.project(raw)
        except ContractMismatch:
            mismatch.append("contract_mismatch")
            raise

    reply = intercom_sync.SYNC.command(settings, name, lambda call: send(call, op), project, who=who, timeout=READ_TIMEOUT_S, channel=CHANNEL)
    data = reply.get(name)
    state, code = str(reply.get("state") or "error"), reply.get("last_error")
    code = code if isinstance(code, str) and code else None
    if state == "ready" and data is not None:
        return {"state": "ready", "reason": None, "wiskey_code": None, "fetched_at": reply.get("fetched_at"), "data": data}
    if mismatch:
        return {"state": "error", "reason": "contract_mismatch", "wiskey_code": None, "fetched_at": None, "data": None}
    if state == "forbidden" or code == "unauthorized":
        return {"state": "forbidden", "reason": "wiskey_refused", "wiskey_code": code, "fetched_at": None, "data": None}
    if state == "unsupported" or code in ("unknown_command", "not_listed"):
        return {"state": "unsupported", "reason": "wiskey_unknown_command", "wiskey_code": code, "fetched_at": None, "data": None}
    if state == "rate_limited" or code in ("rate_limited", "busy"):
        return {"state": "busy", "reason": code or state, "wiskey_code": code, "fetched_at": None, "data": None}
    if state in NOT_READY:
        return {"state": "unavailable", "reason": state, "wiskey_code": code, "fetched_at": None, "data": None}
    return {"state": "error", "reason": code or state, "wiskey_code": code, "fetched_at": None, "data": None}
