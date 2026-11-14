"""WISKEY-MAC-ADOPT-298 review fixes (independent review of 00066e011). Each test names the finding it pins.
FAKES / SYNTHETIC DATA ONLY: no network, Home Assistant, station, door, WhatsApp or provider is reached. Every id, revision, key and PIN
below is invented for the test.

F1  the journal cap: settled rows are pruned, unknown rows never; `available()` goes False near the cap.
F2  an UNKNOWN service write blocks the next write to the same person (the shared people write gate + Arx's own journal); unknown rows
    can be settled through `status()`.
F3  a PIN-bearing duplicate never answers `completed`.
F4  the request digest is an HMAC under an install-local key kept outside the database.
F5  raw sqlite / TypeError failures become clean errors; the PIN is a fixed-length ASCII value; a receipt names the target person.
M1  a natural end keeps its tail even when the link closes after it.          M2  a security end is named in the talk's audit row.
M3  one bad optional capabilities block does not fail the discovery.          M4  send_v2 checks the window before the shared budget."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from test_wiskey_mac_adopt_298 import (CREATE, GRANT, REPO, ACTOR, GatedLease, NativeTalkDouble, PACKET, PortErr, Wire, _final_capabilities,
                                       _meta, _ok, _sender, _v2, V2Fake)
from test_wkf01f02_295 import SocketDouble, session, settle

from smplwise.routers import intercom_media as router_im
from smplwise.services import intercom_sync
from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_service_write as sw

KEY = bytes(range(32))  # a synthetic install key (the real one is random, in a file outside the database)


def _client(wire: Any, conn: sqlite3.Connection | None = None, *, key: bytes | None = KEY, gate: Any = None) -> sw.ServiceWriteClient:
    return sw.ServiceWriteClient(wire, sw.Journal(conn or sqlite3.connect(":memory:")), repository_id=lambda: REPO, key=key,
                                 gate=gate if gate is not None else intercom_sync.IntercomSync())


def _fill(conn: sqlite3.Connection, n: int, state: str, settled_at: str | None, prefix: str = "x") -> None:
    rows = [(3, REPO, f"op-{prefix}{i}", f"req-{prefix}{i}", "users/create", f"o{prefix}{i}", "0" * 64, state, "2026-01-01T00:00:00.000000Z",
             settled_at) for i in range(n)]
    conn.executemany("INSERT INTO wiskey_service_write_journal (schema_version, repository_id, operation_id, request_id, command, target_ref, "
                     "request_sha256, state, created_at, settled_at) VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
    conn.commit()


def _ago(**delta: float) -> str:
    from datetime import datetime, timedelta, timezone

    return (datetime.now(timezone.utc) - timedelta(**delta)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


UPDATE = {"user_id": "p1", "revision": 2, "data": {"active": False}}


def _upd_meta(op: str, req: str) -> sw.Metadata:
    return _meta(op=op, req=req, target="p1", rev=2)


def _writer(client: sw.ServiceWriteClient) -> sw.FinalServiceWriter:
    return sw.FinalServiceWriter(selected=lambda _c: True, client=client, grant=lambda: GRANT, actor_id=ACTOR, new_id=lambda: "n1")


# ================================================================ F1 the journal cap

def test_f1_settled_rows_are_pruned_so_the_cap_never_blocks_for_ever() -> None:
    conn = sqlite3.connect(":memory:")
    wire = Wire(_ok("op-1"))
    c = _client(wire, conn)
    _fill(conn, sw.JOURNAL_CAPACITY, "completed", _ago(days=2))  # inside the retention: only the high-water prune can free them
    assert _writer(c).available() is True, "settled rows are prunable: the writer is not stuck at the cap"
    out = c.write("users/create", CREATE, _meta())
    assert out.state == "completed" and len(wire.calls) == 1
    assert c.journal.count(REPO) <= sw.PRUNE_LOW + 1, "the oldest settled rows were pruned"
    assert c.journal.get(REPO, "op-1").state == "completed", "the new row is kept"


def test_f1_unknown_rows_are_never_pruned_and_available_goes_false_near_the_cap() -> None:
    conn = sqlite3.connect(":memory:")
    wire = Wire()
    c = _client(wire, conn)
    _fill(conn, sw.JOURNAL_CAPACITY - sw.JOURNAL_HEADROOM, "unknown", None)
    assert _writer(c).available() is False, "near the cap the writer is not available"
    with pytest.raises(sw.ServiceWriteError) as exc:
        c.write("users/create", CREATE, _meta())
    assert (exc.value.code, exc.value.outcome) == ("service_write_capacity", "not_sent") and wire.calls == []
    assert c.journal.count(REPO) == sw.JOURNAL_CAPACITY - sw.JOURNAL_HEADROOM, "no unknown row is ever evicted"


def test_f1_prune_keeps_every_unknown_row_and_removes_the_oldest_settled_first() -> None:
    conn = sqlite3.connect(":memory:")
    j = sw.Journal(conn)
    _fill(conn, 10, "unknown", None, "u")
    _fill(conn, sw.PRUNE_HIGH, "refused", "2026-01-01T00:00:00.000000Z", "old")
    _fill(conn, 5, "completed", "2099-01-01T00:00:00.000000Z", "new")
    j.prune(REPO)
    states = dict(conn.execute("SELECT state, COUNT(*) FROM wiskey_service_write_journal GROUP BY state").fetchall())
    assert states["unknown"] == 10 and states["completed"] == 5 and j.count(REPO) <= sw.PRUNE_LOW


def test_f1_a_freshly_settled_row_is_never_pruned_so_its_retry_is_still_observed() -> None:
    conn = sqlite3.connect(":memory:")
    wire = Wire(_ok("op-1"))
    c = _client(wire, conn)
    _fill(conn, sw.JOURNAL_CAPACITY - sw.JOURNAL_HEADROOM - 1, "completed", _ago(seconds=5))
    assert c.write("users/create", CREATE, _meta()).state == "completed"
    assert c.journal.count(REPO) == sw.JOURNAL_CAPACITY - sw.JOURNAL_HEADROOM, "no row younger than the minimum age is pruned"
    again = c.write("users/create", CREATE, _meta())
    assert again.dispatched is False and len(wire.calls) == 1, "the retry is still observed, never dispatched again"
    assert _writer(c).available() is False, "full of fresh rows: not available"
    with pytest.raises(sw.ServiceWriteError) as exc:
        c.write("users/create", CREATE, _meta(op="op-2", req="req-2"))
    assert exc.value.code == "service_write_capacity" and len(wire.calls) == 1


def test_f1_the_availability_probe_never_deletes() -> None:
    conn = sqlite3.connect(":memory:")
    c = _client(Wire(), conn)
    _fill(conn, sw.JOURNAL_CAPACITY, "completed", _ago(days=60))
    assert _writer(c).available() is True and c.journal.count(REPO) == sw.JOURNAL_CAPACITY, "available() is a read"


# ================================================================ F2 the people write gate

def test_f2_pin_generate_respects_a_held_person_but_does_not_hold_it() -> None:
    gate = intercom_sync.IntercomSync()
    with pytest.raises(sw.ServiceWriteError):
        _client(Wire(PortErr("timeout", "unknown")), gate=gate).write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    wire = Wire()
    with pytest.raises(sw.ServiceWriteError) as held:
        _client(wire, gate=gate).write("users/pin_generate", {"user_id": "p1"}, _meta(op="op-9", req="req-9", target="p1", rev=1))
    assert (held.value.code, held.value.outcome) == ("readback_required", "not_sent") and wire.calls == []
    free = intercom_sync.IntercomSync()
    with pytest.raises(sw.ServiceWriteError):
        _client(Wire(PortErr("timeout", "unknown")), gate=free).write("users/pin_generate", {"user_id": "p2"},
                                                                      _meta(op="op-8", req="req-8", target="p2", rev=1))
    assert free.write_gate(intercom_sync.person_target("p2")) is None, "an unknown pin_generate saves nothing: no hold"


def test_f2_a_concurrent_admission_of_the_same_operation_is_not_sent_and_releases_the_gate() -> None:
    gate = intercom_sync.IntercomSync()
    wire = Wire()
    c = _client(wire, gate=gate)
    real_admit = c.journal.admit_unknown

    def racing(**kw: Any) -> None:  # another writer inserts the same operation between the checks and this insert
        real_admit(**kw)
        real_admit(**kw)

    c.journal.admit_unknown = racing  # type: ignore[method-assign]
    with pytest.raises(sw.ServiceWriteError) as exc:
        c.write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    assert (exc.value.code, exc.value.outcome) == ("service_origin_or_request_already_recorded", "not_sent") and wire.calls == []
    assert gate.write_gate(intercom_sync.person_target("p1")) is None, "the gate admission was released"

def test_f2_an_unknown_update_blocks_the_next_write_to_the_same_person() -> None:
    gate = intercom_sync.IntercomSync()
    wire = Wire(PortErr("timeout", "unknown"))
    c = _client(wire, gate=gate)
    with pytest.raises(sw.ServiceWriteError) as first:
        c.write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    assert first.value.outcome == "unknown"
    assert gate.write_gate(intercom_sync.person_target("p1")) == "readback_required", "the shared people gate holds the person"
    with pytest.raises(sw.ServiceWriteError) as second:
        c.write("users/update", UPDATE, _upd_meta("op-2", "req-2"))
    assert (second.value.code, second.value.outcome) == ("service_write_unsettled", "not_sent") and len(wire.calls) == 1
    assert c.journal.get(REPO, "op-2") is None, "a held write is not recorded"
    # another writer of the same process (its own journal, the same shared gate) is held by the gate itself
    other_wire = Wire()
    with pytest.raises(sw.ServiceWriteError) as third:
        _client(other_wire, gate=gate).write("users/update", UPDATE, _upd_meta("op-3", "req-3"))
    assert (third.value.code, third.value.outcome) == ("readback_required", "not_sent") and other_wire.calls == []


def test_f2_the_journal_holds_the_person_across_a_restart_until_status_settles_it(tmp_path: Path) -> None:
    db = tmp_path / "j.sqlite"
    with pytest.raises(sw.ServiceWriteError):
        _client(Wire(PortErr("timeout", "unknown")), sqlite3.connect(db)).write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    # a new process: the in-memory gate is fresh, the durable row still holds the person
    status_done = {"contract": sw.CONTRACT, "schema_version": 1, "state": "completed", "operation_id": "op-1",
                   "receipt": {"user_id": "p1", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"},
                   "replay_available": False}
    wire = Wire(status_done, _ok("op-2", receipt={"user_id": "p1", "person_revision": 4, "central_state": "saved",
                                                  "device_application": "not_proven"}))
    c = _client(wire, sqlite3.connect(db))
    with pytest.raises(sw.ServiceWriteError) as held:
        c.write("users/update", UPDATE, _upd_meta("op-2", "req-2"))
    assert (held.value.code, held.value.outcome) == ("service_write_unsettled", "not_sent") and wire.calls == []
    assert c.unsettled() == ["op-1"], "a caller can list what needs a status read"
    settled = c.settle_unknown()
    assert [o.state for o in settled] == ["completed"] and c.journal.get(REPO, "op-1").state == "completed"
    assert c.write("users/update", UPDATE, _upd_meta("op-2", "req-2")).state == "completed"


def test_f2_status_does_not_replace_the_fresh_read_of_the_shared_gate() -> None:
    gate = intercom_sync.IntercomSync()
    status_done = {"contract": sw.CONTRACT, "schema_version": 1, "state": "completed", "operation_id": "op-1",
                   "receipt": {"user_id": "p1", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"},
                   "replay_available": False}
    wire = Wire(PortErr("timeout", "unknown"), status_done, _ok("op-2", receipt=status_done["receipt"]))
    c = _client(wire, gate=gate)
    with pytest.raises(sw.ServiceWriteError):
        c.write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    assert c.status("op-1").state == "completed"
    with pytest.raises(sw.ServiceWriteError) as held:
        c.write("users/update", UPDATE, _upd_meta("op-2", "req-2"))
    assert held.value.code == "readback_required", "the person is read fresh first, as for every unknown people write"
    gate.note_readback(intercom_sync.person_target("p1"), gate._tick())  # a users/get of the person answered
    assert c.write("users/update", UPDATE, _upd_meta("op-2", "req-2")).state == "completed"


def test_f2_a_completed_or_refused_write_leaves_the_person_free() -> None:
    gate = intercom_sync.IntercomSync()
    rec = {"user_id": "p1", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"}
    c = _client(Wire(_ok("op-1", receipt=rec), PortErr("revision_conflict", "refused")), gate=gate)
    c.write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    with pytest.raises(sw.ServiceWriteError):
        c.write("users/update", UPDATE, _upd_meta("op-2", "req-2"))
    assert gate.write_gate(intercom_sync.person_target("p1")) is None


# ================================================================ F3 PIN-bearing duplicates

PIN_RECEIPT = {"user_id": "p1", "person_revision": 1, "central_state": "unchanged_pin_generated_not_saved", "device_application": "not_proven"}


def test_f3_a_pin_generate_duplicate_is_never_completed() -> None:
    wire = Wire(_ok("op-9", "pin_generated_not_saved", receipt=PIN_RECEIPT, result={"pin": "000111"}))
    c = _client(wire)
    meta = _meta(op="op-9", req="req-9", target="p1", rev=1)
    assert c.write("users/pin_generate", {"user_id": "p1"}, meta).state == "completed"
    again = c.write("users/pin_generate", {"user_id": "p1"}, meta)
    assert again.state == "unknown" and again.code == "pin_duplicate_unverified" and again.receipt is None and again.pin is None
    assert again.dispatched is False and len(wire.calls) == 1


def test_f3_an_update_with_a_pin_duplicate_is_never_completed() -> None:
    rec = {"user_id": "p1", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"}
    c = _client(Wire(_ok("op-1", receipt=rec)))
    upd = {"user_id": "p1", "revision": 2, "data": {"pin": "123456"}}
    assert c.write("users/update", upd, _upd_meta("op-1", "req-1")).state == "completed"
    again = c.write("users/update", {**upd, "data": {"pin": "654321"}}, _upd_meta("op-1", "req-1"))
    assert again.state == "unknown" and again.code == "pin_duplicate_unverified" and again.receipt is None


# ================================================================ F4 the keyed request digest

def test_f4_the_digest_is_an_hmac_under_the_install_key() -> None:
    params = sw.build_parameters("users/create", CREATE, _meta())
    a, b = sw.request_mac(KEY, "users/create", params), sw.request_mac(bytes(32), "users/create", params)
    assert len(a) == 64 and a != b, "a different install key gives a different digest"
    body = {"command": "users/create", "service_write": params["service_write"],
            "parameters": {k: v for k, v in params.items() if k != "service_write"}}
    plain = hashlib.sha256(sw._canonical(body).encode()).hexdigest()
    assert a != plain and a == hmac.new(KEY, sw._canonical(body).encode(), hashlib.sha256).hexdigest()
    with pytest.raises(sw.ServiceWriteError):
        sw.request_mac(b"short", "users/create", params)


def test_f4_the_journal_holds_the_hmac_and_never_the_key() -> None:
    conn = sqlite3.connect(":memory:")
    c = _client(Wire(_ok("op-1")), conn)
    c.write("users/create", CREATE, _meta())
    dump = "\n".join(str(r) for r in conn.execute("SELECT * FROM wiskey_service_write_journal"))
    expected = sw.request_mac(KEY, "users/create", sw.build_parameters("users/create", CREATE, _meta()))
    assert expected in dump and KEY.hex() not in dump


def test_f4_no_key_no_write() -> None:
    wire = Wire()
    with pytest.raises(sw.ServiceWriteError) as exc:
        _client(wire, key=None).write("users/create", CREATE, _meta())
    assert (exc.value.code, exc.value.outcome) == ("service_write_source_unavailable", "not_sent") and wire.calls == []


def test_f4_the_install_key_file_is_created_once_outside_the_database(tmp_path: Path) -> None:
    k1 = sw.load_or_create_key(tmp_path)
    k2 = sw.load_or_create_key(tmp_path)
    path = sw.key_path(tmp_path)
    assert k1 == k2 and len(k1) == 32 and path.read_bytes() == k1 and path.parent.name == "keys" and path.suffix == ".key"
    assert [p.name for p in path.parent.iterdir()] == [sw.KEY_NAME], "no temporary file is left behind"
    path.write_bytes(b"damaged")
    with pytest.raises(sw.ServiceWriteError) as exc:
        sw.load_or_create_key(tmp_path)
    assert exc.value.outcome == "not_sent"


# ================================================================ F5 clean errors, the PIN shape, the receipt's person

def test_f5_a_broken_journal_is_a_clean_not_sent() -> None:
    conn = sqlite3.connect(":memory:")
    wire = Wire()
    c = _client(wire, conn)
    conn.close()
    with pytest.raises(sw.ServiceWriteError) as exc:
        c.write("users/create", CREATE, _meta())
    assert (exc.value.code, exc.value.outcome) == ("journal_unavailable", "not_sent") and wire.calls == []
    with pytest.raises(sw.ServiceWriteError) as st:
        c.status("op-1")
    assert (st.value.code, st.value.outcome) == ("journal_unavailable", "not_sent") and wire.calls == []
    assert _writer(c).available() is False


@pytest.mark.parametrize("business,meta", [
    ({"data": {"display_name": {1, 2}}}, _meta()),                        # not JSON: TypeError inside the digest
    ({"data": {"display_name": float("nan")}}, _meta()),                  # not strict JSON
    (CREATE, sw.Metadata(7, GRANT, "origin-1", None, "req-1", "op-1")),  # a non-string actor: AttributeError
    ({"user_id": ["p1"], "revision": 2, "data": {"active": True}}, _meta(target="p1", rev=2)),
])
def test_f5_malformed_input_is_a_clean_not_sent(business: Any, meta: Any) -> None:
    wire = Wire()
    command = "users/update" if "user_id" in business else "users/create"
    with pytest.raises(sw.ServiceWriteError) as exc:
        _client(wire).write(command, business, meta)
    assert exc.value.outcome == "not_sent" and wire.calls == []


@pytest.mark.parametrize("pin,ok", [("123456", True), ("12345", False), ("1234567", False), ("١٢٣٤٥٦", False),
                                    ("12345\n", False), ("12 456", False)])
def test_f5_the_generated_pin_is_six_ascii_digits(pin: str, ok: bool) -> None:
    out = sw.read_result(_ok("op-9", "pin_generated_not_saved", receipt=PIN_RECEIPT, result={"pin": pin}), command="users/pin_generate",
                         operation_id="op-9", target_ref="p1")
    assert (out is not None) is ok


def test_f5_a_receipt_for_another_person_is_unknown() -> None:
    other = {"user_id": "p2", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"}
    c = _client(Wire(_ok("op-1", receipt=other)))
    out = c.write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    assert out.state == "unknown" and out.code == "invalid_response" and c.journal.get(REPO, "op-1").state == "unknown"


def test_f5_a_status_receipt_for_another_person_does_not_settle() -> None:
    other = {"contract": sw.CONTRACT, "schema_version": 1, "state": "completed", "operation_id": "op-1",
             "receipt": {"user_id": "p2", "person_revision": 3, "central_state": "saved", "device_application": "not_proven"},
             "replay_available": False}
    c = _client(Wire(PortErr("timeout", "unknown"), other))
    with pytest.raises(sw.ServiceWriteError):
        c.write("users/update", UPDATE, _upd_meta("op-1", "req-1"))
    assert c.status("op-1").state == "unknown" and c.journal.get(REPO, "op-1").state == "unknown"


# ================================================================ M1 / M2 the talk route

def test_m1_a_natural_end_keeps_its_tail_when_the_link_closes_after_it() -> None:
    async def scenario() -> None:
        ws, ch, t, lease = SocketDouble(), NativeTalkDouble(), session(30), GatedLease()
        lease.block = True
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        ch.audio.put_nowait(PACKET)
        await asyncio.wait_for(lease.entered.wait(), 2)
        ch.pump.end_code = "ended"  # the natural end comes first ...
        ch.link.closed = True       # ... and the link is torn down after it
        lease.gate.set()
        await settle(lambda: len(ws.sent_bytes) == 1)
        t.stop_requested = "stopped"
        ch.audio.put_nowait(PACKET)
        await asyncio.wait_for(task, 3)

    asyncio.run(scenario())


def test_m1_a_closed_link_without_a_natural_end_still_fences() -> None:
    ch = NativeTalkDouble()
    ch.link.closed = True
    assert ch.publication_current() is False and ch.publication_end == "connection_closed"


@pytest.mark.parametrize("terminal,named", [("access_lost", "access_lost"), ("link_closed", "connection_closed")])
def test_m2_a_security_end_is_named_in_the_talk_audit(terminal: str, named: str, monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> Any:
        ws, ch, t, lease = SocketDouble(), NativeTalkDouble(), session(30), GatedLease()
        lease.block = True
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        ch.audio.put_nowait(PACKET)
        await asyncio.wait_for(lease.entered.wait(), 2)
        if terminal == "link_closed":
            ch.link.closed = True
        else:
            ch.pump.end_code = terminal
        lease.gate.set()
        assert await asyncio.wait_for(task, 3) == "upstream_closed"
        return t

    t = asyncio.run(scenario())
    assert t.publication_end == named
    rows: list[dict[str, Any]] = []
    monkeypatch.setattr(router_im, "audit", lambda _conn, **kw: rows.append(kw))
    t.outcome = "upstream_closed"
    router_im._end_row(None, SimpleNamespace(user_id="u1", username="op"), t)
    assert rows[0]["details"]["publication_end"] == named and rows[0]["details"]["outcome"] == "upstream_closed"


# ================================================================ M3 capabilities blocks

@pytest.mark.parametrize("block,bad", [
    ("native_service_write", {**dd.SERVICE_WRITE_CAP, "default_authority": "service_role_fallback"}),
    ("station_talk_audio", {**dd.TALK_AUDIO_CAP, "default": True}),
    ("business_contracts", {"features/start": "not-an-object"}),
    ("business_contracts", ["not", "a", "mapping"]),
])
def test_m3_one_bad_optional_block_does_not_fail_the_discovery(block: str, bad: Any) -> None:
    doc = _final_capabilities()
    doc[block] = bad
    cap = dd.read_capabilities(doc, "ref-1")
    assert cap.rejected_blocks == (block,) and cap.lists("users/create")
    others = {"native_service_write": cap.service_write, "station_talk_audio": cap.talk_audio, "business_contracts": bool(cap.business_contracts)}
    assert others.pop(block) is False and all(others.values()), "the other blocks are still read"


def test_m3_an_unknown_top_level_key_is_still_refused() -> None:
    with pytest.raises(dd.DiscoveryError):
        dd.read_capabilities({**_final_capabilities(), "durable_event_cursor": {}}, "ref-1")


# ================================================================ M4 send_v2 order

class CountingPacer:
    def __init__(self) -> None:
        self.checks = 0

    def check(self, **kw: Any) -> Any:
        self.checks += 1
        return SimpleNamespace(allowed=True, expired=False, not_before=kw["now"])

    def on_result(self, **kw: Any) -> None:
        pass


def test_m4_an_invalid_window_is_refused_before_the_shared_budget_is_asked() -> None:
    pacer, fake = CountingPacer(), V2Fake()
    r = _v2(_sender(fake, pacer=pacer), "maybe")  # type: ignore[arg-type]
    assert r.code == "invalid_fields" and pacer.checks == 0 and fake.sent == []
    assert _v2(_sender(fake, switch=False, pacer=pacer), "maybe").code == "invalid_fields" and pacer.checks == 0  # type: ignore[arg-type]
