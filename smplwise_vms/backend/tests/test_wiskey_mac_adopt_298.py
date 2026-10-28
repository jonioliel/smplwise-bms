"""WISKEY-MAC-ADOPT-298: Arx adoption of the WisKey Mac delivery of 27.10 (docs/changes/WISKEY-MAC-ADOPT-298.md).
FAKES / SYNTHETIC DATA ONLY: no network, Home Assistant, station, door, microphone, speaker, WhatsApp or provider is reached. Every id,
revision and PIN below is invented for the test; no real person, card or PIN appears.

A  router `_pump.from_station`: a native terminal / revocation that arrives while `lease.confirm` is awaited ends publication before
   `send_bytes`; a natural end keeps its admitted tail.
B  `TemplateSender.send_v2`: an explicit approved template inside an open window is sent (WisKey answer 5); no other guard is relaxed.
C  `wiskey-native-service-write.v1` client: closed metadata, durable UNKNOWN before dispatch, request-bound journal (schema 3), PIN only in
   the original reply, status read, no self-grant, no replay after a lost receipt.
D  peer_query closed result lists.
E  the final catalog (SHA-256 dd55f9df...) and the final capabilities document."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from test_wkf01f02_295 import ChannelDouble, SocketDouble, session, settle

from smplwise.routers import intercom_media as router_im
from smplwise.services import intercom_media as im
from smplwise.services import wa_template_send as wts
from smplwise.services import wa_pacing
from smplwise.services import wiskey_direct_catalog as wdc
from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_peer as wp
from smplwise.services import wiskey_service_write as sw
from smplwise.services import intercom_sync
from smplwise.services import access_service_writer as asw
from smplwise.services.access_grant_engine import EngineError

PACKET = bytes([0x55]) * 800
FINAL_CATALOG_SHA256 = "dd55f9df3bc0480729fc9336d066ab741811cfbfe6806df90620166669937293"
FINAL_CODE = "d5a3ab862fab45537cde2f30358e0e9d1f3f9c8b"


# ================================================================ A: the talk route's publication terminal

class NativeTalkDouble(ChannelDouble):
    """The router-facing shape of `WiskeyBridgeTalkChannel` with ITS real `publication_current` (pump / link / expiry are doubles)."""

    SECURITY_ENDS = im.WiskeyBridgeTalkChannel.SECURITY_ENDS
    publication_end = None
    publication_current = im.WiskeyBridgeTalkChannel.publication_current

    def __init__(self) -> None:
        super().__init__()
        self.pump = SimpleNamespace(end_code=None)
        self.link = SimpleNamespace(closed=False)
        self.expires_at = time.time() + 30


class GatedLease:
    """A lease whose awaited `confirm` blocks until the test lets it go - the window the Mac review names."""

    def __init__(self) -> None:
        self.gate = asyncio.Event()
        self.entered = asyncio.Event()
        self.block = False

    async def confirm(self) -> bool:
        if self.block:
            self.entered.set()
            await self.gate.wait()
        return True

    def should_stop(self) -> bool:
        return False


@pytest.mark.parametrize("terminal", ["access_lost", "source_changed", "connection_closed", "expired", "talk_audio_invalid", "link_closed"])
def test_a_native_terminal_during_confirm_publishes_nothing(terminal: str) -> None:
    async def scenario() -> None:
        ws, ch, t, lease = SocketDouble(), NativeTalkDouble(), session(30), GatedLease()
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        ch.audio.put_nowait(PACKET)
        await settle(lambda: len(ws.sent_bytes) == 1)  # a current packet is published
        lease.block = True
        ch.audio.put_nowait(PACKET)
        await asyncio.wait_for(lease.entered.wait(), 2)  # the router now awaits confirm for the second packet
        if terminal == "link_closed":
            ch.link.closed = True
        else:
            ch.pump.end_code = terminal  # WisKey's terminal / revocation arrives during the await
        lease.gate.set()
        outcome = await asyncio.wait_for(task, 3)
        assert outcome == "upstream_closed"
        assert ws.sent_bytes == [PACKET], "the packet queued before the terminal is never published after it"
        assert ch.publication_current() is False, "a terminal stays terminal"

    asyncio.run(scenario())


@pytest.mark.parametrize("natural", ["idle_timeout", "ended", "stopped", "upstream_closed"])
def test_a_natural_end_during_confirm_keeps_the_authorised_tail(natural: str) -> None:
    async def scenario() -> None:
        ws, ch, t, lease = SocketDouble(), NativeTalkDouble(), session(30), GatedLease()
        lease.block = True
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        ch.audio.put_nowait(PACKET)
        await asyncio.wait_for(lease.entered.wait(), 2)
        ch.pump.end_code = natural  # a natural end while the tail packet waits: authority unchanged
        lease.gate.set()
        await settle(lambda: len(ws.sent_bytes) == 1)
        assert ws.sent_bytes == [PACKET], "the admitted natural tail is still published"
        t.stop_requested = "stopped"
        ch.audio.put_nowait(PACKET)
        assert await asyncio.wait_for(task, 3) == "stopped"

    asyncio.run(scenario())


def test_a_channel_close_fences_publication_and_the_expiry_is_checked_without_await() -> None:
    ch = NativeTalkDouble()
    assert ch.publication_current() is True
    ch.expires_at = time.time() - 0.001
    assert ch.publication_current() is False and ch.publication_end == "expired"
    real = im.WiskeyBridgeTalkChannel.__new__(im.WiskeyBridgeTalkChannel)
    real.pump, real.link, real.ref, real._close_sent, real._closed = None, None, None, False, None
    real._incoming, real._opening_events, real.expires_at = asyncio.Queue(), [], time.time() + 30
    asyncio.run(real.close("access_lost"))
    assert real.publication_current() is False and real.publication_end == "access_lost"


# ================================================================ B: send_v2 inside an open window

class V2Fake:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send_v2(self, wire: dict[str, Any]) -> dict[str, Any]:
        self.sent.append(dict(wire))
        return {"schema_version": 2, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "unknown",
                "retry_permitted": False}


class Pacer:
    def __init__(self, allowed: bool = True) -> None:
        self.allowed = allowed
        self.results: list[str] = []

    def check(self, **kw: Any) -> Any:
        now = kw["now"]
        return SimpleNamespace(allowed=self.allowed, expired=False, not_before=now)

    def on_result(self, **kw: Any) -> None:
        self.results.append(kw["outcome"])


def _sender(fake: V2Fake, *, switch: bool = True, permit: bool = True, pacer: Pacer | None = None) -> wts.TemplateSender:
    ref = wts.TemplateRef("notice", "synthetic_notice", "he", (), "notice", wiskey_ref="tpl-synthetic", wiskey_revision=3)
    p = pacer or Pacer()
    return wts.TemplateSender(fake, registry=lambda: [ref], switch=lambda: switch, permit_fn=lambda: permit, pacer=p,  # type: ignore[arg-type]
                              pacing_for=lambda _a: None)


def _v2(sender: wts.TemplateSender, window: str = "open", rid: str = "req-1") -> wts.TemplateResult:
    return sender.send_v2(template_id="notice", account="acct-synthetic", account_key="wiskey:acct-synthetic", person_id="person-synthetic",
                          recipient_key="r-synthetic", request_id=rid, operation_id="op-" + rid, person_revision=4, window=window)


def test_b_an_explicit_approved_template_is_sent_inside_an_open_window() -> None:
    fake = V2Fake()
    r = _v2(_sender(fake), "open")
    assert r.outcome == "sent" and len(fake.sent) == 1
    assert set(fake.sent[0]) == wts.V2_REQUEST_KEYS and fake.sent[0]["template_ref"] == "tpl-synthetic"
    assert _v2(_sender(fake), "closed", "req-2").outcome == "sent" and _v2(_sender(fake), "unknown", "req-3").outcome == "sent"


def test_b_the_open_window_relaxes_nothing_else() -> None:
    fake = V2Fake()
    assert _v2(_sender(fake, switch=False)).code == "template_unsupported"
    assert _v2(_sender(fake, permit=False)).code == "template_unsupported"
    assert _v2(_sender(fake, pacer=Pacer(allowed=False))).code == "paced"
    assert _v2(_sender(fake), "maybe").code == "invalid_fields"
    assert fake.sent == [], "no refusal handed anything over"
    # the v1 route keeps its own rule (F3C TP-04): a notice inside an open window is still free text's job there
    assert "window_open" in wts.TemplateSender.send.__code__.co_consts


# ================================================================ C: wiskey-native-service-write.v1

GRANT = sw.GrantRef("synthetic-authority", 3, "synthetic-scope", "synthetic-grant", 7, 2)
REPO = "synthetic-repository-1"
ACTOR = "arx-service:synthetic-entry"
KEY = bytes(range(32))  # a synthetic install key
PERSON = {"id": "person-synthetic-1", "revision": 1, "display_name": "Synthetic person", "active": False}


def _meta(op: str = "op-1", req: str = "req-1", target: str = "origin-1", rev: int | None = None, actor: str = ACTOR) -> sw.Metadata:
    return sw.Metadata(actor, GRANT, target, rev, req, op)


def _ok(op: str, code: str = "central_saved", *, receipt: dict[str, Any] | None = None, result: Any = PERSON) -> dict[str, Any]:
    out = {"contract": sw.CONTRACT, "schema_version": 1, "state": "completed", "code": code, "operation_id": op,
           "receipt": receipt or {"user_id": "person-synthetic-1", "person_revision": 1, "central_state": "saved", "device_application": "not_proven"},
           "replay_available": False}
    if result is not None:
        out["result"] = result
    return out


class Wire:
    """The direct port double: records a COPY of every frame, answers from a script; `.outcome`/`.code` errors like PortError."""

    def __init__(self, *answers: Any) -> None:
        self.answers = list(answers)
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def __call__(self, command: str, params: dict[str, Any]) -> Any:
        self.calls.append((command, json.loads(json.dumps(params))))
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a


class PortErr(Exception):
    def __init__(self, code: str, outcome: str) -> None:
        super().__init__(code)
        self.code, self.outcome = code, outcome


def _client(wire: Wire, conn: sqlite3.Connection | None = None, repo: str | None = REPO) -> sw.ServiceWriteClient:
    return sw.ServiceWriteClient(wire, sw.Journal(conn or sqlite3.connect(":memory:")), repository_id=lambda: repo, key=KEY,
                                 gate=intercom_sync.IntercomSync())


CREATE = {"data": {"display_name": "Synthetic person", "access_category": "contractor", "active": False}, "sync_now": False}


def test_c_the_metadata_is_the_closed_13_key_object_and_the_request_carries_exactly_one_new_key() -> None:
    wire = Wire(_ok("op-1"))
    out = _client(wire).write("users/create", CREATE, _meta())
    (command, params), = wire.calls
    assert command == "users/create" and set(params) == {"data", "sync_now", "service_write"}
    assert set(params["service_write"]) == sw.META_KEYS and sw.check_metadata(params["service_write"])
    assert params["service_write"]["role"] == "access_manager" and params["service_write"]["target_revision"] is None
    assert out.state == "completed" and out.code == "central_saved" and out.person == PERSON and out.receipt.person_revision == 1


@pytest.mark.parametrize("command,business,meta,code", [
    ("users/delete", {"user_id": "p"}, _meta(), "service_command_unsupported"),
    ("users/create", {"data": {"display_name": "x", "group_ids": []}}, _meta(), "service_field_denied"),
    ("users/create", {**CREATE, "service_write": {}}, _meta(), "invalid_fields"),
    ("users/create", CREATE, _meta(rev=1), "invalid_fields"),
    ("users/update", {"user_id": "p1", "revision": 2, "data": {"active": False}}, _meta(target="p1", rev=3), "invalid_fields"),
    ("users/update", {"user_id": "p2", "revision": 2, "data": {"active": False}}, _meta(target="p1", rev=2), "invalid_fields"),
    ("users/temporary_cancel", {"user_id": "p1", "revision": 2, "reason_code": "because"}, _meta(target="p1", rev=2), "invalid_fields"),
    ("users/pin_generate", {"user_id": "p1"}, _meta(target="p1", rev=None), "invalid_fields"),
    ("users/create", CREATE, _meta(actor="someone"), "service_actor_mismatch"),
])
def test_c_local_refusals_send_nothing_and_record_nothing(command: str, business: dict, meta: sw.Metadata, code: str) -> None:
    wire, conn = Wire(), sqlite3.connect(":memory:")
    with pytest.raises(sw.ServiceWriteError) as exc:
        _client(wire, conn).write(command, business, meta)
    assert (exc.value.code, exc.value.outcome) == (code, "not_sent") and wire.calls == []
    assert conn.execute("SELECT COUNT(*) FROM wiskey_service_write_journal").fetchone()[0] == 0


def test_c_no_repository_identity_no_write() -> None:
    wire = Wire()
    with pytest.raises(sw.ServiceWriteError) as exc:
        _client(wire, repo=None).write("users/create", CREATE, _meta())
    assert exc.value.code == "service_write_source_unavailable" and wire.calls == []


def test_c_the_intent_is_durable_unknown_before_the_frame_leaves_and_a_lost_receipt_is_never_replayed(tmp_path: Path) -> None:
    db = tmp_path / "journal.sqlite"
    seen: list[tuple[str, str]] = []

    def lost(command: str, params: dict[str, Any]) -> Any:
        other = sqlite3.connect(db)  # an independent reader sees the durable row DURING the dispatch
        seen.extend(other.execute("SELECT state, request_sha256 FROM wiskey_service_write_journal").fetchall())
        other.close()
        raise PortErr("connection_closed", "unknown")  # the receipt is lost

    client = sw.ServiceWriteClient(lost, sw.Journal(sqlite3.connect(db)), repository_id=lambda: REPO, key=KEY)
    with pytest.raises(sw.ServiceWriteError) as exc:
        client.write("users/create", CREATE, _meta())
    assert exc.value.outcome == "unknown" and seen and seen[0][0] == "unknown" and len(seen[0][1]) == 64
    # a restart: a NEW process opens the same journal; the same request is observed, never sent again
    wire = Wire()
    again = sw.ServiceWriteClient(wire, sw.Journal(sqlite3.connect(db)), repository_id=lambda: REPO, key=KEY).write("users/create", CREATE, _meta())
    assert (again.state, again.dispatched, wire.calls) == ("unknown", False, [])
    # a changed request under the same operation is a conflict, never acknowledged with the old record
    with pytest.raises(sw.ServiceWriteError) as conflict:
        sw.ServiceWriteClient(wire, sw.Journal(sqlite3.connect(db)), repository_id=lambda: REPO, key=KEY).write(
            "users/create", {**CREATE, "data": {**CREATE["data"], "display_name": "Changed"}}, _meta())
    assert conflict.value.code == "service_operation_conflict" and wire.calls == []
    # the same request id under a fresh operation is refused too
    with pytest.raises(sw.ServiceWriteError) as dup:
        sw.ServiceWriteClient(wire, sw.Journal(sqlite3.connect(db)), repository_id=lambda: REPO, key=KEY).write("users/create", CREATE, _meta(op="op-2"))
    assert dup.value.code == "service_origin_or_request_already_recorded" and wire.calls == []


def test_c_status_settles_an_unknown_only_with_a_verified_completed_receipt() -> None:
    conn = sqlite3.connect(":memory:")
    status_unknown = {"contract": sw.CONTRACT, "schema_version": 1, "state": "unknown", "operation_id": "op-1", "receipt": None,
                      "replay_available": False}
    status_done = {**status_unknown, "state": "completed", "receipt": _ok("op-1")["receipt"]}
    wire = Wire(PortErr("timeout", "unknown"), status_unknown, {"state": "completed"}, status_done)
    c = _client(wire, conn)
    with pytest.raises(sw.ServiceWriteError):
        c.write("users/create", CREATE, _meta())
    assert c.status("op-1").state == "unknown" and c.journal.get(REPO, "op-1").state == "unknown"  # missing stays unknown
    assert c.status("op-1").code == "invalid_response" and c.journal.get(REPO, "op-1").state == "unknown"
    done = c.status("op-1")
    assert done.state == "completed" and c.journal.get(REPO, "op-1").state == "completed"
    assert [cmd for cmd, _p in wire.calls] == ["users/create"] + [sw.STATUS_COMMAND] * 3
    assert wire.calls[1][1] == {"operation_id": "op-1"}, "the status read carries the operation id only"


def test_c_the_pin_lives_only_in_the_original_reply() -> None:
    conn = sqlite3.connect(":memory:")
    receipt = {"user_id": "p1", "person_revision": 1, "central_state": "unchanged_pin_generated_not_saved", "device_application": "not_proven"}
    wire = Wire(_ok("op-9", "pin_generated_not_saved", receipt=receipt, result={"pin": "000111"}),
                _ok("op-9", "operation_already_recorded", receipt=receipt, result=None))
    c = _client(wire, conn)
    out = c.write("users/pin_generate", {"user_id": "p1"}, _meta(op="op-9", req="req-9", target="p1", rev=1))
    assert out.pin == "000111" and out.receipt.central_state == "unchanged_pin_generated_not_saved"
    assert "000111" not in repr(out)
    dump = "\n".join(str(r) for r in conn.execute("SELECT * FROM wiskey_service_write_journal"))
    assert "000111" not in dump, "no PIN in the journal"
    again = c.write("users/pin_generate", {"user_id": "p1"}, _meta(op="op-9", req="req-9", target="p1", rev=1))
    assert again.pin is None and again.dispatched is False and len(wire.calls) == 1, "a duplicate never returns the PIN, never re-sends"
    # a reply that replays a private result with the duplicate code is not accepted
    assert sw.read_result(_ok("op-9", "operation_already_recorded", receipt=receipt, result={"pin": "1"}), command="users/pin_generate",
                          operation_id="op-9") is None


def test_c_the_journal_never_holds_a_pin_even_as_a_searchable_hash() -> None:
    upd = {"user_id": "p1", "revision": 2, "data": {"pin": "123456", "active": True}}
    a = sw.build_parameters("users/update", upd, _meta(target="p1", rev=2))
    b = sw.build_parameters("users/update", {**upd, "data": {"pin": "654321", "active": True}}, _meta(target="p1", rev=2))
    assert sw.request_mac(KEY, "users/update", a) == sw.request_mac(KEY, "users/update", b)
    c = sw.build_parameters("users/update", {**upd, "data": {"pin": "123456", "active": False}}, _meta(target="p1", rev=2))
    assert sw.request_mac(KEY, "users/update", a) != sw.request_mac(KEY, "users/update", c), "every other field still binds the request"


@pytest.mark.parametrize("code,outcome,state", [
    ("service_grant_denied", "refused", "refused"),
    ("revision_conflict", "refused", "refused"),
    ("service_write_outcome_unknown", "unknown", "unknown"),
    ("some_new_code", "unknown", "unknown"),
])
def test_c_only_a_closed_verified_refusal_is_a_refusal(code: str, outcome: str, state: str) -> None:
    c = _client(Wire(PortErr(code, "refused")))
    with pytest.raises(sw.ServiceWriteError) as exc:
        c.write("users/create", CREATE, _meta())
    assert exc.value.outcome == outcome and c.journal.get(REPO, "op-1").state == state


@pytest.mark.parametrize("raw", [
    {**_ok("op-1"), "replay_available": True},
    {**_ok("op-1"), "operation_id": "op-other"},
    {**_ok("op-1"), "contract": "wiskey-native-bridge-write.v1"},
    {**_ok("op-1"), "extra": 1},
    {**_ok("op-1"), "receipt": {**_ok("op-1")["receipt"], "device_application": "applied"}},
    {**_ok("op-1"), "code": "never_committed"},
])
def test_c_a_malformed_success_is_unknown(raw: dict[str, Any]) -> None:
    c = _client(Wire(raw))
    out = c.write("users/create", CREATE, _meta())
    assert out.state == "unknown" and c.journal.get(REPO, "op-1").state == "unknown"


def test_c_capacity_is_bounded_without_evicting_an_unknown_row() -> None:
    conn = sqlite3.connect(":memory:")
    c = _client(Wire(), conn)
    rows = [(3, REPO, f"op-x{i}", f"req-x{i}", "users/create", f"o{i}", "0" * 64, "unknown", "t") for i in range(sw.JOURNAL_CAPACITY)]
    conn.executemany("INSERT INTO wiskey_service_write_journal (schema_version, repository_id, operation_id, request_id, command, target_ref, "
                     "request_sha256, state, created_at) VALUES (?,?,?,?,?,?,?,?,?)", rows)
    with pytest.raises(sw.ServiceWriteError) as exc:
        c.write("users/create", CREATE, _meta())
    assert exc.value.code == "service_write_capacity" and c.journal.count(REPO) == sw.JOURNAL_CAPACITY


def test_c_no_self_grant_and_no_peer_resolve_in_the_service_client() -> None:
    import re

    src = Path(sw.__file__).read_text(encoding="utf-8")
    literals = set(re.findall(r'"([a-z_]+/[a-z0-9_]+)"', src))  # every command-shaped string literal of the module (docstring backticks excluded)
    assert "peer_receipts/resolve" not in literals, "service receipts are never sent to the W1 resolve read"
    assert literals <= set(sw.COMMANDS) | {sw.STATUS_COMMAND, "users/delete", "cards/add", "cards/remove"}, "no grant / config write command"
    assert '"native_service_grants_v1"' not in src, "Arx never names the owner's grant option as a key it could write"
    sent = set(sw.COMMANDS) | {sw.STATUS_COMMAND}
    assert sent == {"users/create", "users/update", "users/pin_generate", "users/temporary_cancel", "users/service_write_status_v1"}
    production = sw.FinalServiceWriter.from_join(SimpleNamespace(selected=lambda _c: True, session=SimpleNamespace(entry_id="e1")))
    assert production.available() is False, "no owner grant configured: the production writer sends nothing"
    with pytest.raises(EngineError) as exc:
        production.write(asw.ServiceWrite(action="users/create", data={"display_name": "x"}))
    assert (exc.value.kind, exc.value.code) == ("not_sent", "service_grant_required")


def test_c_the_grant_engine_port_maps_to_the_final_contract() -> None:
    wire = Wire(_ok("op-a"))
    ids = iter(["a"])
    w = sw.FinalServiceWriter(selected=lambda _c: True, client=_client(wire), grant=lambda: GRANT, actor_id=ACTOR, new_id=lambda: next(ids))
    assert w.available() and w.supports("users/update") and not w.supports("users/delete") and not w.supports("cards/add")
    person = w.write(asw.ServiceWrite(action="users/create", data={"display_name": "Synthetic person", "active": False}))
    assert person == PERSON and wire.calls[0][1]["service_write"]["operation_id"] == "op-a"
    with pytest.raises(EngineError) as exc:
        w.write(asw.ServiceWrite(action="users/delete", person_id="p1", revision=1))
    assert exc.value.kind == "not_sent" and len(wire.calls) == 1


def test_c_vector_shapes_round_trip() -> None:
    """The synthetic request shapes of WisKey's numbered vectors (users/create, update, pin_generate, temporary_cancel) build through the
    client's closed builder unchanged (values invented here)."""
    m = _meta(target="p1", rev=2)
    assert set(sw.build_parameters("users/update", {"user_id": "p1", "revision": 2, "data": {"active": True}, "sync_now": False}, m)) == {
        "user_id", "revision", "data", "sync_now", "service_write"}
    assert set(sw.build_parameters("users/temporary_cancel", {"user_id": "p1", "revision": 2, "reason_code": "visit_completed"}, m)) == {
        "user_id", "revision", "reason_code", "service_write"}
    assert set(sw.build_parameters("users/pin_generate", {"user_id": "p1"}, m)) == {"user_id", "service_write"}


