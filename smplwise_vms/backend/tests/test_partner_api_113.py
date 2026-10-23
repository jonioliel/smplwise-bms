"""PARTNERAPI113-295 (docs/changes/CR-PARTNERAPI113.md; owner answers 164-172): scoped partner tokens, the /p/v1 read API and signed
outgoing webhooks - against fakes only (a fake resolver, httpx.MockTransport). Nothing here resolves a real name or contacts a partner.

Security coverage (a public surface): scope escape, restriction escape (no existence oracle), credential separation, replay
(idempotency + signature timestamps), SSRF matrix incl. DNS rebinding and redirects, token / secret / URL leak scan of tables, audit,
logs and answers, the guard-first 404, the go-live block and the failure / per-token limits."""
from __future__ import annotations

import base64
import json
import logging

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import backup
from smplwise.services.partner import core, ssrf, webhooks
from smplwise.services.partner.api_app import NOT_FOUND, UNAUTHORIZED, PartnerApp

API = "/api/v1/partners"
PUBLIC_IP = "93.184.216.34"
PRIVATE_IP = "10.1.2.3"
DNS = {"hooks.partner.example": [PUBLIC_IP], "other.partner.example": ["93.184.216.35"], "rebind.partner.example": [PUBLIC_IP]}


def _resolve(host: str) -> list[str]:
    return list(DNS.get(host, []))


@pytest.fixture()
def world(settings, monkeypatch):
    monkeypatch.setattr(core, "GO_LIVE_PERMITTED", True)
    monkeypatch.setattr(ssrf, "RESOLVE", _resolve)
    monkeypatch.setattr(ssrf, "HOSTNAME", lambda: "arx-test-host")
    monkeypatch.setattr(ssrf, "LOCAL_ADDRESSES", lambda: {"192.168.1.10"})
    monkeypatch.setattr(webhooks, "TRANSPORT", None)
    DNS["rebind.partner.example"] = [PUBLIC_IP]
    core.USAGE._pending.clear()
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    db = Database(settings.db_path)
    with db.connection() as conn:
        set_setting(conn, "tickets.enabled", "true")
        dept = conn.execute("SELECT id FROM ticket_departments ORDER BY sort_order LIMIT 1").fetchone()[0]
    tree = seed_tree(c)
    r = c.put(f"{API}/settings", json={"api": True, "webhooks": True})
    assert r.status_code == 200, r.text
    papp = PartnerApp(db)
    yield {"c": c, "db": db, "settings": settings, "dept": dept, "tree": tree, "papp": papp, "p": TestClient(papp, base_url="https://partner.test")}


