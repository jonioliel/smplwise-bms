"""EXTERNALBUILD-297 (FAKES ONLY): the external access built to full scope - X1 readiness, X2 graceful write path, X5 service-writer
adapter, the one-time ("single entry") code for vendors and the visitor flow on the same grant engine (CR-VISITOR105).

Nothing here contacts WisKey, Home Assistant, a station, a door, a reader or WhatsApp: the grant engine is
tests/fake_wiskey.FakeAccessEngine, the code transport tests/fake_wiskey.FakeCodeTransport, the event feed a list, the service channel and
the direct join are monkeypatched stand-ins, the clock is injected. Real-device / real-phone checks are NOT_RUN (the owner's live session,
docs/operations/EXTERNAL_ACCESS_LIVE_SESSION_RUNBOOK.md)."""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from conftest import as_user, bind
from test_access_grants import APPROVER, DUE, PHONE, SENTINELS, T0, VF, VU, Env

from smplwise.db import bump_permission_revision, set_setting
from smplwise.services import access_entries, access_readiness, access_service_writer as asw, access_visitors as av
from smplwise.services import access_grants as ag
from smplwise.services import intercom_sync, wiskey_direct_join, wiskey_readback
from smplwise.services.access_grant_engine import EngineError, WiskeyServiceEngine
from tickets_world import API

UTC = timezone.utc
ROOT = Path(__file__).resolve().parents[3]
VISITOR = "972500000077"


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    e.events: list[dict] = []
    monkeypatch.setattr(access_entries, "EVENT_SOURCE", lambda db, since: list(e.events))
    yield e
    ag.reset_for_tests()


def _person(pid: str = "p1", rev: int = 2) -> dict:
    return {"id": pid, "revision": rev, "display_name": "x", "employee_no": "123", "active": False, "assignments": {}, "permission_overrides": {},
            "group_ids": [], "pin_configured": False, "access_category": "contractor"}


class FakeJoin:
    def __init__(self, selected: bool = True) -> None:
        self._sel = selected
        self.session = SimpleNamespace(entry_id="entry-1")

    def selected(self, command=None) -> bool:
        return self._sel


@pytest.fixture()
def channel(monkeypatch):
    """The service channel stand-in: records every people write, answers a person record."""
    calls: list[dict] = []

    def action(settings, key, send, project, who, lane=None, target=None):
        calls.append({"key": key, "who": who, "lane": lane})
        return {"person": _person()}

    monkeypatch.setattr(intercom_sync.SYNC, "action", action)
    monkeypatch.setattr(intercom_sync.SYNC, "write_gate", lambda target: None)
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    yield calls
    asw.reset_for_tests()


# ================================================================ X2: the write path degrades, never refuses


def test_direct_selected_without_a_service_writer_falls_back_to_the_service_channel(monkeypatch, channel):
    monkeypatch.setattr(wiskey_direct_join, "JOIN", FakeJoin(selected=True))
    eng = WiskeyServiceEngine(None)
    person = eng.strip("p1", 1)  # a revoke: never blocked by the connection choice
    assert person.id == "p1" and len(channel) == 1 and channel[0]["who"] == "system:access_grants"
    last = asw.last_path()
    assert last["path"] == "service_channel" and last["reason"] == "direct_service_writer_missing" and last["fallbacks"] == 1
    eng.apply("p1", 2, doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, active=True)
    assert len(channel) == 2, "provisioning writes take the same fallback"


def test_local_provider_writes_on_the_service_channel_as_before(monkeypatch, channel):
    monkeypatch.setattr(wiskey_direct_join, "JOIN", None)
    WiskeyServiceEngine(None).strip("p1", 1)
    assert len(channel) == 1 and asw.last_path()["reason"] == "provider_local"


def test_direct_installed_but_not_selected_is_the_service_channel(monkeypatch, channel):
    monkeypatch.setattr(wiskey_direct_join, "JOIN", FakeJoin(selected=False))
    WiskeyServiceEngine(None).strip("p1", 1)
    assert len(channel) == 1 and asw.last_path()["reason"] == "direct_not_selected"


