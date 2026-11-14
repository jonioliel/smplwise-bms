"""WISKEY-WA-QUEUE-2400 (T12 of private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md): messaging completion on the installed
WisKey client - template registry sync, the durable template queue (enqueue / job / cancel), the v3 outcome, and WisKey's versioned
paced free-text send. Docs: docs/changes/WISKEY-WA-QUEUE-2400.md.

What this module adds, and what it re-uses (nothing below re-implements a rule that already exists):

| Piece                         | WisKey command(s) (rc.10)                                    | Re-used Arx code                                              |
|-------------------------------|--------------------------------------------------------------|---------------------------------------------------------------|
| registry read + refresh       | `whatsapp/template_registry_v1`                              | `wiskey_auto_install.sync_native_templates` (the merge rules)  |
| durable queue                 | `whatsapp/template_enqueue_v1` / `_job_v1` / `_cancel_v1`    | `wiskey_installed_features.TemplateJobs` + `read_job`          |
| v3 outcome (send now)         | `whatsapp/template_send_v3`                                  | `wiskey_auto_install.read_template_outcome_v3`                 |
| paced free text (opt-in)      | `whatsapp/send_pacing_v1` (+ `whatsapp/pacing_status_v1`)    | `intercom_messaging_adapter` (classify, SendResult)            |

Every template hand-over goes through `wa_template_send.TemplateSender.send_v2` with an EXPLICIT transport from here, so the switch
(`messaging.template_send`), the code permit (`TEMPLATE_SEND_SUPPORTED`, False in this build), the registered reference + WisKey pair,
the wire bounds and the shared send budget (`wa_pacing`, which already folds in WisKey's `pacing_status_v1` envelope) decide exactly
as they do for v2. The route (routers/access_control_wa_queue.py) runs the people-message admission of the v2 route unchanged
(confirmation, messaging switch, send hours, opt-out, preview token, the attempt row BEFORE any hand-over).

Transport: WisKey's signed direct join (`wiskey_direct_join.JOIN`), and only while the join SELECTS the command on the current
connection (provider `auto`, a key that signs, a socket that authenticates, discovery listing the command). Otherwise nothing leaves.

Honest outcomes (never stronger than WisKey's words):
- `sent` = the provider ACCEPTED it (`provider_accepted: true`); delivery stays UNKNOWN - WisKey rc.10 has no delivery receipt;
- `refused` = WisKey answered with a closed refusal of THIS send (the reason is kept: e.g. `cancelled_before_dispatch`, `queue_expired`,
  `rate_limited` with WisKey's own `retry_after_s`, `installation_unavailable`);
- `not_sent` = it provably never left Arx; `unknown` = handed on and no usable answer - never retried, never relabelled.
A WisKey `rate_limited` (v3 `pacing_outcome`, or a job's) is fed into Arx's own budget as an account slowdown (`note_slowdown`), so
Arx's next send on that account waits for WisKey's ledger instead of probing it.

Message history stays OUT of Arx (plan row 75, "X"): `whatsapp/history`, `whatsapp/media`, `whatsapp/templates_get` /
`templates_update` are named in `EXCLUDED` and sent by nothing (tests/test_wiskey_wa_queue_2400.py checks every allow-list and
every module)."""
from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
from typing import Any, Mapping

from . import wa_template_send as wts

log = logging.getLogger("smplwise.wiskey.wa_queue")

REGISTRY_COMMAND = "whatsapp/template_registry_v1"
ENQUEUE_COMMAND = "whatsapp/template_enqueue_v1"
JOB_COMMAND = "whatsapp/template_job_v1"
CANCEL_COMMAND = "whatsapp/template_cancel_v1"
SEND_V3_COMMAND = "whatsapp/template_send_v3"
SEND_PACING_COMMAND = "whatsapp/send_pacing_v1"
DIRECT_COMMANDS = (REGISTRY_COMMAND, ENQUEUE_COMMAND, JOB_COMMAND, CANCEL_COMMAND, SEND_V3_COMMAND)
EXCLUDED = ("whatsapp/history", "whatsapp/media", "whatsapp/templates_get", "whatsapp/templates_update")  # plan row 75: X

QUEUE_TTL_S = 120  # WisKey allows 1..300; 120 = intercom_messaging.PENDING_STALE_S, so a queued record never outlives its "pending" display
CALL_TIMEOUT_S = 10.0
MODES = ("queue", "now")
OPERATION_PREFIX = {"queue": "tplq-", "now": "tplv3-"}

