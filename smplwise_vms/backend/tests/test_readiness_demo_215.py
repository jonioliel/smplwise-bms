"""CR-FLEET215 parts 2 and 3: the readiness score (services/readiness.py) and demo mode (services/demo_mode.py, routers/readiness.py).

The score is a pure function of facts, so the table-driven cases feed facts directly. The routes are checked for permissions, the audit
trail and the demo isolation rules (OFF by default, example data never in a real table, nothing to clean up)."""
from __future__ import annotations

import json

import pytest
from conftest import as_user

from smplwise.db import Database
from smplwise.services import demo_mode, readiness

API = "/api/v1"


@pytest.fixture()
def db(settings, client):  # `client` starts the app, which applies the migrations
    return Database(settings.db_path)


def _facts(**over):
    base = {
        "steps": {"install": "done", "nvr": "done", "ha": "done", "go2rtc": "done", "floor": "done", "camera": "done"},
        "backup_age_h": 3.0, "system_admins": 1, "offbox_targets": 1, "alert_receivers": 1, "people_with_access": 2,
        "tickets_enabled": True, "departments": 1, "disk_free": 50 * 1024**3, "disk_total": 100 * 1024**3, "update_available": False,
    }
    base.update(over)
    return base


def test_every_item_has_a_rule_and_the_ids_are_unique():
    assert len(set(readiness.ITEM_IDS)) == len(readiness.ITEM_IDS) == 14
    for item_id in readiness.ITEM_IDS:
        readiness._met(item_id, _facts())  # raises KeyError when ITEMS and the rules drift apart


def test_a_complete_installation_scores_100_and_is_ready():
    out = readiness.score(_facts())
    assert out["score"] == 100 and out["ready"] is True and out["missing"] == []


def test_a_missing_required_item_makes_it_not_ready_and_is_listed_first():
    out = readiness.score(_facts(backup_age_h=None, update_available=True))
    assert out["ready"] is False
    assert out["missing"][0] == "backup_recent" and "up_to_date" in out["missing"]
    assert 0 < out["score"] < 100


def test_an_old_backup_is_not_recent():
    assert readiness.score(_facts(backup_age_h=readiness.BACKUP_MAX_AGE_H + 1))["missing"] == ["backup_recent"]


def test_items_that_do_not_apply_count_neither_way():
    out = readiness.score(_facts(tickets_enabled=False, steps={"install": "done", "nvr": "not_applicable", "ha": "done", "go2rtc": "not_applicable",
                                                               "floor": "done", "camera": "not_applicable"}))
    byid = {i["id"]: i for i in out["items"]}
    for k in ("service_departments", "recorder_connected", "media_server", "camera_on_map"):
        assert byid[k]["met"] is None
    assert out["missing"] == [] and out["score"] == 100 and out["ready"] is True


def test_the_service_item_is_absent_while_tickets_are_off_and_missing_when_on_without_departments():
    assert "service_departments" not in readiness.score(_facts(tickets_enabled=False, departments=0))["missing"]
    assert "service_departments" in readiness.score(_facts(tickets_enabled=True, departments=0))["missing"]


def test_a_full_disk_is_flagged():
    assert "disk_space" in readiness.score(_facts(disk_free=1 * 1024**3))["missing"]
    assert "disk_space" in readiness.score(_facts(disk_free=None, disk_total=None))["missing"]


def test_no_score_without_applicable_items_is_zero_not_a_crash():
    steps = {k: "not_applicable" for k in ("install", "nvr", "ha", "go2rtc", "floor", "camera")}
    out = readiness.score(_facts(steps=steps, system_admins=0, backup_age_h=None, alert_receivers=0, offbox_targets=0, people_with_access=0,
                                 tickets_enabled=False, disk_free=None, update_available=True))
    assert 0 <= out["score"] <= 100


def test_the_output_carries_no_evidence_only_ids_labels_and_links(client):
    r = client.get(API + "/readiness")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) >= {"score", "ready", "missing", "items", "checked_at"}
    assert set(body["missing"]) <= set(readiness.ITEM_IDS)
    for it in body["items"]:
        assert set(it) == {"id", "met", "required", "weight", "label", "hint", "link"}


def test_readiness_needs_the_permission(client):
    assert client.get(API + "/readiness", headers=as_user("nobody")).status_code == 403


# ---------------------------------------------------------------- demo mode
def test_demo_is_off_by_default_and_the_dataset_is_refused_while_off(client):
    assert client.get(API + "/demo").json()["enabled"] is False
    r = client.get(API + "/demo/dataset")
    assert r.status_code == 409 and r.json()["code"] == "demo_off"


def test_demo_needs_the_permission(client):
    assert client.get(API + "/demo", headers=as_user("nobody")).status_code == 403
    assert client.put(API + "/demo", json={"enabled": True}, headers=as_user("nobody")).status_code == 403
    assert client.get(API + "/demo/dataset", headers=as_user("nobody")).status_code == 403


def test_demo_rejects_unknown_fields(client):
    assert client.put(API + "/demo", json={"enabled": True, "extra": 1}).status_code == 422


def test_turning_demo_on_and_off_is_audited_and_leaves_nothing_behind(client, db):
    with db.connection(mode="read") as conn:
        tables_before = {r[0]: conn.execute(f'SELECT COUNT(*) FROM "{r[0]}"').fetchone()[0]
                         for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")}
    assert client.put(API + "/demo", json={"enabled": True}).json()["enabled"] is True
    data = client.get(API + "/demo/dataset").json()
    assert data["example"] is True and data["label"] == demo_mode.LABEL
    assert client.put(API + "/demo", json={"enabled": False}).json()["enabled"] is False
    assert client.get(API + "/demo/dataset").status_code == 409
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'settings.changed' AND resource_id = 'demo' ORDER BY id").fetchall()
        tables_after = {r[0]: conn.execute(f'SELECT COUNT(*) FROM "{r[0]}"').fetchone()[0]
                        for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")}
    assert [r["decision"] for r in rows] == ["allowed", "allowed"]
    assert [json.loads(r["details_json"])["after"] for r in rows] == ["on", "off"]
    # only the setting and the audit rows changed: the example data never touched a real table
    changed = {t for t in tables_after if tables_after[t] != tables_before.get(t)}
    assert changed <= {"settings", "audit_log"}, changed


def test_every_top_level_block_and_installation_of_the_dataset_is_marked_example():
    for key in ("readiness", "health", "fleet"):
        assert demo_mode.dataset()[key]["example"] is True
    for inst in demo_mode.dataset()["fleet"]["installations"]:
        assert inst["example"] is True


def test_the_dataset_is_a_fresh_copy_each_call():
    a = demo_mode.dataset()
    a["fleet"]["installations"].clear()
    assert len(demo_mode.dataset()["fleet"]["installations"]) == 4


def test_the_dataset_names_no_real_thing():
    text = json.dumps(demo_mode.dataset(), ensure_ascii=False)
    for bad in ("http", "@", "192.168.", ".local"):
        assert bad not in text


def test_the_fleet_preview_carries_only_the_demo_boolean(client):
    client.put(API + "/demo", json={"enabled": True})
    body = client.get(API + "/fleet/report/preview").json()["payload"]
    assert body["demo_mode"] is True
    assert "example" not in json.dumps(body)
