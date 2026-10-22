"""WKBRIDGE-295 (FAKES ONLY): the Arx side of WisKey round 3 - the signed bridge-command builder, the authority policy snapshot and the
monotonic authority revision (PROVISIONAL migration 0150), and the shared Q1 fixture. Nothing contacts WisKey, Home Assistant or a
station; the pairing secret is a test value; every wire shape under test is ASSUMED-PENDING-WISKEY-SHA (services/wiskey_bridge_adapter.py)."""
from __future__ import annotations

import copy
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

import wkbridge_fixture as fx
from smplwise import db as dbmod
from smplwise import rbac
from smplwise.services import bridge_keys, ha_bridge
from smplwise.services import wiskey_bridge_adapter as wb

SECRET = "test-pairing-secret-not-real"
OWNER = "a" * 32
REPO = "11111111-2222-4333-8444-555555555555"
NOW = datetime(2026, 10, 23, 9, 0, 0, tzinfo=timezone.utc)
ACTOR = {"id": "arx-user-1", "display_name": "SENSITIVE-DISPLAY-NAME-7731"}
DESCRIPTOR = {"station_id": "station-a", "actor": ACTOR, "request_id": "req-0001"}


@pytest.fixture(autouse=True)
def _fresh_nonce_cache():
    bridge_keys.reset_for_tests()  # the vectors reuse one nonce; the bridge's process-wide replay cache would refuse the second
    yield
    bridge_keys.reset_for_tests()


@pytest.fixture()
def conn(tmp_path: Path):
    d = dbmod.Database(tmp_path / "t.db")
    d.migrate()
    with d.connection() as c:
        yield c


@pytest.fixture()
def paired(conn):
    dbmod.set_setting(conn, "bridge.secret", SECRET)
    return conn


def _build(conn, **kw):
    args = {"request_id": 7, "command": "media/station_descriptor", "parameters": copy.deepcopy(DESCRIPTOR), "query_owner_id": OWNER,
            "now": NOW, "nonce": "0123456789abcdef0123456789abcdef"}
    args.update(kw)
    return wb.build_command(conn, **args)


# ================================================================ (1) the signed-command builder

def test_the_envelope_and_the_signature_match_wiskeys_existing_bridge_recipe(paired):
    cmd = _build(paired)
    wire = cmd.wire()
    assert set(wire) == {"id", "type", "bridge"} and wire["id"] == 7 and wire["type"] == "hikvision_intercom/media/station_descriptor"
    proof = wire["bridge"]
    assert set(proof) == wb.BODY_KEYS | {"ts", "nonce", "sig"}  # no `kid` on the pairing-v1 framing, no outer copy of a parameter
    assert proof["kind"] == "wiskey-bridge-command.v1" != wb.READ_KIND
    assert proof["command"] == "media/station_descriptor" and wire["type"].endswith("/" + proof["command"])
    assert proof["query_owner_id"] == OWNER and proof["parameters"] == DESCRIPTOR
    issued, expires = datetime.fromisoformat(proof["issued_at"]), datetime.fromisoformat(proof["expires_at"])
    assert issued == NOW and 0 < (expires - issued).total_seconds() <= 15 and issued.tzinfo is not None
    # the verifier's recipe, computed independently (peer_query spec section 3): HMAC(pairing, "<ts>.<nonce>.<sha256(canonical body)>")
    body = {k: v for k, v in proof.items() if k not in ("ts", "nonce", "sig")}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    want = hmac.new(SECRET.encode(), f"{proof['ts']}.{proof['nonce']}.{hashlib.sha256(canonical).hexdigest()}".encode(), hashlib.sha256).hexdigest()
    assert proof["sig"] == want and proof["ts"] == int(NOW.timestamp()) and len(proof["nonce"]) == 32


