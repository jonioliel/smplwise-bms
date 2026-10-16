"""The capture lease ROUTE (CR-WISKEY-LEASE-REVOCATION-EVENT slice L5): card capture through the signed trusted-caller transport,
with an Arx-issued lease signed into `capture_start`.

Reached only when `capture_lease.route_on(conn)` - the setting `access.capture_lease` is exactly `on` AND a bridge that
offers the lease service is known. Neither is possible in this build (MIN_BRIDGE_FOR_CAPTURE_LEASE is None and nothing switches
the setting on), so the classic WS path (`cards/capture_*` on the feed's capture lane) stays the only one in production. The
classic path never carries a lease and is never revoked by the event (CR section 8.6).

Rules, in the router's order (routers/access_control.py card capture section):
- start: the same fresh decision as the classic path (S11: both permissions on the reader's station and every station of the
  person, sensitive level) -> the stream announced to the host -> the ledger row (issue: route on, not degraded, clock trusted,
  revision and epochs unchanged since the decision, ceiling, one per receiver / actor) in the attempt's transaction -> ONE signed
  `capture_start` carrying the lease object, never retried. Acknowledged with a session -> `active`; refused -> the row is
  `destroyed(start_refused)`; unknown (timeout, an answer without a usable session id - F9) -> the row stays `issued` and is
  revoked at once (`start_unknown`), the station held for the rest of the 120 s.
- status: the poller reads `capture_status` through the signed route while the lease is usable; the moment it is not (any
  trigger), the session reads `revoked` ("קריאת הכרטיס הופסקה") and nothing more is asked.
- confirm: refused locally (409 `capture_lease_gone`, nothing signed) when the lease is not usable (F8); otherwise ONE signed
  `capture_confirm`, never retried; `sent_unknown` / no clear answer -> `destroyed(confirm_unknown)` and "לא ידוע אם הכרטיס
  נוסף"; acknowledged -> `destroyed(confirmed)`.
- cancel: ONE signed `capture_cancel`; acknowledged -> `destroyed(cancelled)`; unknown -> the lease is revoked (`cancel_unknown`).

The request answers' exact shapes are WisKey's (its revised C04, W?); the closed shapes Arx accepts are written in
docs/contracts/wiskey-capture-lease/SCHEMA.md section 4 for alignment. The card number never reaches Arx beyond WisKey's masked
form in the owner's own reply; nothing here audits or logs it."""
from __future__ import annotations

import logging
import re
from typing import Any

from ..errors import ApiError
from . import capture_lease as cl
from . import intercom_sync, lease_events, trusted_caller

log = logging.getLogger("smplwise.capture_lease")

REQUEST_RESULTS = ("acknowledged", "refused", "sent_unknown")
REFUSED_CODES = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
CONFIRM_UNKNOWN_TEXT = "לא ידוע אם הכרטיס נוסף"
GONE_TEXT = "קריאת הכרטיס הופסקה. אפשר להתחיל קריאה חדשה."


def classify_request(answer: Any, request_id: str) -> tuple[str, dict[str, Any]]:
    """(kind, data) for one lease request: `ok` (data: the answer), `refused` (WisKey refused before doing anything; data:
    code), `rejected` (the bridge refused at a stage: nothing happened; data: code "<stage>/<code>"), `sent_unknown` (the
    host passed its confirm barrier and cannot say), `unknown` (not one of the closed shapes / another request)."""
    r = trusted_caller.response_of(answer)
    if r is None:
        return "unknown", {"code": "invalid_response"}
    result, rid = r.get("result"), r.get("request_id")
    if result == "rejected":
        stage, code = r.get("stage"), r.get("code")
        if rid not in (None, request_id) or not (isinstance(stage, str) and isinstance(code, str)):
            return "unknown", {"code": "invalid_response"}
        return "rejected", {"code": f"{stage}/{code}"}
    if rid != request_id or result not in REQUEST_RESULTS:
        return "unknown", {"code": "invalid_response"}
    if result == "refused":
        code = r.get("code")
        return "refused", {"code": code if isinstance(code, str) and REFUSED_CODES.fullmatch(code) else "refused"}
    if result == "sent_unknown":
        return "sent_unknown", {"code": "sent_unknown"}
    return "ok", r


def send_request(conn: Any, settings: Any, action: str, principal_id: str, display_name: str, station: str, params: dict[str, Any]) -> tuple[trusted_caller.Signed, Any]:
    signed = lease_events.sign(conn, action, principal_id, display_name, station, params)
    return signed, lease_events.TRANSPORT.request(settings, action, signed.text)


def _clock_check(kind: str, data: dict[str, Any]) -> None:
    if kind == "rejected" and data.get("code") in lease_events.CLOCK_CODES:
        lease_events.WORKER._clock_invalid()


# ---------------------------------------------------------------- the poller's status read (services/intercom_capture.py)

