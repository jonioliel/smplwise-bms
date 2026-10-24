"""CR-033 wave 1 (slices D0-D4) on fakes only: the trusted-bridge fake against the v3 contract oracle (D0), the door map
(D1, T23), the access control station scope (D2), the one door authority, the door_opener role and the grant card (D3,
T6, T26), and the door transport with the interim mode and the signed mode (D4, T1-T5, T7, T8, T10, T11). No Home
Assistant, no bridge, no WisKey, no door, no key: the pairing secret is the published golden-vector TEST constant."""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import uuid
from typing import Any

import pytest
from conftest import as_user, bind, seed_tree
from fake_trusted_bridge import TEST_SECRET, FakeClock, FakeTrustedBridge, FakeWisKeyFeed, station
from fastapi.testclient import TestClient

import test_wiskey_golden_vectors as gv
from smplwise.db import Database, get_setting, now_iso, set_setting
from smplwise.main import create_app
from smplwise.rbac import ROLES, STATION, Principal, scope_chain
from smplwise.routers import access_control
from smplwise.services import door_authority, ha_client, intercom_doors, intercom_sync, trusted_door

ENTRY = "01JTESTSTATIONENTRY000000A"  # synthetic config entry ids, shaped like opaque ConfigEntry ids
SIDE = "01JTESTSTATIONENTRY000000B"
DOCK = "01JTESTSTATIONENTRY000000C"
API = "/api/v1"


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()


@pytest.fixture()
def world(settings, monkeypatch):
    """An app, a served WisKey copy (entrance: one relay; side: one relay; dock: two relays), three WisKey lock entities
    and one ordinary lock in the registry mirror, and a bridge that must never be asked to `execute` a WisKey door."""
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית"), station(SIDE, "דלת צד"), station(DOCK, "רציף", relays=[1, 2])]).install(monkeypatch)
    app = create_app(settings)
    c = TestClient(app)
    db = Database(settings.db_path)
    executed: list[dict[str, Any]] = []

    def execute(_settings: Any, payload: dict[str, Any]) -> dict[str, Any]:
        executed.append(payload)
        return {"ok": True}

    monkeypatch.setattr(ha_client, "call_bridge_execute", execute)
    with db.connection() as conn:
        for eid, platform, entry in (("lock.entrance", "hikvision_intercom", ENTRY), ("lock.side", "smplwise_intercom", SIDE), ("lock.dock_gate", "hikvision_intercom", DOCK),
                                     ("lock.office", "nuki", None)):
            conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, config_entry_id, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                         (eid, "lock", eid.split(".")[1], platform, entry, "locked", now_iso(), now_iso(), now_iso()))
        set_setting(conn, "bridge.secret", TEST_SECRET)
        set_setting(conn, "bridge.paired_at", now_iso())
    return {"app": app, "c": c, "db": db, "feed": feed, "executed": executed, "settings": settings}


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    expires = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"client_request_id": str(uuid.uuid4()), "expires_at": expires, **fields}


def tile(c: TestClient, entity: str, user: str, confirmed: bool = True) -> Any:
    body = {"allowed_action_id": "lock.unlock", "client_request_id": str(uuid.uuid4()), "expires_at": "2099-01-01T00:00:00Z"}
    if confirmed:
        body["confirmation_grant"] = "confirmed"
    return c.post(f"{API}/ha/entities/{entity}/actions", json=body, headers=as_user(user))


def map_all(c: TestClient) -> None:
    """The administrator applies the single-relay suggestions (entrance, side) and maps the dock's gate by hand."""
    r = c.post(f"{API}/intercom/door-map/apply-suggestions", json={"confirmed": True})
    assert r.status_code == 200 and sorted(r.json()["applied"]) == ["lock.entrance", "lock.side"], r.text
    r = c.put(f"{API}/intercom/door-map/lock.dock_gate", json={"station_id": DOCK, "relay": 2, "confirmed": True})
    assert r.status_code == 200, r.text


def rows(db: Database, action: str) -> list[dict[str, Any]]:
    with db.connection(mode="read") as conn:
        out = conn.execute("SELECT actor_user_id, action, decision, resource_type, resource_id, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in out]


def custom_role(c: TestClient, name: str, sensitive: list[str], permissions: list[str] | None = None) -> str:
    r = c.post(f"{API}/access/roles", json={"name": name, "permissions": permissions or ["map.read"], "sensitive": sensitive})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def bind_raw(db: Database, user: str, role: str, scope_type: str, scope_id: str, effect: str = "allow") -> None:
    from smplwise.db import new_id, permission_revision

    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)",
                     (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))


# ================================================================ D0: the fakes against the contract oracle