# ================================================================ X5: the service-writer adapter (fake wire)


def _writer(frames: list, answer=None, raise_exc=None) -> asw.DirectServiceWriter:
    def wire(frame):
        frames.append(json.loads(json.dumps(frame)))  # a copy: the adapter clears the frame after the call
        if raise_exc:
            raise raise_exc
        return answer if answer is not None else {"ok": True, "person": _person()}

    return asw.DirectServiceWriter(selected=lambda c: c == asw.SERVICE_COMMAND, wire=wire, service_actor="arx-service:entry-1", wire_built=lambda: True)


def test_the_service_writer_carries_the_write_and_the_approvers_decision(monkeypatch, channel):
    monkeypatch.setattr(wiskey_direct_join, "JOIN", FakeJoin(selected=True))
    frames: list = []
    asw.install(_writer(frames))
    eng = WiskeyServiceEngine(None)
    with asw.attributed({"id": "g" * 32, "approved_by": "u-approver", "approval_revision": 7}, "provision"):
        eng.apply("p1", 2, doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, active=True, pin="913377")
    assert channel == [], "nothing on the service channel while the service writer is available"
    f = frames[0]
    assert f["contract"] == asw.CONTRACT and f["action"] == "users/update" and f["target"] == {"user_id": "p1", "expected_revision": 2}
    assert f["attribution"] == {"service_actor": "arx-service:entry-1", "decided_by": "arx_rbac", "grant_ref": "g" * 32, "approved_by": "u-approver",
                                "approval_revision": 7, "reason": "provision"}
    assert f["data"]["pin"] == "913377" and f["data"]["door_permissions"] == {"st-a": [1]}
    assert asw.last_path()["path"] == "direct_service_writer"
    eng.create_person(display_name="Visitor ab", category="visitor", responsible_person="host", access_purpose="x")
    assert frames[1]["action"] == "users/create" and frames[1]["target"] == {}


def test_the_live_adapter_is_unavailable_until_the_wire_is_built(monkeypatch, channel):
    assert asw.WIRE_BUILT is False
    live = asw.DirectServiceWriter.from_join(FakeJoin(selected=True))
    assert live.available() is False and asw.writer_for(FakeJoin(selected=True)) is None
    with pytest.raises(EngineError) as exc:
        live.write(asw.ServiceWrite(action="users/update", data={}, person_id="p1", revision=1))
    assert exc.value.kind == "not_sent"


@pytest.mark.parametrize("code,outcome,kind", [("user_not_found", "refused", "not_found"), ("revision_conflict", "refused", "revision_conflict"),
                                               ("pin_conflict", "refused", "pin_conflict"), ("socket_closed", "not_sent", "not_sent"),
                                               ("denied", "refused", "refused"), ("timeout", "unknown", "unknown")])
def test_wire_errors_map_to_the_engines_closed_kinds(code, outcome, kind):
    w = _writer([], raise_exc=asw.ServiceWireError(code, outcome))
    with pytest.raises(EngineError) as exc:
        w.write(asw.ServiceWrite(action="users/update", data={}, person_id="p1", revision=1))
    assert exc.value.kind == kind


def test_a_malformed_service_write_is_never_sent():
    frames: list = []
    w = _writer(frames)
    for op in (asw.ServiceWrite(action="users/archive"), asw.ServiceWrite(action="users/update", person_id=None, revision=1),
               asw.ServiceWrite(action="users/update", person_id="p", revision=0)):
        with pytest.raises(EngineError):
            w.write(op)
    assert frames == []
    assert _writer(frames, answer={"ok": False}).available()
    with pytest.raises(EngineError) as exc:
        _writer(frames, answer={"ok": False}).write(asw.ServiceWrite(action="users/delete", person_id="p", revision=1))
    assert exc.value.kind == "unknown"


# ================================================================ X1: the readiness check


def _lines(body: dict) -> dict:
    return {ln["key"]: ln for ln in body["lines"]}


