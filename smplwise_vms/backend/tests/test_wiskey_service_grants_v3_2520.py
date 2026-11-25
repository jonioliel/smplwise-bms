"""WISKEY-R8-2520 (row R8 of docs/changes/WISKEY-RESYNC-2520.md, master ids R2 / C3; owner decisions 25.11): the manual service grant v3
READ (`service_grants/current_v3`), the v3 service-write contract, the explicit people-write path selection (no card via v3, no fallback
after a refusal) and the bridge-key status route that shows what WisKey reports.

Contract inputs (WisKey PRODUCT 3e7bfc58, 2.0.1-rc.19, read only): `docs/contracts/full-management-v1/service_grants--current_v3.*`
examples copied unchanged to tests/fixtures/wiskey_rc19/manual-v3/ (git blobs: result.valid 29463405, .wrong-type-or-constant fa852656,
.forbidden-extra c0a5c637, .missing-required d7766530; signed-reply.v2.valid b4c6477c; commit_v3.result.valid 309a8b32 - the only
synthetic ACTIVE grant WisKey publishes, used here without its `replay_available` key as the `current_v3` active answer). Fakes only:
no WisKey, no lab, no grant is created anywhere."""
from __future__ import annotations

import json
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.services import access_service_writer as asw
from smplwise.services import intercom_sync, wiskey_direct_join
from smplwise.services import wiskey_direct_catalog as wdc
from smplwise.services import wiskey_service_grants_v3 as v3
from smplwise.services import wiskey_service_write as sw
from smplwise.services.access_grant_engine import EngineError, WiskeyServiceEngine
from smplwise.services.wiskey_capture_port import PortError, PortIdentity

from test_wiskey_join_live_2382 import writer as live_writer  # noqa: F401 - the fake direct server fixture (v1 link), as `live_writer`

FIX = Path(__file__).parent / "fixtures" / "wiskey_rc19" / "manual-v3"
PACKAGE = Path(sw.__file__).resolve().parents[1]
REF = "a" * 32
REF2 = "b" * 32
ACTOR = "arx-service:entry-1"
OWNER_ONLY = ("service_grants/read_v3", "service_grants/preview_v3", "service_grants/commit_v3", "service_grants/revoke_v3")


def fixture(name: str) -> Any:
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def active_doc() -> dict[str, Any]:
    doc = fixture("service_grants--commit_v3.result.valid.json")
    doc.pop("replay_available")
    return doc


# ---------------------------------------------------------------- a fake direct join (no socket)

class Clock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


class FakeJoin:
    def __init__(self, *, selected: bool = True, version: int = 2, offered: bool = True, answers: list[Any] | None = None,
                 refusal: str | None = None) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []
        self.answers = list(answers or [])
        self._selected = selected
        self._refusal = refusal
        link = SimpleNamespace(closed=False, connection_ref=REF, protocol_version=version, kid="g1-0123abcd" if version == 2 else None)
        cap = SimpleNamespace(connection_ref=REF, manual_service_write_v3=offered)
        self.session = SimpleNamespace(_link=link, discovery=SimpleNamespace(capabilities=cap),
                                       transport_refusal=lambda command=None: None if selected else (self._refusal or "wiskey_direct_not_connected"))
        join = self

        class Port:
            def call(self, command: str, parameters: Any, *, timeout_s: float) -> Any:
                join.sent.append((command, dict(parameters)))
                answer = join.answers.pop(0)
                if isinstance(answer, Exception):
                    raise answer
                return answer

            def identity(self) -> PortIdentity:
                return PortIdentity(entry_id="entry-1", query_owner_id=ACTOR, repository_id="repo-1", connection_ref=join.session._link.connection_ref)

        self.capture_port = Port()

    def selected(self, command: str | None = None) -> bool:
        return self._selected


def source(join: FakeJoin | None, clock: Clock | None = None) -> v3.ManualGrantSource:
    return v3.ManualGrantSource(lambda: join, mono=clock or Clock())


# ================================================================ the closed reader


def test_the_published_examples_read_as_the_contract_says() -> None:
    doc = v3.read_current(fixture("service_grants--current_v3.result.valid.json"))
    assert (doc.status, doc.revision, doc.grant) == ("absent_or_revoked", 0, None)
    reply = fixture("service_grants--current_v3.signed-reply.v2.valid.json")
    assert v3.read_current(reply["frame"]["result"]).status == "absent_or_revoked"
    for name in ("result.wrong-type-or-constant", "result.forbidden-extra", "result.missing-required"):
        with pytest.raises(v3.GrantsV3Error) as exc:
            v3.read_current(fixture(f"service_grants--current_v3.{name}.json"))
        assert exc.value.code == "contract_mismatch"


