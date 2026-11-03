"""WISKEY-INSTALLER-NATIVE-2400: what every installer endpoint shares (services/wiskey_installer.py is the WisKey side).

The rule of every endpoint under `/access-control/installer/`:

- permission: system.configure at the installation (the installer / system administrator), checked BEFORE a body is read; a refusal is
  the audited 403 of rbac.require. The browser never names a WisKey command: each endpoint maps to one fixed operation.
- a READ needs nothing else and sends one WisKey read (no confirmation, no audit row of its own beyond the gate's).
- a WRITE carries the command envelope of the physical actions (`client_request_id`, `expires_at` at most 60 s ahead - an old or replayed
  request is refused), `confirmed: true` (sent only by the confirmation step) and, for a dangerous one, `typed_confirmation` equal to
  the phrase the read named. Everything refused before sending is audited `not_sent`; then the attempt row is committed, the command
  sent ONCE, and the outcome row written: `ok`, `refused` (WisKey's code), `unknown` (sent, no clear answer) - never retried.
- Arx's own limits (services/wiskey_installer.Limits): 429 `installer_cooldown` / `installer_rate_limited` / `installer_busy` with
  `retry_after_s`, before anything is sent.

The audit rows name the real Arx actor, the operation, the target (`intercom_station` <id> or `intercom_installation` *), WisKey's code
and a summary without secrets: a password, a webhook key, a host address or a person is never written to an audit row or a log."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Callable

from fastapi import Depends, Request
from pydantic import ConfigDict, Field

from ..auth import current_principal_ro, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import wiskey_installer as wi
from .access_control import CommandEnvelope, _Action, _envelope, _parse

PERMISSION = "system.configure"
INSTALLATION_TARGET = "*"
INSTALLATION_TYPE = "intercom_installation"
STATION_TYPE = "intercom_station"


def _check(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, PERMISSION, INSTALLATION)


installer_gate = read_gate(_check)  # writes: the permission before the raw body is read


def installer_reader(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Principal:
    _check(conn, principal)
    return principal


class WriteBody(CommandEnvelope):
    """The envelope of every installer write; each endpoint extends it with its own fields (extra keys are refused)."""

    model_config = ConfigDict(extra="forbid")
    confirmed: Any = None  # only `true` confirms
    typed_confirmation: str | None = Field(default=None, max_length=200)


def error_for(op: wi.Op, what: str, exc: ApiError) -> ApiError:
    """The feed's / WisKey's error in this screen's words; `details` (`outcome`, `wiskey_code`, `state`) kept."""
    details = dict(exc.details or {})
    outcome = str(details.get("outcome") or "unknown")
    code = str(details.get("wiskey_code") or exc.code)
    details["operation"] = op.name
    if outcome == "not_sent":
        return ApiError(exc.status, exc.code, f"{what}: {exc.user_message}", retryable=exc.retryable, details=details)
    if outcome == "refused":
        return ApiError(502, "installer_refused", f"{what} - WisKey דחה את הפעולה ({code}). לא בוצע שינוי.", details=details)
    return ApiError(504, "installer_outcome_unknown",
                    f"{what} נשלח, אך לא התקבלה תשובה ברורה ({code}). ייתכן שהשינוי בוצע - טענו מחדש את המצב ובדקו אותו לפני שמנסים שוב.", details=details)