def test_readiness_is_for_system_administrators_only_and_audited(env):
    bind(env.c, env.settings, "otto", "site_admin", "installation", "*")
    r = env.c.get(f"{API}/access-grants/readiness", headers=as_user("otto"))
    assert r.status_code == 403 and r.json()["code"] in ("forbidden", "not_system_admin")
    assert env.c.get(f"{API}/access-grants/readiness").status_code == 200


def test_readiness_names_every_missing_prerequisite_in_hebrew(env, monkeypatch):
    monkeypatch.setattr(intercom_sync.STATE, "state", "ha_not_configured")
    monkeypatch.setattr(wiskey_readback, "_LAST", None)
    r = env.c.get(f"{API}/access-grants/readiness")
    assert r.status_code == 200, r.text
    body = r.json()
    lines = _lines(body)
    assert body["ready"] is False
    assert lines["switch"]["state"] == "ok"  # the Env turned the switch on
    assert lines["write_path"]["state"] == "blocked" and lines["write_path"]["reason"] == "service_not_configured"
    assert lines["revoke_proof"]["state"] == "blocked" and lines["revoke_proof"]["reason"] == "proof_switch_off"
    assert lines["entrances"]["state"] == "blocked" and lines["entrances"]["count"] == 0
    assert lines["whatsapp"]["state"] in ("blocked", "unknown"), "a WhatsApp account that is not proven is never ok"
    for ln in body["lines"]:
        assert ln["text"] and any("֐" <= ch <= "׿" for ch in ln["text"]), ln
    assert set(body["missing"]) >= {"write_path", "revoke_proof", "entrances"}
    assert body["summary"].startswith("חסרים")


def test_readiness_unknown_is_never_ok(env, monkeypatch):
    monkeypatch.setattr(intercom_sync.STATE, "state", "connecting")
    set_setting_ = lambda k, v: env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", k, v)
    set_setting_("wiskey.acr5_access_state", "on")
    monkeypatch.setattr(wiskey_readback, "_LAST", None)
    lines = _lines(env.c.get(f"{API}/access-grants/readiness").json())
    assert lines["write_path"]["state"] == "unknown" and lines["revoke_proof"]["state"] == "unknown"


def test_readiness_shows_the_fallback_and_a_v2_proof_as_ready(env, monkeypatch):
    monkeypatch.setattr(intercom_sync.STATE, "state", "ready")
    monkeypatch.setattr(wiskey_direct_join, "JOIN", FakeJoin(selected=True))
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES ('wiskey.acr5_access_state', 'on')")
    env.sql("INSERT INTO access_station_entrance(station_id, set_by, set_at) VALUES ('st-a', 'test', '2026-10-20T06:00:00Z')")
    monkeypatch.setattr(wiskey_readback, "_LAST", {"version": 2, "reason": "ok", "at": "2026-10-20T06:00:00Z"})
    monkeypatch.setattr(access_readiness, "whatsapp_line", lambda db: access_readiness._line("whatsapp", "ok", "whatsapp_ok"))
    body = env.c.get(f"{API}/access-grants/readiness").json()
    lines = _lines(body)
    assert lines["write_path"]["state"] == "ok" and lines["write_path"]["reason"] == "direct_fallback" and lines["write_path"]["fallback"] is True
    assert lines["revoke_proof"]["reason"] == "proof_v2" and lines["entrances"]["count"] == 1
    assert body["ready"] is True and body["missing"] == [] and body["summary"] == "הכל מוכן להפעלה."
    monkeypatch.setattr(wiskey_readback, "_LAST", {"version": 1, "reason": "ok", "at": "x"})
    assert _lines(env.c.get(f"{API}/access-grants/readiness").json())["revoke_proof"]["reason"] == "proof_v1"


def test_readiness_cli_over_a_database_file_is_read_only(env):
    db_path = str(env.settings.db_path)
    before = Path(db_path).stat().st_mtime_ns
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "eccact_activation_status.py"), "--readiness", "--db", db_path], capture_output=True,
                         timeout=120, cwd=str(ROOT))
    assert out.returncode == 0, out.stderr.decode("utf-8", "replace")
    body = json.loads(out.stdout.decode("utf-8"))
    lines = _lines(body)
    assert lines["write_path"]["state"] == "unknown" and lines["whatsapp"]["state"] == "unknown" and body["ready"] is False
    assert Path(db_path).stat().st_mtime_ns == before


