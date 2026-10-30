"""WKCAP-295 (WisKey round 4, items 10-14): capture on the direct transport, the six feature adapters, emergency v2, the template transport hook.
FAKES ONLY: the port is tests/wkcap_fakes.py FakeDirectPort (WisKey's published contracts as data); nothing here ran against a WisKey, HA, a station or a door."""
from __future__ import annotations

import ast
import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from conftest import as_user
from fastapi.testclient import TestClient

import wkcap_fakes as wf
from lease_fixtures import lease_world  # noqa: F401  (fixture)
from wkcap_fakes import FakeDirectPort

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.routers import access_control
from smplwise.services import capture_lease as cl
from smplwise.services import capture_lease_route as clr
from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe
from smplwise.services import lease_events as le
from smplwise.services import wiskey_capture_direct as cd
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_template_direct as td
from smplwise.services.wiskey_capture_port import PortError

SERVICES = Path(__file__).resolve().parents[1] / "smplwise" / "services"
NOW = datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)
LATER = NOW + timedelta(hours=2)


# ================================================================ item 10: capture on the direct transport

def test_capture_events_and_requests_carry_the_original_signed_text_and_nothing_else(lease_world):
    w = lease_world
    port = FakeDirectPort(w.bridge)
    transport = cd.install(port)
    try:
        a = w.issue(actor="dev-a", station="entry-a")
        with w.db.connection(mode="read") as conn:
            signed = le.sign(conn, "capture_status", "dev-a", "dev-a", "entry-a", {"lease_ref": a.lease_ref, "session_id": "s" * 16})
        sent_before = len(port.calls)
        transport.request(None, "capture_status", signed.text)
        assert port.calls[sent_before] == ("capture/lease_request", {"signed_message_json": signed.text})
        assert port.calls[sent_before][1]["signed_message_json"] is signed.text, "the original string, not a re-serialisation"
        inner = json.loads(signed.text)
        assert "kid" not in inner and "authenticated_message_sha256" not in inner and "digest" not in inner
        w.bump()  # a revoke goes out as an EVENT through the same transport
        w.step(0.25)
        events = [p for c, p in port.calls if c == "capture/lease_event"]
        assert events and all(set(p) == {"signed_message_json"} for p in events)
        assert json.loads(events[0]["signed_message_json"])["action"] == "lease_revoke"
        assert w.row(a.lease_ref)["state"] == "revoked" and w.row(a.lease_ref)["ack_result"] == "acknowledged"
    finally:
        cd.uninstall()


def test_a_capture_start_answer_through_the_direct_transport_is_judged_by_the_existing_classifier(lease_world):
    w = lease_world
    transport = cd.DirectLeaseTransport(FakeDirectPort(w.bridge))
    snap = cl.REG.snapshot("dev-a", "entry-a", "u1")
    with w.db.connection(label="t") as conn:
        lease = cl.issue(conn, principal=type("P", (), {"user_id": "dev-a", "username": "dev-a", "display_name": "dev-a", "source": "ingress"})(), station_id="entry-a",
                         reader_id=0, person_id="u1", person_revision=4, binding_revision=None, decision_revision=cl.permission_revision(conn),
                         start_request_id=str(uuid.uuid4()), snap=snap)
    with w.db.connection(mode="read") as conn:
        signed = le.sign(conn, "capture_start", "dev-a", "dev-a", "entry-a", {"lease": lease.lease_object()}, request_id=lease.start_request_id)
    answer = transport.request(None, "capture_start", signed.text)
    kind, data = clr.classify_request(answer, signed.request_id, "capture_start")
    assert kind == "ok" and data["session"]["session_id"]


def test_the_message_is_bounded_and_never_re_encoded(lease_world):
    port = FakeDirectPort(lease_world.bridge)
    t = cd.DirectLeaseTransport(port)
    for bad in ("", "é" * 4097, None, b"x"):
        with pytest.raises(ApiError) as e:
            t.event(None, bad)
        assert e.value.details["outcome"] == "not_sent"
    assert port.calls == []
    with pytest.raises(ValueError):
        t.request(None, "lease_revoke", "{}")  # an event action never goes through the request command
    assert port.calls == []


