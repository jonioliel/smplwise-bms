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
unknown", never a reason to send it again (AGENTS.md, Security and physical systems).

People writes (CR-005 phase 2, slice A1, owner decision 2026-09-28): `users/create`, `users/update` and `users/delete`
- WisKey's own editor commands (panel.ts `save()` / `removeUser()`), sent with `api_contract` like every non-read
panel command - and the read `users/pin_generate`, which is NOT in WisKey's READ_COMMANDS and so carries `api_contract`
too (api_contract.py). Their effect is WisKey's storage (`repository._commit`); the devices follow through WisKey's own
reconciliation. The same rule as for the physical commands applies: sent once, never retried, and a failure code counts
as a refusal only when the source proves it is raised before the store is written (PRE_STORAGE).

Card capture (CR-005 phase 2, slice A2): `cards/reader_capabilities` (a read that reaches the device),
`cards/capture_start` (PHYSICAL: the station's reader enters card-collection mode), `cards/capture_status`,
`cards/capture_cancel` and `cards/capture_confirm` (a people write) - WisKey's own names and payloads, refused only for
the codes PRE_CAPTURE proves come before the effect."""
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
    # health_api.py:52-81: `device_busy` (a signal already running for the station, :55-58) comes before any device
    # call. NOT here: `device_unavailable` - ANY HikvisionError, including a failure of the callSignal PUT itself after
    # it may have reached the device - and NOT `station_unloaded`: the extraction places it at dispatch_health's early
    # entry lookup (:20-27), but WisKey raises that same code after device work in other command families, and the
    # WisKey source itself is not available here to prove media/signal never does (T054 final confirmation S-1). Unproven
    # means unknown, the safe side, exactly like the release debounce.
    "media/signal": frozenset({"device_busy"}),
    # audio_tts.py:272-333 start errors, all raised as the subscription's result error BEFORE playback starts (a failure
    # during playback arrives as a `closed {reason}` event, never as a result error): invalid message, engine not
    # listed, station not loaded, audio channel busy.
    "tts/start": frozenset({"tts_invalid_message", "tts_engine_unavailable", "station_unloaded", "audio_busy"}),
}

# People writes (CR-005 phase-2 brief A.4, verified against the WisKey source: websocket.py:844-896, access/manager.py
# async_create / async_update / async_delete / _validate, access/models.py build_user, access/repository.py _commit /
# _validate_collisions / _update_user / _delete_user, storage.py async_save). The effect is the store being written:
# `_commit` computes the candidate state, validates collisions, then `_save`s; memory is published only after a
# successful save. Everything below is raised before `_save`:
# - the handler's own checks on `profile` / `group_ids` / `photo` keys: `profile_settings_unavailable`, `photo_disabled`
#   (`invalid_fields` is PRE_DISPATCH already);
# - `build_user` (models.py:253-376; run by manager._validate and again inside the commit, both before the save):
#   `invalid_identifier` (a HikvisionValidationError too), `invalid_text`, `invalid_boolean`, `unsupported_user_type`,
#   `invalid_validity`, `invalid_pin`, `invalid_cards`, `invalid_id`, `unsupported_card_type`, `duplicate_card`,
#   `invalid_assignments`, `unmanaged_lock`, `schedule_unverified`, `invalid_photo`, `invalid_phone` and the timing
#   codes (`invalid_timing_policy`, `schedule_binding_invalid`, `invalid_user_timing`, `schedule_period_limit`,
#   `schedule_invalid_time`, `schedule_overlap`, `schedule_invalid_date`);
# - `repository.permission_data` / group_permissions.prepare: `group_policy_changed` (+ `invalid_assignments`, `unmanaged_lock`);
# - `manager._validate` (cached capabilities only, no device I/O): `station_not_found`, `station_has_no_managed_lock`,
#   `person_exceeds_capabilities`, `pin_device_managed`, `pin_exceeds_capabilities`, `card_capacity`,
#   `card_exceeds_capabilities`;
# - the commit's change function and `_validate_collisions`: `user_not_found`, `revision_conflict`,
#   `identity_migration_required`, `employee_conflict`, `pin_conflict`, `card_conflict`, `pin_removal_pending`,
#   `card_removal_pending`, `photo_storage_full`;
# - `AccessStore.async_save`: `storage_stopping` (HA is shutting down; raised before anything is written).
# NOT here, so "unknown": `storage_write_failed` (raised from inside the atomic file write - whether the file was
# replaced first is not provable, brief §6.6), `manager_closed` (`request()` runs AFTER the commit: saved but not
# queued), `action_failed` (any other exception, anywhere), `device_unavailable` (no device I/O is expected on this
# path, so the brief marks it unproven: unknown, the safe side) and every code this list does not know.
_USER_WRITE_REFUSED = frozenset({
    "profile_settings_unavailable", "photo_disabled",
    "invalid_identifier", "invalid_text", "invalid_boolean", "unsupported_user_type", "invalid_validity", "invalid_pin",
    "invalid_cards", "invalid_id", "unsupported_card_type", "duplicate_card", "invalid_assignments", "unmanaged_lock",
    "schedule_unverified", "invalid_photo", "invalid_phone", "invalid_timing_policy", "schedule_binding_invalid",
    "invalid_user_timing", "schedule_period_limit", "schedule_invalid_time", "schedule_overlap", "schedule_invalid_date",
    "group_policy_changed",
    "station_not_found", "station_has_no_managed_lock", "person_exceeds_capabilities", "pin_device_managed",
    "pin_exceeds_capabilities", "card_capacity", "card_exceeds_capabilities",
    "user_not_found", "revision_conflict", "identity_migration_required", "employee_conflict", "pin_conflict",
    "card_conflict", "pin_removal_pending", "card_removal_pending", "photo_storage_full",
    "storage_stopping",
})
PRE_STORAGE: dict[str, frozenset[str]] = {
    "users/create": _USER_WRITE_REFUSED,
    "users/update": _USER_WRITE_REFUSED,
    # _delete_user raises `user_not_found` / `revision_conflict` inside the commit's change function, `async_save`
    # `storage_stopping`. `manager_closed` comes from `request()` after the tombstone commit: unknown.
    "users/delete": frozenset({"user_not_found", "revision_conflict", "storage_stopping"}),
}
# Card capture (CR-005 phase 2 slice A2), verified against the WisKey source (access/enrollment.py CardEnrollment,
# websocket.py:524-539 dispatch, access/manager.py _station / _driver, access/repository.py get):
# - `cards/capture_start`: the handler raises `unauthorized` for an empty actor, then `start()` runs synchronously and
#   ALL its checks come before the collector task (the only thing that talks to the reader) is created -
#   `_client()`: `manager_closed`, `station_not_found` (manager._station), `station_offline` / `station_has_no_managed_lock`
#   (manager._driver); `repository.get`: `user_not_found`; then `revision_conflict`, `invalid_fields`,
#   `capture_station_busy` (one session per station), `capture_limit` (three sessions across every WisKey user). After
#   the session is registered and the task created nothing can raise but `public()`. So every one of those is a proven
#   pre-device refusal. NOT here, so "unknown": `action_failed` (any other exception - e.g. the task factory failing
#   AFTER the session was registered), `device_unavailable` (a HikvisionError; `start()` does no device I/O, so it is
#   unproven), every code this list does not know, and a `success: true` answer without a string `session_id`
#   (intercom_sync.project_capture_session): the reader may then be in collection mode for up to SESSION_SECONDS.
# - `cards/capture_cancel`: `unauthorized` (empty actor) and, in `cancel()`, `capture_not_found` (the session belongs to
#   another actor - never us, WisKey sees one actor for all of SMPLWISE) and `capture_applying` (a confirm is running)
#   are raised before `_drop()`: refused, nothing cancelled. An unknown id is a no-op answered `{cancelled: true}`.
# - `cards/capture_confirm` (effect = WisKey's store, `manager.async_update`): `capture_not_found`, `capture_not_ready`,
#   `invalid_text` (the label, models.text_field), then `user_not_found` / `revision_conflict` / `card_conflict` (each
#   also drops the session) are raised before the update; inside it, the users/update pre-storage codes above. Unknown:
#   `storage_write_failed`, `manager_closed` (request() after the commit), `action_failed`, everything else.
CAPTURE_START_REFUSED = frozenset({
    "manager_closed", "station_not_found", "station_offline", "station_has_no_managed_lock", "user_not_found",
    "revision_conflict", "capture_station_busy", "capture_limit",
})
CAPTURE_CANCEL_REFUSED = frozenset({"capture_not_found", "capture_applying"})
CAPTURE_CONFIRM_REFUSED = frozenset({"capture_not_found", "capture_not_ready", "invalid_text", "user_not_found", "revision_conflict", "card_conflict"}) | _USER_WRITE_REFUSED
PRE_CAPTURE: dict[str, frozenset[str]] = {
    "cards/capture_start": CAPTURE_START_REFUSED,
    "cards/capture_cancel": CAPTURE_CANCEL_REFUSED,
    "cards/capture_confirm": CAPTURE_CONFIRM_REFUSED,
}
PRE_EFFECT: dict[str, frozenset[str]] = {**PRE_DEVICE, **PRE_STORAGE, **PRE_CAPTURE}


def refusal_is_pre_device(command: str, code: str) -> bool:
    """Whether `code` is a proven pre-effect refusal of `command`: pre-device for the physical commands, pre-storage
    for the people writes (PRE_EFFECT is the merged table; the name is phase 3's)."""
    return code in PRE_DISPATCH or code in PRE_EFFECT.get(command, frozenset())


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


# ---------------------------------------------------------------- people writes (CR-005 phase 2, slice A1)

async def users_pin_generate(call: Call, user_id: str) -> dict[str, Any]:
    """`hikvision_intercom/users/pin_generate {user_id, api_contract}` - a random six-digit PIN that is free at this
    moment across WisKey's people, tombstones and retiring PINs (`repository.generate_unique_pin`); `user_id` "" for a
    person not saved yet. It is NOT reserved: the save rechecks (`pin_conflict`). A read (WisKey `users:manage`), but
    not in READ_COMMANDS, so it carries `api_contract`. Errors: `pin_generation_failed`, `user_not_found`. The value is
    a secret: the caller shows it once in the form and never logs or audits it."""
    result = _result(await call(command_type("users/pin_generate"), user_id=user_id, api_contract=API_CONTRACT), "users/pin_generate")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "users/pin_generate")
    return result


async def users_create(call: Call, data: dict[str, Any], sync_now: bool) -> Any:
    """`hikvision_intercom/users/create {data, sync_now, api_contract}` - a new person in WisKey's store (`data` keys
    within WisKey's USER_FIELDS: the caller's job). WisKey answers the person's public record; with `sync_now` it
    queues the assigned stations at once, else its periodic reconciliation (~300 s) carries the person to them."""
    if type(sync_now) is not bool:  # WisKey's strict typing (`type(x) is bool`): refused locally, nothing sent
        raise IntercomError("invalid_fields", "users/create")
    frame = await call(command_type("users/create"), data=data, sync_now=sync_now, api_contract=API_CONTRACT)
    return _action_result(frame, "users/create")


async def users_update(call: Call, user_id: str, revision: int, data: dict[str, Any], sync_now: bool) -> Any:
    """`hikvision_intercom/users/update {user_id, revision, data, sync_now, api_contract}` - a patch of one person
    (absent keys keep their value; a card with `id` and no `card_no` keeps its stored number), compare-and-set on
    `revision` (`revision_conflict`). `sync_now` queues the stations only when device-relevant fields changed."""
    if type(revision) is not int or type(sync_now) is not bool:
        raise IntercomError("invalid_fields", "users/update")
    frame = await call(command_type("users/update"), user_id=user_id, revision=revision, data=data, sync_now=sync_now, api_contract=API_CONTRACT)
    return _action_result(frame, "users/update")


async def users_delete(call: Call, user_id: str, revision: int) -> Any:
    """`hikvision_intercom/users/delete {user_id, revision, api_contract}` - the person leaves WisKey's list at once; a
    tombstone with their credentials keeps the removal pending on every station they were on (offline ones included)
    until each confirms. WisKey answers `{accepted: true}`: the device removals are queued, not done."""
    if type(revision) is not int:
        raise IntercomError("invalid_fields", "users/delete")
    frame = await call(command_type("users/delete"), user_id=user_id, revision=revision, api_contract=API_CONTRACT)
    return _action_result(frame, "users/delete")


# ---------------------------------------------------------------- card capture (CR-005 phase 2, slice A2)
# WisKey's own commands and payloads (websocket.py:197-201 COMMANDS, access/enrollment.py, client/capture.py), sent as
# WisKey's own panel sends them (panel.ts:1447-1559 through api-contract.ts `contractHass`: `api_contract` on every
# command the add-on's user is listed for - `cards/capture_status` / `_cancel` are in READ_COMMANDS, where WisKey's schema
# still accepts the optional int). The number of a collected card never leaves WisKey: `capture_status` carries only
# `CapturedCard.public()` - `{masked_number: "•••• 1234", technology, reader_id}` - and `capture_confirm` adds the card
# WisKey holds in memory to the person.

CAPTURE_READERS = range(0, 9)  # enrollment.start: `reader_id` 0..8, 0 = "omit readerID" (the station's default reader)


async def reader_capabilities(call: Call, station_id: str) -> dict[str, Any]:
    """`hikvision_intercom/cards/reader_capabilities {station_id, api_contract}` - a READ that reaches the device (identity,
    `GET /ISAPI/AccessControl/capabilities`, `GET .../CaptureCardInfo/capabilities?format=json`; WisKey's own limit 35 s):
    `{readers: [int], card_min, card_max}` (`[0]` when the station names no reader ids). Not in READ_COMMANDS, so it
    carries `api_contract`. Errors: `manager_closed`, `station_not_found`, `station_offline`,
    `station_has_no_managed_lock`, `capture_unsupported`, `device_unavailable`, `action_failed`."""
    result = _result(await call(command_type("cards/reader_capabilities"), station_id=station_id, api_contract=API_CONTRACT), "cards/reader_capabilities")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "cards/reader_capabilities")
    return result


