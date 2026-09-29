"""CR-008 remote channel identity (step 3 fills this in): until then every remote request is unauthenticated."""
from __future__ import annotations

from typing import Any

from ..config import Settings
from ..errors import unauthenticated
from ..rbac import Principal

LOGIN_REQUIRED_HE = "נדרשת כניסה ל־SmplWise Arx."


def remote_principal(request: Any, settings: Settings) -> Principal:
    raise unauthenticated("remote_login_required", LOGIN_REQUIRED_HE)


async def remote_principal_ws(websocket: Any, settings: Settings) -> Principal | None:
    return None
