"""WisKey tab (CR-005, access control through the owner's `hikvision_intercom` integration).

SMPLWISE's browser never talks to Home Assistant: these endpoints check SMPLWISE's own permission first and serve
what services/intercom_sync.py read from WisKey over HA's WebSocket API. Phase 1a: the read-only entry center
(`access.read`), with each station camera's still grabbed through go2rtc; phase 1b: the read-only activity log and people directory, same permission (CR-005 §3).

Phase 3 (owner-approved per capability, 2026-09-27): three PHYSICAL actions, each gated on `access.release` at
installation scope - door release (`stations/test_unlock`), call answer / reject / hang up (`media/signal`) and a spoken
announcement (`tts/engines` + `tts/start`). They ride the feed's own Home Assistant session (IntercomSync.action),
are never queued or retried, and carry a command id and an expiry. Once the caller holds `access.release`, every
request to them is written to SMPLWISE's audit log under the real SMPLWISE actor: a refusal as one row, a command sent
to WisKey as an attempt row committed before sending plus an outcome row (see the section note below). WisKey's own
log sees only the add-on's single HA user (CR-005 §3, "Accountability gap and its mitigation").

Phase 2, slice A1 (owner decision 2026-09-28): the person editor - the first WRITE to WisKey's people store this
product makes - gated on `access.people.manage` (site_admin + system_admin by default, sensitive, grantable per person
through a custom role). Its endpoints reuse the physical actions' write path unchanged (permission before body, JSON
only, envelope, attempt / outcome audit) in the feed's config lane, and serve an editor projection of their own that
is never served under `access.read`. Door technical settings, schedules and photos do not live here yet.

Phase 2, slice A2 (owner decision 2026-09-28): card capture from a station's reader - `access.cards.capture` on top of
`access.people.manage`, WisKey's own capture commands, sessions owned by the SMPLWISE user who started them
(services/intercom_capture.py); see the card-capture section note below.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): the 2,100 lines that lived here are split along their section comments into
sibling modules, moved unchanged - access_control_base (permissions, read gates), _entry (read side), _stills, _credentials,
_command (the shared write path: envelope, `_Action`, `_perform`, the relay guard), _door (the release route and the one door
path), _calls, _people (the person editor), _capture (card capture and the capture lease), _ws - and the person draft models
into services/access_control_core.py (review 05:P2-09). This module is what it was for every importer: `router` carries the same
routes in the same order (the parts are included in their old order) and every name is re-exported below. New code imports
from the part itself; a test that replaces a module-level value patches the part that reads it."""
from __future__ import annotations

from fastapi import APIRouter

from ..services.access_control_core import (
    CardData, IDENTIFIER, MAX_ASSIGNMENTS, MAX_CARDS, PERIOD_MAX, PERIOD_MIN, PERSON, PHONE, PIN_PATTERN, PersonData, UUID_TEXT, _no_control,
    _station_key,
)
from . import access_control_calls, access_control_capture, access_control_credentials, access_control_door, access_control_entry, access_control_people, access_control_stills, access_control_ws
from ._common import raw_body as _raw_body
from .access_control_base import (
    CAPTURE, CREDENTIALS, DOOR_OPEN, MANAGE, MAX_PAGE, MAX_STATION_ID, PIN_GENERATE, READ, RECHECK_S, RELEASE, _credentials_admin,
    _credentials_admin_ro, _gate, _instant, _reader_ro, _visible_stations, log,
)
from .access_control_calls import (
    call_signal, tts_engines, tts_speak,
)
from .access_control_capture import (
    CAPTURE_NOTE, CaptureCancelBody, CaptureConfirmBody, CaptureStartBody, _capture_or_refuse, _capture_starter_ro, _capturer_ro, _gate_refusal,
    _lease_cancel, _lease_confirm, _lease_confirm_admitted, _lease_redecide, _lease_refused, _lease_start, card_capture_cancel, card_capture_confirm,
    card_capture_start, card_capture_status, card_readers, intercom_client_text, lease_events_request_id,
)
from .access_control_command import (
    CALL_LIMIT_S, COMMAND_ID, CallBody, CommandEnvelope, DEDUPE_WINDOW_S, EXPIRY_MAX_S, GUARD_MAX_S, ORIGIN_RE, RELAYS, ReleaseBody, SEND_WITHIN_S,
    TTS_FIXED_ENGINE_KEY, TTS_LENGTH_BUCKETS, TtsBody, UNKNOWN_HOLD_S, _Action, _Relay, _RelayGuard, _call_station, _caller, _caller_ro,
    _door_gate_ro, _envelope, _parse, _perform, _relay_of, _station, tts_engine_choice, tts_length_bucket,
)
from .access_control_credentials import (
    StationCredentials, _credentials_body, _drop_still, _parse_credentials, _refuse_credentials, clear_station_credentials, set_station_credentials,
    station_credentials, stations_credentials,
)
from .access_control_door import (
    _NOT_SENT_CODES, _NOT_SENT_ERRORS, _door_details, _perform_signed, open_door, open_from_tile, release,
)
from .access_control_entry import (
    background, diagnostics, events, overview, people, person,
)
from .access_control_people import (
    PersonDeleteBody, PersonSaveBody, PersonUpdateBody, PinGenerateBody, RATE_LIMITED_CODE, SAVE_NOTE, _person_summary, _write_summary, gated,
    native_targets, people_editor_context, people_send, people_writer, person_create, person_delete, person_editor, person_pin_generate, person_update,
)
from .access_control_stills import (
    _read_still, _still_path, _store_still, camera_snapshot,
)
from .access_control_ws import (
    intercom_ws,
)

