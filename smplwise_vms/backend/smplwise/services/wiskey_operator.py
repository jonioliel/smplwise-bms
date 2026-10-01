"""One read under the signed-in operator's OWN Home Assistant identity (B0 groundwork for path (b), `/arx` only).

Decision D-001: operator identity today means a real per-user Home Assistant WebSocket connection, read-only, in the
`/arx` channel, where the server already holds the user's Home Assistant access token in memory (<= 30 min, replaced on every
browser refresh, re-checked against Home Assistant every 60 s while in use; services/ha_user_auth.py). Nothing here is the
adapter of B1 (`getAuthorization`, `listStations`, `getUser`, `queryUsers`, `listEvents`, `subscribeChanges`, a connection that
stays open per operator): B0 only proves the path with one allow-listed command, `authorization/session`, so the diagnostics can
show what WisKey says about the operator. The connection is opened, used once and closed; the token is never logged, stored
or sent anywhere but Home Assistant core; a locked or refused connection is reported, never worked around (`security/touch`
does not unlock a connection, and no read-only exemption exists - ARX_DECISIONS_REPLY_HE.md section 1).

The Supervisor proxy cannot validate a user token, so the connection goes to Home Assistant core (`core_ws_url`)."""
from __future__ import annotations

import asyncio
import json
import threading
import time
from typing import Any

from ..config import Settings
from . import ha_user_auth, intercom_client
from .ha_user_auth import HaUnavailable, TokenInvalid
from .intercom_client import IntercomError

OPERATOR_READ_ALLOWLIST = frozenset({"authorization/session"})
MIN_INTERVAL_S = 3.0  # one probe per operator every few seconds: a diagnostics refresh, not a poll
TIMEOUT_S = 10.0
_last: dict[str, float] = {}
_lock = threading.Lock()


def throttled(user_id: str, now: float | None = None) -> bool:
    """True when this operator probed less than MIN_INTERVAL_S ago (the probe is then not made); records the attempt."""
    moment = time.monotonic() if now is None else now
    with _lock:
        previous = _last.get(user_id)
        if previous is not None and moment - previous < MIN_INTERVAL_S:
            return True
        _last[user_id] = moment
        if len(_last) > 512:  # a bounded table: the oldest entries are long past the window
            for key in sorted(_last, key=_last.get)[:256]:  # type: ignore[arg-type]
                _last.pop(key, None)
        return False


def reset_for_tests() -> None:
    with _lock:
        _last.clear()


async def read(settings: Settings, token: str, command: str = "authorization/session") -> Any:
    """`hikvision_intercom/<command>` over one fresh connection authenticated with the operator's access token. Raises
    ValueError for a command outside OPERATOR_READ_ALLOWLIST, TokenInvalid for a token Home Assistant refuses (or that already
    expired), HaUnavailable when Home Assistant could not be asked, IntercomError for WisKey's own refusal (`unauthorized`:
    the user has no WisKey access; `unknown_command`: not installed ...)."""
    if command not in OPERATOR_READ_ALLOWLIST:
        raise ValueError(f"{command} is not an allowed operator read")
    exp = ha_user_auth.jwt_exp(token)
    if exp is None or exp <= time.time():
        raise TokenInvalid("expired")
    url = ha_user_auth.core_ws_url(settings)
    try:
        ws = await ha_user_auth._dial(url, {})
    except Exception as exc:  # noqa: BLE001
        raise HaUnavailable(type(exc).__name__) from exc
    try:
        async with asyncio.timeout(TIMEOUT_S):
            hello = json.loads(await ws.recv())
            if hello.get("type") != "auth_required":
                raise HaUnavailable("unexpected hello")
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            auth = json.loads(await ws.recv())
            if auth.get("type") == "auth_invalid":
                raise TokenInvalid("auth_invalid")
            if auth.get("type") != "auth_ok":
                raise HaUnavailable("unexpected auth answer")
            await ws.send(json.dumps({"id": 1, "type": intercom_client.command_type(command)}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == 1 and msg.get("type") == "result":
                    break
    except (TokenInvalid, HaUnavailable):
        raise
    except TimeoutError as exc:
        raise HaUnavailable("timeout") from exc
    except Exception as exc:  # noqa: BLE001 - a dropped socket, a malformed frame
        raise HaUnavailable(type(exc).__name__) from exc
    finally:
        try:
            await ws.close()
        except Exception:  # noqa: BLE001
            pass
    if msg.get("success") is not True:
        error = msg.get("error") if isinstance(msg.get("error"), dict) else {}
        raise IntercomError(str(error.get("code") or "action_failed"), command)
    return msg.get("result")