def test_an_active_answer_yields_exactly_the_reported_references() -> None:
    doc = v3.read_current(active_doc())
    assert doc.status == "active" and doc.revision == 1
    assert doc.grant == sw.GrantRef("synthetic", 1, "synthetic", "synthetic", 1, 1) and doc.grant.valid()


def _mutate(path: tuple[str, ...], value: Any) -> dict[str, Any]:
    doc = active_doc()
    target = doc
    for key in path[:-1]:
        target = target[key]
    if value is KeyError:
        del target[path[-1]]
    else:
        target[path[-1]] = value
    return doc


@pytest.mark.parametrize("path,value", [
    (("status",), "absent"),                                  # the owner-read enum is not the service-read enum
    (("grant",), None),                                       # active without a grant
    (("revision",), True),                                    # a bool is not a revision
    (("revision",), -1),
    (("format",), "wiskey-manual-service-grants.v2"),
    (("grant", "fields"), sorted([*sw.DATA_FIELDS, "cards"])),  # v3 never grants cards
    (("grant", "commands"), ["cards/add", "users/create", "users/pin_generate", "users/temporary_cancel", "users/update"]),
    (("grant", "commands"), ["users/create", "users/update"]),  # a narrower list is another contract too: refused, never guessed
    (("grant", "stations"), [{"station_id": "s"}]),
    (("grant", "user_ids"), ["p1"]),
    (("grant", "allow_create"), False),
    (("grant", "expires_at"), "2030-01-01T00:00:00Z"),
    (("grant", "role"), "owner"),
    (("grant", "grant_revision"), 0),
    (("grant", "grant_id"), ""),
    (("grant", "extra"), 1),
    (("grant", "scope_ref"), KeyError),
])
def test_anything_but_the_closed_shape_is_refused_whole(path: tuple[str, ...], value: Any) -> None:
    with pytest.raises(v3.GrantsV3Error):
        v3.read_current(_mutate(path, value))


def test_an_absent_answer_carrying_a_grant_is_not_read() -> None:
    doc = active_doc()
    doc["status"] = "absent_or_revoked"
    with pytest.raises(v3.GrantsV3Error):
        v3.read_current(doc)
    with pytest.raises(v3.GrantsV3Error):
        v3.read_current(["not", "a", "document"])


# ================================================================ the source: when the read is sent, and what it reports


def test_nothing_is_sent_without_a_join() -> None:
    obs = source(None).refresh()
    assert (obs.state, obs.reason, obs.sent) == ("unavailable", "direct_not_installed", False)


@pytest.mark.parametrize("kwargs,state,reason", [
    ({"selected": False}, "unavailable", "wiskey_direct_not_connected"),
    ({"selected": False, "refusal": "command_not_discovered"}, "unsupported", "command_not_discovered"),
    ({"version": 1}, "unsupported", "v3_needs_direct_v2"),            # the lab today: rc10, a v1 connection
    ({"offered": False}, "unsupported", "manual_v3_not_offered"),     # no `manual_service_write` block in this discovery
])
def test_the_read_is_sent_only_on_a_v2_connection_that_offers_the_v3_block(kwargs: dict, state: str, reason: str) -> None:
    join = FakeJoin(answers=[active_doc()], **kwargs)
    obs = source(join).refresh()
    assert (obs.state, obs.reason) == (state, reason) and join.sent == [], "nothing leaves Arx"
    assert source(join).current_grant() is None


def test_one_empty_read_and_the_grant_bound_to_its_connection() -> None:
    join = FakeJoin(answers=[active_doc()])
    src = source(join)
    obs = src.refresh()
    assert join.sent == [("service_grants/current_v3", {})], "exactly the READ, empty parameters"
    assert (obs.state, obs.revision, obs.connection_ref, obs.sent) == ("active", 1, REF, True)
    assert src.current_grant() == obs.grant and len(join.sent) == 1, "a fresh observation is reused"
    join.session._link.connection_ref = REF2  # a reconnect: the old observation belongs to a gone connection
    join.session.discovery.capabilities.connection_ref = REF2
    join.answers.append(fixture("service_grants--current_v3.result.valid.json"))
    assert src.current_grant() is None and len(join.sent) == 2, "read again on the new connection: now absent"