def test_arxs_own_bridge_verifier_accepts_the_proof_and_refuses_a_changed_parameter(paired):
    proof = _build(paired).wire()["bridge"]
    ha_bridge.verify(SECRET, copy.deepcopy(proof), now=NOW.timestamp())
    forged = copy.deepcopy(proof)
    forged["parameters"]["station_id"] = "station-b"
    forged["nonce"] = "f" * 32
    with pytest.raises(Exception):
        ha_bridge.verify(SECRET, forged, now=NOW.timestamp())


def test_the_default_nonce_is_fresh_and_32_hex(paired):
    a = _build(paired, nonce=None).wire()["bridge"]["nonce"]
    b = _build(paired, nonce=None).wire()["bridge"]["nonce"]
    assert a != b and len(a) == 32 and int(a, 16) >= 0


@pytest.mark.parametrize("command", sorted(wb.READ_COMMANDS))
def test_a_read_command_is_never_built_so_the_read_kind_is_not_widened(paired, command):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired, command=command, parameters={})
    assert e.value.code == "read_command_refused"


@pytest.mark.parametrize("command", ["media/talk_frame", "whatsapp/template_send_v2", "users/delete", "doors/open", "", "MEDIA/station_descriptor",
                                     "hikvision_intercom/media/station_descriptor", None, ["media/station_descriptor"]])
def test_an_unknown_command_is_refused(paired, command):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired, command=command)
    assert e.value.code == "unknown_command"


def test_the_allow_list_is_disjoint_from_the_read_commands_and_closed():
    assert not set(wb.COMMANDS) & wb.READ_COMMANDS
    assert set(wb.COMMANDS) == {"media/station_descriptor", "media/stream_lease", "media/talk_open", "media/talk_floor", "media/talk_close"}


@pytest.mark.parametrize("parameters,code", [
    ({**DESCRIPTOR, "extra": 1}, "invalid_parameters"),
    ({k: v for k, v in DESCRIPTOR.items() if k != "request_id"}, "invalid_parameters"),
    ({**DESCRIPTOR, "principal": "admin"}, "forbidden_parameter"),
    ({**DESCRIPTOR, "consent": True}, "forbidden_parameter"),
    ({**DESCRIPTOR, "is_admin": True}, "forbidden_parameter"),
    ({**DESCRIPTOR, "sig": "0" * 64}, "forbidden_parameter"),
    ({**DESCRIPTOR, "station_id": 1.5}, "invalid_parameters"),
    ({**DESCRIPTOR, "actor": {"id": "x", "display_name": float("nan")}}, "invalid_parameters"),
    ({**DESCRIPTOR, "actor": {"id": "x"}}, "invalid_parameters"),
    ({**DESCRIPTOR, "station_id": ""}, "invalid_parameters"),
    ({**DESCRIPTOR, "station_id": "a\nb"}, "invalid_parameters"),
    ({1: "x"}, "invalid_parameters"),
    ("not a dict", "invalid_parameters"),
])
def test_parameters_must_be_the_exact_closed_set(paired, parameters, code):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired, parameters=parameters)
    assert e.value.code == code


def test_every_allow_listed_command_builds_with_its_closed_parameters(paired):
    ref = "ref_" + "A" * 20
    cases = {
        "media/station_descriptor": DESCRIPTOR,
        "media/stream_lease": {"session": ref, "profile": "sub", "actor": ACTOR, "request_id": "req-2"},
        "media/talk_open": {"session": ref, "actor": ACTOR, "request_id": "req-3", "expires_at": (NOW + timedelta(seconds=60)).isoformat()},
        "media/talk_floor": {"talk_ref": ref, "held": True},
        "media/talk_close": {"talk_ref": ref, "reason": "stopped"},
    }
    assert set(cases) == set(wb.COMMANDS)
    for i, (command, params) in enumerate(cases.items(), start=1):
        assert _build(paired, request_id=i, command=command, parameters=copy.deepcopy(params)).wire()["bridge"]["parameters"] == params
    for bad in ({"talk_ref": ref, "held": 1}, {"talk_ref": "short", "held": True}):
        with pytest.raises(wb.BridgeCommandError):
            _build(paired, command="media/talk_floor", parameters=bad)
    with pytest.raises(wb.BridgeCommandError):
        _build(paired, command="media/talk_close", parameters={"talk_ref": ref, "reason": "no_effect"})