# ================================================================ the one-time code for vendors


def _single_entry_grant(env, **extra) -> str:
    r = env.request(code_mode="single_entry", **extra)
    assert r.status_code == 200, r.text
    gid = r.json()["grant"]["id"]
    assert env.grant(gid)["code_mode"] == "single_entry"
    a = env.approve(gid)
    assert a.status_code == 200, a.text
    env.run()
    assert env.grant(gid)["state"] == "active"
    return gid


def test_a_one_time_code_ends_the_grant_after_the_first_entry(env):
    gid = _single_entry_grant(env)
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1 and "הקוד לכניסה אחת בלבד." in env.transport.sent[0][1]
    emp = env.person_of(gid)["employee_no"]
    env.clock[0] = datetime(2026, 10, 22, 6, 0, tzinfo=UTC)
    env.events[:] = [
        {"id": "e0", "employee_no": emp, "station_id": "st-a", "result": "granted", "received_at": "2026-10-21T05:00:00Z"},  # before the window
        {"id": "e1", "employee_no": emp, "station_id": "st-z", "result": "granted", "received_at": "2026-10-22T05:10:00Z"},  # not a door of it
        {"id": "e2", "employee_no": "999", "station_id": "st-a", "result": "granted", "received_at": "2026-10-22T05:20:00Z"},  # another person
    ]
    env.run()
    assert env.grant(gid)["state"] == "active" and env.grant(gid)["first_entry_at"] is None
    env.events.append({"id": "e3", "employee_no": emp, "station_id": "st-a", "result": "granted", "received_at": "2026-10-22T05:30:00Z"})
    env.run()
    g = env.grant(gid)
    assert g["first_entry_at"] == "2026-10-22T05:30:00Z" and g["end_reason"] == "ended"
    env.run()
    assert env.grant(gid)["state"] == "ended", "the strip followed with read-back proof"
    person = env.person_of(gid)
    assert person["active"] is False and not person.get("pin")
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'access.grant.single_entry_used' AND resource_id = ?", (gid,)).fetchone()[0] == 1


def test_a_window_code_is_not_watched(env, monkeypatch):
    asked: list = []
    monkeypatch.setattr(access_entries, "EVENT_SOURCE", lambda db, since: asked.append(since) or [])
    gid = env.active_grant()
    env.run()
    assert asked == [] and env.grant(gid)["code_mode"] == "window"


def test_the_approver_may_narrow_to_a_one_time_code_never_widen(env):
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid, code_mode="single_entry").status_code == 200
    assert env.grant(gid)["code_mode"] == "single_entry"
    gid2 = env.request(contact_id=env.tech2, code_mode="single_entry").json()["grant"]["id"]
    r = env.approve(gid2, code_mode="window")
    assert r.status_code == 422 and r.json()["details"]["code"] == "wider_than_requested"
    r = env.request(contact_id=env.tech2, credential="none", code_mode="single_entry")
    assert r.status_code == 422 and r.json()["details"]["code"] == "pin_only"


# ================================================================ visitors (CR-VISITOR105)


def _visitors_on(env) -> None:
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES ('access.visitors', 'on')")
    env.sql("INSERT OR REPLACE INTO access_station_visitor_entrance(station_id, set_by, set_at) VALUES ('st-a', 'test', '2026-10-20T06:00:00Z')")


def _invite(env, user=None, **extra):
    body = {"visitor_name": "דנה", "phone": "+" + VISITOR, "doors": {"st-a": [1]}, "valid_from": VF, "valid_until": VU, "told": True, **extra}
    return env.c.post(f"{API}/access/visitors", json=body, headers=as_user(user) if user else None)