# the parts that declare routes, in the old route order (a test that walks this router's routes walks these)
PARTS = (access_control_entry.router, access_control_stills.router, access_control_credentials.router, access_control_door.router,
         access_control_calls.router, access_control_people.router, access_control_capture.router, access_control_ws.router)
router = APIRouter()
for _part in PARTS:
    router.include_router(_part)
del _part  # (the loop name must not stay bound: a module walk would read the last part's router as this module's)

__all__ = [
    "PARTS", "CALL_LIMIT_S", "CAPTURE", "CAPTURE_NOTE", "COMMAND_ID", "CREDENTIALS", "CallBody", "CaptureCancelBody", "CaptureConfirmBody", "CaptureStartBody",
    "CardData", "CommandEnvelope", "DEDUPE_WINDOW_S", "DOOR_OPEN", "EXPIRY_MAX_S", "GUARD_MAX_S", "IDENTIFIER", "MANAGE", "MAX_ASSIGNMENTS",
    "MAX_CARDS", "MAX_PAGE", "MAX_STATION_ID", "ORIGIN_RE", "PERIOD_MAX", "PERIOD_MIN", "PERSON", "PHONE", "PIN_GENERATE", "PIN_PATTERN",
    "PersonData", "PersonDeleteBody", "PersonSaveBody", "PersonUpdateBody", "PinGenerateBody", "RATE_LIMITED_CODE", "READ", "RECHECK_S", "RELAYS",
    "RELEASE", "ReleaseBody", "SAVE_NOTE", "SEND_WITHIN_S", "StationCredentials", "TTS_FIXED_ENGINE_KEY", "TTS_LENGTH_BUCKETS", "TtsBody",
    "UNKNOWN_HOLD_S", "UUID_TEXT", "_Action", "_NOT_SENT_CODES", "_NOT_SENT_ERRORS", "_Relay", "_RelayGuard", "_call_station", "_caller",
    "_caller_ro", "_capture_or_refuse", "_capture_starter_ro", "_capturer_ro", "_credentials_admin", "_credentials_admin_ro", "_credentials_body",
    "_door_details", "_door_gate_ro", "_drop_still", "_envelope", "_gate", "_gate_refusal", "_instant", "_lease_cancel", "_lease_confirm",
    "_lease_confirm_admitted", "_lease_redecide", "_lease_refused", "_lease_start", "_no_control", "_parse", "_parse_credentials", "_perform",
    "_perform_signed", "_person_summary", "_raw_body", "_read_still", "_reader_ro", "_refuse_credentials", "_relay_of", "_station", "_station_key",
    "_still_path", "_store_still", "_visible_stations", "_write_summary", "background", "call_signal", "camera_snapshot", "card_capture_cancel",
    "card_capture_confirm", "card_capture_start", "card_capture_status", "card_readers", "clear_station_credentials", "diagnostics", "events",
    "gated", "intercom_client_text", "intercom_ws", "lease_events_request_id", "log", "native_targets", "open_door", "open_from_tile", "overview",
    "people", "people_editor_context", "people_send", "people_writer", "person", "person_create", "person_delete", "person_editor",
    "person_pin_generate", "person_update", "release", "router", "set_station_credentials", "station_credentials", "stations_credentials",
    "tts_engine_choice", "tts_engines", "tts_length_bucket", "tts_speak",
]