def test_outcomes_map_to_the_capture_routes_not_sent_rule(lease_world):
    port = FakeDirectPort(lease_world.bridge)
    t = cd.DirectLeaseTransport(port)
    for exc, outcome, in_not_sent in ((PortError("wiskey_direct_not_connected", "not_sent"), "not_sent", True),
                                      (PortError("capture_source_unavailable", "refused"), "not_sent", True),
                                      (PortError("capture_outcome_unknown", "refused"), "unknown", False),
                                      (PortError("timeout", "unknown"), "unknown", False),
                                      (PortError("bad_reply_mac", "unknown"), "unknown", False)):
        port.queue["capture/lease_request"] = [exc]
        with pytest.raises(ApiError) as e:
            t.request(None, "capture_status", "{}")
        assert e.value.details["outcome"] == outcome
        assert (e.value.code in access_control._NOT_SENT_CODES) is in_not_sent, (exc.code, e.value.code)
    port.queue["capture/lease_request"] = [PortError("Unauthorized", "refused")]
    with pytest.raises(ApiError) as e:
        t.request(None, "capture_status", "{}")
    assert e.value.details["outcome"] == "refused" and e.value.code not in access_control._NOT_SENT_CODES


def test_a_lost_answer_is_retried_by_the_workers_own_rule_with_a_new_envelope_never_by_the_transport(lease_world):
    w = lease_world
    port = FakeDirectPort(w.bridge)
    cd.install(port)
    try:
        a = w.issue(actor="dev-a", station="entry-a")
        w.bridge.drop_answer = True
        w.bump()
        w.step(0.25)
        first = [p for c, p in port.calls if c == "capture/lease_event" and json.loads(p["signed_message_json"])["action"] == "lease_revoke"]
        assert len(first) == 1, "one send per worker round: the transport itself never repeats"
        assert w.row(a.lease_ref)["acked_at"] is None
        w.bridge.drop_answer = False
        w.run(3)
        second = [p for c, p in port.calls if c == "capture/lease_event" and json.loads(p["signed_message_json"])["action"] == "lease_revoke"]
        assert len(second) >= 2 and first[0]["signed_message_json"] != second[1]["signed_message_json"], "a NEW envelope (new request id and nonce)"
        assert json.loads(first[0]["signed_message_json"])["params"]["sequence"] == json.loads(second[-1]["signed_message_json"])["params"]["sequence"]
    finally:
        cd.uninstall()


def test_the_capture_caller_is_synchronous_and_adds_no_runtime_data():
    tree = ast.parse((SERVICES / "wiskey_capture_direct.py").read_text(encoding="utf-8"))
    assert not [n for n in ast.walk(tree) if isinstance(n, (ast.AsyncFunctionDef, ast.Await))], "the registrar is synchronous: nothing is awaited"
    src = (SERVICES / "wiskey_capture_direct.py").read_text(encoding="utf-8")
    code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    for forbidden in ("import asyncio", "runtime_data =", "kid_on_wire=True", "hmac."):
        assert forbidden not in code


def test_installing_changes_no_switch_and_uninstall_restores_the_bridge_transport(lease_world):
    before = (cl.GO_LIVE_PERMITTED, cl.MIN_BRIDGE_FOR_CAPTURE_LEASE)
    t = cd.install(FakeDirectPort(lease_world.bridge))
    assert le.TRANSPORT is t
    cd.uninstall()
    assert isinstance(le.TRANSPORT, le.BridgeLeaseTransport)
    assert (cl.GO_LIVE_PERMITTED, cl.MIN_BRIDGE_FOR_CAPTURE_LEASE) == before


def test_the_lease_actions_of_the_request_command_are_the_four_capture_requests():
    assert cd.EVENT_COMMAND == "capture/lease_event" and cd.REQUEST_COMMAND == "capture/lease_request"
    assert set(cl.LEASE_ACTIONS) == {"capture_start", "capture_status", "capture_confirm", "capture_cancel"}
    assert {"lease_revoke", "lease_heartbeat", "lease_stream_reset"} == set(le.EVENT_ACTIONS)


# ================================================================ fixtures for items 11-12

class Env:
    def __init__(self, settings) -> None:
        self.settings = settings
        self.c = TestClient(create_app(settings))
        self.c.get("/api/v1/me")
        self.db = Database(settings.db_path)

    def principal(self, username: str) -> Principal:
        self.c.get("/api/v1/me", headers=as_user(username))
        with self.db.connection(mode="read") as conn:
            row = conn.execute("SELECT id, username, display_name FROM users WHERE username=?", (username,)).fetchone()
        return Principal(user_id=row["id"], username=row["username"], display_name=row["display_name"] or "", source="test")


@pytest.fixture()
def env(settings):
    e = Env(settings)
    admin = e.principal("joni")
    with e.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=2, confirmed_by=admin.user_id, expected_revision=0)
    e.admin = admin
    return e