def test_d0_fake_bridge_accepts_the_add_on_signer_and_keeps_its_store():
    """Our signer's message passes every stateless stage of the v3 reference; the fake keeps a store across calls: an
    identical open is a stored result (never executed twice), a status read answers from the store only, a timeout after a
    possible delivery leaves a record, a capability problem or a relay outside the mapping is refused before any record."""
    bridge = FakeTrustedBridge({ENTRY: [1]})
    rid = trusted_door.new_request_id()
    s = trusted_door.sign_message(TEST_SECRET, "door_open", "dev-sam", "סם \"ראשי\"", ENTRY, {"relay": 1}, rid)
    assert s.body_sha256 == hashlib.sha256(s.text.encode("utf-8")).hexdigest()
    wire = json.loads(s.text)
    assert set(wire) == {"protocol", "actor", "action", "station", "params", "request_id", "issued_at", "expires_at", "ts", "nonce", "sig"}
    assert len(wire["nonce"]) == 32 and wire["ts"] == gv._epoch(wire["issued_at"]) and gv._epoch(wire["expires_at"]) - wire["ts"] == 30
    first = bridge.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": s.text}, return_response=True)
    assert first == {"result": "acknowledged", "request_id": rid} and gv.schema_ok(gv.RESPONSE_SCHEMAS["door_open_acknowledged"], first)
    again = bridge.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": s.text}, return_response=True)
    assert again["result"] == "stored_result" and gv.schema_ok(gv.RESPONSE_SCHEMAS["stored_result"], again)
    assert sum(c["effects"]["dispatched"] for c in bridge.calls) == 1, "an identical open is never executed again"
    st = trusted_door.sign_message(TEST_SECRET, "door_open_status", "dev-sam", "סם", ENTRY, {"target_request_id": rid}, trusted_door.new_request_id())
    status = bridge.call_service(None, "smplwise_bridge", "door_open_status", {"signed_message_json": st.text}, return_response=True)
    assert status["result"] == "stored_result" and status["target_request_id"] == rid
    # a relay outside the station's mapping, a missing capability: refused, nothing dispatched
    bad = trusted_door.sign_message(TEST_SECRET, "door_open", "dev-sam", "סם", ENTRY, {"relay": 2}, trusted_door.new_request_id())
    assert bridge.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": bad.text}, return_response=True)["code"] == "relay_not_allowed"
    bridge.capability = "missing"
    other = trusted_door.sign_message(TEST_SECRET, "door_open", "dev-sam", "סם", ENTRY, {"relay": 1}, trusted_door.new_request_id())
    assert bridge.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": other.text}, return_response=True)["code"] == "capability_missing"
    # a wrong key, a bridge clock 40 s behind: refused at their stages
    bridge.capability = "valid"
    forged = trusted_door.sign_message("not-the-pairing-key", "door_open", "dev-sam", "סם", ENTRY, {"relay": 1}, trusted_door.new_request_id())
    assert bridge.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": forged.text}, return_response=True)["code"] == "bad_signature"
    bridge.clock = FakeClock(offset_s=-40)
    late = trusted_door.sign_message(TEST_SECRET, "door_open", "dev-sam", "סם", ENTRY, {"relay": 1}, trusted_door.new_request_id())
    assert bridge.call_service(None, "smplwise_bridge", "door_open", {"signed_message_json": late.text}, return_response=True)["code"] == "not_yet_valid"


def test_d0_classify_maps_every_closed_answer():
    rid = trusted_door.new_request_id()
    assert trusted_door.classify({"result": "acknowledged", "request_id": rid}, rid) == ("sent", None)
    assert trusted_door.classify({"result": "rejected", "stage": "state", "code": "capability_missing", "request_id": rid}, rid) == ("refused", "state/capability_missing")
    assert trusted_door.classify({"result": "rejected", "stage": "schema", "code": "bad_format"}, rid) == ("refused", "schema/bad_format")
    assert trusted_door.classify({"result": "unknown", "request_id": rid, "reason": "unconfirmed"}, rid)[0] == "unknown"
    assert trusted_door.classify({"result": "stored_result", "request_id": rid, "target_request_id": rid, "outcome": {"result": "acknowledged"}}, rid) == ("sent", "stored_result")
    assert trusted_door.classify({"result": "acknowledged", "request_id": trusted_door.new_request_id()}, rid)[0] == "unknown", "an answer about another request is never success"
    assert trusted_door.classify("opened!", rid) == ("unknown", "invalid_response")


# ================================================================ D2: the access control station scope

