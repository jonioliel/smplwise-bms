"""CR-040 (WXROT): the add-on's half of the bridge trust-key rotation, end to end against `FakeTrustBridge` - the REAL bridge 0.9.1
core (custom_components/smplwise_bridge/trust.py) behind `ha_client.call_service`. Synthetic test keys only; no Home Assistant,
bridge, WisKey, station or door is contacted, and nothing here executes a physical action.

Proven: the happy path (one atomic switch on both sides, the old key refused at once, a device command continuing under the new
key); every refusal before dispatch writes no row, sends nothing and is never retried; a request that never left is `not_rotated`;
a definite bridge refusal is `not_rotated`; a lost / dropped / 500 / malformed answer is `unknown` and the gate holds every signed
path (outbound and inbound, the discovery announcement, the ops that were about to sign) until a STATUS CHECK resolves it - never a
second rotation message; crash points on both sides (before / after the bridge handled it, the add-on dying with the row committed)
and the start-up recovery; the fence (a late original message can never apply); `neither_key` and `reverted_on_bridge`; the
janitor's timing; re-pair supersedes; concurrent rotations (one dispatch); replays; the migration's triggers; derivation identical
to the bridge's; the backup exclusion; and no key, salt, proof, nonce or signature in any answer, audit row, table row or log."""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import bridge_loader
import pytest
from fake_trusted_bridge import TEST_TRUST_KEY, Crash, FakeTrustBridge
from fastapi.testclient import TestClient

from smplwise.db import get_setting, now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import backup, bridge_install, bridge_trust, ha_bridge, ha_client

API = "/api/v1"
ROTATE = f"{API}/ha/bridge/trust/rotations"
VIEW = f"{API}/ha/bridge/trust"
bridge_core = bridge_loader.load("trust")


@pytest.fixture()
def env(settings, monkeypatch):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")  # the bootstrap administrator (joni, system_admin)
    db = c.app.state.db
    with db.connection() as conn:
        set_setting(conn, "bridge.secret", TEST_TRUST_KEY)
        set_setting(conn, "bridge.paired_at", "2026-10-13T00:00:00Z")
    fake = FakeTrustBridge().install(monkeypatch)
    r = c.post(f"{API}/ha/bridge/directory", json=fake.push())  # the 0.9.1 push: version, capability, epoch
    assert r.status_code == 200, r.text
    bridge_trust.reset_limits()
    yield c, db, fake
    fake.close()


def setting(db: Any, key: str) -> str | None:
    with db.connection(mode="read") as conn:
        return get_setting(conn, key)


def rows(db: Any) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM bridge_trust_rotations ORDER BY requested_at, rowid").fetchall()]


def audits(db: Any, prefix: str = "bridge.trust") -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY id", (prefix + "%",)).fetchall()]


def rotate(c: TestClient, **body: Any) -> Any:
    return c.post(ROTATE, json={"confirmed": True, **body})


def check(c: TestClient, request_id: str) -> Any:
    return c.post(f"{ROTATE}/{request_id}/check")


def sign_with_arx_key(db: Any) -> dict[str, Any]:
    with db.connection(mode="read") as conn:
        key = ha_bridge.signing_key(conn)
    return ha_bridge.sign(key or "", {"user_id": "u", "domain": "light", "service": "turn_on", "data": {"entity_id": "light.hall"}, "request_id": uuid.uuid4().hex[:12]})


# ---------------------------------------------------------------- the happy path

