"""WKWRITE-295 (WisKey round 4, items 8-9 / Q02 and 16 / Q08): Arx's native people writes, FAKES ONLY.

Everything here runs against tests/wkwrite_fake.FakeWisKey (a fake that follows NATIVE_WRITE_V1.md and the producer checks read in
WisKey source d2579588) and real SQLite files in a temporary folder. Nothing contacts WisKey, Home Assistant or a device; nothing
proves an installed or live system. Crash windows are in tests/test_wkwrite_295_crash.py."""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import shutil
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

import pytest

from smplwise.services import connection_store
from smplwise.services import wiskey_command_port as cp
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl
from wkwrite_fake import CATALOG, FakeWisKey

ACTOR = nw.WriteActor(user_id="arx-user-1", display_name="Operator One", session_active=True)
PIN_MARK = "MRKPIN739104"
CARD_MARK = "MRKCARD55120983"
NAME_MARK = "MRKNAME-Zq81"


def run(coro: Any) -> Any:
    return asyncio.run(coro)


def decision(at: datetime | None = None) -> nw.ArxDecision:
    return nw.ArxDecision(decision_id=str(uuid.uuid4()), grant_id="grant-people-1", grant_revision=7, permission_revision=7,
                          decided_at=at or datetime.now(timezone.utc))


class Clock:
    def __init__(self) -> None:
        self.offset = timedelta(0)

    def __call__(self) -> datetime:
        return datetime.now(timezone.utc) + self.offset


@pytest.fixture()
def env(tmp_path: Path) -> dict[str, Any]:
    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    anchor = wl.SettingsAnchor(main)
    clock = Clock()
    lin = wl.open_lineage(tmp_path, anchor, holder="holder-A", clock=clock)
    fake = FakeWisKey()
    audit: list[tuple[str, dict[str, Any]]] = []
    writer = nw.NativePeopleWriter(fake, lin, audit_sink=lambda a, d: audit.append((a, copy.deepcopy(d))))
    yield {"tmp": tmp_path, "main": main, "anchor": anchor, "lin": lin, "fake": fake, "writer": writer, "audit": audit, "clock": clock}
    lin.close()


def sent(fake: FakeWisKey, command: str) -> list[dict[str, Any]]:
    return [p for c, p in fake.sent if c == command]


def create(env: dict[str, Any], origin: str = "arx-grant:g-1", data: dict[str, Any] | None = None) -> nw.WriteOutcome:
    return run(env["writer"].write("users/create", {"data": data or {"display_name": "New Person"}, "sync_now": True}, actor=ACTOR,
                                   decision=decision(), create_origin_ref=origin))


# ---------------------------------------------------------------- the port

def test_the_fake_implements_the_port_and_errors_normalise():
    assert isinstance(FakeWisKey(), cp.WiskeyCommandPort)
    assert cp.WiskeyCommandError("x", outcome="bogus").outcome == cp.UNKNOWN  # a mistake never becomes a not-sent proof
    assert cp.WiskeyCommandError("bad\ncode", outcome=cp.REFUSED).code == "error"
    assert not cp.WiskeyCommandError("c", outcome=cp.NOT_SENT).may_have_been_sent
    assert cp.PEER_QUERY_COMMANDS == {"peer_bindings/get", "peer_bindings/history", "peer_protocol/get", "peer_receipts/resolve"}
    with pytest.raises(TypeError):
        nw.NativePeopleWriter(object(), None)  # type: ignore[arg-type]


# ---------------------------------------------------------------- the observed source

def test_source_is_parsed_strictly_and_kept_verbatim():
    fake = FakeWisKey()
    good = fake.source()
    src = nw.parse_source(good)
    assert src.descriptor_epoch == good["descriptor_epoch"] and src.peer_binding_revision == 1 and src.query_owner_id == "arx-service:entry-1"
    assert src.original_base() == {k: good[k] for k in nw.ORIGINAL_FIELDS if k != "original"}
    bad_cases = [("extra", {**good, "x": 1}), ("missing", {k: v for k, v in good.items() if k != "descriptor_epoch"}),
                 ("replay", {**good, "replay_available": True}), ("bool_rev", {**good, "peer_binding_revision": True}),
                 ("str_rev", {**good, "peer_binding_revision": "1"}), ("version", {**good, "schema_version": 2}),
                 ("contract", {**good, "contract": "x"}), ("delete_rule", {**good, "delete_person_revision": "next"}),
                 ("prefix", {**good, "request_schema_prefix": "urn:x:"}), ("epoch", {**good, "descriptor_epoch": ""}),
                 ("commands", {**good, "commands": []})]
    for _name, case in bad_cases:
        with pytest.raises(nw.NativeWriteError):
            nw.parse_source(case)