SETTINGS_KEY = "messaging.wa_installed"  # {"send_pacing_v1": bool}; default OFF (an owner step, like every messaging switch)
SYNC_KEY = "wiskey.installation.registry_sync"  # the last manual/hourly sync's outcome; `wiskey.installation.*` is never exported
AUDIT_SETTINGS = "intercom.messaging.installed_settings"
AUDIT_SYNC = "intercom.messaging.template_registry_sync"
AUDIT_JOB = "intercom.person.message.job"

# WisKey refusals of `template_enqueue_v1` that rc.10 raises BEFORE the job row is saved (native_installation_api.dispatch,
# native_template_jobs.enqueue): the job provably does not exist. Every other refusal may come after the save (`principal.check()`
# after `save`) and stays UNKNOWN.
PRE_EFFECT_ENQUEUE = frozenset({"installation_unavailable", "invalid_fields", "template_revision_conflict", "revision_conflict",
                                "template_capacity_or_request_conflict", "operation_conflict", "Unauthorized", "unknown_command"})
# `template_send_v3`: the authority / field checks run before `send_v2` (whatsapp_template_api_v2.send_v3).
PRE_EFFECT_V3 = frozenset({"installation_unavailable", "invalid_fields", "unknown_command"})


class QueueError(Exception):
    """`outcome`: not_sent (proven: nothing written, or a pre-effect refusal) | refused | unknown. `code` is WisKey's or the port's."""

    def __init__(self, code: str, outcome: str, *, answered: bool = False) -> None:
        super().__init__(code)
        self.code = str(code)[:64]
        self.outcome = outcome
        self.answered = answered  # WisKey answered with a verified refusal frame (vs nothing written / no answer)


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


# ---------------------------------------------------------------- the transport: the direct join, only while it selects the command

def port_for(command: str) -> Any:
    """The join's synchronous signed port while `command` is selected NOW, else None (nothing is sent). Tests replace this function."""
    from . import wiskey_direct_join

    join = wiskey_direct_join.JOIN
    if join is None:
        return None
    try:
        return join.capture_port if join.selected(command) else None
    except Exception:  # noqa: BLE001 - an unreadable selection is "not selected"
        return None


def availability() -> dict[str, bool]:
    return {c: port_for(c) is not None for c in DIRECT_COMMANDS}


class PortClient:
    """`TemplateJobs`' client (async `enqueue` / `call`) over the sync port; the port call runs in a worker thread. A PortError
    becomes a QueueError: `not_sent` when nothing was written or WisKey refused before the effect (`pre_effect`), else its own word."""

    def __init__(self, port: Any) -> None:
        self.port = port
        self.last_reply: Any = None
        self.last_error: QueueError | None = None

    async def _call(self, command: str, parameters: Mapping[str, Any], pre_effect: frozenset[str]) -> Any:
        from .wiskey_capture_port import PortError

        self.last_reply, self.last_error = None, None
        try:
            reply = await asyncio.to_thread(self.port.call, command, dict(parameters), timeout_s=CALL_TIMEOUT_S)
        except PortError as exc:
            outcome = "not_sent" if exc.outcome == "not_sent" or (exc.outcome == "refused" and exc.code in pre_effect) else exc.outcome
            self.last_error = QueueError(exc.code, outcome, answered=exc.outcome == "refused")
            raise self.last_error from None
        except Exception as exc:  # noqa: BLE001 - after the hand-over: unknown
            self.last_error = QueueError(type(exc).__name__, "unknown")
            raise self.last_error from None
        self.last_reply = reply
        return reply

    async def enqueue(self, template: dict[str, Any], ttl_s: int) -> Any:
        return await self._call(ENQUEUE_COMMAND, {"template": template, "ttl_s": ttl_s}, PRE_EFFECT_ENQUEUE)

    async def call(self, command: str, parameters: dict[str, Any]) -> Any:
        if command not in (JOB_COMMAND, CANCEL_COMMAND):
            raise QueueError("not_allowed", "not_sent")  # the client carries the queue's reads/cancel only
        return await self._call(command, parameters, frozenset())


# ---------------------------------------------------------------- settings (owner step: OFF by default)

def load_settings(conn: Any) -> dict[str, Any]:
    from ..db import get_setting

    try:
        doc = json.loads(get_setting(conn, SETTINGS_KEY) or "{}")
    except (TypeError, ValueError):
        doc = {}
    return {"send_pacing_v1": isinstance(doc, dict) and doc.get("send_pacing_v1") is True}


def store_settings(conn: Any, *, send_pacing_v1: bool) -> None:
    from ..db import set_setting

    set_setting(conn, SETTINGS_KEY, json.dumps({"send_pacing_v1": bool(send_pacing_v1)}, separators=(",", ":")))