def _client(w, label="Contractor X CAFM") -> str:
    r = w["c"].post(f"{API}/clients", json={"label": label})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _token(w, client_id: str, **body) -> dict:
    body.setdefault("scopes", ["tickets.read", "tickets.create", "temperature.read", "elevators.read"])
    if any(s.startswith("tickets.") for s in body["scopes"]):
        body.setdefault("departments", [w["dept"]])
    r = w["c"].post(f"{API}/clients/{client_id}/tokens", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _h(token: str, **extra) -> dict:
    return {"Authorization": f"Bearer {token}", **extra}


def _create(w, token: str, key: str, **body) -> httpx.Response:
    body.setdefault("department_id", w["dept"])
    body.setdefault("title", "Leaking pipe in the lobby")
    return w["p"].post("/p/v1/tickets", json=body, headers=_h(token, **{"Idempotency-Key": key}))


def _all_text(db: Database) -> str:
    """Every value of every table plus the audit log, as one string (the secret scan)."""
    out = []
    with db.connection(mode="read") as conn:
        for (t,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall():
            for row in conn.execute(f"SELECT * FROM {t}").fetchall():
                out.append(" ".join(str(v) for v in tuple(row)))
    return "\n".join(out)


# ================================================================ permission, switches, go-live

def test_permission_is_registered_like_the_other_system_permissions(world):
    from smplwise.rbac import LOCAL_ADMIN_PERMISSIONS, ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE, SYSTEM_PERMISSIONS

    perm = "partner.manage"
    assert [r for r, perms in ROLES.items() if perm in perms] == ["system_admin"]
    assert perm in SENSITIVE and perm in SYSTEM_PERMISSIONS and perm in LOCAL_ADMIN_PERMISSIONS and PERMISSION_LABELS[perm]
    for body in ({"permissions": ["map.read", perm]}, {"permissions": ["map.read"], "sensitive": [perm]}):
        r = world["c"].post("/api/v1/access/roles", json={"name": "מנהל שותפים", **body})
        assert r.status_code == 422, r.text


def test_management_needs_the_permission_and_a_system_administrator(world, settings):
    c = world["c"]
    with world["db"].connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('cfg_x', 'cfg_x', ?, ?, ?)",
                     (json.dumps(["system.configure"]), now_iso(), now_iso()))
    bind(c, settings, "cfgu", "cfg_x", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    for user in ("cfgu", "vera"):
        for method, path, body in (("GET", f"{API}/settings", None), ("POST", f"{API}/clients", {"label": "x"}), ("GET", f"{API}/tokens", None)):
            r = c.request(method, path, json=body, headers=as_user(user))
            assert r.status_code == 403, (user, path, r.text)
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM partner_clients").fetchone()[0] == 0


def test_switch_on_refused_without_the_go_live_permit_and_everything_404_while_off(world, monkeypatch):
    c = world["c"]
    assert c.put(f"{API}/settings", json={"api": False, "webhooks": False}).status_code == 200  # OFF always works (kill switch)
    monkeypatch.setattr(core, "GO_LIVE_PERMITTED", False)
    r = c.put(f"{API}/settings", json={"api": True})
    assert r.status_code == 409 and r.json()["code"] == "go_live_not_permitted"
    v = c.get(f"{API}/settings").json()
    assert v["api"] is False and v["go_live_permitted"] is False and v["allowed_ports"] == [9443, 9453]
    for path in (f"{API}/clients", f"{API}/tokens", f"{API}/endpoints", f"{API}/deliveries"):
        assert c.get(path).status_code == 404
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'partner.feature_enabled' AND decision = 'denied'").fetchone()[0] == 1
    # a stored "on" from an older permit never counts while the permit is absent (fail closed)
    with world["db"].connection() as conn:
        set_setting(conn, core.API_KEY, "on")
        assert core.switch_on(conn, core.API_KEY) is False


def test_settings_values_are_editable_within_range(world):
    c = world["c"]
    r = c.put(f"{API}/settings", json={"values": {"token_default_days": 30, "max_endpoints": 3}})
    assert r.status_code == 200 and r.json()["values"]["token_default_days"] == 30 and r.json()["values"]["max_endpoints"] == 3
    assert c.put(f"{API}/settings", json={"values": {"token_max_days": 400}}).status_code == 422
    assert c.put(f"{API}/settings", json={"values": {"token_max_days": 20}}).status_code == 422  # below the default
    assert c.put(f"{API}/settings", json={"values": {"no_such": 1}}).status_code == 422


# ================================================================ tokens

def test_token_format_hash_at_rest_shown_once_and_expiry(world):
    cid = _client(world)
    t = _token(world, cid)
    assert core.TOKEN_RE.fullmatch(t["token"]) and t["id"].startswith("ptk_") and t["last4"] == t["token"][-4:]
    exp = core.parse_iso(t["expires_at"]) - core.parse_iso(t["created_at"])
    assert 89 <= exp.days <= 90  # default 90 days (owner answer 169)
    listed = world["c"].get(f"{API}/tokens").json()["items"]
    assert listed and all("token" not in x and "token_hash" not in x for x in listed)
    text = _all_text(world["db"])
    assert t["token"] not in text and core.token_hash(t["token"]) in text  # only the hash is stored
    r = world["c"].post(f"{API}/clients/{cid}/tokens", json={"scopes": ["elevators.read"], "expires_days": 366})
    assert r.status_code == 422 and r.json()["code"] == "out_of_range"


@pytest.mark.parametrize("scope", [*core.NEVER_SCOPES, *core.RESERVED_SCOPES, "tickets.READ", " tickets.read"])
def test_no_scope_outside_the_closed_list(world, scope):
    cid = _client(world)
    r = world["c"].post(f"{API}/clients/{cid}/tokens", json={"scopes": ["elevators.read", scope]})
    assert r.status_code == 422 and r.json()["code"] in ("unknown_scope", "invalid"), r.text


def test_no_door_or_device_control_scope_exists():
    assert set(core.SCOPES) == {"tickets.read", "tickets.create", "temperature.read", "elevators.read"}
    assert not any(s.startswith(("door", "access", "alarm", "devices.control", "scene", "script", "automation", "camera", "video")) for s in core.SCOPES)


def test_tickets_create_needs_departments_and_creator_must_hold_the_permission(world, settings):
    cid = _client(world)
    r = world["c"].post(f"{API}/clients/{cid}/tokens", json={"scopes": ["tickets.create"]})
    assert r.status_code == 422 and r.json()["code"] == "departments_required"
    r = world["c"].post(f"{API}/clients/{cid}/tokens", json={"scopes": ["elevators.read"], "restriction_kind": "floor", "restriction_ids": ["nope"]})
    assert r.status_code == 422


def test_rotation_overlap_and_revoke(world):
    cid = _client(world)
    t = _token(world, cid, scopes=["elevators.read"])
    r = world["c"].post(f"{API}/tokens/{t['id']}/rotate", json={"overlap_hours": 0})
    assert r.status_code == 200, r.text
    succ = r.json()
    assert succ["token"] != t["token"] and succ["predecessor_id"] == t["id"]
    p = world["p"]
    assert p.get("/p/v1/whoami", headers=_h(t["token"])).content == UNAUTHORIZED
    assert p.get("/p/v1/whoami", headers=_h(succ["token"])).status_code == 200
    assert world["c"].post(f"{API}/tokens/{succ['id']}/revoke").json()["state"] == "revoked"
    assert p.get("/p/v1/whoami", headers=_h(succ["token"])).content == UNAUTHORIZED


# ================================================================ the /p/v1 surface

def test_guard_first_404_while_off_before_any_lookup_or_body(world):
    cid = _client(world)
    t = _token(world, cid)
    world["c"].put(f"{API}/settings", json={"api": False})
    world["papp"].set_switch(False)
    p = world["p"]
    for method, path in (("GET", "/p/v1/whoami"), ("POST", "/p/v1/tickets"), ("GET", "/p/v1/nothing")):
        r = p.request(method, path, headers=_h(t["token"]), content=b"x" * 100)
        assert r.status_code == 404 and r.content == NOT_FOUND
    assert r.headers["cache-control"] == "no-store" and "set-cookie" not in r.headers and "access-control-allow-origin" not in r.headers


def test_unknown_path_and_method_answer_the_same_404(world):
    cid = _client(world)
    t = _token(world, cid)
    p = world["p"]
    for method, path in (("GET", "/p/v1/doors"), ("DELETE", "/p/v1/tickets"), ("GET", "/p/v2/whoami"), ("PUT", "/p/v1/whoami")):
        r = p.request(method, path, headers=_h(t["token"]))
        assert r.status_code == 404 and r.content == NOT_FOUND


def test_every_unusable_credential_answers_the_same_401(world, monkeypatch):
    cid = _client(world)
    good = _token(world, cid, scopes=["elevators.read"])
    revoked = _token(world, cid, scopes=["elevators.read"])
    world["c"].post(f"{API}/tokens/{revoked['id']}/revoke")
    expired = _token(world, cid, scopes=["elevators.read"])
    cidr = _token(world, cid, scopes=["elevators.read"], source_cidrs=["203.0.113.0/24"])
    other_box = _token(world, cid, scopes=["elevators.read"])
    with world["db"].connection() as conn:
        conn.execute("UPDATE partner_tokens SET expires_at = '2000-01-01T00:00:00Z' WHERE id = ?", (expired["id"],))
        conn.execute("UPDATE partner_tokens SET installation_id = 'another-installation' WHERE id = ?", (other_box["id"],))
    p = world["p"]
    bad = [
        {"Authorization": "Bearer arxp_" + "A" * 43},  # unknown
        _h(revoked["token"]), _h(expired["token"]), _h(cidr["token"]), _h(other_box["token"]),
        {"Authorization": good["token"]},  # no scheme
        {"Authorization": "Basic " + base64.b64encode(b"a:b").decode()},
        {"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.e30.x"},  # an HA access token's shape
        {**_h(good["token"]), "Cookie": "__Secure-arx_session=abc"},  # a session cookie is refused with any token
        {},
    ]
    for headers in bad:
        r = p.get("/p/v1/whoami", headers=headers)
        assert r.status_code == 401 and r.content == UNAUTHORIZED, headers
    r = p.get(f"/p/v1/whoami?token={good['token']}")
    assert r.status_code == 401 and r.content == UNAUTHORIZED  # never a token in the query string
    r = p.get(f"/p/v1/whoami?x={good['token']}", headers=_h(good["token"]))
    assert r.status_code == 401
    assert p.get("/p/v1/whoami", headers=_h(good["token"])).status_code == 200
    with world["db"].connection(mode="read") as conn:
        reasons = {r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE action = 'partner.token.denied'").fetchall()}
    assert {"installation_mismatch", "source_address"} <= reasons


def test_partner_tokens_are_not_credentials_of_the_main_api(world, settings, monkeypatch):
    """T9: `arxp_` is never a principal on /api/v1 - with the developer identity switched off, the main API refuses it."""
    cid = _client(world)
    t = _token(world, cid)
    import dataclasses

    s2 = dataclasses.replace(settings, dev_user=None)
    c2 = TestClient(create_app(s2))
    r = c2.get("/api/v1/me", headers=_h(t["token"]))
    assert r.status_code in (401, 403), r.text


def test_scope_escape_is_refused_and_audited(world):
    cid = _client(world)
    t = _token(world, cid, scopes=["elevators.read"])
    p = world["p"]
    for method, path in (("GET", "/p/v1/tickets"), ("GET", "/p/v1/temperature/units"), ("GET", "/p/v1/tickets/x")):
        r = p.request(method, path, headers=_h(t["token"]))
        assert r.status_code == 403 and r.json() == {"code": "forbidden_scope"}
    r = _create(world, t["token"], "key-00000001")
    assert r.status_code == 403
    assert p.get("/p/v1/elevators", headers=_h(t["token"])).status_code == 200
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'partner.token.denied' AND reason = 'forbidden_scope'").fetchone()[0] == 4
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 0


def test_tickets_module_off_answers_404(world):
    cid = _client(world)
    t = _token(world, cid)
    with world["db"].connection() as conn:
        set_setting(conn, "tickets.enabled", "false")
    assert world["p"].get("/p/v1/tickets", headers=_h(t["token"])).content == NOT_FOUND
    assert _create(world, t["token"], "key-00000002").content == NOT_FOUND


def test_create_and_read_with_restriction_and_no_existence_oracle(world):
    tree = world["tree"]
    cid = _client(world)
    wide = _token(world, cid)
    f2 = _token(world, cid, restriction_kind="floor", restriction_ids=[tree["floor2"]])
    r = _create(world, wide["token"], "key-wide-0001", floor_id=tree["floor3"], external_ref="WO-1")
    assert r.status_code == 201, r.text
    on3 = r.json()
    assert on3["origin"] == "partner" and on3["own"] is True and on3["external_ref"] == "WO-1" and on3["title"] == "Leaking pipe in the lobby"
    r = _create(world, f2["token"], "key-f2-000001", floor_id=tree["floor2"])
    assert r.status_code == 201, r.text
    on2 = r.json()
    p = world["p"]
    assert p.get(f"/p/v1/tickets/{on3['id']}", headers=_h(f2["token"])).content == NOT_FOUND
    assert p.get("/p/v1/tickets/does-not-exist", headers=_h(f2["token"])).content == NOT_FOUND
    assert p.get(f"/p/v1/tickets/{on2['id']}", headers=_h(f2["token"])).status_code == 200
    ids = [x["id"] for x in p.get("/p/v1/tickets", headers=_h(f2["token"])).json()["items"]]
    assert ids == [on2["id"]]
    assert {x["id"] for x in p.get("/p/v1/tickets", headers=_h(wide["token"])).json()["items"]} == {on2["id"], on3["id"]}
    # a restricted token cannot place a request outside its restriction, and must place it
    assert _create(world, f2["token"], "key-f2-000002", floor_id=tree["floor3"]).status_code == 422
    assert _create(world, f2["token"], "key-f2-000003").status_code == 422
    # the request is on the board like any other: the normal notification source, origin inbound, author partner:<ptk>
    with world["db"].connection(mode="read") as conn:
        row = conn.execute("SELECT origin, created_by FROM tickets WHERE id = ?", (on3["id"],)).fetchone()
        assert row["origin"] == "inbound" and row["created_by"] == f"partner:{wide['id']}"
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'partner.ticket.created'").fetchone()[0] == 2


def test_departments_bound_the_token(world):
    cid = _client(world)
    t = _token(world, cid)
    with world["db"].connection() as conn:
        conn.execute("INSERT INTO ticket_departments (id, key, name, created_at, updated_at) VALUES ('dep_other', 'other', 'Other', ?, ?)", (now_iso(), now_iso()))
    r = _create(world, t["token"], "key-dept-0001", department_id="dep_other")
    assert r.status_code == 422 and r.json()["fields"][0]["field"] == "department_id"


def test_idempotency_replay_and_reuse(world):
    cid = _client(world)
    t = _token(world, cid)
    a = _create(world, t["token"], "key-idem-0001")
    b = _create(world, t["token"], "key-idem-0001")
    assert a.status_code == b.status_code == 201 and a.json() == b.json()
    c = _create(world, t["token"], "key-idem-0001", title="Something else")
    assert c.status_code == 409 and c.json() == {"code": "request_id_reused"}
    assert world["p"].post("/p/v1/tickets", json={"department_id": world["dept"], "title": "x"}, headers=_h(t["token"])).status_code == 422
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 1


def test_strict_body_rules(world):
    cid = _client(world)
    t = _token(world, cid)
    p = world["p"]
    h = _h(t["token"], **{"Idempotency-Key": "key-body-0001"})
    assert p.post("/p/v1/tickets", content=b"{}", headers={**h, "Content-Type": "text/plain"}).status_code == 415
    assert p.post("/p/v1/tickets", content=b'{"a":1,"a":2}', headers={**h, "Content-Type": "application/json"}).status_code == 422
    assert p.post("/p/v1/tickets", json={"department_id": world["dept"], "title": "x", "assignee": "me"}, headers=h).status_code == 422
    big = {"department_id": world["dept"], "title": "x", "description": "y" * 20000}
    assert p.post("/p/v1/tickets", json=big, headers=h).status_code == 413
    assert p.request("GET", "/p/v1/whoami", content=b"body", headers=_h(t["token"])).status_code == 413


def test_text_by_default_people_only_by_opt_in(world, settings):
    cid = _client(world)
    plain = _token(world, cid)
    people = _token(world, cid, personal={"ticket_people": True})
    notext = _token(world, cid, personal={"ticket_text": False})
    r = _create(world, plain["token"], "key-text-0001", description="pipe near the door")
    assert r.status_code == 201
    one = world["p"].get(f"/p/v1/tickets/{r.json()['id']}", headers=_h(plain["token"])).json()
    assert one["title"] and one["description"] == "pipe near the door" and "requester_name" not in one and "assignee_name" not in one
    assert "requester_name" in world["p"].get(f"/p/v1/tickets/{r.json()['id']}", headers=_h(people["token"])).json()
    hidden = world["p"].get(f"/p/v1/tickets/{r.json()['id']}", headers=_h(notext["token"])).json()
    assert "title" not in hidden and "description" not in hidden
    r = _create(world, notext["token"], "key-text-0002")
    assert r.status_code == 422 and r.json()["fields"][0]["field"] == "title"  # free text refused without the option
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'partner.token.personal_data'").fetchone()[0] == 2


def test_per_token_rate_limit_and_the_failure_window(world):
    cid = _client(world)
    t = _token(world, cid, scopes=["elevators.read"], rate_per_min=2)
    p = world["p"]
    assert p.get("/p/v1/elevators", headers=_h(t["token"])).status_code == 200
    assert p.get("/p/v1/elevators", headers=_h(t["token"])).status_code == 200
    r = p.get("/p/v1/elevators", headers=_h(t["token"]))
    assert r.status_code == 429 and int(r.headers["retry-after"]) >= 1 and r.json()["code"] == "rate_limited"
    fresh = TestClient(PartnerApp(world["db"]), base_url="https://partner.test")
    for _ in range(20):
        assert fresh.get("/p/v1/whoami", headers={"Authorization": "Bearer arxp_" + "B" * 43}).status_code == 401
    r = fresh.get("/p/v1/whoami", headers=_h(t["token"]))
    assert r.status_code == 429  # the address's failure window refuses before any lookup


def test_temperature_and_elevators_never_carry_entity_ids(world):
    with world["db"].connection() as conn:
        conn.execute("""INSERT INTO infra_temp_units (id, name, name_key, temp_entity_id, low, high, created_at, updated_at)
                        VALUES ('u1', 'Cold room 1', 'cold room 1', 'sensor.secret_cold_room_probe', 2, 6, ?, ?)""", (now_iso(), now_iso()))
        conn.execute("INSERT INTO infra_elevators (id, name, name_key, created_at, updated_at) VALUES ('e1', 'Lift A', 'lift a', ?, ?)", (now_iso(), now_iso()))
        conn.execute("INSERT INTO infra_elevator_sensors (elevator_id, role, position, entity_id) VALUES ('e1', 'fault', 0, 'binary_sensor.secret_lift_fault')")
    cid = _client(world)
    wide = _token(world, cid, scopes=["temperature.read", "elevators.read"])
    floor = _token(world, cid, scopes=["temperature.read", "elevators.read"], restriction_kind="floor", restriction_ids=[world["tree"]["floor2"]])
    p = world["p"]
    temp = p.get("/p/v1/temperature/units", headers=_h(wide["token"]))
    lifts = p.get("/p/v1/elevators", headers=_h(wide["token"]))
    assert [u["name"] for u in temp.json()["items"]] == ["Cold room 1"] and [e["name"] for e in lifts.json()["items"]] == ["Lift A"]
    assert "secret_" not in temp.text and "secret_" not in lifts.text and "sensor." not in temp.text
    # an unplaced sensor is outside every floor restriction
    assert p.get("/p/v1/temperature/units", headers=_h(floor["token"])).json()["items"] == []
    assert p.get("/p/v1/elevators", headers=_h(floor["token"])).json()["items"] == []


# ================================================================ SSRF

@pytest.mark.parametrize("url,code", [
    ("http://hooks.partner.example:9443/x", "scheme"),
    ("https://hooks.partner.example/x", "port"),
    ("https://hooks.partner.example:443/x", "port"),
    ("https://hooks.partner.example:8443/x", "port"),
    ("https://user:pw@hooks.partner.example:9443/x", "syntax"),
    ("https://hooks.partner.example:9443/x#frag", "syntax"),
    ("https://hooks.partner.example:9443/a b", "syntax"),
    ("https://2130706433:9443/", "syntax"),
    ("https://0177.0.0.1:9443/", "syntax"),
    ("https://0x7f.0.0.1:9443/", "syntax"),
    ("https://127.1:9443/", "syntax"),
    ("https://localhost:9443/", "refused_name"),
    ("https://supervisor:9443/", "refused_name"),
    ("https://homeassistant.local:9443/", "refused_name"),
    ("https://printer.lan:9443/", "refused_name"),
    ("https://x.internal:9443/", "refused_name"),
    ("https://arx-test-host:9443/", "refused_name"),
    ("https://metadata.google.internal:9443/", "refused_name"),
])
def test_ssrf_syntax_and_names(url, code, monkeypatch):
    monkeypatch.setattr(ssrf, "HOSTNAME", lambda: "arx-test-host")
    with pytest.raises(ssrf.Refused) as exc:
        ssrf.parse(url)
    assert exc.value.code == code


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "100.100.100.200",
                                "0.0.0.0", "224.0.0.1", "198.18.0.1", "192.0.2.1", "172.30.32.2", "::1", "::", "fe80::1", "fc00::1", "fd00:ec2::254",
                                "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2",
                                "2001:db8::1", "ff02::1", "192.168.1.10"])
def test_ssrf_refused_addresses(ip, monkeypatch):
    monkeypatch.setattr(ssrf, "RESOLVE", lambda h: [ip])
    monkeypatch.setattr(ssrf, "HOSTNAME", lambda: "arx-test-host")
    monkeypatch.setattr(ssrf, "LOCAL_ADDRESSES", lambda: {"192.168.1.10"})
    with pytest.raises(ssrf.Refused) as exc:
        ssrf.validate("https://hooks.partner.example:9443/x")
    assert exc.value.code == "refused_address"


def test_ssrf_any_private_answer_refuses_and_a_public_target_passes(monkeypatch):
    monkeypatch.setattr(ssrf, "HOSTNAME", lambda: "arx-test-host")
    monkeypatch.setattr(ssrf, "RESOLVE", lambda h: [PUBLIC_IP, "10.0.0.1"] if h == "hooks.partner.example" else [])
    with pytest.raises(ssrf.Refused):
        ssrf.validate("https://hooks.partner.example:9453/x")
    monkeypatch.setattr(ssrf, "RESOLVE", lambda h: [PUBLIC_IP] if h == "hooks.partner.example" else [])  # this host's own name resolves to nothing
    target, ip = ssrf.validate("https://Hooks.Partner.Example.:9453/in?x=1")
    assert ip == PUBLIC_IP and target.host == "hooks.partner.example" and target.path == "/in?x=1" and target.host_header == "hooks.partner.example:9453"
    monkeypatch.setattr(ssrf, "RESOLVE", lambda h: [])
    with pytest.raises(ssrf.Refused) as exc:
        ssrf.validate("https://hooks.partner.example:9453/x")
    assert exc.value.code == "dns"


def test_endpoint_url_refused_and_audited_with_host_only(world):
    cid = _client(world)
    r = world["c"].post(f"{API}/clients/{cid}/endpoints", json={"url": "https://intranet.partner.example:9443/secret-path", "events": ["ticket.created"]})
    assert r.status_code == 422 and r.json()["code"] == "url_refused"
    DNS["intranet.partner.example"] = [PRIVATE_IP]
    r = world["c"].post(f"{API}/clients/{cid}/endpoints", json={"url": "https://intranet.partner.example:9443/secret-path", "events": ["ticket.created"]})
    assert r.status_code == 422
    with world["db"].connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'partner.endpoint.refused_address'").fetchall()
    assert len(rows) == 2 and all("secret-path" not in (r[0] or "") for r in rows)
    del DNS["intranet.partner.example"]


@pytest.mark.parametrize("event", ["security.new_signin", "access.door", "door.open", "alarm.triggered", "sensor.leak", "sensor.smoke", "camera.motion", "nope"])
def test_excluded_events_are_refused(world, event):
    cid = _client(world)
    r = world["c"].post(f"{API}/clients/{cid}/endpoints", json={"url": "https://hooks.partner.example:9443/in", "events": [event]})
    assert r.status_code == 422 and r.json()["code"] == "unknown_event"


# ================================================================ signing

def test_signature_vectors_and_rotation_overlap():
    secret = "whsec_" + base64.b64encode(bytes(range(32))).decode()
    body = b'{"event_id":"evt_0123456789abcdef","type":"endpoint.ping"}'
    sig = webhooks.sign(secret, "evt_0123456789abcdef", 1761200000, body)
    import hashlib
    import hmac

    want = base64.b64encode(hmac.new(bytes(range(32)), b"evt_0123456789abcdef.1761200000." + body, hashlib.sha256).digest()).decode()
    assert sig == "v1," + want
    assert webhooks.verify(secret, "evt_0123456789abcdef", 1761200000, body, sig, now=1761200100)
    assert not webhooks.verify(secret, "evt_0123456789abcdef", 1761200000, body, sig, now=1761200000 + 301)  # replay window
    assert not webhooks.verify(secret, "evt_0123456789abcdef", 1761200000, body + b" ", sig, now=1761200000)
    other = webhooks.new_secret()
    both = webhooks.signature_header([other, secret], "evt_0123456789abcdef", 1761200000, body)
    assert len(both.split(" ")) == 2 and webhooks.verify(secret, "evt_0123456789abcdef", 1761200000, body, both, now=1761200000)


# ================================================================ delivery

class Receiver:
    def __init__(self, statuses=(200,), headers=None):
        self.statuses = list(statuses)
        self.headers = headers or {}
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        status = self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]
        return httpx.Response(status, headers=self.headers, content=b"ok" * 5000)