def _confirm(env, invite_id: str) -> None:
    """The visitor's code typed back (the tickets phone-verification path is exercised by its own tests): the contact is confirmed BY CODE."""
    with env.db.connection() as conn:
        inv = av.invite_row(conn, invite_id)
        conn.execute("UPDATE ticket_contacts SET phone_confirmed_at = ?, phone_confirmed_via = 'code' WHERE id = ?", (ag.iso(env.clock[0]), inv["visitor_contact_id"]))
        av.on_confirmed(conn, inv)


def test_visitors_are_off_by_default_and_hidden(env):
    with env.db.connection(mode="read") as conn:
        assert av.settings_view(conn)["visitors"] == "off" and av.enabled(conn) is False
    assert _invite(env).status_code == 404
    assert env.c.get(f"{API}/access/visitors").status_code == 404
    assert env.c.get(f"{API}/access/visitors/settings").json()["visitors"] == "off"


def test_an_invitation_inside_the_envelope_is_approved_by_the_host_and_waits_for_the_number(env):
    _visitors_on(env)
    r = _invite(env)
    assert r.status_code == 200, r.text
    v = r.json()["visitor"]
    assert v["approval_kind"] == "host_envelope" and v["state"] == "approved" and v["confirmed"] is False and v["visitor"]["name"] == "דנה"
    env.run()
    g = env.grant(v["grant_id"])
    assert g["state"] == "active" and g["approved_by"]
    person = env.person_of(v["grant_id"])
    assert person["category"] == "visitor"
    env.clock[0] = DUE
    env.run()
    assert env.transport.sent == [] and env.grant(v["grant_id"])["code_state"] == "pending", "no code before the visitor confirmed his number"
    _confirm(env, v["id"])
    env.run()
    assert len(env.transport.sent) == 1 and env.transport.sent[0][0] == VISITOR
    with env.db.connection(mode="read") as conn:
        assert ag.is_technician(conn, ag.grant_row(conn, v["grant_id"])["subject_id"]) is False
        from smplwise.services.tickets import store_links

        assert all(c["id"] != g["subject_id"] for c in store_links.contacts(conn, include_inactive=True)), "hidden from the tickets directory"


def test_an_invitation_outside_the_envelope_waits_for_a_second_person(env):
    _visitors_on(env)
    r = _invite(env, doors={"st-b": [1]})  # st-b is not a visitor entrance
    assert r.status_code == 200, r.text
    v = r.json()["visitor"]
    assert v["approval_kind"] == "second_person" and v["state"] == "requested"
    r = _invite(env, phone="+972500000078", valid_until="2026-10-24T05:00:00Z")  # longer than 24 hours
    assert r.json()["visitor"]["approval_kind"] == "second_person"


def test_a_host_needs_the_invite_permission_on_every_station(env):
    _visitors_on(env)
    rid = env.role("מזמין מבקרים", ["access.visitor.invite"])
    bind(env.c, env.settings, "host1", rid, "access_control_station", "st-a")
    r = _invite(env, user="host1", doors={"st-a": [1], "st-b": [1]})
    assert r.status_code == 403 and r.json()["details"]["permission"] == "access.visitor.invite"
    r = _invite(env, user="host1")
    assert r.status_code == 200 and r.json()["visitor"]["approval_kind"] == "host_envelope", r.text
    gid = r.json()["visitor"]["grant_id"]
    env.run()
    # the visitor-entrance flag is cleared -> the re-decision withdraws the host's envelope grant (fail closed)
    env.sql("DELETE FROM access_station_visitor_entrance WHERE station_id = 'st-a'")
    with env.db.connection() as conn:
        bump_permission_revision(conn)
    env.run()
    assert env.grant(gid)["state"] in ("revoking", "revoked", "ended")


def test_a_technician_or_staff_number_is_never_a_visitor(env):
    _visitors_on(env)
    r = _invite(env, phone="+" + PHONE)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "technician_number"