def send_pacing_wanted(db_or_conn: Any) -> bool:
    """The administrator's opt-in for `whatsapp/send_pacing_v1` (False when unreadable). Accepts a connection or the Database."""
    try:
        if hasattr(db_or_conn, "write_aside"):
            with db_or_conn.connection(mode="read", label="wa installed settings") as conn:
                return load_settings(conn)["send_pacing_v1"]
        return load_settings(db_or_conn)["send_pacing_v1"]
    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------- the registry: read view + refresh

def last_sync(conn: Any) -> dict[str, Any] | None:
    from ..db import get_setting

    try:
        doc = json.loads(get_setting(conn, SYNC_KEY) or "null")
    except (TypeError, ValueError):
        return None
    return doc if isinstance(doc, dict) else None


def registry_view(conn: Any) -> dict[str, Any]:
    """Arx's template registry split by source: rows WisKey's signed registry owns (`wiskey`, account named) and the administrator's
    (`arx`). `native_sendable`: a WisKey-owned row can be SENT only while the automatic installation switch is on and its account is
    in the last signed sync (access_control_template_v2._context, unchanged here)."""
    from . import wiskey_auto_install as wai

    refs = wts.load_registry(conn)
    rows = [{"id": r.id, "name": r.name, "language": r.language, "purpose": r.purpose, "source": "wiskey" if wts.is_native(r) else "arx",
             "account": r.account, "template_revision": r.wiskey_revision, "bound": r.wiskey_ref is not None} for r in refs]
    return {"templates": rows, "wiskey_rows": sum(1 for r in rows if r["source"] == "wiskey"), "arx_rows": sum(1 for r in rows if r["source"] == "arx"),
            "native_accounts": len(wai.native_accounts(conn)), "native_sendable": wai.switch_on(conn), "last_sync": last_sync(conn)}


def sync_registry(db: Any) -> dict[str, Any]:
    """Refresh from WisKey's `whatsapp/template_registry_v1` now. Returns `{outcome, code, native}`: `synced` (merged; the stored
    registry is replaced only through `sync_native_templates`, which keeps every administrator row and refuses an empty or malformed
    reply), `not_sent` (the command is not selected: nothing was asked), `refused` (WisKey's closed refusal, e.g. policy B's
    `installation_unavailable`), `invalid` (a reply Arx cannot read - the stored registry stays) or `unknown`. The outcome is stored."""
    from . import wiskey_auto_install as wai
    from .wiskey_capture_port import PortError

    port = port_for(REGISTRY_COMMAND)
    out: dict[str, Any]
    if port is None:
        out = {"outcome": "not_sent", "code": "registry_not_selected", "native": None}
    else:
        try:
            reply = port.call(REGISTRY_COMMAND, {}, timeout_s=CALL_TIMEOUT_S)
        except PortError as exc:
            out = {"outcome": exc.outcome if exc.outcome in ("not_sent", "refused") else "unknown", "code": exc.code, "native": None}
        except Exception as exc:  # noqa: BLE001
            out = {"outcome": "unknown", "code": type(exc).__name__[:64], "native": None}
        else:
            try:
                native = wai.sync_native_templates(db, dict(reply) if isinstance(reply, Mapping) else reply)
                out = {"outcome": "synced", "code": None, "native": native}
            except wai.InstallationError as exc:
                out = {"outcome": "invalid", "code": exc.code, "native": None}
    from ..db import set_setting

    with db.write_aside(label="wa registry sync record") as w:
        set_setting(w, SYNC_KEY, json.dumps({**out, "at": _now()}, separators=(",", ":")))
    return out


# ---------------------------------------------------------------- the two explicit sender transports

class QueueTransport:
    """`send_v2(wire)` enqueues the closed v2 descriptor ONCE (TemplateJobs: Arx's row first, never twice). It returns no closed
    result (the job decides later), so the sender reads `unknown`; the route reads `view` instead."""

    def __init__(self, db: Any, port: Any, *, template_id: str, person_id: str) -> None:
        from .wiskey_installed_features import TemplateJobs

        self.jobs = TemplateJobs(db)
        self.client = PortClient(port)
        self.template_id, self.person_id = template_id, person_id
        self.view: Any = None

    def send_v2(self, wire: Mapping[str, Any]) -> Any:
        self.view = asyncio.run(self.jobs.enqueue(self.client, dict(wire), ttl_s=QUEUE_TTL_S, template_id=self.template_id,
                                                  person_id=self.person_id))
        return {"state": "unknown", "code": "queued"}