# ================================================================ D: peer_query closed result lists

def test_d_peer_result_classes_are_closed() -> None:
    found = {"type": "result", "id": 1, "success": True, "result": {"schema_version": 1, "state": "found", "receipt": {
        "central_state": "committed", "device_application": "unknown", "signed_capture_covered": False, "person_revision": 2}}}
    unknown = {"type": "result", "id": 1, "success": True, "result": {"schema_version": 1, "state": "unknown", "receipt": None}}
    R = wp.PeerReadReceipt
    assert wp.peer_result_class(R("peer_receipts/resolve", "result"), found) == "central_commit_proved_only"
    assert wp.peer_result_class(R("peer_receipts/resolve", "result"), unknown) == "unknown_no_retry"
    assert wp.peer_result_class(R("peer_receipts/resolve", "refused", "binding_denied")).startswith("authenticated_refusal")
    assert wp.peer_result_class(R("peer_bindings/get", "refused", "binding_denied")).startswith("authenticated_refusal")
    assert wp.peer_result_class(R("peer_receipts/resolve", "refused", "Unauthorized")) == "unknown_no_retry"  # transport layer, not the read
    assert wp.peer_result_class(R("peer_receipts/resolve", "unknown", "timeout")) == "unknown_no_retry"
    assert wp.peer_result_class(R("peer_receipts/resolve", "not_sent", "not_connected")) == "client_transport_proof_only"
    assert wp.PEER_RESOLVE_STATES == ("found", "unknown") and "never_committed" not in wp.PEER_RESULT_CLASSES


