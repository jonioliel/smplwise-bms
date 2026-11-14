"""WISKEY-RC10-PIN-2382: Arx's WisKey pins against WisKey 2.0.1-rc.10, the version the owner's lab runs (03.11).

The fixture is `docs/integrations/wiskey/catalog/rc10-extract/`: a STATIC extraction of rc.10's source (scripts/wiskey_rc_extract.py,
`ast` only - nothing imported, no device, no Home Assistant, no lab call) from WisKey ref
`origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ 2834aa5e. It holds the same two catalogs WisKey delivered for rc.37
(`commands.static.json`, `errors.static.json`; the extractor reproduces WisKey's rc.37 files exactly - see the optional source test
below) plus `surface.static.json`: the separate registries (W10 media, features, peer, templates, installation, ...), the direct-only
reads, `overview.api` version / min_client / capabilities, the projections of `overview.api.commands`, and the closed shapes Arx reads.

What these tests prove, per Arx pin: every command Arx names exists in rc.10; every frame Arx sends on the classic path fits rc.10's
top-level request schema (keys, required keys, primitive types, `api_contract` on non-READ commands); the W10 parameters, events and
the direct discovery blocks Arx builds or reads match rc.10's; and the static projection equals what the lab probe saw (258 commands,
68 capabilities). What they do not prove: nested schemas, runtime authorization, physical effects (the catalog's own caveats).

rc.37 stays covered by tests/test_wiskey_contract.py and tests/test_wiskey_channels.py (the oldest WisKey Arx still reads)."""
from __future__ import annotations

import asyncio
import copy
import importlib.util
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import intercom_adapter, intercom_client, intercom_sync, wiskey_channels as ch
from smplwise.services import wiskey_core_runtime_gate as core_gate
from smplwise.services import wiskey_direct_catalog as wdc
from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_media_contract as w10

ROOT = Path(__file__).resolve().parents[3]
CATALOGS = ROOT / "docs" / "integrations" / "wiskey" / "catalog"
PIN10 = CATALOGS / "rc10-extract"
PIN37 = CATALOGS / "rc37-contract.4"
PREFIX = intercom_client.DOMAIN + "/"


def _load_script(name: str, alias: str) -> Any:
    spec = importlib.util.spec_from_file_location(alias, ROOT / "scripts" / name)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[alias] = module
    spec.loader.exec_module(module)
    return module


tool = _load_script("wiskey_contract_diff.py", "wiskey_contract_diff_rc10")
extractor = _load_script("wiskey_rc_extract.py", "wiskey_rc_extract_rc10")

PIN = json.loads((PIN10 / "PIN.json").read_text(encoding="utf-8"))
COMMANDS = json.loads((PIN10 / "commands.static.json").read_text(encoding="utf-8"))["commands"]
SURFACE = json.loads((PIN10 / "surface.static.json").read_text(encoding="utf-8"))
REGISTRIES = {group: set(row["commands"]) for group, row in SURFACE["registries"].items()}
DIRECT_ONLY = set(SURFACE["direct_only_reads"])
EVERY_COMMAND = set(COMMANDS) | set().union(*REGISTRIES.values()) | DIRECT_ONLY
READ = set(SURFACE["api"]["read_commands"])
PROJECTION = SURFACE["overview_api_projection"]
SHAPES = SURFACE["shapes"]
CAPABILITIES = set(SURFACE["api"]["capabilities_static"]) | set(SURFACE["api"]["capabilities_candidate"]) | set(SURFACE["api"]["capabilities_conditional"])
# handlers outside `websocket.COMMANDS` that Arx sends on the classic HA path (their exact key sets: tests/fake_wiskey.py)
SEPARATE = {"subscribe", "tts/engines", "tts/start"}


def is_read(command: str) -> bool:
    return COMMANDS[command]["permission"]["read_command_for_security_guard_and_api_contract"] is True


# ================================================================ the pin itself