def test_one_atomic_switch_on_both_sides(env):
    c, db, fake = env
    r = rotate(c)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["state"] == "rotated" and out["code"] == "rotated" and (out["epoch_from"], out["epoch_to"]) == (1, 2)
    assert "2" in out["message"] and out["trust"]["epoch"] == 2 and out["trust"]["open"] is None
    assert setting(db, "bridge.secret") == fake.key != TEST_TRUST_KEY, "Arx and the bridge hold the same NEW key"
    assert fake.epoch == 2 and setting(db, "bridge.trust.epoch") == "2"
    assert setting(db, "bridge.trust.pending_key") is None, "the pending key is gone once resolved"
    assert len(fake.rotations()) == 1 and not fake.statuses()
    [row] = rows(db)
    assert row["state"] == "rotated" and row["open_slot"] is None and row["initiator_id"] == "dev-joni" and row["resolved_at"]
    # the old key is refused at once by every signed service; the new one works
    old = ha_bridge.sign(TEST_TRUST_KEY, {"user_id": "u", "domain": "light", "service": "turn_on", "data": {"entity_id": "light.hall"}, "request_id": "old1"})
    assert fake.verifier.verify(dict(old)) == "bad_signature"
    assert fake.verifier.verify(dict(sign_with_arx_key(db))) is None
    # the bridge's next push is signed with the new key and accepted; it confirms the epoch
    assert c.post(f"{API}/ha/bridge/directory", json=fake.push()).status_code == 200
    v = c.get(VIEW).json()
    assert v["bridge"]["epoch_seen"] == 2 and v["bridge"]["supported"] is True and v["can_rotate"] is True and v["history"][0]["state"] == "rotated"
    acts = [a["action"] for a in audits(db)]
    assert acts == ["bridge.trust.rotation.requested", "bridge.trust.rotation.result"]


def test_a_device_command_continues_under_the_new_key_and_never_under_the_old(env):
    c, db, fake = env
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, name, domain, state, available, first_seen_at, updated_at) VALUES ('light.hall', 'מבואה', 'light', 'off', 1, ?, ?)",
                     (now_iso(), now_iso()))
    body = lambda n: {"allowed_action_id": "light.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None,  # noqa: E731
                      "client_request_id": f"rot-{n}-{time.time_ns()}", "expires_at": "2099-01-01T00:00:00Z"}
    assert c.post(f"{API}/ha/entities/light.hall/actions", json=body(1)).status_code == 202
    assert fake.executed[-1]["error"] is None
    assert rotate(c).json()["state"] == "rotated"
    assert c.post(f"{API}/ha/entities/light.hall/actions", json=body(2)).status_code == 202
    assert fake.executed[-1]["error"] is None, "signed with the new key, verified by the bridge"
    assert len(fake.executed) == 2


def test_rotations_chain_epochs(env):
    c, db, fake = env
    for expected in (2, 3, 4):
        assert rotate(c).json()["state"] == "rotated"
        assert fake.epoch == expected and setting(db, "bridge.trust.epoch") == str(expected)
    assert len({r["request_id"] for r in rows(db)}) == 3 and len([e for e in fake.ledger.values() if e["outcome"] == "applied"]) == 3


# ---------------------------------------------------------------- refused before dispatch: no row, nothing sent, never retried

def _assert_refused(c: TestClient, db: Any, fake: FakeTrustBridge, r: Any, status: int, code: str) -> None:
    assert r.status_code == status, r.text
    body = r.json()
    assert body["code"] == code and body["user_message"], "a clear message"
    assert not fake.calls, "nothing was sent"
    assert not rows(db), "no request was recorded"
    assert setting(db, "bridge.secret") == TEST_TRUST_KEY and setting(db, "bridge.trust.pending_key") is None