def adapters(port):
    client = fd.DirectFeatureClient(port)
    return fd.FeatureAdapters(client, port)


def prep(env, port, feature, *, actor=None, principals=None, params=None, rows=(), private=None, now=NOW, **kw):
    base = {
        "door_windows": {"station_id": "st-a", "relay": 1, "mapping_revision": 1, "start": NOW.isoformat(), "end": LATER.isoformat(), "timezone": "Asia/Jerusalem"},
        "emergency_buttons": {"station_id": "st-a", "relay": 1, "mapping_revision": 1, "policy_ref": "pol-1"},
        "door_automations": {"station_id": "st-a", "relay": 1, "mapping_revision": 1, "automation_ref": "auto-1", "expiry": LATER.isoformat()},
        "people_csv": {"preview_ref": "prev-1", "ownership_policy_ref": "own-1", "revision_policy_ref": "rev-1"},
        "live_media": {"station_id": "st-a", "direction": "video_only", "consent_ref": "con-1", "expiry": LATER.isoformat()},
        "live_validation": {"checklist_ref": "chk-1", "owner_go_ref": "go-1", "expiry": LATER.isoformat()},
    }[feature]
    if actor is None:
        actor = (fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=env.admin.user_id, approver_user_id=env.admin.user_id, grant_revision=5)
                 if feature == "door_automations" else fx.human_actor(env.admin.user_id))
    extra = dict(kw)
    if feature in ("emergency_buttons", "people_csv"):
        extra.setdefault("execution_expires_at", now + timedelta(hours=1))
    targets = [("st-a", 1)] if feature == "live_media" else None
    ad = adapters(port)
    with env.db.connection() as conn:
        body, snap = ad.prepare(conn, feature=feature, actor=actor, principals=principals or [env.admin], authority_ref="auth-1", authority_revision=5, scope_ref="scope-1",
                                parameter_reference="pref-1", params=params or base, now=now, source_epoch="epoch-5", actor_session_active=True, targets=targets,
                                rows=rows, private_input=private, **extra)
    return ad, body, snap


ROW = fd.RowGrantInput(source_line=1, user_id="user-9", revision=3, origin_ref="origin-1", change_digest="digest-1")


# ================================================================ item 11: the six adapters

@pytest.mark.parametrize("feature", fx.FEATURES)
def test_every_feature_builds_the_closed_request_and_snapshot_and_is_admitted(env, feature):
    port = FakeDirectPort()
    rows = (ROW,) if feature == "people_csv" else ()
    private = {"kind": ed.KIND_V2, "event_ref": "e-1", "command": "hold_open", "trigger": "manual", "retry_of": None} if feature == "emergency_buttons" else None
    ad, body, snap = prep(env, port, feature, rows=rows, private=private)
    assert set(snap) == wf.SNAPSHOT_FIELDS and snap["complete"] is True and snap["active"] is True and snap["private_input"] == private
    assert snap["bridge_owner"] == {"entry_id": wf.IDENTITY.entry_id, "query_owner_id": wf.IDENTITY.query_owner_id} and snap["repository_id"] == wf.REPO
    assert [snap[k] for k in ("authority_ref", "authority_revision", "scope_ref", "actor")] == [body[k] for k in ("authority_ref", "authority_revision", "scope_ref", "actor")]
    expires, end = (datetime.fromisoformat(v.replace("Z", "+00:00")) for v in (snap["expires_at"], body["execution_expires_at"]))
    assert end <= expires and expires - datetime.fromisoformat(snap["issued_at"].replace("Z", "+00:00")) <= timedelta(hours=24)
    assert set(snap["grant_ids"]) == {s["grant_id"] for s in snap["stations"]} | {r["grant_id"] for r in snap["rows"]}
    with env.db.connection() as conn:
        if feature == "live_media":
            prep_ = ad.prepare_media(conn, body, snap)
            assert prep_.steps and port.sent("features/prepare_media")
        else:
            out = ad.start(conn, body, snap)
            assert out.state == "admitted" and out.operation_ref and port.sent("features/start")
        assert fx.intent_state(conn, body["request_id"]) == "sent"