def _endpoint(w, cid, events=("ticket.created",), **extra) -> dict:
    r = w["c"].post(f"{API}/clients/{cid}/endpoints", json={"url": "https://hooks.partner.example:9443/in/arx?k=1", "events": list(events), **extra})
    assert r.status_code == 200, r.text
    return r.json()


def _activate(w, ep: dict, monkeypatch, receiver: Receiver) -> None:
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(receiver))
    r = w["c"].post(f"{API}/endpoints/{ep['id']}/ping")
    assert r.status_code == 200 and r.json()["state"] == "delivered", r.text


def test_ping_activates_and_signs_with_a_fresh_timestamp_and_stable_id(world, monkeypatch):
    cid = _client(world)
    ep = _endpoint(world, cid)
    assert ep["secret"].startswith("whsec_") and ep["state"] == "pending"
    rec = Receiver()
    _activate(world, ep, monkeypatch, rec)
    req = rec.requests[0]
    assert req.url.host == PUBLIC_IP and req.url.port == 9443 and req.headers["host"] == "hooks.partner.example:9443"
    assert req.extensions.get("sni_hostname") == "hooks.partner.example"
    assert webhooks.verify(ep["secret"], req.headers["webhook-id"], int(req.headers["webhook-timestamp"]), req.content, req.headers["webhook-signature"])
    view = [e for e in world["c"].get(f"{API}/endpoints").json()["items"] if e["id"] == ep["id"]][0]
    assert view["state"] == "active" and "secret" not in view and "url" not in view


