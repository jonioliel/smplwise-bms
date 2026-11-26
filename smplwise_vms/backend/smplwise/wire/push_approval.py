"""Response models of the phone approval routes (routers/push_approval.py; MFA-T095-REST-2530, CR-011 option D). The number to match
is returned to the REQUESTER only; the phone never receives it - the person types what the requesting screen shows."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

Status = Literal["pending", "approved", "denied", "expired", "cancelled", "used"]


class PushApprovalStarted(WireModel):
    """`POST /auth/step-up/push`: the request is open; the requesting screen shows `number`, the phone asks the person to pick it."""
    request_id: str
    number: int
    action: str
    expires_in: int


class PushApprovalState(WireModel):
    """`GET /auth/step-up/push/{request_id}` (the requester) and the answers of approve / deny / cancel: where the request stands.
    `reason` of a denial: `user_denied` | `number_mismatch`; of a cancel: `cancelled` | `superseded`; of an expiry: `expired` | `unused`."""
    request_id: str
    status: Status
    reason: str | None
    expires_in: int


class PushApprovalPending(WireModel):
    """One request waiting on the phone: the action it is for and how long it waits (never the number)."""
    request_id: str
    action: str
    expires_in: int


class PushApprovalList(WireModel):
    """`GET /auth/push-approvals`: `enabled` = `security.push_approval`; the caller's pending requests (at most one)."""
    enabled: bool
    pending: list[PushApprovalPending]


class PushApprovalChallenge(WireModel):
    """`POST /auth/push-approvals/{request_id}/challenge`: the phone-key text the app signs for the typed number (a `step_up` payload of
    services/device_keys whose action is `auth.push_approval.n<number>`), its single-use id and how long it lives."""
    challenge_id: str
    payload: str
    expires_in: int
