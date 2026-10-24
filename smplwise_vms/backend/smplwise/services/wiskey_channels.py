"""Per-channel WisKey command allow-lists (CR-036 S1 / S4, sections 2.1 and 5; decisions D-004 / D-006).

Arx reaches WisKey only through the add-on, over Home Assistant WebSocket sessions it opens itself. Each *channel* is a fixed
list of the WisKey commands (and the few Home Assistant frames) that may be sent through it. The list is enforced at the
session's `call` helper (`guard`), so a code path that tries to send anything else is refused before a frame is written - the
browser never names a WisKey command, and no channel is a generic proxy.

- `background`: the read-only station-health session (services/wiskey_background_feed.py). It keeps only the closed D-006
  projection; its account is meant to hold WisKey `overview: view` and nothing else.
- `service`: the add-on's own identity (SUPERVISOR_TOKEN). It is the *write channel* of D-004 (door release, call signal,
  announcement, people writes, card capture), plus the entry-center feed and the reads a write flow needs (the person
  editor's `users/get`, the announcement's engines, the card-capture status).
- `read` (S4): the adapter's READ commands (services/intercom_adapter.py) - every one a command the pinned catalog classifies
  READ, none of them a write. Same socket as `service` (the same identity), a different guard.
- `technical` (S4): four reads the catalog does NOT classify READ (they carry `api_contract` and pass WisKey's re-auth guard)
  and that the S4 source review found side-effect free (only in-memory busy markers; `technical_codes_get` reads the device
  and returns presence booleans only). Kept apart from `read` so the read channel's rule stays exact: no non-READ command.
  `stations/technical_relays` is on no list (it needs `stations: manage` and configures relays).
- `messaging` (CR-036 WA): the three WhatsApp commands the people screen's message dialog needs (services/intercom_messaging.py):
  `whatsapp/status` (is the messaging service connected, which accounts), `whatsapp/preview` (issues the one-use token that WisKey
  binds a send to; its own message text - which WisKey builds with the person's PIN in it - is NEVER read) and `whatsapp/send` (the
  text Arx rendered itself, confirmed). Not `whatsapp/history` (it returns chat content), `whatsapp/media` or the template commands
  (the template catalogue is Arx's own, edited in Settings). Same socket and identity as `service`; the SEND is a write and runs in
  the message lane of the feed (intercom_sync), the status read in the read lane.

`subscribe`, `tts/engines` and `tts/start` have their own handlers in WisKey and are absent from the static catalog
(docs/integrations/wiskey/catalog/<pin>/CONTRACT_DIFF.md); the contract tests check them separately.
"""
from __future__ import annotations

import logging
from typing import Any

from . import intercom_client, wiskey_media_contract
from .intercom_client import IntercomError

log = logging.getLogger("smplwise.intercom")

PREFIX = intercom_client.DOMAIN + "/"
NOT_ALLOWED = "not_allowed_on_channel"
RESERVED_KEY = "reserved_frame_key"
RESERVED = frozenset({"id", "type"})  # the frame's own keys (ha_client.call sets them; WisKey R4-08)

BACKGROUND = frozenset({"overview", "subscribe", "authorization/session"})

SERVICE_READS = frozenset({
    "overview", "subscribe", "authorization/session",  # the entry-center feed and the diagnostics
    "users/get",  # the person editor's read (access.people.manage; a write flow)
    "tts/engines", "cards/capture_status",  # reads that belong to a write flow
})
SERVICE_WRITES = frozenset({
    "stations/test_unlock", "media/signal", "tts/start",  # physical actions (the door: access.doors.open; calls / announcements: access.call)
    "users/create", "users/update", "users/delete", "users/pin_generate",  # person editor (access.people.manage)
    "cards/reader_capabilities", "cards/capture_start", "cards/capture_cancel", "cards/capture_confirm",  # card capture
    # CR-036 S11: the person writes the editor did not have (access.people.manage on the person's stations)
    "users/archive", "users/unarchive", "users/set_active", "users/temporary_cancel", "cards/add", "cards/remove",
})
SERVICE = SERVICE_READS | SERVICE_WRITES