def test_a_stale_observation_is_read_again() -> None:
    clock = Clock()
    join = FakeJoin(answers=[active_doc(), fixture("service_grants--current_v3.result.valid.json")])
    src = source(join, clock)
    assert src.current_grant() is not None
    clock.t += v3.FRESHNESS_S
    assert src.current_grant() is None and len(join.sent) == 2, "revoked by the owner meanwhile: no grant any more"


@pytest.mark.parametrize("error,state", [(PortError("Unauthorized", "refused"), "refused"),
                                         (PortError("service_grant_storage_unavailable", "refused"), "refused"),
                                         (PortError("timeout", "unknown"), "unknown"),
                                         (PortError("wiskey_direct_not_connected", "not_sent"), "unavailable"),
                                         (RuntimeError("lost"), "unknown")])
def test_a_refusal_or_a_lost_answer_is_final_and_never_a_grant(error: Exception, state: str) -> None:
    clock = Clock()
    join = FakeJoin(answers=[error])
    src = source(join, clock)
    obs = src.refresh()
    assert obs.state == state and obs.grant is None
    if state == "refused":
        assert obs.wiskey_code == error.code  # type: ignore[attr-defined]
    assert join.sent == [("service_grants/current_v3", {})], "no other command in its place (never read_v3, never an older source)"
    assert src.current_grant() is None and len(join.sent) == 1, "kept for the freshness window: not re-asked on every write"


def test_a_malformed_answer_or_a_changed_connection_is_unknown() -> None:
    join = FakeJoin(answers=[fixture("service_grants--current_v3.result.forbidden-extra.json")])
    obs = source(join).refresh()
    assert (obs.state, obs.reason, obs.grant) == ("unknown", "contract_mismatch", None)

    join = FakeJoin(answers=[active_doc()])
    orig = join.capture_port.call

    def call(command: str, parameters: Any, *, timeout_s: float) -> Any:
        out = orig(command, parameters, timeout_s=timeout_s)
        join.session._link.connection_ref = REF2  # the socket was replaced while the answer travelled
        return out

    join.capture_port.call = call  # type: ignore[method-assign]
    obs = source(join).refresh()
    assert (obs.state, obs.reason, obs.grant) == ("unknown", "connection_changed", None)


def test_an_odd_wiskey_code_is_not_passed_on_verbatim() -> None:
    join = FakeJoin(answers=[PortError("bad code <script>", "refused")])
    assert source(join).refresh().wiskey_code == "unrecognised"


# ================================================================ the owner's actions are never Arx's


def test_the_owner_only_commands_are_refused_before_any_byte() -> None:
    for command in OWNER_ONLY:
        assert wdc.direct_refusal(command) == "owner_action_in_wiskey"
    assert wdc.direct_refusal(v3.COMMAND) is None and v3.COMMAND in wdc.DIRECT_READS_V2


def test_no_module_of_arx_names_an_owner_grant_command_except_the_refusal_table() -> None:
    pattern = re.compile(r'["\'](service_grants/(?:read|preview|commit|revoke)_v3)["\']')
    found = {}
    for path in PACKAGE.rglob("*.py"):
        hits = pattern.findall(path.read_text(encoding="utf-8"))
        if hits:
            found[path.name] = sorted(set(hits))
    assert found == {"wiskey_direct_catalog.py": sorted(OWNER_ONLY)}, "only the table that refuses them names them"
    src = Path(v3.__file__).read_text(encoding="utf-8")
    sent = set(re.findall(r'^[A-Z_]+ = "([a-z_]+/[a-z0-9_]+)"', src, re.M))
    assert sent == {v3.COMMAND}, "the reader declares one command: the READ"


# ================================================================ what the screen gets