async def capture_start(call: Call, station_id: str, user_id: str, revision: int, reader_id: int) -> Any:
    """`hikvision_intercom/cards/capture_start {station_id, user_id, revision, reader_id, api_contract}` - PHYSICAL: WisKey
    registers a session (TTL 120 s) and starts a collector that puts the station's reader into card-collection mode
    (`GET /ISAPI/AccessControl/CaptureCardInfo`, 30 s device deadline, 70 s overall). The answer is the session:
    `{session_id, station_id, user_id, revision, state: "preparing", error: null, card: null}`. Sent once, never retried."""
    if type(revision) is not int or type(reader_id) is not int or reader_id not in CAPTURE_READERS:
        raise IntercomError("invalid_fields", "cards/capture_start")  # WisKey's strict typing: refused locally, nothing sent
    frame = await call(command_type("cards/capture_start"), station_id=station_id, user_id=user_id, revision=revision, reader_id=reader_id, api_contract=API_CONTRACT)
    return _action_result(frame, "cards/capture_start")


async def capture_status(call: Call, session_id: str) -> dict[str, Any]:
    """`hikvision_intercom/cards/capture_status {session_id, api_contract}` - a READ of WisKey's in-memory session:
    `{session_id, station_id, user_id, revision, state: preparing | waiting | captured | error | applying, error, card:
    null | {masked_number, technology, reader_id}}`. An unknown, expired or foreign id is `capture_not_found`."""
    result = _result(await call(command_type("cards/capture_status"), session_id=session_id, api_contract=API_CONTRACT), "cards/capture_status")
    if not isinstance(result, dict):
        raise IntercomError("invalid_response", "cards/capture_status")
    return result


