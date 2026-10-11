"""CR-036 S0/S1: the per-channel WisKey command allow-lists (services/wiskey_channels.py) against the pinned catalog, the guard
that enforces them on each live session, and the closed background projection against WisKey's pinned D-006 schema.

No device, Home Assistant or WisKey is contacted (tests/fake_wiskey.py)."""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

import pytest
from fake_wiskey import PIN_DIR, SEPARATE_HANDLERS
from test_fake_wiskey import wait_for, wiskey  # noqa: F401 - `wiskey` is a fixture

from smplwise.services import intercom_client, intercom_sync, wiskey_background, wiskey_channels as ch

COMMANDS = json.loads((PIN_DIR / "commands.static.json").read_text(encoding="utf-8"))["commands"]
D006 = json.loads((PIN_DIR / "background-summary.proposed.schema.json").read_text(encoding="utf-8"))


def is_read(command: str) -> bool:
    return COMMANDS[command]["permission"]["read_command_for_security_guard_and_api_contract"] is True


# ---------------------------------------------------------------- the lists against the catalog

@pytest.mark.parametrize("channel", sorted(ch.ALLOWLISTS))
def test_every_command_of_every_channel_exists_in_the_pinned_catalog(channel: str):
    for command in ch.ALLOWLISTS[channel]:
        assert command in COMMANDS or command in SEPARATE_HANDLERS, f"{channel}: {command} is not a WisKey command"


@pytest.mark.parametrize("channel", ["background", "read"])
def test_a_read_only_channel_holds_no_write(channel: str):
    for command in ch.ALLOWLISTS[channel]:
        if command in SEPARATE_HANDLERS:
            assert command == "subscribe", f"{channel}: {command} is a separate handler that acts (tts) - not on a read channel"
            continue
        assert is_read(command), f"{channel}: {command} is not a READ command in the pinned catalog"
    assert not (ch.ALLOWLISTS[channel] & ch.SERVICE_WRITES), "no service-channel write on a read channel"


def test_the_background_channel_is_exactly_overview_subscribe_and_the_session_read():
    assert ch.BACKGROUND == {"overview", "subscribe", "authorization/session"}
    assert ch.HA_FRAMES["background"] == {"get_config"}


def test_every_non_read_command_on_the_service_channel_is_declared_a_write():
    for command in ch.SERVICE:
        if command in COMMANDS and not is_read(command):
            assert command in ch.SERVICE_WRITES, f"{command} is non-READ in the catalog but listed as a service read"
    assert "tts/start" in ch.SERVICE_WRITES, "a spoken announcement acts on the station"
    assert not (ch.SERVICE_READS & ch.SERVICE_WRITES)


def test_every_command_the_client_can_send_is_on_the_service_channel():
    source = Path(intercom_client.__file__).read_text(encoding="utf-8")
    literals = set(re.findall(r'command_type\("([a-z_/]+)"\)', source))
    assert literals and literals <= ch.SERVICE, sorted(literals - ch.SERVICE)


def test_the_read_channel_is_not_in_use_yet():
    """Slice S4 builds the read channel's session; until then nothing may open one (the list only pins the rule)."""
    backend = Path(intercom_client.__file__).resolve().parents[1]
    users = [p.name for p in backend.rglob("*.py") if re.search(r'guard\([^)]*"read"\)', p.read_text(encoding="utf-8"))]
    assert users == []
    assert ch.describe()["read"]["in_use"] is False


# ---------------------------------------------------------------- the guard

