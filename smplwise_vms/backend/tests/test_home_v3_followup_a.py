"""HOME-V3-FOLLOWUP-A-2431 (owner answers 2026-11-11): the server half of the home interface v3 follow-up.

* the recordings, the house log and the intercom are their own categories of the per-person list, on by default;
* migration 0215 adds the new categories (phase 2, phase 3, this follow-up) to every stored list - the intercom only where the doors
  category was on, since until now the intercom lived under it;
* a home-only person whose administrator hid the recordings / the house log is refused their routes (`home_module_off`);
* the bill file: GET /energy/bills/{id}/pdf passes the home-only gate (GET only, one whole route), still needs energy.bills, and for a
  home-only person serves an issued bill only, while the "bills" category is on."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import energy_billing as eb
from smplwise.services import energy_billing_pdf as pdfseam
from smplwise.services import home_interface as hi

NEW = ("recordings", "log", "intercom")
MIG = Path(hi.__file__).resolve().parents[1] / "migrations"


@pytest.fixture()
def client(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    a = create_app(replace(settings))
    c = TestClient(a)
    assert c.get("/api/v1/me").status_code == 200  # joni: the bootstrap system administrator
    yield c, a, settings
    hi.reset_state_for_tests()


def _code(r) -> str | None:
    try:
        return r.json().get("code")
    except ValueError:
        return None


# ---------------------------------------------------------------- the three new categories

def test_recordings_log_and_intercom_are_categories_on_by_default(client):
    c, _a, s = client
    assert all(m in hi.MODULES for m in NEW)
    assert len(set(hi.MODULES)) == len(hi.MODULES)
    assert set(NEW) <= set(c.get("/api/v1/home/policies").json()["modules"])
    bind(c, s, "dana", "operator", "installation", "*")
    assert set(NEW) <= set(c.get("/api/v1/home/overview", headers=as_user("dana")).json()["modules"])
    r = c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights", "intercom"]})
    assert r.status_code == 200 and r.json()["modules"] == ["lights", "intercom"]
    assert set(c.get("/api/v1/home/overview", headers=as_user("dana")).json()["modules"]) == {"lights", "intercom"}


# ---------------------------------------------------------------- migration 0215

def _policy_db(tmp_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(tmp_path / "m.db")
    conn.executescript((MIG / "0211_home_interface.sql").read_text(encoding="utf-8").split("INSERT INTO")[0])
    conn.executescript((MIG / "0213_home_v3_p1.sql").read_text(encoding="utf-8"))
    return conn


def _mods(conn: sqlite3.Connection, uid: str):
    v = conn.execute("SELECT modules_json FROM home_interface_policy WHERE user_id = ?", (uid,)).fetchone()[0]
    return v if v is None or not v.startswith("[") else json.loads(v)


def test_migration_0215_is_the_next_number_and_adds_the_new_categories_to_stored_lists(tmp_path: Path):
    numbers = sorted(int(f.name.split("_", 1)[0]) for f in MIG.glob("*.sql"))
    assert numbers[-1] == 215 and numbers.count(215) == 1 and (MIG / "0215_home_v3_categories.sql").exists()
    conn = _policy_db(tmp_path)
    rows = {
        "all": None,                               # every category: untouched
        "doors": json.dumps(["lights", "doors"]),  # doors on: the intercom joins
        "nodoors": json.dumps(["lights"]),         # doors hidden: the intercom stays hidden
        "some": json.dumps(["media", "log", "doors", "intercom"]),
        "broken": "not json",
        "object": json.dumps({"x": 1}),
        "empty": json.dumps([]),
    }
    for uid, mods in rows.items():
        conn.execute("INSERT INTO home_interface_policy (user_id, default_interface, modules_json, updated_at) VALUES (?, 'home', ?, 'x')", (uid, mods))
    conn.executescript((MIG / "0215_home_v3_categories.sql").read_text(encoding="utf-8"))
    p2 = ["presence", "calendar", "notices", "tickets", "schedules"]
    p3 = ["media", "announce", "bills", "water", "systems", "map"]
    assert _mods(conn, "all") is None
    assert _mods(conn, "doors") == ["lights", "doors", *p2, *p3, "recordings", "log", "intercom"]
    assert _mods(conn, "nodoors") == ["lights", *p2, *p3, "recordings", "log"]
    some = _mods(conn, "some")
    assert some[:4] == ["media", "log", "doors", "intercom"] and len(some) == len(set(some))
    assert set(some) == {"doors", *p2, *p3, "recordings", "log", "intercom"}
    assert _mods(conn, "broken") == "not json" and _mods(conn, "object") == '{"x": 1}'
    assert _mods(conn, "empty") == [*p2, *p3, "recordings", "log"]
    # every name the migration writes is one the server knows (a stored list stays valid for set_policy)
    for uid in ("doors", "nodoors", "some", "empty"):
        assert all(m in hi.MODULES for m in _mods(conn, uid)), uid
    # applied twice (it is not, but the statement itself is idempotent): nothing more is added
    before = {u: _mods(conn, u) for u in rows}
    conn.executescript((MIG / "0215_home_v3_categories.sql").read_text(encoding="utf-8"))
    assert {u: _mods(conn, u) for u in rows} == before


def test_the_app_applies_0215_on_start(client):
    _c, a, s = client
    with sqlite3.connect(s.db_path) as conn:
        assert conn.execute("SELECT 1 FROM schema_migrations WHERE version = 215").fetchone() is not None


# ---------------------------------------------------------------- the gate: hidden categories and the bill file

def test_gate_allows_the_bill_file_read_only_and_nothing_next_to_it():
    assert hi.home_allowed("/api/v1/energy/bills/b1/pdf")
    assert hi.home_allowed("/api/v1/energy/bills/b1/pdf/")
    assert hi.home_allowed("/api/v1/energy/bills/b1/pdf", method="HEAD")
    assert not hi.home_allowed("/api/v1/energy/bills/b1/pdf", method="POST")
    for p in ("/api/v1/energy/bills", "/api/v1/energy/bills/b1", "/api/v1/energy/bills/b1/issue", "/api/v1/energy/bills/b1/paid",
              "/api/v1/energy/bills/b1/events", "/api/v1/energy/bills/a/b/pdf", "/api/v1/energy/bills/b1/pdfx", "/api/v1/energy/bills/state"):
        assert not hi.home_allowed(p), p
    assert hi.module_route("/api/v1/playback/sessions") == "recordings"
    assert hi.module_route("/api/v1/playback/sessions/s1/seek") == "recordings"
    assert hi.module_route("/api/v1/events") == "log" and hi.module_route("/api/v1/events/e1") == "log"
    assert hi.module_route("/api/v1/intercom/calls") is None and hi.module_route("/api/v1/eventsx") is None


def test_home_only_person_is_refused_the_routes_of_a_hidden_category(client):
    c, _a, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    h = as_user("dana")
    assert c.put("/api/v1/home/policies/dev-dana", json={"home_only": True}).status_code == 200
    # no list = every category: the routes reach their own permission checks
    assert _code(c.get("/api/v1/events", headers=h)) not in ("home_module_off", "home_interface_only")
    assert _code(c.post("/api/v1/playback/sessions", headers=h, json={"camera_id": "x", "start_at": "2026-11-11T10:00:00Z"})) not in ("home_module_off", "home_interface_only")
    assert c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights", "cameras"]}).status_code == 200
    r = c.get("/api/v1/events", headers=h)
    assert r.status_code == 403 and _code(r) == "home_module_off"
    r = c.post("/api/v1/playback/sessions", headers=h, json={"camera_id": "x", "start_at": "2026-11-11T10:00:00Z"})
    assert r.status_code == 403 and _code(r) == "home_module_off"
    # the intercom's routes are never gated by the category (an incoming door call still rings)
    assert _code(c.get("/api/v1/intercom/calls", headers=h)) not in ("home_module_off", "home_interface_only")
    # the categories on again: allowed
    assert c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights", "cameras", "recordings", "log"]}).status_code == 200
    assert _code(c.get("/api/v1/events", headers=h)) != "home_module_off"


def test_a_person_not_home_only_is_not_judged_by_the_category_gate(client):
    c, _a, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    assert c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights"]}).status_code == 200
    assert _code(c.get("/api/v1/events", headers=as_user("dana"))) not in ("home_module_off", "home_interface_only")


def _fake_bill(state: str) -> dict:
    # a stored file that is missing: the route renders (faked) and does not try to store it again
    return {"id": "b1", "state": state, "snapshot_json": "{}", "pdf_path": "missing/b1.pdf", "pdf_sha256": "0" * 64, "number": "2026-0001", "account_id": "acc1"}


@pytest.fixture()
def bill_world(client, monkeypatch):
    c, a, s = client
    state = {"v": "issued"}
    monkeypatch.setattr(eb, "get_bill", lambda conn, bid: _fake_bill(state["v"]))
    monkeypatch.setattr(pdfseam, "render", lambda snap, logo=None, watermark=None: b"%PDF-1.4\n% home\n%%EOF\n")
    monkeypatch.setattr(eb, "logo_bytes", lambda *a, **k: None)
    return c, s, state


def test_bill_file_permission_and_home_only_rules(bill_world):
    c, s, state = bill_world
    url = "/api/v1/energy/bills/b1/pdf"
    # an operator (no energy.bills), home-only: the gate lets the call through and the route refuses on its permission
    bind(c, s, "dana", "operator", "installation", "*")
    assert c.put("/api/v1/home/policies/dev-dana", json={"home_only": True}).status_code == 200
    r = c.get(url, headers=as_user("dana"))
    assert r.status_code == 403 and _code(r) not in ("home_interface_only", "home_module_off")
    # a site administrator (holds energy.bills), home-only: an issued bill opens
    bind(c, s, "rina", "site_admin", "installation", "*")
    assert c.put("/api/v1/home/policies/dev-rina", json={"home_only": True}).status_code == 200
    h = as_user("rina")
    r = c.get(url, headers=h)
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/pdf") and r.content.startswith(b"%PDF")
    # ... a draft or a void bill does not (the home interface never lists them)
    for st in ("draft", "void"):
        state["v"] = st
        r = c.get(url, headers=h)
        assert r.status_code == 403 and _code(r) == "home_interface_only", st
    state["v"] = "paid"
    assert c.get(url, headers=h).status_code == 200
    # the "bills" category hidden: refused
    assert c.put("/api/v1/home/policies/dev-rina", json={"modules": ["lights", "energy"]}).status_code == 200
    r = c.get(url, headers=h)
    assert r.status_code == 403 and _code(r) == "home_module_off"
    # writes next to it stay closed to a home-only person
    r = c.post("/api/v1/energy/bills/b1/paid", headers=h, json={})
    assert r.status_code == 403 and _code(r) == "home_interface_only"
    # not home-only: the full interface's rules (a draft opens, with its watermark)
    assert c.put("/api/v1/home/policies/dev-rina", json={"home_only": False, "all_modules": True}).status_code == 200
    state["v"] = "draft"
    assert c.get(url, headers=h).status_code == 200


# ---------------------------------------------------------------- the visitor switch (owner answer 2: off at install)

def test_visitor_invitations_are_off_in_a_fresh_installation_and_only_a_system_admin_switches_them(client):
    c, _a, s = client
    r = c.get("/api/v1/access/visitors/settings")
    assert r.status_code == 200 and r.json()["visitors"] == "off"
    bind(c, s, "rina", "site_admin", "installation", "*")
    r = c.put("/api/v1/access/visitors/settings", headers=as_user("rina"), json={"visitors": "on"})
    assert r.status_code == 403
    r = c.put("/api/v1/access/visitors/settings", json={"visitors": "on"})
    assert r.status_code == 200 and r.json()["visitors"] == "on"