# ================================================================ E: the final catalog and capabilities

def test_e_the_runtime_catalog_is_the_final_one() -> None:
    c = wdc.load()
    assert c.source_sha256 == FINAL_CATALOG_SHA256 and c.code == FINAL_CODE
    assert c.registered_count == 276 and c.command_count == 279 and len(c.families) == 43
    assert c.get("users/service_write_status_v1") is not None and wdc.envelope_for("users/service_write_status_v1") == "wiskey-bridge-command.v1"
    assert c.get("features/people_csv_preview") is not None
    for name in sw.COMMANDS:
        assert wdc.envelope_for(name) == "wiskey-bridge-command.v1"


def _final_capabilities() -> dict[str, Any]:
    from test_wkjoin_295 import JoinServer

    doc = JoinServer().capabilities_doc()
    doc["business_contracts"] = {"features/start": {"contract": "wiskey-arx-feature-execution.v1",
                                                    "emergency_private_input_contract": "wiskey-emergency-event.v2"},
                                 "stations/technical_program_*": {"api_contract": 1}, "peer_query": {"contract": "wiskey-peer-query.v1"},
                                 "whatsapp/template_send_v2": {"schema_version": 2, "contract_revision": 2}}
    doc["native_service_write"] = json.loads(json.dumps(dd.SERVICE_WRITE_CAP))
    doc["station_talk_audio"] = dict(dd.TALK_AUDIO_CAP)
    return doc


def test_e_the_final_capabilities_document_is_read_and_unknown_blocks_are_refused() -> None:
    cap = dd.read_capabilities(_final_capabilities(), "ref-1")
    assert cap.service_write and cap.talk_audio and cap.business_contracts["whatsapp/template_send_v2"]["contract_revision"] == 2
    older = dd.read_capabilities({k: v for k, v in _final_capabilities().items() if k not in dd._CAP_OPTIONAL}, "ref-1")
    assert not older.service_write and not older.talk_audio  # an older WisKey: nothing assumed
    with pytest.raises(dd.DiscoveryError) as exc:
        dd.read_capabilities({**_final_capabilities(), "durable_event_cursor": {}}, "ref-1")
    assert exc.value.code == "capabilities_invalid"
    bad = _final_capabilities()
    bad["native_service_write"]["default_authority"] = "service_role_fallback"
    other = dd.read_capabilities(bad, "ref-1")  # another service-write contract is never used (review M3: the discovery itself stands)
    assert other.service_write is False and other.rejected_blocks == ("native_service_write",)