def test_d2_station_scope_chain_placement_and_bindings(world):
    c, db = world["c"], world["db"]
    ids = seed_tree(c)
    with db.connection() as conn:
        assert scope_chain(conn, STATION, ENTRY) == [(STATION, ENTRY), ("installation", "*")], "an unplaced station hangs off the installation only"
    r = c.put(f"{API}/intercom/stations/{ENTRY}/placement", json={"building_id": ids["building"]})
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = c.put(f"{API}/intercom/stations/{ENTRY}/placement", json={"building_id": ids["building"], "confirmed": True})
    assert r.status_code == 200 and r.json()["scope_name"] == "עמדה · כניסה ראשית"
    with db.connection() as conn:
        assert scope_chain(conn, STATION, ENTRY) == [(STATION, ENTRY), ("building", ids["building"]), ("site", ids["site"]), ("installation", "*")]
        assert (STATION, ENTRY) not in scope_chain(conn, "floor", ids["floor2"]), "a station is a leaf: no floor chain contains it"
    [placed] = rows(db, "intercom.station.placed")
    assert placed["details"]["building_id"] == ids["building"] and placed["resource_id"] == ENTRY
    assert c.put(f"{API}/intercom/stations/nope/placement", json={"site_id": ids["site"], "confirmed": True}).status_code == 404
    # a binding at station scope through the bindings API; an rbac.assign role is never bound to one station
    c.get(f"{API}/me", headers=as_user("dana"))
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dana", "role_id": "door_opener", "scope_type": STATION, "scope_id": ENTRY})
    assert r.status_code == 201, r.text
    assert r.json()["scope_name"] == "עמדה · כניסה ראשית"
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dana", "role_id": "site_admin", "scope_type": STATION, "scope_id": ENTRY})
    assert r.status_code == 422 and r.json()["code"] == "scope_not_allowed_for_role"
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-dana", "role_id": "door_opener", "scope_type": STATION, "scope_id": "no-such-station"})
    assert r.status_code == 422 and r.json()["code"] == "scope_unknown"
    scopes = c.get(f"{API}/identity/users").json()["assign_scopes"]
    assert {(s["type"], s["name"]) for s in scopes if s["type"] == STATION} == {(STATION, "עמדה · כניסה ראשית"), (STATION, "עמדה · דלת צד"), (STATION, "עמדה · רציף")}
    assert all(ENTRY not in s["name"] for s in scopes), "names on screen, never the opaque id"


def test_d2_station_binding_grants_nothing_above_itself(world):
    c, db = world["c"], world["db"]
    ids = seed_tree(c)
    c.put(f"{API}/intercom/stations/{ENTRY}/placement", json={"site_id": ids["site"], "confirmed": True})
    bind(c, world["settings"], "stan", "door_opener", STATION, ENTRY)
    bind(c, world["settings"], "sita", "door_opener", "site", ids["site"])
    with db.connection(mode="read") as conn:
        stan = Principal("dev-stan", "stan", "stan", "dev")
        sita = Principal("dev-sita", "sita", "sita", "dev")
        assert door_authority.check(conn, stan, ENTRY, 1, dev_mode=True).allowed
        assert not door_authority.check(conn, stan, SIDE, 1, dev_mode=True).allowed, "beside itself: another station"
        from smplwise.rbac import authorize

        assert not authorize(conn, stan, "access.release", ("site", ids["site"])).allowed, "above itself: the site"
        assert door_authority.check(conn, sita, ENTRY, 1, dev_mode=True).allowed, "a site binding covers a station placed under the site"
        assert not door_authority.check(conn, sita, SIDE, 1, dev_mode=True).allowed, "an unplaced station: installation bindings only"


# ================================================================ D1: the door map (T23)

def test_d1_door_map_fill_order_and_refusals(world):
    c, db = world["c"], world["db"]
    m = c.get(f"{API}/intercom/door-map").json()
    by = {lk["entity_id"]: lk for lk in m["locks"]}
    assert set(by) == {"lock.entrance", "lock.side", "lock.dock_gate"}, "only WisKey-platform locks (both domain names), never another lock"
    assert by["lock.entrance"]["suggestion"] == {"station_id": ENTRY, "relay": 1}
    assert by["lock.dock_gate"]["suggestion"] is None, "two relays: ambiguous, no suggestion"
    assert all(lk["mapping"] is None for lk in m["locks"]), "nothing is mapped until the administrator applies it"
    with db.connection(mode="read") as conn:
        with pytest.raises(Exception) as exc:
            intercom_doors.resolve(conn, "lock.entrance")
        assert exc.value.code == "intercom_lock_unmapped"
    assert c.post(f"{API}/intercom/door-map/apply-suggestions", json={}).json()["code"] == "confirmation_required"
    map_all(c)
    # manual mapping rules: a relay the station has, the entity's own station, a relay not already taken, a WisKey lock
    bad = c.put(f"{API}/intercom/door-map/lock.dock_gate", json={"station_id": DOCK, "relay": 3, "confirmed": True})
    assert bad.json()["code"] == "intercom_lock_unknown"
    assert c.put(f"{API}/intercom/door-map/lock.dock_gate", json={"station_id": ENTRY, "relay": 1, "confirmed": True}).json()["code"] == "intercom_map_station_mismatch"
    assert c.put(f"{API}/intercom/door-map/lock.office", json={"station_id": DOCK, "relay": 1, "confirmed": True}).json()["code"] == "intercom_lock_not_wiskey"
    with db.connection() as conn:  # a second WisKey lock entity on the dock (no registry entry known yet) cannot take relay 2
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state_seen_at, first_seen_at, updated_at) VALUES ('lock.dock_barrier', 'lock', 'barrier', 'hikvision_intercom', 't', 't', 't')")
    assert c.put(f"{API}/intercom/door-map/lock.dock_barrier", json={"station_id": DOCK, "relay": 2, "confirmed": True}).json()["code"] == "intercom_relay_taken"
    assert c.put(f"{API}/intercom/door-map/lock.dock_barrier", json={"station_id": DOCK, "relay": 1, "confirmed": True}).status_code == 200
    with db.connection(mode="read") as conn:
        assert intercom_doors.resolve(conn, "lock.dock_gate").relay == 2
        assert intercom_doors.entities_for(conn, DOCK, 1) == ["lock.dock_barrier"]
    mapped = rows(db, "intercom.door.mapped")
    assert [r["details"]["source"] for r in mapped] == ["single_relay", "single_relay", "manual", "manual"]
    # the WisKey copy no longer lists the relay: the row stops resolving (refused, never guessed)
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = intercom_sync.project_overview({"stations": [station(ENTRY, "כניסה ראשית", relays=[2]), station(SIDE, "דלת צד"), station(DOCK, "רציף", relays=[1, 2])]})
    with db.connection(mode="read") as conn:
        with pytest.raises(Exception) as exc:
            intercom_doors.resolve(conn, "lock.entrance")
        assert exc.value.code == "intercom_lock_unmapped"
    assert {lk["entity_id"]: lk["mapping"]["valid"] for lk in c.get(f"{API}/intercom/door-map").json()["locks"]}["lock.entrance"] is False
    # never by name: a WisKey lock whose name matches a station but carries no registry config entry gets no suggestion
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state_seen_at, first_seen_at, updated_at) VALUES ('lock.kenisa_rashit', 'lock', 'כניסה ראשית', 'hikvision_intercom', 't', 't', 't')")
    assert {lk["entity_id"]: lk["suggestion"] for lk in c.get(f"{API}/intercom/door-map").json()["locks"]}["lock.kenisa_rashit"] is None
    assert c.get(f"{API}/intercom/door-map", headers=as_user("nobody")).status_code == 403


