"""DATA-RULES-2540: the water twins of the billing data rules (review D-01, D-05) - the world of test_water_billing_s3.

- D-05: an automatic water draft is announced (`water.bill_draft`, to the holders of water.bills; before: no announcement at all) and is
  not deleted by the draft retention.
- D-01: a water account's cycle change after an issued bill starts where that bill ended.
Fake mirror states and store samples only; no infrastructure, no device."""
from __future__ import annotations

import datetime as dt

from conftest import bind
from test_water_billing_s3 import API, NOW, account, app, bill, setup_billing  # noqa: F401 - `app` is the fixture

from smplwise.db import Database
from smplwise.services import notify_policy
from smplwise.services import water_billing as wb

SOURCE = "water.bill_draft"


def _rows(settings, sql: str, *a):
    with Database(settings.db_path).connection(mode="read") as conn:
        return conn.execute(sql, a).fetchall()


def _auto_account(c, settings) -> dict:
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]}, auto_mode="draft")
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE water_accounts SET created_at = '2026-08-20T00:00:00Z' WHERE id = ?", (acc["id"],))
    return acc


def test_an_automatic_water_draft_is_announced_to_the_water_bill_holders(app):
    c, settings = app
    bind(c, settings, "ops", "operator", "installation", "*")  # an operator holds no water.bills by default
    _auto_account(c, settings)
    db = Database(settings.db_path)
    assert wb.auto_generate(db, settings, now=NOW).created == 1
    [b] = c.get(f"{API}/bills").json()["items"]
    notes = _rows(settings, "SELECT * FROM notifications WHERE source = ?", SOURCE)
    assert len(notes) == 1
    n = notes[0]
    assert (n["subject_kind"], n["subject_id"], n["severity"], n["category"]) == ("water_bills", b["id"], "info", "system")
    assert n["dedupe_key"] == f"{SOURCE}:{b['id']}" and n["link"] == f"#/infra/water/bills/{b['id']}" and "09/2026" in n["body"]
    who = {r[0] for r in _rows(settings, "SELECT user_id FROM notification_recipients WHERE notification_id = ?", n["id"])}
    assert who and "dev-ops" not in who
    assert wb.auto_generate(db, settings, now=NOW).created == 0 and len(_rows(settings, "SELECT 1 FROM notifications WHERE source = ?", SOURCE)) == 1
    with db.connection() as conn:
        assert SOURCE in {p["source"] for p in notify_policy.list_policies(conn)}


def test_the_water_source_is_not_listed_while_the_module_is_off(app):
    c, settings = app
    assert c.put(f"{API}/settings", json={"water.enabled": False}).status_code == 200
    with Database(settings.db_path).connection() as conn:
        assert SOURCE not in {p["source"] for p in notify_policy.list_policies(conn)}


def test_an_automatic_water_draft_survives_the_draft_retention(app):
    c, settings = app
    _auto_account(c, settings)
    db = Database(settings.db_path)
    assert wb.auto_generate(db, settings, now=NOW).created == 1
    written = _rows(settings, "SELECT updated_at FROM water_bills")[0][0]
    later = dt.datetime.fromisoformat(written.replace("Z", "+00:00")) + dt.timedelta(days=31)
    assert wb.retention(db, now=later) == {"drafts": 0, "bills": 0}
    assert len(c.get(f"{API}/bills").json()["items"]) == 1


def test_a_water_cycle_change_after_an_issued_bill_starts_where_it_ended(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    assert c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": "issue-00001"}).status_code == 200
    cur = c.get(f"{API}/accounts/{acc['id']}").json()
    r = c.patch(f"{API}/accounts/{acc['id']}", json={"base_revision": cur["revision"], "period_anchor_day": 15})
    assert r.status_code == 200, r.text
    assert r.json()["first_period_start"] == "2026-10-01"
    cur = r.json()
    r = c.patch(f"{API}/accounts/{acc['id']}", json={"base_revision": cur["revision"], "first_period_start": "2026-11-01"})
    assert r.status_code == 409 and r.json()["code"] == "cycle_start_mismatch"