def test_the_source_is_read_before_the_intent_and_nothing_is_invented(env):
    out = create(env)
    assert out.state == "committed"
    order = [c for c, _ in env["fake"].sent]
    assert order == ["peer_writes/source_v1", "users/create"]
    pw = sent(env["fake"], "users/create")[0]["peer_write"]
    src = env["fake"].source()
    assert pw["descriptor_epoch"] == src["descriptor_epoch"] and pw["peer_binding_ref"] == src["peer_binding_ref"]
    assert pw["peer_binding_revision"] == src["peer_binding_revision"] and pw["create_origin_ref"] == "arx-grant:g-1"
    assert pw["descriptor"]["target"] == {"logical_target_id": "arx-grant:g-1", "binding_revision": src["peer_binding_revision"]}
    assert pw["descriptor"]["actor"] == {"kind": "human", "user_id": ACTOR.user_id}


# ---------------------------------------------------------------- COMMIT before I/O, original7 kept exactly

class Spy:
    """Wraps the fake: when the MUTATION arrives, read the lineage file through its own connection and record what was committed."""

    def __init__(self, fake: FakeWisKey, lineage_path: Path, data_dir: Path) -> None:
        self.fake, self.path, self.data_dir = fake, lineage_path, data_dir
        self.seen: dict[str, Any] = {}

    async def send_signed(self, command: str, parameters: Mapping[str, Any], *, operation_id: str | None) -> Mapping[str, Any]:
        if command in nw.ACTIONS:
            c = sqlite3.connect(self.path)
            row = c.execute("SELECT state, sealed, request_id FROM intents WHERE operation_id = ?", (operation_id,)).fetchone()
            c.close()
            self.seen = {"state": row[0], "request_id": row[2],
                         "original": json.loads(connection_store.open_lineage_record(self.data_dir, operation_id, "original", row[1])),
                         "sent": copy.deepcopy(dict(parameters))}
        return await self.fake.send_signed(command, parameters, operation_id=operation_id)


def test_intent_and_send_marker_are_committed_before_the_mutation_leaves(env):
    spy = Spy(env["fake"], wl.lineage_path(env["tmp"]), env["tmp"])
    writer = nw.NativePeopleWriter(spy, env["lin"])
    env["fake"].seed_user("u-9", revision=4)
    out = run(writer.write("users/update", {"user_id": "u-9", "revision": 4, "data": {"display_name": "X"}}, actor=ACTOR, decision=decision()))
    assert out.state == "committed" and out.person_revision == 5
    seen = spy.seen
    assert seen["state"] == "sending"  # on disk, in another connection, BEFORE the frame was handed to the transport
    original7, pw = seen["original"], seen["sent"]["peer_write"]
    assert set(original7) == set(nw.ORIGINAL_FIELDS)
    assert json.dumps(original7["original"], sort_keys=True) == json.dumps(pw["descriptor"], sort_keys=True)  # the FULL descriptor
    assert original7["descriptor_epoch"] == pw["descriptor_epoch"] and original7["peer_binding_revision"] == pw["peer_binding_revision"]
    assert original7["query_owner_id"] == "arx-service:entry-1"  # the exact service id, never an HA user
    assert seen["request_id"] == pw["descriptor"]["request_id"]