def test_refusals_before_anything_is_written(env, monkeypatch):
    c, db, fake = env
    _assert_refused(c, db, fake, c.post(ROTATE, json={}), 409, "confirmation_required")
    _assert_refused(c, db, fake, c.post(ROTATE, json={"confirmed": "yes"}), 422, "validation")
    _assert_refused(c, db, fake, c.post(ROTATE, json={"confirmed": True, "salt": "x"}), 422, "validation")
    with db.connection() as conn:  # an older bridge (its last push said 0.9.0, USR2 - no trust rotation)
        set_setting(conn, "bridge.integration_version", "0.9.0")
    r = rotate(c)
    _assert_refused(c, db, fake, r, 409, "rotation_unsupported")
    assert r.json()["details"] == {"required": "0.9.1", "seen": "0.9.0"}
    assert c.post(f"{API}/ha/bridge/directory", json=fake.push(trust_rotation=0)).status_code == 200  # 0.9.1 without the capability
    _assert_refused(c, db, fake, rotate(c), 409, "rotation_unsupported")
    assert c.post(f"{API}/ha/bridge/directory", json=fake.push()).status_code == 200
    with db.connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = 'bridge.paired_at'")
    _assert_refused(c, db, fake, rotate(c), 503, "bridge_not_paired")
    with db.connection() as conn:
        set_setting(conn, "bridge.paired_at", "2026-10-13T00:00:00Z")
    monkeypatch.setattr(ha_client, "configured", lambda s: False)
    _assert_refused(c, db, fake, rotate(c), 503, "ha_not_configured")
    reasons = [a["reason"] for a in audits(db, "bridge.trust.rotation.refused")]
    assert reasons == ["confirmation_required", "unsupported", "unsupported", "not_paired", "ha_not_configured"]


def test_a_request_that_never_left_is_not_rotated_and_not_retried(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "unreachable")
    out = rotate(c).json()
    assert (out["state"], out["code"]) == ("not_rotated", "not_sent") and "לא הוחלף" in out["message"]
    assert len(fake.rotations()) == 1 and fake.rotations()[0]["answer"] is None, "one attempt, never handled, never repeated"
    assert fake.epoch == 1 and fake.key == TEST_TRUST_KEY and setting(db, "bridge.secret") == TEST_TRUST_KEY
    assert setting(db, "bridge.trust.pending_key") is None and bridge_trust_open(db) is None
    assert rotate(c).json()["state"] == "rotated", "nothing is stuck: a NEW request (a new id) rotates"


def test_a_switched_key_resets_the_capture_leases_and_a_kept_key_does_not(env, monkeypatch):
    """CR-WISKEY-LEASE-REVOCATION-EVENT T9 (WXROT rebase onto integ/264): a rotation that switched the key revokes every live capture
    lease and asks the lease worker for a new stream with reason `key_rotation`; a rotation that did not switch it touches nothing."""
    from smplwise.services import capture_lease, lease_events

    seen: list[tuple[str, Any]] = []
    monkeypatch.setattr(capture_lease, "on_authority_change", lambda reason, **kw: seen.append(("revoke", (reason, kw.get("all")))) or 0)
    monkeypatch.setattr(lease_events.WORKER, "request_reset", lambda reason: seen.append(("reset", reason)))
    c, db, fake = env
    fake.fail_next("trust_rotate", "unreachable")
    assert rotate(c).json()["state"] == "not_rotated"
    assert seen == [], "a key that did not change keeps the leases"
    r = rotate(c)
    assert r.status_code == 200 and r.json()["state"] == "rotated", r.text
    assert seen == [("revoke", ("key_rotation", True)), ("reset", "key_rotation")]


def test_the_lease_signer_reports_an_open_rotation_as_not_sendable(env):
    """While a rotation is open the lease route signs nothing: lease_events turns the 409 gate into its own NotSendable (no ApiError
    escapes the worker)."""
    from smplwise.services import lease_events

    c, db, fake = env
    fake.fail_next("trust_rotate", "timeout_after")
    assert rotate(c).json()["state"] == "unknown"
    with db.connection(mode="read") as conn, pytest.raises(lease_events.NotSendable) as err:
        lease_events._secret(conn)
    assert err.value.code == "bridge_rotation_in_progress"


def bridge_trust_open(db: Any) -> Any:
    with db.connection(mode="read") as conn:
        return bridge_trust.open_row(conn)