def test_an_incomplete_or_empty_policy_stops_before_anything_is_stored_or_sent(env, settings):
    port = FakeDirectPort()
    plain = env.principal("plain")
    with pytest.raises(fd.FeatureWireError) as e:
        prep(env, port, "door_windows", actor=fx.human_actor(plain.user_id), principals=[plain])  # W031-295: the actor is the judged principal
    assert e.value.code == "policy_incomplete" and e.value.outcome == "not_sent"
    with env.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-zzz", api_relay=2, physical_relay=1, confirmed_by=env.admin.user_id, expected_revision=0, active=False)
    with pytest.raises(fd.FeatureWireError):
        prep(env, port, "door_windows", params={"station_id": "st-zzz", "relay": 2, "mapping_revision": 1, "start": NOW.isoformat(), "end": LATER.isoformat(), "timezone": "UTC"})
    assert port.calls == []
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_feature_intents").fetchone()[0] == 0


def test_actor_kinds_per_feature(env):
    port = FakeDirectPort()
    auto = fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=env.admin.user_id, approver_user_id=env.admin.user_id, grant_revision=5)
    for feature in ("door_windows", "people_csv", "live_media", "live_validation"):
        with pytest.raises(fd.FeatureWireError):
            prep(env, port, feature, actor=auto, rows=(ROW,) if feature == "people_csv" else ())
    with pytest.raises(fd.FeatureWireError):
        prep(env, port, "door_automations", actor=fx.human_actor(env.admin.user_id))
    prep(env, port, "emergency_buttons", actor=auto, private={"kind": ed.KIND_V2, "event_ref": "e1", "command": "hold_open", "trigger": "fire", "retry_of": None})
    with pytest.raises(fd.FeatureWireError):
        prep(env, port, "people_csv")  # no row grants: Arx has no source for them, nothing is invented


def test_the_intent_is_committed_before_the_command_leaves_and_never_admitted_twice(env, settings):
    port = FakeDirectPort()
    seen = {}

    def peek(command, params):
        other = sqlite3.connect(settings.db_path)
        try:
            seen[command] = other.execute("SELECT state FROM wiskey_feature_intents WHERE request_id=?", (params["request"]["request_id"],)).fetchone()
        finally:
            other.close()

    port.on_call = peek
    ad, body, snap = prep(env, port, "live_validation")
    with env.db.connection() as conn:
        assert ad.start(conn, body, snap).state == "admitted"
    assert seen["features/start"] == ("sent",), "another connection already saw the committed intent"
    with env.db.connection() as conn, pytest.raises(fx.FeatureError) as e:
        ad.start(conn, body, snap)
    assert e.value.code == "duplicate" and len(port.sent("features/start")) == 1, "a request id is never sent twice"


def test_unknown_and_refused_and_not_sent_are_settled_honestly_and_never_resent(env):
    port = FakeDirectPort()
    results = {}
    for mode, expect_state, expect_start in (("ack_loss", "unknown", "unknown"), ("refuse:binding_denied", "refused", "refused"), ("not_sent", "refused", "not_sent")):
        port.start_script = [mode]
        ad, body, snap = prep(env, port, "live_validation", request_id=str(uuid.uuid4()))
        with env.db.connection() as conn:
            out = ad.start(conn, body, snap)
            results[mode] = (out.state, fx.intent_state(conn, body["request_id"]))
    assert results == {"ack_loss": ("unknown", "unknown"), "refuse:binding_denied": ("refused", "refused"), "not_sent": ("not_sent", "refused")}
    assert len(port.sent("features/start")) == 3, "one send per request: an UNKNOWN is not an instruction to send again"


def test_a_completion_read_is_a_fresh_command_with_only_the_operation_ref_and_renews_nothing(env):
    port = FakeDirectPort()
    ad, body, snap = prep(env, port, "door_windows")
    with env.db.connection() as conn:
        out = ad.start(conn, body, snap)
    calls_before = len(port.calls)
    res = ad.client.result(out.operation_ref)  # long after the window's end: the execution lease is over, the read still works
    assert port.calls[calls_before:] == [("features/result", {"operation_ref": out.operation_ref})], "no request, no snapshot, no renewed permission"
    assert res.state == "finished" and res.physical_confirmed is False and res.replay_available is False
    assert [c for c, _ in port.calls].count("features/start") == 1
    with env.db.connection(mode="read") as conn:
        row = conn.execute("SELECT execution_expires_at, request_expires_at, state FROM wiskey_feature_intents WHERE request_id=?", (body["request_id"],)).fetchone()
    assert row["execution_expires_at"] == body["execution_expires_at"] and row["state"] == "sent", "the read touched neither the deadline nor the intent"