def test_the_rc10_pin_is_intact_and_is_the_default_baseline():
    assert tool.verify_pin(PIN10) == []
    assert PIN["runtime_version"] == "2.0.1-rc.10" and PIN["source_commit"].startswith("2834aa5e")
    assert PIN["source_ref"] == "origin/codex/wiskey-mac-m12-policy-b-2026-11-02"
    assert PIN["files"]["commands.static.json"]["count"] == 245 == len(COMMANDS)
    assert PIN["files"]["errors.static.json"]["count"] == 365
    assert SURFACE["manifest_version"] == SURFACE["const_version"] == "2.0.1-rc.10" and SURFACE["domain"] == intercom_client.DOMAIN
    assert tool.DEFAULT_PIN == PIN10, "the next WisKey rc is diffed against rc.10"
    assert tool.verify_pin(PIN37) == [], "the rc.37 baseline is kept"


def test_the_static_projection_equals_what_the_lab_probe_saw():
    """Lab probe 03.11 (read-only, agent d): `overview.api` version 1, min_client 0, 258 commands, 68 capabilities, no W10 command.
    The static model of `websocket.overview` for an administrator gives the same numbers from the source alone."""
    assert SURFACE["api"]["version"] == 1 and SURFACE["api"]["min_client"] == 0
    assert PROJECTION["administrator"]["count"] == 258 and PROJECTION["administrator"]["capabilities_count"] == 68
    assert not REGISTRIES["station_media_w10"] & set(PROJECTION["administrator"]["commands"])
    assert {"media/call", "media/signal"} <= set(PROJECTION["administrator"]["commands"])


def test_w10_is_listed_on_the_direct_socket_and_for_the_paired_bridge_only():
    """Finding 2 of the integration plan, from the source: rc.10 lists the six W10 commands in `direct/capabilities` (every registered
    handler) and in the overview of a `bridge_full_scope` identity - never in an administrator's overview."""
    assert len(REGISTRIES["station_media_w10"]) == 6 and REGISTRIES["station_media_w10"] == set(w10.COMMANDS)
    assert REGISTRIES["station_media_w10"] <= set(PROJECTION["direct_socket"]["commands"])
    assert REGISTRIES["station_media_w10"] <= set(PROJECTION["paired_bridge_full_scope"]["commands"])
    assert PROJECTION["direct_socket"]["count"] == 298


# ================================================================ the D-005 diff rc.37 -> rc.10 (frozen)

RC10_ADDED = ["platform/maintenance_resume_v1", "schedules/normalize_user", "upgrade/manual_readiness_v1", "users/access_state",
              "users/access_state_v2", "whatsapp/pacing_status_v1", "whatsapp/send_pacing_v1"]


def test_rc37_to_rc10_adds_seven_public_commands_and_breaks_nothing():
    report = tool.diff(tool.load(PIN37), tool.load(PIN10))
    assert report["breaking"] == [] and report["exit_code"] == 1
    assert report["commands_added"] == RC10_ADDED and report["commands_removed"] == []
    assert report["errors_removed"] == [] and len(report["errors_added"]) == 64
    assert report["surface"] == "only in the candidate (not compared)"
    assert [c for c in report["changes"] if not c.startswith(("command added", "error code added"))] == []


def test_the_surface_diff_flags_removals_and_value_changes_as_breaking(tmp_path):
    folder = tmp_path / "next"
    shutil.copytree(PIN10, folder)
    assert tool.diff(tool.load(PIN10), tool.load(folder))["exit_code"] == 0
    doc = json.loads((folder / "surface.static.json").read_text(encoding="utf-8"))
    doc["api"]["capabilities_static"].append("brand_new_v1")
    (folder / "surface.static.json").write_text(json.dumps(doc), encoding="utf-8")
    report = tool.diff(tool.load(PIN10), tool.load(folder))
    assert report["exit_code"] == 1 and report["changes"] == ["surface api.capabilities_static: added ['brand_new_v1']"]
    for mutate, needle in (
        (lambda d: d["registries"]["station_media_w10"]["commands"].remove("media/talk_floor"), "registries.station_media_w10.commands: removed"),
        (lambda d: d["shapes"]["station_media_w10"].update(schema="arx.station_media.v2"), "shapes.station_media_w10.schema"),
        (lambda d: d["shapes"]["direct_capabilities_v1"]["document"]["lifecycle"].update(kid_in_v1=True), "lifecycle.kid_in_v1"),
        (lambda d: d["shapes"]["core_runtime_v1"].pop("module_keys"), "shapes.core_runtime_v1.module_keys: removed"),
    ):
        changed = copy.deepcopy(json.loads((PIN10 / "surface.static.json").read_text(encoding="utf-8")))
        mutate(changed)
        (folder / "surface.static.json").write_text(json.dumps(changed), encoding="utf-8")
        report = tool.diff(tool.load(PIN10), tool.load(folder))
        assert report["exit_code"] == 2 and any(needle in b for b in report["breaking"]), (needle, report["breaking"])