@pytest.mark.parametrize("fault, code", [("storage", "refused:state/storage_unavailable"), ("epoch", "refused:state/epoch_mismatch")])
def test_a_bridge_refusal_is_definite(env, fault, code):
    c, db, fake = env
    if fault == "storage":
        fake.store.fail_next_save = True
    else:
        with db.connection() as conn:
            set_setting(conn, "bridge.trust.epoch", "5")
    out = rotate(c).json()
    assert (out["state"], out["code"]) == ("not_rotated", code)
    assert fake.key == TEST_TRUST_KEY and fake.epoch == 1 and setting(db, "bridge.secret") == TEST_TRUST_KEY
    assert not fake.statuses() and bridge_trust_open(db) is None


@pytest.mark.parametrize("fault, code, applied", [("timeout_after", "transport", True), ("crash_after", "transport", True), ("http_500", "bridge_error", True),
                                                  ("garbage", "invalid_response", True), ("drop_before", "transport", False)])
def test_unknown_holds_the_gate_until_a_status_check_resolves_it(env, fault, code, applied):
    c, db, fake = env
    fake.fail_next("trust_rotate", fault)
    out = rotate(c).json()
    assert (out["state"], out["code"]) == ("unknown", code) and "לא ידוע" in out["message"]
    assert out["trust"]["open"]["request_id"] == out["request_id"] and out["trust"]["can_rotate"] is False and out["trust"]["blocked"] == "in_progress"
    assert setting(db, "bridge.secret") == TEST_TRUST_KEY, "Arx keeps the current key while it does not know"
    # the gate: nothing is signed, outbound or inbound, while the question is open
    with db.connection(mode="read") as conn, pytest.raises(ApiError) as e:
        ha_bridge.signing_key(conn)
    assert e.value.status == 409 and e.value.code == "bridge_rotation_in_progress" and e.value.details["outcome"] == "not_sent"
    push = c.post(f"{API}/ha/bridge/directory", json=fake.push())
    assert push.status_code == 409 and push.json()["code"] == "bridge_rotation_in_progress"
    again = rotate(c)
    assert again.status_code == 409 and again.json()["code"] == "rotation_in_progress" and again.json()["details"]["request_id"] == out["request_id"]
    assert len(fake.rotations()) == 1, "the rotation is never sent a second time"
    # the status check resolves it - the outcome follows what the bridge really did
    res = check(c, out["request_id"])
    assert res.status_code == 200, res.text
    resolved = res.json()
    if applied:
        assert (resolved["state"], resolved["code"]) == ("rotated", "status_applied")
        assert setting(db, "bridge.secret") == fake.key != TEST_TRUST_KEY and fake.epoch == 2 and setting(db, "bridge.trust.epoch") == "2"
    else:
        assert (resolved["state"], resolved["code"]) == ("not_rotated", "fenced")
        assert fake.ledger[out["request_id"]]["outcome"] == "fenced" and fake.key == TEST_TRUST_KEY == setting(db, "bridge.secret")
    assert len(fake.rotations()) == 1, "resolved by status only"
    assert bridge_trust_open(db) is None and setting(db, "bridge.trust.pending_key") is None
    assert c.post(f"{API}/ha/bridge/directory", json=fake.push()).status_code == 200, "the gate is open again"
    # the resolved row stays resolved: another check asks nothing
    n = len(fake.calls)
    assert check(c, out["request_id"]).json()["state"] == resolved["state"] and len(fake.calls) == n


def test_the_fence_stops_a_late_original_message(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "drop_before")  # the message is lost before the bridge handled it ...
    out = rotate(c).json()
    original = fake.rotations()[0]["text"]
    assert check(c, out["request_id"]).json()["state"] == "not_rotated"
    late = fake.handle("trust_rotate", original)  # ... and arrives after the check
    assert late == {"result": "rejected", "stage": "state", "code": "request_seen", "request_id": out["request_id"]}
    assert fake.key == TEST_TRUST_KEY and fake.epoch == 1