# ================================================================ D3: one door authority (T6) and the grant card (T26)

def test_d3_door_opener_role_shape():
    assert ROLES["door_opener"] == ["access.read", "access.doors.open"]  # WXPERM: the door-only permission (was access.release)
    assert {r for r, perms in ROLES.items() if "door.unlock" in perms} == set(), "door.unlock stays held by no built-in role"


def test_d3_either_permission_opens_and_deny_on_either_wins(world):
    c, db, s = world["c"], world["db"], world["settings"]
    map_all(c)
    opener = custom_role(c, "פותח מנעולים", ["door.unlock"])
    releaser = custom_role(c, "משחרר", ["access.release"])
    bind(c, s, "uli", opener, "installation", "*")  # door.unlock only
    bind(c, s, "rel", releaser, "installation", "*")  # access.release only
    bind(c, s, "both", opener, "installation", "*")
    bind(c, s, "both", releaser, "installation", "*")
    bind(c, s, "dena", "door_opener", "installation", "*")
    bind_raw(db, "dena", releaser, STATION, ENTRY, effect="deny")  # a deny of access.release on one station
    bind(c, s, "dora", "door_opener", "installation", "*")
    bind_raw(db, "dora", opener, "installation", "*", effect="deny")  # holds access.release, but door.unlock is denied
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "wall", "kiosk", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    with db.connection(mode="read") as conn:
        def ok(user: str, sid: str = ENTRY, relay: int = 1, entity: str | None = None) -> door_authority.DoorDecision:
            return door_authority.check(conn, Principal(f"dev-{user}", user, user, "dev"), sid, relay, entity_id=entity, dev_mode=True)

        assert ok("uli").granted_by == "door.unlock", "door.unlock on the mapped lock entity is enough (decision 13 = ג)"
        assert not ok("uli", DOCK, 1).allowed, "door.unlock reaches only relays whose lock entity it covers"
        assert ok("rel").granted_by == "access.release"
        assert ok("both").allowed
        d = ok("dena")
        assert not d.allowed and d.reason == "explicit_deny", "a deny of access.release on the station wins over the door_opener allow"
        assert ok("dena", SIDE).allowed, "the deny was for one station only"
        d = ok("dora")
        assert not d.allowed and d.reason == "explicit_deny", "a deny of door.unlock on the lock wins over access.release: either permission never slips past a deny"
        for user in ("vera", "wall", "otto", "nobody"):
            assert not ok(user).allowed, user
        assert not door_authority.check(conn, Principal("dev-rel", "rel", "rel", "dev"), ENTRY, 1).allowed, "a developer identity outside developer mode is unidentified"
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-rel'")
    with db.connection(mode="read") as conn:
        assert door_authority.check(conn, Principal("dev-rel", "rel", "rel", "dev"), ENTRY, 1, dev_mode=True).reason == "user_inactive"


