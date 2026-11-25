"""WISKEY-RELAY-INV-2520 (row R3 of docs/changes/WISKEY-RESYNC-2520.md): WisKey `stations/relay_inventory_v1` as a READ-ONLY consumer
(WisKey 2.0.1-rc.19 contract relay-inventory-v1; WisKey's synthetic examples and result schema are copied unchanged into
tests/fixtures/wiskey_rc19/relay-inventory-v1/, byte digests pinned below). Nothing contacts a device, Home Assistant or WisKey: a fake
SYNC answers, the router tests replace the read itself.

Proven here:
- the closed `relay_inventory` channel carries exactly the one READ (no write, no relay test, no other command rides it);
- one frame `{type, station_id}` - no `api_contract`, no other key; nothing is sent when WisKey does not list the command, lists nothing,
  has no served copy or needs a newer client; a WisKey refusal is `forbidden` / `unavailable` and is never retried with another command;
- projection: a null count stays null (never 0), every role stays `unknown`, the physical count stays unknown and unverified, the relay
  test stays `relay_test_unsupported_v1`; a document that claims more (a role, a physical count, a verified relay, a supported test,
  an undeclared key, a wrong type, another station) is refused as a whole;
- the route: the relay map card's permission at the installation AND on the station's chain (audited 403 before anything is sent), only
  a station of the served copy is named to WisKey, and Arx's own relay map is not written by the read."""
from __future__ import annotations

import asyncio
import copy
import hashlib
import json
from pathlib import Path
from typing import Any

import pytest
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.errors import ApiError
from smplwise.services import wiskey_channels as ch
from smplwise.services import wiskey_relay_inventory as ri

FIXTURES = Path(__file__).parent / "fixtures" / "wiskey_rc19" / "relay-inventory-v1"
PREFIX = "hikvision_intercom/"
COMMAND = "stations/relay_inventory_v1"
LISTED = ["overview", COMMAND]
SID = "synthetic-station"

# WisKey PRODUCT 3e7bfc58 docs/contracts/relay-inventory-v1/{SCHEMA_INDEX,EXAMPLE_INDEX}.json
PINNED = {
    "result.schema.json": "3d1d61ab44af0b7459de64bbcc932f2bfd805af1d8171e32a643ef84d65a9fe5",
    "result.valid.json": "47fa01dcb118a3f97696dbda1bab5b375819f6c141c402cd8f1b87b8a1b91588",
    "result.missing-required.json": "06eecdd040cc10280c7dec8ce30ad32043f8b98a44ffc1d2e942cbe19364b259",
    "result.wrong-type-or-constant.json": "d9d5cadd273baaa9fc5a5a6d13c9d943bb89f44dc0f1f76b976bb33d3f0a1472",
    "result.forbidden-extra.json": "b5781d556a5bea26613c48f46fd0c4ca958bbf54917b181db48addeb97081832",
    "request.valid.json": "9dcee71e0846b937ba747a18e302ab0b72dfc266cb978f73b4fa61856175dc79",
    "error.valid.json": "4b53ea69b023f71f6775c275051f3ce56812ecc1dbdd977680b51ebe018252f7",
}


def fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def valid() -> dict[str, Any]:
    return fixture("result.valid.json")


# ---------------------------------------------------------------- the copied contract

@pytest.mark.parametrize("name,digest", sorted(PINNED.items()))
def test_wiskeys_contract_files_are_copied_byte_for_byte(name, digest):
    assert hashlib.sha256((FIXTURES / name).read_bytes()).hexdigest() == digest


def test_the_schema_pins_what_arx_relies_on():
    schema = fixture("result.schema.json")
    props = schema["properties"]
    assert schema["additionalProperties"] is False and set(schema["required"]) == ri.RESULT_KEYS
    assert props["physical_relay_count"] == {"type": "null"} and props["physical_verified"] == {"const": False}
    assert props["non_actuating_test"]["properties"] == {"supported": {"const": False}, "reason": {"const": ri.TEST_UNSUPPORTED}}
    assert props["api_outputs"]["properties"]["roles"]["items"]["properties"]["role"] == {"const": "unknown"}
    assert props["configured_mapping"]["items"]["properties"]["role"] == {"const": "unknown"}
    assert props["api_outputs"]["properties"]["count"] == {"enum": [None, 1, 2]}


