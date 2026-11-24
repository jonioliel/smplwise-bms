"""MFA-POLICY-2490 (slice 5 of the second-factor train): the sign-in factor policy's read model and its overrides (services/factor_policy).

`GET /security/factor-policy[?policy=optional|admins|sensitive|all]`   rbac.assign or system.configure: the settings, the legacy rules,
                                                    the overrides and the compliance view (of the stored policy, or of `policy` as a
                                                    preview - "these users would have to enrol")
`PUT /security/factor-policy/overrides/{kind}/{id} {sign_in}`          system.configure (+ a fresh step-up, services/step_up): kind
                                                    user|role, sign_in inherit|required|optional|exempt - audited
                                                    `auth.factor_policy.changed`; mirrored into the legacy TFA2 table

The settings themselves (`security.factor_policy`, `security.factor_policy_mode`, `security.factor_wall_exempt`,
`security.remote_long_lived_tokens`) change through `PATCH /settings` (system.configure, step-up gated, audited `settings.update`).
No UI in this slice (the screens slice 11 uses these routes). Nothing here ends a session: an enforced policy applies at the next
remote sign-in (design 9: "policy turned on while users have no factor -> they are not locked out")."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, authorize, require
from ..services import factor_policy as fp
from ..services import ha_user_auth as hua
from ..services import second_factor_store as store
from ._common import rid as _rid
from ..wire import factor_policy as W
from ..wire import wire

router = APIRouter()

ACTION_LIMITS: list[tuple[float, int]] = [(60.0, 20), (3600.0, 200)]


@router.get("/security/factor-policy", **wire(W.FactorPolicy))
def read_policy(policy: str | None = Query(default=None, max_length=16), principal: Principal = Depends(current_principal_ro),
                conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The sign-in factor policy, the legacy rules, the overrides and the compliance view (or a preview of another policy)."""
    if not authorize(conn, principal, "rbac.assign", INSTALLATION).allowed:
        require(conn, principal, "system.configure", INSTALLATION)
    if policy is not None and policy not in fp.POLICIES:
        raise ApiError(422, "invalid_policy", "המדיניות צריכה להיות optional, admins, sensitive או all.", details={"allowed": list(fp.POLICIES)})
    return {**fp.status(conn), "overrides": fp.overrides(conn), "compliance": fp.compliance(conn, policy)}


class OverrideBody(BaseModel):
    sign_in: str = Field(max_length=16)


@router.put("/security/factor-policy/overrides/{kind}/{subject_id}", **wire(W.OverrideSet))
def set_override(kind: str, subject_id: str, body: OverrideBody, request: Request, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Set one user's or role's sign-in factor override (inherit / required / optional / exempt); audited, mirrored to the legacy table."""
    require(conn, principal, "system.configure", INSTALLATION)
    if kind not in fp.OVERRIDE_KINDS:
        raise ApiError(404, "not_found", "סוג היעד אינו מוכר.")
    if body.sign_in not in fp.OVERRIDE_VALUES:
        raise ApiError(422, "invalid_sign_in", "הערך צריך להיות inherit, required, optional או exempt.", details={"allowed": list(fp.OVERRIDE_VALUES)})
    if len(subject_id) > 200:
        raise ApiError(404, "not_found", "היעד לא נמצא.")
    if kind == "user" and store.user_row(conn, subject_id) is None:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית המערכת.")
    if kind == "role" and subject_id not in all_roles(conn):
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    if not hua.LIMITER.hit(f"factor_policy:{principal.user_id}", ACTION_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    before = fp.set_override(conn, kind, subject_id, body.sign_in, principal.user_id)
    audit(conn, actor=principal, action="auth.factor_policy.changed", decision="allowed", resource_type=kind, resource_id=subject_id,
          request_id=_rid(request), details={"before": before or "inherit", "after": body.sign_in, "mode": fp.mode(conn)})
    return {"kind": kind, "subject_id": subject_id, "sign_in": body.sign_in, "overrides": fp.overrides(conn)}