def test_d3_grant_card_switches_users_groups_and_custom_roles(world):
    c, db, s = world["c"], world["db"], world["settings"]
    c.get(f"{API}/me", headers=as_user("gil"))
    c.get(f"{API}/me", headers=as_user("hila"))
    bind(c, s, "hila", "site_admin", "installation", "*")  # opens through a built-in role: listed as another grant
    rev0 = int(c.get(f"{API}/access/bindings").json()["revision"])
    card = c.get(f"{API}/access/door-grants").json()
    gil = next(u for u in card["users"] if u["id"] == "dev-gil")
    assert gil["granted"] is False and gil["other"] == []
    hila = next(u for u in card["users"] if u["id"] == "dev-hila")
    assert hila["granted"] is False and [o["role_name"] for o in hila["other"]] == ["מנהל אתר / מבנה / קומה"]
    assert {r["id"]: r["answer"] for r in card["roles"] if not r["custom"]} == {"viewer": "never", "kiosk": "never", "operator": "per_user", "editor": "per_user", "site_admin": "yes", "system_admin": "yes",
        # CR-038: the nine single-purpose tickets roles hold no door permission - a door switch is per user, as for operator / editor
        **{r: "per_user" for r in ("tickets_view", "tickets_create", "tickets_manage", "tickets_external", "tickets_all_departments", "tickets_configure", "tickets_costs", "tickets_costs_view",
                                   "tickets_delete", "tickets_handlers", "tickets_directory", "tickets_technician_requests", "tickets_intake",
                                   "door_windows_manager", "door_windows_guard", "emergency_lock", "emergency_open", "security_manager",
                                   "notices_manage", "notices_push", "notices_boards")}}  # CR-NOTICE106: the notice grants hold no door permission; DOORWIN2-295: the four single-permission roles hold no door-open permission
    assert all(not r["editable"] for r in card["roles"] if not r["custom"]), "built-in roles are read-only"
    # one switch on: a door_opener binding at installation scope, audited, the revision moves
    sw = {"subject_kind": "user", "subject_id": "dev-gil", "enabled": True}
    assert c.post(f"{API}/access/door-grants/subjects", json=sw).json()["code"] == "confirmation_required"
    r = c.post(f"{API}/access/door-grants/subjects", json={**sw, "confirmed": True})
    assert r.status_code == 200 and r.json()["granted"] is True and r.json()["revision"] > rev0, r.text
    bid = r.json()["binding_id"]
    binds = c.get(f"{API}/access/bindings").json()["bindings"]
    assert [(b["role_id"], b["scope_type"], b["scope_id"]) for b in binds if b["subject_id"] == "dev-gil"] == [("door_opener", "installation", "*")]
    assert rows(db, "rbac.bind")[-1]["details"]["via"] == "door_grants_card"
    assert c.post(f"{API}/access/door-grants/subjects", json={**sw, "confirmed": True}).json()["binding_id"] == bid, "switching on twice adds nothing"
    # a door_opener binding made elsewhere (station scope) is not the card's: switching off leaves it
    bind(c, s, "gil", "door_opener", STATION, ENTRY)
    r = c.post(f"{API}/access/door-grants/subjects", json={**sw, "enabled": False, "confirmed": True})
    assert r.json()["revoked"] == [bid]
    left = [(b["role_id"], b["scope_type"]) for b in c.get(f"{API}/access/bindings").json()["bindings"] if b["subject_id"] == "dev-gil"]
    assert left == [("door_opener", STATION)]
    assert next(u for u in c.get(f"{API}/access/door-grants").json()["users"] if u["id"] == "dev-gil")["other"][0]["scope_name"] == "עמדה · כניסה ראשית"
    # a group switch
    gid = c.post(f"{API}/access/groups", json={"name": "שומרים"}).json()["id"]
    r = c.post(f"{API}/access/door-grants/subjects", json={"subject_kind": "group", "subject_id": gid, "enabled": True, "confirmed": True})
    assert r.status_code == 200 and r.json()["granted"] is True, r.text
    # a custom role switch adds / removes the door permission in its sensitive list (WXPERM: access.doors.open on; off removes
    # it and the legacy access.release); a built-in role is refused
    rid = custom_role(c, "משמרת לילה", [], permissions=["map.read", "access.read"])
    role = next(x for x in c.get(f"{API}/access/door-grants").json()["roles"] if x["id"] == rid)
    assert role["includes"] is False and role["editable"] is True
    r = c.put(f"{API}/access/door-grants/roles/{rid}", json={"enabled": True, "revision": role["revision"], "confirmed": True})
    assert r.status_code == 200 and r.json()["revision"] == role["revision"] + 1, r.text
    assert "access.doors.open" in next(x for x in c.get(f"{API}/access/roles").json()["roles"] if x["id"] == rid)["permissions"]
    assert c.put(f"{API}/access/door-grants/roles/{rid}", json={"enabled": False, "revision": role["revision"], "confirmed": True}).json()["code"] == "stale_revision"
    r = c.put(f"{API}/access/door-grants/roles/{rid}", json={"enabled": False, "revision": role["revision"] + 1, "confirmed": True})
    assert r.status_code == 200 and not {"access.doors.open", "access.release"} & set(next(x for x in c.get(f"{API}/access/roles").json()["roles"] if x["id"] == rid)["permissions"])
    assert c.put(f"{API}/access/door-grants/roles/operator", json={"enabled": True, "revision": 1, "confirmed": True}).json()["code"] == "builtin_role"
    # who may use the card: not an operator; a delegated site admin only when door_opener is on the delegation allow-list
    bind(c, s, "otto", "operator", "installation", "*")
    assert c.get(f"{API}/access/door-grants", headers=as_user("otto")).status_code == 403
    assert c.post(f"{API}/access/door-grants/subjects", json={**sw, "confirmed": True}, headers=as_user("otto")).status_code == 403


# ================================================================ D4: the door transport