def test_every_native_action_round_trips_through_the_fake(env):
    fake = env["fake"]
    for i, (cmd, extra) in enumerate([("users/update", {"data": {"display_name": "A"}, "sync_now": True}), ("users/set_active", {"active": False}),
                                      ("users/archive", {"confirmed": True}), ("users/unarchive", {"confirmed": True}),
                                      ("users/temporary_cancel", {"reason_code": "left"}), ("cards/add", {"data": {"card_no": "123"}}),
                                      ("cards/remove", {"card_id": "c-1"})]):
        uid = f"u-x{i}"
        fake.seed_user(uid, revision=10)
        out = run(env["writer"].write(cmd, {"user_id": uid, "revision": 10, **extra}, actor=ACTOR, decision=decision()))
        assert (out.state, out.user_id, out.person_revision) == ("committed", uid, 11), cmd
        params = sent(fake, cmd)[0]
        spec = CATALOG[cmd]["parameters_schema"]
        assert set(params) <= set(spec["properties"]) and set(spec["required"]) <= set(params) and "api_contract" not in params


def test_delete_carries_the_last_actual_revision_and_its_receipt_is_not_a_successor(env):
    env["fake"].seed_user("u-del", revision=8)
    out = run(env["writer"].write("users/delete", {"user_id": "u-del", "revision": 8}, actor=ACTOR, decision=decision()))
    assert (out.state, out.person_revision) == ("committed", 8)
    assert sent(env["fake"], "users/delete")[0]["revision"] == 8
    # a receipt claiming revision 9 (a fabricated successor) is NOT accepted
    original7 = {"repository_id": "r", "verified_peer_ref": "p", "peer_binding_ref": "b", "peer_binding_revision": 1, "query_owner_id": "q",
                 "descriptor_epoch": "e", "original": {"a": 1}}
    receipt = {"schema": nw.RECEIPT_FORMAT, **original7, "source_epoch": "e", "create_origin_ref": None, "capture_original": None,
               "user_id": "u-del", "person_revision": 9, "central_state": "committed", "device_application": "unknown",
               "signed_capture_covered": False}
    with pytest.raises(nw.ReceiptMismatch):
        nw.verify_receipt(receipt, original7=original7, command="users/delete", target_ref="u-del", revision_sent=8, create_origin_ref=None)
    receipt["person_revision"] = 8
    assert nw.verify_receipt(receipt, original7=original7, command="users/delete", target_ref="u-del", revision_sent=8,
                             create_origin_ref=None) == ("u-del", 8)


def test_receipt_checks_are_byte_exact(env):
    original7 = {"repository_id": "r", "verified_peer_ref": "p", "peer_binding_ref": "b", "peer_binding_revision": 1, "query_owner_id": "q",
                 "descriptor_epoch": "e", "original": {"flag": True, "n": 1}}
    base = {"schema": nw.RECEIPT_FORMAT, **copy.deepcopy(original7), "source_epoch": "e", "create_origin_ref": "o", "capture_original": None,
            "user_id": "u-1", "person_revision": 1, "central_state": "committed", "device_application": "unknown", "signed_capture_covered": False}
    kw = {"original7": original7, "command": "users/create", "target_ref": None, "revision_sent": None, "create_origin_ref": "o"}
    assert nw.verify_receipt(base, **kw) == ("u-1", 1)
    tampered = [{"original": {"flag": 1, "n": 1}}, {"descriptor_epoch": "E"}, {"peer_binding_revision": True}, {"central_state": "pending"},
                {"device_application": "applied"}, {"signed_capture_covered": None}, {"capture_original": {}}, {"create_origin_ref": "o2"},
                {"person_revision": 2}, {"schema": "v1"}, {"extra": 1}]
    for t in tampered:
        with pytest.raises(nw.ReceiptMismatch):
            nw.verify_receipt({**base, **t}, **kw)


# ---------------------------------------------------------------- outcomes: refused, not sent, unknown, resolve

def test_port_not_sent_is_the_only_not_sent(env):
    env["fake"].faults["users/create"] = ["not_sent"]
    out = create(env)
    assert out.state == "not_sent" and env["lin"].get(out.operation_id).state == "not_sent"


def test_a_pre_effect_refusal_is_refused_and_an_ambiguous_one_is_unknown(env):
    env["fake"].seed_user("u-1", revision=2)
    out = run(env["writer"].write("users/update", {"user_id": "u-1", "revision": 1, "data": {}}, actor=ACTOR, decision=decision()))
    assert (out.state, out.code) == ("refused", "revision_conflict")
    for code in ("binding_denied", "source_changed", "Unauthorized", "bridge_outcome_unknown", "original_already_committed"):
        env["fake"].faults["users/update"] = [f"refuse:{code}"]
        out = run(env["writer"].write("users/update", {"user_id": "u-1", "revision": 2, "data": {}}, actor=ACTOR, decision=decision()))
        assert (out.state, out.code) == ("unknown", code), code


