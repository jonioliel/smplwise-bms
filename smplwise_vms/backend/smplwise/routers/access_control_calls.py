"""WisKey tab: call signalling and the spoken announcement (`access.call` on the station's chain).

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..auth import get_conn, get_read_conn, settings_of
from ..db import unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_client, intercom_sync
from ._common import raw_body as _raw_body
from .access_control_command import CallBody, TtsBody, _Action, _call_station, _caller, _caller_ro, _envelope, _parse, _perform, _station, tts_engine_choice, tts_length_bucket

router = APIRouter()


@router.post("/intercom/stations/{station_id}/call")
def call_signal(request: Request, station_id: str, principal: Principal = Depends(_caller_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Answer / reject a ringing call or hang up a call in progress (WisKey `media/signal`). Body: `{command,
    client_request_id, expires_at}`. Permission (2.4.9): `access.call` anywhere a station can be at the gate, then on this
    station's chain. WisKey checks the call state on the device itself and refuses a mismatch
    (`device_unavailable`), so SMPLWISE does not second-guess it from its own copy, which can lag a ring by a moment.
    The reply's `call` is WisKey's result as sent: `acknowledged` (true, or null when the device's answer was lost),
    `observed_state` / `observation` after the signal, and `physical_result: "unverified"`. Refusals and outcomes are
    audited like a release. Reply: `{state, configured, last_error, fetched_at, call, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.call", station_id)
    body: CallBody = _parse(act, CallBody, raw)
    act.details["signal"] = body.command
    not_after = _envelope(act, body)
    _call_station(act)
    _station(act)
    reply = _perform(act, "call", lambda call: intercom_client.media_signal(call, station_id, body.command), intercom_sync.project_signal, not_after)
    from ..services import intercom_calls  # WISKEY-INBOUND-CALLS-2382: who answered / rejected / hung up, for the call log (never raises)

    intercom_calls.note_command(station_id, body.command, principal, reply.get("call"))
    return reply


@router.get("/intercom/tts/engines")
def tts_engines(request: Request, principal: Principal = Depends(_caller), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """Home Assistant's TTS engines WisKey can speak through (`tts/engines`, a read): `{state, configured, last_error,
    fetched_at, tts, sync}` with `tts = {default, engines: [{engine_id, name, supported_languages, default_language}]}`,
    null unless `state` is `ready`. Gated like the announcement itself (WisKey gates it at manage level too)."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "tts", intercom_client.tts_engines, intercom_sync.project_tts_engines, who=principal.user_id)


@router.post("/intercom/stations/{station_id}/tts")
def tts_speak(request: Request, station_id: str, principal: Principal = Depends(_caller_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Speak `message` through the station's speaker (WisKey `tts/start`). Body: `{engine_id, language, message,
    client_request_id, expires_at}`. Permission (2.4.9): `access.call` anywhere at the gate, then on this station's chain
    (an announcement to several stations is one request per station, each judged). The text goes to the Home Assistant TTS engine `engine_id` - which may be a cloud
    provider, so the text can leave the premises. SMPLWISE's audit rows (refused requests too) hold the envelope only:
    the station (the row's resource), the engine, the language, a length bucket of the collapsed text (`length_bucket`,
    TTS_LENGTH_BUCKETS) and the outcome - never the text itself (2.4.10, TTSLOG). The reply's `tts` is the
    announcement's progress when WisKey took it (`started`, or already `generating` / ...); later progress arrives as
    `intercom_tts` notices on /intercom/ws, ending in `completed` (`physical_result: "unverified"`) or `closed` with a
    reason. Reply: `{state, configured, last_error, fetched_at, tts, sync, command_id}`."""
    act = _Action(request, conn, principal, "intercom.tts", station_id)
    body: TtsBody = _parse(act, TtsBody, raw)
    message = intercom_client.collapse(body.message)
    act.details.update(engine_id=body.engine_id, language=body.language, length_bucket=tts_length_bucket(len(message)), engine_choice=tts_engine_choice(conn, body.engine_id))
    if not 1 <= len(message) <= intercom_client.TTS_MESSAGE_MAX:
        raise act.refuse(ApiError(422, "validation", f"ההודעה חייבת להכיל 1-{intercom_client.TTS_MESSAGE_MAX} תווים."))
    not_after = _envelope(act, body)
    _call_station(act)
    _station(act)
    language = body.language
    return _perform(act, "tts", lambda call: intercom_sync.SYNC.tts_start(call, station_id, body.engine_id, language, message), lambda status: status, not_after)