def test_a_refused_completion_read_proves_nothing_and_settles_nothing(env):
    port = FakeDirectPort()
    ad, body, snap = prep(env, port, "door_windows")
    with env.db.connection() as conn:
        out = ad.start(conn, body, snap)
    for mode, outcome in (("refused", "refused"), ("lost", "unknown")):
        port.result_mode = mode
        with pytest.raises(fd.FeatureWireError) as e:
            ad.client.result(out.operation_ref)
        assert e.value.outcome == outcome
    with env.db.connection(mode="read") as conn:
        assert fx.intent_state(conn, body["request_id"]) == "sent"
    port.result_mode = "finished"
    port.queue["features/result"] = [{"schema_version": 1, "operation_ref": "someone-else", "state": "running"}]
    with pytest.raises(fd.FeatureWireError):
        ad.client.result(out.operation_ref)  # another operation's answer is not this one's


def test_cancel_cleanup_joined_is_not_proof_of_no_effect(env):
    port = FakeDirectPort()
    ad, body, snap = prep(env, port, "door_windows")
    with env.db.connection() as conn:
        out = ad.start(conn, body, snap)
    c = ad.client.cancel(out.operation_ref)
    assert c.cleanup_joined is True and c.no_effect is False
    port.queue["features/cancel"] = [{"schema_version": 1, "operation_ref": out.operation_ref, "state": "no_effect", "replay_available": False}]
    with pytest.raises(fd.FeatureWireError):
        ad.client.cancel(out.operation_ref)


def test_direct_media_is_authenticated_by_the_bridge_header_on_the_same_connection_and_a_ticket_is_used_once(env):
    port = FakeDirectPort()
    ad, body, snap = prep(env, port, "live_media")
    with env.db.connection() as conn:
        mp = ad.prepare_media(conn, body, snap)
    step = mp.steps[0]
    assert step.path == "/api/hikvision_intercom/arx_bridge/v1/media/" + step.ticket and "?" not in step.path
    sock = ad.client.open_media(mp, "video-1")
    assert sock == "media-socket"
    path, headers = port.opened[0]
    assert path == step.path and set(headers) == {"X-WisKey-Bridge"} and port.headers_signed == [(step.ticket, mp.preparation_ref)]
    assert "Authorization" not in headers
    with pytest.raises(fd.FeatureWireError) as e:
        ad.client.open_media(mp, "video-1")
    assert e.value.code == "ticket_consumed" and len(port.opened) == 1
    with pytest.raises(fd.FeatureWireError):
        ad.client.media_ingress_request(mp, "nope")


@pytest.mark.parametrize("url", ["/api/hikvision_intercom/features/media/" + "ab" * 24, "/api/hikvision_intercom/arx_bridge/v1/media/" + "ab" * 24 + "?token=1",
                                 "https://x/api/hikvision_intercom/arx_bridge/v1/media/" + "ab" * 24, "/api/hikvision_intercom/arx_bridge/v1/media/", 7])
def test_a_media_url_that_is_not_the_direct_ticket_path_is_refused(url):
    raw = {"schema_version": 1, "state": "prepared", "preparation_ref": "p", "operation_ref": None, "expires_at": "2026-10-24T12:00:30Z",
           "ingress": [{"step_id": "s", "url": url}], "replay_available": False}
    with pytest.raises(fd.FeatureWireError):
        fd.read_media(raw)


def test_status_and_closed_readers_reject_anything_off_contract(env):
    port = FakeDirectPort()
    assert fd.DirectFeatureClient(port).status()["schema_version"] == 1
    assert fd.read_start_ack({"schema_version": 1, "operation_ref": "o", "state": "admitted", "execution_result": "pending", "replay_available": False}) == "o"
    for bad in ({"schema_version": 1, "operation_ref": "o", "state": "admitted", "execution_result": "pending", "replay_available": True},
                {"schema_version": 1, "operation_ref": "o", "state": "admitted"}, {"schema_version": True, "operation_ref": "o", "state": "admitted",
                                                                                  "execution_result": "pending", "replay_available": False}, "x"):
        with pytest.raises(fd.FeatureWireError):
            fd.read_start_ack(bad)


# ================================================================ item 12: emergency v2

MANUAL = lambda env: ed.EmergencyContext(fx.human_actor(env.admin.user_id), (env.admin,), "arx-permissions", 5, "manual", True)  # noqa: E731


def engine_for(env, port, context=None):
    clock = {"t": NOW}
    ad = adapters(port)
    eng = ed.DirectEmergencyEngine(ad, lambda: env.db.connection(), context or (lambda conn, rid: MANUAL(env)), clock=lambda: clock["t"], sleep=lambda s: None, polls=2)
    eng.clock_box = clock
    return eng


