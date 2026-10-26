"""PEERQUERY-295: the peer_query read `peer_bindings/get` behind the existing RegistryTransport (services/wiskey_peer_query.py).

FAKES ONLY: `FakeDirectPort` stands in for the direct link's sync port (wiskey_direct_join.DirectCapturePort): it records every call and
answers like WisKey's `PeerQueryBridge._lookup_existing` (the exact draft1 row, `binding_denied` for an unknown binding). Nothing
contacts WisKey, Home Assistant, a station or a door. Every identifier is fictional.

Covered: the switch off (default), permission denied, success, an unknown peer (local and remote), a transport error, a timeout, the
NOT_IMPLEMENTED commands, read-only parameters, the owner check before any byte, and one audit row per call."""
from __future__ import annotations

import copy
import json
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey_peer import REPO, binding_row

from smplwise.db import Database, set_setting
from smplwise.rbac import Principal
from smplwise.services import wiskey_command_port as cp
from smplwise.services import wiskey_direct_join as dj
from smplwise.services import wiskey_peer as wp
from smplwise.services import wiskey_peer_query as pq
from smplwise.services import wiskey_peer_registry as wr
from smplwise.services.wiskey_capture_port import PortError, PortIdentity

ENTRY = "0123456789abcdef0123456789abcdef"
SUBJECT = "arx-service:" + ENTRY  # the server-issued direct service subject (never an HA user)
BINDING_REF = "bridge:" + ENTRY + ":" + SUBJECT  # WisKey PeerQueryBridge._binding_ref
PEER_REF = "smplwise_bridge:" + ENTRY
OTHER_SUBJECT = "arx-service:fedcba9876543210fedcba9876543210"


def row(revision: int = 1, **over: Any) -> dict[str, Any]:
    base = binding_row(revision, verified_peer_ref=PEER_REF, peer_binding_ref=BINDING_REF, query_owner_id=SUBJECT, historical_read=True)
    base.update(over)
    return base


class FakeDirectPort:
    """The sync direct port. `mode`: row | refuse:<code> | port_error:<code> | timeout_error | crash. Only the closed lookup form of
    `peer_bindings/get` is understood; anything else is a test failure (the module must never send it)."""

    def __init__(self, *rows: dict[str, Any], subject: str = SUBJECT) -> None:
        self.rows = {(r["peer_binding_ref"], r["peer_binding_revision"]): copy.deepcopy(r) for r in (rows or (row(),))}
        self.subject = subject
        self.mode = "row"
        self.calls: list[tuple[str, dict[str, Any], float]] = []

    def identity(self) -> PortIdentity:
        return PortIdentity(entry_id=ENTRY, query_owner_id=self.subject, repository_id=REPO, connection_ref="conn-fixture-1")

    def call(self, command: str, parameters: Any, *, timeout_s: float) -> Any:
        self.calls.append((command, copy.deepcopy(dict(parameters)), timeout_s))
        assert command == "peer_bindings/get" and set(parameters) == {"peer_binding_ref", "peer_binding_revision"}, (command, parameters)
        if self.mode.startswith("refuse:"):
            raise PortError(self.mode.split(":", 1)[1], "refused")
        if self.mode.startswith("port_error:"):
            raise PortError(self.mode.split(":", 1)[1], "unknown")
        if self.mode == "timeout_error":
            raise TimeoutError()
        if self.mode == "crash":
            raise RuntimeError("socket gone")
        found = self.rows.get((parameters["peer_binding_ref"], parameters["peer_binding_revision"]))
        if found is None:
            raise PortError("binding_denied", "refused")  # WisKey: unknown and denied are the same verified error
        return copy.deepcopy(found)


@pytest.fixture()
def world(client, settings):
    client.get("/api/v1/me")  # joni: the bootstrap system administrator
    db = Database(settings.db_path)
    with db.connection(mode="read") as conn:
        uid = conn.execute("SELECT id FROM users WHERE username = 'joni'").fetchone()[0]
    return {"db": db, "client": client, "settings": settings, "admin": Principal(user_id=uid, username="joni", display_name="joni", source="dev")}


def _pin(revision: int = 1, owner: str = SUBJECT) -> str:
    return wr.encode_pin(wr.OwnerPin(query_owner_id=owner, repository_id=REPO, verified_peer_ref=PEER_REF, peer_binding_ref=BINDING_REF,
                                     peer_binding_revision=revision))


def _on(world: dict[str, Any], *, pin: str | None = None) -> None:
    with world["db"].connection() as conn:
        set_setting(conn, pq.FLAG_KEY, "on")
        set_setting(conn, wr.PIN_KEY, pin or _pin())