def test_ticket_created_event_retries_and_loop_guard(world, monkeypatch):
    cid = _client(world, "Partner P")
    other = _client(world, "Partner Q")
    ep_p = _endpoint(world, cid)
    ep_q = _endpoint(world, other)
    rec = Receiver()
    _activate(world, ep_p, monkeypatch, rec)
    _activate(world, ep_q, monkeypatch, rec)
    t = _token(world, cid)
    assert _create(world, t["token"], "key-loop-0001").status_code == 201
    with world["db"].connection(mode="read") as conn:
        rows = conn.execute("SELECT endpoint_id, type, payload_json FROM partner_outbox WHERE type = 'ticket.created'").fetchall()
    assert [r["endpoint_id"] for r in rows] == [ep_q["id"]]  # not echoed to P (owner answer 172), sent to Q
    payload = json.loads(rows[0]["payload_json"])
    assert set(payload) == {"event_id", "type", "occurred_at", "installation", "sequence", "data"}
    assert payload["data"]["origin"] == "partner" and payload["data"]["title"] == "Leaking pipe in the lobby" and "requester_name" not in payload["data"]
    # a failing receiver: 503 is retried with backoff, the id stays, the timestamp is per attempt
    fail = Receiver(statuses=(503,))
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(fail))
    out = webhooks.deliver_due(world["db"], world["settings"])
    assert out["attempted"] == 1
    with world["db"].connection(mode="read") as conn:
        ob = conn.execute("SELECT * FROM partner_outbox WHERE type = 'ticket.created'").fetchone()
        assert ob["state"] == "queued" and ob["attempts"] == 1 and ob["next_at"] > now_iso()
        logrow = conn.execute("SELECT * FROM partner_deliveries WHERE event_id = ?", (ob["id"],)).fetchone()
        assert logrow["http_status"] == 503 and logrow["error_class"] == "http_5xx"
    with world["db"].connection() as conn:
        conn.execute("UPDATE partner_outbox SET next_at = '2000-01-01T00:00:00Z' WHERE id = ?", (ob["id"],))
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(rec))
    webhooks._OUT.clear()
    webhooks.deliver_due(world["db"], world["settings"])
    sent = [r for r in rec.requests if r.headers["webhook-id"] == ob["id"]]
    assert len(sent) == 1 and fail.requests[0].headers["webhook-id"] == ob["id"]
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM partner_outbox WHERE id = ?", (ob["id"],)).fetchone()[0] == "delivered"