def test_d4_interim_wiskey_screen_release_is_station_release_with_door_audit(world, monkeypatch):
    """Flag off (the default): the WisKey screen's release of a door_opener goes through today's station release - never the
    bridge - and its attempt / outcome rows carry the door fields (transport, mode, entry point, request id, grant)."""
    c, db, s, feed = world["c"], world["db"], world["settings"], world["feed"]
    bridge = FakeTrustedBridge({ENTRY: [1]}).install(monkeypatch)
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")
    r = c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(confirmed=True), headers=as_user("dana"))
    assert r.status_code == 200, r.text
    assert r.json()["release"] == {"accepted": True} and "אינו אישור שהדלת נפתחה" in r.json()["note"]
    [sent] = feed.sent
    assert sent["frames"] == [{"type": "hikvision_intercom/stations/test_unlock", "station_id": ENTRY, "lock": 1, "api_contract": 1}]
    assert bridge.calls == [] and world["executed"] == [], "the interim mode never signs and never uses execute"
    attempt, outcome = rows(db, "intercom.release")
    for row in (attempt, outcome):
        d = row["details"]
        assert (d["transport"], d["mode"], d["entry_point"], d["granted_by"], d["station"], d["relay"]) == ("trusted_door", "interim", "wiskey_screen", "access.doors.open", ENTRY, 1)
        assert d["door_request_id"] == r.json()["door_request_id"] and "body_sha256" not in d
    assert outcome["details"]["outcome"] == "ok"
    # the notification deep link: the same path, its origin recorded only
    r = c.post(f"{API}/intercom/stations/{SIDE}/release", json=env(confirmed=True, origin="notification:n-1"), headers=as_user("dana"))
    assert r.status_code == 200
    assert rows(db, "intercom.release")[-1]["details"]["entry_point"] == "notification"


