"""ECCACT-295 stage 3 (FAKES ONLY): the Arx half of wiskey-arx-feature-execution.v1 - request builder, current policy from Arx RBAC and the
relay map, the durable no-replay attempt, the honest status. The WisKey contract constants are compared with a fixture extracted from
the Mac delivery (tests/fixtures/wiskey_feature_exec/mac_contract_f66bf67b.json, read as data). Nothing is sent anywhere."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_peer as wp

HERE = Path(__file__).resolve().parent
MAC = json.loads((HERE / "fixtures" / "wiskey_feature_exec" / "mac_contract_f66bf67b.json").read_text(encoding="utf-8"))
MIG = HERE.parent / "smplwise" / "migrations" / "0145_wiskey_peer_intents_feature_registry.sql"
NOW = datetime(2026, 10, 21, 12, 0, 0, tzinfo=timezone.utc)
REPO = "11111111-2222-4333-8444-555555555555"
PEER = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=3, repository_id=REPO, query_owner_id="a" * 32)
RID = "aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb"
LATER = (NOW + timedelta(hours=2)).isoformat()


# ---------------------------------------------------------------- the contract mirrors the Mac source

def test_the_constants_equal_the_wiskey_source():
    assert fx.CONTRACT == MAC["contract"] and fx.FEATURE_FIELDS == set(MAC["feature_fields"])
    assert {k: list(v) for k, v in fx.REQUIREMENTS.items()} == MAC["requirements"]
    assert fx.AUTOMATION_ACTOR_FIELDS == set(MAC["automation_actor_fields"])
    offered = {p for perms in fx.PERMISSIONS_OF_FEATURE.values() for p in perms}
    assert offered <= set(MAC["permissions"])
    assert set(MAC["permissions"]) <= set(fx.ARX_PERMISSION_OF), "every permission WisKey can require has an Arx mapping"


# ---------------------------------------------------------------- the request builder

def params(feature: str, **over):
    base = {
        "door_windows": {"station_id": "st-a", "relay": 1, "mapping_revision": 2, "start": NOW.isoformat(), "end": LATER, "timezone": "Asia/Jerusalem"},
        "emergency_buttons": {"station_id": "st-a", "relay": 1, "mapping_revision": 2, "policy_ref": "pol-1"},
        "door_automations": {"station_id": "st-a", "relay": 1, "mapping_revision": 2, "automation_ref": "auto-1", "expiry": LATER},
        "people_csv": {"preview_ref": "prev-1", "ownership_policy_ref": "own-1", "revision_policy_ref": "rev-1"},
        "live_media": {"station_id": "st-a", "direction": "video_only", "consent_ref": "con-1", "expiry": LATER},
        "live_validation": {"checklist_ref": "chk-1", "owner_go_ref": "go-1", "expiry": LATER},
    }[feature]
    base.update(over)
    return base


def build(feature: str, **over):
    kw = dict(feature=feature, actor=fx.human_actor("user-1"), authority_ref="auth-1", authority_revision=5, scope_ref="scope-1",
              parameter_reference="pref-1", params=params(feature), now=NOW, request_id=RID)
    if feature == "door_automations":
        kw["actor"] = fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id="u1", approver_user_id="u2", grant_revision=5)
    if feature in ("emergency_buttons", "people_csv"):
        kw["execution_expires_at"] = NOW + timedelta(hours=1)
    kw.update(over)
    return fx.build_request(**kw)


@pytest.mark.parametrize("feature", fx.FEATURES)
def test_every_feature_builds_the_exact_closed_body(feature):
    body = build(feature)
    assert set(body) == set(MAC["feature_fields"]) and body["contract_version"] == fx.CONTRACT
    issued, expires = (datetime.fromisoformat(body[k].replace("Z", "+00:00")) for k in ("issued_at", "request_expires_at"))
    assert timedelta() < expires - issued <= timedelta(seconds=15)
    assert set(body["params"]) == set(MAC["requirements"][feature])


def test_the_execution_deadline_equals_the_drafts_own_end_or_expiry():
    assert build("door_windows")["execution_expires_at"] == fx._utc(datetime.fromisoformat(LATER))
    with pytest.raises(fx.FeatureError):
        build("door_windows", execution_expires_at=NOW + timedelta(hours=1))
    with pytest.raises(fx.FeatureError):
        build("door_automations", execution_expires_at=NOW + timedelta(hours=1))


@pytest.mark.parametrize("feature,bad", [
    ("door_windows", {"relay": 3}), ("door_windows", {"relay": True}), ("door_windows", {"mapping_revision": 0}), ("door_windows", {"mapping_revision": 2 ** 53}),
    ("door_windows", {"station_id": ""}), ("door_windows", {"station_id": "x" * 129}), ("door_windows", {"station_id": "a\x01b"}),
    ("door_windows", {"start": LATER, "end": NOW.isoformat()}), ("door_windows", {"timezone": "Not/AZone"}), ("door_windows", {"end": "2026-10-21T12:00:00"}),
    ("live_media", {"direction": "audio_only"}), ("door_automations", {"expiry": "2099-01-01T00:00:00+00:00"}), ("people_csv", {"extra": "x"})])
def test_what_wiskey_would_refuse_is_never_built(feature, bad):
    with pytest.raises(fx.FeatureError):
        build(feature, params=params(feature, **bad))


def test_a_missing_or_extra_parameter_is_refused():
    p = params("people_csv"); p.pop("preview_ref")
    with pytest.raises(fx.FeatureError):
        build("people_csv", params=p)


def test_actor_rules():
    with pytest.raises(fx.FeatureError):
        build("door_windows", actor=fx.automation_actor(automation_id="a", run_id="r", trigger_id="t", creator_user_id="c", approver_user_id="p", grant_revision=5))
    with pytest.raises(fx.FeatureError):
        build("door_automations", actor=fx.human_actor("user-1"))
    with pytest.raises(fx.FeatureError) as e:
        build("door_automations", authority_revision=6)  # grant_revision 5 != authority_revision 6
    assert e.value.code == "binding_denied"
    with pytest.raises(fx.FeatureError):
        build("door_windows", actor={"kind": "service", "user_id": "x"})
    with pytest.raises(fx.FeatureError):
        build("door_windows", actor={"kind": "human", "user_id": "u", "extra": 1})


def test_time_rules():
    for ttl in (0, 16):
        with pytest.raises(fx.FeatureError):
            build("door_windows", ttl_s=ttl)
    with pytest.raises(fx.FeatureError):
        build("door_windows", now=datetime(2026, 10, 21, 12, 0, 0))  # naive
    with pytest.raises(fx.FeatureError):
        build("door_windows", now=NOW + timedelta(hours=3))  # the deadline is already past
    with pytest.raises(fx.FeatureError):
        build("door_windows", request_id="not-a-uuid")
    assert build("door_windows", ttl_s=15)["request_expires_at"].endswith("Z")


def test_ids_are_generated_when_not_given_and_are_unique():
    a, b = build("door_windows", request_id=None), build("door_windows", request_id=None)
    assert a["request_id"] != b["request_id"] and a["operation_id"] != b["operation_id"]


# ---------------------------------------------------------------- durable attempt, no replay, honest status

@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.executescript(MIG.read_text(encoding="utf-8"))
    return c


def test_a_request_is_admitted_once_and_never_replayed(conn):
    body = build("door_windows")
    fx.admit_request(conn, body)
    with pytest.raises(fx.FeatureError) as e:
        fx.admit_request(conn, body)
    assert e.value.code == "duplicate"
    with pytest.raises(fx.FeatureError):
        fx.admit_request(conn, build("door_windows", operation_id=body["operation_id"], request_id="bbbbbbbb-1111-4222-8333-bbbbbbbbbbbb"))
    fx.mark_feature_sent(conn, RID)
    with pytest.raises(fx.FeatureError):
        fx.mark_feature_sent(conn, RID)
    assert fx.settle_feature(conn, RID, "unknown", "timeout") and fx.intent_state(conn, RID) == "unknown"
    assert fx.settle_feature(conn, RID, "accepted") and not fx.settle_feature(conn, RID, "refused", "x") and fx.intent_state(conn, RID) == "accepted"


def test_no_transport_exists():
    with pytest.raises(wp.PeerSeamError) as e:
        fx.LiveFeatureTransport().send({})
    assert e.value.code == "not_built"


def test_the_status_never_says_active_from_a_switch_alone(conn):
    for f in fx.FEATURES:
        fx.set_feature_enabled(conn, f, True)
    st = fx.status(conn)
    assert all(not v["active"] and fx.TRANSPORT_BLOCK in v["blockers"] and "host_registration_unverified" in v["blockers"] for v in st.values())
    assert all(v["enabled"] for v in st.values())
    assert "relay_map_empty" in st["door_windows"]["blockers"] and "relay_map_empty" not in st["people_csv"]["blockers"]
    fx.record_host_registration(conn, "people_csv", peer=PEER, verified=True, code="registered")
    assert fx.status(conn)["people_csv"]["host_registered"] is True and fx.status(conn, transport_built=True)["people_csv"]["active"] is True
    assert fx.status(conn, transport_built=True)["door_windows"]["active"] is False


def test_the_relay_map_is_cas_and_never_invented(conn):
    assert fx.relay_row(conn, "st-a", 1) is None
    assert fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=2, confirmed_by="user-1", expected_revision=0) == 1
    with pytest.raises(fx.FeatureError) as e:
        fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=1, confirmed_by="user-1", expected_revision=0)
    assert e.value.code == "revision_conflict"
    assert fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=1, confirmed_by="user-1", expected_revision=1) == 2
    assert fx.relay_row(conn, "st-a", 1).physical_relay == 1
    fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=1, confirmed_by="user-1", expected_revision=2, active=False)
    assert fx.relay_row(conn, "st-a", 1) is None
    for bad in (dict(api_relay=3), dict(physical_relay=0), dict(expected_revision=True), dict(station_id="")):
        kw = dict(station_id="st-b", api_relay=1, physical_relay=1, confirmed_by="u", expected_revision=0); kw.update(bad)
        with pytest.raises(fx.FeatureError):
            fx.set_relay_map(conn, **kw)


# ---------------------------------------------------------------- the current policy from Arx RBAC

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
    return Env(settings)


def test_policy_needs_a_confirmed_relay_map_and_the_station_permission(env):
    admin = env.principal("joni")
    with env.db.connection() as conn:
        doc = fx.resolve_policy(conn, [admin], feature="door_windows", targets=[("st-a", 1)])
        assert doc.complete is False and "relay_map_missing:st-a:1" in doc.why_incomplete and doc.stations == ()
        fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=2, confirmed_by=admin.user_id, expected_revision=0)
        doc = fx.resolve_policy(conn, [admin], feature="door_windows", targets=[("st-a", 1)])
        assert doc.complete is True and doc.stations == (fx.StationGrant("st-a", 1, 2, 1),)
        assert doc.permissions == {"door/hold_open", "door/restore"}
        wire = doc.as_wire("epoch-1")
        assert wire["stations"] == [{"station_id": "st-a", "api_relay": 1, "physical_relay": 2, "mapping_revision": 1}] and wire["complete"] is True


def test_a_user_without_the_permission_gets_an_empty_incomplete_policy(env):
    env.principal("nobody")  # a user with no binding
    nobody = env.principal("nobody")
    with env.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=1, confirmed_by=nobody.user_id, expected_revision=0)
        doc = fx.resolve_policy(conn, [nobody], feature="emergency_buttons", targets=[("st-a", 1)])
    assert doc.permissions == frozenset() and doc.complete is False and "no_permission" in doc.why_incomplete


def test_a_door_automation_needs_both_creator_and_approver(env, settings):
    admin, other = env.principal("joni"), env.principal("plain")
    with env.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=1, confirmed_by=admin.user_id, expected_revision=0)
        both = fx.resolve_policy(conn, [admin, admin], feature="door_automations", targets=[("st-a", 1)])
        one = fx.resolve_policy(conn, [admin, other], feature="door_automations", targets=[("st-a", 1)])
    assert both.permissions == {"door/pulse", "door/hold_open", "door/restore"} and one.permissions == frozenset() and one.complete is False


def test_a_scope_with_no_targets_or_no_principal_is_incomplete(env):
    admin = env.principal("joni")
    with env.db.connection() as conn:
        assert fx.resolve_policy(conn, [admin], feature="live_media", targets=[]).complete is False
        assert "no_principal" in fx.resolve_policy(conn, [], feature="people_csv", targets=[]).why_incomplete
        assert fx.resolve_policy(conn, [admin], feature="people_csv", targets=[]).complete is True  # installation-scoped feature, administrator
    with pytest.raises(fx.FeatureError):
        fx.resolve_policy(conn, [admin], feature="nope", targets=[])