def test_the_add_on_dying_with_the_row_committed(env):
    """Arx crashes after the durable `dispatching` row: at the next start the row is `unknown` (`interrupted`); a status check
    resolves it to what the bridge did - before it got the message (fenced) and after (rotated)."""
    c, db, fake = env
    for when, expected in (("arx_crash_before", "not_rotated"), ("arx_crash_after", "rotated")):
        fake.fail_next("trust_rotate", when)
        with pytest.raises(Crash):
            rotate(c)
        [row] = [r for r in rows(db) if r["state"] in ("dispatching", "unknown")]
        assert row["state"] == "dispatching" and setting(db, "bridge.trust.pending_key"), "committed before the call left"
        assert bridge_trust.recover(db) == 1
        row = next(r for r in rows(db) if r["request_id"] == row["request_id"])
        assert (row["state"], row["code"]) == ("unknown", "interrupted")
        assert check(c, row["request_id"]).json()["state"] == expected
        assert bridge_trust.recover(db) == 0
    assert setting(db, "bridge.secret") == fake.key and fake.epoch == 2
    assert [a["action"] for a in audits(db, "bridge.trust.rotation.interrupted")] == ["bridge.trust.rotation.interrupted"] * 2


def test_neither_key_then_re_pair_supersedes(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "timeout_after")
    out = rotate(c).json()
    fake.re_pair("TEST-ONLY-a-third-key-NOT-A-REAL-SECRET")  # the bridge was re-paired by hand meanwhile
    res = check(c, out["request_id"]).json()
    assert (res["state"], res["code"]) == ("unknown", "neither_key")
    assert len(fake.statuses()) == 2, "the pending key, then the current one; both refused at the signature"
    r = c.get(f"{API}/ha/bridge/pairing?regenerate=true")
    assert r.status_code == 200
    [row] = rows(db)
    assert (row["state"], row["code"]) == ("superseded", "repaired")
    assert setting(db, "bridge.trust.pending_key") is None and setting(db, "bridge.trust.epoch") == "1" and bridge_trust_open(db) is None
    assert [a["action"] for a in audits(db, "bridge.trust.rotation.superseded")] == ["bridge.trust.rotation.superseded"]


def test_reverted_on_the_bridge(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "timeout_after")
    out = rotate(c).json()
    assert fake.ledger[out["request_id"]]["outcome"] == "applied"
    fake.re_pair(TEST_TRUST_KEY, "back-to-old")  # e.g. the old code typed into the config flow again: the ledger is kept
    res = check(c, out["request_id"]).json()
    assert (res["state"], res["code"]) == ("not_rotated", "reverted_on_bridge")
    assert setting(db, "bridge.secret") == TEST_TRUST_KEY == fake.key and setting(db, "bridge.trust.epoch") == "1"


def test_a_status_check_waits_for_the_rotation_in_flight_and_concurrent_rotations_dispatch_once(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "hold")
    first: dict[str, Any] = {}

    def run() -> None:
        first["r"] = rotate(c)

    t = threading.Thread(target=run)
    t.start()
    assert fake.holding.wait(10)
    try:
        open_ = bridge_trust_open(db)
        assert open_ is not None and open_["state"] == "dispatching"
        second = rotate(c)
        assert second.status_code == 409 and second.json()["code"] == "rotation_in_progress"
        busy = check(c, open_["request_id"])
        assert busy.status_code == 409 and busy.json()["code"] == "rotation_in_flight"
        assert c.post(f"{API}/ha/bridge/directory", json=fake.push()).status_code == 409
    finally:
        fake.release()
        t.join(20)
    assert first["r"].json()["state"] == "rotated"
    assert len(fake.rotations()) == 1, "exactly one rotation message left"
    assert [r["state"] for r in rows(db)] == ["rotated"]