def test_the_view_shows_what_wiskey_reported_and_where_the_owner_acts() -> None:
    join = FakeJoin(answers=[active_doc(), PortError("Unauthorized", "refused")])
    src = source(join)
    shown = v3.view(src.refresh())
    text = json.dumps(shown, ensure_ascii=False)
    assert shown["state"] == "active" and shown["commands"] == list(v3.GRANT_COMMANDS) and shown["cards_granted"] is False
    assert (shown["owner_actions_in"], shown["owner_screen_tab"], shown["contract"]) == ("wiskey_owner_screen", "tools", sw.CONTRACT_V3)
    assert "synthetic" not in text and REF not in text, "no grant reference, no connection reference on the screen"
    refused = v3.view(src.refresh())
    assert (refused["state"], refused["wiskey_code"], refused["commands"]) == ("refused", "Unauthorized", [])
    for state in v3.STATES:
        out = v3.view(v3.GrantObservation(state))
        assert out["message_he"] and out["message_en"] and out["cards_granted"] is False
        assert "Home Assistant" not in out["message_he"] + out["message_en"]
    assert v3.view(None)["state"] == "unknown"


def test_the_card_wording_never_says_disabled_on_the_station() -> None:
    he, en = v3.CARD_OFF_TEXT["he"], v3.CARD_OFF_TEXT["en"]
    assert "סנכרון" in he and "בדיקה חוזרת" in he and "removed from the station only after sync and readback" in en
    assert "disabled on the station" not in en.lower() and "may still accept it" in en


# ================================================================ the v3 service-write contract


GRANT = sw.GrantRef("synthetic", 1, "synthetic", "synthetic", 1, 1)