class V3Transport:
    """`send_v2(wire)` sends `whatsapp/template_send_v3` {schema_version 3, template: wire} and hands the ORIGINAL v2 result to the
    sender; the closed pacing companion is kept in `pacing`. `handover`: None (a result was read) | not_sent (nothing written) | refused
    (a verified refusal frame; pre-effect when `code` is in PRE_EFFECT_V3) | unknown."""

    def __init__(self, port: Any) -> None:
        self.port = port
        self.pacing: dict[str, Any] | None = None
        self.handover: str | None = None
        self.code: str | None = None

    def send_v2(self, wire: Mapping[str, Any]) -> Any:
        from . import wiskey_auto_install as wai
        from .wiskey_capture_port import PortError
        from .wiskey_template_direct import TIMEOUT_S

        try:
            reply = self.port.call(SEND_V3_COMMAND, {"schema_version": 3, "template": dict(wire)}, timeout_s=TIMEOUT_S)
        except PortError as exc:
            self.handover, self.code = exc.outcome, exc.code
            raise
        try:
            out = wai.read_template_outcome_v3(reply)
        except wai.InstallationError:
            self.code = "invalid_response"
            return {"state": "unknown", "code": "invalid_response"}
        self.pacing = out["pacing_outcome"]
        return reply["template_result"]


# ---------------------------------------------------------------- outcomes

def message_outcome_of_job(view: Any) -> tuple[str | None, str | None]:
    """A job's state -> the message record's (outcome, reason). None while it is still pending (queued / dispatching)."""
    if view.outcome == "pending":
        return None, None
    if view.outcome == "accepted":
        return "sent", None
    if view.outcome == "not_sent":
        return "refused", view.code or "not_sent"  # WisKey held it and says it never reached the provider: the record stays "not sent"
    return "unknown", view.code or "unknown"


def pacing_of_job(raw: Any) -> dict[str, Any] | None:
    """The closed `pacing_outcome` a completed job may carry (rate_limited, WisKey's ledger delay), else None."""
    result = raw.get("result") if isinstance(raw, Mapping) else None
    p = result.get("pacing_outcome") if isinstance(result, Mapping) else None
    if (isinstance(p, Mapping) and p.get("state") == "not_sent" and p.get("code") == "rate_limited"
            and (p.get("retry_after_s") is None or (type(p.get("retry_after_s")) is int and 0 <= p["retry_after_s"] <= 86_400))):
        return {"code": "rate_limited", "retry_after_s": p.get("retry_after_s")}
    return None


def note_wiskey_slowdown(db: Any, *, account: str | None, retry_after_s: int | None) -> None:
    """WisKey's own ledger said `rate_limited`: Arx's budget slows the account down (its own ladder, WisKey's delay when given), so
    Arx's next send waits instead of probing WisKey's ledger. Best effort: a failure here never changes the message's outcome."""
    if not account:
        return
    try:
        from . import messaging_runtime as mr

        with db.write_aside(label="wa wiskey slowdown") as w:
            mr.pacer_on(w).note_slowdown(account_key=f"wiskey:{account}", klass=wts.KLASS, scope="account", retry_after_s=retry_after_s,
                                         now=dt.datetime.now(dt.timezone.utc))
    except Exception:  # noqa: BLE001
        log.warning("wa queue: WisKey's slowdown could not be recorded in the shared budget")


def operation_of(mode: str, client_request_id: str) -> str:
    return OPERATION_PREFIX[mode] + client_request_id


def jobs_view(conn: Any, *, person_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """Arx's queue journal (ids, states and codes only - no number, no value, no body), newest first."""
    sql = "SELECT operation_id, template_id, person_id, state, outcome, code, created_at, updated_at FROM wiskey_template_jobs"
    args: tuple[Any, ...] = ()
    if person_id is not None:
        sql += " WHERE person_id = ?"
        args = (person_id,)
    rows = conn.execute(sql + " ORDER BY created_at DESC, rowid DESC LIMIT ?", (*args, max(1, min(limit, 200)))).fetchall()
    keys = ("operation_id", "template_id", "person_id", "state", "outcome", "code", "created_at", "updated_at")
    return [dict(zip(keys, r)) for r in rows]


def job_row(conn: Any, operation_id: str) -> dict[str, Any] | None:
    r = conn.execute("SELECT operation_id, request_id, template_id, person_id, state, outcome, code FROM wiskey_template_jobs WHERE operation_id = ?",
                     (operation_id,)).fetchone()
    return None if r is None else dict(zip(("operation_id", "request_id", "template_id", "person_id", "state", "outcome", "code"), r))