def _query(world: dict[str, Any], port: Any, principal: Principal | None = None, **kw: Any) -> pq.PeerQueryResult:
    with world["db"].connection() as conn:
        return pq.peer_query(conn, principal or world["admin"], port=port, **kw)


def _audit(world: dict[str, Any]) -> list[dict[str, Any]]:
    with world["db"].connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (pq.AUDIT_ACTION,)).fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return rows


# ---------------------------------------------------------------- the contract this module rides

def test_the_command_is_a_catalogued_peer_query_read_on_the_peer_query_envelope():
    assert pq.COMMAND in cp.PEER_QUERY_COMMANDS
    assert dj.envelope_kind(pq.COMMAND) == "wiskey-peer-query.v1"
    assert pq.NOT_IMPLEMENTED_COMMANDS | {pq.COMMAND} == cp.PEER_QUERY_COMMANDS


def test_the_direct_service_subject_is_a_query_owner_but_nothing_looser():
    assert wp.is_query_owner_id(SUBJECT) and wp.is_query_owner_id("22222222222242228222222222222222")
    for bad in ("arx-service:", "arx-service: x", "arx-service:a\u0001", "ARX-service:" + ENTRY, "arx-service:" + "a" * 117, "x" + SUBJECT, None, 7):
        assert not wp.is_query_owner_id(bad), bad


# ---------------------------------------------------------------- 1. the switch is off by default

def test_switch_off_by_default_refuses_before_anything_and_audits(world):
    port = FakeDirectPort()
    with world["db"].connection() as conn:
        set_setting(conn, wr.PIN_KEY, _pin())  # even with a pin, and with the receipt seam switch on
        set_setting(conn, wp.FLAG_KEY, "on")
        assert pq.mode(conn) == "off"
    r = _query(world, port)
    assert (r.ok, r.code, r.sent) == (False, "peer_query_disabled", False)
    assert port.calls == []
    rows = _audit(world)
    assert len(rows) == 1 and rows[0]["decision"] == "denied" and rows[0]["reason"] == "peer_query_disabled"
    with world["db"].connection() as conn:
        set_setting(conn, pq.FLAG_KEY, "ON ")  # garbage is off
    assert _query(world, port).code == "peer_query_disabled" and port.calls == []


# ---------------------------------------------------------------- 2. permission denied

@pytest.mark.parametrize("who,role", [("nobody", None), ("otto", "site_admin"), ("olga", "operator")])
def test_without_system_configure_the_query_is_refused_and_audited(world, who, role):
    _on(world)
    if role:
        bind(world["client"], world["settings"], who, role, "installation", "*")
    else:
        world["client"].get("/api/v1/me", headers=as_user(who))
    with world["db"].connection(mode="read") as conn:
        uid = conn.execute("SELECT id FROM users WHERE username = ?", (who,)).fetchone()[0]
    port = FakeDirectPort()
    r = _query(world, port, Principal(user_id=uid, username=who, display_name=who, source="dev"))
    assert (r.ok, r.code) == (False, "forbidden") and r.detail == "no_binding"
    assert port.calls == []
    rows = _audit(world)
    assert len(rows) == 1 and rows[0]["decision"] == "denied" and rows[0]["reason"] == "forbidden" and rows[0]["actor_username"] == who


def test_a_local_identity_without_its_second_factor_is_refused(world):
    _on(world)
    port = FakeDirectPort()
    r = _query(world, port, Principal(user_id=world["admin"].user_id, username="joni", display_name="joni", source="local"))
    assert (r.code, r.detail) == ("forbidden", "second_factor_required") and port.calls == []


def test_no_principal_is_refused(world):
    _on(world)
    port = FakeDirectPort()
    with world["db"].connection() as conn:
        r = pq.peer_query(conn, None, port=port)
    assert (r.code, r.detail) == ("forbidden", "no_principal") and port.calls == []
    assert _audit(world)[0]["actor_user_id"] is None


# ---------------------------------------------------------------- 3. success

