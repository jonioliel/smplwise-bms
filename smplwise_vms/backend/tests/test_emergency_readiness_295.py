"""CR-EMERG104 (docs/changes/CR-EMERG104.md, owner answers 24.10 q201-q209 + q284): the read-only emergency readiness view.
NEGATIVE FIRST: switch off = uniform 404, no permission = audited 403, a redacted row still counts in the verdict. Then the item rules at every
green / amber / red edge (pure functions, plain numbers, no sleeps), the verdict, the configuration, the contact list (privacy), the history.
Cast (tests/tickets_world.py): joni system_admin; tom operator (maintenance.view, no manage); vic viewer (nothing). FAKES ONLY: no device,
no Home Assistant, nothing outside the database."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from tickets_world import API, build

from smplwise.db import Database, new_id
from smplwise.services.emergency import access as eaccess
from smplwise.services.emergency import model as m

E = f"{API}/emergency-readiness"
NOW = dt.datetime(2027, 1, 15, 10, 0, tzinfo=dt.timezone.utc)
TH = m.default_thresholds()


# ---------------------------------------------------------------- pure rules (no database)

def test_verdict_worst_critical_wins() -> None:
    g = {"status": "green", "critical": True}
    assert m.verdict([g, g]) == "ready"
    assert m.verdict([g, {"status": "red", "critical": True}]) == "not_ready"
    assert m.verdict([g, {"status": "unknown", "critical": True}]) == "ready_with_gaps"
    assert m.verdict([g, {"status": "amber", "critical": True}]) == "ready_with_gaps"
    assert m.verdict([g, {"status": "red", "critical": False}]) == "ready_with_gaps"  # a supporting red never makes NOT_READY ...
    assert m.verdict([g, {"status": "unknown", "critical": False}]) == "ready"
    assert m.verdict([g, {"status": "not_applicable", "critical": True}]) == "ready"
    assert m.verdict([{"status": "red", "critical": False}, g]) != "ready"  # ... and never READY either


def test_generator_test_edges() -> None:
    assert m.generator_test(35, True, None, TH) == "green"
    assert m.generator_test(35.1, True, None, TH) == "amber"
    assert m.generator_test(60, True, None, TH) == "amber"
    assert m.generator_test(60.1, True, None, TH) == "red"
    assert m.generator_test(1, False, None, TH) == "red"          # the last result failed
    assert m.generator_test(None, None, None, TH) == "red"        # no test ever recorded
    assert m.generator_test(None, None, 59, TH) == "amber"        # the ledger completion alone is amber at best
    assert m.generator_test(None, None, 61, TH) == "red"


def test_generator_state_edges() -> None:
    assert m.generator_state(50, "stopped", "auto", 12.6, [], TH) == "green"
    assert m.generator_state(49.9, "stopped", "auto", 12.6, [], TH) == "amber"
    assert m.generator_state(25, "stopped", "auto", 12.6, [], TH) == "amber"
    assert m.generator_state(24.9, "stopped", "auto", 12.6, [], TH) == "red"
    assert m.generator_state(80, "fault", "auto", 12.6, [], TH) == "red"
    assert m.generator_state(80, "stopped", "off", 12.6, [], TH) == "red"
    assert m.generator_state(80, "stopped", "manual", 12.6, [], TH) == "amber"
    assert m.generator_state(80, "stopped", "auto", 10.0, [], TH) == "amber"
    assert m.generator_state(80, "stopped", "auto", 12.6, ["critical"], TH) == "red"
    assert m.generator_state(80, "stopped", "auto", 12.6, ["alert"], TH) == "amber"
    assert m.generator_state(None, None, None, None, [], TH) == "unknown"
    assert m.generator_state(None, "stopped", "auto", 12.6, [], TH) == "unknown"  # never green on a guess


def test_backup_edges() -> None:
    assert m.backup(2, 180, 30, TH) == "green"
    assert m.backup(2.1, 180, 30, TH) == "amber"
    assert m.backup(7, None, None, TH) == "amber"
    assert m.backup(7.1, 1, 1, TH) == "red"
    assert m.backup(None, 1, 1, TH) == "red"
    assert m.backup(1, 181, 30, TH) == "amber"
    assert m.backup(1, 180, 31, TH) == "amber"


def test_delivery_and_camera_edges() -> None:
    assert m.deliveries(100, 4, 0, TH) == "green"
    assert m.deliveries(95, 5, 0, TH) == "amber"
    assert m.deliveries(80, 20, 0, TH) == "amber"
    assert m.deliveries(79, 21, 0, TH) == "red"
    assert m.deliveries(100, 0, 61, TH) == "red"
    assert m.deliveries(100, 0, 11, TH) == "amber"
    assert m.deliveries(0, 0, 0, TH) == "unknown"
    assert m.cameras(95, 0, TH) == "green"
    assert m.cameras(94.9, 0, TH) == "amber"
    assert m.cameras(79.9, 0, TH) == "red"
    assert m.cameras(100, 1, TH) == "red"  # a marked emergency camera is offline
    assert m.cameras(None, 0, TH) == "unknown"


def test_ledger_and_misc_rules() -> None:
    assert m.ledger_state([]) == "red"                       # an unbound critical slot is red, not omitted
    assert m.ledger_state(["ok", "overdue"]) == "red"
    assert m.ledger_state(["ok", "due_soon"]) == "amber"
    assert m.ledger_state(["ok", "none"]) == "unknown"
    assert m.ledger_state(["ok"]) == "green"
    assert m.evacuation_round(["ok"], ["issues"]) == "amber"
    assert m.evacuation_round(["ok"], [None]) == "unknown"
    assert m.elevator_states(["waiting", "fire_service"], False) == "green"   # fire service is an event, not a defect
    assert m.elevator_states(["waiting", "fault"], False) == "red"
    assert m.elevator_states(["door_open"], False) == "amber"
    assert m.elevator_states(["waiting"], True) == "unknown"
    assert m.contacts(0, 0, 2) == "red" and m.contacts(1, 1, 2) == "amber" and m.contacts(2, 1, 2) == "amber" and m.contacts(2, 2, 2) == "green"
    assert m.door_controls(False, False, False, None, None, TH) == "not_applicable"
    assert m.door_controls(True, False, True, "ready", 1, TH) == "red"
    assert m.door_controls(True, True, True, "connecting", 1, TH) == "red"
    assert m.door_controls(True, True, True, "ready", None, TH) == "amber"
    assert m.door_controls(True, True, True, "ready", 180, TH) == "green"
    assert m.door_controls(True, True, True, "idle", 1, TH) == "unknown"
    assert m.recorders([True], [False], [False], "ok", [False]) == "green"
    assert m.recorders([None], [False], [False], None, [False]) == "unknown"
    assert m.recorders([True], [True], [False], None, [False]) == "red"


def test_people_combines_list_and_derived_recipients() -> None:
    assert m.combine_people("green", 3, 0) == "green"
    assert m.combine_people("green", 3, 1) == "red"       # a critical source nobody would be told about
    assert m.combine_people("amber", 3, 0) == "amber"
    assert m.combine_people("red", 0, 0) == "red"


def test_thresholds_validation_and_merge() -> None:
    assert m.merged_thresholds({"fuel_green_pct": 60})["fuel_green_pct"] == 60
    assert m.merged_thresholds({"fuel_green_pct": 5000})["fuel_green_pct"] == 50         # out of range: the default stands
    assert m.merged_thresholds({"nonsense": 1}) == m.default_thresholds()
    with pytest.raises(m.Invalid):
        m.validate_thresholds({"nonsense": 1})
    with pytest.raises(m.Invalid):
        m.validate_thresholds({"fuel_green_pct": True})
    with pytest.raises(m.Invalid):
        m.check_order({**TH, "fuel_amber_pct": 90})                                      # amber above green


# ---------------------------------------------------------------- the API

class EW:
    def __init__(self, settings) -> None:
        self.w = build(settings)
        self.c = self.w.c
        self.db = Database(settings.db_path)
        eaccess.set_clock(lambda: NOW)

    def h(self, user: str) -> dict[str, str]:
        return self.w.h(user)

    def on(self) -> "EW":
        r = self.c.patch(f"{API}/settings", json={"emergency_readiness.enabled": "true", "maintenance.enabled": "true"})
        assert r.status_code == 200, r.text
        return self

    def rows(self, sql: str, args: tuple = ()) -> list:
        with self.db.connection(mode="read") as conn:
            return conn.execute(sql, args).fetchall()

    def items(self, user: str = "joni") -> dict[str, dict]:
        return {i["id"]: i for i in self.c.get(E, headers=self.h(user)).json()["items"]}


@pytest.fixture()
def ew(settings):
    world = EW(settings)
    yield world
    eaccess.set_clock(None)


def test_module_off_is_uniform_404(ew: EW) -> None:
    for path in ("", "/config", "/history", "/contacts", "/items/E01"):
        assert ew.c.get(f"{E}{path}", headers=ew.h("joni")).status_code == 404, path
        assert ew.c.get(f"{E}{path}", headers=ew.h("vic")).status_code == 404, path
    r = ew.c.get(f"{E}/module", headers=ew.h("tom"))
    assert r.status_code == 200 and r.json()["enabled"] is False


def test_switch_is_audited_and_default_off(ew: EW) -> None:
    assert ew.c.get(f"{API}/settings").json()["settings"]["emergency_readiness.enabled"] == "false"
    ew.on()
    assert ew.rows("SELECT 1 FROM audit_log WHERE action = 'emergency_readiness.module.enable'")


def test_permissions_default_deny_and_audited(ew: EW) -> None:
    ew.on()
    assert ew.c.get(E, headers=ew.h("vic")).status_code == 403
    assert ew.rows("SELECT 1 FROM audit_log WHERE decision = 'denied' AND action = 'emergency.view'")
    assert ew.c.get(E, headers=ew.h("tom")).status_code == 200                      # maintenance.view opens the page
    assert ew.c.get(f"{E}/config", headers=ew.h("tom")).status_code == 403          # configuring needs manage
    assert ew.c.put(f"{E}/config", json={"cameras": []}, headers=ew.h("tom")).status_code == 403
    assert ew.c.post(f"{E}/contacts", json={"display_name": "x", "phone": "0501234567"}, headers=ew.h("tom")).status_code == 403


def test_page_shape_redaction_and_verdict_parity(ew: EW) -> None:
    ew.on()
    admin = ew.c.get(E, headers=ew.h("joni")).json()
    narrow = ew.c.get(E, headers=ew.h("tom")).json()
    assert len(admin["items"]) == 20 and admin["verdict"] in ("ready", "ready_with_gaps", "not_ready")
    assert admin["verdict"] == narrow["verdict"]                                    # the verdict never looks better to a narrow role
    assert narrow["counts"]["hidden"] > 0
    hidden = [i for i in narrow["items"] if i["redacted"]]
    assert hidden and all(i["status"] == "hidden" and i["facts"] == [] for i in hidden)
    assert ew.items()["E03"]["status"] == "red"                                      # nothing bound: red, never green
    assert "אינו אישור ציות" in admin["disclaimer"]


def test_read_is_not_audited(ew: EW) -> None:
    ew.on()
    before = len(ew.rows("SELECT id FROM audit_log"))
    ew.c.get(E, headers=ew.h("joni"))
    assert len(ew.rows("SELECT id FROM audit_log")) == before


def test_binding_a_task_turns_the_slot_green_and_overdue_red(ew: EW) -> None:
    ew.on()
    r = ew.c.post(f"{API}/maintenance/tasks", json={"kind": "certificate", "title": "תעודת כיבוי אש", "category": "fire", "due_date": "2027-06-01"}, headers=ew.h("joni"))
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    cfg = ew.c.get(f"{E}/config", headers=ew.h("joni")).json()
    assert any(t["id"] == tid for t in cfg["suggestions"]["fire_certificate"])
    put = ew.c.put(f"{E}/config", json={"revision": cfg["revision"], "bindings": {tid: "fire_certificate"}}, headers=ew.h("joni"))
    assert put.status_code == 200, put.text
    assert ew.items()["E03"]["status"] == "green"
    with ew.db.connection() as conn:
        conn.execute("UPDATE maint_tasks SET due_date = '2027-01-01' WHERE id = ?", (tid,))
    assert ew.items()["E03"]["status"] == "red"
    assert ew.c.put(f"{E}/config", json={"revision": cfg["revision"], "cameras": []}, headers=ew.h("joni")).status_code == 409  # revision guarded
    assert ew.rows("SELECT 1 FROM audit_log WHERE action = 'emergency_readiness.config.update'")


def test_binding_foreign_or_wrong_kind_refused(ew: EW) -> None:
    ew.on()
    assert ew.c.put(f"{E}/config", json={"bindings": {"nope": "extinguishers"}}, headers=ew.h("joni")).status_code == 404
    t = ew.c.post(f"{API}/maintenance/tasks", json={"kind": "round", "title": "סבב", "category": "fire", "interval": {"unit": "week", "count": 1}, "anchor_date": "2027-01-20",
                                                              "checklist": [{"key": "a", "label": "בדיקה", "kind": "check"}]}, headers=ew.h("joni")).json()["id"]
    assert ew.c.put(f"{E}/config", json={"bindings": {t: "fire_certificate"}}, headers=ew.h("joni")).status_code == 422   # a round is not a certificate
    assert ew.c.put(f"{E}/config", json={"bindings": {t: "bogus"}}, headers=ew.h("joni")).status_code == 422


def test_thresholds_editable_and_validated(ew: EW) -> None:
    ew.on()
    ok = ew.c.put(f"{E}/config", json={"thresholds": {"backup_green_days": 3}}, headers=ew.h("joni"))
    assert ok.status_code == 200 and ok.json()["thresholds"]["effective"]["backup_green_days"] == 3
    assert ew.c.put(f"{E}/config", json={"thresholds": {"backup_green_days": 99}}, headers=ew.h("joni")).status_code == 422   # above the amber bound
    assert ew.c.put(f"{E}/config", json={"thresholds": {"bogus": 1}}, headers=ew.h("joni")).status_code == 422
    reset = ew.c.put(f"{E}/config", json={"thresholds": {"backup_green_days": None}}, headers=ew.h("joni"))
    assert reset.json()["thresholds"]["effective"]["backup_green_days"] == 2


def test_not_applicable_is_attributed_and_audited(ew: EW) -> None:
    ew.on()
    r = ew.c.put(f"{E}/config", json={"not_applicable": {"E01": {"note": "אין גנרטור במבנה"}}}, headers=ew.h("joni"))
    assert r.status_code == 200
    item = ew.items()["E01"]
    assert item["status"] == "not_applicable" and item["na"]["note"] == "אין גנרטור במבנה" and item["na"]["at"]
    assert ew.rows("SELECT 1 FROM audit_log WHERE action = 'emergency_readiness.na.set'")
    ew.c.put(f"{E}/config", json={"not_applicable": {"E01": None}}, headers=ew.h("joni"))
    assert ew.rows("SELECT 1 FROM audit_log WHERE action = 'emergency_readiness.na.clear'")


def test_emergency_cameras_make_e18_critical(ew: EW) -> None:
    ew.on()
    rec, cam = new_id(), new_id()
    with ew.db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES (?, 'r', 't')", (rec,))
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, status, created_at, updated_at) VALUES (?, ?, 1, 'offline', 't', 't')", (cam, rec))
    assert ew.items()["E18"]["critical"] is False
    assert ew.c.put(f"{E}/config", json={"cameras": [cam]}, headers=ew.h("joni")).status_code == 200
    marked = ew.items()["E18"]
    assert marked["critical"] is True and marked["status"] == "red"
    assert ew.c.put(f"{E}/config", json={"cameras": ["nope"]}, headers=ew.h("joni")).status_code == 404


def test_contacts_privacy_and_verification(ew: EW) -> None:
    ew.on()
    assert ew.c.post(f"{E}/contacts", json={"display_name": "ללא דרך קשר"}, headers=ew.h("joni")).status_code == 422
    assert ew.c.post(f"{E}/contacts", json={"display_name": "x", "phone": "abc"}, headers=ew.h("joni")).status_code == 422
    c = ew.c.post(f"{E}/contacts", json={"display_name": "דנה", "phone": "050-1234567"}, headers=ew.h("joni"))
    assert c.status_code == 201
    cid = c.json()["id"]
    # a non-manager sees only the count: never a name, a phone number or an e-mail
    seen = ew.c.get(f"{E}/contacts", headers=ew.h("tom")).json()
    assert seen["count"] == 1 and seen["items"] == []
    assert "050" not in json.dumps(ew.c.get(E, headers=ew.h("tom")).json())
    assert ew.items()["E13"]["status"] == "amber"                      # one reachable contact, not verified
    assert ew.c.post(f"{E}/contacts/{cid}/verify", headers=ew.h("joni")).status_code == 200
    r2 = ew.c.post(f"{E}/contacts", json={"display_name": "רן", "email": "ran@example.com"}, headers=ew.h("joni")).json()["id"]
    assert ew.items()["E13"]["status"] == "amber"                      # the second is not verified yet
    ew.c.post(f"{E}/contacts/{r2}/verify", headers=ew.h("joni"))
    assert ew.items()["E13"]["status"] == "green"
    ew.c.patch(f"{E}/contacts/{r2}", json={"email": "ran2@example.com"}, headers=ew.h("joni"))   # editing the route un-verifies it
    assert ew.items()["E13"]["status"] == "amber"
    assert ew.c.delete(f"{E}/contacts/{cid}", headers=ew.h("joni")).status_code == 204
    row = ew.rows("SELECT display_name, phone, email, user_id FROM emergency_contacts WHERE id = ?", (cid,))[0]
    assert (row["display_name"], row["phone"], row["email"], row["user_id"]) == ("-", "", "", None)   # deleting erases the personal data


def test_history_written_on_change_and_pruned(ew: EW) -> None:
    from smplwise.services.emergency import service as svc

    ew.on()
    with ew.db.connection() as conn:
        assert svc.snapshot(conn, None) is True
        assert svc.snapshot(conn, None) is False                # nothing changed, under a day
        conn.execute("UPDATE emergency_readiness_history SET taken_at = '2025-01-01T00:00:00Z'")   # older than the one-year keep
        assert svc.snapshot(conn, None, force=True) is True
        assert conn.execute("SELECT COUNT(*) FROM emergency_readiness_history WHERE taken_at < '2026-01-01'").fetchone()[0] == 0
        row = conn.execute("SELECT items_json FROM emergency_readiness_history").fetchone()
        assert set(json.loads(row["items_json"])) == set(m.ITEMS)   # ids and statuses only
    h = ew.c.get(f"{E}/history?days=30", headers=ew.h("tom"))
    assert h.status_code == 200 and h.json()["keep_days"] == 365
    assert ew.c.get(f"{E}/history", headers=ew.h("vic")).status_code == 403


def test_service_imports_no_device_write_path() -> None:
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[1] / "smplwise" / "services" / "emergency"
    text = "\n".join(p.read_text(encoding="utf-8") for p in root.glob("*.py"))
    for forbidden in ("door_execute", "ha_actions", "nvr_write", "requests.post", "httpx", "subprocess", "door_run_guard"):
        assert forbidden not in text, forbidden


def test_bound_task_files_are_listed_by_reference(ew: EW) -> None:
    ew.on()
    tid = ew.c.post(f"{API}/maintenance/tasks", json={"kind": "certificate", "title": "תעודה", "category": "fire", "due_date": "2027-06-01"}, headers=ew.h("joni")).json()["id"]
    assert ew.c.put(f"{E}/config", json={"bindings": {tid: "fire_certificate"}}, headers=ew.h("joni")).status_code == 200
    with ew.db.connection() as conn:
        conn.execute("INSERT INTO maint_files(id, task_id, kind, path, name, sha256, bytes, uploaded_by, uploaded_at) VALUES ('f1', ?, 'pdf', 'x/f1.pdf', 'cert.pdf', 'h', 10, 'joni', '2027-01-01T00:00:00Z')", (tid,))
    files = ew.items()["E03"]["files"]
    assert [f["name"] for f in files] == ["cert.pdf"] and files[0]["href"].endswith(f"/maintenance/tasks/{tid}/files/f1")
    assert "path" not in files[0] and "sha256" not in files[0]
    assert ew.items("tom")["E03"].get("files") is not None  # tom holds maintenance.view: the references are the ledger's own
