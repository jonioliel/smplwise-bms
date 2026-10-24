"""WisKey contract tests (B0, decision D-005): Arx's own client against the pinned `rc37-contract.4` catalogs.

The catalogs (docs/integrations/wiskey/catalog/rc37-contract.4) are a static extraction of WisKey's command registry:
top-level request keys and base permission classes only, no nested schemas, no authorization oracle, no error mapping
(see their CONTRACT_DIFF.md). So these tests prove exactly one thing about each command Arx sends: it exists in the
catalog, every key Arx puts in the frame is a key the request schema lists, every required key is there, the primitive
types agree, and `api_contract` is sent on every command the catalog does not classify as READ. They do not prove that
a command is allowed for a given user, that a nested value is valid, or that WisKey would accept a write.

The contract-diff tool (scripts/wiskey_contract_diff.py) is exercised here too, against mutated copies of the pin."""
from __future__ import annotations

import asyncio
import copy
import importlib.util
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import intercom_client

ROOT = Path(__file__).resolve().parents[3]
PIN = ROOT / "docs" / "integrations" / "wiskey" / "catalog" / "rc37-contract.4"

_spec = importlib.util.spec_from_file_location("wiskey_contract_diff", ROOT / "scripts" / "wiskey_contract_diff.py")
assert _spec and _spec.loader
tool = importlib.util.module_from_spec(_spec)
sys.modules["wiskey_contract_diff"] = tool
_spec.loader.exec_module(tool)

COMMANDS = json.loads((PIN / "commands.static.json").read_text(encoding="utf-8"))["commands"]
PREFIX = intercom_client.DOMAIN + "/"

# Commands with their own handlers: not in `api.commands`, therefore not in the static catalog (CONTRACT_DIFF.md).
SEPARATE_HANDLERS = {"subscribe", "tts/engines", "tts/start"}


# ---------------------------------------------------------------- the pin itself

def test_pin_is_intact_and_matches_the_delivery_record():
    assert tool.verify_pin(PIN) == []
    pin = json.loads((PIN / "PIN.json").read_text(encoding="utf-8"))
    assert pin["runtime_version"] == "2.0.0-rc.37" and pin["source_commit"].startswith("909579e")
    assert pin["files"]["commands.static.json"]["count"] == 238 and pin["files"]["errors.static.json"]["count"] == 301
    loaded = tool.load(PIN)
    assert len(loaded["commands"]) == 238 and len(loaded["errors"]) == 301
    note = (PIN / "CONTRACT_DIFF.md").read_text(encoding="utf-8")
    for needle in (pin["source_commit"], pin["files"]["commands.static.json"]["sha256"], pin["files"]["errors.static.json"]["sha256"], "not an authorization oracle", "not approval to write"):
        assert needle.lower() in note.lower(), needle
    assert "MIT License" in (PIN / "LICENSE").read_text(encoding="utf-8")


# ---------------------------------------------------------------- the diff tool (D-005)

def _copy_pin(tmp_path: Path) -> Path:
    folder = tmp_path / "candidate"
    shutil.copytree(PIN, folder)
    return folder


def _edit(folder: Path, name: str, change: Any) -> None:
    path = folder / name
    doc = json.loads(path.read_text(encoding="utf-8"))
    change(doc)
    path.write_text(json.dumps(doc), encoding="utf-8")


def test_identical_catalogs_are_a_clean_diff():
    report = tool.diff(tool.load(PIN), tool.load(PIN))
    assert report["exit_code"] == 0 and report["identical_files"] and not report["breaking"] and not report["changes"]
    assert tool.main(["--verify", "--candidate", str(PIN)]) == 0


def test_a_delivery_root_with_a_schemas_folder_is_found(tmp_path):
    root = tmp_path / "delivery"
    (root / "schemas").mkdir(parents=True)
    for name in (tool.COMMANDS_FILE, tool.ERRORS_FILE):
        shutil.copy(PIN / name, root / "schemas" / name)
    assert tool.main(["--candidate", str(root)]) == 0