@pytest.mark.parametrize("status,state,reason", [(400, "dead", "client_error"), (410, "dead", "gone"), (302, "queued", None), (429, "queued", None)])
def test_answer_classes(world, monkeypatch, status, state, reason):
    cid = _client(world)
    ep = _endpoint(world, cid, events=("ticket.created", "ticket.done"))
    _activate(world, ep, monkeypatch, Receiver())
    other = _client(world, "creator")
    t = _token(world, other)
    assert _create(world, t["token"], f"key-cls-{status}").status_code == 201
    rec = Receiver(statuses=(status,), headers={"location": "https://169.254.169.254/latest", "retry-after": "7200"})
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(rec))
    webhooks._OUT.clear()
    webhooks.deliver_due(world["db"], world["settings"])
    assert len(rec.requests) == 1  # a 3xx is never followed
    with world["db"].connection(mode="read") as conn:
        ob = conn.execute("SELECT * FROM partner_outbox WHERE type = 'ticket.created'").fetchone()
        eps = conn.execute("SELECT state FROM partner_endpoints WHERE id = ?", (ep["id"],)).fetchone()[0]
    assert ob["state"] == state and ob["dead_reason"] == reason
    if status == 410:
        assert eps == "disabled"
    if status == 429:
        delay = (core.parse_iso(ob["next_at"]) - core.utcnow()).total_seconds()
        assert 3500 <= delay <= 3601  # Retry-After honoured, capped at one hour


