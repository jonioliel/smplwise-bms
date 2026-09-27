"""WisKey (`hikvision_intercom`) command wrapper (CR-005): one typed function per WisKey command SMPLWISE surfaces.

WisKey stays the sole writer to its own data and devices. SMPLWISE only issues the same `hikvision_intercom/<command>`
messages WisKey's own panel issues, over Home Assistant's core WebSocket API (`ha_client.ws_session`'s `call`), and
never reads or writes `.storage/hikvision_intercom.*`. Command shapes and error codes follow
docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md (§0.3 envelope, types.ts `Overview`).

This module knows nothing about threads, polling or subscribers (services/intercom_sync.py owns those), so a later
phase adds commands here without touching the connection machinery. Phase 1a: `overview`; phase 1b adds the read-only
`events/list`, `users/query` and `users/get` (WISKEY_SOURCE_EXTRACTION.md §X.1; WisKey's own areas `events:view` /
`users:view`). All of them are READ commands, so no `api_contract` field is sent (§0.4). `users/query` is never given
a search text (see `users_query`).

Physical actions (CR-005 phase 3, owner-approved per capability): `stations/test_unlock` (door release), `media/signal`
(answer / reject / hang up) and `tts/engines` + `tts/start` (spoken announcement). The first two are panel `COMMANDS`
outside READ_COMMANDS, so they carry `api_contract: API_CONTRACT` exactly as WisKey's own panel sends it (§0.4); the two
`tts/*` handlers check their key set exactly and must NOT get it (media part, "0.1 How the panel talks to the backend").
None of them is ever retried here: a physical command is sent once, and a lost answer is the caller's "outcome
unknown", never a reason to send it again (AGENTS.md, Security and physical systems)."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

DOMAIN = "hikvision_intercom"

# The `call(type, **kw)` helper `ha_client.ws_session` hands to `on_ready`: it resolves with HA's raw result frame.
Call = Callable[..., Awaitable[dict[str, Any]]]

API_CONTRACT = 1  # WisKey's panel CLIENT_API: sent on non-read panel commands, as WisKey's own panel does
CALL_COMMANDS = ("answer", "reject", "hangUp")
TTS_MESSAGE_MAX = 500  # audio_tts.py: the message is whitespace-collapsed and must be 1..500 characters


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


# ---------------------------------------------------------------- physical actions (CR-005 phase 3)

# Error codes that WisKey (or Home Assistant in front of it) returns BEFORE a physical command could reach the device:
# only these are a refusal ("not carried out"). WISKEY_SOURCE_EXTRACTION.md §0.3 handler pipeline: authorization
# (`unauthorized`), schema (`invalid_fields`), contract (`api_incompatible`), size (`request_too_large`) and the
# AdminLimiter (`rate_limited`) all run before dispatch; HA answers `unknown_command` for a command it does not know.
PRE_DISPATCH = frozenset({"unauthorized", "invalid_fields", "api_incompatible", "request_too_large", "rate_limited", "unknown_command"})
PRE_DEVICE: dict[str, frozenset[str]] = {
    # websocket.py:907-934 + runtime.py:72-121: `station_offline` (entry / coordinator check), `connection_closed`
    # (runtime already closed), `lock_not_managed`, `release_in_progress` (this relay already unlocking) - all before
    # client.async_unlock. NOT here: `release_unconfirmed` (the device call errored - the door may have opened - or the
    # runtime closed AFTER a successful open), `action_failed` (any other exception, anywhere), and the client's 1 s
    # per-door debounce, which has no code of its own (a HikvisionBusyError, reported as `release_unconfirmed`).
    "stations/test_unlock": frozenset({"station_offline", "connection_closed", "lock_not_managed", "release_in_progress"}),
    # health_api.py:20-27, 52-81: `station_unloaded` (station / entry lookup) and `device_busy` (a signal already running
    # for the station) come before any device call. NOT here: `device_unavailable` - ANY HikvisionError, including a
    # failure of the callSignal PUT itself after it may have reached the device.
    "media/signal": frozenset({"station_unloaded", "device_busy"}),
    # audio_tts.py:272-333 start errors, all raised before playback starts: invalid message, engine not listed, station
    # not loaded, audio channel busy.
    "tts/start": frozenset({"tts_invalid_message", "tts_engine_unavailable", "station_unloaded", "audio_busy"}),
}


def refusal_is_pre_device(command: str, code: str) -> bool:
    return code in PRE_DISPATCH or code in PRE_DEVICE.get(command, frozenset())


def _action_result(frame: dict[str, Any], command: str) -> Any:
    """A physical command's answer (T054 review B2 / final round B-1). Once WisKey said `success: true` the command WAS
    carried out as far as WisKey knows, so its result is returned as it came, whatever its shape (the caller's
    projection judges it; a shape it does not understand reads "outcome unknown"). A `success: false` is a refusal
    (IntercomError) ONLY when its code is on the command's pre-device allow-list above; every other code - including
    `release_unconfirmed`, `action_failed`, `device_unavailable`, Home Assistant's own errors and any code this list
    does not know - may have come after the command reached the device, so it is UnclearAnswer: outcome unknown. So is
    a frame that is neither success nor failure. The allow-list fails toward "unknown", never toward "refused"."""
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code and refusal_is_pre_device(command, code):
            raise IntercomError(code, command)  # a genuine refusal: nothing reached the device
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response")  # neither an acceptance nor a refusal


class UnclearAnswer(Exception):
    """A physical command's answer that does not say whether it was carried out: a failure code that can come after the
    command reached the device, or a frame that is neither success nor failure. `code` is what WisKey / HA sent."""

    def __init__(self, command: str, code: str) -> None:
        super().__init__(f"{command}: {code}")
        self.command = command
        self.code = code

async def release_door(call: Call, station_id: str, lock: int) -> dict[str, Any]:  # not `test_unlock`: pytest collects test_*
    """`hikvision_intercom/stations/test_unlock {station_id, lock, api_contract}` - one momentary release of the
    station's relay `lock` (an `integrated_locks[].physical_index`; WisKey's backend then sends ISAPI
    `PUT .../RemoteControl/door/{api_id}` `<cmd>open</cmd>`). WisKey answers `{accepted: true}` once the command was
    accepted: that is NOT proof the door moved (the open time is the device's own setting; WISKEY_SOURCE_EXTRACTION.md,
    media part, quirk 6). WisKey itself throttles one release per door per second."""
    if type(lock) is not int:  # WisKey's strict typing: bool-as-int is `invalid_fields` (refused locally, nothing sent)
        raise IntercomError("invalid_fields", "stations/test_unlock")
    frame = await call(command_type("stations/test_unlock"), station_id=station_id, lock=lock, api_contract=API_CONTRACT)
    return _action_result(frame, "stations/test_unlock")


async def media_signal(call: Call, station_id: str, command: str) -> dict[str, Any]:
    """`hikvision_intercom/media/signal {station_id, command, api_contract}` - one call signal to the door station
    (`answer` / `reject` while ringing, `hangUp` while in a call; WisKey refuses a state mismatch as
    `device_unavailable`). WisKey sends exactly one ISAPI `callSignal` PUT, never retries, and answers `{command,
    acknowledged: true|null, physical_result: "unverified", before_state, observed_state, observation, checked_at}` -
    `acknowledged: null` means the device's answer was lost. `reject` / `hangUp` also stop any WisKey audio / TTS
    session at that station."""
    if command not in CALL_COMMANDS:
        raise IntercomError("invalid_fields", "media/signal")
    frame = await call(command_type("media/signal"), station_id=station_id, command=command, api_contract=API_CONTRACT)
    return _action_result(frame, "media/signal")


async def tts_engines(call: Call) -> dict[str, Any]:
    """`hikvision_intercom/tts/engines {}` - Home Assistant's TTS engines WisKey can speak through: `{default,
    engines: [{engine_id, name, supported_languages, default_language}]}`. Exact key set: no `api_contract`."""
    result = _result(await call(command_type("tts/engines")), "tts/engines")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "tts/engines")
    return result


def collapse(message: str) -> str:
    """WisKey's own normalisation of a TTS message (whitespace collapsed, trimmed), so the length SMPLWISE checks and
    records is the one WisKey checks and speaks."""
    return " ".join(message.split())


async def tts_start(call: Call, station_id: str, engine_id: str, language: str | None, message: str) -> int:
    """`hikvision_intercom/tts/start {station_id, engine_id, language, message}` - a SUBSCRIPTION: Home Assistant
    synthesises `message` with `engine_id` (which may be a cloud provider: the text then leaves the premises) and WisKey
    plays it through the door station speaker. The result is `null`; progress arrives as events on the returned
    subscription id (`generating` -> `speaking` -> `completed` {physical_result: "unverified"} | `closed` {reason}).
    Unsubscribing CANCELS the playback, so the caller keeps the subscription until a terminal event. Exact key set: no
    `api_contract`; `language` is required and may be null."""
    frame = await call(command_type("tts/start"), station_id=station_id, engine_id=engine_id, language=language, message=message)
    _action_result(frame, "tts/start")
    return int(frame["id"])  # ha_client matched the frame by this id, so it is always there