# ================================================================ Arx's command pins against rc.10

def test_every_command_of_the_direct_catalog_exists_in_rc10_and_rc10_has_none_arx_lacks():
    wdc.load.cache_clear()
    catalog = wdc.load()
    names = {e.command for e in catalog.entries()}
    assert names - EVERY_COMMAND == set(), sorted(names - EVERY_COMMAND)
    assert EVERY_COMMAND - names == set(), sorted(EVERY_COMMAND - names)
    assert {e.command for e in catalog.entries() if e.row_kind == "DIRECT_ONLY_COMMAND"} == DIRECT_ONLY
    direct = set(PROJECTION["direct_socket"]["commands"])
    for entry in catalog.entries():
        # a command Arx would put on the direct envelope is one WisKey's direct socket serves; an HA-body row never is
        if entry.envelope is None:
            assert entry.command not in direct, entry.command
            assert wdc.direct_refusal(entry.command) == "not_a_direct_command"
        else:
            assert entry.command in direct, entry.command
    assert catalog.registered_count == 300 and catalog.command_count == 304


def test_the_two_rc10_rows_route_as_rc10_registers_them():
    wdc.load.cache_clear()
    readiness = wdc.load().get("upgrade/manual_readiness_v1")
    core = wdc.load().get("installation/core_runtime_v1")
    assert readiness is not None and readiness.envelope == wdc.bridge.KIND and readiness.discovered and is_read("upgrade/manual_readiness_v1")
    assert core is not None and core.envelope is None and not core.discovered
    assert wdc.direct_refusal("installation/core_runtime_v1") == "not_a_direct_command"
    assert REGISTRIES["core_runtime"] == {"installation/core_runtime_v1"}
    assert PREFIX + "installation/core_runtime_v1" in core_gate.COMMANDS


# Commands Arx ASKED WisKey for that rc.10 does not have. Each one sits on an UNPINNED channel, is gated off by default by an
# administrator switch AND by WisKey listing the command in its discovery (fail closed), and leaves this list the day a pinned WisKey
# release carries it (test_every_asked_command_is_really_missing_from_rc10_and_gated_off fails then). Never add a command rc.10 has.
ASKED_NOT_IN_RC10: dict[str, tuple[str, str]] = {
    # command: (channel, why)
    "visits/record_external_v1": ("visits_push", "WISKEY-VISITS-2407: the record of an Arx invitation in WisKey - the ask in "
                                  "docs/changes/WISKEY-VISITS-2407.md section 4; off by default (access.visitors.wiskey_push) and "
                                  "offered only when WisKey's discovery lists the command"),
}


@pytest.mark.parametrize("channel", sorted(ch.ALLOWLISTS))
def test_every_channel_command_is_an_rc10_command_including_the_formerly_unpinned_ones(channel: str):
    """rc.10's public table now holds the readback and pacing reads that post-dated the rc.37 pin (UNPINNED_CHANNELS). The only
    exceptions are the explicit asks of ASKED_NOT_IN_RC10, on their own unpinned channel."""
    for command in ch.ALLOWLISTS[channel]:
        if command in ASKED_NOT_IN_RC10 and ASKED_NOT_IN_RC10[command][0] == channel:
            continue
        assert command in COMMANDS or command in SEPARATE, f"{channel}: {command} is not an rc.10 command"