# CR-036 S4: exactly the commands services/intercom_adapter.py sends (CHANNEL_OF there; tests/test_intercom_adapter.py
# checks both directions), each a READ command in the pinned catalog.
READ = frozenset({
    "users/query", "users/get", "users/photo_get",
    "events/list", "events/detail", "events/export",
    "profiles/settings_get", "profiles/versions",
    "schedules/list", "schedules/plan_list", "schedules/operations_list",
    "health/get", "sync/status", "conflicts/list", "fleet/alerts", "audit/list",
})
# CR-036 S4: the reviewed non-READ reads (see the module note); `api_contract` on every frame.
TECHNICAL = frozenset({
    "stations/technical_program_list", "stations/technical_hold_get", "stations/technical_codes_get", "health/history",
})
# CR-036 WA: the message dialog's commands. All three are non-READ in the pinned catalog (so `api_contract` goes on every frame);
# `whatsapp/preview` and `whatsapp/send` need `users: manage` in WisKey, `whatsapp/status` `users: view`.
MESSAGING = frozenset({"whatsapp/status", "whatsapp/preview", "whatsapp/send"})
# CR-WISKEY-LEASE-REVOCATION-EVENT L5: the capture-lease route's four SIGNED actions (protocol wiskey-capture-lease-v1). NOT a
# WebSocket channel - they leave through the bridge's trusted-caller transport (services/lease_events.py), never through a
# guarded `call`, so they are deliberately absent from ALLOWLISTS; the classic `cards/capture_*` WS commands stay on `service`.
LEASE_SIGNED = frozenset({"capture_start", "capture_status", "capture_confirm", "capture_cancel"})
# ECCACT-295: the readback channel - WisKey's Mac-delivered candidate READS (round 11, `arx_preview_features.CANDIDATE_READS`):
# `users/access_state` (v1), `users/access_state_v2` and `schedules/normalize_user`. They are NOT in the pinned static catalog
# (they were added after the pin), so the catalog-membership test skips this channel; every one is a read that WisKey admits only for
# an active administrator while its build gate is on, and WisKey lists it in `overview.api.commands` only then (capability negotiation,
# services/wiskey_readback.py). No write is on it. Same socket and identity as `service`.
READBACK = frozenset({"users/access_state", "users/access_state_v2", "schedules/normalize_user"})
# PACING12-295: WisKey's pacing envelope (`whatsapp_pacing_status_v1`), a READ specified on WisKey's side after the pin. The adapter sends it
# only when WisKey's discovery (`overview.api.commands`) lists it (services/intercom_messaging_adapter.py `refresh_pacing`); it is on its own
# channel so that the messaging channel stays exactly the pinned three and nothing else can ride the pacing guard.
PACING = frozenset({"whatsapp/pacing_status_v1"})
# WKDIRECT-295 (S6): the `media` channel of AVW10-295 is REMOVED. WisKey's six W10 commands are no channel's allow-list any more: they
# leave Arx only as signed `bridge` envelopes (services/wiskey_media_bridge.py - the direct API or the signed Home Assistant path), never
# as an unsigned frame on the feed's session. `W10_COMMANDS` names them so a test can prove no guard lets one through.
W10_COMMANDS = frozenset(wiskey_media_contract.COMMANDS)
UNPINNED_CHANNELS = frozenset({"readback", "pacing"})

ALLOWLISTS: dict[str, frozenset[str]] = {"background": BACKGROUND, "service": SERVICE, "read": READ, "technical": TECHNICAL, "messaging": MESSAGING,
                                         "readback": READBACK, "pacing": PACING}
ADAPTER_CHANNELS = ("read", "technical", "messaging", "readback", "pacing")  # the guards the service session builds for the adapters (intercom_sync on_ready)

# Home Assistant's own frames a channel may send besides WisKey commands (the auth handshake is written by ha_client itself):
# `get_config` tells "WisKey not loaded yet" from "not installed"; the service feed watches the stations' entities.
HA_FRAMES: dict[str, frozenset[str]] = {
    "background": frozenset({"get_config"}),
    "service": frozenset({"get_config", "subscribe_entities", "unsubscribe_events"}),
    "read": frozenset(),
    "technical": frozenset(),
    "messaging": frozenset(),
    "readback": frozenset(),
    "pacing": frozenset(),
}


def allowed(channel: str, msg_type: str) -> bool:
    """Whether `msg_type` (a full WebSocket `type`) may be sent on `channel`. An unknown channel allows nothing."""
    if msg_type.startswith(PREFIX):
        return msg_type[len(PREFIX):] in ALLOWLISTS.get(channel, frozenset())
    return msg_type in HA_FRAMES.get(channel, frozenset())


def guard(call: intercom_client.Call, channel: str) -> intercom_client.Call:
    """`call` wrapped so that only `channel`'s allow-list can be sent. A refused frame raises IntercomError
    (`not_allowed_on_channel`) before anything is written to the socket; that is a programming error, logged once per send
    with the command name only."""
    if channel not in ALLOWLISTS:
        raise ValueError(f"unknown WisKey channel {channel!r}")

    async def guarded(msg_type: str, **kw: Any) -> dict[str, Any]:
        if RESERVED.intersection(kw):  # R4-08: a top-level `type` / `id` would replace the checked type or the generated id on the wire
            log.error("WisKey %s channel: refused a frame carrying a reserved key (%s)", channel, ",".join(sorted(RESERVED.intersection(kw))))
            raise IntercomError(RESERVED_KEY, msg_type if isinstance(msg_type, str) else "")
        if not isinstance(msg_type, str) or not allowed(channel, msg_type):
            log.error("WisKey %s channel: refused to send %s (not on the channel's allow-list)", channel, msg_type)
            raise IntercomError(NOT_ALLOWED, msg_type)
        return await call(msg_type, **kw)

    guarded.channel = channel  # type: ignore[attr-defined]
    return guarded


def describe() -> dict[str, Any]:
    """The allow-lists as the diagnostics view shows them (sorted command names; `writes` = the service channel's writes)."""
    return {
        "background": sorted(BACKGROUND),
        "service": {"reads": sorted(SERVICE_READS), "writes": sorted(SERVICE_WRITES)},
        "read": {"commands": sorted(READ), "in_use": True},
        "technical": {"commands": sorted(TECHNICAL), "in_use": True},
        "messaging": {"commands": sorted(MESSAGING), "in_use": True},
        "readback": {"commands": sorted(READBACK), "in_use": True},
        "pacing": {"commands": sorted(PACING), "in_use": True},
    }