def test_the_v3_metadata_and_its_echo() -> None:
    meta = sw.Metadata(ACTOR, GRANT, "p1", 2, "req-1", "op-1", sw.CONTRACT_V3)
    wire = meta.wire()
    assert wire["contract"] == "wiskey-native-service-write.v3" and sw.check_metadata(wire)
    ok = {"contract": sw.CONTRACT_V3, "schema_version": 1, "state": "completed", "code": "central_saved", "operation_id": "op-1",
          "result": {"id": "p1"}, "receipt": {"user_id": "p1", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"},
          "replay_available": False}
    assert sw.read_result(ok, command="users/update", operation_id="op-1", target_ref="p1", contract=sw.CONTRACT_V3).state == "completed"
    assert sw.read_result(ok, command="users/update", operation_id="op-1", target_ref="p1", contract=sw.CONTRACT) is None, \
        "an echo of another contract is malformed (UNKNOWN), never accepted"


class FakeClient:
    def __init__(self) -> None:
        self.writes: list[tuple[str, dict, sw.Metadata]] = []

    def _repository_id(self) -> str:
        return "repo-1"

    def has_room(self) -> bool:
        return True

    def write(self, command: str, business: dict, meta: sw.Metadata) -> sw.ServiceWriteOutcome:
        self.writes.append((command, dict(business), meta))
        return sw.ServiceWriteOutcome("completed", "central_saved", meta.operation_id, person={"id": "p1"})


def test_the_v3_writer_uses_only_the_grant_wiskey_reported() -> None:
    join = FakeJoin(answers=[active_doc()])
    src = source(join)
    client = FakeClient()
    w = sw.FinalServiceWriter.from_manual_v3(join, src, client=client)  # type: ignore[arg-type]
    assert w.contract == sw.CONTRACT_V3 and w.available()
    w.write(asw.ServiceWrite(action="users/update", data={"display_name": "Synthetic"}, person_id="p1", revision=2))
    command, business, meta = client.writes[0]
    assert command == "users/update" and meta.contract == sw.CONTRACT_V3 and meta.grant == GRANT and meta.actor_id == ACTOR
    assert [c for c, _p in join.sent] == ["service_grants/current_v3"], "one READ; never a grant action"
    assert not w.supports("cards/add") and not w.supports("cards/remove") and not w.supports("users/delete")


def test_the_v3_writer_without_a_grant_sends_nothing() -> None:
    join = FakeJoin(answers=[fixture("service_grants--current_v3.result.valid.json")])
    client = FakeClient()
    w = sw.FinalServiceWriter.from_manual_v3(join, source(join), client=client)  # type: ignore[arg-type]
    assert w.available() is False
    with pytest.raises(EngineError) as exc:
        w.write(asw.ServiceWrite(action="users/create", data={"display_name": "x"}))
    assert (exc.value.kind, exc.value.code) == ("not_sent", "service_grant_required") and client.writes == []


def test_the_production_v3_writer_is_unwired_and_reads_nothing() -> None:
    join = FakeJoin(answers=[active_doc()])
    w = sw.FinalServiceWriter.from_manual_v3(join, source(join))
    assert w.available() is False and join.sent == [], "no journal connection in production: not even the grant is read"


# ================================================================ the explicit path of one people write


class AvailableWriter:
    """An installed writer that claims every action (the EXTERNALBUILD proposal shape): the selection must still keep cards off it."""

    contract = "fake"

    def __init__(self, error: EngineError | None = None) -> None:
        self.calls: list[str] = []
        self.error = error

    def available(self) -> bool:
        return True

    def supports(self, action: str) -> bool:
        return True

    def write(self, op: asw.ServiceWrite) -> dict:
        self.calls.append(op.action)
        if self.error is not None:
            raise self.error
        return {"id": op.person_id or "p1", "revision": 3, "display_name": "x", "employee_no": "1", "active": False, "assignments": {},
                "permission_overrides": {}, "group_ids": [], "pin_configured": False, "access_category": "contractor"}


@pytest.fixture()
def installed(monkeypatch: Any):
    yield
    asw.reset_for_tests()


def test_select_path_is_explicit_and_keeps_cards_and_delete_off_the_service_writer(installed: Any) -> None:
    assert asw.select_path("users/update", None) == asw.PathChoice("service_channel", "provider_local")
    assert asw.select_path("users/update", FakeJoin(selected=False)).reason == "direct_not_selected"
    asw.install(AvailableWriter())
    join = FakeJoin()
    for action in ("cards/add", "cards/remove", "users/delete", None):
        choice = asw.select_path(action, join)
        assert (choice.path, choice.reason, choice.writer) == ("service_channel", "not_a_service_write_action", None)
    choice = asw.select_path("users/update", join)
    assert (choice.path, choice.reason, choice.contract) == ("direct_service_writer", "direct_service_writer", "fake")
    asw.install(None)
    assert asw.select_path("users/update", FakeJoin(version=1)).reason == "direct_service_writer_missing"


def test_writer_for_picks_v3_only_when_the_connection_offers_it(installed: Any, monkeypatch: Any) -> None:
    picked: list[str] = []
    monkeypatch.setattr(sw.FinalServiceWriter, "from_manual_v3", classmethod(lambda cls, j, s, client=None: picked.append("v3") or None))
    monkeypatch.setattr(sw.FinalServiceWriter, "from_join", classmethod(lambda cls, j: picked.append("v1") or None))
    asw.writer_for(FakeJoin())
    asw.writer_for(FakeJoin(offered=False))
    asw.writer_for(FakeJoin(version=1))
    assert picked == ["v3", "v1", "v1"]


@pytest.fixture()
def channel(monkeypatch: Any):
    """The service channel stand-in (records every write that reaches it)."""
    from smplwise.services import access_grants as ag

    calls: list[str] = []

    def action(settings, key, send, project, who, lane=None, target=None):
        calls.append(key)
        return {"person": {"id": "p1", "revision": 2, "display_name": "x", "employee_no": "1", "active": False, "assignments": {},
                           "permission_overrides": {}, "group_ids": [], "pin_configured": False, "access_category": "contractor"}}

    monkeypatch.setattr(intercom_sync.SYNC, "action", action)
    monkeypatch.setattr(intercom_sync.SYNC, "write_gate", lambda target: None)
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    yield calls
    asw.reset_for_tests()


@pytest.mark.parametrize("kind", ["refused", "unknown", "revision_conflict"])
def test_a_refusal_on_the_service_writer_is_final_never_rerouted(monkeypatch: Any, channel: list, kind: str) -> None:
    monkeypatch.setattr(wiskey_direct_join, "JOIN", FakeJoin())
    writer = AvailableWriter(EngineError(kind, "service_grant_denied"))
    asw.install(writer)
    with pytest.raises(EngineError) as exc:
        WiskeyServiceEngine(None).strip("p1", 1)
    assert exc.value.kind == kind and writer.calls == ["users/update"]
    assert channel == [], "no second path, no other contract after the chosen one answered"
    assert asw.last_path()["path"] == "direct_service_writer"


def test_a_card_write_takes_the_classic_path_even_with_a_service_writer(monkeypatch: Any, channel: list) -> None:
    monkeypatch.setattr(wiskey_direct_join, "JOIN", FakeJoin())
    writer = AvailableWriter()
    asw.install(writer)
    WiskeyServiceEngine(None).card_remove("p1", 2, "card-1")
    assert writer.calls == [] and channel == ["person"]
    last = asw.last_path()
    assert (last["path"], last["reason"], last["fallbacks"]) == ("service_channel", "not_a_service_write_action", 0)


CANNOT_CARRY = ("native_write_action_unsupported", "native_write_source_not_observed", "unknown_command")


def test_the_fallback_rule_after_a_verified_refusal_depends_on_the_connection() -> None:
    """Lead decision 25.11: rc19's "no switch after a refusal" applies on a v2 connection; v1 (WisKey rc10, the lab) keeps today's rule."""
    fp = wiskey_direct_join.fallback_permitted
    for code in CANNOT_CARRY:
        assert fp("refused", code) is True and fp("refused", code, protocol_version=1) is True, f"v1 unchanged: {code}"
        assert fp("refused", code, protocol_version=2) is False, f"v2 final: {code}"
    for version in (1, 2):
        assert fp("refused", "revision_conflict", protocol_version=version) is False  # a business refusal: final on both
        assert fp("refused", "service_grant_denied", protocol_version=version) is False
        assert fp("not_sent", "wiskey_direct_not_connected", protocol_version=version) is True  # nothing left Arx: unchanged
        assert fp("unknown", "timeout", protocol_version=version) is False
    assert fp("not_sent", "pairing_mismatch", protocol_version=2) is False  # R7's v2 rule unchanged


@pytest.mark.parametrize("version,classic", [(1, True), (2, False)])
@pytest.mark.parametrize("code", CANNOT_CARRY)
def test_a_cannot_carry_refusal_goes_classic_on_v1_and_is_final_on_v2(live_writer: Any,  # noqa: F811 - the imported fixture
                                                                     monkeypatch: Any, version: int, classic: bool, code: str) -> None:
    """End to end over the fake direct server (tests/test_wiskey_join_live_2382.py fixture): the native write is refused with a
    "cannot carry" code; the people route's classic send runs once on v1 and never on v2."""
    import asyncio

    from test_wiskey_join_live_2382 import received, send_for

    monkeypatch.setattr(wiskey_direct_join, "_protocol_version", lambda join: version)
    live_writer.server.script["users/update"] = {"error": code}
    send, rec = send_for(live_writer)
    if classic:
        assert asyncio.run(send(None))["via"] == "classic"
        assert live_writer.classic == ["sent"] and rec["transport"] == wiskey_direct_join.PATH_CLASSIC_AFTER_DIRECT
        assert (rec["direct_state"], rec["direct_code"]) == ("refused", code)
    else:
        from smplwise.services import intercom_client

        with pytest.raises(intercom_client.IntercomError):
            asyncio.run(send(None))
        assert live_writer.classic == [] and rec["transport"] == wiskey_direct_join.PATH_DIRECT
        assert (rec["direct_state"], rec["direct_code"]) == ("refused", code)
    assert len(received(live_writer.server, "users/update")) == 1, "the native frame is never sent again"


def test_the_protocol_reader_follows_the_current_connection() -> None:
    read = wiskey_direct_join._protocol_version
    assert read(FakeJoin(version=2)) == 2 and read(FakeJoin(version=1)) == 1
    assert read(SimpleNamespace(session=SimpleNamespace(_link=None))) is None and read(object()) is None


# ================================================================ the status route


def test_the_route_reports_without_a_join_and_is_for_system_administrators(settings: Any, monkeypatch: Any) -> None:
    from conftest import as_user
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    monkeypatch.setattr(wiskey_direct_join, "JOIN", None)
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    c.get("/api/v1/me", headers=as_user("dana"))
    r = c.get("/api/v1/system/bridge-key/service-grant")
    assert r.status_code == 200
    body = r.json()
    assert (body["state"], body["reason"], body["cards_granted"], body["owner_screen_tab"]) == ("unavailable", "direct_not_installed", False, "tools")
    denied = c.get("/api/v1/system/bridge-key/service-grant", headers=as_user("dana"))
    assert denied.status_code == 403 and "message_he" not in denied.text


def test_the_route_shows_an_active_grant_without_its_references(settings: Any, monkeypatch: Any) -> None:
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    join = FakeJoin(answers=[active_doc()])
    monkeypatch.setattr(wiskey_direct_join, "JOIN", join)
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    text = c.get("/api/v1/system/bridge-key/service-grant").text
    body = json.loads(text)
    assert body["state"] == "active" and body["revision"] == 1 and body["commands"] == list(v3.GRANT_COMMANDS)
    assert "synthetic" not in text and join.sent == [("service_grants/current_v3", {})]