def test_every_asked_command_is_really_missing_from_rc10_and_gated_off():
    import sqlite3

    from smplwise.services import wiskey_visits as wv

    for command, (channel, why) in ASKED_NOT_IN_RC10.items():
        assert why.strip(), command
        assert command not in EVERY_COMMAND, f"{command} is in rc.10 now - drop it from ASKED_NOT_IN_RC10"
        assert command in ch.ALLOWLISTS[channel] and channel in ch.UNPINNED_CHANNELS, (command, channel)
    # the one ask today: the administrator's switch is off on a fresh store, and an rc.10-shaped discovery does not offer the feature
    assert wv.RECORD in ASKED_NOT_IN_RC10 and wv.PUSH_CHANNEL == ASKED_NOT_IN_RC10[wv.RECORD][0]
    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")  # a store with no row for the switch = never set
        assert wv.switch_on(conn) is False
    finally:
        conn.close()
    rc10_api = {"min_client": SURFACE["api"]["min_client"], "commands": sorted(EVERY_COMMAND)}
    assert wv.feature_state(rc10_api, "push") == (False, "push_not_offered")


@pytest.mark.parametrize("channel", ["background", "read", "readback", "pacing"])
def test_the_read_channels_hold_only_rc10_read_commands(channel: str):
    for command in ch.ALLOWLISTS[channel]:
        if command in SEPARATE:
            assert command == "subscribe"
            continue
        assert is_read(command) and command in READ, f"{channel}: {command} is not READ in rc.10"


def test_the_technical_reads_are_still_non_read_view_level_commands_in_rc10():
    for command in ch.TECHNICAL:
        assert not is_read(command), command
        assert all(level == "view" for _a, level in COMMANDS[command]["permission"]["alternative_area_grants"]), command


def test_every_adapter_feature_command_is_in_the_rc10_administrator_overview():
    listed = set(PROJECTION["administrator"]["commands"])
    for feature, commands in intercom_adapter.FEATURES.items():
        assert set(commands) <= listed, (feature, sorted(set(commands) - listed))
    assert set(intercom_adapter.CHANNEL_OF) <= listed


def test_the_command_constants_of_the_wiskey_modules_exist_in_rc10():
    from smplwise.services import (intercom_messaging_adapter, wa_pacing, wiskey_access_state, wiskey_capture_direct, wiskey_command_port,
                                   wiskey_feature_direct, wiskey_native_write, wiskey_people_csv, wiskey_program_direct,
                                   wiskey_relay_map_native, wiskey_selected_readonly, wiskey_service_write)

    names = {
        *intercom_messaging_adapter.COMMANDS, wa_pacing.PACING_ROUTE,
        *(c[len(PREFIX):] for c in wiskey_access_state.COMMANDS.values()),
        wiskey_capture_direct.EVENT_COMMAND, wiskey_capture_direct.REQUEST_COMMAND,
        *wiskey_command_port.PEER_QUERY_COMMANDS, *wiskey_feature_direct.COMMANDS,
        wiskey_native_write.SOURCE_COMMAND, wiskey_native_write.READ_BINDING_COMMAND, wiskey_native_write.RESOLVE_COMMAND,
        wiskey_people_csv.COMMAND, *wiskey_program_direct.COMMANDS, *wiskey_relay_map_native.COMMANDS,
        *wiskey_selected_readonly.COMMANDS, *wiskey_service_write.COMMANDS, wiskey_service_write.STATUS_COMMAND,
        *w10.COMMANDS, dd.CAPABILITIES, dd.TIME,
    }
    assert names - EVERY_COMMAND == set(), sorted(names - EVERY_COMMAND)
    assert set(wiskey_service_write.COMMANDS) == set(SHAPES["direct_capabilities_v1"]["document"]["native_service_write"]["commands"])


# ================================================================ the frames Arx sends, against rc.10's request schemas

import test_wiskey_contract as rc37  # noqa: E402 - the representative calls of the rc.37 contract tests, reused as they are