# ---------------------------------------------------------------- the channel

def test_the_relay_inventory_channel_holds_exactly_the_one_read():
    assert ch.RELAY_INVENTORY == {COMMAND} and ri.CHANNEL == "relay_inventory" and ch.ALLOWLISTS[ri.CHANNEL] is ch.RELAY_INVENTORY
    assert ch.allowed(ri.CHANNEL, PREFIX + COMMAND)
    for other in ("stations/test_unlock", "stations/relay_test", "stations/relay_test_v1", "stations/get", "overview", "sync/station",
                  "system/status_v1", "users/update", "media/signal"):
        assert not ch.allowed(ri.CHANNEL, PREFIX + other), other
    assert ch.HA_FRAMES[ri.CHANNEL] == frozenset()
    assert [n for n, c in ch.ALLOWLISTS.items() if COMMAND in c] == [ri.CHANNEL], "no other channel can carry the read"
    assert COMMAND not in ch.SERVICE_WRITES


def test_the_request_example_is_the_frame_arx_sends():
    req = fixture("request.valid.json")
    sent, _, _ = _frames({"success": True, "result": valid()})
    (msg_type, kw), = sent
    assert {"type": msg_type, **kw} == {k: v for k, v in req.items() if k != "id"}  # ha_client.call sets the id


# ---------------------------------------------------------------- the frame

def _frames(answer: Any, station_id: str = SID) -> tuple[list[tuple[str, dict[str, Any]]], Any, Exception | None]:
    sent: list[tuple[str, dict[str, Any]]] = []

    async def call(msg_type: str, **kw: Any) -> Any:
        sent.append((msg_type, kw))
        return answer

    try:
        return sent, asyncio.run(ri.send(call, station_id)), None
    except Exception as exc:  # noqa: BLE001 - the test inspects it
        return sent, None, exc


def test_one_frame_with_the_type_and_the_station_only():
    sent, result, exc = _frames({"success": True, "result": {"x": 1}})
    assert exc is None and result == {"x": 1}
    assert sent == [(PREFIX + COMMAND, {"station_id": SID})], "a READ command: no api_contract, no dry_run, no other key"


def test_a_refusal_is_wiskeys_code_and_a_malformed_frame_is_invalid():
    _, _, exc = _frames({"success": False, "error": fixture("error.valid.json")})
    assert isinstance(exc, ri.IntercomError) and exc.code == "station_unloaded"
    _, _, exc = _frames({"success": False, "error": {"code": "Bad Code\n"}})
    assert isinstance(exc, ri.IntercomError) and exc.code == "other"
    for frame in (["not", "a", "frame"], {"success": 1, "result": valid()}, {"result": valid()}):
        _, _, exc = _frames(frame)
        assert isinstance(exc, ri.IntercomError) and exc.code == "invalid_response", frame


# ---------------------------------------------------------------- the projection

def test_wiskeys_valid_example_projects_with_every_unknown_kept():
    got = ri.project(valid(), SID)
    assert got == {
        "station_id": SID,
        "api_outputs": {"ids": [1, 2], "count": 2, "evidence": "device_capability_at_load",
                        "roles": [{"api_id": 1, "role": "unknown"}, {"api_id": 2, "role": "unknown"}]},
        "configured_mapping": [{"physical_index": 1, "api_id": 1, "confirmation": "saved_configuration", "role": "unknown"}],
        "physical_relay_count": None,
        "physical_verified": False,
        "non_actuating_test": {"supported": False, "reason": "relay_test_unsupported_v1"},
    }


def test_outputs_not_observed_stay_null_never_zero():
    doc = valid()
    doc["api_outputs"] = {"ids": [], "count": None, "evidence": "not_observed", "roles": []}
    doc["configured_mapping"] = []
    got = ri.project(doc, SID)
    assert got["api_outputs"] == {"ids": [], "count": None, "evidence": "not_observed", "roles": []}
    assert got["api_outputs"]["count"] is None and got["physical_relay_count"] is None and got["configured_mapping"] == []