async def capture_cancel(call: Call, session_id: str) -> Any:
    """`hikvision_intercom/cards/capture_cancel {session_id, api_contract}` - drops the session and cancels the collector
    (aborting WisKey's pending reader request); `{cancelled: true}`, also for an id WisKey no longer has. The reader's
    own collection timeout is firmware-controlled (WisKey `capture_limits`): cancelling stops WisKey waiting, it is not
    proof the reader left collection mode."""
    frame = await call(command_type("cards/capture_cancel"), session_id=session_id, api_contract=API_CONTRACT)
    return _action_result(frame, "cards/capture_cancel")


async def capture_confirm(call: Call, session_id: str, label: str) -> Any:
    """`hikvision_intercom/cards/capture_confirm {session_id, label, api_contract}` - CONFIG-WRITE: WisKey adds the card
    it collected (`card_type: normalCard`, enabled) to the session's person at the session's revision, with
    `sync_now` (its default) - the card then reaches the person's assigned stations and opens their doors. Answers the
    person's public record (cards masked). WisKey drops the session afterwards, whatever the result, except when it
    refuses at once (`capture_not_found`, `capture_not_ready`, `invalid_text`)."""
    if not isinstance(label, str):
        raise IntercomError("invalid_fields", "cards/capture_confirm")
    frame = await call(command_type("cards/capture_confirm"), session_id=session_id, label=label, api_contract=API_CONTRACT)
    return _action_result(frame, "cards/capture_confirm")