class Recorder:
    def __init__(self) -> None:
        self.frames: list[dict[str, Any]] = []

    async def __call__(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        frame = {"id": len(self.frames) + 1, "type": msg_type, **kw}
        self.frames.append(frame)
        return {"id": frame["id"], "type": "result", "success": True, "result": {"token": "t" * 16}}


async def _messaging(call: Any) -> None:
    from smplwise.services import intercom_messaging_adapter as ma

    await ma._status_exchange(call)
    await ma._pacing_exchange(call)
    try:
        await ma._preview_and_send(call, "acct-1", "u1", "hello", {})
    except Exception:  # noqa: BLE001 - the recorder's answer is not a send receipt; the two frames are what is judged
        pass


async def _readback(call: Any) -> None:
    await intercom_adapter._ask(call, "users/access_state", user_id="u1", revision=3)
    await intercom_adapter._ask(call, "users/access_state_v2", user_id="u1", revision=3)
    await intercom_adapter._ask(call, "schedules/normalize_user", schedule={"kind": "always"})


def _all_frames() -> list[dict[str, Any]]:
    frames = [rc37.sent_frame(c) for c in sorted(set(rc37.CLIENT_CALLS) - SEPARATE)]
    frames += [rc37.adapter_frame(c) for c in sorted(rc37.ADAPTER_CALLS)]
    for driver in (_messaging, _readback):
        recorder = Recorder()
        asyncio.run(driver(recorder))
        frames += recorder.frames
    return frames


FRAMES = _all_frames()


@pytest.mark.parametrize("frame", FRAMES, ids=[f["type"][len(PREFIX):] for f in FRAMES])
def test_every_classic_frame_arx_sends_passes_rc10_request_validation(frame: dict[str, Any]):
    """What rc.10's `_command_handler` checks before dispatch: the Voluptuous schema (no unknown key, every required key), the
    strict `type(value) is int / bool` re-check, and `api_contract` within [min_client, version] for a non-READ command."""
    command = frame["type"][len(PREFIX):]
    assert command in COMMANDS, f"{command} is not in rc.10's table"
    schema = COMMANDS[command]["request"]
    extra = set(frame) - set(schema["properties"])
    assert not extra, f"keys rc.10 would refuse: {sorted(extra)}"
    assert not set(schema["required"]) - set(frame), f"required keys missing: {sorted(set(schema['required']) - set(frame))}"
    for key, value in frame.items():
        assert rc37.conforms(value, schema["properties"][key]), f"{key}={value!r} does not fit {schema['properties'][key]}"
    if not is_read(command):
        assert frame.get("api_contract") == intercom_client.API_CONTRACT
        assert SURFACE["api"]["min_client"] <= intercom_client.API_CONTRACT <= SURFACE["api"]["version"]


def test_every_command_driven_on_the_classic_path_is_covered():
    sent = {f["type"][len(PREFIX):] for f in FRAMES}
    assert set(intercom_adapter.CHANNEL_OF) <= sent
    assert ch.READBACK | ch.PACING | ch.MESSAGING <= sent
    assert set(rc37.CLIENT_CALLS) - SEPARATE <= sent


# ================================================================ W10 (signed bridge parameters, events, descriptor)

ACTOR = w10.Actor("op-1", "Operator")
HANDLE = "a" * 32


def test_the_w10_parameters_arx_signs_have_exactly_rc10s_key_sets():
    shape = SHAPES["station_media_w10"]
    built = {
        w10.DESCRIBE: w10.descriptor_params("entry-a", ACTOR, "req-1"),
        w10.STREAM_LEASE: w10.lease_params(HANDLE, ACTOR, "req-1"),
        w10.TALK_OPEN: w10.talk_open_params(HANDLE, ACTOR, "req-1", "2026-11-03T10:00:15+00:00"),
        w10.TALK_FRAME: w10.talk_frame_params(HANDLE, 0, [w10.SILENCE_PCMU] * w10.BATCH_FRAMES),
        w10.TALK_FLOOR: w10.talk_floor_params(HANDLE, True),
        w10.TALK_CLOSE: w10.talk_close_params(HANDLE, "stopped"),
    }
    for command, params in built.items():
        want = shape["parameters"][command]
        assert set(params) - set(want["optional"]) == set(want["required"]), command
        assert set(w10._PARAM_KEYS[command]) == set(want["required"]), command
    listen = w10.talk_open_params(HANDLE, ACTOR, "req-1", "2026-11-03T10:00:15+00:00", listen=True)
    assert set(listen) - set(shape["parameters"][w10.TALK_OPEN]["required"]) == {"listen"} == set(shape["parameters"][w10.TALK_OPEN]["optional"])
    assert set(built[w10.DESCRIBE]["actor"]) == set(shape["actor_keys"])
    assert w10.SCHEMA_V11 == shape["schema"] and w10.V11_PROFILE == "main"
    assert set(w10.V11_CLOSE_REASONS) == set(shape["talk_close_reasons"])


def test_the_w10_events_and_descriptor_arx_reads_match_rc10():
    shape = SHAPES["station_media_w10"]
    events = shape["events"]
    audio = events["keys"]["media/talk_audio"]
    assert set(audio) == {"type", "schema", "talk_ref", "seq", "codec", "sample_rate", "channels", "data"}
    assert shape["listen_schema"] == dd.TALK_AUDIO_CAP["schema"] and shape["listen_transport"] == dd.TALK_AUDIO_CAP["transport"]
    assert set(events["keys"]["media/talk_closed"]) == {"type", "talk_ref", "reason", "cleanup_joined"}
    # every reason rc.10 can end a talk with is read as itself (an unknown one would read as upstream_closed)
    assert set(events["talk_closed_reasons"]) | set(shape["talk_close_reasons"]) <= set(w10.V11_EVENT_REASONS)
    closed = {"type": "media/talk_closed", "talk_ref": HANDLE, "reason": "media_not_supported", "cleanup_joined": True}
    assert w10.talk_closed_v11(closed) == (HANDLE, "media_not_supported", True)
    assert set(shape["descriptor_keys"]["top"]) == set(w10.DESCRIPTOR_KEYS)
    assert "listen_transports" in shape["descriptor_keys"]["audio"] and "talk_transports" in shape["descriptor_keys"]["audio"]


# ================================================================ direct discovery (direct/capabilities v1, direct/time)

def rc10_capabilities_document() -> dict[str, Any]:
    """The v1 document as rc.10 builds it for the paired service subject: the static blocks from the extraction, the command list
    from the direct socket projection (every entry with the transport protocol), no station."""
    doc = copy.deepcopy(SHAPES["direct_capabilities_v1"]["document"])
    names = PROJECTION["direct_socket"]["commands"]
    doc["families"] = sorted({n.split("/")[0] for n in names})
    doc["commands"] = [{"name": n, "envelope": doc["protocol"], "api_contract": 1 if n in COMMANDS else None,
                        "explicit_parameter_version": int(m[1]) if (m := re.search(r"_v([1-9][0-9]*)$", n)) else None} for n in names]
    doc["stations"] = []
    doc["limits"] = {k: None for k in doc["limits"]}
    doc["resources"] = {k: None for k in doc["resources"]}
    doc["business_contracts"] = {k: {} for k in doc["business_contracts"]}
    return doc


def test_rc10s_capabilities_document_is_read_with_every_block_offered():
    shape = SHAPES["direct_capabilities_v1"]
    assert set(shape["command_entry_keys"]) == dd._CMD_KEYS
    assert dd._CAP_KEYS <= set(shape["top_level_keys"]) <= dd._CAP_KEYS | dd._CAP_OPTIONAL
    assert shape["v2_only_keys"] == ["native_installation"], "only direct/capabilities_v2 adds a block; Arx reads v1"
    assert set(SHAPES["direct_time"]["keys"]) == dd._TIME_KEYS
    cap = dd.read_capabilities(rc10_capabilities_document(), "ref-1")
    assert cap.rejected_blocks == (), "rc.10's optional blocks are all read (reader revision 3)"
    assert cap.service_write is True and cap.talk_audio is True
    assert cap.service_write_installation_contract == dd.SERVICE_WRITE_INSTALLATION_CONTRACT
    assert all(cap.lists(c) for c in w10.COMMANDS) and cap.lists("upgrade/manual_readiness_v1")
    assert shape["document"]["native_service_write"] == dd.SERVICE_WRITE_CAP_RC10
    assert shape["document"]["station_talk_audio"] == dd.TALK_AUDIO_CAP
    for key, value in dd._LIFECYCLE_V1.items():
        assert shape["document"]["lifecycle"][key] is value


def test_the_historical_service_write_block_is_still_read_and_any_other_shape_is_not():
    doc = rc10_capabilities_document()
    doc["native_service_write"] = dict(dd.SERVICE_WRITE_CAP)  # an older WisKey (rc.4 .. rc.9 Mac final): unchanged behaviour
    old = dd.read_capabilities(doc, "ref-1")
    assert old.service_write is True and old.rejected_blocks == () and old.service_write_installation_contract is None
    for bad in ({**dd.SERVICE_WRITE_CAP_RC10, "installation_contract": "wiskey-native-service-write.v3"},
                {**dd.SERVICE_WRITE_CAP_RC10, "surprise": True}):
        doc["native_service_write"] = bad
        other = dd.read_capabilities(doc, "ref-1")
        assert other.service_write is False and other.rejected_blocks == ("native_service_write",)


def test_the_media_ingress_body_arx_signs_has_rc10s_key_set():
    from smplwise.services import wiskey_direct_join

    assert wiskey_direct_join.MEDIA_INGRESS_COMMAND == SHAPES["media_ingress_v1"]["command"]
    source = Path(wiskey_direct_join.__file__).read_text(encoding="utf-8")
    body = re.search(r"signed_body\(MEDIA_INGRESS_COMMAND, \{(.*?)\}\)", source, re.S)
    assert body is not None
    assert set(re.findall(r'"([a-z_]+)":', body.group(1))) == set(SHAPES["media_ingress_v1"]["parameters"])


def test_the_core_observation_shape_arx_checks_is_rc10s():
    assert core_gate.OBSERVATION_FIELDS == frozenset(SHAPES["core_runtime_v1"]["observation_keys"])
    assert core_gate.MODULE_FIELDS == set(SHAPES["core_runtime_v1"]["module_keys"])


# ================================================================ capabilities, entities, services, events Arx reads

def test_the_capability_names_arx_reads_are_published_by_rc10():
    from smplwise.services import wa_pacing

    arx_reads = {"intercom_tts", "peer_binding_read_v1", "person_access_state_v1", "person_access_state_v2",
                 "user_schedule_normalization_v1", wa_pacing.PACING_SCHEMA}
    assert arx_reads <= CAPABILITIES, sorted(arx_reads - CAPABILITIES)
    assert len(CAPABILITIES) == 68


def test_the_entities_and_services_arx_reads_are_rc10s():
    from smplwise.services import door_path_guard

    keys = SURFACE["entities"]["keys"]
    assert set(intercom_sync.STATION_WATCH_KEYS) <= set(keys["binary_sensor"]) | set(keys["sensor"])
    assert intercom_sync.CALL_STATES == frozenset(keys["sensor"]["call_status"])
    assert door_path_guard.WISKEY_UNLOCK_SERVICE in SURFACE["ha_services"]
    assert SURFACE["ha_services"] == ["rescan_station", "sync_all", "sync_station", "sync_user", "unlock_door"]
    assert set(keys["lock"]) == {"door_1", "door_2"} and SURFACE["entities"]["doorbell_event_types"] == ["ring"]


# ================================================================ the gaps rc.10 leaves (pinned so the next rc that closes one is noticed)

def test_rc10_gaps_that_the_wiskey_prompt_lists_are_still_open():
    """Each assertion is a WisKey-side gap (docs/changes/WISKEY-RC10-PIN-2382.md section 4). A failure here is GOOD news: update the
    change doc and the prompt, then flip the assertion."""
    # Q-WK-2: W10 not in an administrator's overview (only direct/capabilities and the bridge_full_scope overview list it)
    assert not REGISTRIES["station_media_w10"] & set(PROJECTION["administrator"]["commands"])
    # Q-WK-3: protocol v1 has no kid
    assert SHAPES["direct_capabilities_v1"]["document"]["lifecycle"]["kid_in_v1"] is False
    # Q-WK-7: emergency secure stays unsupported
    assert "emergency_secure_unsupported_v1" in CAPABILITIES
    # Q-WK-5: no standalone listen command (listen exists only inside talk_open)
    assert not any("listen" in c for c in EVERY_COMMAND)
    # Q-WK-6: media/signal still has no ringing request (its frame carries an `action`, the call states have no "outgoing")
    assert "dial" not in " ".join(EVERY_COMMAND) and "outgoing" not in SURFACE["entities"]["keys"]["sensor"]["call_status"]


# ================================================================ the extractor itself

def test_the_evaluator_reads_constants_and_refuses_code():
    import ast

    scope = {"DOMAIN": "hikvision_intercom", "BASE": frozenset({"a", "b"})}
    ev = extractor.evaluate
    assert ev(ast.parse('tuple("media/" + i for i in ("x", "y"))', mode="eval").body, scope) == ("media/x", "media/y")
    assert ev(ast.parse('BASE - {"a"}', mode="eval").body, scope) == frozenset({"b"})
    assert ev(ast.parse('f"{DOMAIN}/tts/start"', mode="eval").body, scope) == "hikvision_intercom/tts/start"
    assert ev(ast.parse('sorted({"z", *("a", "b")})', mode="eval").body, scope) == ["a", "b", "z"]
    for code in ('__import__("os").system("x")', 'open("f")', "eval('1')", "BASE.pop()"):
        with pytest.raises(extractor._Unknown):
            ev(ast.parse(code, mode="eval").body, scope)


def test_the_extractor_refuses_a_permission_function_it_does_not_understand(tmp_path):
    (tmp_path / "panel_permissions.py").write_text(
        'A = {"x/y"}\n\ndef requirements(command):\n    if command in A:\n        return (("users", "view"),)\n    return None\n', encoding="utf-8")
    tree = extractor.Tree(tmp_path)
    lookup = extractor._requirements(tree.get("panel_permissions.py"))
    assert lookup("x/y") == (("users", "view"),) and lookup("other") is None
    (tmp_path / "panel_permissions2.py").write_text(
        'def requirements(command):\n    for x in ():\n        pass\n    return None\n', encoding="utf-8")
    with pytest.raises(extractor.ExtractError):
        extractor._requirements(extractor.Tree(tmp_path).get("panel_permissions2.py"))


WISKEY_GIT = os.environ.get("WISKEY_SOURCE_GIT")


@pytest.mark.skipif(not WISKEY_GIT, reason="set WISKEY_SOURCE_GIT to a WisKey checkout to re-extract from source (read-only git archive)")
def test_the_extractor_reproduces_wiskey_rc37_files_and_this_pin_from_source(tmp_path):
    """Optional (needs the WisKey repository): rc.37's commit gives WisKey's own delivered catalogs back, and rc.10's ref gives this
    pin byte for byte."""
    out37, out10 = tmp_path / "rc37", tmp_path / "rc10"
    assert extractor.main(["--git", WISKEY_GIT, "--ref", "909579e3d113803e6274dbe4e4046aa5e6bf3c3c", "--catalogs-only", "--out", str(out37)]) == 0
    for name, key in (("commands.static.json", "commands"), ("errors.static.json", "errors")):
        mine = json.loads((out37 / name).read_text(encoding="utf-8"))[key]
        theirs = json.loads((PIN37 / name).read_text(encoding="utf-8"))[key]
        assert mine == theirs, name
    assert extractor.main(["--git", WISKEY_GIT, "--ref", PIN["source_commit"], "--out", str(out10)]) == 0
    for name in ("commands.static.json", "errors.static.json", "surface.static.json"):
        assert (out10 / name).read_bytes() == (PIN10 / name).read_bytes(), name