def test_the_janitor_checks_after_the_lifetime_then_at_most_once_a_minute(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "timeout_after")
    out = rotate(c).json()
    start = datetime.strptime(rows(db)[0]["requested_at"][:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp()
    settings = c.app.state.settings
    assert bridge_trust.janitor(db, settings, now=start + 10) is None and not fake.statuses(), "not before the message expired"
    fake.fail_next("trust_status", "unreachable", "unreachable")
    assert bridge_trust.janitor(db, settings, now=start + 40) == "unknown"
    assert bridge_trust.janitor(db, settings, now=time.time() + 30) is None, "at most once a minute"
    assert bridge_trust.janitor(db, settings, now=time.time() + 61) == "unknown", "Home Assistant still down: the same answer"
    assert len(audits(db, "bridge.trust.rotation.status_check")) == 1, "a repeated identical answer adds no audit row"
    assert bridge_trust.janitor(db, settings, now=time.time() + 122) == "rotated"
    assert bridge_trust.janitor(db, settings, now=time.time() + 600) is None, "nothing open, nothing asked"
    checks = audits(db, "bridge.trust.rotation.status_check")
    assert [json.loads(a["details_json"])["automatic"] for a in checks] == [True, True] and all(a["actor_user_id"] is None for a in checks)
    assert rows(db)[0]["status_checks"] == 3 and out["request_id"] == rows(db)[0]["request_id"]


def test_manual_checks_are_rate_limited(env):
    c, db, fake = env
    fake.fail_next("trust_rotate", "timeout_after")
    rid = rotate(c).json()["request_id"]
    fake.fail_next("trust_status", *["unreachable"] * 6)
    for _ in range(6):
        assert check(c, rid).json()["state"] == "unknown"
    r = check(c, rid)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"


# ---------------------------------------------------------------- the gate on the other paths

def test_discovery_is_not_announced_while_a_rotation_is_open(env, monkeypatch):
    c, db, fake = env
    posted: list[Any] = []
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: "test-token")
    monkeypatch.setattr(ha_client, "post_discovery", lambda *a, **k: posted.append(a) or {})
    assert bridge_install.announce_discovery(db, c.app.state.settings) is True and len(posted) == 1
    fake.fail_next("trust_rotate", "timeout_after")
    rid = rotate(c).json()["request_id"]
    assert bridge_install.announce_discovery(db, c.app.state.settings) is False and len(posted) == 1
    assert bridge_install.STATE["last_error"] == "discovery:rotation_open"
    check(c, rid)
    assert bridge_install.announce_discovery(db, c.app.state.settings) is True and len(posted) == 2


def test_a_device_command_is_refused_before_signing_while_open(env):
    c, db, fake = env
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, name, domain, state, available, first_seen_at, updated_at) VALUES ('light.hall', 'מבואה', 'light', 'off', 1, ?, ?)",
                     (now_iso(), now_iso()))
    fake.fail_next("trust_rotate", "timeout_after")
    rotate(c)
    r = c.post(f"{API}/ha/entities/light.hall/actions", json={"allowed_action_id": "light.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None,
                                                              "client_request_id": "gate-1", "expires_at": "2099-01-01T00:00:00Z"})
    assert r.status_code == 409 and r.json()["code"] == "bridge_rotation_in_progress" and r.json()["details"]["outcome"] == "not_sent"
    assert not fake.executed, "nothing was sent"
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions").fetchone()[0] == 0, "and nothing was recorded as pending"


def test_automation_and_schedule_ops_settle_when_the_gate_refuses(env):
    from smplwise.services import automation_ops, schedule_ops

    c, db, fake = env
    fake.fail_next("trust_rotate", "timeout_after")
    rotate(c)
    settled: list[tuple[str, str, str]] = []

    class W:
        conn: Any = None
        principal: Any = None

    with db.connection() as conn:
        w = W()
        w.conn = conn
        orig_a, orig_s = automation_ops.store_finish, schedule_ops.store.finish_op
        automation_ops.store_finish = lambda _c, op_id, status, error=None: settled.append(("automation", op_id, status))
        schedule_ops.store.finish_op = lambda _c, op_id, status, error=None: settled.append(("schedule", op_id, status))
        try:
            with pytest.raises(ApiError) as e1:
                automation_ops.bridge_call(w, "upsert", "op-a")
            with pytest.raises(ApiError) as e2:
                schedule_ops.bridge_call(w, "add", "op-s")
        finally:
            automation_ops.store_finish, schedule_ops.store.finish_op = orig_a, orig_s
    assert e1.value.code == e2.value.code == "bridge_rotation_in_progress"
    assert settled == [("automation", "op-a", "failed"), ("schedule", "op-s", "failed")], "settled, never left pending"