def test_dns_rebinding_is_refused_at_attempt_time(world, monkeypatch):
    cid = _client(world)
    ep = world["c"].post(f"{API}/clients/{cid}/endpoints", json={"url": "https://rebind.partner.example:9443/in", "events": ["ticket.created"]}).json()
    _activate(world, ep, monkeypatch, Receiver())
    t = _token(world, _client(world, "creator"))
    assert _create(world, t["token"], "key-rebind-01").status_code == 201
    DNS["rebind.partner.example"] = ["127.0.0.1"]
    rec = Receiver()
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(rec))
    webhooks._OUT.clear()
    webhooks.deliver_due(world["db"], world["settings"])
    assert rec.requests == []  # nothing connected
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT error_class FROM partner_deliveries ORDER BY id DESC LIMIT 1").fetchone()[0] == "refused_address"
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'partner.endpoint.refused_address'").fetchone()[0] >= 1


def test_restricted_endpoint_only_hears_about_its_floors(world, monkeypatch):
    tree = world["tree"]
    cid = _client(world)
    ep = _endpoint(world, cid, restriction_kind="floor", restriction_ids=[tree["floor2"]])
    _activate(world, ep, monkeypatch, Receiver())
    t = _token(world, _client(world, "creator"))
    assert _create(world, t["token"], "key-rfloor-03", floor_id=tree["floor3"]).status_code == 201
    assert _create(world, t["token"], "key-rfloor-02", floor_id=tree["floor2"]).status_code == 201
    with world["db"].connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM partner_outbox WHERE endpoint_id = ? AND type = 'ticket.created'", (ep["id"],)).fetchone()[0]
    assert n == 1