def test_lost_ack_after_commit_resolves_by_the_exact_original_without_a_second_create(env):
    env["fake"].faults["users/create"] = ["commit_then_lose_ack"]
    out = create(env)
    assert out.state == "unknown" and not out.replay_permitted
    res = run(env["writer"].resolve(out.operation_id))
    assert (res.state, res.user_id, res.person_revision) == ("committed", "u-1", 1)
    assert len(sent(env["fake"], "users/create")) == 1
    resolve_params = sent(env["fake"], "peer_receipts/resolve")[0]
    assert resolve_params["original"] == env["lin"].sealed(out.operation_id, "original")
    assert (resolve_params["peer_binding_ref"], resolve_params["peer_binding_revision"]) == ("bridge:entry-1:arx-service:entry-1", 1)
    assert [p["kind"] for p in env["lin"].proofs(out.operation_id)] == ["intent_committed", "send_started", "ack_lost", "resolve_found"]


def test_unknown_without_a_commit_stays_unknown_and_is_never_resent(env):
    env["fake"].faults["users/create"] = ["lost_before_commit"]
    out = create(env)
    for _ in range(3):
        res = run(env["writer"].resolve(out.operation_id))
        assert (res.state, res.code) == ("unknown", "remote:unknown")
    assert len(sent(env["fake"], "users/create")) == 1 and env["fake"].s["users"] == {}
    assert env["lin"].get(out.operation_id).state == "unknown"
    assert not any(hasattr(env["writer"], n) for n in ("retry", "resend", "replay", "reconstruct"))
    with pytest.raises(wl.LineageError):
        env["lin"].begin_send(out.operation_id)  # the socket door of an unknown never reopens


def test_an_unverified_ack_is_unknown_then_resolve_decides(env):
    real = env["fake"]._native_write

    def tamper(command, params, spec):
        r = real(command, params, spec)
        r["receipt"]["descriptor_epoch"] = "someone-else"
        return r

    env["fake"]._native_write = tamper
    out = create(env)
    assert (out.state, out.code) == ("unknown", "receipt:original.descriptor_epoch")
    assert run(env["writer"].resolve(out.operation_id)).state == "committed"


def test_missing_or_unreadable_original_stays_unknown_and_sends_nothing(env):
    before = len(env["fake"].sent)
    assert run(env["writer"].resolve("no-such-operation")) == nw.WriteOutcome("no-such-operation", "unknown", "original_missing")
    env["fake"].faults["users/create"] = ["lost_before_commit"]
    out = create(env)
    before = len(env["fake"].sent)
    (env["tmp"] / "keys" / "connections.key").unlink()
    res = run(env["writer"].resolve(out.operation_id))
    assert (res.state, res.code) == ("unknown", "original_unreadable") and len(env["fake"].sent) == before


def test_one_create_per_origin_ever(env):
    assert create(env, origin="arx-grant:g-7").state == "committed"
    with pytest.raises(nw.NativeWriteError) as exc:
        create(env, origin="arx-grant:g-7")
    assert exc.value.code == "create_origin_already_used" and len(sent(env["fake"], "users/create")) == 1
    with pytest.raises(nw.NativeWriteError):
        run(env["writer"].write("users/create", {"data": {}}, actor=ACTOR, decision=decision()))  # no origin: refused before I/O


def test_input_refusals_happen_before_any_io(env):
    cases = [("users/create", {"data": {}, "api_contract": 3}, "arx-grant:a"), ("users/update", {"user_id": "u", "revision": True, "data": {}}, None),
             ("users/update", {"user_id": "u", "revision": 1, "data": {}, "peer_write": {}}, None), ("users/pin_generate", {}, None),
             ("users/update", {"user_id": "u", "revision": 1, "data": {}}, "arx-grant:a")]
    for cmd, params, origin in cases:
        with pytest.raises(nw.NativeWriteError):
            run(env["writer"].write(cmd, params, actor=ACTOR, decision=decision(), create_origin_ref=origin))
    with pytest.raises(nw.NativeWriteError) as exc:
        run(env["writer"].write("users/update", {"user_id": "u", "revision": 1, "data": {}},
                                actor=nw.WriteActor("arx-user-1", "x", False), decision=decision()))
    assert exc.value.code == "actor_session_inactive"
    with pytest.raises(nw.NativeWriteError) as exc:
        run(env["writer"].write("users/update", {"user_id": "u", "revision": 1, "data": {}}, actor=ACTOR,
                                decision=decision(datetime.now(timezone.utc) - timedelta(seconds=30))))
    assert exc.value.code == "decision_stale"
    assert [c for c, _ in env["fake"].sent if c in nw.ACTIONS] == []