# ---------------------------------------------------------------- the bridge owns the epoch

def test_the_epoch_follows_the_bridge_only_through_a_verified_push(env):
    c, db, fake = env
    assert c.post(f"{API}/ha/bridge/directory", json=fake.push(trust_epoch=5)).status_code == 200
    assert setting(db, "bridge.trust.epoch") == "5"
    adopted = audits(db, "bridge.trust.epoch_adopted")
    assert json.loads(adopted[-1]["details_json"]) == {"epoch_from": 1, "epoch_to": 5} and adopted[-1]["actor_user_id"] is None
    forged = ha_bridge.sign("TEST-ONLY-not-the-key", {"users": [], "version": "0.9.1", "trust_epoch": 9, "trust_rotation": 1})
    assert c.post(f"{API}/ha/bridge/directory", json=forged).status_code == 401
    assert setting(db, "bridge.trust.epoch") == "5"
    out = rotate(c).json()  # Arx says epoch 5, the bridge holds 1: a definite refusal, nothing changes
    assert (out["state"], out["code"]) == ("not_rotated", "refused:state/epoch_mismatch")


# ---------------------------------------------------------------- replays and the never-delete / never-reopen rules

def test_replays_never_rotate_twice(env):
    c, db, fake = env
    rotate(c)
    text = fake.rotations()[0]["text"]
    assert fake.handle("trust_rotate", text) == {"result": "rejected", "stage": "signature", "code": "bad_signature", "request_id": json.loads(text)["request_id"]}
    assert fake.epoch == 2
    ids = [json.loads(call["text"])["request_id"] for call in fake.calls]
    nonces = [json.loads(call["text"])["nonce"] for call in fake.calls]
    assert len(set(ids)) == len(ids) and len(set(nonces)) == len(nonces)


def test_the_table_never_deletes_never_renames_never_reopens_and_holds_one_open_row(env):
    c, db, fake = env
    rotate(c)
    rid = rows(db)[0]["request_id"]
    with db.connection() as conn:
        with pytest.raises(sqlite3.IntegrityError, match="never deleted"):
            conn.execute("DELETE FROM bridge_trust_rotations")
        with pytest.raises(sqlite3.IntegrityError, match="never changes"):
            conn.execute("UPDATE bridge_trust_rotations SET request_id = 'x' WHERE request_id = ?", (rid,))
        with pytest.raises(sqlite3.IntegrityError, match="never re-opened"):
            conn.execute("UPDATE bridge_trust_rotations SET state = 'unknown', open_slot = 1 WHERE request_id = ?", (rid,))
        now = now_iso()
        conn.execute("INSERT INTO bridge_trust_rotations(request_id, initiator_id, epoch_from, epoch_to, state, open_slot, requested_at) VALUES ('a', 'u', 2, 3, 'unknown', 1, ?)", (now,))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO bridge_trust_rotations(request_id, initiator_id, epoch_from, epoch_to, state, open_slot, requested_at) VALUES ('b', 'u', 2, 3, 'dispatching', 1, ?)", (now,))
        with pytest.raises(sqlite3.IntegrityError):  # an open state without the slot
            conn.execute("INSERT INTO bridge_trust_rotations(request_id, initiator_id, epoch_from, epoch_to, state, requested_at) VALUES ('c', 'u', 2, 3, 'unknown', ?)", (now,))
        with pytest.raises(sqlite3.IntegrityError):  # an epoch jump
            conn.execute("INSERT INTO bridge_trust_rotations(request_id, initiator_id, epoch_from, epoch_to, state, requested_at) VALUES ('d', 'u', 2, 4, 'rotated', ?)", (now,))
    assert {r["request_id"] for r in rows(db)} == {rid, "a"}, "only the valid rows exist"