def test_one_observed_output_is_not_a_single_relay_claim():
    doc = valid()
    doc["api_outputs"] = {"ids": [1], "count": 1, "evidence": "device_capability_at_load", "roles": [{"api_id": 1, "role": "unknown"}]}
    got = ri.project(doc, SID)
    assert got["api_outputs"]["count"] == 1 and got["physical_relay_count"] is None and got["physical_verified"] is False
    assert "single_relay" not in json.dumps(got)


@pytest.mark.parametrize("name", ["result.missing-required.json", "result.wrong-type-or-constant.json", "result.forbidden-extra.json"])
def test_wiskeys_rejected_examples_are_refused_as_a_whole(name):
    with pytest.raises(ri.ContractMismatch):
        ri.project(fixture(name), SID)


def _set(doc: dict[str, Any], path: str, value: Any) -> dict[str, Any]:
    doc = copy.deepcopy(doc)
    *parents, last = path.split(".")
    node: Any = doc
    for p in parents:
        node = node[int(p)] if isinstance(node, list) else node[p]
    if isinstance(node, list):
        node[int(last)] = value
    else:
        node[last] = value
    return doc


@pytest.mark.parametrize("path,value", [
    ("physical_relay_count", 1),  # a physical count is never accepted from a label or an output count
    ("physical_relay_count", 0),
    ("physical_verified", True),
    ("physical_verified", "false"),
    ("non_actuating_test.supported", True),  # a "harmless relay test" does not exist
    ("non_actuating_test.reason", "dry_run"),
    ("api_outputs.roles.0.role", "door"),  # a role is never established here
    ("api_outputs.roles.1.role", "gate"),
    ("configured_mapping.0.role", "door"),
    ("configured_mapping.0.confirmation", "physical_measurement"),
    ("configured_mapping.0.physical_index", 3),
    ("configured_mapping.0.api_id", True),  # a boolean is not the id 1
    ("api_outputs.count", 0),  # not observed is null, never zero
    ("api_outputs.count", 1),  # the count disagrees with the ids
    ("api_outputs.count", "2"),
    ("api_outputs.ids", [1, 3]),
    ("api_outputs.ids", [1, 1]),
    ("api_outputs.evidence", "measured"),
    ("api_outputs.evidence", "not_observed"),  # not observed, yet ids and a count
    ("schema", "1"),
    ("schema", 2),
    ("station_id", "another-station"),  # an answer about another station is not shown
])
def test_a_document_that_claims_more_than_the_contract_is_refused(path, value):
    with pytest.raises(ri.ContractMismatch):
        ri.project(_set(valid(), path, value), SID)


@pytest.mark.parametrize("where", ["", "api_outputs", "api_outputs.roles.0", "configured_mapping.0", "non_actuating_test"])
def test_an_undeclared_key_anywhere_is_refused(where):
    doc = valid()
    node: Any = doc
    for p in [x for x in where.split(".") if x]:
        node = node[int(p)] if isinstance(node, list) else node[p]
    node["physical_role"] = "door"
    with pytest.raises(ri.ContractMismatch):
        ri.project(doc, SID)


def test_roles_must_name_the_reported_outputs_and_lists_stay_bounded():
    doc = _set(valid(), "api_outputs.roles", [{"api_id": 1, "role": "unknown"}])
    with pytest.raises(ri.ContractMismatch):
        ri.project(doc, SID)
    row = {"physical_index": 1, "api_id": 1, "confirmation": "saved_configuration", "role": "unknown"}
    with pytest.raises(ri.ContractMismatch):
        ri.project(_set(valid(), "configured_mapping", [row, row, row]), SID)
    with pytest.raises(ri.ContractMismatch):
        ri.project(["not", "an", "object"], SID)


# ---------------------------------------------------------------- the read (fake SYNC)

