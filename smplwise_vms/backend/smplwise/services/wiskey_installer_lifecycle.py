"""WISKEY-INSTALLER-NATIVE-2400 phase 3 (plan 2026-11-03 row 50, station lifecycle): add a station (the onboarding wizard), re-onboard
one (new address or credentials, same device), and remove or replace one - from Arx.

**Adding / re-onboarding** is NOT a WisKey WebSocket command: WisKey keeps station onboarding in its config-entry flow (rc.10
`__init__.py`: "Station onboarding remains the existing config-entry flow"; `config_flow.py`). Arx drives that flow through Home
Assistant's flow REST API with the add-on's own identity (the Supervisor proxy; an administrator), for the handler `hikvision_intercom`
ONLY, and only through a closed set of steps and keys (`STEP_KEYS`) - the browser never sends a raw flow input:

| step (rc.10)      | what it asks                                                         | Arx |
|-------------------|----------------------------------------------------------------------|-----|
| `user`            | name, host, username, password, scheme, port, verify_ssl, rtsp_port   | the credentials go to WisKey's flow ONLY: never stored, logged or audited in Arx |
| `reconfigure`     | the same; an empty password keeps the stored one                       | started for an existing entry (`entry_id`) |
| `confirm_device`  | nothing (shows model / firmware / serial)                              | confirmation |
| `locks`           | `mode` camera_only / map_active_relay / keep_confirmed_mapping, `lock_name` | confirmation |
| `mapping`         | `api_id`, `test_unlock: true` - **WisKey PULSES the door relay** to prove the mapping | typed phrase "פתיחת דלת לבדיקה" |
| `confirm_mapping` | `result` released_and_returned / choose_again / camera_only            | confirmation |

A flow Arx started is remembered in process memory (`FLOWS`: its owner, kind, the step it waits on, 15 minutes); another user, another
step or an unknown flow id is refused before anything is sent. At most two flows at once.

**Removing / replacing** is WisKey's reviewed station lifecycle (rc.10 `station_lifecycle_api.py`, `station_transactions_api.py`): a
read-only review (`platform/lifecycle_review`), a prepared job (`lifecycle_prepare`, refused while any blocker stands), its plan
(`lifecycle_plan`), the people move / removal (`lifecycle_apply`), the cleanup check (`lifecycle_verify`) and the removal of the
station's configuration (`lifecycle_remove`). A replacement names a target station (added first with the wizard); a retirement does
not. The people rows of WisKey's impact carry names: Arx keeps only the counts and the blocker codes. WisKey's dual approval
(`lifecycle_decide`) is NOT driven from Arx: Arx's single service identity cannot be a separate approver (WisKey refuses
`separate_approver_required`); with WisKey's dual approval on, apply / remove answer `approval_required` - a WisKey gap."""
from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Protocol

import httpx

from ..config import Settings
from ..errors import ApiError
from . import ha_client
from . import intercom_adapter as ad
from .wiskey_installer import WRITE_TIMEOUT_S, Op

HANDLER = "hikvision_intercom"
FLOW_TTL_S = 15 * 60.0
MAX_FLOWS = 2
FLOW_ID = re.compile(r"[A-Za-z0-9]{8,64}")
HOST = re.compile(r"[A-Za-z0-9.:\-\[\]]{1,255}")
LOCK_MODES = ("camera_only", "map_active_relay", "keep_confirmed_mapping")
MAPPING_RESULTS = ("released_and_returned", "choose_again", "camera_only")
PULSE_PHRASE = "פתיחת דלת לבדיקה"
FLOW_ERRORS = frozenset({"invalid_auth", "unsupported_device", "invalid_response", "cannot_connect", "access_removal_pending", "test_required", "invalid_mapping",
                         "unlock_failed", "confirmation_required", "base"})
ABORT_REASONS = frozenset({"already_configured", "unique_id_mismatch", "reconfigure_successful", "reauth_successful", "already_in_progress"})
STEPS = ("user", "reconfigure", "confirm_device", "locks", "mapping", "confirm_mapping")
PUBLIC_DEFAULTS = ("name", "host", "username", "scheme", "port", "verify_ssl", "rtsp_port", "lock_name")


# ---------------------------------------------------------------- the closed step inputs

def _text(v: Any, lo: int, hi: int) -> bool:
    return isinstance(v, str) and lo <= len(v) <= hi and not any(ord(c) < 32 for c in v)


def _port(v: Any) -> bool:
    return type(v) is int and 1 <= v <= 65535