# ---------------------------------------------------------------- derivation, backup, the remote channel

def test_the_add_on_derives_exactly_as_the_bridge():
    import random

    rnd = random.Random(11)
    for _ in range(40):
        key, salt, epoch_to, rid = rnd.randbytes(18).hex(), rnd.randbytes(32).hex(), rnd.randint(2, 10_000), str(uuid.UUID(int=rnd.getrandbits(128), version=4))
        assert bridge_trust.derive_next_key(key, salt, epoch_to, rid) == bridge_core.derive_next_key(key, salt, epoch_to, rid)
        assert bridge_trust.proof(key, "status", rid, "x", 3) == bridge_core.proof(key, "status", rid, "x", 3)
    assert bridge_trust.PROTOCOL == bridge_core.PROTOCOL and bridge_trust.LIFETIME_S == bridge_core.LIFETIME_MAX_S


def test_trust_settings_are_never_exported_or_restored_and_the_table_is_not_backed_up():
    for key in ("bridge.trust.pending_key", "bridge.trust.epoch", "bridge.trust.epoch_seen", "bridge.secret"):
        assert backup._kept_setting(key), key
    assert "bridge_trust_rotations" not in backup.PROJECT_TABLES


def test_the_trust_routes_are_local_only():
    from smplwise import remote_channel

    assert "/api/v1/ha/bridge/trust" in remote_channel.BLOCKED_ON_REMOTE


def test_startup_recovers_before_the_bridge_start_up_announces():
    src = (bridge_loader.REPO / "smplwise_vms" / "backend" / "smplwise" / "main.py").read_text(encoding="utf-8")
    assert src.index("bridge_trust_svc.recover, app.state.db") < src.index("bridge_install.run_startup, app.state.db, settings")
    assert "bridge_trust.janitor(db, settings)" in src


# ---------------------------------------------------------------- nothing secret anywhere

def test_no_key_salt_proof_nonce_or_signature_leaves_the_rotation(env, caplog):
    c, db, fake = env
    caplog.set_level(logging.DEBUG)
    answers = [rotate(c).json()]
    keys = {TEST_TRUST_KEY, fake.key}
    fake.fail_next("trust_rotate", "timeout_after")
    answers.append(rotate(c).json())
    keys.add(setting(db, "bridge.trust.pending_key") or "")
    answers.append(check(c, answers[-1]["request_id"]).json())
    keys.add(fake.key)
    answers.append(c.get(VIEW).json())
    fake.fail_next("trust_rotate", "unreachable")
    answers.append(rotate(c).json())
    secrets_: set[str] = set(k for k in keys if k)
    for call in fake.calls:
        msg = json.loads(call["text"])
        secrets_ |= {msg["nonce"], msg["sig"], call["text"]}
        if "salt" in msg["params"]:
            secrets_.add(msg["params"]["salt"])
        if call["answer"] and call["answer"].get("proof"):
            secrets_.add(call["answer"]["proof"])
    with db.connection(mode="read") as conn:
        audit_text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)
        table_text = json.dumps(rows(db), ensure_ascii=False)
        other_settings = json.dumps([dict(r) for r in conn.execute("SELECT * FROM settings WHERE key NOT IN ('bridge.secret', 'bridge.trust.pending_key')").fetchall()])
    haystacks = {"answers": json.dumps(answers, ensure_ascii=False), "audit": audit_text, "table": table_text, "settings": other_settings, "log": caplog.text}
    leaks = [(where, s[:12]) for s in secrets_ for where, text in haystacks.items() if s in text]
    assert not leaks, leaks
    assert len(secrets_) > 12
    assert "bridge trust rotation" in caplog.text and answers[0]["request_id"] in caplog.text, "the log channel is really observed"
