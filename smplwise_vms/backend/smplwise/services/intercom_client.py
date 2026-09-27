"""WisKey (`hikvision_intercom`) command wrapper (CR-005): one typed function per WisKey command SMPLWISE surfaces.

WisKey stays the sole writer to its own data and devices. SMPLWISE only issues the same `hikvision_intercom/<command>`
messages WisKey's own panel issues, over Home Assistant's core WebSocket API (`ha_client.ws_session`'s `call`), and
never reads or writes `.storage/hikvision_intercom.*`. Command shapes and error codes follow
docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md (§0.3 envelope, types.ts `Overview`).

This module knows nothing about threads, polling or subscribers (services/intercom_sync.py owns those), so a later
phase adds commands here without touching the connection machinery. Phase 1a: `overview` only, read-only."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

DOMAIN = "hikvision_intercom"

# The `call(type, **kw)` helper `ha_client.ws_session` hands to `on_ready`: it resolves with HA's raw result frame.
Call = Callable[..., Awaitable[dict[str, Any]]]


class IntercomError(Exception):
    """A WisKey command did not succeed. `code` is HA's / WisKey's error code (e.g. `unknown_command` when the
    integration is not loaded, `unauthorized` when WisKey refuses the add-on's HA user)."""

    def __init__(self, code: str, command: str) -> None:
        super().__init__(f"{command}: {code}")
        self.code = code
        self.command = command

    @property
    def not_installed(self) -> bool:
        return self.code == "unknown_command"


def command_type(command: str) -> str:
    return f"{DOMAIN}/{command}"


def _result(frame: dict[str, Any], command: str) -> Any:
    if frame.get("success"):
        return frame.get("result")
    error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
    raise IntercomError(str(error.get("code") or "action_failed"), command)


async def overview(call: Call) -> dict[str, Any]:
    """`hikvision_intercom/overview` - WisKey's panel bootstrap read (stations with online / call / sync state and the
    last access record, users, sync bookkeeping, `api` contract). No fields: the command schema forbids extra keys, and
    `overview` is a READ command, so no `api_contract` is needed either."""
    result = _result(await call(command_type("overview")), "overview")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "overview")
    return result


async def subscribe(call: Call) -> int:
    """`hikvision_intercom/subscribe` - WisKey's only push channel. Its events are data-free (`{"kind": "refresh"}` or
    `{"kind": "access_revoked"}`); a client refetches what it shows. Returns the subscription id the events carry."""
    frame = await call(command_type("subscribe"))
    _result(frame, "subscribe")
    return int(frame["id"])