def test_nothing_is_queued_while_webhooks_are_off(world, monkeypatch):
    cid = _client(world)
    ep = _endpoint(world, cid)
    _activate(world, ep, monkeypatch, Receiver())
    world["c"].put(f"{API}/settings", json={"webhooks": False})
    t = _token(world, _client(world, "creator"))
    assert _create(world, t["token"], "key-off-00001").status_code == 201
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM partner_outbox WHERE type = 'ticket.created'").fetchone()[0] == 0


def test_payload_schemas_fail_closed():
    with pytest.raises(webhooks.PayloadInvalid):
        webhooks.build("endpoint.ping", {"endpoint_id": "pep_x", "at": "t", "extra": 1})
    with pytest.raises(webhooks.PayloadInvalid):
        webhooks.build("ticket.done", {"ticket_id": "x", "number": True, "at": "t"})  # a bool is never an int
    with pytest.raises(webhooks.PayloadInvalid):
        webhooks.build("ticket.done", {"ticket_id": "x", "at": "t"})
    assert webhooks.build("ticket.done", {"ticket_id": "x", "number": 3, "at": "t"}) == {"ticket_id": "x", "number": 3, "at": "t"}


def test_redeliver_and_secret_rotation(world, monkeypatch):
    cid = _client(world)
    ep = _endpoint(world, cid)
    _activate(world, ep, monkeypatch, Receiver())
    t = _token(world, _client(world, "creator"))
    _create(world, t["token"], "key-redel-001")
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(Receiver(statuses=(400,))))
    webhooks._OUT.clear()
    webhooks.deliver_due(world["db"], world["settings"])
    with world["db"].connection(mode="read") as conn:
        evt = conn.execute("SELECT id, state FROM partner_outbox WHERE type = 'ticket.created'").fetchone()
    assert evt["state"] == "dead"
    r = world["c"].post(f"{API}/endpoints/{ep['id']}/secret/rotate", json={"overlap_hours": 24})
    new_secret = r.json()["secret"]
    assert new_secret != ep["secret"]
    rec = Receiver()
    monkeypatch.setattr(webhooks, "TRANSPORT", httpx.MockTransport(rec))
    assert world["c"].post(f"{API}/outbox/{evt['id']}/redeliver").json()["state"] == "queued"
    webhooks._OUT.clear()
    webhooks.deliver_due(world["db"], world["settings"])
    req = rec.requests[0]
    assert req.headers["webhook-id"] == evt["id"] and len(req.headers["webhook-signature"].split(" ")) == 2
    for s in (new_secret, ep["secret"]):
        assert webhooks.verify(s, evt["id"], int(req.headers["webhook-timestamp"]), req.content, req.headers["webhook-signature"])