def test_success_reads_the_pinned_binding_with_exactly_the_catalogued_parameters(world):
    _on(world)
    port = FakeDirectPort()
    r = _query(world, port, timeout_s=3.0)
    assert (r.ok, r.code, r.sent, r.historical) == (True, "ok", True, False)
    assert r.peer is not None and wp.as_peer_binding(r.peer) is r.peer
    assert (r.peer.value, r.peer.query_owner_id, r.peer.peer_binding_revision, r.peer.repository_id) == (PEER_REF, SUBJECT, 1, REPO)
    assert port.calls == [("peer_bindings/get", {"peer_binding_ref": BINDING_REF, "peer_binding_revision": 1}, 3.0)]
    public = r.public()
    assert public == {"ok": True, "code": "ok", "detail": None, "historical": False, "sent": True, "peer_binding_revision": 1}
    assert ENTRY not in json.dumps(public)
    rows = _audit(world)
    assert len(rows) == 1 and rows[0]["decision"] == "allowed" and rows[0]["resource_type"] == "wiskey_peer_binding"
    assert rows[0]["details"] == {"command": "peer_bindings/get", "outcome": "ok", "sent": True, "historical": False, "peer_binding_revision": 1}
    assert ENTRY not in (rows[0]["details_json"] or "")  # no reference, subject or repository in the audit row
    assert rows[0]["role_id"] == "system_admin"


def test_success_for_a_receipt_on_an_older_revision_needs_historical_read(world):
    _on(world, pin=_pin(2))
    port = FakeDirectPort(row(1, state="rotated", active=False, successor={"peer_binding_ref": BINDING_REF, "peer_binding_revision": 2}),
                          row(2))
    r = _query(world, port, parameters={"peer_binding_ref": BINDING_REF, "peer_binding_revision": 1})
    assert (r.ok, r.code, r.historical) == (True, "ok", True)
    port.rows[(BINDING_REF, 1)]["historical_read"] = False
    assert _query(world, port, parameters={"peer_binding_ref": BINDING_REF, "peer_binding_revision": 1}).code == "historical_read_denied"


@pytest.mark.parametrize("over,code", [
    ({"state": "revoked", "active": False}, "revoked"),
    ({"state": "rotated", "active": False, "successor": {"peer_binding_ref": BINDING_REF, "peer_binding_revision": 2}}, "rotation_pending"),
    ({"query_owner_id": OTHER_SUBJECT}, "binding_mismatch"),
    ({"repository_id": "33333333-3333-4333-8333-333333333333"}, "binding_mismatch"),
    ({"allowed_read_scope": "everything"}, "malformed"),
    ({"extra": 1}, "malformed"),
])
def test_the_registry_rules_hold_over_the_wire(world, over, code):
    _on(world)
    r = _query(world, FakeDirectPort(row(1, **over)))
    assert (r.ok, r.code, r.peer) == (False, code, None)


def test_a_non_object_result_is_malformed(world):
    _on(world)
    port = FakeDirectPort()
    port.call = lambda *a, **k: ["not", "a", "row"]  # type: ignore[method-assign]
    assert _query(world, port).code == "malformed"


# ---------------------------------------------------------------- 4. unknown peer

def test_an_unpinned_binding_is_refused_with_nothing_sent(world):
    _on(world)
    port = FakeDirectPort()
    for params in ({"peer_binding_ref": "bridge:someone-else", "peer_binding_revision": 1},
                   {"peer_binding_ref": BINDING_REF, "peer_binding_revision": 2}):  # newer than the pin
        r = _query(world, port, parameters=params)
        assert (r.ok, r.code, r.sent) == (False, "not_pinned", False)
    assert port.calls == []


def test_no_pin_is_not_pinned(world):
    with world["db"].connection() as conn:
        set_setting(conn, pq.FLAG_KEY, "on")
    port = FakeDirectPort()
    assert _query(world, port).code == "not_pinned" and port.calls == []


def test_a_binding_wiskey_does_not_know_is_a_verified_refusal_never_a_binding(world):
    _on(world)
    port = FakeDirectPort(row(5))  # WisKey knows revision 5 only; the pin names revision 1
    r = _query(world, port)
    assert (r.ok, r.code, r.detail, r.sent, r.peer) == (False, "refused", "binding_denied", True, None)
    assert len(port.calls) == 1  # asked once, never retried
    rows = _audit(world)
    assert rows[-1]["decision"] == "allowed" and rows[-1]["details"]["outcome"] == "refused" and rows[-1]["details"]["detail"] == "binding_denied"


def test_a_link_authenticated_as_another_subject_is_refused_before_any_byte(world):
    _on(world)
    port = FakeDirectPort(subject=OTHER_SUBJECT)
    r = _query(world, port)
    assert (r.code, r.sent) == ("owner_mismatch", False) and port.calls == []


def test_an_unattestable_identity_is_owner_mismatch(world):
    _on(world)
    port = FakeDirectPort(subject="not a subject")
    assert _query(world, port).code == "owner_mismatch" and port.calls == []