@pytest.mark.parametrize("window", [0, -1, 16, 60, True, 10.0])
def test_expires_at_is_bounded(paired, window):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired, window_s=window)
    assert e.value.code == "invalid_window"


def test_the_window_edge_is_inclusive_at_15_seconds(paired):
    proof = _build(paired, window_s=15).wire()["bridge"]
    assert datetime.fromisoformat(proof["expires_at"]) - datetime.fromisoformat(proof["issued_at"]) == timedelta(seconds=15)


@pytest.mark.parametrize("rid", [0, -1, 2 ** 53, True, "7", 7.0])
def test_the_frame_id_is_an_exact_int(paired, rid):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired, request_id=rid)
    assert e.value.code == "invalid_id"


@pytest.mark.parametrize("owner", ["A" * 32, "a" * 31, "", None, "g" * 32])
def test_the_query_owner_is_the_32_hex_principal_id(paired, owner):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired, query_owner_id=owner)
    assert e.value.code == "invalid_owner"


def test_a_naive_clock_and_a_bad_nonce_are_refused(paired):
    with pytest.raises(wb.BridgeCommandError):
        _build(paired, now=datetime(2026, 10, 23, 9, 0, 0))
    with pytest.raises(wb.BridgeCommandError):
        _build(paired, nonce="XYZ")


def test_not_paired_refuses_without_signing(conn):
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(conn)
    assert e.value.code == "bridge_not_paired"


def test_the_existing_key_handling_is_reused_legacy_signs_and_a_v2_key_fails_closed(conn, monkeypatch):
    monkeypatch.setattr(ha_bridge, "signing_key", lambda c: ha_bridge.BridgeKey(SECRET, "g0-legacy"))
    proof = _build(conn).wire()["bridge"]
    assert "kid" not in proof
    ha_bridge.verify(SECRET, proof, now=NOW.timestamp())
    monkeypatch.setattr(ha_bridge, "signing_key", lambda c: ha_bridge.BridgeKey(SECRET, "g1-0123abcd"))
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(conn, nonce="1" * 32)
    assert e.value.code == "keyset_v2_unconfirmed"  # ASSUMED-PENDING-WISKEY-SHA: no key-ring v2 on this route until WisKey confirms


def test_an_oversized_request_is_refused(paired, monkeypatch):
    monkeypatch.setattr(wb, "MAX_REQUEST_BYTES", 200)
    with pytest.raises(wb.BridgeCommandError) as e:
        _build(paired)
    assert e.value.code == "request_too_large"


def test_parameter_values_never_reach_a_log_an_audit_row_a_repr_or_an_error(paired, caplog):
    caplog.set_level(logging.DEBUG)
    audit_before = paired.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    cmd = _build(paired)
    secret_bits = (ACTOR["display_name"], "req-0001", SECRET)
    shown = repr(cmd) + str(cmd) + json.dumps(cmd.audit_fields())
    assert not any(s in shown for s in secret_bits)
    assert cmd.audit_fields()["parameter_keys"] == ["actor", "request_id", "station_id"]
    try:
        _build(paired, parameters={**DESCRIPTOR, "extra": ACTOR["display_name"]})
    except wb.BridgeCommandError as exc:
        assert ACTOR["display_name"] not in str(exc) and ACTOR["display_name"] not in repr(exc)
    assert not any(s in caplog.text for s in secret_bits)
    assert paired.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0] == audit_before


def test_the_signed_wire_cannot_be_changed_through_the_object(paired):
    cmd = _build(paired)
    w = cmd.wire()
    w["bridge"]["parameters"]["station_id"] = "station-z"
    assert cmd.wire()["bridge"]["parameters"]["station_id"] == "station-a"


# ================================================================ (2) the authority revision (PROVISIONAL 0150) and the policy snapshot

def _rev(conn) -> int:
    return wb.authority_revision(conn)