def intents(env):
    with env.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM wiskey_feature_intents WHERE feature='emergency_buttons' ORDER BY rowid").fetchall()]


def starts(port):
    return port.sent("features/start")


def test_initial_hold_sends_the_closed_v2_input_with_retry_of_null(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    out = eng.apply("open", "st-a", 1, "req-1:st-a:1", "reason")
    assert out == dwe.DoorOutcome("acknowledged", "acknowledged")
    (sent,) = starts(port)
    private = sent["policy_snapshot"]["private_input"]
    assert set(private) == wf.EMERGENCY_V2_FIELDS and private["kind"] == "wiskey-emergency-event.v2"
    assert (private["command"], private["trigger"], private["retry_of"]) == ("hold_open", "manual", None)
    assert private["event_ref"] == ed.event_ref_of("req-1:st-a:1")
    assert sent["request"]["feature"] == "emergency_buttons" and sent["request"]["actor"] == {"kind": "human", "user_id": env.admin.user_id}
    assert {"door/emergency_open", "door/hold_open", "door/restore"} <= set(sent["policy_snapshot"]["permissions"])


def test_a_new_open_attempt_after_unknown_has_a_new_request_and_operation_and_never_touches_the_old_one(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    port.start_script = ["ack_loss"]
    first = eng.apply("open", "st-a", 1, "req-1:st-a:1", "")
    assert first.state == "unknown"
    old = intents(env)[0]
    assert old["state"] == "unknown"
    second = eng.apply("open", "st-a", 1, "req-1:st-a:1", "")
    assert second.state == "acknowledged"
    rows = intents(env)
    assert len(rows) == 2 and rows[0] == old, "the old row is retained byte for byte"
    assert rows[1]["request_id"] != old["request_id"] and rows[1]["operation_id"] != old["operation_id"]
    assert starts(port)[1]["policy_snapshot"]["private_input"]["retry_of"] == old["operation_id"]
    assert starts(port)[1]["request"]["operation_id"] == rows[1]["operation_id"]
    assert starts(port)[0]["policy_snapshot"]["private_input"]["event_ref"] == starts(port)[1]["policy_snapshot"]["private_input"]["event_ref"], "same event, same fence"
    # a settled ACK is a duplicate: no third send
    assert eng.apply("open", "st-a", 1, "req-1:st-a:1", "").state == "acknowledged" and len(starts(port)) == 2


def test_a_live_attempt_is_never_retried(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    port.result_mode = "running"
    out = eng.apply("open", "st-a", 1, "req-1:st-a:1", "")
    assert out == dwe.DoorOutcome("unknown", "running")
    assert intents(env)[0]["state"] == "sent"
    again = eng.apply("open", "st-a", 1, "req-1:st-a:1", "")
    assert again == dwe.DoorOutcome("unknown", "attempt_live") and len(starts(port)) == 1
    port.result_mode = "finished"  # it completes at the host: the next call settles it instead of sending anything
    assert eng.apply("open", "st-a", 1, "req-1:st-a:1", "").state == "acknowledged" and len(starts(port)) == 1


def test_legacy_fake_retry_parent_live_is_not_a_current_native_no_effect_proof(env):
    # This fake-only code is not emitted by current Native. The original test
    # expected every verified error to prove pre-effect refusal. Preserve that
    # source and FAIL in the receipt; current adapter must remain conservative.
    port = FakeDirectPort()
    eng = engine_for(env, port)
    port.start_script = ["timeout"]
    assert eng.apply("open", "st-a", 1, "req-1:st-a:1", "").state == "unknown"
    out = eng.apply("open", "st-a", 1, "req-1:st-a:1", "")
    assert out == dwe.DoorOutcome("unknown", "retry_parent_live")
    rows = intents(env)
    assert [r["state"] for r in rows] == ["unknown", "unknown"]
    assert rows[1]["code"] == "retry_parent_live"
    # No manufactured not-sent proof or third OPEN. Matching recovery RELEASE
    # remains an explicit separate action and keeps both original UNKNOWNs.
    assert eng.release("open", "st-a", 1, "req-1:r:st-a:1").state == "acknowledged"
    assert [r["state"] for r in intents(env)][:2] == ["unknown", "unknown"]


def test_a_durable_release_wins_over_an_old_apply_and_a_retry(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    port.start_script = ["ack_loss"]
    assert eng.apply("open", "st-a", 1, "req-1:st-a:1", "").state == "unknown"
    rel = eng.release("open", "st-a", 1, "req-1:r:st-a:1")
    assert rel.state == "acknowledged"
    release_input = starts(port)[1]["policy_snapshot"]["private_input"]
    assert (release_input["command"], release_input["retry_of"], release_input["event_ref"]) == ("release", None, ed.event_ref_of("req-1:st-a:1"))
    assert {"door/emergency_release", "door/restore"} <= set(starts(port)[1]["policy_snapshot"]["permissions"])
    late = eng.apply("open", "st-a", 1, "req-1:st-a:1", "")
    assert late == dwe.DoorOutcome("refused", "superseded_by_release") and len(starts(port)) == 2, "nothing was sent for the late retry"
    assert eng.release("open", "st-a", 1, "req-1:r:st-a:1").state == "acknowledged" and len(starts(port)) == 2, "a settled release is a duplicate"


def test_release_without_a_hold_on_record_is_refused_and_lock_is_not_an_alias(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    assert eng.release("open", "st-a", 1, "x:r:st-a:1") == dwe.DoorOutcome("refused", "no_hold_record")
    for call in (lambda: eng.apply("lock_secure", "st-a", 1, "r:st-a:1", ""), lambda: eng.release("lock_secure", "st-a", 1, "r:r:st-a:1")):
        with pytest.raises(dwe.EngineError) as e:
            call()
        assert e.value.kind == "not_implemented"
    assert port.calls == []
    assert eng.open_supported is True and eng.simulated is False and eng.transport_timeout_s < de.ENGINE_DEADLINE_S


def test_fire_needs_the_original_automation_actor_and_both_principals_permissions(env):
    port = FakeDirectPort()
    other = env.principal("plain")
    auto = fx.automation_actor(automation_id="fire-auto", run_id="run-7", trigger_id="trig-3", creator_user_id=env.admin.user_id, approver_user_id=other.user_id, grant_revision=5)
    with pytest.raises(fd.FeatureWireError):
        ed.EmergencyContext(auto, (env.admin, other), "arx-permissions", 5, "manual", False)  # an automation actor cannot be a manual trigger
    with pytest.raises(fd.FeatureWireError):
        ed.EmergencyContext(fx.human_actor(env.admin.user_id), (env.admin,), "arx-permissions", 5, "fire", True)  # a human cannot be a fire trigger
    eng = engine_for(env, port, lambda conn, rid: ed.EmergencyContext(auto, (env.admin, other), "arx-permissions", 5, "fire", False))
    out = eng.apply("open", "st-a", 1, "fire-1:st-a:1", "")
    assert out.state == "refused" and starts(port) == [], "the approver lacks the permissions: nothing is sent"
    good = fx.automation_actor(automation_id="fire-auto", run_id="run-7", trigger_id="trig-3", creator_user_id=env.admin.user_id, approver_user_id=env.admin.user_id, grant_revision=5)
    eng = engine_for(env, port, lambda conn, rid: ed.EmergencyContext(good, (env.admin, env.admin), "arx-permissions", 5, "fire", False))
    assert eng.apply("open", "st-a", 1, "fire-2:st-a:1", "").state == "acknowledged"
    (sent,) = starts(port)
    assert sent["request"]["actor"] == good and sent["policy_snapshot"]["actor"] == good, "the original lineage, no substituted user"
    assert sent["policy_snapshot"]["private_input"]["trigger"] == "fire" and sent["policy_snapshot"]["actor_session_active"] is False


def test_no_relay_map_no_attempt(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    assert eng.apply("open", "st-nomap", 1, "req-9:st-nomap:1", "") == dwe.DoorOutcome("refused", "relay_map_missing")
    assert port.calls == [] and intents(env) == []


def test_receipt_outcomes_map_without_inventing_success(env):
    for outcome, state in (("denied", "refused"), ("superseded", "refused"), ("unknown", "unknown")):
        port = FakeDirectPort()
        port.result_outcome = outcome
        eng = engine_for(env, port)
        out = eng.apply("open", "st-a", 1, f"req-{outcome}:st-a:1", "")
        assert out.state == state, outcome
    port = FakeDirectPort()
    port.queue["features/result"] = [{"schema_version": 1, "operation_ref": "op-1", "state": "finished", "replay_available": False,
                                      "receipt": {"kind": "wiskey-emergency-event.v2", "event_ref": "other", "command": "hold_open", "targets": []}}]
    port.start_script = []
    eng = engine_for(env, port)
    assert eng.apply("open", "st-a", 1, "req-off:st-a:1", "").state == "unknown", "a receipt of another event is not this event's success"


def test_the_door_emergency_dispatcher_and_its_constants_are_not_changed_by_this_branch(env):
    assert de.DW09_OPEN_RETRY_AFTER_UNKNOWN is False and dwe.LIVE_ENGINE_BUILT is False
    port = FakeDirectPort()
    eng = engine_for(env, port)
    saved = dwe.EMERGENCY_ENGINE_FACTORY
    try:
        ed.install(eng)
        assert dwe.emergency_engine(None) is eng
    finally:
        dwe.EMERGENCY_ENGINE_FACTORY = saved


def test_incident_context_resolves_only_a_person_incident(env):
    with env.db.connection() as conn:
        conn.execute("INSERT INTO door_emergency_incidents(id, kind, scope_type, scope_id, state, actor_kind, requested_by, requested_at, request_id, doors_total) "
                     "VALUES ('i1','open','installation','x','applying','person',?, '2026-10-24T12:00:00Z','client-1',1)", (env.admin.user_id,))
        conn.execute("INSERT INTO door_emergency_incidents(id, kind, scope_type, scope_id, state, actor_kind, requested_by, requested_at, request_id, doors_total) "
                     "VALUES ('i2','open','installation','x','applying','automation',?, '2026-10-24T12:00:00Z','client-2',1)", (env.admin.user_id,))
        ctx = ed.incident_context(conn, "client-1:st-a:1")
        assert ctx.actor == {"kind": "human", "user_id": env.admin.user_id} and ctx.trigger == "manual" and ctx.principals[0].user_id == env.admin.user_id
        for rid in ("client-2:st-a:1", "unknown:st-a:1"):
            with pytest.raises(fd.FeatureWireError):
                ed.incident_context(conn, rid)


# ================================================================ items 13-14: the template transport hook

def test_the_template_hook_sends_the_closed_object_unchanged_and_returns_the_answer_as_it_came():
    from smplwise.services import wa_template_send as wts

    port = FakeDirectPort()
    closed = {"schema_version": 1, "state": "accepted", "code": "provider_accepted", "provider_accepted": True, "delivery": "unknown", "retry_permitted": False}
    port.queue["whatsapp/template_send_v1"] = [closed]
    req = wts.TemplateRequest(request_id="r1", account="acc", person_id="person-1", template_name="visitor_code", language="he", params=("a", "b"), operation_id="op-1")
    raw = td.DirectTemplateTransport(port).send_template(req)
    assert raw is closed and port.calls == [("whatsapp/template_send_v1", req.wire())]
    assert wts.read_answer(raw).state == "accepted"
    for exc in (PortError("timeout", "unknown"), PortError("source_or_admission_refused", "refused"), PortError("wiskey_direct_not_connected", "not_sent")):
        port.queue["whatsapp/template_send_v1"] = [exc]
        with pytest.raises(PortError):
            td.DirectTemplateTransport(port).send_template(req)  # the sender maps a raise to UNKNOWN: never not_sent, never a retry, never a refund


def test_template_v2_passes_only_the_closed_object():
    port = FakeDirectPort()
    port.queue["whatsapp/template_send_v2"] = [{"schema_version": 2}]
    v2 = {"schema_version": 2, "request_id": "r", "operation_id": "o", "recipient_ref": "p", "expected_person_revision": 3, "account": "a", "template_name": "pin_code",
          "language": "he", "template_ref": "t", "expected_template_revision": 1}
    assert td.DirectTemplateTransport(port).send_v2(v2) == {"schema_version": 2}
    assert port.calls == [("whatsapp/template_send_v2", v2)]
    for bad in ({**v2, "pin": "1234"}, {k: v for k, v in v2.items() if k != "template_ref"}, {**v2, "schema_version": 1}):
        with pytest.raises(ValueError):
            td.DirectTemplateTransport(port).send_v2(bad)
    assert len(port.calls) == 1


def test_no_replacement_whatsapp_queue_provider_or_consent_exists_in_this_branch():
    text = "\n".join((SERVICES / f).read_text(encoding="utf-8") for f in ("wiskey_template_direct.py", "wiskey_feature_direct.py", "wiskey_emergency_direct.py",
                                                                        "wiskey_capture_direct.py", "wiskey_capture_port.py"))
    for name in ("class PacingQueue", "class CloudTemplateProvider", "class ApprovedTextTemplate", "class HostPacingPort", "class NativePinDeliveryPolicy", "consent=True",
                 "recipient_consent"):
        assert name not in text