class Recorder:
    def __init__(self) -> None:
        self.frames: list[dict[str, Any]] = []

    async def __call__(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        self.frames.append({"type": msg_type, **kw})
        return {"id": len(self.frames), "type": "result", "success": True, "result": {}}


def send(channel: str, msg_type: str, **kw: Any) -> tuple[Recorder, BaseException | None]:
    rec = Recorder()
    guarded = ch.guard(rec, channel)
    try:
        asyncio.run(guarded(msg_type, **kw))
        return rec, None
    except intercom_client.IntercomError as exc:
        return rec, exc


@pytest.mark.parametrize("command", ["stations/test_unlock", "media/signal", "tts/start", "users/update", "users/delete", "users/create",
                                     "users/pin_generate", "cards/capture_start", "cards/capture_confirm", "events/list", "users/get", "users/query"])
def test_the_background_guard_refuses_before_writing_a_frame(command: str):
    rec, exc = send("background", ch.PREFIX + command, station_id="entry-a")
    assert isinstance(exc, intercom_client.IntercomError) and exc.code == ch.NOT_ALLOWED and rec.frames == []


def test_the_guards_let_their_own_lists_through_and_nothing_else():
    for channel, commands in ch.ALLOWLISTS.items():
        for command in commands:
            rec, exc = send(channel, ch.PREFIX + command)
            assert exc is None and len(rec.frames) == 1, (channel, command)
        for frame_type in ch.HA_FRAMES[channel]:
            assert send(channel, frame_type)[1] is None
    for frame_type in ("call_service", "auth/current_user", "config/auth/create", "hikvision_intercom/platform/import"):
        for channel in ch.ALLOWLISTS:
            rec, exc = send(channel, frame_type)
            assert exc is not None and rec.frames == [], (channel, frame_type)
    with pytest.raises(ValueError):
        ch.guard(Recorder(), "anything")


def test_both_live_sessions_carry_their_guard(wiskey):
    from dataclasses import replace

    fake, _app, s, _c, wbf = wiskey
    s2 = replace(s, wiskey_background_token="bg-token")
    intercom_sync.SYNC.start(s2)
    wbf.FEED.start(s2)
    wait_for(lambda: wbf.FEED.status["state"] == "ready" and intercom_sync.STATE.state == "ready")
    assert getattr(intercom_sync.SYNC._call, "channel", None) == "service"
    assert getattr(wbf.FEED._call, "channel", None) == "background"
    # a write forced onto the background session is refused at the guard, and the fake never sees it
    code, _ = wbf.FEED.command("authorization/session", lambda call: intercom_client.release_door(call, "entry-a", 1))
    assert code == ch.NOT_ALLOWED
    bg_socket = next(sock for sock in fake.sockets if sock.token == "bg-token")
    assert not any(m.get("type") == ch.PREFIX + "stations/test_unlock" for m in bg_socket.sent)


# ---------------------------------------------------------------- the background projection against WisKey's pinned D-006 schema

def check(value: Any, schema: dict[str, Any], path: str = "$") -> None:
    """The subset of JSON Schema the pinned D-006 file uses (type, const, required, additionalProperties, properties, items,
    minimum, minLength, pattern); written out here so no validator dependency is added."""
    if "const" in schema:
        assert value == schema["const"], path
    kinds = schema.get("type")
    if kinds is not None:
        kinds = kinds if isinstance(kinds, list) else [kinds]
        ok = any(
            (k == "object" and isinstance(value, dict)) or (k == "array" and isinstance(value, list)) or (k == "string" and isinstance(value, str))
            or (k == "integer" and isinstance(value, int) and not isinstance(value, bool)) or (k == "boolean" and isinstance(value, bool)) or (k == "null" and value is None)
            for k in kinds
        )
        assert ok, f"{path}: {value!r} is not {kinds}"
    if isinstance(value, dict):
        for key in schema.get("required", []):
            assert key in value, f"{path}: missing {key}"
        props = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            assert set(value) <= set(props), f"{path}: extra keys {sorted(set(value) - set(props))}"
        for key, sub in props.items():
            if key in value:
                check(value[key], sub, f"{path}.{key}")
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            check(item, schema["items"], f"{path}[{i}]")
    if isinstance(value, int) and not isinstance(value, bool) and "minimum" in schema:
        assert value >= schema["minimum"], path
    if isinstance(value, str):
        if "minLength" in schema:
            assert len(value) >= schema["minLength"], path
        if "pattern" in schema:
            assert re.search(schema["pattern"], value), f"{path}: {value!r} !~ {schema['pattern']}"


def test_the_pinned_d006_schema_is_the_one_arx_builds():
    assert D006["required"] == list(wiskey_background.BACKGROUND_KEYS)
    assert D006["properties"]["stations"]["items"]["required"] == list(wiskey_background.BACKGROUND_STATION_KEYS)


def test_the_projection_from_the_fake_conforms_to_the_pinned_d006_schema():
    from fake_wiskey import FakeWiskey

    for identity in ("admin", "background"):
        fake = FakeWiskey(identity)
        for drift in (False, True):
            fake.drift = drift
            raw = fake.respond({"id": 1, "type": ch.PREFIX + "overview"})[0]["result"]
            projection = wiskey_background.project_background(raw)
            wiskey_background.assert_closed(projection)
            check(projection, D006)
            assert "Dana" not in json.dumps(projection) and "x_unknown" not in json.dumps(projection)