def check_input(step: str, data: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """The step's input reduced to its allowed keys, and the keys that are wrong. Unknown keys are wrong (never forwarded)."""
    bad = sorted(k for k in data if k not in STEP_KEYS.get(step, ()))
    out: dict[str, Any] = {}
    if step in ("user", "reconfigure"):
        rules: dict[str, Callable[[Any], bool]] = {
            "name": lambda v: _text(v, 1, 64), "host": lambda v: isinstance(v, str) and bool(HOST.fullmatch(v)), "username": lambda v: _text(v, 1, 64),
            "password": lambda v: _text(v, 1, 128), "scheme": lambda v: v in ("http", "https"), "port": _port, "verify_ssl": lambda v: type(v) is bool,
            "rtsp_port": _port,
        }
        for key, rule in rules.items():
            if key == "password" and step == "reconfigure" and data.get(key) in (None, ""):
                continue  # WisKey keeps the stored password
            if key not in data:
                bad.append(key)
            elif not rule(data[key]):
                bad.append(key)
            else:
                out[key] = data[key]
    elif step == "locks":
        if data.get("mode") not in LOCK_MODES:
            bad.append("mode")
        else:
            out["mode"] = data["mode"]
        if "lock_name" in data:
            if _text(data["lock_name"], 0, 64):
                out["lock_name"] = data["lock_name"]
            else:
                bad.append("lock_name")
    elif step == "mapping":
        if type(data.get("api_id")) is not int or not 1 <= data["api_id"] <= 8:
            bad.append("api_id")
        else:
            out["api_id"] = data["api_id"]
        if data.get("test_unlock") is not True:
            bad.append("test_unlock")
        else:
            out["test_unlock"] = True
    elif step == "confirm_mapping":
        if data.get("result") not in MAPPING_RESULTS:
            bad.append("result")
        else:
            out["result"] = data["result"]
    elif step != "confirm_device":
        bad.append("step")
    return out, sorted(set(bad))


STEP_KEYS: dict[str, tuple[str, ...]] = {
    "user": ("name", "host", "username", "password", "scheme", "port", "verify_ssl", "rtsp_port"),
    "reconfigure": ("name", "host", "username", "password", "scheme", "port", "verify_ssl", "rtsp_port"),
    "confirm_device": (),
    "locks": ("mode", "lock_name"),
    "mapping": ("api_id", "test_unlock"),
    "confirm_mapping": ("result",),
}


# ---------------------------------------------------------------- the flow answer (Home Assistant's FlowResult JSON)

def _options(item: dict[str, Any]) -> list[Any]:
    raw = item.get("options")
    if raw is None and isinstance(item.get("selector"), dict):
        raw = (item["selector"].get("select") or {}).get("options")
    out = []
    for o in raw if isinstance(raw, list) else []:
        value = o[0] if isinstance(o, list) and o else o.get("value") if isinstance(o, dict) else o
        if isinstance(value, (str, int)) and not isinstance(value, bool):
            out.append(value)
    return out[:16]


def project_flow(raw: Any) -> dict[str, Any]:
    """A flow answer reduced to what the wizard draws: the step, its error codes, its choices, the public defaults (never a password),
    the device facts of `confirm_device`, or the created entry / the abort reason."""
    if not isinstance(raw, dict) or not isinstance(raw.get("flow_id"), str):
        raise ValueError("unexpected flow answer")
    kind = raw.get("type")
    out: dict[str, Any] = {"flow_id": raw["flow_id"], "type": kind if kind in ("form", "create_entry", "abort") else "other", "step_id": None, "errors": {},
                           "choices": {}, "defaults": {}, "device": None, "entry": None, "reason": None}
    if kind == "form":
        step = raw.get("step_id")
        out["step_id"] = step if step in STEPS else "other"
        errors = raw.get("errors") if isinstance(raw.get("errors"), dict) else {}
        out["errors"] = {k: (v if v in FLOW_ERRORS else "other") for k, v in list(errors.items())[:8] if isinstance(k, str) and ad.CODE.fullmatch(k)}
        for item in raw.get("data_schema") if isinstance(raw.get("data_schema"), list) else []:
            if not isinstance(item, dict) or not isinstance(item.get("name"), str):
                continue
            name = item["name"]
            opts = _options(item)
            if opts and name in ("mode", "api_id", "result", "scheme"):
                out["choices"][name] = opts
            default = item.get("default")
            if name in PUBLIC_DEFAULTS and isinstance(default, (str, int, bool)):
                out["defaults"][name] = default if not isinstance(default, str) else default[:255]
        placeholders = raw.get("description_placeholders") if isinstance(raw.get("description_placeholders"), dict) else {}
        if out["step_id"] == "confirm_device":
            out["device"] = {k: ad._text(placeholders.get(k), 96) for k in ("model", "firmware", "serial")}
    elif kind == "create_entry":
        result = raw.get("result") if isinstance(raw.get("result"), dict) else {}
        out["entry"] = {"entry_id": ad._id(result.get("entry_id")), "title": ad._text(raw.get("title") or result.get("title"), 64)}
    elif kind == "abort":
        reason = raw.get("reason")
        out["reason"] = reason if reason in ABORT_REASONS else ad._code(reason)
    return out


def flow_summary(p: dict[str, Any]) -> dict[str, Any]:
    """The audit row of a flow call: the step it reached, the error CODES, the created entry - never an input, a host or a serial."""
    return {"type": p.get("type"), "step_id": p.get("step_id"), "errors": sorted((p.get("errors") or {}).values()), "entry": p.get("entry"), "reason": p.get("reason")}


# ---------------------------------------------------------------- the flow transport (Home Assistant's REST flow API)

class FlowTransport(Protocol):
    def start(self, settings: Settings, entry_id: str | None) -> dict[str, Any]: ...

    def step(self, settings: Settings, flow_id: str, data: dict[str, Any]) -> dict[str, Any]: ...

    def abort(self, settings: Settings, flow_id: str) -> None: ...


class FlowError(Exception):
    """`outcome`: not_sent (the request did not reach Home Assistant) / refused (it answered with an error) / unknown (no answer)."""

    def __init__(self, outcome: str, code: str) -> None:
        super().__init__(f"{outcome}: {code}")
        self.outcome = outcome
        self.code = code


class HaFlowTransport:
    """POST /api/config/config_entries/flow (`handler` fixed; `entry_id` starts a reconfigure flow), POST .../flow/<id>, DELETE .../flow/<id>.
    Never logs a body or a URL."""

    def _call(self, settings: Settings, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        if not ha_client.configured(settings):
            raise FlowError("not_sent", "ha_not_configured")
        try:
            with httpx.Client(timeout=WRITE_TIMEOUT_S) as c:
                r = c.request(method, ha_client._rest_base(settings) + path, headers=ha_client._headers(settings), json=body)
        except httpx.TimeoutException:
            raise FlowError("unknown", "timeout") from None
        except httpx.HTTPError:
            raise FlowError("not_sent", "ha_unavailable") from None
        if r.status_code in (401, 403):
            raise FlowError("refused", "ha_forbidden")
        if r.status_code == 404:
            raise FlowError("refused", "flow_not_found")
        if r.status_code >= 400:
            raise FlowError("refused", "invalid_input" if r.status_code == 400 else f"http_{r.status_code}")
        try:
            return r.json() if r.content else None
        except ValueError:
            raise FlowError("unknown", "invalid_response") from None

    def start(self, settings: Settings, entry_id: str | None) -> dict[str, Any]:
        body: dict[str, Any] = {"handler": HANDLER, "show_advanced_options": False}
        if entry_id:
            body["entry_id"] = entry_id
        return self._call(settings, "POST", "/config/config_entries/flow", body)

    def step(self, settings: Settings, flow_id: str, data: dict[str, Any]) -> dict[str, Any]:
        return self._call(settings, "POST", f"/config/config_entries/flow/{flow_id}", data)

    def abort(self, settings: Settings, flow_id: str) -> None:
        self._call(settings, "DELETE", f"/config/config_entries/flow/{flow_id}")


_TRANSPORT: FlowTransport = HaFlowTransport()


def transport() -> FlowTransport:
    return _TRANSPORT


def set_transport(t: FlowTransport | None) -> None:
    """Tests: replace the transport (None restores the production one)."""
    global _TRANSPORT
    _TRANSPORT = t if t is not None else HaFlowTransport()


# ---------------------------------------------------------------- the flows Arx started

@dataclass
class Flow:
    flow_id: str
    owner: str
    kind: str  # "add" | "reconfigure"
    entry_id: str | None
    step_id: str | None
    started: float


class Flows:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, Flow] = {}

    def _expire(self) -> None:
        now = time.monotonic()
        for fid in [f for f, v in self._by.items() if now - v.started > FLOW_TTL_S]:
            self._by.pop(fid, None)

    def room(self) -> bool:
        with self._lock:
            self._expire()
            return len(self._by) < MAX_FLOWS

    def put(self, flow: Flow) -> None:
        with self._lock:
            self._by[flow.flow_id] = flow

    def get(self, flow_id: str) -> Flow | None:
        with self._lock:
            self._expire()
            return self._by.get(flow_id)

    def advance(self, flow_id: str, step_id: str | None) -> None:
        with self._lock:
            if flow_id in self._by:
                self._by[flow_id].step_id = step_id

    def drop(self, flow_id: str) -> None:
        with self._lock:
            self._by.pop(flow_id, None)

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


FLOWS = Flows()


def flow_error(what: str, exc: FlowError) -> ApiError:
    details = {"outcome": exc.outcome, "wiskey_code": exc.code}
    if exc.outcome == "not_sent":
        return ApiError(503, "installer_unavailable", f"{what}: הבקשה לא נשלחה ({exc.code}).", retryable=True, details=details)
    if exc.outcome == "refused":
        return ApiError(502, "installer_refused", f"{what} - נדחה ({exc.code}). לא בוצע שינוי.", details=details)
    return ApiError(504, "installer_outcome_unknown", f"{what} נשלח, אך לא התקבלה תשובה ברורה ({exc.code}). בדקו את רשימת העמדות לפני שמנסים שוב.", details=details)


# ---------------------------------------------------------------- removal / replacement (WisKey platform/lifecycle_*)

LIFECYCLE_STATES = frozenset({"prepared", "approved", "rejected", "applied", "verified", "removing", "removed", "expired", "failed"})
BLOCKERS = frozenset({"target_already_in_use", "target_ownership_unverified", "target_contains_accounts", "target_lock_mapping_incomplete",
                      "native_schedule_redeployment_required", "hold_programs_require_separate_review"})


def _impact(raw: Any) -> dict[str, Any]:
    r = raw if isinstance(raw, dict) else {}
    return {
        "mode": ad._enum(r.get("mode"), ("replacement", "retirement")),
        "source_id": ad._id(r.get("source_id")),
        "target_id": ad._id(r.get("target_id")),
        "affected_people": ad._int(r.get("affected_people")),
        "rows_complete": ad._bool(r.get("rows_complete")),
        "groups": len(r.get("groups")) if isinstance(r.get("groups"), list) else None,
        "known_bindings": ad._int(r.get("known_bindings")),
        "pending_cleanup": r.get("pending_cleanup") if isinstance(r.get("pending_cleanup"), (int, dict)) and not isinstance(r.get("pending_cleanup"), bool) else None,
        "unknown_owners": ad._int(r.get("unknown_owners")) if not isinstance(r.get("unknown_owners"), list) else len(r["unknown_owners"]),
        "hold_programs": ad._int(r.get("hold_programs")),
        "native_schedules": ad._int(r.get("native_schedules")) if not isinstance(r.get("native_schedules"), list) else len(r["native_schedules"]),
        "required_target_locks": [x for x in (r.get("required_target_locks") or [])[:8] if ad._int(x) is not None] if isinstance(r.get("required_target_locks"), list) else [],
        "blockers": [b if b in BLOCKERS else "other" for b in (r.get("blockers") or [])[:12] if isinstance(b, str)] if isinstance(r.get("blockers"), list) else [],
        "device_writes": ad._int(r.get("device_writes")),
    }


def _station_def(raw: Any) -> dict[str, Any]:
    d = raw if isinstance(raw, dict) else {}
    return {"id": ad._id(d.get("id")), "name": ad._text(d.get("name"), 64), "identity_verified": d.get("identity_verified") is True, "error": ad._code(d.get("error")),
            "mappings": [{"physical_index": ad._int(m.get("physical_index")), "api_id": ad._int(m.get("api_id")), "name": ad._text(m.get("name"), 64)}
                         for m in (d.get("mappings") if isinstance(d.get("mappings"), list) else [])[:8] if isinstance(m, dict)]}


def project_review(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("unexpected lifecycle review")
    return {**_impact(raw), "stations": [_station_def(s) for s in (raw.get("stations") if isinstance(raw.get("stations"), list) else [])[:2]]}


def project_job(raw: Any) -> dict[str, Any]:
    j = raw if isinstance(raw, dict) else {}
    return {
        "id": ad._id(j.get("id")) or (j.get("id") if isinstance(j.get("id"), str) and len(j["id"]) <= 128 else None),
        "fingerprint": j.get("fingerprint") if isinstance(j.get("fingerprint"), str) and len(j["fingerprint"]) <= 128 else None,
        "source_id": ad._id(j.get("source_id")), "target_id": ad._id(j.get("target_id")),
        "source_name": ad._text(j.get("source_name"), 64), "target_name": ad._text(j.get("target_name"), 64),
        "state": ad._enum(j.get("state"), LIFECYCLE_STATES),
        "created_at": ad._iso(j.get("created_at")), "expires_at": ad._iso(j.get("expires_at")), "applied_at": ad._iso(j.get("applied_at")),
        "verified_at": ad._iso(j.get("verified_at")), "removed_at": ad._iso(j.get("removed_at")),
        "metadata_applied": ad._bool(j.get("metadata_applied")), "own_request": ad._bool(j.get("own_request")),
        "require_approval": ad._bool(j.get("require_approval")), "approval_state": ad._enum(j.get("approval_state"), ("approved", "rejected", "pending")),
        "affected_people": ad._int(j.get("affected_people")),
    }


def project_job_reply(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("job"), dict):
        raise ValueError("unexpected lifecycle answer")
    out: dict[str, Any] = {"job": project_job(raw["job"])}
    if "impact" in raw:
        out["impact"] = project_review(raw["impact"])
    return out


def project_jobs(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("records"), list):
        raise ValueError("unexpected lifecycle jobs")
    return {"records": [project_job(r) for r in raw["records"][:50] if isinstance(r, dict)]}


def _sum_job(p: dict[str, Any]) -> dict[str, Any]:
    job = p.get("job") or {}
    return {"job_id": job.get("id"), "state": job.get("state"), "affected_people": job.get("affected_people"), "source_id": job.get("source_id"), "target_id": job.get("target_id")}


OPS: dict[str, Op] = {
    "review": Op("review", "platform/lifecycle_review", "read", "intercom.installer.lifecycle_read", ("source_id", "target_id"), read_command=True,
                 timeout_s=WRITE_TIMEOUT_S, project=project_review),
    "jobs": Op("jobs", "platform/lifecycle_jobs", "read", "intercom.installer.lifecycle_read", read_command=True, project=project_jobs),
    "plan": Op("plan", "platform/lifecycle_plan", "read", "intercom.installer.lifecycle_read", ("job_id", "fingerprint"), read_command=True,
               timeout_s=WRITE_TIMEOUT_S, project=project_job_reply),
    "prepare": Op("prepare", "platform/lifecycle_prepare", "write", "intercom.installer.lifecycle_prepare", ("source_id", "target_id"), danger="confirm",
                  scope="station", timeout_s=WRITE_TIMEOUT_S, cooldown_s=10.0, project=project_job_reply, summary=_sum_job),
    "apply": Op("apply", "platform/lifecycle_apply", "write", "intercom.installer.lifecycle_apply", ("job_id", "fingerprint", "confirmed"), danger="typed",
                scope="station", timeout_s=WRITE_TIMEOUT_S, cooldown_s=10.0, project=project_job_reply, summary=_sum_job),
    "verify": Op("verify", "platform/lifecycle_verify", "write", "intercom.installer.lifecycle_verify", ("job_id", "fingerprint", "confirmed"), danger="confirm",
                 scope="station", timeout_s=WRITE_TIMEOUT_S, cooldown_s=5.0, project=project_job_reply, summary=_sum_job),
    "remove": Op("remove", "platform/lifecycle_remove", "write", "intercom.installer.lifecycle_remove", ("job_id", "fingerprint", "confirmed"), danger="typed",
                 scope="station", timeout_s=WRITE_TIMEOUT_S, cooldown_s=10.0, project=project_job_reply, summary=_sum_job),
    # the onboarding flow (Home Assistant's REST flow API, not the WisKey channel): limits and audit only
    "onboarding_start": Op("onboarding_start", "config_entries/flow", "write", "intercom.installer.onboarding_start", danger="confirm", cooldown_s=3.0),
    "onboarding_step": Op("onboarding_step", "config_entries/flow", "write", "intercom.installer.onboarding_step", danger="confirm", timeout_s=WRITE_TIMEOUT_S),
    "onboarding_pulse": Op("onboarding_pulse", "config_entries/flow", "write", "intercom.installer.onboarding_step", danger="typed", timeout_s=WRITE_TIMEOUT_S,
                           cooldown_s=5.0, typed_word=PULSE_PHRASE),
    "onboarding_abort": Op("onboarding_abort", "config_entries/flow", "write", "intercom.installer.onboarding_abort", danger="confirm"),
}
WS_COMMANDS = frozenset(op.command for op in OPS.values() if op.command.startswith("platform/"))
