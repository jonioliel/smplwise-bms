"""MFA-SCREENS-2510 (slice 11 of the second-factor train): one user's second factors as an administrator sees them - the factors
section of the user drawer (Settings › Users & permissions › a user).

`GET /security/user-factors/{user_id}`   rbac.assign or system.configure (the same readers as `GET /security/factor-policy`): the
                                         authenticator code (on / since / last used), passkeys (all / usable), phone keys (active /
                                         counting under the attestation mode), the recovery codes left, whether Home Assistant MFA was
                                         seen, and what the sign-in factor policy says for the user. Counts, dates and verdicts only.

Read only: no write, no audit row (a read of the same kind as the compliance view). The administrator's reset stays the existing
`DELETE /auth/second-factor/users/{user_id}` (routers/second_factor.py)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends

from ..auth import current_principal_ro, get_read_conn
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import device_key_attestation as dka
from ..services import device_keys as dk
from ..services import factor_policy as fp
from ..services import local_passkeys as lpk
from ..services import mfa_provenance
from ..services import recovery_codes as rc
from ..services import second_factor as sf
from ..wire import user_factors as W
from ..wire import wire

router = APIRouter()


def _known(conn: sqlite3.Connection, user_id: str) -> bool:
    """An Arx user row or a Home Assistant directory user (a user the directory lists who never signed in has no `users` row)."""
    if conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone() is not None:
        return True
    try:
        return conn.execute("SELECT 1 FROM ha_users WHERE id = ?", (user_id,)).fetchone() is not None
    except sqlite3.OperationalError:
        return False


@router.get("/security/user-factors/{user_id}", **wire(W.UserFactors))
def user_factors(user_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The factors one user has and the policy's verdict for them (no secret, no credential id, no code)."""
    if not authorize(conn, principal, "rbac.assign", INSTALLATION).allowed:
        require(conn, principal, "system.configure", INSTALLATION)
    if len(user_id) > 200 or not _known(conn, user_id):
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית המערכת.")
    keys = dk.active_rows(conn, user_id)
    rec = rc.status(conn, user_id)
    res = fp.resolve(conn, fp.internal(user_id))
    return {
        "user_id": user_id,
        "totp": sf.status(conn, user_id),
        "passkeys": len(lpk.rows(conn, user_id)),
        "passkeys_usable": len(lpk.usable_rows(conn, user_id)),
        "device_keys": len(keys),
        "device_keys_counting": sum(1 for r in keys if dka.counts(conn, dk.attested_of(r))),
        "recovery": {"remaining": rec["remaining"], "total": rec["total"], "low": rec["low"]},
        "ha_mfa_seen": user_id in mfa_provenance.seen_users(conn),
        "policy": {"sign_in": res.sign_in, "source": res.source, "enforced": fp.enforced(conn)},
    }