def tick(registry: Any, capture: Any, now: float, busy: bool = False) -> None:
    """One poller round for a lease-route session. No WS traffic: the signed `capture_status` only, while the lease is usable."""
    from . import intercom_capture as ic

    if capture.elapsed(now) >= ic.SESSION_S + ic.EXPIRE_GRACE_S:
        if registry.set_state(capture, "expired", None, only_from=ic.POLLED):
            registry._audit_result(capture, "expired", None, {"lease_ref": capture.lease_ref})
        return
    if not cl.usable(capture.lease_ref):
        stop(registry, capture)
        return
    if now - capture.last_seen > ic.ABANDON_S:
        abandon(registry, capture)
        return
    interval = ic.CAPTURED_POLL_S if capture.state == "captured" else ic.POLL_BUSY_S if busy else ic.POLL_S
    if now - capture.last_poll < interval:
        return
    capture.last_poll = now
    try:
        with capture.db.connection(mode="read", label="capture_lease.status") as conn:
            signed, answer = send_request(conn, capture.settings, "capture_status", capture.owner.user_id, capture.owner.user_id, capture.station_id,
                                          {"lease_ref": capture.lease_ref, "session_id": capture.session_id})
    except Exception as exc:  # noqa: BLE001 - not sent / HA unreachable / a timeout: the next tick asks again
        log.debug("capture lease status not read (%s)", getattr(exc, "code", type(exc).__name__))
        return
    kind, data = classify_request(answer, signed.request_id)
    _clock_check(kind, data)
    if kind == "refused" and data["code"] in ("capture_not_found", "lease_gone"):
        state = "expired" if capture.elapsed(now) >= ic.SESSION_S - 2 * ic.POLL_S else "lost"
        if registry.set_state(capture, state, None, only_from=ic.POLLED):
            cl.finish(capture.db, capture.lease_ref, "destroyed" if state == "lost" else "expired", "lost" if state == "lost" else "expired")
            registry._audit_result(capture, state, None, {"lease_ref": capture.lease_ref})
        return
    if kind != "ok":
        return
    try:
        status = intercom_sync.project_capture_session({**(data.get("capture") or {}), "session_id": capture.session_id})
    except (ValueError, TypeError):
        return
    with registry._lock:
        if capture.state not in ic.POLLED:
            return
        previous = capture.state
        if status["state"] in ("preparing", "waiting"):
            capture.state = status["state"]
            return
        if status["state"] == "captured":
            capture.card = status["card"]
            capture.state = "captured"
            newly = previous != "captured"
        else:
            newly = False
    if status["state"] == "captured":
        if newly:
            card = status["card"] or {}
            registry._audit_result(capture, "captured", None, {"technology": card.get("technology"), "card_reader_id": card.get("reader_id"), "lease_ref": capture.lease_ref})
        return
    if status["state"] == "error":
        error = status["error"] or "capture_failed"
        if registry.set_state(capture, "error", error, only_from=ic.POLLED):
            cl.finish(capture.db, capture.lease_ref, "destroyed", "error")
            registry._audit_result(capture, "timeout" if error == "capture_timeout" else "error", error, {"lease_ref": capture.lease_ref})


def stop(registry: Any, capture: Any, *, audit: bool = True) -> None:
    """The lease's authority is gone (a trigger fired): the session reads `revoked` at once; the worker sends the revoke.
    `audit=False` from inside a request that holds the write lock (its own refusal row records it; a side write would wait
    for the lock the request itself holds)."""
    from . import intercom_capture as ic

    if registry.set_state(capture, "revoked", None, only_from=ic.ACTIVE, reason="lease_revoked") and audit:
        registry._audit_result(capture, "revoked", None, {"lease_ref": capture.lease_ref})


def abandon(registry: Any, capture: Any) -> None:
    """T5: the owner's dialog went silent for ABANDON_S - the lease is revoked (`abandoned`); the revoke destroys the host's
    session (and its own `capture_cancel` follows if the revoke is not answered in time - F1)."""
    from . import intercom_capture as ic

    if registry.set_state(capture, "cancelled", None, only_from=ic.POLLED, reason="abandoned"):
        cl.on_authority_change("abandoned", lease_refs=[capture.lease_ref])
        registry._audit(capture, "intercom.card_capture.cancel", "ok", None, {"trigger": "abandoned", "lease_ref": capture.lease_ref})


def cancel_known(db: Any, settings: Any, actor_id: str, station_id: str, lease_ref: str, session_id: str) -> None:
    """A session the host named for a lease that was revoked meanwhile: its own signed `capture_cancel`, once (the revoke
    already in flight is the primary signal). Best effort; the outcome is audited with a code only."""
    try:
        with db.connection(mode="read", label="capture_lease.cancel_known") as conn:
            signed, _answer = send_request(conn, settings, "capture_cancel", actor_id, actor_id, station_id, {"lease_ref": lease_ref, "session_id": session_id})
        lease_events.WORKER._audit_aside("intercom.capture_lease.event_sent", f"lease:{lease_ref}", {"action": "capture_cancel", "request_id": signed.request_id,
                                                                                                   "body_sha256": signed.body_sha256, "attempt": 1})
    except Exception as exc:  # noqa: BLE001
        lease_events.WORKER._audit_aside("intercom.capture_lease.event_failed", f"lease:{lease_ref}", {"code": str(getattr(exc, "code", None) or type(exc).__name__)[:64],
                                                                                                     "action": "capture_cancel"})


def gone() -> ApiError:
    return ApiError(409, "capture_lease_gone", GONE_TEXT, details={"outcome": "not_sent"})