# ---------------------------------------------------------------- 5. transport error

@pytest.mark.parametrize("mode,code,detail", [
    ("port_error:connection_closed", "transport_error", "connection_closed"),
    ("port_error:invalid_response", "transport_error", "invalid_response"),
    ("crash", "transport_error", "RuntimeError"),
])
def test_a_transport_error_is_never_a_binding(world, mode, code, detail):
    _on(world)
    port = FakeDirectPort()
    port.mode = mode
    r = _query(world, port)
    assert (r.ok, r.code, r.detail, r.peer) == (False, code, detail, None)
    assert len(port.calls) == 1


def test_no_installed_direct_join_is_not_connected(world, monkeypatch):
    _on(world)
    monkeypatch.setattr(dj, "JOIN", None)
    r = _query(world, None)
    assert (r.code, r.sent) == ("not_connected", False)


def test_an_identity_failure_is_not_connected(world):
    _on(world)
    port = FakeDirectPort()

    def identity() -> PortIdentity:
        raise PortError("wiskey_direct_not_connected", "not_sent")

    port.identity = identity  # type: ignore[method-assign]
    r = _query(world, port)
    assert (r.code, r.detail) == ("not_connected", "wiskey_direct_not_connected") and port.calls == []


# ---------------------------------------------------------------- 6. timeout

@pytest.mark.parametrize("mode,detail", [("port_error:outcome_unknown", "outcome_unknown"), ("port_error:TimeoutError", "TimeoutError"),
                                         ("timeout_error", "TimeoutError")])
def test_a_timeout_is_reported_as_timeout_and_never_retried(world, mode, detail):
    _on(world)
    port = FakeDirectPort()
    port.mode = mode
    r = _query(world, port)
    assert (r.ok, r.code, r.detail, r.sent) == (False, "timeout", detail, True)
    assert len(port.calls) == 1


# ---------------------------------------------------------------- read-only / NOT_IMPLEMENTED / parameters

@pytest.mark.parametrize("command", sorted(pq.NOT_IMPLEMENTED_COMMANDS))
def test_the_other_peer_query_commands_are_not_implemented(world, command):
    _on(world)
    port = FakeDirectPort()
    r = _query(world, port, command=command)
    assert (r.code, r.detail) == ("not_implemented", command) and port.calls == []


def test_the_initialize_form_provisions_and_is_refused(world):
    _on(world)
    port = FakeDirectPort()
    r = _query(world, port, parameters={"initialize": True, "expected_revision": 0})
    assert (r.code, r.detail) == ("not_implemented", "peer_bindings/get:initialize") and port.calls == []


@pytest.mark.parametrize("params", [
    {}, {"peer_binding_ref": BINDING_REF}, {"peer_binding_ref": BINDING_REF, "peer_binding_revision": True},
    {"peer_binding_ref": BINDING_REF, "peer_binding_revision": 0}, {"peer_binding_ref": "", "peer_binding_revision": 1},
    {"peer_binding_ref": "x" * 129, "peer_binding_revision": 1}, {"peer_binding_ref": BINDING_REF, "peer_binding_revision": 1, "extra": 1},
    {"initialize": True, "expected_revision": 1}, "peer_bindings", [],
])
def test_parameters_outside_the_catalogued_lookup_form_are_refused(world, params):
    _on(world)
    port = FakeDirectPort()
    assert _query(world, port, parameters=params).code == "invalid_parameters" and port.calls == []


def test_an_unknown_command_is_refused(world):
    _on(world)
    port = FakeDirectPort()
    for command in ("users/create", "hikvision_intercom/peer_bindings/get", ""):
        assert _query(world, port, command=command).code == "unknown_command"
    assert port.calls == []


def test_every_call_writes_exactly_one_audit_row(world):
    port = FakeDirectPort()
    _query(world, port)  # off
    _on(world)
    _query(world, port)  # ok
    port.mode = "port_error:outcome_unknown"
    _query(world, port)  # timeout
    assert [r["details"]["outcome"] for r in _audit(world)] == ["peer_query_disabled", "ok", "timeout"]


def test_the_transport_refuses_bad_arguments_without_a_call():
    port = FakeDirectPort()
    t = pq.DirectRegistryTransport(port)
    with pytest.raises(wr.TransportFailure) as exc:
        t.peer_binding_get("", 1)
    assert (exc.value.code, exc.value.detail) == ("not_sent", "invalid_parameters") and port.calls == [] and t.calls == 0
    assert isinstance(t.peer_binding_get(BINDING_REF, 1), wr.VerifiedResult) and t.calls == 1