def _user(conn, uid: str, active: int = 1) -> rbac.Principal:
    conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, '', 'ingress', ?, 'x', 'x')",
                 (uid, uid, active))
    return rbac.Principal(user_id=uid, username=uid, display_name="", source="ingress")


def _bind(conn, uid: str, role: str, scope: tuple[str, str], effect: str = "allow", kind: str = "user") -> str:
    bid = dbmod.new_id()
    conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                 "VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'test', ?)", (bid, kind, uid, role, scope[0], scope[1], effect, dbmod.now_iso()))
    return bid


def test_the_revision_starts_at_one_and_moves_on_every_authority_write(conn):
    r = _rev(conn)
    assert r >= 1
    _user(conn, "u1")
    assert _rev(conn) == r  # a new user row grants nothing
    bid = _bind(conn, "u1", "door_opener", (rbac.STATION, "station-a"))
    assert _rev(conn) == r + 1
    conn.execute("UPDATE bindings SET revoked_at = ? WHERE id = ?", (dbmod.now_iso(), bid))
    assert _rev(conn) == r + 2
    conn.execute("INSERT INTO groups(id, name, created_at) VALUES ('g1', 'g', 'x')")
    conn.execute("INSERT INTO group_members(group_id, user_id) VALUES ('g1', 'u1')")
    assert _rev(conn) == r + 3
    conn.execute("UPDATE users SET active = 0 WHERE id = 'u1'")
    assert _rev(conn) == r + 4
    conn.execute("UPDATE users SET active = 0 WHERE id = 'u1'")  # no change of the flag: no bump
    conn.execute("UPDATE users SET display_name = 'n' WHERE id = 'u1'")
    assert _rev(conn) == r + 4
    conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('c1', 'r', '[]', 'x', 'x')")
    conn.execute("UPDATE custom_roles SET permissions_json = '[\"access.read\"]' WHERE id = 'c1'")
    assert _rev(conn) == r + 6
    dbmod.bump_permission_revision(conn)  # every application-level bump moves it too
    assert _rev(conn) == r + 7
    dbmod.set_setting(conn, "some.other.setting", "1")
    assert _rev(conn) == r + 7
    conn.execute("INSERT INTO intercom_station_placement(config_entry_id, site_id, building_id, assigned_by, assigned_at) VALUES ('station-a', NULL, NULL, 't', 'x')")
    assert _rev(conn) == r + 8
    conn.execute("INSERT INTO access_station_permissions(id, wiskey_person_id, station_id, effect, created_at, updated_at) VALUES ('p1', 'person-a', 'station-a', 'deny', 'x', 'x')")
    assert _rev(conn) == r + 9
    conn.execute("UPDATE access_station_permissions SET sync_state = 'applied', attempts = 1 WHERE id = 'p1'")  # bookkeeping only
    assert _rev(conn) == r + 9
    conn.execute("UPDATE access_station_permissions SET effect = 'allow', relays_json = '[1]' WHERE id = 'p1'")
    assert _rev(conn) == r + 10
    conn.execute("DELETE FROM group_members WHERE user_id = 'u1'")
    assert _rev(conn) == r + 11


def test_the_revision_never_decreases_and_no_trigger_writes_it_down(conn):
    sql = " ".join(r[0] for r in conn.execute("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_aar_%'"))
    assert sql.count("revision = revision + 1") == len(conn.execute("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_aar_%'").fetchall())
    assert "revision - " not in sql and "revision = 1" not in sql
    seen = [_rev(conn)]
    for i in range(5):
        _bind(conn, f"u{i}", "viewer", rbac.INSTALLATION)
        seen.append(_rev(conn))
    assert seen == sorted(seen) and len(set(seen)) == len(seen)