def test_d4_wiskey_screen_permission_gate_and_per_relay_check(world, monkeypatch):
    c, db, s, feed = world["c"], world["db"], world["settings"], world["feed"]
    map_all(c)
    opener = custom_role(c, "פותח", ["door.unlock"])
    bind(c, s, "uli", opener, "installation", "*")  # door.unlock: the dock's gate (relay 2) only - the mapped entity
    bind(c, s, "vera", "viewer", "installation", "*")
    r = c.post(f"{API}/intercom/stations/{DOCK}/release", json=env(confirmed=True, lock=2), headers=as_user("uli"))
    assert r.status_code == 200, r.text
    r = c.post(f"{API}/intercom/stations/{DOCK}/release", json=env(confirmed=True, lock=1), headers=as_user("uli"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden", "relay 1 has no lock entity uli may unlock"
    assert rows(db, "intercom.release")[-1]["reason"] == "forbidden"
    r = c.post(f"{API}/intercom/stations/{DOCK}/release", json=env(confirmed=True, lock=2), headers=as_user("vera"))
    assert r.status_code == 403
    assert rows(db, "access.doors.open")[-1]["decision"] == "denied", "the gate refuses before the body, audited under the door permission"
    assert len(feed.sent) == 1
    bind(c, s, "uli", "viewer", "installation", "*")  # the WisKey screen itself needs access.read at installation (R2)
    ov = c.get(f"{API}/intercom/overview", headers=as_user("uli")).json()
    assert ov["door_access"] == {ENTRY: True, SIDE: True, DOCK: True}, "door.unlock on the mapped lock entities of every station"
    assert c.get(f"{API}/intercom/overview", headers=as_user("vera")).json()["door_access"] == {ENTRY: False, SIDE: False, DOCK: False}


def test_d4_tile_unlock_of_a_wiskey_door_goes_through_the_door_path(world, monkeypatch):
    """A1 / T3: lock.unlock of a WisKey lock entity never reaches `execute`; ha.entity.control is not what decides it; the
    ha_actions row is `via trusted_door` with nothing to observe, so the screens say "sent"; an ordinary lock still uses
    execute exactly as before."""
    c, db, s, feed = world["c"], world["db"], world["settings"], world["feed"]
    bind(c, s, "dana", "door_opener", "installation", "*")
    r = tile(c, "lock.entrance", "dana")
    assert r.status_code == 409 and r.json()["code"] == "intercom_lock_unmapped", "unmapped: refused, nothing sent"
    map_all(c)
    r = tile(c, "lock.entrance", "dana", confirmed=False)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    r = tile(c, "lock.entrance", "dana")
    assert r.status_code == 202, r.text
    a = r.json()
    assert (a["status"], a["via"], a["confirmation"], a["expected_state"]) == ("confirmed", "trusted_door", "none", None), a
    assert c.get(f"{API}/ha/actions/{a['id']}", headers=as_user("dana")).json()["confirmation"] == "none"
    assert [f["frames"][0]["station_id"] for f in feed.sent] == [ENTRY]
    assert world["executed"] == [], "never execute for a WisKey door"
    refused = [x for x in rows(db, "intercom.release") if x["details"].get("phase") == "refused"]
    assert [x["reason"] for x in refused] == ["intercom_lock_unmapped", "confirmation_required"], "every refusal is one audited row"
    attempt, outcome = [x for x in rows(db, "intercom.release") if x["details"].get("phase") in ("attempt", "outcome")]
    assert attempt["details"]["entry_point"] == "devices_tile" and attempt["resource_id"] == "lock.entrance" and outcome["details"]["outcome"] == "ok"
    # who may: viewer / operator without a door grant are refused; an operator's ha.entity.control is not enough
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    for user in ("otto", "vera", "nobody"):
        r = tile(c, "lock.side", user)
        assert r.status_code == 403, (user, r.text)
    assert len(feed.sent) == 1
    # the read side agrees: the entity's unlock action and the devices panel's can_unlock follow the door rule
    acts = {x["id"]: x["granted"] for x in c.get(f"{API}/ha/entities/lock.entrance", headers=as_user("otto")).json()["actions"]}
    assert acts["lock.unlock"] is False
    # an ordinary lock: unchanged (execute, ha.entity.control + door.unlock)
    opener = custom_role(c, "פותח", ["door.unlock"])
    bind(c, s, "otto", opener, "installation", "*")
    r = tile(c, "lock.office", "otto")
    assert r.status_code == 202 and r.json()["via"] == "bridge", r.text
    assert len(world["executed"]) == 1 and world["executed"][0]["service"] == "unlock"


def test_d4_tile_outcomes_unknown_and_refused_are_recorded(world):
    c, s, feed = world["c"], world["settings"], world["feed"]
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")
    feed.outcome = "unknown"
    r = tile(c, "lock.entrance", "dana")
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"
    r2 = tile(c, "lock.entrance", "dana")
    assert r2.status_code == 409 and r2.json()["code"] == "intercom_release_in_progress", "the relay is held after an unknown outcome"
    feed.outcome = "refused"
    r = tile(c, "lock.side", "dana")
    assert r.status_code == 409 and r.json()["details"]["outcome"] == "refused"
    with Database(s.db_path).connection(mode="read") as conn:
        got = {row["entity_id"]: row["status"] for row in conn.execute("SELECT entity_id, status FROM ha_actions").fetchall()}
    assert got == {"lock.entrance": "unknown", "lock.side": "failed"}
    assert len(feed.sent) == 2, "never retried"


@pytest.fixture()
def signed(world, monkeypatch):
    """The signed mode: a bridge version that offers door_open (patched - none exists in this release) and the flag on."""
    c = world["c"]
    monkeypatch.setattr(trusted_door, "MIN_BRIDGE_FOR_TRUSTED_PATH", "0.9.0")
    bridge = FakeTrustedBridge({ENTRY: [1], SIDE: [1], DOCK: [1, 2]}).install(monkeypatch)
    r = c.put(f"{API}/doors/settings", json={"trusted_path": "on", "confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "trusted_path_unavailable", "no bridge version known yet"
    with world["db"].connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.9.0")
    r = c.put(f"{API}/doors/settings", json={"trusted_path": "on", "confirmed": True})
    assert r.status_code == 200 and r.json()["trusted_path"] == "on", r.text
    map_all(c)
    bind(c, world["settings"], "dana", "door_opener", "installation", "*")
    return bridge


def test_d4_trusted_path_cannot_be_switched_on_in_this_release(world):
    c = world["c"]
    got = c.get(f"{API}/doors/settings").json()
    assert (got["trusted_path"], got["trusted_path_available"]) == ("off", False)
    r = c.put(f"{API}/doors/settings", json={"trusted_path": "on", "confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "trusted_path_unavailable"
    assert c.put(f"{API}/doors/settings", json={"trusted_path": "off"}).json()["code"] == "confirmation_required"
    assert c.get(f"{API}/doors/settings", headers=as_user("nobody")).status_code == 403
    with world["db"].connection() as conn:
        set_setting(conn, trusted_door.FLAG_KEY, "yes please")
        assert trusted_door.mode(conn) == "off", "anything but exactly `on` is off"


def test_d4_signed_open_carries_the_real_actor_and_only_a_body_hash(world, signed):
    """T1 / T7: one door_open per open, the principal as actor, the station's config entry id and the relay; the audit has
    the request id and the SHA-256 of the exact bytes sent - never the signature, the nonce, the key or the body."""
    c, db, feed = world["c"], world["db"], world["feed"]
    r = c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(confirmed=True), headers=as_user("dana"))
    assert r.status_code == 200, r.text
    r2 = tile(c, "lock.side", "dana")
    assert r2.status_code == 202 and r2.json()["confirmation"] == "none", r2.text
    assert feed.sent == [] and world["executed"] == [], "flag on: the signed door_open is the only transport"
    opens = signed.opens()
    assert [(o["message"]["actor"]["id"], o["message"]["station"], o["message"]["params"]) for o in opens] == [("dev-dana", ENTRY, {"relay": 1}), ("dev-dana", SIDE, {"relay": 1})]
    audit = rows(db, "intercom.release")
    attempts = [a for a in audit if a["details"].get("phase") == "attempt"]
    assert [a["details"]["door_request_id"] for a in attempts] == [o["message"]["request_id"] for o in opens]
    assert [a["details"]["body_sha256"] for a in attempts] == [hashlib.sha256(o["text"].encode("utf-8")).hexdigest() for o in opens]
    with db.connection(mode="read") as conn:
        everything = "\n".join(str(tuple(r)) for r in conn.execute("SELECT * FROM audit_log").fetchall())
    for o in opens:
        assert o["message"]["sig"] not in everything and o["message"]["nonce"] not in everything and o["text"] not in everything
    assert TEST_SECRET not in everything


def test_d4_signed_refusal_unknown_and_status(world, signed):
    """T2 / T4 / T5 / T8: a refusal is `refused` (nothing happened); a timeout after a possible delivery is `unknown`, the
    relay is held, nothing is re-sent; the read-only status answers from the bridge's store; the open is never signed
    twice."""
    c, db = world["c"], world["db"]
    signed.capability = "revoked"
    r = c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(confirmed=True), headers=as_user("dana"))
    assert r.status_code == 409 and r.json()["code"] == "door_refused" and r.json()["details"]["outcome"] == "refused"
    assert rows(db, "intercom.release")[-1]["details"]["code"] == "state/capability_revoked"
    signed.capability = "valid"
    signed.timeout_after_delivery = True
    r = c.post(f"{API}/intercom/stations/{SIDE}/release", json=env(confirmed=True), headers=as_user("dana"))
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown", r.text
    door_request_id = r.json()["details"]["door_request_id"]
    signed.timeout_after_delivery = False
    r = c.post(f"{API}/intercom/stations/{SIDE}/release", json=env(confirmed=True), headers=as_user("dana"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_release_in_progress"
    assert len(signed.opens()) == 2, "the unknown open was not retried"
    st = c.post(f"{API}/doors/requests/{door_request_id}/status", headers=as_user("dana"))
    assert st.status_code == 200 and st.json()["outcome"] == "sent" and st.json()["code"] == "stored_result", st.text
    assert len(signed.opens()) == 2 and len(signed.statuses()) == 1, "status is a read: no second door_open"
    bind(c, world["settings"], "eve", "door_opener", "installation", "*")
    assert c.post(f"{API}/doors/requests/{door_request_id}/status", headers=as_user("eve")).status_code == 403, "another person's open"
    # unreachable bridge: not sent
    signed.unreachable = True
    r = c.post(f"{API}/intercom/stations/{DOCK}/release", json=env(confirmed=True, lock=1), headers=as_user("dana"))
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "not_sent"


def test_d4_refusals_before_signing_send_nothing(world, signed):
    """T2 / T11: no permission, kiosk, viewer, no confirmation, expired, duplicate, unknown relay: zero bridge calls."""
    c, s = world["c"], world["settings"]
    bind(c, s, "wall", "kiosk", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    for user in ("wall", "vera", "nobody"):
        assert c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(confirmed=True), headers=as_user(user)).status_code == 403
        assert tile(c, "lock.entrance", user).status_code == 403
    assert c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(), headers=as_user("dana")).json()["code"] == "confirmation_required"
    assert c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(ttl=-5, confirmed=True), headers=as_user("dana")).json()["code"] == "expired"
    assert c.post(f"{API}/intercom/stations/{DOCK}/release", json=env(confirmed=True, lock=7), headers=as_user("dana")).json()["code"] == "intercom_lock_unknown"
    body = env(confirmed=True)
    assert c.post(f"{API}/intercom/stations/{ENTRY}/release", json=body, headers=as_user("dana")).status_code == 200
    assert c.post(f"{API}/intercom/stations/{ENTRY}/release", json=body, headers=as_user("dana")).json()["code"] == "intercom_duplicate_command"
    assert len(signed.calls) == 1, "only the one allowed, confirmed, fresh request reached the bridge"


def test_d4_no_other_module_signs_a_door_open():
    """One authority, one signer: only services/trusted_door.py builds the DTO and only routers/access_control.py and
    routers/doors.py call it; the routes that open a WisKey door call door_authority.check."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "smplwise"
    signers = sorted(str(p.relative_to(root)).replace("\\", "/") for p in root.rglob("*.py") if "sign_message(" in p.read_text(encoding="utf-8"))
    assert signers == ["routers/access_control.py", "routers/doors.py", "services/trusted_door.py"]
    assert sorted(str(p.relative_to(root)).replace("\\", "/") for p in root.rglob("*.py") if "wiskey-trusted-door-v1" in p.read_text(encoding="utf-8")) == ["services/trusted_door.py"]
    ac = (root / "routers" / "access_control.py").read_text(encoding="utf-8")
    assert ac.count("door_authority.check(") == 2 and "open_from_tile" in (root / "routers" / "ha.py").read_text(encoding="utf-8")


def test_d4_backup_never_carries_the_door_flag_but_keeps_the_door_tables(world):
    """CR-033 section 9: a restore can never loosen the door settings - `doors.*` never leaves in an archive and a replace
    restore keeps the installation's own value; the placement, the door map and the card's own bindings travel with the
    access tables."""
    from smplwise.services import backup

    c, db = world["c"], world["db"]
    map_all(c)
    with db.connection() as conn:
        set_setting(conn, trusted_door.FLAG_KEY, "on")
        snap = backup.snapshot(conn)
    assert all(not str(r["key"]).startswith("doors.") for r in snap["settings"])
    assert sorted(r["entity_id"] for r in snap["intercom_door_map"]) == ["lock.dock_gate", "lock.entrance", "lock.side"]
    assert {"intercom_station_placement", "door_grant_bindings"} <= set(snap)