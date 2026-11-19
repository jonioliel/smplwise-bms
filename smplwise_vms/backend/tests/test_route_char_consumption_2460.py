"""CR-ROUTE-CHAR-2460: real API tests for the consumption-family routes (CR-RESPONSE-MODELS-CONSUMPTION-2450) that no other test
reached, so their response model had never been compared with the route's own JSON: happy path through the wire oracle (counted in
THIS test, tests/support/wire_oracle.py, SW_WIRE_STRICT=1), the main refusal, and the audit row where the route audits.
Fake mirror states and store samples only (the fixtures of test_water_billing_s3.py); no infrastructure, no device."""
from __future__ import annotations

import calendar
import json
import time

from conftest import as_user, bind
from test_route_char_2460 import Oracle
from test_water_billing_s3 import API, account, app, bill, setup_billing  # noqa: F401 - `app` is the fixture

from smplwise.db import Database


def audit_rows(settings, action: str) -> list[dict]:
    with Database(settings.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


# ---------------------------------------------------------------- water meters: replacement

def test_water_meter_replacement(app):  # noqa: F811
    c, settings = app
    r = c.post(f"{API}/meters", json={"source_ref": "sensor.water_main"})
    assert r.status_code == 201, r.text
    m = r.json()
    bind(c, settings, "omer", "operator", "installation", "*")  # water.view + water.ack, no water.manage
    # one second after the counter life began (the creation second): a replacement in that same second is refused (422), so `at`
    # omitted (= now) would depend on the clock ticking between the two requests
    started = c.get(f"{API}/meters/{m['id']}").json()["epochs"][0]["started_at"]
    at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(calendar.timegm(time.strptime(started[:19], "%Y-%m-%dT%H:%M:%S")) + 1))
    body = {"revision": m["revision"], "at": at, "old_final_reading_l": 1250.5, "new_start_reading_l": 0, "note": "מונה חדש"}
    assert c.post(f"{API}/meters/{m['id']}/replace", json=body, headers=as_user("omer")).status_code == 403
    future = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 3600))
    bad = c.post(f"{API}/meters/{m['id']}/replace", json={**body, "at": future})
    assert bad.status_code == 422, bad.text
    early = c.post(f"{API}/meters/{m['id']}/replace", json={**body, "at": "2020-01-01T00:00:00Z"})
    assert early.status_code == 422 and early.json()["details"]["fields"] == ["at"], "before the current counter life began"
    assert audit_rows(settings, "infra.water.meter.replace") == []

    o = Oracle()
    r = c.post(f"{API}/meters/{m['id']}/replace", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["id"] == m["id"] and out["revision"] > m["revision"] and len(out["epochs"]) == 2
    o.compared(f"POST {API}/meters/{{meter_id}}/replace")
    rows = audit_rows(settings, "infra.water.meter.replace")
    assert len(rows) == 1 and rows[0]["resource_id"] == m["id"]
    d = json.loads(rows[0]["details_json"])
    assert d["typed_final"] is True and d["typed_start"] is True
    # the old revision is stale now
    stale = c.post(f"{API}/meters/{m['id']}/replace", json=body)
    assert stale.status_code == 409, stale.text


# ---------------------------------------------------------------- water billing: next customer number, tariff versions, history, bill events

def test_next_customer_number_is_for_managers(app):  # noqa: F811
    c, settings = app
    o = Oracle()
    r = c.get(f"{API}/customers/next-number")
    assert r.status_code == 200, r.text
    first = r.json()["customer_number"]
    assert isinstance(first, str) and first
    o.compared(f"GET {API}/customers/next-number")
    created = c.post(f"{API}/customers", json={"name": "לקוח"})
    assert created.status_code == 201 and created.json()["customer_number"] == first
    assert c.get(f"{API}/customers/next-number").json()["customer_number"] != first, "the shared ledger moved on"
    bind(c, settings, "omer", "operator", "installation", "*")
    assert c.get(f"{API}/customers/next-number", headers=as_user("omer")).status_code == 403


def test_add_a_tariff_version_recomputes_the_drafts(app):  # noqa: F811
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    draft = bill(c, acc["id"])
    tid = ids["tariff"]["id"]
    bind(c, settings, "omer", "operator", "installation", "*")
    v = {"effective_from": "2026-09-15", "water_price": "11.00", "sewage_price": "5.50"}
    assert c.post(f"{API}/tariffs/{tid}/versions", json=v, headers=as_user("omer")).status_code == 403
    assert c.post(f"{API}/tariffs/nope/versions", json=v).status_code == 404
    o = Oracle()
    r = c.post(f"{API}/tariffs/{tid}/versions", json=v)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["id"] == tid and len(out["versions"]) == 2
    assert out["drafts"] == {"recomputed": 1, "failed": []}, "the September draft is on this tariff"
    assert c.get(f"{API}/bills/{draft['id']}").json()["row_version"] > draft["row_version"]
    o.compared(f"POST {API}/tariffs/{{tid}}/versions")
    rows = audit_rows(settings, "infra.water.tariff.version.create")
    assert len(rows) == 1 and rows[0]["resource_id"] == tid
    assert json.loads(rows[0]["details_json"])["effective_from"] == "2026-09-15"
    # an invalid price is refused, nothing added
    assert c.post(f"{API}/tariffs/{tid}/versions", json={**v, "water_price": "-1"}).status_code == 422
    assert len(c.get(f"{API}/tariffs").json()["items"][0]["versions"]) == 2


def test_account_history_and_bill_events(app):  # noqa: F811
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    b = bill(c, acc["id"])
    bind(c, settings, "omer", "operator", "installation", "*")  # water.view: the history without money, no bill events
    bind(c, settings, "dana", "viewer", "installation", "*")  # no water.view at all

    o = Oracle()
    r = c.get(f"{API}/accounts/{acc['id']}/history?past=3")
    assert r.status_code == 200, r.text
    hist = r.json()
    assert len(hist["periods"]) >= 1 and {p["status"] for p in hist["periods"]} <= {"measured", "partial", "missing", "open"}
    r2 = c.get(f"{API}/accounts/{acc['id']}/history", headers=as_user("omer"))
    assert r2.status_code == 200, r2.text
    o.compared(f"GET {API}/accounts/{{aid}}/history")
    assert c.get(f"{API}/accounts/{acc['id']}/history", headers=as_user("dana")).status_code == 403
    assert c.get(f"{API}/accounts/nope/history").status_code == 404
    assert json.dumps(r2.json()).count("amount") <= json.dumps(hist).count("amount"), "money only with water.bills"

    o = Oracle()
    r = c.get(f"{API}/bills/{b['id']}/events")
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items and items[0]["action"] and items[0]["actor"]["kind"] in ("user", "system")
    o.compared(f"GET {API}/bills/{{bid}}/events")
    assert c.get(f"{API}/bills/{b['id']}/events", headers=as_user("omer")).status_code == 403
    assert c.get(f"{API}/bills/nope/events").status_code == 404