def test_the_snapshot_is_arx_rbac_as_it_really_is(conn):
    p = _user(conn, "u1")
    bid = _bind(conn, "u1", "door_opener", (rbac.STATION, "station-a"))
    snap = wb.authority_snapshot(conn, actor=p, station_ids=["station-b", "station-a"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert set(snap) == wb.SNAPSHOT_KEYS and snap["schema"] == wb.SNAPSHOT_SCHEMA and snap["schema_version"] == 1
    assert snap["revision"] == _rev(conn) and snap["actor_ref"] == "u1" and snap["query_owner_id"] == OWNER and snap["repository_id"] == REPO
    assert snap["stations"] == ["station-a", "station-b"]
    assert snap["grants"] == [{"grant_id": bid, "station_id": "station-a", "permission": "access.doors.open"},
                              {"grant_id": bid, "station_id": "station-a", "permission": "access.read"}]
    assert datetime.fromisoformat(snap["expires_at"]) - datetime.fromisoformat(snap["issued_at"]) == timedelta(seconds=wb.SNAPSHOT_DEFAULT_TTL_S)
    assert all(g["permission"] in rbac.STATION_PERMISSIONS for g in snap["grants"])
    # an installation-wide role reaches every listed station, each grant naming the binding behind it
    op = _bind(conn, "u1", "operator", rbac.INSTALLATION)
    snap2 = wb.authority_snapshot(conn, actor=p, station_ids=["station-b"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert snap2["revision"] > snap["revision"]
    assert {g["permission"] for g in snap2["grants"]} == {p_ for p_ in rbac.ROLES["operator"] if p_ in rbac.STATION_PERMISSIONS}
    assert {g["grant_id"] for g in snap2["grants"]} == {op}


def test_a_deny_and_an_inactive_user_remove_the_grants(conn):
    p = _user(conn, "u1")
    _bind(conn, "u1", "door_opener", (rbac.STATION, "station-a"))
    _bind(conn, "u1", "door_opener", rbac.INSTALLATION, effect="deny")
    snap = wb.authority_snapshot(conn, actor=p, station_ids=["station-a"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert snap["grants"] == []
    q = _user(conn, "u2", active=0)
    _bind(conn, "u2", "site_admin", rbac.INSTALLATION)
    assert wb.authority_snapshot(conn, actor=q, station_ids=["station-a"], query_owner_id=OWNER, repository_id=REPO, now=NOW)["grants"] == []


def test_the_snapshot_never_mixes_two_revisions(conn, monkeypatch):
    p = _user(conn, "u1")
    seq = iter([5, 6])
    monkeypatch.setattr(wb, "authority_revision", lambda c: next(seq))
    with pytest.raises(wb.SnapshotError) as e:
        wb.authority_snapshot(conn, actor=p, station_ids=["station-a"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert e.value.code == "revision_moved"


def test_before_the_migration_the_snapshot_is_not_installed(conn):
    p = _user(conn, "u1")
    conn.execute("DROP TABLE arx_authority_revision")
    assert wb.authority_revision(conn) is None
    with pytest.raises(wb.SnapshotError) as e:
        wb.authority_snapshot(conn, actor=p, station_ids=["station-a"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert e.value.code == "not_installed"


@pytest.mark.parametrize("kw,code", [
    ({"ttl_s": 0}, "invalid_ttl"), ({"ttl_s": 301}, "invalid_ttl"), ({"ttl_s": True}, "invalid_ttl"),
    ({"query_owner_id": "x"}, "invalid_owner"), ({"repository_id": "not-a-uuid"}, "invalid_repository"),
    ({"station_ids": "station-a"}, "invalid_stations"), ({"station_ids": ["ok", ""]}, "invalid_stations"),
    ({"station_ids": [1, "a"]}, "invalid_stations"), ({"actor": "u1"}, "invalid_actor"),
    ({"now": datetime(2026, 10, 23)}, "invalid_clock"),
])
def test_the_snapshot_inputs_are_bounded(conn, kw, code):
    p = _user(conn, "u1")
    args = {"actor": p, "station_ids": ["station-a"], "query_owner_id": OWNER, "repository_id": REPO, "now": NOW, **kw}
    with pytest.raises(wb.SnapshotError) as e:
        wb.authority_snapshot(conn, **args)
    assert e.value.code == code


def test_a_snapshot_is_current_only_until_expiry_or_the_next_authority_change(conn):
    p = _user(conn, "u1")
    snap = wb.authority_snapshot(conn, actor=p, station_ids=["station-a"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert wb.snapshot_current(snap, conn, now=NOW + timedelta(seconds=1))
    assert not wb.snapshot_current(snap, conn, now=NOW + timedelta(seconds=wb.SNAPSHOT_DEFAULT_TTL_S))
    _bind(conn, "u1", "viewer", rbac.INSTALLATION)
    assert not wb.snapshot_current(snap, conn, now=NOW + timedelta(seconds=1))
    assert not wb.snapshot_current({**snap, "extra": 1}, conn, now=NOW)


def test_the_snapshot_writes_nothing(conn):
    p = _user(conn, "u1")
    before = (_rev(conn), conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0], conn.total_changes)
    wb.authority_snapshot(conn, actor=p, station_ids=["station-a", "station-b"], query_owner_id=OWNER, repository_id=REPO, now=NOW)
    assert (_rev(conn), conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0], conn.total_changes) == before


# ================================================================ (3) the shared Q1 fixture (Arx's side)

def test_the_fixture_regenerates_byte_for_byte():
    assert fx.FIXTURE.read_text(encoding="utf-8") == fx.render(), "drift: run `py -3.12 smplwise_vms/backend/tests/wkbridge_fixture.py --write`"


def test_the_fixture_keeps_wiskeys_shape_and_records_arxs_verdicts():
    data = json.loads(fx.FIXTURE.read_text(encoding="utf-8"))
    for key in ("fixture_version", "scope", "person_id", "revision", "snapshot", "expected_pending"):
        assert key in data
    assert data["snapshot"] == fx.WISKEY_INPUT["snapshot"] and data["expected_pending"] == fx.WISKEY_INPUT["expected_pending"]
    assert data["person_id"] == "person-a" and data["revision"] == 4
    assert data["arx"]["station_verdicts"] == {"station-a": "unknown", "station-b": "pending", "station-c": "pending"}
    assert data["arx"]["person_verdict"] == "pending"
    rows = {r["station_id"] for r in data["arx"]["access_state_v2"]["assignments"]}
    assert rows == {"station-a", "station-b"} and "station-c" not in rows  # C stays queued with no assignment row
    prov = data["provenance"]
    assert prov["wiskey_input"]["commit"] == "f842b2c523b22b8d1f4275ca9b02f78acb1010fd"
    assert prov["semantics"].startswith("pilot/WKB-295 812b49a1df5f8b0ca31803754d114066ed56d6a1")
    assert prov["wiskey_input_canonical_sha256"] == hashlib.sha256(fx.canonical(fx.WISKEY_INPUT).encode("utf-8")).hexdigest()
    assert prov["synthetic"] is True


def test_every_id_in_the_six_queues_is_a_station_id_and_ids_are_synthetic():
    data = json.loads(fx.FIXTURE.read_text(encoding="utf-8"))
    stations = set(data["arx"]["station_verdicts"])
    for ids in data["arx"]["access_state_v2"]["pending"].values():
        assert set(ids) <= stations
    text = fx.FIXTURE.read_text(encoding="utf-8")
    assert all(s.startswith("station-") for s in stations) and "@" not in text and "192.168." not in text


def test_a_changed_input_is_detected_as_drift(monkeypatch):
    changed = copy.deepcopy(fx.WISKEY_INPUT)
    changed["snapshot"]["users"]["person-a"]["assignments"]["station-b"]["applied_revision"] = 4
    changed["snapshot"]["users"]["person-a"]["assignments"]["station-b"]["sync_state"] = "synced"
    changed["expected_pending"]["operations"] = ["station-c"]
    monkeypatch.setattr(fx, "WISKEY_INPUT", changed)
    assert fx.render() != fx.FIXTURE.read_text(encoding="utf-8")