def test_a_one_time_visitor_entry_is_logged_told_to_the_host_and_ends_the_grant(env):
    _visitors_on(env)
    v = _invite(env, mode="single_entry").json()["visitor"]
    _confirm(env, v["id"])
    env.run()
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1
    emp = env.person_of(v["grant_id"])["employee_no"]
    env.clock[0] = datetime(2026, 10, 22, 6, 0, tzinfo=UTC)
    ev = {"id": "v1", "employee_no": emp, "station_id": "st-a", "door": 1, "result": "granted", "received_at": "2026-10-22T05:15:00Z"}
    env.events[:] = [ev, dict(ev)]  # a repeated event is recorded once
    env.run()
    env.run()
    with env.db.connection(mode="read") as conn:
        inv = av.invite_row(conn, v["id"])
        assert inv["entries"] == 1 and inv["first_entry_at"] == "2026-10-22T05:15:00Z"
        assert conn.execute("SELECT COUNT(*) FROM access_visitor_entries WHERE invite_id = ?", (v["id"],)).fetchone()[0] == 1
        note = conn.execute("SELECT * FROM notifications WHERE source = 'access.visitor.arrived'").fetchone()
        assert note is not None and "דנה" not in json.dumps(dict(note), ensure_ascii=False) and VISITOR not in json.dumps(dict(note))
    assert env.grant(v["grant_id"])["state"] == "ended"
    with env.db.connection(mode="read") as conn:
        assert av.invite_row(conn, v["id"])["end_reason"] == "single_entry_used"


def test_the_host_cancels_and_an_unconfirmed_visit_expires_and_is_erased(env):
    _visitors_on(env)
    v = _invite(env).json()["visitor"]
    env.run()
    assert env.c.delete(f"{API}/access/visitors/{v['id']}").status_code == 200
    env.run()
    assert env.grant(v["grant_id"])["state"] in ("revoked", "ended")
    with env.db.connection(mode="read") as conn:
        assert av.invite_row(conn, v["id"])["end_reason"] == "host_cancelled"
    v2 = _invite(env, phone="+972500000079").json()["visitor"]
    env.run()
    env.clock[0] = datetime(2026, 10, 22, 15, 0, tzinfo=UTC)  # after the window, never confirmed
    env.run()
    with env.db.connection(mode="read") as conn:
        inv = av.invite_row(conn, v2["id"])
    assert inv["end_reason"] == "expired_unconfirmed" and inv["erase_due_at"]
    env.clock[0] = datetime(2026, 11, 25, 6, 0, tzinfo=UTC)
    env.run()
    with env.db.connection(mode="read") as conn:
        inv = av.invite_row(conn, v2["id"])
        contact = ag.contact_row(conn, inv["visitor_contact_id"])
    assert inv["erased_at"] and contact["erased_at"] and contact["phone_e164"] is None and contact["display_name"] == av.TOMBSTONE


def test_only_the_host_reaches_his_visitors_number_check(env):
    _visitors_on(env)
    v = _invite(env).json()["visitor"]
    bind(env.c, env.settings, "otto", "site_admin", "installation", "*")
    assert env.c.post(f"{API}/access/visitors/{v['id']}/verify/send", headers=as_user("otto")).status_code == 404
    assert env.c.post(f"{API}/access/visitors/{v['id']}/verify/check", json={"code": "123456"}, headers=as_user("otto")).status_code == 404


def test_visitor_audit_rows_carry_no_name_number_or_code(env):
    _visitors_on(env)
    v = _invite(env, mode="single_entry").json()["visitor"]
    _confirm(env, v["id"])
    env.run()
    env.clock[0] = DUE
    env.run()
    with env.db.connection(mode="read") as conn:
        rows = [json.dumps(dict(r), ensure_ascii=False) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'access.%'").fetchall()]
    blob = "\n".join(rows)
    assert "דנה" not in blob and VISITOR not in blob
    assert not any(s in blob for s in SENTINELS)


def test_revoke_all_visitors_needs_the_word(env):
    _visitors_on(env)
    v = _invite(env).json()["visitor"]
    env.run()
    assert env.c.post(f"{API}/access/visitors/revoke-all", json={"confirm": "x"}).status_code == 422
    r = env.c.post(f"{API}/access/visitors/revoke-all", json={"confirm": av.REVOKE_ALL_WORD})
    assert r.status_code == 200 and r.json()["revoked"] == 1
    env.run()
    assert env.grant(v["grant_id"])["state"] in ("revoked", "ended")