def test_added_commands_and_errors_are_changes_not_breaking(tmp_path):
    folder = _copy_pin(tmp_path)

    def add_command(doc: dict[str, Any]) -> None:
        doc["commands"]["background/summary"] = copy.deepcopy(doc["commands"]["overview"])
        doc["count"] += 1

    def add_error(doc: dict[str, Any]) -> None:
        doc["errors"]["brand_new_code"] = {"source_locations": ["x.py:1"], "retry": "unclassified", "ui": "x"}
        doc["count"] += 1

    _edit(folder, tool.COMMANDS_FILE, add_command)
    _edit(folder, tool.ERRORS_FILE, add_error)
    report = tool.diff(tool.load(PIN), tool.load(folder))
    assert report["commands_added"] == ["background/summary"] and report["errors_added"] == ["brand_new_code"]
    assert report["exit_code"] == 1 and report["breaking"] == []


def test_removal_or_required_key_or_permission_or_read_change_needs_review(tmp_path):
    cases: dict[str, Any] = {
        "command removed": lambda d: (d["commands"].pop("users/get"), d.update(count=d["count"] - 1)),
        "required key added": lambda d: d["commands"]["users/get"]["request"]["required"].append("extra"),
        "required key removed": lambda d: d["commands"]["users/get"]["request"]["required"].remove("user_id"),
        "permission changed": lambda d: d["commands"]["users/get"]["permission"].update(administrator_only_by_base_mapping=True),
        "area grants changed": lambda d: d["commands"]["overview"]["permission"].update(alternative_area_grants=[["users", "manage"]]),
        "read flipped": lambda d: d["commands"]["stations/test_unlock"]["permission"].update(read_command_for_security_guard_and_api_contract=True),
        "property removed": lambda d: d["commands"]["users/get"]["request"]["properties"].pop("api_contract"),
    }
    for label, change in cases.items():
        folder = tmp_path / label.replace(" ", "_")
        shutil.copytree(PIN, folder)
        _edit(folder, tool.COMMANDS_FILE, change)
        report = tool.diff(tool.load(PIN), tool.load(folder))
        assert report["exit_code"] == 2 and report["breaking"], label
        assert tool.main(["--candidate", str(folder)]) == 2, label
    folder = tmp_path / "error_removed"
    shutil.copytree(PIN, folder)
    _edit(folder, tool.ERRORS_FILE, lambda d: (d["errors"].pop("access_denied"), d.update(count=d["count"] - 1)))
    assert tool.diff(tool.load(PIN), tool.load(folder))["exit_code"] == 2


def test_a_changed_pin_file_fails_verification(tmp_path):
    folder = _copy_pin(tmp_path)
    (folder / tool.ERRORS_FILE).write_bytes((folder / tool.ERRORS_FILE).read_bytes() + b" ")
    assert any("SHA-256" in p for p in tool.verify_pin(folder))
    assert tool.main(["--verify", "--pinned", str(folder)]) == 3


def test_a_count_that_disagrees_with_the_content_is_refused(tmp_path):
    folder = _copy_pin(tmp_path)
    _edit(folder, tool.COMMANDS_FILE, lambda d: d.update(count=d["count"] + 5))
    with pytest.raises(tool.CatalogError):
        tool.load(folder)
    assert tool.main(["--candidate", str(folder)]) == 3


# ---------------------------------------------------------------- Arx's client against the catalog

