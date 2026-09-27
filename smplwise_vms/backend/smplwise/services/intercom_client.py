"""WisKey (`hikvision_intercom`) command wrapper (CR-005): one typed function per WisKey command SMPLWISE surfaces.

WisKey stays the sole writer to its own data and devices. SMPLWISE only issues the same `hikvision_intercom/<command>`
messages WisKey's own panel issues, over Home Assistant's core WebSocket API (`ha_client.ws_session`'s `call`), and
never reads or writes `.storage/hikvision_intercom.*`. Command shapes and error codes follow
docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md (§0.3 envelope, types.ts `Overview`).

This module knows nothing about threads, polling or subscribers (services/intercom_sync.py owns those), so a later
phase adds commands here without touching the connection machinery. Phase 1a: `overview`; phase 1b adds the read-only
`events/list`, `users/query` and `users/get` (WISKEY_SOURCE_EXTRACTION.md §X.1; WisKey's own areas `events:view` /
`users:view`). All of them are READ commands, so no `api_contract` field is sent (§0.4). `users/query` is never given
a search text (see `users_query`)."""
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


# the events/list filters SMPLWISE ever sends. WisKey also accepts `current_profile` ({field_id: value}); it is left out
# on purpose, here and not only in the router: matching events by a profile value (an ID number, say) would let a reader
# probe values the people endpoints never show (CR-005 phase 1b review, S1).
EVENT_FILTER_KEYS = ("station_id", "person", "result", "authentication", "door", "start", "end", "limit", "before", "current_group")


async def events_list(call: Call, filters: dict[str, Any]) -> dict[str, Any]:
    """`hikvision_intercom/events/list {filters}` - one page of WisKey's bounded event cache (5 000 records / 30 days),
    newest first. Filter keys (EventManager.query, all optional): `station_id`, `person`, `result`, `authentication`,
    `door` (1|2), `start` / `end` (aware ISO), `limit` (1-200, WisKey's default 100), `before` (the previous page's
    `next` cursor), `current_group`. Only EVENT_FILTER_KEYS are ever sent - any other key a caller passes (including
    WisKey's `current_profile`) is dropped here - and None values are dropped because WisKey type-checks every key that
    is present. Returns `{records, next, retention_days, capacity, membership_basis, storage_failed, stations}`."""
    body = {k: filters[k] for k in EVENT_FILTER_KEYS if filters.get(k) is not None}
    result = _result(await call(command_type("events/list"), filters=body), "events/list")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "events/list")
    return result


async def users_query(call: Call, filters: dict[str, Any], offset: int, limit: int, snapshot: str | None) -> dict[str, Any]:
    """`hikvision_intercom/users/query` - one page of WisKey's people directory (capability `user_directory_query`,
    WisKey 1.6.0+). The command schema requires five fields: `query`, `filters` (keys within `group`, `profile`,
    `station`, `rights`, `state`, `credential`, `sort`), `offset` (0-10 000 000, clamped to the last page), `limit`
    (1-200) and `snapshot` (the previous page's value, "" for none). Returns `{records: [Person], total, total_all,
    offset, limit, next_offset, previous_offset, snapshot, stale}`; the records are WisKey's full public `Person`, PII
    included - the caller projects them.

    `query` is ALWAYS sent empty, by construction (there is no parameter for it): WisKey matches its search text against
    phone digits and card last-4 as well as name and employee number, with no way to scope the fields, so forwarding a
    caller's text would let them test "does anyone have phone / card X" through the match count (owner decision D1,
    CR-005 phase 1b review). Text search is done by SMPLWISE over its own projection instead (intercom_sync)."""
    result = _result(await call(command_type("users/query"), query="", filters=filters, offset=offset, limit=limit, snapshot=snapshot or ""), "users/query")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "users/query")
    return result


async def users_get(call: Call, user_id: str) -> dict[str, Any]:
    """`hikvision_intercom/users/get {user_id}` - one person (`ManagedUser.public()`, PII included - the caller
    projects it). An unknown id is `user_not_found`."""
    result = _result(await call(command_type("users/get"), user_id=user_id), "users/get")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "users/get")
    return result