# ================================================================ leak scan, backup, notices

def test_no_token_secret_or_url_in_tables_audit_logs_or_lists(world, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    cid = _client(world)
    t = _token(world, cid)
    ep = _endpoint(world, cid)
    _activate(world, ep, monkeypatch, Receiver())
    _create(world, t["token"], "key-leak-0001")
    world["p"].get("/p/v1/whoami", headers=_h("arxp_" + "C" * 43))
    webhooks._OUT.clear()
    webhooks.deliver_due(world["db"], world["settings"])
    text = _all_text(world["db"])
    for secret in (t["token"], ep["secret"], "/in/arx"):
        assert secret not in text, secret
        assert secret not in caplog.text, secret
    lists = " ".join(world["c"].get(p).text for p in (f"{API}/tokens", f"{API}/endpoints", f"{API}/deliveries", f"{API}/clients"))
    for secret in (t["token"], core.token_hash(t["token"]), ep["secret"], "/in/arx"):
        assert secret not in lists


def test_backup_never_carries_partner_state():
    for table in ("partner_clients", "partner_tokens", "partner_endpoints", "partner_outbox", "partner_deliveries", "partner_idempotency", "partner_ticket_links"):
        assert table in backup.NEVER_EXPORTED_TABLES
    assert backup._kept_setting("partner.api") and backup._kept_setting("partner.webhooks") and backup._kept_setting("partner.token_max_days")


def test_owner_gone_and_expiry_notices(world, settings):
    cid = _client(world)
    bind(world["c"], settings, "adam", "system_admin", "installation", "*")
    r = world["c"].post(f"{API}/clients/{cid}/tokens", json={"scopes": ["elevators.read"], "expires_days": 10}, headers=as_user("adam"))
    assert r.status_code == 200, r.text
    with world["db"].connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-adam'")
        out = core.janitor(conn)
        again = core.janitor(conn)
        sources = [r[0] for r in conn.execute("SELECT source FROM notifications WHERE source LIKE 'partner.%'").fetchall()]
    assert out["owner_gone"] == 1 and out["expiring"] == 1 and again["owner_gone"] == 0 and again["expiring"] == 0
    assert sorted(sources) == ["partner.owner_gone", "partner.token_expiring"]
    assert world["p"].get("/p/v1/whoami", headers=_h(r.json()["token"])).status_code == 200  # owner answer 170: the token stays

def test_one_status_change_is_one_event_even_with_several_notifications(world, monkeypatch):
    cid = _client(world)
    ep = _endpoint(world, cid, events=("ticket.status_changed",))
    _activate(world, ep, monkeypatch, Receiver())
    data = {"ticket_id": "t-1", "number": 7, "from_status": None, "to_status": "in_progress", "at": core.iso(core.utcnow())}
    with world["db"].connection() as conn:
        assert webhooks.enqueue(conn, "ticket.status_changed", data, place=(None, None, None)) == 1
        assert webhooks.enqueue(conn, "ticket.status_changed", data, place=(None, None, None)) == 0
        assert webhooks.enqueue(conn, "ticket.status_changed", {**data, "to_status": "done"}, place=(None, None, None)) == 1