class FakeSync:
    def __init__(self, commands: Any = LISTED, answer: Any = None, refuse: str | None = None, state: str = "ready", min_client: Any = None,
                 raise_api: ApiError | None = None):
        self.facts: dict[str, Any] | None = {"version": "x", "min_client": min_client, "commands": commands}
        self.answer, self.refuse, self.state, self.raise_api = answer, refuse, state, raise_api
        self.calls: list[tuple[str, str]] = []
        self.frames: list[tuple[str, dict[str, Any]]] = []

    def api_facts(self, _settings: Any) -> dict[str, Any] | None:
        return dict(self.facts) if self.facts is not None else None

    def command(self, _settings: Any, key: str, send: Any, project: Any, who: str = "", channel: str = "service", **_kw: Any) -> dict[str, Any]:
        self.calls.append((key, channel))
        assert ch.allowed(channel, PREFIX + COMMAND), "the frame goes through the channel's guard"
        if self.raise_api is not None:
            raise self.raise_api
        if self.state != "ready":
            return {"state": self.state, "last_error": self.refuse, key: None}

        async def call(msg_type: str, **kw: Any) -> Any:
            assert ch.allowed(channel, msg_type)
            self.frames.append((msg_type, kw))
            if self.refuse:
                return {"success": False, "error": {"code": self.refuse, "message": "x"}}
            return {"success": True, "result": self.answer}

        try:
            raw = asyncio.run(send(call))
        except ri.IntercomError as exc:
            return {"state": "forbidden" if exc.code == "unauthorized" else "error", "last_error": exc.code, key: None}
        try:
            return {"state": "ready", "last_error": None, "fetched_at": "2026-11-25T00:00:00Z", key: project(raw)}
        except Exception:  # noqa: BLE001 - intercom_sync's own rule: an unexpected shape is invalid_response
            return {"state": "error", "last_error": "invalid_response", key: None}


@pytest.fixture()
def fake(monkeypatch):
    def install(**kw: Any) -> FakeSync:
        f = FakeSync(**kw)
        monkeypatch.setattr(ri.intercom_sync, "SYNC", f)
        return f
    return install


def test_a_ready_read_goes_once_on_the_closed_channel(fake):
    f = fake(answer=valid())
    got = ri.read(object(), SID, "u1")
    assert got["state"] == "ready" and got["fetched_at"] and got["data"]["physical_relay_count"] is None
    assert got["data"]["non_actuating_test"] == {"supported": False, "reason": "relay_test_unsupported_v1"}
    assert f.calls == [("relay_inventory", "relay_inventory")] and f.frames == [(PREFIX + COMMAND, {"station_id": SID})]


@pytest.mark.parametrize("commands,min_client,reason", [
    (["overview", "stations/get"], None, "not_listed"),  # the lab's rc.10: nothing is sent
    (None, None, "commands_unknown"),
    (LISTED, 99, "api_incompatible"),
])
def test_nothing_is_sent_when_wiskey_does_not_offer_the_read(fake, commands, min_client, reason):
    f = fake(commands=commands, min_client=min_client, answer=valid())
    assert ri.read(object(), SID, "u1") == {"state": "unsupported", "reason": reason, "wiskey_code": None, "fetched_at": None, "data": None}
    assert f.calls == [] and f.frames == []


def test_no_served_copy_sends_nothing(fake):
    f = fake()
    f.facts = None
    assert ri.read(object(), SID, "u1")["reason"] == "no_copy" and f.calls == []


@pytest.mark.parametrize("code,state,reason", [
    ("unauthorized", "forbidden", "wiskey_refused"),
    ("station_unloaded", "unavailable", "station_unloaded"),
    ("unknown_command", "unsupported", "wiskey_unknown_command"),
])
def test_a_wiskey_refusal_is_reported_and_never_followed_by_another_command(fake, code, state, reason):
    f = fake(refuse=code)
    got = ri.read(object(), SID, "u1")
    assert got == {"state": state, "reason": reason, "wiskey_code": code, "fetched_at": None, "data": None}
    assert [t for t, _ in f.frames] == [PREFIX + COMMAND], "one frame; no relay test, no older command instead"


def test_a_request_level_refusal_is_unavailable_without_data(fake):
    f = fake(raise_api=ApiError(404, "intercom_station_not_found", "x", details={"wiskey_code": "station_not_found"}))
    got = ri.read(object(), SID, "u1")
    assert got == {"state": "unavailable", "reason": "wiskey_station_unknown", "wiskey_code": "station_not_found", "fetched_at": None, "data": None}
    assert len(f.calls) == 1


def test_a_contract_mismatch_is_an_error_without_data(fake):
    fake(answer=_set(valid(), "api_outputs.roles.0.role", "door"))
    assert ri.read(object(), SID, "u1") == {"state": "error", "reason": "contract_mismatch", "wiskey_code": None, "fetched_at": None, "data": None}


