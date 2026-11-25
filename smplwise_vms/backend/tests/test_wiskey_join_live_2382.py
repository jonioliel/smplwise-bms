"""WISKEY-JOIN-LIVE-2382 (FAKES ONLY): WisKey's direct join starts and stops at runtime - when the provider setting changes or the
signing key's readiness changes - with no add-on restart; and a people write the direct path did not carry goes over the classic
channel only when that is provably safe.

WisKey here is the in-memory fake direct server of tests/test_wkjoin_295.py (hello, signed direct/connect, an independent check of every
signed envelope and a fresh-nonce rule), the native people write is tests/wkwrite_fake.FakeWisKey behind that socket. The database is
the real migrated one of a test app (the provider row, the audit log). Nothing contacts a network, Home Assistant, a station or WisKey."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from test_wkjoin_295 import ACTOR, JoinServer, received
from w10_fake_station import SECRET
from wkwrite_fake import FakeWisKey

from smplwise.services import capture_lease, ha_bridge, intercom_client, intercom_sync, lease_events
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_direct_join as wdj
from smplwise.services import wiskey_join_live as live
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_write_lineage as wl
from smplwise.services.intercom_media import PROVIDER_KEY

ROTATED = ha_bridge.BridgeKey("r" * 32, "k-2")  # a rotated key never signs on the direct path (WKDIRECT rule)
D = live.JoinManager.DEBOUNCE_S


@pytest.fixture(autouse=True)
def _process_state() -> Any:
    saved = (lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER, wts.TRANSPORT_V2_PROVIDER, wdj.JOIN, live.MANAGER)
    yield
    try:
        wdj.shutdown()
    except Exception:  # noqa: BLE001
        pass
    lease_events.TRANSPORT, wts.TRANSPORT_PROVIDER, wts.TRANSPORT_V2_PROVIDER, wdj.JOIN, live.MANAGER = saved


@pytest.fixture()
def lab(client: Any, settings: Any, monkeypatch: Any) -> Any:
    """A test app's real database, the signing key under the test's control, a fake WisKey and a manager without a thread."""
    state = {"key": SECRET}
    monkeypatch.setattr(ha_bridge, "signing_key", lambda conn: state["key"])
    from smplwise.services import wiskey_direct_catalog as wdc

    server = JoinServer()
    server.discovered = {e.command for e in wdc.load().entries() if e.discovered} | {"users/get_thing", "users/slow", "users/other"}
    db = client.app.state.db
    mgr = live.JoinManager(startup_kw={"opener": server.opener})
    mgr.recover_in_background = False
    mgr.db, mgr.settings = db, settings
    monkeypatch.setattr(live, "MANAGER", mgr)
    yield SimpleNamespace(client=client, db=db, settings=settings, server=server, mgr=mgr, state=state)
    join = wdj.JOIN
    if join is not None:
        try:
            join.session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass


def set_provider(lab: Any, value: str) -> None:
    r = lab.client.patch("/api/v1/settings", json={PROVIDER_KEY: value})
    assert r.status_code == 200, r.text


def audits(lab: Any) -> list[dict[str, Any]]:
    with lab.db.connection(mode="read") as c:
        rows = c.execute("SELECT action, actor_username, decision, details_json FROM audit_log WHERE action LIKE 'wiskey.direct_join.%' ORDER BY id").fetchall()
    return [{"action": r[0], "actor": r[1], "decision": r[2], "details": json.loads(r[3]) if r[3] else None} for r in rows]


def settle(lab: Any, t0: float = 1000.0) -> str:
    """Two reads DEBOUNCE_S apart: the change is applied on the second."""
    lab.mgr.evaluate(now=t0)
    return lab.mgr.evaluate(now=t0 + D + 0.1)


def up(lab: Any) -> wdj.DirectJoin:
    join = wdj.JOIN
    assert join is not None and join.selected()  # the socket authenticates over the fake
    return join


# ================================================================ start / stop at runtime

def test_switching_to_auto_starts_the_join_without_a_restart_and_audits_the_administrator(lab: Any) -> None:
    assert lab.mgr.evaluate(now=0.0, immediate=True, audited=False) == live.OFF_BY_SETTING and wdj.JOIN is None
    set_provider(lab, "auto")
    assert lab.mgr.kicks == 1  # the settings save asked for a re-evaluation (it never starts anything inside the request)
    assert wdj.JOIN is None
    assert lab.mgr.evaluate(now=1000.0) == live.OFF_BY_SETTING and wdj.JOIN is None  # first read: pending (debounce)
    assert live.join_state()["pending"] == {"to": "start", "reason": "ready"}
    assert lab.mgr.evaluate(now=1000.0 + D + 0.1) == live.CONNECTING
    join = up(lab)
    assert lab.mgr.evaluate(now=1010.0) == live.UP
    assert isinstance(lease_events.TRANSPORT, wdj.SelectingLeaseTransport) and wts.TRANSPORT_PROVIDER == join.template_or_none
    assert wl.lineage_path(lab.settings.data_dir).exists()
    rows = audits(lab)
    assert [r["action"] for r in rows] == [live.AUDIT_START]
    assert rows[0]["actor"] == "joni" and rows[0]["details"] == {"trigger": "settings", "result": "installed"}


def test_switching_to_local_stops_the_join_cleanly(lab: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    join = up(lab)
    set_provider(lab, "local")
    assert settle(lab, 2000.0) == live.OFF_BY_SETTING
    assert wdj.JOIN is None
    assert join.session.closing and not join.session.connected  # the socket is closed
    assert join.session.runner._stopped  # noqa: SLF001 - the loop ended (its tasks cancelled)
    assert join.lineage.status == "closed"  # the lineage closed last
    assert isinstance(lease_events.TRANSPORT, lease_events.BridgeLeaseTransport) and wts.TRANSPORT_PROVIDER is None
    assert wdj.people_send(None, SimpleNamespace(user_id="u"), "users/delete", {"user_id": "u", "revision": 1}, targets=[]) is None
    rows = audits(lab)
    assert [r["action"] for r in rows] == [live.AUDIT_START, live.AUDIT_STOP]
    assert rows[1]["actor"] == "joni" and rows[1]["details"]["reason"] == "off_by_setting" and rows[1]["details"]["trigger"] == "settings"


def test_a_quick_flip_back_and_a_transient_read_failure_change_nothing(lab: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    join = up(lab)
    opened = lab.server.opened
    set_provider(lab, "local")
    lab.mgr.evaluate(now=3000.0)  # pending stop
    set_provider(lab, "auto")  # back within the debounce
    lab.mgr.evaluate(now=3000.0 + D + 0.1)
    assert wdj.JOIN is join and lab.mgr._pending is None  # noqa: SLF001 - no stop, no restart
    real = lab.mgr.reader
    lab.mgr.reader = lambda db: (_ for _ in ()).throw(sqlite3.OperationalError("database is locked"))
    lab.mgr.evaluate(now=3100.0)
    lab.mgr.evaluate(now=3100.0 + D + 0.1)
    assert wdj.JOIN is join and lab.mgr.last_error == "state_unreadable:OperationalError"
    lab.mgr.reader = real
    lab.server.refuse_open = True  # the socket drops: a network matter, never a start/stop
    join.session._link = None  # noqa: SLF001
    settle(lab, 3200.0)
    assert wdj.JOIN is join and lab.mgr.state == live.CONNECTING and lab.server.opened == opened
    assert [r["action"] for r in audits(lab)] == [live.AUDIT_START]


def test_a_rotated_key_stops_the_join_and_revokes_capture_leases_first(lab: Any, monkeypatch: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    join = up(lab)
    revoked: list[tuple[str, bool, bool]] = []
    monkeypatch.setattr(capture_lease, "has_live", lambda: True)
    monkeypatch.setattr(capture_lease, "on_authority_change",
                        lambda reason, **kw: revoked.append((reason, kw.get("all", False), wdj.JOIN is join)) or 1)
    monkeypatch.setattr(lease_events.WORKER, "step", lambda: None)
    lab.state["key"] = ROTATED
    live.request_reevaluate("key_rotated")  # the rotation's own caller may ask; the periodic check would find it too
    assert settle(lab, 4000.0) == live.KEY_ROTATED
    assert wdj.JOIN is None and join.session.closing
    assert revoked == [("key_rotation", True, True)]  # while the direct path that granted them was still installed
    st = live.join_state()
    assert st["state"] == live.KEY_ROTATED and st["installed"] is False
    assert st["people_writes"] == {"path": "classic", "reason": "not_installed"}
    row = audits(lab)[-1]
    assert row["action"] == live.AUDIT_STOP and row["actor"] is None and row["details"]["reason"] == "key_rotated"


def test_the_key_missing_then_restored_recovers_with_fresh_nonces_only(lab: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    first = up(lab)
    first.capture_port.call("users/get_thing", {}, timeout_s=2.0)
    lab.state["key"] = None
    assert settle(lab, 5000.0) == live.KEY_MISSING and wdj.JOIN is None
    lab.state["key"] = SECRET  # restored / paired again
    assert settle(lab, 5100.0) == live.CONNECTING
    second = up(lab)
    assert second is not first and lab.server.opened == 2
    second.capture_port.call("users/get_thing", {}, timeout_s=2.0)
    # the fake refuses a reused nonce (`Unauthorized`): every frame of both connections was signed anew and accepted
    assert len(received(lab.server, "users/get_thing")) == 2
    assert live.join_state()["state"] == live.UP and lab.mgr.transitions == 3


def test_a_different_key_while_up_restarts_the_join(lab: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    first = up(lab)
    lab.state["key"] = SECRET + "-repaired"
    settle(lab, 5500.0)
    assert wdj.JOIN is not None and wdj.JOIN is not first and first.session.closing
    assert [r["details"].get("reason") for r in audits(lab)] == [None, "key_changed", None]


def test_no_double_start(lab: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    join = up(lab)
    assert wdj.startup(lab.db, lab.settings, opener=lab.server.opener) is join  # a second startup returns the installed join
    for t in (6000.0, 6000.0 + D + 0.1, 6100.0):
        lab.mgr.evaluate(now=t)
    threads = [threading.Thread(target=lab.mgr.evaluate, kwargs={"now": 6200.0 + i}) for i in range(4)]
    for th in threads:
        th.start()
    for th in threads:
        th.join()
    assert wdj.JOIN is join and lab.server.opened == 1
    assert [r["action"] for r in audits(lab)] == [live.AUDIT_START]


def test_a_failed_start_is_retried_only_after_the_back_off(lab: Any, monkeypatch: Any) -> None:
    calls = {"n": 0}
    real = wdj._startup  # noqa: SLF001

    def flaky(*a: Any, **kw: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 1:
            raise OSError("disk")
        return real(*a, **kw)

    monkeypatch.setattr(wdj, "_startup", flaky)
    set_provider(lab, "auto")
    assert settle(lab, 7000.0) == live.ERROR and lab.mgr.last_error == "start_failed:OSError"
    lab.mgr.evaluate(now=7010.0)
    lab.mgr.evaluate(now=7010.0 + D + 0.1)
    assert calls["n"] == 1  # not in a tight loop
    lab.mgr.evaluate(now=7000.0 + live.JoinManager.RETRY_START_S + 1)
    lab.mgr.evaluate(now=7000.0 + live.JoinManager.RETRY_START_S + D + 2)
    assert calls["n"] == 2 and wdj.JOIN is not None
    assert [r["decision"] for r in audits(lab)] == ["error", "allowed"]


def test_a_join_the_manager_did_not_install_is_never_touched(lab: Any) -> None:
    foreign = SimpleNamespace(origin=None)
    wdj.JOIN = foreign  # type: ignore[assignment]
    settle(lab, 7500.0)  # provider local
    assert wdj.JOIN is foreign
    wdj.JOIN = None


# ================================================================ clean stop: nothing new, in-flight drained, app stop

def test_a_stopping_join_refuses_new_requests_not_sent_and_settles_an_interrupted_one_unknown(lab: Any) -> None:
    set_provider(lab, "auto")
    settle(lab)
    join = up(lab)
    lab.server.script["users/slow"] = "drop"  # the answer never comes
    out: dict[str, Any] = {}

    def slow() -> None:
        try:
            join.capture_port.call("users/slow", {}, timeout_s=30.0)
        except Exception as exc:  # noqa: BLE001
            out["exc"] = exc

    th = threading.Thread(target=slow)
    th.start()
    for _ in range(200):
        if received(lab.server, "users/slow"):
            break
        threading.Event().wait(0.01)
    assert join.session.busy == 1
    assert wdj.shutdown(drain_s=0.2) is False  # the grace ended with the request still running: it is cancelled
    th.join(10)
    assert getattr(out.get("exc"), "outcome", None) == "unknown"  # never a not-sent proof after the frame left
    with pytest.raises(Exception) as late:
        join.capture_port.call("users/other", {}, timeout_s=1.0)
    assert (late.value.outcome, late.value.code) == ("not_sent", wdj.STOPPED_CODE)
    assert len(received(lab.server, "users/slow")) == 1 and received(lab.server, "users/other") == []


def test_app_start_and_stop_with_the_thread(lab: Any) -> None:
    set_provider(lab, "auto")
    lab.mgr.CHECK_EVERY_S = 0.05
    assert lab.mgr.boot(lab.db, lab.settings, thread=True) is not None  # at start: at once, like the old startup
    assert lab.mgr._thread is not None and lab.mgr._thread.is_alive()  # noqa: SLF001
    assert audits(lab) == []  # the add-on start writes no audit row
    join = up(lab)
    lab.mgr.shutdown()
    assert lab.mgr._thread is None and wdj.JOIN is None and join.session.closing and join.lineage.status == "closed"  # noqa: SLF001
    assert audits(lab) == []


# ================================================================ what the features report while stopped / up

def test_features_report_off_while_stopped_and_on_while_up(lab: Any) -> None:
    from smplwise.services import door_engine_live, wiskey_people_csv

    lab.mgr.evaluate(now=0.0, immediate=True, audited=False)
    st = live.join_state()
    assert st["state"] == live.OFF_BY_SETTING and not st["installed"]
    assert all(f == {"available": False, "reason": live.OFF_BY_SETTING} for f in st["features"].values())
    assert st["people_writes"] == {"path": "classic", "reason": "not_installed"}
    assert isinstance(wts.installed_transport(), wts.UnwiredTransport)
    assert wiskey_people_csv.adapters_provider() is None
    assert door_engine_live.LiveEmergencyEngine(lab.db).open_supported is False
    set_provider(lab, "auto")
    settle(lab)
    up(lab)
    st = live.join_state()
    assert st["state"] == live.UP and st["installed"] and st["people_writes"] == {"path": "direct", "reason": None}
    assert st["features"]["feature_host"]["available"] is True
    assert door_engine_live.LiveEmergencyEngine(lab.db).open_supported is True
    assert set(st) >= {"state", "since", "last_error", "pending", "installed", "people_writes", "features"}
    set_provider(lab, "local")
    settle(lab, 9000.0)
    st = live.join_state()
    assert st["state"] == live.OFF_BY_SETTING and not any(f["available"] for f in st["features"].values())
    assert door_engine_live.LiveEmergencyEngine(lab.db).open_supported is False


# ================================================================ people writes: which path, and the safe classic fallback

def _decision() -> nw.ArxDecision:
    return nw.ArxDecision(decision_id=str(uuid.uuid4()), grant_id="grant-1", grant_revision=3, permission_revision=3,
                          decided_at=datetime.now(timezone.utc))


@pytest.fixture()
def writer(tmp_path: Any, monkeypatch: Any) -> Any:
    main = tmp_path / "smplwise.db"
    c = sqlite3.connect(main)
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    c.commit()
    c.close()
    lin = wl.open_lineage(tmp_path, wl.SettingsAnchor(main), holder="holder-live")
    server = JoinServer()
    session = wdj.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: SECRET))
    j = wdj.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True, lineage=lin)
    j.command_port.timeout_s = 1.0
    server.people = FakeWisKey()
    server.people.s["entry"] = "entry-1"
    server.people.seed_user("u-9", revision=3)
    monkeypatch.setattr(wdj, "JOIN", j)
    monkeypatch.setattr(nw, "arx_decision", lambda *a, **k: _decision())
    classic: list[str] = []

    async def fallback(call: Any) -> Any:
        classic.append("sent")
        return {"id": "u-9", "revision": 4, "via": "classic"}

    yield SimpleNamespace(server=server, join=j, lineage=lin, classic=classic, fallback=fallback)
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()
    lin.close()


PRINCIPAL = SimpleNamespace(user_id="arx-user-1", display_name="Operator One", username="op1", source="ingress")


def send_for(w: Any, *, command: str = "users/update", business: dict[str, Any] | None = None, not_after: Any = None,
             create_origin_ref: str | None = None) -> tuple[Any, dict[str, Any]]:
    rec: dict[str, Any] = {}
    business = business or {"user_id": "u-9", "revision": 3, "data": {"display_name": "X"}}
    send = wdj.people_send(None, PRINCIPAL, command, business, targets=[("installation", "*")], fallback=w.fallback,
                           not_after=not_after, record=rec.update, create_origin_ref=create_origin_ref)
    assert send is not None
    return send, rec


def test_a_committed_direct_write_records_the_direct_path(writer: Any) -> None:
    send, rec = send_for(writer)
    assert asyncio.run(send(None)) == {"id": "u-9", "revision": 4}
    assert rec == {"transport": wdj.PATH_DIRECT, "direct_state": "committed", "direct_code": None} and writer.classic == []


def test_a_direct_write_that_was_not_sent_goes_classic_once(writer: Any) -> None:
    send, rec = send_for(writer)
    writer.join.session.begin_close()  # the join started stopping between the selection and the send: nothing handed over
    assert asyncio.run(send(None))["via"] == "classic"
    assert writer.classic == ["sent"] and received(writer.server, "users/update") == []
    assert rec == {"transport": wdj.PATH_CLASSIC_AFTER_DIRECT, "direct_state": "not_sent", "direct_code": wdj.STOPPED_CODE}


def test_a_source_read_failure_goes_classic(writer: Any) -> None:
    writer.server.script["peer_writes/source_v1"] = {"error": "service_grant_required"}
    send, rec = send_for(writer)
    assert asyncio.run(send(None))["via"] == "classic"
    assert rec["transport"] == wdj.PATH_CLASSIC_AFTER_DIRECT and rec["direct_code"] == "source_unavailable:service_grant_required"
    assert received(writer.server, "users/update") == []  # the mutation never left


@pytest.mark.parametrize("script,expected", [
    ({"error": "revision_conflict"}, intercom_client.IntercomError),  # a verified business refusal: visible, never retried classic
    ({"error": "Unauthorized"}, intercom_client.UnclearAnswer),        # a refused signature may follow a commit: unknown
    ("drop", intercom_client.UnclearAnswer),                           # timeout after the write: unknown
])
def test_refusals_and_unknowns_fail_visibly_and_never_go_classic(writer: Any, script: Any, expected: type) -> None:
    writer.server.script["users/update"] = script
    send, rec = send_for(writer)
    with pytest.raises(expected):
        asyncio.run(send(None))
    assert writer.classic == [] and len(received(writer.server, "users/update")) == 1  # sent once, never again on any channel
    assert rec["transport"] == wdj.PATH_DIRECT and rec["direct_state"] in ("refused", "unknown")


def test_an_earlier_native_create_of_the_same_origin_never_goes_classic(writer: Any) -> None:
    business = {"data": {"display_name": "New"}, "sync_now": True}
    send, _rec = send_for(writer, command="users/create", business=business, create_origin_ref="arx-create:c-77")
    asyncio.run(send(None))
    again, rec = send_for(writer, command="users/create", business=business, create_origin_ref="arx-create:c-77")
    with pytest.raises(intercom_sync.NotSent) as exc:
        asyncio.run(again(None))
    assert exc.value.code == "create_origin_already_used" and writer.classic == [] and rec["direct_code"] == "create_origin_already_used"


def test_an_expired_write_is_not_sent_on_the_classic_channel(writer: Any) -> None:
    send, rec = send_for(writer, not_after=datetime.now(timezone.utc) - timedelta(seconds=1))
    writer.join.session.begin_close()
    with pytest.raises(intercom_sync.NotSent) as exc:
        asyncio.run(send(None))
    assert exc.value.code == "expired" and writer.classic == []


def test_an_arx_actor_refusal_is_not_bypassed_by_the_classic_channel(writer: Any) -> None:
    bearer = SimpleNamespace(user_id="arx-user-1", display_name="Script", username="s", source="remote", via="bearer")
    rec: dict[str, Any] = {}
    send = wdj.people_send(None, bearer, "users/update", {"user_id": "u-9", "revision": 3, "data": {}}, targets=[("installation", "*")],
                           fallback=writer.fallback, record=rec.update)
    with pytest.raises(intercom_sync.NotSent) as exc:
        asyncio.run(send(None))
    assert exc.value.code == "actor_session_inactive" and writer.classic == []


@pytest.mark.parametrize("state,code,ok", [
    ("not_sent", "wiskey_direct_not_connected", True), ("not_sent", None, True),
    ("native_error", "source_unavailable:closed", True), ("native_error", "lineage_stale", True), ("native_error", "writer_fenced", True),
    ("native_error", "rbac_denied", False), ("native_error", "actor_session_inactive", False), ("native_error", "invalid_parameters", False),
    ("native_error", "create_origin_already_used", False), ("native_error", "person_write_in_flight", False),
    ("refused", "native_write_action_unsupported", True), ("refused", "revision_conflict", False), ("refused", "invalid_fields", False),
    ("unknown", "timeout", False), ("unknown", "Unauthorized", False), ("committed", None, False),
])
def test_the_fallback_rule(state: str, code: str | None, ok: bool) -> None:
    assert wdj.fallback_permitted(state, code) is ok


def test_the_route_records_the_path_on_every_people_write(writer: Any, monkeypatch: Any) -> None:
    from smplwise.routers import access_control as ac

    act = SimpleNamespace(principal=PRINCIPAL, details={})
    conn = sqlite3.connect(":memory:")

    async def ha(call: Any) -> Any:
        return {"via": "ha"}

    send = ac.people_send(act, conn, "users/update", {"user_id": "u-9", "revision": 3, "data": {}}, ha, stations=None)
    assert act.details["transport"] == wdj.PATH_DIRECT and send is not ha
    writer.join.session.begin_close()
    assert asyncio.run(send(None)) == {"via": "ha"}
    assert act.details["transport"] == wdj.PATH_CLASSIC_AFTER_DIRECT and act.details["direct_state"] == "not_sent"
    act2 = SimpleNamespace(principal=PRINCIPAL, details={})
    assert ac.people_send(act2, conn, "users/update", {"user_id": "u-9", "revision": 3, "data": {}}, ha, stations=None) is ha
    assert act2.details == {"transport": wdj.PATH_CLASSIC, "transport_reason": wdj.STOPPED_CODE}
    monkeypatch.setattr(wdj, "JOIN", None)
    act3 = SimpleNamespace(principal=PRINCIPAL, details={})
    assert ac.people_send(act3, conn, "users/update", {}, ha, stations=None) is ha
    assert act3.details == {"transport": wdj.PATH_CLASSIC, "transport_reason": "not_installed"}
