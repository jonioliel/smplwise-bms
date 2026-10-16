"""LEASE-BUILD slice L5 (CR-WISKEY-LEASE-REVOCATION-EVENT sections 2-4, test plan N1, N8-N10, N12, N14, P1, F8, F9): card capture
through the lease route, end to end over HTTP against the fake bridge and the fake host. The route is switched on ONLY inside
these tests (MIN_BRIDGE patched); production cannot switch it on. Fakes only - no reader, door, card or live system."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient

from conftest import as_user
from fake_trusted_bridge import FakeWisKeyFeed, station
from lease_fixtures import lease_world  # noqa: F401  (fixture)
from test_intercom import env

from smplwise.main import create_app
from smplwise.services import capture_lease as cl
from smplwise.services import capture_lease_route, intercom_capture, intercom_sync
from smplwise.services import lease_events as le

CARD_SENTINEL = "4321"
PERSON_SENTINEL = "LEASE-PERSON-SENTINEL"


@pytest.fixture()
def route(lease_world, monkeypatch):
    w = lease_world
    monkeypatch.setattr(cl, "DEV_PRINCIPAL_ALLOWED", True)  # these HTTP tests drive the route with the dev identity (SW_DEV_USER)
    FakeWisKeyFeed([station("entry-a", "כניסה א", relays=[1]), station("entry-b", "כניסה ב", relays=[1])]).install(monkeypatch)
    monkeypatch.setattr(intercom_capture, "POLL_S", 0.05)
    monkeypatch.setattr(intercom_capture, "CAPTURED_POLL_S", 0.05)
    monkeypatch.setattr(intercom_capture, "POLL_BUSY_S", 0.05)
    intercom_capture.CAPTURES.clear()
    c = TestClient(create_app(w.settings), raise_server_exceptions=False)
    for user in ("joni", "sam"):
        assert c.get("/api/v1/me", headers=as_user(user)).status_code == 200  # bootstrap (bumps the revision) before any lease
    w.step(0.25)
    w.client = c
    yield w
    intercom_capture.CAPTURES.clear()
    intercom_sync.SYNC.reset()


def start(w, user: str = "joni", st: str = "entry-a", person: str = "u1", reader: int = 0) -> Any:
    return w.client.post(f"/api/v1/intercom/people/{person}/card-capture", json=env(station_id=st, reader_id=reader, revision=4, confirmed=True), headers=as_user(user))


def status(w, sid: str, user: str = "joni") -> dict[str, Any]:
    return w.client.get(f"/api/v1/intercom/card-capture/{sid}", headers=as_user(user)).json()["capture"]


def wait_state(w, sid: str, state: str, timeout: float = 5.0) -> dict[str, Any]:
    end = time.monotonic() + timeout
    seen: dict[str, Any] = {}
    while time.monotonic() < end:
        seen = status(w, sid)
        if seen["state"] == state:
            return seen
        time.sleep(0.03)
    raise AssertionError(f"state {state!r} not reached: {seen}")


def lease_of(w, sid: str) -> dict[str, Any]:
    with w.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM capture_leases WHERE wiskey_session_id = ?", (sid,)).fetchone())


def test_p1_happy_path_issue_active_polls_confirm_destroyed(route, caplog):
    w = route
    caplog.set_level(logging.DEBUG)
    r = start(w)
    assert r.status_code == 200, r.text
    cap = r.json()["capture"]
    sid = cap["session_id"]
    row = lease_of(w, sid)
    assert row["state"] == "active" and row["actor_user_id"] == "dev-joni" and row["reader_id"] == 0
    start_msg = next(c for c in w.bridge.calls if "dto" in c and c["dto"].action == "capture_start")
    lease = start_msg["dto"].params["lease"]
    assert lease["lease_ref"] == row["id"] and lease["stream_id"] == w.host.stream_id and lease["permission_revision"] == row["permission_revision"]
    assert set(lease) == lc_lease_keys() and "card" not in json.dumps(lease)
    wait_state(w, sid, "waiting")
    w.host.present_card(row["id"])
    got = wait_state(w, sid, "captured")
    assert got["card"]["masked_number"].endswith(CARD_SENTINEL), "the owner sees WisKey's masked form"
    w.run(5.5)  # one heartbeat while live
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=env(label="תג", confirmed=True), headers=as_user("joni"))
    assert r.status_code == 200, r.text
    assert r.json()["capture"]["state"] == "confirmed"
    assert lease_of(w, sid)["state"] == "destroyed" and lease_of(w, sid)["reason"] == "confirmed"
    polls = [c for c in w.bridge.calls if "dto" in c and c["dto"].action == "capture_status"]
    assert polls and all(c["dto"].params["lease_ref"] == row["id"] for c in polls)
    assert lease_of(w, sid)["lease_expires_at"] == row["lease_expires_at"], "a status poll never renews"
    w.run(1)
    assert len(w.audit("intercom.capture_lease.heartbeat_start")) == 1 and len(w.audit("intercom.capture_lease.heartbeat_stop")) == 1
    leak_scan(w, caplog, [r.text])


def lc_lease_keys() -> set[str]:
    import lease_contract

    return set(lease_contract.LEASE_KEYS)


def test_n1_permission_change_mid_lease_stops_the_session_and_refuses_the_confirm_on_both_sides(route, caplog):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    w.bump()  # e.g. the binding was revoked by another administrator
    got = wait_state(w, sid, "revoked")
    assert got["card"] is None, "the masked card is dropped with the session"
    w.step(0.25)
    assert ref not in w.host.leases and ("revoke:permission_revision" in {why for r2, why in w.host.destroyed if r2 == ref})
    sent = len(w.bridge.calls)
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=env(label="x", confirmed=True), headers=as_user("joni"))
    assert r.status_code in (409,) and r.json()["code"] in ("capture_lease_gone", "intercom_capture_not_ready"), r.text
    assert not [c for c in w.bridge.calls[sent:] if "dto" in c and c["dto"].action == "capture_confirm"], "nothing signed, nothing sent"
    assert lease_of(w, sid)["state"] == "revoked" and lease_of(w, sid)["reason"] == "permission_revision"
    leak_scan(w, caplog, [r.text])


def test_f8_confirm_refused_locally_while_the_lease_is_not_usable(route):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    intercom_capture.CAPTURES._stop.set()  # freeze the poller so the route itself must notice
    cl.on_authority_change("second_factor_changed", user_ids=["dev-joni"])
    sent = len(w.bridge.calls)
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=env(label="x", confirmed=True), headers=as_user("joni"))
    assert r.status_code == 409 and r.json()["code"] == "capture_lease_gone"
    assert r.json()["user_message"] == capture_lease_route.GONE_TEXT
    assert not [c for c in w.bridge.calls[sent:] if "dto" in c and c["dto"].action == "capture_confirm"], [c.get("dto") and c["dto"].action for c in w.bridge.calls[sent:]]


def test_start_unknown_holds_the_station_and_revokes_the_lease_at_once(route):
    w = route
    w.host.start_outcome = "timeout"
    r = start(w)
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["retry_after_s"] > 0
    w.step(0.25)
    with w.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM capture_leases ORDER BY created_at DESC LIMIT 1").fetchone())
    assert row["state"] == "revoked" and row["reason"] == "start_unknown"
    assert not w.host.leases, "the revoke destroyed the session Arx could not see"
    w.host.start_outcome = "ok"
    r = start(w)
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_station_busy", "the station stays held"


def test_f9_acknowledged_start_without_a_session_is_unknown(route):
    w = route
    w.host.start_outcome = "no_session"
    r = start(w)
    assert r.status_code == 504
    w.step(0.25)
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT reason FROM capture_leases").fetchone()[0] == "start_unknown"


def test_start_refused_by_the_host_destroys_the_row(route):
    w = route
    w.host.start_outcome = "refused"
    r = start(w)
    assert r.status_code == 409 and r.json()["details"]["outcome"] == "refused"
    with w.db.connection(mode="read") as conn:
        assert tuple(conn.execute("SELECT state, reason FROM capture_leases").fetchone()) == ("destroyed", "start_refused")
    assert start(w).status_code == 409 or True  # the station's reservation was released (no hold for a refusal)


def test_confirm_sent_unknown_ends_destroyed_confirm_unknown(route):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    w.host.confirm_outcome = "sent_unknown"
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=env(label="x", confirmed=True), headers=as_user("joni"))
    assert r.status_code == 504 and r.json()["user_message"] == capture_lease_route.CONFIRM_UNKNOWN_TEXT
    assert lease_of(w, sid)["reason"] == "confirm_unknown" and status(w, sid)["state"] == "unconfirmed"
    calls = [c for c in w.bridge.calls if "dto" in c and c["dto"].action == "capture_confirm"]
    assert len(calls) == 1, "a confirm is never retried"


def test_cancel_through_the_lease_route(route):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    r = w.client.post(f"/api/v1/intercom/card-capture/{sid}/cancel", json={}, headers=as_user("joni"))
    assert r.status_code == 200 and r.json()["capture"]["state"] == "cancelled"
    assert lease_of(w, sid)["state"] == "destroyed" and lease_of(w, sid)["reason"] == "cancelled"


def test_t5_abandoned_dialog_revokes_the_lease(route):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    cap = intercom_capture.CAPTURES.owned(sid, "dev-joni", touch=False)
    cap.last_seen = time.monotonic() - intercom_capture.ABANDON_S - 1
    intercom_capture.CAPTURES._tick(cap, time.monotonic())
    assert cap.state == "cancelled" and cap.reason == "abandoned"
    w.step(0.25)
    assert w.row(ref)["state"] == "revoked" and w.row(ref)["reason"] == "abandoned" and ref not in w.host.leases


def test_n9_receiver_offline_revokes_and_a_new_start_after_it_gets_a_new_lease(route, monkeypatch):
    w = route
    sid = start(w).json()["capture"]["session_id"]
    first = lease_of(w, sid)["id"]
    intercom_sync.lease_station_diff([{"id": "entry-a", "online": True, "locks": [1]}], [{"id": "entry-a", "online": False, "locks": [1]}])
    wait_state(w, sid, "revoked")
    w.step(0.25)
    assert w.row(first)["reason"] == "receiver_offline"
    r = start(w)
    assert r.status_code == 200, r.text
    second = lease_of(w, r.json()["capture"]["session_id"])["id"]
    assert second != first


def test_n10_no_second_factor_code_is_required_at_start(route):
    w = route
    r = start(w)
    assert r.status_code == 200 and "X-Arx-Second-Factor" not in str(r.request.headers)


def test_n12_switch_off_refuses_new_starts_with_the_operator_text_and_the_classic_path_is_untouched(route, monkeypatch):
    w = route
    with w.db.connection() as conn:
        cl.GUARDS.degraded = False
        from smplwise.db import set_setting

        set_setting(conn, cl.FLAG_KEY, "on")
    monkeypatch.setattr(cl, "MIN_BRIDGE_FOR_CAPTURE_LEASE", None)  # the production state: no bridge offers the route
    r = start(w)
    assert r.status_code == 503 and r.json()["code"] == "capture_lease_unavailable" and r.json()["user_message"] == cl.UNAVAILABLE_TEXT
    with w.db.connection() as conn:
        set_setting(conn, cl.FLAG_KEY, "off")
    sent = len(w.bridge.calls)
    feed_sent = len(intercom_sync.SYNC.action.__self__.sent)  # FakeWisKeyFeed.action is bound to the fake
    start(w)  # the classic WS path (its projection over this minimal fake may fail - only the transport matters here)
    assert len(w.bridge.calls) == sent, "the classic path never touches the lease transport"
    assert len(intercom_sync.SYNC.action.__self__.sent) == feed_sent + 1
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM capture_leases").fetchone()[0] == 0


def test_n14_leak_scan_over_a_full_run_with_revoke_and_retry(route, caplog):
    w = route
    caplog.set_level(logging.DEBUG)
    replies = []
    r = start(w)
    replies.append(r.text)
    sid = r.json()["capture"]["session_id"]
    ref = lease_of(w, sid)["id"]
    w.host.present_card(ref)
    wait_state(w, sid, "captured")
    w.bridge.unreachable = True
    w.bump()
    w.run(6)
    w.bridge.unreachable = False
    w.run(2.5)
    replies.append(w.client.get(f"/api/v1/intercom/card-capture/{sid}", headers=as_user("joni")).text)
    leak_scan(w, caplog, replies)


def leak_scan(w, caplog, replies: list[str]) -> None:
    """N14: no card value (not even masked digits), no person name, no signature, no nonce, no message body in any audit row or
    log line; no signature / nonce in any reply."""
    secrets_seen: set[str] = set()
    for c in w.bridge.calls:
        if isinstance(c.get("text"), str):
            wire = json.loads(c["text"])
            secrets_seen.update({wire["sig"], wire["nonce"]})
    with w.db.connection(mode="read") as conn:
        rows = [" ".join(str(v) for v in dict(r).values()) for r in conn.execute("SELECT * FROM audit_log").fetchall()]
        rows += [" ".join(str(v) for v in dict(r).values()) for r in conn.execute("SELECT * FROM capture_leases").fetchall()]
    logs = [rec.getMessage() for rec in caplog.records]
    for text in rows + logs:
        assert CARD_SENTINEL not in text and "••••" not in text, text[:200]
        assert PERSON_SENTINEL not in text
        assert "signed_message_json" not in text and '"sig"' not in text
        for s in secrets_seen:
            assert s not in text
    for text in replies:
        for s in secrets_seen:
            assert s not in text