@pytest.mark.parametrize("state,code,want", [
    ("connecting", None, "unavailable"),
    ("ha_unavailable", "session_ended", "unavailable"),
    ("rate_limited", "rate_limited", "busy"),
    ("error", "busy", "busy"),
    ("error", "timeout", "error"),
])
def test_feed_states_map_to_the_card_states_without_data(fake, state, code, want):
    fake(state=state, refuse=code)
    got = ri.read(object(), SID, "u1")
    assert got["state"] == want and got["data"] is None


# ---------------------------------------------------------------- the route

@pytest.fixture()
def app(settings, monkeypatch, station_scope):  # noqa: F811
    from conftest import bind
    from fastapi.testclient import TestClient

    from smplwise.main import create_app
    from smplwise.services import intercom_sync

    seen: list[tuple[str, str]] = []

    def read(_settings: Any, station_id: str, who: str) -> dict[str, Any]:
        seen.append((station_id, who))
        return {"state": "ready", "reason": None, "wiskey_code": None, "fetched_at": "2026-11-25T00:00:00Z", "data": ri.project(
            {**valid(), "station_id": station_id}, station_id)}

    monkeypatch.setattr(ri, "read", read)
    monkeypatch.setattr(intercom_sync.SYNC, "station", lambda sid: {"id": sid, "name": "x"} if sid in ("entry-a", "entry-b") else None)
    c = TestClient(create_app(settings))
    bind(c, settings, "root", "system_admin", "installation", "*")
    bind(c, settings, "otto", "operator", "installation", "*")
    bind(c, settings, "sam", "site_admin", "installation", "*")
    station_scope.bind("dev-sam", "site_admin", "entry-b", effect="deny")
    return c, seen, settings


def test_the_route_answers_the_read_for_a_permitted_caller(app):
    from conftest import as_user

    c, seen, _ = app
    r = c.get("/api/v1/wiskey/relay-map/inventory/entry-a", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["station_id"] == "entry-a" and body["state"] == "ready"
    assert body["data"]["physical_relay_count"] is None and body["data"]["physical_verified"] is False
    assert {x["role"] for x in body["data"]["api_outputs"]["roles"] + body["data"]["configured_mapping"]} == {"unknown"}
    assert [s for s, _ in seen] == ["entry-a"]


def test_the_route_refuses_before_anything_is_sent(app):
    from conftest import as_user

    c, seen, _ = app
    assert c.get("/api/v1/wiskey/relay-map/inventory/entry-a", headers=as_user("otto")).status_code == 403, "no access.admin.read"
    assert c.get("/api/v1/wiskey/relay-map/inventory/entry-b", headers=as_user("sam")).status_code == 403, "denied on the station's chain"
    assert c.get("/api/v1/wiskey/relay-map/inventory/entry-a", headers=as_user("sam")).status_code == 200
    assert c.get("/api/v1/wiskey/relay-map/inventory/not-in-copy", headers=as_user("root")).status_code == 404, "never named to WisKey"
    assert [s for s, _ in seen] == ["entry-a"], "a refused caller or an unknown station never reaches WisKey"


def test_the_refusals_are_audited(app):
    from conftest import as_user

    from smplwise.db import Database

    c, _, settings = app
    c.get("/api/v1/wiskey/relay-map/inventory/entry-b", headers=as_user("sam"))
    with Database(settings.db_path).connection() as conn:
        rows = conn.execute("SELECT action, decision, resource_type, resource_id FROM audit_log WHERE decision = 'denied'").fetchall()
    assert any(r["resource_id"] == "entry-b" for r in rows), [dict(r) for r in rows]


def test_the_read_never_writes_arxs_relay_map(app):
    from conftest import as_user

    from smplwise.db import Database

    c, _, settings = app

    def snapshot() -> list[Any]:
        with Database(settings.db_path).connection() as conn:
            return [tuple(r) for t in ("wiskey_relay_map", "wiskey_relay_map_stations") for r in conn.execute(f"SELECT * FROM {t}").fetchall()]  # noqa: S608

    before = snapshot()
    assert c.get("/api/v1/wiskey/relay-map/inventory/entry-a", headers=as_user("root")).status_code == 200
    assert snapshot() == before