class Recorder:
    """The `call(type, **kw)` helper `ha_client.ws_session` hands out, recording the frame it would send and answering
    success with an empty object (enough for every typed function to return)."""

    def __init__(self) -> None:
        self.frames: list[dict[str, Any]] = []

    async def __call__(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        frame = {"id": len(self.frames) + 1, "type": msg_type, **kw}
        self.frames.append(frame)
        return {"id": frame["id"], "type": "result", "success": True, "result": {}}


# one representative call of every typed function in intercom_client; the frame it sends is what the catalog judges
CLIENT_CALLS: dict[str, Any] = {
    "overview": lambda c: intercom_client.overview(c),
    "authorization/session": lambda c: intercom_client.authorization_session(c),
    "users/get": lambda c: intercom_client.users_get(c, "u1"),
    "stations/test_unlock": lambda c: intercom_client.release_door(c, "s1", 1),
    "media/signal": lambda c: intercom_client.media_signal(c, "s1", "answer"),
    "users/pin_generate": lambda c: intercom_client.users_pin_generate(c, "u1"),
    "users/create": lambda c: intercom_client.users_create(c, {"display_name": "Test"}, True),
    "users/update": lambda c: intercom_client.users_update(c, "u1", 3, {"active": False}, False),
    "users/delete": lambda c: intercom_client.users_delete(c, "u1", 3),
    "cards/reader_capabilities": lambda c: intercom_client.reader_capabilities(c, "s1"),
    "cards/capture_start": lambda c: intercom_client.capture_start(c, "s1", "u1", 3, 0),
    "cards/capture_status": lambda c: intercom_client.capture_status(c, "sess1"),
    "cards/capture_cancel": lambda c: intercom_client.capture_cancel(c, "sess1"),
    "cards/capture_confirm": lambda c: intercom_client.capture_confirm(c, "sess1", "Label"),
    # CR-036 S11: the person writes the editor did not have
    "users/archive": lambda c: intercom_client.users_archive(c, "u1", 3, True),
    "users/unarchive": lambda c: intercom_client.users_archive(c, "u1", 3, False),
    "users/set_active": lambda c: intercom_client.users_set_active(c, "u1", 3, False),
    "users/temporary_cancel": lambda c: intercom_client.users_temporary_cancel(c, "u1", 3, "visit_completed"),
    "cards/add": lambda c: intercom_client.cards_add(c, "u1", 3, {"card_no": "A1", "label": "", "card_type": "normalCard", "enabled": True}),
    "cards/remove": lambda c: intercom_client.cards_remove(c, "u1", 3, "card-1"),
    # separate handlers: still driven, to pin the exact key sets WisKey's own handlers check
    "subscribe": lambda c: intercom_client.subscribe(c),
    "tts/engines": lambda c: intercom_client.tts_engines(c),
    "tts/start": lambda c: intercom_client.tts_start(c, "s1", "tts.engine", None, "hello"),
}
# a command added to intercom_client later appears here too (below) and must get a representative call above
EXTRA_CALLS: dict[str, Any] = {}


def sent_frame(command: str) -> dict[str, Any]:
    recorder = Recorder()
    calls = {**CLIENT_CALLS, **EXTRA_CALLS}
    asyncio.run(calls[command](recorder))
    assert len(recorder.frames) == 1, "one typed function, one frame"
    return recorder.frames[0]


PRIMITIVES = {"string": str, "object": dict, "array": list, "boolean": bool, "null": type(None)}


def conforms(value: Any, schema: dict[str, Any]) -> bool:
    kind = schema.get("type")
    if "const" in schema:
        return value == schema["const"]
    if kind == "integer":
        ok = isinstance(value, int) and not isinstance(value, bool)
        return ok and schema.get("minimum", value) <= value <= schema.get("maximum", value)
    if kind in PRIMITIVES:
        return isinstance(value, PRIMITIVES[kind])
    return True


def test_every_command_literal_in_the_client_has_a_representative_call():
    source = (Path(intercom_client.__file__)).read_text(encoding="utf-8")
    literals = set(re.findall(r'command_type\("([a-z_/]+)"\)', source))
    calls = {**CLIENT_CALLS, **EXTRA_CALLS}
    assert literals, "the scan found nothing: the client's spelling changed"
    assert literals <= set(calls), f"commands without a contract call: {sorted(literals - set(calls))}"


@pytest.mark.parametrize("command", sorted(set(CLIENT_CALLS) - SEPARATE_HANDLERS))
def test_the_frame_arx_sends_fits_the_pinned_request_schema(command: str):
    assert command in COMMANDS, f"{command} is not in the pinned catalog"
    entry = COMMANDS[command]
    schema = entry["request"]
    frame = sent_frame(command)
    assert frame["type"] == PREFIX + command and schema["properties"]["type"]["const"] == frame["type"]
    properties = schema["properties"]
    extra = set(frame) - set(properties)
    assert schema["additionalProperties"] is False and not extra, f"keys the schema does not list: {sorted(extra)}"
    missing = set(schema["required"]) - set(frame)
    assert not missing, f"required keys not sent: {sorted(missing)}"
    for key, value in frame.items():
        assert conforms(value, properties[key]), f"{key}={value!r} does not fit {properties[key]}"
    read = entry["permission"]["read_command_for_security_guard_and_api_contract"]
    if not read:
        assert frame.get("api_contract") == intercom_client.API_CONTRACT, "a non-READ command carries api_contract (WisKey's api_incompatible check)"
    assert "api_contract" not in schema["required"], "api_contract is optional everywhere in rc.37"


def test_commands_with_their_own_handlers_are_absent_from_the_catalog_and_keep_their_exact_key_sets():
    for command in SEPARATE_HANDLERS:
        assert command not in COMMANDS, f"{command}: the pin now lists it - move it to the schema test"
    assert set(sent_frame("subscribe")) == {"id", "type"}
    assert set(sent_frame("tts/engines")) == {"id", "type"}
    assert set(sent_frame("tts/start")) == {"id", "type", "station_id", "engine_id", "language", "message"}, "no api_contract: WisKey's tts handlers check the key set exactly"


def test_the_commands_arx_uses_are_in_the_pinned_set_and_the_read_ones_are_not_physical():
    physical = {"stations/test_unlock", "media/signal", "cards/capture_start"}
    for command in physical:
        assert COMMANDS[command]["permission"]["read_command_for_security_guard_and_api_contract"] is False
    for command in ("overview", "events/list", "users/query", "users/get"):
        assert COMMANDS[command]["permission"]["read_command_for_security_guard_and_api_contract"] is True


# ---------------------------------------------------------------- the adapter's reads against the catalog (CR-036 S4)

from smplwise.services import intercom_adapter as adapter  # noqa: E402
from smplwise.services import wiskey_media_contract as w10  # noqa: E402

# one representative call of every typed read of the adapter; the frame it sends is what the catalog judges
ADAPTER_CALLS: dict[str, Any] = {
    "users/query": lambda c: adapter.users_query(c, {"sort": "name", "station": "s1", "credential": "pin", "profile": {"x": "y"}}, 0, 50, ""),
    "users/get": lambda c: adapter.users_get(c, "u1"),
    "users/photo_get": lambda c: adapter.users_photo_get(c, "u1"),
    "events/list": lambda c: adapter.events_list(c, {"station_id": "s1", "limit": 20, "start": "2026-09-27T08:00:00Z", "current_profile": {"id": "1"}, "surprise": 1}),
    "events/detail": lambda c: adapter.events_detail(c, "ev-1"),
    "events/export": lambda c: adapter.events_export(c, {"station_id": "s1", "limit": 5, "before": "ev-1", "current_profile": {"id": "1"}}),
    "profiles/settings_get": lambda c: adapter.profiles_settings(c),
    "profiles/versions": lambda c: adapter.profiles_versions(c, 0, 20),
    "schedules/list": lambda c: adapter.schedules_list(c),
    "schedules/plan_list": lambda c: adapter.schedules_plans(c),
    "schedules/operations_list": lambda c: adapter.schedules_operations(c),
    "health/get": lambda c: adapter.health_get(c, "s1"),
    "health/history": lambda c: adapter.health_history(c, "s1"),
    "sync/status": lambda c: adapter.sync_status(c),
    "conflicts/list": lambda c: adapter.conflicts_list(c),
    "fleet/alerts": lambda c: adapter.fleet_alerts(c, "", False),
    "audit/list": lambda c: adapter.audit_list(c, {"station_id": "s1", "limit": 50, "actor": "x"}),
    "stations/technical_program_list": lambda c: adapter.program_list(c, "s1"),
    "stations/technical_hold_get": lambda c: adapter.hold_get(c, "s1", 1),
    "stations/technical_codes_get": lambda c: adapter.codes_get(c, "s1"),
    # WKDIRECT-295 (S6): WisKey's six W10 commands are no adapter command any more - they leave only as signed bridge envelopes
    # (services/wiskey_media_bridge.py; tests/test_wiskey_media_v11.py and tests/test_wkdirect_295.py hold them to WisKey's v1.1 schemas)
}
W10_PROPOSAL = json.loads((ROOT / "docs" / "integrations" / "wiskey" / "catalog" / "w10-proposal" / "commands.proposed.json").read_text(encoding="utf-8"))["commands"]


def adapter_frame(command: str) -> dict[str, Any]:
    recorder = Recorder()
    asyncio.run(ADAPTER_CALLS[command](recorder))
    assert len(recorder.frames) == 1, "one typed read, one frame"
    return recorder.frames[0]


def test_every_adapter_command_has_a_representative_call():
    assert set(ADAPTER_CALLS) == set(adapter.CHANNEL_OF)


def test_the_w10_commands_have_no_unsigned_frame_and_no_channel():
    """WKDIRECT-295 (S6): the AVW10-295 proposal named the same six commands as unsigned feed frames; that path is removed. No channel
    allows one of them, and the contract module has no sender that would build one on the feed's `call`."""
    from smplwise.services import wiskey_channels as ch

    assert set(W10_PROPOSAL) == set(w10.COMMANDS) == ch.W10_COMMANDS and len(w10.COMMANDS) == 6
    assert "media" not in ch.ALLOWLISTS and "media" not in ch.UNPINNED_CHANNELS
    assert not any(ch.allowed(name, PREFIX + c) for name in ch.ALLOWLISTS for c in w10.COMMANDS)
    assert not any(hasattr(w10, f) for f in ("station_descriptor", "stream_lease", "talk_open", "talk_frame", "talk_floor", "talk_close"))


@pytest.mark.parametrize("command", sorted(adapter.CHANNEL_OF))
def test_the_frame_the_adapter_sends_fits_the_pinned_request_schema(command: str):
    entry = COMMANDS[command]
    schema = entry["request"]
    frame = adapter_frame(command)
    assert frame["type"] == PREFIX + command
    extra = set(frame) - set(schema["properties"])
    assert not extra, f"keys the schema does not list: {sorted(extra)}"
    assert not set(schema["required"]) - set(frame), "a required key is missing"
    for key, value in frame.items():
        assert conforms(value, schema["properties"][key]), f"{key}={value!r}"
    read = entry["permission"]["read_command_for_security_guard_and_api_contract"]
    assert (frame.get("api_contract") == intercom_client.API_CONTRACT) == (not read), "api_contract exactly on the non-READ (technical) reads"
    assert read == (adapter.CHANNEL_OF[command] == "read"), "READ commands ride the read channel, the others the technical one"


def test_the_adapter_never_hands_wiskey_an_oracle_filter():
    """The filters WisKey would match on fields the caller may not see are dropped in the typed reads themselves."""
    assert adapter_frame("users/query")["query"] == "" and set(adapter_frame("users/query")["filters"]) == {"sort", "station"}
    # S7: the field filters (credential, profile) are in the frame only when the adapter - which first checked that the caller holds
    # `access.people.sensitive` - asks for them; a bare call (any other caller) still drops them
    recorder = Recorder()
    asyncio.run(adapter.users_query(recorder, {"sort": "name", "credential": "pin", "profile": {"x": "y"}}, 0, 50, "", field_filters=True))
    assert recorder.frames[0]["filters"] == {"sort": "name", "credential": "pin", "profile": {"x": "y"}} and recorder.frames[0]["query"] == ""
    assert "current_profile" not in adapter_frame("events/list")["filters"] and "surprise" not in adapter_frame("events/list")["filters"]
    assert set(adapter_frame("events/export")["filters"]) == {"station_id"}, "no limit / before / current_profile on the export"
    assert "actor" not in adapter_frame("audit/list")["filters"]
    assert adapter_frame("fleet/alerts") == {"id": 1, "type": PREFIX + "fleet/alerts", "offset": 0, "limit": 200, "station_id": "", "kind": "", "include_suppressed": False}