def test_check_descriptor_mirrors_the_original_cross_checks():
    d = nw.build_descriptor(action="users/update", actor=ACTOR, decision=decision(), logical_target_id="u-1", binding_revision=3,
                            request_id=str(uuid.uuid4()), operation_id="op-1", operation_binding_ref="arx-op:op-1",
                            parameter_reference="arx-param:x", issued_at=datetime.now(timezone.utc))
    nw.check_descriptor(d)
    assert d["operation"]["request_schema_id"] == "urn:wiskey:native-bridge:users:update"
    assert d["operation"]["parameter_transport"] == "agreed_sensitive_opaque_reference"
    mutations = [lambda x: x["decision"].update(binding_revision=4), lambda x: x["grant"].update(grant_revision=8),
                 lambda x: x["decision"].update(operation_id="op-2"), lambda x: x.update(channel="automation"),
                 lambda x: x["operation"].update(request_schema_id="urn:wiskey:native-bridge:users:delete"),
                 lambda x: x.update(request_expires_at=(datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat()),
                 lambda x: x.update(extra=1), lambda x: x["actor"].update(kind="automation"), lambda x: x.update(request_id="not-a-uuid"),
                 lambda x: x["target"].update(binding_revision=True)]
    for m in mutations:
        bad = copy.deepcopy(d)
        m(bad)
        with pytest.raises(nw.NativeWriteError):
            nw.check_descriptor(bad)


# ---------------------------------------------------------------- writer scope, fencing, exclusive writer

def test_one_in_flight_write_per_person_and_fencing(env):
    lin = env["lin"]
    scope = "repo|svc"
    lin.acquire_writer(scope)
    kw = {"scope": scope, "kind": "peer_write", "command": "users/update", "target_ref": "u-1", "create_origin_ref": None,
          "revision_sent": 1, "sealed_field": "original", "sealed_value": {"x": 1}}
    lin.admit(operation_id="op-a", request_id="req-a", **kw)
    with pytest.raises(wl.LineageError) as exc:
        lin.admit(operation_id="op-b", request_id="req-b", **kw)
    assert exc.value.code == "person_write_in_flight"
    with pytest.raises(wl.LineageError) as exc:
        lin.admit(operation_id="op-a", request_id="req-c", **{**kw, "target_ref": "u-2"})
    assert exc.value.code == "duplicate_operation"
    # a second process on the same file: busy while A's lease lives; after it lapses B takes the scope and A is fenced out
    clock_b = Clock()
    other = wl.open_lineage(env["tmp"], env["anchor"], holder="holder-B", clock=clock_b)
    with pytest.raises(wl.LineageError) as exc:
        other.acquire_writer(scope)
    assert exc.value.code == "writer_busy"
    clock_b.offset = timedelta(seconds=31)
    assert other.acquire_writer(scope) == 2
    with pytest.raises(wl.LineageError) as exc:
        lin.begin_send("op-a")
    assert exc.value.code == "writer_fenced"
    with pytest.raises(wl.LineageError):
        lin.admit(operation_id="op-d", request_id="req-d", **{**kw, "target_ref": "u-3"})
    # recovery by the new exclusive writer: the never-sent intent is not_sent - and never sendable
    clock_b.offset = timedelta(seconds=32)
    assert other.recover(scope) == {"not_sent": 1, "unknown": 0}
    assert other.get("op-a").state == "not_sent"
    other.close()


def test_fenced_between_commit_and_send_is_not_sent(env):
    lin = env["lin"]
    real_admit = lin.admit
    other = wl.open_lineage(env["tmp"], env["anchor"], holder="holder-B", clock=lambda: datetime.now(timezone.utc) + timedelta(seconds=60))

    def admit_then_lose_scope(**kw):
        intent = real_admit(**kw)
        other.acquire_writer(kw["scope"])  # another process takes the scope (A's lease lapsed from its point of view)
        return intent

    lin.admit = admit_then_lose_scope  # type: ignore[method-assign]
    out = create(env)
    assert (out.state, out.code) == ("not_sent", "writer_fenced") and sent(env["fake"], "users/create") == []
    other.close()


def test_a_fenced_writer_may_still_record_a_verified_fact(env):
    env["fake"].faults["users/create"] = ["commit_then_lose_ack"]
    out = create(env)
    other = wl.open_lineage(env["tmp"], env["anchor"], holder="holder-B", clock=lambda: datetime.now(timezone.utc) + timedelta(seconds=60))
    other.acquire_writer(nw.parse_source(env["fake"].source()).scope)
    assert run(env["writer"].resolve(out.operation_id)).state == "committed"
    other.close()


# ---------------------------------------------------------------- restore, stale and missing lineage

def test_restore_of_the_main_database_turns_open_intents_unknown(env):
    env["fake"].faults["users/create"] = ["lost_before_commit"]
    first = create(env, origin="arx-grant:r-1")
    env["lin"].close()
    gen, seq = env["anchor"].read()
    env["anchor"].write(gen, seq - 1)  # the main database came back from an older backup
    again = wl.open_lineage(env["tmp"], env["anchor"], holder="holder-A2")
    assert again.status == "restored" and again.writable()
    row = again.get(first.operation_id)
    assert (row.state, row.outcome_code) == ("unknown", "restored")
    assert "restored_unknown" in [p["kind"] for p in again.proofs(first.operation_id)]
    assert env["anchor"].read() == (gen, seq)
    again.close()


def test_restore_without_any_anchor_is_a_restore_too(env):
    env["fake"].faults["users/create"] = ["lost_before_commit"]
    op = create(env).operation_id
    env["lin"].close()
    c = sqlite3.connect(env["main"])
    c.execute("DELETE FROM settings")
    c.commit()
    c.close()
    again = wl.open_lineage(env["tmp"], env["anchor"], holder="h")
    assert again.status == "restored" and again.get(op).outcome_code == "restored"
    again.close()


def test_a_stale_lineage_copy_refuses_new_writes_until_reinitialised(env):
    lp = wl.lineage_path(env["tmp"])
    assert create(env, origin="arx-grant:s-1").state == "committed"
    env["lin"].close()
    for suffix in ("", "-wal", "-shm"):
        if Path(str(lp) + suffix).exists():
            shutil.copy(str(lp) + suffix, str(lp) + suffix + ".old")
    lin = wl.open_lineage(env["tmp"], env["anchor"], holder="h")
    w = nw.NativePeopleWriter(env["fake"], lin)
    env["fake"].faults["users/create"] = ["lost_before_commit"]
    run(w.write("users/create", {"data": {}}, actor=ACTOR, decision=decision(), create_origin_ref="arx-grant:s-2"))
    lin.close()
    for suffix in ("", "-wal", "-shm"):
        if Path(str(lp) + suffix + ".old").exists():
            shutil.move(str(lp) + suffix + ".old", str(lp) + suffix)
        elif Path(str(lp) + suffix).exists():
            Path(str(lp) + suffix).unlink()
    stale = wl.open_lineage(env["tmp"], env["anchor"], holder="h2")
    assert stale.status == "stale" and not stale.writable()
    w = nw.NativePeopleWriter(env["fake"], stale)
    before = len(env["fake"].sent)
    with pytest.raises(nw.NativeWriteError) as exc:
        run(w.write("users/create", {"data": {}}, actor=ACTOR, decision=decision(), create_origin_ref="arx-grant:s-3"))
    assert exc.value.code == "lineage_stale" and len(env["fake"].sent) == before
    stale.reinitialise(actor_ref="arx-admin-1")
    assert stale.status == "ok" and run(w.write("users/create", {"data": {}}, actor=ACTOR, decision=decision(),
                                                create_origin_ref="arx-grant:s-3")).state == "committed"
    stale.close()


def test_a_missing_lineage_is_never_recreated_silently(env):
    env["lin"].close()
    shutil.rmtree(env["tmp"] / wl.LINEAGE_DIRNAME)
    lin = wl.open_lineage(env["tmp"], env["anchor"], holder="h")
    assert lin.status == "missing" and not wl.lineage_path(env["tmp"]).exists()
    with pytest.raises(nw.NativeWriteError) as exc:
        create({**env, "writer": nw.NativePeopleWriter(env["fake"], lin)})
    assert exc.value.code == "lineage_missing" and env["fake"].sent == []
    lin.reinitialise(actor_ref="arx-admin-1")
    assert lin.status == "ok" and lin._meta("lost_seq_until") is not None
    lin.close()


# ---------------------------------------------------------------- encryption and retention

def test_the_original_is_encrypted_and_bound_to_its_operation(env):
    out = create(env)
    c = sqlite3.connect(wl.lineage_path(env["tmp"]))
    sealed = c.execute("SELECT sealed FROM intents WHERE operation_id = ?", (out.operation_id,)).fetchone()[0]
    c.close()
    assert sealed.startswith("v1:") and "descriptor_epoch" not in sealed and "contract_version" not in sealed
    with pytest.raises(connection_store.SecretError):
        connection_store.open_lineage_record(env["tmp"], "another-operation", "original", sealed)


def test_retention_is_thirty_days_after_the_operation_ended(env):
    lin, clock = env["lin"], env["clock"]
    done = create(env, origin="arx-grant:t-1")
    env["fake"].faults["users/create"] = ["lost_before_commit", "lost_before_commit"]
    open_unknown = create(env, origin="arx-grant:t-2")
    closed_unknown = create(env, origin="arx-grant:t-3")
    lin.close_unknown(closed_unknown.operation_id, actor_ref="arx-admin-1", code="unresolvable")
    clock.offset = timedelta(days=29)
    assert lin.purge() == 0
    clock.offset = timedelta(days=31)
    assert lin.purge() == 2
    with pytest.raises(wl.LineageError):
        lin.get(done.operation_id)
    assert lin.proofs(done.operation_id) == []
    assert lin.get(open_unknown.operation_id).state == "unknown"  # an open unknown is never purged
    clock.offset = timedelta(days=400)
    assert lin.purge() == 0


# ---------------------------------------------------------------- name_ref (item 16)

def test_name_ref_rename_happy_path_and_lost_ack_resolved_by_the_same_actor(env):
    fake = env["fake"]
    fake.seed_user("u-n", revision=5)
    out = run(env["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=decision()))
    assert (out.state, out.person_revision) == ("committed", 6) and fake.s["users"]["u-n"]["display_name"] == "Dana"
    fake.faults["users/name_ref_apply_v1"] = ["commit_then_lose_ack"]
    out = run(env["writer"].rename(person_ref="u-n", expected_person_revision=6, display_name="Dana B", actor=ACTOR, decision=decision()))
    assert out.state == "unknown"
    res = run(env["writer"].resolve_name_ref(out.operation_id))
    assert (res.state, res.person_revision) == ("committed", 7)
    bulk = sent(fake, "users/bulk_receipt")
    assert bulk == [{"operation_id": out.operation_id}]  # no `actor`: the same pairing-service actor that applied it
    assert len(sent(fake, "users/name_ref_apply_v1")) == 2


def test_name_ref_failures(env):
    fake = env["fake"]
    fake.seed_user("u-n", revision=5)
    fake.faults["users/name_ref_prepare_v1"] = ["lost_before_commit"]
    out = run(env["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=decision()))
    assert (out.state, out.code) == ("not_sent", "prepare:timeout")  # a carrier nobody holds the ref of can never be applied
    fake.faults["users/name_ref_apply_v1"] = ["lost_before_commit"]
    out = run(env["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=decision()))
    res = run(env["writer"].resolve_name_ref(out.operation_id))
    assert (res.state, res.code) == ("unknown", "bulk_receipt:operation_not_found")  # not found is NOT never-committed
    fake.faults["users/name_ref_apply_v1"] = ["refuse:name_ref_consumed"]
    out = run(env["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="Dana", actor=ACTOR, decision=decision()))
    assert out.state == "unknown"
    with pytest.raises(nw.NativeWriteError):
        run(env["writer"].rename(person_ref="u-n", expected_person_revision=5, display_name="x" * 33, actor=ACTOR, decision=decision()))


# ---------------------------------------------------------------- raw values never reach a sink

def _scan(blob: str) -> list[str]:
    return [m for m in (PIN_MARK, CARD_MARK, NAME_MARK) if m in blob]


def test_raw_name_pin_and_card_only_in_the_signed_input(env, caplog):
    caplog.set_level(logging.DEBUG)
    fake, writer = env["fake"], env["writer"]
    fake.faults["users/create"] = ["commit_then_lose_ack"]
    out = run(writer.write("users/create", {"data": {"display_name": NAME_MARK, "pin": PIN_MARK}}, actor=ACTOR, decision=decision(),
                           create_origin_ref="arx-grant:m-1"))
    run(writer.resolve(out.operation_id))
    uid = env["lin"].get(out.operation_id).user_id_after
    fake.faults["cards/add"] = ["commit_then_lose_ack"]
    out2 = run(writer.write("cards/add", {"user_id": uid, "revision": 1, "data": {"card_no": CARD_MARK}}, actor=ACTOR, decision=decision()))
    run(writer.resolve(out2.operation_id))
    run(writer.write("users/update", {"user_id": uid, "revision": 2, "data": {"pin": PIN_MARK}}, actor=ACTOR, decision=decision()))
    fake.faults["users/name_ref_apply_v1"] = ["commit_then_lose_ack"]
    out3 = run(writer.rename(person_ref=uid, expected_person_revision=3, display_name=NAME_MARK, actor=ACTOR, decision=decision()))
    run(writer.resolve_name_ref(out3.operation_id))
    # the values DID travel, inside the signed inputs that need them (and only there)
    arrived = json.dumps(fake.sent)
    assert _scan(arrived) == [PIN_MARK, CARD_MARK, NAME_MARK]
    lin = env["lin"]
    sinks = {
        "log": caplog.text,
        "audit": json.dumps(env["audit"]),
        "handoff": json.dumps(lin.handoff_export()),
        "intents": json.dumps([lin.get(i).__dict__ for i in (out.operation_id, out2.operation_id, out3.operation_id)]),
        "proofs": json.dumps([lin.proofs(i) for i in (out.operation_id, out2.operation_id, out3.operation_id)]),
        "descriptor_and_original": json.dumps([lin.sealed(out.operation_id, "original"), lin.sealed(out2.operation_id, "original")]),
        "name_bindings": json.dumps(lin.sealed(out3.operation_id, "bindings")),
        "peer_write_metadata": json.dumps([p["peer_write"] for c, p in fake.sent if c in nw.ACTIONS]),
        "resolve_requests": json.dumps(sent(fake, "peer_receipts/resolve") + sent(fake, "users/bulk_receipt")),
    }
    lin.close()
    for path in sorted((env["tmp"] / wl.LINEAGE_DIRNAME).iterdir()) + [env["main"]]:
        sinks["file:" + path.name] = path.read_bytes().decode("latin-1")
    for name, blob in sinks.items():
        assert _scan(blob) == [], name


# ---------------------------------------------------------------- RBAC decision and audit rows

def test_arx_decision_requires_every_target(monkeypatch):
    from smplwise import rbac

    calls: list[tuple[str, str]] = []

    def authorize(conn, principal, permission, target):
        calls.append(target)
        return rbac.Decision(target[1] != "st-denied", "ok", binding_id="bind-7")

    monkeypatch.setattr(rbac, "authorize", authorize)
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.execute("INSERT INTO settings VALUES ('permission_revision', '12')")
    d = nw.arx_decision(c, object(), "access.people.manage", [("station", "st-1"), ("station", "st-2")])
    assert (d.grant_id, d.grant_revision, d.permission_revision) == ("bind-7", 12, 12) and len(calls) == 2
    with pytest.raises(nw.NativeWriteError):
        nw.arx_decision(c, object(), "access.people.manage", [("station", "st-1"), ("station", "st-denied")])
    with pytest.raises(nw.NativeWriteError):
        nw.arx_decision(c, object(), "access.people.manage", [])