class Write:
    """One installer write's audit context and steps (routers/access_control.py `_Action`, the station-maintenance order)."""

    def __init__(self, request: Request, conn: sqlite3.Connection, principal: Principal, op: wi.Op, what: str, target: str = INSTALLATION_TARGET) -> None:
        self.op, self.what, self.target = op, what, target
        self.act = _Action(request, conn, principal, op.audit, target, resource_type=STATION_TYPE if op.scope == "station" else INSTALLATION_TYPE)
        self.act.details["installer"] = op.name
        self.not_after: datetime | None = None

    def parse(self, model: type[WriteBody], raw: bytes) -> Any:
        body = _parse(self.act, model, raw)
        self.not_after = _envelope(self.act, body)
        if body.confirmed is not True:
            raise self.refuse(409, "confirmation_required", f"{self.what} דורש אישור מפורש.")
        return body

    def refuse(self, status: int, code: str, message: str, **details: Any) -> ApiError:
        return self.act.refuse(ApiError(status, code, message, details={"operation": self.op.name, **details}))

    def typed(self, body: WriteBody, expected: str) -> None:
        """A dangerous write: the typed phrase must equal `expected` (whitespace and Unicode form normalised)."""
        if self.op.danger == "typed" and not wi.typed_ok(expected, body.typed_confirmation):
            raise self.refuse(409, "typed_confirmation_required", f"כדי לבצע {self.what} יש להקליד בדיוק: {expected}", expected=expected)

    def run(self, values: dict[str, Any], on_ok: Callable[[dict[str, Any]], None] | None = None) -> dict[str, Any]:
        """Arx's limits, the attempt row, ONE send, the outcome row. Returns the screen's reply."""
        limited = wi.LIMITS.admit(self.act.principal.user_id, self.op, self.target)
        if limited is not None:
            code, retry = limited
            raise self.act.refuse(ApiError(429, code, wi.LIMIT_MESSAGES[code].format(s=int(retry + 0.999)), retryable=True,
                                           details={"retry_after_s": retry, "operation": self.op.name}))
        try:
            return self._perform(values, on_ok)
        finally:
            wi.LIMITS.done()

    def _perform(self, values: dict[str, Any], on_ok: Callable[[dict[str, Any]], None] | None) -> dict[str, Any]:
        act = self.act
        act.attempt()
        try:
            reply = wi.run_write(settings_of(act.request), self.op, values, act.principal.user_id, self.not_after)  # type: ignore[arg-type]
        except ApiError as exc:
            outcome = str(exc.details.get("outcome") or "unknown")
            code = str(exc.details.get("wiskey_code") or exc.code)
            if outcome != "not_sent":
                wi.LIMITS.sent(self.op, self.target)
            act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
            raise error_for(self.op, self.what, exc) from None
        except BaseException as exc:
            wi.LIMITS.sent(self.op, self.target)
            act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
            raise
        finally:
            act.conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
        wi.LIMITS.sent(self.op, self.target)
        data = reply["installer"]
        act.outcome("ok", None, {"result": self.op.summary(data)})
        if on_ok is not None:
            on_ok(data)
        return {"operation": self.op.name, "status": "completed", "command_id": act.details["command_id"], "at": reply.get("fetched_at"), "data": data}


def read(request: Request, principal: Principal, op: wi.Op, values: dict[str, Any] | None = None) -> dict[str, Any]:
    return wi.run_read(settings_of(request), op, values or {}, principal.user_id)


def station_or_404(request: Request, station_id: str) -> dict[str, Any] | None:
    """The station in the served copy; 404 when there is a copy without it, None when there is no copy at all (nothing to check)."""
    found = wi.stations(settings_of(request))
    if found is None:
        return None
    station = next((s for s in found if s.get("id") == station_id), None)
    if station is None:
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    return station


def station_for_write(w: Write, station_id: str, require_online: bool = True) -> dict[str, Any]:
    """A station write needs the station in the served copy (to name it and to type its name) and, for a device write, online."""
    found = wi.stations(settings_of(w.act.request))
    if found is None:
        raise w.refuse(503, "installer_unavailable", "אין כרגע עותק עדכני של העמדות מ־WisKey, ולכן הפעולה לא נשלחה.")
    station = next((s for s in found if s.get("id") == station_id), None)
    if station is None:
        raise w.refuse(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    w.act.details["station_name"] = station.get("name")
    if require_online and not station.get("online"):
        raise w.refuse(409, "intercom_station_offline", f"העמדה {station.get('name')} אינה מחוברת כרגע, ולכן הפעולה לא נשלחה.")
    return station


def phrase_for_station(station: dict[str, Any]) -> str:
    return str(station.get("name") or station.get("id") or "").strip()
